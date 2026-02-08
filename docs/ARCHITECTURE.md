# Polyphony Architecture

Technical architecture for the Polyphony choral score platform.

> **Terminology**: See [GLOSSARY.md](GLOSSARY.md) for definitions.

---

## Architecture Fundamentals

1. **Single Vault Deployment**: One vault app hosts ALL organizations (collectives and umbrellas). No separate deployments per organization. Subdomains route to the same app.

2. **Zero-Storage Registry**: Handles auth (OAuth, magic link, SSO cookie) and messaging. Queries Vault public APIs for discovery. Does NOT store org/user/score data.

---

## 1. System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     REGISTRY (polyphony.uk)                         │
│                    (Zero-storage auth gateway)                      │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  OAuth      │  │  JWKS       │  │  SSO Cookie │  │ Org Reg UI │  │
│  │  Gateway    │  │  Endpoint   │  │  Management │  │ (calls API)│  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │
│                                                                     │
│  Storage: D1 (signing_keys, email_codes only)   Files: None         │
│  Directory & PD Catalog: Queries Vault public APIs at runtime       │
└─────────────────────────────────────────────────────────────────────┘
                              │
            queries public APIs / authenticates
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     VAULT (*.polyphony.uk)                          │
│                (Single deployment, all organizations)               │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ Public APIs │  │ Orgs/Members│  │ Score       │  │ Events/    │  │
│  │ /api/public │  │ Management  │  │ Library     │  │ Attendance │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │
│                                                                     │
│  Storage: D1 (all data)                 Files: D1 chunked BLOBs     │
│  Subdomain routing: crede.*, kamari.*, eca.* → same app             │
└─────────────────────────────────────────────────────────────────────┘

 Note: Federation (P2P sharing) is deferred to future phase
```

---

## 2. Technology Stack

Based on proven evr-mail-mock stack:

| Layer            | Technology                 | Notes                                      |
| ---------------- | -------------------------- | ------------------------------------------ |
| **Framework**    | SvelteKit 2 + Svelte 5     | Full-stack, SSR capable                    |
| **Platform**     | Cloudflare Pages + Workers | Edge deployment, global CDN                |
| **Database**     | Cloudflare D1              | SQLite at edge, per-deployment             |
| **File Storage** | Cloudflare D1              | Chunked BLOB storage (≤9.5MB per file)     |
| **Styling**      | Tailwind CSS v4            | Utility-first CSS                          |
| **Testing**      | Vitest + Playwright        | Unit + E2E                                 |
| **Language**     | TypeScript (strict)        | Type safety throughout                     |

---

## 3. Project Structure

### 3.1 Repository Layout

```text
polyphony/
├── packages/
│   └── shared/                 # @polyphony/shared npm package
│       ├── src/
│       │   ├── types/          # Shared TypeScript interfaces
│       │   ├── validators/     # Input validation (Zod schemas)
│       │   ├── crypto/         # JWT signing/verification
│       │   └── protocol/       # Handshake protocol types
│       └── package.json
│
├── apps/
│   ├── registry/               # Registry SvelteKit app
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── server/     # Server-only code
│   │   │   │   │   ├── db/     # D1 queries
│   │   │   │   │   └── services/
│   │   │   │   └── components/
│   │   │   └── routes/
│   │   │       ├── api/        # API endpoints
│   │   │       ├── register/   # Organization registration form
│   │   │       ├── directory/  # Organization directory
│   │   │       └── catalog/    # PD score links
│   │   ├── migrations/
│   │   └── wrangler.toml
│   │
│   └── vault/                  # Vault SvelteKit app
│       ├── src/
│       │   ├── lib/
│       │   │   ├── server/
│       │   │   │   ├── db/
│       │   │   │   ├── storage/  # D1 chunked storage
│       │   │   │   └── federation/
│       │   │   └── components/
│       │   └── routes/
│       │       ├── api/
│       │       │   ├── scores/
│       │       │   ├── members/
│       │       │   └── federation/  # Handshake endpoints
│       │       ├── library/     # Score browser
│       │       ├── upload/      # Score upload
│       │       └── settings/    # Vault config
│       ├── migrations/
│       └── wrangler.toml
│
├── docs/                       # This documentation
└── package.json                # Monorepo root (pnpm workspaces)
```

### 3.2 Monorepo Tooling

```json
// Root package.json
{
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev:registry": "pnpm --filter registry dev",
    "dev:vault": "pnpm --filter vault dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  }
}
```

---

## 4. Registry Architecture

### 4.1 Responsibilities

| Function                 | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| **Auth Gateway**         | Stateless authentication service (OAuth, magic link, SSO cookie)     |
| **SSO Management**       | Cookie on `.polyphony.uk` for cross-subdomain auth                   |
| **Registration UI**      | Form to create new organization (calls Vault public API)             |
| **Directory**            | Queries Vault `/api/public/organizations` at runtime                 |
| **PD Catalog**           | Queries Vault `/api/public/scores/pd` at runtime                     |

**Zero-Storage Principle**: Registry stores NO organization, user, or score data. Only auth-related data.

### 4.2 Database Schema (D1)

```sql
-- JWT Signing Keys (Ed25519)
CREATE TABLE signing_keys (
    id TEXT PRIMARY KEY,
    private_key TEXT NOT NULL,     -- JWK format
    public_key TEXT NOT NULL,      -- JWK format
    created_at TEXT DEFAULT (datetime('now')),
    revoked_at TEXT                -- NULL = active
);

