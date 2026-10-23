import { html, toString, raw } from "../html.js";
import { APP_HEAD, ASSET_VERSION } from "./pwa.js";

const ADMIN_STYLES = `
:root { --ink:#2A241F; --ink-soft:#6E6358; --line:#E7DCCB; --ground:#FBF6F0; --surface:#FFFFFF;
  --accent:#B8714F; --accent-soft:#F8EFE7; --good:#6B9071; --warn:#D6A24A; --danger:#C1554A; --muted:#9A8E7E; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; touch-action: manipulation; }
a, button, summary { -webkit-tap-highlight-color: transparent; }
body { margin: 0; font-family: 'Work Sans', system-ui, sans-serif; color: var(--ink); background: var(--ground); }
a { color: var(--accent); text-decoration: none; }
a:hover { color: #96583C; }
.admin-shell { display: flex; flex-wrap: wrap; align-content: flex-start; min-height: 100vh; }
.admin-nav { flex: none; width: 220px; min-height: 100vh; box-sizing: border-box; background: var(--ink); padding: 28px 18px; display: flex; flex-direction: column; gap: 4px; }
.admin-nav .brand { font-family: 'Fraunces', serif; font-weight: 600; font-size: 17px; color: var(--ground); padding: 0 14px 22px; }
.admin-nav a { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; font-size: 14px; color: #D9CFC2; }
.admin-nav a.active { background: var(--accent); color: #FFF8F2; font-weight: 600; }
.admin-nav .spacer { flex: 1; }
/* Same size, padding and colour as an inactive nav link, so it reads as part of the same list. */
.logout-btn { all: unset; box-sizing: border-box; display: flex; align-items: center; width: 100%; cursor: pointer; font-family: inherit; font-size: 14px; color: #D9CFC2; padding: 10px 14px; border-radius: 10px; }
.logout-btn:hover { color: #FFF8F2; background: #3A322B; }
.logout-btn:focus-visible { outline: 2px solid var(--accent); }
.admin-nav, .btn, .logout-btn, .routine-summary, .nav-back { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.btn:active { transform: scale(.98); opacity: .9; }
.admin-nav a:active, .logout-btn:active { opacity: .7; }
table.data tr.row-link:active { background: #EFE5D8; }
.nav-back { display: none; }
.admin-nav .signed-in { font-size: 11px; color: #8A7E70; padding: 0 14px; line-height: 1.4; }
.admin-main { flex: 999 1 560px; min-width: 0; padding: 36px 44px; display: flex; flex-direction: column; gap: 22px; }
h1.page-title { margin: 0; font-family: 'Fraunces', serif; font-weight: 600; font-size: 28px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; }
.btn { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; padding: 11px 18px; border-radius: 10px; border: none; cursor: pointer; font-family: inherit; }
.btn-primary { background: var(--accent); color: #FFF8F2; }
.btn-secondary { background: transparent; border: 1.5px solid var(--line); color: var(--ink-soft); }
.pill { font-size: 12.5px; font-weight: 600; padding: 4px 10px; border-radius: 999px; }
.pill-accent { background: var(--accent-soft); color: #96583C; }
.pill-muted { color: var(--muted); }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
table.data { width: 100%; border-collapse: collapse; }
table.data th { text-align: left; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; padding: 12px 16px; border-bottom: 1px solid #F0E8DC; }
table.data td { padding: 14px 16px; border-bottom: 1px solid #F0E8DC; font-size: 14px; }
table.data tr:last-child td { border-bottom: none; }
table.data tr.row-link { cursor: pointer; }
table.data tr.row-link:hover { background: #F3ECE2; }
input[type="text"], input[type="password"], input[type="search"], input[type="date"], textarea { font-family: inherit; font-size: 14px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--line); box-sizing: border-box; }
textarea { width: 100%; }
label.field { font-size: 12.5px; font-weight: 600; color: var(--ink-soft); display: block; }
label.field input, label.field textarea { display: block; margin-top: 6px; width: 100%; }
.flag-warn { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; color: var(--warn); margin-top: 4px; }
.note-badge { font-size: 11.5px; color: var(--muted); }
.two-col { display: flex; flex-wrap: wrap; gap: 28px; }
.two-col .main { flex: 2 1 480px; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.two-col .side { flex: 1 1 280px; min-width: 260px; display: flex; flex-direction: column; gap: 16px; }
.dropzone { border: 1.5px dashed #D9CDBA; border-radius: 14px; padding: 36px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
.icon-btn { all: unset; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; color: var(--muted); }
.icon-btn:hover { background: #F3ECE2; }
@keyframes admin-spin { to { transform: rotate(360deg); } }
.spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--line); border-top-color: var(--accent); animation: admin-spin 0.8s linear infinite; }
.entry-card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.back-link { font-size: 13px; color: var(--ink-soft); }
.profile-head { display: flex; flex-direction: column; gap: 4px; }
.profile-head .page-title { font-size: 30px; }
.synced { font-size: 13px; color: var(--good); font-weight: 600; }
.section-label { font-size: 12px; font-weight: 600; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .04em; }
.note-card { display: flex; flex-direction: column; gap: 10px; }
.note-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.note-date { font-weight: 600; font-size: 14.5px; }
.note-undated { color: var(--muted); font-weight: 500; font-style: italic; }
.note-meta { display: flex; align-items: center; gap: 10px; }
.note-view { margin: 0; font-size: 13.5px; line-height: 1.6; color: #4A4038; white-space: pre-wrap; }
.thumb { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; background: #F3ECE2; flex: none; display: block; }
.thumb-blank { border: 1px dashed var(--line); }
.routine-item { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid #F0E8DC; }
.routine-item:first-of-type { padding-top: 4px; }
.routine-item:last-child { border-bottom: none; }
.routine-body, .history-body { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.routine-name { font-size: 13.5px; font-weight: 600; }
.routine-what { font-size: 12.5px; line-height: 1.5; color: #4A4038; }
.routine-what strong, .routine-keep strong { font-weight: 600; color: var(--ink); }
.tag-row { display: flex; flex-wrap: wrap; gap: 6px; }
.tag-chip { font-size: 11px; font-weight: 600; color: #96583C; background: var(--accent-soft); border-radius: 999px; padding: 2px 8px; }
.routine-ingredients summary { font-size: 12px; font-weight: 600; color: #96583C; cursor: pointer; }
.routine-ingredients p { font-size: 12px; line-height: 1.5; color: var(--ink-soft); margin: 6px 0 0; overflow-wrap: anywhere; }
.routine-keep { font-size: 12px; color: var(--muted); line-height: 1.5; }
.history-item { display: flex; gap: 12px; align-items: center; }
.history-meta { font-size: 12px; color: var(--muted); }
.routine-card { padding: 0; }
.routine-summary { display: flex; align-items: center; gap: 12px; cursor: pointer; list-style: none; padding: 18px 20px; }
.routine-summary::-webkit-details-marker { display: none; }
.routine-summary::after { content: "▾"; color: var(--muted); }
.routine-card[open] > .routine-summary::after { content: "▴"; }
.routine-count { font-size: 12px; color: var(--muted); margin-left: auto; }
.routine-content { padding: 0 20px 18px; display: flex; flex-direction: column; gap: 10px; }
.routine-note { font-size: 12px; color: var(--muted); line-height: 1.5; }
.step-group { display: flex; flex-direction: column; }
.step-label { font-size: 11px; font-weight: 700; color: #96583C; text-transform: uppercase; letter-spacing: .05em; }
.bought-old { color: var(--warn); font-weight: 600; }
.spend-card { display: flex; flex-direction: column; gap: 8px; }
.spend-total { font-family: 'Fraunces', serif; font-size: 30px; font-weight: 600; line-height: 1.1; }
.spend-rows { display: flex; flex-direction: column; gap: 4px; font-size: 13px; padding: 6px 0; }
.spend-row { display: flex; justify-content: space-between; gap: 12px; font-variant-numeric: tabular-nums; }
.flags-card { display: flex; flex-direction: column; gap: 12px; border-color: #E8CFA0; background: #FFFBF3; }
.flag-list { display: flex; flex-direction: column; gap: 10px; }
.flag-item { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; line-height: 1.55; color: #4A4038; }
.flag-icon { flex: none; width: 16px; text-align: center; }
.flag-level-warn .flag-icon { color: var(--danger); }
.flag-level-note .flag-icon { color: var(--warn); }
.flag-foot { font-size: 11.5px; color: var(--muted); }
.sheet-fields { display: flex; flex-direction: column; gap: 12px; }
.sheet-field { display: flex; flex-direction: column; gap: 4px; }
.sheet-label { font-size: 11.5px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.sheet-value { font-size: 13.5px; line-height: 1.6; color: #4A4038; white-space: pre-wrap; overflow-wrap: anywhere; }
.note-foot { display: flex; align-items: center; gap: 14px; min-height: 18px; font-size: 13px; }
.save-note-btn { display: none; background: none; border: none; padding: 0; margin: 0; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--good); }
.file-list { display: flex; flex-direction: column; }
.file-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #F0E8DC; }
.file-row:last-child { border-bottom: none; padding-bottom: 0; }
.file-row:first-child { padding-top: 6px; }
.file-name { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; min-width: 0; }
.file-actions { display: flex; gap: 16px; flex: none; font-size: 13px; font-weight: 600; }
.insight-card { display: flex; flex-direction: column; gap: 12px; }
.btn-insight { background: var(--accent-soft); color: #96583C; width: 100%; justify-content: center; }
.insight-meta { font-size: 12px; color: var(--muted); margin: -4px 0 14px; }
.btn-regenerate { margin-top: 16px; font-size: 13px; padding: 8px 14px; }
.insight-label { font-size: 11px; font-weight: 600; color: #96583C; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 12px; }
.insight { display: flex; flex-direction: column; gap: 20px; font-size: 14px; line-height: 1.6; color: #4A4038; }
.insight-overview { margin: 0; }
.insight h3 { margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #96583C; text-transform: uppercase; letter-spacing: .05em; }
.insight .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.insight table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.insight th { text-align: left; font-size: 11.5px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; padding: 10px 14px; background: #FBF7F1; border-bottom: 1px solid var(--line); }
.insight td { padding: 10px 14px; vertical-align: top; border-bottom: 1px solid #F0E8DC; }
.insight tr:last-child td { border-bottom: none; }
.insight td.date { white-space: nowrap; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.insight .products { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.insight .products li { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; }
.insight .products strong { display: block; color: var(--ink); margin-bottom: 2px; }
.insight ul.bullets { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
.insight ul.flags { padding: 12px 14px 12px 32px; background: #FFFBF3; border: 1px solid #E8CFA0; border-radius: 12px; }
.insight ul.checklist { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.insight ul.checklist li { display: flex; gap: 10px; align-items: flex-start; }
.insight ul.checklist li::before { content: ""; flex: none; width: 14px; height: 14px; margin-top: 4px; border: 1.5px solid var(--accent); border-radius: 4px; }
@view-transition { navigation: auto; }
.admin-nav { view-transition-name: admin-nav; }
::view-transition-old(root), ::view-transition-new(root) { animation-duration: .18s; }
@media (prefers-reduced-motion: reduce) { ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; } }
/* Pull to refresh (Home Screen app only; see client.js). */
.ptr { position: fixed; left: 50%; top: calc(env(safe-area-inset-top) + 8px); z-index: 30; width: 36px; height: 36px; margin-left: -18px; border-radius: 50%;
  background: var(--surface); box-shadow: 0 2px 12px rgba(42,36,31,.2); display: flex; align-items: center; justify-content: center;
  opacity: 0; transform: translateY(-48px); pointer-events: none; transition: opacity .15s; }
.ptr-spinner { width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid var(--line); border-top-color: var(--accent); }
.ptr-ready .ptr-spinner { border-color: var(--accent); }
.ptr-loading .ptr-spinner { border-color: var(--line); border-top-color: var(--accent); animation: admin-spin .8s linear infinite; }
/* In the Home Screen app, stop the page bouncing so pull to refresh feels right. */
@media (display-mode: standalone) { html, body { overscroll-behavior-y: none; } }
@media (max-width: 760px) {
  /* iOS zooms the page when a field under 16px is tapped; this keeps the screen steady. */
  input, textarea { font-size: 16px; }
  .admin-nav { position: sticky; top: 0; z-index: 20; width: 100%; min-height: 0; flex-direction: row; flex-wrap: nowrap; align-items: center; gap: 4px;
    padding: calc(env(safe-area-inset-top) + 4px) max(10px, env(safe-area-inset-right)) 4px max(10px, env(safe-area-inset-left));
    background: rgba(42, 36, 31, .9); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); }
  .admin-nav .brand { padding: 0 10px 0 6px; font-size: 17px; }
  .admin-nav a { min-height: 44px; padding: 0 12px; }
  /* The Clients link isn't needed on a phone: the list is the home screen, and client pages have a back button. */
  .admin-nav a:not(.nav-back) { display: none; }
  .admin-nav .nav-back { display: flex; gap: 2px; padding: 0 10px 0 2px; font-size: 17px; color: #FFF8F2; }
  .nav-back-chevron { font-size: 30px; line-height: 1; margin-top: -4px; }
  .admin-nav.has-back .brand { display: none; }
  .logout-btn { width: auto; min-height: 44px; padding: 0 12px; font-size: 15px; }
  .admin-nav .spacer { flex: 1; }
  .admin-main { flex-basis: 100%; gap: 18px;
    padding: 20px max(16px, env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
  .back-link { display: none; }
  .btn { min-height: 44px; }
  .routine-summary { min-height: 52px; }
  table.data td { padding-top: 16px; padding-bottom: 16px; }
}
@media (max-width: 640px) {
  .insight th, .insight td { padding: 8px 10px; }
}
`;

