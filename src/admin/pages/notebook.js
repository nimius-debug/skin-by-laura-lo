// The iPad writing screen: one client's new note, written with Apple Pencil on a page with the
// four sheet sections printed on it, then checked and saved to the dashboard. Full screen, with
// no admin menu, so the page gets the whole iPad. The drawing and saving live in notebook-client.js.

import { html, toString, raw } from "../../html.js";
import { APP_HEAD } from "../pwa.js";
import { NOTE_FIELDS } from "../note-fields.js";
import { NOTEBOOK_VERSION } from "../notebook-client.js";

const INKS = [
  { color: "#2B3A55", name: "Navy" },
  { color: "#1E1A17", name: "Black" },
  { color: "#B8714F", name: "Clay" },
  { color: "#B4382E", name: "Red" },
];

const icon = (path) => raw(`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`);

const ICONS = {
  back: '<path d="m15 18-6-6 6-6"/>',
  pen: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  highlighter: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  eraser: '<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 19"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  finger: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  page: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 9v6M9 12h6"/>',
};

export const NOTEBOOK_STYLES = `
:root { --ink:#2A241F; --ink-soft:#6E6358; --line:#E7DCCB; --ground:#FBF6F0; --desk:#E9E1D6; --accent:#B8714F; --accent-ink:#8E5236; --good:#B9D3BC; --warn:#F2C48A; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; height: 100%; }
body { font-family: 'Work Sans', system-ui, sans-serif; color: var(--ink); background: var(--desk); -webkit-text-size-adjust: 100%; overscroll-behavior: none; }
button { font: inherit; color: inherit; }
.nb { height: 100%; display: flex; flex-direction: column; }
.nb-top { flex-shrink: 0; background: var(--ink); color: var(--ground); display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 12px;
  padding: calc(8px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 8px calc(16px + env(safe-area-inset-left)); min-height: 64px; }
.nb-back { display: inline-flex; align-items: center; gap: 4px; color: var(--ground); text-decoration: none; font-size: 16px; min-height: 44px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.nb-title { text-align: center; display: flex; flex-direction: column; }
.nb-title strong { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 17px; }
.nb-title span { font-size: 12px; color: #B5A898; }
.nb-actions { display: flex; align-items: center; justify-content: flex-end; gap: 14px; min-width: 0; }
.nb-status { font-size: 13px; color: #D9CFC2; text-align: right; }
.nb-status[data-tone="good"] { color: var(--good); }
.nb-status[data-tone="warn"] { color: var(--warn); }
.nb-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 20px; border-radius: 12px; border: 0; font-weight: 600; font-size: 16px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.nb-btn:active { opacity: .85; }
.nb-btn-primary { background: var(--accent); color: #FFF8F2; }
.nb-btn-quiet { background: #FFFFFF; color: var(--ink); border: 1px solid var(--line); }
.nb-btn:disabled { opacity: .6; cursor: default; }
.nb-tools { position: sticky; top: 0; z-index: 3; align-self: center; margin: 12px auto 0; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 2px;
  background: #FFFFFF; border: 1px solid var(--line); border-radius: 16px; padding: 6px 8px; box-shadow: 0 6px 20px rgba(42,36,31,.12); max-width: calc(100% - 24px); }
.nb-tool { width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 10px; background: transparent; color: #4A4038; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.nb-tool[aria-pressed="true"] { background: #F8EFE7; color: var(--accent-ink); }
.nb-tool:disabled { opacity: .35; }
.nb-swatch { width: 24px; height: 24px; border-radius: 50%; display: block; }
.nb-tool[aria-pressed="true"] .nb-swatch { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px currentColor; }
.nb-sep { width: 1px; height: 28px; background: var(--line); margin: 0 6px; }
.nb-scroll { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; }
.nb-pages { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 18px 16px 24px; }
.nb-page canvas { display: block; border-radius: 4px; box-shadow: 0 2px 14px rgba(42,36,31,.12); touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.nb-foot { display: flex; justify-content: center; padding: 0 16px calc(120px + env(safe-area-inset-bottom)); }
.nb-banner { margin: 12px auto 0; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: center; background: #FFFFFF; border: 1px solid var(--line); border-radius: 12px; padding: 8px 8px 8px 16px; font-size: 14px; max-width: calc(100% - 24px); }
.nb-last { position: fixed; right: calc(16px + env(safe-area-inset-right)); bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 4; width: min(280px, calc(100% - 32px));
  background: #FFFFFF; border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 6px 20px rgba(42,36,31,.12); }
.nb-last-toggle { all: unset; box-sizing: border-box; width: 100%; min-height: 44px; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px;
  font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-soft); cursor: pointer; }
.nb-last-body { padding: 0 16px 14px; font-size: 13.5px; line-height: 1.45; white-space: pre-line; max-height: 40vh; overflow-y: auto; }
.nb-overlay { position: fixed; inset: 0; z-index: 10; }
.nb-overlay[hidden] { display: none; }
.nb-busy { background: rgba(42,36,31,.55); display: flex; align-items: center; justify-content: center; }
.nb-busy-card { background: #FFFFFF; border-radius: 16px; padding: 28px 32px; display: flex; flex-direction: column; align-items: center; gap: 14px; font-size: 15px; }
.nb-spinner { width: 30px; height: 30px; border-radius: 50%; border: 3px solid var(--line); border-top-color: var(--accent); animation: nb-spin .8s linear infinite; }
@keyframes nb-spin { to { transform: rotate(360deg); } }
.nb-review { background: var(--ground); display: flex; flex-direction: column; }
.nb-review-body { flex: 1; min-height: 0; display: flex; gap: 28px; padding: 24px calc(28px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(28px + env(safe-area-inset-left)); overflow: auto; }
.nb-preview { width: 38%; max-width: 420px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.nb-preview img { width: 100%; border-radius: 8px; box-shadow: 0 2px 12px rgba(42,36,31,.12); background: #FFFDF8; }
.nb-form { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.nb-form h1 { margin: 0; font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 26px; }
.nb-form p { margin: 0; font-size: 14px; color: var(--ink-soft); }
.nb-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-soft); }
.nb-field textarea, .nb-field input { font: 400 16px/1.45 'Work Sans', system-ui, sans-serif; letter-spacing: 0; text-transform: none; color: var(--ink); background: #FFFFFF; border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; resize: vertical; }
.nb-field input { max-width: 220px; min-height: 44px; }
.nb-unclear { margin: 0; padding: 10px 14px 10px 32px; background: #FBEDE0; color: #7A4A12; border-radius: 10px; font-size: 14px; line-height: 1.45; }
.nb-review-actions { display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
.nb-review-error { color: #A8392F; font-size: 14px; min-height: 1em; }
@media (max-width: 760px) {
  .nb-review-body { flex-direction: column; }
  .nb-preview { width: 100%; max-width: none; flex-direction: row; overflow-x: auto; }
  .nb-preview img { width: 60%; flex-shrink: 0; }
  .nb-status { display: none; }
}
`;

