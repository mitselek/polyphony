# Task: Issue #59 - Participation Database

**Assigned to:** Ada  
**Lead:** Claude (Main)  
**GitHub Issue:** https://github.com/mitselek/polyphony/issues/59  
**Branch:** `feat/59-participation-database`  
**Dependencies:** None (this unblocks #67, #68, #70)

---

## Overview

Create the database schema and functions for tracking member participation in events. This is the foundation for the roster view feature.

**Two-status system:**

- **Planned Status**: What members RSVP (yes/no/maybe/late)
- **Actual Status**: What actually happened (present/absent/late) - recorded by conductor

---

## Step 1: Create Migration File

**File:** `apps/vault/migrations/0010_participation.sql`

**Schema to create:**

```sql
-- Participation tracking for events
CREATE TABLE IF NOT EXISTS participation (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  event_id TEXT NOT NULL,

  -- RSVP status (member sets this)
  planned_status TEXT CHECK(planned_status IN ('yes', 'no', 'maybe', 'late')),
  planned_at TEXT,
  planned_notes TEXT,

  -- Actual attendance (conductor records this)
  actual_status TEXT CHECK(actual_status IN ('present', 'absent', 'late')),
  recorded_at TEXT,
  recorded_by TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES members(id),

  UNIQUE(member_id, event_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_participation_member ON participation(member_id);
CREATE INDEX IF NOT EXISTS idx_participation_event ON participation(event_id);
CREATE INDEX IF NOT EXISTS idx_participation_planned ON participation(planned_status);
CREATE INDEX IF NOT EXISTS idx_participation_actual ON participation(actual_status);
```

**Test the migration:**

```bash
cd apps/vault
wrangler d1 migrations apply DB --local
```

---

## Step 2: Create Types

**File:** `apps/vault/src/lib/types.ts`

**Add these types at the end of the file:**

```typescript
// ============================================================================
// PARTICIPATION SYSTEM
// ============================================================================

export type PlannedStatus = "yes" | "no" | "maybe" | "late";
export type ActualStatus = "present" | "absent" | "late";

/**
 * Participation record for an event
 */
export interface Participation {
  id: string;
  memberId: string;
  eventId: string;

  // RSVP (member sets)
  plannedStatus: PlannedStatus | null;
  plannedAt: string | null;
  plannedNotes: string | null;

  // Actual attendance (conductor records)
  actualStatus: ActualStatus | null;
  recordedAt: string | null;
  recordedBy: string | null;

  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating participation record
 */
export interface CreateParticipationInput {
  memberId: string;
  eventId: string;
  plannedStatus?: PlannedStatus;
  plannedNotes?: string;
}

/**
 * Input for updating participation (RSVP or recording attendance)
 */
export interface UpdateParticipationInput {
  plannedStatus?: PlannedStatus;
  plannedNotes?: string;
  actualStatus?: ActualStatus;
  recordedBy?: string;
}

/**
 * Summary statistics for an event
 */
export interface ParticipationSummary {
  eventId: string;
  totalMembers: number;

  // Planned counts
  plannedYes: number;
  plannedNo: number;
  plannedMaybe: number;
  plannedLate: number;
  noResponse: number;

  // Actual counts (if event is past)
  actualPresent: number;
  actualAbsent: number;
  actualLate: number;
  notRecorded: number;
}
```

---

## Step 3: Write Tests FIRST (TDD Red Phase)

**File:** `apps/vault/src/lib/server/db/participation.spec.ts`

**Start with these tests (they will fail - that's expected!):**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import {
  createParticipation,
  getParticipation,
  updateParticipation,
  getEventParticipation,
  getParticipationSummary,
  deleteParticipation,
} from "./participation";
import type {
  CreateParticipationInput,
  UpdateParticipationInput,
} from "$lib/types";

// Mock D1 database
const mockDb = {
  prepare: () => ({
    bind: () => ({
      run: () => Promise.resolve({ success: true, meta: { changes: 1 } }),
      first: () => Promise.resolve(null),
      all: () => Promise.resolve({ results: [] }),
    }),
  }),
  batch: () => Promise.resolve([]),
} as unknown as D1Database;

describe("Participation Database Functions", () => {
  describe("createParticipation", () => {
    it("should create participation with planned status", async () => {
      const input: CreateParticipationInput = {
        memberId: "mem_123",
        eventId: "evt_456",
        plannedStatus: "yes",
      };

      const result = await createParticipation(mockDb, input);

      expect(result.memberId).toBe("mem_123");
      expect(result.eventId).toBe("evt_456");
      expect(result.plannedStatus).toBe("yes");
      expect(result.actualStatus).toBeNull();
    });

    it("should create participation without planned status", async () => {
      const input: CreateParticipationInput = {
        memberId: "mem_123",
        eventId: "evt_456",
      };

      const result = await createParticipation(mockDb, input);

      expect(result.plannedStatus).toBeNull();
    });

    it("should throw on duplicate member+event", async () => {
      const input: CreateParticipationInput = {
        memberId: "mem_123",
        eventId: "evt_456",
        plannedStatus: "yes",
      };

      await createParticipation(mockDb, input);

      await expect(createParticipation(mockDb, input)).rejects.toThrow(
        "UNIQUE constraint",
      );
    });
  });

  describe("getParticipation", () => {
    it("should return participation by member and event", async () => {
      const participation = await getParticipation(
        mockDb,
        "mem_123",
        "evt_456",
      );

      expect(participation).toBeDefined();
      expect(participation?.memberId).toBe("mem_123");
    });

    it("should return null if not found", async () => {
      const participation = await getParticipation(
        mockDb,
        "invalid",
        "invalid",
      );

      expect(participation).toBeNull();
    });
  });

  describe("updateParticipation", () => {
    it("should update planned status", async () => {
      // Create first
      await createParticipation(mockDb, {
        memberId: "mem_123",
        eventId: "evt_456",
        plannedStatus: "maybe",
      });

      // Update
      const updated = await updateParticipation(mockDb, "mem_123", "evt_456", {
        plannedStatus: "yes",
      });

      expect(updated?.plannedStatus).toBe("yes");
    });

    it("should record actual attendance", async () => {
      const updated = await updateParticipation(mockDb, "mem_123", "evt_456", {
        actualStatus: "present",
        recordedBy: "mem_conductor",
      });

      expect(updated?.actualStatus).toBe("present");
      expect(updated?.recordedBy).toBe("mem_conductor");
    });

    it("should return null if participation does not exist", async () => {
      const updated = await updateParticipation(mockDb, "invalid", "invalid", {
        plannedStatus: "yes",
      });

      expect(updated).toBeNull();
    });
  });

  describe("getEventParticipation", () => {
    it("should return all participation for an event", async () => {
      const participation = await getEventParticipation(mockDb, "evt_456");

      expect(Array.isArray(participation)).toBe(true);
    });

    it("should return empty array if no participation", async () => {
      const participation = await getEventParticipation(mockDb, "evt_empty");

      expect(participation).toEqual([]);
    });
  });

  describe("getParticipationSummary", () => {
    it("should calculate summary statistics", async () => {
      const summary = await getParticipationSummary(mockDb, "evt_456");

      expect(summary.eventId).toBe("evt_456");
      expect(summary.totalMembers).toBeGreaterThanOrEqual(0);
      expect(summary.plannedYes).toBeGreaterThanOrEqual(0);
    });

    it("should handle event with no participation", async () => {
      const summary = await getParticipationSummary(mockDb, "evt_empty");

      expect(summary.totalMembers).toBe(0);
      expect(summary.plannedYes).toBe(0);
      expect(summary.noResponse).toBe(0);
    });
  });

  describe("deleteParticipation", () => {
    it("should delete participation record", async () => {
      await createParticipation(mockDb, {
        memberId: "mem_123",
        eventId: "evt_456",
      });

      const deleted = await deleteParticipation(mockDb, "mem_123", "evt_456");

      expect(deleted).toBe(true);
    });

    it("should return false if not found", async () => {
      const deleted = await deleteParticipation(mockDb, "invalid", "invalid");

      expect(deleted).toBe(false);
    });
  });
});
```

**Run tests (they should all FAIL):**

```bash
pnpm --filter vault test participation
```

---

## Step 4: Implement Functions (TDD Green Phase)

**File:** `apps/vault/src/lib/server/db/participation.ts`

**Create this file with all functions:**

```typescript
// Participation database operations
import type {
  Participation,
  ParticipationSummary,
  CreateParticipationInput,
  UpdateParticipationInput,
} from "$lib/types";

// Simple ID generator
function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 21);
}

