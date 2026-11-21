// Issue #47 stages 2-4: what the News, Music (works, videos, Channel URL), Site and Profile surfaces save, and when. The groups are those of the Code Generation Plan §5:
//   T47-EQ      the same operation on the app of the base commit and on the current one sends the same PUT body
//   T47-SAVE    the four save states, double click, failure, success, Local Mode
//   T47-SCOPE   a save sends the last saved content + only its own target, never another input's unsaved change
//   T47-GUARD   an unsaved edit is never left without asking (and nothing is asked when nothing is unsaved)
//   T47-DELETE  a confirmation, then one save that removes the item
//   T47-IMAGE   (News image) selecting a picture counts as unsaved; the upload is part of the unsaved judgement
// Values come from test/fixtures/admin-occasional-states.json (synthetic). admin/app.js is loaded with a fake DOM and a
// recording admin fetch; nothing reaches a network.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OCCASIONAL_PUT_PATH,
  answerLiveDialog,
  decodeHtml,
  deferred,
  flushAsync,
  jsonResponse,
  occasionalData,
  openOccasionalApp,
} from './support/admin-app-harness.mjs';

const TOP_KEYS = ['news', 'live', 'discography', 'profile', 'youtube', 'site', 'ticket', 'contact'];
const NEWS_KEYS = ['id', 'date', 'title', 'description', 'image', 'link', 'linkText'];

const plain = (value) => JSON.parse(JSON.stringify(value));
const ordered = (data) => Object.fromEntries(TOP_KEYS.map((key) => [key, data[key]]));
const asBody = (data) => JSON.stringify(ordered(data));
const el = (app, id) => app.elements.get(id);
const toast = (app) => el(app, 'toast').textContent;
const status = (app) => el(app, 'news-editor-status').textContent;
const statusWide = (app) => el(app, 'news-editor-status-wide').textContent;
const errorLine = (app) => el(app, 'news-editor-error').textContent;
const dialogHtml = (app) => el(app, 'live-dialog').innerHTML;
const dialogOpen = (app) => el(app, 'live-dialog-overlay').hidden === false;
const unsavedTitle = '保存していない変更があります。';

// A field of the edit surface is typed into the way a person does (the value changes, then "input" fires).
async function type(app, id, value) {
  const field = el(app, id);
  field.value = value;
  await field.dispatch('input');
}

async function typeAll(app, values) {
  for (const [key, value] of Object.entries(values)) await type(app, `edit-${key}`, value);
}

// The base app opens a modal; its fields are plain values, saved by 更新.
function fillBase(app, values) {
  for (const [key, value] of Object.entries(values)) el(app, `edit-${key}`).value = value;
}

function onePut(puts) {
  assert.equal(puts.length, 1, 'exactly one PUT');
  assert.equal(puts[0].path, OCCASIONAL_PUT_PATH);
  assert.equal(puts[0].bodyType, 'string', 'the body is a JSON string');
  return puts[0].body;
}

// news-<time> is the only part of a new item's body that depends on the clock.
const withoutClock = (body) => body.replace(/news-\d{10,}/g, 'news-<time>');

async function baseNewsSave({ variant = null, id, values, mode = 'update' }) {
  const { app, puts } = await openOccasionalApp({ base: true, variant });
  if (mode === 'new') assert.equal(app.addNews(), true);
  else assert.equal(app.editNews(id), true);
  fillBase(app, values || {});
  if (mode === 'delete') {
    app.setConfirm(() => true);
    assert.equal(app.deleteItem(), true);
    assert.equal(puts.length, 0, 'base: the delete is only made in memory; the header 保存 sends it (a second step)');
    assert.equal(await app.invokeSaveData({ silent: true }), true);
  } else {
    assert.equal(await app.saveModal(), true);
  }
  return onePut(puts);
}

async function newNewsSave({ variant = null, id, values, mode = 'update', force = false }) {
  const { app, puts } = await openOccasionalApp({ variant });
  if (mode === 'new') assert.equal(app.addNews(), true);
  else assert.equal(app.editNews(id), true);
  if (mode === 'delete') {
    const pending = app.deleteOccItem();
    await answerLiveDialog(app, 'delete');
    assert.equal(await pending, true);
  } else {
    await typeAll(app, values || {});
    assert.equal(await app.saveOccPanel('item', force ? { force: true } : {}), true);
  }
  return onePut(puts);
}

// ======================================================================================================
// T47-EQ (News): the new edit surface sends what the modal 更新 used to send
// ======================================================================================================
const CHANGED = {
  date: '2026/11/13(Fri.) 変えた語',
  title: '変更後の "題" です',
  description: '変更後の説明\n2行目\n\n4行目',
  image: 'assets/images/fixture-news-new.PNG',
  link: 'https://example.test/news/changed',
  linkText: '変更後のテキスト',
};

test('T47-EQ News: changing every field of one item sends the body the modal 更新 sent (same keys, order, values, position)', async () => {
  const before = await baseNewsSave({ id: 'fx-news-2', values: CHANGED });
  const after = await newNewsSave({ id: 'fx-news-2', values: CHANGED });
  assert.equal(after, before);

  const expected = occasionalData();
  expected.news[1] = { id: 'fx-news-2', ...CHANGED };
  assert.equal(after, asBody(expected), 'and it is the fixture with only that item replaced, in place');
  assert.deepEqual(Object.keys(JSON.parse(after).news[1]), NEWS_KEYS);
});

test('T47-EQ News: changing one value keeps the other values, including a free-form date, a double quote and full-width characters', async () => {
  for (const id of ['fx-news-1', 'fx-news-2', 'fx-news-3', 'fx-news-4', 'fx-news-5', 'fx-news-6']) {
    const values = { title: 'タイトルだけ変えた "二重引用符" ＆ 全角！' };
    assert.equal(await newNewsSave({ id, values }), await baseNewsSave({ id, values }), id);
  }
});

test('T47-EQ News: opening an item and saving it without a change sends the same body (a save with nothing to save is forced here)', async () => {
  // The edit surface has nothing to save while the values are the saved ones (T47-SAVE); `force` builds the body it would send.
  const before = await baseNewsSave({ id: 'fx-news-3' });
  const after = await newNewsSave({ id: 'fx-news-3', force: true });
  assert.equal(after, before);
  assert.equal(after, asBody(occasionalData()), 'nothing changed in the data');
});

test('T47-EQ News: a new item goes to the head with the same keys and the default link text', async () => {
  const values = { date: '2026/12/1(Tue.)', title: '新しいお知らせ', description: '説明\n\n2行', link: 'https://example.test/news/new' };
  const before = await baseNewsSave({ mode: 'new', values });
  const after = await newNewsSave({ mode: 'new', values });
  assert.equal(withoutClock(after), withoutClock(before));
  const body = JSON.parse(after);
  assert.match(body.news[0].id, /^news-\d+$/);
  assert.equal(body.news[0].linkText, 'view...');
  assert.equal(body.news.length, 7);
  assert.deepEqual(Object.keys(body.news[0]), NEWS_KEYS);
});

test('T47-EQ News (intended difference): delete — the modal needed two steps (deleteItem, then the header 保存), the edit surface saves in one; the PUT body is the same', async () => {
  for (const id of ['fx-news-1', 'fx-news-4']) {
    const before = await baseNewsSave({ id, mode: 'delete' });
    const after = await newNewsSave({ id, mode: 'delete' });
    assert.equal(after, before, id);
    assert.deepEqual(JSON.parse(after).news.map((item) => item.id), occasionalData().news.map((item) => item.id).filter((itemId) => itemId !== id));
  }
});

test('T47-EQ News: an item of an older shape is rebuilt to the seven keys when one value is changed, and keys the form does not have are dropped', async () => {
  for (const id of ['fx-news-old-3', 'fx-news-old-5', 'fx-news-old-extra']) {
    const values = { title: '旧形式を1項目変えた' };
    const before = await baseNewsSave({ variant: 'legacyShapes', id, values });
    const after = await newNewsSave({ variant: 'legacyShapes', id, values });
    assert.equal(after, before, id);
    const saved = JSON.parse(after).news.find((item) => item.id === id);
    assert.deepEqual(Object.keys(saved), NEWS_KEYS, `${id} has the seven keys`);
  }
  const dropped = JSON.parse(await newNewsSave({ variant: 'legacyShapes', id: 'fx-news-old-extra', values: { title: 'x' } }));
  assert.equal(dropped.news.find((item) => item.id === 'fx-news-old-extra').futureKey, undefined);
});

test('T47-EQ News: long values, an empty description and an empty image are kept as they are', async () => {
  const values = { description: '' };
  assert.equal(await newNewsSave({ variant: 'longValues', id: 'fx-news-long', values }), await baseNewsSave({ variant: 'longValues', id: 'fx-news-long', values }));
  assert.equal(
    await newNewsSave({ id: 'fx-news-3', values: { image: '', link: '' } }),
    await baseNewsSave({ id: 'fx-news-3', values: { image: '', link: '' } }),
  );
});

test('T47-EQ News: an item whose id looks like a number opens from the list, and its id keeps its type in the body', async () => {
  const { app, puts } = await openOccasionalApp({ variant: 'numericIds' });
  // the list hands the id over as text (a data attribute); the number 101 and the text "102" both open
  assert.equal(app.editNews('101'), true);
  assert.equal(app.getOccState().active.id, 101, 'the id is the item\'s own, not the text from the list');
  await type(app, 'edit-title', '数値IDを変えた');
  assert.equal(await app.saveOccPanel('item'), true);
  const body = JSON.parse(onePut(puts));
  assert.deepEqual(body.news.map((item) => item.id), [101, '102', 103], 'the number stays a number, the text a text, in place');
  assert.equal(body.news[0].title, '数値IDを変えた');

  const second = await openOccasionalApp({ variant: 'numericIds' });
  assert.equal(second.app.editNews('102'), true);
  await type(second.app, 'edit-title', '文字列IDを変えた');
  assert.equal(await second.app.saveOccPanel('item'), true);
  assert.deepEqual(JSON.parse(onePut(second.puts)).news.map((item) => item.id), [101, '102', 103]);
});

// ======================================================================================================
// T47-SAVE
// ======================================================================================================
test('T47-SAVE the four states: 保存済み, 未保存, 保存しています…, 保存できませんでした; typing a value and putting it back is 保存済み again', async () => {
  const gate = deferred();
  const { app, puts } = await openOccasionalApp({ putGate: gate });
  app.editNews('fx-news-2');
  assert.equal(status(app), '保存済み');
  assert.equal(statusWide(app), '保存済み');
  assert.equal(app.isOccDirty(), false);

  await type(app, 'edit-title', '変えた');
  assert.equal(status(app), '未保存');
  assert.equal(statusWide(app), '未保存');
  assert.equal(app.isOccDirty(), true);

  await type(app, 'edit-title', occasionalData().news[1].title);
  assert.equal(status(app), '保存済み', 'back to the saved value');
  assert.equal(app.isOccDirty(), false);

  await type(app, 'edit-title', '変えた');
  const saving = app.saveOccPanel('item');
  assert.equal(status(app), '保存しています…');
  assert.equal(statusWide(app), '保存しています…');
  assert.equal(app.getOccState().saving, true);
  gate.resolve();
  assert.equal(await saving, true);
  assert.equal(status(app), '保存済み');
  assert.equal(puts.length, 1);
  assert.equal(app.isOccDirty(), false);
});

