// Issue #47 stage 5: T47-GUARD for every way out of every screen of the occasional updates.
//   Screens: a News item, a work, a video, the Channel URL, Site, Profile.
//   Ways out: another item, ‹ 一覧, + 追加, 作品／映像, the five global tabs (Site and Profile only have the tabs).
//   Each way out is tried twice: with an unsaved input (the confirmation surface, 編集を続ける focused; Stay, Escape and the backdrop change
//   nothing; 破棄して移動 moves and the input is back to the saved content) and with nothing unsaved (no surface, the move is made at once).
//   Then: a picture still uploading, a save in progress, an unsaved Live / Ticket Page settings, and the browser's own question (beforeunload).
// Values come from test/fixtures/admin-occasional-states.json (synthetic). Nothing reaches a network.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  answerLiveDialog,
  deferred,
  flushAsync,
  jsonResponse,
  occasionalData,
  openOccasionalApp,
} from './support/admin-app-harness.mjs';

const el = (app, id) => app.elements.get(id);
const dialogOpen = (app) => el(app, 'live-dialog-overlay').hidden === false;
const dialogHtml = (app) => el(app, 'live-dialog').innerHTML;
const plain = (value) => JSON.parse(JSON.stringify(value));
const TABS = ['site', 'news', 'live', 'music', 'profile'];
const UNSAVED_TITLE = '保存していない変更があります。';

async function type(app, id, value) {
  el(app, id).value = value;
  await el(app, id).dispatch('input');
}

const picture = (name) => Object.assign(new Blob(['x'], { type: 'image/png' }), { name });

class ImmediateReader {
  readAsDataURL() { this.onload?.({ target: { result: 'data:image/png;base64,TEST_IMAGE' } }); }
}

const tabMoves = (own) => TABS.filter((tab) => tab !== own).map((tab) => ({
  name: `the ${tab} tab`,
  run: (app) => el(app, `global-tab-${tab}`).dispatch('click'),
  moved: (app) => app.getActiveGlobalTab() === tab,
}));

const SURFACES = {
  'a News item': {
    tab: 'news',
    open: (app) => app.editNews('fx-news-2'),
    here: (app) => app.getOccState().active?.id === 'fx-news-2',
    field: 'edit-title',
    saved: () => occasionalData().news[1].title,
    moves: [
      { name: 'another item', run: (app) => app.editNews('fx-news-3'), moved: (app) => app.getOccState().active?.id === 'fx-news-3' },
      { name: '‹ 一覧', run: (app) => app.closeOccEditor(), moved: (app) => app.getOccState().active === null },
      { name: '+ 追加', run: (app) => app.addNews(), moved: (app) => app.getOccState().active?.isNew === true && app.getOccState().active?.kind === 'news' },
      ...tabMoves('news'),
    ],
  },
  'a work': {
    tab: 'music',
    view: 'works',
    open: (app) => app.editDiscography('fx-release-a', 'digital'),
    here: (app) => app.getOccState().active?.id === 'fx-release-a',
    field: 'edit-title',
    saved: () => occasionalData().discography.digital[0].title,
    moves: [
      { name: 'another work', run: (app) => app.editDiscography('fx-release-b', 'digital'), moved: (app) => app.getOccState().active?.id === 'fx-release-b' },
      { name: '‹ 一覧', run: (app) => app.closeOccEditor(), moved: (app) => app.getOccState().active === null },
      { name: '+ 追加', run: (app) => app.addMusicItem(), moved: (app) => app.getOccState().active?.isNew === true && app.getOccState().active?.kind === 'release' },
      { name: '作品／映像 (映像へ)', run: (app) => app.setMusicView('videos'), moved: (app) => app.getMusicView() === 'videos' },
      ...tabMoves('music'),
    ],
  },
  'a video': {
    tab: 'music',
    view: 'videos',
    open: (app) => app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos'),
    here: (app) => app.getOccState().active?.id === 'yt-musicVideos-fixture-1',
    field: 'edit-title',
    saved: () => occasionalData().youtube.musicVideos[0].title,
    moves: [
      { name: 'another video', run: (app) => app.editYouTubeVideo('yt-musicVideos-fixture-2', 'musicVideos'), moved: (app) => app.getOccState().active?.id === 'yt-musicVideos-fixture-2' },
      { name: '‹ 一覧', run: (app) => app.closeOccEditor(), moved: (app) => app.getOccState().active === null },
      { name: '+ 追加', run: (app) => app.addMusicItem(), moved: (app) => app.getOccState().active?.isNew === true && app.getOccState().active?.kind === 'video' },
      { name: '作品／映像 (作品へ)', run: (app) => app.setMusicView('works'), moved: (app) => app.getMusicView() === 'works' },
      ...tabMoves('music'),
    ],
  },
  'the Channel URL': {
    tab: 'music',
    view: 'videos',
    open: () => true,
    here: (app) => app.getActiveGlobalTab() === 'music' && app.getMusicView() === 'videos',
    field: 'youtube-channel-url',
    saved: () => occasionalData().youtube.channelUrl,
    moves: [
      { name: '作品／映像 (作品へ)', run: (app) => app.setMusicView('works'), moved: (app) => app.getMusicView() === 'works' },
      ...tabMoves('music'),
    ],
  },
  Site: {
    tab: 'site',
    open: () => true,
    here: (app) => app.getActiveGlobalTab() === 'site',
    field: 'site-footer-text',
    saved: () => occasionalData().site.footerText,
    moves: tabMoves('site'),
  },
  Profile: {
    tab: 'profile',
    open: () => true,
    here: (app) => app.getActiveGlobalTab() === 'profile',
    field: 'profile-text',
    saved: () => occasionalData().profile.text,
    moves: tabMoves('profile'),
  },
};

