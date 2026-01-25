-- Migration: 0009_invites_name_based.sql
-- Refactor invites to use name instead of email (email comes from registry OAuth)

-- SQLite doesn't support ALTER COLUMN RENAME, so we need to recreate the table
-- Create new table with updated schema
CREATE TABLE invites_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,  -- Invitee name for tracking (not verified)
    token TEXT NOT NULL UNIQUE,
    invited_by TEXT NOT NULL REFERENCES members(id),
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'expired')),
    roles TEXT NOT NULL DEFAULT '[]',  -- JSON array
    voice_part TEXT CHECK (voice_part IN ('S', 'A', 'T', 'B', 'SA', 'AT', 'TB', 'SAT', 'ATB', 'SATB')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    accepted_at TEXT,
    accepted_by_email TEXT  -- Registry-verified email (filled when accepted)
);

-- Copy data from old table (email becomes name)
INSERT INTO invites_new (id, name, token, invited_by, expires_at, status, roles, voice_part, created_at, accepted_at)
SELECT id, email, token, invited_by, expires_at, status, roles, voice_part, created_at, accepted_at
FROM invites;

-- Drop old table and rename new one
DROP TABLE invites;
ALTER TABLE invites_new RENAME TO invites;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);
