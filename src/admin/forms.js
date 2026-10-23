// Client form submissions: saving what arrives from the public site, linking
// each one to a client, and writing a linked submission into her notes so the
// insight, the safety check and the email matching all take it into account.
// The table is described in migrations/0007_form_submissions.sql.

import { squareFetch, isConfigured } from "../square.js";
import { newId } from "./db.js";
import { formBySlug } from "../forms/definitions.js";
import { contactOf, describeSubmission, noteFromSubmission } from "../forms/engine.js";

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

export { formBySlug };
