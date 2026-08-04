import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = process.cwd();
const adminHtml = readFileSync(join(repoRoot, 'admin/index.html'), 'utf8');
const adminJs = readFileSync(join(repoRoot, 'admin/app.js'), 'utf8');
const require = createRequire(import.meta.url);
const LiveOperations = require(join(repoRoot, 'assets/js/live-operations.js'));

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function createElement(id, ownerDocument = null, tagName = 'div') {
  const listeners = new Map();
  const classes = new Set();
  let html = '';
  const element = {
    id,
    tagName: tagName.toUpperCase(),
    children: [],
    dataset: {},
    value: '',
    checked: false,
    disabled: false,
    textContent: '',
    parentElement: null,
    style: {},
    isConnected: true,
    focusCount: 0,
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      contains(name) { return classes.has(name); },
    },
    addEventListener(type, listener) {
      const group = listeners.get(type) || [];
      group.push(listener);
      listeners.set(type, group);
    },
    appendChild(child) {
      child.parentElement = this;
      child.isConnected = true;
      this.children.push(child);
    },
    removeChild(child) {
      this.children = this.children.filter((candidate) => candidate !== child);
      child.parentElement = null;
      child.isConnected = false;
    },
    remove() {
      this.parentElement?.removeChild?.(this);
    },
    click() {},
    focus() {
      this.focusCount += 1;
      if (ownerDocument) ownerDocument.activeElement = this;
    },
    select() {},
    querySelector() { return null; },
    closest() { return null; },
    async dispatch(type, event = {}) {
      let result;
      for (const listener of listeners.get(type) || []) {
        result = await listener({ preventDefault() {}, target: this, ...event });
      }
      return result;
    },
  };
  Object.defineProperty(element, 'innerHTML', {
    configurable: true,
    get() { return html; },
    set(value) { html = String(value); },
  });
  return element;
}

function createDomHarness() {
  const elements = new Map();
  const documentListeners = new Map();
  const modalOwnedIds = new Set();
  const modalOrder = [];
  const createdAnchors = [];
  const objectUrls = [];
  const revokedObjectUrls = [];
  let objectUrlSequence = 0;
  let anchorClickError = null;

  const document = {
    activeElement: null,
    body: null,
    addEventListener(type, listener) {
      const group = documentListeners.get(type) || [];
      group.push(listener);
      documentListeners.set(type, group);
    },
    createElement(tag) {
      const element = createElement('', document, tag);
      if (tag.toLowerCase() === 'a') {
        element.click = () => {
          if (anchorClickError) throw anchorClickError;
          element.clicked = true;
        };
        createdAnchors.push(element);
      }
      return element;
    },
    execCommand: () => true,
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelectorAll(selector) {
      if (selector !== '[data-live-edit]') return [];
      return ['live-upcoming-list', 'live-past-list']
        .flatMap((id) => elements.get(id)?.children || [])
        .filter((element) => element.dataset?.liveEdit !== undefined);
    },
    contains(element) { return Boolean(element?.isConnected); },
  };
  document.body = createElement('body', document, 'body');

  function addStatic(id, tagName = 'div') {
    const element = createElement(id, document, tagName);
    elements.set(id, element);
    return element;
  }

  function installSelectHtmlBehavior(select) {
    let html = '';
    Object.defineProperty(select, 'innerHTML', {
      configurable: true,
      get() { return html; },
      set(value) {
        html = String(value);
        select.optionValues = [...html.matchAll(/<option\b[^>]*value="([^"]*)"[^>]*>/gi)]
          .map((match) => decodeHtml(match[1]));
        const selected = html.match(/<option\b[^>]*value="([^"]*)"[^>]*selected[^>]*>/i)?.[1];
        select.value = selected === undefined ? (select.optionValues[0] || '') : decodeHtml(selected);
      },
    });
  }

  function installLiveListHtmlBehavior(list) {
    let html = '';
    Object.defineProperty(list, 'innerHTML', {
      configurable: true,
      get() { return html; },
      set(value) {
        for (const child of list.children) child.isConnected = false;
        list.children = [];
        html = String(value);
        for (const match of html.matchAll(/<button\b([^>]*)>/gi)) {
          const attrs = match[1];
          const liveId = attrs.match(/\bdata-live-id="([^"]*)"/i)?.[1];
          const category = attrs.match(/\bdata-live-category="([^"]*)"/i)?.[1];
          if (liveId === undefined || category === undefined) continue;
          const trigger = createElement(`live-edit-${decodeHtml(liveId)}`, document, 'button');
          trigger.dataset.liveEdit = '';
          trigger.dataset.liveId = decodeHtml(liveId);
          trigger.dataset.liveCategory = decodeHtml(category);
          trigger.closest = (selector) => selector === '[data-live-edit]' ? trigger : null;
          list.appendChild(trigger);
        }
      },
    });
  }

  const modalBody = addStatic('modal-body');
  Object.defineProperty(modalBody, 'innerHTML', {
    configurable: true,
    get() { return modalBody._html || ''; },
    set(value) {
      for (const id of modalOwnedIds) {
        const prior = elements.get(id);
        if (prior) prior.isConnected = false;
        elements.delete(id);
      }
      modalOwnedIds.clear();
      modalOrder.length = 0;
      modalBody._html = String(value);

      const openingTag = /<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi;
      for (const match of modalBody._html.matchAll(openingTag)) {
        const [, tagName, attrs, id] = match;
        const element = createElement(id, document, tagName);
        element.parentElement = modalBody;
        element.disabled = /\bdisabled(?:\s|>|$)/i.test(attrs);
        element.checked = /\bchecked(?:\s|>|$)/i.test(attrs);
        const valueAttr = attrs.match(/\bvalue="([^"]*)"/i);
        if (valueAttr) element.value = decodeHtml(valueAttr[1]);
        for (const dataAttr of attrs.matchAll(/\bdata-([\w-]+)="([^"]*)"/gi)) {
          const key = dataAttr[1].replace(/-([a-z])/g, (_whole, letter) => letter.toUpperCase());
          element.dataset[key] = decodeHtml(dataAttr[2]);
        }
        if (tagName.toLowerCase() === 'textarea') {
          const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const body = modalBody._html.match(new RegExp(`<textarea\\b[^>]*id="${escapedId}"[^>]*>([\\s\\S]*?)<\\/textarea>`, 'i'))?.[1];
          element.value = decodeHtml(body || '');
        }
        if (tagName.toLowerCase() === 'select') installSelectHtmlBehavior(element);
        elements.set(id, element);
        modalOwnedIds.add(id);
        modalOrder.push(element);
      }
    },
  });
  modalBody.querySelector = () => modalOrder.find((element) => {
    if (element.disabled) return false;
    if (element.tagName === 'INPUT' && element.type === 'hidden') return false;
    return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName);
  }) || null;

  addStatic('modal-title');
  addStatic('modal-overlay');
  addStatic('modal');
  addStatic('delete-btn', 'button');
  addStatic('toast');
  addStatic('saveBtn', 'button');
  addStatic('tickets-list');
  const liveFilter = addStatic('tickets-live-filter', 'select');
  installSelectHtmlBehavior(liveFilter);
  const statusFilter = addStatic('tickets-status-filter', 'select');
  statusFilter.value = 'pending';
  const upcomingList = addStatic('live-upcoming-list');
  installLiveListHtmlBehavior(upcomingList);
  const pastList = addStatic('live-past-list');
  installLiveListHtmlBehavior(pastList);

  class TestURL extends URL {}
  TestURL.createObjectURL = (blob) => {
    const url = `blob:admin-test-${++objectUrlSequence}`;
    objectUrls.push({ blob, url });
    return url;
  };
  TestURL.revokeObjectURL = (url) => revokedObjectUrls.push(url);

  return {
    TestURL,
    createdAnchors,
    document,
    elements,
    objectUrls,
    revokedObjectUrls,
    async dispatchDocument(type, event = {}) {
      for (const listener of documentListeners.get(type) || []) {
        await listener(event);
      }
    },
    setAnchorClickError(error) { anchorClickError = error; },
  };
}

