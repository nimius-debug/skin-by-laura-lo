// Best-seller ordering — Square's Reporting API, read-only.
//
// A trailing window (not all-time) so current demand decides the order and a
// new product can still rise; units sold (not revenue) so a $10 cleanser that
// sells constantly outranks a $90 serum that doesn't, matching what shoppers
// mean by "best seller."
//
// This calls Square at most once per Worker isolate per SALES_RANK_TTL_SECONDS
// — the same per-isolate memo pattern getCatalog() uses for the catalog
// itself — never on every page view. A slow/missing Reporting API (wrong
// token scope, rate limit, network error) must never break the shop: on any
// failure this returns an empty ranking and the catalog simply falls back to
// its existing alphabetical order.

import { squareFetch } from "./square.js";

const WINDOW_DAYS = 90;

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function windowRange(now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - WINDOW_DAYS);
  const iso = (date, endOfDay) =>
    `${date.toISOString().slice(0, 10)}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`;
  return [iso(start, false), iso(end, true)];
}

async function fetchSalesByName(env) {
  const payload = await squareFetch(env, "/reporting/v1/load", {
    query: {
      measures: ["ProductMixReport.items_sold_quantity"],
      dimensions: ["ProductMixReport.item_name"],
      timeDimensions: [
        { dimension: "ProductMixReport.local_reporting_timestamp", dateRange: windowRange() },
      ],
      // No `order` clause — Square's Reporting API rejects it here; sorting
      // happens client-side once the (small) result set is back instead.
      limit: 500,
    },
  });

  const rank = new Map();
  for (const row of payload.data || []) {
    const name = row["ProductMixReport.item_name"];
    const quantity = Number(row["ProductMixReport.items_sold_quantity"]);
    if (!name || !Number.isFinite(quantity)) continue;
    const key = normalizeName(name);
    rank.set(key, (rank.get(key) || 0) + quantity);
  }
  return rank;
}

// Per-isolate memo, mirroring getCatalog()'s pattern — sales data moves slowly
// enough that a multi-hour TTL is appropriate, well away from the account's
// shared daily Workers request limit.
let memo = { expires: 0, rank: null };

/** Units sold per product name (normalized) over the trailing window. */
export async function salesRankFor(env, ttlSeconds, { force = false } = {}) {
  const now = Date.now();
  if (!force && memo.rank && now < memo.expires) return memo.rank;

  let rank;
  try {
    rank = await fetchSalesByName(env);
  } catch (error) {
    console.error("Sales rank lookup failed, falling back to alphabetical order:", error.message);
    rank = new Map();
  }

  if (ttlSeconds > 0) memo = { expires: now + ttlSeconds * 1000, rank };
  return rank;
}

/**
 * Reorders products best-seller-first within an already-sorted list. Stable
 * sort (guaranteed by the JS spec) means every tie — including the common
 * case of two products with zero sales in the window — keeps its existing
 * relative order, so this only ever promotes proven sellers rather than
 * reshuffling everything else.
 */
export function applySalesRank(products, rank) {
  return [...products].sort((a, b) => {
    const soldA = rank.get(normalizeName(a.name)) || 0;
    const soldB = rank.get(normalizeName(b.name)) || 0;
    return soldB - soldA;
  });
}
