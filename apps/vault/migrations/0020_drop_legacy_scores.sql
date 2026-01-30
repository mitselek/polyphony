-- Drop legacy scores system tables
-- Data has been migrated to works/editions system

-- Drop indexes first
DROP INDEX IF EXISTS idx_score_chunks_score_id;
DROP INDEX IF EXISTS idx_access_log_score;
DROP INDEX IF EXISTS idx_access_log_member;
DROP INDEX IF EXISTS idx_access_log_accessed_at;

-- Drop tables
DROP TABLE IF EXISTS score_chunks;
DROP TABLE IF EXISTS score_files;
DROP TABLE IF EXISTS scores;
DROP TABLE IF EXISTS access_log;
