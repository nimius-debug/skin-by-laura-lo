import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { page } from "../src/layout.js";

const document = page({
  body: "",
  cfg: { shippingEnabled: false, pickupEnabled: false },
});
const logo = await readFile(new URL("../public/media/skin-logo.svg", import.meta.url), "utf8");

assert.match(document, /<img class="brand-logo" src="\/media\/skin-logo\.svg" alt="" width="750" height="300" \/>/, "the header uses the supplied logo asset");
assert.match(document, /aria-label="Skin by Laura Lo home"/, "the linked logo keeps an accessible name");
assert.match(logo, /viewBox="0 0 750 299\.999988"/, "the logo keeps its wide source viewBox");
assert.doesNotMatch(logo, /<text\b/i, "the logo is outlined and does not depend on installed fonts");

console.log("PASS  supplied vector logo renders in the site header");
