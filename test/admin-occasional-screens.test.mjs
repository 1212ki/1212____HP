// Issue #47 stages 2-4: the upper band, the five tabs, the News list + edit surface, Music (works, videos, Channel URL), Site and Profile.
//   (stages 3-4) T47-MUSIC  T47-SITE  T47-PROFILE  T47-IMAGE of the screens
//   T47-HEADER  the Header is the Live master's (one row: 1212 Admin on the left, the connection on the right; no 保存 button)
//   T47-TABS    five tabs in this order, no YouTube / Disco tab, the old Music sections live in #music-tab
//   T47-NEWS    the list rows, the edit surface (every field keeps its id and name), empty list, new item
//   T47-IMAGE   the picture form of every tab says 画像を選ぶ / 画像を変える / 画像を外す (path display and escaping kept)
//   T47-STYLE-SPEC (guard from stage 2) every rule of "Occasional Updates" is an occ- rule and cannot lose to a shared class
// The CSS tests read admin/style.css as text; what a browser draws is checked by the capture (Front).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  answerLiveDialog,
  flushAsync,
  loadAdminApp,
  occasionalData,
  openOccasionalApp,
} from './support/admin-app-harness.mjs';

const repoRoot = process.cwd();
const html = readFileSync(join(repoRoot, 'admin/index.html'), 'utf8');
const css = readFileSync(join(repoRoot, 'admin/style.css'), 'utf8');
const el = (app, id) => app.elements.get(id);

async function type(app, id, value) {
  const field = el(app, id);
  field.value = value;
  await field.dispatch('input');
}

function section(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} exists`);
  const end = endMarker ? text.indexOf(endMarker, start + startMarker.length) : text.length;
  return text.slice(start, end === -1 ? text.length : end);
}

function cssGroup(name) {
  const marker = `/* ----- ${name} ----- */`;
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, `the group ${name} exists`);
  const next = css.indexOf('/* ----- ', start + marker.length);
  return css.slice(start + marker.length, next === -1 ? css.length : next);
}

// ======================================================================================================
// T47-HEADER
// ======================================================================================================
test('T47-HEADER the Header is one row: 1212 Admin on the left, the connection on the right, and no 保存 button by default', () => {
  const header = section(html, '<header class="header">', '</header>');
  assert.match(header, /<h1 class="logo">1212 <span class="accent">Admin<\/span><\/h1>/);
  assert.ok(header.indexOf('class="logo"') < header.indexOf('id="modeBadge"'), 'the connection is to the right of the logo');
  assert.doesNotMatch(header, /<div>\s*<h1/, 'the connection is not stacked under the logo any more');
  assert.doesNotMatch(header, /API Mode/);
  assert.match(header, /<button[^>]*id="saveBtn"[^>]*\bhidden\b/, 'the 保存 button is hidden unless it is needed');
  assert.match(header, /id="modeBadge"/);
});

test('T47-HEADER the heights are the Live master\'s: 46px / tabs 49px up to 899px wide, 62px / 53px from 900px', () => {
  const base = cssGroup('Reset & Base');
  assert.match(base, /--admin-header-sticky-height:\s*46px/);
  assert.match(base, /--admin-tab-nav-sticky-height:\s*49px/);
  const wide = base.match(/@media \(min-width: 900px\)\s*\{\s*:root\s*\{([^}]*)\}/);
  assert.ok(wide, 'the 900px and wider values are variables in the same group');
  assert.match(wide[1], /--admin-header-sticky-height:\s*62px/);
  assert.match(wide[1], /--admin-tab-nav-sticky-height:\s*53px/);
  const header = cssGroup('Header');
  assert.match(header, /\.header\s*\{[^}]*padding:\s*12px 16px/);
  assert.match(header, /@media \(min-width: 900px\)\s*\{[\s\S]*?\.header\s*\{[^}]*padding:\s*16px 32px/);
  assert.match(header, /height:\s*var\(--admin-header-sticky-height\)/);
});

test('T47-HEADER while the header button is shown the Header is 56px / 64px tall and the tabs and the Live sticky offsets follow it', async () => {
  const header = cssGroup('Header');
  assert.match(header, /body\.has-header-action\s*\{[^}]*--admin-header-sticky-height:\s*56px/);
  assert.match(header, /@media \(min-width: 900px\)\s*\{\s*body\.has-header-action\s*\{[^}]*--admin-header-sticky-height:\s*64px/);
  assert.match(header, /body\.has-header-action\s*\{[^}]*--admin-global-chrome-sticky-offset:\s*calc\(/, 'the Live offset is computed again where the Header height changes');
  const local = await openOccasionalApp({ api: false });
  local.app.renderModeBadge();
  assert.equal(local.app.document.body.classList.contains('has-header-action'), true, 'Local Mode: JSONを書き出す is in the Header');
  const connected = await openOccasionalApp();
  connected.app.renderModeBadge();
  assert.equal(connected.app.document.body.classList.contains('has-header-action'), false, 'connected: just the one row');
  // stage 5 (D47-08): nothing brings the header action back while the API is connected (stages 2 to 4 showed it for a change waiting for the old header 保存)
  connected.app.markChanged();
  assert.equal(connected.app.document.body.classList.contains('has-header-action'), false);
});

test('T47-HEADER the Live sticky offsets follow the variables (nothing in the Live group has the old 92px / 54px)', () => {
  assert.doesNotMatch(css, /92px|\b54px\b/);
  assert.match(css, /--admin-global-chrome-sticky-offset:\s*calc\(var\(--admin-header-sticky-height\) \+ var\(--admin-tab-nav-sticky-height\)\)/);
});

test('T47-HEADER the connection label and the band are as before: 接続中 / API Fallback / Local Mode', async () => {
  const connected = await openOccasionalApp();
  connected.app.renderModeBadge();
  assert.equal(el(connected.app, 'modeBadge').textContent, '接続中');
  assert.equal(el(connected.app, 'connectionBanner').hidden, true, 'no band while connected');

  const fallback = loadAdminApp();
  fallback.setApiMode(true);
  fallback.setApiFallbackReadOnly(true);
  fallback.renderModeBadge();
  assert.equal(el(fallback, 'modeBadge').textContent, 'API Fallback');
  assert.equal(el(fallback, 'connectionBanner').textContent, 'API接続失敗（ローカルJSONを読み取り専用で表示）');
  assert.equal(el(fallback, 'saveBtn').hidden, true, 'read-only has no header 保存');

  const local = loadAdminApp();
  local.setApiMode(false);
  local.renderModeBadge();
  assert.equal(el(local, 'modeBadge').textContent, 'Local Mode');
  assert.equal(el(local, 'connectionBanner').textContent, 'ローカルJSONモード（従来運用）');
});

test('T47-HEADER while the API is connected the header 保存 is hidden whatever is waiting and sends nothing; Local Mode always has JSONを書き出す', async () => {
  const { app, puts } = await openOccasionalApp();
  app.renderModeBadge();
  assert.equal(el(app, 'saveBtn').hidden, true, 'API connected, nothing waiting');
  app.markChanged();
  assert.equal(el(app, 'saveBtn').hidden, true, 'API connected: no longer shown for a change that the old header 保存 was waiting for (stage 5, D47-08)');
  assert.equal(await app.invokeSaveData({ silent: true }), false);
  assert.equal(await app.invokeSaveData(), false);
  assert.equal(puts.length, 0, 'nothing is sent');

  const local = await openOccasionalApp({ api: false });
  local.app.renderModeBadge();
  assert.equal(el(local.app, 'saveBtn').hidden, false, 'Local Mode');
  assert.equal(el(local.app, 'saveBtn').textContent, 'JSONを書き出す');
  local.app.setApiMode(false);
  local.app.markChanged();
  assert.equal(el(local.app, 'saveBtn').hidden, false);
  assert.equal(el(local.app, 'saveBtn').textContent, 'JSONを書き出す *');
});

// ======================================================================================================
// T47-TABS
// ======================================================================================================
test('T47-TABS five tabs: Site, News, Live, Music, Profile — in this order, Live selected, no YouTube and no Disco', () => {
  const nav = section(html, '<nav class="tab-nav">', '</nav>');
  const tabs = [...nav.matchAll(/<button class="tab-btn( active)?" data-tab="([a-z]+)">([^<]+)<\/button>/g)]
    .map((match) => ({ tab: match[2], label: match[3], active: Boolean(match[1]) }));
  assert.deepEqual(tabs.map((tab) => tab.tab), ['site', 'news', 'live', 'music', 'profile']);
  assert.deepEqual(tabs.map((tab) => tab.label), ['Site', 'News', 'Live', 'Music', 'Profile']);
  assert.deepEqual(tabs.filter((tab) => tab.active).map((tab) => tab.tab), ['live']);
  assert.equal((nav.match(/tab-btn/g) || []).length, 5);
  assert.doesNotMatch(nav, /youtube|discography|YouTube|Disco/i);
  assert.doesNotMatch(html, /data-tab="(youtube|discography)"/);
});

test('T47-TABS every tab has its section; #music-tab holds the switch, the Channel URL, the lists and the edit surface of the works and the videos', () => {
  for (const id of ['site-tab', 'news-tab', 'live-tab', 'music-tab', 'profile-tab']) {
    assert.match(html, new RegExp(`<section class="tab-content[^"]*"[^>]* id="${id}"|<section[^>]* id="${id}"[^>]*class="tab-content`), `${id} is a tab-content`);
  }
  assert.doesNotMatch(html, /id="youtube-tab"|id="discography-tab"/);
  const music = section(html, 'id="music-tab"', '<!-- Profile');
  for (const id of [
    'youtube-channel-url', 'music-works-list', 'music-videos-list', 'music-add-btn', 'music-switch-works', 'music-switch-videos',
    'music-editor-body', 'music-save-btn', 'channel-save-btn',
  ]) assert.match(music, new RegExp(`id="${id}"`), `${id} is in #music-tab`);
  assert.doesNotMatch(music, /id="(music-works-legacy|music-videos-legacy|disc-digital-list|disc-demo-list|youtube-musicVideos-list)"/, 'the stacked old sections are gone');
  assert.doesNotMatch(music, /<h[23]>\s*(YouTube|Disco|Discography)\s*<\/h[23]>/, 'no YouTube / Disco headings either');
  assert.match(html, /<section class="tab-content[^"]*\bocc-tab\b[^"]*" id="news-tab"/);
});

