// Turning Laura's idea into a campaign: the shared email, then personal
// versions for clients whose notes or purchases relate. Also the redrafts she
// asks for from the review screen.

import { formatMoney, settings } from "../../config.js";
import { getCatalog, isConfigured } from "../../square.js";
import { shortGoodFor } from "../../product-insights.js";
import { campaignModel, draftPersonalNotes, draftSharedEmail } from "./ai.js";
import { contentProducts } from "./email-template.js";
import { estimateInputs, PERSONAL_BATCH } from "./cost.js";
import { loadProfiles, pickCandidates, profileForPrompt, promptSafeName } from "./matching.js";
import * as store from "./store.js";

// AI calls running at once. Workers allows six open connections per request.
const PARALLEL_CALLS = 4;

// Product cards in one email, at most.
export const MAX_EMAIL_PRODUCTS = 6;

/** The shop's products, or none if Square isn't set up or doesn't answer. */
export async function shopProducts(env) {
  if (!isConfigured(env)) return [];
  try {
    return await getCatalog(env, settings(env));
  } catch (error) {
    console.error("Reading the catalog for a campaign failed:", error.message);
    return [];
  }
}

/**
 * The product card for an email, from a product name the AI picked.
 * A product that isn't in the shop any more still shows by name, without a link.
 */
export function productCard({ name, products, siteUrl, label, note = "" }) {
  const wanted = String(name || "").trim().toLowerCase();
  if (!wanted) return null;
  const product = products.find((entry) => entry.name.toLowerCase() === wanted)
    || products.find((entry) => entry.name.toLowerCase().includes(wanted) || wanted.includes(entry.name.toLowerCase()));
  const productName = product?.name || name.trim();
  return {
    label,
    name: productName,
    goodFor: shortGoodFor(productName),
    note,
    url: product ? `${siteUrl}/product/${product.slug}` : "",
    image: product?.image || "",
    price: Number.isFinite(product?.priceCents) ? formatMoney(product.priceCents) : "",
  };
}

/** Shop products whose full name appears in Laura's topic, in the order she wrote them. */
export function namedInTopic(topic, products) {
  const text = String(topic || "").toLowerCase();
  return products
    .map((product) => ({ product, at: text.indexOf(product.name.toLowerCase()) }))
    .filter((entry) => entry.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.product.name);
}

/**
 * The shared email's product cards: the products the AI found in Laura's topic,
 * plus any she typed out by full name that it missed. None if she said not to.
 */
export function sharedProductCards({ picks, skip, topic, products, siteUrl }) {
  if (skip) return [];
  const notes = new Map(picks.map((pick) => [pick.name.toLowerCase(), pick.note]));
  const names = [...picks.map((pick) => pick.name), ...namedInTopic(topic, products)];
  const cards = [];
  for (const name of names) {
    const card = productCard({ name, products, siteUrl, label: "", note: notes.get(name.toLowerCase()) || "" });
    if (card && !cards.some((entry) => entry.name === card.name)) cards.push(card);
  }
  return cards.slice(0, MAX_EMAIL_PRODUCTS);
}


function personalFrom(draft, profile, { products, siteUrl }) {
  const boughtIt = profile.purchases.some((purchase) => purchase.name.toLowerCase() === draft.productName.toLowerCase());
  return {
    personalNote: draft.personalNote,
    product: productCard({
      name: draft.productName, products, siteUrl,
      label: boughtIt ? "From your routine" : "Picked for you",
      note: draft.productNote,
    }),
  };
}

/** Personal drafts for the given profiles, a few clients per AI call and a few calls at a time. */
async function personalDrafts(env, { shared, profiles, productNames, feedback = "", usage }) {
  const groups = [];
  for (let start = 0; start < profiles.length; start += PERSONAL_BATCH) {
    const group = profiles.slice(start, start + PERSONAL_BATCH);
    groups.push({
      group,
      candidates: group.map((profile, index) => ({
        ref: `c${start + index + 1}`,
        firstName: promptSafeName(profile.firstName),
        profile: profileForPrompt(profile),
      })),
    });
  }
  const drafts = [];
  for (let start = 0; start < groups.length; start += PARALLEL_CALLS) {
    const wave = groups.slice(start, start + PARALLEL_CALLS);
    const results = await Promise.all(wave.map(({ candidates }) => draftPersonalNotes(env, { shared, candidates, productNames, feedback, usage })));
    wave.forEach(({ group, candidates }, waveIndex) => {
      const byRef = new Map(results[waveIndex].map((result) => [result.ref, result]));
      candidates.forEach((candidate, index) => {
        const result = byRef.get(candidate.ref);
        if (result) drafts.push({ profile: group[index], draft: result });
      });
    });
  }
  return drafts;
}

