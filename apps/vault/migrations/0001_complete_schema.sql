-- Complete Vault Database Schema
-- Consolidated from production state as of 2026-01-26
-- Replaces broken incremental migrations (0001-0012)

-- Members table
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    voice_part TEXT CHECK (
        voice_part IS NULL OR (
            length(voice_part) BETWEEN 1 AND 4
            AND voice_part NOT GLOB '*[^SATB]*'
        )
    ),
    invited_by TEXT,
    joined_at TEXT DEFAULT (datetime('now'))
);

-- Member roles (multi-role support)
CREATE TABLE IF NOT EXISTS member_roles (
    member_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'librarian', 'conductor')),
    granted_at TEXT DEFAULT (datetime('now')),
    granted_by TEXT,
    PRIMARY KEY (member_id, role)
);

-- Scores metadata
CREATE TABLE IF NOT EXISTS scores (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    composer TEXT,
    arranger TEXT,
    license_type TEXT NOT NULL CHECK (license_type IN ('public_domain', 'licensed', 'owned', 'pending')),
    file_key TEXT NOT NULL,
    uploaded_by TEXT REFERENCES members(id),
    uploaded_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- Score files (binary storage, chunked if >2MB)
CREATE TABLE IF NOT EXISTS score_files (
    score_id TEXT PRIMARY KEY REFERENCES scores(id) ON DELETE CASCADE,
    data BLOB,
    size INTEGER NOT NULL,
    original_name TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    is_chunked INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER DEFAULT NULL
);

-- Score chunks (for files >2MB)
CREATE TABLE IF NOT EXISTS score_chunks (
    score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    data BLOB NOT NULL,
    size INTEGER NOT NULL,
    PRIMARY KEY (score_id, chunk_index)
);

-- Member invitations
CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    invited_by TEXT NOT NULL REFERENCES members(id),
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    roles TEXT NOT NULL DEFAULT '[]',
    voice_part TEXT CHECK (voice_part IN ('S', 'A', 'T', 'B', 'SA', 'AT', 'TB', 'SAT', 'ATB', 'SATB')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    accepted_at TEXT,
    accepted_by_email TEXT
);

-- Authentication sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copyright takedown requests
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

-- Access audit log
CREATE TABLE IF NOT EXISTS access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL REFERENCES members(id),
    score_id TEXT NOT NULL REFERENCES scores(id),
    action TEXT NOT NULL CHECK (action IN ('view', 'download')),
    accessed_at TEXT DEFAULT (datetime('now'))
);

-- Vault configuration settings
CREATE TABLE IF NOT EXISTS vault_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (updated_by) REFERENCES members(id) ON DELETE SET NULL
);

-- Events (rehearsals, concerts, etc.)
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('rehearsal', 'concert', 'retreat')),
    created_by TEXT NOT NULL REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Event programs (setlists)
CREATE TABLE IF NOT EXISTS event_programs (
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    added_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (event_id, score_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_member_roles_member ON member_roles(member_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_role ON member_roles(role);
CREATE INDEX IF NOT EXISTS idx_scores_title ON scores(title);
CREATE INDEX IF NOT EXISTS idx_scores_uploaded_by ON scores(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_score_chunks_score_id ON score_chunks(score_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);
CREATE INDEX IF NOT EXISTS idx_sessions_member ON sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_takedowns_score ON takedowns(score_id);
CREATE INDEX IF NOT EXISTS idx_takedowns_status ON takedowns(status);
CREATE INDEX IF NOT EXISTS idx_takedowns_created ON takedowns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_log_member ON access_log(member_id);
CREATE INDEX IF NOT EXISTS idx_access_log_score ON access_log(score_id);
CREATE INDEX IF NOT EXISTS idx_access_log_accessed_at ON access_log(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_event_programs_event ON event_programs(event_id);
CREATE INDEX IF NOT EXISTS idx_event_programs_score ON event_programs(score_id);

-- Default vault settings
INSERT OR IGNORE INTO vault_settings (key, value) VALUES ('default_voice_part', '');
INSERT OR IGNORE INTO vault_settings (key, value) VALUES ('default_event_duration', '120');
