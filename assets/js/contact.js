(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setStage(stage) {
    var lead = $("contactConfirmLead");
    if (!lead) return;
    if (stage === "sending") lead.textContent = "送信しています。";
    if (stage === "success") lead.textContent = "お問い合わせを送信しました。";
    if (stage === "error") lead.textContent = "送信に失敗しました。";
  }

  function setError(message) {
    var el = $("contactConfirmError");
    if (!el) return;
    if (!message) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "block";
    el.textContent = message;
  }

  function openModal() {
    var overlay = $("contactConfirmOverlay");
    var modal = $("contactConfirmModal");
    if (!overlay || !modal) return;
    overlay.classList.add("is-open");
    modal.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    var overlay = $("contactConfirmOverlay");
    var modal = $("contactConfirmModal");
    if (!overlay || !modal) return;
    overlay.classList.remove("is-open");
    modal.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    modal.setAttribute("aria-hidden", "true");
    setError("");
  }

  function renderSummary(formData) {
    var summary = $("contactConfirmSummary");
    if (!summary) return;

    var payload = Object.fromEntries(formData.entries());
    var rows = [
      ["名前", String(payload.name || "")],
      ["e-mail", String(payload._replyto || payload.email || "")],
      ["内容", String(payload.message || "")],
    ];

    summary.innerHTML = rows
      .map(function (pair) {
        var k = pair[0];
        var v = pair[1];
        return (
          '<div class="ticket-confirm-row">' +
          '<div class="ticket-confirm-k">' +
          escapeHtml(k) +
          "</div>" +
          '<div class="ticket-confirm-v">' +
          escapeHtml(v || "-") +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  async function submitToFormspree(action, formData) {
    var res = await fetch(action, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: formData,
    });

    var json = {};
    try {
      json = await res.json();
    } catch (_e) {
      json = {};
    }

    if (!res.ok) {
      var message = "送信に失敗しました";
      if (json && json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
        message = json.errors.map(function (e) {
          return e && e.message ? String(e.message) : "";
        }).filter(Boolean).join(" / ") || message;
      }
      throw new Error(message);
    }

    return json;
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = !!busy;
    if (busy) {
      btn.dataset.originalText = btn.dataset.originalText || btn.textContent || "";
      btn.textContent = "...";
      return;
    }
    var orig = btn.dataset.originalText || "送信する";
    btn.textContent = orig;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = $("contact-form");
    if (!form) return;

    var overlay = $("contactConfirmOverlay");
    var closeBtn = $("contactConfirmCloseBtn");

    if (overlay) overlay.addEventListener("click", closeModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });

    var submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      setBusy(submitBtn, true);

      var fd = new FormData(form);
      var title = $("contactConfirmTitle");
      if (title) title.textContent = "送信中...";
      setStage("sending");
      setError("");
      renderSummary(fd);
      openModal();

      try {
        var action = String(form.getAttribute("action") || "").trim();
        if (!action) throw new Error("送信先が設定されていません");

        await submitToFormspree(action, fd);

        if (title) title.textContent = "送信しました。";
        setStage("success");
        form.reset();
      } catch (e) {
        if (title) title.textContent = "送信失敗";
        setStage("error");
        setError("お問い合わせに失敗しました: " + (e && e.message ? e.message : String(e)));
      } finally {
        setBusy(submitBtn, false);
      }
    });
  });
})();
