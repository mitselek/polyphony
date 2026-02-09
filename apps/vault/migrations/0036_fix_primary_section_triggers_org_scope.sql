-- Migration: Fix primary section triggers to be org-scoped
-- Issue: Current triggers clear ALL primary sections for a member globally
-- Fix: Only clear primary sections within the same organization
-- Created: 2025-06-15

-- Drop old triggers
DROP TRIGGER IF EXISTS enforce_single_primary_section;
DROP TRIGGER IF EXISTS enforce_single_primary_section_update;

-- Recreate triggers with org-scoping
-- When inserting a new primary section, clear other primaries ONLY in the same org
CREATE TRIGGER IF NOT EXISTS enforce_single_primary_section
BEFORE INSERT ON member_sections
WHEN NEW.is_primary = 1
BEGIN
    UPDATE member_sections
    SET is_primary = 0
    WHERE member_id = NEW.member_id
      AND section_id IN (
          SELECT s1.id 
          FROM sections s1
          JOIN sections s2 ON s1.org_id = s2.org_id
          WHERE s2.id = NEW.section_id
      );
END;

-- When updating an existing member_section to primary, clear other primaries in same org
CREATE TRIGGER IF NOT EXISTS enforce_single_primary_section_update
BEFORE UPDATE OF is_primary ON member_sections
WHEN NEW.is_primary = 1
BEGIN
    UPDATE member_sections
    SET is_primary = 0
    WHERE member_id = NEW.member_id
      AND section_id IN (
          SELECT s1.id 
          FROM sections s1
          JOIN sections s2 ON s1.org_id = s2.org_id
          WHERE s2.id = NEW.section_id
      );
END;
