-- Trackables table
CREATE TABLE IF NOT EXISTS trackables (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  value_type TEXT NOT NULL,
  config_json TEXT NOT NULL,
  icon TEXT NULL,
  color TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT NULL
);

-- Daily entries table
CREATE TABLE IF NOT EXISTS daily_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trackable_id TEXT NOT NULL REFERENCES trackables(id),
  date TEXT NOT NULL,
  value_type TEXT NOT NULL,
  value_bool INTEGER NULL,
  value_int INTEGER NULL,
  value_num REAL NULL,
  value_text TEXT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(trackable_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON daily_entries(date);
CREATE INDEX IF NOT EXISTS idx_daily_entries_trackable_date ON daily_entries(trackable_id, date);
