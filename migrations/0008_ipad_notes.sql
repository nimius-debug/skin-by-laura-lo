-- Notes written by hand on the iPad (notes.source = 'ipad').
--
-- fields_json: the four sheet sections as read from the handwriting and checked by Laura,
--   {"Treatment type": "...", "Notes / remarks": "...", ...}. Shown like the Excel sheet's
--   cells, and read by the AI insight, the safety check and the email matching.
-- ink_key: R2 key of the pen strokes (JSON), so the handwriting can be redrawn or edited later.
--   pdf_key holds the page as she wrote it, for "View handwriting".
ALTER TABLE notes ADD COLUMN fields_json TEXT;
ALTER TABLE notes ADD COLUMN ink_key TEXT;
