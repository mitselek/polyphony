-- Rename score_id → edition_id in event_programs table
-- Part of Epic #106 - Cleanup from legacy scores system (#135)

-- Rename the column
ALTER TABLE event_programs RENAME COLUMN score_id TO edition_id;

-- Drop old index and create new one with correct name
DROP INDEX IF EXISTS idx_event_programs_score;
CREATE INDEX idx_event_programs_edition ON event_programs(edition_id);

-- Update foreign key to point to editions table instead of scores
-- Note: SQLite doesn't support ALTER CONSTRAINT, so we need to recreate the table
-- However, since scores table was already dropped (0020), the FK is orphaned anyway
-- The new FK will be enforced at application level until table is recreated
