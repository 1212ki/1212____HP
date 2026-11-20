(function () {
  const LIVE_PAST_PREVIEW_LIMIT = 3;
  const SHARED_LINKS = [
    { key: "bandcamp", label: "Bandcamp", aliases: ["bandcamp"], iconSlug: "bandcamp" },
    { key: "youtube", label: "YouTube", aliases: ["youtube"], iconSlug: "youtube" },
    { key: "x", label: "X", aliases: ["x", "twitter"], iconSlug: "x" },
    { key: "instagram", label: "Instagram", aliases: ["instagram"], iconSlug: "instagram" },
    { key: "note", label: "note", aliases: ["note"], iconSlug: "note" },
  ];

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

  function getSharedTicketCta(live, internalUrl, options) {
    const operations = window.LiveOperations;
    if (!operations || typeof operations.getTicketCta !== "function") {
      return {
        active: false,
        url: "",
        external: false,
        label: "予約情報を確認できません",
        reason: "helperUnavailable",
      };
    }
    return operations.getTicketCta(live, internalUrl, options);
  }

  function resolveSharedLive(input, liveId) {
    const operations = window.LiveOperations;
    if (!operations || typeof operations.resolveLiveById !== "function") {
      return { status: "helperUnavailable", live: null, category: null };
    }
    return operations.resolveLiveById(input, liveId);
  }

  function formatSharedLiveDate(value) {
    const operations = window.LiveOperations;
    if (operations && typeof operations.formatLiveDate === "function") {
      return operations.formatLiveDate(value);
    }
    return String(value || "").trim();
  }

  function formatSharedLiveDetails(live) {
    const operations = window.LiveOperations;
    if (operations && typeof operations.formatLiveDetails === "function") {
      return operations.formatLiveDetails(live);
    }
    return String(live && live.description ? live.description : "")
      .replace(/<br\s*\/?>/gi, "\n")
      .trim();
  }

  function getSharedResolvedTicketCta(input, liveId, internalUrl) {
    const resolved = resolveSharedLive(input, liveId);
    if (resolved.status !== "unique") {
      return {
        active: false,
        url: "",
        external: false,
        label: "予約情報を確認できません",
        reason: resolved.status === "ambiguous" ? "ambiguous" : resolved.status,
      };
    }
    return getSharedTicketCta(resolved.live, internalUrl, { isPast: resolved.category === "past" });
  }

  function renderReservationAction(cta, className) {
    const classes = String(className || "live-inline-link is-primary").trim();
    if (!cta || !cta.active) {
      return `<span class="${escapeHtml(`${classes} is-inactive`)}" aria-disabled="true">${escapeHtml(cta && cta.label ? cta.label : "予約情報を確認できません")}</span>`;
    }
    const externalAttributes = cta.external ? ' target="_blank" rel="noopener"' : "";
    return `<a href="${escapeHtml(cta.url)}" class="${escapeHtml(classes)}"${externalAttributes}>${escapeHtml(cta.label)}</a>`;
  }

  function findProfileLink(profileLinks, aliases) {
    if (!Array.isArray(profileLinks) || profileLinks.length === 0) return "";
    const safeAliases = Array.isArray(aliases) ? aliases.map((alias) => String(alias).trim().toLowerCase()) : [];
    const match = profileLinks.find((item) => {
      const name = String(item && item.name ? item.name : "").trim().toLowerCase();
      return safeAliases.some((alias) => name === alias || name.includes(alias));
    });
    return match && match.url ? String(match.url).trim() : "";
  }

  function buildSharedLinks(siteLinks, profileLinks) {
    const site = siteLinks && typeof siteLinks === "object" ? siteLinks : {};
    return SHARED_LINKS
      .map((entry, index) => {
        const url = String(site[entry.key] || "").trim() || findProfileLink(profileLinks, entry.aliases);
        if (!url) return null;
        return {
          key: entry.key,
          label: entry.label,
          iconSlug: entry.iconSlug,
          url,
          tone: index === 0 ? "primary" : "ghost",
        };
      })
      .filter(Boolean);
  }

  function getSharedLinkIcon(iconSlug, label) {
    const slug = String(iconSlug || "").trim();
    const src = slug ? `https://cdn.simpleicons.org/${encodeURIComponent(slug)}/666666?viewbox=auto` : "";
    return `
      <span class="cta-icon" aria-hidden="true">
        ${src ? `<img src="${src}" alt="" class="cta-icon-image" loading="lazy" decoding="async" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">` : ""}
        <span class="cta-icon-fallback">${escapeHtml(String(label || "").slice(0, 2).toUpperCase())}</span>
      </span>
    `;
  }

  function renderHomeLinks(siteLinks, profileLinks) {
    const container = document.getElementById("home-link-list");
    if (!container) return;
    const links = buildSharedLinks(siteLinks, profileLinks).filter(link => safeHomeUrl(link.url, false));
    container.innerHTML = links
      .map(
        (link) => `
          <a href="${escapeHtml(link.url)}" class="site-chip" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(link.key === "bandcamp" ? "Bandcamp（音源・物販）" : link.label)}（外部サイト・別タブ）">${escapeHtml(link.key === "bandcamp" ? "Bandcamp（音源・物販）" : link.label)}</a>
        `,
      )
      .join("");
  }

  function isInstagramUrl(url) {
    const value = String(url || "").trim();
    if (!value) return false;
    return /^https?:\/\/(www\.)?instagram\.com\//i.test(value);
  }

  function toDateTime(year, month, day) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return NaN;
    if (m < 1 || m > 12 || d < 1 || d > 31) return NaN;
    return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
  }

  function parseLiveDateTime(rawDate) {
    const text = String(rawDate || "").trim();
    if (!text) return NaN;

    const japanese = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (japanese) return toDateTime(japanese[1], japanese[2], japanese[3]);

    const normalized = text.replace(/[.]/g, "/").replace(/-/g, "/");
    const slash = normalized.match(/(\d{4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
    if (slash) return toDateTime(slash[1], slash[2], slash[3]);

    const fallback = Date.parse(text);
    return Number.isFinite(fallback) ? fallback : NaN;
  }

  function sortLivesByDate(events, direction) {
    const list = Array.isArray(events) ? events.slice() : [];
    const isAsc = direction === "asc";
    return list
      .map((item, index) => ({
        item,
        index,
        timestamp: parseLiveDateTime(item && item.date),
      }))
      .sort((a, b) => {
        const aValid = Number.isFinite(a.timestamp);
        const bValid = Number.isFinite(b.timestamp);
        if (aValid && bValid) {
          const delta = isAsc ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
          if (delta !== 0) return delta;
        } else if (aValid !== bValid) {
          return aValid ? -1 : 1;
        }
        return a.index - b.index;
      })
      .map((entry) => entry.item);
  }

  function sortUpcomingLives(events) {
    return sortLivesByDate(events, "asc");
  }

  function sortPastLives(events) {
    return sortLivesByDate(events, "desc");
  }

  function renderSite(site, version) {
    const footer = document.getElementById("site-footer");

    const data = site && typeof site === "object" ? site : {};

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
    const list = news.slice(0, 6);
    if (list.length === 0) return;
    container.innerHTML = list
      .map((item) => {
        const image = resolveImageSrc(item.image || "", version);
        const hasImage = Boolean(image);
        const link = String(item.link || "").trim();
        const linkText = String(item.linkText || "view...").trim();
        const description = String(item.description || "")
          .replace(/<br\s*\/?>/gi, " / ")
          .replace(/\s+/g, " ")
          .trim();
        return `
          <article class="news-item${hasImage ? "" : " is-text-only"}">
            ${
              hasImage
                ? `
            <div class="news-image">
              <img src="${escapeHtml(image)}" alt="${escapeHtml(item.title || "News")}" loading="lazy">
            </div>
            `
                : ""
            }
            <div class="news-content">
              <p class="news-date">${escapeHtml(item.date || "")}</p>
              <p class="news-title">${escapeHtml(item.title || "")}</p>
              ${description ? `<p class="news-summary">${escapeHtml(description)}</p>` : ""}
            </div>
            ${
              link
                ? `
            <div class="news-footer">
              <a href="${escapeHtml(link)}" class="application-link" target="_blank" rel="noopener">▷${escapeHtml(linkText)}</a>
            </div>
            `
                : ""
            }
          </article>
        `;
      })
      .join("");
  }

  function renderHomeNextLive(live, version) {
    const container = document.getElementById("home-next-live-events");
    const empty = document.getElementById("home-next-live-empty");
    if (!container && !empty) return;

    const data = live && typeof live === "object" ? live : {};
    const upcomingEvents = sortUpcomingLives(data.upcoming || []);
    const nextEvent = upcomingEvents[0] || null;

    if (container) container.innerHTML = "";

    if (!nextEvent) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    renderLiveEvents(container, [nextEvent], version, {
      showFlyer: true,
      featured: true,
      inlineActionsHtmlFactory: (item, liveId) => {
        const internalUrl = liveId ? `ticket/?liveId=${encodeURIComponent(liveId)}` : "ticket/";
        const cta = getSharedResolvedTicketCta(data, liveId, internalUrl);
        return `
        <div class="live-inline-actions live-inline-actions-home">
          ${renderReservationAction(cta)}
          <a href="${escapeHtml(liveId ? `live/detail/?liveId=${encodeURIComponent(liveId)}` : "live/")}" class="live-inline-link">detail</a>
          <a href="live/" class="live-inline-link">all live</a>
        </div>
      `;
      },
    });
  }

  function renderLiveEvents(container, events, version, options) {
    if (!container || !Array.isArray(events)) return;
    container.innerHTML = "";
    if (events.length === 0) return;
    const config = options && typeof options === "object" ? options : {};
    const showFlyer = Boolean(config.showFlyer);
    const featured = Boolean(config.featured);
    const detailHrefFactory = typeof config.detailHrefFactory === "function" ? config.detailHrefFactory : null;
    const inlineActionsHtmlFactory =
      typeof config.inlineActionsHtmlFactory === "function" ? config.inlineActionsHtmlFactory : null;

    container.innerHTML = events
      .map((item) => {
        const prefix = isRootPage() ? "" : "../";
        const liveId = String(item.id || "").trim();
        const date = formatSharedLiveDate(item.date);
        const venue = String(item.venue || "").trim();
        const title = String(item.title || "").trim();
        const description = formatSharedLiveDetails(item)
          .replace(/\r\n/g, "\n")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 2)
          .join("\n");
        const image = resolveImageSrc(item.image || "", version);
        const detailHref = detailHrefFactory
          ? detailHrefFactory(item, liveId)
          : liveId
            ? `${prefix}live/detail/?liveId=${encodeURIComponent(liveId)}`
            : `${prefix}live/detail/`;
        const imageAlt = [title, date, venue].filter(Boolean).join(" / ") || "live flyer";
        const flyerClass = showFlyer ? " with-flyer" : "";
        const featuredClass = featured ? " is-featured" : "";
        const inlineActionsHtml = inlineActionsHtmlFactory ? inlineActionsHtmlFactory(item, liveId, detailHref) : "";
        const useStaticWrapper = Boolean(inlineActionsHtml);

        if (useStaticWrapper) {
          return `
          <article class="live-event${flyerClass}${featuredClass} is-static">
            <a class="live-event-main" href="${escapeHtml(detailHref)}">
              ${
                showFlyer
                  ? `
              <div class="live-flyer">
                ${
                  image
                    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt)}" loading="lazy">`
                    : `<div class="live-flyer-placeholder" aria-hidden="true">Coming Soon</div>`
                }
              </div>
            `
                  : ""
              }
              <div class="live-info">
                <div class="live-meta">
                  <span class="live-date">${escapeHtml(date)}</span>
                  <span class="live-venue">${escapeHtml(venue)}</span>
                </div>
                ${title ? `<div class="live-title">${escapeHtml(title)}</div>` : ""}
                ${featured && description ? `<div class="live-description">${escapeHtml(description).replace(/\n/g, "<br>")}</div>` : ""}
              </div>
              <span class="live-chevron" aria-hidden="true">›</span>
            </a>
            ${inlineActionsHtml}
          </article>
        `;
        }

        return `
          <a class="live-event${flyerClass}${featuredClass}" href="${escapeHtml(detailHref)}">
            ${
              showFlyer
                ? `
              <div class="live-flyer">
                ${
                  image
                    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt)}" loading="lazy">`
                    : `<div class="live-flyer-placeholder" aria-hidden="true">Coming Soon</div>`
                }
              </div>
            `
                : ""
            }
            <div class="live-info">
              <div class="live-meta">
                <span class="live-date">${escapeHtml(date)}</span>
                <span class="live-venue">${escapeHtml(venue)}</span>
              </div>
              ${title ? `<div class="live-title">${escapeHtml(title)}</div>` : ""}
              ${featured && description ? `<div class="live-description">${escapeHtml(description).replace(/\n/g, "<br>")}</div>` : ""}
            </div>
            <span class="live-chevron" aria-hidden="true">›</span>
          </a>
        `;
      })
      .join("");
  }
  function findLiveById(siteData, liveId) {
    const resolved = resolveSharedLive(siteData, liveId);
    return resolved.status === "unique" ? resolved.live : null;
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

    const heading = `${formatSharedLiveDate(live.date)} ${String(live.venue || "").trim()}`.trim() || "live detail";
    const liveTitle = String(live.title || "").trim();
    if (title) title.textContent = liveTitle ? `${liveTitle} / ${heading}` : heading;

    const image = resolveImageSrc(live.image || "", version);
    const safeDesc = escapeHtml(formatSharedLiveDetails(live)).replace(/\n/g, "<br>");
    body.innerHTML = `
      <div style="display:flex; gap: 14px; align-items: flex-start; flex-wrap: wrap;">
        ${image ? `<img src="${escapeHtml(image)}" alt="" style="width: min(220px, 100%); max-height: min(70vh, 520px); object-fit: contain; border-radius: 14px; border: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,245,245,0.92)); padding: 8px;">` : `<div class="live-flyer-placeholder" style="width: min(220px, 100%); min-height: min(70vh, 520px); border-radius: 14px; border: 1px solid var(--line);">Coming Soon</div>`}
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
    const live = data.live && typeof data.live === "object" ? data.live : {};
    const upcomingEvents = sortUpcomingLives(live.upcoming || []);
    const pastEvents = sortPastLives(live.past || []);

    renderHomeNextLive(live, version);
    renderLiveEvents(document.getElementById("live-upcoming-events"), upcomingEvents, version, {
      showFlyer: true,
      featured: true,
      inlineActionsHtmlFactory: (item, liveId, detailHref) => {
        const internalUrl = liveId ? `../ticket/?liveId=${encodeURIComponent(liveId)}` : "../ticket/";
        const cta = getSharedResolvedTicketCta(live, liveId, internalUrl);
        return `
          <div class="live-inline-actions">
            ${renderReservationAction(cta)}
            <a href="${escapeHtml(detailHref)}" class="live-inline-link">detail</a>
          </div>
        `;
      },
    });
    renderLiveEvents(document.getElementById("live-past-events"), pastEvents.slice(0, LIVE_PAST_PREVIEW_LIMIT), version, {
      showFlyer: false,
      inlineActionsHtmlFactory: (item, liveId, detailHref) => {
        const cta = getSharedResolvedTicketCta(live, liveId, "../ticket/");
        return `
          <div class="live-inline-actions">
            ${renderReservationAction(cta)}
            <a href="${escapeHtml(detailHref)}" class="live-inline-link">detail</a>
          </div>
        `;
      },
    });

    const pastHeading = document.getElementById("live-past-heading");
    if (pastHeading) {
      const hasPast = pastEvents.length > 0;
      pastHeading.style.display = hasPast ? "" : "none";
    }

    const pastMore = document.getElementById("live-past-more");
    if (pastMore) {
      pastMore.style.display = pastEvents.length > LIVE_PAST_PREVIEW_LIMIT ? "" : "none";
    }

    wireLiveDetailModal(data, version);
  }

  function renderLivePastArchive(siteData, version) {
    const archiveRoot = document.getElementById("live-archive");
    const archiveEvents = document.getElementById("live-archive-events");
    const archiveEmpty = document.getElementById("live-archive-empty");
    if (!archiveRoot || !archiveEvents) return;

    const data = siteData && typeof siteData === "object" ? siteData : {};
    const live = data.live && typeof data.live === "object" ? data.live : {};
    const sortedPast = sortPastLives(live.past || []);

    renderLiveEvents(archiveEvents, sortedPast, version, {
      showFlyer: false,
      detailHrefFactory: (_item, liveId) => (liveId ? `?liveId=${encodeURIComponent(liveId)}` : "#"),
    });

    if (archiveEmpty) archiveEmpty.style.display = sortedPast.length === 0 ? "" : "none";
    archiveRoot.style.display = "";
  }


  function renderLiveDetailPage(siteData, version) {
    const rootEl = document.getElementById("live-detail");
    if (!rootEl) return;

    const params = new URLSearchParams(String(window.location && window.location.search ? window.location.search : ""));
    const liveId = String(params.get("liveId") || "").trim();
    const view = String(params.get("view") || "").trim().toLowerCase();

    const titleEl = document.getElementById("live-detail-title");
    const headingEl = document.getElementById("live-detail-heading");
    const imgEl = document.getElementById("live-detail-image");
    const placeholderEl = document.getElementById("live-detail-placeholder");
    const descEl = document.getElementById("live-detail-description");
    const ticketEl = document.getElementById("live-detail-ticket-link");
    const backEl = document.getElementById("live-detail-back-link");
    const notFoundEl = document.getElementById("live-detail-notfound");
    const singleEl = document.getElementById("live-detail-single");
    const archiveEl = document.getElementById("live-archive");

    if (ticketEl) {
      ticketEl.hidden = true;
      ticketEl.textContent = "";
      ticketEl.removeAttribute("href");
      ticketEl.removeAttribute("target");
      ticketEl.removeAttribute("rel");
      ticketEl.removeAttribute("aria-disabled");
      ticketEl.classList.remove("is-inactive");
    }

    if (backEl) backEl.href = "../";
    if (singleEl) singleEl.style.display = "";
    if (archiveEl) archiveEl.style.display = "none";

    if (view === "past" && !liveId) {
      if (singleEl) singleEl.style.display = "none";
      if (notFoundEl) notFoundEl.style.display = "none";
      renderLivePastArchive(siteData, version);
      document.title = "公演終了 | 松本一樹";
      return;
    }

    if (!liveId) {
      if (notFoundEl) {
        notFoundEl.style.display = "";
        notFoundEl.textContent = "liveId が指定されていません";
      }
      if (titleEl) titleEl.textContent = "live detail";
      return;
    }

    const resolvedLive = resolveSharedLive(siteData, liveId);
    if (resolvedLive.status !== "unique") {
      if (notFoundEl) {
        notFoundEl.style.display = "";
        notFoundEl.textContent = resolvedLive.status === "ambiguous"
          ? "Live IDが重複しているため、ライブ情報を一意に特定できません"
          : "ライブ情報が見つかりません";
      }
      if (titleEl) titleEl.textContent = "live detail";
      return;
    }
    const live = resolvedLive.live;

    if (notFoundEl) notFoundEl.style.display = "none";

    const liveTitle = String(live.title || "").trim();
    const date = formatSharedLiveDate(live.date);
    const venue = String(live.venue || "").trim();
    const heading = `${date} ${venue}`.trim();

    if (titleEl) titleEl.textContent = liveTitle ? liveTitle : "Coming Soon";
    if (headingEl) headingEl.textContent = heading;

    const image = resolveImageSrc(live.image || "", version);
    if (imgEl) {
      if (image) {
        imgEl.src = image;
        imgEl.style.display = "";
        if (placeholderEl) placeholderEl.style.display = "none";
      } else {
        imgEl.removeAttribute("src");
        imgEl.style.display = "none";
        if (placeholderEl) placeholderEl.style.display = "";
      }
    }

    const text = formatSharedLiveDetails(live).replace(/\r\n/g, "\n").trim();
    if (descEl) descEl.textContent = text;

    if (ticketEl) {
      const resolvedId = String(live.id || liveId);
      const href = `../../ticket/?liveId=${encodeURIComponent(resolvedId)}`;
      const cta = getSharedTicketCta(live, href, { isPast: resolvedLive.category === "past" });
      ticketEl.hidden = false;
      ticketEl.textContent = cta.label;
      if (cta.active) {
        ticketEl.href = cta.url;
        if (cta.external) {
          ticketEl.target = "_blank";
          ticketEl.rel = "noopener";
        }
      } else {
        ticketEl.removeAttribute("href");
        ticketEl.setAttribute("aria-disabled", "true");
        ticketEl.classList.add("is-inactive");
      }
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

  function renderProfile(profile, siteLinks, version) {
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
      const shared = buildSharedLinks(siteLinks, data.links);
      const fallback = Array.isArray(data.links) ? data.links : [];
      const list = shared.length > 0
        ? shared.map((entry) => ({ name: entry.label, url: entry.url }))
        : fallback;
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

  function homeReleaseMeta(item) {
    return [item.releaseType, item.releaseDate].map(value => String(value || "").trim()).filter(Boolean).join(" ／ ");
  }

  function safeHomeUrl(value, allowRelative) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = allowRelative ? new URL(raw, window.location.href || "http://localhost/") : new URL(raw);
      return url.protocol === "http:" || url.protocol === "https:" ? raw : "";
    } catch (_error) { return ""; }
  }

  function homeArtwork(item, version) {
    const image = safeHomeUrl(item.image, true);
    const fallback = `<div class="home-artwork-fallback"><span>${escapeHtml(item.title || "")}</span><span>松本一樹</span></div>`;
    return image ? `<img data-home-image="true" src="${escapeHtml(resolveImageSrc(image, version))}" alt="${escapeHtml(item.title || "")}" width="440" height="440">${fallback.replace('class="home-artwork-fallback"', 'class="home-artwork-fallback" hidden')}` : fallback;
  }

  let homePlayback = null;

  function renderHomeLive(live) {
    const container = document.getElementById("home-next-live-events");
    const empty = document.getElementById("home-next-live-empty");
    const next = sortUpcomingLives(live.upcoming)[0];
    empty.hidden = Boolean(next);
    if (!next) { container.innerHTML = ""; return; }
    const id = String(next.id || "").trim();
    const resolved = resolveSharedLive(live, id);
    const unique = resolved.status === "unique";
    const cta = getSharedResolvedTicketCta(live, id, `ticket/?liveId=${encodeURIComponent(id)}`);
    let reservation;
    if (cta.active) {
      const label = cta.external ? "予約する（外部サイト）" : "予約する";
      reservation = `<a class="site-button site-button--primary" href="${escapeHtml(cta.url)}"${cta.external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
    } else {
      const label = ["reservationClosed", "past"].includes(cta.reason) ? "予約受付終了" : cta.reason === "invalidTicketUrl" ? "予約先を確認中" : "予約情報を確認できません";
      reservation = `<span class="home-reservation-status">${label}</span>`;
    }
    container.innerHTML = `<p class="home-live-date">${escapeHtml(formatSharedLiveDate(next.date))}</p><p class="home-live-venue">${escapeHtml(next.venue || "")}</p><p class="home-live-title">${escapeHtml(next.title || "")}</p><p class="home-live-details">${escapeHtml(formatSharedLiveDetails(next)).replace(/\n/g, "<br>")}</p><div class="home-live-actions">${reservation}<a class="site-button site-button--secondary" href="${unique ? `live/detail/?liveId=${encodeURIComponent(id)}` : "live/"}">詳細</a></div><a class="site-text-link" href="live/">all live →</a>`;
  }

  function renderHomeNews(news) {
    const list = sortLivesByDate(news, "desc").slice(0, 6);
    document.getElementById("home-news").hidden = list.length === 0;
    document.getElementById("news-items").innerHTML = list.map(item => {
      const description = String(item.description || "").replace(/<br\s*\/?>/gi, "\n");
      const label = (String(item.linkText || "").trim() || "view...").replace(/^▷\s*/, "").replace(/(?:\s*[→↗])+\s*$/, "").trim();
      const link = safeHomeUrl(item.link, true);
      const date = String(item.date || "").split(/(\s+)/).map(word => /\S/.test(word) ? `<span class="site-news-date-word">${escapeHtml(word)}</span>` : word).join("");
      return `<article class="site-news-item"><p class="site-news-date">${date}</p><div class="site-news-content"><h3>${escapeHtml(item.title || "")}</h3>${description ? `<p>${escapeHtml(description).replace(/\n/g, "<br>")}</p>` : ""}${link ? `<a class="site-text-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} →</a>` : ""}</div></article>`;
    }).join("");
  }

  function renderHome(data, version) {
    if (window.HomePlayer) window.HomePlayer.close({ restoreFocus: false });
    const music = window.MusicData;
    if (!music || typeof music.resolveFeaturedRelease !== "function") throw new Error("Music helper unavailable");
    const face = music.resolveFeaturedRelease(data);
    const releases = ["digital", "demo"].flatMap(key => Array.isArray(data.discography && data.discography[key]) ? data.discography[key] : []);
    const others = music.sortReleasesByDate(releases.filter(item => !face || item.id !== face.id)).slice(0, 2);
    const featured = document.getElementById("home-featured-release");
    const videos = ["musicVideos", "liveMovies", "demos"].flatMap(key => Array.isArray(data.youtube && data.youtube[key]) ? data.youtube[key] : []);
    const selected = face && face.playbackVideoId ? videos.find(item => item.id === face.playbackVideoId) : null;
    const youtubeId = String(selected && selected.youtubeId || "").trim();
    homePlayback = /^[A-Za-z0-9_-]{11}$/.test(youtubeId) ? { youtubeId, title: face.title || "" } : null;
    const link = face && safeHomeUrl(face.link, false);
    const isDemo = face && Array.isArray(data.discography.demo) && data.discography.demo.includes(face);
    const linkLabel = isDemo ? "購入先へ" : "配信先へ";
    const actions = face ? `<div class="home-release-actions">${homePlayback ? '<button type="button" id="home-listen" data-testid="home-listen" data-home-action="play" class="site-button site-button--play" aria-expanded="false" aria-controls="home-player">聴く</button>' : ""}${link ? `<a class="site-chip" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" aria-label="${linkLabel}（外部サイト・別タブ）">${linkLabel}</a>` : ""}</div>` : "";
    featured.innerHTML = face ? `<h1 class="home-release-title">${escapeHtml(face.title || "")}</h1><p class="home-release-meta">${escapeHtml(homeReleaseMeta(face))}</p>${actions}` : '<h1 id="home-artist-name" class="home-artist-name">松本一樹</h1>';
    const caption = document.getElementById("home-release-caption");
    caption.hidden = !face;
    caption.parentNode.setAttribute("aria-labelledby", face ? "home-release-caption" : "home-artist-name");
    const artwork = document.getElementById("home-artwork");
    if (artwork) { artwork.hidden = !face; artwork.innerHTML = face ? homeArtwork(face, version) : ""; }
    document.getElementById("home-content").classList.toggle("home-without-release", !face);
    document.getElementById("home-music-items").innerHTML = others.map(item => `<article class="site-release-card"><div class="site-release-image">${homeArtwork(item, version)}</div><div><h3>${escapeHtml(item.title || "")}</h3><p>${escapeHtml(homeReleaseMeta(item))}</p></div></article>`).join("");
    const liveContainer = document.getElementById("home-next-live-events");
    try {
      if (!data.live || !Array.isArray(data.live.upcoming)) throw new Error("Invalid Live data");
      renderHomeLive(data.live);
    } catch (_error) {
      document.getElementById("home-next-live-empty").hidden = true;
      liveContainer.innerHTML = `<p>ライブ情報を読み込めませんでした。</p>${homeRetryButton()}`;
    }
    liveContainer.setAttribute("aria-busy", "false");
    renderHomeNews(Array.isArray(data.news) ? data.news : []);
    const profile = data.profile || {};
    const paragraph = String(profile.text || "").replace(/\r\n?/g, "\n").replace(/<br\s*\/?>/gi, "\n").trim().split(/\n[\t ]*\n/)[0];
    document.getElementById("home-profile-text").innerHTML = paragraph ? `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>` : "";
    renderHomeLinks(data.site && data.site.links || {}, profile.links || []);
  }

  let homeRequestSerial = 0;
  let homeRequestPending = false;
  let homeHasData = false;
  let homeInterruptedRequest = null;

  function homeRetryButton() {
    return '<button type="button" id="home-retry" data-testid="home-retry" data-home-action="retry" class="site-button site-button--secondary">もう一度読み込む</button>';
  }

  async function bootHome(localRetry) {
    if (homeRequestPending) return;
    homeRequestPending = true;
    const serial = ++homeRequestSerial;
    const root = document.getElementById("home-content");
    const local = Boolean(localRetry && homeHasData);
    if (window.HomePlayer) window.HomePlayer.close({ restoreFocus: false });
    if (local) {
      document.getElementById("home-next-live-events").setAttribute("aria-busy", "true");
    } else {
      root.setAttribute("aria-busy", "true");
      root.dataset.state = "loading";
      document.getElementById("home-load-error").hidden = true;
      ["home-top", "home-bands", "home-about"].forEach(id => { document.getElementById(id).hidden = false; });
      document.getElementById("home-artwork").hidden = false;
      document.getElementById("home-artwork").innerHTML = '<div class="home-skeleton" role="status">読み込み中</div>';
      document.getElementById("home-featured-release").innerHTML = "";
      document.getElementById("home-next-live-events").innerHTML = '<div class="home-skeleton" role="status">読み込み中</div>';
      document.getElementById("home-next-live-empty").hidden = true;
    }
    const payload = await fetchSiteData();
    if (serial !== homeRequestSerial) return;
    try {
      if (!payload || !payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) throw new Error("Invalid Home data");
      renderHome(payload.data, payload.meta.updatedAt || "");
      renderSite(payload.data.site || {});
      homeHasData = true;
      root.dataset.state = "ready";
    } catch (_error) {
      if (local) {
        document.getElementById("home-next-live-events").innerHTML = `<p>ライブ情報を読み込めませんでした。</p>${homeRetryButton()}`;
      } else {
        homeHasData = false;
        homePlayback = null;
        root.dataset.state = "error";
        ["home-top", "home-bands", "home-about"].forEach(id => { document.getElementById(id).hidden = true; });
        const error = document.getElementById("home-load-error");
        error.hidden = false;
        error.innerHTML = `<p>情報を読み込めませんでした。</p>${homeRetryButton()}<div class="home-links"><a class="site-chip" href="${MUSIC_FALLBACK_LINKS.bandcamp}" target="_blank" rel="noopener noreferrer" aria-label="Bandcamp（音源・物販）（外部サイト・別タブ）">Bandcamp（音源・物販）</a><a class="site-chip" href="${MUSIC_FALLBACK_LINKS.youtube}" target="_blank" rel="noopener noreferrer" aria-label="YouTube（外部サイト・別タブ）">YouTube</a></div>`;
      }
    } finally {
      homeRequestPending = false;
      root.setAttribute("aria-busy", "false");
      document.getElementById("home-next-live-events").setAttribute("aria-busy", "false");
    }
  }

  function wireHome() {
    const root = document.getElementById("home-content");
    root.addEventListener("click", event => {
      const button = event.target.closest("[data-home-action]");
      if (!button || !root.contains(button)) return;
      if (button.dataset.homeAction === "play" && homePlayback && window.HomePlayer) {
        if (button.getAttribute("aria-expanded") === "true") window.HomePlayer.close();
        else window.HomePlayer.open(document.getElementById("home-player"), button, homePlayback.youtubeId, homePlayback.title);
      }
      if (button.dataset.homeAction === "retry" && !homeRequestPending) {
        button.disabled = true;
        bootHome(homeHasData);
      }
    });
    root.addEventListener("error", event => {
      const image = event.target;
      if (!image || image.getAttribute("data-home-image") !== "true") return;
      image.hidden = true;
      if (image.nextElementSibling) image.nextElementSibling.hidden = false;
    }, true);
    window.addEventListener("pagehide", () => {
      if (homeRequestPending) homeInterruptedRequest = homeHasData;
      ++homeRequestSerial;
      homeRequestPending = false;
      root.setAttribute("aria-busy", "false");
      document.getElementById("home-next-live-events").setAttribute("aria-busy", "false");
      root.querySelectorAll('[data-home-action="retry"]').forEach(button => { button.disabled = false; });
      if (window.HomePlayer) window.HomePlayer.close({ restoreFocus: false });
    });
    window.addEventListener("pageshow", event => {
      if (!event.persisted || homeInterruptedRequest === null) return;
      const local = homeInterruptedRequest;
      homeInterruptedRequest = null;
      bootHome(local);
    });
  }

  const MUSIC_CHANNELS = ["musicVideos", "liveMovies", "demos"];
  const MUSIC_FALLBACK_LINKS = { bandcamp: "https://1212ki.bandcamp.com/", youtube: "https://www.youtube.com/@1212____ki" };
  let musicPlayback = new Map();
  let musicRequestSerial = 0;
  let musicRequestPending = false;
  let musicInterrupted = false;
  let musicKnownLinks = { ...MUSIC_FALLBACK_LINKS };

  function validMusicData(data) {
    const object = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
    if (!object(data)) return false;
    for (const [collection, keys] of [["discography", ["digital", "demo"]], ["youtube", MUSIC_CHANNELS]]) {
      if (!(collection in data)) continue;
      if (!object(data[collection])) return false;
      for (const key of keys) {
        if (!(key in data[collection])) continue;
        const values = data[collection][key];
        if (!Array.isArray(values) || !values.every(object)) return false;
      }
    }
    return true;
  }

  function rememberMusicLinks(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return;
    const links = data.site && data.site.links || {};
    const channel = data.youtube && data.youtube.channelUrl;
    musicKnownLinks = {
      bandcamp: safeHomeUrl(links.bandcamp, false) || MUSIC_FALLBACK_LINKS.bandcamp,
      youtube: safeHomeUrl(links.youtube, false) || safeHomeUrl(channel, false) || MUSIC_FALLBACK_LINKS.youtube,
    };
  }

  function renderMusicFailure(state) {
    const root = document.getElementById("music-content");
    musicPlayback = new Map();
    if (window.MusicPlayer) window.MusicPlayer.close({ restoreFocus: false });
    root.innerHTML = `<div class="music-heading"><h1 class="site-section-title">music</h1></div><div class="music-error" role="status"><p>音源の情報を読み込めませんでした。</p><button type="button" class="site-button site-button--secondary" data-testid="music-retry" data-music-action="retry">もう一度読み込む</button><div class="music-links">${musicExternal(musicKnownLinks.bandcamp, "Bandcamp", "site-chip")}${musicExternal(musicKnownLinks.youtube, "YouTube", "site-chip")}</div></div>`;
    root.dataset.state = state;
  }

  function musicHash() {
    const root = document.getElementById("music-content");
    if (root.dataset.state === "loading") return;
    const hash = String(window.location.hash || "");
    if (!hash) return;
    const id = hash.slice(1);
    const section = ["release", "demo", "video"].includes(id) ? document.getElementById(id) : null;
    if (section) section.scrollIntoView();
    else {
      window.history.replaceState(null, "", window.location.pathname + (window.location.search || ""));
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  // PC: the release list is a grid, and the player gets its own full-width row right under the row of the
  // pressed work (never over another card). The row follows the live column count, so a resize re-places it;
  // the host is never moved in the DOM because moving an iframe reloads it. Narrow layouts are one column in
  // flow and the host already follows its own card.
  function placeMusicPlayer(host) {
    const list = host && host.parentNode;
    if (!list || typeof window.getComputedStyle !== "function") return;
    const style = window.getComputedStyle(list) || {};
    const columns = style.display === "grid" ? String(style.gridTemplateColumns || "").split(/\s+/).filter(token => /^\d/.test(token)).length : 0;
    const cards = Array.from(list.children).filter(node => node.classList.contains("music-release-card"));
    const index = cards.indexOf(document.getElementById(host.dataset.musicHost));
    host.style.gridRow = columns > 0 && index >= 0 ? String(Math.floor(index / columns) + 2) : "";
  }

  function musicExternal(url, label, className, workTitle) {
    const name = `${label}（${workTitle ? `${workTitle}・` : ""}外部サイト・別タブ）`;
    return `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(name)}">${label}</a>`;
  }

  function musicArtwork(item, version) {
    const image = safeHomeUrl(item.image, true);
    const fallback = `<span class="music-artwork-fallback"${image ? " hidden" : ""}>松本一樹</span>`;
    return `${image ? `<img data-music-image="true" src="${escapeHtml(resolveImageSrc(image, version))}" alt="${escapeHtml(item.title || "")}" width="220" height="220">` : ""}${fallback}`;
  }

  function renderMusic(data, version) {
    if (window.MusicPlayer) window.MusicPlayer.close({ restoreFocus: false });
    const helper = window.MusicData;
    if (!helper || typeof helper.sortReleasesByDate !== "function") throw new Error("Music helper unavailable");
    musicPlayback = new Map();
    const discography = data.discography || {};
    const youtube = data.youtube || {};
    const videos = MUSIC_CHANNELS.flatMap(key => youtube[key] || []);
    const channel = safeHomeUrl(youtube.channelUrl, false);
    const channelLink = channel ? musicExternal(channel, "YouTubeチャンネル →", "site-text-link") : "";
    const sections = [];
    const anchors = [];
    for (const [category, section] of [["digital", "release"], ["demo", "demo"]]) {
      const items = discography[category] || [];
      const sorted = helper.sortReleasesByDate(items);
      if (!sorted.length) continue;
      anchors.push(section);
      const cards = sorted.map(item => {
        const key = `music-release-${category}-${items.indexOf(item)}`;
        const hostId = `${key}-player`;
        const selected = item.playbackVideoId ? videos.find(video => video.id === item.playbackVideoId) : null;
        const youtubeId = String(selected && selected.youtubeId || "").trim();
        const playable = /^[A-Za-z0-9_-]{11}$/.test(youtubeId);
        if (playable) musicPlayback.set(key, { youtubeId, title: item.title || "", mode: "release" });
        const link = safeHomeUrl(item.link, false);
        const listen = playable ? `<button type="button" class="site-button site-button--play" data-testid="music-listen" data-music-action="play" data-music-key="${key}" aria-expanded="false" aria-controls="${hostId}">聴く</button>` : "";
        const external = link ? musicExternal(link, category === "digital" ? "配信先へ" : "購入先へ", category === "digital" ? "site-chip" : "site-button site-button--secondary", String(item.title || "")) : "";
        const description = String(item.description || "").replace(/<br\s*\/?>/gi, "\n").replace(/\r\n?/g, "\n");
        const meta = homeReleaseMeta(item);
        return `<article id="${key}" class="site-release-card music-release-card" data-music-release="${key}"><div class="site-release-image music-release-image">${musicArtwork(item, version)}</div><div class="music-release-text"><h3 class="music-release-title">${escapeHtml(item.title || "")}</h3>${meta ? `<p class="music-release-meta">${escapeHtml(meta)}</p>` : ""}${description ? `<p class="music-release-description">${escapeHtml(description).replace(/\n/g, "<br>")}</p>` : ""}${listen || external ? `<div class="music-actions">${listen}${external}</div>` : ""}</div></article><div id="${hostId}" class="music-player music-release-player" role="group" aria-label="${escapeHtml(item.title || "作品")}の再生" data-music-host="${key}" hidden></div>`;
      }).join("");
      sections.push(`<section id="${section}" class="music-section" aria-labelledby="${section}-title"><div class="music-section-heading"><h2 id="${section}-title">${section}</h2>${section === "demo" ? '<p class="music-demo-intro">宅録のデモ。ライブ会場とBandcampで販売しています。</p>' : ""}</div><div class="music-release-list">${cards}</div></section>`);
    }
    const groups = MUSIC_CHANNELS.map((category, i) => {
      const items = youtube[category] || [];
      if (!items.length) return "";
      const cards = items.map((item, ordinal) => {
        const key = `music-video-${category}-${ordinal}`;
        const hostId = `${key}-player`;
        const youtubeId = String(item.youtubeId || "").trim();
        const playable = /^[A-Za-z0-9_-]{11}$/.test(youtubeId);
        if (playable) musicPlayback.set(key, { youtubeId, title: item.title || "", mode: "video" });
        const thumbnail = `${playable ? `<img data-music-image="true" src="https://img.youtube.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg" alt="" width="474" height="267">` : ""}<span class="music-video-fallback"${playable ? " hidden" : ""}>video</span>`;
        const trigger = playable ? `<button type="button" class="music-video-thumbnail" data-testid="music-video-play" data-music-action="play" data-music-key="${key}" aria-label="${escapeHtml(item.title || "映像")}を再生" aria-expanded="false" aria-controls="${hostId}">${thumbnail}</button>` : `<div class="music-video-thumbnail">${thumbnail}</div>`;
        return `<article id="${key}" class="music-video-card" data-music-video="${key}"><div class="music-video-stage">${trigger}<div id="${hostId}" class="music-player" hidden></div></div><h4 class="music-video-title">${escapeHtml(item.title || "")}</h4>${playable ? `<button type="button" class="site-button site-button--secondary" data-testid="music-close" data-music-action="close" data-music-key="${key}" aria-controls="${hostId}" hidden>閉じる</button>` : ""}</article>`;
      }).join("");
      return `<div class="music-video-group"><h3 class="home-caption">${["music video", "live movie", "demo"][i]}</h3><div class="music-video-list">${cards}</div></div>`;
    }).join("");
    if (groups) {
      anchors.push("video");
      sections.push(`<section id="video" class="music-section" aria-labelledby="video-title"><div class="music-video-heading"><h2 id="video-title">video</h2>${channelLink}</div>${groups}</section>`);
    }
    document.getElementById("music-content").innerHTML = `<div class="music-heading"><h1 class="site-section-title">music</h1><nav class="music-jumps" aria-label="ページ内の移動">${anchors.map(id => `<a class="site-chip" href="#${id}">${id}</a>`).join("")}</nav>${!groups ? channelLink : ""}</div>${sections.join("")}`;
    return sections.length > 0;
  }

  // After a retry the pressed button is replaced, so focus would fall to body. Put it back on a meaningful
  // element unless the user has already moved it somewhere else while loading.
  function settleMusicFocus(root, origin) {
    const active = document.activeElement;
    if (active && active !== document.body && active !== origin && !root.contains(active)) return;
    const target = root.dataset.state === "ready" ? root.querySelector("h1") : root.querySelector('[data-music-action="retry"]');
    if (!target) return;
    if (target.tagName === "H1") target.setAttribute("tabindex", "-1");
    // musicHash() has already put a hash section in view; the heading focus must not scroll it away.
    if (target.tagName === "H1" && ["release", "demo", "video"].includes(String(window.location.hash || "").slice(1))) target.focus({ preventScroll: true });
    else target.focus();
  }

  async function bootMusic(retryButton) {
    if (musicRequestPending) return;
    musicRequestPending = true;
    const serial = ++musicRequestSerial;
    const root = document.getElementById("music-content");
    if (window.MusicPlayer) window.MusicPlayer.close({ restoreFocus: false });
    musicPlayback = new Map();
    root.dataset.state = "loading";
    root.setAttribute("aria-busy", "true");
    root.innerHTML = '<div class="music-heading"><h1 class="site-section-title">music</h1></div><div class="music-loading"><p role="status">読み込み中</p><div class="music-skeleton" aria-hidden="true"></div></div><section class="music-section"><h2>release</h2></section><section class="music-section"><h2>demo</h2></section><section class="music-section"><h2>video</h2></section>';
    const payload = await fetchSiteData();
    if (serial !== musicRequestSerial) return;
    try {
      rememberMusicLinks(payload && payload.data);
      if (!payload || !validMusicData(payload.data)) throw new Error("Invalid Music data");
      const hasContent = renderMusic(payload.data, payload.meta.updatedAt || "");
      renderSite(payload.data.site || {});
      if (hasContent) root.dataset.state = "ready";
      else renderMusicFailure("empty");
    } catch (_error) {
      renderMusicFailure("error");
    } finally {
      musicRequestPending = false;
      root.setAttribute("aria-busy", "false");
      musicHash();
    }
    if (retryButton) settleMusicFocus(root, retryButton);
  }

  function wireMusic() {
    const root = document.getElementById("music-content");
    root.addEventListener("click", event => {
      const button = event.target.closest("[data-music-action]");
      if (!button || !root.contains(button)) return;
      if (button.dataset.musicAction === "retry") {
        if (!musicRequestPending) { button.disabled = true; bootMusic(button); }
        return;
      }
      const player = window.MusicPlayer;
      if (!player) return;
      if (button.dataset.musicAction === "close" || button.getAttribute("aria-expanded") === "true") player.close();
      else if (button.dataset.musicAction === "play") {
        const key = button.dataset.musicKey;
        const playback = musicPlayback.get(key);
        if (!playback) return;
        const article = document.getElementById(key);
        if (playback.mode === "release") placeMusicPlayer(document.getElementById(`${key}-player`));
        player.open({ ...playback, host: document.getElementById(`${key}-player`), trigger: button, closeButton: playback.mode === "release" ? button : article.querySelector('[data-music-action="close"]') });
      }
    });
    root.addEventListener("error", event => {
      const image = event.target;
      if (!image || image.getAttribute("data-music-image") !== "true") return;
      image.hidden = true;
      if (image.nextElementSibling) image.nextElementSibling.hidden = false;
    }, true);
    window.addEventListener("hashchange", musicHash);
    window.addEventListener("resize", () => {
      root.querySelectorAll(".music-release-player").forEach(host => { if (!host.hidden) placeMusicPlayer(host); });
    });
    window.addEventListener("pagehide", () => {
      if (musicRequestPending) musicInterrupted = true;
      ++musicRequestSerial;
      musicRequestPending = false;
      root.setAttribute("aria-busy", "false");
      root.querySelectorAll('[data-music-action="retry"]').forEach(button => { button.disabled = false; });
      if (window.MusicPlayer) window.MusicPlayer.close({ restoreFocus: false });
    });
    window.addEventListener("pageshow", event => {
      if (!event.persisted || !musicInterrupted) return;
      musicInterrupted = false;
      bootMusic();
    });
  }

  // Issue #45: Profile.
  let profileRequestSerial = 0;
  let profileRequestPending = false;
  let profileInterrupted = false;

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  // Same alias test as findProfileLink, so the five services are decided exactly as on Home.
  function isSharedServiceLink(item) {
    const name = String(item && item.name ? item.name : "").trim().toLowerCase();
    return SHARED_LINKS.some((entry) => entry.aliases.some((alias) => {
      const safeAlias = String(alias).trim().toLowerCase();
      return name === safeAlias || name.includes(safeAlias);
    }));
  }

  function profileLinkKey(url) {
    return new URL(url).href.replace(/\/+$/, "");
  }

  // The five services come first, exactly as Home builds them; Profile links outside those services follow in
  // registered order. The same destination appears once and only http(s) links are kept.
  function buildProfileLinks(siteLinks, profileLinks) {
    const shared = buildSharedLinks(siteLinks, profileLinks)
      .filter((entry) => safeHomeUrl(entry.url, false))
      .map((entry) => ({ label: entry.label, url: entry.url }));
    const seen = new Set(shared.map((entry) => profileLinkKey(entry.url)));
    const extra = [];
    (Array.isArray(profileLinks) ? profileLinks : []).forEach((item) => {
      if (!isPlainObject(item) || isSharedServiceLink(item)) return;
      const url = safeHomeUrl(item.url, false);
      if (!url) return;
      const key = profileLinkKey(url);
      if (seen.has(key)) return;
      seen.add(key);
      extra.push({ label: String(item.name || "").trim() || new URL(url).host, url });
    });
    return shared.concat(extra);
  }

  function validProfileData(payload) {
    if (!payload || !isPlainObject(payload.data)) return false;
    const profile = payload.data.profile;
    return profile === undefined || profile === null || isPlainObject(profile);
  }

  function renderProfileContent(data, version) {
    const profile = isPlainObject(data.profile) ? data.profile : {};
    const site = isPlainObject(data.site) ? data.site : {};
    const photo = document.getElementById("profile-photo");
    const image = document.getElementById("profile-image");
    const text = document.getElementById("profile-text");
    const block = document.getElementById("profile-links-block");
    const list = document.getElementById("profile-link-list");

    const imagePath = safeHomeUrl(profile.image, true);
    image.removeAttribute("src");
    photo.hidden = !imagePath;
    if (imagePath) image.setAttribute("src", resolveImageSrc(imagePath, version));

    const raw = profile.text === undefined || profile.text === null ? "" : String(profile.text);
    const value = raw.replace(/\r\n?/g, "\n").replace(/<br\s*\/?>/gi, "\n");
    text.textContent = value.trim() ? value : "";
    text.hidden = !value.trim();

    const links = buildProfileLinks(site.links, profile.links);
    list.innerHTML = links
      .map((link) => `<a href="${escapeHtml(link.url)}" class="site-chip" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(link.label)}（外部サイト・別タブ）">${escapeHtml(link.label)}</a>`)
      .join("");
    block.hidden = links.length === 0;
    renderSite(site, version);
  }

  function renderProfileFailure() {
    const root = document.getElementById("profile-content");
    root.dataset.state = "error";
    document.getElementById("profile-photo").hidden = true;
    document.getElementById("profile-image").removeAttribute("src");
    document.getElementById("profile-text").textContent = "";
    document.getElementById("profile-text").hidden = true;
    document.getElementById("profile-link-list").innerHTML = "";
    document.getElementById("profile-links-block").hidden = true;
    document.getElementById("profile-state").innerHTML = '<p>プロフィールを読み込めませんでした。</p><button type="button" class="site-button site-button--secondary" data-profile-action="retry">もう一度読み込む</button>';
  }

  async function bootProfile(retryButton) {
    if (profileRequestPending) return;
    profileRequestPending = true;
    const serial = ++profileRequestSerial;
    const root = document.getElementById("profile-content");
    root.dataset.state = "loading";
    root.setAttribute("aria-busy", "true");
    const image = document.getElementById("profile-image");
    image.removeAttribute("src");
    document.getElementById("profile-photo").hidden = false;
    document.getElementById("profile-text").hidden = true;
    document.getElementById("profile-links-block").hidden = true;
    document.getElementById("profile-state").innerHTML = '<p role="status">読み込み中</p>';
    const payload = await fetchSiteData();
    if (serial !== profileRequestSerial) return;
    try {
      if (!validProfileData(payload)) throw new Error("Invalid Profile data");
      renderProfileContent(payload.data, payload.meta && payload.meta.updatedAt ? payload.meta.updatedAt : "");
      document.getElementById("profile-state").innerHTML = "";
      root.dataset.state = "ready";
    } catch (_error) {
      renderProfileFailure();
    } finally {
      profileRequestPending = false;
      root.setAttribute("aria-busy", "false");
    }
    if (!retryButton) return;
    const target = root.dataset.state === "ready" ? root.querySelector("h1") : root.querySelector('[data-profile-action="retry"]');
    if (!target) return;
    if (target.tagName === "H1") target.setAttribute("tabindex", "-1");
    target.focus();
  }

  function wireProfile() {
    const root = document.getElementById("profile-content");
    root.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-profile-action="retry"]') : null;
      if (!button || !root.contains(button) || profileRequestPending) return;
      button.disabled = true;
      bootProfile(button);
    });
    // A photo that cannot be loaded leaves no empty frame behind.
    document.getElementById("profile-image").addEventListener("error", () => {
      document.getElementById("profile-photo").hidden = true;
    });
    window.addEventListener("pagehide", () => {
      if (profileRequestPending) profileInterrupted = true;
      ++profileRequestSerial;
      profileRequestPending = false;
      root.setAttribute("aria-busy", "false");
      root.querySelectorAll('[data-profile-action="retry"]').forEach((button) => { button.disabled = false; });
    });
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted || !profileInterrupted) return;
      profileInterrupted = false;
      bootProfile();
    });
  }

  // Issue #45: Contact. The embedded intro and endpoint are the fallback; settings only refine them.
  const CONTACT_SETTINGS_TIMEOUT_MS = 8000;

  async function bootContact() {
    const root = document.getElementById("contact-content");
    const intro = document.getElementById("contact-intro");
    const form = document.getElementById("contact-form");
    const submit = document.getElementById("contact-submit");
    const embeddedIntro = intro.textContent;
    const embeddedIntroHidden = intro.hidden;
    let timedOut = false;
    let answered = false;

    // The submit button stays off while settings are loading or a submission is in flight.
    function syncSubmit() {
      submit.disabled = root.dataset.settings === "loading" || form.dataset.submitState === "sending";
    }
    function settle(mode) {
      root.dataset.settings = mode;
      root.setAttribute("aria-busy", "false");
      syncSubmit();
    }
    function showEmbeddedIntro() {
      intro.textContent = embeddedIntro;
      intro.hidden = embeddedIntroHidden;
      delete intro.dataset.state;
    }
    function applySettings(contact) {
      const introText = String(contact.introText || "").trim();
      const formAction = String(contact.formAction || "").trim();
      delete intro.dataset.state;
      intro.textContent = introText;
      intro.hidden = !introText || form.dataset.submitState === "done";
      if (formAction) form.setAttribute("action", formAction);
    }

    root.dataset.settings = "loading";
    root.setAttribute("aria-busy", "true");
    intro.textContent = "読み込み中";
    intro.dataset.state = "loading";
    intro.hidden = false;
    syncSubmit();
    const timer = setTimeout(() => {
      if (answered) return;
      timedOut = true;
      showEmbeddedIntro();
      settle("fallback");
    }, CONTACT_SETTINGS_TIMEOUT_MS);

    const payload = await fetchSiteData();
    answered = true;
    clearTimeout(timer);
    const data = payload && payload.data;
    if (!isPlainObject(data) || !(data.contact === undefined || data.contact === null || isPlainObject(data.contact))) {
      if (!timedOut) {
        showEmbeddedIntro();
        settle("fallback");
      }
      return;
    }
    applySettings(isPlainObject(data.contact) ? data.contact : {});
    renderSite(isPlainObject(data.site) ? data.site : {}, payload.meta && payload.meta.updatedAt ? payload.meta.updatedAt : "");
    settle("ready");
  }

  async function boot() {
    if (document.getElementById("home-content")) { wireHome(); return bootHome(); }
    if (document.getElementById("music-content")) { wireMusic(); return bootMusic(); }
    if (document.getElementById("profile-content")) { wireProfile(); return bootProfile(); }
    if (document.getElementById("contact-content")) return bootContact();
    const payload = await fetchSiteData();
    if (!payload) return;
    const siteData = payload.data || {};
    const version = payload.meta && payload.meta.updatedAt ? payload.meta.updatedAt : "";
    const site = siteData.site || {};
    const profile = siteData.profile || {};
    renderSite(site, version);
    renderHomeLinks(site.links || {}, profile.links || []);
    renderContact(siteData.contact || {});
    renderNews(siteData.news || [], version);
    renderLive(siteData, version);
    renderLiveDetailPage(siteData, version);
    renderDiscography(siteData.discography || {}, version);
    renderProfile(profile, site.links || {}, version);
    renderYouTube(siteData.youtube || {});
  }

  boot();
})();
