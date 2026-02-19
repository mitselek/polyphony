# Developer Workflow - Polyphony Project

## Team Structure

- **Project Lead**: Claude (Main) - Architecture, code review, PR acceptance
- **Developer**: Ada (Secondary instance) - Implementation, testing
- **Product Owner**: Michele - Final approval, priority decisions

## Development Workflow

### 1. Issue Assignment

**Lead responsibilities:**

- Review GitHub issue and acceptance criteria
- Break down into implementation steps if needed
- Create detailed task specification for Ada
- Identify dependencies and blockers
- **Add contextual guidance comment** before assignment

**Contextual guidance pattern:**

When assigning an issue, Lead adds a GitHub comment with:

- **Current state**: "Issues #X-Y are now merged to main"
- **Dependencies resolved**: "Database layer (#95) is complete and available"
- **Starting point**: "Begin with migration file, then tests"
- **Branch name**: "Create branch `feat/XX-description`"
- **How this fits**: "This updates invitation logic only. Auth updates are in #97"

**Why this matters:**

- Issue body = Complete specification (timeless)
- Assignment comment = Navigation aid (timely)
- Keeps Ada oriented in epic progress without re-reading all prior issues

**Example comment:**

```markdown
Ada, you're ready for #96 now that #94-#95 are merged.

## Context
Invitations need to link to roster members...

## Key Changes
1. Add `roster_member_id` to invites table
2. Update `createInvite()` to accept optional roster_member_id
...

## TDD Workflow
1. Create branch: `feat/96-invitation-roster-link`
2. Write tests first...
```

**Ada receives:**

- GitHub issue number and link
- Detailed implementation instructions
- Acceptance criteria checklist
- Code patterns to follow
- Expected test coverage
- **Contextual guidance comment** with current state

### 2. Feature Branch Creation

**Naming convention:**

```
feat/<issue-number>-short-description    # New features
fix/<issue-number>-short-description     # Bug fixes
refactor/<issue-number>-short-description # Code refactoring
```

**Examples:**

- `feat/59-participation-database`
- `fix/82-cleanup-voice-part`
- `refactor/70-roster-table-ui`

**Ada must:**

- Create branch from latest `main`
- Use exact naming convention
- Keep branch focused on single issue

### 2.5. Pre-Work Complexity Assessment

**MANDATORY:** Run `pnpm complexity <file>` before starting implementation.

**ESLint thresholds** (see Appendix for details):

- Cyclomatic complexity >10
- function >50 lines
- nesting >4 levels
- statements >15
- params >5

**Decision matrix:**

| File Size     | ESLint Warnings | Action                  |
| ------------- | --------------- | ----------------------- |
| <200 lines    | 0 warnings      | ✅ Proceed              |
| 200-400 lines | 1-3 warnings    | ⚠️ Review with lead     |
| >400 lines    | >3 warnings     | 🔴 Flag for refactoring |

**Ada reports:** `"Issue #X: <file> is Y lines, Z warnings. Recommend: [Proceed/Review/Refactor]"`

**Lead decides:** Refactor now / Proceed / Follow-up issue

### 3. Test-Driven Development (TDD)

**Required process:**

```
1. Write failing test(s) first
   ├─ Unit tests for functions/modules
   ├─ Integration tests for database operations
   └─ E2E tests for user workflows (when applicable)

2. Run tests → see them fail
   └─ Confirms tests are actually testing something

3. Implement minimal code to pass tests
   └─ No extra features, no premature optimization

4. Refactor while keeping tests green
   └─ Clean up, improve readability

5. Repeat for next piece of functionality
```

**Test location:**

- Unit tests: `*.spec.ts` alongside source files
- Integration tests: `src/tests/acceptance.spec.ts`
- E2E tests: `tests/e2e/*.spec.ts`

**Minimum coverage:**

- Database functions: 100% (all CRUD operations + edge cases)
- API endpoints: All status codes (200, 400, 404, etc.)
- Business logic: All branches and error paths

