-- Migration 0035: Drop global unique index on member name
-- Name uniqueness is now enforced per-organization at the application level
-- via member_organizations JOIN, not globally across all orgs.
DROP INDEX IF EXISTS idx_members_name_lower;
