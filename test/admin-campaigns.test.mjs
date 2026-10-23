import { createD1, schemaMigrations } from "./helpers/d1-sqlite.mjs";
import { contentProducts, renderEmail } from "../src/admin/campaigns/email-template.js";
import { buildProfile, pickCandidates, scoreProfile } from "../src/admin/campaigns/matching.js";
import * as store from "../src/admin/campaigns/store.js";
import { buildMessage, planSends, sendQueued, unsubscribeUrl, verifyUnsubscribe } from "../src/admin/campaigns/sending.js";
import { localTime, maybeRemind, reminderDue } from "../src/admin/campaigns/schedule.js";
import { applyEdits, handleCampaignRoute, handleUnsubscribe, weekSummary } from "../src/admin/campaigns/routes.js";
import { draftCampaign, namedInTopic, productCard, redraftPersonal, sharedProductCards } from "../src/admin/campaigns/drafting.js";
import { addSubscription, listSubscriptions, notifyPhones } from "../src/admin/campaigns/push.js";
import { costHistory, costOf, estimateCampaign, estimateInputs, formatCost } from "../src/admin/campaigns/cost.js";
import { voiceHints } from "../src/admin/campaigns/voice.js";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}` + (ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`));
}

const SITE = "https://skinbylauralo.com";
const content = {
  subject: "Fading dark spots", preheader: "Gentle beats harsh", eyebrow: "This week: pigmentation",
  headline: "Dark spots fade with patience", paragraphs: ["First <b>paragraph</b>.", "Second\nline."],
  tipsTitle: "What helps", tips: ["Wear SPF every day."], productName: "",
  product: { label: "Worth a look", name: "Mixi Mandelic Acid 5%", goodFor: "Beginners.", note: "", url: `${SITE}/product/mixi-mandelic-acid-5`, image: "" },
};

// --- the email ----------------------------------------------------------------
{
  const shared = renderEmail({ content, firstName: "", goal: "book", siteUrl: SITE, unsubscribeUrl: `${SITE}/email/unsubscribe?e=a&t=b` });
  check("a shared email greets 'there' when no first name is known", shared.html.includes("Hi there,"), true);
  check("AI and edited text is escaped, never trusted as markup", [shared.html.includes("<b>paragraph</b>"), shared.html.includes("First &lt;b&gt;paragraph&lt;/b&gt;.")], [false, true]);
  check("line breaks inside a paragraph are kept", shared.html.includes("Second<br>line."), true);
  check("the booking goal adds the Book a facial button", shared.html.includes(`href="${SITE}/booking"`) && shared.html.includes("Book a facial"), true);
  check("every email has the address and an unsubscribe link", shared.html.includes("307 S Boulevard Ste D, Tampa, FL 33606") && shared.html.includes("Unsubscribe</a>"), true);
  check("there is a plain-text copy with the unsubscribe link", shared.text.includes(`Unsubscribe: ${SITE}/email/unsubscribe?e=a&t=b`), true);
  check("a shared email has no personal note", shared.html.includes("A note just for you"), false);

  const personal = renderEmail({ content, personal: { personalNote: "Keep up the <mandelic>." }, firstName: "Maya", goal: "news", siteUrl: SITE, unsubscribeUrl: "u" });
  check("a personal version greets by first name and shows the note, escaped", [personal.html.includes("Hi Maya,"), personal.html.includes("Keep up the &lt;mandelic&gt;.")], [true, true]);
  check("the 'just news' goal has no sales button", personal.html.includes("Book a facial") || personal.html.includes("Visit the shop"), false);

  const extras = renderEmail({
    content: { ...content, paragraphs: ["This is **SO** important. See https://skinbylauralo.com/booking."], ps: "Two spots left Saturday" },
    personal: { personalNote: "Proud of you.", ps: "Bring your SPF" }, firstName: "Maya", goal: "book", siteUrl: SITE, unsubscribeUrl: "u",
  });
  check("**bold** and web addresses are formatted, and the link keeps the final period out",
    [extras.html.includes("<strong>SO</strong>"), extras.html.includes('href="https://skinbylauralo.com/booking"')], [true, true]);
  check("the shared P.S. and the personal P.S. both show after Laura's name",
    [extras.html.includes("Two spots left Saturday"), extras.html.includes("Bring your SPF"), extras.text.includes("P.S. Two spots left Saturday")], [true, true, true]);
  check("the plain-text copy drops the ** marks", extras.text.includes("This is SO important."), true);
  const named = renderEmail({ content: { ...content, paragraphs: ["Read [my routine](https://skinbylauralo.com/shop) tonight."] }, goal: "news", siteUrl: SITE, unsubscribeUrl: "u" });
  check("a named link shows its words in the email and the address in the plain copy",
    [named.html.includes('href="https://skinbylauralo.com/shop"') && named.html.includes(">my routine</a>"), named.text.includes("Read my routine (https://skinbylauralo.com/shop) tonight.")], [true, true]);
  check("an email that is sent is never editable", extras.html.includes("data-edit") || extras.html.includes("contenteditable"), false);
}

