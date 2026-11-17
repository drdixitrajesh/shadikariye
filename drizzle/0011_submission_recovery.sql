CREATE TABLE IF NOT EXISTS submission_recovery_requests (
  owner TEXT PRIMARY KEY NOT NULL,
  requested_at INTEGER NOT NULL,
  resolved_at INTEGER,
  reviewed_by TEXT
);
