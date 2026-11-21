// Issue #46 stage 3: T46-SAVE, T46-GUARD, T46-DELETE, T46-SCOPE, T46-TICKET.
// The save of a Live, a delete and the Ticket Page settings are each a PUT of "the last loaded / saved content with only
// that operation's target layered on"; unsaved changes are confirmed on a surface; the editor is unsaved only while its
// values differ from the values it was opened with. All data is synthetic (test/fixtures/admin-live-states.json).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  answerLiveDialog,
  deferred,
  flushAsync,
  jsonResponse,
  loadAdminApp,
  setLiveForm,
} from './support/admin-app-harness.mjs';

const repoRoot = process.cwd();
const fixture = JSON.parse(readFileSync(join(repoRoot, 'test/fixtures/admin-live-states.json'), 'utf8'));
const adminHtml = readFileSync(join(repoRoot, 'admin/index.html'), 'utf8');

// admin/app.js runs in a vm context, so its objects have another realm's prototypes; compare plain copies.
const plain = (value) => JSON.parse(JSON.stringify(value));

function makeApp({ api = true, data = fixture.data, baseline = true } = {}) {
  const app = loadAdminApp();
  app.setApiMode(api);
  app.setSiteData(app.normalizeSiteData(structuredClone(data)));
  if (baseline) app.setSavedBaseline(plain(app.getSiteData()));
  app.setupLiveWorkspace();
  app.setupTabs();
  app.renderLive();
  app.renderTicketSettings();
  return app;
}

// Records every PUT body. `putResponse` decides the answer; reservation reads answer `rows`.
function useRecordingFetch(app, { rows = [], putResponse } = {}) {
  const puts = [];
  app.useAdminFetch(async (path, options = {}) => {
    if (path === '/api/admin/site-data' && options.method === 'PUT') {
      if (putResponse) {
        const answer = await putResponse(JSON.parse(options.body));
        if (answer) return answer;
      }
      puts.push(JSON.parse(options.body));
      return jsonResponse({ ok: true });
    }
    if (path.startsWith('/api/admin/ticket-reservations')) return jsonResponse({ reservations: rows });
    return jsonResponse({});
  });
  return puts;
}

const failing = (status = 500, error = 'API保存に失敗しました') => async () => jsonResponse({ error }, { ok: false, status });
const liveIds = (data) => ({ upcoming: data.live.upcoming.map((live) => live.id), past: data.live.past.map((live) => live.id) });
const dialogOpen = (app) => Boolean(app.elements.get('live-dialog-action-stay') || app.elements.get('live-dialog-action-cancel'));

async function typeInto(app, id, value) {
  app.elements.get(id).value = value;
  await app.elements.get(id).dispatch('input');
}

async function openForEdit(app, id, category) {
  assert.equal(app.editLive(id, category), true);
  await flushAsync();
}

// ---- T46-SAVE ------------------------------------------------------------------------------------------
test('T46-SAVE the editor is unsaved only while its values differ from the values it was opened with', async () => {
  const app = makeApp({ api: true });
  useRecordingFetch(app);
  await openForEdit(app, 'fx-live-long', 'upcoming');
  assert.equal(app.getLiveEditorState().dirty, false);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');

  const original = app.elements.get('edit-title').value;
  await typeInto(app, 'edit-title', `${original}!`);
  assert.equal(app.getLiveEditorState().dirty, true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '未保存');
  assert.equal(app.elements.get('saveBtn').disabled, true, 'the header save is held while a Live is unsaved');

  await typeInto(app, 'edit-title', original);
  assert.equal(app.getLiveEditorState().dirty, false, 'typing the original value back is no change');
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');
  assert.equal(app.elements.get('saveBtn').disabled, false);
});

test('T46-SAVE every field that is part of the editor counts: source text, flyer, checkboxes, the announcement comment', async () => {
  const app = makeApp({ api: true });
  useRecordingFetch(app);
  await openForEdit(app, 'fx-live-long', 'upcoming');
  const baseline = app.snapshotLiveEditor();
  assert.equal(app.recomputeLiveEditorDirty(), false);

  for (const [id, value] of [['edit-sourceText', '元情報'], ['edit-xComment', 'ひとこと'], ['edit-link', 'https://example.test/x'], ['edit-notes', '別の注記']]) {
    const before = app.elements.get(id).value;
    await typeInto(app, id, value);
    assert.equal(app.getLiveEditorState().dirty, true, id);
    await typeInto(app, id, before);
    assert.equal(app.getLiveEditorState().dirty, false, `${id} back`);
  }
  const flyer = app.elements.get('edit-image');
  const flyerBefore = flyer.value;
  flyer.value = 'assets/images/fixture-other.jpg';
  app.recomputeLiveEditorDirty();
  assert.equal(app.getLiveEditorState().dirty, true, 'a changed flyer');
  flyer.value = flyerBefore;
  app.recomputeLiveEditorDirty();
  assert.equal(app.getLiveEditorState().dirty, false);

  const closed = app.elements.get('edit-reservationClosed');
  closed.checked = !closed.checked;
  await closed.dispatch('change');
  assert.equal(app.getLiveEditorState().dirty, true, 'a checkbox');
  closed.checked = !closed.checked;
  await closed.dispatch('change');
  assert.equal(app.getLiveEditorState().dirty, false);
  assert.equal(app.snapshotLiveEditor(), baseline);
});

test('T46-SAVE a new Live is not unsaved until something is typed, and typing it away again makes it not unsaved', async () => {
  const app = makeApp({ api: true });
  assert.equal(app.addLive(), true);
  assert.equal(app.getLiveEditorState().dirty, false);
  assert.notEqual(app.elements.get('live-editor-save-status').textContent, '未保存');
  // Issue #46 (R46-07): the source screen has no state text; the state shows once the fields are open.
  await app.elements.get('live-manual-entry-btn').dispatch('click');
  assert.equal(app.getLiveEditorState().dirty, false);
  await typeInto(app, 'edit-title', '新しい公演');
  assert.equal(app.getLiveEditorState().dirty, true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '未保存');
  await typeInto(app, 'edit-title', '');
  assert.equal(app.getLiveEditorState().dirty, false);
  // Leaving a new Live that was never touched asks nothing.
  assert.equal(app.closeLiveEditor(), true);
  assert.equal(dialogOpen(app), false);
});

