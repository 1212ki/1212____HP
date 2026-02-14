(function () {
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

  const q = parseQuery();
  const idEl = document.getElementById("ticket-receipt-id");
  const liveEl = document.getElementById("ticket-receipt-live");

  if (idEl) idEl.textContent = q.rid ? q.rid : "-";
  if (liveEl) {
    const parts = [q.date, q.venue].filter(Boolean);
    liveEl.innerHTML = parts.length ? escapeHtml(parts.join(" ")) : "<span style=\"color: var(--ink-muted);\">-</span>";
  }
})();

