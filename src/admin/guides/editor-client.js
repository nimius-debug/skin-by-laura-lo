// The Skincare Guide editor's script (/admin/guides/:id). Plain browser
// JavaScript, no build step, like the admin's other scripts.
//
// Works like Canva on a fixed A4 page: tap a box to select it, drag to move it,
// pull its handles to resize it, tap a selected text box again to type in it.
// Every change is saved to the dashboard a moment later; undo/redo keep the
// last 80 changes. "Save as PDF" opens the browser's print window, which saves
// the pages as an A4 PDF.
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
  const offPageEl = root.querySelector("[data-off-page]");
  const saveUrl = root.dataset.saveUrl;

  const boot = JSON.parse(document.getElementById("guide-data").textContent);
  let doc = boot.document;
  let version = boot.version;
  const wordings = boot.wordings || {};

  let selectedId = null;
  let editingId = null;
  let scale = 1;
  const undoStack = [];
  const redoStack = [];

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
  const sheetFor = (pageIndex) => stackEl.querySelectorAll(".sheet")[pageIndex];

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
        if (block && index > 0 && !out.endsWith("<br>")) out += "<br>";
        const weight = child.style && child.style.fontWeight;
        const wrap = tag === "b" || tag === "strong" || weight === "bold" || Number(weight) >= 600 ? "b"
          : tag === "i" || tag === "em" ? "i" : tag === "u" ? "u" : null;
        if (wrap) out += `<${wrap}>`;
        walk(child);
        if (wrap) out += `</${wrap}>`;
      });
    };
    walk(node);
    return out.replace(/(<br>)+$/, "");
  }

  // ── history and saving ───────────────────────────────────────────────────
  function remember() {
    undoStack.push(JSON.stringify(doc));
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
    updateHistoryButtons();
  }
  function undo() {
    if (!undoStack.length) return;
    finishEditing();
    redoStack.push(JSON.stringify(doc));
    doc = JSON.parse(undoStack.pop());
    if (selectedId && !find(selectedId)) selectedId = null;
    renderAll();
    scheduleSave();
  }
  function redo() {
    if (!redoStack.length) return;
    finishEditing();
    undoStack.push(JSON.stringify(doc));
    doc = JSON.parse(redoStack.pop());
    if (selectedId && !find(selectedId)) selectedId = null;
    renderAll();
    scheduleSave();
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
  async function saveNow() {
    clearTimeout(saveTimer);
    if (blocked || !unsaved) return saving;
    if (saving) { await saving; return saveNow(); }
    unsaved = false;
    const body = JSON.stringify({ document: doc, version });
    saving = (async () => {
      try {
        const response = await fetch(saveUrl, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body, credentials: "same-origin" });
        const result = await response.json().catch(() => ({}));
        if (response.status === 409) {
          blocked = true;
          setStatus("Changed in another tab. Reload to see the latest.", "bad");
          return;
        }
        if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
        version = result.version;
        if (!unsaved) setStatus("Saved", "good");
      } catch (error) {
        unsaved = true;
        setStatus("Couldn't save. Trying again…", "bad");
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

  // ── drawing ──────────────────────────────────────────────────────────────
  function frameHtml(page, index) {
    const tools = `<div class="sheet-tools no-print">
      <span>Page ${index + 1}</span>
      <button type="button" data-page-action="up" ${index === 0 ? "disabled" : ""} title="Move page up">↑</button>
      <button type="button" data-page-action="down" ${index === doc.pages.length - 1 ? "disabled" : ""} title="Move page down">↓</button>
      <button type="button" data-page-action="duplicate">Duplicate</button>
      <button type="button" data-page-action="add">Add blank page</button>
      <button type="button" data-page-action="delete" class="danger">Delete page</button>
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

  function applyScale() {
    const available = stackEl.clientWidth - 8;
    scale = Math.min(1, Math.max(0.2, available / PAGE_W));
    stackEl.style.setProperty("--scale", scale);
  }
  window.addEventListener("resize", () => { applyScale(); drawSelection(); });

  function updateChecks() {
    const checks = [];
    let offPage = 0;
    doc.pages.forEach((page, pageIndex) => {
      page.elements.forEach((element) => {
        if (element.origin === "check") checks.push(element.id);
        const node = nodeFor(element.id);
        if (!node) return;
        const height = element.type === "text" ? node.offsetHeight : element.h;
        const off = element.x < -1 || element.y < -1 || element.x + element.w > PAGE_W + 1 || element.y + height > PAGE_H + 1;
        node.classList.toggle("off-page", off);
        if (off) offPage += 1;
      });
    });
    checkButton.hidden = !checks.length;
    checkButton.textContent = checks.length === 1 ? "1 to check" : `${checks.length} to check`;
    offPageEl.hidden = !offPage;
    offPageEl.textContent = offPage === 1 ? "1 box runs off the page" : `${offPage} boxes run off the page`;
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

  function updateFormatBar() {
    const found = selectedId && find(selectedId);
    formatBar.hidden = !found;
    if (!found) return;
    const { element } = found;
    const style = element.style || {};
    formatBar.dataset.type = element.type;
    formatBar.querySelectorAll("[data-for]").forEach((node) => {
      node.hidden = !node.dataset.for.split(" ").includes(element.type);
    });
    formatBar.querySelector("[name='font']").value = style.font || "body";
    formatBar.querySelector("[name='fontSize']").value = style.fontSize || 16;
    formatBar.querySelectorAll("[data-align]").forEach((node) => node.setAttribute("aria-pressed", String((style.align || "left") === node.dataset.align)));
    formatBar.querySelector("[data-action='uppercase']").setAttribute("aria-pressed", String(Boolean(style.uppercase)));
    formatBar.querySelector("[data-action='bold']").setAttribute("aria-pressed", String((style.fontWeight || 400) >= 600));
    formatBar.querySelector("[data-action='italic']").setAttribute("aria-pressed", String(Boolean(style.italic)));
    formatBar.querySelector("[data-action='fit']").textContent = element.fit === "cover" ? "Fit whole photo" : "Fill the box";
    const looksGood = formatBar.querySelector("[data-action='looks-good']");
    looksGood.hidden = element.origin !== "check";
    const note = formatBar.querySelector("[data-note]");
    note.hidden = !(element.origin === "check" && element.note);
    note.textContent = element.note || "";
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
    mutate(found.element, found);
    if (redraw) renderElement(id);
    scheduleSave();
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
    node.dataset.before = found.element.html;
    drawSelection();
    node.focus({ preventScroll: true });
    const range = point && (document.caretRangeFromPoint
      ? document.caretRangeFromPoint(point.x, point.y)
      : document.caretPositionFromPoint && (() => {
        const position = document.caretPositionFromPoint(point.x, point.y);
        if (!position) return null;
        const r = document.createRange();
        r.setStart(position.offsetNode, position.offset);
        return r;
      })());
    if (range && node.contains(range.startContainer)) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
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
    const markup = cleanMarkup(node);
    if (markup !== found.element.html) {
      remember();
      found.element.html = markup;
      if (found.element.origin !== "template") { found.element.origin = "edited"; delete found.element.note; }
      scheduleSave();
    }
    renderElement(id);
  }

  stackEl.addEventListener("input", (event) => {
    const node = event.target.closest && event.target.closest(".el.editing");
    if (!node) return;
    drawSelectionSize(node);
  });
  // Keep the selection outline around a box as it grows while typing, without redrawing the box.
  function drawSelectionSize(node) {
    const box = node.parentElement.querySelector(".selection");
    if (box) box.style.height = `${node.offsetHeight}px`;
  }

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
      moved: false, wasSelected, pointerId: event.pointerId,
    };
    // Captured on the page stack: the selection handles are redrawn while dragging.
    stackEl.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  stackEl.addEventListener("pointermove", (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = (event.clientX - gesture.startX) / scale;
    const dy = (event.clientY - gesture.startY) / scale;
    if (!gesture.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    if (!gesture.moved) { gesture.moved = true; remember(); }
    const found = find(gesture.id);
    if (!found) return;
    const element = found.element;
    const start = gesture.start;
    if (gesture.kind === "move") {
      element.x = Math.round(start.x + dx);
      element.y = Math.round(start.y + dy);
      snap(element, nodeFor(gesture.id), event.shiftKey);
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
  function snap(element, node, free) {
    if (free) return;
    const height = element.type === "text" ? node.offsetHeight : element.h;
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
    frames.forEach((frame, index) => {
      const rect = frame.getBoundingClientRect();
      if (rect.top < middle) best = index;
    });
    return best;
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
    nodeFor(element.id).scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function duplicateSelected() {
    const found = selectedId && find(selectedId);
    if (!found) return;
    finishEditing();
    remember();
    const copy = { ...clone(found.element), id: newId("c"), x: found.element.x + 16, y: found.element.y + 16 };
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
  }

  function pageAction(action, index) {
    finishEditing();
    const pages = doc.pages;
    if (action === "delete") {
      if (pages.length === 1) return;
      if (!window.confirm(`Delete page ${index + 1}? Undo brings it back.`)) return;
    }
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
  }

  function nextCheck() {
    const checks = updateChecks();
    if (!checks.length) return;
    const at = checks.indexOf(selectedId);
    const id = checks[(at + 1) % checks.length];
    select(id);
    nodeFor(id).scrollIntoView({ block: "center", behavior: "smooth" });
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
    await saveNow();
    window.print();
  }

  root.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-page-action]");
    if (pageButton) {
      pageAction(pageButton.dataset.pageAction, Number(pageButton.closest(".sheet-frame").dataset.index));
      return;
    }
    const button = event.target.closest("[data-action], [data-align]");
    if (!button || button.disabled) return;
    if (button.closest(".format-bar") && performance.now() - selectedAt < 450) return;
    const found = selectedId && find(selectedId);
    const style = (found && found.element.style) || {};
    if (button.dataset.align) { setStyle("align", button.dataset.align); return; }
    switch (button.dataset.action) {
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "add-text": addText(); break;
      case "next-check": nextCheck(); break;
      case "pdf": saveAsPdf(); break;
      case "review": root.classList.toggle("review", button.getAttribute("aria-pressed") !== "true");
        button.setAttribute("aria-pressed", String(root.classList.contains("review")));
        try { localStorage.setItem("guide-review", root.classList.contains("review") ? "1" : "0"); } catch (error) { /* private mode */ }
        break;
      case "bold":
        if (editingId) document.execCommand("bold");
        else setStyle("fontWeight", (style.fontWeight || 400) >= 600 ? 400 : 700);
        break;
      case "italic":
        if (editingId) document.execCommand("italic");
        else setStyle("italic", !style.italic);
        break;
      case "underline": if (editingId) document.execCommand("underline"); break;
      case "uppercase": setStyle("uppercase", !style.uppercase); break;
      case "smaller": setStyle("fontSize", Math.max(4, Math.round(((style.fontSize || 16) - 1) * 10) / 10)); break;
      case "bigger": setStyle("fontSize", Math.round(((style.fontSize || 16) + 1) * 10) / 10); break;
      case "fit": change(selectedId, (element) => { element.fit = element.fit === "cover" ? "contain" : "cover"; }); break;
      case "front": change(selectedId, (element, where) => { where.page.elements.splice(where.index, 1); where.page.elements.push(element); }, { redraw: false }); renderAll(); break;
      case "back": change(selectedId, (element, where) => { where.page.elements.splice(where.index, 1); where.page.elements.unshift(element); }, { redraw: false }); renderAll(); break;
      case "looks-good": change(selectedId, (element) => { element.origin = "edited"; delete element.note; }); break;
      case "duplicate": duplicateSelected(); break;
      case "delete": deleteSelected(); break;
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
  formatBar.querySelector("[name='wording']").addEventListener("change", (event) => {
    if (event.target.value !== "") chooseWording(Number(event.target.value));
  });

  document.addEventListener("keydown", (event) => {
    const mod = event.metaKey || event.ctrlKey;
    const inField = event.target.closest && event.target.closest("input, select, textarea");
    if (mod && event.key.toLowerCase() === "z" && !inField) {
      event.preventDefault();
      if (editingId) finishEditing();
      if (event.shiftKey) redo(); else undo();
      return;
    }
    if (mod && event.key.toLowerCase() === "y" && !inField) { event.preventDefault(); redo(); return; }
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
      change(selectedId, (element) => { element.x += move[0]; element.y += move[1]; });
    }
  });

  // Typing ends when she taps outside the page.
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".page-stack") && !event.target.closest(".format-bar") && !event.target.closest(".top-bar")) {
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

  // ── first layout of a new draft ──────────────────────────────────────────
  // The draft's text boxes were placed with a guess at their height. Now that
  // the fonts are loaded, stack each group (product descriptions, how-to steps)
  // under each other with its real height, shrink the words a little if a group
  // runs past the bottom of the page, and move what still doesn't fit to a new
  // page after it.
  function layoutFlows() {
    let changed = false;
    for (let pageIndex = 0; pageIndex < doc.pages.length; pageIndex += 1) {
      const page = doc.pages[pageIndex];
      for (const [name, flow] of Object.entries(page.flows || {})) {
        const boxes = page.elements.filter((element) => element.flow === name).sort((a, b) => a.y - b.y);
        if (!boxes.length) continue;
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
        changed = true;
        if (bottom <= flow.bottom) continue;
        // Still too long: carry the boxes that don't fit over to a new page.
        const overflow = [];
        for (const element of boxes) {
          const node = nodeFor(element.id);
          if (element !== boxes[0] && element.y + node.offsetHeight > flow.bottom) overflow.push(element);
        }
        if (!overflow.length) continue;
        page.elements = page.elements.filter((element) => !overflow.includes(element));
        const footer = page.elements.find((element) => element.role === "footer");
        overflow.forEach((element) => { element.x = 42; element.w = 700; });
        const next = {
          id: newId("p"), kind: page.kind, flows: { [name]: { ...flow, bottom: 1045 } },
          elements: [...overflow, ...(footer ? [{ ...clone(footer), id: newId("c") }] : [])],
        };
        overflow[0].y = 70;
        doc.pages.splice(pageIndex + 1, 0, next);
        renderAll();
      }
    }
    doc.needsLayout = false;
    renderAll();
    if (changed) { unsaved = true; saveNow(); }
  }

  const deleteForm = root.querySelector("form.delete-guide");
  if (deleteForm) {
    deleteForm.addEventListener("submit", (event) => {
      if (!window.confirm("Delete this guide? This can't be undone.")) { event.preventDefault(); return; }
      clearTimeout(saveTimer);
      blocked = true;
      unsaved = false;
    });
  }

  // ── start ────────────────────────────────────────────────────────────────
  try { if (localStorage.getItem("guide-review") === "0") root.classList.remove("review"); } catch (error) { /* private mode */ }
  root.querySelector("[data-action='review']").setAttribute("aria-pressed", String(root.classList.contains("review")));
  renderAll();
  setStatus("Saved", "good");
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => {
    if (doc.needsLayout) layoutFlows();
    else { updateChecks(); drawSelection(); }
  });
}

/** The editor script, with the drawing functions it shares with the server. */
export const GUIDE_EDITOR_JS = `(function () {
${guideElementHtml.toString()}
${guideSheetHtml.toString()}
(${editorMain.toString()})(${JSON.stringify(FONT_CSS)}, ${PAGE_WIDTH}, ${PAGE_HEIGHT}, guideElementHtml, guideSheetHtml);
})();
`;

export const GUIDE_EDITOR_VERSION = contentVersion(GUIDE_EDITOR_JS);
