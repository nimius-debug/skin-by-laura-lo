// A Square catalog holding a handful of real shop products whose formulas are
// on file, so the ingredient checker can be rendered without a live Square
// account: two moisturizers and a serum free of pore-cloggers, a lotion with a
// pore-clogger (algae extract), and a toner.
const item = (id, name, price) => ({
  id, type: "ITEM", present_at_all_locations: true, item_data: {
    name, ecom_visibility: "VISIBLE", image_ids: [`IMG_${id}`],
    categories: [{ id: "CAT_CARE" }], reporting_category: { id: "CAT_CARE" },
    variations: [{ id: `V_${id}`, item_variation_data: { pricing_type: "FIXED_PRICING",
      price_money: { amount: price, currency: "USD" }, track_inventory: false } }],
  },
});
const image = (id) => ({ id: `IMG_${id}`, type: "IMAGE", image_data: { url: `https://items-images-production.s3.us-west-2.amazonaws.com/files/${id.toLowerCase()}.jpg` } });

const ITEMS = [
  item("SOBA", "Soba Calm Cream", 4200),
  item("RECHARGE", "Moisture RX Recharge", 5600),
  item("BIFIDA", "Corthe Bifida Ampoule", 6800),
  item("RICHM", "Corthe Rich M Lotion", 5200),
  item("TONER", "Corthe Dermo Pure First Aid Toner", 3800),
];

export const CHECKER_CATALOG = {
  objects: ITEMS,
  related_objects: [
    { id: "CAT_CARE", type: "CATEGORY", category_data: { name: "Face care" } },
    ...ITEMS.map((entry) => image(entry.id)),
  ],
};

/** Replaces Square's HTTP with the catalog above. */
export function squareFetch(realFetch) {
  return async (url, options) => {
    const u = new URL(url);
    if (!u.hostname.includes("squareup")) return realFetch(url, options);
    const body = options?.body ? JSON.parse(options.body) : {};
    const json = (data) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
    if (u.pathname === "/v2/catalog/search") return json(body.object_types?.includes("PRICING_RULE") ? { objects: [] } : CHECKER_CATALOG);
    if (u.pathname === "/v2/inventory/counts/batch-retrieve") return json({ counts: [] });
    if (u.pathname === "/v2/orders/search") return json({ orders: [] });
    return json({});
  };
}

export const SQUARE_ENV = {
  SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC1", SQUARE_ENVIRONMENT: "sandbox", CATALOG_TTL_SECONDS: "0",
};
