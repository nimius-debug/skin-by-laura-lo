// Notes handwritten on the iPad: the writing screen, reading the handwriting, saving to the
// dashboard, and the note showing up everywhere a sheet note does.
import { createD1, schemaMigrations } from "./helpers/d1-sqlite.mjs";
import { handleAdminRequest, safeNext } from "../src/admin/routes.js";
import { createSessionToken, sessionCookie } from "../src/admin/auth.js";
import { noteFields, cleanFields, fieldsAsText } from "../src/admin/note-fields.js";
import { planInkReading, readInkNote, summaryPrompt } from "../src/admin/claude.js";
import { noteText } from "../src/admin/safety.js";
import { NOTEBOOK_JS } from "../src/admin/notebook-client.js";
import { APP_HEAD } from "../src/admin/pwa.js";
import { iconBytes } from "../src/admin/icons.js";
import worker from "../src/index.js";
import { salonDay, appointmentRows, todaysAppointments } from "../src/admin/today.js";
import { deleteStaleDrafts } from "../src/admin/db.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

function fakeBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, value) { objects.set(key, typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value)); },
    async get(key) {
      const bytes = objects.get(key);
      if (!bytes) return null;
      return { body: bytes, async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); }, async text() { return new TextDecoder().decode(bytes); } };
    },
    async delete(keys) { for (const key of [].concat(keys)) objects.delete(key); },
  };
}

// --- the note's sections -------------------------------------------------------------
{
  const ipad = { id: "note_1", source: "ipad", fields_json: JSON.stringify({ "Treatment type": "Clear peel", "Notes / remarks": "allergic to lavender" }) };
  check("an iPad note's sections come from its own row", noteFields(ipad), { "Treatment type": "Clear peel", "Notes / remarks": "allergic to lavender" });
  check("Square and form notes have no sections", [noteFields({ source: "square" }), noteFields({ source: "form" })], [null, null]);
  check("a broken row has no sections rather than throwing", noteFields({ source: "ipad", fields_json: "{oops" }), null);
  check("only the four known sections are kept, trimmed", cleanFields({ "Treatment type": "  x  ", Other: "y", "Purchase history": "" }), { "Treatment type": "x" });
  check("sections read as one line each", fieldsAsText({ "Treatment type": "a\nb", "Notes / remarks": "c" }), "Treatment type: a / b | Notes / remarks: c");
  check("the safety check reads an iPad note's remarks", noteText(ipad), "allergic to lavender");
  check("the AI insight reads an iPad note's sections", summaryPrompt({ client: { name: "Maya" }, notes: [{ ...ipad, note_date: "2026-10-23" }] }).includes("- 2026-10-23: Treatment type: Clear peel | Notes / remarks: allergic to lavender"), true);
}

// --- reading Claude's reply ----------------------------------------------------------
{
  const good = planInkReading(JSON.stringify({ fields: { "Treatment type": "Enzyme facial", Junk: "x" }, summary: "Calmer skin.", confidence: "high", unclear: ["3x or 2x?", 4] }));
  check("a good reading keeps the known sections, summary and questions", good, { fields: { "Treatment type": "Enzyme facial" }, summary: "Calmer skin.", confidence: "high", unclear: ["3x or 2x?"] });
  const fenced = planInkReading("Here you go:\n```json\n{\"fields\":{\"Notes / remarks\":\"ok\"},\"confidence\":\"medium\"}\n```");
  check("a fenced reply is read, and an unknown confidence counts as low", [fenced.fields, fenced.confidence], [{ "Notes / remarks": "ok" }, "low"]);
  const junk = planInkReading("sorry, I can't");
  check("a reply that isn't JSON leaves the sections empty and asks her to type them", [junk.fields, junk.confidence, junk.unclear.length], [{}, "low", 1]);
}

