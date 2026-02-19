# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Polyphony is a platform for choral music sharing. It's a two-tier system:

- **Registry**: Zero-storage auth gateway. Handles OAuth, magic link, SSO cookies, and email notifications. Queries Vault's public APIs for discovery. Does NOT store user data, organization data, or scores.
- **Vault**: Single deployment hosting ALL organizations (collectives and umbrellas). All org/member/score data lives here. Subdomains route to the same app.

Built on SvelteKit 2 + Svelte 5 (Runes), deployed on Cloudflare Pages + Workers with D1 (SQLite) database.

## Architecture Fundamentals

1. **Single Vault Deployment**: One vault app deployment. All organizations are hosted in this single app. No separate deployments per organization.

2. **Zero-Storage Registry**: Registry handles auth and discovery only. It queries Vault's public APIs at runtime—no local storage of org/user/score data.

## Monorepo Structure

This is a pnpm workspace with three main packages:

```
polyphony/
├── packages/shared/        # @polyphony/shared - Shared types, crypto, validators
├── apps/registry/          # Registry application (auth + discovery)
└── apps/vault/             # Vault application (single deployment, all orgs)
```

## Common Development Commands

### Running Development Servers

```bash
# Registry dev server (default)
pnpm dev

# Vault dev server
cd apps/vault && pnpm dev

# Run specific app from root
pnpm --filter registry dev
pnpm --filter vault dev
```

### Testing

```bash
# Run all tests across all packages
pnpm test

# Watch mode for unit tests
pnpm test:unit

# Run tests in specific app
cd apps/vault && pnpm test
cd apps/registry && pnpm test

# Run shared package tests
cd packages/shared && pnpm test

# E2E tests (Vault only)
cd apps/vault && pnpm test:e2e
```

### Type Checking & Linting

```bash
# Type check all packages
pnpm check

# Type check + test everything
pnpm validate

# Format code
cd apps/vault && pnpm format
cd apps/registry && pnpm format
```

### Database Migrations

```bash
# Apply migrations locally (for development)
cd apps/vault
wrangler d1 migrations apply DB --local

cd apps/registry
wrangler d1 migrations apply DB --local

# Apply to production
wrangler d1 migrations apply DB
```

## Architecture Highlights

### Two-App System

- **Registry**: Zero-storage auth gateway. Handles OAuth, magic link, SSO cookies (`.polyphony.uk`), and email notifications. Queries Vault public APIs for org directory and PD catalog. Stores only auth-related data (signing keys, email auth codes).
- **Vault**: Single deployment hosting all organizations. Stores members, scores, organizations, and file data. Exposes public APIs (`/api/public/*`) for Registry to query.

### Technology Stack

| Component       | Technology                 | Notes                                                     |
| --------------- | -------------------------- | --------------------------------------------------------- |
| Framework       | SvelteKit 2 + Svelte 5     | Use Runes ($state, $derived, $effect) not legacy $ syntax |
| Platform        | Cloudflare Pages + Workers | Edge deployment                                           |
| Database        | Cloudflare D1 (SQLite)     | Per-deployment, local dev with wrangler                   |
| File Storage    | D1 BLOBs (chunked)         | NO R2 - files in edition_files/edition_chunks tables      |
| Auth            | EdDSA (Ed25519) JWTs       | Registry signs, Vaults verify via JWKS                    |
| Testing         | Vitest + Playwright        | Unit + E2E                                                |
| Package Manager | pnpm (workspaces)          | Use workspace:\* for internal deps                        |

### Critical Server/Client Boundary

Server-only code MUST be in `src/lib/server/` directories. Access D1 via `platform.env.DB` in `+server.ts` and `+page.server.ts` files:

```typescript
// src/routes/api/members/+server.ts
export async function GET({ platform }) {
  const db = platform.env.DB; // Type: D1Database
  return json(await getAllMembers(db));
}
```

Shared types live in `packages/shared/src/types/`. Import as `@polyphony/shared`.

### Multi-Role System (Vault Members)

Members can have MULTIPLE roles simultaneously: owner, admin, librarian, conductor. Implemented via `member_roles` junction table (migration 0007).

```typescript
// Member interface
export interface Member {
  id: string;
  email: string;
  name: string;
  roles: Role[]; // ['owner', 'admin'] - array, not single string!
}
```

