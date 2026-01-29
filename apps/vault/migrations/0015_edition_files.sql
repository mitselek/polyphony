-- Edition file storage (separate from legacy score_files)
-- Editions use a different file storage table without FK to scores

CREATE TABLE IF NOT EXISTS edition_files (
    edition_id TEXT PRIMARY KEY REFERENCES editions(id) ON DELETE CASCADE,
    data BLOB,
    size INTEGER NOT NULL,
    original_name TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    is_chunked INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS edition_chunks (
    edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    data BLOB NOT NULL,
    size INTEGER NOT NULL,
    PRIMARY KEY (edition_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_edition_chunks_edition_id ON edition_chunks(edition_id);
