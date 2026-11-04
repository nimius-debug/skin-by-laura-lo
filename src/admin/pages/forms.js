import { html, raw } from "../../html.js";
import { FORMS } from "../../forms/definitions.js";

function formatWhen(sqlTime) {
  if (!sqlTime) return "";
  return new Date(`${sqlTime.replace(" ", "T")}Z`).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

function formatDay(sqlTime) {
  if (!sqlTime) return "";
  return new Date(`${sqlTime.replace(" ", "T")}Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
}

const titleOf = (slug) => FORMS.find((form) => form.slug === slug)?.title || slug;

function clientCell(row) {
  return row.client_id
    ? html`<span>${row.client_name}</span>`
    : html`<span class="pill pill-review">Needs a client</span>`;
}

function submissionRows(rows, { showForm = false } = {}) {
  if (!rows.length) {
    return html`<tr><td colspan="${showForm ? 4 : 3}" style="color: var(--ink-soft); text-align: center; padding: 32px;">Nothing yet. Submissions show up here as soon as a client sends the form.</td></tr>`;
  }
  return rows.map((row) => html`
    <tr class="row-link" data-client-href="/admin/forms/submissions/${row.id}">
      <td style="font-weight: 600;">${row.status === "new" ? html`<span class="dot" style="background: var(--accent); margin-right: 8px;" aria-label="New"></span>` : ""}${row.name}</td>
      ${showForm ? html`<td class="forms-col-form">${titleOf(row.form_slug)}</td>` : ""}
      <td style="color: var(--ink-soft);" class="camp-nowrap">${formatDay(row.submitted_at)}</td>
      <td>${clientCell(row)}</td>
    </tr>
  `);
}

function submissionTable(rows, options = {}) {
  return html`
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="camp-table-wrap" style="margin: 0;">
        <table class="data">
          <thead><tr><th>Name</th>${options.showForm ? html`<th class="forms-col-form">Form</th>` : ""}<th>Sent</th><th>Client</th></tr></thead>
          <tbody>${submissionRows(rows, options)}</tbody>
        </table>
      </div>
    </div>
  `;
}

/** /admin/forms: each form with its counts and public link, then the latest submissions across all forms. */
export function formsHomePage({ counts, recent, siteUrl }) {
  return html`
    <div>
      <h1 class="page-title">Forms</h1>
      <div class="camp-sub" style="margin-top: 2px;">What clients send from the Forms menu on the site. Each one is added to her notes once it's linked to her.</div>
    </div>
    <div class="forms-grid">
      ${FORMS.map((form) => {
        const count = counts[form.slug] || { total: 0, unread: 0, unlinked: 0 };
        const link = `${siteUrl}/forms/${form.slug}`;
        return html`
          <div class="card forms-card">
            <a class="forms-card-title" href="/admin/forms/${form.slug}">${form.title}</a>
            <div class="forms-stats">
              <span><strong>${count.total}</strong> sent</span>
              ${count.unread ? html`<span class="pill pill-sending">${count.unread} new</span>` : ""}
              ${count.unlinked ? html`<span class="pill pill-review">${count.unlinked} need a client</span>` : ""}
            </div>
            <div class="forms-link-row">
              <input type="text" readonly value="${link}" aria-label="Link to the form" data-copy-source />
              <button type="button" class="btn btn-secondary" data-copy-link="${link}">Copy link</button>
            </div>
            <div class="forms-card-actions">
              <a class="btn btn-primary" href="/admin/forms/${form.slug}">See submissions</a>
              <a class="btn btn-secondary" href="/forms/${form.slug}" target="_blank" rel="noopener">Open the form</a>
            </div>
          </div>
        `;
      })}
    </div>
    <div class="section-label">Latest</div>
    ${submissionTable(recent, { showForm: FORMS.length > 1 })}
  `;
}

/** /admin/forms/:slug — every submission of one form. */
export function formSubmissionsPage({ form, submissions }) {
  const unlinked = submissions.filter((row) => !row.client_id).length;
  return html`
    <a href="/admin/forms" class="back-link">← All forms</a>
    <div class="camp-title-row">
      <div>
        <h1 class="page-title">${form.title}</h1>
        <div class="camp-sub" style="margin-top: 2px;">${submissions.length} sent${unlinked ? ` · ${unlinked} need${unlinked === 1 ? "s" : ""} a client` : ""}</div>
      </div>
      <a class="btn btn-secondary" href="/forms/${form.slug}" target="_blank" rel="noopener">Open the form</a>
    </div>
    ${submissionTable(submissions)}
  `;
}

const LINK_METHOD = {
  square: "matched by her email or phone in Square",
  sync: "matched after a Square sync",
  manual: "linked by hand",
};

function linkCard(submission, { suggestions, clients }) {
  const suggestedIds = new Set(suggestions.map((client) => client.id));
  const picker = html`
    <form method="post" action="/admin/forms/submissions/${submission.id}/link" class="forms-link-form">
      <label class="field">Client
        <select name="client_id" required>
          <option value="">Choose a client…</option>
          ${suggestions.length ? html`<optgroup label="Same name">${suggestions.map((client) => html`<option value="${client.id}">${client.name}</option>`)}</optgroup>` : ""}
          <optgroup label="All clients">
            ${clients.filter((client) => !suggestedIds.has(client.id)).map((client) => html`<option value="${client.id}"${client.id === submission.client_id ? raw(" selected") : ""}>${client.name}</option>`)}
          </optgroup>
        </select>
      </label>
      <button type="submit" class="btn btn-primary">${submission.client_id ? "Move to this client" : "Link to client"}</button>
    </form>
  `;

  if (submission.client_id) {
    return html`
      <div class="card forms-linked">
        <div class="section-label">Client</div>
        <a class="forms-client-name" href="/admin/clients/${submission.client_id}">${submission.client_name} →</a>
        <div class="camp-muted">${LINK_METHOD[submission.link_method] ? `Linked: ${LINK_METHOD[submission.link_method]}.` : ""} It's in her notes, so her next summary takes it into account.</div>
        <details class="forms-change">
          <summary>Wrong client?</summary>
          ${picker}
          <form method="post" action="/admin/forms/submissions/${submission.id}/unlink" style="margin: 0;">
            <button type="submit" class="camp-link-btn">Unlink from ${submission.client_name}</button>
          </form>
        </details>
      </div>
    `;
  }
  const waiting = submission.square_customer_id
    ? "Her email or phone matched a Square customer who hasn't had a completed booking yet. This links by itself after her visit, on the next Sync from Square, or you can pick her now."
    : "Her email and phone didn't match anyone in Square. Pick her below to add this to her notes.";
  return html`
    <div class="card forms-unlinked">
      <div class="section-label">Needs a client</div>
      <div class="camp-muted">${waiting}</div>
      ${picker}
    </div>
  `;
}

/** One submission: who sent it, the client it belongs to, and every answer. */
export function submissionPage({ form, submission, suggestions = [], clients = [] }) {
  return html`
    <a href="/admin/forms/${submission.form_slug}" class="back-link">← ${form?.title || "Forms"}</a>
    <div class="profile-head">
      <h1 class="page-title">${submission.name}</h1>
      <div class="camp-sub">${form?.title || submission.form_slug} · sent ${formatWhen(submission.submitted_at)}</div>
      <div class="forms-contact">
        ${submission.email ? html`<a href="mailto:${submission.email}">${submission.email}</a>` : ""}
        ${submission.phone ? html`<a href="tel:${submission.phone}">${submission.phone}</a>` : ""}
      </div>
    </div>
    <div class="two-col">
      <div class="main">
        ${submission.display.map((step) => html`
          <div class="card">
            <div class="section-label" style="margin-bottom: 12px;">${step.title}</div>
            <div class="sheet-fields">
              ${step.rows.map((row) => html`
                <div class="sheet-field">
                  <div class="forms-q">${row.label}</div>
                  <div class="sheet-value${row.value ? "" : " forms-blank"}">${row.value || "Left blank"}</div>
                </div>
              `)}
            </div>
          </div>
        `)}
      </div>
      <div class="side">
        ${linkCard(submission, { suggestions, clients })}
        <div class="card">
          <div class="section-label" style="margin-bottom: 8px;">What goes in her notes</div>
          <p class="note-view">${submission.note_text}</p>
        </div>
      </div>
    </div>
  `;
}

/** The client page's list of forms she has sent. */
export function clientFormsCard(submissions) {
  if (!submissions.length) return "";
  return html`
    <div class="card" style="display: flex; flex-direction: column; gap: 8px;">
      <div class="section-label">Forms</div>
      ${submissions.map((row) => html`
        <a class="forms-client-row" href="/admin/forms/submissions/${row.id}">
          <span class="routine-name">${titleOf(row.form_slug)}</span>
          <span class="history-meta">Sent ${formatDay(row.submitted_at)}</span>
        </a>
      `)}
    </div>
  `;
}
