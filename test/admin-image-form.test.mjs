import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = process.cwd();
const appJs = readFileSync(join(repoRoot, 'admin/app.js'), 'utf8');

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function createElement(id, ownerDocument = null, tagName = 'div') {
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
    innerHTML: '',
    parentElement: null,
    style: {},
    isConnected: true,
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      contains(name) { return classes.has(name); },
    },
    addEventListener() {},
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
    },
    removeChild(child) {
      this.children = this.children.filter((candidate) => candidate !== child);
      child.isConnected = false;
    },
    remove() { this.parentElement?.removeChild?.(this); },
    focus() { if (ownerDocument) ownerDocument.activeElement = this; },
    querySelector() {
      return null;
    },
  };
  Object.defineProperty(element, 'innerHTML', {
    configurable: true,
    get() { return html; },
    set(value) { html = String(value); },
  });
  return element;
}

function loadAdminApp() {
  const elements = new Map();
  const modalOwnedIds = new Set();
  const modalOrder = [];
  class MockFileReader {
    readAsDataURL() {
      this.onload?.({ target: { result: 'data:image/png;base64,TEST_IMAGE' } });
    }
  }

  const document = {
    activeElement: null,
    body: null,
    addEventListener() {},
    createElement(tag) {
      return createElement('', document, tag);
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelectorAll() { return []; },
    contains(element) { return Boolean(element?.isConnected); },
  };
  document.body = createElement('body', document, 'body');

  function addStatic(id, tagName = 'div') {
    const element = createElement(id, document, tagName);
    elements.set(id, element);
    return element;
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
        const valueAttr = attrs.match(/\bvalue="([^"]*)"/i);
        if (valueAttr) element.value = decodeHtml(valueAttr[1]);
        for (const dataAttr of attrs.matchAll(/\bdata-([\w-]+)="([^"]*)"/gi)) {
          const key = dataAttr[1].replace(/-([a-z])/g, (_whole, letter) => letter.toUpperCase());
          element.dataset[key] = decodeHtml(dataAttr[2]);
        }
        if (tagName.toLowerCase() === 'textarea') {
          const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const body = root._html.match(new RegExp(`<textarea\\b[^>]*id="${escapedId}"[^>]*>([\\s\\S]*?)<\\/textarea>`, 'i'))?.[1];
          element.value = decodeHtml(body || '');
        }
        elements.set(id, element);
        ownedIds.add(id);
        order.push(element);
      }
      for (const id of ownedIds) {
        if (!id.endsWith('-preview-container')) continue;
        const container = elements.get(id);
        const actions = createElement(`${id}-actions`, document);
        actions.querySelector = () => null;
        container.parentElement = {
          querySelector(selector) { return selector === '.image-actions' ? actions : null; },
        };
      }
      },
    });
    root.querySelector = () => order.find((element) => (
      !element.disabled && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName)
    )) || null;
  }

  const modalBody = addStatic('modal-body');
  installOwnedHtmlBehavior(modalBody, modalOwnedIds, modalOrder);

  addStatic('modal-title');
  addStatic('modal-overlay');
  addStatic('modal');
  addStatic('delete-btn', 'button');
  addStatic('toast');
  addStatic('saveBtn', 'button');
  addStatic('tickets-list');
  addStatic('tickets-live-filter', 'select');
  addStatic('tickets-status-filter', 'select');
  addStatic('live-upcoming-list');
  addStatic('live-past-list');
  addStatic('live-master-detail');
  addStatic('live-master-pane');
  addStatic('live-editor-pane');
  addStatic('live-editor-heading');
  addStatic('live-editor-save-status');
  addStatic('live-editor-back', 'button');
  const liveEditorBody = addStatic('live-editor-body');
  installOwnedHtmlBehavior(liveEditorBody, new Set(), []);

  const context = {
    Blob,
    FormData,
    Headers,
    URL,
    URLSearchParams,
    clearTimeout,
    confirm: () => false,
    console,
    document,
    FileReader: MockFileReader,
    location: { hostname: 'localhost' },
    localStorage: {
      getItem: () => '',
      removeItem() {},
      setItem() {},
    },
    prompt: () => '',
    setTimeout,
    structuredClone,
    window: {
      ADMIN_CONFIG: {},
      ADMIN_BUILD_ID: '',
      addEventListener() {},
      location: { href: 'https://1212hp.com/admin/', origin: 'https://1212hp.com' },
      open: () => null,
    },
  };
  context.globalThis = context;

  vm.runInNewContext(
    `${appJs}
globalThis.__adminTest = {
  addLive,
  editLive,
	  getImageFormHtml,
	  handleImageSelect,
	  clearImage,
  setApiMode(value) { IS_API_MODE = value; },
  setSiteData(value) { siteData = value; },
  setUploadImageToApi(fn) { uploadImageToApi = fn; },
  ensureNoActiveImageUploads,
  getModalState() { return { currentEditId, currentEditType, isNewItem }; },
};`,
    context,
  );

  return {
    ...context.__adminTest,
    document,
    elements,
    markMissing(id) {
      const element = elements.get(id);
      if (element) element.isConnected = false;
      elements.delete(id);
    },
  };
}

