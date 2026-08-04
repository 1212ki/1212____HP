import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = process.cwd();
const helperSource = readFileSync(join(repoRoot, 'assets/js/live-operations.js'), 'utf8');
const siteContentSource = readFileSync(join(repoRoot, 'assets/js/site-content.js'), 'utf8');
const ticketSource = readFileSync(join(repoRoot, 'assets/js/ticket.js'), 'utf8');

const futureDate = '2099.08.02';
const pastDate = '2000.01.02';
const externalUrl = 'https://tiget.net/events/510753?from=1212&slot=1';
const externalUrlHtml = externalUrl.replace(/&/g, '&amp;');
const dangerousId = 'internal "&/?=<live>';

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function createElement(id, tagName = 'div') {
  const listeners = new Map();
  const classes = new Set();
  const attributes = new Map();
  let html = '';
  let currentValue = '';
  const element = {
    id,
    tagName: tagName.toUpperCase(),
    style: {},
    dataset: {},
    hidden: false,
    disabled: false,
    required: false,
    checked: false,
    textContent: '',
    options: [],
    selectedIndex: -1,
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        if (force === true || (force === undefined && !classes.has(name))) classes.add(name);
        else classes.delete(name);
        return classes.has(name);
      },
    },
    addEventListener(type, listener) {
      const group = listeners.get(type) || [];
      group.push(listener);
      listeners.set(type, group);
    },
    async dispatch(type, init = {}) {
      const event = {
        type,
        target: element,
        currentTarget: element,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        ...init,
      };
      for (const listener of listeners.get(type) || []) await listener(event);
      return event;
    },
    setAttribute(name, value) {
      const normalized = String(value);
      attributes.set(name, normalized);
      if (name === 'href' || name === 'target' || name === 'rel') element[name] = normalized;
      if (name === 'aria-hidden') element.ariaHidden = normalized;
      if (name === 'placeholder') element.placeholder = normalized;
    },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === 'href' || name === 'target' || name === 'rel' || name === 'src') delete element[name];
    },
    querySelector() { return null; },
    closest() { return null; },
    reset() {},
  };

  Object.defineProperty(element, 'innerHTML', {
    configurable: true,
    get() { return html; },
    set(value) {
      html = String(value);
      if (element.tagName !== 'SELECT') return;
      element.options = [...html.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((match) => {
        const attrs = match[1];
        const valueMatch = attrs.match(/\bvalue="([^"]*)"/i);
        return {
          value: decodeHtml(valueMatch ? valueMatch[1] : ''),
          textContent: decodeHtml(match[2].replace(/<[^>]*>/g, '')),
          disabled: /\bdisabled(?:\s|>|$)/i.test(attrs),
          selected: /\bselected(?:\s|>|$)/i.test(attrs),
        };
      });
      const selectedIndex = element.options.findIndex((option) => option.selected);
      element.selectedIndex = selectedIndex >= 0 ? selectedIndex : (element.options.length ? 0 : -1);
      currentValue = element.selectedIndex >= 0 ? element.options[element.selectedIndex].value : '';
    },
  });
  Object.defineProperty(element, 'value', {
    configurable: true,
    get() { return currentValue; },
    set(value) {
      const normalized = String(value ?? '');
      if (element.tagName !== 'SELECT') {
        currentValue = normalized;
        return;
      }
      const index = element.options.findIndex((option) => option.value === normalized);
      element.selectedIndex = index;
      currentValue = index >= 0 ? normalized : '';
    },
  });
  element.forceValue = (value) => { currentValue = String(value); };
  return element;
}

function createDom(spec = {}) {
  const elements = new Map();
  const tagById = spec.tagById || {};
  for (const id of spec.ids || []) elements.set(id, createElement(id, tagById[id] || 'div'));
  const document = {
    title: '',
    body: createElement('body', 'body'),
    getElementById(id) { return elements.get(id) || null; },
    querySelectorAll() { return []; },
  };
  return { document, elements };
}

