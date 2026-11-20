// The product library for client Skincare Guides.
//
// Every description and how-to line here was copied from the 15 Skincare Guide
// PDFs Laura has already sent (Canva exports), so a new guide reuses her exact
// words whenever a product has been written up before. Only typos were fixed,
// and every cleanser amount now reads "a nickel-size amount".
//
// - `why` is the "Why these products?" description. The newest beige guides
//   (Alina, Marline) win when a product was described more than once; the other
//   wordings are kept in `whyAlternates` so the editor can offer them.
// - `howTo` holds one line per routine step the product is used in.
// - `squareName` is the product's name in Square (null when it isn't sold in
//   the shop). Products not sold in the shop are left out: Laura adds those by hand.
// - `status`: "ready" (has a description), "needs-description" (the guides only
//   list it in a routine, never describe it), "check-match" (the Square product
//   it was matched to should be confirmed).
// - `seenIn` lists the guides the text came from.
//
// Square stays the source of truth for names, photos and prices. This file is
// editorial content only, like product-formulas.js.

export const GUIDE_STEPS = [
  { id: "firstCleanse", label: "First cleanse", time: "pm" },
  { id: "cleanse", label: "Cleanse", time: "both" },
  { id: "secondCleanse", label: "Second cleanse", time: "pm" },
  { id: "exfoliate", label: "Exfoliate", time: "pm" },
  { id: "mask", label: "Mask", time: "pm" },
  { id: "tone", label: "Tone", time: "both" },
  { id: "serum", label: "Serum", time: "both" },
  { id: "treat", label: "Treat", time: "both" },
  { id: "moisturize", label: "Moisturize", time: "both" },
  { id: "protect", label: "SPF", time: "am" },
  { id: "spot", label: "Spot treatment", time: "pm" },
];

// The photo-grid groups on the "Full Skincare Routine" page of the beige guides.
export const GRID_GROUPS = [
  "Cleansers",
  "Toners & Serums",
  "Moisturizer",
  "Sunscreen",
  "Spot Treatment",
  "Lips & Eyes",
  "Masks & Exfoliants",
];

// Used when a product has no how-to of its own for a step (Alina / Marline wording).
export const STEP_DEFAULTS = {
  firstCleanse: "Dispense a nickel-size amount on dry & clean hands and massage into skin with light circular movements, making sure to get every square inch of your face and neck (total process is about 1 min.). Add water until the oil becomes a milky consistency + rinse off entirely.",
  cleanse: "Dispense a nickel-size amount; add a couple drops of water to make a foamy consistency and massage onto skin with small circular movements (total process is about 1 min.). Add water + rinse—pat dry skin.",
  secondCleanse: "Use a nickel-size amount and massage onto damp skin. Take your time (at least 60 sec.). Add water + rinse + pat dry skin.",
  tone: "Spritz the skin 3-5 inches away from the skin, ensuring to cover the entire face. Tap into the skin.",
  serum: "Dispense 3-4 drops; tap into skin until mostly absorbed.",
  treat: "Dispense 1-2 pumps and tap into entire face. Avoid eye and lip area.",
  moisturize: "Dispense a quarter-sized amount; massage into the entire face and neck. Wait a few seconds so it has time to sink in.",
  protect: "Dispense two fingers length; massage and blend into the entire face and neck—try to reapply midday.",
  spot: "Tap on any active breakouts. Leave on overnight. Use as needed as the last step of your PM routine.",
};

const MANDELIC_HOWTO = "Dispense 1-2 pumps and tap into entire face. Avoid eye and lip area. Some tingling is normal in the beginning.";
const MANDELIC_WHY_ALTERNATES = [
  { text: "A gentle exfoliating treatment that helps clear clogged pores, smooth rough texture, and support acne-prone skin without being overly harsh. Mandelic acid is especially helpful for closed comedones and congestion while still being a better option for skin that is inflamed or barrier-impaired.", seenIn: ["Ashley", "Madeline", "Mariah"] },
  { text: "A gentle, but powerful acne serum that encourages cell turnover to push out congestion out of the skin, has antibacterial properties and works on skin texture.", seenIn: ["Sydney", "Destinee", "Melissa", "Jacqueline"] },
  { text: "A gentle but powerful AHA acne serum that encourages cell turnover to push out congestion out of the skin; it has antibacterial properties, smoothing texture, reducing post-inflammatory erythema and hyperpigmentation, and combating fine lines.", seenIn: ["Dalilah", "Priscilla"] },
];

