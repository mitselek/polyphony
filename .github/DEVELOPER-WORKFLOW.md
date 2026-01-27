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

**Ada receives:**

- GitHub issue number and link
- Detailed implementation instructions
- Acceptance criteria checklist
- Code patterns to follow
- Expected test coverage

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

**MANDATORY: Before writing any code, evaluate existing complexity**  

**Purpose:** Prevent technical debt accumulation by identifying refactoring needs while context is fresh.

**Process:**

1. **Identify affected files** (from issue description or lead's guidance)

2. **Check file metrics:**

   ```bash
   # Automated complexity assessment (recommended)
   .github/scripts/check-complexity.sh <file1> [file2]
   
   # Manual check
   wc -l apps/vault/src/lib/server/db/*.ts
   ```

3. **Assess complexity indicators:**
   - Functions >100 lines
   - Multiple nested loops/conditions (>3 levels deep)
   - Many database queries in one function (>5 queries)
   - Duplicated code patterns (similar logic in 3+ places)
   - File mixing multiple concerns

4. **Decision matrix:**

   | File Size     | Complexity | Action                                                                                     |
   | ------------- | ---------- | ------------------------------------------------------------------------------------------ |
   | <200 lines    | Simple     | ✅ **Proceed** with implementation                                                         |
   | 200-400 lines | Medium     | ⚠️ **Review** - Ask lead: "File X is Y lines with Z complexity. Should we refactor first?" |
   | >400 lines    | High       | 🔴 **Flag** - "File X needs refactoring. Should I do it now or create follow-up issue?"    |

5. **Refactoring triggers** (any one = discuss with lead):
   - Adding feature to file >400 lines
   - Modifying function >100 lines
   - File has >3 similar patterns (extraction candidate)
   - Complexity will increase with new feature

**Ada reports to lead:**

```
"Issue #X affects <file>:
- Current size: Y lines
- Main function: Z lines
- Complexity: [Simple/Medium/High]
- Recommendation: [Proceed/Refactor first/Follow-up issue]"
```

**Lead decides:**

- **Refactor now**: Do it in same branch/PR (most common for high complexity)
- **Proceed**: Current complexity acceptable
- **Create follow-up issue**: Refactor not blocking, can be done later

**Benefits:**

- ✅ Never accumulate technical debt
- ✅ Fresh context makes refactoring efficient (as seen in Issue #67: 15 minutes saved hours)
- ✅ New features built on clean code
- ✅ Easier code reviews and maintenance

**Example (Issue #67):**

```
Ada: "Issue #67 will create roster.ts with getRosterView().
      Estimated implementation: 200-250 lines (complex JOIN logic).
      Should I plan for refactoring?"

Lead: "Yes - implement first, then extract helper functions.
       Target: 4 functions of 40-60 lines each."

Result: 247 lines → 83 lines (main function), 15 min refactoring
```

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

### 9. Merge to Main

**When approved, Ada merges directly:**

- Merge feature branch to main
- Push to remote
- Clean up feature branch (local and remote)
- Post completion comment on GitHub issue
- Close issue

**Pre-merge checklist:**

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Code reviewed and approved by Lead
- [ ] Follows code patterns
- [ ] Acceptance criteria met
- [ ] Documentation updated (if needed)
- [ ] Migration files included (if needed)

**Note:** PRs are optional and only needed for complex changes requiring discussion or multiple reviewers.

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

**Database migrations:**

```bash
# Local dev
wrangler d1 migrations apply DB --local

# Production (Lead only)
wrangler d1 migrations apply DB
```

## Reference Documents

**Ada must read:**

- [.github/copilot-instructions.md](.github/copilot-instructions.md) - Project overview and patterns
- [docs/GLOSSARY.md](docs/GLOSSARY.md) - Terminology
- [docs/DATABASE-SCHEMA.md](docs/DATABASE-SCHEMA.md) - Schema reference
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Technical architecture

**Key patterns:**

- Multi-role system: [lib/server/auth/permissions.ts](apps/vault/src/lib/server/auth/permissions.ts)
- Database operations: [lib/server/db/members.ts](apps/vault/src/lib/server/db/members.ts)
- Svelte 5 reactivity: [routes/members/+page.svelte](apps/vault/src/routes/members/+page.svelte)

---

_This workflow ensures code quality, maintainability, and alignment with project standards._
