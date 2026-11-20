// Black Friday 2026: everything switches by date, in Eastern time. The dates
// are driven through the preview cookie on a non-production host, which is the
// same path Laura's preview links use.
import worker from "../src/index.js";
import { campaignPhase } from "../src/campaign.js";
import { settings } from "../src/config.js";
import { createD1, schemaMigrations } from "./helpers/d1-sqlite.mjs";
import { sendSaleNotifications, NOTIFY_LIST } from "../src/notify.js";
import { handleAdminRequest } from "../src/admin/routes.js";
import { createSessionToken, sessionCookie } from "../src/admin/auth.js";

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
    // In the "Brighten Me Up" routine (src/routines.js).
    item("SPF", "Desembre EGF Waterdrop", 3200, { reporting_category: { id: "C1" } }),
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
const resendBatches = [];
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
  if (path === "/emails/batch") {
    resendBatches.push(body);
    return json({ data: body.map((_, index) => ({ id: `re_${resendBatches.length}_${index}` })) });
  }
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
  CLIENT_NOTES_DB: createD1({ migrations: schemaMigrations() }),
  RESEND_API_KEY: "re_test", CAMPAIGN_FROM_EMAIL: "laura@skinbylauralo.com",
  ADMIN_USERNAME: "laura", ADMIN_PASSWORD: "pw-for-tests",
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
check("before Nov 23: no bar, no takeover, everyday theme, everyday hero",
  [homeBefore.includes("data-campaign-banner"), homeBefore.includes("bf-home"), homeBefore.includes("data-theme="), homeBefore.includes("Skin health, <em>made personal.</em>")],
  [false, false, false, true]);
const pageBefore = await get("/black-friday", BEFORE);
check("before Nov 23: /black-friday goes to the shop", [pageBefore.status, pageBefore.headers.get("location")], [302, "/shop"]);
check("before Nov 23: the package can't be bought", (await checkout(PACK, BEFORE)).status, 400);
const normal = await checkout(CLEANSER, BEFORE);
check("before Nov 23: usual $10 shipping and coupon box",
  [normal.link.checkout_options.shipping_fee?.charge.amount, normal.link.checkout_options.enable_coupon], [1000, true]);

// ------------------------------------------------------------------ launch
const homeLaunch = await text("/", LAUNCH);
check("Nov 23 to 26: the whole site is black and the homepage is the deals",
  [homeLaunch.includes('<html lang="en" data-theme="black-edition">'), homeLaunch.includes('content="#0c0c0b"'),
    homeLaunch.includes("bf-home"), homeLaunch.includes("Skin health, <em>made personal.</em>"),
    (await text("/shop", LAUNCH)).includes('data-theme="black-edition"'), (await text("/treatments", LAUNCH)).includes('data-theme="black-edition"')],
  [true, true, true, false, true, true]);
check("Nov 23 to 26: one static bar about gift cards and Friday, no ticker, no shipping bar",
  [/data-campaign-banner[\s\S]*Gift cards 15% off[\s\S]*Skincare 15% off starts Fri/.test(homeLaunch), homeLaunch.includes("promo-track"), homeLaunch.includes('class="announcement"')],
  [true, false, false]);
check("Nov 23 to 26: packages come right after the hero, then routines, gift cards, skincare and products",
  ["bf-hero", 'id="packages"', 'id="routines"', 'id="gift-cards"', 'id="skincare"', 'id="sale-products"', 'id="about"'].map((marker) => homeLaunch.indexOf(marker))
    .every((at, index, all) => at > 0 && (index === 0 || at > all[index - 1])), true);
check("Nov 23 to 26: routines follow the package, each with its total struck out and its Friday price, and open the usual popout",
  [/bf-routine-name">Brighten Me Up[\s\S]*?Was <\/span>\$32\.00<\/span> <span class="bf-now"><span class="sr-only">Now <\/span>\$27\.20/.test(homeLaunch),
    homeLaunch.includes('data-routine-open="brighten-me-up"'), homeLaunch.includes('id="routine-brighten-me-up"'),
    (homeLaunch.match(/id="routines"/g) || []).length, homeLaunch.includes("routines-section")],
  [true, true, true, 1, false]);
check("Nov 23 to 26: the package shows a real before-and-after to drag, captioned truthfully, usable from the keyboard",
  [/id="packages"[\s\S]*?data-bf-compare[\s\S]*?microneedling-before\.webp[\s\S]*?microneedling-after\.webp[\s\S]*?type="range"[\s\S]*?after 2 Liquid Microneedling treatments[\s\S]*?class="bf-offer"/.test(homeLaunch),
    homeLaunch.includes("bf-sessions")],
  [true, false]);
