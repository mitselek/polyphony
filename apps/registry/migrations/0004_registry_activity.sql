-- Registry auth activity counters
-- Issue #277 — Track daily auth event counts

CREATE TABLE IF NOT EXISTS registry_activity (
    metric TEXT NOT NULL,
    date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (metric, date)
);

CREATE INDEX IF NOT EXISTS idx_registry_activity_date ON registry_activity(date);
