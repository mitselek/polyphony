# Copilot Instructions: Polyphony

Choral music sharing platform. Two-tier system: Registry (zero-storage auth) + Vault (single deployment, all orgs). SvelteKit 2 + Svelte 5 (Runes), Cloudflare Pages/Workers, D1 (SQLite), pnpm workspaces.

## Big picture architecture
- Monorepo: `apps/registry`, `apps/vault`, `packages/shared` (imported as `@polyphony/shared`).
- **Registry** = zero-storage auth + discovery. Stores only signing keys and email auth codes. Queries Vault public APIs (`/api/public/*`) for org directory and PD catalog. Must **never** store org/user/score data.
- **Vault** = single deployment hosting **all** organizations. Subdomains (`crede.polyphony.uk`, `kamari.polyphony.uk`) route to the same app. All org/member/score data lives here.
- Auth flow: Vault → Registry OAuth → Google → Registry signs EdDSA JWT → Vault verifies via JWKS (`/.well-known/jwks.json`). Token TTL: 5 min + nonce.

## Stack + boundaries
- Server-only code in `src/lib/server/`; access D1 via `platform.env.DB` in `+server.ts` / `+page.server.ts`.
- Vault server structure: `auth/` (middleware, permissions), `db/` (one file per entity + `queries/` helpers), `storage/` (chunked BLOBs), `email/`, `i18n/`, `validation/`.
- Vault API routes authenticate via `getAuthenticatedMember(db, cookies)` from `$lib/server/auth/middleware`, then check permissions with `hasPermission()` / `requireRole()` from `$lib/server/auth/permissions.ts`.
- Types: shared auth types in `packages/shared/src/types/index.ts`; vault domain types in `apps/vault/src/lib/types.ts` (canonical `Member`, `Role`, `Organization`, `Edition`, etc.).

## Project-specific patterns

### Svelte 5 Runes (not legacy `$:` syntax)
- Use `$state`, `$derived`, `$effect`; REASSIGN arrays/objects to trigger reactivity (no mutation).
- Server data sync: `let { data } = $props(); let local = $state(untrack(() => data.value)); $effect(() => { local = data.value; });`

### Multi-role members
- `roles` is an array from junction table `member_roles`. Permissions are union of all roles; `owner` has all.
- Permission matrix: `apps/vault/src/lib/server/auth/permissions.ts`. All authenticated members get implicit `scores:view` + `scores:download`.
- Roles: `owner | admin | librarian | conductor | section_leader`.

### Chunked D1 BLOB storage
- PDFs in D1 (no R2). `edition_files` + `edition_chunks`, chunk size ~1.9MB, max ~9.5MB.
- Implementation: `apps/vault/src/lib/server/storage/edition-storage.ts`.

### i18n (Vault only)
- Paraglide JS v2. Messages in `apps/vault/messages/{en,et,lv,uk}.json`. Compiled to `src/lib/paraglide/`.
- Import as `import * as m from '$lib/paraglide/messages.js'`; use `m.nav_members()`, `m.actions_save()`, etc.
- Server-side preference cascade: member → organization → system defaults (`en`, `en-US`, `UTC`). See `src/lib/server/i18n/preferences.ts`.
- Components in `$lib/components/` still have hardcoded English; migrate to `m.*()` calls when touching them.

### Toast notifications
- Store-based (not runes): `import { toast } from '$lib/stores/toast'`; `toast.success(msg)`, `toast.error(msg)`.

## Workflows
```bash
pnpm dev                              # Registry dev server
cd apps/vault && pnpm dev             # Vault dev server
pnpm test                             # All tests (shared: 20, registry: 116, vault: 961)
pnpm check                            # Typecheck all packages (vault runs paraglide first)
pnpm validate                         # check + test
cd apps/vault && pnpm test:e2e        # Playwright E2E
wrangler d1 migrations apply DB --local  # D1 migrations (run from app dir)
```

## Database
- **Registry tables**: `signing_keys`, `email_auth_codes`, `email_rate_limits` — auth only.
- **Vault tables** (25 tables, Schema V2): `organizations`, `members`, `member_roles`, `member_organizations`, `affiliations`, `voices`, `sections`, `member_voices`, `member_sections`, `works`, `editions`, `edition_files`, `edition_chunks`, `physical_copies`, `copy_assignments`, `seasons`, `season_works`, `season_work_editions`, `events`, `event_works`, `event_work_editions`, `participation`, `invites`, `invite_voices`, `invite_sections`, `sessions`, `takedowns`, `vault_settings`.
- Schema details: `docs/DATABASE-SCHEMA.md`. Migrations in `apps/<app>/migrations/`.

## Key references
- Terminology: `docs/GLOSSARY.md` — use "Vault" and "Registry" consistently.
- Architecture: `docs/ARCHITECTURE.md`
- Permissions: `apps/vault/src/lib/server/auth/permissions.ts`
- Domain types: `apps/vault/src/lib/types.ts`
- Auth crypto: `packages/shared/src/crypto/jwt.ts`, `packages/shared/src/auth/verify.ts`

## Adding code — checklists

**New Vault API route**: create `+server.ts` → get DB from `platform.env.DB` → authenticate with `getAuthenticatedMember()` → check permissions → return `json()`. Co-locate `*.spec.ts` tests.

**New Vault page**: `+page.svelte` + `+page.server.ts` for data loading. Use paraglide `m.*()` for user-facing strings.

**Schema change**: new migration SQL → `wrangler d1 migrations apply DB --local` → update TypeScript types in `src/lib/server/db/*.ts` and `src/lib/types.ts` → update `docs/DATABASE-SCHEMA.md`.

**Shared package**: add to `packages/shared/src/` → export from `src/index.ts` → import as `@polyphony/shared`.
