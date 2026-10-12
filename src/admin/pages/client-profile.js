import { html } from "../../html.js";

function formatDate(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sourceLabel(note) {
  return note.source === "square" ? "From Square" : "From the Excel sheet";
}

function noteCard(note) {
  const dateLabel = formatDate(note.note_date);
  // Square notes are the seller note exactly as Square has it. Noteful notes
  // show the transcription of the Noteful export (extracted_text), not the
  // short summary line, so what Laura wrote is what she sees.
  const body = note.source === "square" ? note.summary : note.extracted_text || note.summary;
  return html`
    <div class="card note-card" data-note-id="${note.id}">
      <div class="note-head">
        ${dateLabel
          ? html`<div class="note-date">${dateLabel}</div>`
          : html`<div class="note-date note-undated">Undated</div>`}
        <div class="note-meta">
          <span class="note-badge">${sourceLabel(note)}</span>
        </div>
      </div>

      <p class="note-view">${body}</p>

      ${note.confidence === "low" ? html`<div class="flag-warn"><span>⚠</span><span>Hard to read — check the original</span></div>` : ""}

      ${note.pdf_key ? html`<div class="note-foot"><a href="/admin/notes/${note.id}/original" target="_blank" rel="noopener">View original</a></div>` : ""}
    </div>
  `;
}

function sourceFilesCard(files) {
  if (!files.length) return "";
  return html`
    <div class="card">
      <div class="section-label">Original files</div>
      <div class="file-list">
        ${files.map((file) => html`
          <div class="file-row">
            <span class="file-name">${file.file_name}</span>
            <span class="file-actions">
              <a href="https://drive.google.com/file/d/${file.drive_id}/view" target="_blank" rel="noopener">View</a>
              <a href="https://drive.google.com/uc?export=download&amp;id=${file.drive_id}" rel="noopener">Download</a>
            </span>
          </div>
        `)}
      </div>
    </div>
  `;
}

function insightCard(client) {
  return html`
    <div class="card insight-card">
      <div class="section-label">Insights</div>
      <div id="insight-placeholder">
        <button type="button" class="btn btn-insight" id="summarize-btn" data-client-id="${client.id}">Summarize this client</button>
      </div>
      <div id="insight-result" style="display: none;">
        <div class="insight-label">✦ AI summary</div>
        <div id="insight-body" class="insight"></div>
      </div>
    </div>
  `;
}

export function clientProfilePage({ client, notes, routine, sourceFiles = [] }) {
  return html`
    <a href="/admin" class="back-link">← All clients</a>

    <div class="profile-head">
      <h1 class="page-title">${client.name}</h1>
      <div class="synced">Synced from Square ✓</div>
    </div>

    <div class="two-col">
      <div class="main">
        ${sourceFilesCard(sourceFiles)}
        ${insightCard(client)}

        <div class="section-label">Notes</div>
        ${notes.length ? notes.map(noteCard) : html`<div class="card" style="color: var(--ink-soft);">No notes yet for this client.</div>`}
      </div>

      <div class="side">
        <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
          <div class="section-label">Current routine</div>
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
      </div>
    </div>
  `;
}