export const GUIDE_PRODUCTS = [
  // ── Cleansers ─────────────────────────────────────────────────────────────
  {
    id: "corthe-cleansing-oil",
    name: "Corthe Cleansing Oil",
    shortName: "Cleansing Oil",
    squareName: "Corthe Dermo Essential Cleansing Oil",
    aliases: ["Corthe Oil Cleanser", "Oil Cleanser", "Cleansing Oil", "Corthe Cleansing Oil"],
    grid: "Cleansers",
    steps: ["firstCleanse"],
    why: "Melts away makeup, sunscreen, and excess oil in one gentle step, then emulsifies with water to rinse off clean—no residue, no greasy feel.",
    whyAlternates: [
      { text: "A gentle first cleanse that helps melt away sunscreen, makeup, excess oil, and buildup without stripping the skin.", seenIn: ["Madeline", "Mariah", "Dalilah"] },
    ],
    howTo: {
      firstCleanse: STEP_DEFAULTS.firstCleanse,
    },
    tips: ["On occasion, for a deeper cleanse, massage 2-5 minutes to pull impurities, blackheads and congestion from the skin."],
    status: "ready",
    seenIn: ["Alina", "Marline", "Priscilla", "Destinee", "Madeline", "Mariah", "Dalilah", "Grey", "Ashley", "Lizi"],
  },
  {
    id: "krx-glow-gel-cleanser",
    name: "KrX Glow Gel Cleanser",
    shortName: "KrX Gel Cleanser",
    squareName: "KrX Glow Gel Cleanser",
    aliases: ["KrX Gel Cleanser", "KrX Glow Cleanser", "Glow Cleanser", "KrX Glow Clsr."],
    grid: "Cleansers",
    steps: ["cleanse", "secondCleanse"],
    why: "A gentle, brightening gel cleanser that removes impurities without stripping the skin. Infused with soothing botanicals, antioxidants, and hydrating ingredients, it helps calm inflammation and support the skin barrier.",
    whyAlternates: [],
    howTo: {
      cleanse: "Dispense a nickel-size amount; add a couple drops of water to make a foamy consistency and massage onto skin with small circular movements (total process is about 1 min.). Add water + rinse—pat dry skin.",
      secondCleanse: "Dispense a nickel-size amount and massage onto damp skin. Take your time (at least 60 sec.). Add water + rinse + pat dry skin.",
    },
    status: "ready",
    seenIn: ["Alina", "Carson", "Lizi", "Xuxa"],
  },
  {
    id: "dermathod-moist-foam-cleanser",
    name: "Dermathod Morning Moist Cleanser",
    shortName: "Moist Foam Cleanser",
    squareName: "Dermathod Moist Morning Touch Foam Cleanser",
    aliases: ["Moist Foam Cleanser", "Moist Foam", "Dermathod Foam Cleanser", "Dermathod Foam Cleanse", "Dermathod Morning Moist Cleanser", "Dermathod Moist Morning Touch Foam Cleanser"],
    grid: "Cleansers",
    steps: ["cleanse", "secondCleanse"],
    why: "A gentle, hydrating cleanser that removes impurities without stripping. Restores balance for soft, nourished skin.",
    whyAlternates: [],
    howTo: {
      cleanse: "Dispense a nickel-size amount; apply to dry skin with small circular movements. After a few seconds, add a couple of drops of water and massage (total process is about 1 min.). Add water + rinse—pat dry skin.",
      secondCleanse: "Use a nickel-size amount and massage onto damp skin. Take your time (at least 60 sec.). Add water + rinse + pat dry skin.",
    },
    status: "ready",
    seenIn: ["Marline", "Sydney", "Priscilla", "Dalilah", "Lizi", "Ashley", "Madeline", "Mariah"],
  },
  {
    id: "krx-probiotic-cleanser",
    name: "KrX Strengthen + Protect Probiotic Cleanser",
    shortName: "KrX Probiotic Cleanser",
    squareName: "KrX Strengthen + Protect Probiotic Face Wash",
    aliases: ["KrX Probiotic Cleanser", "KrX Strengthen + Protect Probiotic Cleanser", "KrX Probiotic Face Wash"],
    grid: "Cleansers",
    steps: ["cleanse", "secondCleanse"],
    why: "A microbiome-supporting cleanser with Lactobacillus and Bifida Ferment lysates to balance pH, strengthen the barrier, and improve skin resilience. Gently cleanses while leaving skin calm, hydrated, and protected.",
    whyAlternates: [],
    howTo: {
      cleanse: "Use a nickel-size amount; apply to skin with gentle massage movement for 60 seconds. Add water + rinse.",
      secondCleanse: "Use a nickel-size amount and massage onto damp skin using gentle mini circle movements across the entire face, neck and chest. Take your time (at least 60 sec.).",
    },
    status: "ready",
    seenIn: ["Destinee"],
  },
  {
    id: "krx-cica-2-in-1-cleanser",
    name: "KrX Cica 2-in-1 Cleanser",
    shortName: "Cica 2 in 1 Cleanser",
    squareName: "KrX Cica Recovery 2 in 1 Cleanser",
    aliases: ["Cica 2 in 1 Cleanser", "KrX Cica 2-in-1 Cleanser", "KrX Cica Recovery 2 in 1 Cleanser"],
    grid: "Cleansers",
    steps: ["cleanse", "secondCleanse"],
    why: "A gentle, barrier-supporting cleanser that cleanses and lightly exfoliates while calming inflammation. Helps reduce redness, support healing, and keep acne-prone skin balanced without stripping.",
    whyAlternates: [],
    howTo: {
      cleanse: "Use a nickel-size amount; apply to dry skin with gentle massage movement for at least 60 seconds. Add water + rinse. (Optional: can be used as a soothing weekly mask, leave on 5-10 minutes.)",
      secondCleanse: "Apply a nickel-size amount of cleanser to damp skin and massage using small circle movements for at least 60 sec. Leave on as a mask for 1-2 minutes, rinse and pat dry or air dry.",
    },
    status: "ready",
    seenIn: ["Melissa"],
  },
  {
    id: "glymed-idyllic-cleanser",
    name: "GlyMed Idyllic Cleanser",
    shortName: "Idyllic Cleanser",
    squareName: "Idyllic Cleanser with 3% Mandelic Acid",
    aliases: ["Idyllic Cleanser", "GlyMed Idyllic Cleanser", "GlyMed+ Idyllic Cleanser", "Idyllic Clsr."],
    grid: "Cleansers",
    steps: ["cleanse", "secondCleanse"],
    why: "A soothing cleanser designed to calm irritation while gently cleansing the skin. It's ideal for acne-prone, sensitized skin that needs a fresh start without feeling tight, dry, or over-cleansed.",
    whyAlternates: [],
    howTo: {
      cleanse: "Use a nickel-size amount; apply to dry skin with gentle massage movement for 60 seconds. Add water + rinse.",
      secondCleanse: "Use a nickel-size amount and massage onto damp skin using small circle movements for at least 60 seconds. Rinse and pat dry or air dry.",
    },
    status: "ready",
    seenIn: ["Madeline", "Mariah", "Ashley", "Xuxa"],
  },
  {
    id: "krx-enzyme-milk-cleanser",
    name: "KrX Enzyme Milk Cleanser",
    shortName: "KrX Enzyme Milk Cleanser",
    squareName: "KrX Gentle Enzyme Milk Cleanser + Makeup Remover",
    aliases: ["KrX Enzyme Milk Cleanser", "KrX Enzyme Milk", "Enzyme Milk Cleanser"],
    grid: "Cleansers",
    steps: ["cleanse", "secondCleanse"],
    why: null,
    whyAlternates: [],
    howTo: {
      cleanse: "Use a nickel-size amount; apply to skin with gentle massage movement for 60 seconds. Add water + rinse.",
    },
    status: "needs-description",
    seenIn: ["Lizi", "Melissa"],
  },
  {
    id: "corthe-first-aid-cleanser",
    name: "Corthe Dermo Pure First Aid Cleanser",
    shortName: "First Aid Cleanser",
    squareName: "Corthe Dermo Pure First Aid Cleansing Foam",
    aliases: ["First Aid Cleanser", "First Aid Foam", "Corthe First Aid Cleanser"],
    grid: "Cleansers",
    steps: ["cleanse", "secondCleanse"],
    why: null,
    whyAlternates: [],
    howTo: {
      cleanse: "Use a nickel-size amount; apply to skin with gentle massage movement for 60 seconds. Add water + rinse.",
    },
    status: "needs-description",
    seenIn: ["Grey"],
  },
  {
    id: "mixi-clean",
    name: "Mixi Clean",
    shortName: "Mixi Cleanse",
    squareName: "Mixi Clean",
    aliases: ["Mixi Cleanse", "Mixi Clean", "Mixi Cleanser"],
    grid: "Cleansers",
    steps: ["cleanse", "secondCleanse"],
    why: null,
    whyAlternates: [],
    howTo: {
      cleanse: "Use a nickel-size amount; apply to skin with gentle massage movement for 60 seconds. Add water + rinse. *Repeat this step PM*",
    },
    status: "needs-description",
    seenIn: ["Ashley", "Madeline", "Dalilah", "Mariah"],
  },
  {
    id: "dermagarden-enzyme-powder",
    name: "Enzyme Powder Cleanser",
    shortName: "Enzyme Powder Cleanser",
    squareName: "Dermagarden Enzyme Powder Cleanser",
    aliases: ["Enzyme Powder Cleanser", "Enzyme Powder", "Dermagarden Enzyme Powder Cleanser"],
    grid: "Cleansers",
    steps: ["secondCleanse"],
    why: "A gentle exfoliating cleanser that helps remove dead skin, excess oil, and pore-clogging buildup.",
    whyAlternates: [],
    howTo: {
      secondCleanse: "Use a nickel-size amount of enzyme powder with equal parts foam cleanser, mix with water to create a soft lather, massage for 30–60 seconds, let it sit for 1–2 minutes, then add water + rinse.",
    },
    frequency: "3x a week only.",
    status: "ready",
    seenIn: ["Sydney"],
  },

  // ── Toners & mists ────────────────────────────────────────────────────────
  {
    id: "corthe-first-aid-toner",
    name: "Corthe Dermo Pure First Aid Toner",
    shortName: "First Aid Toner",
    squareName: "Corthe Dermo Pure First Aid Toner",
    aliases: ["First Aid Toner", "First Aid", "Corthe First Aid Toner"],
    grid: "Toners & Serums",
    steps: ["tone"],
    why: "Balance and prep the skin. It uses antimicrobial agents and oil-regulating enzymes to prevent acne and manage oiliness, while also soothing and brightening the skin.",
    whyAlternates: [],
    howTo: {
      tone: "Spray a generous amount to entire face and tap into skin (wait until mostly absorbed).",
    },
    status: "ready",
    seenIn: ["Priscilla", "Grey", "Marline", "Ashley", "Madeline", "Dalilah", "Mariah"],
  },
  {
    id: "glymed-skin-recovery-mist",
    name: "GlyMed+ Skin Recovery Mist",
    shortName: "Skin Recovery Mist",
    squareName: "Skin Recovery Mist",
    aliases: ["Skin Recovery Mist", "GlyMed Skin Recovery Mist", "GlyMed+ Skin Recovery Mist"],
    grid: "Toners & Serums",
    steps: ["tone"],
    why: "A soothing, hydrating mist that replenishes moisture, calms irritation, and supports barrier repair. Ideal for reducing post-acne redness and keeping skin hydrated throughout the day.",
    whyAlternates: [],
    howTo: {
      tone: "Spritz the skin 3-5 inches away from the skin, ensuring to cover the entire face. Tap into the skin.",
    },
    status: "ready",
    seenIn: ["Alina", "Melissa"],
  },
  {
    id: "glymed-cbd-skin-mist",
    name: "GlyMed+ CBD Skin Mist",
    shortName: "CBD Skin Mist",
    squareName: "CBD SKIN MIST",
    aliases: ["CBD Skin Mist", "GlyMed+ CBD Skin Mist", "Glymed CBD Skin Mist"],
    grid: "Toners & Serums",
    steps: ["tone"],
    why: null,
    whyAlternates: [],
    howTo: {
      tone: "Spritz the skin 3-5 inches away from the skin, ensuring to cover the entire face. Tap into the skin.",
    },
    status: "needs-description",
    seenIn: ["Lizi", "Melissa"],
  },
  {
    id: "krx-probiotic-toner",
    name: "KrX Strengthen + Protect Toner",
    shortName: "KrX Probiotic Toner",
    squareName: "KrX Strengthen + Protect Probiotic Face Toner",
    aliases: ["KrX Probiotic Toner", "KrX Strengthen + Protect Toner", "KrX Strengthen & Protect Probiotic Toner", "KrX Strengthen + Protect Probiotic Toner"],
    grid: "Toners & Serums",
    steps: ["tone"],
    why: "A refreshing, probiotic-packed toner that hydrates, soothes, and strengthens your skin barrier. Powered by Cica, Lactobacillus ferment, and antioxidants like Vitamin C and glutathione to calm redness, fight free radicals, and lock in moisture. A daily essential for calm, resilient skin.",
    whyAlternates: [
      { text: "A barrier-supportive toner that helps hydrate, rebalance, and support the skin microbiome.", seenIn: ["Madeline", "Mariah"] },
    ],
    howTo: {
      tone: "Shake the bottle prior to use, then dispense 3-5 drops onto palms of hands and tap into skin.",
    },
    status: "ready",
    seenIn: ["Jacqueline", "Madeline", "Mariah", "Ashley"],
  },
  {
    id: "krx-clear-prevent-toner",
    name: "Clear + Prevent Toner",
    shortName: "Clear + Prevent Toner",
    squareName: "KRX Clear + Prevent Anti-Acne Toner",
    aliases: ["Clear + Prevent Toner", "Clear & Prevent Toner", "Clear & Prevent Acne Toner", "KrX Clear + Prevent Toner"],
    grid: "Toners & Serums",
    steps: ["tone"],
    why: "A balancing toner that helps keep pores clear, calm inflammation, and support breakout prevention while prepping the skin for treatment products.",
    whyAlternates: [],
    howTo: {
      tone: "Dispense 3-4 drops in your palms and pat directly onto face & neck.",
    },
    status: "ready",
    seenIn: ["Lizi"],
  },
  {
    id: "medipair-plasma-mist",
    name: "Medipair Plasma Mist",
    shortName: "Plasma Toner",
    squareName: "Medipair Plasma Toner",
    aliases: ["Plasma Mist", "Plasma Toner", "Medipair Plasma Mist", "Medipair Plasma Toner"],
    grid: "Toners & Serums",
    steps: ["tone"],
    why: "Soothe, disinfect, and prep your skin barrier. This isn't your average toner — Plasma Mist uses liquid plasma, a cutting-edge technology that delivers antibacterial, anti-inflammatory, and skin-repairing benefits without irritation. It calms redness, helps eliminate breakout-causing bacteria, and primes your skin for the rest of your routine. Great for post-workout use, after treatments like microneedling or peels, or anytime your skin feels inflamed or reactive.",
    whyAlternates: [],
    howTo: {
      tone: "Spray or tap a generous amount to entire face.",
    },
    status: "check-match",
    seenIn: ["Carson"],
  },
  {
    id: "magic-molecule-spray",
    name: "Magic Molecule Hypochlorous Acid Spray",
    shortName: "Magic Molecule",
    squareName: "Magic Molecule Hypochlorous Acid Spray - 2oz.",
    aliases: ["Magic Molecule", "Magic Molecules", "Hypochlorous Acid Spray", "Magic Molecule Hypochlorous Acid Spray - 8oz."],
    grid: "Toners & Serums",
    steps: ["tone"],
    why: "Hypochlorous acid spray by Magic Molecule is one of my favorite tools because it mirrors a substance your body naturally produces to fight off bacteria and inflammation. It's gentle enough for everyday use (even on babies) and remarkably effective at calming active breakouts, soothing irritation, and speeding up the healing process for cuts, scrapes, and burns.",
    whyAlternates: [],
    howTo: {
      tone: "Simply mist it onto clean skin—focus on areas prone to breakouts (or post-picking) or irritation—and let it air dry; there's no need to rinse.",
    },
    tips: ["Use as needed to calm or control bacteria after sweating, or whenever you can't cleanse right away."],
    status: "ready",
    seenIn: ["Alina", "Marline", "Melissa", "Mariah"],
  },

  // ── Serums & treatments ───────────────────────────────────────────────────
  {
    id: "corthe-cica-ampoule",
    name: "Cica Ampoule",
    shortName: "Cica Ampoule",
    squareName: "Corthe Dermo Sensitive Cica Ampoule",
    aliases: ["Cica Ampoule", "Corthe Cica Ampoule", "Corthe Dermo Sensitive Cica Ampoule"],
    grid: "Toners & Serums",
    steps: ["serum"],
    why: "A concentrated cica (Centella Asiatica) serum that calms inflammation, strengthens the barrier, and speeds post‑inflammatory fade—perfect support during brightening routines.",
    whyAlternates: [],
    howTo: {
      serum: "Use 3-4 drops; tap into skin until mostly absorbed.",
    },
    status: "ready",
    seenIn: ["Ashley", "Jacqueline", "Lizi", "Melissa"],
  },
  {
    id: "mixi-dew-drops",
    name: "Dew Drop Serum",
    shortName: "Mixi Dew Drops",
    squareName: "Mixi Dew Drops",
    aliases: ["Mixi Dew Drops", "Dew Drop Serum", "Dew Drops"],
    grid: "Toners & Serums",
    steps: ["serum"],
    why: "A hydration superhero that plumps and moisturizes skin with ingredients like Beta-Glucan, Watermelon Extracts, and Hyaluronic Acid. It's oil-free to prevent clogged pores.",
    whyAlternates: [],
    howTo: {
      serum: "Dispense 3-4 drops; tap into skin until mostly absorbed.",
    },
    status: "ready",
    seenIn: ["Marline", "Sydney", "Ashley", "Madeline", "Dalilah", "Mariah"],
  },
  {
    id: "neogenesis-beta-glucan",
    name: "NeoGenesis Beta-Glucan Serum",
    shortName: "Beta Glucan Serum",
    squareName: "NeoGenesis Beta-Glucan Serum",
    aliases: ["Beta Glucan Serum", "Beta-Glucan Serum", "Pure Beta-Glucan Serum"],
    grid: "Toners & Serums",
    steps: ["serum"],
    why: "A concentrated recovery serum powered by Beta-Glucan from Shiitake mushrooms to support barrier repair, reduce redness, and stimulate collagen and elastin production. Ideal for compromised, inflamed, or post-procedure skin needing advanced healing support.",
    whyAlternates: [
      { text: "This serum is amazing for immediate irritation relief! So think sunburn, eczema/rosacea/psoriasis flare up. Derived from Shiitake mushrooms, it boosts skin repair, enhances hydration, and calms irritation. Use as needed and plays well with others.", seenIn: ["Destinee"] },
    ],
    howTo: {
      serum: "Use 3-4 drops; tap into skin.",
    },
    status: "ready",
    seenIn: ["Destinee"],
  },
  {
    id: "medipair-calming-booster",
    name: "Medipair Calming Booster",
    shortName: "Calming Booster",
    squareName: "Medipair Calming Serum",
    aliases: ["Calming Booster", "Medipair Calming Booster", "Medipair Calming Serum"],
    grid: "Toners & Serums",
    steps: ["serum"],
    why: "Ultimate soothing + barrier repair. This powerful booster is packed with seven vegan botanical complexes, multi-molecular hyaluronic acids, and hydrolyzed collagen to deeply calm, hydrate, and reinforce your skin barrier. It's perfect for sensitive or post-treatment skin — or anytime you want to prevent inflammation from strong actives.",
    whyAlternates: [],
    howTo: {
      serum: "Dispense a full dropper's worth onto hands and tap into your skin; allow to mostly absorb, 15-30 seconds.",
    },
    status: "check-match",
    seenIn: ["Carson"],
  },
  {
    id: "mixi-mandelic-5",
    name: "Mixi Mandelic Acid 5%",
    shortName: "Mandelic 5%",
    squareName: "Mixi Mandelic Acid 5%",
    aliases: ["Mandelic 5%", "Mixi Mandelic 5%", "Mixi Mandelic Acid", "Mandelic Acid", "Mandelic 5% Serum"],
    grid: "Toners & Serums",
    steps: ["treat"],
    why: "A gentle, antibacterial exfoliating serum that helps treat and prevent acne by promoting healthy cell turnover, reducing congestion, and improving texture and post-acne marks—without irritation.",
    whyAlternates: MANDELIC_WHY_ALTERNATES,
    howTo: {
      treat: MANDELIC_HOWTO,
    },
    frequency: "Use every other night for 2 weeks, then bump to every night.",
    guides: ["purging-tip"],
    status: "ready",
    seenIn: ["Alina", "Madeline", "Mariah", "Ashley", "Dalilah", "Priscilla", "Jacqueline", "Lizi", "Xuxa"],
  },
  {
    id: "mixi-mandelic-8",
    name: "Mixi Mandelic Acid 8%",
    shortName: "Mandelic 8%",
    squareName: "Mixi Mandelic Acid 8%",
    aliases: ["Mandelic 8%", "8% Mandelic Acid", "Mixi Mandelic 8%"],
    grid: "Toners & Serums",
    steps: ["treat"],
    why: "Gentle exfoliation + deep pore clearing. This alpha hydroxy acid (AHA) is ideal for congested, acne-prone skin. Mandelic acid encourages cell turnover to push out buildup trapped in pores while offering antibacterial and brightening benefits.",
    whyAlternates: MANDELIC_WHY_ALTERNATES,
    howTo: {
      treat: MANDELIC_HOWTO,
    },
    frequency: "Use every other day.",
    guides: ["purging-tip", "mandelic-step-up"],
    status: "ready",
    seenIn: ["Carson", "Sydney", "Ashley", "Destinee", "Lizi", "Marline"],
  },
  {
    id: "mixi-mandelic-11",
    name: "Mixi Mandelic Acid 11%",
    shortName: "Mandelic 11%",
    squareName: "Mixi Mandelic Acid 11%",
    aliases: ["Mandelic 11%", "11% Mandelic", "Mixi Mandelic 11%"],
    grid: "Toners & Serums",
    steps: ["treat"],
    why: "A gentle, but powerful acne serum that encourages cell turnover to push out congestion out of the skin, has antibacterial properties and works on skin texture.",
    whyAlternates: MANDELIC_WHY_ALTERNATES.slice(0, 1),
    howTo: {
      treat: MANDELIC_HOWTO,
    },
    guides: ["mandelic-step-up"],
    status: "ready",
    seenIn: ["Marline", "Ashley", "Madeline", "Dalilah", "Mariah"],
  },
  {
    id: "mixi-clear-plex-2-8",
    name: "Clear Plex 2.8%",
    shortName: "Clear Plex 2.8%",
    squareName: "Mixi Clear Plex 2.8%",
    aliases: ["Clear Plex", "ClearPlex", "Clearplex 2.8%", "Clear Plex 2.8%", "Mixi Clear Plex 2.8%", "Clear Plex Acne Gel"],
    grid: "Toners & Serums",
    steps: ["treat"],
    why: "Benzoyl peroxide-based cream (non-micronized, less irritation/redness). Targets inflamed acne by oxygenating pores & eliminating bacteria.",
    whyAlternates: [
      { text: "Targeted treatment for active breakouts. This benzoyl peroxide gel works overnight to penetrate deep into pores, oxygenate the skin, and kill acne-causing bacteria at the source. It also reduces inflammation and helps prevent new breakouts from forming.", seenIn: ["Carson"] },
    ],
    howTo: {
      treat: "Use 1 pump (a nickel-size amount); apply to skin avoiding brows + eye area. Allow 1-2 min. dry time.",
    },
    warnings: [
      "Avoid the hairline, eyebrows, and eye area—benzoyl peroxide can bleach hair and fabrics.",
      "Do not use a benzoyl peroxide product on the same night as retinol.",
    ],
    guides: ["clear-plex-nightly", "clear-plex-short-contact"],
    status: "ready",
    seenIn: ["Madeline", "Mariah", "Sydney", "Carson", "Ashley", "Dalilah", "Marline"],
  },
  {
    id: "mixi-hydroxi",
    name: "Hydroxi Serum",
    shortName: "Hydroxi",
    squareName: "Mixi Hydroxi",
    aliases: ["Hydroxi", "Hydroxi Serum", "Mixi Hydroxi"],
    grid: "Toners & Serums",
    steps: ["treat"],
    why: "An innovative formula that combines hydrogen peroxide and salicylic acid to detoxify and clarify the skin. It targets acne-causing bacteria, unclogs pores, and refines texture, while retinal palmitate supports gentle cell turnover. Hydrating and soothing, for rosacea & sensitive skin.",
    whyAlternates: [],
    howTo: {
      treat: "Use a dime- to nickel-size amount; apply to skin avoiding brows + eye area. Wait 1-2 min. until mostly absorbed before the next step.",
    },
    status: "ready",
    seenIn: ["Jacqueline", "Marline", "Ashley", "Madeline", "Dalilah", "Mariah"],
  },
  {
    id: "dermathod-booster-pads",
    name: "Dermathod Priming Peel Booster",
    shortName: "Dermathod Booster Pads",
    squareName: "Dermathod Priming Peel Booster",
    aliases: ["Dermathod Booster Pads", "Booster Pads", "Exfoliating Booster Pads", "Dermathod Booster Pad", "Dermathod Peel Pad", "Dermathod Priming Peel Booster"],
    grid: "Masks & Exfoliants",
    steps: ["exfoliate"],
    why: "Redefining exfoliation with a combination of slow-releasing PHA and LHA (a 2nd generation of acids, think AHAs' and BHAs' baby sisters) designed to remain on the skin and provide increased cell turnover to help reduce acne, hyperpigmentation and fine lines, while skin-friendly oils (grapeseed + rosemary) nourish and protect the barrier.",
    whyAlternates: [
      { text: "Leave-on PHA + LHA resurface to smooth, brighten, and soften while nourishing oils protect the barrier.", seenIn: ["Ashley", "Destinee"] },
    ],
    howTo: {
      exfoliate: "Use half a pad or 1 single pad, swiping across your face and neck (rough side, then soft side). Avoid brows + eye area. Wait 5-10 min. before the next step.",
    },
    frequency: "2-3x a week ONLY.",
    warnings: ["Avoid using the same night as shaving."],
    tips: ["Use the remaining pad on underarms, knees or any body area with darkness or texture."],
    guides: ["booster-pads-schedule", "booster-pads-how-to"],
    status: "ready",
    seenIn: ["Grey", "Ashley", "Destinee", "Lizi", "Melissa", "Xuxa"],
  },
  {
    id: "retinol-rejuvenation-serum",
    name: "Retinol Rejuvenation Serum",
    shortName: "Retinol Rejuv Serum",
    squareName: "Retinol Rejuvenation Serum",
    aliases: ["Retinol Rejuv Serum", "Retinol Serum", "Retinol Rejuvenation Serum"],
    grid: "Toners & Serums",
    steps: ["treat"],
    why: null,
    whyAlternates: [],
    howTo: {
      treat: "Apply 1-2 pumps every other night (on nights you don't use mandelic).",
    },
    warnings: ["Do not use a benzoyl peroxide product on the same night as retinol."],
    status: "needs-description",
    seenIn: ["Lizi"],
  },
  {
    id: "krx-glow-serum",
    name: "KrX Glow Serum",
    shortName: "Glow Serum",
    squareName: "KrX All-Day Glow Vitamin Serum",
    aliases: ["Glow Serum", "KrX Glow Serum", "KrX All-Day Glow Vitamin Serum"],
    grid: "Toners & Serums",
    steps: ["serum"],
    why: null,
    whyAlternates: [],
    howTo: {},
    translations: {
      es: {
        why: "Sérum ligero con niacinamida, ácido tranexámico, glutatión y vitamina C que ayuda a iluminar, mejorar manchas y tono desigual, suavizar líneas finas y reforzar la hidratación y barrera de la piel.",
        howTo: { serum: "Dispensa 4–5 gotas del sérum y aplícalas sobre la piel con suaves toquecitos." },
      },
    },
    status: "needs-description",
    seenIn: ["Xuxa"],
  },
  {
    id: "corthe-spot-for-night",
    name: "Corthe Spot for Night",
    shortName: "Spot For The Night",
    squareName: "Corthe Dermo Pure Spot For Night",
    aliases: ["Spot For The Night", "Spot for Night", "Corthe Spot for Night"],
    grid: "Spot Treatment",
    steps: ["spot"],
    why: "A targeted overnight treatment for active, inflamed breakouts, including stubborn cystic blemishes. Helps soothe irritation, reduce the appearance of redness, and support the skin's natural healing process without unnecessarily treating unaffected areas.",
    whyAlternates: [],
    howTo: {
      spot: "Dip a clean Q-tip into the separated liquid bottle all the way down to the bottom. Tap on any active breakouts. Leave on overnight. Use as needed as the last step of your PM routine. (Do not shake bottle or double-dip.)",
    },
    status: "ready",
    seenIn: ["Marline", "Lizi"],
  },

  // ── Moisturizers ──────────────────────────────────────────────────────────
  {
    id: "corthe-rich-m-cream",
    name: "Corthe Rich M Cream",
    shortName: "Rich M Cream",
    squareName: "Corthe Dermo Essential Rich M Cream",
    aliases: ["Rich M Cream", "Corthe Rich M Cream"],
    grid: "Moisturizer",
    steps: ["moisturize"],
    why: "A nourishing, barrier-repairing moisturizer that replenishes hydration, calms irritation, and strengthens the skin's protective barrier. Helps keep acne-prone skin balanced, comfortable, and resilient throughout treatment.",
    whyAlternates: [],
    howTo: {
      moisturize: STEP_DEFAULTS.moisturize,
    },
    status: "ready",
    seenIn: ["Marline", "Lizi", "Melissa"],
  },
  {
    id: "corthe-rich-m-lotion",
    name: "Corthe Rich M Lotion",
    shortName: "Rich M Lotion",
    squareName: "Corthe Rich M Lotion",
    aliases: ["Rich M Lotion", "Corthe Rich M Lotion"],
    grid: "Moisturizer",
    steps: ["moisturize"],
    why: "Your skin's daily dose of nourishment. This lightweight, barrier‑boosting lotion delivers deep hydration with ceramides and barrier-supporting actives. Perfect for restoring comfort while keeping skin balanced and protected throughout the day.",
    whyAlternates: [],
    howTo: {
      moisturize: "Use a quarter-size amount; massage into the entire face and neck. Wait a few seconds so it has time to sink in.",
    },
    status: "ready",
    seenIn: ["Destinee"],
  },
  {
    id: "corthe-moisture-rx",
    name: "Corthe Moisture RX Recharge",
    shortName: "Moisture RX Recharge",
    squareName: "Moisture RX Recharge",
    aliases: ["Moisture RX Recharge", "Moisture RX", "Corthe Moisture Rx Recharge", "Corthe Moisture RX Recharging Cream", "Moisture RX Recharging"],
    grid: "Moisturizer",
    steps: ["moisturize"],
    why: "Lightweight, fast-absorbing hydrator delivers deep water binding and barrier support without clogging pores. Use AM & PM after serums to hydrate and calm skin.",
    whyAlternates: [
      { text: "This lightweight, oil-free moisturizer, formulated with soothing ingredients like aloe vera, centella asiatica, and hyaluronic acid, calms and nourishes the skin without leaving a sticky residue.", seenIn: ["Jacqueline"] },
    ],
    howTo: {
      moisturize: "Use a nickel-size amount; massage into the entire face and neck. Wait a few seconds so it has time to sink in.",
    },
    status: "ready",
    seenIn: ["Priscilla", "Jacqueline", "Grey", "Madeline", "Mariah", "Ashley"],
  },
  {
    id: "corthe-first-aid-lotion",
    name: "Corthe Dermo Pure First Aid Lotion",
    shortName: "First Aid Lotion",
    squareName: "Corthe Dermo Pure First Aid Lotion",
    aliases: ["First Aid Lotion", "Corthe First Aid Lotion"],
    grid: "Moisturizer",
    steps: ["moisturize"],
    why: null,
    whyAlternates: [],
    howTo: {
      moisturize: "Use a nickel-size amount; massage into the entire face and neck.",
    },
    status: "needs-description",
    seenIn: ["Marline", "Ashley", "Madeline", "Dalilah", "Mariah"],
  },
  {
    id: "soba-calm-cream",
    name: "Soba Calm Cream",
    shortName: "Soba Calm Cream",
    squareName: "Soba Calm Cream",
    aliases: ["Soba Calm Cream", "Soba Cream"],
    grid: "Moisturizer",
    steps: ["moisturize"],
    why: "A soothing, barrier-repairing moisturizer that calms sensitivity, reduces redness, and locks in hydration—ideal when using active treatments.",
    whyAlternates: [
      { text: "Delivers a refreshing burst of lightweight hydration while helping balance excess oil and support a calm, resilient skin barrier.", seenIn: ["Sydney"] },
    ],
    howTo: {
      moisturize: "Use a nickel-size amount; massage into the entire face and neck. Wait a few seconds so it has time to sink in.",
    },
    status: "ready",
    seenIn: ["Lizi", "Melissa", "Sydney"],
  },
  {
    id: "krx-aquagel-cream",
    name: "KrX Aquagel Cream",
    shortName: "Aquagel Cream",
    squareName: "KrX AquaGel™ Cream",
    aliases: ["Aquagel Cream", "Aqua Cream", "KrX Aquagel Cream", "KrX AquaGel Cream"],
    grid: "Moisturizer",
    steps: ["moisturize"],
    why: null,
    whyAlternates: [],
    howTo: {
      moisturize: "Use a nickel-size amount; massage into the entire face and neck. Wait a few seconds so it has time to sink in.",
    },
    translations: {
      es: {
        why: "Una crema hidratante ligera que ayuda a mantener la hidratación de la piel sin dejar una sensación pesada. Fortalece la barrera cutánea, especialmente mientras utilizamos productos activos.",
      },
    },
    status: "needs-description",
    seenIn: ["Carson", "Dalilah", "Xuxa"],
  },
  {
    id: "krx-cica-recovery-cream",
    name: "KrX Cica Recovery All Day Cream",
    shortName: "Cica All Day Cream",
    squareName: "KrX Cica Recovery All Day Cream",
    aliases: ["Cica All Day Cream", "Cica Recovery Cream", "KrX Cica Recovery Cream"],
    grid: "Moisturizer",
    steps: ["moisturize"],
    why: null,
    whyAlternates: [],
    howTo: {
      moisturize: "Use a nickel-size amount; massage into the entire face and neck.",
    },
    status: "needs-description",
    seenIn: ["Jacqueline", "Destinee"],
  },

  // ── Sunscreen ─────────────────────────────────────────────────────────────
  {
    id: "pfect-a-solar-elixir",
    name: "Pfect-A Solar Elixir SPF 50",
    shortName: "Pfect-A Solar Elixir",
    squareName: "Pfect-A Solar Elixir Serum Sunscreen",
    aliases: ["Pfect-A Solar Elixir", "Pfecta Solar Elixir", "Pfect-A Solar Elixir SPF 50", "Pfect-A Solar Barrier Elixir", "Pfect-A Solar Elixir SPF"],
    grid: "Sunscreen",
    steps: ["protect"],
    why: "A lightweight, serum-like sunscreen that provides daily broad-spectrum UV protection while hydrating and nourishing the skin. Formulated with niacinamide and antioxidants to support a brighter, more even complexion and help prevent post-acne marks from darkening.",
    whyAlternates: [
      { text: "Sunscreen with weightless hydration that leaves an invisible, silky finish (no white cast). The serum-like texture layers effortlessly over moisturizers and under makeup without feeling heavy or greasy, making it an ideal companion for everyday wear.", seenIn: ["Dalilah"] },
    ],
    howTo: {
      protect: STEP_DEFAULTS.protect,
    },
    guides: ["spf-two-finger-rule"],
    status: "ready",
    seenIn: ["Marline", "Dalilah", "Grey", "Carson"],
  },
  {
    id: "desembre-waterdrop",
    name: "Desembre Waterdrop Sunblock",
    shortName: "Waterdrop Sunblock",
    squareName: "Desembre EGF Waterdrop",
    aliases: ["Waterdrop Sunblock", "Desembre Waterdrop", "Desembre Waterdrop Sunblock", "Desembre SPF 40", "Desembre E.G.F Water Drop SPF 40"],
    grid: "Sunscreen",
    steps: ["protect"],
    why: "A lightweight SPF 50+ sunscreen formulated with growth factors, hyaluronic acid, and niacinamide to protect against UV damage.",
    whyAlternates: [],
    howTo: {
      protect: STEP_DEFAULTS.protect,
    },
    guides: ["spf-two-finger-rule"],
    status: "ready",
    seenIn: ["Sydney", "Priscilla", "Xuxa"],
  },
  {
    id: "krx-tinted-spf",
    name: "KrX Skin Filter Tinted Sunscreen SPF 50",
    shortName: "KrX Tinted SPF",
    squareName: "KrX Skin Filter Tinted Sunscreen SPF 50 PA+++ - Light/Medium",
    aliases: ["KrX Tinted SPF", "KrX Tinted Sunscreen", "KrX Skin Filter Tinted Sunscreen SPF 50 PA+++ - Medium/Dark"],
    grid: "Sunscreen",
    steps: ["protect"],
    why: null,
    whyAlternates: [],
    howTo: {
      protect: "Dispense two fingers length; massage and blend into the entire face and neck—try to reapply midday. Blend with a makeup brush for a faster, mess-free application.",
    },
    guides: ["spf-two-finger-rule"],
    status: "needs-description",
    seenIn: ["Marline", "Lizi", "Melissa", "Destinee"],
  },

  // ── Masks ─────────────────────────────────────────────────────────────────
  {
    id: "glymed-sulfur-mask",
    name: "GlyMed Mattifying Sulfur Mask",
    shortName: "Sulfur Masque",
    squareName: "Mattifying Sulfur Masque",
    aliases: ["Sulfur Masque", "Sulfur Mask", "Mattifying Sulfur Mask", "GlyMed Mattifying Sulfur Mask", "Sulfur and Clay Mask"],
    grid: "Masks & Exfoliants",
    steps: ["mask", "spot"],
    why: "Used once a week, this mask helps reduce excess oil, calm inflamed breakouts, and decongest the skin. Sulfur is especially helpful when acne may have a fungal component, making this a great weekly reset for breakout-prone skin. Doubles as a spot treatment.",
    whyAlternates: [
      { text: "This mask primarily works to relieve inflammation, reduce bacteria (caused by acne or rosacea) and detox skin (remove impurities + oil buildup). This product can be used as a mask weekly (not recommended on days you exfoliate) or as a spot treatment (any day).", seenIn: ["Destinee"] },
    ],
    howTo: {
      mask: "Use a quarter-size amount to cover the entire face area. Let sit for 10-15 min. Rinse off and pat dry to move on to skincare as normal.",
      spot: "Use the sulfur mask as an overnight spot treatment for active, inflamed breakouts only. Use as needed as the last step of your PM routine.",
    },
    frequency: "1-2x a week.",
    status: "ready",
    seenIn: ["Madeline", "Mariah", "Dalilah", "Priscilla", "Ashley", "Destinee", "Alina"],
  },
  {
    id: "glymed-hydrating-enzyme-mask",
    name: "GlyMed+ Hydrating Enzyme Mask",
    shortName: "Hydrating Enzyme Masque",
    squareName: "Hydrating Mask",
    aliases: ["Hydrating Enzyme Masque", "Hydrating Enzyme Mask", "GlyMed+ Hydrating Enzyme Mask"],
    grid: "Masks & Exfoliants",
    steps: ["mask"],
    why: "Gentle treatment that dissolves dead skin buildup, deeply hydrates, and helps clear skin.",
    whyAlternates: [],
    howTo: {
      mask: "Use a generous amount to cover the entire face and neck. Leave on for 10-15 minutes and rinse off with water.",
    },
    frequency: "1x a week.",
    status: "check-match",
    seenIn: ["Sydney"],
  },
];

