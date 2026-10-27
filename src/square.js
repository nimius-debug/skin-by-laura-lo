// Square API client — Catalog + Inventory reads, and Payment Link creation.
//
// Square is the single source of truth. The Worker only ever READS the catalog
// and asks Square to create a hosted checkout link. It never stores an order,
// and it never accepts a price from the browser.

import { salesRankFor, applySalesRank, topSellerSlugs } from "./sales-rank.js";

// How many top sellers get a "Best seller" badge, within each category.
const BEST_SELLER_BADGE_COUNT = 2;

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

async function parseSquareResponse(response) {
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

export async function squareFetch(env, path, body) {
  const response = await fetch(`${apiBase(env)}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    },
    body: JSON.stringify(body),
  });
  return parseSquareResponse(response);
}

/** For Square's GET-style list endpoints (bookings, customers), which take query params rather than a JSON body. */
export async function squareGet(env, path, params = {}) {
  const url = new URL(`${apiBase(env)}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      "Square-Version": SQUARE_VERSION,
    },
  });
  return parseSquareResponse(response);
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

/**
 * Every pricing rule, product set and discount in the catalog. These are the
 * three objects Square writes when a sale is set up under Items → Discounts:
 * the DISCOUNT holds the amount, the PRODUCT_SET says which items, categories
 * or variations it covers, and the PRICING_RULE ties them together with dates.
 */
