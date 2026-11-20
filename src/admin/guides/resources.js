// Resource pages in a Skincare Guide (What is Acne, Hormones, Acne-Safe Makeup…):
// building them from src/data/guide-resources.js, choosing which ones a new
// draft gets, and where they go in the guide.
//
// Choosing is done with plain word rules over what the dashboard knows about
// her: her visit notes and intake forms, the saved client summary, and the
// products in her routine. Every page chosen this way comes in highlighted
// "to check", with the words that triggered it, so Laura keeps it or deletes
// it; the editor's "Pages" list adds or takes out any of them later.

import { GUIDE_RESOURCES, RESOURCE_ORDER, guideResource } from "../../data/guide-resources.js";
import { INK, PAGE_HEIGHT } from "./model.js";
import { footer, idMaker, stack } from "./build.js";

// Pages that every guide gets.
export const ALWAYS = ["tips", "essentials"];
// Pages that go straight after the cover instead of after the routine (as in Marline's guide).
export const AFTER_COVER = ["what-is-acne"];

const LETTER_HEIGHT = 1028;

// ── building ─────────────────────────────────────────────────────────────────

function element(id, box) {
  const base = { id: id(), x: box.x, y: box.y, w: box.w, origin: "template" };
  if (box.type === "text") {
    return {
      ...base, type: "text", html: box.html, style: { font: "body", color: INK, ...box.style }, origin: "library",
      ...(box.role ? { role: box.role } : {}), ...(box.flow ? { flow: box.flow } : {}), ...(box.link ? { link: box.link } : {}),
    };
  }
  if (box.type === "image") {
    return { ...base, type: "image", h: box.h, src: box.src, alt: box.alt || "", fit: box.fit || "contain", style: {}, ...(box.link ? { link: box.link } : {}) };
  }
  return { ...base, type: "line", h: 0, style: { color: "#000000", strokeWidth: 1 } };
}

/**
 * The pages of one resource, ready to put in a guide. `reason` (why it was
 * chosen for her) marks its title "to check" with that note.
 */
export function resourcePages(id, resourceId, { reason = "" } = {}) {
  const resource = guideResource(resourceId);
  if (!resource) return [];
  return resource.pages.map((template, pageIndex) => {
    const scale = template.letter ? PAGE_HEIGHT / LETTER_HEIGHT : 1;
    const elements = template.elements.map((box) => element(id, { ...box, y: Math.round(box.y * scale) }));
    for (const flow of Object.keys(template.flows || {})) {
      const boxes = elements.filter((box) => box.flow === flow);
      if (boxes.length) stack(boxes, boxes[0].y || 214, template.flows[flow].gap);
    }
    for (const box of elements) {
      if (box.role === "appointment") Object.assign(box, { origin: "check", note: "Write her next appointment, or delete this line." });
    }
    if (reason && pageIndex === 0) {
      const title = elements.find((box) => box.role === "title");
      if (title) Object.assign(title, { origin: "check", note: reason.slice(0, 300) });
    }
    return {
      id: id("p"),
      kind: "resource",
      resource: resource.id,
      ...(template.flows ? { flows: JSON.parse(JSON.stringify(template.flows)) } : {}),
      elements: [...elements, footer(id)],
    };
  });
}

/**
 * Puts a resource's pages where they belong: in the order of Marline's guide
 * after the routine pages (or straight after the cover for What is Acne),
 * whatever else has been added or moved since. Returns where they went.
 *
 * Written without imports or outside variables: the editor's script embeds it
 * to add pages from its "Pages" list.
 */
export function placeResourcePages(pages, resourceId, newPages, order, afterCover) {
  const rank = (id) => order.indexOf(id);
  const mine = rank(resourceId);
  let at = -1;
  if (afterCover.includes(resourceId)) {
    at = pages.findIndex((page) => page.kind === "cover");
    pages.forEach((page, index) => {
      if (page.kind === "resource" && afterCover.includes(page.resource) && rank(page.resource) < mine) at = Math.max(at, index);
    });
  } else {
    pages.forEach((page, index) => {
      if (["cover", "overview", "am", "pm", "notes"].includes(page.kind)) at = Math.max(at, index);
      if (page.kind === "resource" && !afterCover.includes(page.resource) && rank(page.resource) !== -1 && rank(page.resource) < mine) at = Math.max(at, index);
    });
  }
  pages.splice(at + 1, 0, ...newPages);
  return at + 1;
}

