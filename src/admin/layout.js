import { html, toString, raw } from "../html.js";

const ASSET_VERSION = "20261011-admin-v1";

const ADMIN_STYLES = `
:root { --ink:#2A241F; --ink-soft:#6E6358; --line:#E7DCCB; --ground:#FBF6F0; --surface:#FFFFFF;
  --accent:#B8714F; --accent-soft:#F8EFE7; --good:#6B9071; --warn:#D6A24A; --danger:#C1554A; --muted:#9A8E7E; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Work Sans', system-ui, sans-serif; color: var(--ink); background: var(--ground); }
a { color: var(--accent); text-decoration: none; }
a:hover { color: #96583C; }
.admin-shell { display: flex; flex-wrap: wrap; min-height: 100vh; }
.admin-nav { flex: none; width: 220px; min-height: 100vh; box-sizing: border-box; background: var(--ink); padding: 28px 18px; display: flex; flex-direction: column; gap: 4px; }
.admin-nav .brand { font-family: 'Fraunces', serif; font-weight: 600; font-size: 17px; color: var(--ground); padding: 0 14px 22px; }
.admin-nav a { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; font-size: 14px; color: #D9CFC2; }
.admin-nav a.active { background: var(--accent); color: #FFF8F2; font-weight: 600; }
.admin-nav .spacer { flex: 1; }
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
input[type="text"], input[type="search"], input[type="date"], textarea { font-family: inherit; font-size: 14px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--line); box-sizing: border-box; }
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
`;

function nav(active) {
  const link = (href, label, key) => html`<a href="${href}"${active === key ? raw(' class="active"') : ""}>${label}</a>`;
  return html`
    <div class="admin-nav">
      <div class="brand">Laura — Admin</div>
      ${link("/admin", "Clients", "clients")}
      <div class="spacer"></div>
      <div class="signed-in">Signed in via Cloudflare Access</div>
    </div>
  `;
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
