# Polyphony Architecture

Technical architecture for the Polyphony federated choral score ecosystem.

> **Terminology**: See [GLOSSARY.md](GLOSSARY.md) for definitions.

---

## 1. System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                           REGISTRY                                  │
│                    (Single Cloudflare deployment)                   │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  Deploy UI  │  │  Vault Dir  │  │  PD Catalog │  │ Handshake  │  │
│  │             │  │  (listing)  │  │   (links)   │  │ Introducer │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │
│                                                                     │
│  Storage: D1 only (metadata)          Files: None                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
              deploys / registers / introduces
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   VAULT A    │      │   VAULT B    │      │   VAULT C    │
│  (Choir X)   │◄────►│  (Choir Y)   │◄────►│  (Choir Z)   │
│              │ P2P  │              │ P2P  │              │
│  D1 + R2     │      │  D1 + R2     │      │  D1 + R2     │
└──────────────┘      └──────────────┘      └──────────────┘
     Each Vault = independent Cloudflare Pages deployment
```

---

## 2. Technology Stack

Based on proven evr-mail-mock stack:

| Layer            | Technology                 | Notes                                      |
| ---------------- | -------------------------- | ------------------------------------------ |
| **Framework**    | SvelteKit 2 + Svelte 5     | Full-stack, SSR capable                    |
| **Platform**     | Cloudflare Pages + Workers | Edge deployment, global CDN                |
| **Database**     | Cloudflare D1              | SQLite at edge, per-deployment             |
| **File Storage** | Cloudflare R2              | S3-compatible object storage (Vaults only) |
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
│   │   │       ├── deploy/     # Vault deployment wizard
│   │   │       ├── directory/  # Vault listing
│   │   │       └── catalog/    # PD score links
│   │   ├── migrations/
│   │   └── wrangler.toml
│   │
│   └── vault/                  # Vault SvelteKit app
│       ├── src/
│       │   ├── lib/
│       │   │   ├── server/
│       │   │   │   ├── db/
│       │   │   │   ├── storage/  # R2 operations
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
| **Auth Gateway**         | Stateless authentication service for all Vaults (OAuth, magic link)  |
| **Deploy UI**            | Wizard to create new Vault on user's Cloudflare account              |
| **Vault Directory**      | Opt-in listing of registered Vaults (name, location, public profile) |
| **PD Catalog**           | Searchable index of Public Domain scores (links to Vaults)           |
| **Handshake Introducer** | Facilitates initial contact between Vaults                           |

### 4.2 Database Schema (D1)

```sql
-- Registered Vaults
CREATE TABLE vaults (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,          -- For JWT verification
    callback_url TEXT NOT NULL,        -- Auth callback URL
    listed_in_directory INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_seen_at TEXT
);

-- PD Catalog entries (links to scores in Vaults)
CREATE TABLE pd_catalog (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL REFERENCES vaults(id),
    title TEXT NOT NULL,
    composer TEXT,
    score_url TEXT NOT NULL,           -- Deep link to Vault
    submitted_at TEXT DEFAULT (datetime('now')),
    verified INTEGER DEFAULT 0,
    UNIQUE(vault_id, score_url)
);

