import assert from "node:assert/strict";
import { productPage } from "../src/pages/product.js";
import { productInsightCoverage, productInsightFor } from "../src/product-insights.js";
import { PRODUCT_FORMULAS } from "../src/data/product-formulas.js";
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
assert.equal((markup.match(/role="tab"/g) || []).length, 2, "the product page shows only Overview and Ingredients tabs");
assert.doesNotMatch(markup, /insight-tab-laura|Laura&#8217;s formula read/, "Laura's formula-read tab and panel are hidden");
assert.doesNotMatch(markup, /Formula at a glance|overview-formula-glance/, "the oversized formula-at-a-glance block is removed");
assert.doesNotMatch(markup, /product-insight-mobile/, "mobile keeps the same tab system rather than duplicating content");
assert.match(STYLES, /\.insight-tab-list \{[\s\S]*?display: flex;[\s\S]*?overflow-x: auto;/, "tabs remain a horizontal scrollable row");
assert.match(STYLES, /\.ingredient-list \{[\s\S]*?max-height:[\s\S]*?overflow-y: auto;/, "the complete ingredient list scrolls inside a bounded region");
assert.match(markup, /class="ingredient-list" role="region" aria-label="Full ingredient list" tabindex="0"/, "the scrollable list is keyboard accessible");
assert.match(markup, /Explore all 19 ingredients/, "the full formula is available");
assert.match(markup, /Disodium S-Phytyl Diglycoloylcysteine/, "technical INCI names are preserved");
assert.doesNotMatch(markup, /ingredient score|hazard score/i, "the review does not imply a context-free safety score");
assert.match(CLIENT_JS, /function initProductInsights\(\)/, "the client bundle initializes interactive tabs");

const coverage = productInsightCoverage();
assert.equal(coverage.total, 82, "all 82 researched Square products have formula records");
assert.equal(coverage.withFormula, 79, "79 products have at least a published or partial formula");
assert.equal(new Set(PRODUCT_FORMULAS.map((item) => item.name)).size, PRODUCT_FORMULAS.length, "formula records are unique by product name");
for (const formula of PRODUCT_FORMULAS) {
  const insight = productInsightFor(formula.name);
  assert.ok(insight, `${formula.name} maps to an insight record`);
  assert.equal(insight.hasFormula, Boolean(formula.formula), `${formula.name} reports formula availability accurately`);
  if (formula.formula) assert.ok(insight.ingredients.length > 0, `${formula.name} exposes its published ingredients`);
  const productMarkup = toString(productPage({ product: { ...product, name: formula.name }, related: [], cfg }));
  assert.match(productMarkup, /data-ingredient-review/, `${formula.name} renders the shared ingredient-review experience`);
}

const cbdReview = productInsightFor("CBD SKIN MIST");
assert.equal(cbdReview.ingredients.length, 32, "undelimited published formulas are normalized into individual ingredients");
const cbdMarkup = toString(productPage({ product: { ...product, name: "CBD SKIN MIST" }, related: [], cfg }));
assert.match(cbdMarkup, /Explore all 32 ingredients/, "catalogue products render the full expandable ingredient browser");

const bundleMarkup = toString(productPage({ product: { ...product, name: "Cleansing Essentials Set" }, related: [], cfg }));
assert.match(bundleMarkup, /Component formulas; verify set contents/, "sets disclose that their component formulas need confirmation");
assert.match(bundleMarkup, /Part of Oil Cleanser/, "set ingredients retain their component relationship");

const pendingMarkup = toString(productPage({ product: { ...product, name: "KrX Cica Recovery Bundle" }, related: [], cfg }));
assert.match(pendingMarkup, /The current package panel is still needed/, "unverified formulas show an honest holding state");
assert.doesNotMatch(pendingMarkup, /Explore all \d+ ingredients/, "unverified formulas do not display invented ingredient rows");

const deviceMarkup = toString(productPage({ product: { ...product, name: "Omnilux Contour Face Mask" }, related: [], cfg }));
assert.match(deviceMarkup, /No cosmetic ingredient list applies/, "devices receive device guidance rather than a missing-formula warning");
assert.doesNotMatch(deviceMarkup, /current package panel is still needed/, "devices are not mislabeled as unverified cosmetics");

const unrelated = { ...product, name: "Another Product" };
const unrelatedMarkup = toString(productPage({ product: unrelated, related: [], cfg }));
assert.doesNotMatch(unrelatedMarkup, /data-ingredient-review/, "unreviewed products keep their existing product page");

console.log("PASS  Arctigenin ingredient review is complete, scoped, and progressively enhanced");
