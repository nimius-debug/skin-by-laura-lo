// Everything a shopper sees of Black Friday 2026. While it runs, the homepage
// IS the Black Friday page: the hero, the treatment package, the gift card
// offer, the skincare offer (with "notify me" until it opens) and the products
// on sale, before the usual homepage sections. The whole site wears the
// "black-edition" theme (src/themes.js) at the same time.
//
// Dates and numbers come from src/campaign.js; `phase` is "launch"
// (Nov 23 to 26) or "sale" (Nov 27 to 30).

import { html } from "../html.js";
import { BLACK_FRIDAY } from "../campaign.js";
import { EGIFT_URL, SUPPORT_EMAIL, formatMoney } from "../config.js";

const GIFT = BLACK_FRIDAY.gift;
const OFFER = BLACK_FRIDAY.package;
const PCT = BLACK_FRIDAY.salePercent;
const LOGO = "/media/skin-logo.svg";

const dollars = (cents) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
/** Whole dollars when there are no cents ($170), otherwise $76.50. */
const money = (cents) => (cents % 100 ? formatMoney(cents) : dollars(cents));
const giftPrice = (cents) => cents - Math.round((cents * GIFT.percent) / 100);
const salePrice = (cents) => cents - Math.round((cents * PCT) / 100);

/** Was-price struck out, then the price paid. Always in that order. */
function wasNow(was, now, { big = false } = {}) {
  return html`<span class="bf-was"><span class="sr-only">Was </span>${was}</span> <span class="bf-now${big ? " bf-now-big" : ""}"><span class="sr-only">Now </span>${now}</span>`;
}

/** The package's real price from Square when it exists there, so page and checkout agree. */
function packagePrice(pkg) {
  const priceCents = pkg?.defaultVariation ? pkg.defaultVariation.priceCents : OFFER.priceCents;
  return { priceCents, savingsCents: Math.max(OFFER.totalValueCents - priceCents, 0) };
}

/** The one line above the header. Replaces the sale ticker and the shipping bar. */
export function campaignBar(phase) {
  if (!phase) return "";
  return html`
    <div class="bf-bar" data-campaign-banner>
      ${phase === "sale"
        ? html`<a href="/shop"><strong>Black Friday</strong> · ${PCT}% off skincare + free U.S. shipping<span class="bf-bar-more"> · Ends Mon, Nov 30</span></a>`
        : html`<a href="/#gift-cards"><strong>Black Friday</strong> · Gift cards ${GIFT.percent}% off<span class="bf-bar-more"> · Skincare ${PCT}% off starts Fri</span></a>`}
    </div>
  `;
}

function countdown(target, now) {
  return html`
    <div class="bf-clock" data-bf-countdown="${target}" ${now ? html`data-bf-now="${now.toISOString()}"` : ""} role="timer" aria-label="Black Friday ends Monday, November 30 at 11:59 PM">
      ${[["d", "days"], ["h", "hrs"], ["m", "min"], ["s", "sec"]].map(([unit, name]) => html`
        <span class="bf-clock-cell"><strong data-bf-unit="${unit}">--</strong><small>${name}</small></span>`)}
    </div>
  `;
}

/** Two cards fanned out, with a round seal. Pure CSS, the logo is the only image. */
function cardStack({ back, front, seal }) {
  return html`
    <div class="bf-stack" aria-hidden="true">
      <div class="bf-card-art bf-card-back">${back}</div>
      <div class="bf-card-art bf-card-front">${front}</div>
      <div class="bf-seal"><span><b>${seal}</b>off</span></div>
    </div>
  `;
}

function hero(phase, pkg, now) {
  const live = phase === "sale";
  const { savingsCents } = packagePrice(pkg);
  const giftShown = GIFT.amounts[2] ?? GIFT.amounts[GIFT.amounts.length - 1];
  const chips = [
    { href: "#packages", big: `−${money(savingsCents)}`, small: "Microneedling" },
    { href: "#gift-cards", big: `−${GIFT.percent}%`, small: "Gift cards" },
    { href: "#skincare", big: `−${PCT}%`, small: live ? "Skincare" : "Skincare Fri" },
  ];
  return html`
    <section class="bf-hero" aria-labelledby="bf-title">
      <p class="eyebrow">Nov 23 – 30 only</p>
      <h1 id="bf-title">Black <em>Friday</em></h1>
      <p class="bf-sub">${live
        ? html`Skincare is now ${PCT}% off with free shipping. <strong>Save up to ${money(savingsCents)}.</strong>`
        : html`Our biggest savings of the year. <strong>Save up to ${money(savingsCents)}.</strong>`}</p>
      ${cardStack({
        back: html`<img src="${LOGO}" alt="" class="bf-card-logo" /><span class="bf-card-row"><small>Gift card</small><b>${dollars(GIFT.amounts[GIFT.amounts.length - 1])}</b></span>`,
        front: html`<img src="${LOGO}" alt="" class="bf-card-logo" /><span class="bf-card-row"><small>Gift card</small><b>${dollars(giftShown)}</b></span>`,
        seal: `${GIFT.percent}%`,
      })}
      <p class="bf-clock-label">Ends Mon, Nov 30 at 11:59 PM</p>
      ${countdown(BLACK_FRIDAY.endUtc, now)}
      <nav class="bf-jump" aria-label="Black Friday offers">
        ${chips.map((chip) => html`<a href="${chip.href}"><b>${chip.big}</b>${chip.small}</a>`)}
      </nav>
    </section>
  `;
}

