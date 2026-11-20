// Adding a product to a guide that already exists (and taking one out), from
// the editor's "Add product" button. The guide may have been edited by then,
// so nothing is redrawn from scratch: the product's boxes are slotted in next
// to the ones already there, and the editor stacks the text again once it can
// measure it (the page's `relayout` list).
//
// What a product brings, in Laura's words from the library:
// - its "Why these products?" description and a photo in its grid cell
// - a line in the AM and/or PM step list, its how-to box and a photo in the strip
// - the SPF tip on the AM page (sunscreens) and its notes ("Good to know")

import { GUIDE_PRODUCTS, GUIDE_STEPS } from "../../data/guide-library.js";
import { plainText } from "./model.js";
import {
  NOTES_FLOW, SPF_TIP_FLOW_BOTTOM, footer, howToBox, idMaker, layoutCellPhotos, layoutStripPhotos,
  listLine, matchProducts, notesTitle, planRoutine, productKey, productPhoto, snippetBox, snippetKeysFor, spfTipBoxes, whyBox,
} from "./build.js";

const STEP_ORDER = GUIDE_STEPS.map((step) => step.id);

function relayout(page, flow) {
  page.relayout = [...new Set([...(page.relayout || []), flow])];
}

/** Every product key used anywhere in the guide. */
export function productsInGuide(document) {
  const keys = new Set();
  for (const page of document.pages) for (const element of page.elements) if (element.productId) keys.add(element.productId);
  return keys;
}

function insertAfter(elements, anchor, element) {
  const index = anchor ? elements.indexOf(anchor) : -1;
  if (index === -1) elements.push(element);
  else elements.splice(index + 1, 0, element);
}

// ── overview ─────────────────────────────────────────────────────────────────

function addToOverview(document, id, product) {
  const overviews = document.pages.filter((page) => page.kind === "overview");
  if (!overviews.length) return 0;
  let changed = 0;

  // The description goes after the last one, on whichever overview page holds it.
  const withWhy = [...overviews].reverse().find((page) => page.elements.some((element) => element.role === "why")) || overviews[0];
  const lastWhy = withWhy.elements.filter((element) => element.role === "why").sort((a, b) => a.y - b.y).at(-1);
  const box = whyBox(id, product);
  if (lastWhy) Object.assign(box, { x: lastWhy.x, w: lastWhy.w, y: lastWhy.y + 1, style: { ...box.style, fontSize: lastWhy.style.fontSize || box.style.fontSize } });
  insertAfter(withWhy.elements, lastWhy, box);
  withWhy.flows = { why: { gap: 14, bottom: 1045, minFontSize: 12 }, ...(withWhy.flows || {}) };
  relayout(withWhy, "why");
  changed += 1;

  // The photo goes in its grid cell, next to the others there.
  if (product.image && product.grid) {
    const page = overviews[0];
    const labels = page.elements.filter((element) => element.role === "grid-label");
    let label = labels.find((element) => plainText(element.html).trim() === product.grid);
    if (!label && product.grid === "Masks & Exfoliants") {
      // The last cell shows "Lips & Eyes" until a mask or exfoliant needs it.
      const lips = labels.find((element) => plainText(element.html).trim() === "Lips & Eyes");
      if (lips && !photosInCell(page, lips).length) { lips.html = "Masks &amp; Exfoliants"; label = lips; }
    }
    if (label) {
      const photos = photosInCell(page, label);
      const photo = productPhoto(id, product);
      insertAfter(page.elements, photos.at(-1) || null, photo);
      layoutCellPhotos([...photos, photo], label.x, label.y);
      changed += 1;
    }
  }
  return changed;
}

// The photos sitting above a grid label: between the label above it and the label itself, in its column.
function photosInCell(page, label) {
  const width = label.x < 200 ? 196 : 150;
  return page.elements.filter((element) => element.role === "product-photo"
    && element.x >= label.x - 12 && element.x < label.x + width
    && element.y >= label.y - 200 && element.y < label.y);
}

// ── AM / PM ─────────────────────────────────────────────────────────────────

function stepFor(page, step) {
  // A water cleanser added to a night that already starts with an oil is the second cleanse.
  if (page.kind === "pm" && step === "cleanse" && page.elements.some((element) => element.role === "howto" && element.step === "firstCleanse")) return "secondCleanse";
  return step;
}

