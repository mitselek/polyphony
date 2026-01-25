-- Migration: 0008_update_invites_for_multirole.sql
-- Update invites table for multi-role support

-- Drop the old role column and add roles (JSON) and voice_part columns
ALTER TABLE invites DROP COLUMN role;
ALTER TABLE invites ADD COLUMN roles TEXT NOT NULL DEFAULT '[]'; -- JSON array of roles
ALTER TABLE invites ADD COLUMN voice_part TEXT CHECK (voice_part IN ('S', 'A', 'T', 'B', 'SA', 'AT', 'TB', 'SAT', 'ATB', 'SATB'));
