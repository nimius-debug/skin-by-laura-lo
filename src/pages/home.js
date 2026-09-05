import { html } from "../html.js";
import { productCard, marquee } from "./components.js";
import { BOOKING_URL, STUDIO, HOURS, RATING, HERO_IMAGE, BEFORE_AFTER, formatMoney } from "../config.js";
import { ROUTINES, resolveRoutine } from "../routines.js";

const REVIEWS = [
  { quote: "My skin has never been calmer. Laura actually explains what she's doing and why.", name: "Destinee G." },
  { quote: "I stopped guessing at products. The routine she built me is the first one I've stuck with.", name: "Carley A." },
  { quote: "Genuinely the most relaxing facial in Tampa, and my breakouts finally cleared.", name: "Luisa T." },
];

const SERVICES = [
  {
    title: "Korean-infused facials",
    copy: "Layered, barrier-first treatments that calm inflammation and leave skin hydrated rather than stripped.",
    note: "In-studio · Tampa",
  },
  {
    title: "Acne guidance",
    copy: "A real plan for congestion and breakouts, with product coaching between visits so progress holds.",
    note: "In-person or virtual",
  },
  {
    title: "Brows, lashes + wax",
    copy: "Detailed shaping and finishing work, mapped to your features rather than a template.",
    note: "Brow mapping available",
  },
];

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
function routineTile(resolved) {
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
function routineDialog(resolved) {
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
            ${resolved.items.map((item, index) => html`
              ${index > 0 ? html`<span class="routine-plus" aria-hidden="true">+</span>` : ""}
              ${routineProductCard(item)}
            `)}
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
          <span class="routine-total">Total <strong data-routine-total>${formatMoney(resolved.totalCents)}</strong></span>
          <button class="button button-dark" type="button" data-routine-add>Add to Bag</button>
        </div>
      </div>
    </dialog>
  `;
}

/** One result card beside the ring. Holds its shape before photos exist. */
function proofCard(kind, image) {
  const label = kind === "before" ? "Before" : "After";
  return html`
    <figure class="hero-result hero-result-${kind}" data-hero-result="${kind}">
      <div class="hero-result-shot">
        ${image.src ? html`<img src="${image.src}" alt="${image.alt}" loading="lazy" />` : ""}
      </div>
      <figcaption>${label}</figcaption>
    </figure>
  `;
}

export function homePage({ products, cfg }) {
  const featured = products.slice(0, 4);
  // Falls back to the first product until a cutout is supplied.
  const heroSrc = HERO_IMAGE.src || featured[0]?.image || null;
  const heroAlt = HERO_IMAGE.src ? HERO_IMAGE.alt : (featured[0]?.name || "");

  return html`
    <section class="hero section-shell">
      <div>
        <p class="eyebrow">Tampa esthetician · Virtual acne guidance</p>
        <h1>Skin health, <em>made personal.</em></h1>
        <p class="hero-lede">
          Korean-infused facials and curated home care that calm inflammation,
          strengthen your barrier, and bring your glow back.
        </p>
        <div class="button-row">
          <a class="button button-dark" href="${BOOKING_URL}">Book your treatment <span aria-hidden="true">&#8599;</span></a>
          <a class="text-link" href="/shop">Shop Laura&#8217;s shelf <span aria-hidden="true">&#8594;</span></a>
        </div>
        <p class="hero-proof">
          <span class="stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
          <span>${RATING.score} from ${RATING.count} Google reviews</span>
        </p>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <div class="hero-stage" data-hero-stage>
          <div class="hero-layers" data-hero-layers>
            <!-- the ring the subject stands in front of and breaks out of -->
            <div class="hero-ring hero-ring-back" data-depth="-4"></div>
            ${proofCard("before", BEFORE_AFTER.before)}
            ${proofCard("after", BEFORE_AFTER.after)}
            ${heroSrc
              ? html`<img class="hero-subject" data-depth="6" src="${heroSrc}" alt="${heroAlt}"
                       width="765" height="1318" fetchpriority="high" />`
              : html`<div class="hero-subject hero-subject-empty" data-depth="6"><span>Your image here</span></div>`}
            <div class="hero-plinth" data-depth="-1"></div>
          </div>
          <div class="hero-foreground" data-hero-foreground>
            <div class="hero-ring hero-ring-front" data-depth="-4"></div>
          </div>
        </div>
        <p class="hero-handwritten">${BEFORE_AFTER.caption}</p>
      </div>
    </section>

    ${marquee([
      "Barrier-first care", "Korean-infused facials", "Real guidance", "Nationwide product delivery",
    ])}

    <section class="approach section-shell" id="about">
      <h2>The Laura Lo <em>approach</em></h2>
      <div class="approach-copy">
        <p>
          We don&#8217;t chase quick fixes. We build resilient skin &#8212; the kind that
          handles a stressful week, a change of season, or a missed night of sleep
          without falling apart.
        </p>
        <p>
          Every treatment starts with what your barrier can actually tolerate today,
          not what a trend says it should. That means fewer actives at once, more
          attention to how your skin responds, and a home routine you can genuinely keep up.
        </p>
        <a class="text-link" href="/about">More about Laura <span aria-hidden="true">&#8594;</span></a>
      </div>
    </section>

    <section class="services-block" id="services">
      <div class="section-shell">
        <div class="section-heading split-heading">
          <h2>Choose your <em>care</em></h2>
          <div>
            <p>Treatments are booked through Square, the same place your appointment history already lives.</p>
            <a class="text-link" href="/treatments">All treatments <span aria-hidden="true">&#8594;</span></a>
          </div>
        </div>
        <div class="service-list">
          ${SERVICES.map((service, index) => html`
            <a class="service-row" href="${BOOKING_URL}">
              <span class="service-number">0${index + 1}</span>
              <h3>${service.title}</h3>
              <p>${service.copy}</p>
              <span class="service-note">${service.note}</span>
              <span class="service-arrow" aria-hidden="true">&#8599;</span>
            </a>
          `)}
        </div>
      </div>
    </section>

    ${(() => {
      const resolvedRoutines = ROUTINES.map((routine) => resolveRoutine(routine, products))
        .filter((resolved) => resolved.items.length);
      if (!resolvedRoutines.length) return "";

      return html`
        <section class="routines-section section-shell" id="routines">
          <div class="section-heading split-heading">
            <h2>What does your skin <em>need right now?</em></h2>
            <div>
              <p>
                No more guessing which products work together. Choose what you want for your
                skin, and we&#8217;ll take it from there &#8212; each routine is curated to give
                your skin the right combination of cleansing, treatment, hydration, nourishment,
                and protection for its current needs.
              </p>
              <a class="text-link" href="/shop">Shop all products <span aria-hidden="true">&#8594;</span></a>
            </div>
          </div>

          <div class="routines-grid">
            ${resolvedRoutines.map((resolved) => routineTile(resolved))}
          </div>

          ${resolvedRoutines.map((resolved) => routineDialog(resolved))}
        </section>
      `;
    })()}

    <section class="results-callout">
      <div class="results-inner section-shell">
        <p class="eyebrow">Your skin can change</p>
        <h2>Less guessing. <em>More glowing.</em></h2>
        <p>Start with one honest conversation about what your skin actually needs.</p>
        <a class="button button-light" href="${BOOKING_URL}">Start your skin journey <span aria-hidden="true">&#8599;</span></a>
      </div>
    </section>

    <section class="reviews section-shell">
      <div class="section-heading split-heading">
        <h2>Client <em>love</em></h2>
        <div class="rating-large">
          <span>${RATING.score}</span>
          <small>
            <span class="stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span><br />
            ${RATING.count} Google reviews
          </small>
        </div>
      </div>
      <div class="review-grid">
        ${REVIEWS.map((review) => html`
          <blockquote>
            <span class="quote-mark" aria-hidden="true">&#8220;</span>
            <p>${review.quote}</p>
            <footer>${review.name}</footer>
          </blockquote>
        `)}
      </div>
    </section>

    <section class="visit section-shell">
      <div class="visit-card">
        <div>
          <p class="eyebrow">Come get glowy</p>
          <h2>Visit the <em>studio</em></h2>
          <p>${STUDIO.street}, ${STUDIO.suite}<br />${STUDIO.city}, ${STUDIO.state} ${STUDIO.zip}</p>
          <ul class="hours-list">
            ${HOURS.map(([day, time]) => html`<li><strong>${day}</strong><span>${time}</span></li>`)}
          </ul>
        </div>
        <div class="visit-actions">
          <a class="button button-dark" href="${BOOKING_URL}">Book in Tampa <span aria-hidden="true">&#8599;</span></a>
          <a class="text-link" href="${STUDIO.mapsUrl}">Get directions <span aria-hidden="true">&#8594;</span></a>
        </div>
      </div>
    </section>
  `;
}

