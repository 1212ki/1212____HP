// Shared admin app harness (moved verbatim from admin-live-operations.test.mjs for Issue #46).
// It loads admin/app.js into a vm context with a minimal fake DOM. Behavior is unchanged by the move.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const repoRoot = process.cwd();
const adminJs = readFileSync(join(repoRoot, 'admin/app.js'), 'utf8');
const require = createRequire(import.meta.url);
const LiveOperations = require(join(repoRoot, 'assets/js/live-operations.js'));
const musicSource = readFileSync(join(repoRoot, 'assets/js/music-data.js'), 'utf8');

export function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function createElement(id, ownerDocument = null, tagName = 'div') {
  const listeners = new Map();
  const classes = new Set();
  const attributes = new Map();
  let html = '';
  let isHidden = false;
  const element = {
    id,
    tagName: tagName.toUpperCase(),
    children: [],
    dataset: {},
    value: '',
    checked: false,
    disabled: false,
    tabIndex: 0,
    textContent: '',
    parentElement: null,
    style: {},
    isConnected: true,
    focusCount: 0,
    focusAttemptCount: 0,
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
      if (name.startsWith('data-')) {
        const dataKey = name.slice(5).replace(/-([a-z])/g, (_whole, letter) => letter.toUpperCase());
        this.dataset[dataKey] = normalized;
      }
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    hasAttribute(name) {
      return attributes.has(name);
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
      this.focusAttemptCount += 1;
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
  Object.defineProperty(element, 'hidden', {
    configurable: true,
    get() { return isHidden; },
    set(value) {
      isHidden = Boolean(value);
      if (isHidden && ownerDocument?.activeElement) {
        let focusTarget = ownerDocument.activeElement;
        while (focusTarget) {
          if (focusTarget === element) {
            ownerDocument.activeElement = ownerDocument.body;
            break;
          }
          focusTarget = focusTarget.parentElement;
        }
      }
    },
  });
  return element;
}

export function createDomHarness(options = {}) {
  const elements = new Map();
  const documentListeners = new Map();
  const modalOwnedIds = new Set();
  const modalOrder = [];
  const modalOwnedElements = new Map();
  const liveEditorOwnedElements = new Map();
  const createdAnchors = [];
  const createdTextareas = [];
  const execCommandCalls = [];
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
      if (tag.toLowerCase() === 'textarea') createdTextareas.push(element);
      return element;
    },
    execCommand(command) {
      execCommandCalls.push(command);
      return options.execCommandResult ?? true;
    },
    getElementById(id) {
      // The Live editor precedes the generic modal in the real document. Keep
      // that lookup order when duplicate edit-* IDs expose an ownership bug.
      if (liveEditorOwnedElements.has(id) && modalOwnedElements.has(id)) {
        return liveEditorOwnedElements.get(id);
      }
      return elements.get(id) || null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-live-edit]') {
        return ['live-upcoming-list', 'live-past-list']
          .flatMap((id) => elements.get(id)?.children || [])
          .filter((element) => element.dataset?.liveEdit !== undefined);
      }
      const classSelector = selector.match(/^\.([\w-]+)$/);
      if (classSelector) {
        return [...elements.values()].filter((element) => element.classList.contains(classSelector[1]));
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

  function installOwnedHtmlBehavior(root, ownedIds, order, ownedElements = new Map()) {
    Object.defineProperty(root, 'innerHTML', {
      configurable: true,
      get() { return root._html || ''; },
      set(value) {
        for (const id of ownedIds) {
          const prior = ownedElements.get(id);
          if (prior) prior.isConnected = false;
          if (elements.get(id) === prior) elements.delete(id);
          ownedElements.delete(id);
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
          const tabindexAttr = attrs.match(/\btabindex="(-?\d+)"/i)?.[1];
          if (tabindexAttr !== undefined) element.setAttribute('tabindex', tabindexAttr);
          if (tagName.toLowerCase() === 'textarea') {
            const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const body = root._html.match(new RegExp(`<textarea\\b[^>]*id="${escapedId}"[^>]*>([\\s\\S]*?)<\\/textarea>`, 'i'))?.[1];
            element.value = decodeHtml(body || '');
          }
          if (tagName.toLowerCase() === 'select') {
            installSelectHtmlBehavior(element);
            const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            element.innerHTML = root._html.match(new RegExp(`<select\\b[^>]*id="${escapedId}"[^>]*>([\\s\\S]*?)<\\/select>`, 'i'))?.[1] || '';
          }
          // Issue #46: a container whose content the app renders later (one reservation) registers the ids inside it too.
          if (id === 'live-reservation-detail') installOwnedHtmlBehavior(element, new Set(), [], new Map());
          elements.set(id, element);
          ownedElements.set(id, element);
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
    root.querySelectorAll = (selector) => {
      if (
        selector === 'input, textarea, select, button'
        || selector === 'button, input, textarea, select'
      ) {
        return order.filter((element) => ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName));
      }
      if (selector === 'input:not([readonly]), textarea:not([readonly]), select, .btn-image-select, .btn-image-clear') {
        return order.filter((element) => (
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
          || element.classList.contains('btn-image-select')
          || element.classList.contains('btn-image-clear')
        ));
      }
      return [];
    };
  }

  const modalBody = addStatic('modal-body');
  installOwnedHtmlBehavior(modalBody, modalOwnedIds, modalOrder, modalOwnedElements);

  addStatic('modal-title');
  addStatic('modal-overlay');
  addStatic('modal');
  const deleteButton = addStatic('delete-btn', 'button');
  deleteButton.dataset.adminMutation = '';
  addStatic('toast');
  // Issue #46 stage 7: #app and its children, so that a test can see what the confirmation surface makes inert.
  const appRoot = addStatic('app');
  const globalSaveButton = addStatic('saveBtn', 'button');
  globalSaveButton.dataset.adminMutation = '';
  addStatic('modeBadge');
  addStatic('connectionBanner');
  addStatic('news-list');
  const newsAddButton = addStatic('news-add-btn', 'button');
  newsAddButton.dataset.adminMutation = '';
  const siteGlobalTab = addStatic('global-tab-site', 'button');
  siteGlobalTab.dataset.tab = 'site';
  siteGlobalTab.classList.add('tab-btn');
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
  const siteGlobalPanel = addStatic('site-tab', 'section');
  siteGlobalPanel.classList.add('tab-content');
  addStatic('tickets-list');
  const liveFilter = addStatic('tickets-live-filter', 'select');
  installSelectHtmlBehavior(liveFilter);
  const statusFilter = addStatic('tickets-status-filter', 'select');
  statusFilter.value = 'pending';
  const liveWorkspace = addStatic('live-workspace');
  liveWorkspace.parentElement = liveGlobalPanel;
  const liveAddButton = addStatic('live-add-btn', 'button');
  liveAddButton.dataset.adminMutation = '';
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
  const liveSummaryNote = addStatic('live-summary-note', 'p');
  liveSummaryNote.parentElement = livePagePrimary;
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
  installOwnedHtmlBehavior(liveEditorBody, liveEditorOwnedIds, liveEditorOrder, liveEditorOwnedElements);
  upcomingPanel.parentElement = livePagePrimary;
  pastPanel.parentElement = livePagePrimary;
  const liveTicketSettingsOpen = addStatic('live-ticket-settings-open', 'button');
  liveTicketSettingsOpen.parentElement = livePagePrimary;
  const liveTicketSettingsPanel = addStatic('live-ticket-settings-panel', 'section');
  liveTicketSettingsPanel.parentElement = livePagePanel;
  const liveTicketSettingsClose = addStatic('live-ticket-settings-close', 'button');
  liveTicketSettingsClose.parentElement = liveTicketSettingsPanel;
  [
    ['ticket-complete-text', 'textarea'],
    ['ticket-field-quantity', 'input'],
    ['ticket-field-message', 'input'],
    ['ticket-field-label-quantity', 'input'],
    ['ticket-field-label-message', 'input'],
    ['ticket-field-placeholder-message', 'input'],
    ['ticket-field-submit-label', 'input'],
  ].forEach(([id, tagName]) => {
    const field = addStatic(id, tagName);
    field.parentElement = liveTicketSettingsPanel;
    field.dataset.adminMutation = '';
  });
  // Issue #46: the confirmation surface and the Ticket Page settings status / actions.
  const liveDialogOverlay = addStatic('live-dialog-overlay');
  liveDialogOverlay.hidden = true;
  appRoot.children = [liveGlobalPanel, newsGlobalPanel, siteGlobalPanel, globalSaveButton, liveDialogOverlay, elements.get('toast')];
  const liveDialogRoot = addStatic('live-dialog');
  liveDialogRoot.parentElement = liveDialogOverlay;
  installOwnedHtmlBehavior(liveDialogRoot, new Set(), [], new Map());
  [['ticket-settings-status', 'p'], ['ticket-settings-error', 'p']].forEach(([id, tagName]) => {
    addStatic(id, tagName).parentElement = liveTicketSettingsPanel;
  });
  const ticketSettingsActions = addStatic('ticket-settings-actions');
  ticketSettingsActions.hidden = true;
  ticketSettingsActions.parentElement = liveTicketSettingsPanel;
  const ticketSettingsSave = addStatic('ticket-settings-save-btn', 'button');
  ticketSettingsSave.dataset.adminMutation = '';
  ticketSettingsSave.parentElement = ticketSettingsActions;
  // Issue #46 stage 6: the 予約管理 (cross-Live) panel: list → one reservation.
  const ticketsListView = addStatic('tickets-list-view');
  ticketsListView.parentElement = liveReservationsPanel;
  ticketsListView.dataset.ticketsView = 'list';
  const ticketsDetailView = addStatic('tickets-detail-view');
  ticketsDetailView.parentElement = liveReservationsPanel;
  ticketsDetailView.hidden = true;
  const ticketsDetail = addStatic('tickets-detail');
  ticketsDetail.parentElement = ticketsDetailView;
  installOwnedHtmlBehavior(ticketsDetail, new Set(), [], new Map());
  addStatic('tickets-detail-back', 'button').parentElement = ticketsDetailView;
  // Issue #46 stage 7: the panel that holds the 予約管理 list and the one reservation opened beside it.
  addStatic('live-reservations-panel').parentElement = liveReservationsPanel;
  addStatic('tickets-csv-btn', 'button').parentElement = ticketsListView;
  const upcomingList = addStatic('live-upcoming-list');
  upcomingList.parentElement = upcomingPanel;
  installLiveListHtmlBehavior(upcomingList);
  const pastList = addStatic('live-past-list');
  pastList.parentElement = pastPanel;
  installLiveListHtmlBehavior(pastList);

  const siteHeroForm = addStatic('site-hero-image-form');
  installOwnedHtmlBehavior(siteHeroForm, new Set(), [], new Map());
  [
    ['site-featured-release-id', 'select'],
    ['site-link-bandcamp', 'input'],
    ['site-link-youtube', 'input'],
    ['site-link-x', 'input'],
    ['site-link-instagram', 'input'],
    ['site-link-note', 'input'],
    ['site-footer-text', 'input'],
    ['contact-intro-text', 'textarea'],
    ['contact-form-action', 'input'],
    ['youtube-channel-url', 'input'],
    ['profile-text', 'textarea'],
  ].forEach(([id, tagName]) => {
    const control = addStatic(id, tagName);
    control.dataset.adminMutation = '';
    if (tagName === 'select') installSelectHtmlBehavior(control);
  });
  [
    'youtube-add-musicVideos-btn',
    'youtube-add-musicVideos-secondary-btn',
    'youtube-add-liveMovies-btn',
    'youtube-add-demos-btn',
    'discography-add-btn',
    'profile-link-add-btn',
    'modal-save-btn',
  ].forEach((id) => {
    const control = addStatic(id, 'button');
    control.dataset.adminMutation = '';
  });
  ['youtube-musicVideos-list', 'youtube-liveMovies-list', 'youtube-demos-list', 'disc-digital-list', 'disc-demo-list']
    .forEach((id) => addStatic(id));
  const profileImageForm = addStatic('profile-image-form');
  installOwnedHtmlBehavior(profileImageForm, new Set(), [], new Map());
  const profileLinksList = addStatic('profile-links-list');
  installOwnedHtmlBehavior(profileLinksList, new Set(), [], new Map());

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
    createdTextareas,
    document,
    elements,
    execCommandCalls,
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

export function loadAdminApp(options = {}) {
  const dom = createDomHarness(options);
  const { document, elements } = dom;
  const fetchCalls = [];
  const networkFetchCalls = [];
  const clipboardWrites = [];
  const openedUrls = [];
  const windowListeners = new Map();
  // Issue #46 stage 7: `wide: true` makes the media query (min-width: 900px) match; app.setWide(value) flips it and fires "change".
  const media = { wide: Boolean(options.wide), listeners: [] };

  const context = {
    Blob,
    FormData,
    Headers,
    URL: dom.TestURL,
    URLSearchParams,
    clearTimeout,
    confirm: () => false,
    console: options.console || console,
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
    navigator: {
      clipboard: {
        async writeText(value) {
          clipboardWrites.push(value);
          if (options.clipboardWrite) await options.clipboardWrite(value);
        },
      },
    },
    prompt: () => '',
    setTimeout,
    structuredClone,
    window: {
      ADMIN_CONFIG: options.adminConfig || {},
      ADMIN_BUILD_ID: options.buildId || '',
      LiveOperations: options.liveOperations || LiveOperations,
      addEventListener(type, listener) {
        const group = windowListeners.get(type) || [];
        group.push(listener);
        windowListeners.set(type, group);
      },
      location: { href: 'https://1212hp.com/admin/', origin: 'https://1212hp.com' },
      matchMedia(query) {
        return {
          media: String(query),
          get matches() { return /min-width:\s*900px/.test(String(query)) ? media.wide : false; },
          addEventListener(type, listener) { if (type === 'change') media.listeners.push(listener); },
          removeEventListener() {},
        };
      },
      open(url) { openedUrls.push(url); return null; },
      prompt: () => options.promptValue ?? '',
    },
  };
  context.__adminSaveCalls = 0;
  context.globalThis = context;

  vm.runInNewContext(musicSource, context);
  context.window.MusicData = context.MusicData || context.window.MusicData;
  // Issue #46 stage 7: `adminSource` loads another version of admin/app.js (the base commit's) to compare behavior.
  vm.runInNewContext(`${options.adminSource ?? adminJs}
	globalThis.__adminLiveTest = {
	  applyApiFallbackReadOnlyState,
	  renderAll,
	  renderSiteSettings,
	  renderYouTube,
	  renderDiscography,
	  renderProfile,
	  addNews,
	  editNews,
	  addYouTubeVideo,
	  editYouTubeVideo,
	  addDiscography,
	  editDiscography,
	  addProfileLink,
	  updateProfileLink,
	  deleteProfileLink,
	  handleImageSelect,
	  clearImage,
	  addLive,
	  editLive,
	  closeLiveEditor: typeof closeLiveEditor === 'function' ? closeLiveEditor : null,
	  saveLiveWorkspace: typeof saveLiveWorkspace === 'function' ? saveLiveWorkspace : null,
	  deleteLiveFromWorkspace: typeof deleteLiveFromWorkspace === 'function' ? deleteLiveFromWorkspace : null,
	  requestLiveEditorTransition: typeof requestLiveEditorTransition === 'function' ? requestLiveEditorTransition : null,
  handleLiveSourceParse,
  saveLiveItem,
  saveToApi,
  updateXPreviewInModal: typeof updateXPreviewInModal === 'function' ? updateXPreviewInModal : null,
  buildXIntentUrlFromModal,
  copyXAnnouncementFromModal: typeof copyXAnnouncementFromModal === 'function' ? copyXAnnouncementFromModal : null,
  copyLiveLinkFromModal: typeof copyLiveLinkFromModal === 'function' ? copyLiveLinkFromModal : null,
  loadLiveReservations,
  submitManualReservation,
  calculateActiveReservationTotals,
  renderReservationRow: typeof renderReservationRow === 'function' ? renderReservationRow : null,
  markTicketStatus,
  downloadTicketsCsv,
  renderLiveReservationLedger,
  loadTickets,
  renderTicketsUi,
  renderLive,
  saveData,
  saveModal,
  saveDiscographyItem,
  getHasChanges() { return hasChanges; },
  setSaving(value) { isSaving = value; },
  setSyntheticImageUpload(value) { if (value) activeImageUploads.add("synthetic-upload"); else activeImageUploads.clear(); },
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
  normalizeSiteData,
  renderTicketSettings,
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
  setSaveFunction(fn) { saveData = fn; },
	  invokeSaveData(options) { return saveData(options); },
	  setApiFallbackReadOnly(value) {
	    isApiFallbackReadOnly = Boolean(value);
	    if (isApiFallbackReadOnly) applyApiFallbackReadOnlyState();
	  },
  setConfirm(fn) { confirm = fn; },
  // Issue #46
  openLiveDialog: typeof openLiveDialog === 'function' ? openLiveDialog : null,
  closeLiveDialog: typeof closeLiveDialog === 'function' ? closeLiveDialog : null,
  snapshotLiveEditor: typeof snapshotLiveEditor === 'function' ? snapshotLiveEditor : null,
  recomputeLiveEditorDirty: typeof recomputeLiveEditorDirty === 'function' ? recomputeLiveEditorDirty : null,
  saveScoped: typeof saveScoped === 'function' ? saveScoped : null,
  applyLiveSlice: typeof applyLiveSlice === 'function' ? applyLiveSlice : null,
  applyDeleteSlice: typeof applyDeleteSlice === 'function' ? applyDeleteSlice : null,
  applyTicketSlice: typeof applyTicketSlice === 'function' ? applyTicketSlice : null,
  saveTicketSettings: typeof saveTicketSettings === 'function' ? saveTicketSettings : null,
  recomputeTicketDirty: typeof recomputeTicketDirty === 'function' ? recomputeTicketDirty : null,
  isTicketSettingsDirty: typeof isTicketSettingsDirty === 'function' ? isTicketSettingsDirty : null,
  getSavedBaseline: typeof getSavedBaseline === 'function' ? getSavedBaseline : null,
  setSavedBaseline(value) { releaseDateBaseline = value; },
  // A Live / delete / Ticket settings save is a scoped PUT (saveScoped -> saveToApi), no longer saveData.
  setSaveToApi(fn) { saveToApi = fn; },
  markChanged,
  // Issue #46 stages 5-6
  setFileReader(value) { FileReader = value; },
  setLiveEditorScreen: typeof setLiveEditorScreen === 'function' ? setLiveEditorScreen : null,
  getLiveEditorScreen() { return typeof liveEditorScreen === 'string' ? liveEditorScreen : null; },
  setLiveReservationView: typeof setLiveReservationView === 'function' ? setLiveReservationView : null,
  renderReservationDetail: typeof renderReservationDetail === 'function' ? renderReservationDetail : null,
  handleLiveEditorBack: typeof handleLiveEditorBack === 'function' ? handleLiveEditorBack : null,
  handleReservationViewAction: typeof handleReservationViewAction === 'function' ? handleReservationViewAction : null,
  openReservationDetail: typeof openReservationDetail === 'function' ? openReservationDetail : null,
  closeCrossReservationDetail: typeof closeCrossReservationDetail === 'function' ? closeCrossReservationDetail : null,
  setReservationFilter: typeof setReservationFilter === 'function' ? setReservationFilter : null,
  getReservationViewState() {
    return typeof liveReservationView === 'string'
      ? { view: liveReservationView, detailId: liveReservationDetailId, filter: liveReservationFilter, crossDetailId: crossReservationDetailId }
      : null;
  },
  // Issue #46 stage 4
  loadReservationSummary: typeof loadReservationSummary === 'function' ? loadReservationSummary : null,
  renderLiveRow: typeof renderLiveRow === 'function' ? renderLiveRow : null,
  getReservationSummary() { return typeof reservationSummary === 'object' ? reservationSummary : null; },
  // Issue #46 stage 7
  syncGlobalSaveButton: typeof syncGlobalSaveButton === 'function' ? syncGlobalSaveButton : null,
  syncLiveLayoutMode: typeof syncLiveLayoutMode === 'function' ? syncLiveLayoutMode : null,
  syncLiveEditorFooter: typeof syncLiveEditorFooter === 'function' ? syncLiveEditorFooter : null,
  syncCrossReservationView: typeof syncCrossReservationView === 'function' ? syncCrossReservationView : null,
  isWideLiveLayout: typeof isWideLiveLayout === 'function' ? isWideLiveLayout : null,
  renderReservationTableHead: typeof renderReservationTableHead === 'function' ? renderReservationTableHead : null,
  getActiveGlobalTab() { return typeof activeGlobalTab === 'string' ? activeGlobalTab : null; },
  getTicketSettingsState() {
    return typeof ticketSettingsBaseline === 'string'
      ? { draft: ticketSettingsDraft, baseline: ticketSettingsBaseline, saving: ticketSettingsSaving }
      : null;
  },
};`, context);

  return {
    ...context.__adminLiveTest,
    ...dom,
    setWide(value) {
      media.wide = Boolean(value);
      for (const listener of media.listeners) listener({ matches: media.wide });
    },
    clipboardWrites,
    fetchCalls,
    networkFetchCalls,
    openedUrls,
    async dispatchWindow(type, event = {}) {
      for (const listener of windowListeners.get(type) || []) {
        await listener(event);
      }
      return event;
    },
    getSaveCalls: () => context.__adminSaveCalls,
    useAdminFetch(fn) {
      context.__adminLiveTest.setAdminFetch(async (path, options = {}, policy = {}) => {
        fetchCalls.push({ path, options, policy });
        return fn(path, options, policy);
      });
    },
  };
}

export function setLiveForm(elements, values = {}) {
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

export const LIVE_SOURCE_INTAKE_FIELD_IDS = [
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

export function snapshotLiveSourceIntake(elements) {
  return Object.fromEntries(LIVE_SOURCE_INTAKE_FIELD_IDS.map((id) => [id, elements.get(id)?.value]));
}

export function assertLiveSourceIntakeUnchanged(elements, snapshot) {
  assert.deepEqual(snapshotLiveSourceIntake(elements), snapshot);
}

export function validLiveSourceIntakeDraft(overrides = {}) {
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

// Issue #46: unsaved changes and deletes are confirmed on a surface (not window.confirm). Answer it with a named button.
export async function answerLiveDialog(app, actionId) {
  await flushAsync();
  const button = app.elements.get(`live-dialog-action-${actionId}`);
  assert.ok(button, `the confirmation surface has a "${actionId}" button`);
  await button.dispatch('click');
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

export function jsonResponse(payload, options = {}) {
  const { ok = true, status = ok ? 200 : 400 } = options;
  return {
    ok,
    status,
    async json() { return payload; },
  };
}

export async function flushAsync() {
  await new Promise((resolve) => setImmediate(resolve));
}