// Short pages and notes tied to a product, shown when that product is in the routine.
export const GUIDE_SNIPPETS = {
  "spf-two-finger-rule": {
    title: "Application tip",
    text: "Most people do not use enough SPF. Use the two finger rule to ensure you are using enough for your face, neck, and ears.",
    seenIn: ["Alina", "Marline"],
  },
  "purging-tip": {
    title: "Pro tip: purging is a normal part of the acne clearing process",
    text: "When introducing a new active serum, it's completely normal to experience purging during the first month. Purging occurs because these actives speed up cell turnover, bringing clogged pores, trapped oil, and bacteria to the surface faster than usual. While this may look like an initial breakout, it's actually a sign that the product is working to clear out congestion and prevent future breakouts. It's important to stay consistent with your routine—and most important, don't stop using the product.",
    seenIn: ["Madeline", "Mariah", "Jacqueline"],
  },
  "mandelic-step-up": {
    title: "Note: moving up to a stronger mandelic",
    text: "Bumping up the Mandelic Serum percentage will enhance exfoliation and target pigmentation more effectively. How to acclimate to a stronger mandelic percentage:",
    list: [
      "Start by using the higher percentage Mandelic Serum at night.",
      "Continue using the lower percentage in the morning until you finish that bottle.",
      "Once you have fully transitioned, you can begin using the stronger Mandelic Serum both AM & PM.",
    ],
    after: "This gradual approach ensures continued progress without compromising skin health.",
    seenIn: ["Ashley", "Madeline", "Dalilah", "Mariah"],
  },
  "clear-plex-nightly": {
    title: "Guide to Using Clear Plex",
    text: "Apply at the very end of your PM routine on treatment nights.",
    sections: [
      { heading: "How to introduce it", list: ["Use every other night for the first 2 weeks to gently acclimate your skin.", "If your skin is tolerating it well, increase to nightly use after week 2."] },
      { heading: "How to apply", list: ["Dispense 1 pump and apply to the entire face in a thin, even layer.", "Avoid the hairline, eyebrows, and eye area—benzoyl peroxide can bleach hair and fabrics.", "Use white or older pillowcases on treatment nights."] },
      { heading: "If you notice irritation", list: ["Reduce to 2–3 nights per week and let me know so I can adjust your regimen.", "Mild dryness is normal during acclimation; excessive redness or burning is not."] },
    ],
    seenIn: ["Marline", "Ashley", "Madeline", "Dalilah", "Mariah"],
  },
  "clear-plex-short-contact": {
    title: "Guide to Using Clear Plex",
    text: "Apply on clean skin during your PM routine.",
    sections: [
      { heading: "First 7 days", list: ["Rinse after 30 minutes."] },
      { heading: "Weeks 2-3", list: ["Rinse after 60 minutes."] },
      { heading: "Weeks 4 and on", list: ["Leave on overnight."] },
      { heading: "Good to know", list: ["Avoid the hairline, eyebrows, and eye area—benzoyl peroxide can bleach hair and fabrics.", "Use white or older pillowcases on treatment nights."] },
      { heading: "If you notice irritation", list: ["Reduce to 2–3 nights per week and let me know so I can adjust your regimen.", "Mild dryness is normal during acclimation; excessive redness or burning is not."] },
    ],
    seenIn: ["Ashley", "Madeline", "Sydney", "Mariah"],
  },
  "booster-pads-schedule": {
    title: "Guide for Using Dermathod Booster Pads",
    text: "Incorporate the Dermathod Booster Pads into your routine on Monday, Wednesday, and Friday nights. Begin with the rough side to exfoliate, then switch to the softer side to soothe and complete the cleanse. Avoid the hairline, eyebrows, and eyes. If irritation occurs, reduce usage and contact me for adjustments. Using the pads on set days ensures consistent results for clearer, smoother skin.",
    seenIn: ["Grey"],
  },
  "booster-pads-how-to": {
    title: "How to Guide: Dermathod Booster Pads",
    text: "Magic erasers for skin. With consistent use, they help erase texture, fine lines, and dark spots. A slow release of polyhydroxy and lipohydroxy acids gently exfoliates, brightens and smooths. Use as a nighttime treatment to wake up with an undeniable glow.",
    list: [
      "After double-cleansing your skin, gently wipe the \"rough side\" of the pad across the face, neck & décolleté (focus on congestion areas such as the T-zone).",
      "Use the softer \"padded side\" to pick up any dead skin and finish polishing the skin.",
      "This can be the last step of your routine, or let the product set for 1 minute before moving on with serums and moisturizer.",
    ],
    seenIn: ["Lizi"],
  },
};

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[™®]/g, "")
    .replace(/&/g, "+")
    .replace(/[^a-z0-9%+.]+/g, " ")
    .trim();
}

const BY_NAME = new Map();
for (const product of GUIDE_PRODUCTS) {
  for (const name of [product.name, product.shortName, product.squareName, ...product.aliases]) {
    if (name) BY_NAME.set(normalize(name), product);
  }
}

/** The library entry for a product name as Square, a guide or a person writes it. Null when it isn't in the library. */
export function guideProductFor(name) {
  return BY_NAME.get(normalize(name)) || null;
}

/** The how-to line for a product at one step, falling back to the step's usual wording. */
export function howToFor(product, stepId) {
  return product?.howTo?.[stepId] || STEP_DEFAULTS[stepId] || null;
}
