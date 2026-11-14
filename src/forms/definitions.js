// The client forms, written as data. Each form is a list of steps, and each
// step a list of questions. The public page, the checks on what was sent, the
// admin's view of a submission and the note fed into the client's insight are
// all built from these, so adding a form means adding an entry here.
//
// Question types:
//   text, email, tel, date, textarea — a typed answer
//   choices  — pick any number of `options`; `none` names the option that clears the others
//   choice   — pick one of `options`
//   yesno    — Yes or No; `details` asks for more when the answer is Yes
//   agree    — a statement to tick; with `required`, it has to be ticked
//   signature — the client types their full name
//
// `note` says how an answer reads in the client's notes, which is what the AI
// insight and the safety check read. Wording matters there: "No known
// allergies" is read as a negative, while "Allergies: none" would be flagged.
// Questions without a `note` (contact details, consent) stay out of the notes.
//
// `google` is the start of the matching question's title in the original
// Google Form, so past responses can be imported from its CSV export
// (src/forms/google-import.js).
//
// A step with `showIf` only appears when one of those answers was picked, and
// its questions are ignored when it is hidden.

const YES_NO = ["Yes", "No"];

const BROWS_LASHES = {
  slug: "brows-lashes",
  title: "Brow + Lashes Intake Form",
  navLabel: "Brows + lashes intake",
  description: "Fill this out before your brow or lash appointment so Laura can plan a safe, beautiful result.",
  intro: "Please fill this out as best you can for the services you're booking. It takes about 4 minutes, and only Laura sees your answers.",
  version: 1,
  steps: [
    {
      id: "about",
      title: "About you",
      questions: [
        { id: "full_name", google: "Full Name", type: "text", label: "Full name", required: true, autocomplete: "name" },
        { id: "email", google: "Email", type: "email", label: "Email", required: true, autocomplete: "email" },
        { id: "phone", google: "Phone number", type: "tel", label: "Phone number", autocomplete: "tel", hint: "Helps Laura match this form to your booking." },
        { id: "date_of_birth", google: "Date of birth", type: "date", label: "Date of birth", required: true, autocomplete: "bday" },
        { id: "address", google: "Address", type: "textarea", label: "Address", autocomplete: "street-address", rows: 2 },
      ],
    },
    {
      id: "goals",
      title: "Your appointment",
      questions: [
        {
          id: "services",
          google: "What are your main goals",
          type: "choices",
          label: "What are your main goals for this appointment?",
          hint: "Pick all that apply. You'll only see the questions for these services.",
          required: true,
          options: ["Brow shaping & design", "Brow lamination/lift", "Tinting (Brows or Lashes)", "Lash lift", "Waxing"],
          note: { label: "Booked for" },
        },
      ],
    },
    {
      id: "history",
      title: "Skin & health history",
      intro: "This gives Laura the best possible picture of your skin health, for safe and lasting results.",
      questions: [
        {
          id: "skincare_actives",
          google: "Are you currently using any of the following skincare products",
          type: "choices",
          label: "Are you currently using any of these?",
          options: ["Retinoids (e.g., Retin-A, Tretinoin)", "Exfoliating Acids (AHAs, BHAs)", "Accutane or other oral acne medications", "None of the above"],
          none: "None of the above",
          required: true,
          note: { label: "Currently using", none: "Not using retinoids, exfoliating acids or oral acne medication" },
        },
        {
          id: "allergies",
          google: "Do you have any known allergies",
          type: "yesno",
          label: "Do you have any known allergies?",
          required: true,
          details: { label: "What are you allergic to?" },
          note: { yes: "Allergies", no: "No known allergies" },
        },
        {
          id: "prescriptions",
          google: "Are you using any medications or creams prescribed",
          type: "yesno",
          label: "Are you using any medications or creams prescribed by a dermatologist on or near the area to be treated?",
          required: true,
          details: { label: "Which ones?" },
          note: { yes: "Prescribed by a dermatologist for the area", no: "No dermatologist prescriptions near the area" },
        },
        {
          id: "conditions",
          google: "Do you currently have or have you ever had",
          type: "choices",
          label: "Do you currently have, or have you ever had, any of these?",
          hint: "Pick all that apply, or leave blank if none.",
          options: ["Facial Treatments Recently", "Eczema", "Sunburn", "Psoriasis", "Open/healing wounds in the area to be treated", "Chemotherapy", "Alopecia"],
          note: { label: "Has had" },
        },
        {
          id: "pregnant",
          google: "Are you pregnant",
          type: "yesno",
          label: "Are you pregnant?",
          required: true,
          note: { yes: "Pregnant", no: "Not pregnant" },
        },
        {
          id: "autoimmune",
          google: "Do you have any autoimmune",
          type: "yesno",
          label: "Do you have any autoimmune disorders that could affect healing or increase sensitivity?",
          required: true,
          details: { label: "Which one?" },
          note: { yes: "Autoimmune disorder", no: "No autoimmune disorders" },
        },
      ],
    },
    {
      id: "tinting",
      title: "Tinting",
      intro: "For brow or lash tinting.",
      showIf: { question: "services", anyOf: ["Tinting (Brows or Lashes)"] },
      questions: [
        {
          id: "dye_before",
          google: "Have you used any hair or skin dye",
          type: "yesno",
          label: "Have you used hair or skin dye products before?",
          required: true,
          note: { yes: "Has used hair or skin dye before", no: "Has never used hair or skin dye" },
        },
        {
          id: "dye_reaction",
          google: "Have you ever experienced a reaction to hair or skin dye",
          type: "yesno",
          label: "Have you ever had a reaction to hair or skin dye?",
          required: true,
          details: { label: "What happened?" },
          note: { yes: "Reaction to dye", no: "No past dye reactions" },
        },
      ],
    },
    {
      id: "lift",
      title: "Lamination & lash lift",
      intro: "For brow lamination or a lash lift.",
      showIf: { question: "services", anyOf: ["Brow lamination/lift", "Lash lift"] },
      questions: [
        {
          id: "lift_before",
          google: "Have you had a lamination or lash lift service before",
          type: "yesno",
          label: "Have you had a lamination or lash lift before?",
          required: true,
          note: { yes: "Has had lamination or a lash lift before", no: "First lamination or lash lift" },
        },
        {
          id: "lift_reactions",
          google: "Have you experienced any of the following during a previous",
          type: "choices",
          label: "Did you have any of these during a previous lamination or lash lift?",
          options: ["Redness", "Swelling", "Burning or itching sensation", "Eye irritation or watering", "None of the above"],
          none: "None of the above",
          note: { label: "Past lift reaction", none: "No problems with past lifts" },
        },
        {
          id: "contacts",
          google: "Do you wear eye contacts",
          type: "yesno",
          label: "Do you wear contact lenses?",
          required: true,
          note: { yes: "Wears contact lenses", no: "No contact lenses" },
        },
        {
          id: "eye_conditions",
          google: "Do you have any eye conditions",
          type: "yesno",
          label: "Do you have any eye conditions, such as dry eye, conjunctivitis or recent eye surgery?",
          required: true,
          details: { label: "Please tell Laura more" },
          note: { yes: "Eye condition", no: "No eye conditions" },
        },
      ],
    },
    {
      id: "wax",
      title: "Brow waxing",
      showIf: { question: "services", anyOf: ["Waxing"] },
      questions: [
        {
          id: "recent_exfoliation",
          google: "Have you used any exfoliants or retinoids",
          type: "yesno",
          label: "Have you used any exfoliants or retinoids on your skin in the last 3 days?",
          hint: "This includes retinol, AHAs, BHAs or scrubs.",
          required: true,
          details: { label: "Which ones?" },
          note: { yes: "Exfoliant or retinoid in the last 3 days", no: "No exfoliants or retinoids in the last 3 days" },
        },
        {
          id: "recent_sun",
          google: "Have you been exposed to direct sun",
          type: "yesno",
          label: "Have you been in direct sun or a tanning bed in the last 48 hours?",
          required: true,
          note: { yes: "Sun or tanning bed in the last 48 hours", no: "No sun or tanning bed in the last 48 hours" },
        },
        {
          id: "blood_thinners",
          google: "Are you currently taking any blood thinners",
          type: "yesno",
          label: "Are you taking blood thinners or any medication that may affect skin sensitivity?",
          required: true,
          details: { label: "Which ones?" },
          note: { yes: "Blood thinners or sensitizing medication", no: "No blood thinners or sensitizing medication" },
        },
      ],
    },
    {
      id: "consent",
      title: "Consent & signature",
      intro: "While every precaution is taken to keep you safe, please read and tick each of these.",
      questions: [
        { id: "ack_risks", google: "While every precaution", type: "agree", required: true, label: "I understand that brow and lash services may carry risks, including allergic reactions, irritation or other side effects." },
        { id: "ack_honest", google: "While every precaution", type: "agree", required: true, label: "I agree to give complete and honest answers to the questions above, for a safe and optimal experience." },
        { id: "ack_notify", google: "While every precaution", type: "agree", required: true, label: "I will tell my esthetician right away if I feel any discomfort or have a reaction during or after the treatment." },
        { id: "ack_liability", google: "While every precaution", type: "agree", required: true, label: "My esthetician will take every precaution for my safety, but cannot be held liable for reactions caused by conditions or products I didn't mention." },
        { id: "ack_tint_spot", google: "While every precaution", type: "agree", required: true, label: "A faint dark spot may stay on the skin after tinting, and it fades soon after." },
        { id: "ack_tint_color", google: "While every precaution", type: "agree", required: true, label: "The final color may not exactly match what I expect, as each hair takes dye in its own way." },
        {
          id: "media_consent",
          google: "Do you consent to being photographed",
          type: "choice",
          label: "Can Laura photograph your treatment?",
          hint: "Photos may be used for marketing, including social media and the website.",
          required: true,
          options: ["Yes, with my name", "Yes, anonymously", "No"],
        },
        { id: "ack_accurate", google: "By submitting this form", type: "agree", required: true, label: "The information I've given is accurate and complete, and I've read and understood the risks of the services I'm booking." },
        { id: "ack_aftercare", google: "By submitting this form", type: "agree", required: true, label: "I'll follow the pre- and post-care instructions my esthetician gives me, for the best results." },
        { id: "signature", google: "By submitting this form", type: "signature", required: true, label: "Type your full name to sign", hint: "This is your digital signature for everything on this page." },
      ],
    },
  ],
};

