import { html, toString } from "../../html.js";
import { costOf, estimateCampaign, estimateRedraft, formatCost, modelName } from "../campaigns/cost.js";
import { MAX_EMAIL_PRODUCTS } from "../campaigns/drafting.js";
import { contentProducts } from "../campaigns/email-template.js";
import { formatMoney } from "../../config.js";

// The email campaign screens: the Campaigns home, writing a new email, and
// reviewing each version before it is sent. On a phone the review screen
// shows the version list and the preview as two tabs.

const STATUS_LABELS = { review: "To review", approved: "Approved", rejected: "Rejected" };
const CAMPAIGN_LABELS = { review: "In review", sending: "Sending", sent: "Sent" };
const GOAL_OPTIONS = [
  { value: "book", label: "Book a facial" },
  { value: "shop", label: "Shop a product" },
  { value: "news", label: "Just news" },
];

function sqlDate(text) {
  return text ? new Date(`${text.replace(" ", "T")}Z`) : null;
}

function shortDate(text) {
  const date = sqlDate(text);
  return date ? date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" }) : "";
}

/** The campaign's short name: its label without "This week:". */
function topicLabel(campaign) {
  return String(campaign.content.eyebrow || campaign.topic).replace(/^this week:\s*/i, "") || campaign.topic;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function peopleCount(count) {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

function steps(current) {
  return html`<ol class="camp-steps" aria-label="Steps" data-steps>
    ${["Write", "Pick who gets it", "Review", "Send"].map((label, index) => html`<li class="${index + 1 === current ? "on" : index + 1 < current ? "done" : ""}">${index + 1} · ${label}</li>`)}
  </ol>`;
}

/** "Emails | Scheduled": the two parts of Email campaigns. */
function sectionTabs(current) {
  const tab = (href, label, key) => html`<a href="${href}" class="${current === key ? "on" : ""}"${current === key ? html` aria-current="page"` : ""}>${label}</a>`;
  return html`<nav class="camp-section-tabs" aria-label="Email campaigns">${tab("/admin/campaigns", "Emails", "emails")}${tab("/admin/campaigns/scheduled", "Scheduled", "scheduled")}</nav>`;
}

/** "Tue, Oct 27" for a UTC date ("2026-10-27"). */
function dayName(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * When a campaign's emails go out, as a sentence: "All 40 go out today." or
 * "95 go out today, the other 47 on Tue, Oct 27." `days` is [{ date, count }].
 */
export function scheduleSentence(days, today, providerLimit = 100) {
  if (!days.length) return "";
  const total = days.reduce((sum, day) => sum + day.count, 0);
  if (days.length === 1 && days[0].date === today) return `All ${total} go out today.`;
  if (days.length === 1) return `Today's sending is full (Resend's free plan sends ${providerLimit} emails a day), so ${total === 1 ? "it goes" : `all ${total} go`} out on ${dayName(days[0].date)}.`;
  const parts = days.map((day) => `${day.count} ${day.date === today ? "today" : `on ${dayName(day.date)}`}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  const lead = `Resend's free plan sends ${providerLimit} emails a day, so they go out`;
  return `${days[0].date === today ? "" : "Today's sending is full. "}${lead} ${list}.`;
}

function notices({ notice, error }) {
  return html`${notice ? html`<div class="camp-notice" role="status">${notice}</div>` : ""}${error ? html`<div class="camp-error" role="alert">${error}</div>` : ""}`;
}

function setupCard(missing) {
  if (!missing.length) return "";
  return html`<div class="card camp-setup">
    <div class="section-label">Finish setting up</div>
    <ul>${missing.map((item) => html`<li>${item}</li>`)}</ul>
  </div>`;
}

// --- Campaigns home --------------------------------------------------------

export function campaignsHomePage({ campaigns, week, reminders, missing, notice, error, dailyLimit }) {
  return html`
    <div class="camp-title-row">
      <div>
        <h1 class="page-title">Email campaigns</h1>
        <div class="camp-sub">Two emails a week: Tuesday and Thursday.</div>
      </div>
      <a class="btn btn-primary" href="/admin/campaigns/new">+ New email</a>
    </div>
    ${sectionTabs("emails")}
    ${notices({ notice, error })}
    ${setupCard(missing)}
    <div class="camp-home-grid">
      <section class="card camp-week" aria-label="This week">
        <div class="section-label">This week</div>
        <div class="camp-week-count"><strong>${week.count}</strong> of 2 emails written</div>
        ${week.campaigns.length ? html`<div class="camp-week-list">
          ${week.campaigns.map((campaign) => html`<a class="camp-week-item" href="/admin/campaigns/${campaign.id}">
            <span class="camp-week-day">${shortDate(campaign.created_at)}</span>
            <span class="camp-week-topic">${topicLabel(campaign)}</span>
            <span class="pill pill-${campaign.status}">${CAMPAIGN_LABELS[campaign.status] || campaign.status}</span>
          </a>`)}
        </div>` : html`<p class="camp-muted">Nothing written yet this week.</p>`}
        <div class="camp-muted">${week.nextReminder}</div>
      </section>
      <section class="card camp-reminders" aria-label="Reminders">
        <div class="section-label">Reminders</div>
        <form method="post" action="/admin/campaigns/settings" class="camp-switches" data-autosubmit>
          ${reminders.map((reminder) => html`<label class="camp-switch">
            <span><span class="camp-switch-label">${reminder.label}</span><span class="camp-switch-hint">9:00 am, Tampa time</span></span>
            <input type="checkbox" name="${reminder.key}" value="on"${reminder.on ? html` checked` : ""} role="switch" />
          </label>`)}
          <noscript><button type="submit" class="btn btn-secondary">Save</button></noscript>
        </form>
        <div class="camp-push" data-push>
          <button type="button" class="btn btn-secondary" data-push-button hidden>Turn on phone notifications</button>
          <div class="camp-muted" data-push-status>Phone notifications work in the Home Screen app. Reminders also come by email.</div>
        </div>
      </section>
    </div>
    <section class="card camp-recent" aria-label="Recent emails">
      <div class="section-label">Recent emails</div>
      ${campaigns.length ? html`<div class="camp-table-wrap"><table class="data">
        <thead><tr><th scope="col">Date</th><th scope="col">Topic</th><th scope="col">Status</th><th scope="col">Sent</th><th scope="col">Personal</th><th scope="col">Unsubscribed</th><th scope="col">AI cost</th></tr></thead>
        <tbody>
          ${campaigns.map((campaign) => html`<tr class="row-link" data-href="/admin/campaigns/${campaign.id}">
            <td class="camp-nowrap">${shortDate(campaign.created_at)}</td>
            <td><a href="/admin/campaigns/${campaign.id}">${topicLabel(campaign)}</a></td>
            <td><span class="pill pill-${campaign.status}">${CAMPAIGN_LABELS[campaign.status] || campaign.status}</span></td>
            <td class="num">${campaign.sent_count}${campaign.queued_count ? html` <span class="camp-muted">+${campaign.queued_count} queued</span>` : ""}</td>
            <td class="num">${campaign.personal_count}</td>
            <td class="num">${campaign.unsubscribed_count}</td>
            <td class="num">${formatCost(costOf(campaign.usage).dollars)}</td>
          </tr>`)}
        </tbody>
      </table></div>` : html`<p class="camp-muted">No emails yet. Press "New email" to write the first one.</p>`}
      <div class="camp-muted">Resend sends up to ${dailyLimit} emails a day, so a bigger list finishes over the next days. <a href="/admin/campaigns/scheduled">See what's scheduled</a>.</div>
    </section>
  `;
}

// --- New email -------------------------------------------------------------

function costEstimateCard({ estimate, history, topic }) {
  if (!estimate) {
    return html`<div class="camp-cost"><div class="section-label">AI cost estimate</div>
      <p class="camp-muted">The estimate couldn't be worked out right now (the shop or client notes didn't load). Each campaign still shows what it really cost.</p></div>`;
  }
  if (!estimate.price) {
    return html`<div class="camp-cost"><div class="section-label">AI cost estimate</div>
      <p class="camp-muted">There's no price on file for ${estimate.modelName}, so the cost can't be estimated. Add it to cost.js.</p></div>`;
  }
  const email = estimateCampaign(estimate, { topicChars: topic.length, matched: 0 });
  const all = estimateCampaign(estimate, { topicChars: topic.length, matched: estimate.clientsWithNotes });
  const example = (count) => estimateCampaign(estimate, { topicChars: topic.length, matched: count });
  return html`<div class="camp-cost" data-cost-estimate="${JSON.stringify(estimate)}">
    <div class="section-label">AI cost estimate</div>
    <p><strong data-cost-email>About ${formatCost(email)}</strong> to write the email, plus <strong>about ${formatCost(example(10) - email)}</strong> for every 10 clients it matches.</p>
    <p class="camp-muted" data-cost-examples>If 10 clients match: about ${formatCost(example(10))}. If 30 match: about ${formatCost(example(30))}.</p>
    <p class="camp-muted">The most it could be, if all ${estimate.clientsWithNotes} clients with notes matched: <span data-cost-all>about ${formatCost(all)}</span>.</p>
    ${history ? html`<p class="camp-muted">${history.count === 1 ? `Your last email cost ${formatCost(history.low)}.` : `Your last ${history.count} emails cost ${formatCost(history.low)} to ${formatCost(history.high)} each (${formatCost(history.average)} on average).`}</p>` : ""}
    <p class="camp-muted">Written by ${estimate.modelName}. Each redraft costs about ${formatCost(estimateRedraft(estimate, { shared: true, topicChars: topic.length, previousChars: 1200 }))}. Sending through Resend adds nothing on the free plan.</p>
  </div>`;
}

/**
 * The recipient list: everyone in Square with an email, loaded by the script
 * (client.js wireRecipientPicker) from /admin/campaigns/recipients. `picked` is
 * the emails already chosen, or null to start with everyone ticked. The picks
 * go in the hidden "recipients" field as JSON.
 */
function recipientPicker({ picked = null, note = "" }) {
  return html`<div class="camp-pick" data-recipient-picker data-source="/admin/campaigns/recipients" data-picked="${picked ? JSON.stringify(picked) : ""}">
    <div class="camp-pick-head">
      <h2 class="camp-pick-title">Who gets this email?</h2>
      <p class="camp-muted">${note || "Everyone with an email in Square starts ticked. Untick anyone who shouldn't get it, or clear all and tick a few."}</p>
    </div>
    <div class="camp-pick-tools">
      <input type="search" class="camp-pick-search" placeholder="Search by name or email" aria-label="Search clients" data-pick-search autocomplete="off" />
      <div class="camp-chips" role="group" aria-label="Show">
        <button type="button" class="camp-chip on" data-pick-filter="all" aria-pressed="true">All</button>
        <button type="button" class="camp-chip" data-pick-filter="notes" aria-pressed="false">Has notes</button>
        <button type="button" class="camp-chip" data-pick-filter="bought" aria-pressed="false">Bought from the shop</button>
        <button type="button" class="camp-chip" data-pick-filter="picked" aria-pressed="false">Picked</button>
        <button type="button" class="camp-chip" data-pick-filter="unpicked" aria-pressed="false">Not picked</button>
      </div>
      <div class="camp-pick-bulk">
        <span class="camp-muted" data-pick-shown></span>
        <button type="button" class="camp-text-btn" data-pick-all>Select all shown</button>
        <button type="button" class="camp-text-btn" data-pick-none>Clear shown</button>
      </div>
    </div>
    <div class="camp-pick-list" data-pick-list role="group" aria-label="Clients">
      <div class="camp-pick-loading"><span class="spinner" aria-hidden="true"></span> Loading your clients from Square…</div>
    </div>
    <input type="hidden" name="recipients" value="" data-pick-field disabled />
  </div>`;
}

/** The bar under the list: how many are picked and which day they go out. */
function pickBar({ submitLabel, backButton = "", extra = "" }) {
  return html`<div class="camp-pick-bar" data-pick-bar>
    <div class="camp-pick-summary">
      <div><strong data-pick-count>0 picked</strong> <span class="camp-muted" data-pick-cost></span></div>
      <div class="camp-pick-schedule" data-pick-schedule hidden></div>
    </div>
    <div class="camp-pick-actions">${backButton}${extra}<button type="submit" class="btn btn-primary camp-big-btn" data-pick-submit>${submitLabel}</button></div>
  </div>`;
}

export function newCampaignPage({ topic = "", goal = "book", missing, error, estimate = null, history = null }) {
  return html`
    <div class="camp-head">
      <a class="back-link" href="/admin/campaigns">← Email campaigns</a>
      <h1 class="page-title">New email</h1>
      ${steps(1)}
    </div>
    ${notices({ error })}
    ${setupCard(missing)}
    <form class="camp-new-form" method="post" action="/admin/campaigns" data-draft-form data-stage="write">
    <div class="camp-new-grid" data-stage-write>
      <div class="card camp-write">
        <div class="camp-record">
          <button type="button" class="camp-mic" data-mic aria-label="Record" hidden>
            <svg class="mic-icon" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10a7 7 0 0 0 14 0"></path><path d="M12 17v4"></path></svg>
            <svg class="stop-icon" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
          </button>
          <div class="camp-mic-text" data-mic-text hidden>Tap to record</div>
          <div class="camp-muted" data-mic-hint hidden>Talk about this week's topic. It's typed out below for you to edit.</div>
        </div>
        <label class="field" for="topic">What do you want to talk about this week?</label>
        <textarea id="topic" name="topic" rows="7" required maxlength="4000" placeholder="For example: dark spots after breakouts or sun. Gentle exfoliation and daily SPF work better than harsh peels. Invite people to book a brightening facial.">${topic}</textarea>
        <fieldset class="camp-goals">
          <legend>What should people do?</legend>
          <div class="camp-goal-row">
            ${GOAL_OPTIONS.map((option) => html`<label class="camp-goal"><input type="radio" name="goal" value="${option.value}"${option.value === goal ? html` checked` : ""} /> ${option.label}</label>`)}
          </div>
        </fieldset>
        <input type="hidden" name="personalizeShown" value="1" />
        <label class="camp-switch camp-personal-switch">
          <span><span class="camp-switch-label">Personal notes for related clients</span>
            <span class="camp-switch-hint" data-personal-hint>On: clients whose notes or purchases relate get a short note just for them. Off: one email for everybody.</span></span>
          <input type="checkbox" name="personalize" value="on" checked role="switch" data-personalize />
        </label>
        <div class="camp-submit-row">
          <button type="submit" class="btn btn-primary camp-big-btn" data-next-button>Next: pick who gets it</button>
        </div>
      </div>
      <aside class="card camp-checks">
        <div class="section-label">What happens next</div>
        <ol class="camp-how">
          <li>You pick who gets this email. The AI only reads the notes of people you pick.</li>
          <li>The AI writes one email for everyone, in your voice and at a 5th-grade reading level.</li>
          <li>Products you mention are added as cards with their photo, price and a shop link. Say "no products" to leave them out.</li>
          <li data-personal-only>With personal notes on, it looks through each picked client's notes and purchases. Clients it relates to get a short personal note. Allergy and sensitivity flags keep that advice gentle.</li>
          <li>You read each version, then approve, edit or reject it. Nothing sends until you press Send.</li>
        </ol>
        <div class="camp-muted">Personal notes never mention medications, pregnancy or diagnoses.</div>
        ${costEstimateCard({ estimate, history, topic })}
      </aside>
    </div>
    <div class="card camp-pick-card" data-stage-pick hidden>
      ${recipientPicker({})}
      ${pickBar({
        submitLabel: "Draft emails",
        backButton: html`<button type="button" class="btn btn-secondary" data-back-button>← Back</button>`,
      })}
      <div class="camp-drafting" data-drafting hidden>
        <span class="spinner" aria-hidden="true"></span>
        <span data-drafting-text>Writing the email…</span>
      </div>
    </div>
    </form>
  `;
}

/** Changing who gets a campaign that is still in review. No redraft: anyone added gets the shared email. */
export function campaignRecipientsPage({ campaign, error }) {
  return html`
    <div class="camp-head">
      <a class="back-link" href="/admin/campaigns/${campaign.id}">← Back to review</a>
      <h1 class="page-title">Who gets “${topicLabel(campaign)}”</h1>
      ${steps(2)}
    </div>
    ${notices({ error })}
    ${campaign.status !== "review" ? html`<div class="camp-error" role="alert">This email is already sending, so who gets it can't change.</div>` : html`
    <form class="card camp-pick-card" method="post" action="/admin/campaigns/${campaign.id}/recipients" data-pick-form>
      ${recipientPicker({
        picked: campaign.audience.emails,
        note: campaign.audience.personalize
          ? "Anyone you add gets the email everyone else gets: personal notes were only written for the people picked before drafting."
          : "Everyone gets the same email.",
      })}
      ${pickBar({ submitLabel: "Save", backButton: html`<a class="btn btn-secondary" href="/admin/campaigns/${campaign.id}">Cancel</a>` })}
    </form>`}
  `;
}

// --- Review ----------------------------------------------------------------

function versionName(version) {
  return version.isShared ? "Everyone else" : version.client_name || "Client";
}

/** A hidden field that already holds the saved value, so a save without the script changes nothing. */
function kept(name, value) {
  return html`<input type="hidden" name="${name}" value="${value || ""}" data-field="${name}" />`;
}

/**
 * The shared email's products, for the editor: hidden fields holding the
 * saved order (so a save without the script changes nothing). In the email,
 * each card has a Remove button and a search box adds one from the shop.
 */
function productFields(campaign) {
  return html`<input type="hidden" name="productsShown" value="1" />
    <span data-product-fields>${contentProducts(campaign.content).map((card) => html`<input type="hidden" name="product" value="${card.name}" />`)}</span>`;
}

/** The shop's products for the search box in the email: name, price and photo. */
function shopForSearch(shop) {
  return JSON.stringify(shop.map((product) => ({
    name: product.name,
    price: Number.isFinite(product.regularPriceCents ?? product.priceCents)
      ? formatMoney(product.regularPriceCents ?? product.priceCents)
      : "",
    image: product.image || "",
  })));
}

// The editor: the email in the preview below is editable as it stands (see
// client.js), subject and preview line included, and saves itself as Laura
// types. This bar holds formatting, the button choice and the saved state.
function editForm({ campaign, version, shop = [] }) {
  const action = `/admin/campaigns/${campaign.id}/versions/${version.id}`;
  const shared = version.isShared;
  const content = campaign.content;
  return html`<form method="post" action="${action}" class="camp-edit camp-editor" data-inline-editor data-hints-url="${action}/preview" data-product-card-url="/admin/campaigns/product-card" data-shop="${shared ? shopForSearch(shop) : "[]"}" data-max-products="${MAX_EMAIL_PRODUCTS}">
    <input type="hidden" name="action" value="save" />
    ${shared ? html`
      ${kept("subject", content.subject)}${kept("preheader", content.preheader)}${kept("eyebrow", content.eyebrow)}${kept("headline", content.headline)}${kept("paragraphs", (content.paragraphs || []).join("\n\n"))}
      ${kept("tipsTitle", content.tipsTitle)}${kept("tips", (content.tips || []).join("\n"))}${kept("ps", content.ps)}
      ${kept("greeting", content.greeting)}${kept("fallbackName", content.fallbackName)}${kept("buttonLabel", content.buttonLabel)}${kept("buttonUrl", content.buttonUrl)}${kept("signoff", content.signoff)}${kept("signName", content.signName)}${kept("shopTitle", content.shopTitle)}
      ${productFields(campaign)}`
    : html`${kept("personalNote", version.personal.personalNote)}${kept("productNote", version.personal.product?.note)}${kept("ps", version.personal.ps)}`}
    <div class="camp-toolbar" role="toolbar" aria-label="Formatting">
      <button type="button" class="camp-tool" data-format="bold" aria-label="Bold" title="Bold"><strong>B</strong></button>
      <button type="button" class="camp-tool" data-format="link" title="Add a link">Link</button>
      ${shared ? html`<label class="camp-tool-select">Button
        <select name="goal">${GOAL_OPTIONS.map((option) => html`<option value="${option.value}"${option.value === campaign.goal ? html` selected` : ""}>${option.value === "news" ? "No button" : option.label}</option>`)}</select>
      </label>` : ""}
      <span class="camp-toolbar-gap"></span>
      <span class="camp-saved" data-save-state aria-live="polite">Changes save as you type</span>
    </div>
    <div class="camp-muted">${shared
      ? "Click anything in the email below and type, the subject too. Enter starts a new paragraph or tip. To add a product, type its name in the box under the products and pick it."
      : html`Click the note, the product line or the P.S. below and type. The rest is the email everyone gets: edit "Everyone else" to change it for everybody.`}</div>
  </form>`;
}

function versionActions({ campaign, version, editing, costInputs, shop }) {
  if (campaign.status !== "review") return "";
  const action = `/admin/campaigns/${campaign.id}/versions/${version.id}`;
  const editor = editing ? editForm({ campaign, version, shop }) : "";
  if (version.status === "rejected") {
    return html`${editor}<form method="post" action="${action}" class="camp-redraft" data-busy-form>
      <label class="field" for="feedback">What should change?</label>
      <textarea id="feedback" name="feedback" rows="3" required maxlength="1000" placeholder="For example: softer, and don't suggest acids.">${version.feedback || ""}</textarea>
      <div class="camp-actions">
        <button type="submit" class="btn btn-primary" name="action" value="redraft" data-busy-text="Redrafting…">Redraft with my note</button>
        <button type="submit" class="btn btn-secondary" name="action" value="review" formnovalidate>Keep this version</button>
      </div>
      ${costInputs?.price ? html`<div class="camp-muted">A redraft costs about ${formatCost(estimateRedraft(costInputs, { shared: version.isShared, topicChars: campaign.topic.length, previousChars: JSON.stringify(campaign.content).length }))}.</div>` : ""}
      ${version.isShared ? "" : html`<div class="camp-muted">If you leave it rejected, ${versionName(version)} gets the email everyone else gets.</div>`}
    </form>`;
  }
  return html`${editor}<div class="camp-actions">
    <form method="post" action="${action}">
      ${version.status === "approved"
        ? html`<input type="hidden" name="action" value="review" /><button type="submit" class="btn btn-approved" title="Tap to undo">✓ Approved</button>`
        : html`<input type="hidden" name="action" value="approve" /><button type="submit" class="btn btn-approve">Approve</button>`}
    </form>
    <form method="post" action="${action}">
      <input type="hidden" name="action" value="reject" />
      <button type="submit" class="btn btn-secondary btn-reject">Reject</button>
    </form>
  </div>`;
}

/** "AI cost so far: $0.06 (5 AI calls, Claude Sonnet 5.5)". */
function spentLine(campaign) {
  const cost = costOf(campaign.usage);
  if (!cost.calls) return "";
  const amount = cost.dollars == null ? `${cost.tokens.toLocaleString("en-US")} tokens (no price on file for ${modelName(cost.model)})` : formatCost(cost.dollars);
  return `AI cost so far: ${amount} (${plural(cost.calls, "AI call")}, ${modelName(cost.model)}).`;
}

function sendBar({ campaign, versions, selected, counts, estimate, picked, schedule, dailyLimit, canTest }) {
  const shared = versions.find((version) => version.isShared);
  const personal = versions.filter((version) => !version.isShared);
  const approvedPersonal = personal.filter((version) => version.status === "approved").length;
  const unreviewed = personal.filter((version) => version.status === "review").length;
  const testForm = canTest ? html`<form method="post" action="/admin/campaigns/${campaign.id}/test" class="camp-inline-form">
      <input type="hidden" name="v" value="${selected.id}" />
      <button type="submit" class="btn btn-secondary">Email me a test</button>
    </form>` : "";

  if (campaign.status !== "review") {
    const total = counts.queued + counts.sent + counts.failed + counts.skipped;
    const daysLeft = Math.ceil(counts.queued / dailyLimit);
    return html`<div class="camp-send-bar">
      <div class="camp-send-text">
        <strong>${campaign.status === "sent" ? "Sent" : "Sending"}:</strong> ${spentLine(campaign)} ${counts.sent} of ${total} sent${counts.queued ? html`, ${counts.queued} queued (about ${plural(daysLeft, "more day")})` : ""}${counts.failed ? html`, ${counts.failed} failed` : ""}${counts.skipped ? html`, ${counts.skipped} unsubscribed` : ""}. <a href="/admin/campaigns/scheduled">See Scheduled</a>
      </div>
      ${testForm}
    </div>`;
  }

  const ready = shared?.status === "approved";
  const people = picked ? `${peopleCount(estimate)} you picked` : estimate ? `about ${estimate} clients` : "everyone with an email in Square";
  const when = scheduleSentence(schedule, new Date().toISOString().slice(0, 10));
  const spent = spentLine(campaign);
  const costText = `${spent ? `${spent} ` : ""}Sending adds no AI cost, and Resend's free plan covers it.`;
  return html`<div class="camp-send-bar">
    <div class="camp-send-text">
      ${ready
        ? html`<strong>Goes to ${people}${approvedPersonal ? html` · ${approvedPersonal} personal` : ""}.</strong> ${schedule.length > 1 || (schedule[0] && schedule[0].date !== new Date().toISOString().slice(0, 10)) ? html`<span class="camp-send-when">${when}</span>` : ""}<span class="camp-send-more"> ${costText}${unreviewed ? html` ${plural(unreviewed, "personal version")} not approved yet: those clients get the email everyone else gets.` : ""}</span>`
        : html`<strong>Approve the email everyone else gets before sending.</strong><span class="camp-send-more"> ${costText}</span>`}
    </div>
    <div class="camp-send-buttons">
      ${testForm}
      <form method="post" action="/admin/campaigns/${campaign.id}/send" class="camp-inline-form" data-confirm="${ready ? [`Send this email to ${people}?`, when, spent, "This can't be undone."].filter(Boolean).join(" ") : ""}">
        <button type="submit" class="btn btn-primary camp-big-btn"${ready ? "" : html` disabled`}>${picked ? "Send" : "Send to everyone"}</button>
      </form>
    </div>
  </div>`;
}

/** Who the campaign goes to, with a link to change it while it's in review. */
function audienceLine(campaign, estimate) {
  const emails = campaign.audience.emails;
  const who = emails ? `Goes to ${peopleCount(emails.length)} you picked.` : "Goes to everyone with an email in Square.";
  const mode = campaign.audience.personalize ? "" : " One email for everyone (personal notes off).";
  return html`<div class="camp-audience">
    <span>${who}${mode}</span>
    ${campaign.status === "review" ? html`<a href="/admin/campaigns/${campaign.id}/recipients">Change who gets it</a>` : ""}
  </div>`;
}

/** The version list, each with a box to tick for bulk approve or reject. */
function versionList({ campaign, versions, selected }) {
  const inReview = campaign.status === "review";
  const formId = "bulk-versions";
  return html`${inReview && versions.length > 1 ? html`<form method="post" action="/admin/campaigns/${campaign.id}/versions/bulk" id="${formId}" class="camp-bulk" data-bulk-form>
      <input type="hidden" name="v" value="${selected.id}" />
      <div class="camp-bulk-select">
        <label class="camp-check-all"><input type="checkbox" data-bulk-all aria-label="Select all versions" /> <span data-bulk-label>Select all</span></label>
        <button type="button" class="camp-text-btn" data-bulk-pick="review">Select “To review”</button>
      </div>
      <div class="camp-bulk-bar" data-bulk-bar>
        <span class="camp-bulk-count" data-bulk-count>Tick versions to approve or reject several at once.</span>
        <span class="camp-bulk-buttons">
          <button type="submit" name="action" value="approve" class="btn btn-approve btn-small" data-bulk-action>Approve</button>
          <button type="submit" name="action" value="reject" class="btn btn-secondary btn-reject btn-small" data-bulk-action>Reject</button>
        </span>
      </div>
    </form>` : ""}
    ${versions.map((version) => html`<div class="camp-version-row${version.id === selected.id ? " selected" : ""}">
      ${inReview && versions.length > 1 ? html`<label class="camp-version-check"><input type="checkbox" name="ids" value="${version.id}" form="${formId}" data-bulk-item data-status="${version.status}" aria-label="Select ${versionName(version)}" /></label>` : ""}
      <a class="camp-version${version.id === selected.id ? " selected" : ""}" href="/admin/campaigns/${campaign.id}?v=${version.id}&view=preview"${version.id === selected.id ? html` aria-current="true"` : ""}>
        <span class="camp-version-top">
          <span class="camp-version-name">${versionName(version)}</span>
          <span class="pill pill-${version.status}">${STATUS_LABELS[version.status] || version.status}</span>
        </span>
        <span class="camp-version-why">${version.isShared ? (versions.length > 1 ? "Clients without related notes or purchases" : "Everyone you picked") : version.reason || "Related to this topic"}</span>
      </a>
    </div>`)}`;
}

export function campaignReviewPage({ campaign, versions, selected, previewHtml, counts, estimate, picked = false, schedule = [], costInputs = null, dailyLimit, view, editing, shop = [], hints = [], notice, error, canTest }) {
  const toReview = versions.filter((version) => version.status === "review").length;
  const personalCount = versions.length - 1;
  const title = topicLabel(campaign);
  const listNote = personalCount
    ? `${plural(personalCount, "personal version")} · everyone else gets the shared email`
    : campaign.audience.personalize ? "No clients matched closely, so everyone gets the same email." : "Personal notes are off, so everyone gets the same email.";
  return html`
    <div class="camp-head">
      <a class="back-link" href="/admin/campaigns">← Email campaigns</a>
      <div class="camp-title-row">
        <h1 class="page-title">${campaign.content.headline || title}</h1>
        <span class="pill pill-${campaign.status}">${CAMPAIGN_LABELS[campaign.status] || campaign.status}</span>
      </div>
      ${steps(campaign.status === "review" ? 3 : 4)}
    </div>
    ${notices({ notice, error })}
    ${audienceLine(campaign, estimate)}
    <nav class="camp-tabs" aria-label="View">
      <a href="/admin/campaigns/${campaign.id}?view=list" class="${view === "list" ? "on" : ""}" aria-current="${view === "list" ? "page" : "false"}">Versions${toReview ? ` · ${toReview} to review` : ""}</a>
      <a href="/admin/campaigns/${campaign.id}?v=${selected.id}&view=preview" class="${view === "preview" ? "on" : ""}" aria-current="${view === "preview" ? "page" : "false"}">Preview</a>
    </nav>
    <div class="camp-review" data-view="${view}">
      <section class="camp-versions" aria-label="Versions">
        <div class="camp-muted">${listNote}</div>
        ${versionList({ campaign, versions, selected })}
        <div class="camp-muted">Skipped when sending: clients who unsubscribed or have no email in Square.</div>
        ${campaign.status === "review" ? html`<form method="post" action="/admin/campaigns/${campaign.id}/delete" data-confirm="Delete this draft? Nothing has been sent.">
          <button type="submit" class="camp-link-btn">Delete this draft</button>
        </form>` : ""}
      </section>
      <section class="camp-detail" aria-label="Selected version">
        <div class="card camp-detail-card">
          <div class="camp-detail-head">
            <div class="camp-detail-name">${versionName(selected)}</div>
            <div class="camp-muted">${selected.isShared ? (personalCount ? "The email every other client gets." : "The email everyone gets.") : selected.reason}</div>
          </div>
          <div class="camp-hints" data-voice-hints${hints.length ? "" : html` hidden`}>
            <div class="camp-hints-title">Laura's voice check</div>
            <ul>${hints.map((hint) => html`<li>${hint}</li>`)}</ul>
          </div>
          ${versionActions({ campaign, version: selected, editing, costInputs, shop })}
        </div>
        <div class="camp-preview">
          <iframe title="Email preview" class="camp-frame" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcdoc="${previewHtml}" loading="eager"></iframe>
        </div>
      </section>
    </div>
    ${sendBar({ campaign, versions, selected, counts, estimate, picked, schedule, dailyLimit, canTest })}
  `;
}

// --- Scheduled -----------------------------------------------------------

const TAMPA = "America/New_York";

function tampaTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TAMPA }).toLowerCase();
}

function tampaDateTime(iso) {
  if (!iso) return "";
  const date = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TAMPA }).replace(" AM", " am").replace(" PM", " pm");
}

