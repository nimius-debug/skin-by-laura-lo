// Ingredients commonly listed as pore-clogging (comedogenic) on the "acne-safe"
// lists estheticians use. Most trace back to the rabbit-ear comedogenicity
// tests (Kligman, Fulton) of the 1970s–80s, where these scored high.
//
// DRAFT for Laura's review: she decides what stays on this list. Keep each
// pattern narrow so a safe relative is not flagged by accident, for example
// "Sodium Lauryl Sulfate" without "Sodium Laureth Sulfate", or coconut oil
// without coconut-derived cleansers such as Coco-Caprylate.
//
// The checker only knows names, not amounts. A flagged ingredient low on a
// list, in a rinse-off product, often causes no trouble.

// Why each family is on the list.
export const PORE_CLOGGER_FAMILIES = {
  ester: "Fatty esters like this scored among the most pore-clogging ingredients in comedogenicity tests.",
  oil: "Heavy oils and butters like this are rich in fatty acids that tend to clog pores in acne-prone skin.",
  algae: "Seaweed and algae derivatives are listed as pore-clogging for acne-prone skin, even in small amounts.",
  lanolin: "Modified lanolins like this scored as pore-clogging in comedogenicity tests.",
  emulsifier: "This emulsifier scored as pore-clogging in comedogenicity tests.",
  surfactant: "Strong cleansing agents like this can irritate the pore lining and are listed as pore-clogging in leave-on products.",
  color: "Red dyes like this scored as pore-clogging in comedogenicity tests.",
};

// What each family is, for pore-cloggers the ingredient library has no entry for.
export const PORE_CLOGGER_WHAT = {
  ester: "A fatty ester: a light, oil-like ingredient that gives creams slip and a silky feel.",
  oil: "A plant or animal oil or butter used to soften and moisturize.",
  algae: "A seaweed-derived ingredient used to thicken a formula and hold moisture.",
  lanolin: "A modified form of lanolin, the wax from sheep's wool, used to soften skin.",
  emulsifier: "An ingredient that helps oil and water blend into a smooth cream.",
  surfactant: "A foaming cleansing agent.",
  color: "A red dye that colors the product.",
};

// What a pore-clogger is used for, by family: shown when the ingredient
// library has no entry of its own for it.
export const PORE_CLOGGER_ROLES = {
  ester: "Emollient · Fatty ester",
  oil: "Emollient · Oil or butter",
  algae: "Thickener · Seaweed derivative",
  lanolin: "Emollient · Lanolin derivative",
  emulsifier: "Emulsifier · Texture",
  surfactant: "Cleansing agent",
  color: "Colorant",
};

export const PORE_CLOGGERS = [
  // Fatty esters
  { name: "Isopropyl Myristate", family: "ester", test: /\bisopropyl myristate\b/i },
  { name: "Isopropyl Palmitate", family: "ester", test: /\bisopropyl palmitate\b/i },
  { name: "Isopropyl Isostearate", family: "ester", test: /\bisopropyl isostearate\b/i },
  { name: "Isopropyl Linoleate", family: "ester", test: /\bisopropyl linoleate\b/i },
  { name: "Isopropyl Lanolate", family: "lanolin", test: /\bisopropyl lanolate\b/i },
  { name: "Myristyl Myristate", family: "ester", test: /\bmyristyl myristate\b/i },
  { name: "Myristyl Lactate", family: "ester", test: /\bmyristyl lactate\b/i },
  { name: "Myristyl Propionate", family: "ester", test: /\bmyristyl propionate\b/i },
  { name: "Ethylhexyl Palmitate", family: "ester", test: /\b(?:ethylhexyl|octyl) palmitate\b/i },
  { name: "Ethylhexyl Stearate", family: "ester", test: /\b(?:ethylhexyl|octyl) stearate\b/i },
  { name: "Isocetyl Stearate", family: "ester", test: /\bisocetyl stearate\b/i },
  { name: "Isostearyl Isostearate", family: "ester", test: /\bisostearyl isostearate\b/i },
  { name: "Isostearyl Neopentanoate", family: "ester", test: /\bisostearyl neopentanoate\b/i },
  { name: "Decyl Oleate", family: "ester", test: /\b(?:iso)?decyl oleate\b/i },
  { name: "Butyl Stearate", family: "ester", test: /\bbutyl stearate\b/i },
  { name: "Stearyl Heptanoate", family: "ester", test: /\bstearyl heptanoate\b/i },
  { name: "Cetyl Acetate", family: "ester", test: /\bcetyl acetate\b/i },

  // Oils and butters
  { name: "Coconut Oil", family: "oil", test: /\bcocos nucifera\b.*\b(?:oil|butter)\b|\bcoconut (?:oil|butter)\b/i },
  { name: "Cocoa Butter", family: "oil", test: /\btheobroma cacao\b.*\bbutter\b|\bcocoa butter\b/i },
  { name: "Wheat Germ Oil", family: "oil", test: /\btriticum vulgare\b.*\bgerm oil\b|\bwheat germ oil\b/i },
  { name: "Linseed (Flax) Oil", family: "oil", test: /\blinum usitatissimum\b.*\boil\b|\b(?:linseed|flax ?seed) oil\b/i },
  { name: "Cottonseed Oil", family: "oil", test: /\bgossypium\b.*\bseed oil\b|\bcotton ?seed oil\b/i },
  { name: "Soybean Oil", family: "oil", test: /\bglycine soja\b.*\boil\b|\bsoybean oil\b/i },
  { name: "Corn Oil", family: "oil", test: /\bzea mays\b.*\boil\b|\bcorn oil\b/i },
  { name: "Shark Liver Oil", family: "oil", test: /\bshark liver oil\b/i },

  // Algae and seaweed
  { name: "Algae Extract", family: "algae", test: /\balgae\b/i },
  { name: "Carrageenan", family: "algae", test: /\bcarrageenan\b|\bchondrus crispus\b/i },

  // Lanolin derivatives
  { name: "Acetylated Lanolin", family: "lanolin", test: /\bacetylated lanolin\b/i },
  { name: "PEG-16 Lanolin", family: "lanolin", test: /\bpeg-16 lanolin\b|\bethoxylated lanolin\b/i },
  { name: "Lanolic Acid", family: "lanolin", test: /\blanolic acid\b/i },

  // Emulsifiers and fatty alcohols
  { name: "Laureth-4", family: "emulsifier", test: /\blaureth-4\b/i },
  { name: "Oleth-3", family: "emulsifier", test: /\boleth-[35]\b/i },
  { name: "Glyceryl Stearate SE", family: "emulsifier", test: /\bglyceryl stearate se\b/i },
  { name: "Oleyl Alcohol", family: "emulsifier", test: /\boleyl alcohol\b/i },

  // Cleansers and color
  { name: "Sodium Lauryl Sulfate", family: "surfactant", test: /\bsodium lauryl sulfate\b/i },
  { name: "D&C Red dyes", family: "color", test: /\bd\s*&\s*c red\b/i },
];

/** The pore-clogger entry an ingredient name matches, or null. */
export function poreCloggerFor(name) {
  const text = String(name || "");
  const entry = PORE_CLOGGERS.find((item) => item.test.test(text));
  return entry
    ? { name: entry.name, family: entry.family, role: PORE_CLOGGER_ROLES[entry.family], what: PORE_CLOGGER_WHAT[entry.family], why: PORE_CLOGGER_FAMILIES[entry.family] }
    : null;
}
