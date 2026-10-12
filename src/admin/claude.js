// Reads the genuinely-new pages from a note upload and splits them into one
// or more dated entries. A single upload is NOT always one note: Laura
// sometimes batches several visits into one export, so the model is asked
// to find the visit boundaries itself (by date, or a clear break) rather
// than us assuming one page = one visit or one upload = one note.
//
// Nothing here is trusted blindly. A page with no legible date comes back
// with date: null rather than a guessed "today", and anything hard to read
// comes back flagged low-confidence — both are surfaced in the dashboard,
// never silently smoothed over.

import { productInsightFor } from "../product-insights.js";
import { SHEET_NOTE_FIELDS } from "./data/sheet-notes.js";

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5-5";

const SYSTEM_PROMPT = `You are reading scanned pages from a licensed esthetician's handwritten client consultation notebook, exported from a note-taking app. You will be shown one or more pages, in the order they appear in the notebook, each labelled with its page index.

Your job: group the pages into one entry per client visit, and transcribe each.

Rules:
- A visit usually starts with a date written at the top of a page. Pages with no new date belong to the same visit as the page before them.
- If a page's date truly cannot be read, set "date" to null. Never guess a date from context — a wrong date is worse than no date.
- Set "confidence" to "low" for any entry where the handwriting was hard to read, ambiguous, or you are not confident in the transcription. Otherwise "high".
- "summary" is 1-3 plain sentences a skincare professional would recognize as useful context before the client's next visit (concerns mentioned, products discussed, reactions, follow-up plans).
- "text" is your best full transcription of that visit's notes, in your own words where handwriting is genuinely illegible (mark those spots with [illegible]).
- "pageIndexes" lists every page index (as given to you) belonging to that visit, in order.

Respond with ONLY a JSON object, no other text, in exactly this shape:
{"entries": [{"pageIndexes": [0], "date": "2026-08-02", "summary": "...", "text": "...", "confidence": "high"}]}`;

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function pageContentBlock(page) {
  if (page.kind === "image") {
    return { type: "image", source: { type: "base64", media_type: page.mediaType, data: bytesToBase64(page.bytes) } };
  }
  return { type: "document", source: { type: "base64", media_type: "application/pdf", data: bytesToBase64(page.bytes) } };
}

/**
 * Ask Claude to read and split a set of new pages. `pages` is an array of
 * { index, bytes, kind: "pdf"|"image", mediaType? } in notebook order —
 * the index is whatever the caller wants echoed back in pageIndexes, not
 * necessarily 0-based across the whole notebook.
 */
export async function extractNoteEntries(env, pages) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const content = [];
  for (const page of pages) {
    content.push({ type: "text", text: `Page index ${page.index}:` });
    content.push(pageContentBlock(page));
  }
  content.push({ type: "text", text: "Now respond with the JSON object described above, and nothing else." });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Claude extraction request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const text = payload?.content?.find((block) => block.type === "text")?.text || "";
  return planNoteEntries(text);
}

/**
 * Parse Claude's response into a validated list of note entries, never
 * throwing. A response that isn't valid JSON, or doesn't match the expected
 * shape, becomes a single low-confidence entry carrying the raw response —
 * visible and editable in the dashboard rather than lost.
 */
export function planNoteEntries(responseText) {
  const parsed = tryParseJson(responseText);
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : null;

  if (!entries || entries.length === 0) {
    return [fallbackEntry(responseText)];
  }

  return entries.map((entry) => ({
    pageIndexes: Array.isArray(entry?.pageIndexes) ? entry.pageIndexes.filter((n) => Number.isInteger(n)) : [],
    date: typeof entry?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? entry.date : null,
    summary: typeof entry?.summary === "string" && entry.summary.trim() ? entry.summary.trim() : "No summary available — please review the original.",
    text: typeof entry?.text === "string" ? entry.text : "",
    confidence: entry?.confidence === "low" ? "low" : entry?.confidence === "high" ? "high" : "low",
  }));
}

