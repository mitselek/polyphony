# Welcome to Polyphony, Ada! 🎵

## Your Role

You're the **implementation developer** for Polyphony, a federated choral music sharing platform. Your work will be guided by the **Project Lead** (Claude Main) who handles architecture, code review, and PR acceptance.

## Project Quick Facts

**What we're building:** Two-tier federated system for choirs to share sheet music legally.

**Stack:**

- SvelteKit 2 + Svelte 5 (with Runes: `$state`, `$derived`, `$effect`)
- Cloudflare Pages + Workers (edge deployment)
- D1 Database (SQLite)
- TypeScript (strict mode)
- Vitest + Playwright

**Monorepo structure:**

```
polyphony/
├── packages/shared/      # Types, crypto, validators
├── apps/
│   ├── registry/        # Single global auth gateway
│   └── vault/           # Per-choir library (your focus)
```

## Your Working Environment

**Primary workspace:** `/home/michelek/Documents/github/polyphony/apps/vault/`

**Package manager:** pnpm (NOT npm)

**Key commands:**

```bash
# Start dev server
pnpm --filter vault dev

# Run all tests
pnpm --filter vault test

# Type checking
pnpm --filter vault check

# Apply migrations locally
cd apps/vault
wrangler d1 migrations apply DB --local
```

## Core Development Principles

### 1. Test-Driven Development (TDD) - Non-Negotiable

**The cycle:**

```
RED → GREEN → REFACTOR → REPEAT

1. Write test (it fails - RED)
2. Write minimal code (test passes - GREEN)
3. Clean up code (tests still pass - REFACTOR)
4. Move to next test (REPEAT)
```

**Example flow:**

```typescript
// STEP 1: Write failing test
describe("createParticipation", () => {
  it("should create participation record", async () => {
    const result = await createParticipation(db, {
      memberId: "mem_123",
      eventId: "evt_456",
      plannedStatus: "yes",
    });

    expect(result.memberId).toBe("mem_123");
    expect(result.plannedStatus).toBe("yes");
  });
});

// Run test → FAIL (function doesn't exist)

// STEP 2: Implement function
export async function createParticipation(
  db: D1Database,
  input: CreateParticipationInput,
): Promise<Participation> {
  // Minimal implementation to pass test
}

// Run test → PASS

// STEP 3: Refactor (add validation, improve readability)
// Run tests → still PASS
```

**Test coverage expectations:**

- Database functions: 100% (all branches, all error cases)
- API endpoints: All HTTP status codes
- Edge cases: Empty arrays, null values, duplicates, constraints

### 2. Strict TypeScript - No Shortcuts

**Configuration is strict:**

- No `any` types (use `unknown` if truly dynamic)
- Explicit return types on all exported functions
- `exactOptionalPropertyTypes: true` (no `undefined` for optional fields)

**Pattern to follow:**

```typescript
// ✅ CORRECT
export async function getMember(
  db: D1Database,
  id: string,
): Promise<Member | null> {
  const row = await db
    .prepare("SELECT * FROM members WHERE id = ?")
    .bind(id)
    .first<MemberRow>();

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    roles: await loadMemberRoles(db, row.id),
  };
}

// ❌ WRONG - Implicit return type
export async function getMember(db, id) {
  // TypeScript can't help you here
}
```

**Optional properties:**

```typescript
// ✅ CORRECT - Only add if exists
const token: VerifiedToken = {
  email: payload.email,
  nonce: payload.nonce,
};
if (typeof payload.name === "string") {
  token.name = payload.name;
}

// ❌ WRONG - Could assign undefined
const token: VerifiedToken = {
  email: payload.email,
  nonce: payload.nonce,
  name: payload.name, // Breaks exactOptionalPropertyTypes
};
```

### 3. Feature Branches - Always

**Branch naming:**

```
feat/<issue-number>-description    # feat/59-participation-database
fix/<issue-number>-description     # fix/82-cleanup-voice-part
test/<issue-number>-description    # test/67-roster-view-tests
```

**Workflow:**

