-- Participation tracking for events
CREATE TABLE IF NOT EXISTS participation (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  event_id TEXT NOT NULL,

  -- RSVP status (member sets this)
  planned_status TEXT CHECK(planned_status IN ('yes', 'no', 'maybe', 'late')),
  planned_at TEXT,
  planned_notes TEXT,

  -- Actual attendance (conductor records this)
  actual_status TEXT CHECK(actual_status IN ('present', 'absent', 'late')),
  recorded_at TEXT,
  recorded_by TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES members(id),

  UNIQUE(member_id, event_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_participation_member ON participation(member_id);
CREATE INDEX IF NOT EXISTS idx_participation_event ON participation(event_id);
CREATE INDEX IF NOT EXISTS idx_participation_planned ON participation(planned_status);
CREATE INDEX IF NOT EXISTS idx_participation_actual ON participation(actual_status);
