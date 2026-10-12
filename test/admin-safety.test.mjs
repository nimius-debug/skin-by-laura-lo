import { routineFromOrders, purchaseHistoryFromOrders } from "../src/admin/routine.js";
import { findFlags } from "../src/admin/safety.js";
import { clientProfilePage } from "../src/admin/pages/client-profile.js";
import { toString } from "../src/html.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

// --- purchase history -------------------------------------------------------

const products = [
  { name: "Mixi Clean", slug: "mixi-clean", image: "https://img.test/clean.jpg", variations: [{ id: "V1" }] },
  { name: "Mixi Mandelic Acid 5%", slug: "mandelic-5", image: null, variations: [{ id: "V2" }, { id: "V3" }] },
];
const orders = [
  { id: "o2", created_at: "2026-09-18T10:00:00Z", line_items: [{ catalog_object_id: "V1", quantity: "1" }, { catalog_object_id: "A-SERVICE", quantity: "1" }] },
  { id: "o1", created_at: "2026-03-01T10:00:00Z", line_items: [{ catalog_object_id: "V1", quantity: "2" }, { catalog_object_id: "V2", quantity: "1" }] },
];

const routine = routineFromOrders(orders, products);
check("the current routine is the latest order's products, with their photos",
  routine.items, [{ name: "Mixi Clean", slug: "mixi-clean", image: "https://img.test/clean.jpg" }]);
check("no orders means no routine", routineFromOrders([], products), null);
const serviceOnlyLatest = [
  { id: "o3", created_at: "2026-04-04T15:00:00Z", line_items: [{ catalog_object_id: "A-SERVICE", quantity: "1" }] },
  ...orders,
];
const lookedBack = routineFromOrders(serviceOnlyLatest, products);
check("a service-only latest order looks back to the last order with products", lookedBack.items.map((item) => item.name), ["Mixi Clean"]);
check("the routine keeps the product order's date and notes the later visit", [lookedBack.orderedAt, lookedBack.laterVisitAt], ["2026-09-18T10:00:00Z", "2026-04-04T15:00:00Z"]);
check("the latest order having products leaves no later-visit note", routine.laterVisitAt, null);
check("orders with no products at all give no routine", routineFromOrders([serviceOnlyLatest[0]], products), null);

const history = purchaseHistoryFromOrders(orders, products);
check("history counts every unit across orders", history.map((item) => [item.name, item.count]), [["Mixi Clean", 3], ["Mixi Mandelic Acid 5%", 1]]);
check("history keeps the first and last order date", [history[0].firstBought, history[0].lastBought], ["2026-03-01", "2026-09-18"]);
check("history lists the most recently bought product first", history[0].name, "Mixi Clean");
check("services and custom items are not products", history.length, 2);

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

const page = toString(clientProfilePage({
  client: { id: "c1", name: "Test" },
  notes: [],
  routine: { items: [{ name: "Mixi Clean", slug: "mixi-clean", image: "https://img.test/clean.jpg" }], orderedAt: "2026-09-18T00:00:00Z", squareOrderUrl: "#" },
  history,
  flags: mineralFlags,
  sourceFiles: [],
}));
check("the page shows a Heads-up card with the allergy", page.includes("Heads-up") && page.includes("Allergy noted"), true);
check("the page shows the product photo", page.includes('src="https://img.test/clean.jpg"'), true);
check("the page says who the product is good for in one line", page.includes("Good for:") && page.includes("Sensitive and acne-prone skin"), true);
const laterNote = toString(clientProfilePage({
  client: { id: "c1", name: "Test" }, notes: [], history: [], flags: [], sourceFiles: [],
  routine: { ...lookedBack, squareOrderUrl: "#" },
}));
check("the page says the latest order was only a service", laterNote.includes("had no shop products, only a service") && laterNote.includes("Apr 4, 2026"), true);
check("the page lists everything she has bought with counts", page.includes("Everything she has bought") && page.includes("3 bought"), true);
check("a client with no flags gets no Heads-up card",
  toString(clientProfilePage({ client: { id: "c1", name: "Test" }, notes: [], routine: null, history: [], flags: [], sourceFiles: [] })).includes("Heads-up"), false);

console.log(failures === 0 ? "\nAll admin-safety tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
