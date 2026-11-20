// The shape of a Skincare Guide document, and the checks every saved copy goes
// through. A guide is a list of A4 pages; each page is a list of boxes placed
// on a 794 x 1123 sheet (Canva's A4 size in CSS pixels), so what she drags in
// the editor is exactly what prints.
//
// Document:
//   { version: 1, clientName, needsLayout, pages: [Page], createdFrom }
// Page:
//   { id, kind: "cover" | "overview" | "am" | "pm" | "notes" | "resource" | "blank", elements: [Element],
//     resource? (which resource page: "hormones", "makeup"… see src/data/guide-resources.js),
//     flows?: { [name]: { gap, bottom, minFontSize } } }
// Element:
//   { id, type: "text" | "image" | "line", x, y, w, h?,
//     html (text: only <b>, <i>, <u> and <br>), src + alt + fit (image),
//     style: { font, fontSize, fontWeight, lineHeight, letterSpacing, align, uppercase, opacity, color,
//              shadow (images: a soft drop shadow, for the cut-out product photos) },
//     origin: "library" (Laura's own words) | "check" (needs a look) | "edited" | "template",
//     role?, productId?, flow?, step? (how-to boxes), snippet? (notes),
//     link? (an https address the box opens in the PDF: the shop buttons) }
//
// "flow" boxes (the product descriptions, the how-to steps) are stacked under
// each other the first time the editor opens a new draft, once it can measure
// how tall each one really is (see editor-client.js).

export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;
export const PAPER = "#f1e5e0";
export const INK = "#231f20";

export const FONTS = {
  body: { label: "Jost", css: "'Jost', 'Futura', 'Century Gothic', system-ui, sans-serif" },
  script: { label: "Script", css: "'Allura', 'Snell Roundhand', cursive" },
  sign: { label: "Signature", css: "'Allison', 'Snell Roundhand', cursive" },
};

export const GOOGLE_FONTS_URL = "https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,700&family=Allura&family=Allison&display=swap";

const PAGE_KINDS = new Set(["cover", "overview", "am", "pm", "notes", "resource", "blank"]);
const ELEMENT_TYPES = new Set(["text", "image", "line"]);
const ORIGINS = new Set(["library", "check", "edited", "template"]);
const ALIGNS = new Set(["left", "center", "right", "justify"]);
const FITS = new Set(["contain", "cover"]);

export const LIMITS = { pages: 40, elementsPerPage: 150, htmlLength: 6000, documentBytes: 1_000_000 };

const ALLOWED_TAGS = { b: "b", strong: "b", i: "i", em: "i", u: "u", br: "br" };

