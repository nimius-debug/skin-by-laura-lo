// "Email me when it starts": the sign-up box in the skincare offer on the
// Black Friday homepage, and the one email it promises.
//
// Sign-ups are kept in notify_signups (migrations/0011). From Friday, Nov 27
// at 8 AM Eastern the scheduled run (every 15 minutes) sends the email to
// everyone not yet sent it, inside Resend's daily allowance, which campaign
// emails, test emails and reminders share. If more people signed up than the
// day allows, the rest go out on the next run after the allowance resets
// (8 PM Tampa time, when the UTC day changes).

import { BLACK_FRIDAY } from "./campaign.js";
import { settings, SUPPORT_EMAIL } from "./config.js";
import { escapeHtml, BUSINESS_ADDRESS } from "./admin/campaigns/email-template.js";
import { sendingConfigured, unsubscribeUrl, usageSummary } from "./admin/campaigns/sending.js";
import * as store from "./admin/campaigns/store.js";

export const NOTIFY_LIST = "bf-2026-skincare";
const EMAIL_PATTERN = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/;
const PER_IP_PER_HOUR = 5;
const BATCH_SIZE = 95;

export function cleanEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Saves one sign-up. Returns { ok, reason? }: reason is "invalid", "closed"
 * (the sale already started), "busy" (too many from one visitor) or "spam".
 */
export async function addSignup(env, { email: rawEmail, honeypot = "", ip = "", phase, now = new Date() }) {
  if (honeypot) return { ok: true, reason: "spam" }; // Bots get a cheerful nothing.
  if (phase !== "launch") return { ok: false, reason: "closed" };
  const email = cleanEmail(rawEmail);
  if (!email) return { ok: false, reason: "invalid" };
  const db = env.CLIENT_NOTES_DB;
  const ipHash = ip ? (await sha256(`notify:${ip}`)).slice(0, 32) : null;
  if (ipHash) {
    const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const row = await db.prepare("SELECT COUNT(*) AS n FROM notify_signups WHERE ip_hash = ? AND created_at >= ?").bind(ipHash, since).first();
    if ((row?.n || 0) >= PER_IP_PER_HOUR) return { ok: false, reason: "busy" };
  }
  await db.prepare("INSERT OR IGNORE INTO notify_signups (list, email, created_at, ip_hash) VALUES (?, ?, ?, ?)")
    .bind(NOTIFY_LIST, email, now.toISOString(), ipHash).run();
  return { ok: true };
}

/** For the admin: how many signed up and how many were emailed. */
export async function signupCounts(env) {
  const row = await env.CLIENT_NOTES_DB.prepare(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN notified_at IS NOT NULL THEN 1 ELSE 0 END) AS sent, SUM(CASE WHEN error IS NOT NULL AND notified_at IS NULL THEN 1 ELSE 0 END) AS failed FROM notify_signups WHERE list = ?",
  ).bind(NOTIFY_LIST).first();
  return { total: row?.total || 0, sent: row?.sent || 0, failed: row?.failed || 0 };
}

export async function recentSignups(env, limit = 200) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    "SELECT email, created_at, notified_at, error FROM notify_signups WHERE list = ? ORDER BY created_at DESC LIMIT ?",
  ).bind(NOTIFY_LIST, limit).all();
  return results;
}

/** The email itself. Pure, so the admin page can preview it. */
export function notifyEmail({ siteUrl, unsubscribe }) {
  const pct = BLACK_FRIDAY.salePercent;
  const shop = `${siteUrl}/shop`;
  const subject = `It's live: ${pct}% off skincare + free shipping`;
  const html = `<!doctype html><html><body style="margin:0;background:#0c0c0b;">
<div style="max-width:520px;margin:0 auto;padding:36px 24px;font-family:Arial,Helvetica,sans-serif;color:#f3eee5;background:#0c0c0b;">
<p style="margin:0 0 18px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#d8c39b;">Skin by Laura Lo · Black Friday</p>
<h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:38px;line-height:1.05;color:#f3eee5;">${pct}% off skincare is live.</h1>
<p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#b3ada1;">You asked us to tell you. Every product on Laura&#8217;s shelf is ${pct}% off with free U.S. shipping, taken off automatically. Ends Monday, Nov 30 at 11:59 PM.</p>
<p style="margin:0 0 28px;"><a href="${escapeHtml(shop)}" style="display:inline-block;background:#f3eee5;color:#0c0c0b;font-weight:bold;font-size:13px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:16px 26px;">Shop ${pct}% off</a></p>
<p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#b3ada1;">Also this week: the Liquid Microneedling Series and gift cards ${BLACK_FRIDAY.gift.percent}% off with code ${escapeHtml(BLACK_FRIDAY.gift.code)}.</p>
<p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#8f8a7d;">This is the one email you asked for. ${escapeHtml(BUSINESS_ADDRESS)}. <a href="${escapeHtml(unsubscribe)}" style="color:#8f8a7d;">Unsubscribe</a></p>
</div></body></html>`;
  const text = `${pct}% off skincare is live.\n\nYou asked us to tell you. Every product on Laura's shelf is ${pct}% off with free U.S. shipping, taken off automatically. Ends Monday, Nov 30 at 11:59 PM.\n\nShop: ${shop}\n\nAlso this week: the Liquid Microneedling Series and gift cards ${BLACK_FRIDAY.gift.percent}% off with code ${BLACK_FRIDAY.gift.code}.\n\n${BUSINESS_ADDRESS}\nUnsubscribe: ${unsubscribe}`;
  return { subject, html, text };
}

