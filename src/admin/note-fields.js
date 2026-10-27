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

/** The sections as one line each, for prompts and the plain-text copy of a note. */
export function fieldsAsText(fields) {
  return Object.entries(fields)
    .map(([label, value]) => `${label}: ${value.replace(/\s*\n\s*/g, " / ")}`)
    .join(" | ");
}
