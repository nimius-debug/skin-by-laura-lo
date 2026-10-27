// The sections a consultation note is written in: the Excel sheet's four columns, plus
// "Outside products" (what she uses from other brands or stores, prescriptions included), and the
// headings printed on the iPad's note page. One place that knows where a note's sections live.
// Older notes simply don't have the newer section.

import { SHEET_NOTE_FIELDS } from "./data/sheet-notes.js";

// In the order Laura reads them.
export const NOTE_FIELDS = ["Treatment type", "Notes / remarks", "Purchase history", "Outside products", "Possible treatments"];

/** Products the client uses that don't come from Laura's shop. */
export const OUTSIDE_FIELD = "Outside products";

/** A note's sections by name, or null when it has none (Square and form notes are plain text). */
export function noteFields(note) {
  if (note.source === "square" || note.source === "form") return null;
  if (note.fields_json) {
    try {
      const parsed = JSON.parse(note.fields_json);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // A broken row falls back to its summary below.
    }
    return null;
  }
  return SHEET_NOTE_FIELDS[note.id] || null;
}

/** Only the known sections, in order, trimmed, with empty ones left out. */
export function cleanFields(input) {
  const fields = {};
  for (const name of NOTE_FIELDS) {
    const value = typeof input?.[name] === "string" ? input[name].trim() : "";
    if (value) fields[name] = value.slice(0, 4000);
  }
  return fields;
}

/**
 * The words typed on an iPad or computer note page, as sent with it: [{ page, section, text }],
 * where section is the printed heading the words sit under (null on a continued page). Anything
 * else is dropped, so a bad copy never stops the note being read.
 */
export function cleanTyped(value) {
  let list;
  try {
    list = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && Number.isInteger(item.page) && item.page >= 0 && typeof item.text === "string" && item.text.trim())
    .slice(0, 200)
    .map((item) => ({ page: item.page, section: NOTE_FIELDS.includes(item.section) ? item.section : null, text: item.text.trim().slice(0, 4000) }));
}

/** Typed words as sections, for when they can't be read with the page: a continued page's go under the last heading used. */
export function typedFields(typed) {
  const parts = {};
  let last = "Notes / remarks";
  for (const item of typed) {
    const section = item.section || last;
    last = section;
    (parts[section] ||= []).push(item.text);
  }
  return cleanFields(Object.fromEntries(Object.entries(parts).map(([name, texts]) => [name, texts.join("\n")])));
}

/** The sections as one line each, for prompts and the plain-text copy of a note. */
export function fieldsAsText(fields) {
  return Object.entries(fields)
    .map(([label, value]) => `${label}: ${value.replace(/\s*\n\s*/g, " / ")}`)
    .join(" | ");
}