check("Nov 23 to 26: the package card shows the value struck out, then the price, and adds to the bag",
  [homeLaunch.includes('data-add-to-cart="V_PACK"'), /Was <\/span>\$1,129<\/span> <span class="bf-now bf-now-big"><span class="sr-only">Now <\/span>\$897/.test(homeLaunch),
    homeLaunch.includes("Save $232"), homeLaunch.includes("Add to bag · $897"), homeLaunch.includes("Green Sea")],
  [true, true, true, true, false]);
check("Nov 23 to 26: every gift card amount is a link that copies the code, with was and now prices",
  [(homeLaunch.match(/data-bf-copy-go="BLACKFRIDAY"/g) || []).length, homeLaunch.includes("$90 card"), homeLaunch.includes("$76.50"), homeLaunch.includes("$106.25"), homeLaunch.includes("$297.50")],
  [5, true, true, true, true]);
check("Nov 23 to 26: skincare has the notify form; products show the Friday price and can be added now",
  [homeLaunch.includes('action="/api/notify"'), homeLaunch.includes("$28.90 from Friday"), homeLaunch.includes('data-add-to-cart="V_CLEANSER"'), homeLaunch.includes('data-bf-countdown="2026-12-01T05:00:00Z"')],
  [true, true, true, true]);
check("Nov 23 to 26: the phone bar points at the deals", [homeLaunch.includes("data-bf-sticky"), (await text("/shop", LAUNCH)).includes("data-bf-sticky")], [true, false]);
const bfLaunch = await get("/black-friday", LAUNCH);
check("Nov 23 to 26: /black-friday lands on the homepage", [bfLaunch.status, bfLaunch.headers.get("location")], [302, "/"]);
check("the stylesheet carries the theme", (await text("/assets/styles.css")).includes(':root[data-theme="black-edition"]'), true);
check("SITE_THEME=everyday keeps the everyday look during the campaign",
  (await text("/", LAUNCH, { vars: { ...env, SITE_THEME: "everyday" } })).includes("data-theme="), false);

// ------------------------------------------------------------ notify me
async function notify(body, day, { form = false, ip = "1.2.3.4" } = {}) {
  const headers = { "cf-connecting-ip": ip, ...(day ? { cookie: `bf_preview=${day}` } : {}) };
  const request = form
    ? new Request(`${PREVIEW}/api/notify`, { method: "POST", headers: { ...headers, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body).toString() })
    : new Request(`${PREVIEW}/api/notify`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body) });
  return worker.fetch(request, env);
}
const signedUp = async () => (await env.CLIENT_NOTES_DB.prepare("SELECT email FROM notify_signups WHERE list = ? ORDER BY email").bind(NOTIFY_LIST).all()).results.map((row) => row.email);
const first = await notify({ email: " Ana@Example.com " }, LAUNCH);
const again = await notify({ email: "ana@example.com" }, LAUNCH);
const viaForm = await notify({ email: "bo@example.com", website: "" }, LAUNCH, { form: true, ip: "5.6.7.8" });
const bot = await notify({ email: "bot@example.com", website: "http://spam" }, LAUNCH);
const bad = await notify({ email: "not-an-email" }, LAUNCH);
check("notify: saves each address once, lowercased; a plain form post comes back to the thank-you",
  [first.status, again.status, viaForm.status, viaForm.headers.get("location"), bot.status, bad.status, await signedUp()],
  [200, 200, 303, "/?notified=1#skincare", 200, 400, ["ana@example.com", "bo@example.com"]]);
check("notify: after the form, the homepage says you're on the list", (await text("/?notified=1", LAUNCH)).includes("on the list"), true);
check("notify: closed once the sale is live, and outside the campaign",
  [(await notify({ email: "late@example.com" }, SALE)).status, (await notify({ email: "early@example.com" }, BEFORE)).status], [400, 400]);
for (const n of [1, 2, 3, 4]) await notify({ email: `flood${n}@example.com` }, LAUNCH, { ip: "9.9.9.9" });
check("notify: one visitor can't add more than 5 an hour", (await notify({ email: "flood5@example.com" }, LAUNCH, { ip: "9.9.9.9" })).status === 200
  && (await notify({ email: "flood6@example.com" }, LAUNCH, { ip: "9.9.9.9" })).status, 400);

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
check("Nov 27 to 30: the bar leads with the skincare sale, free shipping, and the card says shop",
  [/data-campaign-banner[\s\S]*15% off skincare \+ free U.S. shipping/.test(homeSale), homeSale.includes("Shop 15% off skincare"),
    homeSale.includes('action="/api/notify"'), homeSale.includes('data-theme="black-edition"')],
  [true, true, false, true]);