// --- the writing screen and saving, end to end --------------------------------------------
const d1 = createD1({ migrations: schemaMigrations() });
const bucket = fakeBucket();
const env = { CLIENT_NOTES_DB: d1, NOTES_BUCKET: bucket, ADMIN_USERNAME: "laura", ADMIN_PASSWORD: "pw-for-tests", ANTHROPIC_API_KEY: "test-key" };
d1.raw.exec(`INSERT INTO clients (id, name, square_customer_id) VALUES ('client_maya', 'Maya Reyes', 'SQ_MAYA')`);
d1.raw.exec(`INSERT INTO notes (id, client_id, note_date, summary, extracted_text, source) VALUES ('note_old', 'client_maya', '2026-09-30', 'Clear peel, purging on chin.', '', 'square')`);

const cookie = sessionCookie(await createSessionToken(env, Date.now(), {}), {}).split(";")[0];
const call = (path, init = {}) => handleAdminRequest(new Request(`https://x.test${path}`, { ...init, headers: { cookie, ...(init.headers || {}) } }), env, new URL(`https://x.test${path}`));

function inkForm({ pages = [PNG_1X1], strokes = JSON.stringify({ v: 1, pages: [[{ tool: "pen", color: "#2B3A55", points: [[10, 10, 0.5]] }]] }) } = {}) {
  const form = new FormData();
  pages.forEach((bytes, i) => form.append("page", new Blob([bytes], { type: "image/png" }), `page-${i + 1}.png`));
  form.append("strokes", strokes);
  form.append("date", "2026-10-23");
  return form;
}

