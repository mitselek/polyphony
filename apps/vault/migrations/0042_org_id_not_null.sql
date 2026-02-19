-- Migration 0042: Make org_id NOT NULL on events, works, invites (#251)
-- These columns were added as nullable in 0030 (ALTER TABLE ... ADD COLUMN
-- cannot include NOT NULL without a default in SQLite). All rows already have
-- org_id set; this migration enforces the constraint at the schema level.
--
-- Uses D1-safe _new table pattern. Since DROP TABLE fires CASCADE on D1
-- regardless of PRAGMA foreign_keys, we must save and restore ALL descendant
-- data that would be lost to cascading deletes.

-- ============================================================================
-- PRE-MIGRATION CHECKS (these should all return 0)
-- If any return non-zero, the migration data copy would lose rows.
-- ============================================================================
-- SELECT COUNT(*) FROM events WHERE org_id IS NULL;
-- SELECT COUNT(*) FROM works WHERE org_id IS NULL;
-- SELECT COUNT(*) FROM invites WHERE org_id IS NULL;

-- ============================================================================
-- STEP 1: Save all child/descendant data into temp tables
-- ============================================================================

-- Children of events
CREATE TABLE _tmp_participation AS SELECT * FROM participation;
CREATE TABLE _tmp_event_works AS SELECT * FROM event_works;

-- Grandchildren of events (via event_works)
CREATE TABLE _tmp_event_work_editions AS SELECT * FROM event_work_editions;

-- Children of works
CREATE TABLE _tmp_editions AS SELECT * FROM editions;
CREATE TABLE _tmp_season_works AS SELECT * FROM season_works;
-- event_works already saved above (also references works)

-- Grandchildren of works (via editions)
CREATE TABLE _tmp_edition_files AS SELECT * FROM edition_files;
CREATE TABLE _tmp_edition_chunks AS SELECT * FROM edition_chunks;
CREATE TABLE _tmp_physical_copies AS SELECT * FROM physical_copies;
CREATE TABLE _tmp_copy_assignments AS SELECT * FROM copy_assignments;
CREATE TABLE _tmp_takedowns AS SELECT * FROM takedowns;
CREATE TABLE _tmp_season_work_editions AS SELECT * FROM season_work_editions;
-- event_work_editions already saved above

-- Children of invites
CREATE TABLE _tmp_invite_voices AS SELECT * FROM invite_voices;
CREATE TABLE _tmp_invite_sections AS SELECT * FROM invite_sections;

-- ============================================================================
-- STEP 2: Create _new parent tables with org_id NOT NULL
-- ============================================================================

-- events_new
CREATE TABLE events_new (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('rehearsal', 'concert', 'retreat', 'festival')),
    created_by TEXT REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO events_new (id, org_id, title, description, location, starts_at, ends_at, event_type, created_by, created_at)
SELECT id, org_id, title, description, location, starts_at, ends_at, event_type, created_by, created_at
FROM events WHERE org_id IS NOT NULL;

-- works_new
CREATE TABLE works_new (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    composer TEXT,
    lyricist TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO works_new (id, org_id, title, composer, lyricist, created_at)
SELECT id, org_id, title, composer, lyricist, created_at
FROM works WHERE org_id IS NOT NULL;

-- invites_new
CREATE TABLE invites_new (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    roster_member_id TEXT REFERENCES members(id),
    token TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    invited_by TEXT NOT NULL REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

INSERT INTO invites_new (id, org_id, roster_member_id, token, name, invited_by, created_at, expires_at)
SELECT id, org_id, roster_member_id, token, name, invited_by, created_at, expires_at
FROM invites WHERE org_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Drop old parent tables (CASCADE will clear children — data is safe in _tmp)
-- Drop parents first (events, works, invites) — order among them doesn't matter
-- since they don't reference each other
-- ============================================================================

DROP TABLE events;
DROP TABLE works;
DROP TABLE invites;

-- ============================================================================
-- STEP 4: Rename _new tables to final names
-- ============================================================================

ALTER TABLE events_new RENAME TO events;
ALTER TABLE works_new RENAME TO works;
ALTER TABLE invites_new RENAME TO invites;

-- ============================================================================
-- STEP 5: Restore child data
-- Order: restore parents' direct children first, then grandchildren
-- ============================================================================

-- Restore children of works (editions must come before its own children)
INSERT INTO editions SELECT * FROM _tmp_editions;
INSERT INTO season_works SELECT * FROM _tmp_season_works;

-- Restore grandchildren of works (via editions)
INSERT INTO edition_files SELECT * FROM _tmp_edition_files;
INSERT INTO edition_chunks SELECT * FROM _tmp_edition_chunks;
INSERT INTO physical_copies SELECT * FROM _tmp_physical_copies;
INSERT INTO copy_assignments SELECT * FROM _tmp_copy_assignments;
INSERT INTO takedowns SELECT * FROM _tmp_takedowns;
INSERT INTO season_work_editions SELECT * FROM _tmp_season_work_editions;

-- Restore children of events
INSERT INTO participation SELECT * FROM _tmp_participation;
INSERT INTO event_works SELECT * FROM _tmp_event_works;

-- Restore grandchildren of events (via event_works)
INSERT INTO event_work_editions SELECT * FROM _tmp_event_work_editions;

-- Restore children of invites
INSERT INTO invite_voices SELECT * FROM _tmp_invite_voices;
INSERT INTO invite_sections SELECT * FROM _tmp_invite_sections;

-- ============================================================================
-- STEP 6: Drop temp tables
-- ============================================================================

DROP TABLE _tmp_participation;
DROP TABLE _tmp_event_works;
DROP TABLE _tmp_event_work_editions;
DROP TABLE _tmp_editions;
DROP TABLE _tmp_season_works;
DROP TABLE _tmp_edition_files;
DROP TABLE _tmp_edition_chunks;
DROP TABLE _tmp_physical_copies;
DROP TABLE _tmp_copy_assignments;
DROP TABLE _tmp_takedowns;
DROP TABLE _tmp_season_work_editions;
DROP TABLE _tmp_invite_voices;
DROP TABLE _tmp_invite_sections;

-- ============================================================================
-- STEP 7: Recreate indexes
-- ============================================================================

CREATE INDEX idx_events_starts_at ON events(starts_at);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_org ON events(org_id);

CREATE INDEX idx_works_title ON works(title);
CREATE INDEX idx_works_composer ON works(composer);
CREATE INDEX idx_works_org ON works(org_id);

CREATE INDEX idx_invites_org ON invites(org_id);
