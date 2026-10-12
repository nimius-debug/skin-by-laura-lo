import { html, toString, raw } from "../html.js";

const ASSET_VERSION = "20261011-admin-v1";

const ADMIN_STYLES = `
:root { --ink:#2A241F; --ink-soft:#6E6358; --line:#E7DCCB; --ground:#FBF6F0; --surface:#FFFFFF;
  --accent:#B8714F; --accent-soft:#F8EFE7; --good:#6B9071; --warn:#D6A24A; --danger:#C1554A; --muted:#9A8E7E; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Work Sans', system-ui, sans-serif; color: var(--ink); background: var(--ground); }
a { color: var(--accent); text-decoration: none; }
a:hover { color: #96583C; }
.admin-shell { display: flex; flex-wrap: wrap; align-content: flex-start; min-height: 100vh; }
.admin-nav { flex: none; width: 220px; min-height: 100vh; box-sizing: border-box; background: var(--ink); padding: 28px 18px; display: flex; flex-direction: column; gap: 4px; }
.admin-nav .brand { font-family: 'Fraunces', serif; font-weight: 600; font-size: 17px; color: var(--ground); padding: 0 14px 22px; }
.admin-nav a { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; font-size: 14px; color: #D9CFC2; }
.admin-nav a.active { background: var(--accent); color: #FFF8F2; font-weight: 600; }
.admin-nav .spacer { flex: 1; }
.logout-btn { all: unset; cursor: pointer; font-family: inherit; font-size: 13px; color: #D9CFC2; padding: 8px 14px; border-radius: 10px; }
.logout-btn:hover { color: #FFF8F2; background: #3A322B; }
.logout-btn:focus-visible { outline: 2px solid var(--accent); }
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
@media (max-width: 760px) {
  .admin-nav { width: 100%; min-height: 0; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px; padding: 10px 12px; }
  .admin-nav .brand { padding: 0 10px 0 4px; font-size: 15px; }
  .admin-nav a { padding: 8px 12px; }
  .admin-nav .spacer { flex: 1; }
  .admin-main { flex-basis: 100%; }
}
@media (max-width: 640px) {
  .admin-main { padding: 24px 16px; }
  .insight th, .insight td { padding: 8px 10px; }
}
`;

const LOGIN_STYLES = `
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; }
.login-card { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 18px; }
.login-brand { font-family: 'Fraunces', serif; font-weight: 600; font-size: 20px; }
.login-form { display: flex; flex-direction: column; gap: 14px; }
.login-form .btn { justify-content: center; }
.login-error { color: var(--danger); font-size: 13.5px; }
`;

function nav(active) {
  const link = (href, label, key) => html`<a href="${href}"${active === key ? raw(' class="active"') : ""}>${label}</a>`;
  return html`
    <div class="admin-nav">
      <div class="brand">Laura — Admin</div>
      ${link("/admin", "Clients", "clients")}
      <div class="spacer"></div>
      <form method="post" action="/admin/logout" style="margin: 0;">
        <button type="submit" class="logout-btn">Log out</button>
      </form>
    </div>
  `;
}

export function loginPage({ error = "", username = "", configured = true } = {}) {
  return toString(html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Log in · Admin</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Work+Sans:wght@400;500;600;700&display=swap" />
<style>${raw(ADMIN_STYLES)}${raw(LOGIN_STYLES)}</style>
</head>
<body>
<main class="login-wrap">
  <div class="card login-card">
    <div class="login-brand">Laura — Admin</div>
    ${configured
      ? html`<form method="post" action="/admin/login" class="login-form">
          <label class="field">Username
            <input type="text" name="username" value="${username}" autocomplete="username" required autofocus />
          </label>
          <label class="field">Password
            <input type="password" name="password" autocomplete="current-password" required />
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
export function adminPage({ title, body, active = "clients" }) {
  return toString(html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${title ? `${title} · Admin` : "Admin"}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Work+Sans:wght@400;500;600;700&display=swap" />
<style>${raw(ADMIN_STYLES)}</style>
</head>
<body>
<div class="admin-shell">
${nav(active)}
<div class="admin-main">${body}</div>
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