/** Adds the chosen resources to a new draft, each with its reason. */
export function addResourcesToDraft(document, picks, id = idMaker("r")) {
  for (const resourceId of RESOURCE_ORDER) {
    const pick = picks.find((entry) => entry.id === resourceId);
    if (!pick) continue;
    placeResourcePages(document.pages, resourceId, resourcePages(id, resourceId, { reason: pick.reason }), RESOURCE_ORDER, AFTER_COVER);
  }
  return document;
}

/**
 * Every resource for the editor's "Pages" list, with its pages built once so
 * the editor can add them without asking the server (and undo can take them out).
 */
export function resourceCatalog() {
  const id = idMaker("t");
  return GUIDE_RESOURCES.map((resource) => ({
    id: resource.id,
    label: resource.label,
    about: resource.about,
    pages: resourcePages(id, resource.id),
  }));
}

// ── choosing ─────────────────────────────────────────────────────────────────

const ACNE = /\b(acne|breakouts?|breaking out|broke out|cystic|cysts?|comedones?|congest(ed|ion)|pimples?|blackheads?|whiteheads?|clogged pores|blemish(es)?|pustules?|papules?|nodules?)\b/i;
const ACNE_PRODUCT = /mandelic|clear ?plex|clear (\+|&|and) prevent|sulfur|salicylic|benzoyl|acne|blemish|spot treat|booster pads?/i;

// Each rule: the words that bring the page in, and whether it only makes sense for acne.
const RULES = [
  { id: "what-is-acne", acne: true },
  { id: "lifestyle", words: /\b(stress(ed|ful)?|anxi(ety|ous)|sleep(ing)?|insomnia|exercis(e|es|ing)|workouts?|burn ?out)\b/i },
  { id: "nutrition", acne: true, words: /\b(diet|sugar(s|y)?|dairy|milk|gluten|junk food|fast food|nutrition|eating)\b/i },
  { id: "habits", words: /\b(perioral|dermatitis|toothpaste|laundry|detergent|whey|protein (shakes?|powder)|energy drinks?|pillow ?cases?)\b/i },
  { id: "hormones", words: /\b(hormon\w*|jaw ?line|jaw|chin|pcos|polycystic|spiro\w*|menstrua\w*|her cycle|period breakouts?|pregnan\w*|postpartum|testosterone|androgen\w*|menopaus\w*)\b/i },
  { id: "birth-control", words: /\b(birth control|anticonceptiv\w*|contracepti\w*|iud|mirena|nexplanon|depo|the pill|yaz|yasmin)\b/i },
  { id: "sneaky-triggers", acne: true, words: /\b(energy drinks?|energy shots?|b12|biotin|hair,? skin,? (and|&) nails?|fabric softener|dryer sheets?|lip balms?|toothpaste|tissues?|celsius|monster|red bull)\b/i },
  { id: "supplements", acne: true, words: /\b(supplements?|zinc|fish oil|omega[- ]?3s?)\b|^takes:/i },
  { id: "gut", acne: true, words: /\b(gut|bloat(ed|ing)?|digesti\w*|ibs|constipat\w*|probiotics?|antibiotics?)\b/i },
  { id: "other-resources", words: /\b(picking|picks|picker|pick at|dermatillomania|red light|led (mask|device|at home|panel))\b/i },
  { id: "rosacea", words: /\b(rosacea|flushing|flushes|couperose|broken capillaries|capillaries)\b/i },
  { id: "makeup", acne: true, words: /\b(wears makeup|makeup (daily|every ?day)|wears? (foundation|concealer)|full face of makeup)\b/i },
];

// The headings of Laura's visit sheets, left off the quoted words.
const NOTE_LABEL = /^(treatment type|notes|notes \/ remarks|purchase history|outside products|possible treatments|summary):\s*-?\s*/i;
const NEGATION = /^(no|not|none|never|doesn['’]?t|does not|don['’]?t|do not|denies|without)\b/i;
const NEGATIVE_ANSWER = /:\s*(no|none|n\/a|not (really|at all|currently))\b/i;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!match) return "";
  return `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`;
}

function flatten(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flatten).join("\n");
  if (typeof value === "object") return Object.values(value).map(flatten).join("\n");
  return String(value);
}

