// Photos on iPad notes: sent with Done, kept with the draft, moved to the note on save, served back
// to the iPad, and cleaned up when a draft is dropped or a photo is taken off the page.
import { createD1, schemaMigrations } from "./helpers/d1-sqlite.mjs";
import { handleAdminRequest } from "../src/admin/routes.js";
import { createSessionToken, sessionCookie } from "../src/admin/auth.js";
import { deleteStaleDrafts } from "../src/admin/db.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const jpeg = (marker) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, marker, 0xff, 0xd9]);

function fakeBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, value) { objects.set(key, typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value)); },
    async get(key) {
      const bytes = objects.get(key);
      if (!bytes) return null;
      return { body: bytes, async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } };
    },
    async delete(keys) { for (const key of [].concat(keys)) objects.delete(key); },
  };
}

const d1 = createD1({ migrations: schemaMigrations() });
const bucket = fakeBucket();
const env = { CLIENT_NOTES_DB: d1, NOTES_BUCKET: bucket, ADMIN_USERNAME: "laura", ADMIN_PASSWORD: "pw-for-tests", ANTHROPIC_API_KEY: "test-key" };
d1.raw.exec(`INSERT INTO clients (id, name, square_customer_id) VALUES ('client_maya', 'Maya Reyes', 'SQ_MAYA'), ('client_other', 'Other Person', 'SQ_OTHER')`);

const cookie = sessionCookie(await createSessionToken(env, Date.now(), {}), {}).split(";")[0];
const call = (path, init = {}) => handleAdminRequest(new Request(`https://x.test${path}`, { ...init, headers: { cookie, ...(init.headers || {}) } }), env, new URL(`https://x.test${path}`));

globalThis.fetch = async (url) => {
  if (String(url).startsWith("https://api.anthropic.com/")) {
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ fields: { "Treatment type": "Peel" }, summary: "Peel.", confidence: "high", unclear: [] }) }] }));
  }
  throw new Error(`unexpected fetch ${url}`);
};

