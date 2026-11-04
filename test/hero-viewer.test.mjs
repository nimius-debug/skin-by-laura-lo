import assert from "node:assert/strict";
import vm from "node:vm";
import { CLIENT_JS } from "../src/client/cart.js";

// Exercise the real hero controller with a deterministic clock. This catches
// elapsed-time jumps and duplicate animation loops without waiting for a lap.
function setup(reducedMotion = false) {
  function element() {
    const listeners = new Map();
    const attributes = new Map();
    const classes = new Set();
    return {
      style: { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; } },
      classList: { add: key => classes.add(key), remove: key => classes.delete(key), contains: key => classes.has(key) },
      addEventListener(type, callback) { listeners.set(type, [...(listeners.get(type) || []), callback]); },
      emit(type, detail = {}) { for (const callback of listeners.get(type) || []) callback({ target: this, ...detail }); },
      setAttribute(key, value) { attributes.set(key, value); },
      getAttribute(key) { return attributes.get(key); },
      appendChild(child) { child.parentNode = this; },
      getBoundingClientRect() { return { width: 600, height: 610, left: 0, top: 0 }; },
    };
  }
  const frames = new Map(), timers = new Map();
  let id = 0;
  const layers = element(), foreground = element(), stage = element();
  const sourceImages = Array.from({ length: 6 }, (_, i) => ({ src: `/result-${i}.webp`, alt: `Result ${i}` }));
  const cards = [0, 1].map(index => {
    const card = element(), trigger = element(), image = { ...sourceImages[index] };
    card.setAttribute("data-result-slot", index);
    card.offsetWidth = 116;
    card.querySelector = selector => selector === "img" ? image : trigger;
    trigger.matches = () => true;
    trigger.focus = () => trigger.emit("focus");
    layers.appendChild(card);
    return card;
  });
  stage.setAttribute("data-result-images", JSON.stringify(sourceImages));
  stage.querySelectorAll = selector => selector === "[data-hero-result]" ? cards : [];
  const viewer = element(), viewerImage = {}, closeButton = element();
  viewer.open = false;
  viewer.showModal = () => { viewer.open = true; };
  viewer.close = () => { viewer.open = false; viewer.emit("close"); };
  viewer.querySelector = selector => selector === "[data-result-viewer-image]" ? viewerImage : closeButton;
  const document = element(), window = element();
  document.hidden = false;
  document.documentElement = element();
  document.querySelector = selector => ({ "[data-hero-stage]": stage, "[data-hero-layers]": layers, "[data-hero-foreground]": foreground, "[data-result-viewer]": viewer })[selector];
  window.matchMedia = () => ({ matches: reducedMotion });
  window.Image = class {};
  window.setTimeout = callback => { timers.set(++id, callback); return id; };
  window.clearTimeout = timer => timers.delete(timer);
  const context = { window, document, requestAnimationFrame(callback) { frames.set(++id, callback); return id; }, cancelAnimationFrame: frame => frames.delete(frame) };
  const start = CLIENT_JS.indexOf("  function initHero() {");
  const end = CLIENT_JS.indexOf("  /* ----------------------------------------------------------- 3D tilt */", start);
  vm.runInNewContext(CLIENT_JS.slice(start, end) + "\ninitHero();", context);
  return {
    cards, frames, timers, viewer, viewerImage, closeButton, document, window,
    trigger: cards[0].querySelector("[data-result-open]"),
    tick(now) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); },
    hoverDelay() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    snapshot() { return JSON.stringify(cards.map(card => ({ style: card.style, image: card.querySelector("img") }))); },
  };
}

const hero = setup();
hero.tick(0);
hero.tick(1000);
const beforeHover = hero.snapshot();
hero.trigger.emit("pointerenter", { pointerType: "mouse", clientX: 200, clientY: 200 });
assert.equal(hero.frames.size, 0, "hover stops the orbit immediately");
hero.hoverDelay();
assert.equal(hero.viewer.open, true, "intentional hover opens the viewer");
assert.equal(hero.viewerImage.src, hero.cards[0].querySelector("img").src, "the viewer opens the displayed image, not a stale queue entry");
hero.trigger.emit("pointerleave");
hero.document.hidden = true;
hero.document.emit("visibilitychange");
hero.document.hidden = false;
hero.document.emit("visibilitychange");
hero.tick(90000);
assert.equal(hero.snapshot(), beforeHover, "hover exit and switching tabs cannot move or swap photos while open");
hero.closeButton.emit("click");
assert.equal(hero.viewer.open, false);
assert.equal(hero.document.documentElement.classList.contains("result-viewer-open"), false);
assert.equal(hero.frames.size, 1, "closing schedules exactly one orbit loop");
hero.tick(100000);
assert.equal(hero.snapshot(), beforeHover, "first resumed frame preserves the exact angle and image");
hero.tick(100016);
assert.notEqual(hero.snapshot(), beforeHover, "subsequent frames resume normal motion");
hero.trigger.emit("pointerenter", { pointerType: "mouse", clientX: 200, clientY: 200 });
hero.hoverDelay();
assert.equal(hero.viewer.open, false, "dismissal cannot reopen under a stationary mouse");
hero.window.emit("pointermove", { pointerType: "mouse", clientX: 240, clientY: 240 });
hero.trigger.emit("pointerenter", { pointerType: "mouse", clientX: 240, clientY: 240 });
assert.equal(hero.timers.size, 1, "moving the mouse allows another intentional hover");
hero.trigger.emit("pointerleave");
hero.hoverDelay();
assert.equal(hero.viewer.open, false, "a passing hover does not open the viewer");

const phone = setup();
phone.trigger.emit("pointerenter", { pointerType: "touch" });
assert.equal(phone.timers.size, 0, "touch does not emulate desktop hover");
phone.trigger.emit("pointerdown");
assert.equal(phone.frames.size, 0, "the photo stops under a finger before the tap finishes");
phone.window.emit("pointercancel");
assert.equal(phone.frames.size, 1, "scrolling instead of tapping releases the pause");
phone.trigger.emit("click");
assert.equal(phone.viewer.open, true, "a touch click opens the comparison");
phone.viewer.emit("pointerdown", { target: phone.viewerImage });
phone.viewer.emit("click", { target: phone.viewerImage });
assert.equal(phone.viewer.open, true, "touching the photo keeps it open");
phone.viewer.emit("pointerdown");
phone.viewer.emit("click");
assert.equal(phone.viewer.open, false, "tapping outside closes the comparison");

const keyboard = setup();
keyboard.trigger.emit("focus");
assert.equal(keyboard.frames.size, 0, "keyboard focus pauses a moving target");
keyboard.trigger.emit("blur");
assert.equal(keyboard.frames.size, 1);

const reduced = setup(true);
assert.equal(reduced.cards[1].inert, true, "the invisible rear card is not interactive");
reduced.trigger.emit("click");
assert.equal(reduced.viewer.open, true, "reduced motion users can still view photos");
reduced.viewer.close();
assert.equal(reduced.frames.size, 0, "closing respects reduced motion");

console.log("PASS  hero viewer hover, touch, keyboard, pause/resume, visibility and reduced-motion behavior");
