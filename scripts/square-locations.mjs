#!/usr/bin/env node
// Lists the Square locations your access token can see, so you can copy the
// right SQUARE_LOCATION_ID. Read-only — it creates nothing and charges nothing.
//
//   SQUARE_ACCESS_TOKEN=EAAA... node scripts/square-locations.mjs
//
// or put SQUARE_ACCESS_TOKEN in .dev.vars (gitignored) and just run:
//
//   npm run square:locations

import { readFileSync } from "node:fs";

const SQUARE_VERSION = "2026-08-19";

function tokenFromDevVars() {
  try {
    const file = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8");
    const match = file.match(/^\s*SQUARE_ACCESS_TOKEN\s*=\s*"?([^"\n]+)"?/m);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

const token = process.env.SQUARE_ACCESS_TOKEN || tokenFromDevVars();
const sandbox = String(process.env.SQUARE_ENVIRONMENT || "").toLowerCase() === "sandbox";
const base = sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";

if (!token || token === "your_square_access_token") {
  console.error(`No Square access token found.

Set it one of two ways:
  SQUARE_ACCESS_TOKEN=EAAA... npm run square:locations
  or add SQUARE_ACCESS_TOKEN="EAAA..." to .dev.vars

Get the token at https://developer.squareup.com/apps
  -> your app -> Credentials -> switch to Production -> Production Access Token`);
  process.exit(1);
}

const response = await fetch(`${base}/v2/locations`, {
  headers: {
    Authorization: `Bearer ${token}`,
    "Square-Version": SQUARE_VERSION,
    "Content-Type": "application/json",
  },
});

const payload = await response.json().catch(() => ({}));

if (!response.ok) {
  const detail = (payload.errors || []).map((e) => `${e.code}: ${e.detail}`).join("\n  ");
  console.error(`Square returned ${response.status}.\n  ${detail || "No detail provided."}`);
  if (response.status === 401) {
    console.error(`
A 401 usually means one of:
  - the token is an Application ID (sq0idp-...) rather than an access token (EAAA...)
  - the token is for the other environment (sandbox token against production)
  - the token was revoked or regenerated`);
  }
  process.exit(1);
}

const locations = payload.locations || [];
if (!locations.length) {
  console.log("Token is valid, but no locations are visible to it.");
  process.exit(0);
}

console.log(`${locations.length} location(s) on ${sandbox ? "SANDBOX" : "PRODUCTION"}:\n`);
for (const location of locations) {
  const address = location.address
    ? [location.address.address_line_1, location.address.locality, location.address.administrative_district_level_1]
        .filter(Boolean).join(", ")
    : "no address on file";
  console.log(`  ${location.name}${location.status === "ACTIVE" ? "" : `  [${location.status}]`}`);
  console.log(`    SQUARE_LOCATION_ID = ${location.id}`);
  console.log(`    ${address}`);
  console.log(`    currency ${location.currency || "?"} · capabilities: ${(location.capabilities || []).join(", ") || "none listed"}\n`);
}
console.log("Copy the id of the location whose catalog you sell from, then run:\n  npx wrangler secret put SQUARE_LOCATION_ID");
