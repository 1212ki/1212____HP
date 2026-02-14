(function () {
  function isRootPage() {
    const pathname = String(window.location && window.location.pathname ? window.location.pathname : "");
    const parts = pathname.split("/").filter(Boolean);
    return parts.length === 0 || (parts.length === 1 && parts[0] === "index.html");
  }

  function resolveAssetPath(raw) {
    if (!raw) return "";
    const value = String(raw).trim();
    if (!value) return "";
    if (/^https?:\/\//.test(value) || value.startsWith("/")) return value;
    if (value.startsWith("../") || value.startsWith("./")) return value;
    const prefix = isRootPage() ? "" : "../";
    return `${prefix}${value.replace(/^\/+/, "")}`;
  }

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

  function renderSite(site) {
    const heroImg = document.getElementById("home-hero-image");
    const linkBandcamp = document.getElementById("home-link-bandcamp");
    const linkYouTube = document.getElementById("home-link-youtube");
    const linkX = document.getElementById("home-link-x");
    const footer = document.getElementById("site-footer");

    const data = site && typeof site === "object" ? site : {};
    const links = data.links && typeof data.links === "object" ? data.links : {};

    if (heroImg) {
      const src = resolveAssetPath(data.heroImage || "");
      if (src) heroImg.src = src;
    }

    if (linkBandcamp && links.bandcamp) linkBandcamp.href = String(links.bandcamp);
    if (linkYouTube && links.youtube) linkYouTube.href = String(links.youtube);
    if (linkX && links.x) linkX.href = String(links.x);

    if (footer) {
      const text = String(data.footerText || "").trim();
      if (text) footer.textContent = text;
    }
  }

  function renderContact(contact) {
    const intro = document.getElementById("contact-intro");
    const form = document.getElementById("contact-form");
    if (!intro && !form) return;

    const data = contact && typeof contact === "object" ? contact : {};
    const introText = String(data.introText || "").trim();
    const formAction = String(data.formAction || "").trim();

    if (intro && introText) intro.textContent = introText;
    if (form && formAction) form.setAttribute("action", formAction);
  }

  function renderNews(news) {
    const container = document.getElementById("news-items");
    if (!container || !Array.isArray(news)) return;
    const list = news.slice(0, 12);
    if (list.length === 0) return;
    container.innerHTML = list
      .map((item) => {
        const image = escapeHtml(resolveAssetPath(item.image || ""));
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
        const image = escapeHtml(resolveAssetPath(item.image || ""));
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

  function renderDiscography(discography) {
    const digital = document.getElementById("disc-digital-items");
    const demo = document.getElementById("disc-demo-items");
    if (!digital && !demo) return;
    const data = discography && typeof discography === "object" ? discography : {};

    function renderList(container, items) {
      if (!container) return;
      const list = Array.isArray(items) ? items : [];
      if (list.length === 0) return;
      container.innerHTML = list
        .map((item) => {
          const image = escapeHtml(resolveAssetPath(item.image || ""));
          const link = escapeHtml(item.link || "#");
          const title = escapeHtml(item.title || "");
          const release = escapeHtml(item.releaseDate || "");
          const desc = escapeHtml(String(item.description || "").replace(/<br\s*\/?>/gi, "\n")).replace(/\n/g, "<br>");
          return `
            <div class="discography-item">
              <a href="${link}" target="_blank" rel="noopener" style="display: block; text-decoration: none; color: inherit;">
                ${image ? `<img src="${image}" alt="${title || "Discography"}">` : ""}
                <div class="discography-info">
                  <p class="album-title">${title}</p>
                  <p class="album-release">${release ? `リリース日: ${release}` : ""}</p>
                  <p class="album-description">${desc}</p>
                </div>
              </a>
            </div>
          `;
        })
        .join("");
    }

    renderList(digital, data.digital);
    renderList(demo, data.demo);
  }

  function renderProfile(profile) {
    const img = document.getElementById("profile-image");
    const text = document.getElementById("profile-text");
    const links = document.getElementById("profile-links");
    if (!img && !text && !links) return;

    const data = profile && typeof profile === "object" ? profile : {};

    if (img) {
      const src = resolveAssetPath(data.image || "");
      if (src) {
        img.src = src;
      }
    }

    if (text) {
      const safe = escapeHtml(String(data.text || "").replace(/<br\s*\/?>/gi, "\n")).replace(/\n/g, "<br>");
      if (safe) text.innerHTML = safe;
    }

    if (links) {
      const list = Array.isArray(data.links) ? data.links : [];
      if (list.length === 0) return;
      links.innerHTML = list
        .map((l) => {
          const name = escapeHtml(l.name || "");
          const url = escapeHtml(l.url || "#");
          return `<a href="${url}" class="application-link" target="_blank" rel="noopener">${name}</a>`;
        })
        .join("");
    }
  }

  function renderYouTube(youtube) {
    const channel = document.getElementById("youtube-channel-link");
    const container = document.getElementById("youtube-content");
    if (!channel && !container) return;

    const data = youtube && typeof youtube === "object" ? youtube : {};
    const channelUrl = String(data.channelUrl || "").trim();
    if (channel && channelUrl) {
      channel.href = channelUrl;
    }
    if (!container) return;

    const music = Array.isArray(data.musicVideos) ? data.musicVideos : [];
    const lives = Array.isArray(data.liveMovies) ? data.liveMovies : [];
    const demos = Array.isArray(data.demos) ? data.demos : [];
    if (music.length === 0 && lives.length === 0 && demos.length === 0) return;

    function renderSection(title, items) {
      if (!Array.isArray(items) || items.length === 0) return "";
      const blocks = items
        .map((v) => {
          const ytId = String(v.youtubeId || "").trim();
          if (!ytId) return "";
          const label = escapeHtml(v.title || "");
          const src = `https://www.youtube.com/embed/${encodeURIComponent(ytId)}`;
          return `
            ${label ? `<h3>${label}</h3>` : ""}
            <div class="video-container">
              <iframe width="560" height="315" src="${src}" title="YouTube video player" frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          `;
        })
        .filter(Boolean)
        .join("<br>");
      if (!blocks) return "";
      return `<h2>${escapeHtml(title)}</h2><br>${blocks}<br><br>`;
    }

    const html = [
      '<h2 class="section-title">YouTube</h2>',
      '<p>Music Video, Live Movie, etc...</p>',
      '<br>',
      renderSection("Music Video", music),
      renderSection("Live Movie", lives),
      renderSection("Demo", demos),
    ]
      .filter(Boolean)
      .join("");

    if (html) container.innerHTML = html;
  }

  async function boot() {
    const siteData = await fetchSiteData();
    if (!siteData) return;
    renderSite(siteData.site || {});
    renderContact(siteData.contact || {});
    renderNews(siteData.news || []);
    renderLive(siteData);
    renderDiscography(siteData.discography || {});
    renderProfile(siteData.profile || {});
    renderYouTube(siteData.youtube || {});
  }

  boot();
})();
