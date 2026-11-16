// Black Friday gift card bonus, added automatically.
//
// Gift cards are sold on Square's own eGift page, so this site never sees the
// purchase. Square tells it instead: a webhook (POST /square/webhook) fires
// for every gift card activity. When a card is bought or topped up for exactly
// $100, $200 or $300 during the campaign, the bonus ($15, $25 or $50) is added
// to that same card, so the buyer sees one balance: $115, $225 or $350.
//
// A bonus is never added twice. Each purchase is recorded once by Square's own
// activity id, and the request to Square carries an idempotency key built
// from that id, so even a repeated or retried webhook is the same request.
//
// Setup: a webhook subscription in the Square Developer Dashboard for the
// event gift_card.activity.created, and its signature key in the
// SQUARE_WEBHOOK_SIGNATURE_KEY secret. Without the secret every request is
// refused.

import { BLACK_FRIDAY, campaignPhase, localStamp } from "./campaign.js";
import { squareFetch, isConfigured } from "./square.js";

const encoder = new TextEncoder();
const BONUS_BY_PAID = new Map(BLACK_FRIDAY.giftCards.map((card) => [card.payCents, card.valueCents - card.payCents]));

const TABLE = `CREATE TABLE IF NOT EXISTS gift_card_bonuses (
  source_activity_id TEXT PRIMARY KEY, gift_card_id TEXT NOT NULL, card_last4 TEXT, kind TEXT NOT NULL,
  paid_cents INTEGER NOT NULL, bonus_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  bonus_activity_id TEXT, balance_cents INTEGER, error TEXT, purchased_at TEXT NOT NULL, updated_at TEXT NOT NULL)`;

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Square signs each webhook: base64 HMAC-SHA256 of the notification URL followed by the raw body. */
export async function validSquareSignature(secret, notificationUrl, body, signature) {
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(notificationUrl + body));
  let expected = "";
  for (const byte of new Uint8Array(mac)) expected += String.fromCharCode(byte);
  return sameText(btoa(expected), signature);
}

