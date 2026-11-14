import { createD1, schemaMigrations } from "./helpers/d1-sqlite.mjs";
import { FORMS, formBySlug } from "../src/forms/definitions.js";
import { readSubmission, noteFromSubmission, describeSubmission, visibleSteps } from "../src/forms/engine.js";
import { parseCsv, readGoogleResponses, googleTimestamp } from "../src/forms/google-import.js";
import { formPage } from "../src/pages/forms.js";
import { toString } from "../src/html.js";
import * as forms from "../src/admin/forms.js";
import { findFlags } from "../src/admin/safety.js";
import { summaryPrompt } from "../src/admin/claude.js";
import { handleAdminRequest } from "../src/admin/routes.js";
import { createSessionToken, sessionCookie } from "../src/admin/auth.js";
import worker from "../src/index.js";
import { page } from "../src/layout.js";
import { settings } from "../src/config.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const form = formBySlug("brows-lashes");

// Every consent tick, as a client who agreed to everything would send it.
const consent = Object.fromEntries(
  form.steps.find((step) => step.id === "consent").questions.filter((q) => q.type === "agree").map((q) => [q.id, "yes"]),
);
const base = {
  full_name: "Maya Lopez", email: "Maya@Example.com", phone: "(813) 555-0142", date_of_birth: "1994-05-02",
  services: ["Brow lamination/lift"], skincare_actives: ["None of the above"],
  allergies: "No", prescriptions: "No", pregnant: "No", autoimmune: "No",
  lift_before: "Yes", lift_reactions: ["Redness"], contacts: "No", eye_conditions: "No",
  media_consent: "Yes, anonymously", signature: "Maya Lopez", ...consent,
};
const toFormData = (object) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(object)) {
    for (const item of [].concat(value)) data.append(key, item);
  }
  return data;
};

// --- definitions ----------------------------------------------------------------
{
  const ids = FORMS.flatMap((f) => f.steps.flatMap((step) => step.questions.map((q) => `${f.slug}:${q.id}`)));
  check("every question id is unique within its form", ids.length, new Set(ids).size);
  check("every form has a slug safe for a URL", FORMS.every((f) => /^[a-z0-9-]+$/.test(f.slug)), true);
  const showIfOk = FORMS.every((f) => f.steps.every((step) => !step.showIf
    || f.steps.some((other) => other.questions.some((q) => q.id === step.showIf.question && step.showIf.anyOf.every((o) => q.options.includes(o))))));
  check("every conditional step points at real options", showIfOk, true);
}

// --- reading a submission -------------------------------------------------------
{
  const { answers, errors } = readSubmission(form, toFormData(base));
  check("a complete form has no problems", errors, {});
  check("only the steps for her services apply", visibleSteps(form, answers).map((s) => s.id), ["about", "goals", "history", "lift", "consent"]);
  check("answers to steps she isn't booking are dropped", "dye_before" in answers || "recent_sun" in answers, false);
  check("a yes/no answer keeps its details only after Yes",
    readSubmission(form, toFormData({ ...base, allergies: "No", allergies__details: "latex" })).answers.allergies, { answer: "No" });
  check("details after Yes are kept",
    readSubmission(form, toFormData({ ...base, allergies: "Yes", allergies__details: "  latex \r\n and lanolin " })).answers.allergies, { answer: "Yes", details: "latex \n and lanolin" });
  check("options that aren't on the form are ignored", readSubmission(form, toFormData({ ...base, services: ["Brow lamination/lift", "<script>"] })).answers.services, ["Brow lamination/lift"]);
  check("'None of the above' with a real pick keeps the real pick",
    readSubmission(form, toFormData({ ...base, skincare_actives: ["None of the above", "Exfoliating Acids (AHAs, BHAs)"] })).answers.skincare_actives, ["Exfoliating Acids (AHAs, BHAs)"]);

  const missing = readSubmission(form, toFormData({ ...base, email: "not-an-email", signature: "", ack_risks: undefined, services: [], date_of_birth: "2999-01-01" })).errors;
  check("missing and wrong answers are each named",
    Object.keys(missing).sort(), ["ack_risks", "date_of_birth", "email", "services", "signature"]);

  const tinting = readSubmission(form, toFormData({ ...base, services: ["Tinting (Brows or Lashes)"] }));
  check("a step that applies has its required questions checked", Object.keys(tinting.errors).sort(), ["dye_before", "dye_reaction"]);
}

