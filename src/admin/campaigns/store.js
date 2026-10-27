// D1 storage for email campaigns: campaigns, their versions, the send queue,
// unsubscribes and the reminder settings.

import { newId } from "../db.js";

const parse = (text, fallback) => {
  try { return JSON.parse(text); } catch { return fallback; }
};

// --- campaigns and versions ---------------------------------------------------

export async function createCampaign(env, { topic, goal, content, usage, versions, audience = {} }) {
  const db = env.CLIENT_NOTES_DB;
  const campaignId = newId("campaign");
  const statements = [
    db.prepare("INSERT INTO email_campaigns (id, topic, goal, content_json, usage_json, audience_json) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(campaignId, topic, goal, JSON.stringify(content), JSON.stringify(usage || {}), JSON.stringify(audience)),
    db.prepare("INSERT INTO email_versions (id, campaign_id, client_id) VALUES (?, ?, NULL)").bind(newId("version"), campaignId),
  ];
  for (const version of versions) {
    statements.push(db.prepare("INSERT INTO email_versions (id, campaign_id, client_id, reason, personal_json) VALUES (?, ?, ?, ?, ?)")
      .bind(newId("version"), campaignId, version.clientId, version.reason, JSON.stringify(version.personal)));
  }
  await db.batch(statements);
  return campaignId;
}

function campaignFromRow(row) {
  if (!row) return null;
  return { ...row, content: parse(row.content_json, {}), usage: parse(row.usage_json, {}), audience: audienceFrom(row.audience_json) };
}

/**
 * Who a campaign goes to. `emails` is null for campaigns from before recipients
 * could be picked: those go to everyone. `personalize` false means one email for all.
 */
export function audienceFrom(text) {
  const saved = parse(text || "{}", {}) || {};
  return {
    personalize: saved.personalize !== false,
    emails: Array.isArray(saved.emails) ? saved.emails.map((email) => String(email).toLowerCase()) : null,
  };
}

export async function getCampaign(env, campaignId) {
  return campaignFromRow(await env.CLIENT_NOTES_DB.prepare("SELECT * FROM email_campaigns WHERE id = ?").bind(campaignId).first());
}

export async function updateCampaign(env, campaignId, { content, goal, usage, status, audience }) {
  const sets = [];
  const values = [];
  if (audience) { sets.push("audience_json = ?"); values.push(JSON.stringify(audience)); }
  if (content) { sets.push("content_json = ?"); values.push(JSON.stringify(content)); }
  if (goal) { sets.push("goal = ?"); values.push(goal); }
  if (usage) { sets.push("usage_json = ?"); values.push(JSON.stringify(usage)); }
  if (status) {
    sets.push("status = ?"); values.push(status);
    if (status === "sending") sets.push("send_started_at = COALESCE(send_started_at, datetime('now'))");
    if (status === "sent") sets.push("sent_at = COALESCE(sent_at, datetime('now'))");
  }
  if (!sets.length) return;
  await env.CLIENT_NOTES_DB.prepare(`UPDATE email_campaigns SET ${sets.join(", ")} WHERE id = ?`).bind(...values, campaignId).run();
}

function versionFromRow(row) {
  return { ...row, personal: parse(row.personal_json, {}), isShared: !row.client_id };
}

/** The shared version first, then personal versions by client name. */
export async function listVersions(env, campaignId) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    `SELECT v.*, c.name AS client_name FROM email_versions v LEFT JOIN clients c ON c.id = v.client_id
     WHERE v.campaign_id = ? ORDER BY (v.client_id IS NOT NULL), c.name COLLATE NOCASE`,
  ).bind(campaignId).all();
  return results.map(versionFromRow);
}

export async function getVersion(env, versionId) {
  const row = await env.CLIENT_NOTES_DB.prepare(
    "SELECT v.*, c.name AS client_name FROM email_versions v LEFT JOIN clients c ON c.id = v.client_id WHERE v.id = ?",
  ).bind(versionId).first();
  return row ? versionFromRow(row) : null;
}

export async function updateVersion(env, versionId, { status, personal, reason, feedback }) {
  const sets = ["updated_at = datetime('now')"];
  const values = [];
  if (status) { sets.push("status = ?"); values.push(status); }
  if (personal) { sets.push("personal_json = ?"); values.push(JSON.stringify(personal)); }
  if (reason !== undefined) { sets.push("reason = ?"); values.push(reason); }
  if (feedback !== undefined) { sets.push("feedback = ?"); values.push(feedback); }
  await env.CLIENT_NOTES_DB.prepare(`UPDATE email_versions SET ${sets.join(", ")} WHERE id = ?`).bind(...values, versionId).run();
}

/** Sets the status of several versions of one campaign at once (bulk approve or reject). */
export async function updateVersionStatuses(env, campaignId, versionIds, status) {
  const ids = [...new Set(versionIds)].slice(0, 1000);
  if (!ids.length) return;
  const db = env.CLIENT_NOTES_DB;
  await db.batch(chunks(ids, 90).map((group) => db.prepare(
    `UPDATE email_versions SET status = ?, updated_at = datetime('now') WHERE campaign_id = ? AND id IN (${group.map(() => "?").join(", ")})`,
  ).bind(status, campaignId, ...group)));
}

