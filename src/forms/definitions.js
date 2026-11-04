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
        { id: "full_name", type: "text", label: "Full name", required: true, autocomplete: "name" },
        { id: "email", type: "email", label: "Email", required: true, autocomplete: "email" },
        { id: "phone", type: "tel", label: "Phone number", autocomplete: "tel", hint: "Helps Laura match this form to your booking." },
        { id: "date_of_birth", type: "date", label: "Date of birth", required: true, autocomplete: "bday" },
        { id: "address", type: "textarea", label: "Address", autocomplete: "street-address", rows: 2 },
      ],
    },
    {
      id: "goals",
      title: "Your appointment",
      questions: [
        {
          id: "services",
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
          type: "choices",
          label: "Are you currently using any of these?",
          options: ["Retinoids (e.g., Retin-A, Tretinoin)", "Exfoliating Acids (AHAs, BHAs)", "Accutane or other oral acne medications", "None of the above"],
          none: "None of the above",
          required: true,
          note: { label: "Currently using", none: "Not using retinoids, exfoliating acids or oral acne medication" },
        },
        {
          id: "allergies",
          type: "yesno",
          label: "Do you have any known allergies?",
          required: true,
          details: { label: "What are you allergic to?" },
          note: { yes: "Allergies", no: "No known allergies" },
        },
        {
          id: "prescriptions",
          type: "yesno",
          label: "Are you using any medications or creams prescribed by a dermatologist on or near the area to be treated?",
          required: true,
          details: { label: "Which ones?" },
          note: { yes: "Prescribed by a dermatologist for the area", no: "No dermatologist prescriptions near the area" },
        },
        {
          id: "conditions",
          type: "choices",
          label: "Do you currently have, or have you ever had, any of these?",
          hint: "Pick all that apply, or leave blank if none.",
          options: ["Facial Treatments Recently", "Eczema", "Sunburn", "Psoriasis", "Open/healing wounds in the area to be treated", "Chemotherapy", "Alopecia"],
          note: { label: "Has had" },
        },
        {
          id: "pregnant",
          type: "yesno",
          label: "Are you pregnant?",
          required: true,
          note: { yes: "Pregnant", no: "Not pregnant" },
        },
        {
          id: "autoimmune",
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
          type: "yesno",
          label: "Have you used hair or skin dye products before?",
          required: true,
          note: { yes: "Has used hair or skin dye before", no: "Has never used hair or skin dye" },
        },
        {
          id: "dye_reaction",
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
          type: "yesno",
          label: "Have you had a lamination or lash lift before?",
          required: true,
          note: { yes: "Has had lamination or a lash lift before", no: "First lamination or lash lift" },
        },
        {
          id: "lift_reactions",
          type: "choices",
          label: "Did you have any of these during a previous lamination or lash lift?",
          options: ["Redness", "Swelling", "Burning or itching sensation", "Eye irritation or watering", "None of the above"],
          none: "None of the above",
          note: { label: "Past lift reaction", none: "No problems with past lifts" },
        },
        {
          id: "contacts",
          type: "yesno",
          label: "Do you wear contact lenses?",
          required: true,
          note: { yes: "Wears contact lenses", no: "No contact lenses" },
        },
        {
          id: "eye_conditions",
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
          type: "yesno",
          label: "Have you used any exfoliants or retinoids on your skin in the last 3 days?",
          hint: "This includes retinol, AHAs, BHAs or scrubs.",
          required: true,
          details: { label: "Which ones?" },
          note: { yes: "Exfoliant or retinoid in the last 3 days", no: "No exfoliants or retinoids in the last 3 days" },
        },
        {
          id: "recent_sun",
          type: "yesno",
          label: "Have you been in direct sun or a tanning bed in the last 48 hours?",
          required: true,
          note: { yes: "Sun or tanning bed in the last 48 hours", no: "No sun or tanning bed in the last 48 hours" },
        },
        {
          id: "blood_thinners",
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
        { id: "ack_risks", type: "agree", required: true, label: "I understand that brow and lash services may carry risks, including allergic reactions, irritation or other side effects." },
        { id: "ack_honest", type: "agree", required: true, label: "I agree to give complete and honest answers to the questions above, for a safe and optimal experience." },
        { id: "ack_notify", type: "agree", required: true, label: "I will tell my esthetician right away if I feel any discomfort or have a reaction during or after the treatment." },
        { id: "ack_liability", type: "agree", required: true, label: "My esthetician will take every precaution for my safety, but cannot be held liable for reactions caused by conditions or products I didn't mention." },
        { id: "ack_tint_spot", type: "agree", required: true, label: "A faint dark spot may stay on the skin after tinting, and it fades soon after." },
        { id: "ack_tint_color", type: "agree", required: true, label: "The final color may not exactly match what I expect, as each hair takes dye in its own way." },
        {
          id: "media_consent",
          type: "choice",
          label: "Can Laura photograph your treatment?",
          hint: "Photos may be used for marketing, including social media and the website.",
          required: true,
          options: ["Yes, with my name", "Yes, anonymously", "No"],
        },
        { id: "ack_accurate", type: "agree", required: true, label: "The information I've given is accurate and complete, and I've read and understood the risks of the services I'm booking." },
        { id: "ack_aftercare", type: "agree", required: true, label: "I'll follow the pre- and post-care instructions my esthetician gives me, for the best results." },
        { id: "signature", type: "signature", required: true, label: "Type your full name to sign", hint: "This is your digital signature for everything on this page." },
      ],
    },
  ],
};

export const FORMS = [BROWS_LASHES];

export function formBySlug(slug) {
  return FORMS.find((form) => form.slug === slug) || null;
}
