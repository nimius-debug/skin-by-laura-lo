// A plain, rule-based check of what a client has bought against what her notes
// say about her skin (allergies, pregnancy, sensitivity, reactions, Accutane).
// It does not use AI, so the page can always show it. It is a prompt to
// double-check an ingredient list, not medical advice, and it only knows the
// ingredient lists we have on file — products without one are reported as
// "not screened" rather than assumed safe.

import { noteFields } from "./note-fields.js";

const NOTES_FIELD = "Notes / remarks";

/** The text of a note worth scanning. For sheet notes that is the Notes / remarks cell only. */
export function noteText(note) {
  if (note.source === "square") return note.summary || "";
  const fields = noteFields(note);
  if (fields) return fields[NOTES_FIELD] || "";
  return note.extracted_text || note.summary || "";
}

const SIGNALS = [
  { id: "allergy", pattern: /allerg/i },
  { id: "pregnancy", pattern: /pregnan/i },
  { id: "sensitive", pattern: /rosacea|eczema|dermatitis|sensitiv|reactive|damaged barrier|compromised barrier|irritated barrier/i },
  // Ordinary peel sensations ("tingle 2/10") are not reactions; only strong ones or an emphasised tingle count.
  { id: "reaction", pattern: /\b(?:reacted|reaction|burn(?:ed|ing|t)|spicy|flare[sd]?|freaked|rash|hives|swell\w*)\b|\b(?:tingl|sting)\w*\s*!+/i },
  { id: "accutane", pattern: /accutane|isotretinoin/i },
];

const TRAITS = {
  fragrance: { label: "fragrance or essential oils", pattern: /parfum|fragrance|essential oil|limonene|linalool|geraniol|citronellol|eugenol|lavandula|lavender|bergamot|citrus|menthol/i },
  acid: { label: "an exfoliating acid", pattern: /mandelic|salicylic|glycolic|lactic acid|azelaic|gluconolactone|\bAHA\b|\bBHA\b/i },
  salicylic: { label: "salicylic acid", pattern: /salicylic|\bBHA\b/i },
  retinoid: { label: "a retinoid", pattern: /retinol|retinal\b|retinoate|tretinoin|adapalene/i },
  daisy: { label: "daisy-family botanicals", pattern: /chamomile|anthemis|calendula|arnica|achillea|echinacea/i },
  mineral: { label: "a mineral sunscreen filter", pattern: /zinc oxide|titanium dioxide/i },
};

// Words in an allergy note that aren't ingredients to look for.
const STOP_WORDS = new Set([
  "allergic", "allergy", "allergies", "physical", "mineral", "sunscreen", "products", "product",
  "skin", "sensitive", "ingredients", "ingredient", "with", "from", "that", "this", "have", "also", "some",
]);

const NEGATION = /\b(?:no|not|never|without|w\/o|nothing)\s+(?:\w+\s+){0,2}$/i;
const BULLET = /^\s*[-•*↳→]/;

function negated(text, index) {
  return NEGATION.test(text.slice(Math.max(0, index - 24), index));
}

/** Note text split into bullet-sized paragraphs, so a handwritten line that wrapped reads as one thought. */
function paragraphs(text) {
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) { out.push(""); continue; }
    if (!out.length || !out[out.length - 1] || BULLET.test(line)) out.push(line.trim());
    else out[out.length - 1] += ` ${line.trim()}`;
  }
  return out.filter(Boolean);
}

function tidy(paragraph) {
  const clean = paragraph.replace(/^[-•*↳→\s]+/, "").replace(/\s+/g, " ").trim();
  return clean.length > 160 ? `${clean.slice(0, 157).replace(/\s+\S*$/, "")}…` : clean;
}

