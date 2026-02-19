-- Migration 0043: Add org_id to voices (Schema V2)
-- Issue #252: Org-scope the voices table
--
-- Voices become per-organization: each org gets its own copy.
-- Uses D1-safe rebuild pattern (CASCADE fires on DROP TABLE regardless
-- of PRAGMA foreign_keys).
--
-- Child tables affected by CASCADE on DROP TABLE voices:
--   member_voices  (voices FK)
--   invite_voices  (voices FK)

-- ============================================================================
-- STEP 1: Save child data that will be lost to CASCADE
-- ============================================================================

CREATE TABLE _tmp_member_voices AS SELECT * FROM member_voices;
CREATE TABLE _tmp_invite_voices AS SELECT * FROM invite_voices;

-- ============================================================================
-- STEP 2: Create voices_new with org_id NOT NULL
-- ============================================================================

CREATE TABLE voices_new (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('vocal', 'instrumental')),
    range_group TEXT,
    display_order INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(org_id, name)
);

-- ============================================================================
-- STEP 3: Seed voices for EVERY organization
-- Each org gets a copy of every existing voice row with an org-prefixed ID.
-- ============================================================================

INSERT INTO voices_new (id, org_id, name, abbreviation, category, range_group, display_order, is_active)
SELECT o.id || '_' || v.id, o.id, v.name, v.abbreviation, v.category, v.range_group, v.display_order, v.is_active
FROM voices v
CROSS JOIN organizations o;

-- ============================================================================
-- STEP 4: Drop old voices table (CASCADE deletes member_voices, invite_voices)
-- ============================================================================

DROP TABLE voices;

-- ============================================================================
-- STEP 5: Rename new table
-- ============================================================================

ALTER TABLE voices_new RENAME TO voices;

-- ============================================================================
-- STEP 6: Restore member_voices with org-scoped voice IDs
-- Map each member_voice to the correct org via member_organizations.
-- NOTE: If a member belongs to multiple orgs, this JOIN produces one row per
-- org, duplicating the voice assignment into each org. This is acceptable for
-- the current single-org deployment. For multi-org scenarios, consider
-- restricting to the member's primary org or requiring manual assignment.
-- ============================================================================

INSERT INTO member_voices (member_id, voice_id, is_primary, assigned_at, assigned_by, notes)
SELECT
    t.member_id,
    mo.org_id || '_' || t.voice_id,
    t.is_primary,
    t.assigned_at,
    t.assigned_by,
    t.notes
FROM _tmp_member_voices t
JOIN member_organizations mo ON mo.member_id = t.member_id;

-- ============================================================================
-- STEP 7: Restore invite_voices with org-scoped voice IDs
-- Map each invite_voice to the correct org via invites.org_id.
-- ============================================================================

INSERT INTO invite_voices (invite_id, voice_id, is_primary)
SELECT
    t.invite_id,
    i.org_id || '_' || t.voice_id,
    t.is_primary
FROM _tmp_invite_voices t
JOIN invites i ON i.id = t.invite_id;

-- ============================================================================
-- STEP 8: Drop temp tables
-- ============================================================================

DROP TABLE _tmp_member_voices;
DROP TABLE _tmp_invite_voices;

-- ============================================================================
-- STEP 9: Recreate voices indexes (child table indexes survive CASCADE)
-- ============================================================================

CREATE INDEX idx_voices_org ON voices(org_id);
CREATE INDEX idx_voices_category ON voices(category);
CREATE INDEX idx_voices_display_order ON voices(display_order);

-- ============================================================================
-- STEP 10: Recreate voice triggers (org-scoped)
-- When setting a voice as primary, only clear other primaries in same org.
-- ============================================================================

DROP TRIGGER IF EXISTS enforce_single_primary_voice;
DROP TRIGGER IF EXISTS enforce_single_primary_voice_update;

CREATE TRIGGER enforce_single_primary_voice
BEFORE INSERT ON member_voices
WHEN NEW.is_primary = 1
BEGIN
    UPDATE member_voices
    SET is_primary = 0
    WHERE member_id = NEW.member_id
      AND voice_id IN (
          SELECT v1.id
          FROM voices v1
          JOIN voices v2 ON v1.org_id = v2.org_id
          WHERE v2.id = NEW.voice_id
      );
END;

CREATE TRIGGER enforce_single_primary_voice_update
BEFORE UPDATE OF is_primary ON member_voices
WHEN NEW.is_primary = 1
BEGIN
    UPDATE member_voices
    SET is_primary = 0
    WHERE member_id = NEW.member_id
      AND voice_id IN (
          SELECT v1.id
          FROM voices v1
          JOIN voices v2 ON v1.org_id = v2.org_id
          WHERE v2.id = NEW.voice_id
      );
END;
