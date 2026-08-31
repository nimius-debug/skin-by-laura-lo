import { html } from "../html.js";
import {
  BOOKING_URL, STUDIO, HOURS, SUPPORT_EMAIL, INSTAGRAM_URL, GALLERY_IMAGES,
} from "../config.js";

export function aboutPage() {
  return html`
    <div class="content-page section-shell">
      <div class="content-hero">
        <p class="eyebrow">About</p>
        <h1>Skin that feels like <em>yours</em> again.</h1>
        <p>
          Laura Lo is a licensed esthetician in Tampa, Florida, working with
          Korean-infused treatment methods and a barrier-first philosophy.
        </p>
      </div>

      <section class="content-split">
        <h2>Why barrier <em>first</em></h2>
        <div>
          <p>
            Most skin that arrives here has been over-treated rather than
            under-treated &#8212; too many actives, too fast, layered on a barrier
            that was already struggling. The redness, the stinging, the breakouts
            that will not settle: often that is a barrier problem wearing a
            different costume.
          </p>
          <p>
            So the first job is always to calm things down and rebuild tolerance.
            Only once skin is steady does it make sense to push on pigment, texture
            or fine lines. It is slower on paper and considerably faster in practice.
          </p>
        </div>
      </section>

      <section class="content-split">
        <h2>How a visit <em>goes</em></h2>
        <div>
          <ul class="numbered-list">
            <li>
              <span>01</span>
              <div>
                <h3>We talk first</h3>
                <p>What you use now, what has flared, what you can realistically keep up with at home.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Treatment, adjusted live</h3>
                <p>The plan adapts to how your skin responds on the day, not to a fixed protocol.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>A routine you can hold</h3>
                <p>A short, specific home routine &#8212; and honest guidance on what you do not need to buy.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section class="content-split">
        <h2>Come <em>say hi</em></h2>
        <div>
          <p>${STUDIO.street}, ${STUDIO.suite}<br />${STUDIO.city}, ${STUDIO.state} ${STUDIO.zip}</p>
          <ul class="hours-list">
            ${HOURS.map(([day, time]) => html`<li><strong>${day}</strong><span>${time}</span></li>`)}
          </ul>
          <div class="button-row" style="margin-top:34px">
            <a class="button button-dark" href="${BOOKING_URL}">Book an appointment <span aria-hidden="true">&#8599;</span></a>
            <a class="text-link" href="${STUDIO.mapsUrl}">Directions <span aria-hidden="true">&#8594;</span></a>
          </div>
        </div>
      </section>
    </div>
  `;
}

const TREATMENTS = [
  {
    title: "Korean-infused facials",
    note: "In-studio · Tampa",
    copy: "Layered cleansing, gentle exfoliation and deep hydration, sequenced so skin leaves calm and plump rather than tight. Adjusted each visit to what your barrier can handle that day.",
  },
  {
    title: "Acne guidance",
    note: "In-person or virtual",
    copy: "A structured plan for congestion, breakouts and post-acne marks, with product coaching between visits. Available virtually if you are not in Tampa.",
  },
  {
    title: "Brows, lashes + wax",
    note: "Brow mapping available",
    copy: "Shaping mapped to your actual features, plus lash and waxing services finished with barrier-safe aftercare.",
  },
  {
    title: "Virtual skin consult",
    note: "Anywhere in the U.S.",
    copy: "A full review of your current routine and a rebuilt plan, delivered remotely &#8212; with product recommendations you can order and have shipped.",
  },
];

export function treatmentsPage() {
  return html`
    <div class="content-page section-shell">
      <div class="content-hero">
        <p class="eyebrow">Treatments</p>
        <h1>Choose your <em>care.</em></h1>
        <p>
          Every treatment is booked through Square, where your appointment history
          and reminders already live. Pricing and availability are shown at booking.
        </p>
      </div>

      <ul class="numbered-list">
        ${TREATMENTS.map((treatment, index) => html`
          <li>
            <span>0${index + 1}</span>
            <div>
              <h3>${treatment.title}</h3>
              <p>${treatment.copy}</p>
              <p style="margin-top:12px"><span class="service-note">${treatment.note}</span></p>
            </div>
          </li>
        `)}
      </ul>

      <section class="product-help" style="margin-top:90px">
        <h2>Ready when <em>you are</em></h2>
        <div>
          <p>Pick a time that works and Laura will take it from there.</p>
          <a class="button button-dark" href="${BOOKING_URL}">Book now <span aria-hidden="true">&#8599;</span></a>
        </div>
      </section>
    </div>
  `;
}

