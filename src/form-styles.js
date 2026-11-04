// Styles for the client forms (src/pages/forms.js) and the header's Forms
// menu. Served as part of /assets/styles.css, after the main STYLES.

export const FORM_STYLES = `
/* With Forms added, the header has one more item: keep each on one line. */
.site-header nav { gap: clamp(18px, 2.1vw, 31px); }
.site-header nav > a, .nav-menu > summary { white-space: nowrap; }

/* Header: the Forms menu. A <details>, so it opens without JavaScript too. */
.nav-menu { position: relative; }
.nav-menu > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: color .2s ease; }
.nav-menu > summary::-webkit-details-marker { display: none; }
.nav-menu > summary::after { content: ""; width: 6px; height: 6px; border-right: 1px solid currentColor; border-bottom: 1px solid currentColor; transform: translateY(-2px) rotate(45deg); transition: transform .2s ease; }
.nav-menu[open] > summary::after { transform: translateY(1px) rotate(-135deg); }
.nav-menu > summary:hover, .nav-menu.is-current > summary { color: var(--clay); }
.nav-submenu { position: absolute; top: calc(100% + 22px); left: 50%; transform: translateX(-50%); min-width: 250px; padding: 10px; display: flex; flex-direction: column; background: var(--white); border: 1px solid var(--line); box-shadow: 0 24px 50px rgba(27,33,24,.14); z-index: 42; }
.site-header nav .nav-submenu a { padding: 13px 14px; text-transform: none; letter-spacing: 0; font-size: 14px; }
.site-header nav .nav-submenu a:hover { background: var(--paper); }
.nav-submenu .nav-submenu-all { border-top: 1px solid var(--line); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }

/* The form page */
.form-page { max-width: 760px; padding-top: 80px; padding-bottom: 120px; }
.form-hero { margin-bottom: 40px; }
.form-hero h1, .form-thanks h1 { font-size: clamp(42px, 6vw, 64px); line-height: 1.02; margin-bottom: 22px; }
.form-intro { max-width: 600px; font-size: 17px; line-height: 1.7; color: var(--muted); margin-bottom: 0; }
.form-progress { position: sticky; top: 88px; z-index: 5; padding: 16px 0 14px; margin-bottom: 18px; background: var(--paper); }
.form-progress-text { display: flex; gap: 12px; align-items: baseline; margin-bottom: 10px; font-size: 11px; font-weight: 650; letter-spacing: .14em; text-transform: uppercase; color: var(--clay-deep); }
.form-progress-text [data-progress-title] { color: var(--muted); letter-spacing: .06em; }
.form-progress-track { height: 3px; background: var(--line); }
.form-progress-bar { height: 100%; width: 0; background: var(--ink); transition: width .35s ease; }
.form-alert { margin-bottom: 22px; padding: 16px 18px; border-left: 3px solid #a3412f; background: #f5e4dc; color: #6e2a1d; font-size: 15px; }

.client-form { display: flex; flex-direction: column; gap: 22px; }
.form-trap { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.form-step { padding: 36px 34px; background: var(--white); border: 1px solid var(--line); }
.form-step-count { margin: 0 0 10px; font-size: 10px; letter-spacing: .25em; font-weight: 650; text-transform: uppercase; color: var(--clay-deep); }
.form-step-title { margin: 0 0 8px; font-family: var(--font-serif); font-weight: 400; font-size: 32px; letter-spacing: -.03em; outline: none; }
.form-step-intro, .form-step-only { margin: 0 0 6px; color: var(--muted); font-size: 15px; line-height: 1.6; }
.form-step-only { font-size: 13px; font-style: italic; }
.form-js .form-step-only { display: none; }
.form-js .form-step-count { display: none; }
.form-questions { display: flex; flex-direction: column; gap: 30px; margin-top: 26px; }

.form-question { margin: 0; padding: 0; border: 0; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.form-label { padding: 0; font-size: 16px; font-weight: 600; line-height: 1.45; color: var(--ink); }
.form-label-small { font-size: 14px; }
.form-optional { margin-left: 4px; font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: var(--sage); }
.form-hint { margin: -4px 0 0; font-size: 14px; line-height: 1.5; color: var(--muted); }
.form-question input[type="text"], .form-question input[type="email"], .form-question input[type="tel"], .form-question input[type="date"], .form-question textarea {
  width: 100%; min-height: 52px; padding: 13px 15px; border: 1px solid rgba(44,52,36,.32); border-radius: 0; background: var(--paper); color: var(--ink); font-size: 16px; line-height: 1.5; -webkit-appearance: none; appearance: none; }
.form-question textarea { resize: vertical; }
.form-question input:focus, .form-question textarea:focus { outline: none; border-color: var(--ink); box-shadow: 0 0 0 3px rgba(198,164,92,.35); background: var(--white); }
.form-question [aria-invalid="true"], .form-question.has-error .form-option { border-color: #a3412f; }
.form-signature { font-family: var(--font-serif); font-style: italic; font-size: 22px !important; }
.form-error { margin: 0; font-size: 14px; color: #a3412f; font-weight: 600; }

/* Choices as large tap targets */
.form-options { display: grid; grid-template-columns: 1fr; gap: 10px; }
.form-options-row { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
.form-option { position: relative; display: flex; align-items: center; gap: 14px; min-height: 54px; padding: 12px 16px; border: 1px solid rgba(44,52,36,.28); background: var(--paper); cursor: pointer; font-size: 15px; line-height: 1.4; transition: border-color .15s ease, background .15s ease; }
.form-option:hover { border-color: var(--ink); }
.form-option input { flex: none; width: 20px; height: 20px; margin: 0; accent-color: var(--ink); cursor: pointer; }
.form-option:has(input:checked) { border-color: var(--ink); background: var(--panel-stone); box-shadow: inset 0 0 0 1px var(--ink); }
.form-option:has(input:focus-visible) { outline: 2px solid var(--clay-deep); outline-offset: 2px; }
.form-yesno { grid-template-columns: repeat(2, minmax(0, 160px)); }
.form-details { display: flex; flex-direction: column; gap: 8px; padding-left: 16px; border-left: 2px solid var(--brass); }

/* Consent ticks */
.form-agree { gap: 6px; }
.form-check { display: flex; gap: 14px; align-items: flex-start; padding: 14px 16px; border: 1px solid var(--line); background: var(--paper); cursor: pointer; font-size: 15px; line-height: 1.55; }
.form-check input { flex: none; width: 20px; height: 20px; margin: 2px 0 0; accent-color: var(--ink); cursor: pointer; }
.form-check:has(input:checked) { border-color: var(--ink); }
.form-agree.has-error .form-check { border-color: #a3412f; }

.form-nav { display: flex; gap: 12px; justify-content: space-between; flex-wrap: wrap; }
.form-nav [data-next], .form-nav [data-submit] { margin-left: auto; min-width: 200px; }
.form-nav .button[disabled] { opacity: .6; cursor: progress; transform: none; }
.form-privacy { margin: 0; font-size: 13px; color: var(--muted); text-align: center; }

.form-thanks .form-intro { margin-bottom: 36px; }
.form-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.form-list-item { display: flex; flex-direction: column; gap: 10px; padding: 28px 30px; background: var(--white); border: 1px solid var(--line); transition: border-color .2s ease; }
.form-list-item:hover { border-color: var(--ink); }
.form-list-title { font-family: var(--font-serif); font-size: 28px; letter-spacing: -.03em; }
.form-list-desc { color: var(--muted); line-height: 1.6; }
.form-list-item .text-link { align-self: flex-start; margin-top: 6px; }

@media (max-width: 980px) {
  .nav-menu { width: 100%; border-bottom: 1px solid var(--line); }
  .nav-menu > summary { padding: 15px 0; justify-content: space-between; }
  .nav-submenu { position: static; transform: none; min-width: 0; padding: 0 0 10px 14px; background: transparent; border: 0; box-shadow: none; }
  .site-header nav .nav-submenu a { border-bottom: 0; padding: 11px 0; }
  .nav-submenu .nav-submenu-all { border-top: 0; }
}
@media (max-width: 640px) {
  .form-page { padding-top: 48px; padding-bottom: 80px; }
  .form-progress { top: 74px; }
  .form-step { padding: 26px 18px; margin-inline: -4px; }
  .form-step-title { font-size: 27px; }
  .form-nav { position: sticky; bottom: 0; z-index: 5; margin-inline: -15px; padding: 12px 15px calc(12px + env(safe-area-inset-bottom)); background: rgba(241,234,218,.96); border-top: 1px solid var(--line); flex-wrap: nowrap; }
  .form-nav .button { flex: 1; min-width: 0; padding-inline: 14px; }
  .form-nav [data-next], .form-nav [data-submit] { flex: 2; min-width: 0; }
  .form-list-item { padding: 22px 20px; }
}
@media (prefers-reduced-motion: reduce) { .form-progress-bar { transition: none; } }
`;
