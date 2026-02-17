-- Migration 0039: Normalize DATETIME columns to TEXT
-- Fix inconsistent timestamp types from early migrations (0001, 0013, 0014, 0016)
-- Changes DATETIME DEFAULT CURRENT_TIMESTAMP → TEXT NOT NULL DEFAULT (datetime('now'))
-- Changes DATETIME (nullable) → TEXT (nullable)
--
-- Affected tables: vault_settings, works, editions, physical_copies

-- Disable FK enforcement during table rebuilds to prevent cascade deletes
PRAGMA foreign_keys = OFF;

-- ============================================================================
-- 1. VAULT_SETTINGS: updated_at DATETIME → TEXT
-- ============================================================================
CREATE TABLE vault_settings_new (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_by TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (updated_by) REFERENCES members(id) ON DELETE SET NULL
);

INSERT INTO vault_settings_new (key, value, updated_by, updated_at)
SELECT key, value, updated_by, updated_at FROM vault_settings;

DROP TABLE vault_settings;
ALTER TABLE vault_settings_new RENAME TO vault_settings;

-- ============================================================================
-- 2. WORKS: created_at DATETIME → TEXT
--    Current schema: 0013 + 0030 (added org_id via ALTER TABLE)
-- ============================================================================
CREATE TABLE works_new (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    composer TEXT,
    lyricist TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO works_new (id, org_id, title, composer, lyricist, created_at)
SELECT id, org_id, title, composer, lyricist, created_at FROM works;

DROP TABLE works;
ALTER TABLE works_new RENAME TO works;

-- Recreate indexes (from 0013 + 0030)
CREATE INDEX idx_works_title ON works(title);
CREATE INDEX idx_works_composer ON works(composer);
CREATE INDEX idx_works_org ON works(org_id);

-- ============================================================================
-- 3. EDITIONS: created_at DATETIME → TEXT, file_uploaded_at DATETIME → TEXT
--    Current schema: 0014 (never rebuilt)
-- ============================================================================
CREATE TABLE editions_new (
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
    file_uploaded_at TEXT,
    file_uploaded_by TEXT REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO editions_new (id, work_id, name, arranger, publisher, voicing,
    edition_type, license_type, notes, external_url,
    file_key, file_name, file_size, file_uploaded_at, file_uploaded_by, created_at)
SELECT id, work_id, name, arranger, publisher, voicing,
    edition_type, license_type, notes, external_url,
    file_key, file_name, file_size, file_uploaded_at, file_uploaded_by, created_at
FROM editions;

DROP TABLE editions;
ALTER TABLE editions_new RENAME TO editions;

-- Recreate indexes (from 0014)
CREATE INDEX idx_editions_work_id ON editions(work_id);
CREATE INDEX idx_editions_edition_type ON editions(edition_type);

-- ============================================================================
-- 4. PHYSICAL_COPIES: created_at DATETIME → TEXT
--    Current schema: 0016 (never rebuilt)
-- ============================================================================
CREATE TABLE physical_copies_new (
    id TEXT PRIMARY KEY,
    edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
    copy_number TEXT NOT NULL,
    condition TEXT DEFAULT 'good' CHECK (condition IN ('good', 'fair', 'poor', 'lost')),
    acquired_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE (edition_id, copy_number)
);

INSERT INTO physical_copies_new (id, edition_id, copy_number, condition, acquired_at, notes, created_at)
SELECT id, edition_id, copy_number, condition, acquired_at, notes, created_at FROM physical_copies;

DROP TABLE physical_copies;
ALTER TABLE physical_copies_new RENAME TO physical_copies;

-- Recreate indexes (from 0016)
CREATE INDEX idx_physical_copies_edition ON physical_copies(edition_id);
CREATE INDEX idx_physical_copies_condition ON physical_copies(condition);

-- ============================================================================
-- Re-enable FK enforcement
-- ============================================================================
PRAGMA foreign_keys = ON;

-- Verify FK integrity
PRAGMA foreign_key_check;
