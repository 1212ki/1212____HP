import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = process.cwd();
const adminHtml = readFileSync(join(repoRoot, 'admin/index.html'), 'utf8');
const adminJs = readFileSync(join(repoRoot, 'admin/app.js'), 'utf8');
const adminCss = readFileSync(join(repoRoot, 'admin/style.css'), 'utf8');
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
  const attributes = new Map();
  let html = '';
  const element = {
    id,
    tagName: tagName.toUpperCase(),
    children: [],
    dataset: {},
    value: '',
    checked: false,
    disabled: false,
    hidden: false,
    tabIndex: 0,
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
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name, value) {
      const normalized = String(value);
      attributes.set(name, normalized);
      if (name === 'tabindex') this.tabIndex = Number(normalized);
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
      let focusTarget = this;
      while (focusTarget) {
        if (!focusTarget.isConnected || focusTarget.hidden) return;
        focusTarget = focusTarget.parentElement;
      }
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
      if (selector === '.tab-btn') {
        return [...elements.values()].filter((element) => element.classList.contains('tab-btn'));
      }
      if (selector === '.tab-content') {
        return [...elements.values()].filter((element) => element.classList.contains('tab-content'));
      }
      if (selector === '[data-live-edit]') {
        return ['live-upcoming-list', 'live-past-list']
          .flatMap((id) => elements.get(id)?.children || [])
          .filter((element) => element.dataset?.liveEdit !== undefined);
      }
      const dataSelector = selector.match(/^\[data-([\w-]+)\]$/);
      if (!dataSelector) return [];
      const dataKey = dataSelector[1].replace(/-([a-z])/g, (_whole, letter) => letter.toUpperCase());
      return [...elements.values()].filter((element) => element.dataset?.[dataKey] !== undefined);
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
          const classAttr = attrs.match(/\bclass="([^"]*)"/i)?.[1] || '';
          trigger.classList.add(...classAttr.split(/\s+/).filter(Boolean));
          const ariaCurrent = attrs.match(/\baria-current="([^"]*)"/i)?.[1];
          if (ariaCurrent !== undefined) trigger.setAttribute('aria-current', ariaCurrent);
          trigger.closest = (selector) => selector === '[data-live-edit]' ? trigger : null;
          list.appendChild(trigger);
        }
      },
    });
  }

  function installOwnedHtmlBehavior(root, ownedIds, order) {
    Object.defineProperty(root, 'innerHTML', {
      configurable: true,
      get() { return root._html || ''; },
      set(value) {
        for (const id of ownedIds) {
          const prior = elements.get(id);
          if (prior) prior.isConnected = false;
          elements.delete(id);
        }
        ownedIds.clear();
        order.length = 0;
        root._html = String(value);

        const openingTag = /<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi;
        for (const match of root._html.matchAll(openingTag)) {
          const [, tagName, attrs, id] = match;
          const element = createElement(id, document, tagName);
          element.parentElement = root;
          element.disabled = /\bdisabled(?:\s|>|$)/i.test(attrs);
          element.checked = /\bchecked(?:\s|>|$)/i.test(attrs);
          element.hidden = /\bhidden(?:\s|>|$)/i.test(attrs);
          const classAttr = attrs.match(/\bclass="([^"]*)"/i)?.[1] || '';
          element.classList.add(...classAttr.split(/\s+/).filter(Boolean));
          const valueAttr = attrs.match(/\bvalue="([^"]*)"/i);
          if (valueAttr) element.value = decodeHtml(valueAttr[1]);
          for (const dataAttr of attrs.matchAll(/\bdata-([\w-]+)="([^"]*)"/gi)) {
            const key = dataAttr[1].replace(/-([a-z])/g, (_whole, letter) => letter.toUpperCase());
            element.dataset[key] = decodeHtml(dataAttr[2]);
          }
          for (const ariaAttr of attrs.matchAll(/\b(aria-[\w-]+)="([^"]*)"/gi)) {
            element.setAttribute(ariaAttr[1], decodeHtml(ariaAttr[2]));
          }
          if (tagName.toLowerCase() === 'textarea') {
            const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const body = root._html.match(new RegExp(`<textarea\\b[^>]*id="${escapedId}"[^>]*>([\\s\\S]*?)<\\/textarea>`, 'i'))?.[1];
            element.value = decodeHtml(body || '');
          }
          if (tagName.toLowerCase() === 'select') installSelectHtmlBehavior(element);
          elements.set(id, element);
          ownedIds.add(id);
          order.push(element);
        }
      },
    });
    root.querySelector = () => order.find((element) => {
      if (element.disabled) return false;
      if (element.tagName === 'INPUT' && element.type === 'hidden') return false;
      return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName);
    }) || null;
  }

  const modalBody = addStatic('modal-body');
  installOwnedHtmlBehavior(modalBody, modalOwnedIds, modalOrder);

  addStatic('modal-title');
  addStatic('modal-overlay');
  addStatic('modal');
  addStatic('delete-btn', 'button');
  addStatic('toast');
  addStatic('saveBtn', 'button');
  addStatic('modeBadge');
  addStatic('connectionBanner');
  const liveGlobalTab = addStatic('global-tab-live', 'button');
  liveGlobalTab.dataset.tab = 'live';
  liveGlobalTab.classList.add('tab-btn', 'active');
  const newsGlobalTab = addStatic('global-tab-news', 'button');
  newsGlobalTab.dataset.tab = 'news';
  newsGlobalTab.classList.add('tab-btn');
  const liveGlobalPanel = addStatic('live-tab', 'section');
  liveGlobalPanel.classList.add('tab-content', 'active');
  const newsGlobalPanel = addStatic('news-tab', 'section');
  newsGlobalPanel.classList.add('tab-content');
  addStatic('tickets-list');
  const liveFilter = addStatic('tickets-live-filter', 'select');
  installSelectHtmlBehavior(liveFilter);
  const statusFilter = addStatic('tickets-status-filter', 'select');
  statusFilter.value = 'pending';
  const liveWorkspace = addStatic('live-workspace');
  const livePageTab = addStatic('live-workspace-page-tab', 'button');
  livePageTab.dataset.liveWorkspaceView = 'page';
  const liveReservationsTab = addStatic('live-workspace-reservations-tab', 'button');
  liveReservationsTab.dataset.liveWorkspaceView = 'reservations';
  const livePagePanel = addStatic('live-workspace-page-panel', 'section');
  livePagePanel.dataset.liveWorkspacePanel = 'page';
  livePagePanel.parentElement = liveWorkspace;
  const liveReservationsPanel = addStatic('live-workspace-reservations-panel', 'section');
  liveReservationsPanel.dataset.liveWorkspacePanel = 'reservations';
  liveReservationsPanel.parentElement = liveWorkspace;
  const upcomingTab = addStatic('live-list-upcoming-tab', 'button');
  upcomingTab.dataset.liveListView = 'upcoming';
  const pastTab = addStatic('live-list-past-tab', 'button');
  pastTab.dataset.liveListView = 'past';
  const upcomingPanel = addStatic('live-list-upcoming-panel', 'section');
  upcomingPanel.dataset.liveListPanel = 'upcoming';
  const pastPanel = addStatic('live-list-past-panel', 'section');
  pastPanel.dataset.liveListPanel = 'past';
  const livePagePrimary = addStatic('live-page-primary');
  livePagePrimary.parentElement = livePagePanel;
  const liveMasterDetail = addStatic('live-master-detail');
  liveMasterDetail.parentElement = livePagePrimary;
  const liveMasterPane = addStatic('live-master-pane');
  liveMasterPane.parentElement = liveMasterDetail;
  const liveEditorPane = addStatic('live-editor-pane', 'section');
  liveEditorPane.parentElement = liveMasterDetail;
  const liveEditorBack = addStatic('live-editor-back', 'button');
  liveEditorBack.parentElement = liveEditorPane;
  const liveEditorContext = addStatic('live-editor-context', 'p');
  liveEditorContext.parentElement = liveEditorPane;
  const liveEditorHeading = addStatic('live-editor-heading', 'h3');
  liveEditorHeading.parentElement = liveEditorPane;
  const liveEditorSaveStatus = addStatic('live-editor-save-status', 'span');
  liveEditorSaveStatus.parentElement = liveEditorPane;
  const liveEditorBody = addStatic('live-editor-body');
  liveEditorBody.parentElement = liveEditorPane;
  const liveEditorOwnedIds = new Set();
  const liveEditorOrder = [];
  installOwnedHtmlBehavior(liveEditorBody, liveEditorOwnedIds, liveEditorOrder);
  upcomingPanel.parentElement = livePagePrimary;
  pastPanel.parentElement = livePagePrimary;
  const liveTicketSettingsOpen = addStatic('live-ticket-settings-open', 'button');
  liveTicketSettingsOpen.parentElement = livePagePrimary;
  const liveTicketSettingsPanel = addStatic('live-ticket-settings-panel', 'section');
  liveTicketSettingsPanel.parentElement = livePagePanel;
  const liveTicketSettingsClose = addStatic('live-ticket-settings-close', 'button');
  liveTicketSettingsClose.parentElement = liveTicketSettingsPanel;
  const upcomingList = addStatic('live-upcoming-list');
  upcomingList.parentElement = upcomingPanel;
  installLiveListHtmlBehavior(upcomingList);
  const pastList = addStatic('live-past-list');
  pastList.parentElement = pastPanel;
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
  context.__adminSaveCalls = 0;
  context.globalThis = context;

  vm.runInNewContext(`${adminJs}
	globalThis.__adminLiveTest = {
	  addNews,
	  editNews,
	  addLive,
	  editLive,
	  closeLiveEditor: typeof closeLiveEditor === 'function' ? closeLiveEditor : null,
	  saveLiveWorkspace: typeof saveLiveWorkspace === 'function' ? saveLiveWorkspace : null,
	  deleteLiveFromWorkspace: typeof deleteLiveFromWorkspace === 'function' ? deleteLiveFromWorkspace : null,
  handleLiveSourceParse,
  saveLiveItem,
  updateXPreviewInModal: typeof updateXPreviewInModal === 'function' ? updateXPreviewInModal : null,
  buildXIntentUrlFromModal,
  copyXAnnouncementFromModal: typeof copyXAnnouncementFromModal === 'function' ? copyXAnnouncementFromModal : null,
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
	  setupLiveWorkspace: typeof setupLiveWorkspace === 'function' ? setupLiveWorkspace : null,
	  setupTabs: typeof setupTabs === 'function' ? setupTabs : null,
	  loadData: typeof loadData === 'function' ? loadData : null,
	  renderModeBadge: typeof renderModeBadge === 'function' ? renderModeBadge : null,
  setLiveWorkspaceView: typeof setLiveWorkspaceView === 'function' ? setLiveWorkspaceView : null,
  setLiveListView: typeof setLiveListView === 'function' ? setLiveListView : null,
	  setTicketSettingsOpen: typeof setTicketSettingsOpen === 'function' ? setTicketSettingsOpen : null,
	  setLiveEditorTask: typeof setLiveEditorTask === 'function' ? setLiveEditorTask : null,
	  ensureNoActiveImageUploads,
  handleTicketStatusAction: typeof handleTicketStatusAction === 'function' ? handleTicketStatusAction : null,
  setApiMode(value) { IS_API_MODE = value; },
  setSiteData(value) { siteData = value; },
  getSiteData() { return siteData; },
	  getModalState() { return { currentEditId, currentEditType, isNewItem }; },
	  getLiveEditorState() {
	    return typeof liveEditorGeneration === 'number'
	      ? {
	          generation: liveEditorGeneration,
	          dirty: Boolean(liveEditorDirty),
	          readOnly: typeof isApiFallbackReadOnly === 'boolean' ? isApiFallbackReadOnly : false,
	        }
	      : null;
	  },
  setAdminFetch(fn) { adminFetch = async (...args) => { const result = await fn(...args); return result; }; },
	  setSaveSpy() { saveData = async () => { globalThis.__adminSaveCalls += 1; return true; }; },
  setConfirm(fn) { confirm = fn; },
};`, context);

  return {
    ...context.__adminLiveTest,
    ...dom,
    clipboardWrites,
    fetchCalls,
    networkFetchCalls,
    openedUrls,
    getSaveCalls: () => context.__adminSaveCalls,
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
    'edit-date': '2026-08-10',
    'edit-title': 'Night Shift',
    'edit-venue': '柴崎mod',
    'edit-openTime': '18:30',
    'edit-startTime': '19:00',
    'edit-ticket': '¥2,500 + 1D',
    'edit-notes': '再入場不可',
    'edit-performers': '松本一樹 / another band',
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
  'edit-openTime',
  'edit-startTime',
  'edit-ticket',
  'edit-notes',
  'edit-performers',
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
    date: '2026-08-20',
    title: 'AI title',
    venue: 'AI venue',
    openTime: '18:30',
    startTime: '19:00',
    ticket: '¥2,500 + 1D',
    notes: '再入場不可',
    performers: '松本一樹 / another band',
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

test('Live is the initial primary tab and Tickets is not a global tab', () => {
  const primaryNav = adminHtml.match(/<nav class="tab-nav">([\s\S]*?)<\/nav>/)?.[1] || '';
  assert.match(primaryNav, /class="tab-btn active" data-tab="live"/);
  assert.doesNotMatch(primaryNav, /data-tab="tickets"/);
  assert.match(adminHtml, /id="live-tab"[^>]*class="tab-content active"|class="tab-content active"[^>]*id="live-tab"/);
});

test('Live workspace has semantic Liveページ and 予約管理 tabs', () => {
  assert.match(adminHtml, /class="live-workspace-tabs"[^>]*role="tablist"/);
  assert.match(adminHtml, /role="tab"[^>]*data-live-workspace-view="page"[^>]*>Liveページ<\/button>/);
  assert.match(adminHtml, /role="tab"[^>]*data-live-workspace-view="reservations"[^>]*>予約管理<\/button>/);
});

test('Live workspace Liveページ has semantic 開催予定 and 公演終了 filters', () => {
  assert.match(adminHtml, /class="live-list-tabs"[^>]*role="tablist"/);
  assert.match(adminHtml, /role="tab"[^>]*data-live-list-view="upcoming"[^>]*>開催予定<\/button>/);
  assert.match(adminHtml, /role="tab"[^>]*data-live-list-view="past"[^>]*>公演終了<\/button>/);
});

test('Live workspace separates reservations and Ticket Page共通設定 from Live list details', () => {
  assert.match(adminHtml, /id="live-workspace-reservations-panel"[^>]*role="tabpanel"/);
  assert.match(adminHtml, /id="live-workspace-reservations-panel"[\s\S]*id="tickets-list"/);
  assert.match(adminHtml, /id="live-ticket-settings-open"[^>]*>Ticket Page共通設定<\/button>/);
  assert.match(adminHtml, /id="live-ticket-settings-open"[^>]*aria-controls="live-ticket-settings-panel"/);
  assert.match(adminHtml, /id="live-ticket-settings-open"[^>]*aria-expanded="false"/);
  assert.match(adminHtml, /id="live-ticket-settings-panel"[^>]*role="region"/);
  assert.match(adminHtml, /id="live-ticket-settings-close"[^>]*>Liveページへ戻る<\/button>/);
  assert.doesNotMatch(adminHtml, /<details[^>]*[\s\S]*?(?:Ticket Page|予約一覧（全Live）)[\s\S]*?<\/details>/);
});

test('Live workspace Ticket Page settings moves focus and synchronizes disclosure state', async () => {
  const app = loadAdminApp();
  app.setupLiveWorkspace();
  const openButton = app.elements.get('live-ticket-settings-open');
  const closeButton = app.elements.get('live-ticket-settings-close');
  const primaryPanel = app.elements.get('live-page-primary');
  const settingsPanel = app.elements.get('live-ticket-settings-panel');

  openButton.focus();
  await openButton.dispatch('click');
  assert.equal(openButton.getAttribute('aria-expanded'), 'true');
  assert.equal(primaryPanel.hidden, true);
  assert.equal(settingsPanel.hidden, false);
  assert.equal(app.document.activeElement, closeButton);

  await closeButton.dispatch('click');
  assert.equal(openButton.getAttribute('aria-expanded'), 'false');
  assert.equal(primaryPanel.hidden, false);
  assert.equal(settingsPanel.hidden, true);
  assert.equal(app.document.activeElement, openButton);
});

test('Live workspace initial state is Liveページ and 開催予定', () => {
  assert.match(adminHtml, /id="live-workspace-page-tab"[^>]*aria-selected="true"[^>]*tabindex="0"/);
  assert.match(adminHtml, /id="live-workspace-reservations-tab"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
  assert.match(adminHtml, /id="live-workspace-reservations-panel"[^>]*hidden/);
  assert.match(adminHtml, /id="live-list-upcoming-tab"[^>]*aria-selected="true"[^>]*tabindex="0"/);
  assert.match(adminHtml, /id="live-list-past-tab"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
  assert.match(adminHtml, /id="live-list-past-panel"[^>]*hidden/);
});

test('Live workspace tablists support ArrowLeft ArrowRight Home and End movement', async () => {
  const app = loadAdminApp();
  assert.equal(typeof app.setupLiveWorkspace, 'function');
  app.setupLiveWorkspace();

  const pageTab = app.elements.get('live-workspace-page-tab');
  const reservationsTab = app.elements.get('live-workspace-reservations-tab');
  await pageTab.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(reservationsTab.getAttribute('aria-selected'), 'true');
  assert.equal(reservationsTab.focusCount, 1);
  assert.equal(app.elements.get('live-workspace-page-panel').hidden, true);
  assert.equal(app.elements.get('live-workspace-reservations-panel').hidden, false);
  await reservationsTab.dispatch('keydown', { key: 'Home' });
  assert.equal(pageTab.getAttribute('aria-selected'), 'true');

  const upcomingTab = app.elements.get('live-list-upcoming-tab');
  const pastTab = app.elements.get('live-list-past-tab');
  await upcomingTab.dispatch('keydown', { key: 'End' });
  assert.equal(pastTab.getAttribute('aria-selected'), 'true');
  assert.equal(app.elements.get('live-list-upcoming-panel').hidden, true);
  assert.equal(app.elements.get('live-list-past-panel').hidden, false);
  await pastTab.dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(upcomingTab.getAttribute('aria-selected'), 'true');
});

test('master-detail Live workspace contains list and empty editor panes with the adaptive desktop grid', () => {
  assert.match(adminHtml, /id="live-master-detail"/);
  assert.match(adminHtml, /id="live-master-pane"/);
  assert.match(adminHtml, /id="live-editor-pane"/);
  assert.match(adminHtml, /id="live-editor-body"[\s\S]*Liveを選択/);
  assert.match(adminCss, /@media\s*\(min-width:\s*900px\)/);
  assert.match(adminCss, /grid-template-columns:\s*320px\s+minmax\(0,\s*1fr\)/);
});

test('Live edit workspace renders add and edit in the detail pane while News keeps the generic dialog', () => {
  const app = loadAdminApp();
  app.setSiteData({
    news: [],
    live: {
      upcoming: [{ id: 'detail-live', date: '2026-08-10', title: '山頂', venue: '下北沢おてまえ', image: '' }],
      past: [],
    },
  });
  app.renderLive();
  const trigger = app.elements.get('live-upcoming-list').children[0];
  trigger.focus();

  app.editLive('detail-live', 'upcoming');

  assert.match(adminHtml, /id="live-editor-context"/);
  assert.match(app.elements.get('live-editor-body').innerHTML, /id="edit-sourceText"/);
  assert.equal(app.elements.get('modal-body').innerHTML, '');
  assert.equal(app.elements.get('modal').classList.contains('active'), false);
  assert.equal(app.elements.get('live-editor-context').textContent, '選択中Live・開催予定');
  assert.equal(app.elements.get('live-editor-heading').textContent, '2026.08.10(Mon) 下北沢おてまえ — 山頂');
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');
  assert.equal(app.elements.get('live-editor-back').hidden, false);
  assert.equal(trigger.getAttribute('aria-current'), 'true');
  assert.equal(trigger.classList.contains('is-selected'), true);
  assert.match(app.elements.get('live-editor-body').innerHTML, />保存して公開<\/button>/);
  assert.match(app.elements.get('live-editor-body').innerHTML, />削除<\/button>/);

  app.closeLiveEditor();
  assert.match(app.elements.get('live-editor-body').innerHTML, /Liveを選択/);
  assert.equal(app.getModalState().currentEditId, null);

  app.addLive();
  assert.equal(app.elements.get('live-editor-heading').textContent, '新規Live');
  assert.match(app.elements.get('live-editor-body').innerHTML, /id="live-editor-delete-btn"[^>]*hidden/);
  assert.equal(app.elements.get('modal').classList.contains('active'), false);

  app.closeLiveEditor();
  app.addNews();
  assert.equal(app.elements.get('modal').classList.contains('active'), true);
  assert.match(app.elements.get('modal-body').innerHTML, /ニュースタイトル/);
});

test('master-detail marks only the first upcoming card as Next Live', () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'next', date: '2026-08-10', title: 'Next', venue: 'A', image: '' },
        { id: 'later', date: '2026-08-20', title: 'Later', venue: 'B', image: '' },
      ],
      past: [{ id: 'past', date: '2026-07-01', title: 'Past', venue: 'C', image: '' }],
    },
  });

  app.renderLive();

  const upcomingHtml = app.elements.get('live-upcoming-list').innerHTML;
  assert.equal((upcomingHtml.match(/aria-label="Next Live"/g) || []).length, 1);
  assert.match(upcomingHtml, /data-live-id="next"[\s\S]*aria-label="Next Live"/);
  assert.doesNotMatch(app.elements.get('live-past-list').innerHTML, /Next Live/);
});