/** Recent campaigns with their counts, newest first. */
export async function listCampaigns(env, limit = 20) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    `SELECT c.*,
       (SELECT COUNT(*) FROM email_versions v WHERE v.campaign_id = c.id AND v.client_id IS NOT NULL) AS personal_count,
       (SELECT COUNT(*) FROM email_sends s WHERE s.campaign_id = c.id AND s.status = 'sent') AS sent_count,
       (SELECT COUNT(*) FROM email_sends s WHERE s.campaign_id = c.id AND s.status = 'queued') AS queued_count,
       (SELECT COUNT(*) FROM email_sends s JOIN email_unsubscribes u ON u.email = s.email
          WHERE s.campaign_id = c.id AND s.status = 'sent' AND u.created_at >= replace(substr(s.sent_at, 1, 19), 'T', ' ')) AS unsubscribed_count
     FROM email_campaigns c ORDER BY c.created_at DESC LIMIT ?`,
  ).bind(limit).all();
  return results.map(campaignFromRow);
}

// --- send queue -------------------------------------------------------------

// D1 allows 100 bound parameters per statement.
function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Queue one email per recipient. A recipient already queued for this campaign is skipped. */
export async function enqueueSends(env, campaignId, recipients) {
  const db = env.CLIENT_NOTES_DB;
  const statements = chunks(recipients, 16).map((group) => db.prepare(
    `INSERT OR IGNORE INTO email_sends (id, campaign_id, version_id, client_id, email, first_name) VALUES ${group.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}`,
  ).bind(...group.flatMap((recipient) => [newId("send"), campaignId, recipient.versionId, recipient.clientId, recipient.email, recipient.firstName])));
  if (statements.length) await db.batch(statements);
}

export async function nextQueued(env, limit) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    "SELECT * FROM email_sends WHERE status = 'queued' ORDER BY created_at, rowid LIMIT ?",
  ).bind(limit).all();
  return results;
}

/** Campaign emails handed to Resend since `sinceIso` (UTC). */
export async function countSentSince(env, sinceIso) {
  const row = await env.CLIENT_NOTES_DB.prepare(
    "SELECT COUNT(*) AS n FROM email_sends WHERE status = 'sent' AND sent_at >= ?",
  ).bind(sinceIso).first();
  return row?.n || 0;
}

/** Whether an error is D1 saying a table or column from a migration isn't there yet. */
export function isMissingSchema(error) {
  return /no such (table|column)|has no column named/i.test(String(error?.message || ""));
}

/**
 * Test emails and reminders sent since `sinceIso`, which Resend counts too.
 * 0 until migration 0009 has run, so sending never stops over a missing table.
 */
export async function countOtherSentSince(env, sinceIso) {
  try {
    const row = await env.CLIENT_NOTES_DB.prepare("SELECT COUNT(*) AS n FROM email_other_sends WHERE sent_at >= ?").bind(sinceIso).first();
    return row?.n || 0;
  } catch (error) {
    if (isMissingSchema(error)) return 0;
    throw error;
  }
}

/** Notes an email sent outside a campaign (kind: test | reminder). Skipped until migration 0009 has run. */
export async function recordOtherSend(env, kind, now = new Date()) {
  try {
    await env.CLIENT_NOTES_DB.prepare("INSERT INTO email_other_sends (id, kind, sent_at) VALUES (?, ?, ?)")
      .bind(newId("othersend"), kind, now.toISOString()).run();
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
  }
}

/** Queued emails per campaign, in the order they go out: [{ campaign_id, n, topic, eyebrow }]. */
export async function queuedByCampaign(env) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    `SELECT s.campaign_id, COUNT(*) AS n, MIN(s.created_at) AS first_at FROM email_sends s
     WHERE s.status = 'queued' GROUP BY s.campaign_id ORDER BY first_at, MIN(s.rowid)`,
  ).all();
  return results.map((row) => ({ campaignId: row.campaign_id, count: row.n }));
}

/** Per-campaign delivery counts for the campaigns that have been sent or are sending, newest first. */
export async function deliveryStats(env, limit = 12) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    `SELECT c.id, c.topic, c.content_json, c.status, c.send_started_at, c.sent_at,
       SUM(s.status = 'queued') AS queued,
       SUM(s.status = 'sent') AS sent,
       SUM(s.status = 'failed') AS failed,
       SUM(s.status = 'skipped') AS skipped,
       SUM(s.status = 'sent' AND s.delivered_at IS NOT NULL) AS delivered,
       SUM(s.status = 'sent' AND s.opened_at IS NOT NULL) AS opened,
       SUM(s.status = 'sent' AND s.delivery_status IN ('bounced', 'complained')) AS bounced,
       MAX(s.sent_at) AS last_sent_at
     FROM email_campaigns c JOIN email_sends s ON s.campaign_id = c.id
     WHERE c.status != 'review'
     GROUP BY c.id ORDER BY COALESCE(c.send_started_at, c.created_at) DESC LIMIT ?`,
  ).bind(limit).all();
  return results.map((row) => ({ ...row, content: parse(row.content_json, {}) }));
}

