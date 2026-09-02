// "Editorial Boutique" design system — ported from the reference build's
// globals.css, with the Tailwind import dropped (nothing here needed it).
// Served as a standalone, long-cached stylesheet.

export const STYLES = `
:root {
  /* "Editorial Botanical" — from the client's material board.
     The ground stays light; moss appears as product tiles, bands and footers.
     Every pair below is measured: see README for the contrast table. */
  --paper: #f1eada;         /* vanilla — page ground */
  --cream: #e9e1ce;         /* deeper vanilla — section tint */
  --white: #faf7ef;         /* alabaster — raised surface */
  --ink: #2c3424;           /* moss — text on light, and every dark surface */
  --muted: #4c583e;         /* cypress — body copy on light (6.3:1) */
  --clay: #7a5f2a;          /* bronze — text accent (5.0:1) */
  --clay-deep: #5e4820;     /* deep bronze — eyebrows (7.2:1) */
  --sage: #768064;          /* olive — sparing use */
  --line: rgba(44, 52, 36, 0.18);

  /* Metal is a FILL, never body type: brass on vanilla is only 2:1. */
  --brass: #c6a45c;
  --brass-hi: #e3cb92;
  --brass-deep: #8c6b33;

  /* Text on moss */
  --on-dark: #f1eada;       /* vanilla (10.8:1) */
  --on-dark-muted: #aaa396; /* mountain (5.2:1) */

  --mahogany: #584738;      /* walnut band */
  --shadow: #1b2118;

  --panel-taupe: #daded1;   /* aloe */
  --panel-stone: #e4eade;   /* pale sage */
  --panel-product: #dfe3d7; /* product image panel — stays light so multiply works */
  --panel-sage: #daded1;
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
::selection { background: var(--brass); color: var(--ink); }
:focus-visible { outline: 2px solid var(--clay-deep); outline-offset: 3px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.skip-link { position: absolute; left: -9999px; top: 0; z-index: 100; padding: 12px 18px; background: var(--ink); color: var(--white); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
.skip-link:focus { left: 8px; top: 8px; }
.skip-link { color: var(--on-dark); }

.section-shell { width: min(1240px, calc(100% - 48px)); margin-inline: auto; }
.eyebrow { margin: 0 0 22px; font-size: 10px; letter-spacing: .25em; font-weight: 650; text-transform: uppercase; color: var(--clay-deep); }
.button { min-height: 52px; padding: 0 22px; display: inline-flex; align-items: center; justify-content: center; gap: 18px; border: 1px solid transparent; font-size: 11px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; transition: transform .2s ease, background .2s ease; cursor: pointer; }
.button:hover { transform: translateY(-2px); }
.button-dark { background: linear-gradient(135deg, var(--brass-deep), var(--brass) 45%, var(--brass-hi) 60%, var(--brass) 82%); color: var(--ink); }
.button-light { background: var(--white); color: var(--ink); border-color: var(--line); }
.button-row { display: flex; align-items: center; gap: 30px; flex-wrap: wrap; }
.text-link { display: inline-flex; align-items: center; gap: 12px; padding-bottom: 4px; border-bottom: 1px solid currentColor; font-size: 11px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; }
.stars { color: var(--clay); letter-spacing: .16em; font-size: 11px; }
.on-dark .stars, .site-footer .stars, .results-callout .stars { color: var(--brass); }

.announcement { min-height: 34px; padding: 8px 24px; display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--ink); color: var(--on-dark); font-size: 11px; letter-spacing: .11em; text-transform: uppercase; text-align: center; }
.site-header { height: 88px; padding: 0 44px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 1px solid var(--line); background: rgba(241,234,218,.93); backdrop-filter: blur(18px); position: sticky; top: 0; z-index: 40; }
.brand { display: flex; flex-direction: column; width: max-content; line-height: 1; }
.brand span { font-size: 8px; letter-spacing: .36em; margin-left: 3px; margin-bottom: 4px; }
.brand strong { font-family: var(--font-serif); font-weight: 400; font-size: 25px; letter-spacing: -.03em; }
.site-header nav { grid-column: 2 / 4; display: flex; justify-content: flex-end; align-items: center; gap: 31px; font-size: 12px; letter-spacing: .05em; text-transform: uppercase; }
.site-header nav a { transition: color .2s ease; }
.site-header nav a:hover, .site-header nav a[aria-current="page"] { color: var(--clay); }
.nav-book { border-bottom: 1px solid currentColor; padding-bottom: 4px; }
.cart-link { display: flex; align-items: center; gap: 8px; }
.cart-link span { width: 25px; height: 25px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: var(--on-dark); font-size: 10px; }
.menu-button { display: none; }

main { overflow-x: clip; }
.hero { min-height: 750px; display: grid; grid-template-columns: .92fr 1.08fr; gap: 8%; align-items: center; padding-top: 70px; padding-bottom: 40px; }
h1 { margin-bottom: 28px; font-size: clamp(64px, 7vw, 104px); line-height: .89; }
.hero-lede { max-width: 590px; margin-bottom: 34px; font-size: 18px; line-height: 1.7; color: var(--muted); }
.hero-proof { margin-top: 38px; display: flex; align-items: center; gap: 15px; color: var(--muted); font-size: 11px; letter-spacing: .04em; }
.hero-visual { min-height: 610px; position: relative; }

/* ---------------------------------------------------------------------
   HERO POP-OUT — a framed window the subject physically escapes.
   The illusion needs four things at once: a visible frame, the subject
   crossing its edge, a shadow cast back onto it, and parallax between
   the layers as the pointer moves.
   Requires a cutout image with alpha; see HERO_IMAGE in config.js.
   --------------------------------------------------------------------- */
.hero-stage { position: absolute; inset: 0; perspective: 1150px; perspective-origin: 52% 46%; }
.hero-layers { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .5s cubic-bezier(.2,.7,.3,1); }
.hero-layers.is-tracking { transition: transform .1s linear; }
.hero-layers > * { position: absolute; }

/* The result-card orbit sits behind Laura. Keeping it as an open brass ellipse
   gives the cards a visible path without putting a coloured disc behind her. */
.hero-ring {
  left: 50%; top: 73%;
  width: min(90%, 540px); aspect-ratio: 9 / 1;
  translate: calc(-50% + var(--px, 0px)) calc(-50% + var(--py, 0px));
  border-radius: 50%;
  background: transparent;
  border: 1px solid rgba(122,95,42,.58);
  box-shadow: none;
  pointer-events: none;
}
.hero-ring-back { clip-path: inset(49% 0 0); transform: translateZ(-140px); }
.hero-ring-front {
  /* Perspective makes the front plane larger and lower on screen. Offset and
     scale this half so it reconnects with the deep back half as one ellipse. */
  left: 50.43%; top: 67.14%;
  clip-path: inset(0 0 49%);
  transform: translateZ(140px) scale(.783);
}

/* Result cards ride the ring's edge, before to the left, after to the right. */
.hero-result {
  --orbit-x: 0px;
  --orbit-y: 0px;
  --orbit-z: 180px;
  --orbit-scale: 1;
  --orbit-tilt: 0deg;
  margin: 0; width: 116px;
  left: 50%; top: 73%;
  padding: 9px 9px 7px;
  background: var(--ink); color: var(--on-dark);
  box-shadow: 0 18px 34px rgba(27,33,24,.34);
  translate: -50% -50%;
  transform: translate3d(
    calc(var(--orbit-x) + var(--px, 0px)),
    calc(var(--orbit-y) + var(--py, 0px)),
    var(--orbit-z)
  ) rotate(var(--orbit-tilt)) scale(var(--orbit-scale));
  transform-origin: center;
  will-change: transform, opacity;
}
.hero-result-shot {
  aspect-ratio: .82; display: grid; place-items: center;
  background: var(--panel-product); overflow: hidden;
}
.hero-result-shot img { width: 100%; height: 100%; object-fit: cover; }
/* Empty panels stay quiet — the caption already names each side. */
.hero-result-shot:empty::after {
  content: ""; width: 26px; height: 1px; background: var(--line);
}
.hero-result figcaption {
  margin-top: 7px; font-size: 8px; font-weight: 650;
  letter-spacing: .18em; text-transform: uppercase; color: var(--brass);
}
.hero-result-before { --orbit-tilt: -4deg; }
.hero-result-after  { --orbit-tilt: 3.5deg; }

/* The subject, furthest forward, overlapping the ring's top edge. */
.hero-subject {
  left: 50%; bottom: 4%;
  width: auto; height: 600px; max-width: none;
  translate: calc(-50% + var(--px, 0px)) var(--py, 0px);
  object-fit: contain;
  transform: translateZ(110px);
  filter: drop-shadow(0 30px 26px rgba(27,33,24,.40)) drop-shadow(0 6px 10px rgba(27,33,24,.28));
  transition: transform .5s cubic-bezier(.2,.7,.3,1);
}
.hero-subject-empty {
  display: grid; place-items: center; text-align: center; padding: 20px;
  width: 300px; height: 560px;
  border: 1px dashed var(--line); background: rgba(250,247,239,.62);
  font-family: var(--font-serif); font-style: italic; font-size: 15px; color: var(--muted);
}

.hero-plinth {
  left: 50%; bottom: 0;
  width: min(320px, 60%); height: 34px;
  translate: calc(-50% + var(--px, 0px)) var(--py, 0px);
  background: radial-gradient(50% 50% at 50% 50%, rgba(27,33,24,.30), transparent 72%);
  transform: translateZ(-30px); filter: blur(7px);
}

.hero-handwritten {
  z-index: 3; left: 0; right: auto; bottom: 9%;
  width: 118px; text-align: left; transform: none;
  font-family: var(--font-serif); font-style: italic; font-size: 15px; line-height: 1.35;
  color: var(--muted);
}
.hero-handwritten::before {
  content: ""; display: block; width: 26px; height: 1px;
  background: var(--brass); margin-bottom: 10px;
}
.hero-orbit { position: absolute; border: 1px solid rgba(122,95,42,.30); border-radius: 50%; }
.hero-orbit-one { width: 520px; height: 520px; right: 0; top: 25px; }
.hero-orbit-two { width: 340px; height: 340px; right: 90px; top: 115px; }
.hero-card { position: absolute; overflow: hidden; background: var(--panel-product); box-shadow: 0 30px 70px rgba(27,33,24,.22); }
.hero-card img { width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply; }
.hero-card-label { position: absolute; top: 18px; left: 18px; z-index: 2; padding: 7px 9px; background: rgba(250,247,239,.88); font-size: 8px; letter-spacing: .16em; text-transform: uppercase; }
.hero-card-tall { width: min(390px, 66%); height: 520px; right: 70px; top: 20px; transform: rotate(2.5deg); }
.hero-card-small { width: 210px; height: 275px; left: 0; bottom: 20px; transform: rotate(-5deg); background: var(--panel-stone); }
.hero-handwritten { position: absolute; right: 0; bottom: 0; width: 185px; font-family: var(--font-serif); font-size: 20px; line-height: 1.15; font-style: italic; color: var(--clay); transform: rotate(-5deg); }

.marquee { position: relative; z-index: 2; overflow: hidden; background: var(--ink); color: var(--brass); }
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
.product-card { min-width: 0; height: 100%; position: relative; display: flex; flex-direction: column;
  padding: 13px 13px 11px; background: var(--ink); color: var(--on-dark); }
/* fine grain keeps a large moss field from banding */
.product-card::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(rgba(241,234,218,.06) .5px, transparent .5px); background-size: 3px 3px; }
.product-card > a { display: block; position: relative; z-index: 1; }
.product-image-wrap { aspect-ratio: .86; position: relative; overflow: hidden; background: var(--panel-product); }
.product-image-wrap img { width: 100%; height: 100%; padding: 9%; object-fit: contain; mix-blend-mode: multiply; transition: transform .45s ease; }
.product-card:hover img { transform: scale(1.045); }
.product-image-fallback { width: 100%; height: 100%; display: grid; place-items: center; padding: 12%; text-align: center; font-family: var(--font-serif); font-size: 13px; font-style: italic; color: var(--muted); }
.product-badge { position: absolute; z-index: 2; top: 14px; left: 14px; padding: 7px 9px; background: var(--brass); color: var(--ink); font-size: 8px; letter-spacing: .12em; text-transform: uppercase; }
.product-badge-soldout { background: var(--ink); color: var(--on-dark); border: 0; }
.product-quick { position: absolute; left: 12px; right: 12px; bottom: 12px; padding: 14px; text-align: center; background: rgba(241,234,218,.94); color: var(--ink); font-size: 9px; letter-spacing: .13em; text-transform: uppercase; transform: translateY(70px); transition: transform .3s ease; }
.product-card:hover .product-quick { transform: translateY(0); }
.product-info { padding: 17px 2px 12px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.product-category { margin-bottom: 6px; font-size: 8px; letter-spacing: .16em; text-transform: uppercase; color: var(--brass); }
.product-info h3 { margin: 0; font-family: var(--font-serif); font-size: 18px; font-weight: 400; line-height: 1.25; }
.product-price { margin: 1px 0 0; font-size: 12px; white-space: nowrap; }

.results-callout { position: relative; padding: 135px 0; text-align: center; background: var(--mahogany); color: var(--on-dark); }
.results-callout::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(rgba(241,234,218,.05) .5px, transparent .5px); background-size: 3px 3px; }
.results-callout > * { position: relative; z-index: 1; }
.results-inner { display: flex; flex-direction: column; align-items: center; }
.results-callout .eyebrow { color: var(--brass-hi); }
.results-callout h2 { margin: 0 0 26px; font-size: clamp(58px, 7vw, 98px); line-height: .9; }
.results-callout h2 em { color: var(--brass-hi); }
.results-callout p:not(.eyebrow) { max-width: 500px; margin-bottom: 34px; line-height: 1.7; color: #ded2c0; }

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

.site-footer { position: relative; background: var(--ink); color: var(--on-dark); }
.site-footer::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(rgba(241,234,218,.05) .5px, transparent .5px); background-size: 3px 3px; }
.site-footer > * { position: relative; z-index: 1; }
.footer-main { padding-top: 105px; padding-bottom: 90px; display: grid; grid-template-columns: 1fr 1fr; gap: 10%; }
.footer-brand .eyebrow { color: var(--brass); }
.footer-brand h2 { max-width: 570px; margin-bottom: 35px; font-size: clamp(44px, 5vw, 70px); line-height: .96; }
.footer-links { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; padding-top: 20px; }
.footer-links div { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
.footer-links p { margin-bottom: 10px; color: var(--brass); font-size: 9px; letter-spacing: .18em; text-transform: uppercase; }
.footer-links a { color: var(--on-dark-muted); font-size: 12px; line-height: 1.65; }
.footer-links a:hover { color: var(--on-dark); }
.footer-bottom { min-height: 74px; display: flex; align-items: center; justify-content: space-between; gap: 20px; border-top: 1px solid rgba(241,234,218,.16); color: var(--on-dark-muted); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; }
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
.filter-pills button:hover, .filter-pills button.active { background: var(--ink); border-color: var(--ink); color: var(--on-dark); }
.shop-search { min-width: 250px; display: flex; align-items: center; border-bottom: 1px solid var(--ink); }
.shop-search input { width: 100%; padding: 11px 5px; border: 0; outline: none; background: transparent; font-size: 12px; }
.shop-count { margin-bottom: 32px; color: var(--muted); font-size: 9px; letter-spacing: .13em; text-transform: uppercase; }
.shop-product-grid { row-gap: 65px; }
.product-short { max-width: 250px; margin: 8px 0 0; color: var(--on-dark-muted); font-size: 11px; line-height: 1.5; }
.add-button { width: 100%; margin-top: auto; padding: 12px 0; position: relative; z-index: 1; display: flex; justify-content: space-between; border: 0; border-top: 1px solid rgba(241,234,218,.22); background: transparent; color: var(--on-dark); font-size: 9px; letter-spacing: .13em; text-transform: uppercase; cursor: pointer; }
.add-button:hover { color: var(--brass); }
.add-button:disabled { color: var(--on-dark-muted); cursor: not-allowed; }
.shop-empty { min-height: 360px; display: grid; place-items: center; align-content: center; text-align: center; border: 1px solid var(--line); padding: 40px; }
.shop-empty h2 { margin-bottom: 8px; font-size: 44px; }
.shop-empty p { color: var(--muted); max-width: 460px; }
.shop-empty button { margin-top: 10px; background: transparent; border: 0; cursor: pointer; }
.product-help { margin-top: 140px; padding: 70px; display: grid; grid-template-columns: 1fr .8fr; gap: 10%; align-items: center; background: var(--panel-sage); }
.product-help h2, .related-products h2 { margin: 0; font-size: clamp(42px, 5vw, 68px); line-height: .98; }
.product-help > div:last-child > p { margin-bottom: 28px; color: var(--muted); line-height: 1.7; }

.cart-toast { position: fixed; z-index: 80; right: 24px; top: 142px; max-width: 390px; padding: 17px 20px; display: flex; gap: 24px; align-items: center; background: var(--ink); color: var(--on-dark); box-shadow: 0 16px 38px rgba(0,0,0,.18); font-size: 12px; }
.cart-toast a { border-bottom: 1px solid currentColor; white-space: nowrap; }

.product-page { padding-top: 75px; padding-bottom: 130px; display: grid; grid-template-columns: 1.08fr .92fr; gap: 9%; align-items: start; }
.product-gallery { min-height: 680px; position: sticky; top: 150px; padding: 24px; display: grid; background: var(--ink); }
.product-gallery-panel { display: grid; place-items: center; background: var(--panel-product); }
.product-gallery-panel img { width: 100%; height: 632px; padding: 8%; object-fit: contain; mix-blend-mode: multiply; }
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
.cart-summary { padding: 34px; position: sticky; top: 145px; background: var(--panel-stone); }
.cart-summary > h2 { margin-bottom: 30px; font-size: 32px; }
.fulfillment-options { margin: 0; padding: 0 0 24px; border: 0; border-bottom: 1px solid var(--line); }
.fulfillment-options legend { margin-bottom: 13px; font-size: 9px; letter-spacing: .13em; text-transform: uppercase; }
.fulfillment-options label { padding: 15px 13px; display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; border: 1px solid transparent; cursor: pointer; }
.fulfillment-options label.selected { border-color: var(--ink); background: rgba(250,247,239,.62); }
.fulfillment-options input { accent-color: var(--ink); }
.fulfillment-options label > span { font-size: 11px; }
.fulfillment-options strong, .fulfillment-options small { display: block; }
.fulfillment-options small { margin-top: 3px; color: var(--muted); font-size: 9px; }
.shipping-progress { padding: 20px 0 8px; }
.shipping-progress > div { height: 3px; overflow: hidden; background: rgba(44,52,36,.15); }
.shipping-progress > div span { height: 100%; display: block; background: linear-gradient(90deg, var(--brass-deep), var(--brass), var(--brass-hi)); transition: width .3s ease; }
.shipping-progress p { margin: 9px 0 0; color: var(--muted); font-size: 9px; }
.summary-lines { padding: 22px 0; }
.summary-lines p { display: flex; justify-content: space-between; gap: 16px; font-size: 11px; }
.summary-lines .summary-total { margin-top: 18px; padding-top: 19px; border-top: 1px solid var(--line); font-family: var(--font-serif); font-size: 20px; }
.summary-lines small { color: var(--muted); font-size: 9px; }
.checkout-button { width: 100%; }
.checkout-button:disabled { cursor: wait; opacity: .65; }
.checkout-error { margin-top: 14px; padding: 14px; border: 1px solid #8a3a22; background: #f4e3da; color: #6b2c17; font-size: 10px; line-height: 1.5; }
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

/* ---------------------------------------------------------------------
   MOTION — depth vocabulary. All CSS, no library, no added weight.
   Every effect rests in its finished state and only enhances on
   interaction or scroll, so nothing is hidden if it never runs.
   --------------------------------------------------------------------- */

/* 1. Brass catches the light. The sweep is the metal, not a generic shine. */
.button-dark { position: relative; overflow: hidden; }
.button-dark::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(105deg, transparent 32%, rgba(255,253,244,.62) 47%, rgba(255,253,244,.18) 56%, transparent 72%);
  transform: translateX(-130%);
  transition: transform .75s cubic-bezier(.2,.7,.3,1);
}
.button-dark:hover::after, .button-dark:focus-visible::after { transform: translateX(130%); }

/* 2. Perspective tilt. The grid holds the vanishing point so cards in a row
      share one camera rather than each having its own. */
.product-grid { perspective: 1400px; }
.product-card {
  transform-style: preserve-3d;
  transition: transform .5s cubic-bezier(.2,.7,.3,1), box-shadow .5s ease;
  box-shadow: 0 10px 24px rgba(27,33,24,.14);
}
.product-card:hover { box-shadow: 0 30px 56px rgba(27,33,24,.30); }
.product-card.is-tilting { transition: transform .12s linear, box-shadow .5s ease; }

/* 3. Light shaft. A raking beam across moss surfaces — the signature move,
      tied to the glazed-tile and brass materials in the board. */
.results-callout::before, .product-gallery::before {
  content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background: linear-gradient(104deg, transparent 34%, rgba(226,203,146,.10) 46%, rgba(226,203,146,.04) 54%, transparent 68%);
}
.product-gallery { position: relative; overflow: hidden; }
.product-gallery-panel { position: relative; z-index: 1; }
.product-gallery::before { transform: translateX(-32%); transition: transform 1.1s cubic-bezier(.2,.7,.3,1); }
.product-gallery:hover::before { transform: translateX(32%); }

/* 4. Layered depth on the image panel inside a moss tile. */
.product-image-wrap { box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 6px 14px rgba(27,33,24,.18); }

/* 5. Text links draw their underline rather than just colouring it. */
.text-link { position: relative; }
.text-link::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
  background: var(--brass); transform: scaleX(0); transform-origin: left;
  transition: transform .4s cubic-bezier(.2,.7,.3,1);
}
.text-link:hover::after { transform: scaleX(1); }

/* 6. Scroll-driven reveal. Native timeline, so no observer and no JS.
      Guarded by @supports and reduced-motion; the resting state is the
      finished state, so unsupported browsers simply see the layout. */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .approach, .services-block, .shop-preview, .reviews, .visit,
    .content-split, .related-products, .product-help, .numbered-list li {
      animation: rise-in linear both;
      animation-timeline: view();
      animation-range: entry 4% cover 20%;
    }
    @keyframes rise-in {
      from { opacity: .5; transform: translateY(20px); }
      to { opacity: 1; transform: none; }
    }
  }
}

/* Motion is a courtesy, not the content. */
@media (prefers-reduced-motion: reduce) {
  .marquee div { animation: none; }
  .product-card, .button-dark::after, .product-gallery::before,
  .text-link::after, .image-panel img, .product-image-wrap img,
  .hero-layers {
    transition: none !important; transform: none !important;
  }
}

@media (max-width: 980px) {
  .site-header { padding-inline: 24px; grid-template-columns: 1fr auto; backdrop-filter: none; }
  .menu-button { grid-column: 2; display: flex; width: 38px; height: 38px; flex-direction: column; gap: 7px; align-items: center; justify-content: center; border: 0; background: transparent; cursor: pointer; }
  .menu-button span { width: 22px; height: 1px; background: var(--ink); }
  .site-header nav {
    position: fixed; inset: 122px 0 auto; z-index: 41;
    grid-column: 1 / -1; width: 100%; max-height: calc(100dvh - 122px);
    padding: 20px 24px 34px; display: none; overflow-y: auto;
    flex-direction: column; align-items: stretch; gap: 0;
    background: var(--paper); border-block: 1px solid var(--line);
    box-shadow: 0 24px 50px rgba(27,33,24,.14);
  }
  .site-header nav.nav-open { display: flex; }
  .site-header nav a { width: 100%; padding: 15px 0; border-bottom: 1px solid var(--line); }
  .site-header nav .cart-link { justify-content: space-between; }
  .hero { min-height: auto; grid-template-columns: 1fr; padding-top: 85px; }
  .hero-visual { min-height: 560px; margin-top: 20px; }
  .hero-subject { height: 520px; }
  .hero-result { width: 116px; }
  .approach, .split-heading, .visit-card, .footer-main, .content-split { grid-template-columns: 1fr; gap: 55px; }
  .service-row { grid-template-columns: 45px 1fr 35px; padding-block: 32px; }
  .service-row p, .service-note { grid-column: 2 / 3; }
  .service-arrow { grid-column: 3; grid-row: 1; }
  .product-grid { grid-template-columns: repeat(2, 1fr); row-gap: 50px; }
  .footer-links { padding-top: 0; }
  .shop-hero > div, .product-help, .product-page, .cart-layout { grid-template-columns: 1fr; }
  .product-gallery, .cart-summary { position: relative; top: auto; }
  .product-gallery { min-height: 560px; padding: 18px; }
  .product-gallery-panel img { height: 512px; }
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
  .hero-stage { perspective: 700px; }
  .hero-subject { height: 380px; }
  .hero-result { width: 80px; padding: 5px 5px 4px; }
  .hero-result figcaption { font-size: 7px; letter-spacing: .14em; }
  .hero-handwritten { display: none; }
  .hero-plinth { display: none; }
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
  .product-gallery { min-height: 420px; padding: 14px; }
  .product-gallery-panel img { height: 372px; }
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

