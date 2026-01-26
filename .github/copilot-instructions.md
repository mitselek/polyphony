# Copilot Instructions: Polyphony

**Federated choral music sharing platform.** Two-tier system: Registry (auth gateway + discovery) + distributed Vaults (choir libraries). Built on SvelteKit + Cloudflare (D1/Pages).

## System Architecture

### Two-App Monorepo

```text
polyphony/
├── packages/shared/         # @polyphony/shared - Types, crypto, validators
├── apps/
│   ├── registry/           # Single global instance (OAuth, Vault deploy, directory)
│   └── vault/              # Per-choir instance (library, members, federation)
```

**Critical boundary**: Registry does NOT host score files (only links). Vaults are independent deployments, each with own D1 database. After Handshake, Vaults communicate P2P—Registry only introduces them.

### Technology Stack

| Layer               | Tech                       | Notes                                                       |
| ------------------- | -------------------------- | ----------------------------------------------------------- |
| **Framework**       | SvelteKit 2 + Svelte 5     | Runes (`$state`, `$derived`, `$effect`)                     |
| **Platform**        | Cloudflare Pages + Workers | Edge deployment, no servers                                 |
| **Database**        | Cloudflare D1 (SQLite)     | Per-deployment, local dev with wrangler                     |
| **File Storage**    | D1 BLOBs (chunked)         | NO R2 - files stored in `score_files`/`score_chunks` tables |
| **Auth**            | EdDSA (Ed25519) JWTs       | Registry signs, Vaults verify via JWKS                      |
| **Testing**         | Vitest + Playwright        | Unit + E2E, `npm test` runs all                             |
| **Package Manager** | pnpm (workspaces)          | `pnpm -r <cmd>` runs in all packages                        |

## Critical Patterns

### 1. Server/Client Boundary (SvelteKit Convention)

Server-only code in `src/lib/server/` MUST NOT be imported by client. Access D1 via `platform.env.DB` in `+server.ts` and `+layout.server.ts`:

```typescript
// src/routes/api/members/+server.ts
export async function GET({ platform }) {
  const db = platform.env.DB; // Type: D1Database
  return json(await getAllMembers(db));
}
```

Shared types live in `packages/shared/src/types/`. Server-specific types in `src/lib/server/`.

### 2. Multi-Role System & Permissions (Vault Members)

Vault members can have MULTIPLE roles simultaneously (owner, admin, librarian). Normalized via `member_roles` junction table (migration 0007).

```typescript
// src/lib/server/db/members.ts
export interface Member {
  roles: Role[]; // ['owner', 'admin'] - not a single string!
}
```

**Permission Matrix**: Permissions are union of all assigned roles (see [auth/permissions.ts](../apps/vault/src/lib/server/auth/permissions.ts)):

```typescript
const PERMISSIONS: Record<Role, Permission[]> = {
  librarian: ["scores:upload", "scores:delete"],
  admin: ["members:invite", "roles:manage"],
  owner: ["vault:delete"], // Owner gets all permissions
};
// All authenticated members have implicit 'scores:view' and 'scores:download'
```

**UI Pattern**: Role badges are toggleable (see [members/+page.svelte](../apps/vault/src/routes/members/+page.svelte)):

```svelte
{#each member.roles as role}
  <button onclick={() => toggleRole(member.id, role)}>
    {role}
  </button>
{/each}
```

### 3. Chunked D1 BLOB Storage

