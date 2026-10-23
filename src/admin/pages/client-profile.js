import { html } from "../../html.js";
import { NOTE_FIELDS, noteFields } from "../note-fields.js";
import { productInsightFor, shortGoodFor } from "../../product-insights.js";
import { formatMoney, timeAgo, daysSince } from "../format.js";
import { STEPS, stepInfo } from "../routine-steps.js";


function formatDate(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sourceLabel(note) {
  if (note.source === "form") return "From an intake form";
  if (note.source === "ipad") return "From iPad";
  return note.source === "square" ? "From Square" : "From the Excel sheet";
}

function thumb(item) {
  return item.image
    ? html`<img class="thumb" src="${item.image}" alt="" width="44" height="44" loading="lazy" />`
    : html`<span class="thumb thumb-blank" aria-hidden="true"></span>`;
}

// One product in the routine: its photo, how long ago she bought it (and whether it is probably used up),
// who it suits, what it does, its published ingredient list, and what to keep in mind.
function routineItem(item, now) {
  const insight = productInsightFor(item.name);
  const goodFor = shortGoodFor(item.name);
  const tags = (insight?.tags || []).slice(0, 4);
  const usedUp = item.boughtAt && daysSince(item.boughtAt, now) > stepInfo(item.step).usedUpAfterDays;
  return html`
    <div class="routine-item">
      ${thumb(item)}
      <div class="routine-body">
        <div class="routine-name">${item.name}</div>
        ${item.boughtAt ? html`<div class="history-meta ${usedUp ? "bought-old" : ""}">Bought ${timeAgo(item.boughtAt, now)}${usedUp ? " · probably used up" : ""}</div>` : ""}
        ${goodFor ? html`<div class="routine-what"><strong>Good for:</strong> ${goodFor}</div>` : html`<div class="routine-what">No product details on file yet.</div>`}
        ${tags.length ? html`<div class="tag-row">${tags.map((tag) => html`<span class="tag-chip">${tag}</span>`)}</div>` : ""}
        ${insight?.formula ? html`<details class="routine-ingredients"><summary>Ingredients as published</summary><p>${insight.formula}</p></details>` : ""}
        ${insight?.keepInMind ? html`<div class="routine-keep"><strong>Keep in mind:</strong> ${insight.keepInMind}</div>` : ""}
      </div>
    </div>
  `;
}

// The routine grouped the way it is used: cleanser, toner, treatment, moisturizer, sun protection, masks.
function routineGroups(items, now) {
  // An item with no known step still shows, under "Other".
  const stepOf = (item) => (STEPS.some((step) => step.id === item.step) ? item.step : "other");
  return STEPS
    .map((step) => ({ step, items: items.filter((item) => stepOf(item) === step.id) }))
    .filter((group) => group.items.length)
    .map((group) => html`
      <div class="step-group">
        <div class="step-label">${group.step.label}</div>
        ${group.items.map((item) => routineItem(item, now))}
      </div>
    `);
}

// Collapsible, in case she doesn't want to see it.
function routineCard(routine, now) {
  const count = routine?.items.length || 0;
  return html`
    <details class="card routine-card" open>
      <summary class="routine-summary">
        <span class="section-label">Current routine</span>
        ${count ? html`<span class="routine-count">${count} ${count === 1 ? "product" : "products"}</span>` : ""}
      </summary>
      <div class="routine-content">
        ${routine
          ? html`
            ${routineGroups(routine.items, now)}
            <div class="routine-note">Everything she bought in the 4 months up to her last product order (${formatDate(routine.orderedAt?.slice(0, 10)) || routine.orderedAt}, ${timeAgo(routine.orderedAt, now)}).</div>
            ${routine.stale ? html`<div class="routine-note bought-old">That was a long time ago, so most of this is probably used up. Ask what she uses now.</div>` : ""}
            ${routine.laterVisitAt ? html`<div class="routine-note">Her latest order (${formatDate(routine.laterVisitAt.slice(0, 10))}) had no shop products, only a service.</div>` : ""}
            <a href="${routine.squareOrderUrl}" target="_blank" rel="noopener" style="font-size: 12.5px;">View in Square</a>
          `
          : html`<div style="color: var(--ink-soft); font-size: 13px;">No product orders found in Square yet.</div>`}
      </div>
    </details>
  `;
}

// What she has paid in total, split into products, services and tips.
function spendCard(client, spend, purchases, now) {
  if (purchases?.failed && !spend?.orderCount) {
    return html`<div class="card"><div class="section-label">Spent with you</div><div class="history-meta">Couldn't read her purchases from Square just now. Try again in a moment.</div></div>`;
  }
  if (!spend?.orderCount) return "";
  const updated = purchases?.syncedAt ? `Updated ${timeAgo(purchases.syncedAt, now)}.` : "";
  const offline = purchases?.source === "stored-stale" ? "Square couldn't be reached, so this is a saved copy. " : "";
  return html`
    <div class="card spend-card">
      <div class="section-label">Spent with you</div>
      <div class="spend-total">${formatMoney(spend.totalCents)}</div>
      <div class="history-meta">${spend.orderCount} ${spend.orderCount === 1 ? "order" : "orders"} since ${formatDate(spend.firstOrderAt.slice(0, 10))}</div>
      <div class="spend-rows">
        <div class="spend-row"><span>Products</span><span>${formatMoney(spend.productCents)}</span></div>
        <div class="spend-row"><span>Services</span><span>${formatMoney(spend.serviceCents)}</span></div>
        <div class="spend-row"><span>Tips</span><span>${formatMoney(spend.tipCents)}</span></div>
      </div>
      <div class="history-meta">Includes tax and tips. ${offline}${updated} <a href="/admin/clients/${client.id}?refresh=1">Refresh from Square</a></div>
    </div>
  `;
}

// Everything she has bought, newest first, with how many, what she paid, and when.
function historyItem(item) {
  const last = formatDate(item.lastBought);
  return html`
    <div class="history-item">
      ${thumb(item)}
      <div class="history-body">
        <div class="routine-name">${item.name}</div>
        <div class="history-meta">${item.count > 1 ? `${item.count} bought · ` : ""}${formatMoney(item.spentCents)} · last ${last || "date unknown"}</div>
      </div>
    </div>
  `;
}

function serviceItem(service) {
  return html`
    <div class="history-body">
      <div class="routine-name">${service.name}</div>
      <div class="history-meta">${service.count > 1 ? `${service.count} times · ` : ""}${formatMoney(service.spentCents)} · last ${formatDate(service.lastDate) || "date unknown"}</div>
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
  const fields = noteFields(note);
  if (!fields) return null;
  const present = NOTE_FIELDS.filter((name) => fields[name]);
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
  // Sheet and iPad notes show their four sections, line breaks intact. Square
  // notes show the seller note exactly as Square has it.
  const body = sheetBody(note);
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

      ${note.pdf_key ? html`<div class="note-foot"><a href="/admin/notes/${note.id}/original" target="_blank" rel="noopener">${note.source === "ipad" ? "View handwriting" : "View original"}</a></div>` : ""}
      ${note.source_submission_id ? html`<div class="note-foot"><a href="/admin/forms/submissions/${note.source_submission_id}">See the full form</a></div>` : ""}
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

function savedMeta(saved) {
  const day = formatDate(String(saved.savedAt || "").slice(0, 10));
  const when = day ? `Saved ${day}.` : "Saved.";
  if (saved.current === true) return `${when} Nothing has changed since, so no new AI call is made.`;
  if (saved.current === false) return `${when} Her notes, purchases or flags have changed since. Update to refresh it.`;
  return when;
}

// The AI summary. A saved one shows straight away (free); the button only calls the API when the inputs changed or on Regenerate.
function insightCard(client, saved) {
  const regenerate = saved?.current === false ? "Update summary" : "Regenerate (new AI call)";
  return html`
    <div class="card insight-card" id="insight-card" data-saved="${saved ? JSON.stringify(saved.summary) : ""}">
      <div class="section-label">Insights</div>
      <div id="insight-placeholder" style="${saved ? "display: none;" : ""}">
        <button type="button" class="btn btn-insight" id="summarize-btn" data-client-id="${client.id}">Summarize this client</button>
      </div>
      <div id="insight-result" style="${saved ? "" : "display: none;"}">
        <div class="insight-label">✦ AI summary</div>
        <div id="insight-meta" class="insight-meta">${saved ? savedMeta(saved) : ""}</div>
        <div id="insight-body" class="insight"></div>
        <button type="button" class="btn btn-secondary btn-regenerate" id="regenerate-btn" data-client-id="${client.id}" data-label="${regenerate}">${regenerate}</button>
      </div>
    </div>
  `;
}

export function clientProfilePage({ client, notes, routine, history = [], services = [], spend = null, flags = [], sourceFiles = [], savedSummary = null, purchases = null, formsCard = "", now = Date.now() }) {
  return html`
    <a href="/admin" class="back-link">← All clients</a>

    ${sourceFilesCard(sourceFiles)}

    <div class="profile-head">
      <h1 class="page-title">${client.name}</h1>
      <div class="synced">Synced from Square ✓</div>
      <a href="/admin/clients/${client.id}/write" class="btn btn-primary write-note-btn">Write a note</a>
    </div>

    <div class="two-col">
      <div class="main">
        ${flagsCard(flags)}
        ${insightCard(client, savedSummary)}

        <div class="section-label">Notes</div>
        ${notes.length ? notes.map(noteCard) : html`<div class="card" style="color: var(--ink-soft);">No notes yet for this client.</div>`}
      </div>

      <div class="side">
        ${formsCard}
        ${routineCard(routine, now)}
        ${spendCard(client, spend, purchases, now)}

        <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
          <div class="section-label">Everything she has bought</div>
          ${history.length
            ? history.map(historyItem)
            : html`<div style="color: var(--ink-soft); font-size: 13px;">No product purchases found in Square.</div>`}
          ${services.length ? html`
            <div class="step-label" style="margin-top: 8px;">Services</div>
            ${services.map(serviceItem)}
          ` : ""}
        </div>
      </div>
    </div>
  `;
}
