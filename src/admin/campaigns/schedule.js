// The scheduled run (every 15 minutes, see [triggers] in wrangler.toml):
//   1. sends the next queued campaign emails, within the daily limit;
//   2. on Tuesday and Thursday mornings, reminds Laura to write this week's
//      email, by phone notification and by email (with three topic ideas);
//   3. when there was nothing to send, refreshes a few clients' stored
//      purchases, so matching sees recent orders.

import { settings } from "../../config.js";
import { isConfigured } from "../../square.js";
import { loadClientOrders } from "../purchases.js";
import { suggestTopics } from "./ai.js";
import { escapeHtml } from "./email-template.js";
import { notifyPhones } from "./push.js";
import { sendingConfigured, sendQueued } from "./sending.js";
import * as store from "./store.js";

export const REMINDER_TIME_ZONE = "America/New_York";
export const REMINDER_DAYS = ["Tue", "Thu"];
const REMINDER_HOUR = 9;
const REFRESH_PER_RUN = 2;

/** Weekday, hour and date in Tampa's time zone. */
export function localTime(now, timeZone = REMINDER_TIME_ZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return { weekday: parts.weekday, hour: Number(parts.hour), date: `${parts.year}-${parts.month}-${parts.day}` };
}

export function reminderSettingKey(weekday) {
  return `reminder_${weekday.toLowerCase()}`;
}

/** Whether this run should send the reminder. Pure, for testing. */
export function reminderDue({ local, lastReminderDate, enabled }) {
  return REMINDER_DAYS.includes(local.weekday) && enabled
    && local.hour >= REMINDER_HOUR && local.hour < 20
    && lastReminderDate !== local.date;
}

async function recentNoteSnippets(env) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    "SELECT summary FROM notes WHERE summary IS NOT NULL AND summary != '' AND source != 'form' ORDER BY (note_date IS NULL), note_date DESC LIMIT 40",
  ).all();
  return results.map((row) => row.summary.replace(/\s+/g, " ").slice(0, 160));
}

async function campaignStartedToday(env, local) {
  const recent = await store.listCampaigns(env, 5);
  return recent.some((campaign) => localTime(new Date(`${campaign.created_at.replace(" ", "T")}Z`)).date === local.date);
}

async function sendReminderEmail(env, { local, ideas }) {
  if (!sendingConfigured(env) || !env.REMINDER_EMAIL) return false;
  const link = `${settings(env).siteUrl}/admin/campaigns/new`;
  const day = local.weekday === "Tue" ? "Tuesday" : "Thursday";
  const ideaHtml = ideas.length
    ? `<p style="margin:0 0 8px;">A few ideas from your recent client notes:</p><ul style="margin:0 0 18px;padding-left:20px;">${ideas.map((idea) => `<li style="margin:0 0 6px;">${escapeHtml(idea)}</li>`).join("")}</ul>`
    : "";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": `reminder-${local.date}` },
    body: JSON.stringify({
      from: `Laura Admin <${env.CAMPAIGN_FROM_EMAIL}>`,
      to: [env.REMINDER_EMAIL],
      subject: `It's ${day}: time for this week's client email`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#2A241F;max-width:520px;">
<p style="margin:0 0 14px;">Hi Laura, it's ${day}. Time to write this week's email to your clients.</p>
${ideaHtml}<p style="margin:0 0 18px;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#B8714F;color:#FFF8F2;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:10px;">Write the email</a></p>
<p style="margin:0;font-size:13px;color:#6E6358;">You can switch these reminders off on the Campaigns page.</p></div>`,
      text: `Hi Laura, it's ${day}. Time to write this week's email to your clients.\n\n${ideas.length ? `Ideas from your recent client notes:\n${ideas.map((idea) => `- ${idea}`).join("\n")}\n\n` : ""}Write the email: ${link}`,
    }),
  });
  if (!response.ok) console.error(`Reminder email failed (${response.status})`);
  return response.ok;
}

/** Sends the Tuesday/Thursday reminder once that day. Returns what was done. */
export async function maybeRemind(env, now) {
  const local = localTime(now);
  if (!REMINDER_DAYS.includes(local.weekday)) return { reminded: false };
  const [enabled, lastReminderDate] = await Promise.all([
    store.getSetting(env, reminderSettingKey(local.weekday), "on"),
    store.getSetting(env, "last_reminder_date"),
  ]);
  if (!reminderDue({ local, lastReminderDate, enabled: enabled !== "off" })) return { reminded: false };
  // Marked first, so a slow or failing run can't remind twice.
  await store.setSetting(env, "last_reminder_date", local.date);
  if (await campaignStartedToday(env, local)) return { reminded: false, reason: "already-started" };

  const phones = await notifyPhones(env).catch((error) => { console.error("Reminder push failed:", error.message); return 0; });
  let ideas = [];
  if (env.ANTHROPIC_API_KEY && env.REMINDER_EMAIL) {
    try {
      const monthName = now.toLocaleDateString("en-US", { month: "long", timeZone: REMINDER_TIME_ZONE });
      ideas = await suggestTopics(env, { noteSnippets: await recentNoteSnippets(env), monthName });
    } catch (error) {
      console.error("Topic ideas failed:", error.message);
    }
  }
  const emailed = await sendReminderEmail(env, { local, ideas }).catch((error) => { console.error("Reminder email failed:", error.message); return false; });
  return { reminded: true, phones, emailed };
}

/** Refreshes the stored purchases of the clients that were copied longest ago (or never). */
async function refreshStalePurchases(env) {
  if (!isConfigured(env)) return 0;
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    `SELECT c.id, c.name, c.square_customer_id FROM clients c LEFT JOIN client_purchase_syncs s ON s.client_id = c.id
     WHERE c.square_customer_id IS NOT NULL AND (s.synced_at IS NULL OR s.synced_at < datetime('now', '-1 day'))
     ORDER BY (s.synced_at IS NOT NULL), s.synced_at LIMIT ?`,
  ).bind(REFRESH_PER_RUN).all();
  for (const client of results) {
    await loadClientOrders(env, client, { refresh: true }).catch((error) => console.error("Purchase refresh failed:", error.message));
  }
  return results.length;
}

export async function runScheduled(env, now = new Date()) {
  const outcome = {};
  try {
    outcome.sending = await sendQueued(env, { now });
  } catch (error) {
    console.error("Sending campaign emails failed:", error.message);
  }
  try {
    outcome.reminder = await maybeRemind(env, now);
  } catch (error) {
    console.error("Reminder failed:", error.message);
  }
  if (!outcome.sending?.sent) {
    try {
      outcome.refreshed = await refreshStalePurchases(env);
    } catch (error) {
      console.error("Purchase refresh failed:", error.message);
    }
  }
  return outcome;
}