// ---------------------------------------------------------------- facial and virtual intake
// Laura's facial and virtual-consultation forms ask the same about-you and
// health questions, in English and Spanish (`es`), so they share them here.

const aboutYou = (address = {}) => ({
  id: "about",
  title: "About you",
  es: "Sobre ti",
  questions: [
    { id: "full_name", google: "Full Name", type: "text", label: "Full name", es: "Nombre completo", required: true, autocomplete: "name" },
    { id: "email", google: "Email", type: "email", label: "Email", es: "Correo electrónico", required: true, autocomplete: "email" },
    { id: "phone", google: "Phone number", type: "tel", label: "Phone number", es: "Número telefónico", required: true, autocomplete: "tel", hint: "Helps Laura match this form to your booking." },
    { id: "date_of_birth", google: "Date of birth", type: "date", label: "Date of birth", es: "Fecha de nacimiento", required: true, autocomplete: "bday" },
    { id: "address", google: "Address", type: "textarea", label: "Address", es: "Dirección", autocomplete: "street-address", rows: 2, ...address },
  ],
});

const SKIN_PRIORITIES = {
  id: "skin_priorities",
  google: "What is your top skincare priority",
  type: "choices",
  label: "What are your top skincare priorities?",
  es: "¿Cuál es tu prioridad principal para la piel?",
  hint: "Pick all that apply.",
  required: true,
  options: ["Acne", "Hyperpigmentation / Manchas de la piel", "Fine lines & wrinkles / Líneas finas y arrugas", "Redness or sensitivity / Sensibilidad o enrojecimiento"],
  other: "Something else",
  note: { label: "Skin priorities" },
};

