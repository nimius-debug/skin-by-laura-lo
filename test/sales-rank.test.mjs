import assert from "node:assert/strict";
import { salesRankFor, applySalesRank } from "../src/sales-rank.js";

// ---------------------------------------------------------------- applySalesRank

const products = [
  { name: "Alpha Cleanser" }, // alphabetically first, no sales
  { name: "Beta Serum" },     // best seller
  { name: "Gamma Toner" },    // second-best seller
  { name: "Delta Mask" },     // alphabetically last, no sales
];

const rank = new Map([
  ["beta serum", 12],
  ["gamma toner", 4],
]);

const ordered = applySalesRank(products, rank).map((p) => p.name);
assert.deepEqual(
  ordered,
  ["Beta Serum", "Gamma Toner", "Alpha Cleanser", "Delta Mask"],
  "best sellers sort first by units sold; zero-sales products keep their existing relative order",
);

assert.deepEqual(
  products.map((p) => p.name),
  ["Alpha Cleanser", "Beta Serum", "Gamma Toner", "Delta Mask"],
  "applySalesRank does not mutate the input array",
);

console.log("PASS  best sellers sort first, ties keep the incoming order (stable sort)");

// ---------------------------------------------------------------- salesRankFor

const env = { SQUARE_ACCESS_TOKEN: "t", SQUARE_LOCATION_ID: "L1", SQUARE_ENVIRONMENT: "sandbox" };

let calls = 0;
globalThis.fetch = async (url) => {
  calls++;
  assert.equal(new URL(url).pathname, "/reporting/v1/load", "queries the Reporting API load endpoint");
  return new Response(
    JSON.stringify({
      data: [
        // Trailing whitespace and mixed case, as Square's own data actually has.
        { "ProductMixReport.item_name": "Desembre EGF Waterdrop ", "ProductMixReport.items_sold_quantity": 7 },
        { "ProductMixReport.item_name": "mixi clean", "ProductMixReport.items_sold_quantity": 2 },
        // No item name at all (a stray total row) — must be skipped, not crash.
        { "ProductMixReport.items_sold_quantity": 0 },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};

const rank1 = await salesRankFor(env, 3600, { force: true });
assert.equal(calls, 1, "fetched once");
assert.equal(rank1.get("desembre egf waterdrop"), 7, "trims whitespace before matching");
assert.equal(rank1.get("mixi clean"), 2, "lowercases before matching");

const rank2 = await salesRankFor(env, 3600, {});
assert.equal(calls, 1, "a second call within the TTL reuses the memoized result instead of refetching");
assert.equal(rank2, rank1, "returns the same memoized Map");

const rank3 = await salesRankFor(env, 3600, { force: true });
assert.equal(calls, 2, "force bypasses the memo");

console.log("PASS  fetches once, memoizes within the TTL, force bypasses it, names normalized for matching");

// ---------------------------------------------------------------- failure safety

globalThis.fetch = async () => {
  throw new Error("Square is down");
};
const failedRank = await salesRankFor(env, 3600, { force: true });
assert.equal(failedRank.size, 0, "a Reporting API failure yields an empty ranking, not a thrown error");

console.log("PASS  a Reporting API failure never breaks catalog loading — falls back to no ranking");
