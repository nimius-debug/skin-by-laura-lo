// Sending a campaign through Resend (Square has no API for its marketing
// emails). Approving a campaign puts one email per client in a queue; the
// scheduled run sends from that queue, at most EMAIL_DAILY_LIMIT a day (Resend's
// free plan allows 100), so a long list goes out over the following days.
//
// Everyone with an email in Square gets the email, except people who
// unsubscribed (here or in Square). A client with an approved personal version
// gets that; everyone else gets the shared version.

import { settings, SUPPORT_EMAIL } from "../../config.js";
import { isConfigured, squareGet } from "../../square.js";
import { renderEmail } from "./email-template.js";
import { firstNameOf } from "./matching.js";
import * as store from "./store.js";

const DEFAULT_DAILY_LIMIT = 95;
const BATCH_SIZE = 95; // Resend takes up to 100 emails in one request.
const EMAIL_PATTERN = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

export function dailyLimit(env) {
  const value = Number(env.EMAIL_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
}

export function sendingConfigured(env) {
  return Boolean(env.RESEND_API_KEY && env.CAMPAIGN_FROM_EMAIL);
}

// --- unsubscribe links ---------------------------------------------------------

const encoder = new TextEncoder();

function base64url(bytes) {
  let text = "";
  for (const byte of new Uint8Array(bytes)) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The key that signs unsubscribe links: EMAIL_LINK_SECRET if set, else one made once and kept in the database. */
async function linkSecret(env) {
  if (env.EMAIL_LINK_SECRET) return env.EMAIL_LINK_SECRET;
  const saved = await store.getSetting(env, "email_link_secret");
  if (saved) return saved;
  const made = base64url(crypto.getRandomValues(new Uint8Array(32)));
  await env.CLIENT_NOTES_DB.prepare("INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('email_link_secret', ?)").bind(made).run();
  // Another run may have saved one first; always use the stored one.
  return store.getSetting(env, "email_link_secret");
}

/** Signs addresses with one key, so a run sending many emails reads and imports it once. */
async function emailSigner(env) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(await linkSecret(env)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return async (email) => base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(`unsubscribe:${email.toLowerCase()}`)));
}

async function signEmail(env, email) {
  return (await emailSigner(env))(email);
}

function unsubscribeLink(siteUrl, email, token) {
  return `${siteUrl}/email/unsubscribe?e=${encodeURIComponent(email.toLowerCase())}&t=${token}`;
}

export async function unsubscribeUrl(env, email) {
  return unsubscribeLink(settings(env).siteUrl, email, await signEmail(env, email));
}

export async function verifyUnsubscribe(env, email, token) {
  if (!email || !token) return false;
  const expected = await signEmail(env, email);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

// --- who gets it ---------------------------------------------------------------

/** Everyone in Square with a usable email who hasn't unsubscribed there: [{ email, firstName, squareCustomerId }]. */
export async function loadSquareRecipients(env) {
  if (!isConfigured(env)) throw new Error("Square is not connected, so there is no client list to send to.");
  const byEmail = new Map();
  let cursor;
  let pages = 0;
  do {
    const payload = await squareGet(env, "/v2/customers", { limit: 100, cursor });
    for (const customer of payload.customers || []) {
      const email = String(customer.email_address || "").trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email) || customer.preferences?.email_unsubscribed) continue;
      if (!byEmail.has(email)) byEmail.set(email, { email, firstName: firstNameOf(customer.given_name), squareCustomerId: customer.id });
    }
    cursor = payload.cursor;
    pages += 1;
  } while (cursor && pages < 30);
  return [...byEmail.values()];
}

/**
 * Who gets which version: an approved personal version for that client, else the shared one.
 * Pure, so it can be tested without Square or a database.
 */
export function planSends({ recipients, versions, clients, unsubscribed }) {
  const shared = versions.find((version) => version.isShared);
  const clientBySquareId = new Map(clients.filter((client) => client.square_customer_id).map((client) => [client.square_customer_id, client]));
  const personalByClient = new Map(versions.filter((version) => !version.isShared && version.status === "approved").map((version) => [version.client_id, version]));
  const sends = [];
  for (const recipient of recipients) {
    if (unsubscribed.has(recipient.email)) continue;
    const client = clientBySquareId.get(recipient.squareCustomerId) || null;
    const personal = client ? personalByClient.get(client.id) : null;
    sends.push({
      versionId: personal ? personal.id : shared.id,
      clientId: client?.id || null,
      email: recipient.email,
      firstName: recipient.firstName || firstNameOf(client?.name),
      personal: Boolean(personal),
    });
  }
  return sends;
}

