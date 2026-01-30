-- Season repertoire: works and editions for each season
-- Two-stage: select Works (ordered), then Editions per work
-- Issue #120

-- Works assigned to a season with display order
CREATE TABLE season_works (
    id TEXT PRIMARY KEY,
    season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    added_by TEXT REFERENCES members(id) ON DELETE SET NULL,
    
    -- Same work can't be added twice to same season
    UNIQUE(season_id, work_id)
);

-- Index for efficient season lookups
CREATE INDEX idx_season_works_season ON season_works(season_id, display_order);
CREATE INDEX idx_season_works_work ON season_works(work_id);

-- Editions selected for each season-work pairing
-- Multiple editions can be selected per work (e.g., vocal score + orchestral parts)
CREATE TABLE season_work_editions (
    id TEXT PRIMARY KEY,
    season_work_id TEXT NOT NULL REFERENCES season_works(id) ON DELETE CASCADE,
    edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
    is_primary INTEGER NOT NULL DEFAULT 0,  -- Mark the main edition
    notes TEXT,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    added_by TEXT REFERENCES members(id) ON DELETE SET NULL,
    
    -- Same edition can't be added twice to same season-work
    UNIQUE(season_work_id, edition_id)
);

-- Index for efficient lookups
CREATE INDEX idx_season_work_editions_sw ON season_work_editions(season_work_id);
CREATE INDEX idx_season_work_editions_edition ON season_work_editions(edition_id);
