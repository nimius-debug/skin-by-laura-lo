const INGREDIENT_ITEM_OVERRIDES = {
  "cbd skin mist": [
    "Camellia Sinensis (Green Tea) Leaf Extract",
    "Cannabis Sativa Stem (CBD) Oil",
    "Caprylyl Glycol",
    "Citrus Aurantium Dulcis (Orange) Fruit Extract",
    "Citrus Aurantium Dulcis (Orange) Peel Oil",
    "Citrus Grandis (Grapefruit) Peel Oil",
    "Citrus Limon (Lemon) Fruit Extract",
    "Citrus Tangerina (Tangerine) Peel Oil",
    "Coffea Arabica (Coffee) Seed Extract",
    "Cucumis Sativus (Cucumber) Fruit Extract",
    "Epilobium Angustifolium Flower/Leaf/Stem Extract",
    "Ethylhexylglycerin",
    "Euterpe Oleracea Fruit (Acai) Extract",
    "Garcinia Mangostana Fruit Extract",
    "Glycerin",
    "Glycosaminoglycans",
    "Hexylene Glycol",
    "Lycium Barbarum Fruit Extract",
    "Morinda Citrifolia Extract",
    "Niacinamide",
    "Organic Aloe Barbadensis Leaf Juice",
    "Panthenol",
    "PEG-40 Hydrogenated Castor Oil",
    "Pentylene Glycol",
    "Phenoxyethanol",
    "PPG-26-Buteth-26",
    "Propanediol",
    "Punica Granatum Fruit Extract",
    "Pyrus Malus (Apple) Fruit Extract",
    "Saccharum Officinarum (Sugarcane) Extract",
    "Sodium Hyaluronate",
    "Symphytum Officinale (Comfrey) Rhizome/Root Extract",
  ],
  "corthe dermo essential cleansing oil": [
    "Caprylic/Capric Triglyceride",
    "Cetyl Ethylhexanoate",
    "PEG-20 Glyceryl Triisostearate",
    "Tocopheryl Acetate",
    "Anthemis Nobilis Flower Extract",
    "Calendula Officinalis Flower Extract",
    "Carthamus Tinctorius (Safflower) Seed Oil",
    "Rosa Canina Fruit Oil",
    "Macadamia Ternifolia Seed Oil",
    "Argania Spinosa Kernel Oil",
    "Fragrance",
  ],
  "corthe dermo pure first aid toner": [
    "Water",
    "Glycerin",
    "Butylene Glycol",
    "1,2-Hexanediol",
    "Pentylene Glycol",
    "Sodium Hyaluronate",
    "Panthenol",
    "Aloe Barbadensis Leaf Extract",
    "Sodium PCA",
    "Centella Asiatica Extract",
    "Niacinamide",
    "Cryptomeria Japonica Leaf Extract",
    "Nelumbo Nucifera Leaf Extract",
    "Saccharomyces Ferment",
    "Anthemis Nobilis Flower Extract",
    "Calendula Officinalis Flower Extract",
    "Allantoin",
  ],
  "magic molecule hypochlorous acid spray - 2oz.": [
    "Hypochlorous Acid 0.018%",
    "Ionized Water 99.918%",
    "Sodium Chloride 0.06%",
    "Hypochlorite Ion 0.004%",
  ],
  "magic molecule hypochlorous acid spray - 8oz.": [
    "Hypochlorous Acid 0.018%",
    "Ionized Water 99.918%",
    "Sodium Chloride 0.06%",
    "Hypochlorite Ion 0.004%",
  ],
  "mixi clear plex 2.8%": ["Benzoyl Peroxide 2.8%"],
  "mixi clear plex 5%": ["Benzoyl Peroxide 5%"],
};