function loadAdminApp(options = {}) {
  const dom = createDomHarness();
  const { document, elements } = dom;
  const fetchCalls = [];
  const networkFetchCalls = [];
  const clipboardWrites = [];
  const openedUrls = [];
  let saveCalls = 0;

  const context = {
    Blob,
    FormData,
    Headers,
    URL: dom.TestURL,
    URLSearchParams,
    clearTimeout,
    confirm: () => false,
    console,
    document,
    fetch: async (url, fetchOptions = {}) => {
      networkFetchCalls.push({ url, options: fetchOptions });
      return options.networkFetch
        ? options.networkFetch(url, fetchOptions)
        : { ok: true, status: 200, json: async () => ({}) };
    },
    FileReader: class {},
    location: { hostname: 'localhost' },
    localStorage: { getItem: () => '', removeItem() {}, setItem() {} },
    navigator: { clipboard: { async writeText(value) { clipboardWrites.push(value); } } },
    prompt: () => '',
    setTimeout,
    structuredClone,
    window: {
      ADMIN_CONFIG: options.adminConfig || {},
      ADMIN_BUILD_ID: '',
      LiveOperations: options.liveOperations || LiveOperations,
      addEventListener() {},
      location: { href: 'https://1212hp.com/admin/', origin: 'https://1212hp.com' },
      open(url) { openedUrls.push(url); return null; },
      prompt: () => '',
    },
  };
  context.globalThis = context;

  vm.runInNewContext(`${adminJs}
globalThis.__adminLiveTest = {
  addLive,
  editLive,
  handleLiveSourceParse,
  saveLiveItem,
  updateXPreviewsInModal,
  buildXIntentUrlFromModal,
  copyXReplyFromModal,
  loadLiveReservations,
  submitManualReservation,
  calculateActiveReservationTotals,
  renderTicketRow,
  markTicketStatus,
  downloadTicketsCsv,
  renderLiveReservationLedger,
  loadTickets,
  renderTicketsUi,
  renderLive,
  saveData,
  saveModal,
  deleteItem,
  closeModal,
  ensureNoActiveImageUploads,
  handleTicketStatusAction: typeof handleTicketStatusAction === 'function' ? handleTicketStatusAction : null,
  setApiMode(value) { IS_API_MODE = value; },
  setSiteData(value) { siteData = value; },
  getSiteData() { return siteData; },
  getModalState() { return { currentEditId, currentEditType, isNewItem }; },
  setAdminFetch(fn) { adminFetch = async (...args) => { const result = await fn(...args); return result; }; },
  setSaveSpy() { saveData = async () => { saveCalls += 1; return true; }; },
  setConfirm(fn) { confirm = fn; },
};`, context);

  return {
    ...context.__adminLiveTest,
    ...dom,
    clipboardWrites,
    fetchCalls,
    networkFetchCalls,
    openedUrls,
    getSaveCalls: () => saveCalls,
    useAdminFetch(fn) {
      context.__adminLiveTest.setAdminFetch(async (path, options = {}, policy = {}) => {
        fetchCalls.push({ path, options, policy });
        return fn(path, options, policy);
      });
    },
  };
}

function setLiveForm(elements, values = {}) {
  const defaults = {
    'edit-date': '2026.08.10',
    'edit-title': 'Night Shift',
    'edit-venue': '柴崎mod',
    'edit-description': 'OPEN 18:30 / START 19:00',
    'edit-image': 'assets/images/live.jpg',
    'edit-link': 'https://instagram.com/night-shift',
    'edit-sourceText': 'raw booking copy',
    'edit-ticketUrl': '',
    'edit-xComment': 'ぜひ来てください',
  };
  Object.entries({ ...defaults, ...values }).forEach(([id, value]) => {
    const element = elements.get(id) || createElement(id);
    element.value = value;
    elements.set(id, element);
  });
  const past = elements.get('edit-isPast') || createElement('edit-isPast');
  past.checked = Boolean(values.isPast);
  elements.set('edit-isPast', past);
  const closed = elements.get('edit-reservationClosed') || createElement('edit-reservationClosed');
  closed.checked = Boolean(values.reservationClosed);
  elements.set('edit-reservationClosed', closed);
}

const LIVE_SOURCE_INTAKE_FIELD_IDS = [
  'edit-date',
  'edit-title',
  'edit-venue',
  'edit-description',
  'edit-ticketUrl',
  'edit-link',
  'edit-sourceText',
];

function snapshotLiveSourceIntake(elements) {
  return Object.fromEntries(LIVE_SOURCE_INTAKE_FIELD_IDS.map((id) => [id, elements.get(id)?.value]));
}

function assertLiveSourceIntakeUnchanged(elements, snapshot) {
  assert.deepEqual(snapshotLiveSourceIntake(elements), snapshot);
}

