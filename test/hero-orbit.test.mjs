import assert from "node:assert/strict";
import { CLIENT_JS } from "../src/client/cart.js";
import { toString } from "../src/html.js";
import { page } from "../src/layout.js";
import { homePage } from "../src/pages/home.js";
import { STYLES } from "../src/styles.js";

const markup = toString(homePage({ products: [], cfg: {} }));
const cards = markup.match(/data-hero-result="(?:before|after)"/g) || [];

assert.equal(cards.length, 2, "the hero exposes exactly two orbiting result cards");
assert.match(CLIENT_JS, /\? -0\.62 : 0\.62/, "before and after are separated along the orbit");
assert.match(CLIENT_JS, /var front = depth >= 0;/, "front/back flips at the side crossings");
assert.match(CLIENT_JS, /var destination = front \? foreground : layers/, "cards switch synchronized stacking groups at the side crossings");
assert.match(CLIENT_JS, /setProperty\("--orbit-z", "-140px"\)/, "cards stay on the ring's physical plane");
assert.match(CLIENT_JS, /paintOrbit\(0\);/, "the static composition starts at the front");
assert.match(CLIENT_JS, /if \(!reducedMotion\) orbitRaf = requestAnimationFrame/, "reduced motion freezes the orbit");
assert.match(STYLES, /\.hero-result[\s\S]*?var\(--orbit-z\)/, "orbit transforms are scoped to result cards");
assert.match(STYLES, /\.hero-ring[\s\S]*?background: transparent;/, "the orbit is an open arc, not a filled disc");
assert.match(markup, /hero-subject" data-depth="6"/, "Laura keeps her forward mouse-parallax layer");
assert.match(STYLES, /\.hero-subject \{[\s\S]*?translateZ\(110px\)/, "Laura remains projected out of the stage");
assert.match(markup, /hero-ring-back[\s\S]*hero-ring-front/, "the orbit wraps behind and in front of Laura");
assert.match(markup, /hero-ring-back" data-depth="-4"[\s\S]*hero-ring-front" data-depth="-4"/, "both ring arcs counter-move against Laura");
assert.match(markup, /data-hero-foreground[\s\S]*hero-ring-front/, "the front arc has its own foreground stacking layer");
assert.match(STYLES, /hero-ring-back[\s\S]*?translateZ\(-140px\)[\s\S]*?hero-ring-front[\s\S]*?translateZ\(-140px\)/, "both ring halves share one physical depth plane");
assert.match(CLIENT_JS, /foreground\.style\.transform = tilt;/, "both ring stacking layers share the same pointer tilt");
assert.match(CLIENT_JS, /event\.pointerType !== "mouse"/, "mouse parallax remains active even when hover media queries misreport");
assert.match(STYLES, /\.site-header nav \{[\s\S]*?width: 100%;[\s\S]*?align-items: stretch;/, "the mobile menu fills the viewport width");

const document = page({ body: "", cfg: { shippingEnabled: false, pickupEnabled: false } });
assert.match(document, /styles\.css\?v=20260902-hero-orbit-6/, "the orbit CSS bypasses stale caches");
assert.match(document, /cart\.js\?v=20260902-hero-orbit-6/, "the orbit script bypasses stale caches");

console.log("PASS  hero result cards orbit around Laura with an explicit depth switch");


