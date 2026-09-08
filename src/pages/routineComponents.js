import { html } from "../html.js";
import { BOOKING_URL, formatMoney } from "../config.js";

/** Small overlapping fan of up to 3 product photos — stands in for a single
 *  "whole routine" photo until one exists for each kit. */
function routineMedia(items) {
  const shots = items.map((item) => item.product.image).filter(Boolean).slice(0, 3);
  if (!shots.length) return html`<div class="routine-media routine-media-empty" aria-hidden="true"></div>`;
  return html`
    <div class="routine-media" aria-hidden="true">
      ${shots.map((src) => html`<img src="${src}" alt="" loading="lazy" />`)}
    </div>
  `;
}

/** Shop-style tile — same visual language as productCard(), minus the price
 *  (that lives in the popout, where it reflects only the checked items). */
export function routineTile(resolved) {
  return html`
    <article class="product-card routine-tile">
      <button type="button" data-routine-open="${resolved.slug}"
              aria-label="View ${resolved.name} routine">
        <div class="product-image-wrap">
          ${routineMedia(resolved.items)}
          <div class="product-quick">View routine</div>
        </div>
        <div class="product-info">
          <div>
            <p class="product-category">${resolved.concern}</p>
            <h3>${resolved.name}</h3>
            <p class="product-short">${resolved.oneLiner}</p>
          </div>
        </div>
      </button>
    </article>
  `;
}

/** One routine product, shown the same way a shop product tile is — image,
 *  name, price — with a checkbox layered on as a selectable card rather
 *  than a list row. Checked by default; unchecking dims the card. */
function routineProductCard(item) {
  const { product, role, variationId, priceCents, inStock } = item;
  return html`
    <label class="product-card routine-product-card ${inStock ? "" : "routine-product-soldout"}">
      <input type="checkbox" data-routine-item value="${variationId}" data-price="${priceCents}"
        ${inStock ? "checked" : "disabled"} />
      <span class="routine-check-badge" aria-hidden="true">&#10003;</span>
      <div class="product-image-wrap">
        ${product.image
          ? html`<img src="${product.image}" alt="${product.name}" loading="lazy" />`
          : html`<div class="product-image-fallback">${product.name}</div>`}
        ${inStock ? "" : html`<span class="product-badge product-badge-soldout">Sold out</span>`}
      </div>
      <div class="product-info">
        <h3>${product.name}</h3>
        ${role ? html`<p class="product-short">${role}</p>` : ""}
        <p class="product-price">${formatMoney(priceCents)}</p>
        <button type="button" class="routine-more-trigger" data-routine-more>See details</button>
      </div>
      <div class="routine-more-popover" data-routine-more-popover hidden>
        <p class="routine-more-name">${product.name}</p>
        ${role ? html`<p>${role}</p>` : ""}
      </div>
    </label>
  `;
}

/** The routine's full detail lives in a native <dialog> — a real popout,
 *  with browser-native focus handling, ESC-to-close and a backdrop. */
export function routineDialog(resolved) {
  return html`
    <dialog class="routine-dialog" id="routine-${resolved.slug}" data-routine data-routine-dialog="${resolved.slug}">
      <div class="routine-dialog-body">
        <button class="routine-dialog-close" type="button" data-routine-close aria-label="Close">&times;</button>
        <div class="routine-dialog-scroll">
          <p class="routine-concern">${resolved.concern}</p>
          <h3 class="routine-name">${resolved.name}</h3>
          <p class="routine-hook">${resolved.hook}</p>
          <p class="routine-description">${resolved.description}</p>
          <ul class="routine-bestfor">
            ${resolved.bestFor.map((tag) => html`<li>${tag}</li>`)}
          </ul>

          <p class="routine-whats-inside">What&#8217;s inside</p>
          <div class="routine-dialog-products">
            ${resolved.items.map((item) => routineProductCard(item))}
          </div>
          ${resolved.note ? html`<p class="routine-note">${resolved.note}</p>` : ""}

          ${resolved.consultation ? html`
            <div class="routine-consultation">
              <p class="routine-consultation-heading">${resolved.consultation.heading}</p>
              <p>${resolved.consultation.note}</p>
              <a class="text-link" href="${BOOKING_URL}">${resolved.consultation.ctaLabel} <span aria-hidden="true">&#8594;</span></a>
            </div>
          ` : ""}
        </div>

        <div class="routine-card-footer">
          <label class="routine-audit-opt">
            <input type="checkbox" data-routine-audit-checkbox checked />
            <span>
              Add a complimentary <strong>Skin Audit</strong> &#8212; a virtual consultation with Laura
              to make sure it&#8217;s working for your skin and what to adjust as you go.
              Included free when you buy the full routine.
            </span>
          </label>
          <div class="routine-card-footer-row">
            <span class="routine-total">Total <strong data-routine-total>${formatMoney(resolved.totalCents)}</strong></span>
            <button class="button button-dark" type="button" data-routine-add>Add to Bag</button>
          </div>
        </div>
      </div>
    </dialog>
  `;
}