// --- the note the insight reads --------------------------------------------------
{
  const { answers } = readSubmission(form, toFormData({
    ...base, services: ["Brow lamination/lift", "Waxing"], skincare_actives: ["Accutane or other oral acne medications"],
    allergies: "Yes", allergies__details: "lanolin", conditions: ["Eczema"],
    recent_exfoliation: "No", recent_sun: "No", blood_thinners: "No",
  }));
  const note = noteFromSubmission(form, answers);
  check("the note starts with the form's name and lists her answers", note.split("\n").slice(0, 4),
    ["Brow + Lashes Intake Form:", "- Booked for: Brow lamination/lift, Waxing", "- Currently using: Accutane or other oral acne medications", "- Allergies: lanolin"]);
  check("contact details and consent wording stay out of her notes",
    [note.includes("Maya@"), note.includes("813"), note.includes("1994"), note.includes("liable")], [false, false, false, false]);

  const flags = findFlags({ notes: [{ id: "n1", source: "form", note_date: "2026-10-23", summary: note, extracted_text: note }], products: [{ name: "Lanolin Balm", formula: "Lanolin, Shea butter" }] });
  check("the safety check reads a form's allergy against what she bought", flags.some((flag) => flag.detail.includes("anolin")), true);
  check("…and her Accutane", flags.some((flag) => /accutane/i.test(`${flag.title} ${flag.detail}`)), true);

  const clean = noteFromSubmission(form, readSubmission(form, toFormData(base)).answers);
  const cleanFlags = findFlags({ notes: [{ id: "n2", source: "form", note_date: "2026-10-23", summary: clean, extracted_text: clean }], products: [{ name: "Retinol Night", formula: "Retinol, Squalane" }] });
  check("'No known allergies' and 'Not pregnant' are not read as concerns", cleanFlags.filter((flag) => /allerg|pregnan/i.test(flag.title)).length, 0);

  const prompt = summaryPrompt({ client: { name: "Maya" }, notes: [{ id: "n3", source: "form", note_date: "2026-10-23", summary: note }], routine: null });
  check("the insight prompt includes the form", prompt.includes("- 2026-10-23: Brow + Lashes Intake Form:") && prompt.includes("Allergies: lanolin"), true);

  const display = describeSubmission(form, answers);
  check("the admin view shows only the steps that applied, in order", display.map((s) => s.title),
    ["About you", "Your appointment", "Skin & health history", "Lamination & lash lift", "Brow waxing", "Consent & signature"]);
}

// --- the public page --------------------------------------------------------------
{
  const markup = toString(formPage({ form }));
  check("the form posts to its own address", markup.includes('action="/forms/brows-lashes"'), true);
  check("conditional steps carry their rule for the step-by-step script", markup.includes('data-show-if="{&quot;question&quot;:&quot;services&quot;'), true);
  check("there is a hidden trap field for bots", markup.includes('name="website"'), true);
  const back = toString(formPage({ form, answers: { full_name: '"><b>x' }, errors: { email: "That email doesn't look right." } }));
  check("a sent-back form keeps her answers, escaped, and shows the problem", [back.includes("&quot;&gt;&lt;b&gt;x"), back.includes("That email doesn&#39;t look right."), back.includes('role="alert"')], [true, true, true]);
  const shell = page({ body: "", cfg: settings({}), current: "/forms" });
  check("the site header has a Forms menu listing each form", shell.includes("<summary>Forms</summary>") && shell.includes('href="/forms/brows-lashes"'), true);
}

