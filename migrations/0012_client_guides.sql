-- Skincare Guides drafted for a client from what she bought (src/admin/guides/).
-- document_json holds the pages as positioned boxes on an A4 sheet (794 x 1123),
-- the way the editor shows them. version goes up by one on every save, so two
-- open tabs can't silently overwrite each other.
CREATE TABLE IF NOT EXISTS client_guides (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | done
  document_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS client_guides_by_client ON client_guides (client_id, updated_at);
