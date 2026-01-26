-- Migration 0004: Remove deprecated default_voice_part setting
-- The voices/sections system (migration 0003) replaced the need for this global default
-- New members now have voices/sections assigned via invites or manual assignment

DELETE FROM vault_settings WHERE key = 'default_voice_part';
