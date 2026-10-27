import { productInsightFor } from "./product-insights.js";
import { ROUTINES } from "./routines.js";
import { UNCATEGORIZED_LABEL } from "./square.js";

// Two uncategorized products share this label only because neither has been
// sorted in Square yet — that's not a real similarity, so a shared category
// only counts as a signal when it isn't this fallback bucket.
function sameRealCategory(a, b) {
  return a.category === b.category && a.category !== UNCATEGORIZED_LABEL;
}

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
 * Most of the tag vocabulary (Hydrating, Barrier support, Soothing...) is
 * near-universal across a calming, barrier-first catalog like this one — 3 of
 * the 7 tags each cover 70%+ of all products. Scoring every shared tag
 * equally lets those common tags swamp genuinely specific ones (Breakout
 * support, Exfoliating), so a couple of generically-tagged products end up
 * "related to" a huge slice of the catalog regardless of what's being
 * viewed. Weighting by rarity — a shared tag counts for more the fewer
 * products carry it — fixes that without hardcoding which tags matter.
 */
function tagWeights(products) {
  const frequency = new Map();
  for (const product of products) {
    for (const tag of concernTagsFor(product)) {
      frequency.set(tag, (frequency.get(tag) || 0) + 1);
    }
  }
  const weights = new Map();
  for (const [tag, count] of frequency) {
    weights.set(tag, Math.log(products.length / count) + 1);
  }
  return weights;
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
 *      barrier support, breakout support, etc.), weighted by how rare each
 *      tag is in the catalog.
 *   3. Same Square category, as a tie-breaker and a floor so a sparsely
 *      tagged product still gets 3 recommendations instead of none — but
 *      only a real category. Square has no category for some products yet,
 *      and the storefront labels those "Skincare" so they still show up
 *      somewhere; that label isn't a merchant-chosen grouping, so two
 *      uncategorized products never count as "the same category" as each
 *      other here (see sameRealCategory above).
 */
export function relatedProductsFor(product, products) {
  const candidates = products.filter((entry) => entry.slug !== product.slug);
  if (!candidates.length) return [];

  const baseTags = new Set(concernTagsFor(product));
  const baseRoutines = new Set(routineSlugsFor(product.slug));
  const weights = tagWeights(products);

  const scored = candidates.map((candidate) => {
    const sharedRoutines = routineSlugsFor(candidate.slug).filter((slug) => baseRoutines.has(slug));
    const sharedTags = concernTagsFor(candidate).filter((tag) => baseTags.has(tag));
    const tagScore = sharedTags.reduce((sum, tag) => sum + (weights.get(tag) || 1), 0);

    let score = sharedRoutines.length * 100 + tagScore;
    if (sameRealCategory(candidate, product)) score += 1;
    if (!candidate.available) score -= 5; // deprioritize, don't hard-exclude

    return { candidate, score };
  });

  scored.sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name));

  const picked = scored.filter((entry) => entry.score > 0).slice(0, 3).map((entry) => entry.candidate);

  if (picked.length < 3) {
    const pickedSlugs = new Set(picked.map((entry) => entry.slug));
    const backfill = candidates.filter(
      (entry) => !pickedSlugs.has(entry.slug) && sameRealCategory(entry, product),
    );
    picked.push(...backfill.slice(0, 3 - picked.length));
  }

  return picked.slice(0, 3);
}
