-- Migration: 0002_add_score_files.sql
-- Adds score_files table for D1 BLOB storage (replaces R2)

-- Score files table: PDF binary data stored directly in D1
CREATE TABLE IF NOT EXISTS score_files (
    score_id TEXT PRIMARY KEY REFERENCES scores(id) ON DELETE CASCADE,
    data BLOB NOT NULL,
    size INTEGER NOT NULL,
    original_name TEXT,
    uploaded_at TEXT DEFAULT (datetime('now'))
);

-- Note: D1 has a 2MB row limit. Files exceeding this need chunked storage (see issue #34)