-- Email Auth Codes (magic link)
CREATE TABLE email_auth_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    vault_id TEXT NOT NULL,        -- Target vault/org
    callback_url TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    used_at TEXT
);

-- Rate Limiting
CREATE TABLE email_rate_limits (
    email TEXT PRIMARY KEY,
    attempts INTEGER DEFAULT 1,
    last_attempt TEXT DEFAULT (datetime('now'))
);
```

**Note**: No `vaults` table. Registry discovers organizations by querying Vault public APIs.

### 4.3 API Endpoints

```text
# Authentication (stateless gateway)
GET    /auth                      # Start auth flow (redirect from Vault)
GET    /auth/callback             # OAuth callback handler
POST   /auth/logout               # Clear SSO cookie
GET    /.well-known/jwks.json     # Public key for token verification

# Email Auth (magic link)
POST   /auth/email                # Request magic link
GET    /auth/email/verify         # Verify email code

# Discovery (queries Vault public APIs)
GET    /directory                 # UI - queries Vault /api/public/organizations
GET    /catalog                   # UI - queries Vault /api/public/scores/pd

# Registration (calls Vault API)
GET    /register                  # Registration form
POST   /register                  # Calls Vault POST /api/public/organizations
```

---

## 5. Vault Architecture

### 5.1 Responsibilities

| Function              | Description                                       |
| --------------------- | ------------------------------------------------- |
| **Multi-Org Hosting** | Single deployment hosts all organizations         |
| **Score Library**     | Upload, organize, view PDF scores                 |
| **Member Management** | Invite members, assign permissions                |
| **Public APIs**       | Discovery endpoints for Registry queries          |
| **Takedown**          | Copyright complaint handling                      |

### 5.2 Public APIs (for Registry)

```text
# Discovery (no auth required)
GET    /api/public/organizations            # List all orgs (for directory)
GET    /api/public/subdomains/check/:sub    # Check subdomain availability
GET    /api/public/scores/pd                # List PD scores (for catalog)
POST   /api/public/organizations            # Create new organization (from Registry)
```

### 5.3 Database Schema (D1)

See [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md) for complete schema. Key tables:

```sql
-- Organizations (Schema V2 - supports umbrellas + collectives)
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,    -- e.g., 'crede' → crede.polyphony.uk
    type TEXT NOT NULL,                -- 'umbrella' | 'collective'
    contact_email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Members (global identity, org-agnostic)
CREATE TABLE members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,         -- Case-insensitive unique
    nickname TEXT,                     -- Compact display name
    email_id TEXT UNIQUE,              -- OAuth identity (NULL = roster-only)
    email_contact TEXT,                -- Contact preference
    invited_by TEXT REFERENCES members(id),
    joined_at TEXT DEFAULT (datetime('now'))
);

-- Member-Organization link (many-to-many)
CREATE TABLE member_organizations (
    member_id TEXT REFERENCES members(id),
    org_id TEXT REFERENCES organizations(id),
    nickname TEXT,                     -- Org-specific display name
    invited_by TEXT,
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (member_id, org_id)
);

-- Multi-role system (per-org roles)
CREATE TABLE member_roles (
    member_id TEXT NOT NULL,
    org_id TEXT REFERENCES organizations(id),
    role TEXT NOT NULL,                -- owner, admin, librarian, conductor, section_leader
    granted_at TEXT DEFAULT (datetime('now')),
    granted_by TEXT,
    PRIMARY KEY (member_id, COALESCE(org_id, ''), role)
);

