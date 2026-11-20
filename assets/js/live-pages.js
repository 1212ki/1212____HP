(function () {
  'use strict';

  // Live list (live/), Live detail and the full list of finished Lives (live/detail/).
  // The three views share one fetch/state machine. The reservation rule is
  // LiveOperations.getTicketCta (through ReservationCta); the order is LiveOrder.
  const PAST_PREVIEW_LIMIT = 3;
  const TEXT = {
    loadError: 'ライブ情報を読み込めませんでした。',
    retry: 'もう一度読み込む',
    emptyUpcoming: '次のライブは、決まり次第ここでお知らせします。',
    emptyArchive: '終了したライブはまだありません。',
    notFound: 'このライブは見つかりませんでした。',
    notFoundHint: 'アドレスが変わったか、掲載が終わった可能性があります。',
    toList: 'ライブの一覧へ →',
    loading: '読み込み中',
    archiveHeading: '終了したライブ（全件）',
    siteName: '松本一樹',
  };

  const listRoot = document.getElementById('live-content');
  const detailRoot = document.getElementById('live-detail-content');
  const main = listRoot || detailRoot;
  if (!main) return;
  const isList = main === listRoot;
  const siteRoot = main.getAttribute('data-site-root') || '';

  let serial = 0;
  let pending = false;
  let interrupted = false;

  function escapeHtml(value) {
    if (value === null || value === undefined || value === '') return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function helpers() {
    const operations = window.LiveOperations;
    const order = window.LiveOrder;
    const cta = window.ReservationCta;
    const ready = operations
      && typeof operations.resolveLiveById === 'function'
      && typeof operations.getTicketCta === 'function'
      && typeof operations.formatLiveDate === 'function'
      && typeof operations.formatLiveDetails === 'function'
      && typeof operations.parseLiveDate === 'function'
      && order && typeof order.sortUpcoming === 'function' && typeof order.sortPast === 'function'
      && cta && typeof cta.resolve === 'function';
    return ready ? { operations, order, cta } : null;
  }

  function trimmed(value) {
    return String(value === null || value === undefined ? '' : value).trim();
  }

  // ---- data -------------------------------------------------------------------------------
  async function fetchSiteData() {
    const base = String(window.SITE_API_BASE || '').replace(/\/+$/, '');
    const endpoint = base ? `${base}/api/public/site-data` : '/api/public/site-data';
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response || !response.ok) throw new Error('failed to load site data');
    const payload = await response.json();
    const data = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    const meta = payload && typeof payload === 'object' && payload.meta && typeof payload.meta === 'object' ? payload.meta : {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid site data');
    const live = data.live;
    if (!live || typeof live !== 'object' || Array.isArray(live)) throw new Error('invalid live data');
    if (!Array.isArray(live.upcoming) || !Array.isArray(live.past)) throw new Error('invalid live lists');
    return { data, version: meta.updatedAt ? String(meta.updatedAt) : '' };
  }

  function withVersion(url, version) {
    if (!url || !version) return url;
    return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
  }

  function imageSrc(raw, version) {
    const value = trimmed(raw);
    if (!value) return '';
    let url = value;
    if (!(/^https?:\/\//.test(value) || value.startsWith('/') || value.startsWith('../') || value.startsWith('./'))) {
      url = `${siteRoot}${value.replace(/^\/+/, '')}`;
    }
    return withVersion(url, version);
  }

  function renderFooter(data) {
    const footer = document.getElementById('site-footer');
    if (!footer) return;
    const site = data && data.site && typeof data.site === 'object' ? data.site : {};
    footer.textContent = trimmed(site.footerText);
  }

  // ---- markup -----------------------------------------------------------------------------
  function faceText(h, live) {
    const parsed = h.operations.parseLiveDate(live && live.date);
    return parsed ? parsed.date : trimmed(live && live.date);
  }

  function flyerHtml(h, live, version) {
    const src = imageSrc(live && live.image, version);
    const face = `<div class="live-flyer-fallback" data-testid="live-flyer-fallback"${src ? ' hidden' : ''}>${escapeHtml(faceText(h, live))}</div>`;
    return src ? `<img class="live-flyer-img" data-live-image="true" src="${escapeHtml(src)}" alt="">${face}` : face;
  }

  function reserveHtml(cta) {
    const base = `data-testid="live-reserve" data-kind="${escapeHtml(cta.kind)}"`;
    if (cta.kind === 'internal') {
      return `<a class="site-button site-button--primary" ${base} href="${escapeHtml(cta.url)}">${escapeHtml(cta.label)}</a>`;
    }
    if (cta.kind === 'external') {
      return `<a class="site-button site-button--primary" ${base} href="${escapeHtml(cta.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(cta.label)}</a>`;
    }
    return `<span class="site-button site-button--secondary is-inactive" ${base} aria-disabled="true">${escapeHtml(cta.label)}</span>`;
  }

  function idOf(item) {
    return trimmed(item && item.id);
  }

  function detailPath(id, fromArchive) {
    const query = `?liveId=${encodeURIComponent(id)}`;
    return fromArchive ? `./${query}` : `detail/${query}`;
  }

  function resolved(h, data, item) {
    const id = idOf(item);
    return id ? h.cta.resolve(data, id, `${siteRoot}ticket/?liveId=${encodeURIComponent(id)}`) : { kind: 'unknown' };
  }

  function usable(cta) {
    return cta.kind !== 'unknown' && cta.kind !== 'ambiguous' && cta.kind !== 'helper';
  }

  function cardHtml(h, data, item, version) {
    const id = idOf(item);
    const cta = resolved(h, data, item);
    const date = h.operations.formatLiveDate(item.date);
    const title = trimmed(item.title);
    const lines = h.operations.formatLiveDetails(item).split('\n').slice(0, 2).join('\n');
    const flyer = flyerHtml(h, item, version);
    const link = usable(cta) ? detailPath(id, false) : '';
    const flyerTag = link
      ? `<a class="live-card-flyer" href="${escapeHtml(link)}" aria-label="${escapeHtml(`${date} ${trimmed(item.venue)}`.trim())}の詳細">${flyer}</a>`
      : `<div class="live-card-flyer">${flyer}</div>`;
    const actions = usable(cta)
      ? `<div class="live-card-actions">${reserveHtml(cta)}<a class="site-button site-button--secondary" href="${escapeHtml(link)}">詳細</a></div>`
      : '';
    return `<article class="live-card" data-testid="live-card" data-live-id="${escapeHtml(id)}">${flyerTag}`
      + '<div class="live-card-summary">'
      + `<p class="live-card-date">${escapeHtml(date)}</p>`
      + `<p class="live-card-venue">${escapeHtml(trimmed(item.venue))}</p>`
      + (title ? `<p class="live-card-title">${escapeHtml(title)}</p>` : '')
      + (lines ? `<p class="live-card-details">${escapeHtml(lines)}</p>` : '')
      + `</div>${actions}</article>`;
  }

  function rowHtml(h, data, item, fromArchive) {
    const id = idOf(item);
    const cta = resolved(h, data, item);
    const title = trimmed(item.title);
    const inner = `<span class="live-past-date">${escapeHtml(h.operations.formatLiveDate(item.date))}</span>`
      + `<span class="live-past-venue">${escapeHtml(trimmed(item.venue))}</span>`
      + (title ? `<span class="live-past-title">${escapeHtml(title)}</span>` : '')
      + '<span class="live-past-arrow" aria-hidden="true">→</span>';
    if (!usable(cta)) return `<div class="live-past-row" data-testid="live-past-row">${inner}</div>`;
    return `<a class="live-past-row" data-testid="live-past-row" href="${escapeHtml(detailPath(id, fromArchive))}">${inner}</a>`;
  }

  function errorHtml() {
    return `<div class="live-notice" data-testid="live-error" role="alert"><p>${TEXT.loadError}</p>`
      + `<button type="button" class="site-button site-button--secondary" data-testid="live-retry" data-live-action="retry">${TEXT.retry}</button></div>`;
  }

  function skeletonHtml() {
    return `<div class="live-skeleton" role="status">${TEXT.loading}</div>`;
  }

  function notFoundHtml() {
    return '<div class="live-notice" data-testid="live-detail-notfound" tabindex="-1" data-live-focus>'
      + `<p>${TEXT.notFound}</p><p class="live-notice-hint">${TEXT.notFoundHint}</p>`
      + `<a class="site-text-link" href="../">${TEXT.toList}</a></div>`;
  }

  function infoHtml(h, live) {
    const structured = h.operations.formatLiveDetails(Object.assign({}, live, { description: '' }));
    if (structured) {
      const items = structured.split('\n').map((line) => `<li>${escapeHtml(line)}</li>`).join('');
      return `<section class="live-detail-info" data-part="info" aria-label="公演情報"><ul class="live-info-list">${items}</ul></section>`;
    }
    const description = h.operations.formatLiveDetails(live).replace(/\r\n?/g, '\n');
    if (!description) return '';
    return '<section class="live-detail-info" data-part="info" aria-label="公演情報">'
      + `<div class="live-detail-description" data-testid="live-detail-description">${escapeHtml(description)}</div></section>`;
  }

  // ---- views ------------------------------------------------------------------------------
  function setState(state) {
    main.setAttribute('data-state', state);
    main.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  }

  function focusTarget() {
    const target = main.querySelector('[data-live-focus]') || main.querySelector('h1');
    if (target && typeof target.focus === 'function') target.focus();
  }

  function showLoading() {
    setState('loading');
    if (isList) {
      document.getElementById('live-status').innerHTML = skeletonHtml();
      document.getElementById('live-upcoming').hidden = true;
      document.getElementById('live-past').hidden = true;
    } else {
      document.getElementById('live-detail-body').innerHTML = skeletonHtml();
    }
  }

  function showError() {
    setState('error');
    if (isList) {
      document.getElementById('live-status').innerHTML = errorHtml();
      document.getElementById('live-upcoming').hidden = true;
      document.getElementById('live-past').hidden = true;
    } else {
      document.getElementById('live-detail-body').innerHTML = errorHtml();
    }
  }

  function renderList(h, data, version) {
    const live = data.live;
    document.getElementById('live-status').innerHTML = '';
    const upcoming = h.order.sortUpcoming(live.upcoming);
    document.getElementById('live-upcoming-list').innerHTML = upcoming.length
      ? upcoming.map((item) => cardHtml(h, data, item, version)).join('')
      : `<p class="live-empty" data-testid="live-empty-upcoming">${TEXT.emptyUpcoming}</p>`;
    document.getElementById('live-upcoming').hidden = false;
    const past = h.order.sortPast(live.past);
    document.getElementById('live-past').hidden = past.length === 0;
    document.getElementById('live-past-list').innerHTML = past.slice(0, PAST_PREVIEW_LIMIT).map((item) => rowHtml(h, data, item, false)).join('');
    document.getElementById('live-past-all').hidden = past.length <= PAST_PREVIEW_LIMIT;
    setState('ready');
  }

  function renderArchive(h, data) {
    const past = h.order.sortPast(data.live.past);
    const rows = past.length
      ? `<div class="live-row-list">${past.map((item) => rowHtml(h, data, item, true)).join('')}</div>`
      : `<p class="live-empty" data-testid="live-archive-empty">${TEXT.emptyArchive}</p>`;
    document.getElementById('live-detail-body').innerHTML = '<h1 class="site-section-title" tabindex="-1" data-live-focus>live</h1>'
      + `<section class="live-section"><h2 class="live-label">${TEXT.archiveHeading}</h2>${rows}</section>`;
    document.title = `${TEXT.archiveHeading} | ${TEXT.siteName}`;
    main.setAttribute('data-view', 'archive');
    setState('ready');
  }

  function renderDetail(h, data, liveId, version) {
    const body = document.getElementById('live-detail-body');
    const cta = h.cta.resolve(data, liveId, `${siteRoot}ticket/?liveId=${encodeURIComponent(liveId)}`);
    if (!liveId || !cta.live || !usable(cta)) {
      body.innerHTML = notFoundHtml();
      setState('empty');
      return;
    }
    const live = cta.live;
    const date = h.operations.formatLiveDate(live.date);
    const venue = trimmed(live.venue);
    const title = trimmed(live.title);
    const heading = `${date} ${venue}`.trim();
    const instagram = h.cta.isInstagramUrl(live.link)
      ? `<a class="site-button site-button--secondary" href="${escapeHtml(trimmed(live.link))}" target="_blank" rel="noopener noreferrer">Instagram</a>`
      : '';
    body.innerHTML = `<article class="live-detail" data-testid="live-detail" data-live-id="${escapeHtml(idOf(live))}"><div class="live-detail-main">`
      + '<div class="live-detail-head" data-part="head">'
      + `<h1 class="live-detail-date" tabindex="-1" data-live-focus>${escapeHtml(date)}</h1>`
      + `<p class="live-detail-venue">${escapeHtml(venue)}</p>`
      + (title ? `<p class="live-detail-title">${escapeHtml(title)}</p>` : '')
      + '</div>'
      + `<div class="live-detail-actions" data-part="actions">${reserveHtml(cta)}${instagram}</div>`
      + `<figure class="live-detail-flyer" data-part="flyer">${flyerHtml(h, live, version)}</figure>`
      + `${infoHtml(h, live)}</div></article>`;
    const docTitle = [title, heading, TEXT.siteName].filter(Boolean).join(' | ');
    if (docTitle) document.title = docTitle;
    setState('ready');
  }

  function detailRequest() {
    const params = new URLSearchParams(String(window.location && window.location.search ? window.location.search : ''));
    const liveId = trimmed(params.get('liveId'));
    const view = trimmed(params.get('view')).toLowerCase();
    return { liveId, archive: view === 'past' && !liveId };
  }

  // ---- loading ----------------------------------------------------------------------------
  async function load(fromRetry) {
    if (pending) return;
    pending = true;
    const mine = ++serial;
    showLoading();
    let result = null;
    try {
      const h = helpers();
      if (!h) throw new Error('helper unavailable');
      const payload = await fetchSiteData();
      if (mine !== serial) return;
      renderFooter(payload.data);
      if (isList) renderList(h, payload.data, payload.version);
      else {
        const request = detailRequest();
        if (request.archive) renderArchive(h, payload.data);
        else renderDetail(h, payload.data, request.liveId, payload.version);
      }
      result = 'ok';
    } catch (_error) {
      if (mine !== serial) return;
      showError();
      result = 'error';
    }
    pending = false;
    if (fromRetry) {
      if (result === 'ok') focusTarget();
      else {
        const button = main.querySelector('[data-live-action="retry"]');
        if (button) button.focus();
      }
    }
  }

  function wire() {
    main.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-live-action="retry"]') : null;
      if (!button || !main.contains(button) || pending) return;
      button.disabled = true;
      return load(true);
    });
    main.addEventListener('error', (event) => {
      const image = event.target;
      if (!image || !image.getAttribute || image.getAttribute('data-live-image') !== 'true') return;
      image.hidden = true;
      if (image.nextElementSibling) image.nextElementSibling.hidden = false;
    }, true);
    window.addEventListener('pagehide', () => {
      if (pending) interrupted = true;
      ++serial;
      pending = false;
      main.setAttribute('aria-busy', 'false');
      main.querySelectorAll('[data-live-action="retry"]').forEach((button) => { button.disabled = false; });
    });
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted || !interrupted) return;
      interrupted = false;
      load(false);
    });
  }

  wire();
  load(false);
}());