function validLiveSourceIntakeDraft(overrides = {}) {
  return {
    date: '2026.08.20',
    title: 'AI title',
    venue: 'AI venue',
    description: 'OPEN 18:30 / START 19:00',
    ticketUrl: 'https://tickets.example/live/1',
    link: 'https://example.com/live/1',
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function jsonResponse(payload, options = {}) {
  const { ok = true, status = ok ? 200 : 400 } = options;
  return {
    ok,
    status,
    async json() { return payload; },
  };
}

async function flushAsync() {
  await new Promise((resolve) => setImmediate(resolve));
}

test('Live is the initial primary tab and Tickets remains only as secondary Live operations', () => {
  const primaryNav = adminHtml.match(/<nav class="tab-nav">([\s\S]*?)<\/nav>/)?.[1] || '';
  assert.match(primaryNav, /class="tab-btn active" data-tab="live"/);
  assert.doesNotMatch(primaryNav, /data-tab="tickets"/);
  assert.match(adminHtml, /id="live-tab"[^>]*class="tab-content active"|class="tab-content active"[^>]*id="live-tab"/);
  assert.match(adminHtml, /<details[^>]*class="live-secondary"[\s\S]*Ticket Page（表示文言）/);
  assert.match(adminHtml, /<details[^>]*class="live-secondary"[\s\S]*予約一覧（全Live）/);
  assert.match(adminHtml, /id="tickets-list"/);
  assert.match(adminHtml, /id="ticket-intro-text"/);
  assert.match(adminHtml, /downloadTicketsCsv\(\)/);
});

test('shared LiveOperations script is loaded before the admin application', () => {
  const sharedIndex = adminHtml.indexOf('../assets/js/live-operations.js');
  const appIndex = adminHtml.indexOf('app.js');
  assert.ok(sharedIndex >= 0);
  assert.ok(sharedIndex < appIndex);
});

test('AIで整理 source intake posts the exact source once, replaces non-empty fields, and never parses or saves', async () => {
  let parserCalls = 0;
  const app = loadAdminApp({
    liveOperations: {
      ...LiveOperations,
      parseLiveSourceText() {
        parserCalls += 1;
        throw new Error('legacy parser must not run');
      },
    },
  });
  const initial = {
    live: { upcoming: [{ id: 'stored', untouched: true }], past: [] },
  };
  app.setSiteData(structuredClone(initial));
  app.setSaveSpy();
  app.addLive();
  app.setApiMode(true);
  const sourceText = '  2026/8/20\nAIで整理する元情報  \n';
  setLiveForm(app.elements, {
    'edit-sourceText': sourceText,
    'edit-date': 'manual date',
    'edit-title': 'manual title',
    'edit-venue': 'manual venue stays',
    'edit-description': 'manual description',
    'edit-ticketUrl': 'https://old.example/ticket',
    'edit-link': 'https://old.example/detail',
  });
  app.elements.get('x-parent-preview').value = 'PARENT BEFORE';
  app.elements.get('x-reply-preview').value = 'REPLY BEFORE';
  app.useAdminFetch(async () => jsonResponse({
    draft: validLiveSourceIntakeDraft({
      date: ' 2026.08.20 ',
      title: ' AI replacement ',
      venue: '   ',
      description: ' AI description ',
      ticketUrl: ' https://tickets.example/live/2 ',
      link: ' https://example.com/detail/2 ',
    }),
  }));

  const editorHtml = app.elements.get('modal-body').innerHTML;
  assert.match(editorHtml, /id="live-source-parse-btn"[^>]*>AIで整理<\/button>/);
  await app.elements.get('live-source-parse-btn').dispatch('click');

  assert.equal(app.fetchCalls.length, 1);
  assert.equal(app.fetchCalls[0].path, '/api/admin/live-source-intake');
  assert.equal(app.fetchCalls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(app.fetchCalls[0].options.body), { sourceText });
  assert.deepEqual({ ...app.fetchCalls[0].policy }, { allowBaseFallback: false });
  assert.equal(parserCalls, 0);
  assert.equal(app.elements.get('edit-date').value, '2026.08.20');
  assert.equal(app.elements.get('edit-title').value, 'AI replacement');
  assert.equal(app.elements.get('edit-venue').value, 'manual venue stays');
  assert.equal(app.elements.get('edit-description').value, 'AI description');
  assert.equal(app.elements.get('edit-ticketUrl').value, 'https://tickets.example/live/2');
  assert.equal(app.elements.get('edit-link').value, 'https://example.com/detail/2');
  assert.equal(app.elements.get('edit-sourceText').value, sourceText);
  assert.notEqual(app.elements.get('x-parent-preview').value, 'PARENT BEFORE');
  assert.match(app.elements.get('x-reply-preview').value, /AI replacement/);
  assert.match(app.elements.get('live-source-warnings').textContent, /整理しました/);
  assert.deepEqual(app.getSiteData(), initial);
  assert.equal(app.getSaveCalls(), 0);
});

test('AIで整理 source intake disables while pending, blocks duplicate submission, and always restores the button', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'pending intake' });
  const response = deferred();
  app.useAdminFetch(() => response.promise);
  const button = app.elements.get('live-source-parse-btn');

  const first = button.dispatch('click');
  await flushAsync();
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'AIで整理中...');

  const second = button.dispatch('click');
  await flushAsync();
  assert.equal(app.fetchCalls.length, 1);

  response.resolve(jsonResponse({ draft: validLiveSourceIntakeDraft() }));
  await Promise.all([first, second]);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'AIで整理');
});

test('AIで整理 source intake discards a stale response when source text changes while pending', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'source at request start' });
  app.setSaveSpy();
  app.elements.get('x-parent-preview').value = 'PARENT BEFORE';
  app.elements.get('x-reply-preview').value = 'REPLY BEFORE';
  const response = deferred();
  app.useAdminFetch(() => response.promise);

  const pending = app.handleLiveSourceParse();
  await flushAsync();
  app.elements.get('edit-sourceText').value = 'latest human source edit';
  const latestSnapshot = snapshotLiveSourceIntake(app.elements);
  response.resolve(jsonResponse({ draft: validLiveSourceIntakeDraft() }));

  const result = await pending;

  assert.equal(result, false);
  assertLiveSourceIntakeUnchanged(app.elements, latestSnapshot);
  assert.equal(app.elements.get('x-parent-preview').value, 'PARENT BEFORE');
  assert.equal(app.elements.get('x-reply-preview').value, 'REPLY BEFORE');
  assert.match(app.elements.get('live-source-warnings').textContent, /入力が変更されたため反映しませんでした/);
  assert.match(app.elements.get('live-source-warnings').textContent, /もう一度/);
  assert.equal(app.getSaveCalls(), 0);
});

test('AIで整理 source intake discards every AI field when one destination field changes while pending', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'same source throughout request' });
  app.setSaveSpy();
  app.elements.get('x-parent-preview').value = 'PARENT BEFORE';
  app.elements.get('x-reply-preview').value = 'REPLY BEFORE';
  const response = deferred();
  app.useAdminFetch(() => response.promise);

  const pending = app.handleLiveSourceParse();
  await flushAsync();
  app.elements.get('edit-title').value = 'latest human title edit';
  const latestSnapshot = snapshotLiveSourceIntake(app.elements);
  response.resolve(jsonResponse({ draft: validLiveSourceIntakeDraft() }));

  const result = await pending;

  assert.equal(result, false);
  assertLiveSourceIntakeUnchanged(app.elements, latestSnapshot);
  assert.equal(app.elements.get('x-parent-preview').value, 'PARENT BEFORE');
  assert.equal(app.elements.get('x-reply-preview').value, 'REPLY BEFORE');
  assert.match(app.elements.get('live-source-warnings').textContent, /入力が変更されたため反映しませんでした/);
  assert.match(app.elements.get('live-source-warnings').textContent, /もう一度/);
  assert.equal(app.getSaveCalls(), 0);
});

test('AIで整理 source intake lets a replacement modal run while the stale request resolves in reverse order', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.setApiMode(true);
  app.setSaveSpy();
  const responseA = deferred();
  const responseB = deferred();
  const payloadB = deferred();
  let requestCount = 0;
  app.useAdminFetch(() => {
    requestCount += 1;
    if (requestCount === 1) return responseA.promise;
    if (requestCount === 2) return responseB.promise;
    throw new Error('duplicate request must not be sent');
  });

  app.addLive();
  setLiveForm(app.elements, { 'edit-sourceText': 'source A' });
  const buttonA = app.elements.get('live-source-parse-btn');
  const pendingA = buttonA.dispatch('click');
  await flushAsync();
  assert.equal(buttonA.disabled, true);

  app.closeModal();
  app.addLive();
  setLiveForm(app.elements, {
    'edit-sourceText': 'source B',
    'edit-date': 'B date before',
    'edit-title': 'B title before',
    'edit-venue': 'B venue before',
    'edit-description': 'B description before',
    'edit-ticketUrl': 'https://b.example/ticket-before',
    'edit-link': 'https://b.example/detail-before',
  });
  app.elements.get('x-parent-preview').value = 'B PARENT BEFORE';
  app.elements.get('x-reply-preview').value = 'B REPLY BEFORE';
  const buttonB = app.elements.get('live-source-parse-btn');
  assert.equal(buttonB.disabled, false);
  const pendingB = buttonB.dispatch('click');
  await flushAsync();
  const bBusyBeforeAResolved = buttonB.disabled && buttonB.textContent === 'AIで整理中...';

  responseB.resolve({ ok: true, status: 200, json: () => payloadB.promise });
  await flushAsync();
  responseA.resolve(jsonResponse({ draft: validLiveSourceIntakeDraft({ title: 'STALE A' }) }));
  const resultA = await pendingA;
  const bBusyAfterAResolved = buttonB.disabled && buttonB.textContent === 'AIで整理中...';
  const duplicateB = buttonB.dispatch('click');
  await flushAsync();
  const requestCountWhileBBusy = app.fetchCalls.length;

  payloadB.resolve({
    draft: validLiveSourceIntakeDraft({
      date: '2026.09.09',
      title: 'CURRENT B',
      venue: 'B venue',
      description: 'B description',
      ticketUrl: 'https://b.example/ticket',
      link: 'https://b.example/detail',
    }),
  });
  const [resultB, duplicateResult] = await Promise.all([pendingB, duplicateB]);

  assert.equal(resultA, false);
  assert.equal(resultB, true);
  assert.equal(duplicateResult, false);
  assert.equal(bBusyBeforeAResolved, true);
  assert.equal(bBusyAfterAResolved, true);
  assert.equal(requestCountWhileBBusy, 2);
  assert.equal(app.fetchCalls.length, 2);
  assert.deepEqual(app.fetchCalls.map((call) => JSON.parse(call.options.body).sourceText), ['source A', 'source B']);
  assert.equal(buttonB.disabled, false);
  assert.equal(buttonB.textContent, 'AIで整理');
  assert.equal(app.elements.get('edit-sourceText').value, 'source B');
  assert.equal(app.elements.get('edit-date').value, '2026.09.09');
  assert.equal(app.elements.get('edit-title').value, 'CURRENT B');
  assert.equal(app.elements.get('edit-venue').value, 'B venue');
  assert.equal(app.elements.get('edit-description').value, 'B description');
  assert.equal(app.elements.get('edit-ticketUrl').value, 'https://b.example/ticket');
  assert.equal(app.elements.get('edit-link').value, 'https://b.example/detail');
  assert.doesNotMatch(app.elements.get('x-reply-preview').value, /STALE A/);
  assert.match(app.elements.get('x-reply-preview').value, /CURRENT B/);
  assert.match(app.elements.get('live-source-warnings').textContent, /整理しました/);
  assert.equal(app.getSaveCalls(), 0);
});