### 4. Strict TypeScript Standards

**Configuration:**

- `strict: true` in tsconfig.json
- `exactOptionalPropertyTypes: true`
- No `any` types (use `unknown` if needed)
- Explicit return types on exported functions

**Type patterns:**

```typescript
// ✅ GOOD - Explicit types, no assumptions
export async function createMember(
  db: D1Database,
  input: CreateMemberInput,
): Promise<Member> {
  // Implementation
}

// ❌ BAD - Implicit return type, loose input
export async function createMember(db, input) {
  // Implementation
}
```

**Optional properties:**

```typescript
// ✅ GOOD - Only add if exists
const result: VerifiedToken = {
  email: payload.email,
  nonce: payload.nonce,
};
if (typeof payload.name === "string") {
  result.name = payload.name;
}

// ❌ BAD - undefined violates exactOptionalPropertyTypes
const result: VerifiedToken = {
  email: payload.email,
  nonce: payload.nonce,
  name: payload.name, // Could be undefined
};
```

### 5. Implementation Checklist

**Before starting:**

- [ ] Read GitHub issue thoroughly
- [ ] Check dependencies are resolved
- [ ] Review related code/patterns
- [ ] Create feature branch

**During development:**

- [ ] Write test first (TDD)
- [ ] Implement minimal code to pass
- [ ] Run `pnpm check` (type checking)
- [ ] Run `pnpm test` (all tests pass)
- [ ] Refactor for clarity
- [ ] Add JSDoc comments for exported functions
- [ ] Update types in `src/lib/types.ts` if needed

**Before commit:**

- [ ] All tests pass (`pnpm test`)
- [ ] No TypeScript errors (`pnpm check`)
- [ ] Code follows existing patterns
- [ ] Removed console.logs and debug code
- [ ] Commit message follows convention (see below)

### 6. Commit Message Convention

**Format:**

```
<type>(<scope>): <subject>

<body>

Refs: #<issue-number>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `test`: Adding tests
- `refactor`: Code restructuring
- `docs`: Documentation only
- `chore`: Maintenance (deps, config)

**Examples:**

```
feat(participation): Add database schema and functions

- Create participation table with planned/actual status
- Implement createParticipation() and getParticipationSummary()
- Add 12 unit tests covering all CRUD operations
- Migration 0010_participation.sql

Refs: #59

---

test(roster): Add database layer tests

- Test getRosterView() with various filters
- Test date range filtering
- Test voice part aggregation
- 100% coverage achieved

Refs: #67
```

### 7. Code Review Process

**Ada submits:**

- Report to Lead with:
  - Branch name
  - Summary of changes
  - Test results (all passing)
  - Self-review notes
  - Questions/concerns

**Lead reviews:**

- Code quality and patterns
- Type safety compliance
- Test coverage adequacy
- Adherence to acceptance criteria

**Outcomes:**

- ✅ **Approved**: Ada merges directly to main (no PR needed)
- 🔄 **Changes requested**: Specific feedback, Ada revises and resubmits
- ❌ **Blocked**: Dependency or architectural issue

### 8. Shared Workspace Protocol

**CRITICAL**: Lead and Ada share the same git working directory.

**Rules:**

1. **Ada owns git operations**:
   - Ada runs: `git checkout -b`, `git commit`, `git push`
   - Ada has full gh CLI access
   - Ada creates PRs via: `gh pr create`

2. **Lead is read-only during implementation**:
   - Lead uses `read_file` for code review
   - Lead provides feedback via text/code snippets
   - Lead NEVER edits files while Ada is working

3. **Branch state is shared**:
   - If Ada switches branch, Lead sees same branch
   - If Ada edits file, Lead sees changes immediately
   - Sequential coordination required

4. **Review handoff**:
   - Ada announces: "Ready for review on feat/XX"
   - Lead reads files (already on same branch)
   - Lead provides feedback as text
   - Ada applies → commits → reports again

### 9. Merge to Main & Issue Closure

**When approved, Ada merges directly:**

- Merge feature branch to main
- Push to remote
- Clean up feature branch (local and remote)
- Post completion comment on GitHub issue
- Close issue with all checkboxes marked

**Pre-merge checklist:**

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Code reviewed and approved by Lead
- [ ] Follows code patterns
- [ ] Acceptance criteria met
- [ ] Documentation updated (if needed)
- [ ] Migration files included (if needed)

**Note:** PRs are optional and only needed for complex changes requiring discussion or multiple reviewers.

### 9.1 Issue Closure Protocol (MANDATORY)

**CRITICAL**: Issues must NOT be left in "finished but not closed" state. Every completed issue must be properly closed.

**Closure requirements:**

1. **Add completion comment** with:
   - Summary of what was implemented
   - List of files changed/created
   - Test count and status
   - Any notes for future reference

2. **Close the issue** via:
   - `gh issue close <number> --comment "All tasks completed."`
   - Or manually close in GitHub UI

3. **Check off ALL task boxes** in issue body:
   - Edit issue to mark `- [x]` for completed tasks
   - If a task was skipped, add note explaining why

**Completion comment template:**

```markdown
## ✅ Issue Complete

