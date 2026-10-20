-- Email campaigns: one shared email per campaign, plus personal versions for clients whose notes or
-- purchases relate to the topic. Sent through Resend, at most a set number a day, from a queue.

CREATE TABLE IF NOT EXISTS email_campaigns (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,                 -- what Laura wrote or said
  goal TEXT NOT NULL DEFAULT 'book',   -- book | shop | news
  content_json TEXT NOT NULL,          -- the shared email: subject, headline, paragraphs, tips, product
  status TEXT NOT NULL DEFAULT 'review', -- review | sending | sent
  usage_json TEXT NOT NULL DEFAULT '{}', -- AI tokens used drafting it
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  send_started_at TEXT,
  sent_at TEXT
);

-- client_id NULL is the shared ("everyone else") version.
CREATE TABLE IF NOT EXISTS email_versions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES email_campaigns(id),
  client_id TEXT REFERENCES clients(id),
  reason TEXT NOT NULL DEFAULT '',     -- why this client got a personal version
  personal_json TEXT NOT NULL DEFAULT '{}', -- personal note and product, for personal versions
  status TEXT NOT NULL DEFAULT 'review',    -- review | approved | rejected
  feedback TEXT NOT NULL DEFAULT '',   -- what Laura asked to change on a redraft
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS email_versions_by_campaign ON email_versions (campaign_id);

-- One row per recipient. Queued rows go out in daily batches.
CREATE TABLE IF NOT EXISTS email_sends (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES email_campaigns(id),
  version_id TEXT NOT NULL REFERENCES email_versions(id),
  client_id TEXT,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued', -- queued | sent | failed
  provider_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  UNIQUE (campaign_id, email)
);
CREATE INDEX IF NOT EXISTS email_sends_by_status ON email_sends (status, sent_at);

CREATE TABLE IF NOT EXISTS email_unsubscribes (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Small key/value settings, such as the reminder switches.
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
