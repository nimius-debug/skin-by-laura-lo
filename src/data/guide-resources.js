// The resource pages Laura adds to a Skincare Guide when they fit the client
// (What is Acne, Hormones, Birth Control, Acne-Safe Makeup…), in her words.
//
// - The beige pages (What is Acne, Laura's Tips, Curated Essentials, Lifestyle,
//   Nutrition, Healthy (skin) Habits, Hormones) are copied box by box from
//   Marline J's guide, at their Canva positions. Pages marked `letter` were
//   US Letter in Canva; their boxes are moved down to fill A4.
// - The other pages only exist in the older green guides (Marline, Ashley,
//   Sydney, Melissa). Their words are kept and they are laid out in the beige
//   style: a two-line title, then stacked text boxes ("flows") that the editor
//   spaces out once it can measure them and carries onto a second page if needed.
//
// Typos fixed while copying: ITS (was IT'S), MENSTRUAL, FLUORIDE, recommend,
// and a few makeup brand names (Nars, Tarte, Too Faced, Rare Beauty, Charlotte
// Tilbury, Estée, Effacernes, Ilia, Priia). Photos are in public/media/guides/resources/.
//
// Which pages a new draft gets is decided in src/admin/guides/resources.js.

const MEDIA = "/media/guides/resources/";

// ── box helpers ──────────────────────────────────────────────────────────────
const text = (x, y, w, html, style = {}, extra = {}) => ({ type: "text", x, y, w, html, style, ...extra });
const photo = (x, y, w, h, file, alt, extra = {}) => ({ type: "image", x, y, w, h, src: MEDIA + file, alt, ...extra });
const rule = (x, y, w) => ({ type: "line", x, y, w, h: 0 });

// The beige body text (Futura in Canva; Jost runs a little wider, so it is set a touch tighter).
const BODY = { fontSize: 17.1, fontWeight: 400, lineHeight: 1.2, letterSpacing: -0.01 };
const body = (x, y, w, html, extra = {}) => text(x, y, w, html, BODY, extra);
// A heading and its text in one box, stacked in a column (`flow`) so a longer
// edit pushes the sections under it down instead of running into them.
const section = (x, w, heading, words, flow) => text(x, 0, w, `<b>${heading}</b><br>${words}`, BODY, { flow });

/** "LAURA'S" over "CURATED ESSENTIALS": the two-line title of the newer beige pages. */
function titleLines(top, bottom, { bottomSize = 56 } = {}) {
  return [
    text(63, 83, 680, top, { fontSize: 48, lineHeight: 1, letterSpacing: -0.02, uppercase: true }, { role: "title" }),
    text(63, 127, 700, bottom, { fontSize: bottomSize, fontWeight: 700, lineHeight: 1, letterSpacing: -0.03, uppercase: true }, { role: "title-2" }),
  ];
}

// ── the stacked layout used for the pages redrawn from the green guides ─────
const ARTICLE = { x: 63, w: 668, top: 214 };
const FLOW = { gap: 14, bottom: 1045, minFontSize: 13 };
const H = (words) => ({ kind: "heading", html: words });
const P = (html) => ({ kind: "paragraph", html });
const LIST = (items) => ({ kind: "list", items });

function articleBox(block, x, w, flow) {
  if (block.kind === "heading") {
    return text(x, 0, w, block.html, { fontSize: 24, lineHeight: 1.15, letterSpacing: -0.02 }, { flow, role: "heading" });
  }
  const html = block.kind === "list" ? block.items.map((item) => `• ${item}`).join("<br>") : block.html;
  return text(x, 0, w, html, { fontSize: 17.3, fontWeight: 400, lineHeight: 1.3, letterSpacing: -0.01, align: block.kind === "list" ? "left" : "justify" },
    { flow, ...(block.link ? { link: block.link } : {}), ...(block.role ? { role: block.role } : {}) });
}

/** A titled page whose blocks stack down the page (and carry onto a second page if they don't fit). */
function article(titleTop, titleBottom, blocks, options = {}) {
  return {
    flows: { body: { ...FLOW } },
    elements: [...titleLines(titleTop, titleBottom, options), ...blocks.map((block) => articleBox(block, ARTICLE.x, ARTICLE.w, "body"))],
  };
}

/** A titled page with two stacked columns (the makeup lists). */
function columns(titleTop, titleBottom, left, right) {
  return {
    flows: { left: { ...FLOW, gap: 10 }, right: { ...FLOW, gap: 10 } },
    elements: [
      ...titleLines(titleTop, titleBottom),
      ...left.map((block) => articleBox(block, 63, 318, "left")),
      ...right.map((block) => articleBox(block, 413, 318, "right")),
    ],
  };
}

// ── the pages ────────────────────────────────────────────────────────────────
// `about` is the line under each page's name in the editor's "Pages" list.