// --- sending a form, end to end ----------------------------------------------------
const d1 = createD1({ migrations: schemaMigrations() });
const env = { CLIENT_NOTES_DB: d1, ADMIN_USERNAME: "laura", ADMIN_PASSWORD: "pw-for-tests", SITE_URL: "https://skinbylauralo.com" };
d1.raw.exec(`INSERT INTO clients (id, name, square_customer_id) VALUES ('client_maya', 'Maya Lopez', 'SQ_MAYA'), ('client_ana', 'Ana Ruiz', 'SQ_ANA')`);

const post = (slug, fields) => worker.fetch(new Request(`https://x.test/forms/${slug}`, { method: "POST", body: toFormData(fields) }), env);
{
  const page404 = await worker.fetch(new Request("https://x.test/forms/nope"), env);
  check("an unknown form is not found", page404.status, 404);
  const pageRes = await worker.fetch(new Request("https://x.test/forms/brows-lashes"), env);
  check("the form page is public", [pageRes.status, (await pageRes.text()).includes("Brow + Lashes Intake Form")], [200, true]);

  const bad = await post("brows-lashes", { ...base, email: "" });
  check("a form with a problem comes back with it, and nothing is saved",
    [bad.status, (await bad.text()).includes("Please fill this in."), (await d1.prepare("SELECT COUNT(*) AS n FROM form_submissions").first()).n], [422, true, 0]);

  const bot = await post("brows-lashes", { ...base, website: "http://spam" });
  check("a bot that fills the trap field gets the thank-you page, and nothing is saved",
    [bot.status, bot.headers.get("location"), (await d1.prepare("SELECT COUNT(*) AS n FROM form_submissions").first()).n], [303, "/forms/brows-lashes/thanks", 0]);

  const fast = await post("brows-lashes", { ...base, started: String(Date.now() - 500) });
  check("a form sent half a second after opening is treated as a bot", (await d1.prepare("SELECT COUNT(*) AS n FROM form_submissions").first()).n, 0);

  const ok = await post("brows-lashes", { ...base, started: String(Date.now() - 60000) });
  check("a good form is saved and thanks her by first name only", [ok.status, ok.headers.get("location")], [303, "/forms/brows-lashes/thanks?name=Maya"]);
  const row = await d1.prepare("SELECT * FROM form_submissions").first();
  check("without Square it is kept, waiting for a client", [row.name, row.email, row.client_id, row.status], ["Maya Lopez", "maya@example.com", null, "new"]);
}

// --- linking to a client -----------------------------------------------------------
{
  const row = await d1.prepare("SELECT id FROM form_submissions").first();
  check("same-name clients are offered first", (await forms.clientsNamed(env, "  maya   lopez ")).map((c) => c.id), ["client_maya"]);

  await forms.linkSubmission(env, row.id, "client_maya", "manual");
  const note = await d1.prepare("SELECT client_id, source, summary FROM notes WHERE source_submission_id = ?").bind(row.id).first();
  check("linking writes the form into her notes", [note.client_id, note.source, note.summary.startsWith("Brow + Lashes Intake Form:")], ["client_maya", "form", true]);

  await forms.linkSubmission(env, row.id, "client_ana", "manual");
  const moved = (await d1.prepare("SELECT client_id FROM notes WHERE source_submission_id = ?").bind(row.id).all()).results;
  check("relinking moves the note rather than copying it", moved, [{ client_id: "client_ana" }]);

  await forms.unlinkSubmission(env, row.id);
  check("unlinking takes it out of her notes",
    [(await d1.prepare("SELECT COUNT(*) AS n FROM notes WHERE source_submission_id = ?").bind(row.id).first()).n, (await forms.getSubmission(env, row.id)).client_id], [0, null]);

  check("linking to a client who doesn't exist does nothing", await forms.linkSubmission(env, row.id, "client_nobody", "manual"), false);

  // Matched to a Square customer who wasn't a client yet: the next sync links it.
  d1.raw.exec(`UPDATE form_submissions SET square_customer_id = 'SQ_NEW' WHERE id = '${row.id}'`);
  check("nothing links while her Square customer isn't a client", await forms.linkWaitingSubmissions(env), 0);
  d1.raw.exec(`INSERT INTO clients (id, name, square_customer_id) VALUES ('client_new', 'Maya L', 'SQ_NEW')`);
  check("once a sync adds her, the waiting form links", [await forms.linkWaitingSubmissions(env), (await forms.getSubmission(env, row.id)).link_method], [1, "sync"]);
}

