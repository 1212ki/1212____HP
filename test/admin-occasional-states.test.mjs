// Issue #47 stage 5: the states (T47-STATES), the two modes (T47-MODE), accessibility (T47-A11Y) and the fixture (T47-FIXTURE).
//   T47-STATES   S47-01 to S47-20 of Requirements §3: when each state is shown, and its wording
//   T47-MODE     the API connection failed (read-only: nothing can be changed, everything can be read), Local Mode (the header 保存 exports the JSON),
//                and the generic modal is gone
//   T47-A11Y     rows are buttons, the edit surface is a region with a heading, the confirmation surface is an alertdialog, the focus goes where
//                the person was, states are announced, 作品／映像 is a tablist with the arrow keys
//   T47-FIXTURE  every scenario of the synthetic fixture: lists draw, every item opens, one change saves, the same item opens again, nothing
//                is changed by only looking
// The way out of an unsaved screen (T47-GUARD) is in admin-occasional-guard.test.mjs. Values are synthetic; nothing reaches a network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  answerLiveDialog,
  createElement,
  decodeHtml,
  deferred,
  flushAsync,
  jsonResponse,
  loadAdminApp,
  occasionalData,
  openOccasionalApp,
} from './support/admin-app-harness.mjs';

const repoRoot = process.cwd();
const html = readFileSync(join(repoRoot, 'admin/index.html'), 'utf8');
const appSource = readFileSync(join(repoRoot, 'admin/app.js'), 'utf8');
const fixture = JSON.parse(readFileSync(join(repoRoot, 'test/fixtures/admin-occasional-states.json'), 'utf8'));
const el = (app, id) => app.elements.get(id);
const plain = (value) => JSON.parse(JSON.stringify(value));
const toast = (app) => el(app, 'toast').textContent;
const dialogOpen = (app) => el(app, 'live-dialog-overlay').hidden === false;
const dialogHtml = (app) => el(app, 'live-dialog').innerHTML;
const dialogText = (app) => decodeHtml(dialogHtml(app).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const dialogLines = (app) => [...dialogHtml(app).matchAll(/<p[^>]*class="live-dialog-body"[^>]*>([^<]*)<\/p>/g)].map((match) => decodeHtml(match[1]));

async function type(app, id, value) {
  el(app, id).value = value;
  await el(app, id).dispatch('input');
}

const picture = (name) => Object.assign(new Blob(['x'], { type: 'image/png' }), { name });

class ImmediateReader {
  readAsDataURL() { this.onload?.({ target: { result: 'data:image/png;base64,TEST_IMAGE' } }); }
}

// One screen of each kind: where its status is written, which input to type into, and how it is saved.
const SCREENS = {
  news: { key: 'item', tab: 'news', status: 'news-editor-status', error: 'news-editor-error', field: 'edit-title', save: 'news-save-btn', open: (app) => app.editNews('fx-news-2') },
  work: { key: 'item', tab: 'music', status: 'music-editor-status', error: 'music-editor-error', field: 'edit-title', save: 'music-save-btn', open: (app) => app.editDiscography('fx-release-b', 'digital') },
  video: { key: 'item', tab: 'music', status: 'music-editor-status', error: 'music-editor-error', field: 'edit-title', save: 'music-save-btn', open: (app) => app.editYouTubeVideo('yt-musicVideos-fixture-2', 'musicVideos') },
  site: { key: 'site', tab: 'site', status: 'site-editor-status', error: 'site-editor-error', field: 'site-footer-text', save: 'site-save-btn', open: () => true },
  profile: { key: 'profile', tab: 'profile', status: 'profile-editor-status', error: 'profile-editor-error', field: 'profile-text', save: 'profile-save-btn', open: () => true },
  channel: { key: 'channel', tab: 'music', status: 'channel-editor-status', error: 'channel-editor-error', field: 'youtube-channel-url', save: 'channel-save-btn', open: (app) => app.setMusicView('videos') },
};

async function openScreen(name, options = {}) {
  const screen = SCREENS[name];
  const opened = await openOccasionalApp(options);
  opened.app.setupTabs();
  if (screen.tab === 'music' && name === 'work') opened.app.setMusicView('works');
  if (name === 'video') opened.app.setMusicView('videos');
  screen.open(opened.app);
  return { ...opened, screen };
}

const statusOf = (app, screen) => el(app, screen.status).textContent;

// =====================================================================================================================
// T47-STATES
// =====================================================================================================================
test('T47-STATES S47-01 the save state of News, a work, a video, Site, Profile and the Channel URL: 保存済み, 未保存, 保存しています…, 保存できませんでした (with a reason), and in Local Mode JSON書き出し待ち', async () => {
  for (const name of Object.keys(SCREENS)) {
    const screen = SCREENS[name];
    // 保存済み → 未保存 → back to 保存済み
    const gate = deferred();
    const { app, puts } = await openScreen(name, { putGate: gate });
    assert.equal(statusOf(app, screen), '保存済み', `${name}: opened`);
    const original = el(app, screen.field).value;
    await type(app, screen.field, `${original}x`);
    assert.equal(statusOf(app, screen), '未保存', `${name}: changed`);
    await type(app, screen.field, original);
    assert.equal(statusOf(app, screen), '保存済み', `${name}: put back`);
    // 保存しています… (the button cannot be pressed, the second click sends nothing more)
    await type(app, screen.field, `${original}y`);
    const first = app.saveOccPanel(screen.key);
    await flushAsync();
    assert.equal(statusOf(app, screen), '保存しています…', `${name}: saving`);
    assert.equal(el(app, screen.save).disabled, true, `${name}: the button is not pressable while saving`);
    assert.equal(await app.saveOccPanel(screen.key), false, `${name}: the second click`);
    gate.resolve();
    assert.equal(await first, true);
    assert.equal(puts.length, 1, `${name}: one request`);
    assert.equal(statusOf(app, screen), '保存済み', `${name}: saved`);

    // 保存できませんでした + the reason in one line, the input stays
    const failed = await openScreen(name, { putStatus: 400, putPayload: { error: '理由のテスト' } });
    await type(failed.app, screen.field, `${original}z`);
    assert.equal(await failed.app.saveOccPanel(screen.key), false);
    assert.equal(statusOf(failed.app, screen), '保存できませんでした', `${name}: failed`);
    assert.match(el(failed.app, screen.error).textContent, /理由のテスト/, `${name}: the reason`);
    assert.equal(el(failed.app, screen.field).value, `${original}z`, `${name}: the input stays`);

    // Local Mode: JSON書き出し待ち, and the export makes it 保存済み again
    const local = await openScreen(name, { api: false });
    await type(local.app, screen.field, `${original}l`);
    assert.equal(await local.app.saveOccPanel(screen.key), true);
    assert.equal(statusOf(local.app, screen), 'JSON書き出し待ち', `${name}: Local Mode`);
    assert.equal(await local.app.invokeSaveData({ silent: true }), true);
    assert.equal(statusOf(local.app, screen), '保存済み', `${name}: exported`);
  }
});

test('T47-STATES S47-02 the surface for leaving an unsaved screen: its title, 破棄して移動, 編集を続ける (focused), and Escape / the backdrop choose 編集を続ける', async () => {
  const { app } = await openScreen('news');
  await type(app, 'edit-title', '未保存');
  app.addNews();
  await flushAsync();
  assert.equal(dialogOpen(app), true);
  assert.match(dialogHtml(app), /保存していない変更があります。/);
  assert.match(dialogHtml(app), /破棄して移動/);
  assert.match(dialogHtml(app), /編集を続ける/);
  assert.equal(app.document.activeElement, el(app, 'live-dialog-action-stay'));
  assert.match(dialogHtml(app), /role|class="live-dialog-title"/);
  await app.dispatchDocument('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(dialogOpen(app), false);
  assert.equal(app.getOccState().active.id, 'fx-news-2');
});

test('T47-STATES S47-03 the delete confirmation: the title (or the untitled wording), 削除すると公開画面からも消えます。 and, only when it applies, one more line for the face of the site and for the videos works play', async () => {
  const ask = async (app) => {
    const pending = app.deleteOccItem();
    await flushAsync();
    return pending;
  };
  // News: with a title, and without
  const news = await openScreen('news');
  const pendingNews = ask(news.app);
  assert.match(dialogText(news.app), /「テスト "引用符" のお知らせ」を削除しますか。/);
  assert.deepEqual(dialogLines(news.app), ['削除すると公開画面からも消えます。']);
  assert.match(dialogHtml(news.app), /やめる/);
  assert.match(dialogHtml(news.app), /削除する/);
  assert.equal(news.app.document.activeElement, el(news.app, 'live-dialog-action-cancel'), 'やめる is focused');
  await answerLiveDialog(news.app, 'cancel');
  assert.equal(await pendingNews, false);
  const untitled = occasionalData();
  untitled.news[1].title = '';
  const noTitle = await openScreen('news', { data: untitled });
  const pendingNoTitle = ask(noTitle.app);
  assert.match(dialogText(noTitle.app), /このお知らせを削除しますか。/);
  await answerLiveDialog(noTitle.app, 'cancel');
  await pendingNoTitle;
  // a work: the face of the site (and it plays a video, which is not said on the work's side)
  const faced = await openOccasionalApp();
  faced.app.editDiscography('fx-release-a', 'digital');
  const pendingFace = ask(faced.app);
  assert.deepEqual(dialogLines(faced.app), ['削除すると公開画面からも消えます。', '顔にする作品は「自動（最新のリリース）」に戻ります。']);
  await answerLiveDialog(faced.app, 'cancel');
  await pendingFace;
  const plainWork = await openScreen('work');
  const pendingPlain = ask(plainWork.app);
  assert.deepEqual(dialogLines(plainWork.app), ['削除すると公開画面からも消えます。']);
  assert.match(dialogText(plainWork.app), /この作品を削除しますか。|を削除しますか。/);
  await answerLiveDialog(plainWork.app, 'cancel');
  await pendingPlain;
  // a video that works play (N), and one that none plays
  const two = occasionalData();
  two.discography.digital[1].playbackVideoId = 'yt-musicVideos-fixture-1';
  const played = await openOccasionalApp({ data: two });
  played.app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos');
  const pendingPlayed = ask(played.app);
  assert.deepEqual(dialogLines(played.app), [
    '削除すると公開画面からも消えます。',
    '再生する映像に選んでいる作品が2件あります。「選ばない」に戻り、公開画面では「聴く」が出なくなります。',
  ]);
  await answerLiveDialog(played.app, 'cancel');
  await pendingPlayed;
  const unplayed = await openOccasionalApp();
  unplayed.app.editYouTubeVideo('yt-demos-fixture-1', 'demos');
  const pendingUnplayed = ask(unplayed.app);
  assert.deepEqual(dialogLines(unplayed.app), ['削除すると公開画面からも消えます。']);
  await answerLiveDialog(unplayed.app, 'cancel');
  await pendingUnplayed;
});

test('T47-STATES S47-04 a picture chosen: アップロードしています… (unsaved, cannot be saved, the current picture stays); a failure says 画像をアップロードできませんでした with the reason and keeps the picture', async () => {
  for (const [name, imageId, statusId] of [['news', 'edit-image', 'edit-image-status'], ['site', 'site-hero-image', 'site-hero-image-status'], ['profile', 'profile-image', 'profile-image-status']]) {
    const screen = SCREENS[name];
    const gate = deferred();
    const { app } = await openScreen(name, { fileReader: ImmediateReader, upload: () => gate.promise.then(() => jsonResponse({ error: 'アップロードの理由' }, { ok: false, status: 400 })) });
    const before = el(app, imageId).value;
    app.handleImageSelect({ files: [picture('Pic.png')] }, imageId);
    assert.equal(el(app, statusId).textContent, 'アップロードしています…', name);
    assert.equal(statusOf(app, screen), '未保存', `${name}: uploading is unsaved`);
    assert.equal(el(app, screen.save).disabled, true, `${name}: and cannot be saved`);
    assert.equal(await app.saveOccPanel(screen.key), false);
    assert.match(toast(app), /画像アップロード中です。完了してから保存してください/);
    gate.resolve();
    await flushAsync();
    assert.match(el(app, statusId).textContent, /画像をアップロードできませんでした/, name);
    assert.match(el(app, statusId).textContent, /アップロードの理由/, `${name}: with the reason`);
    assert.equal(el(app, imageId).value, before, `${name}: the current picture stays`);
    assert.equal(statusOf(app, screen), '保存済み', `${name}: a failed upload leaves nothing unsaved`);
  }
});

test('T47-STATES S47-05 an empty list says まだ登録がありません。 with 「+ 追加」; Music has no category headings when empty', async () => {
  const { app } = await openOccasionalApp({ variant: 'emptyLists' });
  app.setupTabs();
  for (const id of ['news-list', 'music-works-list', 'music-videos-list']) {
    assert.match(el(app, id).innerHTML, /まだ登録がありません。/, id);
    assert.doesNotMatch(el(app, id).innerHTML, /data-occ-open=/, `${id}: no rows`);
    assert.doesNotMatch(el(app, id).innerHTML, /Digital Release|宅録Demo|Music Video|Live Movie/, `${id}: no category heading`);
  }
  assert.match(html, /id="news-add-btn"[^>]*>\+ 追加</);
  assert.match(html, /id="music-add-btn"[^>]*>\+ 追加</);
  assert.equal(app.addNews(), true, '+ 追加 opens a new News item in an empty list');
  assert.equal(app.getOccState().active.isNew, true);
});

test('T47-STATES S47-06 nothing selected (900px and wider): 一覧から選ぶか、「+ 追加」を押してください。 is in the page and shown by the screen until an item is open (has-occ-selection hides it)', async () => {
  for (const [paneId, masterId, openIt] of [['news-editor-empty', 'news-master-detail', (app) => app.editNews('fx-news-2')], ['music-editor-empty', 'music-master-detail', (app) => app.editDiscography('fx-release-a', 'digital')]]) {
    assert.match(html, new RegExp(`id="${paneId}">一覧から選ぶか、「\\+ 追加」を押してください。<`));
    const { app } = await openOccasionalApp({ wide: true });
    app.setupTabs();
    assert.equal(el(app, masterId).classList.contains('has-occ-selection'), false, `${masterId}: nothing is selected`);
    openIt(app);
    assert.equal(el(app, masterId).classList.contains('has-occ-selection'), true, `${masterId}: an item is open`);
    app.closeOccEditor();
    assert.equal(el(app, masterId).classList.contains('has-occ-selection'), false, `${masterId}: nothing selected again after ‹ 一覧`);
  }
  const rules = readFileSync(join(repoRoot, 'admin/style.css'), 'utf8');
  assert.match(rules, /\.occ-master-detail:not\(\.has-occ-selection\) \.occ-editor-empty\s*\{\s*display:\s*block/, 'the sentence is shown only while nothing is selected');
});

test('T47-STATES S47-07 a new item: empty inputs (News link text view..., a work in Digital Release, a video in Music Video), 保存済み, not in the list, no delete', async () => {
  const news = await openOccasionalApp();
  news.app.addNews();
  assert.equal(el(news.app, 'edit-title').value, '');
  assert.equal(el(news.app, 'edit-linkText').value, 'view...');
  assert.equal(el(news.app, 'news-editor-status').textContent, '保存済み');
  assert.equal(el(news.app, 'news-delete-btn'), undefined, 'no delete for a new News item');
  assert.equal((el(news.app, 'news-list').innerHTML.match(/data-occ-open=/g) || []).length, 6, 'the list is as it was');
  const music = await openOccasionalApp();
  music.app.setMusicView('works');
  music.app.addMusicItem();
  assert.equal(el(music.app, 'edit-category').value, 'digital');
  assert.equal(el(music.app, 'edit-title').value, '');
  assert.equal(el(music.app, 'music-editor-status').textContent, '保存済み');
  assert.equal(el(music.app, 'music-delete-btn'), undefined);
  music.app.closeOccEditor();
  music.app.setMusicView('videos');
  music.app.addMusicItem();
  assert.equal(el(music.app, 'edit-category').value, 'musicVideos');
  assert.equal(el(music.app, 'music-delete-btn'), undefined);
});

test('T47-STATES S47-08 the release date: a new or changed date in the wrong shape is not saved and the line under the date says why; a date that was not touched saves', async () => {
  const { app, puts } = await openOccasionalApp();
  app.setMusicView('works');
  app.addMusicItem();
  await type(app, 'edit-title', '新しい作品');
  await type(app, 'edit-releaseDate', '2025/05/05');
  assert.equal(await app.saveOccPanel('item'), false);
  assert.equal(puts.length, 0);
  assert.equal(el(app, 'edit-releaseDate-error').textContent, '「2025.05.05」の形で入力してください。');
  assert.equal(el(app, 'edit-releaseDate').getAttribute('aria-invalid'), 'true');
  assert.equal(el(app, 'edit-releaseDate').value, '2025/05/05', 'the input stays');
  await type(app, 'edit-releaseDate', '2025.05.05');
  assert.equal(await app.saveOccPanel('item'), true, 'the right shape saves');
  const legacy = await openOccasionalApp({ variant: 'legacyShapes' });
  const odd = legacy.app.getSiteData().discography.digital.find((work) => !/^\d{4}\.\d{2}\.\d{2}$/.test(String(work.releaseDate ?? '')));
  assert.ok(odd, 'the legacy data has a date that is not in the shape');
  legacy.app.setMusicView('works');
  legacy.app.editDiscography(odd.id, legacy.app.getSiteData().discography.digital.includes(odd) ? 'digital' : 'demo');
  await type(legacy.app, 'edit-title', `${odd.title ?? ''}!`);
  assert.equal(await legacy.app.saveOccPanel('item'), true, 'a date that was not touched is kept and saves');
});

test('T47-STATES S47-09 YouTube URL / ID that cannot be read: not saved, and the line under the field says YouTube URL / ID が不正です（IDは11文字）', async () => {
  const { app, puts } = await openOccasionalApp();
  app.setMusicView('videos');
  app.addMusicItem();
  await type(app, 'edit-youtube', 'not-an-id');
  assert.equal(await app.saveOccPanel('item'), false);
  assert.equal(puts.length, 0);
  assert.equal(el(app, 'edit-youtube-error').textContent, 'YouTube URL / ID が不正です（IDは11文字）');
  assert.equal(el(app, 'edit-youtube').getAttribute('aria-invalid'), 'true');
  await type(app, 'edit-youtube', 'https://youtu.be/abcdefghijk');
  assert.equal(await app.saveOccPanel('item'), true);
});

test('T47-STATES S47-10 a save that worked: 保存済み, the same edit stays (a new item becomes the saved item with a delete), the toast says 保存しました (Local Mode: 編集内容を反映しました。…)', async () => {
  const api = await openOccasionalApp();
  api.app.addNews();
  await type(api.app, 'edit-title', '新規のお知らせ');
  assert.equal(await api.app.saveOccPanel('item'), true);
  assert.equal(el(api.app, 'news-editor-status').textContent, '保存済み');
  assert.equal(toast(api.app), '保存しました');
  assert.equal(api.app.getOccState().active.isNew, false, 'it is the saved item now');
  assert.ok(el(api.app, 'news-delete-btn'), 'and has a delete');
  assert.equal(el(api.app, 'edit-title').value, '新規のお知らせ');
  const local = await openOccasionalApp({ api: false });
  local.app.editNews('fx-news-2');
  await type(local.app, 'edit-title', 'ローカル');
  assert.equal(await local.app.saveOccPanel('item'), true);
  assert.equal(toast(local.app), '編集内容を反映しました。右上の「JSONを書き出す」で確定します');
  assert.equal(local.app.getOccState().active.id, 'fx-news-2', 'the same edit stays');
});

test('T47-STATES S47-11 a save or a delete that failed: 保存できませんでした, the input and the surface stay, one line says why, siteData is as before; a failed delete puts the item back in the list', async () => {
  for (const name of ['news', 'work', 'video']) {
    const screen = SCREENS[name];
    const { app, puts } = await openScreen(name, { putStatus: 400, putPayload: { error: '失敗の理由' } });
    const loaded = plain(app.getSiteData());
    await type(app, screen.field, '失敗する入力');
    assert.equal(await app.saveOccPanel('item'), false, name);
    assert.equal(statusOf(app, screen), '保存できませんでした', name);
    assert.match(el(app, screen.error).textContent, /失敗の理由/, name);
    assert.deepEqual(plain(app.getSiteData()), loaded, `${name}: siteData is as before`);
    assert.equal(el(app, screen.field).value, '失敗する入力', name);
    const rowsBefore = (el(app, name === 'news' ? 'news-list' : (name === 'work' ? 'music-works-list' : 'music-videos-list')).innerHTML.match(/data-occ-open=/g) || []).length;
    const deleting = app.deleteOccItem();
    await flushAsync();
    await answerLiveDialog(app, 'delete');
    assert.equal(await deleting, false, `${name}: the delete failed`);
    assert.equal(puts.length, 2, `${name}: both were tried`);
    assert.deepEqual(plain(app.getSiteData()), loaded, `${name}: the item is still in the data`);
    assert.equal((el(app, name === 'news' ? 'news-list' : (name === 'work' ? 'music-works-list' : 'music-videos-list')).innerHTML.match(/data-occ-open=/g) || []).length, rowsBefore, `${name}: and in the list`);
    assert.ok(app.getOccState().active, `${name}: the surface stays`);
    assert.equal(el(app, screen.field).value, '失敗する入力', `${name}: and what was typed`);
    assert.equal(statusOf(app, screen), '保存できませんでした', name);
  }
});

test('T47-STATES S47-12 deleting the face of the site: the same one request empties site.featuredReleaseId, and Site then shows 自動（最新のリリース）', async () => {
  const { app, puts } = await openOccasionalApp();
  app.editDiscography('fx-release-a', 'digital');
  const deleting = app.deleteOccItem();
  await flushAsync();
  await answerLiveDialog(app, 'delete');
  assert.equal(await deleting, true);
  assert.equal(puts.length, 1);
  assert.equal(JSON.parse(puts[0].body).site.featuredReleaseId, '');
  assert.equal(app.getSiteData().site.featuredReleaseId, '');
  assert.equal(el(app, 'site-featured-release-id').value, '');
  assert.doesNotMatch(el(app, 'site-featured-release-id').innerHTML, /fx-release-a/, 'the work is no longer a choice');
  assert.match(el(app, 'site-featured-release-id').innerHTML, /自動（最新のリリース）/);
});

test('T47-STATES S47-13 deleting a video that works play: the same one request sets their playbackVideoId to "" (選ばない)', async () => {
  const data = occasionalData();
  data.discography.digital[1].playbackVideoId = 'yt-musicVideos-fixture-1';
  const { app, puts } = await openOccasionalApp({ data });
  app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos');
  const deleting = app.deleteOccItem();
  await flushAsync();
  await answerLiveDialog(app, 'delete');
  assert.equal(await deleting, true);
  assert.equal(puts.length, 1);
  const body = JSON.parse(puts[0].body);
  assert.deepEqual([...body.discography.digital, ...body.discography.demo].map((work) => work.playbackVideoId).filter(Boolean), []);
  assert.equal(body.youtube.musicVideos.some((video) => video.id === 'yt-musicVideos-fixture-1'), false);
});

test('T47-STATES S47-14 a save or a delete that the server refuses for the password: 認証できませんでした。 in the line next to it, input kept', async () => {
  for (const status of [401, 403]) {
    const { app } = await openScreen('news', { putStatus: status, putPayload: { error: 'unauthorized' } });
    await type(app, 'edit-title', '認証の確認');
    assert.equal(await app.saveOccPanel('item'), false);
    assert.equal(el(app, 'news-editor-error').textContent, '認証できませんでした。', `save ${status}`);
    assert.equal(el(app, 'edit-title').value, '認証の確認');
    const deleting = app.deleteOccItem();
    await flushAsync();
    await answerLiveDialog(app, 'delete');
    assert.equal(await deleting, false);
    assert.equal(el(app, 'news-editor-error').textContent, '認証できませんでした。', `delete ${status}`);
  }
});

test('T47-STATES S47-15 the API connection failed: the band says API接続失敗（ローカルJSONを読み取り専用で表示）, the header says API Fallback, nothing can be changed and everything can be read (the full list of controls is in T47-MODE)', async () => {
  const { app, puts } = await openOccasionalApp();
  app.setApiFallbackReadOnly(true);
  app.renderModeBadge();
  assert.equal(el(app, 'connectionBanner').textContent, 'API接続失敗（ローカルJSONを読み取り専用で表示）');
  assert.equal(el(app, 'modeBadge').textContent, 'API Fallback');
  assert.equal(app.editNews('fx-news-2'), true, 'an item can be read');
  assert.equal(el(app, 'news-save-btn').disabled, true);
  assert.equal(el(app, 'news-delete-btn').disabled, true);
  assert.equal(el(app, 'news-add-btn').disabled, true);
  assert.equal(el(app, 'edit-title').disabled, true);
  assert.equal(await app.saveOccPanel('item', { force: true }), false);
  assert.equal(puts.length, 0);
});

test('T47-STATES S47-16 Local Mode: the band says ローカルJSONモード（従来運用）, the header says Local Mode with JSONを書き出す, and each save waits for the export', async () => {
  const { app } = await openOccasionalApp({ api: false });
  app.renderModeBadge();
  assert.equal(el(app, 'connectionBanner').textContent, 'ローカルJSONモード（従来運用）');
  assert.equal(el(app, 'modeBadge').textContent, 'Local Mode');
  assert.equal(el(app, 'saveBtn').hidden, false);
  assert.equal(el(app, 'saveBtn').textContent, 'JSONを書き出す');
  app.editNews('fx-news-2');
  await type(app, 'edit-title', '書き出し待ち');
  assert.equal(await app.saveOccPanel('item'), true);
  assert.equal(el(app, 'news-editor-status').textContent, 'JSON書き出し待ち');
});

test('T47-STATES S47-17 the Channel URL has the four states of its own and is saved apart from the open video', async () => {
  const gate = deferred();
  const { app, puts } = await openOccasionalApp({ putGate: gate });
  app.setMusicView('videos');
  app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos');
  await type(app, 'edit-title', '開いている映像の題');
  await type(app, 'youtube-channel-url', 'https://example.test/@channel-only');
  assert.equal(el(app, 'channel-editor-status').textContent, '未保存');
  const saving = app.saveOccPanel('channel');
  await flushAsync();
  assert.equal(el(app, 'channel-editor-status').textContent, '保存しています…');
  gate.resolve();
  assert.equal(await saving, true);
  assert.equal(el(app, 'channel-editor-status').textContent, '保存済み');
  const body = JSON.parse(puts[0].body);
  assert.equal(body.youtube.channelUrl, 'https://example.test/@channel-only');
  assert.notEqual(body.youtube.musicVideos[0].title, '開いている映像の題', 'the open video\'s typed title is not in the Channel URL save');
  assert.equal(el(app, 'music-editor-status').textContent, '未保存', 'and the open video is still unsaved');
});

test('T47-STATES S47-18 after a save or a delete the choices of 顔にする作品 and その場で再生する映像 are drawn again, and what is being typed there is kept (only a value that is no longer a choice goes back to empty)', async () => {
  const { app } = await openOccasionalApp();
  app.setMusicView('works');
  // Site: a typed choice stays when a work is saved
  await type(app, 'site-featured-release-id', 'fx-release-b');
  app.editDiscography('fx-release-b', 'digital');
  await type(app, 'edit-title', '題を変えた作品');
  assert.equal(await app.saveOccPanel('item'), true);
  assert.match(el(app, 'site-featured-release-id').innerHTML, /題を変えた作品/, 'the new title is in the choices');
  assert.equal(el(app, 'site-featured-release-id').value, 'fx-release-b', 'the typed choice is kept');
  assert.equal(app.getOccState().panels.site.dirty, true, 'and Site is still unsaved');
  // a work: its typed choice of video stays when another video is deleted, and goes back to empty when that video is
  app.editDiscography('fx-release-b', 'digital');
  await type(app, 'edit-playbackVideoId', 'yt-musicVideos-fixture-2');
  assert.equal(el(app, 'edit-playbackVideoId').value, 'yt-musicVideos-fixture-2');
  app.rebaseOccDrafts();
  assert.equal(el(app, 'edit-playbackVideoId').value, 'yt-musicVideos-fixture-2', 'still a choice: kept');
  app.getSiteData().youtube.musicVideos = app.getSiteData().youtube.musicVideos.filter((video) => video.id !== 'yt-musicVideos-fixture-2');
  app.rebaseOccDrafts();
  assert.equal(el(app, 'edit-playbackVideoId').value, '', 'no longer a choice: back to 選ばない');
});

test('T47-STATES S47-19 a duplicate Live id: nothing is sent (News, work, Site, Profile, Channel URL and the header export) and the line says Live IDが重複しています', async () => {
  const data = occasionalData();
  data.live.upcoming.push({ ...data.live.upcoming[0] });
  for (const name of ['news', 'work', 'video', 'site', 'profile', 'channel']) {
    const screen = SCREENS[name];
    const { app, puts } = await openScreen(name, { data: plain(data) });
    const original = el(app, screen.field).value;
    await type(app, screen.field, `${original}!`);
    assert.equal(await app.saveOccPanel(screen.key), false, name);
    assert.equal(puts.length, 0, `${name}: nothing is sent`);
    assert.match(el(app, screen.error).textContent, /Live IDが重複しています: fx-live-up/, name);
    assert.equal(statusOf(app, screen), '保存できませんでした', name);
  }
  const local = await openOccasionalApp({ api: false, data: plain(data) });
  assert.equal(await local.app.invokeSaveData({ silent: true }), false);
  assert.match(toast(local.app), /保存できません: Live IDが重複しています: fx-live-up/, 'the Local Mode export says it as before');
});

test('T47-STATES S47-20 long titles, double quotes, full-width characters, new lines, an image that is missing: lists and edit surfaces draw them as text and keep every character', async () => {
  const data = occasionalData();
  const tricky = '題 "二重引用符" <b>タグ</b> & 全角！？　ＡＢＣ';
  data.news[0].title = tricky;
  data.news[0].description = '一行目\n\n三行目（空行の次）\n"引用"';
  data.news[0].image = 'assets/images/missing-file.JPG';
  data.discography.digital[0].title = tricky;
  data.youtube.musicVideos[0].title = tricky;
  const { app } = await openOccasionalApp({ data });
  app.setupTabs();
  for (const id of ['news-list', 'music-works-list']) {
    const markup = el(app, id).innerHTML;
    assert.doesNotMatch(markup, /<b>タグ<\/b>/, `${id}: the title is text, not markup`);
    assert.match(markup, /&lt;b&gt;タグ&lt;\/b&gt;/, `${id}: escaped`);
  }
  app.setMusicView('videos');
  assert.match(el(app, 'music-videos-list').innerHTML, /&lt;b&gt;タグ&lt;\/b&gt;/);
  app.editNews('fx-news-1');
  assert.equal(el(app, 'edit-title').value, tricky);
  assert.equal(el(app, 'edit-description').value, '一行目\n\n三行目（空行の次）\n"引用"');
  assert.equal(el(app, 'edit-image').value, 'assets/images/missing-file.JPG');
  assert.equal(app.isOccDirty(), false, 'looking changes nothing');
  assert.match(appSource, /onerror="this\.style\.visibility='hidden'"/, 'an image that does not load leaves a frame, it does not break the row');
});

// =====================================================================================================================
// T47-MODE
// =====================================================================================================================
const READ_ONLY_CONTROLS = {
  news: ['news-add-btn', 'news-save-btn', 'news-delete-btn', 'edit-title', 'edit-date', 'edit-description', 'edit-link', 'edit-linkText', 'edit-image-select-btn', 'edit-image-clear-btn'],
  work: ['music-add-btn', 'music-save-btn', 'music-delete-btn', 'edit-title', 'edit-releaseDate', 'edit-category', 'edit-releaseType', 'edit-playbackVideoId', 'edit-image-select-btn'],
  video: ['music-save-btn', 'music-delete-btn', 'edit-title', 'edit-youtube', 'edit-category'],
  channel: ['youtube-channel-url', 'channel-save-btn'],
  site: ['site-save-btn', 'site-featured-release-id', 'site-link-bandcamp', 'site-link-youtube', 'site-link-x', 'site-link-instagram', 'site-link-note', 'site-footer-text', 'site-hero-image-select-btn'],
  profile: ['profile-save-btn', 'profile-text', 'profile-link-add-btn', 'profile-image-select-btn'],
};

test('T47-MODE the API connection failed (read-only): every input, save, delete, add and picture button is off; the lists and every item can still be read; no header 保存; nothing is sent', async () => {
  const { app, puts } = await openOccasionalApp();
  app.setupTabs();
  app.setApiFallbackReadOnly(true);
  app.renderModeBadge();
  assert.equal(el(app, 'modeBadge').textContent, 'API Fallback');
  assert.equal(el(app, 'connectionBanner').textContent, 'API接続失敗（ローカルJSONを読み取り専用で表示）');
  assert.equal(el(app, 'saveBtn').hidden, true, 'no header 保存');
  assert.equal(await app.invokeSaveData(), false);

  // everything can be read
  assert.equal((el(app, 'news-list').innerHTML.match(/data-occ-open=/g) || []).length, 6, 'the News list is readable');
  assert.equal(app.editNews('fx-news-2'), true, 'a News item opens');
  assert.equal(el(app, 'edit-title').value, occasionalData().news[1].title);
  for (const id of READ_ONLY_CONTROLS.news) if (el(app, id)) assert.equal(el(app, id).disabled, true, `${id} is off`);
  assert.equal(el(app, 'news-editor-back').disabled, false, '‹ 一覧 still works');
  assert.equal(app.closeOccEditor(), true);

  app.setMusicView('works');
  assert.equal(app.editDiscography('fx-release-a', 'digital'), true, 'a work opens');
  assert.equal(el(app, 'edit-title').value, occasionalData().discography.digital[0].title);
  for (const id of READ_ONLY_CONTROLS.work) if (el(app, id)) assert.equal(el(app, id).disabled, true, `${id} is off`);
  assert.equal(await app.saveOccPanel('item'), false);
  assert.equal(await app.deleteOccItem(), false);
  app.closeOccEditor();
  app.setMusicView('videos');
  assert.equal(app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos'), true, 'a video opens');
  for (const id of READ_ONLY_CONTROLS.video) if (el(app, id)) assert.equal(el(app, id).disabled, true, `${id} is off`);
  for (const id of READ_ONLY_CONTROLS.channel) assert.equal(el(app, id).disabled, true, `${id} is off`);
  assert.equal(await app.saveOccPanel('channel'), false);
  app.closeOccEditor();

  for (const id of [...READ_ONLY_CONTROLS.site, ...READ_ONLY_CONTROLS.profile]) if (el(app, id)) assert.equal(el(app, id).disabled, true, `${id} is off`);
  assert.equal(await app.saveOccPanel('site'), false);
  assert.equal(await app.saveOccPanel('profile'), false);

  // what is typed is put back (nothing changes), and nothing was ever sent
  const before = plain(app.getSiteData());
  await el(app, 'site-footer-text').dispatch('input');
  assert.deepEqual(plain(app.getSiteData()), before);
  assert.equal(puts.length, 0);
  assert.equal(app.isOccDirty(), false, 'nothing can become unsaved');
  // the tabs and the lists are still used
  await el(app, 'global-tab-news').dispatch('click');
  assert.equal(app.getActiveGlobalTab(), 'news');
});

test('T47-MODE Local Mode: the header says JSONを書き出す, every 保存して公開 reflects into memory and waits for the export, the export writes everything that was saved, and no request is made', async () => {
  const { app, puts } = await openOccasionalApp({ api: false });
  app.setupTabs();
  app.renderModeBadge();
  assert.equal(el(app, 'modeBadge').textContent, 'Local Mode');
  assert.equal(el(app, 'connectionBanner').textContent, 'ローカルJSONモード（従来運用）');
  assert.equal(el(app, 'saveBtn').hidden, false);
  assert.equal(el(app, 'saveBtn').textContent, 'JSONを書き出す');

  app.editNews('fx-news-2');
  await type(app, 'edit-title', 'ローカルのお知らせ');
  assert.equal(await app.saveOccPanel('item'), true);
  app.closeOccEditor();
  app.setMusicView('works');
  app.editDiscography('fx-release-b', 'digital');
  await type(app, 'edit-title', 'ローカルの作品');
  assert.equal(await app.saveOccPanel('item'), true);
  app.closeOccEditor();
  await type(app, 'site-footer-text', 'ローカルのフッター');
  assert.equal(await app.saveOccPanel('site'), true);
  await type(app, 'profile-text', 'ローカルの文');
  assert.equal(await app.saveOccPanel('profile'), true);
  await type(app, 'youtube-channel-url', 'https://example.test/@local');
  assert.equal(await app.saveOccPanel('channel'), true);
  for (const key of ['site', 'profile', 'channel']) assert.equal(el(app, `${key}-editor-status`).textContent, 'JSON書き出し待ち', key);
  assert.equal(app.getHasChanges(), true);
  assert.equal(app.getSiteData().news[1].title, 'ローカルのお知らせ', 'reflected into memory');
  assert.equal(puts.length, 0);

  assert.equal(await app.invokeSaveData({ silent: true }), true, 'the export');
  const written = JSON.parse(await app.objectUrls.at(-1).blob.text());
  assert.equal(written.news[1].title, 'ローカルのお知らせ');
  assert.equal(written.discography.digital.find((work) => work.id === 'fx-release-b').title, 'ローカルの作品');
  assert.equal(written.site.footerText, 'ローカルのフッター');
  assert.equal(written.profile.text, 'ローカルの文');
  assert.equal(written.youtube.channelUrl, 'https://example.test/@local');
  assert.equal(app.getHasChanges(), false);
  for (const key of ['site', 'profile', 'channel']) assert.equal(el(app, `${key}-editor-status`).textContent, '保存済み', `${key} after the export`);
  assert.equal(puts.length, 0, 'Local Mode never calls the API');
});

test('T47-MODE while the API is connected the header button is hidden on every tab and the whole data is sent from nowhere: invokeSaveData sends nothing, whatever is unsaved', async () => {
  const { app, puts } = await openOccasionalApp();
  app.setupTabs();
  app.renderModeBadge();
  for (const tab of TABS_OF_THE_PAGE) {
    await el(app, `global-tab-${tab}`).dispatch('click');
    assert.equal(el(app, 'saveBtn').hidden, true, `${tab}: hidden`);
  }
  await type(app, 'profile-text', '未保存の文');
  app.markChanged();
  assert.equal(el(app, 'saveBtn').hidden, true);
  assert.equal(await app.invokeSaveData(), false);
  assert.equal(await app.invokeSaveData({ silent: true }), false);
  assert.equal(puts.length, 0);
});
const TABS_OF_THE_PAGE = ['site', 'news', 'live', 'music', 'profile'];

test('T47-MODE the generic modal is gone: no markup, no function, nothing opens it (the working tree only; the base commit still has it)', () => {
  assert.doesNotMatch(html, /id="modal"|id="modal-overlay"|id="modal-body"|id="modal-title"|id="modal-save-btn"|id="delete-btn"|closeModal\(|saveModal\(|deleteItem\(\)/);
  for (const name of ['showModal', 'closeModal', 'handleModalKeydown', 'saveModal', 'saveYouTubeItem', 'saveDiscographyItem', 'restoreGenericModalCanonicalValues', 'setGenericModalCanonicalValues', 'prepareGenericEditorTransition']) {
    assert.doesNotMatch(appSource, new RegExp(`function ${name}\\(`), `${name} is removed`);
    assert.doesNotMatch(appSource, new RegExp(`\\b${name}\\(`), `nothing calls ${name}`);
  }
  assert.doesNotMatch(appSource, /getElementById\('modal(-[a-z]+)?'\)/, 'no code reaches for the modal elements');
  assert.match(appSource, /function deleteItem\(\) \{[\s\S]{0,260}deleteLiveFromWorkspace\(\)/, 'the Live delete keeps its name');
  const app = loadAdminApp();
  assert.equal(app.saveModal, null);
  assert.equal(app.showModal, null);
  assert.equal(app.closeModal, null);
  assert.equal(app.saveDiscographyItem, null);
});

test('T47-MODE the whole-data save is gone from the screen code: only saveScoped reaches the API, and saveData (Local Mode export) cannot send', () => {
  assert.doesNotMatch(appSource.slice(appSource.indexOf('async function saveData')), /saveToApi\(\)/, 'saveData does not call saveToApi');
  const calls = [...appSource.matchAll(/saveToApi\(([^)]*)\)/g)].map((match) => match[1].trim());
  assert.ok(calls.every((argument) => argument.startsWith('payload') || argument === ''), 'the only caller passes the payload saveScoped built');
  assert.equal(calls.filter((argument) => argument === '').length, 0, 'nobody calls saveToApi() for the whole data');
  assert.match(appSource, /async function saveData\(options = \{\}\) \{\s*if \(IS_API_MODE\) return false;/);
});

// =====================================================================================================================
// T47-A11Y
// =====================================================================================================================
test('T47-A11Y the rows of the lists are buttons; the edit surfaces are regions named by their heading; the statuses are announced (role=status, aria-live) and the reasons are alerts', async () => {
  const { app } = await openOccasionalApp();
  app.setupTabs();
  for (const id of ['news-list', 'music-works-list', 'music-videos-list']) {
    const rows = [...el(app, id).innerHTML.matchAll(/<(\w+)[^>]*data-occ-open="[^"]*"[^>]*>/g)];
    assert.ok(rows.length > 0, `${id} has rows`);
    for (const [, tag] of rows) assert.equal(tag, 'button', `${id}: a row is a button`);
    assert.match(el(app, id).innerHTML, /type="button"/);
  }
  assert.match(html, /<section class="occ-editor-pane" id="news-editor-pane" aria-labelledby="news-editor-heading">/);
  assert.match(html, /<section class="occ-editor-pane" id="music-editor-pane" aria-labelledby="music-editor-heading">/);
  assert.match(html, /<h3 class="occ-editor-heading" id="news-editor-heading">/);
  for (const id of ['news-editor-status', 'news-editor-status-wide', 'music-editor-status', 'music-editor-status-wide', 'channel-editor-status', 'site-editor-status', 'profile-editor-status']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*role="status" aria-live="polite"|role="status" aria-live="polite"[^>]*id="${id}"|class="occ-status[^"]*" id="${id}" role="status" aria-live="polite"`), `${id} is announced`);
  }
  for (const id of ['news-editor-error', 'music-editor-error', 'channel-editor-error', 'site-editor-error', 'profile-editor-error']) {
    assert.match(html, new RegExp(`id="${id}" role="alert"`), `${id} is an alert`);
  }
  app.editDiscography('fx-release-a', 'digital');
  assert.match(el(app, 'music-editor-body').innerHTML, /<div id="edit-releaseDate-error" class="form-error" role="alert">/);
  assert.match(el(app, 'music-editor-body').innerHTML, /aria-describedby="edit-releaseDate-error"/);
  assert.match(el(app, 'music-editor-body').innerHTML, /<label for="edit-title">/, 'every field has its label');
});

test('T47-A11Y the confirmation surface is an alertdialog named by its title and described by its body; the delete confirmation focuses やめる, the unsaved one 編集を続ける', async () => {
  assert.match(html, /<div class="live-dialog" id="live-dialog" role="alertdialog" aria-modal="true" aria-labelledby="live-dialog-title" aria-describedby="live-dialog-body">/);
  const { app } = await openOccasionalApp();
  app.editNews('fx-news-2');
  el(app, 'news-delete-btn').focus();
  const deleting = app.deleteOccItem();
  await flushAsync();
  assert.ok(dialogHtml(app).includes('id="live-dialog-title"'), 'the title the dialog is named by exists');
  assert.ok(dialogHtml(app).includes('id="live-dialog-body"'), 'the body it is described by exists');
  assert.equal(app.document.activeElement, el(app, 'live-dialog-action-cancel'));
  await answerLiveDialog(app, 'cancel');
  await deleting;
  assert.equal(app.document.activeElement?.id, 'news-delete-btn', 'the focus goes back to where it was');
  await type(app, 'edit-title', '未保存');
  app.addNews();
  await flushAsync();
  assert.equal(app.document.activeElement, el(app, 'live-dialog-action-stay'));
  await answerLiveDialog(app, 'stay');
});

test('T47-A11Y the focus goes back to the row that opened an item when ‹ 一覧 closes it, and the first input of an edit has the focus when it opens', async () => {
  for (const [rowsId, openIt, itemId] of [
    ['news-list', (app) => app.editNews('fx-news-3'), 'fx-news-3'],
    ['music-works-list', (app) => { app.setMusicView('works'); return app.editDiscography('fx-release-b', 'digital'); }, 'fx-release-b'],
    ['music-videos-list', (app) => { app.setMusicView('videos'); return app.editYouTubeVideo('yt-musicVideos-fixture-2', 'musicVideos'); }, 'yt-musicVideos-fixture-2'],
  ]) {
    const { app } = await openOccasionalApp();
    app.setupTabs();
    // the row is a button with data-occ-open / data-occ-id; the person pressed it, so it has the focus when the edit opens
    const row = createElement(`row-${itemId}`, app.document, 'button');
    row.dataset.occOpen = 'x';
    row.dataset.occId = itemId;
    app.document.querySelectorAll = (selector) => (selector === '[data-occ-open]' ? [row] : []);
    row.focus();
    assert.equal(openIt(app), true);
    assert.notEqual(app.document.activeElement, row, `${rowsId}: the focus moved into the edit`);
    assert.match(app.document.activeElement?.id || '', /^edit-/, `${rowsId}: the first input of the edit has it`);
    const before = row.focusCount;
    assert.equal(app.closeOccEditor(), true);
    assert.equal(row.focusCount, before + 1, `${rowsId}: the row that was open has the focus again`);
    assert.equal(app.document.activeElement, row);
  }
});

test('T47-A11Y 作品／映像 is a tablist: the buttons are tabs with aria-selected / tabindex, ArrowLeft / ArrowRight / Home / End move and select, a click selects', async () => {
  assert.match(html, /<div class="occ-switch" role="tablist" aria-label="Music">/);
  const { app } = await openOccasionalApp();
  app.setupTabs();
  const selected = () => ({ works: el(app, 'music-switch-works').getAttribute('aria-selected'), videos: el(app, 'music-switch-videos').getAttribute('aria-selected') });
  const tabindex = () => ({ works: el(app, 'music-switch-works').getAttribute('tabindex'), videos: el(app, 'music-switch-videos').getAttribute('tabindex') });
  assert.deepEqual(selected(), { works: 'true', videos: 'false' });
  assert.deepEqual(tabindex(), { works: '0', videos: '-1' });
  await el(app, 'music-switch-works').dispatch('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.equal(app.getMusicView(), 'videos');
  assert.deepEqual(selected(), { works: 'false', videos: 'true' });
  assert.deepEqual(tabindex(), { works: '-1', videos: '0' });
  await el(app, 'music-switch-videos').dispatch('keydown', { key: 'ArrowLeft', preventDefault() {} });
  assert.equal(app.getMusicView(), 'works');
  await el(app, 'music-switch-works').dispatch('keydown', { key: 'End', preventDefault() {} });
  assert.equal(app.getMusicView(), 'videos');
  await el(app, 'music-switch-videos').dispatch('keydown', { key: 'Home', preventDefault() {} });
  assert.equal(app.getMusicView(), 'works');
  await el(app, 'music-switch-videos').dispatch('click');
  assert.equal(app.getMusicView(), 'videos');
  assert.deepEqual(selected(), { works: 'false', videos: 'true' });
});

test('T47-A11Y with an unsaved edit the arrow keys of 作品／映像 ask first and stay on the tab if the person stays', async () => {
  const { app } = await openOccasionalApp();
  app.setupTabs();
  app.setMusicView('works');
  app.editDiscography('fx-release-a', 'digital');
  await type(app, 'edit-title', '未保存');
  await el(app, 'music-switch-works').dispatch('keydown', { key: 'ArrowRight', preventDefault() {} });
  await flushAsync();
  assert.equal(dialogOpen(app), true);
  await answerLiveDialog(app, 'stay');
  assert.equal(app.getMusicView(), 'works');
  assert.equal(el(app, 'music-switch-works').getAttribute('aria-selected'), 'true');
});

// =====================================================================================================================
// T47-FIXTURE
// =====================================================================================================================
const DATA_SCENARIOS = Object.entries(fixture.scenarios).filter(([, scenario]) => !scenario.fail && scenario.mode === 'api');

function itemsOf(data) {
  const items = [];
  for (const item of data.news) items.push({ kind: 'news', id: item.id, title: item.title, open: (app) => app.editNews(item.id), field: 'edit-title', slot: 'news' });
  for (const category of ['digital', 'demo']) {
    for (const item of data.discography[category]) items.push({ kind: 'release', id: item.id, title: item.title, open: (app) => app.editDiscography(item.id, category), field: 'edit-title', slot: category, view: 'works' });
  }
  for (const category of ['musicVideos', 'liveMovies', 'demos']) {
    for (const item of data.youtube[category]) items.push({ kind: 'video', id: item.id, title: item.title, open: (app) => app.editYouTubeVideo(item.id, category), field: 'edit-title', slot: category, view: 'videos' });
  }
  return items;
}

for (const [scenarioName, scenario] of DATA_SCENARIOS) {
  test(`T47-FIXTURE ${scenarioName}: the lists draw, every item opens with its values as they are, opening and closing changes nothing and sends nothing, one change saves and the item opens again`, async () => {
    const data = occasionalData(scenario.variant);
    const { app, puts } = await openOccasionalApp({ variant: scenario.variant });
    app.setupTabs();
    const loaded = plain(app.getSiteData());
    for (const id of ['news-list', 'music-works-list', 'music-videos-list']) assert.ok(el(app, id).innerHTML.length > 0, `${id} drew`);
    const items = itemsOf(data);
    for (const item of items) {
      if (item.view) app.setMusicView(item.view);
      assert.equal(item.open(app), true, `${item.kind} ${item.id} opens`);
      assert.equal(app.getOccState().active.id, item.id);
      if (item.title !== undefined) assert.equal(el(app, item.field).value, item.title ?? '', `${item.id}: the title is shown as it is (quotes, full-width and all)`);
      assert.equal(app.isOccDirty(), false, `${item.id}: looking is not a change`);
      assert.equal(app.closeOccEditor(), true, `${item.id}: closes at once`);
    }
    assert.deepEqual(plain(app.getSiteData()), loaded, 'opening and closing everything changed nothing');
    assert.equal(puts.length, 0, 'and sent nothing');

    // one change per kind, saved, and opened again (an empty list gets a new item instead)
    for (const kind of ['news', 'release', 'video']) {
      const item = items.find((candidate) => candidate.kind === kind);
      if (item) {
        if (item.view) app.setMusicView(item.view);
        item.open(app);
        await type(app, item.field, `${item.title ?? ''}（変更）`);
        assert.equal(await app.saveOccPanel('item'), true, `${scenarioName}: ${kind} saves`);
        assert.equal(app.closeOccEditor(), true);
        assert.equal(item.open(app), true, `${kind}: opens again (it may have moved to the head of its category)`);
        assert.equal(el(app, item.field).value, `${item.title ?? ''}（変更）`, `${kind}: shows the saved value`);
      } else {
        if (kind !== 'news') app.setMusicView(kind === 'release' ? 'works' : 'videos');
        assert.equal(kind === 'news' ? app.addNews() : app.addMusicItem(), true, `${scenarioName}: a new ${kind} in an empty list`);
        await type(app, 'edit-title', '新しい項目');
        if (kind === 'video') await type(app, 'edit-youtube', 'abcdefghijk');
        assert.equal(await app.saveOccPanel('item'), true, `${scenarioName}: a new ${kind} saves`);
        assert.equal(el(app, 'edit-title').value, '新しい項目');
      }
      app.closeOccEditor();
    }
    // Site and Profile
    await type(app, 'site-footer-text', '架空のフッター（変更）');
    assert.equal(await app.saveOccPanel('site'), true);
    await type(app, 'profile-text', `${el(app, 'profile-text').value}\n（変更）`);
    assert.equal(await app.saveOccPanel('profile'), true);
    assert.equal(el(app, 'site-footer-text').value, '架空のフッター（変更）');
    assert.ok(el(app, 'profile-text').value.endsWith('\n（変更）'));
  });
}

test('T47-FIXTURE the base data: News, works and videos keep a double quote, full-width characters, new lines and blank lines exactly (opened and saved unchanged they are the same string)', async () => {
  const { app, puts } = await openOccasionalApp();
  app.editNews('fx-news-2');
  assert.match(el(app, 'edit-title').value, /"引用符"/);
  const description = el(app, 'edit-description').value;
  assert.equal(description, occasionalData().news[1].description);
  await type(app, 'edit-title', `${el(app, 'edit-title').value}`);
  assert.equal(await app.saveOccPanel('item', { force: true }), true);
  assert.equal(JSON.parse(puts[0].body).news[1].description, description);
  assert.equal(JSON.parse(puts[0].body).news[1].title, occasionalData().news[1].title);
});

test('T47-FIXTURE an item whose id looks like a number opens from its row (the id is text in the row and a number in the data)', async () => {
  const { app } = await openOccasionalApp({ variant: 'numericIds' });
  const numeric = app.getSiteData().news.find((item) => typeof item.id === 'number');
  assert.ok(numeric, 'the scenario has a number as an id');
  assert.equal(app.editNews(String(numeric.id)), true);
  assert.equal(app.getOccState().active.id, numeric.id);
  assert.equal(el(app, 'edit-title').value, numeric.title);
  assert.equal(app.isOccDirty(), false);
});

for (const [scenarioName, scenario] of Object.entries(fixture.scenarios).filter(([, entry]) => entry.fail || entry.mode !== 'api')) {
  test(`T47-FIXTURE ${scenarioName}: the mode and the failure the fixture describes behave as the states say`, async () => {
    if (scenario.mode === 'api-fallback') {
      const { app, puts } = await openOccasionalApp();
      app.setApiFallbackReadOnly(true);
      assert.equal(app.editNews('fx-news-2'), true, 'readable');
      assert.equal(await app.saveOccPanel('item', { force: true }), false);
      assert.equal(puts.length, 0);
    } else if (scenario.mode === 'local') {
      const { app, puts } = await openOccasionalApp({ api: false });
      app.editNews('fx-news-2');
      await type(app, 'edit-title', 'ローカル');
      assert.equal(await app.saveOccPanel('item'), true);
      assert.equal(el(app, 'news-editor-status').textContent, 'JSON書き出し待ち');
      assert.equal(puts.length, 0);
    } else if (scenario.fail === 'save') {
      const { app, puts } = await openOccasionalApp({ putStatus: 400, putPayload: { error: '架空の失敗' } });
      app.editNews('fx-news-2');
      await type(app, 'edit-title', '失敗');
      assert.equal(await app.saveOccPanel('item'), false);
      assert.equal(el(app, 'news-editor-status').textContent, '保存できませんでした');
      assert.equal(puts.length, 1);
      assert.equal(el(app, 'edit-title').value, '失敗');
    } else if (scenario.fail === 'delete') {
      const { app } = await openOccasionalApp({ putStatus: 400, putPayload: { error: '架空の失敗' } });
      app.editNews('fx-news-2');
      const deleting = app.deleteOccItem();
      await flushAsync();
      await answerLiveDialog(app, 'delete');
      assert.equal(await deleting, false);
      assert.equal(app.getSiteData().news.length, 6, 'the item is still there');
      assert.ok(app.getOccState().active, 'and the surface stays');
    } else {
      assert.fail(`the scenario ${scenarioName} is not covered`);
    }
  });
}

test('T47-FIXTURE the fixture itself has the shape of the production data (counts and shapes only), and every value is synthetic', () => {
  const data = fixture.data;
  assert.equal(data.news.length, 6);
  assert.deepEqual(Object.keys(data.news[0]), ['id', 'date', 'title', 'description', 'image', 'link', 'linkText']);
  assert.equal(data.discography.digital.length + data.discography.demo.length, 4);
  assert.equal(data.discography.digital.length, 2);
  assert.equal(Object.keys(data.discography.digital[0]).length, 8);
  assert.equal(Object.values(data.youtube).filter(Array.isArray).flat().length, 5);
  assert.ok(data.youtube.musicVideos.every((video) => video.youtubeId.length === 11));
  assert.equal(data.profile.links.length, 4);
  assert.equal(Object.keys(data.site.links).length, 5);
  const text = JSON.stringify(fixture);
  assert.doesNotMatch(text, /1212hp\.com|workers\.dev|giftee|@gmail|Bearer /i, 'no production host, person or token');
  for (const url of text.match(/https?:\/\/[^"\s\\]+/g) || []) assert.match(url, /^https?:\/\/(?:[\w.-]+\.)?example\.test(?:[/:?#]|$)|^https:\/\/youtu\.be\/fixture[A-Za-z0-9]+$/, `${url} is a synthetic address`);
});
