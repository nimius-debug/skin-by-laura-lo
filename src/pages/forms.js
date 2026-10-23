// The client forms on the public site, one step at a time. Without JavaScript
// every step shows on one long page and the form still sends; with it,
// src/client/forms.js turns the steps into a guided flow with a progress bar,
// skips the steps for services she isn't booking, and checks each step before
// moving on. The server checks everything again (src/forms/engine.js).

import { html, raw } from "../html.js";
import { BOOKING_URL } from "../config.js";
import { FORMS } from "../forms/definitions.js";
import { detailsName } from "../forms/engine.js";

const attr = (condition, markup) => (condition ? raw(markup) : "");

function errorFor(question, errors) {
  const message = errors[question.id];
  return html`<p class="form-error" id="${question.id}-error" data-error-for="${question.id}"${attr(!message, " hidden")}>${message || ""}</p>`;
}

function hintFor(question) {
  return question.hint ? html`<p class="form-hint" id="${question.id}-hint">${question.hint}</p>` : "";
}

function describedBy(question) {
  return [question.hint ? `${question.id}-hint` : "", `${question.id}-error`].filter(Boolean).join(" ");
}

const INPUT_TYPES = { text: "text", email: "email", tel: "tel", date: "date", signature: "text" };

function textQuestion(question, value, errors) {
  const common = html`id="${question.id}" name="${question.id}" aria-describedby="${describedBy(question)}"${attr(question.required, " required")}${attr(errors[question.id], ' aria-invalid="true"')}${question.autocomplete ? html` autocomplete="${question.autocomplete}"` : ""}`;
  const field = question.type === "textarea"
    ? html`<textarea ${common} rows="${question.rows || 3}" maxlength="2000">${value || ""}</textarea>`
    : html`<input type="${INPUT_TYPES[question.type]}" ${common} value="${value || ""}" maxlength="200"${attr(question.type === "date", ` max="${new Date().toISOString().slice(0, 10)}"`)}${attr(question.type === "signature", ' class="form-signature" autocomplete="name" spellcheck="false"')}${attr(question.type === "email", ' autocapitalize="none" spellcheck="false" inputmode="email"')} />`;
  return html`
    <div class="form-question" data-question="${question.id}" data-type="${question.type}"${attr(question.required, " data-required")}>
      <label class="form-label" for="${question.id}">${question.label}${question.required ? "" : html` <span class="form-optional">Optional</span>`}</label>
      ${hintFor(question)}
      ${field}
      ${errorFor(question, errors)}
    </div>
  `;
}

function optionTiles(question, picked, kind) {
  return html`<div class="form-options${question.options.length > 3 ? "" : " form-options-row"}">
    ${question.options.map((option, index) => html`
      <label class="form-option">
        <input type="${kind}" name="${question.id}" value="${option}"${attr(picked.includes(option), " checked")}${attr(question.none === option, " data-none")}${attr(kind === "radio" && question.required && index === 0, " required")} />
        <span>${option}</span>
      </label>
    `)}
  </div>`;
}

function choiceQuestion(question, value, errors) {
  const multiple = question.type === "choices";
  const picked = multiple ? value || [] : value ? [value] : [];
  return html`
    <fieldset class="form-question" data-question="${question.id}" data-type="${question.type}"${attr(question.required, " data-required")} aria-describedby="${describedBy(question)}">
      <legend class="form-label">${question.label}${question.required ? "" : html` <span class="form-optional">Optional</span>`}</legend>
      ${hintFor(question)}
      ${optionTiles(question, picked, multiple ? "checkbox" : "radio")}
      ${errorFor(question, errors)}
    </fieldset>
  `;
}

function yesNoQuestion(question, value, errors) {
  const answer = value?.answer || "";
  return html`
    <fieldset class="form-question" data-question="${question.id}" data-type="yesno"${attr(question.required, " data-required")} aria-describedby="${describedBy(question)}">
      <legend class="form-label">${question.label}</legend>
      ${hintFor(question)}
      <div class="form-options form-options-row form-yesno">
        ${["Yes", "No"].map((option, index) => html`
          <label class="form-option">
            <input type="radio" name="${question.id}" value="${option}"${attr(answer === option, " checked")}${attr(question.required && index === 0, " required")} />
            <span>${option}</span>
          </label>
        `)}
      </div>
      ${question.details ? html`
        <div class="form-details" data-details-for="${question.id}">
          <label class="form-label form-label-small" for="${detailsName(question)}">${question.details.label}</label>
          <textarea id="${detailsName(question)}" name="${detailsName(question)}" rows="2" maxlength="2000">${value?.details || ""}</textarea>
        </div>
      ` : ""}
      ${errorFor(question, errors)}
    </fieldset>
  `;
}

