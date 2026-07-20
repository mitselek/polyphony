# Tallis Scratchpad

## Session started: 2026-03-19 / resumed 2026-03-26 / resumed 2026-04-01

[CHECKPOINT] 2026-04-01 — #303 RED phase complete.
  - Branch: `fix/cross-org-email-lookup`
  - File: `apps/vault/src/tests/lib/server/db/members-cross-org.spec.ts` (4 tests, 2 fail / 2 pass)
  - Handed off to josquin for GREEN phase.
  - Fix target: `getMemberByEmailId` (members.ts:260-271) needs JOIN member_organizations + WHERE mo.org_id = ?

[CHECKPOINT] 2026-03-26 — Session complete. Stories finished this session:
  - #286: JWT expiry tests (branch: fix/286-jwt-expiry-test) — 3 new tests, 26 passing
  - #287: return_to redirect guard tests (branch: fix/287-return-to-redirect-guard) — 11 new tests
  - #288: Middleware assertion fixes (branch: fix/288-middleware-assertions) — 2 no-op tests fixed
  - #290: Seasons API tests (branch: feat/290-seasons-api-tests) — 27 new tests
  All branches complete, awaiting PR/merge by team-lead.

[GOTCHA] 2026-03-19 — `apps/vault/src/lib/server/db/permissions.ts` is a DEAD FILE with old single-role logic (`canUploadScores(role: Role)` takes string, not Member). Conflicts with live `auth/permissions.ts` multi-role system. Issue #289 filed. Risk: confusion when someone reads it and thinks it's canonical.

[PATTERN] 2026-03-19 — Two mock patterns in use across vault tests:
  1. Hand-crafted `createMockDb()` — used in DB layer tests and middleware.spec.ts
  2. `vi.mock('$lib/server/auth/middleware')` + `vi.mock('$lib/server/db/...')` — used in route tests (editions.spec.ts, seasons.spec.ts pattern)
  Both are acceptable; route tests prefer full vi.mock for isolation.

[PATTERN] 2026-03-19 — Route test event structure (SvelteKit mock):
  - Mock `@sveltejs/kit`: `error` throws, `json` returns Response with status
  - `createMockEvent()` helper with url, params, platform.env.DB, cookies, locals.org.id
  - Mock middleware via vi.mock('$lib/server/auth/middleware')
  See seasons.spec.ts for canonical example.

[PATTERN] 2026-04-01 — Cross-org mock: when mocking member_organizations for multi-org tests,
  check `first` handler pattern order carefully — `getMemberById` SQL contains 'email_id' in SELECT
  clause, so 'WHERE m.id' check must come BEFORE 'email_id' check. See members-cross-org.spec.ts.

[GAP] 2026-03-19 — Remaining gaps in test-gaps.md (P1-P3 items still open):
  - auth/logout route tests (UNFILED)
  - voices/[id], voices/reorder, voices/reassign route tests (UNFILED)
  - sections/[id], sections/reorder, sections/reassign route tests (UNFILED)
  - works/[id] individual CRUD tests (UNFILED)
  - members/[id] removal route tests (UNFILED)
  - copies lifecycle route tests (UNFILED)
  - events/[id]/works sub-resources (UNFILED)
  - strings.ts utility tests (UNFILED)
  - E2E badge tests need unconditional fixtures (UNFILED)
