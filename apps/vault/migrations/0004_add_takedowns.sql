-- Migration: 0004_add_takedowns.sql
-- Creates the takedowns table for copyright claims

CREATE TABLE IF NOT EXISTS takedowns (
    id TEXT PRIMARY KEY,
    score_id TEXT NOT NULL REFERENCES scores(id),
    claimant_name TEXT NOT NULL,
    claimant_email TEXT NOT NULL,
    reason TEXT NOT NULL,
    attestation INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT,
    processed_by TEXT REFERENCES members(id),
    resolution_notes TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_takedowns_status ON takedowns(status);
CREATE INDEX IF NOT EXISTS idx_takedowns_score ON takedowns(score_id);
CREATE INDEX IF NOT EXISTS idx_takedowns_created ON takedowns(created_at DESC);