// --- matching -----------------------------------------------------------------
{
  const profile = (id, name, noteText, purchases = []) => buildProfile({
    client: { id, name },
    notes: [{ id: `n-${id}`, source: "square", note_date: "2026-09-01", summary: noteText, extracted_text: "" }],
    purchases,
  });
  const maya = profile("c1", "Maya Rivers", "PIH on cheeks after breakouts, started mandelic");
  const jordan = profile("c2", "Jordan Tate", "Wants even tone", [{ name: "Mixi Mandelic Acid 8%", orderedAt: "2026-08-01T00:00:00Z" }]);
  const priya = profile("c3", "Priya Shah", "Pineapple enzyme peel, loved it");
  const terms = ["pih", "mandelic", "even tone"];
  check("short shorthand like 'pih' matches only as a whole word", [scoreProfile(maya, ["pih"]).score, scoreProfile(priya, ["pih"]).score], [1, 0]);
  check("purchases count as well as notes", scoreProfile(jordan, terms).hits, ["mandelic", "even tone"]);
  check("candidates are clients with a hit, strongest first", pickCandidates([priya, jordan, maya], terms).map((match) => match.profile.firstName), ["Jordan", "Maya"]);
  const many = Array.from({ length: 40 }, (_, index) => profile(`m${index}`, `Client ${index}`, "Working on PIH"));
  check("every client with a hit is a candidate, with no cap", pickCandidates(many, terms).length, 40);
}

// --- product cards ------------------------------------------------------------
{
  const products = [
    { name: "Mixi Mandelic Acid 5%", slug: "mixi-mandelic-acid-5", image: "https://img/x.png", priceCents: 3200 },
    { name: "Daily SPF 50", slug: "daily-spf-50", image: "", priceCents: 4450 },
    { name: "Vitamin C Serum", slug: "vitamin-c-serum", image: "https://img/c.png", priceCents: 5800 },
  ];
  check("a product picked by name links to its shop page, with its photo and price", productCard({ name: "mixi mandelic acid 5%", products, siteUrl: SITE, label: "Worth a look" }),
    { label: "Worth a look", name: "Mixi Mandelic Acid 5%", goodFor: productCard({ name: "Mixi Mandelic Acid 5%", products, siteUrl: SITE, label: "" }).goodFor, note: "", url: `${SITE}/product/mixi-mandelic-acid-5`, image: "https://img/x.png", price: "$32.00" });
  check("a product no longer in the shop shows by name without a link or price", [productCard({ name: "Old Serum", products, siteUrl: SITE, label: "x" }).url, productCard({ name: "Old Serum", products, siteUrl: SITE, label: "x" }).price], ["", ""]);
  check("no product name means no card", productCard({ name: "", products, siteUrl: SITE, label: "x" }), null);

  check("products typed out in the topic are found in the order Laura wrote them",
    namedInTopic("Wear your daily spf 50, and the Mixi Mandelic Acid 5% at night.", products), ["Daily SPF 50", "Mixi Mandelic Acid 5%"]);
  const cards = sharedProductCards({
    picks: [{ name: "Vitamin C Serum", note: "My morning glow step" }, { name: "Daily SPF 50", note: "" }],
    skip: false, topic: "Talk about the vitamin c and Daily SPF 50 and Mixi Mandelic Acid 5%", products, siteUrl: SITE,
  });
  check("every product Laura mentions gets a card: the AI's picks first, then any it missed, without repeats",
    cards.map((card) => [card.name, card.note, card.price]), [["Vitamin C Serum", "My morning glow step", "$58.00"], ["Daily SPF 50", "", "$44.50"], ["Mixi Mandelic Acid 5%", "", "$32.00"]]);
  check("when Laura says no products, there are none, even ones she named",
    sharedProductCards({ picks: [], skip: true, topic: "Daily SPF 50, but no products this time", products, siteUrl: SITE }), []);
  const many = Array.from({ length: 9 }, (_, index) => ({ name: `P${index}`, note: "" }));
  check("an email has at most six product cards", sharedProductCards({ picks: many, skip: false, topic: "", products, siteUrl: SITE }).length, 6);
  check("campaigns saved with one product card still show it", [contentProducts({ product: { name: "A" } }), contentProducts({ products: [], product: { name: "A" } })], [[{ name: "A" }], []]);

  const email = renderEmail({ content: { ...content, product: undefined }, products: cards, goal: "shop", siteUrl: SITE, unsubscribeUrl: "u" });
  check("each product shows as a card with its name, price, note and shop link",
    [email.html.includes("From the shop"), ...cards.map((card) => email.html.includes(card.name) && email.html.includes(card.price)), email.html.includes("My morning glow step"), email.html.includes(`href="${SITE}/product/daily-spf-50"`), email.html.includes('src="https://img/c.png"')],
    [true, true, true, true, true, true, true]);
  check("the plain-text copy lists the products with prices and links",
    [email.text.includes("Vitamin C Serum ($58.00)"), email.text.includes(`${SITE}/product/vitamin-c-serum`)], [true, true]);
  check("an email without products has no shop section", renderEmail({ content, goal: "shop", siteUrl: SITE, unsubscribeUrl: "u" }).html.includes("From the shop"), false);

  const campaign = { goal: "shop", content: { ...content, product: undefined, products: cards } };
  const personalVersion = { isShared: false, personal: { personalNote: "Hi", product: { ...cards[1], label: "From your routine", note: "Bought in May." } } };
  const personalEmail = buildMessage({ campaign, version: personalVersion, send: { first_name: "Maya" }, siteUrl: SITE, unsubscribe: "u" });
  check("a personal version shows the client's own product first, then the shared ones, without repeating it",
    [personalEmail.text.indexOf("From your routine: Daily SPF 50") < personalEmail.text.indexOf("Vitamin C Serum"), personalEmail.text.split("Daily SPF 50").length - 1], [true, 1]);

  const form = (fields) => { const data = new FormData(); for (const [key, value] of fields) data.append(key, value); return data; };
  const shared = { isShared: true };
  const edited = applyEdits(campaign, shared, form([["subject", "S"], ["headline", "H"], ["productsShown", "1"], ["product", "Daily SPF 50"], ["product", "Mixi Mandelic Acid 5%"], ["product", "Not In The Shop"], ["product", ""]]), { shop: products, siteUrl: SITE });
  check("in the editor, an unticked product is taken out, one added from the shop gets a card, and unknown names are ignored",
    edited.campaign.content.products.map((card) => [card.name, card.price]), [["Daily SPF 50", "$44.50"], ["Mixi Mandelic Acid 5%", "$32.00"]]);
  check("a form without the product picker leaves the products as they were", applyEdits(campaign, shared, form([["subject", "S"]])).campaign.content.products.length, 3);
}