/** Is this purchase inside the campaign? Judged by when it was made, not when the webhook arrived. */
function inWindow(env, purchasedAt) {
  if (String(env.BLACK_FRIDAY_ENABLED).toLowerCase() !== "true") return false;
  const timeZone = env.STORE_TIMEZONE || "America/New_York";
  if (campaignPhase(purchasedAt, timeZone)) return true;
  // One rehearsal day before the campaign, e.g. "2026-11-19", so the whole
  // flow can be tested with a real purchase. It can never reach past Nov 30.
  const testDay = String(env.GIFT_BONUS_TEST_DAY || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(testDay)
    && `${testDay} 00:00:00` < BLACK_FRIDAY.start
    && localStamp(purchasedAt, timeZone).slice(0, 10) === testDay;
}

/** What a gift card activity earns: { paidCents, bonusCents } or null. */
export function bonusFor(env, activity) {
  // Only money put on a card by a purchase. Never the bonus itself
  // (ADJUST_INCREMENT), a refund, a redemption or anything else.
  const details = activity?.type === "ACTIVATE" ? activity.activate_activity_details
    : activity?.type === "LOAD" ? activity.load_activity_details
      : null;
  const money = details?.amount_money;
  if (!money || money.currency !== "USD") return null;
  const paidCents = Number(money.amount);
  const bonusCents = BONUS_BY_PAID.get(paidCents);
  if (!bonusCents) return null;
  const purchasedAt = new Date(activity.created_at);
  if (Number.isNaN(purchasedAt.getTime()) || !inWindow(env, purchasedAt)) return null;
  return { paidCents, bonusCents };
}

let tableReady = false;
async function record(env) {
  const db = env.CLIENT_NOTES_DB;
  if (!db) return null;
  if (!tableReady) {
    await db.prepare(TABLE).run();
    tableReady = true;
  }
  return db;
}

/**
 * Add the bonus for one purchase activity. Safe to call any number of times
 * for the same activity. Returns what happened, for the log and the tests.
 */
export async function addBonus(env, activity) {
  const earned = bonusFor(env, activity);
  if (!earned) return { outcome: "ignored" };

  const now = new Date().toISOString();
  // The record is a second lock and the paper trail. If the database is
  // unreachable the bonus still goes out, guarded by Square's idempotency key.
  let db = null;
  try {
    db = await record(env);
    if (db) {
      await db.prepare(
        `INSERT OR IGNORE INTO gift_card_bonuses
           (source_activity_id, gift_card_id, card_last4, kind, paid_cents, bonus_cents, status, purchased_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      ).bind(activity.id, activity.gift_card_id, String(activity.gift_card_gan || "").slice(-4) || null, activity.type,
        earned.paidCents, earned.bonusCents, activity.created_at, now).run();
      const row = await db.prepare("SELECT status FROM gift_card_bonuses WHERE source_activity_id = ?").bind(activity.id).first();
      if (row?.status === "added") return { outcome: "already-added", ...earned };
    }
  } catch (error) {
    console.error("Gift card bonus record unavailable, relying on Square's idempotency key:", error.message);
    db = null;
  }

  try {
    const result = await squareFetch(env, "/v2/gift-cards/activities", {
      // The same key for the same purchase, always: Square returns the first
      // result instead of adding the money again.
      idempotency_key: `bf2026-bonus-${activity.id}`,
      gift_card_activity: {
        type: "ADJUST_INCREMENT",
        location_id: activity.location_id || env.SQUARE_LOCATION_ID,
        gift_card_id: activity.gift_card_id,
        adjust_increment_activity_details: {
          amount_money: { amount: earned.bonusCents, currency: "USD" },
          reason: "COMPLIMENTARY",
        },
      },
    });
    const bonus = result.gift_card_activity || {};
    if (db) {
      await db.prepare(
        "UPDATE gift_card_bonuses SET status = 'added', bonus_activity_id = ?, balance_cents = ?, error = NULL, updated_at = ? WHERE source_activity_id = ?",
      ).bind(bonus.id || null, Number(bonus.gift_card_balance_money?.amount) || null, now, activity.id).run()
        .catch((error) => console.error("Gift card bonus added but not recorded:", error.message));
    }
    console.log(`Gift card bonus added: paid ${earned.paidCents}, bonus ${earned.bonusCents}, card ${activity.gift_card_id}, purchase ${activity.id}`);
    return { outcome: "added", ...earned };
  } catch (error) {
    if (db) {
      await db.prepare("UPDATE gift_card_bonuses SET status = 'failed', error = ?, updated_at = ? WHERE source_activity_id = ?")
        .bind(String(error.message).slice(0, 500), now, activity.id).run().catch(() => {});
    }
    throw error;
  }
}

/** POST /square/webhook */
export async function handleSquareWebhook(request, env) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const body = await request.text();
  const signed = await validSquareSignature(
    env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    // Must be the exact address entered in Square. Set SQUARE_WEBHOOK_URL
    // only if Square reaches the Worker through a different address.
    env.SQUARE_WEBHOOK_URL || request.url,
    body,
    request.headers.get("x-square-hmacsha256-signature"),
  );
  if (!signed) return new Response("Invalid signature", { status: 401 });

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  // Anything else Square is subscribed to send is acknowledged and dropped.
  if (event?.type !== "gift_card.activity.created" || !isConfigured(env)) return new Response("ok");

  try {
    const { outcome } = await addBonus(env, event.data?.object?.gift_card_activity);
    return new Response(outcome);
  } catch (error) {
    // A 5xx makes Square deliver the event again later, and the retry is safe.
    console.error("Gift card bonus failed, Square will retry:", error.message);
    return new Response("Bonus failed, please retry", { status: 500 });
  }
}
