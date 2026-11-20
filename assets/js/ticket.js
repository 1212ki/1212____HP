(function () {
  'use strict';

  // Ticket page: choose the Live, fill in the form, send. Sending and failure stay on this
  // page; success moves to ticket/complete/ (see the send section below).
  const DRAFT_KEY = '1212hp_ticket_draft_v1';
  const MAX_LIVE_ID_LENGTH = 128;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const TEXT = {
    loadError: '予約に必要な情報を読み込めませんでした。',
    retry: 'もう一度読み込む',
    unidentified: '予約情報を確認できません。時間をおいて再度お試しください。',
    empty: '現在、このサイトで予約できるライブはありません。',
    toList: 'ライブの一覧へ →',
    choose: 'ライブを選択してください',
    externalLink: '外部サイトで予約',
    loading: '読み込み中',
    nameRequired: 'お名前を入力してください。',
    emailRequired: 'e-mailを入力してください。',
    emailFormat: 'e-mailの形式を確認してください。',
    sending: '送信しています…',
    sendAgain: 'もう一度送信する',
    sendFailed: '予約を送信できませんでした。入力内容は残っています。時間をおいて、もう一度お試しください。',
    duplicate: '同じ内容の予約を、すでに受け付けています。',
  };

  const main = document.getElementById('ticket-content');
  if (!main) return;
  const siteRoot = main.getAttribute('data-site-root') || '../';

  const settings = { showQuantity: true, showMessage: true, labelQuantity: '枚数', labelMessage: '備考', submitLabel: '予約する' };
  const state = { data: null, version: '', eligible: new Set(), submitting: false };
  let serial = 0;
  let pending = false;
  let interrupted = false;

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

  function helpers() {
    const operations = window.LiveOperations;
    const order = window.LiveOrder;
    const cta = window.ReservationCta;
    const ready = operations
      && typeof operations.resolveLiveById === 'function'
      && typeof operations.getTicketCta === 'function'
      && typeof operations.formatLiveDate === 'function'
      && typeof operations.formatLiveDetails === 'function'
      && order && typeof order.sortUpcoming === 'function'
      && cta && typeof cta.resolve === 'function' && typeof cta.reasonSentence === 'function'
      && window.TicketReceipt && typeof window.TicketReceipt.save === 'function' && typeof window.TicketReceipt.clear === 'function';
    return ready ? { operations, order, cta } : null;
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
    if (!data.live || typeof data.live !== 'object' || Array.isArray(data.live) || !Array.isArray(data.live.upcoming)) throw new Error('invalid live data');
    return { data, version: meta.updatedAt ? String(meta.updatedAt) : '' };
  }

  function imageSrc(raw, version) {
    const value = trimmed(raw);
    if (!value) return '';
    const url = /^https?:\/\//.test(value) || value.startsWith('/') || value.startsWith('../') || value.startsWith('./')
      ? value
      : `${siteRoot}${value.replace(/^\/+/, '')}`;
    return version ? `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}` : url;
  }

  function readDraft() {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY) || '';
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function persistDraft() {
    const select = $('liveId');
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
        liveId: state.eligible.has(select.value) ? select.value : '',
        name: $('name').value,
        email: $('email').value,
        quantity: $('quantity').value || '1',
        message: $('message').value,
      }));
    } catch (_error) { /* a blocked storage must not break the form */ }
  }

  // ---- page chrome ------------------------------------------------------------------------
  function setState(value) {
    main.setAttribute('data-state', value);
    main.setAttribute('aria-busy', value === 'loading' ? 'true' : 'false');
  }

  function setNotice(kind, html, role) {
    const notice = $('ticket-notice');
    notice.hidden = false;
    notice.setAttribute('data-kind', kind);
    notice.setAttribute('role', role || 'status');
    notice.innerHTML = html;
  }

  function clearNotice() {
    const notice = $('ticket-notice');
    notice.hidden = true;
    notice.removeAttribute('data-kind');
    notice.setAttribute('role', 'status');
    notice.innerHTML = '';
  }

  const listLink = () => `<a class="site-text-link" href="${siteRoot}live/">${TEXT.toList}</a>`;

  function renderFooter(data) {
    const footer = $('site-footer');
    if (!footer) return;
    const site = data && data.site && typeof data.site === 'object' ? data.site : {};
    footer.textContent = trimmed(site.footerText);
  }

  function applySettings(ticket) {
    const fields = ticket && typeof ticket === 'object' && ticket.fields && typeof ticket.fields === 'object' ? ticket.fields : {};
    settings.showQuantity = fields.showQuantity !== false;
    settings.showMessage = fields.showMessage !== false;
    settings.labelQuantity = trimmed(fields.labelQuantity) || '枚数';
    settings.labelMessage = trimmed(fields.labelMessage) || '備考';
    settings.submitLabel = trimmed(fields.submitLabel) || '予約する';
    $('ticket-field-quantity').hidden = !settings.showQuantity;
    $('ticket-field-message').hidden = !settings.showMessage;
    $('ticket-label-quantity').textContent = settings.labelQuantity;
    $('ticket-label-message').textContent = settings.labelMessage;
    const placeholder = trimmed(fields.placeholderMessage);
    if (placeholder) $('message').setAttribute('placeholder', placeholder);
    $('submitBtn').textContent = settings.submitLabel;
    $('quantity').required = settings.showQuantity;
  }

  // ---- choosing the Live ------------------------------------------------------------------
  function buildOptions(h, data) {
    const upcoming = h.order.sortUpcoming(data.live.upcoming);
    const options = [];
    for (const item of upcoming) {
      const id = trimmed(item && item.id);
      if (!id) continue;
      const cta = h.cta.resolve(data, id, `./?liveId=${encodeURIComponent(id)}`);
      if (cta.kind !== 'internal' || cta.category !== 'upcoming') continue;
      options.push({ id, label: `${h.operations.formatLiveDate(cta.live.date)} ${trimmed(cta.live.venue)}`.trim() || id });
    }
    return options;
  }

  function renderSelect(options, selectedId, withPlaceholder) {
    const items = withPlaceholder ? [{ id: '', label: TEXT.choose, disabled: true }, ...options] : options;
    $('liveId').innerHTML = items
      .map((item) => `<option value="${escapeHtml(item.id)}"${item.id === selectedId ? ' selected' : ''}${item.disabled ? ' disabled' : ''}>${escapeHtml(item.label)}</option>`)
      .join('');
  }

  function renderSummary(h, liveId) {
    const box = $('ticket-live-preview');
    const found = liveId ? h.cta.resolve(state.data, liveId, '') : null;
    const back = $('ticket-back');
    if (!found || !found.live) {
      box.hidden = true;
      $('ticket-summary-body').innerHTML = '';
      back.textContent = '← live';
      back.setAttribute('href', `${siteRoot}live/`);
      return;
    }
    const live = found.live;
    const src = imageSrc(live.image, state.version);
    const title = trimmed(live.title);
    const details = h.operations.formatLiveDetails(live);
    const instagram = h.cta.isInstagramUrl(live.link)
      ? `<a class="site-text-link" href="${escapeHtml(trimmed(live.link))}" target="_blank" rel="noopener noreferrer">Instagram →</a>`
      : '';
    $('ticket-summary-body').setAttribute('data-image', src ? 'yes' : 'no');
    $('ticket-summary-body').innerHTML = (src ? `<figure class="ticket-summary-figure"><img class="ticket-summary-img" data-ticket-image="true" src="${escapeHtml(src)}" alt=""></figure>` : '')
      + `<p class="ticket-summary-date">${escapeHtml(h.operations.formatLiveDate(live.date))}</p>`
      + `<p class="ticket-summary-venue">${escapeHtml(trimmed(live.venue))}</p>`
      + (title ? `<p class="ticket-summary-title">${escapeHtml(title)}</p>` : '')
      + (details ? `<p class="ticket-summary-details">${escapeHtml(details)}</p>` : '')
      + instagram;
    box.hidden = false;
    back.textContent = '← ライブの詳細';
    back.setAttribute('href', `${siteRoot}live/detail/?liveId=${encodeURIComponent(trimmed(live.id))}`);
  }

  function showSelected(h, liveId) {
    $('ticket-fields').hidden = false;
    renderSummary(h, liveId);
  }

  function showNoSelection(h) {
    $('ticket-fields').hidden = true;
    renderSummary(h, '');
  }

  function invalidSpecifiedId(raw) {
    const id = trimmed(raw);
    return !id || id.length > MAX_LIVE_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(id);
  }

  function describeSpecified(h, raw) {
    if (invalidSpecifiedId(raw)) return { type: 'unidentified' };
    const id = trimmed(raw);
    const cta = h.cta.resolve(state.data, id, `./?liveId=${encodeURIComponent(id)}`);
    if (cta.kind === 'ambiguous' || cta.kind === 'helper') return { type: 'unidentified' };
    if (cta.kind === 'external') return { type: 'external', cta };
    if (cta.kind === 'internal') return { type: 'internal', id };
    return { type: 'unavailable', cta };
  }

  function applyData(h, payload, draft) {
    state.data = payload.data;
    state.version = payload.version;
    renderFooter(payload.data);
    applySettings(payload.data.ticket);
    const options = buildOptions(h, payload.data);
    state.eligible = new Set(options.map((option) => option.id));
    const params = new URLSearchParams(String(window.location && window.location.search ? window.location.search : ''));
    const specified = params.has('liveId');
    $('ticket-loading').innerHTML = '';
    clearNotice();

    let notice = null;
    let selected = '';
    if (specified) {
      const result = describeSpecified(h, params.get('liveId'));
      if (result.type === 'unidentified') {
        setNotice('unidentified', `<p>${TEXT.unidentified}</p>${listLink()}`);
        $('ticket-layout').hidden = true;
        $('liveId').innerHTML = '';
        renderSummary(h, '');
        setState('ready');
        return;
      }
      if (result.type === 'internal' && state.eligible.has(result.id)) selected = result.id;
      else if (result.type === 'external') notice = { kind: 'external', html: `<p>${h.cta.reasonSentence('external')}</p><a class="site-button site-button--primary" href="${escapeHtml(result.cta.url)}" target="_blank" rel="noopener noreferrer">${TEXT.externalLink}</a>` };
      else notice = { kind: 'unavailable', html: `<p>${escapeHtml(h.cta.reasonSentence(result.cta || 'unknown'))}</p>` };
    } else if (options.length === 0) {
      setNotice('empty', `<p>${TEXT.empty}</p>${listLink()}`);
      $('ticket-layout').hidden = true;
      $('liveId').innerHTML = '';
      renderSummary(h, '');
      setState('ready');
      return;
    } else {
      const drafted = draft && state.eligible.has(trimmed(draft.liveId)) ? trimmed(draft.liveId) : '';
      selected = drafted || options[0].id;
    }

    if (notice) {
      setNotice(notice.kind, notice.html);
      if (options.length === 0) {
        $('ticket-notice').innerHTML += listLink();
        $('ticket-layout').hidden = true;
        $('liveId').innerHTML = '';
        renderSummary(h, '');
        setState('ready');
        return;
      }
    }
    $('ticket-layout').hidden = false;
    renderSelect(options, selected, !selected);
    if (selected) showSelected(h, selected);
    else showNoSelection(h);
    restoreDraft(draft);
    setState('ready');
  }

  function restoreDraft(draft) {
    if (!draft) return;
    if (draft.name) $('name').value = String(draft.name);
    if (draft.email) $('email').value = String(draft.email);
    if (draft.quantity) $('quantity').value = String(draft.quantity);
    if (draft.message) $('message').value = String(draft.message);
  }

  // ---- validation -------------------------------------------------------------------------
  function showFieldError(field, message) {
    const control = $(field);
    const error = $(`ticket-error-${field}`);
    error.textContent = message;
    error.hidden = false;
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', `ticket-error-${field}`);
  }

  function clearFieldError(field) {
    const control = $(field);
    const error = $(`ticket-error-${field}`);
    if (!error) return;
    error.textContent = '';
    error.hidden = true;
    control.removeAttribute('aria-invalid');
    control.removeAttribute('aria-describedby');
  }

  function validate() {
    const problems = [];
    if (!trimmed($('name').value)) problems.push(['name', TEXT.nameRequired]);
    const email = trimmed($('email').value);
    if (!email) problems.push(['email', TEXT.emailRequired]);
    else if (email.length < 5 || email.length > 254 || !EMAIL_PATTERN.test(email)) problems.push(['email', TEXT.emailFormat]);
    if (settings.showQuantity) {
      const raw = trimmed($('quantity').value);
      const quantity = Number(raw);
      if (raw === '' || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        problems.push(['quantity', `${settings.labelQuantity}は1〜10で入力してください。`]);
      }
    }
    return problems;
  }

  function runValidation() {
    ['name', 'email', 'quantity'].forEach(clearFieldError);
    const problems = validate();
    problems.forEach(([field, message]) => showFieldError(field, message));
    if (problems.length) $(problems[0][0]).focus();
    return problems.length === 0;
  }

  // ---- send -------------------------------------------------------------------------------
  const DUPLICATE_ERROR = 'reservation already submitted recently';

  function receipts() {
    return window.TicketReceipt && typeof window.TicketReceipt.save === 'function' ? window.TicketReceipt : null;
  }

  function setSending(on) {
    const button = $('submitBtn');
    state.submitting = on;
    if (on) {
      button.disabled = true;
      button.textContent = TEXT.sending;
      $('ticket-status').textContent = TEXT.sending;
    } else {
      button.disabled = false;
      $('ticket-status').textContent = '';
    }
  }

  function showSendNotice(kind, message) {
    setNotice(kind, `<p>${message}</p>`, 'alert');
    const notice = $('ticket-notice');
    if (typeof notice.scrollIntoView === 'function') notice.scrollIntoView({ block: 'nearest' });
  }

  function buildSnapshot(h, liveId) {
    const found = h.cta.resolve(state.data, liveId, '');
    const live = found.live || {};
    return Object.freeze({
      id: liveId,
      date: trimmed(live.date),
      venue: trimmed(live.venue),
      title: trimmed(live.title),
      image: trimmed(live.image),
      label: `${h.operations.formatLiveDate(live.date)} ${trimmed(live.venue)}`.trim() || liveId,
    });
  }

  function buildPayload(liveId) {
    return Object.freeze({
      liveId,
      name: trimmed($('name').value),
      email: trimmed($('email').value),
      quantity: settings.showQuantity ? Number(trimmed($('quantity').value)) : 1,
      message: settings.showMessage ? trimmed($('message').value) : '',
      company: String($('company').value || ''),
    });
  }

  async function postReservation(payload) {
    const base = String(window.SITE_API_BASE || '').replace(/\/+$/, '');
    const endpoint = base ? `${base}/api/public/ticket-reservations` : '/api/public/ticket-reservations';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let body = null;
    let readable = true;
    try { body = await response.json(); } catch (_error) { readable = false; }
    if (!response.ok) {
      if (readable && body && typeof body === 'object' && body.error === DUPLICATE_ERROR) return { outcome: 'duplicate' };
      return { outcome: 'failed' };
    }
    const reservation = readable && body && typeof body === 'object' ? body.reservation : null;
    if (!reservation || typeof reservation !== 'object' || !trimmed(reservation.id)) return { outcome: 'failed' };
    return { outcome: 'created', reservation };
  }

  function acceptedValue(accepted, fallback) {
    return typeof accepted === 'string' && accepted !== '' ? accepted : fallback;
  }

  function finishSuccess(payload, snapshot, reservation) {
    const liveId = acceptedValue(reservation.liveId, payload.liveId);
    const rid = trimmed(reservation.id);
    const store = receipts();
    if (store) {
      store.save({
        rid,
        liveId,
        live: { date: acceptedValue(reservation.liveDate, snapshot.date), venue: acceptedValue(reservation.liveVenue, snapshot.venue), title: snapshot.title, image: snapshot.image },
        name: acceptedValue(reservation.name, payload.name),
        email: acceptedValue(reservation.email, payload.email),
        quantity: Number.isInteger(reservation.quantity) ? reservation.quantity : payload.quantity,
        message: typeof reservation.message === 'string' ? reservation.message : payload.message,
        ui: {
          completeText: trimmed(state.data && state.data.ticket && state.data.ticket.completeText),
          labelQuantity: settings.labelQuantity,
          labelMessage: settings.labelMessage,
          showQuantity: settings.showQuantity,
          showMessage: settings.showMessage,
        },
      });
    }
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (_error) { /* nothing to remove */ }
    window.location.replace(`./complete/?liveId=${encodeURIComponent(liveId)}&rid=${encodeURIComponent(rid)}`);
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (state.submitting) return;
    const liveId = $('liveId').value;
    if (!runValidation()) return;
    const h = helpers();
    const found = h && state.eligible.has(liveId) ? h.cta.resolve(state.data, liveId, '') : null;
    if (!h || !found || found.kind !== 'internal') {
      setNotice('unavailable', `<p>${escapeHtml(h ? h.cta.reasonSentence(found && found.kind !== 'internal' ? found : 'unknown') || h.cta.reasonSentence('unknown') : TEXT.unidentified)}</p>`);
      $('ticket-fields').hidden = true;
      return;
    }
    const snapshot = buildSnapshot(h, liveId);
    const payload = buildPayload(liveId);
    const store = receipts();
    if (store) store.clear();
    clearNotice();
    setSending(true);
    const dryRun = new URLSearchParams(String(window.location.search || '')).get('dryRun') === '1';
    let result;
    try {
      result = dryRun
        ? { outcome: 'created', reservation: { id: `dry-run-${Date.now()}`, liveId: payload.liveId, liveDate: snapshot.date, liveVenue: snapshot.venue, name: payload.name, email: payload.email, quantity: payload.quantity, message: payload.message } }
        : await postReservation(payload);
    } catch (_error) {
      result = { outcome: 'failed' };
    }
    if (result.outcome === 'created') {
      finishSuccess(payload, snapshot, result.reservation);
      return;
    }
    setSending(false);
    if (result.outcome === 'duplicate') {
      $('submitBtn').textContent = settings.submitLabel;
      showSendNotice('duplicate', TEXT.duplicate);
      return;
    }
    $('submitBtn').textContent = TEXT.sendAgain;
    showSendNotice('failed', TEXT.sendFailed);
  }

  // ---- loading ----------------------------------------------------------------------------
  function showLoading() {
    setState('loading');
    clearNotice();
    $('ticket-layout').hidden = true;
    $('ticket-loading').innerHTML = `<div class="live-skeleton" role="status">${TEXT.loading}</div>`;
  }

  function showLoadError() {
    $('ticket-loading').innerHTML = '';
    $('ticket-layout').hidden = true;
    setNotice('load-error', `<p>${TEXT.loadError}</p><button type="button" class="site-button site-button--secondary" data-testid="ticket-retry" data-ticket-action="retry">${TEXT.retry}</button>`, 'alert');
    setState('error');
  }

  function showUnidentified() {
    $('ticket-loading').innerHTML = '';
    $('ticket-layout').hidden = true;
    $('liveId').innerHTML = '';
    setNotice('unidentified', `<p>${TEXT.unidentified}</p>${listLink()}`);
    setState('ready');
  }

  async function load(fromRetry) {
    if (pending) return;
    pending = true;
    const mine = ++serial;
    showLoading();
    const h = helpers();
    if (!h) {
      showUnidentified();
      pending = false;
      return;
    }
    const draft = readDraft();
    let outcome = 'ok';
    try {
      const payload = await fetchSiteData();
      if (mine !== serial) return;
      applyData(h, payload, draft);
    } catch (_error) {
      if (mine !== serial) return;
      showLoadError();
      outcome = 'error';
    }
    pending = false;
    if (fromRetry) {
      if (outcome === 'ok') {
        const heading = main.querySelector('h1');
        if (heading) heading.focus();
      } else {
        const button = main.querySelector('[data-ticket-action="retry"]');
        if (button) button.focus();
      }
    }
  }

  function wire() {
    const select = $('liveId');
    const form = $('ticket-form');
    select.addEventListener('change', () => {
      const h = helpers();
      const id = select.value;
      persistDraft();
      if (h && state.eligible.has(id)) {
        clearNotice();
        showSelected(h, id);
      } else if (h) {
        showNoSelection(h);
      }
    });
    ['name', 'email', 'quantity', 'message'].forEach((id) => {
      const control = $(id);
      control.addEventListener('input', () => { clearFieldError(id); persistDraft(); });
      control.addEventListener('change', persistDraft);
    });
    form.addEventListener('submit', onSubmit);
    main.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-ticket-action="retry"]') : null;
      if (!button || !main.contains(button) || pending) return;
      button.disabled = true;
      return load(true);
    });
    main.addEventListener('error', (event) => {
      const image = event.target;
      if (!image || !image.getAttribute || image.getAttribute('data-ticket-image') !== 'true') return;
      const figure = image.closest ? image.closest('.ticket-summary-figure') : null;
      if (figure) figure.hidden = true;
      $('ticket-summary-body').setAttribute('data-image', 'no');
    }, true);
    window.addEventListener('pagehide', () => {
      if (pending) interrupted = true;
      ++serial;
      pending = false;
      main.setAttribute('aria-busy', 'false');
      main.querySelectorAll('[data-ticket-action="retry"]').forEach((button) => { button.disabled = false; });
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
