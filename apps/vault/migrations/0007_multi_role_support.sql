-- Migration: 0007_multi_role_support.sql
-- Refactors role system to support multiple roles per member
-- Related: https://github.com/mitselek/polyphony/issues/46
-- NOTE: This migration clears all test data

-- Clear all data (test data only)
DELETE FROM access_log;
DELETE FROM score_files;
DELETE FROM takedowns;
DELETE FROM invites;
DELETE FROM sessions;
DELETE FROM scores;
DELETE FROM members;

-- 1. Create member_roles junction table
CREATE TABLE IF NOT EXISTS member_roles (
    member_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'librarian')),
    granted_at TEXT DEFAULT (datetime('now')),
    granted_by TEXT,
    PRIMARY KEY (member_id, role)
);

CREATE INDEX IF NOT EXISTS idx_member_roles_member ON member_roles(member_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_role ON member_roles(role);

-- 2. Recreate members table with voice_part, without role column
CREATE TABLE members_new (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    voice_part TEXT CHECK (
        voice_part IS NULL OR (
            length(voice_part) BETWEEN 1 AND 4 
            AND voice_part NOT GLOB '*[^SATB]*'
        )
    ),
    invited_by TEXT,
    joined_at TEXT DEFAULT (datetime('now'))
);

DROP TABLE members;
ALTER TABLE members_new RENAME TO members;

-- 3. Create test owner user
INSERT INTO members (id, email, name, joined_at) 
VALUES ('admin-001', 'admin@example.com', 'Admin User', datetime('now'));

INSERT INTO member_roles (member_id, role)
VALUES ('admin-001', 'owner'), ('admin-001', 'admin');
