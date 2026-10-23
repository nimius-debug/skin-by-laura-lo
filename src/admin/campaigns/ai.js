// The AI writing for email campaigns: the shared email, the personal versions,
// redrafts with Laura's feedback, and topic ideas for the reminder.
//
// Every call asks for JSON that matches a schema (structured outputs), so a
// reply is always well formed, and runs at low effort: these are short writing
// jobs, and thinking counts against the response limit. Same model setting as
// the client summaries (ANTHROPIC_MODEL, else the default below). Laura's voice
// guide (voice.js) is the system prompt for every call.

import { LAURA_EMAIL_VOICE } from "./voice.js";

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5-5";
// Response limits. The cost estimate uses them for its worst case.
export const SHARED_MAX_TOKENS = 6000;
export const PERSONAL_MAX_TOKENS = 12000;
// Models that accept Anthropic's server-side fallback when a request is declined.
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

export function campaignModel(env) {
  return env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

/** One request that returns parsed JSON matching `schema`. Adds token counts to `usage`. */
async function askForJson(env, { prompt, schema, maxTokens = 8000, usage }) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
  const model = campaignModel(env);
  const useFallback = FALLBACK_MODELS.has(model);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
      ...(useFallback ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(useFallback ? { fallbacks: "default" } : {}),
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system: LAURA_EMAIL_VOICE,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Claude request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const payload = await response.json();
  if (usage) {
    usage.calls = (usage.calls || 0) + 1;
    usage.inputTokens = (usage.inputTokens || 0) + (payload.usage?.input_tokens || 0);
    usage.outputTokens = (usage.outputTokens || 0) + (payload.usage?.output_tokens || 0);
    usage.model = model;
  }
  if (payload.stop_reason === "refusal") throw new Error("The AI declined to write this. Try rewording the topic.");
  if (payload.stop_reason === "max_tokens") throw new Error("The draft ran out of room before it finished. Try again.");
  const text = (payload.content || []).find((block) => block.type === "text")?.text || "";
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The AI's reply couldn't be read. Try again.");
  }
}

const strings = { type: "array", items: { type: "string" } };
const object = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

const SHARED_SCHEMA = object({
  subject: { type: "string" },
  preheader: { type: "string" },
  eyebrow: { type: "string" },
  headline: { type: "string" },
  paragraphs: strings,
  tipsTitle: { type: "string" },
  tips: strings,
  skipProducts: { type: "boolean" },
  products: { type: "array", items: object({ name: { type: "string" }, note: { type: "string" } }) },
  matchTerms: strings,
});

const GOALS = {
  book: "Invite clients to book a facial.",
  shop: "Point clients to products in the shop.",
  news: "Just share the news. No sales push.",
};

/** The prompt for the shared email. Also measured by the cost estimate. */
export function sharedEmailPrompt({ topic, goal, productNames = [], previous = null, feedback = "" }) {
  return `Laura wants to send this week's email to all her clients. Here is what she wants to talk about, in her own words (typed or spoken):
<topic>
${topic}
</topic>

Goal: ${GOALS[goal] || GOALS.book}

Products in her shop (exact names):
${productNames.slice(0, 80).map((name) => `- ${name}`).join("\n") || "- (none listed)"}
${previous ? `\nYour last draft:\n${JSON.stringify(previous)}\n\nLaura's feedback, which you must follow:\n${feedback}\n` : ""}
Write the email as JSON:
- subject: under 50 characters, casual and inviting, like Laura texting. One ✨ is fine. No clickbait.
- preheader: one short line shown after the subject in the inbox.
- eyebrow: a short label such as "This week: pigmentation".
- headline: one line.
- paragraphs: 2 or 3 short paragraphs. Do not greet the reader; the greeting is added for you.
- tipsTitle and tips: a short title and 3 practical tips, one sentence each. Use an empty list if tips don't fit the topic.
- skipProducts: true only if Laura says not to show, add or push products in this email. Otherwise false.
- products: every product from the list that Laura names or clearly points to in her topic, even loosely ("the mandelic", "my vitamin C serum"), using the exact name from the list, in the order she mentions them. If she mentions none, add the one product that fits the topic best, or none if nothing fits or the goal is just news. Empty when skipProducts is true.${previous ? " Keep the products from your last draft unless her feedback changes them." : ""}
  For each one, note: one short line on why it fits this email, in Laura's voice (for example "My go-to for fading those marks"), or "".
- matchTerms: 10 to 25 lowercase words or short phrases that would appear in an esthetician's client notes or purchase records if a client relates to this topic. Include shorthand (for pigmentation: pih, pie, hyperpigmentation, dark spots, melasma, sun spots, brightening, mandelic, vitamin c, tranexamic) and the names of fitting products from the list.`;
}

/**
 * The shared email everyone gets, plus the words to look for in client notes and purchases.
 * `previous` and `feedback` are set when Laura asks for a redraft.
 */