/**
 * One usage bar: campaign emails and other emails (tests, reminders) as two
 * segments of Resend's allowance. The state word (not just the colour) says when it's nearly full.
 */
function usageMeter({ label, part, resetText, campaignLimitNote = "" }) {
  const used = Math.min(part.sent, part.limit);
  const pct = (value) => `${Math.min(100, (value / part.limit) * 100).toFixed(2)}%`;
  const share = part.sent / part.limit;
  const state = share >= 1 ? { key: "full", word: "Full" } : share >= 0.8 ? { key: "high", word: "Almost full" } : { key: "ok", word: "" };
  return html`<div class="camp-meter camp-meter-${state.key}">
    <div class="camp-meter-top">
      <span class="camp-meter-label">${label}</span>
      ${state.word ? html`<span class="camp-meter-state">${state.word}</span>` : ""}
    </div>
    <div class="camp-meter-figure"><strong>${part.sent.toLocaleString("en-US")}</strong> of ${part.limit.toLocaleString("en-US")} sent</div>
    <div class="camp-meter-track" role="img" aria-label="${label}: ${part.sent} of ${part.limit} sent, ${part.campaign} campaign emails and ${part.other} test or reminder emails">
      ${part.campaign ? html`<span class="camp-meter-fill" style="width:${pct(Math.min(part.campaign, used))}"></span>` : ""}
      ${part.other ? html`<span class="camp-meter-fill camp-meter-other" style="width:${pct(Math.min(part.other, used))}"></span>` : ""}
    </div>
    <div class="camp-meter-foot">
      <span>${Math.max(0, part.limit - part.sent).toLocaleString("en-US")} left · ${resetText}</span>
      <span class="camp-meter-key"><span class="camp-key-dot"></span>Campaigns ${part.campaign}<span class="camp-key-dot camp-key-other"></span>Tests and reminders ${part.other}</span>
    </div>
    ${campaignLimitNote ? html`<div class="camp-muted">${campaignLimitNote}</div>` : ""}
  </div>`;
}