// --- who gets which version ----------------------------------------------------
{
  const versions = [
    { id: "shared", isShared: true, status: "approved" },
    { id: "v-maya", isShared: false, client_id: "c1", status: "approved" },
    { id: "v-jordan", isShared: false, client_id: "c2", status: "rejected" },
  ];
  const clients = [{ id: "c1", name: "Maya Rivers", square_customer_id: "sq1" }, { id: "c2", name: "Jordan Tate", square_customer_id: "sq2" }];
  const recipients = [
    { email: "maya@example.com", firstName: "Maya", squareCustomerId: "sq1" },
    { email: "jordan@example.com", firstName: "", squareCustomerId: "sq2" },
    { email: "new@example.com", firstName: "Ana", squareCustomerId: "sq9" },
    { email: "gone@example.com", firstName: "Bo", squareCustomerId: "sq8" },
  ];
  const plan = planSends({ recipients, versions, clients, unsubscribed: new Set(["gone@example.com"]) });
  check("approved personal versions go to their client; everyone else gets the shared email; unsubscribed are left out",
    plan.map((send) => [send.email, send.versionId]), [["maya@example.com", "v-maya"], ["jordan@example.com", "shared"], ["new@example.com", "shared"]]);
  check("a missing first name in Square falls back to the client's name", plan[1].firstName, "Jordan");
}

// --- queue, daily limit and Resend ----------------------------------------------
async function freshEnv(extra = {}) {
  const db = createD1({ migrations: schemaMigrations() });
  return { CLIENT_NOTES_DB: db, SITE_URL: SITE, RESEND_API_KEY: "re_test", CAMPAIGN_FROM_EMAIL: "laura@skinbylauralo.com", ...extra };
}