export async function draftSharedEmail(env, { topic, goal, productNames = [], previous = null, feedback = "", usage }) {
  const prompt = sharedEmailPrompt({ topic, goal, productNames, previous, feedback });
  const draft = await askForJson(env, { prompt, schema: SHARED_SCHEMA, maxTokens: SHARED_MAX_TOKENS, usage });
  return {
    subject: draft.subject.trim(),
    preheader: draft.preheader.trim(),
    eyebrow: draft.eyebrow.trim(),
    headline: draft.headline.trim(),
    paragraphs: draft.paragraphs.map((text) => text.trim()).filter(Boolean).slice(0, 4),
    tipsTitle: draft.tipsTitle.trim(),
    tips: draft.tips.map((text) => text.trim()).filter(Boolean).slice(0, 5),
    skipProducts: Boolean(draft.skipProducts),
    products: draft.skipProducts ? [] : draft.products.map((product) => ({ name: product.name.trim(), note: product.note.trim() })).filter((product) => product.name),
    matchTerms: [...new Set(draft.matchTerms.map((term) => term.trim().toLowerCase()).filter(Boolean))].slice(0, 30),
  };
}

const PERSONAL_SCHEMA = object({
  versions: {
    type: "array",
    items: object({
      ref: { type: "string" },
      related: { type: "boolean" },
      reason: { type: "string" },
      personalNote: { type: "string" },
      productName: { type: "string" },
      productNote: { type: "string" },
    }),
  },
});

/** The prompt for one batch of personal versions. Also measured by the cost estimate. */
export function personalNotesPrompt({ shared, candidates, productNames = [], feedback = "" }) {
  return `This week's email to all clients is about:
<email>
${shared.headline}
${shared.paragraphs.join("\n")}
</email>

These clients might relate to it. Their notes are Laura's own treatment notes, written in esthetician shorthand.
${candidates.map((candidate) => `<client ref="${candidate.ref}" first_name="${candidate.firstName}">\n${candidate.profile}\n</client>`).join("\n")}

Shop products (exact names):
${productNames.slice(0, 80).map((name) => `- ${name}`).join("\n") || "- (none listed)"}
${feedback ? `\nLaura's feedback on the last draft, which you must follow:\n${feedback}\n` : ""}
For every client, return one entry with their ref:
- related: true only if their notes or purchases clearly connect to this topic. When in doubt, false; they still get the shared email.
- reason: for Laura, one short line saying what connects them (for example "Notes: marks after breakouts; bought Mandelic 5% in March"). Empty if not related.
- personalNote: 2 or 3 short sentences to the client, in Laura's voice (use "I" and "we"), that link the topic to their own skin journey and say what to keep doing. Do not greet them; the greeting is added for you.
  Never mention medications, prescriptions, pregnancy, allergies, diagnoses or medical conditions by name, even if they are in the notes. Talk about skin goals instead ("the marks we've been fading", "the redness we've been calming").
  If their flags mention sensitive or reactive skin, an allergy or pregnancy, keep the advice gentle and do not recommend acids, retinoids or strong peels.
- productName: a product they bought, or one from the shop list, that fits their version. Empty if none fits.
- productNote: one short line about that product for them, such as when they last bought it or how to use it. Empty if no product.
Empty strings for everything except ref and related when related is false.`;
}

/**
 * Personal versions for clients whose notes or purchases might relate.
 * candidates: [{ ref, firstName, profile }] where profile is a short text of their notes, purchases and flags.
 * Returns [{ ref, related, reason, personalNote, productName, productNote }].
 */
export async function draftPersonalNotes(env, { shared, candidates, productNames = [], feedback = "", usage }) {
  if (!candidates.length) return [];
  const prompt = personalNotesPrompt({ shared, candidates, productNames, feedback });
  const result = await askForJson(env, { prompt, schema: PERSONAL_SCHEMA, maxTokens: PERSONAL_MAX_TOKENS, usage });
  return result.versions.map((version) => ({
    ref: version.ref,
    related: Boolean(version.related),
    reason: version.reason.trim(),
    personalNote: version.personalNote.trim(),
    productName: version.productName.trim(),
    productNote: version.productNote.trim(),
  }));
}

const IDEAS_SCHEMA = object({ ideas: strings });

/** Three topic ideas for the reminder, from what recent client notes talk about. No client names are sent. */
export async function suggestTopics(env, { noteSnippets, monthName, usage }) {
  const prompt = `It's ${monthName}. Here are recent treatment notes from Laura's clients (names removed):
${noteSnippets.slice(0, 60).map((snippet) => `- ${snippet}`).join("\n") || "- (no recent notes)"}

Suggest 3 topics for this week's client email, based on what comes up most in these notes and the season. Each is a short phrase, like "Barrier care before winter".`;
  const result = await askForJson(env, { prompt, schema: IDEAS_SCHEMA, maxTokens: 2000, usage });
  return result.ideas.map((idea) => idea.trim()).filter(Boolean).slice(0, 3);
}
