import assert from "node:assert/strict";
import { productPage } from "../src/pages/product.js";
import { toString } from "../src/html.js";

const cfg = { shippingEnabled: true, pickupEnabled: true, shippingFeeCents: 1000, freeShippingThresholdCents: 20000 };
const base = {
  name: "Multi Photo Serum",
  category: "Skincare",
  description: "A serum with several product photos.",
  priceCents: 5000,
  available: true,
  variations: [{ id: "VAR_A", name: "1 oz", priceCents: 5000, inStock: true }],
  defaultVariation: { id: "VAR_A", name: "1 oz", priceCents: 5000, inStock: true },
};

// Multiple images: thumbnails + a full lightbox with prev/next.
const multi = { ...base, image: "https://example.com/1.jpg", images: ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"] };
const multiMarkup = toString(productPage({ product: multi, related: [], cfg }));
assert.match(multiMarkup, /data-product-gallery/, "the gallery wrapper renders when photos exist");
assert.match(multiMarkup, /data-gallery-main/, "the main image is marked for client-side swapping");
assert.equal((multiMarkup.match(/data-gallery-thumb=/g) || []).length, 3, "one thumbnail per photo");
assert.match(multiMarkup, /class="gallery-thumb active"/, "the first thumbnail starts active");
assert.match(multiMarkup, /data-gallery-zoom/, "a zoom affordance opens the lightbox");
assert.match(multiMarkup, /data-gallery-lightbox/, "the lightbox dialog renders");
assert.match(multiMarkup, /data-gallery-prev/, "multi-photo products get a previous control");
assert.match(multiMarkup, /data-gallery-next/, "multi-photo products get a next control");

// Single image: no thumbnail row, but zoom still works — no prev/next since
// there's nowhere to navigate to.
const single = { ...base, image: "https://example.com/1.jpg", images: ["https://example.com/1.jpg"] };
const singleMarkup = toString(productPage({ product: single, related: [], cfg }));
assert.match(singleMarkup, /data-product-gallery/, "a single photo still gets the gallery wrapper");
assert.doesNotMatch(singleMarkup, /product-gallery-thumbs/, "a single photo renders no thumbnail row");
assert.match(singleMarkup, /data-gallery-zoom/, "a single photo can still be zoomed");
assert.doesNotMatch(singleMarkup, /data-gallery-prev/, "a single photo has no previous control");
assert.doesNotMatch(singleMarkup, /data-gallery-next/, "a single photo has no next control");

// No images at all: the original fallback, no gallery markup whatsoever.
const empty = { ...base, image: null, images: [] };
const emptyMarkup = toString(productPage({ product: empty, related: [], cfg }));
assert.doesNotMatch(emptyMarkup, /data-product-gallery/, "products with no photo render no gallery wrapper");
assert.doesNotMatch(emptyMarkup, /data-gallery-lightbox/, "products with no photo render no lightbox");
assert.match(emptyMarkup, /class="product-image-fallback"/, "products with no photo keep the text fallback");

// Backward compatibility: products fetched before the `images` field existed
// (or any caller that only ever set `image`) still get a working gallery.
const legacy = { ...base, image: "https://example.com/only.jpg" };
delete legacy.images;
const legacyMarkup = toString(productPage({ product: legacy, related: [], cfg }));
assert.match(legacyMarkup, /data-product-gallery/, "a product with only `image` set still renders the gallery wrapper");
assert.doesNotMatch(legacyMarkup, /product-gallery-thumbs/, "a product with only `image` set has no thumbnail row");

console.log("PASS  product photo gallery renders thumbnails, zoom, and lightbox navigation correctly");
