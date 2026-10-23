// The iPad writing screen's script (/admin/clients/:id/write). Plain ES2020, no build step, no
// dependencies, like client.js.
//
// The Apple Pencil draws; a finger only scrolls, so a resting palm never leaves marks. A mouse
// draws too, so the screen can be tried on a computer. Strokes are kept as points (with pen
// pressure) rather than pixels, so undo and the eraser work on whole strokes.
//
// Every change is saved to IndexedDB on this iPad straight away, so a dropped connection or a
// closed app loses nothing. That copy is deleted once the note is saved to the dashboard.

import { contentVersion } from "./pwa.js";

export const NOTEBOOK_JS = String.raw`
(function () {
  "use strict";

  var root = document.getElementById("notebook");
  if (!root) return;

  var clientId = root.getAttribute("data-client-id");
  var clientName = root.getAttribute("data-client-name") || "";

  // The page in its own units. Canvases scale this to the screen.
  var PAGE_W = 820;
  var PAGE_H = 1160;
  var LINE_GAP = 34;
  var FIRST_LINE = 150;
  var SECTIONS = [
    { label: "Treatment type", y: 118 },
    { label: "Notes / remarks", y: 322 },
    { label: "Purchase history", y: 662 },
    { label: "Possible treatments", y: 866 },
  ];
  var HIGHLIGHT = "#E9C46A";
  var ERASE_RADIUS = 12;

  var state = {
    pages: [[]],          // one list of strokes per page
    tool: "pen",          // pen | highlighter | eraser
    color: "#2B3A55",
    fingerDraws: false,
    undo: [],
    redo: [],
    date: localToday(),
  };

  var scroller = document.getElementById("nb-scroll");
  var pagesBox = document.getElementById("nb-pages");
  var statusEl = document.getElementById("nb-status");
  var pageViews = [];

  function localToday() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  function prettyDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function setStatus(text, tone) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.setAttribute("data-tone", tone || "");
  }

  /* ------------------------------------------------------------ drawing */

  function drawTemplate(ctx, pageIndex) {
    ctx.fillStyle = "#FFFDF8";
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.strokeStyle = "#E9E1D6";
    ctx.lineWidth = 1;
    for (var y = FIRST_LINE; y < PAGE_H - 24; y += LINE_GAP) {
      ctx.beginPath();
      ctx.moveTo(40, y + 0.5);
      ctx.lineTo(PAGE_W - 40, y + 0.5);
      ctx.stroke();
    }
    ctx.textBaseline = "alphabetic";
    if (pageIndex === 0) {
      ctx.fillStyle = "#2A241F";
      ctx.font = "600 24px Fraunces, Georgia, serif";
      ctx.textAlign = "left";
      ctx.fillText(clientName, 56, 70);
      ctx.fillStyle = "#6E6358";
      ctx.font = "500 14px 'Work Sans', system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(prettyDate(state.date), PAGE_W - 56, 70);
      ctx.textAlign = "left";
      SECTIONS.forEach(function (section) {
        ctx.font = "600 12px 'Work Sans', system-ui, sans-serif";
        var label = section.label.toUpperCase();
        var width = ctx.measureText(label).width;
        ctx.fillStyle = "#FFFDF8";
        ctx.fillRect(50, section.y - 14, width + 14, 20);
        ctx.fillStyle = "#8E5236";
        ctx.fillText(label, 56, section.y);
      });
    } else {
      ctx.fillStyle = "#6E6358";
      ctx.font = "500 14px 'Work Sans', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(clientName + " · continued, page " + (pageIndex + 1), 56, 70);
    }
  }

  function midpoint(a, b) {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }

  function drawStroke(ctx, stroke) {
    var points = stroke.points;
    if (!points.length) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (stroke.tool === "highlighter") {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = HIGHLIGHT;
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (var h = 1; h < points.length; h += 1) ctx.lineTo(points[h][0], points[h][1]);
      if (points.length === 1) ctx.lineTo(points[0][0] + 0.1, points[0][1]);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0][0], points[0][1], widthFor(points[0][2]) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    // Short curved segments through the midpoints, each as wide as the pen pressure there.
    var from = points[0];
    for (var i = 1; i < points.length; i += 1) {
      var to = i < points.length - 1 ? midpoint(points[i], points[i + 1]) : points[i];
      ctx.beginPath();
      ctx.lineWidth = widthFor(points[i][2]);
      ctx.moveTo(from[0], from[1]);
      ctx.quadraticCurveTo(points[i][0], points[i][1], to[0], to[1]);
      ctx.stroke();
      from = to;
    }
    ctx.restore();
  }

  function widthFor(pressure) {
    var p = pressure > 0 ? pressure : 0.5;
    return 1.1 + p * 2.6;
  }

  function renderPage(index) {
    var view = pageViews[index];
    if (!view) return;
    var ctx = view.committed.getContext("2d");
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    drawTemplate(ctx, index);
    state.pages[index].forEach(function (stroke) { drawStroke(ctx, stroke); });
    paintPage(index, null);
  }

  function paintPage(index, liveStroke) {
    var view = pageViews[index];
    var ctx = view.canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(view.committed, 0, 0);
    if (liveStroke) {
      ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
      drawStroke(ctx, liveStroke);
    }
  }

  function sizePage(index) {
    var view = pageViews[index];
    var cssWidth = Math.min(PAGE_W, scroller.clientWidth - 32);
    var cssHeight = cssWidth * PAGE_H / PAGE_W;
    var dpr = window.devicePixelRatio || 1;
    view.canvas.style.width = cssWidth + "px";
    view.canvas.style.height = cssHeight + "px";
    view.canvas.width = Math.round(cssWidth * dpr);
    view.canvas.height = Math.round(cssHeight * dpr);
    view.committed.width = view.canvas.width;
    view.committed.height = view.canvas.height;
    view.scale = view.canvas.width / PAGE_W;
    renderPage(index);
  }

  function addPageView(index) {
    var wrap = document.createElement("div");
    wrap.className = "nb-page";
    var canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Note page " + (index + 1) + ". Write with Apple Pencil.");
    wrap.appendChild(canvas);
    pagesBox.appendChild(wrap);
    var view = { canvas: canvas, committed: document.createElement("canvas"), scale: 1 };
    pageViews[index] = view;
    wirePointer(canvas, index);
    sizePage(index);
  }

  function buildPages() {
    pagesBox.innerHTML = "";
    pageViews = [];
    state.pages.forEach(function (_, index) { addPageView(index); });
  }

  /* -------------------------------------------------------------- input */

  var penDown = false;

  function toPage(canvas, event) {
    var rect = canvas.getBoundingClientRect();
    return [
      (event.clientX - rect.left) * PAGE_W / rect.width,
      (event.clientY - rect.top) * PAGE_H / rect.height,
      event.pointerType === "pen" ? event.pressure : 0.5,
    ];
  }

  function eraseAt(index, point, erased) {
    var strokes = state.pages[index];
    for (var s = strokes.length - 1; s >= 0; s -= 1) {
      var hit = strokes[s].points.some(function (p) {
        var dx = p[0] - point[0];
        var dy = p[1] - point[1];
        return dx * dx + dy * dy <= ERASE_RADIUS * ERASE_RADIUS;
      });
      if (hit) {
        erased.push({ stroke: strokes[s], at: s });
        strokes.splice(s, 1);
      }
    }
  }

  function wirePointer(canvas, index) {
    var live = null;
    var erased = null;
    var pan = null;

    canvas.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "touch" && !state.fingerDraws) {
        // A finger scrolls the pages. While the Pencil is down a touch is a resting palm: ignore it.
        if (!penDown) pan = { id: event.pointerId, y: event.clientY };
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* a pointer that has already lifted */ }
      if (event.pointerType === "pen") penDown = true;
      var point = toPage(canvas, event);
      if (state.tool === "eraser") {
        erased = [];
        eraseAt(index, point, erased);
        if (erased.length) renderPage(index);
        return;
      }
      live = { tool: state.tool, color: state.color, points: [point] };
      paintPage(index, live);
    });

    canvas.addEventListener("pointermove", function (event) {
      if (pan && event.pointerId === pan.id) {
        scroller.scrollTop -= event.clientY - pan.y;
        pan.y = event.clientY;
        return;
      }
      if (!live && !erased) return;
      var events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
      if (!events.length) events = [event];
      if (erased) {
        var before = erased.length;
        events.forEach(function (e) { eraseAt(index, toPage(canvas, e), erased); });
        if (erased.length !== before) renderPage(index);
        return;
      }
      events.forEach(function (e) { live.points.push(toPage(canvas, e)); });
      paintPage(index, live);
    });

    function finish(event) {
      if (pan && event.pointerId === pan.id) { pan = null; return; }
      if (event.pointerType === "pen") penDown = false;
      if (erased) {
        if (erased.length) record({ type: "erase", page: index, strokes: erased });
        erased = null;
        return;
      }
      if (!live) return;
      state.pages[index].push(live);
      record({ type: "add", page: index, stroke: live });
      live = null;
      renderPage(index);
    }
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
  }

  /* ------------------------------------------------------- undo and redo */

  function record(action) {
    state.undo.push(action);
    if (state.undo.length > 300) state.undo.shift();
    state.redo = [];
    changed();
  }

  function applyUndo(action) {
    var strokes = state.pages[action.page];
    if (action.type === "add") {
      var at = strokes.lastIndexOf(action.stroke);
      if (at !== -1) strokes.splice(at, 1);
    } else {
      action.strokes.slice().reverse().forEach(function (item) { strokes.splice(item.at, 0, item.stroke); });
    }
    renderPage(action.page);
  }

  function applyRedo(action) {
    var strokes = state.pages[action.page];
    if (action.type === "add") {
      strokes.push(action.stroke);
    } else {
      action.strokes.forEach(function (item) {
        var at = strokes.indexOf(item.stroke);
        if (at !== -1) strokes.splice(at, 1);
      });
    }
    renderPage(action.page);
  }

  function updateUndoButtons() {
    var undoBtn = document.getElementById("nb-undo");
    var redoBtn = document.getElementById("nb-redo");
    if (undoBtn) undoBtn.disabled = !state.undo.length;
    if (redoBtn) redoBtn.disabled = !state.redo.length;
  }

  /* ------------------------------------------------- saved on this iPad */

  var DB_NAME = "laura-notes";
  var STORE = "drafts";
  var saveTimer = null;

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("no IndexedDB")); return; }
      var request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () { request.result.createObjectStore(STORE, { keyPath: "clientId" }); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function withStore(mode, work) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var result = work(tx.objectStore(STORE));
        tx.oncomplete = function () { db.close(); resolve(result && result.result); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    });
  }

  function hasInk() {
    return state.pages.some(function (strokes) { return strokes.length > 0; });
  }

  function saveLocal() {
    var record = { clientId: clientId, date: state.date, pages: state.pages, updatedAt: Date.now() };
    return withStore("readwrite", function (store) {
      return hasInk() ? store.put(record) : store.delete(clientId);
    }).then(function () {
      setStatus(hasInk() ? "Saved on this iPad" : "", "good");
    }).catch(function () {
      setStatus("Couldn't save on this iPad. Tap Done soon.", "warn");
    });
  }

  function changed() {
    updateUndoButtons();
    setStatus("Saving…", "");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveLocal, 400);
  }

  function loadLocal() {
    return withStore("readonly", function (store) { return store.get(clientId); }).catch(function () { return null; });
  }

  function clearLocal() {
    return withStore("readwrite", function (store) { return store.delete(clientId); }).catch(function () {});
  }

  /* --------------------------------------------------------------- tools */

  function pickTool(tool) {
    state.tool = tool;
    document.querySelectorAll("[data-tool]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-tool") === tool));
    });
  }

  function pickColor(color) {
    state.color = color;
    if (state.tool !== "pen") pickTool("pen");
    document.querySelectorAll("[data-color]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-color") === color));
    });
  }

  document.querySelectorAll("[data-tool]").forEach(function (button) {
    button.addEventListener("click", function () { pickTool(button.getAttribute("data-tool")); });
  });
  document.querySelectorAll("[data-color]").forEach(function (button) {
    button.addEventListener("click", function () { pickColor(button.getAttribute("data-color")); });
  });

  document.getElementById("nb-undo").addEventListener("click", function () {
    var action = state.undo.pop();
    if (!action) return;
    applyUndo(action);
    state.redo.push(action);
    updateUndoButtons();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveLocal, 400);
  });
  document.getElementById("nb-redo").addEventListener("click", function () {
    var action = state.redo.pop();
    if (!action) return;
    applyRedo(action);
    state.undo.push(action);
    updateUndoButtons();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveLocal, 400);
  });

  var fingerBtn = document.getElementById("nb-finger");
  fingerBtn.addEventListener("click", function () {
    state.fingerDraws = !state.fingerDraws;
    fingerBtn.setAttribute("aria-pressed", String(state.fingerDraws));
  });

  document.getElementById("nb-add-page").addEventListener("click", function () {
    state.pages.push([]);
    addPageView(state.pages.length - 1);
    pageViews[state.pages.length - 1].canvas.scrollIntoView({ behavior: "smooth", block: "start" });
    changed();
  });

  var lastToggle = document.getElementById("nb-last-toggle");
  if (lastToggle) {
    var setLastOpen = function (open) {
      lastToggle.setAttribute("aria-expanded", String(open));
      document.getElementById("nb-last-body").hidden = !open;
    };
    lastToggle.addEventListener("click", function () {
      setLastOpen(lastToggle.getAttribute("aria-expanded") !== "true");
    });
    // Upright, the page fills the width and the card would cover it, so it starts folded.
    if (window.innerWidth < 1100) setLastOpen(false);
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { pageViews.forEach(function (_, index) { sizePage(index); }); }, 150);
  });

  /* ------------------------------------------------------ done and review */

  var review = document.getElementById("nb-review");
  var busy = document.getElementById("nb-busy");
  var reviewError = document.getElementById("nb-review-error");
  var currentDraft = null;
  var previewUrls = [];

  function exportPage(index) {
    var scale = 1.5; // 1230 x 1740: sharp enough to read, small enough to send quickly
    var canvas = document.createElement("canvas");
    canvas.width = PAGE_W * scale;
    canvas.height = PAGE_H * scale;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawTemplate(ctx, index);
    state.pages[index].forEach(function (stroke) { drawStroke(ctx, stroke); });
    return new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
  }

  function pagesToSend() {
    // Always the first page; later pages only if something is written on them.
    return state.pages.map(function (strokes, index) { return index === 0 || strokes.length ? index : -1; })
      .filter(function (index) { return index !== -1; });
  }

  function showBusy(on) {
    busy.hidden = !on;
  }

  function done() {
    if (!hasInk()) {
      setStatus("Write something first.", "warn");
      return;
    }
    clearTimeout(saveTimer);
    saveLocal();
    showBusy(true);
    var indexes = pagesToSend();
    Promise.all(indexes.map(exportPage)).then(function (blobs) {
      var form = new FormData();
      blobs.forEach(function (blob, i) { form.append("page", blob, "page-" + (i + 1) + ".png"); });
      form.append("strokes", JSON.stringify({ v: 1, width: PAGE_W, height: PAGE_H, pages: indexes.map(function (index) { return state.pages[index]; }) }));
      form.append("date", state.date);
      return fetch("/admin/clients/" + encodeURIComponent(clientId) + "/ink", { method: "POST", body: form, credentials: "same-origin" })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (body) { return { response: response, body: body }; });
        })
        .then(function (result) {
          showBusy(false);
          if (result.response.status === 401) {
            setStatus("You've been signed out. Log in again; this note is safe on this iPad.", "warn");
            return;
          }
          if (!result.response.ok) {
            setStatus(result.body.message || "Couldn't send it. It's safe on this iPad; try Done again.", "warn");
            return;
          }
          openReview(result.body, blobs);
        });
    }).catch(function () {
      showBusy(false);
      setStatus("No connection. The note is safe on this iPad; tap Done when you're back online.", "warn");
    });
  }

  function openReview(draft, blobs) {
    currentDraft = draft;
    previewUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    previewUrls = blobs.map(function (blob) { return URL.createObjectURL(blob); });
    var preview = document.getElementById("nb-preview");
    preview.innerHTML = "";
    previewUrls.forEach(function (url, i) {
      var img = document.createElement("img");
      img.src = url;
      img.alt = "Your handwriting, page " + (i + 1);
      preview.appendChild(img);
    });

    var reading = draft.reading || {};
    var fields = reading.fields || {};
    document.querySelectorAll("[data-field]").forEach(function (input) {
      input.value = fields[input.getAttribute("data-field")] || "";
    });
    document.getElementById("nb-date").value = state.date;

    var notices = document.getElementById("nb-unclear");
    notices.innerHTML = "";
    var items = (reading.unclear || []).slice();
    if (draft.readFailed) items.unshift(draft.message || "The handwriting couldn't be read just now. Type the key points, or save it as it is.");
    items.forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      notices.appendChild(li);
    });
    notices.hidden = !items.length;
    reviewError.textContent = "";
    review.hidden = false;
    var first = document.querySelector("[data-field]");
    if (first) first.focus({ preventScroll: true });
  }

  function closeReview() {
    review.hidden = true;
  }

  function saveToDashboard() {
    if (!currentDraft) return;
    var saveButtons = document.querySelectorAll("[data-save]");
    function saving(on) {
      saveButtons.forEach(function (button) {
        button.disabled = on;
        button.textContent = on ? "Saving…" : "Save to dashboard";
      });
    }
    var fields = {};
    document.querySelectorAll("[data-field]").forEach(function (input) { fields[input.getAttribute("data-field")] = input.value; });
    var date = document.getElementById("nb-date").value;
    saving(true);
    reviewError.textContent = "";
    fetch("/admin/clients/" + encodeURIComponent(clientId) + "/ink/" + encodeURIComponent(currentDraft.draftId) + "/save", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: date, fields: fields }),
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.message || "Couldn't save it. Try again.");
        return clearLocal().then(function () { window.location.href = body.redirect || "/admin/clients/" + clientId; });
      });
    }).catch(function (error) {
      saving(false);
      reviewError.textContent = error && error.message && error.message !== "Failed to fetch" && error.message !== "Load failed"
        ? error.message
        : "No connection. The note is still safe on this iPad; try again when you're back online.";
    });
  }

  document.getElementById("nb-done").addEventListener("click", done);
  document.getElementById("nb-keep-writing").addEventListener("click", closeReview);
  document.getElementById("nb-keep-writing-top").addEventListener("click", closeReview);
  document.querySelectorAll("[data-save]").forEach(function (button) { button.addEventListener("click", saveToDashboard); });
  document.getElementById("nb-date").addEventListener("change", function (event) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) {
      state.date = event.target.value;
      renderPage(0);
      changed();
    }
  });

  /* ---------------------------------------------------- start or resume */

  var banner = document.getElementById("nb-restored");
  var startOver = document.getElementById("nb-start-over");
  var startOverArmed = false;
  startOver.addEventListener("click", function () {
    // Two taps, so a stray touch can't throw a note away.
    if (!startOverArmed) {
      startOverArmed = true;
      startOver.textContent = "Tap again to clear it";
      return;
    }
    state.pages = [[]];
    state.undo = [];
    state.redo = [];
    state.date = localToday();
    buildPages();
    banner.hidden = true;
    changed();
  });

  function begin(saved) {
    if (saved && Array.isArray(saved.pages) && saved.pages.some(function (strokes) { return strokes.length; })) {
      state.pages = saved.pages;
      if (/^\d{4}-\d{2}-\d{2}$/.test(saved.date || "")) state.date = saved.date;
      var when = new Date(saved.updatedAt || Date.now());
      document.getElementById("nb-restored-when").textContent = when.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      banner.hidden = false;
      setStatus("Saved on this iPad", "good");
    }
    buildPages();
    updateUndoButtons();
  }

  loadLocal().then(begin);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { pageViews.forEach(function (_, index) { renderPage(index); }); });
  }
})();
`;

/** The script's version: changes whenever the script does, so it can be cached for a year. */
export const NOTEBOOK_VERSION = contentVersion(NOTEBOOK_JS);