async function fetchPricing(env) {
  const rules = [];
  const productSets = new Map();
  const discounts = new Map();
  let cursor;

  do {
    const page = await squareFetch(env, "/v2/catalog/search", {
      object_types: ["PRICING_RULE", "PRODUCT_SET", "DISCOUNT"],
      include_deleted_objects: false,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    for (const object of page.objects || []) {
      if (object.type === "PRICING_RULE") rules.push(object);
      else if (object.type === "PRODUCT_SET") productSets.set(object.id, object);
      else if (object.type === "DISCOUNT") discounts.set(object.id, object);
    }
    cursor = page.cursor;
  } while (cursor);

  return { rules, productSets, discounts };
}

function presentAt(object, locationId) {
  if (Array.isArray(object.absent_at_location_ids) && object.absent_at_location_ids.includes(locationId)) {
    return false;
  }
  if (object.present_at_all_locations !== false) return true;
  return Array.isArray(object.present_at_location_ids) && object.present_at_location_ids.includes(locationId);
}

/** "YYYY-MM-DD HH:MM:SS" wall-clock time at the studio, to compare against rule dates. */
function localStamp(now, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * The pricing rules that act as a storefront sale right now: a per-item
 * discount on a set of products, open to everyone, inside its date window.
 *
 * Deliberately left out, because a static product price can't represent them:
 * whole-purchase coupons and package credits (ATTACHED / WHOLE_PURCHASE),
 * member-only rules (customer groups), buy-X-get-Y and multi-buy rules,
 * minimum-spend rules, day-of-week schedules, and variable or PIN-locked
 * discounts. disabled_pricing_sources is ignored: it switches a rule off for
 * Square Online, which this site is not, and the dashboard sets it by default.
 */
function activeSales(pricing, { locationId, now, timeZone }) {
  const stamp = localStamp(now, timeZone);
  const sales = [];

  for (const rule of pricing.rules) {
    const data = rule.pricing_rule_data;
    if (!data?.discount_id || !data.match_products_id) continue;
    if (data.application_mode === "ATTACHED") continue;
    if (data.discount_target_scope === "WHOLE_PURCHASE") continue;
    if (data.apply_products_id || data.time_period_ids?.length) continue;
    if (data.customer_group_ids_any?.length || data.minimum_order_subtotal_money) continue;
    if (!presentAt(rule, locationId)) continue;

    if (data.valid_from_date) {
      const from = `${data.valid_from_date} ${data.valid_from_local_time || "00:00:00"}`;
      if (stamp < from) continue;
    }
    if (data.valid_until_date) {
      const until = `${data.valid_until_date} ${data.valid_until_local_time || "23:59:59"}`;
      if (stamp >= until) continue;
    }

    const discount = pricing.discounts.get(data.discount_id);
    const dd = discount?.discount_data;
    if (!dd || dd.pin_required || !presentAt(discount, locationId)) continue;

    let offer;
    if (dd.discount_type === "FIXED_PERCENTAGE") {
      const percentage = Number(dd.percentage);
      if (!(percentage > 0 && percentage < 100)) continue;
      const capCents = Number(dd.maximum_amount_money?.amount);
      offer = { kind: "percentage", percentage, capCents: capCents > 0 ? capCents : null };
    } else if (dd.discount_type === "FIXED_AMOUNT") {
      const amountCents = Number(dd.amount_money?.amount);
      if (!(amountCents > 0)) continue;
      offer = { kind: "amount", amountCents };
    } else {
      continue;
    }

    sales.push({
      discountId: discount.id,
      name: (dd.name || "Sale").trim(),
      ...offer,
      lastDay: lastDayOf(data),
      matchSetId: data.match_products_id,
      excludeSetId: data.exclude_products_id || null,
    });
  }

  return sales;
}

/**
 * The last calendar day a sale runs, in studio time, or null if open-ended.
 * The dashboard stores "ends Nov 2" as valid_until 2026-11-02 00:00:00, which
 * activeSales treats as over at that midnight, so the last full day is Nov 1.
 */
function lastDayOf(data) {
  if (!data.valid_until_date) return null;
  const time = data.valid_until_local_time || "23:59:59";
  if (time > "00:00:00") return data.valid_until_date;
  const day = new Date(`${data.valid_until_date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

/**
 * Does a product set cover this item? Square lets a set name items,
 * variations, categories, or other product sets.
 */
function setMatches(setId, ids, productSets, depth = 0) {
  const set = productSets.get(setId)?.product_set_data;
  if (!set || depth > 4) return false;
  // Multi-buy sets ("2 or more") don't price a single unit.
  if (Number(set.quantity_min) > 1 || Number(set.quantity_exact) > 1) return false;
  if (set.all_products) return true;

  const hit = (id) => ids.has(id) || (productSets.has(id) && setMatches(id, ids, productSets, depth + 1));
  if (Array.isArray(set.product_ids_any) && set.product_ids_any.some(hit)) return true;
  if (Array.isArray(set.product_ids_all) && set.product_ids_all.length && set.product_ids_all.every(hit)) {
    return true;
  }
  return false;
}

function discountCentsFor(sale, priceCents) {
  if (sale.kind === "percentage") {
    const off = Math.round((priceCents * sale.percentage) / 100);
    return Math.min(sale.capCents ?? off, off);
  }
  return Math.min(sale.amountCents, priceCents);
}

function saleLabel(sale) {
  if (sale.kind === "percentage") return `${Number(sale.percentage.toFixed(2))}% off`;
  return `$${(sale.amountCents / 100).toFixed(sale.amountCents % 100 ? 2 : 0)} off`;
}

/** The best sale for one variation, or null. */
function bestSale(sales, ids, priceCents, productSets) {
  let best = null;
  for (const sale of sales) {
    if (!setMatches(sale.matchSetId, ids, productSets)) continue;
    if (sale.excludeSetId && setMatches(sale.excludeSetId, ids, productSets)) continue;
    const offCents = discountCentsFor(sale, priceCents);
    if (offCents > 0 && (!best || offCents > best.offCents)) best = { sale, offCents };
  }
  if (!best) return null;
  const { sale, offCents } = best;
  return {
    discountId: sale.discountId,
    name: sale.name,
    label: saleLabel(sale),
    kind: sale.kind,
    lastDay: sale.lastDay,
    offCents,
  };
}

// Square has no product_type for these, so name is the only signal.
const NON_RETAIL_NAME = /^gift ?card\b|^flat shipping\b/i;

// Shown as a filter pill so an uncategorized product still has somewhere to
// live, but it isn't a real Square category — nothing to do with the
// product beyond "nobody's categorized it yet." Exported so code that scores
// products by shared category (src/related-products.js) can tell the
// difference and not treat two uncategorized products as alike.
export const UNCATEGORIZED_LABEL = "Skincare";

function categoryIdsFor(item) {
  const data = item.item_data || {};
  return [
    data.reporting_category?.id,
    ...(Array.isArray(data.categories) ? data.categories.map((entry) => entry.id) : []),
    data.category_id,
  ].filter(Boolean);
}

function categoryNameFor(item, categories) {
  for (const id of categoryIdsFor(item)) {
    const name = categories.get(id);
    if (name) return name;
  }
  return UNCATEGORIZED_LABEL;
}

/**
 * Turn raw Square objects into the shape the pages render.
 *
 * One product == one Square ITEM. We surface its first sellable variation as
 * the default purchase target, and keep the full variation list so a product
 * page can offer sizes.
 */
function normalize({ items, images, categories }, stock, cfg, { sales = [], productSets = new Map() } = {}) {
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

      const sale = sales.length
        ? bestSale(sales, new Set([item.id, variation.id, ...categoryIdsFor(item)]), amount, productSets)
        : null;
      const offCents = sale ? sale.offCents : 0;

      const tracked = Boolean(vd.track_inventory);
      const onHand = stock.get(variation.id);
      const inStock = tracked ? Number(onHand || 0) > 0 : true;

      variations.push({
        id: variation.id,
        name: vd.name || "",
        // What the customer pays. regularPriceCents is the struck-out price.
        priceCents: amount - offCents,
        regularPriceCents: amount,
        sale,
        currency: vd.price_money?.currency || "USD",
        tracked,
        inStock,
      });
    }

    if (!variations.length) continue;

    const available = variations.some((variation) => variation.inStock);
    if (cfg.hideSoldOut && !available) continue;

    const category = categoryNameFor(item, categories);
    if (cfg.hideUncategorized && category === UNCATEGORIZED_LABEL) continue;

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

    const descriptionMarkup = data.description_html || data.description || "";
    const description =
      data.description_plaintext ||
      (descriptionMarkup ? String(descriptionMarkup).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");

    const defaultVariation = variations.find((variation) => variation.inStock) || variations[0];

    products.push({
      id: item.id,
      slug,
      name: data.name || "Untitled",
      category,
      description,
      // Keep Square's rich description so the product page can recover its
      // paragraphs, lists and authored section labels. It is parsed into a
      // controlled model before rendering and is never injected as raw HTML.
      descriptionHtml: descriptionMarkup,
      images: productImages,
      image: productImages[0] || null,
      variations,
      defaultVariation,
      priceCents: defaultVariation.priceCents,
      regularPriceCents: defaultVariation.regularPriceCents,
      sale: defaultVariation.sale,
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

  // Same for sales: if pricing rules can't be read, show and charge full price
  // rather than fail. Checkout uses this same catalog, so they stay in step.
  let sales = { sales: [], productSets: new Map() };
  try {
    const pricing = await fetchPricing(env);
    sales = {
      sales: activeSales(pricing, {
        locationId: env.SQUARE_LOCATION_ID,
        now: new Date(),
        timeZone: cfg.timeZone,
      }),
      productSets: pricing.productSets,
    };
  } catch (error) {
    console.error("Square pricing rule lookup failed, showing regular prices:", error.message);
  }

  let products = normalize(raw, stock, cfg, sales);

  // Best-sellers first, within the existing alphabetical order; a nicety
  // like stock, so a failure here still leaves a fully working shop.
  const salesRank = await salesRankFor(env, cfg.salesRankTtlSeconds, { force });
  products = applySalesRank(products, salesRank);

  const bestSellerSlugs = topSellerSlugs(products, salesRank, BEST_SELLER_BADGE_COUNT);
  for (const product of products) product.bestSeller = bestSellerSlugs.has(product.slug);

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
 *
 * Sales are attached explicitly rather than left to auto_apply_discounts:
 * Square only auto-applies rules marked "apply automatically" and enabled for
 * online, and a dashboard sale is usually neither. The sale on each line comes
 * from the server's catalog, never the browser. Percentage sales reference the
 * catalog DISCOUNT so Square computes the amount and reports it by name; a
 * fixed-amount sale is per unit, but Square applies a LINE_ITEM fixed amount
 * once per line, so it is sent as that amount times the quantity.
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

  const discounts = new Map();
  const orderLines = lineItems.map((item, index) => {
    const line = {
      catalog_object_id: item.variationId,
      quantity: String(item.quantity),
    };
    const sale = item.sale;
    if (!sale) return line;

    let uid;
    if (sale.kind === "percentage") {
      uid = `sale-${sale.discountId}`;
      if (!discounts.has(uid)) {
        discounts.set(uid, { uid, catalog_object_id: sale.discountId, scope: "LINE_ITEM" });
      }
    } else {
      uid = `sale-${index}`;
      discounts.set(uid, {
        uid,
        name: sale.name,
        amount_money: { amount: sale.offCents * item.quantity, currency: "USD" },
        scope: "LINE_ITEM",
      });
    }
    line.uid = `line-${index}`;
    line.applied_discounts = [{ discount_uid: uid }];
    return line;
  });

  const order = {
    location_id: env.SQUARE_LOCATION_ID,
    line_items: orderLines,
    ...(discounts.size ? { discounts: [...discounts.values()] } : {}),
    pricing_options: { auto_apply_discounts: false, auto_apply_taxes: true },
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
