-- Migration 0010: Add vault settings table
-- Settings stored as key-value pairs with audit trail

CREATE TABLE vault_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (updated_by) REFERENCES members(id) ON DELETE SET NULL
);

-- Default settings
INSERT INTO vault_settings (key, value) VALUES
    ('default_voice_part', ''),
    ('default_event_duration', '120'),
    ('conductor_id', '');
