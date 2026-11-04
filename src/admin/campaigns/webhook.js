// Resend's delivery webhook (POST /email/resend-webhook): tells us when each
// campaign email was delivered, opened, bounced or marked as spam, for the
// Scheduled page. Resend signs every request (Svix); RESEND_WEBHOOK_SECRET is
// the "whsec_..." signing secret from the webhook's page in Resend. Without it
// every request is refused.

import * as store from "./store.js";

const STATUS_BY_EVENT = {
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
};
// Requests older or newer than this are refused, so a captured one can't be replayed later.
const TOLERANCE_SECONDS = 5 * 60;

const encoder = new TextEncoder();

function base64Bytes(text) {
  const binary = atob(text);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesBase64(bytes) {
  let text = "";
  for (const byte of new Uint8Array(bytes)) text += String.fromCharCode(byte);
  return btoa(text);
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checks a Svix signature: HMAC-SHA256 of "id.timestamp.body" with the secret's bytes. */
export async function verifySignature({ secret, id, timestamp, signature, body, now = Date.now() }) {
  if (!secret || !id || !timestamp || !signature) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > TOLERANCE_SECONDS) return false;
  let keyBytes;
  try {
    keyBytes = base64Bytes(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = bytesBase64(await crypto.subtle.sign("HMAC", key, encoder.encode(`${id}.${timestamp}.${body}`)));
  // The header can hold several signatures ("v1,abc v1,def") while a secret is being rotated.
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    return version === "v1" && value && sameText(value, expected);
  });
}

/** The campaign id from the email's tags, which Resend sends as an object or a list. */
function campaignTag(tags) {
  if (Array.isArray(tags)) return tags.find((tag) => tag?.name === "campaign")?.value || null;
  return tags && typeof tags === "object" ? tags.campaign || null : null;
}

export async function handleResendWebhook(request, env, { now = Date.now() } = {}) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const body = await request.text();
  const ok = await verifySignature({
    secret: env.RESEND_WEBHOOK_SECRET,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
    now,
  });
  if (!ok) return new Response("Invalid signature", { status: 401 });

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const status = STATUS_BY_EVENT[event?.type];
  // Other events (email.sent, contacts, domains) are fine to ignore; a 200 stops Resend retrying them.
  if (!status) return new Response("Ignored", { status: 200 });
  const data = event.data || {};
  const to = Array.isArray(data.to) ? data.to[0] : data.to;
  const at = new Date(Date.parse(event.created_at || "") || now).toISOString();
  const updated = await store.applyDeliveryEvent(env, {
    providerId: data.email_id || null,
    campaignId: campaignTag(data.tags),
    email: typeof to === "string" ? to.replace(/^.*<([^>]+)>.*$/, "$1").trim() : "",
    status,
    at,
  });
  return new Response(updated ? "Updated" : "No matching email", { status: 200 });
}
