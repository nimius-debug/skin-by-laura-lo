import { PRODUCT_FORMULAS } from "./data/product-formulas.js";
import { formulaTagsFor, ingredientProfilesForFormula } from "./ingredient-library.js";

// Editorial ingredient reviews keyed to the product name supplied by Square.
// Keep this separate from the catalog so Square remains the source of truth for
// products, prices, stock, and checkout while the site owns the educational copy.

const ARCTIGENIN_INGREDIENTS = [
  {
    name: "Water",
    role: "Formula base",
    level: "Well established",
    tone: "functional",
    description: "The purified water base that dissolves and carries the formula's water-compatible ingredients.",
    why: "It creates the fluid phase of the treatment and helps the other ingredients spread evenly.",
    note: "Water itself is not an active treatment ingredient.",
  },
  {
    name: "Squalane",
    role: "Barrier support · Emollient",
    level: "Well established",
    tone: "supportive",
    featured: true,
    description: "A lightweight moisturizing lipid that softens skin and helps reduce moisture loss.",
    why: "It cushions the active ingredients and supports a smoother, more comfortable finish.",
    note: "Generally well tolerated by many skin types, though every finished formula can feel different.",
  },
  {
    name: "Propanediol",
    role: "Hydration · Solvent",
    level: "Well established",
    tone: "supportive",
    description: "A humectant and solvent that supports hydration while improving slip and ingredient delivery.",
    why: "It helps the treatment feel lightweight and distributes other ingredients through the formula.",
    note: "Widely used in leave-on skincare and generally considered well tolerated.",
  },
  {
    name: "Glycerin",
    role: "Hydration · Humectant",
    level: "Well established",
    tone: "supportive",
    featured: true,
    description: "A humectant that attracts water to the outer layers of skin for a softer, more hydrated feel.",
    why: "It helps balance the treatment and works with propanediol and pentylene glycol to support hydration.",
    note: "One of skincare's most established and broadly tolerated moisturizing ingredients.",
  },
  {
    name: "Pentylene Glycol",
    role: "Hydration · Formula support",
    level: "Well established",
    tone: "supportive",
    description: "A multifunctional humectant and solvent that also helps keep a formula stable and fresh.",
    why: "It adds light hydration, improves texture, and supports the formula's preservation system.",
    note: "Its role is primarily supportive rather than corrective.",
  },
  {
    name: "Glyceryl Stearate SE",
    role: "Emulsifier · Emollient",
    level: "Well established",
    tone: "functional",
    description: "An emulsifier that keeps the water and oil portions of the treatment evenly blended.",
    why: "It gives the product a consistent texture while adding a soft, conditioned feel.",
    note: "This is a functional ingredient, not an exfoliating acid despite the word “stearate.”",
  },
  {
    name: "Arctium Lappa Seed Oil",
    aka: "ABSO · Arctigenin-enriched burdock seed oil",
    role: "Brightening support · Botanical",
    level: "Emerging ingredient",
    tone: "supportive",
    featured: true,
    description: "Epicutis identifies its proprietary ABSO as an arctigenin-enriched extract derived from burdock seed oil.",
    why: "It is the formula's principal tone-supporting botanical and is intended to address the look of dark spots and uneven tone.",
    note: "This is a proprietary botanical ingredient with a smaller independent evidence base than long-established ingredients such as glycerin.",
    source: "https://epicutis.com/pages/epicutis-exclusive-ingredients/abso",
  },
  {
    name: "Triethyl Citrate",
    role: "Solvent · Formula support",
    level: "Established cosmetic use",
    tone: "functional",
    description: "A multifunctional ingredient used to dissolve materials and support a stable, even formula.",
    why: "It helps the treatment's oil- and water-compatible ingredients work together smoothly.",
    note: "Its value is mainly in how it supports the complete formulation.",
  },
  {
    name: "Pinus Strobus Bark Extract",
    aka: "Canadian white pine bark extract",
    role: "Antioxidant · Botanical",
    level: "Emerging ingredient",
    tone: "context",
    description: "A botanical extract included for antioxidant support against environmental oxidative stress.",
    why: "It complements the formula's ferulic acid, tocopherol, and proprietary antioxidant ingredients.",
    note: "Public ingredient-specific research is more limited than it is for established antioxidants. Botanical sensitivities are possible.",
  },
  {
    name: "Salvia Hispanica Seed Oil",
    aka: "HYVIA® · Chia seed oil extract",
    role: "Hydration · Barrier support",
    level: "Established cosmetic use",
    tone: "supportive",
    featured: true,
    description: "Epicutis describes HYVIA® as a moisturizing ingredient derived from organic, non-GMO chia seed oil.",
    why: "Its fatty-acid content helps support hydration, comfort, and the skin barrier.",
    note: "Plant oils can feel richer on very oily skin; suitability depends on the complete formula and the individual.",
    source: "https://epicutis.com/pages/epicutis-exclusive-ingredients/epicutis-exclusive-ingredients-u2a68kbf",
  },
  {
    name: "Disodium S-Phytyl Diglycoloylcysteine",
    aka: "DSD",
    role: "Antioxidant · Environmental support",
    level: "Emerging ingredient",
    tone: "supportive",
    featured: true,
    description: "A proprietary lipid-like antioxidant ingredient developed by Signum Biosciences and used by Epicutis.",
    why: "It is included to help defend against environmental oxidative stress from sources such as UV exposure and pollution.",
    note: "This supports environmental defense but does not replace broad-spectrum sunscreen.",
    source: "https://epicutis.com/pages/epicutis-exclusive-ingredients/dsd",
  },
  {
    name: "Tocopherol",
    aka: "Vitamin E",
    role: "Antioxidant · Skin conditioning",
    level: "Well established",
    tone: "supportive",
    description: "An oil-soluble antioxidant that also contributes to a conditioned, moisturized skin feel.",
    why: "It supports the oil phase and complements ferulic acid and the formula's botanical antioxidants.",
    note: "Individual sensitivities are uncommon but possible with any ingredient.",
  },
  {
    name: "Ferulic Acid",
    role: "Antioxidant · Brightening support",
    level: "Well established",
    tone: "supportive",
    featured: true,
    description: "A plant-derived antioxidant used to help defend skin from environmental oxidative stress.",
    why: "It supports the overall brightening approach and complements tocopherol and the formula's other antioxidants.",
    note: "Performance depends on concentration, stability, and the finished formulation—not simply its position in the list.",
  },
  {
    name: "Maltodextrin",
    role: "Carrier · Formula support",
    level: "Established cosmetic use",
    tone: "functional",
    description: "A carbohydrate-derived carrier and stabilizer used to help incorporate other materials consistently.",
    why: "It supports texture and ingredient dispersion rather than acting as the treatment's primary active.",
    note: "Its contribution is mainly technical and formulation-dependent.",
  },
  {
    name: "Stearyl Alcohol",
    role: "Emollient · Thickener",
    level: "Well established",
    tone: "functional",
    description: "A fatty alcohol that softens skin and helps create a stable, elegant texture.",
    why: "It gives the treatment body and helps keep the emulsion consistent.",
    note: "Fatty alcohols are different from drying alcohols such as denatured alcohol.",
  },
  {
    name: "Steareth-20",
    role: "Emulsifier",
    level: "Established cosmetic use",
    tone: "functional",
    description: "An emulsifying ingredient that helps oil- and water-based materials remain evenly mixed.",
    why: "It supports product stability, texture, and even application.",
    note: "It is present for formula performance rather than as a skin-treatment active.",
  },
  {
    name: "Sodium Phytate",
    role: "Chelator · Formula protection",
    level: "Established cosmetic use",
    tone: "functional",
    description: "A chelating ingredient that binds trace metal ions that could otherwise affect formula stability.",
    why: "It helps protect the consistency and quality of the product over time.",
    note: "Its primary function is preserving formula performance.",
  },
  {
    name: "Carbomer",
    role: "Texture · Gel former",
    level: "Well established",
    tone: "functional",
    description: "A polymer used to thicken and suspend ingredients in lightweight skincare formulas.",
    why: "It helps create the treatment's smooth texture and keeps ingredients evenly distributed.",
    note: "It is a functional texture ingredient with a long history of cosmetic use.",
  },
  {
    name: "Potassium Hydroxide",
    role: "pH adjuster",
    level: "Well established",
    tone: "functional",
    description: "A processing ingredient used in very small amounts to bring a finished formula to its intended pH.",
    why: "Correct pH supports stability, texture, and skin compatibility of the complete product.",
    note: "An ingredient's raw-material properties do not describe its behavior after it is neutralized in a finished formula.",
  },
];

