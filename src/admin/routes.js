// Router for the /admin area: a separate, internal tool bolted onto the
// storefront Worker. Every route except the login page needs a valid session
// cookie (see auth.js).

import { settings } from "../config.js";
import { getCatalog, isConfigured } from "../square.js";
import { jsonResponse } from "../layout.js";
import { adminPage, adminHtmlResponse, loginPage } from "./layout.js";
import {
  adminAuthConfigured, clearedSessionCookie, createSessionToken, credentialsMatch,
  isValidSession, readSession, readSessionCookie, sessionCookie, shouldRenew,
} from "./auth.js";
import { clearFailures, lockedFor, loginKey, recordFailure } from "./lockout.js";
import { clientsPage } from "./pages/clients.js";
import { clientProfilePage } from "./pages/client-profile.js";
import { uploadPage } from "./pages/upload.js";
import * as db from "./db.js";
import { splitPdfPages, diffPages, hashImageBytes } from "./pdf.js";
import { extractNoteEntries, summarizeClient, summaryInputHash, summaryModel } from "./claude.js";
import { purchaseViewFrom } from "./routine.js";
import { loadClientOrders } from "./purchases.js";
import { findFlags } from "./safety.js";
import { productInsightFor } from "../product-insights.js";
import { syncClientsFromSquare } from "./sync.js";
import * as storage from "./storage.js";
import { ADMIN_CLIENT_JS } from "./client.js";
import { MANIFEST, OFFLINE_HTML, SERVICE_WORKER_JS } from "./pwa.js";
import { iconBytes } from "./icons.js";

// PDF/image note uploads are switched off while notes come from the Excel
// sheet. Flip to true to bring the upload pages and routes back.
const UPLOADS_ENABLED = false;

function notFound() {
  return adminHtmlResponse(adminPage({ title: "Not found", body: "<p>Not found.</p>" }), { status: 404 });
}

function redirect(location, headers = {}) {
  return new Response(null, { status: 303, headers: { location, "cache-control": "no-store", ...headers } });
}