/** The latest sent or queued emails, newest first, for the Scheduled page. */
export async function recentSends(env, limit = 25) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    `SELECT s.id, s.campaign_id, s.email, s.first_name, s.status, s.error, s.sent_at, s.delivery_status, s.delivered_at, s.opened_at,
       c.topic, c.content_json
     FROM email_sends s JOIN email_campaigns c ON c.id = s.campaign_id
     WHERE s.status != 'queued'
     ORDER BY s.sent_at IS NULL, s.sent_at DESC, s.rowid DESC LIMIT ?`,
  ).bind(limit).all();
  return results.map((row) => ({ ...row, content: parse(row.content_json, {}) }));
}

// How far along each event puts an email; a later webhook never moves it back.
const DELIVERY_RANK = { delayed: 1, delivered: 2, opened: 3, clicked: 4, bounced: 5, complained: 5 };

/**
 * Applies one Resend webhook event to the send it's about, found by Resend's id,
 * else by campaign and address. Returns whether a send was updated.
 */
export async function applyDeliveryEvent(env, { providerId, campaignId, email, status, at }) {
  const db = env.CLIENT_NOTES_DB;
  let send = providerId ? await db.prepare("SELECT id, delivery_status FROM email_sends WHERE provider_id = ?").bind(providerId).first() : null;
  if (!send && campaignId && email) {
    send = await db.prepare("SELECT id, delivery_status FROM email_sends WHERE campaign_id = ? AND email = ?").bind(campaignId, email.toLowerCase()).first();
  }
  if (!send || !DELIVERY_RANK[status]) return false;
  const keep = (DELIVERY_RANK[send.delivery_status] || 0) > DELIVERY_RANK[status];
  const delivered = ["delivered", "opened", "clicked"].includes(status);
  const opened = status === "opened" || status === "clicked";
  await db.prepare(
    `UPDATE email_sends SET delivery_status = ?, delivery_updated_at = ?,
       delivered_at = CASE WHEN ? THEN COALESCE(delivered_at, ?) ELSE delivered_at END,
       opened_at = CASE WHEN ? THEN COALESCE(opened_at, ?) ELSE opened_at END,
       provider_id = COALESCE(provider_id, ?)
     WHERE id = ?`,
  ).bind(keep ? send.delivery_status : status, at, delivered ? 1 : 0, at, opened ? 1 : 0, at, providerId || null, send.id).run();
  return true;
}

export async function countQueued(env) {
  const row = await env.CLIENT_NOTES_DB.prepare("SELECT COUNT(*) AS n FROM email_sends WHERE status = 'queued'").first();
  return row?.n || 0;
}

export async function sendCounts(env, campaignId) {
  const { results } = await env.CLIENT_NOTES_DB.prepare(
    "SELECT status, COUNT(*) AS n FROM email_sends WHERE campaign_id = ? GROUP BY status",
  ).bind(campaignId).all();
  const counts = { queued: 0, sent: 0, failed: 0, skipped: 0 };
  for (const row of results) counts[row.status] = row.n;
  return counts;
}

// --- unsubscribes and settings -------------------------------------------------

export async function addUnsubscribe(env, email) {
  await env.CLIENT_NOTES_DB.prepare("INSERT OR IGNORE INTO email_unsubscribes (email) VALUES (?)").bind(email.toLowerCase()).run();
}

export async function unsubscribedEmails(env) {
  const { results } = await env.CLIENT_NOTES_DB.prepare("SELECT email FROM email_unsubscribes").all();
  return new Set(results.map((row) => row.email));
}

export async function getSetting(env, key, fallback = null) {
  const row = await env.CLIENT_NOTES_DB.prepare("SELECT value FROM admin_settings WHERE key = ?").bind(key).first();
  return row ? row.value : fallback;
}

export async function setSetting(env, key, value) {
  await env.CLIENT_NOTES_DB.prepare(
    "INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
  ).bind(key, String(value)).run();
}

/** Deletes a campaign that was never sent, with its versions. */
export async function deleteDraftCampaign(env, campaignId) {
  const db = env.CLIENT_NOTES_DB;
  const campaign = await getCampaign(env, campaignId);
  if (!campaign || campaign.status !== "review") return false;
  await db.batch([
    db.prepare("DELETE FROM email_sends WHERE campaign_id = ?").bind(campaignId),
    db.prepare("DELETE FROM email_versions WHERE campaign_id = ?").bind(campaignId),
    db.prepare("DELETE FROM email_campaigns WHERE id = ?").bind(campaignId),
  ]);
  return true;
}
