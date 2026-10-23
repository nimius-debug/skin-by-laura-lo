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
            if (status) status.textContent = "Found " + result.data.clientsFound + " client(s), imported " + result.data.notesImported + " note(s) from Square" + (result.data.formsLinked ? ", linked " + result.data.formsLinked + " form(s)" : "") + ". Reloading...";
            window.location.reload();
          })
          .catch(function () {
            if (status) status.textContent = "Sync failed — check your connection and try again.";
            syncBtn.disabled = false;
          });
      });
    }
  }

  /* ------------------------------------------------------------ forms page */

  // "Copy link" next to each form, to paste into a booking confirmation or a text.
  function wireFormLinks() {
    document.querySelectorAll("[data-copy-link]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var link = btn.getAttribute("data-copy-link");
        var done = function () {
          btn.textContent = "Copied";
          setTimeout(function () { btn.textContent = "Copy link"; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(done, function () { selectSource(btn); });
        } else {
          selectSource(btn);
        }
      });
    });
    function selectSource(btn) {
      var input = btn.parentNode.querySelector("[data-copy-source]");
      if (input) { input.focus(); input.select(); }
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

  // The email editor: the preview itself is editable. Laura clicks into the
  // email and types; shortly after, the words are read back into the form's
  // fields (**bold**, [named links](https://...), blank lines between
  // paragraphs) and saved, which is what the server stores and renders.
  var EDIT_BLOCK = /^(P|DIV|LI|OL|UL|H[1-6]|TABLE|TBODY|TR|TD)$/;
  var SINGLE_LINE = { subject: true, preheader: true, eyebrow: true, headline: true, tipsTitle: true, greeting: true, fallbackName: true, buttonLabel: true, buttonUrl: true, signoff: true, signName: true, shopTitle: true };
  var FIELD_FOR = { personalPs: "ps" };

  function editedText(node) {
    var out = "";
    node.childNodes.forEach(function (child) {
      if (child.nodeType === 3) { out += child.nodeValue.replace(/ /g, " "); return; }
      if (child.nodeType !== 1) return;
      var tag = child.tagName;
      var bold = tag === "STRONG" || tag === "B" || (tag === "SPAN" && /bold|[6-9]00/.test(child.style.fontWeight));
      if (tag === "BR") out += "\n";
      else if (bold) {
        var inner = editedText(child);
        out += inner.trim() ? (/^\s/.test(inner) ? " " : "") + "**" + inner.trim() + "**" + (/\s$/.test(inner) ? " " : "") : inner;
      } else if (tag === "A") {
        var href = child.getAttribute("href") || "";
        var label = editedText(child).trim();
        out += !label || label === href ? href : "[" + label + "](" + href + ")";
      } else if (EDIT_BLOCK.test(tag)) out += "\n\n" + editedText(child) + "\n\n";
      else out += editedText(child);
    });
    return out;
  }

  function tidyText(text) {
    return text.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function readEdited(el) {
    var name = el.getAttribute("data-edit");
    if (SINGLE_LINE[name]) return el.textContent.replace(/\s+/g, " ").trim();
    if (name === "tips") {
      return Array.prototype.map.call(el.querySelectorAll("li"), function (li) { return tidyText(editedText(li)).replace(/\s*\n\s*/g, " "); })
        .filter(Boolean).join("\n");
    }
    return tidyText(editedText(el));
  }

  function wireInlineEditor() {
    var form = document.querySelector("form[data-inline-editor]");
    var frame = document.querySelector("iframe.camp-frame");
    if (!form || !frame) return;
    var hints = document.querySelector("[data-voice-hints]");
    var state = form.querySelector("[data-save-state]");
    var dirty = false;
    var ready = false;
    var timer = null;
    var ticket = 0;
    var saving = null;

    function doc() { return frame.contentDocument; }
    function regions() { return doc() ? Array.prototype.slice.call(doc().querySelectorAll("[data-edit]")) : []; }
    function fit() {
      var d = doc();
      if (d && d.documentElement) frame.style.height = Math.max(400, d.documentElement.scrollHeight) + "px";
    }
    function markEmpty(el) { el.classList.toggle("is-empty", !el.textContent.trim()); }

    function collect() {
      regions().forEach(function (el) {
        var name = FIELD_FOR[el.getAttribute("data-edit")] || el.getAttribute("data-edit");
        var input = form.querySelector('[data-field="' + name + '"]');
        if (input) input.value = readEdited(el);
      });
    }

    function showState(text, error) {
      if (!state) return;
      state.textContent = text;
      state.classList.toggle("is-error", Boolean(error));
    }

    // Saves what's in the email now. Returns a promise that settles when it's saved (or failed).
    function save() {
      clearTimeout(timer);
      if (!dirty) return saving || Promise.resolve();
      collect();
      dirty = false;
      showState("Saving…");
      var body = new FormData(form);
      var previous = saving || Promise.resolve();
      var mine = previous.then(function () {
        return fetch(form.getAttribute("action"), { method: "POST", body: body, headers: { accept: "application/json" } });
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok || !data.ok) throw new Error(data.message || "Couldn't save.");
          if (!dirty) showState("Saved");
        });
      }).catch(function (error) {
        dirty = true;
        showState((error && error.message) || "Couldn't save. Check your connection.", true);
      }).then(function () {
        if (saving === mine) saving = null;
      });
      saving = mine;
      refreshHints(body);
      return mine;
    }

    function refreshHints(body) {
      if (!hints) return;
      var mine = ++ticket;
      fetch(form.getAttribute("data-hints-url"), { method: "POST", body: body, headers: { accept: "application/json" } })
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (data) {
          if (!data || mine !== ticket) return;
          var list = hints.querySelector("ul");
          list.textContent = "";
          (data.hints || []).forEach(function (hint) {
            var item = document.createElement("li");
            item.textContent = hint;
            list.appendChild(item);
          });
          hints.hidden = !(data.hints || []).length;
        })
        .catch(function () { /* keep the last hints */ });
    }

    function changed() {
      dirty = true;
      showState("Saving…");
      fit();
      clearTimeout(timer);
      timer = setTimeout(save, 800);
    }

    function setup() {
      var d = doc();
      if (ready || !d || !d.body || !d.querySelector("[data-edit]")) return;
      ready = true;
      var style = d.createElement("style");
      style.textContent = "[data-edit]{position:relative;outline:1px dashed rgba(184,113,79,.5);outline-offset:4px;border-radius:3px;cursor:text;min-height:1.2em}"
        + "[data-edit]:hover{outline-color:#B8714F}[data-edit]:focus{outline:2px solid #B8714F}"
        + "[data-edit].is-empty::before{content:attr(data-placeholder);position:absolute;left:0;top:0;color:#A99E92;font-weight:normal;pointer-events:none}"
        + "span[data-edit]{display:inline-block;min-width:1.5em}span[data-edit].is-empty{min-width:14em}span[data-edit].is-empty::before{white-space:nowrap}";
      d.head.appendChild(style);
      regions().forEach(function (el) {
        el.setAttribute("contenteditable", "true");
        el.setAttribute("spellcheck", "true");
        markEmpty(el);
        el.addEventListener("input", function () { markEmpty(el); changed(); });
        el.addEventListener("blur", save);
        el.addEventListener("keydown", function (event) {
          if (event.key === "Enter" && SINGLE_LINE[el.getAttribute("data-edit")]) event.preventDefault();
        });
      });
      // Pasted text arrives plain, so it takes on the email's own look.
      d.addEventListener("paste", function (event) {
        if (!event.target.closest || !event.target.closest("[data-edit]")) return;
        event.preventDefault();
        d.execCommand("insertText", false, (event.clipboardData || window.clipboardData).getData("text/plain"));
      });
      // Links don't open while editing; the preview after saving still opens them.
      d.addEventListener("click", function (event) {
        if (event.target.closest && event.target.closest("a")) event.preventDefault();
      });
      var first = d.querySelector("[data-edit]");
      if (first && !first.textContent.trim()) first.focus();
      fit();
    }

    frame.addEventListener("load", setup);
    setup();

    form.querySelectorAll("[data-format]").forEach(function (button) {
      // Keep the selection in the email when a button is pressed.
      button.addEventListener("mousedown", function (event) { event.preventDefault(); });
      button.addEventListener("click", function () {
        var d = doc();
        var selection = d && d.getSelection();
        var node = selection && selection.anchorNode;
        var inside = node && (node.nodeType === 1 ? node : node.parentElement);
        if (!inside || !inside.closest("[data-edit]")) return;
        if (button.getAttribute("data-format") === "bold") {
          d.execCommand("bold");
        } else {
          var address = window.prompt("Web address for the link", "https://");
          if (!address || address === "https://") return;
          if (!/^https?:\/\//i.test(address)) address = "https://" + address;
          if (selection.isCollapsed) {
            var link = d.createElement("a");
            link.href = address;
            link.textContent = address;
            selection.getRangeAt(0).insertNode(link);
          } else {
            d.execCommand("createLink", false, address);
          }
          // New links look like the email's own links.
          d.querySelectorAll("[data-edit] a:not([style])").forEach(function (link) {
            link.setAttribute("style", "color:#96583C;font-weight:bold;");
          });
        }
        changed();
      });
    });

    // The button choice shows in the email right away.
    var BUTTONS = { book: "Book a facial", shop: "Visit the shop" };
    var goal = form.querySelector("select[name=goal]");
    if (goal) {
      goal.addEventListener("change", function () {
        var row = doc() && doc().querySelector("[data-cta]");
        if (!row) return;
        row.style.display = BUTTONS[goal.value] ? "" : "none";
        if (BUTTONS[goal.value]) {
          var label = row.querySelector("a");
          label.textContent = BUTTONS[goal.value];
          markEmpty(label);
          var address = row.querySelector('[data-edit="buttonUrl"]');
          if (address) {
            address.textContent = row.getAttribute("data-url-" + goal.value) || "";
            markEmpty(address);
          }
        }
        fit();
        changed();
      });
    }

    // Anything else in the form that changes (like the product picker) saves too.
    form.addEventListener("input", changed);
    // Saving happens by itself, so the form never submits.
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      save();
    });
    // Approve, Reject and the rest wait for the last words to be saved.
    document.addEventListener("submit", function (event) {
      var other = event.target;
      if (other === form || (!dirty && !saving)) return;
      event.preventDefault();
      event.stopPropagation();
      var submitter = event.submitter;
      save().then(function () {
        if (dirty || saving) return;
        if (other.requestSubmit) other.requestSubmit(submitter && submitter.form === other ? submitter : undefined);
        else other.submit();
      });
    }, true);
    window.addEventListener("beforeunload", function (event) {
      if (!dirty && !saving) return;
      save();
      event.preventDefault();
      event.returnValue = "";
    });
  }

  // Products in the shared email, edited in the email itself: each card has a
  // Remove button, and the search box under the cards adds one from the shop
  // as Laura types its name. The hidden product fields follow the cards, in
  // order, and each change counts as an edit, so it autosaves.
  function wireProductEditing() {
    var form = document.querySelector("form[data-inline-editor]");
    var frame = document.querySelector("iframe.camp-frame");
    var fields = form && form.querySelector("[data-product-fields]");
    if (!form || !frame || !fields) return;
    var shop = [];
    try { shop = JSON.parse(form.getAttribute("data-shop") || "[]"); } catch (error) { shop = []; }
    var max = Number(form.getAttribute("data-max-products")) || 6;
    var wired = null;

    function doc() { return frame.contentDocument; }
    function cards() { return doc() ? Array.prototype.slice.call(doc().querySelectorAll("[data-product]")) : []; }
    function names() { return cards().map(function (card) { return card.getAttribute("data-product"); }); }
    function fit() {
      var d = doc();
      if (d && d.documentElement) frame.style.height = Math.max(400, d.documentElement.scrollHeight) + "px";
    }
    function placeholder() {
      var query = doc() && doc().querySelector("[data-product-query]");
      if (!query) return;
      var full = names().length >= max;
      query.disabled = full;
      query.placeholder = full ? "This email has the most products it can hold (" + max + ")" : "+ Add a product: type its name";
    }
    function sync() {
      fields.textContent = "";
      names().forEach(function (name) {
        var input = document.createElement("input");
        input.type = "hidden";
        input.name = "product";
        input.value = name;
        fields.appendChild(input);
      });
      var title = doc() && doc().querySelector("[data-products-title]");
      if (title) title.style.display = cards().length ? "" : "none";
      placeholder();
      fit();
      form.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // Every word typed has to appear in the name, so "vit c" finds "Vitamin C Serum".
    function matches(text) {
      var words = text.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) return [];
      var used = names();
      return shop.filter(function (product) {
        var name = product.name.toLowerCase();
        return used.indexOf(product.name) < 0 && words.every(function (word) { return name.indexOf(word) >= 0; });
      }).slice(0, 8);
    }

    function addProduct(name) {
      var list = doc() && doc().querySelector("[data-product-list]");
      if (!list || names().indexOf(name) >= 0 || names().length >= max) return;
      fetch(form.getAttribute("data-product-card-url") + "?name=" + encodeURIComponent(name), { headers: { accept: "application/json" } })
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (data) {
          if (!data || !doc() || names().indexOf(data.name) >= 0) return;
          var holder = doc().createElement("tbody");
          holder.innerHTML = data.html;
          var row = holder.querySelector("tr");
          if (!row) return;
          list.appendChild(row);
          sync();
        })
        .catch(function () { /* nothing added; she can try again */ });
    }

    function setup() {
      var d = doc();
      if (!d || !d.body || wired === d || !d.querySelector("[data-products]")) return;
      wired = d;
      d.addEventListener("click", function (event) {
        var button = event.target.closest && event.target.closest("[data-remove-product]");
        if (!button) return;
        event.preventDefault();
        button.closest("[data-product]").remove();
        sync();
      });

      var query = d.querySelector("[data-product-query]");
      var box = d.querySelector("[data-product-matches]");
      if (!query || !box) return;
      var found = [];
      var active = 0;
      function close() { box.style.display = "none"; box.textContent = ""; found = []; fit(); }
      function choose(index) {
        var product = found[index];
        if (!product) return;
        query.value = "";
        close();
        addProduct(product.name);
      }
      function show() {
        found = matches(query.value);
        box.textContent = "";
        if (!query.value.trim()) { close(); return; }
        if (!found.length) {
          var none = d.createElement("div");
          none.textContent = "No product in the shop matches “" + query.value.trim() + "”";
          none.setAttribute("style", "padding:12px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6E6358;");
          box.appendChild(none);
        }
        found.forEach(function (product, index) {
          var option = d.createElement("div");
          option.setAttribute("role", "option");
          option.setAttribute("style", "display:flex;align-items:center;gap:10px;padding:10px 14px;min-height:44px;cursor:pointer;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#2A241F;border-top:" + (index ? "1px solid #E7DCCB" : "0") + ";background:" + (index === active ? "#F8EFE7" : "#FFFFFF") + ";");
          var thumb = d.createElement(product.image ? "img" : "span");
          thumb.setAttribute("style", "width:36px;height:36px;border-radius:8px;object-fit:cover;flex:none;background:#F8EFE7;");
          if (product.image) { thumb.src = product.image; thumb.alt = ""; }
          option.appendChild(thumb);
          var name = d.createElement("span");
          name.textContent = product.name;
          name.setAttribute("style", "flex:1;font-weight:bold;");
          option.appendChild(name);
          if (product.price) {
            var price = d.createElement("span");
            price.textContent = product.price;
            price.setAttribute("style", "color:#96583C;font-weight:bold;white-space:nowrap;");
            option.appendChild(price);
          }
          // mousedown, so the pick happens before the box loses focus.
          option.addEventListener("mousedown", function (event) { event.preventDefault(); choose(index); });
          box.appendChild(option);
        });
        box.style.display = "block";
        fit();
      }
      query.addEventListener("input", function () { active = 0; show(); });
      query.addEventListener("keydown", function (event) {
        if (event.key === "ArrowDown" && found.length) { event.preventDefault(); active = (active + 1) % found.length; show(); }
        else if (event.key === "ArrowUp" && found.length) { event.preventDefault(); active = (active - 1 + found.length) % found.length; show(); }
        else if (event.key === "Enter") { event.preventDefault(); choose(active); }
        else if (event.key === "Escape") { query.value = ""; close(); }
      });
      query.addEventListener("blur", function () { setTimeout(close, 150); });
      placeholder();
    }
    frame.addEventListener("load", setup);
    setup();
  }

  // The new-email page's cost estimate, redone as the topic grows. Same math as cost.js estimateCampaign.
  function wireCostEstimate() {
    var box = document.querySelector("[data-cost-estimate]");
    var topic = document.querySelector("form[data-draft-form] textarea[name=topic]");
    if (!box || !topic) return;
    var inputs;
    try { inputs = JSON.parse(box.getAttribute("data-cost-estimate")); } catch (error) { return; }
    if (!inputs || !inputs.price) return;
    function cost(topicChars, matched) {
      var calls = Math.ceil(matched / inputs.batch);
      var input = inputs.sharedInput + Math.ceil(topicChars / 3.5) + calls * inputs.personalCallInput + matched * inputs.clientInput;
      var output = inputs.sharedOutput + calls * inputs.personalCallOutput + matched * inputs.clientOutput;
      return (input * inputs.price.input + output * inputs.price.output) / 1e6;
    }
    function format(amount) {
      if (amount < 0.01) return "under 1¢";
      return "$" + amount.toFixed(2);
    }
    function update() {
      var chars = topic.value.length;
      box.querySelector("[data-cost-email]").textContent = "About " + format(cost(chars, 0));
      box.querySelector("[data-cost-examples]").textContent = "If 10 clients match: about " + format(cost(chars, 10)) + ". If 30 match: about " + format(cost(chars, 30)) + ".";
      box.querySelector("[data-cost-all]").textContent = "about " + format(cost(chars, inputs.clientsWithNotes));
    }
    topic.addEventListener("input", update);
    update();
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
    wireFormLinks();
    wireClientProfilePage();
    wireUploadPage();
    wireCampaignLists();
    wireDraftForm();
    wireInlineEditor();
    wireProductEditing();
    wireCostEstimate();
    registerServiceWorker();
    wirePushButton();
    wirePullToRefresh();
  });
})();
`;
