// Best-seller ordering — Square's Reporting API, read-only.
//
// All-time totals, not a trailing window — this is a boutique catalog with
// low order volume (most products sell in the single digits over a 90-day
// window), so a recent-only window mostly just measures noise. All-time
// gives every product enough of a sample to compare fairly. Units sold, not
// revenue, so a $10 cleanser that sells constantly outranks a $90 serum that
// doesn't — that's what shoppers mean by "best seller."
//
// This calls Square at most once per Worker isolate per SALES_RANK_TTL_SECONDS
// — the same per-isolate memo pattern getCatalog() uses for the catalog
// itself — never on every page view. A slow/missing Reporting API (wrong
// token scope, rate limit, network error) must never break the shop: on any
// failure this returns an empty ranking and the catalog simply falls back to
// its existing alphabetical order.

import { squareFetch } from "./square.js";

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function fetchSalesByName(env) {
  const payload = await squareFetch(env, "/reporting/v1/load", {
    query: {
      measures: ["ProductMixReport.items_sold_quantity"],
      dimensions: ["ProductMixReport.item_name"],
      // No timeDimensions — omitting it entirely returns all-time totals.
      // No `order` clause either — Square's Reporting API rejects it here;
      // sorting happens client-side once the (small) result set is back.
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

/** All-time units sold per product name (normalized). */
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

function unitsSold(product, rank) {
  return rank.get(normalizeName(product.name)) || 0;
}

/**
 * Reorders products best-seller-first within an already-sorted list. Stable
 * sort (guaranteed by the JS spec) means every tie — including the common
 * case of two products with zero sales — keeps its existing relative order,
 * so this only ever promotes proven sellers rather than reshuffling
 * everything else.
 */
export function applySalesRank(products, rank) {
  return [...products].sort((a, b) => unitsSold(b, rank) - unitsSold(a, rank));
}

/**
 * The top `perCategory` sellers within each category, as a Set of slugs —
 * only products that have actually sold something qualify, so a category
 * with no sales at all gets no badge rather than an arbitrary one. Call
 * after applySalesRank so ties within a category already read in a sensible
 * (stable, alphabetical-among-ties) order.
 */
export function topSellerSlugs(products, rank, perCategory = 2) {
  const byCategory = new Map();
  for (const product of products) {
    if (unitsSold(product, rank) <= 0) continue;
    const bucket = byCategory.get(product.category) || [];
    bucket.push(product);
    byCategory.set(product.category, bucket);
  }

  const slugs = new Set();
  for (const bucket of byCategory.values()) {
    for (const product of bucket.slice(0, perCategory)) slugs.add(product.slug);
  }
  return slugs;
}
