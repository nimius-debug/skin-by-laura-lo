// Missing-note reminders: a day after a service visit with no note, Laura's devices get a notification.
import { createD1, schemaMigrations } from "./helpers/d1-sqlite.mjs";
import { handleAdminRequest } from "../src/admin/routes.js";
import { createSessionToken, sessionCookie } from "../src/admin/auth.js";
import { addSubscription } from "../src/admin/campaigns/push.js";
import { dueVisits, isQuietHour, reminderMessages, runNoteReminders, setRemindersOn, visitEnd, visitsNeedingNotes, whenLabel } from "../src/admin/note-reminders.js";
import { clientsPage } from "../src/admin/pages/clients.js";
import { toString } from "../src/html.js";
import { SERVICE_WORKER_JS } from "../src/admin/pwa.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const NOW = new Date("2026-10-23T18:00:00Z"); // 2 pm in Tampa
const visit = (id, startAt, extra = {}) => ({ id, status: "ACCEPTED", start_at: startAt, customer_id: "SQ_MAYA", appointment_segments: [{ service_variation_id: "V1", duration_minutes: 60 }], ...extra });

// --- which visits are due -------------------------------------------------------------
{
  check("a visit ends after all its services", visitEnd(visit("b", "2026-10-22T14:00:00Z", { appointment_segments: [{ duration_minutes: 60 }, { duration_minutes: 30 }] })), Date.parse("2026-10-22T15:30:00Z"));
  const bookings = [
    visit("due", "2026-10-22T14:00:00Z"),
    visit("not-yet", "2026-10-22T19:00:00Z"),
    visit("cancelled", "2026-10-22T14:00:00Z", { status: "CANCELLED_BY_CUSTOMER" }),
    visit("no-show", "2026-10-22T14:00:00Z", { status: "NO_SHOW" }),
    visit("too-old", "2026-10-19T14:00:00Z"),
    visit("no-customer", "2026-10-22T14:00:00Z", { customer_id: null }),
    visit("no-service", "2026-10-22T14:00:00Z", { appointment_segments: [] }),
    visit("seen", "2026-10-22T14:00:00Z"),
  ];
  check("only service visits that happened, ended a day ago and weren't looked at yet are due",
    dueVisits(bookings, { now: NOW, seen: new Set(["seen"]) }).map((booking) => booking.id), ["due"]);
  check("it's quiet from 9 pm to 8 am in Tampa", [isQuietHour(new Date("2026-10-24T01:30:00Z")), isQuietHour(new Date("2026-10-23T11:30:00Z")), isQuietHour(NOW), isQuietHour(new Date("2026-10-24T00:59:00Z"))], [true, true, false, false]);
  check("the visit reads as yesterday, or by its date when older", [whenLabel("2026-10-22T14:00:00Z", NOW), whenLabel("2026-10-21T14:00:00Z", NOW)], ["yesterday at 10:00 am", "Wed, Oct 21 at 10:00 am"]);

  const one = reminderMessages([{ bookingId: "b1", clientId: "client_maya", name: "Maya Reyes", service: "Acne bootcamp facial", startAt: "2026-10-22T14:00:00Z" }], NOW);
  check("one visit, one notification naming the client and opening her page (the writing screen on iPad)", one, [{
    id: "notes-b1", title: "No notes yet for Maya Reyes", body: "Acne bootcamp facial, yesterday at 10:00 am. Tap to add your notes.",
    url: "/admin/clients/client_maya", writeUrl: "/admin/clients/client_maya/write",
  }]);
  const many = reminderMessages(["A", "B", "C", "D", "E"].map((name, i) => ({ bookingId: `b${i}`, clientId: `c${i}`, name, service: "", startAt: "2026-10-22T14:00:00Z" })), NOW);
  check("many at once come as one notification", [many.length, many[0].title, many[0].body, many[0].url], [1, "5 visits have no notes yet", "A, B, C, D and 1 more. Tap to add your notes.", "/admin#needs-notes"]);
}

// --- a cron run, end to end -------------------------------------------------------------
const d1 = createD1({ migrations: schemaMigrations() });
const env = { CLIENT_NOTES_DB: d1, ADMIN_USERNAME: "laura", ADMIN_PASSWORD: "pw-for-tests", SQUARE_ACCESS_TOKEN: "t", SQUARE_LOCATION_ID: "L1" };
d1.raw.exec(`INSERT INTO clients (id, name, square_customer_id) VALUES
  ('client_maya', 'Maya Reyes', 'SQ_MAYA'), ('client_jo', 'Jo Park', 'SQ_JO'), ('client_ana', 'Ana Ruiz', 'SQ_ANA'), ('client_lee', 'Lee Chan', 'SQ_LEE')`);
d1.raw.exec(`INSERT INTO notes (id, client_id, note_date, summary, extracted_text, source) VALUES
  ('n_old', 'client_maya', '2026-09-30', 'Clear peel.', '', 'square'),
  ('n_jo', 'client_jo', '2026-10-22', 'Dermaplane.', '', 'ipad'),
  ('n_lee_form', 'client_lee', '2026-10-22', 'Intake form', '', 'form')`);

