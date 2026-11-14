-- Responses imported from the old Google Forms (Forms → Import from Google Forms in the admin).
-- import_key identifies the original response (form, Google's timestamp, email or name), so importing
-- the same CSV again, or a newer one that still holds the old rows, never adds a response twice.
ALTER TABLE form_submissions ADD COLUMN import_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS form_submissions_by_import ON form_submissions (import_key) WHERE import_key IS NOT NULL;
