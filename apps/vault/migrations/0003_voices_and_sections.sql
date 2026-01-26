-- Migration 0003: Voices and Sections System
-- Replaces voice_part enum with flexible voices/sections tables
-- Break-and-fix: drops voice_part columns immediately

-- ============================================================================
-- VOICES TABLE: Vocal capabilities (what you CAN sing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS voices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    abbreviation TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('vocal', 'instrumental')),
    range_group TEXT,  -- soprano, alto, tenor, bass, etc.
    display_order INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- ============================================================================
-- SECTIONS TABLE: Performance assignments (where you DO sing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    parent_section_id TEXT REFERENCES sections(id),
    display_order INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- ============================================================================
-- MEMBER_VOICES JUNCTION: Member → Voices (capabilities)
-- ============================================================================
CREATE TABLE IF NOT EXISTS member_voices (
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    voice_id TEXT NOT NULL REFERENCES voices(id) ON DELETE CASCADE,
    is_primary INTEGER NOT NULL DEFAULT 0,
    assigned_at TEXT DEFAULT (datetime('now')),
    assigned_by TEXT REFERENCES members(id),
    notes TEXT,
    PRIMARY KEY (member_id, voice_id),
    CHECK (is_primary IN (0, 1))
);

-- ============================================================================
-- MEMBER_SECTIONS JUNCTION: Member → Sections (assignments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS member_sections (
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    is_primary INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT DEFAULT (datetime('now')),
    assigned_by TEXT REFERENCES members(id),
    notes TEXT,
    PRIMARY KEY (member_id, section_id),
    CHECK (is_primary IN (0, 1))
);

-- ============================================================================
-- INVITE_VOICES JUNCTION: Invite → Voices
-- ============================================================================
CREATE TABLE IF NOT EXISTS invite_voices (
    invite_id TEXT NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
    voice_id TEXT NOT NULL REFERENCES voices(id) ON DELETE CASCADE,
    is_primary INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (invite_id, voice_id)
);

-- ============================================================================
-- INVITE_SECTIONS JUNCTION: Invite → Sections
-- ============================================================================
CREATE TABLE IF NOT EXISTS invite_sections (
    invite_id TEXT NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    is_primary INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (invite_id, section_id)
);

-- ============================================================================
-- SEED DEFAULT VOICES (active by default)
-- ============================================================================
INSERT INTO voices (id, name, abbreviation, category, range_group, display_order) VALUES
    ('soprano', 'Soprano', 'S', 'vocal', 'soprano', 10),
    ('alto', 'Alto', 'A', 'vocal', 'alto', 20),
    ('tenor', 'Tenor', 'T', 'vocal', 'tenor', 30),
    ('baritone', 'Baritone', 'Bar', 'vocal', 'baritone', 35),
    ('bass', 'Bass', 'B', 'vocal', 'bass', 40);

-- Seed subdivisions (inactive by default - choir can enable)
INSERT INTO voices (id, name, abbreviation, category, range_group, display_order, is_active) VALUES
    ('soprano-1', 'Soprano I', 'S1', 'vocal', 'soprano', 11, 0),
    ('soprano-2', 'Soprano II', 'S2', 'vocal', 'soprano', 12, 0),
    ('alto-1', 'Alto I', 'A1', 'vocal', 'alto', 21, 0),
    ('alto-2', 'Alto II', 'A2', 'vocal', 'alto', 22, 0),
    ('tenor-1', 'Tenor I', 'T1', 'vocal', 'tenor', 31, 0),
    ('tenor-2', 'Tenor II', 'T2', 'vocal', 'tenor', 32, 0),
    ('bass-1', 'Bass I', 'B1', 'vocal', 'bass', 41, 0),
    ('bass-2', 'Bass II', 'B2', 'vocal', 'bass', 42, 0);

-- ============================================================================
-- SEED DEFAULT SECTIONS (mirror voices structure)
-- ============================================================================
INSERT INTO sections (id, name, abbreviation, display_order) VALUES
    ('soprano', 'Soprano', 'S', 10),
    ('alto', 'Alto', 'A', 20),
    ('tenor', 'Tenor', 'T', 30),
    ('baritone', 'Baritone', 'Bar', 35),
    ('bass', 'Bass', 'B', 40);

INSERT INTO sections (id, name, abbreviation, parent_section_id, display_order, is_active) VALUES
    ('soprano-1', 'Soprano I', 'S1', 'soprano', 11, 0),
    ('soprano-2', 'Soprano II', 'S2', 'soprano', 12, 0),
    ('alto-1', 'Alto I', 'A1', 'alto', 21, 0),
    ('alto-2', 'Alto II', 'A2', 'alto', 22, 0),
    ('tenor-1', 'Tenor I', 'T1', 'tenor', 31, 0),
    ('tenor-2', 'Tenor II', 'T2', 'tenor', 32, 0),
    ('bass-1', 'Bass I', 'B1', 'bass', 41, 0),
    ('bass-2', 'Bass II', 'B2', 'bass', 42, 0);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_voices_category ON voices(category);
CREATE INDEX IF NOT EXISTS idx_voices_display_order ON voices(display_order);
CREATE INDEX IF NOT EXISTS idx_sections_display_order ON sections(display_order);
CREATE INDEX IF NOT EXISTS idx_sections_parent ON sections(parent_section_id);

CREATE INDEX IF NOT EXISTS idx_member_voices_member ON member_voices(member_id);
CREATE INDEX IF NOT EXISTS idx_member_voices_voice ON member_voices(voice_id);
CREATE INDEX IF NOT EXISTS idx_member_voices_primary ON member_voices(is_primary) WHERE is_primary = 1;

CREATE INDEX IF NOT EXISTS idx_member_sections_member ON member_sections(member_id);
CREATE INDEX IF NOT EXISTS idx_member_sections_section ON member_sections(section_id);
CREATE INDEX IF NOT EXISTS idx_member_sections_primary ON member_sections(is_primary) WHERE is_primary = 1;

CREATE INDEX IF NOT EXISTS idx_invite_voices_invite ON invite_voices(invite_id);
CREATE INDEX IF NOT EXISTS idx_invite_sections_invite ON invite_sections(invite_id);

-- ============================================================================
-- TRIGGERS: Enforce single primary voice/section per member
-- ============================================================================
CREATE TRIGGER IF NOT EXISTS enforce_single_primary_voice
BEFORE INSERT ON member_voices
WHEN NEW.is_primary = 1
BEGIN
    UPDATE member_voices SET is_primary = 0 WHERE member_id = NEW.member_id;
END;

CREATE TRIGGER IF NOT EXISTS enforce_single_primary_voice_update
BEFORE UPDATE ON member_voices
WHEN NEW.is_primary = 1
BEGIN
    UPDATE member_voices SET is_primary = 0 WHERE member_id = NEW.member_id AND voice_id != NEW.voice_id;
END;

CREATE TRIGGER IF NOT EXISTS enforce_single_primary_section
BEFORE INSERT ON member_sections
WHEN NEW.is_primary = 1
BEGIN
    UPDATE member_sections SET is_primary = 0 WHERE member_id = NEW.member_id;
END;

CREATE TRIGGER IF NOT EXISTS enforce_single_primary_section_update
BEFORE UPDATE ON member_sections
WHEN NEW.is_primary = 1
BEGIN
    UPDATE member_sections SET is_primary = 0 WHERE member_id = NEW.member_id AND section_id != NEW.section_id;
END;

-- ============================================================================
-- DROP OLD VOICE_PART COLUMNS (break-and-fix approach)
-- ============================================================================
-- Note: This would fail if columns don't exist, but we're working with empty DB
-- ALTER TABLE members DROP COLUMN voice_part;
-- ALTER TABLE invites DROP COLUMN voice_part;

-- SQLite doesn't support DROP COLUMN in older versions, so we use a different approach:
-- 1. Create new table without voice_part
-- 2. Copy data
-- 3. Drop old table
-- 4. Rename new table

-- For members table
CREATE TABLE members_new (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    invited_by TEXT,
    joined_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO members_new (id, email, name, invited_by, joined_at)
SELECT id, email, name, invited_by, joined_at FROM members;

DROP TABLE members;
ALTER TABLE members_new RENAME TO members;

-- For invites table
CREATE TABLE invites_new (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    invited_by TEXT NOT NULL REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

INSERT INTO invites_new (id, token, name, invited_by, created_at, expires_at)
SELECT id, token, name, invited_by, created_at, expires_at FROM invites;

DROP TABLE invites;
ALTER TABLE invites_new RENAME TO invites;
