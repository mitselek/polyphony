-- Migration: 0001_initial.sql
-- Creates the core tables for Vault: members, scores, access_log

-- Members table: choir members with roles
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'singer' CHECK (role IN ('admin', 'librarian', 'singer')),
    invited_by TEXT REFERENCES members(id),
    joined_at TEXT DEFAULT (datetime('now'))
);

-- Scores table: sheet music metadata (PDFs stored in R2)
CREATE TABLE IF NOT EXISTS scores (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    composer TEXT,
    arranger TEXT,
    license_type TEXT NOT NULL CHECK (license_type IN ('public_domain', 'licensed', 'owned', 'pending')),
    file_key TEXT NOT NULL,
    uploaded_by TEXT REFERENCES members(id),
    uploaded_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT  -- Soft delete for takedown requests
);

-- Access log: audit trail for score access
CREATE TABLE IF NOT EXISTS access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL REFERENCES members(id),
    score_id TEXT NOT NULL REFERENCES scores(id),
    action TEXT NOT NULL CHECK (action IN ('view', 'download')),
    accessed_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_scores_uploaded_by ON scores(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_scores_title ON scores(title);
CREATE INDEX IF NOT EXISTS idx_access_log_member ON access_log(member_id);
CREATE INDEX IF NOT EXISTS idx_access_log_score ON access_log(score_id);
CREATE INDEX IF NOT EXISTS idx_access_log_accessed_at ON access_log(accessed_at DESC);
