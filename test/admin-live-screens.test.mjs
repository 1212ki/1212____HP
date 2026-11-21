// Issue #46 stages 4-6: T46-LIST, T46-OPEN, T46-FIELDS, T46-NEW, T46-DRAFT, T46-ANNOUNCE, T46-IMAGE, T46-RESERVE, T46-AUTH.
// Strings are checked as the literal text shown on screen (design §10.2), not through LIVE_UI_TEXT.
// All data is synthetic (test/fixtures/admin-live-states.json).
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
const adminCss = readFileSync(join(repoRoot, 'admin/style.css'), 'utf8');

const plain = (value) => JSON.parse(JSON.stringify(value));
const SUMMARY_PATH = '/api/admin/ticket-reservation-summary';

function makeApp({ api = true, readOnly = false, data = fixture.data } = {}) {
  const app = loadAdminApp();
  app.setApiMode(api);
  app.setSiteData(app.normalizeSiteData(structuredClone(data)));
  app.setSavedBaseline(plain(app.getSiteData()));
  if (readOnly) app.setApiFallbackReadOnly(true);
  app.setupLiveWorkspace();
  app.setupTabs();
  app.renderLive();
  app.renderTicketSettings();
  return app;
}

// `summary` answers the summary route (a function returning a response or throwing); everything else is recorded.
function useRoutes(app, { summary, rows = [], put, status } = {}) {
  const calls = { summary: 0, puts: [], statuses: [], reads: [] };
  app.useAdminFetch(async (path, options = {}) => {
    if (path === SUMMARY_PATH) {
      calls.summary += 1;
      return summary ? summary(calls.summary) : jsonResponse({ summaries: [] });
    }
    if (path === '/api/admin/site-data' && options.method === 'PUT') {
      calls.puts.push(JSON.parse(options.body));
      return put ? put() : jsonResponse({ ok: true });
    }
    if (/\/status$/.test(path)) {
      calls.statuses.push({ path, body: JSON.parse(options.body) });
      return status ? status() : jsonResponse({ ok: true, updated: 1 });
    }
    if (path.startsWith('/api/admin/ticket-reservations')) {
      calls.reads.push(path);
      return jsonResponse({ reservations: typeof rows === 'function' ? rows(path) : rows });
    }
    return jsonResponse({});
  });
  return calls;
}

const summaryOf = (summaries) => () => jsonResponse({ summaries });
const upcomingHtml = (app) => app.elements.get('live-upcoming-list').innerHTML;
const pastHtml = (app) => app.elements.get('live-past-list').innerHTML;
const rowOf = (html, liveId) => html.split('<button').find((part) => part.includes(`data-live-id="${liveId}"`)) || '';
const note = (app) => app.elements.get('live-summary-note').textContent;

// ---- T46-LIST -------------------------------------------------------------------------------------------
test('T46-LIST a row shows the flyer, the date, the venue and ›, never the live title; only the first upcoming row says Next Live', () => {
  const app = makeApp({ api: false });
  const upcoming = upcomingHtml(app);
  const first = rowOf(upcoming, 'fx-live-today');
  const second = rowOf(upcoming, 'fx-live-long');
  assert.match(first, /<img class="[^"]*thumbnail[^"]*" src="https:\/\/img\.example\.test\/uploads\/fixture-today\.jpg"/);
  assert.match(first, /2026\.11\.20/);
  assert.match(first, /テスト会場A/);
  assert.match(first, />›</);
  assert.match(second, /src="\.\.\/assets\/images\/fixture-long\.jpg"/, 'a relative flyer path is served from ../');
  assert.match(second, /2099\.12\.12/);
  assert.doesNotMatch(upcoming, /架空の公演/, 'the live name is not shown in the list');
  assert.doesNotMatch(pastHtml(app), /架空の公演|架空の旧形式/);
  assert.equal((upcoming.match(/aria-label="Next Live"/g) || []).length, 1);
  assert.match(first, /aria-label="Next Live"/);
  assert.doesNotMatch(second, /Next Live/);
  assert.doesNotMatch(pastHtml(app), /Next Live/);
});

test('T46-LIST a live without a flyer or a title still has a row with its date and venue', () => {
  const app = makeApp({ api: false });
  const noFlyer = rowOf(pastHtml(app), 'fx-live-past-3');
  const noTitle = rowOf(pastHtml(app), 'fx-live-old-1');
  assert.match(noFlyer, /テスト会場E/);
  assert.match(noFlyer, /data-live-id="fx-live-past-3"/);
  assert.match(noTitle, /テスト会場F/);
  assert.match(noTitle, /2025\.05\.05/);
});

test('T46-LIST upcoming rows show 予約 N枚 and a 未対応 N badge only when something is pending; 0 seats says 予約 0枚; past rows show nothing', async () => {
  const app = makeApp();
  useRoutes(app, { summary: summaryOf([{ liveId: 'fx-live-long', seats: 5, records: 2, pending: 1 }, { liveId: 'fx-live-past-1', seats: 1, records: 1, pending: 0 }]) });
  await app.loadReservationSummary();
  const long = rowOf(upcomingHtml(app), 'fx-live-long');
  const today = rowOf(upcomingHtml(app), 'fx-live-today');
  assert.match(long, /予約 5枚/);
  assert.match(long, /未対応 1/);
  assert.match(today, /予約 0枚/);
  assert.doesNotMatch(today, /未対応/);
  assert.doesNotMatch(pastHtml(app), /予約 \d+枚|未対応/);
  assert.equal(note(app), '');
});

test('T46-LIST while the summary loads no reservation line is shown and no note is shown', async () => {
  const app = makeApp();
  const gate = deferred();
  useRoutes(app, { summary: () => gate.promise });
  const pending = app.loadReservationSummary();
  assert.doesNotMatch(upcomingHtml(app), /予約 \d+枚/);
  assert.equal(note(app), '');
  gate.resolve(jsonResponse({ summaries: [{ liveId: 'fx-live-long', seats: 2, records: 1, pending: 0 }] }));
  await pending;
  assert.match(rowOf(upcomingHtml(app), 'fx-live-long'), /予約 2枚/);
});

for (const [name, answer] of [
  ['404 from an old Worker', () => jsonResponse({ error: 'not found' }, { ok: false, status: 404 })],
  ['500', () => jsonResponse({ error: 'boom' }, { ok: false, status: 500 })],
  ['a body without summaries', () => jsonResponse({ unexpected: true })],
  ['summaries that is not a list', () => jsonResponse({ summaries: 'x' })],
  ['a network failure', () => { throw new TypeError('Failed to fetch'); }],
]) {
  test(`T46-LIST ${name} shows one line "予約の数を読み込めませんでした。" and no reservation line`, async () => {
    const app = makeApp();
    useRoutes(app, { summary: answer });
    await app.loadReservationSummary();
    assert.equal(note(app), '予約の数を読み込めませんでした。');
    assert.doesNotMatch(upcomingHtml(app), /予約 \d+枚/);
    assert.match(upcomingHtml(app), /テスト会場A/, 'the list itself stays');
  });
}

for (const [name, answer] of [
  ['401', () => jsonResponse({ error: 'unauthorized' }, { ok: false, status: 401 })],
  ['403', () => jsonResponse({ error: 'forbidden' }, { ok: false, status: 403 })],
  ['an empty passphrase (the prompt was closed)', () => { throw new Error('管理トークン未設定'); }],
]) {
  test(`T46-LIST ${name} shows "認証できませんでした。" instead of the load failure line`, async () => {
    const app = makeApp();
    useRoutes(app, { summary: answer });
    await app.loadReservationSummary();
    assert.equal(note(app), '認証できませんでした。');
    assert.doesNotMatch(upcomingHtml(app), /予約 \d+枚/);
  });
}

test('T46-LIST the API connection failure and Local Mode never call the summary and show no note', async () => {
  for (const options of [{ api: false }, { api: true, readOnly: true }]) {
    const app = makeApp(options);
    const calls = useRoutes(app, { summary: summaryOf([]) });
    await app.loadReservationSummary();
    assert.equal(calls.summary, 0);
    assert.equal(note(app), '');
    assert.doesNotMatch(upcomingHtml(app), /予約 \d+枚/);
  }
});

test('T46-LIST an empty list says there is nothing, as it did before', () => {
  const app = makeApp({ data: { ...fixture.data, live: { ...fixture.data.live, upcoming: [], past: [] } } });
  assert.match(upcomingHtml(app), /開催予定のライブはありません/);
  assert.match(pastHtml(app), /終了したライブはありません/);
});