const DELIVERY_LABELS = {
  delivered: "Delivered", opened: "Opened", clicked: "Clicked", delayed: "Delayed", bounced: "Bounced", complained: "Marked as spam",
};

function sendStatus(send) {
  if (send.status === "failed") return { key: "failed", label: "Failed" };
  if (send.status === "skipped") return { key: "skipped", label: "Unsubscribed" };
  if (send.delivery_status) {
    const bad = send.delivery_status === "bounced" || send.delivery_status === "complained";
    return { key: bad ? "failed" : send.delivery_status === "delayed" ? "queued" : "delivered", label: DELIVERY_LABELS[send.delivery_status] || send.delivery_status };
  }
  return { key: "sent", label: "Sent" };
}

function campaignName(campaign) {
  if (!campaign) return "Email";
  const content = campaign.content || {};
  return String(content.eyebrow || campaign.topic || "Email").replace(/^this week:\s*/i, "");
}

/** A thin stacked bar of how a campaign's emails ended up. */
function outcomeBar(row, tracking) {
  const total = (row.sent || 0) + (row.queued || 0) + (row.failed || 0) + (row.skipped || 0);
  if (!total) return "";
  const delivered = tracking ? Math.min(row.delivered || 0, row.sent || 0) : 0;
  const parts = [
    ["delivered", delivered, "Delivered"],
    ["sent", (row.sent || 0) - delivered - (tracking ? row.bounced || 0 : 0), tracking ? "Sent, not confirmed yet" : "Sent"],
    ["failed", (row.failed || 0) + (tracking ? row.bounced || 0 : 0), "Failed or bounced"],
    ["queued", row.queued || 0, "Scheduled"],
  ].filter(([, value]) => value > 0);
  return html`<div class="camp-outcome" role="img" aria-label="${parts.map(([, value, label]) => `${label}: ${value}`).join(", ")}">
    ${parts.map(([key, value, label]) => html`<span class="camp-outcome-${key}" style="flex-grow:${value}" title="${label}: ${value}"></span>`)}
  </div>`;
}

