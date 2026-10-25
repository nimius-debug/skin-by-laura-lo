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
    `SELECT id, note_date, summary, extracted_text, confidence, client_id, source, pdf_key, source_submission_id, fields_json, ink_key, created_at
     FROM notes WHERE client_id = ?
     ORDER BY (note_date IS NULL), note_date DESC, created_at DESC`,
  ).bind(clientId).all();
  return results;
}

// D1 allows 100 bound parameters per statement, so rows are inserted in chunks.
function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * The stored copy of a client's Square orders (newest first, normalised) and
 * when it was copied, or null if it was never copied. Fails soft: a missing
 * table just means "nothing stored", and the page reads Square instead.
 */
export async function getStoredOrders(env, clientId) {
  try {
    const sync = await env.CLIENT_NOTES_DB.prepare(
      "SELECT synced_at FROM client_purchase_syncs WHERE client_id = ?",
    ).bind(clientId).first();
    if (!sync) return null;

    const { results: orderRows } = await env.CLIENT_NOTES_DB.prepare(
      "SELECT order_id, ordered_at, total_cents, tip_cents FROM client_orders WHERE client_id = ? ORDER BY ordered_at DESC",
    ).bind(clientId).all();
    const { results: lineRows } = await env.CLIENT_NOTES_DB.prepare(
      `SELECT l.order_id, l.line_uid, l.catalog_object_id, l.name, l.quantity, l.total_cents
       FROM client_order_lines l JOIN client_orders o ON o.order_id = l.order_id WHERE o.client_id = ?`,
    ).bind(clientId).all();

    const linesByOrder = new Map();
    for (const line of lineRows) {
      if (!linesByOrder.has(line.order_id)) linesByOrder.set(line.order_id, []);
      linesByOrder.get(line.order_id).push({
        uid: line.line_uid, catalogObjectId: line.catalog_object_id, name: line.name,
        quantity: line.quantity, totalCents: line.total_cents,
      });
    }
    return {
      orders: orderRows.map((row) => ({
        id: row.order_id, createdAt: row.ordered_at, totalCents: row.total_cents, tipCents: row.tip_cents,
        lines: linesByOrder.get(row.order_id) || [],
      })),
      syncedAt: `${sync.synced_at.replace(" ", "T")}Z`,
    };
  } catch (error) {
    console.error("Reading stored orders failed:", error.message);
    return null;
  }
}

/**
 * Replace a client's stored orders with a fresh copy from Square. One batch is
 * one transaction, so a failure leaves the previous copy untouched. A failure
 * here must not break the page the orders were just read for.
 */
export async function replaceStoredOrders(env, clientId, orders) {
  try {
    const db = env.CLIENT_NOTES_DB;
    const statements = [
      db.prepare("DELETE FROM client_order_lines WHERE order_id IN (SELECT order_id FROM client_orders WHERE client_id = ?)").bind(clientId),
      db.prepare("DELETE FROM client_orders WHERE client_id = ?").bind(clientId),
    ];
    for (const group of chunks(orders, 19)) {
      statements.push(db.prepare(
        `INSERT INTO client_orders (order_id, client_id, ordered_at, total_cents, tip_cents) VALUES ${group.map(() => "(?, ?, ?, ?, ?)").join(", ")}`,
      ).bind(...group.flatMap((order) => [order.id, clientId, order.createdAt, order.totalCents, order.tipCents])));
    }
    const lines = orders.flatMap((order) => order.lines.map((line) => ({ ...line, orderId: order.id })));
    for (const group of chunks(lines, 16)) {
      statements.push(db.prepare(
        `INSERT INTO client_order_lines (order_id, line_uid, catalog_object_id, name, quantity, total_cents) VALUES ${group.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}`,
      ).bind(...group.flatMap((line) => [line.orderId, line.uid, line.catalogObjectId, line.name, line.quantity, line.totalCents])));
    }
    statements.push(db.prepare(
      "INSERT INTO client_purchase_syncs (client_id, synced_at) VALUES (?, datetime('now')) ON CONFLICT (client_id) DO UPDATE SET synced_at = datetime('now')",
    ).bind(clientId));
    await db.batch(statements);
  } catch (error) {
    console.error("Saving client orders failed:", error.message);
  }
}