### Implementation Summary
[Brief description of what was built]

### Files Changed
- `path/to/file.ts` - [description]
- `path/to/file.spec.ts` - [X tests]

### Acceptance Criteria Verification
- ✅ [Criteria 1 - how it was met]
- ✅ [Criteria 2 - how it was met]

### Notes
[Any caveats, follow-up work, or decisions made]

**Closing as complete.**
```

**When to close:**

- ✅ All acceptance criteria met → Close immediately
- ⚠️ Partially complete → Keep open, comment on blockers
- 🔄 Superseded by another issue → Close with "Superseded by #XXX"
- ❌ Won't implement → Close with "wontfix" label and explanation

**Lead responsibility:**

Before session end, Lead must verify:

1. No "dangling" issues (implemented but not closed)
2. All merged work has corresponding closed issues
3. Epic issue has sub-issues checked off as completed

### 10. Communication Protocol

**Ada → Lead:**

- Announce: "Starting work on [file/feature]"
- Report: "Ready for review on feat/XX"
- Use structured format for updates
- Report blockers immediately
- Ask questions before making assumptions
- Share test failures with context

**Lead → Ada:**

- Acknowledge: "Confirmed - hands off [file]"
- Clear, actionable instructions
- Code examples when introducing patterns
- Feedback as text (never direct file edits)
- Timely review responses

**Update template for Ada:**

```markdown
## Status Update: Issue #XX

**Progress:** [% complete or milestone]

**Completed:**

- [x] Task 1
- [x] Task 2

**In Progress:**

- [ ] Task 3 (blocked on: reason)

**Tests:** X/Y passing

**Questions:**

1. Question about pattern/approach

**Next steps:**

1. Next action
```

## Quality Gates

**Cannot proceed without:**

1. ✅ All tests passing (unit + integration)
2. ✅ No TypeScript errors
3. ✅ TDD process followed (tests written first)
4. ✅ Code follows existing patterns
5. ✅ Acceptance criteria checked off

## Tools & Commands

**Ada must run before each update:**

```bash
# Type checking
pnpm check

# All tests
pnpm test

# Specific package tests
pnpm --filter vault test

# Dev server (for manual testing)
pnpm --filter vault dev
```

**Complexity assessment:**

```bash
pnpm complexity <file>  # Run before starting work (see Section 2.5)
```

**Database operations (Wrangler D1):**

```bash
# =============================================================================
# MIGRATIONS
# =============================================================================

# Apply pending migrations to local dev database
cd apps/vault && pnpm wrangler d1 migrations apply DB --local

