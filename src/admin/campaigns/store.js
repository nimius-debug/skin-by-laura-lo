// D1 storage for email campaigns: campaigns, their versions, the send queue,
// unsubscribes and the reminder settings.

import { newId } from "../db.js";

const parse = (text, fallback) => {
  try { return JSON.parse(text); } catch { return fallback; }
};

// --- campaigns and versions ---------------------------------------------------

export async function createCampaign(env, { topic, goal, content, usage, versions }) {
  const db = env.CLIENT_NOTES_DB;
  const campaignId = newId("campaign");
  const statements = [
    db.prepare("INSERT INTO email_campaigns (id, topic, goal, content_json, usage_json) VALUES (?, ?, ?, ?, ?)")
      .bind(campaignId, topic, goal, JSON.stringify(content), JSON.stringify(usage || {})),
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
  return { ...row, content: parse(row.content_json, {}), usage: parse(row.usage_json, {}) };
}

export async function getCampaign(env, campaignId) {
  return campaignFromRow(await env.CLIENT_NOTES_DB.prepare("SELECT * FROM email_campaigns WHERE id = ?").bind(campaignId).first());
}

export async function updateCampaign(env, campaignId, { content, usage, status }) {
  const sets = [];
  const values = [];
  if (content) { sets.push("content_json = ?"); values.push(JSON.stringify(content)); }
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

/** Emails handed to Resend since the start of `dayStartIso` (UTC). */
export async function countSentSince(env, dayStartIso) {
  const row = await env.CLIENT_NOTES_DB.prepare(
    "SELECT COUNT(*) AS n FROM email_sends WHERE status = 'sent' AND sent_at >= ?",
  ).bind(dayStartIso).first();
  return row?.n || 0;
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
