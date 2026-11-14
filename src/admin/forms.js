// Client form submissions: saving what arrives from the public site, linking
// each one to a client, and writing a linked submission into her notes so the
// insight, the safety check and the email matching all take it into account.
// The table is described in migrations/0007_form_submissions.sql.

import { squareFetch, squareGet, isConfigured } from "../square.js";
import { newId } from "./db.js";
import { formBySlug } from "../forms/definitions.js";
import { contactOf, describeSubmission, noteFromSubmission } from "../forms/engine.js";
import { importedView, readGoogleResponses } from "../forms/google-import.js";

const DB = (env) => env.CLIENT_NOTES_DB;

/** A US phone number as Square stores it (+15551234567), or "" when it can't be read as one. */
export function e164(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (String(phone || "").trim().startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

async function searchCustomers(env, filter) {
  const payload = await squareFetch(env, "/v2/customers/search", { limit: 2, query: { filter } });
  return payload.customers || [];
}

/**
 * The Square customer this email or phone belongs to, or null. Only a single,
 * unambiguous match counts: two customers on one phone (a parent booking for a
 * daughter, say) is left for Laura to pick.
 */
export async function findSquareCustomer(env, { email, phone }) {
  if (!isConfigured(env)) return null;
  if (email) {
    const byEmail = await searchCustomers(env, { email_address: { exact: email } });
    if (byEmail.length === 1) return byEmail[0].id;
    if (byEmail.length > 1) return null;
  }
  const number = e164(phone);
  if (number) {
    const byPhone = await searchCustomers(env, { phone_number: { exact: number } });
    if (byPhone.length === 1) return byPhone[0].id;
  }
  return null;
}

/** The calendar day in Tampa, for the note's date. */
function tampaDate(when) {
  return new Date(when).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function noteStatements(env, submission, clientId) {
  const db = DB(env);
  const date = tampaDate(`${submission.submitted_at.replace(" ", "T")}Z`);
  return [
    db.prepare("DELETE FROM notes WHERE source_submission_id = ?").bind(submission.id),
    db.prepare(
      `INSERT INTO notes (id, client_id, note_date, summary, extracted_text, confidence, source, source_submission_id)
       VALUES (?, ?, ?, ?, ?, 'high', 'form', ?)`,
    ).bind(newId("note"), clientId, date, submission.note_text, submission.note_text, submission.id),
  ];
}

/** Link a submission to a client and write it into her notes, replacing any earlier link. */
export async function linkSubmission(env, submissionId, clientId, method) {
  const submission = await getSubmission(env, submissionId);
  if (!submission) return false;
  const client = await DB(env).prepare("SELECT id FROM clients WHERE id = ?").bind(clientId).first();
  if (!client) return false;
  await DB(env).batch([
    DB(env).prepare("UPDATE form_submissions SET client_id = ?, link_method = ? WHERE id = ?").bind(clientId, method, submissionId),
    ...noteStatements(env, submission, clientId),
  ]);
  return true;
}

/** Undo a link: the submission waits for a client again and leaves her notes. */
export async function unlinkSubmission(env, submissionId) {
  await DB(env).batch([
    DB(env).prepare("UPDATE form_submissions SET client_id = NULL, link_method = NULL WHERE id = ?").bind(submissionId),
    DB(env).prepare("DELETE FROM notes WHERE source_submission_id = ?").bind(submissionId),
  ]);
}

/**
 * Save a checked submission (answers from readSubmission). The submission is
 * always kept, even if Square can't be reached; linking is a bonus on top.
 * Returns { id, clientId }.
 */
export async function saveSubmission(env, form, answers, { now = new Date() } = {}) {
  const id = newId("form");
  const contact = contactOf(answers);
  const submittedAt = now.toISOString().slice(0, 19).replace("T", " ");
  await DB(env).prepare(
    `INSERT INTO form_submissions (id, form_slug, form_version, name, email, phone, answers_json, display_json, note_text, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, form.slug, form.version, contact.name, contact.email, contact.phone,
    JSON.stringify(answers), JSON.stringify(describeSubmission(form, answers)), noteFromSubmission(form, answers), submittedAt,
  ).run();

  let customerId = null;
  try {
    customerId = await findSquareCustomer(env, contact);
  } catch (error) {
    console.error("Matching a form to a Square customer failed:", error.message);
  }
  if (!customerId) return { id, clientId: null };

  await DB(env).prepare("UPDATE form_submissions SET square_customer_id = ? WHERE id = ?").bind(customerId, id).run();
  const client = await DB(env).prepare("SELECT id FROM clients WHERE square_customer_id = ?").bind(customerId).first();
  if (!client) return { id, clientId: null };
  await linkSubmission(env, id, client.id, "square");
  return { id, clientId: client.id };
}

/** After a Square sync: link the submissions that were waiting for their Square customer to become a client. */
export async function linkWaitingSubmissions(env) {
  const { results } = await DB(env).prepare(
    `SELECT s.id, c.id AS client_id FROM form_submissions s
     JOIN clients c ON c.square_customer_id = s.square_customer_id
     WHERE s.client_id IS NULL AND s.square_customer_id IS NOT NULL`,
  ).all();
  for (const row of results) await linkSubmission(env, row.id, row.client_id, "sync");
  return results.length;
}

function parse(row) {
  if (!row) return null;
  return { ...row, answers: JSON.parse(row.answers_json), display: JSON.parse(row.display_json) };
}

export async function getSubmission(env, id) {
  return parse(await DB(env).prepare(
    `SELECT s.*, c.name AS client_name FROM form_submissions s LEFT JOIN clients c ON c.id = s.client_id WHERE s.id = ?`,
  ).bind(id).first());
}

const LIST_COLUMNS = `s.id, s.form_slug, s.name, s.email, s.phone, s.client_id, s.status, s.submitted_at, c.name AS client_name`;

/** Submissions for one form, or every form, newest first. */
export async function listSubmissions(env, { slug = null, limit = 200 } = {}) {
  const where = slug ? "WHERE s.form_slug = ?" : "";
  const statement = DB(env).prepare(
    `SELECT ${LIST_COLUMNS} FROM form_submissions s LEFT JOIN clients c ON c.id = s.client_id ${where}
     ORDER BY s.submitted_at DESC LIMIT ${Number(limit) || 200}`,
  );
  const { results } = await (slug ? statement.bind(slug) : statement).all();
  return results;
}

export async function listSubmissionsForClient(env, clientId) {
  try {
    const { results } = await DB(env).prepare(
      `SELECT ${LIST_COLUMNS} FROM form_submissions s LEFT JOIN clients c ON c.id = s.client_id
       WHERE s.client_id = ? ORDER BY s.submitted_at DESC`,
    ).bind(clientId).all();
    return results;
  } catch (error) {
    // Before the forms migration has run, the client page still works.
    console.error("Reading a client's forms failed:", error.message);
    return [];
  }
}

/** Per form: how many submissions, how many are new, and how many still need a client. */
export async function formCounts(env) {
  const { results } = await DB(env).prepare(
    `SELECT form_slug, COUNT(*) AS total, SUM(status = 'new') AS unread, SUM(client_id IS NULL) AS unlinked
     FROM form_submissions GROUP BY form_slug`,
  ).all();
  return Object.fromEntries(results.map((row) => [row.form_slug, row]));
}

export async function setStatus(env, id, status) {
  await DB(env).prepare("UPDATE form_submissions SET status = ? WHERE id = ?").bind(status === "new" ? "new" : "reviewed", id).run();
}

/** Clients whose name matches the one on the form, to offer first when Laura links by hand. */
export async function clientsNamed(env, name) {
  const clean = String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!clean) return [];
  const { results } = await DB(env).prepare(
    "SELECT id, name FROM clients WHERE lower(trim(name)) = ? ORDER BY name",
  ).bind(clean).all();
  return results;
}

// ---------------------------------------------------------------- importing old Google Forms responses

/**
 * Every Square customer's email and phone, read once for a whole import
 * rather than searching Square per response. Only unambiguous ones are kept:
 * an email or phone shared by two customers matches neither.
 */
export async function squareCustomerIndex(env) {
  const byEmail = new Map();
  const byPhone = new Map();
  if (!isConfigured(env)) return { byEmail, byPhone, available: false };
  const add = (map, key, id) => {
    if (!key) return;
    map.set(key, map.has(key) && map.get(key) !== id ? null : id);
  };
  let cursor;
  let pages = 0;
  do {
    const payload = await squareGet(env, "/v2/customers", { limit: 100, cursor });
    for (const customer of payload.customers || []) {
      add(byEmail, String(customer.email_address || "").trim().toLowerCase(), customer.id);
      add(byPhone, e164(customer.phone_number), customer.id);
    }
    cursor = payload.cursor;
    pages += 1;
  } while (cursor && pages < 50);
  return { byEmail, byPhone, available: true };
}

async function importKey(form, row) {
  const who = row.answers.email || String(row.answers.full_name || "").toLowerCase().replace(/\s+/g, " ");
  const bytes = new TextEncoder().encode(`${form.slug}|${row.timestampText}|${who}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Read a Google Forms CSV and work out, for each response, which client it
 * belongs to and whether it was already imported. Saves nothing.
 * Each row gets { match: { clientId, clientName, how, squareCustomerId } }
 * where how is email | phone | name | waiting (a Square customer who isn't a client yet) | none.
 */
export async function previewImport(env, form, csvText) {
  const parsed = readGoogleResponses(form, csvText);
  if (parsed.error) return { ...parsed, squareChecked: false };

  const { results: clients } = await DB(env).prepare("SELECT id, name, square_customer_id FROM clients").all();
  const bySquareId = new Map(clients.map((client) => [client.square_customer_id, client]));
  const byName = new Map();
  for (const client of clients) {
    const key = client.name.trim().toLowerCase().replace(/\s+/g, " ");
    byName.set(key, byName.has(key) ? null : client);
  }

  let index = { byEmail: new Map(), byPhone: new Map(), available: false };
  try {
    index = await squareCustomerIndex(env);
  } catch (error) {
    console.error("Reading Square customers for an import failed:", error.message);
  }

  const { results: imported } = await DB(env).prepare("SELECT import_key FROM form_submissions WHERE import_key IS NOT NULL").all();
  const done = new Set(imported.map((row) => row.import_key));

  const rows = [];
  for (const row of parsed.rows) {
    const key = await importKey(form, row);
    const viaEmail = row.answers.email ? index.byEmail.get(row.answers.email) : null;
    const viaPhone = row.answers.phone ? index.byPhone.get(e164(row.answers.phone)) : null;
    const customerId = viaEmail || viaPhone || null;
    const how = viaEmail ? "email" : viaPhone ? "phone" : null;
    const named = byName.get(String(row.answers.full_name || "").trim().toLowerCase().replace(/\s+/g, " "));
    let match;
    if (customerId && bySquareId.has(customerId)) {
      const client = bySquareId.get(customerId);
      match = { clientId: client.id, clientName: client.name, how, squareCustomerId: customerId };
    } else if (named) {
      match = { clientId: named.id, clientName: named.name, how: "name", squareCustomerId: customerId };
    } else if (customerId) {
      match = { clientId: null, clientName: "", how: "waiting", squareCustomerId: customerId };
    } else {
      match = { clientId: null, clientName: "", how: "none", squareCustomerId: null };
    }
    rows.push({ ...row, key, match, alreadyImported: done.has(key) });
  }
  return { rows, missing: parsed.missing, error: "", squareChecked: index.available };
}

const IMPORT_METHOD = { email: "square", phone: "square", name: "import-name" };

/**
 * Save the responses a preview found, skipping any already imported. Each is
 * stored like a site submission (already seen, with its original date), and
 * one that matched a client goes into her notes. Returns how many were added
 * and how many of those were linked.
 */
export async function runImport(env, form, preview) {
  const db = DB(env);
  let added = 0;
  let linked = 0;
  const fresh = preview.rows.filter((row) => !row.alreadyImported && row.submittedAt);
  // Small batches: each one is a transaction, and a large file shouldn't become one huge statement list.
  for (let start = 0; start < fresh.length; start += 25) {
    const statements = [];
    for (const row of fresh.slice(start, start + 25)) {
      const view = importedView(form, row.answers);
      const display = describeSubmission(view, row.answers);
      if (row.extra.length) display.push({ title: "Other answers from Google Forms", rows: row.extra });
      const noteText = noteFromSubmission(view, row.answers);
      const contact = contactOf(row.answers);
      const id = newId("form");
      const { clientId, how, squareCustomerId } = row.match;
      statements.push(db.prepare(
        `INSERT OR IGNORE INTO form_submissions (id, form_slug, form_version, client_id, square_customer_id, link_method, name, email, phone,
           answers_json, display_json, note_text, status, submitted_at, import_key)
         VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?, ?)`,
      ).bind(
        id, form.slug, clientId, squareCustomerId, clientId ? IMPORT_METHOD[how] || "manual" : null,
        contact.name || contact.email, contact.email, contact.phone,
        JSON.stringify(row.answers), JSON.stringify(display), noteText, row.submittedAt, row.key,
      ));
      if (clientId) {
        statements.push(...noteStatements(env, { id, submitted_at: row.submittedAt, note_text: noteText }, clientId));
        linked += 1;
      }
      added += 1;
    }
    await db.batch(statements);
  }
  return { added, linked };
}

export { formBySlug };
