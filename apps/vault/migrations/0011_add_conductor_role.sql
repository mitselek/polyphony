-- Migration: 0011_add_conductor_role.sql
-- Adds 'conductor' role to member_roles CHECK constraint
-- Related: https://github.com/mitselek/polyphony/issues/55

-- SQLite doesn't support ALTER TABLE ... ALTER COLUMN, so we need to recreate the table

-- 1. Create new member_roles table with updated CHECK constraint
CREATE TABLE member_roles_new (
    member_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'librarian', 'conductor')),
    granted_at TEXT DEFAULT (datetime('now')),
    granted_by TEXT,
    PRIMARY KEY (member_id, role)
);

-- 2. Copy existing data
INSERT INTO member_roles_new (member_id, role, granted_at, granted_by)
SELECT member_id, role, granted_at, granted_by FROM member_roles;

-- 3. Drop old table and rename new one
DROP TABLE member_roles;
ALTER TABLE member_roles_new RENAME TO member_roles;

-- 4. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_member_roles_member ON member_roles(member_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_role ON member_roles(role);