async function ready(surface, options = {}) {
  const opened = await openOccasionalApp(options);
  const { app } = opened;
  app.setupTabs();
  if (surface.tab !== 'live') await el(app, `global-tab-${surface.tab}`).dispatch('click');
  assert.equal(app.getActiveGlobalTab(), surface.tab, 'the screen is the one in use');
  if (surface.view) app.setMusicView(surface.view);
  surface.open(app);
  return opened;
}

const pressEscape = (app) => app.dispatchDocument('keydown', { key: 'Escape', preventDefault() {} });

// ---------------------------------------------------------------------------------------------------------------------
// unsaved: asks. clean: moves at once.
// ---------------------------------------------------------------------------------------------------------------------
for (const [surfaceName, surface] of Object.entries(SURFACES)) {
  for (const move of surface.moves) {
    test(`T47-GUARD ${surfaceName} unsaved + ${move.name}: the confirmation surface opens with 編集を続ける focused; Stay, Escape and the backdrop change nothing; 破棄して移動 moves and the input goes back to what is saved`, async () => {
      const { app, puts } = await ready(surface);
      const loaded = plain(app.getSiteData());
      await type(app, surface.field, '未保存の入力');
      assert.equal(app.isOccDirty(), true);
      el(app, surface.field).focus();

      move.run(app);
      await flushAsync();
      assert.equal(dialogOpen(app), true, 'the surface opens');
      assert.match(dialogHtml(app), new RegExp(UNSAVED_TITLE));
      assert.match(dialogHtml(app), /破棄して移動/);
      assert.match(dialogHtml(app), /編集を続ける/);
      assert.equal(app.document.activeElement, el(app, 'live-dialog-action-stay'), 'the safe choice has the focus');
      assert.equal(move.moved(app), false, 'nothing moved while the surface is open');

      // 編集を続ける
      await answerLiveDialog(app, 'stay');
      await flushAsync();
      assert.equal(dialogOpen(app), false);
      assert.equal(surface.here(app), true, 'still on the same screen');
      assert.equal(move.moved(app), false);
      assert.equal(el(app, surface.field).value, '未保存の入力', 'the input is kept');
      assert.equal(app.isOccDirty(), true);

      // Escape
      move.run(app);
      await flushAsync();
      assert.equal(dialogOpen(app), true);
      await pressEscape(app);
      await flushAsync();
      assert.equal(dialogOpen(app), false);
      assert.equal(move.moved(app), false);
      assert.equal(el(app, surface.field).value, '未保存の入力');

      // the backdrop
      move.run(app);
      await flushAsync();
      assert.equal(dialogOpen(app), true);
      await el(app, 'live-dialog-overlay').dispatch('click');
      await flushAsync();
      assert.equal(dialogOpen(app), false);
      assert.equal(move.moved(app), false);
      assert.equal(el(app, surface.field).value, '未保存の入力');
      assert.equal(app.isOccDirty(), true);

      // 破棄して移動
      move.run(app);
      await answerLiveDialog(app, 'discard');
      await flushAsync();
      assert.equal(move.moved(app), true, 'it moved');
      assert.equal(app.isOccDirty(), false, 'nothing is unsaved after the input was dropped');
      assert.deepEqual(plain(app.getSiteData()), loaded, 'and nothing was saved');
      assert.equal(puts.length, 0, 'no request');
      if (['Site', 'Profile', 'the Channel URL'].includes(surfaceName)) {
        assert.equal(el(app, surface.field).value, surface.saved(), 'the input shows the saved content again');
      }
    });

    test(`T47-GUARD ${surfaceName} nothing unsaved + ${move.name}: no surface, the move is made at once`, async () => {
      const { app, puts } = await ready(surface);
      assert.equal(app.isOccDirty(), false);
      const result = move.run(app);
      assert.notEqual(typeof result?.then === 'function' && move.name.includes('tab') === false, true, 'a move that is not a tab click answers at once, not with a Promise');
      await flushAsync();
      assert.equal(dialogOpen(app), false, 'nothing is asked');
      assert.equal(move.moved(app), true);
      assert.equal(puts.length, 0);
    });
  }
}