test('T47-SAVE a new item is 保存済み until something is typed, is not in the list until saved, and becomes the edit of the saved item', async () => {
  const { app, puts } = await openOccasionalApp();
  assert.equal(app.addNews(), true);
  assert.equal(status(app), '保存済み');
  assert.equal(app.isOccDirty(), false);
  assert.equal(el(app, 'news-list').innerHTML.includes('新しいお知らせ'), false);
  assert.equal(el(app, 'edit-linkText').value, 'view...');
  assert.equal(el(app, 'news-delete-btn'), undefined, 'no delete for a new item');
  assert.equal(app.getOccState().active.isNew, true);

  await typeAll(app, { title: '新しいお知らせ', date: '2026/12/1(Tue.)' });
  assert.equal(status(app), '未保存');
  assert.equal(await app.saveOccPanel('item'), true);
  assert.equal(puts.length, 1);

  const active = app.getOccState().active;
  assert.equal(active.isNew, false, 'the same edit surface now edits the saved item');
  assert.match(String(active.id), /^news-\d+$/);
  assert.ok(el(app, 'news-delete-btn'), 'delete is offered now');
  assert.equal(el(app, 'news-list').innerHTML.includes('新しいお知らせ'), true);
  assert.equal(app.getSiteData().news[0].title, '新しいお知らせ');
  assert.equal(app.getSiteData().news.length, 7);
  assert.equal(status(app), '保存済み');

  // saving the same surface again replaces the item (it is not added a second time)
  await type(app, 'edit-title', '2度目');
  assert.equal(await app.saveOccPanel('item'), true);
  const second = JSON.parse(puts[1].body);
  assert.equal(second.news.length, 7);
  assert.equal(second.news[0].title, '2度目');
});

test('T47-SAVE saving with nothing to save sends nothing and answers true', async () => {
  const { app, puts } = await openOccasionalApp();
  app.editNews('fx-news-1');
  assert.equal(await app.saveOccPanel('item'), true);
  assert.equal(puts.length, 0);
  assert.equal(status(app), '保存済み');
});

test('T47-SAVE while saving, the inputs, the moves, delete and add are locked, and a second click sends one PUT', async () => {
  const gate = deferred();
  const { app, puts } = await openOccasionalApp({ putGate: gate });
  app.setupTabs();
  app.editNews('fx-news-2');
  await type(app, 'edit-title', '保存中の入力');
  const first = app.saveOccPanel('item');
  const second = app.saveOccPanel('item');
  assert.equal(await second, false, 'the second click is ignored');

  for (const id of ['edit-title', 'edit-date', 'edit-description', 'edit-link', 'edit-linkText', 'news-save-btn', 'news-editor-back', 'news-add-btn', 'news-delete-btn', 'global-tab-live', 'global-tab-site']) {
    assert.equal(el(app, id).disabled, true, `${id} is locked`);
  }
  assert.equal(app.editNews('fx-news-3'), false, 'another item does not open while saving');
  assert.equal(app.addNews(), false);
  assert.equal(app.closeOccEditor(), false);
  assert.equal(await app.deleteOccItem(), false);

  gate.resolve();
  assert.equal(await first, true);
  assert.equal(puts.length, 1, 'one PUT for two clicks');
  for (const id of ['edit-title', 'news-save-btn', 'news-editor-back', 'news-add-btn', 'global-tab-live']) {
    assert.equal(el(app, id).disabled, false, `${id} is free again`);
  }
});

test('T47-SAVE a failed save keeps the inputs and the surface, says why, leaves siteData and the saved baseline as they were, and the retry sends the same body', async () => {
  const { app, puts } = await openOccasionalApp({ putStatus: 500, putPayload: { error: 'サーバーの理由' } });
  const before = plain(app.getSiteData());
  app.editNews('fx-news-2');
  await type(app, 'edit-title', '失敗する入力');
  assert.equal(await app.saveOccPanel('item'), false);

  assert.equal(status(app), '保存できませんでした');
  assert.equal(statusWide(app), '保存できませんでした');
  assert.match(errorLine(app), /サーバーの理由/);
  assert.match(toast(app), /保存に失敗しました: サーバーの理由/);
  assert.equal(el(app, 'edit-title').value, '失敗する入力', 'the input is kept');
  assert.equal(app.getOccState().active.id, 'fx-news-2', 'the surface is kept');
  assert.equal(app.isOccDirty(), true);
  assert.deepEqual(plain(app.getSiteData()), before, 'siteData is what it was before the save');
  assert.deepEqual(plain(app.getSavedBaseline()), before, 'and so is the saved baseline');
  assert.equal(el(app, 'edit-title').disabled, false, 'unlocked again');

  app.useAdminFetch(async (path, options = {}) => {
    if (options.method === 'PUT') { puts.push({ path, body: options.body, bodyType: typeof options.body }); return jsonResponse({ ok: true }); }
    return jsonResponse({});
  });
  assert.equal(await app.saveOccPanel('item'), true);
  assert.equal(puts.length, 2);
  assert.equal(puts[1].body, puts[0].body, 'the retry sends exactly the first body');
  assert.equal(errorLine(app), '', 'the reason is gone once it is saved');
  assert.equal(status(app), '保存済み');
});

test('T47-SAVE after a save, siteData and the baseline hold the saved item and the next save is built on it', async () => {
  const { app, puts } = await openOccasionalApp();
  app.editNews('fx-news-2');
  await type(app, 'edit-title', '1回目');
  await app.saveOccPanel('item');
  assert.equal(app.getSiteData().news[1].title, '1回目');
  assert.equal(app.getSavedBaseline().news[1].title, '1回目');
  assert.equal(app.editNews('fx-news-5'), true);
  await type(app, 'edit-title', '2回目');
  await app.saveOccPanel('item');
  const body = JSON.parse(puts[1].body);
  assert.equal(body.news[1].title, '1回目', 'the first save is in the second body');
  assert.equal(body.news[4].title, '2回目');
});

test('T47-SAVE in Local Mode a save reflects into memory and waits for the JSON export; no API call', async () => {
  const { app, puts } = await openOccasionalApp({ api: false });
  app.editNews('fx-news-2');
  await type(app, 'edit-title', 'ローカルで変えた');
  assert.equal(await app.saveOccPanel('item'), true);
  assert.equal(puts.length, 0);
  assert.equal(app.getSiteData().news[1].title, 'ローカルで変えた');
  assert.equal(app.getHasChanges(), true, 'the header JSON export is what finishes it');
  assert.equal(status(app), 'JSON書き出し待ち');
  assert.match(toast(app), /編集内容を反映しました。右上の「JSONを書き出す」で確定します/);

  // the header JSON export finishes it: the surface no longer waits
  app.setConfirm(() => true);
  await app.invokeSaveData({ silent: true });
  assert.equal(app.getHasChanges(), false);
  assert.equal(status(app), '保存済み');
});

test('T47-SAVE an image that is still uploading is not saved: nothing is sent and the person is told', async () => {
  const gate = deferred();
  class Reader { readAsDataURL() { this.onload?.({ target: { result: 'data:image/png;base64,TEST' } }); } }
  const { app, puts } = await openOccasionalApp({ fileReader: Reader, upload: () => gate.promise.then(() => jsonResponse({ url: 'https://img.example.test/a.png' })) });
  app.editNews('fx-news-2');
  await type(app, 'edit-title', 'アップロード中に保存');
  app.handleImageSelect({ files: [picture('a.png')] }, 'edit-image');
  assert.equal(await app.saveOccPanel('item'), false);
  assert.equal(puts.length, 0);
  assert.match(toast(app), /画像アップロード中です。完了してから保存してください/);
  gate.resolve();
  await flushAsync();
});

// ======================================================================================================
// T47-SCOPE
// ======================================================================================================
async function withUnsavedOtherInputs(app) {
  // Since stages 3-4 Site and the Channel URL hold what is typed in their own inputs (D47-05): it is unsaved there, and in no body.
  await type(app, 'site-footer-text', '未保存のフッター');
  await type(app, 'youtube-channel-url', 'https://example.test/@unsaved-channel');
  assert.equal(app.getOccState().panels.site.dirty, true);
  assert.equal(app.getOccState().panels.channel.dirty, true);
}

test('T47-SCOPE a News save does not send another input\'s unsaved change, keeps everything else (live, ticket, #41 references, hero image), and leaves that change waiting', async () => {
  const { app, puts } = await openOccasionalApp();
  await withUnsavedOtherInputs(app);
  app.editNews('fx-news-2');
  await type(app, 'edit-title', '対象だけ');
  assert.equal(await app.saveOccPanel('item'), true);

  const expected = occasionalData();
  expected.news[1] = { ...expected.news[1], title: '対象だけ' };
  const body = onePut(puts);
  assert.equal(body, asBody(expected), 'the saved baseline + this item only');
  assert.doesNotMatch(body, /未保存のフッター|unsaved-channel/);
  const sent = JSON.parse(body);
  assert.equal(sent.site.featuredReleaseId, 'fx-release-a');
  assert.equal(sent.site.heroImage, 'assets/images/fixture-hero.jpg');
  assert.equal(sent.live.upcoming[0].id, 'fx-live-up');
  assert.equal(sent.ticket.completeText, '架空の完了文です。');

  assert.equal(app.getOccState().panels.site.dirty, true, 'the other change still waits for its own save');
  assert.equal(el(app, 'site-footer-text').value, '未保存のフッター', 'and is still in its input, untouched');
  assert.equal(el(app, 'youtube-channel-url').value, 'https://example.test/@unsaved-channel');
  assert.equal(app.getSiteData().site.footerText, occasionalData().site.footerText, 'siteData never held it (D47-05)');
  assert.equal(app.getSavedBaseline().site.footerText, occasionalData().site.footerText, 'the baseline holds only what was saved');
});

test('T47-SCOPE (intended difference from before #47) the modal 更新 sent another input\'s unsaved change along with the News item; the edit surface does not', async () => {
  const before = await openOccasionalApp({ base: true });
  const footer = el(before.app, 'site-footer-text');
  footer.value = '未保存のフッター';
  footer.onchange();
  before.app.editNews('fx-news-2');
  fillBase(before.app, { title: '対象だけ' });
  assert.equal(await before.app.saveModal(), true);
  assert.match(onePut(before.puts), /未保存のフッター/, 'before #47 the whole data went out, the unsaved footer with it (D47-05, D47-10 change this on purpose)');

  const after = await openOccasionalApp();
  await withUnsavedOtherInputs(after.app);
  after.app.editNews('fx-news-2');
  await type(after.app, 'edit-title', '対象だけ');
  await after.app.saveOccPanel('item');
  assert.doesNotMatch(onePut(after.puts), /未保存のフッター/);
});

test('T47-SCOPE a News delete sends the baseline without that item and nothing of another input\'s unsaved change', async () => {
  const { app, puts } = await openOccasionalApp();
  await withUnsavedOtherInputs(app);
  app.editNews('fx-news-2');
  const pending = app.deleteOccItem();
  await answerLiveDialog(app, 'delete');
  assert.equal(await pending, true);

  const expected = occasionalData();
  expected.news = expected.news.filter((item) => item.id !== 'fx-news-2');
  const body = onePut(puts);
  assert.equal(body, asBody(expected));
  assert.doesNotMatch(body, /未保存のフッター|unsaved-channel/);
  assert.equal(app.getOccState().panels.site.dirty, true);
  assert.equal(el(app, 'site-footer-text').value, '未保存のフッター');
});

test('T47-SCOPE (stage 5) the header 保存 sends nothing while the API is connected; the News save carries the News item and nothing that is typed and not saved', async () => {
  const { app, puts } = await openOccasionalApp();
  await withUnsavedOtherInputs(app);
  app.editNews('fx-news-2');
  await type(app, 'edit-title', 'ニュースだけ先に');
  await app.saveOccPanel('item');
  assert.equal(puts.length, 1);
  assert.equal(await app.invokeSaveData({ silent: true }), false, 'the whole data is not sent from anywhere (D47-08)');
  assert.equal(puts.length, 1, 'no second request');
  const body = JSON.parse(puts[0].body);
  assert.equal(body.news[1].title, 'ニュースだけ先に');
  assert.equal(body.site.footerText, occasionalData().site.footerText, 'the unsaved footer was never in siteData (D47-05)');
  assert.equal(body.youtube.channelUrl, occasionalData().youtube.channelUrl);
});

