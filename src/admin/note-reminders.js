// Missing-note reminders. Once a day, at 10 am Tampa time, the dashboard looks at the last week of
// appointments and collects every client whose visit ended at least 24 hours ago with no note
// yet. If there are any, Laura's phone, iPad or laptop gets one notification with all of them:
// "3 clients still need notes: Maya Reyes, Jo Park, Rosa Diaz". A client stays on the list,
// day after day, until a note is written (or the visit is more than a week old).
//
// Only Square bookings count, so a visit is always a service; buying products never books one.
// A visit counts as noted when the client has a note (not an intake form) dated that day or
// later, or the booking has a seller note in Square.
//
// Kept in admin_settings: "note_reminders" (on | off), "last_note_reminder_date", and
// "note_reminder_log", the latest list, which the clients page shows as "Still need notes".

import { isConfigured, squareGet } from "../square.js";
import { getSetting, setSetting } from "./campaigns/store.js";
import { localTime } from "./campaigns/schedule.js";
import { listSubscriptions, notifyPhones } from "./campaigns/push.js";
import { upsertClientFromSquare } from "./db.js";
import { customerNamesFor, serviceNamesFor, SALON_TIME_ZONE } from "./today.js";

const HOUR_MS = 60 * 60 * 1000;
export const REMIND_AFTER_HOURS = 24;
export const CHECK_HOUR = 10; // 10 am, Tampa time
const LAST_CHECK_HOUR = 20; // a run missed in the morning still goes out until 8 pm
const LOOK_BACK_DAYS = 7;
const NAMES_SHOWN = 6;

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

/** Whether this run should do the daily check: from 10 am, once a day. Pure, for testing. */
export function checkDue({ local, lastCheckDate }) {
  return local.hour >= CHECK_HOUR && local.hour < LAST_CHECK_HOUR && lastCheckDate !== local.date;
}

/**
 * The visits to check at `now`: service appointments that happened (accepted, with a customer and
 * at least one service) and ended at least 24 hours ago, within the last week. Oldest first.
 */
