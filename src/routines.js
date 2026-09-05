// Curated skin routines — content, not catalog objects.
//
// Each routine only references existing Square products by slug. Price,
// stock and photos always come live from the catalog at render time; this
// file is purely the editorial layer (names, hooks, "best for" tags, and
// each product's role in the routine).
//
// `discount` is reserved for later: today every routine prices as a plain
// sum of its (checked) items. If a real discount is added, it should be
// applied server-side at checkout — keyed off the routine slug, after the
// server re-verifies the cart actually matches that routine's products —
// never trusted from the client. Nothing here implements that yet.

export const ROUTINES = [
  {
    slug: "brighten-me-up",
    name: "Brighten Me Up",
    concern: "Dark Spots + Sun Damage",
    oneLiner: "Brighten uneven-looking skin and protect your progress.",
    hook: "Maybe you had a little too much fun in the sun.",
    description:
      "A complete brightening routine designed to improve the appearance of dark spots, uneven tone, and visible sun damage while keeping skin hydrated and protected. Brightening ingredients are paired with antioxidants, hydration, and daily SPF to help support a more even, luminous-looking complexion while protecting your progress.",
    bestFor: ["Dark spots", "Hyperpigmentation", "Uneven tone", "Sun damage", "Dullness"],
    discount: null,
    products: [
      { slug: "krx-glow-gel-cleanser", role: "A brightening cleanser featuring vitamin C, tranexamic acid, cica, and hyaluronic acid." },
      { slug: "cbd-skin-mist", role: "A soothing, hydrating mist that helps keep skin feeling calm and refreshed." },
      { slug: "krx-all-day-glow-vitamin-serum", role: "The targeted brightening step of the routine for a more luminous and even-looking complexion." },
      { slug: "krx-aquageltm-cream", role: "Lightweight hydration to keep skin comfortable and balanced." },
      { slug: "desembre-egf-waterdrop", role: "Daily sun protection formulated with growth factors and antioxidants." },
    ],
  },
  {
    slug: "reset-my-barrier",
    name: "Reset My Barrier",
    concern: "Sensitive + Irritated Skin",
    oneLiner: "Calm things down and give your barrier the support it needs.",
    hook: "When your skin is basically saying, please leave me alone.",
    description:
      "Strips the routine back to what stressed skin actually needs: gentle cleansing, soothing hydration, barrier support, nourishment, and daily protection. No unnecessary skincare chaos — just a thoughtfully curated routine designed to help stressed, sensitive skin feel calm and comfortable again.",
    bestFor: ["Sensitive", "Reactive", "Irritated", "Red-looking", "Stressed", "Compromised barrier"],
    discount: null,
    products: [
      { slug: "dermathod-moist-morning-touch-foam-cleanser", role: "A gentle foaming cleanser that clears the day without stripping the skin." },
      { slug: "krx-strengthen-protect-probiotic-face-toner", role: "A probiotic toner that helps rebuild the skin's natural defenses." },
      { slug: "neogenesis-beta-glucan-serum", role: "Calms visible redness and supports barrier recovery." },
      { slug: "krx-cica-recovery-all-day-cream", role: "Cica-rich moisture to soothe and reinforce a compromised barrier." },
      { slug: "krx-skin-filter-tinted-sunscreen-spf-50-pa-light-medium", role: "Daily SPF 50 that protects without irritating already-stressed skin." },
    ],
    note: "Best suited for light-to-medium skin tones.",
  },
  {
    slug: "give-me-the-glow",
    name: "Give Me the Glow",
    concern: "Radiance + Overall Skin Maintenance",
    oneLiner: "For when nothing is necessarily wrong — you just want the glow.",
    hook: "No major skin drama. You just want your skin to look really, really good.",
    description:
      "Combines brightening, gentle resurfacing, hydration, nourishment, and protection to help maintain smoother-looking, luminous skin. Think healthy-looking, fresh, ¿qué te hiciste? skin.",
    bestFor: ["Dullness", "Lack of radiance", "Uneven-looking texture", "Overall skin maintenance"],
    discount: null,
    products: [
      { slug: "dermathod-moist-morning-touch-foam-cleanser", role: "A gentle foaming cleanser that starts the routine off clean and comfortable." },
      { slug: "skin-recovery-mist", role: "A refreshing, hydrating mist for an instant boost of moisture." },
      { slug: "krx-all-day-glow-vitamin-serum", role: "The brightening, antioxidant-rich step behind that fresh, luminous look." },
      { slug: "krx-essence-cream-pads", role: "Hydrating pads that nourish and prep the skin for what comes next." },
      { slug: "moisture-rx-recharge", role: "Lightweight, lasting hydration that keeps skin comfortable all day." },
      { slug: "desembre-egf-waterdrop", role: "Daily sun protection with growth factors and antioxidants." },
    ],
  },
  {
    slug: "reset-the-patchiness",
    name: "Reset the Patchiness",
    concern: "Dry + Tight + Rough Skin",
    oneLiner: "Exfoliate the buildup. Quench what's underneath.",
    hook: "If your makeup keeps looking patchy, your makeup might not be the problem.",
    description:
      "Addresses more than hydration alone. The routine starts by properly cleansing and gently exfoliating built-up dead surface skin. Once that buildup is addressed, replenishing toner, rich moisture, and daily protection help quench and nourish the freshly exfoliated skin. The goal? Less buildup. Less roughness. More smooth.",
    bestFor: ["Dry", "Tight", "Rough", "Flaky", "Dull", "Makeup that applies patchy"],
    discount: null,
    products: [
      { slug: "corthe-dermo-essential-cleansing-oil", role: "An oil cleanser that melts away makeup and buildup without stripping skin." },
      { slug: "dermathod-moist-morning-touch-foam-cleanser", role: "A gentle second cleanse that leaves skin comfortable, never tight." },
      { slug: "dermagarden-enzyme-powder-cleanser", role: "The exfoliating step that helps gently remove built-up dead surface skin responsible for that rough, flaky feel." },
      { slug: "krx-strengthen-protect-probiotic-face-toner", role: "Replenishes and preps freshly exfoliated skin for moisture." },
      { slug: "corthe-rich-m-lotion", role: "Rich moisture that quenches and nourishes dry, rough texture." },
      { slug: "desembre-egf-waterdrop", role: "Daily sun protection with growth factors and antioxidants." },
    ],
  },
  {
    slug: "give-me-a-clear-slate",
    name: "Give Me a Clear Slate",
    concern: "Acne-Safe Starter Routine",
    oneLiner: "Start simple with an acne-safe foundation built for what's next.",
    hook: "Let's start with a clean slate.",
    description:
      "Intentionally different from a one-size-fits-all “acne kit.” Instead of overwhelming acne-prone skin with aggressive actives, this routine gives you a simple, acne-safe foundation with the essential cleansing, hydration, moisture, and protection your skin needs. From there, we get personal.",
    bestFor: ["Acne-prone", "Breakout-prone", "Congested skin", "Beginning your acne journey"],
    discount: null,
    products: [
      { slug: "dermathod-moist-morning-touch-foam-cleanser", role: "A gentle, acne-safe cleanser that won't over-strip reactive skin." },
      { slug: "skin-recovery-mist", role: "A calming, hydrating mist for skin that's easily irritated." },
      { slug: "mixi-dew-drops", role: "Lightweight, oil-free hydration built for acne-prone skin." },
      { slug: "moisture-rx-recharge", role: "Comfortable daily moisture that won't clog or congest." },
      { slug: "desembre-egf-waterdrop", role: "Daily sun protection with growth factors and antioxidants." },
    ],
    consultation: {
      heading: "Your basics are covered. Now let's get personal.",
      note: "Acne is not one-size-fits-all. After establishing an acne-safe foundation, the next step is a professional consultation to assess your skin and determine which targeted products and treatments should be introduced.",
      ctaLabel: "Book my acne consultation",
    },
  },
];

/**
 * Resolve a routine's product slugs against the live catalog. Products that
 * no longer exist or aren't currently purchasable are silently dropped —
 * better to show a slightly shorter routine than a broken checkbox.
 */
export function resolveRoutine(routine, products) {
  const bySlug = new Map(products.map((product) => [product.slug, product]));

  const items = routine.products
    .map(({ slug, role }) => {
      const product = bySlug.get(slug);
      if (!product) return null;
      const variation = product.defaultVariation;
      return {
        product,
        role,
        variationId: variation.id,
        priceCents: variation.priceCents,
        inStock: variation.inStock,
      };
    })
    .filter(Boolean);

  const totalCents = items
    .filter((item) => item.inStock)
    .reduce((sum, item) => sum + item.priceCents, 0);

  return { ...routine, items, totalCents };
}