export function scheduledPage({ usage, days, campaigns, stats, recent, now, tracking, configured, siteUrl, notice, error }) {
  const today = now.toISOString().slice(0, 10);
  const resetDay = `resets at ${tampaTime(usage.today.resetsAt)} Tampa time`;
  const resetMonth = `resets ${new Date(usage.month.resetsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  const queuedTotal = days.reduce((sum, day) => sum + day.total, 0);
  return html`
    <div class="camp-title-row">
      <div>
        <h1 class="page-title">Email campaigns</h1>
        <div class="camp-sub">What's going out, when, and how it did.</div>
      </div>
      <a class="btn btn-primary" href="/admin/campaigns/new">+ New email</a>
    </div>
    ${sectionTabs("scheduled")}
    ${notices({ notice, error })}
    ${configured ? "" : html`<div class="card camp-setup"><div class="section-label">Finish setting up</div><ul><li>Add the RESEND_API_KEY secret and CAMPAIGN_FROM_EMAIL so emails can be sent.</li></ul></div>`}
    <div class="camp-home-grid">
      <section class="card camp-usage" aria-label="Resend usage">
        <div class="section-label">Resend free plan</div>
        ${usageMeter({
          label: "Today", part: usage.today, resetText: resetDay,
          campaignLimitNote: `Campaigns send up to ${usage.today.campaignLimit} a day, which leaves room for test emails and reminders.`,
        })}
        ${usageMeter({ label: "This month", part: usage.month, resetText: resetMonth })}
      </section>
      <section class="card camp-coming" aria-label="Coming up">
        <div class="section-label">Coming up</div>
        ${days.length ? html`<div class="camp-coming-total"><strong>${queuedTotal.toLocaleString("en-US")}</strong> ${queuedTotal === 1 ? "email" : "emails"} scheduled</div>
          <ol class="camp-days">
            ${days.map((day) => html`<li class="camp-day">
              <div class="camp-day-head">
                <span class="camp-day-name">${day.date === today ? "Today" : dayName(day.date)}</span>
                <span class="camp-day-count">${day.total}</span>
              </div>
              <div class="camp-day-bar"><span style="width:${Math.min(100, (day.total / usage.today.campaignLimit) * 100).toFixed(1)}%"></span></div>
              <ul class="camp-day-parts">${day.parts.map((part) => html`<li><a href="/admin/campaigns/${part.id}">${campaignName(campaigns.get(part.id))}</a> <span class="camp-muted">${part.count}</span></li>`)}</ul>
            </li>`)}
          </ol>
          <div class="camp-muted">Sending runs every 15 minutes. ${days[0].date === today ? "" : "Today's limit is used up, so the next batch goes after the reset. "}A new day starts at ${tampaTime(usage.today.resetsAt)} Tampa time.</div>`
        : html`<p class="camp-muted">Nothing scheduled. When you send to more people than today's limit allows, the rest wait here for the next day.</p>`}
      </section>
    </div>
    <section class="card camp-recent" aria-label="How they did">
      <div class="section-label">How they did</div>
      ${tracking ? "" : html`<div class="camp-tracking-off">
        <strong>Delivery tracking is off.</strong> You can see what was sent, but not when it arrived or was opened. To turn it on: in Resend, open Webhooks, add <code>${siteUrl}/email/resend-webhook</code> with the delivered, delayed, bounced, complained, opened and clicked events, then save its signing secret with <code>npx wrangler secret put RESEND_WEBHOOK_SECRET</code>.
      </div>`}
      ${stats.length ? html`<div class="camp-table-wrap"><table class="data camp-stats">
        <thead><tr><th scope="col">Email</th><th scope="col">Started</th><th scope="col" class="num">Sent</th>${tracking ? html`<th scope="col" class="num">Delivered</th><th scope="col" class="num">Opened</th><th scope="col" class="num">Bounced</th>` : ""}<th scope="col" class="num">Failed</th><th scope="col" class="num">Unsubscribed</th><th scope="col" class="num">Scheduled</th><th scope="col">Progress</th></tr></thead>
        <tbody>${stats.map((row) => html`<tr class="row-link" data-href="/admin/campaigns/${row.id}">
          <td><a href="/admin/campaigns/${row.id}">${campaignName(row)}</a></td>
          <td class="camp-nowrap">${tampaDateTime(row.send_started_at)}</td>
          <td class="num">${row.sent || 0}</td>
          ${tracking ? html`<td class="num">${row.delivered || 0}</td><td class="num">${row.opened || 0}</td><td class="num">${row.bounced || 0}</td>` : ""}
          <td class="num">${row.failed || 0}</td>
          <td class="num">${row.skipped || 0}</td>
          <td class="num">${row.queued || 0}</td>
          <td class="camp-outcome-cell">${outcomeBar(row, tracking)}</td>
        </tr>`)}</tbody>
      </table></div>
      <div class="camp-outcome-key camp-muted">
        ${tracking ? html`<span><span class="camp-key-dot camp-outcome-delivered"></span>Delivered</span>` : ""}
        <span><span class="camp-key-dot camp-outcome-sent"></span>${tracking ? "Sent, not confirmed yet" : "Sent"}</span>
        <span><span class="camp-key-dot camp-outcome-failed"></span>Failed${tracking ? " or bounced" : ""}</span>
        <span><span class="camp-key-dot camp-outcome-queued"></span>Scheduled</span>
      </div>` : html`<p class="camp-muted">Nothing sent yet.</p>`}
    </section>
    <section class="card camp-recent" aria-label="Latest emails">
      <div class="section-label">Latest emails</div>
      ${recent.length ? html`<div class="camp-table-wrap"><table class="data camp-sends">
        <thead><tr><th scope="col">To</th><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Sent</th>${tracking ? html`<th scope="col">Delivered</th>` : ""}</tr></thead>
        <tbody>${recent.map((send) => {
          const status = sendStatus(send);
          return html`<tr>
            <td><span class="camp-send-name">${send.first_name || send.email.split("@")[0]}</span><span class="camp-send-email">${send.email}</span></td>
            <td><a href="/admin/campaigns/${send.campaign_id}">${campaignName(send)}</a></td>
            <td><span class="pill pill-send-${status.key}"${send.error ? html` title="${send.error}"` : ""}>${status.label}</span></td>
            <td class="camp-nowrap">${tampaDateTime(send.sent_at)}</td>
            ${tracking ? html`<td class="camp-nowrap">${tampaDateTime(send.delivered_at) || html`<span class="camp-muted">—</span>`}</td>` : ""}
          </tr>`;
        })}</tbody>
      </table></div>` : html`<p class="camp-muted">No emails sent yet.</p>`}
      <div class="camp-muted">Times are Tampa time.</div>
    </section>
  `;
}

// --- Unsubscribe (public) ------------------------------------------------------

export function unsubscribePage({ state, email = "", token = "" }) {
  const body = {
    ask: html`<h1>Unsubscribe</h1>
      <p>Stop getting emails from Skin by Laura Lo at <strong>${email}</strong>?</p>
      <form method="post"><input type="hidden" name="e" value="${email}" /><input type="hidden" name="t" value="${token}" /><button type="submit">Unsubscribe</button></form>`,
    done: html`<h1>You're unsubscribed</h1><p>You won't get any more of these emails. Appointment emails from Square aren't affected.</p>`,
    invalid: html`<h1>This link didn't work</h1><p>Reply to any of Laura's emails and ask to be taken off the list, and she'll do it for you.</p>`,
  }[state];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Unsubscribe · Skin by Laura Lo</title>
<style>
body { margin: 0; background: #FBF6F0; color: #2A241F; font-family: Arial, Helvetica, sans-serif; }
main { max-width: 440px; margin: 0 auto; padding: 64px 20px; display: flex; flex-direction: column; gap: 14px; }
.brand { font-family: Georgia, serif; font-weight: bold; font-size: 20px; }
h1 { margin: 8px 0 0; font-family: Georgia, serif; font-size: 26px; }
p { margin: 0; font-size: 16px; line-height: 1.6; }
button { font: inherit; font-weight: bold; color: #FFF8F2; background: #B8714F; border: 0; border-radius: 10px; padding: 12px 22px; min-height: 44px; cursor: pointer; }
</style>
</head>
<body><main><div class="brand">Skin by Laura Lo</div>${toString(body)}</main></body>
</html>`;
}