const bookings = [
  visit("b_maya", "2026-10-22T14:00:00Z"),
  visit("b_jo", "2026-10-22T15:00:00Z", { customer_id: "SQ_JO" }),
  visit("b_ana", "2026-10-22T15:30:00Z", { customer_id: "SQ_ANA", seller_note: "Did the enzyme peel." }),
  visit("b_lee", "2026-10-22T16:00:00Z", { customer_id: "SQ_LEE" }),
  visit("b_new", "2026-10-22T13:00:00Z", { customer_id: "SQ_NEW" }),
  visit("b_later", "2026-10-22T20:00:00Z"),
];
const pushes = [];
let squareCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const target = new URL(String(url));
  if (target.hostname === "web.push.apple.com") {
    pushes.push({ url: String(url), body: init.body ?? null });
    return new Response("", { status: 201 });
  }
  squareCalls += 1;
  if (target.pathname === "/v2/bookings") return new Response(JSON.stringify({ bookings }));
  if (target.pathname === "/v2/catalog/batch-retrieve") return new Response(JSON.stringify({ objects: [{ id: "V1", item_variation_data: { item_id: "I1", name: "Regular" } }], related_objects: [{ id: "I1", type: "ITEM", item_data: { name: "Acne bootcamp facial" } }] }));
  if (target.pathname === "/v2/customers/bulk-retrieve") return new Response(JSON.stringify({ responses: { SQ_NEW: { customer: { given_name: "Rosa", family_name: "Diaz" } } } }));
  return new Response("{}", { status: 500 });
};

{
  check("with no device signed up, nothing is checked", [(await runNoteReminders(env, NOW)).skipped, squareCalls], ["no-devices", 0]);
  await addSubscription(env, { endpoint: "https://web.push.apple.com/laura-phone" });
  await addSubscription(env, { endpoint: "https://web.push.apple.com/laura-laptop" });
  check("at night it waits for the morning", (await runNoteReminders(env, new Date("2026-10-23T02:00:00Z"))).skipped, "quiet");
  await setRemindersOn(env, false);
  check("switched off, nothing is checked", (await runNoteReminders(env, NOW)).skipped, "off");
  await setRemindersOn(env, true);

  const result = await runNoteReminders(env, NOW);
  check("visits with a note or a Square seller note are skipped; an intake form isn't a note", [result.checked, result.reminded, result.phones], [5, 3, 2]);
  check("every device gets one empty push", [pushes.length, pushes.every((push) => !push.body)], [2, true]);
  const newClient = await d1.prepare("SELECT id, name FROM clients WHERE square_customer_id = 'SQ_NEW'").first();
  check("someone on a first visit becomes a client, so the note has somewhere to go", newClient?.name, "Rosa Diaz");

  const cookie = sessionCookie(await createSessionToken(env, Date.now(), {}), {}).split(";")[0];
  const call = (path, init = {}) => handleAdminRequest(new Request(`https://x.test${path}`, { ...init, headers: { cookie, ...(init.headers || {}) } }), env, new URL(`https://x.test${path}`));
  const { messages } = await (await call("/admin/push/messages")).json();
  check("the app asks the dashboard what to show: one notification per visit missing a note",
    messages.map((message) => message.title).sort(), ["No notes yet for Lee Chan", "No notes yet for Maya Reyes", "No notes yet for Rosa Diaz"]);
  const signedOut = await handleAdminRequest(new Request("https://x.test/admin/push/messages"), env, new URL("https://x.test/admin/push/messages"));
  check("the messages need the login", signedOut.status, 303);

  pushes.length = 0;
  const again = await runNoteReminders(env, new Date(NOW.getTime() + 15 * 60000));
  check("the next run doesn't remind about the same visits again", [again.reminded, pushes.length], [0, 0]);

  const open = await visitsNeedingNotes(env, NOW);
  check("the clients page lists the visits still missing a note, newest first", open.map((entry) => entry.name), ["Lee Chan", "Maya Reyes", "Rosa Diaz"]);
  d1.raw.exec(`INSERT INTO notes (id, client_id, note_date, summary, extracted_text, source) VALUES ('n_maya', 'client_maya', '2026-10-23', 'Written a day late.', '', 'ipad')`);
  check("once a note is written, the visit drops off the list", (await visitsNeedingNotes(env, NOW)).map((entry) => entry.name), ["Lee Chan", "Rosa Diaz"]);

  const page = toString(clientsPage({ clients: [], needsNotes: await visitsNeedingNotes(env, NOW), noteReminders: true }));
  check("the list has a Write a note button for each", [page.includes('id="needs-notes"'), page.includes('href="/admin/clients/client_lee/write"'), page.includes("Acne bootcamp facial · yesterday at 12:00 pm")], [true, true, true]);
  check("the clients page has the switch and a way to turn on notifications", [page.includes('name="note_reminders" value="on" checked'), page.includes("data-push-button")], [true, true]);
  check("with nothing missing the list is hidden", toString(clientsPage({ clients: [], needsNotes: [], noteReminders: true })).includes('id="needs-notes"'), false);

  const form = new FormData();
  const saved = await call("/admin/reminders", { method: "POST", body: form, headers: { accept: "application/json" } });
  check("the switch turns the reminders off", [saved.status, (await runNoteReminders(env, NOW)).skipped], [200, "off"]);
}
globalThis.fetch = realFetch;

// --- the app's service worker ---------------------------------------------------------
{
  check("the service worker is valid JavaScript", (() => { try { new Function(SERVICE_WORKER_JS); return true; } catch { return false; } })(), true);
  check("it asks the dashboard what to show and always shows something", [SERVICE_WORKER_JS.includes('fetch("/admin/push/messages"'), SERVICE_WORKER_JS.includes("You have a new reminder")], [true, true]);
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll missing-note reminder checks passed.");
