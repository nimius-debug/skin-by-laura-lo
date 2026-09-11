import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CLIENT_JS } from "../src/client/cart.js";
import { CLIENT_RESULTS } from "../src/config.js";
import { toString } from "../src/html.js";
import { page } from "../src/layout.js";
import { homePage } from "../src/pages/home.js";
import { STYLES } from "../src/styles.js";

const markup = toString(homePage({ products: [], cfg: {} }));
const cards = markup.match(/data-hero-result(?:\s|>)/g) || [];

assert.equal(cards.length, 2, "the hero exposes two composite transformation slots");
assert.equal(CLIENT_RESULTS.images.length, 6, "the orbit contains all six supplied transformations");
assert.match(markup, /hero-result-label-after">After<\/span>\s*<div class="hero-result-shot">[\s\S]*<\/div>\s*<span class="hero-result-label hero-result-label-before">Before/, "the labels sit outside the photo without covering skin detail");
assert.doesNotMatch(markup, /hero-result-before|hero-result-after/, "before and after are no longer separate cards");
assert.match(CLIENT_JS, /phase: slot \* Math\.PI/, "the two composite cards travel half a lap apart");
assert.match(CLIENT_JS, /var front = depth >= 0;/, "front/back flips at the side crossings");
assert.match(CLIENT_JS, /var destination = front \? foreground : layers/, "cards switch synchronized stacking groups at the side crossings");
assert.match(CLIENT_JS, /setProperty\("--orbit-z", "-140px"\)/, "cards stay on the ring's physical plane");
assert.match(CLIENT_JS, /paintOrbit\(0\);/, "the static composition starts at the front");
assert.match(CLIENT_JS, /if \(!reducedMotion\) orbitRaf = requestAnimationFrame/, "reduced motion freezes the orbit");
assert.match(markup, /data-result-images="\[\{&quot;src&quot;:/, "the stage carries one shared transformation queue");
assert.match(CLIENT_JS, /var scale = \.72 \+ \(approach \* 1\.28\)/, "the front card grows smoothly to twice its resting size");
assert.match(CLIENT_JS, /\(depth \+ \.35\) \/ \.7/, "cards fade completely through the rear of the orbit");
assert.match(CLIENT_JS, /rearCycle > slot\.lastRearCycle/, "each slot changes images only at its hidden rear crossing");
assert.match(CLIENT_JS, /nextResultIndex = \(nextResultIndex \+ 1\) % resultImages\.length/, "the two slots advance through one continuous result queue");
assert.match(CLIENT_JS, /var preload = new window\.Image\(\)/, "later result pairs preload before they enter the orbit");
assert.match(CLIENT_JS, /stage\.style\.setProperty\("--result-radius-x"/, "the visible ring follows the viewport-safe card path");
assert.match(STYLES, /\.hero-result[\s\S]*?var\(--orbit-z\)/, "orbit transforms are scoped to result cards");
assert.match(STYLES, /\.hero-result-shot \{[\s\S]*?aspect-ratio: 4 \/ 5;/, "the result frame matches the supplied 4:5 images");
assert.match(STYLES, /\.hero-result-label-after \{ top: -10px; \}/, "the after label sits above the photograph");
assert.match(STYLES, /\.hero-result-label-before \{ bottom: -10px; \}/, "the before label sits below the photograph");
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

for (const result of CLIENT_RESULTS.images) {
  const image = await readFile(new URL(`../public${result.src}`, import.meta.url));
  assert.equal(image.subarray(0, 4).toString(), "RIFF", `${result.src} is an optimized WebP asset`);
  assert.equal(image.subarray(8, 12).toString(), "WEBP", `${result.src} has a valid WebP header`);
  assert.ok(image.length < 300_000, `${result.src} stays lightweight enough to preload`);
}

const document = page({ body: "", cfg: { shippingEnabled: false, pickupEnabled: false } });
assert.match(document, /styles\.css\?v=20260910-result-labels/, "the shared CSS bypasses stale caches");
assert.match(document, /cart\.js\?v=20260910-result-labels/, "the client script bypasses stale caches");

console.log("PASS  composite client results approach, recede, and swap behind Laura");