test('Live task tabs are semantic, keyboard operable, and preserve mounted input', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'task-live', date: '2026-08-10', title: 'Task', venue: 'Venue', image: '' }],
      past: [],
    },
  });
  app.editLive('task-live', 'upcoming');

  const editorHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(editorHtml, /class="live-editor-task-tabs"[^>]*role="tablist"/);
  assert.match(editorHtml, /role="tab"[^>]*data-live-editor-task="public"[^>]*aria-selected="true"/);
  assert.match(editorHtml, /role="tab"[^>]*data-live-editor-task="announcement"[^>]*>告知<\/button>/);
  assert.match(editorHtml, /role="tab"[^>]*data-live-editor-task="reservation"[^>]*>予約<\/button>/);
  assert.match(editorHtml, /role="tabpanel"[^>]*data-live-editor-task-panel="public"/);
  assert.equal(typeof app.setLiveEditorTask, 'function');

  const title = app.elements.get('edit-title');
  title.value = '入力保持';
  const publicTab = app.elements.get('live-editor-task-public');
  const announcementTab = app.elements.get('live-editor-task-announcement');
  await publicTab.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(announcementTab.getAttribute('aria-selected'), 'true');
  assert.equal(app.elements.get('live-editor-panel-public').hidden, true);
  assert.equal(app.elements.get('live-editor-panel-announcement').hidden, false);
  assert.equal(title.value, '入力保持');

  await announcementTab.dispatch('keydown', { key: 'Home' });
  assert.equal(publicTab.getAttribute('aria-selected'), 'true');
  assert.equal(title.value, '入力保持');
});