/**
 * Create a new participation record
 */
export async function createParticipation(
  db: D1Database,
  input: CreateParticipationInput,
): Promise<Participation> {
  const id = generateId();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO participation (
        id, member_id, event_id, planned_status, planned_at, planned_notes
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.memberId,
      input.eventId,
      input.plannedStatus ?? null,
      input.plannedStatus ? now : null,
      input.plannedNotes ?? null,
    )
    .run();

  const participation = await getParticipation(
    db,
    input.memberId,
    input.eventId,
  );
  if (!participation) {
    throw new Error("Failed to create participation");
  }

  return participation;
}

/**
 * Get participation by member and event
 */
export async function getParticipation(
  db: D1Database,
  memberId: string,
  eventId: string,
): Promise<Participation | null> {
  const row = await db
    .prepare(
      `SELECT * FROM participation 
       WHERE member_id = ? AND event_id = ?`,
    )
    .bind(memberId, eventId)
    .first<Record<string, unknown>>();

  if (!row) return null;

  return mapRowToParticipation(row);
}

/**
 * Update participation (RSVP or record attendance)
 */
export async function updateParticipation(
  db: D1Database,
  memberId: string,
  eventId: string,
  input: UpdateParticipationInput,
): Promise<Participation | null> {
  const now = new Date().toISOString();
  const updates: string[] = ["updated_at = ?"];
  const bindings: unknown[] = [now];

  // Update planned status
  if (input.plannedStatus !== undefined) {
    updates.push("planned_status = ?", "planned_at = ?");
    bindings.push(input.plannedStatus, now);
  }

  if (input.plannedNotes !== undefined) {
    updates.push("planned_notes = ?");
    bindings.push(input.plannedNotes);
  }

  // Update actual status
  if (input.actualStatus !== undefined) {
    updates.push("actual_status = ?", "recorded_at = ?");
    bindings.push(input.actualStatus, now);
  }

  if (input.recordedBy !== undefined) {
    updates.push("recorded_by = ?");
    bindings.push(input.recordedBy);
  }

  bindings.push(memberId, eventId);

  const result = await db
    .prepare(
      `UPDATE participation 
       SET ${updates.join(", ")}
       WHERE member_id = ? AND event_id = ?`,
    )
    .bind(...bindings)
    .run();

  if ((result.meta.changes ?? 0) === 0) {
    return null;
  }

  return getParticipation(db, memberId, eventId);
}