function formatDate(iso) {
  if (!iso) return "undated";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function collectSignals(notes) {
  const hits = Object.fromEntries(SIGNALS.map((signal) => [signal.id, []]));
  for (const note of notes) {
    for (const paragraph of paragraphs(noteText(note))) {
      for (const signal of SIGNALS) {
        const match = signal.pattern.exec(paragraph);
        if (!match || negated(paragraph, match.index)) continue;
        const excerpt = tidy(paragraph);
        if (!hits[signal.id].some((hit) => hit.excerpt === excerpt)) {
          hits[signal.id].push({ date: note.note_date || null, excerpt });
        }
      }
    }
  }
  return hits;
}

function traitsOf(product) {
  const text = `${product.name} ${product.formula}`;
  return Object.keys(TRAITS).filter((id) => TRAITS[id].pattern.test(text));
}

function joinNames(names) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Products that have any of the given traits, as "Name (reason, reason)". */
function withTraits(screened, ids) {
  return screened
    .map((product) => {
      const reasons = ids.filter((id) => product.traits.includes(id)).map((id) => TRAITS[id].label);
      return reasons.length ? `${product.name} (${reasons.join(", ")})` : null;
    })
    .filter(Boolean);
}

const when = (hit) => ` (${formatDate(hit.date)})`;

/**
 * Flags to double-check before recommending or selling anything.
 *   notes:    the client's notes, newest first
 *   products: every product she has bought, as { name, formula } (formula "" when none is on file)
 * Returns [{ level: "warn" | "note", title, detail }], warnings first.
 */
export function findFlags({ notes, products }) {
  const hits = collectSignals(notes);
  const screened = products.filter((product) => product.formula).map((product) => ({ ...product, traits: traitsOf(product) }));
  const unscreened = products.filter((product) => !product.formula).map((product) => product.name);
  const flags = [];

  for (const hit of hits.allergy.slice(0, 3)) {
    const afterAllergy = hit.excerpt.split(/allerg\w*/i).slice(1).join(" ");
    const tokens = afterAllergy.split(/[^a-z]+/i).map((word) => word.toLowerCase()).filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
    const wantsMineral = /physical|mineral|zinc|titanium/i.test(hit.excerpt);

    const matches = screened
      .map((product) => {
        const text = product.formula.toLowerCase();
        const reasons = tokens.filter((token) => text.includes(token)).map((token) => `lists ${token}`);
        if (wantsMineral && product.traits.includes("mineral")) reasons.push("has a mineral sunscreen filter");
        return reasons.length ? `${product.name} (${reasons.join(", ")})` : null;
      })
      .filter(Boolean);

    flags.push({
      level: "warn",
      title: "Allergy noted",
      detail: `“${hit.excerpt}”${when(hit)}. ${matches.length
        ? `In what she has bought: ${joinNames(matches)}.`
        : "Nothing she has bought matches by name; still check the ingredient list before recommending anything new."}`,
    });
  }

  if (hits.pregnancy.length) {
    const hit = hits.pregnancy[0];
    const risky = withTraits(screened, ["retinoid", "salicylic"]);
    flags.push({
      level: "warn",
      title: "Pregnancy noted",
      detail: `“${hit.excerpt}”${when(hit)}. ${risky.length
        ? `Check with her provider about: ${joinNames(risky)}.`
        : "None of her purchased products list a retinoid or salicylic acid; check anything new before recommending it."}`,
    });
  }

  if (hits.sensitive.length) {
    const hit = hits.sensitive[0];
    const irritants = withTraits(screened, ["fragrance", "acid"]);
    flags.push({
      level: "note",
      title: "Sensitive or reactive skin noted",
      detail: `“${hit.excerpt}”${when(hit)}. ${irritants.length
        ? `These could irritate: ${joinNames(irritants)}.`
        : "Nothing she has bought lists fragrance or an exfoliating acid."}`,
    });
  }

  if (hits.accutane.length) {
    const hit = hits.accutane[0];
    const strong = withTraits(screened, ["acid", "retinoid"]);
    flags.push({
      level: "note",
      title: "Past Accutane noted",
      detail: `“${hit.excerpt}”${when(hit)}. Confirm how long ago before peels, waxing or retinoids.${strong.length ? ` She has bought: ${joinNames(strong)}.` : ""}`,
    });
  }

  if (hits.allergy.length || hits.sensitive.length) {
    const daisy = withTraits(screened, ["daisy"]);
    if (daisy.length) {
      flags.push({
        level: "note",
        title: "Daisy-family botanicals",
        detail: `Chamomile, calendula and arnica are in the same plant family as ragweed and can cross-react in allergic or sensitive skin: ${joinNames(daisy)}.`,
      });
    }
  }

  for (const hit of hits.reaction.slice(0, 3)) {
    flags.push({ level: "note", title: "Past reaction", detail: `“${hit.excerpt}”${when(hit)}.` });
  }

  const anySignal = Object.values(hits).some((list) => list.length);
  if (anySignal && unscreened.length) {
    flags.push({
      level: "note",
      title: "Not screened",
      detail: `No ingredient list is on file for ${joinNames(unscreened)}, so ${unscreened.length === 1 ? "it" : "they"} couldn't be checked against her notes.`,
    });
  }

  return flags.sort((a, b) => (a.level === b.level ? 0 : a.level === "warn" ? -1 : 1));
}