const CAMPAIGN_STYLES = `
.tab-bar { display: none; }
.camp-title-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px 16px; }
.camp-title-row .page-title { text-wrap: balance; }
.camp-sub, .camp-muted { font-size: 13px; color: var(--ink-soft); line-height: 1.5; }
.camp-head { display: flex; flex-direction: column; gap: 10px; }
.camp-steps { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; font-weight: 600; }
.camp-steps li { padding: 5px 10px; border-radius: 999px; background: #EFE5D8; color: var(--ink-soft); }
.camp-steps li.on { background: var(--ink); color: var(--ground); }
.camp-steps li.done { background: #E3EDE4; color: #3F5A44; }
.camp-notice, .camp-error { font-size: 14px; line-height: 1.5; padding: 12px 16px; border-radius: 12px; }
.camp-notice { background: #E3EDE4; color: #2F4A34; }
.camp-error { background: #F6E1DE; color: #8E3A31; }
.camp-setup { border-color: #E8CFA0; background: #FFFBF3; display: flex; flex-direction: column; gap: 8px; }
.camp-setup ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; line-height: 1.5; color: #4A4038; }
.camp-home-grid { display: flex; flex-wrap: wrap; gap: 18px; }
.camp-home-grid > .card { flex: 1 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
.camp-week-count { font-size: 15px; }
.camp-week-count strong { font-family: 'Fraunces', serif; font-size: 30px; font-weight: 600; margin-right: 4px; }
.camp-week-list { display: flex; flex-direction: column; }
.camp-week-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #F0E8DC; color: var(--ink); min-height: 44px; }
.camp-week-item:last-child { border-bottom: none; }
.camp-week-day { font-size: 12.5px; color: var(--ink-soft); flex: none; width: 92px; }
.camp-week-topic { flex: 1; min-width: 0; font-weight: 600; font-size: 14px; }
.pill-review { background: #FBEFD9; color: #7A5418; }
.pill-approved, .pill-sent { background: #E3EDE4; color: #3F5A44; }
.pill-rejected { background: #F6E1DE; color: #8E3A31; }
.pill-sending { background: var(--accent-soft); color: #96583C; }
.pill { flex: none; white-space: nowrap; }
.camp-switches { display: flex; flex-direction: column; margin: 0; }
.camp-switch { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 56px; border-bottom: 1px solid #F0E8DC; cursor: pointer; }
.camp-switch:last-of-type { border-bottom: none; }
.camp-switch > span { display: flex; flex-direction: column; gap: 2px; }
.camp-switch-label { font-size: 14.5px; font-weight: 600; }
.camp-switch-hint { font-size: 12.5px; color: var(--ink-soft); }
.camp-switch input { appearance: none; -webkit-appearance: none; flex: none; width: 51px; height: 31px; margin: 0; border-radius: 999px; background: #D9CFC2; position: relative; cursor: pointer; transition: background .2s; }
.camp-switch input::after { content: ""; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 2px 4px rgba(42,36,31,.25); transition: transform .2s; }
.camp-switch input:checked { background: var(--good); }
.camp-switch input:checked::after { transform: translateX(20px); }
.camp-switch input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.camp-push { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.camp-recent { display: flex; flex-direction: column; gap: 12px; }
.camp-table-wrap { overflow-x: auto; margin: 0 -20px; }
.camp-table-wrap td.num { font-variant-numeric: tabular-nums; }
.camp-nowrap { white-space: nowrap; }
.camp-new-grid { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; }
.camp-write { flex: 2 1 460px; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.camp-checks { flex: 1 1 260px; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
.camp-how { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 13.5px; line-height: 1.55; color: #4A4038; }
.camp-write textarea { font-size: 15px; line-height: 1.55; resize: vertical; }
.camp-record { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.camp-record:has([data-mic][hidden]) { display: none; }
.camp-mic { width: 88px; height: 88px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #FFFFFF; background: var(--accent); box-shadow: 0 8px 24px rgba(42,36,31,.22); }
.camp-mic .stop-icon { display: none; }
.camp-mic.recording { background: var(--danger); animation: camp-pulse 1.4s ease-in-out infinite; }
.camp-mic.recording .mic-icon { display: none; }
.camp-mic.recording .stop-icon { display: block; }
.camp-mic:disabled { opacity: .6; cursor: progress; }
@keyframes camp-pulse { 50% { box-shadow: 0 0 0 10px rgba(193,85,74,.18); } }
@media (prefers-reduced-motion: reduce) { .camp-mic.recording { animation: none; } }
.camp-mic-text { font-size: 15px; font-weight: 600; }
.camp-goals { margin: 0; padding: 0; border: none; display: flex; flex-direction: column; gap: 8px; }
.camp-goals legend { padding: 0 0 8px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
.camp-goal-row { display: flex; flex-wrap: wrap; gap: 8px; }
.camp-goal { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1.5px solid var(--line); font-size: 14px; cursor: pointer; }
.camp-goal:has(input:checked) { background: var(--accent-soft); border-color: transparent; color: #7A4630; font-weight: 600; }
.camp-goal input { accent-color: var(--accent); margin: 0; }
.camp-big-btn { min-height: 48px; font-size: 15px; justify-content: center; }
.camp-drafting { display: flex; align-items: center; gap: 12px; font-size: 14px; color: var(--ink-soft); }
.camp-drafting .spinner { width: 22px; height: 22px; flex: none; }
.camp-tabs { display: none; }
.camp-review { display: grid; grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); gap: 20px; align-items: start; }
.camp-versions { display: flex; flex-direction: column; gap: 10px; }
.camp-version { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); color: var(--ink); }
.camp-version:hover { border-color: #D9CDBA; color: var(--ink); }
.camp-version.selected { border: 1.5px solid var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.camp-version-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.camp-version-name { font-size: 15px; font-weight: 600; }
.camp-version-why { font-size: 13px; line-height: 1.45; color: #4A4038; }
.camp-link-btn { all: unset; cursor: pointer; font-size: 13px; color: var(--danger); padding: 8px 0; }
.camp-detail { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.camp-detail-card { display: flex; flex-direction: column; gap: 14px; }
.camp-detail-head { display: flex; flex-direction: column; gap: 4px; }
.camp-detail-name { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 600; }
.camp-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.camp-actions form { margin: 0; }
.btn-approve { background: #4F6E55; color: #FFFFFF; }
.btn-approved { background: #E3EDE4; color: #3F5A44; }
.camp-actions .btn { white-space: nowrap; }
.btn-reject { color: var(--danger); }
.camp-edit, .camp-redraft { display: flex; flex-direction: column; gap: 12px; margin: 0; }
.camp-edit select { font: inherit; font-size: 15px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
.camp-cost { display: flex; flex-direction: column; gap: 6px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }
.camp-cost p { margin: 0; font-size: 14px; line-height: 1.5; }
.camp-products { margin: 0; padding: 0; border: none; display: flex; flex-direction: column; gap: 10px; }
.camp-products legend { padding: 0 0 8px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
.camp-product-list { display: flex; flex-direction: column; gap: 8px; }
.camp-product-list:empty { display: none; }
.camp-product { display: flex; align-items: center; gap: 10px; min-height: 56px; padding: 8px 12px; border: 1.5px solid var(--line); border-radius: 12px; background: #fff; cursor: pointer; }
.camp-product:has(input:not(:checked)) { opacity: 0.55; }
.camp-product input { accent-color: var(--accent); margin: 0; width: 20px; height: 20px; flex: none; }
.camp-product img, .camp-product-img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; flex: none; background: var(--accent-soft); }
.camp-product-name { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 600; line-height: 1.3; }
.camp-product-price { font-size: 14px; color: var(--ink-soft); white-space: nowrap; }
.camp-products [hidden] { display: none; }
.camp-hints { background: #FFF7E8; border: 1px solid #F0D9A8; border-radius: 12px; padding: 10px 14px; font-size: 13.5px; line-height: 1.5; }
.camp-hints[hidden] { display: none; }
.camp-hints-title { font-weight: 700; margin-bottom: 2px; }
.camp-hints ul { margin: 0; padding-left: 18px; }
.camp-edit input[type="text"] { font-size: 15px; }
.camp-preview { border-radius: 16px; overflow: hidden; border: 1px solid var(--line); background: var(--ground); }
.camp-frame { display: block; width: 100%; height: 1200px; border: 0; background: var(--ground); }
.camp-send-bar { position: sticky; bottom: 0; z-index: 10; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px;
  margin: 0 -44px -36px; padding: 14px 44px calc(14px + env(safe-area-inset-bottom)); background: rgba(251,246,240,.94);
  -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); border-top: 1px solid var(--line); }
.camp-send-text { flex: 1 1 320px; font-size: 13.5px; line-height: 1.5; color: #4A4038; }
.camp-send-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
.camp-inline-form { margin: 0; }
.btn[disabled] { opacity: .5; cursor: not-allowed; }
@media (max-width: 760px) {
  .has-tabs .admin-main { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
  .tab-bar { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 25; justify-content: space-around;
    padding: 6px max(10px, env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
    background: rgba(251,246,240,.92); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); border-top: 1px solid var(--line); }
  .tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 48px; justify-content: center; font-size: 11px; font-weight: 600; color: var(--muted); -webkit-user-select: none; user-select: none; }
  .tab.on { color: var(--accent); }
  .camp-head .back-link { display: none; }
  .camp-head .page-title { font-size: 24px; }
  .camp-head .camp-steps { display: none; }
  .camp-send-more { display: none; }
  .camp-send-text { font-size: 14px; }
  .camp-actions .btn { padding-left: 12px; padding-right: 12px; }
  .camp-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: #EFE5D8; position: sticky; top: calc(env(safe-area-inset-top) + 52px); z-index: 15; }
  .camp-tabs a { flex: 1; min-height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 14px; font-weight: 600; color: var(--ink-soft); }
  .camp-tabs a.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgba(42,36,31,.12); }
  .camp-review { display: block; }
  .camp-review[data-view="list"] .camp-detail, .camp-review[data-view="preview"] .camp-versions { display: none; }
  .camp-preview { margin: 0 calc(-1 * max(16px, env(safe-area-inset-right))) 0 calc(-1 * max(16px, env(safe-area-inset-left))); border-radius: 0; border-left: 0; border-right: 0; }
  .camp-actions .btn, .camp-actions form { flex: 1; }
  .camp-actions form .btn { width: 100%; justify-content: center; }
  .camp-actions > .btn { justify-content: center; }
  .camp-send-bar { margin: 0 calc(-1 * max(16px, env(safe-area-inset-right))) calc(-32px - env(safe-area-inset-bottom)) calc(-1 * max(16px, env(safe-area-inset-left)));
    padding: 12px max(16px, env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
  .camp-send-buttons, .camp-send-buttons form { flex: 1 1 100%; }
  .camp-send-buttons .btn { width: 100%; justify-content: center; }
  .camp-table-wrap { margin: 0 -20px; }
  .camp-big-btn { width: 100%; }
}
`;