function packagesSection(pkg) {
  const variation = pkg?.defaultVariation;
  const soldOut = pkg && !pkg.available;
  const { priceCents, savingsCents } = packagePrice(pkg);
  return html`
    <section class="bf-block" id="packages" aria-labelledby="bf-packages-title">
      <h2 class="bf-block-title" id="bf-packages-title">Treatment <em>packages</em></h2>
      ${cardStack({
        back: html`<img src="${LOGO}" alt="" class="bf-card-logo" /><small>Homecare kit</small>`,
        front: html`
          <span class="bf-card-row bf-card-top"><img src="${LOGO}" alt="" class="bf-card-logo" /><small>Series of 4</small></span>
          <span class="bf-card-name">Liquid Microneedling</span>
          <span class="bf-sessions"><i>1</i><i>2</i><i>3</i><i>4</i><em>+ homecare</em></span>`,
        seal: money(savingsCents),
      })}
      <article class="bf-offer">
        <span class="bf-flag">Save ${money(savingsCents)}</span>
        <p class="eyebrow">Black Friday package</p>
        <h3>${OFFER.title}</h3>
        <ul class="bf-includes">
          <li><span>Four Liquid Microneedling treatments</span><s>${money(OFFER.treatmentValueCents)}</s></li>
          <li><span>Pre- and post-treatment homecare</span><s>${money(OFFER.homecareValueCents)}</s></li>
          <li><span>Treatment plan and guidance</span><b>Included</b></li>
        </ul>
        <p class="bf-price">${wasNow(money(OFFER.totalValueCents), money(priceCents), { big: true })}</p>
        ${variation
          ? html`<button class="button button-dark bf-cta" type="button" data-add-to-cart="${variation.id}" data-name="${OFFER.title}"
              ${soldOut ? html`disabled` : ""}>${soldOut ? "Sold out" : html`Add to bag · ${money(priceCents)}`}</button>`
          : html`<a class="button button-dark bf-cta" href="mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(OFFER.title)}">Email Laura to reserve</a>`}
        <p class="bf-fine">Pay online. Laura contacts you to schedule your four visits in Tampa.</p>
      </article>
    </section>
  `;
}

function giftSection() {
  return html`
    <article class="bf-offer" id="gift-cards">
      <span class="bf-flag">${GIFT.percent}% off</span>
      <p class="eyebrow">Gift cards</p>
      <h3>Gift cards ${GIFT.percent}% off</h3>
      <div class="bf-amounts">
        ${GIFT.amounts.map((cents) => html`
          <a href="${EGIFT_URL}" data-bf-copy-go="${GIFT.code}">
            <small>${dollars(cents)} card</small>
            ${wasNow(dollars(cents), money(giftPrice(cents)))}
          </a>`)}
      </div>
      <div class="bf-code">
        <span>Code</span>
        <strong data-bf-code>${GIFT.code}</strong>
        <button type="button" data-bf-copy="${GIFT.code}" hidden>Copy</button>
      </div>
      <a class="button button-dark bf-cta" href="${EGIFT_URL}" data-bf-copy-go="${GIFT.code}">Buy a gift card</a>
      <p class="bf-fine" data-bf-copy-note>Enter ${GIFT.code} at checkout. For treatments or skincare.</p>
    </article>
  `;
}

