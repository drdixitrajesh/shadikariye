CREATE TABLE IF NOT EXISTS submission_access (
  owner TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL
);