Permission model: Permissions are union of all assigned roles. All authenticated members have implicit 'scores:view' and 'scores:download'. See `apps/vault/src/lib/server/auth/permissions.ts` for full matrix.

### Chunked D1 BLOB Storage

PDFs stored in D1 to avoid R2 billing. Files >9.5MB split into ~9MB chunks:

- Small files: Single BLOB in `edition_files.data`
- Large files: `is_chunked=1`, chunks in `edition_chunks` table

Implementation: `apps/vault/src/lib/server/storage/edition-storage.ts`

### EdDSA JWT Authentication

Flow: Vault → Registry OAuth → Google → Registry signs JWT → Vault verifies via JWKS

Key files:

- Registry signing: `packages/shared/src/crypto/jwt.ts`
- Vault verification: `packages/shared/src/auth/verify.ts`
- JWKS endpoint: Registry exposes public key at `/.well-known/jwks.json`

Token lifetime: 5 minutes. Includes nonce for replay protection.

### Svelte 5 Runes (NOT Legacy Syntax)

Use `$state`, `$derived`, `$effect` instead of `$:` syntax. REASSIGN arrays/objects to trigger reactivity:

```svelte
<script lang="ts">
  let members = $state([...]);

  // ❌ WRONG - mutation doesn't trigger reactivity
  members[0].role = 'admin';

  // ✅ CORRECT - reassign array
  members = members.map(m => m.id === id ? {...m, role: 'admin'} : m);
</script>
```

Sync server data with `$effect`:

```svelte
let { data } = $props();
let localState = $state(untrack(() => data.value));
$effect(() => { localState = data.value; });
```

## Database Schemas

### Registry Tables (Auth Only)

- `signing_keys`: Ed25519 keypairs for JWT signing
- `email_auth_codes`: Magic link verification codes
- `email_rate_limits`: Rate limiting for email auth

**Note**: Registry does NOT store organizations, users, or scores. It queries Vault's public APIs.

### Vault Tables

- `members`: Choir members (id, email, name)
- `member_roles`: Role assignments (junction table)
- `member_voices`: Member vocal capabilities (junction table with voices)
- `member_sections`: Member section assignments (junction table with sections)
- `voices`: Vocal ranges (Soprano, Alto, Tenor, Bass, etc.)
- `sections`: Performance sections (S1, S2, T1, T2, Full Choir, etc.)
- `works`: Abstract compositions (title, composer, lyricist)
- `editions`: Specific publications of works (name, arranger, license_type, file_key)
- `edition_files`: PDF BLOBs or chunking metadata
- `edition_chunks`: File chunks for large PDFs
- `physical_copies`: Individual numbered copies of editions
- `copy_assignments`: Who has which physical copy checked out
- `invites`: Name-based invitations (email from Registry OAuth)
- `invite_voices`: Voice assignments for invites (junction table)
- `invite_sections`: Section assignments for invites (junction table)
- `takedowns`: DMCA/DSA takedown requests
- `vault_settings`: Key-value configuration store (migration 0010)

