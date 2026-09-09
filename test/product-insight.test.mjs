import assert from "node:assert/strict";
import { productPage } from "../src/pages/product.js";
import { productInsightFor } from "../src/product-insights.js";
import { CLIENT_JS } from "../src/client/cart.js";
import { toString } from "../src/html.js";
import { STYLES } from "../src/styles.js";

const product = {
  name: "Arctigenin Brightening Treatment",
  category: "Skincare",
  description: "A brightening treatment.",
  image: "https://example.com/arctigenin.jpg",
  priceCents: 17500,
  available: true,
  variations: [{ id: "VAR_A", name: "1 oz", priceCents: 17500, inStock: true }],
  defaultVariation: { id: "VAR_A", name: "1 oz", priceCents: 17500, inStock: true },
};
const cfg = {
  shippingEnabled: true,
  pickupEnabled: true,
  shippingFeeCents: 1000,
  freeShippingThresholdCents: 20000,
};

const review = productInsightFor(product.name);
assert.ok(review, "Arctigenin has a product insight record");
assert.equal(review.ingredients.length, 19, "the published 19-ingredient formula is complete");
assert.equal(review.ingredients.filter((item) => item.featured).length, 6, "six meaningful ingredients are featured");

const markup = toString(productPage({ product, related: [], cfg }));
assert.match(markup, /data-ingredient-review/, "the review is rendered on the matching product page");
assert.match(markup, /role="tablist"/, "desktop review uses accessible tabs");
assert.match(markup, /breadcrumbs[\s\S]*role="tablist"[\s\S]*<h1>/, "the horizontal tabs sit above the product information");
assert.doesNotMatch(markup, /product-insight-mobile/, "mobile keeps the same tab system rather than duplicating content");
assert.match(STYLES, /\.insight-tab-list \{[\s\S]*?display: flex;[\s\S]*?overflow-x: auto;/, "tabs remain a horizontal scrollable row");
assert.match(markup, /Explore all 19 ingredients/, "the full formula is available");
assert.match(markup, /Disodium S-Phytyl Diglycoloylcysteine/, "technical INCI names are preserved");
assert.doesNotMatch(markup, /ingredient score|hazard score/i, "the review does not imply a context-free safety score");
assert.match(CLIENT_JS, /function initProductInsights\(\)/, "the client bundle initializes interactive tabs");

const unrelated = { ...product, name: "Another Product" };
const unrelatedMarkup = toString(productPage({ product: unrelated, related: [], cfg }));
assert.doesNotMatch(unrelatedMarkup, /data-ingredient-review/, "unreviewed products keep their existing product page");

console.log("PASS  Arctigenin ingredient review is complete, scoped, and progressively enhanced");

