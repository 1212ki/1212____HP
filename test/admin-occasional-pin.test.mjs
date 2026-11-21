// Issue #47 stage 1: T47-PIN.
// These tests were written against the admin app as it was before #47 changed anything (commit 1f3a1cd, read with
// `git show`, never from the working tree), and are GREEN there. They fix what a save must keep sending while #47 moves
// the saving to the edit surfaces: the PUT body (as a string), the category an item is saved into, the order, and the
// set of keys.
//   (a) what each modal "更新" sends        (b) deletion and the references it clears
//   (c) what the header 保存 sends          (d) one item opened and changed: the other values and keys
//   (e) the #41 reference reconciliation   (f) image selection and saving, API and Local
// Every value comes from test/fixtures/admin-occasional-states.json and is synthetic. Where the plan's assumption and the
// code differ, the test fixes the code's behavior and says so ("PIN-NOTE").
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  ADMIN_APP_BASE_COMMIT_47,
  flushAsync,
  jsonResponse,
  loadBaseAdminApp,
  readBaseAdminSource,
} from './support/admin-app-harness.mjs';

const repoRoot = process.cwd();
const fixture = JSON.parse(readFileSync(join(repoRoot, 'test/fixtures/admin-occasional-states.json'), 'utf8'));

// The order of the top-level keys of every PUT body (DEFAULT_SITE_DATA's order, which normalizeSiteData keeps).
const TOP_KEYS = ['news', 'live', 'discography', 'profile', 'youtube', 'site', 'ticket', 'contact'];
const NEWS_KEYS = ['id', 'date', 'title', 'description', 'image', 'link', 'linkText'];
const RELEASE_KEYS = ['id', 'title', 'releaseDate', 'description', 'image', 'link', 'releaseType', 'playbackVideoId'];
const VIDEO_KEYS = ['id', 'title', 'youtubeId'];
const PUT_PATH = '/api/admin/site-data';

// admin/app.js runs in a vm context, so its objects have another realm's prototypes; compare plain copies.
const plain = (value) => JSON.parse(JSON.stringify(value));
const clone = plain;
const ordered = (data) => Object.fromEntries(TOP_KEYS.map((key) => [key, data[key]]));
const asBody = (data) => JSON.stringify(ordered(data));
const asExport = (data) => JSON.stringify(ordered(data), null, 2);

function dataFor(variant = null) {
  const data = clone(fixture.data);
  if (variant) Object.assign(data, clone(fixture.variants[variant]));
  return data;
}

// Loads the base admin app, as production does (loadData → renderAll), with a recording admin fetch.
async function openApp({ variant = null, api = true, data = dataFor(variant), putStatus = 200, putPayload = { ok: true }, upload = null } = {}) {
  const app = loadBaseAdminApp({ networkFetch: async () => jsonResponse(clone(data)) });
  app.setApiMode(api);
  const puts = [];
  app.useAdminFetch(async (path, options = {}) => {
    if (options.method === 'PUT') {
      puts.push({ path, body: options.body, bodyType: typeof options.body });
      return putStatus === 200 ? jsonResponse(putPayload) : jsonResponse(putPayload, { ok: false, status: putStatus });
    }
    if (path === '/api/admin/upload-image' && options.method === 'POST') {
      if (!upload) return jsonResponse({ error: 'no upload expected' }, { ok: false, status: 400 });
      return upload();
    }
    return jsonResponse(path === PUT_PATH ? { data: clone(data) } : { tickets: [] });
  });
  await app.loadData();
  app.renderAll();
  return { app, puts, data };
}

const fill = (app, values) => {
  for (const [key, value] of Object.entries(values)) app.elements.get(`edit-${key}`).value = value;
};
const toast = (app) => app.elements.get('toast').textContent;
const modalOpen = (app) => app.elements.get('modal').classList.contains('active');
const keys = (item) => Object.keys(item);

function onePut(puts) {
  assert.equal(puts.length, 1, 'exactly one PUT');
  assert.equal(puts[0].path, PUT_PATH);
  assert.equal(puts[0].bodyType, 'string', 'the body is a JSON string');
  return puts[0].body;
}

// ---- the harness really reads the base commit ------------------------------------------------------
test('T47-PIN the pin tests read the app of the base commit (1f3a1cd), not the working tree', () => {
  assert.equal(ADMIN_APP_BASE_COMMIT_47, '1f3a1cdcdf9852b3f2cabaa2978352572e0b9d82');
  const source = readBaseAdminSource();
  assert.equal(createHash('sha256').update(source).digest('hex'), 'ef01d1320e0b60569b72c46503e9e38d393cd04fca837177817de18a0d3a40af');
  assert.match(source, /function saveNewsItem\(\)/);
  assert.match(source, /function saveData\(options = \{\}\)|async function saveData\(options = \{\}\)/);
});

test('T47-PIN the fixture is the base the expectations are built from', () => {
  assert.equal(fixture.data.news.length, 6);
  assert.deepEqual(new Set(fixture.data.news.map((item) => keys(item).join())), new Set([NEWS_KEYS.join()]));
  assert.equal(fixture.data.discography.digital.length + fixture.data.discography.demo.length, 4);
  assert.equal(fixture.data.youtube.musicVideos.length + fixture.data.youtube.liveMovies.length + fixture.data.youtube.demos.length, 5);
  for (const item of [...fixture.data.discography.digital, ...fixture.data.discography.demo]) assert.deepEqual(keys(item), RELEASE_KEYS);
  assert.deepEqual(Object.keys(fixture.scenarios), [
    'base', 'empty-lists', 'legacy-shapes', 'long-values', 'api-fallback', 'local-mode', 'save-fail', 'delete-fail', 'numeric-ids',
  ]);
});

