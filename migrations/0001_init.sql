PRAGMA foreign_keys = ON;

-- USERS / AUTH
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE api_keys (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE,
  key_hash   TEXT NOT NULL UNIQUE,
  key_encrypted TEXT,
  key_iv     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- HABITS
CREATE TABLE habits (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, name)
);
CREATE INDEX idx_habits_user_order ON habits(user_id, active, sort_order);

CREATE TABLE habit_entries (
  habit_id    TEXT NOT NULL,
  day         TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (habit_id, day),
  FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);
CREATE INDEX idx_habit_entries_day ON habit_entries(day);

-- TRACKABLES
CREATE TABLE trackables (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  unit        TEXT,
  min_value   INTEGER NOT NULL DEFAULT 1,
  max_value   INTEGER,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, name)
);
CREATE INDEX idx_trackables_user_order ON trackables(user_id, active, sort_order);

CREATE TABLE trackable_entries (
  trackable_id TEXT NOT NULL,
  day          TEXT NOT NULL,
  value        INTEGER NOT NULL CHECK (value > 0),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (trackable_id, day),
  FOREIGN KEY (trackable_id) REFERENCES trackables(id) ON DELETE CASCADE
);
CREATE INDEX idx_trackable_entries_day ON trackable_entries(day);