/** Puts the approved campaign in the send queue. Returns { queued, personal }. */
export async function queueCampaign(env, campaignId) {
  const versions = await store.listVersions(env, campaignId);
  const shared = versions.find((version) => version.isShared);
  if (!shared || shared.status !== "approved") throw new Error("Approve the email everyone else gets before sending.");
  const [recipients, { results: clients }, unsubscribed] = await Promise.all([
    loadSquareRecipients(env),
    env.CLIENT_NOTES_DB.prepare("SELECT id, name, square_customer_id FROM clients").all(),
    store.unsubscribedEmails(env),
  ]);
  const sends = planSends({ recipients, versions, clients, unsubscribed });
  if (!sends.length) throw new Error("No one in Square has an email address to send to.");
  await store.enqueueSends(env, campaignId, sends);
  await store.updateCampaign(env, campaignId, { status: "sending" });
  return { queued: sends.length, personal: sends.filter((send) => send.personal).length };
}

// --- sending -------------------------------------------------------------------

function utcDayStart(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** The finished email for one queued send. */
export function buildMessage({ campaign, version, send, siteUrl, unsubscribe, editable = null }) {
  const personal = version && !version.isShared ? version.personal : null;
  const product = personal?.product || campaign.content.product || null;
  return renderEmail({
    content: campaign.content,
    personal,
    product,
    firstName: send.first_name,
    goal: campaign.goal,
    siteUrl,
    unsubscribeUrl: unsubscribe,
    editable,
  });
}

async function hashText(text) {
  return base64url(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

/**
 * Sends the next queued emails, up to what today's limit leaves. Called by the
 * scheduled run, and once right after Laura presses Send.
 * Returns { sent, failed, skipped, left, reason }.
 */
export async function sendQueued(env, { now = new Date(), fetchImpl = fetch } = {}) {
  const result = { sent: 0, failed: 0, skipped: 0, left: 0, reason: "" };
  if (!sendingConfigured(env)) return { ...result, reason: "not-configured" };

  const sentToday = await store.countSentSince(env, utcDayStart(now));
  const room = Math.min(dailyLimit(env) - sentToday, BATCH_SIZE);
  if (room <= 0) return { ...result, reason: "daily-limit" };

  const queued = await store.nextQueued(env, room);
  if (!queued.length) return { ...result, reason: "empty" };

  const unsubscribed = await store.unsubscribedEmails(env);
  const campaigns = new Map();
  const versions = new Map();
  const siteUrl = settings(env).siteUrl;
  const from = env.CAMPAIGN_FROM_NAME ? `${env.CAMPAIGN_FROM_NAME} <${env.CAMPAIGN_FROM_EMAIL}>` : `Laura at Skin by Laura Lo <${env.CAMPAIGN_FROM_EMAIL}>`;
  const replyTo = env.CAMPAIGN_REPLY_TO || SUPPORT_EMAIL;

  const sign = await emailSigner(env);
  const outgoing = [];
  const marks = [];
  for (const send of queued) {
    if (unsubscribed.has(send.email)) {
      marks.push({ id: send.id, status: "skipped", error: "Unsubscribed" });
      continue;
    }
    if (!campaigns.has(send.campaign_id)) campaigns.set(send.campaign_id, await store.getCampaign(env, send.campaign_id));
    if (!versions.has(send.version_id)) versions.set(send.version_id, await store.getVersion(env, send.version_id));
    const campaign = campaigns.get(send.campaign_id);
    const version = versions.get(send.version_id);
    if (!campaign || !version) {
      marks.push({ id: send.id, status: "failed", error: "Campaign or version missing" });
      continue;
    }
    const unsubscribe = unsubscribeLink(siteUrl, send.email, await sign(send.email));
    const message = buildMessage({ campaign, version, send, siteUrl, unsubscribe });
    outgoing.push({
      send,
      email: {
        from,
        to: [send.email],
        reply_to: replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        tags: [{ name: "campaign", value: send.campaign_id }],
      },
    });
  }

  if (outgoing.length) {
    const response = await fetchImpl("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
        // The same batch sent again within a day (say, after a crash) is not delivered twice.
        "idempotency-key": `campaign-batch-${await hashText(outgoing.map((item) => item.send.id).join(","))}`,
        // One bad address shouldn't hold back everyone else's email.
        "x-batch-validation": "permissive",
      },
      body: JSON.stringify(outgoing.map((item) => item.email)),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Leave everything queued; the next run tries again. Logged without the key.
      console.error(`Resend batch failed (${response.status}): ${String(payload.message || payload.name || "").slice(0, 200)}`);
      if (marks.length) await applyMarks(env, marks, now);
      return { ...result, skipped: marks.filter((mark) => mark.status === "skipped").length, left: await store.countQueued(env), reason: "provider-error" };
    }
    const errors = new Map((payload.errors || []).map((error) => [error.index, String(error.message || "Rejected").slice(0, 200)]));
    const ids = Array.isArray(payload.data) ? payload.data.map((entry) => entry.id) : [];
    const accepted = outgoing.map((_, index) => index).filter((index) => !errors.has(index));
    // Resend returns ids for the accepted emails in order; only trust that pairing when the counts agree.
    const idFor = new Map(ids.length === accepted.length ? accepted.map((index, position) => [index, ids[position]]) : []);
    outgoing.forEach((item, index) => {
      if (errors.has(index)) marks.push({ id: item.send.id, status: "failed", error: errors.get(index) });
      else marks.push({ id: item.send.id, status: "sent", providerId: idFor.get(index) || null });
    });
  }

  await applyMarks(env, marks, now);
  for (const mark of marks) result[mark.status] += 1;
  result.left = await store.countQueued(env);

  // A campaign with nothing left in the queue is finished.
  for (const campaignId of new Set(queued.map((send) => send.campaign_id))) {
    const counts = await store.sendCounts(env, campaignId);
    if (!counts.queued) await store.updateCampaign(env, campaignId, { status: "sent" });
  }
  return result;
}

async function applyMarks(env, marks, now) {
  const db = env.CLIENT_NOTES_DB;
  const sentAt = now.toISOString();
  await db.batch(marks.map((mark) => db.prepare(
    "UPDATE email_sends SET status = ?, provider_id = ?, error = ?, sent_at = ? WHERE id = ?",
  ).bind(mark.status, mark.providerId || null, mark.error || null, mark.status === "sent" ? sentAt : null, mark.id)));
}

/** A test email of one version to Laura, so she can see it in a real inbox. */
export async function sendTestEmail(env, { campaign, version, to, fetchImpl = fetch }) {
  if (!sendingConfigured(env)) throw new Error("Email sending isn't set up yet (RESEND_API_KEY and CAMPAIGN_FROM_EMAIL).");
  const firstName = version.isShared ? "" : firstNameOf(version.client_name);
  const message = buildMessage({
    campaign, version, send: { first_name: firstName }, siteUrl: settings(env).siteUrl,
    unsubscribe: `${settings(env).siteUrl}/email/unsubscribe`,
  });
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: `Skin by Laura Lo <${env.CAMPAIGN_FROM_EMAIL}>`, to: [to], subject: `[Test] ${message.subject}`, html: message.html, text: message.text }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(`Resend said no (${response.status}): ${String(payload.message || "").slice(0, 200)}`);
  }
}

/** About how many people a campaign goes to. Read from Square at most every 6 hours; null if it can't be read. */
export async function recipientEstimate(env, { now = Date.now() } = {}) {
  try {
    const saved = JSON.parse((await store.getSetting(env, "recipient_estimate")) || "null");
    if (saved && now - saved.at < 6 * 60 * 60 * 1000) return saved.count;
    const [recipients, unsubscribed] = await Promise.all([loadSquareRecipients(env), store.unsubscribedEmails(env)]);
    const count = recipients.filter((recipient) => !unsubscribed.has(recipient.email)).length;
    await store.setSetting(env, "recipient_estimate", JSON.stringify({ count, at: now }));
    return count;
  } catch (error) {
    console.error("Counting recipients failed:", error.message);
    return null;
  }
}