// ======================================================================================================
// (a) what each modal 更新 sends
// ======================================================================================================
test('T47-PIN (a) News 更新 (existing): the item is replaced in place by exactly the seven keys of the form, and the PUT is the whole data', async () => {
  const { app, puts } = await openApp();
  assert.equal(app.editNews('fx-news-2'), true);
  fill(app, {
    date: '2026/11/13(Fri.) 変えた語',
    title: '変更後の "題" です',
    description: '変更後の説明\n2行目\n\n4行目',
    image: 'assets/images/fixture-news-new.png',
    link: 'https://example.test/news/changed',
    linkText: '変更後のテキスト',
  });

  assert.equal(await app.saveModal(), true);

  const expected = dataFor();
  expected.news[1] = {
    id: 'fx-news-2',
    date: '2026/11/13(Fri.) 変えた語',
    title: '変更後の "題" です',
    description: '変更後の説明\n2行目\n\n4行目',
    image: 'assets/images/fixture-news-new.png',
    link: 'https://example.test/news/changed',
    linkText: '変更後のテキスト',
  };
  const body = onePut(puts);
  assert.equal(body, asBody(expected));
  assert.deepEqual(keys(JSON.parse(body).news[1]), NEWS_KEYS, 'seven keys, in this order');
  assert.deepEqual(JSON.parse(body).news.map((item) => item.id), fixture.data.news.map((item) => item.id), 'the same position');
  assert.equal(modalOpen(app), false);
  assert.equal(app.getHasChanges(), false, 'saved');
  assert.equal(toast(app), '保存しました');
});

test('T47-PIN (a) News 更新 (new): a new item goes to the head with an id news-<time> and the default link text', async () => {
  const { app, puts } = await openApp();
  assert.equal(app.addNews(), true);
  const id = app.getModalState().currentEditId;
  assert.match(id, /^news-\d+$/);
  assert.equal(app.getModalState().isNewItem, true);
  assert.equal(app.elements.get('edit-linkText').value, 'view...', 'the default link text of a new News');
  fill(app, { date: '2026/12/1(Tue.)', title: '架空の新しいお知らせ', description: '架空の説明' });

  assert.equal(await app.saveModal(), true);

  const expected = dataFor();
  expected.news.unshift({ id, date: '2026/12/1(Tue.)', title: '架空の新しいお知らせ', description: '架空の説明', image: '', link: '', linkText: 'view...' });
  assert.equal(onePut(puts), asBody(expected));
  assert.deepEqual(JSON.parse(puts[0].body).news.slice(1).map((item) => item.id), fixture.data.news.map((item) => item.id));
});

test('T47-PIN (a) a release 更新 (existing, same category): every key of the form is sent and the release moves to the head of its category', async () => {
  const { app, puts } = await openApp();
  assert.equal(app.editDiscography('fx-release-b', 'digital'), true);
  fill(app, {
    title: '架空の作品 B 改',
    description: '1. 曲A\n2. 曲B',
    image: 'assets/images/fixture-release-b2.png',
    link: 'https://example.test/release-b2',
    releaseType: '2nd Single',
    playbackVideoId: 'yt-liveMovies-fixture-1',
  });

  assert.equal(await app.saveModal(), true);

  const expected = dataFor();
  const [releaseA, releaseB] = expected.discography.digital;
  expected.discography.digital = [{
    id: 'fx-release-b',
    title: '架空の作品 B 改',
    releaseDate: '2025.03.01',
    description: '1. 曲A\n2. 曲B',
    image: 'assets/images/fixture-release-b2.png',
    link: 'https://example.test/release-b2',
    releaseType: '2nd Single',
    playbackVideoId: 'yt-liveMovies-fixture-1',
  }, releaseA];
  assert.equal(releaseB.id, 'fx-release-b');
  const body = onePut(puts);
  assert.equal(body, asBody(expected));
  assert.deepEqual(keys(JSON.parse(body).discography.digital[0]), RELEASE_KEYS);
  assert.deepEqual(JSON.parse(body).discography.digital.map((item) => item.id), ['fx-release-b', 'fx-release-a'], 'head of the category');
});

test('T47-PIN (a) a release 更新 that moves the category: removed from the original, head of the destination, id and references kept', async () => {
  const { app, puts } = await openApp();
  assert.equal(app.editDiscography('fx-release-a', 'digital'), true);
  fill(app, { category: 'demo', releaseType: '種別を変えた' });

  assert.equal(await app.saveModal(), true);

  const expected = dataFor();
  const moved = { ...expected.discography.digital.shift(), releaseType: '種別を変えた' };
  expected.discography.demo.unshift(moved);
  assert.equal(onePut(puts), asBody(expected));
  const sent = JSON.parse(puts[0].body);
  assert.deepEqual(sent.discography.digital.map((item) => item.id), ['fx-release-b']);
  assert.deepEqual(sent.discography.demo.map((item) => item.id), ['fx-release-a', 'fx-demo-a', 'fx-demo-b']);
  assert.equal(sent.site.featuredReleaseId, 'fx-release-a', 'the featured release follows the id');
  assert.equal(sent.discography.demo[0].playbackVideoId, 'yt-musicVideos-fixture-1', 'the video reference is kept');
});

test('T47-PIN (a) a release 更新 (new): head of the chosen category, id disc-<time>, an empty release date is allowed', async () => {
  const { app, puts } = await openApp();
  assert.equal(app.addDiscography(), true);
  const id = app.getModalState().currentEditId;
  assert.match(id, /^disc-\d+$/);
  assert.equal(app.getModalState().currentEditType, 'discography-digital');
  fill(app, { title: '架空の新作', releaseDate: '', description: '', category: 'demo' });

  assert.equal(await app.saveModal(), true);

  const expected = dataFor();
  expected.discography.demo.unshift({ id, title: '架空の新作', releaseDate: '', description: '', image: '', link: '', releaseType: '', playbackVideoId: '' });
  assert.equal(onePut(puts), asBody(expected));
});

test('T47-PIN (a) a release date is checked only when it is new or changed; the Worker\'s 400 fields come back to the field', async () => {
  const { app, puts } = await openApp();
  assert.equal(app.addDiscography(), true);
  fill(app, { title: '架空の新作', releaseDate: '2025/05/05' });
  const before = JSON.stringify(app.getSiteData());
  assert.equal(await app.saveModal(), false);
  assert.equal(puts.length, 0, 'nothing is sent');
  assert.equal(JSON.stringify(app.getSiteData()), before, 'the data is untouched');
  assert.equal(modalOpen(app), true, 'the modal stays');
  assert.equal(app.elements.get('edit-releaseDate').getAttribute('aria-invalid'), 'true');
  assert.equal(app.elements.get('edit-releaseDate-error').textContent, '「2025.05.05」の形で入力してください。');

  const failing = await openApp({
    putStatus: 400,
    putPayload: { error: 'invalid releaseDate', fields: [{ id: 'fx-release-b', field: 'releaseDate', message: '架空のWorkerの文言' }] },
  });
  assert.equal(failing.app.editDiscography('fx-release-b', 'digital'), true);
  fill(failing.app, { releaseDate: '2026.01.01' });
  assert.equal(await failing.app.saveModal(), false);
  assert.equal(failing.app.elements.get('edit-releaseDate-error').textContent, '架空のWorkerの文言');
  assert.equal(failing.app.elements.get('edit-releaseDate').getAttribute('aria-invalid'), 'true');
  assert.equal(modalOpen(failing.app), true);
  // PIN-NOTE (R47-10 / D47-06): the base does not roll the data back after a refused PUT; the change stays in memory and the
  // header 保存 stays marked.
  assert.equal(failing.app.getSiteData().discography.digital[0].releaseDate, '2026.01.01');
  assert.equal(failing.app.getHasChanges(), true);
});