test('AIで整理 source intake keeps every field and preview unchanged for HTTP, network, JSON, or schema failure', async (t) => {
  const failureCases = [
    ['HTTP', async () => ({
      ok: false,
      status: 502,
      async json() { return { error: '<img src=x onerror=alert(1)> provider-secret' }; },
    })],
    ['network', async () => { throw new Error('network provider-secret'); }],
    ['JSON', async () => ({ ok: true, status: 200, async json() { throw new SyntaxError('provider-secret'); } })],
    ['missing draft key', async () => jsonResponse({
      draft: {
        date: '2026.08.20',
        title: 'partial',
        venue: 'venue',
        description: 'details',
        ticketUrl: '',
      },
    })],
    ['extra draft key', async () => jsonResponse({
      draft: { ...validLiveSourceIntakeDraft(), confidence: 'high' },
    })],
    ['non-string draft value', async () => jsonResponse({
      draft: validLiveSourceIntakeDraft({ venue: null }),
    })],
  ];

  for (const [name, responder] of failureCases) {
    await t.test(name, async () => {
      const app = loadAdminApp();
      app.setSiteData({ live: { upcoming: [], past: [] } });
      app.addLive();
      app.setApiMode(true);
      setLiveForm(app.elements, { 'edit-sourceText': `source stays: ${name}` });
      app.setSaveSpy();
      app.elements.get('x-parent-preview').value = 'PARENT BEFORE';
      app.elements.get('x-reply-preview').value = 'REPLY BEFORE';
      const snapshot = snapshotLiveSourceIntake(app.elements);
      app.useAdminFetch(responder);

      await app.handleLiveSourceParse();

      assertLiveSourceIntakeUnchanged(app.elements, snapshot);
      assert.equal(app.elements.get('x-parent-preview').value, 'PARENT BEFORE');
      assert.equal(app.elements.get('x-reply-preview').value, 'REPLY BEFORE');
      assert.equal(app.elements.get('live-source-parse-btn').disabled, false);
      assert.equal(app.elements.get('live-source-parse-btn').textContent, 'AIで整理');
      assert.equal(app.elements.get('live-source-warnings').textContent, 'AIで整理できませんでした。元情報は変更されていません。');
      assert.doesNotMatch(app.elements.get('live-source-warnings').textContent, /provider-secret|<img/);
      assert.equal(app.getSaveCalls(), 0);
    });
  }
});

test('AIで整理 source intake never falls back from a custom API base to canonical production', async (t) => {
  const customBase = 'https://custom-ai-dev.example.test';
  const failureCases = [
    ['502', async () => jsonResponse({ error: 'provider failed' }, { ok: false, status: 502 })],
    ['504', async () => jsonResponse({ error: 'provider timeout' }, { ok: false, status: 504 })],
    ['network', async () => { throw new Error('custom dev network failed'); }],
  ];

  for (const [name, networkFetch] of failureCases) {
    await t.test(name, async () => {
      const app = loadAdminApp({
        adminConfig: { apiBaseUrl: customBase, adminToken: 'test-admin-token' },
        networkFetch,
      });
      app.setSiteData({ live: { upcoming: [], past: [] } });
      app.addLive();
      setLiveForm(app.elements, { 'edit-sourceText': `private source ${name}` });
      app.setSaveSpy();
      app.elements.get('x-parent-preview').value = 'PARENT BEFORE';
      app.elements.get('x-reply-preview').value = 'REPLY BEFORE';
      const snapshot = snapshotLiveSourceIntake(app.elements);

      const result = await app.handleLiveSourceParse();

      assert.equal(result, false);
      assert.equal(app.networkFetchCalls.length, 1);
      assert.equal(app.networkFetchCalls[0].url, `${customBase}/api/admin/live-source-intake`);
      assert.equal(app.networkFetchCalls.some((call) => call.url.startsWith('https://1212hp.itsukimatsumoto.workers.dev')), false);
      assertLiveSourceIntakeUnchanged(app.elements, snapshot);
      assert.equal(app.elements.get('x-parent-preview').value, 'PARENT BEFORE');
      assert.equal(app.elements.get('x-reply-preview').value, 'REPLY BEFORE');
      assert.equal(app.elements.get('live-source-warnings').textContent, 'AIで整理できませんでした。元情報は変更されていません。');
      assert.equal(app.getSaveCalls(), 0);
    });
  }
});

test('AIで整理 source intake fails atomically when one of the six destination fields is missing', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'source stays when a destination is missing' });
  app.setSaveSpy();
  app.elements.delete('edit-link');
  app.elements.get('x-parent-preview').value = 'PARENT BEFORE';
  app.elements.get('x-reply-preview').value = 'REPLY BEFORE';
  const snapshot = snapshotLiveSourceIntake(app.elements);
  app.useAdminFetch(async () => jsonResponse({ draft: validLiveSourceIntakeDraft() }));

  const result = await app.handleLiveSourceParse();

  assert.equal(result, false);
  assertLiveSourceIntakeUnchanged(app.elements, snapshot);
  assert.equal(app.elements.get('x-parent-preview').value, 'PARENT BEFORE');
  assert.equal(app.elements.get('x-reply-preview').value, 'REPLY BEFORE');
  assert.equal(app.elements.get('live-source-warnings').textContent, 'AIで整理できませんでした。元情報は変更されていません。');
  assert.equal(app.getSaveCalls(), 0);
});

test('AIで整理 source intake rolls back all fields and both previews when X preview generation fails partway', async () => {
  let failPreview = false;
  const app = loadAdminApp({
    liveOperations: {
      ...LiveOperations,
      buildXParentText(...args) {
        return failPreview ? 'PARTIAL PARENT' : LiveOperations.buildXParentText(...args);
      },
      buildXReplyText(...args) {
        if (failPreview) throw new Error('preview generation failed');
        return LiveOperations.buildXReplyText(...args);
      },
    },
  });
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'source stays when preview fails' });
  app.setSaveSpy();
  app.elements.get('x-parent-preview').value = 'PARENT BEFORE';
  app.elements.get('x-reply-preview').value = 'REPLY BEFORE';
  const snapshot = snapshotLiveSourceIntake(app.elements);
  failPreview = true;
  app.useAdminFetch(async () => jsonResponse({ draft: validLiveSourceIntakeDraft() }));

  const result = await app.handleLiveSourceParse();

  assert.equal(result, false);
  assertLiveSourceIntakeUnchanged(app.elements, snapshot);
  assert.equal(app.elements.get('x-parent-preview').value, 'PARENT BEFORE');
  assert.equal(app.elements.get('x-reply-preview').value, 'REPLY BEFORE');
  assert.equal(app.elements.get('live-source-warnings').textContent, 'AIで整理できませんでした。元情報は変更されていません。');
  assert.equal(app.getSaveCalls(), 0);
});