const placed = (id, page = 0) => ({ id, page, x: 100, y: 200, w: 300, h: 225 });
function inkForm({ images = [], files = {}, note, replaces } = {}) {
  const form = new FormData();
  form.append("page", new Blob([PNG_1X1], { type: "image/png" }), "page-1.png");
  form.append("strokes", JSON.stringify({ v: 1, pages: [[{ tool: "pen", color: "#2B3A55", points: [[10, 10, 0.5]] }]], images }));
  form.append("date", "2026-10-25");
  for (const [name, bytes] of Object.entries(files)) form.append("image", new Blob([bytes], { type: "image/jpeg" }), name);
  if (note) form.append("note", note);
  if (replaces) form.append("replaces", replaces);
  return form;
}
const done = (form, clientId = "client_maya") => call(`/admin/clients/${clientId}/ink`, { method: "POST", body: form });
const save = (draftId) => call(`/admin/clients/client_maya/ink/${draftId}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: "2026-10-25", fields: { "Treatment type": "Peel" } }) });
const keys = (prefix) => [...bucket.objects.keys()].filter((key) => key.startsWith(prefix)).sort();

// --- Done with photos ---------------------------------------------------------------
const first = await done(inkForm({ images: [placed("img_aaaaaa1"), placed("img_bbbbbb2", 0)], files: { img_aaaaaa1: jpeg(1), img_bbbbbb2: jpeg(2) } }));
const firstBody = await first.json();
check("Done with two photos is accepted", first.status, 200);
check("the photos are kept with the draft", keys(`drafts/${firstBody.draftId}/img_`), [`drafts/${firstBody.draftId}/img_aaaaaa1.jpg`, `drafts/${firstBody.draftId}/img_bbbbbb2.jpg`]);

// Done again replaces the draft: the earlier draft's photos go too.
const second = await done(inkForm({ images: [placed("img_aaaaaa1")], files: { img_aaaaaa1: jpeg(1), img_unlisted9: jpeg(9) }, replaces: firstBody.draftId }));
const secondBody = await second.json();
check("Done again drops the earlier draft's photos", keys(`drafts/${firstBody.draftId}/`), []);
check("a photo sent but not on any page isn't kept", keys(`drafts/${secondBody.draftId}/img_`), [`drafts/${secondBody.draftId}/img_aaaaaa1.jpg`]);

// --- bad photos ---------------------------------------------------------------------------
const badId = await done(inkForm({ images: [placed("img_aaaaaa1")], files: { "../evil.jpg": jpeg(1), img_aaaaaa1: jpeg(1) } }));
check("a photo with a bad name is refused", badId.status, 400);
const notJpeg = await done(inkForm({ images: [placed("img_cccccc3")], files: { img_cccccc3: PNG_1X1 } }));
check("a photo that isn't a JPEG is refused", [notJpeg.status, (await notJpeg.json()).message], [400, "Photos must be JPEG images."]);
const missing = await done(inkForm({ images: [placed("img_dddddd4")] }));
check("a photo on the page that wasn't sent is refused", missing.status, 400);
const badPlacement = await done(inkForm({ images: [{ id: "img_eeeeee5", page: 0, x: "left" }], files: { img_eeeeee5: jpeg(5) } }));
check("a photo without a position is refused", badPlacement.status, 400);
const many = Array.from({ length: 21 }, (_, i) => `img_many${String(i).padStart(4, "0")}`);
const tooMany = await done(inkForm({ images: many.map((id) => placed(id)), files: Object.fromEntries(many.map((id) => [id, jpeg(7)])) }));
check("more than 20 photos is refused", [tooMany.status, (await tooMany.json()).message], [400, "A note can have up to 20 photos."]);
const big = new Uint8Array(5 * 1024 * 1024 + 1); big.set([0xff, 0xd8, 0xff]);
const tooBig = await done(inkForm({ images: [placed("img_ffffff6")], files: { img_ffffff6: big } }));
check("a photo over 5 MB is refused", tooBig.status, 400);
check("refused requests leave no files behind", keys("drafts/").filter((key) => !key.startsWith(`drafts/${secondBody.draftId}/`)), []);

// --- save --------------------------------------------------------------------------------
const saved = await (await save(secondBody.draftId)).json();
const noteId = saved.noteId;
check("saving moves the photo to the note", keys(`ink/client_maya/${noteId}/`), [`ink/client_maya/${noteId}/img_aaaaaa1.jpg`]);
check("and leaves nothing in drafts", keys("drafts/"), []);

const photo = await call(`/admin/notes/${noteId}/images/img_aaaaaa1`);
check("the iPad can fetch the saved photo", [photo.status, photo.headers.get("content-type"), photo.headers.get("cache-control"), [...new Uint8Array(await photo.arrayBuffer())]], [200, "image/jpeg", "private, max-age=31536000, immutable", [...jpeg(1)]]);
check("an unknown photo is not found", (await call(`/admin/notes/${noteId}/images/img_zzzzzz0`)).status, 404);
check("a bad photo id is not found", (await call(`/admin/notes/${noteId}/images/..%2Fsecret`)).status, 404);
check("a photo of an unknown note is not found", (await call("/admin/notes/note_nope/images/img_aaaaaa1")).status, 404);

// --- editing: keep listed photos, add new ones, delete the ones taken off -------------------------
const editKeep = await done(inkForm({ note: noteId, images: [placed("img_aaaaaa1"), placed("img_gggggg7")], files: { img_gggggg7: jpeg(7) } }));
const editKeepBody = await editKeep.json();
check("changing a note can keep a saved photo without sending it again", editKeep.status, 200);
await save(editKeepBody.draftId);
check("after saving, the note has the kept photo and the new one", keys(`ink/client_maya/${noteId}/`), [`ink/client_maya/${noteId}/img_aaaaaa1.jpg`, `ink/client_maya/${noteId}/img_gggggg7.jpg`]);

const editDrop = await done(inkForm({ note: noteId, images: [placed("img_gggggg7")] }));
await save((await editDrop.json()).draftId);
check("a photo taken off the page is deleted on save", keys(`ink/client_maya/${noteId}/`), [`ink/client_maya/${noteId}/img_gggggg7.jpg`]);
check("the note's strokes and page are still there", [bucket.objects.has(`ink/client_maya/${noteId}.json`), bucket.objects.has(`notes/client_maya/${noteId}.pdf`)], [true, true]);

const otherNote = await done(inkForm({ images: [placed("img_gggggg7")] }), "client_other");
check("another client's note can't borrow a saved photo", otherNote.status, 400);

// --- a draft nobody saved -------------------------------------------------------------
const stale = await (await done(inkForm({ images: [placed("img_hhhhhh8")], files: { img_hhhhhh8: jpeg(8) } }))).json();
d1.raw.exec(`UPDATE note_drafts SET created_at = datetime('now', '-2 days') WHERE id = '${stale.draftId}'`);
await deleteStaleDrafts(env);
check("a stale draft's photos are cleaned up", keys(`drafts/${stale.draftId}/`), []);

if (failures) {
  console.error(`\n${failures} iPad photo check(s) failed.`);
  process.exit(1);
}
console.log("\nAll iPad photo checks passed.");
