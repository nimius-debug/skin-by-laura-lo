// The guide editor page (/admin/guides/:id) and the guides card on a client's page.
//
// The editor is its own full-screen page rather than an admin card: the A4
// sheets need the room, and printing it to PDF must show nothing but the sheets.

import { html, jsonScript, raw, toString } from "../../html.js";
import { APP_HEAD } from "../pwa.js";
import { FONTS, GOOGLE_FONTS_URL, PAGE_HEIGHT, PAGE_WIDTH, itemsToCheck } from "./model.js";
import { FONT_CSS, SHEET_CSS, guideSheetHtml } from "./render.js";
import { GUIDE_EDITOR_VERSION } from "./editor-client.js";

function formatDate(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const EDITOR_CSS = `
:root { --ink:#2A241F; --ink-soft:#6E6358; --line:#E7DCCB; --ground:#E6DEDA; --surface:#FFFFFF; --accent:#B8714F;
  --mark:#F6E08A; --bad:#C1554A; --good:#6B9071; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--ground); color: var(--ink); font-family: 'Work Sans', system-ui, sans-serif; }
button, select, input { font: inherit; color: inherit; }
.top-bar { position: sticky; top: 0; z-index: 20; background: var(--surface); border-bottom: 1px solid var(--line); }
.top-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 10px max(16px, env(safe-area-inset-left)); }
.top-row .back { color: var(--accent); text-decoration: none; font-size: 14px; white-space: nowrap; }
.top-row h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 18px; margin: 0; flex: 1 1 180px; min-width: 0; }
.status { font-size: 12.5px; color: var(--ink-soft); white-space: nowrap; }
.status[data-tone="bad"] { color: var(--bad); font-weight: 600; }
.tools { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tb { border: 1.5px solid var(--line); background: var(--surface); border-radius: 9px; padding: 7px 11px; font-size: 13.5px; cursor: pointer; min-height: 36px; }
.tb:hover:not(:disabled) { border-color: #D4C4AE; }
.tb:disabled { opacity: .4; cursor: default; }
.tb[aria-pressed="true"] { background: #F3E6DA; border-color: var(--accent); }
.tb.primary { background: var(--accent); color: #FFF8F2; border-color: var(--accent); font-weight: 600; }
.tb.check { background: var(--mark); border-color: #E3C65A; font-weight: 600; }
.tb.danger { color: var(--bad); }
.delete-guide { margin: 0; }
.warn { font-size: 12.5px; color: var(--bad); font-weight: 600; }
.format-bar { position: absolute; left: 0; right: 0; top: 100%; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px max(16px, env(safe-area-inset-left));
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: #FBF7F2; box-shadow: 0 6px 16px rgba(35,31,32,.10); }
.format-bar[hidden] { display: none; }
.format-bar select, .format-bar input { border: 1.5px solid var(--line); border-radius: 9px; padding: 6px 8px; background: var(--surface); min-height: 36px; font-size: 13.5px; }
.format-bar input[type=number] { width: 72px; }
.format-bar select[name=wording] { max-width: 260px; }
.format-bar .sep { width: 1px; align-self: stretch; background: var(--line); margin: 0 4px; }
.format-bar .note { font-size: 12.5px; color: #8A6A10; background: #FFF6D6; padding: 6px 10px; border-radius: 8px; }
.help { font-size: 12px; color: var(--ink-soft); padding: 0 max(16px, env(safe-area-inset-left)) 8px; margin: 0; }
@media (max-width: 700px) { .help { display: none; } .top-row h1 { font-size: 16px; } }
@media (pointer: coarse) { .tb, .format-bar select, .format-bar input { min-height: 44px; } }

.page-stack { --scale: 1; display: flex; flex-direction: column; align-items: center; gap: 22px; padding: 22px 12px 80px; max-width: ${PAGE_WIDTH + 40}px; margin: 0 auto; }
.sheet-frame { display: flex; flex-direction: column; gap: 6px; }
.sheet-tools { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12.5px; color: var(--ink-soft); }
.sheet-tools span { margin-right: auto; font-weight: 600; }
.sheet-tools button { border: 1px solid var(--line); background: var(--surface); border-radius: 7px; padding: 3px 9px; cursor: pointer; font-size: 12px; min-height: 28px; }
.sheet-tools button:disabled { opacity: .35; cursor: default; }
.sheet-tools .danger { color: var(--bad); }
.sheet-box { width: calc(${PAGE_WIDTH}px * var(--scale)); height: calc(${PAGE_HEIGHT}px * var(--scale)); box-shadow: 0 1px 2px rgba(35,31,32,.08), 0 10px 30px rgba(35,31,32,.12); }
.sheet { transform: scale(var(--scale)); transform-origin: 0 0; }
.sheet .el { cursor: default; }
.sheet .el:hover { outline: 1px solid rgba(184,113,79,.45); }
.sheet .el.selected { outline: none; touch-action: none; cursor: move; }
.sheet .el.editing { cursor: text; outline: none; -webkit-user-select: text; user-select: text; }
.sheet .el-text { -webkit-user-select: none; user-select: none; }
.sheet .el.off-page { outline: 2px dashed var(--bad) !important; }
.review .sheet .el[data-origin="check"] { background: var(--mark); box-shadow: 0 0 0 4px var(--mark); }
.selection { position: absolute; pointer-events: none; outline: calc(2px * var(--inv, 1)) solid var(--accent); z-index: 5; }
.handle { position: absolute; width: calc(14px * var(--inv, 1)); height: calc(14px * var(--inv, 1)); background: #fff; border: calc(2px * var(--inv, 1)) solid var(--accent);
  border-radius: 50%; pointer-events: auto; touch-action: none; transform: translate(-50%, -50%); }
.handle-nw { left: 0; top: 0; cursor: nwse-resize; } .handle-ne { left: 100%; top: 0; cursor: nesw-resize; }
.handle-sw { left: 0; top: 100%; cursor: nesw-resize; } .handle-se { left: 100%; top: 100%; cursor: nwse-resize; }
.handle-e { left: 100%; top: 50%; cursor: ew-resize; border-radius: 4px; height: calc(22px * var(--inv, 1)); }
.handle-w { left: 0; top: 50%; cursor: ew-resize; border-radius: 4px; height: calc(22px * var(--inv, 1)); }
.handle-s { left: 50%; top: 100%; cursor: ns-resize; border-radius: 4px; width: calc(22px * var(--inv, 1)); }
@media (pointer: coarse) { .handle { width: calc(22px * var(--inv, 1)); height: calc(22px * var(--inv, 1)); } }
`;

function editorToolbar({ backHref, backLabel, title, checks, deleteUrl }) {
  return html`
  <header class="top-bar no-print">
    <div class="top-row">
      <a class="back" href="${backHref}">← ${backLabel}</a>
      <h1>${title}</h1>
      <span class="status" data-status aria-live="polite">Saved</span>
      <span class="warn" data-off-page hidden></span>
      <div class="tools">
        <button type="button" class="tb" data-action="undo" title="Undo (Ctrl/⌘ Z)" disabled>Undo</button>
        <button type="button" class="tb" data-action="redo" title="Redo (Ctrl/⌘ Shift Z)" disabled>Redo</button>
        <button type="button" class="tb" data-action="add-text">Add text</button>
        <button type="button" class="tb" data-action="review" aria-pressed="true" title="Highlight what still needs a look">Highlight to check</button>
        <button type="button" class="tb check" data-action="next-check" ${checks ? "" : "hidden"}>${checks === 1 ? "1 to check" : `${checks} to check`}</button>
        <button type="button" class="tb primary" data-action="pdf">Save as PDF</button>
        <form method="post" action="${deleteUrl}" class="delete-guide"><button type="submit" class="tb danger">Delete guide</button></form>
      </div>
    </div>
    <div class="format-bar" hidden>
      <select name="font" data-for="text" aria-label="Font">
        ${Object.entries(FONTS).map(([key, font]) => html`<option value="${key}">${font.label}</option>`)}
      </select>
      <button type="button" class="tb" data-action="smaller" data-for="text" aria-label="Smaller text">A−</button>
      <input type="number" name="fontSize" min="4" max="240" step="0.5" data-for="text" aria-label="Text size" />
      <button type="button" class="tb" data-action="bigger" data-for="text" aria-label="Bigger text">A+</button>
      <button type="button" class="tb" data-action="bold" data-for="text" aria-label="Bold"><b>B</b></button>
      <button type="button" class="tb" data-action="italic" data-for="text" aria-label="Italic"><i>I</i></button>
      <button type="button" class="tb" data-action="underline" data-for="text" aria-label="Underline (while typing)"><u>U</u></button>
      <button type="button" class="tb" data-action="uppercase" data-for="text" aria-label="Capitals">Aa</button>
      <span class="sep" data-for="text"></span>
      <button type="button" class="tb" data-align="left" data-for="text">Left</button>
      <button type="button" class="tb" data-align="center" data-for="text">Center</button>
      <button type="button" class="tb" data-align="right" data-for="text">Right</button>
      <button type="button" class="tb" data-align="justify" data-for="text">Justify</button>
      <button type="button" class="tb" data-action="fit" data-for="image">Fill the box</button>
      <select name="wording" data-for="text" hidden aria-label="Other wordings Laura has used"></select>
      <span class="sep" data-for="text image line"></span>
      <button type="button" class="tb" data-action="front" data-for="text image line">To front</button>
      <button type="button" class="tb" data-action="back" data-for="text image line">To back</button>
      <button type="button" class="tb" data-action="duplicate" data-for="text image line">Duplicate</button>
      <button type="button" class="tb danger" data-action="delete" data-for="text image line">Delete</button>
      <button type="button" class="tb check" data-action="looks-good" data-for="text image line" hidden>Looks good</button>
      <span class="note" data-note hidden></span>
    </div>
    <p class="help">Tap a box to select it, drag to move, pull the dots to resize. Tap a selected text box to type. In the print window pick "Save as PDF", paper A4, margins None, and turn on background graphics.</p>
  </header>`;
}

/** The full editor page for one guide. */
export function guideEditorPage({ guide, client, wordings = {} }) {
  const document = guide.document;
  const name = client?.name || document.clientName || "Client";
  const title = `${name.split(/\s+/)[0]}'s Skincare Guide`;
  const checks = itemsToCheck(document).length;
  return toString(html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
${raw(APP_HEAD)}
<meta name="robots" content="noindex, nofollow" />
<title>${title} · Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Work+Sans:wght@400;500;600&display=swap" />
<link rel="stylesheet" href="${GOOGLE_FONTS_URL}" />
<style>${raw(SHEET_CSS)}${raw(EDITOR_CSS)}</style>
</head>
<body>
<div id="guide-editor" class="print-root review" data-save-url="/admin/guides/${guide.id}">
${editorToolbar({ backHref: client ? `/admin/clients/${client.id}` : "/admin", backLabel: client?.name || "Clients", title, checks, deleteUrl: `/admin/guides/${guide.id}/delete` })}
<main class="page-stack">
${raw(document.pages.map((page, index) => `<div class="sheet-frame" data-index="${index}"><div class="sheet-box">${guideSheetHtml(page, index, FONT_CSS)}</div></div>`).join(""))}
</main>
</div>
<script type="application/json" id="guide-data">${jsonScript({ document, version: guide.version, wordings })}</script>
<script src="/admin/assets/guide-editor.js?v=${GUIDE_EDITOR_VERSION}" defer></script>
</body>
</html>`);
}

/** The "Skincare guides" card on a client's page: her guides, and a button to draft a new one. */
export function clientGuidesCard({ client, guides = [], routine = null }) {
  const count = routine?.items?.length || 0;
  return html`
    <div class="card guides-card">
      <div class="section-label">Skincare guides</div>
      ${guides.length
        ? html`<ul class="guide-list" style="list-style: none; margin: 8px 0 12px; padding: 0; display: grid; gap: 6px;">
            ${guides.map((guide) => html`<li><a href="/admin/guides/${guide.id}">Guide from ${formatDate(guide.createdAt.slice(0, 10)) || guide.createdAt.slice(0, 10)}</a>
              <span style="color: var(--muted); font-size: 12px;"> · edited ${formatDate(guide.updatedAt.slice(0, 10)) || guide.updatedAt.slice(0, 10)}</span></li>`)}
          </ul>`
        : html`<div style="color: var(--ink-soft); font-size: 13px; margin: 6px 0 12px;">${count
          ? `Drafts a guide from the ${count} ${count === 1 ? "product" : "products"} in her current routine, in Laura's own words, ready to edit.`
          : "No products in her routine yet, so a new guide starts with the cover and empty routine pages."}</div>`}
      <form method="post" action="/admin/clients/${client.id}/guides">
        <button type="submit" class="btn ${guides.length ? "btn-secondary" : "btn-primary"}">Create guide</button>
      </form>
    </div>
  `;
}
