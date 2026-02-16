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

  function isInstagramUrl(url) {
    const value = String(url || "").trim();
    if (!value) return false;
    return /^https?:\/\/(www\.)?instagram\.com\//i.test(value);
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

    // Compact list: date + venue + title only. Details are shown on the detail page.
    container.innerHTML = events
      .map((item) => {
        const prefix = isRootPage() ? "" : "../";
        const liveId = String(item.id || "").trim();
        const date = String(item.date || "").trim();
        const venue = String(item.venue || "").trim();
        const title = String(item.title || "").trim();
        const detailHref = `${prefix}live/detail/?liveId=${encodeURIComponent(liveId)}`;

        return `
          <a class="live-event" href="${detailHref}">
            <div class="live-info">
              <div class="live-meta">
                <span class="live-date">${escapeHtml(date)}</span>
                <span class="live-venue">${escapeHtml(venue)}</span>
              </div>
              ${title ? `<div class="live-title">${escapeHtml(title)}</div>` : ""}
            </div>
            <span class="live-chevron" aria-hidden="true">›</span>
          </a>
        `;
      })
      .join("");
  }
  function findLiveById(siteData, liveId) {
    const data = siteData && typeof siteData === "object" ? siteData : {};
    const live = data.live && typeof data.live === "object" ? data.live : {};
    const upcoming = Array.isArray(live.upcoming) ? live.upcoming : [];
    const past = Array.isArray(live.past) ? live.past : [];
    return [...upcoming, ...past].find((item) => String(item.id) === String(liveId)) || null;
  }

  function openLiveDetailModal(siteData, liveId, version) {
    const overlay = document.getElementById("liveDetailOverlay");
    const modal = document.getElementById("liveDetailModal");
    const title = document.getElementById("liveDetailTitle");
    const body = document.getElementById("liveDetailBody");
    const ext = document.getElementById("liveDetailExternalLink");
    if (!overlay || !modal || !body) return;

    const live = findLiveById(siteData, liveId);
    if (!live) return;

    const heading = `${String(live.date || "").trim()} ${String(live.venue || "").trim()}`.trim() || "live detail";
    const liveTitle = String(live.title || "").trim();
    if (title) title.textContent = liveTitle ? `${liveTitle} / ${heading}` : heading;

    const image = resolveImageSrc(live.image || "", version);
    const safeDesc = escapeHtml(String(live.description || "").replace(/<br\s*\/?>/gi, "\n")).replace(/\n/g, "<br>");
    body.innerHTML = `
      <div style="display:flex; gap: 14px; align-items: flex-start; flex-wrap: wrap;">
        ${image ? `<img src="${escapeHtml(image)}" alt="" style="width: 160px; height: 160px; object-fit: cover; border-radius: 14px; border: 1px solid var(--line); background: rgba(255,255,255,0.7);">` : ""}
        <div style="flex: 1; min-width: 240px;">
          <div style="font-family: var(--font-display); font-size: 1.05rem; letter-spacing: 0.08em;">${escapeHtml(heading)}</div>
          ${safeDesc ? `<div style="margin-top: 10px; color: var(--ink-muted); line-height: 1.8;">${safeDesc}</div>` : ""}
        </div>
      </div>
    `;

    const link = String(live.link || "").trim();
    if (ext) {
      if (isInstagramUrl(link)) {
        ext.href = link;
        ext.textContent = "instagram";
        ext.style.display = "";
      } else {
        ext.href = "#";
        ext.style.display = "none";
      }
    }

    overlay.classList.add("is-open");
    modal.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeLiveDetailModal() {
    const overlay = document.getElementById("liveDetailOverlay");
    const modal = document.getElementById("liveDetailModal");
    if (!overlay || !modal) return;
    overlay.classList.remove("is-open");
    modal.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    modal.setAttribute("aria-hidden", "true");
  }

  function wireLiveDetailModal(siteData, version) {
    const overlay = document.getElementById("liveDetailOverlay");
    const modal = document.getElementById("liveDetailModal");
    if (!overlay || !modal) return;
    if (modal.dataset && modal.dataset.wired === "1") return;
    if (modal.dataset) modal.dataset.wired = "1";

    const closeBtn = document.getElementById("liveDetailCloseBtn");
    const closeLink = document.getElementById("liveDetailCloseLink");
    overlay.addEventListener("click", closeLiveDetailModal);
    if (closeBtn) closeBtn.addEventListener("click", closeLiveDetailModal);
    if (closeLink) {
      closeLink.addEventListener("click", (e) => {
        e.preventDefault();
        closeLiveDetailModal();
      });
    }
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLiveDetailModal();
    });

    const handler = (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("[data-live-detail-id]") : null;
      if (!btn) return;
      const liveId = btn.getAttribute("data-live-detail-id") || "";
      if (!liveId) return;
      openLiveDetailModal(siteData, liveId, version);
    };

    const upcoming = document.getElementById("live-upcoming-events");
    const past = document.getElementById("live-past-events");
    if (upcoming) upcoming.addEventListener("click", handler);
    if (past) past.addEventListener("click", handler);
  }

  function renderLive(data, version) {
    if (!data || !data.live) return;
    renderLiveEvents(document.getElementById("live-upcoming-events"), data.live.upcoming || [], version);
    renderLiveEvents(document.getElementById("live-past-events"), data.live.past || [], version);

    const pastHeading = document.getElementById("live-past-heading");
    if (pastHeading) {
      const hasPast = Array.isArray(data.live.past) && data.live.past.length > 0;
      pastHeading.style.display = hasPast ? "" : "none";
    }

    wireLiveDetailModal(data, version);
  }


  function renderLiveDetailPage(siteData, version) {
    const rootEl = document.getElementById("live-detail");
    if (!rootEl) return;

    const params = new URLSearchParams(String(window.location && window.location.search ? window.location.search : ""));
    const liveId = String(params.get("liveId") || "").trim();

    const titleEl = document.getElementById("live-detail-title");
    const headingEl = document.getElementById("live-detail-heading");
    const imgEl = document.getElementById("live-detail-image");
    const descEl = document.getElementById("live-detail-description");
    const ticketEl = document.getElementById("live-detail-ticket-link");
    const backEl = document.getElementById("live-detail-back-link");
    const notFoundEl = document.getElementById("live-detail-notfound");

    if (backEl) backEl.href = "../";

    if (!liveId) {
      if (notFoundEl) {
        notFoundEl.style.display = "";
        notFoundEl.textContent = "liveId が指定されていません";
      }
      if (titleEl) titleEl.textContent = "live detail";
      return;
    }

    const live = findLiveById(siteData, liveId);
    if (!live) {
      if (notFoundEl) {
        notFoundEl.style.display = "";
        notFoundEl.textContent = "ライブ情報が見つかりません";
      }
      if (titleEl) titleEl.textContent = "live detail";
      return;
    }

    if (notFoundEl) notFoundEl.style.display = "none";

    const liveTitle = String(live.title || "").trim();
    const date = String(live.date || "").trim();
    const venue = String(live.venue || "").trim();
    const heading = `${date} ${venue}`.trim();

    if (titleEl) titleEl.textContent = liveTitle ? liveTitle : "live detail";
    if (headingEl) headingEl.textContent = heading;

    const image = resolveImageSrc(live.image || "", version);
    if (imgEl) {
      if (image) {
        imgEl.src = escapeHtml(image);
        imgEl.style.display = "";
      } else {
        imgEl.removeAttribute("src");
        imgEl.style.display = "none";
      }
    }

    const raw = String(live.description || "").replace(/<br\s*\/?>/gi, "\n");
    const text = raw.replace(/\r\n/g, "\n").trim();
    if (descEl) descEl.textContent = text;

    if (ticketEl) {
      const href = `../../ticket/?liveId=${encodeURIComponent(String(live.id || liveId))}`;
      ticketEl.href = href;
    }

    // Improve browser title for sharing.
    const docTitle = [liveTitle, heading, "松本一樹"].filter(Boolean).join(" | ");
    if (docTitle) document.title = docTitle;
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
    renderLiveDetailPage(siteData, version);
    renderDiscography(siteData.discography || {}, version);
    renderProfile(siteData.profile || {}, version);
    renderYouTube(siteData.youtube || {});
  }

  boot();
})();
