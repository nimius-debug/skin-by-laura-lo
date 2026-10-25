// The "Outside products" note section: what a client uses from other brands, stores or
// prescriptions. It sits beside the sheet's four sections everywhere a note's sections are used.
import { createD1, schemaMigrations } from "./helpers/d1-sqlite.mjs";
import { handleAdminRequest } from "../src/admin/routes.js";
import { createSessionToken, sessionCookie } from "../src/admin/auth.js";
import { NOTE_FIELDS, OUTSIDE_FIELD, cleanFields, fieldsAsText, noteFields } from "../src/admin/note-fields.js";
import { readInkNote, summaryPrompt } from "../src/admin/claude.js";
import { findFlags, outsideText } from "../src/admin/safety.js";
import { notebookPage, noteEditPage } from "../src/admin/pages/notebook.js";
import { toString } from "../src/html.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

// --- the field itself ------------------------------------------------------------------
check("Outside products sits after Purchase history",
  NOTE_FIELDS, ["Treatment type", "Notes / remarks", "Purchase history", "Outside products", "Possible treatments"]);
check("the field's name is exported", OUTSIDE_FIELD, "Outside products");
check("cleanFields keeps it, in order",
  Object.keys(cleanFields({ "Possible treatments": "peel", "Outside products": " Tretinoin 0.025% ", "Treatment type": "facial", Other: "x" })),
  ["Treatment type", "Outside products", "Possible treatments"]);
check("cleanFields trims it", cleanFields({ "Outside products": "  CeraVe cleanser \n" }), { "Outside products": "CeraVe cleanser" });
check("an old note without it still reads", noteFields({ source: "ipad", fields_json: JSON.stringify({ "Treatment type": "Clear peel" }) }), { "Treatment type": "Clear peel" });
check("the plain-text copy includes it",
  fieldsAsText(cleanFields({ "Purchase history": "toner", "Outside products": "Differin\nCetaphil" })),
  "Purchase history: toner | Outside products: Differin / Cetaphil");

// --- reading the handwriting ------------------------------------------------------------
const realFetch = globalThis.fetch;
{
  let sent = null;
  globalThis.fetch = async (url, init) => {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ fields: { "Outside products": "Tret 0.05% nightly" }, summary: "s", confidence: "high", unclear: [] }) }] }));
  };
  const reading = await readInkNote({ ANTHROPIC_API_KEY: "k" }, [PNG_1X1]);
  check("the prompt names the new heading", sent.system.includes("Outside products"), true);
  check("the prompt explains what goes under it", /other brands/.test(sent.system) && /tretinoin/.test(sent.system), true);
  check("the prompt says older pages lack the heading", /isn't printed on the page, leave that section out/.test(sent.system), true);
  check("the reading keeps the new section", reading.fields, { "Outside products": "Tret 0.05% nightly" });
  globalThis.fetch = realFetch;
}