function addToRoutinePage(page, id, step, product) {
  step = stepFor(page, step);
  const howtos = page.elements.filter((element) => element.role === "howto").sort((a, b) => a.y - b.y);
  const order = STEP_ORDER.indexOf(step);
  // After the last step that comes before (or with) this one; boxes without a step count as in place.
  let position = 0;
  howtos.forEach((element, index) => {
    const theirs = STEP_ORDER.indexOf(element.step);
    if (theirs === -1 || theirs <= order) position = index + 1;
  });
  const repeated = howtos.some((element) => element.step === step);
  const box = howToBox(id, step, product, repeated);
  const before = howtos[position - 1];
  const template = howtos[0];
  if (template) Object.assign(box, { x: template.x, w: template.w, style: { ...box.style, fontSize: template.style.fontSize || box.style.fontSize } });
  insertAfter(page.elements, before || null, box);
  // Keep the order on the page: the editor stacks the boxes by their order from the top.
  const ordered = [...howtos];
  ordered.splice(position, 0, box);
  const top = template ? template.y : 573;
  ordered.forEach((element, index) => { element.y = top + index; });
  relayout(page, "howto");

  // The numbered list: a new line at the same place, then everything renumbered.
  const list = page.elements.find((element) => element.role === "step-list");
  if (list) {
    const lines = list.html.split("<br>").filter((line) => plainText(line).trim() && plainText(line).trim() !== "1.");
    lines.splice(Math.min(position, lines.length), 0, listLine(0, step, product));
    list.html = renumber(lines).join("<br>");
  }

  // The photo strip.
  if (product.image) {
    const photos = page.elements.filter((element) => element.role === "product-photo").sort((a, b) => a.x - b.x);
    if (!photos.some((photo) => photo.productId === productKey(product))) {
      const photo = productPhoto(id, product);
      insertAfter(page.elements, photos.at(-1) || null, photo);
      layoutStripPhotos([...photos, photo]);
    }
  }

  // Sunscreens bring the two finger rule to the morning page.
  if (page.kind === "am" && product.entry?.guides?.includes("spf-two-finger-rule") && !page.elements.some((element) => element.role === "tip")) {
    const footerBox = page.elements.find((element) => element.role === "footer");
    const tips = spfTipBoxes(id);
    const index = footerBox ? page.elements.indexOf(footerBox) : page.elements.length;
    page.elements.splice(index, 0, ...tips);
    page.flows = { ...(page.flows || {}), howto: { ...(page.flows?.howto || { gap: 10, minFontSize: 13 }), bottom: SPF_TIP_FLOW_BOTTOM } };
  }
}

// ── notes ────────────────────────────────────────────────────────────────────

function addNotes(document, id, product) {
  const present = new Set(document.pages.flatMap((page) => page.elements.map((element) => element.snippet).filter(Boolean)));
  const wanted = snippetKeysFor(product).filter(({ key }) => !present.has(key));
  if (!wanted.length) return 0;
  let page = document.pages.find((candidate) => candidate.kind === "notes");
  if (!page) {
    page = { id: id("p"), kind: "notes", flows: { notes: { ...NOTES_FLOW } }, elements: [notesTitle(id), footer(id)] };
    const lastRoutine = document.pages.map((candidate) => candidate.kind).lastIndexOf("pm");
    document.pages.splice(lastRoutine === -1 ? document.pages.length : lastRoutine + 1, 0, page);
  }
  const boxes = page.elements.filter((element) => element.flow === "notes").sort((a, b) => a.y - b.y);
  let anchor = boxes.at(-1) || page.elements.find((element) => element.role === "title") || null;
  // Just under the last note (or at the top of a new page); the editor stacks them properly.
  let y = boxes.length ? boxes.at(-1).y : 174;
  for (const { key, alternatives } of wanted) {
    const box = snippetBox(id, key, product, alternatives);
    box.y = (y += 1);
    insertAfter(page.elements, anchor, box);
    anchor = box;
  }
  page.flows = { notes: { ...NOTES_FLOW }, ...(page.flows || {}) };
  relayout(page, "notes");
  return wanted.length;
}

