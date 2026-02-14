(function () {
  function isRootPage() {
    const pathname = String(window.location && window.location.pathname ? window.location.pathname : "");
    const parts = pathname.split("/").filter(Boolean);
    return parts.length === 0 || (parts.length === 1 && parts[0] === "index.html");
  }

  function withCacheBust(url, version) {
    const value = String(url || "").trim();
    const v = String(version || "").trim();
    if (!value || !v) return value;
    const sep = value.includes("?") ? "&" : "?";
    return `${value}${sep}v=${encodeURIComponent(v)}`;
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

  function resolveImageSrc(raw, version) {
    const url = resolveAssetPath(raw);
    return withCacheBust(url, version);
  }

  async function fetchSiteData() {
    const base = (window.SITE_API_BASE || "").replace(/\/+$/, "");
    const endpoint = base ? `${base}/api/public/site-data` : "/api/public/site-data";
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) return null;
      const payload = await response.json();
      const data = payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
      const meta = payload && typeof payload === "object" && payload.meta ? payload.meta : {};
      return { data, meta };
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

  function renderSite(site, version) {
    const heroImg = document.getElementById("home-hero-image");
    const linkBandcamp = document.getElementById("home-link-bandcamp");
    const linkYouTube = document.getElementById("home-link-youtube");
    const linkX = document.getElementById("home-link-x");
    const footer = document.getElementById("site-footer");

    const data = site && typeof site === "object" ? site : {};
    const links = data.links && typeof data.links === "object" ? data.links : {};

    if (heroImg) {
      const src = resolveImageSrc(data.heroImage || "", version);
      if (src) {
        heroImg.src = src;
        heroImg.style.display = "";
      } else {
        heroImg.removeAttribute("src");
        heroImg.style.display = "none";
      }
    }

    if (linkBandcamp && links.bandcamp) linkBandcamp.href = String(links.bandcamp);
    if (linkYouTube && links.youtube) linkYouTube.href = String(links.youtube);
    if (linkX && links.x) linkX.href = String(links.x);

    if (footer) {
      const text = String(data.footerText || "").trim();
      footer.textContent = text || "";
    }
  }

  function renderContact(contact) {
    const intro = document.getElementById("contact-intro");
    const form = document.getElementById("contact-form");
    if (!intro && !form) return;

    const data = contact && typeof contact === "object" ? contact : {};
    const introText = String(data.introText || "").trim();
    const formAction = String(data.formAction || "").trim();

    if (intro) intro.textContent = introText || "";
    if (form && formAction) form.setAttribute("action", formAction);
  }

  function renderNews(news, version) {
    const container = document.getElementById("news-items");
    if (!container || !Array.isArray(news)) return;
    container.innerHTML = "";
    const list = news.slice(0, 12);
    if (list.length === 0) return;
    container.innerHTML = list
      .map((item) => {
        const image = escapeHtml(resolveImageSrc(item.image || "", version));
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

  function renderLiveEvents(container, events, version) {
    if (!container || !Array.isArray(events)) return;
    container.innerHTML = "";
    if (events.length === 0) return;
    container.innerHTML = events
      .map((item) => {
        const image = escapeHtml(resolveImageSrc(item.image || "", version));
        const safeDesc = escapeHtml((item.description || "").replace(/<br\s*\/?>/gi, "\n")).replace(/\n/g, "<br>");
        const prefix = isRootPage() ? "" : "../";
        const reserveHref = `${prefix}ticket/?liveId=${encodeURIComponent(item.id || "")}`;
        const detailHref = item.link ? escapeHtml(item.link) : "";
        return `
          <div class="live-event">
            ${image ? `<img src="${image}" alt="${escapeHtml(item.venue || "Live")}">` : ""}
            <div class="live-info">
              <p class="live-date">${escapeHtml(item.date || "")}</p>
              <p class="live-venue">${escapeHtml(item.venue || "")}</p>
              <p class="live-description">${safeDesc}</p>
              <div class="live-actions" style="margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap;">
                <a href="${reserveHref}" class="application-link">▷予約</a>
                ${detailHref ? `<a href="${detailHref}" class="application-link" target="_blank" rel="noopener">▷詳細</a>` : ""}
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderLive(data, version) {
    if (!data || !data.live) return;
    const ticket = document.getElementById("ticket-link-anchor");
    // Keep the page-local default (../ticket/) to avoid external double-maintenance.
    // If you really want to override, set a relative path like "/ticket/".
    if (ticket && data.live.ticketLink && /^\/(?!\/)/.test(String(data.live.ticketLink))) {
      ticket.href = data.live.ticketLink;
    }
    renderLiveEvents(document.getElementById("live-upcoming-events"), data.live.upcoming || [], version);
    renderLiveEvents(document.getElementById("live-past-events"), data.live.past || [], version);

    const pastHeading = document.getElementById("live-past-heading");
    if (pastHeading) {
      const hasPast = Array.isArray(data.live.past) && data.live.past.length > 0;
      pastHeading.style.display = hasPast ? "" : "none";
    }
  }

  function renderDiscography(discography, version) {
    const digital = document.getElementById("disc-digital-items");
    const demo = document.getElementById("disc-demo-items");
    if (!digital && !demo) return;
    const data = discography && typeof discography === "object" ? discography : {};

    function renderList(container, items) {
      if (!container) return;
      const list = Array.isArray(items) ? items : [];
      container.innerHTML = "";
      if (list.length === 0) return;
      container.innerHTML = list
        .map((item) => {
          const image = escapeHtml(resolveImageSrc(item.image || "", version));
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

  function renderProfile(profile, version) {
    const img = document.getElementById("profile-image");
    const text = document.getElementById("profile-text");
    const links = document.getElementById("profile-links");
    if (!img && !text && !links) return;

    const data = profile && typeof profile === "object" ? profile : {};

    if (img) {
      img.style.display = "none";
      img.removeAttribute("src");

      const src = resolveImageSrc(data.image || "", version);
      if (src) {
        img.onload = () => {
          img.style.display = "";
        };
        img.onerror = () => {
          img.style.display = "none";
        };
        img.src = src;
      }
    }

    if (text) {
      const safe = escapeHtml(String(data.text || "").replace(/<br\s*\/?>/gi, "\n")).replace(/\n/g, "<br>");
      text.innerHTML = safe || "";
    }

    if (links) {
      const list = Array.isArray(data.links) ? data.links : [];
      links.innerHTML = "";
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

    container.innerHTML = "";

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

    const html = [renderSection("music video", music), renderSection("live movie", lives), renderSection("demo", demos)]
      .filter(Boolean)
      .join("");

    if (html) container.innerHTML = html;
  }

  async function boot() {
    const payload = await fetchSiteData();
    if (!payload) return;
    const siteData = payload.data || {};
    const version = payload.meta && payload.meta.updatedAt ? payload.meta.updatedAt : "";
    renderSite(siteData.site || {}, version);
    renderContact(siteData.contact || {});
    renderNews(siteData.news || [], version);
    renderLive(siteData, version);
    renderDiscography(siteData.discography || {}, version);
    renderProfile(siteData.profile || {}, version);
    renderYouTube(siteData.youtube || {});
  }

  boot();
})();
