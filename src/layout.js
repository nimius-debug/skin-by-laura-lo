import { html, toString, raw } from "./html.js";
import {
  BOOKING_URL, EGIFT_URL, INSTAGRAM_URL, SUPPORT_EMAIL, STUDIO,
} from "./config.js";

function announcement(cfg) {
  if (!cfg.shippingEnabled) {
    return cfg.pickupEnabled ? html`<span>Local pickup available in Tampa</span>` : "";
  }
  const free = cfg.freeShippingThresholdCents;
  const primary = free > 0
    ? `Free U.S. shipping on orders $${(free / 100).toFixed(0)}+`
    : "Flat-rate U.S. shipping";
  return html`
    <span>${primary}</span>
    ${cfg.pickupEnabled ? html`<span class="announcement-detail">· Local pickup available in Tampa</span>` : ""}
  `;
}

function header(cfg, current) {
  const mark = (path) => (current === path ? raw(' aria-current="page"') : "");
  return html`
    <div class="announcement">${announcement(cfg)}</div>
    <header class="site-header">
      <a class="brand" href="/" aria-label="Skin by Laura Lo home">
        <span>SKIN BY</span>
        <strong>Laura Lo</strong>
      </a>
      <button class="menu-button" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Toggle menu">
        <span></span><span></span>
      </button>
      <nav id="primary-nav" aria-label="Primary">
        <a href="/about"${mark("/about")}>About</a>
        <a href="/treatments"${mark("/treatments")}>Treatments</a>
        <a href="/shop"${mark("/shop")}>Shop</a>
        <a href="/gallery"${mark("/gallery")}>Gallery</a>
        <a href="${EGIFT_URL}">eGift</a>
        <a class="nav-book" href="${BOOKING_URL}">Book now <span aria-hidden="true">&#8599;</span></a>
        <a class="cart-link" href="/cart">Bag <span data-cart-count>0</span></a>
      </nav>
    </header>
  `;
}

function footer() {
  return html`
    <footer class="site-footer">
      <div class="footer-main section-shell">
        <div class="footer-brand">
          <p class="eyebrow">Skin by Laura Lo</p>
          <h2>Let&#8217;s make your skin feel like <em>home.</em></h2>
          <a class="button button-light" href="${BOOKING_URL}">Book your appointment <span aria-hidden="true">&#8599;</span></a>
        </div>
        <div class="footer-links">
          <div>
            <p>Explore</p>
            <a href="/about">About</a>
            <a href="/treatments">Treatments</a>
            <a href="/shop">Shop</a>
            <a href="/gallery">Gallery</a>
            <a href="${EGIFT_URL}">eGift cards</a>
          </div>
          <div>
            <p>Visit</p>
            <a href="${STUDIO.mapsUrl}">${STUDIO.street}<br />${STUDIO.suite}<br />${STUDIO.city}, ${STUDIO.state} ${STUDIO.zip}</a>
          </div>
          <div>
            <p>Connect</p>
            <a href="${INSTAGRAM_URL}">Instagram</a>
            <a href="mailto:${SUPPORT_EMAIL}">Email Laura</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom section-shell">
        <span>&copy; ${new Date().getFullYear()} Skin by Laura Lo</span>
        <div><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div>
      </div>
    </footer>
  `;
}

/**
 * Wrap page content in the full document shell.
 * `head` accepts pre-escaped markup for page-specific meta/JSON-LD.
 */
export function page({ title, description, body, cfg, current = "", head = "", canonical = "" }) {
  const fullTitle = title
    ? `${title} · Skin by Laura Lo`
    : "Skin by Laura Lo · Tampa esthetician & Korean-infused facials";

  return toString(html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${fullTitle}</title>
<meta name="description" content="${description || "Korean-infused facials, acne guidance and curated home care from a licensed esthetician in Tampa, Florida."}" />
${canonical ? html`<link rel="canonical" href="${canonical}" />` : ""}
<meta property="og:title" content="${fullTitle}" />
<meta property="og:description" content="${description || "Korean-infused facials and curated home care in Tampa, Florida."}" />
<meta property="og:type" content="website" />
<meta name="theme-color" content="#20231f" />
<link rel="stylesheet" href="/assets/styles.css" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
${typeof head === "string" ? raw(head) : head}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${header(cfg, current)}
<main id="main">${body}</main>
${footer()}
<script src="/assets/cart.js" defer></script>
</body>
</html>`);
}

export function htmlResponse(markup, { status = 200, cacheSeconds = 0 } = {}) {
  return new Response(markup, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cacheSeconds > 0
        ? `public, max-age=0, s-maxage=${cacheSeconds}`
        : "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
