// The Skincare Guide editor's script (/admin/guides/:id). Plain browser
// JavaScript, no build step, like the admin's other scripts.
//
// Works like Canva on a fixed A4 page: tap a box to select it, drag to move it,
// pull its dots to resize it, tap a selected text box again to type in it.
// "+ Product" adds a shop product to every page it belongs on. Every change is
// saved to the dashboard a moment later; undo/redo keep the last 80 changes.
// "Save as PDF" opens the browser's print window, which saves the pages as an
// A4 PDF.
//
// `editorMain` runs in the browser only. It is written as a normal function so
// it can be checked like the rest of the code; GUIDE_EDITOR_JS embeds its source
// together with the shared drawing functions from render.js.

import { contentVersion } from "../pwa.js";
import { FONT_CSS, guideElementHtml, guideSheetHtml } from "./render.js";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./model.js";

/* eslint-disable no-undef */
function editorMain(FONTS, PAGE_W, PAGE_H, guideElementHtml, guideSheetHtml) {
  "use strict";

  const root = document.getElementById("guide-editor");
  if (!root) return;
  const stackEl = root.querySelector(".page-stack");
  const formatBar = root.querySelector(".format-bar");
  const statusEl = root.querySelector("[data-status]");
  const checkButton = root.querySelector("[data-action='next-check']");
  const offPageButton = root.querySelector("[data-action='next-off-page']");
  const zoomOutput = root.querySelector("[data-zoom]");
  const toastEl = root.querySelector(".toast");
  const picker = root.querySelector(".picker");
  const moreMenu = root.querySelector("details.more");
  const saveUrl = root.dataset.saveUrl;

  const boot = JSON.parse(document.getElementById("guide-data").textContent);
  let doc = boot.document;
  let version = boot.version;
  let wordings = boot.wordings || {};
  const products = boot.products || [];

  let selectedId = null;
  let editingId = null;
  let scale = 1;
  let zoom = null; // null: fit the screen width
  const undoStack = [];
  const redoStack = [];
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  // ── helpers ──────────────────────────────────────────────────────────────
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const escapeText = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let idCounter = 0;
  const newId = (prefix) => `${prefix}${Date.now().toString(36)}${(idCounter += 1).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  function find(id) {
    for (let p = 0; p < doc.pages.length; p += 1) {
      const elements = doc.pages[p].elements;
      for (let i = 0; i < elements.length; i += 1) {
        if (elements[i].id === id) return { page: doc.pages[p], pageIndex: p, element: elements[i], index: i };
      }
    }
    return null;
  }
  const nodeFor = (id) => stackEl.querySelector(`.el[data-id="${CSS.escape(id)}"]`);
  const heightOf = (element) => {
    if (element.type !== "text") return element.h || 0;
    const node = nodeFor(element.id);
    return node ? node.offsetHeight : 0;
  };

  let toastTimer = null;
  function toast(message, ms = 3200) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
  }

  /** A text box's markup cut down to bold, italic, underline and line breaks. */
  function cleanMarkup(node) {
    let out = "";
    const walk = (parent) => {
      parent.childNodes.forEach((child, index) => {
        if (child.nodeType === 3) { out += escapeText(child.nodeValue.replace(/ /g, " ")); return; }
        if (child.nodeType !== 1) return;
        const tag = child.tagName.toLowerCase();
        if (tag === "br") { out += "<br>"; return; }
        const block = tag === "div" || tag === "p";
        if (block && index > 0 && out && !out.endsWith("<br>")) out += "<br>";
        const weight = child.style && child.style.fontWeight;
        const wrap = tag === "b" || tag === "strong" || weight === "bold" || Number(weight) >= 600 ? "b"
          : tag === "i" || tag === "em" ? "i" : tag === "u" ? "u" : null;
        if (wrap) out += `<${wrap}>`;
        walk(child);
        if (wrap) out += `</${wrap}>`;
      });
    };
    walk(node);
    return out.replace(/(<br>)+$/, "").replace(/<(b|i|u)><\/\1>/g, "");
  }
  const isBlank = (markup) => !markup.replace(/<[^>]+>/g, "").replace(/&nbsp;|\s/g, "");

  // ── history and saving ───────────────────────────────────────────────────
  let lastNudgeAt = 0;
  function remember() {
    undoStack.push(JSON.stringify(doc));
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
    updateHistoryButtons();
  }
  function restore(json) {
    doc = JSON.parse(json);
    if (selectedId && !find(selectedId)) selectedId = null;
    renderAll();
    scheduleSave();
  }
  function undo() {
    finishEditing();
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(doc));
    restore(undoStack.pop());
  }
  function redo() {
    finishEditing();
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(doc));
    restore(redoStack.pop());
  }
  function updateHistoryButtons() {
    root.querySelector("[data-action='undo']").disabled = !undoStack.length;
    root.querySelector("[data-action='redo']").disabled = !redoStack.length;
  }

  let saveTimer = null;
  let saving = null;
  let unsaved = false;
  let blocked = false;
  function setStatus(text, tone) {
    statusEl.textContent = text;
    statusEl.dataset.tone = tone || "";
  }
  function scheduleSave() {
    if (blocked) return;
    unsaved = true;
    setStatus("Saving…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 900);
  }
  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(payload), credentials: "same-origin",
    });
    const result = await response.json().catch(() => ({}));
    return { response, result };
  }
  function stopFor(status) {
    if (status === 409) { blocked = true; setStatus("Changed in another tab. Reload to see the latest.", "bad"); return true; }
    if (status === 404) { blocked = true; setStatus("This guide was deleted.", "bad"); return true; }
    if (status === 401) { setStatus("Signed out. Log in again in another tab; this will save after.", "bad"); return false; }
    return false;
  }
  async function saveNow() {
    clearTimeout(saveTimer);
    if (blocked || !unsaved) return saving;
    if (saving) { await saving; return saveNow(); }
    unsaved = false;
    const payload = { document: doc, version };
    saving = (async () => {
      try {
        const { response, result } = await postJson(saveUrl, payload);
        if (stopFor(response.status)) return;
        if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
        version = result.version;
        if (!unsaved) setStatus("Saved", "good");
      } catch (error) {
        unsaved = true;
        if (statusEl.dataset.tone !== "bad" || !/Signed out/.test(statusEl.textContent)) setStatus("Couldn't save. Trying again…", "bad");
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, 4000);
      } finally {
        saving = null;
      }
    })();
    return saving;
  }
  window.addEventListener("beforeunload", (event) => {
    if (unsaved || saving) { event.preventDefault(); event.returnValue = ""; }
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });

  // ── drawing ──────────────────────────────────────────────────────────────
  function frameHtml(page, index) {
    const tools = `<div class="sheet-tools no-print">
      <span>Page ${index + 1} of ${doc.pages.length}</span>
      <button type="button" data-page-action="up" ${index === 0 ? "disabled" : ""} aria-label="Move page ${index + 1} up" title="Move up">↑</button>
      <button type="button" data-page-action="down" ${index === doc.pages.length - 1 ? "disabled" : ""} aria-label="Move page ${index + 1} down" title="Move down">↓</button>
      <button type="button" data-page-action="duplicate">Duplicate</button>
      <button type="button" data-page-action="add">+ Blank page</button>
      <button type="button" data-page-action="delete" class="danger" ${doc.pages.length === 1 ? "disabled" : ""}>Delete</button>
    </div>`;
    return `<div class="sheet-frame" data-index="${index}">${tools}<div class="sheet-box">${guideSheetHtml(page, index, FONTS)}</div></div>`;
  }

  function renderAll() {
    stackEl.innerHTML = doc.pages.map(frameHtml).join("");
    applyScale();
    drawSelection();
    updateChecks();
    updateHistoryButtons();
  }

  function renderElement(id) {
    const found = find(id);
    const node = nodeFor(id);
    if (!found || !node) return renderAll();
    const wrapper = document.createElement("div");
    wrapper.innerHTML = guideElementHtml(found.element, FONTS);
    node.replaceWith(wrapper.firstChild);
    drawSelection();
    updateChecks();
  }

  function fitScale() {
    const style = getComputedStyle(stackEl);
    const available = stackEl.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return Math.min(1, Math.max(0.2, available / PAGE_W));
  }
  function applyScale() {
    scale = zoom || fitScale();
    stackEl.style.setProperty("--scale", scale);
    stackEl.classList.toggle("zoomed", Boolean(zoom) && zoom > fitScale());
    zoomOutput.textContent = zoom ? `${Math.round(scale * 100)}%` : "Fit";
  }
  const ZOOMS = [0.35, 0.5, 0.75, 1, 1.25, 1.5, 2];
  function changeZoom(direction) {
    const fit = fitScale();
    const now = scale;
    const steps = [...new Set([...ZOOMS, fit])].sort((a, b) => a - b);
    const next = direction > 0 ? steps.find((value) => value > now + 0.001) : [...steps].reverse().find((value) => value < now - 0.001);
    if (!next) return;
    zoom = Math.abs(next - fit) < 0.001 ? null : next;
    applyScale();
    drawSelection();
  }
  // Anything scrolled into view lands clear of the top bar (and the format bar at the bottom).
  const topBarEl = root.querySelector(".top-bar");
  const measureTop = () => { if (topBarEl) document.documentElement.style.setProperty("--top-h", `${topBarEl.offsetHeight}px`); };
  measureTop();
  window.addEventListener("resize", () => { measureTop(); applyScale(); drawSelection(); });

  // The keyboard on an iPad or phone covers the bottom bar; lift the bar above it.
  if (window.visualViewport) {
    const lift = () => {
      const covered = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
      document.documentElement.style.setProperty("--keyboard", `${Math.round(covered)}px`);
    };
    window.visualViewport.addEventListener("resize", lift);
    window.visualViewport.addEventListener("scroll", lift);
  }

  function offPageIds() {
    const ids = [];
    doc.pages.forEach((page) => page.elements.forEach((element) => {
      const node = nodeFor(element.id);
      if (!node) return;
      const height = heightOf(element);
      const off = element.x < -1 || element.y < -1 || element.x + element.w > PAGE_W + 1 || element.y + height > PAGE_H + 1;
      node.classList.toggle("off-page", off);
      if (off) ids.push(element.id);
    }));
    return ids;
  }

  function updateChecks() {
    const checks = [];
    doc.pages.forEach((page) => page.elements.forEach((element) => { if (element.origin === "check") checks.push(element.id); }));
    checkButton.hidden = !checks.length;
    checkButton.textContent = checks.length === 1 ? "1 to check" : `${checks.length} to check`;
    const off = offPageIds();
    offPageButton.hidden = !off.length;
    offPageButton.textContent = off.length === 1 ? "1 box off the page" : `${off.length} boxes off the page`;
    return checks;
  }

  // ── selection, handles and the format bar ────────────────────────────────
  const HANDLES = { text: ["w", "e", "se"], image: ["nw", "ne", "sw", "se", "e", "s"], line: ["w", "e"] };

  function drawSelection() {
    stackEl.querySelectorAll(".selection").forEach((node) => node.remove());
    stackEl.querySelectorAll(".el.selected").forEach((node) => node.classList.remove("selected"));
    const found = selectedId && find(selectedId);
    if (!found) { selectedId = null; updateFormatBar(); return; }
    const node = nodeFor(selectedId);
    if (!node) return;
    node.classList.add("selected");
    const box = document.createElement("div");
    box.className = "selection no-print";
    const height = found.element.type === "text" ? node.offsetHeight : Math.max(found.element.h, 2);
    box.style.cssText = `left:${found.element.x}px;top:${found.element.y}px;width:${found.element.w}px;height:${height}px;--inv:${1 / scale}`;
    if (editingId !== selectedId) {
      for (const handle of HANDLES[found.element.type]) {
        const dot = document.createElement("div");
        dot.className = `handle handle-${handle}`;
        dot.dataset.handle = handle;
        box.appendChild(dot);
      }
    }
    node.parentElement.appendChild(box);
    updateFormatBar();
  }

  function select(id) {
    if (editingId && editingId !== id) finishEditing();
    selectedId = id;
    drawSelection();
  }

  function productName(productId) {
    for (const page of doc.pages) {
      const why = page.elements.find((element) => element.role === "why" && element.productId === productId);
      if (why) return why.html.split("<br>")[0].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
    }
    const listed = products.find((product) => product.key === productId);
    return listed ? listed.label : "this product";
  }

  function updateFormatBar() {
    const found = selectedId && find(selectedId);
    const wasHidden = formatBar.hidden;
    formatBar.hidden = !found;
    document.documentElement.style.setProperty("--bar-h", found && getComputedStyle(formatBar).position === "fixed" ? `${formatBar.offsetHeight}px` : "0px");
    if (!found) return;
    if (wasHidden) {
      formatBar.scrollLeft = 0;
      // On iPad and phone the bar sits along the bottom: lift a box it would cover.
      if (getComputedStyle(formatBar).position === "fixed") {
        const node = root.querySelector(`.el[data-id="${CSS.escape(selectedId)}"]`);
        const bar = formatBar.getBoundingClientRect();
        if (node) {
          const box = node.getBoundingClientRect();
          const under = Math.min(box.bottom, box.top + 120) - bar.top + 12;
          if (under > 0) window.scrollBy({ top: under, behavior: "smooth" });
        }
      }
    }
    const { element } = found;
    const style = element.style || {};
    formatBar.querySelectorAll("[data-for]").forEach((node) => {
      node.hidden = !node.dataset.for.split(" ").includes(element.type);
    });
    formatBar.querySelector("[data-what]").textContent = editingId ? "Typing" : { text: "Text", image: "Photo", line: "Line" }[element.type];
    formatBar.querySelector("[name='font']").value = style.font || "body";
    formatBar.querySelector("[name='fontSize']").value = style.fontSize || 16;
    formatBar.querySelector("[name='color']").value = style.color || (element.type === "line" ? "#000000" : "#231f20");
    formatBar.querySelectorAll("[data-align]").forEach((node) => node.setAttribute("aria-pressed", String((style.align || "left") === node.dataset.align)));
    formatBar.querySelector("[data-action='uppercase']").setAttribute("aria-pressed", String(Boolean(style.uppercase)));
    formatBar.querySelector("[data-action='bold']").setAttribute("aria-pressed", String((style.fontWeight || 400) >= 600));
    formatBar.querySelector("[data-action='italic']").setAttribute("aria-pressed", String(Boolean(style.italic)));
    formatBar.querySelector("[data-action='underline']").setAttribute("aria-pressed", String(Boolean(style.underline)));
    formatBar.querySelector("[data-action='edit-text']").hidden = element.type !== "text" || editingId === element.id;
    formatBar.querySelector("[data-action='fit']").textContent = element.fit === "cover" ? "Show whole photo" : "Fill the box";
    formatBar.querySelector("[data-action='looks-good']").hidden = element.origin !== "check";
    const note = formatBar.querySelector("[data-note]");
    note.hidden = !(element.origin === "check" && element.note);
    note.textContent = element.note || "";
    const removeProduct = formatBar.querySelector("[data-action='remove-product']");
    removeProduct.hidden = !element.productId;
    if (element.productId) removeProduct.textContent = `Remove ${productName(element.productId)} from guide`;
    const wording = formatBar.querySelector("[name='wording']");
    const choice = element.role === "why" && wordings[element.productId];
    wording.hidden = !(choice && choice.texts.length > 1);
    if (choice) {
      wording.innerHTML = `<option value="">Other wordings…</option>` + choice.texts
        .map((text, index) => `<option value="${index}">${escapeText(text.length > 70 ? `${text.slice(0, 70)}…` : text)}</option>`).join("");
    }
  }

  function change(id, mutate, { history = true, redraw = true } = {}) {
    if (editingId === id) finishEditing();
    const found = find(id);
    if (!found) return;
    if (history) remember();
    const before = heightOf(found.element);
    mutate(found.element, found);
    if (redraw) renderElement(id);
    if (redraw) keepFlowStacked(found.page, found.element, before);
    scheduleSave();
  }

  /** When a stacked box (a description, a how-to step) grows or shrinks, the boxes under it move with it. */
  function keepFlowStacked(page, element, before) {
    if (!element.flow || element.type !== "text") return;
    const after = heightOf(element);
    const delta = after - before;
    if (Math.abs(delta) < 1) return;
    let moved = false;
    for (const other of page.elements) {
      if (other !== element && other.flow === element.flow && other.y > element.y) {
        other.y = Math.round(other.y + delta);
        const node = nodeFor(other.id);
        if (node) node.style.top = `${other.y}px`;
        moved = true;
      }
    }
    if (moved) { drawSelection(); updateChecks(); }
  }

  function setStyle(key, value) {
    if (!selectedId) return;
    change(selectedId, (element) => {
      element.style = { ...(element.style || {}), [key]: value };
      if (value === undefined || value === false) delete element.style[key];
    });
  }

  // ── typing in a text box ─────────────────────────────────────────────────
  function startEditing(id, point) {
    const found = find(id);
    if (!found || found.element.type !== "text") return;
    editingId = id;
    const node = nodeFor(id);
    node.contentEditable = "true";
    node.classList.add("editing");
    node.dataset.startHeight = String(node.offsetHeight);
    drawSelection();
    node.focus({ preventScroll: true });
    let range = null;
    if (point && document.caretRangeFromPoint) range = document.caretRangeFromPoint(point.x, point.y);
    else if (point && document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(point.x, point.y);
      if (position) { range = document.createRange(); range.setStart(position.offsetNode, position.offset); }
    }
    if (!range || !node.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
    }
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function finishEditing() {
    if (!editingId) return;
    const id = editingId;
    editingId = null;
    const node = nodeFor(id);
    const found = find(id);
    if (!node || !found) return;
    node.contentEditable = "false";
    node.classList.remove("editing");
    const before = Number(node.dataset.startHeight) || node.offsetHeight;
    const markup = cleanMarkup(node);
    if (isBlank(markup)) {
      // An emptied box would be invisible and impossible to tap again: it goes (undo brings it back).
      remember();
      undoStack[undoStack.length - 1] = undoStack[undoStack.length - 1];
      found.page.elements.splice(found.index, 1);
      selectedId = null;
      renderAll();
      scheduleSave();
      toast("Empty text box removed. Undo brings it back.");
      return;
    }
    if (markup !== found.element.html) {
      remember();
      found.element.html = markup;
      if (found.element.origin !== "template") { found.element.origin = "edited"; delete found.element.note; }
      scheduleSave();
    }
    renderElement(id);
    keepFlowStacked(found.page, found.element, before);
  }

  stackEl.addEventListener("input", (event) => {
    const node = event.target.closest && event.target.closest(".el.editing");
    if (!node) return;
    const box = node.parentElement.querySelector(".selection");
    if (box) box.style.height = `${node.offsetHeight}px`;
  });

  // ── dragging and resizing ────────────────────────────────────────────────
  let gesture = null;
  // When a tap selects a box, the format bar appears; the tap's own click must not land on it.
  let selectedAt = 0;

  stackEl.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button > 0) return;
    const handle = event.target.closest(".handle");
    if (handle && selectedId) {
      const found = find(selectedId);
      const node = nodeFor(selectedId);
      gesture = {
        kind: "resize", handle: handle.dataset.handle, id: selectedId, startX: event.clientX, startY: event.clientY,
        start: clone(found.element), startHeight: node.offsetHeight, moved: false, pointerId: event.pointerId,
      };
      stackEl.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    const node = event.target.closest(".el");
    if (!node) {
      if (event.target.closest(".sheet")) { finishEditing(); select(null); }
      return;
    }
    const id = node.dataset.id;
    if (editingId === id) return; // typing: let the browser place the caret
    const wasSelected = selectedId === id;
    if (!wasSelected) selectedAt = performance.now();
    select(id);
    // A finger on a box that wasn't selected just selects it, so the page still scrolls.
    if (event.pointerType === "touch" && !wasSelected) return;
    const found = find(id);
    gesture = {
      kind: "move", id, startX: event.clientX, startY: event.clientY, start: clone(found.element),
      startHeight: node.offsetHeight, moved: false, wasSelected, pointerId: event.pointerId,
    };
    // Captured on the page stack: the selection handles are redrawn while dragging.
    stackEl.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  stackEl.addEventListener("pointermove", (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = (event.clientX - gesture.startX) / scale;
    const dy = (event.clientY - gesture.startY) / scale;
    if (!gesture.moved && Math.abs(dx) + Math.abs(dy) < (event.pointerType === "touch" ? 6 : 3)) return;
    if (!gesture.moved) { gesture.moved = true; remember(); }
    const found = find(gesture.id);
    if (!found) return;
    const element = found.element;
    const start = gesture.start;
    if (gesture.kind === "move") {
      element.x = Math.round(start.x + dx);
      element.y = Math.round(start.y + dy);
      snap(element, gesture.startHeight, event.shiftKey);
    } else {
      resize(element, start, gesture.handle, dx, dy, gesture.startHeight, event.shiftKey);
    }
    const node = nodeFor(gesture.id);
    node.style.left = `${element.x}px`;
    node.style.top = `${element.y}px`;
    node.style.width = `${element.w}px`;
    if (element.type !== "text") node.style.height = `${element.h}px`;
    if (element.type === "text") node.style.fontSize = `${element.style.fontSize}px`;
    drawSelection();
  });

  function endGesture(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const done = gesture;
    gesture = null;
    if (done.moved) {
      renderElement(done.id);
      scheduleSave();
    } else if (done.kind === "move" && done.wasSelected && event.type === "pointerup") {
      startEditing(done.id, { x: event.clientX, y: event.clientY });
    }
  }
  stackEl.addEventListener("pointerup", endGesture);
  stackEl.addEventListener("pointercancel", endGesture);
  stackEl.addEventListener("dblclick", (event) => {
    const node = event.target.closest(".el-text");
    if (node && editingId !== node.dataset.id) { select(node.dataset.id); startEditing(node.dataset.id, { x: event.clientX, y: event.clientY }); }
  });

  // Snaps to the page's centre line and side margins; hold Shift to place freely.
  function snap(element, height, free) {
    if (free) return;
    const centre = element.x + element.w / 2;
    if (Math.abs(centre - PAGE_W / 2) < 6) element.x = Math.round(PAGE_W / 2 - element.w / 2);
    const middle = element.y + height / 2;
    if (Math.abs(middle - PAGE_H / 2) < 6) element.y = Math.round(PAGE_H / 2 - height / 2);
    for (const margin of [35, 42]) {
      if (Math.abs(element.x - margin) < 5) element.x = margin;
      if (Math.abs(element.x + element.w - (PAGE_W - margin)) < 5) element.x = PAGE_W - margin - element.w;
    }
  }

  function resize(element, start, handle, dx, dy, startHeight, free) {
    const minimum = 12;
    if (element.type === "text" && handle === "se") {
      // Corner: grow or shrink the whole box, words and all.
      const factor = Math.max(0.2, (start.w + dx) / start.w);
      element.w = Math.max(minimum, Math.round(start.w * factor));
      element.style = { ...start.style, fontSize: Math.max(4, Math.round((start.style.fontSize || 16) * factor * 10) / 10) };
      return;
    }
    let { x, y, w } = start;
    let h = start.h === undefined ? startHeight : start.h;
    if (handle.includes("e")) w = start.w + dx;
    if (handle.includes("w")) { w = start.w - dx; x = start.x + dx; }
    if (handle.includes("s")) h = (start.h || 0) + dy;
    if (handle.includes("n")) { h = start.h - dy; y = start.y + dy; }
    // Photo corners keep the photo's shape unless Shift is held.
    if (element.type === "image" && handle.length === 2 && !free && start.h) {
      const ratio = start.w / start.h;
      if (Math.abs(dx) > Math.abs(dy)) { h = w / ratio; if (handle.includes("n")) y = start.y + start.h - h; }
      else { w = h * ratio; if (handle.includes("w")) x = start.x + start.w - w; }
    }
    element.x = Math.round(x);
    element.y = Math.round(y);
    element.w = Math.max(minimum, Math.round(w));
    if (element.type === "image") element.h = Math.max(minimum, Math.round(h));
  }

  // ── buttons ──────────────────────────────────────────────────────────────
  function currentPageIndex() {
    const found = selectedId && find(selectedId);
    if (found) return found.pageIndex;
    const frames = [...stackEl.querySelectorAll(".sheet-frame")];
    const middle = window.innerHeight / 2;
    let best = 0;
    frames.forEach((frame, index) => { if (frame.getBoundingClientRect().top < middle) best = index; });
    return best;
  }

  function reveal(id) {
    const node = nodeFor(id);
    if (node) node.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }

  function addText() {
    finishEditing();
    const pageIndex = currentPageIndex();
    remember();
    const element = {
      id: newId("t"), type: "text", x: 247, y: 520, w: 300, html: "Your text",
      style: { font: "body", fontSize: 20, lineHeight: 1.25, letterSpacing: -0.02, color: "#231f20" }, origin: "edited",
    };
    doc.pages[pageIndex].elements.push(element);
    selectedId = element.id;
    renderAll();
    scheduleSave();
    reveal(element.id);
    // Straight into typing, with the placeholder selected so the first key replaces it.
    startEditing(element.id);
    const range = document.createRange();
    range.selectNodeContents(nodeFor(element.id));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function duplicateSelected() {
    const found = selectedId && find(selectedId);
    if (!found) return;
    finishEditing();
    remember();
    const copy = { ...clone(found.element), id: newId("c"), x: found.element.x + 16, y: found.element.y + 16 };
    delete copy.flow;
    found.page.elements.push(copy);
    selectedId = copy.id;
    renderAll();
    scheduleSave();
  }

  function deleteSelected() {
    const found = selectedId && find(selectedId);
    if (!found) return;
    editingId = null;
    remember();
    found.page.elements.splice(found.index, 1);
    selectedId = null;
    renderAll();
    scheduleSave();
    toast("Deleted. Undo brings it back.");
  }

  function pageAction(action, index) {
    finishEditing();
    const pages = doc.pages;
    if (action === "delete" && pages.length === 1) return;
    remember();
    if (action === "up" && index > 0) [pages[index - 1], pages[index]] = [pages[index], pages[index - 1]];
    if (action === "down" && index < pages.length - 1) [pages[index + 1], pages[index]] = [pages[index], pages[index + 1]];
    if (action === "duplicate") {
      const copy = clone(pages[index]);
      copy.id = newId("p");
      copy.elements.forEach((element) => { element.id = newId("c"); });
      pages.splice(index + 1, 0, copy);
    }
    if (action === "add") {
      const footer = pages[index].elements.find((element) => element.role === "footer");
      pages.splice(index + 1, 0, { id: newId("p"), kind: "blank", elements: footer ? [{ ...clone(footer), id: newId("c") }] : [] });
    }
    if (action === "delete") pages.splice(index, 1);
    if (selectedId && !find(selectedId)) selectedId = null;
    renderAll();
    scheduleSave();
    if (action === "delete") toast(`Page ${index + 1} deleted. Undo brings it back.`);
    const target = action === "up" ? index - 1 : action === "down" ? index + 1 : action === "delete" ? Math.max(0, index - 1) : index + 1;
    const frame = stackEl.querySelectorAll(".sheet-frame")[target];
    if (frame && action !== "delete") frame.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function nextOf(ids) {
    if (!ids.length) return;
    const at = ids.indexOf(selectedId);
    const id = ids[(at + 1) % ids.length];
    select(id);
    reveal(id);
  }

  function chooseWording(index) {
    const found = selectedId && find(selectedId);
    const choice = found && wordings[found.element.productId];
    if (!choice || !choice.texts[index]) return;
    change(selectedId, (element) => {
      const heading = element.html.split("<br>")[0];
      element.html = `${heading}<br>${escapeText(choice.texts[index])}`;
      element.origin = "library";
      delete element.note;
    });
  }

  async function saveAsPdf() {
    finishEditing();
    select(null);
    if (moreMenu) moreMenu.open = false;
    await saveNow();
    window.print();
  }

  // ── products ─────────────────────────────────────────────────────────────
  function productKeysInGuide() {
    const keys = new Set();
    doc.pages.forEach((page) => page.elements.forEach((element) => { if (element.productId) keys.add(element.productId); }));
    return keys;
  }

  function renderPickerList() {
    const list = picker.querySelector("[data-picker-list]");
    const query = picker.querySelector(".search").value.trim().toLowerCase();
    const inGuide = productKeysInGuide();
    const shown = products.filter((product) => !query || product.label.toLowerCase().includes(query) || product.name.toLowerCase().includes(query)).slice(0, 120);
    list.innerHTML = shown.length ? shown.map((product) => {
      const added = inGuide.has(product.key);
      const badge = added ? `<span class="badge in">In the guide</span>`
        : product.inLibrary ? `<span class="badge lib">Laura's words</span>` : `<span class="badge new">No description yet</span>`;
      const thumb = product.image ? `<img class="thumb" src="${escapeText(product.image)}" alt="" loading="lazy">` : `<span class="thumb"></span>`;
      return `<li><button type="button" data-product="${escapeText(product.name)}" ${added ? "disabled" : ""}>${thumb}<span class="name">${escapeText(product.label)}</span>${badge}</button></li>`;
    }).join("") : `<li class="empty">No product matches “${escapeText(query)}”.</li>`;
  }

  function openPicker() {
    finishEditing();
    if (moreMenu) moreMenu.open = false;
    picker.querySelector(".search").value = "";
    renderPickerList();
    picker.showModal();
    if (!coarse) picker.querySelector(".search").focus();
  }

  let changingProducts = false;
  async function changeProducts(payload, busyText) {
    if (changingProducts || blocked) return;
    changingProducts = true;
    setStatus(busyText);
    try {
      await saveNow();
      const { response, result } = await postJson(`${saveUrl}/products`, { ...payload, version });
      if (stopFor(response.status)) return;
      if (!response.ok) { setStatus("Saved", "good"); toast(result.message || "That didn't work. Try again."); return; }
      remember();
      doc = result.document;
      version = result.version;
      wordings = result.wordings || wordings;
      if (selectedId && !find(selectedId)) selectedId = null;
      renderAll();
      await layoutFlows({ only: "relayout" });
      setStatus("Saved", "good");
      return result.result;
    } catch (error) {
      setStatus("Couldn't reach the dashboard. Try again.", "bad");
      return null;
    } finally {
      changingProducts = false;
    }
  }

  async function addProduct(name) {
    const result = await changeProducts({ action: "add", name }, "Adding…");
    if (!result) return;
    picker.close();
    // Show where it went: its description on the overview, or its first box anywhere.
    const mine = doc.pages.flatMap((page) => page.elements).filter((element) => element.productId === result.key);
    const first = mine.find((element) => element.role === "why") || mine[0];
    const placed = first && root.querySelector(`.el[data-id="${CSS.escape(first.id)}"]`);
    if (placed) placed.scrollIntoView({ block: "center", behavior: "smooth" });
    const where = (result.pages || []).map((page) => ({ overview: "overview", am: "AM", pm: "PM", notes: "Good to know" }[page])).filter(Boolean);
    const listed = where.length > 1 ? `${where.slice(0, -1).join(", ")} and ${where[where.length - 1]}` : where[0];
    toast(`Added ${result.name}${where.length ? ` to the ${listed} page${where.length === 1 ? "" : "s"}` : ""}.${result.inLibrary ? "" : " It has no description yet: it's highlighted to write."}`, 4500);
  }

  async function removeProduct(productId) {
    const name = productName(productId);
    if (!window.confirm(`Take ${name} out of this guide? Its description, photos and steps are removed. Undo brings them back.`)) return;
    finishEditing();
    selectedId = null;
    const result = await changeProducts({ action: "remove", productId }, "Removing…");
    if (result) toast(`${name} removed from the guide.`);
  }

  // ── wiring ───────────────────────────────────────────────────────────────
  root.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-page-action]");
    if (pageButton) {
      pageAction(pageButton.dataset.pageAction, Number(pageButton.closest(".sheet-frame").dataset.index));
      return;
    }
    const productButton = event.target.closest("[data-product]");
    if (productButton) { addProduct(productButton.dataset.product); return; }
    const button = event.target.closest("[data-action], [data-align]");
    if (!button || button.disabled) return;
    if (button.closest(".format-bar") && performance.now() - selectedAt < 450) return;
    const found = selectedId && find(selectedId);
    const style = (found && found.element.style) || {};
    if (button.dataset.align) { setStyle("align", button.dataset.align); return; }
    if (button.closest(".menu") && moreMenu) moreMenu.open = false;
    switch (button.dataset.action) {
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "add-text": addText(); break;
      case "add-product": openPicker(); break;
      case "close-picker": picker.close(); break;
      case "next-check": nextOf(updateChecks()); break;
      case "next-off-page": nextOf(offPageIds()); break;
      case "zoom-in": changeZoom(1); break;
      case "zoom-out": changeZoom(-1); break;
      case "pdf": saveAsPdf(); break;
      case "pdf-help":
        toast("In the print window choose “Save as PDF”, paper size A4, margins None, and turn on background graphics. On an iPad: Print, then Share › Save to Files.", 9000);
        break;
      case "review": {
        const on = !root.classList.contains("review");
        root.classList.toggle("review", on);
        button.textContent = on ? "Hide the yellow highlights" : "Show the yellow highlights";
        try { localStorage.setItem("guide-review", on ? "1" : "0"); } catch (error) { /* private mode */ }
        break;
      }
      case "edit-text": if (selectedId) startEditing(selectedId); break;
      case "bold":
        if (editingId) document.execCommand("bold");
        else setStyle("fontWeight", (style.fontWeight || 400) >= 600 ? 400 : 700);
        break;
      case "italic":
        if (editingId) document.execCommand("italic");
        else setStyle("italic", !style.italic);
        break;
      case "underline":
        if (editingId) document.execCommand("underline");
        else setStyle("underline", !style.underline);
        break;
      case "uppercase": setStyle("uppercase", !style.uppercase); break;
      case "smaller": setStyle("fontSize", Math.max(4, Math.round(((style.fontSize || 16) - 1) * 10) / 10)); break;
      case "bigger": setStyle("fontSize", Math.min(240, Math.round(((style.fontSize || 16) + 1) * 10) / 10)); break;
      case "fit": change(selectedId, (element) => { element.fit = element.fit === "cover" ? "contain" : "cover"; }); break;
      case "front": change(selectedId, (element, where) => { where.page.elements.splice(where.index, 1); where.page.elements.push(element); }, { redraw: false }); renderAll(); break;
      case "back": change(selectedId, (element, where) => { where.page.elements.splice(where.index, 1); where.page.elements.unshift(element); }, { redraw: false }); renderAll(); break;
      case "looks-good": change(selectedId, (element) => { element.origin = "edited"; delete element.note; }); toast("Marked as checked."); break;
      case "duplicate": duplicateSelected(); break;
      case "delete": deleteSelected(); break;
      case "remove-product": if (found && found.element.productId) removeProduct(found.element.productId); break;
      default: break;
    }
  });
  // Keep the text selection inside a box when a format button is pressed.
  formatBar.addEventListener("mousedown", (event) => {
    if (event.target.closest("button")) event.preventDefault();
  });
  formatBar.querySelector("[name='font']").addEventListener("change", (event) => setStyle("font", event.target.value));
  formatBar.querySelector("[name='fontSize']").addEventListener("change", (event) => {
    const size = Number(event.target.value);
    if (size >= 4 && size <= 240) setStyle("fontSize", size);
  });
  formatBar.querySelector("[name='color']").addEventListener("change", (event) => setStyle("color", event.target.value.toLowerCase()));
  formatBar.querySelector("[name='wording']").addEventListener("change", (event) => {
    if (event.target.value !== "") chooseWording(Number(event.target.value));
  });
  picker.querySelector(".search").addEventListener("input", renderPickerList);
  picker.addEventListener("click", (event) => { if (event.target === picker) picker.close(); });

  // The "⋯" menu: placed under its button, closed by a tap anywhere else.
  if (moreMenu) {
    moreMenu.addEventListener("toggle", () => {
      if (!moreMenu.open) return;
      const rect = moreMenu.querySelector("summary").getBoundingClientRect();
      const menu = moreMenu.querySelector(".menu");
      menu.style.top = `${Math.round(rect.bottom + 6)}px`;
      menu.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
    });
    document.addEventListener("pointerdown", (event) => { if (moreMenu.open && !moreMenu.contains(event.target)) moreMenu.open = false; });
  }

  document.addEventListener("keydown", (event) => {
    const mod = event.metaKey || event.ctrlKey;
    const inField = event.target.closest && event.target.closest("input, select, textarea, dialog");
    if (mod && event.key.toLowerCase() === "z" && !inField) {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
      return;
    }
    if (mod && event.key.toLowerCase() === "y" && !inField) { event.preventDefault(); redo(); return; }
    if (mod && event.key.toLowerCase() === "p") { event.preventDefault(); saveAsPdf(); return; }
    if (editingId) {
      if (event.key === "Escape") { event.preventDefault(); finishEditing(); }
      return;
    }
    if (inField || !selectedId) return;
    if (mod && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); return; }
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelected(); return; }
    if (event.key === "Escape") { select(null); return; }
    if (event.key === "Enter") {
      const found = find(selectedId);
      if (found && found.element.type === "text") { event.preventDefault(); startEditing(selectedId); }
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (move) {
      event.preventDefault();
      // A run of nudges is one step to undo.
      const now = performance.now();
      const history = now - lastNudgeAt > 1000;
      lastNudgeAt = now;
      change(selectedId, (element) => { element.x += move[0]; element.y += move[1]; }, { history });
    }
  });

  // Typing ends, and the box is let go, when she taps outside the pages.
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".page-stack, .format-bar, .top-bar, .picker, .toast")) {
      finishEditing();
      select(null);
    }
  });

  // Paste as plain text, so styles from other apps don't come along.
  stackEl.addEventListener("paste", (event) => {
    if (!editingId) return;
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });

  const deleteForm = root.querySelector("form.delete-guide");
  if (deleteForm) {
    deleteForm.addEventListener("submit", (event) => {
      if (!window.confirm("Delete this whole guide? This can't be undone.")) { event.preventDefault(); return; }
      clearTimeout(saveTimer);
      blocked = true;
      unsaved = false;
    });
  }

  // ── laying out stacked text ──────────────────────────────────────────────
  // A new draft's text boxes were placed with a guess at their height, and a
  // product added later is slotted in roughly. Once the fonts are loaded, each
  // group (product descriptions, how-to steps, notes) is stacked with its real
  // heights, the words shrink a little if a group runs past the bottom of the
  // page, and what still doesn't fit moves to a new page after it.
  function layoutPageFlow(pageIndex, name) {
    const page = doc.pages[pageIndex];
    const flow = page.flows && page.flows[name];
    const boxes = page.elements.filter((element) => element.flow === name).sort((a, b) => a.y - b.y);
    if (!flow || !boxes.length) return;
    const top = boxes[0].y;
    const restack = () => {
      let y = top;
      for (const element of boxes) {
        element.y = Math.round(y);
        const node = nodeFor(element.id);
        node.style.top = `${element.y}px`;
        node.style.fontSize = `${element.style.fontSize}px`;
        y += node.offsetHeight + flow.gap;
      }
      return y - flow.gap;
    };
    let bottom = restack();
    let guard = 0;
    while (bottom > flow.bottom && guard < 40 && boxes.some((element) => element.style.fontSize > flow.minFontSize)) {
      boxes.forEach((element) => { element.style.fontSize = Math.max(flow.minFontSize, Math.round((element.style.fontSize - 0.5) * 10) / 10); });
      bottom = restack();
      guard += 1;
    }
    if (bottom <= flow.bottom) return;
    const overflow = boxes.filter((element, index) => index > 0 && element.y + nodeFor(element.id).offsetHeight > flow.bottom);
    if (!overflow.length) return;
    // Still too long: carry the boxes that don't fit over to the next page, or a new one.
    page.elements = page.elements.filter((element) => !overflow.includes(element));
    let next = doc.pages[pageIndex + 1];
    if (!next || next.kind !== page.kind || !next.flows || !next.flows[name]) {
      const footer = page.elements.find((element) => element.role === "footer");
      next = { id: newId("p"), kind: page.kind, flows: { [name]: { ...flow, bottom: 1045 } }, elements: footer ? [{ ...clone(footer), id: newId("c") }] : [] };
      doc.pages.splice(pageIndex + 1, 0, next);
    }
    const firstY = Math.min(70, ...next.elements.filter((element) => element.flow === name).map((element) => element.y));
    overflow.forEach((element, index) => { element.x = 42; element.w = 700; element.y = firstY - overflow.length + index; });
    next.elements.unshift(...overflow);
    next.relayout = [...new Set([...(next.relayout || []), name])];
    renderAll();
  }

  async function layoutFlows({ only = "all" } = {}) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    let changed = false;
    // Pages can be added while laying out (overflow), so walk by index.
    for (let pageIndex = 0; pageIndex < doc.pages.length; pageIndex += 1) {
      const page = doc.pages[pageIndex];
      const names = only === "all" ? Object.keys(page.flows || {}) : (page.relayout || []);
      delete page.relayout;
      for (const name of names) { layoutPageFlow(pageIndex, name); changed = true; }
    }
    doc.needsLayout = false;
    renderAll();
    if (changed) scheduleSave();
  }

  // ── start ────────────────────────────────────────────────────────────────
  try {
    if (localStorage.getItem("guide-review") === "0") {
      root.classList.remove("review");
      root.querySelector("[data-action='review']").textContent = "Show the yellow highlights";
    }
  } catch (error) { /* private mode */ }
  renderAll();
  setStatus("Saved", "good");
  if (doc.needsLayout) layoutFlows({ only: "all" });
  else if (doc.pages.some((page) => page.relayout && page.relayout.length)) layoutFlows({ only: "relayout" });
  else if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { updateChecks(); drawSelection(); });
  root.classList.add("ready");
}

/** If the editor can't start, say so on the page (with the browser's reason) instead of leaving it half-working. */
function editorFailed(error) {
  const note = document.querySelector("[data-boot-note]");
  if (!note || document.getElementById("guide-editor")?.classList.contains("ready")) return;
  note.classList.add("failed");
  note.textContent = `The editor couldn't start on this browser (${(error && error.message) || error}). Reload the page; if it keeps happening, send a screenshot of this message.`;
}

/** The editor script, with the drawing functions it shares with the server. */
// The deploy's bundler (esbuild with keepNames) adds __name(fn, "fn") calls inside these functions
// bodies. That helper lives in the worker, not the browser, so the script brings a stand-in.
export const GUIDE_EDITOR_JS = `(function () {
var __name = function (target) { return target; };
${guideElementHtml.toString()}
${guideSheetHtml.toString()}
${editorFailed.toString()}
try {
  (${editorMain.toString()})(${JSON.stringify(FONT_CSS)}, ${PAGE_WIDTH}, ${PAGE_HEIGHT}, guideElementHtml, guideSheetHtml);
} catch (error) {
  editorFailed(error);
  throw error;
}
})();
`;

export const GUIDE_EDITOR_VERSION = contentVersion(GUIDE_EDITOR_JS);