const tooManyTries = (minutes) => `Too many wrong tries. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;

async function handleLogin(request, env) {
  if (!adminAuthConfigured(env)) {
    return adminHtmlResponse(loginPage({ configured: false }), { status: 503 });
  }
  const key = loginKey(request);
  const locked = await lockedFor(env, key);
  if (locked) return adminHtmlResponse(loginPage({ error: tooManyTries(locked) }), { status: 429 });

  const form = await request.formData().catch(() => null);
  const username = String(form?.get("username") || "");
  const password = String(form?.get("password") || "");
  const remember = form?.get("remember") === "on";
  if (!(await credentialsMatch(env, username, password))) {
    const nowLocked = await recordFailure(env, key);
    return adminHtmlResponse(
      loginPage({ error: nowLocked ? tooManyTries(nowLocked) : "Wrong username or password.", username, remember }),
      { status: nowLocked ? 429 : 401 },
    );
  }
  await clearFailures(env, key);
  const token = await createSessionToken(env, Date.now(), { remember });
  return redirect("/admin", { "set-cookie": sessionCookie(token, { remember }) });
}

/** The shop catalog, and whether it could be read. Without it, products can't be told apart from services. */
async function loadCatalog(env) {
  if (!isConfigured(env)) return { products: [], failed: false };
  try {
    return { products: await getCatalog(env, settings(env)), failed: false };
  } catch (error) {
    console.error("Reading the catalog failed:", error.message);
    return { products: [], failed: true };
  }
}

/**
 * Everything the client page and the summary need about what a client bought:
 * routine, history, services, spend, plus the safety flags. Orders come through
 * the stored copy in D1 (see purchases.js). `purchasesFailed` is true when the
 * orders or the catalog couldn't be read, so callers can avoid acting on
 * incomplete data.
 */
async function loadClientPurchases(env, client, notes, { refresh = false } = {}) {
  const catalog = await loadCatalog(env);
  let loaded = { orders: [], syncedAt: null, source: "none" };
  let purchasesFailed = Boolean(client.square_customer_id) && catalog.failed;
  try {
    loaded = await loadClientOrders(env, client, { refresh });
  } catch (error) {
    console.error("Reading client purchases failed:", error.message);
    purchasesFailed = true;
  }
  const view = purchaseViewFrom(loaded.orders, catalog.products);
  const flags = findFlags({
    notes,
    products: view.history.map((item) => ({ name: item.name, formula: productInsightFor(item.name)?.formula || "" })),
  });
  return { ...view, flags, purchasesFailed, syncedAt: loaded.syncedAt, source: loaded.source };
}

/**
 * Reads a single uploaded file (or set of image files) into the page-level
 * shape the dedup/extraction pipeline expects: [{ index, bytes, hash, kind, mediaType }].
 */
async function readUploadedPages(files) {
  if (files.length === 1 && files[0].type === "application/pdf") {
    const bytes = new Uint8Array(await files[0].arrayBuffer());
    const pages = await splitPdfPages(bytes);
    return pages.map((page) => ({ ...page, kind: "pdf" }));
  }

  if (files.every((file) => file.type.startsWith("image/"))) {
    const pages = [];
    for (let index = 0; index < files.length; index += 1) {
      const bytes = new Uint8Array(await files[index].arrayBuffer());
      pages.push({ index, bytes, hash: await hashImageBytes(bytes), kind: "image", mediaType: files[index].type });
    }
    return pages;
  }

  throw new Error("Upload either one PDF, or one or more images — not a mix.");
}

async function handleUpload(request, env, clientId) {
  const client = await db.getClient(env, clientId);
  if (!client) return jsonResponse({ message: "Client not found" }, 404);

  const form = await request.formData().catch(() => null);
  const files = form ? form.getAll("file").filter((f) => f && f.size > 0) : [];
  if (!files.length) return jsonResponse({ message: "No file was uploaded." }, 400);

  let pages;
  try {
    pages = await readUploadedPages(files);
  } catch (error) {
    return jsonResponse({ message: error.message }, 400);
  }

  const knownHashes = await db.knownPageHashes(env, clientId);
  const { newPages, missingHashes } = diffPages(pages, knownHashes);

  if (newPages.length === 0) {
    return jsonResponse({ status: "no_new_pages", missingHashes });
  }

  let planned;
  try {
    planned = await extractNoteEntries(env, newPages);
  } catch (error) {
    console.error("Note extraction failed:", error.message);
    return jsonResponse({ message: "Couldn't read the new pages right now. Please try again shortly." }, 502);
  }

  const byIndex = new Map(newPages.map((page) => [page.index, page]));
  const draftId = db.newId("draft");
  const entries = [];

  for (let entryIndex = 0; entryIndex < planned.length; entryIndex += 1) {
    const plan = planned[entryIndex];
    const matchedPages = plan.pageIndexes.map((i) => byIndex.get(i)).filter(Boolean);
    const sourcePages = matchedPages.length ? matchedPages : newPages; // model returned no indexes — fall back to all new pages rather than drop the entry

    const mergedBytes = sourcePages[0]?.kind === "image"
      ? await storage.mergeImagesToPdf(sourcePages.map((p) => ({ bytes: p.bytes, mediaType: p.mediaType })))
      : await storage.mergePdfPages(sourcePages.map((p) => p.bytes));

    const draftKey = await storage.putDraftPage(env, draftId, entryIndex, mergedBytes, "pdf");

    entries.push({
      date: plan.date,
      summary: plan.summary,
      text: plan.text,
      confidence: plan.confidence,
      pageHashes: sourcePages.map((p) => p.hash),
      draftPdfKey: draftKey,
    });
  }

  await db.saveDraft(env, draftId, clientId, { entries, missingHashes });

  return jsonResponse({
    draftId,
    missingHashes,
    entries: entries.map((entry, index) => ({
      index, date: entry.date, summary: entry.summary, text: entry.text, confidence: entry.confidence,
    })),
  });
}

async function handleConfirm(request, env, clientId, draftId) {
  const draft = await db.getDraft(env, draftId);
  if (!draft || draft.client_id !== clientId) return jsonResponse({ message: "Draft not found" }, 404);

  const body = await request.json().catch(() => null);
  const submitted = Array.isArray(body?.entries) ? body.entries : null;
  if (!submitted) return jsonResponse({ message: "Missing entries" }, 400);

  const toCommit = [];
  for (const submission of submitted) {
    if (submission.include === false) continue;
    const draftEntry = draft.entries[submission.index];
    if (!draftEntry) continue;

    const id = db.newId("note");
    const finalKey = `notes/${clientId}/${id}.pdf`;
    await storage.promoteDraftObject(env, draftEntry.draftPdfKey, finalKey);

    toCommit.push({
      id,
      date: typeof submission.date === "string" && submission.date ? submission.date : draftEntry.date,
      summary: typeof submission.summary === "string" ? submission.summary : draftEntry.summary,
      text: typeof submission.text === "string" ? submission.text : draftEntry.text,
      confidence: draftEntry.confidence,
      pdfKey: finalKey,
      pageHashes: draftEntry.pageHashes,
    });
  }

  // Any draft entries never mentioned in the confirm payload (e.g. the tab
  // was closed) stay as orphaned R2 objects + an unconfirmed draft row —
  // harmless, but worth a cleanup job later rather than solved here.
  const noteIds = await db.commitNoteEntries(env, clientId, toCommit);
  await db.deleteDraft(env, draftId);

  return jsonResponse({ noteIds, redirect: `/admin/clients/${clientId}` });
}

async function handleInsight(env, clientId, { refresh = false } = {}) {
  const client = await db.getClient(env, clientId);
  if (!client) return jsonResponse({ message: "Client not found" }, 404);

  const notes = await db.listNotesForClient(env, clientId);
  const { routine, history, flags, purchasesFailed } = await loadClientPurchases(env, client, notes);
  if (purchasesFailed) {
    // Don't spend tokens on a summary that is missing what she bought.
    return jsonResponse({ message: "Couldn't read her purchases from Square just now, so nothing was summarized. Try again in a moment." }, 503);
  }
  const data = { client, notes, routine, history, flags };

  // The API is only called for new or changed inputs, or an explicit regenerate.
  // The same notes, purchases, ingredient lists and flags reuse the saved summary for free.
  const hash = await summaryInputHash(env, data);
  const saved = await db.getSavedSummary(env, clientId);
  if (saved && saved.hash === hash && !refresh) {
    return jsonResponse({ summary: saved.summary, cached: true, savedAt: saved.createdAt });
  }

  try {
    const summary = await summarizeClient(env, data);
    await db.saveSummary(env, clientId, { hash, summary, model: summaryModel(env) });
    return jsonResponse({ summary, cached: false, savedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Client summary failed:", error.message);
    // Admin-only page: show the reason (Anthropic's error text, never the key) so a bad model name or key is obvious.
    return jsonResponse({ message: `Couldn't summarize: ${error.message}`.slice(0, 400) }, 502);
  }
}