test('T47-GUARD typing a value and putting it back is nothing unsaved: Site, Profile and the Channel URL leave without asking', async () => {
  for (const name of ['Site', 'Profile', 'the Channel URL']) {
    const surface = SURFACES[name];
    const { app } = await ready(surface);
    await type(app, surface.field, '一時の入力');
    assert.equal(app.isOccDirty(), true, name);
    await type(app, surface.field, surface.saved());
    assert.equal(app.isOccDirty(), false, `${name}: put back`);
    await el(app, `global-tab-${surface.moves.at(-1).name.replace('the ', '').replace(' tab', '')}`).dispatch('click');
    assert.equal(dialogOpen(app), false, name);
  }
});

test('T47-GUARD the Channel URL is not asked about when moving inside the list: another video, ‹ 一覧 and 作品／映像 within the video (scope: the open item)', async () => {
  const { app } = await ready(SURFACES['the Channel URL']);
  await type(app, 'youtube-channel-url', 'https://example.test/@typed');
  assert.equal(app.editYouTubeVideo('yt-musicVideos-fixture-1', 'musicVideos'), true, 'opening a video does not ask about the Channel URL');
  assert.equal(app.editYouTubeVideo('yt-musicVideos-fixture-2', 'musicVideos'), true, 'another video does not ask either');
  assert.equal(app.closeOccEditor(), true, '‹ 一覧 does not ask');
  assert.equal(dialogOpen(app), false);
  assert.equal(el(app, 'youtube-channel-url').value, 'https://example.test/@typed', 'and what was typed stays');
  assert.equal(app.getOccState().panels.channel.dirty, true);
  // …but leaving the Music screen or switching 作品／映像 does
  app.setMusicView('works');
  await flushAsync();
  assert.equal(dialogOpen(app), true);
  await answerLiveDialog(app, 'stay');
});