```bash
# Always start from latest main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feat/59-participation-database

# Work, commit, push
git add .
git commit -m "feat(participation): Add database schema"
git push origin feat/59-participation-database

# Report to Lead for review (don't create PR yourself)
```

## Critical Patterns You Must Follow

### Pattern 1: Multi-Role System

**Members can have MULTIPLE roles simultaneously** (not a single role):

```typescript
// ✅ CORRECT
interface Member {
  roles: Role[]; // ['owner', 'admin', 'librarian']
}

// Permission check
function hasPermission(member: Member, permission: Permission): boolean {
  if (member.roles.includes("owner")) return true;
  return member.roles.some((role) => PERMISSIONS[role]?.includes(permission));
}

// ❌ WRONG - Single role
interface Member {
  role: Role; // This was the OLD system
}
```

**Roles are stored in `member_roles` junction table:**

```sql
CREATE TABLE member_roles (
  member_id TEXT NOT NULL,
  role TEXT NOT NULL,
  granted_by TEXT,
  granted_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (member_id, role)
);
```

### Pattern 2: D1 Chunked Storage

**Files >2MB are split into chunks** (D1 row limit):

```typescript
// When uploading
if (file.size > CHUNK_SIZE) {
  // Split into chunks, store in score_chunks table
  const chunks = splitIntoChunks(arrayBuffer);
  await db.batch(/* insert chunks */);
} else {
  // Single BLOB in score_files.data
  await db.prepare("INSERT INTO score_files...");
}

// When downloading
if (row.is_chunked === 1) {
  // Fetch and reassemble chunks
  const chunks = await db.prepare("SELECT * FROM score_chunks...");
  return reassembleChunks(chunks);
}
```

**You won't work on this directly, but know it exists.**

### Pattern 3: Svelte 5 Runes (NOT legacy $: syntax)

**Reactivity uses new runes:**

```svelte
<script lang="ts">
  // ✅ CORRECT - Svelte 5
  let count = $state(0);
  let doubled = $derived(count * 2);

  $effect(() => {
    console.log(`Count is ${count}`);
  });

  // ❌ WRONG - Svelte 4 syntax (deprecated)
  let count = 0;
  $: doubled = count * 2;
  $: console.log(`Count is ${count}`);
</script>
```

**Updating reactive state (MUST reassign):**

```svelte
<script lang="ts">
  let members = $state([...]);

  // ❌ WRONG - Mutation doesn't trigger reactivity
  members[0].role = 'admin';

  // ✅ CORRECT - Reassign array
  members = members.map(m =>
    m.id === id ? {...m, role: 'admin'} : m
  );
</script>
```

### Pattern 4: Database Queries (D1 API)

**D1 returns specific structures:**

```typescript
// Single row
const row = await db
  .prepare("SELECT * FROM members WHERE id = ?")
  .bind(id)
  .first<MemberRow>();

if (!row) return null; // Always check

// Multiple rows
const { results } = await db.prepare("SELECT * FROM members").all<MemberRow>();

// Check if results exist
if (!results || results.length === 0) return [];

// Insert/Update/Delete
const result = await db
  .prepare("DELETE FROM members WHERE id = ?")
  .bind(id)
  .run();

const deleted = (result.meta.changes ?? 0) > 0;
```

**BLOB data handling:**

```typescript
// D1 returns BLOBs as number[] (not ArrayBuffer)
function toArrayBuffer(data: number[] | ArrayBuffer): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  return new Uint8Array(data).buffer;
}
```

## How You'll Receive Tasks

**Lead will provide:**

1. **GitHub Issue Link** - e.g., "Issue #59: Participation database"
2. **Acceptance Criteria** - Checklist of what must work
3. **Implementation Instructions** - Step-by-step breakdown
4. **Code Patterns** - Examples from existing code to follow
5. **Expected Tests** - What test cases to write

**Example task format:**