const LOGIN_STYLES = `
body.login-body { background: var(--ink); }
.login-wrap { min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  padding: calc(24px + env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left)); }
.login-card { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 18px; padding: 24px 22px; border-radius: 20px; }
.login-brand { font-family: 'Fraunces', serif; font-weight: 600; font-size: 22px; }
.login-form { display: flex; flex-direction: column; gap: 14px; }
.login-form input[type="text"], .login-form input[type="password"] { min-height: 48px; font-size: 16px; }
.login-remember { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 15px; color: var(--ink-soft); }
.login-remember input { width: 22px; height: 22px; margin: 0; accent-color: var(--accent); }
.login-form .btn { justify-content: center; min-height: 50px; font-size: 16px; border-radius: 12px; }
.login-error { color: var(--danger); font-size: 14px; }
`;

const TAB_ICONS = {
  clients: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7"></path><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"></path></svg>',
  campaigns: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"></rect><path d="M3.5 6.5l8.5 6.5 8.5-6.5"></path></svg>',
};

/** The phone's bottom tab bar, on the top-level screens only (pages with a back button don't show it). */
function tabBar(active) {
  const tab = (href, label, key) => html`<a href="${href}" class="tab${active === key ? " on" : ""}"${active === key ? raw(' aria-current="page"') : ""}>${raw(TAB_ICONS[key])}<span>${label}</span></a>`;
  return html`<nav class="tab-bar" aria-label="Sections">${tab("/admin", "Clients", "clients")}${tab("/admin/campaigns", "Email", "campaigns")}</nav>`;
}

