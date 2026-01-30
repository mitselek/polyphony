-- Event repertoire: works and editions for each event
-- Mirrors season_works/season_work_editions but event-specific
-- Events can have ad-hoc works not in the season
-- Issue #121

-- Works assigned to an event with display order
CREATE TABLE event_works (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    added_by TEXT REFERENCES members(id) ON DELETE SET NULL,
    
    -- Same work can't be added twice to same event
    UNIQUE(event_id, work_id)
);

-- Index for efficient event lookups
CREATE INDEX idx_event_works_event ON event_works(event_id, display_order);
CREATE INDEX idx_event_works_work ON event_works(work_id);

-- Editions selected for each event-work pairing
-- Multiple editions can be selected per work (e.g., vocal score + orchestral parts)
CREATE TABLE event_work_editions (
    id TEXT PRIMARY KEY,
    event_work_id TEXT NOT NULL REFERENCES event_works(id) ON DELETE CASCADE,
    edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
    is_primary INTEGER NOT NULL DEFAULT 0,  -- Mark the main edition
    notes TEXT,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    added_by TEXT REFERENCES members(id) ON DELETE SET NULL,
    
    -- Same edition can't be added twice to same event-work
    UNIQUE(event_work_id, edition_id)
);

-- Index for efficient lookups
CREATE INDEX idx_event_work_editions_ew ON event_work_editions(event_work_id);
CREATE INDEX idx_event_work_editions_edition ON event_work_editions(edition_id);
