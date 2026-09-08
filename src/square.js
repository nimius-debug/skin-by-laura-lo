// Square API client — Catalog + Inventory reads, and Payment Link creation.
//
// Square is the single source of truth. The Worker only ever READS the catalog
// and asks Square to create a hosted checkout link. It never stores an order,
// and it never accepts a price from the browser.

const SQUARE_VERSION = "2026-08-19";

function apiBase(env) {
  return String(env.SQUARE_ENVIRONMENT || "").toLowerCase() === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

/** True when the Square connection has been activated with real credentials. */
export function isConfigured(env) {
  return Boolean(env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID);
}

async function squareFetch(env, path, body) {
  const response = await fetch(`${apiBase(env)}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (payload.errors || [])
      .map((error) => error.detail || error.code)
      .join("; ");
    const error = new Error(detail || `Square request failed (${response.status})`);
    error.status = response.status;
    error.squareErrors = payload.errors || [];
    throw error;
  }
  return payload;
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "item";
}

/**
 * Walk every ITEM in the catalog. include_related_objects gives us the IMAGE
 * and CATEGORY records the items point at, so this is one paginated pass
 * rather than N follow-up lookups.
 */
async function fetchAllItems(env) {
  const items = [];
  const images = new Map();
  const categories = new Map();
  let cursor;

  do {
    const page = await squareFetch(env, "/v2/catalog/search", {
      object_types: ["ITEM"],
      include_related_objects: true,
      include_deleted_objects: false,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });

    for (const object of page.objects || []) items.push(object);
    for (const related of page.related_objects || []) {
      if (related.type === "IMAGE" && related.image_data?.url) {
        images.set(related.id, related.image_data.url);
      } else if (related.type === "CATEGORY" && related.category_data?.name) {
        categories.set(related.id, related.category_data.name);
      }
    }
    cursor = page.cursor;
  } while (cursor);

  return { items, images, categories };
}

/** Stock levels for the variations that Square is actually tracking. */
async function fetchInventory(env, variationIds) {
  if (!variationIds.length) return new Map();
  const counts = new Map();

  // BatchRetrieveInventoryCounts caps the id list, so chunk it.
  for (let index = 0; index < variationIds.length; index += 250) {
    const chunk = variationIds.slice(index, index + 250);
    let cursor;
    do {
      const page = await squareFetch(env, "/v2/inventory/counts/batch-retrieve", {
        catalog_object_ids: chunk,
        location_ids: [env.SQUARE_LOCATION_ID],
        states: ["IN_STOCK"],
        ...(cursor ? { cursor } : {}),
      });
      for (const count of page.counts || []) {
        if (count.state !== "IN_STOCK") continue;
        const quantity = Number(count.quantity || 0);
        counts.set(
          count.catalog_object_id,
          (counts.get(count.catalog_object_id) || 0) + (Number.isFinite(quantity) ? quantity : 0),
        );
      }
      cursor = page.cursor;
    } while (cursor);
  }

  return counts;
}

// Square has no product_type for these, so name is the only signal.
const NON_RETAIL_NAME = /^gift ?card\b|^flat shipping\b/i;

function categoryNameFor(item, categories) {
  const data = item.item_data || {};
  const ids = [
    data.reporting_category?.id,
    ...(Array.isArray(data.categories) ? data.categories.map((entry) => entry.id) : []),
    data.category_id,
  ].filter(Boolean);

  for (const id of ids) {
    const name = categories.get(id);
    if (name) return name;
  }
  return "Skincare";
}

/**
 * Turn raw Square objects into the shape the pages render.
 *
 * One product == one Square ITEM. We surface its first sellable variation as
 * the default purchase target, and keep the full variation list so a product
 * page can offer sizes.
 */
function normalize({ items, images, categories }, stock, cfg) {
  const seenSlugs = new Set();
  const products = [];

  for (const item of items) {
    const data = item.item_data;
    if (!data || data.is_archived) continue;
    // available_online is unset across this catalog, so it can't gate anything —
    // filter on what Square actually sets instead: only plain retail items that
    // are visible on the online store (this drops appointment services, draft
    // treatment bundles, and the legacy membership listings), plus a name-based
    // exclusion for gift cards and shipping charges, which Square models as
    // ordinary REGULAR/VISIBLE items with no distinguishing type of their own.
    if ((data.product_type || "REGULAR") !== "REGULAR") continue;
    if (data.ecom_visibility !== "VISIBLE") continue;
    if (NON_RETAIL_NAME.test(data.name || "")) continue;

    const variations = [];
    for (const variation of data.variations || []) {
      const vd = variation.item_variation_data;
      if (!vd) continue;
      // Variable-priced items can't be sold from a static storefront.
      if (vd.pricing_type && vd.pricing_type !== "FIXED_PRICING") continue;
      const amount = Number(vd.price_money?.amount);
      if (!Number.isFinite(amount)) continue;

      const tracked = Boolean(vd.track_inventory);
      const onHand = stock.get(variation.id);
      const inStock = tracked ? Number(onHand || 0) > 0 : true;

      variations.push({
        id: variation.id,
        name: vd.name || "",
        priceCents: amount,
        currency: vd.price_money?.currency || "USD",
        tracked,
        inStock,
      });
    }

    if (!variations.length) continue;

    const available = variations.some((variation) => variation.inStock);
    if (cfg.hideSoldOut && !available) continue;

    const imageIds = [
      ...(Array.isArray(data.image_ids) ? data.image_ids : []),
      ...(data.image_id ? [data.image_id] : []),
    ];
    const productImages = imageIds
      .map((id) => images.get(id))
      .filter(Boolean);

    let slug = slugify(data.name);
    if (seenSlugs.has(slug)) slug = `${slug}-${slugify(item.id).slice(0, 6)}`;
    seenSlugs.add(slug);

    const description =
      data.description_plaintext ||
      (data.description ? String(data.description).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");

    products.push({
      id: item.id,
      slug,
      name: data.name || "Untitled",
      category: categoryNameFor(item, categories),
      description,
      images: productImages,
      image: productImages[0] || null,
      variations,
      defaultVariation: variations.find((variation) => variation.inStock) || variations[0],
      priceCents: (variations.find((variation) => variation.inStock) || variations[0]).priceCents,
      available,
    });
  }

  products.sort((a, b) => a.name.localeCompare(b.name));
  return products;
}

// Per-isolate memo so a burst of requests on one edge node makes one Square call.
let memo = { expires: 0, products: null };

/** The full catalog, cached for cfg.catalogTtlSeconds. */
export async function getCatalog(env, cfg, { force = false } = {}) {
  const now = Date.now();
  if (!force && memo.products && now < memo.expires) return memo.products;

  const raw = await fetchAllItems(env);

  const trackedIds = [];
  for (const item of raw.items) {
    for (const variation of item.item_data?.variations || []) {
      if (variation.item_variation_data?.track_inventory) trackedIds.push(variation.id);
    }
  }

  // Stock is a nicety; never let it take the whole shop down.
  let stock = new Map();
  try {
    stock = await fetchInventory(env, trackedIds);
  } catch (error) {
    console.error("Square inventory lookup failed, treating tracked items as in stock:", error.message);
    stock = new Map(trackedIds.map((id) => [id, 1]));
  }

  const products = normalize(raw, stock, cfg);
  if (cfg.catalogTtlSeconds > 0) {
    memo = { expires: now + cfg.catalogTtlSeconds * 1000, products };
  }
  return products;
}

/** Index every purchasable variation by id, for cart and checkout lookups. */
export function indexVariations(products) {
  const index = new Map();
  for (const product of products) {
    for (const variation of product.variations) {
      index.set(variation.id, { product, variation });
    }
  }
  return index;
}

/**
 * Create a Square-hosted checkout link.
 *
 * Line items carry only catalog_object_id + quantity — no prices. Square
 * prices the order from its own catalog, so a tampered localStorage cart
 * cannot change what a customer is charged.
 */
export async function createPaymentLink(env, {
  lineItems,
  fulfillment,
  shippingFeeCents,
  shippingLabel,
  redirectUrl,
  supportEmail,
  pickupPrepHours,
  pickupNote,
}) {
  const checkoutOptions = {
    redirect_url: redirectUrl,
    ask_for_shipping_address: fulfillment === "shipping",
    merchant_support_email: supportEmail,
    enable_coupon: true,
  };

  if (fulfillment === "shipping" && shippingFeeCents > 0) {
    checkoutOptions.shipping_fee = {
      name: shippingLabel,
      charge: { amount: shippingFeeCents, currency: "USD" },
    };
  }

  const order = {
    location_id: env.SQUARE_LOCATION_ID,
    line_items: lineItems.map((item) => ({
      catalog_object_id: item.variationId,
      quantity: String(item.quantity),
    })),
    pricing_options: { auto_apply_discounts: true, auto_apply_taxes: true },
  };

  if (fulfillment === "pickup") {
    order.fulfillments = [{
      type: "PICKUP",
      state: "PROPOSED",
      pickup_details: {
        schedule_type: "ASAP",
        prep_time_duration: `PT${pickupPrepHours}H`,
        pickup_at: new Date(Date.now() + pickupPrepHours * 3600 * 1000).toISOString(),
        recipient: { display_name: "Online pickup customer" },
        note: pickupNote,
      },
    }];
  }

  const payload = await squareFetch(env, "/v2/online-checkout/payment-links", {
    idempotency_key: crypto.randomUUID(),
    order,
    checkout_options: checkoutOptions,
    payment_note: `Skin by Laura Lo online order — ${fulfillment}`,
  });

  const url = payload.payment_link?.url;
  if (!url) throw new Error("Square did not return a checkout URL");
  return url;
}
