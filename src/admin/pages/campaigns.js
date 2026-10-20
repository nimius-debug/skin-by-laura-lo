import { html, toString } from "../../html.js";

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
        <thead><tr><th scope="col">Date</th><th scope="col">Topic</th><th scope="col">Status</th><th scope="col">Sent</th><th scope="col">Personal</th><th scope="col">Unsubscribed</th></tr></thead>
        <tbody>
          ${campaigns.map((campaign) => html`<tr class="row-link" data-href="/admin/campaigns/${campaign.id}">
            <td class="camp-nowrap">${shortDate(campaign.created_at)}</td>
            <td><a href="/admin/campaigns/${campaign.id}">${topicLabel(campaign)}</a></td>
            <td><span class="pill pill-${campaign.status}">${CAMPAIGN_LABELS[campaign.status] || campaign.status}</span></td>
            <td class="num">${campaign.sent_count}${campaign.queued_count ? html` <span class="camp-muted">+${campaign.queued_count} queued</span>` : ""}</td>
            <td class="num">${campaign.personal_count}</td>
            <td class="num">${campaign.unsubscribed_count}</td>
          </tr>`)}
        </tbody>
      </table></div>` : html`<p class="camp-muted">No emails yet. Press "New email" to write the first one.</p>`}
      <div class="camp-muted">Resend sends up to ${dailyLimit} emails a day, so a bigger list finishes the next morning.</div>
    </section>
  `;
}

// --- New email -------------------------------------------------------------

