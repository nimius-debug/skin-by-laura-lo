// What the AI costs for a campaign: the exact cost of what was already used
// (from the token counts Anthropic returns), and an estimate before drafting
// or redrafting, measured from the real prompts.
//
// Prices are Anthropic's first-party API rates in dollars per million tokens
// (checked 2026-10-06). Update them when Anthropic changes its prices. A model
// that isn't listed shows token counts without a dollar figure.

import { LAURA_EMAIL_VOICE } from "./voice.js";
import { personalNotesPrompt, sharedEmailPrompt } from "./ai.js";

const PRICES = {
  "claude-haiku-5-5": { name: "Claude Haiku 5.5", input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { name: "Claude Sonnet 5.5", input: 2, output: 10 },
  "claude-sonnet-5": { name: "Claude Sonnet 5", input: 2, output: 10 },
  "claude-sonnet-4-6": { name: "Claude Sonnet 4.6", input: 3, output: 15 },
  "claude-opus-5-5": { name: "Claude Opus 5.5", input: 4, output: 20 },
  "claude-opus-5": { name: "Claude Opus 5", input: 5, output: 25 },
  "claude-opus-4-8": { name: "Claude Opus 4.8", input: 5, output: 25 },
  "claude-fable-5-1": { name: "Claude Fable 5.1", input: 10, output: 50 },
};

// Estimating tokens from text: about 3.5 characters per token for English,
// which rounds a little high on purpose. Each call also carries the JSON
// schema and message framing.
const CHARS_PER_TOKEN = 3.5;
const CALL_OVERHEAD_TOKENS = 350;
// What the AI writes back, including its brief thinking at low effort. These
// are typical sizes, not limits; past campaigns show the real spread.
const SHARED_OUTPUT_TOKENS = 1200;
const PERSONAL_CALL_OUTPUT_TOKENS = 500;
const PERSONAL_CLIENT_OUTPUT_TOKENS = 170;
// Clients per personal-version call (matches drafting.js).
export const PERSONAL_BATCH = 8;
// A finished shared email, as the personal prompt quotes it.
const SHARED_EMAIL_TOKENS = 220;

export function priceFor(model) {
  return PRICES[model] || null;
}

export function modelName(model) {
  return priceFor(model)?.name || model || "the AI";
}

export function tokensIn(text) {
  return Math.ceil(String(text || "").length / CHARS_PER_TOKEN);
}

function dollars(price, inputTokens, outputTokens) {
  return price ? (inputTokens * price.input + outputTokens * price.output) / 1e6 : null;
}

/** The cost of what a campaign already used. { dollars (null for an unknown model), calls, tokens, model } */
export function costOf(usage = {}) {
  const inputTokens = usage.inputTokens || 0;
  const outputTokens = usage.outputTokens || 0;
  return {
    dollars: usage.calls ? dollars(priceFor(usage.model), inputTokens, outputTokens) : 0,
    calls: usage.calls || 0,
    tokens: inputTokens + outputTokens,
    model: usage.model || "",
  };
}

/** "$0.07", "under 1¢", or "unknown" for a model without a price. */
export function formatCost(amount) {
  if (amount == null) return "unknown";
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return "under 1¢";
  return `$${amount.toFixed(2)}`;
}

/**
 * Everything the cost estimate needs, measured from the real prompts. The page
 * adds the topic as Laura types it.
 *   productNames: the shop's products, as the prompts list them
 *   clientProfiles: the prompt text for each client who could match (has notes or purchases)
 */
export function estimateInputs({ model, goal = "book", productNames = [], clientProfiles = [] }) {
  const price = priceFor(model);
  const system = tokensIn(LAURA_EMAIL_VOICE) + CALL_OVERHEAD_TOKENS;
  const clientTokens = clientProfiles.map((profile) => tokensIn(`<client ref="c10" first_name="Name">\n${profile}\n</client>\n`));
  return {
    model,
    modelName: modelName(model),
    price,
    sharedInput: system + tokensIn(sharedEmailPrompt({ topic: "", goal, productNames })),
    sharedOutput: SHARED_OUTPUT_TOKENS,
    personalCallInput: system + SHARED_EMAIL_TOKENS + tokensIn(personalNotesPrompt({ shared: { headline: "", paragraphs: [] }, candidates: [], productNames })),
    personalCallOutput: PERSONAL_CALL_OUTPUT_TOKENS,
    clientInput: clientTokens.length ? Math.round(clientTokens.reduce((sum, count) => sum + count, 0) / clientTokens.length) : 0,
    clientOutput: PERSONAL_CLIENT_OUTPUT_TOKENS,
    batch: PERSONAL_BATCH,
    clientsWithNotes: clientTokens.length,
  };
}

/** Dollars for a campaign whose topic is `topicChars` long and matches `matched` clients. Same math as the page's script. */
export function estimateCampaign(inputs, { topicChars = 0, matched = 0 }) {
  if (!inputs.price) return null;
  const calls = Math.ceil(matched / inputs.batch);
  const input = inputs.sharedInput + Math.ceil(topicChars / CHARS_PER_TOKEN) + calls * inputs.personalCallInput + matched * inputs.clientInput;
  const output = inputs.sharedOutput + calls * inputs.personalCallOutput + matched * inputs.clientOutput;
  return dollars(inputs.price, input, output);
}

/** Dollars for redrafting one version: the shared email (with the last draft quoted) or one client's note. */
export function estimateRedraft(inputs, { shared, topicChars = 0, previousChars = 0 }) {
  if (!inputs.price) return null;
  if (shared) {
    return dollars(inputs.price, inputs.sharedInput + Math.ceil((topicChars + previousChars + 600) / CHARS_PER_TOKEN), inputs.sharedOutput);
  }
  return dollars(inputs.price, inputs.personalCallInput + inputs.clientInput + 150, inputs.personalCallOutput + inputs.clientOutput);
}

/** What past campaigns really cost: { count, low, high, average } in dollars, or null if there's no history. */
export function costHistory(campaigns) {
  const amounts = campaigns.map((campaign) => costOf(campaign.usage)).filter((cost) => cost.calls && cost.dollars != null).map((cost) => cost.dollars);
  if (!amounts.length) return null;
  return {
    count: amounts.length,
    low: Math.min(...amounts),
    high: Math.max(...amounts),
    average: amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length,
  };
}
