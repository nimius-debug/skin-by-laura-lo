-- Sending a campaign through Square Marketing by hand, instead of (or as well as) Resend.
--
-- square_json: {"mode": "square"|"split", "groupId", "groupName", "customerIds": [...],
--   "added": n, "resendEmails": [...], "syncedAt", "sentAt"}. The admin puts the people in a
--   Square customer group; Laura sends the campaign to that group in Square Marketing.
--   NULL means the campaign goes through Resend only.
ALTER TABLE email_campaigns ADD COLUMN square_json TEXT;
