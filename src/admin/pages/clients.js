import { html } from "../../html.js";

function formatDate(iso) {
  if (!iso) return "No notes yet";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function clientsPage({ clients }) {
  return html`
    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 16px;">
      <div style="flex: 1; min-width: 200px;">
        <h1 class="page-title">Clients</h1>
        <div style="font-size: 13px; color: var(--ink-soft); margin-top: 2px;">${clients.length} client${clients.length === 1 ? "" : "s"} — synced from Square bookings</div>
      </div>
      <input type="search" id="client-search" placeholder="Search clients" aria-label="Search clients" enterkeyhint="search" autocapitalize="none" autocorrect="off" spellcheck="false" style="width: 220px; max-width: 100%;" />
      <button type="button" class="btn btn-primary" id="sync-btn">Sync from Square</button>
    </div>
    <div id="sync-status" style="font-size: 13px; color: var(--ink-soft);"></div>

    <div class="card" style="padding: 0; overflow: hidden;">
      <table class="data">
        <thead>
          <tr><th>Name</th><th>Last note</th></tr>
        </thead>
        <tbody id="client-rows">
          ${clients.map((client) => html`
            <tr class="row-link" data-client-href="/admin/clients/${client.id}" data-name="${client.name.toLowerCase()}">
              <td style="font-weight: 600;">${client.name}</td>
              <td style="color: var(--ink-soft);">${formatDate(client.last_note_date)}</td>
            </tr>
          `)}
          ${clients.length === 0 ? html`
            <tr><td colspan="2" style="color: var(--ink-soft); text-align: center; padding: 32px;">
              No clients yet — a client shows up here once they've had a completed booking in Square. Try "Sync from Square" above.
            </td></tr>
          ` : ""}
        </tbody>
      </table>
    </div>
  `;
}
