# Skin by Laura Lo — Storefront

Custom storefront replacing WordPress + WooCommerce on `skinbylauralo.com`.
Cloudflare Worker, plain HTML/CSS/JS, no framework and no build step.
**Square is the single source of truth** for products, inventory, checkout and
appointments.

Implements Phases 1–3 of the Storefront Blueprint (Rev 02).

---

## How it works

```
Customer ──browse──▶ Worker ──read (cached)──▶ Square Catalog + Inventory
   │                   │
   │                   └──create payment link──▶ Square Checkout (hosted)
   │                                                     │
   │◀────────── redirect to /thank-you ──────────────────┘
   │
   └──Book Now──▶ Square Appointments (direct link, never touches the Worker)
```

- **No database.** Square holds the catalog; the cart is `localStorage`; completed
  orders live in Square's dashboard.
- **No card data, no PCI scope.** Payment happens on Square's hosted page.
- **Prices are never trusted from the browser.** Checkout line items are sent to
  Square as `catalog_object_id` + quantity only, so Square prices the order from
  its own catalog. A tampered cart cannot change what a customer is charged.

## Routes

| Route | What it does |
|---|---|
| `/` | Home |
| `/about`, `/treatments`, `/gallery` | Content pages |
| `/shop` | Product grid, live from Square, with category filter + search |
| `/product/:slug` | Product detail, with Product JSON-LD |
| `/cart` | Bag, rendered client-side from `localStorage` |
| `/thank-you` | Post-payment return page (clears the cart) |
| `/terms`, `/privacy` | Legal |
| `GET /api/catalog` | Lean variation lookup for the cart |
| `POST /api/checkout` | Validates the cart, creates a Square Payment Link |
| `/sitemap.xml`, `/robots.txt`, `/favicon.svg` | |

Old WordPress paths (`/shop/`, `/my-account`, `/terms-conditions`,
`/privacy-policy`, `/booking`, `/product-category/*`) redirect rather than 404.

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars   # add Square credentials
npm run dev                      # http://localhost:8787
npm test                         # catalog + checkout tests (Square mocked)
```

Without Square credentials the site runs normally and the shop shows a clear
"not connected yet" state — nothing crashes.

### Connecting Square

Two credentials are needed, and they are easy to mix up:

| Credential | Looks like | Role |
|---|---|---|
| Application ID | `sq0idp-…` | Public identifier for frontend SDKs. **Not used here.** |
| **Access token** | `EAAA…` | Secret that authenticates API calls. **Required.** |
| **Location ID** | `L…` | Which location's catalog, inventory and orders to use. **Required.** |

Get the access token at [developer.squareup.com/apps](https://developer.squareup.com/apps)
→ your app → **Credentials** → switch to **Production** → *Production Access Token*.
It needs **Catalog read** (`ITEMS_READ`), **Inventory read** (`INVENTORY_READ`)
and **Orders/Payments write** (`ORDERS_WRITE`, `PAYMENTS_WRITE`).

To find the location ID, run:

```bash
SQUARE_ACCESS_TOKEN=EAAA... npm run square:locations
```

This lists every location the token can see with its ID, address and status.
It is read-only — it creates nothing and charges nothing.

```bash
npx wrangler secret put SQUARE_ACCESS_TOKEN
npx wrangler secret put SQUARE_LOCATION_ID
```

**Production is the default.** Only set `SQUARE_ENVIRONMENT` if you want
sandbox:

```bash
npx wrangler secret put SQUARE_ENVIRONMENT   # optional: "sandbox"
```

Secrets are never stored in this repo. `.dev.vars` is gitignored.

### Deploying

```bash
npm run deploy
```

Then point `test.skinbylauralo.com` at the Worker (uncomment the `[[routes]]`
block in `wrangler.toml`), exactly as `audit.skinbylauralo.com` is set up today.
WordPress DNS stays untouched until the Phase 4 cutover.

## Images

Files in `public/media/` are served directly by Cloudflare's static-asset
layer at their matching path — `public/media/laura-hero.png` is served at
`/media/laura-hero.png`. They never pass through the Worker, so they add
nothing to the bundle.

### The hero cutout

`HERO_IMAGE` in `src/config.js` points at the image that breaks out of the
frame on the homepage. It **must have a transparent background** (PNG or
WebP with alpha) — a photo on a solid background renders as a visible
rectangle and the pop-out effect does not read.

- Portrait orientation, 1200px+ on the long edge
- Cropped roughly head to mid-thigh
- No baked-in marketing text; the hero sets its own type

Leave `src` as `null` and the hero falls back to the first product image.

## Business settings

Everything below is in `wrangler.toml` under `[vars]` — change a value and
redeploy, no code edit. Money is in **cents**.

| Variable | Default | Meaning |
|---|---|---|
| `SHIPPING_ENABLED` | `true` | Offer shipping at all |
| `SHIPPING_FEE_CENTS` | `1000` | Flat $10.00 |
| `FREE_SHIPPING_THRESHOLD_CENTS` | `10000` | Free at $100.00+. `0` = always charge |
| `SHIPPING_LABEL` | `U.S. shipping` | Line label on Square's checkout |
| `PICKUP_ENABLED` | `true` | Offer free Tampa pickup |
| `PICKUP_PREP_HOURS` | `24` | Pickup prep time |
| `CATALOG_TTL_SECONDS` | `120` | Catalog cache. `0` = always live |
| `HIDE_SOLD_OUT` | `false` | `true` hides sold-out items instead of labelling them |
| `SITE_URL` | test domain | Used for canonical URLs and the sitemap |

Copy, hours, address, booking/eGift links, review count and gallery images live
in `src/config.js`.

> **Why flat-rate shipping?** Square's Payment Links accept a single
> `shipping_fee` that must be set *when the link is created* — before the buyer
> has entered an address. Address- or zone-based rates are therefore not
> possible through this checkout. Flat fee + free-over-threshold is the
> workable model.

## Layout

```
src/
├── index.js          Router, checkout endpoint, redirects
├── config.js         Business constants + env-driven settings
├── square.js         Square Catalog/Inventory reads, Payment Link creation
├── layout.js         Document shell, header, footer
├── styles.js         Design system stylesheet
├── html.js           Auto-escaping template helpers
├── client/cart.js    Browser JS: cart, filters, checkout
└── pages/            One module per page
scripts/              square-locations.mjs — find your SQUARE_LOCATION_ID
test/                 Catalog + checkout tests, Square mocked
```

## Not built (deliberately)

Blueprint phases intentionally left out — see §7 of the blueprint:

- **Order lookup** (email + order number) — Phase 5, `[if wanted]`
- **D1 caching layer** — Phase 6, only if live API calls prove too slow
- **Embedded booking** — Phase 7; the link-out works and is unchanged
- **Customer accounts** — Phase 8, a separate decision

## Known content gaps

- **Gallery has no photography.** The live WordPress gallery is 18 empty
  placeholders, so `/gallery` renders an honest "photos coming" state that links
  to Instagram. Add entries to `GALLERY_IMAGES` in `src/config.js` to switch it
  to a real grid.
- **Product copy comes from Square.** Items without a description in Square show
  a short fallback line. Descriptions and photos added in Square appear on the
  site automatically.