test('AIで整理 source intake stays local-only in Local Mode without calling API, parser, preview, or save', async () => {
  let parserCalls = 0;
  const app = loadAdminApp({
    liveOperations: {
      ...LiveOperations,
      parseLiveSourceText() { parserCalls += 1; return { draft: {}, warnings: [] }; },
    },
  });
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  setLiveForm(app.elements, { 'edit-sourceText': 'local source stays' });
  app.setSaveSpy();
  app.elements.get('x-parent-preview').value = 'PARENT BEFORE';
  app.elements.get('x-reply-preview').value = 'REPLY BEFORE';
  const snapshot = snapshotLiveSourceIntake(app.elements);
  app.useAdminFetch(async () => { throw new Error('API must not be called'); });

  await app.elements.get('live-source-parse-btn').dispatch('click');

  assert.equal(app.fetchCalls.length, 0);
  assert.equal(parserCalls, 0);
  assertLiveSourceIntakeUnchanged(app.elements, snapshot);
  assert.equal(app.elements.get('x-parent-preview').value, 'PARENT BEFORE');
  assert.equal(app.elements.get('x-reply-preview').value, 'REPLY BEFORE');
  assert.match(app.elements.get('live-source-warnings').textContent, /API Modeで利用可能/);
  assert.equal(app.getSaveCalls(), 0);
});

test('Live editor exposes new fields and conservatively infers only a missing legacy ticketUrl', () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'legacy', date: '', title: '', venue: '', description: '', image: '', link: 'https://tiget.net/events/legacy' },
        { id: 'explicit-empty', date: '', title: '', venue: '', description: '', image: '', link: 'https://tiget.net/events/ignored', ticketUrl: '' },
      ],
      past: [],
    },
  });

  app.editLive('legacy', 'upcoming');
  const legacyHtml = app.elements.get('modal-body').innerHTML;
  assert.match(legacyHtml, /id="edit-sourceText"/);
  assert.match(legacyHtml, /id="live-source-parse-btn"/);
  assert.match(legacyHtml, /id="edit-ticketUrl"[^>]*value="https:\/\/tiget\.net\/events\/legacy"/);
  assert.match(legacyHtml, /空欄なら1212HP内で予約/);
  assert.match(legacyHtml, /id="edit-reservationClosed"/);
  assert.match(legacyHtml, /id="edit-xComment"/);
  assert.match(legacyHtml, /詳細・SNSリンク/);

  app.editLive('explicit-empty', 'upcoming');
  assert.match(app.elements.get('modal-body').innerHTML, /id="edit-ticketUrl"[^>]*value=""/);

  app.addLive();
  const newHtml = app.elements.get('modal-body').innerHTML;
  assert.doesNotMatch(newHtml, /id="edit-reservationClosed"[^>]*checked/);
});

test('saving a Live merges new fields into the original object without dropping unknown properties', () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{
        id: 'live-merge',
        date: 'old',
        title: 'old',
        venue: 'old',
        description: 'old',
        image: 'old.jpg',
        link: 'https://example.com/detail',
        unknownFlag: 'keep-me',
        nested: { preserved: true },
      }],
      past: [],
    },
  });
  app.editLive('live-merge', 'upcoming');
  setLiveForm(app.elements, {
    'edit-sourceText': 'original source',
    'edit-ticketUrl': '',
    'edit-xComment': 'owner voice',
    reservationClosed: true,
  });

  app.saveLiveItem();

  const saved = app.getSiteData().live.upcoming[0];
  assert.equal(saved.unknownFlag, 'keep-me');
  assert.deepEqual(saved.nested, { preserved: true });
  assert.equal(saved.sourceText, 'original source');
  assert.equal(saved.ticketUrl, '');
  assert.equal(saved.reservationClosed, true);
  assert.equal(saved.xComment, 'owner voice');
  assert.equal(saved.link, 'https://instagram.com/night-shift');
});

test('X uses separate canonical parent and detail reply; intent and copy never save', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [{ id: 'live-x' }], past: [] } });
  app.editLive('live-x', 'upcoming');
  setLiveForm(app.elements);
  app.setSaveSpy();

  app.updateXPreviewsInModal({ force: true });
  const parent = app.elements.get('x-parent-preview').value;
  const reply = app.elements.get('x-reply-preview').value;
  assert.match(parent, /ぜひ来てください/);
  assert.match(parent, /#ライブ/);
  assert.match(parent, /https:\/\/1212hp\.com\/live\/detail\/\?liveId=live-x/);
  assert.doesNotMatch(parent, /OPEN|START|Night Shift/);
  assert.match(reply, /OPEN 18:30/);
  assert.match(reply, /Night Shift/);

  const intent = new URL(app.buildXIntentUrlFromModal());
  assert.equal(intent.hostname, 'twitter.com');
  assert.equal(intent.searchParams.get('text'), parent);
  await app.copyXReplyFromModal();
  assert.deepEqual(app.clipboardWrites, [reply]);
  assert.equal(app.getSaveCalls(), 0);
});

test('new Live requires an explicit save before X Intent or reservation operations', () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  const html = app.elements.get('modal-body').innerHTML;
  assert.match(html, /保存後にWeb Intentを利用できます/);
  assert.match(html, /id="x-intent-btn"[^>]*disabled/);
  assert.match(html, /予約台帳はLiveを保存すると利用できます/);
  assert.match(html, /id="manual-reservation-submit"[^>]*disabled/);
  assert.equal(app.buildXIntentUrlFromModal(), '');
});

test('saved Live ledger shows Local Mode gate and API mode fetches one Live with active record and seat totals', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [{ id: 'ledger-live', date: '', venue: '' }], past: [] } });
  app.editLive('ledger-live', 'upcoming');
  assert.match(app.elements.get('live-reservation-ledger').innerHTML, /API接続が必要です/);

  app.setApiMode(true);
  app.useAdminFetch(async () => ({
    ok: true,
    json: async () => ({
      reservations: [
        { id: 'web-1', liveId: 'ledger-live', name: 'A', quantity: 2, status: 'pending', source: 'web', email: 'a@example.com' },
        { id: 'manual-1', liveId: 'ledger-live', name: 'B', quantity: 3, status: 'handled', source: 'manual', contact: '@b', internalNote: 'door' },
        { id: 'cancelled', liveId: 'ledger-live', name: 'C', quantity: 8, status: 'cancelled', source: 'web' },
      ],
    }),
  }));

  await app.loadLiveReservations('ledger-live');

  assert.match(app.fetchCalls.at(-1).path, /^\/api\/admin\/ticket-reservations\?liveId=ledger-live/);
  const html = app.elements.get('live-reservation-ledger').innerHTML;
  assert.match(html, /<strong>2<\/strong>\s*有効予約件数/);
  assert.match(html, /<strong>5<\/strong>\s*予約枚数/);
  assert.doesNotMatch(html, /2[^<]*2件|5[^<]*5枚/);
  assert.match(html, /Web/);
  assert.match(html, /手動/);
  assert.match(html, /@b/);
  assert.match(html, /door/);
});

