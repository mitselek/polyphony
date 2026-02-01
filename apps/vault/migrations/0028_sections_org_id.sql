-- Migration 0028: Add org_id to sections (Schema V2)
-- Part of Epic #158: Multi-Organization Implementation
-- Issue #162: Add org_id to sections table

-- Sections are per-organization (Choir A's "T1" ≠ Choir B's "T1")
-- Voices remain global (a singer's vocal capability is intrinsic)

-- Step 1: Create new table with org_id
CREATE TABLE sections_new (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    parent_section_id TEXT REFERENCES sections_new(id),
    display_order INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(org_id, name)
);

-- Step 2: Copy data with Crede org_id
INSERT INTO sections_new (id, org_id, name, abbreviation, parent_section_id, display_order, is_active)
SELECT id, 'org_crede_001', name, abbreviation, parent_section_id, display_order, is_active FROM sections;

-- Step 3: Drop old table
DROP TABLE sections;

-- Step 4: Rename new table
ALTER TABLE sections_new RENAME TO sections;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_sections_org ON sections(org_id);
CREATE INDEX IF NOT EXISTS idx_sections_display_order ON sections(display_order);
