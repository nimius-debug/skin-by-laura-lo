import { html } from "../../html.js";
import { ROUTINES, routinePath, resolveRoutine, routineShareImage } from "../../routines.js";

/** Every routine on the site with its own link, to text or DM to a client.
 *  The link opens the site with that routine's popout already open. */
export function routinesPage({ products, siteUrl }) {
  return html`
    <div>
      <h1 class="page-title">Routines</h1>
      <div class="camp-sub" style="margin-top: 2px;">Send a client straight to a routine. The link opens the site with that routine already open, and shows its name and photo when pasted in a text.</div>
    </div>
    <div class="forms-grid">
      ${ROUTINES.map((routine) => {
        const resolved = resolveRoutine(routine, products);
        const image = routineShareImage(resolved);
        const link = `${siteUrl}${routinePath(routine.slug)}`;
        return html`
          <div class="card forms-card routine-share-card">
            <div class="routine-share-head">
              ${image ? html`<img src="${image}" alt="" loading="lazy" />` : html`<span class="routine-share-noimg" aria-hidden="true"></span>`}
              <div>
                <div class="forms-card-title">${routine.name}</div>
                <div class="camp-sub">${routine.concern}</div>
              </div>
            </div>
            <div class="forms-link-row">
              <input type="text" readonly value="${link}" aria-label="Link to ${routine.name}" data-copy-source />
              <button type="button" class="btn btn-secondary" data-copy-link="${link}">Copy link</button>
            </div>
            <div class="forms-card-actions">
              <button type="button" class="btn btn-primary" data-share-link="${link}"
                      data-share-title="${routine.name}" data-share-text="${routine.oneLiner}" hidden>Share</button>
              <a class="btn btn-secondary" href="${routinePath(routine.slug)}" target="_blank" rel="noopener">Open on the site</a>
            </div>
          </div>
        `;
      })}
    </div>
  `;
}
