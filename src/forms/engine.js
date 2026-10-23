// Reading, checking and describing a form's answers, from its definition in
// definitions.js. Pure functions: the public page, the submission route and
// the admin all use these, so a form is checked and shown the same way
// everywhere.

const MAX_TEXT = 2000;
const MAX_SHORT = 200;

const SHORT_TYPES = new Set(["text", "email", "tel", "date", "signature"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Field name for the "tell me more" box under a yes/no question. */
export const detailsName = (question) => `${question.id}__details`;

/** True when a step should be shown for these answers. */
export function stepVisible(step, answers) {
  if (!step.showIf) return true;
  const picked = answers[step.showIf.question];
  const list = Array.isArray(picked) ? picked : picked ? [picked] : [];
  return step.showIf.anyOf.some((option) => list.includes(option));
}

export function visibleSteps(form, answers) {
  return form.steps.filter((step) => stepVisible(step, answers));
}

function clean(value, max) {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, max) : "";
}

/** One question's answer from the posted form, kept to what the question allows. */
function readAnswer(question, data) {
  const get = (name) => (typeof data.get === "function" ? data.get(name) : data[name]);
  const getAll = (name) => {
    if (typeof data.getAll === "function") return data.getAll(name);
    const value = data[name];
    return Array.isArray(value) ? value : value === undefined ? [] : [value];
  };

  switch (question.type) {
    case "choices": {
      const picked = [...new Set(getAll(question.id).map(String))].filter((option) => question.options.includes(option));
      // "None of the above" alongside a real pick is a slip; the real picks win.
      if (question.none && picked.length > 1) return picked.filter((option) => option !== question.none);
      return picked;
    }
    case "choice": {
      const value = String(get(question.id) ?? "");
      return question.options.includes(value) ? value : "";
    }
    case "yesno": {
      const value = String(get(question.id) ?? "");
      if (value !== "Yes" && value !== "No") return null;
      const details = value === "Yes" && question.details ? clean(get(detailsName(question)), MAX_TEXT) : "";
      return details ? { answer: value, details } : { answer: value };
    }
    case "agree":
      return ["on", "yes", "true"].includes(String(get(question.id) ?? "").toLowerCase());
    default:
      return clean(get(question.id), SHORT_TYPES.has(question.type) ? MAX_SHORT : MAX_TEXT);
  }
}

function isEmpty(question, value) {
  if (question.type === "choices") return value.length === 0;
  if (question.type === "yesno") return value === null;
  if (question.type === "agree") return value !== true;
  return !value;
}

function problemWith(question, value) {
  if (question.required && isEmpty(question, value)) {
    if (question.type === "agree") return "Please tick this to continue.";
    if (question.type === "choices" || question.type === "choice" || question.type === "yesno") return "Please pick an answer.";
    if (question.type === "signature") return "Please type your full name to sign.";
    return "Please fill this in.";
  }
  if (question.type === "email" && value && !EMAIL.test(value)) return "That email doesn't look right.";
  if (question.type === "date" && value) {
    if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(value))) return "Please use a real date.";
    if (value > new Date().toISOString().slice(0, 10) || value < "1900-01-01") return "Please check this date.";
  }
  return "";
}

/**
 * The answers from a posted form (FormData or a plain object), checked against
 * its definition. Answers to steps that don't apply are dropped, so a hidden
 * step can neither block a submission nor leave stray answers behind.
 * Returns { answers, errors } where errors maps question id to a message.
 */
export function readSubmission(form, data) {
  const answers = {};
  const errors = {};
  for (const step of form.steps) {
    for (const question of step.questions) answers[question.id] = readAnswer(question, data);
  }
  for (const step of form.steps) {
    if (!stepVisible(step, answers)) {
      for (const question of step.questions) delete answers[question.id];
      continue;
    }
    for (const question of step.questions) {
      const problem = problemWith(question, answers[question.id]);
      if (problem) errors[question.id] = problem;
    }
  }
  return { answers, errors };
}

/** The contact details a submission is matched to a client by. */
export function contactOf(answers) {
  return {
    name: answers.full_name || "",
    email: (answers.email || "").toLowerCase(),
    phone: answers.phone || "",
  };
}

/** An answer as plain words for the admin, or "" when it was left blank. */
export function answerText(question, value) {
  if (value === undefined || value === null) return "";
  switch (question.type) {
    case "choices": return value.join(", ");
    case "yesno": return value.details ? `${value.answer}: ${value.details}` : value.answer;
    case "agree": return value ? "Agreed" : "Not ticked";
    default: return value;
  }
}

/**
 * What the admin shows for a submission: each step that applied, with its
 * questions and answers. Saved with the submission, so it still reads the same
 * after the form's wording changes.
 */
export function describeSubmission(form, answers) {
  return visibleSteps(form, answers).map((step) => ({
    title: step.title,
    rows: step.questions.map((question) => ({
      id: question.id,
      label: question.label,
      value: answerText(question, answers[question.id]),
    })),
  }));
}

/** One question's line in the client's notes, or "" when it says nothing worth noting. */
function noteLine(question, value) {
  const note = question.note;
  if (!note || value === undefined || value === null) return "";
  if (question.type === "yesno") {
    if (value.answer === "No") return note.no || "";
    return value.details ? `${note.yes}: ${value.details}` : note.yes;
  }
  if (question.type === "choices") {
    if (!value.length) return "";
    if (question.none && value.includes(question.none)) return note.none || "";
    return `${note.label}: ${value.join(", ")}`;
  }
  return value ? `${note.label}: ${value}` : "";
}

/**
 * The submission as a client note: one "- " line per answer that matters for
 * her care. This is what the AI insight, the safety check and the email
 * matching read, so it carries the health answers and leaves out contact
 * details and consent wording.
 */
export function noteFromSubmission(form, answers) {
  const lines = visibleSteps(form, answers)
    .flatMap((step) => step.questions.map((question) => noteLine(question, answers[question.id])))
    .filter(Boolean);
  return [`${form.title}:`, ...lines.map((line) => `- ${line}`)].join("\n");
}