test('manual hold posts the exact client-controlled payload, clears inputs, and refreshes both ledgers', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [{ id: 'manual-live', date: '', venue: '' }], past: [] } });
  app.editLive('manual-live', 'upcoming');
  app.setApiMode(true);
  setLiveForm(app.elements);
  ['manual-reservation-name', 'manual-reservation-quantity', 'manual-reservation-contact', 'manual-reservation-note']
    .forEach((id) => app.elements.set(id, app.elements.get(id) || createElement(id)));
  app.elements.get('manual-reservation-name').value = 'Door Guest';
  app.elements.get('manual-reservation-quantity').value = '3';
  app.elements.get('manual-reservation-contact').value = '090-0000-0000';
  app.elements.get('manual-reservation-note').value = 'paid';
  app.useAdminFetch(async (path, options) => ({
    ok: true,
    json: async () => path === '/api/admin/ticket-reservations' && options.method === 'POST'
      ? { reservation: { id: 'created' } }
      : { reservations: [] },
  }));

  await app.submitManualReservation();

  const post = app.fetchCalls.find((call) => call.path === '/api/admin/ticket-reservations' && call.options.method === 'POST');
  assert.deepEqual(JSON.parse(post.options.body), {
    liveId: 'manual-live',
    name: 'Door Guest',
    quantity: 3,
    contact: '090-0000-0000',
    internalNote: 'paid',
  });
  assert.equal(app.elements.get('manual-reservation-name').value, '');
  assert.equal(app.elements.get('manual-reservation-quantity').value, '1');
  assert.equal(app.elements.get('manual-reservation-contact').value, '');
  assert.equal(app.elements.get('manual-reservation-note').value, '');
  assert.ok(app.fetchCalls.some((call) => call.path.startsWith('/api/admin/ticket-reservations?liveId=manual-live')));
  assert.ok(app.fetchCalls.some((call) => call.path.includes('limit=200') && !call.path.includes('liveId=manual-live')));
});

test('active totals exclude cancelled reservations and cross-Live rows expose source/contact/note', () => {
  const app = loadAdminApp();
  const totals = app.calculateActiveReservationTotals([
    { status: 'pending', quantity: 2 },
    { status: 'handled', quantity: 3 },
    { status: 'cancelled', quantity: 9 },
  ]);
  assert.deepEqual({ records: totals.records, seats: totals.seats }, { records: 2, seats: 5 });

  const manual = app.renderTicketRow({
    id: 'manual', liveId: 'live', name: '<Guest>', quantity: 2, status: 'handled',
    source: 'manual', contact: '<contact>', internalNote: '<note>',
  });
  assert.match(manual, /手動/);
  assert.match(manual, /&lt;contact&gt;/);
  assert.match(manual, /&lt;note&gt;/);
  assert.doesNotMatch(manual, /<contact>|<note>/);
});

test('CSV export uses authenticated adminFetch, downloads a Blob, and always cleans temporary resources', async () => {
  const csvBlob = new Blob(['id,name\n1,A'], { type: 'text/csv' });
  const app = loadAdminApp({
    adminConfig: { apiBaseUrl: 'https://admin.example.test', adminToken: 'secret-token' },
    networkFetch: async () => ({
      ok: true,
      status: 200,
      async blob() { return csvBlob; },
    }),
  });
  app.elements.get('tickets-live-filter').value = 'live/a';
  app.elements.get('tickets-status-filter').value = 'handled';

  await app.downloadTicketsCsv();

  assert.equal(app.networkFetchCalls.length, 1);
  assert.match(app.networkFetchCalls[0].url, /^https:\/\/admin\.example\.test\/api\/admin\/ticket-reservations\.csv\?/);
  assert.equal(app.networkFetchCalls[0].options.headers.get('Authorization'), 'Bearer secret-token');
  assert.equal(app.objectUrls.length, 1);
  assert.equal(app.objectUrls[0].blob, csvBlob);
  assert.equal(app.createdAnchors.length, 1);
  assert.equal(app.createdAnchors[0].href, app.objectUrls[0].url);
  assert.equal(app.createdAnchors[0].download, 'ticket_reservations.csv');
  assert.equal(app.createdAnchors[0].clicked, true);
  assert.deepEqual(app.revokedObjectUrls, [app.objectUrls[0].url]);
  assert.equal(app.document.body.children.length, 0);
});

test('CSV export surfaces non-OK errors and cleans an appended anchor even when click fails', async () => {
  const failed = loadAdminApp({
    adminConfig: { apiBaseUrl: 'https://admin.example.test', adminToken: 'secret-token' },
    networkFetch: async () => ({
      ok: false,
      status: 400,
      async json() { return { error: 'CSV生成に失敗しました' }; },
    }),
  });
  await failed.downloadTicketsCsv();
  assert.match(failed.elements.get('toast').textContent, /CSV生成に失敗しました/);
  assert.equal(failed.objectUrls.length, 0);
  assert.equal(failed.document.body.children.length, 0);

  const csvBlob = new Blob(['id'], { type: 'text/csv' });
  const clickFailure = loadAdminApp({
    adminConfig: { apiBaseUrl: 'https://admin.example.test', adminToken: 'secret-token' },
    networkFetch: async () => ({ ok: true, status: 200, async blob() { return csvBlob; } }),
  });
  clickFailure.setAnchorClickError(new Error('download click failed'));
  await clickFailure.downloadTicketsCsv();
  assert.match(clickFailure.elements.get('toast').textContent, /download click failed/);
  assert.equal(clickFailure.document.body.children.length, 0);
  assert.deepEqual(clickFailure.revokedObjectUrls, [clickFailure.objectUrls[0].url]);
});

test('reversed reservation responses cannot cross modal ownership or overwrite a newer same-Live request', async () => {
  const crossModal = loadAdminApp();
  crossModal.setApiMode(true);
  crossModal.setSiteData({
    live: {
      upcoming: [
        { id: 'live-a', date: '', title: '', venue: '', description: '', image: '', link: '' },
        { id: 'live-b', date: '', title: '', venue: '', description: '', image: '', link: '' },
      ],
      past: [],
    },
  });
  const responseA = deferred();
  const responseB = deferred();
  crossModal.useAdminFetch((path) => path.includes('liveId=live-a') ? responseA.promise : responseB.promise);

  crossModal.editLive('live-a', 'upcoming');
  const targetA = crossModal.elements.get('live-reservation-ledger');
  crossModal.editLive('live-b', 'upcoming');
  const targetB = crossModal.elements.get('live-reservation-ledger');
  assert.notEqual(targetA, targetB);
  assert.match(targetB.innerHTML, /読み込み中/);

  responseA.resolve(jsonResponse({ reservations: [{ id: 'a-old', name: 'OLD A', quantity: 1, status: 'pending' }] }));
  await flushAsync();
  assert.match(targetB.innerHTML, /読み込み中/);
  assert.doesNotMatch(targetB.innerHTML, /OLD A/);

  responseB.resolve(jsonResponse({ reservations: [{ id: 'b-new', name: 'LIVE B', quantity: 1, status: 'pending' }] }));
  await flushAsync();
  assert.match(targetB.innerHTML, /LIVE B/);

  const sameLive = loadAdminApp();
  sameLive.setApiMode(true);
  sameLive.setSiteData({ live: { upcoming: [{ id: 'same', date: '', venue: '' }], past: [] } });
  const older = deferred();
  const newer = deferred();
  let requestCount = 0;
  sameLive.useAdminFetch(() => (++requestCount === 1 ? older.promise : newer.promise));
  sameLive.editLive('same', 'upcoming');
  const newerLoad = sameLive.loadLiveReservations('same');
  newer.resolve(jsonResponse({ reservations: [{ id: 'new', name: 'NEWER', quantity: 1, status: 'pending' }] }));
  await newerLoad;
  older.resolve(jsonResponse({ reservations: [{ id: 'old', name: 'OLDER', quantity: 1, status: 'pending' }] }));
  await flushAsync();
  const sameTarget = sameLive.elements.get('live-reservation-ledger');
  assert.match(sameTarget.innerHTML, /NEWER/);
  assert.doesNotMatch(sameTarget.innerHTML, /OLDER/);

  const staleError = loadAdminApp();
  staleError.setApiMode(true);
  staleError.setSiteData({ live: { upcoming: [{ id: 'same-error', date: '', venue: '' }], past: [] } });
  const olderError = deferred();
  const newerSuccess = deferred();
  let errorRequestCount = 0;
  staleError.useAdminFetch(() => (++errorRequestCount === 1 ? olderError.promise : newerSuccess.promise));
  staleError.editLive('same-error', 'upcoming');
  const latestLoad = staleError.loadLiveReservations('same-error');
  newerSuccess.resolve(jsonResponse({ reservations: [{ id: 'fresh', name: 'FRESH', quantity: 1, status: 'pending' }] }));
  await latestLoad;
  olderError.reject(new Error('OLDER ERROR'));
  await flushAsync();
  const errorTarget = staleError.elements.get('live-reservation-ledger');
  assert.match(errorTarget.innerHTML, /FRESH/);
  assert.doesNotMatch(errorTarget.innerHTML, /OLDER ERROR|取得失敗/);
});

