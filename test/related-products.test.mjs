import assert from "node:assert/strict";
import { relatedProductsFor } from "../src/related-products.js";
import { PRODUCT_FORMULAS } from "../src/data/product-formulas.js";
import { ROUTINES } from "../src/routines.js";

// Mirrors src/square.js's slugify closely enough for this test's plain-ASCII
// product names — no need to duplicate its accent-stripping step here.
function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "item";
}

// All the same category on purpose — isolates the routine/ingredient-tag
// signal from the old "same category" fallback so the tests actually prove
// the new logic, not just that category matching still works.
const products = PRODUCT_FORMULAS.map((record) => ({
  slug: slugify(record.name),
  name: record.name,
  category: "Skincare",
  available: true,
}));
const bySlug = new Map(products.map((product) => [product.slug, product]));

const [brighten, resetBarrier] = ROUTINES;
const brightenCleanser = bySlug.get(brighten.products[0].slug);
const resetCleanser = bySlug.get(resetBarrier.products[0].slug);
assert.ok(brightenCleanser, "the first Brighten Me Up product resolves against the dossier catalog");
assert.ok(resetCleanser, "the first Reset My Barrier product resolves against the dossier catalog");

const brightenRelated = relatedProductsFor(brightenCleanser, products);
assert.equal(brightenRelated.length, 3, "always returns 3 recommendations when the catalog supports it");
assert.ok(
  brightenRelated.every((item) => item.slug !== brightenCleanser.slug),
  "never recommends the product to itself",
);
const brightenRoutineSlugs = new Set(brighten.products.map((item) => item.slug));
assert.ok(
  brightenRelated.some((item) => brightenRoutineSlugs.has(item.slug)),
  "a product's routine-mates outrank unrelated same-category products",
);

const resetRelated = relatedProductsFor(resetCleanser, products);
assert.notDeepEqual(
  brightenRelated.map((item) => item.slug),
  resetRelated.map((item) => item.slug),
  "different products get different recommendations, fixing the always-the-same-3 bug",
);

// No routine, no ingredient dossier, nothing shared at all — must still
// fall back to same-category rather than returning nothing or crashing.
const mystery = { slug: "mystery-serum", name: "Totally New Unlisted Product", category: "Serums", available: true };
const fallbackCatalog = [
  mystery,
  { slug: "serum-a", name: "Serums Neighbor A", category: "Serums", available: true },
  { slug: "serum-b", name: "Serums Neighbor B", category: "Serums", available: true },
  { slug: "cleanser-a", name: "Cleanser Neighbor", category: "Cleansers", available: true },
];
const fallbackRelated = relatedProductsFor(mystery, fallbackCatalog);
assert.deepEqual(
  fallbackRelated.map((item) => item.slug).sort(),
  ["serum-a", "serum-b"],
  "falls back to same-category products when there is no routine or ingredient-tag signal",
);

console.log("PASS  related products are scored per-product (routine + concern tags), not a static per-category list");
