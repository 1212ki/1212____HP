CREATE TABLE IF NOT EXISTS site_data (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS x_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  live_id TEXT NOT NULL,
  status TEXT NOT NULL,
  tweet_id TEXT,
  tweet_url TEXT,
  tweet_text TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_x_posts_live_id_created_at
ON x_posts (live_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_reservations (
  id TEXT PRIMARY KEY,
  live_id TEXT NOT NULL,
  live_date TEXT,
  live_venue TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  message TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_reservations_live_id_created_at
ON ticket_reservations (live_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_reservations_status_created_at
ON ticket_reservations (status, created_at DESC);
