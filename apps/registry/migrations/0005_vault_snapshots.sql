-- Registry vault snapshot storage
-- Issue #276 — Store daily Vault stats snapshots

CREATE TABLE IF NOT EXISTS vault_snapshots (
    date TEXT PRIMARY KEY,
    member_count INTEGER NOT NULL DEFAULT 0,
    org_count INTEGER NOT NULL DEFAULT 0,
    works_count INTEGER NOT NULL DEFAULT 0,
    editions_count INTEGER NOT NULL DEFAULT 0,
    total_file_size INTEGER NOT NULL DEFAULT 0,
    events_today TEXT NOT NULL DEFAULT '{}',
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