-- Score Library (works → editions → files)
CREATE TABLE works (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id),
    title TEXT NOT NULL,
    composer TEXT,
    lyricist TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE editions (
    id TEXT PRIMARY KEY,
    work_id TEXT REFERENCES works(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    edition_type TEXT DEFAULT 'vocal_score',
    license_type TEXT DEFAULT 'owned',  -- public_domain, licensed, owned
    file_key TEXT,                      -- References edition_files
    created_at TEXT DEFAULT (datetime('now'))
);
```

> **Note:** Federation tables (trusted_vaults, etc.) are deferred to Phase 2.

### 5.3 File Storage (D1 Chunked)

Score PDFs are stored directly in D1 using chunked storage to work around the 2MB row limit:

```sql
-- Score file metadata
CREATE TABLE score_files (
    score_id TEXT PRIMARY KEY REFERENCES scores(id) ON DELETE CASCADE,
    data BLOB,                     -- File data (NULL if chunked)
    size INTEGER NOT NULL,
    original_name TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    is_chunked INTEGER DEFAULT 0,
    chunk_count INTEGER DEFAULT NULL
);

-- Chunks for large files (>2MB)
CREATE TABLE score_chunks (
    score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    data BLOB NOT NULL,
    size INTEGER NOT NULL,
    PRIMARY KEY (score_id, chunk_index)
);
```

**Storage approach**:

- Files ≤2MB: Single row in `score_files.data`
- Files >2MB: Split into ~1.9MB chunks, stored in `score_chunks`
- Maximum file size: 9.5MB (5 chunks × 1.9MB)

**D1 BLOB handling note**: D1 returns BLOB data as `number[]` (via `Array.from()`), not as `ArrayBuffer`. The `toArrayBuffer()` helper converts this back for HTTP responses.

### 5.4 API Endpoints

```text
# Score management
GET    /api/scores                # List scores (with filters)
POST   /api/scores                # Upload new score
GET    /api/scores/:id            # Get score metadata
GET    /api/scores/:id/download   # Get signed download URL
DELETE /api/scores/:id            # Delete score

# Member management
GET    /api/members               # List members
POST   /api/members/invite        # Send invitation
PATCH  /api/members/:id           # Update role
DELETE /api/members/:id           # Remove member

# Federation
POST   /api/federation/handshake  # Receive handshake request
GET    /api/federation/peers      # List trusted Vaults
DELETE /api/federation/peers/:id  # Revoke trust
GET    /api/federation/shared     # Browse shared scores from peers
GET    /api/federation/scores/:peerId/:scoreId  # Fetch score from peer

# Compliance
POST   /copyright                 # Receive takedown notice (public)
GET    /api/takedowns             # Admin view of notices
```

---

## 6. Handshake Protocol

> ⏳ **DEFERRED**: Federation (Handshake protocol) is planned for a future phase. Current focus is on single-vault multi-organization functionality.

### 6.1 Flow Diagram

```text
 VAULT A                      REGISTRY                      VAULT B
    │                            │                             │
    │  1. Request introduction   │                             │
    │  POST /api/handshake/request                             │
    │  {target_vault_id: B}      │                             │
    │──────────────────────────► │                             │
    │                            │                             │
    │                            │  2. Store pending request   │
    │                            │                             │
    │                            │  3. Vault B polls/notified  │
    │                            │ ◄───────────────────────────│
    │                            │  GET /api/handshake/pending │
    │                            │                             │
    │                            │  4. Return requester info   │
    │                            │───────────────────────────► │
    │                            │                             │
    │  5. Direct handshake       │                             │
    │ ◄──────────────────────────────────────────────────────► │
    │  POST /api/federation/handshake                          │
    │  {vault_id, public_key, signature}                       │
    │                            │                             │
    │  6. Exchange keys, establish trust                       │
    │ ◄──────────────────────────────────────────────────────► │
    │                            │                             │
    │  7. P2P communication begins (Registry not involved)     │
    │ ◄──────────────────────────────────────────────────────► │
```

### 6.2 JWT Structure

```typescript
// Vault-to-Vault request JWT
interface FederationJWT {
  iss: string; // Issuing Vault ID
  sub: string; // Target Vault ID
  iat: number; // Issued at
  exp: number; // Expires (short-lived: 5 minutes)
  action: string; // 'handshake' | 'list_scores' | 'fetch_score'
  resource?: string; // Score ID for fetch_score
}
```

### 6.3 Trust Verification

Every federated request:

1. Vault receives JWT in `Authorization: Bearer <token>` header
2. Decode JWT, extract `iss` (issuing Vault ID)
3. Look up public key in `trusted_vaults` table
4. Verify signature with public key
5. Check `trust_revoked_at` is NULL
6. Check `exp` not passed
7. Process request if all checks pass

---

## 7. Authentication & Authorization

### 7.1 Stateless Registry Auth

Registry acts as a **stateless authentication gateway**. It authenticates users but stores no user data.

#### Flow Diagram

```text
┌─────────┐         ┌──────────┐         ┌─────────────┐
│  User   │         │  Vault A │         │  Registry   │
└────┬────┘         └────┬─────┘         └──────┬──────┘
     │                   │                      │
     │ 1. Click "Login"  │                      │
     │ ─────────────────►│                      │
     │                   │                      │
     │ 2. Redirect to Registry                  │
     │ ◄─────────────────│                      │
     │   /auth?callback=vault-a.../auth/cb      │
     │        &vault_id=vault-a                 │
     │                   │                      │
     │ 3. User at Registry                      │
     │ ─────────────────────────────────────────►
     │                   │                      │
     │ 4. Registry authenticates                │
     │    (Google OAuth, magic link, etc.)      │
     │ ◄─────────────────────────────────────────
     │                   │                      │
     │ 5. Redirect with signed token            │
     │ ◄─────────────────────────────────────────
     │   vault-a.../auth/cb?token=eyJhbGc...    │
     │                   │                      │
     │ 6. Vault receives token                  │
     │ ─────────────────►│                      │
     │                   │                      │
     │ 7. Vault verifies signature              │
     │    (Registry public key from JWKS)       │
     │                   │                      │
     │ 8. Vault checks: is email in members?    │
     │    Yes → create session                  │
     │    No  → "Not a member" error            │
     │                   │                      │
     │ 9. Welcome!       │                      │
     │ ◄─────────────────│                      │
```

#### Auth Token Structure

```typescript
// Issued by Registry, verified by Vault
interface AuthToken {
  iss: "https://scoreinstitute.eu";
  sub: string; // User's email (the identity)
  aud: string; // vault_id that requested auth
  iat: number; // Issued at
  exp: number; // Short-lived: 5 minutes (one-time use)
  nonce: string; // Prevents replay attacks

  // Optional claims from OAuth provider
  name?: string;
  picture?: string;
}
```

#### What Registry Stores (Auth-Related)

**Nothing about users.** Only:

- Registry's own keypair for signing tokens
- Registered Vault callback URLs (to validate redirect targets)
- Rate limiting data (ephemeral, in KV)

#### Security Considerations

| Concern           | Mitigation                                               |
| ----------------- | -------------------------------------------------------- |
| Token replay      | Nonce + short expiry + Vault tracks used nonces          |
| Callback hijack   | Registry validates callback URL against registered Vault |
| Registry downtime | Existing Vault sessions continue; only new logins fail   |
| Privacy           | Registry sees auth events but stores no user data        |

### 7.2 Vault Member Management

Vault maintains its own member list. Members are identified by email.

```sql
CREATE TABLE members (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,    -- Matches sub claim from auth token
    name TEXT,                      -- Can be updated from token claims
    role TEXT DEFAULT 'singer',     -- owner, admin, singer
    created_at TEXT DEFAULT (datetime('now'))
);
```

**Invitation flow**:

1. Vault Owner adds email to members table
2. User visits Vault, clicks "Login"
3. Redirected to Registry, authenticates
4. Returns with token containing their email
5. Vault checks: email in members? → Access granted

### 7.3 Authorization Model

Multi-role system where members can hold multiple roles simultaneously:

```typescript
type Role = 'owner' | 'admin' | 'librarian' | 'conductor' | 'section_leader';

// Permissions are union of all assigned roles
const PERMISSIONS: Record<Role, string[]> = {
  owner: ['vault:delete'],              // Owner gets ALL permissions implicitly
  admin: ['members:invite', 'roles:manage'],
  librarian: ['scores:upload', 'scores:delete'],
  conductor: ['events:create', 'events:manage', 'events:delete', 'attendance:record'],
  section_leader: ['attendance:record'],
};

// All authenticated members have implicit permissions:
// - 'scores:view', 'scores:download'
```

---

## 8. Deployment Architecture

### 8.1 Registry Deployment

Single Cloudflare Pages project:

```bash
# Deploy from polyphony/apps/registry
wrangler pages deploy .svelte-kit/cloudflare
```

**Bindings**:

- D1: Registry database
- (No R2 - Registry doesn't store files)

### 8.2 Vault Deployment

Single Cloudflare Pages project hosting all organizations:

```bash
# Deploy from polyphony/apps/vault
wrangler pages deploy .svelte-kit/cloudflare
```

**Subdomain Routing**:

- Wildcard domain `*.polyphony.uk` routes to the same deployment
- Organization context determined from subdomain in request URL
- Example: `crede.polyphony.uk` → loads Crede organization data

**Bindings**:

- D1: Single database for all organizations

### 8.3 Environment Variables

**Registry**:

```toml
# wrangler.toml
[vars]
PUBLIC_URL = "https://scoreinstitute.eu"

# Secrets (via wrangler secret put)
# CLOUDFLARE_API_TOKEN - for automated Vault deployment
# JWT_PRIVATE_KEY - for signing Registry tokens
```

**Vault**:

```toml
# wrangler.toml
[vars]
PUBLIC_URL = "https://choir-name.scoreinstitute.eu"
REGISTRY_URL = "https://scoreinstitute.eu"

# Secrets
# JWT_PRIVATE_KEY - Vault's private key for federation
# JWT_PUBLIC_KEY - Vault's public key (also stored in Registry)
```

---

## 9. Data Flow Examples

### 9.1 Upload Score

```text
Member → POST /api/scores (multipart form)
      → Validate file type (PDF only for MVP)
      → Generate score ID
      → Store PDF in D1 (chunked if >2MB)
      → Insert metadata into D1 scores table
      → Return score object
```

### 9.2 View Shared Score from Peer

```text
Member → GET /api/federation/scores/{peerId}/{scoreId}
      → Look up peer in trusted_vaults
      → Generate JWT for request
      → Fetch from peer: GET {peer_url}/api/federation/serve/{scoreId}
      → Peer verifies JWT
      → Peer streams PDF from D1
      → Proxy response to member
```

### 9.3 Submit to PD Catalog

```text
Vault Owner → POST /api/scores/{id}/publish-pd
           → Validate score.license_type === 'pd'
           → Generate public URL for score
           → POST to Registry: /api/catalog/submit
           → Registry verifies Vault registration
           → Registry adds to pd_catalog
```

---

## 10. Security Considerations

### 10.1 Attack Vectors & Mitigations

| Attack                   | Mitigation                                            |
| ------------------------ | ----------------------------------------------------- |
| JWT theft                | Short expiry (5 min), HTTPS only                      |
| Malicious Vault scraping | Rate limiting, access logging, trust revocation       |
| Fake Vault registration  | Verify domain ownership during registration           |
| File upload exploits     | Validate file types, size limits, virus scan (future) |
| XSS in score viewer      | PDF displayed in sandboxed iframe                     |

### 10.2 Rate Limiting

```typescript
// Per-organization limits for federation endpoints (future)
const FEDERATION_LIMITS = {
  requests_per_minute: 60,
  downloads_per_hour: 100,
  catalog_submissions_per_day: 10,
};
```

---

## 11. Development Phases

### ✅ Phase 0: Foundation (Complete)

- [x] Registry OAuth gateway (Google)
- [x] EdDSA JWT signing/verification
- [x] JWKS endpoint for public keys
- [x] Vault registration and callback flow

### ✅ Phase 0.5: Schema V2 (Complete)

- [x] Multi-organization support (umbrellas + collectives)
- [x] Affiliation tracking between organizations  
- [x] Multi-role member system (5 roles)
- [x] Voices & sections with primary assignments
- [x] Score library (works → editions → files)
- [x] Physical copy inventory tracking
- [x] Event scheduling with participation/RSVP
- [x] Season and event repertoire management

### 🚧 Phase 1: Core Features (In Progress)

- [x] Score upload/download (D1 chunked, PDF only)
- [x] Name-based member invitations
- [x] Multi-role permission model
- [x] Takedown endpoint
- [x] SSO cookie across subdomains
- [ ] Public APIs for Registry
- [ ] Roster view with attendance tracking
- [ ] Season repertoire UI

### Phase 2: Federation (Deferred)

- [ ] Handshake protocol between organizations
- [ ] Private Circle score sharing

### Phase 3: Enhanced Experience

- [ ] Public umbrella affiliates page
- [ ] Mobile-responsive UI
- [ ] Offline access (service worker)

---

## 12. Open Technical Questions

> See [CONCERNS.md](CONCERNS.md) for full list.

- [ ] Public API design for Registry queries
- [ ] Key rotation strategy for long-lived signing keys
- [ ] Backup/restore workflow for D1 data
- [ ] Monitoring/alerting for single deployment

---

_Last updated: 2026-02-08_
