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

/** True when the form says which Google Forms question each of its questions came from. */
const canImport = (form) => form.steps.some((step) => step.questions.some((question) => question.google));

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
              ${canImport(form) ? html`<a class="btn btn-secondary" href="/admin/forms/${form.slug}/import">Import from Google Forms</a>` : ""}
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
      <div class="forms-card-actions">
        ${canImport(form) ? html`<a class="btn btn-secondary" href="/admin/forms/${form.slug}/import">Import from Google Forms</a>` : ""}
        <a class="btn btn-secondary" href="/forms/${form.slug}" target="_blank" rel="noopener">Open the form</a>
      </div>
    </div>
    ${submissionTable(submissions)}
  `;
}

const LINK_METHOD = {
  square: "matched by her email or phone in Square",
  sync: "matched after a Square sync",
  manual: "linked by hand",
  "import-name": "imported from Google Forms and matched by name (check it's the right person)",
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

// Photos she sent here show as pictures; Google Drive links from an import show as links.
function answerCell(submission, row) {
  if (row.photos?.length) {
    return html`<div class="forms-photos">${row.photos.map((photo) => {
      const src = `/admin/forms/submissions/${submission.id}/photos/${row.id}/${photo.index}`;
      return html`<a href="${src}" target="_blank" rel="noopener" class="forms-photo"><img src="${src}" alt="${photo.slot}" loading="lazy" /><span>${photo.slot}</span></a>`;
    })}</div>`;
  }
  const links = String(row.value || "").split(/,\s*/).filter((part) => /^https:\/\/(drive|docs)\.google\.com\//.test(part));
  if (links.length && links.length === String(row.value).split(/,\s*/).length) {
    return html`<div class="sheet-value">${links.map((link, index) => html`<a href="${link}" target="_blank" rel="noopener">Photo ${index + 1}</a>${index < links.length - 1 ? " · " : ""}`)}</div>`;
  }
  return html`<div class="sheet-value${row.value ? "" : " forms-blank"}">${row.value || "Left blank"}</div>`;
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
                  ${answerCell(submission, row)}
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

const MATCH_LABEL = {
  email: "by email in Square",
  phone: "by phone in Square",
  name: "by name only, check it",
  waiting: "in Square, not a client yet: links after her first visit syncs",
  none: "no match: pick her by hand after importing",
};

function uploadForm(form) {
  return html`
    <form method="post" action="/admin/forms/${form.slug}/import" enctype="multipart/form-data" class="card forms-import-upload">
      <label class="field">Responses file (.csv)
        <input type="file" name="file" accept=".csv,text/csv" required />
      </label>
      <button type="submit" class="btn btn-primary">Check the file</button>
    </form>
  `;
}

/** /admin/forms/:slug/import — upload a Google Forms CSV, then see who each response matches before importing. */
export function importPage({ form, preview = null, csv = "", result = null }) {
  const steps = html`
    <ol class="camp-how">
      <li>Open the ${form.title} in Google Forms and go to the <strong>Responses</strong> tab.</li>
      <li>Click the three dots and choose <strong>Download responses (.csv)</strong>.</li>
      <li>Upload the file here. You'll see who each response matches before anything is saved.</li>
    </ol>
  `;
  const head = html`
    <a href="/admin/forms/${form.slug}" class="back-link">← ${form.title}</a>
    <div>
      <h1 class="page-title">Import from Google Forms</h1>
      <div class="camp-sub" style="margin-top: 2px;">${form.title}. Each response keeps its original date and goes into the client's notes, so her insights include it. Importing the same file again never adds anything twice.</div>
    </div>
  `;

  if (result) {
    return html`${head}
      <div class="camp-notice">Imported ${result.added} response${result.added === 1 ? "" : "s"}${result.added ? `, ${result.linked} linked to a client` : ""}.${result.added - result.linked > 0 ? " The rest are marked \u201cNeeds a client\u201d on the form's page." : ""}</div>
      <div class="forms-card-actions"><a class="btn btn-primary" href="/admin/forms/${form.slug}">See the submissions</a><a class="btn btn-secondary" href="/admin/forms/${form.slug}/import">Import another file</a></div>`;
  }

  if (!preview) return html`${head}<div class="card">${steps}</div>${uploadForm(form)}`;
  if (preview.error) return html`${head}<div class="camp-error">${preview.error}</div>${uploadForm(form)}`;

  const fresh = preview.rows.filter((row) => !row.alreadyImported);
  const linked = fresh.filter((row) => row.match.clientId).length;
  return html`${head}
    ${preview.squareChecked ? "" : html`<div class="camp-error">Square couldn't be reached, so responses were matched by name only. Try again later for email and phone matching.</div>`}
    ${preview.missing.length ? html`<div class="camp-setup card"><strong>These questions weren't found in the file</strong>, so they'll be left blank:<ul>${preview.missing.map((label) => html`<li>${label}</li>`)}</ul></div>` : ""}
    <div class="card" style="padding: 0; overflow: hidden;">
      <div class="camp-table-wrap" style="margin: 0;">
        <table class="data">
          <thead><tr><th>Name</th><th>Sent</th><th>Client</th><th>Skip</th></tr></thead>
          <tbody>
            ${preview.rows.map((row) => html`
              <tr${row.alreadyImported ? raw(' class="forms-import-done"') : ""}>
                <td><strong>${row.answers.full_name || row.answers.email}</strong>${row.answers.email ? html`<div class="history-meta">${row.answers.email}</div>` : ""}</td>
                <td class="camp-nowrap" style="color: var(--ink-soft);">${row.submittedAt ? formatDay(row.submittedAt) : "No date"}</td>
                <td>${row.alreadyImported
                  ? html`<span class="pill pill-muted">Already imported</span>`
                  : row.match.clientId
                    ? html`<strong>${row.match.clientName}</strong><div class="history-meta${row.match.how === "name" ? " forms-check" : ""}">${MATCH_LABEL[row.match.how]}</div>`
                    : html`<span class="pill pill-review">Needs a client</span><div class="history-meta">${MATCH_LABEL[row.match.how]}</div>`}</td>
                <td>${row.alreadyImported ? "" : html`<label class="forms-skip"><input type="checkbox" name="skip" value="${row.key}" form="forms-import-confirm" aria-label="Skip ${row.answers.full_name || "this response"}" /></label>`}</td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    </div>
    ${fresh.length
      ? html`<form method="post" action="/admin/forms/${form.slug}/import" class="forms-import-confirm" id="forms-import-confirm">
          <textarea name="csv" hidden>${csv}</textarea>
          <input type="hidden" name="confirm" value="1" />
          <div class="camp-muted">${fresh.length} new response${fresh.length === 1 ? "" : "s"}, ${linked} matched to a client. Tick Skip on any you don't want, like a test entry.</div>
          <button type="submit" class="btn btn-primary">Import new responses</button>
        </form>`
      : html`<div class="camp-notice">Everything in this file is already imported.</div>`}
  `;
}
