// The public ingredient checker: read a pasted ingredient list (or one of the
// shop's own formulas), flag pore-clogging ingredients, explain every
// ingredient with the shared ingredient library, and suggest products from
// Laura's shop that keep the good ingredients without the pore-cloggers.
//
// It only reads names. It never knows how much of an ingredient a product
// holds, and the page says so.

import { cleanIngredientName, ingredientProfile } from "./ingredient-library.js";
import { poreCloggerFor } from "./data/pore-cloggers.js";
import { productInsightFor } from "./product-insights.js";

export const MAX_LIST_CHARS = 6000;
const MAX_INGREDIENTS = 150;

export const GROUPS = {
  clog: { label: "Pore-clogging", order: 0 },
  note: { label: "Worth knowing", order: 1 },
  help: { label: "Skin helper", order: 2 },
  base: { label: "Formula basic", order: 3 },
};

/** A stable, readable address for an ingredient: "Cocos Nucifera (Coconut) Oil" → "cocos-nucifera-coconut-oil". */
export function ingredientSlug(name) {
  return cleanIngredientName(name)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[™®*]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Split a pasted label into ingredient names. Commas separate names except
 * inside chemical numbers such as "1,2-Hexanediol"; new lines, semicolons and
 * bullets separate too. A trailing "May contain" shade list is dropped.
 */
export function parseIngredientList(text) {
  let value = String(text || "").slice(0, MAX_LIST_CHARS);
  value = value.replace(/\b(?:may contain|\+\/-|\[\+\/-\])[\s\S]*$/i, "");
  value = value.replace(/^\s*(?:full\s+)?(?:ingredients?|ingredient list|inci)\s*:?\s*/i, "");
  const seen = new Set();
  const names = [];
  for (const part of value.split(/\s*(?:,(?!\d)|;|\r?\n|•|•|\|)\s*/)) {
    const name = cleanIngredientName(part.trim().replace(/^[-*·\s]+/, "").replace(/\*+$/, ""));
    if (!name || name.length > 120 || !/[a-z]/i.test(name)) continue;
    const key = ingredientSlug(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= MAX_INGREDIENTS) break;
  }
  return names;
}

/** One ingredient, explained and sorted into a group. */
export function describeIngredient(name) {
  const clogger = poreCloggerFor(name);
  let profile = ingredientProfile(name);
  // The library's catch-all entry says nothing useful about a pore-clogger.
  if (clogger && profile.role === "Formula support") {
    profile = {
      ...profile,
      role: clogger.role,
      description: clogger.what,
      why: "It gives the formula a richer feel or texture.",
      note: "Low on a list, or in a product you rinse off, it may cause no trouble. Acne-prone skin is safer without it.",
      level: "Comedogenicity tested",
    };
  }
  const group = clogger ? "clog" : profile.tone === "context" ? "note" : profile.tone === "supportive" ? "help" : "base";
  return { ...profile, slug: ingredientSlug(name), clogger, group, tag: GROUPS[group].label };
}

/** Check a list of names: every ingredient explained, plus the counts and verdict the page shows. */
export function checkIngredients(names) {
  const ingredients = names.map((name, index) => ({ ...describeIngredient(name), position: index + 1 }));
  const byGroup = (group) => ingredients.filter((item) => item.group === group);
  const cloggers = byGroup("clog");
  return {
    ingredients,
    cloggers,
    notes: byGroup("note"),
    helpers: byGroup("help"),
    basics: byGroup("base"),
    acneSafe: ingredients.length > 0 && cloggers.length === 0,
  };
}

// ---------------------------------------------------------------- the shop

const shopCache = new WeakMap();

/**
 * Every shop product whose formula we have on file, checked once, and every
 * ingredient in those formulas with the products that contain it.
 */
export function shopIngredientIndex(products) {
  if (shopCache.has(products)) return shopCache.get(products);
  const checked = [];
  const ingredients = new Map();
  for (const product of products) {
    const review = productInsightFor(product.name);
    if (!review?.hasFormula) continue;
    const names = (review.ingredients || []).map((item) => item.name).filter(Boolean);
    if (!names.length) continue;
    const result = checkIngredients(names);
    checked.push({ product, result, slugs: new Set(result.ingredients.map((item) => item.slug)) });
    for (const item of result.ingredients) {
      if (!item.slug) continue;
      if (!ingredients.has(item.slug)) ingredients.set(item.slug, { ...item, products: [] });
      const entry = ingredients.get(item.slug);
      if (!entry.products.some((use) => use.product.slug === product.slug)) {
        entry.products.push({ product, position: item.position, total: result.ingredients.length });
      }
    }
  }
  for (const entry of ingredients.values()) {
    entry.products.sort((a, b) => a.position / a.total - b.position / b.total);
  }
  const index = { checked, ingredients };
  shopCache.set(products, index);
  return index;
}

/** A shop product picked by its slug or (case-insensitive) name. */
export function findShopProduct(products, query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return null;
  return products.find((product) => product.slug === text || product.name.toLowerCase() === text) || null;
}

/** Shop products with a formula on file whose names contain every word typed. */
export function searchShopProducts(products, query) {
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const { checked } = shopIngredientIndex(products);
  return checked
    .map((entry) => entry.product)
    .filter((product) => words.every((word) => product.name.toLowerCase().includes(word)))
    .slice(0, 12);
}

// The kinds of product a client can be checking, in the order a name is
// tested: "Cleansing Oil" is a cleanser and "Eye Cream" an eye product, so
// the narrower kinds come first.
export const PRODUCT_TYPES = [
  { id: "sunscreen", label: "Sunscreen", test: /\bspf\b|sunscreen|sun (?:cream|gel|stick|fluid|milk|serum)|\buv\b|sun ?block/i },
  { id: "eye", label: "Eye care", test: /\beye\b/i },
  { id: "cleanser", label: "Cleanser", test: /cleans|\bwash\b|\bfoam\b|micellar|makeup remover/i },
  { id: "mask", label: "Mask", test: /\bmasks?\b|masque|sleeping pack|\bpack\b/i },
  { id: "exfoliant", label: "Exfoliant or peel", test: /\bpeel|exfoli|\bscrub|enzyme|polish|\baha\b|\bbha\b/i },
  { id: "toner", label: "Toner or mist", test: /toner|\bmist\b|essence|\btonic\b/i },
  { id: "serum", label: "Serum or treatment", test: /serum|ampoule|booster|treatment|concentrate|\bdrops\b|\bsolution\b/i },
  { id: "moisturizer", label: "Moisturizer", test: /cream|cr[eè]me|moistur|lotion|\bbalm\b|emulsion|\bgel\b|hydrator/i },
  { id: "oil", label: "Face oil", test: /\boil\b/i },
  { id: "lip", label: "Lip care", test: /\blip\b/i },
];

// Shop products whose names don't say what they are. Sets and bundles are
// left without a type, so they are never suggested as a swap.
const TYPE_OVERRIDES = [
  [/waterdrop/i, "sunscreen"],
  [/cell repair boost/i, "moisturizer"],
  [/^mixi clean$/i, "cleanser"],
  [/\bspot\b|clear plex|\bhydroxi\b|mandelic acid \d|brilliant tone/i, "serum"],
  [/\bspray\b/i, "toner"],
  [/\blip\b/i, "lip"],
  [/\bset\b|\bbundle\b|\bkit\b/i, "none"],
];

/** What kind of product a name describes, or "" when the name doesn't say. */
export function productTypeFor(name, category = "") {
  const override = TYPE_OVERRIDES.find(([test]) => test.test(String(name || "")));
  if (override) return override[1] === "none" ? "" : override[1];
  for (const text of [name, category]) {
    const type = PRODUCT_TYPES.find((item) => item.test.test(String(text || "")));
    if (type) return type.id;
  }
  return "";
}

export function productTypeLabel(id) {
  return PRODUCT_TYPES.find((item) => item.id === id)?.label || "";
}

const isFragrance = (item) => /fragrance|sensory/i.test(item.role);

/**
 * Products from Laura's shop worth suggesting instead of the checked one, and
 * only when they are both better and similar:
 *
 * - better: the checked list has a pore-clogger or fragrance, and the shop
 *   product has no pore-clogger at all, and no fragrance where the list had
 *   fragrance. A list with neither gets no suggestions.
 * - similar: the same kind of product (a cleanser for a cleanser), and at
 *   least one of the same skin helpers, so each card can say what it shares.
 *
 * Sold-out products are left out. Without a product type there is nothing to
 * compare against, so nothing is suggested and the page asks for the type.
 */
export function betterAlternatives(result, products, { type = "", exclude = "", limit = 4 } = {}) {
  const listHasFragrance = result.notes.some(isFragrance);
  if (!result.cloggers.length && !listHasFragrance) return [];
  if (!type || !result.helpers.length) return [];
  const { checked } = shopIngredientIndex(products);
  return checked
    .filter(({ product, result: theirs }) => product.slug !== exclude
      && product.available
      && productTypeFor(product.name, product.category) === type
      && theirs.cloggers.length === 0
      && !(listHasFragrance && theirs.notes.some(isFragrance)))
    .map(({ product, result: theirs, slugs }) => {
      const shared = result.helpers.filter((item) => slugs.has(item.slug));
      const reasons = [];
      if (result.cloggers.length) reasons.push("No pore-cloggers");
      if (listHasFragrance) reasons.push("No fragrance");
      return { product, shared, reasons, score: shared.length * 10 - theirs.notes.length };
    })
    .filter((match) => match.shared.length > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, limit);
}

/** A PubMed search for an ingredient's skin research. */
export function researchUrl(name) {
  const term = `"${cleanIngredientName(name).replace(/\s*\([^)]*\)\s*/g, " ").trim()}" AND (skin OR dermatology OR cosmetic)`;
  return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(term)}`;
}
