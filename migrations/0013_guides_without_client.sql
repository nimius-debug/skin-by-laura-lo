-- Guides can be made for someone who isn't a client (a friend, a sample):
-- client_id becomes optional and the person's name lives in the guide itself
-- (document_json.clientName). SQLite can't relax a NOT NULL column in place,
-- so the table is rebuilt with its rows copied over.
CREATE TABLE client_guides_new (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id),   -- NULL for a guide made without a client
  status TEXT NOT NULL DEFAULT 'draft',    -- draft | done
  document_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO client_guides_new (id, client_id, status, document_json, version, created_at, updated_at)
  SELECT id, client_id, status, document_json, version, created_at, updated_at FROM client_guides;
DROP TABLE client_guides;
ALTER TABLE client_guides_new RENAME TO client_guides;
CREATE INDEX IF NOT EXISTS client_guides_by_client ON client_guides (client_id, updated_at);
CREATE INDEX IF NOT EXISTS client_guides_by_update ON client_guides (updated_at);