function escapeText(text) {
  // Keep entities that are already escaped (&amp;, &#39;, &nbsp;), escape everything else.
  return text
    .replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Text box markup, cut down to bold, italic, underline and line breaks. Every
 * other tag is dropped (its text kept) and attributes never survive, so nothing
 * typed or pasted into a box can run as code when the guide is opened.
 */
export function sanitizeHtml(value) {
  const input = String(value ?? "").slice(0, LIMITS.htmlLength);
  let out = "";
  let last = 0;
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/g;
  for (const match of input.matchAll(tag)) {
    out += escapeText(input.slice(last, match.index));
    last = match.index + match[0].length;
    const name = ALLOWED_TAGS[match[2].toLowerCase()];
    if (!name) continue;
    if (name === "br") out += "<br>";
    else out += match[1] ? `</${name}>` : `<${name}>`;
  }
  out += escapeText(input.slice(last));
  return balanceTags(out);
}

// Closes any <b>/<i>/<u> left open and drops closing tags with no opener, so one box can't restyle the next.
function balanceTags(markup) {
  const open = [];
  const result = markup.replace(/<(\/?)(b|i|u)>/g, (whole, closing, name) => {
    if (!closing) { open.push(name); return whole; }
    const index = open.lastIndexOf(name);
    if (index === -1) return "";
    const reopen = open.splice(index).slice(1);
    open.push(...reopen);
    return `${reopen.map((n) => `</${n}>`).reverse().join("")}</${name}>${reopen.map((n) => `<${n}>`).join("")}`;
  });
  return result + open.reverse().map((name) => `</${name}>`).join("");
}

/** Plain text of a box, for search, tests and the page outline. */
export function plainText(markup) {
  return String(markup || "")
    .replace(/<br>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

/** Links in the PDF may only be plain https addresses. */
export function safeLink(value) {
  const link = String(value || "").trim();
  return /^https:\/\/[^\s"'<>()\\]+$/.test(link) && link.length <= 500 ? link : null;
}

/** Images may only come from the shop's own /media folder or an https address (Square's product photos). */
export function safeImageSrc(value) {
  const src = String(value || "").trim();
  if (/^\/media\/[A-Za-z0-9/_.-]+$/.test(src) && !src.includes("..")) return src;
  if (/^https:\/\/[^\s"'<>()\\]+$/.test(src) && src.length <= 1000) return src;
  return null;
}

function num(value, { min, max, fallback = 0 }) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number * 100) / 100));
}

function shortString(value, max = 80) {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

function cleanStyle(style = {}) {
  const clean = {};
  if (style.font in FONTS) clean.font = style.font;
  if (style.fontSize !== undefined) clean.fontSize = num(style.fontSize, { min: 4, max: 240, fallback: 16 });
  if (style.fontWeight !== undefined) clean.fontWeight = num(style.fontWeight, { min: 100, max: 900, fallback: 400 });
  if (style.lineHeight !== undefined) clean.lineHeight = num(style.lineHeight, { min: 0.5, max: 3, fallback: 1.25 });
  if (style.letterSpacing !== undefined) clean.letterSpacing = num(style.letterSpacing, { min: -0.2, max: 0.5, fallback: 0 });
  if (ALIGNS.has(style.align)) clean.align = style.align;
  if (style.uppercase) clean.uppercase = true;
  if (style.italic) clean.italic = true;
  if (style.shadow) clean.shadow = true;
  if (style.underline) clean.underline = true;
  if (style.opacity !== undefined) clean.opacity = num(style.opacity, { min: 0, max: 1, fallback: 1 });
  if (typeof style.color === "string" && /^#[0-9a-fA-F]{6}$/.test(style.color)) clean.color = style.color.toLowerCase();
  if (style.strokeWidth !== undefined) clean.strokeWidth = num(style.strokeWidth, { min: 0.5, max: 10, fallback: 1 });
  return clean;
}

function cleanElement(element, index) {
  if (!element || typeof element !== "object" || !ELEMENT_TYPES.has(element.type)) return null;
  const clean = {
    id: /^[A-Za-z0-9_-]{1,40}$/.test(element.id) ? element.id : `x${index}`,
    type: element.type,
    x: num(element.x, { min: -PAGE_WIDTH, max: PAGE_WIDTH * 2 }),
    y: num(element.y, { min: -PAGE_HEIGHT, max: PAGE_HEIGHT * 2 }),
    w: num(element.w, { min: 1, max: PAGE_WIDTH * 2, fallback: 200 }),
  };
  if (element.type !== "text" || element.h !== undefined) {
    clean.h = num(element.h, { min: element.type === "line" ? 0 : 1, max: PAGE_HEIGHT * 2, fallback: element.type === "line" ? 0 : 100 });
  }
  if (element.type === "text") clean.html = sanitizeHtml(element.html);
  if (element.type === "image") {
    const src = safeImageSrc(element.src);
    if (!src) return null;
    clean.src = src;
    clean.alt = shortString(element.alt, 200) || "";
    clean.fit = FITS.has(element.fit) ? element.fit : "contain";
  }
  clean.style = cleanStyle(element.style);
  clean.origin = ORIGINS.has(element.origin) ? element.origin : "edited";
  for (const key of ["role", "productId", "flow", "note", "step", "snippet"]) {
    const value = shortString(element[key], key === "note" ? 300 : 80);
    if (value) clean[key] = value;
  }
  const link = safeLink(element.link);
  if (link) clean.link = link;
  return clean;
}

function cleanFlows(flows) {
  if (!flows || typeof flows !== "object") return undefined;
  const clean = {};
  for (const [name, flow] of Object.entries(flows).slice(0, 5)) {
    if (!/^[a-z]{1,20}$/.test(name) || !flow || typeof flow !== "object") continue;
    clean[name] = {
      gap: num(flow.gap, { min: 0, max: 200, fallback: 12 }),
      bottom: num(flow.bottom, { min: 0, max: PAGE_HEIGHT, fallback: 1040 }),
      minFontSize: num(flow.minFontSize, { min: 6, max: 40, fallback: 12 }),
    };
  }
  return Object.keys(clean).length ? clean : undefined;
}

/**
 * A copy of a guide document with every value checked and clamped, or null
 * when it isn't a guide at all. Used on every save from the editor.
 */
export function cleanDocument(document) {
  if (!document || typeof document !== "object" || !Array.isArray(document.pages)) return null;
  const pages = document.pages.slice(0, LIMITS.pages).map((page, pageIndex) => {
    const elements = (Array.isArray(page?.elements) ? page.elements : [])
      .slice(0, LIMITS.elementsPerPage)
      .map(cleanElement)
      .filter(Boolean);
    const clean = {
      id: /^[A-Za-z0-9_-]{1,40}$/.test(page?.id) ? page.id : `page${pageIndex}`,
      kind: PAGE_KINDS.has(page?.kind) ? page.kind : "blank",
      elements,
    };
    if (clean.kind === "resource" && /^[a-z0-9-]{1,40}$/.test(page?.resource)) clean.resource = page.resource;
    const flows = cleanFlows(page?.flows);
    if (flows) clean.flows = flows;
    // Flows the editor should stack again (after a product was added or removed).
    const relayout = Array.isArray(page?.relayout) ? page.relayout.filter((name) => flows && name in flows) : [];
    if (relayout.length) clean.relayout = [...new Set(relayout)];
    return clean;
  });
  return {
    version: 1,
    clientName: shortString(document.clientName, 80) || "",
    needsLayout: Boolean(document.needsLayout),
    pages,
    ...(document.createdFrom && typeof document.createdFrom === "object" ? { createdFrom: cleanCreatedFrom(document.createdFrom) } : {}),
  };
}

function cleanCreatedFrom(from) {
  return {
    orderedAt: shortString(from.orderedAt, 40) || null,
    products: Array.isArray(from.products) ? from.products.slice(0, 60).map((name) => shortString(name, 120)).filter(Boolean) : [],
  };
}

/** Boxes that still need a look before the guide goes out. */
export function itemsToCheck(document) {
  const items = [];
  for (const [pageIndex, page] of (document?.pages || []).entries()) {
    for (const element of page.elements) {
      if (element.origin === "check") items.push({ page: pageIndex, id: element.id, note: element.note || "" });
    }
  }
  return items;
}
