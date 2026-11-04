// Splits an uploaded export into individual pages and fingerprints each one,
// so a re-exported notebook (which always contains every page from every
// earlier upload, not just the new ones) can be deduplicated against what
// we've already processed for this client.
//
// The fingerprint is a hash of each page's structural content (drawing
// operators + embedded image bytes), not the rendered pixels — rasterizing
// a PDF needs a renderer this Worker doesn't have, and not the raw file
// bytes either, since PDF metadata (timestamps, object ids) can change on
// re-export without the visible page changing at all. It is deliberately
// *not* based on page position or count: Noteful can reorder or insert
// pages, and a position-based scheme would either miss a genuinely new page
// or silently skip a moved one.
//
// A page whose structural bytes happen to differ from last time for a
// reason other than real edited content (e.g. an image re-compressed
// slightly differently on export) just gets reprocessed — wasted effort,
// never a lost or duplicated note. That's the safe side to err on.

import { PDFDocument, PDFArray, PDFRef, PDFDict, PDFName } from "pdf-lib";

/**
 * Split a PDF into single-page PDFs and compute each page's content hash.
 * Returns pages in file order; order is used only for grouping consecutive
 * new pages into one note later, never as a date or dedup signal.
 */
export async function splitPdfPages(pdfBytes) {
  const source = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageCount = source.getPageCount();
  const pages = [];

  for (let index = 0; index < pageCount; index += 1) {
    const doc = await PDFDocument.create();
    const [copied] = await doc.copyPages(source, [index]);
    doc.addPage(copied);
    const bytes = await doc.save();
    pages.push({ index, bytes, hash: await hashPageContent(source, index) });
  }

  return pages;
}

/**
 * Hash one page's structural content: its content stream(s) plus the raw
 * bytes of any image XObjects it draws. Two exports of an unchanged page
 * should produce the same drawing instructions and the same embedded image
 * bytes even if the surrounding PDF's metadata differs.
 */
async function hashPageContent(doc, pageIndex) {
  const page = doc.getPage(pageIndex);
  const parts = [];

  for (const stream of resolveContentStreams(doc, page.node.Contents())) {
    if (stream?.getContents) parts.push(stream.getContents());
  }

  const xobjects = resolveDict(doc, page.node.Resources()?.get?.(PDFName.of("XObject")));
  if (xobjects) {
    for (const [, ref] of xobjects.entries()) {
      const xobject = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
      if (xobject?.getContents) parts.push(xobject.getContents());
    }
  }

  const bytes = concatBytes(parts);
  return sha256Hex(bytes);
}

/** A page's /Contents is a single ref or an array of refs — normalize to a list of resolved streams. */
function resolveContentStreams(doc, contents) {
  if (!contents) return [];
  if (contents instanceof PDFArray) {
    return contents.asArray().map((ref) => (ref instanceof PDFRef ? doc.context.lookup(ref) : ref));
  }
  return [contents instanceof PDFRef ? doc.context.lookup(contents) : contents];
}

function resolveDict(doc, value) {
  if (!value) return null;
  const resolved = value instanceof PDFRef ? doc.context.lookup(value) : value;
  return resolved instanceof PDFDict ? resolved : null;
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A plain image upload (Noteful's "Image" export) has no PDF structure to
 * hash — hash the raw file bytes directly. Each image file is one page.
 */
export async function hashImageBytes(bytes) {
  return sha256Hex(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
}

/**
 * Given the full set of pages in a new upload and the hashes already on
 * record for this client, return which pages are genuinely new (by hash,
 * not position) and which previously-seen pages are missing from this
 * upload — a sign the wrong file was uploaded, or a page was deleted.
 */
export function diffPages(pages, knownHashes) {
  const known = new Set(knownHashes);
  const newPages = pages.filter((page) => !known.has(page.hash));
  const seenNow = new Set(pages.map((page) => page.hash));
  const missingHashes = [...known].filter((hash) => !seenNow.has(hash));
  return { newPages, missingHashes };
}
