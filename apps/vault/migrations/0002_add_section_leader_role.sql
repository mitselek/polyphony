-- Migration: Add section_leader role support
-- Drop and recreate member_roles table with updated CHECK constraint

-- SQLite doesn't support ALTER TABLE ... ADD CONSTRAINT, so we need to recreate the table
-- This is safe because we're only adding a new allowed value, not removing existing data

-- Create temporary table with new constraint
CREATE TABLE member_roles_new (
    member_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'librarian', 'conductor', 'section_leader')),
    granted_at TEXT DEFAULT (datetime('now')),
    granted_by TEXT,
    PRIMARY KEY (member_id, role)
);

-- Copy existing data
INSERT INTO member_roles_new SELECT * FROM member_roles;

-- Drop old table
DROP TABLE member_roles;

-- Rename new table
ALTER TABLE member_roles_new RENAME TO member_roles;