function nav(active, back) {
  const link = (href, label, key) => html`<a href="${href}"${active === key ? raw(' class="active"') : ""}>${label}</a>`;
  return html`
    <nav class="admin-nav${back ? " has-back" : ""}" aria-label="Admin">
      ${back ? html`<a class="nav-back" href="${back.href}"><span class="nav-back-chevron" aria-hidden="true">‹</span>${back.label}</a>` : ""}
      <div class="brand">Laura — Admin</div>
      ${link("/admin", "Clients", "clients")}
      ${link("/admin/campaigns", "Email campaigns", "campaigns")}
      <div class="spacer"></div>
      <form method="post" action="/admin/logout" style="margin: 0;">
        <button type="submit" class="logout-btn">Log out</button>
      </form>
    </nav>
  `;
}

export function loginPage({ error = "", username = "", configured = true, remember = true } = {}) {
  return toString(html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
${raw(APP_HEAD)}
<meta name="robots" content="noindex, nofollow" />
<title>Log in · Admin</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Work+Sans:wght@400;500;600;700&display=swap" />
<style>${raw(ADMIN_STYLES)}${raw(LOGIN_STYLES)}</style>
</head>
<body class="login-body">
<main class="login-wrap">
  <div class="card login-card">
    <div class="login-brand">Laura — Admin</div>
    ${configured
      ? html`<form method="post" action="/admin/login" class="login-form">
          <label class="field">Username
            <input type="text" name="username" value="${username}" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required />
          </label>
          <label class="field">Password
            <input type="password" name="password" autocomplete="current-password" enterkeyhint="go" required />
          </label>
          <label class="login-remember">
            <input type="checkbox" name="remember" value="on"${remember ? raw(" checked") : ""} />
            Keep me signed in on this device
          </label>
          ${error ? html`<div class="login-error" role="alert">${error}</div>` : ""}
          <button type="submit" class="btn btn-primary">Log in</button>
        </form>`
      : html`<p class="login-error">Admin login isn't set up yet. Add the ADMIN_USERNAME and ADMIN_PASSWORD secrets, then redeploy.</p>`}
  </div>
</main>
</body>
</html>`);
}

/** Admin page shell. Deliberately separate from the storefront's page() — different audience, no cart/header/footer. */
export function adminPage({ title, body, active = "clients", back = null }) {
  return toString(html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
${raw(APP_HEAD)}
<meta name="robots" content="noindex, nofollow" />
<title>${title ? `${title} · Admin` : "Admin"}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Work+Sans:wght@400;500;600;700&display=swap" />
<style>${raw(ADMIN_STYLES)}${raw(CAMPAIGN_STYLES)}</style>
</head>
<body>
<div class="admin-shell${back ? "" : " has-tabs"}">
${nav(active, back)}
<div class="admin-main">${body}</div>
${back ? "" : tabBar(active)}
</div>
<script src="/admin/assets/admin.js?v=${ASSET_VERSION}" defer></script>
</body>
</html>`);
}

export function adminHtmlResponse(markup, { status = 200 } = {}) {
  return new Response(markup, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