{
  const env = await freshEnv();
  await env.CLIENT_NOTES_DB.prepare("INSERT INTO clients (id, name, square_customer_id) VALUES ('c1', 'Maya Rivers', 'sq1')").run();
  const campaignId = await store.createCampaign(env, {
    topic: "pigmentation", goal: "book", content, usage: { calls: 3, inputTokens: 9000, outputTokens: 3000, model: "claude-sonnet-5-5" },
    versions: [{ clientId: "c1", reason: "Notes: marks after breakouts", personal: { personalNote: "Keep going, Maya.", product: null } }],
  });
  const versions = await store.listVersions(env, campaignId);
  check("a new campaign has the shared version first, then personal versions", versions.map((version) => [version.isShared, version.client_name, version.status]), [[true, null, "review"], [false, "Maya Rivers", "review"]]);

  const shared = versions[0];
  const recipients = Array.from({ length: 120 }, (_, index) => ({ versionId: shared.id, clientId: null, email: `person${index}@example.com`, firstName: `P${index}` }));
  recipients[0] = { versionId: versions[1].id, clientId: "c1", email: "maya@example.com", firstName: "Maya" };
  await store.enqueueSends(env, campaignId, recipients);
  await store.enqueueSends(env, campaignId, recipients.slice(0, 5));
  check("queueing the same people twice doesn't send them twice", (await store.sendCounts(env, campaignId)).queued, 120);

  const calls = [];
  const resend = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const emails = JSON.parse(init.body);
    return new Response(JSON.stringify({ data: emails.slice(1).map((_, index) => ({ id: `re_${calls.length}_${index}` })), errors: [{ index: 0, message: "Invalid `to` field" }] }), { status: 200 });
  };
  const day1 = new Date("2026-10-20T14:00:00Z");
  const first = await sendQueued(env, { now: day1, fetchImpl: resend });
  check("the first run sends up to the daily limit in one Resend batch", [first.sent + first.failed, calls.length, calls[0].url], [95, 1, "https://api.resend.com/emails/batch"]);
  check("an address Resend rejects is marked failed, the rest are sent", [first.failed, first.sent], [1, 94]);
  const email = calls[0].body[0];
  check("each email has one-click unsubscribe headers and a signed link",
    [email.headers["List-Unsubscribe-Post"], email.headers["List-Unsubscribe"].startsWith(`<${SITE}/email/unsubscribe?e=maya%40example.com&t=`)], ["List-Unsubscribe=One-Click", true]);
  check("the personal version went to Maya", [email.to, email.html.includes("Keep going, Maya."), email.subject], [["maya@example.com"], true, "Fading dark spots"]);
  check("the batch has an idempotency key and lets valid emails through when one is bad",
    [calls[0].headers["idempotency-key"].startsWith("campaign-batch-"), calls[0].headers["x-batch-validation"]], [true, "permissive"]);
  check("replies go to Laura's inbox", email.reply_to, "skinbylauralo@gmail.com");

  const successAll = async (url, init) => {
    calls.push({ url });
    return new Response(JSON.stringify({ data: JSON.parse(init.body).map((_, index) => ({ id: `ok_${index}` })) }), { status: 200 });
  };
  const topUp = await sendQueued(env, { now: new Date("2026-10-20T20:00:00Z"), fetchImpl: successAll });
  check("a rejected address doesn't use up the day's allowance", topUp.sent, 1);
  const again = await sendQueued(env, { now: new Date("2026-10-20T20:15:00Z"), fetchImpl: successAll });
  check("nothing more goes out the same day once the limit is reached", [again.reason, calls.length], ["daily-limit", 2]);

  const day2 = await sendQueued(env, { now: new Date("2026-10-21T14:00:00Z"), fetchImpl: successAll });
  check("the rest go out the next day", [day2.sent, day2.left], [24, 0]);
  check("the campaign is marked sent when the queue is empty", (await store.getCampaign(env, campaignId)).status, "sent");
  await env.CLIENT_NOTES_DB.prepare("INSERT INTO email_unsubscribes (email, created_at) VALUES ('person5@example.com', '2026-10-22 08:00:00')").run();
  const [listed] = await store.listCampaigns(env);
  check("the Campaigns list counts sends and people who unsubscribed afterwards", [listed.sent_count, listed.queued_count, listed.personal_count, listed.unsubscribed_count], [119, 0, 1, 1]);

  const failingEnv = await freshEnv();
  const failingCampaign = await store.createCampaign(failingEnv, { topic: "t", goal: "news", content, usage: {}, versions: [] });
  const failingShared = (await store.listVersions(failingEnv, failingCampaign))[0];
  await store.enqueueSends(failingEnv, failingCampaign, [{ versionId: failingShared.id, clientId: null, email: "a@example.com", firstName: "A" }]);
  const down = await sendQueued(failingEnv, { now: day1, fetchImpl: async () => new Response(JSON.stringify({ message: "busy" }), { status: 500 }) });
  check("when Resend is down, emails stay queued for the next run", [down.reason, (await store.sendCounts(failingEnv, failingCampaign)).queued], ["provider-error", 1]);

  check("without a Resend key nothing is sent", (await sendQueued({ ...env, RESEND_API_KEY: "" })).reason, "not-configured");
}

// --- unsubscribe ----------------------------------------------------------------
{
  const env = await freshEnv();
  const link = new URL(await unsubscribeUrl(env, "Maya@Example.com"));
  const token = link.searchParams.get("t");
  check("an unsubscribe link verifies for its own address", await verifyUnsubscribe(env, "maya@example.com", token), true);
  check("it doesn't work for another address", await verifyUnsubscribe(env, "other@example.com", token), false);
  check("the signing key is kept, so old links keep working", new URL(await unsubscribeUrl(env, "maya@example.com")).searchParams.get("t"), token);

  const page = await handleUnsubscribe(new Request(link), env, link);
  check("opening the link asks first, so mail scanners can't unsubscribe anyone", [page.status, (await page.text()).includes("<button type=\"submit\">Unsubscribe</button>")], [200, true]);
  check("opening it unsubscribes no one", (await store.unsubscribedEmails(env)).size, 0);
  const oneClick = await handleUnsubscribe(new Request(link, { method: "POST", body: new URLSearchParams({ "List-Unsubscribe": "One-Click" }) }), env, link);
  check("a one-click unsubscribe from the mail app works", [oneClick.status, [...await store.unsubscribedEmails(env)]], [200, ["maya@example.com"]]);
  const forged = new URL(`${SITE}/email/unsubscribe?e=x%40example.com&t=nope`);
  check("a forged link is refused", (await handleUnsubscribe(new Request(forged, { method: "POST" }), env, forged)).status, 400);
}

