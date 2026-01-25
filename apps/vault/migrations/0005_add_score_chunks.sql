-- Migration: 0005_add_score_chunks.sql
-- Adds chunked storage support for large PDFs (>2MB)
-- D1 has a 2MB row limit, so large files are split into chunks

-- Score chunks table: stores file data in ≤2MB pieces
CREATE TABLE IF NOT EXISTS score_chunks (
    score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    data BLOB NOT NULL,
    size INTEGER NOT NULL,
    PRIMARY KEY (score_id, chunk_index)
);

-- Index for efficient retrieval of all chunks for a score
CREATE INDEX IF NOT EXISTS idx_score_chunks_score_id ON score_chunks(score_id);

-- Add metadata to score_files to track if file is chunked
ALTER TABLE score_files ADD COLUMN is_chunked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE score_files ADD COLUMN chunk_count INTEGER DEFAULT NULL;