test('T47-TABS clicking a tab shows its section and hides the others; the Live editor and the News edit surface close behind it', async () => {
  const { app } = await openOccasionalApp();
  app.setupTabs();
  const panelOf = (name) => el(app, `${name}-tab`);
  for (const name of ['news', 'site', 'music', 'profile', 'live']) {
    await el(app, `global-tab-${name}`).dispatch('click');
    assert.equal(app.getActiveGlobalTab(), name);
    assert.equal(panelOf(name).classList.contains('active'), true);
    for (const other of ['news', 'site', 'music', 'profile', 'live'].filter((candidate) => candidate !== name)) {
      assert.equal(panelOf(other).classList.contains('active'), false, `${other} is hidden while ${name} is shown`);
    }
  }
  await el(app, 'global-tab-news').dispatch('click');
  app.editNews('fx-news-2');
  assert.equal(app.getOccState().active.id, 'fx-news-2');
  await el(app, 'global-tab-live').dispatch('click');
  assert.equal(app.getOccState().active, null, 'the News edit surface is closed when the tab is left');
  assert.equal(app.elements.get('edit-title'), undefined, 'and its edit-* fields are gone (Live uses the same ids)');
});

// ======================================================================================================
// T47-NEWS
// ======================================================================================================
const FIELD_ORDER = ['日付', 'タイトル', '説明', '画像', '詳細リンクURL', 'リンクテキスト'];

