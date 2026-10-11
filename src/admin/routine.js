// A client's "current routine" is never stored — it's read live from their
// most recent completed Square order, so it can never drift out of sync
// with what they actually bought. Square tells us which products and when,
// not which skincare step each one belongs to (cleanse/treat/moisturize/
// SPF), so this shows a flat product list rather than inventing roles we
// have no real data for.

import { squareFetch, isConfigured } from "../square.js";

export async function currentRoutineFor(env, products, squareCustomerId) {
  if (!squareCustomerId || !isConfigured(env)) return null;

  const payload = await squareFetch(env, "/v2/orders/search", {
    location_ids: [env.SQUARE_LOCATION_ID],
    query: {
      filter: {
        customer_filter: { customer_ids: [squareCustomerId] },
        state_filter: { states: ["COMPLETED"] },
      },
      sort: { sort_field: "CREATED_AT", sort_order: "DESC" },
    },
    limit: 1,
  });

  const order = (payload.orders || [])[0];
  if (!order) return null;

  const bySlugId = new Map();
  for (const product of products) {
    for (const variation of product.variations) bySlugId.set(variation.id, product);
  }

  const items = (order.line_items || [])
    .map((line) => {
      const product = bySlugId.get(line.catalog_object_id);
      return product ? { name: product.name, slug: product.slug } : null;
    })
    .filter(Boolean);

  return {
    items,
    orderedAt: order.created_at,
    squareOrderUrl: `https://squareup.com/dashboard/orders/overview/${order.id}`,
  };
}
