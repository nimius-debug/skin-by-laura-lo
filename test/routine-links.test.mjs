// Each routine has its own link: the homepage with that routine's popout
// opened on load, and the routine's name and photo as the link preview.
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { ROUTINES, routinePath } from "../src/routines.js";
import { CLIENT_JS } from "../src/client/cart.js";
import { routinesPage } from "../src/admin/pages/routines.js";
import { getCatalog } from "../src/square.js";
import { settings } from "../src/config.js";
import { toString } from "../src/html.js";
import { squareFetch, SQUARE_ENV } from "./helpers/routine-catalog.mjs";

globalThis.fetch = squareFetch(globalThis.fetch);
const env = { ...SQUARE_ENV };
const get = (path) => worker.fetch(new Request(`https://test.skinbylauralo.com${path}`), env);
const SLUG = "men-all-in-one-bundle";

let response = await get(`/routines/${SLUG}`);
assert.equal(response.status, 200);
let body = await response.text();
assert.match(body, /<meta property="og:title" content="Men All In One Bundle routine · Skin by Laura Lo" \/>/);
assert.match(body, /<meta property="og:description" content="Real results without a 10-step routine\./);
assert.match(body, /<meta property="og:image" content="https:\/\/items-images-production\.s3\.us-west-2\.amazonaws\.com\/files\/cleanser\.jpg" \/>/,
  "the preview photo is the routine's first product");
assert.match(body, /<meta name="twitter:card" content="summary_large_image" \/>/);
assert.match(body, /<meta property="og:url" content="[^"]*\/routines\/men-all-in-one-bundle" \/>/);
assert.match(body, new RegExp(`id="routine-${SLUG}"[^>]*data-routine-path="/routines/${SLUG}"`), "the popout knows its own link");
assert.match(body, /data-routine-share/, "the popout has a Share button");
console.log("PASS  a routine link renders the homepage with the routine's preview");

response = await get("/routines/not-a-routine");
assert.equal(response.status, 302);
assert.equal(response.headers.get("location"), "/#routines");
response = await get("/routines");
assert.equal(response.headers.get("location"), "/#routines");
console.log("PASS  an unknown routine link falls back to the routines on the homepage");

body = await (await get("/")).text();
assert.doesNotMatch(body, /og:image/, "the homepage keeps its plain preview");
console.log("PASS  the homepage preview is unchanged");

body = await (await get("/sitemap.xml")).text();
for (const routine of ROUTINES) assert.ok(body.includes(routinePath(routine.slug)), `${routine.slug} is in the sitemap`);
console.log("PASS  every routine link is in the sitemap");

assert.match(CLIENT_JS, /location\.pathname\.match\(\/\^\\\/routines\\\/\(\[a-z0-9-\]\+\)\$\/\)/, "cart.js opens the linked routine on load");
assert.match(CLIENT_JS, /navigator\.share/, "Share uses the phone's share sheet");
console.log("PASS  the site script opens linked routines and shares them");

const products = await getCatalog(env, settings(env));
const admin = toString(routinesPage({ products, siteUrl: "https://skinbylauralo.com" }));
for (const routine of ROUTINES) {
  assert.ok(admin.includes(`data-copy-link="https://skinbylauralo.com/routines/${routine.slug}"`), `${routine.slug} has a Copy link button`);
}
assert.match(admin, /data-share-link="https:\/\/skinbylauralo\.com\/routines\/men-all-in-one-bundle"/);
console.log("PASS  the admin Routines page lists a link for every routine");