test('T46-LIST with an old Worker (summary 404) saving a Live and changing a reservation still work', async () => {
  const app = makeApp();
  const calls = useRoutes(app, { summary: () => jsonResponse({}, { ok: false, status: 404 }), rows: fixture.reservations['fx-live-long'] });
  await app.loadReservationSummary();
  assert.equal(note(app), '予約の数を読み込めませんでした。');

  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), true);
  assert.deepEqual(calls.statuses.map((entry) => entry.body), [{ status: 'handled' }]);

  assert.equal(app.editLive('fx-live-long', 'upcoming'), true);
  await flushAsync();
  app.elements.get('edit-venue').value = 'テスト会場B2';
  await app.elements.get('edit-venue').dispatch('input');
  assert.equal(await app.saveLiveWorkspace(), true);
  assert.equal(calls.puts.length, 1, 'the PUT route is used as before');
});

test('T46-LIST only the latest of overlapping summary requests is applied', async () => {
  const app = makeApp();
  const first = deferred();
  const second = deferred();
  const gates = [first, second];
  useRoutes(app, { summary: (n) => gates[n - 1].promise });
  const older = app.loadReservationSummary();
  const newer = app.loadReservationSummary();
  second.resolve(jsonResponse({ summaries: [{ liveId: 'fx-live-long', seats: 9, records: 3, pending: 2 }] }));
  await newer;
  first.resolve(jsonResponse({ summaries: [{ liveId: 'fx-live-long', seats: 1, records: 1, pending: 0 }] }));
  await older;
  const long = rowOf(upcomingHtml(app), 'fx-live-long');
  assert.match(long, /予約 9枚/);
  assert.match(long, /未対応 2/);
});

test('T46-LIST the summary is read again after a save, a delete, a status change and a manual reservation', async () => {
  const app = makeApp();
  const calls = useRoutes(app, { summary: summaryOf([]), rows: fixture.reservations['fx-live-long'] });
  await app.loadReservationSummary();
  assert.equal(calls.summary, 1);

  await app.markTicketStatus('fx-res-1', 'handled');
  assert.equal(calls.summary, 2, 'after a status change');

  assert.equal(app.editLive('fx-live-long', 'upcoming'), true);
  await flushAsync();
  app.elements.get('edit-venue').value = 'テスト会場B2';
  await app.elements.get('edit-venue').dispatch('input');
  await app.saveLiveWorkspace();
  await flushAsync();
  assert.equal(calls.summary, 3, 'after a save');

  app.elements.get('manual-reservation-name').value = '架空 四郎';
  app.elements.get('manual-reservation-quantity').value = '2';
  assert.equal(await app.submitManualReservation(), true);
  await flushAsync();
  assert.equal(calls.summary, 4, 'after a manual reservation');

  const deleting = app.deleteLiveFromWorkspace();
  await answerLiveDialog(app, 'delete');
  assert.equal(await deleting, true);
  await flushAsync();
  assert.equal(calls.summary, 5, 'after a delete');
});

test('T46-LIST the Ticket Page共通設定 entry sits below the lists; the note line sits above them', () => {
  const entry = adminHtml.indexOf('id="live-ticket-settings-open"');
  assert.ok(entry > adminHtml.indexOf('id="live-past-list"'), 'the entry is after both lists');
  assert.ok(entry < adminHtml.indexOf('id="live-editor-pane"'), 'and still in the list pane');
  const noteAt = adminHtml.indexOf('id="live-summary-note"');
  assert.ok(noteAt > 0 && noteAt < adminHtml.indexOf('id="live-upcoming-list"'));
  assert.match(adminHtml, /id="live-add-btn"[^>]*>\+ 新しいライブ<\/button>/);
});

test('T46-LIST loading the data reads the reservation list and then the summary once, and shows the counts without a second request', async () => {
  const app = loadAdminApp();
  app.setApiMode(true);
  const order = [];
  app.useAdminFetch(async (path) => {
    order.push(path.split('?')[0]);
    if (path === '/api/admin/site-data') return jsonResponse({ data: structuredClone(fixture.data) });
    if (path === SUMMARY_PATH) return jsonResponse({ summaries: [{ liveId: 'fx-live-long', seats: 5, records: 2, pending: 1 }] });
    return jsonResponse({ reservations: [] });
  });
  await app.loadData();
  await flushAsync();
  app.renderLive();
  assert.deepEqual(order, ['/api/admin/site-data', '/api/admin/ticket-reservations', SUMMARY_PATH]);
  assert.match(rowOf(upcomingHtml(app), 'fx-live-long'), /予約 5枚/);
});

test('T46-LIST the loaded summary is requested once after the data load, and the list rows can be opened', async () => {
  const app = makeApp();
  const calls = useRoutes(app, { summary: summaryOf([]) });
  await app.loadReservationSummary();
  const row = app.document.querySelectorAll('[data-live-edit]').find((trigger) => trigger.dataset.liveId === 'fx-live-long');
  assert.ok(row, 'the row is a real button with data-live-edit');
  assert.equal(row.dataset.liveCategory, 'upcoming');
  assert.equal(calls.summary, 1);
});

// ======================================================================================================
// Stage 5: opening a Live, its fields, a new Live, the draft, the announcement and the flyer
// ======================================================================================================
const bodyHtml = (app) => app.elements.get('live-editor-body').innerHTML;
const idsInOrder = (html) => [...html.matchAll(/<[a-z][\w-]*\b[^>]*\bid="([^"]+)"/gi)].map((match) => match[1]);
const cssBlock = (css, query) => {
  const start = css.indexOf(query);
  assert.ok(start >= 0, `${query} exists`);
  let depth = 0;
  for (let index = css.indexOf('{', start); index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') { depth -= 1; if (depth === 0) return css.slice(start, index + 1); }
  }
  return '';
};

async function openLive(app, id, category) {
  assert.equal(app.editLive(id, category), true);
  await flushAsync();
}
async function typeInto(app, id, value) {
  app.elements.get(id).value = value;
  await app.elements.get(id).dispatch('input');
}

// ---- T46-OPEN -------------------------------------------------------------------------------------------
test('T46-OPEN the Header is one row: back, date and venue, and only the save state on the right', async () => {
  const app = makeApp();
  useRoutes(app, { rows: [] });
  await openLive(app, 'fx-live-long', 'upcoming');
  assert.equal(app.elements.get('live-editor-back').hidden, false);
  assert.match(adminHtml, /id="live-editor-back"[^>]*>‹ 一覧<\/button>/);
  assert.equal(app.elements.get('live-editor-heading').textContent, '2099.12.12(Sat) テスト会場B', 'date and venue, not the live name');
  assert.equal(app.elements.get('live-editor-heading').getAttribute('title'), '2099.12.12(Sat) テスト会場B');
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');
  assert.doesNotMatch(adminHtml, /id="live-editor-context"/, 'the eyebrow row is gone');
  assert.doesNotMatch(adminHtml, /選択中Live/);
  assert.equal(app.elements.get('live-editor-save-status').textContent.includes('開催予定'), false, 'the category is not in the Header');
});

test('T46-OPEN while a Live is open the body carries is-live-editing, and it is removed when the Live closes', async () => {
  const app = makeApp();
  useRoutes(app);
  assert.equal(app.document.body.classList.contains('is-live-editing'), false);
  await openLive(app, 'fx-live-long', 'upcoming');
  assert.equal(app.document.body.classList.contains('is-live-editing'), true);
  assert.equal(app.closeLiveEditor(), true);
  assert.equal(app.document.body.classList.contains('is-live-editing'), false);
  app.addLive();
  assert.equal(app.document.body.classList.contains('is-live-editing'), true);
});

test('T46-OPEN the switch has three entries 公開内容 / 告知 / 予約 and the reservation entry carries the seat count', async () => {
  const app = makeApp();
  useRoutes(app, { summary: summaryOf([{ liveId: 'fx-live-long', seats: 5, records: 2, pending: 1 }]), rows: fixture.reservations['fx-live-long'] });
  await app.loadReservationSummary();
  await openLive(app, 'fx-live-long', 'upcoming');
  const html = bodyHtml(app);
  assert.deepEqual(
    idsInOrder(html).filter((id) => /^live-editor-task-(public|announcement|reservation)$/.test(id)),
    ['live-editor-task-public', 'live-editor-task-announcement', 'live-editor-task-reservation'],
  );
  assert.match(html, /id="live-editor-task-public"[^>]*>公開内容<\/button>/);
  assert.match(html, /id="live-editor-task-announcement"[^>]*>告知<\/button>/);
  assert.match(html, /id="live-editor-task-reservation"[^>]*>予約<span[^>]*id="live-editor-reservation-count"/);
  assert.equal(app.elements.get('live-editor-reservation-count').textContent, ' 5', 'the summary count before the ledger loads');
  await flushAsync();
  assert.equal(app.elements.get('live-editor-reservation-count').textContent, ' 5', 'the ledger total (cancelled rows excluded) replaces it');
});

