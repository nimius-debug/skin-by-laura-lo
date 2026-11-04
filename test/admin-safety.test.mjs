import { routineFromOrders, purchaseHistoryFromOrders, servicesFromOrders, spendFromOrders, normalizeOrder } from "../src/admin/routine.js";
import { stepFor } from "../src/admin/routine-steps.js";
import { formatMoney, timeAgo } from "../src/admin/format.js";
import { findFlags } from "../src/admin/safety.js";
import { clientProfilePage } from "../src/admin/pages/client-profile.js";
import { toString } from "../src/html.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

// --- orders -----------------------------------------------------------------

const products = [
  { name: "Mixi Clean", slug: "mixi-clean", image: "https://img.test/clean.jpg", category: "Cleansers", variations: [{ id: "V1" }] },
  { name: "Mixi Mandelic Acid 5%", slug: "mandelic-5", image: null, category: "", variations: [{ id: "V2" }, { id: "V3" }] },
];
// A normalised order (amounts in cents). Lines default to quantity 1.
const order = (id, createdAt, lines, tipCents = 0) => ({
  id, createdAt, tipCents,
  totalCents: lines.reduce((sum, line) => sum + line.totalCents, 0) + tipCents,
  lines: lines.map((line, index) => ({ uid: `${id}-${index}`, quantity: 1, name: line.catalogObjectId, ...line })),
});
const SERVICE = { catalogObjectId: "A-SERVICE", name: "Acne Bootcamp Facial", totalCents: 9000 };
const orders = [
  order("o2", "2026-09-18T10:00:00Z", [{ catalogObjectId: "V1", totalCents: 3900 }, SERVICE], 1350),
  order("o1", "2026-03-01T10:00:00Z", [{ catalogObjectId: "V1", quantity: 2, totalCents: 7800 }, { catalogObjectId: "V2", totalCents: 4500 }]),
];

// normalisation of a real Square order (an order from Ana Casado's history, trimmed)
const normalized = normalizeOrder({
  id: "VK", created_at: "2026-03-21T14:48:52.816Z", total_money: { amount: 15714 }, total_tip_money: { amount: 2580 },
  line_items: [
    { uid: "A", catalog_object_id: "FM3", quantity: "1", name: "Acne Bootcamp Facial (Existing Clients Only)", total_money: { amount: 9000 } },
    { catalog_object_id: "NT5", quantity: "0", name: "Corthe Dermo Pure First Aid Toner", total_money: { amount: 4134 } },
    { name: "Custom item" },
  ],
});
check("a Square order is normalised to cents, with tip and line prices",
  [normalized.totalCents, normalized.tipCents, normalized.lines[1].totalCents], [15714, 2580, 4134]);
check("a missing or zero quantity counts as one and a missing id is kept as null",
  [normalized.lines[1].quantity, normalized.lines[2].catalogObjectId, normalized.lines[2].totalCents], [1, null, 0]);

// --- routine ----------------------------------------------------------------

const routine = routineFromOrders(orders, products);
check("the current routine is the latest order's products, with photo, date and step",
  routine.items, [{ name: "Mixi Clean", slug: "mixi-clean", image: "https://img.test/clean.jpg", boughtAt: "2026-09-18T10:00:00Z", step: "cleanse" }]);
check("an order from 6 months earlier is outside the routine window", routine.items.length, 1);

const recent = [
  order("o5", "2026-09-18T10:00:00Z", [{ catalogObjectId: "V1", totalCents: 1 }]),
  order("o4", "2026-08-20T10:00:00Z", [{ catalogObjectId: "V2", totalCents: 1 }, { catalogObjectId: "V1", totalCents: 1 }]),
  order("o3", "2026-06-10T10:00:00Z", [{ catalogObjectId: "V3", totalCents: 1 }]),
];
const windowed = routineFromOrders(recent, products, Date.parse("2026-10-01T00:00:00Z"));
check("the routine combines products from orders in the 4 months up to the last one",
  windowed.items.map((item) => [item.name, item.boughtAt.slice(0, 10)]), [["Mixi Clean", "2026-09-18"], ["Mixi Mandelic Acid 5%", "2026-08-20"]]);
check("a product bought twice appears once, with its latest date", windowed.items.filter((item) => item.name === "Mixi Clean").length, 1);
check("a recent last product order is not marked stale", windowed.stale, false);
check("a last product order over 6 months ago is marked stale",
  routineFromOrders(recent, products, Date.parse("2027-04-01T00:00:00Z")).stale, true);
