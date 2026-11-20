// Builds a first draft of a client's Skincare Guide from what she bought, in
// the beige Alina / Marline design. Everything is deterministic: product
// descriptions and how-to steps are Laura's own words from the guide library
// (src/data/guide-library.js), and anything the library can't fill (the
// personal note, a product it has never described) becomes a highlighted box
// marked "check" for her to write or confirm.
//
// Box positions come from the Canva originals (A4 at 794 x 1123).

import { GUIDE_PRODUCTS, GUIDE_SNIPPETS, GUIDE_STEPS, STEP_DEFAULTS, guideProductFor, howToFor } from "../../data/guide-library.js";
import { escape } from "../../html.js";
import { INK } from "./model.js";

export const COVER_PHOTO = "/media/guides/cover-room.jpg";
export const SPF_TIP_PHOTO = "/media/guides/spf-two-fingers.png";

export const NOTE_PLACEHOLDER = "Write a short note to her here: what you're working on together, what to expect in the first weeks, and how excited you are to see her progress.";
export const QUOTE = "“Great skin requires commitment, not a miracle.”";
export const QUOTE_AUTHOR = "–Erno Laszlo";
export const FOOTER = "Skin by Laura Lo";

// The words used on the AM / PM pages for each step.
export const LIST_LABELS = {
  firstCleanse: "Cleanse", cleanse: "Cleanse", secondCleanse: "Double Cleanse", exfoliate: "Exfoliate", mask: "Mask",
  tone: "Tone", serum: "Serum", treat: "Treat", moisturize: "Moisturize", protect: "SPF", spot: "Spot trmt.",
};
export const HEADINGS = {
  firstCleanse: "First cleanse", cleanse: "Cleanse", secondCleanse: "Second cleanse", exfoliate: "Exfoliate", mask: "Mask",
  tone: "Tone", serum: "Serum", treat: "Treat", moisturize: "Moisturize", protect: "Sunscreen", spot: "Spot treatment",
};

// What the admin's routine step (routine-steps.js) means for a product the library doesn't know yet.
const UNKNOWN_STEP = { cleanse: "cleanse", tone: "tone", treat: "serum", moisturize: "moisturize", protect: "protect", mask: "mask" };
const UNKNOWN_GRID = { cleanse: "Cleansers", tone: "Toners & Serums", treat: "Toners & Serums", moisturize: "Moisturizer", protect: "Sunscreen", mask: "Masks & Exfoliants" };

const STEP_TIME = Object.fromEntries(GUIDE_STEPS.map((step) => [step.id, step.time]));
const STEP_ORDER = GUIDE_STEPS.map((step) => step.id);

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "Your";
}

/**
 * The routine's products matched to the library. Products the library doesn't
 * know keep their Square name and the admin's best-guess step, and are flagged.
 * Each library product appears once even if she bought two sizes.
 */
