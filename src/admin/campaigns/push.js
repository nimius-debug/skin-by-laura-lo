// Phone notifications for the email reminders (Web Push). On an iPhone this
// works for the Home Screen app: Laura turns it on once from the Campaigns
// page, and the reminder shows up like any app notification.
//
// The push carries no data. Before waking the phones, the message is saved
// here; the app's service worker then asks the dashboard (signed in) what to
// show. So nothing needs encrypting and no client names ever pass through
// Apple's or Google's push servers. Used by the email reminders and by the
// missing-note reminders (see ../note-reminders.js).
//
// The signing keys (VAPID) are made on first use and kept in admin_settings;
// the phones' subscriptions and the recent messages are kept there too.

import { SUPPORT_EMAIL } from "../../config.js";
import { getSetting, setSetting } from "./store.js";

const encoder = new TextEncoder();
const MAX_SUBSCRIPTIONS = 5;

function base64url(bytes) {
  let text = "";
  for (const byte of new Uint8Array(bytes)) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function vapidKeys(env) {
  const saved = await getSetting(env, "vapid_keys");
  if (saved) return JSON.parse(saved);
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const keys = {
    publicKey: base64url(await crypto.subtle.exportKey("raw", pair.publicKey)),
    privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey),
  };
  await env.CLIENT_NOTES_DB.prepare("INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('vapid_keys', ?)").bind(JSON.stringify(keys)).run();
  return JSON.parse(await getSetting(env, "vapid_keys"));
}

/** The public key the phone needs to subscribe. */
export async function pushPublicKey(env) {
  return (await vapidKeys(env)).publicKey;
}

export async function listSubscriptions(env) {
  try {
    const list = JSON.parse((await getSetting(env, "push_subscriptions")) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function validSubscription(value) {
  try {
    const url = new URL(value?.endpoint);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Saves a phone's subscription. The newest few are kept. */
export async function addSubscription(env, subscription) {
  if (!validSubscription(subscription)) throw new Error("That notification subscription isn't valid.");
  const others = (await listSubscriptions(env)).filter((entry) => entry.endpoint !== subscription.endpoint);
  const list = [{ endpoint: subscription.endpoint, addedAt: new Date().toISOString() }, ...others].slice(0, MAX_SUBSCRIPTIONS);
  await setSetting(env, "push_subscriptions", JSON.stringify(list));
  return list.length;
}

export async function removeSubscription(env, endpoint) {
  const list = (await listSubscriptions(env)).filter((entry) => entry.endpoint !== endpoint);
  await setSetting(env, "push_subscriptions", JSON.stringify(list));
}

async function vapidHeader(keys, endpoint, now) {
  const header = base64url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64url(encoder.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: `mailto:${SUPPORT_EMAIL}`,
  })));
  const key = await crypto.subtle.importKey("jwk", keys.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${base64url(signature)}, k=${keys.publicKey}`;
}

// A push can reach a phone that was off hours later, so messages are kept as long as a push lives (its ttl).
const MESSAGE_LIFETIME_MS = 12 * 60 * 60 * 1000;
const MAX_MESSAGES = 30;

/**
 * The messages saved in the last 12 hours, newest first: [{ id, title, body, url, writeUrl?, at }].
 * The service worker shows the ones it hasn't shown yet.
 */
export async function recentMessages(env, { now = Date.now() } = {}) {
  let list;
  try {
    list = JSON.parse((await getSetting(env, "push_messages")) || "[]");
  } catch {
    list = [];
  }
  return (Array.isArray(list) ? list : []).filter((message) => now - Date.parse(message.at) < MESSAGE_LIFETIME_MS);
}

/** Saves messages for the service worker to fetch. A message with an id already saved replaces it. */
export async function saveMessages(env, messages, { now = Date.now() } = {}) {
  const at = new Date(now).toISOString();
  const ids = new Set(messages.map((message) => message.id));
  const kept = (await recentMessages(env, { now })).filter((message) => !ids.has(message.id));
  const list = [...messages.map((message) => ({ ...message, at })), ...kept].slice(0, MAX_MESSAGES);
  await setSetting(env, "push_messages", JSON.stringify(list));
}

/** Saves `messages`, then wakes every subscribed phone to show them. Subscriptions the push service says are gone are removed. Returns how many were reached. */
export async function notifyPhones(env, { messages = [], now = Date.now(), fetchImpl = fetch } = {}) {
  const subscriptions = await listSubscriptions(env);
  if (!subscriptions.length) return 0;
  if (messages.length) await saveMessages(env, messages, { now });
  const keys = await vapidKeys(env);
  let reached = 0;
  for (const subscription of subscriptions) {
    try {
      const response = await fetchImpl(subscription.endpoint, {
        method: "POST",
        headers: { authorization: await vapidHeader(keys, subscription.endpoint, now), ttl: "43200", urgency: "normal", "content-length": "0" },
      });
      if (response.status === 404 || response.status === 410) await removeSubscription(env, subscription.endpoint);
      else if (response.ok) reached += 1;
      else console.error(`Push failed (${response.status})`);
    } catch (error) {
      console.error("Push failed:", error.message);
    }
  }
  return reached;
}