export const GUIDE_RESOURCES = [
  {
    id: "what-is-acne",
    label: "What is Acne",
    about: "What acne is and what causes it.",
    pages: [{
      letter: true,
      flows: { causes: { gap: 12, bottom: 1045, minFontSize: 13 } },
      elements: [
        text(116, 75, 400, "WHAT IS", { fontSize: 59.6, lineHeight: 1, letterSpacing: -0.02 }, { role: "title" }),
        text(116, 132, 400, "ACNE", { fontSize: 83, fontWeight: 700, lineHeight: 1, letterSpacing: -0.02 }, { role: "title-2" }),
        text(116, 246, 545, "Acne is a dermatological condition that occurs when the hair follicles and sebaceous glands in the skin become clogged with oil, dead skin cells, and bacteria. These clogged follicles often lead to the development of various types of skin lesions, such as pimples, whiteheads, blackheads, and in severe cases, cysts.", { fontSize: 17.1, lineHeight: 1.2 }),
        text(116, 413, 400, "AND ITS CAUSES", { fontSize: 26.7, lineHeight: 1, letterSpacing: -0.02 }),
        body(116, 455, 400, "Causes of Acne:", { flow: "causes" }),
        ...[
          "Excess Sebum Production: The sebaceous glands produce an oily substance called sebum, which helps keep the skin moisturized. However, in some individuals, these glands produce an excessive amount of sebum, leading to clogged pores and acne.",
          "Hormonal Changes: Fluctuations in hormone levels, particularly during puberty, menstrual cycles, and pregnancy, can trigger acne. Androgens, a type of male hormones present in both males and females, play a significant role in stimulating sebum production.",
          "Dead Skin Cells: Shedding of dead skin cells is a natural process. However, in some cases, these cells do not shed properly and can accumulate, contributing to pore blockage.",
          "Bacteria: The skin is home to a type of bacteria called Propionibacterium acnes. When trapped in clogged pores, they can multiply and lead to inflammation and the formation of acne.",
          "Certain Medications and Cosmetics: Some medications and cosmetic products can trigger acne breakouts in some individuals.",
          "Diet and Lifestyle: Some studies suggest that certain foods and lifestyle choices may exacerbate existing acne conditions.",
        ].map((line, index) => body(130, 479 + index * 100, 526, `• ${line}`, { flow: "causes" })),
      ],
    }],
  },
  {
    id: "tips",
    label: "Laura’s Tips for Glowing Skin",
    about: "Double cleansing, brushes, pillowcases, icing and other everyday habits.",
    pages: [{
      flows: { tips: { gap: 18, bottom: 1045, minFontSize: 14 } },
      elements: [
        ...titleLines("Laura’s Tips", "For Glowing Skin"),
        ...[
          ["Double Cleanse Every Night (Yes, Every Night)", "Begin with an oil-based cleanser to dissolve makeup, SPF, and excess oil, then follow with a gentle water-based cleanser. Take your time—cleanse for at least 60 seconds each step to allow the ingredients to work and ensure a thorough, balanced clean. This ritual is essential for achieving that coveted glass‑skin glow."],
          ["Clean Your Makeup Brushes Weekly (and Post-Facial)", "Brushes collect oil, makeup, and bacteria that can quickly undo your progress. Wash them weekly—and always right after a facial to avoid reintroducing bacteria to freshly treated skin."],
          ["Skip the Sponges", "Sponges—especially beauty blenders—harbor bacteria that’s tough to fully remove. Stick with clean brushes or your fingertips to apply makeup and skincare safely."],
          ["Change Your Pillowcase After Every Facial", "Fresh pillowcases protect your investment. Swap them right after a treatment to prevent last week’s oils, hair products, and residue from affecting your skin."],
          ["Never Use Your Bath Towel on Your Face", "Bath towels carry bacteria and can be too rough for delicate facial skin. Opt for disposable face towels or allow your skin to air dry. This prevents irritation and helps avoid fine lines and premature wrinkles caused by rubbing."],
          ["Try Icing Your Skin", "A simple ritual with powerful benefits: icing calms inflammation, reduces redness, supports circulation, and helps manage acne, hyperpigmentation, and signs of aging. It’s a skin‑reset that works for every skin type."],
          ["LESS TOUCHING, MORE GLOWING", "Hands off! Avoid picking or leaning on your face, and let your skincare do the work. Protecting your barrier means better long‑term results."],
          ["Consistency is Sexy", "Glowing skin doesn’t come from a 10‑step routine—it comes from balanced, intentional habits you can maintain daily."],
        ].map(([heading, words], index) => text(63, 210 + index * 105, 664, `✨ <b>${heading}</b><br>${words}`,
          { fontSize: 18.7, lineHeight: 1.24, letterSpacing: -0.01, align: "justify" }, { flow: "tips" })),
      ],
    }],
  },
  {
    id: "essentials",
    label: "Laura’s Curated Essentials",
    about: "Pillowcases, face towels, ice globes and Magic Molecule spray, with shop links.",
    pages: [{
      elements: [
        ...titleLines("Laura’s", "Curated Essentials"),
        text(63, 229, 685, "Change your pillowcases twice a week or weekly and opt for silk options to reduce skin bacteria &amp; irritation. Use disposable face towels to ensure a clean drying surface each time; <b><i>both help reduce bacterial transfer (more acne)</i></b>. Opt for non-comedogenic makeup to avoid clogging pores and aggravating acne (<u>ingredient checker on my website</u>).",
          { fontSize: 17.3, lineHeight: 1.21, align: "justify" }),
        text(63, 335, 685, "Icing your skin is an effective way to reduce inflammation and calm skin down. Grab a clean ice cube (or cold globes from the refrigerator—never freezer) and gently massage onto skin for no more than 2-3 minutes. Lastly, try to keep your hands away from your face to minimize the spread of bacteria and impurities.",
          { fontSize: 17.3, lineHeight: 1.21, align: "justify" }),
        photo(68, 455, 140, 136, "essentials-face-towels.jpg", "Disposable face towels", { link: "https://amzn.to/4h9Nclq" }),
        photo(238, 474, 177, 116, "essentials-silk-pillowcase.jpg", "Silk pillowcase", { link: "https://amzn.to/4kgd0yX" }),
        photo(443, 475, 130, 116, "essentials-ice-globes.jpg", "Ice globes", { link: "https://amzn.to/4bjlkcW" }),
        photo(599, 508, 126, 41, "essentials-shop-amazon.jpg", "Shop on Amazon", { link: "https://www.amazon.com/finds/post/list/amzn1.ideas.W2YSNKQHFFOS" }),
        text(54, 639, 440, "Hypochlorous acid spray by Magic Molecule is one of my favorite tools because it <i>mirrors a substance your body naturally produces to fight off bacteria and inflammation.</i> It’s gentle enough for everyday use (even on babies) and remarkably effective at calming active breakouts, soothing irritation, and speeding up the healing process for cuts, scrapes, and burns.",
          { fontSize: 17.3, lineHeight: 1.38 }),
        text(54, 828, 446, "Here’s how to use it: Simply mist it onto clean skin—focus on areas prone to breakouts (or post-picking) or irritation—and let it air dry; there’s no need to rinse. You’ll quickly notice relief from redness and swelling, making it a great option post-workout or whenever you can’t cleanse right away. Plus, it’s also beneficial for conditions like rosacea and psoriasis, offering a mild yet powerful boost to your regular skincare routine.",
          { fontSize: 17.3, lineHeight: 1.38 }),
        photo(530, 682, 172, 260, "essentials-magic-molecule.jpg", "Magic Molecule hypochlorous acid spray", { link: "https://skinbylauralo.com/product/magic-molecule-hypochlorous-acid-spray/" }),
        photo(548, 961, 133, 43, "essentials-shop-sbll.jpg", "Shop at Skin by Laura Lo", { link: "https://skinbylauralo.com/product/magic-molecule-hypochlorous-acid-spray/" }),
      ],
    }],
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    about: "Stress, exercise, sleep, mindfulness, relaxation and diet.",
    pages: [{
      letter: true,
      flows: { left: { gap: 30, bottom: 1045, minFontSize: 13 }, right: { gap: 30, bottom: 1045, minFontSize: 13 } },
      elements: [
        text(97, 46, 600, "LIFESTYLE", { fontSize: 111.1, lineHeight: 1, letterSpacing: -0.02, align: "center" }, { role: "title" }),
        text(97, 201, 600, "SELF-CARE IS A FUNDAMENTAL NECESSITY FOR NURTURING OUR<br>PHYSICAL, EMOTIONAL, AND SPIRITUAL WELL-BEING", { ...BODY, lineHeight: 1.17, align: "center" }),
        text(146, 258, 510, "Lifestyle can significantly impact acne development and severity of acne. Certain habits and choices can either worsen or improve acne conditions", { ...BODY, align: "center" }),
        text(79, 374, 560, "<b>STRESS</b><br>The link between stress and acne is well-established and has been studied extensively. Stress can have a significant impact on various physiological processes in the body, including those that influence the development of acne", BODY),
        { ...section(79, 270, "EXERCISE", "Engage in regular physical activity, as it can help reduce stress hormones and promote overall well-being.", "left"), y: 522 },
        section(79, 270, "MINDFULNESS", "Practice mindfulness and meditation to center yourself, reduce stress, and improve emotional balance.", "left"),
        section(79, 270, "HEALTHY DIET", "Eat a balanced diet rich in fruits, vegetables, whole grains, and lean proteins to support your body during stressful periods.", "left"),
        { ...section(397, 320, "SLEEP", "Prioritize getting enough sleep to allow your body to rest, repair, and recover.", "right"), y: 522 },
        section(397, 320, "RELAXATION", "Explore relaxation techniques like deep breathing, yoga, or progressive muscle relaxation to calm your mind and body.", "right"),
        text(397, 0, 320, "By managing stress effectively and adopting a healthy lifestyle, you can help mitigate its impact on acne and improve your overall skin health. If you find that stress is significantly affecting your well-being and acne, consider consulting with a healthcare professional for additional support and guidance.", BODY, { flow: "right" }),
      ],
    }],
  },
  {
    id: "nutrition",
    label: "Nutrition",
    about: "Supporting your skin from within: the foods to eat more often.",
    pages: [{
      elements: [
        text(97, 54, 600, "NUTRITION", { fontSize: 106.7, lineHeight: 1, letterSpacing: -0.02, align: "center" }, { role: "title" }),
        text(97, 184, 600, "SUPPORTING YOUR SKIN FROM WITHIN", { fontSize: 21.5, lineHeight: 1.1, align: "center" }),
        text(66, 240, 668, "Your skin is influenced by many factors, including hormones, genetics, skincare habits, lifestyle, and potentially diet. While food alone does not cause or cure acne, certain dietary patterns may influence breakouts in some individuals. <i>The goal isn't to restrict everything you eat, but to build balanced habits that support your overall health and skin.</i>",
          { fontSize: 17.3, lineHeight: 1.38, align: "justify" }),
        text(66, 389, 500, "FOODS TO INCORPORATE MORE OFTEN", { fontSize: 21.3, lineHeight: 1.1 }),
        rule(64, 429, 660),
        ...[
          ["nutrition-fats.jpg", "Healthy Fats &amp; Omega-3s", "Salmon, sardines, trout, extra-virgin olive oil, avocados, walnuts, chia seeds, and flaxseeds.<br>Provide essential fatty acids that support healthy skin function and help regulate inflammation.", "Salmon, avocado and greens"],
          ["nutrition-fruits.jpg", "Antioxidant-Rich Fruits", "Blueberries, strawberries, cherries, oranges, and other colorful fruits.<br>Provide vitamins and antioxidants that support overall skin health.", "A bowl of berries"],
          ["nutrition-vegetables.jpg", "Colorful Vegetables", "Broccoli, carrots, sweet potatoes, spinach, kale, and leafy greens. Rich in fiber, vitamins, and nutrients essential for healthy skin function.", "Roasted vegetables"],
          ["nutrition-grains.jpg", "Fiber &amp; Whole Grains", "<i>Oats, quinoa, lentils, beans, and whole grains.</i><br>Support balanced blood sugar levels, healthy digestion, and regular bowel movements to help your body eliminate waste efficiently.", "Quinoa and beans"],
          ["nutrition-fermented.jpg", "Fermented Foods", "<i>Plain yogurt, kefir, kimchi, and sauerkraut, if tolerated.</i> May support digestive and gut health, although their direct effects on acne are not yet well established.", "Bowls of yogurt and kefir"],
        ].flatMap(([file, heading, words, alt], index) => {
          const top = [458, 583, 707, 829, 951][index];
          return [
            photo(96, top, 111, 112, file, alt),
            text(222, top - 6, 470, heading, { fontSize: 17.3, lineHeight: 1.15 }),
            text(222, top + 14, 470, words, { fontSize: 16, lineHeight: 1.19, align: "justify" }),
          ];
        }),
      ],
    }],
  },
  {
    id: "habits",
    label: "Healthy (skin) Habits",
    about: "Toothpaste and perioral dermatitis, laundry, professional treatments, whey protein and energy drinks.",
    pages: [{
      letter: true,
      flows: { habits: { gap: 34, bottom: 1045, minFontSize: 13 } },
      elements: [
        text(112, 37, 300, "HEALTHY<br>HABITS", { fontSize: 60.5, lineHeight: 1.05, letterSpacing: -0.02 }, { role: "title" }),
        text(372, 52, 200, "(skin)", { font: "script", fontSize: 89.4, lineHeight: 1 }),
        { ...section(95, 330, "SLS + FLUORIDE FREE TOOTHPASTE", "Perioral Dermatitis (PD) is often mistaken for acne. It is characterized by the presence of red, inflamed, and sometimes bumpy or pustular rash. If you suspect PD opt for a fluoride and SLS free toothpaste.", "habits"), y: 267 },
        section(95, 330, "LAUNDRY", "Change your sheets, especially your pillow case often. Wash everything in fragrance- free + dye free detergent. Choose fragrance-free Downey fabric softener or dryer balls to replace traditional dryer sheets.", "habits"),
        section(95, 330, "PROFESSIONAL TREATMENTS", "Seeing an esthetician is an important part of maintaining healthy skin.<br><br>Professional treatments provide guidance on managing acne and planning appropriate treatments to reduce breakouts and minimize scarring.", "habits"),
        section(95, 330, "WHEY PROTEIN &amp; ENERGY DRINKS", "Both can trigger insulin spikes, stimulate IGF-1 and inflammation, which lead to excess oil production &amp; clogged pores.", "habits"),
        { ...photo(491, 280, 237, 748, "habits-skin-photo.jpg", "Close-up of skin in black and white"), fit: "cover" },
      ],
    }],
  },
  {
    id: "hormones",
    label: "Hormones",
    about: "Androgens, the menstrual cycle, puberty, estrogen and progesterone, PCOS, testosterone and pregnancy.",
    pages: [{
      letter: true,
      flows: { left: { gap: 28, bottom: 1045, minFontSize: 13 }, right: { gap: 28, bottom: 1045, minFontSize: 13 } },
      elements: [
        text(72, 46, 650, "HORMONES", { fontSize: 111.1, lineHeight: 1, letterSpacing: -0.02, align: "center" }, { role: "title" }),
        text(97, 201, 600, "THE INTERPLAY OF HORMONES AND ACNE IS COMPLEX AND VARIES FROM PERSON TO PERSON. SOME INDIVIDUALS MAY BE MORE SENSITIVE TO HORMONAL FLUCTUATIONS, MAKING THEM MORE PRONE TO ACNE BREAKOUTS DURING SPECIFIC PERIODS IN LIFE.",
          { ...BODY, lineHeight: 1.17, align: "center" }),
        { ...section(79, 280, "ANDROGENS", "Androgens are male sex hormones that are present in both males and females. They stimulate the sebaceous glands in the skin to produce sebum. Higher levels of androgens can lead to increased sebum production, making the skin more prone to acne breakouts.", "left"), y: 342 },
        section(79, 280, "ESTROGEN AND PROGESTERONE", "Estrogen and progesterone are female sex hormones that can influence the skin's response to androgens. They can help regulate sebum production and may have a protective effect against acne in some cases.", "left"),
        section(79, 280, "TESTOSTERONE", "Testosterone is a type of androgen that is more prevalent in males but is also present in females. Increased testosterone levels can contribute to acne development by increasing sebum production and causing skin inflammation.", "left"),
        { ...section(397, 300, "MENSTRUAL CYCLE", "Hormonal fluctuations during the menstrual cycle can trigger acne breakouts in some women. Acne may worsen before or during menstruation due to changes in estrogen and progesterone levels.", "right"), y: 342 },
        section(397, 300, "PUBERTY", "During puberty, there is an increase in androgen production, leading to the onset of acne in many teenagers.", "right"),
        section(397, 300, "PCOS", "PCOS is a hormonal disorder that can cause hormonal imbalances, including elevated androgen levels, leading to acne and other skin issues.", "right"),
        section(397, 300, "PREGNANCY", "Hormonal changes during pregnancy can also affect the skin and may lead to acne breakouts in some women.", "right"),
      ],
    }],
  },
  {
    id: "birth-control",
    label: "Birth Control and Acne",
    about: "Which birth control the FDA approved for acne, and which progestins can make it worse.",
    pages: [article("Birth Control", "And Acne Simplified", [
      P("Birth control pills, IUDs, implants, and shots are popular forms of birth control. Typically, these forms of birth control are divided up as estrogen or progestin dominant and have varying degrees of androgenic (testosterone like) effects. Those with the potential for higher androgenic effects may exacerbate acne breakouts. The FDA has approved the following types of birth control for acne:"),
      LIST([
        "<b>Ortho Tri-Cyclen</b> (norgestimate/ethinyl estradiol)",
        "<b>Estrostep</b> (norethindrone acetate/ethinyl estradiol) (discontinued)",
        "<b>YAZ</b> (drospirenone/ethinyl estradiol). The FDA has concluded that birth control pills containing drospirenone may have increased risk for blood clots compared to pills containing other progestins. Other brands containing drospirenone include Beyaz, Gianvi, Loryna, Ocella, Safyral, Syeda, Yasmin, and Zarah.",
      ]),
      P("Not all birth control pills are the same. Pills that contain the following androgenic (testosterone-like progestins) hormones may cause or worsen acne."),
      LIST(["desogestrel and 3-cetodesogestrel", "levonorgestrel", "lynestrenol", "norgestrienone", "norethindrone (norethisterone)", "norgestrel", "gestodene", "norgestimate", "etonogestrel"]),
    ], { bottomSize: 52 })],
  },
  {
    id: "sneaky-triggers",
    label: "Sneaky Triggers",
    about: "B12, biotin and energy drinks, fabric softener, sun exposure, and breakouts around the mouth.",
    pages: [article("Sneaky", "Triggers", [
      P("<b>VITAMIN B12, BIOTIN &amp; ENERGY DRINKS</b><br>High doses of Vitamin B12 and Biotin (Vitamin B7), commonly found in energy drinks, energy shots, multivitamins, and hair, skin, and nail supplements, may contribute to acne flare-ups in some individuals."),
      P("To put things into perspective, the recommended daily intake for most adults is just 2.4 mcg of Vitamin B12 and 30 mcg of Biotin. However, some energy drinks and beauty supplements contain hundreds or even thousands of micrograms per serving—far exceeding what your body typically needs each day."),
      P("<b>FABRIC SOFTENER</b><br>Fabric softeners and dryer sheets can leave behind a waxy residue on pillowcases, towels, sheets, and other fabrics that come into contact with your skin. Fragrances and other ingredients may irritate sensitive or acne-prone skin. Opt for fragrance-free laundry products and wool dryer balls as a gentler alternative."),
      P("<b>SUN EXPOSURE AND ACNE</b><br>Although sun exposure causes desirable scaling and drying, it also damages the follicle, exacerbates dark spots, and causes skin cancer and premature aging. Always wear sunscreen, even if it’s overcast and/or raining."),
      P("<b>BREAKOUTS AROUND THE MOUTH AREA</b><br>Many lip balms, toothpastes, and even facial tissues have comedogenic ingredients in them. If you see breakouts around your mouth area, one of these products may be the culprit. We recommend petroleum jelly as a lip balm and toothpaste without SLS (sodium lauryl sulfate)."),
      P("Many well-known tissue brands are infused with things like coconut oil, isopropyl myristate, and SLS, all of which will clog the pores."),
    ])],
  },
  {
    id: "supplements",
    label: "Supplements That Can Help Acne",
    about: "Zinc and omega-3 fish oil: what to take and how much.",
    pages: [article("Supplements", "That Can Help Acne", [
      P("The following supplements have been found to be useful for acne-prone skin."),
      H("Anti-inflammatory supplements"),
      P("<b>Zinc Monomethionine</b><br>Zinc is a powerful anti-inflammatory that helps reduce acne severity, especially in those with low zinc levels."),
      LIST([
        "Dosage: 50-100mg daily (do not exceed 100mg).",
        "Best Practice: Take with food to avoid nausea.",
        "Long-Term Use: Stop daily intake once your skin clears—this is not a long-term preventative.",
      ]),
      P("Always consult your doctor before supplementing."),
      P("<b>Omega 3 Fish Oils</b><br>High-quality omega-3s help regulate oil production and reduce inflammation."),
      LIST([
        "Source Matters: Look for molecularly distilled or pharmaceutical-grade fish oil to avoid oxidation and contaminants.",
        "Dosage: 1,000-1,700 mg of EPA &amp; DHA combined, with a 2:1 EPA-to-DHA ratio.",
        "Quality Check: Choose enteric-coated capsules to prevent fishy burps.",
      ]),
      P("Cheap fish oils often lack enough EPA &amp; DHA—always read labels!"),
    ])],
  },
  {
    id: "gut",
    label: "Gut Health and Acne",
    about: "The skin-gut connection, and how to support your gut for clear skin.",
    pages: [article("Gut Health &amp; Acne:", "The Skin-Gut Connection", [
      P("Your skin is often a reflection of what’s happening inside your body—especially in your gut. When digestion is off, inflammation builds, and your skin pays the price. Here’s why:"),
      H("How Gut Health Affects Your Skin"),
      P("<b>1. Inflammation Starts in the Gut</b><br>Poor digestion, food sensitivities, and an imbalanced gut microbiome trigger chronic inflammation, which can show up as persistent breakouts, redness, or irritation."),
      P("<b>2. Leaky Gut &amp; Acne</b><br>When the gut lining becomes damaged (leaky gut), toxins and undigested food particles escape into the bloodstream, sparking systemic inflammation that can worsen acne, rosacea, and other skin conditions."),
      P("<b>3. The Role of Good &amp; Bad Bacteria</b><br>Your gut is home to trillions of bacteria—some beneficial, some harmful. When the bad bacteria outnumber the good (due to poor diet, antibiotics, or stress), your body becomes more inflamed and acne-prone."),
      P("<b>4. Digestive Issues = Poor Nutrient Absorption</b><br>Your body needs zinc, vitamin A, and omega-3s to regulate oil production, heal breakouts, and keep skin balanced. If your gut isn’t properly absorbing nutrients, your skin doesn’t get what it needs to stay clear."),
      H("How to Support Your Gut for Clear Skin"),
      LIST([
        "<b>Take a Probiotic:</b> A high-quality probiotic supplement helps restore balance and fights acne-causing bacteria from the inside out.",
        "<b>Eat Probiotic-Rich Foods:</b> Greek yogurt (unsweetened) and coconut yogurt are great sources of probiotics. Other options include kimchi, sauerkraut, kefir, and miso.",
        "<b>Limit Sugar &amp; Processed Foods:</b> These feed bad bacteria and fuel inflammation.",
        "<b>Eat More Fiber:</b> Fiber (from fruits, veggies, and whole grains) keeps digestion moving and supports a healthy gut microbiome.",
        "<b>Stay Hydrated:</b> Water helps flush out toxins that could otherwise show up on your skin.",
      ]),
      P("When you heal your gut, you address one of the root causes of acne, not just the symptoms. <b>A <i>healthy gut = calmer, clearer skin</i>!</b>"),
    ], { bottomSize: 44 })],
  },
  {
    id: "other-resources",
    label: "Other Helpful Resources",
    about: "Red LED light therapy at home, and support for skin picking.",
    pages: [article("Other Helpful", "Resources", [
      H("General Guide for Red LED Light Therapy"),
      P("Red LED light therapy is an excellent addition to your skincare routine, promoting healthier skin by reducing inflammation, supporting collagen production, and improving overall skin texture. Here’s how to use it effectively:"),
      LIST([
        "<b>Prep Your Skin:</b> Start with a clean, dry face. Cleanse thoroughly to remove any makeup, sunscreen, or debris.",
        "<b>Device Guidelines:</b> Use the device for 10-15 minutes per day or as directed by the product manual.",
        "<b>Post-Therapy Care:</b> Follow with a hydrating toner or serum and finish with a moisturizer. If used during the day, always apply SPF as red light can increase skin sensitivity to UV rays.",
        "<b>Consistency is Key:</b> Use it regularly to see long-term benefits.",
        "<b>Avoid Overuse:</b> Stick to the recommended time to prevent overstimulating the skin.",
        "<b>Clean Your Device:</b> Wipe it with a clean cloth after each use to maintain hygiene.",
      ]),
      P("<b>Effective Wavelengths:</b><br>• <b>Red Light Therapy:</b> Wavelengths between 630-700 nm are optimal for stimulating collagen and targeting the skin's surface layers.<br>• <b>Infrared Light Therapy:</b> Wavelengths between 700-1200 nm penetrate deeper into the skin to promote healing and improve blood flow."),
      H("Support for Skin Picking (Dermatillomania)"),
      P("If you struggle with the urge to pick at your skin, know that you’re not alone, and there are resources to help. Here are a few tips to support you:"),
      { ...P("1. <b>Resources:</b> Visit this website (skinpick.com) for free tools, information, and support specifically tailored to those dealing with skin picking or dermatillomania."), link: "https://www.skinpick.com/" },
      P("2. <b>Alternative Actions:</b> When you feel the urge to pick, try holding an ice cube instead. The cold sensation can help redirect your focus and soothe the skin."),
      P("3. <b>Be Kind to Yourself:</b> Healing is a process, and it’s okay to have setbacks. Focus on small victories and keep moving forward."),
      P("<i>Remember, your skin is on a journey, and every step you take towards healthier habits is a win!</i>"),
    ])],
  },
  {
    id: "rosacea",
    label: "Helpful Tips for Rosacea and Redness",
    about: "Avoiding common triggers: food and drink, stress and weather.",
    pages: [article("Helpful Tips", "For Rosacea + Redness", [
      H("Avoid Common Triggers"),
      P("Identify and avoid personal rosacea triggers, which may include spicy foods, alcohol, extreme temperatures, and stress. Keeping a diary can help pinpoint specific factors that cause flare-ups."),
      P("<b>Intentional with nutrition:</b> Certain foods and beverages, including spicy foods, hot drinks, caffeine, and alcohol (especially red wine), can trigger rosacea symptoms. Pay attention to your body's responses and consider moderating or avoiding these items if they cause issues."),
      P("<b>Manage Stress:</b> Stress is a known trigger for rosacea flare-ups. Incorporate stress-reduction techniques such as yoga, meditation, or deep-breathing exercises into your daily routine."),
      P("<b>Protect Against Weather Extremes:</b> Both hot and cold weather can exacerbate rosacea. In cold conditions, protect your face with a scarf (preferably made of a non-irritating fabric), and in hot weather, seek shade and stay cool to prevent overheating."),
    ], { bottomSize: 50 })],
  },
  {
    id: "makeup",
    label: "Acne-Safe Makeup Options",
    about: "Three pages of foundations, blush, powders, concealers, setting sprays, bronzers and primers.",
    pages: [
      columns("Acne-Safe", "Makeup Options", [
        H("Drugstore Makeup"),
        LIST(["NYX total control coverage", "Maybelline super stay 24 hour foundation", "L'Oreal infallible pro matte", "L’Oreal Paris True Match Hyaluronic Tinted Serum", "Maybelline Fit Me Matte + Poreless"]),
        H("High End Foundation"),
        LIST(["ColoreScience Flex Tinted SPF", "Giorgio Armani luminous silk foundation", "Priia Cosmetics - all acne safe", "Tarte Amazonian Clay foundation", "Cover FX cover drops", "Kat Von D lock it foundation", "Estée Lauder double wear foundation", "Naked stay naked foundation", "Tarte Amazonian Clay stick foundation"]),
        H("Powders"),
        LIST(["Morphe Bake &amp; Set Setting Powder", "Kosas Cloud Set Baked Setting &amp; Smoothing Talc-Free Vegan Powder", "Armani Beauty Luminous Silk Glow Setting Powder", "Priia Loose Mineral Powder", "Ami Colé Skin Melt Talc-Free Loose Setting Powder", "Priia Hydra Control HD Powder", "Priia Conceal &amp; Correct Powder", "Priia Smoothing Finishing Powder"]),
      ], [
        H("Blush"),
        LIST(["Elf cosmetics putty blush", "BareMinerals Gen nude powder blush", "Tarte cosmetics Amazonian Clay blush", "NudeStix nudie bloom", "BareMinerals bounce and blur blush", "Milani cheek kiss blush", "Color pop super shock blush", "It cosmetics bye-bye pore blush", "Nars orgasm illuminating loose powder", "Kaja cheeky stamp", "Armani beauty Neo nude liquid", "Merit Flush balm cream", "Fenty beauty match six shimmer skinstick", "Nars liquid blush", "Stila complete harmony lip and cheek", "Rare beauty soft pinch liquid", "Westman Atelier baby cheek blush", "BareMinerals Gen nude blush and bronzer", "Rare Beauty by Selena Gomez Soft Pinch Liquid Blush", "Saie Dew Blush Liquid Cheek Blush", "Dior Rosy Glow Blush", "Benetint Liquid Lip Blush &amp; Cheek Tint"]),
      ]),
      columns("Acne-Safe", "Makeup Options", [
        H("Concealers"),
        LIST(["Tom Ford Emotionproof Concealer", "Jeffree Star Magic Star Concealer", "Givenchy Instant Light Corrective Pen", "Fenty Beauty Match Six Matte Skinstick", "Pat McGrath Sublime Perfection Concealer", "Bobbi Brown Under Eye Corrector", "Armani Beauty Luminous Silk", "Merit Minimalist Perfecting Complexion", "Rare Beauty Liquid Touch Brightening", "Tarte Amazonian Clay Creaseless", "Becca Ultimate Coverage Longwear", "Nars Instant Radiant Concealer", "Honest Beauty Bright Eye Tinted Cream", "Cover FX Power Play Concealer", "Smashbox Studio Skin Flawless Oil Free", "Estée Lauder Double Wear Stay In Place", "Lancôme Effacernes Waterproof Concealer", "Dermablend Full Coverage Concealer", "Ulta Full Coverage Concealer"]),
      ], [
        LIST(["NYX HD Studio Photogenic Concealer", "L'Oréal Infallible Full Wear", "Maybelline Fit Me Concealer", "Elf 16hr Camo Concealer", "MAC Pro Longwear Concealer", "Maybelline Instant Age Rewind Concealer", "BarePro 16hr Full Coverage Concealer", "IT Cosmetics Bye Bye Under Eye", "Elf Hydrating Camo Concealer", "Kylie Cosmetics Skin Concealer", "Too Faced Born This Way Concealer", "UOMA Beauty Stay Woke Concealer", "IT cosmetics Bye Bye Breakout", "Tarte Amazonian Clay 12hr Waterproof"]),
        H("Setting Spray"),
        LIST(["Priia Setting Essence", "Charlotte Tilbury Airbrush Flawless Setting Spray", "Morphe Continuous Setting Mist Jumbo", "Anastasia Beverly Hills Dewy Set Setting Spray", "Caliray Surfproof Hydrating Setting Spray with Niacinamide", "MAKE UP FOR EVER Mist &amp; Fix 24HR Hydrating Setting Spray", "Iconic London Prep Set Glow Hydrating Spray"]),
      ]),
      columns("Acne-Safe", "Makeup Options", [
        H("Bronzers"),
        LIST(["Nudestix bronzer", "It cosmetics your most beautiful palette", "Clinique sun kissed face glee", "Morphe brontour", "Lancôme star bronzer", "Han skincare cosmetics matte bronzer", "Stila twin cheeks kitten bronzer duo", "LYS no limits matte bronzer", "Huda beauty tantour contour &amp; bronzer cream", "Danessa Myricks power bronzer cream", "Ilia nightlife bronzer powder", "Givenchy tint couture healthy glow powder", "Kaja beachy stamp", "Fenty match stix matte contour", "Tarte Amazonian clay bronzer", "Priia cosmetics bronzer", "Rare beauty liquid luminizer", "Wet and wild color icon bronzer", "KVD Beauty ModCon Long-Wear Hydrating Liquid-Gel Contour", "Warm Wishes Effortless Bronzer Sticks", "Charlotte Tilbury Beautiful Skin Sun-Kissed Glow Cream Bronzer", "Drunk Elephant D-Bronzi™ Bronzing Drops with Peptides", "LYS Beauty No Limits Matte Bronzer"]),
      ], [
        H("Primers"),
        LIST(["Tatcha silk canvas", "Smashbox photo finish vitamin face glow", "Tatcha liquid silk canvas", "Milk hydro grip", "NYX high glass primer", "Tarte double duty beauty primer", "Bare minerals prime time", "Hourglass veil mineral primer", "Smashbox oil and shine control", "Ulta poreless primer", "Becca skin love brighten blur", "Becca ever matte poreless", "Smashbox photo finish", "Charlotte Tilbury brightening youth glow", "Fenty Beauty Pro Filt'r Mattifying Primer", "Smashbox Photo Finish Smooth &amp; Blur Oil-Free Foundation Primer", "Rare Beauty by Selena Gomez Pore Diffusing Primer - Always an Optimist Collection", "Hourglass Vanish Airbrush Primer", "Benefit Cosmetics The POREfessional Pore Minimizing Primer", "Liquid Silk Canvas: Featherweight Protective Primer", "Priia Foundation Primer"]),
      ]),
    ],
  },
  {
    id: "post-treatment",
    label: "Post-Treatment Guide",
    about: "Aftercare for the days after a facial or peel, and booking the next visit.",
    pages: [article("Facials Guide", "Post-Treatment", [
      P("<b>STAY OUT OF DIRECT SUNLIGHT</b><br>Make sure to keep your face out of direct sunlight for at least 48 hours after your treatment. It's super important to use a broad-spectrum sunscreen with an SPF of 30 or higher to keep your skin safe from UV damage."),
      P("<b>AVOID TOUCHING/SCRUBBING</b><br>Try not to touch your face, and hold off on using any physical or chemical exfoliants for at least 48 hours. This helps to avoid irritation and gives the products you've applied a chance to work their magic."),
      P("<b>BE CAREFUL WITH PRODUCTS!</b><br>Steer clear of products that have strong active ingredients like retinol, AHAs, or BHAs for at least 3 days. Instead, choose gentle and calming products."),
      P("<b>STAY COOL</b><br>Try to stay away from saunas, steam baths, or hot showers for the first 48 hours to keep irritation at bay."),
      P("<b>SUN SAFETY</b><br>Make sure to put on sunscreen every morning and reapply it every 2 hours if you're outside. This is super important to keep your treated skin safe."),
      P("<b>NO THICK MAKEUP</b><br>Avoid heavy makeup for 24 hours to let your skin breathe and recover properly. If you need to wear makeup, make sure it is acne-safe. <i>Feel free to ask me for suggestions on makeup that won't clog your pores!</i>"),
      P("<b>REACH OUT TO ME</b><br>If you notice any unusual reactions or have questions about how to take care of your skin after a facial, don’t hesitate to reach out to me for some tailored tips!"),
      H("Book your next treatment"),
      P("I recommend pre-booking your appointments so we can <b>1.</b> Stay consistent with treatments <b>2.</b> Are able to find the best time that fits your schedule"),
      { ...P("Next appointment date: ______________________"), role: "appointment" },
      P("SkinbyLauraLo.com | Cel. 786.380.8970 | @skinbylauralo"),
    ])],
  },
];

export const RESOURCE_ORDER = GUIDE_RESOURCES.map((resource) => resource.id);

export function guideResource(id) {
  return GUIDE_RESOURCES.find((resource) => resource.id === id) || null;
}