test('new Live prioritizes source intake and gates post-save tasks until first save', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });

  app.addLive();

  const newHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(newHtml, /<details[^>]*class="live-source-intake"[^>]*open/);
  assert.match(newHtml, /id="live-source-parse-btn"[^>]*>AIで下書きを作る<\/button>/);
  assert.match(newHtml, /id="live-manual-entry-btn"[^>]*>手入力で作成<\/button>/);
  assert.match(newHtml, /id="live-public-fields"[^>]*hidden/);
  assert.equal(app.elements.get('live-editor-task-announcement').disabled, true);
  assert.equal(app.elements.get('live-editor-task-reservation').disabled, true);
  assert.ok(app.elements.get('edit-date'), 'hidden public inputs stay mounted for AI intake');

  await app.elements.get('live-manual-entry-btn').dispatch('click');
  assert.equal(app.elements.get('live-public-fields').hidden, false);
  assert.equal(app.elements.get('edit-date').focusCount, 1);

  setLiveForm(app.elements);
  assert.equal(await app.saveLiveWorkspace(), true);
  assert.equal(app.elements.get('live-editor-task-announcement').disabled, false);
  assert.equal(app.elements.get('live-editor-task-reservation').disabled, false);

  app.editLive(app.getSiteData().live.upcoming[0].id, 'upcoming');
  const existingHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(existingHtml, /<details[^>]*class="live-source-intake"/);
  assert.doesNotMatch(existingHtml, /<details[^>]*class="live-source-intake"[^>]*open/);
  assert.doesNotMatch(existingHtml, /id="live-public-fields"[^>]*hidden/);
});

