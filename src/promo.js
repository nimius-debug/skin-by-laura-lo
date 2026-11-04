// The scrolling sale banner at the top of every page. It is built from the
// live Square sales already on the catalog (see activeSales in square.js), so
// it appears when a sale starts in the dashboard and disappears when it ends.

import { html, raw } from "./html.js";

// Sale names that get the Halloween look instead of the everyday brass one.
const SPOOKY_NAME = /hallo|spook|witch|pumpkin|fright|haunt|\bboo\b|trick or treat/i;

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const WEEKDAY_LONG = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

/**
 * The sale to announce, or null. When several run at once, the one covering
 * the most products wins. Products carry the sale of their default option,
 * which is the same sale for every option of a category-wide discount.
 */
export function salePromo(products) {
  const groups = new Map();
  for (const product of products || []) {
    const sale = product.sale || product.variations?.find((variation) => variation.sale)?.sale;
    if (!sale) continue;
    const group = groups.get(sale.discountId) || { sale, products: [] };
    group.products.push(product);
    groups.set(sale.discountId, group);
  }

  let best = null;
  for (const group of groups.values()) {
    if (!best || group.products.length > best.products.length) best = group;
  }
  if (!best) return null;

  const { sale } = best;
  const categories = new Set(best.products.map((product) => product.category));
  const category = categories.size === 1 ? [...categories][0] : null;
  // "every mask" only when the whole category is on sale, not just a few of it.
  const wholeCategory = category
    && products.filter((product) => product.category === category).every((product) => best.products.includes(product));

  let what;
  let shopLabel;
  let href;
  if (best.products.length === 1) {
    what = best.products[0].name;
    shopLabel = "Shop now";
    href = `/product/${encodeURIComponent(best.products[0].slug)}`;
  } else if (category) {
    const noun = category.toLowerCase();
    what = wholeCategory ? `every ${noun.replace(/s$/, "")}` : `select ${noun}`;
    shopLabel = `Shop ${noun}`;
    href = `/shop?category=${encodeURIComponent(category)}`;
  } else {
    what = "select favorites";
    shopLabel = "Shop the sale";
    href = "/shop";
  }

  const day = sale.lastDay ? new Date(`${sale.lastDay}T12:00:00Z`) : null;
  return {
    name: sale.name,
    offer: `${sale.label} ${what}`,
    until: day ? `Through ${WEEKDAY.format(day)}` : "",
    untilLong: day ? `through ${WEEKDAY_LONG.format(day)}` : "",
    shopLabel,
    href,
    spooky: SPOOKY_NAME.test(sale.name),
  };
}

// Small icons that separate the phrases, drawn once as symbols and reused, so
// six runs of the marquee don't repeat the paths. Decorative: the marquee is
// aria-hidden and the link carries its own sr-only text.
const SYMBOLS = {
  bat: ["0 0 24 12", '<path fill="currentColor" d="M12 3.2c.6-.9 1.2-1.4 1.5-1.2.2.4-.1 1.2-.3 1.6 1.7-.6 3.8-2 5.8-3.6-.4 1.6-.2 2.8.8 3.4 1.2.6 2.6.1 4.2-.6-1.9 2.3-3.8 4.3-6.2 4.6-.1-.9-.8-1.6-1.8-1.4-.8.2-1.3 1.1-1.3 2.6-1 .6-2 1.6-2.7 3.4-.7-1.8-1.7-2.8-2.7-3.4 0-1.5-.5-2.4-1.3-2.6-1-.2-1.7.5-1.8 1.4C3.8 6.9 1.9 4.9 0 2.6c1.6.7 3 1.2 4.2.6 1-.6 1.2-1.8.8-3.4 2 1.6 4.1 3 5.8 3.6-.2-.4-.5-1.2-.3-1.6.3-.2.9.3 1.5 1.2Z"/>'],
  pumpkin: ["0 0 20 20", '<path fill="#6f8a4a" d="M9.2 1.5c.9-.4 2.1-.2 2.6.4l-1.2 2.6H9.4Z"/><path fill="currentColor" d="M10 4.6c-1.1-.9-3.1-1-4.7-.2C2.6 5.6 1.2 8.6 1.6 12c.4 3.6 2.7 6.4 5.6 6.4 1 0 1.9-.3 2.8-.9.9.6 1.8.9 2.8.9 2.9 0 5.2-2.8 5.6-6.4.4-3.4-1-6.4-3.7-7.6-1.6-.8-3.6-.7-4.7.2Z"/><path fill="#1d1726" d="M5.6 9.6 7.6 8l.9 2.4Zm8.8 0L12.4 8l-.9 2.4ZM5 12.6c1.4 1.6 3.1 2.4 5 2.4s3.6-.8 5-2.4l-1.6.4-.7 1-.9-.9-.9 1-.9-1-.9.9-.7-1Z"/>'],
  ghost: ["0 0 16 20", '<path fill="currentColor" d="M8 .8C4 .8 1.2 3.8 1.2 7.8v11l2.3-1.6 2.2 1.6L8 17.2l2.3 1.6 2.2-1.6 2.3 1.6v-11C14.8 3.8 12 .8 8 .8Z"/><circle cx="5.6" cy="8" r="1.2" fill="#1d1726"/><circle cx="10.4" cy="8" r="1.2" fill="#1d1726"/><ellipse cx="8" cy="11.6" rx="1.3" ry="1.6" fill="#1d1726"/>'],
  moon: ["0 0 16 16", '<path fill="currentColor" d="M10.6 1.2A7 7 0 1 0 14.8 11 6 6 0 0 1 10.6 1.2Z"/>'],
  spark: ["0 0 12 12", '<path fill="currentColor" d="M6 0 7.3 4.7 12 6 7.3 7.3 6 12 4.7 7.3 0 6 4.7 4.7Z"/>'],
};
const SIZES = { bat: [22, 11], pumpkin: [16, 16], ghost: [13, 16], moon: [13, 13], spark: [10, 10] };

