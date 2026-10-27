// The scrolling sale banner: built from live Square sales, gone when they end.
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { salePromo, promoBanner } from "../src/promo.js";
import { page } from "../src/layout.js";
import { STYLES } from "../src/styles.js";
import { toString } from "../src/html.js";

const halloweek = { discountId: "D_MASK", name: "Halloweek Mask Sale", label: "15% off", lastDay: "2026-11-01" };
const product = (slug, category, sale = null) => ({ slug, name: slug, category, sale, variations: [{ sale }] });

// The live shape: the whole Masks category, ending at midnight going into Nov 2.
const masks = [product("sulfur", "Masks", halloweek), product("cica", "Masks", halloweek), product("serum", "Serums")];
let promo = salePromo(masks);
assert.deepEqual(promo, {
  name: "Halloweek Mask Sale",
  offer: "15% off every mask",
  until: "Through Sun, Nov 1",
  untilLong: "through Sunday, November 1",
  shopLabel: "Shop masks",
  href: "/shop?category=Masks",
  spooky: true,
});

// Only part of a category on sale: don't claim "every".
promo = salePromo([...masks, product("clay", "Masks")]);
assert.equal(promo.offer, "15% off select masks");

// A single product links to it; an everyday sale gets the plain look.
const serumWeek = { discountId: "D_SERUM", name: "Serum Week", label: "$5 off", lastDay: null };
promo = salePromo([product("glow-serum", "Serums", serumWeek), product("toner", "Toners")]);
assert.equal(promo.href, "/product/glow-serum");
assert.equal(promo.until, "");
assert.equal(promo.spooky, false);

// The sale covering the most products wins; no sale, no banner.
assert.equal(salePromo([...masks, product("glow-serum", "Serums", serumWeek)]).name, "Halloweek Mask Sale");
assert.equal(salePromo([product("toner", "Toners")]), null);
assert.equal(promoBanner(null), "");

// Markup: one accessible line for screen readers, the moving copy hidden from them.
const markup = toString(promoBanner(salePromo(masks)));
assert.match(markup, /<a class="promo-link" href="\/shop\?category=Masks">/);
assert.match(markup, /<span class="sr-only">Halloweek Mask Sale: 15% off every mask through Sunday, November 1\. Shop masks\.<\/span>/);
assert.match(markup, /class="promo-marquee" aria-hidden="true"/);
assert.match(markup, /data-promo-pause hidden/, "the pause button only appears once the script can run it");
assert.equal((markup.match(/class="promo-run"/g) || []).length, 2, "two identical halves make the loop seamless");

// Reduced motion swaps the marquee for a still line.
assert.match(STYLES, /@media \(prefers-reduced-motion: reduce\) \{\n  \.promo-marquee, \.promo-pause \{ display: none !important; \}\n  \.promo-static \{ display: flex; \}/);

// The layout only shows it when there is a sale.
const cfg = { shippingEnabled: false, pickupEnabled: false };
assert.doesNotMatch(page({ body: "", cfg }), /data-promo/);
assert.match(page({ body: "", cfg, promo: salePromo(masks) }), /<div class="promo promo-spooky" data-promo>/);

// End to end: a live rule ending "Nov 2" in the dashboard (valid until
// 2026-11-02 00:00) shows on every page until then and is gone after.
const CATALOG = {
  objects: ["MASK", "MASK2"].map((id) => (
    { id, type: "ITEM", item_data: { name: `Mask ${id}`, ecom_visibility: "VISIBLE",
      categories: [{ id: "CAT_MASKS" }], reporting_category: { id: "CAT_MASKS" },
      variations: [{ id: `V_${id}`, item_variation_data: { pricing_type: "FIXED_PRICING",
        price_money: { amount: 5000, currency: "USD" } } }] } })),
  related_objects: [{ id: "CAT_MASKS", type: "CATEGORY", category_data: { name: "Masks" } }],
};
const PRICING = {
  objects: [
    { id: "D_MASK", type: "DISCOUNT", present_at_all_locations: true,
      discount_data: { name: "Halloweek Mask Sale", discount_type: "FIXED_PERCENTAGE", percentage: "15.0" } },
    { id: "PS_MASK", type: "PRODUCT_SET", present_at_all_locations: true,
      product_set_data: { product_ids_any: ["CAT_MASKS"] } },
    { id: "R_MASK", type: "PRICING_RULE", present_at_all_locations: true,
      pricing_rule_data: { discount_id: "D_MASK", match_products_id: "PS_MASK",
        valid_from_date: "2026-10-26", valid_from_local_time: "00:00:00",
        valid_until_date: "2026-11-02", valid_until_local_time: "00:00:00",
        application_mode: "MANUAL_APPLICATION", discount_target_scope: "LINE_ITEM",
        disabled_pricing_sources: ["SQUARE_ONLINE"] } },
  ],
};
globalThis.fetch = async (url, options) => {
  const body = options?.body ? JSON.parse(options.body) : {};
  if (new URL(url).pathname === "/reporting/v1/load") return new Response("{}", { status: 404 });
  if (new URL(url).pathname !== "/v2/catalog/search") throw new Error(`unexpected ${url}`);
  const data = body.object_types.includes("PRICING_RULE") ? PRICING : CATALOG;
  return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
};
const env = {
  SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC1", SQUARE_ENVIRONMENT: "sandbox",
  CATALOG_TTL_SECONDS: "0", SITE_URL: "https://test.skinbylauralo.com",
};

const RealDate = Date;
async function pageAt(iso, path) {
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [iso])); }
    static now() { return new RealDate(iso).getTime(); }
  };
  try {
    const response = await worker.fetch(new Request(`https://test.skinbylauralo.com${path}`), env);
    return await response.text();
  } finally {
    globalThis.Date = RealDate;
  }
}

// Clocks fall back on Nov 1, so 11:30 pm that Sunday in Tampa is 04:30 UTC.
let html = await pageAt("2026-11-02T04:30:00Z", "/about");
assert.match(html, /15% off every mask/, "the banner shows on pages that never list products");
assert.match(html, /Through Sun, Nov 1/);
html = await pageAt("2026-11-02T04:30:00Z", "/cart");
assert.match(html, /data-promo/);
// Midnight going into Nov 2 in Tampa: the sale and the banner are over.
html = await pageAt("2026-11-02T05:30:00Z", "/about");
assert.doesNotMatch(html, /data-promo/);
assert.doesNotMatch(html, /Halloweek/);

console.log("PASS  sale banner follows the live Square sale");
