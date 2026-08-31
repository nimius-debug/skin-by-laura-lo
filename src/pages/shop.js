import { html, jsonScript } from "../html.js";
import { productCard, squareNotice } from "./components.js";
import { BOOKING_URL } from "../config.js";

export function shopPage({ products, connected }) {
  const categories = [...new Set(products.map((product) => product.category))].sort();

  return html`
    <div class="shop-page">
      <div class="shop-hero section-shell">
        <div>
          <h1>The <em>shelf</em></h1>
          <p>
            Everything here is what Laura actually uses and recommends &#8212;
            barrier-first formulas, chosen for real skin rather than trends.
          </p>
        </div>
      </div>

      <div class="shop-catalog section-shell">
        ${connected ? "" : squareNotice()}

        ${products.length ? html`
          <div class="shop-controls">
            <div class="filter-pills" role="group" aria-label="Filter by category">
              <button type="button" class="active" data-filter="all">All</button>
              ${categories.map((category) => html`<button type="button" data-filter="${category}">${category}</button>`)}
            </div>
            <div class="shop-search">
              <label class="sr-only" for="shop-search-input">Search products</label>
              <input id="shop-search-input" type="search" placeholder="Search products" autocomplete="off" />
            </div>
          </div>

          <p class="shop-count" data-shop-count>${products.length} product${products.length === 1 ? "" : "s"}</p>

          <div class="product-grid shop-product-grid" data-product-grid>
            ${products.map((product) => html`
              <div data-product-item
                   data-category="${product.category}"
                   data-name="${product.name.toLowerCase()}">
                ${productCard(product, { showShort: true, showAdd: true })}
              </div>
            `)}
          </div>

          <div class="shop-empty" data-shop-empty hidden>
            <div>
              <h2>Nothing matches</h2>
              <p>Try a different search or category.</p>
              <button class="text-link" type="button" data-shop-reset>Clear filters</button>
            </div>
          </div>
        ` : html`
          <div class="shop-empty">
            <div>
              <h2>The shelf is being restocked</h2>
              <p>
                ${connected
                  ? "No products are currently available online. Check back shortly, or ask Laura at your next appointment."
                  : "Products will appear here as soon as the Square connection is activated."}
              </p>
            </div>
          </div>
        `}

        <section class="product-help">
          <h2>Not sure where to <em>start?</em></h2>
          <div>
            <p>
              Book a treatment or a virtual consult and Laura will build the routine
              around your skin &#8212; then you only buy what you actually need.
            </p>
            <a class="button button-dark" href="${BOOKING_URL}">Book a consult <span aria-hidden="true">&#8599;</span></a>
          </div>
        </section>
      </div>
    </div>
    <script>window.__SHOP_READY__ = ${jsonScript(true)};</script>
  `;
}