// --- reminders --------------------------------------------------------------------
{
  const tuesdayMorning = localTime(new Date("2026-10-20T13:30:00Z"));
  check("Tampa time is used for the reminder", tuesdayMorning, { weekday: "Tue", hour: 9, date: "2026-10-20" });
  check("the reminder is due Tuesday after 9 am", reminderDue({ local: tuesdayMorning, lastReminderDate: "2026-10-16", enabled: true }), true);
  check("only once a day", reminderDue({ local: tuesdayMorning, lastReminderDate: "2026-10-20", enabled: true }), false);
  check("not before 9 am", reminderDue({ local: localTime(new Date("2026-10-20T12:30:00Z")), lastReminderDate: null, enabled: true }), false);
  check("not on Wednesday", reminderDue({ local: localTime(new Date("2026-10-21T14:00:00Z")), lastReminderDate: null, enabled: true }), false);
  check("not when switched off", reminderDue({ local: tuesdayMorning, lastReminderDate: null, enabled: false }), false);

  const env = await freshEnv({ REMINDER_EMAIL: "laura@example.com" });
  const realFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return new Response("{}", { status: 200 }); };
  try {
    const result = await maybeRemind(env, new Date("2026-10-20T13:30:00Z"));
    check("Tuesday's reminder email goes to Laura", [result.reminded, sent.length, sent[0]?.body.to, sent[0]?.body.subject], [true, 1, ["laura@example.com"], "It's Tuesday: time for this week's client email"]);
    await maybeRemind(env, new Date("2026-10-20T13:45:00Z"));
    check("the next run that day doesn't remind again", sent.length, 1);
    await store.setSetting(env, "reminder_thu", "off");
    check("a switched-off day is skipped", (await maybeRemind(env, new Date("2026-10-22T13:30:00Z"))).reminded, false);
  } finally {
    globalThis.fetch = realFetch;
  }

  const created = (iso) => ({ created_at: iso, status: "review", content: {} });
  const week = weekSummary([created("2026-10-20 12:00:00"), created("2026-10-17 12:00:00")], new Date("2026-10-20T15:00:00Z"), ["Tue", "Thu"]);
  check("this week counts emails from Monday, and the next reminder is Thursday", [week.count, week.nextReminder], [1, "Next reminder: Thursday at 9:00 am."]);
}

// --- phone notifications ------------------------------------------------------------
{
  const env = await freshEnv();
  await addSubscription(env, { endpoint: "https://web.push.apple.com/abc", keys: {} });
  await addSubscription(env, { endpoint: "https://fcm.googleapis.com/gone", keys: {} });
  const pushes = [];
  const reached = await notifyPhones(env, {
    now: Date.parse("2026-10-20T13:30:00Z"),
    fetchImpl: async (url, init) => { pushes.push({ url, headers: init.headers }); return new Response("", { status: url.includes("gone") ? 410 : 201 }); },
  });
  const auth = pushes[0].headers.authorization;
  check("each phone gets an empty push signed with the app's key", [auth.startsWith("vapid t="), auth.split(", k=")[0].slice(8).split(".").length, pushes[0].headers["content-length"]], [true, 3, "0"]);
  check("a phone the push service no longer knows is forgotten", [reached, (await listSubscriptions(env)).map((entry) => entry.endpoint)], [1, ["https://web.push.apple.com/abc"]]);
  let refused = false;
  try { await addSubscription(env, { endpoint: "http://insecure.example" }); } catch { refused = true; }
  check("only https push addresses are saved", refused, true);
}

// --- Laura's voice check and the cost estimate ------------------------------------------
{
  check("the voice check flags dashes, semicolons and long sentences",
    voiceHints(["Gentle wins — every time; trust me.", "This one sentence just keeps on going and going with far too many words to read easily."]).length, 3);
  check("a draft that follows the guide has no hints", voiceHints(["I see this a lot. Go slow with acids. Your barrier will thank you ✨"]), []);

  check("cost comes from the recorded tokens and the model's price",
    costOf({ calls: 2, inputTokens: 1_000_000, outputTokens: 100_000, model: "claude-sonnet-5-5" }).dollars, 3);
  check("a model without a price shows no dollar figure", costOf({ calls: 1, inputTokens: 10, outputTokens: 10, model: "some-new-model" }).dollars, null);
  check("small amounts read plainly", [formatCost(0.004), formatCost(0.0712), formatCost(null)], ["under 1¢", "$0.07", "unknown"]);

  const inputs = estimateInputs({ model: "claude-sonnet-5-5", productNames: ["Mixi Mandelic Acid 5%"], clientProfiles: ["Notes, newest first:\n- 2026-09-01: PIH on cheeks", "Notes, newest first:\n- none\nBought: SPF 50"] });
  const none = estimateCampaign(inputs, { topicChars: 200, matched: 0 });
  const ten = estimateCampaign(inputs, { topicChars: 200, matched: 10 });
  check("the estimate is measured from the real prompts: a few cents for the email, more for each matching client",
    [inputs.clientsWithNotes, none > 0.005 && none < 0.05, ten > none, ten < 0.2], [2, true, true, true]);
  check("history shows what past campaigns really cost",
    costHistory([{ usage: { calls: 1, inputTokens: 1000, outputTokens: 1000, model: "claude-sonnet-5-5" } }, { usage: {} }]), { count: 1, low: 0.012, high: 0.012, average: 0.012 });
}