export function visitsToCheck(bookings, { now }) {
  const time = now.getTime();
  return bookings
    .filter((booking) => booking.status === "ACCEPTED" && booking.customer_id && booking.start_at
      && (booking.appointment_segments || []).some((segment) => segment.service_variation_id))
    .filter((booking) => {
      const end = visitEnd(booking);
      return end + REMIND_AFTER_HOURS * HOUR_MS <= time && time - end < LOOK_BACK_DAYS * 24 * HOUR_MS;
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

/** The day's one notification, listing every client still missing a note. */
export function reminderMessage(visits, now) {
  if (!visits.length) return null;
  const id = `notes-${localTime(now).date}`;
  const names = [...new Set(visits.map((visit) => visit.name))];
  if (names.length === 1) {
    const latest = visits[visits.length - 1];
    return {
      id,
      title: `No notes yet for ${latest.name}`,
      body: `${latest.service ? `${latest.service}, ` : "Visit "}${whenLabel(latest.startAt, now)}. Tap to add your notes.`,
      url: `/admin/clients/${latest.clientId}`,
      writeUrl: `/admin/clients/${latest.clientId}/write`,
    };
  }
  const shown = names.slice(0, NAMES_SHOWN).join(", ");
  return {
    id,
    title: `${names.length} clients still need notes`,
    body: `${shown}${names.length > NAMES_SHOWN ? ` and ${names.length - NAMES_SHOWN} more` : ""}. Tap to see the list.`,
    url: "/admin#needs-notes",
  };
}

export async function remindersOn(env) {
  return (await getSetting(env, "note_reminders", "on")) !== "off";
}

export async function setRemindersOn(env, on) {
  await setSetting(env, "note_reminders", on ? "on" : "off");
}

/** Whether the client has a note for a visit: one dated that day or later, or written since. */
async function hasNoteSince(env, clientId, startAt) {
  const day = salonDate(startAt);
  const since = new Date(Date.parse(startAt) - 12 * HOUR_MS).toISOString().slice(0, 19).replace("T", " ");
  const row = await env.CLIENT_NOTES_DB.prepare(
    `SELECT 1 FROM notes WHERE client_id = ? AND source != 'form'
       AND (note_date >= ? OR (note_date IS NULL AND created_at >= ?)) LIMIT 1`,
  ).bind(clientId, day, since).first();
  return Boolean(row);
}

async function recentBookings(env, now) {
  const bookings = [];
  let cursor;
  let pages = 0;
  do {
    const payload = await squareGet(env, "/v2/bookings", {
      location_id: env.SQUARE_LOCATION_ID,
      // A day extra, for a long appointment that ended inside the week.
      start_at_min: new Date(now.getTime() - (LOOK_BACK_DAYS + 1) * 24 * HOUR_MS).toISOString(),
      start_at_max: new Date(now.getTime() - REMIND_AFTER_HOURS * HOUR_MS).toISOString(),
      limit: 200,
      cursor,
    });
    bookings.push(...(payload.bookings || []));
    cursor = payload.cursor;
    pages += 1;
  } while (cursor && pages < 10);
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

/** Every visit from the last week, a day or more ago, that still has no note. Oldest first. */
export async function findMissingNotes(env, now) {
  const visits = visitsToCheck(await recentBookings(env, now), { now });
  if (!visits.length) return [];
  const clients = await clientsFor(env, [...new Set(visits.map((booking) => booking.customer_id))]);
  const variationIds = [...new Set(visits.flatMap((booking) => booking.appointment_segments.map((segment) => segment.service_variation_id)).filter(Boolean))];
  const serviceNames = await serviceNamesFor(env, variationIds).catch(() => new Map());

  const missing = [];
  for (const booking of visits) {
    if (booking.seller_note && booking.seller_note.trim()) continue;
    const client = clients.get(booking.customer_id);
    if (await hasNoteSince(env, client.id, booking.start_at)) continue;
    const services = [...new Set(booking.appointment_segments.map((segment) => serviceNames.get(segment.service_variation_id)).filter(Boolean))];
    missing.push({ bookingId: booking.id, clientId: client.id, name: client.name, service: services.join(", "), startAt: booking.start_at });
  }
  return missing;
}

/** Called by every cron run; does the check once a day from 10 am. Returns what it did. */
export async function runNoteReminders(env, now = new Date(), { fetchImpl } = {}) {
  if (!isConfigured(env)) return { skipped: "no-square" };
  if (!(await remindersOn(env))) return { skipped: "off" };
  const local = localTime(now);
  if (!checkDue({ local, lastCheckDate: await getSetting(env, "last_note_reminder_date") })) return { skipped: "not-time" };
  // Marked first, so a slow or failing run can't notify twice in a day.
  await setSetting(env, "last_note_reminder_date", local.date);

  const missing = await findMissingNotes(env, now);
  await setSetting(env, "note_reminder_log", JSON.stringify({ checkedAt: now.toISOString(), visits: missing }));
  if (!missing.length) return { missing: 0 };
  if (!(await listSubscriptions(env)).length) return { missing: missing.length, phones: 0 };
  const phones = await notifyPhones(env, { messages: [reminderMessage(missing, now)], now: now.getTime(), ...(fetchImpl ? { fetchImpl } : {}) });
  return { missing: missing.length, phones };
}

/** For the clients page: the last daily list, minus visits that have a note by now. Newest first. */
export async function visitsNeedingNotes(env, now = new Date()) {
  let visits;
  try {
    visits = JSON.parse((await getSetting(env, "note_reminder_log")) || "{}").visits;
  } catch {
    visits = [];
  }
  const open = [];
  for (const visit of Array.isArray(visits) ? visits : []) {
    if (now.getTime() - Date.parse(visit.startAt) > (LOOK_BACK_DAYS + 1) * 24 * HOUR_MS) continue;
    if (!(await hasNoteSince(env, visit.clientId, visit.startAt))) open.push(visit);
  }
  return open.sort((a, b) => b.startAt.localeCompare(a.startAt)).map((visit) => ({ ...visit, when: whenLabel(visit.startAt, now) }));
}
