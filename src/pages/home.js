import { html } from "../html.js";
import { productCard, marquee } from "./components.js";
import { routineTile, routineDialog } from "./routineComponents.js";
import {
  BOOKING_URL, VIRTUAL_CONSULTATION_URL, SKIN_AUDIT_URL,
  STUDIO, HOURS, RATING, HERO_IMAGE, CLIENT_RESULTS,
} from "../config.js";
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

/** One of two orbit slots. Each carries a complete, matched transformation. */
function proofCard(slot, images) {
  const image = images[slot] || images[0] || {};
  return html`
    <figure class="hero-result" data-hero-result data-result-slot="${slot}">
      <span class="hero-result-label hero-result-label-after">After</span>
      <div class="hero-result-shot">
        ${image.src ? html`<img src="${image.src}" alt="${image.alt}" loading="lazy" />` : ""}
      </div>
      <span class="hero-result-label hero-result-label-before">Before</span>
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
        <div class="hero-stage" data-hero-stage data-result-images="${JSON.stringify(CLIENT_RESULTS.images)}">
          <div class="hero-layers" data-hero-layers>
            <!-- the ring the subject stands in front of and breaks out of -->
            <div class="hero-ring hero-ring-back" data-depth="-4"></div>
            ${proofCard(0, CLIENT_RESULTS.images)}
            ${proofCard(1, CLIENT_RESULTS.images)}
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
        <p class="hero-handwritten">${CLIENT_RESULTS.caption}</p>
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

          <p class="routines-hint">Not sure where to start? <strong>Look at the bundles below</strong> &#8212; each one is a complete routine, built for a specific concern.</p>

          <div class="routines-grid">
            ${resolvedRoutines.map((resolved) => routineTile(resolved))}
          </div>

          ${resolvedRoutines.map((resolved) => routineDialog(resolved))}
        </section>

        <section class="skin-audit-section section-shell">
          <div class="skin-audit-card">
            <div>
              <p class="eyebrow">Free Skin Audit</p>
              <h2>Already using a routine? <em>Make sure it&#8217;s working.</em></h2>
              <p>
                A quick, personalized check-in on what you&#8217;re using right now &#8212;
                what&#8217;s working, what&#8217;s not, and what to adjust. Takes a few
                minutes, no appointment needed.
              </p>
            </div>
            <a class="button button-dark" href="${SKIN_AUDIT_URL}" target="_blank" rel="noopener">
              Take the Skin Audit <span aria-hidden="true">&#8599;</span>
            </a>
          </div>
        </section>
      `;
    })()}

    <section class="results-callout">
      <div class="results-inner section-shell">
        <p class="eyebrow">Your skin can change</p>
        <h2>Less guessing. <em>More glowing.</em></h2>
        <p>Start with one honest conversation about what your skin actually needs.</p>
        <a class="button button-light" href="${VIRTUAL_CONSULTATION_URL}">Start your skin journey <span aria-hidden="true">&#8599;</span></a>
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

