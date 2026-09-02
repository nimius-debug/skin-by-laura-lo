import assert from "node:assert/strict";
import { CLIENT_JS } from "../src/client/cart.js";
import { toString } from "../src/html.js";
import { homePage } from "../src/pages/home.js";
import { STYLES } from "../src/styles.js";

const markup = toString(homePage({ products: [], cfg: {} }));
const cards = markup.match(/data-hero-result="(?:before|after)"/g) || [];

assert.equal(cards.length, 2, "the hero exposes exactly two orbiting result cards");
assert.match(CLIENT_JS, /\? -0\.62 : 0\.62/, "before and after are separated along the orbit");
assert.match(CLIENT_JS, /var front = depth >= 0;/, "front/back flips at the side crossings");
assert.match(CLIENT_JS, /front \? "135px" : "-130px"/, "cards straddle Laura's depth plane");
assert.match(CLIENT_JS, /paintOrbit\(0\);/, "the static composition starts at the front");
assert.match(CLIENT_JS, /if \(!reducedMotion\) orbitRaf = requestAnimationFrame/, "reduced motion freezes the orbit");
assert.match(STYLES, /\.hero-result[\s\S]*?var\(--orbit-z\)/, "orbit transforms are scoped to result cards");
assert.match(STYLES, /\.hero-ring[\s\S]*?background: transparent;/, "the orbit is an open arc, not a filled disc");

console.log("PASS  hero result cards orbit around Laura with an explicit depth switch");