test('T46-SAVE while saving, the status says so and inputs, moves, delete and reservations are locked; a second click sends one PUT', async () => {
  const app = makeApp({ api: true });
  const puts = useRecordingFetch(app, { putResponse: () => pending.promise });
  const pending = deferred();
  await openForEdit(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-title', '保存中の確認');

  const first = app.saveLiveWorkspace();
  await flushAsync();
  const second = app.saveLiveWorkspace();
  assert.equal(await second, false, 'the second click is refused');
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存しています…');
  for (const id of ['edit-title', 'live-editor-delete-btn', 'live-editor-back', 'live-add-btn', 'manual-reservation-submit']) {
    assert.equal(app.elements.get(id).disabled, true, `${id} is locked`);
  }
  assert.equal(app.fetchCalls.filter((call) => call.options.method === 'PUT').length, 1, 'one PUT');

  pending.resolve(jsonResponse({ ok: true }));
  assert.equal(await first, true);
  assert.equal(puts.length, 0, 'the held PUT was answered by the deferred response');
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');
  assert.equal(app.elements.get('edit-title').disabled, false);
});

test('T46-SAVE a failed save puts the data back, keeps the input and the editor, and shows the reason above the actions', async () => {
  const app = makeApp({ api: true });
  const before = plain(app.getSiteData());
  const baselineBefore = plain(app.getSavedBaseline());
  useRecordingFetch(app, { putResponse: failing(500, 'API保存に失敗しました') });
  await openForEdit(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-title', '失敗する保存');

  assert.equal(await app.saveLiveWorkspace(), false);

  assert.deepEqual(plain(app.getSiteData()), before);
  assert.deepEqual(plain(app.getSavedBaseline()), baselineBefore, 'the baseline does not move on a failure');
  assert.equal(app.elements.get('edit-title').value, '失敗する保存');
  assert.equal(app.getModalState().currentEditId, 'fx-live-long');
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存できませんでした');
  assert.equal(app.elements.get('live-editor-save-error').textContent, 'API保存に失敗しました');
  assert.equal(app.getLiveEditorState().dirty, true);
  assert.equal(app.getHasChanges(), false, 'a failed Live save does not leave a header save waiting');

  // The next edit clears the reason line; a retry that works clears the failure.
  await typeInto(app, 'edit-title', '失敗する保存 2');
  assert.equal(app.elements.get('live-editor-save-error').textContent, '');
  useRecordingFetch(app);
  assert.equal(await app.saveLiveWorkspace(), true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');
});

test('T46-SAVE a rejected password (401 / 403) is reported as 認証できませんでした。', async () => {
  for (const status of [401, 403]) {
    const app = makeApp({ api: true });
    useRecordingFetch(app, { putResponse: failing(status, 'unauthorized') });
    await openForEdit(app, 'fx-live-long', 'upcoming');
    await typeInto(app, 'edit-title', '認証の確認');
    assert.equal(await app.saveLiveWorkspace(), false, String(status));
    assert.equal(app.elements.get('live-editor-save-error').textContent, '認証できませんでした。', String(status));
  }
});

test('T46-SAVE a missing date or venue stops the save and a date that disagrees with the category only warns', async () => {
  const app = makeApp({ api: true });
  const puts = useRecordingFetch(app);
  await openForEdit(app, 'fx-live-long', 'upcoming');
  setLiveForm(app.elements, { 'edit-date': '', 'edit-venue': 'テスト会場B' });
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.equal(app.elements.get('edit-date-error').textContent, '日付を入力してください。');
  setLiveForm(app.elements, { 'edit-date': '2099-12-12', 'edit-venue': '' });
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.equal(app.elements.get('edit-venue-error').textContent, '会場を入力してください。');
  assert.equal(puts.length, 0);

  setLiveForm(app.elements, { 'edit-date': '2000-01-01', 'edit-venue': 'テスト会場B' });
  assert.equal(await app.saveLiveWorkspace(), true, 'a past date in 開催予定 still saves');
  assert.equal(puts.length, 1);
  assert.equal(puts[0].live.upcoming[0].date, '2000-01-01');
});

test('T46-SAVE after a save the editor stays on the same Live and keeps the task that was open', async () => {
  const app = makeApp({ api: true });
  useRecordingFetch(app);
  await openForEdit(app, 'fx-live-long', 'upcoming');
  app.setLiveEditorTask('announcement');
  await typeInto(app, 'edit-xComment', '告知のひとこと');
  assert.equal(await app.saveLiveWorkspace(), true);
  assert.equal(app.getModalState().currentEditId, 'fx-live-long');
  assert.equal(app.elements.get('live-editor-task-announcement').getAttribute('aria-selected'), 'true');
  assert.equal(app.elements.get('live-editor-panel-public').hidden, true);
  assert.equal(app.elements.get('edit-xComment').value, '告知のひとこと');
  assert.equal(app.getLiveEditorState().dirty, false);
});

test('T46-SAVE in Local Mode a save reflects into memory, marks the data changed and never calls the API', async () => {
  const app = makeApp({ api: false });
  await openForEdit(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-title', 'ローカルの保存');
  assert.equal(await app.saveLiveWorkspace(), true);
  assert.equal(app.fetchCalls.length, 0);
  assert.equal(app.getSiteData().live.upcoming[0].title, 'ローカルの保存');
  assert.equal(app.elements.get('live-editor-save-status').textContent, 'JSON書き出し待ち');
  assert.equal(app.getHasChanges(), true);
  assert.equal(app.elements.get('saveBtn').textContent, 'JSONを書き出す *');
});

// ---- T46-GUARD -----------------------------------------------------------------------------------------
async function dirtyEditor(options = {}) {
  const app = makeApp(options);
  useRecordingFetch(app);
  await openForEdit(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-title', '未保存のタイトル');
  return app;
}

const ESCAPE = { key: 'Escape', preventDefault() {} };

test('T46-GUARD the confirmation says 保存していない変更があります。 with 破棄して移動 and 編集を続ける, and focus starts on 編集を続ける', async () => {
  const app = await dirtyEditor();
  const pending = app.editLive('fx-live-today', 'upcoming');
  await flushAsync();
  assert.equal(app.elements.get('live-dialog-overlay').hidden, false);
  assert.match(app.elements.get('live-dialog').innerHTML, /保存していない変更があります。/);
  assert.equal(app.elements.get('live-dialog-action-discard').dataset.liveDialogAction, 'discard');
  assert.match(app.elements.get('live-dialog').innerHTML, />破棄して移動</);
  assert.match(app.elements.get('live-dialog').innerHTML, />編集を続ける</);
  assert.equal(app.document.activeElement, app.elements.get('live-dialog-action-stay'));
  assert.match(adminHtml, /id="live-dialog" role="alertdialog" aria-modal="true"/);
  await answerLiveDialog(app, 'stay');
  assert.equal(await pending, false);
  assert.equal(app.elements.get('live-dialog-overlay').hidden, true);
});

test('T46-GUARD 編集を続ける, Escape and the backdrop change nothing; 破棄して移動 moves', async () => {
  const app = await dirtyEditor();
  const unchanged = () => {
    assert.equal(app.getModalState().currentEditId, 'fx-live-long');
    assert.equal(app.elements.get('edit-title').value, '未保存のタイトル');
    assert.equal(app.getLiveEditorState().dirty, true);
  };

  let pending = app.editLive('fx-live-today', 'upcoming');
  await answerLiveDialog(app, 'stay');
  assert.equal(await pending, false);
  unchanged();

  pending = app.editLive('fx-live-today', 'upcoming');
  await flushAsync();
  await app.dispatchDocument('keydown', ESCAPE);
  assert.equal(await pending, false, 'Escape chooses the safe action');
  unchanged();

  pending = app.editLive('fx-live-today', 'upcoming');
  await flushAsync();
  const overlay = app.elements.get('live-dialog-overlay');
  await overlay.dispatch('click', { target: overlay });
  assert.equal(await pending, false, 'the backdrop chooses the safe action');
  unchanged();

  pending = app.editLive('fx-live-today', 'upcoming');
  await flushAsync();
  await overlay.dispatch('click', { target: app.elements.get('live-dialog') });
  assert.equal(app.elements.get('live-dialog-overlay').hidden, false, 'a click inside the surface does not close it');
  await answerLiveDialog(app, 'discard');
  assert.equal(await pending, true);
  assert.equal(app.getModalState().currentEditId, 'fx-live-today');
  assert.equal(app.getLiveEditorState().dirty, false);
});

test('T46-GUARD every way out of an unsaved Live asks first, and 破棄して移動 then goes', async () => {
  const exits = [
    ['another Live', (app) => app.editLive('fx-live-today', 'upcoming'), (app) => app.getModalState().currentEditId === 'fx-live-today'],
    ['back to the list', (app) => app.closeLiveEditor(), (app) => app.getModalState().currentEditId === null],
    ['公演終了', (app) => app.setLiveListView('past'), (app) => app.elements.get('live-list-past-panel').hidden === false],
    ['予約管理', (app) => app.setLiveWorkspaceView('reservations'), (app) => app.elements.get('live-workspace-reservations-panel').hidden === false],
    ['a global tab', (app) => app.elements.get('global-tab-news').dispatch('click'), (app) => app.elements.get('global-tab-news').classList.contains('active')],
    ['+ 新しいライブ', (app) => app.addLive(), (app) => app.getModalState().isNewItem === true],
    ['Ticket Page共通設定', (app) => app.setTicketSettingsOpen(true), (app) => app.elements.get('live-ticket-settings-panel').hidden === false],
  ];
  for (const [name, exit, moved] of exits) {
    const app = await dirtyEditor();
    let pending = exit(app);
    await flushAsync();
    assert.ok(app.elements.get('live-dialog-action-stay'), `${name} asks`);
    await answerLiveDialog(app, 'stay');
    await pending;
    assert.equal(moved(app), false, `${name} stays when 編集を続ける`);
    assert.equal(app.getModalState().currentEditId, 'fx-live-long', `${name} keeps the Live`);

    pending = exit(app);
    await answerLiveDialog(app, 'discard');
    await pending;
    assert.equal(moved(app), true, `${name} goes when 破棄して移動`);
  }
});

test('T46-GUARD with nothing unsaved the move is immediate and synchronous, and the Live task tabs never ask', async () => {
  const app = makeApp({ api: true });
  useRecordingFetch(app);
  await openForEdit(app, 'fx-live-long', 'upcoming');
  assert.equal(app.editLive('fx-live-today', 'upcoming'), true);
  assert.equal(dialogOpen(app), false);
  assert.equal(app.setLiveListView('past'), true);
  assert.equal(app.closeLiveEditor(), true);

  await openForEdit(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-title', '入力したまま');
  app.setLiveEditorTask('announcement');
  app.setLiveEditorTask('reservation');
  app.setLiveEditorTask('public');
  assert.equal(dialogOpen(app), false, '公開内容 / 告知 / 予約 keep the input without asking');
  assert.equal(app.elements.get('edit-title').value, '入力したまま');
});

test('T46-GUARD Tab stays inside the confirmation surface, and focus goes back to where it was when the surface closes', async () => {
  const app = await dirtyEditor();
  const title = app.elements.get('edit-title');
  title.focus();
  const pending = app.editLive('fx-live-today', 'upcoming');
  await flushAsync();
  const stay = app.elements.get('live-dialog-action-stay');
  const discard = app.elements.get('live-dialog-action-discard');
  assert.equal(app.document.activeElement, stay);
  await app.dispatchDocument('keydown', { key: 'Tab', preventDefault() {} });
  assert.equal(app.document.activeElement, discard, 'Tab moves to the next button');
  await app.dispatchDocument('keydown', { key: 'Tab', preventDefault() {} });
  assert.equal(app.document.activeElement, stay, 'and wraps around');
  await app.dispatchDocument('keydown', { key: 'Tab', shiftKey: true, preventDefault() {} });
  assert.equal(app.document.activeElement, discard, 'Shift+Tab goes back and wraps');
  await answerLiveDialog(app, 'stay');
  assert.equal(await pending, false);
  assert.equal(app.document.activeElement, title, 'focus is back on the field that had it');
});

test('T46-GUARD asking again while the surface is open does not stack a second one', async () => {
  const app = await dirtyEditor();
  const first = app.editLive('fx-live-today', 'upcoming');
  await flushAsync();
  assert.equal(app.editLive('fx-live-past-1', 'past'), false, 'the second request is ignored');
  await answerLiveDialog(app, 'discard');
  assert.equal(await first, true);
  assert.equal(app.getModalState().currentEditId, 'fx-live-today');
});

test('T46-GUARD unsaved Ticket Page settings ask the same way, and a discard puts the saved values back', async () => {
  const app = makeApp({ api: true });
  assert.equal(app.setTicketSettingsOpen(true), true);
  app.elements.get('ticket-complete-text').value = '変えた完了文';
  await app.elements.get('ticket-complete-text').oninput();
  assert.equal(app.isTicketSettingsDirty(), true);

  let pending = app.setTicketSettingsOpen(false);
  await answerLiveDialog(app, 'stay');
  assert.equal(await pending, false);
  assert.equal(app.elements.get('live-ticket-settings-panel').hidden, false);
  assert.equal(app.elements.get('ticket-complete-text').value, '変えた完了文');

  pending = app.setLiveWorkspaceView('reservations');
  await answerLiveDialog(app, 'discard');
  assert.equal(await pending, true);
  assert.equal(app.isTicketSettingsDirty(), false);
  assert.equal(app.elements.get('ticket-complete-text').value, fixture.data.ticket.completeText, 'the saved text is back');
  assert.equal(app.getSiteData().ticket.completeText, fixture.data.ticket.completeText);
});

test('T46-GUARD beforeunload stops a reload while a Live or the settings are unsaved or saving, and not otherwise', async () => {
  const stops = async (app) => {
    const event = { prevented: 0, returnValue: undefined, preventDefault() { this.prevented += 1; } };
    await app.dispatchWindow('beforeunload', event);
    return event.prevented === 1 && event.returnValue === '';
  };
  const clean = makeApp({ api: true });
  assert.equal(await stops(clean), false);

  const live = await dirtyEditor();
  assert.equal(await stops(live), true, 'an unsaved Live');
  const closing = live.closeLiveEditor();
  await answerLiveDialog(live, 'discard');
  await closing;
  assert.equal(await stops(live), false, 'discarded');

  const settings = makeApp({ api: true });
  settings.setTicketSettingsOpen(true);
  settings.elements.get('ticket-field-submit-label').value = '送る';
  await settings.elements.get('ticket-field-submit-label').oninput();
  assert.equal(await stops(settings), true, 'unsaved settings');
  settings.elements.get('ticket-field-submit-label').value = settings.getSiteData().ticket.fields.submitLabel;
  await settings.elements.get('ticket-field-submit-label').oninput();
  assert.equal(await stops(settings), false, 'typed back to what is saved');

  const saving = makeApp({ api: true });
  const pending = deferred();
  useRecordingFetch(saving, { putResponse: () => pending.promise });
  saving.setTicketSettingsOpen(true);
  saving.elements.get('ticket-complete-text').value = '保存中の完了文';
  await saving.elements.get('ticket-complete-text').oninput();
  const save = saving.saveTicketSettings();
  await flushAsync();
  assert.equal(await stops(saving), true, 'settings being saved');
  pending.resolve(jsonResponse({ ok: true }));
  await save;
  assert.equal(await stops(saving), false);
});

// ---- T46-DELETE ----------------------------------------------------------------------------------------
async function openDelete(app, id = 'fx-live-long', category = 'upcoming') {
  await openForEdit(app, id, category);
  const pending = app.deleteLiveFromWorkspace();
  await flushAsync();
  return { pending }; // wrapped: returning the promise itself from an async function would wait for the delete
}

test('T46-DELETE the confirmation text depends on the reservations: none, N, or not known', async () => {
  // none: the ledger is loaded and empty
  const none = makeApp({ api: true });
  useRecordingFetch(none, { rows: [] });
  let { pending } = await openDelete(none);
  assert.match(none.elements.get('live-dialog').innerHTML, /このライブを削除しますか。/);
  assert.match(none.elements.get('live-dialog').innerHTML, /削除すると公開画面からも消えます。/);
  assert.doesNotMatch(none.elements.get('live-dialog').innerHTML, /予約が/);
  assert.match(none.elements.get('live-dialog').innerHTML, />やめる</);
  assert.match(none.elements.get('live-dialog').innerHTML, />削除する</);
  assert.equal(none.document.activeElement, none.elements.get('live-dialog-action-cancel'), 'focus starts on the safe button');
  await answerLiveDialog(none, 'cancel');
  await pending;

  // N: the active reservations of the loaded ledger (cancelled rows are not counted)
  const many = makeApp({ api: true });
  useRecordingFetch(many, { rows: fixture.reservations['fx-live-long'] });
  ({ pending } = await openDelete(many));
  assert.match(many.elements.get('live-dialog').innerHTML, /予約が2件あります。削除すると公開画面からも消えます。/);
  const readsAtDelete = many.fetchCalls.filter((call) => call.path.startsWith('/api/admin/ticket-reservations?') && call.path.includes('liveId=fx-live-long'));
  assert.equal(readsAtDelete.length, 1, 'the loaded ledger is used, so no second read');
  await answerLiveDialog(many, 'cancel');
  await pending;

  // not known: the ledger is not loaded and the read fails
  const unknown = makeApp({ api: true });
  unknown.useAdminFetch(async (path) => {
    if (path.startsWith('/api/admin/ticket-reservations')) return jsonResponse({ error: 'down' }, { ok: false, status: 500 });
    return jsonResponse({});
  });
  ({ pending } = await openDelete(unknown));
  assert.match(unknown.elements.get('live-dialog').innerHTML, /予約の件数を確認できませんでした。削除すると公開画面からも消えます。/);
  await answerLiveDialog(unknown, 'cancel');
  await pending;
});

test('T46-DELETE when the ledger is not loaded, the count is read once for this Live', async () => {
  const app = makeApp({ api: true });
  app.useAdminFetch(async (path) => {
    if (path.startsWith('/api/admin/ticket-reservations')) return jsonResponse({ reservations: fixture.reservations['fx-live-long'] });
    return jsonResponse({});
  });
  await openForEdit(app, 'fx-live-today', 'upcoming');
  // no ledger of this Live has been loaded yet (it loads on the 予約 task), so the count is read on demand
  const pending = app.deleteLiveFromWorkspace();
  await flushAsync();
  const reads = app.fetchCalls.filter((call) => call.path.includes('liveId=fx-live-today'));
  assert.ok(reads.length >= 1);
  assert.match(app.elements.get('live-dialog').innerHTML, /予約が2件あります/);
  await answerLiveDialog(app, 'cancel');
  await pending;
});

test('T46-DELETE やめる and Escape change nothing and send nothing', async () => {
  const app = makeApp({ api: true });
  const puts = useRecordingFetch(app);
  const before = plain(app.getSiteData());
  let { pending } = await openDelete(app);
  await answerLiveDialog(app, 'cancel');
  assert.equal(await pending, false);
  ({ pending } = await openDelete(app));
  await app.dispatchDocument('keydown', ESCAPE);
  assert.equal(await pending, false);
  assert.deepEqual(plain(app.getSiteData()), before);
  assert.equal(puts.length, 0);
  assert.equal(app.getModalState().currentEditId, 'fx-live-long');
});

test('T46-DELETE 削除する PUTs the saved content minus that Live only, then returns to the list', async () => {
  const app = makeApp({ api: true });
  const puts = useRecordingFetch(app);
  const baseline = plain(app.getSavedBaseline());
  // unsaved changes elsewhere must not travel with the delete
  app.getSiteData().news.push({ id: 'unsaved-news', date: '2026.11.20', title: '未保存のお知らせ', body: '', link: '' });
  app.getSiteData().site.footerText = '未保存のフッター';
  app.markChanged();
  const { pending } = await openDelete(app, 'fx-live-past-1', 'past');
  await answerLiveDialog(app, 'delete');
  assert.equal(await pending, true);

  assert.equal(puts.length, 1);
  const expected = structuredClone(baseline);
  expected.live.past = expected.live.past.filter((live) => live.id !== 'fx-live-past-1');
  assert.deepEqual(puts[0], expected);
  assert.equal(JSON.stringify(puts[0]).includes('未保存'), false, 'no unsaved change of another tab is sent');
  assert.equal(app.getHasChanges(), true, 'the header save is still waiting for the other tab');
  assert.match(app.elements.get('live-editor-body').innerHTML, /Liveを選択/);
  assert.equal(app.getModalState().currentEditId, null);
  assert.equal(liveIds(plain(app.getSiteData())).past.includes('fx-live-past-1'), false);
  assert.equal(app.elements.get('live-past-list').children.some((card) => card.dataset.liveId === 'fx-live-past-1'), false);
  assert.equal(app.elements.get('live-editor-pane').getAttribute('aria-busy'), 'false');
  assert.deepEqual(plain(app.getSavedBaseline()), expected, 'the baseline is now the saved content');
});

test('T46-DELETE a failed delete puts the Live back, keeps the editor and the input, and shows the reason', async () => {
  const app = makeApp({ api: true });
  const before = plain(app.getSiteData());
  useRecordingFetch(app, { putResponse: failing(500, 'API保存に失敗しました') });
  await openForEdit(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-title', '消そうとして編集していた');
  const pending = app.deleteLiveFromWorkspace();
  await answerLiveDialog(app, 'delete');
  assert.equal(await pending, false);

  assert.deepEqual(plain(app.getSiteData()), before, 'the Live is back in the data');
  assert.equal(app.elements.get('live-upcoming-list').children.some((card) => card.dataset.liveId === 'fx-live-long'), true, 'and in the list');
  assert.equal(app.getModalState().currentEditId, 'fx-live-long');
  assert.equal(app.elements.get('edit-title').value, '消そうとして編集していた');
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存できませんでした');
  assert.equal(app.elements.get('live-editor-save-error').textContent, 'API保存に失敗しました');
  assert.equal(app.getLiveEditorState().dirty, true, 'what was unsaved before the delete is still unsaved');
  assert.equal(app.elements.get('live-editor-delete-btn').disabled, false, 'the editor is usable again');
  assert.deepEqual(plain(app.getSavedBaseline()), before);
});

test('T46-DELETE a failed delete does not make a clean editor unsaved', async () => {
  const app = makeApp({ api: true });
  useRecordingFetch(app, { putResponse: failing() });
  const { pending } = await openDelete(app);
  await answerLiveDialog(app, 'delete');
  assert.equal(await pending, false);
  assert.equal(app.getLiveEditorState().dirty, false);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存できませんでした');
});

test('T46-DELETE a new Live has nothing to delete', async () => {
  const app = makeApp({ api: true });
  useRecordingFetch(app);
  assert.equal(app.addLive(), true);
  assert.equal(app.elements.get('live-editor-delete-btn'), undefined, 'a new Live has no delete at all (R46-03)');
  assert.equal(await app.deleteLiveFromWorkspace(), false);
  assert.equal(dialogOpen(app), false);
});

test('T46-DELETE in Local Mode it asks, removes the Live in memory and waits for the JSON export', async () => {
  const app = makeApp({ api: false });
  const { pending } = await openDelete(app);
  assert.match(app.elements.get('live-dialog').innerHTML, /削除すると公開画面からも消えます。/);
  await answerLiveDialog(app, 'delete');
  assert.equal(await pending, true);
  assert.equal(app.fetchCalls.length, 0);
  assert.equal(liveIds(plain(app.getSiteData())).upcoming.includes('fx-live-long'), false);
  assert.equal(app.getHasChanges(), true);
  assert.match(app.elements.get('live-editor-body').innerHTML, /Liveを選択/);
});

test('T46-DELETE is refused while a save is in flight and in the read-only fallback', async () => {
  const app = makeApp({ api: true });
  const hold = deferred();
  useRecordingFetch(app, { putResponse: () => hold.promise });
  await openForEdit(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-title', '保存中');
  const saving = app.saveLiveWorkspace();
  await flushAsync();
  assert.equal(await app.deleteLiveFromWorkspace(), false);
  assert.equal(dialogOpen(app), false);
  hold.resolve(jsonResponse({ ok: true }));
  await saving;

  const readOnly = makeApp({ api: true });
  await openForEdit(readOnly, 'fx-live-long', 'upcoming');
  readOnly.setApiFallbackReadOnly(true);
  assert.equal(await readOnly.deleteLiveFromWorkspace(), false);
  assert.equal(dialogOpen(readOnly), false);
});

// ---- T46-SCOPE -----------------------------------------------------------------------------------------
// Issue #47 (D47-05): the other tabs hold what is typed in their own inputs and not in siteData, so "unsaved elsewhere" is typed text.
async function addUnsavedElsewhere(app) {
  app.renderSiteSettings();
  app.renderProfile();
  for (const [id, value] of [['site-footer-text', '未保存のフッター'], ['profile-text', '未保存のプロフィール']]) {
    app.elements.get(id).value = value;
    await app.elements.get(id).dispatch('input');
  }
}

function assertUnsavedElsewhereIsKept(app) {
  assert.equal(app.getOccState().panels.site.dirty, true, 'Site is still unsaved');
  assert.equal(app.getOccState().panels.profile.dirty, true, 'Profile is still unsaved');
  assert.equal(app.elements.get('site-footer-text').value, '未保存のフッター');
  assert.equal(app.elements.get('profile-text').value, '未保存のプロフィール');
  assert.notEqual(app.getSiteData().site.footerText, '未保存のフッター', 'siteData never takes what is typed and not saved');
  app.renderModeBadge();
  assert.equal(app.elements.get('saveBtn').hidden, true, 'no header save while the API is connected');
}

test('T46-SCOPE a Live save does not send unsaved changes of other tabs and leaves them where they were typed (#47: there is no header save to wait for them)', async () => {
  const app = makeApp({ api: true });
  const puts = useRecordingFetch(app);
  const baseline = plain(app.getSavedBaseline());
  await openForEdit(app, 'fx-live-long', 'upcoming');
  // typed after the Live is open: with Site / Profile unsaved, opening a Live would first ask (T47-GUARD)
  await addUnsavedElsewhere(app);
  await typeInto(app, 'edit-title', 'スコープの確認');

  assert.equal(await app.saveLiveWorkspace(), true);

  assert.equal(puts.length, 1);
  for (const key of ['site', 'discography', 'youtube', 'profile', 'ticket', 'contact', 'news']) assert.deepEqual(puts[0][key], baseline[key], key);
  assert.equal(JSON.stringify(puts[0]).includes('未保存'), false);
  assert.equal(puts[0].live.upcoming[0].title, 'スコープの確認');
  assertUnsavedElsewhereIsKept(app);

  // #47 (D47-08): the header save is gone while the API is connected; it sends nothing. The next page that saves is built on what was saved
  // (the Live that was just saved is in it), and it carries only its own typed text.
  assert.equal(await app.invokeSaveData({ silent: true }), false);
  assert.equal(puts.length, 1, 'the header save sent nothing');
  assert.equal(await app.saveOccPanel('site'), true);
  const last = puts[puts.length - 1];
  assert.equal(puts.length, 2);
  assert.equal(last.news.some((item) => item.id === 'unsaved-news'), false);
  assert.equal(last.site.footerText, '未保存のフッター');
  assert.equal(last.profile.text, baseline.profile.text, 'Site does not carry the Profile text');
  assert.equal(last.live.upcoming[0].title, 'スコープの確認');
});

test('T46-SCOPE Live, delete and Ticket settings do not carry each other, and an unsaved Live input never reaches a settings save', async () => {
  const app = makeApp({ api: true });
  const puts = useRecordingFetch(app);
  const baseline = plain(app.getSavedBaseline());

  // settings save while a Live editor holds an unsaved input
  await openForEdit(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-title', '未保存のライブ入力');
  const settingsPending = app.setTicketSettingsOpen(true);
  await answerLiveDialog(app, 'discard');
  await settingsPending;
  assert.equal(app.getLiveEditorState().dirty, false);
  app.elements.get('ticket-complete-text').value = '設定だけ変えた完了文';
  await app.elements.get('ticket-complete-text').oninput();
  assert.equal(await app.saveTicketSettings(), true);
  assert.equal(puts.length, 1);
  assert.deepEqual(puts[0].live, baseline.live, 'the Live data is the baseline');
  assert.equal(puts[0].ticket.completeText, '設定だけ変えた完了文');
  assert.equal(JSON.stringify(puts[0]).includes('未保存のライブ入力'), false);

  // Live save while the settings hold an unsaved draft is impossible to start without a confirmation; check the body anyway
  const live = makeApp({ api: true });
  const livePuts = useRecordingFetch(live);
  live.setTicketSettingsOpen(true);
  live.elements.get('ticket-complete-text').value = '保存されない設定';
  await live.elements.get('ticket-complete-text').oninput();
  const move = live.editLive('fx-live-long', 'upcoming');
  await answerLiveDialog(live, 'discard');
  await move;
  await typeInto(live, 'edit-title', 'ライブだけ');
  assert.equal(await live.saveLiveWorkspace(), true);
  assert.equal(livePuts[0].ticket.completeText, fixture.data.ticket.completeText, 'the settings draft is not sent with a Live');
  assert.deepEqual(livePuts[0].ticket, baseline.ticket);
});

test('T46-SCOPE live.ticketLink, the #41 site and release items, the other Lives and the works all travel unchanged', async () => {
  const app = makeApp({ api: true });
  const puts = useRecordingFetch(app);
  const baseline = plain(app.getSavedBaseline());
  await openForEdit(app, 'fx-live-today', 'upcoming');
  await typeInto(app, 'edit-title', '他を落とさない');
  assert.equal(await app.saveLiveWorkspace(), true);
  const body = puts[0];
  assert.equal(body.live.ticketLink, baseline.live.ticketLink);
  assert.equal(body.site.heroImage, baseline.site.heroImage);
  assert.equal(body.site.featuredReleaseId, baseline.site.featuredReleaseId);
  assert.deepEqual(body.discography, baseline.discography);
  assert.deepEqual(body.youtube, baseline.youtube);
  assert.deepEqual(body.live.past, baseline.live.past);
  assert.deepEqual(body.live.upcoming.slice(1), baseline.live.upcoming.filter((live) => live.id !== 'fx-live-today'));
});

test('T46-SCOPE a success moves the baseline, so the next save carries the last one; a failure leaves it alone', async () => {
  const app = makeApp({ api: true });
  let failNext = false;
  const puts = useRecordingFetch(app, { putResponse: async () => (failNext ? failing()() : null) });
  await openForEdit(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-title', '一件目');
  assert.equal(await app.saveLiveWorkspace(), true);
  assert.equal(app.getSavedBaseline().live.upcoming[0].title, '一件目');

  assert.equal(await app.closeLiveEditor(), true);
  await openForEdit(app, 'fx-live-today', 'upcoming');
  await typeInto(app, 'edit-title', '二件目');
  assert.equal(await app.saveLiveWorkspace(), true);
  const titles = puts[1].live.upcoming.map((live) => live.title);
  assert.ok(titles.includes('一件目') && titles.includes('二件目'), 'the second PUT still has the first save');

  const baselineBefore = plain(app.getSavedBaseline());
  failNext = true;
  await typeInto(app, 'edit-title', '三件目');
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.deepEqual(plain(app.getSavedBaseline()), baselineBefore);
});

test('T46-SCOPE a duplicate Live id is refused with no PUT, in Live saves and in deletes', async () => {
  const data = structuredClone(fixture.data);
  data.live.past.push({ ...data.live.past[0] });
  const app = makeApp({ api: true, data });
  const puts = useRecordingFetch(app);
  await openForEdit(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-title', '重複の確認');
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.equal(puts.length, 0);
  assert.match(app.elements.get('live-editor-save-error').textContent, /Live IDが重複しています: fx-live-past-1/);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存できませんでした');
});

test('T46-SCOPE the layering functions: a Live goes to the head of its category, a delete removes both, settings replace ticket', () => {
  const app = makeApp({ api: true });
  const data = plain(app.getSiteData());
  const moved = { ...data.live.upcoming[1], id: 'fx-live-past-1', title: '区分を移した' };
  app.applyLiveSlice(data, moved, 'upcoming');
  assert.equal(data.live.upcoming[0].id, 'fx-live-past-1');
  assert.equal(data.live.past.some((live) => live.id === 'fx-live-past-1'), false);
  assert.equal(data.live.upcoming.filter((live) => live.id === 'fx-live-past-1').length, 1);

  app.applyDeleteSlice(data, 'fx-live-long');
  assert.equal(JSON.stringify(data.live).includes('fx-live-long'), false);

  app.applyTicketSlice(data, { completeText: 'x', fields: { showQuantity: false } });
  assert.deepEqual(data.ticket, { completeText: 'x', fields: { showQuantity: false } });
});

// ---- T46-TICKET ----------------------------------------------------------------------------------------
const TICKET_INPUT_IDS = [
  'ticket-complete-text',
  'ticket-field-quantity',
  'ticket-field-message',
  'ticket-field-label-quantity',
  'ticket-field-label-message',
  'ticket-field-placeholder-message',
  'ticket-field-submit-label',
];

test('T46-TICKET the settings screen has the seven inputs, a status, a reason line and a 保存して公開 button, and no old copy fields', () => {
  for (const id of [...TICKET_INPUT_IDS, 'ticket-settings-status', 'ticket-settings-error', 'ticket-settings-actions', 'ticket-settings-save-btn']) {
    assert.match(adminHtml, new RegExp(`id="${id}"`), id);
  }
  assert.match(adminHtml, /id="ticket-settings-save-btn"[^>]*>保存して公開</);
  assert.doesNotMatch(adminHtml, /id="ticket-(?:intro|notice)-text"/);
  const actions = adminHtml.match(/<div id="ticket-settings-actions"[^>]*>/)[0];
  assert.match(actions, /\shidden(?:\s|>|=)/, 'the actions start hidden: they show only while something is unsaved');
});

test('T46-TICKET typing edits a draft, not the data; the actions show only while the inputs differ from what is saved', async () => {
  const app = makeApp({ api: true });
  app.setTicketSettingsOpen(true);
  assert.equal(app.elements.get('ticket-settings-actions').hidden, true);
  assert.equal(app.elements.get('ticket-settings-status').textContent, '保存済み');

  app.elements.get('ticket-complete-text').value = '変えた完了文';
  await app.elements.get('ticket-complete-text').oninput();
  const quantity = app.elements.get('ticket-field-quantity');
  quantity.checked = false;
  await quantity.oninput();
  assert.equal(app.getSiteData().ticket.completeText, fixture.data.ticket.completeText, 'siteData is not touched');
  assert.equal(app.getSiteData().ticket.fields.showQuantity, true);
  assert.equal(app.getHasChanges(), false, 'no header save is left waiting by typing');
  assert.equal(app.elements.get('ticket-settings-status').textContent, '未保存');
  assert.equal(app.elements.get('ticket-settings-actions').hidden, false);

  quantity.checked = true;
  await quantity.oninput();
  app.elements.get('ticket-complete-text').value = fixture.data.ticket.completeText;
  await app.elements.get('ticket-complete-text').oninput();
  assert.equal(app.isTicketSettingsDirty(), false, 'typing everything back is no change');
  assert.equal(app.elements.get('ticket-settings-status').textContent, '保存済み');
  assert.equal(app.elements.get('ticket-settings-actions').hidden, true);
});

test('T46-TICKET saving PUTs the saved content with only ticket replaced, then the draft is the saved value', async () => {
  const app = makeApp({ api: true });
  const puts = useRecordingFetch(app);
  const baseline = plain(app.getSavedBaseline());
  app.setTicketSettingsOpen(true);
  await addUnsavedElsewhere(app);
  app.elements.get('ticket-complete-text').value = '新しい完了文';
  await app.elements.get('ticket-complete-text').oninput();
  app.elements.get('ticket-field-submit-label').value = '送る';
  await app.elements.get('ticket-field-submit-label').oninput();
  app.elements.get('ticket-field-message').checked = false;
  await app.elements.get('ticket-field-message').oninput();

  assert.equal(await app.elements.get('ticket-settings-save-btn').dispatch('click').then(() => flushAsync()).then(() => true), true);
  assert.equal(puts.length, 1);
  const expected = structuredClone(baseline);
  expected.ticket = {
    completeText: '新しい完了文',
    fields: { ...baseline.ticket.fields, submitLabel: '送る', showMessage: false },
  };
  assert.deepEqual(puts[0], expected);
  assert.deepEqual(Object.keys(puts[0].ticket).sort(), ['completeText', 'fields']);
  assert.equal('introText' in puts[0].ticket, false);
  assert.equal('noticeText' in puts[0].ticket, false);
  assert.equal(JSON.stringify(puts[0]).includes('未保存'), false);
  assertUnsavedElsewhereIsKept(app);
  assert.equal(app.elements.get('ticket-settings-status').textContent, '保存済み');
  assert.equal(app.elements.get('ticket-settings-actions').hidden, true);
  assert.equal(app.isTicketSettingsDirty(), false);
  assert.equal(app.getSiteData().ticket.completeText, '新しい完了文');
  assert.equal(app.getSiteData().ticket.fields.showMessage, false);
});

test('T46-TICKET while saving the status says so and the inputs are locked; a failure keeps the input and says why', async () => {
  const app = makeApp({ api: true });
  const hold = deferred();
  useRecordingFetch(app, { putResponse: () => hold.promise });
  app.setTicketSettingsOpen(true);
  app.elements.get('ticket-complete-text').value = '保存中の完了文';
  await app.elements.get('ticket-complete-text').oninput();
  const saving = app.saveTicketSettings();
  await flushAsync();
  assert.equal(app.elements.get('ticket-settings-status').textContent, '保存しています…');
  assert.equal(app.elements.get('ticket-complete-text').disabled, true);
  assert.equal(app.elements.get('ticket-settings-save-btn').disabled, true);
  assert.equal(await app.saveTicketSettings(), false, 'no second save while one is running');
  hold.resolve(jsonResponse({ error: '設定を保存できませんでした' }, { ok: false, status: 500 }));
  assert.equal(await saving, false);

  assert.equal(app.elements.get('ticket-settings-status').textContent, '保存できませんでした');
  assert.equal(app.elements.get('ticket-settings-error').textContent, '設定を保存できませんでした');
  assert.equal(app.elements.get('ticket-complete-text').value, '保存中の完了文', 'the input stays');
  assert.equal(app.elements.get('ticket-complete-text').disabled, false);
  assert.equal(app.getSiteData().ticket.completeText, fixture.data.ticket.completeText, 'the data is as it was');
  assert.equal(app.isTicketSettingsDirty(), true);
  assert.equal(app.elements.get('ticket-settings-actions').hidden, false);

  useRecordingFetch(app);
  assert.equal(await app.saveTicketSettings(), true);
  assert.equal(app.elements.get('ticket-settings-error').textContent, '');
});

test('T46-TICKET in Local Mode the settings reflect into memory and wait for the JSON export; the read-only fallback ignores edits', async () => {
  const local = makeApp({ api: false });
  local.setTicketSettingsOpen(true);
  local.elements.get('ticket-complete-text').value = 'ローカルの完了文';
  await local.elements.get('ticket-complete-text').oninput();
  assert.equal(await local.saveTicketSettings(), true);
  assert.equal(local.fetchCalls.length, 0);
  assert.equal(local.getSiteData().ticket.completeText, 'ローカルの完了文');
  assert.equal(local.getHasChanges(), true);
  assert.equal(local.elements.get('ticket-settings-status').textContent, 'JSON書き出し待ち');

  const readOnly = makeApp({ api: true });
  readOnly.setTicketSettingsOpen(true);
  readOnly.setApiFallbackReadOnly(true);
  readOnly.elements.get('ticket-complete-text').value = '読み取り専用で書いた';
  await readOnly.elements.get('ticket-complete-text').oninput();
  assert.equal(readOnly.isTicketSettingsDirty(), false);
  assert.equal(readOnly.elements.get('ticket-complete-text').value, fixture.data.ticket.completeText, 'the typed value is put back');
  assert.equal(readOnly.elements.get('ticket-settings-save-btn').disabled, true);
});

test('T46-TICKET opening the settings again starts from what is saved, never from an abandoned draft', async () => {
  const app = makeApp({ api: true });
  app.setTicketSettingsOpen(true);
  app.elements.get('ticket-complete-text').value = '捨てる下書き';
  await app.elements.get('ticket-complete-text').oninput();
  const closing = app.setTicketSettingsOpen(false);
  await answerLiveDialog(app, 'discard');
  await closing;
  assert.equal(app.setTicketSettingsOpen(true), true);
  assert.equal(app.elements.get('ticket-complete-text').value, fixture.data.ticket.completeText);
  assert.equal(app.isTicketSettingsDirty(), false);
});
