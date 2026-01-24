-- Migration: 0001_initial.sql
-- Creates the core Registry database schema

-- Registered Vaults (for callback URL validation during auth flow)
CREATE TABLE IF NOT EXISTS vaults (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    callback_url TEXT NOT NULL,
    registered_at TEXT NOT NULL DEFAULT (datetime('now')),
    active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_vaults_active ON vaults(active);
CREATE INDEX IF NOT EXISTS idx_vaults_name ON vaults(name);

-- Signing keys for JWT tokens
CREATE TABLE IF NOT EXISTS signing_keys (
    id TEXT PRIMARY KEY,
    algorithm TEXT NOT NULL DEFAULT 'EdDSA',
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_signing_keys_active ON signing_keys(revoked_at);
