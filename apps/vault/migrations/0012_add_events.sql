-- Migration: 0012_add_events.sql
-- Adds events and event_programs tables for calendar/rehearsal scheduling
-- Related: https://github.com/mitselek/polyphony/issues/56
-- Part of Epic #53 (Events, Programs & Participation)

-- Events table - rehearsals, concerts, retreats, etc.
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('rehearsal', 'concert', 'retreat')),
    created_by TEXT NOT NULL REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Event programs (setlists) - links scores to events with ordering
CREATE TABLE IF NOT EXISTS event_programs (
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    added_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (event_id, score_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_event_programs_event ON event_programs(event_id);
CREATE INDEX IF NOT EXISTS idx_event_programs_score ON event_programs(score_id);