// --- review screen ----------------------------------------------------------------------
{
  const env = await freshEnv();
  await env.CLIENT_NOTES_DB.prepare("INSERT INTO clients (id, name, square_customer_id) VALUES ('c1', 'Maya Rivers', 'sq1')").run();
  await store.setSetting(env, "recipient_estimate", JSON.stringify({ count: 113, at: Date.now() }));
  const campaignId = await store.createCampaign(env, {
    topic: "pigmentation", goal: "book", content, usage: { calls: 3, inputTokens: 9000, outputTokens: 3000, model: "claude-sonnet-5-5" },
    versions: [{ clientId: "c1", reason: "Notes: marks after breakouts", personal: { personalNote: "Keep going.", product: { ...content.product, label: "From your routine", note: "Bought in March." } } }],
  });
  const [shared, maya] = await store.listVersions(env, campaignId);
  const route = (path, init) => {
    const url = new URL(`https://x.test${path}`);
    return handleCampaignRoute(new Request(url, init), env, url, url.pathname.split("/").filter(Boolean), init?.method || "GET");
  };

  const page = await (await route(`/admin/campaigns/${campaignId}?v=${maya.id}`)).text();
  check("the review screen lists every version and previews the selected one",
    [page.includes("Everyone else"), page.includes("Maya Rivers"), page.includes("Notes: marks after breakouts"), page.includes("srcdoc=")], [true, true, true, true]);
  check("sending waits for the shared version to be approved", page.includes("Approve the email everyone else gets before sending."), true);
  check("before sending, the page says what the AI has cost so far", page.includes("AI cost so far: $0.05 (3 AI calls, Claude Sonnet 5.5)."), true);

  const editor = await (await route(`/admin/campaigns/${campaignId}?v=${shared.id}&view=preview`)).text();
  check("the email in review is editable as it is, with a P.S. and a choice of button, and no Edit step",
    [editor.includes("data-inline-editor"), editor.includes("data-edit=&quot;paragraphs&quot;"), editor.includes("data-edit=&quot;ps&quot;"), editor.includes('name="goal"'), editor.includes("edit=1")], [true, true, true, true, false]);
  check("the subject, preview line, greeting, button and sign-off are editable in the email too",
    ["subject", "preheader", "greeting", "buttonLabel", "signoff", "signName"].map((name) => editor.includes(`data-edit=&quot;${name}&quot;`)), [true, true, true, true, true, true]);
  check("the shared editor doesn't mark a personal note, and saves as Laura types", [editor.includes("data-edit=&quot;personalNote&quot;"), editor.includes("data-save-state"), editor.includes("Save changes")], [false, true, false]);
  const mayaEditor = await (await route(`/admin/campaigns/${campaignId}?v=${maya.id}&view=preview`)).text();
  check("a personal version's editor marks its note, product line and P.S., not the shared words",
    [mayaEditor.includes("data-edit=&quot;personalNote&quot;"), mayaEditor.includes("data-edit=&quot;productNote&quot;"), mayaEditor.includes("data-edit=&quot;personalPs&quot;"), mayaEditor.includes("data-edit=&quot;paragraphs&quot;")], [true, true, true, false]);
  check("the editor's hidden fields start with the saved words, so saving without the script changes nothing",
    editor.includes('name="paragraphs" value="First &lt;b&gt;paragraph&lt;/b&gt;.\n\nSecond\nline."'), true);
  check("the shared editor keeps the email's products for Save, with a Remove button on each card in the email",
    [editor.includes('name="product" value="Mixi Mandelic Acid 5%"'), editor.includes("data-remove-product"), editor.includes("data-product=&quot;Mixi Mandelic Acid 5%&quot;"), page.includes("data-remove-product")], [true, true, true, false]);
  check("a personal version's products can't be removed there; they come from the shared email", mayaEditor.includes("data-remove-product"), false);
  const preview = await route(`/admin/campaigns/${campaignId}/versions/${shared.id}/preview`, {
    method: "POST", body: new URLSearchParams({ subject: "Live", headline: "Live headline", paragraphs: "Fresh words — here.", ps: "See you soon ✨" }),
  });
  const live = await preview.json();
  check("the live preview shows unsaved changes and the voice check, without saving",
    [live.html.includes("Live headline"), live.html.includes("See you soon ✨"), live.hints.some((hint) => hint.includes("dash")), (await store.getCampaign(env, campaignId)).content.headline],
    [true, true, true, content.headline]);

  const post = (versionId, fields) => route(`/admin/campaigns/${campaignId}/versions/${versionId}`, { method: "POST", body: new URLSearchParams(fields) });
  await post(shared.id, { action: "approve" });
  await post(maya.id, { action: "reject" });
  check("approve and reject change each version", (await store.listVersions(env, campaignId)).map((version) => version.status), ["approved", "rejected"]);
  await post(maya.id, { action: "save", personalNote: "Your <own> words.", productNote: "Use at night." });
  const edited = await store.getVersion(env, maya.id);
  check("an edit is saved and keeps the version's status", [edited.personal.personalNote, edited.personal.product.note, edited.status], ["Your <own> words.", "Use at night.", "rejected"]);
  const autosave = await route(`/admin/campaigns/${campaignId}/versions/${maya.id}`, {
    method: "POST", headers: { accept: "application/json" }, body: new URLSearchParams({ action: "save", personalNote: "Typed just now.", productNote: "Use at night." }),
  });
  const autosaved = await autosave.json();
  check("saving as Laura types answers in JSON", [autosave.status, autosaved.ok, typeof autosaved.savedAt, (await store.getVersion(env, maya.id)).personal.personalNote], [200, true, "string", "Typed just now."]);
  await post(maya.id, { action: "save", personalNote: "Your <own> words.", productNote: "Use at night.", ps: "Just for you" });
  check("a personal version can have its own P.S.", (await store.getVersion(env, maya.id)).personal.ps, "Just for you");
  await post(shared.id, { action: "save", subject: "New subject", headline: "New headline", paragraphs: "One.\n\nTwo.", tips: "A\nB", ps: "Book soon", goal: "shop" });
  const saved = await store.getCampaign(env, campaignId);
  check("editing the shared email splits paragraphs on blank lines and tips on lines",
    [saved.content.subject, saved.content.paragraphs, saved.content.tips, contentProducts(saved.content)[0].name], ["New subject", ["One.", "Two."], ["A", "B"], "Mixi Mandelic Acid 5%"]);
  check("the shared P.S. and the button are saved", [saved.content.ps, saved.goal], ["Book soon", "shop"]);
  check("Laura's usual words aren't stored, so they follow the button choice", [saved.content.greeting, saved.content.buttonLabel, saved.content.signoff, saved.content.signName], ["", "", "", ""]);
  await post(shared.id, { action: "save", subject: "New subject", headline: "New headline", paragraphs: "One.", goal: "book", greeting: "Hey", buttonLabel: "Grab a spot", signoff: "Talk soon,", signName: "Laura ✨", preheader: "Quick one" });
  const worded = await store.getCampaign(env, campaignId);
  const wordedEmail = buildMessage({ campaign: worded, version: (await store.listVersions(env, campaignId))[0], send: { first_name: "Ana" }, siteUrl: "https://x.test", unsubscribe: "https://x.test/u" });
  check("her own greeting, button words, sign-off and preview line are saved and sent",
    [worded.content.preheader, wordedEmail.html.includes("Hey Ana,"), wordedEmail.html.includes(">Grab a spot</a>"), wordedEmail.text.includes("Talk soon,\nLaura ✨"), wordedEmail.html.includes("data-edit")],
    ["Quick one", true, true, true, false]);
  await post(shared.id, { action: "save", subject: "New subject", headline: "New headline", productsShown: "1" });
  check("unticking every product saves the email without products", contentProducts((await store.getCampaign(env, campaignId)).content), []);

  const approved = await (await route(`/admin/campaigns/${campaignId}`)).text();
  check("once the shared email is approved, the send bar names the audience", approved.includes("Goes to about 113 clients"), true);

  const home = await (await route("/admin/campaigns")).text();
  check("the Campaigns home lists the campaign and the reminder switches", [home.includes("Recent emails"), home.includes("Tuesday reminder"), home.includes("Thursday reminder")], [true, true, true]);
  check("the Campaigns home shows each email's AI cost", home.includes("<td class=\"num\">$0.05</td>"), true);
  const newPage = await (await route("/admin/campaigns/new")).text();
  check("the new email page estimates the AI cost before drafting, and shows past costs",
    [newPage.includes("AI cost estimate"), newPage.includes("data-cost-estimate"), newPage.includes("Your last email cost $0.05.")], [true, true, true]);
  await route("/admin/campaigns/settings", { method: "POST", body: new URLSearchParams({ reminder_tue: "on" }) });
  check("the reminder switches are saved", [await store.getSetting(env, "reminder_tue"), await store.getSetting(env, "reminder_thu")], ["on", "off"]);

  const tooShort = await route("/admin/campaigns", { method: "POST", body: new URLSearchParams({ topic: "hi" }), headers: { accept: "application/json" } });
  check("a draft needs a real topic", [tooShort.status, (await tooShort.json()).message], [400, "Write a sentence or two about this week's topic first."]);

  await route(`/admin/campaigns/${campaignId}/delete`, { method: "POST" });
  check("a draft can be deleted", await store.getCampaign(env, campaignId), null);
}

