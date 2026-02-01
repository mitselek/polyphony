-- Migration 0029: Add org_id to content tables (Schema V2)
-- Part of Epic #158: Multi-Organization Implementation
-- Issue #163: Add org_id to content tables

-- Note: SQLite allows ALTER TABLE ADD COLUMN without NOT NULL constraint
-- Using nullable org_id for now; can add NOT NULL via table rebuild if needed

-- ============================================================================
-- EVENTS
-- ============================================================================
ALTER TABLE events ADD COLUMN org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
UPDATE events SET org_id = 'org_crede_001';
CREATE INDEX IF NOT EXISTS idx_events_org ON events(org_id);

-- ============================================================================
-- WORKS
-- ============================================================================
ALTER TABLE works ADD COLUMN org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
UPDATE works SET org_id = 'org_crede_001';
CREATE INDEX IF NOT EXISTS idx_works_org ON works(org_id);

-- ============================================================================
-- SEASONS
-- Seasons now scoped per-org: same start_date allowed in different orgs
-- ============================================================================
-- SQLite: Table rebuild needed to change UNIQUE constraint from (start_date) to (org_id, start_date)
CREATE TABLE seasons_new (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(org_id, start_date)
);

-- Migrate existing seasons to Crede org
INSERT INTO seasons_new (id, org_id, name, start_date, created_at, updated_at)
SELECT id, 'org_crede_001', name, start_date, created_at, updated_at
FROM seasons;

DROP TABLE seasons;
ALTER TABLE seasons_new RENAME TO seasons;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_seasons_start_date ON seasons(start_date);
CREATE INDEX IF NOT EXISTS idx_seasons_org ON seasons(org_id);

-- ============================================================================
-- INVITES
-- ============================================================================
ALTER TABLE invites ADD COLUMN org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
UPDATE invites SET org_id = 'org_crede_001';
CREATE INDEX IF NOT EXISTS idx_invites_org ON invites(org_id);
