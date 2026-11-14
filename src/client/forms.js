// Turns a client form (src/pages/forms.js) into a guided, one-step-at-a-time
// flow: a progress bar, steps for services she isn't booking skipped, a
// "tell me more" box only after a Yes, and each step checked before moving on.
// Plain ES5 like cart.js, no build step. The server checks everything again.

export const FORMS_JS = `
(function () {
  "use strict";
  var form = document.querySelector("[data-client-form]");
  if (!form) return;

  var steps = Array.prototype.slice.call(form.querySelectorAll("[data-step]"));
  var progress = document.querySelector("[data-progress]");
  var back = form.querySelector("[data-back]");
  var next = form.querySelector("[data-next]");
  var submit = form.querySelector("[data-submit]");
  var started = form.querySelector("[data-started]");
  var current = 0;

  document.documentElement.classList.add("form-js");
  if (started && !started.value) started.value = String(Date.now());

  function values(name) {
    return Array.prototype.slice.call(form.querySelectorAll('[name="' + name + '"]'))
      .filter(function (input) { return (input.type !== "checkbox" && input.type !== "radio") || input.checked; })
      .map(function (input) { return input.value; });
  }

  function applies(step) {
    var rule = step.getAttribute("data-show-if");
    if (!rule) return true;
    try { rule = JSON.parse(rule); } catch (error) { return true; }
    var picked = values(rule.question);
    return rule.anyOf.some(function (option) { return picked.indexOf(option) !== -1; });
  }

  function active() { return steps.filter(applies); }

  // "Tell me more" boxes show only after Yes, and the "Other" box only once Other is picked.
  function syncDetails() {
    Array.prototype.forEach.call(form.querySelectorAll("[data-details-for]"), function (box) {
      var yes = values(box.getAttribute("data-details-for"))[0] === "Yes";
      box.hidden = !yes;
    });
    Array.prototype.forEach.call(form.querySelectorAll("[data-other-for]"), function (box) {
      box.hidden = values(box.getAttribute("data-other-for")).indexOf("__other") === -1;
    });
  }

  // Photos: show each one in its frame, and shrink big phone photos before they're sent so the upload is quick.
  var MAX_SIDE = 2000;
  function shrink(file) {
    return new Promise(function (resolve) {
      if (!window.createImageBitmap || !window.DataTransfer || file.size < 1500000 || !/^image\\/(jpeg|png|webp)$/.test(file.type)) return resolve(file);
      createImageBitmap(file).then(function (bitmap) {
        var scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (!blob || blob.size >= file.size) return resolve(file);
          resolve(new File([blob], file.name.replace(/\\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
        }, "image/jpeg", 0.85);
      }).catch(function () { resolve(file); });
    });
  }
  Array.prototype.forEach.call(form.querySelectorAll("[data-photo]"), function (input) {
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      var preview = input.parentNode.querySelector("[data-photo-preview]");
      if (!file) { preview.hidden = true; input.parentNode.classList.remove("has-photo"); return; }
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
      input.parentNode.classList.add("has-photo");
      shrink(file).then(function (smaller) {
        if (smaller === file) return;
        try { var list = new DataTransfer(); list.items.add(smaller); input.files = list.files; } catch (error) { /* keep the original */ }
      });
    });
  });

  // "None of the above" clears the other choices, and picking one clears it.
  form.addEventListener("change", function (event) {
    var input = event.target;
    if (input.type === "checkbox" && input.checked && input.name) {
      var group = form.querySelectorAll('input[type="checkbox"][name="' + input.name + '"]');
      Array.prototype.forEach.call(group, function (other) {
        if (other === input) return;
        if (input.hasAttribute("data-none") || other.hasAttribute("data-none")) other.checked = false;
      });
    }
    syncDetails();
    clearError(input.closest("[data-question]"));
    render();
  });
  form.addEventListener("input", function (event) { clearError(event.target.closest("[data-question]")); });

  function clearError(question) {
    if (!question) return;
    var error = question.querySelector("[data-error-for]");
    if (error) error.hidden = true;
    question.classList.remove("has-error");
    Array.prototype.forEach.call(question.querySelectorAll("[aria-invalid]"), function (el) { el.removeAttribute("aria-invalid"); });
  }

  function problem(question) {
    var type = question.getAttribute("data-type");
    var name = question.getAttribute("data-question");
    var required = question.hasAttribute("data-required");
    var picked = values(name);
    var text = (picked[0] || "").trim();
    if (type === "photos") {
      var inputs = question.querySelectorAll("input[type=file]");
      var added = Array.prototype.filter.call(inputs, function (input) { return input.files && input.files.length; });
      if (added.some(function (input) { return !/^image\\//.test(input.files[0].type); })) return "Please add photos only.";
      return required && added.length < inputs.length ? "Please add all " + inputs.length + " photos." : "";
    }
    if (picked.indexOf("__other") !== -1) {
      var otherBox = form.querySelector('[name="' + name + '__other"]');
      if (otherBox && !otherBox.value.trim()) return "Please type your answer.";
    }
    if (type === "agree") return required && !picked.length ? "Please tick this to continue." : "";
    if (type === "choices" || type === "choice" || type === "yesno") return required && !picked.length ? "Please pick an answer." : "";
    if (required && !text) return type === "signature" ? "Please type your full name to sign." : "Please fill this in.";
    if (type === "email" && text && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(text)) return "That email doesn't look right.";
    if (type === "date" && text) {
      var today = new Date().toISOString().slice(0, 10);
      if (text > today || text < "1900-01-01") return "Please check this date.";
    }
    return "";
  }

  function check(step) {
    var first = null;
    Array.prototype.forEach.call(step.querySelectorAll("[data-question]"), function (question) {
      var message = problem(question);
      var error = question.querySelector("[data-error-for]");
      if (!message) { clearError(question); return; }
      question.classList.add("has-error");
      if (error) { error.textContent = message; error.hidden = false; }
      var field = question.querySelector("input, textarea");
      if (field) field.setAttribute("aria-invalid", "true");
      if (!first) first = question;
    });
    if (first) {
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      var target = first.querySelector("input, textarea");
      if (target) target.focus({ preventScroll: true });
    }
    return !first;
  }

  function render(focus) {
    var list = active();
    if (current >= list.length) current = list.length - 1;
    steps.forEach(function (step) {
      var on = step === list[current];
      step.hidden = !on;
      // A step she isn't booking sends nothing.
      Array.prototype.forEach.call(step.querySelectorAll("input, textarea"), function (input) { input.disabled = !applies(step); });
    });
    back.hidden = current === 0;
    next.hidden = current === list.length - 1;
    submit.hidden = current !== list.length - 1;
    if (progress) {
      progress.hidden = false;
      progress.querySelector("[data-progress-count]").textContent = "Step " + (current + 1) + " of " + list.length;
      progress.querySelector("[data-progress-title]").textContent = list[current].getAttribute("data-title");
      progress.querySelector("[data-progress-bar]").style.width = Math.round(((current + 1) / list.length) * 100) + "%";
    }
    list.forEach(function (step, index) {
      var count = step.querySelector(".form-step-count");
      if (count) count.textContent = "Step " + (index + 1) + " of " + list.length;
    });
    if (focus) {
      var title = list[current].querySelector(".form-step-title");
      window.scrollTo({ top: Math.max(0, form.getBoundingClientRect().top + window.scrollY - 140), behavior: "smooth" });
      if (title) title.focus({ preventScroll: true });
    }
  }

  next.addEventListener("click", function () {
    var list = active();
    if (!check(list[current])) return;
    current += 1;
    render(true);
  });
  back.addEventListener("click", function () {
    current = Math.max(0, current - 1);
    render(true);
  });
  // Enter in a short field moves on instead of sending the form early.
  form.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || event.target.tagName !== "INPUT" || submit.hidden === false) return;
    event.preventDefault();
    next.click();
  });

  form.addEventListener("submit", function (event) {
    var list = active();
    for (var index = 0; index < list.length; index += 1) {
      if (!check(list[index])) {
        event.preventDefault();
        current = index;
        render(false);
        check(list[index]);
        return;
      }
    }
    submit.disabled = true;
    submit.textContent = "Sending…";
  });

  // Coming back from the server with a problem: open the first step that has one.
  var firstError = form.querySelector(".form-error:not([hidden])");
  if (firstError) {
    var withError = firstError.closest("[data-step]");
    var index = active().indexOf(withError);
    if (index > 0) current = index;
  }

  syncDetails();
  render(false);
  if (firstError) check(active()[current]);
})();
`;