function setupImageSelectionDom(elements, inputId = 'edit-image', options = {}) {
  const container = elements.get(`${inputId}-preview-container`) || createElement(`${inputId}-preview-container`);
  elements.set(`${inputId}-preview-container`, container);
  container.dataset.downloadablePreview = options.downloadablePreview ? 'true' : 'false';

  const actions = createElement('image-actions');
  actions.querySelector = () => null;
  container.parentElement = {
    querySelector(selector) {
      return selector === '.image-actions' ? actions : null;
    },
  };

  elements.set(inputId, elements.get(inputId) || createElement(inputId));

  return { actions, container };
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

async function flushAsync() {
  await new Promise((resolve) => setImmediate(resolve));
}

test('default image forms keep the existing path display for non-live images', () => {
  const { getImageFormHtml } = loadAdminApp();

  const html = getImageFormHtml('assets/images/news.jpg');

  assert.match(html, /class="image-path-display"/);
  assert.match(html, /パス: assets\/images\/news\.jpg/);
  assert.doesNotMatch(html, /class="image-download-link"/);
});

test('default image path display escapes the current image path', () => {
  const { getImageFormHtml } = loadAdminApp();

  const html = getImageFormHtml('assets/images/flyer"><img src=x onerror=alert(1)>.jpg');

  assert.match(html, /パス: assets\/images\/flyer&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;\.jpg/);
  assert.doesNotMatch(html, /パス: .*<img src=x onerror=alert\(1\)>/);
});

test('downloadable live flyer forms hide path text and wrap the preview in a download link', () => {
  const { getImageFormHtml } = loadAdminApp();

  const html = getImageFormHtml('assets/images/flyer.jpg', 'edit-image', {
    downloadablePreview: true,
    showPath: false,
  });

  assert.doesNotMatch(html, /class="image-path-display"/);
  assert.doesNotMatch(html, /パス:/);
  assert.doesNotMatch(html, /URL:/);
  assert.match(html, /class="image-download-link"/);
  assert.match(html, /href="\.\.\/assets\/images\/flyer\.jpg"/);
  assert.match(html, /download="flyer\.jpg"/);
});

test('Live edit workspace uses a downloadable flyer preview without path or URL display', () => {
  const { editLive, elements, setSiteData } = loadAdminApp();
  setSiteData({
    live: {
      upcoming: [
        {
          id: 'live-1',
          date: '2026.05.02',
          title: 'test live',
          venue: 'test venue',
          description: 'open/start',
          image: 'assets/images/flyer.jpg',
          link: '',
        },
      ],
      past: [],
    },
  });

  editLive('live-1', 'upcoming');
  const html = elements.get('live-editor-body').innerHTML;

  assert.match(html, /class="image-download-link"/);
  assert.match(html, /href="\.\.\/assets\/images\/flyer\.jpg"/);
  assert.doesNotMatch(html, /class="image-path-display"/);
  assert.doesNotMatch(html, /パス:/);
  assert.doesNotMatch(html, /URL:/);
});

test('Live image selection keeps the selected flyer preview inside a download link', () => {
  const { elements, handleImageSelect, markMissing } = loadAdminApp();
  const { container } = setupImageSelectionDom(elements, 'edit-image', { downloadablePreview: true });
  markMissing('edit-image-path');

  handleImageSelect({ files: [{ name: 'new flyer.png' }] }, 'edit-image');

  assert.match(container.innerHTML, /class="image-download-link"/);
  assert.match(container.innerHTML, /href="data:image\/png;base64,TEST_IMAGE"/);
  assert.match(container.innerHTML, /download="new flyer\.png"/);
});

test('Live image clear marks the workspace editor dirty and disables the global save route', () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'clear-live', date: '2026-08-10', title: 'Clear', venue: 'Venue', image: 'assets/images/live.jpg' }],
      past: [],
    },
  });
  app.editLive('clear-live', 'upcoming');
  assert.equal(app.elements.get('saveBtn').disabled, false);

  app.clearImage('edit-image');

  assert.equal(app.elements.get('edit-image').value, '');
  assert.equal(app.elements.get('saveBtn').disabled, true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '未保存');
});

