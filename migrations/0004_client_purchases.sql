-- A copy of each client's completed Square orders, so the client page doesn't re-read Square on every view,
-- keeps working if Square is briefly unreachable, and can show what she paid. Square stays the source of truth:
-- the copy is replaced from Square when it is more than an hour old or when "Refresh from Square" is clicked.
CREATE TABLE IF NOT EXISTS client_orders (
  order_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  ordered_at TEXT NOT NULL,
  total_cents INTEGER NOT NULL DEFAULT 0,
  tip_cents INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS client_orders_by_client ON client_orders (client_id, ordered_at);

CREATE TABLE IF NOT EXISTS client_order_lines (
  order_id TEXT NOT NULL REFERENCES client_orders(order_id),
  line_uid TEXT NOT NULL,
  catalog_object_id TEXT,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_cents INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (order_id, line_uid)
);

CREATE TABLE IF NOT EXISTS client_purchase_syncs (
  client_id TEXT PRIMARY KEY REFERENCES clients(id),
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