test('T47-PIN (a) an old release date written another way is kept when another field is saved, and refused when it is changed to a bad shape', async () => {
  const { app, puts } = await openApp({ variant: 'legacyShapes' });
  assert.equal(app.editDiscography('fx-release-old-slash', 'digital'), true);
  fill(app, { title: '架空のスラッシュ日付 改' });
  assert.equal(await app.saveModal(), true);
  assert.equal(JSON.parse(onePut(puts)).discography.digital[0].releaseDate, '2025/05/05', 'the old shape is kept');

  assert.equal(app.editDiscography('fx-release-old-5', 'digital'), true);
  fill(app, { releaseDate: '2025.5' });
  assert.equal(await app.saveModal(), false);
  assert.equal(puts.length, 1, 'no second PUT');
});

test('T47-PIN (a) a video 更新 (existing): the URL becomes the 11-character id, three keys are sent, the video moves to the head', async () => {
  const { app, puts } = await openApp();
  assert.equal(app.editYouTubeVideo('yt-musicVideos-fixture-2', 'musicVideos'), true);
  fill(app, { title: '架空のMV B 改', youtube: 'https://youtu.be/fixtureAA77?t=5' });

  assert.equal(await app.saveModal(), true);

  const expected = dataFor();
  const [videoA] = expected.youtube.musicVideos;
  expected.youtube.musicVideos = [{ id: 'yt-musicVideos-fixture-2', title: '架空のMV B 改', youtubeId: 'fixtureAA77' }, videoA];
  const body = onePut(puts);
  assert.equal(body, asBody(expected));
  assert.deepEqual(keys(JSON.parse(body).youtube.musicVideos[0]), VIDEO_KEYS);
});

test('T47-PIN (a) a video 更新 that moves the category, and a new video: head of the destination; id yt-<time>', async () => {
  const moved = await openApp();
  assert.equal(moved.app.editYouTubeVideo('yt-liveMovies-fixture-1', 'liveMovies'), true);
  fill(moved.app, { category: 'demos' });
  assert.equal(await moved.app.saveModal(), true);
  const expectedMoved = dataFor();
  expectedMoved.youtube.demos.unshift(expectedMoved.youtube.liveMovies.shift());
  assert.equal(onePut(moved.puts), asBody(expectedMoved));

  const created = await openApp();
  assert.equal(created.app.addYouTubeVideo('liveMovies'), true);
  const id = created.app.getModalState().currentEditId;
  assert.match(id, /^yt-\d+$/);
  assert.equal(created.app.elements.get('edit-category').value, 'liveMovies');
  fill(created.app, { title: '架空の新しい映像', youtube: 'fixtureDD01' });
  assert.equal(await created.app.saveModal(), true);
  const expectedNew = dataFor();
  expectedNew.youtube.liveMovies.unshift({ id, title: '架空の新しい映像', youtubeId: 'fixtureDD01' });
  assert.equal(onePut(created.puts), asBody(expectedNew));
});

test('T47-PIN (a) an invalid YouTube URL / ID is refused with the toast; nothing is sent and the modal stays', async () => {
  const { app, puts } = await openApp();
  assert.equal(app.editYouTubeVideo('yt-demos-fixture-1', 'demos'), true);
  fill(app, { youtube: 'not-an-id' });
  const before = JSON.stringify(app.getSiteData());
  assert.equal(await app.saveModal(), false);
  assert.equal(toast(app), 'YouTube URL / ID が不正です（IDは11文字）');
  assert.equal(puts.length, 0);
  assert.equal(JSON.stringify(app.getSiteData()), before);
  assert.equal(modalOpen(app), true);
});

test('T47-PIN (a) when the PUT fails: a News/video 更新 reports success of the modal (closed, data kept, header marked); a release 更新 keeps the modal open', async () => {
  const news = await openApp({ putStatus: 500, putPayload: { error: '架空の保存失敗' } });
  news.app.editNews('fx-news-1');
  fill(news.app, { title: '失敗する変更' });
  // PIN-NOTE (R47-10 / D47-06): saveModal returns true although the PUT failed; the modal is already closed and the change
  // stays in memory. #47's saveOccPanel must instead keep the edit surface and the input on a failed save (S47-12).
  assert.equal(await news.app.saveModal(), true);
  assert.equal(news.puts.length, 1);
  assert.equal(modalOpen(news.app), false);
  assert.equal(news.app.getSiteData().news[0].title, '失敗する変更');
  assert.equal(news.app.getHasChanges(), true);
  assert.match(toast(news.app), /保存に失敗しました: 架空の保存失敗/);

  const release = await openApp({ putStatus: 500, putPayload: { error: '架空の保存失敗' } });
  release.app.editDiscography('fx-release-a', 'digital');
  fill(release.app, { title: '失敗する作品変更' });
  assert.equal(await release.app.saveModal(), false);
  assert.equal(modalOpen(release.app), true);
  assert.equal(release.app.getSiteData().discography.digital[0].title, '失敗する作品変更');
  assert.equal(release.app.getHasChanges(), true);
});

test('T47-PIN (a) Local Mode: a modal 更新 never calls the API; it marks the data changed, and the header 保存 exports the JSON', async () => {
  const { app, puts } = await openApp({ api: false });
  app.editNews('fx-news-1');
  fill(app, { title: 'ローカルで変えた題' });
  assert.equal(await app.saveModal(), true);
  assert.equal(puts.length, 0);
  assert.equal(app.fetchCalls.length, 0);
  assert.equal(app.getHasChanges(), true);
  assert.equal(app.elements.get('saveBtn').textContent, 'JSONを書き出す *');
  assert.equal(toast(app), '編集内容を反映しました。右上の「保存」で確定します');

  assert.equal(await app.invokeSaveData(), true);
  const expected = dataFor();
  expected.news[0].title = 'ローカルで変えた題';
  assert.equal(await app.objectUrls.at(-1).blob.text(), asExport(expected), 'the export is the whole data, 2-space JSON');
  assert.equal(app.getHasChanges(), false);
});