Role types: `'owner' | 'admin' | 'librarian' | 'conductor' | 'section_leader'`
License types: `'public_domain' | 'licensed' | 'owned'``

Full schema details: `docs/schema/README.md` (split into modules under `docs/schema/`)

## Key File Locations

### Shared Package

- Types: `packages/shared/src/types/index.ts`
- JWT crypto: `packages/shared/src/crypto/jwt.ts`
- Token verification: `packages/shared/src/auth/verify.ts`

### Registry

- OAuth initiation: `apps/registry/src/routes/auth/+server.ts`
- OAuth callback: `apps/registry/src/routes/auth/callback/+server.ts`
- JWKS endpoint: `apps/registry/src/routes/.well-known/jwks.json/+server.ts`

### Vault

- Member operations: `apps/vault/src/lib/server/db/members.ts`
- Edition storage: `apps/vault/src/lib/server/storage/edition-storage.ts`
- Permissions: `apps/vault/src/lib/server/auth/permissions.ts`
- Settings: `apps/vault/src/lib/server/db/settings.ts`
- Member UI: `apps/vault/src/routes/members/+page.svelte`

## Naming Conventions

- SvelteKit routes: `+page.svelte`, `+server.ts`, `+layout.svelte`, `+page.server.ts`
- Test files: `*.spec.ts` (Vitest), tests in same directory as source
- Types: CamelCase interfaces in `types.ts` or `index.ts`
- Database files: lowercase with underscores (`members.ts`, `0001_initial.sql`)

## Workflow Patterns

### Adding a New Vault Route

1. Create `src/routes/<route>/+page.svelte` for UI
2. Add `+page.server.ts` if server data needed (load function)
3. Add `+server.ts` for API endpoints (access `platform.env.DB`)
4. Write tests in `*.spec.ts` alongside route files
5. Update types in `src/lib/types.ts` if needed

### Adding Shared Code

1. Add to `packages/shared/src/types/` or `src/crypto/`
2. Export from `packages/shared/src/index.ts`
3. Write tests in `*.spec.ts`
4. Import as `@polyphony/shared` in apps

### Database Schema Change

1. Create new migration `apps/<app>/migrations/XXXX_description.sql`
2. Apply locally: `wrangler d1 migrations apply DB --local`
3. Update TypeScript interfaces in `src/lib/server/db/*.ts`
4. Update relevant file in `docs/schema/` if major change
5. Test with existing data

## Important Context

### Legal Design (Private Circle Defense)

Polyphony relies on EU copyright exemption (Directive 2001/29/EC, Art. 5.2) for "private use within family circle." Key rules:

- Registry NEVER hosts copyrighted files (only PD links)
- Vaults are invite-only (no public access)
- Handshakes require bilateral approval
- Vault owner is responsible for content legality

See `docs/LEGAL-FRAMEWORK.md` for details.

### Current Phase Status

✅ **Phase 0 Complete**: Registry OAuth + JWKS + token verification library (62 tests passing)
🚧 **Phase 1 In Progress**: Vault library + multi-role member management

### Active Development (from GitHub Issues)

**Epic #53 - Events, Programs & Participation** (Phase 1/2):

- #54: Vault settings table (default rehearsal duration) - OPEN
- #55: Add conductor role to permission system - OPEN
- #56: Events and programs database layer - OPEN
- #57: Events API endpoints - OPEN
- #58: Events UI (repeat picker, program editor) - OPEN
- #59: Participation database (RSVP + attendance) - OPEN (Phase 2)
- #60: Participation UI - OPEN (Phase 2)

**Other Open Work**:

- #47: Accessibility improvements for member management UI
- #45: Manual acceptance testing on live deployment
- #26: Implement localhost exception for dev

**Completed Recently** (refactoring epic #48):

- #52: Extract permission helper functions ✅
- #51: Add Zod validation schemas ✅
- #50: Consolidate auth middleware ✅
- #49: Remove unused invite handler library ✅

**Future Ops Work** (Epic #27 - Production Hardening):

- #32: Deploy audit logging
- #31: Rate limiting for OAuth endpoints
- #30: Key rotation procedure
- #29: Monitoring and error tracking
- #28: Custom domain configuration

### Cloudflare Bindings

Registry (`apps/registry/wrangler.toml`):

- `DB` - D1 database (`polyphony-registry-db`)

Vault (`apps/vault/wrangler.toml`):

- `DB` - D1 database (`polyphony-vault-db`)
- Environment vars: `REGISTRY_OAUTH_URL`, secrets: `SESSION_SECRET`

Access via `platform.env` in server code.

## Development Tips

- Use `pnpm -r <cmd>` to run commands in all packages recursively
- Use `pnpm --filter <app> <cmd>` to run in specific app
- Always run tests after making changes: `pnpm test`
- For DB work, use wrangler commands from app directory (not root)
- Avoid over-engineering: Keep solutions simple and focused
- Don't add features beyond what's requested
- Don't create helpers/abstractions for one-time operations
- Check GitHub issues for upcoming features before starting new work

## Documentation

Key documentation files in `docs/`:

- `GLOSSARY.md` - Canonical terminology (use consistently!)
- `ARCHITECTURE.md` - Technical architecture details
- `schema/README.md` - Vault schema (ERD + tables, split into modules)
- `LEGAL-FRAMEWORK.md` - Private Circle defense, compliance
- `CONCERNS.md` - Open questions and decisions
- `PHASE0-COMPLETION-REPORT.md` - Phase 0 summary
- `DEVELOPMENT-WORKFLOW.md` - Development practices
