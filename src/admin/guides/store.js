// Skincare Guides in D1 (migrations/0012_client_guides.sql).

import { newId } from "../db.js";
import { LIMITS, cleanDocument } from "./model.js";

function fromRow(row) {
  if (!row) return null;
  let document = null;
  try { document = JSON.parse(row.document_json); } catch { document = null; }
  return {
    id: row.id, clientId: row.client_id, status: row.status, version: row.version,
    createdAt: row.created_at, updatedAt: row.updated_at, document,
  };
}

export async function createGuide(env, { clientId, document }) {
  const clean = cleanDocument(document);
  if (!clean) throw new Error("Not a guide document.");
  const id = newId("guide");
  await env.CLIENT_NOTES_DB
    .prepare("INSERT INTO client_guides (id, client_id, document_json) VALUES (?, ?, ?)")
    .bind(id, clientId, JSON.stringify(clean))
    .run();
  return id;
}

export async function getGuide(env, id) {
  const row = await env.CLIENT_NOTES_DB.prepare("SELECT * FROM client_guides WHERE id = ?").bind(id).first();
  return fromRow(row);
}

/** A client's guides, newest first, without their pages. */
export async function listGuidesForClient(env, clientId) {
  const { results } = await env.CLIENT_NOTES_DB
    .prepare("SELECT id, client_id, status, version, created_at, updated_at FROM client_guides WHERE client_id = ? ORDER BY updated_at DESC, created_at DESC")
    .bind(clientId)
    .all();
  return results.map((row) => ({ id: row.id, clientId: row.client_id, status: row.status, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at }));
}

/**
 * Saves the editor's copy. `version` is the one the editor last loaded or
 * saved; if the guide has moved on since (another tab saved), nothing is
 * written and `{ conflict: true }` comes back.
 */
export async function saveGuide(env, id, { document, version }) {
  const clean = cleanDocument(document);
  if (!clean) return { error: "That isn't a guide." };
  const json = JSON.stringify(clean);
  if (json.length > LIMITS.documentBytes) return { error: "This guide is too big to save. Remove a few pages or boxes." };
  const result = await env.CLIENT_NOTES_DB
    .prepare("UPDATE client_guides SET document_json = ?, version = version + 1, updated_at = datetime('now') WHERE id = ? AND version = ?")
    .bind(json, id, Number(version) || 0)
    .run();
  if (!result.meta?.changes) {
    const current = await env.CLIENT_NOTES_DB.prepare("SELECT version FROM client_guides WHERE id = ?").bind(id).first();
    return current ? { conflict: true, version: current.version } : { missing: true };
  }
  return { version: (Number(version) || 0) + 1, document: clean };
}

export async function deleteGuide(env, id) {
  await env.CLIENT_NOTES_DB.prepare("DELETE FROM client_guides WHERE id = ?").bind(id).run();
}