// ======================================================================================================
// (b) deletion and the references it clears
// ======================================================================================================
test('T47-PIN (b) deleting News: after the confirm nothing is sent; the header 保存 then sends the data without the item', async () => {
  const { app, puts } = await openApp();
  app.setConfirm(() => false);
  app.editNews('fx-news-3');
  assert.equal(app.deleteItem(), false, 'a cancelled confirm changes nothing');
  assert.equal(app.getSiteData().news.length, 6);
  assert.equal(modalOpen(app), true);

  app.setConfirm(() => true);
  assert.equal(app.deleteItem(), true);
  assert.equal(puts.length, 0, 'the deletion is not sent by itself');
  assert.equal(app.getHasChanges(), true);
  assert.equal(modalOpen(app), false);
  assert.equal(toast(app), '編集内容を反映しました。右上の「保存」で確定します');

  assert.equal(await app.invokeSaveData(), true);
  const expected = dataFor();
  expected.news = expected.news.filter((item) => item.id !== 'fx-news-3');
  assert.equal(onePut(puts), asBody(expected));
});

test('T47-PIN (b) deleting a release: the featured release and nothing else is cleared; the other values are sent as they were', async () => {
  const { app, puts } = await openApp();
  app.setConfirm(() => true);
  app.editDiscography('fx-release-a', 'digital');
  assert.equal(app.deleteItem(), true);
  assert.equal(await app.invokeSaveData(), true);

  const expected = dataFor();
  expected.discography.digital = expected.discography.digital.filter((item) => item.id !== 'fx-release-a');
  expected.site.featuredReleaseId = '';
  assert.equal(onePut(puts), asBody(expected));
  assert.equal(app.elements.get('site-featured-release-id').optionValues.includes('fx-release-a'), false, 'the Site choice no longer offers it');
});

test('T47-PIN (b) deleting a video: the releases that play it get an empty playbackVideoId in the same PUT', async () => {
  const { app, puts } = await openApp();
  app.setConfirm(() => true);
  app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos');
  assert.equal(app.deleteItem(), true);
  assert.equal(await app.invokeSaveData(), true);

  const expected = dataFor();
  expected.youtube.musicVideos = expected.youtube.musicVideos.filter((item) => item.id !== 'yt-musicVideos-fixture-1');
  expected.discography.digital[0].playbackVideoId = '';
  assert.equal(onePut(puts), asBody(expected));
  app.editDiscography('fx-release-a', 'digital');
  assert.equal(app.elements.get('edit-playbackVideoId').optionValues.includes('yt-musicVideos-fixture-1'), false);
});

test('T47-PIN (b) deleting a video nothing plays, or a demo release that is not featured, clears nothing else', async () => {
  const video = await openApp();
  video.app.setConfirm(() => true);
  video.app.editYouTubeVideo('yt-liveMovies-fixture-2', 'liveMovies');
  video.app.deleteItem();
  await video.app.invokeSaveData();
  const expectedVideo = dataFor();
  expectedVideo.youtube.liveMovies.pop();
  assert.equal(onePut(video.puts), asBody(expectedVideo));

  const demo = await openApp();
  demo.app.setConfirm(() => true);
  demo.app.editDiscography('fx-demo-b', 'demo');
  demo.app.deleteItem();
  await demo.app.invokeSaveData();
  const expectedDemo = dataFor();
  expectedDemo.discography.demo.pop();
  assert.equal(onePut(demo.puts), asBody(expectedDemo));
});

test('T47-PIN (b) deleting in Local Mode exports the whole data after the references are cleared', async () => {
  const { app, puts } = await openApp({ api: false });
  app.setConfirm(() => true);
  app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos');
  app.deleteItem();
  app.editDiscography('fx-release-a', 'digital');
  app.deleteItem();
  assert.equal(await app.invokeSaveData(), true);
  assert.equal(puts.length, 0);
  const expected = dataFor();
  expected.youtube.musicVideos.shift();
  expected.discography.digital.shift();
  expected.site.featuredReleaseId = '';
  assert.equal(await app.objectUrls.at(-1).blob.text(), asExport(expected));
});

// ======================================================================================================
// (c) what the header 保存 sends
// ======================================================================================================
test('T47-PIN (c) Site inputs write the data at once (no PUT); the header 保存 then sends the whole data', async () => {
  const { app, puts } = await openApp();
  const set = (id, value) => { const control = app.elements.get(id); control.value = value; control.onchange(); };
  set('site-link-bandcamp', 'https://example.test/shop2');
  set('site-link-youtube', 'https://example.test/videos2');
  set('site-link-x', 'https://example.test/x2');
  set('site-link-instagram', 'https://example.test/photos2');
  set('site-link-note', 'https://example.test/notes2');
  set('site-footer-text', '変えたフッター');
  set('contact-intro-text', '変えたお問い合わせ文\n2行目');
  set('contact-form-action', 'https://forms.example.test/contact2');
  set('site-featured-release-id', 'fx-demo-b');
  assert.equal(puts.length, 0, 'a change event only writes the data and marks it');
  assert.equal(app.getHasChanges(), true);
  assert.equal(app.getSiteData().site.footerText, '変えたフッター', 'the input is already in the data');

  assert.equal(await app.invokeSaveData(), true);

  const expected = dataFor();
  expected.site.links = {
    bandcamp: 'https://example.test/shop2',
    youtube: 'https://example.test/videos2',
    x: 'https://example.test/x2',
    instagram: 'https://example.test/photos2',
    note: 'https://example.test/notes2',
  };
  expected.site.footerText = '変えたフッター';
  expected.site.featuredReleaseId = 'fx-demo-b';
  expected.contact.introText = '変えたお問い合わせ文\n2行目';
  expected.contact.formAction = 'https://forms.example.test/contact2';
  assert.equal(onePut(puts), asBody(expected));
  assert.equal(app.getHasChanges(), false);
});

