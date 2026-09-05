import worker from "../src/index.js";

const CATALOG = {
  objects: [
    { id: "I1", type: "ITEM", item_data: { name: "Cleanser", reporting_category: { id: "C1" },
      ecom_visibility: "VISIBLE",
      variations: [{ id: "V1", item_variation_data: { pricing_type: "FIXED_PRICING",
        price_money: { amount: 3400, currency: "USD" }, track_inventory: false } }] } },
    { id: "I2", type: "ITEM", item_data: { name: "Serum", ecom_visibility: "VISIBLE",
      variations: [{ id: "V2", item_variation_data: { pricing_type: "FIXED_PRICING",
        price_money: { amount: 7000, currency: "USD" }, track_inventory: false } }] } },
    { id: "I3", type: "ITEM", item_data: { name: "Gone", ecom_visibility: "VISIBLE",
      variations: [{ id: "V3", item_variation_data: { pricing_type: "FIXED_PRICING",
        price_money: { amount: 1000, currency: "USD" }, track_inventory: true } }] } },
  ],
  related_objects: [{ id: "C1", type: "CATEGORY", category_data: { name: "Cleanser" } }],
};

let lastLinkBody = null;
globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  const body = options?.body ? JSON.parse(options.body) : {};
  if (path === "/v2/catalog/search") return json(CATALOG);
  if (path === "/v2/inventory/counts/batch-retrieve") {
    return json({ counts: [{ catalog_object_id: "V3", state: "IN_STOCK", quantity: "0" }] });
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

async function checkout(body) {
  const request = new Request("https://test.skinbylauralo.com/api/checkout", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const response = await worker.fetch(request, env);
  return { status: response.status, data: await response.json() };
}

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

// --- happy path, under free-shipping threshold ($34 < $100) -> $10 fee
let r = await checkout({ items: [{ id: "V1", qty: 1 }], fulfillment: "shipping" });
check("returns Square URL", r.data.url, "https://square.link/u/TEST");
check("line item uses catalog id", lastLinkBody.order.line_items, [{ catalog_object_id: "V1", quantity: "1" }]);
check("no price sent to Square", "base_price_money" in lastLinkBody.order.line_items[0], false);
check("auto taxes on", lastLinkBody.order.pricing_options.auto_apply_taxes, true);
check("shipping fee charged under threshold", lastLinkBody.checkout_options.shipping_fee.charge.amount, 1000);
check("asks for shipping address", lastLinkBody.checkout_options.ask_for_shipping_address, true);
check("redirects to thank-you", lastLinkBody.checkout_options.redirect_url, "https://test.skinbylauralo.com/thank-you");
check("no bundle discount for an unrelated cart", "discounts" in lastLinkBody.order, false);

// --- over threshold: 2 x $70 = $140 -> free
r = await checkout({ items: [{ id: "V2", qty: 2 }], fulfillment: "shipping" });
check("no shipping fee over threshold", "shipping_fee" in lastLinkBody.checkout_options, false);

// --- exactly at threshold: $34 + $70 = $104 -> free
r = await checkout({ items: [{ id: "V1", qty: 1 }, { id: "V2", qty: 1 }], fulfillment: "shipping" });
check("free at/over threshold with mixed cart", "shipping_fee" in lastLinkBody.checkout_options, false);
check("multiple line items preserved", lastLinkBody.order.line_items.length, 2);

// --- pickup
r = await checkout({ items: [{ id: "V1", qty: 1 }], fulfillment: "pickup" });
check("pickup fulfillment added", lastLinkBody.order.fulfillments[0].type, "PICKUP");
check("pickup never asks for address", lastLinkBody.checkout_options.ask_for_shipping_address, false);
check("pickup has no shipping fee", "shipping_fee" in lastLinkBody.checkout_options, false);

// --- rejections
check("empty cart rejected", (await checkout({ items: [], fulfillment: "shipping" })).status, 400);
check("unknown variation rejected", (await checkout({ items: [{ id: "NOPE", qty: 1 }], fulfillment: "shipping" })).status, 400);
check("qty 0 rejected", (await checkout({ items: [{ id: "V1", qty: 0 }], fulfillment: "shipping" })).status, 400);
check("qty 99 rejected", (await checkout({ items: [{ id: "V1", qty: 99 }], fulfillment: "shipping" })).status, 400);
check("non-integer qty rejected", (await checkout({ items: [{ id: "V1", qty: "2; DROP" }], fulfillment: "shipping" })).status, 400);
check("sold-out item rejected", (await checkout({ items: [{ id: "V3", qty: 1 }], fulfillment: "shipping" })).status, 409);
check("client-sent price is ignored", (await checkout({ items: [{ id: "V1", qty: 1, priceCents: 1 }], fulfillment: "shipping" })).status, 200);
check("  -> still priced by catalog", lastLinkBody.order.line_items[0], { catalog_object_id: "V1", quantity: "1" });

// --- shipping disabled config
const noShip = { ...env, SHIPPING_ENABLED: "false" };
const req = new Request("https://x/api/checkout", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ items: [{ id: "V1", qty: 1 }], fulfillment: "shipping" }) });
check("shipping blocked when disabled", (await worker.fetch(req, noShip)).status, 400);

console.log(failures === 0 ? "\nAll checkout tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
