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
  // The headings printed on the first page. Layout 1 is how notes were written before
  // "Outside products" was added; a note keeps the layout it was written on.
  var LAYOUTS = {
    1: [
      { label: "Treatment type", y: 118 },
      { label: "Notes / remarks", y: 322 },
      { label: "Purchase history", y: 662 },
      { label: "Possible treatments", y: 866 },
    ],
    2: [
      { label: "Treatment type", y: 118 },
      { label: "Notes / remarks", y: 322 },
      { label: "Purchase history", y: 628 },
      { label: "Outside products", y: 798 },
      { label: "Possible treatments", y: 934 },
    ],
  };
  var LAYOUT = 2;
  var HIGHLIGHT = "#E9C46A";
  var ERASE_RADIUS = 12;
  // 100% is the page as wide as the screen allows. Below it whole pages fit on the screen.
  var MIN_ZOOM = 0.4;
  var MAX_ZOOM = 2.5;
  // Canvas pixels per page unit at most. Higher zoom is drawn slightly soft rather than risk
  // the large canvases iPad Safari refuses to keep in memory.
  var MAX_BACKING = 3;
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
  // With finger drawing on, a touch this wide is a resting hand, not a fingertip.
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
    layout: LAYOUT,       // which headings are printed (see LAYOUTS)
    images: [],           // photos on the pages: { id, page, x, y, w, h } in page units
  };
  // Each photo's JPEG, and the decoded picture once it's ready to draw, by id.
  var photoData = {};
  var photoPics = {};
  // Photos already stored with the note being changed: they aren't sent again.
  var savedPhotos = {};
  var MAX_PHOTOS = 20;

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
      (LAYOUTS[state.layout] || LAYOUTS[LAYOUT]).forEach(function (section) {
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

  /**
   * A pen stroke's points, steadied for drawing: points closer than a fraction of a unit are
   * dropped, the path is eased (each point drawn part way from the last), and the pressure is
   * smoothed so the width swells and thins gently. The last point stays exact, so the ink
   * reaches the Pencil tip. What's stored is untouched.
   */
  function steady(points, size) {
    var out = [];
    var last = null;
    var pressure = points[0][2];
    for (var i = 0; i < points.length; i += 1) {
      var p = points[i];
      var final = i === points.length - 1;
      if (last && !final) {
        var dx = p[0] - last[0];
        var dy = p[1] - last[1];
        if (dx * dx + dy * dy < 0.16) continue;
      }
      pressure = pressure * 0.65 + p[2] * 0.35;
      var x = last && !final ? last[0] + (p[0] - last[0]) * 0.65 : p[0];
      var y = last && !final ? last[1] + (p[1] - last[1]) * 0.65 : p[1];
      last = [x, y, widthFor(pressure, size) / 2];
      out.push(last);
    }
    return out;
  }

  /** A pen stroke as one filled outline, so a pressure-varying line has smooth, even edges. */
  function fillPenStroke(ctx, points, size) {
    var pts = steady(points, size);
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], pts[0][2], 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    var left = [];
    var right = [];
    var nx = 0;
    var ny = 0;
    for (var i = 0; i < pts.length; i += 1) {
      var a = pts[i > 0 ? i - 1 : i];
      var b = pts[i < pts.length - 1 ? i + 1 : i];
      var dx = b[0] - a[0];
      var dy = b[1] - a[1];
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.0001) {
        nx = -dy / len;
        ny = dx / len;
      }
      var r = pts[i][2];
      left.push([pts[i][0] + nx * r, pts[i][1] + ny * r]);
      right.push([pts[i][0] - nx * r, pts[i][1] - ny * r]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (var l = 1; l < left.length - 1; l += 1) {
      var ml = midpoint(left[l], left[l + 1]);
      ctx.quadraticCurveTo(left[l][0], left[l][1], ml[0], ml[1]);
    }
    ctx.lineTo(left[left.length - 1][0], left[left.length - 1][1]);
    ctx.lineTo(right[right.length - 1][0], right[right.length - 1][1]);
    for (var k = right.length - 2; k > 0; k -= 1) {
      var mr = midpoint(right[k], right[k - 1]);
      ctx.quadraticCurveTo(right[k][0], right[k][1], mr[0], mr[1]);
    }
    ctx.lineTo(right[0][0], right[0][1]);
    ctx.closePath();
    ctx.fill();
    // Round ends, and round joins where the line turns sharply (the outline pinches there).
    var first = pts[0];
    var end = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(first[0], first[1], first[2], 0, Math.PI * 2);
    ctx.moveTo(end[0] + end[2], end[1]);
    ctx.arc(end[0], end[1], end[2], 0, Math.PI * 2);
    for (var t = 1; t < pts.length - 1; t += 1) {
      var ux = pts[t][0] - pts[t - 1][0];
      var uy = pts[t][1] - pts[t - 1][1];
      var vx = pts[t + 1][0] - pts[t][0];
      var vy = pts[t + 1][1] - pts[t][1];
      if (ux * vx + uy * vy < 0) {
        ctx.moveTo(pts[t][0] + pts[t][2], pts[t][1]);
        ctx.arc(pts[t][0], pts[t][1], pts[t][2], 0, Math.PI * 2);
      }
    }
    ctx.fill();
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
      if (points.length === 1) ctx.lineTo(points[0][0] + 0.1, points[0][1]);
      for (var h = 1; h < points.length - 1; h += 1) {
        var m = midpoint(points[h], points[h + 1]);
        ctx.quadraticCurveTo(points[h][0], points[h][1], m[0], m[1]);
      }
      if (points.length > 1) ctx.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.fillStyle = stroke.color;
    fillPenStroke(ctx, points, stroke.size);
    ctx.restore();
  }

  function widthFor(pressure, size) {
    var p = pressure > 0 ? pressure : 0.5;
    return (1.1 + p * 2.6) * (size > 0 ? size : 1);
  }

  function renderPage(index) {
    var view = pageViews[index];
    if (!view) return;
    var ctx = view.canvas.getContext("2d");
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    drawPage(ctx, index);
  }

  /** Everything on a page, in order: the printed page, her photos, then her writing over them. */
  function drawPage(ctx, index) {
    drawTemplate(ctx, index);
    state.images.forEach(function (image) {
      if (image.page !== index) return;
      var pic = photoPics[image.id];
      if (pic) {
        ctx.drawImage(pic, image.x, image.y, image.w, image.h);
      } else {
        ctx.fillStyle = "#EFE7DC";
        ctx.fillRect(image.x, image.y, image.w, image.h);
      }
    });
    state.pages[index].forEach(function (stroke) { drawStroke(ctx, stroke); });
  }

  /** Add one finished stroke to its page without redrawing the rest. */
  function commitStroke(index, stroke) {
    var view = pageViews[index];
    if (!view) return;
    var ctx = view.canvas.getContext("2d");
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    drawStroke(ctx, stroke);
  }

  // The stroke being written is drawn on its own transparent canvas laid over the page, so each
  // Pencil movement redraws one stroke, not the whole page. There is only one, moved to the page
  // being written on.
  var liveCanvas = document.createElement("canvas");
  liveCanvas.className = "nb-live";
  liveCanvas.setAttribute("aria-hidden", "true");
  var liveCtx = liveCanvas.getContext("2d", { desynchronized: true }) || liveCanvas.getContext("2d");
  var livePage = -1;

  function paintLive(index, stroke, predicted) {
    var view = pageViews[index];
    if (!view) return;
    if (livePage !== index || liveCanvas.width !== view.canvas.width || liveCanvas.parentNode !== view.canvas.parentNode) {
      liveCanvas.width = view.canvas.width;
      liveCanvas.height = view.canvas.height;
      liveCanvas.style.width = view.canvas.style.width;
      liveCanvas.style.height = view.canvas.style.height;
      view.canvas.parentNode.appendChild(liveCanvas);
      livePage = index;
    }
    liveCtx.setTransform(1, 0, 0, 1, 0, 0);
    liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
    if (!stroke) return;
    liveCtx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    // Where the Pencil is about to be, drawn but not kept, so the ink keeps up with the tip.
    drawStroke(liveCtx, predicted && predicted.length ? { tool: stroke.tool, color: stroke.color, size: stroke.size, points: stroke.points.concat(predicted) } : stroke);
  }

  function clearLive() {
    if (livePage === -1) return;
    liveCtx.setTransform(1, 0, 0, 1, 0, 0);
    liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
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
    view.scale = view.canvas.width / PAGE_W;
    if (livePage === index) livePage = -1;
    // The live canvas left on this page from the last stroke would keep its old size and, zoomed
    // out, stick out past the page and make the screen scroll sideways.
    if (liveCanvas.parentNode === view.canvas.parentNode) {
      clearLive();
      liveCanvas.style.width = view.canvas.style.width;
      liveCanvas.style.height = view.canvas.style.height;
    }
    renderPage(index);
    if (selectedPhoto) placePhotoBox();
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
    var view = { canvas: canvas, scale: 1, near: !nearWatch || index < 2 || index === state.pages.length - 1 };
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
  }, { root: scroller, rootMargin: "150% 0px" }) : null;

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
  // When the Pencil last moved. If Safari ever loses the Pencil's lift, fingers scroll again after a moment.
  var penSeen = 0;
  function penActive() { return penDown && Date.now() - penSeen < 1500; }
  function penLifted(event) { if (event.pointerType === "pen") penDown = false; }
  document.addEventListener("pointerup", penLifted, true);
  document.addEventListener("pointercancel", penLifted, true);
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

    // iPad Safari scrolls for any touch, the Pencil included. Stop it only for the Pencil and while
    // the Pencil is writing. Every finger touch is left to Safari so it scrolls natively, with
    // momentum, anywhere on the page. (Judging a palm by touch size used to catch fingertips too,
    // which is why the page only scrolled from the margins; iPadOS already ignores a resting
    // palm while the Pencil writes.)
    function holdStill(event) {
      if (event.touches.length !== 1) return;
      var touch = event.touches[0];
      if (touch.touchType === "stylus" || penActive() || state.fingerDraws) event.preventDefault();
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
        clearLive();
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
      if (event.pointerType === "pen") { penDown = true; penSeen = Date.now(); }
      touchStroke = event.pointerType === "touch" ? cancelTouch : null;
      var point = toPage(canvas, event);
      if (state.tool === "eraser") {
        erased = [];
        eraseAt(index, point, erased);
        if (erased.length) renderPage(index);
        return;
      }
      live = { tool: state.tool, color: state.color, size: PEN_SIZES[state.size].scale, points: [point] };
      paintLive(index, live);
    });

    canvas.addEventListener("pointermove", function (event) {
      if (event.pointerType === "pen") penSeen = Date.now();
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
      var predicted = event.getPredictedEvents ? event.getPredictedEvents().slice(0, 2).map(function (e) { return toPage(canvas, e); }) : null;
      paintLive(index, live, predicted);
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
      var stroke = live;
      live = null;
      state.pages[index].push(stroke);
      commitStroke(index, stroke);
      clearLive();
      record({ type: "add", page: index, stroke: stroke });
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
    if (action.type.indexOf("photo") === 0) { undoPhoto(action, true); return; }
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
    if (action.type.indexOf("photo") === 0) { undoPhoto(action, false); return; }
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
    return state.images.length > 0 || state.pages.some(function (strokes) { return strokes.length > 0; });
  }

  function saveLocal() {
    var record = { clientId: draftKey, clientName: clientName, noteId: noteId || null, date: state.date, layout: state.layout, pages: state.pages,
      images: state.images, photos: photoData, savedPhotos: savedPhotos, updatedAt: Date.now() };
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
  // the new size, so writing stays sharp. The point is held as a spot on a page, since the gaps between
  // pages don't grow and shrink with them.
  function setZoom(zoom, x, y) {
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 100) / 100));
    var box = scroller.getBoundingClientRect();
    var ax = x === undefined ? box.left + box.width / 2 : x;
    var ay = y === undefined ? box.top + box.height / 2 : y;
    var anchor = 0;
    pageViews.forEach(function (view, index) { if (view.canvas.getBoundingClientRect().top <= ay) anchor = index; });
    var before = pageViews[anchor].canvas.getBoundingClientRect();
    var fx = (ax - before.left) / before.width;
    var fy = (ay - before.top) / before.height;
    state.zoom = zoom;
    pageViews.forEach(function (_, index) { sizePage(index); });
    var after = pageViews[anchor].canvas.getBoundingClientRect();
    scroller.scrollLeft += after.left + fx * after.width - ax;
    scroller.scrollTop += after.top + fy * after.height - ay;
    zoomLabel.textContent = Math.round(zoom * 100) + "%";
    zoomLabel.setAttribute("aria-label", zoom === 1 ? "Show the whole page" : "Back to 100%");
    document.getElementById("nb-zoom-out").disabled = zoom <= MIN_ZOOM;
    document.getElementById("nb-zoom-in").disabled = zoom >= MAX_ZOOM;
    updatePageCount();
  }

  // Small enough that the page in view fits on the screen below the tools, and lined up there.
  function showWholePage() {
    var page = pageInView().page;
    var tools = scroller.querySelector(".nb-tools");
    var room = scroller.clientHeight - (tools ? tools.offsetHeight + 12 : 0) - 32;
    var fit = Math.floor(room / (baseWidth() * PAGE_H / PAGE_W) * 100) / 100;
    setZoom(Math.min(1, fit));
    var top = pageViews[page].canvas.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop += top - (tools ? tools.offsetHeight + 12 : 0) - 16;
  }

  document.getElementById("nb-zoom-in").addEventListener("click", function () { setZoom(state.zoom + 0.25); });
  document.getElementById("nb-zoom-out").addEventListener("click", function () { setZoom(state.zoom - 0.25); });
  // At 100% the label shows the whole page; anywhere else it goes back to 100%.
  zoomLabel.addEventListener("click", function () { if (state.zoom === 1) showWholePage(); else setZoom(1); });

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

  /* -------------------------------------------------------------- photos */

  // A photo is added from the toolbar (camera or library), shrunk to a sensible size on the iPad,
  // and placed on the page in view. Tapping it with a finger selects it: drag to move, the corner
  // to resize, or remove it. The Pencil always writes, over photos too.

  function pagePhotos(index) {
    return state.images.filter(function (image) { return image.page === index; });
  }

  function newPhotoId() {
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var id = "img_";
    for (var i = 0; i < 12; i += 1) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  /** Decode a photo's JPEG for drawing, then redraw its page. */
  function showPhoto(id) {
    var blob = photoData[id];
    if (!blob) return Promise.resolve();
    var url = URL.createObjectURL(blob);
    var pic = new Image();
    pic.src = url;
    return (pic.decode ? pic.decode() : new Promise(function (resolve, reject) { pic.onload = resolve; pic.onerror = reject; }))
      .then(function () {
        photoPics[id] = pic;
        state.images.forEach(function (image) { if (image.id === id) renderPage(image.page); });
      })
      .catch(function () { /* drawn as a blank box */ });
  }

  /** A picked file as a JPEG at most 1600 px on its longest side (iPad photos are 12 MP and up). */
  function shrinkPhoto(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var pic = new Image();
      pic.onload = function () {
        var scale = Math.min(1, 1600 / Math.max(pic.naturalWidth, pic.naturalHeight));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(pic.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(pic.naturalHeight * scale));
        canvas.getContext("2d").drawImage(pic, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          var size = { w: canvas.width, h: canvas.height };
          canvas.width = 0;
          canvas.height = 0;
          if (blob) resolve({ blob: blob, w: size.w, h: size.h }); else reject(new Error("couldn't read photo"));
        }, "image/jpeg", 0.85);
      };
      pic.onerror = function () { URL.revokeObjectURL(url); reject(new Error("couldn't read photo")); };
      pic.src = url;
    });
  }

  /** The page in the middle of the screen, and the page-unit y at the middle of what's visible of it. */
  function pageInView() {
    var box = scroller.getBoundingClientRect();
    var middle = box.top + box.height / 2;
    var current = 0;
    pageViews.forEach(function (view, index) { if (view.canvas.getBoundingClientRect().top <= middle) current = index; });
    var rect = pageViews[current].canvas.getBoundingClientRect();
    var y = (middle - rect.top) * PAGE_H / rect.height;
    return { page: current, y: Math.max(80, Math.min(PAGE_H - 80, y)) };
  }

  var photoInput = document.getElementById("nb-photo-input");
  var photoBtn = document.getElementById("nb-photo");
  if (photoBtn && photoInput) {
    photoBtn.addEventListener("click", function () {
      if (locked) return;
      if (state.images.length >= MAX_PHOTOS) { setStatus("A note can have up to " + MAX_PHOTOS + " photos.", "warn"); return; }
      photoInput.click();
    });
    photoInput.addEventListener("change", function () {
      var files = Array.prototype.slice.call(photoInput.files || [], 0, MAX_PHOTOS - state.images.length);
      photoInput.value = "";
      if (!files.length) return;
      setStatus("Adding photo…", "");
      var spot = pageInView();
      files.reduce(function (chain, file, i) {
        return chain.then(function () {
          return shrinkPhoto(file).then(function (shrunk) {
            var w = Math.min(420, PAGE_W - 120);
            var h = w * shrunk.h / shrunk.w;
            if (h > PAGE_H - 160) { h = PAGE_H - 160; w = h * shrunk.w / shrunk.h; }
            var image = { id: newPhotoId(), page: spot.page, x: (PAGE_W - w) / 2 + i * 24, y: Math.max(40, Math.min(PAGE_H - h - 40, spot.y - h / 2 + i * 24)), w: w, h: h };
            photoData[image.id] = shrunk.blob;
            state.images.push(image);
            record({ type: "photo-add", image: image });
            renderPage(image.page);
            return showPhoto(image.id).then(function () { selectPhoto(image.id); });
          });
        });
      }, Promise.resolve()).then(function () {
        setStatus("Photo added. Drag to move it, or use the corner to resize.", "good");
      }).catch(function () {
        setStatus("Couldn't add that photo. Try another.", "warn");
      });
    });
  }

  /* The box shown around a selected photo, with a resize corner and a Remove button. */
  var photoBox = document.createElement("div");
  photoBox.className = "nb-photo-box";
  photoBox.innerHTML = '<button type="button" class="nb-photo-remove" aria-label="Remove photo">Remove</button><span class="nb-photo-handle" aria-hidden="true"></span>';
  var selectedPhoto = null;

  function photoById(id) {
    for (var i = 0; i < state.images.length; i += 1) if (state.images[i].id === id) return state.images[i];
    return null;
  }

  function placePhotoBox() {
    var image = selectedPhoto && photoById(selectedPhoto);
    var view = image && pageViews[image.page];
    if (!view) { if (photoBox.parentNode) photoBox.parentNode.removeChild(photoBox); selectedPhoto = null; return; }
    var k = parseFloat(view.canvas.style.width) / PAGE_W;
    photoBox.style.left = image.x * k + "px";
    photoBox.style.top = image.y * k + "px";
    photoBox.style.width = image.w * k + "px";
    photoBox.style.height = image.h * k + "px";
    if (photoBox.parentNode !== view.canvas.parentNode) view.canvas.parentNode.appendChild(photoBox);
  }

  function selectPhoto(id) {
    selectedPhoto = id;
    placePhotoBox();
  }

  function deselectPhoto() {
    if (!selectedPhoto) return;
    selectedPhoto = null;
    placePhotoBox();
  }

  /** The photo under a point (page units) on a page, topmost first. */
  function photoAt(index, point) {
    for (var i = state.images.length - 1; i >= 0; i -= 1) {
      var image = state.images[i];
      if (image.page === index && point[0] >= image.x && point[0] <= image.x + image.w && point[1] >= image.y && point[1] <= image.y + image.h) return image;
    }
    return null;
  }

  // Dragging the box moves the photo; dragging the corner resizes it, keeping its shape.
  var photoDrag = null;
  photoBox.addEventListener("pointerdown", function (event) {
    if (event.target.closest(".nb-photo-remove")) return;
    var image = photoById(selectedPhoto);
    if (!image) return;
    event.preventDefault();
    event.stopPropagation();
    try { photoBox.setPointerCapture(event.pointerId); } catch (error) { /* already lifted */ }
    var k = parseFloat(pageViews[image.page].canvas.style.width) / PAGE_W;
    photoDrag = { id: image.id, k: k, sx: event.clientX, sy: event.clientY, from: { x: image.x, y: image.y, w: image.w, h: image.h }, resize: !!event.target.closest(".nb-photo-handle") };
  });
  photoBox.addEventListener("pointermove", function (event) {
    if (!photoDrag) return;
    var image = photoById(photoDrag.id);
    var dx = (event.clientX - photoDrag.sx) / photoDrag.k;
    var dy = (event.clientY - photoDrag.sy) / photoDrag.k;
    var from = photoDrag.from;
    if (photoDrag.resize) {
      var w = Math.max(80, Math.min(PAGE_W - from.x, from.w + dx));
      var h = w * from.h / from.w;
      if (from.y + h > PAGE_H) { h = PAGE_H - from.y; w = h * from.w / from.h; }
      image.w = w;
      image.h = h;
    } else {
      image.x = Math.max(0, Math.min(PAGE_W - image.w, from.x + dx));
      image.y = Math.max(0, Math.min(PAGE_H - image.h, from.y + dy));
    }
    placePhotoBox();
    if (!photoDrag.frame) {
      photoDrag.frame = requestAnimationFrame(function () {
        if (photoDrag) photoDrag.frame = 0;
        renderPage(image.page);
      });
    }
  });
  function endPhotoDrag() {
    if (!photoDrag) return;
    var drag = photoDrag;
    photoDrag = null;
    var image = photoById(drag.id);
    renderPage(image.page);
    var to = { x: image.x, y: image.y, w: image.w, h: image.h };
    if (to.x !== drag.from.x || to.y !== drag.from.y || to.w !== drag.from.w) record({ type: "photo-change", id: image.id, from: drag.from, to: to });
  }
  photoBox.addEventListener("pointerup", endPhotoDrag);
  photoBox.addEventListener("pointercancel", endPhotoDrag);
  photoBox.querySelector(".nb-photo-remove").addEventListener("click", function () {
    var at = -1;
    for (var i = 0; i < state.images.length; i += 1) if (state.images[i].id === selectedPhoto) at = i;
    if (at === -1) return;
    var image = state.images.splice(at, 1)[0];
    deselectPhoto();
    renderPage(image.page);
    record({ type: "photo-remove", image: image, at: at });
  });

  function undoPhoto(action, undoing) {
    var page;
    if (action.type === "photo-add" || action.type === "photo-remove") {
      var removing = (action.type === "photo-add") === undoing;
      if (removing) {
        state.images = state.images.filter(function (image) { return image.id !== action.image.id; });
      } else if (!photoById(action.image.id)) {
        state.images.splice(action.at === undefined ? state.images.length : action.at, 0, action.image);
      }
      page = action.image.page;
    } else {
      var image = photoById(action.id);
      if (!image) return;
      var to = undoing ? action.from : action.to;
      image.x = to.x; image.y = to.y; image.w = to.w; image.h = to.h;
      page = image.page;
    }
    deselectPhoto();
    renderPage(page);
  }

  // A finger tap (no scroll) on a photo selects it; a tap elsewhere puts it down.
  var photoTap = null;
  pagesBox.addEventListener("pointerdown", function (event) {
    if (event.target.closest && event.target.closest(".nb-photo-box")) return;
    if (event.pointerType === "pen" || state.fingerDraws && event.pointerType === "touch") { if (event.pointerType === "pen") deselectPhoto(); return; }
    photoTap = { x: event.clientX, y: event.clientY, at: Date.now(), top: scroller.scrollTop, target: event.target };
  }, true);
  pagesBox.addEventListener("pointerup", function (event) {
    var tap = photoTap;
    photoTap = null;
    if (!tap || event.pointerType === "pen") return;
    if (Math.abs(event.clientX - tap.x) > 10 || Math.abs(event.clientY - tap.y) > 10 || Date.now() - tap.at > 500 || Math.abs(scroller.scrollTop - tap.top) > 4) return;
    var index = -1;
    pageViews.forEach(function (view, i) { if (view.canvas === tap.target) index = i; });
    var image = index === -1 ? null : photoAt(index, toPage(pageViews[index].canvas, event));
    if (image && event.pointerType !== "mouse") selectPhoto(image.id);
    else if (image && event.pointerType === "mouse" && state.tool !== "pen" && state.tool !== "highlighter") selectPhoto(image.id);
    else deselectPhoto();
  }, true);
  // Touches that become a scroll never send pointerup.
  pagesBox.addEventListener("pointercancel", function () { photoTap = null; }, true);

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
    drawPage(ctx, index);
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
    // Always the first page; later pages only if something is written or placed on them.
    return state.pages.map(function (strokes, index) { return index === 0 || strokes.length || pagePhotos(index).length ? index : -1; })
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
      // Photos follow their page's new number, since empty pages aren't sent. Ones already stored
      // with the note being changed are listed but not sent again.
      var photos = state.images.filter(function (image) { return indexes.indexOf(image.page) !== -1; }).map(function (image) {
        return { id: image.id, page: indexes.indexOf(image.page), x: image.x, y: image.y, w: image.w, h: image.h };
      });
      photos.forEach(function (image) {
        if (!savedPhotos[image.id] && photoData[image.id]) form.append("image", photoData[image.id], image.id);
      });
      form.append("strokes", JSON.stringify({ v: 1, layout: state.layout, width: PAGE_W, height: PAGE_H, pages: indexes.map(function (index) { return state.pages[index]; }), images: photos }));
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
      loadSaved().then(function (ink) {
        // Her changes stay until the saved note is in hand.
        if (!ink) {
          setStatus("Couldn't open the saved handwriting, so nothing was changed. Try again when you're back online.", "warn");
          return;
        }
        clearLocal();
        state.pages = ink.pages;
        state.layout = ink.layout || 1;
        useSavedPhotos(ink);
        state.date = /^\d{4}-\d{2}-\d{2}$/.test(noteDate) ? noteDate : localToday();
        buildPages();
        updateUndoButtons();
        setStatus("", "");
      });
      return;
    }
    state.pages = [[]];
    state.layout = LAYOUT;
    state.images = [];
    photoData = {};
    photoPics = {};
    deselectPhoto();
    state.date = localToday();
    buildPages();
    changed();
  });

  /** Put a saved note's photos back: their places from its ink, their pictures from the dashboard. */
  function useSavedPhotos(ink) {
    state.images = Array.isArray(ink.images) ? ink.images : [];
    photoData = {};
    photoPics = {};
    savedPhotos = {};
    state.images.forEach(function (image) {
      savedPhotos[image.id] = true;
      fetch("/admin/notes/" + encodeURIComponent(noteId) + "/images/" + encodeURIComponent(image.id), { credentials: "same-origin" })
        .then(function (response) { return response.ok ? response.blob() : null; })
        .then(function (blob) { if (blob) { photoData[image.id] = blob; return showPhoto(image.id); } })
        .catch(function () { /* drawn as a blank box; it's still stored with the note */ });
    });
  }

  /** A saved note's ink ({ pages, layout, images }), or null if it can't be read. */
  function loadSaved() {
    return fetch("/admin/notes/" + encodeURIComponent(noteId) + "/ink", { credentials: "same-origin" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (ink) { return ink && Array.isArray(ink.pages) && ink.pages.length ? ink : null; })
      .catch(function () { return null; });
  }

  function begin(saved) {
    if (saved && Array.isArray(saved.pages) && (saved.pages.some(function (strokes) { return strokes.length; }) || (saved.images && saved.images.length))) {
      state.pages = saved.pages;
      state.layout = saved.layout || 1;
      state.images = Array.isArray(saved.images) ? saved.images : [];
      photoData = saved.photos || {};
      savedPhotos = saved.savedPhotos || {};
      state.images.forEach(function (image) { showPhoto(image.id); });
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
    return loadSaved().then(function (ink) {
      if (!ink) {
        setStatus("Couldn't open the handwriting. Check the connection, then tap Done to try again.", "warn");
        return;
      }
      locked = false;
      setStatus("", "");
      state.pages = ink.pages;
      // Notes written before "Outside products" keep the four headings they were written on.
      state.layout = ink.layout || 1;
      useSavedPhotos(ink);
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