const SPECIAL_PROFILES = [
  {
    test: /^(water|aqua(?: \(water(?:\/eau)?\))?|ionized water)/i,
    role: "Formula base",
    description: "The water phase that dissolves and carries water-compatible ingredients.",
    why: "It helps the finished product spread evenly and deliver the rest of the formula.",
    note: "Water is a vehicle, not a treatment active by itself.",
    level: "Well established",
    tone: "functional",
    priority: 0,
  },
  {
    test: /^glycerin$/i,
    role: "Hydration · Humectant",
    description: "A well-established humectant that attracts water to the outer layers of skin.",
    why: "It supports hydration, softness, and a more comfortable skin feel.",
    note: "Its performance depends on the complete formula and the surrounding environment.",
    level: "Well established",
    tone: "supportive",
    priority: 7,
  },
  {
    test: /^niacinamide$/i,
    role: "Barrier · Tone support",
    description: "A form of vitamin B3 used to support the skin barrier, visible tone, and oil balance.",
    why: "It can serve several goals at once without functioning as an exfoliating acid.",
    note: "Very reactive skin can still sting, especially when several active products are layered.",
    level: "Well established",
    tone: "supportive",
    priority: 10,
  },
  {
    test: /^(sodium hyaluronate|hyaluronic acid|hydrolyzed hyaluronic acid|sodium acetylated hyaluronate|potassium hyaluronate|hydroxypropyltrimonium hyaluronate)/i,
    role: "Hydration · Humectant",
    description: "A hyaluronic-acid form that helps bind water at the skin surface.",
    why: "It supports temporary plumping and a hydrated, flexible feel.",
    note: "Different molecular forms behave differently, and the ingredient list does not reveal their percentages.",
    level: "Well established",
    tone: "supportive",
    priority: 7,
  },
  {
    test: /^squalane?$/i,
    role: "Barrier support · Emollient",
    description: "A lightweight moisturizing lipid that softens skin and helps reduce moisture loss.",
    why: "It cushions active ingredients and supports a smoother finish.",
    note: "Generally well tolerated, though the complete product determines how rich it feels.",
    level: "Well established",
    tone: "supportive",
    priority: 7,
  },
  {
    test: /^panthenol/i,
    role: "Soothing · Barrier support",
    description: "Pro-vitamin B5, a humectant and conditioning ingredient that supports comfort and barrier recovery.",
    why: "It helps offset dryness and supports a softer skin feel.",
    note: "It is supportive rather than a stand-alone treatment for inflammation.",
    level: "Well established",
    tone: "supportive",
    priority: 7,
  },
  {
    test: /^allantoin$/i,
    role: "Soothing · Skin conditioning",
    description: "A skin-conditioning ingredient commonly used to improve comfort in gentle formulas.",
    why: "It can help make a formula feel calmer and less drying.",
    note: "The finished formula and concentration determine the overall soothing effect.",
    level: "Well established",
    tone: "supportive",
    priority: 5,
  },
  {
    test: /centella asiatica|madecassoside|asiaticoside/i,
    role: "Soothing · Barrier support",
    description: "A Centella-derived ingredient used to support visible calm and barrier recovery.",
    why: "It is included to complement hydration and improve comfort for stressed-looking skin.",
    note: "Botanical sensitivity remains possible even with ingredients associated with soothing.",
    level: "Established cosmetic use",
    tone: "supportive",
    priority: 7,
  },
  {
    test: /beta[- ]?glucan/i,
    role: "Hydration · Soothing",
    description: "A polysaccharide used for water binding and soothing skin-conditioning support.",
    why: "It helps reinforce the formula's hydrating and comfort-focused profile.",
    note: "Benefits depend on the type, concentration, and finished delivery system.",
    level: "Established cosmetic use",
    tone: "supportive",
    priority: 7,
  },
  {
    test: /^(salicylic acid|betaine salicylate)/i,
    role: "Exfoliation · Breakout support",
    description: "An oil-soluble exfoliating ingredient used to help with clogged pores and uneven texture.",
    why: "It can reach into oily pore material and support a clearer-looking surface.",
    note: "It may increase dryness or irritation. Frequency, pH, and concentration matter.",
    level: "Well established",
    tone: "context",
    priority: 10,
  },
  {
    test: /mandelic acid/i,
    role: "Exfoliation · Tone support",
    description: "An alpha hydroxy acid used to improve the look of texture, congestion, and uneven tone.",
    why: "Its larger molecular size can make it a more gradual exfoliating option than some other AHAs.",
    note: "It can still irritate or over-exfoliate. Introduce gradually and use sunscreen.",
    level: "Well established",
    tone: "context",
    priority: 10,
  },
  {
    test: /^(lactic acid|glycolic acid|gluconolactone)/i,
    role: "Exfoliation · Surface renewal",
    description: "An exfoliating ingredient used to loosen dull surface cells and support smoother-looking skin.",
    why: "It contributes to texture and tone goals when the formula's pH and concentration are effective.",
    note: "Overuse can compromise the barrier. Introduce gradually and use sunscreen.",
    level: "Well established",
    tone: "context",
    priority: 9,
  },
  {
    test: /benzoyl peroxide/i,
    role: "Acne treatment active",
    description: "An established antibacterial acne active that helps reduce acne-causing bacteria.",
    why: "It targets inflamed breakouts and can reduce the development of new acne lesions.",
    note: "It commonly causes dryness and can bleach fabrics. The disclosed strength matters.",
    level: "Well established",
    tone: "context",
    priority: 10,
  },
  {
    test: /(?:colloidal )?sulfur(?: 10%)?$/i,
    role: "Acne support · Oil control",
    description: "A keratolytic acne ingredient used to absorb oil and support clearer-looking pores.",
    why: "It can be useful in targeted products for oily or breakout-prone skin.",
    note: "Sulfur can be drying and has a characteristic odor; avoid overuse on sensitized skin.",
    level: "Well established",
    tone: "context",
    priority: 10,
  },
  {
    test: /^(retinol|retinyl palmitate)/i,
    role: "Renewal · Visible aging support",
    description: "A vitamin A derivative used to support cell turnover, texture, and visible signs of aging.",
    why: "It makes the formula goal-directed for texture, tone, or fine-line concerns.",
    note: "Retinoids can irritate. Introduce gradually and seek professional guidance during pregnancy or breastfeeding.",
    level: "Well established",
    tone: "context",
    priority: 10,
  },
  {
    test: /^bakuchiol$/i,
    role: "Renewal support · Botanical",
    description: "A botanical ingredient used to support the appearance of texture, tone, and visible aging.",
    why: "It provides a renewal-focused signal without being a retinoid.",
    note: "It can still irritate, and it should not be treated as an identical substitute for prescription retinoids.",
    level: "Emerging ingredient",
    tone: "supportive",
    priority: 9,
  },
  {
    test: /^(ferulic acid|tocopherol|tocopheryl acetate)/i,
    role: "Antioxidant · Skin conditioning",
    description: "An antioxidant used to support the formula against oxidative stress and condition skin.",
    why: "It complements other antioxidants and helps support the product's environmental-defense story.",
    note: "Antioxidant performance depends on concentration, stability, packaging, and the complete formula.",
    level: "Well established",
    tone: "supportive",
    priority: 6,
  },
  {
    test: /^(arbutin|glutathione|tetrahexyldecyl ascorbate|ascorbyl palmitate)/i,
    role: "Tone support · Antioxidant",
    description: "A tone-supporting antioxidant included to improve the look of discoloration or dullness.",
    why: "It contributes to a more even-looking complexion with consistent use.",
    note: "Results depend on concentration and formulation; daily sunscreen remains essential.",
    level: "Established cosmetic use",
    tone: "supportive",
    priority: 8,
  },
  {
    test: /hypochlorous acid/i,
    role: "Skin-cleansing support",
    description: "A low-concentration oxidizing compound used in topical sprays to support clean, calm-feeling skin.",
    why: "It is the principal functional ingredient in this minimal spray formula.",
    note: "Use only as labeled and do not confuse the finished dilute product with concentrated chlorine chemicals.",
    level: "Established topical use",
    tone: "supportive",
    priority: 10,
  },
  {
    test: /^(zinc oxide|titanium dioxide)/i,
    role: "Mineral UV filter · Skin protectant",
    description: "A mineral ingredient used as a UV filter in tested sunscreen formulas and for opacity in some cosmetics.",
    why: "Its role depends on the product: sunscreen protection requires testing of the finished formula.",
    note: "An ingredient list alone cannot confirm SPF performance or broad-spectrum protection.",
    level: "Well established",
    tone: "context",
    priority: 9,
  },
  {
    test: /^(ethylhexyl methoxycinnamate|octocrylene|ethylhexyl salicylate|butyloctyl salicylate|homosalate|octisalate|avobenzone|butyl methoxydibenzoylmethane|diethylamino hydroxybenzoyl hexyl benzoate|ethylhexyl triazone|methylene bis-benzotriazolyl tetramethylbutylphenol|diethylhexyl butamido triazone|bis-ethylhexyloxyphenol methoxyphenyl triazine|4-methylbenzylidene camphor|polymethylsilsesquioxane)/i,
    role: "Chemical UV filter · Skin protectant",
    description: "An organic (chemical) UV filter used in tested sunscreen formulas to absorb UV radiation.",
    why: "Its role depends on the finished, tested product; the ingredient list alone cannot confirm labeled SPF or broad-spectrum performance.",
    note: "Not every chemical filter is FDA-approved for U.S. over-the-counter sunscreen sale — some Korean-formulated products use filters (such as Tinosorb M/S) that are common in Asia and Europe but not yet monographed in the U.S. Confirm regulatory status if that matters to the customer.",
    level: "Well established",
    tone: "context",
    priority: 9,
  },
  {
    test: /^(alcohol|isopropyl alcohol|alcohol denat\.?|sd alcohol(?: \d+)?|ethanol)$/i,
    role: "Astringent · Solvent",
    description: "A volatile, drying-type alcohol used as a solvent, degreaser, or fast-evaporating carrier.",
    why: "It helps actives penetrate quickly and gives oily/acne formulas a fast-drying, mattifying finish.",
    note: "This is not the same as a fatty alcohol (cetyl, stearyl, etc.). Where it sits high in the ingredient list, it can be genuinely drying or irritating for dry, compromised, or reactive skin.",
    level: "Well established",
    tone: "context",
    priority: 8,
  },
  {
    test: /^(cetyl alcohol|stearyl alcohol|myristyl alcohol|lauryl alcohol|cetearyl alcohol|behenyl alcohol|arachidyl alcohol|isocetyl alcohol|c14-22 alcohols|c14-16 alcohols)$/i,
    role: "Emollient · Texture",
    description: "A fatty alcohol used as an emollient and thickener, unrelated to drying/volatile alcohol.",
    why: "It softens skin and gives creams and lotions their body and slip.",
    note: "Despite the name, fatty alcohols are not drying — they behave more like a wax than an astringent.",
    level: "Well established",
    tone: "functional",
    priority: 2,
  },
  {
    test: /^menthol$/i,
    role: "Cooling agent · Sensitivity context",
    description: "A cooling ingredient that produces a tingling or minty sensation on contact with skin.",
    why: "It creates the cooling/tingling effect that some treatment and body-care formulas are built around.",
    note: "Can sting on compromised, freshly treated, or very reactive skin even in products marketed as calming.",
    level: "Well established",
    tone: "context",
    priority: 7,
  },
  {
    test: /tranexamic acid/i,
    role: "Brightening · Tone support",
    description: "A well-evidenced brightening ingredient that helps interrupt the pigment-forming process.",
    why: "It is used specifically to target hyperpigmentation, melasma, and post-inflammatory dark marks.",
    note: "Generally gentle for most skin types; still benefits from daily sunscreen to protect results.",
    level: "Well established",
    tone: "supportive",
    priority: 10,
  },
  {
    test: /^adenosine$/i,
    role: "Renewal support · Signaling ingredient",
    description: "A signaling ingredient with published evidence for improving the look of fine lines.",
    why: "It contributes to the formula's anti-aging or renewal positioning at typical cosmetic concentrations.",
    note: "Considered gentle; effects build gradually with consistent use.",
    level: "Well established",
    tone: "supportive",
    priority: 8,
  },
  {
    test: /hexylresorcinol/i,
    role: "Brightening · Tone support",
    description: "A tyrosinase-inhibiting brightening ingredient with published efficacy data.",
    why: "It targets the appearance of dark spots and uneven tone alongside the formula's other brighteners.",
    note: "Generally well tolerated at cosmetic concentrations; pair with daily sunscreen.",
    level: "Well established",
    tone: "supportive",
    priority: 9,
  },
  {
    test: /kojic acid/i,
    role: "Brightening · Tone support",
    description: "A tyrosinase-inhibiting brightening ingredient derived from fungal fermentation.",
    why: "It is included to target hyperpigmentation and uneven tone.",
    note: "A recognized contact sensitizer for a subset of users, especially with frequent or prolonged use — patch test recommended.",
    level: "Well established",
    tone: "context",
    priority: 9,
  },
  {
    test: /diacetyl boldine/i,
    role: "Brightening · Tone support",
    description: "A synthetic tyrosinase inhibitor increasingly used as a hydroquinone alternative for pigmentation.",
    why: "It supports the formula's brightening goal without using hydroquinone.",
    note: "Best paired with consistent daily sunscreen for visible results.",
    level: "Established cosmetic use",
    tone: "supportive",
    priority: 8,
  },
  {
    test: /snail secretion filtrate|snail mucin/i,
    role: "Hydration · Renewal support",
    description: "A K-beauty ingredient rich in glycoproteins and hyaluronic acid, used for hydration and visible skin recovery.",
    why: "It supports the formula's hydration and repair-focused positioning.",
    note: "Generally well tolerated; those avoiding animal-derived ingredients may want to know its origin.",
    level: "Established cosmetic use",
    tone: "supportive",
    priority: 6,
  },
  {
    test: /hypochlorite ion/i,
    role: "Skin-cleansing support",
    description: "A related oxidizing compound that occurs alongside hypochlorous acid in electrolyzed-water formulas.",
    why: "It is a natural byproduct of how the hypochlorous acid solution is manufactured, not a separately added ingredient.",
    note: "Present at trace levels in these formulas; not a safety concern at the disclosed concentration.",
    level: "Established topical use",
    tone: "functional",
    priority: 2,
  },
];

