-- Works table for Score Library (Epic #106)
-- Abstract compositions with minimal metadata

CREATE TABLE works (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  composer TEXT,
  lyricist TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for search by title/composer
CREATE INDEX idx_works_title ON works(title);
CREATE INDEX idx_works_composer ON works(composer);
