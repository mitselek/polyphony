-- Migration: Copy Assignments table
-- Issue #116 - Track who has which physical copy
-- Part of Epic #106 - Phase B: Physical Inventory

CREATE TABLE IF NOT EXISTS copy_assignments (
    id TEXT PRIMARY KEY,
    copy_id TEXT NOT NULL REFERENCES physical_copies(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    assigned_by TEXT REFERENCES members(id) ON DELETE SET NULL,
    returned_at TEXT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for looking up assignments by copy
CREATE INDEX IF NOT EXISTS idx_copy_assignments_copy_id ON copy_assignments(copy_id);

-- Index for looking up assignments by member  
CREATE INDEX IF NOT EXISTS idx_copy_assignments_member_id ON copy_assignments(member_id);

-- Partial index for active (non-returned) assignments - critical for "is assigned" check
CREATE INDEX IF NOT EXISTS idx_copy_assignments_active 
ON copy_assignments(copy_id) WHERE returned_at IS NULL;
