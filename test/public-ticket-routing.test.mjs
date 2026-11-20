import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = process.cwd();
const helperSource = readFileSync(join(repoRoot, 'assets/js/live-operations.js'), 'utf8');
const siteContentSource = readFileSync(join(repoRoot, 'assets/js/site-content.js'), 'utf8');

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

test('Home fails closed for duplicate Live IDs (the Live list, detail and Ticket cases moved to T43-LIST/DETAIL/TICKET-INIT)', async (t) => {
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
  for (const [label, data] of duplicateCases) {
    await t.test(label, async () => {
      const home = await runSitePage({ pathname: '/', ids: ['home-next-live-events', 'home-next-live-empty'], data });
      const homeHtml = home.elements.get('home-next-live-events').innerHTML;
      assert.doesNotMatch(homeHtml, /href="ticket\/\?liveId=ambiguous-live"/);
      assert.match(homeHtml, /予約情報を確認できません/);
    });
  }
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

  // Home still renders through site-content.js; the four Live/Ticket pages now use their own scripts (Issue #43).
  const indexHtml = readFileSync(join(repoRoot, 'index.html'), 'utf8');
  assert.ok(indexHtml.indexOf('live-operations.js') < indexHtml.indexOf('site-content.js'));
  for (const file of ['live/index.html', 'live/detail/index.html']) {
    const html = readFileSync(join(repoRoot, file), 'utf8');
    assert.ok(html.indexOf('live-operations.js') < html.indexOf('live-pages.js'), file);
    assert.doesNotMatch(html, /site-content\.js/, file);
    assert.doesNotMatch(html, /id="ticket-link-anchor"|class="live-application"/, file);
  }
  const ticketHtml = readFileSync(join(repoRoot, 'ticket/index.html'), 'utf8');
  assert.ok(ticketHtml.indexOf('live-operations.js') < ticketHtml.indexOf('ticket.js'));
  assert.match(ticketHtml, /<form\s+id="ticket-form"/);
  assert.match(ticketHtml, /id="ticket-notice"/);
  const completeHtml = readFileSync(join(repoRoot, 'ticket/complete/index.html'), 'utf8');
  assert.match(completeHtml, /id="ticket-complete-card"/);
  assert.ok(completeHtml.indexOf('live-operations.js') < completeHtml.indexOf('ticket-complete.js'));
});
