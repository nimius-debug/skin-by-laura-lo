// Missing-note reminders. A day after a client's appointment ends, if Laura hasn't written a note
// for that visit, her phone, iPad or laptop gets a notification: "No notes yet for Maya Rivers".
//
// Only Square bookings count, so a visit is always a service; buying products never books one.
// A visit counts as noted when the client has a note (not an intake form) dated that day or
// later, or the booking has a seller note in Square. Runs from the 15-minute cron, stays quiet
// overnight, and remembers each visit it has looked at so nobody is reminded twice.
//
// Kept in admin_settings: "note_reminders" (on | off) and "note_reminder_log", the visits
// looked at in the last week. The clients page lists the ones still missing a note.

import { isConfigured, squareGet } from "../square.js";
import { getSetting, setSetting } from "./campaigns/store.js";
import { listSubscriptions, notifyPhones } from "./campaigns/push.js";
import { upsertClientFromSquare } from "./db.js";
import { customerNamesFor, serviceNamesFor, SALON_TIME_ZONE } from "./today.js";

const HOUR_MS = 60 * 60 * 1000;
export const REMIND_AFTER_HOURS = 24;
// A visit missed by a run (Square down, a quiet night) is still reminded about up to two days late.
const LOOK_BACK_HOURS = 48;
const LOG_DAYS = 7;
const QUIET_FROM_HOUR = 21; // 9 pm
const QUIET_UNTIL_HOUR = 8; // 8 am
// More than this many at once come as one notification, so the phone isn't flooded.
const SEPARATE_LIMIT = 3;

const DEFAULT_DURATION_MINUTES = 60;

/** When the appointment ends: its start plus the length of every service in it. */
export function visitEnd(booking) {
  const minutes = (booking.appointment_segments || []).reduce((sum, segment) => sum + (Number(segment.duration_minutes) || 0), 0);
  return Date.parse(booking.start_at) + (minutes || DEFAULT_DURATION_MINUTES) * 60000;
}

/** The salon's calendar day a moment falls on, yyyy-mm-dd. */
export function salonDate(at, timeZone = SALON_TIME_ZONE) {
  return new Date(at).toLocaleDateString("en-CA", { timeZone });
}

/** Whether it's night in Tampa, when no reminders go out. */
export function isQuietHour(now, timeZone = SALON_TIME_ZONE) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

/**
 * The visits whose reminder is due at `now`: service appointments that happened (accepted, with a
 * customer and at least one service), ended 24 to 72 hours ago, and haven't been looked at yet.
 */
