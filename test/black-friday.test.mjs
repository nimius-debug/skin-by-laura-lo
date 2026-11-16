// Black Friday 2026: everything switches by date, in Eastern time. The dates
// are driven through the preview cookie on a non-production host, which is the
// same path Laura's preview links use.
import worker from "../src/index.js";
import { campaignPhase } from "../src/campaign.js";
import { settings } from "../src/config.js";

const item = (id, name, cents, extra = {}) => ({
  id, type: "ITEM", item_data: {
    name, ecom_visibility: "VISIBLE", ...extra,
    variations: [{ id: `V_${id}`, item_variation_data: { pricing_type: "FIXED_PRICING",
      price_money: { amount: cents, currency: "USD" }, track_inventory: false } }],
  },
});

const CATALOG = {
  objects: [
    item("CLEANSER", "Cleanser", 3400, { reporting_category: { id: "C1" } }),
    item("PACK", "Green Sea Liquid Microneedling | Corrective Series of 4", 89700, { reporting_category: { id: "C2" } }),
  ],
  related_objects: [
    { id: "C1", type: "CATEGORY", category_data: { name: "Cleanser" } },
    { id: "C2", type: "CATEGORY", category_data: { name: "Treatment Packages" } },
  ],
};

// A 15% sale set up carelessly on "all items", Nov 27 to Nov 30. The package
// must stay out of it anyway.
const PRICING = {
  objects: [
    { id: "D1", type: "DISCOUNT", discount_data: { name: "Black Friday Skincare", discount_type: "FIXED_PERCENTAGE", percentage: "15.0" } },
    { id: "S1", type: "PRODUCT_SET", product_set_data: { all_products: true } },
    { id: "R1", type: "PRICING_RULE", pricing_rule_data: {
      discount_id: "D1", match_products_id: "S1",
      valid_from_date: "2026-11-27", valid_from_local_time: "00:00:00",
      valid_until_date: "2026-12-01", valid_until_local_time: "00:00:00",
    } },
  ],
};

let lastLinkBody = null;
globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  const body = options?.body ? JSON.parse(options.body) : {};
  if (path === "/v2/catalog/search") return json(body.object_types.includes("PRICING_RULE") ? PRICING : CATALOG);
  if (path === "/v2/inventory/counts/batch-retrieve") return json({ counts: [] });
  if (path === "/v2/online-checkout/payment-links") {
    lastLinkBody = body;
    return json({ payment_link: { url: "https://square.link/u/TEST" } });
  }
  if (path === "/reporting/v1/load") return json({ data: [] });
  throw new Error("unexpected " + path);
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

const env = {
  SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC1", SQUARE_ENVIRONMENT: "sandbox",
  CATALOG_TTL_SECONDS: "0", SITE_URL: "https://skinbylauralo.com",
  SHIPPING_ENABLED: "true", SHIPPING_FEE_CENTS: "1000", FREE_SHIPPING_THRESHOLD_CENTS: "10000",
  PICKUP_ENABLED: "true", BLACK_FRIDAY_ENABLED: "true",
};
const PREVIEW = "https://skin-by-laura-lo.example.workers.dev";