test('Live validation blocks missing date and venue before changing data or saving', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.setSaveSpy();
  app.addLive();
  await app.elements.get('live-manual-entry-btn').dispatch('click');
  setLiveForm(app.elements, { 'edit-date': '', 'edit-venue': '' });

  const saved = await app.saveLiveWorkspace();

  assert.equal(saved, false);
  assert.equal(app.getSiteData().live.upcoming.length, 0);
  assert.equal(app.getSaveCalls(), 0);
  assert.equal(app.elements.get('edit-date').getAttribute('aria-invalid'), 'true');
  assert.equal(app.elements.get('edit-venue').getAttribute('aria-invalid'), 'true');
  assert.match(app.elements.get('edit-date-error').textContent, /日付/);
  assert.match(app.elements.get('edit-venue-error').textContent, /会場/);
  assert.equal(app.document.activeElement, app.elements.get('edit-date'));
});

test('Live category mismatch warns but saves without automatically moving collection', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'mismatch-live', date: '2000-01-01', title: 'Past date', venue: 'Venue', image: '' }],
      past: [],
    },
  });
  app.editLive('mismatch-live', 'upcoming');
  setLiveForm(app.elements, { 'edit-date': '2000-01-01', 'edit-venue': 'Venue', isPast: false });

  const saved = await app.saveLiveWorkspace();

  assert.equal(saved, true);
  assert.equal(app.getSiteData().live.upcoming[0].id, 'mismatch-live');
  assert.equal(app.getSiteData().live.past.length, 0);
  assert.equal(app.getModalState().currentEditType, 'live-upcoming');
  assert.match(app.elements.get('live-category-warning').textContent, /開催予定.*過去の日付/);
});

test('Live API save reports saving, saved, and failed states around the existing save route', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({
    live: {
      upcoming: [{ id: 'state-live', date: '2026-08-20', title: 'State', venue: 'Venue', image: '' }],
      past: [],
    },
  });
  app.editLive('state-live', 'upcoming');
  setLiveForm(app.elements, { 'edit-date': '2026-08-20', 'edit-venue': 'Venue' });
  const response = deferred();
  app.useAdminFetch(() => response.promise);

  const pendingSave = app.saveLiveWorkspace();
  await flushAsync();
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存中');
  response.resolve(jsonResponse({ data: app.getSiteData() }));
  assert.equal(await pendingSave, true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');

  app.elements.get('edit-title').value = 'Retry';
  app.useAdminFetch(async () => jsonResponse({ error: 'failed' }, { ok: false, status: 500 }));
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存失敗');
});

test('Live dirty guard blocks and then discards navigation to another Live, list, and global tab', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'dirty-a', date: '2026-08-20', title: 'A', venue: 'A venue', image: '' },
        { id: 'dirty-b', date: '2026-08-21', title: 'B', venue: 'B venue', image: '' },
      ],
      past: [],
    },
  });
  app.setupLiveWorkspace();
  app.setupTabs();
  app.renderLive();
  app.editLive('dirty-a', 'upcoming');
  app.elements.get('edit-title').value = 'Unsaved A';
  await app.elements.get('edit-title').dispatch('input');
  let confirmations = 0;
  app.setConfirm(() => { confirmations += 1; return false; });

  assert.equal(app.editLive('dirty-b', 'upcoming'), false);
  assert.equal(app.getModalState().currentEditId, 'dirty-a');
  assert.equal(app.elements.get('edit-title').value, 'Unsaved A');
  assert.equal(app.closeLiveEditor(), false);
  assert.equal(app.getModalState().currentEditId, 'dirty-a');
  assert.equal(app.setLiveWorkspaceView('reservations'), false);
  assert.equal(app.elements.get('live-workspace-page-panel').hidden, false);
  await app.elements.get('global-tab-news').dispatch('click');
  assert.equal(app.elements.get('global-tab-live').classList.contains('active'), true);
  assert.equal(app.elements.get('global-tab-news').classList.contains('active'), false);
  assert.equal(confirmations, 4);

  app.setConfirm(() => true);
  assert.equal(app.editLive('dirty-b', 'upcoming'), true);
  assert.equal(app.getModalState().currentEditId, 'dirty-b');
  app.elements.get('edit-title').value = 'Unsaved B';
  await app.elements.get('edit-title').dispatch('input');
  await app.elements.get('global-tab-news').dispatch('click');
  assert.equal(app.elements.get('global-tab-news').classList.contains('active'), true);
  assert.equal(app.getModalState().currentEditId, null);
});

