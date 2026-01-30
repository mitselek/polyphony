-- Migration: Drop legacy event_programs table
-- Issue #149: Replaced by event_works + event_work_editions (Issue #121)

-- Drop the legacy event_programs table
DROP TABLE IF EXISTS event_programs;
