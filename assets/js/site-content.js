(function () {
  async function fetchSiteData() {
    const base = (window.SITE_API_BASE || "").replace(/\/+$/, "");
    const endpoint = base ? `${base}/api/public/site-data` : "/api/public/site-data";
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) return null;
      const payload = await response.json();
      return payload.data || payload;
    } catch (_error) {
      return null;
    }
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

  function renderNews(news) {
    const container = document.getElementById("news-items");
    if (!container || !Array.isArray(news)) return;
    const list = news.slice(0, 12);
    if (list.length === 0) return;
    container.innerHTML = list
      .map((item) => {
        const image = escapeHtml(item.image || "");
        const link = escapeHtml(item.link || "#");
        const linkText = escapeHtml(item.linkText || "view...");
        return `
          <article class="news-item">
            <div class="news-image">
              ${image ? `<img src="${image}" alt="${escapeHtml(item.title || "News")}">` : ""}
            </div>
            <div class="news-content">
              <div class="news-header">
                <p class="news-date">${escapeHtml(item.date || "")}</p>
              </div>
              <div class="news-body">
                <p class="news-title">${escapeHtml(item.title || "")}</p>
                <p class="news-price">${escapeHtml(item.description || "")}</p>
              </div>
              <div class="news-footer">
                <a href="${link}" class="application-link" target="_blank" rel="noopener">▷${linkText}</a>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderLiveEvents(container, events) {
    if (!container || !Array.isArray(events)) return;
    container.innerHTML = events
      .map((item) => {
        const rawImage = item.image || "";
        const image = /^https?:\/\//.test(rawImage) || rawImage.startsWith("/")
          ? escapeHtml(rawImage)
          : `../${escapeHtml(rawImage)}`;
        const safeDesc = escapeHtml((item.description || "").replace(/<br\s*\/?>/gi, "\n")).replace(/\n/g, "<br>");
        const reserveHref = `../ticket/?liveId=${encodeURIComponent(item.id || "")}`;
        const detailHref = item.link ? escapeHtml(item.link) : "";
        return `
          <div class="live-event">
            ${image ? `<img src="${image}" alt="${escapeHtml(item.venue || "Live")}">` : ""}
            <div class="live-info">
              <p class="live-date">${escapeHtml(item.date || "")}</p>
              <p class="live-venue">${escapeHtml(item.venue || "")}</p>
              <p class="live-description">${safeDesc}</p>
              <div class="live-actions" style="margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap;">
                <a href="${reserveHref}" class="application-link">▷Reserve</a>
                ${detailHref ? `<a href="${detailHref}" class="application-link" target="_blank" rel="noopener">▷Details</a>` : ""}
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderLive(data) {
    if (!data || !data.live) return;
    const ticket = document.getElementById("ticket-link-anchor");
    // Keep the page-local default (../ticket/) to avoid external double-maintenance.
    // If you really want to override, set a relative path like "/ticket/".
    if (ticket && data.live.ticketLink && /^\/(?!\/)/.test(String(data.live.ticketLink))) {
      ticket.href = data.live.ticketLink;
    }
    renderLiveEvents(document.getElementById("live-upcoming-events"), data.live.upcoming || []);
    renderLiveEvents(document.getElementById("live-past-events"), data.live.past || []);
  }

  async function boot() {
    const siteData = await fetchSiteData();
    if (!siteData) return;
    renderNews(siteData.news || []);
    renderLive(siteData);
  }

  boot();
})();
