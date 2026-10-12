// What a client has bought. Orders are read from Square, copied into D1 (see
// purchases.js) and normalised to one shape, so every view below is computed the
// same way whether the orders just came from Square or from the stored copy:
//   - the current routine: what she bought in the 4 months up to her last product order
//   - the purchase history: every product, with how many, what she paid and when
//   - services: the non-product lines (facials and so on), counted the same way
//   - spend: what she has paid in total, split into products, services and tips
//
// A "normalised order" is:
//   { id, createdAt, totalCents, tipCents, lines: [{ uid, catalogObjectId, name, quantity, totalCents }] }
// Amounts are in cents and include tax and discounts as Square reports them.

import { squareFetch } from "../square.js";
import { stepFor } from "./routine-steps.js";

// Square returns up to 100 orders a page; five pages is far more than any one client has.
const MAX_PAGES = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
// What she was likely using: everything bought in the 4 months up to her last product order.
// One order is often a single product, so a single order would badly under-count a routine.
const ROUTINE_WINDOW_DAYS = 120;
// A last product order older than this is probably not what she uses now.
const STALE_AFTER_DAYS = 180;

function positiveInt(value) {
  const number = Number.parseInt(value, 10);
  return number > 0 ? number : 1;
}

/** One Square order, in the shape stored in D1 and used everywhere below. */
export function normalizeOrder(order) {
  return {
    id: order.id,
    createdAt: order.created_at,
    totalCents: order.total_money?.amount || 0,
    tipCents: order.total_tip_money?.amount || 0,
    lines: (order.line_items || []).map((line, index) => ({
      uid: line.uid || `line-${index}`,
      catalogObjectId: line.catalog_object_id || null,
      name: line.name || "Item",
      quantity: positiveInt(line.quantity),
      totalCents: line.total_money?.amount || 0,
    })),
  };
}