test('T47-GUARD a picture still uploading is unsaved: every way out asks, and 破棄して移動 lets the upload go (Site, Profile, a News item, a work)', async () => {
  const cases = [
    ['Site', 'site-hero-image', (app) => el(app, 'global-tab-news').dispatch('click'), (app) => app.getActiveGlobalTab() === 'news'],
    ['Profile', 'profile-image', (app) => el(app, 'global-tab-music').dispatch('click'), (app) => app.getActiveGlobalTab() === 'music'],
    ['a News item', 'edit-image', (app) => app.closeOccEditor(), (app) => app.getOccState().active === null],
    ['a work', 'edit-image', (app) => app.setMusicView('videos'), (app) => app.getMusicView() === 'videos'],
  ];
  for (const [name, imageId, move, moved] of cases) {
    const gate = deferred();
    const { app, puts } = await ready(SURFACES[name], {
      fileReader: ImmediateReader,
      upload: () => gate.promise.then(() => jsonResponse({ url: 'https://img.example.test/late.png' })),
    });
    assert.equal(app.isOccDirty(), false, name);
    assert.equal(app.handleImageSelect({ files: [picture('Pic.png')] }, imageId), true, name);
    assert.equal(app.isOccDirty(), true, `${name}: uploading counts as unsaved`);
    move(app);
    await flushAsync();
    assert.equal(dialogOpen(app), true, `${name}: asks while the picture uploads`);
    await answerLiveDialog(app, 'stay');
    assert.equal(moved(app), false, name);
    move(app);
    await answerLiveDialog(app, 'discard');
    await flushAsync();
    assert.equal(moved(app), true, name);
    assert.equal(app.ensureNoActiveImageUploads(), true, `${name}: the upload was let go`);
    gate.resolve();
    await flushAsync();
    assert.equal(puts.length, 0, name);
    assert.equal(app.isOccDirty(), false, `${name}: the late answer did not make anything unsaved again`);
  }
});

test('T47-GUARD while a save is running nothing moves and nothing is asked: the tabs, the items, ‹ 一覧 and 作品／映像 wait', async () => {
  const gate = deferred();
  const { app } = await ready(SURFACES['a work'], { putGate: gate });
  await type(app, 'edit-title', '保存中の題');
  const saving = app.saveOccPanel('item');
  await flushAsync();
  assert.equal(app.getOccState().saving, true);
  assert.equal(app.editDiscography('fx-release-b', 'digital'), false);
  assert.equal(app.closeOccEditor(), false);
  assert.equal(app.addMusicItem(), false);
  assert.equal(app.setMusicView('videos'), false);
  await el(app, 'global-tab-news').dispatch('click');
  assert.equal(app.getActiveGlobalTab(), 'music', 'the tabs wait');
  assert.equal(dialogOpen(app), false);
  gate.resolve();
  assert.equal(await saving, true);
  assert.equal(app.getOccState().active.id, 'fx-release-a', 'after the save it is still the same edit');
});

// ---------------------------------------------------------------------------------------------------------------------
// the other things that hold the same confirmation surface (#46), seen from the new screens
// ---------------------------------------------------------------------------------------------------------------------
test('T47-GUARD an unsaved Live holds the same surface when the way out is a new screen (the Music tab, a News item opened from Live)', async () => {
  const { app } = await openOccasionalApp();
  app.setupTabs();
  app.setupLiveWorkspace();
  app.renderLive();
  assert.equal(app.editLive('fx-live-up', 'upcoming'), true);
  await flushAsync();
  await type(app, 'edit-title', '未保存のライブ');
  assert.equal(app.getLiveEditorState().dirty, true);
  await el(app, 'global-tab-music').dispatch('click');
  await flushAsync();
  assert.equal(dialogOpen(app), true);
  assert.match(dialogHtml(app), new RegExp(UNSAVED_TITLE));
  await answerLiveDialog(app, 'stay');
  assert.equal(app.getActiveGlobalTab(), 'live');
  const opening = app.editNews('fx-news-2');
  await flushAsync();
  assert.equal(dialogOpen(app), true, 'opening a News item asks, too');
  await answerLiveDialog(app, 'discard');
  assert.equal(await opening, true);
  assert.equal(app.getOccState().active.id, 'fx-news-2');
  assert.equal(app.getLiveEditorState().dirty, false);
});