export function galleryPage() {
  return html`
    <div class="content-page section-shell">
      <div class="content-hero">
        <p class="eyebrow">Gallery</p>
        <h1>Real skin, real <em>progress.</em></h1>
        <p>Results from treatments and home-care plans built in the studio.</p>
      </div>

      ${GALLERY_IMAGES.length ? html`
        <div class="gallery-grid">
          ${GALLERY_IMAGES.map((image) => html`
            <figure>
              <img src="${image.src}" alt="${image.alt || ""}" loading="lazy" />
              ${image.caption ? html`<figcaption>${image.caption}</figcaption>` : ""}
            </figure>
          `)}
        </div>
      ` : html`
        <div class="gallery-empty">
          <h2>Photos are on the <em>way</em></h2>
          <p>
            Laura is putting together a proper before-and-after gallery. In the
            meantime, the most recent client results are posted on Instagram.
          </p>
          <div class="button-row" style="justify-content:center">
            <a class="button button-dark" href="${INSTAGRAM_URL}">See results on Instagram <span aria-hidden="true">&#8599;</span></a>
            <a class="text-link" href="${BOOKING_URL}">Book a treatment <span aria-hidden="true">&#8594;</span></a>
          </div>
        </div>
      `}
    </div>
  `;
}

export function notFoundPage() {
  return html`
    <div class="empty-cart section-shell">
      <p class="eyebrow">404</p>
      <h1>That page has <em>moved on.</em></h1>
      <p>The link may be from the old site. Try the shop, or head back home.</p>
      <div class="button-row">
        <a class="button button-dark" href="/shop">Shop the shelf</a>
        <a class="text-link" href="/">Back home <span aria-hidden="true">&#8594;</span></a>
      </div>
    </div>
  `;
}

export function legalPage({ kind, cfg }) {
  const isTerms = kind === "terms";
  const updated = "August 2026";

  const sections = isTerms ? [
    ["Who we are", html`Skin by Laura Lo operates a studio at ${STUDIO.street}, ${STUDIO.suite}, ${STUDIO.city}, ${STUDIO.state} ${STUDIO.zip}. Reach us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`],
    ["Orders and payment", html`Product orders are processed by Square on Square-hosted checkout pages. We never receive or store your card details. Prices, taxes and availability are taken from our Square catalog at the time you check out.`],
    ["Shipping and pickup", cfg.shippingEnabled
      ? html`We ship within the United States at a flat rate${cfg.freeShippingThresholdCents > 0 ? html`, free on orders over $${(cfg.freeShippingThresholdCents / 100).toFixed(0)}` : ""}. ${cfg.pickupEnabled ? "Local pickup at the Tampa studio is available at no charge." : ""} Orders are typically dispatched within a few business days.`
      : html`Orders are collected at the Tampa studio. ${STUDIO.street}, ${STUDIO.suite}.`],
    ["Returns", html`Because these are skincare products, unopened items in original condition may be returned within 14 days of delivery. Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> before sending anything back.`],
    ["Appointments", html`Appointments are booked and managed through Square Appointments. Cancellation and rescheduling terms are shown to you at the time of booking.`],
    ["Advice is not medical care", html`Guidance provided in treatments, consults and on this site is cosmetic, not medical. Speak to a physician or dermatologist about any condition that concerns you.`],
  ] : [
    ["What we collect", html`When you buy something, Square collects the details needed to take payment and fulfil your order. This website does not run its own accounts system and does not store your payment information.`],
    ["Your cart", html`Items you add to your bag are stored only in your own browser, using local storage. They are sent to our server once &#8212; at the moment you click checkout &#8212; so that a Square payment link can be created.`],
    ["Square", html`Payments, appointment bookings and gift cards are handled by Square, which processes your information under its own privacy policy. Order and appointment records live in Square, not on this site.`],
    ["Analytics and cookies", html`This site sets no advertising or tracking cookies of its own.`],
    ["Contact", html`For any privacy question, or to ask what information is held about you, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`],
  ];

  return html`
    <div class="legal-page section-shell">
      <h1>${isTerms ? "Terms & Conditions" : "Privacy Policy"}</h1>
      <p class="legal-updated">Last updated ${updated}</p>
      ${sections.map(([heading, bodyCopy]) => html`
        <section>
          <h2>${heading}</h2>
          <p>${bodyCopy}</p>
        </section>
      `)}
    </div>
  `;
}
