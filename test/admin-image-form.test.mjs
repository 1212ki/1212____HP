import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = process.cwd();
const appJs = readFileSync(join(repoRoot, 'admin/app.js'), 'utf8');

function createElement(id) {
  return {
    id,
    children: [],
    dataset: {},
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    parentElement: null,
    style: {},
    classList: {
      add() {},
      remove() {},
    },
    addEventListener() {},
    appendChild(child) {
      this.children.push(child);
    },
    querySelector() {
      return null;
    },
  };
}

function loadAdminApp() {
  const elements = new Map();
  const missingElements = new Set();
  class MockFileReader {
    readAsDataURL() {
      this.onload?.({ target: { result: 'data:image/png;base64,TEST_IMAGE' } });
    }
  }

  const document = {
    body: {
      style: {},
      appendChild() {},
      removeChild() {},
    },
    addEventListener() {},
    createElement(tag) {
      return createElement(tag);
    },
    getElementById(id) {
      if (missingElements.has(id)) return null;
      if (!elements.has(id)) elements.set(id, createElement(id));
      return elements.get(id);
    },
  };

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
  setApiMode(value) { IS_API_MODE = value; },
  setSiteData(value) { siteData = value; },
  setUploadImageToApi(fn) { uploadImageToApi = fn; },
};`,
    context,
  );

  return {
    ...context.__adminTest,
    elements,
    markMissing(id) {
      missingElements.add(id);
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

test('Live edit modal uses a downloadable flyer preview without path or URL display', () => {
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
  const html = elements.get('modal-body').innerHTML;

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

test('Live API upload updates the flyer download link to the uploaded URL', async () => {
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