test('T47-GUARD unsaved Ticket Page settings hold the same surface for the tabs; and an unsaved Site holds it for opening a Live', async () => {
  const { app } = await openOccasionalApp();
  app.setupTabs();
  app.setupLiveWorkspace();
  app.renderLive();
  app.renderTicketSettings();
  app.setTicketSettingsOpen(true);
  el(app, 'ticket-complete-text').value = '設定の未保存';
  await el(app, 'ticket-complete-text').oninput();
  assert.equal(app.isTicketSettingsDirty(), true);
  await el(app, 'global-tab-site').dispatch('click');
  await flushAsync();
  assert.equal(dialogOpen(app), true);
  await answerLiveDialog(app, 'stay');
  assert.equal(app.getActiveGlobalTab(), 'live');
  await el(app, 'global-tab-site').dispatch('click');
  await answerLiveDialog(app, 'discard');
  await flushAsync();
  assert.equal(app.getActiveGlobalTab(), 'site');
  await type(app, 'site-footer-text', 'フッターの未保存');
  const opening = app.editLive('fx-live-up', 'upcoming');
  await flushAsync();
  assert.equal(dialogOpen(app), true, 'a Site that is not saved is asked about before a Live opens');
  await answerLiveDialog(app, 'stay');
  assert.equal(await opening, false);
});

// ---------------------------------------------------------------------------------------------------------------------
// the browser's own question
// ---------------------------------------------------------------------------------------------------------------------
async function asks(app) {
  const event = { prevented: false, returnValue: undefined, preventDefault() { this.prevented = true; } };
  await app.dispatchWindow('beforeunload', event);
  return event.prevented;
}

for (const [surfaceName, surface] of Object.entries(SURFACES)) {
  test(`T47-GUARD beforeunload ${surfaceName}: asks while unsaved, saving, uploading and (Local Mode) waiting for the export; not when saved or put back`, async () => {
    // unsaved / put back
    const plainApp = await ready(surface);
    assert.equal(await asks(plainApp.app), false, 'nothing typed');
    await type(plainApp.app, surface.field, '未保存');
    assert.equal(await asks(plainApp.app), true, 'unsaved');
    await type(plainApp.app, surface.field, surface.saved());
    assert.equal(await asks(plainApp.app), false, 'put back');

    // saving
    const gate = deferred();
    const saving = await ready(surface, { putGate: gate });
    await type(saving.app, surface.field, '保存中');
    const key = { 'a News item': 'item', 'a work': 'item', 'a video': 'item', 'the Channel URL': 'channel', Site: 'site', Profile: 'profile' }[surfaceName];
    const pending = saving.app.saveOccPanel(key);
    await flushAsync();
    assert.equal(await asks(saving.app), true, 'saving');
    gate.resolve();
    assert.equal(await pending, true);
    assert.equal(await asks(saving.app), false, 'saved');

    // uploading
    const upload = await ready(surface);
    upload.app.setSyntheticImageUpload(true);
    assert.equal(await asks(upload.app), true, 'a picture is uploading');
    upload.app.setSyntheticImageUpload(false);
    assert.equal(await asks(upload.app), false);

    // Local Mode: a saved change waits for the JSON export
    const local = await ready(surface, { api: false });
    await type(local.app, surface.field, 'ローカル');
    assert.equal(await local.app.saveOccPanel(key), true);
    assert.equal(await asks(local.app), true, 'waiting for the JSON export');
    assert.equal(await local.app.invokeSaveData({ silent: true }), true, 'the export');
    assert.equal(await asks(local.app), false, 'exported');
  });
}

test('T47-GUARD beforeunload also asks for an unsaved Live, and unsaved Ticket Page settings (the #46 conditions are kept)', async () => {
  const live = await openOccasionalApp();
  live.app.setupTabs();
  live.app.setupLiveWorkspace();
  live.app.renderLive();
  live.app.editLive('fx-live-up', 'upcoming');
  await flushAsync();
  assert.equal(await asks(live.app), false);
  await type(live.app, 'edit-title', '未保存のライブ');
  assert.equal(await asks(live.app), true, 'unsaved Live');

  const settings = await openOccasionalApp();
  settings.app.setupLiveWorkspace();
  settings.app.renderTicketSettings();
  settings.app.setTicketSettingsOpen(true);
  el(settings.app, 'ticket-complete-text').value = '設定の未保存';
  await el(settings.app, 'ticket-complete-text').oninput();
  assert.equal(await asks(settings.app), true, 'unsaved Ticket Page settings');
});
