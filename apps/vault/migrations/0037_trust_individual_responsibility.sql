-- Migration: Add trust_individual_responsibility setting to organizations
-- Issue #240: Allow org admins to delegate RSVP/attendance management to members

ALTER TABLE organizations ADD COLUMN trust_individual_responsibility INTEGER NOT NULL DEFAULT 0;
