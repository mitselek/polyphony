-- Migration: 0003_remove_vaults.sql
-- Remove vaults table (zero-storage: Registry queries Vault public APIs)
-- Issue #222

DROP TABLE IF EXISTS vaults;
