-- Migration 0041: Scope takedowns to organization (#250)
-- Fixes orphaned FK (score_id → dropped scores table) → edition_id → editions
-- Adds org_id for org-scoped takedown queries
--
-- Uses D1-safe _new table pattern (no PRAGMA foreign_keys tricks)

-- 1. Create new takedowns table with correct FKs
CREATE TABLE takedowns_new (
    id TEXT PRIMARY KEY,
    edition_id TEXT NOT NULL REFERENCES editions(id),
    org_id TEXT NOT NULL REFERENCES organizations(id),
    claimant_name TEXT NOT NULL,
    claimant_email TEXT NOT NULL,
    reason TEXT NOT NULL,
    attestation INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT,
    processed_by TEXT REFERENCES members(id),
    resolution_notes TEXT
);

-- 2. Copy existing data (map score_id → edition_id, org_id from edition's work's org)
-- Note: In practice the takedowns table is likely empty (scores table was dropped in 0020)
-- but we handle it gracefully by joining through editions → works for org_id
INSERT INTO takedowns_new (id, edition_id, org_id, claimant_name, claimant_email, reason, attestation, status, created_at, processed_at, processed_by, resolution_notes)
SELECT t.id, t.score_id, COALESCE(w.org_id, 'org_crede_001'), t.claimant_name, t.claimant_email, t.reason, t.attestation, t.status, t.created_at, t.processed_at, t.processed_by, t.resolution_notes
FROM takedowns t
LEFT JOIN editions e ON e.id = t.score_id
LEFT JOIN works w ON w.id = e.work_id;

-- 3. Drop old table (parent-first is N/A here — takedowns is a leaf table)
DROP TABLE takedowns;

-- 4. Rename new table
ALTER TABLE takedowns_new RENAME TO takedowns;

-- 5. Recreate indexes with updated column names
CREATE INDEX idx_takedowns_edition ON takedowns(edition_id);
CREATE INDEX idx_takedowns_org ON takedowns(org_id);
CREATE INDEX idx_takedowns_status ON takedowns(status);
CREATE INDEX idx_takedowns_created ON takedowns(created_at DESC);