// --- the client summary -------------------------------------------------------------------
{
  const prompt = summaryPrompt({
    client: { name: "Maya" },
    notes: [{ id: "n1", source: "ipad", note_date: "2026-10-20", summary: "", fields_json: JSON.stringify({ "Treatment type": "Clear peel", "Outside products": "Tretinoin 0.05%" }) }],
    routine: { items: [] },
    history: [],
  });
  check("the summary sees her outside products", prompt.includes("Outside products: Tretinoin 0.05%"), true);
  check("the summary is told how to use them", /"Outside products" section/.test(prompt) && /Don't list them in "products"/.test(prompt), true);
}

// --- the safety check ---------------------------------------------------------------------
{
  const note = (fields, date = "2026-10-20") => ({ id: `n${Math.random()}`, source: "ipad", note_date: date, summary: "", fields_json: JSON.stringify(fields) });
  const acid = { name: "Mandelic 8%", formula: "Water, Mandelic Acid" };

  check("outsideText reads only that section", outsideText(note({ "Notes / remarks": "tret", "Outside products": "Differin" })), "Differin");
  check("outsideText is empty for Square notes", outsideText({ source: "square", summary: "Tretinoin" }), "");

  const flags = findFlags({ notes: [note({ "Outside products": "- Tretinoin 0.05% at night\n- CeraVe cleanser" })], products: [acid] });
  const retinoid = flags.find((flag) => flag.title === "Retinoid used at home");
  check("a retinoid used at home is flagged", Boolean(retinoid), true);
  check("the flag quotes the line and what she bought", retinoid && retinoid.detail.includes("Tretinoin 0.05% at night") && retinoid.detail.includes("Mandelic 8% (an exfoliating acid)"), true);

  const accutane = findFlags({ notes: [note({ "Outside products": "Accutane (derm) started Sept" })], products: [] });
  check("Accutane in outside products is flagged as Accutane", accutane.map((flag) => flag.title).includes("Past Accutane noted"), true);
  check("…and not also as a home retinoid", accutane.map((flag) => flag.title).includes("Retinoid used at home"), false);

  const sensitive = findFlags({ notes: [note({ "Outside products": "Cetaphil sensitive skin cleanser\nAllergy-free SPF" })], products: [acid] });
  check("a product name like 'sensitive' or 'allergy' isn't a concern", sensitive, []);

  const negated = findFlags({ notes: [note({ "Outside products": "no tretinoin anymore" })], products: [] });
  check("a stopped retinoid isn't flagged", negated.map((flag) => flag.title).includes("Retinoid used at home"), false);
}

// --- the dashboard -------------------------------------------------------------------------
{
  const client = { id: "client_maya", name: "Maya Reyes" };
  const page = notebookPage({ client, lastNote: null, editing: null });
  check("the iPad review form has the section", page.includes('data-field="Outside products"'), true);
  const form = toString(noteEditPage({ client, note: { id: "note_1", note_date: "2026-10-20", ink_key: "ink/x.json" }, fields: { "Outside products": "Differin" } }));
  check("the dashboard edit form has the section, filled in", form.includes('name="Outside products"') && form.includes(">Differin</textarea>"), true);
}

{
  const env = { ADMIN_USERNAME: "laura", ADMIN_PASSWORD: "pw" };
  const d1 = createD1({ migrations: schemaMigrations() });
  env.CLIENT_NOTES_DB = d1;
  d1.raw.exec(`INSERT INTO clients (id, name, square_customer_id) VALUES ('client_maya', 'Maya Reyes', 'SQ_MAYA')`);
  d1.raw.exec(`INSERT INTO notes (id, client_id, note_date, summary, extracted_text, source, fields_json, ink_key, pdf_key) VALUES ('note_1', 'client_maya', '2026-10-20', 's', '', 'ipad', '{"Treatment type":"Clear peel"}', 'ink/client_maya/note_1.json', 'notes/client_maya/note_1.pdf')`);
  const cookie = sessionCookie(await createSessionToken(env, Date.now(), {}), {}).split(";")[0];
  const request = (path, init = {}) => {
    const url = new URL(`https://skinbylauralo.com${path}`);
    return handleAdminRequest(new Request(url, { ...init, headers: { cookie, ...(init.headers || {}) } }), env, url);
  };

  const body = new URLSearchParams({ date: "2026-10-20", "Treatment type": "Clear peel", "Outside products": "Differin nightly\nCeraVe" });
  const saved = await request("/admin/notes/note_1/edit", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
  check("saving the edit form redirects to the client", [saved.status, saved.headers.get("location")], [303, "/admin/clients/client_maya"]);
  const row = d1.raw.prepare("SELECT fields_json, summary FROM notes WHERE id = 'note_1'").get();
  check("the edit form saves outside products", JSON.parse(row.fields_json), { "Treatment type": "Clear peel", "Outside products": "Differin nightly\nCeraVe" });

  const profile = await (await request("/admin/clients/client_maya")).text();
  check("the client page shows the section", profile.includes("Outside products") && profile.includes("Differin nightly"), true);
}

if (failures) {
  console.log(`\n${failures} outside-products test(s) failed.`);
  process.exit(1);
}
console.log("\nAll outside-products tests passed.");