test('T47-SCOPE a failed save does not move the saved baseline; a duplicate Live id is not sent', async () => {
  const { app, puts } = await openOccasionalApp();
  const baseline = plain(app.getSavedBaseline());
  baseline.live.past.push(plain(baseline.live.upcoming[0]));
  app.setSavedBaseline(baseline);
  app.editNews('fx-news-2');
  await type(app, 'edit-title', '重複する');
  assert.equal(await app.saveOccPanel('item'), false);
  assert.equal(puts.length, 0, 'a duplicate Live id is not sent');
  assert.match(errorLine(app), /Live IDが重複しています: fx-live-up/);
  assert.equal(status(app), '保存できませんでした');
  assert.equal(el(app, 'edit-title').value, '重複する');
  assert.deepEqual(plain(app.getSavedBaseline()), baseline);
});

test('T47-SCOPE the slice functions touch only the news list', () => {
  const data = occasionalData();
  const loaded = occasionalData();
  return openOccasionalApp().then(({ app }) => {
    const item = { id: 'fx-news-3', date: 'd', title: 't', description: '', image: '', link: '', linkText: 'view...' };
    const replaced = plain(app.applyNewsSlice(plain(data), item));
    assert.deepEqual(replaced.news[2], item);
    assert.deepEqual({ ...replaced, news: null }, { ...loaded, news: null }, 'only news changed');
    // a numeric id is found by its text (D47-17) and an unknown id goes to the head, not silently nowhere
    const numeric = occasionalData('numericIds');
    assert.equal(plain(app.applyNewsSlice(plain(numeric), { ...item, id: 101 })).news[0].id, 101);
    assert.equal(plain(app.applyNewsSlice(plain(numeric), { ...item, id: 101 })).news.length, 3);
    const unknown = plain(app.applyNewsSlice(plain(data), { ...item, id: 'fx-news-missing' }));
    assert.equal(unknown.news[0].id, 'fx-news-missing');
    assert.equal(unknown.news.length, 7);
    const removed = plain(app.applyOccDeleteSlice(plain(data), 'news', 'fx-news-2'));
    assert.deepEqual(removed.news.map((entry) => entry.id), data.news.map((entry) => entry.id).filter((id) => id !== 'fx-news-2'));
    assert.deepEqual({ ...removed, news: null }, { ...loaded, news: null });
  });
});

// ======================================================================================================
// T47-GUARD
// ======================================================================================================
async function dirtyNews() {
  const opened = await openOccasionalApp();
  opened.app.setupTabs();
  opened.app.editNews('fx-news-2');
  await type(opened.app, 'edit-title', '未保存の題');
  return opened;
}

const MOVES = {
  'another item': (app) => app.editNews('fx-news-3'),
  '‹ 一覧': (app) => app.closeOccEditor(),
  '+ 追加': (app) => app.addNews(),
  'a global tab': (app) => { void el(app, 'global-tab-music').dispatch('click'); },
};

for (const [name, move] of Object.entries(MOVES)) {
  test(`T47-GUARD unsaved + ${name}: the confirmation surface opens with 編集を続ける focused; Stay, Escape and the backdrop change nothing; 破棄して移動 moves and drops the input`, async () => {
    const { app } = await dirtyNews();
    el(app, 'edit-title').focus();
    const result = move(app);
    await flushAsync();
    assert.equal(dialogOpen(app), true, 'the surface opens');
    assert.match(dialogHtml(app), new RegExp(unsavedTitle));
    assert.match(dialogHtml(app), /破棄して移動/);
    assert.match(dialogHtml(app), /編集を続ける/);
    assert.equal(app.document.activeElement, el(app, 'live-dialog-action-stay'), 'the safe choice has the focus');
    assert.equal(el(app, 'live-dialog').getAttribute('aria-modal') ?? 'true', 'true');

    await answerLiveDialog(app, 'stay');
    await flushAsync();
    assert.equal(app.document.activeElement, el(app, 'edit-title'), 'the focus is back where it was');
    if (result && typeof result.then === 'function') assert.equal(await result, false);
    assert.equal(app.getOccState().active.id, 'fx-news-2', 'still the same item');
    assert.equal(el(app, 'edit-title').value, '未保存の題', 'the input is kept');
    assert.equal(app.isOccDirty(), true);

    // Escape and the backdrop choose the safe choice, too
    move(app);
    await flushAsync();
    await app.dispatchDocument('keydown', { key: 'Escape', preventDefault() {} });
    assert.equal(dialogOpen(app), false);
    assert.equal(app.getOccState().active.id, 'fx-news-2');
    assert.equal(el(app, 'edit-title').value, '未保存の題');

    const again = move(app);
    await answerLiveDialog(app, 'discard');
    await flushAsync();
    if (again && typeof again.then === 'function') assert.notEqual(await again, false);
    assert.equal(app.isOccDirty(), false, 'nothing is unsaved after the input was dropped');
    assert.equal(app.getSiteData().news[1].title, occasionalData().news[1].title, 'and nothing was saved');
  });
}

test('T47-GUARD after 破棄して移動 the input is back to the saved content (the same item shown again is not the dropped text)', async () => {
  const { app } = await dirtyNews();
  const moved = app.editNews('fx-news-3');
  await answerLiveDialog(app, 'discard');
  assert.equal(await moved, true);
  assert.equal(el(app, 'edit-title').value, occasionalData().news[2].title);
  assert.equal(app.editNews('fx-news-2'), true, 'nothing unsaved now, so it opens at once');
  assert.equal(el(app, 'edit-title').value, occasionalData().news[1].title);
});

test('T47-GUARD with nothing unsaved no surface opens and the move is made at once (synchronously)', async () => {
  const { app } = await openOccasionalApp();
  app.setupTabs();
  assert.equal(app.editNews('fx-news-2'), true);
  assert.equal(app.editNews('fx-news-3'), true, 'another item, at once');
  assert.equal(app.addNews(), true, '+ 追加, at once');
  assert.equal(app.closeOccEditor(), true, '‹ 一覧, at once');
  assert.equal(app.getOccState().active, null);
  assert.equal(dialogOpen(app), false);
  app.editNews('fx-news-2');
  await el(app, 'global-tab-music').dispatch('click');
  assert.equal(dialogOpen(app), false);
  assert.equal(app.getActiveGlobalTab(), 'music');
  assert.equal(app.getOccState().active, null, 'leaving News closes its edit surface');
});

test('T47-GUARD a new item with something typed is unsaved too; typing and putting it back is not', async () => {
  const { app } = await openOccasionalApp();
  app.addNews();
  await type(app, 'edit-title', 'あ');
  assert.equal(app.isOccDirty(), true);
  await type(app, 'edit-title', '');
  assert.equal(app.isOccDirty(), false);
  assert.equal(app.closeOccEditor(), true);
});

test('T47-GUARD the browser asks before leaving while something is unsaved, saving, or uploading; not otherwise', async () => {
  const asks = async (app) => {
    const event = { prevented: false, returnValue: undefined, preventDefault() { this.prevented = true; } };
    await app.dispatchWindow('beforeunload', event);
    return event.prevented;
  };
  const clean = await openOccasionalApp();
  clean.app.editNews('fx-news-2');
  assert.equal(await asks(clean.app), false);
  await type(clean.app, 'edit-title', '未保存');
  assert.equal(await asks(clean.app), true, 'unsaved');
  await type(clean.app, 'edit-title', occasionalData().news[1].title);
  assert.equal(await asks(clean.app), false, 'put back');

  const gate = deferred();
  const saving = await openOccasionalApp({ putGate: gate });
  saving.app.editNews('fx-news-2');
  await type(saving.app, 'edit-title', '保存中');
  const pending = saving.app.saveOccPanel('item');
  assert.equal(await asks(saving.app), true, 'saving');
  gate.resolve();
  await pending;
  assert.equal(await asks(saving.app), false, 'saved');

  const local = await openOccasionalApp({ api: false });
  local.app.editNews('fx-news-2');
  await type(local.app, 'edit-title', 'ローカル');
  await local.app.saveOccPanel('item');
  assert.equal(await asks(local.app), true, 'Local Mode waiting for the JSON export');
});

// ======================================================================================================
// T47-DELETE (News)
// ======================================================================================================
test('T47-DELETE the confirmation names the item, says it also leaves the public page, and has やめる (focused) and 削除する', async () => {
  const { app, puts } = await openOccasionalApp();
  app.editNews('fx-news-2');
  const pending = app.deleteOccItem();
  await flushAsync();
  const html = dialogHtml(app);
  assert.match(html, /「テスト &quot;引用符&quot; のお知らせ」を削除しますか。/, 'the title is escaped');
  assert.match(html, /削除すると公開画面からも消えます。/);
  assert.match(html, /やめる/);
  assert.match(html, /削除する/);
  assert.equal(app.document.activeElement, el(app, 'live-dialog-action-cancel'));
  await answerLiveDialog(app, 'cancel');
  assert.equal(await pending, false);
  assert.equal(puts.length, 0);
  assert.equal(app.getSiteData().news.length, 6);
  assert.equal(app.getOccState().active.id, 'fx-news-2', 'nothing changed');

  // an item with no title
  const empty = await openOccasionalApp();
  empty.app.editNews('fx-news-3');
  await type(empty.app, 'edit-title', '');
  await empty.app.saveOccPanel('item');
  const second = empty.app.deleteOccItem();
  await flushAsync();
  assert.match(dialogHtml(empty.app), /このお知らせを削除しますか。/);
  await answerLiveDialog(empty.app, 'cancel');
  await second;
});

test('T47-DELETE 削除する saves once, closes the surface to the list, and the list no longer has the item', async () => {
  const { app, puts } = await openOccasionalApp();
  app.editNews('fx-news-4');
  const pending = app.deleteOccItem();
  await answerLiveDialog(app, 'delete');
  assert.equal(await pending, true);
  assert.equal(puts.length, 1);
  assert.equal(app.getOccState().active, null, 'back at the list');
  assert.equal(app.getSiteData().news.some((item) => item.id === 'fx-news-4'), false);
  assert.equal(app.getSavedBaseline().news.some((item) => item.id === 'fx-news-4'), false);
  assert.equal(el(app, 'news-list').innerHTML.includes('fx-news-4'), false);
  assert.match(toast(app), /削除しました/);
});

test('T47-DELETE a failed delete keeps the item in the list and the surface and the inputs; siteData is as before', async () => {
  const { app, puts } = await openOccasionalApp({ putStatus: 500, putPayload: { error: '削除できない理由' } });
  const before = plain(app.getSiteData());
  app.editNews('fx-news-4');
  await type(app, 'edit-title', '入力は残る');
  const pending = app.deleteOccItem();
  await answerLiveDialog(app, 'delete');
  assert.equal(await pending, false);
  assert.equal(puts.length, 1);
  assert.equal(app.getOccState().active.id, 'fx-news-4');
  assert.equal(el(app, 'edit-title').value, '入力は残る');
  assert.deepEqual(plain(app.getSiteData()), before);
  assert.equal(el(app, 'news-list').innerHTML.includes('fx-news-4'), true, 'the item is still in the list');
  assert.equal(status(app), '保存できませんでした');
  assert.match(errorLine(app), /削除できない理由/);
  assert.match(toast(app), /削除に失敗しました: 削除できない理由/);
});

test('T47-DELETE in Local Mode the delete is made in memory and waits for the JSON export; a new item has no delete', async () => {
  const { app, puts } = await openOccasionalApp({ api: false });
  app.editNews('fx-news-1');
  const pending = app.deleteOccItem();
  await answerLiveDialog(app, 'delete');
  assert.equal(await pending, true);
  assert.equal(puts.length, 0);
  assert.equal(app.getSiteData().news.some((item) => item.id === 'fx-news-1'), false);
  assert.equal(app.getHasChanges(), true);

  app.addNews();
  assert.equal(await app.deleteOccItem(), false, 'a new item cannot be deleted');
});