/** Her notes, forms and summary as short pieces of text, each knowing where it came from. */
export function textSources({ notes = [], insight = null } = {}) {
  const sources = [];
  for (const note of notes) {
    let fields = "";
    try { fields = note.fields_json ? flatten(JSON.parse(note.fields_json)) : ""; } catch { fields = ""; }
    const where = note.source === "form" ? "her intake form" : note.note_date ? `her notes from ${formatDate(note.note_date)}` : "her notes";
    sources.push({ where, text: [note.extracted_text, note.summary, fields].filter(Boolean).join("\n") });
  }
  if (insight) sources.push({ where: "her client summary", text: flatten(insight) });
  return sources;
}

/** Lines that say something about her (a "No …" / "Doesn't …" line is left out). */
function segments(text) {
  return String(text || "")
    .split(/\n|\s\/\s|;|(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.replace(/^[\s\-–•*]+/, "").replace(NOTE_LABEL, "").trim())
    .filter((part) => part && !NEGATION.test(part) && !NEGATIVE_ANSWER.test(part));
}

/** The words around the match (a few on each side, cut at spaces), so the reason reads like her notes. */
function quote(segment, match) {
  const at = Math.max(0, segment.search(match));
  let start = Math.max(0, at - 28);
  let end = Math.min(segment.length, at + 48);
  if (start > 0) start = segment.indexOf(" ", start) + 1 || start;
  if (end < segment.length) end = segment.lastIndexOf(" ", end) > at ? segment.lastIndexOf(" ", end) : end;
  const piece = segment.slice(start, end).trim().replace(/[,;:]$/, "");
  return `${start > 0 ? "…" : ""}${piece}${end < segment.length ? "…" : ""}`;
}

function findWords(sources, pattern) {
  for (const source of sources) {
    for (const segment of segments(source.text)) {
      if (pattern.test(segment)) return { where: source.where, quote: quote(segment, pattern) };
    }
  }
  return null;
}

function acneProduct(productNames) {
  return productNames.find((name) => ACNE_PRODUCT.test(name)) || null;
}

const PEEL = /\b(peels?|dermaplan\w*|microneedl\w*|chemical exfoliation)\b/i;

/** The latest visit (not an intake form), if it was a peel within the last month. */
function recentPeel(notes, today) {
  const visit = notes.find((note) => note.source !== "form" && note.note_date);
  if (!visit) return null;
  const days = (today - new Date(`${visit.note_date.slice(0, 10)}T12:00:00Z`)) / 86_400_000;
  if (!(days >= -1 && days <= 31)) return null;
  const segment = segments([visit.extracted_text, visit.summary].filter(Boolean).join("\n")).find((part) => PEEL.test(part));
  return segment ? { where: `her notes from ${formatDate(visit.note_date)}`, quote: quote(segment, PEEL) } : null;
}

const KEEP = "Keep the page, or untick it in + Page if it doesn't fit her.";
const because = (found) => `Picked for her because of “${found.quote}” in ${found.where}. ${KEEP}`;

/**
 * Which resource pages a new draft gets, each with the reason. `notes` are her
 * notes and intake forms newest first (db.listNotesForClient), `insight` the
 * saved client summary, `products` the names of the products in her routine.
 */
export function pickResources({ notes = [], insight = null, products = [], today = new Date() } = {}) {
  const sources = textSources({ notes, insight });
  const picks = ALWAYS.map((id) => ({ id, reason: "" }));
  const acneWords = findWords(sources, ACNE);
  const product = acneProduct(products);
  const acne = acneWords || (product ? { where: "her routine", quote: product, product: true } : null);
  for (const rule of RULES) {
    if (rule.acne && !acne) continue;
    if (!rule.words) {
      picks.push({ id: rule.id, reason: acne.product ? `Picked for her because her routine has ${acne.quote}. ${KEEP}` : because(acne) });
      continue;
    }
    const found = findWords(sources, rule.words);
    if (found) picks.push({ id: rule.id, reason: because(found) });
  }
  const peel = recentPeel(notes, today);
  if (peel) picks.push({ id: "post-treatment", reason: because(peel) });
  return RESOURCE_ORDER.map((id) => picks.find((pick) => pick.id === id)).filter(Boolean);
}

/** The resource ids already in a guide. */
export function resourcesInGuide(document) {
  return new Set((document?.pages || []).filter((page) => page.kind === "resource" && page.resource).map((page) => page.resource));
}
