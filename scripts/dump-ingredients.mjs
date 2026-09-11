#!/usr/bin/env node
// One-off, read-only dump of every product currently in the Square catalog —
// name, category, price, and the raw description Square has on file — so we
// can see what ingredient data (if any) already lives there before building
// an ingredient-checker feature. Writes a Markdown file, does not touch Square.
//
//   npm run square:ingredients
// or
//   node scripts/dump-ingredients.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { getCatalog } from "../src/square.js";
import { settings } from "../src/config.js";

function envFromDevVars() {
  try {
    const file = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8");
    const env = {};
    for (const line of file.split("\n")) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (match) env[match[1]] = match[2];
    }
    return env;
  } catch {
    return {};
  }
}

const env = { ...envFromDevVars(), ...process.env };

if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) {
  console.error("Missing SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID (checked .dev.vars and process.env).");
  process.exit(1);
}

const cfg = settings(env);
const products = await getCatalog(env, cfg, { force: true });

console.error(`Fetched ${products.length} products from Square.`);

const lines = [];
lines.push(`# Square catalog dump — ${new Date().toISOString().slice(0, 10)}`);
lines.push("");
lines.push(`${products.length} products currently visible/purchasable in Square.`);
lines.push("");

let withDescription = 0;
let looksLikeIngredients = 0;
const ingredientHint = /\b(water|aqua|glycerin|niacinamide|extract|acid|oil|butter|ingredients?:)\b/i;

for (const product of products.sort((a, b) => a.name.localeCompare(b.name))) {
  const desc = (product.description || "").trim();
  if (desc) withDescription++;
  const hints = ingredientHint.test(desc);
  if (hints) looksLikeIngredients++;

  lines.push(`## ${product.name}`);
  lines.push(`- slug: \`${product.slug}\``);
  lines.push(`- category: ${product.category || "(none)"}`);
  lines.push(`- price: $${(product.defaultVariation.priceCents / 100).toFixed(2)}`);
  lines.push(`- description present: ${desc ? "yes" : "NO"}${hints ? " (looks like it may contain ingredient-ish text)" : ""}`);
  lines.push("");
  lines.push(desc ? "> " + desc.replace(/\n/g, "\n> ") : "_(no description on file in Square)_");
  lines.push("");
  lines.push("---");
  lines.push("");
}

const summary = `${withDescription}/${products.length} products have any description; ${looksLikeIngredients} of those look like they might mention ingredients.`;
console.error(summary);

const outPath = process.argv[2] || "/tmp/square-catalog-dump.md";
writeFileSync(outPath, lines.join("\n"), "utf8");
console.error(`Wrote ${outPath}`);
