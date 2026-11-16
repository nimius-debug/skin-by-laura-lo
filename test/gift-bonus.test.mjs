// The Black Friday gift card bonus: Square's webhook in, one bonus out, never twice.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
import { createD1 } from "./helpers/d1-sqlite.mjs";

const KEY = "sig-key";
const URL_ = "https://skinbylauralo.com/square/webhook";
const d1 = createD1({ migrations: [readFileSync(new URL("../migrations/0011_gift_card_bonuses.sql", import.meta.url), "utf8")] });

let bonusCalls = [];
let failNext = false;
globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  if (path !== "/v2/gift-cards/activities") throw new Error("unexpected " + path);
  if (failNext) { failNext = false; return new Response(JSON.stringify({ errors: [{ detail: "Square is down" }] }), { status: 503 }); }
  const body = JSON.parse(options.body);
  bonusCalls.push(body);
  return new Response(JSON.stringify({ gift_card_activity: { id: "gcact_bonus", gift_card_balance_money: { amount: 11500, currency: "USD" } } }),
    { headers: { "content-type": "application/json" } });
};

const baseEnv = {
  SQUARE_ACCESS_TOKEN: "tok", SQUARE_LOCATION_ID: "LOC1", SQUARE_ENVIRONMENT: "sandbox", SITE_URL: "https://skinbylauralo.com",
  BLACK_FRIDAY_ENABLED: "true", SQUARE_WEBHOOK_SIGNATURE_KEY: KEY, CLIENT_NOTES_DB: d1,
};

function activity({ id = "gcact_1", type = "ACTIVATE", cents = 10000, at = "2026-11-24T15:00:00Z" } = {}) {
  const details = { amount_money: { amount: cents, currency: "USD" } };
  return {
    id, type, location_id: "LOC1", gift_card_id: "gftc_1", gift_card_gan: "7783320001234567", created_at: at,
    ...(type === "ACTIVATE" ? { activate_activity_details: details } : {}),
    ...(type === "LOAD" ? { load_activity_details: details } : {}),
    ...(type === "ADJUST_INCREMENT" ? { adjust_increment_activity_details: { ...details, reason: "COMPLIMENTARY" } } : {}),
  };
}

async function send(act, { env = baseEnv, sign = KEY, type = "gift_card.activity.created" } = {}) {
  bonusCalls = [];
  const body = JSON.stringify({ type, event_id: "evt", data: { type: "gift_card_activity", id: act.id, object: { gift_card_activity: act } } });
  const signature = createHmac("sha256", sign).update(URL_ + body).digest("base64");
  const response = await worker.fetch(new Request(URL_, { method: "POST", body, headers: { "x-square-hmacsha256-signature": signature } }), env);
  return { status: response.status, text: await response.text(), calls: bonusCalls };
}

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got      ${JSON.stringify(actual)}\n      expected ${JSON.stringify(expected)}`}`);
}

const forged = await send(activity(), { sign: "wrong-key" });
check("a request Square didn't sign is refused and adds nothing", [forged.status, forged.calls.length], [401, 0]);
const noSecret = await send(activity(), { env: { ...baseEnv, SQUARE_WEBHOOK_SIGNATURE_KEY: "" } });
check("without the signature key every request is refused", [noSecret.status, noSecret.calls.length], [401, 0]);

const first = await send(activity());
const sent = first.calls[0]?.gift_card_activity;
check("a $100 gift card gets $15 added to the same card",
  [first.text, sent?.type, sent?.gift_card_id, sent?.adjust_increment_activity_details, first.calls[0]?.idempotency_key],
  ["added", "ADJUST_INCREMENT", "gftc_1", { amount_money: { amount: 1500, currency: "USD" }, reason: "COMPLIMENTARY" }, "bf2026-bonus-gcact_1"]);
const again = await send(activity());
check("the same purchase delivered again adds nothing", [again.status, again.text, again.calls.length], [200, "already-added", 0]);
const row = await d1.prepare("SELECT * FROM gift_card_bonuses WHERE source_activity_id = 'gcact_1'").first();
check("every bonus is on record", [row.status, row.paid_cents, row.bonus_cents, row.card_last4, row.bonus_activity_id, row.balance_cents],
  ["added", 10000, 1500, "4567", "gcact_bonus", 11500]);

check("$200 earns $25 and $300 earns $50", [
  (await send(activity({ id: "gcact_2", cents: 20000 }))).calls[0]?.gift_card_activity.adjust_increment_activity_details.amount_money.amount,
  (await send(activity({ id: "gcact_3", cents: 30000, type: "LOAD" }))).calls[0]?.gift_card_activity.adjust_increment_activity_details.amount_money.amount,
], [2500, 5000]);

check("other amounts earn nothing", [(await send(activity({ id: "a", cents: 5000 }))).calls.length, (await send(activity({ id: "b", cents: 15000 }))).calls.length], [0, 0]);
check("the bonus itself, and spending the card, never earn a bonus",
  [(await send(activity({ id: "c", type: "ADJUST_INCREMENT", cents: 10000 }))).calls.length, (await send(activity({ id: "d", type: "REDEEM" }))).calls.length], [0, 0]);
check("other Square events are acknowledged and ignored", (await send(activity({ id: "e" }), { type: "order.created" })).calls.length, 0);

check("only Nov 23 to Nov 30, Eastern time", [
  (await send(activity({ id: "t1", at: "2026-11-23T04:59:59Z" }))).calls.length,
  (await send(activity({ id: "t2", at: "2026-11-23T05:00:00Z" }))).calls.length,
  (await send(activity({ id: "t3", at: "2026-12-01T04:59:59Z" }))).calls.length,
  (await send(activity({ id: "t4", at: "2026-12-01T05:00:00Z" }))).calls.length,
], [0, 1, 1, 0]);
check("the campaign switch turns the bonus off too",
  (await send(activity({ id: "off" }), { env: { ...baseEnv, BLACK_FRIDAY_ENABLED: "false" } })).calls.length, 0);

const rehearsal = { ...baseEnv, GIFT_BONUS_TEST_DAY: "2026-11-19" };
check("the rehearsal day works for that day only, and never after the campaign", [
  (await send(activity({ id: "r1", at: "2026-11-19T18:00:00Z" }), { env: rehearsal })).calls.length,
  (await send(activity({ id: "r2", at: "2026-11-20T18:00:00Z" }), { env: rehearsal })).calls.length,
  (await send(activity({ id: "r3", at: "2026-12-05T18:00:00Z" }), { env: { ...baseEnv, GIFT_BONUS_TEST_DAY: "2026-12-05" } })).calls.length,
], [1, 0, 0]);

failNext = true;
const down = await send(activity({ id: "gcact_retry" }));
const failedRow = await d1.prepare("SELECT status FROM gift_card_bonuses WHERE source_activity_id = 'gcact_retry'").first();
const retried = await send(activity({ id: "gcact_retry" }));
check("if Square is down the event is retried, with the same idempotency key",
  [down.status, failedRow.status, retried.text, retried.calls[0]?.idempotency_key], [500, "failed", "added", "bf2026-bonus-gcact_retry"]);

const noDb = await send(activity({ id: "gcact_nodb" }), { env: { ...baseEnv, CLIENT_NOTES_DB: undefined } });
check("without the database the bonus still goes out, guarded by Square's key", [noDb.text, noDb.calls[0]?.idempotency_key], ["added", "bf2026-bonus-gcact_nodb"]);

if (failures) { console.error(`\n${failures} gift card bonus test(s) failed.`); process.exit(1); }
console.log("\nAll gift card bonus tests passed.");
