-- Seasons table for date-based event grouping
-- Events belong to seasons by date range, not explicit FK
-- Issue #119

CREATE TABLE seasons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD, unique prevents overlap
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for efficient date lookups
CREATE INDEX idx_seasons_start_date ON seasons(start_date);

-- To find which season an event belongs to:
-- SELECT * FROM seasons WHERE start_date <= :event_date ORDER BY start_date DESC LIMIT 1
