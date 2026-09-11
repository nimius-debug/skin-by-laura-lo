import { productInsightFor } from "./product-insights.js";
import { ROUTINES } from "./routines.js";

// "No added fragrance listed" is a caution/feature flag, not a shared skin
// concern — nearly every fragrance-free product would over-match on it.
const NON_CONCERN_TAGS = new Set(["No added fragrance listed"]);

function concernTagsFor(product) {
  const insight = productInsightFor(product.name);
  if (!insight) return [];
  return insight.tags.filter((tag) => !NON_CONCERN_TAGS.has(tag));
}

function routineSlugsFor(slug) {
  return ROUTINES.filter((routine) => routine.products.some((item) => item.slug === slug)).map(
    (routine) => routine.slug,
  );
}

/**
 * Pick the 3 products to show as "You may also like" on a product page.
 *
 * Same-category alone (the old approach) returns the same set for every
 * product in a category, since it's just "first 3 others, in catalog
 * order" — it never looks at the product actually being viewed. This scores
 * candidates against the viewed product instead, in priority order:
 *
 *   1. Products that share a curated routine with it (routines.js already
 *      groups products by skin concern and step, so this is the strongest,
 *      human-picked relevance signal available).
 *   2. Products whose ingredient-dossier concern tags overlap (brightening,
 *      barrier support, breakout support, etc.).
 *   3. Same Square category, as a tie-breaker and a floor so a sparsely
 *      tagged product still gets 3 recommendations instead of none.
 */
export function relatedProductsFor(product, products) {
  const candidates = products.filter((entry) => entry.slug !== product.slug);
  if (!candidates.length) return [];

  const baseTags = new Set(concernTagsFor(product));
  const baseRoutines = new Set(routineSlugsFor(product.slug));

  const scored = candidates.map((candidate) => {
    const sharedRoutines = routineSlugsFor(candidate.slug).filter((slug) => baseRoutines.has(slug));
    const sharedTags = concernTagsFor(candidate).filter((tag) => baseTags.has(tag));

    let score = sharedRoutines.length * 100 + sharedTags.length * 3;
    if (candidate.category === product.category) score += 1;
    if (!candidate.available) score -= 5; // deprioritize, don't hard-exclude

    return { candidate, score };
  });

  scored.sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name));

  const picked = scored.filter((entry) => entry.score > 0).slice(0, 3).map((entry) => entry.candidate);

  if (picked.length < 3) {
    const pickedSlugs = new Set(picked.map((entry) => entry.slug));
    const backfill = candidates.filter(
      (entry) => !pickedSlugs.has(entry.slug) && entry.category === product.category,
    );
    picked.push(...backfill.slice(0, 3 - picked.length));
  }

  return picked.slice(0, 3);
}
