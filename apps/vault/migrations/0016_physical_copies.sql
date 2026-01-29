-- Physical copies of editions (individual numbered copies)
-- Part of Epic #106 - Phase B: Physical Inventory

CREATE TABLE physical_copies (
    id TEXT PRIMARY KEY,
    edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
    copy_number TEXT NOT NULL,
    condition TEXT DEFAULT 'good' CHECK (condition IN ('good', 'fair', 'poor', 'lost')),
    acquired_at DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Copy number must be unique within an edition
    UNIQUE (edition_id, copy_number)
);

-- Index for querying copies by edition
CREATE INDEX idx_physical_copies_edition ON physical_copies(edition_id);

-- Index for condition queries (e.g., finding lost copies)
CREATE INDEX idx_physical_copies_condition ON physical_copies(condition);
