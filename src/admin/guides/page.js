// The guide editor page (/admin/guides/:id), the guides list (/admin/guides)
// and the guides card on a client's page.
//
// The editor is its own full-screen page rather than an admin card: the A4
// sheets need the room, and printing it to PDF must show nothing but the sheets.
// On a computer the formatting bar sits under the top bar; on an iPad or a
// phone it sits at the bottom of the screen, one swipeable row, like Canva's.

import { html, jsonScript, raw, toString } from "../../html.js";
import { APP_HEAD } from "../pwa.js";
import { FONTS, GOOGLE_FONTS_URL, PAGE_HEIGHT, PAGE_WIDTH, itemsToCheck } from "./model.js";
import { FONT_CSS, SHEET_CSS, guideSheetHtml } from "./render.js";
import { GUIDE_EDITOR_VERSION } from "./editor-client.js";

function formatDate(iso) {
  if (!iso) return null;
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const ICON = {
  undo: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  redo: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>',
  center: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg>',
  justify: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>',
  more: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
};

const EDITOR_CSS = `
:root { --ink:#2A241F; --ink-soft:#6E6358; --line:#E7DCCB; --ground:#E6DEDA; --surface:#FFFFFF; --accent:#B8714F;
  --mark:#F6E08A; --bad:#C1554A; --good:#6B9071; --bar-h: 0px; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; touch-action: manipulation; scroll-padding-top: calc(var(--top-h, 90px) + 12px); scroll-padding-bottom: calc(var(--bar-h) + 12px); }
body { margin: 0; background: var(--ground); color: var(--ink); font-family: 'Work Sans', system-ui, sans-serif; }
button, select, input { font: inherit; color: inherit; }
button { -webkit-tap-highlight-color: transparent; }

.top-bar { position: sticky; top: 0; z-index: 20; background: var(--surface); border-bottom: 1px solid var(--line);
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 8px max(14px, env(safe-area-inset-right)) 8px max(14px, env(safe-area-inset-left)); }
.title-row { display: flex; align-items: center; gap: 12px; flex: 1 1 300px; min-width: 0; }
.back { color: var(--accent); text-decoration: none; font-size: 14px; white-space: nowrap; max-width: 40%; overflow: hidden; text-overflow: ellipsis; }
.title-row h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 18px; margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status { font-size: 12.5px; color: var(--ink-soft); white-space: nowrap; margin-left: auto; }
.status[data-tone="bad"] { color: var(--bad); font-weight: 600; white-space: normal; }
.tool-row { display: flex; align-items: center; gap: 6px; flex: 0 1 auto; max-width: 100%; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.tool-row::-webkit-scrollbar { display: none; }
.tool-row .sep, .format-bar .sep { flex: none; width: 1px; align-self: stretch; background: var(--line); margin: 2px 2px; }
.tb { flex: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1.5px solid var(--line); background: var(--surface);
  border-radius: 10px; padding: 6px 11px; font-size: 13.5px; cursor: pointer; min-height: 38px; min-width: 38px; white-space: nowrap; }
.tb:hover:not(:disabled) { border-color: #D4C4AE; }
.tb:disabled { opacity: .35; cursor: default; }
.tb[aria-pressed="true"] { background: #F3E6DA; border-color: var(--accent); }
.tb.primary { background: var(--accent); color: #FFF8F2; border-color: var(--accent); font-weight: 600; }
.tb.check { background: var(--mark); border-color: #E3C65A; font-weight: 600; }
.tb.warn { border-color: var(--bad); color: var(--bad); font-weight: 600; }
.tb.danger { color: var(--bad); }
.tb.icon { padding: 6px 8px; }
.zoom { display: inline-flex; align-items: center; gap: 2px; flex: none; }
.zoom output { min-width: 44px; text-align: center; font-size: 12.5px; color: var(--ink-soft); }
.more { position: relative; flex: none; }
.more summary { list-style: none; }
.more summary::-webkit-details-marker { display: none; }
.more .menu { position: fixed; z-index: 40; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 6px;
  box-shadow: 0 12px 32px rgba(35,31,32,.18); display: grid; min-width: 220px; }
.more .menu button { all: unset; box-sizing: border-box; padding: 11px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; }
.more .menu button:hover, .more .menu button:focus-visible { background: #F6EFE7; }
.more .menu .danger { color: var(--bad); }
.more .menu p { margin: 4px 12px 8px; font-size: 12px; color: var(--ink-soft); max-width: 260px; line-height: 1.4; }
.delete-guide { margin: 0; display: contents; }

.format-bar { position: absolute; left: 0; right: 0; top: 100%; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  padding: 8px max(14px, env(safe-area-inset-right)) 8px max(14px, env(safe-area-inset-left));
  border-bottom: 1px solid var(--line); background: #FBF7F2; box-shadow: 0 6px 16px rgba(35,31,32,.10); }
.format-bar[hidden] { display: none; }
.format-bar select, .format-bar input { flex: none; border: 1.5px solid var(--line); border-radius: 10px; padding: 6px 8px; background: var(--surface); min-height: 38px; font-size: 13.5px; }
.format-bar input[type=number] { width: 64px; }
.format-bar input[type=color] { width: 42px; padding: 3px; }
.format-bar select[name=wording] { max-width: 220px; }
.format-bar .note { flex: none; font-size: 12.5px; color: #7A5C0C; background: #FFF6D6; padding: 6px 10px; border-radius: 8px; max-width: 320px; }
.format-bar .what { flex: none; font-size: 12px; font-weight: 600; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .04em; margin-right: 2px; }

/* iPad and phone: one swipeable row along the bottom of the screen. */
@media screen and (max-width: 900px), screen and (pointer: coarse) {
  .format-bar { position: fixed; top: auto; bottom: var(--keyboard, 0px); flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
    border-top: 1px solid var(--line); border-bottom: 0; box-shadow: 0 -6px 18px rgba(35,31,32,.12); padding-bottom: max(8px, env(safe-area-inset-bottom)); z-index: 30; }
  .format-bar::-webkit-scrollbar { display: none; }
  .format-bar .note { max-width: none; white-space: nowrap; }
  .page-stack { padding-bottom: 120px !important; }
}
@media (max-width: 640px) {
  .top-bar { gap: 6px; }
  .title-row h1 { font-size: 15.5px; }
  .tool-row { flex-basis: 100%; }
  .hide-small { display: none !important; }
}
@media (pointer: coarse) {
  .tb, .format-bar select, .format-bar input { min-height: 44px; min-width: 44px; }
}

.help { font-size: 12px; color: var(--ink-soft); flex-basis: 100%; margin: 0; }
@media (max-width: 900px), (pointer: coarse) { .help { display: none; } }

/* The pages fit the screen width before the script runs (and if it never does); the script then
   sets the exact scale. Frames are centred with auto margins, so a zoomed-in page scrolls to both edges. */
.page-stack { --scale: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 22px; padding: 22px 12px 80px; overflow-x: auto; }
@supports (width: calc(1px * tan(atan2(1px, 1px)))) {
  .page-stack { --scale: min(1, tan(atan2(100vw - 24px, ${PAGE_WIDTH}px))); }
}
.sheet-frame { display: flex; flex-direction: column; gap: 6px; flex: none; margin-inline: auto; }
.boot-note { margin: 12px 12px 0; padding: 12px 14px; border-radius: 12px; background: #FFF6D6; color: #5E4708; font-size: 14px; line-height: 1.4;
  opacity: 0; animation: boot-note-show 0s 6s forwards; }
.boot-note.failed { opacity: 1; animation: none; background: #FBE3DF; color: #7A2D24; }
.ready .boot-note:not(.failed) { display: none; }
@keyframes boot-note-show { to { opacity: 1; } }
.sheet-tools { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12.5px; color: var(--ink-soft); }
.sheet-tools span { margin-right: auto; font-weight: 600; }
.sheet-tools button { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 4px 10px; cursor: pointer; font-size: 12.5px; min-height: 32px; min-width: 32px; }
.sheet-tools button:disabled { opacity: .35; cursor: default; }
.sheet-tools .danger { color: var(--bad); }
@media (pointer: coarse) { .sheet-tools button { min-height: 40px; min-width: 40px; font-size: 13px; } }
.sheet-box { width: calc(${PAGE_WIDTH}px * var(--scale)); height: calc(${PAGE_HEIGHT}px * var(--scale)); box-shadow: 0 1px 2px rgba(35,31,32,.08), 0 10px 30px rgba(35,31,32,.12); }
.sheet { transform: scale(var(--scale)); transform-origin: 0 0; -webkit-touch-callout: none; }
.sheet .el { cursor: default; }
@media (hover: hover) { .sheet .el:hover { outline: 1px solid rgba(184,113,79,.45); } }
.sheet .el.selected { outline: none; touch-action: none; cursor: move; }
.sheet .el.editing { cursor: text; outline: none; -webkit-user-select: text; user-select: text; touch-action: auto; }
.sheet .el-text { -webkit-user-select: none; user-select: none; }
@media screen { .sheet .el.off-page { outline: 2px dashed var(--bad) !important; } }
.review .sheet .el[data-origin="check"] { background: var(--mark); box-shadow: 0 0 0 4px var(--mark); }
.selection { position: absolute; pointer-events: none; outline: calc(2px * var(--inv, 1)) solid var(--accent); z-index: 5; }
.handle { position: absolute; width: calc(14px * var(--inv, 1)); height: calc(14px * var(--inv, 1)); background: #fff; border: calc(2px * var(--inv, 1)) solid var(--accent);
  border-radius: 50%; pointer-events: auto; touch-action: none; transform: translate(-50%, -50%); box-shadow: 0 1px 3px rgba(0,0,0,.25); }
/* A bigger invisible area around each dot, so it's easy to catch with a finger. */
.handle::after { content: ""; position: absolute; inset: calc(-10px * var(--inv, 1)); }
.handle-nw { left: 0; top: 0; cursor: nwse-resize; } .handle-ne { left: 100%; top: 0; cursor: nesw-resize; }
.handle-sw { left: 0; top: 100%; cursor: nesw-resize; } .handle-se { left: 100%; top: 100%; cursor: nwse-resize; }
.handle-e { left: 100%; top: 50%; cursor: ew-resize; border-radius: 6px; height: calc(24px * var(--inv, 1)); width: calc(10px * var(--inv, 1)); }
.handle-w { left: 0; top: 50%; cursor: ew-resize; border-radius: 6px; height: calc(24px * var(--inv, 1)); width: calc(10px * var(--inv, 1)); }
.handle-s { left: 50%; top: 100%; cursor: ns-resize; border-radius: 6px; width: calc(24px * var(--inv, 1)); height: calc(10px * var(--inv, 1)); }
@media (pointer: coarse) {
  .handle { width: calc(24px * var(--inv, 1)); height: calc(24px * var(--inv, 1)); }
  .handle-e, .handle-w { width: calc(14px * var(--inv, 1)); height: calc(34px * var(--inv, 1)); }
  .handle-s { width: calc(34px * var(--inv, 1)); height: calc(14px * var(--inv, 1)); }
}

.picker { border: 0; border-radius: 16px; padding: 0; width: min(560px, calc(100vw - 24px)); max-height: min(720px, calc(100dvh - 40px));
  box-shadow: 0 24px 60px rgba(35,31,32,.3); color: var(--ink); }
.picker::backdrop { background: rgba(42,36,31,.45); }
.picker[open] { display: flex; flex-direction: column; }
.picker header { display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px; }
.picker h2 { font-family: 'Fraunces', serif; font-size: 18px; margin: 0; flex: 1; }
.picker .search { margin: 0 16px 8px; border: 1.5px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 16px; }
.picker .hint { margin: 0 16px 8px; font-size: 12.5px; color: var(--ink-soft); }
.picker ul { list-style: none; margin: 0; padding: 0 8px 12px; overflow-y: auto; flex: 1; }
.picker li button { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 10px; cursor: pointer; }
.picker li button:hover, .picker li button:focus-visible { background: #F6EFE7; }
.picker li button[disabled] { opacity: .45; cursor: default; }
.picker .thumb { width: 48px; height: 48px; flex: none; border-radius: 8px; background: #F3ECE6; object-fit: contain; }
.picker .name { flex: 1; min-width: 0; font-size: 14.5px; }
.picker .badge { font-size: 11.5px; font-weight: 600; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
.picker .badge.lib { background: #EAF1EA; color: #4E7154; }
.picker .badge.new { background: #FFF3CF; color: #7A5C0C; }
.picker .badge.in { background: #EEE; color: #777; }
.picker .empty { padding: 20px; text-align: center; color: var(--ink-soft); font-size: 14px; }

.toast { position: fixed; left: 50%; bottom: calc(24px + var(--bar-h)); transform: translateX(-50%); background: var(--ink); color: #FFF8F2; padding: 10px 16px; border-radius: 12px;
  font-size: 14px; box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 60; max-width: calc(100vw - 32px); }
.toast[hidden] { display: none; }
`;

function editorTopBar({ backHref, backLabel, title, checks, deleteUrl, hasProducts }) {
  const checkLabel = checks === 1 ? "1 to check" : `${checks} to check`;
  return html`
  <header class="top-bar no-print">
    <div class="title-row">
      <a class="back" href="${backHref}">‹ ${backLabel}</a>
      <h1>${title}</h1>
      <span class="status" data-status aria-live="polite">Saved</span>
    </div>
    <div class="tool-row" role="toolbar" aria-label="Guide">
      <button type="button" class="tb icon" data-action="undo" title="Undo (Ctrl/⌘ Z)" aria-label="Undo" disabled>${raw(ICON.undo)}</button>
      <button type="button" class="tb icon" data-action="redo" title="Redo (Ctrl/⌘ Shift Z)" aria-label="Redo" disabled>${raw(ICON.redo)}</button>
      <span class="sep"></span>
      <button type="button" class="tb" data-action="add-text">+ Text</button>
      <button type="button" class="tb" data-action="add-product" ${hasProducts ? "" : "hidden"}>+ Product</button>
      <button type="button" class="tb check" data-action="next-check" title="Go to the next highlighted box" ${checks ? "" : "hidden"}>${checkLabel}</button>
      <button type="button" class="tb warn" data-action="next-off-page" hidden></button>
      <span class="sep hide-small"></span>
      <span class="zoom" role="group" aria-label="Zoom">
        <button type="button" class="tb icon" data-action="zoom-out" aria-label="Zoom out">−</button>
        <output data-zoom>Fit</output>
        <button type="button" class="tb icon" data-action="zoom-in" aria-label="Zoom in">+</button>
      </span>
      <span class="sep"></span>
      <button type="button" class="tb primary" data-action="pdf">Save as PDF</button>
      <details class="more">
        <summary class="tb icon" aria-label="More">${raw(ICON.more)}</summary>
        <div class="menu" role="menu">
          <button type="button" role="menuitem" data-action="review">Hide the yellow highlights</button>
          <button type="button" role="menuitem" data-action="pdf-help">How to save the PDF</button>
          <form method="post" action="${deleteUrl}" class="delete-guide"><button type="submit" role="menuitem" class="danger">Delete this guide</button></form>
        </div>
      </details>
    </div>
    <div class="format-bar" role="toolbar" aria-label="Selected box" hidden>
      <span class="what" data-what></span>
      <span class="note" data-note hidden></span>
      <button type="button" class="tb check" data-action="looks-good" data-for="text image line" hidden>Looks good</button>
      <select name="font" data-for="text" aria-label="Font">
        ${Object.entries(FONTS).map(([key, font]) => html`<option value="${key}">${font.label}</option>`)}
      </select>
      <button type="button" class="tb icon" data-action="smaller" data-for="text" aria-label="Smaller text">A−</button>
      <input type="number" name="fontSize" min="4" max="240" step="0.5" inputmode="decimal" data-for="text" aria-label="Text size" />
      <button type="button" class="tb icon" data-action="bigger" data-for="text" aria-label="Bigger text">A+</button>
      <button type="button" class="tb icon" data-action="bold" data-for="text" aria-label="Bold"><b>B</b></button>
      <button type="button" class="tb icon" data-action="italic" data-for="text" aria-label="Italic"><i>I</i></button>
      <button type="button" class="tb icon" data-action="underline" data-for="text" aria-label="Underline"><u>U</u></button>
      <button type="button" class="tb icon" data-action="uppercase" data-for="text" aria-label="Capitals">Aa</button>
      <input type="color" name="color" data-for="text line" aria-label="Colour" />
      <span class="sep" data-for="text"></span>
      <button type="button" class="tb icon" data-align="left" data-for="text" aria-label="Align left">${raw(ICON.left)}</button>
      <button type="button" class="tb icon" data-align="center" data-for="text" aria-label="Centre">${raw(ICON.center)}</button>
      <button type="button" class="tb icon" data-align="right" data-for="text" aria-label="Align right">${raw(ICON.right)}</button>
      <button type="button" class="tb icon" data-align="justify" data-for="text" aria-label="Justify">${raw(ICON.justify)}</button>
      <button type="button" class="tb" data-action="edit-text" data-for="text">Type</button>
      <button type="button" class="tb" data-action="fit" data-for="image">Fill the box</button>
      <select name="wording" data-for="text" hidden aria-label="Other wordings Laura has used"></select>
      <span class="sep"></span>
      <button type="button" class="tb" data-action="front" data-for="text image line">To front</button>
      <button type="button" class="tb" data-action="back" data-for="text image line">To back</button>
      <button type="button" class="tb" data-action="duplicate" data-for="text image line">Duplicate</button>
      <button type="button" class="tb danger" data-action="delete" data-for="text image line">Delete</button>
      <button type="button" class="tb danger" data-action="remove-product" hidden>Remove product from guide</button>
    </div>
    <p class="help">Click a box to select it, drag to move, pull the dots to resize. Click a selected text box (or press Enter) to type. Arrow keys nudge; hold Shift to move 10.</p>
  </header>`;
}

function productPicker() {
  return html`
  <dialog class="picker no-print" aria-labelledby="picker-title">
    <header>
      <h2 id="picker-title">Add a product</h2>
      <button type="button" class="tb" data-action="close-picker">Done</button>
    </header>
    <input type="search" class="search" placeholder="Search the shop" aria-label="Search products" autocomplete="off" />
    <p class="hint">Adds its description, photo and how-to steps to the right pages, in Laura's words when the library has them.</p>
    <ul data-picker-list></ul>
  </dialog>`;
}

/** The full editor page for one guide. `products` is the shop's list for "+ Product" (see routes.js). */
export function guideEditorPage({ guide, client, wordings = {}, products = [] }) {
  const document = guide.document;
  const name = client?.name || document.clientName || "Guide";
  const title = `${name.split(/\s+/)[0]}’s Skincare Guide`;
  const checks = itemsToCheck(document).length;
  const back = client ? { href: `/admin/clients/${client.id}`, label: client.name } : { href: "/admin/guides", label: "Guides" };
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
${editorTopBar({ backHref: back.href, backLabel: back.label, title, checks, deleteUrl: `/admin/guides/${guide.id}/delete`, hasProducts: products.length > 0 })}
<p class="boot-note no-print" data-boot-note role="status">The editor is still starting. If the pages don't fit your screen or don't respond to taps, reload the page.</p>
<main class="page-stack">
${raw(document.pages.map((page, index) => `<div class="sheet-frame" data-index="${index}"><div class="sheet-box">${guideSheetHtml(page, index, FONT_CSS)}</div></div>`).join(""))}
</main>
${productPicker()}
<div class="toast no-print" role="status" aria-live="polite" hidden></div>
</div>
<script type="application/json" id="guide-data">${jsonScript({ document, version: guide.version, wordings, products })}</script>
<script src="/admin/assets/guide-editor.js?v=${GUIDE_EDITOR_VERSION}" defer></script>
</body>
</html>`);
}

/** /admin/guides: every guide, and a way to start one for someone who isn't a client. */
export function guidesListPage({ guides = [], missingName = false }) {
  return html`
    <h1 class="page-title">Skincare guides</h1>
    <section class="card" style="display: grid; gap: 10px;">
      <div class="section-label">New guide without a client</div>
      <p style="margin: 0; color: var(--ink-soft); font-size: 13.5px;">For a friend, a sample or anyone who isn't in the client list. It starts with the cover and empty routine pages; add products with <b>+ Product</b> in the editor. For a client, open her page and press <b>Create guide</b> to start from what she bought.</p>
      <form method="post" action="/admin/guides" data-busy-form style="display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end;">
        <label class="field" style="flex: 1 1 220px;">Their name
          <input type="text" name="name" maxlength="60" required autocomplete="off" placeholder="First name" ${missingName ? raw('aria-invalid="true" autofocus') : ""} />
        </label>
        <button type="submit" class="btn btn-primary" data-busy-text="Starting…">Start guide</button>
      </form>
      ${missingName ? html`<div class="flag-warn">Type their name first.</div>` : ""}
    </section>
    <section class="card" style="padding: 0;">
      ${guides.length
        ? html`<table class="data">
            <thead><tr><th>For</th><th>Last edited</th></tr></thead>
            <tbody>${guides.map((guide) => html`<tr class="row-link" data-href="/admin/guides/${guide.id}">
              <td><a href="/admin/guides/${guide.id}">${guide.name || "Untitled"}</a>${guide.clientId ? "" : html` <span class="pill pill-muted">not a client</span>`}</td>
              <td>${formatDate(guide.updatedAt) || guide.updatedAt}</td>
            </tr>`)}</tbody>
          </table>`
        : html`<p style="padding: 18px 20px; margin: 0; color: var(--ink-soft);">No guides yet.</p>`}
    </section>
  `;
}

/** The "Skincare guides" card on a client's page: her guides, and a button to draft a new one. */
export function clientGuidesCard({ client, guides = [], routine = null }) {
  const count = routine?.items?.length || 0;
  return html`
    <div class="card guides-card">
      <div class="section-label">Skincare guides</div>
      ${guides.length
        ? html`<ul class="guide-list" style="list-style: none; margin: 8px 0 12px; padding: 0; display: grid; gap: 6px;">
            ${guides.map((guide) => html`<li><a href="/admin/guides/${guide.id}">Guide from ${formatDate(guide.createdAt) || guide.createdAt.slice(0, 10)}</a>
              <span style="color: var(--muted); font-size: 12px;"> · edited ${formatDate(guide.updatedAt) || guide.updatedAt.slice(0, 10)}</span></li>`)}
          </ul>`
        : html`<div style="color: var(--ink-soft); font-size: 13px; margin: 6px 0 12px;">${count
          ? `Drafts a guide from the ${count} ${count === 1 ? "product" : "products"} in her current routine, in Laura's own words, ready to edit.`
          : "No products in her routine yet, so a new guide starts with the cover and empty routine pages. Add products in the editor."}</div>`}
      <form method="post" action="/admin/clients/${client.id}/guides" data-busy-form>
        <button type="submit" class="btn ${guides.length ? "btn-secondary" : "btn-primary"}" data-busy-text="Drafting…">Create guide</button>
      </form>
    </div>
  `;
}