// ======================================================================================================
// T47-IMAGE (the News picture)
// ======================================================================================================
const picture = (name) => Object.assign(new Blob(['x'], { type: 'image/png' }), { name });

class ImmediateReader {
  readAsDataURL() { this.onload?.({ target: { result: 'data:image/png;base64,TEST_IMAGE' } }); }
}

test('T47-IMAGE choosing a picture is unsaved while it uploads (save cannot be pressed) and after it, while it differs from the saved picture; then it is saved with the URL', async () => {
  const gate = deferred();
  const { app, puts } = await openOccasionalApp({
    fileReader: ImmediateReader,
    upload: () => gate.promise.then(() => jsonResponse({ url: 'https://img.example.test/uploaded.png' })),
  });
  app.editNews('fx-news-2');
  assert.equal(app.isOccDirty(), false);
  assert.equal(el(app, 'edit-image-select-btn').textContent, '画像を変える');

  assert.equal(app.handleImageSelect({ files: [picture('Pic One.png')] }, 'edit-image'), true);
  assert.equal(app.isOccDirty(), true, 'uploading counts as unsaved');
  assert.equal(status(app), '未保存');
  assert.equal(el(app, 'edit-image-status').textContent, 'アップロードしています…');
  assert.equal(el(app, 'news-save-btn').disabled, true, 'save cannot be pressed while uploading');
  assert.equal(el(app, 'edit-image').value, 'assets/images/fixture-news-2.png', 'the current picture is kept until it is uploaded');

  gate.resolve();
  await flushAsync();
  assert.equal(el(app, 'edit-image').value, 'https://img.example.test/uploaded.png');
  assert.equal(el(app, 'edit-image-path').textContent, 'URL: https://img.example.test/uploaded.png');
  assert.equal(el(app, 'edit-image-status').textContent, '');
  assert.equal(app.isOccDirty(), true, 'the picture differs from the saved one');
  assert.equal(el(app, 'news-save-btn').disabled, false);
  assert.equal(app.getSiteData().news[1].image, 'assets/images/fixture-news-2.png', 'siteData is not touched by the choice');

  assert.equal(await app.saveOccPanel('item'), true);
  assert.equal(JSON.parse(onePutBody(puts)).news[1].image, 'https://img.example.test/uploaded.png');
  assert.equal(app.isOccDirty(), false);
});

const onePutBody = (puts) => onePut(puts);

test('T47-IMAGE a failed upload says so with the reason, keeps the current picture, and the surface is not unsaved because of it', async () => {
  const { app } = await openOccasionalApp({
    fileReader: ImmediateReader,
    upload: () => jsonResponse({ error: 'アップロードの理由' }, { ok: false, status: 400 }),
  });
  app.editNews('fx-news-2');
  app.handleImageSelect({ files: [picture('bad.png')] }, 'edit-image');
  await flushAsync();
  assert.equal(el(app, 'edit-image-status').textContent, '画像をアップロードできませんでした（アップロードの理由）');
  assert.equal(el(app, 'edit-image').value, 'assets/images/fixture-news-2.png');
  assert.equal(el(app, 'edit-image-select-btn').textContent, '画像を変える');
  assert.equal(app.isOccDirty(), false);
  assert.equal(status(app), '保存済み');
});

test('T47-IMAGE 画像を外す empties the picture (unsaved) and the button says 画像を選ぶ; the same surface shown again after 破棄 has the saved picture back', async () => {
  const { app, puts } = await openOccasionalApp();
  app.editNews('fx-news-2');
  assert.equal(el(app, 'edit-image-clear-btn').hidden, false);
  assert.equal(app.clearImage('edit-image'), true);
  assert.equal(el(app, 'edit-image').value, '');
  assert.equal(el(app, 'edit-image-select-btn').textContent, '画像を選ぶ');
  assert.equal(el(app, 'edit-image-clear-btn').hidden, true);
  assert.equal(el(app, 'edit-image-path').textContent, '');
  assert.equal(app.isOccDirty(), true);
  assert.equal(status(app), '未保存');
  assert.equal(app.getSiteData().news[1].image, 'assets/images/fixture-news-2.png');

  const moved = app.editNews('fx-news-3');
  await answerLiveDialog(app, 'discard');
  await moved;
  assert.equal(el(app, 'edit-image').value, 'assets/images/fixture-news-3.jpg');
  assert.equal(puts.length, 0);
});

test('T47-IMAGE 破棄して移動 while a picture uploads releases the upload: it does not finish into the next item', async () => {
  const gate = deferred();
  const { app } = await openOccasionalApp({
    fileReader: ImmediateReader,
    upload: () => gate.promise.then(() => jsonResponse({ url: 'https://img.example.test/late.png' })),
  });
  app.editNews('fx-news-2');
  app.handleImageSelect({ files: [picture('late.png')] }, 'edit-image');
  const moved = app.editNews('fx-news-3');
  assert.equal(typeof moved.then, 'function', 'an upload in progress asks first');
  await flushAsync();
  assert.match(dialogHtml(app), new RegExp(unsavedTitle));
  await answerLiveDialog(app, 'discard');
  assert.equal(await moved, true);
  assert.equal(app.ensureNoActiveImageUploads(), true, 'the upload was released');

  gate.resolve();
  await flushAsync();
  assert.equal(el(app, 'edit-image').value, 'assets/images/fixture-news-3.jpg', 'the late upload did not reach the next item');
  assert.equal(app.isOccDirty(), false);
});

test('T47-IMAGE in Local Mode the picture gets a file name from the date and is part of the save; nothing is uploaded', async () => {
  const { app, puts } = await openOccasionalApp({ api: false, fileReader: ImmediateReader });
  app.editNews('fx-news-2');
  assert.equal(app.handleImageSelect({ files: [picture('Local Pic.PNG')] }, 'edit-image'), true);
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const path = `assets/images/Local_Pic_${day}.png`;
  assert.equal(el(app, 'edit-image').value, path);
  assert.equal(el(app, 'edit-image-path').textContent, `パス: ${path}`);
  assert.equal(app.isOccDirty(), true);
  assert.equal(await app.saveOccPanel('item'), true);
  assert.equal(puts.length, 0);
  assert.equal(app.getSiteData().news[1].image, path);
});

// ======================================================================================================
// Stages 3 and 4: Music (works, videos, the Channel URL), Site and Profile on the same surfaces.
//   T47-EQ      the same operation on the app of the base commit and on the current one sends the same PUT body (string)
//   T47-SCOPE   a save sends the last saved content + only its own target
//   T47-DELETE  a work / a video: a confirmation (what else goes back to empty), then one save
//   T47-DATE    the date of a work and the id of a video are checked before anything is sent; empty stays allowed
//   T47-IMAGE   the picture of Site / Profile is held by the screen (unsaved there) and saved with it
// What changes on purpose (D47-05, D47-09, D47-10): the delete is one step (the base needed a second one, the header 保存); Site, Profile and
// the Channel URL are not written to siteData by typing; a save does not carry another input's unsaved change.
// ======================================================================================================
const RELEASE_KEYS = ['id', 'title', 'releaseDate', 'description', 'image', 'link', 'releaseType', 'playbackVideoId'];
const VIDEO_KEYS = ['id', 'title', 'youtubeId'];
// disc-<time> / yt-<time> are the only parts of a new item's body that depend on the clock.
const clockless = (body) => body.replace(/(disc|yt)-\d{10,}/g, '$1-<time>');
const releaseOpen = (id, category) => (app) => app.editDiscography(id, category);
const videoOpen = (id, category) => (app) => app.editYouTubeVideo(id, category);
const ALL_WORKS = [['fx-release-a', 'digital'], ['fx-release-b', 'digital'], ['fx-demo-a', 'demo'], ['fx-demo-b', 'demo']];
const ALL_VIDEOS = [['yt-musicVideos-fixture-1', 'musicVideos'], ['yt-musicVideos-fixture-2', 'musicVideos'], ['yt-liveMovies-fixture-1', 'liveMovies'], ['yt-liveMovies-fixture-2', 'liveMovies'], ['yt-demos-fixture-1', 'demos']];

// The base app: the modal 更新 (or the delete, which needs the header 保存 as a second step).
async function saveBase({ variant = null, open, values = {}, doDelete = false }) {
  const { app, puts } = await openOccasionalApp({ base: true, variant });
  assert.equal(open(app), true);
  fillBase(app, values);
  if (doDelete) {
    app.setConfirm(() => true);
    assert.equal(app.deleteItem(), true);
    assert.equal(puts.length, 0, 'base: the delete is only made in memory; the header 保存 sends it (a second step)');
    assert.equal(await app.invokeSaveData({ silent: true }), true);
  } else {
    assert.equal(await app.saveModal(), true);
  }
  return onePut(puts);
}

// The current app: the edit surface's 保存して公開 (or the delete, which is one step).
async function saveNew({ variant = null, open, values = {}, doDelete = false, force = false }) {
  const { app, puts } = await openOccasionalApp({ variant });
  assert.equal(open(app), true);
  if (doDelete) {
    const pending = app.deleteOccItem();
    await answerLiveDialog(app, 'delete');
    assert.equal(await pending, true);
  } else {
    await typeAll(app, values);
    assert.equal(await app.saveOccPanel('item', force ? { force: true } : {}), true);
  }
  return onePut(puts);
}

// ---- T47-EQ: works ----------------------------------------------------------------------------------
test('T47-EQ work: changing one value of each work sends the body the modal 更新 sent (same keys, order and position: a save moves the work to the head of its category)', async () => {
  for (const [id, category] of ALL_WORKS) {
    const values = { title: '題だけ変えた "二重引用符" ＆ 全角！' };
    const after = await saveNew({ open: releaseOpen(id, category), values });
    assert.equal(after, await saveBase({ open: releaseOpen(id, category), values }), id);
    const sent = JSON.parse(after).discography[category];
    assert.equal(sent[0].id, id);
    assert.deepEqual(Object.keys(sent[0]), RELEASE_KEYS);
  }
});

const ALL_RELEASE_VALUES = {
  category: 'demo',
  title: '変更後の "題" です',
  releaseDate: '2026.05.05',
  description: '1. 一曲目\n2. 二曲目\n\n4. 四曲目',
  image: 'assets/images/fixture-release-new.PNG',
  link: 'https://example.test/release/changed',
  releaseType: 'Album',
  playbackVideoId: 'yt-liveMovies-fixture-2',
};

test('T47-EQ work: changing every field and moving it to the other category sends the same body, with its id and its references kept', async () => {
  const after = await saveNew({ open: releaseOpen('fx-release-a', 'digital'), values: ALL_RELEASE_VALUES });
  assert.equal(after, await saveBase({ open: releaseOpen('fx-release-a', 'digital'), values: ALL_RELEASE_VALUES }));
  const sent = JSON.parse(after);
  assert.equal(sent.discography.demo[0].id, 'fx-release-a', 'at the head of the category it was moved to');
  assert.equal(sent.discography.digital.some((work) => work.id === 'fx-release-a'), false);
  assert.equal(sent.site.featuredReleaseId, 'fx-release-a', 'the face of the site keeps pointing at it (the id did not change)');
  assert.deepEqual(Object.keys(sent.discography.demo[0]), RELEASE_KEYS);
});

test('T47-EQ work: opening a work and saving it without a change sends the same body (forced here: a save with nothing to save sends nothing); a work of an old shape too', async () => {
  for (const [id, category] of ALL_WORKS) {
    assert.equal(await saveNew({ open: releaseOpen(id, category), force: true }), await saveBase({ open: releaseOpen(id, category) }), id);
  }
  for (const [id, category] of [['fx-release-old-5', 'digital'], ['fx-release-old-slash', 'digital'], ['fx-release-old-extra', 'digital'], ['fx-demo-old-number', 'demo'], ['fx-demo-old-missing', 'demo']]) {
    const after = await saveNew({ variant: 'legacyShapes', open: releaseOpen(id, category), force: true });
    assert.equal(after, await saveBase({ variant: 'legacyShapes', open: releaseOpen(id, category) }), id);
    const sent = JSON.parse(after).discography[category][0];
    assert.equal('futureKey' in sent, false, 'a key the form has no input for is not kept (as before)');
  }
});