/** Whether the "it's live" email should be going out at `now`. */
export function notifyDue(now, cfg) {
  return cfg.campaign === "sale" && now.getTime() >= Date.parse(BLACK_FRIDAY.notifyAtUtc);
}

/** Sends the next batch, within today's allowance. Called by the scheduled run. */
export async function sendSaleNotifications(env, { now = new Date(), fetchImpl = fetch } = {}) {
  const cfg = settings(env, now);
  if (!notifyDue(now, cfg)) return { sent: 0, reason: "not-due" };
  if (!sendingConfigured(env)) return { sent: 0, reason: "not-configured" };

  const usage = await usageSummary(env, { now });
  const room = Math.min(BATCH_SIZE, usage.today.limit - usage.today.sent, usage.month.limit - usage.month.sent);
  if (room <= 0) return { sent: 0, reason: "limit" };

  const { results: waiting } = await env.CLIENT_NOTES_DB.prepare(
    "SELECT email FROM notify_signups WHERE list = ? AND notified_at IS NULL AND error IS NULL ORDER BY created_at LIMIT ?",
  ).bind(NOTIFY_LIST, room).all();
  if (!waiting.length) return { sent: 0, reason: "empty" };

  const unsubscribed = await store.unsubscribedEmails(env);
  const stamp = now.toISOString();
  const skip = waiting.filter((row) => unsubscribed.has(row.email));
  for (const row of skip) {
    await env.CLIENT_NOTES_DB.prepare("UPDATE notify_signups SET error = 'Unsubscribed' WHERE list = ? AND email = ?").bind(NOTIFY_LIST, row.email).run();
  }
  const sending = waiting.filter((row) => !unsubscribed.has(row.email));
  if (!sending.length) return { sent: 0, reason: "empty" };

  const siteUrl = cfg.siteUrl;
  const from = env.CAMPAIGN_FROM_NAME ? `${env.CAMPAIGN_FROM_NAME} <${env.CAMPAIGN_FROM_EMAIL}>` : `Laura at Skin by Laura Lo <${env.CAMPAIGN_FROM_EMAIL}>`;
  const emails = [];
  for (const row of sending) {
    const unsubscribe = await unsubscribeUrl(env, row.email);
    const message = notifyEmail({ siteUrl, unsubscribe });
    emails.push({
      from, to: [row.email], reply_to: env.CAMPAIGN_REPLY_TO || SUPPORT_EMAIL,
      subject: message.subject, html: message.html, text: message.text,
      headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: [{ name: "notify", value: NOTIFY_LIST }],
    });
  }

  const response = await fetchImpl("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": `notify-${NOTIFY_LIST}-${sending.length}-${sending[0].email}-${sending[sending.length - 1].email}`.slice(0, 256),
      "x-batch-validation": "permissive",
    },
    body: JSON.stringify(emails),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`Notify batch failed (${response.status}): ${String(payload.message || payload.name || "").slice(0, 200)}`);
    return { sent: 0, reason: "provider-error" };
  }
  const errors = new Map((payload.errors || []).map((error) => [error.index, String(error.message || "Rejected").slice(0, 200)]));
  const ids = Array.isArray(payload.data) ? payload.data.map((entry) => entry.id) : [];
  const accepted = sending.map((_, index) => index).filter((index) => !errors.has(index));
  const idFor = new Map(ids.length === accepted.length ? accepted.map((index, position) => [index, ids[position]]) : []);
  let sent = 0;
  for (const [index, row] of sending.entries()) {
    if (errors.has(index)) {
      await env.CLIENT_NOTES_DB.prepare("UPDATE notify_signups SET error = ? WHERE list = ? AND email = ?").bind(errors.get(index), NOTIFY_LIST, row.email).run();
      continue;
    }
    await env.CLIENT_NOTES_DB.prepare("UPDATE notify_signups SET notified_at = ?, provider_id = ? WHERE list = ? AND email = ?")
      .bind(stamp, idFor.get(index) || null, NOTIFY_LIST, row.email).run();
    // Resend counts these against the same daily and monthly allowance.
    await store.recordOtherSend(env, "notify", now);
    sent += 1;
  }
  return { sent, failed: errors.size };
}