/**
 * Get all participation for an event
 */
export async function getEventParticipation(
  db: D1Database,
  eventId: string,
): Promise<Participation[]> {
  const { results } = await db
    .prepare("SELECT * FROM participation WHERE event_id = ?")
    .bind(eventId)
    .all<Record<string, unknown>>();

  if (!results || results.length === 0) return [];

  return results.map(mapRowToParticipation);
}

/**
 * Get participation summary statistics for an event
 */
export async function getParticipationSummary(
  db: D1Database,
  eventId: string,
): Promise<ParticipationSummary> {
  // Get total active members
  const totalResult = await db
    .prepare("SELECT COUNT(*) as count FROM members")
    .first<{ count: number }>();

  const totalMembers = totalResult?.count ?? 0;

  // Get participation counts
  const { results } = await db
    .prepare(
      "SELECT planned_status, actual_status FROM participation WHERE event_id = ?",
    )
    .bind(eventId)
    .all<{ planned_status: string | null; actual_status: string | null }>();

  const participation = results ?? [];

  // Count planned statuses
  const plannedYes = participation.filter(
    (p) => p.planned_status === "yes",
  ).length;
  const plannedNo = participation.filter(
    (p) => p.planned_status === "no",
  ).length;
  const plannedMaybe = participation.filter(
    (p) => p.planned_status === "maybe",
  ).length;
  const plannedLate = participation.filter(
    (p) => p.planned_status === "late",
  ).length;
  const noResponse = totalMembers - participation.length;

  // Count actual statuses
  const actualPresent = participation.filter(
    (p) => p.actual_status === "present",
  ).length;
  const actualAbsent = participation.filter(
    (p) => p.actual_status === "absent",
  ).length;
  const actualLate = participation.filter(
    (p) => p.actual_status === "late",
  ).length;
  const notRecorded = participation.filter((p) => !p.actual_status).length;

  return {
    eventId,
    totalMembers,
    plannedYes,
    plannedNo,
    plannedMaybe,
    plannedLate,
    noResponse,
    actualPresent,
    actualAbsent,
    actualLate,
    notRecorded,
  };
}