const realFetch = globalThis.fetch;
let claudeCalls = 0;
function claudeReplies(text) {
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("https://api.anthropic.com/")) {
      claudeCalls += 1;
      return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

{
  const page = await call("/admin/clients/client_maya/write");
  const body = await page.text();
  check("the writing screen opens for a client", [page.status, body.includes('data-client-name="Maya Reyes"'), body.includes("/admin/assets/notebook.js?v=")], [200, true, true]);
  check("it shows her last visit while writing", body.includes("Clear peel, purging on chin."), true);
  check("it has the four sections to check before saving", ["Treatment type", "Notes / remarks", "Purchase history", "Possible treatments"].every((name) => body.includes(`data-field="${name}"`)), true);
  check("an unknown client has no writing screen", (await call("/admin/clients/nobody/write")).status, 404);

  const script = await call("/admin/assets/notebook.js");
  check("the writing script is served and cached", [script.status, script.headers.get("cache-control").includes("immutable")], [200, true]);
  check("the writing script is valid JavaScript", (() => { try { new Function(NOTEBOOK_JS); return true; } catch { return false; } })(), true);

  const signedOut = await handleAdminRequest(new Request("https://x.test/admin/clients/client_maya/ink", { method: "POST", body: inkForm() }), env, new URL("https://x.test/admin/clients/client_maya/ink"));
  check("sending a note needs the login", signedOut.status, 401);
}

{
  claudeReplies(JSON.stringify({ fields: { "Treatment type": "Acne bootcamp facial", "Notes / remarks": "much calmer\nallergic to lavender" }, summary: "Calmer skin, lavender allergy.", confidence: "low", unclear: ["Was it 3x week?"] }));
  const read = await call("/admin/clients/client_maya/ink", { method: "POST", body: inkForm() });
  const draft = await read.json();
  check("Done reads the handwriting into its sections", [read.status, draft.readFailed, draft.reading.fields["Treatment type"], draft.reading.unclear], [200, false, "Acne bootcamp facial", ["Was it 3x week?"]]);
  check("the page and pen strokes wait as a draft", [...bucket.objects.keys()].filter((key) => key.startsWith(`drafts/${draft.draftId}/`)).length, 2);

  const save = await call(`/admin/clients/client_maya/ink/${draft.draftId}/save`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ date: "2026-10-23", fields: draft.reading.fields }),
  });
  const saved = await save.json();
  check("Save to dashboard saves it and goes back to her page", [save.status, saved.redirect], [200, "/admin/clients/client_maya"]);
  const row = await d1.prepare("SELECT * FROM notes WHERE id = ?").bind(saved.noteId).first();
  check("the note is saved From iPad with her sections, date and Claude's summary", [row.source, row.note_date, JSON.parse(row.fields_json)["Notes / remarks"], row.summary, row.confidence], ["ipad", "2026-10-23", "much calmer\nallergic to lavender", "Calmer skin, lavender allergy.", "high"]);
  check("the handwriting and strokes move to the note's own keys", [bucket.objects.has(row.pdf_key), bucket.objects.has(row.ink_key), [...bucket.objects.keys()].some((key) => key.startsWith(`drafts/${draft.draftId}/`))], [true, true, false]);
  check("the stored handwriting is a PDF", new TextDecoder().decode(bucket.objects.get(row.pdf_key).slice(0, 5)), "%PDF-");

  const again = await call(`/admin/clients/client_maya/ink/${draft.draftId}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  check("the same draft can't be saved twice", again.status, 404);

  const profile = await (await call("/admin/clients/client_maya")).text();
  check("her page shows the note From iPad, with its sections and handwriting", [profile.includes("From iPad"), profile.includes("much calmer\nallergic to lavender"), profile.includes(`/admin/notes/${row.id}/original`), profile.includes("View handwriting")], [true, true, true, true]);
  check("her page has a Write a note button", profile.includes('href="/admin/clients/client_maya/write"'), true);
  check("the safety check flags the allergy written on the iPad", profile.includes("flag-item"), true);

  const original = await call(`/admin/notes/${row.id}/original`);
  check("View handwriting opens the page as she wrote it", [original.status, original.headers.get("content-type")], [200, "application/pdf"]);
}

{
  claudeReplies(JSON.stringify({ fields: { "Treatment type": "Dermaplane" }, summary: "Dermaplane.", confidence: "high", unclear: [] }));
  const draft = await (await call("/admin/clients/client_maya/ink", { method: "POST", body: inkForm({ pages: [PNG_1X1, PNG_1X1] }) })).json();
  const saved = await (await call(`/admin/clients/client_maya/ink/${draft.draftId}/save`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ date: "not a date", fields: { "Treatment type": "Dermaplane + LED", "Possible treatments": "carboxy" } }),
  })).json();
  const row = await d1.prepare("SELECT * FROM notes WHERE id = ?").bind(saved.noteId).first();
  check("after her edits, her words are the summary", row.summary, "Treatment type: Dermaplane + LED | Possible treatments: carboxy");
  check("a date that isn't a date is saved as undated, never guessed", row.note_date, null);
}

{
  globalThis.fetch = async () => { throw new Error("network down"); };
  const read = await call("/admin/clients/client_maya/ink", { method: "POST", body: inkForm() });
  const draft = await read.json();
  check("when the handwriting can't be read, the draft still comes back to type into", [read.status, draft.readFailed, Boolean(draft.draftId), draft.reading.fields], [200, true, true, {}]);
  const saved = await (await call(`/admin/clients/client_maya/ink/${draft.draftId}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: "2026-10-23", fields: {} }) })).json();
  const row = await d1.prepare("SELECT summary, pdf_key FROM notes WHERE id = ?").bind(saved.noteId).first();
  check("and the handwriting can be saved with nothing typed", [row.summary, Boolean(row.pdf_key)], ["Handwritten note. See the handwriting.", true]);
}

{
  claudeCalls = 0;
  claudeReplies("{}");
  const notPng = await call("/admin/clients/client_maya/ink", { method: "POST", body: inkForm({ pages: [Buffer.from("GIF89a....")] }) });
  const noStrokes = await call("/admin/clients/client_maya/ink", { method: "POST", body: inkForm({ strokes: "nope" }) });
  const tooMany = await call("/admin/clients/client_maya/ink", { method: "POST", body: inkForm({ pages: Array(13).fill(PNG_1X1) }) });
  check("only PNG pages, real strokes and up to 12 pages are taken", [notPng.status, noStrokes.status, tooMany.status], [400, 400, 400]);
  check("nothing is sent to Claude for a bad upload", claudeCalls, 0);
}

