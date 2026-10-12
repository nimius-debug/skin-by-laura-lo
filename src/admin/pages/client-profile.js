import { html } from "../../html.js";
import { SHEET_NOTE_FIELDS } from "../data/sheet-notes.js";
import { productInsightFor, shortGoodFor } from "../../product-insights.js";

// The sheet's own column names, in the order Laura reads them.
const SHEET_FIELDS = ["Treatment type", "Notes / remarks", "Purchase history", "Possible treatments"];

function formatDate(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sourceLabel(note) {
  return note.source === "square" ? "From Square" : "From the Excel sheet";
}

function thumb(item) {
  return item.image
    ? html`<img class="thumb" src="${item.image}" alt="" width="44" height="44" loading="lazy" />`
    : html`<span class="thumb thumb-blank" aria-hidden="true"></span>`;
}

// One product in the routine: its photo, who it suits, what it does, its published ingredient list, and what to keep in mind.
function routineItem(item) {
  const insight = productInsightFor(item.name);
  const goodFor = shortGoodFor(item.name);
  const tags = (insight?.tags || []).slice(0, 4);
  return html`
    <div class="routine-item">
      ${thumb(item)}
      <div class="routine-body">
        <div class="routine-name">${item.name}</div>
        ${goodFor ? html`<div class="routine-what"><strong>Good for:</strong> ${goodFor}</div>` : html`<div class="routine-what">No product details on file yet.</div>`}
        ${tags.length ? html`<div class="tag-row">${tags.map((tag) => html`<span class="tag-chip">${tag}</span>`)}</div>` : ""}
        ${insight?.formula ? html`<details class="routine-ingredients"><summary>Ingredients as published</summary><p>${insight.formula}</p></details>` : ""}
        ${insight?.keepInMind ? html`<div class="routine-keep"><strong>Keep in mind:</strong> ${insight.keepInMind}</div>` : ""}
      </div>
    </div>
  `;
}

// Everything she has bought, newest first, with how many and when.
function historyItem(item) {
  const last = formatDate(item.lastBought);
  return html`
    <div class="history-item">
      ${thumb(item)}
      <div class="history-body">
        <div class="routine-name">${item.name}</div>
        <div class="history-meta">${item.count > 1 ? `${item.count} bought · ` : ""}last ${last || "date unknown"}</div>
      </div>
    </div>
  `;
}

// Allergies and anything else to double-check, found by comparing her notes with what she has bought.
function flagsCard(flags) {
  if (!flags.length) return "";
  return html`
    <div class="card flags-card">
      <div class="section-label">Heads-up</div>
      <div class="flag-list">
        ${flags.map((flag) => html`
          <div class="flag-item flag-level-${flag.level}">
            <span class="flag-icon" aria-hidden="true">${flag.level === "warn" ? "⚠" : "•"}</span>
            <div><strong>${flag.title}.</strong> ${flag.detail}</div>
          </div>
        `)}
      </div>
      <div class="flag-foot">From her notes and what she has bought. A prompt to double-check ingredient lists, not medical advice.</div>
    </div>
  `;
}

function sheetBody(note) {
  const fields = SHEET_NOTE_FIELDS[note.id];
  if (!fields) return null;
  const present = SHEET_FIELDS.filter((name) => fields[name]);
  if (!present.length) return null;
  return html`
    <div class="sheet-fields">
      ${present.map((name) => html`
        <div class="sheet-field">
          <div class="sheet-label">${name}</div>
          <div class="sheet-value">${fields[name]}</div>
        </div>
      `)}
    </div>
  `;
}

function noteCard(note) {
  const dateLabel = formatDate(note.note_date);
  // Noteful notes show the sheet's own cells, line breaks intact. Square notes
  // show the seller note exactly as Square has it.
  const body = note.source === "square" ? null : sheetBody(note);
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

      ${body || html`<p class="note-view">${note.summary}</p>`}

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
              <a href="https://drive.google.com/uc?export=download&amp;id=${file.drive_id}" target="_blank" rel="noopener">Download</a>
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

export function clientProfilePage({ client, notes, routine, history = [], flags = [], sourceFiles = [] }) {
  return html`
    <a href="/admin" class="back-link">← All clients</a>

    ${sourceFilesCard(sourceFiles)}

    <div class="profile-head">
      <h1 class="page-title">${client.name}</h1>
      <div class="synced">Synced from Square ✓</div>
    </div>

    <div class="two-col">
      <div class="main">
        ${flagsCard(flags)}
        ${insightCard(client)}

        <div class="section-label">Notes</div>
        ${notes.length ? notes.map(noteCard) : html`<div class="card" style="color: var(--ink-soft);">No notes yet for this client.</div>`}
      </div>

      <div class="side">
        <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
          <div class="section-label">Current routine</div>
          ${routine
            ? html`
              ${routine.items.map(routineItem)}
              ${routine.items.length === 0 ? html`<div style="color: var(--ink-soft); font-size: 13px;">Most recent order had no matching catalog items.</div>` : ""}
              <div style="height: 1px; background: #F0E8DC; margin: 4px 0;"></div>
              <div style="font-size: 12px; color: var(--muted);">Last ordered ${formatDate(routine.orderedAt?.slice(0, 10)) || routine.orderedAt}</div>
              <a href="${routine.squareOrderUrl}" target="_blank" rel="noopener" style="font-size: 12.5px;">View in Square</a>
            `
            : html`<div style="color: var(--ink-soft); font-size: 13px;">No completed Square orders yet.</div>`}
        </div>

        <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
          <div class="section-label">Everything she has bought</div>
          ${history.length
            ? history.map(historyItem)
            : html`<div style="color: var(--ink-soft); font-size: 13px;">No product purchases found in Square.</div>`}
        </div>
      </div>
    </div>
  `;
}
