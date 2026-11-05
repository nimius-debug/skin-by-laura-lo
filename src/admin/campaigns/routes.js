// Routes for /admin/campaigns (signed in) and the public unsubscribe page.

import { jsonResponse } from "../../layout.js";
import { adminHtmlResponse, adminPage } from "../layout.js";
import {
  campaignRecipientsPage, campaignReviewPage, campaignsHomePage, migrationNeededPage, newCampaignPage, scheduledPage, unsubscribePage,
} from "../pages/campaigns.js";
import { costHistory } from "./cost.js";
import { contentProducts, defaultButtonLabel, defaultButtonUrl, productCardHtml } from "./email-template.js";
import {
  costEstimateInputs, draftCampaign, MAX_EMAIL_PRODUCTS, productCard, redraftPersonal, redraftShared, shopProducts,
} from "./drafting.js";
import { addSubscription, pushPublicKey } from "./push.js";
import { localTime, reminderSettingKey, REMINDER_DAYS } from "./schedule.js";
import {
  buildMessage, dailyLimit, projectSchedule, queueCampaign, recipientChoices, recipientEstimate, sendingConfigured, sendQueued,
  sendTestEmail, usageSummary, verifyUnsubscribe,
} from "./sending.js";
import { settings } from "../../config.js";
import * as store from "./store.js";
import { transcribeAudio } from "./transcribe.js";
import { voiceHints } from "./voice.js";