# Apply pending migrations to production (Lead only)
cd apps/vault && pnpm wrangler d1 migrations apply DB --remote

# =============================================================================
# QUERYING DATABASES
# =============================================================================

# Query local database
pnpm wrangler d1 execute DB --local --command "SELECT * FROM members LIMIT 5;"

# Query remote database - use DATABASE NAME (not binding)
# Vault database:
cd apps/vault && pnpm wrangler d1 execute polyphony-vault-db --remote --command "SELECT COUNT(*) FROM members;"

# Registry database:
cd apps/registry && pnpm wrangler d1 execute polyphony-registry-db --remote --command "SELECT * FROM vaults;"

# Get results as JSON (for scripting)
pnpm wrangler d1 execute polyphony-vault-db --remote --command "..." --json

# =============================================================================
# EXPORT / IMPORT (Sync remote → local)
# =============================================================================

# Export production database to SQL file
cd apps/vault && pnpm wrangler d1 export polyphony-vault-db --remote --output=./prod-backup.sql

# Import to local (requires sqlite3 CLI)
rm -rf .wrangler/state/v3/d1
mkdir -p .wrangler/state/v3/d1/<database-uuid>
sqlite3 .wrangler/state/v3/d1/<database-uuid>/db.sqlite < prod-backup.sql

# =============================================================================
# KEY GOTCHA: DB vs database_name
# =============================================================================
# - "DB" is the BINDING name (works for --local only)
# - "polyphony-vault-db" is the DATABASE NAME (required for --remote)
# - Find database names in wrangler.toml under [[d1_databases]]
```

## Reference Documents

**Ada must read:**

- [.github/copilot-instructions.md](.github/copilot-instructions.md) - Project overview and patterns
- [docs/GLOSSARY.md](docs/GLOSSARY.md) - Terminology
- [docs/schema/README.md](docs/schema/README.md) - Schema reference (split into modules)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Technical architecture

**Key patterns:**

- Multi-role system: [lib/server/auth/permissions.ts](apps/vault/src/lib/server/auth/permissions.ts)
- Database operations: [lib/server/db/members.ts](apps/vault/src/lib/server/db/members.ts)
- Svelte 5 reactivity: [routes/members/+page.svelte](apps/vault/src/routes/members/+page.svelte)

---

## Session End Checklist

**Before ending a development session, Lead must verify:**

- [ ] All completed work is committed and pushed
- [ ] Every merged feature has its GitHub issue closed
- [ ] No "dangling" issues (implemented but not closed)
- [ ] Epic issues have sub-issues checked off
- [ ] Any blocking issues are documented with comments
- [ ] Tests pass: `pnpm test`
- [ ] No TypeScript errors: `pnpm check`

**Quick commands to audit:**

```bash
# List open issues assigned to you
gh issue list --assignee @me --state open

# Check for recently merged PRs without linked closed issues
gh pr list --state merged --limit 10

# Verify all tests pass
pnpm test
```

---

## Appendix: ESLint Complexity Rules

| Rule                    | Threshold | Measures                                  | Fix                                  |
| ----------------------- | --------- | ----------------------------------------- | ------------------------------------ |
| `complexity`            | Max 10    | Independent code paths (if/loops/switch)  | Extract helper functions             |
| `max-lines-per-function`| Max 50    | Lines of code in function body            | Split into smaller functions         |
| `max-depth`             | Max 4     | Nesting levels (nested if/for/while)      | Early returns, guard clauses         |
| `max-statements`        | Max 15    | Number of statements per function         | Extract related logic to helpers     |
| `max-params`            | Max 5     | Function parameters                       | Use object parameter pattern         |

**Common fixes:**

- Too many paths → Extract validation/business logic to helpers
- Long function → Split into query/fetch/transform steps
- Deep nesting → Use early returns: `if (!valid) return;`
- Many params → `function create(db: D1, input: CreateInput)`

---

_This workflow ensures code quality, maintainability, and alignment with project standards._