test('T47-EQ work: a date that is not in the YYYY.MM.DD shape is kept as it was when another field changes (and a work without a date stays without the key)', async () => {
  for (const [id, category] of [['fx-release-old-5', 'digital'], ['fx-release-old-slash', 'digital'], ['fx-demo-old-number', 'demo'], ['fx-demo-old-missing', 'demo']]) {
    const values = { releaseType: '種別だけ変えた' };
    const after = await saveNew({ variant: 'legacyShapes', open: releaseOpen(id, category), values });
    assert.equal(after, await saveBase({ variant: 'legacyShapes', open: releaseOpen(id, category), values }), id);
  }
  const sent = JSON.parse(await saveNew({ variant: 'legacyShapes', open: releaseOpen('fx-demo-old-missing', 'demo'), values: { releaseType: 'x' } }));
  assert.equal('releaseDate' in sent.discography.demo[0], false);
  const numeric = JSON.parse(await saveNew({ variant: 'legacyShapes', open: releaseOpen('fx-demo-old-number', 'demo'), values: { releaseType: 'x' } }));
  assert.equal(numeric.discography.demo[0].releaseDate, 42, 'a number stays a number');
});

test('T47-EQ work: a new work goes to the head of Digital Release (or the category chosen) with the same keys', async () => {
  const values = { title: '新しい作品', releaseDate: '2026.12.01', description: '説明\n\n2行', link: 'https://example.test/new', releaseType: 'EP' };
  const after = clockless(await saveNew({ open: (app) => app.addDiscography(), values }));
  assert.equal(after, clockless(await saveBase({ open: (app) => app.addDiscography(), values })));
  const sent = JSON.parse(after);
  assert.match(sent.discography.digital[0].id, /^disc-<time>$/);
  assert.deepEqual(Object.keys(sent.discography.digital[0]), RELEASE_KEYS);
  assert.equal(sent.discography.digital.length, 3);

  const demo = { ...values, category: 'demo' };
  assert.equal(clockless(await saveNew({ open: (app) => app.addDiscography(), values: demo })), clockless(await saveBase({ open: (app) => app.addDiscography(), values: demo })));
});

test('T47-EQ work: long values and a work of the long-values data are kept as they are', async () => {
  const values = { title: '長くした題'.repeat(12), description: '1. 長い曲名\n'.repeat(30) };
  assert.equal(await saveNew({ variant: 'longValues', open: releaseOpen('fx-release-long', 'digital'), values }), await saveBase({ variant: 'longValues', open: releaseOpen('fx-release-long', 'digital'), values }));
});

// ---- T47-EQ: videos -------------------------------------------------------------------------------------
test('T47-EQ video: changing the title of each video sends the body the modal 更新 sent', async () => {
  for (const [id, category] of ALL_VIDEOS) {
    const values = { title: '題を変えた "映像" ＆ 全角' };
    const after = await saveNew({ open: videoOpen(id, category), values });
    assert.equal(after, await saveBase({ open: videoOpen(id, category), values }), id);
    const sent = JSON.parse(after).youtube[category];
    assert.equal(sent[0].id, id, 'a save moves the video to the head of its category');
    assert.deepEqual(Object.keys(sent[0]), VIDEO_KEYS);
  }
});

test('T47-EQ video: a category move with a URL typed in place of the id sends the 11 characters of the id, in the other category, with the same id', async () => {
  const values = { category: 'liveMovies', title: '移した映像', youtube: 'https://youtu.be/ZZ9999ZZ99a' };
  const after = await saveNew({ open: videoOpen('yt-musicVideos-fixture-1', 'musicVideos'), values });
  assert.equal(after, await saveBase({ open: videoOpen('yt-musicVideos-fixture-1', 'musicVideos'), values }));
  const sent = JSON.parse(after).youtube;
  assert.equal(sent.liveMovies[0].id, 'yt-musicVideos-fixture-1');
  assert.equal(sent.liveMovies[0].youtubeId, 'ZZ9999ZZ99a');
  assert.equal(sent.musicVideos.some((video) => video.id === 'yt-musicVideos-fixture-1'), false);
  const watch = { youtube: 'https://www.youtube.com/watch?v=ABCDEFGHIJK' };
  assert.equal(await saveNew({ open: videoOpen('yt-demos-fixture-1', 'demos'), values: watch }), await saveBase({ open: videoOpen('yt-demos-fixture-1', 'demos'), values: watch }));
});

test('T47-EQ video: opening a video and saving it without a change sends the same body; a video of an old shape too (a URL stored as the id becomes the id)', async () => {
  for (const [id, category] of ALL_VIDEOS) {
    assert.equal(await saveNew({ open: videoOpen(id, category), force: true }), await saveBase({ open: videoOpen(id, category) }), id);
  }
  for (const id of ['yt-old-extra', 'yt-old-url']) {
    const after = await saveNew({ variant: 'legacyShapes', open: videoOpen(id, 'musicVideos'), force: true });
    assert.equal(after, await saveBase({ variant: 'legacyShapes', open: videoOpen(id, 'musicVideos') }), id);
    assert.equal('futureKey' in JSON.parse(after).youtube.musicVideos[0], false);
  }
  assert.equal(JSON.parse(await saveNew({ variant: 'legacyShapes', open: videoOpen('yt-old-url', 'musicVideos'), force: true })).youtube.musicVideos[0].youtubeId, 'fixtureAA09');
});

test('T47-EQ video: a new video goes to the head of the category it is added for, with the same keys', async () => {
  for (const category of ['musicVideos', 'liveMovies', 'demos']) {
    const values = { title: '新しい映像', youtube: 'https://www.youtube.com/watch?v=ABCDEFGHIJK' };
    const after = clockless(await saveNew({ open: (app) => app.addYouTubeVideo(category), values }));
    assert.equal(after, clockless(await saveBase({ open: (app) => app.addYouTubeVideo(category), values })), category);
    const sent = JSON.parse(after).youtube[category][0];
    assert.match(sent.id, /^yt-<time>$/);
    assert.deepEqual(Object.keys(sent), VIDEO_KEYS);
  }
});

// ---- T47-EQ: the Channel URL ------------------------------------------------------------------------
async function saveBaseInputs(apply, variant = null) {
  const { app, puts } = await openOccasionalApp({ base: true, variant });
  await apply(app);
  assert.equal(await app.invokeSaveData({ silent: true }), true);
  return onePut(puts);
}

async function saveNewScreen(key, apply, { variant = null, force = false } = {}) {
  const { app, puts } = await openOccasionalApp({ variant });
  await apply(app);
  assert.equal(await app.saveOccPanel(key, force ? { force: true } : {}), true);
  return onePut(puts);
}

test('T47-EQ Channel URL: the same body as before for a changed URL, an emptied one and an untouched one (forced)', async () => {
  for (const value of ['https://example.test/@changed-channel', '', 'https://www.youtube.com/@全角のチャンネル']) {
    const before = await saveBaseInputs((app) => { const channel = el(app, 'youtube-channel-url'); channel.value = value; channel.onchange(); });
    const after = await saveNewScreen('channel', (app) => type(app, 'youtube-channel-url', value));
    assert.equal(after, before, JSON.stringify(value));
  }
  assert.equal(await saveNewScreen('channel', () => {}, { force: true }), await saveBaseInputs(() => {}));
});

// ---- T47-EQ: Site -----------------------------------------------------------------------------------
const SITE_CHANGES = {
  'site-featured-release-id': 'fx-release-b',
  'site-link-bandcamp': 'https://example.test/shop/changed',
  'site-link-youtube': 'https://example.test/videos/changed',
  'site-link-x': 'https://example.test/x/changed',
  'site-link-instagram': 'https://example.test/photos/changed',
  'site-link-note': 'https://example.test/notes/changed',
  'site-footer-text': '変更後のフッター ＆ "引用符"',
  'contact-intro-text': '変更後の導入文\n2行目\n\n4行目',
  'contact-form-action': 'https://forms.example.test/changed',
};

test('T47-EQ Site: changing each input, all of them, or emptying one sends the body the header 保存 sent after the same change (Site data in the same keys)', async () => {
  for (const [id, value] of Object.entries(SITE_CHANGES)) {
    const before = await saveBaseInputs((app) => { const control = el(app, id); control.value = value; control.onchange(); });
    const after = await saveNewScreen('site', (app) => type(app, id, value));
    assert.equal(after, before, id);
  }
  const all = async (typing) => { for (const [id, value] of Object.entries(SITE_CHANGES)) await typing(id, value); };
  assert.equal(
    await saveNewScreen('site', (app) => all((id, value) => type(app, id, value))),
    await saveBaseInputs((app) => all((id, value) => { const control = el(app, id); control.value = value; control.onchange(); })),
  );
  const emptied = ['site-footer-text', 'contact-intro-text', 'site-link-note', 'site-featured-release-id'];
  assert.equal(
    await saveNewScreen('site', (app) => emptied.reduce((chain, id) => chain.then(() => type(app, id, '')), Promise.resolve())),
    await saveBaseInputs((app) => emptied.forEach((id) => { const control = el(app, id); control.value = ''; control.onchange(); })),
  );
  assert.equal(await saveNewScreen('site', () => {}, { force: true }), await saveBaseInputs(() => {}));
});

test('T47-EQ Site: only the keys that were changed are written; the others stay as the data has them (also when the data has a key the screen does not know)', async () => {
  const data = occasionalData();
  data.site.futureKey = '未知のキー';
  const { app, puts } = await openOccasionalApp({ data });
  await type(app, 'site-footer-text', '一つだけ');
  assert.equal(await app.saveOccPanel('site'), true);
  const sent = JSON.parse(onePut(puts));
  const expected = occasionalData();
  expected.site = { ...data.site, footerText: '一つだけ' };
  assert.equal(onePut(puts), asBody(expected));
  assert.equal(sent.site.futureKey, '未知のキー');
  assert.deepEqual(Object.keys(sent.site), Object.keys(data.site), 'the order of the keys is the data\'s own');
});

// ---- T47-EQ: Profile --------------------------------------------------------------------------------
test('T47-EQ Profile: a changed text, a changed link, an added link, a deleted link and several of them together send what the header 保存 sent', async () => {
  const cases = {
    text: [(app) => { const control = el(app, 'profile-text'); control.value = '変えた文\n\n2段落目'; control.onchange(); }, (app) => type(app, 'profile-text', '変えた文\n\n2段落目')],
    link: [(app) => app.updateProfileLink(1, 'url', 'https://example.test/p/changed'), (app) => type(app, 'profile-link-1-url', 'https://example.test/p/changed')],
    name: [(app) => app.updateProfileLink(2, 'name', '名前を変えた'), (app) => type(app, 'profile-link-2-name', '名前を変えた')],
    add: [
      (app) => { app.addProfileLink(); app.updateProfileLink(4, 'name', '追加した'); app.updateProfileLink(4, 'url', 'https://example.test/p/added'); },
      async (app) => { app.addProfileLink(); await type(app, 'profile-link-4-name', '追加した'); await type(app, 'profile-link-4-url', 'https://example.test/p/added'); },
    ],
    remove: [(app) => app.deleteProfileLink(0), (app) => app.deleteProfileLink(0)],
    together: [
      (app) => { app.updateProfileLink(0, 'name', '先頭'); app.deleteProfileLink(3); app.addProfileLink(); app.updateProfileLink(3, 'url', 'https://example.test/p/last'); },
      async (app) => { await type(app, 'profile-link-0-name', '先頭'); app.deleteProfileLink(3); app.addProfileLink(); await type(app, 'profile-link-3-url', 'https://example.test/p/last'); },
    ],
  };
  for (const [name, [onBase, onNew]] of Object.entries(cases)) {
    assert.equal(await saveNewScreen('profile', onNew), await saveBaseInputs(onBase), name);
  }
  assert.equal(await saveNewScreen('profile', () => {}, { force: true }), await saveBaseInputs(() => {}));
  const kept = JSON.parse(await saveNewScreen('profile', (app) => type(app, 'profile-link-0-name', 'x')));
  assert.deepEqual(Object.keys(kept.profile.links[0]), ['name', 'url']);
});

