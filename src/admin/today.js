// Today's appointments, read live from Square bookings, so the iPad opens on the clients Laura is
// about to see. Each booking is matched to a client by Square customer id; someone booked for
// the first time is shown by name but can't have a note yet (clients only come from a sync).
// Fails soft: if Square can't be reached the list is just missing, never the page.

import { squareFetch, squareGet, isConfigured } from "../square.js";

export const SALON_TIME_ZONE = "America/New_York";

/** Minutes the zone is ahead of UTC at a moment (negative west of Greenwich). */
function zoneOffsetMinutes(at, timeZone) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(at).find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return match[1] === "-" ? -minutes : minutes;
}

/** The salon's calendar day around `now`, as UTC instants: { day: "yyyy-mm-dd", start, end }. */
export function salonDay(now = new Date(), timeZone = SALON_TIME_ZONE) {
  const day = now.toLocaleDateString("en-CA", { timeZone });
  const midnightUtc = Date.parse(`${day}T00:00:00Z`);
  const start = midnightUtc - zoneOffsetMinutes(new Date(midnightUtc), timeZone) * 60000;
  const nextUtc = midnightUtc + 24 * 3600000;
  const end = nextUtc - zoneOffsetMinutes(new Date(nextUtc), timeZone) * 60000;
  return { day, start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

const SHOWN_STATUSES = new Set(["ACCEPTED", "PENDING"]);

/**
 * Turn the day's bookings into rows: [{ bookingId, startAt, time, customerId, clientId, name, services }],
 * earliest first. `clientsBySquareId` maps Square customer id to { id, name }; `serviceNames` maps a
 * service variation id to its name; `customerNames` names people who aren't clients yet.
 */
export function appointmentRows(bookings, { clientsBySquareId, serviceNames = new Map(), customerNames = new Map(), timeZone = SALON_TIME_ZONE }) {
  return bookings
    .filter((booking) => SHOWN_STATUSES.has(booking.status) && booking.start_at)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .map((booking) => {
      const client = clientsBySquareId.get(booking.customer_id) || null;
      const services = (booking.appointment_segments || [])
        .map((segment) => serviceNames.get(segment.service_variation_id))
        .filter(Boolean);
      return {
        bookingId: booking.id,
        startAt: booking.start_at,
        time: new Date(booking.start_at).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" }),
        customerId: booking.customer_id || null,
        clientId: client?.id || null,
        name: client?.name || customerNames.get(booking.customer_id) || "Someone new",
        services: [...new Set(services)],
      };
    });
}

async function serviceNamesFor(env, variationIds) {
  const names = new Map();
  if (!variationIds.length) return names;
  const payload = await squareFetch(env, "/v2/catalog/batch-retrieve", { object_ids: variationIds, include_related_objects: true });
  const items = new Map((payload.related_objects || []).filter((object) => object.type === "ITEM").map((item) => [item.id, item.item_data?.name]));
  for (const object of payload.objects || []) {
    const data = object.item_variation_data;
    if (!data) continue;
    const itemName = items.get(data.item_id);
    // A service's only variation is usually called "Regular"; the item's name is the useful one.
    names.set(object.id, itemName && (!data.name || /^regular$/i.test(data.name)) ? itemName : itemName ? `${itemName} (${data.name})` : data.name);
  }
  return names;
}

async function customerNamesFor(env, customerIds) {
  const names = new Map();
  if (!customerIds.length) return names;
  const payload = await squareFetch(env, "/v2/customers/bulk-retrieve", { customer_ids: customerIds });
  for (const [id, result] of Object.entries(payload.responses || {})) {
    const customer = result.customer;
    if (!customer) continue;
    names.set(id, [customer.given_name, customer.family_name].filter(Boolean).join(" ") || customer.company_name || "Someone new");
  }
  return names;
}

/** Today's appointments: { day, rows, failed }. rows is empty (and failed true) when Square can't be read. */
export async function todaysAppointments(env, { now = new Date() } = {}) {
  const window = salonDay(now);
  if (!isConfigured(env)) return { day: window.day, rows: [], failed: false };
  try {
    const payload = await squareGet(env, "/v2/bookings", { location_id: env.SQUARE_LOCATION_ID, start_at_min: window.start, start_at_max: window.end, limit: 100 });
    const bookings = (payload.bookings || []).filter((booking) => SHOWN_STATUSES.has(booking.status));
    const customerIds = [...new Set(bookings.map((booking) => booking.customer_id).filter(Boolean))];

    const clientsBySquareId = new Map();
    if (customerIds.length) {
      const { results } = await env.CLIENT_NOTES_DB.prepare(
        `SELECT id, name, square_customer_id FROM clients WHERE square_customer_id IN (${customerIds.map(() => "?").join(", ")})`,
      ).bind(...customerIds).all();
      for (const row of results) clientsBySquareId.set(row.square_customer_id, row);
    }

    const variationIds = [...new Set(bookings.flatMap((booking) => (booking.appointment_segments || []).map((segment) => segment.service_variation_id)).filter(Boolean))];
    const unknownIds = customerIds.filter((id) => !clientsBySquareId.has(id));
    // Names are a nicety: a failure here still shows the times.
    const [serviceNames, customerNames] = await Promise.all([
      serviceNamesFor(env, variationIds).catch(() => new Map()),
      customerNamesFor(env, unknownIds).catch(() => new Map()),
    ]);
    return { day: window.day, rows: appointmentRows(bookings, { clientsBySquareId, serviceNames, customerNames }), failed: false };
  } catch (error) {
    console.error("Reading today's bookings failed:", error.message);
    return { day: window.day, rows: [], failed: true };
  }
}