test('T47-PIN (c) Profile text and links, and the Channel URL, are in the same whole-data PUT', async () => {
  const { app, puts } = await openApp();
  const profileText = app.elements.get('profile-text');
  profileText.value = '変えたプロフィール\n\n空行のあと';
  profileText.onchange();
  app.updateProfileLink(0, 'name', '変えた名前');
  app.updateProfileLink(1, 'url', 'https://example.test/p/video2');
  app.addProfileLink();
  app.deleteProfileLink(2);
  const channel = app.elements.get('youtube-channel-url');
  channel.value = 'https://example.test/@changed';
  channel.onchange();
  assert.equal(puts.length, 0);

  assert.equal(await app.invokeSaveData(), true);

  const expected = dataFor();
  expected.profile.text = '変えたプロフィール\n\n空行のあと';
  expected.profile.links[0].name = '変えた名前';
  expected.profile.links[1].url = 'https://example.test/p/video2';
  expected.profile.links.splice(2, 1);
  expected.profile.links.push({ name: '', url: '' });
  expected.youtube.channelUrl = 'https://example.test/@changed';
  assert.equal(onePut(puts), asBody(expected));
});

test('T47-PIN (c) the header 保存 sends every unsaved input of every tab at once, and the PUT of nothing changed is the data as loaded', async () => {
  const unchanged = await openApp();
  assert.equal(await unchanged.app.invokeSaveData(), true);
  assert.equal(onePut(unchanged.puts), asBody(dataFor()), 'a save with no change sends the same bytes as the data loaded');

  const { app, puts } = await openApp();
  const footer = app.elements.get('site-footer-text');
  footer.value = 'Siteだけ変えた';
  footer.onchange();
  const channel = app.elements.get('youtube-channel-url');
  channel.value = 'https://example.test/@only-channel';
  channel.onchange();
  app.editNews('fx-news-4');
  fill(app, { title: 'Newsも変えた' });
  assert.equal(await app.saveModal(), true);
  const expected = dataFor();
  expected.site.footerText = 'Siteだけ変えた';
  expected.youtube.channelUrl = 'https://example.test/@only-channel';
  expected.news[3].title = 'Newsも変えた';
  // PIN-NOTE (R47-10 / D47-04 / D47-10): the News 更新 sends the Site and Channel URL changes made earlier, because they are
  // already in the data. #47 changes this on purpose (a save sends the saved data plus its own target); T47-SCOPE covers that.
  assert.equal(onePut(puts), asBody(expected));
});

test('T47-PIN (c) the header 保存: an upload in progress blocks it; a failure keeps the data and says so; a second click while saving sends nothing', async () => {
  const busy = await openApp();
  busy.app.setSyntheticImageUpload(true);
  assert.equal(await busy.app.invokeSaveData(), false);
  assert.equal(busy.puts.length, 0);
  assert.equal(toast(busy.app), '画像アップロード中です。完了してから保存してください');

  const failed = await openApp({ putStatus: 500, putPayload: { error: '架空の保存失敗' } });
  const footer = failed.app.elements.get('site-footer-text');
  footer.value = '失敗する変更';
  footer.onchange();
  assert.equal(await failed.app.invokeSaveData(), false);
  assert.equal(failed.puts.length, 1);
  assert.equal(failed.app.getSiteData().site.footerText, '失敗する変更');
  assert.equal(failed.app.getHasChanges(), true);
  assert.equal(toast(failed.app), '保存に失敗しました: 架空の保存失敗');

  const saving = await openApp();
  saving.app.setSaving(true);
  assert.equal(await saving.app.invokeSaveData(), false);
  assert.equal(saving.puts.length, 0);
});

test('T47-PIN (c) the header 保存 refuses a duplicate Live id and a bad release date before sending', async () => {
  const dup = await openApp();
  dup.app.getSiteData().live.past.push({ ...dup.app.getSiteData().live.upcoming[0] });
  assert.equal(await dup.app.invokeSaveData(), false);
  assert.equal(dup.puts.length, 0);
  assert.match(toast(dup.app), /保存できません: Live IDが重複しています: fx-live-up/);

  const bad = await openApp();
  bad.app.getSiteData().discography.digital[0].releaseDate = '2025/5/5';
  assert.equal(await bad.app.invokeSaveData(), false);
  assert.equal(bad.puts.length, 0);
  assert.equal(modalOpen(bad.app), true, 'the release is opened so its date can be fixed');
  assert.equal(bad.app.elements.get('edit-releaseDate-error').textContent, '「2025.05.05」の形で入力してください。');
});

// ======================================================================================================
// (d) one item opened and changed: the other values and the keys
// ======================================================================================================
test('T47-PIN (d) every News of the base data: opened and saved unchanged it is identical, free date included, in the same place', async () => {
  for (const original of fixture.data.news) {
    const { app, puts } = await openApp();
    assert.equal(app.editNews(original.id), true, original.id);
    assert.equal(await app.saveModal(), true);
    assert.equal(onePut(puts), asBody(dataFor()), `${original.id}: the PUT is the data as loaded`);
  }
});

test('T47-PIN (d) changing one News field changes only that field; double quotes, full-width characters and blank lines survive', async () => {
  const { app, puts } = await openApp();
  const data = dataFor();
  data.news[0].title = 'テスト "引用符" ＆ 全角！ <b>';
  data.news[0].description = '1行目\n\n3行目 ～ ＃';
  const reloaded = await openApp({ data });
  assert.equal(reloaded.app.editNews('fx-news-1'), true);
  fill(reloaded.app, { link: 'https://example.test/news/1-changed' });
  assert.equal(await reloaded.app.saveModal(), true);
  const expected = clone(data);
  expected.news[0].link = 'https://example.test/news/1-changed';
  assert.equal(onePut(reloaded.puts), asBody(expected));
  assert.equal(puts.length, 0);
  assert.equal(app.getHasChanges(), false);
});

