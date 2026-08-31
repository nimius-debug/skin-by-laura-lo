import { html, jsonScript } from "../html.js";
import { productCard } from "./components.js";
import { formatMoney, BOOKING_URL, SUPPORT_EMAIL } from "../config.js";

export function productPage({ product, related, cfg }) {
  const soldOut = !product.available;
  const hasChoices = product.variations.length > 1;
  const freeAt = cfg.freeShippingThresholdCents;

  const variationData = Object.fromEntries(
    product.variations.map((variation) => [variation.id, {
      price: formatMoney(variation.priceCents),
      inStock: variation.inStock,
    }]),
  );

  return html`
    <div class="product-page section-shell">
      <div class="product-gallery">
        ${product.image
          ? html`<img src="${product.image}" alt="${product.name}" width="620" height="680" />`
          : html`<div class="product-image-fallback">${product.name}</div>`}
      </div>

      <div class="product-details">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <a href="/shop">Shop</a>
          <span aria-hidden="true">/</span>
          <span>${product.category}</span>
        </nav>

        <p class="eyebrow">${product.category}</p>
        <h1>${product.name}</h1>
        <p class="product-detail-price" data-price-display>${formatMoney(product.priceCents)}</p>

        ${product.description
          ? html`<p class="product-description">${product.description}</p>`
          : html`<p class="product-description">Ask Laura about this product at your next appointment &#8212; full details coming soon.</p>`}

        ${hasChoices ? html`
          <fieldset class="variation-picker">
            <legend>Option</legend>
            <div>
              ${product.variations.map((variation, index) => html`
                <button type="button"
                        class="${index === 0 ? "active" : ""}"
                        data-variation="${variation.id}"
                        ${variation.inStock ? "" : html`disabled`}>
                  ${variation.name || formatMoney(variation.priceCents)}
                </button>
              `)}
            </div>
          </fieldset>
        ` : ""}

        <div class="product-buy">
          <div class="quantity-control">
            <button type="button" data-qty-step="-1" aria-label="Decrease quantity">&#8722;</button>
            <span data-qty-value aria-live="polite">1</span>
            <button type="button" data-qty-step="1" aria-label="Increase quantity">+</button>
          </div>
          <button class="button button-dark product-add"
                  type="button"
                  data-add-to-cart="${product.defaultVariation.id}"
                  data-name="${product.name}"
                  data-use-qty
                  ${soldOut ? html`disabled` : ""}>
            ${soldOut ? "Sold out" : "Add to bag"}
          </button>
        </div>

        <div class="buy-reassurance">
          ${cfg.shippingEnabled && freeAt > 0
            ? html`<span>Free U.S. shipping over ${formatMoney(freeAt)}</span>`
            : ""}
          ${cfg.pickupEnabled ? html`<span>Local pickup in Tampa</span>` : ""}
          <span>Secure checkout by Square</span>
        </div>

        <details>
          <summary>How to use</summary>
          <p>
            Laura will tailor this to your routine at your appointment. If you&#8217;re
            unsure how it fits with what you already use, email
            <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> before you buy.
          </p>
        </details>
        <details>
          <summary>Shipping &amp; pickup</summary>
          <p>
            ${cfg.shippingEnabled
              ? html`Flat ${formatMoney(cfg.shippingFeeCents)} U.S. shipping${freeAt > 0 ? html`, free on orders over ${formatMoney(freeAt)}` : ""}.`
              : "Shipping is currently unavailable."}
            ${cfg.pickupEnabled ? html` Local pickup at the Tampa studio is always free.` : ""}
          </p>
        </details>
        <details>
          <summary>Questions</summary>
          <p>
            Book a consult and Laura will tell you whether this product is right for
            your skin &#8212; or whether something else is a better fit.
            <a href="${BOOKING_URL}">Book an appointment</a>.
          </p>
        </details>
      </div>
    </div>

    ${related.length ? html`
      <section class="related-products section-shell">
        <h2>You might also <em>like</em></h2>
        <div class="product-grid">
          ${related.map((item) => productCard(item))}
        </div>
      </section>
    ` : ""}

    <script>window.__PRODUCT_VARIATIONS__ = ${jsonScript(variationData)};</script>
  `;
}
