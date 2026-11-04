import assert from "node:assert/strict";
import { homePage } from "../src/pages/home.js";
import { BOOKING_URL, VIRTUAL_CONSULTATION_URL } from "../src/config.js";
import { toString } from "../src/html.js";

const markup = toString(homePage({ products: [], cfg: {} }));

assert.match(
  markup,
  new RegExp(`href="${VIRTUAL_CONSULTATION_URL}"[^>]*>Start your skin journey`),
  "the skin-journey CTA opens the Virtual Skin Consultation directly",
);
assert.match(
  markup,
  new RegExp(`href="${BOOKING_URL}"[^>]*>Book your treatment`),
  "general treatment booking still opens the complete service menu",
);

console.log("PASS  consultation CTA is direct while general booking stays general");
