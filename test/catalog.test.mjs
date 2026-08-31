import { getCatalog, indexVariations } from "../src/square.js";
import { settings } from "../src/config.js";

const CATALOG_PAGE_1 = {
  objects: [
    { id: "ITEM_A", type: "ITEM", item_data: {
        name: "Mixi Clean", description_plaintext: "Gentle gel cleanser.",
        image_ids: ["IMG_1"], reporting_category: { id: "CAT_CLEAN" },
        variations: [{ id: "VAR_A1", item_variation_data: {
          name: "150ml", pricing_type: "FIXED_PRICING",
          price_money: { amount: 3400, currency: "USD" }, track_inventory: true } }],
      } },
    { id: "ITEM_B", type: "ITEM", item_data: {
        name: "KrX Mela Défense Serum", description: "<p>Brightening <b>serum</b>.</p>",
        image_ids: ["IMG_2"], categories: [{ id: "CAT_SERUM" }],
        variations: [
          { id: "VAR_B1", item_variation_data: { name: "30ml", pricing_type: "FIXED_PRICING",
            price_money: { amount: 5400, currency: "USD" }, track_inventory: true } },
          { id: "VAR_B2", item_variation_data: { name: "50ml", pricing_type: "FIXED_PRICING",
            price_money: { amount: 8900, currency: "USD" }, track_inventory: false } },
        ],
      } },
    // Sold out: tracked, zero on hand.
    { id: "ITEM_C", type: "ITEM", item_data: {
        name: "Sold Out Toner", category_id: "CAT_TONER",
        variations: [{ id: "VAR_C1", item_variation_data: { pricing_type: "FIXED_PRICING",
          price_money: { amount: 3900, currency: "USD" }, track_inventory: true } }] } },
    // Archived — must be dropped.
    { id: "ITEM_D", type: "ITEM", item_data: { name: "Archived", is_archived: true,
        variations: [{ id: "VAR_D1", item_variation_data: { pricing_type: "FIXED_PRICING",
          price_money: { amount: 100 } } }] } },
    // Not available online — must be dropped.
    { id: "ITEM_E", type: "ITEM", item_data: { name: "In Studio Only", available_online: false,
        variations: [{ id: "VAR_E1", item_variation_data: { pricing_type: "FIXED_PRICING",
          price_money: { amount: 100 } } }] } },
    // Variable pricing only — no sellable variation, must be dropped.
    { id: "ITEM_F", type: "ITEM", item_data: { name: "Custom Service",
        variations: [{ id: "VAR_F1", item_variation_data: { pricing_type: "VARIABLE_PRICING" } }] } },
    // Slug collision with ITEM_A.
    { id: "ITEM_GHIJKL", type: "ITEM", item_data: { name: "Mixi Clean",
        variations: [{ id: "VAR_G1", item_variation_data: { pricing_type: "FIXED_PRICING",
          price_money: { amount: 3400, currency: "USD" } } }] } },
  ],
  related_objects: [
    { id: "IMG_1", type: "IMAGE", image_data: { url: "https://img/1.jpg" } },
    { id: "CAT_CLEAN", type: "CATEGORY", category_data: { name: "Cleanser" } },
  ],
  cursor: "PAGE2",
};

const CATALOG_PAGE_2 = {
  objects: [],
  related_objects: [
    { id: "IMG_2", type: "IMAGE", image_data: { url: "https://img/2.jpg" } },
    { id: "CAT_SERUM", type: "CATEGORY", category_data: { name: "Serums" } },
    { id: "CAT_TONER", type: "CATEGORY", category_data: { name: "Toners" } },
  ],
};

const INVENTORY = {
  counts: [
    { catalog_object_id: "VAR_A1", state: "IN_STOCK", quantity: "7" },
    { catalog_object_id: "VAR_B1", state: "IN_STOCK", quantity: "2" },
    { catalog_object_id: "VAR_C1", state: "IN_STOCK", quantity: "0" },
  ],
};

let calls = [];
let page = 0;
globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  calls.push(path);
  const body = JSON.parse(options.body);
  let data;
  if (path === "/v2/catalog/search") {
    data = body.cursor === "PAGE2" ? CATALOG_PAGE_2 : (page++, CATALOG_PAGE_1);
  } else if (path === "/v2/inventory/counts/batch-retrieve") {
    data = INVENTORY;
  } else {
    throw new Error("unexpected path " + path);
  }
  return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
};

const env = { SQUARE_ACCESS_TOKEN: "t", SQUARE_LOCATION_ID: "L1", SQUARE_ENVIRONMENT: "sandbox" };
const cfg = { ...settings({}), catalogTtlSeconds: 0 };

const products = await getCatalog(env, cfg, { force: true });

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

check("drops archived / offline / variable-priced", products.length, 4);
check("product names sorted", products.map(p => p.name),
  ["KrX Mela Défense Serum", "Mixi Clean", "Mixi Clean", "Sold Out Toner"]);

const mela = products.find(p => p.id === "ITEM_B");
check("slug from accented name", mela.slug, "krx-mela-defense-serum");
check("category via categories[]", mela.category, "Serums");
check("image resolved from later page", mela.image, "https://img/2.jpg");
check("html stripped from description", mela.description, "Brightening serum .");
check("both variations kept", mela.variations.map(v => v.id), ["VAR_B1", "VAR_B2"]);
check("untracked variation is in stock", mela.variations[1].inStock, true);

const clean = products.find(p => p.id === "ITEM_A");
check("category via reporting_category", clean.category, "Cleanser");
check("tracked with stock is available", clean.available, true);
check("price in cents", clean.priceCents, 3400);

const soldOut = products.find(p => p.id === "ITEM_C");
check("tracked with 0 on hand is sold out", soldOut.available, false);
check("category via legacy category_id", soldOut.category, "Toners");

const collision = products.find(p => p.id === "ITEM_GHIJKL");
check("slug collision disambiguated", collision.slug, "mixi-clean-item-g");

check("paginated: two catalog calls", calls.filter(c => c.includes("catalog")).length, 2);

const index = indexVariations(products);
check("variation index covers all", index.size, 5);
check("index maps to owning product", index.get("VAR_B2").product.name, "KrX Mela Défense Serum");

// hideSoldOut
const hidden = await getCatalog(env, { ...cfg, hideSoldOut: true }, { force: true });
check("hideSoldOut removes sold-out item", hidden.some(p => p.id === "ITEM_C"), false);

console.log(failures === 0 ? "\nAll catalog tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
