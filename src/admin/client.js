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

  document.addEventListener("DOMContentLoaded", function () {
    wireClientsPage();
    wireClientProfilePage();
    wireUploadPage();
  });
})();
`;
