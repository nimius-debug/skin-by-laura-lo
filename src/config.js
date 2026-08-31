// Site-wide constants and runtime-configurable settings.
// Anything a business owner might reasonably want to change lives here or in
// wrangler.toml [vars] — not buried in page markup.

export const BOOKING_URL =
  "https://book.squareup.com/appointments/rlfhvfyu6b6ltd/location/L8PR20K5XBXVQ";
export const EGIFT_URL = "https://app.squareup.com/gift/MLPQV9JRB2FHB/order";
export const INSTAGRAM_URL = "https://www.instagram.com/skinbylauralo/";
export const SUPPORT_EMAIL = "skinbylauralo@gmail.com";

export const STUDIO = {
  name: "Skin by Laura Lo",
  street: "307 South Boulevard",
  suite: "Suite D",
  city: "Tampa",
  state: "FL",
  zip: "33606",
  mapsUrl:
    "https://maps.google.com/?q=307+South+Boulevard+Suite+D+Tampa+FL+33606",
};

export const HOURS = [
  ["Monday", "10:00am – 5:00pm"],
  ["Tuesday – Thursday", "Closed"],
  ["Friday", "10:00am – 5:00pm"],
  ["Saturday", "10:00am – 5:00pm · twice monthly"],
  ["Sunday", "10:00am – 5:00pm · once monthly"],
];

// Google rating shown on the homepage. Update as reviews accumulate.
export const RATING = { score: "5.0", count: 29 };

// Gallery images. Add entries as real photography becomes available; the page
// renders an honest empty state until then rather than fake placeholders.
// Example: { src: "https://...", alt: "Before and after, acne treatment" }
export const GALLERY_IMAGES = [];

function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function bool(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

/** Resolve runtime settings from env vars, with safe defaults. */
export function settings(env = {}) {
  const shippingEnabled = bool(env.SHIPPING_ENABLED, true);
  const feeCents = num(env.SHIPPING_FEE_CENTS, 1000);
  const thresholdCents = num(env.FREE_SHIPPING_THRESHOLD_CENTS, 10000);

  return {
    siteUrl: env.SITE_URL || "https://test.skinbylauralo.com",
    shippingEnabled,
    shippingFeeCents: feeCents,
    freeShippingThresholdCents: thresholdCents,
    shippingLabel: env.SHIPPING_LABEL || "U.S. shipping",
    pickupEnabled: bool(env.PICKUP_ENABLED, true),
    pickupPrepHours: num(env.PICKUP_PREP_HOURS, 24),
    catalogTtlSeconds: num(env.CATALOG_TTL_SECONDS, 120),
    hideSoldOut: bool(env.HIDE_SOLD_OUT, false),
  };
}

/**
 * Shipping fee for a given subtotal. Single source of truth — the cart
 * preview and the real Payment Link both call this, so they cannot disagree.
 */
export function shippingFeeFor(subtotalCents, cfg) {
  if (!cfg.shippingEnabled) return 0;
  if (cfg.freeShippingThresholdCents > 0 && subtotalCents >= cfg.freeShippingThresholdCents) {
    return 0;
  }
  return cfg.shippingFeeCents;
}

export function formatMoney(cents) {
  return `$${(Math.round(cents) / 100).toFixed(2)}`;
}