const CATEGORY_PROFILES = [
  {
    test: /fragrance|parfum|limonene|linalool|citral|citronellol|geraniol|eugenol|coumarin|benzyl salicylate|hexyl cinnamal|hydroxycitronellal/i,
    role: "Fragrance · Sensitivity context",
    description: "A fragrance material or declared fragrance component used to shape the product's scent.",
    why: "It contributes to the sensory experience rather than the core treatment benefit.",
    note: "Fragrance-sensitive, eczema-prone, or recently treated skin may prefer to avoid it.",
    level: "Established cosmetic use",
    tone: "context",
    priority: 8,
  },
  {
    test: /peppermint|spearmint|grapefruit.*peel oil|orange.*peel oil|rosemary.*oil|lavandula|camphor|methyl nicotinate/i,
    role: "Sensory botanical · Sensitivity context",
    description: "An aromatic or warming ingredient used for scent, freshness, or sensory effect.",
    why: "It changes how the product smells or feels during application.",
    note: "It may sting or trigger sensitivity in reactive, compromised, or recently treated skin.",
    level: "Established cosmetic use",
    tone: "context",
    priority: 8,
  },
  {
    test: /ceramide|phytosterol|cholesterol|squal|petrolatum|dimethicone|siloxane|butter|seed oil|fruit oil|kernel oil|meadowfoam|jojoba|beeswax|microcrystalline wax|triglyceride/i,
    role: "Barrier support · Emollient",
    description: "A lipid, silicone, wax, or emollient that smooths skin and helps reduce moisture loss.",
    why: "It supports softness, slip, and barrier comfort in the finished formula.",
    note: "Texture and suitability for oily skin depend on the complete blend, not this ingredient alone.",
    level: "Established cosmetic use",
    tone: "supportive",
    priority: 5,
  },
  {
    test: /glycereth|propanediol|butylene glycol|pentylene glycol|hexylene glycol|dipropylene glycol|betaine|trehalose|hydroxyethyl urea|sodium pca|sodium lactate|xylitol|sorbitol|glycosaminoglycan/i,
    role: "Hydration · Formula support",
    description: "A water-binding or solvent ingredient that supports hydration, slip, and ingredient distribution.",
    why: "It helps the product spread evenly and contributes to a more comfortable skin feel.",
    note: "Its contribution is supportive and depends on the full formula.",
    level: "Established cosmetic use",
    tone: "supportive",
    priority: 4,
  },
  {
    test: /peptide|oligopeptide|tripeptide|tetrapeptide|pentapeptide|hexapeptide|nonapeptide|collagen|elastin|amino acid|procollagen/i,
    role: "Skin conditioning · Peptide support",
    description: "A peptide, protein fragment, or conditioning material used to support hydration and the look of firmness.",
    why: "It contributes to the formula's smoothing or visible-aging positioning.",
    note: "The ingredient list does not reveal the concentration or delivery needed to predict clinical results.",
    level: "Established to emerging use",
    tone: "supportive",
    priority: 6,
  },
  {
    test: /ferment|lysate|bifida|lactobacillus|lactococcus|saccharomyces|galactomyces|bacillus/i,
    role: "Ferment · Skin conditioning",
    description: "A fermentation-derived ingredient used for conditioning, hydration, or formula support.",
    why: "It adds a skin-conditioning component to the product's overall profile.",
    note: "“Probiotic” marketing does not necessarily mean the finished product contains live organisms.",
    level: "Established cosmetic use",
    tone: "supportive",
    priority: 5,
  },
  {
    test: /aloe|bisabolol|calendula|chamom|green tea|camellia sinensis|glycyrrh|licorice|portulaca/i,
    role: "Soothing · Botanical support",
    description: "A botanical or botanical-derived ingredient used to support visible calm and antioxidant defense.",
    why: "It complements the formula's hydration and comfort-focused ingredients.",
    note: "Botanical ingredients can still cause individual sensitivity.",
    level: "Established cosmetic use",
    tone: "supportive",
    priority: 5,
  },
  {
    test: /extract|leaf|root|flower|fruit|seed|seaweed|spirulina|kelp/i,
    role: "Botanical · Formula support",
    description: "A plant- or algae-derived ingredient included for conditioning, antioxidant, or sensory support.",
    why: "It contributes to the formula's supporting botanical blend.",
    note: "Public evidence and concentrations vary widely; botanical does not automatically mean non-irritating.",
    level: "Ingredient-specific evidence varies",
    tone: "context",
    priority: 3,
  },
  {
    test: /phenoxyethanol|paraben|sodium benzoate|potassium sorbate|iodopropynyl butylcarbamate|diazolidinyl urea|methylchloroisothiazolinone|methylisothiazolinone|ethylhexylglycerin|caprylyl glycol|1,2-hexanediol/i,
    role: "Preservation · Formula protection",
    description: "A preservative or preservation-support ingredient that helps protect the product from microbial spoilage.",
    why: "Preservation is essential for the safety and stability of water-containing cosmetics.",
    note: "Some preservatives can trigger individual sensitivity, but an inadequately preserved product carries its own risks.",
    level: "Established cosmetic use",
    tone: "functional",
    priority: 1,
  },
  {
    test: /olefin sulfonate|cocamidopropyl betaine|coco-betaine|glucoside|lauroyl.*glutamate|isethionate/i,
    role: "Cleansing · Surfactant",
    description: "A surfactant that helps water lift oil, sunscreen, makeup, and debris from the skin.",
    why: "It provides the cleansing action or helps the product rinse away cleanly.",
    note: "Mildness depends on the surfactant blend, concentration, pH, and how long the product stays on skin.",
    level: "Established cosmetic use",
    tone: "functional",
    priority: 3,
  },
  {
    test: /carbomer|acrylate|crosspolymer|cellulose|xanthan|carrageenan|gum|silica|kaolin|bentonite|starch|powder/i,
    role: "Texture · Formula structure",
    description: "A texture, suspension, absorbency, or film-forming ingredient used to control how the product feels and performs.",
    why: "It keeps the formula consistent and gives it the intended body, slip, or finish.",
    note: "Its primary value is technical rather than a direct treatment effect.",
    level: "Established cosmetic use",
    tone: "functional",
    priority: 1,
  },
  {
    test: /glyceryl stearate|steareth|ceteareth|polysorbate|sorbitan|polyglyceryl|peg-|ppg-|lecithin/i,
    role: "Emulsifier · Formula support",
    description: "An emulsifier or solubilizer that helps oil- and water-compatible materials remain evenly mixed.",
    why: "It supports stability, texture, and even application.",
    note: "Its role is mainly technical and should be judged in the finished formula.",
    level: "Established cosmetic use",
    tone: "functional",
    priority: 1,
  },
  {
    test: /edta|sodium phytate|potassium hydroxide|sodium hydroxide|tromethamine|sodium citrate|citric acid/i,
    role: "Stability · pH support",
    description: "A chelating, buffering, or pH-adjusting ingredient used to keep the finished formula stable.",
    why: "It supports consistency, preservation, and skin-compatible product performance.",
    note: "Raw-material properties do not describe how a small, neutralized amount behaves in the finished product.",
    level: "Established cosmetic use",
    tone: "functional",
    priority: 1,
  },
  {
    test: /ci \d|mica|titanium dioxide/i,
    role: "Color · Opacity",
    description: "A pigment or optical ingredient used to control color, opacity, or visual finish.",
    why: "It contributes to the appearance of the product on the skin.",
    note: "Its presence does not establish sunscreen protection unless the finished product is tested and labeled as sunscreen.",
    level: "Established cosmetic use",
    tone: "functional",
    priority: 1,
  },
];

