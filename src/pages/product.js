import { html, jsonScript } from "../html.js";
import { productCard } from "./components.js";
import { formatMoney, BOOKING_URL, SUPPORT_EMAIL } from "../config.js";
import { productInsightFor } from "../product-insights.js";
import { renderProductOverview } from "../product-overview.js";

function ingredientDetails(ingredient) {
  return html`
    <details class="ingredient-row ingredient-row-${ingredient.tone}">
      <summary>
        <span class="ingredient-marker" aria-hidden="true"></span>
        <span class="ingredient-name">
          <strong>${ingredient.name}</strong>
          ${ingredient.aka ? html`<small>${ingredient.aka}</small>` : ""}
          ${ingredient.component ? html`<small>Part of ${ingredient.component}</small>` : ""}
        </span>
        <span class="ingredient-role">${ingredient.role}</span>
        <span class="ingredient-toggle" aria-hidden="true"></span>
      </summary>
      <div class="ingredient-explanation">
        <div>
          <p class="ingredient-label">What it is</p>
          <p>${ingredient.description}</p>
        </div>
        <div>
          <p class="ingredient-label">Why it&#8217;s here</p>
          <p>${ingredient.why}</p>
        </div>
        <div>
          <p class="ingredient-label">Good to know</p>
          <p>${ingredient.note}</p>
        </div>
        <p class="ingredient-evidence">Information level: <strong>${ingredient.level}</strong></p>
        ${ingredient.source
          ? html`<a class="text-link" href="${ingredient.source}" target="_blank" rel="noopener noreferrer">Learn from Epicutis <span aria-hidden="true">&#8599;</span></a>`
          : ""}
      </div>
    </details>
  `;
}

function insightIngredients(review) {
  const featured = review.ingredients.filter((ingredient) => ingredient.featured);
  return html`
    <div class="ingredient-browser">
      <div class="formula-data-status ${review.needsVerification ? "formula-data-status-caution" : ""}">
        <div>
          <p class="ingredient-label">Formula status</p>
          <strong>${review.confidence}</strong>
        </div>
        <p>${review.notApplicable
          ? "This is a skincare device, so no cosmetic INCI list applies. Review the device directions and safety guidance instead."
          : review.needsVerification
          ? "This source match still needs confirmation against the current package before the formula is treated as final."
          : review.partial
            ? "Only the published ingredients or component formulas currently available are shown."
            : "The complete published formula is available to explore below."}</p>
      </div>

      ${review.hasFormula ? html`
        ${featured.length ? html`
          <div class="featured-ingredients">
            <div class="ingredient-section-heading">
              <p class="eyebrow">The ingredients doing the most</p>
              <h3>Featured ingredients</h3>
            </div>
            <div class="featured-ingredient-grid">
              ${featured.map((ingredient) => html`
                <article class="featured-ingredient featured-ingredient-${ingredient.tone}">
                  <p class="ingredient-label">${ingredient.role}</p>
                  <h4>${ingredient.name}</h4>
                  ${ingredient.aka ? html`<p class="featured-aka">${ingredient.aka}</p>` : ""}
                  <p>${ingredient.description}</p>
                </article>
              `)}
            </div>
          </div>
        ` : ""}

        <div class="all-ingredients">
          <div class="ingredient-section-heading">
            <p class="eyebrow">Click any ingredient to learn more</p>
            <h3>Explore ${review.partial ? "the" : "all"} ${review.ingredients.length} ${review.partial ? "published ingredients" : "ingredients"}</h3>
          </div>
          <div class="ingredient-legend" aria-label="Ingredient label guide">
            <span><i class="legend-supportive"></i>Supportive</span>
            <span><i class="legend-functional"></i>Formula function</span>
            <span><i class="legend-context"></i>More context</span>
          </div>
          <div class="ingredient-list" role="region" aria-label="Full ingredient list" tabindex="0">
            ${review.ingredients.map((ingredient) => ingredientDetails(ingredient))}
          </div>
        </div>
      ` : review.notApplicable ? html`
        <div class="ingredient-empty-state">
          <p class="eyebrow">Device guidance</p>
          <h3>No cosmetic ingredient list applies.</h3>
          <p>This product should be assessed using its operating directions, contraindications, eye-protection guidance, and the manufacturer&#8217;s device documentation.</p>
        </div>
      ` : html`
        <div class="ingredient-empty-state">
          <p class="eyebrow">Verification in progress</p>
          <h3>The current package panel is still needed.</h3>
          <p>We will add the expandable ingredient review after the exact formula is confirmed. Product marketing copy alone is not enough to make an ingredient assessment.</p>
        </div>
      `}

      <div class="ingredient-source-note">
        <p>
          Ingredient list reviewed ${review.reviewed}. Formulas can change, so always compare this information with the packaging you receive.
          This review is educational and is not medical advice.
        </p>
        ${review.formulaSource
          ? html`<a class="text-link" href="${review.formulaSource}" target="_blank" rel="noopener noreferrer">View formula source <span aria-hidden="true">&#8599;</span></a>`
          : ""}
      </div>
    </div>
  `;
}

function ingredientReview(review, productOverview) {
  return html`
    <div class="product-detail-tabs" data-ingredient-review>
      <div class="insight-tab-list" role="tablist" aria-label="Product information">
        <button id="insight-tab-overview" type="button" role="tab" aria-selected="true" aria-controls="insight-panel-overview" tabindex="0">Overview</button>
        <button id="insight-tab-ingredients" type="button" role="tab" aria-selected="false" aria-controls="insight-panel-ingredients" tabindex="-1">Ingredients</button>
      </div>
      <div id="insight-panel-overview" class="insight-tab-panel" role="tabpanel" aria-labelledby="insight-tab-overview">
        ${productOverview}
      </div>
      <div id="insight-panel-ingredients" class="insight-tab-panel" role="tabpanel" aria-labelledby="insight-tab-ingredients" hidden>
        <header class="product-insight-heading">
          <p class="eyebrow">${review.eyebrow}</p>
          <h2>${review.heading}</h2>
          <p>Understand the complete formula, then explore any ingredient that catches your attention.</p>
        </header>
        ${insightIngredients(review)}
      </div>
    </div>
  `;
}

export function productPage({ product, related, cfg }) {
  const soldOut = !product.available;
  const hasChoices = product.variations.length > 1;
  const freeAt = cfg.freeShippingThresholdCents;
  const insight = productInsightFor(product.name);
  const descriptionOverview = renderProductOverview(product);

  const variationData = Object.fromEntries(
    product.variations.map((variation) => [variation.id, {
      price: formatMoney(variation.priceCents),
      inStock: variation.inStock,
    }]),
  );

  const productOverview = html`
    <p class="eyebrow">${product.category}</p>
    <h1>${product.name}</h1>
    <p class="product-detail-price" data-price-display>${formatMoney(product.priceCents)}</p>

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

    ${descriptionOverview.markup}

    ${descriptionOverview.hasUsage ? "" : html`
      <details>
        <summary>How to use</summary>
        <p>
          Laura will tailor this to your routine at your appointment. If you&#8217;re
          unsure how it fits with what you already use, email
          <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> before you buy.
        </p>
      </details>
    `}
    <details>
      <summary>Shipping &amp; pickup</summary>
      <p>
        ${cfg.shippingEnabled
          ? html`Flat ${formatMoney(cfg.shippingFeeCents)} U.S. shipping${freeAt > 0 ? html`, free on orders over ${formatMoney(freeAt)}` : ""}.`
          : "Shipping is currently unavailable."}
        ${cfg.pickupEnabled ? html` Local pickup at the Tampa studio is always free.` : ""}
      </p>
    </details>
    ${descriptionOverview.hasQuestions ? "" : html`
      <details>
        <summary>Questions</summary>
        <p>
          Book a consult and Laura will tell you whether this product is right for
          your skin &#8212; or whether something else is a better fit.
          <a href="${BOOKING_URL}">Book an appointment</a>.
        </p>
      </details>
    `}
  `;

  return html`
    <div class="product-page section-shell">
      <div class="product-gallery">
        <div class="product-gallery-panel">
          ${product.image
            ? html`<img src="${product.image}" alt="${product.name}" width="620" height="632" />`
            : html`<div class="product-image-fallback">${product.name}</div>`}
        </div>
      </div>

      <div class="product-details">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <a href="/shop">Shop</a>
          <span aria-hidden="true">/</span>
          <span>${product.category}</span>
        </nav>
        ${insight ? ingredientReview(insight, productOverview) : productOverview}
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