function lastVisitBody(lastNote) {
  if (!lastNote) return "";
  return html`
    <aside class="nb-last" aria-label="Last visit">
      <button type="button" class="nb-last-toggle" id="nb-last-toggle" aria-expanded="true" aria-controls="nb-last-body">
        <span>Last visit</span><span>${lastNote.dateLabel}</span>
      </button>
      <div class="nb-last-body" id="nb-last-body">${lastNote.text}</div>
    </aside>
  `;
}

/**
 * The whole page. lastNote is { dateLabel, text } from her latest note, shown in a corner while
 * writing, or null when she has none.
 */
export function notebookPage({ client, lastNote = null }) {
  return toString(html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
${raw(APP_HEAD)}
<meta name="robots" content="noindex, nofollow" />
<title>New note · ${client.name} · Admin</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Work+Sans:wght@400;500;600&display=swap" />
<style>${raw(NOTEBOOK_STYLES)}</style>
</head>
<body>
<div class="nb" id="notebook" data-client-id="${client.id}" data-client-name="${client.name}">
  <header class="nb-top">
    <a class="nb-back" href="/admin/clients/${client.id}">${icon(ICONS.back)}${client.name}</a>
    <div class="nb-title"><strong>New note</strong><span>Write with Apple Pencil</span></div>
    <div class="nb-actions">
      <span class="nb-status" id="nb-status" role="status" aria-live="polite"></span>
      <button type="button" class="nb-btn nb-btn-primary" id="nb-done">Done</button>
    </div>
  </header>

  <main class="nb-scroll" id="nb-scroll">
    <div class="nb-tools" role="toolbar" aria-label="Pencil tools">
      <button type="button" class="nb-tool" data-tool="pen" aria-pressed="true" aria-label="Pen">${icon(ICONS.pen)}</button>
      <button type="button" class="nb-tool" data-tool="highlighter" aria-pressed="false" aria-label="Highlighter">${icon(ICONS.highlighter)}</button>
      <button type="button" class="nb-tool" data-tool="eraser" aria-pressed="false" aria-label="Eraser">${icon(ICONS.eraser)}</button>
      <span class="nb-sep" aria-hidden="true"></span>
      ${INKS.map((ink, index) => html`<button type="button" class="nb-tool" data-color="${ink.color}" aria-pressed="${index === 0 ? "true" : "false"}" aria-label="Ink: ${ink.name}" style="color: ${ink.color}"><span class="nb-swatch" style="background: ${ink.color}"></span></button>`)}
      <span class="nb-sep" aria-hidden="true"></span>
      <button type="button" class="nb-tool" id="nb-undo" aria-label="Undo" disabled>${icon(ICONS.undo)}</button>
      <button type="button" class="nb-tool" id="nb-redo" aria-label="Redo" disabled>${icon(ICONS.redo)}</button>
      <button type="button" class="nb-tool" id="nb-finger" aria-pressed="false" aria-label="Draw with finger">${icon(ICONS.finger)}</button>
    </div>

    <div class="nb-banner" id="nb-restored" hidden>
      <span>Picked up your unsent note from <span id="nb-restored-when"></span>.</span>
      <button type="button" class="nb-btn nb-btn-quiet" id="nb-start-over">Start over</button>
    </div>

    <div class="nb-pages" id="nb-pages"></div>
    <div class="nb-foot">
      <button type="button" class="nb-btn nb-btn-quiet" id="nb-add-page">${icon(ICONS.page)}Add page</button>
    </div>
  </main>

  ${lastVisitBody(lastNote)}

  <div class="nb-overlay nb-busy" id="nb-busy" hidden>
    <div class="nb-busy-card" role="status"><div class="nb-spinner" aria-hidden="true"></div>Reading your handwriting…</div>
  </div>

  <div class="nb-overlay nb-review" id="nb-review" hidden role="dialog" aria-modal="true" aria-labelledby="nb-review-title">
    <header class="nb-top">
      <button type="button" class="nb-back" id="nb-keep-writing-top" style="background: none; border: 0; cursor: pointer;">${icon(ICONS.back)}Keep writing</button>
      <div class="nb-title"><strong>Check before saving</strong><span>${client.name}</span></div>
      <div class="nb-actions"><button type="button" class="nb-btn nb-btn-primary" id="nb-save-top" data-save>Save to dashboard</button></div>
    </header>
    <div class="nb-review-body">
      <div class="nb-preview" id="nb-preview" aria-label="Your handwriting"></div>
      <div class="nb-form">
        <h1 id="nb-review-title">${client.name}</h1>
        <p>Read from your handwriting. Fix any word, then save. Your handwriting is kept with the note.</p>
        <ul class="nb-unclear" id="nb-unclear" hidden></ul>
        <label class="nb-field">Date<input type="date" id="nb-date" /></label>
        ${NOTE_FIELDS.map((name) => html`<label class="nb-field">${name}<textarea rows="3" data-field="${name}"></textarea></label>`)}
        <div class="nb-review-error" id="nb-review-error" role="alert"></div>
        <div class="nb-review-actions">
          <button type="button" class="nb-btn nb-btn-quiet" id="nb-keep-writing">Keep writing</button>
          <button type="button" class="nb-btn nb-btn-primary" id="nb-save" data-save>Save to dashboard</button>
        </div>
      </div>
    </div>
  </div>
</div>
<script src="/admin/assets/notebook.js?v=${NOTEBOOK_VERSION}" defer></script>
</body>
</html>`);
}