const SKIN_TYPE = {
  id: "skin_type",
  google: "How would you describe your skin type",
  type: "choices",
  label: "How would you describe your skin type?",
  es: "¿Cómo describirías tu tipo de piel?",
  hint: "Pick all that apply.",
  required: true,
  options: ["Normal/Combination", "Oily (Grasa)", "Dry (Seca)", "Sensitive (Sensible)", "Mature / Madura"],
  note: { label: "Skin type" },
};

const MAKEUP = {
  id: "makeup",
  google: "Do you wear makeup regularly",
  googleDetails: "If yes, please specify the products",
  type: "yesno",
  label: "Do you wear makeup regularly?",
  es: "¿Usas maquillaje regularmente?",
  required: true,
  details: { label: "Which products?" },
  note: { yes: "Wears makeup", no: "Doesn't wear makeup regularly" },
};

const healthStep = (extra = []) => ({
  id: "health",
  title: "Health",
  es: "Salud",
  intro: "So Laura can choose treatments and products that are safe for you.",
  questions: [
    {
      id: "skin_medications",
      google: "Are you taking any medications or using any skincare treatments",
      type: "choices",
      label: "Are you taking any medications or using any skincare treatments that might affect your skin?",
      es: "¿Estás tomando medicamentos o usando tratamientos que puedan afectar tu piel?",
      hint: "Pick all that apply.",
      required: true,
      options: ["Retinoids (e.g., Retin-A, Tretinoin)", "Birth control / Anticonceptivos", "Antibiotics / Antibióticos", "None / Ninguno"],
      none: "None / Ninguno",
      other: "Something else",
      note: { label: "Medications or treatments affecting skin", none: "No medications or treatments affecting her skin" },
    },
    {
      id: "allergies",
      google: "Do you have any known allergies",
      type: "choices",
      label: "Do you have any known allergies that might affect treatment?",
      es: "¿Tienes alergias que puedan afectar el tratamiento?",
      hint: "Pick all that apply.",
      required: true,
      options: ["Latex", "Fragrances / Fragancias", "Sunscreens / Protectores solares", "None / Ninguna"],
      none: "None / Ninguna",
      other: "Something else",
      note: { label: "Allergies", none: "No known allergies" },
    },
    {
      id: "health_conditions",
      google: "Do you have any health conditions",
      type: "choices",
      label: "Do you have any health conditions Laura should know about?",
      es: "¿Tienes alguna condición de salud que debamos conocer?",
      hint: "Pick all that apply.",
      required: true,
      options: [
        "Autoimmune disorder (e.g., Lupus, Rheumatoid Arthritis)", "Diabetes", "Herpes Simplex or cold sores / Herpes o aftas",
        "High/Low blood pressure / Presión alta o baja", "Psoriasis or Eczema / Psoriasis o eccema", "Recent surgeries / Cirugías recientes",
        "None of the above / Ninguna de las anteriores",
      ],
      none: "None of the above / Ninguna de las anteriores",
      other: "Something else",
      note: { label: "Health conditions", none: "No health conditions listed" },
    },
    {
      id: "supplements",
      google: "Are you currently taking any medications, vitamins, or supplements",
      type: "yesno",
      label: "Are you currently taking any medications, vitamins or supplements?",
      es: "¿Tomas algún medicamento o suplemento?",
      required: true,
      details: { label: "Which ones?" },
      note: { yes: "Takes", no: "No medications or supplements" },
    },
    {
      id: "pregnant",
      google: "Are you pregnant or nursing",
      type: "yesno",
      label: "Are you pregnant or nursing?",
      es: "¿Estás embarazada o lactando?",
      required: true,
      note: { yes: "Pregnant or nursing", no: "Not pregnant or nursing" },
    },
    ...extra,
  ],
});