PDFs stored in D1 to avoid R2 billing requirement (see issue #33). Files >9.5MB split into chunks:

- Small files: Single BLOB in `score_files.data`
- Large files: `is_chunked=1`, chunks in `score_chunks` table (indexed by `score_id` + `chunk_index`)

**Implementation**: [src/lib/server/storage/d1-chunked-storage.ts](../apps/vault/src/lib/server/storage/d1-chunked-storage.ts)

```typescript
const CHUNK_SIZE = 9 * 1024 * 1024; // 9MB per chunk
```

### 4. EdDSA JWT Authentication (Phase 0)

**Flow**: Vault → Registry OAuth → Google → Registry signs JWT → Vault verifies via JWKS.

**Key components**:

- **Registry**: [packages/shared/src/crypto/jwt.ts](../packages/shared/src/crypto/jwt.ts) - `signToken()`
- **Vault**: [packages/shared/src/auth/verify.ts](../packages/shared/src/auth/verify.ts) - `verifyRegistryToken()`
- **JWKS**: Registry exposes public key at `/.well-known/jwks.json`

**Token lifetime**: 5 minutes (see `TOKEN_EXPIRY_SECONDS`). Includes nonce for replay protection.

### 5. Svelte 5 Reactivity (Runes)

**Critical**: Use `$state`, `$derived`, `$effect` instead of `$:` syntax. When updating arrays/objects, REASSIGN to trigger reactivity:

```svelte
<script lang="ts">
  let members = $state([...]);

  // ❌ WRONG - mutation doesn't trigger reactivity
  members[0].role = 'admin';

  // ✅ CORRECT - reassign array
  members = members.map(m => m.id === id ? {...m, role: 'admin'} : m);
</script>
```

**Server data sync**: Use `$effect` to watch `data` prop changes:

```svelte
let { data } = $props();
let localState = $state(untrack(() => data.value)); // Initial value
$effect(() => { localState = data.value; }); // Sync on navigation
```

## Database Schemas

### Registry (`apps/registry/migrations/`)

- **vaults**: Registered Vaults (id, name, callback_url)
- **signing_keys**: Ed25519 keypairs for JWT signing

### Vault (`apps/vault/migrations/`)

- **members**: Choir members (id, email, name, voice_part)
- **member_roles**: Role assignments (junction table, migration 0007)
- **scores**: Sheet music metadata (id, title, composer, license_type, file_key)
- **score_files**: PDF BLOBs or chunking metadata
- **score_chunks**: File chunks for large PDFs
- **invites**: Name-based invitations (migration 0009 - email verified by Registry OAuth)
- **takedowns**: DMCA/DSA takedown requests
- **access_log**: Score view/download audit trail

**Role types**: `'owner' | 'admin' | 'librarian'` (see [types.ts](../apps/vault/src/lib/types.ts))  
**License types**: `'public_domain' | 'licensed' | 'owned' | 'pending'`  
**Invite flow**: Invites use name (not email) - email comes from Registry OAuth on acceptance (migration 0009)

## Development Workflows

### Local Development

```bash
# Start dev server (Registry by default)
pnpm dev                    # Equivalent to: pnpm --filter registry dev

# Vault dev server
cd apps/vault && pnpm dev

# Run all tests (82 total as of Phase 0)
pnpm test                   # Vitest + acceptance tests

# Type checking
pnpm check                  # All packages
```

**Database migrations**:

```bash
cd apps/registry  # or apps/vault
wrangler d1 migrations apply DB --local   # Local development
wrangler d1 migrations apply DB           # Production
```

### Testing Strategy

**Current Status**: ⚠️ 22 tests failing (multi-role migration incomplete)

**Test Coverage** (100+ tests across packages):

- **Shared package** (20 tests): JWT, JWKS, token verification
  - ⚠️ 1 failing: signature validation edge case
- **Registry** (62 tests): OAuth flow, API endpoints, acceptance tests
  - ✅ All passing (Phase 0 complete)
- **Vault** (75+ tests): Members, permissions, storage, invites, takedowns
  - ⚠️ 21 failing: Mock DB `.all()` method for multi-role queries

**Test locations**:

- Unit: `*.spec.ts` alongside source files
- Acceptance: `src/tests/acceptance.spec.ts`
- E2E: `tests/e2e/*.spec.ts` (Playwright)

**Run modes**:

```bash
pnpm test              # All tests once (some failing)
pnpm run test:unit     # Watch mode (Vitest)
pnpm run test:e2e      # Playwright only
```

**Known Issues**:
- Vault member tests: Mock DB missing `.all()` implementation for `member_roles` junction table
- Shared verify test: Invalid signature not properly rejected (needs investigation)

## Terminology (see [GLOSSARY.md](../docs/GLOSSARY.md))

- **Vault**: Independent choir instance (self-contained D1 database)
- **Registry**: Central OAuth + discovery service (stateless, no user DB)
- **Handshake**: Bilateral trust establishment between two Vaults
- **Federation**: P2P network of Vaults connected via Handshakes
- **Private Circle**: Legal defense for sharing copyrighted works within trusted group

## Critical Files

### Shared Package

- [packages/shared/src/types/index.ts](../packages/shared/src/types/index.ts) - `AuthToken`, `RegisteredVault`, shared types
- [packages/shared/src/crypto/jwt.ts](../packages/shared/src/crypto/jwt.ts) - EdDSA signing/verification
- [packages/shared/src/auth/verify.ts](../packages/shared/src/auth/verify.ts) - Token verification library

### Registry

- [apps/registry/src/routes/auth/+server.ts](../apps/registry/src/routes/auth/+server.ts) - OAuth initiation
- [apps/registry/src/routes/auth/callback/+server.ts](../apps/registry/src/routes/auth/callback/+server.ts) - OAuth callback + JWT signing
- [apps/registry/src/routes/.well-known/jwks.json/+server.ts](../apps/registry/src/routes/.well-known/jwks.json/+server.ts) - Public key endpoint

### Vault

- [apps/vault/src/lib/server/db/members.ts](../apps/vault/src/lib/server/db/members.ts) - Member CRUD operations (multi-role aware)
- [apps/vault/src/lib/server/storage/d1-chunked-storage.ts](../apps/vault/src/lib/server/storage/d1-chunked-storage.ts) - Chunked BLOB storage
- [apps/vault/src/routes/members/+page.svelte](../apps/vault/src/routes/members/+page.svelte) - Member management UI (role toggles)

## Documentation Structure

- **README.md** - Project overview, motivation, feature matrix
- **docs/ARCHITECTURE.md** - Technical architecture, stack decisions, project structure
- **docs/DATABASE-SCHEMA.md** - Vault schema (ERD + table definitions)
- **docs/GLOSSARY.md** - Canonical terminology (use these terms consistently!)
- **docs/LEGAL-FRAMEWORK.md** - Private Circle defense, liability model, compliance
- **docs/CONCERNS.md** - Open questions (legal, federation, technical)
- **docs/PHASE0-COMPLETION-REPORT.md** - Phase 0 implementation summary (82 tests)

## Common Workflows

### Adding New Vault Route

1. Create `src/routes/<route>/+page.svelte` (UI)
2. Add `+page.server.ts` if server data needed (`load` function)
3. Add `+server.ts` for API endpoints (use `platform.env.DB`)
4. Write tests in `*.spec.ts` alongside route files
5. Update types in `src/lib/types.ts` if needed

### Adding Shared Type/Function

1. Add to `packages/shared/src/types/` or `src/crypto/`
2. Export from `packages/shared/src/index.ts`
3. Write tests in `*.spec.ts`
4. Import as `@polyphony/shared` in apps

### Database Schema Change

1. Create new migration `apps/<app>/migrations/XXXX_description.sql`
2. Apply locally: `wrangler d1 migrations apply DB --local`
3. Update TypeScript interfaces in `src/lib/server/db/*.ts`
4. Update `docs/DATABASE-SCHEMA.md` if major change
5. Test with existing data

## File Naming Conventions

- **SvelteKit routes**: `+page.svelte`, `+server.ts`, `+layout.svelte`, `+page.server.ts`
- **Test files**: `*.spec.ts` (Vitest), `*.e2e.spec.ts` (Playwright)
- **Types**: CamelCase interfaces, `types.ts` or `index.ts`
- **Database files**: lowercase with underscores (`members.ts`, `0001_initial.sql`)

## Legal Context (Important!)

**Private Circle Defense**: Polyphony relies on EU copyright exemption (Directive 2001/29/EC, Art. 5.2) for "private use within family circle or equivalent." Choirs = private circles, Handshakes = extended circles.

**Key rules**:

- Registry NEVER hosts copyrighted files (only PD links)
- Vaults are invite-only (no public access)
- Handshakes require explicit approval (bilateral trust)
- Vault owner is responsible for content legality

See [LEGAL-FRAMEWORK.md](../docs/LEGAL-FRAMEWORK.md) and [CONCERNS.md](../docs/CONCERNS.md) for open questions.

## Phase Status

**✅ Phase 0 Complete** (Epic #11): Registry OAuth + JWKS + token verification library. All 62 registry tests passing.

**🚧 Phase 1 In Progress**: Vault library + multi-role member management.

**Active Work**:
- Multi-role system (migration 0007-0009): Implementation complete, tests need mock DB fixes
- File upload/storage: D1 chunked storage working
- Copyright takedowns: UI + API complete
- Name-based invites: OAuth email verification flow implemented

See GitHub Issues for current work. Use Issue-Driven Development workflow (track features as epics, break into sub-issues, link PRs).

## Cloudflare Bindings

**Registry** (`apps/registry/wrangler.toml`):

- `DB` - D1 database (`polyphony-registry-db`)

**Vault** (`apps/vault/wrangler.toml`):

- `DB` - D1 database (`polyphony-vault-db`)
- Environment vars: `REGISTRY_OAUTH_URL`, `SESSION_SECRET` (wrangler secret)

Access via `platform.env` in server code. Undefined in dev unless using `wrangler pages dev` (use Vite dev server instead).

## PNPM Workspace Tips

```bash
pnpm -r <cmd>                # Run in all packages recursively
pnpm --filter registry dev   # Run only in registry app
pnpm --filter @polyphony/shared test  # Run in shared package
```

Dependencies between apps use `workspace:*` protocol (see [package.json](../apps/registry/package.json)).
