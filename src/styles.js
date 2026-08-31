// "Editorial Boutique" design system — ported from the reference build's
// globals.css, with the Tailwind import dropped (nothing here needed it).
// Served as a standalone, long-cached stylesheet.

export const STYLES = `
:root {
  --paper: #fbf8f3;
  --cream: #f5f0e8;
  --white: #fffefa;
  --ink: #20231f;
  --muted: #6e7068;
  --clay: #a95f49;
  --clay-deep: #7e3f31;
  --sage: #88927c;
  --line: rgba(32, 35, 31, 0.16);
  --panel-taupe: #e5dfd2;
  --panel-stone: #e8ddd0;
  --panel-product: #e9e4dc;
  --panel-sage: #d8dfd3;
  --font-serif: Georgia, "Times New Roman", serif;
  --font-sans: "Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif;
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--font-sans); }
a { color: inherit; text-decoration: none; }
button, input, select, textarea { font: inherit; }
img { display: block; max-width: 100%; }
h1, h2, h3, p { margin-top: 0; }
h1, h2 { font-family: var(--font-serif); font-weight: 400; letter-spacing: -.045em; }
h1 em, h2 em { font-weight: 400; font-style: italic; color: var(--clay); }
:focus-visible { outline: 2px solid var(--clay); outline-offset: 3px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.skip-link { position: absolute; left: -9999px; top: 0; z-index: 100; padding: 12px 18px; background: var(--ink); color: var(--white); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
.skip-link:focus { left: 8px; top: 8px; }

.section-shell { width: min(1240px, calc(100% - 48px)); margin-inline: auto; }
.eyebrow { margin: 0 0 22px; font-size: 10px; letter-spacing: .25em; font-weight: 650; text-transform: uppercase; color: var(--clay-deep); }
.button { min-height: 52px; padding: 0 22px; display: inline-flex; align-items: center; justify-content: center; gap: 18px; border: 1px solid transparent; font-size: 11px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; transition: transform .2s ease, background .2s ease; cursor: pointer; }
.button:hover { transform: translateY(-2px); }
.button-dark { background: var(--ink); color: var(--white); }
.button-light { background: var(--paper); color: var(--ink); border-color: var(--line); }
.button-row { display: flex; align-items: center; gap: 30px; flex-wrap: wrap; }
.text-link { display: inline-flex; align-items: center; gap: 12px; padding-bottom: 4px; border-bottom: 1px solid currentColor; font-size: 11px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; }
.stars { color: var(--clay); letter-spacing: .16em; font-size: 11px; }

.announcement { min-height: 34px; padding: 8px 24px; display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--ink); color: #f6eee5; font-size: 11px; letter-spacing: .11em; text-transform: uppercase; text-align: center; }
.site-header { height: 88px; padding: 0 44px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 1px solid var(--line); background: rgba(251,248,243,.92); backdrop-filter: blur(18px); position: sticky; top: 0; z-index: 40; }
.brand { display: flex; flex-direction: column; width: max-content; line-height: 1; }
.brand span { font-size: 8px; letter-spacing: .36em; margin-left: 3px; margin-bottom: 4px; }
.brand strong { font-family: var(--font-serif); font-weight: 400; font-size: 25px; letter-spacing: -.03em; }
.site-header nav { grid-column: 2 / 4; display: flex; justify-content: flex-end; align-items: center; gap: 31px; font-size: 12px; letter-spacing: .05em; text-transform: uppercase; }
.site-header nav a { transition: color .2s ease; }
.site-header nav a:hover, .site-header nav a[aria-current="page"] { color: var(--clay); }
.nav-book { border-bottom: 1px solid currentColor; padding-bottom: 4px; }
.cart-link { display: flex; align-items: center; gap: 8px; }
.cart-link span { width: 25px; height: 25px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: var(--white); font-size: 10px; }
.menu-button { display: none; }

.hero { min-height: 750px; display: grid; grid-template-columns: .92fr 1.08fr; gap: 8%; align-items: center; padding-top: 70px; padding-bottom: 80px; overflow: hidden; }
h1 { margin-bottom: 28px; font-size: clamp(64px, 7vw, 104px); line-height: .89; }
.hero-lede { max-width: 590px; margin-bottom: 34px; font-size: 18px; line-height: 1.7; color: var(--muted); }
.hero-proof { margin-top: 38px; display: flex; align-items: center; gap: 15px; color: var(--muted); font-size: 11px; letter-spacing: .04em; }
.hero-visual { min-height: 610px; position: relative; }
.hero-orbit { position: absolute; border: 1px solid rgba(169,95,73,.22); border-radius: 50%; }
.hero-orbit-one { width: 520px; height: 520px; right: 0; top: 25px; }
.hero-orbit-two { width: 340px; height: 340px; right: 90px; top: 115px; }
.hero-card { position: absolute; overflow: hidden; background: var(--panel-stone); box-shadow: 0 30px 70px rgba(72,52,42,.15); }
.hero-card img { width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply; }
.hero-card-label { position: absolute; top: 18px; left: 18px; z-index: 2; padding: 7px 9px; background: rgba(255,254,250,.84); font-size: 8px; letter-spacing: .16em; text-transform: uppercase; }
.hero-card-tall { width: min(390px, 66%); height: 520px; right: 70px; top: 20px; transform: rotate(2.5deg); }
.hero-card-small { width: 210px; height: 275px; left: 0; bottom: 20px; transform: rotate(-5deg); background: #dce3dc; }
.hero-handwritten { position: absolute; right: 0; bottom: 0; width: 185px; font-family: var(--font-serif); font-size: 20px; line-height: 1.15; font-style: italic; color: var(--clay); transform: rotate(-5deg); }

.marquee { overflow: hidden; background: var(--clay); color: #fff9f2; }
.marquee div { min-height: 58px; width: max-content; padding: 0 24px; display: flex; align-items: center; gap: 30px; font-family: var(--font-serif); font-size: 17px; animation: marquee-scroll 38s linear infinite; }
.marquee i { font-style: normal; opacity: .6; font-size: 10px; }
@keyframes marquee-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) {
  .marquee div { animation: none; }
  * { scroll-behavior: auto !important; }
}

.approach { display: grid; grid-template-columns: 1.15fr .85fr; gap: 13%; padding-top: 135px; padding-bottom: 140px; }
.approach h2, .section-heading h2, .visit h2 { max-width: 720px; margin-bottom: 0; font-size: clamp(44px, 5.2vw, 72px); line-height: 1.03; }
.approach-copy { padding-top: 34px; }
.approach-copy p { font-size: 16px; line-height: 1.75; color: var(--muted); }
.approach-copy .text-link { margin-top: 16px; }

.services-block { padding: 125px 0; background: var(--panel-taupe); }
.section-heading { margin-bottom: 64px; }
.split-heading { display: grid; grid-template-columns: 1.25fr .75fr; gap: 13%; align-items: end; }
.split-heading > p, .split-heading > div:last-child > p { max-width: 420px; margin: 0 0 18px; color: var(--muted); line-height: 1.65; font-size: 14px; }
.service-list { border-top: 1px solid var(--line); }
.service-row { min-height: 145px; display: grid; grid-template-columns: 70px 1.1fr 1.3fr .65fr 35px; gap: 30px; align-items: center; border-bottom: 1px solid var(--line); transition: padding .25s ease, color .25s ease; }
.service-row:hover { padding-inline: 12px; color: var(--clay-deep); }
.service-number { font-family: var(--font-serif); font-size: 13px; color: var(--clay); }
.service-row h3 { margin: 0; font-family: var(--font-serif); font-size: 30px; font-weight: 400; }
.service-row p { margin: 0; max-width: 410px; color: var(--muted); font-size: 13px; line-height: 1.65; }
.service-note { font-size: 9px; letter-spacing: .14em; text-transform: uppercase; }
.service-arrow { font-size: 19px; }

.shop-preview { padding-top: 135px; padding-bottom: 145px; }
.product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; }
.product-card { min-width: 0; height: 100%; display: flex; flex-direction: column; }
.product-card > a { display: block; }
.product-image-wrap { aspect-ratio: .86; position: relative; overflow: hidden; background: var(--panel-product); }
.product-image-wrap img { width: 100%; height: 100%; padding: 9%; object-fit: contain; mix-blend-mode: multiply; transition: transform .45s ease; }
.product-card:hover img { transform: scale(1.045); }
.product-image-fallback { width: 100%; height: 100%; display: grid; place-items: center; font-family: var(--font-serif); font-size: 13px; font-style: italic; color: var(--muted); }
.product-badge { position: absolute; z-index: 2; top: 14px; left: 14px; padding: 7px 9px; background: var(--ink); color: var(--white); font-size: 8px; letter-spacing: .12em; text-transform: uppercase; }
.product-badge-soldout { background: var(--paper); color: var(--muted); border: 1px solid var(--line); }
.product-quick { position: absolute; left: 12px; right: 12px; bottom: 12px; padding: 14px; text-align: center; background: rgba(255,254,250,.94); font-size: 9px; letter-spacing: .13em; text-transform: uppercase; transform: translateY(70px); transition: transform .3s ease; }
.product-card:hover .product-quick { transform: translateY(0); }
.product-info { padding: 17px 2px 12px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.product-category { margin-bottom: 6px; font-size: 8px; letter-spacing: .16em; text-transform: uppercase; color: var(--clay-deep); }
.product-info h3 { margin: 0; font-family: var(--font-serif); font-size: 18px; font-weight: 400; line-height: 1.25; }
.product-price { margin: 1px 0 0; font-size: 12px; white-space: nowrap; }

.results-callout { padding: 135px 0; text-align: center; background: var(--clay-deep); color: var(--white); }
.results-inner { display: flex; flex-direction: column; align-items: center; }
.results-callout .eyebrow { color: #e8bbaa; }
.results-callout h2 { margin: 0 0 26px; font-size: clamp(58px, 7vw, 98px); line-height: .9; }
.results-callout h2 em { color: #e8bbaa; }
.results-callout p:not(.eyebrow) { max-width: 500px; margin-bottom: 34px; line-height: 1.7; color: #e5d1ca; }

.reviews { padding-top: 135px; padding-bottom: 140px; }
.rating-large { display: flex; align-items: center; gap: 20px; }
.rating-large > span { font-family: var(--font-serif); font-size: 58px; line-height: 1; }
.rating-large small { color: var(--clay); font-size: 10px; line-height: 1.8; letter-spacing: .07em; }
.review-grid { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--line); }
.review-grid blockquote { margin: 0; min-height: 320px; padding: 38px 38px 30px 0; border-right: 1px solid var(--line); }
.review-grid blockquote + blockquote { padding-left: 38px; }
.review-grid blockquote:last-child { border-right: 0; }
.quote-mark { font-family: var(--font-serif); font-size: 56px; line-height: .7; color: var(--clay); }
.review-grid blockquote p { margin-top: 24px; font-family: var(--font-serif); font-size: 22px; line-height: 1.45; }
.review-grid footer { margin-top: 28px; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }

.visit { padding-bottom: 130px; }
.visit-card { padding: 70px; display: grid; grid-template-columns: 1.25fr .75fr; gap: 10%; align-items: end; background: var(--panel-sage); }
.visit-card > div > p:not(.eyebrow) { margin: 28px 0 0; line-height: 1.7; color: var(--muted); }
.visit-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 28px; }
.hours-list { margin: 26px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
.hours-list li { padding: 11px 0; display: flex; justify-content: space-between; gap: 20px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--muted); }
.hours-list li strong { font-weight: 500; color: var(--ink); }

.site-footer { background: var(--ink); color: #f6f1e8; }
.footer-main { padding-top: 105px; padding-bottom: 90px; display: grid; grid-template-columns: 1fr 1fr; gap: 10%; }
.footer-brand .eyebrow { color: #d69d8b; }
.footer-brand h2 { max-width: 570px; margin-bottom: 35px; font-size: clamp(44px, 5vw, 70px); line-height: .96; }
.footer-links { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; padding-top: 20px; }
.footer-links div { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
.footer-links p { margin-bottom: 10px; color: #d69d8b; font-size: 9px; letter-spacing: .18em; text-transform: uppercase; }
.footer-links a { color: #bdbdb5; font-size: 12px; line-height: 1.65; }
.footer-links a:hover { color: var(--white); }
.footer-bottom { min-height: 74px; display: flex; align-items: center; justify-content: space-between; gap: 20px; border-top: 1px solid rgba(255,255,255,.14); color: #94968e; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; }
.footer-bottom div { display: flex; gap: 25px; }

.shop-page { padding-bottom: 120px; }
.shop-hero { padding-top: 90px; padding-bottom: 75px; border-bottom: 1px solid var(--line); }
.shop-hero > div { display: grid; grid-template-columns: 1fr .72fr; gap: 10%; align-items: end; }
.shop-hero h1 { margin: 0; font-size: clamp(68px, 9vw, 126px); }
.shop-hero > div > p { max-width: 500px; margin: 0 0 13px; color: var(--muted); font-size: 16px; line-height: 1.75; }
.shop-catalog { padding-top: 45px; }
.shop-controls { display: flex; align-items: center; justify-content: space-between; gap: 30px; margin-bottom: 22px; }
.filter-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.filter-pills button { padding: 9px 14px; border: 1px solid var(--line); border-radius: 30px; background: transparent; color: var(--muted); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; cursor: pointer; }
.filter-pills button:hover, .filter-pills button.active { background: var(--ink); border-color: var(--ink); color: var(--white); }
.shop-search { min-width: 250px; display: flex; align-items: center; border-bottom: 1px solid var(--ink); }
.shop-search input { width: 100%; padding: 11px 5px; border: 0; outline: none; background: transparent; font-size: 12px; }
.shop-count { margin-bottom: 32px; color: var(--muted); font-size: 9px; letter-spacing: .13em; text-transform: uppercase; }
.shop-product-grid { row-gap: 65px; }
.product-short { max-width: 250px; margin: 8px 0 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
.add-button { width: 100%; margin-top: auto; padding: 12px 0; display: flex; justify-content: space-between; border: 0; border-top: 1px solid var(--line); background: transparent; color: var(--ink); font-size: 9px; letter-spacing: .13em; text-transform: uppercase; cursor: pointer; }
.add-button:hover { color: var(--clay-deep); }
.add-button:disabled { color: var(--muted); cursor: not-allowed; }
.shop-empty { min-height: 360px; display: grid; place-items: center; align-content: center; text-align: center; border: 1px solid var(--line); padding: 40px; }
.shop-empty h2 { margin-bottom: 8px; font-size: 44px; }
.shop-empty p { color: var(--muted); max-width: 460px; }
.shop-empty button { margin-top: 10px; background: transparent; border: 0; cursor: pointer; }
.product-help { margin-top: 140px; padding: 70px; display: grid; grid-template-columns: 1fr .8fr; gap: 10%; align-items: center; background: var(--panel-sage); }
.product-help h2, .related-products h2 { margin: 0; font-size: clamp(42px, 5vw, 68px); line-height: .98; }
.product-help > div:last-child > p { margin-bottom: 28px; color: var(--muted); line-height: 1.7; }

.cart-toast { position: fixed; z-index: 80; right: 24px; top: 142px; max-width: 390px; padding: 17px 20px; display: flex; gap: 24px; align-items: center; background: var(--ink); color: var(--white); box-shadow: 0 16px 38px rgba(0,0,0,.18); font-size: 12px; }
.cart-toast a { border-bottom: 1px solid currentColor; white-space: nowrap; }

.product-page { padding-top: 75px; padding-bottom: 130px; display: grid; grid-template-columns: 1.08fr .92fr; gap: 9%; align-items: start; }
.product-gallery { min-height: 680px; position: sticky; top: 150px; display: grid; place-items: center; background: var(--panel-product); }
.product-gallery img { width: 100%; height: 680px; padding: 8%; object-fit: contain; mix-blend-mode: multiply; }
.product-details { padding-top: 12px; }
.breadcrumbs { margin-bottom: 68px; display: flex; gap: 9px; color: var(--muted); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; flex-wrap: wrap; }
.product-details .eyebrow { margin-bottom: 14px; }
.product-details h1 { margin-bottom: 17px; font-size: clamp(52px, 6vw, 78px); line-height: .96; }
.product-detail-price { margin-bottom: 28px; font-size: 15px; letter-spacing: .04em; }
.product-detail-short { margin-bottom: 18px; font-family: var(--font-serif); font-size: 25px; line-height: 1.3; color: var(--clay-deep); }
.product-description { font-size: 14px; line-height: 1.75; color: var(--muted); }
.variation-picker { margin: 26px 0 0; padding: 0; border: 0; }
.variation-picker legend { margin-bottom: 12px; font-size: 9px; letter-spacing: .13em; text-transform: uppercase; }
.variation-picker div { display: flex; flex-wrap: wrap; gap: 8px; }
.variation-picker button { padding: 11px 16px; border: 1px solid var(--line); background: transparent; font-size: 11px; cursor: pointer; }
.variation-picker button.active { border-color: var(--ink); background: var(--ink); color: var(--white); }
.variation-picker button:disabled { color: var(--muted); text-decoration: line-through; cursor: not-allowed; }
.product-buy { margin: 28px 0 22px; display: grid; grid-template-columns: 120px 1fr; gap: 12px; }
.quantity-control { min-height: 50px; display: grid; grid-template-columns: repeat(3, 1fr); align-items: center; border: 1px solid var(--line); text-align: center; }
.quantity-control button { height: 100%; border: 0; background: transparent; cursor: pointer; }
.quantity-control span { font-size: 12px; }
.product-add { width: 100%; }
.added-message { grid-column: 1 / -1; margin: 4px 0 0; padding: 12px 14px; background: var(--panel-sage); font-size: 11px; }
.added-message a { border-bottom: 1px solid currentColor; }
.buy-reassurance { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 24px; color: var(--muted); font-size: 8px; letter-spacing: .06em; flex-wrap: wrap; }
.product-details details { border-top: 1px solid var(--line); }
.product-details details:last-child { border-bottom: 1px solid var(--line); }
.product-details summary { padding: 19px 0; list-style: none; cursor: pointer; font-size: 10px; letter-spacing: .13em; text-transform: uppercase; }
.product-details summary::-webkit-details-marker { display: none; }
.product-details details p { padding-right: 20px; color: var(--muted); font-size: 12px; line-height: 1.7; }
.related-products { padding-bottom: 135px; }
.related-products h2 { margin-bottom: 45px; }
.related-products .product-grid { grid-template-columns: repeat(3, 1fr); }

.cart-page { padding-top: 80px; padding-bottom: 135px; }
.cart-heading { margin-bottom: 60px; }
.cart-heading h1 { margin: 0; font-size: clamp(58px, 7vw, 90px); }
.cart-layout { display: grid; grid-template-columns: 1.28fr .72fr; gap: 8%; align-items: start; }
.cart-row { padding: 24px 0; display: grid; grid-template-columns: 145px 1fr auto; gap: 25px; border-top: 1px solid var(--line); }
.cart-row:last-of-type { border-bottom: 1px solid var(--line); }
.cart-image { height: 160px; display: grid; place-items: center; background: var(--panel-product); }
.cart-image img { width: 100%; height: 100%; padding: 9%; object-fit: contain; mix-blend-mode: multiply; }
.cart-item-info h2 { margin: 0 0 8px; font-size: 23px; font-weight: 400; }
.cart-item-info > p:not(.product-category) { color: var(--muted); font-size: 11px; }
.cart-item-info .quantity-control { width: 105px; min-height: 36px; margin-top: 17px; }
.cart-item-end { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 12px; }
.cart-item-end strong { font-size: 13px; font-weight: 500; }
.cart-item-end button { padding: 0 0 3px; border: 0; border-bottom: 1px solid currentColor; background: transparent; color: var(--muted); font-size: 9px; text-transform: uppercase; cursor: pointer; }
.continue-shopping { margin-top: 28px; }
.cart-summary { padding: 34px; position: sticky; top: 145px; background: var(--panel-product); }
.cart-summary > h2 { margin-bottom: 30px; font-size: 32px; }
.fulfillment-options { margin: 0; padding: 0 0 24px; border: 0; border-bottom: 1px solid var(--line); }
.fulfillment-options legend { margin-bottom: 13px; font-size: 9px; letter-spacing: .13em; text-transform: uppercase; }
.fulfillment-options label { padding: 15px 13px; display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; border: 1px solid transparent; cursor: pointer; }
.fulfillment-options label.selected { border-color: var(--ink); background: rgba(255,255,255,.38); }
.fulfillment-options input { accent-color: var(--ink); }
.fulfillment-options label > span { font-size: 11px; }
.fulfillment-options strong, .fulfillment-options small { display: block; }
.fulfillment-options small { margin-top: 3px; color: var(--muted); font-size: 9px; }
.shipping-progress { padding: 20px 0 8px; }
.shipping-progress > div { height: 3px; overflow: hidden; background: rgba(32,35,31,.13); }
.shipping-progress > div span { height: 100%; display: block; background: var(--clay); transition: width .3s ease; }
.shipping-progress p { margin: 9px 0 0; color: var(--muted); font-size: 9px; }
.summary-lines { padding: 22px 0; }
.summary-lines p { display: flex; justify-content: space-between; gap: 16px; font-size: 11px; }
.summary-lines .summary-total { margin-top: 18px; padding-top: 19px; border-top: 1px solid var(--line); font-family: var(--font-serif); font-size: 20px; }
.summary-lines small { color: var(--muted); font-size: 9px; }
.checkout-button { width: 100%; }
.checkout-button:disabled { cursor: wait; opacity: .65; }
.checkout-error { margin-top: 14px; padding: 14px; border: 1px solid var(--clay); background: #f3ded6; color: #6b3528; font-size: 10px; line-height: 1.5; }
.checkout-error p { margin: 5px 0 0; }
.secure-note { margin-top: 18px; display: flex; gap: 12px; align-items: flex-start; color: var(--muted); }
.secure-note p { margin: 0; font-size: 9px; line-height: 1.5; }
.empty-cart, .success-page { min-height: 660px; padding-top: 100px; padding-bottom: 120px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; }
.empty-cart h1, .success-page h1 { margin-bottom: 22px; }
.empty-cart > p:not(.eyebrow), .success-page > p:not(.eyebrow) { max-width: 580px; margin-bottom: 30px; color: var(--muted); font-size: 16px; line-height: 1.7; }
.success-mark { width: 70px; height: 70px; margin-bottom: 30px; display: grid; place-items: center; border-radius: 50%; background: var(--panel-sage); font-size: 25px; }

.content-page { padding-top: 90px; padding-bottom: 130px; }
.content-hero { max-width: 900px; margin-bottom: 80px; }
.content-hero h1 { margin-bottom: 26px; }
.content-hero > p { max-width: 620px; font-size: 18px; line-height: 1.75; color: var(--muted); }
.content-split { display: grid; grid-template-columns: 1.15fr .85fr; gap: 10%; align-items: start; padding-block: 70px; border-top: 1px solid var(--line); }
.content-split h2 { font-size: clamp(38px, 4.4vw, 58px); line-height: 1.04; margin: 0; }
.content-split p { font-size: 15px; line-height: 1.8; color: var(--muted); }
.numbered-list { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
.numbered-list li { padding: 34px 0; display: grid; grid-template-columns: 70px 1fr; gap: 24px; border-bottom: 1px solid var(--line); }
.numbered-list li > span { font-family: var(--font-serif); font-size: 13px; color: var(--clay); }
.numbered-list h3 { margin: 0 0 10px; font-family: var(--font-serif); font-size: 26px; font-weight: 400; }
.numbered-list p { margin: 0; max-width: 620px; color: var(--muted); font-size: 14px; line-height: 1.7; }
.gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.gallery-grid figure { margin: 0; }
.gallery-grid img { width: 100%; aspect-ratio: .8; object-fit: cover; background: var(--panel-product); }
.gallery-grid figcaption { margin-top: 10px; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.gallery-empty { padding: 90px 40px; text-align: center; border: 1px solid var(--line); background: var(--cream); }
.gallery-empty h2 { margin-bottom: 14px; font-size: 40px; }
.gallery-empty p { max-width: 500px; margin: 0 auto 26px; color: var(--muted); line-height: 1.7; }

.legal-page { max-width: 850px; padding-top: 100px; padding-bottom: 130px; }
.legal-page h1 { margin-bottom: 12px; font-size: clamp(56px, 7vw, 85px); }
.legal-updated { margin-bottom: 60px; color: var(--muted); font-size: 11px; }
.legal-page section { padding: 30px 0; border-top: 1px solid var(--line); }
.legal-page section h2 { font-size: 30px; }
.legal-page section p { color: var(--muted); font-size: 14px; line-height: 1.8; }
.legal-page section a { color: var(--clay-deep); border-bottom: 1px solid currentColor; }

.notice-banner { padding: 18px 22px; margin-bottom: 40px; border: 1px solid var(--line); background: var(--cream); color: var(--muted); font-size: 12px; line-height: 1.6; }
.notice-banner strong { color: var(--ink); }

@media (max-width: 980px) {
  .site-header { padding-inline: 24px; grid-template-columns: 1fr auto; }
  .menu-button { grid-column: 2; display: flex; width: 38px; height: 38px; flex-direction: column; gap: 7px; align-items: center; justify-content: center; border: 0; background: transparent; cursor: pointer; }
  .menu-button span { width: 22px; height: 1px; background: var(--ink); }
  .site-header nav { position: fixed; inset: 122px 0 auto; padding: 35px 24px 45px; display: none; flex-direction: column; align-items: flex-start; gap: 25px; background: var(--paper); border-bottom: 1px solid var(--line); }
  .site-header nav.nav-open { display: flex; }
  .hero { min-height: auto; grid-template-columns: 1fr; padding-top: 85px; }
  .hero-visual { min-height: 560px; margin-top: 20px; }
  .approach, .split-heading, .visit-card, .footer-main, .content-split { grid-template-columns: 1fr; gap: 55px; }
  .service-row { grid-template-columns: 45px 1fr 35px; padding-block: 32px; }
  .service-row p, .service-note { grid-column: 2 / 3; }
  .service-arrow { grid-column: 3; grid-row: 1; }
  .product-grid { grid-template-columns: repeat(2, 1fr); row-gap: 50px; }
  .footer-links { padding-top: 0; }
  .shop-hero > div, .product-help, .product-page, .cart-layout { grid-template-columns: 1fr; }
  .product-gallery, .cart-summary { position: relative; top: auto; }
  .product-gallery { min-height: 560px; }
  .product-gallery img { height: 560px; }
  .cart-summary { margin-top: 20px; }
  .gallery-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
  .section-shell { width: min(100% - 30px, 1240px); }
  .announcement { font-size: 9px; }
  .announcement-detail { display: none; }
  .site-header { height: 74px; }
  .site-header nav { inset-block-start: 108px; }
  .hero { padding-top: 58px; padding-bottom: 60px; }
  h1 { font-size: 58px; }
  .hero-lede { font-size: 16px; }
  .hero-visual { min-height: 430px; }
  .hero-card-tall { width: 74%; height: 380px; right: 5px; }
  .hero-card-small { width: 145px; height: 190px; }
  .hero-orbit-one { width: 370px; height: 370px; }
  .hero-orbit-two { display: none; }
  .hero-handwritten { width: 145px; font-size: 15px; }
  .marquee div { font-size: 14px; }
  .approach, .services-block, .shop-preview, .reviews { padding-top: 90px; padding-bottom: 90px; }
  .section-heading { margin-bottom: 42px; }
  .approach h2, .section-heading h2, .visit h2 { font-size: 43px; }
  .service-row { grid-template-columns: 34px 1fr 25px; gap: 14px; }
  .service-row h3 { font-size: 25px; }
  .product-grid { gap: 12px; row-gap: 35px; }
  .product-info { display: block; }
  .product-info h3 { font-size: 16px; }
  .product-price { margin-top: 7px; }
  .product-quick { display: none; }
  .results-callout { padding: 95px 0; }
  .review-grid { grid-template-columns: 1fr; }
  .review-grid blockquote, .review-grid blockquote + blockquote { min-height: auto; padding: 35px 0; border-right: 0; border-bottom: 1px solid var(--line); }
  .visit { padding-bottom: 80px; }
  .visit-card { padding: 42px 28px; }
  .footer-main { padding-top: 75px; padding-bottom: 70px; }
  .footer-bottom { flex-direction: column; align-items: flex-start; gap: 12px; padding-block: 18px; }
  .footer-links { grid-template-columns: 1fr 1fr; row-gap: 45px; }
  .shop-page { padding-bottom: 80px; }
  .shop-hero { padding-top: 65px; padding-bottom: 50px; }
  .shop-hero h1 { font-size: 67px; }
  .shop-controls { align-items: stretch; flex-direction: column; }
  .shop-search { min-width: 0; }
  .shop-product-grid { row-gap: 42px; }
  .product-help { margin-top: 85px; padding: 45px 28px; }
  .product-page { padding-top: 35px; padding-bottom: 85px; gap: 45px; }
  .product-gallery { min-height: 420px; }
  .product-gallery img { height: 420px; }
  .breadcrumbs { margin-bottom: 38px; }
  .product-details h1 { font-size: 52px; }
  .product-buy { grid-template-columns: 100px 1fr; }
  .related-products { padding-bottom: 90px; }
  .related-products .product-grid { grid-template-columns: repeat(2, 1fr); }
  .cart-page { padding-top: 55px; padding-bottom: 90px; }
  .cart-row { grid-template-columns: 95px 1fr; gap: 15px; }
  .cart-image { height: 115px; }
  .cart-item-end { grid-column: 2; flex-direction: row; align-items: center; }
  .cart-summary { padding: 25px 20px; }
  .cart-toast { top: auto; right: 15px; bottom: 15px; left: 15px; }
  .content-page { padding-top: 60px; padding-bottom: 90px; }
  .content-hero { margin-bottom: 50px; }
  .numbered-list li { grid-template-columns: 40px 1fr; gap: 12px; }
  .gallery-grid { grid-template-columns: 1fr; }
}
`;