test('Live internal task switching preserves dirty input without discard confirmation', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: { upcoming: [{ id: 'internal-task', date: '2026-08-20', title: 'Before', venue: 'Venue', image: '' }], past: [] },
  });
  app.editLive('internal-task', 'upcoming');
  app.elements.get('edit-title').value = 'Still here';
  await app.elements.get('edit-title').dispatch('input');
  let confirmations = 0;
  app.setConfirm(() => { confirmations += 1; return false; });

  app.setLiveEditorTask('announcement');

  assert.equal(confirmations, 0);
  assert.equal(app.elements.get('edit-title').value, 'Still here');
  assert.equal(app.elements.get('live-editor-panel-announcement').hidden, false);
  assert.equal(app.getLiveEditorState().dirty, true);
});

test('API fallback is read-only while keeping Live navigation available', async () => {
  const fallbackData = {
    live: { upcoming: [{ id: 'fallback-live', date: '2026-08-20', title: 'Fallback', venue: 'Venue', image: '' }], past: [] },
  };
  const app = loadAdminApp({
    adminConfig: { apiBaseUrl: 'https://custom-admin.example.test', adminToken: 'test-token' },
    networkFetch: async (url) => {
      if (url === 'data/site-data.json') return jsonResponse(fallbackData);
      return jsonResponse({ error: 'offline' }, { ok: false, status: 503 });
    },
  });

  await app.loadData();
  app.renderModeBadge();
  app.editLive('fallback-live', 'upcoming');

  assert.equal(app.getLiveEditorState().readOnly, true);
  assert.match(app.elements.get('connectionBanner').textContent, /読み取り専用/);
  assert.equal(app.elements.get('saveBtn').disabled, true);
  assert.equal(app.elements.get('live-editor-save-btn').disabled, true);
  assert.equal(app.elements.get('live-editor-delete-btn').disabled, true);
  assert.equal(app.elements.get('live-source-parse-btn').disabled, true);
  assert.equal(app.elements.get('manual-reservation-submit').disabled, true);
  assert.equal(app.elements.get('edit-date').disabled, true);
  app.setLiveEditorTask('announcement');
  assert.equal(app.elements.get('live-editor-panel-announcement').hidden, false, 'read-only navigation remains available');

  app.useAdminFetch(async () => { throw new Error('read-only mutation must not call API'); });
  app.setConfirm(() => true);
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.equal(await app.handleLiveSourceParse(), false);
  assert.equal(await app.submitManualReservation(), false);
  assert.equal(await app.markTicketStatus('reservation-1', 'handled'), false);
  assert.equal(await app.deleteLiveFromWorkspace(), false);
  assert.equal(await app.saveData(), false);
  assert.equal(app.fetchCalls.length, 0);
  assert.equal(app.getSiteData().live.upcoming[0].id, 'fallback-live');
});

test('explicit Local Mode labels the header action as JSON export', () => {
  const app = loadAdminApp();
  app.renderModeBadge();

  assert.match(app.elements.get('modeBadge').textContent, /Local Mode/);
  assert.equal(app.elements.get('saveBtn').textContent, 'JSONを書き出す');
});

test('responsive Live workspace fixes overflow, focus, sticky actions, and action hierarchy deterministically', () => {
  assert.match(adminCss, /@media\s*\(min-width:\s*900px\)[\s\S]*grid-template-columns:\s*320px\s+minmax\(0,\s*1fr\)/);
  assert.match(adminCss, /\.live-master-detail\.has-live-selection\s+\.live-master-pane\s*\{[\s\S]*display:\s*none/);
  assert.match(adminCss, /\.live-editor-task-tabs\s*\{[\s\S]*position:\s*sticky/);
  assert.match(adminCss, /\.live-editor-footer\s*\{[\s\S]*position:\s*sticky/);
  assert.match(adminCss, /\.live-editor-task-tab\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(adminCss, /\.live-editor-task-tab:focus-visible/);
  assert.match(adminCss, /\.live-editor-body\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(adminCss, /@supports\s*\(padding-bottom:\s*env\(safe-area-inset-bottom\)\)[\s\S]*\.live-editor-footer/);
  assert.match(adminCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);

  assert.match(adminHtml, /class="add-btn live-primary-action"[^>]*onclick="addLive\(\)"/);
  assert.match(adminHtml, /href="style\.css\?v=20260816-22"/);
  assert.match(adminHtml, /src="app\.js\?v=20260816-22"/);

  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [{ id: 'hierarchy', date: '2026-08-20', venue: 'Venue', image: '' }], past: [] } });
  app.editLive('hierarchy', 'upcoming');
  const editorHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(editorHtml, /id="live-editor-save-btn"[^>]*class="[^"]*btn-primary[^"]*live-primary-action|class="[^"]*btn-primary[^"]*live-primary-action[^>]*id="live-editor-save-btn"/);
  assert.doesNotMatch(editorHtml, /class="[^"]*btn-primary[^"]*"[^>]*id="x-intent-btn"/);
});

test('Live edit workspace saves a category move in place and routes Local Mode to JSON export', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'move-live', date: '2026-08-10', title: 'Before', venue: 'Venue', image: '' }],
      past: [],
    },
  });
  app.setupLiveWorkspace();
  app.renderLive();
  app.editLive('move-live', 'upcoming');
  setLiveForm(app.elements, { 'edit-title': 'After', isPast: true });
  await app.elements.get('edit-title').dispatch('input');
  assert.equal(app.elements.get('saveBtn').disabled, true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '未保存');

  const saved = await app.saveLiveWorkspace();

  assert.equal(saved, true);
  assert.equal(app.getSiteData().live.upcoming.length, 0);
  assert.equal(app.getSiteData().live.past[0].id, 'move-live');
  assert.equal(app.getModalState().currentEditType, 'live-past');
  assert.equal(app.elements.get('live-list-past-panel').hidden, false);
  assert.match(app.elements.get('live-editor-body').innerHTML, /value="After"/);
  assert.equal(app.elements.get('live-editor-save-status').textContent, 'JSON書き出し待ち');
  assert.equal(app.elements.get('saveBtn').disabled, false);
  assert.match(app.elements.get('saveBtn').textContent, /JSONを書き出す/);
  const movedTrigger = app.elements.get('live-past-list').children.find((item) => item.dataset.liveId === 'move-live');
  assert.equal(movedTrigger?.getAttribute('aria-current'), 'true');
});