const TRUTHFUL = {
  id: "ack_truthful",
  google: "I have read and completed this questionnaire truthfully",
  type: "agree",
  required: true,
  label: "I have completed this questionnaire truthfully. I understand that leaving information out, or giving wrong information, may lead to contraindications or skin irritation from treatments. My treatments are voluntary, and I release Skin by Laura Lo and/or its skin care professional from liability.",
  es: "Declaro haber completado este cuestionario de manera honesta. Los tratamientos son voluntarios y libero a Skin by Laura Lo de cualquier responsabilidad.",
};

const signature = (google) => ({ id: "signature", google, type: "signature", required: true, label: "Type your full name to sign", es: "Escribe tu nombre completo para firmar", hint: "This is your digital signature for everything on this page." });

const FACIAL = {
  slug: "facial",
  title: "Facial Intake Form",
  navLabel: "Facial intake",
  description: "Fill this out before your facial so Laura can tailor the treatment to your skin.",
  intro: "Please fill this out before your facial. It takes about 4 minutes, and only Laura sees your answers. Las preguntas también están en español.",
  version: 1,
  steps: [
    aboutYou(),
    {
      id: "skin",
      title: "Your skin",
      es: "Tu piel",
      questions: [
        {
          id: "facial_goal",
          google: "Why are you booking this service",
          type: "choice",
          label: "Why are you booking this facial?",
          es: "¿Cuál es tu objetivo para este tratamiento?",
          required: true,
          options: ["Relax and de-stress / Relajarme y reducir el estrés", "Correct or treat a specific concern / Corregir o tratar una preocupación", "Both / Ambos"],
          other: "Something else",
          note: { label: "Booked to" },
        },
        SKIN_PRIORITIES,
        SKIN_TYPE,
        {
          id: "current_products",
          google: "What skincare products are you currently using",
          type: "textarea",
          label: "What skincare products are you using now?",
          es: "¿Qué productos utilizas en tu rutina de cuidado de piel?",
          hint: "Cleanser, serums, moisturizer, sunscreen… whatever you remember.",
          note: { label: "Uses" },
        },
        MAKEUP,
      ],
    },
    healthStep(),
    {
      id: "consent",
      title: "Consent & signature",
      es: "Consentimiento y firma",
      questions: [
        {
          id: "media_consent",
          google: "Do you consent to being photographed",
          type: "choice",
          label: "Can Laura photograph your treatment?",
          es: "¿Das tu consentimiento para ser fotografiado(a)?",
          hint: "Photos may be used for marketing, including social media and the website.",
          required: true,
          options: ["Yes, with my name", "Yes, anonymously", "No"],
        },
        {
          id: "preferences",
          google: "Is there anything else we should know",
          type: "textarea",
          label: "Anything else that would make your visit better?",
          es: "¿Hay algo más que debamos saber para ofrecerte la mejor experiencia?",
          hint: "For example: music, essential oils, or silence.",
          note: { label: "Visit preferences" },
        },
        TRUTHFUL,
        signature("I have read and completed this questionnaire truthfully"),
      ],
    },
  ],
};

