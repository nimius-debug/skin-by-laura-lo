// What a client has bought is never stored — it's read live from their
// completed Square orders, so it can never drift out of sync with what they
// actually bought. Two views come from the same orders:
//   - the current routine: the products in their most recent order
//   - the purchase history: every product across all their orders, with how
//     many they bought and when
// Square tells us which products and when, not which skincare step each one
// belongs to (cleanse/treat/moisturize/SPF), so these are flat product lists
// rather than invented roles.

import { squareFetch, isConfigured } from "../square.js";

// Square returns up to 100 orders a page; five pages is far more than any one client has.
const MAX_PAGES = 5;

async function fetchCompletedOrders(env, squareCustomerId) {
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
    orders.push(...(payload.orders || []));
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

/** The catalog products on one order. Lines that aren't catalog products (services, custom items) are skipped. */
function orderItems(order, byVariation) {
  return (order.line_items || [])
    .map((line) => {
      const product = byVariation.get(line.catalog_object_id);
      if (!product) return null;
      const quantity = Number.parseInt(line.quantity, 10);
      return { name: product.name, slug: product.slug, image: product.image || null, quantity: quantity > 0 ? quantity : 1 };
    })
    .filter(Boolean);
}

/** The latest order, as the "current routine". `orders` is newest first. */
export function routineFromOrders(orders, products) {
  const order = orders[0];
  if (!order) return null;
  const items = orderItems(order, productsByVariation(products)).map(({ name, slug, image }) => ({ name, slug, image }));
  return {
    items,
    orderedAt: order.created_at,
    squareOrderUrl: `https://squareup.com/dashboard/orders/overview/${order.id}`,
  };
}

/** Every product across all orders: how many were bought, first and last order date. Most recently bought first. */
export function purchaseHistoryFromOrders(orders, products) {
  const byVariation = productsByVariation(products);
  const history = new Map();
  for (const order of orders) {
    const date = (order.created_at || "").slice(0, 10) || null;
    for (const item of orderItems(order, byVariation)) {
      const entry = history.get(item.slug) || {
        name: item.name, slug: item.slug, image: item.image, count: 0, firstBought: date, lastBought: date,
      };
      entry.count += item.quantity;
      if (date && (!entry.firstBought || date < entry.firstBought)) entry.firstBought = date;
      if (date && (!entry.lastBought || date > entry.lastBought)) entry.lastBought = date;
      history.set(item.slug, entry);
    }
  }
  return [...history.values()].sort((a, b) => (b.lastBought || "").localeCompare(a.lastBought || ""));
}

/** { routine, history, orderCount } for a Square customer, or null when Square isn't connected. */
export async function clientPurchasesFor(env, products, squareCustomerId) {
  if (!squareCustomerId || !isConfigured(env)) return null;
  const orders = await fetchCompletedOrders(env, squareCustomerId);
  return {
    routine: routineFromOrders(orders, products),
    history: purchaseHistoryFromOrders(orders, products),
    orderCount: orders.length,
  };
}