test('Live edit workspace API save uses the existing save route and deletion keeps existing collection semantics', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'save-live', date: '2026-08-10', title: 'Save', venue: 'A', image: '' },
        { id: 'delete-live', date: '2026-08-11', title: 'Delete', venue: 'B', image: '' },
      ],
      past: [],
    },
  });
  app.setSaveSpy();
  app.editLive('save-live', 'upcoming');
  setLiveForm(app.elements);
  assert.equal(await app.saveLiveWorkspace(), true);
  assert.equal(app.getSaveCalls(), 1);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');

  app.editLive('delete-live', 'upcoming');
  app.setConfirm(() => true);
  assert.equal(await app.deleteLiveFromWorkspace(), true);
  assert.equal(app.getSiteData().live.upcoming.some((live) => live.id === 'delete-live'), false);
  assert.match(app.elements.get('live-editor-body').innerHTML, /Liveを選択/);
  assert.equal(app.getSaveCalls(), 1, 'deletion keeps the existing header-save contract');
});

test('shared LiveOperations script is loaded before the admin application', () => {
  const sharedIndex = adminHtml.indexOf('../assets/js/live-operations.js');
  const appIndex = adminHtml.indexOf('app.js');
  assert.ok(sharedIndex >= 0);
  assert.ok(sharedIndex < appIndex);
  assert.match(adminHtml, /href="style\.css\?v=20260816-22"/);
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
    'edit-date': '2026-08-19',
    'edit-title': 'manual title',
    'edit-venue': 'manual venue stays',
    'edit-openTime': '17:30',
    'edit-startTime': '18:00',
    'edit-ticket': 'manual ticket',
    'edit-notes': 'manual notes',
    'edit-performers': 'manual performer',
    'edit-ticketUrl': 'https://old.example/ticket',
    'edit-link': 'https://old.example/detail',
  });
  app.elements.get('x-post-preview').value = 'POST BEFORE';
  app.useAdminFetch(async () => jsonResponse({
    draft: validLiveSourceIntakeDraft({
      date: ' 2026-08-20 ',
      title: ' AI replacement ',
      venue: '   ',
      openTime: ' 18:30 ',
      startTime: ' 19:00 ',
      ticket: ' AI ticket ',
      notes: ' AI notes ',
      performers: ' AI performer A / AI performer B ',
      ticketUrl: ' https://tickets.example/live/2 ',
      link: ' https://example.com/detail/2 ',
    }),
  }));

  const editorHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(editorHtml, /id="live-source-parse-btn"[^>]*>AIで下書きを作る<\/button>/);
  await app.elements.get('live-source-parse-btn').dispatch('click');

  assert.equal(app.fetchCalls.length, 1);
  assert.equal(app.fetchCalls[0].path, '/api/admin/live-source-intake');
  assert.equal(app.fetchCalls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(app.fetchCalls[0].options.body), { sourceText });
  assert.deepEqual({ ...app.fetchCalls[0].policy }, { allowBaseFallback: false });
  assert.equal(parserCalls, 0);
  assert.equal(app.elements.get('edit-date').value, '2026-08-20');
  assert.equal(app.elements.get('edit-title').value, 'AI replacement');
  assert.equal(app.elements.get('edit-venue').value, 'manual venue stays');
  assert.equal(app.elements.get('edit-openTime').value, '18:30');
  assert.equal(app.elements.get('edit-startTime').value, '19:00');
  assert.equal(app.elements.get('edit-ticket').value, 'AI ticket');
  assert.equal(app.elements.get('edit-notes').value, 'AI notes');
  assert.equal(app.elements.get('edit-performers').value, 'AI performer A / AI performer B');
  assert.equal(app.elements.get('edit-ticketUrl').value, 'https://tickets.example/live/2');
  assert.equal(app.elements.get('edit-link').value, 'https://example.com/detail/2');
  assert.equal(app.elements.get('edit-sourceText').value, sourceText);
  assert.notEqual(app.elements.get('x-post-preview').value, 'POST BEFORE');
  assert.match(app.elements.get('x-post-preview').value, /AI replacement/);
  assert.match(app.elements.get('live-source-warnings').textContent, /整理しました/);
  assert.deepEqual(app.getSiteData(), initial);
  assert.equal(app.getSaveCalls(), 0);
});

test('Live edit workspace marks an applied AI draft dirty and routes saving to the editor', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'ai-dirty-live', date: '2026-08-19', title: 'Before', venue: 'Before venue', image: '' }],
      past: [],
    },
  });
  app.editLive('ai-dirty-live', 'upcoming');
  app.setApiMode(true);
  app.elements.get('edit-sourceText').value = 'AI draft source';
  app.useAdminFetch(async () => jsonResponse({ draft: validLiveSourceIntakeDraft() }));
  assert.equal(app.elements.get('saveBtn').disabled, false);

  await app.elements.get('live-source-parse-btn').dispatch('click');

  assert.equal(app.elements.get('saveBtn').disabled, true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '未保存');
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
  assert.equal(button.textContent, 'AIで下書きを作る');
});

test('AIで整理 source intake discards a stale response when source text changes while pending', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'source at request start' });
  app.setSaveSpy();
  app.elements.get('x-post-preview').value = 'POST BEFORE';
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
  assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
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
  app.elements.get('x-post-preview').value = 'POST BEFORE';
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
  assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
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

  app.setConfirm(() => true);
  app.closeLiveEditor();
  app.addLive();
  setLiveForm(app.elements, {
    'edit-sourceText': 'source B',
    'edit-date': '2026-09-08',
    'edit-title': 'B title before',
    'edit-venue': 'B venue before',
    'edit-openTime': '17:00',
    'edit-startTime': '18:00',
    'edit-ticket': 'B ticket before',
    'edit-notes': 'B notes before',
    'edit-performers': 'B performer before',
    'edit-ticketUrl': 'https://b.example/ticket-before',
    'edit-link': 'https://b.example/detail-before',
  });
  app.elements.get('x-post-preview').value = 'B POST BEFORE';
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
      date: '2026-09-09',
      title: 'CURRENT B',
      venue: 'B venue',
      openTime: '18:30',
      startTime: '19:00',
      ticket: 'B ticket',
      notes: 'B notes',
      performers: 'B performer',
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
  assert.equal(buttonB.textContent, 'AIで下書きを作る');
  assert.equal(app.elements.get('edit-sourceText').value, 'source B');
  assert.equal(app.elements.get('edit-date').value, '2026-09-09');
  assert.equal(app.elements.get('edit-title').value, 'CURRENT B');
  assert.equal(app.elements.get('edit-venue').value, 'B venue');
  assert.equal(app.elements.get('edit-openTime').value, '18:30');
  assert.equal(app.elements.get('edit-startTime').value, '19:00');
  assert.equal(app.elements.get('edit-ticket').value, 'B ticket');
  assert.equal(app.elements.get('edit-notes').value, 'B notes');
  assert.equal(app.elements.get('edit-performers').value, 'B performer');
  assert.equal(app.elements.get('edit-ticketUrl').value, 'https://b.example/ticket');
  assert.equal(app.elements.get('edit-link').value, 'https://b.example/detail');
  assert.doesNotMatch(app.elements.get('x-post-preview').value, /STALE A/);
  assert.match(app.elements.get('x-post-preview').value, /CURRENT B/);
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
        date: '2026-08-20',
        title: 'partial',
        venue: 'venue',
        openTime: '',
        startTime: '',
        ticket: '',
        notes: '',
        performers: '',
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
      app.elements.get('x-post-preview').value = 'POST BEFORE';
      const snapshot = snapshotLiveSourceIntake(app.elements);
      app.useAdminFetch(responder);

      await app.handleLiveSourceParse();

      assertLiveSourceIntakeUnchanged(app.elements, snapshot);
      assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
      assert.equal(app.elements.get('live-source-parse-btn').disabled, false);
      assert.equal(app.elements.get('live-source-parse-btn').textContent, 'AIで下書きを作る');
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
      app.elements.get('x-post-preview').value = 'POST BEFORE';
      const snapshot = snapshotLiveSourceIntake(app.elements);

      const result = await app.handleLiveSourceParse();

      assert.equal(result, false);
      assert.equal(app.networkFetchCalls.length, 1);
      assert.equal(app.networkFetchCalls[0].url, `${customBase}/api/admin/live-source-intake`);
      assert.equal(app.networkFetchCalls.some((call) => call.url.startsWith('https://1212hp.itsukimatsumoto.workers.dev')), false);
      assertLiveSourceIntakeUnchanged(app.elements, snapshot);
      assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
      assert.equal(app.elements.get('live-source-warnings').textContent, 'AIで整理できませんでした。元情報は変更されていません。');
      assert.equal(app.getSaveCalls(), 0);
    });
  }
});

