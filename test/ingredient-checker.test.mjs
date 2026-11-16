// The public ingredient checker: paste a list or pick a shop product, see the
// pore-cloggers and every ingredient explained, and get better alternatives
// from the shop only when they are both better and similar.
import assert from "node:assert/strict";
import worker from "../src/index.js";
import {
  parseIngredientList, checkIngredients, describeIngredient, productTypeFor, ingredientSlug, betterAlternatives,
} from "../src/ingredient-checker.js";
import { poreCloggerFor } from "../src/data/pore-cloggers.js";
import { squareFetch, SQUARE_ENV } from "./helpers/checker-catalog.mjs";
import { CLIENT_JS } from "../src/client/cart.js";

// ------------------------------------------------------------ reading a list
assert.deepEqual(
  parseIngredientList("Ingredients: Water, 1,2-Hexanediol, Glycerin*; Niacinamide\nFragrance. May contain: CI 77491"),
  ["Water", "1,2-Hexanediol", "Glycerin", "Niacinamide", "Fragrance"],
);
assert.deepEqual(parseIngredientList("Water, water, Glycerin"), ["Water", "Glycerin"], "duplicates are read once");
assert.deepEqual(parseIngredientList(""), []);
console.log("PASS  a pasted label is split into ingredient names");

// ------------------------------------------------------------ pore-cloggers
for (const name of ["Isopropyl Myristate", "Cocos Nucifera (Coconut) Oil", "Algae Extract", "Laureth-4", "Sodium Lauryl Sulfate", "Octyl Palmitate"]) {
  assert.ok(poreCloggerFor(name), `${name} is flagged`);
}
for (const name of ["Sodium Laureth Sulfate", "Coco-Caprylate", "Cocamidopropyl Betaine", "Laureth-40", "Glyceryl Stearate", "Zea Mays (Corn) Starch", "Glycerin"]) {
  assert.equal(poreCloggerFor(name), null, `${name} is not flagged`);
}
const result = checkIngredients(parseIngredientList("Water, Glycerin, Isopropyl Myristate, Niacinamide, Cocos Nucifera (Coconut) Oil, Fragrance"));
assert.deepEqual(result.cloggers.map((item) => item.name), ["Isopropyl Myristate", "Cocos Nucifera (Coconut) Oil"]);
assert.deepEqual(result.notes.map((item) => item.name), ["Fragrance"]);
assert.ok(result.helpers.some((item) => item.name === "Niacinamide"));
assert.equal(result.acneSafe, false);
assert.equal(describeIngredient("Isopropyl Myristate").role, "Emollient · Fatty ester", "a pore-clogger the library lacks still gets a real role");
console.log("PASS  pore-cloggers are flagged without catching their safe relatives");

// ------------------------------------------------------------ product types
assert.equal(productTypeFor("Corthe Dermo Pure Cleansing Oil"), "cleanser");
assert.equal(productTypeFor("KrX Active 31 Revitalizing Eye Cream"), "eye");
assert.equal(productTypeFor("Soba Calm Cream"), "moisturizer");
assert.equal(productTypeFor("Desembre EGF Waterdrop"), "sunscreen");
assert.equal(productTypeFor("Luxury Skincare Set"), "", "sets are never matched as a swap");
console.log("PASS  products are sorted into kinds");

// ------------------------------------------------------------ pages
globalThis.fetch = squareFetch(globalThis.fetch);
const get = async (path) => {
  const response = await worker.fetch(new Request(`https://test.skinbylauralo.com${path}`), SQUARE_ENV);
  return { status: response.status, body: await response.text(), cache: response.headers.get("cache-control") };
};
const LIST = encodeURIComponent("Water, Glycerin, Isopropyl Myristate, Niacinamide, Cocos Nucifera (Coconut) Oil, Dimethicone, Fragrance");

let page = await get("/ingredients");
assert.equal(page.status, 200);
assert.match(page.body, /<textarea id="checker-list" name="list"/);
assert.match(page.body, /aria-current="page"[^>]*>Ingredient checker|href="\/ingredients"[^>]*aria-current/, "the menu marks the checker");
assert.doesNotMatch(page.body, /id="result"/, "no result before a check");
console.log("PASS  the checker page renders its form");

