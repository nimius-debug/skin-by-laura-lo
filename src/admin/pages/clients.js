import { html } from "../../html.js";

function formatDate(iso) {
  if (!iso) return "No notes yet";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** A client's buttons on the Today list: write today's note, or, once it's saved, see it or write another. */
function todayActions(row) {
  if (!row.clientId) return "";
  const write = `/admin/clients/${row.clientId}/write`;
  if (!row.todayNote) return html`<a class="btn btn-primary today-write" href="${write}" data-write-client="${row.clientId}">Write a note</a>`;
  const edit = row.todayNote.source === "ipad" ? `/admin/notes/${row.todayNote.id}/edit` : `/admin/clients/${row.clientId}`;
  return html`<span class="today-done">
    <span class="today-saved">✓ Note saved</span>
    <a class="btn btn-secondary today-write" href="${edit}">${row.todayNote.source === "ipad" ? "Edit" : "View"}</a>
    <a class="btn btn-secondary today-write" href="${write}" data-write-client="${row.clientId}" aria-label="Write another note for ${row.name}">+ Note</a>
  </span>`;
}

/** Today's appointments from Square, with a Write a note button for each client. Hidden when there's no Square. */
function todayCard(today) {
  if (!today) return "";
  const heading = new Date(`${today.day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  let body;
  if (today.failed) {
    body = html`<div class="today-empty">Couldn't read today's bookings from Square just now.</div>`;
  } else if (!today.rows.length) {
    body = html`<div class="today-empty">Nothing booked today.</div>`;
  } else {
    body = html`<ul class="today-list">
      ${today.rows.map((row) => html`
        <li class="today-row${row.next ? " is-next" : ""}${row.todayNote ? " has-note" : ""}">
          <span class="today-time">${row.time}${row.next ? html`<span class="today-next">Next</span>` : ""}</span>
          <span class="today-who">
            ${row.clientId ? html`<a href="/admin/clients/${row.clientId}">${row.name}</a>` : html`<span>${row.name}</span>`}
            <span class="today-service">${row.services.length ? row.services.join(", ") : ""}${row.clientId ? "" : `${row.services.length ? " · " : ""}First visit: shows up after her visit and a sync`}</span>
          </span>
          ${todayActions(row)}
        </li>
      `)}
    </ul>`;
  }
  return html`
    <section class="card today-card" aria-labelledby="today-heading">
      <div class="section-label" id="today-heading">Today · ${heading}</div>
      ${body}
    </section>
  `;
}

/** Visits from the last week that still have no note, after their reminder went out. Hidden when there are none. */
function needsNotesCard(visits) {
  if (!visits.length) return "";
  return html`
    <section class="card today-card needs-notes-card" id="needs-notes" aria-labelledby="needs-notes-heading">
      <div class="section-label" id="needs-notes-heading">Still need notes</div>
      <ul class="today-list">
        ${visits.map((visit) => html`
          <li class="today-row">
            <span class="today-who">
              <a href="/admin/clients/${visit.clientId}">${visit.name}</a>
              <span class="today-service">${visit.service ? `${visit.service} · ` : ""}${visit.when}</span>
            </span>
            <a class="btn btn-primary today-write" href="/admin/clients/${visit.clientId}/write" data-write-client="${visit.clientId}">Write a note</a>
          </li>
        `)}
      </ul>
    </section>
  `;
}

/** The missing-note reminders switch, and turning on notifications on this device. Hidden when there's no Square. */
function remindersCard(on) {
  if (on === null) return "";
  return html`
    <section class="card reminders-card" aria-label="Reminders">
      <form method="post" action="/admin/reminders" class="camp-switches" data-autosubmit>
        <label class="camp-switch">
          <span><span class="camp-switch-label">Remind me about missing notes</span><span class="camp-switch-hint">Every day at 10 am, one notification with every client still missing a note 24 hours after their visit</span></span>
          <input type="checkbox" name="note_reminders" value="on"${on ? html` checked` : ""} role="switch" />
        </label>
        <noscript><button type="submit" class="btn btn-secondary">Save</button></noscript>
      </form>
      <div class="camp-push" data-push>
        <button type="button" class="btn btn-secondary" data-push-button hidden>Turn on notifications on this device</button>
        <div class="camp-muted" data-push-status>Notifications come to each phone, iPad or computer where you turn them on.</div>
      </div>
    </section>
  `;
}

export function clientsPage({ clients, today = null, needsNotes = [], noteReminders = null }) {
  return html`
    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 16px;">
      <div style="flex: 1; min-width: 200px;">
        <h1 class="page-title">Clients</h1>
        <div style="font-size: 13px; color: var(--ink-soft); margin-top: 2px;">${clients.length} client${clients.length === 1 ? "" : "s"} — synced from Square bookings</div>
      </div>
      <input type="search" id="client-search" placeholder="Search clients" aria-label="Search clients" enterkeyhint="search" autocapitalize="none" autocorrect="off" spellcheck="false" style="width: 220px; max-width: 100%;" />
      <button type="button" class="btn btn-primary" id="sync-btn">Sync from Square</button>
    </div>
    <div id="sync-status" style="font-size: 13px; color: var(--ink-soft);"></div>

    <section class="card unsent-card" id="unsent-notes" aria-labelledby="unsent-heading" hidden>
      <div class="section-label" id="unsent-heading">Unsent notes on this iPad</div>
      <ul class="unsent-list" id="unsent-list"></ul>
    </section>

    ${todayCard(today)}
    ${needsNotesCard(needsNotes)}

    <div class="card" style="padding: 0; overflow: hidden;">
      <table class="data">
        <thead>
          <tr><th>Name</th><th>Last note</th></tr>
        </thead>
        <tbody id="client-rows">
          ${clients.map((client) => html`
            <tr class="row-link" data-client-href="/admin/clients/${client.id}" data-name="${client.name.toLowerCase()}">
              <td style="font-weight: 600;">${client.name}</td>
              <td style="color: var(--ink-soft);">${formatDate(client.last_note_date)}</td>
            </tr>
          `)}
          ${clients.length === 0 ? html`
            <tr><td colspan="2" style="color: var(--ink-soft); text-align: center; padding: 32px;">
              No clients yet — a client shows up here once they've had a completed booking in Square. Try "Sync from Square" above.
            </td></tr>
          ` : ""}
        </tbody>
      </table>
    </div>

    ${remindersCard(noteReminders)}
  `;
}