test('AIで整理 source intake fails atomically when one of the ten destination fields is missing', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'source stays when a destination is missing' });
  app.setSaveSpy();
  app.elements.delete('edit-link');
  app.elements.get('x-post-preview').value = 'POST BEFORE';
  const snapshot = snapshotLiveSourceIntake(app.elements);
  app.useAdminFetch(async () => jsonResponse({ draft: validLiveSourceIntakeDraft() }));

  const result = await app.handleLiveSourceParse();

  assert.equal(result, false);
  assertLiveSourceIntakeUnchanged(app.elements, snapshot);
  assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
  assert.equal(app.elements.get('live-source-warnings').textContent, 'AIで整理できませんでした。元情報は変更されていません。');
  assert.equal(app.getSaveCalls(), 0);
});

test('AIで整理 source intake rolls back all fields and the unified preview when X preview generation fails', async () => {
  let failPreview = false;
  const app = loadAdminApp({
    liveOperations: {
      ...LiveOperations,
      buildXAnnouncementText(...args) {
        if (failPreview) throw new Error('preview generation failed');
        return LiveOperations.buildXAnnouncementText(...args);
      },
    },
  });
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  app.setApiMode(true);
  setLiveForm(app.elements, { 'edit-sourceText': 'source stays when preview fails' });
  app.setSaveSpy();
  app.elements.get('x-post-preview').value = 'POST BEFORE';
  const snapshot = snapshotLiveSourceIntake(app.elements);
  failPreview = true;
  app.useAdminFetch(async () => jsonResponse({ draft: validLiveSourceIntakeDraft() }));

  const result = await app.handleLiveSourceParse();

  assert.equal(result, false);
  assertLiveSourceIntakeUnchanged(app.elements, snapshot);
  assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
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
  app.elements.get('x-post-preview').value = 'POST BEFORE';
  const snapshot = snapshotLiveSourceIntake(app.elements);
  app.useAdminFetch(async () => { throw new Error('API must not be called'); });

  await app.elements.get('live-source-parse-btn').dispatch('click');

  assert.equal(app.fetchCalls.length, 0);
  assert.equal(parserCalls, 0);
  assertLiveSourceIntakeUnchanged(app.elements, snapshot);
  assert.equal(app.elements.get('x-post-preview').value, 'POST BEFORE');
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
  const legacyHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(legacyHtml, /id="edit-sourceText"/);
  assert.match(legacyHtml, /id="live-source-parse-btn"/);
  assert.match(legacyHtml, /id="edit-ticketUrl"[^>]*value="https:\/\/tiget\.net\/events\/legacy"/);
  assert.match(legacyHtml, /空欄なら1212HP内で予約/);
  assert.match(legacyHtml, /id="edit-reservationClosed"/);
  assert.match(legacyHtml, /id="edit-xComment"/);
  assert.match(legacyHtml, /詳細・SNSリンク/);

  app.editLive('explicit-empty', 'upcoming');
  assert.match(app.elements.get('live-editor-body').innerHTML, /id="edit-ticketUrl"[^>]*value=""/);

  app.addLive();
  const newHtml = app.elements.get('live-editor-body').innerHTML;
  assert.doesNotMatch(newHtml, /id="edit-reservationClosed"[^>]*checked/);
});

test('structured Live editor normalizes legacy date and saves independent detail fields', () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{
        id: 'structured-live',
        date: '2026.9.28(日)',
        title: 'Legacy title',
        venue: 'Legacy venue',
        description: '旧詳細を保持する',
        image: '',
        link: '',
      }],
      past: [],
    },
  });

  app.editLive('structured-live', 'upcoming');
  const html = app.elements.get('live-editor-body').innerHTML;
  assert.match(html, /type="date"[^>]*id="edit-date"[^>]*value="2026-09-28"/);
  assert.match(html, /type="time"[^>]*id="edit-openTime"/);
  assert.match(html, /type="time"[^>]*id="edit-startTime"/);
  assert.match(html, /id="edit-ticket"/);
  assert.match(html, /id="edit-notes"/);
  assert.match(html, /id="edit-performers"/);
  assert.match(html, /旧詳細（未構造化）/);
  assert.match(html, /旧詳細を保持する/);

  app.elements.get('edit-date').value = '2026-09-28';
  app.elements.get('edit-openTime').value = '18:30';
  app.elements.get('edit-startTime').value = '19:00';
  app.elements.get('edit-ticket').value = '¥2,500 + 1D';
  app.elements.get('edit-notes').value = '再入場不可';
  app.elements.get('edit-performers').value = 'A\nB / C';
  app.saveLiveItem();

  const saved = app.getSiteData().live.upcoming[0];
  assert.equal(saved.date, '2026-09-28');
  assert.equal(saved.openTime, '18:30');
  assert.equal(saved.startTime, '19:00');
  assert.equal(saved.ticket, '¥2,500 + 1D');
  assert.equal(saved.notes, '再入場不可');
  assert.equal(saved.performers, 'A / B / C');
  assert.equal(saved.description, '旧詳細を保持する');
  assert.match(app.elements.get('live-upcoming-list').innerHTML, /2026\.09\.28\(Mon\)/);
});

