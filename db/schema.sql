DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS statement_logs;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS categories;

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY,
  gemini_api_key TEXT,
  insights_cache TEXT,
  insights_updated_at TEXT
);

CREATE TABLE statement_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  statement_id INTEGER REFERENCES statement_logs(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_statement_logs_user_id ON statement_logs(user_id);
