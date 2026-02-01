-- E2E Test Database Seed Data
-- Run this before E2E tests to create test members that match fixtures.ts
--
-- Usage with wrangler:
--   wrangler d1 execute DB --local --file=tests/e2e/seed-test-data.sql

-- ============================================================================
-- CLEANUP: Remove existing test data (idempotent)
-- ============================================================================

-- Delete test members (CASCADE will clean up junction tables)
DELETE FROM member_roles WHERE member_id LIKE 'e2e-%';
DELETE FROM member_voices WHERE member_id LIKE 'e2e-%';
DELETE FROM member_sections WHERE member_id LIKE 'e2e-%';
DELETE FROM members WHERE id LIKE 'e2e-%';

-- Delete test invites
DELETE FROM invite_voices WHERE invite_id LIKE 'e2e-%';
DELETE FROM invite_sections WHERE invite_id LIKE 'e2e-%';
DELETE FROM invites WHERE id LIKE 'e2e-%';

-- ============================================================================
-- SEED TEST MEMBERS (matching fixtures.ts)
-- ============================================================================

INSERT INTO members (id, email, name, invited_by, joined_at) VALUES
    ('e2e-owner-001', 'owner@e2e-test.scoreinstitute.eu', 'E2E Owner', NULL, datetime('now')),
    ('e2e-admin-001', 'admin@e2e-test.scoreinstitute.eu', 'E2E Admin', 'e2e-owner-001', datetime('now')),
    ('e2e-librarian-001', 'librarian@e2e-test.scoreinstitute.eu', 'E2E Librarian', 'e2e-owner-001', datetime('now')),
    ('e2e-singer-001', 'singer@e2e-test.scoreinstitute.eu', 'E2E Singer', 'e2e-admin-001', datetime('now'));

-- ============================================================================
-- SEED MEMBER ROLES
-- ============================================================================

-- Owner has owner role
INSERT INTO member_roles (member_id, role, granted_at, granted_by) VALUES
    ('e2e-owner-001', 'owner', datetime('now'), NULL);

-- Admin has admin role
INSERT INTO member_roles (member_id, role, granted_at, granted_by) VALUES
    ('e2e-admin-001', 'admin', datetime('now'), 'e2e-owner-001');

-- Librarian has librarian role
INSERT INTO member_roles (member_id, role, granted_at, granted_by) VALUES
    ('e2e-librarian-001', 'librarian', datetime('now'), 'e2e-owner-001');

-- Singer has no special role (just a member)
-- No INSERT needed - authenticated members have implicit view/download permissions

-- ============================================================================
-- SEED MEMBER VOICES (for testing voice badges)
-- ============================================================================

-- Owner: Soprano (primary)
INSERT INTO member_voices (member_id, voice_id, is_primary, assigned_at, assigned_by) VALUES
    ('e2e-owner-001', 'soprano', 1, datetime('now'), NULL);

-- Admin: Alto (primary), Soprano (secondary)
INSERT INTO member_voices (member_id, voice_id, is_primary, assigned_at, assigned_by) VALUES
    ('e2e-admin-001', 'alto', 1, datetime('now'), 'e2e-owner-001'),
    ('e2e-admin-001', 'soprano', 0, datetime('now'), 'e2e-owner-001');

-- Librarian: Tenor (primary)
INSERT INTO member_voices (member_id, voice_id, is_primary, assigned_at, assigned_by) VALUES
    ('e2e-librarian-001', 'tenor', 1, datetime('now'), 'e2e-owner-001');

-- Singer: Bass (primary), Baritone (secondary)
INSERT INTO member_voices (member_id, voice_id, is_primary, assigned_at, assigned_by) VALUES
    ('e2e-singer-001', 'bass', 1, datetime('now'), 'e2e-admin-001'),
    ('e2e-singer-001', 'baritone', 0, datetime('now'), 'e2e-admin-001');

-- ============================================================================
-- SEED MEMBER SECTIONS (for testing section badges)
-- ============================================================================

-- Owner: Soprano section (primary)
INSERT INTO member_sections (member_id, section_id, is_primary, joined_at, assigned_by) VALUES
    ('e2e-owner-001', 'soprano', 1, datetime('now'), NULL);

-- Admin: Alto section (primary)
INSERT INTO member_sections (member_id, section_id, is_primary, joined_at, assigned_by) VALUES
    ('e2e-admin-001', 'alto', 1, datetime('now'), 'e2e-owner-001');

-- Librarian: Tenor section (primary)
INSERT INTO member_sections (member_id, section_id, is_primary, joined_at, assigned_by) VALUES
    ('e2e-librarian-001', 'tenor', 1, datetime('now'), 'e2e-owner-001');

-- Singer: Bass section (primary)
INSERT INTO member_sections (member_id, section_id, is_primary, joined_at, assigned_by) VALUES
    ('e2e-singer-001', 'bass', 1, datetime('now'), 'e2e-admin-001');

-- ============================================================================
-- VERIFY: Quick check that data was inserted
-- ============================================================================

-- Uncomment these for debugging:
-- SELECT 'Members:' as table_name, count(*) as count FROM members WHERE id LIKE 'e2e-%';
-- SELECT 'Roles:' as table_name, count(*) as count FROM member_roles WHERE member_id LIKE 'e2e-%';
-- SELECT 'Voices:' as table_name, count(*) as count FROM member_voices WHERE member_id LIKE 'e2e-%';
-- SELECT 'Sections:' as table_name, count(*) as count FROM member_sections WHERE member_id LIKE 'e2e-%';