function tryParseJson(text) {
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    // Fall through to look for a fenced ```json block in case the model
    // wrapped its answer despite the instruction not to.
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * On-demand synthesis across everything we know about one client: their
 * note history plus their current routine. Deliberately not run on every
 * page view — this is a "Summarize this client" button, not an automatic
 * background job, so it only costs an API call when Laura actually wants it.
 */
/** A note as the model should read it: the sheet's own cells for Noteful notes, the seller note for Square. */
function noteForPrompt(note) {
  const fields = note.source === "square" ? null : SHEET_NOTE_FIELDS[note.id];
  if (!fields) return note.summary;
  return Object.entries(fields)
    .map(([label, value]) => `${label}: ${value.replace(/\s*\n\s*/g, " / ")}`)
    .join(" | ");
}

export async function summarizeClient(env, { client, notes, routine, history = [], flags = [] }) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const dated = notes.filter((note) => note.note_date).sort((a, b) => a.note_date.localeCompare(b.note_date));
  const undated = notes.filter((note) => !note.note_date);
  const notesText = notes.length
    ? [...dated, ...undated].map((note) => `- ${note.note_date || "undated"}: ${noteForPrompt(note)}`).join("\n")
    : "No notes on file yet.";
  const routineText = routine?.items?.length
    ? routine.items.map((item) => item.name).join(", ")
    : "No current routine on file.";
  const purchasesText = history.length
    ? history.slice(0, 25).map((item) => `- ${item.name} x${item.count}, last bought ${item.lastBought || "unknown"}`).join("\n")
    : "No product purchases found in Square.";

  // Ingredient details for the current routine first, then her most recent other purchases.
  const seen = new Set();
  const detailItems = [...(routine?.items || []), ...history.slice(0, 15)].filter((item) => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
  const formulationsText = detailItems.length ? formulationsFor(detailItems) : "";
  const flagsText = flags.length ? flags.map((flag) => `- ${flag.title}: ${flag.detail}`).join("\n") : "";

  const prompt = `You are helping a licensed esthetician prepare for a client's next visit.

Client: ${client.name}
Current routine (from their most recent Square order): ${routineText}

Everything she has bought from the shop (all completed Square orders), most recent first:
${purchasesText}
${formulationsText ? `\nWhat's actually in those products:\n${formulationsText}\n` : ""}${flagsText ? `\nConcerns already found by an automatic check of her notes against her purchases:\n${flagsText}\n` : ""}
Note history, oldest first:
${notesText}

Write the preparation notes as ONLY a JSON object, no other text, in exactly this shape:
{"overview": "1-2 sentences", "flags": ["an allergy, sensitivity, medication or pregnancy concern tied to a specific product"], "visits": [{"date": "YYYY-MM-DD or null", "treatment": "what was done", "response": "how her skin responded"}], "products": [{"name": "product name she has bought", "note": "one short line on what it does for her, using the formulation details above"}], "watch": ["short concrete thing to watch"], "nextVisit": ["short item to check or do at the next visit"]}

Rules:
- "flags": cross-check everything she has bought against every allergy, sensitivity, medication, reaction or pregnancy mentioned in her notes. Name the product, the ingredient from its list, and the note it conflicts with. Include the concerns already found above if they are real. Leave it empty if nothing conflicts. Never say a product is safe.
- "visits": one entry per dated note, oldest first. Keep each cell to a short phrase.
- "products": products she has bought, current routine first. At most 8.
- "watch" and "nextVisit": short, concrete items. Skip generic encouragement.
- Use the formulation details, not just product names. If a note mentions irritation and a product contains an active known to cause that, say so.
- If a product's formula is unverified or not on file, don't state its ingredients as fact; say it couldn't be checked.
- If there isn't enough history to say anything specific, say that plainly in "overview" and leave the lists empty. Don't invent a pattern.
- When a product has an ingredient list, name the specific ingredients that matter for her concerns (for example a fragrance, an irritating botanical, or an active) and say why. Quote only what is in the list.
- Keep "overview" to 2 sentences and each list to at most 6 items.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Claude summary request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  if (payload?.stop_reason === "max_tokens") {
    throw new Error("The summary ran out of room before it finished. Click Summarize again.");
  }
  const text = payload?.content?.find((block) => block.type === "text")?.text || "";
  return planInsight(text);
}

/**
 * Parse the client summary into { overview, visits, products, watch, nextVisit }.
 * Never throws. A reply that isn't JSON keeps its text as the overview, so the
 * page still shows something useful rather than an error.
 */
export function planInsight(responseText) {
  const empty = { overview: "", flags: [], visits: [], products: [], watch: [], nextVisit: [] };
  const parsed = tryParseJson(responseText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const plain = typeof responseText === "string" ? responseText.trim() : "";
    // Half-finished JSON is never shown raw; ask for another try instead.
    if (/^\s*[{\[]|^```/.test(plain)) return { ...empty, overview: "The summary came back incomplete. Click Summarize again." };
    return { ...empty, overview: plain.slice(0, 2000) || "Nothing to summarize yet." };
  }

  const text = (value) => (typeof value === "string" ? value.trim() : "");
  const list = (value) => (Array.isArray(value) ? value : []);

  const insight = {
    overview: text(parsed.overview),
    flags: list(parsed.flags).map(text).filter(Boolean),
    visits: list(parsed.visits)
      .map((visit) => ({ date: text(visit?.date) || "Undated", treatment: text(visit?.treatment), response: text(visit?.response) }))
      .filter((visit) => visit.treatment || visit.response),
    products: list(parsed.products)
      .map((product) => ({ name: text(product?.name), note: text(product?.note) }))
      .filter((product) => product.name),
    watch: list(parsed.watch).map(text).filter(Boolean),
    nextVisit: list(parsed.nextVisit).map(text).filter(Boolean),
  };

  if (!insight.overview) insight.overview = "Nothing to summarize yet.";
  return insight;
}

/**
 * The routine's products matched against the ingredient-review data already
 * maintained for the storefront (src/data/product-formulas.js) — so the
 * insight can reason about what a product actually does, not just its
 * name. A product with no reviewed formula, or one still pending
 * verification, is labelled as such rather than silently left out or
 * presented as confirmed.
 */
export function formulationsFor(items) {
  return items
    .map((item) => {
      const insight = productInsightFor(item.name);
      if (!insight) return `- ${item.name}: no formula on file yet.`;
      if (insight.notApplicable) return `- ${item.name}: a device, not a topical formula — skip ingredient reasoning for this one.`;

      const caveat = insight.needsVerification
        ? " (formula unverified — treat as a guess, not fact)"
        : insight.partial
          ? " (only a partial formula is confirmed)"
          : "";

      const ingredients = insight.formula
        ? `\n  Ingredients as published: ${insight.formula}`
        : "\n  Ingredients: no published list on file.";
      return `- ${item.name}${caveat}: ${insight.summary} Best for: ${insight.bestFor}${insight.keepInMind ? ` Keep in mind: ${insight.keepInMind}` : ""}${ingredients}`;
    })
    .join("\n");
}

function fallbackEntry(responseText) {
  return {
    pageIndexes: [],
    date: null,
    summary: "This note couldn't be read automatically — please review the original and fill this in.",
    text: typeof responseText === "string" ? responseText.slice(0, 4000) : "",
    confidence: "low",
  };
}
