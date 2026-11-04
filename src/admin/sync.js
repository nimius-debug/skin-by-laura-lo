// Pulls the client list from Square directly, rather than letting anyone
// type a client in by hand: a client exists here only because they have a
// past, completed booking in Square. Also imports each booking's
// seller_note as a note, since Laura already writes real clinical notes
// there — no OCR needed, it's already text.
//
// Square's bookings "list" endpoint caps start_at_min/start_at_max at 31
// days per call (confirmed against the live API, not just the docs), so a
// multi-year sync has to walk forward in monthly-ish windows rather than
// ask for everything at once.

import { squareGet, isConfigured } from "../square.js";
import { upsertClientFromSquare, upsertSellerNote } from "./db.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_DAYS = 31;
const DEFAULT_SINCE_DAYS = 365 * 3; // ~3 years

/** Split [sinceISO, untilISO) into consecutive windows no longer than maxDays. */
export function syncWindows(sinceISO, untilISO, maxDays = MAX_WINDOW_DAYS) {
  const since = new Date(sinceISO).getTime();
  const until = new Date(untilISO).getTime();
  const windows = [];
  let start = since;
  while (start < until) {
    const end = Math.min(start + maxDays * DAY_MS, until);
    windows.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    start = end;
  }
  return windows;
}

/** A booking counts as "gotten a service" when it actually happened: accepted, and in the past. */
export function isCountableBooking(booking, nowISO) {
  return booking?.status === "ACCEPTED" && Boolean(booking?.start_at) && new Date(booking.start_at) < new Date(nowISO);
}

async function fetchAllBookingsInWindow(env, window) {
  const bookings = [];
  let cursor;
  let pages = 0;
  do {
    const payload = await squareGet(env, "/v2/bookings", {
      location_id: env.SQUARE_LOCATION_ID,
      start_at_min: window.start,
      start_at_max: window.end,
      limit: 200,
      cursor,
    });
    for (const booking of payload.bookings || []) bookings.push(booking);
    cursor = payload.cursor;
    pages += 1;
  } while (cursor && pages < 20); // safety valve — a single 31-day window should never need this many pages
  return bookings;
}

async function loadCustomerNames(env) {
  const names = new Map();
  let cursor;
  let pages = 0;
  do {
    const payload = await squareGet(env, "/v2/customers", { limit: 100, cursor });
    for (const customer of payload.customers || []) {
      const name = [customer.given_name, customer.family_name].filter(Boolean).join(" ")
        || customer.company_name || customer.email_address || "Unnamed client";
      names.set(customer.id, name);
    }
    cursor = payload.cursor;
    pages += 1;
  } while (cursor && pages < 50);
  return names;
}

/**
 * Walk the last `sinceDays` of bookings, upsert a client for every distinct
 * customer with a past accepted booking, and import each booking's
 * seller_note as a note on that client.
 */
export async function syncClientsFromSquare(env, { sinceDays = DEFAULT_SINCE_DAYS, now = new Date() } = {}) {
  if (!isConfigured(env)) throw new Error("Square is not connected yet.");

  const nowISO = now.toISOString();
  const sinceISO = new Date(now.getTime() - sinceDays * DAY_MS).toISOString();
  const windows = syncWindows(sinceISO, nowISO);

  const bookings = [];
  for (const window of windows) {
    bookings.push(...await fetchAllBookingsInWindow(env, window));
  }

  const countable = bookings.filter((booking) => isCountableBooking(booking, nowISO));
  const customerNames = await loadCustomerNames(env);

  const seenCustomers = new Set();
  let notesImported = 0;

  for (const booking of countable) {
    if (!booking.customer_id) continue;
    const name = customerNames.get(booking.customer_id) || "Unnamed client";
    const clientId = await upsertClientFromSquare(env, { squareCustomerId: booking.customer_id, name });
    seenCustomers.add(booking.customer_id);

    const sellerNote = typeof booking.seller_note === "string" ? booking.seller_note.trim() : "";
    if (sellerNote) {
      await upsertSellerNote(env, clientId, { bookingId: booking.id, date: booking.start_at.slice(0, 10), text: sellerNote });
      notesImported += 1;
    }
  }

  return { clientsFound: seenCustomers.size, notesImported, bookingsScanned: bookings.length };
}