async function handleSync(env) {
  try {
    const result = await syncClientsFromSquare(env);
    return jsonResponse(result);
  } catch (error) {
    console.error("Square client sync failed:", error.message);
    return jsonResponse({ message: error.message || "Sync failed." }, 502);
  }
}

async function handleUpdateNoteSummary(request, env, noteId) {
  const body = await request.json().catch(() => null);
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  if (!summary) return jsonResponse({ message: "Summary can't be empty." }, 400);
  await db.updateNoteSummary(env, noteId, summary);
  return jsonResponse({ ok: true });
}

async function handleOriginal(env, noteId) {
  const note = await env.CLIENT_NOTES_DB.prepare("SELECT pdf_key FROM notes WHERE id = ?").bind(noteId).first();
  if (!note?.pdf_key) return notFound();
  const object = await storage.getObject(env, note.pdf_key);
  if (!object) return notFound();
  return new Response(object.body, { headers: { "content-type": "application/pdf", "cache-control": "private, max-age=3600" } });
}

export async function handleAdminRequest(request, env, url) {
  const segments = url.pathname.split("/").filter(Boolean); // ["admin", ...]
  const method = request.method;

  if (url.pathname === "/admin/assets/admin.js") {
    return new Response(ADMIN_CLIENT_JS, {
      headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" },
    });
  }

  // The Home Screen app's service worker and offline screen. Public, and they hold no client data.
  if (url.pathname === "/admin/sw.js" && method === "GET") {
    return new Response(SERVICE_WORKER_JS, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-cache",
        // Lets a worker served from /admin/ look after /admin itself (the clients list).
        "service-worker-allowed": "/admin",
      },
    });
  }
  if (url.pathname === "/admin/offline" && method === "GET") {
    return new Response(OFFLINE_HTML, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", "x-robots-tag": "noindex, nofollow" },
    });
  }

  // The Home Screen app's manifest and icons. Public: the phone fetches them without the login cookie.
  if (url.pathname === "/admin/manifest.webmanifest" && method === "GET") {
    return new Response(JSON.stringify(MANIFEST), {
      headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" },
    });
  }
  const iconMatch = url.pathname.match(/^\/admin\/assets\/([a-z0-9-]+\.png)$/);
  if (iconMatch && method === "GET") {
    const bytes = iconBytes(iconMatch[1]);
    if (!bytes) return notFound();
    return new Response(bytes, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
  }

  if (url.pathname === "/admin/login" && method === "GET") {
    if (await isValidSession(env, readSessionCookie(request))) return redirect("/admin");
    return adminHtmlResponse(loginPage({ configured: adminAuthConfigured(env) }));
  }

  if (url.pathname === "/admin/login" && method === "POST") {
    return handleLogin(request, env);
  }

  if (url.pathname === "/admin/logout" && method === "POST") {
    return redirect("/admin/login", { "set-cookie": clearedSessionCookie() });
  }

  const session = await readSession(env, readSessionCookie(request));
  if (!session) {
    if (method === "GET") return redirect("/admin/login");
    return jsonResponse({ message: "Please log in to the admin first." }, 401);
  }

  const response = await handleSignedIn(request, env, url, segments, method);
  // "Keep me signed in": each day of use pushes the 90 days forward, so a phone that is used stays signed in.
  if (!shouldRenew(session)) return response;
  const renewed = new Response(response.body, response);
  renewed.headers.append("set-cookie", sessionCookie(await createSessionToken(env, Date.now(), { remember: true }), { remember: true }));
  return renewed;
}