/** All of a customer's completed orders from Square, newest first, normalised. */
export async function fetchClientOrders(env, squareCustomerId) {
  const orders = [];
  let cursor;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = await squareFetch(env, "/v2/orders/search", {
      location_ids: [env.SQUARE_LOCATION_ID],
      query: {
        filter: {
          customer_filter: { customer_ids: [squareCustomerId] },
          state_filter: { states: ["COMPLETED"] },
        },
        sort: { sort_field: "CREATED_AT", sort_order: "DESC" },
      },
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    orders.push(...(payload.orders || []).map(normalizeOrder));
    cursor = payload.cursor;
    if (!cursor) break;
  }
  return orders;
}

function productsByVariation(products) {
  const byVariation = new Map();
  for (const product of products) {
    for (const variation of product.variations) byVariation.set(variation.id, product);
  }
  return byVariation;
}

/** The catalog products on one order. Lines that aren't catalog products (services, custom items) are left out. */
function productLines(order, byVariation) {
  return order.lines
    .map((line) => {
      const product = byVariation.get(line.catalogObjectId);
      if (!product) return null;
      return {
        name: product.name, slug: product.slug, image: product.image || null, category: product.category || "",
        quantity: line.quantity, totalCents: line.totalCents,
      };
    })
    .filter(Boolean);
}

/** The lines on one order that are not catalog products: services and anything custom. */
function otherLines(order, byVariation) {
  return order.lines.filter((line) => !byVariation.has(line.catalogObjectId));
}

/**
 * The current routine: the products bought in the 4 months up to her most
 * recent order that included products, each once, newest first, with the date
 * it was last bought and the routine step it belongs to. Her latest order is
 * often just a facial, so `laterVisitAt` is set when a newer order without
 * products exists. `stale` is true when the last product order was over 6
 * months ago. `orders` is newest first.
 */
export function routineFromOrders(orders, products, now = Date.now()) {
  const byVariation = productsByVariation(products);
  const withProducts = orders
    .map((order) => ({ order, items: productLines(order, byVariation) }))
    .filter((entry) => entry.items.length);
  if (!withProducts.length) return null;

  const latest = withProducts[0].order;
  const latestMs = Date.parse(latest.createdAt);
  const cutoff = latestMs - ROUTINE_WINDOW_DAYS * DAY_MS;

  const bought = new Map();
  for (const { order, items } of withProducts) {
    if (Date.parse(order.createdAt) < cutoff) break;
    for (const item of items) {
      if (!bought.has(item.slug)) {
        bought.set(item.slug, {
          name: item.name, slug: item.slug, image: item.image, boughtAt: order.createdAt, step: stepFor(item.name, item.category),
        });
      }
    }
  }

  return {
    items: [...bought.values()],
    orderedAt: latest.createdAt,
    laterVisitAt: latest === orders[0] ? null : orders[0].createdAt,
    stale: now - latestMs > STALE_AFTER_DAYS * DAY_MS,
    windowDays: ROUTINE_WINDOW_DAYS,
    squareOrderUrl: `https://squareup.com/dashboard/orders/overview/${latest.id}`,
  };
}

/** Every product across all orders: how many, what she paid, first and last order date. Most recently bought first. */
export function purchaseHistoryFromOrders(orders, products) {
  const byVariation = productsByVariation(products);
  const history = new Map();
  for (const order of orders) {
    const date = (order.createdAt || "").slice(0, 10) || null;
    for (const item of productLines(order, byVariation)) {
      const entry = history.get(item.slug) || {
        name: item.name, slug: item.slug, image: item.image, count: 0, spentCents: 0, firstBought: date, lastBought: date,
      };
      entry.count += item.quantity;
      entry.spentCents += item.totalCents;
      if (date && (!entry.firstBought || date < entry.firstBought)) entry.firstBought = date;
      if (date && (!entry.lastBought || date > entry.lastBought)) entry.lastBought = date;
      history.set(item.slug, entry);
    }
  }
  return [...history.values()].sort((a, b) => (b.lastBought || "").localeCompare(a.lastBought || ""));
}

/** Services (and other non-product lines) grouped by name: how many, what she paid, last date. */
export function servicesFromOrders(orders, products) {
  const byVariation = productsByVariation(products);
  const services = new Map();
  for (const order of orders) {
    const date = (order.createdAt || "").slice(0, 10) || null;
    for (const line of otherLines(order, byVariation)) {
      const entry = services.get(line.name) || { name: line.name, count: 0, spentCents: 0, lastDate: date };
      entry.count += line.quantity;
      entry.spentCents += line.totalCents;
      if (date && (!entry.lastDate || date > entry.lastDate)) entry.lastDate = date;
      services.set(line.name, entry);
    }
  }
  return [...services.values()].sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));
}

/** What she has paid in total, and how it splits. Totals include tax and tips, as paid. */
export function spendFromOrders(orders, products) {
  const byVariation = productsByVariation(products);
  const spend = { totalCents: 0, productCents: 0, serviceCents: 0, tipCents: 0, orderCount: orders.length, firstOrderAt: null, lastOrderAt: null };
  for (const order of orders) {
    spend.totalCents += order.totalCents;
    spend.tipCents += order.tipCents;
    for (const line of order.lines) {
      if (byVariation.has(line.catalogObjectId)) spend.productCents += line.totalCents;
      else spend.serviceCents += line.totalCents;
    }
    if (!spend.firstOrderAt || order.createdAt < spend.firstOrderAt) spend.firstOrderAt = order.createdAt;
    if (!spend.lastOrderAt || order.createdAt > spend.lastOrderAt) spend.lastOrderAt = order.createdAt;
  }
  return spend;
}

/** Every view of a client's purchases, from her normalised orders (newest first). */
export function purchaseViewFrom(orders, products, now = Date.now()) {
  return {
    routine: routineFromOrders(orders, products, now),
    history: purchaseHistoryFromOrders(orders, products),
    services: servicesFromOrders(orders, products),
    spend: spendFromOrders(orders, products),
  };
}
