import assert from "node:assert/strict";
import { salesRankFor, applySalesRank, topSellerSlugs } from "../src/sales-rank.js";

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
globalThis.fetch = async (url, options) => {
  calls++;
  assert.equal(new URL(url).pathname, "/reporting/v1/load", "queries the Reporting API load endpoint");
  const body = JSON.parse(options.body);
  assert.ok(
    !body.query.timeDimensions || body.query.timeDimensions.length === 0,
    "queries all-time totals, not a trailing window — this catalog doesn't sell enough for a recent window to be meaningful",
  );
  assert.ok(!body.query.order, "never sends an order clause — Square's Reporting API rejects it for this query shape");
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

// ---------------------------------------------------------------- topSellerSlugs

const catalog = [
  { slug: "cleanser-top", name: "Cleanser Top", category: "Cleansers" },
  { slug: "cleanser-second", name: "Cleanser Second", category: "Cleansers" },
  { slug: "cleanser-third", name: "Cleanser Third", category: "Cleansers" }, // sold, but 3rd — no badge
  { slug: "cleanser-none", name: "Cleanser None", category: "Cleansers" }, // never sold
  { slug: "serum-only-seller", name: "Serum Only Seller", category: "Serums" },
  { slug: "serum-quiet", name: "Serum Quiet", category: "Serums" }, // never sold — category still gets 1 badge
];
const catalogRank = new Map([
  ["cleanser top", 20],
  ["cleanser second", 15],
  ["cleanser third", 5],
  ["serum only seller", 3],
]);

const badges = topSellerSlugs(catalog, catalogRank, 2);
assert.deepEqual(
  [...badges].sort(),
  ["cleanser-second", "cleanser-top", "serum-only-seller"],
  "top 2 sellers per category get badged; a never-sold product is never badged even alone in its category",
);

console.log("PASS  best-seller badge picks the top 2 per category, and only products that actually sold");
