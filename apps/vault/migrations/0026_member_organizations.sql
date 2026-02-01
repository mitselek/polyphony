-- Migration 0026: Add member_organizations junction table (Schema V2)
-- Part of Epic #158: Multi-Organization Implementation
-- Issue #160: Add member_organizations junction table

-- Junction table linking members to organizations with org-specific data
CREATE TABLE IF NOT EXISTS member_organizations (
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    nickname TEXT,                     -- org-specific display name (optional)
    invited_by TEXT REFERENCES members(id) ON DELETE SET NULL,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (member_id, org_id)
);

-- Index for efficient org member lookups
CREATE INDEX IF NOT EXISTS idx_member_orgs_org ON member_organizations(org_id);

-- Index for efficient member org lookups
CREATE INDEX IF NOT EXISTS idx_member_orgs_member ON member_organizations(member_id);

-- Migrate existing members to Crede organization
-- Uses org_crede_001 from migration 0025
INSERT INTO member_organizations (member_id, org_id, nickname, invited_by, joined_at)
SELECT id, 'org_crede_001', nickname, invited_by, joined_at FROM members;
