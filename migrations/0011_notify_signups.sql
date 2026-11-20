-- "Email me when it starts" sign-ups on the Black Friday homepage (src/notify.js).
-- One row per address per list; notified_at is set once the email went out.
-- ip_hash is a one-way hash of the sign-up's IP address, only used to stop one
-- visitor from adding hundreds of addresses.
CREATE TABLE IF NOT EXISTS notify_signups (
  list TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ip_hash TEXT,
  notified_at TEXT,
  provider_id TEXT,
  error TEXT,
  PRIMARY KEY (list, email)
);
CREATE INDEX IF NOT EXISTS notify_signups_by_ip ON notify_signups (ip_hash, created_at);