/** The measured prompt sizes for the cost estimate: this shop's products and every client who could match. */
export async function costEstimateInputs(env, { goal = "book" } = {}) {
  const [products, profiles] = await Promise.all([shopProducts(env), loadProfiles(env)]);
  return estimateInputs({
    model: campaignModel(env),
    goal,
    productNames: products.map((product) => product.name),
    clientProfiles: profiles.filter((profile) => profile.noteTexts.length || profile.purchases.length).map(profileForPrompt),
  });
}

/** Writes a new campaign from Laura's idea and returns its id. */
export async function draftCampaign(env, { topic, goal }) {
  const usage = {};
  const siteUrl = settings(env).siteUrl;
  const products = await shopProducts(env);
  const productNames = products.map((product) => product.name);

  const { matchTerms, products: picks, skipProducts, ...shared } = await draftSharedEmail(env, { topic, goal, productNames, usage });
  const content = {
    ...shared,
    matchTerms,
    products: sharedProductCards({ picks, skip: skipProducts, topic, products, siteUrl }),
  };

  const profiles = await loadProfiles(env);
  const candidates = pickCandidates(profiles, matchTerms).map((match) => match.profile);
  const drafts = await personalDrafts(env, { shared, profiles: candidates, productNames, usage });
  const versions = drafts
    .filter(({ draft }) => draft.related && draft.personalNote)
    .map(({ profile, draft }) => ({
      clientId: profile.clientId,
      reason: draft.reason,
      personal: personalFrom(draft, profile, { products, siteUrl }),
    }));

  return store.createCampaign(env, { topic, goal, content, usage, versions });
}

function addUsage(total, extra) {
  return {
    calls: (total.calls || 0) + (extra.calls || 0),
    inputTokens: (total.inputTokens || 0) + (extra.inputTokens || 0),
    outputTokens: (total.outputTokens || 0) + (extra.outputTokens || 0),
    model: extra.model || total.model,
  };
}

/** Rewrites the shared email with Laura's feedback. Personal notes are kept. */
export async function redraftShared(env, { campaign, version, feedback }) {
  const usage = {};
  const products = await shopProducts(env);
  const { matchTerms, products: picks, skipProducts, ...shared } = await draftSharedEmail(env, {
    topic: campaign.topic,
    goal: campaign.goal,
    productNames: products.map((product) => product.name),
    previous: {
      ...campaign.content, product: undefined, matchTerms: undefined,
      products: contentProducts(campaign.content).map((card) => ({ name: card.name, note: card.note || "" })),
    },
    feedback,
    usage,
  });
  const content = {
    ...shared,
    matchTerms: campaign.content.matchTerms || matchTerms,
    // The topic isn't searched again: Laura may have taken a product out since.
    products: sharedProductCards({ picks, skip: skipProducts, topic: "", products, siteUrl: settings(env).siteUrl }),
  };
  await store.updateCampaign(env, campaign.id, { content, usage: addUsage(campaign.usage, usage) });
  await store.updateVersion(env, version.id, { status: "review", feedback });
}

/** Rewrites one client's personal note with Laura's feedback. */
export async function redraftPersonal(env, { campaign, version, feedback }) {
  const usage = {};
  const siteUrl = settings(env).siteUrl;
  const products = await shopProducts(env);
  const profile = (await loadProfiles(env)).find((entry) => entry.clientId === version.client_id);
  if (!profile) throw new Error("That client couldn't be found any more.");
  const previous = version.personal?.personalNote ? `\nThe last note you wrote for this client was: "${version.personal.personalNote}"` : "";
  const [result] = await personalDrafts(env, {
    shared: campaign.content,
    profiles: [profile],
    productNames: products.map((product) => product.name),
    feedback: `Laura picked this client for a personal version, so treat them as related.${previous}\n${feedback}`,
    usage,
  });
  await store.updateCampaign(env, campaign.id, { usage: addUsage(campaign.usage, usage) });
  if (!result?.draft.personalNote) throw new Error("The AI didn't write a new note. Try different feedback, or edit it yourself.");
  await store.updateVersion(env, version.id, {
    status: "review",
    // Laura's own P.S. for this client stays through a redraft.
    personal: { ...personalFrom(result.draft, profile, { products, siteUrl }), ...(version.personal?.ps ? { ps: version.personal.ps } : {}) },
    reason: result.draft.reason || version.reason,
    feedback,
  });
}
