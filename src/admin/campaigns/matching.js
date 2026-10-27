// Which clients might relate to this week's email. A cheap first pass looks for
// the topic's words in each client's notes and purchases; only clients with a
// hit are sent to the AI, which decides whether they really relate and writes
// their personal note. There is no cap: every client with a hit is checked.

import { noteFields, fieldsAsText } from "../note-fields.js";
import { findFlags } from "../safety.js";
import { productInsightFor } from "../../product-insights.js";

export function firstNameOf(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

/** Everything written in a note: the sheet's cells for Noteful notes, the seller note for Square. */
function noteText(note) {
  const fields = noteFields(note);
  if (fields) return fieldsAsText(fields);
  return note.summary || note.extracted_text || "";
}

/**
 * A client as matching sees them.
 *   notes:     their notes, newest first
 *   purchases: [{ name, orderedAt }] from the stored copy of their Square orders, newest first
 */
export function buildProfile({ client, notes, purchases }) {
  const noteTexts = notes.map((note) => ({ date: note.note_date, text: noteText(note) })).filter((note) => note.text);
  return {
    clientId: client.id,
    squareCustomerId: client.square_customer_id || null,
    name: client.name,
    firstName: firstNameOf(client.name),
    notes,
    noteTexts,
    purchases,
    searchText: [...noteTexts.map((note) => note.text), ...purchases.map((purchase) => purchase.name)].join("\n").toLowerCase(),
  };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Short shorthand (pih, pie, spf) must match a whole word; longer terms can match inside text. */
function mentions(text, term) {
  if (term.length <= 4) return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`).test(text);
  return text.includes(term);
}

export function scoreProfile(profile, terms) {
  const hits = terms.filter((term) => term && mentions(profile.searchText, term.toLowerCase()));
  return { score: hits.length, hits };
}

/** Every client with at least one hit, strongest first. */
export function pickCandidates(profiles, terms) {
  return profiles
    .map((profile) => ({ profile, ...scoreProfile(profile, terms) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.profile.name.localeCompare(b.profile.name));
}

const monthYear = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : "date unknown");

/** The short description of a client the AI reads: recent notes, purchases and safety flags. No surname. */
export function profileForPrompt(profile) {
  const flags = findFlags({
    notes: profile.notes,
    products: profile.purchases.map((purchase) => ({ name: purchase.name, formula: productInsightFor(purchase.name)?.formula || "" })),
  });
  const notes = profile.noteTexts.slice(0, 4).map((note) => `- ${note.date || "undated"}: ${note.text.slice(0, 500)}`);
  const bought = [...new Map(profile.purchases.map((purchase) => [purchase.name, purchase])).values()]
    .slice(0, 10)
    .map((purchase) => `${purchase.name} (${monthYear(purchase.orderedAt)})`);
  return [
    `Notes, newest first:\n${notes.join("\n") || "- none"}`,
    `Bought: ${bought.join("; ") || "nothing recorded"}`,
    `Flags: ${flags.map((flag) => flag.title).join("; ") || "none"}`,
  ].join("\n");
}

/** Keeps a client's first name safe to place inside the prompt's markup. */
export function promptSafeName(name) {
  return String(name || "").replace(/[<>"&]/g, "").slice(0, 40) || "Client";
}

/** Every client's notes and stored purchases, in three queries. */
export async function loadProfiles(env) {
  const db = env.CLIENT_NOTES_DB;
  const [{ results: clients }, { results: notes }, purchasesResult] = await Promise.all([
    db.prepare("SELECT id, name, square_customer_id FROM clients").all(),
    db.prepare("SELECT id, client_id, note_date, source, summary, extracted_text, fields_json FROM notes ORDER BY (note_date IS NULL), note_date DESC").all(),
    db.prepare(
      `SELECT o.client_id, o.ordered_at, l.name FROM client_order_lines l JOIN client_orders o ON o.order_id = l.order_id
       ORDER BY o.ordered_at DESC`,
    ).all().catch(() => ({ results: [] })),
  ]);
  const notesByClient = new Map();
  for (const note of notes) {
    if (!notesByClient.has(note.client_id)) notesByClient.set(note.client_id, []);
    notesByClient.get(note.client_id).push(note);
  }
  const purchasesByClient = new Map();
  for (const row of purchasesResult.results) {
    if (!purchasesByClient.has(row.client_id)) purchasesByClient.set(row.client_id, []);
    purchasesByClient.get(row.client_id).push({ name: row.name, orderedAt: row.ordered_at });
  }
  return clients.map((client) => buildProfile({
    client,
    notes: notesByClient.get(client.id) || [],
    purchases: purchasesByClient.get(client.id) || [],
  }));
}
