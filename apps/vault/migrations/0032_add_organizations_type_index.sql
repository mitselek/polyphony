-- Migration: Add missing idx_organizations_type index
-- Fixes #180 - index was in SCHEMA-V2-EVOLUTION.md spec but missing from 0025_organizations.sql
-- 
-- This index supports queries like:
-- - "find all umbrella organizations"
-- - "find all collectives"

CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);
