// The Skincare Guide product library: every entry points at a real shop product,
// names resolve to one entry, and the wording rules Laura asked for hold.
import assert from "node:assert/strict";
import {
  GUIDE_PRODUCTS, GUIDE_SNIPPETS, GUIDE_STEPS, GRID_GROUPS, STEP_DEFAULTS, guideProductFor, howToFor,
} from "../src/data/guide-library.js";
import { PRODUCT_FORMULAS } from "../src/data/product-formulas.js";

const shopNames = new Set(PRODUCT_FORMULAS.map((record) => record.name));
const stepIds = new Set(GUIDE_STEPS.map((step) => step.id));

const ids = new Set();
for (const product of GUIDE_PRODUCTS) {
  assert.ok(!ids.has(product.id), `duplicate id ${product.id}`);
  ids.add(product.id);
  assert.ok(shopNames.has(product.squareName), `${product.id}: "${product.squareName}" is not a shop product`);
  assert.ok(GRID_GROUPS.includes(product.grid), `${product.id}: unknown grid group ${product.grid}`);
  assert.ok(product.steps.length, `${product.id}: no steps`);
  for (const step of product.steps) assert.ok(stepIds.has(step), `${product.id}: unknown step ${step}`);
  for (const step of Object.keys(product.howTo)) assert.ok(stepIds.has(step), `${product.id}: how-to for unknown step ${step}`);
  assert.equal(product.why === null, product.status === "needs-description", `${product.id}: status and description disagree`);
  for (const key of product.guides || []) assert.ok(GUIDE_SNIPPETS[key], `${product.id}: missing snippet ${key}`);
  assert.ok(product.seenIn.length, `${product.id}: no source guide`);
}
console.log(`PASS  ${GUIDE_PRODUCTS.length} library products all match a shop product`);

for (const product of GUIDE_PRODUCTS) {
  for (const name of [product.name, product.shortName, product.squareName, ...product.aliases]) {
    assert.equal(guideProductFor(name)?.id, product.id, `"${name}" should find ${product.id}`);
  }
}
assert.equal(guideProductFor("clearplex 2.8%").id, "mixi-clear-plex-2-8");
assert.equal(guideProductFor("Clear & Prevent Toner").id, "krx-clear-prevent-toner");
assert.equal(guideProductFor("KrX AquaGel™ Cream").id, "krx-aquagel-cream");
assert.equal(guideProductFor("Tretinoin"), null, "products not sold in the shop are left for Laura");
console.log("PASS  every spelling seen in the guides resolves to exactly one product");

const cleanseSteps = ["firstCleanse", "cleanse", "secondCleanse"];
for (const product of GUIDE_PRODUCTS) {
  for (const step of cleanseSteps) {
    const text = product.howTo[step];
    if (!text) continue;
    assert.match(text, /nickel-size amount/, `${product.id} ${step} should use a nickel-size amount`);
    assert.doesNotMatch(text, /\bpumps?\b|quarter|dime/i, `${product.id} ${step} still names another amount`);
  }
}
for (const step of cleanseSteps) assert.match(STEP_DEFAULTS[step], /nickel-size amount/);
console.log("PASS  every cleanser step says a nickel-size amount");

assert.equal(howToFor(guideProductFor("Rich M Cream"), "moisturize"), STEP_DEFAULTS.moisturize);
assert.match(howToFor(guideProductFor("Mixi Clean"), "secondCleanse"), /nickel-size/, "falls back to the step's usual wording");
const typos = /enitre|sulfir|instrctions|Amelts|noght|moistrizer|recommendedon/i;
for (const product of GUIDE_PRODUCTS) {
  for (const text of [product.why, ...Object.values(product.howTo), ...(product.whyAlternates || []).map((a) => a.text)]) {
    if (text) assert.doesNotMatch(text, typos, `${product.id} still has a typo`);
  }
}
console.log("PASS  how-to fallbacks and typo fixes");
