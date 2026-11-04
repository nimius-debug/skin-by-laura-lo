import assert from "node:assert/strict";
import worker from "../src/index.js";

const productionUrl = "https://skinbylauralo.com";

const www = await worker.fetch(
  new Request("https://www.skinbylauralo.com/shop/?utm_source=launch"),
  {},
);
assert.equal(www.status, 301, "www permanently redirects to the canonical host");
assert.equal(
  www.headers.get("location"),
  `${productionUrl}/shop?utm_source=launch`,
  "the canonical redirect removes the trailing slash and preserves the query",
);

const insecure = await worker.fetch(
  new Request("http://skinbylauralo.com/about?ref=launch"),
  {},
);
assert.equal(insecure.status, 301, "plain HTTP permanently redirects to HTTPS");
assert.equal(
  insecure.headers.get("location"),
  `${productionUrl}/about?ref=launch`,
  "the HTTPS redirect preserves the complete path and query",
);

const preview = await worker.fetch(
  new Request("https://skin-by-laura-lo.skinbylauralo.workers.dev/robots.txt"),
  {},
);
assert.equal(preview.status, 200, "workers.dev remains available for pre-cutover testing");
assert.match(
  await preview.text(),
  /Sitemap: https:\/\/skinbylauralo\.com\/sitemap\.xml/,
  "robots.txt advertises the production sitemap",
);

const about = await worker.fetch(
  new Request("https://skin-by-laura-lo.skinbylauralo.workers.dev/about"),
  {},
);
assert.match(
  await about.text(),
  /<link rel="canonical" href="https:\/\/skinbylauralo\.com\/about" \/>/,
  "preview pages publish the production canonical URL",
);

const renamedProduct = await worker.fetch(
  new Request("https://skinbylauralo.com/product/krx-aqua-cream/?ref=legacy"),
  {},
);
assert.equal(renamedProduct.status, 301, "renamed WordPress products permanently redirect");
assert.equal(
  renamedProduct.headers.get("location"),
  "/product/krx-aquageltm-cream?ref=legacy",
  "legacy product redirects preserve attribution queries",
);

const formerVariants = await worker.fetch(
  new Request("https://skinbylauralo.com/product/krx-skin-filter-tinted-sunscreen-spf-50-pa"),
  {},
);
assert.equal(formerVariants.status, 301, "former multi-variant products permanently redirect");
assert.equal(
  formerVariants.headers.get("location"),
  "/shop",
  "former multi-variant products return to the shop for an explicit choice",
);

console.log("PASS  production host, protocol, canonical URLs, and sitemap are ready for cutover");
