// Everything a shopper sees of Black Friday 2026: the banner above the
// header, the block on the homepage, the /black-friday page and the terms.
// The dates and numbers come from src/campaign.js; `phase` is "launch"
// (Nov 23 to 26) or "sale" (Nov 27 to 30).

import { html, raw } from "../html.js";
import { BLACK_FRIDAY } from "../campaign.js";
import { EGIFT_URL, SUPPORT_EMAIL, formatMoney, priceMarkup } from "../config.js";

const PAGE = "/black-friday";
const dollars = (cents) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const MAX_BONUS = dollars(Math.max(...BLACK_FRIDAY.giftCards.map((card) => card.valueCents - card.payCents)));
const SALE_LINE = `${BLACK_FRIDAY.salePercent}% off skincare + free shipping`;

/** The three offers, in the order this phase wants them, the first one leading. */
function offers(phase) {
  const series = {
    key: "series",
    eyebrow: "Treatment series",
    title: `Liquid Microneedling Series`,
    figure: dollars(BLACK_FRIDAY.package.priceCents),
    copy: `Four Green Sea Liquid Microneedling treatments with complimentary homecare. A ${dollars(BLACK_FRIDAY.package.totalValueCents)} value, save ${dollars(BLACK_FRIDAY.package.savingsCents)}.`,
    short: `Liquid Microneedling Series ${dollars(BLACK_FRIDAY.package.priceCents)}`,
    cta: "Get the series",
    href: `${PAGE}#series`,
  };
  const gift = {
    key: "gift",
    eyebrow: "Gift card event",
    title: "Gift cards with bonus value",
    figure: `Up to ${MAX_BONUS} bonus`,
    copy: "Buy a gift card for yourself or someone else and receive bonus value to spend on treatments and skincare.",
    short: `Gift cards: up to ${MAX_BONUS} bonus`,
    cta: "Buy a gift card",
    href: `${PAGE}#gift-cards`,
  };
  const skincare = phase === "sale"
    ? {
      key: "skincare",
      eyebrow: "Skincare sale",
      title: `${BLACK_FRIDAY.salePercent}% off skincare`,
      figure: "+ free shipping",
      copy: "Every eligible skincare product, with free standard U.S. shipping and no minimum. The discount is applied automatically.",
      short: SALE_LINE,
      cta: "Shop skincare",
      href: "/shop",
    }
    : {
      key: "skincare",
      eyebrow: "Starts November 27",
      title: `${BLACK_FRIDAY.salePercent}% off skincare`,
      figure: "+ free shipping",
      copy: "Coming Friday, November 27 through November 30: 15% off eligible skincare with free standard U.S. shipping, no minimum.",
      short: `${SALE_LINE} from Nov 27`,
      cta: "See the details",
      href: `${PAGE}#skincare`,
    };
  return phase === "sale" ? [skincare, series, gift] : [series, gift, skincare];
}

/** The bar above the header. Takes the place of the everyday sale banner. */
export function campaignBanner(phase) {
  if (!phase) return "";
  const [lead, ...rest] = offers(phase);
  return html`
    <div class="promo promo-bf" data-campaign-banner>
      <div class="promo-bf-inner">
        <span class="promo-bf-tag">Black Friday</span>
        <a class="promo-bf-offer promo-bf-lead" href="${lead.href}">${lead.short}</a>
        ${rest.map((offer) => html`<a class="promo-bf-offer promo-bf-more" href="${offer.href}">${offer.short}</a>`)}
        <a class="promo-cta promo-bf-all" href="${PAGE}">All offers <span aria-hidden="true">&rarr;</span></a>
      </div>
    </div>
  `;
}

/** The block under the homepage hero. */
export function campaignHomeBlock(phase) {
  if (!phase) return "";
  return html`
    <section class="bf-home section-shell" aria-labelledby="bf-home-title">
      <div class="bf-home-heading">
        <p class="eyebrow">Black Friday · ${phase === "sale" ? "Ends November 30" : "November 23 to 30"}</p>
        <h2 id="bf-home-title">${BLACK_FRIDAY.name.replace(/ Edit$/, "")} <em>Edit</em></h2>
      </div>
      <div class="bf-cards">
        ${offers(phase).map((offer, index) => offerCard(offer, index === 0))}
      </div>
    </section>
  `;
}

function offerCard(offer, lead) {
  return html`
    <article class="bf-card${lead ? " bf-card-lead" : ""}">
      <p class="eyebrow">${offer.eyebrow}</p>
      <h3>${offer.title}</h3>
      <p class="bf-figure">${offer.figure}</p>
      <p class="bf-copy">${offer.copy}</p>
      <a class="button ${lead ? "button-dark" : "button-light"}" href="${offer.href}">${offer.cta} <span aria-hidden="true">&rarr;</span></a>
    </article>
  `;
}

/** The promotional terms, shown on /black-friday and on the Terms page. */
export function campaignTerms() {
  return [
    `All Black Friday offers run from November 23, 2026 and end ${BLACK_FRIDAY.endLabel}.`,
    `The skincare sale and free shipping run November 27 to 30 only: ${BLACK_FRIDAY.salePercent}% off eligible skincare products, applied automatically at checkout, with free standard U.S. shipping and no minimum purchase.`,
    "The skincare discount does not apply to services, treatment packages, memberships or gift cards.",
    "Offers cannot be combined with other discounts, promotions or coupon codes.",
    "The Liquid Microneedling series is purchased online and its four treatments are scheduled with Laura at the Tampa studio.",
    "Gift cards can be used toward both services and skincare products. Bonus value is issued to the purchaser as a separate gift card after purchase.",
    "Packages and gift card balances purchased during the event remain valid after it ends.",
  ];
}

