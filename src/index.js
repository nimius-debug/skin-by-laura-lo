import { settings, shippingFeeFor, BOOKING_URL, SUPPORT_EMAIL, STUDIO } from "./config.js";
import { getCatalog, indexVariations, isConfigured, createPaymentLink } from "./square.js";
import { bundleDiscountCents } from "./routines.js";
import { page, htmlResponse, jsonResponse } from "./layout.js";
import { STYLES } from "./styles.js";
import { CLIENT_JS } from "./client/cart.js";
import { homePage } from "./pages/home.js";
import { shopPage } from "./pages/shop.js";
import { productPage } from "./pages/product.js";
import { cartPage, thankYouPage } from "./pages/cart.js";
import {
  aboutPage, treatmentsPage, galleryPage, legalPage, notFoundPage,
} from "./pages/content.js";

const MAX_QTY = 10;
const MAX_LINES = 50;

// Old WordPress paths that should not 404 after cutover.
const LEGACY_REDIRECTS = new Map([
  ["/shop", "/shop"],
  ["/products", "/shop"],
  ["/my-account", "/shop"],
  ["/gallery", "/gallery"],
  ["/terms-conditions", "/terms"],
  ["/privacy-policy", "/privacy"],
  ["/checkout/success", "/thank-you"],
]);

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" fill="#20231f"/>
<text x="32" y="44" font-family="Georgia,serif" font-size="34" fill="#fbf8f3" text-anchor="middle">L</text>
</svg>`;

function asset(body, contentType) {
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600, s-maxage=86400",
      "x-content-type-options": "nosniff",
    },
  });
}

function redirect(location, status = 301) {
  return new Response(null, { status, headers: { location } });
}

/** Catalog read that degrades to an empty shop rather than an error page. */
async function loadCatalog(env, cfg) {
  if (!isConfigured(env)) return { products: [], connected: false };
  try {
    return { products: await getCatalog(env, cfg), connected: true };
  } catch (error) {
    console.error("Square catalog read failed:", error.message);
    return { products: [], connected: true, failed: true };
  }
}

async function handleCatalogApi(env, cfg) {
  const { products } = await loadCatalog(env, cfg);
  const variations = {};

  for (const product of products) {
    for (const variation of product.variations) {
      variations[variation.id] = {
        name: product.name,
        variationName: product.variations.length > 1 ? variation.name : "",
        category: product.category,
        slug: product.slug,
        image: product.image,
        priceCents: variation.priceCents,
        inStock: variation.inStock,
      };
    }
  }

  return jsonResponse({ variations });
}

async function handleCheckout(request, env, cfg, url) {
  if (!isConfigured(env)) {
    return jsonResponse({
      message: "The new Square store is ready, but the Square connection has not been activated yet.",
    }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ message: "We couldn't read your bag. Please refresh and try again." }, 400);
  }

  const requested = Array.isArray(payload?.items) ? payload.items : [];
  const fulfillment = payload?.fulfillment === "pickup" ? "pickup" : "shipping";

  if (!requested.length || requested.length > MAX_LINES) {
    return jsonResponse({ message: "Your bag is empty or too large to check out." }, 400);
  }
  if (fulfillment === "pickup" && !cfg.pickupEnabled) {
    return jsonResponse({ message: "Local pickup isn't available right now." }, 400);
  }
  if (fulfillment === "shipping" && !cfg.shippingEnabled) {
    return jsonResponse({ message: "Shipping isn't available right now. Please choose local pickup." }, 400);
  }

  const { products } = await loadCatalog(env, cfg);
  const index = indexVariations(products);

  const lineItems = [];
  let subtotalCents = 0;

  for (const entry of requested) {
    const id = typeof entry?.id === "string" ? entry.id : null;
    // Number() rather than parseInt(): parseInt("2; DROP") would yield 2.
    const quantity = Number(entry?.qty);
    if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
      return jsonResponse({ message: "One of the items in your bag isn't valid. Please refresh and try again." }, 400);
    }

    const match = index.get(id);
    if (!match) {
      return jsonResponse({ message: "One of the products in your bag is no longer available." }, 400);
    }
    if (!match.variation.inStock) {
      return jsonResponse({ message: `${match.product.name} just sold out. Please remove it to continue.` }, 409);
    }

    lineItems.push({ variationId: id, quantity });
    // Priced from the catalog, never from the browser.
    subtotalCents += match.variation.priceCents * quantity;
  }

  const shippingFeeCents = fulfillment === "shipping" ? shippingFeeFor(subtotalCents, cfg) : 0;

  // Bundle discount: computed only from the cart's variation ids against
  // the live catalog and our own routine config — never from anything the
  // client sends. Clamped so it can never make the order total negative.
  const cartIds = lineItems.map((item) => item.variationId);
  const discountCents = Math.min(bundleDiscountCents(cartIds, products), subtotalCents);

  try {
    const checkoutUrl = await createPaymentLink(env, {
      lineItems,
      fulfillment,
      shippingFeeCents,
      discountCents,
      shippingLabel: cfg.shippingLabel,
      redirectUrl: `${url.origin}/thank-you`,
      supportEmail: SUPPORT_EMAIL,
      pickupPrepHours: cfg.pickupPrepHours,
      pickupNote: `Pickup at ${STUDIO.name}, ${STUDIO.street}, ${STUDIO.suite}, ${STUDIO.city}.`,
    });
    return jsonResponse({ url: checkoutUrl });
  } catch (error) {
    console.error("Square checkout error:", error.message);
    return jsonResponse({
      message: "Square checkout is temporarily unavailable. Please try again, or contact Laura.",
    }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cfg = settings(env);
    let path = url.pathname;

    // Normalise trailing slashes so old WordPress links resolve.
    if (path.length > 1 && path.endsWith("/")) {
      const stripped = path.replace(/\/+$/, "") || "/";
      return redirect(stripped + url.search);
    }

    // ------------------------------------------------------------- assets
    if (path === "/assets/styles.css") return asset(STYLES, "text/css; charset=utf-8");
    if (path === "/assets/cart.js") return asset(CLIENT_JS, "text/javascript; charset=utf-8");
    if (path === "/favicon.svg") return asset(FAVICON, "image/svg+xml");
    if (path === "/robots.txt") {
      return asset(`User-agent: *\nAllow: /\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`, "text/plain; charset=utf-8");
    }

    // ---------------------------------------------------------------- api
    if (path === "/api/catalog" && request.method === "GET") {
      return handleCatalogApi(env, cfg);
    }
    if (path === "/api/checkout") {
      if (request.method !== "POST") return jsonResponse({ message: "Method not allowed" }, 405);
      return handleCheckout(request, env, cfg, url);
    }

    // ------------------------------------------------------------ legacy
    if (path === "/booking" || path.startsWith("/booking/")) return redirect(BOOKING_URL, 302);
    if (path.startsWith("/product-category/")) return redirect("/shop");
    const legacy = LEGACY_REDIRECTS.get(path);
    if (legacy && legacy !== path) return redirect(legacy);

    // ------------------------------------------------------------- pages
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    const canonical = `${cfg.siteUrl}${path === "/" ? "" : path}`;

    if (path === "/") {
      const { products } = await loadCatalog(env, cfg);
      return htmlResponse(page({
        body: homePage({ products, cfg }), cfg, current: "/", canonical,
        description: "Korean-infused facials, acne guidance and curated home care from a licensed esthetician in Tampa, Florida.",
      }), { cacheSeconds: 60 });
    }

    if (path === "/shop") {
      const { products, connected } = await loadCatalog(env, cfg);
      return htmlResponse(page({
        title: "Shop", body: shopPage({ products, connected }), cfg, current: "/shop", canonical,
        description: "Barrier-first skincare hand-picked by Laura Lo, shipped nationwide or collected in Tampa.",
      }), { cacheSeconds: 60 });
    }

    if (path.startsWith("/product/")) {
      const slug = decodeURIComponent(path.slice("/product/".length));
      const { products } = await loadCatalog(env, cfg);
      const product = products.find((entry) => entry.slug === slug);

      if (!product) {
        return htmlResponse(page({
          title: "Not found", body: notFoundPage(), cfg,
        }), { status: 404 });
      }

      const related = products
        .filter((entry) => entry.category === product.category && entry.slug !== product.slug)
        .slice(0, 3);

      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        category: product.category,
        ...(product.image ? { image: product.image } : {}),
        ...(product.description ? { description: product.description } : {}),
        offers: {
          "@type": "Offer",
          price: (product.priceCents / 100).toFixed(2),
          priceCurrency: "USD",
          availability: product.available
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: canonical,
        },
      };

      return htmlResponse(page({
        title: product.name,
        description: product.description ? product.description.slice(0, 155) : `${product.name} — ${product.category} from Skin by Laura Lo.`,
        body: productPage({ product, related, cfg }),
        cfg, current: "/shop", canonical,
        head: `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`,
      }), { cacheSeconds: 60 });
    }

    if (path === "/cart") {
      return htmlResponse(page({
        title: "Your bag", body: cartPage({ cfg }), cfg, current: "/cart", canonical,
        description: "Review your bag and check out securely with Square.",
      }));
    }

    if (path === "/thank-you") {
      return htmlResponse(page({
        title: "Thank you", body: thankYouPage(), cfg, canonical,
        description: "Your order is confirmed.",
      }));
    }

    if (path === "/about") {
      return htmlResponse(page({
        title: "About", body: aboutPage(), cfg, current: "/about", canonical,
        description: "Laura Lo is a licensed esthetician in Tampa working with Korean-infused, barrier-first treatment methods.",
      }), { cacheSeconds: 300 });
    }

    if (path === "/treatments") {
      return htmlResponse(page({
        title: "Treatments", body: treatmentsPage(), cfg, current: "/treatments", canonical,
        description: "Korean-infused facials, acne guidance, brows and lashes, and virtual consults in Tampa, Florida.",
      }), { cacheSeconds: 300 });
    }

    if (path === "/gallery") {
      return htmlResponse(page({
        title: "Gallery", body: galleryPage(), cfg, current: "/gallery", canonical,
        description: "Before and after results from treatments at Skin by Laura Lo.",
      }), { cacheSeconds: 300 });
    }

    if (path === "/terms" || path === "/privacy") {
      const kind = path.slice(1);
      return htmlResponse(page({
        title: kind === "terms" ? "Terms & Conditions" : "Privacy Policy",
        body: legalPage({ kind, cfg }), cfg, canonical,
      }), { cacheSeconds: 300 });
    }

    if (path === "/sitemap.xml") {
      const { products } = await loadCatalog(env, cfg);
      const paths = ["/", "/about", "/treatments", "/shop", "/gallery", "/terms", "/privacy"]
        .concat(products.map((product) => `/product/${product.slug}`));
      const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((entry) => `  <url><loc>${cfg.siteUrl}${entry === "/" ? "" : entry}</loc></url>`).join("\n")}
</urlset>`;
      return asset(body, "application/xml; charset=utf-8");
    }

    return htmlResponse(page({ title: "Not found", body: notFoundPage(), cfg }), { status: 404 });
  },
};
