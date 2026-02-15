(function () {
  const base = (window.SITE_API_BASE || "").replace(/\/+$/, "");
  const apiBase = base || "";
  const STORAGE_KEY = "1212hp_ticket_draft_v1";
  let ticketFieldConfig = {
    showQuantity: true,
    showMessage: true,
    submitLabel: "予約する",
    labelQuantity: "枚数",
    labelMessage: "備考",
  };
  let siteDataVersion = "";

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderSiteFooter(site) {
    const footer = document.getElementById("site-footer");
    if (!footer) return;
    const data = site && typeof site === "object" ? site : {};
    const text = String(data.footerText || "").trim();
    footer.textContent = text || "";
  }

  function isInstagramUrl(url) {
    const value = String(url || "").trim();
    if (!value) return false;
    return /^https?:\/\/(www\.)?instagram\.com\//i.test(value);
  }

  async function fetchSiteData() {
    const endpoint = apiBase ? `${apiBase}/api/public/site-data` : "/api/public/site-data";
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) throw new Error("failed to load site data");
    const payload = await res.json();
    const data = payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
    const meta = payload && typeof payload === "object" && payload.meta ? payload.meta : {};
    siteDataVersion = meta && meta.updatedAt ? String(meta.updatedAt) : "";
    return data;
  }

  function parseQuery() {
    const url = new URL(window.location.href);
    return {
      liveId: url.searchParams.get("liveId") || "",
    };
  }

  function buildLiveOptions(siteData) {
    const upcoming = (siteData.live && siteData.live.upcoming) || [];
    const past = (siteData.live && siteData.live.past) || [];
    const items = [...upcoming, ...past];
    return items.map((l) => ({
      id: l.id,
      label: `${l.date || ""} ${l.venue || ""}`.trim() || l.id,
      isPast: past.some((p) => p.id === l.id),
    }));
  }

  function resolveAssetPath(raw) {
    if (!raw) return "";
    const value = String(raw).trim();
    if (!value) return "";
    if (/^https?:\/\//.test(value) || value.startsWith("/")) return value;
    if (value.startsWith("../") || value.startsWith("./")) return value;
    return `../${value.replace(/^\/+/, "")}`;
  }

  function withCacheBust(url) {
    const value = String(url || "").trim();
    const v = String(siteDataVersion || "").trim();
    if (!value || !v) return value;
    const sep = value.includes("?") ? "&" : "?";
    return `${value}${sep}v=${encodeURIComponent(v)}`;
  }

  function renderTicketCopy(ticket) {
    const introEl = $("ticket-intro");
    const noticeEl = $("ticket-notice");
    const data = ticket && typeof ticket === "object" ? ticket : {};
    const intro = String(data.introText || "").trim();
    const notice = String(data.noticeText || "").trim();
    if (introEl && intro) introEl.textContent = intro;
    if (noticeEl && notice) noticeEl.textContent = notice;
  }

  function renderTicketFields(ticket) {
    const data = ticket && typeof ticket === "object" ? ticket : {};
    const fields = data.fields && typeof data.fields === "object" ? data.fields : {};

    const showQuantity = fields.showQuantity !== false;
    const showMessage = fields.showMessage !== false;

    const quantityWrap = $("ticket-field-quantity");
    const messageWrap = $("ticket-field-message");
    if (quantityWrap) quantityWrap.style.display = showQuantity ? "" : "none";
    if (messageWrap) messageWrap.style.display = showMessage ? "" : "none";

    const qLabel = String(fields.labelQuantity || "").trim();
    const mLabel = String(fields.labelMessage || "").trim();
    const mPlaceholder = String(fields.placeholderMessage || "").trim();
    const submitLabel = String(fields.submitLabel || "").trim();

    const qLabelEl = $("ticket-label-quantity");
    const mLabelEl = $("ticket-label-message");
    const msgEl = $("message");
    const submitBtn = $("submitBtn");
    const quantityEl = $("quantity");

    if (qLabelEl && qLabel) qLabelEl.textContent = qLabel;
    if (mLabelEl && mLabel) mLabelEl.textContent = mLabel;
    if (msgEl && mPlaceholder) msgEl.setAttribute("placeholder", mPlaceholder);
    if (submitBtn && submitLabel) submitBtn.textContent = submitLabel;

    // Keep form validity sane when fields are hidden.
    if (quantityEl) {
      quantityEl.required = showQuantity;
      if (!showQuantity) quantityEl.value = "1";
    }
    if (msgEl && !showMessage) {
      msgEl.value = "";
    }

    ticketFieldConfig = {
      showQuantity,
      showMessage,
      submitLabel: submitLabel || "予約する",
      labelQuantity: qLabel || "枚数",
      labelMessage: mLabel || "備考",
    };

    return ticketFieldConfig;
  }

  function renderSelectedLivePreview(siteData, liveId) {
    const container = $("ticket-live-preview");
    if (!container) return;
    const upcoming = (siteData.live && siteData.live.upcoming) || [];
    const past = (siteData.live && siteData.live.past) || [];
    const all = [...upcoming, ...past];
    const live = all.find((l) => String(l.id) === String(liveId));
    if (!live) {
      container.innerHTML = "";
      return;
    }

    const imageSrc = withCacheBust(resolveAssetPath(live.image || ""));
    const safeDesc = escapeHtml(String(live.description || "").replace(/<br\s*\/?>/gi, "\n")).replace(/\n/g, "<br>");
    const instagramHref = isInstagramUrl(live.link) ? escapeHtml(live.link) : "";

    container.innerHTML = `
      <div style="padding: 16px 18px; border: 1px solid var(--line); border-radius: var(--radius-md); background: rgba(255,255,255,0.7);">
        <div style="display:flex; gap: 14px; align-items: flex-start; flex-wrap: wrap;">
          ${imageSrc ? `<img src="${escapeHtml(imageSrc)}" alt="" style="width: 120px; height: 120px; object-fit: cover; border-radius: 14px; border: 1px solid var(--line); background: rgba(255,255,255,0.7);">` : ""}
          <div style="flex: 1; min-width: 220px;">
            <div style="font-family: var(--font-display); font-size: 1.05rem; letter-spacing: 0.08em;">${escapeHtml(`${live.date || ""} ${live.venue || ""}`.trim())}</div>
            ${safeDesc ? `<div style="margin-top: 8px; color: var(--ink-muted); line-height: 1.7;">${safeDesc}</div>` : ""}
            ${instagramHref ? `<div style="margin-top: 12px;"><a href="${instagramHref}" class="application-link" target="_blank" rel="noopener">▷instagram</a></div>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  function renderSelect(options, selectedId) {
    const select = $("liveId");
    select.innerHTML = options
      .map((opt) => {
        const disabled = opt.isPast ? "disabled" : "";
        const selected = opt.id === selectedId ? "selected" : "";
        return `<option value="${escapeHtml(opt.id)}" ${selected} ${disabled}>${escapeHtml(opt.label)}${opt.isPast ? " (終了)" : ""}</option>`;
      })
      .join("");
  }

  async function submitReservation(formData) {
    const endpoint = apiBase ? `${apiBase}/api/public/ticket-reservations` : "/api/public/ticket-reservations";
    const payload = Object.fromEntries(formData.entries());
    payload.quantity = Number(payload.quantity || 1);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "submit failed");
    return json;
  }

  function safeGetText(selectEl) {
    if (!selectEl || selectEl.selectedIndex < 0) return "";
    const opt = selectEl.options[selectEl.selectedIndex];
    return opt ? String(opt.textContent || "").trim() : "";
  }

  function setConfirmError(message) {
    const el = $("ticketConfirmError");
    if (!el) return;
    if (!message) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "block";
    el.textContent = message;
  }

  function setConfirmStage(stage) {
    const lead = $("ticketConfirmLead");
    if (!lead) return;
    if (stage === "sending") lead.textContent = "予約を送信しています。";
    if (stage === "success") lead.textContent = "予約しました。";
    if (stage === "error") lead.textContent = "送信に失敗しました。";
  }

  function openConfirmModal() {
    const overlay = $("ticketConfirmOverlay");
    const modal = $("ticketConfirmModal");
    if (!overlay || !modal) return;
    overlay.classList.add("is-open");
    modal.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeConfirmModal() {
    const overlay = $("ticketConfirmOverlay");
    const modal = $("ticketConfirmModal");
    if (!overlay || !modal) return;
    overlay.classList.remove("is-open");
    modal.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    modal.setAttribute("aria-hidden", "true");
    setConfirmError("");
  }

  function renderConfirmSummary(formData) {
    const summary = $("ticketConfirmSummary");
    if (!summary) return;
    const select = $("liveId");
    const liveText = safeGetText(select);
    const payload = Object.fromEntries(formData.entries());
    const message = String(payload.message || "").trim();

    const rows = [
      ["ライブ", liveText || String(payload.liveId || "")],
      ["名前", String(payload.name || "")],
      ["e-mail", String(payload.email || "")],
      ...(ticketFieldConfig.showQuantity ? [[ticketFieldConfig.labelQuantity, String(payload.quantity || "1")]] : []),
      ...(ticketFieldConfig.showMessage ? [[ticketFieldConfig.labelMessage, message ? message : "-"]] : []),
    ];

    summary.innerHTML = rows
      .map(([k, v]) => {
        return `
          <div class="ticket-confirm-row">
            <div class="ticket-confirm-k">${escapeHtml(k)}</div>
            <div class="ticket-confirm-v">${escapeHtml(v)}</div>
          </div>
        `;
      })
      .join("");
  }

  function setResult(html, kind) {
    const el = $("ticket-result");
    el.innerHTML = html;
    el.style.color = kind === "error" ? "crimson" : "inherit";
  }

  function redirectToComplete(reservation) {
    if (!reservation) return false;
    const url = new URL("./complete/", window.location.href);
    if (reservation.id) url.searchParams.set("rid", reservation.id);
    if (reservation.liveDate) url.searchParams.set("date", reservation.liveDate);
    if (reservation.liveVenue) url.searchParams.set("venue", reservation.liveVenue);
    window.location.assign(url.toString());
    return true;
  }

  async function boot() {
    const query = parseQuery();
    const form = $("ticket-form");
    const submitBtn = $("submitBtn");

    try {
      const siteData = await fetchSiteData();
      renderSiteFooter(siteData.site || {});
      renderTicketCopy(siteData.ticket || {});
      renderTicketFields(siteData.ticket || {});
      const options = buildLiveOptions(siteData).filter((o) => !o.isPast);
      if (options.length === 0) {
        renderSelect([{ id: "", label: "開催予定のライブがありません", isPast: false }], "");
        if (submitBtn) submitBtn.disabled = true;
        return;
      }
      const selected = options.some((o) => o.id === query.liveId) ? query.liveId : options[0].id;
      renderSelect(options, selected);
      renderSelectedLivePreview(siteData, selected);
      const liveSelect = $("liveId");
      if (liveSelect) {
        liveSelect.addEventListener("change", () => {
          renderSelectedLivePreview(siteData, liveSelect.value);
          try {
            const raw = localStorage.getItem(STORAGE_KEY) || "";
            const draft = raw ? JSON.parse(raw) : {};
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...(draft || {}), liveId: liveSelect.value }));
          } catch (_e) {}
        });
      }
    } catch (e) {
      setResult(`データ取得に失敗しました: ${escapeHtml(e.message)}`, "error");
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    const url = new URL(window.location.href);
    const dryRun = url.searchParams.get("dryRun") === "1";

    // Draft restore (avoid losing input when users go back/fwd).
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || "";
      const draft = raw ? JSON.parse(raw) : null;
      if (draft && typeof draft === "object") {
        if (form && draft.liveId) $("liveId").value = String(draft.liveId);
        if (form && draft.name) $("name").value = String(draft.name);
        if (form && draft.email) $("email").value = String(draft.email);
        if (form && draft.quantity) $("quantity").value = String(draft.quantity);
        if (form && draft.message) $("message").value = String(draft.message);
      }
    } catch (_e) {}

    function persistDraft() {
      if (!form) return;
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            liveId: payload.liveId || "",
            name: payload.name || "",
            email: payload.email || "",
            quantity: payload.quantity || "1",
            message: payload.message || "",
          })
        );
      } catch (_e) {}
    }

    ["liveId", "name", "email", "quantity", "message"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", persistDraft);
      el.addEventListener("input", persistDraft);
    });

    const overlay = $("ticketConfirmOverlay");
    const closeBtn = $("ticketConfirmCloseBtn");
    if (overlay) overlay.addEventListener("click", closeConfirmModal);
    if (closeBtn) closeBtn.addEventListener("click", closeConfirmModal);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeConfirmModal();
    });

  function setBusy(busy) {
    if (!submitBtn) return;
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? "..." : ticketFieldConfig.submitLabel;
  }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setBusy(true);
      try {
        const fd = new FormData(ev.target);
        setConfirmStage("sending");
        const title = $("ticketConfirmTitle");
        if (title) title.textContent = "送信中...";
        renderConfirmSummary(fd);
        openConfirmModal();

        setConfirmError("");

        if (dryRun) {
          if (title) title.textContent = "予約しました。";
          setConfirmStage("success");
          // keep the summary as-is (no extra confirmation step)
          ev.target.reset();
          return;
        }

        const res = await submitReservation(fd);
        const r = res.reservation || {};
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (_e) {}

        if (title) title.textContent = "予約しました。";
        setConfirmStage("success");
        // Keep the pre-submit summary (no second click UX).

        ev.target.reset();
      } catch (e) {
        const title = $("ticketConfirmTitle");
        if (title) title.textContent = "送信失敗";
        setConfirmStage("error");
        setConfirmError(`予約に失敗しました: ${e.message}`);
      } finally {
        setBusy(false);
      }
    });
  }

  boot();
})();