function seriesSection(pkg) {
  const offer = BLACK_FRIDAY.package;
  const variation = pkg?.defaultVariation;
  const soldOut = pkg && !pkg.available;
  // Square is the price of record. The campaign figure is only shown until
  // the item exists there, so the page and the checkout can never disagree.
  const price = variation
    ? raw(priceMarkup(variation.priceCents, variation.regularPriceCents))
    : formatMoney(offer.priceCents);

  return html`
    <section class="bf-section bf-series" id="series">
      <div class="bf-section-copy">
        <p class="eyebrow">Treatment series · November 23 to 30</p>
        <h2>${offer.title} <em>${offer.subtitle}</em></h2>
        ${pkg?.description ? html`<p class="bf-lede">${pkg.description}</p>` : ""}
        <ul class="bf-includes">
          ${offer.includes.map((line) => html`<li>${line}</li>`)}
        </ul>
      </div>
      <div class="bf-buy">
        <p class="bf-price">${price}</p>
        <dl class="bf-values">
          <div><dt>Regular treatment value</dt><dd>${dollars(offer.treatmentValueCents)}</dd></div>
          <div><dt>Complimentary homecare</dt><dd>${dollars(offer.homecareValueCents)}</dd></div>
          <div><dt>Total package value</dt><dd>${dollars(offer.totalValueCents)}</dd></div>
          <div class="bf-values-total"><dt>You save</dt><dd>${dollars(offer.savingsCents)}</dd></div>
        </dl>
        ${variation
          ? html`<button class="button button-dark" type="button"
                data-add-to-cart="${variation.id}" data-name="${pkg.name}"
                ${soldOut ? html`disabled` : ""}>${soldOut ? "Sold out" : "Add to bag"}</button>`
          : html`<a class="button button-dark" href="mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Liquid Microneedling Series")}">Email Laura to reserve</a>`}
        <p class="bf-note">Pay online with Square. Laura will contact you to plan and schedule your four treatments in the Tampa studio. Nothing ships.</p>
      </div>
    </section>
  `;
}

function giftSection() {
  return html`
    <section class="bf-section bf-gift" id="gift-cards">
      <div class="bf-section-copy">
        <p class="eyebrow">Gift card event · November 23 to 30</p>
        <h2>Gift cards with <em>bonus value</em></h2>
        <p class="bf-lede">
          For yourself or as a gift. Gift cards can be used toward treatments and skincare products.
          Your bonus arrives as a separate gift card by email after your purchase.
        </p>
      </div>
      <div class="bf-buy">
        <table class="bf-tiers">
          <thead><tr><th scope="col">You pay</th><th scope="col">You receive</th><th scope="col">Bonus</th></tr></thead>
          <tbody>
            ${BLACK_FRIDAY.giftCards.map((card) => html`
              <tr>
                <td>${dollars(card.payCents)}</td>
                <td><strong>${dollars(card.valueCents)}</strong></td>
                <td>+${dollars(card.valueCents - card.payCents)}</td>
              </tr>`)}
          </tbody>
        </table>
        <a class="button button-dark" href="${EGIFT_URL}">Buy a gift card <span aria-hidden="true">&#8599;</span></a>
        <p class="bf-note">Gift cards are sold on Square&#8217;s secure gift card page.</p>
      </div>
    </section>
  `;
}

function skincareSection(phase) {
  const live = phase === "sale";
  return html`
    <section class="bf-section bf-skincare" id="skincare">
      <div class="bf-section-copy">
        <p class="eyebrow">${live ? "Skincare sale · Ends November 30" : "Skincare sale · Starts Friday, November 27"}</p>
        <h2>${BLACK_FRIDAY.salePercent}% off skincare <em>+ free shipping</em></h2>
        <p class="bf-lede">
          ${live
            ? "Every eligible skincare product is 15% off, with free standard U.S. shipping and no minimum. The discount is already in the price you see and is applied automatically at checkout."
            : "From Friday, November 27 through Monday, November 30: 15% off eligible skincare products with free standard U.S. shipping and no minimum. The discount will be applied automatically."}
        </p>
      </div>
      <div class="bf-buy">
        <a class="button ${live ? "button-dark" : "button-light"}" href="/shop">${live ? "Shop skincare" : "Browse the shelf"} <span aria-hidden="true">&rarr;</span></a>
      </div>
    </section>
  `;
}

export function blackFridayPage({ phase, pkg }) {
  const sections = phase === "sale"
    ? [skincareSection(phase), seriesSection(pkg), giftSection()]
    : [seriesSection(pkg), giftSection(), skincareSection(phase)];

  return html`
    <div class="bf-page section-shell">
      <header class="bf-hero">
        <p class="eyebrow">Black Friday 2026 · November 23 to 30</p>
        <h1>The Skin Investment <em>Edit</em></h1>
        <p class="bf-lede">
          ${phase === "sale"
            ? `Three ways to invest in your skin, all ending ${BLACK_FRIDAY.endLabel}.`
            : "Two offers are live now, and the skincare sale opens Friday, November 27."}
        </p>
      </header>
      ${sections}
      <section class="bf-terms" id="terms">
        <h2>Promotion terms</h2>
        <ul>${campaignTerms().map((line) => html`<li>${line}</li>`)}</ul>
      </section>
    </div>
  `;
}