function agreeQuestion(question, value, errors) {
  return html`
    <div class="form-question form-agree" data-question="${question.id}" data-type="agree"${attr(question.required, " data-required")}>
      <label class="form-check">
        <input type="checkbox" name="${question.id}" value="yes" aria-describedby="${question.id}-error"${attr(value === true, " checked")}${attr(question.required, " required")} />
        <span>${question.label}</span>
      </label>
      ${errorFor(question, errors)}
    </div>
  `;
}

function question(q, answers, errors) {
  const value = answers[q.id];
  if (q.type === "choices" || q.type === "choice") return choiceQuestion(q, value, errors);
  if (q.type === "yesno") return yesNoQuestion(q, value, errors);
  if (q.type === "agree") return agreeQuestion(q, value, errors);
  return textQuestion(q, value, errors);
}

function step(form, s, index, answers, errors) {
  return html`
    <section class="form-step" id="step-${s.id}" data-step="${s.id}" data-title="${s.title}"${s.showIf ? html` data-show-if="${JSON.stringify(s.showIf)}"` : ""} aria-labelledby="step-${s.id}-title">
      <p class="form-step-count" aria-hidden="true">Step ${index + 1}</p>
      <h2 class="form-step-title" id="step-${s.id}-title" tabindex="-1">${s.title}</h2>
      ${s.showIf ? html`<p class="form-step-only">Only if you're booking: ${s.showIf.anyOf.join(" or ")}</p>` : ""}
      ${s.intro ? html`<p class="form-step-intro">${s.intro}</p>` : ""}
      <div class="form-questions">${s.questions.map((q) => question(q, answers, errors))}</div>
    </section>
  `;
}

/** The form itself. `answers` and `errors` refill it when the server sends it back with a problem. */
export function formPage({ form, answers = {}, errors = {} }) {
  const hasErrors = Object.keys(errors).length > 0;
  return html`
    <div class="form-page section-shell">
      <header class="form-hero">
        <p class="eyebrow">Client forms</p>
        <h1>${form.title}</h1>
        <p class="form-intro">${form.intro}</p>
      </header>

      <div class="form-progress" data-progress hidden>
        <div class="form-progress-text"><span data-progress-count></span><span data-progress-title></span></div>
        <div class="form-progress-track" aria-hidden="true"><div class="form-progress-bar" data-progress-bar></div></div>
      </div>

      ${hasErrors ? html`<div class="form-alert" role="alert" tabindex="-1" data-form-alert>A few answers need another look. They're marked below.</div>` : ""}

      <form class="client-form" method="post" action="/forms/${form.slug}" data-client-form novalidate>
        <div class="form-trap" aria-hidden="true">
          <label>Leave this empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label>
        </div>
        <input type="hidden" name="started" value="" data-started />
        ${form.steps.map((s, index) => step(form, s, index, answers, errors))}
        <div class="form-nav">
          <button type="button" class="button button-light" data-back hidden>Back</button>
          <button type="button" class="button button-dark" data-next hidden>Continue</button>
          <button type="submit" class="button button-dark" data-submit>Send my form</button>
        </div>
        <p class="form-privacy">Your answers go straight to Laura and are kept private. They're never shared or sold.</p>
      </form>
    </div>
    <script src="/assets/forms.js?v=1" defer></script>
  `;
}

export function formThanksPage({ form, firstName = "" }) {
  return html`
    <div class="form-page form-thanks section-shell">
      <p class="eyebrow">${form.title}</p>
      <h1>Thank you${firstName ? `, ${firstName}` : ""}. <em>You're all set.</em></h1>
      <p class="form-intro">Laura has your answers and will go over them before your appointment. If anything changes before then, like a new medication or a reaction, just let her know when you arrive.</p>
      <div class="button-row">
        <a class="button button-dark" href="${BOOKING_URL}">Book an appointment <span aria-hidden="true">&#8599;</span></a>
        <a class="text-link" href="/">Back to the site</a>
      </div>
    </div>
  `;
}

export function formsIndexPage() {
  return html`
    <div class="form-page section-shell">
      <header class="form-hero">
        <p class="eyebrow">Client forms</p>
        <h1>Before your <em>visit.</em></h1>
        <p class="form-intro">Fill out the form for your service before you arrive, so your appointment time goes to your treatment.</p>
      </header>
      <ul class="form-list">
        ${FORMS.map((form) => html`
          <li><a class="form-list-item" href="/forms/${form.slug}">
            <span class="form-list-title">${form.title}</span>
            <span class="form-list-desc">${form.description}</span>
            <span class="text-link">Start <span aria-hidden="true">&#8594;</span></span>
          </a></li>
        `)}
      </ul>
    </div>
  `;
}