export function newCampaignPage({ topic = "", goal = "book", missing, error }) {
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
          <li>It looks through every client's notes (from the Excel sheet and Square) and what they bought, and when.</li>
          <li>Clients it relates to get a short personal note added. Allergy and sensitivity flags keep that advice gentle.</li>
          <li>You read each version, then approve, edit or reject it. Nothing sends until you press Send.</li>
        </ol>
        <div class="camp-muted">Personal notes never mention medications, pregnancy or diagnoses.</div>
      </aside>
    </div>
  `;
}

// --- Review ----------------------------------------------------------------

function versionName(version) {
  return version.isShared ? "Everyone else" : version.client_name || "Client";
}

function editForm({ campaign, version }) {
  const action = `/admin/campaigns/${campaign.id}/versions/${version.id}`;
  if (version.isShared) {
    const content = campaign.content;
    return html`<form method="post" action="${action}" class="camp-edit">
      <input type="hidden" name="action" value="save" />
      <label class="field">Subject line<input type="text" name="subject" value="${content.subject}" maxlength="120" required /></label>
      <label class="field">Preview line (shown after the subject in the inbox)<input type="text" name="preheader" value="${content.preheader}" maxlength="160" /></label>
      <label class="field">Small label above the headline<input type="text" name="eyebrow" value="${content.eyebrow}" maxlength="60" /></label>
      <label class="field">Headline<input type="text" name="headline" value="${content.headline}" maxlength="140" required /></label>
      <label class="field">Paragraphs (leave a blank line between them)<textarea name="paragraphs" rows="8">${(content.paragraphs || []).join("\n\n")}</textarea></label>
      <label class="field">Tips title<input type="text" name="tipsTitle" value="${content.tipsTitle}" maxlength="80" /></label>
      <label class="field">Tips (one per line)<textarea name="tips" rows="4">${(content.tips || []).join("\n")}</textarea></label>
      <div class="camp-actions">
        <button type="submit" class="btn btn-primary">Save changes</button>
        <a class="btn btn-secondary" href="/admin/campaigns/${campaign.id}?v=${version.id}&view=preview">Cancel</a>
      </div>
    </form>`;
  }
  return html`<form method="post" action="${action}" class="camp-edit">
    <input type="hidden" name="action" value="save" />
    <label class="field">Personal note<textarea name="personalNote" rows="5" required>${version.personal.personalNote || ""}</textarea></label>
    ${version.personal.product ? html`<label class="field">Line about ${version.personal.product.name}<textarea name="productNote" rows="2">${version.personal.product.note || ""}</textarea></label>` : ""}
    <div class="camp-actions">
      <button type="submit" class="btn btn-primary">Save changes</button>
      <a class="btn btn-secondary" href="/admin/campaigns/${campaign.id}?v=${version.id}&view=preview">Cancel</a>
    </div>
  </form>`;
}

function versionActions({ campaign, version, editing }) {
  if (campaign.status !== "review") return "";
  const action = `/admin/campaigns/${campaign.id}/versions/${version.id}`;
  if (editing) return editForm({ campaign, version });
  if (version.status === "rejected") {
    return html`<form method="post" action="${action}" class="camp-redraft" data-busy-form>
      <label class="field" for="feedback">What should change?</label>
      <textarea id="feedback" name="feedback" rows="3" required maxlength="1000" placeholder="For example: softer, and don't suggest acids.">${version.feedback || ""}</textarea>
      <div class="camp-actions">
        <button type="submit" class="btn btn-primary" name="action" value="redraft" data-busy-text="Redrafting…">Redraft with my note</button>
        <button type="submit" class="btn btn-secondary" name="action" value="review" formnovalidate>Keep this version</button>
      </div>
      ${version.isShared ? "" : html`<div class="camp-muted">If you leave it rejected, ${versionName(version)} gets the email everyone else gets.</div>`}
    </form>`;
  }
  return html`<div class="camp-actions">
    <form method="post" action="${action}">
      ${version.status === "approved"
        ? html`<input type="hidden" name="action" value="review" /><button type="submit" class="btn btn-approved" title="Tap to undo">✓ Approved</button>`
        : html`<input type="hidden" name="action" value="approve" /><button type="submit" class="btn btn-approve">Approve</button>`}
    </form>
    <a class="btn btn-secondary" href="/admin/campaigns/${campaign.id}?v=${version.id}&view=preview&edit=1">Edit</a>
    <form method="post" action="${action}">
      <input type="hidden" name="action" value="reject" />
      <button type="submit" class="btn btn-secondary btn-reject">Reject</button>
    </form>
  </div>`;
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
        <strong>${campaign.status === "sent" ? "Sent" : "Sending"}:</strong> ${counts.sent} of ${total} sent${counts.queued ? html`, ${counts.queued} queued (about ${plural(daysLeft, "more day")})` : ""}${counts.failed ? html`, ${counts.failed} failed` : ""}${counts.skipped ? html`, ${counts.skipped} unsubscribed` : ""}.
      </div>
      ${testForm}
    </div>`;
  }

  const ready = shared?.status === "approved";
  const people = estimate ? `about ${estimate} clients` : "everyone with an email in Square";
  const days = estimate ? Math.ceil(estimate / dailyLimit) : 1;
  return html`<div class="camp-send-bar">
    <div class="camp-send-text">
      ${ready
        ? html`<strong>Goes to ${people}${approvedPersonal ? html` · ${approvedPersonal} personal` : ""}.</strong><span class="camp-send-more">${days > 1 ? html` Resend sends ${dailyLimit} a day, so it finishes over ${days} days.` : ""}${unreviewed ? html` ${plural(unreviewed, "personal version")} not approved yet: those clients get the email everyone else gets.` : ""}</span>`
        : html`<strong>Approve the email everyone else gets before sending.</strong>`}
    </div>
    <div class="camp-send-buttons">
      ${testForm}
      <form method="post" action="/admin/campaigns/${campaign.id}/send" class="camp-inline-form" data-confirm="${ready ? `Send this email to ${people}? This can't be undone.` : ""}">
        <button type="submit" class="btn btn-primary camp-big-btn"${ready ? "" : html` disabled`}>Send to everyone</button>
      </form>
    </div>
  </div>`;
}

export function campaignReviewPage({ campaign, versions, selected, previewHtml, counts, estimate, dailyLimit, view, editing, notice, error, canTest }) {
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
          ${versionActions({ campaign, version: selected, editing })}
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