page = await get(`/ingredients?list=${LIST}&type=moisturizer`);
assert.match(page.body, /2 pore-clogging ingredients found/);
assert.match(page.body, /What it means/);
assert.match(page.body, /Keep in mind/);
assert.match(page.body, /checker-ingredient checker-ingredient-clog/);
assert.match(page.body, /href="\/ingredients\/isopropyl-myristate"/, "a pore-clogger links to its page");
assert.match(page.body, /Better alternatives/);
assert.match(page.body, /Soba Calm Cream/);
assert.doesNotMatch(page.body, /<h3>Corthe Rich M Lotion/, "a product with a pore-clogger is never suggested");
assert.doesNotMatch(page.body, /<h3>Corthe Bifida Ampoule/, "a product of another kind is never suggested");
assert.equal(page.cache, "no-store", "a personal check is not cached");
console.log("PASS  a pasted list shows the verdict, every ingredient, and similar better products");

page = await get(`/ingredients?list=${LIST}`);
assert.match(page.body, /Want a better alternative\?/, "without a product kind the page asks for one");
assert.doesNotMatch(page.body, /Better alternatives/);
page = await get(`/ingredients?list=${encodeURIComponent("Water, Glycerin, Niacinamide")}&type=moisturizer`);
assert.match(page.body, /No known pore-cloggers found/);
assert.doesNotMatch(page.body, /Better alternatives|Want a better alternative/, "a clean list gets no swaps");
console.log("PASS  alternatives only when the shop product is better and the same kind");

page = await get("/ingredients?tab=product&q=corthe");
assert.match(page.body, /Pick a product/);
assert.match(page.body, /product=corthe-rich-m-lotion/);
page = await get("/ingredients?tab=product");
const data = JSON.parse(page.body.match(/<script type="application\/json" data-checker-products>([\s\S]*?)<\/script>/)[1]);
const rich = data.find((product) => product.name === "Corthe Rich M Lotion");
assert.match(rich.image, /^https:\/\/items-images-production/, "each suggestion carries its photo");
assert.equal(rich.kind, "Moisturizer");
assert.equal(rich.acneSafe, false);
assert.equal(rich.url, "/ingredients?tab=product&product=corthe-rich-m-lotion#result");
assert.equal(data.find((product) => product.name === "Soba Calm Cream").acneSafe, true);
assert.match(page.body, /role="combobox"[^>]*aria-controls="checker-suggest"|aria-controls="checker-suggest"/);
assert.match(CLIENT_JS, /function initCheckerSearch\(\)/, "the dropdown script ships with the site script");
page = await get("/ingredients?tab=product&product=corthe-rich-m-lotion");
assert.match(page.body, /class="checker-picked-product" href="\/product\/corthe-rich-m-lotion"/);
assert.match(page.body, /<img src="https:\/\/items-images-production[^"]*richm\.jpg" alt="Corthe Rich M Lotion"/, "the picked product shows its photo");
assert.match(page.body, /Check a different product/);
assert.match(page.body, /1 pore-clogging ingredient found/);
assert.match(page.body, /<h3>Moisture RX Recharge/, "a shop product with a pore-clogger gets a clean shop swap");
page = await get("/ingredients?tab=product&q=not-a-product");
assert.match(page.body, /isn&#8217;t in Laura&#8217;s shop/);
console.log("PASS  a shop product can be found with photos and checked");

page = await get("/ingredients/niacinamide");
assert.equal(page.status, 200);
assert.match(page.body, /<h1>Niacinamide<\/h1>/);
assert.match(page.body, /pubmed\.ncbi\.nlm\.nih\.gov/);
assert.match(page.body, /In Laura&#8217;s shop/);
page = await get(`/ingredients/${ingredientSlug("Isopropyl Myristate")}`);
assert.equal(page.status, 200, "a pore-clogger has a page even when no shop product contains it");
assert.equal((await get("/ingredients/not-an-ingredient")).status, 404);
console.log("PASS  each ingredient has its own page");

page = await get("/sitemap.xml");
assert.match(page.body, /\/ingredients<\/loc>/);
assert.match(page.body, /\/ingredients\/niacinamide<\/loc>/);
page = await get("/product/soba-calm-cream");
assert.match(page.body, /href="\/ingredients\/niacinamide">More about this ingredient/, "product pages link each ingredient");
console.log("PASS  the sitemap and product pages link to the checker");

assert.deepEqual(betterAlternatives(checkIngredients(["Water"]), [], { type: "moisturizer" }), []);
