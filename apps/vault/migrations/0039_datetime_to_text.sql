-- Migration 0039: Normalize DATETIME columns to TEXT
-- Fix inconsistent timestamp types from early migrations (0001, 0013, 0014, 0016)
-- Changes DATETIME DEFAULT CURRENT_TIMESTAMP → TEXT NOT NULL DEFAULT (datetime('now'))
-- Changes DATETIME (nullable) → TEXT (nullable)
--
-- Affected tables: vault_settings, works, editions, physical_copies
--
-- D1-SAFE PATTERN: D1 ignores PRAGMA foreign_keys = OFF, so dropping a parent
-- table ALWAYS cascades to children. To avoid data loss:
--   1. Create ALL _new tables (FKs reference _new parents, not old tables)
--   2. Copy ALL data from old tables into _new tables
--   3. Drop ALL old tables (cascades only hit other old tables)
--   4. Rename ALL _new tables to final names
--
-- ALL child tables of works and editions must also be rebuilt to avoid cascade
-- data loss, even if their schemas aren't changing. Children of editions:
-- edition_files, edition_chunks, edition_sections, physical_copies, copy_assignments

-- ============================================================================
-- PHASE 1: Create all _new tables
-- ============================================================================

-- 1a. No-dependency tables
CREATE TABLE vault_settings_new (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_by TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (updated_by) REFERENCES members(id) ON DELETE SET NULL
);

-- 1b. works_new (parent)
CREATE TABLE works_new (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    composer TEXT,
    lyricist TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 1c. editions_new (references works_new)
CREATE TABLE editions_new (
    id TEXT PRIMARY KEY,
    work_id TEXT NOT NULL REFERENCES works_new(id) ON DELETE CASCADE,
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
    file_uploaded_at TEXT,
    file_uploaded_by TEXT REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 1d. All children of editions (reference editions_new)
CREATE TABLE edition_files_new (
    edition_id TEXT PRIMARY KEY REFERENCES editions_new(id) ON DELETE CASCADE,
    data BLOB,
    size INTEGER NOT NULL,
    original_name TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    is_chunked INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER DEFAULT NULL
);

CREATE TABLE edition_chunks_new (
    edition_id TEXT NOT NULL REFERENCES editions_new(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    data BLOB NOT NULL,
    size INTEGER NOT NULL,
    PRIMARY KEY (edition_id, chunk_index)
);

CREATE TABLE edition_sections_new (
    edition_id TEXT NOT NULL REFERENCES editions_new(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    PRIMARY KEY (edition_id, section_id)
);

CREATE TABLE physical_copies_new (
    id TEXT PRIMARY KEY,
    edition_id TEXT NOT NULL REFERENCES editions_new(id) ON DELETE CASCADE,
    copy_number TEXT NOT NULL,
    condition TEXT DEFAULT 'good' CHECK (condition IN ('good', 'fair', 'poor', 'lost')),
    acquired_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (edition_id, copy_number)
);

CREATE TABLE copy_assignments_new (
    id TEXT PRIMARY KEY,
    copy_id TEXT NOT NULL REFERENCES physical_copies_new(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    returned_at TEXT,
    assigned_by TEXT REFERENCES members(id),
    UNIQUE (copy_id, member_id, returned_at)
);

-- ============================================================================
-- PHASE 2: Copy all data from old tables to _new tables
-- ============================================================================

INSERT INTO vault_settings_new (key, value, updated_by, updated_at)
SELECT key, value, updated_by, updated_at FROM vault_settings;

INSERT INTO works_new (id, org_id, title, composer, lyricist, created_at)
SELECT id, org_id, title, composer, lyricist, created_at FROM works;

INSERT INTO editions_new (id, work_id, name, arranger, publisher, voicing,
    edition_type, license_type, notes, external_url,
    file_key, file_name, file_size, file_uploaded_at, file_uploaded_by, created_at)
SELECT id, work_id, name, arranger, publisher, voicing,
    edition_type, license_type, notes, external_url,
    file_key, file_name, file_size, file_uploaded_at, file_uploaded_by, created_at
FROM editions;

INSERT INTO edition_files_new (edition_id, data, size, original_name, uploaded_at, is_chunked, chunk_count)
SELECT edition_id, data, size, original_name, uploaded_at, is_chunked, chunk_count FROM edition_files;

INSERT INTO edition_chunks_new (edition_id, chunk_index, data, size)
SELECT edition_id, chunk_index, data, size FROM edition_chunks;

INSERT INTO edition_sections_new (edition_id, section_id)
SELECT edition_id, section_id FROM edition_sections;

INSERT INTO physical_copies_new (id, edition_id, copy_number, condition, acquired_at, notes, created_at)
SELECT id, edition_id, copy_number, condition, acquired_at, notes, created_at FROM physical_copies;

INSERT INTO copy_assignments_new (id, copy_id, member_id, assigned_at, returned_at, assigned_by)
SELECT id, copy_id, member_id, assigned_at, returned_at, assigned_by FROM copy_assignments;

-- ============================================================================
-- PHASE 3: Drop all old tables (parent-first so CASCADE targets still exist)
-- ============================================================================
-- D1 ignores PRAGMA foreign_keys = OFF, so DROP TABLE always cascades.
-- If we drop children first, dropping a parent fails because CASCADE tries
-- to reach an already-dropped child table. Dropping parents first lets
-- CASCADE fire into children that still exist (data loss is fine — all data
-- is safely in _new tables). vault_settings is independent.

DROP TABLE vault_settings;
DROP TABLE works;
DROP TABLE editions;
DROP TABLE edition_files;
DROP TABLE edition_chunks;
DROP TABLE edition_sections;
DROP TABLE physical_copies;
DROP TABLE copy_assignments;

-- ============================================================================
-- PHASE 4: Rename all _new tables to final names
-- ============================================================================

ALTER TABLE vault_settings_new RENAME TO vault_settings;
ALTER TABLE works_new RENAME TO works;
ALTER TABLE editions_new RENAME TO editions;
ALTER TABLE edition_files_new RENAME TO edition_files;
ALTER TABLE edition_chunks_new RENAME TO edition_chunks;
ALTER TABLE edition_sections_new RENAME TO edition_sections;
ALTER TABLE physical_copies_new RENAME TO physical_copies;
ALTER TABLE copy_assignments_new RENAME TO copy_assignments;

-- ============================================================================
-- PHASE 5: Recreate indexes
-- ============================================================================

-- works indexes (from 0013 + 0030)
CREATE INDEX idx_works_title ON works(title);
CREATE INDEX idx_works_composer ON works(composer);
CREATE INDEX idx_works_org ON works(org_id);

-- editions indexes (from 0014)
CREATE INDEX idx_editions_work_id ON editions(work_id);
CREATE INDEX idx_editions_edition_type ON editions(edition_type);

-- edition_sections index (from 0014)
CREATE INDEX idx_edition_sections_section_id ON edition_sections(section_id);

-- physical_copies indexes (from 0016)
CREATE INDEX idx_physical_copies_edition ON physical_copies(edition_id);
CREATE INDEX idx_physical_copies_condition ON physical_copies(condition);

-- Verify FK integrity
PRAGMA foreign_key_check;