/**
 * Adds one product to a guide. `item` is a shop product as the admin knows
 * it ({ name, image, step }), matched to the library the same way a new draft
 * is. Returns { document, added, pages } with the guide changed in place, or
 * `added: false` when the product is already in it.
 */
export function addProductToGuide(document, item, { idBase = Date.now().toString(36) } = {}) {
  const [product] = matchProducts([item]);
  if (!product) return { document, added: false, reason: "unknown" };
  const key = productKey(product);
  if (productsInGuide(document).has(key)) return { document, added: false, reason: "already-in", name: product.name };
  // New ids, skipping any the guide already uses (two adds in the same millisecond share a base).
  const used = new Set(document.pages.flatMap((page) => [page.id, ...page.elements.map((element) => element.id)]));
  const make = idMaker(`a${idBase}x`);
  const id = (prefix) => { let value; do value = make(prefix); while (used.has(value)); used.add(value); return value; };

  const touched = new Set();
  if (addToOverview(document, id, product)) touched.add("overview");
  const { am, pm } = planRoutine([product]);
  for (const [time, steps] of [["am", am], ["pm", pm]]) {
    const page = document.pages.find((candidate) => candidate.kind === time);
    if (!page) continue;
    for (const { step } of steps) addToRoutinePage(page, id, step, product);
    if (steps.length) touched.add(time);
  }
  if (addNotes(document, id, product)) touched.add("notes");
  return { document, added: true, name: product.name, key, pages: [...touched], inLibrary: Boolean(product.entry) };
}

/** The name a product goes by in the step lists: its library short name, or the name on its description. */
function listName(document, productId) {
  const entry = GUIDE_PRODUCTS.find((product) => product.id === productId);
  if (entry) return entry.shortName;
  for (const page of document.pages) {
    const why = page.elements.find((element) => element.role === "why" && element.productId === productId);
    if (why) return plainText(why.html).split("\n")[0].trim();
  }
  return null;
}

const renumber = (lines) => lines.map((line, index) => line.replace(/^(\s*(?:<[biu]>)?\s*)\d+\.\s*/, `$1${index + 1}. `));

/**
 * Takes a product out of a guide: its description, photos, how-to boxes, step
 * list lines and the notes no other product in the guide needs. The step lists
 * are renumbered and the editor stacks the text again.
 */
export function removeProductFromGuide(document, productId) {
  const name = listName(document, productId);
  const others = [...productsInGuide(document)].filter((key) => key !== productId);
  const stillNeeded = new Set(others.flatMap((key) => {
    const entry = GUIDE_PRODUCTS.find((product) => product.id === key);
    return entry ? snippetKeysFor({ entry }).map(({ key: snippet }) => snippet) : [];
  }));
  let removed = 0;
  for (const page of document.pages) {
    const mine = page.elements.filter((element) => element.productId === productId && !(element.snippet && stillNeeded.has(element.snippet)));
    if (!mine.length) continue;
    page.elements = page.elements.filter((element) => !mine.includes(element));
    removed += mine.length;
    const list = page.elements.find((element) => element.role === "step-list");
    if (list && name && mine.some((element) => element.role === "howto")) {
      const ending = `\u2014${name}`.toLowerCase();
      const kept = list.html.split("<br>").filter((line) => !plainText(line).trim().toLowerCase().endsWith(ending));
      list.html = renumber(kept).join("<br>");
    }
    for (const flow of new Set(mine.map((element) => element.flow).filter(Boolean))) relayout(page, flow);
    if (mine.some((element) => element.role === "product-photo")) {
      if (page.kind === "overview") {
        for (const label of page.elements.filter((element) => element.role === "grid-label")) layoutCellPhotos(photosInCell(page, label), label.x, label.y);
      } else if (page.kind === "am" || page.kind === "pm") {
        layoutStripPhotos(page.elements.filter((element) => element.role === "product-photo").sort((a, b) => a.x - b.x));
      }
    }
  }
  // A notes page left with nothing but its title goes too.
  document.pages = document.pages.filter((page) => page.kind !== "notes" || page.elements.some((element) => element.role === "snippet"));
  return { document, removed, name };
}