const GOALS = new Set(["book", "shop", "news"]);
const DAY_NAMES = { Tue: "Tuesday", Thu: "Thursday" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function redirect(location) {
  return new Response(null, { status: 303, headers: { location, "cache-control": "no-store" } });
}

function withMessage(path, { notice, error }) {
  const url = new URL(path, "https://admin.local");
  if (notice) url.searchParams.set("notice", notice);
  if (error) url.searchParams.set("error", String(error).slice(0, 300));
  return `${url.pathname}${url.search}`;
}

function notFound() {
  return adminHtmlResponse(adminPage({ title: "Not found", active: "campaigns", body: "<p>Not found.</p>" }), { status: 404 });
}

function setupMissing(env) {
  const missing = [];
  if (!env.ANTHROPIC_API_KEY) missing.push("Add the ANTHROPIC_API_KEY secret so the AI can write drafts.");
  if (!env.RESEND_API_KEY) missing.push("Add the RESEND_API_KEY secret (from resend.com) so emails can be sent.");
  if (!env.CAMPAIGN_FROM_EMAIL) missing.push("Set CAMPAIGN_FROM_EMAIL to the address emails come from, on a domain verified in Resend (for example laura@skinbylauralo.com).");
  if (!env.REMINDER_EMAIL) missing.push("Set REMINDER_EMAIL to where the Tuesday and Thursday reminders should go.");
  return missing;
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** This week's emails (Monday to Sunday, Tampa time) and when the next reminder comes. */
export function weekSummary(campaigns, now, enabledDays) {
  const local = localTime(now);
  const monday = addDays(local.date, -WEEKDAYS.indexOf(local.weekday));
  const thisWeek = campaigns.filter((campaign) => localTime(new Date(`${campaign.created_at.replace(" ", "T")}Z`)).date >= monday);
  let nextReminder = "Reminders are off.";
  for (let offset = 0; offset < 8; offset += 1) {
    const weekday = WEEKDAYS[(WEEKDAYS.indexOf(local.weekday) + offset) % 7];
    if (!REMINDER_DAYS.includes(weekday) || !enabledDays.includes(weekday)) continue;
    if (offset === 0 && local.hour >= 9) continue;
    nextReminder = `Next reminder: ${offset === 0 ? "today" : DAY_NAMES[weekday]} at 9:00 am.`;
    break;
  }
  return { count: thisWeek.length, campaigns: thisWeek, nextReminder };
}

async function reminderSwitches(env) {
  return Promise.all(REMINDER_DAYS.map(async (weekday) => ({
    key: reminderSettingKey(weekday),
    weekday,
    label: `${DAY_NAMES[weekday]} reminder`,
    on: (await store.getSetting(env, reminderSettingKey(weekday), "on")) !== "off",
  })));
}

/** Measured prompt sizes for the cost estimate, or null if the shop or notes can't be read right now. */
async function estimateInputsOrNull(env, goal) {
  try {
    return await costEstimateInputs(env, { goal });
  } catch (error) {
    console.error("Measuring the cost estimate failed:", error.message);
    return null;
  }
}

async function homePage(env, url) {
  const [campaigns, reminders] = await Promise.all([store.listCampaigns(env, 20), reminderSwitches(env)]);
  const week = weekSummary(campaigns, new Date(), reminders.filter((reminder) => reminder.on).map((reminder) => reminder.weekday));
  return adminHtmlResponse(adminPage({
    title: "Email campaigns",
    active: "campaigns",
    body: campaignsHomePage({
      campaigns, week, reminders, missing: setupMissing(env), dailyLimit: dailyLimit(env),
      notice: url.searchParams.get("notice"), error: url.searchParams.get("error"),
    }),
  }));
}

async function handleDraft(request, env) {
  const wantsJson = (request.headers.get("accept") || "").includes("application/json");
  const form = await request.formData().catch(() => null);
  const topic = String(form?.get("topic") || "").trim().slice(0, 4000);
  const goal = GOALS.has(String(form?.get("goal"))) ? String(form.get("goal")) : "book";
  const fail = (message, status) => (wantsJson
    ? jsonResponse({ message }, status)
    : redirect(withMessage(`/admin/campaigns/new?topic=${encodeURIComponent(topic)}`, { error: message })));
  if (topic.length < 10) return fail("Write a sentence or two about this week's topic first.", 400);
  // Without the switch on the page (an old tab, no script), personal notes stay on.
  const personalize = !form.has("personalizeShown") || form.get("personalize") === "on";
  const recipients = pickedRecipients(form);
  if (recipients && !recipients.length) return fail("Pick at least one person to send this email to.", 400);
  try {
    // Checked before any AI call, so a missing migration costs nothing.
    await env.CLIENT_NOTES_DB.prepare("SELECT audience_json FROM email_campaigns LIMIT 0").all();
  } catch (error) {
    if (store.isMissingSchema(error)) return fail("The database needs an update before drafting: run migrations/0009_campaign_audience.sql (see the README).", 503);
    throw error;
  }
  try {
    const id = await draftCampaign(env, { topic, goal, personalize, recipients });
    return wantsJson ? jsonResponse({ redirect: `/admin/campaigns/${id}` }) : redirect(`/admin/campaigns/${id}`);
  } catch (error) {
    console.error("Drafting a campaign failed:", error.message);
    return fail(`Couldn't draft the email: ${error.message}`.slice(0, 300), 502);
  }
}

const EMAIL_PATTERN = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

/**
 * The people picked in the recipient list: [{ email, customerId }], or null when
 * the form had no list (sent without the script), which means everyone.
 */
export function pickedRecipients(form) {
  if (!form?.has("recipients")) return null;
  let list;
  try {
    list = JSON.parse(String(form.get("recipients")));
  } catch {
    return null;
  }
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const picked = [];
  for (const entry of list.slice(0, 5000)) {
    const email = String(entry?.email || "").trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email) || seen.has(email)) continue;
    seen.add(email);
    picked.push({ email, customerId: String(entry?.customerId || "").slice(0, 64) || null });
  }
  return picked;
}

/** Today's usage and the queue, for the picker's "goes out today / tomorrow" line. */
async function sendingOutlook(env) {
  const [usage, queue] = await Promise.all([usageSummary(env), store.queuedByCampaign(env)]);
  return { usage, queued: queue.reduce((sum, entry) => sum + entry.count, 0), today: new Date().toISOString().slice(0, 10) };
}

/** The recipient list as JSON, for the picker. */
async function handleRecipients(env) {
  try {
    const [recipients, outlook] = await Promise.all([recipientChoices(env), sendingOutlook(env)]);
    return jsonResponse({ recipients, ...outlook });
  } catch (error) {
    console.error("Loading recipients failed:", error.message);
    return jsonResponse({ message: error.message || "Couldn't load the client list from Square." }, 502);
  }
}

async function handleTranscribe(request, env) {
  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    return jsonResponse({ text: await transcribeAudio(env, bytes) });
  } catch (error) {
    console.error("Transcribing failed:", error.message);
    return jsonResponse({ message: error.message || "Couldn't type out the recording." }, 400);
  }
}