/** Every route that needs a signed-in session. */
async function handleSignedIn(request, env, url, segments, method) {
  // GET /admin
  if (url.pathname === "/admin" && method === "GET") {
    const clients = await db.listClients(env);
    return adminHtmlResponse(adminPage({ title: "Clients", body: clientsPage({ clients }) }));
  }

  // POST /admin/sync — pulls clients + seller notes from Square bookings
  if (url.pathname === "/admin/sync" && method === "POST") {
    return handleSync(env);
  }

  const clientMatch = segments[1] === "clients" ? segments[2] : null;

  if (clientMatch && segments.length === 3 && method === "GET") {
    const client = await db.getClient(env, clientMatch);
    if (!client) return notFound();
    if (url.searchParams.get("refresh") === "1") {
      // "Refresh from Square": re-read her orders into the stored copy, then show the page without the query.
      await loadClientOrders(env, client, { refresh: true }).catch((error) => console.error("Refresh failed:", error.message));
      return redirect(`/admin/clients/${clientMatch}`);
    }
    const [notes, sourceFiles] = await Promise.all([db.listNotesForClient(env, clientMatch), db.listSourceFiles(env, clientMatch)]);
    const { routine, history, services, spend, flags, purchasesFailed, syncedAt, source } = await loadClientPurchases(env, client, notes);
    const saved = await db.getSavedSummary(env, clientMatch);
    const savedSummary = saved && {
      summary: saved.summary,
      savedAt: saved.createdAt,
      // null when the purchases couldn't be read, so the page doesn't claim it is out of date.
      current: purchasesFailed ? null : saved.hash === (await summaryInputHash(env, { client, notes, routine, history, flags })),
    };
    return adminHtmlResponse(adminPage({ title: client.name, back: { href: "/admin", label: "Clients" }, body: clientProfilePage({ client, notes, routine, history, services, spend, flags, sourceFiles, savedSummary, purchases: { syncedAt, source, failed: purchasesFailed } }) }));
  }

  if (clientMatch && segments[3] === "notes" && segments[4] === "new" && method === "GET") {
    if (!UPLOADS_ENABLED) return notFound();
    const client = await db.getClient(env, clientMatch);
    if (!client) return notFound();
    return adminHtmlResponse(adminPage({ title: `Add a note — ${client.name}`, body: uploadPage({ client }) }));
  }

  if (clientMatch && segments[3] === "notes" && segments.length === 4 && method === "POST") {
    if (!UPLOADS_ENABLED) return notFound();
    return handleUpload(request, env, clientMatch);
  }

  if (clientMatch && segments[3] === "notes" && segments[5] === "confirm" && method === "POST") {
    if (!UPLOADS_ENABLED) return notFound();
    return handleConfirm(request, env, clientMatch, segments[4]);
  }

  if (clientMatch && segments[3] === "insight" && method === "POST") {
    return handleInsight(env, clientMatch, { refresh: url.searchParams.get("refresh") === "1" });
  }

  if (segments[1] === "notes" && segments[3] === "original" && method === "GET") {
    return handleOriginal(env, segments[2]);
  }

  if (segments[1] === "notes" && segments.length === 3 && method === "POST") {
    return handleUpdateNoteSummary(request, env, segments[2]);
  }

  return notFound();
}