-- Pending Handshake introductions
CREATE TABLE handshake_requests (
    id TEXT PRIMARY KEY,
    requester_vault_id TEXT NOT NULL REFERENCES vaults(id),
    target_vault_id TEXT NOT NULL REFERENCES vaults(id),
    status TEXT DEFAULT 'pending',     -- pending, delivered, expired
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

CREATE INDEX idx_pd_catalog_composer ON pd_catalog(composer);
CREATE INDEX idx_pd_catalog_title ON pd_catalog(title);
```

### 4.3 API Endpoints

```text
# Authentication (stateless gateway)
GET    /auth                      # Start auth flow (redirect from Vault)
POST   /auth/callback             # OAuth callback handler
GET    /auth/.well-known/jwks     # Public key for token verification

# Vault management
POST   /api/vaults/register       # Register new Vault with Registry
GET    /api/vaults/directory      # List public Vaults

# Federation
POST   /api/handshake/request     # Request introduction to another Vault
GET    /api/handshake/pending     # Check for pending requests (polled by Vaults)

# PD Catalog
GET    /api/catalog               # Search PD catalog
POST   /api/catalog/submit        # Submit score link for PD catalog
DELETE /api/catalog/:id           # Remove from catalog (takedown)
```

---

## 5. Vault Architecture

### 5.1 Responsibilities

| Function              | Description                                       |
| --------------------- | ------------------------------------------------- |
| **Score Library**     | Upload, organize, view PDF scores                 |
| **Member Management** | Invite members, assign permissions                |
| **Federation**        | Handshake with other Vaults, access shared scores |
| **Takedown**          | Copyright complaint handling                      |

### 5.2 Database Schema (D1)

```sql
-- Vault configuration
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- Keys: vault_name, vault_id, registry_url

-- Choir members (see section 7.2 for details)
CREATE TABLE members (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,        -- Identity from Registry auth token
    name TEXT,
    role TEXT DEFAULT 'singer',        -- owner, admin, singer
    created_at TEXT DEFAULT (datetime('now'))
);

-- Auth nonces (prevents token replay)
CREATE TABLE used_nonces (
    nonce TEXT PRIMARY KEY,
    used_at TEXT DEFAULT (datetime('now'))
);

-- Scores
CREATE TABLE scores (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    composer TEXT,
    file_key TEXT NOT NULL,            -- R2 object key
    file_size INTEGER,
    content_type TEXT DEFAULT 'application/pdf',
    license_type TEXT DEFAULT 'private', -- pd, cc, original, transcription
    shareable INTEGER DEFAULT 0,       -- Can be shared with trusted Vaults
    pd_catalog_listed INTEGER DEFAULT 0,
    uploaded_by TEXT REFERENCES members(id),
    uploaded_at TEXT DEFAULT (datetime('now'))
);

-- Trusted Vaults (Handshake partners)
CREATE TABLE trusted_vaults (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL UNIQUE,     -- Remote Vault's ID
    vault_name TEXT,
    vault_url TEXT NOT NULL,
    public_key TEXT NOT NULL,          -- For verifying their JWTs
    trust_established_at TEXT DEFAULT (datetime('now')),
    trust_revoked_at TEXT              -- NULL = active trust
);

-- Access log (for audit)
CREATE TABLE access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    score_id TEXT REFERENCES scores(id),
    accessor_type TEXT,                -- member, trusted_vault
    accessor_id TEXT,
    action TEXT,                       -- view, download
    accessed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_scores_composer ON scores(composer);
CREATE INDEX idx_scores_license ON scores(license_type);
```

### 5.3 File Storage (R2)

```text
vault-{vault_id}/
├── scores/
│   ├── {score_id}.pdf
│   └── {score_id}.pdf
└── temp/
    └── uploads/
```

**Access pattern**: Signed URLs with short expiry (15 minutes) generated on-demand.

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
  iss: "https://registry.polyphony.app";
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

```typescript
type Role = "owner" | "admin" | "singer";

const permissions: Record<Role, string[]> = {
  owner: ["*"], // Everything
  admin: [
    "scores:read",
    "scores:write",
    "scores:delete",
    "members:read",
    "members:invite",
    "federation:read",
  ],
  singer: ["scores:read", "members:read"],
};
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

Each choir gets their own Cloudflare Pages project:

**Option A: Registry-assisted (recommended for non-technical users)**

1. User clicks "Deploy Vault" on Registry
2. Registry walks user through Cloudflare account creation/login
3. Registry uses Cloudflare API to create Pages project
4. Vault automatically registers with Registry

**Option B: Self-deploy**

1. User clones Vault repo
2. User runs `wrangler pages deploy`
3. User manually registers with Registry via API

**Bindings per Vault**:

- D1: Vault's own database
- R2: Vault's file storage

### 8.3 Environment Variables

**Registry**:

```toml
# wrangler.toml
[vars]
PUBLIC_URL = "https://registry.polyphony.app"

# Secrets (via wrangler secret put)
# CLOUDFLARE_API_TOKEN - for automated Vault deployment
# JWT_PRIVATE_KEY - for signing Registry tokens
```

**Vault**:

```toml
# wrangler.toml
[vars]
PUBLIC_URL = "https://choir-name.polyphony.app"
REGISTRY_URL = "https://registry.polyphony.app"

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
      → Upload to R2: scores/{id}.pdf
      → Insert metadata into D1
      → Return score object
```

### 9.2 View Shared Score from Peer

```text
Member → GET /api/federation/scores/{peerId}/{scoreId}
      → Look up peer in trusted_vaults
      → Generate JWT for request
      → Fetch from peer: GET {peer_url}/api/federation/serve/{scoreId}
      → Peer verifies JWT
      → Peer returns signed R2 URL
      → Redirect member to signed URL
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
// Per-Vault limits for federation endpoints
const FEDERATION_LIMITS = {
  requests_per_minute: 60,
  downloads_per_hour: 100,
  catalog_submissions_per_day: 10,
};
```

---

## 11. Development Phases

### Phase 1: Standalone Vault (MVP)

- [ ] Score upload/download (PDF only)
- [ ] Member invitation (magic link)
- [ ] Basic permission model
- [ ] Takedown endpoint

**No Registry, no federation yet.**

### Phase 2: Federation

- [ ] Registry deployment
- [ ] Vault registration
- [ ] Handshake protocol
- [ ] P2P score sharing
- [ ] PD Catalog

### Phase 3: Polish

- [ ] Interactive music rendering (OSMD)
- [ ] Mobile-responsive UI
- [ ] Offline access (service worker)
- [ ] MusicXML support

### Phase 4: Ecosystem

- [ ] Roster management
- [ ] Rehearsal agenda
- [ ] Public choir page
- [ ] Event calendar

---

## 12. Open Technical Questions

> See [CONCERNS.md](CONCERNS.md) for full list.

- [ ] Cloudflare API permissions needed for automated Vault deployment
- [ ] Key rotation strategy for long-lived Vaults
- [ ] Backup/restore workflow for D1 + R2 data
- [ ] Monitoring/alerting for distributed Vaults

---

_Last updated: 2026-01-24_
