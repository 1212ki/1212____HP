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
  const attributes = new Map();
  const listeners = new Map();
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
    addEventListener(type, listener) {
      const group = listeners.get(type) || [];
      group.push(listener);
      listeners.set(type, group);
    },
    async dispatch(type, event = {}) {
      for (const listener of listeners.get(type) || []) {
        await listener({ target: element, ...event });
      }
    },
    getAttribute(name) { return attributes.get(name) ?? null; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
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

function loadAdminApp(options = {}) {
  const elements = new Map();
  const modalOwnedIds = new Set();
  const modalOrder = [];
  const windowListeners = new Map();
  const pendingFileReaders = [];
  class MockFileReader {
    readAsDataURL(file) {
      if (options.deferFileReads) {
        pendingFileReaders.push({ file, reader: this });
        return;
      }
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
    querySelectorAll(selector) {
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
    root.querySelectorAll = () => order.filter((element) => (
      ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName)
    ));
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
      addEventListener(type, listener) {
        const group = windowListeners.get(type) || [];
        group.push(listener);
        windowListeners.set(type, group);
      },
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
	  editNews,
	  editDiscography,
	  closeModal,
	  saveLiveWorkspace,
	  requestLiveEditorTransition,
	  getImageFormHtml,
	  handleImageSelect,
	  clearImage,
  markLiveEditorDirty,
  setApiMode(value) { IS_API_MODE = value; },
  setApiFallbackReadOnly(value) {
    isApiFallbackReadOnly = value;
    applyApiFallbackReadOnlyState();
  },
  setSiteData(value) { siteData = value; },
  setUploadImageToApi(fn) { uploadImageToApi = fn; },
  setSaveFunction(fn) { saveData = fn; },
  ensureNoActiveImageUploads,
  getLiveEditorState() { return { dirty: Boolean(liveEditorDirty) }; },
  getGlobalState() { return { hasChanges: Boolean(hasChanges) }; },
  getSiteData() { return siteData; },
  getModalState() { return { currentEditId, currentEditType, isNewItem }; },
  setConfirm(fn) { confirm = fn; },
};`,
    context,
  );

  return {
    ...context.__adminTest,
    document,
    elements,
    async dispatchWindow(type, event = {}) {
      for (const listener of windowListeners.get(type) || []) await listener(event);
    },
    resolveFileRead(index, result) {
      const pending = pendingFileReaders[index];
      pending?.reader.onload?.({ target: { result } });
    },
    rejectFileRead(index) {
      pendingFileReaders[index]?.reader.onerror?.(new Error('file read failed'));
    },
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

test('API fallback disables and runtime-guards Live flyer select and clear mutations', () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  app.setSiteData({
    live: {
      upcoming: [{ id: 'fallback-image', date: '2026-08-10', title: 'Fallback', venue: 'Venue', image: 'assets/images/original.jpg' }],
      past: [],
    },
  });
  app.editLive('fallback-image', 'upcoming');
  const editorHtml = app.elements.get('live-editor-body').innerHTML;
  assert.match(editorHtml, /id="edit-image-select-btn"[^>]*data-live-editor-mutation/);
  assert.match(editorHtml, /id="edit-image-clear-btn"[^>]*data-live-editor-mutation/);

  const imageInput = app.elements.get('edit-image');
  const preview = app.elements.get('edit-image-preview-container');
  const originalPreview = preview.innerHTML;
  app.setApiFallbackReadOnly(true);

  assert.equal(app.elements.get('edit-image-select-btn').disabled, true);
  assert.equal(app.elements.get('edit-image-clear-btn').disabled, true);
  assert.equal(imageInput.value, 'assets/images/original.jpg');
  app.handleImageSelect({ files: [{ name: 'replacement.png' }] }, 'edit-image');
  assert.equal(imageInput.value, 'assets/images/original.jpg');
  assert.equal(preview.innerHTML, originalPreview);
  assert.equal(app.clearImage('edit-image'), false);
  assert.equal(imageInput.value, 'assets/images/original.jpg');
  assert.equal(preview.innerHTML, originalPreview);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');
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
        { id: 'live-a', date: '2026-08-10', title: '', venue: 'Venue A', description: '', image: 'assets/images/a.jpg', link: '' },
        { id: 'live-b', date: '2026-08-11', title: '', venue: 'Venue B', description: '', image: 'assets/images/b.jpg', link: '' },
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
  let confirmCalls = 0;
  app.setConfirm(() => {
    confirmCalls += 1;
    return false;
  });
  assert.equal(app.editLive('live-b', 'upcoming'), false);
  assert.equal(confirmCalls, 1);
  assert.equal(app.getModalState().currentEditId, 'live-a');
  assert.equal(app.elements.get('edit-image'), oldInput);
  assert.equal(app.ensureNoActiveImageUploads(), false);

  app.setConfirm(() => true);
  assert.equal(app.editLive('live-b', 'upcoming'), true);
  const replacementInput = app.elements.get('edit-image');
  const replacementPreview = app.elements.get('edit-image-preview-container');
  assert.notEqual(oldInput, replacementInput);
  assert.equal(app.ensureNoActiveImageUploads(), true);
  const cleanEvent = { prevented: 0, returnValue: undefined, preventDefault() { this.prevented += 1; } };
  await app.dispatchWindow('beforeunload', cleanEvent);
  assert.equal(cleanEvent.prevented, 0);

  app.setSaveFunction(async () => true);
  assert.equal(await app.saveLiveWorkspace(), true);

  upload.resolve({ url: 'https://cdn.example.com/live/a-final.png' });
  await flushAsync();

  assert.equal(replacementInput.value, 'assets/images/b.jpg');
  assert.doesNotMatch(replacementPreview.innerHTML, /a-final\.png/);
});

test('pending Live image upload protects beforeunload and settles into dirty state on success', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: { upcoming: [{ id: 'live-upload', date: '2026-08-10', title: 'Live', venue: 'Venue', image: 'assets/images/original.jpg' }], past: [] },
  });
  app.setApiMode(true);
  const upload = deferred();
  app.setUploadImageToApi(() => upload.promise);
  app.editLive('live-upload', 'upcoming');
  app.handleImageSelect({ files: [{ name: 'replacement.png' }] }, 'edit-image');

  const pendingEvent = { prevented: 0, returnValue: undefined, preventDefault() { this.prevented += 1; } };
  await app.dispatchWindow('beforeunload', pendingEvent);
  assert.equal(pendingEvent.prevented, 1);

  upload.resolve({ url: 'https://cdn.example.com/live/replacement.png' });
  await flushAsync();
  assert.equal(app.ensureNoActiveImageUploads(), true);
  assert.equal(app.getLiveEditorState().dirty, true);
});

test('failed Live image upload restores its original preview and preserves unrelated dirty input', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: { upcoming: [{ id: 'live-upload-fail', date: '2026-08-10', title: 'Live', venue: 'Venue', image: 'assets/images/original.jpg' }], past: [] },
  });
  app.setApiMode(true);
  const upload = deferred();
  app.setUploadImageToApi(() => upload.promise);
  app.editLive('live-upload-fail', 'upcoming');
  const originalInput = app.elements.get('edit-image').value;
  const originalPreview = app.elements.get('edit-image-preview-container').innerHTML;
  app.handleImageSelect({ files: [{ name: 'broken.png' }] }, 'edit-image');
  const venue = app.elements.get('edit-venue');
  venue.value = 'Edited while uploading';
  await venue.dispatch('input');

  upload.reject(new Error('upload failed'));
  await flushAsync();

  assert.equal(app.ensureNoActiveImageUploads(), true);
  assert.equal(app.elements.get('edit-image').value, originalInput);
  assert.equal(app.elements.get('edit-image-preview-container').innerHTML, originalPreview);
  assert.equal(venue.value, 'Edited while uploading');
  assert.equal(app.getLiveEditorState().dirty, true);
});

test('Live image overlapping same-ID uploads release the superseded request when latest settles', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: {
      upcoming: [{ id: 'live-a', date: '2026-08-10', title: '', venue: 'Venue', description: '', image: '', link: '' }],
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
  assert.equal(app.ensureNoActiveImageUploads(), true);
  app.setSaveFunction(async () => true);
  assert.equal(await app.saveLiveWorkspace(), true);
  const savedInput = app.elements.get('edit-image');
  const savedPreview = app.elements.get('edit-image-preview-container');
  const savedPreviewHtml = savedPreview.innerHTML;

  first.resolve({ url: 'https://cdn.example.com/live/first.png' });
  await flushAsync();
  assert.equal(app.ensureNoActiveImageUploads(), true);
  assert.equal(savedInput.value, 'https://cdn.example.com/live/second.png');
  assert.equal(savedPreview.innerHTML, savedPreviewHtml);
});

test('latest overlapping upload failure restores the first confirmed image baseline', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: { upcoming: [{ id: 'live-overlap-fail', date: '2026-08-10', title: 'Live', venue: 'Venue', image: 'assets/images/baseline.jpg' }], past: [] },
  });
  app.setApiMode(true);
  const first = deferred();
  const second = deferred();
  let uploadCount = 0;
  app.setUploadImageToApi(() => (++uploadCount === 1 ? first.promise : second.promise));
  app.editLive('live-overlap-fail', 'upcoming');
  const imageInput = app.elements.get('edit-image');
  const preview = app.elements.get('edit-image-preview-container');
  preview.innerHTML = '<a class="image-download-link" href="../assets/images/baseline.jpg" download="baseline.jpg">baseline</a>';
  const path = createElement('edit-image-path');
  path.textContent = 'Path baseline';
  app.elements.set('edit-image-path', path);
  const baseline = { input: imageInput.value, preview: preview.innerHTML, path: path.textContent };

  app.handleImageSelect({ files: [{ name: 'older.png' }] }, 'edit-image');
  app.handleImageSelect({ files: [{ name: 'latest.png' }] }, 'edit-image');
  second.reject(new Error('latest failed'));
  await flushAsync();

  assert.deepEqual({ input: imageInput.value, preview: preview.innerHTML, path: path.textContent }, baseline);
  assert.equal(app.getLiveEditorState().dirty, false);
  assert.equal(app.ensureNoActiveImageUploads(), true);

  first.resolve({ url: 'https://cdn.example.com/live/older.png' });
  await flushAsync();
  assert.deepEqual({ input: imageInput.value, preview: preview.innerHTML, path: path.textContent }, baseline);
});

test('Local Live image read blocks transition until confirmed discard releases its owner', async () => {
  const app = loadAdminApp({ deferFileReads: true });
  app.setSiteData({
    live: {
      upcoming: [
        { id: 'local-a', date: '2026-08-10', title: 'A', venue: 'Venue A', image: 'assets/images/a.jpg' },
        { id: 'local-b', date: '2026-08-11', title: 'B', venue: 'Venue B', image: 'assets/images/b.jpg' },
      ],
      past: [],
    },
  });
  app.editLive('local-a', 'upcoming');
  app.handleImageSelect({ files: [{ name: 'local-a-new.png' }] }, 'edit-image');

  app.setConfirm(() => false);
  assert.equal(app.editLive('local-b', 'upcoming'), false);
  assert.equal(app.getModalState().currentEditId, 'local-a');
  assert.equal(app.ensureNoActiveImageUploads(), false);

  app.setConfirm(() => true);
  assert.equal(app.editLive('local-b', 'upcoming'), true);
  const replacementInput = app.elements.get('edit-image');
  const replacementPreview = app.elements.get('edit-image-preview-container');
  assert.equal(app.ensureNoActiveImageUploads(), true);
  app.resolveFileRead(0, 'data:image/png;base64,STALE_LOCAL_A');
  assert.equal(replacementInput.value, 'assets/images/b.jpg');
  assert.doesNotMatch(replacementPreview.innerHTML, /STALE_LOCAL_A/);
});

test('Local Live image reads are latest-wins when FileReader callbacks resolve in reverse order', () => {
  const app = loadAdminApp({ deferFileReads: true });
  app.setSiteData({
    live: { upcoming: [{ id: 'local-overlap', date: '2026-08-10', title: 'Live', venue: 'Venue', image: 'assets/images/baseline.jpg' }], past: [] },
  });
  app.editLive('local-overlap', 'upcoming');
  const imageInput = app.elements.get('edit-image');
  const preview = app.elements.get('edit-image-preview-container');
  app.handleImageSelect({ files: [{ name: 'older.png' }] }, 'edit-image');
  app.handleImageSelect({ files: [{ name: 'latest.png' }] }, 'edit-image');
  assert.equal(app.ensureNoActiveImageUploads(), false);

  app.resolveFileRead(1, 'data:image/png;base64,LATEST_LOCAL');
  const latestValue = imageInput.value;
  const latestPreview = preview.innerHTML;
  assert.match(latestValue, /^assets\/images\/latest_\d{8}\.png$/);
  assert.match(latestPreview, /LATEST_LOCAL/);
  assert.equal(app.ensureNoActiveImageUploads(), true);

  app.resolveFileRead(0, 'data:image/png;base64,OLDER_LOCAL');
  assert.equal(imageInput.value, latestValue);
  assert.equal(preview.innerHTML, latestPreview);
});

test('generic modal close and replacement release abandoned image operations', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: { upcoming: [], past: [] },
    news: [{ id: 'news-image', date: '2026-08-10', title: 'News', description: '', image: 'assets/images/news.jpg', link: '', linkText: '' }],
    discography: { digital: [{ id: 'disco-image', title: 'Disco', releaseDate: '2026-08-10', description: '', image: 'assets/images/disco.jpg', link: '' }], demo: [] },
  });
  app.setApiMode(true);
  const first = deferred();
  const second = deferred();
  let uploadCount = 0;
  app.setUploadImageToApi(() => (++uploadCount === 1 ? first.promise : second.promise));

  app.editNews('news-image');
  app.handleImageSelect({ files: [{ name: 'news-close.png' }] }, 'edit-image');
  app.closeModal();
  assert.equal(app.ensureNoActiveImageUploads(), true);

  app.editNews('news-image');
  app.handleImageSelect({ files: [{ name: 'news-replace.png' }] }, 'edit-image');
  app.editDiscography('disco-image', 'digital');
  assert.equal(app.ensureNoActiveImageUploads(), true);
  const replacementInput = app.elements.get('edit-image');
  const replacementPreview = app.elements.get('edit-image-preview-container');

  first.resolve({ url: 'https://cdn.example.com/news-close-stale.png' });
  second.reject(new Error('news replacement stale'));
  await flushAsync();
  assert.equal(replacementInput.value, 'assets/images/disco.jpg');
  assert.doesNotMatch(replacementPreview.innerHTML, /news-close-stale/);
});

test('clearImage is latest across API and Local Live image operations', async (t) => {
  for (const mode of ['API', 'Local']) {
    await t.test(mode, async () => {
      const app = loadAdminApp({ deferFileReads: mode === 'Local' });
      app.setSiteData({
        live: { upcoming: [{ id: `clear-${mode}`, date: '2026-08-10', title: 'Live', venue: 'Venue', image: 'assets/images/baseline.jpg' }], past: [] },
      });
      const pending = deferred();
      if (mode === 'API') {
        app.setApiMode(true);
        app.setUploadImageToApi(() => pending.promise);
      }
      app.editLive(`clear-${mode}`, 'upcoming');
      app.handleImageSelect({ files: [{ name: `pending-${mode}.png` }] }, 'edit-image');
      app.clearImage('edit-image');

      assert.equal(app.elements.get('edit-image').value, '');
      assert.match(app.elements.get('edit-image-preview-container').innerHTML, /image-placeholder/);
      assert.equal(app.getLiveEditorState().dirty, true);
      assert.equal(app.ensureNoActiveImageUploads(), true);
      app.setSaveFunction(async () => true);
      assert.equal(await app.saveLiveWorkspace(), true);
      const savedInput = app.elements.get('edit-image');
      const savedPreview = app.elements.get('edit-image-preview-container');
      const savedPreviewHtml = savedPreview.innerHTML;

      if (mode === 'API') {
        pending.resolve({ url: 'https://cdn.example.com/must-stay-stale.png' });
        await flushAsync();
      } else {
        app.resolveFileRead(0, 'data:image/png;base64,MUST_STAY_STALE');
      }
      assert.equal(savedInput.value, '');
      assert.equal(savedPreview.innerHTML, savedPreviewHtml);
    });
  }
});

test('clearImage is latest for generic page images after API success and Local failure', async () => {
  const api = loadAdminApp();
  api.setSiteData({ live: { upcoming: [], past: [] }, profile: { image: 'assets/images/profile.jpg', text: '', links: [] } });
  const apiDom = setupImageSelectionDom(api.elements, 'profile-image');
  api.elements.get('profile-image').value = 'assets/images/profile.jpg';
  api.setApiMode(true);
  const pending = deferred();
  api.setUploadImageToApi(() => pending.promise);
  api.handleImageSelect({ files: [{ name: 'profile-api.png' }] }, 'profile-image');
  api.clearImage('profile-image');
  const apiCleared = { input: api.elements.get('profile-image').value, preview: apiDom.container.innerHTML };
  assert.equal(api.ensureNoActiveImageUploads(), true);
  assert.equal(api.getGlobalState().hasChanges, true);
  pending.resolve({ url: 'https://cdn.example.com/profile-stale.png' });
  await flushAsync();
  assert.deepEqual({ input: api.elements.get('profile-image').value, preview: apiDom.container.innerHTML }, apiCleared);

  const local = loadAdminApp({ deferFileReads: true });
  local.setSiteData({ live: { upcoming: [], past: [] }, profile: { image: 'assets/images/profile.jpg', text: '', links: [] } });
  const localDom = setupImageSelectionDom(local.elements, 'profile-image');
  local.elements.get('profile-image').value = 'assets/images/profile.jpg';
  local.handleImageSelect({ files: [{ name: 'profile-local.png' }] }, 'profile-image');
  local.clearImage('profile-image');
  const localCleared = { input: local.elements.get('profile-image').value, preview: localDom.container.innerHTML };
  assert.equal(local.ensureNoActiveImageUploads(), true);
  local.rejectFileRead(0);
  assert.deepEqual({ input: local.elements.get('profile-image').value, preview: localDom.container.innerHTML }, localCleared);
});

test('a new image selection does not release a parallel operation for another input', async () => {
  const app = loadAdminApp();
  app.setSiteData({
    live: { upcoming: [], past: [] },
    site: { heroImage: 'assets/images/hero.jpg' },
    profile: { image: 'assets/images/profile.jpg' },
  });
  app.setApiMode(true);
  const profileUpload = deferred();
  const heroUpload = deferred();
  let uploadCount = 0;
  app.setUploadImageToApi(() => (++uploadCount === 1 ? profileUpload.promise : heroUpload.promise));
  setupImageSelectionDom(app.elements, 'profile-image');
  setupImageSelectionDom(app.elements, 'site-hero-image');

  app.handleImageSelect({ files: [{ name: 'profile.png' }] }, 'profile-image');
  app.handleImageSelect({ files: [{ name: 'hero.png' }] }, 'site-hero-image');
  heroUpload.resolve({ url: 'https://cdn.example.com/hero.png' });
  await flushAsync();
  assert.equal(app.ensureNoActiveImageUploads(), false);
  assert.equal(app.elements.get('site-hero-image').value, 'https://cdn.example.com/hero.png');

  profileUpload.resolve({ url: 'https://cdn.example.com/profile.png' });
  await flushAsync();
  assert.equal(app.ensureNoActiveImageUploads(), true);
});
