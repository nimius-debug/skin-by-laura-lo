// Everything a shopper sees of Black Friday 2026: the banner above the
// header, the block on the homepage, the /black-friday page and the terms.
// The dates and numbers come from src/campaign.js; `phase` is "launch"
// (Nov 23 to 26) or "sale" (Nov 27 to 30).

import { html } from "../html.js";
import { BLACK_FRIDAY } from "../campaign.js";
import { EGIFT_URL, SUPPORT_EMAIL, formatMoney } from "../config.js";

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
    save: `Save ${dollars(BLACK_FRIDAY.package.savingsCents)}`,
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
    save: `Up to ${MAX_BONUS} free`,
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
      save: `Save ${BLACK_FRIDAY.salePercent}%`,
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
      save: `Save ${BLACK_FRIDAY.salePercent}%`,
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
    <div class="bf-home-band">
      <section class="bf-home section-shell" aria-labelledby="bf-home-title">
        <div class="bf-home-heading">
          <div>
            <p class="eyebrow">Black Friday · ${phase === "sale" ? "Ends November 30" : "November 23 to 30"}</p>
            <h2 id="bf-home-title">${BLACK_FRIDAY.name.replace(/ Edit$/, "")} <em>Edit</em></h2>
          </div>
          <a class="button button-dark" href="${PAGE}">See all offers <span aria-hidden="true">&rarr;</span></a>
        </div>
        <div class="bf-cards">
          ${offers(phase).map((offer, index) => offerCard(offer, index === 0))}
        </div>
      </section>
    </div>
  `;
}

function offerCard(offer, lead) {
  return html`
    <article class="bf-card${lead ? " bf-card-lead" : ""}">
      <p class="bf-save-tag">${offer.save}</p>
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
    "Gift cards can be used toward both services and skincare products. Bonus value is added to the same gift card automatically, shortly after purchase, on gift cards bought for exactly $100, $200 or $300.",
    "Packages and gift card balances purchased during the event remain valid after it ends.",
  ];
}

const money = (cents) => (cents % 100 ? formatMoney(cents) : dollars(cents));
const saleOff = (cents) => Math.round((cents * BLACK_FRIDAY.salePercent) / 100);

/** A long Square description, cut into one short point per sentence. */
function points(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+|\s*[\n•]+\s*/)
    .map((line) => line.trim().replace(/^[-–•]\s*/, ""))
    .filter((line) => line.length > 2);
}

function countdown(label, target, now) {
  return html`
    <div class="bf-countdown" data-bf-countdown="${target}" ${now ? html`data-bf-now="${now.toISOString()}"` : ""}>
      <p class="bf-countdown-label">${label}</p>
      <div class="bf-clock" role="timer" aria-live="off">
        ${[["d", "days"], ["h", "hrs"], ["m", "min"], ["s", "sec"]].map(([unit, name]) => html`
          <span class="bf-clock-cell"><strong data-bf-unit="${unit}">--</strong><small>${name}</small></span>`)}
      </div>
    </div>
  `;
}

