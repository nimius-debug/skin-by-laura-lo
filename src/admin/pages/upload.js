import { html } from "../../html.js";

export function uploadPage({ client }) {
  const today = new Date().toISOString().slice(0, 10);
  return html`
    <a href="/admin/clients/${client.id}" style="font-size: 13px; color: var(--ink-soft);">← ${client.name}</a>

    <div class="card" style="max-width: 560px; display: flex; flex-direction: column; gap: 18px;" id="upload-card" data-client-id="${client.id}">
      <h1 style="margin: 0; font-family: 'Fraunces', serif; font-weight: 600; font-size: 20px;">Add a note — ${client.name}</h1>

      <div id="upload-step-idle" style="display: flex; flex-direction: column; gap: 14px;">
        <form id="upload-form" enctype="multipart/form-data">
          <label class="dropzone" for="file-input">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#B8714F" stroke-width="1.6"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
            <span style="font-size: 14px; color: #4A4038;">Drop the exported file here, or <strong>choose a file</strong></span>
            <input type="file" id="file-input" name="file" accept="application/pdf,image/*" multiple class="sr-only" />
          </label>
          <div id="chosen-file-name" style="font-size: 12.5px; color: var(--ink-soft);"></div>
          <div style="font-size: 12px; color: var(--muted); line-height: 1.5; margin-top: 10px;">
            From Noteful: export as <strong>PDF</strong> or <strong>Image</strong> — the <strong>Native</strong> format can't be read here.
          </div>
          <label class="field" style="margin-top: 14px;">Note date (used only if we can't read one on the page)
            <input type="date" name="fallback_date" value="${today}" />
          </label>
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px;">
            <a href="/admin/clients/${client.id}" class="btn btn-secondary">Cancel</a>
            <button type="submit" class="btn btn-primary" id="upload-submit-btn">Upload</button>
          </div>
        </form>
      </div>

      <div id="upload-step-processing" style="display: none; flex-direction: column; align-items: center; gap: 14px; padding: 30px 10px;">
        <div class="spinner" aria-hidden="true"></div>
        <div style="font-size: 14px; color: #4A4038;">Reading note — this can take a little while for several pages.</div>
      </div>

      <div id="upload-step-review" style="display: none; flex-direction: column; gap: 16px;"></div>
      <div id="upload-step-error" style="display: none; color: var(--danger); font-size: 13.5px;"></div>
    </div>
  `;
}
