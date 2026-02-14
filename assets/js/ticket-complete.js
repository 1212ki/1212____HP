(function () {
  const base = (window.SITE_API_BASE || "").replace(/\/+$/, "");
  const apiBase = base || "";

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function parseQuery() {
    const url = new URL(window.location.href);
    return {
      rid: url.searchParams.get("rid") || "",
      date: url.searchParams.get("date") || "",
      venue: url.searchParams.get("venue") || "",
    };
  }

  async function fetchSiteData() {
    const endpoint = apiBase ? `${apiBase}/api/public/site-data` : "/api/public/site-data";
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) return null;
      const payload = await res.json();
      return payload.data || payload;
    } catch (_e) {
      return null;
    }
  }

  const q = parseQuery();
  const idEl = document.getElementById("ticket-receipt-id");
  const liveEl = document.getElementById("ticket-receipt-live");
  const msgEl = document.getElementById("ticket-complete-message");

  if (idEl) idEl.textContent = q.rid ? q.rid : "-";
  if (liveEl) {
    const parts = [q.date, q.venue].filter(Boolean);
    liveEl.innerHTML = parts.length ? escapeHtml(parts.join(" ")) : "<span style=\"color: var(--ink-muted);\">-</span>";
  }

  fetchSiteData().then((siteData) => {
    if (!siteData || !msgEl) return;
    const t = siteData.ticket && typeof siteData.ticket === "object" ? siteData.ticket : {};
    const complete = String(t.completeText || "").trim();
    if (complete) msgEl.textContent = complete;
  });
})();
