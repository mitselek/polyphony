-- Migration 0027: Add org_id to member_roles (Schema V2)
-- Part of Epic #158: Multi-Organization Implementation
-- Issue #161: Add org_id to member_roles table

-- SQLite requires table rebuild for schema changes (no ALTER COLUMN)

-- Step 1: Create new table with org_id in schema
CREATE TABLE member_roles_new (
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    granted_by TEXT REFERENCES members(id),
    PRIMARY KEY (member_id, org_id, role)
);

-- Step 2: Copy data with Crede org_id
INSERT INTO member_roles_new (member_id, org_id, role, granted_at, granted_by)
SELECT member_id, 'org_crede_001', role, granted_at, granted_by FROM member_roles;

-- Step 3: Drop old table
DROP TABLE member_roles;

-- Step 4: Rename new table
ALTER TABLE member_roles_new RENAME TO member_roles;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_member_roles_org ON member_roles(org_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_member ON member_roles(member_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_role ON member_roles(role);