/** The email as the preview shows it. With `editing`, the version's own parts are marked for the editor. */
function previewFor(env, campaign, version, { editing = false } = {}) {
  const firstName = version.isShared ? "" : String(version.client_name || "").trim().split(/\s+/)[0];
  return buildMessage({
    campaign, version, send: { first_name: firstName },
    siteUrl: settings(env).siteUrl, unsubscribe: `${settings(env).siteUrl}/email/unsubscribe`,
    editable: editing ? (version.isShared ? "shared" : "personal") : null,
  }).html;
}

async function reviewPage(env, url, campaignId) {
  const campaign = await store.getCampaign(env, campaignId);
  if (!campaign) return notFound();
  const versions = await store.listVersions(env, campaignId);
  const requested = url.searchParams.get("v");
  const selected = versions.find((version) => version.id === requested) || versions[0];
  const view = url.searchParams.get("view") === "preview" || (requested && url.searchParams.get("view") !== "list") ? "preview" : "list";
  // While a campaign is in review, the email itself is the editor.
  const editing = campaign.status === "review";
  const picked = campaign.audience.emails;
  const [counts, estimate, costInputs, shop, usage, queue] = await Promise.all([
    store.sendCounts(env, campaignId),
    campaign.status === "review" ? (picked ? picked.length : recipientEstimate(env)) : null,
    // Only a rejected version shows the redraft button and what it costs.
    campaign.status === "review" && selected.status === "rejected" ? estimateInputsOrNull(env, campaign.goal) : null,
    // The shared email's editor offers the shop's products to add.
    editing && selected.isShared ? shopProducts(env) : [],
    campaign.status === "review" ? usageSummary(env) : null,
    campaign.status === "review" ? store.queuedByCampaign(env) : [],
  ]);
  // When this one would go out, behind whatever is already queued.
  const schedule = usage && estimate
    ? projectSchedule({ queue: [...queue.map((entry) => ({ id: entry.campaignId, count: entry.count })), { id: campaignId, count: estimate }], usage })
      .map((day) => ({ date: day.date, count: day.parts.filter((part) => part.id === campaignId).reduce((sum, part) => sum + part.count, 0) }))
      .filter((day) => day.count)
    : [];
  return adminHtmlResponse(adminPage({
    title: campaign.content.eyebrow || "Review",
    active: "campaigns",
    back: { href: "/admin/campaigns", label: "Campaigns" },
    body: campaignReviewPage({
      campaign, versions, selected, view,
      previewHtml: previewFor(env, campaign, selected, { editing }),
      counts, estimate, picked: Boolean(picked), schedule, costInputs, dailyLimit: dailyLimit(env), editing, shop,
      hints: voiceHints(versionText(campaign, selected)),
      canTest: sendingConfigured(env) && Boolean(env.REMINDER_EMAIL),
      notice: url.searchParams.get("notice"), error: url.searchParams.get("error"),
    }),
  }));
}

const lines = (text) => String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const paragraphs = (text) => String(text || "").split(/\r?\n\s*\r?\n/).map((block) => block.trim()).filter(Boolean);
const field = (form, name, max) => String(form.get(name) || "").trim().slice(0, max);

/** The words in a version that Laura's voice guide applies to. */
function versionText(campaign, version) {
  if (!version.isShared) return [version.personal?.personalNote, version.personal?.product?.note, version.personal?.ps];
  const content = campaign.content;
  return [...(content.paragraphs || []), ...(content.tips || []), content.ps, ...contentProducts(content).map((card) => card.note)];
}

