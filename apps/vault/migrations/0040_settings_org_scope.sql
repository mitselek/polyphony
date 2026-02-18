-- Migration 0040: Add org_id to vault_settings for multi-org isolation (#233)
--
-- vault_settings currently has PRIMARY KEY (key) which means all orgs share
-- the same settings namespace. This migration adds org_id so each org has
-- its own settings.
--
-- Existing rows get assigned to the first organization found (there's only
-- one org in production that has settings). If no orgs exist, rows are dropped.

-- Step 1: Create new table with org_id in composite primary key
CREATE TABLE vault_settings_new (
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_by TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (org_id, key),
    FOREIGN KEY (updated_by) REFERENCES members(id) ON DELETE SET NULL
);

-- Step 2: Migrate existing rows — assign to the oldest organization
INSERT INTO vault_settings_new (org_id, key, value, updated_by, updated_at)
SELECT
    (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1),
    key, value, updated_by, updated_at
FROM vault_settings
WHERE (SELECT COUNT(*) FROM organizations) > 0;

-- Step 3: Swap tables
DROP TABLE vault_settings;
ALTER TABLE vault_settings_new RENAME TO vault_settings;