test('T47-EQ Profile: a link that has a key besides name and url keeps it when it is edited; a new link is { name, url }', async () => {
  const data = occasionalData();
  data.profile.links[1].futureKey = 'kept';
  const { app, puts } = await openOccasionalApp({ data });
  await type(app, 'profile-link-1-url', 'https://example.test/p/edited');
  app.addProfileLink();
  await type(app, 'profile-link-4-name', '新');
  assert.equal(await app.saveOccPanel('profile'), true);
  const links = JSON.parse(onePut(puts)).profile.links;
  assert.deepEqual(links[1], { name: data.profile.links[1].name, url: 'https://example.test/p/edited', futureKey: 'kept' });
  assert.deepEqual(links[4], { name: '新', url: '' });
});

// ---- T47-EQ: the pictures of Site and Profile (T47-IMAGE) -----------------------------------------------------
async function pictureBody({ id, panel, base, clear = false }) {
  const { app, puts } = await openOccasionalApp({ base, fileReader: ImmediateReader, upload: () => jsonResponse({ url: 'https://img.example.test/uploaded.png' }) });
  if (clear) app.clearImage(id);
  else app.handleImageSelect({ files: [picture('Pic.png')] }, id);
  await flushAsync();
  if (base) assert.equal(await app.invokeSaveData({ silent: true }), true);
  else assert.equal(await app.saveOccPanel(panel), true);
  return onePut(puts);
}

test('T47-EQ picture: choosing or removing the picture of Site and of Profile saves the body the header 保存 saved (API)', async () => {
  for (const [id, panel] of [['site-hero-image', 'site'], ['profile-image', 'profile']]) {
    assert.equal(await pictureBody({ id, panel }), await pictureBody({ id, panel, base: true }), `${id} chosen`);
    assert.equal(await pictureBody({ id, panel, clear: true }), await pictureBody({ id, panel, base: true, clear: true }), `${id} removed`);
  }
  assert.match(await pictureBody({ id: 'profile-image', panel: 'profile' }), /"image":"https:\/\/img\.example\.test\/uploaded\.png"/);
});

// ======================================================================================================
// T47-SCOPE (stages 3-4)
// ======================================================================================================
test('T47-SCOPE the Channel URL save does not carry the open video\'s typed title; the video save does not carry the Channel URL', async () => {
  const { app, puts } = await openOccasionalApp();
  app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos');
  await type(app, 'edit-title', '映像の未保存の題');
  await type(app, 'youtube-channel-url', 'https://example.test/@channel-only');
  assert.equal(await app.saveOccPanel('channel'), true);

  const expected = occasionalData();
  expected.youtube.channelUrl = 'https://example.test/@channel-only';
  assert.equal(onePut(puts), asBody(expected), 'the saved baseline + the Channel URL only');
  assert.doesNotMatch(puts[0].body, /映像の未保存の題/);
  assert.equal(el(app, 'edit-title').value, '映像の未保存の題', 'what was typed in the video stays');
  assert.equal(app.getOccState().panels.item.baseline.includes('映像の未保存の題'), false);
  assert.equal(app.isOccDirty('item'), true, 'the video is still unsaved');

  puts.length = 0;
  await type(app, 'youtube-channel-url', 'https://example.test/@typed-after');
  assert.equal(await app.saveOccPanel('item'), true);
  const second = JSON.parse(onePut(puts));
  assert.equal(second.youtube.channelUrl, 'https://example.test/@channel-only', 'the baseline moved with the first save, and the second Channel URL is not carried');
  assert.equal(second.youtube.musicVideos[0].title, '映像の未保存の題');
  assert.doesNotMatch(puts[0].body, /typed-after/);
});

test('T47-SCOPE a work or a video save does not carry the unsaved Site or Profile inputs; a Site or Profile save does not carry another screen\'s', async () => {
  const { app, puts } = await openOccasionalApp();
  await type(app, 'site-footer-text', 'Siteの未保存');
  await type(app, 'profile-text', 'Profileの未保存');
  app.editDiscography('fx-release-b', 'digital');
  await type(app, 'edit-releaseType', '作品だけ');
  assert.equal(await app.saveOccPanel('item'), true);
  assert.doesNotMatch(puts[0].body, /Siteの未保存|Profileの未保存/);
  assert.equal(JSON.parse(puts[0].body).discography.digital[0].releaseType, '作品だけ');

  puts.length = 0;
  assert.equal(await app.saveOccPanel('site'), true);
  const siteBody = JSON.parse(onePut(puts));
  assert.equal(siteBody.site.footerText, 'Siteの未保存');
  assert.equal(siteBody.profile.text, occasionalData().profile.text, 'not the Profile text');
  assert.equal(siteBody.discography.digital[0].releaseType, '作品だけ', 'the work saved before is in the baseline now');

  puts.length = 0;
  assert.equal(await app.saveOccPanel('profile'), true);
  assert.equal(JSON.parse(onePut(puts)).profile.text, 'Profileの未保存');
  assert.equal(app.getOccState().panels.site.dirty, false);
});

test('T47-SCOPE every save keeps live, ticket, the #41 references and the rest; the site / profile / channel saves do not touch the lists', async () => {
  for (const [key, apply] of [
    ['site', (app) => type(app, 'site-link-x', 'https://example.test/x/scope')],
    ['profile', (app) => type(app, 'profile-text', 'scope')],
    ['channel', (app) => type(app, 'youtube-channel-url', 'https://example.test/@scope')],
  ]) {
    const { app, puts } = await openOccasionalApp();
    await apply(app);
    assert.equal(await app.saveOccPanel(key), true);
    const sent = JSON.parse(onePut(puts));
    const fixture = occasionalData();
    assert.deepEqual(sent.live, fixture.live, key);
    assert.deepEqual(sent.ticket, fixture.ticket, key);
    assert.deepEqual(sent.news, fixture.news, key);
    assert.deepEqual(sent.discography, fixture.discography, key);
    assert.equal(sent.site.featuredReleaseId, 'fx-release-a');
    assert.equal(sent.discography.digital[0].playbackVideoId, 'yt-musicVideos-fixture-1');
  }
});

test('T47-SCOPE a failed Site / Channel save keeps siteData and the saved baseline, keeps what was typed, and says why; a duplicate Live id is not sent', async () => {
  const { app, puts } = await openOccasionalApp({ putStatus: 400, putPayload: { error: '理由の文' } });
  await type(app, 'site-footer-text', '失敗する');
  const before = JSON.stringify(app.getSiteData());
  const baseline = plain(app.getSavedBaseline());
  assert.equal(await app.saveOccPanel('site'), false);
  assert.equal(puts.length, 1);
  assert.equal(JSON.stringify(app.getSiteData()), before);
  assert.deepEqual(plain(app.getSavedBaseline()), baseline);
  assert.equal(el(app, 'site-footer-text').value, '失敗する');
  assert.equal(el(app, 'site-editor-status').textContent, '保存できませんでした');
  assert.match(el(app, 'site-editor-error').textContent, /理由の文/);

  const duplicate = await openOccasionalApp();
  const withDuplicate = plain(duplicate.app.getSavedBaseline());
  withDuplicate.live.past.push(plain(withDuplicate.live.upcoming[0]));
  duplicate.app.setSavedBaseline(withDuplicate);
  await type(duplicate.app, 'youtube-channel-url', 'https://example.test/@dup');
  assert.equal(await duplicate.app.saveOccPanel('channel'), false);
  assert.equal(duplicate.puts.length, 0, 'a duplicate Live id is not sent');
  assert.match(el(duplicate.app, 'channel-editor-error').textContent, /Live IDが重複しています: fx-live-up/);
});

test('T47-SCOPE the slice functions touch only their own target', () => {
  return openOccasionalApp().then(({ app }) => {
    const data = occasionalData();
    const loaded = plain(data);
    const channel = plain(app.applyChannelSlice(plain(data), { changes: { channelUrl: 'x' } }));
    assert.equal(channel.youtube.channelUrl, 'x');
    assert.deepEqual({ ...channel, youtube: null }, { ...loaded, youtube: null });
    assert.deepEqual(plain(app.applyChannelSlice(plain(data), { changes: {} })), loaded, 'nothing changed: nothing written');
    const site = plain(app.applySiteSlice(plain(data), { changes: { x: 'y', contactIntro: 'z' } }));
    assert.equal(site.site.links.x, 'y');
    assert.equal(site.contact.introText, 'z');
    assert.deepEqual({ ...site, site: null, contact: null }, { ...loaded, site: null, contact: null });
    const profile = plain(app.applyProfileSlice(plain(data), { changes: { text: 't' } }));
    assert.equal(profile.profile.text, 't');
    assert.deepEqual(profile.profile.links, loaded.profile.links);
    const release = plain(app.applyReleaseSlice(plain(data), { id: 'fx-demo-a', title: 'm' }, 'digital', 'demo'));
    assert.deepEqual(release.discography.digital.map((work) => work.id), ['fx-demo-a', 'fx-release-a', 'fx-release-b']);
    assert.deepEqual(release.discography.demo.map((work) => work.id), ['fx-demo-b']);
    assert.deepEqual({ ...release, discography: null }, { ...loaded, discography: null });
    const unknown = plain(app.applyReleaseSlice(plain(data), { id: 'fx-new', title: 'n' }, 'demo', 'digital'));
    assert.equal(unknown.discography.demo[0].id, 'fx-new');
    assert.equal(unknown.discography.digital.length, 2, 'an item the baseline does not have is added, nothing is removed');
    const video = plain(app.applyVideoSlice(plain(data), { id: 'yt-demos-fixture-1', title: 'v', youtubeId: 'abcdefghijk' }, 'musicVideos', 'demos'));
    assert.deepEqual(video.youtube.demos, []);
    assert.equal(video.youtube.musicVideos[0].id, 'yt-demos-fixture-1');
    const removedWork = plain(app.applyOccDeleteSlice(plain(data), 'release', 'fx-demo-a', 'demo'));
    assert.deepEqual(removedWork.discography.demo.map((work) => work.id), ['fx-demo-b']);
    assert.equal(removedWork.discography.digital.length, 2);
    const removedVideo = plain(app.applyOccDeleteSlice(plain(data), 'video', 'yt-liveMovies-fixture-1'));
    assert.deepEqual(removedVideo.youtube.liveMovies.map((item) => item.id), ['yt-liveMovies-fixture-2']);
  });
});

// ======================================================================================================
// T47-DELETE (works and videos)
// ======================================================================================================
async function openedWork(id, category, options = {}) {
  const opened = await openOccasionalApp(options);
  assert.equal(opened.app.editDiscography(id, category), true);
  return opened;
}

async function askToDelete(app) {
  const pending = app.deleteOccItem();
  await flushAsync();
  return pending;
}

