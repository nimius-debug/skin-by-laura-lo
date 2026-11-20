// Black Friday 2026, "The Skin Investment Edit".
//
// One calendar drives everything the campaign changes on the site: the
// banners, the /black-friday page, the treatment package, free shipping and
// the coupon box at checkout. Each part reads the phase from here, so the
// site switches on Nov 23, changes on Nov 27 and returns to normal on Dec 1
// with nobody touching it.
//
// What stays in Square: the package's price, the 15% skincare discount (a
// dated dashboard discount the catalog already reads) and the gift cards.

/** Wall-clock times at the studio (STORE_TIMEZONE, Eastern). */
export const BLACK_FRIDAY = {
  name: "The Skin Investment Edit",
  // Phase "launch": package and gift card event, with a teaser for the sale.
  start: "2026-11-23 00:00:00",
  // Phase "sale": all three offers, 15% off skincare and free shipping.
  saleStart: "2026-11-27 00:00:00",
  // Over at this moment, so the last second is Nov 30, 11:59:59 PM.
  end: "2026-12-01 00:00:00",
  endLabel: "November 30, 2026 at 11:59 PM EST",
  // The same two moments in UTC (Eastern is UTC-5 in late November), for the
  // countdown clocks, which run in the visitor's browser.
  saleStartUtc: "2026-11-27T05:00:00Z",
  endUtc: "2026-12-01T05:00:00Z",
  // When the "it's live" email goes to everyone who asked to be told about
  // the skincare sale (src/notify.js): Friday, Nov 27 at 8:00 AM Eastern.
  notifyAtUtc: "2026-11-27T13:00:00Z",

  package: {
    title: "Liquid Microneedling Series",
    subtitle: "Corrective Series of 4",
    priceCents: 89700,
    treatmentValueCents: 102800,
    homecareValueCents: 10100,
    totalValueCents: 112900,
    savingsCents: 23200,
    includes: [
      "Four Liquid Microneedling treatments",
      "Complimentary pre- and post-treatment homecare",
      "Personalized treatment planning and ongoing guidance",
    ],
  },

  // Gift cards: a discount code typed on Square's eGift page. The code and
  // its dates are created in Square; the site only advertises it. `amounts`
  // are the card values Square's page offers, used for the worked examples.
  gift: {
    code: "BLACKFRIDAY",
    percent: 15,
    amounts: [9000, 12500, 20000, 35000],
  },

  salePercent: 15,
};

/**
 * The Square item sold as the treatment package. Square has no product type
 * for a prepaid series, so the name is the only signal, the same way gift
 * cards and shipping charges are recognised in square.js.
 */
export const PACKAGE_NAME = /liquid\s+microneedling\b.*\b(series|package)\b/i;

/** "YYYY-MM-DD HH:MM:SS" wall-clock time in a time zone, comparable as text. */
export function localStamp(now, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/** null outside the campaign, "launch" for Nov 23 to 26, "sale" for Nov 27 to 30. */
export function campaignPhase(now, timeZone = "America/New_York") {
  const stamp = localStamp(now, timeZone);
  if (stamp < BLACK_FRIDAY.start || stamp >= BLACK_FRIDAY.end) return null;
  return stamp < BLACK_FRIDAY.saleStart ? "launch" : "sale";
}

const PREVIEW_COOKIE = "bf_preview";
const PREVIEW_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Preview links, for approving each phase before it is live. Never on the
 * production hostname: there the real clock is the only clock.
 *
 * ?preview=2026-11-27 remembers that day in a cookie and reloads the page
 * without the parameter, so every link clicked afterwards stays on that day.
 * ?preview=off returns to today.
 *
 * Returns { redirect } when the cookie has to be set, otherwise { date },
 * the pretend "now" (noon Eastern on the chosen day) or null.
 */
export function previewFor(request, url, { allowed }) {
  if (!allowed) return { date: null };

  const asked = url.searchParams.get("preview");
  if (asked !== null) {
    const clean = new URL(url);
    clean.searchParams.delete("preview");
    const cookie = PREVIEW_DATE.test(asked)
      ? `${PREVIEW_COOKIE}=${asked}; Path=/; Max-Age=86400; SameSite=Lax`
      : `${PREVIEW_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return {
      redirect: new Response(null, {
        status: 302,
        headers: { location: clean.pathname + clean.search, "set-cookie": cookie, "cache-control": "no-store" },
      }),
    };
  }

  const match = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${PREVIEW_COOKIE}=(\\d{4}-\\d{2}-\\d{2})`));
  if (!match) return { date: null };
  // 17:00 UTC is noon Eastern in November, safely inside the chosen day.
  const date = new Date(`${match[1]}T17:00:00Z`);
  return { date: Number.isNaN(date.getTime()) ? null : date, day: match[1] };
}