// --- Done tapped twice, and drafts nobody saved ------------------------------------------
{
  claudeReplies(JSON.stringify({ fields: { "Treatment type": "First go" }, summary: "", confidence: "high", unclear: [] }));
  const first = await (await call("/admin/clients/client_maya/ink", { method: "POST", body: inkForm() })).json();
  const again = inkForm();
  again.append("replaces", first.draftId);
  const second = await (await call("/admin/clients/client_maya/ink", { method: "POST", body: again })).json();
  const leftovers = [...bucket.objects.keys()].filter((key) => key.startsWith(`drafts/${first.draftId}/`));
  const firstRow = await d1.prepare("SELECT id FROM note_drafts WHERE id = ?").bind(first.draftId).first();
  check("tapping Done again throws the earlier draft away, files and all", [leftovers.length, firstRow, Boolean(second.draftId)], [0, null, true]);

  d1.raw.exec(`UPDATE note_drafts SET created_at = datetime('now', '-2 days') WHERE id = '${second.draftId}'`);
  const cleared = await deleteStaleDrafts(env);
  check("a day-old draft nobody saved is cleared with its files", [cleared, [...bucket.objects.keys()].some((key) => key.startsWith(`drafts/${second.draftId}/`))], [1, false]);
  check("a fresh draft is left alone", await deleteStaleDrafts(env), 0);
}

// --- changing a saved iPad note ----------------------------------------------------------------
{
  claudeReplies(JSON.stringify({ fields: { "Treatment type": "Peel" }, summary: "Peel.", confidence: "high", unclear: [] }));
  const draft = await (await call("/admin/clients/client_maya/ink", { method: "POST", body: inkForm() })).json();
  const { noteId } = await (await call(`/admin/clients/client_maya/ink/${draft.draftId}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: "2026-10-20", fields: draft.reading.fields }) })).json();
  const before = await d1.prepare("SELECT * FROM notes WHERE id = ?").bind(noteId).first();

  const page = await (await call(`/admin/clients/client_maya/write?note=${noteId}`)).text();
  check("a saved iPad note opens again on the writing screen", [page.includes(`data-note-id="${noteId}"`), page.includes('data-note-date="2026-10-20"'), page.includes("Edit note")], [true, true, true]);
  check("someone else's or a missing note doesn't open", [(await call("/admin/clients/client_maya/write?note=note_old")).status, (await call("/admin/clients/client_maya/write?note=nope")).status], [404, 404]);
  const strokes = await (await call(`/admin/notes/${noteId}/ink`)).json();
  check("its pen strokes come back to draw", strokes.pages[0][0].points[0], [10, 10, 0.5]);

  claudeReplies(JSON.stringify({ fields: { "Treatment type": "Peel + LED" }, summary: "Peel and LED.", confidence: "high", unclear: [] }));
  const edit = inkForm({ strokes: JSON.stringify({ v: 1, pages: [[{ tool: "pen", color: "#000", points: [[20, 20, 0.4]] }]] }) });
  edit.append("note", noteId);
  const editDraft = await (await call("/admin/clients/client_maya/ink", { method: "POST", body: edit })).json();
  const saved = await (await call(`/admin/clients/client_maya/ink/${editDraft.draftId}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: "2026-10-21", fields: editDraft.reading.fields }) })).json();
  const after = await d1.prepare("SELECT * FROM notes WHERE id = ?").bind(noteId).first();
  const count = (await d1.prepare("SELECT COUNT(*) AS n FROM notes WHERE client_id = 'client_maya' AND source = 'ipad'").first()).n;
  check("saving the changed note updates it in place", [saved.noteId, after.note_date, JSON.parse(after.fields_json)["Treatment type"], after.summary, after.pdf_key === before.pdf_key, after.ink_key === before.ink_key], [noteId, "2026-10-21", "Peel + LED", "Peel and LED.", true, true]);
  check("the new strokes replace the old ones", JSON.parse(new TextDecoder().decode(bucket.objects.get(after.ink_key))).pages[0][0].points[0], [20, 20, 0.4]);

  const otherNote = inkForm();
  otherNote.append("note", "note_old");
  check("only an iPad note of hers can be changed", (await call("/admin/clients/client_maya/ink", { method: "POST", body: otherNote })).status, 404);

  // The dashboard's edit page, for the typed sections.
  const editPage = await (await call(`/admin/notes/${noteId}/edit`)).text();
  check("the dashboard can edit an iPad note's sections", [editPage.includes('name="Treatment type"'), editPage.includes("Peel + LED"), editPage.includes(`/admin/clients/client_maya/write?note=${noteId}`)], [true, true, true]);
  const form = new URLSearchParams({ date: "2026-10-22", "Treatment type": "Peel + LED 10 min", "Notes / remarks": "calmer", "Purchase history": "", "Possible treatments": "" });
  const posted = await call(`/admin/notes/${noteId}/edit`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
  const edited = await d1.prepare("SELECT * FROM notes WHERE id = ?").bind(noteId).first();
  check("saving the edit goes back to her page with the new words", [posted.status, posted.headers.get("location"), edited.note_date, JSON.parse(edited.fields_json), edited.summary], [303, "/admin/clients/client_maya", "2026-10-22", { "Treatment type": "Peel + LED 10 min", "Notes / remarks": "calmer" }, "Treatment type: Peel + LED 10 min | Notes / remarks: calmer"]);
  check("Square notes have no edit page", (await call("/admin/notes/note_old/edit")).status, 404);
  const profile = await (await call("/admin/clients/client_maya")).text();
  check("her page links to Edit and Edit handwriting on iPad notes", [profile.includes(`/admin/notes/${noteId}/edit`), profile.includes(`write?note=${noteId}`)], [true, true]);

  // Editing the handwriting after a dashboard correction: Claude is shown the saved sections, so her typing is kept.
  let sentBody = null;
  globalThis.fetch = async (url, init) => {
    sentBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ fields: { "Treatment type": "Peel + LED 10 min", "Notes / remarks": "calmer\nless redness" }, summary: "Calmer.", confidence: "high", unclear: [] }) }] }), { status: 200 });
  };
  const again = inkForm();
  again.append("note", noteId);
  await (await call("/admin/clients/client_maya/ink", { method: "POST", body: again })).json();
  const sentText = sentBody.messages[0].content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
  check("changing the handwriting shows Claude the saved sections and asks it to keep them", [sentText.includes("Peel + LED 10 min"), sentText.includes("calmer"), sentBody.system.includes("keep her typed wording")], [true, true, true]);

  globalThis.fetch = async () => new Response("{}", { status: 529 });
  const failing = inkForm();
  failing.append("note", noteId);
  const fallback = await (await call("/admin/clients/client_maya/ink", { method: "POST", body: failing })).json();
  check("if the reading fails while changing a note, the review starts from the saved sections", [fallback.readFailed, fallback.reading.fields], [true, { "Treatment type": "Peel + LED 10 min", "Notes / remarks": "calmer" }]);

  sentBody = null;
  globalThis.fetch = async (url, init) => {
    sentBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ fields: { "Treatment type": "Peel" }, summary: "Peel.", confidence: "high", unclear: [] }) }] }), { status: 200 });
  };
  await call("/admin/clients/client_maya/ink", { method: "POST", body: inkForm() });
  check("a new note's reading isn't given any saved sections", [JSON.stringify(sentBody.messages).includes("currently saved"), sentBody.system.includes("keep her typed wording")], [false, false]);
}
globalThis.fetch = realFetch;