test('T47-PIN (d) old-format News: the form rebuilds exactly seven keys; a key the form does not know is dropped', async () => {
  const expectedByStart = {
    'fx-news-old-3': { id: 'fx-news-old-3', date: '2025/4/1(Tue.)', title: '架空の旧形式 3キー', description: '', image: '', link: '', linkText: '' },
    'fx-news-old-5': { id: 'fx-news-old-5', date: '2025/3/10', title: '架空の旧形式 5キー', description: '架空の説明', image: 'assets/images/fixture-news-old.jpg', link: '', linkText: '' },
    'fx-news-old-extra': { id: 'fx-news-old-extra', date: '2025/2/1(Sat.) 架空の語', title: '架空の余分なキー', description: '', image: '', link: 'https://example.test/news/old', linkText: 'view...' },
  };
  for (const [id, expectedItem] of Object.entries(expectedByStart)) {
    const { app, puts } = await openApp({ variant: 'legacyShapes' });
    assert.equal(app.editNews(id), true, id);
    assert.equal(await app.saveModal(), true);
    const sent = JSON.parse(onePut(puts)).news.find((item) => item.id === id);
    assert.deepEqual(keys(sent), NEWS_KEYS, `${id}: seven keys`);
    assert.deepEqual(sent, expectedItem, id);
    assert.equal('futureKey' in sent, false);
  }
});

test('T47-PIN (d) every release and video of the base data: opened and saved unchanged the content is identical, and it moves to the head of its category', async () => {
  for (const category of ['digital', 'demo']) {
    for (const original of fixture.data.discography[category]) {
      const { app, puts } = await openApp();
      assert.equal(app.editDiscography(original.id, category), true, original.id);
      assert.equal(await app.saveModal(), true);
      const expected = dataFor();
      expected.discography[category] = [original, ...expected.discography[category].filter((item) => item.id !== original.id)];
      assert.equal(onePut(puts), asBody(expected), original.id);
    }
  }
  for (const category of ['musicVideos', 'liveMovies', 'demos']) {
    for (const original of fixture.data.youtube[category]) {
      const { app, puts } = await openApp();
      assert.equal(app.editYouTubeVideo(original.id, category), true, original.id);
      assert.equal(await app.saveModal(), true);
      const expected = dataFor();
      expected.youtube[category] = [original, ...expected.youtube[category].filter((item) => item.id !== original.id)];
      assert.equal(onePut(puts), asBody(expected), original.id);
    }
  }
});

test('T47-PIN (d) opening and closing without saving changes nothing and sends nothing', async () => {
  const { app, puts } = await openApp();
  const before = JSON.stringify(app.getSiteData());
  app.editNews('fx-news-5');
  app.closeModal();
  app.editDiscography('fx-release-b', 'digital');
  app.closeModal();
  app.editYouTubeVideo('yt-demos-fixture-1', 'demos');
  app.closeModal();
  assert.equal(JSON.stringify(app.getSiteData()), before);
  assert.equal(puts.length, 0);
  assert.equal(app.getHasChanges(), false);
});

test('T47-PIN (d) old-format releases: the form rebuilds the eight keys, an unedited odd date keeps its type, and an unknown key is dropped', async () => {
  const { app, puts } = await openApp({ variant: 'legacyShapes' });
  const sentFor = async (id, category) => {
    puts.length = 0;
    assert.equal(app.editDiscography(id, category), true, id);
    assert.equal(await app.saveModal(), true);
    const body = JSON.parse(onePut(puts));
    return body.discography[category].find((item) => item.id === id);
  };

  const five = await sentFor('fx-release-old-5', 'digital');
  assert.deepEqual(five, { id: 'fx-release-old-5', title: '架空の旧形式リリース', releaseDate: '2025.5.5', description: '', image: 'assets/images/fixture-old.png', link: '', releaseType: '', playbackVideoId: '' });
  assert.deepEqual(keys(five), RELEASE_KEYS, 'eight keys, in this order');

  const extra = await sentFor('fx-release-old-extra', 'digital');
  assert.equal('futureKey' in extra, false, 'an unknown key is dropped');
  assert.deepEqual(keys(extra), RELEASE_KEYS);

  const number = await sentFor('fx-demo-old-number', 'demo');
  assert.equal(number.releaseDate, 42, 'a numeric date that was not edited stays a number');

  // PIN-NOTE (D47-18 / R47-10): a release that has no releaseDate key leaves the form with releaseDate undefined, which JSON
  // drops: the PUT carries seven keys, not eight. #47's saveOccPanel must keep sending no releaseDate key for it (T47-EQ).
  const missing = await sentFor('fx-demo-old-missing', 'demo');
  assert.deepEqual(keys(missing), ['id', 'title', 'description', 'image', 'link', 'releaseType', 'playbackVideoId']);
});

test('T47-PIN (d) old-format videos: three keys, an unknown key dropped, a URL-shaped stored id becomes the 11-character id', async () => {
  const { app, puts } = await openApp({ variant: 'legacyShapes' });
  assert.equal(app.editYouTubeVideo('yt-old-extra', 'musicVideos'), true);
  assert.equal(await app.saveModal(), true);
  const first = JSON.parse(onePut(puts)).youtube.musicVideos.find((item) => item.id === 'yt-old-extra');
  assert.deepEqual(first, { id: 'yt-old-extra', title: '架空の余分', youtubeId: 'fixtureAA01' });

  puts.length = 0;
  assert.equal(app.editYouTubeVideo('yt-old-url', 'musicVideos'), true);
  assert.equal(app.elements.get('edit-youtube').value, 'https://youtu.be/fixtureAA09');
  assert.equal(await app.saveModal(), true);
  const second = JSON.parse(onePut(puts)).youtube.musicVideos.find((item) => item.id === 'yt-old-url');
  assert.deepEqual(second, { id: 'yt-old-url', title: '架空のURL形式', youtubeId: 'fixtureAA09' });
});

test('T47-PIN (d) numeric-looking ids: the list opens an item by the id as a string; a numeric id is not found that way', async () => {
  const { app, puts } = await openApp({ variant: 'numericIds' });
  const list = app.elements.get('news-list').innerHTML;
  assert.match(list, /onclick="editNews\('101'\)"/);
  assert.match(list, /onclick="editNews\('102'\)"/);
  // PIN-NOTE (D47-17 / R47-26): editNews compares ids with ===. The list passes the id as a string, so News whose id is the
  // number 101 or 103 cannot be opened from the list; only the string id '102' can. #47 compares String(a) === String(b).
  assert.equal(app.editNews('101'), false);
  assert.equal(app.editNews('103'), false);
  assert.equal(app.editNews(101), true, 'a numeric argument does match a numeric id');
  app.closeModal();
  assert.equal(app.editNews('102'), true);
  fill(app, { title: '数字に見える文字列IDを変えた' });
  assert.equal(await app.saveModal(), true);
  const sent = JSON.parse(onePut(puts)).news;
  assert.deepEqual(sent.map((item) => item.id), [101, '102', 103], 'the ids keep their types and the position');
  assert.equal(sent[1].title, '数字に見える文字列IDを変えた');

  puts.length = 0;
  assert.equal(app.editNews(103), true);
  fill(app, { title: '数値IDを変えた' });
  assert.equal(await app.saveModal(), true);
  const sentNumeric = JSON.parse(onePut(puts)).news;
  assert.deepEqual(sentNumeric.map((item) => item.id), [101, '102', 103]);
  assert.equal(sentNumeric[2].title, '数値IDを変えた');
});

