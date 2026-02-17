-- Migration 0031: Add 'festival' event type
-- Covers festivals, competitions, contests, and other large multi-collective events
-- Example: "Kammerkooride festival Rakvere 2026"

-- SQLite requires table rebuild to change CHECK constraint
-- Step 1: Create new table with updated CHECK constraint
CREATE TABLE events_new (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('rehearsal', 'concert', 'retreat', 'festival')),
    created_by TEXT REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 2: Copy existing data
INSERT INTO events_new (id, org_id, title, description, location, starts_at, ends_at, event_type, created_by, created_at)
SELECT id, org_id, title, description, location, starts_at, ends_at, event_type, created_by, created_at
FROM events;

-- Step 3: Drop old table
DROP TABLE events;

-- Step 4: Rename new table
ALTER TABLE events_new RENAME TO events;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_org ON events(org_id);
