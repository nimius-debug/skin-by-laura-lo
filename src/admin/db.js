// D1 queries for the client-notes admin area. This is the only part of the
// project with its own database — the shop catalog, prices, and checkout
// all still come live from Square, never from here.

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export async function listClients(env) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    `SELECT c.id, c.name, c.square_customer_id,
            (SELECT MAX(note_date) FROM notes WHERE client_id = c.id) AS last_note_date
     FROM clients c
     ORDER BY c.name COLLATE NOCASE`,
  ).all();
  return results;
}

export async function getClient(env, clientId) {
  return env.CLIENT_NOTES_DB.prepare("SELECT * FROM clients WHERE id = ?").bind(clientId).first();
}

/**
 * Clients only ever come from a Square sync, never a hand-typed form — this
 * is called once per distinct customer found in a sync run. Idempotent:
 * re-syncing a customer we already have updates their name (in case it
 * changed in Square) rather than creating a second row.
 */
export async function upsertClientFromSquare(env, { squareCustomerId, name }) {
  await env.CLIENT_NOTES_DB.prepare(
    `INSERT INTO clients (id, name, square_customer_id) VALUES (?, ?, ?)
     ON CONFLICT (square_customer_id) DO UPDATE SET name = excluded.name`,
  ).bind(newId("client"), name, squareCustomerId).run();

  const row = await env.CLIENT_NOTES_DB.prepare(
    "SELECT id FROM clients WHERE square_customer_id = ?",
  ).bind(squareCustomerId).first();
  return row.id;
}

export async function listNotesForClient(env, clientId) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    `SELECT id, note_date, summary, extracted_text, confidence, source, pdf_key, created_at
     FROM notes WHERE client_id = ?
     ORDER BY (note_date IS NULL), note_date DESC, created_at DESC`,
  ).bind(clientId).all();
  return results;
}

/**
 * A booking's seller_note, pulled in from a Square sync alongside the
 * client it belongs to. Keyed by the booking id so a later re-sync updates
 * the same note (in case Laura edited the seller note in Square since)
 * instead of inserting a duplicate.
 */
export async function upsertSellerNote(env, clientId, { bookingId, date, text }) {
  await env.CLIENT_NOTES_DB.prepare(
    `INSERT INTO notes (id, client_id, note_date, summary, extracted_text, confidence, source, source_booking_id)
     VALUES (?, ?, ?, ?, ?, 'high', 'square', ?)
     ON CONFLICT (source_booking_id) DO UPDATE SET note_date = excluded.note_date, summary = excluded.summary, extracted_text = excluded.extracted_text`,
  ).bind(newId("note"), clientId, date, text, text, bookingId).run();
}

/** Laura's own correction of a note's summary — the only field she edits directly in the dashboard. */
export async function updateNoteSummary(env, noteId, summary) {
  await env.CLIENT_NOTES_DB.prepare(
    "UPDATE notes SET summary = ? WHERE id = ?",
  ).bind(summary, noteId).run();
}

/** All page hashes already recorded for this client, across every notebook they've ever had. */
export async function knownPageHashes(env, clientId) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    "SELECT page_hash FROM note_pages WHERE client_id = ?",
  ).bind(clientId).all();
  return results.map((row) => row.page_hash);
}

/**
 * Save a draft set of proposed note entries from one upload, pending
 * Laura's review. `id` must be the same id the caller already used to name
 * the draft's R2 objects — generated here instead, it would never match
 * what the client is told to confirm against.
 */
export async function saveDraft(env, id, clientId, { entries, missingHashes }) {
  await env.CLIENT_NOTES_DB.prepare(
    "INSERT INTO note_drafts (id, client_id, entries_json, missing_page_hashes_json) VALUES (?, ?, ?, ?)",
  ).bind(id, clientId, JSON.stringify(entries), JSON.stringify(missingHashes)).run();
}

export async function getDraft(env, draftId) {
  const row = await env.CLIENT_NOTES_DB.prepare("SELECT * FROM note_drafts WHERE id = ?").bind(draftId).first();
  if (!row) return null;
  return {
    ...row,
    entries: JSON.parse(row.entries_json),
    missingHashes: JSON.parse(row.missing_page_hashes_json),
  };
}

export async function deleteDraft(env, draftId) {
  await env.CLIENT_NOTES_DB.prepare("DELETE FROM note_drafts WHERE id = ?").bind(draftId).run();
}

/**
 * Commit a reviewed draft: one row per confirmed entry in `notes`, plus
 * every new page's hash recorded in the dedup ledger so it's never
 * reprocessed on a future upload. Entries the caller omitted (Laura can
 * discard a proposed entry before saving) simply aren't written.
 *
 * Each entry must already carry an `id` — the caller assigns it before
 * calling this, because the final R2 object key is named after the note id
 * and that file has to exist before this row pointing at it is written.
 */
export async function commitNoteEntries(env, clientId, entries) {
  const statements = [];

  for (const entry of entries) {
    statements.push(
      env.CLIENT_NOTES_DB.prepare(
        `INSERT INTO notes (id, client_id, note_date, summary, extracted_text, confidence, pdf_key)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(entry.id, clientId, entry.date, entry.summary, entry.text, entry.confidence, entry.pdfKey),
    );
    for (const hash of entry.pageHashes) {
      statements.push(
        env.CLIENT_NOTES_DB.prepare(
          "INSERT OR REPLACE INTO note_pages (client_id, page_hash, note_id) VALUES (?, ?, ?)",
        ).bind(clientId, hash, entry.id),
      );
    }
  }

  if (statements.length) await env.CLIENT_NOTES_DB.batch(statements);
  return entries.map((entry) => entry.id);
}
