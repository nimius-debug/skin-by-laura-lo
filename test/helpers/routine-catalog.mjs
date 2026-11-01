// A tiny Square catalog holding the products of the "Men All In One Bundle"
// routine, so routine pages can be rendered without a live Square account.
const item = (id, name, price, img) => ({
  id, type: "ITEM", present_at_all_locations: true, item_data: {
    name, ecom_visibility: "VISIBLE", image_ids: [img],
    categories: [{ id: "CAT_CARE" }], reporting_category: { id: "CAT_CARE" },
    variations: [{ id: `V_${id}`, item_variation_data: { pricing_type: "FIXED_PRICING",
      price_money: { amount: price, currency: "USD" }, track_inventory: false } }],
  },
});
const image = (id, url) => ({ id, type: "IMAGE", image_data: { url } });

export const ROUTINE_CATALOG = {
  objects: [
    item("CLEANSER", "Dermathod Moist Morning Touch Foam Cleanser", 3200, "IMG1"),
    item("HOMME", "Desembre Homme Spirulina All In One Solution", 5800, "IMG2"),
    item("SPF", "Desembre EGF Waterdrop", 4800, "IMG3"),
  ],
  related_objects: [
    { id: "CAT_CARE", type: "CATEGORY", category_data: { name: "Cleansers" } },
    image("IMG1", "https://items-images-production.s3.us-west-2.amazonaws.com/files/cleanser.jpg"),
    image("IMG2", "https://items-images-production.s3.us-west-2.amazonaws.com/files/homme.jpg"),
    image("IMG3", "https://items-images-production.s3.us-west-2.amazonaws.com/files/spf.jpg"),
  ],
};

/** Replaces Square's HTTP with the catalog above. */
export function squareFetch(realFetch) {
  return async (url, options) => {
    const u = new URL(url);
    if (!u.hostname.includes("squareup")) return realFetch(url, options);
    const body = options?.body ? JSON.parse(options.body) : {};
    const json = (data) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
    if (u.pathname === "/v2/catalog/search") return json(body.object_types?.includes("PRICING_RULE") ? { objects: [] } : ROUTINE_CATALOG);
    if (u.pathname === "/v2/inventory/counts/batch-retrieve") return json({ counts: [] });
    if (u.pathname === "/v2/orders/search") return json({ orders: [] });
    return json({});
  };
}

export const SQUARE_ENV = {
  SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC1", SQUARE_ENVIRONMENT: "sandbox", CATALOG_TTL_SECONDS: "0",
};
