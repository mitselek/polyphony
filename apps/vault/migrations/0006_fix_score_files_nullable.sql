-- Migration: 0006_fix_score_files_nullable.sql
-- Fix: Allow NULL data for chunked files (data stored in score_chunks instead)

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
-- Step 1: Create new table with correct schema
CREATE TABLE score_files_new (
    score_id TEXT PRIMARY KEY REFERENCES scores(id) ON DELETE CASCADE,
    data BLOB,  -- Now nullable for chunked files
    size INTEGER NOT NULL,
    original_name TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    is_chunked INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER DEFAULT NULL
);

-- Step 2: Copy existing data
INSERT INTO score_files_new (score_id, data, size, original_name, uploaded_at, is_chunked, chunk_count)
SELECT score_id, data, size, original_name, uploaded_at, is_chunked, chunk_count
FROM score_files;

-- Step 3: Drop old table
DROP TABLE score_files;

-- Step 4: Rename new table
ALTER TABLE score_files_new RENAME TO score_files;
