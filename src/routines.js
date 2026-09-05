// Curated skin routines — content, not catalog objects.
//
// Each routine only references existing Square products by slug. Price,
// stock and photos always come live from the catalog at render time; this
// file is purely the editorial layer (names, hooks, "best for" tags, and
// each product's role in the routine).
//
// `discount` (in cents) applies only when every currently in-stock item in
// the routine is in the cart — buying the whole bundle, not a couple of
// items from it. It's shown in the UI as soon as that's true, but the real
// deduction happens server-side at checkout (see bundleDiscountCents below
// and its use in index.js): the server independently re-resolves each
// routine against the live catalog and only discounts a cart that actually
// contains the full set. Nothing about the discount is ever trusted from
// the client.

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
    discount: 5000,
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
    discount: 5000,
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
    discount: 5000,
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
    discount: 5000,
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
    discount: 5000,
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

  const discountedTotalCents = Math.max(0, totalCents - (routine.discount || 0));

  return { ...routine, items, totalCents, discountedTotalCents };
}

/**
 * The real, server-side version of "is this cart buying the full bundle?" —
 * used at checkout, never the client's word for it. A routine counts as
 * fully purchased when every one of its currently in-stock items (resolved
 * fresh against the live catalog, same as everywhere else) is present in
 * the cart's variation ids. Discounts from every routine that matches are
 * summed; callers should clamp the result to the cart's subtotal.
 */
export function bundleDiscountCents(cartVariationIds, products, routines = ROUTINES) {
  const cartIds = new Set(cartVariationIds);

  return routines.reduce((sum, routine) => {
    if (!routine.discount) return sum;
    const resolved = resolveRoutine(routine, products);
    const required = resolved.items.filter((item) => item.inStock).map((item) => item.variationId);
    const isFullBundle = required.length > 0 && required.every((id) => cartIds.has(id));
    return isFullBundle ? sum + routine.discount : sum;
  }, 0);
}
