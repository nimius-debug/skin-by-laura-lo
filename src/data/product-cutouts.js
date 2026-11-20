// Cut-out product photos (background removed) for the Skincare Guide PDFs.
// The photos are made by scripts/product-cutouts.py from the Square catalog and
// listed in product-cutouts.data.js, keyed by the Square photo's id, so a
// product whose photo changes in Square goes back to the plain photo until the
// script is run again.

import { CUTOUTS } from "./product-cutouts.data.js";

/** The Square photo id in an image URL (…/files/<id>/original.jpeg), or null. */
export function squarePhotoId(url) {
  const match = /^https:\/\/items-images-[a-z]+\.s3\.[a-z0-9-]+\.amazonaws\.com\/files\/([0-9a-f]{20,64})\//.exec(String(url || ""));
  return match ? match[1] : null;
}

/** The cut-out of a Square product photo, or null when it hasn't been made. */
export function cutoutFor(url) {
  const id = squarePhotoId(url);
  return id && Object.hasOwn(CUTOUTS, id) ? `/media/products/cutouts/${id}.webp` : null;
}