// --- matching by Square ------------------------------------------------------------
{
  check("US phone numbers are written the way Square stores them", ["(813) 555-0142", "1-813-555-0142", "+44 20 7946 0958", "555-0142"].map(forms.e164),
    ["+18135550142", "+18135550142", "+442079460958", ""]);

  const realFetch = globalThis.fetch;
  const searches = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    searches.push(body.query.filter);
    const customers = body.query.filter.phone_number ? [{ id: "SQ_MAYA" }] : [];
    return new Response(JSON.stringify({ customers }), { status: 200 });
  };
  const squareEnv = { ...env, SQUARE_ACCESS_TOKEN: "t", SQUARE_LOCATION_ID: "L1" };
  const { answers } = readSubmission(form, toFormData(base));
  const saved = await forms.saveSubmission(squareEnv, form, answers);
  globalThis.fetch = realFetch;
  check("Square is searched by email, then by phone", searches, [{ email_address: { exact: "maya@example.com" } }, { phone_number: { exact: "+18135550142" } }]);
  check("a match to an existing client links straight away", [saved.clientId, (await forms.getSubmission(env, saved.id)).link_method], ["client_maya", "square"]);

  globalThis.fetch = async () => { throw new Error("network down"); };
  const offline = await forms.saveSubmission(squareEnv, form, answers);
  globalThis.fetch = realFetch;
  check("the form is still saved when Square can't be reached", [Boolean(await forms.getSubmission(env, offline.id)), offline.clientId], [true, null]);
}