// --- today's appointments --------------------------------------------------------------------
{
  const summer = salonDay(new Date("2026-07-04T03:30:00Z")); // 11:30pm on Jul 3 in Tampa
  check("the salon's day follows Tampa time in summer", summer, { day: "2026-07-03", start: "2026-07-03T04:00:00.000Z", end: "2026-07-04T04:00:00.000Z" });
  const winter = salonDay(new Date("2026-12-10T15:00:00Z"));
  check("and in winter", [winter.start, winter.end], ["2026-12-10T05:00:00.000Z", "2026-12-11T05:00:00.000Z"]);
  const fallBack = salonDay(new Date("2026-11-01T12:00:00Z"));
  check("the day clocks go back is 25 hours long", (Date.parse(fallBack.end) - Date.parse(fallBack.start)) / 3600000, 25);

  const rows = appointmentRows([
    { id: "b2", status: "ACCEPTED", start_at: "2026-10-23T18:00:00Z", customer_id: "SQ_NEW", appointment_segments: [{ service_variation_id: "V2" }] },
    { id: "b1", status: "ACCEPTED", start_at: "2026-10-23T14:00:00Z", customer_id: "SQ_MAYA", appointment_segments: [{ service_variation_id: "V1" }] },
    { id: "b3", status: "CANCELLED_BY_CUSTOMER", start_at: "2026-10-23T15:00:00Z", customer_id: "SQ_MAYA" },
  ], {
    clientsBySquareId: new Map([["SQ_MAYA", { id: "client_maya", name: "Maya Reyes" }]]),
    serviceNames: new Map([["V1", "Acne bootcamp facial"], ["V2", "Brow lamination"]]),
    customerNames: new Map([["SQ_NEW", "Nora Patel"]]),
  });
  check("today's bookings come in time order, cancelled ones left out", rows.map((row) => [row.time, row.name, row.clientId, row.services]), [["10:00 AM", "Maya Reyes", "client_maya", ["Acne bootcamp facial"]], ["2:00 PM", "Nora Patel", null, ["Brow lamination"]]]);

  const marked = appointmentRows([
    { id: "b1", status: "ACCEPTED", start_at: "2026-10-23T14:00:00Z", customer_id: "SQ_MAYA" },
    { id: "b2", status: "ACCEPTED", start_at: "2026-10-23T18:00:00Z", customer_id: "SQ_NEW" },
    { id: "b4", status: "ACCEPTED", start_at: "2026-10-23T20:00:00Z", customer_id: "SQ_NEW" },
  ], {
    clientsBySquareId: new Map([["SQ_MAYA", { id: "client_maya", name: "Maya Reyes" }]]),
    todayNotes: new Map([["client_maya", { id: "note_today", source: "ipad" }]]),
    now: new Date("2026-10-23T16:30:00Z"),
  });
  check("a client with today's note is marked, and only the next appointment is highlighted", marked.map((row) => [row.todayNote?.id || null, row.next]), [["note_today", false], [null, true], [null, false]]);
  check("with every appointment over, none is next", appointmentRows([{ id: "b1", status: "ACCEPTED", start_at: "2026-10-23T14:00:00Z" }], { clientsBySquareId: new Map(), now: new Date("2026-10-23T23:00:00Z") }).map((row) => row.next), [false]);

  const squareEnv = { ...env, SQUARE_ACCESS_TOKEN: "t", SQUARE_LOCATION_ID: "L1" };
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/v2/bookings") return new Response(JSON.stringify({ bookings: [{ id: "b1", status: "ACCEPTED", start_at: new Date().toISOString(), customer_id: "SQ_MAYA", appointment_segments: [{ service_variation_id: "V1" }] }] }));
    if (path === "/v2/catalog/batch-retrieve") return new Response(JSON.stringify({ objects: [{ id: "V1", item_variation_data: { item_id: "I1", name: "Regular" } }], related_objects: [{ id: "I1", type: "ITEM", item_data: { name: "Acne bootcamp facial" } }] }));
    return new Response(JSON.stringify({}), { status: 500 });
  };
  const home = await (await handleAdminRequest(new Request("https://x.test/admin", { headers: { cookie } }), squareEnv, new URL("https://x.test/admin"))).text();
  check("the clients page opens on today's appointments with Write a note", [home.includes("Acne bootcamp facial"), home.includes('href="/admin/clients/client_maya/write"')], [true, true]);
  check("the clients page has a place for unsent notes on this iPad, hidden until there are some", home.includes('id="unsent-notes" aria-labelledby="unsent-heading" hidden'), true);
  d1.raw.exec(`INSERT INTO notes (id, client_id, note_date, summary, extracted_text, source) VALUES ('note_today_ipad', 'client_maya', '${salonDay().day}', 'Today', '', 'ipad')`);
  const homeAfter = await (await handleAdminRequest(new Request("https://x.test/admin", { headers: { cookie } }), squareEnv, new URL("https://x.test/admin"))).text();
  check("once today's note is saved, Today says so with Edit and a way to write another", [homeAfter.includes("Note saved"), /href="\/admin\/notes\/[^"]+\/edit"/.test(homeAfter), homeAfter.includes('href="/admin/clients/client_maya/write"')], [true, true, true]);
  d1.raw.exec(`DELETE FROM notes WHERE id = 'note_today_ipad'`);
  globalThis.fetch = async () => { throw new Error("Square down"); };
  const down = await handleAdminRequest(new Request("https://x.test/admin", { headers: { cookie } }), squareEnv, new URL("https://x.test/admin"));
  check("when Square is down the clients page still opens and says so", [down.status, (await down.text()).includes("Couldn't read today's bookings")], [200, true]);
  globalThis.fetch = (url, init) => new Promise((resolve) => setTimeout(() => resolve(new Response(JSON.stringify({ bookings: [] }))), 2000));
  const started = Date.now();
  const slow = await todaysAppointments(squareEnv, { timeoutMs: 100 });
  check("a slow Square gives up on today's list instead of holding the page", [slow.failed, slow.rows, Date.now() - started < 1000], [true, [], true]);
  globalThis.fetch = realFetch;
}

