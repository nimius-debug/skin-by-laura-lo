// Reading the answers already sent through Google Forms, from the form's
// "Download responses (.csv)" file. Each question in definitions.js names the
// Google Forms question it came from (`google`, the start of its title), so a
// column is matched to a question by its header. Pure functions; saving and
// matching to clients is in src/admin/forms.js.

/** RFC 4180 CSV: quoted fields may hold commas, quotes ("") and line breaks. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

// Headers are matched loosely: case, spacing, and the "____" Laura used for sign-here lines don't matter.
const normalize = (text) => String(text || "").toLowerCase().replace(/^[\s_]+/, "").replace(/\s+/g, " ").trim();

/** For each question with a `google` title, the column it reads from (exact header first, then one that starts with it). */
export function columnsFor(form, headers) {
  const normalized = headers.map(normalize);
  const columns = {};
  for (const step of form.steps) {
    for (const question of step.questions) {
      if (!question.google) continue;
      const wanted = normalize(question.google);
      let index = normalized.indexOf(wanted);
      if (index === -1) index = normalized.findIndex((header) => header.startsWith(wanted));
      if (index !== -1) columns[question.id] = index;
    }
  }
  return columns;
}

// The old form's Yes options: "Yes", 'Yes, please specify in "other"', 'Yes (Please provide details in "other")'.
const YES_OPTION = /^yes\b(?:,?\s*\(?please (?:specify|provide details) in "?other"?\)?)?[\s,]*/i;
const NO_WORDS = /^(?:no|none|n\/a|na|nope|no\.)$/i;

function toYesNo(cell) {
  const text = cell.trim();
  if (!text) return undefined;
  if (NO_WORDS.test(text)) return { answer: "No" };
  // 'Yes, please specify in "other", latex' -> Yes with details "latex"; a bare "latex" in the Other box -> Yes too.
  const details = YES_OPTION.test(text) ? text.replace(YES_OPTION, "").trim() : text;
  return details ? { answer: "Yes", details } : { answer: "Yes" };
}

// Google joins ticked boxes with ", ", and some options have commas of their own, so known options are found by
// name (longest first) rather than by splitting. Whatever is left is what she typed under Other.
function toChoices(question, cell) {
  let rest = cell;
  const picked = [];
  for (const option of [...question.options].sort((a, b) => b.length - a.length)) {
    if (rest.includes(option)) {
      picked.push(option);
      rest = rest.replace(option, "");
    }
  }
  const other = rest.replace(/^[\s,]+|[\s,]+$/g, "").replace(/\s*,\s*,\s*/g, ", ")
    // The old "Yes, please specify in other" options aren't real choices.
    .replace(/yes,?\s*please specify in "?other"?/i, "").replace(/^[\s,]+|[\s,]+$/g, "");
  const ordered = question.options.filter((option) => picked.includes(option));
  return other ? [...ordered, other] : ordered;
}

/** "5/2/1994" or "1994-05-02" as yyyy-mm-dd, or the text as typed when it isn't a date. */
function toIsoDate(cell) {
  const text = cell.trim();
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return text;
}

function toAnswer(question, cell) {
  const text = String(cell || "").trim();
  switch (question.type) {
    case "choices": return text ? toChoices(question, text) : undefined;
    case "yesno": return toYesNo(text);
    // A ticked statement in the old form was a line she typed her name or initials on.
    case "agree": return text ? true : undefined;
    case "date": return text ? toIsoDate(text) : undefined;
    default: return text || undefined;
  }
}

/** Minutes Tampa time is behind UTC on that day (240 in summer, 300 in winter). */
function easternOffsetMinutes(utcMillis) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
  }).formatToParts(new Date(utcMillis)).map((part) => [part.type, part.value]));
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((utcMillis - asIfUtc) / 60000);
}

/** Google's "10/23/2026 14:05:09" (Tampa time) as UTC "2026-10-23 18:05:09", or null. */
export function googleTimestamp(text) {
  const match = String(text || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, month, day, year, hour, minute, second = "0"] = match.map((part) => part && Number(part));
  const local = Date.UTC(year, month - 1, day, hour, minute, second);
  const utc = local + easternOffsetMinutes(local) * 60000;
  // Correct once more in case the first guess landed on the other side of a clock change.
  const exact = local + easternOffsetMinutes(utc) * 60000;
  return new Date(exact).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Steps shown for an imported response: the ones that apply to her services,
 * plus any other step she answered. The old form showed every section to
 * everyone, so an answer there is still worth keeping.
 */
export function importedView(form, answers) {
  return {
    ...form,
    steps: form.steps.map((step) => (
      step.questions.some((question) => answers[question.id] !== undefined) ? { ...step, showIf: undefined } : step
    )),
  };
}

/**
 * Every response in a Google Forms CSV, read into this form's answers.
 * Returns { rows, missing, error }: rows are { answers, submittedAt, extra },
 * where `extra` keeps the columns no question reads (so nothing she wrote is
 * lost), and `missing` names the questions no column was found for.
 */
export function readGoogleResponses(form, csvText) {
  const table = parseCsv(csvText);
  if (table.length < 2) return { rows: [], missing: [], error: "That file has no responses in it." };
  const [headers, ...data] = table;
  const timestampIndex = headers.findIndex((header) => normalize(header) === "timestamp");
  if (timestampIndex === -1) return { rows: [], missing: [], error: "That doesn't look like a Google Forms responses file: it has no Timestamp column." };

  const columns = columnsFor(form, headers);
  const used = new Set([timestampIndex, ...Object.values(columns)]);
  const questions = form.steps.flatMap((step) => step.questions);
  if (columns.full_name === undefined) {
    return { rows: [], missing: [], error: `None of the columns match the ${form.title}. Check that you picked the right form.` };
  }
  const missing = questions.filter((question) => question.google && columns[question.id] === undefined).map((question) => question.label);

  const rows = data.map((cells) => {
    const answers = {};
    for (const question of questions) {
      if (columns[question.id] === undefined) continue;
      const value = toAnswer(question, cells[columns[question.id]]);
      if (value !== undefined) answers[question.id] = value;
    }
    if (answers.email) answers.email = answers.email.toLowerCase();
    const extra = headers
      .map((header, index) => ({ label: header.replace(/\s+/g, " ").trim(), value: String(cells[index] || "").trim() }))
      .filter((cell, index) => !used.has(index) && cell.value);
    return { answers, submittedAt: googleTimestamp(cells[timestampIndex]), timestampText: String(cells[timestampIndex] || "").trim(), extra };
  }).filter((row) => row.answers.full_name || row.answers.email);

  return { rows, missing, error: "" };
}
