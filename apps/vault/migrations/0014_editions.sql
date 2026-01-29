-- Editions table: specific publications or arrangements of a work
CREATE TABLE editions (
    id TEXT PRIMARY KEY,
    work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    arranger TEXT,
    publisher TEXT,
    voicing TEXT,
    edition_type TEXT NOT NULL DEFAULT 'vocal_score',
    license_type TEXT NOT NULL DEFAULT 'owned',
    notes TEXT,
    external_url TEXT,
    file_key TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_uploaded_at DATETIME,
    file_uploaded_by TEXT REFERENCES members(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Edition sections junction table
CREATE TABLE edition_sections (
    edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    PRIMARY KEY (edition_id, section_id)
);

-- Indexes
CREATE INDEX idx_editions_work_id ON editions(work_id);
CREATE INDEX idx_editions_edition_type ON editions(edition_type);
CREATE INDEX idx_edition_sections_section_id ON edition_sections(section_id);
