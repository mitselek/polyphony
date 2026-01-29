-- Migration 0012: Add nickname field to members
-- Used for compact display in roster and other space-constrained views

ALTER TABLE members ADD COLUMN nickname TEXT;

-- Index for lookups (optional, but useful if searching by nickname)
CREATE INDEX idx_members_nickname ON members(nickname) WHERE nickname IS NOT NULL;