test('reservation loading for a non-current Live cannot mutate the current modal', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({ live: { upcoming: [{ id: 'live-b', date: '', venue: '' }], past: [] } });
  app.useAdminFetch(async () => jsonResponse({ reservations: [] }));
  app.editLive('live-b', 'upcoming');
  await flushAsync();
  const target = app.elements.get('live-reservation-ledger');
  target.innerHTML = '<p>LIVE B CURRENT</p>';
  const callCount = app.fetchCalls.length;

  await app.loadLiveReservations('live-a');

  assert.equal(target.innerHTML, '<p>LIVE B CURRENT</p>');
  assert.equal(app.fetchCalls.length, callCount);
});

test('cross-Live ledger ignores reversed stale success and error responses for older filter snapshots', async () => {
  const successApp = loadAdminApp();
  successApp.setApiMode(true);
  const olderSuccess = deferred();
  const latestSuccess = deferred();
  let successRequestCount = 0;
  successApp.useAdminFetch(() => (++successRequestCount === 1 ? olderSuccess.promise : latestSuccess.promise));
  const successLiveFilter = successApp.elements.get('tickets-live-filter');
  const successStatusFilter = successApp.elements.get('tickets-status-filter');
  successLiveFilter.value = 'live-a';
  successStatusFilter.value = 'pending';
  const olderSuccessLoad = successApp.loadTickets();
  assert.match(successApp.elements.get('tickets-list').innerHTML, /読み込み中/);

  successLiveFilter.value = 'live-b';
  successStatusFilter.value = 'handled';
  const latestSuccessLoad = successApp.loadTickets();
  latestSuccess.resolve(jsonResponse({
    reservations: [{ id: 'b-latest', liveId: 'live-b', name: 'LATEST B', quantity: 1, status: 'handled' }],
  }));
  await latestSuccessLoad;
  const successTarget = successApp.elements.get('tickets-list');
  assert.match(successTarget.innerHTML, /LATEST B/);
  assert.doesNotMatch(successTarget.innerHTML, /読み込み中/);

  olderSuccess.resolve(jsonResponse({
    reservations: [{ id: 'a-stale', liveId: 'live-a', name: 'STALE A', quantity: 1, status: 'pending' }],
  }));
  await olderSuccessLoad;
  assert.match(successTarget.innerHTML, /LATEST B/);
  assert.doesNotMatch(successTarget.innerHTML, /STALE A|読み込み中/);

  const errorApp = loadAdminApp();
  errorApp.setApiMode(true);
  const olderError = deferred();
  const latestResponse = deferred();
  let errorRequestCount = 0;
  errorApp.useAdminFetch(() => (++errorRequestCount === 1 ? olderError.promise : latestResponse.promise));
  const errorLiveFilter = errorApp.elements.get('tickets-live-filter');
  const errorStatusFilter = errorApp.elements.get('tickets-status-filter');
  errorLiveFilter.value = 'live-a';
  errorStatusFilter.value = 'pending';
  const olderErrorLoad = errorApp.loadTickets();
  errorLiveFilter.value = 'live-b';
  errorStatusFilter.value = 'handled';
  const latestResponseLoad = errorApp.loadTickets();
  latestResponse.resolve(jsonResponse({
    reservations: [{ id: 'b-fresh', liveId: 'live-b', name: 'FRESH B', quantity: 1, status: 'handled' }],
  }));
  await latestResponseLoad;
  olderError.reject(new Error('STALE A ERROR'));
  await olderErrorLoad;
  const errorTarget = errorApp.elements.get('tickets-list');
  assert.match(errorTarget.innerHTML, /FRESH B/);
  assert.doesNotMatch(errorTarget.innerHTML, /STALE A ERROR|取得失敗|読み込み中/);
});

test('cross-Live ledger response cannot mutate a disconnected replacement target', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  const response = deferred();
  app.useAdminFetch(() => response.promise);
  app.elements.get('tickets-live-filter').value = 'live-a';
  app.elements.get('tickets-status-filter').value = 'pending';
  const pendingLoad = app.loadTickets();
  const oldTarget = app.elements.get('tickets-list');
  const replacementTarget = createElement('tickets-list', app.document);
  replacementTarget.innerHTML = '<p>CURRENT REPLACEMENT</p>';
  oldTarget.isConnected = false;
  app.elements.set('tickets-list', replacementTarget);

  response.resolve(jsonResponse({
    reservations: [{ id: 'a-stale', liveId: 'live-a', name: 'STALE A', quantity: 1, status: 'pending' }],
  }));
  await pendingLoad;

  assert.equal(replacementTarget.innerHTML, '<p>CURRENT REPLACEMENT</p>');
  assert.doesNotMatch(replacementTarget.innerHTML, /STALE A|読み込み中/);
  assert.match(oldTarget.innerHTML, /読み込み中/);
  assert.doesNotMatch(oldTarget.innerHTML, /STALE A/);
});

test('cross-Live ledger response requires both current filters to match its snapshot', async () => {
  for (const changedFilter of ['live', 'status']) {
    const app = loadAdminApp();
    app.setApiMode(true);
    const response = deferred();
    app.useAdminFetch(() => response.promise);
    const liveFilter = app.elements.get('tickets-live-filter');
    const statusFilter = app.elements.get('tickets-status-filter');
    liveFilter.value = 'live-a';
    statusFilter.value = 'pending';
    const pendingLoad = app.loadTickets();
    const target = app.elements.get('tickets-list');
    if (changedFilter === 'live') liveFilter.value = 'live-b';
    if (changedFilter === 'status') statusFilter.value = 'handled';

    response.resolve(jsonResponse({
      reservations: [{ id: `${changedFilter}-stale`, liveId: 'live-a', name: 'STALE FILTER', quantity: 1, status: 'pending' }],
    }));
    await pendingLoad;

    assert.match(target.innerHTML, /読み込み中/);
    assert.doesNotMatch(target.innerHTML, /STALE FILTER/);
  }
});

