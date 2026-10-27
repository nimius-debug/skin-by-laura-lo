-- Client consultation notes — editorial/clinical data that has nowhere to
-- live in Square. This is the first real database this project uses; the
-- shop catalog, prices and checkout all still come live from Square, never
-- from here.
--
-- Clients are never created by hand: a client only exists here because a
-- "Sync from Square" run found a past, ACCEPTED booking for that Square
-- customer. square_customer_id is therefore required and unique — every
-- client row IS a Square customer, by construction, not something matched
-- up after the fact.

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  square_customer_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  -- ISO yyyy-mm-dd. Null when no legible date was found — surfaced to
  -- Laura as "no date detected", never defaulted to today.
  note_date TEXT,
  summary TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  -- 'high' | 'low'. Low confidence (illegible handwriting, parse failure)
  -- is shown with a visible flag in the dashboard rather than hidden.
  confidence TEXT NOT NULL DEFAULT 'high',
  -- 'noteful' | 'square'. Shown in the dashboard so the source of a note is
  -- always clear — a Noteful scan and a Square booking's seller note are
  -- read very differently (one's an AI transcription of handwriting, the
  -- other is Laura's own typed text).
  source TEXT NOT NULL DEFAULT 'noteful',
  -- R2 key for the sliced original covering just this note's page(s).
  -- Null for a 'square' note — a seller note has no scanned original.
  pdf_key TEXT,
  -- The Square booking this note came from, for 'square' notes only. Lets a
  -- re-sync update the note if the seller note was edited in Square since,
  -- instead of inserting a duplicate.
  source_booking_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX notes_client_idx ON notes (client_id, note_date);

-- The dedup ledger for Noteful uploads only. One row per page we've ever
-- processed for a client, keyed by a structural hash of that page's
-- content — not its position in the file, which can shift if Noteful
-- reorders or inserts pages, and not by a page count, which breaks the
-- same way. A page whose hash is already here on a later upload is
-- skipped; one that's missing on a later upload (a page we'd seen before
-- that the new export no longer contains) is a red flag surfaced to
-- Laura, not a silent delete.
CREATE TABLE note_pages (
  client_id TEXT NOT NULL REFERENCES clients(id),
  page_hash TEXT NOT NULL,
  note_id TEXT REFERENCES notes(id),
  seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (client_id, page_hash)
);

-- A Noteful upload goes through a short-lived draft before Laura confirms
-- it, so the review-before-save step has something to hold onto between
-- the "read this file" request and the "save it" request, and a closed tab
-- before confirming just leaves an expired draft rather than a half-written
-- note.
CREATE TABLE note_drafts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  -- JSON: the proposed note entries (date, summary, text, confidence,
  -- page_hashes, draftPdfKey) from one upload, before Laura reviews/edits them.
  entries_json TEXT NOT NULL,
  -- JSON: page hashes that were already seen before but are missing from
  -- this upload — surfaced once at confirm time, never silently dropped.
  missing_page_hashes_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