// --- reading never hangs ------------------------------------------------------------------
{
  globalThis.fetch = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("aborted")));
  });
  const started = Date.now();
  const error = await readInkNote(env, [PNG_1X1], { timeoutMs: 50 }).then(() => null, (failure) => failure);
  check("reading the handwriting gives up instead of waiting forever", [Boolean(error), Date.now() - started < 1000], [true, true]);
  globalThis.fetch = realFetch;
}

// --- back to her note after logging in again -------------------------------------------------
{
  check("login goes back to an admin page she was on", [safeNext("/admin/clients/client_maya/write?note=n1"), safeNext("/admin/notes/n1/edit")], ["/admin/clients/client_maya/write?note=n1", "/admin/notes/n1/edit"]);
  check("but never off the admin", ["https://evil.test/admin/", "//evil.test/admin/", "/admin\\evil", "/admin", "/shop", "/admin/login?next=/admin/x", "/admin/x\nSet-Cookie: a", "", null].map(safeNext), Array(9).fill("/admin"));
  const signedOut = await handleAdminRequest(new Request("https://x.test/admin/clients/client_maya/write?note=n1"), env, new URL("https://x.test/admin/clients/client_maya/write?note=n1"));
  check("a signed-out page sends her to log in, remembering the page", [signedOut.status, signedOut.headers.get("location")], [303, "/admin/login?next=%2Fadmin%2Fclients%2Fclient_maya%2Fwrite%3Fnote%3Dn1"]);
  const loginPage = await (await handleAdminRequest(new Request("https://x.test/admin/login?next=%2Fadmin%2Fclients%2Fclient_maya%2Fwrite"), env, new URL("https://x.test/admin/login?next=%2Fadmin%2Fclients%2Fclient_maya%2Fwrite"))).text();
  check("the login form carries where to go next", loginPage.includes('name="next" value="/admin/clients/client_maya/write"'), true);
  const loginWith = (next) => {
    const form = new FormData();
    form.set("username", "laura");
    form.set("password", "pw-for-tests");
    form.set("next", next);
    return handleAdminRequest(new Request("https://x.test/admin/login", { method: "POST", body: form, headers: { "cf-connecting-ip": "203.0.113.9" } }), env, new URL("https://x.test/admin/login"));
  };
  check("logging in returns to her note", (await loginWith("/admin/clients/client_maya/write")).headers.get("location"), "/admin/clients/client_maya/write");
  check("a bad next is ignored", (await loginWith("//evil.test/")).headers.get("location"), "/admin");
}

// --- getting it onto the iPad ------------------------------------------------------------
{
  const ipad = await worker.fetch(new Request("https://x.test/ipad"), env);
  check("skinbylauralo.com/ipad leads to the admin", [ipad.status, ipad.headers.get("location")], [302, "/admin"]);
  const launch = [...APP_HEAD.matchAll(/href="\/admin\/assets\/(launch-[^"]+)"/g)].map((match) => match[1]);
  check("iPads get launch screens upright and sideways", launch.filter((file) => ["launch-1640x2360.png", "launch-2360x1640.png"].includes(file)).length, 2);
  check("every launch screen named exists", launch.filter((file) => !iconBytes(file)), []);
}

if (failures) {
  console.log(`\n${failures} failing`);
  process.exit(1);
}
console.log("\nAll iPad note checks passed.");
