-- Who a campaign goes to, delivery tracking, and every email Resend counts.
--
-- audience_json: {"personalize": true|false, "emails": ["a@b.com", ...]}. The people Laura
--   picked before drafting; only they get it. '{}' (campaigns from before this) means everyone.
ALTER TABLE email_campaigns ADD COLUMN audience_json TEXT NOT NULL DEFAULT '{}';

-- What Resend's webhook last said about a sent email: delivered | delayed | bounced | complained
-- | opened | clicked. delivered_at and opened_at keep the first time each happened.
ALTER TABLE email_sends ADD COLUMN delivery_status TEXT;
ALTER TABLE email_sends ADD COLUMN delivered_at TEXT;
ALTER TABLE email_sends ADD COLUMN opened_at TEXT;
ALTER TABLE email_sends ADD COLUMN delivery_updated_at TEXT;
CREATE INDEX IF NOT EXISTS email_sends_by_provider ON email_sends (provider_id);

-- Emails sent outside a campaign (test emails, the Tuesday/Thursday reminders), so the
-- daily and monthly limits count everything Resend counts.
CREATE TABLE IF NOT EXISTS email_other_sends (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                  -- test | reminder
  sent_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS email_other_sends_by_time ON email_other_sends (sent_at);
