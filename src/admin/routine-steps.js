// Which step of a routine a product belongs to, and roughly how long one lasts.
// Square doesn't say which step a product is, so this reads the product name
// (and its Square category and reviewed description) for the usual words. It is
// a best guess for grouping on screen: anything it can't place goes under "Other".

import { productInsightFor } from "../product-insights.js";

// `usedUpAfterDays` is a rough guess at how long one bottle lasts with daily use.
// It is only used to say a product is "probably used up"; size isn't known.
export const STEPS = [
  { id: "cleanse", label: "Cleanser", usedUpAfterDays: 90 },
  { id: "tone", label: "Toner & mist", usedUpAfterDays: 90 },
  { id: "treat", label: "Treatment & serum", usedUpAfterDays: 90 },
  { id: "moisturize", label: "Moisturizer", usedUpAfterDays: 120 },
  { id: "protect", label: "Sun protection", usedUpAfterDays: 90 },
  { id: "mask", label: "Masks", usedUpAfterDays: 120 },
  { id: "other", label: "Other", usedUpAfterDays: 120 },
];

// First match wins, so order matters: "Cleansing Oil" is a cleanser before it is an oil.
const NAME_RULES = [
  ["protect", /\bspf\b|sunscreen|sun screen|waterdrop|sun cream/i],
  ["mask", /\bmask\b/i],
  ["cleanse", /cleans|\bclean\b|\bwash\b|\bfoam\b|micellar/i],
  ["tone", /toner|\bmist\b|essence|\bspray\b/i],
  ["moisturize", /moistur|\bcream\b|lotion|\bbalm\b|emulsion|butter/i],
  ["treat", /acid|serum|ampoule|peel|booster|\bpads?\b|\bspot\b|plex|retinol|treatment|vitamin c|niacinamide/i],
];

// Used only when the name alone says nothing: the reviewed description often does ("a gel cleanser", "an SPF 40").
const SUMMARY_RULES = [
  ["protect", /\bSPF\b|sunscreen/],
  ["cleanse", /cleanser|cleansing/i],
  ["moisturize", /moisturi[sz]er|\bcream\b|\blotion\b/i],
];

export function stepFor(name, category = "") {
  const text = `${name} ${category || ""}`;
  for (const [id, pattern] of NAME_RULES) if (pattern.test(text)) return id;
  const summary = productInsightFor(name)?.summary || "";
  for (const [id, pattern] of SUMMARY_RULES) if (pattern.test(summary)) return id;
  return "other";
}

export function stepInfo(id) {
  return STEPS.find((step) => step.id === id) || STEPS[STEPS.length - 1];
}
