// Sending a campaign through Square Marketing by hand. Square has no API that
// sends marketing email, so the admin does the parts it can: it puts the people
// Laura picked into a Square customer group, and lays the email out in pieces she
// can copy into Square's editor. She sends it there, to that group.
//
// mode "square": everyone picked gets it from Square.
// mode "split":  half get it from Square, the other half from Resend, so the two
//                can be compared. The halves are fixed per campaign (a hash of the
//                email), so syncing again never moves anyone across.
//
// What Square can't do: first names, personal notes, or per-person products.
// Everyone in the Square half gets the shared email.

import { settings } from "../../config.js";
import { squareFetch, squareRequest } from "../../square.js";
import { contentProducts, defaultButtonLabel, defaultButtonUrl, plain } from "./email-template.js";
import { loadSquareRecipients, queueCampaign } from "./sending.js";
import * as store from "./store.js";

// Square calls per request. Workers allow 50 outbound calls a request on the free plan.
export const SYNC_BATCH = 40;
export const MODES = ["square", "split"];

/** A small stable hash (FNV-1a), so a split is the same every time it's worked out. */
function hash(text) {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/**
 * Splits people into two even halves, mixed at random but the same for the same
 * campaign. Returns { resend: [...], square: [...] }.
 */
export function splitHalves(people, salt) {
  const order = [...people].sort((a, b) => hash(`${salt}:${a.email}`) - hash(`${salt}:${b.email}`) || a.email.localeCompare(b.email));
  const halves = { resend: [], square: [] };
  order.forEach((person, index) => halves[index % 2 ? "resend" : "square"].push(person));
  return halves;
}

/** "Email · Holiday skin · Nov 25", the group's name in Square. */
export function groupName(campaign, now = new Date()) {
  const topic = String(campaign.content?.eyebrow || campaign.topic || "Campaign").replace(/^this week:\s*/i, "").trim();
  const day = now.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
  return `Email · ${topic.slice(0, 40)} · ${day}`;
}

/**
 * Who goes where, without touching Square: everyone picked who has an email in
 * Square and hasn't unsubscribed here. Pure, so it can be tested.
 */
export function planHandoff({ recipients, unsubscribed, picked, mode, salt }) {
  const only = picked ? new Set(picked) : null;
  const people = recipients.filter((person) => person.squareCustomerId && !unsubscribed.has(person.email) && (!only || only.has(person.email)));
  if (mode !== "split") return { square: people, resend: [] };
  return splitHalves(people, salt);
}

/** Starts (or restarts) the hand-off: works out who goes to Square and saves it. Nothing is sent to Square yet. */
export async function startHandoff(env, campaignId, mode, { now = new Date() } = {}) {
  if (!MODES.includes(mode)) throw new Error("Pick Square or a split.");
  const [campaign, versions] = await Promise.all([store.getCampaign(env, campaignId), store.listVersions(env, campaignId)]);
  if (!campaign) throw new Error("That email doesn't exist.");
  if (campaign.status !== "review") throw new Error("This email has already gone out.");
  const shared = versions.find((version) => version.isShared);
  if (!shared || shared.status !== "approved") throw new Error("Approve the email everyone else gets first.");
  const [recipients, unsubscribed] = await Promise.all([loadSquareRecipients(env), store.unsubscribedEmails(env)]);
  const plan = planHandoff({ recipients, unsubscribed, picked: campaign.audience.emails, mode, salt: campaignId });
  if (!plan.square.length) throw new Error("None of the people picked can get this email (no email in Square, or unsubscribed).");
  const square = {
    mode,
    groupId: null,
    groupName: groupName(campaign, now),
    customerIds: plan.square.map((person) => person.squareCustomerId),
    added: 0,
    failed: 0,
    resendEmails: plan.resend.map((person) => person.email),
    personalInResend: 0,
    startedAt: now.toISOString(),
    syncedAt: null,
    sentAt: null,
  };
  await store.updateCampaign(env, campaignId, { square });
  return square;
}

/**
 * Adds the next SYNC_BATCH people to the Square group, making the group first if
 * needed. Call it until `done`. Returns the saved state plus { done }.
 */
export async function syncBatch(env, campaignId, { now = new Date() } = {}) {
  const campaign = await store.getCampaign(env, campaignId);
  const square = campaign?.square;
  if (!square) throw new Error("Pick Square or a split first.");
  let calls = 0;
  if (!square.groupId) {
    const made = await squareFetch(env, "/v2/customers/groups", { idempotency_key: `${campaignId}-${square.startedAt}`, group: { name: square.groupName } });
    square.groupId = made.group?.id;
    if (!square.groupId) throw new Error("Square didn't make the group. Try again.");
    calls += 1;
    await store.updateCampaign(env, campaignId, { square });
  }
  const next = square.customerIds.slice(square.added, square.added + SYNC_BATCH - calls);
  for (const customerId of next) {
    try {
      await squareRequest(env, "PUT", `/v2/customers/${encodeURIComponent(customerId)}/groups/${encodeURIComponent(square.groupId)}`);
    } catch (error) {
      // A missing permission stops the whole sync; a customer deleted in Square is just skipped.
      if (error.status === 401 || error.status === 403) throw new Error("The Square connection can't edit customer groups. It needs the Customers write permission.");
      console.error("Adding a customer to the Square group failed:", error.message);
      square.failed = (square.failed || 0) + 1;
    }
    square.added += 1;
  }
  const done = square.added >= square.customerIds.length;
  if (done) square.syncedAt = now.toISOString();
  await store.updateCampaign(env, campaignId, { square });
  return { ...square, done };
}

/**
 * Laura sent it in Square. A split also queues the Resend half now, so both
 * halves go out the same day. Returns { queued, personal } for the Resend half.
 */
export async function markSentInSquare(env, campaignId, { now = new Date() } = {}) {
  const campaign = await store.getCampaign(env, campaignId);
  const square = campaign?.square;
  if (!square?.syncedAt) throw new Error("Finish putting people in the Square group first.");
  if (campaign.status !== "review") return { queued: 0, personal: 0 };
  square.sentAt = now.toISOString();
  let result = { queued: 0, personal: 0 };
  if (square.mode === "split" && square.resendEmails.length) {
    result = await queueCampaign(env, campaignId, { only: square.resendEmails });
    square.personalInResend = result.personal;
    await store.updateCampaign(env, campaignId, { square });
  } else {
    await store.updateCampaign(env, campaignId, { square, status: "sent" });
  }
  return result;
}

/** Back to Resend only. The Square group stays in Square (Laura can delete it there). */
export async function cancelHandoff(env, campaignId) {
  const campaign = await store.getCampaign(env, campaignId);
  if (!campaign || campaign.square?.sentAt) return;
  await store.updateCampaign(env, campaignId, { square: null });
}

/**
 * The shared email in pieces for Square's editor: subject, preview line, headline,
 * the body as plain text (greeting with no name, since Square can't add one),
 * the button, and the products. Square adds its own footer and unsubscribe link.
 */
export function copyParts(campaign, siteUrl) {
  const content = campaign.content || {};
  const greeting = `${content.greeting?.trim() || "Hi"} ${content.fallbackName?.trim() || "there"},`;
  const paragraphs = (content.paragraphs || []).filter(Boolean).map(plain);
  const tips = (content.tips || []).filter(Boolean).map((tip, index) => `${index + 1}. ${plain(tip)}`);
  const body = [
    greeting,
    ...paragraphs,
    ...(tips.length ? [[content.tipsTitle || "What helps", ...tips].join("\n")] : []),
    [content.signoff?.trim() || "See you soon,", content.signName?.trim() || "Laura"].join("\n"),
    ...(content.ps ? [`P.S. ${plain(content.ps)}`] : []),
  ].join("\n\n");
  const label = content.buttonLabel?.trim() || defaultButtonLabel(campaign.goal);
  const url = content.buttonUrl?.trim() || defaultButtonUrl(siteUrl, campaign.goal);
  return {
    subject: content.subject || "",
    preheader: content.preheader || "",
    headline: content.headline || "",
    body,
    button: label && url ? { label, url } : null,
    products: contentProducts(content).map((product) => ({ name: product.name, price: product.price || "", url: product.url || "", image: product.image || "" })),
  };
}

export function siteUrlOf(env) {
  return settings(env).siteUrl;
}