test('T47-NEWS the list rows are buttons with the date and the title; the first screen is only the list; nothing is selected', async () => {
  const { app } = await openOccasionalApp();
  const list = el(app, 'news-list').innerHTML;
  const rows = [...list.matchAll(/<button\b[^>]*data-occ-open="news"[^>]*data-occ-id="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.deepEqual(rows.map((row) => row[1]), occasionalData().news.map((item) => item.id), 'one row per item, in the data order');
  assert.match(rows[1][2], /2026\/11\/12\(Thu\.\) 架空の告知/, 'the date as it is stored, not reformatted');
  assert.match(rows[1][2], /テスト &quot;引用符&quot; のお知らせ/, 'a title with a double quote is escaped');
  assert.doesNotMatch(list, /<img/, 'no small picture and no ›: date and title only');
  assert.doesNotMatch(list, /›/);
  assert.match(list, /type="button"/);
  assert.equal(app.getOccState().active, null);
  assert.equal(el(app, 'news-master-detail').classList.contains('has-occ-selection'), false);
  assert.equal(app.document.body.classList.contains('is-occ-editing'), false);
});

test('T47-NEWS a click on a row (the way the browser delivers it) opens that item; the opened row is marked', async () => {
  const { app } = await openOccasionalApp();
  const row = { dataset: { occOpen: 'news', occId: 'fx-news-3' } };
  const target = { closest: (selector) => (selector === '[data-occ-open]' ? row : null) };
  await app.dispatchDocument('click', { target, preventDefault() {} });
  assert.equal(app.getOccState().active.id, 'fx-news-3');
  const marked = el(app, 'news-list').innerHTML.match(/<button\b[^>]*aria-current="true"[^>]*data-occ-id="([^"]*)"|<button\b[^>]*data-occ-id="([^"]*)"[^>]*aria-current="true"/);
  assert.ok(marked, 'one row is aria-current');
  assert.equal(marked[1] || marked[2], 'fx-news-3');
  assert.equal(el(app, 'news-master-detail').classList.contains('has-occ-selection'), true);
  assert.equal(app.document.body.classList.contains('is-occ-editing'), true);
  assert.equal(el(app, 'modal').classList.contains('active'), false, 'no modal');
});

test('T47-NEWS the edit surface has every field with the same id and the values of the item, in the order Date, Title, Description, Image, Link URL, Link text', async () => {
  const { app } = await openOccasionalApp();
  app.editNews('fx-news-2');
  const body = el(app, 'news-editor-body').innerHTML;
  let last = -1;
  for (const label of FIELD_ORDER) {
    const at = body.indexOf(`>${label}<`);
    assert.ok(at > last, `${label} comes after the previous field`);
    last = at;
  }
  const item = occasionalData().news[1];
  assert.equal(el(app, 'edit-date').value, item.date);
  assert.equal(el(app, 'edit-title').value, item.title);
  assert.equal(el(app, 'edit-description').value, item.description);
  assert.equal(el(app, 'edit-image').value, item.image);
  assert.equal(el(app, 'edit-link').value, item.link);
  assert.equal(el(app, 'edit-linkText').value, item.linkText);
  assert.equal(el(app, 'edit-description').tagName, 'TEXTAREA');
  assert.match(body, /for="edit-link">詳細リンクURL</, 'one name for the link field (it was リンクURL and 詳細リンクURL…)');
  assert.equal(el(app, 'news-editor-heading').textContent, 'お知らせを編集');
  assert.equal(el(app, 'news-editor-title').textContent, item.title, 'the title in the narrow top bar');
  assert.ok(el(app, 'news-delete-btn'));
  assert.equal(el(app, 'news-delete-btn').textContent, 'このお知らせを削除');
  assert.equal(app.document.activeElement, el(app, 'edit-date'), 'the first field has the focus');
});

test('T47-NEWS the fields are written as text: a double quote, a tag and a line break in the saved values arrive unchanged', async () => {
  const data = occasionalData();
  data.news[0].title = '"二重" <b>タグ</b> & \'一重\'';
  data.news[0].description = '1行目\n\n3行目 "引用"';
  const { app } = await openOccasionalApp({ data });
  app.editNews('fx-news-1');
  assert.equal(el(app, 'edit-title').value, '"二重" <b>タグ</b> & \'一重\'');
  assert.equal(el(app, 'edit-description').value, '1行目\n\n3行目 "引用"');
  assert.doesNotMatch(el(app, 'news-editor-body').innerHTML, /<b>タグ<\/b>/);
});

test('T47-NEWS an item of an older shape opens (the missing values are empty) and an id that looks like a number opens from its row', async () => {
  const legacy = await openOccasionalApp({ variant: 'legacyShapes' });
  legacy.app.editNews('fx-news-old-3');
  assert.equal(el(legacy.app, 'edit-description').value, '');
  assert.equal(el(legacy.app, 'edit-link').value, '');
  assert.equal(el(legacy.app, 'edit-linkText').value, '');
  assert.equal(legacy.app.isOccDirty(), false, 'opening is not a change');

  const numeric = await openOccasionalApp({ variant: 'numericIds' });
  const row = { dataset: { occOpen: 'news', occId: '101' } };
  await numeric.app.dispatchDocument('click', { target: { closest: () => row }, preventDefault() {} });
  assert.equal(numeric.app.getOccState().active.id, 101);
  assert.equal(el(numeric.app, 'edit-title').value, '架空の数値ID');
});

test('T47-NEWS a new item is an empty edit surface (link text view...), titled 新しいお知らせ, with no delete and 保存済み', async () => {
  const { app } = await openOccasionalApp();
  assert.equal(app.addNews(), true);
  for (const id of ['edit-date', 'edit-title', 'edit-description', 'edit-image', 'edit-link']) assert.equal(el(app, id).value, '', `${id} is empty`);
  assert.equal(el(app, 'edit-linkText').value, 'view...');
  assert.equal(el(app, 'news-editor-heading').textContent, '新しいお知らせ');
  assert.equal(el(app, 'news-editor-title').textContent, '新しいお知らせ');
  assert.equal(el(app, 'news-delete-btn'), undefined);
  assert.equal(el(app, 'edit-image-select-btn').textContent, '画像を選ぶ');
  assert.match(String(app.getOccState().active.id), /^news-\d+$/, 'the id is made when it is opened');
});

test('T47-NEWS a list with no item says so and offers + 追加; the edit surface on a wide screen says what to do', async () => {
  const { app } = await openOccasionalApp({ variant: 'emptyLists' });
  assert.match(el(app, 'news-list').innerHTML, /まだ登録がありません。/);
  assert.doesNotMatch(el(app, 'news-list').innerHTML, /data-occ-open/);
  assert.match(html, /id="news-add-btn"[^>]*>\+ 追加</);
  const empty = section(html, 'id="news-editor-empty"', '</p>');
  assert.match(empty, /一覧から選ぶか、「\+ 追加」を押してください。/);
});

test('T47-NEWS a title that is empty is shown as （題なし） in the row and in the top bar', async () => {
  const data = occasionalData();
  data.news[2].title = '';
  const { app } = await openOccasionalApp({ data });
  assert.match(el(app, 'news-list').innerHTML, /（題なし）/);
  app.editNews('fx-news-3');
  assert.equal(el(app, 'news-editor-title').textContent, '（題なし）');
});

test('T47-NEWS the 保存して公開 is on screen only while it can be used on a narrow screen, and always (dimmed when idle) on a wide one', async () => {
  const narrow = await openOccasionalApp({ wide: false });
  narrow.app.editNews('fx-news-2');
  assert.equal(el(narrow.app, 'news-editor-actions').hidden, true, 'narrow: nothing is unsaved, so no button');
  await type(narrow.app, 'edit-title', 'x');
  assert.equal(el(narrow.app, 'news-editor-actions').hidden, false, 'narrow: unsaved, so it is shown');
  assert.equal(el(narrow.app, 'news-save-btn').textContent, '保存して公開');

  const wide = await openOccasionalApp({ wide: true });
  wide.app.editNews('fx-news-2');
  assert.equal(el(wide.app, 'news-editor-actions').hidden, false, 'wide: always there');
  assert.equal(el(wide.app, 'news-save-btn').disabled, true, 'wide: not pressable while nothing is unsaved');
  await type(wide.app, 'edit-title', 'x');
  assert.equal(el(wide.app, 'news-save-btn').disabled, false);
  wide.app.setWide(false);
  assert.equal(el(wide.app, 'news-editor-actions').hidden, false, 'crossing 900px re-arranges what is open: unsaved stays shown');
  await type(wide.app, 'edit-title', occasionalData().news[1].title);
  wide.app.setWide(false);
  assert.equal(el(wide.app, 'news-editor-actions').hidden, true);
});

test('T47-NEWS leaving the edit surface with ‹ 一覧 (nothing unsaved) goes back to the list and clears the surface', async () => {
  const { app } = await openOccasionalApp();
  app.editNews('fx-news-2');
  await el(app, 'news-editor-back').dispatch('click');
  assert.equal(app.getOccState().active, null);
  assert.equal(el(app, 'news-editor-body').innerHTML, '');
  assert.equal(app.document.body.classList.contains('is-occ-editing'), false);
  assert.equal(el(app, 'news-master-detail').classList.contains('has-occ-selection'), false);
  assert.equal(el(app, 'news-editor-heading').textContent, '');
});

test('T47-NEWS the read-only state (API connection failed) lets the item be read but not changed, added or saved', async () => {
  const { app, puts } = await openOccasionalApp();
  app.setApiFallbackReadOnly(true);
  assert.equal(app.addNews(), false, 'no new item');
  assert.equal(app.editNews('fx-news-2'), true, 'the item can be read');
  for (const id of ['edit-date', 'edit-title', 'edit-description', 'edit-link', 'edit-linkText', 'news-save-btn', 'news-delete-btn']) {
    assert.equal(el(app, id).disabled, true, `${id} is disabled`);
  }
  assert.equal(await app.saveOccPanel('item'), false);
  assert.equal(puts.length, 0);
  assert.equal(el(app, 'news-editor-back').disabled, false, 'going back to the list is still possible');
});

// ======================================================================================================
// T47-IMAGE (the form itself; the News flows are in admin-occasional-save.test.mjs)
// ======================================================================================================
test('T47-IMAGE the picture form says 画像を選ぶ without a picture, and 画像を変える with 画像を外す with one; the path is shown and escaped', () => {
  const { getOccImageFormHtml, getImageFormHtml } = loadAdminApp();
  const none = getOccImageFormHtml('', 'edit-image');
  assert.match(none, />画像を選ぶ</);
  assert.doesNotMatch(none, />画像を変える</);
  assert.match(none, /id="edit-image-clear-btn"[^>]*\bhidden\b/, '画像を外す is not offered without a picture');
  assert.match(none, /未選択/);
  assert.match(none, /id="edit-image-path"/);
  assert.match(none, /id="edit-image-status"[^>]*role="status"[^>]*aria-live="polite"|id="edit-image-status"[^>]*aria-live="polite"[^>]*role="status"/);

  const some = getOccImageFormHtml('assets/images/news.jpg', 'edit-image');
  assert.match(some, />画像を変える</);
  assert.match(some, />画像を外す</);
  assert.doesNotMatch(some, /id="edit-image-clear-btn"[^>]*\bhidden\b/);
  assert.match(some, /パス: assets\/images\/news\.jpg/);
  assert.doesNotMatch(some, />画像を選択<|>削除<|タップして画像を選択/);

  const hostile = getOccImageFormHtml('assets/images/x"><img src=x onerror=alert(1)>.jpg', 'edit-image');
  assert.doesNotMatch(hostile, /<img src=x/);
  assert.match(hostile, /&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;/);

  assert.equal(getImageFormHtml('assets/images/news.jpg', 'site-hero-image').includes('画像を変える'), true, 'the shared form of the other tabs has the same words');
  assert.equal(getImageFormHtml('', 'profile-image').includes('画像を選ぶ'), true);
});

test('T47-IMAGE the select and clear buttons keep the ids and handlers the upload code uses, in the form of every tab', () => {
  const { getOccImageFormHtml } = loadAdminApp();
  const form = getOccImageFormHtml('assets/images/news.jpg', 'edit-image');
  for (const id of ['edit-image', 'edit-image-file', 'edit-image-select-btn', 'edit-image-clear-btn', 'edit-image-preview-container', 'edit-image-path']) {
    assert.match(form, new RegExp(`id="${id}"`), id);
  }
  assert.match(form, /onchange="handleImageSelect\(this, 'edit-image'\)"/);
  assert.match(form, /onclick="clearImage\('edit-image'\)"/);
  assert.match(form, /type="hidden" id="edit-image"/);
  assert.match(form, /data-admin-mutation=""/, 'read-only mode can disable them');
});

// ======================================================================================================
// T47-STYLE-SPEC (guard from stage 2; the full version is stage 6)
// ======================================================================================================
function parseRules(text) {
  const rules = [];
  const source = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const walk = (chunk, media) => {
    let index = 0;
    while (index < chunk.length) {
      const open = chunk.indexOf('{', index);
      if (open === -1) break;
      const prelude = chunk.slice(index, open).trim();
      let depth = 1;
      let close = open + 1;
      while (close < chunk.length && depth > 0) {
        if (chunk[close] === '{') depth += 1;
        if (chunk[close] === '}') depth -= 1;
        close += 1;
      }
      const inner = chunk.slice(open + 1, close - 1);
      if (/^@(media|supports)/.test(prelude)) walk(inner, `${media} ${prelude}`.trim());
      else if (prelude) rules.push({ selectors: prelude.split(',').map((selector) => selector.trim()), media, body: inner });
      index = close;
    }
  };
  walk(source, '');
  return rules;
}

function specificity(selector) {
  const stripped = selector.replace(/:not\(([^)]*)\)/g, ' $1 ').replace(/:is\(([^)]*)\)/g, ' $1 ');
  const ids = (stripped.match(/#[\w-]+/g) || []).length;
  const classes = (stripped.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
  const elements = (stripped.replace(/[#.][\w-]+|\[[^\]]+\]|:+[\w-]+(\([^)]*\))?/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return [ids, classes, elements];
}

const SHARED = ['.form-group', '.text-input', '.textarea', '.select', '.btn', '.image-upload-area', '.item-card', '.tab-content', '.section-header', '.subsection', '.empty-state', '.add-btn'];

test('T47-STYLE-SPEC every rule of Occasional Updates belongs to an occ- class, and one that restyles a shared class sits under .occ-tab with a specificity of (0,2,0) or more', () => {
  const rules = parseRules(cssGroup('Occasional Updates'));
  assert.ok(rules.length > 20, 'the group has rules');
  const problems = [];
  for (const rule of rules) {
    for (const selector of rule.selectors) {
      if (!/occ-/.test(selector)) problems.push(`not an occ- rule: ${selector}`);
      const sharedUsed = SHARED.filter((shared) => new RegExp(`${shared.replace('.', '\\.')}(?![\\w-])`).test(selector));
      if (sharedUsed.length > 0) {
        if (!/\.occ-tab(?![\w-])/.test(selector)) problems.push(`shared class without .occ-tab: ${selector}`);
        const [ids, classes] = specificity(selector);
        if (ids === 0 && classes < 2) problems.push(`specificity below (0,2,0): ${selector}`);
      }
    }
    assert.doesNotMatch(rule.body, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, `no raw colour in ${rule.selectors[0]}`);
  }
  assert.deepEqual(problems, []);
});

test('T47-STYLE-SPEC the Occasional Updates group comes after the shared groups it restyles and before Safe Area', () => {
  const order = [...css.matchAll(/\/\* ----- ([^-]+?) ----- \*\//g)].map((match) => match[1]);
  const at = order.indexOf('Occasional Updates');
  assert.ok(at > order.indexOf('Image Upload Area'));
  assert.equal(order[at + 1], 'Safe Area');
});

test('T47-STYLE the buttons and rows the News surface uses are at least 44px tall', () => {
  const group = cssGroup('Occasional Updates');
  for (const selector of ['.occ-row', '.occ-add', '.occ-back', '.occ-delete', '.occ-save-btn']) {
    const rule = parseRules(group).find((candidate) => candidate.selectors.some((entry) => entry.endsWith(selector)) && /min-height:\s*(4[4-9]|[5-9]\d)px/.test(candidate.body));
    assert.ok(rule, `${selector} has a min-height of 44px or more`);
  }
});

test('T47-STYLE the narrow layout hides the page chrome while an edit is open and fixes 保存して公開 to the bottom; the wide layout puts the two panes side by side', () => {
  const group = cssGroup('Occasional Updates');
  const narrow = group.slice(group.indexOf('@media (max-width: 899px)'));
  assert.match(narrow, /body\.is-occ-editing \.header/);
  assert.match(narrow, /body\.is-occ-editing \.tab-nav/);
  const bar = parseRules(group).find((rule) => rule.selectors.includes('.occ-save') && !rule.media);
  assert.match(bar.body, /position:\s*fixed/, 'narrow (the base rule): fixed to the bottom');
  assert.match(bar.body, /bottom:\s*0/);
  const wideBar = parseRules(group).find((rule) => rule.selectors.includes('.occ-save') && /min-width: 900px/.test(rule.media));
  assert.match(wideBar.body, /position:\s*static/, 'wide: it is part of the heading');
  const wide = group.slice(group.indexOf('@media (min-width: 900px)'));
  assert.match(wide, /grid-template-columns:\s*320px minmax\(0, 1fr\)/);
});

test('T47-STYLE a fixed 保存して公開 has no scrolling ancestor of its own (overflow / transform / filter) in the occ- rules', () => {
  const rules = parseRules(cssGroup('Occasional Updates'));
  for (const rule of rules.filter((candidate) => /occ-(tab|master-detail|editor-pane|editor-card|list-pane)(?![\w-])/.test(candidate.selectors.join()) && !/occ-(row|image|field)/.test(candidate.selectors.join()))) {
    assert.doesNotMatch(rule.body, /overflow(-[xy])?:\s*(auto|scroll|hidden)|transform:|filter:|contain:/, rule.selectors.join());
  }
});

// ======================================================================================================
// Fixes found by the Front's first capture (stage 2): FIX1 the inputs read like the rest of the page, FIX2 the tabs sit where Figma puts them
// ======================================================================================================
test('FIX1 the inputs of an occ- tab take the page font and the ink colour (a textarea is not drawn in the browser\'s monospace)', () => {
  const rules = parseRules(cssGroup('Occasional Updates'));
  const rule = rules.find((candidate) => ['.occ-tab .occ-field .text-input', '.occ-tab .occ-field .textarea', '.occ-tab .occ-field .select'].every((selector) => candidate.selectors.includes(selector)) && !candidate.media);
  assert.ok(rule, 'the rule for the three inputs exists');
  assert.match(rule.body, /font:\s*inherit/);
  assert.match(rule.body, /color:\s*var\(--ink\)/);
  assert.ok(rule.body.indexOf('font: inherit') < rule.body.indexOf('font-size: 16px'), 'font: inherit comes first, so the 16px stays');
});

test('FIX2 from 900px the tab text is not centred in a 44px minimum width, and the 44px to press is kept by a ::before', () => {
  const nav = cssGroup('Tab Navigation');
  const wide = parseRules(nav).filter((rule) => /min-width: 900px/.test(rule.media));
  const button = wide.find((rule) => rule.selectors.includes('.tab-nav .tab-btn'));
  assert.ok(button, 'the wide rule of the tab button exists');
  assert.match(button.body, /min-width:\s*0\b/, 'the text is not pushed to the middle of a wider box');
  assert.match(button.body, /padding:\s*14px 0 0/, 'no side padding: the text starts at the edge of the tab');
  assert.match(wide.find((rule) => rule.selectors.includes('.tab-nav'))?.body || '', /gap:\s*40px/);
  const reach = wide.find((rule) => rule.selectors.includes('.tab-nav .tab-btn::before'));
  assert.ok(reach, 'a ::before keeps the area to press');
  assert.match(reach.body, /width:\s*max\(100%,\s*44px\)/);
  assert.match(reach.body, /top:\s*0/);
  assert.match(reach.body, /bottom:\s*0/);
  const narrow = parseRules(nav).find((rule) => !rule.media && rule.selectors.includes('.tab-nav .tab-btn'));
  assert.match(narrow.body, /min-width:\s*44px/, 'up to 899px (space-between) nothing changes');
});

// ======================================================================================================
// Stages 3 and 4: Music (T47-MUSIC), Site (T47-SITE) and Profile (T47-PROFILE)
// ======================================================================================================
const labelsOf = (markup) => [...markup.matchAll(/<(?:label for="[^"]*"|p class="occ-field-label"[^>]*)>([^<]*)<\/(?:label|p)>/g)].map((match) => match[1]);
const decode = (value) => value.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const rowsOf = (markup, kind) => [...markup.matchAll(new RegExp(`<button[^>]*data-occ-open="${kind}"[^>]*>`, 'g'))].map((match) => match[0]);
const musicBody = (app) => el(app, 'music-editor-body').innerHTML;
const openWork = (app, id = 'fx-release-a', category = 'digital') => assert.equal(app.editDiscography(id, category), true);

test('T47-MUSIC #music-tab: the switch (a tablist of 作品 and 映像), the Channel URL panel of the videos, the list and the edit surface; none of the stacked old sections', () => {
  const music = section(html, 'id="music-tab"', '<!-- Profile');
  assert.match(music, /role="tablist"/);
  assert.match(music, /id="music-switch-works"[^>]*role="tab"[^>]*data-music-view="works"[^>]*aria-selected="true"[^>]*>作品</);
  assert.match(music, /id="music-switch-videos"[^>]*role="tab"[^>]*data-music-view="videos"[^>]*aria-selected="false"[^>]*>映像</);
  const channel = section(music, 'id="music-channel-panel"', 'id="music-master-detail"');
  assert.match(channel, /<h3[^>]*>Channel URL<\/h3>/);
  assert.match(channel, /id="channel-save-btn"[^>]*>保存して公開</);
  assert.match(channel, /id="channel-editor-status"/);
  assert.match(channel, /<label for="youtube-channel-url">Channel URL<\/label>/);
  assert.match(channel, /^id="music-channel-panel"[^>]*\bhidden\b/, 'it belongs to the video side: hidden while the works are shown');
  const list = section(music, 'id="music-list-pane"', 'id="music-editor-pane"');
  assert.match(list, /<h2[^>]*id="music-list-title">作品<\/h2>/);
  assert.match(list, /id="music-add-btn"[^>]*>\+ 追加</);
  assert.match(list, /id="music-works-list"/);
  assert.match(list, /id="music-videos-list"[^>]*\bhidden\b/);
  for (const id of ['music-editor-pane', 'music-editor-bar', 'music-editor-back', 'music-editor-title', 'music-editor-status', 'music-editor-card', 'music-editor-heading', 'music-editor-actions', 'music-editor-status-wide', 'music-editor-error', 'music-save-btn', 'music-editor-body', 'music-editor-empty']) {
    assert.match(music, new RegExp(`id="${id}"`), `${id} is in #music-tab`);
  }
  assert.match(music, /id="music-editor-empty">一覧から選ぶか、「\+ 追加」を押してください。</);
  assert.doesNotMatch(music, /music-works-legacy|music-videos-legacy|id="disc-|id="youtube-(musicVideos|liveMovies|demos)-list"/);
  assert.match(html, /<section class="tab-content[^"]*\bocc-tab\b[^"]*" id="music-tab"/);
});

test('T47-MUSIC the list of works: a heading for each category that has works, then one row each (jacket, title, release date); a row is a button that carries what it opens', async () => {
  const { app } = await openOccasionalApp();
  const list = el(app, 'music-works-list').innerHTML;
  assert.deepEqual([...list.matchAll(/<p class="occ-group-title">([^<]*)<\/p>/g)].map((match) => match[1]), ['Digital Release', '宅録Demo']);
  const rows = rowsOf(list, 'release');
  assert.equal(rows.length, 4);
  assert.match(rows[0], /data-occ-id="fx-release-a" data-occ-category="digital"/);
  assert.match(rows[2], /data-occ-id="fx-demo-a" data-occ-category="demo"/);
  assert.ok(list.indexOf('fx-release-a') < list.indexOf('fx-release-b') && list.indexOf('fx-release-b') < list.indexOf('宅録Demo'), 'in the order of the data');
  assert.match(list, /<img class="occ-row-thumb" src="[^"]*fixture-release-a[^"]*" alt=""/);
  assert.match(list, /<span class="occ-row-title">架空の作品 A &quot;テスト&quot;<\/span><span class="occ-row-meta">2025\.05\.05<\/span>/);
  assert.doesNotMatch(list, /onclick=|›/);
});

test('T47-MUSIC the list of videos: a heading for each category that has videos, then one row each with the title only', async () => {
  const { app } = await openOccasionalApp();
  const list = el(app, 'music-videos-list').innerHTML;
  assert.deepEqual([...list.matchAll(/<p class="occ-group-title">([^<]*)<\/p>/g)].map((match) => match[1]), ['Music Video', 'Live Movie', 'Demo']);
  const rows = rowsOf(list, 'video');
  assert.equal(rows.length, 5);
  assert.match(rows[0], /data-occ-id="yt-musicVideos-fixture-1" data-occ-category="musicVideos"/);
  assert.match(rows[4], /data-occ-id="yt-demos-fixture-1" data-occ-category="demos"/);
  assert.doesNotMatch(list, /<img|ID: |›|fixtureAA01/, 'no thumbnail, no ID line, no arrow');
  assert.match(list, /<span class="occ-row-title">架空のMV A<\/span>/);
});

test('T47-MUSIC empty lists show one line and no category headings (S47-05); a category with nothing in it has no heading', async () => {
  const { app } = await openOccasionalApp({ variant: 'emptyLists' });
  for (const id of ['music-works-list', 'music-videos-list']) {
    assert.match(el(app, id).innerHTML, /<p class="occ-empty">まだ登録がありません。<\/p>/);
    assert.doesNotMatch(el(app, id).innerHTML, /occ-group-title|data-occ-open/);
  }
  const data = occasionalData();
  data.discography.demo = [];
  data.youtube.liveMovies = [];
  const partial = await openOccasionalApp({ data });
  assert.doesNotMatch(el(partial.app, 'music-works-list').innerHTML, /宅録Demo/);
  assert.doesNotMatch(el(partial.app, 'music-videos-list').innerHTML, /Live Movie/);
});

test('T47-MUSIC the switch shows the works or the videos (with the Channel URL panel); the selected tab is the one tab stop; it answers the arrow keys, Home and End', async () => {
  const { app } = await openOccasionalApp();
  assert.equal(app.getMusicView(), 'works');
  assert.equal(el(app, 'music-videos-list').hidden, true);
  assert.equal(el(app, 'music-channel-panel').hidden, true);
  assert.equal(el(app, 'music-list-title').textContent, '作品');
  assert.equal(el(app, 'music-switch-works').getAttribute('aria-selected'), 'true');
  assert.equal(el(app, 'music-switch-videos').getAttribute('tabindex'), '-1');

  assert.equal(app.setMusicView('videos'), true, 'nothing unsaved: it switches at once');
  assert.equal(app.getMusicView(), 'videos');
  assert.equal(el(app, 'music-works-list').hidden, true);
  assert.equal(el(app, 'music-videos-list').hidden, false);
  assert.equal(el(app, 'music-channel-panel').hidden, false);
  assert.equal(el(app, 'music-list-title').textContent, '映像');
  assert.equal(el(app, 'music-switch-videos').getAttribute('aria-selected'), 'true');
  assert.equal(el(app, 'music-switch-works').getAttribute('aria-selected'), 'false');
  assert.equal(el(app, 'music-switch-videos').getAttribute('tabindex'), '0');
  assert.equal(el(app, 'music-switch-works').getAttribute('tabindex'), '-1');

  await el(app, 'music-switch-videos').dispatch('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.equal(app.getMusicView(), 'works', 'ArrowRight wraps around');
  assert.equal(app.document.activeElement, el(app, 'music-switch-works'));
  await el(app, 'music-switch-works').dispatch('keydown', { key: 'End', preventDefault() {} });
  assert.equal(app.getMusicView(), 'videos');
  await el(app, 'music-switch-videos').dispatch('keydown', { key: 'Home', preventDefault() {} });
  assert.equal(app.getMusicView(), 'works');
  await el(app, 'music-switch-videos').dispatch('click');
  assert.equal(app.getMusicView(), 'videos', 'a click works as well');
});

test('T47-MUSIC the switch asks first when the open work, or the Channel URL, is unsaved: 編集を続ける keeps everything, 破棄して移動 switches and drops the input', async () => {
  const { app } = await openOccasionalApp();
  openWork(app);
  await type(app, 'edit-title', '未保存の作品名');
  const asking = app.setMusicView('videos');
  assert.equal(typeof asking.then, 'function');
  await flushAsync();
  assert.match(el(app, 'live-dialog').innerHTML, /保存していない変更があります。/);
  assert.equal(app.document.activeElement, el(app, 'live-dialog-action-stay'));
  await answerLiveDialog(app, 'stay');
  assert.equal(await asking, false);
  assert.equal(app.getMusicView(), 'works');
  assert.equal(el(app, 'edit-title').value, '未保存の作品名', 'the input is kept');
  assert.equal(app.getOccState().active.id, 'fx-release-a');

  const again = app.setMusicView('videos');
  await answerLiveDialog(app, 'discard');
  assert.equal(await again, true);
  assert.equal(app.getMusicView(), 'videos');
  assert.equal(app.getOccState().active, null, 'the open work was closed behind the switch');
  assert.equal(app.getSiteData().discography.digital[0].title, occasionalData().discography.digital[0].title);

  await type(app, 'youtube-channel-url', 'https://example.test/@unsaved');
  const back = app.setMusicView('works');
  assert.equal(typeof back.then, 'function', 'the Channel URL counts');
  await answerLiveDialog(app, 'discard');
  assert.equal(await back, true);
  assert.equal(el(app, 'youtube-channel-url').value, occasionalData().youtube.channelUrl, 'back to the saved URL');
  assert.equal(app.isOccDirty(), false);
});

test('T47-MUSIC the edit of a work has the fields of the old modal in the order of the design, each with its id and its saved value', async () => {
  const { app } = await openOccasionalApp();
  openWork(app);
  assert.deepEqual(labelsOf(musicBody(app)), ['カテゴリ', 'タイトル', 'リリース日', '説明（曲リスト等）', '画像（ジャケット）', 'リンクURL', '種別', 'その場で再生する映像']);
  const work = occasionalData().discography.digital[0];
  assert.equal(el(app, 'edit-category').value, 'digital');
  assert.deepEqual(el(app, 'edit-category').optionValues, ['digital', 'demo']);
  assert.match(el(app, 'edit-category').innerHTML, />Digital Release</);
  assert.match(el(app, 'edit-category').innerHTML, />宅録Demo</);
  assert.equal(el(app, 'edit-title').value, work.title);
  assert.equal(el(app, 'edit-releaseDate').value, work.releaseDate);
  assert.equal(el(app, 'edit-description').value, work.description);
  assert.equal(el(app, 'edit-image').value, work.image);
  assert.equal(el(app, 'edit-link').value, work.link);
  assert.equal(el(app, 'edit-releaseType').value, '1st Single');
  assert.equal(el(app, 'edit-playbackVideoId').value, 'yt-musicVideos-fixture-1');
  assert.deepEqual(el(app, 'edit-playbackVideoId').optionValues, ['', 'yt-musicVideos-fixture-1', 'yt-musicVideos-fixture-2', 'yt-liveMovies-fixture-1', 'yt-liveMovies-fixture-2', 'yt-demos-fixture-1']);
  assert.match(el(app, 'edit-playbackVideoId').innerHTML, /<optgroup label="Music Video">/);
  assert.match(el(app, 'edit-playbackVideoId').innerHTML, />選ばない</);
  assert.match(musicBody(app), /id="edit-releaseDate-error" class="form-error" role="alert"/);
  assert.equal(el(app, 'music-editor-heading').textContent, '作品を編集');
  assert.equal(el(app, 'music-editor-title').textContent, work.title);
  assert.equal(el(app, 'music-delete-btn').textContent, 'この作品を削除');
  assert.equal(el(app, 'edit-image-select-btn').textContent, '画像を変える');
  assert.match(musicBody(app), new RegExp(`id="edit-image-path">パス: ${work.image.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`));
  assert.equal(el(app, 'music-editor-status').textContent, '保存済み');
  assert.equal(el(app, 'edit-category').getAttribute('aria-disabled'), null);
  for (const id of ['edit-category', 'edit-title', 'edit-releaseDate', 'edit-description', 'edit-link', 'edit-releaseType', 'edit-playbackVideoId']) {
    assert.match(musicBody(app), new RegExp(`id="${id}"[^>]*data-admin-mutation`), `${id} is read-only while the connection is lost`);
  }
});

test('T47-MUSIC a new work opens empty (Digital Release, no delete, 「新しい作品」), stays out of the list until it is saved, and a save makes it the edit of that work', async () => {
  const { app } = await openOccasionalApp();
  assert.equal(app.addDiscography(), true);
  assert.equal(el(app, 'music-editor-heading').textContent, '新しい作品');
  assert.equal(el(app, 'edit-category').value, 'digital');
  for (const id of ['edit-title', 'edit-releaseDate', 'edit-description', 'edit-image', 'edit-link', 'edit-releaseType', 'edit-playbackVideoId']) assert.equal(el(app, id).value, '', id);
  assert.equal(el(app, 'music-delete-btn'), undefined);
  assert.equal(el(app, 'music-editor-status').textContent, '保存済み', 'nothing typed: nothing to save');
  assert.equal(app.isOccDirty(), false);
  const id = app.getOccState().active.id;
  assert.match(id, /^disc-\d+$/);
  assert.doesNotMatch(el(app, 'music-works-list').innerHTML, new RegExp(id), 'not in the list yet');
  await type(app, 'edit-title', '追加した作品');
  assert.equal(el(app, 'music-editor-status').textContent, '未保存');
  assert.equal(await app.saveOccPanel('item'), true);
  assert.equal(app.getOccState().active.isNew, false);
  assert.equal(el(app, 'music-editor-heading').textContent, '作品を編集');
  assert.ok(el(app, 'music-delete-btn'), 'the saved work can be deleted');
  assert.match(el(app, 'music-works-list').innerHTML, new RegExp(`data-occ-id="${id}"[^>]*aria-current="true"`));
});

test('T47-MUSIC the edit of a video has category, title and YouTube URL / ID; a new one starts in the category it was added for', async () => {
  const { app } = await openOccasionalApp();
  assert.equal(app.editYouTubeVideo('yt-liveMovies-fixture-1', 'liveMovies'), true);
  assert.equal(app.getMusicView(), 'videos', 'opening a video shows the videos');
  assert.deepEqual(labelsOf(musicBody(app)), ['カテゴリ', 'タイトル', 'YouTube URL / ID']);
  assert.deepEqual(el(app, 'edit-category').optionValues, ['musicVideos', 'liveMovies', 'demos']);
  assert.equal(el(app, 'edit-category').value, 'liveMovies');
  assert.equal(el(app, 'edit-title').value, '架空のライブ A');
  assert.equal(el(app, 'edit-youtube').value, 'fixtureBB01');
  assert.match(musicBody(app), /id="edit-youtube-error" class="form-error" role="alert"/);
  assert.equal(el(app, 'music-editor-heading').textContent, '映像を編集');
  assert.equal(el(app, 'music-delete-btn').textContent, 'この映像を削除');
  assert.match(el(app, 'music-videos-list').innerHTML, /data-occ-id="yt-liveMovies-fixture-1"[^>]*aria-current="true"/);

  assert.equal(app.addYouTubeVideo('demos'), true);
  assert.equal(el(app, 'music-editor-heading').textContent, '新しい映像');
  assert.equal(el(app, 'edit-category').value, 'demos');
  assert.equal(el(app, 'edit-title').value, '');
  assert.equal(el(app, 'edit-youtube').value, '');
  assert.equal(el(app, 'music-delete-btn'), undefined);
  assert.match(app.getOccState().active.id, /^yt-\d+$/);
});

test('T47-MUSIC + 追加 adds to the list that is shown; a row opens its work or video; the same row again changes nothing', async () => {
  const { app } = await openOccasionalApp();
  assert.equal(app.addMusicItem(), true);
  assert.equal(app.getOccState().active.kind, 'release');
  app.setMusicView('videos');
  assert.equal(app.addMusicItem(), true);
  assert.equal(app.getOccState().active.kind, 'video');
  assert.equal(el(app, 'edit-category').value, 'musicVideos');

  const trigger = (dataset) => ({ target: { closest: () => ({ dataset }) }, preventDefault() {} });
  app.handleOccAction(trigger({ occOpen: 'release', occId: 'fx-demo-b', occCategory: 'demo' }));
  assert.deepEqual({ ...app.getOccState().active }, { kind: 'release', id: 'fx-demo-b', category: 'demo', isNew: false });
  assert.equal(app.getMusicView(), 'works');
  await type(app, 'edit-title', '同じ行をもう一度押す');
  assert.equal(app.editDiscography('fx-demo-b', 'demo'), true);
  assert.equal(el(app, 'edit-title').value, '同じ行をもう一度押す', 'it is not opened again');
  app.handleOccAction(trigger({ occOpen: 'video', occId: 'yt-demos-fixture-1', occCategory: 'demos' }));
  await answerLiveDialog(app, 'discard');
  assert.equal(app.getOccState().active.kind, 'video');
});

test('T47-MUSIC while a work or a video is open the page is in the editing state (body and list pane), and leaving the tab closes it; the News edit surface is not touched by Music', async () => {
  const { app } = await openOccasionalApp();
  app.setupTabs();
  openWork(app);
  assert.equal(app.document.body.classList.contains('is-occ-editing'), true);
  assert.equal(el(app, 'music-master-detail').classList.contains('has-occ-selection'), true);
  assert.equal(el(app, 'news-master-detail').classList.contains('has-occ-selection'), false);
  await el(app, 'global-tab-music').dispatch('click');
  await el(app, 'global-tab-news').dispatch('click');
  assert.equal(app.getOccState().active, null);
  assert.equal(app.document.body.classList.contains('is-occ-editing'), false);
  assert.equal(el(app, 'music-master-detail').classList.contains('has-occ-selection'), false);
  assert.equal(app.editNews('fx-news-1'), true);
  assert.equal(el(app, 'news-master-detail').classList.contains('has-occ-selection'), true);
  assert.equal(el(app, 'music-master-detail').classList.contains('has-occ-selection'), false);
});

test('T47-MUSIC the Channel URL is its own panel: its input holds what is typed (siteData is not written), it has its own state and save, and the video edit does not touch it', async () => {
  const { app, puts } = await openOccasionalApp();
  app.setMusicView('videos');
  assert.equal(el(app, 'youtube-channel-url').value, occasionalData().youtube.channelUrl);
  assert.equal(el(app, 'channel-editor-status').textContent, '保存済み');
  await type(app, 'youtube-channel-url', 'https://example.test/@typed');
  assert.equal(el(app, 'channel-editor-status').textContent, '未保存');
  assert.equal(app.getSiteData().youtube.channelUrl, occasionalData().youtube.channelUrl, 'siteData is written when the save succeeds');
  assert.equal(app.getHasChanges(), false);
  app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos');
  assert.equal(el(app, 'youtube-channel-url').value, 'https://example.test/@typed', 'opening a video does not touch it, and does not ask about it');
  assert.equal(dialogOpenOf(app), false);
  assert.equal(await app.saveOccPanel('channel'), true);
  assert.equal(app.getSiteData().youtube.channelUrl, 'https://example.test/@typed');
  assert.equal(el(app, 'channel-editor-status').textContent, '保存済み');
  assert.equal(puts.length, 1);
});

function dialogOpenOf(app) {
  return el(app, 'live-dialog-overlay').hidden === false;
}

// ---- T47-SITE ---------------------------------------------------------------------------------------
test('T47-SITE #site-tab: one screen of four white panels (Home, Home Links, Footer, Contact) with the fields of the old tab, a heading row with the state and 保存して公開', () => {
  const site = section(html, 'id="site-tab"', '<!-- Newsタブ');
  assert.match(site, /<h2 class="occ-page-title">Site<\/h2>/);
  assert.match(site, /id="site-editor-status"/);
  assert.match(site, /id="site-save-btn"[^>]*>保存して公開</);
  assert.deepEqual([...site.matchAll(/<h3 class="occ-panel-heading"[^>]*>([^<]*)<\/h3>/g)].map((match) => match[1]), ['Home', 'Home Links', 'Footer', 'Contact']);
  assert.deepEqual(labelsOf(site), ['顔にする作品', '共有時の画像', 'Bandcamp', 'YouTube', 'X', 'Instagram', 'note', 'フッター文言（空なら既定のまま）', '導入文', 'Form Action（Formspree URL）']);
  for (const id of ['site-featured-release-id', 'site-hero-image-form', 'site-link-bandcamp', 'site-link-youtube', 'site-link-x', 'site-link-instagram', 'site-link-note', 'site-footer-text', 'contact-intro-text', 'contact-form-action']) {
    assert.match(site, new RegExp(`id="${id}"`), `${id} is in #site-tab`);
  }
  assert.match(site, /class="field-hint">ライブの画像がない時、共有時の画像に使います。Homeには作品のジャケットを表示します。</);
  assert.match(site, /<section class="tab-content occ-tab occ-page" id="site-tab"|id="site-tab"/);
  assert.doesNotMatch(site, /onchange=|onclick=/, 'nothing writes to the data by itself');
});

test('T47-SITE the screen shows what is saved: the face of the site chosen among the works (grouped, the newest first), the picture, the links, the footer and the contact', async () => {
  const { app } = await openOccasionalApp();
  const data = occasionalData();
  assert.equal(el(app, 'site-featured-release-id').value, 'fx-release-a');
  assert.deepEqual(el(app, 'site-featured-release-id').optionValues, ['', 'fx-release-a', 'fx-release-b', 'fx-demo-a', 'fx-demo-b']);
  assert.match(el(app, 'site-featured-release-id').innerHTML, /自動（最新のリリース）/);
  assert.match(el(app, 'site-featured-release-id').innerHTML, /<optgroup label="Digital Release">/);
  assert.match(el(app, 'site-featured-release-id').innerHTML, /<optgroup label="宅録Demo">/);
  assert.match(el(app, 'site-featured-release-id').innerHTML, /&quot;テスト&quot;/);
  assert.equal(el(app, 'site-hero-image').value, data.site.heroImage);
  assert.equal(el(app, 'site-hero-image-select-btn').textContent, '画像を変える');
  assert.match(el(app, 'site-hero-image-form').innerHTML, new RegExp(`id="site-hero-image-path">パス: ${data.site.heroImage.replace(/\./g, '\\.')}<`));
  assert.doesNotMatch(el(app, 'site-hero-image-form').innerHTML, /共有時の画像|field-hint/, 'the label and the explanation are in the page, not in the picture form');
  assert.equal(el(app, 'site-link-bandcamp').value, data.site.links.bandcamp);
  assert.equal(el(app, 'site-link-note').value, data.site.links.note);
  assert.equal(el(app, 'site-footer-text').value, data.site.footerText);
  assert.equal(el(app, 'contact-intro-text').value, data.contact.introText);
  assert.equal(el(app, 'contact-form-action').value, data.contact.formAction);
  assert.equal(el(app, 'site-editor-status').textContent, '保存済み');
});

test('T47-SITE typing is unsaved on the screen only: siteData and the header 保存 do not move; typing the saved value back is saved again', async () => {
  const { app } = await openOccasionalApp();
  const before = JSON.stringify(app.getSiteData());
  for (const [id, value] of Object.entries({ 'site-link-bandcamp': 'https://example.test/typed', 'site-footer-text': '入力中', 'contact-intro-text': '導入\n2行', 'site-featured-release-id': 'fx-demo-b' })) {
    await type(app, id, value);
    assert.equal(el(app, 'site-editor-status').textContent, '未保存', id);
    assert.equal(JSON.stringify(app.getSiteData()), before, `${id} is not written to siteData`);
    assert.equal(app.getHasChanges(), false);
    assert.equal(app.isOccDirty(), true);
  }
  const saved = occasionalData();
  await type(app, 'site-link-bandcamp', saved.site.links.bandcamp);
  await type(app, 'site-footer-text', saved.site.footerText);
  await type(app, 'contact-intro-text', saved.contact.introText);
  await type(app, 'site-featured-release-id', saved.site.featuredReleaseId);
  assert.equal(el(app, 'site-editor-status').textContent, '保存済み');
  assert.equal(app.isOccDirty(), false);
});

test('T47-SITE 保存して公開 is under the screen up to 899px only while something is unsaved, saving or failed; from 900px it is in the heading row, dimmed and not pressable while nothing is unsaved', async () => {
  const narrow = await openOccasionalApp();
  assert.equal(el(narrow.app, 'site-editor-actions').hidden, true);
  await type(narrow.app, 'site-footer-text', 'x');
  assert.equal(el(narrow.app, 'site-editor-actions').hidden, false);
  assert.equal(el(narrow.app, 'site-save-btn').disabled, false);

  const wide = await openOccasionalApp({ wide: true });
  assert.equal(el(wide.app, 'site-editor-actions').hidden, false);
  assert.equal(el(wide.app, 'site-save-btn').disabled, true, 'nothing to save');
  await type(wide.app, 'site-footer-text', 'x');
  assert.equal(el(wide.app, 'site-save-btn').disabled, false);
  wide.app.setWide(false);
  assert.equal(el(wide.app, 'site-editor-actions').hidden, false, 'the width crossed 900px: unsaved, so it is still there');
});

test('T47-SITE while the connection is lost the screen is read-only: typing goes back to the saved value, nothing can be saved', async () => {
  const { app, puts } = await openOccasionalApp();
  app.setApiFallbackReadOnly(true);
  for (const id of ['site-featured-release-id', 'site-link-bandcamp', 'site-footer-text', 'contact-intro-text', 'site-hero-image-select-btn', 'site-save-btn']) {
    assert.equal(el(app, id).disabled, true, id);
  }
  el(app, 'site-footer-text').value = 'tamper';
  assert.equal(await el(app, 'site-footer-text').dispatch('input'), false);
  assert.equal(el(app, 'site-footer-text').value, occasionalData().site.footerText);
  assert.equal(await app.saveOccPanel('site', { force: true }), false);
  assert.equal(puts.length, 0);
});

test('T47-SITE 顔にする作品: after a work is deleted the options follow, an unsaved choice stays chosen, and only a choice that no longer exists goes back to 自動', async () => {
  const kept = await openOccasionalApp();
  await type(kept.app, 'site-featured-release-id', 'fx-release-b');
  kept.app.editDiscography('fx-release-a', 'digital');
  const first = kept.app.deleteOccItem();
  await answerLiveDialog(kept.app, 'delete');
  assert.equal(await first, true);
  assert.equal(el(kept.app, 'site-featured-release-id').value, 'fx-release-b', 'the unsaved choice stays');
  assert.equal(el(kept.app, 'site-featured-release-id').optionValues.includes('fx-release-a'), false, 'the deleted work is not an option any more');
  assert.equal(kept.app.getSiteData().site.featuredReleaseId, '', 'the saved face was the deleted work: back to 自動');
  assert.equal(el(kept.app, 'site-editor-status').textContent, '未保存', 'and the choice still differs from what is saved');
  assert.equal(await kept.app.saveOccPanel('site'), true);
  assert.equal(JSON.parse(kept.puts.at(-1).body).site.featuredReleaseId, 'fx-release-b');

  const gone = await openOccasionalApp();
  await type(gone.app, 'site-featured-release-id', 'fx-release-b');
  gone.app.editDiscography('fx-release-b', 'digital');
  const second = gone.app.deleteOccItem();
  await answerLiveDialog(gone.app, 'delete');
  assert.equal(await second, true);
  assert.equal(el(gone.app, 'site-featured-release-id').value, '', 'a choice that no longer exists goes back to the empty one');
  assert.equal(gone.app.getSiteData().site.featuredReleaseId, 'fx-release-a', 'the saved face is another work and stays');
  assert.equal(el(gone.app, 'site-editor-status').textContent, '未保存', 'the choice (自動) differs from the saved one');
});

test('T47-SITE leaving the tab with something unsaved asks; 破棄して移動 puts the saved values back', async () => {
  const { app } = await openOccasionalApp();
  app.setupTabs();
  await el(app, 'global-tab-site').dispatch('click');
  await type(app, 'site-link-x', 'https://example.test/typed-x');
  const leaving = el(app, 'global-tab-news').dispatch('click');
  await flushAsync();
  assert.match(el(app, 'live-dialog').innerHTML, /保存していない変更があります。/);
  await answerLiveDialog(app, 'stay');
  await leaving;
  assert.equal(app.getActiveGlobalTab(), 'site');
  assert.equal(el(app, 'site-link-x').value, 'https://example.test/typed-x');
  const again = el(app, 'global-tab-news').dispatch('click');
  await answerLiveDialog(app, 'discard');
  await again;
  assert.equal(app.getActiveGlobalTab(), 'news');
  assert.equal(el(app, 'site-link-x').value, occasionalData().site.links.x);
  assert.equal(app.isOccDirty(), false);
});

// ---- T47-PROFILE ------------------------------------------------------------------------------------
test('T47-PROFILE #profile-tab: one screen of two white panels (the picture and the text under the heading with the state and 保存して公開; the SNS links with + リンク追加)', () => {
  const profile = section(html, 'id="profile-tab"', '<!-- モーダル');
  assert.match(profile, /<h2 class="occ-panel-heading" id="profile-heading">Profile<\/h2>/);
  assert.match(profile, /id="profile-editor-status"/);
  assert.match(profile, /id="profile-save-btn"[^>]*>保存して公開</);
  assert.match(profile, /<h3 class="occ-panel-heading" id="profile-links-heading">SNSリンク<\/h3>/);
  assert.match(profile, /id="profile-link-add-btn"[^>]*>\+ リンク追加</);
  assert.match(profile, /<label for="profile-text">プロフィールテキスト<\/label>/);
  for (const id of ['profile-image-form', 'profile-text', 'profile-links-list']) assert.match(profile, new RegExp(`id="${id}"`));
  assert.doesNotMatch(profile, /onchange=/);
});

test('T47-PROFILE the screen shows the saved picture, the text (a blank line and a full-width space kept as they are) and one row per link with 名前, URL and 削除', async () => {
  const { app, puts } = await openOccasionalApp();
  const data = occasionalData();
  assert.equal(el(app, 'profile-text').value, data.profile.text);
  assert.equal(data.profile.text.split('\n').length, 9, 'nine lines, one blank');
  assert.equal(el(app, 'profile-image').value, data.profile.image);
  assert.equal(el(app, 'profile-image-select-btn').textContent, '画像を変える');
  assert.deepEqual(labelsOf(el(app, 'profile-image-form').innerHTML), ['写真']);
  const rows = el(app, 'profile-links-list').innerHTML;
  assert.deepEqual(labelsOf(rows), ['名前', 'URL', '名前', 'URL', '名前', 'URL', '名前', 'URL']);
  data.profile.links.forEach((link, index) => {
    assert.equal(el(app, `profile-link-${index}-name`).value, link.name);
    assert.equal(el(app, `profile-link-${index}-url`).value, link.url);
    assert.equal(el(app, `profile-link-${index}-delete-btn`).textContent, '削除');
  });
  assert.equal(el(app, 'profile-link-4-name'), undefined);
  assert.equal(el(app, 'profile-editor-status').textContent, '保存済み');
  assert.equal(await app.saveOccPanel('profile', { force: true }), true);
  assert.equal(JSON.parse(puts[0].body).profile.text, data.profile.text, 'saved as it is, byte for byte');
});

test('T47-PROFILE adding a link adds an empty row and puts the cursor in it; deleting a row renumbers the rest and keeps what was typed; adding then deleting the same row is nothing to save', async () => {
  const { app } = await openOccasionalApp();
  assert.equal(app.addProfileLink(), true);
  assert.equal(el(app, 'profile-link-4-name').value, '');
  assert.equal(app.document.activeElement, el(app, 'profile-link-4-name'));
  assert.equal(el(app, 'profile-editor-status').textContent, '未保存');
  assert.equal(app.deleteProfileLink(4), true);
  assert.equal(el(app, 'profile-link-4-name'), undefined);
  assert.equal(el(app, 'profile-editor-status').textContent, '保存済み', 'back to the saved links');

  await type(app, 'profile-link-2-url', 'https://example.test/p/typed');
  assert.equal(app.deleteProfileLink(1), true);
  const data = occasionalData();
  assert.equal(el(app, 'profile-link-0-name').value, data.profile.links[0].name);
  assert.equal(el(app, 'profile-link-1-name').value, data.profile.links[2].name, 'the next row moved up');
  assert.equal(el(app, 'profile-link-1-url').value, 'https://example.test/p/typed', 'what was typed moved with it');
  assert.equal(el(app, 'profile-link-3-name'), undefined);
  assert.equal(app.getSiteData().profile.links.length, 4, 'siteData is not written');
  assert.equal(app.getHasChanges(), false);
});

test('T47-PROFILE with no link the panel says so; a save of added links makes them the saved ones, and the rows keep working', async () => {
  const data = occasionalData();
  data.profile.links = [];
  const { app, puts } = await openOccasionalApp({ data });
  assert.match(el(app, 'profile-links-list').innerHTML, /リンクがありません。/);
  app.addProfileLink();
  await type(app, 'profile-link-0-name', '一つ目');
  await type(app, 'profile-link-0-url', 'https://example.test/p/first');
  app.addProfileLink();
  await type(app, 'profile-link-1-name', '二つ目');
  assert.equal(await app.saveOccPanel('profile'), true);
  assert.deepEqual(JSON.parse(puts[0].body).profile.links, [{ name: '一つ目', url: 'https://example.test/p/first' }, { name: '二つ目', url: '' }]);
  assert.equal(el(app, 'profile-editor-status').textContent, '保存済み');
  await type(app, 'profile-link-1-url', 'https://example.test/p/second');
  assert.equal(await app.saveOccPanel('profile'), true);
  assert.deepEqual(JSON.parse(puts[1].body).profile.links[1], { name: '二つ目', url: 'https://example.test/p/second' });
});

test('T47-PROFILE leaving the tab with something unsaved asks; 破棄して移動 puts the saved text and links back', async () => {
  const { app } = await openOccasionalApp();
  app.setupTabs();
  await el(app, 'global-tab-profile').dispatch('click');
  await type(app, 'profile-text', '入力中のプロフィール');
  app.addProfileLink();
  const leaving = el(app, 'global-tab-news').dispatch('click');
  await answerLiveDialog(app, 'discard');
  await leaving;
  assert.equal(el(app, 'profile-text').value, occasionalData().profile.text);
  assert.equal(el(app, 'profile-link-4-name'), undefined);
  assert.equal(app.isOccDirty(), false);
});

test('T47-IMAGE the picture form takes a label and can leave it out; the same three words (画像を選ぶ / 画像を変える / 画像を外す) stand in every tab', async () => {
  const app = loadAdminApp();
  const form = app.getOccImageFormHtml('assets/images/a.jpg', 'edit-image', { label: '画像（ジャケット）' });
  assert.deepEqual(labelsOf(form), ['画像（ジャケット）']);
  assert.deepEqual(labelsOf(app.getOccImageFormHtml('', 'site-hero-image', { omitLabel: true })), []);
  assert.match(app.getOccImageFormHtml('', 'edit-image'), />画像を選ぶ</);
  assert.match(form, />画像を変える</);
  assert.match(form, />画像を外す</);
});

// ======================================================================================================
// T47-STYLE for Music, Site and Profile (the values are those of figma-snapshot-v2: admin-occasional-layout-spec.md 8-9, 13-20)
// ======================================================================================================
const occRules = () => parseRules(cssGroup('Occasional Updates'));
const ruleOf = (selector, predicate = () => true) => {
  const rule = occRules().find((candidate) => candidate.selectors.includes(selector) && predicate(candidate));
  assert.ok(rule, `a rule for ${selector}`);
  return rule;
};

test('T47-STYLE Music: the switch is a white pill with a black selected half; the buttons are at least 44px tall; two halves up to 899px, the width of its text from 900px', () => {
  assert.match(ruleOf('.occ-switch', (rule) => !rule.media).body, /background:\s*var\(--white\)/);
  const button = ruleOf('.occ-switch-btn', (rule) => !rule.media);
  assert.match(button.body, /min-height:\s*44px/);
  assert.match(button.body, /flex:\s*1 1 0/, 'up to 899px each half takes half of the width (358x50 in Figma)');
  assert.match(ruleOf('.occ-switch-btn.is-active').body, /background:\s*var\(--ink\)[\s\S]*color:\s*var\(--white\)/);
  assert.match(ruleOf('.occ-switch-btn', (rule) => /min-width: 900px/.test(rule.media)).body, /flex:\s*0 0 auto/);
  assert.match(ruleOf('.occ-switch', (rule) => /min-width: 900px/.test(rule.media)).body, /align-self:\s*flex-start/);
});

test('T47-STYLE Music: a group heading is a gray band with a Caption; a work row is jacket 40x40 (radius 6) + title + date; a hidden list or panel is not drawn', () => {
  const group = ruleOf('.occ-group-title').body;
  assert.match(group, /background:\s*var\(--gray-100\)/);
  assert.match(group, /padding:\s*8px 16px/);
  assert.match(group, /font-size:\s*12px/);
  const thumb = ruleOf('.occ-row-thumb').body;
  assert.match(thumb, /width:\s*40px/);
  assert.match(thumb, /height:\s*40px/);
  assert.match(thumb, /border-radius:\s*6px/);
  assert.match(ruleOf('.occ-tab .occ-row-release').body, /gap:\s*12px/);
  assert.ok(occRules().some((rule) => rule.selectors.includes('.occ-list[hidden]') && /display:\s*none/.test(rule.body)), 'a hidden list is not drawn');
  assert.ok(occRules().some((rule) => rule.selectors.includes('.occ-panel[hidden]') && /display:\s*none/.test(rule.body)));
});

test('T47-STYLE Music: while a work or a video is open (up to 899px) the switch and the Channel URL step aside; the Channel URL has no heading there, and its 保存して公開 is under the input, not fixed to the bottom', () => {
  const group = cssGroup('Occasional Updates');
  const narrow = group.slice(group.indexOf('@media (max-width: 899px)'), group.indexOf('@media (min-width: 900px)'));
  assert.match(narrow, /body\.is-occ-editing \.occ-music-top\s*\{\s*display:\s*none/);
  assert.match(narrow, /\.occ-channel \.occ-panel-head \.occ-panel-heading\s*\{\s*display:\s*none/);
  assert.match(narrow, /\.occ-tab \.occ-channel \.occ-save\s*\{[^}]*position:\s*static/);
  const wide = group.slice(group.indexOf('@media (min-width: 900px)'));
  assert.match(wide, /\.occ-channel \.occ-panel-head \.occ-panel-heading\s*\{\s*display:\s*block/, 'from 900px the heading and the button are in one row');
});

test('T47-STYLE Site and Profile: white panels (radius 16, padding 24) one under the other with a 24px gap, 880px wide from 900px; the heading row is title | state | 保存して公開 from 900px', () => {
  const panel = ruleOf('.occ-panel').body;
  assert.match(panel, /padding:\s*24px/);
  assert.match(panel, /border-radius:\s*var\(--radius\)/);
  assert.match(panel, /background:\s*var\(--white\)/);
  assert.match(panel, /gap:\s*16px/);
  assert.match(ruleOf('.occ-page-body', (rule) => !rule.media).body, /gap:\s*24px/);
  assert.match(ruleOf('.occ-page-body', (rule) => /min-width: 900px/.test(rule.media)).body, /max-width:\s*880px/);
  const head = occRules().find((rule) => rule.selectors.includes('.occ-page-head') && /min-width: 900px/.test(rule.media) && /grid-template-columns/.test(rule.body));
  assert.ok(head, 'the heading row of Site is a grid from 900px');
  assert.match(head.body, /grid-template-areas:\s*"title status button"\s*"error error error"/);
  assert.ok(head.selectors.includes('.occ-panel-head:not(.occ-panel-head-plain)'), 'so are the heading rows of Profile and of the Channel URL');
  assert.match(ruleOf('.occ-page-head .occ-save', (rule) => /min-width: 900px/.test(rule.media)).body, /display:\s*contents/);
});

test('T47-STYLE Site and Profile: up to 899px 保存して公开 is the fixed bar of the other screens, and the end of the screen is not hidden behind it while it shows', () => {
  const bar = occRules().find((rule) => rule.selectors.includes('.occ-save') && !rule.media);
  assert.match(bar.body, /position:\s*fixed/);
  const room = occRules().find((rule) => rule.selectors.some((selector) => /\.occ-page:has\(\.occ-save:not\(\[hidden\]\)\)/.test(selector)));
  assert.ok(room, 'room under the screen while the bar shows');
  assert.match(room.body, /padding-bottom:\s*96px/);
  assert.match(room.media, /max-width: 899px/);
});

test('T47-STYLE Profile and pictures: a link row is 名前 (200px) | URL | 削除 from 900px and stacked below; 削除 is 44px tall; a work picture is 72x72, the photo 72x90', () => {
  assert.match(ruleOf('.occ-link-row', (rule) => /min-width: 900px/.test(rule.media)).body, /grid-template-columns:\s*200px minmax\(0, 1fr\) auto/);
  assert.match(ruleOf('.occ-link-row', (rule) => !rule.media).body, /grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(ruleOf('.occ-tab .occ-link-delete', (rule) => !rule.media).body, /min-height:\s*44px/);
  assert.match(ruleOf('.occ-tab .occ-image-square .image-preview-container').body, /width:\s*72px/);
  assert.match(ruleOf('.occ-tab .occ-image-square .image-preview-large').body, /height:\s*72px/);
  assert.match(ruleOf('.occ-tab .occ-image-portrait .image-preview-large').body, /height:\s*90px/);
  assert.match(ruleOf('.occ-tab .field-hint').body, /font-size:\s*12px/);
});

test('T47-STYLE the pages of Site and Profile are occ-page tabs and share nothing with the stacked old markup (no .subsection / .section-header / .link-item left in them)', () => {
  for (const marker of ['id="site-tab"', 'id="profile-tab"']) {
    const tab = section(html, marker, marker === 'id="site-tab"' ? '<!-- Newsタブ' : '<!-- モーダル');
    assert.doesNotMatch(tab, /class="subsection"|class="section-header"|class="link-item"|class="add-btn/);
  }
  assert.match(html, /<section class="tab-content occ-tab occ-page" id="site-tab"/);
  assert.match(html, /<section class="tab-content occ-tab occ-page" id="profile-tab"/);
});

test('T47-STYLE the Music, Site and Profile controls are at least 44px tall (switch, + 追加, 削除 of a link, 保存して公開, 削除 of an item)', () => {
  for (const selector of ['.occ-switch-btn', '.occ-add', '.occ-tab .occ-link-delete', '.occ-delete', '.occ-save-btn']) {
    const rule = occRules().find((candidate) => candidate.selectors.some((entry) => entry === selector || entry.endsWith(` ${selector}`)) && /min-height:\s*(4[4-9]|[5-9]\d)px/.test(candidate.body));
    assert.ok(rule, `${selector} has a min-height of 44px or more`);
  }
});

// ======================================================================================================
// Fixes found by the Front's capture after stage 4: FIX4 the line under a field takes room only while it says something
// ======================================================================================================
test('FIX4 the error line under the date of a work and the id of a video is empty and takes no room until it has something to say', async () => {
  const rule = parseRules(cssGroup('Occasional Updates')).find((candidate) => candidate.selectors.includes('.occ-tab .occ-field .form-error') && !candidate.media);
  assert.ok(rule, 'a rule for the error line inside an occ- field exists');
  assert.match(rule.body, /min-height:\s*0\b/, 'the shared 1.6em is not kept');
  assert.match(rule.body, /margin:\s*0\b/, 'the shared margin-bottom of 8px is not kept');
  const filled = parseRules(cssGroup('Occasional Updates')).find((candidate) => candidate.selectors.includes('.occ-tab .occ-field .form-error:not(:empty)'));
  assert.ok(filled && /margin-top:\s*6px/.test(filled.body), 'once it has a message it sits 6px under the field');
  const { app } = await openOccasionalApp();
  app.editDiscography('fx-release-a', 'digital');
  assert.match(el(app, 'music-editor-body').innerHTML, /<div id="edit-releaseDate-error" class="form-error" role="alert"><\/div>/, 'empty until a date is wrong');
  app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos');
  assert.match(el(app, 'music-editor-body').innerHTML, /<div id="edit-youtube-error" class="form-error" role="alert"><\/div>/);
});

test('FIX4 the dialog lines of the delete confirmation: the shared .live-dialog-body keeps its 16px, only the lines before the last are 8px apart', () => {
  const lines = parseRules(cssGroup('Occasional Updates')).find((candidate) => candidate.selectors.includes('.occ-dialog-lines .live-dialog-body:not(:last-child)'));
  assert.ok(lines && /margin-bottom:\s*8px/.test(lines.body));
});
