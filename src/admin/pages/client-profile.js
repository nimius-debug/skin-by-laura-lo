import { html } from "../../html.js";

function formatDate(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function noteCard(note) {
  const dateLabel = formatDate(note.note_date) || "No date detected";
  const sourceLabel = note.source === "square" ? "From Square" : "✎ From Noteful — AI summary";
  return html`
    <div class="card" style="display: flex; flex-direction: column; gap: 10px;" data-note-id="${note.id}">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="font-weight: 600; font-size: 14.5px;">
          ${dateLabel}
          ${!note.note_date ? html`<span class="pill pill-muted" style="margin-left: 8px;">Set date</span>` : ""}
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="note-badge">${sourceLabel}</span>
          ${note.source === "noteful" ? html`<button type="button" class="icon-btn edit-note-btn" aria-label="Edit note" data-note-id="${note.id}">✎</button>` : ""}
        </div>
      </div>

      <p class="note-view" style="margin: 0; font-size: 13.5px; line-height: 1.55; color: #4A4038;">${note.summary}</p>
      <textarea class="note-edit" style="display: none; min-height: 100px;">${note.summary}</textarea>

      ${note.confidence === "low" ? html`
        <div class="flag-warn"><span>⚠</span><span>Some of this was hard to read — check the original before relying on it.</span></div>
      ` : ""}

      <div style="display: flex; align-items: center; gap: 14px; margin-top: 2px;">
        ${note.pdf_key ? html`<a href="/admin/notes/${note.id}/original" target="_blank" rel="noopener">View original</a>` : ""}
        <button type="button" class="save-note-btn" data-note-id="${note.id}" style="display: none; all: unset; cursor: pointer; font-size: 12.5px; font-weight: 600; color: var(--good);">Save</button>
      </div>
    </div>
  `;
}

export function clientProfilePage({ client, notes, routine }) {
  return html`
    <a href="/admin" style="font-size: 13px; color: var(--ink-soft);">← All clients</a>

    <div style="display: flex; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
      <div style="flex: 1; min-width: 240px;">
        <h1 class="page-title" style="font-size: 30px;">${client.name}</h1>
        <div style="font-size: 13px; color: var(--good); font-weight: 600; margin-top: 4px;">Synced from Square ✓</div>
      </div>
    </div>

    <div class="two-col">
      <div class="main">
        <div style="font-size: 12px; font-weight: 600; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .04em;">Notes</div>
        ${notes.length ? notes.map(noteCard) : html`<div class="card" style="color: var(--ink-soft);">No notes yet for this client.</div>`}
      </div>

      <div class="side">
        <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 12px; font-weight: 600; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .04em;">Current routine</div>
          ${routine
            ? html`
              ${routine.items.map((item) => html`<div style="font-size: 13.5px;">${item.name}</div>`)}
              ${routine.items.length === 0 ? html`<div style="color: var(--ink-soft); font-size: 13px;">Most recent order had no matching catalog items.</div>` : ""}
              <div style="height: 1px; background: #F0E8DC; margin: 4px 0;"></div>
              <div style="font-size: 12px; color: var(--muted);">Last ordered ${formatDate(routine.orderedAt?.slice(0, 10)) || routine.orderedAt}</div>
              <a href="${routine.squareOrderUrl}" target="_blank" rel="noopener" style="font-size: 12.5px;">View in Square</a>
            `
            : html`<div style="color: var(--ink-soft); font-size: 13px;">No completed Square orders yet.</div>`}
        </div>

        <div class="card" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 12px; font-weight: 600; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .04em;">Insights</div>
          <div id="insight-placeholder">
            <button type="button" class="btn" id="summarize-btn" data-client-id="${client.id}" style="width: 100%; background: var(--accent-soft); color: #96583C; justify-content: center;">Summarize this client</button>
          </div>
          <div id="insight-result" style="display: none; background: var(--accent-soft); border-radius: 12px; padding: 12px 14px;">
            <div style="font-size: 11px; font-weight: 600; color: #96583C; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 6px;">✦ AI summary</div>
            <p id="insight-text" style="margin: 0; font-size: 13px; line-height: 1.5; color: #4A4038;"></p>
          </div>
        </div>
      </div>
    </div>
  `;
}