// --- the admin pages -----------------------------------------------------------------
{
  const cookie = sessionCookie(await createSessionToken(env, Date.now(), {}), {}).split(";")[0];
  const get = (path, init = {}) => handleAdminRequest(new Request(`https://x.test${path}`, { ...init, headers: { cookie } }), env, new URL(`https://x.test${path}`));

  const home = await (await get("/admin/forms")).text();
  check("the Forms tab lists each form with its public link", home.includes("Brow + Lashes Intake Form") && home.includes("https://skinbylauralo.com/forms/brows-lashes"), true);
  check("the admin menu has Forms with a link per form", home.includes('href="/admin/forms"') && home.includes('class="nav-sub" href="/admin/forms/brows-lashes"'), true);

  const list = await (await get("/admin/forms/brows-lashes")).text();
  check("the form's page lists its submissions", (list.match(/data-client-href="\/admin\/forms\/submissions\//g) || []).length, 3);

  const { id } = await d1.prepare("SELECT id FROM form_submissions WHERE client_id IS NULL LIMIT 1").first();
  const detail = await (await get(`/admin/forms/submissions/${id}`)).text();
  check("a submission shows her answers and a client picker", [detail.includes("Lamination &amp; lash lift"), detail.includes('name="client_id"'), detail.includes('<optgroup label="Same name">')], [true, true, true]);
  check("opening it marks it as seen", (await forms.getSubmission(env, id)).status, "reviewed");

  const linked = await get(`/admin/forms/submissions/${id}/link`, { method: "POST", body: toFormData({ client_id: "client_maya" }) });
  check("picking a client links it and returns to the submission", [linked.status, linked.headers.get("location"), (await forms.getSubmission(env, id)).client_id], [303, `/admin/forms/submissions/${id}`, "client_maya"]);

  const profile = await (await get("/admin/clients/client_maya")).text();
  check("her client page lists the form and shows it in her notes", [profile.includes("From an intake form"), profile.includes(`href="/admin/forms/submissions/${id}"`)], [true, true]);

  const unauth = await handleAdminRequest(new Request("https://x.test/admin/forms"), env, new URL("https://x.test/admin/forms"));
  check("the submissions need the admin login", unauth.status, 303);
}

// --- importing old Google Forms responses ---------------------------------------------
{
  // Headers as Google Forms exports them for the original Brow + Lashes form (titles can hold line breaks).
  const headers = [
    "Timestamp", "Full Name", "Email", "Phone number", "Date of birth", "Address",
    "What are your main goals for this appointment? (Check all that apply)",
    "Are you currently using any of the following skincare products?\n(Check all that apply)",
    "Do you have any known allergies?",
    "Are you using any medications or creams prescribed by a dermatologist on or near the area to be treated?",
    "Do you currently have or have you ever had any of the following conditions? (Check all that apply)",
    "Are you pregnant?", "Do you have any autoimmune disorders that could impact healing or increase sensitivity?",
    "Have you used any hair or skin dye products before?", "Have you ever experienced a reaction to hair or skin dye?",
    "Have you had a lamination or lash lift service before?",
    "Have you experienced any of the following during a previous lamination/lash lift treatment?",
    "Do you wear eye contacts?", "Do you have any eye conditions, such as dry eye, conjunctivitis, or recent eye surgery?",
    "Have you used any exfoliants or retinoids on your skin in the last 3 days?\n(This includes retinol, AHAs, BHAs, or scrubs)",
    "Have you been exposed to direct sun or tanning beds in the last 48 hours?",
    "Are you currently taking any blood thinners or medications that may impact skin sensitivity?",
    "While every precaution will be implemented to guarantee your safety, please acknowledge these potential risks and sign below:\n_____I understand...",
    "Do you consent to being photographed during or after your treatment?\n(Photos may be used for marketing purposes, including social media and website content.)",
    "Please type your full name if you agree to the terms above.",
    "____By submitting this form, I confirm that the information provided is accurate and complete.",
  ];
  const quote = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
  const line = (cells) => cells.map(quote).join(",");
  const maya = ["3/9/2025 14:05:09", "Maya Lopez", "Maya@Example.com", "(813) 555-0142", "5/2/1994", "",
    "Brow lamination/lift, Tinting (Brows or Lashes)", "Retinoids (e.g., Retin-A, Tretinoin), Exfoliating Acids (AHAs, BHAs)",
    'Yes, please specify in "other", Lanolin', "No", "Eczema, rosacea", "No", "No", "Yes", "No", "No", "", "Yes", "No",
    "Yes", "No", "No", "ML", "Yes, anonymously", "Maya Lopez", "Maya Lopez"];
  const ana = ["11/14/2025 9:30:00", "Ana Ruiz", "", "", "", "", "Waxing", "None of the above", "No", "No", "", "No", "No",
    "", "", "", "", "", "", "None", "No", "No", "AR", "No", "", "Ana Ruiz"];
  const stranger = ["1/2/2025 10:00:00", "Nobody Known", "nobody@example.com", "", "", "", "Waxing", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
  const csv = "﻿" + [headers, maya, ana, stranger].map(line).join("\r\n") + "\r\n";

  check("CSV fields keep their commas, quotes and line breaks", parseCsv('a,"b, ""c""\nd"\r\n1,2\r\n')[0], ["a", 'b, "c"\nd']);
  check("Google's timestamps are Tampa time, summer and winter", [googleTimestamp("7/4/2025 12:00:00"), googleTimestamp("1/4/2025 12:00:00"), googleTimestamp("junk")],
    ["2025-07-04 16:00:00", "2025-01-04 17:00:00", null]);

  const read = readGoogleResponses(form, csv);
  check("every question finds its Google Forms column", [read.error, read.missing], ["", []]);
  const m = read.rows[0].answers;
  check("choices are read whole, even ones with commas in them", m.skincare_actives, ["Retinoids (e.g., Retin-A, Tretinoin)", "Exfoliating Acids (AHAs, BHAs)"]);
  check("'Yes, please specify in other' plus what she typed becomes Yes with details", m.allergies, { answer: "Yes", details: "Lanolin" });
  check("an Other answer to a checklist is kept", m.conditions, ["Eczema", "rosacea"]);
  check("dates and emails are tidied", [m.date_of_birth, m.email], ["1994-05-02", "maya@example.com"]);
  check("a typed name on the consent lines counts as agreeing, and signs it", [m.ack_risks, m.ack_aftercare, m.signature], [true, true, "Maya Lopez"]);
  check("columns no question reads are kept, not lost", read.rows[0].extra, [{ label: "Please type your full name if you agree to the terms above.", value: "Maya Lopez" }]);
  check("'None' reads as No", read.rows[1].answers.recent_exfoliation, { answer: "No" });
  check("a file from another form is refused", readGoogleResponses(form, "Timestamp,Favourite colour\n1/1/2025 1:00:00,blue").error.startsWith("None of the columns"), true);
  check("a file that isn't a Google Forms export is refused", readGoogleResponses(form, "Name,Email\nA,b").error.includes("Timestamp"), true);

  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ customers: [{ id: "SQ_MAYA", email_address: "maya@example.com" }] }), { status: 200 });
  const squareEnv = { ...env, SQUARE_ACCESS_TOKEN: "t", SQUARE_LOCATION_ID: "L1" };
  const preview = await forms.previewImport(squareEnv, form, csv);
  check("each response is matched: Square email, then name, else none", preview.rows.map((row) => [row.match.clientId, row.match.how]),
    [["client_maya", "email"], ["client_ana", "name"], [null, "none"]]);

  const before = (await d1.prepare("SELECT COUNT(*) AS n FROM form_submissions").first()).n;
  const result = await forms.runImport(squareEnv, form, preview);
  check("the import adds every response and links the matched ones", result, { added: 3, linked: 2 });
  const row = await d1.prepare("SELECT * FROM form_submissions WHERE import_key IS NOT NULL AND name = 'Maya Lopez'").first();
  check("an imported response keeps its original date and isn't shown as new", [row.submitted_at, row.status, row.link_method], ["2025-03-09 18:05:09", "reviewed", "square"]);
  const note = await d1.prepare("SELECT note_date, summary FROM notes WHERE source_submission_id = ?").bind(row.id).first();
  check("it goes into her notes, dated when she sent it", [note.note_date, note.summary.includes("Allergies: Lanolin"), note.summary.includes("Currently using: Retinoids")], ["2025-03-09", true, true]);
  const anaNote = await d1.prepare("SELECT n.summary FROM notes n JOIN form_submissions s ON s.id = n.source_submission_id WHERE s.name = 'Ana Ruiz' AND s.import_key IS NOT NULL").first();
  check("steps she answered are kept even if the service doesn't match", anaNote.summary.includes("No exfoliants or retinoids in the last 3 days"), true);
  const display = JSON.parse(row.display_json);
  check("the extra Google column shows on the submission", display.at(-1).title, "Other answers from Google Forms");

  const again = await forms.previewImport(squareEnv, form, csv);
  check("importing the same file again finds nothing new", [again.rows.every((r) => r.alreadyImported), (await forms.runImport(squareEnv, form, again)).added], [true, 0]);
  check("nothing was added twice", (await d1.prepare("SELECT COUNT(*) AS n FROM form_submissions").first()).n, before + 3);
  globalThis.fetch = realFetch;

  // The admin pages: upload, preview, confirm.
  const cookie = sessionCookie(await createSessionToken(env, Date.now(), {}), {}).split(";")[0];
  const call = (path, init = {}) => handleAdminRequest(new Request(`https://x.test${path}`, { ...init, headers: { cookie } }), env, new URL(`https://x.test${path}`));
  const upload = await (await call("/admin/forms/brows-lashes/import")).text();
  check("the import page asks for the responses file", upload.includes('type="file" name="file"') && upload.includes("Download responses (.csv)"), true);
  const listPage = await (await call("/admin/forms/brows-lashes")).text();
  check("the form's page links to the import", listPage.includes('href="/admin/forms/brows-lashes/import"'), true);
  const body = new FormData();
  body.append("file", new File([csv], "responses.csv", { type: "text/csv" }));
  const previewPage = await (await call("/admin/forms/brows-lashes/import", { method: "POST", body })).text();
  check("uploading shows the preview; without Square here it says names only", [previewPage.includes("Already imported"), previewPage.includes("matched by name only")], [true, true]);
}

console.log(failures === 0 ? "\nAll client-forms tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