export function matchProducts(items = []) {
  const seen = new Set();
  const matched = [];
  for (const item of items) {
    const entry = guideProductFor(item.name);
    const key = entry ? entry.id : `square:${item.slug || item.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const step = entry ? null : UNKNOWN_STEP[item.step] || null;
    matched.push({
      key,
      entry,
      name: entry?.name || item.name,
      shortName: entry?.shortName || item.name,
      image: item.image || null,
      grid: entry?.grid || UNKNOWN_GRID[item.step] || null,
      steps: entry ? entry.steps : step ? [step] : [],
      time: entry?.time || null,
    });
  }
  return matched;
}

/**
 * Which product goes in which step, morning and night.
 * - An oil cleanser is the first cleanse at night; the water cleanser follows as the second.
 * - Exfoliants, masks and spot treatments are night only; SPF is morning only.
 * - Toners, serums, treatments and moisturizers are both, unless the library says night only.
 */
export function planRoutine(products) {
  const oil = products.filter((p) => p.steps.includes("firstCleanse"));
  const water = products.filter((p) => p.steps.includes("cleanse"));
  const secondOnly = products.filter((p) => !p.steps.includes("cleanse") && !p.steps.includes("firstCleanse") && p.steps.includes("secondCleanse"));

  const am = [];
  const pm = [];
  if (water[0]) am.push({ step: "cleanse", product: water[0] });
  if (oil[0]) {
    pm.push({ step: "firstCleanse", product: oil[0] });
    if (water[0]) pm.push({ step: "secondCleanse", product: water[0] });
  } else if (water[0]) {
    pm.push({ step: "cleanse", product: water[0] });
    if (water[1]) pm.push({ step: "secondCleanse", product: water[1] });
  }
  for (const product of secondOnly) pm.push({ step: "secondCleanse", product });

  const placed = new Set([...oil.slice(0, 1), ...water.slice(0, oil[0] ? 1 : 2), ...secondOnly].map((p) => p.key));
  const rest = products.filter((p) => !placed.has(p.key) && !p.steps.some((s) => ["firstCleanse", "cleanse", "secondCleanse"].includes(s)));
  const byStep = (step) => rest.filter((p) => p.steps[0] === step);

  for (const step of ["exfoliate", "mask", "tone", "serum", "treat", "moisturize", "protect", "spot"]) {
    for (const product of byStep(step)) {
      const time = product.time || STEP_TIME[step];
      if (time !== "pm") am.push({ step, product });
      if (time !== "am") pm.push({ step, product });
    }
  }
  const order = (a, b) => STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step);
  // Stable sort keeps the cleanse order above (first before second).
  return { am: am.sort(order), pm: pm.sort(order) };
}

// ── Boxes ────────────────────────────────────────────────────────────────────

/** Makes box ids. `base` keeps ids added to an existing guide apart from the ones already in it. */
export function idMaker(base = "") {
  let next = 0;
  return (prefix = "e") => `${prefix}${base}${(next += 1)}`;
}

/** The id that ties a product's boxes together: its library id, or its Square name for products the library doesn't know. */
export function productKey(product) {
  return (product.entry?.id || product.key).slice(0, 80);
}

const text = (id, x, y, w, html, style = {}, extra = {}) => ({
  id, type: "text", x, y, w, html, style: { font: "body", color: INK, ...style }, origin: "template", ...extra,
});
const image = (id, x, y, w, h, src, alt, extra = {}) => ({ id, type: "image", x, y, w, h, src, alt, fit: "contain", style: {}, origin: "template", ...extra });
const line = (id, x, y, w) => ({ id, type: "line", x, y, w, h: 0, style: { color: "#000000", strokeWidth: 1 }, origin: "template" });

// Roughly how many lines a box of text takes in Jost, so the first draft is
// laid out sensibly before the editor measures the real heights.
export function estimateHeight(plain, width, fontSize, lineHeight) {
  const charsPerLine = Math.max(8, Math.floor(width / (fontSize * 0.45)));
  const lines = String(plain).split("\n").reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / charsPerLine)), 0);
  return Math.ceil(lines * fontSize * lineHeight);
}

function stack(elements, startY, gap) {
  let y = startY;
  for (const element of elements) {
    element.y = y;
    const plain = element.html.replace(/<br>/g, "\n").replace(/<[^>]+>/g, "");
    y += estimateHeight(plain, element.w, element.style.fontSize, element.style.lineHeight) + gap;
  }
  return elements;
}

export function footer(id) {
  return text(id("f"), 35, 1066, 300, FOOTER, { font: "sign", fontSize: 21.3, lineHeight: 1, opacity: 0.43 }, { role: "footer" });
}

function nameHeader(id, clientName, { nameX, nameY, nameSize, guideX, guideY, guideSize }) {
  return [
    text(id(), nameX, nameY, 720, `${escape(firstName(clientName))}’s`, { fontSize: nameSize, fontWeight: 400, lineHeight: 1, letterSpacing: -0.05, uppercase: true }, { role: "name" }),
    text(id(), guideX, guideY, 720, "Skincare Guide", { fontSize: guideSize, fontWeight: 800, lineHeight: 1.05, letterSpacing: -0.05 }, { role: "title" }),
  ];
}

export function coverPage(id, clientName) {
  return {
    id: id("p"),
    kind: "cover",
    elements: [
      ...nameHeader(id, clientName, { nameX: 34, nameY: 50, nameSize: 100.7, guideX: 34, guideY: 151, guideSize: 66.9 }),
      { ...image(id(), 505, 244, 258, 781, COVER_PHOTO, "The Skin by Laura Lo treatment room"), fit: "cover" },
      text(id(), 55, 494, 450, "A note from your<br>esthetician", { fontSize: 33.3, lineHeight: 0.92, uppercase: true, letterSpacing: -0.02 }),
      text(id(), 55, 575, 423, `${escape(NOTE_PLACEHOLDER)}<br><br>With love,<br>Laura Lo`, { fontSize: 20, lineHeight: 1.25, letterSpacing: -0.02 },
        { origin: "check", role: "note", note: "Write her personal note." }),
      text(id(), 102, 934, 388, QUOTE, { font: "script", fontSize: 33.5, lineHeight: 1.2, align: "right" }, { role: "quote" }),
      text(id(), 102, 1018, 388, QUOTE_AUTHOR, { font: "script", fontSize: 24.6, lineHeight: 1.2, align: "right" }, { role: "quote" }),
      footer(id),
    ],
  };
}

// The six photo cells of the "Full skincare Routine" grid, as placed in Canva.
export const GRID_CELLS = [
  { label: "Cleansers", x: 35, labelY: 521 },
  { label: "Toners & Serums", x: 256, labelY: 520 },
  { label: "Moisturizer", x: 35, labelY: 720 },
  { label: "Sunscreen", x: 248, labelY: 719 },
  { label: "Spot Treatment", x: 35, labelY: 920 },
  { label: "Lips & Eyes", x: 242, labelY: 920 },
];

export const GRID_AREA = { top: 180, height: 174, gap: 6, width: (x) => (x < 200 ? 196 : 150) };

/** Places a grid cell's product photos side by side above its label. */
export function layoutCellPhotos(photos, labelX, labelY) {
  const areaW = GRID_AREA.width(labelX);
  const each = photos.length ? (areaW - GRID_AREA.gap * (photos.length - 1)) / photos.length : 0;
  photos.forEach((photo, index) => {
    Object.assign(photo, { x: Math.round(labelX + index * (each + GRID_AREA.gap)), y: labelY - GRID_AREA.top, w: Math.round(each), h: GRID_AREA.height });
  });
  return photos;
}

export const STRIP = { x: 379, width: 335, top: 298, bottom: 556 };

/** Places the product photos above the how-to steps, alternating heights like the Canva pages. */
export function layoutStripPhotos(photos) {
  const slot = photos.length ? STRIP.width / photos.length : 0;
  photos.forEach((photo, index) => {
    const h = index % 2 ? Math.round((STRIP.bottom - STRIP.top) * 0.82) : STRIP.bottom - STRIP.top;
    Object.assign(photo, { x: Math.round(STRIP.x + index * slot + slot * 0.05), y: STRIP.bottom - h, w: Math.round(slot * 0.9), h });
  });
  return photos;
}

export function productPhoto(id, product) {
  return image(id(), 0, 0, 10, 10, product.image, product.name, { role: "product-photo", productId: productKey(product) });
}

export function gridCells(products) {
  const hasMasks = products.some((p) => p.grid === "Masks & Exfoliants");
  const hasLips = products.some((p) => p.grid === "Lips & Eyes");
  return GRID_CELLS.map((cell) => (cell.label === "Lips & Eyes" && hasMasks && !hasLips ? { ...cell, label: "Masks & Exfoliants" } : cell));
}

export function whyBox(id, product) {
  const known = product.entry?.why;
  const body = known ? escape(known) : "Description needed: what this product does and why she's using it.";
  return text(id(), 426, 334, 327, `<b>${escape(product.name)}</b><br>${body}`,
    { fontSize: 16, lineHeight: 1.19, letterSpacing: -0.02, align: "justify" },
    {
      origin: known && product.entry.status !== "check-match" ? "library" : "check",
      role: "why", productId: productKey(product), flow: "why",
      ...(known ? (product.entry.status === "check-match" ? { note: "Check this is the right product." } : {}) : { note: "No description of this product yet." }),
    });
}

export function overviewPage(id, clientName, products) {
  const elements = [
    ...nameHeader(id, clientName, { nameX: 59, nameY: 46, nameSize: 106.7, guideX: 49, guideY: 146, guideSize: 73.3 }),
    text(id(), 35, 291, 360, "Full skincare Routine", { fontSize: 24, letterSpacing: -0.02, lineHeight: 1.2 }),
    text(id(), 426, 291, 327, "Why these products?", { fontSize: 24, letterSpacing: -0.02, lineHeight: 1.2 }),
  ];
  for (const row of [541, 741, 941]) elements.push(line(id(), 35, row, 354));
  for (const cell of gridCells(products)) {
    const inCell = products.filter((p) => p.grid === cell.label && p.image);
    elements.push(...layoutCellPhotos(inCell.map((product) => productPhoto(id, product)), cell.x, cell.labelY));
    elements.push(text(id(), cell.x, cell.labelY, 190, escape(cell.label), { fontSize: 17.35, letterSpacing: -0.02, lineHeight: 1.15 }, { role: "grid-label" }));
  }
  elements.push(...stack(products.map((product) => whyBox(id, product)), 334, 14));
  elements.push(footer(id));
  return { id: id("p"), kind: "overview", flows: { why: { gap: 14, bottom: 1045, minFontSize: 12 } }, elements };
}

export function howToBox(id, step, product, repeated) {
  const how = product.entry ? howToFor(product.entry, step) : null;
  const fallback = !how;
  const lines = [escape(how || STEP_DEFAULTS[step] || "How to use it.")];
  if (product.entry?.frequency) lines.push(escape(product.entry.frequency));
  for (const warning of product.entry?.warnings || []) lines.push(escape(warning));
  // Two products in the same step (two treatments) are told apart by name.
  const heading = repeated ? `${HEADINGS[step]} \u2014 ${product.shortName}` : HEADINGS[step];
  return text(id(), 42, 573, 673, `<b>${escape(heading).toUpperCase()}</b><br>${lines.join(" ")}`,
    { fontSize: 18.67, lineHeight: 1.17, letterSpacing: -0.02, align: "justify" },
    {
      origin: fallback || !product.entry ? "check" : "library", role: "howto", productId: productKey(product), flow: "howto", step,
      ...(fallback ? { note: `Usual ${HEADINGS[step].toLowerCase()} wording; check it fits ${product.name}.` } : {}),
    });
}

export function routinePage(id, time, steps) {
  const am = time === "am";
  const spfTip = am && steps.some(({ product }) => product.entry?.guides?.includes("spf-two-finger-rule"));
  const list = steps.map(({ step, product }, index) => listLine(index + 1, step, product)).join("<br>");
  const elements = [
    text(id(), 41, 55, 700, am ? "AM Routine" : "PM Routine", { fontSize: 96, lineHeight: 1, letterSpacing: -0.02, uppercase: true }, { role: "title" }),
    text(id(), 35, 178, 428, list || "1. ", { fontSize: 24, fontWeight: 500, lineHeight: 1.25, letterSpacing: -0.02 }, { role: "step-list" }),
  ];
  const photos = [];
  for (const { product } of steps) if (product.image && !photos.includes(product)) photos.push(product);
  elements.push(...layoutStripPhotos(photos.map((product) => productPhoto(id, product))));
  elements.push(line(id(), 336, 561, 379));
  const repeated = (step) => steps.filter((entry) => entry.step === step).length > 1;
  elements.push(...stack(steps.map(({ step, product }) => howToBox(id, step, product, repeated(step))), 573, 10));
  if (spfTip) elements.push(...spfTipBoxes(id));
  elements.push(footer(id));
  return { id: id("p"), kind: time, flows: { howto: { gap: 10, bottom: spfTip ? SPF_TIP_FLOW_BOTTOM : 1045, minFontSize: 13 } }, elements };
}

export const SPF_TIP_FLOW_BOTTOM = 885;

/** The SPF "two finger rule" tip and its photo, at the bottom of the AM page. */
export function spfTipBoxes(id) {
  const snippet = GUIDE_SNIPPETS["spf-two-finger-rule"];
  return [
    text(id(), 263, 927, 237, `<b>${escape(snippet.title).toUpperCase()}</b><br>${escape(snippet.text)}`,
      { fontSize: 16, lineHeight: 1.25, letterSpacing: -0.02, align: "justify" }, { origin: "library", role: "tip" }),
    image(id(), 500, 896, 213, 138, SPF_TIP_PHOTO, "Two fingers with a line of sunscreen", { role: "tip-photo" }),
  ];
}

/** One line of the numbered step list: "1. Cleanse—Moist Foam Cleanser". */
export function listLine(number, step, product) {
  return `${number}. ${LIST_LABELS[step]}\u2014${escape(product.shortName)}`;
}

/** The product notes a product brings (not the SPF tip, which sits on the AM page). */
export function snippetKeysFor(product) {
  const guides = (product.entry?.guides || []).filter((key) => key !== "spf-two-finger-rule" && GUIDE_SNIPPETS[key]);
  const choices = guides.filter((key) => GUIDE_SNIPPETS[key].title.startsWith("Guide to Using"));
  // Two "Guide to Using …" versions are alternatives: only the first goes in, marked for Laura to pick.
  return guides
    .filter((key) => !(choices.length > 1 && choices.includes(key) && key !== choices[0]))
    .map((key) => ({ key, alternatives: choices.length > 1 && key === choices[0] }));
}

export function snippetBox(id, key, product, alternatives) {
  return text(id(), 42, 200, 700, snippetHtml(GUIDE_SNIPPETS[key]), { fontSize: 17, lineHeight: 1.22, letterSpacing: -0.02 }, {
    origin: alternatives ? "check" : "library", role: "snippet", productId: productKey(product), flow: "notes", snippet: key,
    ...(alternatives ? { note: "There are two ways she has written this (every night, or short contact). Pick the one that fits." } : {}),
  });
}

export const NOTES_FLOW = { gap: 22, bottom: 1045, minFontSize: 12 };

export function notesTitle(id) {
  return text(id(), 41, 55, 700, "Good to know", { fontSize: 72, lineHeight: 1, letterSpacing: -0.02, uppercase: true }, { role: "title" });
}

function snippetHtml(snippet) {
  const parts = [`<b>${escape(snippet.title).toUpperCase()}</b>`];
  if (snippet.text) parts.push(escape(snippet.text));
  for (const item of snippet.list || []) parts.push(`• ${escape(item)}`);
  for (const section of snippet.sections || []) {
    parts.push(`<b>${escape(section.heading)}</b>`);
    for (const item of section.list) parts.push(`• ${escape(item)}`);
  }
  if (snippet.after) parts.push(escape(snippet.after));
  return parts.join("<br>");
}

/**
 * The product notes that go with her routine (purging, moving up a mandelic,
 * how to use Clear Plex or the Booster Pads). When the library holds two
 * versions of a note, the first is used and marked for Laura to confirm.
 */
export function notesPage(id, products) {
  const boxes = [];
  const used = new Set();
  for (const product of products) {
    for (const { key, alternatives } of snippetKeysFor(product)) {
      if (used.has(key)) continue;
      used.add(key);
      boxes.push(snippetBox(id, key, product, alternatives));
    }
  }
  if (!boxes.length) return null;
  return {
    id: id("p"),
    kind: "notes",
    flows: { notes: { ...NOTES_FLOW } },
    elements: [
      notesTitle(id),
      ...stack(boxes, 175, 22),
      footer(id),
    ],
  };
}

/**
 * A full first draft for a client: cover with the personal note, the routine
 * overview with "Why these products?", the AM and PM pages, and a notes page
 * when her products come with one. `routine` is routineFromOrders' result.
 */
export function buildGuideDraft({ clientName, routine }) {
  const id = idMaker();
  const products = matchProducts(routine?.items || []);
  const { am, pm } = planRoutine(products);
  const pages = [coverPage(id, clientName), overviewPage(id, clientName, products)];
  pages.push(routinePage(id, "am", am), routinePage(id, "pm", pm));
  const notes = notesPage(id, products);
  if (notes) pages.push(notes);
  return {
    version: 1,
    clientName: clientName || "",
    needsLayout: true,
    pages,
    createdFrom: { orderedAt: routine?.orderedAt || null, products: products.map((p) => p.name) },
  };
}

/** Other wordings Laura has used for each product's description, for the editor's "Other wordings" menu. */
export function wordingChoices(document) {
  const choices = {};
  for (const page of document.pages) {
    for (const element of page.elements) {
      if (element.role !== "why" || !element.productId || choices[element.productId]) continue;
      const entry = GUIDE_PRODUCTS.find((product) => product.id === element.productId);
      if (!entry?.why) continue;
      const texts = [entry.why, ...(entry.whyAlternates || []).map((alt) => alt.text)];
      choices[entry.id] = { name: entry.name, texts };
    }
  }
  return choices;
}
