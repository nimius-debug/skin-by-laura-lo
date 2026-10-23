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
  // Set when an earlier iPad note is opened to be changed.
  var noteId = root.getAttribute("data-note-id") || "";
  var noteDate = root.getAttribute("data-note-date") || "";
  // The key this note's unsent copy is kept under on the iPad: one per client, or per note being changed.
  var draftKey = noteId ? clientId + ":" + noteId : clientId;

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
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 2.5;
  // Canvas pixels per page unit at most. Higher zoom is drawn slightly soft rather than risk
  // the large canvases iPad Safari refuses to keep in memory.
  var MAX_BACKING = 2.5;
  // Pages away from the screen are kept this coarse, so a long note doesn't use up Safari's
  // canvas memory. They are re-drawn sharp as they scroll near.
  var FAR_BACKING = 0.4;
  // The server takes up to 12 pages a note.
  var MAX_PAGES = 12;
  // Upright, the page grows to fill a big iPad; on its side it stays the width of a sheet, so
  // more of it fits on the screen.
  var MAX_PAGE_UPRIGHT = 1000;
  // Pen sizes: a multiplier on the pressure-based width.
  var PEN_SIZES = [{ name: "Fine", scale: 0.7 }, { name: "Medium", scale: 1 }, { name: "Bold", scale: 1.6 }];
  // A touch this wide is a resting hand, not a fingertip.
  var PALM_RADIUS = 30;

  var state = {
    pages: [[]],          // one list of strokes per page
    tool: "pen",          // pen | highlighter | eraser
    color: "#2B3A55",
    fingerDraws: false,
    size: 1,              // index into PEN_SIZES
    undo: [],
    redo: [],
    date: /^\d{4}-\d{2}-\d{2}$/.test(noteDate) ? noteDate : localToday(),
    zoom: 1,
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

  function setStatus(text, tone, link) {
    if (!statusEl) return;
    statusEl.textContent = text;
    if (link) {
      var a = document.createElement("a");
      a.href = link.href;
      a.textContent = link.label;
      statusEl.appendChild(document.createTextNode(" "));
      statusEl.appendChild(a);
    }
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
      ctx.arc(points[0][0], points[0][1], widthFor(points[0][2], stroke.size) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    // Short curved segments through the midpoints, each as wide as the pen pressure there.
    var from = points[0];
    for (var i = 1; i < points.length; i += 1) {
      var to = i < points.length - 1 ? midpoint(points[i], points[i + 1]) : points[i];
      ctx.beginPath();
      ctx.lineWidth = widthFor(points[i][2], stroke.size);
      ctx.moveTo(from[0], from[1]);
      ctx.quadraticCurveTo(points[i][0], points[i][1], to[0], to[1]);
      ctx.stroke();
      from = to;
    }
    ctx.restore();
  }

  function widthFor(pressure, size) {
    var p = pressure > 0 ? pressure : 0.5;
    return (1.1 + p * 2.6) * (size > 0 ? size : 1);
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
    var cssWidth = baseWidth() * state.zoom;
    var cssHeight = cssWidth * PAGE_H / PAGE_W;
    var dpr = window.devicePixelRatio || 1;
    var backing = view.near ? Math.min(cssWidth * dpr / PAGE_W, MAX_BACKING) : FAR_BACKING;
    view.canvas.style.width = cssWidth + "px";
    if (index === 0) scroller.style.setProperty("--page-w", cssWidth + "px");
    view.canvas.style.height = cssHeight + "px";
    view.canvas.width = Math.round(PAGE_W * backing);
    view.canvas.height = Math.round(PAGE_H * backing);
    view.committed.width = view.canvas.width;
    view.committed.height = view.canvas.height;
    view.scale = view.canvas.width / PAGE_W;
    renderPage(index);
  }

  function baseWidth() {
    var upright = window.innerHeight >= window.innerWidth;
    return Math.max(200, Math.min(upright ? MAX_PAGE_UPRIGHT : PAGE_W, scroller.clientWidth - 32));
  }

  function addPageView(index) {
    var wrap = document.createElement("div");
    wrap.className = "nb-page";
    var canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Note page " + (index + 1) + ". Write with Apple Pencil.");
    wrap.appendChild(canvas);
    pagesBox.appendChild(wrap);
    // Until the observer says otherwise, the first pages and a newly added one are on screen.
    var view = { canvas: canvas, committed: document.createElement("canvas"), scale: 1, near: !nearWatch || index < 2 || index === state.pages.length - 1 };
    pageViews[index] = view;
    wirePointer(canvas, index);
    sizePage(index);
    if (nearWatch) nearWatch.observe(wrap);
    updatePageButton();
  }

  // Which pages are on or near the screen, so only those are drawn at full sharpness.
  var nearWatch = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var index = Array.prototype.indexOf.call(pagesBox.children, entry.target);
      var view = pageViews[index];
      if (!view || view.near === entry.isIntersecting) return;
      view.near = entry.isIntersecting;
      sizePage(index);
    });
  }, { root: scroller, rootMargin: "100% 0px" }) : null;

  function buildPages() {
    if (nearWatch) nearWatch.disconnect();
    pagesBox.innerHTML = "";
    pageViews = [];
    state.pages.forEach(function (_, index) { addPageView(index); });
    updatePageButton();
  }

  function updatePageButton() {
    var button = document.getElementById("nb-add-page");
    if (!button) return;
    var full = state.pages.length >= MAX_PAGES;
    button.disabled = full;
    var label = document.getElementById("nb-add-page-label");
    if (label) label.textContent = full ? "A note can have up to " + MAX_PAGES + " pages" : "Add a page";
    updatePageCount();
  }

  // "Page 2 of 3", for the page in the middle of the screen. Hidden while there is one page.
  var pageCount = document.getElementById("nb-page-count");
  function updatePageCount() {
    if (!pageCount) return;
    if (pageViews.length < 2) { pageCount.hidden = true; return; }
    var box = scroller.getBoundingClientRect();
    var middle = box.top + box.height / 2;
    var current = 0;
    pageViews.forEach(function (view, index) {
      if (view.canvas.getBoundingClientRect().top <= middle) current = index;
    });
    pageCount.textContent = "Page " + (current + 1) + " of " + pageViews.length;
    pageCount.hidden = false;
  }
  var countFrame = 0;
  scroller.addEventListener("scroll", function () {
    if (countFrame) return;
    countFrame = requestAnimationFrame(function () { countFrame = 0; updatePageCount(); });
  }, { passive: true });

  /* -------------------------------------------------------------- input */

  var penDown = false;
  // While changing a saved note whose handwriting hasn't loaded, nothing can be written, so
  // Done can never replace her pages with a blank one.
  var locked = false;
  // Takes back the stroke a finger is drawing, while one is.
  var touchStroke = null;

  function toPage(canvas, event) {
    var rect = canvas.getBoundingClientRect();
    // A tenth of a page unit and a hundredth of pressure are finer than anyone can see, and keep
    // a long note's strokes about a third of the size.
    return [
      Math.round((event.clientX - rect.left) * PAGE_W / rect.width * 10) / 10,
      Math.round((event.clientY - rect.top) * PAGE_H / rect.height * 10) / 10,
      event.pointerType === "pen" ? Math.round(event.pressure * 100) / 100 : 0.5,
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

    // Safari scrolls the page for any touch, the Pencil included. Stop it for the Pencil, for a
    // resting palm, and for anything while the Pencil is down; a fingertip scrolls (with momentum).
    function holdStill(event) {
      if (event.touches.length !== 1) return;
      var touch = event.touches[0];
      if (touch.touchType === "stylus" || penDown || state.fingerDraws || touch.radiusX > PALM_RADIUS) event.preventDefault();
    }
    canvas.addEventListener("touchstart", holdStill, { passive: false });
    canvas.addEventListener("touchmove", holdStill, { passive: false });

    // A second finger means a pinch or a two-finger tap, not writing: take back what the first one drew.
    function cancelTouch() {
      if (erased) {
        erased.slice().reverse().forEach(function (item) { state.pages[index].splice(item.at, 0, item.stroke); });
        erased = null;
        renderPage(index);
      } else if (live) {
        live = null;
        paintPage(index, null);
      }
      touchStroke = null;
    }

    canvas.addEventListener("pointerdown", function (event) {
      if (locked) return;
      if (event.pointerType === "touch" && !event.isPrimary) {
        if (touchStroke) touchStroke();
        return;
      }
      if (event.pointerType === "touch" && (!state.fingerDraws || event.width > PALM_RADIUS * 2)) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* a pointer that has already lifted */ }
      if (event.pointerType === "pen") penDown = true;
      touchStroke = event.pointerType === "touch" ? cancelTouch : null;
      var point = toPage(canvas, event);
      if (state.tool === "eraser") {
        erased = [];
        eraseAt(index, point, erased);
        if (erased.length) renderPage(index);
        return;
      }
      live = { tool: state.tool, color: state.color, size: PEN_SIZES[state.size].scale, points: [point] };
      paintPage(index, live);
    });

    canvas.addEventListener("pointermove", function (event) {
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
      if (event.pointerType === "pen") penDown = false;
      if (event.pointerType === "touch") {
        if (!event.isPrimary) return;
        touchStroke = null;
      }
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
    var record = { clientId: draftKey, clientName: clientName, noteId: noteId || null, date: state.date, pages: state.pages, updatedAt: Date.now() };
    return withStore("readwrite", function (store) {
      return hasInk() ? store.put(record) : store.delete(draftKey);
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
    return withStore("readonly", function (store) { return store.get(draftKey); }).catch(function () { return null; });
  }

  function clearLocal() {
    return withStore("readwrite", function (store) { return store.delete(draftKey); }).catch(function () {});
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

  function undo() {
    var action = state.undo.pop();
    if (!action) return false;
    applyUndo(action);
    state.redo.push(action);
    updateUndoButtons();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveLocal, 400);
    return true;
  }
  function redo() {
    var action = state.redo.pop();
    if (!action) return false;
    applyRedo(action);
    state.undo.push(action);
    updateUndoButtons();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveLocal, 400);
    return true;
  }
  document.getElementById("nb-undo").addEventListener("click", undo);
  document.getElementById("nb-redo").addEventListener("click", redo);

  // Pen size cycles Fine, Medium, Bold, and is remembered on this iPad.
  var sizeBtn = document.getElementById("nb-size");
  function pickSize(size) {
    state.size = size;
    if (!sizeBtn) return;
    sizeBtn.setAttribute("aria-label", "Pen size: " + PEN_SIZES[size].name);
    sizeBtn.setAttribute("data-size", String(size));
  }
  try {
    var savedSize = localStorage.getItem("nb-pen-size");
    if (savedSize !== null && Number(savedSize) >= 0 && Number(savedSize) < PEN_SIZES.length) pickSize(Number(savedSize));
  } catch (error) { /* private window */ }
  if (sizeBtn) {
    sizeBtn.addEventListener("click", function () {
      pickSize((state.size + 1) % PEN_SIZES.length);
      if (state.tool !== "pen") pickTool("pen");
      setStatus("Pen: " + PEN_SIZES[state.size].name.toLowerCase(), "");
      try { localStorage.setItem("nb-pen-size", String(state.size)); } catch (error) { /* private window */ }
    });
  }

  var fingerBtn = document.getElementById("nb-finger");
  fingerBtn.addEventListener("click", function () {
    state.fingerDraws = !state.fingerDraws;
    fingerBtn.setAttribute("aria-pressed", String(state.fingerDraws));
  });

  document.getElementById("nb-add-page").addEventListener("click", function () {
    if (locked || state.pages.length >= MAX_PAGES) return;
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
      lastToggle.parentNode.setAttribute("data-open", String(open));
    };
    lastToggle.addEventListener("click", function () {
      setLastOpen(lastToggle.getAttribute("aria-expanded") !== "true");
    });
    // Open only where it fits beside the page; otherwise it would cover her writing, so it starts folded.
    var lastCard = lastToggle.parentNode;
    var placeLast = function () {
      var margin = (scroller.clientWidth - baseWidth()) / 2;
      var fits = margin >= 230;
      // Beside the page it takes the margin's width, so it never reaches over the lines.
      lastCard.style.width = fits ? Math.min(280, Math.floor(margin - 28)) + "px" : "";
      setLastOpen(fits);
    };
    placeLast();
    var lastWide = window.innerWidth > window.innerHeight;
    window.addEventListener("resize", function () {
      var wide = window.innerWidth > window.innerHeight;
      if (wide !== lastWide) { lastWide = wide; placeLast(); }
    });
  }

  /* ---------------------------------------------------------------- zoom */

  var zoomLabel = document.getElementById("nb-zoom-reset");

  // Zoom to the given level, keeping the point under (x, y) on screen where it is. Pages are re-drawn at
  // the new size, so writing stays sharp.
  function setZoom(zoom, x, y) {
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 100) / 100));
    var box = scroller.getBoundingClientRect();
    var ax = x === undefined ? box.width / 2 : x - box.left;
    var ay = y === undefined ? box.height / 2 : y - box.top;
    var ratio = zoom / state.zoom;
    var left = (scroller.scrollLeft + ax) * ratio - ax;
    var top = (scroller.scrollTop + ay) * ratio - ay;
    state.zoom = zoom;
    pageViews.forEach(function (_, index) { sizePage(index); });
    scroller.scrollLeft = left;
    scroller.scrollTop = top;
    zoomLabel.textContent = Math.round(zoom * 100) + "%";
    document.getElementById("nb-zoom-out").disabled = zoom <= MIN_ZOOM;
    document.getElementById("nb-zoom-in").disabled = zoom >= MAX_ZOOM;
  }

  document.getElementById("nb-zoom-in").addEventListener("click", function () { setZoom(state.zoom + 0.25); });
  document.getElementById("nb-zoom-out").addEventListener("click", function () { setZoom(state.zoom - 0.25); });
  zoomLabel.addEventListener("click", function () { setZoom(1); });

  // Two fingers pinch the pages, not the whole app. While pinching the pages are just stretched
  // (cheap), then re-drawn at the new size when the fingers lift.
  var pinch = null;
  // A quick tap with two fingers undoes, with three redoes, as in Noteful and GoodNotes.
  var tap = null;
  function fingerGap(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  scroller.addEventListener("touchstart", function (event) {
    if (penDown) { tap = null; return; }
    if (event.touches.length === 1) {
      tap = { fingers: 1, at: Date.now(), x: event.touches[0].clientX, y: event.touches[0].clientY, top: scroller.scrollTop, moved: false };
    } else if (tap) {
      tap.fingers = Math.max(tap.fingers, event.touches.length);
      if (Date.now() - tap.at > 250) tap = null;
    }
    if (event.touches.length !== 2) return;
    var x = (event.touches[0].clientX + event.touches[1].clientX) / 2;
    var y = (event.touches[0].clientY + event.touches[1].clientY) / 2;
    var box = pagesBox.getBoundingClientRect();
    pinch = { gap: fingerGap(event.touches) || 1, x: x, y: y, ratio: 1 };
    pagesBox.style.transformOrigin = (x - box.left) + "px " + (y - box.top) + "px";
  }, { passive: true });
  scroller.addEventListener("touchmove", function (event) {
    if (tap && !tap.moved) {
      var t = event.touches[0];
      if (Math.abs(t.clientX - tap.x) > 12 || Math.abs(t.clientY - tap.y) > 12) tap.moved = true;
    }
    if (!pinch || event.touches.length !== 2) return;
    event.preventDefault();
    var target = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom * fingerGap(event.touches) / pinch.gap));
    pinch.ratio = target / state.zoom;
    if (tap && Math.abs(pinch.ratio - 1) > 0.01) tap.moved = true;
    pagesBox.style.transform = "scale(" + pinch.ratio + ")";
  }, { passive: false });
  function endTap(event) {
    if (!tap || event.touches.length) return;
    var done = tap;
    tap = null;
    if (done.fingers < 2 || done.moved || Date.now() - done.at > 300 || Math.abs(scroller.scrollTop - done.top) > 4) return;
    if (done.fingers === 2 && undo()) setStatus("Undone", "");
    else if (done.fingers === 3 && redo()) setStatus("Redone", "");
  }
  scroller.addEventListener("touchend", endTap);
  scroller.addEventListener("touchcancel", function () { tap = null; });
  function endPinch(event) {
    if (!pinch || event.touches.length >= 2) return;
    var done = pinch;
    pinch = null;
    pagesBox.style.transform = "";
    if (Math.abs(done.ratio - 1) > 0.01) setZoom(state.zoom * done.ratio, done.x, done.y);
  }
  scroller.addEventListener("touchend", endPinch);
  scroller.addEventListener("touchcancel", endPinch);
  // Safari's own pinch would zoom the toolbar and header too.
  document.addEventListener("gesturestart", function (event) { event.preventDefault(); });

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { pageViews.forEach(function (_, index) { sizePage(index); }); updatePageCount(); }, 150);
  });

  /* ------------------------------------------------------ done and review */

  var review = document.getElementById("nb-review");
  var busy = document.getElementById("nb-busy");
  var reviewError = document.getElementById("nb-review-error");
  var currentDraft = null;
  var previewUrls = [];
  // Sections she has typed in on the review. A later Done keeps her words rather than a new reading.
  var typed = {};
  document.querySelectorAll("[data-field]").forEach(function (input) {
    input.addEventListener("input", function () { typed[input.getAttribute("data-field")] = true; });
  });

  function exportPage(index) {
    var scale = 1.5; // 1230 x 1740: sharp enough to read, small enough to send quickly
    var canvas = document.createElement("canvas");
    canvas.width = PAGE_W * scale;
    canvas.height = PAGE_H * scale;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawTemplate(ctx, index);
    state.pages[index].forEach(function (stroke) { drawStroke(ctx, stroke); });
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        // Safari holds canvas memory until it's shrunk.
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob);
      }, "image/png");
    });
  }

  function pagesToSend() {
    // Always the first page; later pages only if something is written on them.
    return state.pages.map(function (strokes, index) { return index === 0 || strokes.length ? index : -1; })
      .filter(function (index) { return index !== -1; });
  }

  function showBusy(on) {
    busy.hidden = !on;
  }

  var sending = false;
  // How long the iPad waits for the reading before giving up (the server stops at 45 seconds).
  var SEND_TIMEOUT_MS = 90000;

  function done() {
    if (sending) return;
    if (locked) {
      openSaved();
      return;
    }
    if (!hasInk()) {
      setStatus("Write something first.", "warn");
      return;
    }
    clearTimeout(saveTimer);
    saveLocal();
    sending = true;
    showBusy(true);
    var timedOut = false;
    var controller = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { timedOut = true; if (controller) controller.abort(); }, SEND_TIMEOUT_MS);
    function finished() { sending = false; clearTimeout(timer); showBusy(false); }
    var indexes = pagesToSend();
    Promise.all(indexes.map(exportPage)).then(function (blobs) {
      var form = new FormData();
      blobs.forEach(function (blob, i) { form.append("page", blob, "page-" + (i + 1) + ".png"); });
      form.append("strokes", JSON.stringify({ v: 1, width: PAGE_W, height: PAGE_H, pages: indexes.map(function (index) { return state.pages[index]; }) }));
      form.append("date", state.date);
      if (noteId) form.append("note", noteId);
      // Done tapped again: the server can throw the earlier reading away.
      if (currentDraft) form.append("replaces", currentDraft.draftId);
      return fetch("/admin/clients/" + encodeURIComponent(clientId) + "/ink", { method: "POST", body: form, credentials: "same-origin", signal: controller ? controller.signal : undefined })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (body) { return { response: response, body: body }; });
        })
        .then(function (result) {
          finished();
          if (result.response.status === 401) {
            setStatus("You've been signed out. This note is safe on this iPad.", "warn",
              { href: "/admin/login?next=" + encodeURIComponent(location.pathname + location.search), label: "Log in" });
            return;
          }
          if (!result.response.ok) {
            setStatus(result.body.message || "Couldn't send it. It's safe on this iPad; try Done again.", "warn");
            return;
          }
          openReview(result.body, blobs);
        });
    }).catch(function () {
      finished();
      setStatus(timedOut
        ? "Reading took too long. The note is safe on this iPad; tap Done to try again."
        : "No connection. The note is safe on this iPad; tap Done when you're back online.", "warn");
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
      var name = input.getAttribute("data-field");
      if (!typed[name]) input.value = fields[name] || "";
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
        if (!button.hasAttribute("data-label")) button.setAttribute("data-label", button.innerHTML);
        button.disabled = on;
        if (on) button.textContent = "Saving…";
        else button.innerHTML = button.getAttribute("data-label");
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
    state.undo = [];
    state.redo = [];
    banner.hidden = true;
    if (noteId) {
      // Changing a saved note: back to the note as it was saved.
      loadSaved().then(function (pages) {
        // Her changes stay until the saved note is in hand.
        if (!pages) {
          setStatus("Couldn't open the saved handwriting, so nothing was changed. Try again when you're back online.", "warn");
          return;
        }
        clearLocal();
        state.pages = pages;
        state.date = /^\d{4}-\d{2}-\d{2}$/.test(noteDate) ? noteDate : localToday();
        buildPages();
        updateUndoButtons();
        setStatus("", "");
      });
      return;
    }
    state.pages = [[]];
    state.date = localToday();
    buildPages();
    changed();
  });

  /** A saved note's strokes, one list per page, or null if they can't be read. */
  function loadSaved() {
    return fetch("/admin/notes/" + encodeURIComponent(noteId) + "/ink", { credentials: "same-origin" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (ink) { return ink && Array.isArray(ink.pages) && ink.pages.length ? ink.pages : null; })
      .catch(function () { return null; });
  }

  function begin(saved) {
    if (saved && Array.isArray(saved.pages) && saved.pages.some(function (strokes) { return strokes.length; })) {
      state.pages = saved.pages;
      if (/^\d{4}-\d{2}-\d{2}$/.test(saved.date || "")) state.date = saved.date;
      var when = new Date(saved.updatedAt || Date.now());
      document.getElementById("nb-restored-when").textContent = when.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      banner.hidden = false;
      setStatus("Saved on this iPad", "good");
      if (noteId) startOver.textContent = "Undo my changes";
    }
    buildPages();
    updateUndoButtons();
  }

  // Opening a saved note: its strokes come from the dashboard. Until they arrive the page stays
  // locked, and Done tries again.
  function openSaved() {
    locked = true;
    setStatus("Opening the handwriting…", "");
    return loadSaved().then(function (pages) {
      if (!pages) {
        setStatus("Couldn't open the handwriting. Check the connection, then tap Done to try again.", "warn");
        return;
      }
      locked = false;
      setStatus("", "");
      state.pages = pages;
      begin(null);
    });
  }

  loadLocal().then(function (saved) {
    if (saved || !noteId) return begin(saved);
    buildPages();
    return openSaved();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { pageViews.forEach(function (_, index) { renderPage(index); }); });
  }
})();
`;

/** The script's version: changes whenever the script does, so it can be cached for a year. */
export const NOTEBOOK_VERSION = contentVersion(NOTEBOOK_JS);
