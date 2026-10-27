// Square sales (Items → Discounts) shown on the site and applied at checkout.
import worker from "../src/index.js";
import { getCatalog } from "../src/square.js";
import { settings } from "../src/config.js";

const item = (id, name, price, categoryId, vid = `V_${id}`) => ({
  id, type: "ITEM", item_data: {
    name, ecom_visibility: "VISIBLE",
    ...(categoryId ? { categories: [{ id: categoryId }], reporting_category: { id: categoryId } } : {}),
    variations: [{ id: vid, item_variation_data: { pricing_type: "FIXED_PRICING",
      price_money: { amount: price, currency: "USD" }, track_inventory: false } }],
  },
});

const CATALOG = {
  objects: [
    item("MASK", "Sulfur Masque", 5000, "CAT_MASKS"),
    item("MASK2", "Sheet Masks", 6000, "CAT_MASKS"),
    item("SERUM", "Serum", 7000, "CAT_SERUMS"),
    item("TONER", "Toner", 3000, "CAT_TONERS"),
    item("BALM", "Balm", 2000, "CAT_TONERS"),
  ],
  related_objects: [
    { id: "CAT_MASKS", type: "CATEGORY", category_data: { name: "Masks" } },
    { id: "CAT_SERUMS", type: "CATEGORY", category_data: { name: "Serums" } },
    { id: "CAT_TONERS", type: "CATEGORY", category_data: { name: "Toners" } },
  ],
};

const discount = (id, name, data) => ({ id, type: "DISCOUNT", present_at_all_locations: true,
  discount_data: { name, application_method: "MANUALLY_APPLIED", ...data } });
const set = (id, data) => ({ id, type: "PRODUCT_SET", present_at_all_locations: true, product_set_data: data });
const rule = (id, data) => ({ id, type: "PRICING_RULE", present_at_all_locations: true, pricing_rule_data: data });

const PRICING = {
  objects: [
    // The live shape: 15% off a category, manual, switched off for Square Online.
    discount("D_MASK", "Halloweek Mask Sale", { discount_type: "FIXED_PERCENTAGE", percentage: "15.0" }),
    set("PS_MASK", { product_ids_any: ["CAT_MASKS"], all_products: false }),
    rule("R_MASK", { discount_id: "D_MASK", match_products_id: "PS_MASK",
      valid_from_date: "2000-01-01", valid_until_date: "2999-01-01", valid_until_local_time: "00:00:00",
      application_mode: "MANUAL_APPLICATION", discount_target_scope: "LINE_ITEM",
      disabled_pricing_sources: ["SQUARE_ONLINE"] }),

    // $5 off one item, automatic.
    discount("D_SERUM", "Serum Week", { discount_type: "FIXED_AMOUNT", amount_money: { amount: 500, currency: "USD" } }),
    set("PS_SERUM", { product_ids_any: ["SERUM"] }),
    rule("R_SERUM", { discount_id: "D_SERUM", match_products_id: "PS_SERUM",
      application_mode: "AUTOMATIC", discount_target_scope: "LINE_ITEM" }),

    // A smaller overlapping sale on masks: the bigger one must win.
    discount("D_SMALL", "Small", { discount_type: "FIXED_PERCENTAGE", percentage: "5" }),
    rule("R_SMALL", { discount_id: "D_SMALL", match_products_id: "PS_MASK", discount_target_scope: "LINE_ITEM" }),

    // Ended, not started, coupon, member-only, other location: none may show.
    discount("D_TONER", "Toner", { discount_type: "FIXED_PERCENTAGE", percentage: "50" }),
    set("PS_TONER", { product_ids_any: ["CAT_TONERS"] }),
    rule("R_ENDED", { discount_id: "D_TONER", match_products_id: "PS_TONER", valid_until_date: "2001-01-01" }),
    rule("R_FUTURE", { discount_id: "D_TONER", match_products_id: "PS_TONER", valid_from_date: "2998-01-01" }),
    set("PS_ALL", { all_products: true }),
    rule("R_COUPON", { discount_id: "D_TONER", match_products_id: "PS_ALL",
      application_mode: "ATTACHED", discount_target_scope: "WHOLE_PURCHASE" }),
    rule("R_MEMBERS", { discount_id: "D_TONER", match_products_id: "PS_ALL",
      application_mode: "AUTOMATIC", customer_group_ids_any: ["G1"] }),
    { ...rule("R_ELSEWHERE", { discount_id: "D_TONER", match_products_id: "PS_ALL" }),
      present_at_all_locations: false, present_at_location_ids: ["OTHER"] },
    // Multi-buy set: needs 2, so can't price a single unit.
    set("PS_TWO", { product_ids_any: ["BALM"], quantity_min: 2 }),
    rule("R_TWO", { discount_id: "D_TONER", match_products_id: "PS_TWO" }),
  ],
};

