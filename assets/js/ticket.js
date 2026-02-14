(function () {
  const base = (window.SITE_API_BASE || "").replace(/\/+$/, "");
  const apiBase = base || "";

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

  async function fetchSiteData() {
    const endpoint = apiBase ? `${apiBase}/api/public/site-data` : "/api/public/site-data";
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) throw new Error("failed to load site data");
    const payload = await res.json();
    return payload.data || payload;
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

  function renderSelect(options, selectedId) {
    const select = $("liveId");
    select.innerHTML = options
      .map((opt) => {
        const disabled = opt.isPast ? "disabled" : "";
        const selected = opt.id === selectedId ? "selected" : "";
        return `<option value="${escapeHtml(opt.id)}" ${selected} ${disabled}>${escapeHtml(opt.label)}${opt.isPast ? " (past)" : ""}</option>`;
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
    try {
      const siteData = await fetchSiteData();
      const options = buildLiveOptions(siteData).filter((o) => !o.isPast);
      if (options.length === 0) {
        renderSelect([{ id: "", label: "開催予定のライブがありません", isPast: false }], "");
        $("submitBtn").disabled = true;
        return;
      }
      const selected = options.some((o) => o.id === query.liveId) ? query.liveId : options[0].id;
      renderSelect(options, selected);
    } catch (e) {
      setResult(`データ取得に失敗しました: ${escapeHtml(e.message)}`, "error");
      $("submitBtn").disabled = true;
      return;
    }

    $("ticket-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      $("submitBtn").disabled = true;
      $("submitBtn").textContent = "Sending...";
      try {
        const url = new URL(window.location.href);
        const dryRun = url.searchParams.get("dryRun") === "1";

        if (dryRun) {
          const select = $("liveId");
          const label = select && select.selectedIndex >= 0 ? select.options[select.selectedIndex].textContent : "";
          redirectToComplete({
            id: `DRYRUN-${Date.now()}`,
            liveDate: label || "",
            liveVenue: "",
          });
          return;
        }

        const fd = new FormData(ev.target);
        const res = await submitReservation(fd);
        const r = res.reservation || {};
        // Prefer a dedicated confirmation view.
        if (!redirectToComplete(r)) {
          setResult(
            `送信しました。<br>受付ID: <code>${escapeHtml(r.id || "")}</code><br>${escapeHtml(r.liveDate || "")} ${escapeHtml(r.liveVenue || "")}`,
            "ok"
          );
          ev.target.reset();
        }
      } catch (e) {
        setResult(`送信に失敗しました: ${escapeHtml(e.message)}`, "error");
      } finally {
        $("submitBtn").disabled = false;
        $("submitBtn").textContent = "Send";
      }
    });
  }

  boot();
})();