/**
 * Delete participation record
 */
export async function deleteParticipation(
  db: D1Database,
  memberId: string,
  eventId: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM participation WHERE member_id = ? AND event_id = ?")
    .bind(memberId, eventId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

/**
 * Helper to map database row to Participation type
 */
function mapRowToParticipation(row: Record<string, unknown>): Participation {
  return {
    id: row.id as string,
    memberId: row.member_id as string,
    eventId: row.event_id as string,
    plannedStatus: (row.planned_status as string | null) ?? null,
    plannedAt: (row.planned_at as string | null) ?? null,
    plannedNotes: (row.planned_notes as string | null) ?? null,
    actualStatus: (row.actual_status as string | null) ?? null,
    recordedAt: (row.recorded_at as string | null) ?? null,
    recordedBy: (row.recorded_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
```

**Run tests again (they should PASS now):**

```bash
pnpm --filter vault test participation
```

---

## Step 5: Type Check & Final Validation

```bash
# Type checking
pnpm --filter vault check

# All tests
pnpm --filter vault test

# Should see no errors!
```

---

## Acceptance Criteria

- [ ] Migration file created (0010_participation.sql)
- [ ] Migration runs successfully locally
- [ ] Types added to lib/types.ts
- [ ] All 6 functions implemented in participation.ts
- [ ] 14+ tests written (TDD - tests first!)
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] JSDoc comments on exported functions
- [ ] Code follows patterns from members.ts

---

## Submission Format

When complete, report back with:

```markdown
## Status Report: Issue #59

**Branch:** feat/59-participation-database

**Completed:**

- [x] Migration file created
- [x] Types defined
- [x] 14 tests written (TDD)
- [x] All functions implemented

**Test Results:**
✅ 14/14 tests passing

**Type Check:**
✅ No errors

**Migration Test:**
✅ Applied successfully to local DB

**Files Changed:**

- migrations/0010_participation.sql (NEW)
- src/lib/types.ts (added Participation types)
- src/lib/server/db/participation.ts (NEW)
- src/lib/server/db/participation.spec.ts (NEW)

**Ready for review!**
```

---

## Reference Files

**Pattern examples to follow:**

- Database CRUD: `apps/vault/src/lib/server/db/members.ts`
- Type definitions: `apps/vault/src/lib/types.ts`
- Test structure: `apps/vault/src/lib/server/db/members.spec.ts`

**Read before starting:**

- `.github/ONBOARDING-ADA.md` - Your guide
- `.github/copilot-instructions.md` - Project patterns

---

Good luck! Follow TDD strictly - tests first, then implementation. Report back when ready for review.