const saleOrder = await checkout(PACK.concat(CLEANSER), SALE);
const [packLine, cleanserLine] = saleOrder.link.order.line_items;
check("Nov 27 to 30: 15% on skincare only, free shipping, no coupon stacking",
  [packLine.applied_discounts, cleanserLine.applied_discounts?.length, saleOrder.link.order.discounts.map((d) => d.catalog_object_id),
    saleOrder.link.checkout_options.shipping_fee, saleOrder.link.checkout_options.enable_coupon],
  [undefined, 1, ["D1"], undefined, false]);
check("the package stays $897 during the sale", [homeSale.includes("Add to bag · $897"), homeSale.includes("$762.45")], [true, false]);
check("during the sale, products show the regular price struck out, then the sale price",
  [/Was <\/span>\$34\.00<\/span> <span class="bf-now"><span class="sr-only">Now <\/span>\$28\.90/.test(homeSale), homeSale.includes("from Friday"), homeSale.includes('data-add-to-cart="V_CLEANSER"')],
  [true, false, true]);

{
  const cookie = sessionCookie(await createSessionToken(env, Date.now(), {}), {}).split(";")[0];
  const path = "/admin/campaigns/scheduled";
  const page = await (await handleAdminRequest(new Request(`https://x.test${path}`, { headers: { cookie } }), env, new URL(`https://x.test${path}`))).text();
  check("the admin Scheduled page counts the sign-ups and lists them",
    [/<strong>7<\/strong> people want an email/.test(page), page.includes("ana@example.com"), page.includes("Fri, Nov 27")], [true, true, true]);
}

// ------------------------------------------------- the Friday email
const before8 = await sendSaleNotifications(env, { now: new Date("2026-11-27T12:59:00Z") });
const at8 = await sendSaleNotifications(env, { now: new Date("2026-11-27T13:00:00Z") });
const sentTo = resendBatches.flatMap((batch) => batch.map((email) => email.to[0])).sort();
const nextRun = await sendSaleNotifications(env, { now: new Date("2026-11-27T13:15:00Z") });
const counted = await env.CLIENT_NOTES_DB.prepare("SELECT COUNT(*) AS n FROM email_other_sends WHERE kind = 'notify'").first();
check("the 'it's live' email goes Friday at 8 AM Eastern, once per person, and counts toward Resend's limit",
  [before8.reason, at8.sent, sentTo.length, sentTo.includes("ana@example.com"), nextRun.sent, counted.n,
    resendBatches[0][0].subject, resendBatches[0][0].headers["List-Unsubscribe"].includes("/email/unsubscribe?e=")],
  [ "not-due", 7, 7, true, 0, 7, "It's live: 15% off skincare + free shipping", true]);

check("the Terms page carries the promotion terms", (await text("/terms", SALE)).includes("Black Friday 2026 promotion"), true);

// ------------------------------------------------------------------- after
const homeAfter = await text("/", AFTER);
check("Dec 1: the usual routines section is back in its place", [homeAfter.includes("routines-section"), homeAfter.includes("bf-routine")], [true, false]);
check("Dec 1: the bar, the takeover and the black theme are gone",
  [homeAfter.includes("data-campaign-banner"), homeAfter.includes("bf-home"), homeAfter.includes("data-theme="), homeAfter.includes('class="announcement"')],
  [false, false, false, true]);
check("Dec 1: /black-friday goes to the shop", (await get("/black-friday", AFTER)).status, 302);
check("Dec 1: the package is off sale even if still visible in Square", (await checkout(PACK, AFTER)).status, 400);
const after = await checkout(CLEANSER, AFTER);
check("Dec 1: regular price, $10 shipping and the coupon box are back",
  [after.link.order.discounts, after.link.checkout_options.shipping_fee?.charge.amount, after.link.checkout_options.enable_coupon],
  [undefined, 1000, true]);
check("Dec 1: the Terms page is back to normal", (await text("/terms", AFTER)).includes("Black Friday"), false);

if (failures) { console.error(`\n${failures} Black Friday test(s) failed.`); process.exit(1); }
console.log("\nAll Black Friday tests passed.");
