-- Migration 0034: Create member_preferences table
-- Part of Epic #183: Internationalization (i18n)
-- Issue #184: Database schema for language/locale/timezone

-- Member preferences for i18n overrides
-- Nullable columns allow fallback to organization defaults
CREATE TABLE IF NOT EXISTS member_preferences (
    member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    language TEXT,    -- ISO 639-1: 'et', 'en', 'de'
    locale TEXT,      -- BCP 47: 'et-EE', 'en-US'
    timezone TEXT,    -- IANA: 'Europe/Tallinn'
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Note: Index on member_id not strictly needed since it's the PRIMARY KEY,
-- but explicit for documentation purposes
CREATE INDEX IF NOT EXISTS idx_member_preferences_member ON member_preferences(member_id);