export function dueVisits(bookings, { now, seen = new Set() }) {
  const time = now.getTime();
  return bookings
    .filter((booking) => booking.status === "ACCEPTED" && booking.customer_id && booking.start_at
      && (booking.appointment_segments || []).some((segment) => segment.service_variation_id))
    .filter((booking) => !seen.has(booking.id))
    .filter((booking) => {
      const due = visitEnd(booking) + REMIND_AFTER_HOURS * HOUR_MS;
      return due <= time && time - due < LOOK_BACK_HOURS * HOUR_MS;
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}

/** "yesterday at 2:00 pm", or "Tue, Oct 20 at 2:00 pm" for an older visit. */
export function whenLabel(startAt, now, timeZone = SALON_TIME_ZONE) {
  const time = new Date(startAt).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).toLowerCase();
  const yesterday = salonDate(now.getTime() - 24 * HOUR_MS, timeZone);
  if (salonDate(startAt, timeZone) === yesterday) return `yesterday at ${time}`;
  const day = new Date(startAt).toLocaleDateString("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
  return `${day} at ${time}`;
}

/** What the phone shows: one notification per visit, or one for all of them when there are many. */
export function reminderMessages(visits, now) {
  if (!visits.length) return [];
  if (visits.length > SEPARATE_LIMIT) {
    const names = visits.map((visit) => visit.name);
    return [{
      id: `notes-${visits.map((visit) => visit.bookingId).join("-").slice(0, 80)}`,
      title: `${visits.length} visits have no notes yet`,
      body: `${names.slice(0, 4).join(", ")}${names.length > 4 ? ` and ${names.length - 4} more` : ""}. Tap to add your notes.`,
      url: "/admin#needs-notes",
    }];
  }
  return visits.map((visit) => ({
    id: `notes-${visit.bookingId}`,
    title: `No notes yet for ${visit.name}`,
    body: `${visit.service ? `${visit.service}, ` : "Visit "}${whenLabel(visit.startAt, now)}. Tap to add your notes.`,
    url: `/admin/clients/${visit.clientId}`,
    writeUrl: `/admin/clients/${visit.clientId}/write`,
  }));
}

export async function remindersOn(env) {
  return (await getSetting(env, "note_reminders", "on")) !== "off";
}

export async function setRemindersOn(env, on) {
  await setSetting(env, "note_reminders", on ? "on" : "off");
}

/** The visits looked at in the last week: [{ bookingId, clientId, name, service, startAt, noted, at }]. */
async function readLog(env, now) {
  let list;
  try {
    list = JSON.parse((await getSetting(env, "note_reminder_log")) || "[]");
  } catch {
    list = [];
  }
  return (Array.isArray(list) ? list : []).filter((entry) => now.getTime() - Date.parse(entry.at) < LOG_DAYS * 24 * HOUR_MS);
}

/** Whether the client has a note for a visit on `day`: one dated that day or later, or written since. */
async function hasNoteSince(env, clientId, startAt) {
  const day = salonDate(startAt);
  const since = new Date(Date.parse(startAt) - 12 * HOUR_MS).toISOString().slice(0, 19).replace("T", " ");
  const row = await env.CLIENT_NOTES_DB.prepare(
    `SELECT 1 FROM notes WHERE client_id = ? AND source != 'form'
       AND (note_date >= ? OR (note_date IS NULL AND created_at >= ?)) LIMIT 1`,
  ).bind(clientId, day, since).first();
  return Boolean(row);
}

async function bookingsAround(env, now) {
  const bookings = [];
  let cursor;
  let pages = 0;
  do {
    const payload = await squareGet(env, "/v2/bookings", {
      location_id: env.SQUARE_LOCATION_ID,
      // Wide enough for a long appointment that ended inside the look-back window.
      start_at_min: new Date(now.getTime() - (REMIND_AFTER_HOURS + LOOK_BACK_HOURS + 12) * HOUR_MS).toISOString(),
      start_at_max: new Date(now.getTime() - REMIND_AFTER_HOURS * HOUR_MS).toISOString(),
      limit: 200,
      cursor,
    });
    bookings.push(...(payload.bookings || []));
    cursor = payload.cursor;
    pages += 1;
  } while (cursor && pages < 5);
  return bookings;
}

/** The client each customer is, adding anyone who's new (a visit that happened makes them a client, as a sync would). */
async function clientsFor(env, customerIds) {
  const clients = new Map();
  if (!customerIds.length) return clients;
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    `SELECT id, name, square_customer_id FROM clients WHERE square_customer_id IN (${customerIds.map(() => "?").join(", ")})`,
  ).bind(...customerIds).all();
  for (const row of results) clients.set(row.square_customer_id, { id: row.id, name: row.name });
  const unknown = customerIds.filter((id) => !clients.has(id));
  if (unknown.length) {
    const names = await customerNamesFor(env, unknown).catch(() => new Map());
    for (const customerId of unknown) {
      const name = names.get(customerId) || "Unnamed client";
      clients.set(customerId, { id: await upsertClientFromSquare(env, { squareCustomerId: customerId, name }), name });
    }
  }
  return clients;
}

/** One cron run: finds visits from a day ago with no note and notifies. Returns what it did. */
export async function runNoteReminders(env, now = new Date(), { fetchImpl } = {}) {
  if (!isConfigured(env)) return { skipped: "no-square" };
  if (!(await remindersOn(env))) return { skipped: "off" };
  if (!(await listSubscriptions(env)).length) return { skipped: "no-devices" };
  // Left for the morning: the look-back window still covers them at 8 am.
  if (isQuietHour(now)) return { skipped: "quiet" };

  const log = await readLog(env, now);
  const visits = dueVisits(await bookingsAround(env, now), { now, seen: new Set(log.map((entry) => entry.bookingId)) });
  if (!visits.length) return { checked: 0, reminded: 0 };

  const clients = await clientsFor(env, [...new Set(visits.map((booking) => booking.customer_id))]);
  const variationIds = [...new Set(visits.flatMap((booking) => booking.appointment_segments.map((segment) => segment.service_variation_id)).filter(Boolean))];
  const serviceNames = await serviceNamesFor(env, variationIds).catch(() => new Map());

  const entries = [];
  for (const booking of visits) {
    const client = clients.get(booking.customer_id);
    const services = [...new Set(booking.appointment_segments.map((segment) => serviceNames.get(segment.service_variation_id)).filter(Boolean))];
    const noted = Boolean(booking.seller_note && booking.seller_note.trim()) || await hasNoteSince(env, client.id, booking.start_at);
    entries.push({ bookingId: booking.id, clientId: client.id, name: client.name, service: services.join(", "), startAt: booking.start_at, noted, at: now.toISOString() });
  }
  // Saved first, so a slow or failing push can't remind twice.
  await setSetting(env, "note_reminder_log", JSON.stringify([...entries, ...log]));

  const missing = entries.filter((entry) => !entry.noted);
  if (!missing.length) return { checked: entries.length, reminded: 0 };
  const phones = await notifyPhones(env, { messages: reminderMessages(missing, now), now: now.getTime(), ...(fetchImpl ? { fetchImpl } : {}) });
  return { checked: entries.length, reminded: missing.length, phones };
}

/** For the clients page: visits from the last week she was reminded about that still have no note, newest first. */
export async function visitsNeedingNotes(env, now = new Date()) {
  const log = (await readLog(env, now)).filter((entry) => !entry.noted);
  const open = [];
  for (const entry of log) if (!(await hasNoteSince(env, entry.clientId, entry.startAt))) open.push(entry);
  return open.sort((a, b) => b.startAt.localeCompare(a.startAt)).map((entry) => ({ ...entry, when: whenLabel(entry.startAt, now) }));
}