function cleanIngredientName(value) {
  return String(value || "")
    .replace(/^(?:ingredients?|ingredient list|inactive ingredients?|main ingredients?|actives? disclosed):?\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/[.;]+$/, "")
    .trim();
}

function splitComponentFormula(productName, formula) {
  const sections = productName === "Cleansing Essentials Set"
    ? ["Oil Cleanser", "Enzyme Exfoliating Powder"]
    : productName === "Luxury Skincare Set"
      ? ["Lipid Serum", "Hyvia® Crème"]
      : [];
  if (!sections.length) return null;

  const escaped = sections.map((section) => section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const matcher = new RegExp(`(${escaped.join("|")}):`, "g");
  const matches = [...formula.matchAll(matcher)];
  return matches.flatMap((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? formula.length;
    return formula.slice(start, end).split(",").map((name) => ({
      name: cleanIngredientName(name),
      component: match[1],
    })).filter((item) => item.name);
  });
}

export function formulaIngredientNames(productName, formula) {
  const override = INGREDIENT_ITEM_OVERRIDES[String(productName || "").trim().toLowerCase()];
  if (override) return override.map((name) => ({ name }));
  const componentItems = splitComponentFormula(productName, formula);
  if (componentItems) return componentItems;
  return String(formula || "").split(",").map((name) => ({ name: cleanIngredientName(name) })).filter((item) => item.name);
}

export function ingredientProfile(name) {
  const cleanName = cleanIngredientName(name);
  const profile = SPECIAL_PROFILES.find((item) => item.test.test(cleanName))
    || CATEGORY_PROFILES.find((item) => item.test.test(cleanName));
  if (profile) return { name: cleanName, ...profile };
  return {
    name: cleanName,
    role: "Formula support",
    description: "A cosmetic ingredient included for conditioning, delivery, texture, stability, or another formula-specific purpose.",
    why: "Its role is best understood in the context of the complete ingredient list and product directions.",
    note: "The ingredient list alone does not disclose its concentration, purity, pH, or effect in the finished product.",
    level: "Ingredient-specific evidence varies",
    tone: "functional",
    priority: 1,
  };
}

export function ingredientProfilesForFormula(productName, formula) {
  const ingredients = formulaIngredientNames(productName, formula).map((item, index) => ({
    ...ingredientProfile(item.name),
    component: item.component || "",
    position: index + 1,
  }));
  const featured = ingredients
    .map((ingredient, index) => ({ ingredient, index }))
    .filter(({ ingredient }) => ingredient.priority >= 5)
    .sort((a, b) => b.ingredient.priority - a.ingredient.priority || a.index - b.index)
    .slice(0, 6);
  const featuredIndexes = new Set(featured.map((item) => item.index));
  return ingredients.map((ingredient, index) => ({ ...ingredient, featured: featuredIndexes.has(index) }));
}

export function formulaTagsFor(ingredients, formula) {
  const roles = ingredients.map((ingredient) => ingredient.role).join(" ").toLowerCase();
  const tags = [];
  if (/hydration|humectant/.test(roles)) tags.push("Hydrating");
  if (/barrier|emollient/.test(roles)) tags.push("Barrier support");
  if (/tone support|brightening/.test(roles)) tags.push("Tone support");
  if (/soothing/.test(roles)) tags.push("Soothing");
  if (/exfoliation/.test(roles)) tags.push("Exfoliating");
  if (/acne|breakout/.test(roles)) tags.push("Breakout support");
  if (/renewal|visible aging|peptide/.test(roles)) tags.push("Renewal support");
  if (!/fragrance|parfum/i.test(formula || "")) tags.push("No added fragrance listed");
  return [...new Set(tags)].slice(0, 4);
}