test('T46-OPEN the reservation count is blank for a past live or a failed summary until the ledger is read', async () => {
  const app = makeApp();
  useRoutes(app, { summary: () => jsonResponse({}, { ok: false, status: 404 }), rows: [] });
  await app.loadReservationSummary();
  const gate = deferred();
  app.useAdminFetch(async (path) => (path.startsWith('/api/admin/ticket-reservations') ? gate.promise : jsonResponse({})));
  assert.equal(app.editLive('fx-live-past-1', 'past'), true);
  assert.equal(app.elements.get('live-editor-reservation-count').textContent, '');
  gate.resolve(jsonResponse({ reservations: fixture.reservations['fx-live-past-1'] }));
  await flushAsync();
  assert.equal(app.elements.get('live-editor-reservation-count').textContent, ' 1');
});

test('T46-OPEN the public fields run flyer → date → venue → name → OPEN/START → fee → note → performers → 予約先・リンクなど → category → delete', async () => {
  const app = makeApp();
  useRoutes(app);
  await openLive(app, 'fx-live-long', 'upcoming');
  const order = idsInOrder(bodyHtml(app));
  const positions = ['edit-image', 'edit-date', 'edit-venue', 'edit-title', 'edit-openTime', 'edit-startTime', 'edit-ticket', 'edit-notes', 'edit-performers', 'edit-ticketUrl', 'edit-reservationClosed', 'edit-link', 'edit-description', 'live-source-intake', 'edit-isPast', 'live-editor-delete-btn']
    .map((id) => order.indexOf(id));
  assert.ok(positions.every((position) => position >= 0), `all present: ${positions}`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'in this order');
  const html = bodyHtml(app);
  assert.match(html, /<summary[^>]*><span>予約先・リンクなど<\/span>/);
  assert.match(html, /<summary[^>]*><span>元情報から作り直す<\/span>/);
  assert.match(html, />このライブを削除<\/button>/);
  assert.doesNotMatch(html, /基本情報|公演情報|公開画面に表示|管理専用/, 'no section headings or eyebrow labels');
  for (const label of ['日付', '会場', 'ライブ名', 'OPEN', 'START', '料金', '補足', '共演者', '予約URL', '予約の受付を終了する', 'リンク', '説明']) {
    assert.ok(html.includes(`>${label}<`), label);
  }
  assert.doesNotMatch(html, />(Open|Start|ticket|予約先|詳細・SNSリンク（予約先とは別）|予約受付を終了|ライブ名（任意）)</);
});

test('T46-OPEN 保存して公開 is shown only while the Live is unsaved, and only for as long as it differs from the opened values', async () => {
  const app = makeApp();
  useRoutes(app);
  await openLive(app, 'fx-live-long', 'upcoming');
  const footer = () => app.elements.get('live-editor-footer');
  assert.equal(footer().hidden, true);
  const original = app.elements.get('edit-title').value;
  await typeInto(app, 'edit-title', `${original}!`);
  assert.equal(footer().hidden, false);
  assert.equal(app.elements.get('live-editor-save-btn').hidden, false);
  await typeInto(app, 'edit-title', original);
  assert.equal(footer().hidden, true, 'typing the original value back hides it again');
});