function get(path, day, { origin = PREVIEW, vars = env } = {}) {
  return worker.fetch(new Request(origin + path, { headers: day ? { cookie: `bf_preview=${day}` } : {} }), vars);
}
async function text(path, day, options) {
  return (await get(path, day, options)).text();
}
async function checkout(items, day, fulfillment = "shipping") {
  lastLinkBody = null;
  const response = await worker.fetch(new Request(`${PREVIEW}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(day ? { cookie: `bf_preview=${day}` } : {}) },
    body: JSON.stringify({ items, fulfillment }),
  }), env);
  return { status: response.status, link: lastLinkBody };
}

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got      ${JSON.stringify(actual)}\n      expected ${JSON.stringify(expected)}`}`);
}

const BEFORE = "2026-11-20";
const LAUNCH = "2026-11-24";
const SALE = "2026-11-28";
const AFTER = "2026-12-01";
const PACK = [{ id: "V_PACK", qty: 1 }];
const CLEANSER = [{ id: "V_CLEANSER", qty: 1 }];

// ------------------------------------------------------------ the calendar
check("the phases start and end at midnight Eastern", [
  campaignPhase(new Date("2026-11-23T04:59:59Z")), campaignPhase(new Date("2026-11-23T05:00:00Z")),
  campaignPhase(new Date("2026-11-27T04:59:59Z")), campaignPhase(new Date("2026-11-27T05:00:00Z")),
  campaignPhase(new Date("2026-12-01T04:59:59Z")), campaignPhase(new Date("2026-12-01T05:00:00Z")),
], [null, "launch", "launch", "sale", "sale", null]);

const during = new Date("2026-11-28T17:00:00Z");
check("free shipping, no minimum, only Nov 27 to 30",
  [settings(env, during).shippingFeeCents, settings(env, new Date("2026-11-24T17:00:00Z")).shippingFeeCents, settings(env, new Date("2026-12-01T17:00:00Z")).shippingFeeCents],
  [0, 1000, 1000]);
check("the switch in wrangler.toml turns the whole campaign off",
  [settings({ ...env, BLACK_FRIDAY_ENABLED: "false" }, during).campaign, settings({ ...env, BLACK_FRIDAY_ENABLED: "false" }, during).shippingFeeCents, settings({}, during).campaign],
  [null, 1000, null]);

// ------------------------------------------------------------ preview links
const asked = await worker.fetch(new Request(`${PREVIEW}/shop?preview=2026-11-27&category=Cleanser`), env);
check("a preview link remembers the day and reloads without the parameter",
  [asked.status, asked.headers.get("location"), /bf_preview=2026-11-27/.test(asked.headers.get("set-cookie"))],
  [302, "/shop?category=Cleanser", true]);
check("a previewed page is never cached", (await get("/", SALE)).headers.get("cache-control"), "no-store");
const live = await get("/?preview=2026-11-27", SALE, { origin: "https://skinbylauralo.com" });
const liveBody = await live.text();
check("the live domain ignores preview links and cookies", [live.status, liveBody.includes("data-campaign-banner")], [200, false]);

// ------------------------------------------------------------------ before
const homeBefore = await text("/", BEFORE);
check("before Nov 23: no banner, no homepage block", [homeBefore.includes("data-campaign-banner"), homeBefore.includes("bf-home")], [false, false]);
const pageBefore = await get("/black-friday", BEFORE);
check("before Nov 23: /black-friday goes to the shop", [pageBefore.status, pageBefore.headers.get("location")], [302, "/shop"]);
check("before Nov 23: the package can't be bought", (await checkout(PACK, BEFORE)).status, 400);
const normal = await checkout(CLEANSER, BEFORE);
check("before Nov 23: usual $10 shipping and coupon box",
  [normal.link.checkout_options.shipping_fee?.charge.amount, normal.link.checkout_options.enable_coupon], [1000, true]);

// ------------------------------------------------------------------ launch
const homeLaunch = await text("/", LAUNCH);
check("Nov 23 to 26: banner leads with the series and teases the sale",
  [/promo-bf-lead" href="\/black-friday#series">Liquid Microneedling Series \$897</.test(homeLaunch),
    homeLaunch.includes("Gift cards: up to $50 bonus"), homeLaunch.includes("15% off skincare + free shipping from Nov 27"), homeLaunch.includes("bf-home")],
  [true, true, true, true]);
const bfLaunch = await text("/black-friday", LAUNCH);
check("Nov 23 to 26: the page sells the package with its values and terms",
  [bfLaunch.includes('data-add-to-cart="V_PACK"'), bfLaunch.includes("<strong>$897</strong>"), bfLaunch.includes("$1,129"), bfLaunch.includes("$232"),
    bfLaunch.includes("$115") && bfLaunch.includes("$225") && bfLaunch.includes("$350"), bfLaunch.includes("11:59 PM EST"),
    bfLaunch.includes("Starts Friday, Nov 27")],
  [true, true, true, true, true, true, true]);
check("the package is never listed in the shop", (await text("/shop", LAUNCH)).includes("Microneedling |"), false);
const api = await (await get("/api/catalog", LAUNCH)).json();
check("the bag knows the package has nothing to ship", [api.variations.V_PACK?.noShipping, api.variations.V_CLEANSER?.noShipping], [true, undefined]);
const packOnly = await checkout(PACK, LAUNCH);
check("package checkout: no shipping fee, no address, no pickup, no coupons",
  [packOnly.status, packOnly.link.checkout_options.shipping_fee, packOnly.link.checkout_options.ask_for_shipping_address,
    packOnly.link.order.fulfillments, packOnly.link.checkout_options.enable_coupon],
  [200, undefined, false, undefined, false]);
const mixed = await checkout(PACK.concat(CLEANSER), LAUNCH);
check("package + skincare: the package doesn't earn free shipping for the rest",
  [mixed.link.checkout_options.shipping_fee?.charge.amount, mixed.link.checkout_options.ask_for_shipping_address], [1000, true]);

// -------------------------------------------------------------------- sale
const homeSale = await text("/", SALE);
check("Nov 27 to 30: banner leads with the skincare sale, all three offers",
  [/promo-bf-lead" href="\/shop">15% off skincare \+ free shipping</.test(homeSale),
    homeSale.includes("Liquid Microneedling Series $897"), homeSale.includes("Gift cards: up to $50 bonus"),
    homeSale.includes("Free U.S. shipping on every order through Nov 30")],
  [true, true, true, true]);
const saleOrder = await checkout(PACK.concat(CLEANSER), SALE);
const [packLine, cleanserLine] = saleOrder.link.order.line_items;
check("Nov 27 to 30: 15% on skincare only, free shipping, no coupon stacking",
  [packLine.applied_discounts, cleanserLine.applied_discounts?.length, saleOrder.link.order.discounts.map((d) => d.catalog_object_id),
    saleOrder.link.checkout_options.shipping_fee, saleOrder.link.checkout_options.enable_coupon],
  [undefined, 1, ["D1"], undefined, false]);
const bfSale = await text("/black-friday", SALE);
check("the package stays $897 during the sale", [bfSale.includes("<strong>$897</strong>"), bfSale.includes("$762.45")], [true, false]);
check("skincare on the page shows what each product saves",
  [bfLaunch.includes("Save $5.10") && bfLaunch.includes("$28.90") && bfLaunch.includes("from Nov 27"), bfLaunch.includes('data-add-to-cart="V_CLEANSER"'),
    bfSale.includes("Save $5.10") && bfSale.includes('data-add-to-cart="V_CLEANSER"')],
  [true, false, true]);
check("the page has its countdown and the gift card picker",
  [bfSale.includes('data-bf-countdown="2026-12-01T05:00:00Z"'), bfLaunch.includes('data-bf-countdown="2026-11-27T05:00:00Z"'), (bfSale.match(/data-bf-tier/g) || []).length],
  [true, true, 3]);
check("the Terms page carries the promotion terms", (await text("/terms", SALE)).includes("Black Friday 2026 promotion"), true);

// ------------------------------------------------------------------- after
const homeAfter = await text("/", AFTER);
check("Dec 1: banners and block are gone", [homeAfter.includes("data-campaign-banner"), homeAfter.includes("bf-home")], [false, false]);
check("Dec 1: /black-friday goes to the shop", (await get("/black-friday", AFTER)).status, 302);
check("Dec 1: the package is off sale even if still visible in Square", (await checkout(PACK, AFTER)).status, 400);
const after = await checkout(CLEANSER, AFTER);
check("Dec 1: regular price, $10 shipping and the coupon box are back",
  [after.link.order.discounts, after.link.checkout_options.shipping_fee?.charge.amount, after.link.checkout_options.enable_coupon],
  [undefined, 1000, true]);
check("Dec 1: the Terms page is back to normal", (await text("/terms", AFTER)).includes("Black Friday"), false);

if (failures) { console.error(`\n${failures} Black Friday test(s) failed.`); process.exit(1); }
console.log("\nAll Black Friday tests passed.");