const ARCTIGENIN_REVIEW = {
    eyebrow: "Ingredient review",
    heading: "Inside the formula",
    summary: "A fragrance-free brightening treatment that pairs moisturizing lipids and humectants with botanical and antioxidant support.",
    tags: ["Brightening", "Hydrating", "Barrier support", "No added fragrance"],
    bestFor: "Visible dark spots, uneven tone, dullness, and skin that needs brightening support without an exfoliating-acid step.",
    keepInMind: "Botanical sensitivities are possible. Daily broad-spectrum sunscreen remains essential when addressing discoloration.",
    lauraRead: "I like this formula for someone dealing with dark spots, uneven tone, or dullness who also wants to protect their skin barrier. It combines Epicutis' tone-supporting ABSO with squalane, glycerin, HYVIA®, DSD, and antioxidants, so the approach is supportive rather than aggressively exfoliating.",
    useNote: "Introduce it gradually if your skin is reactive. Follow the product directions, and use sunscreen every morning.",
    ingredients: ARCTIGENIN_INGREDIENTS,
    formulaSource: "https://epicutis.com/products/arctigenin-brightening-treatment",
    reviewed: "September 2026",
};

function productKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[™®]/g, "")
    .replace(/\+/g, " plus ")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

function sourceUrl(value) {
  const match = String(value || "").match(/https?:\/\/[^\s]+/);
  return match ? match[0].replace(/[.,;—-]+$/, "") : "";
}