/**
 * The saved AI summary for a client, or null. Fails soft: if the table is
 * missing or the row is unreadable the page just behaves as if nothing is saved.
 */
export async function getSavedSummary(env, clientId) {
  try {
    const row = await env.CLIENT_NOTES_DB.prepare(
      "SELECT input_hash, summary_json, model, created_at FROM client_summaries WHERE client_id = ?",
    ).bind(clientId).first();
    if (!row) return null;
    return { hash: row.input_hash, summary: JSON.parse(row.summary_json), model: row.model, createdAt: row.created_at };
  } catch (error) {
    console.error("Reading saved summary failed:", error.message);
    return null;
  }
}

/** Keep the latest summary for a client. A failure here must not lose the summary the user just paid for. */
export async function saveSummary(env, clientId, { hash, summary, model }) {
  try {
    await env.CLIENT_NOTES_DB.prepare(
      `INSERT INTO client_summaries (client_id, input_hash, summary_json, model) VALUES (?, ?, ?, ?)
       ON CONFLICT (client_id) DO UPDATE SET input_hash = excluded.input_hash, summary_json = excluded.summary_json,
         model = excluded.model, created_at = datetime('now')`,
    ).bind(clientId, hash, JSON.stringify(summary), model).run();
  } catch (error) {
    console.error("Saving summary failed:", error.message);
  }
}

/** The original Google Drive files a client's notes were imported from, for download on their profile. */
export async function listSourceFiles(env, clientId) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    "SELECT file_name, drive_id FROM client_source_files WHERE client_id = ? ORDER BY file_name",
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

/**
 * A note handwritten on the iPad, once Laura has checked what was read. Its page (pdfKey) and
 * pen strokes (inkKey) must already be at their final R2 keys, named after the note id.
 */
export async function commitInkNote(env, clientId, { id, date, summary, text, fields, confidence, pdfKey, inkKey }) {
  await env.CLIENT_NOTES_DB.prepare(
    `INSERT INTO notes (id, client_id, note_date, summary, extracted_text, confidence, source, pdf_key, fields_json, ink_key)
     VALUES (?, ?, ?, ?, ?, ?, 'ipad', ?, ?, ?)`,
  ).bind(id, clientId, date, summary, text, confidence, pdfKey, JSON.stringify(fields), inkKey).run();
  return id;
}

/** A note handwritten on the iPad, rewritten after she edits it. Its files keep their keys. */
export async function updateInkNote(env, noteId, { date, summary, text, fields, confidence }) {
  await env.CLIENT_NOTES_DB.prepare(
    `UPDATE notes SET note_date = ?, summary = ?, extracted_text = ?, fields_json = ?, confidence = ? WHERE id = ? AND source = 'ipad'`,
  ).bind(date, summary, text, JSON.stringify(fields), confidence, noteId).run();
}

export async function getNote(env, noteId) {
  return env.CLIENT_NOTES_DB.prepare("SELECT * FROM notes WHERE id = ?").bind(noteId).first();
}

/** R2 keys a draft holds: an upload's pages, or an iPad note's page and strokes. */
export function draftObjectKeys(entries) {
  return (entries || [])
    .flatMap((entry) => [entry.draftPdfKey, entry.pdfKey, entry.inkKey, ...Object.values(entry.imageKeys || {})])
    .filter((key) => typeof key === "string" && key.startsWith("drafts/"));
}

/**
 * Remove drafts nobody saved: a closed tab, or Done tapped again on the iPad. Their files are
 * deleted from R2 first, so a failure leaves the row to try again next time.
 */
export async function deleteStaleDrafts(env, { olderThanHours = 24, limit = 50 } = {}) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    "SELECT id, entries_json FROM note_drafts WHERE created_at < datetime('now', ?) ORDER BY created_at LIMIT ?",
  ).bind(`-${olderThanHours} hours`, limit).all();
  for (const row of results) {
    let entries = [];
    try { entries = JSON.parse(row.entries_json); } catch { /* nothing to delete */ }
    const keys = draftObjectKeys(entries);
    if (keys.length) await env.NOTES_BUCKET.delete(keys);
    await deleteDraft(env, row.id);
  }
  return results.length;
}
