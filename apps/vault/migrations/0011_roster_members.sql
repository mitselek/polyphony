-- Migration 0011: Two-tier member system
-- Migrate members table: email → email_id + email_contact
-- Refs: Issue #94, Epic #93

-- SQLite doesn't support ALTER COLUMN, so we recreate the table

-- Step 1: Create new members table with updated schema
CREATE TABLE members_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                    -- Now required (was nullable)
  email_id TEXT,                         -- OAuth identity (renamed from email)
  email_contact TEXT,                    -- NEW: Contact preference
  invited_by TEXT,
  joined_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (invited_by) REFERENCES members(id)
);

-- Step 2: Create indexes
CREATE UNIQUE INDEX idx_members_name_lower ON members_new(LOWER(name));
CREATE UNIQUE INDEX idx_members_email_id ON members_new(email_id) WHERE email_id IS NOT NULL;

-- Step 3: Migrate existing data
INSERT INTO members_new (id, name, email_id, email_contact, invited_by, joined_at)
SELECT id, COALESCE(name, email) as name, email as email_id, NULL, invited_by, joined_at
FROM members;

-- Step 4: Replace table
DROP TABLE members;
ALTER TABLE members_new RENAME TO members;

-- Step 5: Add roster_member_id to invites
ALTER TABLE invites ADD COLUMN roster_member_id TEXT REFERENCES members(id);