const routineQuestion = (id, google, label, es) => ({
  id, google, type: "text", label, es, hint: "Product name, or “none”.", note: { label },
});

const yesNoNote = (id, google, label, es, yes, no, details) => ({
  id, google, type: "yesno", label, es, required: true, ...(details ? { details: { label: details } } : {}), note: { yes, no },
});

const VIRTUAL = {
  slug: "virtual-consultation",
  title: "Virtual Intake Form",
  navLabel: "Virtual consultation intake",
  description: "Fill this out before your virtual consultation, with three photos of your skin.",
  intro: "Please fill this out before your virtual consultation. It takes about 6 minutes, and at the end you'll add three photos of your face. Only Laura sees your answers. Las preguntas también están en español.",
  version: 1,
  steps: [
    {
      ...aboutYou(),
      questions: [
        ...aboutYou().questions,
        { id: "referral", google: "How did you hear about us", type: "text", label: "How did you hear about Skin by Laura Lo?", es: "¿Cómo te enteraste de Skin by Laura Lo?" },
      ],
    },
    { id: "skin", title: "Your skin", es: "Tu piel", questions: [SKIN_PRIORITIES, SKIN_TYPE] },
    {
      id: "routine",
      title: "Your routine",
      es: "Tu rutina",
      intro: "What you use now, step by step.",
      questions: [
        routineQuestion("cleanser", "Cleanser", "Cleanser", "Jabón de cara"),
        routineQuestion("toner", "Toner or Essences", "Toner or essence", "Tonificador o esencia"),
        routineQuestion("serums", "Serums", "Serums", "Sueros"),
        routineQuestion("exfoliants", "Exfoliants", "Exfoliants", "Exfoliantes"),
        routineQuestion("moisturizer", "Moisturizers", "Moisturizer", "Hidratante o crema"),
        routineQuestion("sunscreen", "Sun Block", "Sunscreen", "Protector solar"),
        MAKEUP,
      ],
    },
    healthStep([
      yesNoNote("product_reactions", "Have you ever had any reaction to any products", "Have you ever had a reaction to a product you put on your face?",
        "¿Alguna vez has tenido reacción al aplicarte un producto en la piel?", "Past product reaction", "No past product reactions", "What happened?"),
      {
        id: "recent_treatments",
        google: "Other treatments",
        type: "choices",
        label: "What other treatments have you had on your skin in the last 90 days?",
        es: "¿Qué otros tratamientos has recibido en los últimos 90 días?",
        hint: "Pick all that apply, or leave blank if none.",
        options: ["Chemical peel / Peeling químico", "Microdermabrasion / microdermoabrasión", "Microneedling", "Laser / Láser", "Botox or fillers / Bótox o rellenos"],
        other: "Something else",
        note: { label: "Treatments in the last 90 days" },
      },
    ]),
    {
      id: "lifestyle",
      title: "Lifestyle",
      es: "Estilo de vida",
      intro: "Daily habits show up in the skin, so these help Laura build your plan.",
      questions: [
        yesNoNote("smoke", "Do you smoke/vape", "Do you smoke or vape?", "¿Fumas cigarrillo o vape?", "Smokes or vapes", "Doesn't smoke or vape"),
        { id: "occupation", google: "Occupation", type: "text", label: "What do you do for work?", es: "¿En qué trabajas?", note: { label: "Occupation" } },
        yesNoNote("shaving_irritation", "Do you have shaving irritation", "Do you get irritation after shaving your face?", "¿Tienes irritación en la piel después de afeitarte?",
          "Shaving irritation", "No shaving irritation"),
        { id: "razor", google: "What type of razor do you use", type: "text", label: "If you shave, what type of razor do you use?", es: "¿Qué tipo de rasuradora utilizas?", hint: "For example double blade, triple blade or rotary.", note: { label: "Razor" } },
        yesNoNote("stress", "Are you currently under a lot of stress", "Are you under a lot of stress right now?", "¿Estás bajo mucho estrés?",
          "Under a lot of stress", "Not under much stress"),
        {
          id: "diet",
          google: "Diet",
          type: "choices",
          label: "Do you eat or take any of these?",
          es: "¿Consumes alguno de los siguientes?",
          hint: "Pick all that apply.",
          options: ["Processed Food", "Milk/Yogurt", "Cheese", "Soy", "Sushi", "Seafood", "Vitamins/Supplements"],
          note: { label: "Diet includes" },
        },
      ],
    },
    {
      id: "photos",
      title: "Your photos",
      es: "Tus fotos",
      intro: "Three clear photos in good light, without makeup if you can: your left side, your right side, and straight on.",
      questions: [
        { id: "photos", google: "Take 3 pictures", type: "photos", label: "Add your three photos", es: "Agrega tus tres fotos", required: true, slots: ["Left side", "Right side", "Front"] },
      ],
    },
    {
      id: "consent",
      title: "Consent & signature",
      es: "Consentimiento y firma",
      questions: [
        TRUTHFUL,
        {
          id: "photo_use",
          google: "I agree that Skin by Laura Lo may use such photographs",
          type: "agree",
          label: "Skin by Laura Lo may use my photos, with or without my name, for lawful purposes such as publicity, advertising and web content.",
          es: "Acepto que Skin by Laura Lo pueda utilizar mis fotografías, con o sin mi nombre, para publicidad y contenido web.",
          hint: "Optional.",
        },
        signature("I have read and completed this questionnaire truthfully"),
      ],
    },
  ],
};

export const FORMS = [FACIAL, VIRTUAL, BROWS_LASHES];

export function formBySlug(slug) {
  return FORMS.find((form) => form.slug === slug) || null;
}
