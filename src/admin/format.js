// Small display helpers for the client page.

const DAY_MS = 24 * 60 * 60 * 1000;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** 4500 -> "$45.00". Amounts from Square are in cents. */
export function formatMoney(cents) {
  return money.format((Number(cents) || 0) / 100);
}

/** Whole days between an ISO date and now (0 for today or the future). */
export function daysSince(iso, now = Date.now()) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now - then) / DAY_MS));
}

/** "today", "5 days ago", "3 weeks ago", "7 months ago", "2 years ago". */
export function timeAgo(iso, now = Date.now()) {
  const days = daysSince(iso, now);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30.4)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