function sourceLabel(value) {
  return String(value || "")
    .replace(/https?:\/\/[^\s]+/, "")
    .replace(/[\s:;—-]+$/, "")
    .trim() || "Published ingredient source";
}

function generatedReview(record) {
  const ingredients = ingredientProfilesForFormula(record.name, record.formula);
  const hasFormula = ingredients.length > 0;
  const needsVerification = /needed|identity check/i.test(record.confidence);
  const partial = /partial|component formulas/i.test(record.confidence);
  const notApplicable = /not applicable/i.test(record.confidence);

  return {
    eyebrow: "Ingredient review",
    heading: "Inside the formula",
    summary: notApplicable
      ? "This is a skincare device rather than a topical cosmetic, so a cosmetic ingredient list does not apply."
      : record.summary,
    tags: formulaTagsFor(ingredients, record.formula),
    bestFor: record.bestFor,
    keepInMind: record.considerations,
    lauraRead: notApplicable
      ? "This product should be evaluated by its device instructions, contraindications, eye-protection guidance, and published performance—not by a cosmetic ingredient list."
      : hasFormula
      ? `Reading the published list as a complete formula, ${record.summary.charAt(0).toLowerCase()}${record.summary.slice(1)} ${record.bestFor}`
      : "I am holding the ingredient interpretation until the current package panel can be confirmed. That is more useful—and more honest—than guessing from a product name or marketing description.",
    useNote: record.considerations,
    ingredients,
    formulaSource: sourceUrl(record.source),
    formulaSourceLabel: sourceLabel(record.source),
    confidence: record.confidence,
    reviewed: record.reviewed,
    hasFormula,
    needsVerification,
    partial,
    notApplicable,
  };
}

const REVIEWS = new Map(PRODUCT_FORMULAS.map((record) => [productKey(record.name), generatedReview(record)]));
REVIEWS.set(productKey("Arctigenin Brightening Treatment"), {
  ...ARCTIGENIN_REVIEW,
  formulaSourceLabel: "Epicutis official product page",
  confidence: "Official/current",
  hasFormula: true,
  needsVerification: false,
  partial: false,
  notApplicable: false,
});

export function productInsightFor(productName) {
  return REVIEWS.get(productKey(productName)) || null;
}

export function productInsightCoverage() {
  return {
    total: PRODUCT_FORMULAS.length,
    withFormula: PRODUCT_FORMULAS.filter((record) => Boolean(record.formula)).length,
    partial: PRODUCT_FORMULAS.filter((record) => /partial|component formulas/i.test(record.confidence)).length,
    verificationNeeded: PRODUCT_FORMULAS.filter((record) => /needed|identity check/i.test(record.confidence)).length,
  };
}