// --- drafting, end to end with a stand-in for the Claude API ---------------------------
{
  const env = await freshEnv({ ANTHROPIC_API_KEY: "sk-test" });
  const db = env.CLIENT_NOTES_DB;
  await db.prepare("INSERT INTO clients (id, name, square_customer_id) VALUES ('c1', 'Maya Rivers', 'sq1'), ('c2', 'Bo Lane', 'sq2'), ('c3', 'Ana Cruz', 'sq3')").run();
  await db.prepare("INSERT INTO notes (id, client_id, note_date, summary, extracted_text, confidence, source) VALUES ('n1', 'c1', '2026-09-01', 'PIH after breakouts, on mandelic', '', 'high', 'square'), ('n2', 'c2', '2026-09-02', 'Brows tinted', '', 'high', 'square'), ('n3', 'c3', '2026-09-03', 'Dark spots on cheeks', '', 'high', 'square')").run();
  const requests = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    const prompt = body.messages[0].content;
    const reply = prompt.includes("<client ref=")
      ? { versions: [
        { ref: "c1", related: true, reason: "Notes: PIH after breakouts", personalNote: "Keep up the mandelic.", productName: "", productNote: "" },
        { ref: "c2", related: false, reason: "", personalNote: "", productName: "", productNote: "" },
      ] }
      : { subject: "S", preheader: "P", eyebrow: "E", headline: "H", paragraphs: ["One."], tipsTitle: "", tips: [], skipProducts: false, products: [{ name: "Mixi Mandelic Acid 5%", note: "Gentle start" }], matchTerms: ["PIH", "dark spots", "mandelic"] };
    return new Response(JSON.stringify({ stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 50 }, content: [{ type: "text", text: JSON.stringify(reply) }] }), { status: 200 });
  };
  try {
    const campaignId = await draftCampaign(env, { topic: "Pigmentation this week", goal: "book" });
    const versions = await store.listVersions(env, campaignId);
    check("only clients the AI says relate get a personal version", versions.map((version) => version.client_name), [null, "Maya Rivers"]);
    const personalPrompt = requests[1].messages[0].content;
    check("only clients whose notes match are sent to the AI, without surnames",
      [personalPrompt.includes('first_name="Maya"'), personalPrompt.includes('first_name="Ana"'), personalPrompt.includes("Brows tinted"), personalPrompt.includes("Rivers")], [true, true, false, false]);
    check("every call asks for JSON matching a schema", requests.every((request) => request.output_config.format.type === "json_schema"), true);
    check("every call is written from Laura's email voice guide", requests.every((request) => request.system.includes("playful big sister")), true);
    check("token use is recorded on the campaign", (await store.getCampaign(env, campaignId)).usage.calls, 2);
    check("the products the AI found in the topic are saved as cards", (await store.getCampaign(env, campaignId)).content.products.map((card) => [card.name, card.note]), [["Mixi Mandelic Acid 5%", "Gentle start"]]);
    check("the prompt asks for every product Laura mentions, unless she says not to", [requests[0].messages[0].content.includes("every product from the list that Laura names"), requests[0].messages[0].content.includes("skipProducts")], [true, true]);

    const maya = versions[1];
    await redraftPersonal(env, { campaign: await store.getCampaign(env, campaignId), version: maya, feedback: "Shorter." });
    check("a redraft sends Laura's feedback and keeps the version in review",
      [requests.at(-1).messages[0].content.includes("Shorter."), (await store.getVersion(env, maya.id)).status], [true, "review"]);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- adding a product in the editor ------------------------------------------------------
{
  const env = await freshEnv({ SQUARE_ACCESS_TOKEN: "sq-test", SQUARE_LOCATION_ID: "L1" });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => Response.json(String(url).includes("/catalog/search") ? {
    objects: [{ id: "I1", type: "ITEM", item_data: { name: "Daily SPF 50", product_type: "REGULAR", ecom_visibility: "VISIBLE", categories: [{ id: "C1" }], image_ids: ["M1"],
      variations: [{ id: "V1", item_variation_data: { pricing_type: "FIXED_PRICING", price_money: { amount: 4450, currency: "USD" } } }] } }],
    related_objects: [{ id: "C1", type: "CATEGORY", category_data: { name: "Sun care" } }, { id: "M1", type: "IMAGE", image_data: { url: "https://img/spf.png" } }],
  } : {});
  try {
    const route = (path) => { const url = new URL(`https://x.test${path}`); return handleCampaignRoute(new Request(url), env, url, url.pathname.split("/").filter(Boolean), "GET"); };
    const added = await (await route("/admin/campaigns/product-card?name=Daily%20SPF%2050")).json();
    check("a product added in the editor comes back as its card, with photo, price and a Remove button",
      [added.name, added.html.includes("$44.50"), added.html.includes('src="https://img/spf.png"'), added.html.includes("data-remove-product")], ["Daily SPF 50", true, true, true]);
    check("a name that isn't in the shop is refused", (await route("/admin/campaigns/product-card?name=Nope")).status, 404);
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log(failures === 0 ? "\nAll admin-campaigns tests passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