function response(json, ok = true) {
  return { ok, async json() { return json; } };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

const siteData = {
  site: { footerText: 'footer' },
  live: {
    upcoming: [
      { id: 'external-live', date: futureDate, venue: 'External Hall', title: 'External', ticketUrl: externalUrl },
      { id: dangerousId, date: '2099.08.03', venue: '<Internal & Hall>', title: 'Internal <Live>', ticketUrl: '', link: 'https://tiget.net/events/legacy' },
      { id: 'legacy-booking', date: '2099.08.04', venue: 'Legacy Hall', title: 'Legacy booking', link: 'https://eplus.jp/sf/detail/123456' },
      { id: 'legacy-social', date: '2099.08.05', venue: 'Social Hall', title: 'Legacy social', link: 'https://instagram.com/1212' },
      { id: 'closed-live', date: '2099.08.06', venue: 'Closed Hall', title: 'Closed', ticketUrl: '', reservationClosed: true },
      { id: 'invalid-live', date: '2099.08.07', venue: 'Invalid Hall', title: 'Invalid', ticketUrl: 'javascript:alert(1)', link: externalUrl },
    ],
    past: [
      { id: 'past-live', date: pastDate, venue: 'Past Hall', title: 'Past', ticketUrl: '' },
    ],
  },
  ticket: {},
};

function runHelper(context) {
  vm.runInNewContext(helperSource, context, { filename: 'assets/js/live-operations.js' });
}

async function runSitePage({ pathname, search = '', ids, data = siteData, helper = true }) {
  const { document, elements } = createDom({ ids });
  const windowListeners = new Map();
  const window = {
    SITE_API_BASE: '',
    location: { pathname, search },
    addEventListener(type, listener) {
      const group = windowListeners.get(type) || [];
      group.push(listener);
      windowListeners.set(type, group);
    },
  };
  const context = {
    console,
    document,
    fetch: async () => response({ data, meta: { updatedAt: 'test-version' } }),
    URL,
    URLSearchParams,
    window,
  };
  context.globalThis = context;
  if (helper) runHelper(context);
  vm.runInNewContext(siteContentSource, context, { filename: 'assets/js/site-content.js' });
  await settle();
  return { context, document, elements };
}

function createFakeFormData(elements, addedFormControls = [], onConstruct = null) {
  return class FakeFormData {
    constructor() {
      const baseControls = ['liveId', 'name', 'email', 'quantity', 'message', 'company']
        .map((id) => ({ name: id, value: elements.get(id)?.value || '' }));
      const enabledAddedControls = addedFormControls
        .filter((control) => control && control.name && !control.disabled);
      const before = enabledAddedControls.filter((control) => control.position === 'before');
      const after = enabledAddedControls.filter((control) => control.position !== 'before');
      this.values = [...before, ...baseControls, ...after]
        .map((control) => [String(control.name), String(control.value ?? '')]);
      if (typeof onConstruct === 'function') onConstruct({ elements });
    }
    entries() { return this.values[Symbol.iterator](); }
    set(name, value) {
      const normalizedName = String(name);
      const normalizedValue = String(value);
      const next = [];
      let replaced = false;
      for (const [entryName, entryValue] of this.values) {
        if (entryName !== normalizedName) {
          next.push([entryName, entryValue]);
        } else if (!replaced) {
          next.push([normalizedName, normalizedValue]);
          replaced = true;
        }
      }
      if (!replaced) next.push([normalizedName, normalizedValue]);
      this.values = next;
    }
  };
}

async function runTicketPage({
  href = 'https://1212hp.com/ticket/',
  draft = null,
  data = siteData,
  helper = true,
  addedFormControls = [],
  onFormDataConstruct = null,
}) {
  const ids = [
    'site-footer', 'ticket-intro', 'ticket-notice', 'ticket-route-message', 'ticket-live-preview',
    'ticket-form', 'liveId', 'name', 'email', 'quantity', 'message', 'company', 'submitBtn', 'ticket-result',
    'ticket-field-quantity', 'ticket-field-message', 'ticket-label-quantity', 'ticket-label-message',
    'ticketConfirmOverlay', 'ticketConfirmModal', 'ticketConfirmError', 'ticketConfirmLead',
    'ticketConfirmTitle', 'ticketConfirmSummary', 'ticketConfirmCloseBtn',
  ];
  const tagById = {
    'ticket-form': 'form', liveId: 'select', name: 'input', email: 'input', quantity: 'input',
    message: 'textarea', company: 'input', submitBtn: 'button',
  };
  const { document, elements } = createDom({ ids, tagById });
  elements.get('quantity').value = '1';
  const storage = draft == null ? new Map() : new Map([['1212hp_ticket_draft_v1', JSON.stringify(draft)]]);
  const fetchCalls = [];
  const location = {
    href,
    assign(value) { location.assigned = value; },
  };
  const window = {
    SITE_API_BASE: '',
    location,
    addEventListener() {},
  };
  const context = {
    console,
    document,
    FormData: createFakeFormData(elements, addedFormControls, onFormDataConstruct),
    localStorage: {
      getItem(key) { return storage.get(key) || ''; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      if (!options.method || options.method === 'GET') return response({ data, meta: { updatedAt: 'test-version' } });
      return response({ reservation: { id: 'reservation-1' } });
    },
    URL,
    URLSearchParams,
    window,
  };
  context.globalThis = context;
  if (helper) runHelper(context);
  vm.runInNewContext(ticketSource, context, { filename: 'assets/js/ticket.js' });
  await settle();
  return { context, document, elements, fetchCalls, storage };
}

test('shared helper route matrix keeps explicit-empty authority and conservative legacy inference', () => {
  const context = { window: {}, URL, Date };
  context.globalThis = context;
  runHelper(context);
  const { getTicketCta } = context.window.LiveOperations;
  const internal = (live) => getTicketCta(live, `/ticket/?liveId=${encodeURIComponent(live.id)}`);

  assert.equal(internal({ id: 'external', date: futureDate, ticketUrl: externalUrl }).url, externalUrl);
  assert.equal(internal({ id: 'empty', date: futureDate, ticketUrl: '', link: externalUrl }).external, false);
  assert.equal(internal({ id: 'legacy', date: futureDate, link: externalUrl }).url, externalUrl);
  assert.equal(internal({ id: 'social', date: futureDate, link: 'https://instagram.com/example' }).external, false);
  assert.equal(internal({ id: 'past', date: pastDate, ticketUrl: '' }).active, false);
  assert.equal(internal({ id: 'closed', date: futureDate, ticketUrl: '', reservationClosed: true }).active, false);
  assert.equal(internal({ id: 'invalid', date: futureDate, ticketUrl: 'javascript:alert(1)' }).reason, 'invalidTicketUrl');
});

test('Home renders the shared external CTA as primary and encodes internal IDs without active closed links', async () => {
  const ids = ['home-next-live-events', 'home-next-live-empty'];
  const external = await runSitePage({ pathname: '/', ids });
  const externalHtml = external.elements.get('home-next-live-events').innerHTML;
  assert.match(externalHtml, new RegExp(`href="${externalUrlHtml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(externalHtml, /class="live-inline-link is-primary"[^>]*target="_blank"[^>]*rel="noopener"/);
  assert.match(externalHtml, />外部サイトで予約</);
  assert.match(externalHtml, />detail</);
  assert.match(externalHtml, />all live</);

  const internalData = structuredClone(siteData);
  internalData.live.upcoming = [siteData.live.upcoming[1]];
  const internal = await runSitePage({ pathname: '/', ids, data: internalData });
  const internalHtml = internal.elements.get('home-next-live-events').innerHTML;
  assert.match(internalHtml, new RegExp(`href="ticket/\\?liveId=${encodeURIComponent(dangerousId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.doesNotMatch(internalHtml, /tiget\.net\/events\/legacy/);
  assert.match(internalHtml, /Internal &lt;Live&gt;/);

  const closedData = structuredClone(siteData);
  closedData.live.upcoming = [siteData.live.upcoming[4]];
  const closed = await runSitePage({ pathname: '/', ids, data: closedData });
  const closedHtml = closed.elements.get('home-next-live-events').innerHTML;
  assert.doesNotMatch(closedHtml, /<a[^>]+(?:ticket\/|tiget\.net)[^>]*>/i);
  assert.match(closedHtml, /予約終了/);

  const unavailable = await runSitePage({ pathname: '/', ids, helper: false });
  const unavailableHtml = unavailable.elements.get('home-next-live-events').innerHTML;
  assert.doesNotMatch(unavailableHtml, /<a[^>]+(?:ticket\/|tiget\.net)[^>]*>/i);
  assert.match(unavailableHtml, /予約情報を確認できません/);
});

test('Live list renders shared reservation and detail actions only for active upcoming Lives', async () => {
  const page = await runSitePage({
    pathname: '/live/',
    ids: ['live-upcoming-events', 'live-past-events', 'live-past-heading', 'live-past-more'],
  });
  const upcoming = page.elements.get('live-upcoming-events').innerHTML;
  const past = page.elements.get('live-past-events').innerHTML;

  assert.match(upcoming, new RegExp(`href="${externalUrlHtml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*target="_blank"[^>]*rel="noopener"`));
  assert.match(upcoming, new RegExp(`href="../ticket/\\?liveId=${encodeURIComponent(dangerousId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(upcoming, /href="https:\/\/eplus\.jp\/sf\/detail\/123456"/);
  assert.match(upcoming, /href="\.\.\/ticket\/\?liveId=legacy-social"/);
  assert.doesNotMatch(upcoming, /href="https:\/\/instagram\.com\/1212"[^>]*>[^<]*(?:予約|ticket)/i);
  assert.match(upcoming, /予約終了/);
  assert.match(upcoming, /予約URLが無効です/);
  assert.match(upcoming, /href="\.\.\/live\/detail\/\?liveId=external-live"/);
  assert.doesNotMatch(past, /<a[^>]+(?:ticket\/|tiget\.net)[^>]*>/i);
  assert.match(past, /href="\.\.\/live\/detail\/\?liveId=past-live"/);
});

test('Live detail replaces stale CTA state and renders external, internal, past, and invalid states safely', async () => {
  const ids = [
    'live-detail', 'live-detail-title', 'live-detail-heading', 'live-detail-image', 'live-detail-placeholder',
    'live-detail-description', 'live-detail-ticket-link', 'live-detail-back-link', 'live-detail-notfound',
    'live-detail-single', 'live-archive', 'live-archive-events', 'live-archive-empty',
  ];
  const external = await runSitePage({ pathname: '/live/detail/', search: '?liveId=external-live', ids });
  const externalCta = external.elements.get('live-detail-ticket-link');
  assert.equal(externalCta.href, externalUrl);
  assert.equal(externalCta.target, '_blank');
  assert.equal(externalCta.rel, 'noopener');
  assert.equal(externalCta.textContent, '外部サイトで予約');
  assert.equal(externalCta.hidden, false);

  const internal = await runSitePage({ pathname: '/live/detail/', search: `?liveId=${encodeURIComponent(dangerousId)}`, ids });
  const internalCta = internal.elements.get('live-detail-ticket-link');
  assert.equal(internalCta.href, `../../ticket/?liveId=${encodeURIComponent(dangerousId)}`);
  assert.equal(internalCta.target || '', '');
  assert.equal(internalCta.rel || '', '');

  for (const id of ['past-live', 'closed-live', 'invalid-live']) {
    const page = await runSitePage({ pathname: '/live/detail/', search: `?liveId=${id}`, ids });
    const cta = page.elements.get('live-detail-ticket-link');
    assert.equal(cta.href || '', '', id);
    assert.equal(cta.hidden, false, id);
    assert.match(cta.textContent, id === 'invalid-live' ? /予約URLが無効/ : /予約終了/, id);
    assert.equal(cta.getAttribute('aria-disabled'), 'true', id);
  }

  const missing = await runSitePage({ pathname: '/live/detail/', search: '?liveId=missing', ids });
  assert.equal(missing.elements.get('live-detail-ticket-link').hidden, true);
  assert.match(missing.elements.get('live-detail-notfound').textContent, /見つかりません/);
});

test('Home, Live list, Live detail, and ticket form all fail closed for duplicate Live IDs', async (t) => {
  const duplicateCases = [
    ['cross-collection', {
      site: { footerText: 'footer' },
      ticket: {},
      live: {
        upcoming: [{ id: 'ambiguous-live', date: '2099.08.01', venue: 'Upcoming Hall', title: 'Upcoming duplicate', ticketUrl: '' }],
        past: [{ id: 'ambiguous-live', date: '2000.08.01', venue: 'Past Hall', title: 'Past duplicate', ticketUrl: '' }],
      },
    }],
    ['same-collection', {
      site: { footerText: 'footer' },
      ticket: {},
      live: {
        upcoming: [
          { id: 'ambiguous-live', date: '2099.08.01', venue: 'First Hall', title: 'First duplicate', ticketUrl: '' },
          { id: 'ambiguous-live', date: '2099.08.02', venue: 'Second Hall', title: 'Second duplicate', ticketUrl: '' },
        ],
        past: [],
      },
    }],
  ];
  const detailIds = [
    'live-detail', 'live-detail-title', 'live-detail-heading', 'live-detail-image', 'live-detail-placeholder',
    'live-detail-description', 'live-detail-ticket-link', 'live-detail-back-link', 'live-detail-notfound',
    'live-detail-single', 'live-archive', 'live-archive-events', 'live-archive-empty',
  ];

  for (const [label, data] of duplicateCases) {
    await t.test(label, async () => {
      const home = await runSitePage({ pathname: '/', ids: ['home-next-live-events', 'home-next-live-empty'], data });
      const homeHtml = home.elements.get('home-next-live-events').innerHTML;
      assert.doesNotMatch(homeHtml, /href="ticket\/\?liveId=ambiguous-live"/);
      assert.match(homeHtml, /予約情報を確認できません/);

      const list = await runSitePage({
        pathname: '/live/',
        ids: ['live-upcoming-events', 'live-past-events', 'live-past-heading', 'live-past-more'],
        data,
      });
      const upcomingHtml = list.elements.get('live-upcoming-events').innerHTML;
      assert.doesNotMatch(upcomingHtml, /href="\.\.\/ticket\/\?liveId=ambiguous-live"/);
      assert.match(upcomingHtml, /予約情報を確認できません/);

      const detail = await runSitePage({
        pathname: '/live/detail/',
        search: '?liveId=ambiguous-live',
        ids: detailIds,
        data,
      });
      assert.match(detail.elements.get('live-detail-notfound').textContent, /一意に特定できません/);
      assert.equal(detail.elements.get('live-detail-ticket-link').hidden, true);
      assert.doesNotMatch(detail.elements.get('live-detail-title').textContent, /duplicate/i);

      const ticket = await runTicketPage({
        href: 'https://1212hp.com/ticket/?liveId=ambiguous-live',
        data,
      });
      assert.deepEqual(ticket.elements.get('liveId').options.map((option) => option.value), ['']);
      assert.equal(ticket.elements.get('submitBtn').disabled, true);
      assert.match(ticket.elements.get('ticket-route-message').innerHTML, /一意に特定できません/);

      ticket.elements.get('liveId').forceValue('ambiguous-live');
      await ticket.elements.get('ticket-form').dispatch('submit');
      assert.equal(ticket.fetchCalls.filter((call) => call.options.method === 'POST').length, 0);
    });
  }
});

test('ticket form lists and falls back only to open internal Lives', async () => {
  const page = await runTicketPage({});
  const select = page.elements.get('liveId');
  const optionValues = select.options.map((option) => option.value);

  assert.deepEqual(optionValues, [dangerousId, 'legacy-social']);
  assert.equal(select.value, dangerousId);
  assert.equal(page.elements.get('submitBtn').disabled, false);
  assert.doesNotMatch(select.innerHTML, /external-live|legacy-booking|closed-live|invalid-live|past-live/);
  assert.match(select.innerHTML, /&lt;Internal &amp; Hall&gt;/);
});

test('ticket form shows the empty state and disables submission when every upcoming Live routes elsewhere', async () => {
  const externalOnlyData = structuredClone(siteData);
  externalOnlyData.live.upcoming = [siteData.live.upcoming[0], siteData.live.upcoming[2], siteData.live.upcoming[4], siteData.live.upcoming[5]];
  const page = await runTicketPage({ data: externalOnlyData });

  assert.equal(page.elements.get('submitBtn').disabled, true);
  assert.deepEqual(page.elements.get('liveId').options.map((option) => option.value), ['']);
  assert.match(page.elements.get('ticket-route-message').innerHTML, /このサイトで予約できるライブはありません/);
});

test('ticket classifies rejected deep-links when zero internal Lives are eligible', async () => {
  const zeroEligibleData = structuredClone(siteData);
  zeroEligibleData.live.upcoming = [
    siteData.live.upcoming[0],
    siteData.live.upcoming[2],
    siteData.live.upcoming[4],
    siteData.live.upcoming[5],
  ];
  const cases = [
    ['external-live', /外部サイトで予約/],
    ['past-live', /終了したライブ/],
    ['closed-live', /予約受付は終了/],
    ['invalid-live', /予約URLが無効/],
    ['unknown-live', /見つかりません/],
  ];

  for (const [liveId, messagePattern] of cases) {
    const page = await runTicketPage({
      href: `https://1212hp.com/ticket/?liveId=${encodeURIComponent(liveId)}`,
      data: zeroEligibleData,
    });
    const routeMessage = page.elements.get('ticket-route-message');

    assert.equal(page.elements.get('liveId').value, '', liveId);
    assert.equal(page.elements.get('submitBtn').disabled, true, liveId);
    assert.match(routeMessage.innerHTML || routeMessage.textContent, messagePattern, liveId);
    assert.equal(page.context.window.location.assigned, undefined, `${liveId} must not auto-redirect`);
    if (liveId === 'external-live') {
      assert.equal(
        routeMessage.innerHTML,
        `このライブの予約は外部サイトで受け付けています。<a class="application-link" href="${externalUrlHtml}" target="_blank" rel="noopener">外部サイトで予約</a>`,
      );
    }
  }
});

test('ticket valid internal query wins over draft while restoring non-routing draft fields', async () => {
  const href = `https://1212hp.com/ticket/?liveId=${encodeURIComponent(dangerousId)}`;
  const page = await runTicketPage({
    href,
    draft: { liveId: 'external-live', name: '<Draft Name>', email: 'draft@example.com', quantity: '3', message: 'memo' },
  });

  assert.equal(page.elements.get('liveId').value, dangerousId);
  assert.equal(page.elements.get('name').value, '<Draft Name>');
  assert.equal(page.elements.get('email').value, 'draft@example.com');
  assert.equal(page.elements.get('quantity').value, '3');
  assert.equal(page.elements.get('message').value, 'memo');
  assert.equal(page.elements.get('submitBtn').disabled, false);
});

test('ticket rejects external, past, closed, invalid, and unknown deep-links without silent fallback', async () => {
  const cases = [
    ['external-live', /外部サイトで予約/, externalUrl],
    ['past-live', /終了したライブ/, null],
    ['closed-live', /予約受付は終了/, null],
    ['invalid-live', /予約URLが無効/, null],
    ['unknown-live', /見つかりません/, null],
  ];

  for (const [liveId, messagePattern, expectedHref] of cases) {
    const page = await runTicketPage({ href: `https://1212hp.com/ticket/?liveId=${encodeURIComponent(liveId)}` });
    const select = page.elements.get('liveId');
    const routeMessage = page.elements.get('ticket-route-message');
    assert.equal(select.value, '', liveId);
    assert.equal(page.elements.get('submitBtn').disabled, true, liveId);
    assert.match(routeMessage.innerHTML || routeMessage.textContent, messagePattern, liveId);
    if (expectedHref) {
      assert.match(routeMessage.innerHTML, new RegExp(`href="${expectedHref.replace(/&/g, '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), liveId);
      assert.match(routeMessage.innerHTML, /target="_blank"[^>]*rel="noopener"/, liveId);
    }

    select.value = dangerousId;
    await select.dispatch('change');
    assert.equal(page.elements.get('submitBtn').disabled, false, `${liveId} explicit recovery`);
  }
});

test('ticket draft never restores excluded Live and a stale/tampered excluded selection cannot submit', async () => {
  const page = await runTicketPage({
    draft: { liveId: 'external-live', name: 'Name', email: 'person@example.com', quantity: '2', message: 'memo' },
  });
  assert.notEqual(page.elements.get('liveId').value, 'external-live');
  assert.equal(page.elements.get('liveId').value, dangerousId);

  page.elements.get('liveId').forceValue('external-live');
  await page.elements.get('ticket-form').dispatch('submit');
  assert.equal(page.fetchCalls.filter((call) => call.options.method === 'POST').length, 0);
  assert.match(page.elements.get('ticket-result').innerHTML, /選択し直してください|予約できません/);
});

test('ticket valid submission preserves the public API endpoint and payload fields', async () => {
  const page = await runTicketPage({ href: `https://1212hp.com/ticket/?liveId=${encodeURIComponent(dangerousId)}` });
  page.elements.get('name').value = 'Reservation Name';
  page.elements.get('email').value = 'person@example.com';
  page.elements.get('quantity').value = '2';
  page.elements.get('message').value = 'accessibility note';

  await page.elements.get('ticket-form').dispatch('submit');
  const posts = page.fetchCalls.filter((call) => call.options.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, '/api/public/ticket-reservations');
  assert.deepEqual(JSON.parse(posts[0].options.body), {
    liveId: dangerousId,
    name: 'Reservation Name',
    email: 'person@example.com',
    quantity: 2,
    message: 'accessibility note',
    company: '',
  });
  assert.match(page.elements.get('ticketConfirmTitle').textContent, /予約しました/);
});

test('ticket trims public text fields once for matching confirmation, JSON, and saved values', async () => {
  const page = await runTicketPage({ href: `https://1212hp.com/ticket/?liveId=${encodeURIComponent(dangerousId)}` });
  page.elements.get('name').value = '  Reservation <Name>  ';
  page.elements.get('email').value = '  person@example.com\t';
  page.elements.get('quantity').value = '2';
  page.elements.get('message').value = '\n accessibility & note  ';

  await page.elements.get('ticket-form').dispatch('submit');

  const posts = page.fetchCalls.filter((call) => call.options.method === 'POST');
  assert.equal(posts.length, 1);
  const payload = JSON.parse(posts[0].options.body);
  assert.deepEqual(payload, {
    liveId: dangerousId,
    name: 'Reservation <Name>',
    email: 'person@example.com',
    quantity: 2,
    message: 'accessibility & note',
    company: '',
  });

  const summary = page.elements.get('ticketConfirmSummary').innerHTML;
  assert.match(summary, /ticket-confirm-v">Reservation &lt;Name&gt;<\/div>/);
  assert.match(summary, /ticket-confirm-v">person@example\.com<\/div>/);
  assert.match(summary, /ticket-confirm-v">accessibility &amp; note<\/div>/);
  assert.doesNotMatch(summary, /  Reservation|example\.com\s|\n accessibility/);
});

test('ticket submission sends the submit-time guarded Live ID despite a duplicate same-name form control', async () => {
  const page = await runTicketPage({
    href: `https://1212hp.com/ticket/?liveId=${encodeURIComponent(dangerousId)}`,
    addedFormControls: [{ name: 'liveId', value: 'external-live' }],
  });
  page.elements.get('name').value = 'Reservation Name';
  page.elements.get('email').value = 'person@example.com';

  assert.equal(page.elements.get('liveId').value, dangerousId);
  await page.elements.get('ticket-form').dispatch('submit');

  const posts = page.fetchCalls.filter((call) => call.options.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(JSON.parse(posts[0].options.body).liveId, dangerousId);
});

test('ticket confirmation and payload share one immutable Live snapshot across reordered controls and canonical control-read mutation', async (t) => {
  for (const position of ['before', 'after']) {
    await t.test(`duplicate control ${position}`, async () => {
      const page = await runTicketPage({
        href: `https://1212hp.com/ticket/?liveId=${encodeURIComponent(dangerousId)}`,
        addedFormControls: [{ name: 'liveId', value: 'external-live', position }],
      });
      let canonicalName = 'Reservation Name';
      Object.defineProperty(page.elements.get('name'), 'value', {
        configurable: true,
        get() {
          page.elements.get('liveId').value = 'legacy-social';
          return canonicalName;
        },
        set(value) { canonicalName = String(value); },
      });
      page.elements.get('email').value = 'person@example.com';

      await page.elements.get('ticket-form').dispatch('submit');

      const posts = page.fetchCalls.filter((call) => call.options.method === 'POST');
      assert.equal(posts.length, 1);
      assert.equal(JSON.parse(posts[0].options.body).liveId, dangerousId);
      assert.equal(page.elements.get('liveId').value, 'legacy-social');
      const summary = page.elements.get('ticketConfirmSummary').innerHTML;
      assert.match(summary, /2099\.08\.03 &lt;Internal &amp; Hall&gt;/);
      assert.doesNotMatch(summary, /2099\.08\.05 Social Hall/);
    });
  }
});

test('ticket confirmation and JSON use only canonical ID controls despite duplicate reordered public fields', async (t) => {
  for (const position of ['before', 'after']) {
    await t.test(`duplicate controls ${position}`, async () => {
      const page = await runTicketPage({
        href: `https://1212hp.com/ticket/?liveId=${encodeURIComponent(dangerousId)}`,
        addedFormControls: [
          { name: 'liveId', value: 'external-live', position },
          { name: 'name', value: 'Injected Name', position },
          { name: 'email', value: 'injected@example.com', position },
          { name: 'quantity', value: 'not-a-number', position },
          { name: 'message', value: 'injected message', position },
          { name: 'company', value: 'injected company', position },
        ],
      });
      page.elements.get('name').value = 'Canonical <Name>';
      page.elements.get('email').value = 'canonical@example.com';
      page.elements.get('quantity').value = '3';
      page.elements.get('message').value = 'front row & aisle';
      page.elements.get('company').value = '';

      await page.elements.get('ticket-form').dispatch('submit');

      const posts = page.fetchCalls.filter((call) => call.options.method === 'POST');
      assert.equal(posts.length, 1);
      assert.deepEqual(JSON.parse(posts[0].options.body), {
        liveId: dangerousId,
        name: 'Canonical <Name>',
        email: 'canonical@example.com',
        quantity: 3,
        message: 'front row & aisle',
        company: '',
      });
      const summary = page.elements.get('ticketConfirmSummary').innerHTML;
      assert.match(summary, /2099\.08\.03 &lt;Internal &amp; Hall&gt;/);
      assert.match(summary, /Canonical &lt;Name&gt;/);
      assert.match(summary, /canonical@example\.com/);
      assert.match(summary, />3</);
      assert.match(summary, /front row &amp; aisle/);
      assert.doesNotMatch(summary, /Injected|injected|not-a-number/);
    });
  }
});

test('ticket rejects invalid canonical quantity before opening confirmation or sending', async (t) => {
  for (const quantity of ['', '0', '11', '1.5', 'not-a-number']) {
    await t.test(quantity, async () => {
      const page = await runTicketPage({
        href: `https://1212hp.com/ticket/?liveId=${encodeURIComponent(dangerousId)}`,
      });
      page.elements.get('name').value = 'Reservation Name';
      page.elements.get('email').value = 'person@example.com';
      page.elements.get('quantity').value = quantity;

      await page.elements.get('ticket-form').dispatch('submit');

      assert.equal(page.fetchCalls.filter((call) => call.options.method === 'POST').length, 0);
      assert.equal(page.elements.get('ticketConfirmOverlay').classList.contains('is-open'), false);
      assert.equal(page.elements.get('ticketConfirmModal').classList.contains('is-open'), false);
      assert.match(page.elements.get('ticket-result').innerHTML, /1.*10.*整数/);
    });
  }
});

test('ticket helper failure is clear and fail-safe', async () => {
  const page = await runTicketPage({ helper: false });
  assert.equal(page.elements.get('submitBtn').disabled, true);
  assert.equal(page.elements.get('liveId').options.length, 0);
  assert.match(page.elements.get('ticket-route-message').innerHTML || page.elements.get('ticket-result').innerHTML, /予約情報を確認できません/);
});

test('public HTML loads the helper in order, removes only global Ticket nav, and retains the ticket form', () => {
  const publicPages = [
    'index.html', 'live/index.html', 'live/detail/index.html', 'ticket/index.html', 'ticket/complete/index.html',
    'profile/index.html', 'youtube/index.html', 'discography/index.html', 'contact/index.html',
  ];
  for (const file of publicPages) {
    const html = readFileSync(join(repoRoot, file), 'utf8');
    const nav = html.match(/<nav\s+id="global-nav">([\s\S]*?)<\/nav>/i)?.[1] || '';
    assert.doesNotMatch(nav, />\s*Ticket\s*</i, file);
    assert.doesNotMatch(nav, /href="[^"]*ticket\/[^"]*"/i, file);
  }

  for (const file of ['index.html', 'live/index.html', 'live/detail/index.html']) {
    const html = readFileSync(join(repoRoot, file), 'utf8');
    assert.ok(html.indexOf('live-operations.js') < html.indexOf('site-content.js'), file);
    assert.notEqual(html.indexOf('live-operations.js'), -1, file);
  }
  const ticketHtml = readFileSync(join(repoRoot, 'ticket/index.html'), 'utf8');
  assert.ok(ticketHtml.indexOf('live-operations.js') < ticketHtml.indexOf('ticket.js'));
  assert.match(ticketHtml, /<form\s+id="ticket-form"/);
  assert.match(ticketHtml, /id="ticket-route-message"/);
  assert.match(readFileSync(join(repoRoot, 'ticket/complete/index.html'), 'utf8'), /id="ticket-complete-card"/);
  const liveHtml = readFileSync(join(repoRoot, 'live/index.html'), 'utf8');
  assert.doesNotMatch(liveHtml, /id="ticket-link-anchor"|class="live-application"/);
});
