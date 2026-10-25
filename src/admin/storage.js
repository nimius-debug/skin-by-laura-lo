// R2 storage for note page files. Only the pages belonging to a given note
// are kept — never the whole re-exported notebook on every upload, which
// would mostly duplicate bytes already stored from the previous upload.

export async function putDraftPage(env, draftId, pageIndex, bytes, extension) {
  const key = `drafts/${draftId}/page-${pageIndex}.${extension}`;
  await env.NOTES_BUCKET.put(key, bytes);
  return key;
}

export async function putFinalNote(env, clientId, noteId, bytes, extension) {
  const key = `notes/${clientId}/${noteId}.${extension}`;
  await env.NOTES_BUCKET.put(key, bytes);
  return key;
}

export async function getObject(env, key) {
  return env.NOTES_BUCKET.get(key);
}

/** Whether an object is stored, without reading its bytes where the bucket allows. */
export async function hasObject(env, key) {
  const found = env.NOTES_BUCKET.head ? await env.NOTES_BUCKET.head(key) : await env.NOTES_BUCKET.get(key);
  return Boolean(found);
}

/** Where a photo on an iPad note is kept. Ids are checked against IMAGE_ID before they get here. */
export function noteImageKey(clientId, noteId, imageId) {
  return `ink/${clientId}/${noteId}/${imageId}.jpg`;
}

export async function deleteObjects(env, keys) {
  if (keys.length) await env.NOTES_BUCKET.delete(keys);
}

/** Combine several single-page PDF byte arrays into one multi-page PDF for a note's "original". */
export async function mergePdfPages(pageByteArrays) {
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  for (const bytes of pageByteArrays) {
    const source = await PDFDocument.load(bytes);
    const copied = await merged.copyPages(source, source.getPageIndices());
    copied.forEach((page) => merged.addPage(page));
  }
  return merged.save();
}

/**
 * Normalize one or more image uploads (Noteful's "Image" export) into a
 * single PDF, so a note's stored "original" is always a PDF regardless of
 * which export format Laura used.
 */
export async function mergeImagesToPdf(images) {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  for (const { bytes, mediaType } of images) {
    const embedded = mediaType === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const page = doc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  }
  return doc.save();
}

/** Move a draft object to its permanent key once Laura confirms it. */
export async function promoteDraftObject(env, draftKey, finalKey) {
  const object = await env.NOTES_BUCKET.get(draftKey);
  if (!object) throw new Error(`Draft object missing: ${draftKey}`);
  await env.NOTES_BUCKET.put(finalKey, await object.arrayBuffer());
  await env.NOTES_BUCKET.delete(draftKey);
}
