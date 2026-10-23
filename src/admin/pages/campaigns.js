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

function steps(current) {
  return html`<ol class="camp-steps" aria-label="Steps">
    ${["Write", "Find clients", "Review", "Send"].map((label, index) => html`<li class="${index + 1 === current ? "on" : index + 1 < current ? "done" : ""}">${index + 1} · ${label}</li>`)}
  </ol>`;
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
      <div class="camp-muted">Resend sends up to ${dailyLimit} emails a day, so a bigger list finishes the next morning.</div>
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

export function newCampaignPage({ topic = "", goal = "book", missing, error, estimate = null, history = null }) {
  return html`
    <div class="camp-head">
      <a class="back-link" href="/admin/campaigns">← Email campaigns</a>
      <h1 class="page-title">New email</h1>
      ${steps(1)}
    </div>
    ${notices({ error })}
    ${setupCard(missing)}
    <div class="camp-new-grid">
      <form class="card camp-write" method="post" action="/admin/campaigns" data-draft-form>
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
        <div class="camp-submit-row">
          <button type="submit" class="btn btn-primary camp-big-btn" data-draft-button>Find clients and draft emails</button>
        </div>
        <div class="camp-drafting" data-drafting hidden>
          <span class="spinner" aria-hidden="true"></span>
          <span data-drafting-text>Writing the email…</span>
        </div>
      </form>
      <aside class="card camp-checks">
        <div class="section-label">What happens next</div>
        <ol class="camp-how">
          <li>The AI writes one email for everyone, in your voice and at a 5th-grade reading level.</li>
          <li>Products you mention are added as cards with their photo, price and a shop link. Say "no products" to leave them out.</li>
          <li>It looks through every client's notes (from the Excel sheet and Square) and what they bought, and when.</li>
          <li>Clients it relates to get a short personal note added. Allergy and sensitivity flags keep that advice gentle.</li>
          <li>You read each version, then approve, edit or reject it. Nothing sends until you press Send.</li>
        </ol>
        <div class="camp-muted">Personal notes never mention medications, pregnancy or diagnoses.</div>
        ${costEstimateCard({ estimate, history, topic })}
      </aside>
    </div>
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
 * saved order (so a save without the script changes nothing) and a toolbar
 * menu to add one from the shop. Each card in the email has its own Remove button.
 */
function productFields(campaign) {
  return html`<input type="hidden" name="productsShown" value="1" />
    <span data-product-fields>${contentProducts(campaign.content).map((card) => html`<input type="hidden" name="product" value="${card.name}" />`)}</span>`;
}

function addProductMenu({ campaign, shop }) {
  if (!shop.length) return "";
  const inEmail = new Set(contentProducts(campaign.content).map((card) => card.name));
  return html`<label class="camp-tool-select">Add product
    <select data-product-add data-max="${MAX_EMAIL_PRODUCTS}" aria-label="Add a product from the shop">
      <option value="">Choose…</option>
      ${shop.map((product) => html`<option value="${product.name}"${inEmail.has(product.name) ? html` hidden disabled` : ""}>${product.name}${Number.isFinite(product.priceCents) ? ` · ${formatMoney(product.priceCents)}` : ""}</option>`)}
    </select>
  </label>`;
}

// The editor: the email in the preview below is editable as it stands (see
// client.js), subject and preview line included, and saves itself as Laura
// types. This bar holds formatting, the button choice, products and the saved state.
function editForm({ campaign, version, shop = [] }) {
  const action = `/admin/campaigns/${campaign.id}/versions/${version.id}`;
  const shared = version.isShared;
  const content = campaign.content;
  return html`<form method="post" action="${action}" class="camp-edit camp-editor" data-inline-editor data-hints-url="${action}/preview" data-product-card-url="/admin/campaigns/product-card">
    <input type="hidden" name="action" value="save" />
    ${shared ? html`
      ${kept("subject", content.subject)}${kept("preheader", content.preheader)}${kept("eyebrow", content.eyebrow)}${kept("headline", content.headline)}${kept("paragraphs", (content.paragraphs || []).join("\n\n"))}
      ${kept("tipsTitle", content.tipsTitle)}${kept("tips", (content.tips || []).join("\n"))}${kept("ps", content.ps)}
      ${kept("greeting", content.greeting)}${kept("buttonLabel", content.buttonLabel)}${kept("signoff", content.signoff)}${kept("signName", content.signName)}${kept("shopTitle", content.shopTitle)}
      ${productFields(campaign)}`
    : html`${kept("personalNote", version.personal.personalNote)}${kept("productNote", version.personal.product?.note)}${kept("ps", version.personal.ps)}`}
    <div class="camp-toolbar" role="toolbar" aria-label="Formatting">
      <button type="button" class="camp-tool" data-format="bold" aria-label="Bold" title="Bold"><strong>B</strong></button>
      <button type="button" class="camp-tool" data-format="link" title="Add a link">Link</button>
      ${shared ? html`<label class="camp-tool-select">Button
        <select name="goal">${GOAL_OPTIONS.map((option) => html`<option value="${option.value}"${option.value === campaign.goal ? html` selected` : ""}>${option.value === "news" ? "No button" : option.label}</option>`)}</select>
      </label>` : ""}
      ${shared ? addProductMenu({ campaign, shop }) : ""}
      <span class="camp-toolbar-gap"></span>
      <span class="camp-saved" data-save-state aria-live="polite">Changes save as you type</span>
    </div>
    <div class="camp-muted">${shared
      ? "Click anything in the email below and type, the subject too. Enter starts a new paragraph or tip. Add products from the bar, and take one out with its Remove button."
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

function sendBar({ campaign, versions, selected, counts, estimate, dailyLimit, canTest }) {
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
        <strong>${campaign.status === "sent" ? "Sent" : "Sending"}:</strong> ${spentLine(campaign)} ${counts.sent} of ${total} sent${counts.queued ? html`, ${counts.queued} queued (about ${plural(daysLeft, "more day")})` : ""}${counts.failed ? html`, ${counts.failed} failed` : ""}${counts.skipped ? html`, ${counts.skipped} unsubscribed` : ""}.
      </div>
      ${testForm}
    </div>`;
  }

  const ready = shared?.status === "approved";
  const people = estimate ? `about ${estimate} clients` : "everyone with an email in Square";
  const days = estimate ? Math.ceil(estimate / dailyLimit) : 1;
  const spent = spentLine(campaign);
  const costText = `${spent ? `${spent} ` : ""}Sending adds no AI cost, and Resend's free plan covers it.`;
  return html`<div class="camp-send-bar">
    <div class="camp-send-text">
      ${ready
        ? html`<strong>Goes to ${people}${approvedPersonal ? html` · ${approvedPersonal} personal` : ""}.</strong><span class="camp-send-more"> ${costText}${days > 1 ? html` Resend sends ${dailyLimit} a day, so it finishes over ${days} days.` : ""}${unreviewed ? html` ${plural(unreviewed, "personal version")} not approved yet: those clients get the email everyone else gets.` : ""}</span>`
        : html`<strong>Approve the email everyone else gets before sending.</strong><span class="camp-send-more"> ${costText}</span>`}
    </div>
    <div class="camp-send-buttons">
      ${testForm}
      <form method="post" action="/admin/campaigns/${campaign.id}/send" class="camp-inline-form" data-confirm="${ready ? [`Send this email to ${people}?`, spent, "Sending adds no AI cost. This can't be undone."].filter(Boolean).join(" ") : ""}">
        <button type="submit" class="btn btn-primary camp-big-btn"${ready ? "" : html` disabled`}>Send to everyone</button>
      </form>
    </div>
  </div>`;
}

export function campaignReviewPage({ campaign, versions, selected, previewHtml, counts, estimate, costInputs = null, dailyLimit, view, editing, shop = [], hints = [], notice, error, canTest }) {
  const toReview = versions.filter((version) => version.status === "review").length;
  const personalCount = versions.length - 1;
  const title = topicLabel(campaign);
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
    <nav class="camp-tabs" aria-label="View">
      <a href="/admin/campaigns/${campaign.id}?view=list" class="${view === "list" ? "on" : ""}" aria-current="${view === "list" ? "page" : "false"}">Versions${toReview ? ` · ${toReview} to review` : ""}</a>
      <a href="/admin/campaigns/${campaign.id}?v=${selected.id}&view=preview" class="${view === "preview" ? "on" : ""}" aria-current="${view === "preview" ? "page" : "false"}">Preview</a>
    </nav>
    <div class="camp-review" data-view="${view}">
      <section class="camp-versions" aria-label="Versions">
        <div class="camp-muted">${personalCount ? `${plural(personalCount, "personal version")} · everyone else gets the shared email` : "No clients matched closely, so everyone gets the same email."}</div>
        ${versions.map((version) => html`<a class="camp-version${version.id === selected.id ? " selected" : ""}" href="/admin/campaigns/${campaign.id}?v=${version.id}&view=preview"${version.id === selected.id ? html` aria-current="true"` : ""}>
          <span class="camp-version-top">
            <span class="camp-version-name">${versionName(version)}</span>
            <span class="pill pill-${version.status}">${STATUS_LABELS[version.status] || version.status}</span>
          </span>
          <span class="camp-version-why">${version.isShared ? "Clients without related notes or purchases" : version.reason || "Related to this topic"}</span>
        </a>`)}
        <div class="camp-muted">Skipped when sending: clients who unsubscribed or have no email in Square.</div>
        ${campaign.status === "review" ? html`<form method="post" action="/admin/campaigns/${campaign.id}/delete" data-confirm="Delete this draft? Nothing has been sent.">
          <button type="submit" class="camp-link-btn">Delete this draft</button>
        </form>` : ""}
      </section>
      <section class="camp-detail" aria-label="Selected version">
        <div class="card camp-detail-card">
          <div class="camp-detail-head">
            <div class="camp-detail-name">${versionName(selected)}</div>
            <div class="camp-muted">${selected.isShared ? "The email every other client gets." : selected.reason}</div>
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
    ${sendBar({ campaign, versions, selected, counts, estimate, dailyLimit, canTest })}
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