let lastLinkBody = null;
let pricingFails = false;
globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  const body = options?.body ? JSON.parse(options.body) : {};
  if (path === "/v2/catalog/search") {
    if (body.object_types.includes("PRICING_RULE")) {
      if (pricingFails) return json({ errors: [{ code: "INTERNAL" }] }, 500);
      return json(PRICING);
    }
    return json(CATALOG);
  }
  if (path === "/v2/online-checkout/payment-links") {
    lastLinkBody = body;
    return json({ payment_link: { url: "https://square.link/u/TEST" } });
  }
  throw new Error("unexpected " + path);
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

const env = {
  SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC1", SQUARE_ENVIRONMENT: "sandbox",
  CATALOG_TTL_SECONDS: "0", SITE_URL: "https://test.skinbylauralo.com",
  SHIPPING_ENABLED: "true", SHIPPING_FEE_CENTS: "1000", FREE_SHIPPING_THRESHOLD_CENTS: "10000",
  PICKUP_ENABLED: "true",
};
const cfg = settings(env);

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const products = await getCatalog(env, cfg, { force: true });
const by = Object.fromEntries(products.map((p) => [p.id, p]));

check("category sale: sale price", by.MASK.priceCents, 4250);
check("category sale: regular price kept", by.MASK.regularPriceCents, 5000);
check("category sale: label + name", [by.MASK.sale.label, by.MASK.sale.name], ["15% off", "Halloweek Mask Sale"]);
check("biggest overlapping sale wins", by.MASK.sale.discountId, "D_MASK");
check("whole category covered", by.MASK2.priceCents, 5100);
check("fixed amount sale on one item", [by.SERUM.priceCents, by.SERUM.sale.label], [6500, "$5 off"]);
check("ended / future / coupon / member / other-location rules ignored", [by.TONER.priceCents, by.TONER.sale], [3000, null]);
check("multi-buy rule ignored", by.BALM.sale, null);

// Product page shows the struck-out price.
let response = await worker.fetch(new Request(`https://test.skinbylauralo.com/product/${by.MASK.slug}`), env);
let page = await response.text();
check("product page strikes the regular price", page.includes('<s class="price-regular"><span class="sr-only">Regular price </span>$50.00</s>'), true);
check("product page shows the sale price", page.includes("$42.50"), true);
check("product page names the sale", page.includes("15% off · Halloweek Mask Sale"), true);

response = await worker.fetch(new Request("https://test.skinbylauralo.com/shop"), env);
page = await response.text();
check("shop card shows sale badge", page.includes('product-badge-sale">15% off<'), true);

// Cart API carries both prices.
response = await worker.fetch(new Request("https://test.skinbylauralo.com/api/catalog"), env);
const api = await response.json();
check("cart API sale + regular price", [api.variations.V_MASK.priceCents, api.variations.V_MASK.regularPriceCents], [4250, 5000]);

// Checkout attaches the sale to the order.
async function checkout(items) {
  const request = new Request("https://test.skinbylauralo.com/api/checkout", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ items, fulfillment: "shipping" }),
  });
  const res = await worker.fetch(request, env);
  return { status: res.status, data: await res.json() };
}

await checkout([{ id: "V_MASK", qty: 2 }, { id: "V_MASK2", qty: 1 }, { id: "V_SERUM", qty: 3 }, { id: "V_TONER", qty: 1 }]);
const order = lastLinkBody.order;
check("Square auto-apply off; the site applies sales", order.pricing_options.auto_apply_discounts, false);
check("percentage sale referenced by catalog id, once", order.discounts.filter((d) => d.catalog_object_id === "D_MASK"),
  [{ uid: "sale-D_MASK", catalog_object_id: "D_MASK", scope: "LINE_ITEM" }]);
check("both mask lines use it", [order.line_items[0].applied_discounts, order.line_items[1].applied_discounts],
  [[{ discount_uid: "sale-D_MASK" }], [{ discount_uid: "sale-D_MASK" }]]);
check("fixed sale sent per unit x qty", order.discounts.find((d) => d.uid === "sale-2"),
  { uid: "sale-2", name: "Serum Week", amount_money: { amount: 1500, currency: "USD" }, scope: "LINE_ITEM" });
check("line without a sale untouched", order.line_items[3], { catalog_object_id: "V_TONER", quantity: "1" });
// 2x42.50 + 51 + 3x65 + 30 = 361 -> free shipping.
check("shipping threshold uses sale prices", "shipping_fee" in lastLinkBody.checkout_options, false);

// Sale prices count toward the free-shipping threshold: 2 x $50 is $100 but $85 on sale.
await checkout([{ id: "V_MASK", qty: 2 }]);
check("sale subtotal under threshold pays shipping", lastLinkBody.checkout_options.shipping_fee?.charge.amount, 1000);

// Pricing lookup failing never breaks the shop: full price shown and charged.
pricingFails = true;
const fallback = await getCatalog(env, cfg, { force: true });
check("pricing failure falls back to regular price", fallback.find((p) => p.id === "MASK").priceCents, 5000);
await checkout([{ id: "V_MASK", qty: 1 }]);
check("  -> and checkout sends no discount", "discounts" in lastLinkBody.order, false);

console.log(failures === 0 ? "\nAll sales tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
