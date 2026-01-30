-- Email authentication codes (Issue #156)
-- Passwordless login via magic link + 6-character code

CREATE TABLE email_auth_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  vault_id TEXT NOT NULL,
  callback_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  UNIQUE(code)
);

CREATE INDEX idx_email_auth_codes_email ON email_auth_codes(email);
CREATE INDEX idx_email_auth_codes_code ON email_auth_codes(code);
CREATE INDEX idx_email_auth_codes_expires ON email_auth_codes(expires_at);

-- Rate limiting for email auth requests
-- 3 attempts per email per hour
CREATE TABLE email_rate_limits (
  email TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL DEFAULT (datetime('now'))
);
