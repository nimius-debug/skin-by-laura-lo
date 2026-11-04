-- Client forms (the intake forms on the public site, /forms/...). Each submission is kept whole,
-- exactly as the client sent it, and linked to a client when we can tell who she is.
--
-- Linking: on arrival the email (then phone) is looked up in Square. A Square customer who is
-- already a client links straight away. A Square customer with no completed booking yet is kept
-- in square_customer_id and linked by the next "Sync from Square" that adds her as a client.
-- Anyone else waits for Laura to pick the client by hand.
--
-- Once linked, the submission is also written as a note (notes.source = 'form'), so the AI
-- insight, the safety check and the email matching read it like any other note.

CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  form_slug TEXT NOT NULL,              -- which form, from src/forms/definitions.js
  form_version INTEGER NOT NULL,
  client_id TEXT REFERENCES clients(id),
  square_customer_id TEXT,              -- the Square customer her email or phone matched, if any
  link_method TEXT,                     -- square | sync | manual, once linked
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  answers_json TEXT NOT NULL,           -- answers by question id
  display_json TEXT NOT NULL,           -- the questions and answers as she saw them, for the admin
  note_text TEXT NOT NULL,              -- the answers that matter for her care, as note lines
  status TEXT NOT NULL DEFAULT 'new',   -- new | reviewed
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS form_submissions_by_form ON form_submissions (form_slug, submitted_at);
CREATE INDEX IF NOT EXISTS form_submissions_by_client ON form_submissions (client_id, submitted_at);
CREATE INDEX IF NOT EXISTS form_submissions_waiting ON form_submissions (square_customer_id) WHERE client_id IS NULL;

-- The note a linked submission is written as. One note per submission, so relinking moves it.
ALTER TABLE notes ADD COLUMN source_submission_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS notes_by_submission ON notes (source_submission_id) WHERE source_submission_id IS NOT NULL;