function seriesSection(pkg) {
  const offer = BLACK_FRIDAY.package;
  const variation = pkg?.defaultVariation;
  const soldOut = pkg && !pkg.available;
  // Square is the price of record. The campaign figure is only shown until
  // the item exists there, so the page and the checkout can never disagree.
  const priceCents = variation ? variation.priceCents : offer.priceCents;
  const savingsCents = Math.max(offer.totalValueCents - priceCents, 0);
  const paidShare = Math.min(100, Math.round((priceCents / offer.totalValueCents) * 100));
  const about = points(pkg?.description);
  const image = pkg?.image || null;

  return html`
    <section class="bf-section bf-series" id="series" data-bf-reveal>
      <div class="bf-media">
        <span class="bf-badge">Save ${money(savingsCents)}</span>
        ${image
          ? html`<img src="${image}" alt="${offer.title}, ${offer.subtitle}" loading="lazy" />`
          : html`<div class="bf-media-empty"><span>${offer.title}</span><em>${offer.subtitle}</em></div>`}
      </div>
      <div class="bf-detail">
        <p class="bf-kicker">Treatment series · Nov 23 to 30</p>
        <h2>${offer.title} <em>${offer.subtitle}</em></h2>

        <div class="bf-pricing">
          <p class="bf-price"><s><span class="sr-only">Total value </span>${money(offer.totalValueCents)}</s> <strong>${money(priceCents)}</strong></p>
          <p class="bf-saving">You save <strong data-bf-count="${Math.round(savingsCents / 100)}">${money(savingsCents)}</strong></p>
        </div>
        <div class="bf-meter" role="img" aria-label="You pay ${money(priceCents)} of a ${money(offer.totalValueCents)} value">
          <span class="bf-meter-paid" style="--share:${paidShare}%"><b>You pay ${money(priceCents)}</b></span>
          <span class="bf-meter-saved"><b>Free</b></span>
        </div>

        <ul class="bf-ticks">
          <li><span>Four Liquid Microneedling treatments</span><b>${money(offer.treatmentValueCents)} value</b></li>
          <li><span>Pre- and post-treatment homecare</span><b>${money(offer.homecareValueCents)} free</b></li>
          <li><span>Personal treatment plan and ongoing guidance</span><b>Included</b></li>
        </ul>

        ${variation
          ? html`<button class="button button-dark bf-cta" type="button"
                data-add-to-cart="${variation.id}" data-name="${pkg.name}"
                ${soldOut ? html`disabled` : ""}>${soldOut ? "Sold out" : html`Add to bag · ${money(priceCents)}`}</button>`
          : html`<a class="button button-dark bf-cta" href="mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Liquid Microneedling Series")}">Email Laura to reserve</a>`}
        <p class="bf-note">Pay online with Square. Laura will contact you to schedule your four visits in Tampa. Nothing ships.</p>

        ${about.length ? html`
          <details class="bf-about">
            <summary>About the treatment</summary>
            <ul>${about.map((line) => html`<li>${line}</li>`)}</ul>
          </details>` : ""}
      </div>
    </section>
  `;
}

function giftSection() {
  const cards = BLACK_FRIDAY.giftCards;
  const best = cards[cards.length - 1];
  return html`
    <section class="bf-section bf-gift" id="gift-cards" data-bf-reveal>
      <div class="bf-media bf-media-gift">
        <div class="bf-giftcard" data-bf-giftcard>
          <span class="bf-giftcard-brand">Skin by Laura Lo</span>
          <span class="bf-giftcard-label">Gift card value</span>
          <strong class="bf-giftcard-value" data-bf-gift-value>${money(best.valueCents)}</strong>
          <span class="bf-giftcard-bonus">+<span data-bf-gift-bonus>${money(best.valueCents - best.payCents)}</span> bonus, free</span>
        </div>
      </div>
      <div class="bf-detail">
        <p class="bf-kicker">Gift card event · Nov 23 to 30</p>
        <h2>Gift cards with <em>free bonus value</em></h2>
        <p class="bf-pick-label" id="bf-pick-label">Pick an amount to see what you get</p>
        <div class="bf-tiers" role="group" aria-labelledby="bf-pick-label">
          ${cards.map((card) => html`
            <button type="button" class="bf-tier" aria-pressed="${card === best ? "true" : "false"}"
                    data-bf-tier data-pay="${money(card.payCents)}" data-value="${money(card.valueCents)}" data-bonus="${money(card.valueCents - card.payCents)}">
              <span class="bf-tier-pay">Pay ${money(card.payCents)}</span>
              <strong>Get ${money(card.valueCents)}</strong>
              <span class="bf-tier-bonus">+${money(card.valueCents - card.payCents)} free</span>
            </button>`)}
        </div>
        <ul class="bf-ticks bf-ticks-plain">
          <li><span>For yourself or as a gift</span></li>
          <li><span>Use it on treatments and skincare</span></li>
          <li><span>Your bonus is added to the same card within minutes</span></li>
        </ul>
        <a class="button button-dark bf-cta" href="${EGIFT_URL}"><span>Buy a <span data-bf-gift-pay>${money(best.payCents)}</span> gift card</span> <span aria-hidden="true">&#8599;</span></a>
        <p class="bf-note">Sold on Square&#8217;s secure gift card page.</p>
      </div>
    </section>
  `;
}

function saleProduct(product, live) {
  const regular = product.regularPriceCents;
  // During the sale Square has already priced it. Before, show what it will be.
  const sale = live ? product.priceCents : regular - saleOff(regular);
  const saved = regular - sale;
  const variation = product.defaultVariation;
  return html`
    <article class="bf-product">
      <a href="/product/${encodeURIComponent(product.slug)}" class="bf-product-link">
        <div class="bf-product-image">
          ${saved > 0 ? html`<span class="bf-product-save">Save ${formatMoney(saved)}</span>` : ""}
          ${product.image
            ? html`<img src="${product.image}" alt="${product.name}" loading="lazy" />`
            : html`<span class="bf-product-empty">${product.name}</span>`}
        </div>
        <h3>${product.name}</h3>
        <p class="bf-product-price">
          ${saved > 0 ? html`<s><span class="sr-only">Regular price </span>${formatMoney(regular)}</s> ` : ""}
          <strong>${formatMoney(sale)}</strong>
          ${live ? "" : html`<small>from Nov 27</small>`}
        </p>
      </a>
      ${live
        ? html`<button class="bf-product-add" type="button" data-add-to-cart="${variation.id}" data-name="${product.name}"
              ${product.available ? "" : html`disabled`}>${product.available ? "Add to bag +" : "Sold out"}</button>`
        : ""}
    </article>
  `;
}

function skincareSection(phase, products, now) {
  const live = phase === "sale";
  // Products arrive best-sellers first. During the sale, only what is on sale.
  const shown = products
    .filter((product) => product.available && (!live || product.regularPriceCents > product.priceCents))
    .slice(0, 8);
  return html`
    <section class="bf-section bf-skincare" id="skincare" data-bf-reveal>
      <div class="bf-skincare-head">
        <div>
          <p class="bf-kicker">${live ? "Skincare sale · Ends Nov 30" : "Skincare sale · Starts Friday, Nov 27"}</p>
          <h2>${BLACK_FRIDAY.salePercent}% off skincare <em>+ free shipping</em></h2>
          <ul class="bf-ticks bf-ticks-plain bf-ticks-row">
            <li><span>${BLACK_FRIDAY.salePercent}% off, taken off automatically</span></li>
            <li><span>Free U.S. shipping, no minimum</span></li>
            <li><span>${live ? "Ends Monday, Nov 30" : "Friday, Nov 27 to Monday, Nov 30"}</span></li>
          </ul>
        </div>
        ${live ? "" : countdown("Sale starts in", BLACK_FRIDAY.saleStartUtc, now)}
      </div>
      ${shown.length ? html`<div class="bf-products">${shown.map((product) => saleProduct(product, live))}</div>` : ""}
      <a class="button ${live ? "button-dark" : "button-light"} bf-cta bf-cta-center" href="/shop">${live ? "Shop all skincare" : "Browse the shelf"} <span aria-hidden="true">&rarr;</span></a>
    </section>
  `;
}

export function blackFridayPage({ phase, pkg, products = [], now = null }) {
  const live = phase === "sale";
  const offer = BLACK_FRIDAY.package;
  const chips = [
    { href: "#series", big: `Save ${money(offer.savingsCents)}`, small: "Microneedling series" },
    { href: "#gift-cards", big: `Up to ${MAX_BONUS} free`, small: "Gift card bonus" },
    { href: "#skincare", big: `${BLACK_FRIDAY.salePercent}% off`, small: live ? "Skincare + free shipping" : "Skincare, from Nov 27" },
  ];
  if (live) chips.unshift(chips.pop());
  const sections = live
    ? [skincareSection(phase, products, now), seriesSection(pkg), giftSection()]
    : [seriesSection(pkg), giftSection(), skincareSection(phase, products, now)];

  return html`
    <div class="bf" data-bf>
      <div class="bf-glow" aria-hidden="true"></div>
      <div class="section-shell">
        <header class="bf-hero">
          <p class="bf-tag"><span>Black Friday</span> Nov 23 to 30</p>
          <h1>The Skin Investment <em>Edit</em></h1>
          <p class="bf-sub">${live ? "Three offers. All end Monday night." : "Two offers live now. Skincare sale opens Friday."}</p>
          ${countdown("Everything ends in", BLACK_FRIDAY.endUtc, now)}
          <nav class="bf-chips" aria-label="Black Friday offers">
            ${chips.map((chip) => html`<a class="bf-chip" href="${chip.href}"><strong>${chip.big}</strong><span>${chip.small}</span></a>`)}
          </nav>
        </header>
        ${sections}
        <section class="bf-terms" id="terms">
          <details>
            <summary>Promotion terms</summary>
            <ul>${campaignTerms().map((line) => html`<li>${line}</li>`)}</ul>
          </details>
        </section>
      </div>
    </div>
  `;
}