test('Live image API upload updates the flyer download link to the uploaded URL', async () => {
  const {
    elements,
    handleImageSelect,
    markMissing,
    setApiMode,
    setUploadImageToApi,
  } = loadAdminApp();
  const { container } = setupImageSelectionDom(elements, 'edit-image', { downloadablePreview: true });
  markMissing('edit-image-path');
  setApiMode(true);
  setUploadImageToApi(async () => ({ url: 'https://cdn.example.com/live/flyer-final.png?token=1' }));

  handleImageSelect({ files: [{ name: 'draft flyer.png' }] }, 'edit-image');
  await Promise.resolve();
  await Promise.resolve();

  assert.match(container.innerHTML, /class="image-download-link"/);
  assert.match(container.innerHTML, /href="https:\/\/cdn\.example\.com\/live\/flyer-final\.png\?token=1"/);
  assert.match(container.innerHTML, /download="flyer-final\.png"/);
});

test('a Live image upload cannot update a replacement workspace editor that reuses edit-image IDs', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'live-a', date: '', title: '', venue: '', description: '', image: 'assets/images/a.jpg', link: '' },
        { id: 'live-b', date: '', title: '', venue: '', description: '', image: 'assets/images/b.jpg', link: '' },
      ],
      past: [],
    },
  });
  app.setApiMode(true);
  const upload = deferred();
  app.setUploadImageToApi(() => upload.promise);

  app.editLive('live-a', 'upcoming');
  const oldInput = app.elements.get('edit-image');
  app.handleImageSelect({ files: [{ name: 'a-new.png' }] }, 'edit-image');
  app.editLive('live-b', 'upcoming');
  const replacementInput = app.elements.get('edit-image');
  const replacementPreview = app.elements.get('edit-image-preview-container');
  assert.notEqual(oldInput, replacementInput);

  upload.resolve({ url: 'https://cdn.example.com/live/a-final.png' });
  await flushAsync();

  assert.equal(replacementInput.value, 'assets/images/b.jpg');
  assert.doesNotMatch(replacementPreview.innerHTML, /a-final\.png/);
});

test('Live image overlapping same-ID uploads keep the save guard until both settle and older completion cannot win', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'live-a', date: '', title: '', venue: '', description: '', image: '', link: '' }],
      past: [],
    },
  });
  app.setApiMode(true);
  const first = deferred();
  const second = deferred();
  let uploadCount = 0;
  app.setUploadImageToApi(() => (++uploadCount === 1 ? first.promise : second.promise));
  app.editLive('live-a', 'upcoming');

  app.handleImageSelect({ files: [{ name: 'first.png' }] }, 'edit-image');
  app.handleImageSelect({ files: [{ name: 'second.png' }] }, 'edit-image');
  assert.equal(app.ensureNoActiveImageUploads(), false);

  second.resolve({ url: 'https://cdn.example.com/live/second.png' });
  await flushAsync();
  assert.equal(app.elements.get('edit-image').value, 'https://cdn.example.com/live/second.png');
  assert.equal(app.ensureNoActiveImageUploads(), false);

  first.resolve({ url: 'https://cdn.example.com/live/first.png' });
  await flushAsync();
  assert.equal(app.ensureNoActiveImageUploads(), true);
  assert.equal(app.elements.get('edit-image').value, 'https://cdn.example.com/live/second.png');
});
