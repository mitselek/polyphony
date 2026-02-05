-- Migration 0033: Add i18n columns to organizations table
-- Part of Epic #183: Internationalization (i18n)
-- Issue #184: Database schema for language/locale/timezone

-- Add language, locale, timezone columns to organizations
-- All nullable to allow fallback to system defaults
ALTER TABLE organizations ADD COLUMN language TEXT;  -- ISO 639-1: 'et', 'en', 'de'
ALTER TABLE organizations ADD COLUMN locale TEXT;    -- BCP 47: 'et-EE', 'en-US'
ALTER TABLE organizations ADD COLUMN timezone TEXT;  -- IANA: 'Europe/Tallinn'

-- Update existing organization with Estonian defaults
UPDATE organizations SET 
    language = 'et',
    locale = 'et-EE',
    timezone = 'Europe/Tallinn'
WHERE subdomain = 'crede';
