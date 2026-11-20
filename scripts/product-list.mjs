#!/usr/bin/env node
// Read-only: writes every shop product's name, category and main photo from
// the Square catalog to a JSON file, for scripts/product-cutouts.py.
//
//   npm run products:list            (writes product-list.json)
//   node scripts/product-list.mjs out.json
//
// Needs SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID in .dev.vars or the environment.

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

const products = await getCatalog(env, settings(env), { force: true });
const list = products
  .filter((product) => product.image)
  .map((product) => ({ name: product.name, category: product.category || "", image: product.image }));
const out = process.argv[2] || "product-list.json";
writeFileSync(out, `${JSON.stringify(list, null, 2)}\n`);
console.error(`Wrote ${list.length} products with a photo (of ${products.length}) to ${out}.`);