function sprite(names) {
  return raw(`<svg class="promo-sprite" aria-hidden="true" focusable="false">${names
    .map((name) => `<symbol id="promo-${name}" viewBox="${SYMBOLS[name][0]}">${SYMBOLS[name][1]}</symbol>`)
    .join("")}</svg>`);
}

function icon(name) {
  const [width, height] = SIZES[name];
  return raw(`<span class="promo-icon promo-icon-${name}"><svg width="${width}" height="${height}" focusable="false"><use href="#promo-${name}"/></svg></span>`);
}

function phrases(promo) {
  const list = [
    html`<strong>${promo.name}</strong>`,
    html`<span>${promo.offer}</span>`,
    promo.until ? html`<span>${promo.until}</span>` : "",
    promo.spooky ? html`<em>Treat your skin, no tricks</em>` : "",
    html`<span class="promo-cta">${promo.shopLabel} <span class="promo-arrow">&rarr;</span></span>`,
  ];
  return list.filter(Boolean);
}

const SPOOKY_ICONS = ["pumpkin", "bat", "ghost", "moon", "bat"];

function group(promo) {
  const icons = promo.spooky ? SPOOKY_ICONS : ["spark"];
  return phrases(promo).map((phrase, index) => html`${phrase}${icon(icons[index % icons.length])}`);
}

export function promoBanner(promo) {
  if (!promo) return "";
  // One run of phrases is about 700px wide; three per half keeps a 2560px
  // screen covered while the track slides by exactly one half.
  const half = html`<span class="promo-run">${group(promo)}${group(promo)}${group(promo)}</span>`;
  return html`
    <div class="promo${promo.spooky ? " promo-spooky" : ""}" data-promo>
      ${sprite(promo.spooky ? ["pumpkin", "bat", "ghost", "moon"] : ["spark"])}
      <a class="promo-link" href="${promo.href}">
        <span class="sr-only">${promo.name}: ${promo.offer}${promo.untilLong ? ` ${promo.untilLong}` : ""}. ${promo.shopLabel}.</span>
        <span class="promo-marquee" aria-hidden="true"><span class="promo-track">${half}${half}</span></span>
        <span class="promo-static" aria-hidden="true">
          ${promo.spooky ? icon("pumpkin") : ""}
          <span>${promo.offer}</span>
          ${promo.until ? html`<span class="promo-dot promo-static-until">&middot;</span><span class="promo-static-until">${promo.until}</span>` : ""}
          <span class="promo-dot">&middot;</span><span class="promo-cta">${promo.shopLabel} &rarr;</span>
        </span>
      </a>
      <button class="promo-pause" type="button" aria-label="Pause scrolling sale banner" aria-pressed="false" data-promo-pause hidden>
        <span class="promo-pause-icon" aria-hidden="true"></span>
      </button>
    </div>
  `;
}
