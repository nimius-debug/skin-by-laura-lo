// Routes for Skincare Guides:
//   GET  /admin/guides                 every guide, and a form to start one without a client
//   POST /admin/guides                 start a guide for someone who isn't a client (a friend)
//   POST /admin/clients/:id/guides     draft a new guide from a client's current routine, then open it
//   GET  /admin/guides/:id             the editor
//   POST /admin/guides/:id             save the editor's copy (JSON)
//   POST /admin/guides/:id/products    add or remove a product (JSON)
//   POST /admin/guides/:id/delete      delete it and go back

import { jsonResponse } from "../../layout.js";
import { adminHtmlResponse, adminPage } from "../layout.js";
import * as db from "../db.js";
import { stepFor } from "../routine-steps.js";
import { guideProductFor } from "../../data/guide-library.js";
import { buildGuideDraft, wordingChoices } from "./build.js";
import { addProductToGuide, productsInGuide, removeProductFromGuide } from "./products.js";
import { clientGuidesCard, guideEditorPage, guidesListPage } from "./page.js";
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

/**
 * The shop's products as the "Add product" list shows them: every catalog
 * product, with its photo, its routine step and whether the library has
 * Laura's words for it. Library products come first.
 */
export function pickerProducts(catalogProducts = []) {
  const seen = new Set();
  const list = [];
  for (const product of catalogProducts) {
    if (!product?.name || seen.has(product.name)) continue;
    seen.add(product.name);
    const entry = guideProductFor(product.name);
    list.push({
      name: product.name,
      label: entry?.name || product.name,
      image: product.image || null,
      category: product.category || "",
      key: entry?.id || `square:${product.slug || product.name}`.slice(0, 80),
      inLibrary: Boolean(entry?.why),
    });
  }
  return list.sort((a, b) => Number(b.inLibrary) - Number(a.inLibrary) || a.label.localeCompare(b.label));
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

/** A guide for someone who isn't a client: the name typed in, and no products yet (they're added in the editor). */
async function createForName(request, env) {
  const form = await request.formData().catch(() => new FormData());
  const name = String(form.get("name") || "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (!name) return redirect("/admin/guides?missing=1");
  const document = buildGuideDraft({ clientName: name, routine: null });
  const id = await store.createGuide(env, { clientId: null, document });
  return redirect(`/admin/guides/${id}`);
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > 1_500_000) return { error: jsonResponse({ message: "This guide is too big to save." }, 413) };
  try { return { body: JSON.parse(text) }; } catch { return { error: jsonResponse({ message: "That wasn't a guide." }, 400) }; }
}

async function saveFromEditor(request, env, id) {
  const { body, error } = await readJson(request);
  if (error) return error;
  const result = await store.saveGuide(env, id, { document: body?.document, version: body?.version });
  if (result.missing) return jsonResponse({ message: "This guide was deleted." }, 404);
  if (result.conflict) return jsonResponse({ message: "This guide was changed in another tab.", version: result.version }, 409);
  if (result.error) return jsonResponse({ message: result.error }, 400);
  return jsonResponse({ ok: true, version: result.version });
}

/** "Add product" / "Remove from guide": changes the saved guide and sends the new copy back to the editor. */
async function changeProducts(request, env, id, { loadCatalog }) {
  const { body, error } = await readJson(request);
  if (error) return error;
  const guide = await store.getGuide(env, id);
  if (!guide?.document) return jsonResponse({ message: "This guide was deleted." }, 404);
  if (Number(body?.version) !== guide.version) return jsonResponse({ message: "This guide was changed in another tab.", version: guide.version }, 409);
  const document = guide.document;
  let result;
  if (body?.action === "remove") {
    const productId = String(body.productId || "");
    if (!productsInGuide(document).has(productId)) return jsonResponse({ message: "That product isn't in this guide." }, 400);
    result = removeProductFromGuide(document, productId);
  } else {
    const name = String(body?.name || "").slice(0, 200);
    const { products = [] } = loadCatalog ? await loadCatalog(env) : {};
    const product = products.find((candidate) => candidate.name === name);
    if (!product && !guideProductFor(name)) return jsonResponse({ message: "That product isn't in the shop." }, 400);
    result = addProductToGuide(document, {
      name, slug: product?.slug || name, image: product?.image || null, step: stepFor(name, product?.category || ""),
    });
    if (!result.added) {
      return jsonResponse({ message: result.reason === "already-in" ? `${result.name} is already in this guide.` : "Couldn't add that product." }, 400);
    }
  }
  const saved = await store.saveGuide(env, id, { document, version: guide.version });
  if (saved.conflict) return jsonResponse({ message: "This guide was changed in another tab.", version: saved.version }, 409);
  if (saved.error) return jsonResponse({ message: saved.error }, 400);
  return jsonResponse({ ok: true, version: saved.version, document: saved.document, result: { ...result, document: undefined }, wordings: wordingChoices(saved.document) });
}

export async function handleGuideRoute(request, env, url, segments, method, helpers) {
  if (segments[1] === "clients" && segments[3] === "guides" && segments.length === 4 && method === "POST") {
    return createDraft(env, segments[2], helpers);
  }
  if (segments[1] !== "guides") return null;

  if (segments.length === 2 && method === "GET") {
    const guides = await store.listAllGuides(env);
    return adminHtmlResponse(adminPage({ title: "Skincare guides", active: "guides", body: guidesListPage({ guides, missingName: url.searchParams.get("missing") === "1" }) }));
  }
  if (segments.length === 2 && method === "POST") return createForName(request, env);

  const id = segments[2];
  if (segments.length === 3 && method === "GET") {
    const guide = await store.getGuide(env, id);
    if (!guide?.document) return null;
    const [client, catalog] = await Promise.all([
      guide.clientId ? db.getClient(env, guide.clientId) : null,
      helpers.loadCatalog ? helpers.loadCatalog(env) : { products: [] },
    ]);
    return adminHtmlResponse(guideEditorPage({ guide, client, wordings: wordingChoices(guide.document), products: pickerProducts(catalog.products) }));
  }
  if (segments.length === 3 && method === "POST") return saveFromEditor(request, env, id);
  if (segments.length === 4 && segments[3] === "products" && method === "POST") return changeProducts(request, env, id, helpers);
  if (segments.length === 4 && segments[3] === "delete" && method === "POST") {
    const guide = await store.getGuide(env, id);
    if (!guide) return null;
    await store.deleteGuide(env, id);
    return redirect(guide.clientId ? `/admin/clients/${guide.clientId}` : "/admin/guides");
  }
  return null;
}