test('T47-PIN (d) long values and a long profile survive an unchanged open and save', async () => {
  const { app, puts } = await openApp({ variant: 'longValues' });
  assert.equal(app.editNews('fx-news-long'), true);
  assert.equal(await app.saveModal(), true);
  assert.equal(onePut(puts), asBody(dataFor('longValues')));
  puts.length = 0;
  assert.equal(app.editDiscography('fx-release-long', 'digital'), true);
  assert.equal(await app.saveModal(), true);
  assert.equal(onePut(puts), asBody(dataFor('longValues')));
});

// ======================================================================================================
// (e) the #41 reference reconciliation
// ======================================================================================================
test('T47-PIN (e) the featured release and a release\'s video are kept while their target exists, whatever else is saved', async () => {
  const { app, puts } = await openApp();
  app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos');
  fill(app, { category: 'demos' });
  assert.equal(await app.saveModal(), true);
  const sent = JSON.parse(onePut(puts));
  assert.equal(sent.site.featuredReleaseId, 'fx-release-a');
  assert.equal(sent.discography.digital[0].playbackVideoId, 'yt-musicVideos-fixture-1', 'a video moved to another category keeps its id and the reference');
  assert.deepEqual(sent.youtube.demos.map((item) => item.id), ['yt-musicVideos-fixture-1', 'yt-demos-fixture-1']);
});

test('T47-PIN (e) every save runs the reconciliation: a reference with no target is sent as the empty string', async () => {
  const { app, puts } = await openApp();
  app.getSiteData().site.featuredReleaseId = 'fx-no-such-release';
  app.getSiteData().discography.demo[0].playbackVideoId = 'yt-no-such-video';
  app.getSiteData().discography.demo[1].releaseType = 42;
  assert.equal(await app.invokeSaveData(), true);
  const sent = JSON.parse(onePut(puts));
  assert.equal(sent.site.featuredReleaseId, '');
  assert.equal(sent.discography.demo[0].playbackVideoId, '');
  assert.equal(sent.discography.demo[1].releaseType, '', 'a non-string releaseType becomes the empty string');
});

test('T47-PIN (e) the Site and release choices are rebuilt from the data after a deletion or a move', async () => {
  const { app } = await openApp();
  assert.deepEqual(app.elements.get('site-featured-release-id').optionValues, ['', 'fx-release-a', 'fx-release-b', 'fx-demo-a', 'fx-demo-b'].sort((a, b) => 0));
  app.editDiscography('fx-release-a', 'digital');
  assert.deepEqual(app.elements.get('edit-playbackVideoId').optionValues, [
    '', 'yt-musicVideos-fixture-1', 'yt-musicVideos-fixture-2', 'yt-liveMovies-fixture-1', 'yt-liveMovies-fixture-2', 'yt-demos-fixture-1',
  ]);
  assert.equal(app.elements.get('edit-playbackVideoId').value, 'yt-musicVideos-fixture-1');
});

// ======================================================================================================
// (f) image selection and saving, API and Local
// ======================================================================================================
// handleImageSelect only reads files[0]; a real File lets uploadImageToApi build its FormData.
const selectedFile = (name) => new File(['fixture-image-bytes'], name, { type: 'image/png' });

function installReader(app) {
  app.setFileReader(class {
    readAsDataURL() { this.onload({ target: { result: 'data:image/png;base64,FIXTURE' } }); }
  });
}

test('T47-PIN (f) API Mode: a News image is uploaded at selection, the hidden input takes the URL, and the 更新 sends it', async () => {
  const url = 'https://img.example.test/uploads/fixture-news-upload.png';
  const { app, puts } = await openApp({ upload: () => jsonResponse({ url }) });
  installReader(app);
  app.editNews('fx-news-1');
  assert.equal(app.handleImageSelect({ files: [selectedFile('photo.png')] }, 'edit-image'), true);
  assert.equal(app.ensureNoActiveImageUploads(), false, 'the upload is in progress');
  await flushAsync();
  assert.equal(app.ensureNoActiveImageUploads(), true);
  assert.equal(app.elements.get('edit-image').value, url);
  assert.equal(app.elements.get('edit-image-path').textContent, `URL: ${url}`);
  const uploads = app.fetchCalls.filter((call) => call.path === '/api/admin/upload-image');
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].options.method, 'POST');
  // PIN-NOTE: the selection marks the header 保存 changed before the modal is saved, although nothing is in the data yet.
  assert.equal(app.getHasChanges(), true);
  assert.equal(puts.length, 0);

  assert.equal(await app.saveModal(), true);
  const expected = dataFor();
  expected.news[0].image = url;
  assert.equal(onePut(puts), asBody(expected));
});

test('T47-PIN (f) an upload in progress blocks the modal 更新; a failed upload restores the previous image and says so', async () => {
  const pending = await openApp({ upload: () => new Promise(() => {}) });
  installReader(pending.app);
  pending.app.editNews('fx-news-1');
  pending.app.handleImageSelect({ files: [selectedFile('photo.png')] }, 'edit-image');
  await flushAsync();
  assert.equal(await pending.app.saveModal(), false);
  assert.equal(pending.puts.length, 0);
  assert.equal(toast(pending.app), '画像アップロード中です。完了してから保存してください');

  const failed = await openApp({ upload: () => jsonResponse({ error: '架空のアップロード失敗' }, { ok: false, status: 400 }) });
  installReader(failed.app);
  failed.app.editNews('fx-news-1');
  failed.app.handleImageSelect({ files: [selectedFile('photo.png')] }, 'edit-image');
  await flushAsync();
  assert.equal(failed.app.elements.get('edit-image').value, 'assets/images/fixture-news-1.jpg');
  assert.equal(toast(failed.app), '画像アップロード失敗: 架空のアップロード失敗');
  assert.equal(failed.app.getHasChanges(), false);
  assert.equal(failed.app.ensureNoActiveImageUploads(), true);
});