check("no orders means no routine", routineFromOrders([], products), null);
const serviceOnlyLatest = [order("o9", "2026-04-04T15:00:00Z", [SERVICE]), ...orders];
const lookedBack = routineFromOrders(serviceOnlyLatest, products, Date.parse("2026-10-01T00:00:00Z"));
check("a service-only latest order looks back to the last order with products", lookedBack.items.map((item) => item.name), ["Mixi Clean"]);
check("the routine keeps the product order's date and notes the later visit", [lookedBack.orderedAt, lookedBack.laterVisitAt], ["2026-09-18T10:00:00Z", "2026-04-04T15:00:00Z"]);
check("the latest order having products leaves no later-visit note", routine.laterVisitAt, null);
check("orders with no products at all give no routine", routineFromOrders([serviceOnlyLatest[0]], products), null);

// --- history, services and spend --------------------------------------------

const history = purchaseHistoryFromOrders(orders, products);
check("history counts every unit across orders", history.map((item) => [item.name, item.count]), [["Mixi Clean", 3], ["Mixi Mandelic Acid 5%", 1]]);
check("history adds up what she paid for each product", history.map((item) => item.spentCents), [11700, 4500]);
check("history keeps the first and last order date", [history[0].firstBought, history[0].lastBought], ["2026-03-01", "2026-09-18"]);
check("history lists the most recently bought product first", history[0].name, "Mixi Clean");
check("services are not products", history.length, 2);

check("services are listed with count, price and last date",
  servicesFromOrders(orders, products), [{ name: "Acne Bootcamp Facial", count: 1, spentCents: 9000, lastDate: "2026-09-18" }]);

const spend = spendFromOrders(orders, products);
check("total spend is everything she paid, including the service and tip", spend.totalCents, 26550);
check("spend splits into products, services and tips", [spend.productCents, spend.serviceCents, spend.tipCents], [16200, 9000, 1350]);
check("the split adds up to the total", spend.productCents + spend.serviceCents + spend.tipCents, spend.totalCents);
check("spend knows the order count and first and last order", [spend.orderCount, spend.firstOrderAt, spend.lastOrderAt], [2, "2026-03-01T10:00:00Z", "2026-09-18T10:00:00Z"]);
check("no orders means no spend", spendFromOrders([], products).totalCents, 0);

// --- routine steps and formatting -------------------------------------------

check("products are placed in the usual routine steps",
  ["Corthe Dermo Essential Cleansing Oil", "Skin Recovery Mist", "Mixi Mandelic Acid 8%", "Corthe Rich M Lotion", "Desembre EGF Waterdrop", "Hydrating Sheet Mask"].map((name) => stepFor(name)),
  ["cleanse", "tone", "treat", "moisturize", "protect", "mask"]);
check("an unrecognised product goes under other", stepFor("Mixi Dew Drops"), "other");
check("money shows dollars and cents", [formatMoney(4500), formatMoney(123456), formatMoney(0)], ["$45.00", "$1,234.56", "$0.00"]);
const NOW = Date.parse("2026-10-12T12:00:00Z");
check("how long ago reads naturally",
  ["2026-10-12", "2026-10-05", "2026-09-01", "2026-03-31", "2024-01-01"].map((day) => timeAgo(day, NOW)),
  ["today", "7 days ago", "5 weeks ago", "6 months ago", "2 years ago"]);

// --- safety flags -----------------------------------------------------------

const note = (summary, extra = {}) => ({ id: "n1", source: "square", note_date: "2026-01-02", summary, ...extra });
const mineral = { name: "Zinc Shield SPF", formula: "Zinc Oxide, Water, Glycerin" };
const gentle = { name: "Plain Cleanser", formula: "Water, Glycerin, Aloe Vera" };

const mineralFlags = findFlags({ notes: [note("- Allergic to physical spf")], products: [mineral, gentle] });
check("an allergy to physical SPF flags the mineral sunscreen", mineralFlags[0].level, "warn");
check("the flag names the product that matches", mineralFlags[0].detail.includes("Zinc Shield SPF"), true);
check("the flag quotes the note and its date", mineralFlags[0].detail.includes("Allergic to physical spf") && mineralFlags[0].detail.includes("Jan 2, 2026"), true);
check("a product that doesn't match is not named", mineralFlags[0].detail.includes("Plain Cleanser"), false);

const coconut = findFlags({ notes: [note("Allergic to coconut")], products: [{ name: "Body Butter", formula: "Coconut Oil, Shea Butter" }] });
check("an allergen named in the note is found in an ingredient list", coconut[0].detail.includes("Body Butter (lists coconut)"), true);

check("'no allergies' is not an allergy", findFlags({ notes: [note("No allergies")], products: [mineral] }), []);
check("no signals in the notes means no flags", findFlags({ notes: [note("loves the cica mask")], products: [mineral] }), []);

const pregnant = findFlags({
  notes: [note("- Pregnant")],
  products: [{ name: "Night Retinol", formula: "Retinol, Squalane" }, gentle],
});
check("pregnancy flags a retinoid as a warning", [pregnant[0].level, pregnant[0].detail.includes("Night Retinol (a retinoid)")], ["warn", true]);