test('T46-OPEN the footer shows the failure reason above 保存して公開 and the Header says 保存できませんでした', async () => {
  const app = makeApp();
  useRoutes(app, { put: () => jsonResponse({ error: '保存先が一時的に使えません' }, { ok: false, status: 500 }) });
  await openLive(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-venue', 'テスト会場B2');
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存できませんでした');
  assert.equal(app.elements.get('live-editor-save-error').textContent, '保存先が一時的に使えません');
  assert.equal(app.elements.get('live-editor-footer').hidden, false);
  const order = idsInOrder(bodyHtml(app));
  assert.ok(order.indexOf('live-editor-save-error') < order.indexOf('live-editor-save-btn'));
});

test('T46-OPEN the structure under 900px: the global chrome is hidden, taps are 44px, one-line labels do not wrap, the save bar is fixed to the bottom', () => {
  const mobile = cssBlock(adminCss, '@media (max-width: 899px)');
  assert.match(mobile, /body\.is-live-editing\s+\.header[\s\S]*display:\s*none/);
  assert.match(mobile, /body\.is-live-editing[^{]*\.connection-banner/);
  assert.match(mobile, /body\.is-live-editing[^{]*\.tab-nav/);
  assert.match(mobile, /body\.is-live-editing[^{]*\.section-header/);
  assert.match(mobile, /body\.is-live-editing[^{]*\.live-workspace-tabs/);
  assert.match(mobile, /body\.is-live-editing[^{]*\.live-page-toolbar/);
  assert.match(mobile, /body\.is-live-editing[^{]*\.live-summary-note/);
  assert.match(mobile, /\.live-editor-task-tab[^{]*\{[^}]*min-height:\s*44px/);
  assert.match(mobile, /\.live-editor-back[^{]*\{[^}]*min-height:\s*44px/);
  assert.match(adminCss, /\.live-editor-task-tabs\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/);
  assert.match(adminCss, /\.live-editor-footer\s*\{[^}]*position:\s*sticky[^}]*bottom:\s*0/);
  for (const selector of ['.live-editor-footer .btn', '.live-list-tab', '.live-editor-save-status']) {
    const rule = adminCss.split('}').find((block) => block.includes(selector) && block.includes('white-space'));
    assert.ok(rule && /white-space:\s*nowrap/.test(rule), `${selector} is nowrap`);
  }
  assert.match(adminCss, /\.live-editor-title-group h3\s*\{[^}]*text-overflow:\s*ellipsis/);
});

// ---- T46-FIELDS -----------------------------------------------------------------------------------------
const EDIT_FIELD_IDS = ['edit-sourceText', 'edit-date', 'edit-title', 'edit-venue', 'edit-openTime', 'edit-startTime', 'edit-ticket', 'edit-notes', 'edit-performers', 'edit-description', 'edit-image', 'edit-ticketUrl', 'edit-link', 'edit-reservationClosed', 'edit-isPast', 'edit-xComment'];

test('T46-FIELDS every editable item of today is still in the editor, with the same id', async () => {
  const app = makeApp();
  useRoutes(app);
  await openLive(app, 'fx-live-long', 'upcoming');
  for (const id of EDIT_FIELD_IDS) assert.ok(app.elements.get(id), `${id} exists`);
  assert.ok(app.elements.get('edit-image-file') && app.elements.get('edit-image-select-btn') && app.elements.get('x-post-preview'));
  assert.ok(app.elements.get('live-source-parse-btn') && app.elements.get('manual-reservation-form'));
  for (const id of ['edit-description', 'edit-ticketUrl', 'edit-link', 'edit-reservationClosed']) {
    assert.doesNotMatch(bodyHtml(app), new RegExp(`id="${id}"[^>]*hidden`), `${id} is not hidden`);
  }
});

test('T46-FIELDS a legacy 7-key live opens with empty fields and saves the same 17-key shape as before', async () => {
  const app = makeApp({ data: fixture.data });
  const legacy = fixture.data.live.past.find((live) => Object.keys(live).length === 7 || live.id === 'fx-live-old-1');
  const calls = useRoutes(app);
  await openLive(app, legacy.id, 'past');
  assert.equal(app.elements.get('edit-openTime').value, '');
  assert.equal(app.elements.get('edit-ticket').value, '');
  assert.equal(app.elements.get('edit-description').value, legacy.description || '');
  await typeInto(app, 'edit-notes', '注記');
  await app.saveLiveWorkspace();
  const saved = calls.puts[0].live.past.find((live) => live.id === legacy.id);
  assert.deepEqual(
    Object.keys(saved).sort(),
    ['date', 'description', 'id', 'image', 'link', 'notes', 'openTime', 'performers', 'reservationClosed', 'sourceText', 'startTime', 'ticket', 'ticketUrl', 'title', 'venue', 'xComment'].sort(),
  );
  assert.equal(saved.notes, '注記');
});

test('T46-FIELDS values inside the folded 予約先・リンクなど are saved even though it was never opened', async () => {
  const app = makeApp();
  const calls = useRoutes(app);
  await openLive(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-ticketUrl', 'https://tickets.example.test/x');
  await typeInto(app, 'edit-link', 'https://example.test/link');
  await typeInto(app, 'edit-description', '説明の文');
  const closed = app.elements.get('edit-reservationClosed');
  closed.checked = true;
  await closed.dispatch('change');
  await app.saveLiveWorkspace();
  const saved = calls.puts[0].live.upcoming.find((live) => live.id === 'fx-live-long');
  assert.equal(saved.ticketUrl, 'https://tickets.example.test/x');
  assert.equal(saved.link, 'https://example.test/link');
  assert.equal(saved.description, '説明の文');
  assert.equal(saved.reservationClosed, true);
});

test('T46-FIELDS the category is a two-way choice backed by edit-isPast: choosing 公演終了 saves into the past list', async () => {
  const app = makeApp();
  const calls = useRoutes(app);
  await openLive(app, 'fx-live-long', 'upcoming');
  const html = bodyHtml(app);
  assert.match(html, /id="live-category-upcoming"[^>]*>開催予定<\/button>/);
  assert.match(html, /id="live-category-past"[^>]*>公演終了<\/button>/);
  assert.equal(app.elements.get('live-category-upcoming').getAttribute('aria-pressed'), 'true');
  await app.elements.get('live-category-past').dispatch('click');
  assert.equal(app.elements.get('edit-isPast').checked, true);
  assert.equal(app.elements.get('live-category-past').getAttribute('aria-pressed'), 'true');
  assert.equal(app.getLiveEditorState().dirty, true);
  assert.match(app.elements.get('live-category-warning').textContent, /公演終了ですが、今日以降の日付です。区分は自動変更しません。/);
  await app.saveLiveWorkspace();
  assert.ok(calls.puts[0].live.past.some((live) => live.id === 'fx-live-long'));
  assert.ok(!calls.puts[0].live.upcoming.some((live) => live.id === 'fx-live-long'));
});

// ---- T46-NEW --------------------------------------------------------------------------------------------
function draftResponse(draft = {}) {
  return jsonResponse({
    provider: 'openai',
    draft: {
      date: '2099-01-02', title: '下書きのライブ', venue: 'テスト会場Z', openTime: '18:00', startTime: '18:30', ticket: '¥3,000',
      notes: '注記A', performers: '架空の出演者', ticketUrl: '', link: '', ...draft,
    },
  });
}
function useNewLiveRoutes(app, { intake = () => draftResponse(), put } = {}) {
  const calls = { intake: [], puts: [], dialogs: 0 };
  app.useAdminFetch(async (path, options = {}) => {
    if (path === '/api/admin/live-source-intake') { calls.intake.push(JSON.parse(options.body)); return intake(); }
    if (path === '/api/admin/site-data' && options.method === 'PUT') { calls.puts.push(JSON.parse(options.body)); return put ? put() : jsonResponse({ ok: true }); }
    if (path === SUMMARY_PATH) return jsonResponse({ summaries: [] });
    return jsonResponse({ reservations: [] });
  });
  return calls;
}
const dialogShown = (app) => ['stay', 'cancel', 'discard', 'delete'].some((id) => app.elements.get(`live-dialog-action-${id}`));

test('T46-NEW the first screen has only the source, 下書きを作る and 手入力で作る; the fields wait behind it', async () => {
  const app = makeApp();
  useNewLiveRoutes(app);
  assert.equal(app.addLive(), true);
  const html = bodyHtml(app);
  assert.equal(app.elements.get('live-editor-heading').textContent, '新しいライブ');
  assert.match(html, /id="live-source-parse-btn"[^>]*>下書きを作る<\/button>/);
  assert.match(html, /id="live-manual-entry-btn"[^>]*>手入力で作る<\/button>/);
  assert.equal(app.elements.get('live-public-fields').hidden, true);
  assert.equal(app.elements.get('live-editor-task-tabs').hidden, true);
  assert.equal(app.elements.get('live-editor-footer').hidden, true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '');
  assert.doesNotMatch(html, /id="live-editor-delete-btn"|id="live-category-/);
});

test('T46-NEW from the source to the announcement takes exactly three presses and never opens a confirmation surface', async () => {
  const app = makeApp();
  const calls = useNewLiveRoutes(app);
  const presses = [];
  const press = async (id) => {
    presses.push(id);
    // 保存して公開 is wired with onclick in the markup (a real browser runs it); the harness has no inline handlers.
    if (id === 'live-editor-save-btn') await app.saveLiveWorkspace(); else await app.elements.get(id).dispatch('click');
    await flushAsync();
    assert.equal(dialogShown(app), false, `no surface after ${id}`);
  };

  app.addLive();
  await typeInto(app, 'edit-sourceText', '貼り付けた元情報');
  await press('live-source-parse-btn');
  assert.equal(calls.intake.length, 1);
  assert.equal(app.elements.get('live-public-fields').hidden, false, 'the draft is shown for checking');
  assert.equal(app.elements.get('edit-venue').value, 'テスト会場Z');
  assert.equal(app.elements.get('live-editor-save-status').textContent, '未保存');
  assert.equal(app.elements.get('live-editor-task-tabs').hidden, true);
  assert.equal(app.elements.get('live-editor-footer').hidden, false);
  assert.doesNotMatch(bodyHtml(app), /id="live-editor-delete-btn"|id="live-category-/);

  await press('live-editor-save-btn');
  assert.equal(calls.puts.length, 1);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');
  assert.equal(app.elements.get('live-editor-heading').textContent, '2099.01.02(Fri) テスト会場Z');
  assert.match(bodyHtml(app), /保存して公開しました。/);
  assert.equal(app.elements.get('live-postsave').hidden, false);
  assert.equal(app.elements.get('live-editor-panel-public').hidden, true, 'the fields are out of the way');
  assert.equal(app.elements.get('live-editor-task-tabs').hidden, true);
  assert.equal(app.elements.get('live-editor-footer').hidden, true);

  await press('live-postsave-x-btn');
  assert.deepEqual(presses, ['live-source-parse-btn', 'live-editor-save-btn', 'live-postsave-x-btn']);
  assert.equal(app.openedUrls.length, 1);
  assert.match(app.openedUrls[0], /^https:\/\/twitter\.com\/intent\/tweet\?text=/);
  assert.equal(calls.puts.length, 1, 'opening X does not save again');
});

test('T46-NEW the announcement after saving shows the post text and あとで returns to the list', async () => {
  const app = makeApp();
  useNewLiveRoutes(app);
  app.addLive();
  await typeInto(app, 'edit-sourceText', '元情報');
  await app.elements.get('live-source-parse-btn').dispatch('click');
  await flushAsync();
  await app.saveLiveWorkspace();
  await flushAsync();
  const preview = app.elements.get('live-postsave-preview').textContent;
  assert.equal(preview, app.elements.get('x-post-preview').value);
  assert.match(preview, /テスト会場Z/);
  assert.match(preview, /\/og\/live\//, 'the share URL is part of the text');
  assert.match(bodyHtml(app), /id="live-postsave-later-btn"[^>]*>あとで<\/button>/);
  await app.elements.get('live-postsave-later-btn').dispatch('click');
  await flushAsync();
  assert.equal(app.document.body.classList.contains('is-live-editing'), false);
  assert.equal(app.getModalState().currentEditId, null);
  assert.equal(dialogShown(app), false);
});

test('T46-NEW saving an existing Live stays on its public content and shows 保存済み, never the announcement', async () => {
  const app = makeApp();
  useRoutes(app);
  await openLive(app, 'fx-live-long', 'upcoming');
  await typeInto(app, 'edit-venue', 'テスト会場B2');
  assert.equal(await app.saveLiveWorkspace(), true);
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存済み');
  assert.equal(app.elements.get('live-public-fields').hidden, false);
  assert.equal(app.elements.get('live-postsave').hidden, true, 'the announcement block exists but stays hidden');
  assert.equal(app.getLiveEditorScreen(), 'edit');
});

test('T46-NEW 手入力で作る opens the fields without calling the draft route; announcement and reservation say 保存すると使えます。', async () => {
  const app = makeApp();
  const calls = useNewLiveRoutes(app);
  app.addLive();
  await app.elements.get('live-manual-entry-btn').dispatch('click');
  assert.equal(calls.intake.length, 0);
  assert.equal(app.elements.get('live-public-fields').hidden, false);
  assert.equal(app.elements.get('edit-venue').value, '');
  const html = bodyHtml(app);
  assert.equal((html.match(/保存すると使えます。/g) || []).length >= 2, true, 'announcement and reservation both say it');
  assert.match(html, /id="x-intent-btn"[^>]*disabled/);
  assert.match(html, /id="x-link-copy-btn"[^>]*disabled/);
  assert.match(html, /id="manual-reservation-submit"[^>]*disabled/);
  assert.equal(app.elements.get('live-editor-task-announcement').disabled, true);
  assert.equal(app.elements.get('live-editor-task-reservation').disabled, true);
  assert.equal(app.setLiveEditorTask('announcement'), 'public');
  assert.equal(app.buildXIntentUrlFromModal(), '');
});

test('T46-NEW saving without a date or venue stays on the draft and says what is missing under the field', async () => {
  const app = makeApp();
  const calls = useNewLiveRoutes(app);
  app.addLive();
  await app.elements.get('live-manual-entry-btn').dispatch('click');
  await typeInto(app, 'edit-title', '名前だけ');
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.equal(calls.puts.length, 0);
  assert.equal(app.elements.get('edit-date-error').textContent, '日付を入力してください。');
  assert.equal(app.elements.get('edit-venue-error').textContent, '会場を入力してください。');
});

// ---- T46-DRAFT ------------------------------------------------------------------------------------------
test('T46-DRAFT while the draft is made the button says 下書きを作っています… and cannot be pressed; it returns to 下書きを作る', async () => {
  const app = makeApp();
  const gate = deferred();
  useNewLiveRoutes(app, { intake: () => gate.promise });
  app.addLive();
  await typeInto(app, 'edit-sourceText', '元情報');
  const pending = app.handleLiveSourceParse();
  const button = app.elements.get('live-source-parse-btn');
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, '下書きを作っています…');
  assert.equal(app.elements.get('live-source-warnings').textContent, '下書きを作っています…');
  assert.equal(await app.handleLiveSourceParse(), false, 'a second press does nothing');
  gate.resolve(draftResponse());
  await pending;
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, '下書きを作る');
});

test('T46-DRAFT the provider notice after a draft is the fixed sentence of design §7.4, and a legacy response keeps the old one', async () => {
  for (const [provider, expected] of [['openai', 'OpenAIで整理しました。内容を確認してから更新してください。'], ['claude', 'Claudeで整理しました。内容を確認してから更新してください。'], [null, 'AIで整理しました。内容を確認してから更新してください。']]) {
    const app = makeApp();
    useNewLiveRoutes(app, { intake: () => jsonResponse({ ...(provider ? { provider } : {}), draft: JSON.parse(draftBody()) }) });
    app.addLive();
    await typeInto(app, 'edit-sourceText', '元情報');
    await app.handleLiveSourceParse();
    assert.equal(app.elements.get('live-source-warnings').textContent, expected);
  }
});
test('T46-DRAFT the provider notice is also shown on the screen to check, because the source screen is hidden by then (Figma 44:546)', async () => {
  const app = makeApp();
  useNewLiveRoutes(app);
  app.addLive();
  assert.match(bodyHtml(app), /<p id="live-draft-notice" class="live-draft-notice" role="status" aria-live="polite"><\/p>/, 'an empty line at the top of the fields, inside #live-public-fields');
  assert.equal(app.elements.get('live-draft-notice').textContent ?? '', '');
  await typeInto(app, 'edit-sourceText', '元情報');
  await app.handleLiveSourceParse();
  assert.equal(app.elements.get('live-draft-notice').textContent, 'OpenAIで整理しました。内容を確認してから更新してください。');
  assert.equal(app.elements.get('live-source-warnings').textContent, 'OpenAIで整理しました。内容を確認してから更新してください。', 'the line of the source screen is the same sentence as before');
  assert.equal(app.elements.get('live-source-intake').hidden, true, 'the source screen is what hides the first line');
  // the notice sits in the fields that are shown, before the flyer
  const html = bodyHtml(app);
  assert.ok(html.indexOf('id="live-draft-notice"') > html.indexOf('id="live-public-fields"') && html.indexOf('id="live-draft-notice"') < html.indexOf('id="live-flyer"'));
});

test('T46-DRAFT a failed draft shows its two lines where the source is (the notice line stays empty), and an existing Live has no notice line', async () => {
  const app = makeApp();
  useNewLiveRoutes(app, { intake: () => jsonResponse({ error: 'x' }, { ok: false, status: 502 }) });
  app.addLive();
  await typeInto(app, 'edit-sourceText', '元情報');
  await app.handleLiveSourceParse();
  assert.equal(app.elements.get('live-draft-notice').textContent ?? '', '');
  const existing = makeApp();
  useNewLiveRoutes(existing);
  existing.editLive(fixture.data.live.upcoming[0].id, 'upcoming');
  await flushAsync();
  assert.equal(existing.elements.get('live-draft-notice'), undefined);
});

test('T46-LIST 「+ 新しいライブ」 belongs to the Liveページ: 予約管理 shows the switch only (Figma 44:811 / 47:926)', () => {
  const app = makeApp();
  const add = app.elements.get('live-add-btn');
  assert.equal(Boolean(add.hidden), false);
  assert.equal(app.setLiveWorkspaceView('reservations'), true);
  assert.equal(add.hidden, true);
  assert.equal(app.setLiveWorkspaceView('page'), true);
  assert.equal(add.hidden, false);
});

function draftBody() {
  return JSON.stringify({ date: '2099-01-02', title: 't', venue: 'v', openTime: '', startTime: '', ticket: '', notes: '', performers: '', ticketUrl: '', link: '' });
}

test('T46-DRAFT when the draft fails the source and every field stay and two lines say so', async () => {
  const app = makeApp();
  useNewLiveRoutes(app, { intake: () => jsonResponse({ error: 'x' }, { ok: false, status: 502 }) });
  app.addLive();
  await typeInto(app, 'edit-sourceText', '元情報');
  await typeInto(app, 'edit-title', '入力したタイトル');
  assert.equal(await app.handleLiveSourceParse(), false);
  assert.equal(app.elements.get('edit-sourceText').value, '元情報');
  assert.equal(app.elements.get('edit-title').value, '入力したタイトル');
  assert.equal(app.elements.get('live-source-warnings').textContent, '下書きを作れませんでした。入力した元情報と、今の入力内容は残っています。');
  assert.equal(app.elements.get('live-public-fields').hidden, true, 'it stays on the source screen');
});

test('T46-DRAFT a response that arrives after the source changed or the Live changed is not applied', async () => {
  const app = makeApp();
  const gate = deferred();
  useNewLiveRoutes(app, { intake: () => gate.promise });
  app.addLive();
  await typeInto(app, 'edit-sourceText', '元情報');
  const pending = app.handleLiveSourceParse();
  await typeInto(app, 'edit-sourceText', '元情報を直した');
  gate.resolve(draftResponse());
  assert.equal(await pending, false);
  assert.equal(app.elements.get('edit-venue').value, '');
  assert.equal(app.elements.get('live-source-warnings').textContent, '入力が変更されたため反映しませんでした。もう一度下書きを作ってください。');
});

test('T46-DRAFT Local Mode does not call the draft route', async () => {
  const app = makeApp({ api: false });
  app.useAdminFetch(async () => { throw new Error('no network in Local Mode'); });
  app.addLive();
  await typeInto(app, 'edit-sourceText', '元情報');
  assert.equal(await app.handleLiveSourceParse(), false);
  assert.equal(app.fetchCalls.length, 0);
  assert.equal(app.elements.get('edit-sourceText').value, '元情報');
});

// ---- T46-ANNOUNCE ---------------------------------------------------------------------------------------
test('T46-ANNOUNCE the announcement has the comment, the post text, Xで告知する and two copy buttons', async () => {
  const app = makeApp();
  useRoutes(app);
  await openLive(app, 'fx-live-long', 'upcoming');
  const html = bodyHtml(app);
  assert.match(html, /<label[^>]*for="edit-xComment"[^>]*>ひとこと<\/label>/);
  assert.match(html, /<label[^>]*for="x-post-preview"[^>]*>投稿の内容<\/label>/);
  assert.match(html, /id="x-intent-btn"[^>]*>Xで告知する<\/button>/);
  assert.match(html, /id="x-post-copy-btn"[^>]*>投稿文をコピー<\/button>/);
  assert.match(html, /id="x-link-copy-btn"[^>]*>リンクをコピー<\/button>/);
  assert.doesNotMatch(html, /オーナーコメント|X投稿プレビュー|X Web Intentを開く/);
  assert.doesNotMatch(html, /id="x-intent-btn"[^>]*disabled/);
});

test('T46-ANNOUNCE changing the comment makes the Live unsaved and updates the post; the share URL is unchanged', async () => {
  const app = makeApp();
  useRoutes(app);
  await openLive(app, 'fx-live-long', 'upcoming');
  assert.match(app.elements.get('x-post-preview').value, /https:\/\/[^\s]+\/og\/live\/fx-live-long$/m);
  await typeInto(app, 'edit-xComment', '架空のひとこと');
  assert.equal(app.getLiveEditorState().dirty, true);
  assert.equal(app.elements.get('live-editor-footer').hidden, false, 'the save bar shows on the announcement too');
  assert.match(app.elements.get('x-post-preview').value, /架空のひとこと/);
});

test('T46-ANNOUNCE the copy result is told next to the buttons: コピーしました。 / コピーできませんでした', async () => {
  const app = makeApp();
  useRoutes(app);
  await openLive(app, 'fx-live-long', 'upcoming');
  assert.equal(await app.copyXAnnouncementFromModal(), true);
  assert.equal(app.elements.get('live-copy-status').textContent, 'コピーしました。');
  assert.equal(app.clipboardWrites.length, 1);
  assert.equal(await app.copyLiveLinkFromModal(), true);
  assert.equal(app.elements.get('live-copy-status').textContent, 'コピーしました。');
  assert.match(app.clipboardWrites[1], /\/og\/live\/fx-live-long$/);

  const failing = loadAdminApp({ clipboardWrite: async () => { throw new Error('denied'); }, });
  failing.setApiMode(true);
  failing.setSiteData(failing.normalizeSiteData(structuredClone(fixture.data)));
  failing.setSavedBaseline(plain(failing.getSiteData()));
  failing.setupLiveWorkspace(); failing.renderLive();
  useRoutes(failing);
  await openLive(failing, 'fx-live-long', 'upcoming');
  assert.equal(await failing.copyXAnnouncementFromModal(), true, 'the textarea fallback copies');
});

test('T46-ANNOUNCE before saving Xで告知する and リンクをコピー do nothing (no clipboard, no window)', async () => {
  const app = makeApp();
  useNewLiveRoutes(app);
  app.addLive();
  await app.elements.get('live-manual-entry-btn').dispatch('click');
  assert.equal(await app.copyLiveLinkFromModal(), false);
  assert.equal(app.clipboardWrites.length, 0);
  assert.equal(app.buildXIntentUrlFromModal(), '');
  assert.deepEqual(app.openedUrls, []);
});

// ---- T46-IMAGE ------------------------------------------------------------------------------------------
test('T46-IMAGE the flyer is the first block of the public content: unselected shows a dashed frame and 画像を選ぶ', async () => {
  const app = makeApp();
  useRoutes(app);
  await openLive(app, 'fx-live-past-3', 'past');
  const html = bodyHtml(app);
  assert.match(html, /id="edit-image-placeholder"[^>]*>未選択<\//);
  assert.match(html, /id="edit-image-select-btn"[^>]*>画像を選ぶ<\/button>/);
  assert.doesNotMatch(html, /id="edit-image-clear-btn"/);
  assert.ok(idsInOrder(html).indexOf('edit-image') < idsInOrder(html).indexOf('edit-date'));
});

test('T46-IMAGE a registered flyer shows the picture (pressing it saves it), 画像を変える and 画像を外す', async () => {
  const app = makeApp();
  useRoutes(app);
  await openLive(app, 'fx-live-long', 'upcoming');
  const html = bodyHtml(app);
  assert.match(html, /<a class="image-download-link"[^>]*download="fixture-long\.jpg"[^>]*aria-label="画像を保存"/);
  assert.match(html, /id="edit-image-select-btn"[^>]*>画像を変える<\/button>/);
  assert.match(html, /id="edit-image-clear-btn"[^>]*>画像を外す<\/button>/);
  assert.equal(app.clearImage('edit-image'), true);
  assert.equal(app.elements.get('edit-image').value, '');
  assert.match(app.elements.get('edit-image-preview-container').innerHTML, /未選択/);
  assert.equal(app.getLiveEditorState().dirty, true, 'removing the flyer is an unsaved change');
});

class FakeFileReader {
  readAsDataURL() { setImmediate(() => this.onload({ target: { result: 'data:image/png;base64,AAAA' } })); }
}
function selectFlyer(app) {
  const file = Object.assign(new Blob(['x'], { type: 'image/png' }), { name: 'flyer.png' });
  const input = { files: [file] };
  return app.handleImageSelect(input, 'edit-image');
}

test('T46-IMAGE while the flyer uploads the status says アップロードしています…; a failure says 画像をアップロードできませんでした with the reason and keeps the old flyer', async () => {
  const app = loadAdminApp({ liveOperations: undefined });
  app.setFileReader(FakeFileReader);
  app.setApiMode(true);
  app.setSiteData(app.normalizeSiteData(structuredClone(fixture.data)));
  app.setSavedBaseline(plain(app.getSiteData()));
  app.setupLiveWorkspace(); app.renderLive();
  const gate = deferred();
  app.useAdminFetch(async (path) => (path === '/api/admin/upload-image' ? gate.promise : jsonResponse({ reservations: [] })));
  await openLive(app, 'fx-live-long', 'upcoming');
  const before = app.elements.get('edit-image').value;
  selectFlyer(app);
  await flushAsync();
  assert.equal(app.elements.get('edit-image-path').textContent, 'アップロードしています…');
  gate.resolve(jsonResponse({ error: 'ファイルが大きすぎます' }, { ok: false, status: 413 }));
  await flushAsync(); await flushAsync();
  assert.match(app.elements.get('edit-image-path').textContent, /^画像をアップロードできませんでした/);
  assert.match(app.elements.get('edit-image-path').textContent, /ファイルが大きすぎます/);
  assert.equal(app.elements.get('edit-image').value, before, 'the current flyer stays');
});

test('T46-IMAGE the other tabs use the same three words as the Live flyer since #47 (they said 画像を選択 / 削除)', () => {
  const app = makeApp();
  app.addNews();
  const html = app.elements.get('news-editor-body').innerHTML;
  assert.match(html, />画像を選ぶ</);
  assert.match(html, /未選択/);
  assert.doesNotMatch(html, /画像を選択|タップして画像を選択|>削除</);
  assert.doesNotMatch(html, /画像を変える/, 'no picture yet, so not 画像を変える');
  assert.match(app.getImageFormHtml('assets/images/x.jpg', 'site-hero-image'), />画像を変える<[\s\S]*>画像を外す</);
});

// ======================================================================================================
// Stage 6: reservations of one Live, one reservation, 取り置き, 予約管理, and the passphrase
// ======================================================================================================
const LIVE_ID = 'fx-live-long';
const reservationRows = () => structuredClone(fixture.reservations[LIVE_ID]);
const fakeTarget = (attrs) => {
  const key = Object.keys(attrs)[0];
  const node = { dataset: attrs, closest(selector) { return selector.includes(`data-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`) ? node : null; } };
  return { target: node, preventDefault() {} };
};
const click = (app, attrs) => app.handleReservationViewAction(fakeTarget(attrs));
const ledgerHtml = (app) => app.elements.get('live-reservation-ledger').innerHTML;
const detailHtml = (app) => app.elements.get('live-reservation-detail').innerHTML;
const manualFields = (app, values = {}) => {
  const all = { 'manual-reservation-name': '架空 四郎', 'manual-reservation-quantity': '2', 'manual-reservation-contact': '', 'manual-reservation-note': '', ...values };
  for (const [id, value] of Object.entries(all)) app.elements.get(id).value = value;
};

async function openReservationTab(app, { rows = reservationRows(), ...routes } = {}) {
  const calls = useRoutes(app, { summary: summaryOf([]), rows, ...routes });
  await openLive(app, LIVE_ID, 'upcoming');
  assert.equal(app.setLiveEditorTask('reservation'), 'reservation');
  await flushAsync();
  return calls;
}

// ---- T46-RESERVE ----------------------------------------------------------------------------------------
test('T46-RESERVE the list shows the total without the cancelled one, the three filters with their counts, and a row per reservation', async () => {
  const app = makeApp();
  await openReservationTab(app);
  const html = ledgerHtml(app);
  assert.match(html, /<strong>5<\/strong>枚/, '2 + 3 seats; the cancelled 4 are left out');
  assert.match(html, />2件</);
  assert.match(html, /data-reservation-filter="pending"[^>]*>未対応 1</);
  assert.match(html, /data-reservation-filter="handled"[^>]*>対応済み 1</);
  assert.match(html, /data-reservation-filter="cancelled"[^>]*>キャンセル 1</);
  for (const row of reservationRows()) assert.match(html, new RegExp(`data-reservation-open="${row.id}"`));
  assert.match(html, /架空 太郎　2枚/);
  assert.match(html, /status-badge is-pending[^>]*>未対応</);
  assert.match(html, /status-badge is-handled[^>]*>対応済み</);
  assert.match(html, /status-badge is-cancelled[^>]*>キャンセル</);
  assert.match(bodyHtml(app), /id="live-reservation-add-btn"[^>]*>\+ 取り置きを追加<\/button>/);
});

test('T46-RESERVE a Live with no reservations says まだ予約はありません。', async () => {
  const app = makeApp();
  await openReservationTab(app, { rows: [] });
  assert.match(ledgerHtml(app), /まだ予約はありません。/);
  assert.match(ledgerHtml(app), /<strong>0<\/strong>枚/);
});

test('T46-RESERVE pressing a filter selects it, pressing it again shows every reservation', async () => {
  const app = makeApp();
  await openReservationTab(app);
  click(app, { reservationFilter: 'pending' });
  assert.equal(app.getReservationViewState().filter, 'pending');
  assert.match(ledgerHtml(app), /data-reservation-filter="pending"[^>]*aria-pressed="true"/);
  assert.match(ledgerHtml(app), /data-reservation-open="fx-res-1"/);
  assert.doesNotMatch(ledgerHtml(app), /data-reservation-open="fx-res-2"/);
  assert.match(ledgerHtml(app), /<strong>5<\/strong>枚/, 'the total does not change with the filter');
  click(app, { reservationFilter: 'pending' });
  assert.equal(app.getReservationViewState().filter, '');
  assert.match(ledgerHtml(app), /data-reservation-open="fx-res-2"/);
});

test('T46-RESERVE opening a row shows the reservation: Header ‹ 予約, name and seats, the seven lines, and the switch is hidden', async () => {
  const app = makeApp();
  await openReservationTab(app);
  click(app, { reservationOpen: 'fx-res-2', reservationScope: 'live' });
  assert.equal(app.getReservationViewState().view, 'detail');
  assert.equal(app.elements.get('live-editor-back').textContent, '‹ 予約');
  assert.equal(app.elements.get('live-editor-heading').textContent, '架空 花子　3枚');
  assert.equal(app.elements.get('live-editor-task-tabs').hidden, true);
  assert.equal(app.elements.get('live-reservation-detail').hidden, false);
  assert.equal(app.elements.get('live-reservation-list-view').hidden, true);
  const html = detailHtml(app);
  for (const label of ['ライブ', '枚数', '連絡先', '備考', '内部メモ', '受付元', '受付']) assert.ok(html.includes(`<dt>${label}</dt>`), label);
  assert.match(html, /090-0000-0000/, 'the contact of a manual reservation');
  assert.match(html, /架空の内部メモ/);
  assert.match(html, /<dd>手動<\/dd>/);
  assert.match(html, /2099\.12\.12\(Sat\) テスト会場B/);
  assert.match(html, /3枚/);
  assert.match(html, /11\/18 20:00/, 'the received time is shown in Japan time');
});

test('T46-RESERVE a web reservation shows its e-mail as the contact, its note, and no 内部メモ line when there is none', async () => {
  const app = makeApp();
  await openReservationTab(app);
  click(app, { reservationOpen: 'fx-res-1', reservationScope: 'live' });
  const html = detailHtml(app);
  assert.match(html, /taro@example\.test/);
  assert.match(html, /架空の備考/);
  assert.match(html, /<dd>Web<\/dd>/);
  assert.doesNotMatch(html, /<dt>内部メモ<\/dt>/);
  assert.equal(app.elements.get('live-editor-back').textContent, '‹ 予約');
});

test('T46-RESERVE a pending reservation offers 対応済みにする and キャンセルにする; handled and cancelled ones offer only 未対応に戻す', async () => {
  const app = makeApp();
  await openReservationTab(app);
  click(app, { reservationOpen: 'fx-res-1', reservationScope: 'live' });
  assert.match(detailHtml(app), /data-reservation-status="handled"[^>]*>対応済みにする</);
  assert.match(detailHtml(app), /data-reservation-status="cancelled"[^>]*>キャンセルにする</);
  assert.equal((detailHtml(app).match(/data-reservation-status=/g) || []).length, 2);
  for (const id of ['fx-res-2', 'fx-res-3']) {
    await app.handleLiveEditorBack();
    click(app, { reservationOpen: id, reservationScope: 'live' });
    assert.equal((detailHtml(app).match(/data-reservation-status=/g) || []).length, 1, id);
    assert.match(detailHtml(app), /data-reservation-status="pending"[^>]*>未対応に戻す</);
    assert.doesNotMatch(detailHtml(app), />キャンセルにする</);
  }
});

test('T46-RESERVE a status change posts as before, returns to the list, and refreshes the list, the summary and the count', async () => {
  const app = makeApp();
  const rows = reservationRows();
  const calls = await openReservationTab(app, { rows: () => rows });
  click(app, { reservationOpen: 'fx-res-1', reservationScope: 'live' });
  const before = { reads: calls.reads.length, summary: calls.summary };
  rows[0].status = 'handled';
  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), true);
  await flushAsync();
  assert.deepEqual(calls.statuses, [{ path: '/api/admin/ticket-reservations/fx-res-1/status', body: { status: 'handled' } }]);
  assert.equal(app.getReservationViewState().view, 'list');
  assert.equal(app.elements.get('live-editor-back').textContent, '‹ 一覧');
  assert.equal(app.elements.get('live-editor-heading').textContent, '2099.12.12(Sat) テスト会場B');
  assert.ok(calls.reads.length > before.reads, 'the ledger is read again');
  assert.equal(calls.summary, before.summary + 1);
  assert.match(ledgerHtml(app), /data-reservation-filter="pending"[^>]*>未対応 0</);
});

test('T46-RESERVE a failed status change keeps the reservation open and says 更新失敗: with the reason', async () => {
  const app = makeApp();
  const calls = await openReservationTab(app, { status: () => jsonResponse({ error: '更新できません' }, { ok: false, status: 500 }) });
  click(app, { reservationOpen: 'fx-res-1', reservationScope: 'live' });
  const reads = calls.reads.length;
  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), false);
  assert.equal(app.getReservationViewState().view, 'detail');
  assert.equal(app.elements.get('reservation-detail-error').textContent, '更新失敗: 更新できません');
  assert.equal(app.elements.get('toast').textContent, '更新失敗: 更新できません');
  assert.equal(calls.reads.length, reads, 'nothing is read again after a failure');
});

test('T46-RESERVE the back button goes from one reservation to the list, and from the list out of the Live', async () => {
  const app = makeApp();
  await openReservationTab(app);
  click(app, { reservationOpen: 'fx-res-1', reservationScope: 'live' });
  assert.equal(await app.handleLiveEditorBack(), true);
  assert.equal(app.getReservationViewState().view, 'list');
  assert.equal(app.document.body.classList.contains('is-live-editing'), true, 'still in the Live');
  assert.equal(await app.handleLiveEditorBack(), true);
  assert.equal(app.document.body.classList.contains('is-live-editing'), false, 'now out of it');
});

test('T46-RESERVE 取り置きを追加 opens its own screen; a wrong name or seat count is refused under the fields', async () => {
  const app = makeApp();
  const calls = await openReservationTab(app);
  await app.elements.get('live-reservation-add-btn').dispatch('click');
  assert.equal(app.getReservationViewState().view, 'add');
  assert.equal(app.elements.get('live-editor-back').textContent, '‹ 予約');
  assert.equal(app.elements.get('live-editor-heading').textContent, '取り置きを追加');
  assert.equal(app.elements.get('manual-reservation-form').hidden, false);
  assert.equal(app.elements.get('live-reservation-list-view').hidden, true);
  assert.match(bodyHtml(app), /id="manual-reservation-submit"[^>]*>追加する<\/button>/);
  assert.doesNotMatch(bodyHtml(app), /（任意）|手動取り置きを追加/);
  assert.equal(app.elements.get('manual-reservation-quantity').value, '1');
  manualFields(app, { 'manual-reservation-name': '', 'manual-reservation-quantity': '11' });
  assert.equal(await app.submitManualReservation(), false);
  assert.equal(app.elements.get('manual-reservation-error').textContent, 'お名前と1〜10の枚数を確認してください。');
  assert.equal(calls.statuses.length, 0);
});

test('T46-RESERVE a 取り置き sends the same body as before, returns to the list, and refreshes the ledgers and the summary', async () => {
  const app = makeApp();
  const posts = [];
  const calls = await openReservationTab(app);
  const route = app.fetchCalls;
  app.useAdminFetch(async (path, options = {}) => {
    if (path === '/api/admin/ticket-reservations' && options.method === 'POST') { posts.push(JSON.parse(options.body)); return jsonResponse({ reservation: { id: 'created' } }); }
    if (path === SUMMARY_PATH) { calls.summary += 1; return jsonResponse({ summaries: [] }); }
    return jsonResponse({ reservations: reservationRows() });
  });
  await app.elements.get('live-reservation-add-btn').dispatch('click');
  manualFields(app, { 'manual-reservation-contact': '090-0000-0000', 'manual-reservation-note': '架空のメモ' });
  const summaryBefore = calls.summary;
  assert.equal(await app.submitManualReservation(), true);
  await flushAsync();
  assert.deepEqual(posts, [{ liveId: LIVE_ID, name: '架空 四郎', quantity: 2, contact: '090-0000-0000', internalNote: '架空のメモ' }]);
  assert.equal(app.getReservationViewState().view, 'list');
  assert.equal(app.elements.get('manual-reservation-name').value, '');
  assert.equal(app.elements.get('manual-reservation-quantity').value, '1');
  assert.equal(calls.summary, summaryBefore + 1);
  assert.ok(route.length > 0);
});

test('T46-RESERVE a failed 取り置き stays on its screen, keeps the inputs and says why under them', async () => {
  const app = makeApp();
  await openReservationTab(app);
  app.useAdminFetch(async (path, options = {}) => (
    path === '/api/admin/ticket-reservations' && options.method === 'POST'
      ? jsonResponse({ error: '追加できません' }, { ok: false, status: 400 })
      : jsonResponse({ reservations: [] })
  ));
  await app.elements.get('live-reservation-add-btn').dispatch('click');
  manualFields(app);
  assert.equal(await app.submitManualReservation(), false);
  assert.equal(app.getReservationViewState().view, 'add');
  assert.equal(app.elements.get('manual-reservation-name').value, '架空 四郎');
  assert.equal(app.elements.get('manual-reservation-error').textContent, '追加できません');
  assert.equal(app.elements.get('manual-reservation-submit').textContent, '追加する');
});

test('T46-RESERVE the 予約管理 list starts on 未対応, shows name, seats, the Live and the received time, and a row opens one reservation', async () => {
  const app = makeApp();
  const calls = useRoutes(app, { summary: summaryOf([]), rows: (path) => (path.includes('status=pending') ? reservationRows().filter((row) => row.status === 'pending') : reservationRows()) });
  assert.equal(app.elements.get('tickets-status-filter').value, 'pending');
  app.renderTicketsUi();
  await app.loadTickets();
  assert.ok(calls.reads.some((path) => path.includes('status=pending') && path.includes('limit=200')));
  const html = app.elements.get('tickets-list').innerHTML;
  assert.match(html, /架空 太郎　2枚/);
  assert.match(html, /2099\.12\.12\(Sat\) テスト会場B・11\/18 19:00/);
  assert.match(html, /data-reservation-scope="cross"/);
  assert.doesNotMatch(html, /架空 花子/);
  click(app, { reservationOpen: 'fx-res-1', reservationScope: 'cross' });
  assert.equal(app.getReservationViewState().crossDetailId, 'fx-res-1');
  assert.equal(app.elements.get('tickets-list-view').hidden, true);
  assert.equal(app.elements.get('tickets-detail-view').hidden, false);
  assert.match(app.elements.get('tickets-detail').innerHTML, /data-reservation-status="handled"[^>]*>対応済みにする</);
  assert.match(adminHtml, /id="tickets-detail-back"[^>]*>‹ 予約管理<\/button>/);
});

test('T46-RESERVE changing a status from 予約管理 returns to its list; an empty list says まだ予約はありません。', async () => {
  const app = makeApp();
  const rows = reservationRows();
  const calls = useRoutes(app, { summary: summaryOf([]), rows: () => rows });
  await app.loadTickets();
  click(app, { reservationOpen: 'fx-res-1', reservationScope: 'cross' });
  rows.splice(0, rows.length);
  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), true);
  await flushAsync();
  assert.equal(app.getReservationViewState().crossDetailId, null);
  assert.equal(app.elements.get('tickets-list-view').hidden, false);
  assert.match(app.elements.get('tickets-list').innerHTML, /まだ予約はありません。/);
  assert.equal(calls.statuses.length, 1);
});

test('T46-RESERVE 予約管理 has CSVで書き出す, and the CSV route and its file name are unchanged', async () => {
  assert.match(adminHtml, /id="tickets-csv-btn"[^>]*onclick="downloadTicketsCsv\(\)"[^>]*>CSVで書き出す<\/button>/);
  assert.doesNotMatch(adminHtml, /横断予約台帳|>CSV<\/button>/);
  const app = makeApp();
  const csv = new Blob(['id,name\n1,A'], { type: 'text/csv' });
  app.useAdminFetch(async (path) => ({ ok: true, status: 200, json: async () => ({}), blob: async () => { assert.match(path, /^\/api\/admin\/ticket-reservations\.csv\?/); return csv; } }));
  await app.downloadTicketsCsv();
  assert.equal(app.createdAnchors[0].download, 'ticket_reservations.csv');
});

test('T46-RESERVE the reservation rows and the detail escape what they print and keep the status buttons delegated', () => {
  const app = makeApp();
  const dangerous = { id: 'x"\');alert(1);//', liveId: 'a', name: '<b>名前</b>', quantity: 1, status: 'pending', source: 'manual', contact: '<contact>', internalNote: '<note>', message: '<message>' };
  const row = app.renderReservationRow(dangerous, { scope: 'live' });
  const detail = app.renderReservationDetail(dangerous);
  for (const html of [row, detail]) {
    assert.doesNotMatch(html, /<b>|<contact>|<note>|<message>|onclick=/);
    assert.match(html, /x&quot;&#039;\);alert\(1\);\/\//);
  }
  assert.match(detail, /data-reservation-status="handled"/);
});

// ---- T46-AUTH -------------------------------------------------------------------------------------------
const noPassphrase = () => { throw new Error('管理トークン未設定'); };
const unauthorized = () => jsonResponse({ error: 'unauthorized' }, { ok: false, status: 401 });

test('T46-AUTH the 予約管理 list says 認証できませんでした。 when the passphrase is missing or refused, and a retry after typing it works', async () => {
  for (const failure of [noPassphrase, unauthorized]) {
    const app = makeApp();
    let attempt = 0;
    app.useAdminFetch(async () => { attempt += 1; return attempt === 1 ? failure() : jsonResponse({ reservations: reservationRows() }); });
    await app.loadTickets();
    assert.match(app.elements.get('tickets-list').innerHTML, /認証できませんでした。/);
    assert.doesNotMatch(app.elements.get('tickets-list').innerHTML, /取得失敗/);
    await app.loadTickets();
    assert.match(app.elements.get('tickets-list').innerHTML, /架空 太郎/);
  }
});

test('T46-AUTH the reservations of a Live say 認証できませんでした。 inside the list', async () => {
  for (const failure of [noPassphrase, unauthorized]) {
    const app = makeApp();
    app.useAdminFetch(async (path) => (path.startsWith('/api/admin/ticket-reservations') ? failure() : jsonResponse({})));
    await openLive(app, LIVE_ID, 'upcoming');
    await app.loadLiveReservations(LIVE_ID);
    assert.match(ledgerHtml(app), /認証できませんでした。/);
  }
});

test('T46-AUTH a status change refused for the passphrase says so next to the buttons and leaves the reservation as it was', async () => {
  const app = makeApp();
  await openReservationTab(app);
  click(app, { reservationOpen: 'fx-res-1', reservationScope: 'live' });
  app.useAdminFetch(async (path) => (/\/status$/.test(path) ? unauthorized() : jsonResponse({ reservations: reservationRows() })));
  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), false);
  assert.equal(app.elements.get('reservation-detail-error').textContent, '認証できませんでした。');
  assert.equal(app.getReservationViewState().view, 'detail');
});

test('T46-AUTH a 取り置き refused for the passphrase says so under the fields and keeps what was typed', async () => {
  const app = makeApp();
  await openReservationTab(app);
  await app.elements.get('live-reservation-add-btn').dispatch('click');
  manualFields(app);
  app.useAdminFetch(async (path, options = {}) => (options.method === 'POST' ? noPassphrase() : jsonResponse({ reservations: [] })));
  assert.equal(await app.submitManualReservation(), false);
  assert.equal(app.elements.get('manual-reservation-error').textContent, '認証できませんでした。');
  assert.equal(app.elements.get('manual-reservation-name').value, '架空 四郎');
});

test('T46-AUTH a save refused for the passphrase says 認証できませんでした。 above 保存して公開 and the changes stay', async () => {
  const app = makeApp();
  useRoutes(app, { put: unauthorized });
  await openLive(app, LIVE_ID, 'upcoming');
  await typeInto(app, 'edit-venue', 'テスト会場B2');
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.equal(app.elements.get('live-editor-save-error').textContent, '認証できませんでした。');
  assert.equal(app.elements.get('edit-venue').value, 'テスト会場B2');
  assert.equal(app.getLiveEditorState().dirty, true);
});
