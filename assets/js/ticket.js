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
  let eligibleLiveIds = new Set();

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

  function getLiveOperations() {
    const operations = window.LiveOperations;
    return operations
      && typeof operations.getTicketCta === "function"
      && typeof operations.resolveLiveById === "function"
      ? operations
      : null;
  }

  function buildLiveOptions(siteData) {
    const operations = getLiveOperations();
    if (!operations) return [];
    const live = siteData && siteData.live && typeof siteData.live === "object" ? siteData.live : {};
    const upcoming = Array.isArray(live.upcoming) ? live.upcoming : [];
    return upcoming
      .map((item) => {
        const id = String(item && item.id != null ? item.id : "");
        const resolved = operations.resolveLiveById(siteData, id);
        if (resolved.status !== "unique" || resolved.category !== "upcoming") return null;
        const uniqueLive = resolved.live;
        const internalUrl = `./?liveId=${encodeURIComponent(id)}`;
        const cta = operations.getTicketCta(uniqueLive, internalUrl, { isPast: false });
        if (!id || !cta.active || cta.external) return null;
        return {
          id,
          label: `${uniqueLive.date || ""} ${uniqueLive.venue || ""}`.trim() || id,
        };
      })
      .filter(Boolean);
  }

  function findLiveRoute(siteData, liveId) {
    const operations = getLiveOperations();
    if (!operations) return { type: "helperUnavailable", live: null, cta: null };
    const resolved = operations.resolveLiveById(siteData, liveId);
    if (resolved.status === "ambiguous") return { type: "ambiguous", live: null, cta: null };
    if (resolved.status !== "unique") return { type: "unknown", live: null, cta: null };
    const cta = operations.getTicketCta(resolved.live, `./?liveId=${encodeURIComponent(String(liveId))}`, {
      isPast: resolved.category === "past",
    });
    if (cta.reason === "reservationClosed") return { type: "closed", live: resolved.live, cta };
    if (cta.reason === "past") return { type: "past", live: resolved.live, cta };
    if (cta.reason === "invalidTicketUrl") return { type: "invalid", live: resolved.live, cta };
    if (cta.active && cta.external) return { type: "external", live: resolved.live, cta };
    if (cta.active) return { type: "internal", live: resolved.live, cta };
    return { type: "unavailable", live: resolved.live, cta };
  }

  function setRouteMessage(route) {
    const element = $("ticket-route-message");
    if (!element) return;
    if (!route) {
      element.hidden = true;
      element.innerHTML = "";
      return;
    }
    element.hidden = false;
    if (route.type === "external" && route.cta) {
      element.innerHTML = `このライブの予約は外部サイトで受け付けています。<a class="application-link" href="${escapeHtml(route.cta.url)}" target="_blank" rel="noopener">外部サイトで予約</a>`;
      return;
    }
    const messages = {
      helperUnavailable: "予約情報を確認できません。時間をおいて再度お試しください。",
      past: "指定されたライブは終了したライブです。別のライブを選択してください。",
      closed: "指定されたライブの予約受付は終了しています。別のライブを選択してください。",
      invalid: "指定されたライブの予約URLが無効です。別のライブを選択してください。",
      ambiguous: "Live IDが重複しているため、指定されたライブを一意に特定できません。",
      unknown: "指定されたライブが見つかりません。別のライブを選択してください。",
      unavailable: "指定されたライブは現在予約できません。別のライブを選択してください。",
      empty: "現在、このサイトで予約できるライブはありません。",
      invalidSelection: "このライブはこのフォームから予約できません。ライブを選択し直してください。",
    };
    element.textContent = messages[route.type] || messages.unavailable;
    element.innerHTML = escapeHtml(element.textContent);
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
    const operations = getLiveOperations();
    const resolved = operations ? operations.resolveLiveById(siteData, liveId) : null;
    if (!resolved || resolved.status !== "unique") {
      container.innerHTML = "";
      return;
    }
    const live = resolved.live;

    const imageSrc = withCacheBust(resolveAssetPath(live.image || ""));
    const safeDesc = escapeHtml(String(live.description || "").replace(/<br\s*\/?>/gi, "\n")).replace(/\n/g, "<br>");
    const instagramHref = isInstagramUrl(live.link) ? escapeHtml(live.link) : "";

    container.innerHTML = `
      <div style="padding: 16px 18px; border: 1px solid var(--line); border-radius: var(--radius-md); background: rgba(255,255,255,0.7);">
        <div style="display:flex; gap: 14px; align-items: flex-start; flex-wrap: wrap;">
          ${imageSrc ? `<img src="${escapeHtml(imageSrc)}" alt="" style="width: 120px; height: 120px; object-fit: cover; border-radius: 14px; border: 1px solid var(--line); background: rgba(255,255,255,0.7);">` : ""}
          <div style="flex: 1; min-width: 220px;">
            <div style="font-family: var(--font-display); font-size: 1.05rem; letter-spacing: 0.08em;">${escapeHtml(`${live.date || ""} ${live.venue || ""}`.trim())}</div>
            ${String(live.title || "").trim() ? `<div style="margin-top: 6px; font-weight: 700; letter-spacing: 0.06em;">${escapeHtml(String(live.title || "").trim())}</div>` : ""}
            ${safeDesc ? `<div style="margin-top: 8px; color: var(--ink-muted); line-height: 1.7;">${safeDesc}</div>` : ""}
            ${instagramHref ? `<div style="margin-top: 12px;"><a href="${instagramHref}" class="application-link" target="_blank" rel="noopener">▷instagram</a></div>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  function renderSelect(options, selectedId) {
    const select = $("liveId");
    if (!select) return;
    select.innerHTML = options
      .map((opt) => {
        const disabled = opt.disabled ? "disabled" : "";
        const selected = opt.id === selectedId ? "selected" : "";
        return `<option value="${escapeHtml(opt.id)}" ${selected} ${disabled}>${escapeHtml(opt.label)}</option>`;
      })
      .join("");
  }

  async function submitReservation(payload) {
    const endpoint = apiBase ? `${apiBase}/api/public/ticket-reservations` : "/api/public/ticket-reservations";
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

  function buildPublicReservationPayload(liveSnapshot) {
    const valueOf = (id) => String($(id) && $(id).value || "");
    const quantity = Number(valueOf("quantity"));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error("枚数は1〜10の整数で入力してください。");
    }
    return Object.freeze({
      liveId: String(liveSnapshot && liveSnapshot.id || ""),
      name: valueOf("name").trim(),
      email: valueOf("email").trim(),
      quantity,
      message: valueOf("message").trim(),
      company: valueOf("company"),
    });
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

  function renderConfirmSummary(payload, liveSnapshot) {
    const summary = $("ticketConfirmSummary");
    if (!summary) return;
    const selectedLive = liveSnapshot && typeof liveSnapshot === "object" ? liveSnapshot : {};
    const message = String(payload.message || "").trim();

    const rows = [
      ["ライブ", String(selectedLive.label || selectedLive.id || payload.liveId || "")],
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
    const liveSelect = $("liveId");
    let siteData = null;

    if (!getLiveOperations()) {
      if (liveSelect) liveSelect.innerHTML = "";
      if (submitBtn) submitBtn.disabled = true;
      setRouteMessage({ type: "helperUnavailable" });
      return;
    }

    let draft = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || "";
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") draft = parsed;
    } catch (_e) {}

    try {
      siteData = await fetchSiteData();
      renderSiteFooter(siteData.site || {});
      renderTicketCopy(siteData.ticket || {});
      renderTicketFields(siteData.ticket || {});
      const options = buildLiveOptions(siteData);
      eligibleLiveIds = new Set(options.map((option) => option.id));
      const hasQuery = new URL(window.location.href).searchParams.has("liveId");
      const queryRoute = hasQuery ? findLiveRoute(siteData, query.liveId) : null;
      if (options.length === 0) {
        renderSelect([{ id: "", label: "開催予定のライブがありません", disabled: true }], "");
        if (submitBtn) submitBtn.disabled = true;
        setRouteMessage(hasQuery ? queryRoute : { type: "empty" });
        return;
      }

      const validQuery = hasQuery && queryRoute.type === "internal" && eligibleLiveIds.has(String(query.liveId));
      const validDraftId = !hasQuery && draft && eligibleLiveIds.has(String(draft.liveId)) ? String(draft.liveId) : "";
      const selected = validQuery ? String(query.liveId) : (validDraftId || (!hasQuery ? options[0].id : ""));
      const selectOptions = hasQuery && !validQuery
        ? [{ id: "", label: "ライブを選択してください", disabled: true }, ...options]
        : options;
      renderSelect(selectOptions, selected);
      renderSelectedLivePreview(siteData, selected);
      if (hasQuery && !validQuery) setRouteMessage(queryRoute);
      else setRouteMessage(null);
      if (submitBtn) submitBtn.disabled = !eligibleLiveIds.has(selected);
      if (liveSelect) {
        liveSelect.addEventListener("change", () => {
          const selectedId = String(liveSelect.value || "");
          const valid = eligibleLiveIds.has(selectedId);
          renderSelectedLivePreview(siteData, valid ? selectedId : "");
          if (submitBtn) submitBtn.disabled = !valid;
          setRouteMessage(valid ? null : { type: "invalidSelection" });
          try {
            const raw = localStorage.getItem(STORAGE_KEY) || "";
            const savedDraft = raw ? JSON.parse(raw) : {};
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...(savedDraft || {}), liveId: valid ? selectedId : "" }));
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

    // Restore non-routing fields. Live selection was validated above so a draft
    // cannot override a valid query or reintroduce an excluded Live.
    if (draft) {
      if (form && draft.name) $("name").value = String(draft.name);
      if (form && draft.email) $("email").value = String(draft.email);
      if (form && draft.quantity) $("quantity").value = String(draft.quantity);
      if (form && draft.message) $("message").value = String(draft.message);
    }

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
    submitBtn.disabled = busy || !eligibleLiveIds.has(String($("liveId") && $("liveId").value || ""));
    submitBtn.textContent = busy ? "..." : ticketFieldConfig.submitLabel;
  }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const selectedLiveControl = $("liveId");
      const selectedLiveSnapshot = Object.freeze({
        id: String(selectedLiveControl && selectedLiveControl.value || ""),
        label: safeGetText(selectedLiveControl),
      });
      const selectedId = selectedLiveSnapshot.id;
      const route = findLiveRoute(siteData, selectedId);
      if (!eligibleLiveIds.has(selectedId) || route.type !== "internal") {
        setRouteMessage({ type: "invalidSelection" });
        setResult("このライブはこのフォームから予約できません。ライブを選択し直してください。", "error");
        if (submitBtn) submitBtn.disabled = true;
        return;
      }
      let payload;
      try {
        payload = buildPublicReservationPayload(selectedLiveSnapshot);
      } catch (error) {
        setResult(escapeHtml(error.message), "error");
        return;
      }
      setBusy(true);
      try {
        setConfirmStage("sending");
        const title = $("ticketConfirmTitle");
        if (title) title.textContent = "送信中...";
        renderConfirmSummary(payload, selectedLiveSnapshot);
        openConfirmModal();

        setConfirmError("");

        if (dryRun) {
          if (title) title.textContent = "予約しました。";
          setConfirmStage("success");
          // keep the summary as-is (no extra confirmation step)
          ev.target.reset();
          return;
        }

        const res = await submitReservation(payload);
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
