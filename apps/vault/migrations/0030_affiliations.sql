-- Migration 0030: Add affiliations table (Schema V2)
-- Part of Epic #158: Multi-Organization Implementation
-- Issue #164: Add affiliations table with history tracking

-- Tracks collective ↔ umbrella relationships with history
CREATE TABLE affiliations (
    id TEXT PRIMARY KEY,
    collective_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    umbrella_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    left_at TEXT,  -- NULL = active, set = ended
    UNIQUE(collective_id, umbrella_id, joined_at)  -- history uniqueness
);

-- Partial unique index: only one ACTIVE affiliation per collective-umbrella pair
-- SQLite supports partial indexes with WHERE clause
CREATE UNIQUE INDEX idx_affiliations_active
ON affiliations(collective_id, umbrella_id)
WHERE left_at IS NULL;

-- Lookup indexes
CREATE INDEX idx_affiliations_collective ON affiliations(collective_id);
CREATE INDEX idx_affiliations_umbrella ON affiliations(umbrella_id);