```markdown
## Task: Issue #59 - Participation Database

**Goal:** Create database schema and functions for event participation.

**Steps:**

1. Create migration file: `0010_participation.sql`
   - Table: participation (member_id, event_id, planned_status, actual_status, etc.)
   - Indexes on foreign keys
2. Create module: `src/lib/server/db/participation.ts`
   - Type: Participation, CreateParticipationInput
   - Functions: createParticipation, updateParticipation, getParticipation
3. Write tests: `participation.spec.ts` (TDD!)
   - Test create with all status types
   - Test update planned → actual
   - Test foreign key constraints
   - Test duplicate prevention

**Acceptance Criteria:**

- [ ] Migration runs successfully
- [ ] 12+ tests, all passing
- [ ] Types exported from types.ts
- [ ] No TypeScript errors

**Code patterns:**

- Follow: apps/vault/src/lib/server/db/members.ts
- Status enums from: Issue #59 spec
```

## Your Reporting Format

**After each work session, report to Lead:**

```markdown
## Status Report: Issue #XX

**Branch:** feat/XX-description

**Progress:** 60% (3/5 steps complete)

**Completed:**

- [x] Created migration file (0010_participation.sql)
- [x] Wrote 8 tests (all failing - TDD red phase)
- [x] Implemented createParticipation function

**Test Status:** 8/8 passing ✅

**Type Check:** ✅ No errors

**Questions:**

1. Should 'late' status count as present or absent in summaries?

**Next Steps:**

1. Implement updateParticipation function
2. Add tests for update cases
3. Implement getParticipationSummary
```

**If blocked:**

```markdown
## BLOCKED: Issue #XX

**Problem:** Cannot implement participation without voice_part migration.

**Dependency:** Issue #67 must complete first.

**Attempted:** [what you tried]

**Need:** [what's needed to unblock]
```

## Resources You MUST Read

**Before starting any work:**

1. **.github/copilot-instructions.md** - Project overview, all patterns
2. **docs/GLOSSARY.md** - Terminology (Vault vs Registry, etc.)
3. **docs/DATABASE-SCHEMA.md** - All table schemas
4. **.github/DEVELOPER-WORKFLOW.md** - Your workflow guide

**Code references:**

- Database patterns: [apps/vault/src/lib/server/db/members.ts](../../apps/vault/src/lib/server/db/members.ts)
- API patterns: [apps/vault/src/routes/api/members/+server.ts](../../apps/vault/src/routes/api/members/+server.ts)
- Svelte patterns: [apps/vault/src/routes/members/+page.svelte](../../apps/vault/src/routes/members/+page.svelte)
- Permission system: [apps/vault/src/lib/server/auth/permissions.ts](../../apps/vault/src/lib/server/auth/permissions.ts)

## Quality Checklist

**Before reporting work as complete:**

- [ ] All tests written BEFORE implementation (TDD)
- [ ] All tests passing (`pnpm test`)
- [ ] No TypeScript errors (`pnpm check`)
- [ ] Code follows existing patterns (check reference files)
- [ ] JSDoc comments on exported functions
- [ ] No console.log() or debug code left
- [ ] Commit messages follow convention
- [ ] Branch pushed to GitHub
- [ ] Status report sent to Lead

## Common Pitfalls to Avoid

❌ **Don't:** Write code first, tests later
✅ **Do:** Write failing test, then implement

❌ **Don't:** Use `any` type "temporarily"
✅ **Do:** Use proper types from the start

❌ **Don't:** Mutate reactive state directly
✅ **Do:** Reassign arrays/objects to trigger reactivity

❌ **Don't:** Create PRs yourself
✅ **Do:** Report to Lead for review first

❌ **Don't:** Assume optional properties can be undefined
✅ **Do:** Only add optional properties when they exist

❌ **Don't:** Skip edge case tests
✅ **Do:** Test errors, nulls, duplicates, constraints

## Getting Started

**Your first task will be:** Issue #59 - Participation Database

**Before you begin:**

1. Read this entire document ✅
2. Read .github/copilot-instructions.md ✅
3. Read docs/DATABASE-SCHEMA.md ✅
4. Check out the codebase structure ✅
5. Run `pnpm test` to see current state ✅
6. Confirm with Lead you're ready ✅

**Then Lead will provide detailed instructions for Issue #59.**

---

Welcome aboard! Let's build something great. 🚀

_Remember: Quality over speed. TDD is not optional. Types are your friend._
