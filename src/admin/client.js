// Admin client script. Plain ES2020, no build step, no dependencies — same
// house style as the storefront's own client/cart.js.

export const ADMIN_CLIENT_JS = String.raw`
(function () {
  "use strict";

  /* --------------------------------------------------------- clients page */

  function wireClientsPage() {
    var search = document.getElementById("client-search");
    var rows = document.querySelectorAll("[data-client-href]");
    if (search) {
      search.addEventListener("input", function () {
        var needle = search.value.trim().toLowerCase();
        rows.forEach(function (row) {
          var name = row.getAttribute("data-name") || "";
          row.style.display = name.indexOf(needle) === -1 ? "none" : "";
        });
      });
    }
    rows.forEach(function (row) {
      row.addEventListener("click", function () {
        window.location.href = row.getAttribute("data-client-href");
      });
    });

    var syncBtn = document.getElementById("sync-btn");
    var status = document.getElementById("sync-status");
    if (syncBtn) {
      syncBtn.addEventListener("click", function () {
        syncBtn.disabled = true;
        if (status) status.textContent = "Syncing with Square — this can take a little while for a few years of bookings...";
        fetch("/admin/sync", { method: "POST" })
          .then(function (response) { return response.json().then(function (data) { return { ok: response.ok, data: data }; }); })
          .then(function (result) {
            if (!result.ok) {
              if (status) status.textContent = result.data.message || "Sync failed.";
              syncBtn.disabled = false;
              return;
            }
            if (status) status.textContent = "Found " + result.data.clientsFound + " client(s), imported " + result.data.notesImported + " note(s) from Square. Reloading...";
            window.location.reload();
          })
          .catch(function () {
            if (status) status.textContent = "Sync failed — check your connection and try again.";
            syncBtn.disabled = false;
          });
      });
    }
  }

  /* --------------------------------------------------- client profile page */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function insightSection(title, content) {
    var wrap = el("div", "insight-section");
    wrap.appendChild(el("h3", "", title));
    wrap.appendChild(content);
    return wrap;
  }

  /* Builds the AI summary from its structured parts. Text comes in through
     textContent only, so nothing the model writes is ever read as markup. */
  function renderInsight(body, insight) {
    body.innerHTML = "";
    body.appendChild(el("p", "insight-overview", insight.overview));

    if (insight.flags && insight.flags.length) {
      var flags = el("ul", "bullets flags");
      insight.flags.forEach(function (line) { flags.appendChild(el("li", "", line)); });
      body.appendChild(insightSection("Flags to check", flags));
    }

    if (insight.visits && insight.visits.length) {
      var table = el("table");
      var headRow = el("tr");
      ["Date", "Treatment", "How her skin responded"].forEach(function (label) {
        headRow.appendChild(el("th", "", label));
      });
      var thead = el("thead");
      thead.appendChild(headRow);
      table.appendChild(thead);

      var tbody = el("tbody");
      insight.visits.forEach(function (visit) {
        var row = el("tr");
        row.appendChild(el("td", "date", visit.date));
        row.appendChild(el("td", "", visit.treatment));
        row.appendChild(el("td", "", visit.response));
        tbody.appendChild(row);
      });
      table.appendChild(tbody);

      var tableWrap = el("div", "table-wrap");
      tableWrap.appendChild(table);
      body.appendChild(insightSection("Visits", tableWrap));
    }

    if (insight.products && insight.products.length) {
      var products = el("ul", "products");
      insight.products.forEach(function (product) {
        var item = el("li");
        item.appendChild(el("strong", "", product.name));
        if (product.note) item.appendChild(el("span", "", product.note));
        products.appendChild(item);
      });
      body.appendChild(insightSection("Products in the routine", products));
    }

    if (insight.watch && insight.watch.length) {
      var watch = el("ul", "bullets");
      insight.watch.forEach(function (line) { watch.appendChild(el("li", "", line)); });
      body.appendChild(insightSection("Watch for", watch));
    }

    if (insight.nextVisit && insight.nextVisit.length) {
      var next = el("ul", "checklist");
      insight.nextVisit.forEach(function (line) { next.appendChild(el("li", "", line)); });
      body.appendChild(insightSection("Next visit", next));
    }
  }

  function wireClientProfilePage() {
    document.querySelectorAll(".edit-note-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest("[data-note-id]");
        card.querySelector(".note-view").style.display = "none";
        card.querySelector(".note-edit").style.display = "block";
        card.querySelector(".save-note-btn").style.display = "inline";
      });
    });

    document.querySelectorAll(".save-note-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var noteId = btn.getAttribute("data-note-id");
        var card = btn.closest("[data-note-id]");
        var textarea = card.querySelector(".note-edit");
        var newText = textarea.value.trim();
        if (!newText) return;

        btn.textContent = "Saving...";
        fetch("/admin/notes/" + noteId, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ summary: newText }),
        })
          .then(function (response) {
            if (!response.ok) throw new Error("save failed");
            card.querySelector(".note-view").textContent = newText;
            card.querySelector(".note-view").style.display = "block";
            textarea.style.display = "none";
            btn.style.display = "none";
            btn.textContent = "Save";
          })
          .catch(function () {
            btn.textContent = "Save failed — try again";
          });
      });
    });

    var card = document.getElementById("insight-card");
    var insightBody = document.getElementById("insight-body");
    var insightMeta = document.getElementById("insight-meta");

    function showInsight(insight, meta) {
      renderInsight(insightBody, insight);
      if (meta !== null) insightMeta.textContent = meta;
      document.getElementById("insight-placeholder").style.display = "none";
      document.getElementById("insight-result").style.display = "block";
    }

    // A saved summary is shown straight away, with no API call.
    var saved = card && card.getAttribute("data-saved");
    if (saved) {
      try { renderInsight(insightBody, JSON.parse(saved)); } catch (error) { /* leave the button to regenerate */ }
    }

    // force=true asks for a fresh AI call even if nothing changed (Regenerate).
    function runSummary(button, force) {
      var idleLabel = button.getAttribute("data-label") || button.textContent;
      var clientId = button.getAttribute("data-client-id");
      button.disabled = true;
      button.textContent = "Thinking...";
      fetch("/admin/clients/" + clientId + "/insight" + (force ? "?refresh=1" : ""), { method: "POST" })
        .then(function (response) { return response.json().then(function (data) { return { ok: response.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) {
            button.textContent = result.data.message || "Couldn't summarize right now.";
            button.disabled = false;
            return;
          }
          showInsight(
            result.data.summary,
            result.data.cached
              ? "Saved earlier. Nothing has changed, so no new AI call was made."
              : "Just generated and saved."
          );
          button.disabled = false;
          button.textContent = idleLabel;
        })
        .catch(function () {
          button.textContent = "Couldn't summarize right now.";
          button.disabled = false;
        });
    }

    var summarizeBtn = document.getElementById("summarize-btn");
    if (summarizeBtn) summarizeBtn.addEventListener("click", function () { runSummary(summarizeBtn, false); });

    var regenerateBtn = document.getElementById("regenerate-btn");
    if (regenerateBtn) regenerateBtn.addEventListener("click", function () { runSummary(regenerateBtn, true); });
  }

  /* -------------------------------------------------------------- upload */

  function wireUploadPage() {
    var card = document.getElementById("upload-card");
    if (!card) return;
    var clientId = card.getAttribute("data-client-id");

    var stepIdle = document.getElementById("upload-step-idle");
    var stepProcessing = document.getElementById("upload-step-processing");
    var stepReview = document.getElementById("upload-step-review");
    var stepError = document.getElementById("upload-step-error");
    var fileInput = document.getElementById("file-input");
    var chosenName = document.getElementById("chosen-file-name");
    var form = document.getElementById("upload-form");

    function showStep(step) {
      [stepIdle, stepProcessing, stepReview, stepError].forEach(function (el) {
        if (el) el.style.display = "none";
      });
      if (step) step.style.display = step === stepReview || step === stepError ? "flex" : "flex";
    }

    fileInput.addEventListener("change", function () {
      var files = fileInput.files;
      if (!files || !files.length) { chosenName.textContent = ""; return; }
      var names = [];
      for (var i = 0; i < files.length; i++) names.push(files[i].name);
      chosenName.textContent = names.join(", ");
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var files = fileInput.files;
      if (!files || !files.length) return;

      var formData = new FormData();
      for (var i = 0; i < files.length; i++) formData.append("file", files[i]);

      showStep(stepProcessing);

      fetch("/admin/clients/" + clientId + "/notes", { method: "POST", body: formData })
        .then(function (response) { return response.json().then(function (data) { return { ok: response.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) {
            stepError.textContent = result.data.message || "Something went wrong reading that file.";
            showStep(stepError);
            return;
          }
          if (result.data.status === "no_new_pages") {
            stepError.style.color = "var(--ink-soft)";
            stepError.textContent = "No new pages found since the last upload for this client" + missingNote(result.data.missingHashes) + ".";
            showStep(stepError);
            return;
          }
          renderReview(result.data);
        })
        .catch(function () {
          stepError.textContent = "Upload failed — check your connection and try again.";
          showStep(stepError);
        });
    });

    function missingNote(missingHashes) {
      if (!missingHashes || !missingHashes.length) return "";
      return " (note: " + missingHashes.length + " previously-seen page(s) are missing from this export — possible wrong file?)";
    }

    function renderReview(data) {
      stepReview.innerHTML = "";

      if (data.missingHashes && data.missingHashes.length) {
        var warn = document.createElement("div");
        warn.className = "flag-warn";
        warn.style.marginBottom = "4px";
        warn.innerHTML = "<span>⚠</span><span>" + data.missingHashes.length + " previously-seen page(s) are missing from this export — double check this is the right file.</span>";
        stepReview.appendChild(warn);
      }

      var entryEls = data.entries.map(function (entry) {
        var el = document.createElement("div");
        el.className = "entry-card";
        el.setAttribute("data-index", entry.index);

        var header = document.createElement("div");
        header.style.display = "flex";
        header.style.alignItems = "center";
        header.style.gap = "10px";

        var include = document.createElement("input");
        include.type = "checkbox";
        include.checked = true;
        include.className = "entry-include";

        var dateInput = document.createElement("input");
        dateInput.type = "date";
        dateInput.className = "entry-date";
        dateInput.value = entry.date || "";
        dateInput.style.flex = "1";

        header.appendChild(include);
        header.appendChild(dateInput);
        if (entry.confidence === "low") {
          var badge = document.createElement("span");
          badge.className = "pill";
          badge.style.background = "var(--warn)";
          badge.style.color = "#fff";
          badge.textContent = "Low confidence";
          header.appendChild(badge);
        }

        var textarea = document.createElement("textarea");
        textarea.className = "entry-summary";
        textarea.value = entry.summary;
        textarea.style.minHeight = "90px";

        el.appendChild(header);
        el.appendChild(textarea);
        stepReview.appendChild(el);
        return el;
      });

      var actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "10px";
      actions.style.justifyContent = "flex-end";

      var cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-secondary";
      cancelBtn.textContent = "Start over";
      cancelBtn.addEventListener("click", function () { window.location.reload(); });

      var saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "btn btn-primary";
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", function () {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        var payload = entryEls.map(function (el) {
          return {
            index: Number(el.getAttribute("data-index")),
            include: el.querySelector(".entry-include").checked,
            date: el.querySelector(".entry-date").value || null,
            summary: el.querySelector(".entry-summary").value,
          };
        });
        fetch("/admin/clients/" + clientId + "/notes/" + data.draftId + "/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ entries: payload }),
        })
          .then(function (response) { return response.json().then(function (d) { return { ok: response.ok, data: d }; }); })
          .then(function (result) {
            if (!result.ok) {
              saveBtn.disabled = false;
              saveBtn.textContent = "Save";
              return;
            }
            window.location.href = result.data.redirect;
          })
          .catch(function () {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save failed — try again";
          });
      });

      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      stepReview.appendChild(actions);

      showStep(stepReview);
    }
  }

  /* ------------------------------------------------------- email campaigns */

  function postForm(form) {
    return fetch(form.action, { method: "POST", body: new FormData(form), headers: { accept: "application/json" } })
      .then(function (response) { return response.json().catch(function () { return {}; }).then(function (data) { return { ok: response.ok, data: data }; }); });
  }

  function wireCampaignLists() {
    document.querySelectorAll("tr[data-href]").forEach(function (row) {
      row.addEventListener("click", function (event) {
        if (event.target.closest("a")) return;
        window.location.href = row.getAttribute("data-href");
      });
    });
    document.querySelectorAll("form[data-autosubmit]").forEach(function (form) {
      form.addEventListener("change", function () { postForm(form).catch(function () { form.submit(); }); });
    });
    document.querySelectorAll("form[data-confirm]").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        var question = form.getAttribute("data-confirm");
        if (question && !window.confirm(question)) { event.preventDefault(); return; }
        var button = form.querySelector("button[type=submit]");
        if (button) setTimeout(function () { button.disabled = true; }, 0);
      });
    });
    document.querySelectorAll("form[data-busy-form]").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        var button = event.submitter;
        if (!button || !button.getAttribute("data-busy-text")) return;
        // Keep the button's value in the post, then show that the AI is working.
        setTimeout(function () {
          form.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
          button.textContent = button.getAttribute("data-busy-text");
        }, 0);
      });
    });
    // The preview grows to the email's own height, so the page scrolls instead of the frame.
    document.querySelectorAll("iframe.camp-frame").forEach(function (frame) {
      function fit() {
        try {
          var doc = frame.contentDocument;
          if (doc && doc.documentElement) frame.style.height = Math.max(400, doc.documentElement.scrollHeight) + "px";
          if (doc) doc.querySelectorAll("a").forEach(function (link) { link.setAttribute("target", "_blank"); link.setAttribute("rel", "noopener"); });
        } catch (error) { /* keep the fixed height */ }
      }
      frame.addEventListener("load", fit);
      fit();
      window.addEventListener("resize", fit);
    });
  }

  function wireDraftForm() {
    var form = document.querySelector("form[data-draft-form]");
    if (!form) return;
    var busy = form.querySelector("[data-drafting]");
    var busyText = form.querySelector("[data-drafting-text]");
    var button = form.querySelector("[data-draft-button]");
    var messages = ["Writing the email…", "Reading client notes and purchases…", "Writing personal notes…", "Almost done…"];
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      button.disabled = true;
      busy.hidden = false;
      var step = 0;
      busyText.textContent = messages[0];
      var timer = setInterval(function () {
        step = Math.min(step + 1, messages.length - 1);
        busyText.textContent = messages[step];
      }, 9000);
      postForm(form)
        .then(function (result) {
          if (result.ok && result.data.redirect) { window.location.href = result.data.redirect; return; }
          throw new Error(result.data.message || "Couldn't draft the email. Try again.");
        })
        .catch(function (error) {
          clearInterval(timer);
          busyText.textContent = error.message || "Couldn't draft the email. Check your connection and try again.";
          button.disabled = false;
        });
    });
    wireRecorder(form.querySelector("textarea[name=topic]"));
  }

  // Records up to 90 seconds, then types it out with the server's speech-to-text and adds it to the text box.
  function wireRecorder(textarea) {
    var mic = document.querySelector("[data-mic]");
    if (!mic || !textarea || !window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    var label = document.querySelector("[data-mic-text]");
    var hint = document.querySelector("[data-mic-hint]");
    mic.hidden = false; label.hidden = false; hint.hidden = false;
    var recorder = null;
    var chunks = [];
    var stopTimer = null;
    var type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0] || "";

    function setState(state, text) {
      mic.classList.toggle("recording", state === "recording");
      mic.disabled = state === "working";
      mic.setAttribute("aria-label", state === "recording" ? "Stop recording" : "Record");
      label.textContent = text;
    }

    function stop() {
      if (recorder && recorder.state === "recording") recorder.stop();
    }

    mic.addEventListener("click", function () {
      if (recorder && recorder.state === "recording") { stop(); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        chunks = [];
        recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
        recorder.addEventListener("dataavailable", function (event) { if (event.data && event.data.size) chunks.push(event.data); });
        recorder.addEventListener("stop", function () {
          clearTimeout(stopTimer);
          stream.getTracks().forEach(function (track) { track.stop(); });
          setState("working", "Typing it out…");
          var blob = new Blob(chunks, { type: recorder.mimeType || type || "audio/mp4" });
          fetch("/admin/campaigns/transcribe", { method: "POST", body: blob, headers: { "content-type": blob.type || "application/octet-stream" } })
            .then(function (response) { return response.json().then(function (data) { return { ok: response.ok, data: data }; }); })
            .then(function (result) {
              if (!result.ok) throw new Error(result.data.message || "Couldn't type out the recording.");
              textarea.value = (textarea.value.trim() ? textarea.value.trim() + "\n\n" : "") + result.data.text;
              setState("idle", "Added to your text. Tap to record more");
            })
            .catch(function (error) { setState("idle", error.message || "Couldn't type out the recording. Try again."); });
        });
        recorder.start();
        setState("recording", "Recording… tap to stop");
        stopTimer = setTimeout(stop, 90000);
      }).catch(function () {
        setState("idle", "Allow the microphone to record, or type instead.");
      });
    });
  }

  function urlKeyBytes(base64url) {
    var padded = (base64url + "===".slice((base64url.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    var text = atob(padded);
    var bytes = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
    return bytes;
  }

  // Tuesday and Thursday reminders as phone notifications (the Home Screen app on iPhone).
  function wirePushButton() {
    var box = document.querySelector("[data-push]");
    if (!box) return;
    var button = box.querySelector("[data-push-button]");
    var status = box.querySelector("[data-push-status]");
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !window.Notification) {
      if (!isHomeScreenApp() && /iPhone|iPad/.test(navigator.userAgent)) status.textContent = "To get reminders as notifications, add this page to your Home Screen (Share, then Add to Home Screen) and open it from there. Reminders also come by email.";
      return;
    }
    navigator.serviceWorker.ready.then(function (registration) {
      return registration.pushManager.getSubscription().then(function (existing) {
        if (existing && Notification.permission === "granted") {
          status.textContent = "Phone notifications are on for this device.";
          // Make sure the server has it (for example after the app was reinstalled).
          fetch("/admin/campaigns/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(existing) });
          return;
        }
        if (Notification.permission === "denied") {
          status.textContent = "Notifications are blocked for this app. Turn them on in the phone's Settings, then come back.";
          return;
        }
        button.hidden = false;
        button.addEventListener("click", function () {
          button.disabled = true;
          Notification.requestPermission()
            .then(function (permission) {
              if (permission !== "granted") throw new Error("Notifications weren't allowed.");
              return fetch("/admin/campaigns/push-key").then(function (response) { return response.json(); });
            })
            .then(function (data) {
              return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlKeyBytes(data.publicKey) });
            })
            .then(function (subscription) {
              return fetch("/admin/campaigns/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(subscription) });
            })
            .then(function (response) {
              if (!response.ok) throw new Error("Couldn't save the setting.");
              button.hidden = true;
              status.textContent = "Phone notifications are on for this device.";
            })
            .catch(function (error) {
              button.disabled = false;
              status.textContent = error.message || "Couldn't turn on notifications.";
            });
        });
      });
    }).catch(function () { /* no service worker: email reminders still work */ });
  }

  /* --------------------------------------------------- Home Screen app */

  function isHomeScreenApp() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }

  // Keeps the app's own files on the phone and shows an offline screen with no connection.
  // It never stores client pages (see /admin/sw.js).
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin" }).catch(function () { /* the app works without it */ });
  }

  // A Home Screen app has no browser reload, so pulling down at the top of a page reloads it, like a native list.
  function wirePullToRefresh() {
    if (!isHomeScreenApp()) return;
    var THRESHOLD = 72;
    var indicator = document.createElement("div");
    indicator.className = "ptr";
    indicator.setAttribute("aria-hidden", "true");
    indicator.innerHTML = '<span class="ptr-spinner"></span>';
    document.body.appendChild(indicator);

    var startY = null;
    var pulled = 0;
    function reset() {
      indicator.style.transform = "";
      indicator.style.opacity = "";
      indicator.classList.remove("ptr-ready");
    }
    window.addEventListener("touchstart", function (event) {
      startY = window.scrollY <= 0 && event.touches.length === 1 ? event.touches[0].clientY : null;
      pulled = 0;
    }, { passive: true });
    window.addEventListener("touchmove", function (event) {
      if (startY === null) return;
      pulled = Math.max(0, event.touches[0].clientY - startY);
      if (window.scrollY > 0) { startY = null; reset(); return; }
      var distance = Math.min(pulled, 120);
      indicator.style.transform = "translateY(" + (distance - 48) + "px)";
      indicator.style.opacity = String(Math.min(1, distance / THRESHOLD));
      indicator.classList.toggle("ptr-ready", distance >= THRESHOLD);
    }, { passive: true });
    window.addEventListener("touchend", function () {
      if (startY === null) return;
      startY = null;
      if (pulled >= THRESHOLD) {
        indicator.classList.add("ptr-loading");
        window.location.reload();
      } else {
        reset();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireClientsPage();
    wireClientProfilePage();
    wireUploadPage();
    wireCampaignLists();
    wireDraftForm();
    registerServiceWorker();
    wirePushButton();
    wirePullToRefresh();
  });
})();
`;
