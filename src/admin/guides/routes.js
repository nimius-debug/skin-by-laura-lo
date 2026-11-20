// Routes for Skincare Guides:
//   POST /admin/clients/:id/guides   draft a new guide from her current routine, then open it
//   GET  /admin/guides/:id           the editor
//   POST /admin/guides/:id           save the editor's copy (JSON)
//   POST /admin/guides/:id/delete    delete it and go back to her page

import { jsonResponse } from "../../layout.js";
import { adminHtmlResponse, adminPage } from "../layout.js";
import * as db from "../db.js";
import { buildGuideDraft, wordingChoices } from "./build.js";
import { clientGuidesCard, guideEditorPage } from "./page.js";
import * as store from "./store.js";

const redirect = (location) => new Response(null, { status: 303, headers: { location, "cache-control": "no-store" } });

function messagePage(title, message, back, status) {
  return adminHtmlResponse(adminPage({ title, back, body: `<section class="card"><p>${message}</p></section>` }), { status });
}

/** The guides card for a client's page. A database error leaves the card out rather than the page. */
export async function guidesCardFor(env, client, routine) {
  try {
    const guides = await store.listGuidesForClient(env, client.id);
    return clientGuidesCard({ client, guides, routine });
  } catch (error) {
    console.error("Reading guides failed:", error.message);
    return "";
  }
}

async function createDraft(env, clientId, { loadClientPurchases }) {
  const client = await db.getClient(env, clientId);
  if (!client) return null;
  const notes = await db.listNotesForClient(env, clientId);
  const { routine, purchasesFailed } = await loadClientPurchases(env, client, notes);
  if (purchasesFailed) {
    return messagePage("Couldn't draft a guide",
      "Couldn't read her purchases from Square just now, so the guide wasn't drafted. Go back and try again in a moment.",
      { href: `/admin/clients/${clientId}`, label: client.name }, 502);
  }
  const document = buildGuideDraft({ clientName: client.name, routine });
  const id = await store.createGuide(env, { clientId, document });
  return redirect(`/admin/guides/${id}`);
}

async function saveFromEditor(request, env, id) {
  const text = await request.text();
  if (text.length > 1_500_000) return jsonResponse({ message: "This guide is too big to save." }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return jsonResponse({ message: "That wasn't a guide." }, 400); }
  const result = await store.saveGuide(env, id, { document: body?.document, version: body?.version });
  if (result.missing) return jsonResponse({ message: "This guide was deleted." }, 404);
  if (result.conflict) return jsonResponse({ message: "This guide was changed in another tab.", version: result.version }, 409);
  if (result.error) return jsonResponse({ message: result.error }, 400);
  return jsonResponse({ ok: true, version: result.version });
}

export async function handleGuideRoute(request, env, url, segments, method, helpers) {
  if (segments[1] === "clients" && segments[3] === "guides" && segments.length === 4 && method === "POST") {
    return createDraft(env, segments[2], helpers);
  }
  if (segments[1] !== "guides" || !segments[2]) return null;

  const id = segments[2];
  if (segments.length === 3 && method === "GET") {
    const guide = await store.getGuide(env, id);
    if (!guide?.document) return null;
    const client = await db.getClient(env, guide.clientId);
    return adminHtmlResponse(guideEditorPage({ guide, client, wordings: wordingChoices(guide.document) }));
  }
  if (segments.length === 3 && method === "POST") {
    return saveFromEditor(request, env, id);
  }
  if (segments.length === 4 && segments[3] === "delete" && method === "POST") {
    const guide = await store.getGuide(env, id);
    if (!guide) return null;
    await store.deleteGuide(env, id);
    return redirect(`/admin/clients/${guide.clientId}`);
  }
  return null;
}
