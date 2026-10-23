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
and **Orders/Payments write** (`ORDERS_WRITE`, `PAYMENTS_WRITE`). For the
`/admin` client-notes tool's "Sync from Square" to find clients and their
seller notes, it also needs **Appointments read**
(`APPOINTMENTS_READ`, `APPOINTMENTS_ALL_READ`) and **Customers read**
(`CUSTOMERS_READ`).

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
| `SALES_RANK_TTL_SECONDS` | `21600` | Best-seller ranking cache (6h). Requires Reporting API read scope on the Square token; falls back to alphabetical order if unavailable |
| `HIDE_SOLD_OUT` | `false` | `true` hides sold-out items instead of labelling them |
| `HIDE_UNCATEGORIZED` | `true` | `false` shows products with no Square category instead of hiding them |
| `SITE_URL` | `https://skinbylauralo.com` | Used for canonical URLs and the sitemap |

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
├── pages/            One module per storefront page
└── admin/            The /admin client-notes tool — its own DB, see below
scripts/              square-locations.mjs — find your SQUARE_LOCATION_ID
test/                 Catalog + checkout + admin-notes tests, Square mocked
```

## The /admin client-notes tool

A separate internal tool, bolted onto the same Worker at `/admin`, for
Laura's consultation notes. Everything else in this project reads Square
live and stores nothing — this is the one exception, because Square has
nowhere to put a handwritten consultation note.

**Clients are never typed in by hand.** A client only appears after
**Sync from Square** (the button on `/admin`) finds them with a past,
`ACCEPTED` Square booking — so the client list is always a subset of real
Square customers who've actually had a service, never a free-text list
someone can drift out of sync with Square. The same sync also imports each
booking's `seller_note` as a note (tagged "From Square"), since that's
already real text sitting in Square with no transcription needed.

**Adding a handwritten note** (tagged "From Noteful") works like this:
export a notebook from Noteful as PDF or Image (not Native — that format
isn't readable here), upload it on a client's page, and Claude reads the
new pages and proposes one or more dated entries for review before
anything is saved. Because Noteful always re-exports the *whole* notebook,
not just what's new, re-uploading the same notebook later only processes
pages that weren't already seen — matched by a hash of each page's
content, not its position, so Noteful reordering or inserting a page never
confuses it. A page that was previously seen but is missing from a newer
export is flagged, not silently dropped — that usually means the wrong
file was picked.

A note's **date** and **summary** are never guessed. A page with no
legible date comes back `null`, shown as "no date detected"; anything the
model wasn't confident reading is flagged low-confidence with the
original file one tap away. Laura can edit a note's summary at any time.

**Routine** on a client's page is never stored — it's read live from their
most recent completed Square order, the same way the rest of the site
treats Square as the source of truth.

### Provisioning

The D1 database and R2 bucket already exist and are wired into
`wrangler.toml` — nothing to create. One secret is still needed before the
AI features work:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

(For reference, this is how the database/bucket were created and the
schema applied, if this ever needs doing again in a different account:)

```bash
npx wrangler d1 create skin-by-laura-lo-client-notes
npx wrangler r2 bucket create skin-by-laura-lo-client-notes
npx wrangler d1 execute skin-by-laura-lo-client-notes --remote --file=migrations/0001_client_notes.sql
```

**`/admin` has its own login page.** Set the username and password as Worker
secrets (they are never stored in the repo):

```bash
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
```

Until both are set, `/admin` refuses everyone. The session lasts 12 hours and
is signed with the password, so changing `ADMIN_PASSWORD` signs everyone out.
PDF/image note uploads are switched off (`UPLOADS_ENABLED` in
`src/admin/routes.js`) while notes come from the Excel sheet.

### Email campaigns

`/admin/campaigns` writes and sends the twice-weekly client email (Tuesday
and Thursday). Square has no API for its own marketing emails, so they go
out through [Resend](https://resend.com).

1. **Write.** Type the week's idea, or tap the microphone and say it. The
   recording is typed out by Workers AI (Whisper, the `AI` binding) and
   added to the text; the audio is never stored.
2. **Find clients.** Claude writes one shared email in Laura's voice (the
   guide is in `src/admin/campaigns/voice.js`; update it as she posts), plus
   a list of words to look for. Every client's notes and stored purchases
   are searched for those words, and only clients with a hit are sent to
   Claude (first name only, no surname), which decides whether they really
   relate and writes a short personal note. There is no cap on how many
   clients get one. Personal notes never name
   medications, pregnancy, allergies or diagnoses, and stay gentle for
   clients flagged as sensitive.
3. **Review.** Every version (the shared one and each personal one) is
   approved, edited, or rejected and redrafted with Laura's feedback. Edit
   turns the email itself into the editor: she clicks anywhere in it and
   types, with bold and links from the toolbar, Enter for a new paragraph or
   tip, a P.S. (for everyone, or just one client), and the button to show.
   The words are checked against her voice guide as she types. On a phone the versions and the preview
   are two tabs.
4. **Send.** Everyone in Square with an email address gets it, except
   people who unsubscribed (here or in Square). Clients with an approved
   personal version get that; everyone else gets the shared email.
   Emails are queued and sent by the scheduled run every 15 minutes, at
   most `EMAIL_DAILY_LIMIT` a day (95, under Resend's free 100), so a
   longer list finishes the next day.

**Cost.** The new-email page estimates the AI cost before drafting,
measured from the real prompts and the shop's products and client notes.
Each campaign records the tokens it used, and the review page, the send
button and the Campaigns home show what it really cost. Prices per model
are in `src/admin/campaigns/cost.js`.

Every email has the studio's address, an unsubscribe link, and one-click
unsubscribe headers. Unsubscribe links are signed, open a confirmation page
first (so mail scanners can't unsubscribe anyone), and are kept in D1.

**Reminders.** On Tuesday and Thursday at 9:00 am (Tampa time) Laura gets a
reminder email at `REMINDER_EMAIL` with three topic ideas from recent notes,
and a phone notification on any phone where she tapped "Turn on phone
notifications" (on an iPhone this works in the Home Screen app). Each day
can be switched off on the Campaigns page. No reminder is sent if a
campaign was already started that day.

**Setup.** Migration `0006_email_campaigns.sql` creates the tables. Then:

1. Create a Resend account and verify `skinbylauralo.com` (Resend shows DNS
   records to add in Cloudflare DNS).
2. `npx wrangler secret put RESEND_API_KEY`
3. Check `CAMPAIGN_FROM_EMAIL`, `REMINDER_EMAIL` and `EMAIL_DAILY_LIMIT`
   under `[vars]` in `wrangler.toml`. Replies go to `SUPPORT_EMAIL`.
4. `npx wrangler deploy`, which also turns on the `AI` binding and the
   15-minute cron trigger.

## Not built (deliberately)

Blueprint phases intentionally left out — see §7 of the blueprint:

- **Order lookup** (email + order number) — Phase 5, `[if wanted]`
- **A D1 caching layer for the catalog** — Phase 6, only if live Square
  catalog reads prove too slow. (D1 is now used for `/admin`'s client
  notes, above — a different, unrelated use of it.)
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
