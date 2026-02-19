# Polyphony Dev — Common Standards

## Team

- **Team name:** `polyphony-dev`
- **Members:** team-lead, sven (frontend), dag (database/API), tess (testing), lingo (i18n), arvo (reviewer), polly (product owner), finn (research)

## Project

Polyphony — a choral music sharing platform. Two-tier architecture:
- **Registry**: Zero-storage auth gateway (OAuth, magic link, SSO cookies, JWKS)
- **Vault**: Single deployment hosting ALL organizations (members, works, editions, events, participation)

## Key References

- `CLAUDE.md` — project overview, architecture, commands, conventions
- `docs/ARCHITECTURE.md` — technical architecture
- `docs/DATABASE-SCHEMA.md` — D1 schema (26 tables, 42+ migrations)
- `docs/GLOSSARY.md` — canonical terminology
- GitHub Issues — check open issues for task context

## Communication Rule

Every message you send via SendMessage must be prepended with the current timestamp in `[YYYY-MM-DD HH:MM]` format. Get the current time by running: `date '+%Y-%m-%d %H:%M'` before sending any message.

## Stack

| Component       | Technology                 | Notes                                                     |
| --------------- | -------------------------- | --------------------------------------------------------- |
| Framework       | SvelteKit 2 + Svelte 5     | Use Runes ($state, $derived, $effect) NOT legacy $ syntax |
| Platform        | Cloudflare Pages + Workers | Edge deployment                                           |
| Database        | Cloudflare D1 (SQLite)     | Per-deployment, local dev with wrangler                   |
| File Storage    | D1 BLOBs (chunked)         | NO R2 — files in edition_files/edition_chunks tables      |
| Auth            | EdDSA (Ed25519) JWTs       | Registry signs, Vaults verify via JWKS                    |
| i18n            | Paraglide                  | 4 locales: en, et, lv, uk                                 |
| Testing         | Vitest + Playwright        | Unit + E2E                                                |
| Package Manager | pnpm (workspaces)          | ALWAYS use pnpm, never npm                                |
| CSS             | Tailwind CSS v4            | Full class names only — no dynamic template literals      |

## Quality Gates

Before any PR:
- `pnpm check` — 0 type errors
- `pnpm test` — all tests pass
- Arvo code review (RED/YELLOW/GREEN)

## TDD Workflow

1. **Issue** — Polly files GitHub issue with acceptance criteria
2. **Branch** — Create from main: `fix/<issue>-short-description` or `feat/<issue>-short-description`
3. **Red phase** — Tess writes failing tests
4. **Green phase** — Sven/Dag implement until tests pass
5. **Review** — Arvo does RED/YELLOW/GREEN code review
6. **Merge** — Dag creates PR, squash-merges to main, issue auto-closes

## D1 Critical Behaviors

- **`PRAGMA foreign_keys = OFF` is a NO-OP on D1** — CASCADE always fires on DROP TABLE
- **`PRAGMA defer_foreign_keys = ON` also does NOT prevent CASCADE**
- **D1-safe table rebuild pattern**: Create `_new` tables, copy data, drop old tables **parent-first**, rename `_new` tables
- **Multi-parent junction tables**: If a junction table (e.g., `event_works`) references two parents, explicitly drop it between parent drops — D1 CASCADE checks ALL FKs in the DDL
- **Complex migrations may fail as batches on remote** — split into manual steps via `wrangler d1 execute --remote`
- **Always backup before remote migrations**: `pnpm exec wrangler d1 export DB --remote --output=/tmp/vault-backup-$(date +%Y-%m-%d).sql`

## Svelte 5 Rules

- Runes ONLY: `$props()`, `$state()`, `$derived()`, `$effect()`, `$bindable()`
- NEVER legacy `export let` or `$:` syntax
- REASSIGN arrays/objects to trigger reactivity (mutation doesn't work with runes)
- Server-only code MUST be in `src/lib/server/` — never import server modules in client
- Sticky + overflow: NEVER put `overflow` on ancestors of `position: sticky` elements

## Research Support

When you need information gathered (GitHub issues, codebase lookups, schema references, dependency checks), message **finn**. He will collect the data and send you a markdown report. Use Finn before burning your own tokens on exploration.

## On Startup

Send a brief intro message to `team-lead` saying you're ready and asking for your first assignment.