/** A web address Laura typed for the button, or "" if it isn't one. */
function buttonAddress(value) {
  let address = String(value || "").trim();
  if (!address) return "";
  if (!/^https?:\/\//i.test(address)) address = `https://${address}`;
  try {
    const url = new URL(address);
    return url.hostname.includes(".") || url.hostname === "localhost" ? url.href : "";
  } catch {
    return "";
  }
}

/**
 * The shared email's products as the editor left them: the ones still ticked,
 * in order, plus any added from the shop. A card already in the email keeps its note.
 */
function pickedProducts(form, current, { shop, siteUrl }) {
  const names = [...new Set(form.getAll("product").map((name) => String(name).trim()).filter(Boolean))];
  const cards = [];
  for (const name of names) {
    const card = current.find((entry) => entry.name === name)
      || (shop.some((product) => product.name === name) ? productCard({ name, products: shop, siteUrl, label: "" }) : null);
    if (card) cards.push(card);
  }
  return cards.slice(0, MAX_EMAIL_PRODUCTS);
}

/**
 * The campaign and version as the editor's form would leave them. Pure: nothing is saved.
 * `shop` is the shop's products, for products Laura adds to the shared email.
 */
export function applyEdits(campaign, version, form, { shop = [], siteUrl = "" } = {}) {
  if (version.isShared) {
    const goal = GOALS.has(String(form.get("goal"))) ? String(form.get("goal")) : campaign.goal;
    // Laura's own wording, kept only where it differs from the usual words.
    const own = (name, max, usual) => {
      const value = form.has(name) ? field(form, name, max) : String(campaign.content[name] || "");
      return value && value !== usual ? value : "";
    };
    const content = {
      ...campaign.content,
      subject: field(form, "subject", 120) || campaign.content.subject,
      preheader: field(form, "preheader", 160),
      eyebrow: field(form, "eyebrow", 60),
      headline: field(form, "headline", 140) || campaign.content.headline,
      paragraphs: paragraphs(form.get("paragraphs")).slice(0, 8),
      tipsTitle: field(form, "tipsTitle", 80),
      tips: lines(form.get("tips")).slice(0, 8),
      ps: field(form, "ps", 600),
      greeting: own("greeting", 40, "Hi"),
      fallbackName: own("fallbackName", 40, "there"),
      buttonLabel: own("buttonLabel", 40, defaultButtonLabel(goal)),
      // The usual page for the button choice isn't stored, so switching the button follows it.
      buttonUrl: buttonAddress(own("buttonUrl", 500, buttonAddress(defaultButtonUrl(siteUrl, goal)))),
      signoff: own("signoff", 60, "See you soon,"),
      signName: own("signName", 40, "Laura"),
      shopTitle: own("shopTitle", 60, "From the shop"),
    };
    if (form.has("productsShown")) {
      content.products = pickedProducts(form, contentProducts(campaign.content), { shop, siteUrl });
      delete content.product;
    }
    return { campaign: { ...campaign, content, goal }, version };
  }
  const personal = { ...version.personal, personalNote: field(form, "personalNote", 1200), ps: field(form, "ps", 600) };
  if (personal.product) personal.product = { ...personal.product, note: field(form, "productNote", 300) };
  return { campaign, version: { ...version, personal } };
}

/** What applyEdits needs beyond the form: the shop, read only when the shared email's products were edited. */
async function editContext(env, version, form) {
  const shop = version.isShared && form.has("productsShown") ? await shopProducts(env) : [];
  return { shop, siteUrl: settings(env).siteUrl };
}

/** The editor's live preview: the email as it would look with the unsaved changes, and the voice hints. */
async function handlePreview(request, env, campaignId, versionId) {
  const [campaign, version] = await Promise.all([store.getCampaign(env, campaignId), store.getVersion(env, versionId)]);
  if (!campaign || !version || version.campaign_id !== campaignId) return jsonResponse({ message: "Not found" }, 404);
  const form = await request.formData().catch(() => new FormData());
  const edited = applyEdits(campaign, version, form, await editContext(env, version, form));
  return jsonResponse({
    html: previewFor(env, edited.campaign, edited.version),
    hints: voiceHints(versionText(edited.campaign, edited.version)),
  });
}

async function handleVersionAction(request, env, campaignId, versionId) {
  const [campaign, version] = await Promise.all([store.getCampaign(env, campaignId), store.getVersion(env, versionId)]);
  if (!campaign || !version || version.campaign_id !== campaignId) return notFound();
  const back = `/admin/campaigns/${campaignId}?v=${versionId}&view=preview`;
  // The editor saves as Laura types and wants a JSON answer, not a page.
  const wantsJson = (request.headers.get("accept") || "").includes("application/json");
  const fail = (message) => (wantsJson ? jsonResponse({ message }, 409) : redirect(withMessage(back, { error: message })));
  if (campaign.status !== "review") return fail("This email is already sending, so it can't be changed.");
  const form = await request.formData().catch(() => new FormData());
  const action = String(form.get("action") || "");

  try {
    if (action === "approve" || action === "review" || action === "reject") {
      await store.updateVersion(env, versionId, { status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "review" });
      return redirect(back);
    }
    if (action === "save") {
      const edited = applyEdits(campaign, version, form, await editContext(env, version, form));
      if (version.isShared) await store.updateCampaign(env, campaignId, { content: edited.campaign.content, goal: edited.campaign.goal });
      else await store.updateVersion(env, versionId, { personal: edited.version.personal });
      // Laura's own edits don't need approving again, so the version keeps its status.
      if (wantsJson) return jsonResponse({ ok: true, savedAt: new Date().toISOString() });
      return redirect(withMessage(back, { notice: "Saved." }));
    }
    if (action === "redraft") {
      const feedback = field(form, "feedback", 1000);
      if (!feedback) return redirect(withMessage(back, { error: "Say what should change, then redraft." }));
      if (version.isShared) await redraftShared(env, { campaign, version, feedback });
      else await redraftPersonal(env, { campaign, version, feedback });
      return redirect(withMessage(back, { notice: "Redrafted with your note. Read it again before approving." }));
    }
  } catch (error) {
    console.error("Campaign version action failed:", error.message);
    return fail(`Couldn't do that: ${error.message}`);
  }
  return redirect(back);
}

/** Approve, reject or un-approve several versions at once, from the ticked boxes in the list. */
async function handleBulkVersions(request, env, campaignId) {
  const campaign = await store.getCampaign(env, campaignId);
  if (!campaign) return notFound();
  const form = await request.formData().catch(() => new FormData());
  const action = String(form.get("action") || "");
  const ids = form.getAll("ids").map(String).filter(Boolean);
  const current = String(form.get("v") || "");
  const back = `/admin/campaigns/${campaignId}${current ? `?v=${encodeURIComponent(current)}` : ""}`;
  const status = { approve: "approved", reject: "rejected", review: "review" }[action];
  if (campaign.status !== "review") return redirect(withMessage(back, { error: "This email is already sending, so it can't be changed." }));
  if (!status) return redirect(back);
  if (!ids.length) return redirect(withMessage(back, { error: "Tick the versions you want to change first." }));
  const versions = await store.listVersions(env, campaignId);
  const valid = ids.filter((id) => versions.some((version) => version.id === id));
  await store.updateVersionStatuses(env, campaignId, valid, status);
  const word = { approved: "Approved", rejected: "Rejected", review: "Moved back to review:" }[status];
  return redirect(withMessage(back, { notice: `${word} ${valid.length} version${valid.length === 1 ? "" : "s"}.` }));
}

/** The editor adds a product to the email: its card, as the email shows it. */
async function handleProductCard(env, url) {
  const name = String(url.searchParams.get("name") || "");
  const shop = await shopProducts(env);
  if (!shop.some((product) => product.name === name)) return jsonResponse({ message: "That product isn't in the shop." }, 404);
  const card = productCard({ name, products: shop, siteUrl: settings(env).siteUrl, label: "" });
  return jsonResponse({ name: card.name, html: productCardHtml(card, { removable: true }) });
}

async function recipientsPage(env, url, campaignId) {
  const campaign = await store.getCampaign(env, campaignId);
  if (!campaign) return notFound();
  return adminHtmlResponse(adminPage({
    title: "Who gets it",
    active: "campaigns",
    back: { href: `/admin/campaigns/${campaignId}`, label: "Review" },
    body: campaignRecipientsPage({ campaign, error: url.searchParams.get("error") }),
  }));
}

async function handleSaveRecipients(request, env, campaignId) {
  const campaign = await store.getCampaign(env, campaignId);
  if (!campaign) return notFound();
  const back = `/admin/campaigns/${campaignId}`;
  if (campaign.status !== "review") return redirect(withMessage(back, { error: "This email is already sending, so who gets it can't change." }));
  const form = await request.formData().catch(() => new FormData());
  const recipients = pickedRecipients(form);
  if (!recipients) return redirect(back);
  if (!recipients.length) return redirect(withMessage(`${back}/recipients`, { error: "Pick at least one person." }));
  await store.updateCampaign(env, campaignId, { audience: { personalize: campaign.audience.personalize, emails: recipients.map((recipient) => recipient.email) } });
  return redirect(withMessage(back, { notice: `Saved: this email goes to ${recipients.length} ${recipients.length === 1 ? "person" : "people"}.` }));
}

/** The Scheduled page: Resend usage, what goes out on which day, and how the sent emails did. */
async function scheduled(env, url) {
  const now = new Date();
  const [usage, queue, stats, recent] = await Promise.all([
    usageSummary(env, { now }), store.queuedByCampaign(env), store.deliveryStats(env), store.recentSends(env),
  ]);
  const names = new Map(stats.map((row) => [row.id, row]));
  for (const entry of queue) {
    if (!names.has(entry.campaignId)) {
      const campaign = await store.getCampaign(env, entry.campaignId);
      if (campaign) names.set(entry.campaignId, campaign);
    }
  }
  const days = projectSchedule({ queue: queue.map((entry) => ({ id: entry.campaignId, count: entry.count })), usage, now });
  return adminHtmlResponse(adminPage({
    title: "Scheduled emails",
    active: "campaigns:scheduled",
    body: scheduledPage({
      usage, days, campaigns: names, stats, recent, now,
      tracking: Boolean(env.RESEND_WEBHOOK_SECRET), configured: sendingConfigured(env),
      siteUrl: settings(env).siteUrl,
      notice: url.searchParams.get("notice"), error: url.searchParams.get("error"),
    }),
  }));
}

async function handleSend(env, campaignId) {
  const campaign = await store.getCampaign(env, campaignId);
  if (!campaign) return notFound();
  const back = `/admin/campaigns/${campaignId}`;
  if (campaign.status !== "review") return redirect(back);
  if (!sendingConfigured(env)) return redirect(withMessage(back, { error: "Email sending isn't set up yet. See the Campaigns page for what's missing." }));
  try {
    const { queued, personal } = await queueCampaign(env, campaignId);
    await sendQueued(env).catch((error) => console.error("First send failed:", error.message));
    // The run may also have sent another campaign's queue, so count this one's own.
    const counts = await store.sendCounts(env, campaignId);
    const sentNow = counts.sent;
    const later = counts.queued;
    let rest = "";
    if (later > 0) {
      const [usage, queue] = await Promise.all([usageSummary(env), store.queuedByCampaign(env)]);
      const days = projectSchedule({ queue: queue.map((entry) => ({ id: entry.campaignId, count: entry.count })), usage })
        .map((day) => ({ date: day.date, count: day.parts.filter((part) => part.id === campaignId).reduce((sum, part) => sum + part.count, 0) }))
        .filter((day) => day.count);
      const last = days[days.length - 1];
      rest = last ? `, the other ${later} are scheduled and finish ${dayLabel(last.date)}` : `, the other ${later} are scheduled`;
    }
    const notice = `Sending to ${queued} ${queued === 1 ? "person" : "people"} (${personal} personal). ${sentNow} sent now${rest}. See Scheduled for progress.`;
    return redirect(withMessage(back, { notice }));
  } catch (error) {
    console.error("Queueing a campaign failed:", error.message);
    return redirect(withMessage(back, { error: error.message }));
  }
}

async function handleTest(request, env, campaignId) {
  const campaign = await store.getCampaign(env, campaignId);
  if (!campaign) return notFound();
  const form = await request.formData().catch(() => new FormData());
  const picked = await store.getVersion(env, String(form.get("v") || ""));
  const version = picked?.campaign_id === campaignId ? picked : (await store.listVersions(env, campaignId))[0];
  const back = `/admin/campaigns/${campaignId}?v=${version.id}&view=preview`;
  try {
    await sendTestEmail(env, { campaign, version, to: env.REMINDER_EMAIL });
    return redirect(withMessage(back, { notice: `Test sent to ${env.REMINDER_EMAIL}.` }));
  } catch (error) {
    return redirect(withMessage(back, { error: error.message }));
  }
}

async function handleSettings(request, env) {
  const form = await request.formData().catch(() => new FormData());
  for (const weekday of REMINDER_DAYS) {
    const key = reminderSettingKey(weekday);
    await store.setSetting(env, key, form.get(key) === "on" ? "on" : "off");
  }
  const wantsJson = (request.headers.get("accept") || "").includes("application/json");
  return wantsJson ? jsonResponse({ ok: true }) : redirect(withMessage("/admin/campaigns", { notice: "Reminders saved." }));
}

async function handlePushSubscribe(request, env) {
  try {
    const subscription = await request.json();
    const count = await addSubscription(env, subscription);
    return jsonResponse({ ok: true, count });
  } catch (error) {
    return jsonResponse({ message: error.message || "Couldn't save the notification setting." }, 400);
  }
}

/** "on Tue, Oct 27" for a UTC date. */
function dayLabel(date) {
  return `on ${new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}`;
}

/** Signed-in /admin/campaigns routes. Returns null for paths that aren't campaign routes. */
export async function handleCampaignRoute(request, env, url, segments, method) {
  if (segments[1] !== "campaigns") return null;
  try {
    return await campaignRoute(request, env, url, segments, method);
  } catch (error) {
    // A deploy that ran ahead of its migration: say what to run instead of a bare 1101.
    if (!store.isMissingSchema(error)) throw error;
    console.error("Campaign route needs a migration:", error.message);
    return adminHtmlResponse(adminPage({
      title: "Database update needed",
      active: "campaigns",
      body: migrationNeededPage(),
    }), { status: 503 });
  }
}

async function campaignRoute(request, env, url, segments, method) {
  const [, , first, second, third] = segments;

  if (!first && method === "GET") return homePage(env, url);
  if (!first && method === "POST") return handleDraft(request, env);
  if (first === "new" && !second && method === "GET") {
    const [estimate, recent] = await Promise.all([estimateInputsOrNull(env, "book"), store.listCampaigns(env, 10)]);
    return adminHtmlResponse(adminPage({
      title: "New email",
      active: "campaigns",
      back: { href: "/admin/campaigns", label: "Campaigns" },
      body: newCampaignPage({
        topic: url.searchParams.get("topic") || "", missing: setupMissing(env), error: url.searchParams.get("error"),
        estimate, history: costHistory(recent),
      }),
    }));
  }
  if (first === "transcribe" && method === "POST") return handleTranscribe(request, env);
  if (first === "recipients" && !second && method === "GET") return handleRecipients(env);
  if (first === "scheduled" && !second && method === "GET") return scheduled(env, url);
  if (first === "product-card" && method === "GET") return handleProductCard(env, url);
  if (first === "settings" && method === "POST") return handleSettings(request, env);
  if (first === "push-key" && method === "GET") return jsonResponse({ publicKey: await pushPublicKey(env) });
  if (first === "push" && method === "POST") return handlePushSubscribe(request, env);

  if (first && !second && method === "GET") return reviewPage(env, url, first);
  if (first && second === "versions" && third === "bulk" && method === "POST") return handleBulkVersions(request, env, first);
  if (first && second === "versions" && third && segments[5] === "preview" && method === "POST") return handlePreview(request, env, first, third);
  if (first && second === "recipients" && method === "GET") return recipientsPage(env, url, first);
  if (first && second === "recipients" && method === "POST") return handleSaveRecipients(request, env, first);
  if (first && second === "versions" && third && method === "POST") return handleVersionAction(request, env, first, third);
  if (first && second === "send" && method === "POST") return handleSend(env, first);
  if (first && second === "test" && method === "POST") return handleTest(request, env, first);
  if (first && second === "delete" && method === "POST") {
    await store.deleteDraftCampaign(env, first);
    return redirect(withMessage("/admin/campaigns", { notice: "Draft deleted." }));
  }
  return notFound();
}

/** Public: /email/unsubscribe. A GET shows a button (so link scanners can't unsubscribe anyone); a POST unsubscribes. */
export async function handleUnsubscribe(request, env, url) {
  const respond = (markup, status = 200) => new Response(markup, {
    status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });
  if (request.method === "POST") {
    const form = await request.formData().catch(() => new FormData());
    // Mail apps' one-click unsubscribe posts to the link itself, so the details may be in the URL.
    const email = String(form.get("e") || url.searchParams.get("e") || "").trim().toLowerCase();
    const token = String(form.get("t") || url.searchParams.get("t") || "");
    if (!(await verifyUnsubscribe(env, email, token))) return respond(unsubscribePage({ state: "invalid" }), 400);
    await store.addUnsubscribe(env, email);
    return respond(unsubscribePage({ state: "done" }));
  }
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();
  const token = String(url.searchParams.get("t") || "");
  if (!(await verifyUnsubscribe(env, email, token))) return respond(unsubscribePage({ state: "invalid" }), 400);
  return respond(unsubscribePage({ state: "ask", email, token }));
}