test('T47-PIN (f) removing a modal image sends an empty image; it does not mark the header 保存 by itself', async () => {
  const { app, puts } = await openApp();
  app.editDiscography('fx-release-b', 'digital');
  assert.equal(app.clearImage('edit-image'), true);
  assert.equal(app.elements.get('edit-image').value, '');
  assert.equal(app.getHasChanges(), false, 'the generic modal image does not mark the header 保存');
  assert.equal(await app.saveModal(), true);
  const expected = dataFor();
  const [releaseA, releaseB] = expected.discography.digital;
  expected.discography.digital = [{ ...releaseB, image: '' }, releaseA];
  assert.equal(onePut(puts), asBody(expected));
});

test('T47-PIN (f) Site hero and Profile images write the data at once; the header 保存 sends them (API)', async () => {
  const heroUrl = 'https://img.example.test/uploads/fixture-hero-upload.png';
  const profileUrl = 'https://img.example.test/uploads/fixture-profile-upload.png';
  const urls = [heroUrl, profileUrl];
  const { app, puts } = await openApp({ upload: () => jsonResponse({ url: urls.shift() }) });
  installReader(app);
  app.handleImageSelect({ files: [selectedFile('hero.png')] }, 'site-hero-image');
  await flushAsync();
  assert.equal(app.getSiteData().site.heroImage, heroUrl, 'already in the data');
  assert.equal(app.getHasChanges(), true);
  app.handleImageSelect({ files: [selectedFile('profile.png')] }, 'profile-image');
  await flushAsync();
  assert.equal(app.getSiteData().profile.image, profileUrl);
  assert.equal(puts.length, 0);

  assert.equal(await app.invokeSaveData(), true);
  const expected = dataFor();
  expected.site.heroImage = heroUrl;
  expected.profile.image = profileUrl;
  assert.equal(onePut(puts), asBody(expected));

  puts.length = 0;
  assert.equal(app.clearImage('site-hero-image'), true);
  assert.equal(app.getSiteData().site.heroImage, '');
  assert.equal(app.getHasChanges(), true, 'removing a page image marks the header 保存');
  assert.equal(await app.invokeSaveData(), true);
  expected.site.heroImage = '';
  assert.equal(onePut(puts), asBody(expected));
});

test('T47-PIN (f) Local Mode: the chosen file gets assets/images/<name>_<yyyymmdd>.<ext>, is kept for download, and the export carries the path', async () => {
  const { app, puts } = await openApp({ api: false });
  installReader(app);
  const confirms = [];
  app.setConfirm((message) => { confirms.push(message); return false; });
  app.editNews('fx-news-1');
  assert.equal(app.handleImageSelect({ files: [selectedFile('My Photo.PNG')] }, 'edit-image'), true);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const path = `assets/images/My_Photo_${stamp}.png`;
  assert.equal(app.elements.get('edit-image').value, path);
  assert.equal(app.elements.get('edit-image-path').textContent, `パス: ${path}`);
  assert.equal(app.ensureNoActiveImageUploads(), true, 'a Local read is not an upload in progress');
  assert.equal(await app.saveModal(), true);
  assert.equal(puts.length, 0);

  assert.equal(await app.invokeSaveData(), true);
  const expected = dataFor();
  expected.news[0].image = path;
  assert.equal(await app.objectUrls.at(-1).blob.text(), asExport(expected));
  assert.equal(confirms.length, 1);
  assert.match(confirms[0], /^新規画像が1件あります。/);
});

test('T47-PIN (f) Local Mode: Site and Profile images go into the data at once and are exported', async () => {
  const { app } = await openApp({ api: false });
  installReader(app);
  app.setConfirm(() => false);
  app.handleImageSelect({ files: [selectedFile('hero.jpg')] }, 'site-hero-image');
  app.handleImageSelect({ files: [selectedFile('me.JPG')] }, 'profile-image');
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  assert.equal(app.getSiteData().site.heroImage, `assets/images/hero_${stamp}.jpg`);
  assert.equal(app.getSiteData().profile.image, `assets/images/me_${stamp}.jpg`);
  assert.equal(app.getHasChanges(), true);
  assert.equal(await app.invokeSaveData(), true);
  const expected = dataFor();
  expected.site.heroImage = `assets/images/hero_${stamp}.jpg`;
  expected.profile.image = `assets/images/me_${stamp}.jpg`;
  assert.equal(await app.objectUrls.at(-1).blob.text(), asExport(expected));
});

// ======================================================================================================
// the empty lists and read-only guards the saves rely on
// ======================================================================================================
test('T47-PIN empty lists: the empty states render and a new item still goes to the head of an empty list', async () => {
  const { app, puts } = await openApp({ variant: 'emptyLists' });
  assert.match(app.elements.get('news-list').innerHTML, /ニュースがありません/);
  assert.match(app.elements.get('disc-digital-list').innerHTML, /リリースはありません/);
  assert.match(app.elements.get('disc-demo-list').innerHTML, /デモはありません/);
  assert.match(app.elements.get('youtube-musicVideos-list').innerHTML, /アイテムがありません/);
  assert.match(app.elements.get('profile-links-list').innerHTML, /リンクがありません/);
  app.addNews();
  const id = app.getModalState().currentEditId;
  fill(app, { title: '架空の最初のお知らせ' });
  assert.equal(await app.saveModal(), true);
  const expected = dataFor('emptyLists');
  expected.news = [{ id, date: '', title: '架空の最初のお知らせ', description: '', image: '', link: '', linkText: 'view...' }];
  assert.equal(onePut(puts), asBody(expected));
});

test('T47-PIN API fallback (read-only): a modal 更新, a deletion and the header 保存 send nothing and change nothing', async () => {
  const { app, puts } = await openApp();
  app.editNews('fx-news-1');
  fill(app, { title: '読み取り専用で変えようとした' });
  app.setApiFallbackReadOnly(true);
  const before = JSON.stringify(app.getSiteData());
  assert.equal(await app.saveModal(), false);
  app.setConfirm(() => true);
  assert.equal(app.deleteItem(), false);
  assert.equal(await app.invokeSaveData(), false);
  assert.equal(puts.length, 0);
  assert.equal(JSON.stringify(app.getSiteData()), before);
  assert.equal(toast(app), '読み取り専用のため保存できません。');
});