function skincareSection(phase, products, notified) {
  const live = phase === "sale";
  // Two real examples, so "15% off" has prices attached.
  const examples = products.filter((product) => product.available && product.regularPriceCents > 0).slice(0, 2);
  return html`
    <article class="bf-offer" id="skincare">
      <span class="bf-flag">${PCT}% off</span>
      <p class="eyebrow">${live ? "Live now · Ends Mon, Nov 30" : "Starts Fri, Nov 27"}</p>
      <h3>${PCT}% off all skincare + free shipping</h3>
      ${examples.length ? html`
        <div class="bf-examples">
          ${examples.map((product) => html`
            <a href="/product/${encodeURIComponent(product.slug)}"><span>${product.name}</span>
              ${wasNow(formatMoney(product.regularPriceCents), formatMoney(live ? product.priceCents : salePrice(product.regularPriceCents)))}</a>`)}
        </div>` : ""}
      ${live
        ? html`<a class="button button-dark bf-cta" href="/shop">Shop ${PCT}% off skincare</a>
            <p class="bf-fine">Taken off automatically. No code, no minimum.</p>`
        : notified
        ? html`<p class="bf-done" role="status"><strong>You&#8217;re on the list.</strong> We&#8217;ll email you Friday morning when skincare goes ${PCT}% off.</p>`
        : html`
          <form class="bf-notify" method="post" action="/api/notify" data-bf-notify>
            <label class="sr-only" for="bf-notify-email">Email</label>
            <input id="bf-notify-email" type="email" name="email" placeholder="Your email" autocomplete="email" required />
            <input class="bf-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
            <button class="button button-dark bf-cta" type="submit">Email me when it starts</button>
            <p class="bf-fine" data-bf-notify-note>One email Friday morning. That&#8217;s it.</p>
          </form>
          <p class="bf-done" role="status" data-bf-notify-done hidden><strong>You&#8217;re on the list.</strong> We&#8217;ll email you Friday morning when skincare goes ${PCT}% off.</p>`}
    </article>
  `;
}

function productTile(product, live) {
  const variation = product.defaultVariation;
  const regular = product.regularPriceCents;
  // During the sale Square has already priced it. Before, show what it will be.
  const sale = live ? product.priceCents : salePrice(regular);
  return html`
    <article class="bf-product">
      <a href="/product/${encodeURIComponent(product.slug)}">
        <div class="bf-product-image">
          <span class="bf-product-tag">−${PCT}%</span>
          ${product.image
            ? html`<img src="${product.image}" alt="${product.name}" loading="lazy" />`
            : html`<span class="bf-product-empty">${product.name}</span>`}
        </div>
        <h3>${product.name}</h3>
        <p class="bf-product-price">
          ${live
            ? wasNow(formatMoney(regular), formatMoney(sale))
            : html`${formatMoney(regular)}<small>${formatMoney(sale)} from Friday</small>`}
        </p>
      </a>
      <button class="bf-product-add" type="button" data-add-to-cart="${variation.id}" data-name="${product.name}"
        ${product.available ? "" : html`disabled`}>${product.available ? "Add to bag" : "Sold out"}</button>
    </article>
  `;
}

function productsSection(phase, products) {
  const live = phase === "sale";
  // Products arrive best-sellers first. During the sale, only what is on sale.
  const shown = products
    .filter((product) => product.available && product.defaultVariation && (!live || product.regularPriceCents > product.priceCents))
    .slice(0, 8);
  if (!shown.length) return "";
  return html`
    <section class="bf-block" id="sale-products" aria-labelledby="bf-products-title">
      <div class="bf-block-head">
        <h2 class="bf-block-title" id="bf-products-title">${PCT}% off <em>${live ? "skincare" : "Friday"}</em></h2>
        <a class="text-link" href="/shop">Shop all</a>
      </div>
      <p class="bf-block-sub">${live
        ? "Taken off automatically. Free U.S. shipping, no minimum."
        : "Sale prices start Fri, Nov 27. Add to your bag now or come back Friday."}</p>
      <div class="bf-products">${shown.map((product) => productTile(product, live))}</div>
    </section>
  `;
}

/** The homepage while the campaign runs. The usual sections follow it. */
export function blackFridayHome({ phase, pkg = null, products = [], now = null, notified = false }) {
  if (!phase) return "";
  return html`
    <div class="bf-home section-shell" data-bf>
      ${hero(phase, pkg, now)}
      ${packagesSection(pkg)}
      <div class="bf-offers">
        ${giftSection()}
        ${skincareSection(phase, products, notified)}
      </div>
      ${productsSection(phase, products)}
      <p class="bf-terms-link"><a href="/terms#black-friday">Promotion terms</a></p>
    </div>
  `;
}

/** Bottom bar on phones, on the homepage, so the deals are one tap away anywhere on it. */
export function stickyDeals(phase, pkg = null) {
  if (!phase) return "";
  const { priceCents } = packagePrice(pkg);
  return html`
    <div class="bf-sticky" data-bf-sticky>
      ${phase === "sale"
        ? html`<p><b>${PCT}% off skincare</b>Free U.S. shipping · Ends Mon</p><a class="button button-dark" href="/shop">Shop sale</a>`
        : html`<p><b>Black Friday</b>Microneedling series ${money(priceCents)} (was ${money(OFFER.totalValueCents)})</p><a class="button button-dark" href="#packages">See deals</a>`}
    </div>
  `;
}

/** The promotional terms, shown on the Terms page while the campaign runs. */
export function campaignTerms() {
  return [
    `All Black Friday offers run from November 23, 2026 and end ${BLACK_FRIDAY.endLabel}.`,
    `The skincare sale and free shipping run November 27 to 30 only: ${PCT}% off eligible skincare products, applied automatically at checkout, with free standard U.S. shipping and no minimum purchase.`,
    "The skincare discount does not apply to services, treatment packages, memberships or gift cards.",
    "Offers cannot be combined with other discounts, promotions or coupon codes.",
    "The Liquid Microneedling series is purchased online and its four treatments are scheduled with Laura at the Tampa studio.",
    `Gift cards are ${GIFT.percent}% off from November 23 to 30 when the code ${GIFT.code} is entered on the gift card purchase page. The discount is not applied without the code. Gift cards can be used toward both services and skincare products.`,
    "Packages and gift card balances purchased during the event remain valid after it ends.",
  ];
}