test('unparsed legacy Live date is preserved until a valid replacement is entered', () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{
        id: 'unparsed-date',
        date: 'date TBA',
        title: 'Unparsed date Live',
        venue: 'Old venue',
        description: '',
        image: '',
        link: '',
      }],
      past: [],
    },
  });

  app.editLive('unparsed-date', 'upcoming');
  const html = app.elements.get('live-editor-body').innerHTML;
  assert.match(html, /id="edit-date"[^>]*value=""[^>]*data-original-unparsed-date="date TBA"/);
  assert.match(html, /現在の保存値: <code>date TBA<\/code>/);
  assert.match(app.elements.get('x-post-preview').value, /^date TBA/m);
  app.elements.get('edit-venue').value = 'Changed venue';
  app.saveLiveItem();
  assert.equal(app.getSiteData().live.upcoming[0].date, 'date TBA');
  assert.equal(app.getSiteData().live.upcoming[0].venue, 'Changed venue');

  app.editLive('unparsed-date', 'upcoming');
  app.elements.get('edit-date').value = '2026-09-28';
  app.saveLiveItem();
  assert.equal(app.getSiteData().live.upcoming[0].date, '2026-09-28');
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

test('unified X announcement preview drives Intent and copy without save', async () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [{ id: 'live-x' }], past: [] } });
  app.editLive('live-x', 'upcoming');
  const editorHtml = app.elements.get('live-editor-body').innerHTML;
  assert.equal((editorHtml.match(/id="x-post-preview"/g) || []).length, 1);
  assert.match(editorHtml, /<label for="x-post-preview">X投稿プレビュー<\/label>/);
  assert.doesNotMatch(editorHtml, /x-parent-preview|x-reply-preview|親投稿プレビュー|返信用 詳細プレビュー/);
  assert.equal(typeof app.updateXPreviewInModal, 'function');
  assert.equal(typeof app.copyXAnnouncementFromModal, 'function');

  setLiveForm(app.elements);
  app.setSaveSpy();

  app.updateXPreviewInModal();
  const announcement = app.elements.get('x-post-preview').value;
  assert.equal(announcement, LiveOperations.buildXAnnouncementText({
    id: 'live-x',
    date: '2026-08-10',
    title: 'Night Shift',
    venue: '柴崎mod',
    openTime: '18:30',
    startTime: '19:00',
    ticket: '¥2,500 + 1D',
    notes: '再入場不可',
    performers: '松本一樹 / another band',
    description: '',
    link: 'https://instagram.com/night-shift',
    sourceText: 'raw booking copy',
    ticketUrl: '',
    reservationClosed: false,
    xComment: 'ぜひ来てください',
  }, 'ぜひ来てください', 'https://1212hp.com/live/detail/?liveId=live-x'));
  assert.match(announcement, /^2026\.8\.10\(月\) 柴崎mod/m);
  assert.match(announcement, /OPEN \/ 18:30 START \/ 19:00/);
  assert.match(announcement, /-act-\n松本一樹\nanother band/);

  const intent = new URL(app.buildXIntentUrlFromModal());
  assert.equal(intent.hostname, 'twitter.com');
  assert.equal(intent.searchParams.get('text'), announcement);
  await app.copyXAnnouncementFromModal();
  assert.deepEqual(app.clipboardWrites, [announcement]);
  assert.equal(app.getSaveCalls(), 0);
});

test('new Live requires an explicit save before X Intent or reservation operations', () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.addLive();
  const html = app.elements.get('live-editor-body').innerHTML;
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
  setLiveForm(app.elements, { 'edit-date': '2026-09-30', 'edit-venue': 'Moved venue', isPast: true });
  app.saveLiveItem();
  assert.match(filter.innerHTML, /2026\.09\.30\(Wed\) Moved venue/);
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

test('generic edit modal remains an accessible dialog with Escape close, initial focus, and focus restoration', async () => {
  assert.match(adminHtml, /id="modal"[^>]*role="dialog"/);
  assert.match(adminHtml, /id="modal"[^>]*aria-modal="true"/);
  assert.match(adminHtml, /id="modal"[^>]*aria-labelledby="modal-title"/);
  assert.match(adminHtml, /class="modal-close"[^>]*aria-label="閉じる"/);

  const app = loadAdminApp();
  app.setSiteData({
    news: [{ id: 'focus-news', date: '2026.08.10', title: 'Focus News', description: '', image: '', link: '', linkText: '' }],
  });
  const trigger = createElement('news-edit-trigger', app.document, 'button');
  trigger.focus();
  app.editNews('focus-news');
  assert.equal(app.document.activeElement?.id, 'edit-date');
  assert.equal(app.elements.get('modal').classList.contains('active'), true);

  await app.dispatchDocument('keydown', { key: 'Escape' });
  assert.equal(app.elements.get('modal').classList.contains('active'), false);
  assert.equal(app.getModalState().currentEditId, null);
  assert.equal(app.getModalState().currentEditType, null);
  assert.equal(app.getModalState().isNewItem, false);
  assert.equal(app.document.activeElement, trigger);
  assert.equal(trigger.focusCount, 2);
});

test('saving a rendered Live keeps its editor and selected replacement trigger after a category move', async () => {
  const app = loadAdminApp();
  const liveId = `focus-live-\"'\\danger`;
  app.setSiteData({
    live: {
      upcoming: [{ id: liveId, date: '2026.08.10', title: 'Moving Live', venue: 'Venue', description: '', image: '', link: '' }],
      past: [{ id: 'wrong-live', date: '2026.07.01', title: 'Wrong Live', venue: 'Elsewhere', description: '', image: '', link: '' }],
    },
  });
  app.setupLiveWorkspace();
  app.renderLive();
  const originalTrigger = app.elements.get('live-upcoming-list').children[0];
  originalTrigger.focus();

  await app.dispatchDocument('click', { target: originalTrigger, preventDefault() {} });
  assert.equal(app.document.activeElement?.id, 'edit-date');
  setLiveForm(app.elements, { isPast: true });
  await app.saveModal();

  const pastTriggers = app.elements.get('live-past-list').children;
  const replacementTrigger = pastTriggers.find((trigger) => trigger.dataset.liveId === liveId);
  const wrongTrigger = pastTriggers.find((trigger) => trigger.dataset.liveId === 'wrong-live');
  assert.equal(originalTrigger.isConnected, false, 'renderLive must replace the original trigger');
  assert.ok(replacementTrigger, 'the moved Live must have a newly rendered trigger');
  assert.notEqual(replacementTrigger, originalTrigger);
  assert.equal(app.elements.get('live-list-upcoming-panel').hidden, true);
  assert.equal(app.elements.get('live-list-past-panel').hidden, false);
  assert.equal(app.elements.get('live-list-past-tab').getAttribute('aria-selected'), 'true');
  assert.equal(app.elements.get('modal').classList.contains('active'), false);
  assert.match(app.elements.get('live-editor-body').innerHTML, /id="edit-sourceText"/);
  assert.equal(app.document.activeElement?.id, 'edit-date');
  assert.equal(replacementTrigger.getAttribute('aria-current'), 'true');
  assert.equal(replacementTrigger.classList.contains('is-selected'), true);
  assert.equal(wrongTrigger.focusCount, 0, 'focus must not jump to a different Live');
});

test('saving a new past Live activates its visible destination category', () => {
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [], past: [] } });
  app.setupLiveWorkspace();
  app.addLive();
  setLiveForm(app.elements, { isPast: true });

  app.saveLiveItem();

  assert.equal(app.elements.get('live-list-upcoming-panel').hidden, true);
  assert.equal(app.elements.get('live-list-past-panel').hidden, false);
  assert.equal(app.elements.get('live-list-past-tab').getAttribute('aria-selected'), 'true');
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