const accutane = findFlags({ notes: [{ id: "sheet_R1", source: "noteful", note_date: null, summary: "x" }], products: [] });
check("sheet notes are read from Notes / remarks (Accutane in sheet row 1)", accutane.some((flag) => flag.title === "Past Accutane noted"), true);

const tingle = findFlags({ notes: [note("- Clear peel 2 passes w/o tingle")], products: [] });
check("'without tingle' is not a reaction", tingle, []);
const reacted = findFlags({ notes: [note("- Cica mask tingled !!")], products: [] });
check("a reaction is noted", reacted[0].title, "Past reaction");

const unscreened = findFlags({ notes: [note("sensitive skin")], products: [{ name: "Mystery Serum", formula: "" }] });
check("a product with no ingredient list is reported as not screened",
  unscreened.some((flag) => flag.title === "Not screened" && flag.detail.includes("Mystery Serum")), true);
check("warnings come before notes",
  findFlags({ notes: [note("- Pregnant"), note("sensitive skin", { id: "n2" })], products: [] }).map((flag) => flag.level), ["warn", "note"]);

// --- page -------------------------------------------------------------------

const staleRoutine = routineFromOrders(orders, products, NOW);
const render = (props) => toString(clientProfilePage({ client: { id: "c1", name: "Test" }, notes: [], history: [], services: [], flags: [], sourceFiles: [], now: NOW, ...props }));

const page = render({ routine: staleRoutine, history, services: servicesFromOrders(orders, products), spend, flags: mineralFlags,
  purchases: { syncedAt: "2026-10-12T11:55:00Z", source: "stored", failed: false } });
check("the page shows a Heads-up card with the allergy", page.includes("Heads-up") && page.includes("Allergy noted"), true);
check("the page shows the product photo", page.includes('src="https://img.test/clean.jpg"'), true);
check("the page says who the product is good for in one line", page.includes("Good for:") && page.includes("Sensitive and acne-prone skin"), true);
check("the routine is collapsible and open by default", /<details class="card routine-card" open>/.test(page), true);
check("the routine groups products by step", page.includes('class="step-label">Cleanser<'), true);
check("a recent purchase shows how long ago and is not marked used up", page.includes("Bought 3 weeks ago") && !page.includes("probably used up"), true);
check("a recent last product order does not tell her to re-check", page.includes("Ask what she uses now"), false);
check("the page lists everything she has bought with counts and prices", page.includes("3 bought · $117.00"), true);
check("the page lists services with their price", page.includes("Acne Bootcamp Facial") && page.includes("$90.00"), true);
check("the page shows total spend with its split", page.includes("Spent with you") && page.includes("$265.50") && page.includes("$162.00"), true);
check("the page offers a refresh from Square and says when it was last updated",
  page.includes('/admin/clients/c1?refresh=1') && page.includes("Updated today"), true);

const longAgo = routineFromOrders([order("o1", "2026-03-31T10:00:00Z", [{ catalogObjectId: "V1", totalCents: 3900 }])], products, NOW);
const stalePage = render({ routine: longAgo });
check("a product from 6 months ago is probably used up", stalePage.includes("Bought 6 months ago · probably used up"), true);
check("an old last product order tells her to ask what she uses now", stalePage.includes("Ask what she uses now"), true);
const freshRoutine = routineFromOrders([order("o1", "2026-10-01T10:00:00Z", [{ catalogObjectId: "V1", totalCents: 3900 }])], products, NOW);
check("a recent purchase is not marked used up", render({ routine: freshRoutine }).includes("probably used up"), false);

const laterNote = render({ routine: { ...lookedBack, squareOrderUrl: "#" } });
check("the page says the latest order was only a service", laterNote.includes("had no shop products, only a service") && laterNote.includes("Apr 4, 2026"), true);
check("a routine item with no known step still shows, under Other",
  (() => { const html = render({ routine: { items: [{ name: "Mystery Item", slug: "m", boughtAt: "2026-10-01T00:00:00Z" }], orderedAt: "2026-10-01T00:00:00Z", squareOrderUrl: "#" } }); return html.includes("Mystery Item") && html.includes('class="step-label">Other<'); })(), true);
check("a client with no flags gets no Heads-up card", render({ routine: null }).includes("Heads-up"), false);
check("a client with no orders gets no spend card", render({ routine: null, spend: spendFromOrders([], products) }).includes("Spent with you"), false);
check("a failed Square read says so instead of showing nothing",
  render({ routine: null, purchases: { source: "none", failed: true } }).includes("Couldn't read her purchases from Square"), true);

console.log(failures === 0 ? "\nAll admin-safety tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
