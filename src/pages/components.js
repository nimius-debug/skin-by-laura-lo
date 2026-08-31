import { html } from "../html.js";
import { formatMoney } from "../config.js";

/** Shared product tile used on the homepage, shop grid and related rails. */
export function productCard(product, { showShort = false, showAdd = false } = {}) {
  const variation = product.defaultVariation;
  const soldOut = !product.available;

  return html`
    <article class="product-card">
      <a href="/product/${product.slug}" aria-label="${product.name}, ${formatMoney(product.priceCents)}">
        <div class="product-image-wrap">
          ${soldOut ? html`<span class="product-badge product-badge-soldout">Sold out</span>` : ""}
          ${product.image
            ? html`<img src="${product.image}" alt="${product.name}" loading="lazy" width="420" height="490" />`
            : html`<div class="product-image-fallback">${product.name}</div>`}
          <div class="product-quick">View product</div>
        </div>
        <div class="product-info">
          <div>
            <p class="product-category">${product.category}</p>
            <h3>${product.name}</h3>
            ${showShort && product.description
              ? html`<p class="product-short">${product.description.slice(0, 96)}${product.description.length > 96 ? "…" : ""}</p>`
              : ""}
          </div>
          <p class="product-price">${formatMoney(product.priceCents)}</p>
        </div>
      </a>
      ${showAdd
        ? html`<button class="add-button" type="button"
            data-add-to-cart="${variation.id}"
            data-name="${product.name}"
            ${soldOut ? html`disabled` : ""}>
            <span>${soldOut ? "Sold out" : "Add to bag"}</span><span aria-hidden="true">${soldOut ? "" : "+"}</span>
          </button>`
        : ""}
    </article>
  `;
}

/** Banner shown when Square credentials have not been added yet. */
export function squareNotice() {
  return html`
    <div class="notice-banner">
      <strong>Square is not connected yet.</strong>
      Products load live from Square&#8217;s Catalog once
      <code>SQUARE_ACCESS_TOKEN</code> and <code>SQUARE_LOCATION_ID</code> are set as Worker secrets.
      Everything else on the site works normally in the meantime.
    </div>
  `;
}

export function marquee(words) {
  const strip = words.flatMap((word) => [
    html`<span>${word}</span>`,
    html`<i aria-hidden="true">&#10022;</i>`,
  ]);
  return html`
    <div class="marquee" aria-hidden="true">
      <div>${strip}${strip}</div>
    </div>
  `;
}
