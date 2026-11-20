(function () {
  'use strict';

  // Ticket complete page. The receipt comes from this tab's sessionStorage (TicketReceipt) and
  // is shown without waiting for the network; the public site data only adds the footer text
  // and the "listen before the day" block. With no receipt nothing is made up.
  const main = document.getElementById('ticket-complete-content');
  if (!main) return;
  const siteRoot = main.getAttribute('data-site-root') || '../../';
  const DEFAULT_COMPLETE_TEXT = '予約しました。';
  const VIDEO_LISTS = ['musicVideos', 'liveMovies', 'demos'];
  const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
  let playback = null;

  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    if (value === null || value === undefined || value === '') return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function trimmed(value) {
    return String(value === null || value === undefined ? '' : value).trim();
  }

  function formatLiveDate(value) {
    const operations = window.LiveOperations;
    return operations && typeof operations.formatLiveDate === 'function'
      ? operations.formatLiveDate(value)
      : trimmed(value);
  }

  function assetSrc(raw) {
    const value = trimmed(raw);
    if (!value) return '';
    return /^https?:\/\//.test(value) || value.startsWith('/') || value.startsWith('../') || value.startsWith('./')
      ? value
      : `${siteRoot}${value.replace(/^\/+/, '')}`;
  }

  function safeUrl(value, allowRelative) {
    const raw = trimmed(value);
    if (!raw) return '';
    try {
      const url = allowRelative ? new URL(raw, window.location.href || 'http://localhost/') : new URL(raw);
      return url.protocol === 'http:' || url.protocol === 'https:' ? raw : '';
    } catch (_error) {
      return '';
    }
  }

  // ---- receipt ----------------------------------------------------------------------------
  function receiptLines(receipt) {
    const ui = receipt.ui || {};
    const lines = [`名前　${receipt.name}`, `e-mail　${receipt.email}`];
    if (ui.showQuantity !== false) lines.push(`${ui.labelQuantity || '枚数'}　${receipt.quantity}`);
    if (ui.showMessage !== false) lines.push(`${ui.labelMessage || '備考'}　${receipt.message ? receipt.message : '-'}`);
    return lines.join('\n');
  }

  function renderReceipt(receipt) {
    const live = receipt.live || {};
    const src = assetSrc(live.image);
    const date = formatLiveDate(live.date);
    const venue = trimmed(live.venue);
    const title = trimmed(live.title);
    $('ticket-complete-message').textContent = trimmed(receipt.ui && receipt.ui.completeText) || DEFAULT_COMPLETE_TEXT;
    $('ticket-complete-card').innerHTML = (src ? `<figure class="ticket-complete-figure"><img class="ticket-complete-img" data-ticket-image="true" src="${escapeHtml(src)}" alt=""></figure>` : '')
      + '<div class="ticket-complete-text">'
      + `<p class="ticket-complete-number">受付番号　${escapeHtml(receipt.rid)}</p>`
      + `<p class="ticket-complete-live">${escapeHtml(venue ? `${date}　${venue}` : date)}</p>`
      + (title ? `<p class="ticket-complete-title">${escapeHtml(title)}</p>` : '')
      + `<p class="ticket-complete-fields" data-testid="ticket-complete-fields">${escapeHtml(receiptLines(receipt))}</p>`
      + '</div>';
    $('ticket-next-detail').setAttribute('href', `${siteRoot}live/detail/?liveId=${encodeURIComponent(receipt.liveId)}`);
    $('ticket-complete-missing').hidden = true;
    $('ticket-complete-ready').hidden = false;
    main.setAttribute('data-state', 'ready');
  }

  // ---- listen before the day --------------------------------------------------------------
  function artworkHtml(item) {
    const src = assetSrc(safeUrl(item.image, true));
    const fallback = `<div class="ticket-listen-fallback"${src ? ' hidden' : ''}>松本一樹</div>`;
    return src ? `<img class="ticket-listen-img" data-ticket-image="true" src="${escapeHtml(src)}" alt="${escapeHtml(item.title || '')}">${fallback}` : fallback;
  }

  function renderListen(data) {
    const section = $('ticket-listen');
    const music = window.MusicData;
    playback = null;
    section.hidden = true;
    if (!music || typeof music.resolveFeaturedRelease !== 'function') return;
    const face = music.resolveFeaturedRelease(data);
    if (!face) return;
    const videos = VIDEO_LISTS.flatMap((key) => (Array.isArray(data.youtube && data.youtube[key]) ? data.youtube[key] : []));
    const selected = face.playbackVideoId ? videos.find((item) => item.id === face.playbackVideoId) : null;
    const youtubeId = trimmed(selected && selected.youtubeId);
    playback = YOUTUBE_ID.test(youtubeId) ? { youtubeId, title: face.title || '' } : null;
    const link = safeUrl(face.link, false);
    const isDemo = Boolean(data.discography && Array.isArray(data.discography.demo) && data.discography.demo.includes(face));
    const linkLabel = isDemo ? '購入先へ' : '配信先へ';
    const meta = [face.releaseType, face.releaseDate].map(trimmed).filter(Boolean).join(' ／ ');
    const host = $('ticket-player');
    $('ticket-listen-item').innerHTML = `<div class="ticket-listen-jacket">${artworkHtml(face)}</div>`
      + `<div class="ticket-listen-text"><p class="ticket-listen-title">${escapeHtml(face.title || '')}</p><p class="ticket-listen-meta">${escapeHtml(meta)}</p></div>`
      + '<div class="ticket-listen-actions">'
      + (playback ? '<button type="button" class="site-button site-button--play" data-ticket-action="play" aria-expanded="false" aria-controls="ticket-player">聴く</button>' : '')
      + (link ? `<a class="site-chip" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" aria-label="${linkLabel}（外部サイト・別タブ）">${linkLabel}</a>` : '')
      + '</div>';
    $('ticket-listen-item').appendChild(host);
    host.hidden = true;
    section.hidden = false;
  }

  function wireListen() {
    main.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-ticket-action="play"]') : null;
      if (!button || !main.contains(button) || !playback || !window.HomePlayer) return;
      if (button.getAttribute('aria-expanded') === 'true') window.HomePlayer.close();
      else window.HomePlayer.open($('ticket-player'), button, playback.youtubeId, playback.title);
    });
    main.addEventListener('error', (event) => {
      const image = event.target;
      if (!image || !image.getAttribute || image.getAttribute('data-ticket-image') !== 'true') return;
      const figure = image.closest ? image.closest('.ticket-complete-figure') : null;
      if (figure) {
        figure.hidden = true;
        return;
      }
      image.hidden = true;
      if (image.nextElementSibling) image.nextElementSibling.hidden = false;
    }, true);
  }

  // ---- site data (footer and listen) ------------------------------------------------------
  async function fetchSiteData() {
    const base = String(window.SITE_API_BASE || '').replace(/\/+$/, '');
    const endpoint = base ? `${base}/api/public/site-data` : '/api/public/site-data';
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response || !response.ok) return null;
      const payload = await response.json();
      const data = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
      return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch (_error) {
      return null;
    }
  }

  async function boot() {
    const params = new URLSearchParams(String(window.location && window.location.search ? window.location.search : ''));
    const store = window.TicketReceipt;
    const receipt = store && typeof store.load === 'function'
      ? store.load({ liveId: params.get('liveId') || '', rid: params.get('rid') || '' })
      : null;
    if (receipt) renderReceipt(receipt);
    wireListen();
    const data = await fetchSiteData();
    if (!data) return;
    const footer = $('site-footer');
    if (footer) footer.textContent = trimmed(data.site && data.site.footerText);
    if (receipt) renderListen(data);
  }

  boot();
}());