test('cross-Live filters refresh without reloading when the effective selection remains valid', () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.useAdminFetch(async () => jsonResponse({ reservations: [] }));
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'move-me', date: 'OLD', title: '', venue: 'Old venue', description: '', image: '', link: '' },
        { id: 'keep-selected', date: 'KEEP', title: '', venue: 'Keep venue', description: '', image: '', link: '' },
        { id: 'delete-me', date: 'DELETE', title: '', venue: 'Delete venue', description: '', image: '', link: '' },
      ],
      past: [],
    },
  });
  app.renderTicketsUi();
  const filter = app.elements.get('tickets-live-filter');
  filter.value = 'keep-selected';

  app.editLive('move-me', 'upcoming');
  app.fetchCalls.length = 0;
  setLiveForm(app.elements, { 'edit-date': 'MOVED', 'edit-venue': 'Moved venue', isPast: true });
  app.saveLiveItem();
  assert.match(filter.innerHTML, /MOVED Moved venue/);
  assert.equal(filter.value, 'keep-selected');

  assert.equal(app.fetchCalls.length, 0);
});

test('deleting the selected Live falls back to all Lives and reloads the guarded ledger once', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'delete-me', date: 'DELETE', title: '', venue: 'Delete venue', description: '', image: '', link: '' },
        { id: 'keep-me', date: 'KEEP', title: '', venue: 'Keep venue', description: '', image: '', link: '' },
      ],
      past: [],
    },
  });
  app.useAdminFetch(async () => jsonResponse({
    reservations: [{ id: 'all-lives', liveId: 'keep-me', name: 'ALL LIVE RESULT', quantity: 1, status: 'pending' }],
  }));
  app.renderTicketsUi();
  const filter = app.elements.get('tickets-live-filter');
  filter.value = 'delete-me';

  app.editLive('delete-me', 'upcoming');
  app.fetchCalls.length = 0;
  app.setConfirm(() => true);
  app.deleteItem();
  await flushAsync();

  assert.doesNotMatch(filter.innerHTML, /DELETE Delete venue/);
  assert.equal(filter.value, '');
  assert.equal(app.fetchCalls.length, 1);
  assert.doesNotMatch(app.fetchCalls[0].path, /liveId=/);
  assert.match(app.elements.get('tickets-list').innerHTML, /ALL LIVE RESULT/);
});

test('reservation status actions use escaped data attributes and delegated event handling', async () => {
  const app = loadAdminApp();
  const dangerousId = `quote"');alert(1);//`;
  const row = app.renderTicketRow({ id: dangerousId, name: 'Guest', status: 'pending', quantity: 1 });
  assert.doesNotMatch(row, /onclick=/);
  assert.match(row, /data-reservation-id="quote&quot;&#039;\);alert\(1\);\/\/"/);
  assert.match(row, /data-reservation-status="handled"/);
  assert.equal(typeof app.handleTicketStatusAction, 'function');

  app.setApiMode(true);
  app.useAdminFetch(async (path) => jsonResponse(path.includes('/status') ? {} : { reservations: [] }));
  const button = {
    dataset: { reservationId: dangerousId, reservationStatus: 'handled' },
    closest(selector) {
      assert.equal(selector, '[data-reservation-status]');
      return this;
    },
  };
  await app.handleTicketStatusAction({ target: button, preventDefault() {} });
  assert.ok(app.fetchCalls.some((call) => call.path === `/api/admin/ticket-reservations/${encodeURIComponent(dangerousId)}/status`));
});

test('edit modal is an accessible dialog with Escape close, initial focus, and focus restoration', async () => {
  assert.match(adminHtml, /id="modal"[^>]*role="dialog"/);
  assert.match(adminHtml, /id="modal"[^>]*aria-modal="true"/);
  assert.match(adminHtml, /id="modal"[^>]*aria-labelledby="modal-title"/);
  assert.match(adminHtml, /class="modal-close"[^>]*aria-label="閉じる"/);

  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'focus-live', date: '2026.08.10', title: 'Focus Live', venue: 'Venue', description: '', image: '', link: '' }],
      past: [],
    },
  });
  app.renderLive();
  const trigger = app.elements.get('live-upcoming-list').children[0];
  assert.equal(trigger?.tagName, 'BUTTON');
  assert.equal(trigger.dataset.liveId, 'focus-live');
  assert.equal(trigger.dataset.liveCategory, 'upcoming');
  trigger.focus();
  await app.dispatchDocument('click', { target: trigger, preventDefault() {} });
  assert.equal(app.document.activeElement?.id, 'edit-sourceText');
  assert.equal(app.elements.get('modal').classList.contains('active'), true);

  await app.dispatchDocument('keydown', { key: 'Escape' });
  assert.equal(app.elements.get('modal').classList.contains('active'), false);
  assert.equal(app.getModalState().currentEditId, null);
  assert.equal(app.getModalState().currentEditType, null);
  assert.equal(app.getModalState().isNewItem, false);
  assert.equal(app.document.activeElement, trigger);
  assert.equal(trigger.focusCount, 2);
});

test('saving a rendered Live restores focus to its matching replacement trigger after a category move', async () => {
  const app = loadAdminApp();
  const liveId = `focus-live-\"'\\danger`;
  app.setSiteData({
    live: {
      upcoming: [{ id: liveId, date: '2026.08.10', title: 'Moving Live', venue: 'Venue', description: '', image: '', link: '' }],
      past: [{ id: 'wrong-live', date: '2026.07.01', title: 'Wrong Live', venue: 'Elsewhere', description: '', image: '', link: '' }],
    },
  });
  app.renderLive();
  const originalTrigger = app.elements.get('live-upcoming-list').children[0];
  originalTrigger.focus();

  await app.dispatchDocument('click', { target: originalTrigger, preventDefault() {} });
  assert.equal(app.document.activeElement?.id, 'edit-sourceText');
  setLiveForm(app.elements, { isPast: true });
  await app.saveModal();

  const pastTriggers = app.elements.get('live-past-list').children;
  const replacementTrigger = pastTriggers.find((trigger) => trigger.dataset.liveId === liveId);
  const wrongTrigger = pastTriggers.find((trigger) => trigger.dataset.liveId === 'wrong-live');
  assert.equal(originalTrigger.isConnected, false, 'renderLive must replace the original trigger');
  assert.ok(replacementTrigger, 'the moved Live must have a newly rendered trigger');
  assert.notEqual(replacementTrigger, originalTrigger);
  assert.equal(app.document.activeElement, replacementTrigger);
  assert.equal(replacementTrigger.focusCount, 1);
  assert.equal(wrongTrigger.focusCount, 0, 'focus must not jump to a different Live');
});

test('admin site-data save rejects cross-collection and same-collection duplicate Live IDs in API and Local modes', async (t) => {
  const duplicateCases = [
    ['cross-collection', {
      upcoming: [{ id: 'duplicate-live', date: '2099.08.01', venue: 'Upcoming Hall' }],
      past: [{ id: 'duplicate-live', date: '2000.08.01', venue: 'Past Hall' }],
    }],
    ['same-collection', {
      upcoming: [
        { id: 'duplicate-live', date: '2099.08.01', venue: 'First Hall' },
        { id: 'duplicate-live', date: '2099.08.02', venue: 'Second Hall' },
      ],
      past: [],
    }],
  ];

  for (const [duplicateKind, live] of duplicateCases) {
    for (const apiMode of [true, false]) {
      await t.test(`${duplicateKind} / ${apiMode ? 'API' : 'Local'}`, async () => {
        const app = loadAdminApp();
        app.setApiMode(apiMode);
        app.setSiteData({ live });
        app.useAdminFetch(async () => jsonResponse({ ok: true }));

        const saved = await app.saveData();

        assert.equal(saved, false);
        assert.equal(app.fetchCalls.length, 0, 'invalid data must not reach the admin API');
        assert.equal(app.createdAnchors.length, 0, 'invalid data must not be downloaded in Local mode');
        assert.match(app.elements.get('toast').textContent, /Live ID.*重複.*duplicate-live/);
      });
    }
  }
});
