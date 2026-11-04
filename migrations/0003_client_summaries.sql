-- The last AI summary for each client, so it isn't paid for again until something it depends on changes.
-- input_hash is a SHA-256 of the model and the full prompt (notes, purchases, ingredient lists, flags).
CREATE TABLE IF NOT EXISTS client_summaries (
  client_id TEXT PRIMARY KEY REFERENCES clients(id),
  input_hash TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