const dialogText = (app) => decodeHtml(dialogHtml(app).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

test('T47-DELETE the confirmation of a work says its title, that it disappears from the public pages, and (only when it is the face of the site) that the face goes back to 自動', async () => {
  const { app } = await openedWork('fx-release-a', 'digital');
  const pending = askToDelete(app);
  assert.equal(dialogOpen(app), true);
  assert.match(dialogText(app), /「架空の作品 A "テスト"」を削除しますか。/);
  assert.match(dialogText(app), /削除すると公開画面からも消えます。/);
  assert.match(dialogText(app), /顔にする作品は「自動（最新のリリース）」に戻ります。/);
  assert.match(dialogHtml(app), /やめる/);
  assert.match(dialogHtml(app), /削除する/);
  assert.equal(app.document.activeElement, el(app, 'live-dialog-action-cancel'), 'the safe choice has the focus');
  await answerLiveDialog(app, 'cancel');
  assert.equal(await pending, false);

  const other = await openedWork('fx-release-b', 'digital');
  const second = askToDelete(other.app);
  assert.doesNotMatch(dialogText(other.app), /顔にする作品は/);
  await answerLiveDialog(other.app, 'cancel');
  await second;

  const empty = occasionalData();
  empty.discography.digital[1].title = '';
  const untitled = await openedWork('fx-release-b', 'digital', { data: empty });
  const third = askToDelete(untitled.app);
  assert.match(dialogText(untitled.app), /この作品を削除しますか。/);
  await answerLiveDialog(untitled.app, 'cancel');
  await third;
});

test('T47-DELETE the confirmation of a video says how many works play it (and nothing about it when none does)', async () => {
  const data = occasionalData();
  data.discography.digital[1].playbackVideoId = 'yt-musicVideos-fixture-1';
  const two = await openOccasionalApp({ data });
  two.app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos');
  const pending = askToDelete(two.app);
  assert.match(dialogText(two.app), /「架空のMV A」を削除しますか。/);
  assert.match(dialogText(two.app), /再生する映像に選んでいる作品が2件あります。「選ばない」に戻り、公開画面では「聴く」が出なくなります。/);
  await answerLiveDialog(two.app, 'cancel');
  await pending;

  const one = await openOccasionalApp();
  one.app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos');
  const single = askToDelete(one.app);
  assert.match(dialogText(one.app), /作品が1件あります/);
  await answerLiveDialog(one.app, 'cancel');
  await single;

  const none = await openOccasionalApp();
  none.app.editYouTubeVideo('yt-demos-fixture-1', 'demos');
  const unplayed = askToDelete(none.app);
  assert.doesNotMatch(dialogText(none.app), /再生する映像に選んでいる/);
  assert.match(dialogText(none.app), /削除すると公開画面からも消えます。/);
  await answerLiveDialog(none.app, 'cancel');
  await unplayed;
});

test('T47-DELETE やめる (and Escape) change nothing: no request, the item and the edit stay', async () => {
  const { app, puts } = await openedWork('fx-release-a', 'digital');
  const before = JSON.stringify(app.getSiteData());
  const pending = askToDelete(app);
  await answerLiveDialog(app, 'cancel');
  assert.equal(await pending, false);
  const escaped = askToDelete(app);
  await app.dispatchDocument('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(await escaped, false);
  assert.equal(puts.length, 0);
  assert.equal(JSON.stringify(app.getSiteData()), before);
  assert.equal(app.getOccState().active.id, 'fx-release-a');
});

test('T47-DELETE deleting the work that is the face of the site and plays a video: one request, the item removed and the face back to empty, the same body the base sent after two steps', async () => {
  const after = await saveNew({ open: releaseOpen('fx-release-a', 'digital'), doDelete: true });
  assert.equal(after, await saveBase({ open: releaseOpen('fx-release-a', 'digital'), doDelete: true }), 'one step now, two before; the body is the same');
  const expected = occasionalData();
  expected.discography.digital = expected.discography.digital.filter((work) => work.id !== 'fx-release-a');
  expected.site.featuredReleaseId = '';
  assert.equal(after, asBody(expected));
  for (const [id, category] of [['fx-release-b', 'digital'], ['fx-demo-a', 'demo'], ['fx-demo-b', 'demo']]) {
    assert.equal(await saveNew({ open: releaseOpen(id, category), doDelete: true }), await saveBase({ open: releaseOpen(id, category), doDelete: true }), id);
  }
});

test('T47-DELETE deleting a video that works play: the works go back to 選ばない in the same request (same body as the base after two steps)', async () => {
  const after = await saveNew({ open: videoOpen('yt-musicVideos-fixture-1', 'musicVideos'), doDelete: true });
  assert.equal(after, await saveBase({ open: videoOpen('yt-musicVideos-fixture-1', 'musicVideos'), doDelete: true }));
  const sent = JSON.parse(after);
  assert.equal(sent.youtube.musicVideos.some((video) => video.id === 'yt-musicVideos-fixture-1'), false);
  assert.equal(sent.discography.digital[0].playbackVideoId, '');
  assert.equal(sent.site.featuredReleaseId, 'fx-release-a', 'nothing else changed');
  for (const [id, category] of ALL_VIDEOS.slice(1)) {
    assert.equal(await saveNew({ open: videoOpen(id, category), doDelete: true }), await saveBase({ open: videoOpen(id, category), doDelete: true }), id);
  }
});

test('T47-DELETE after a delete the list, the options of 顔にする作品 and of その場で再生する映像 no longer have the item, and the edit is closed', async () => {
  const { app } = await openedWork('fx-release-a', 'digital');
  const pending = app.deleteOccItem();
  await answerLiveDialog(app, 'delete');
  assert.equal(await pending, true);
  assert.equal(app.getOccState().active, null);
  assert.doesNotMatch(el(app, 'music-works-list').innerHTML, /fx-release-a/);
  assert.equal(el(app, 'site-featured-release-id').optionValues.includes('fx-release-a'), false);
  assert.equal(el(app, 'site-featured-release-id').value, '');
  assert.equal(app.getSiteData().site.featuredReleaseId, '');
  assert.equal(app.getSiteData().discography.digital.length, 1);
  assert.match(toast(app), /削除しました/);

  app.editYouTubeVideo('yt-musicVideos-fixture-2', 'musicVideos');
  const second = app.deleteOccItem();
  await answerLiveDialog(app, 'delete');
  assert.equal(await second, true);
  assert.doesNotMatch(el(app, 'music-videos-list').innerHTML, /yt-musicVideos-fixture-2/);
});

test('T47-DELETE a failed delete: the item is still in the list and the data, the edit and what was typed stay, and the reason is shown', async () => {
  const { app, puts } = await openedWork('fx-release-a', 'digital', { putStatus: 400, putPayload: { error: '削除の理由' } });
  await type(app, 'edit-title', '削除に失敗した時の入力');
  const before = JSON.stringify(app.getSiteData());
  const pending = app.deleteOccItem();
  await answerLiveDialog(app, 'delete');
  assert.equal(await pending, false);
  assert.equal(puts.length, 1);
  assert.equal(JSON.stringify(app.getSiteData()), before);
  assert.match(el(app, 'music-works-list').innerHTML, /fx-release-a/);
  assert.equal(app.getOccState().active.id, 'fx-release-a');
  assert.equal(el(app, 'edit-title').value, '削除に失敗した時の入力');
  assert.match(el(app, 'music-editor-error').textContent, /削除の理由/);
  assert.equal(el(app, 'music-editor-status').textContent, '保存できませんでした');
  assert.match(toast(app), /削除に失敗しました/);
});

test('T47-DELETE a new work or video has no delete; in Local Mode a delete is made in memory and waits for the JSON export', async () => {
  const { app } = await openOccasionalApp();
  app.addDiscography();
  assert.equal(el(app, 'music-delete-btn'), undefined);
  assert.equal(await app.deleteOccItem(), false);
  app.addYouTubeVideo('demos');
  assert.equal(el(app, 'music-delete-btn'), undefined);

  const local = await openOccasionalApp({ api: false });
  local.app.editDiscography('fx-release-a', 'digital');
  assert.ok(el(local.app, 'music-delete-btn'));
  const pending = local.app.deleteOccItem();
  await answerLiveDialog(local.app, 'delete');
  assert.equal(await pending, true);
  assert.equal(local.puts.length, 0);
  assert.equal(local.app.getHasChanges(), true);
  assert.equal(local.app.getSiteData().site.featuredReleaseId, '');
  assert.match(toast(local.app), /削除内容を反映しました。右上の「JSONを書き出す」で確定します/);
});

// ======================================================================================================
// T47-DATE
// ======================================================================================================
test('T47-DATE a new work or a changed date is checked (YYYY.MM.DD); the reason is right under the date and nothing is sent', async () => {
  const { app, puts } = await openOccasionalApp();
  app.addDiscography();
  await type(app, 'edit-title', '日付を間違えた新作');
  await type(app, 'edit-releaseDate', '2026/12/01');
  assert.equal(await app.saveOccPanel('item'), false);
  assert.equal(puts.length, 0);
  assert.equal(el(app, 'edit-releaseDate-error').textContent, '「2025.05.05」の形で入力してください。');
  assert.equal(el(app, 'edit-releaseDate').getAttribute('aria-invalid'), 'true');
  assert.equal(app.getOccState().active.isNew, true, 'the surface and the input stay');
  assert.equal(el(app, 'edit-releaseDate').value, '2026/12/01');
  await type(app, 'edit-releaseDate', '2026.12.01');
  assert.equal(el(app, 'edit-releaseDate-error').textContent, '');
  assert.equal(await app.saveOccPanel('item'), true);
  assert.equal(puts.length, 1);

  const changed = await openOccasionalApp();
  changed.app.editDiscography('fx-release-b', 'digital');
  await type(changed.app, 'edit-releaseDate', '2025.5.5');
  assert.equal(await changed.app.saveOccPanel('item'), false);
  assert.equal(changed.puts.length, 0);
});

test('T47-DATE a date that is not in the shape is kept when the date is not changed (a save, a move to the other category), and the work without a date still saves', async () => {
  for (const [id, category, other] of [['fx-release-old-5', 'digital', 'demo'], ['fx-release-old-slash', 'digital', 'demo'], ['fx-demo-old-number', 'demo', 'digital'], ['fx-demo-old-missing', 'demo', 'digital']]) {
    const { app, puts } = await openOccasionalApp({ variant: 'legacyShapes' });
    app.editDiscography(id, category);
    await type(app, 'edit-category', other);
    assert.equal(await app.saveOccPanel('item'), true, id);
    const sent = JSON.parse(onePut(puts));
    const moved = sent.discography[other][0];
    assert.equal(moved.id, id);
    assert.equal(moved.releaseDate, occasionalData('legacyShapes').discography[category].find((work) => work.id === id).releaseDate, `${id}: the date is as it was`);
  }
});

test('T47-DATE the structured 400 of the Worker (fields) is shown under the date of the work it names, and only of that one', async () => {
  const payload = { error: 'invalid releaseDate', fields: [{ id: 'fx-release-b', field: 'releaseDate', message: '「2025.05.05」の形で入力してください。' }] };
  const named = await openOccasionalApp({ putStatus: 400, putPayload: payload });
  named.app.editDiscography('fx-release-b', 'digital');
  await type(named.app, 'edit-releaseType', '更新');
  assert.equal(await named.app.saveOccPanel('item'), false);
  assert.equal(el(named.app, 'edit-releaseDate').getAttribute('aria-invalid'), 'true');
  assert.equal(el(named.app, 'edit-releaseDate-error').textContent, '「2025.05.05」の形で入力してください。');
  assert.equal(el(named.app, 'music-editor-status').textContent, '保存できませんでした');

  const other = await openOccasionalApp({ putStatus: 400, putPayload: payload });
  other.app.editDiscography('fx-release-a', 'digital');
  await type(other.app, 'edit-releaseType', '更新');
  assert.equal(await other.app.saveOccPanel('item'), false);
  assert.equal(el(other.app, 'edit-releaseDate').getAttribute('aria-invalid'), 'false');
  assert.equal(el(other.app, 'edit-releaseDate-error').textContent, '');
});

test('T47-DATE the id of a video that cannot be read is shown under the field and nothing is sent; a URL or the 11 characters are accepted', async () => {
  const { app, puts } = await openOccasionalApp();
  app.addYouTubeVideo('musicVideos');
  await type(app, 'edit-title', 'IDの間違い');
  await type(app, 'edit-youtube', 'short');
  assert.equal(await app.saveOccPanel('item'), false);
  assert.equal(puts.length, 0);
  assert.equal(el(app, 'edit-youtube-error').textContent, 'YouTube URL / ID が不正です（IDは11文字）');
  assert.equal(el(app, 'edit-youtube').getAttribute('aria-invalid'), 'true');
  assert.equal(el(app, 'edit-youtube').value, 'short', 'the input stays');
  await type(app, 'edit-youtube', 'https://youtu.be/ABCDEFGHIJK');
  assert.equal(el(app, 'edit-youtube-error').textContent, '');
  assert.equal(await app.saveOccPanel('item'), true);
  assert.equal(JSON.parse(onePut(puts)).youtube.musicVideos[0].youtubeId, 'ABCDEFGHIJK');
});

test('T47-DATE nothing is required: a work with no value at all and a video without a title save (only the id of a video is needed)', async () => {
  const { app, puts } = await openOccasionalApp();
  app.addDiscography();
  await type(app, 'edit-title', '');
  await type(app, 'edit-releaseType', 'x');
  await type(app, 'edit-releaseType', '');
  assert.equal(await app.saveOccPanel('item', { force: true }), true, 'an empty work is allowed');
  const work = JSON.parse(puts[0].body).discography.digital[0];
  assert.deepEqual({ ...work, id: null }, { id: null, title: '', releaseDate: '', description: '', image: '', link: '', releaseType: '', playbackVideoId: '' });

  puts.length = 0;
  app.addYouTubeVideo('demos');
  await type(app, 'edit-youtube', 'ABCDEFGHIJK');
  assert.equal(await app.saveOccPanel('item'), true);
  assert.equal(JSON.parse(onePut(puts)).youtube.demos[0].title, '');
});

// ======================================================================================================
// T47-SAVE for the screens (the four states, Local Mode) and T47-IMAGE of Site and Profile
// ======================================================================================================
const screenStatus = (app, key) => el(app, `${key}-editor-status`).textContent;

for (const [key, id, value] of [['site', 'site-footer-text', '状態を確かめる'], ['profile', 'profile-text', '状態を確かめる'], ['channel', 'youtube-channel-url', 'https://example.test/@state']]) {
  test(`T47-SAVE ${key}: saved → unsaved → saving (nothing can be pressed) → saved; typing the saved value back is saved again; a second click sends one request`, async () => {
    const gate = deferred();
    const { app, puts } = await openOccasionalApp({ putGate: gate });
    assert.equal(screenStatus(app, key), '保存済み');
    const original = el(app, id).value;
    await type(app, id, value);
    assert.equal(screenStatus(app, key), '未保存');
    await type(app, id, original);
    assert.equal(screenStatus(app, key), '保存済み', 'back to what is saved: nothing to save');
    assert.equal(await app.saveOccPanel(key), true);
    assert.equal(puts.length, 0, 'nothing to save sends nothing');

    await type(app, id, value);
    const first = app.saveOccPanel(key);
    assert.equal(screenStatus(app, key), '保存しています…');
    assert.equal(el(app, `${key}-save-btn`).disabled, true);
    assert.equal(el(app, id).disabled, true, 'the input is locked while it saves');
    assert.equal(el(app, 'global-tab-music').disabled, true, 'so are the tabs');
    assert.equal(await app.saveOccPanel(key), false, 'a second click is not a second request');
    gate.resolve();
    assert.equal(await first, true);
    assert.equal(puts.length, 1);
    assert.equal(screenStatus(app, key), '保存済み');
    assert.equal(el(app, id).disabled, false);
    assert.match(toast(app), /保存しました/);
  });

  test(`T47-SAVE ${key} in Local Mode: no request, siteData takes it, 「JSON書き出し待ち」 until the export`, async () => {
    const { app, puts } = await openOccasionalApp({ api: false });
    await type(app, id, value);
    assert.equal(await app.saveOccPanel(key), true);
    assert.equal(puts.length, 0);
    assert.equal(screenStatus(app, key), 'JSON書き出し待ち');
    assert.equal(app.getHasChanges(), true);
    assert.match(toast(app), /編集内容を反映しました。右上の「JSONを書き出す」で確定します/);
  });
}

test('T47-IMAGE Site and Profile: choosing a picture is unsaved while it uploads and after it; siteData does not take it before the save', async () => {
  for (const [id, key, path] of [['site-hero-image', 'site', (data) => data.site.heroImage], ['profile-image', 'profile', (data) => data.profile.image]]) {
    const gate = deferred();
    const { app, puts } = await openOccasionalApp({
      fileReader: ImmediateReader,
      upload: () => gate.promise.then(() => jsonResponse({ url: 'https://img.example.test/page.png' })),
    });
    const saved = path(app.getSiteData());
    assert.equal(el(app, `${id}-select-btn`).textContent, '画像を変える');
    assert.equal(app.handleImageSelect({ files: [picture('Page Pic.png')] }, id), true);
    assert.equal(screenStatus(app, key), '未保存', 'uploading counts as unsaved');
    assert.equal(el(app, `${id}-status`).textContent, 'アップロードしています…');
    assert.equal(el(app, `${key}-save-btn`).disabled, true, 'it cannot be saved while the picture uploads');
    assert.equal(await app.saveOccPanel(key), false);
    assert.match(toast(app), /画像アップロード中です。完了してから保存してください/);
    assert.equal(puts.length, 0);
    gate.resolve();
    await flushAsync();
    assert.equal(el(app, id).value, 'https://img.example.test/page.png');
    assert.equal(el(app, `${id}-path`).textContent, 'URL: https://img.example.test/page.png');
    assert.equal(path(app.getSiteData()), saved, 'siteData is untouched');
    assert.equal(app.getHasChanges(), false, 'and the header 保存 has nothing to say about it');
    assert.equal(app.isOccDirty(), true);
    assert.equal(await app.saveOccPanel(key), true);
    assert.equal(path(app.getSiteData()), 'https://img.example.test/page.png');
    assert.equal(screenStatus(app, key), '保存済み');
  }
});

test('T47-IMAGE Site and Profile: a failed upload says so with the reason and keeps the picture; 画像を外す empties it (unsaved); 破棄 gives the saved picture back and lets a running upload go', async () => {
  const failing = await openOccasionalApp({ fileReader: ImmediateReader, upload: () => jsonResponse({ error: '理由です' }, { ok: false, status: 400 }) });
  failing.app.handleImageSelect({ files: [picture('bad.png')] }, 'profile-image');
  await flushAsync();
  assert.equal(el(failing.app, 'profile-image-status').textContent, '画像をアップロードできませんでした（理由です）');
  assert.equal(el(failing.app, 'profile-image').value, occasionalData().profile.image);
  assert.equal(failing.app.isOccDirty(), false);

  const { app, puts } = await openOccasionalApp({ fileReader: ImmediateReader });
  assert.equal(app.clearImage('site-hero-image'), true);
  assert.equal(el(app, 'site-hero-image').value, '');
  assert.equal(el(app, 'site-hero-image-select-btn').textContent, '画像を選ぶ');
  assert.equal(screenStatus(app, 'site'), '未保存');
  assert.equal(app.getSiteData().site.heroImage, occasionalData().site.heroImage);
  app.setupTabs();
  const moved = el(app, 'global-tab-news').dispatch('click');
  await answerLiveDialog(app, 'discard');
  await moved;
  assert.equal(el(app, 'site-hero-image').value, occasionalData().site.heroImage, 'the saved picture is back');
  assert.equal(app.isOccDirty(), false);

  const gate = deferred();
  const running = await openOccasionalApp({ fileReader: ImmediateReader, upload: () => gate.promise.then(() => jsonResponse({ url: 'https://img.example.test/late.png' })) });
  running.app.setupTabs();
  running.app.handleImageSelect({ files: [picture('late.png')] }, 'profile-image');
  const leaving = el(running.app, 'global-tab-news').dispatch('click');
  await answerLiveDialog(running.app, 'discard');
  await leaving;
  assert.equal(running.app.ensureNoActiveImageUploads(), true, 'the upload was let go');
  gate.resolve();
  await flushAsync();
  assert.equal(el(running.app, 'profile-image').value, occasionalData().profile.image, 'the late upload did not reach the screen');
  assert.equal(puts.length, 0);
});

test('T47-IMAGE Site and Profile in Local Mode: the picture gets a file name from the date, is unsaved until 保存して公開, and nothing is uploaded', async () => {
  const { app, puts } = await openOccasionalApp({ api: false, fileReader: ImmediateReader });
  assert.equal(app.handleImageSelect({ files: [picture('Local Photo.PNG')] }, 'profile-image'), true);
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const path = `assets/images/Local_Photo_${day}.png`;
  assert.equal(el(app, 'profile-image').value, path);
  assert.equal(el(app, 'profile-image-path').textContent, `パス: ${path}`);
  assert.equal(app.getHasChanges(), false, 'the page is not marked changed by choosing it');
  assert.equal(app.getSiteData().profile.image, occasionalData().profile.image);
  assert.equal(await app.saveOccPanel('profile'), true);
  assert.equal(puts.length, 0);
  assert.equal(app.getSiteData().profile.image, path);
  assert.equal(app.getHasChanges(), true);
});

// ======================================================================================================
// Fix found by the Front's capture (stage 4): FIX5 each line of the delete confirmation is a paragraph of its own (F47-14: "説明に1行足す")
// ======================================================================================================
const dialogParagraphs = (app) => [...dialogHtml(app).matchAll(/<p class="live-dialog-body">([^<]*)<\/p>/g)].map((match) => decodeHtml(match[1]));

test('FIX5 the delete confirmation of a work puts 顔にする作品は… in a paragraph of its own, after 削除すると公開画面からも消えます。', async () => {
  const { app } = await openedWork('fx-release-a', 'digital');
  const pending = askToDelete(app);
  assert.deepEqual(dialogParagraphs(app), ['削除すると公開画面からも消えます。', '顔にする作品は「自動（最新のリリース）」に戻ります。']);
  assert.match(dialogHtml(app), /<div id="live-dialog-body" class="occ-dialog-lines">/, 'the dialog still has the element aria-describedby points at');
  await answerLiveDialog(app, 'cancel');
  await pending;

  const other = await openedWork('fx-release-b', 'digital');
  const second = askToDelete(other.app);
  assert.deepEqual(dialogParagraphs(other.app), ['削除すると公開画面からも消えます。'], 'a work that is not the face has the one line');
  await answerLiveDialog(other.app, 'cancel');
  await second;
});

test('FIX5 the delete confirmation of a video puts 再生する映像に選んでいる作品が{N}件あります。… in a paragraph of its own', async () => {
  const data = occasionalData();
  data.discography.digital[1].playbackVideoId = 'yt-musicVideos-fixture-1';
  const { app } = await openOccasionalApp({ data });
  app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos');
  const pending = askToDelete(app);
  assert.deepEqual(dialogParagraphs(app), [
    '削除すると公開画面からも消えます。',
    '再生する映像に選んでいる作品が2件あります。「選ばない」に戻り、公開画面では「聴く」が出なくなります。',
  ]);
  await answerLiveDialog(app, 'cancel');
  await pending;
});

test('FIX5 the Live confirmations keep their one-paragraph body (the markup of #46 is not changed)', async () => {
  const data = occasionalData();
  const { app } = await openOccasionalApp({ data });
  const asking = app.openLiveDialog({ title: 'x', body: '予約が2件あります。削除すると公開画面からも消えます。', actions: [{ id: 'cancel', label: 'やめる', safe: true }] });
  assert.match(dialogHtml(app), /<p id="live-dialog-body" class="live-dialog-body">予約が2件あります。削除すると公開画面からも消えます。<\/p>/);
  assert.doesNotMatch(dialogHtml(app), /occ-dialog-lines/);
  await answerLiveDialog(app, 'cancel');
  await asking;
});
