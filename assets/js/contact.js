(function () {
  var FIELDS = [
    { id: "name", key: "name", label: "名前", required: "名前を入力してください。" },
    { id: "email", key: "_replyto", label: "e-mail", required: "e-mailを入力してください。", format: "e-mailの形式を確認してください。" },
    { id: "message", key: "message", label: "内容", required: "内容を入力してください。" },
  ];

  function $(id) {
    return document.getElementById(id);
  }

  // Same request as before: POST a FormData to the form's action and ask for JSON. Only `ok` decides success.
  async function submitToFormspree(action, formData) {
    var res = await fetch(action, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: formData,
    });
    if (!res.ok) throw new Error("submit failed");
  }

  function clearError(field) {
    var input = $(field.id);
    var error = $(field.id + "-error");
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  }

  function showError(field, message) {
    var input = $(field.id);
    var error = $(field.id + "-error");
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", field.id + "-error");
    error.textContent = message;
    error.hidden = false;
  }

  // Empty or whitespace-only values, and an e-mail the browser itself rates as malformed (typeMismatch).
  function problemOf(field) {
    var input = $(field.id);
    if (!String(input.value || "").trim()) return field.required;
    if (field.format && input.validity && input.validity.typeMismatch) return field.format;
    return "";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = $("contact-form");
    if (!form) return;

    // An old cached HTML paired with this script: without every element the handler needs, stay out of the way
    // so the standard form submission still reaches the destination.
    var needed = ["contact-submit", "contact-status", "contact-failure", "contact-done", "contact-intro"];
    FIELDS.forEach(function (field) {
      needed.push(field.id, field.id + "-error");
    });
    for (var i = 0; i < needed.length; i += 1) {
      if (!$(needed[i])) return;
    }

    var submitBtn = $("contact-submit");
    var failure = $("contact-failure");
    var done = $("contact-done");
    var status = $("contact-status");
    var root = $("contact-content");

    function setReadOnly(on) {
      FIELDS.forEach(function (field) {
        var input = $(field.id);
        if (on) input.setAttribute("readonly", "");
        else input.removeAttribute("readonly");
      });
    }

    function showDone(sent) {
      form.dataset.submitState = "done";
      status.textContent = "";
      $("contact-intro").hidden = true;
      form.hidden = true;
      done.innerHTML =
        '<h2 class="contact-done-title" tabindex="-1">送信しました。</h2>' +
        '<p class="contact-done-lead">お問い合わせありがとうございます。内容を確認して、入力いただいたe-mail宛にご連絡します。</p>' +
        '<div class="contact-sent"><p class="contact-sent-row"></p><p class="contact-sent-row"></p><p class="contact-sent-row"></p></div>' +
        '<a class="site-text-link" href="../">Home →</a>';
      var rows = done.querySelectorAll(".contact-sent-row");
      FIELDS.forEach(function (field, index) {
        rows[index].textContent = field.label + "　" + sent[field.key];
      });
      done.hidden = false;
      done.querySelector("h2").focus();
    }

    function showFailure() {
      form.dataset.submitState = "failed";
      status.textContent = "";
      failure.hidden = false;
      submitBtn.textContent = "もう一度送信する";
      submitBtn.disabled = false;
      setReadOnly(false);
      submitBtn.focus();
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (form.dataset.submitState === "sending") return;
      if (root && root.dataset.settings === "loading") return;

      var firstInvalid = null;
      FIELDS.forEach(function (field) {
        var message = problemOf(field);
        if (message) {
          showError(field, message);
          if (!firstInvalid) firstInvalid = $(field.id);
        } else {
          clearError(field);
        }
      });
      if (firstInvalid) {
        form.dataset.submitState = "invalid";
        failure.hidden = true;
        firstInvalid.focus();
        return;
      }

      var formData = new FormData(form);
      var sent = {};
      FIELDS.forEach(function (field) {
        sent[field.key] = String(formData.get(field.key) === null ? "" : formData.get(field.key));
      });

      form.dataset.submitState = "sending";
      submitBtn.textContent = "送信しています…";
      submitBtn.disabled = true;
      setReadOnly(true);
      failure.hidden = true;
      status.textContent = "送信しています…";

      var action = String(form.getAttribute("action") || "").trim();
      var request = action ? submitToFormspree(action, formData) : Promise.reject(new Error("no action"));
      request.then(function () {
        showDone(sent);
      }, showFailure);
    });

    FIELDS.forEach(function (field) {
      $(field.id).addEventListener("input", function () {
        clearError(field);
      });
    });
  });
})();
