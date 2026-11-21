// Issue #46 stage 1: T46-PIN and T46-FIXTURE.
// These tests were written against the code as it was before #46 changed anything (all GREEN), to fix what must not
// change: what a Live save sends, what an old-format Live looks like after a save, how a reservation changes state,
// how holds, announcement text and share URLs are built, and what the existing Worker routes answer.
// Every value comes from test/fixtures/admin-live-states.json and is synthetic.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';

import worker, { summarizeTicketReservationRows } from '../cloudflare/worker/src/worker.js';
import {
  flushAsync,
  jsonResponse,
  loadAdminApp,
  setLiveForm,
} from './support/admin-app-harness.mjs';

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const LiveOperations = require(join(repoRoot, 'assets/js/live-operations.js'));
const fixture = JSON.parse(readFileSync(join(repoRoot, 'test/fixtures/admin-live-states.json'), 'utf8'));

const SHARE_ORIGIN = 'https://1212hp.itsukimatsumoto.workers.dev';
const LIVE_KEYS_AFTER_SAVE = [
  'date', 'description', 'id', 'image', 'link', 'notes', 'openTime', 'performers', 'reservationClosed',
  'sourceText', 'startTime', 'ticket', 'ticketUrl', 'title', 'venue', 'xComment',
];

// admin/app.js runs in a vm context, so its objects have another realm's prototypes; compare plain copies.
const plain = (value) => JSON.parse(JSON.stringify(value));

function makeApp({ api = false, data = fixture.data } = {}) {
  const app = loadAdminApp();
  app.setApiMode(api);
  app.setSiteData(app.normalizeSiteData(structuredClone(data)));
  app.setupLiveWorkspace();
  app.renderLive();
  return app;
}

function allLives(data = fixture.data) {
  return [
    ...data.live.upcoming.map((live) => ({ live, category: 'upcoming' })),
    ...data.live.past.map((live) => ({ live, category: 'past' })),
  ];
}

// An admin fetch that records every call and answers PUT / reservation routes the way the Worker does.
function useRecordingFetch(app, { rows = [], putOk = true, statusOk = true } = {}) {
  const puts = [];
  app.useAdminFetch(async (path, options = {}) => {
    if (path === '/api/admin/site-data' && options.method === 'PUT') {
      if (!putOk) return jsonResponse({ error: 'API保存に失敗しました' }, { ok: false, status: 500 });
      puts.push(JSON.parse(options.body));
      return jsonResponse({ ok: true });
    }
    if (/\/status$/.test(path) && options.method === 'POST') {
      return statusOk ? jsonResponse({ ok: true }) : jsonResponse({ error: 'status failed' }, { ok: false, status: 500 });
    }
    if (path === '/api/admin/ticket-reservations' && options.method === 'POST') {
      return jsonResponse({ ok: true, reservation: { id: 'created' } }, { status: 201 });
    }
    if (path.startsWith('/api/admin/ticket-reservations')) return jsonResponse({ reservations: rows });
    return jsonResponse({});
  });
  return puts;
}

// ---- T46-PIN (a): what saveLiveItem builds ---------------------------------------------------------
test('T46-PIN (a) saveLiveItem builds the item from the form, keeps unknown keys and goes to the head of its category', () => {
  const data = structuredClone(fixture.data);
  data.live.upcoming[1] = { ...data.live.upcoming[1], futureKey: 'kept' };
  const app = makeApp({ data });
  app.editLive('fx-live-long', 'upcoming');
  setLiveForm(app.elements, {
    'edit-date': '2026.9.5 (土)',
    'edit-title': '  架空の公演  ',
    'edit-venue': 'テスト会場Z',
    'edit-openTime': '17:00',
    'edit-startTime': '17:30',
    'edit-ticket': ' ¥2,000 + 1D ',
    'edit-notes': '※ 再入場不可\n\n※※ ドリンク代が必要\n  ',
    'edit-performers': '架空A / w. 架空B',
    'edit-description': '保存する説明',
    'edit-image': 'assets/images/fixture-new.jpg',
    'edit-link': 'https://example.test/live/z',
    'edit-sourceText': '元情報の全文',
    'edit-ticketUrl': ' https://tickets.example.test/z ',
    'edit-xComment': 'ひとこと',
  });
  app.elements.get('edit-reservationClosed').checked = true;

  const result = app.saveLiveItem();

  assert.equal(result.category, 'upcoming');
  assert.deepEqual(plain(result.item), {
    ...data.live.upcoming[1],
    id: 'fx-live-long',
    date: '2026-09-05',
    title: '  架空の公演  ',
    venue: 'テスト会場Z',
    openTime: '17:00',
    startTime: '17:30',
    ticket: '¥2,000 + 1D',
    notes: '再入場不可\nドリンク代が必要',
    performers: '架空A / 架空B',
    description: '保存する説明',
    image: 'assets/images/fixture-new.jpg',
    link: 'https://example.test/live/z',
    sourceText: '元情報の全文',
    ticketUrl: 'https://tickets.example.test/z',
    reservationClosed: true,
    xComment: 'ひとこと',
    futureKey: 'kept',
  });
  const upcoming = app.getSiteData().live.upcoming;
  assert.deepEqual(plain(upcoming).map((live) => live.id), ['fx-live-long', 'fx-live-today'], 'the saved Live is at the head of its category');
  assert.equal(upcoming.filter((live) => live.id === 'fx-live-long').length, 1);
});

test('T46-PIN (a) saveLiveItem keeps the original description when the field is absent and moves the Live to the other category', () => {
  const app = makeApp();
  app.editLive('fx-live-today', 'upcoming');
  setLiveForm(app.elements, { isPast: true, 'edit-date': '2026-11-20', 'edit-venue': 'テスト会場A' });
  app.elements.delete('edit-description');

  const result = app.saveLiveItem();

  assert.equal(result.category, 'past');
  assert.equal(result.item.description, fixture.data.live.upcoming[0].description);
  const live = app.getSiteData().live;
  assert.equal(live.upcoming.some((item) => item.id === 'fx-live-today'), false, 'removed from the original category');
  assert.equal(live.past[0].id, 'fx-live-today', 'head of the destination category');
  assert.equal(live.past.length, fixture.data.live.past.length + 1);
});

// ---- T46-PIN (b): an old-format Live opened and saved without any change ---------------------------
test('T46-PIN (b) opening and saving an old 7-key Live without a change gives the same key set and values every time', () => {
  const app = makeApp();
  const expected = {
    'fx-live-old-1': { date: '2025-05-05', ticketUrl: '' },
    'fx-live-old-2': { date: '2025-05-04', ticketUrl: '' }, // the declared weekday (月) was wrong; only the date survives
    'fx-live-old-3': { date: '2025-04-20', ticketUrl: 'https://forms.example.test/reserve/old-3' }, // the existing rule only
    'fx-live-old-4': { date: '2025-03-09', ticketUrl: '' },
  };
  for (const [id, change] of Object.entries(expected)) {
    const original = fixture.data.live.past.find((live) => live.id === id);
    assert.equal(Object.keys(original).length, 7, `${id} is a 7-key old-format Live`);
    app.editLive(id, 'past');
    const saved = app.saveLiveItem().item;
    assert.deepEqual(Object.keys(saved).sort(), LIVE_KEYS_AFTER_SAVE, id);
    assert.deepEqual(plain(saved), {
      id,
      date: change.date,
      title: original.title,
      venue: original.venue,
      openTime: '',
      startTime: '',
      ticket: '',
      notes: '',
      performers: '',
      description: original.description,
      image: original.image,
      link: original.link,
      sourceText: '',
      ticketUrl: change.ticketUrl,
      reservationClosed: false,
      xComment: '',
    }, id);
  }
});

test('T46-PIN (b) a full 14-key Live gains only sourceText and xComment, and only a date written another way changes', () => {
  const app = makeApp();
  for (const { live, category } of allLives().filter(({ live }) => Object.keys(live).length === 14)) {
    app.editLive(live.id, category);
    const saved = plain(app.saveLiveItem().item);
    const changed = Object.keys(saved).filter((key) => JSON.stringify(saved[key]) !== JSON.stringify(live[key])).sort();
    const allowed = ['date', 'notes', 'sourceText', 'xComment'];
    assert.ok(changed.every((key) => allowed.includes(key)), `${live.id}: ${changed.join(',')}`);
    assert.ok(['sourceText', 'xComment'].every((key) => changed.includes(key)), live.id);
    assert.equal(saved.sourceText, '');
    assert.equal(saved.xComment, '');
  }
});

// ---- T46-PIN (c): the PUT of a Live save -----------------------------------------------------------
test('T46-PIN (c) a Live save PUTs /api/admin/site-data as JSON and keeps every other key of the data', async () => {
  const app = makeApp({ api: true });
  const initial = plain(app.getSiteData());
  const puts = useRecordingFetch(app);
  app.editLive('fx-live-long', 'upcoming');
  setLiveForm(app.elements, { 'edit-date': '2099-12-12', 'edit-venue': 'テスト会場B', 'edit-title': '保存で変えたタイトル' });

  assert.equal(await app.saveLiveWorkspace(), true);

  const calls = app.fetchCalls.filter((call) => call.options.method === 'PUT');
  assert.equal(calls.length, 1, 'one PUT');
  assert.equal(calls[0].path, '/api/admin/site-data');
  assert.equal(typeof calls[0].options.body, 'string');
  assert.equal(puts.length, 1);
  const body = puts[0];
  for (const key of ['live', 'site', 'discography', 'youtube', 'profile', 'ticket', 'contact', 'news']) assert.ok(key in body, key);
  for (const key of ['site', 'discography', 'youtube', 'profile', 'ticket', 'contact', 'news']) assert.deepEqual(body[key], initial[key], key);
  assert.equal(body.live.ticketLink, initial.live.ticketLink, 'live.ticketLink is carried');
  assert.equal(body.site.heroImage, initial.site.heroImage, 'site.heroImage is carried');
  assert.equal(body.site.featuredReleaseId, initial.site.featuredReleaseId);
  assert.equal(body.live.upcoming[0].id, 'fx-live-long');
  assert.equal(body.live.upcoming[0].title, '保存で変えたタイトル');
  assert.deepEqual(body.live.upcoming.slice(1), initial.live.upcoming.filter((live) => live.id !== 'fx-live-long'));
  assert.deepEqual(body.live.past, initial.live.past, 'the other category is unchanged');
});

test('T46-PIN (c) a Live save in Local Mode never calls the API: it marks the data changed for the JSON export', async () => {
  const app = makeApp({ api: false });
  app.editLive('fx-live-long', 'upcoming');
  setLiveForm(app.elements, { 'edit-date': '2099-12-12', 'edit-venue': 'テスト会場B' });

  assert.equal(await app.saveLiveWorkspace(), true);

  assert.equal(app.fetchCalls.length, 0);
  assert.equal(app.elements.get('live-editor-save-status').textContent, 'JSON書き出し待ち');
  assert.equal(app.getHasChanges(), true);
  assert.match(app.elements.get('saveBtn').textContent, /JSONを書き出す/);
});

test('T46-PIN (c) a failed Live save restores the data, keeps the editor and its input, and says it failed', async () => {
  const app = makeApp({ api: true });
  const initial = plain(app.getSiteData());
  useRecordingFetch(app, { putOk: false });
  app.editLive('fx-live-long', 'upcoming');
  setLiveForm(app.elements, { 'edit-date': '2099-12-12', 'edit-venue': 'テスト会場B', 'edit-title': '失敗する保存' });

  assert.equal(await app.saveLiveWorkspace(), false);

  assert.deepEqual(plain(app.getSiteData()), initial, 'the data is back to what it was');
  assert.equal(app.elements.get('edit-title').value, '失敗する保存', 'the input stays');
  assert.equal(app.elements.get('live-editor-save-status').textContent, '保存できませんでした'); // wording changed by #46 (was 保存失敗)
  assert.equal(app.getModalState().currentEditId, 'fx-live-long', 'the editor stays open');
});

test('T46-PIN (c) a save with a missing date or venue is refused before anything is sent', async () => {
  const app = makeApp({ api: true });
  useRecordingFetch(app);
  app.editLive('fx-live-long', 'upcoming');
  setLiveForm(app.elements, { 'edit-date': '', 'edit-venue': 'テスト会場B' });
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.equal(app.elements.get('edit-date-error').textContent, '日付を入力してください。');
  setLiveForm(app.elements, { 'edit-date': '2099-12-12', 'edit-venue': '' });
  assert.equal(await app.saveLiveWorkspace(), false);
  assert.equal(app.elements.get('edit-venue-error').textContent, '会場を入力してください。');
  assert.equal(app.fetchCalls.some((call) => call.options.method === 'PUT'), false);
});

// ---- T46-PIN (d): delete ----------------------------------------------------------------------------
// #46 changed how a delete is confirmed (a confirmation surface instead of the browser confirm) and that it is saved on the
// spot. What stays pinned: the Live leaves the data and a later save of the data carries that.
async function deleteLive(app, id, category) {
  assert.equal(app.editLive(id, category), true);
  const pending = app.deleteLiveFromWorkspace();
  await flushAsync();
  await app.elements.get('live-dialog-action-delete').dispatch('click');
  return pending;
}

test('T46-PIN (d) deleting a Live removes it from the data and the data that is PUT afterwards no longer has it', async () => {
  const app = makeApp({ api: true });
  const initial = plain(app.getSiteData());
  const puts = useRecordingFetch(app);

  assert.equal(await deleteLive(app, 'fx-live-past-1', 'past'), true);
  // #47 (D47-08): the delete was saved on the spot (#46); the header save no longer exists while the API is connected and sends nothing more
  assert.equal(await app.invokeSaveData({ silent: true }), false);

  assert.equal(puts.length, 1, 'the delete itself is the one PUT');
  const body = puts[puts.length - 1];
  assert.deepEqual(body.live.past.map((live) => live.id), initial.live.past.filter((live) => live.id !== 'fx-live-past-1').map((live) => live.id));
  assert.deepEqual(body.live.upcoming, initial.live.upcoming);
  for (const key of ['site', 'discography', 'youtube', 'profile', 'ticket', 'contact', 'news']) assert.deepEqual(body[key], initial[key], key);
  assert.equal(app.getSiteData().live.past.some((live) => live.id === 'fx-live-past-1'), false);
  assert.equal(app.getModalState().currentEditId, null, 'the editor is closed');
});

// ---- T46-PIN (e): reservation status and totals -----------------------------------------------------
test('T46-PIN (e) a status change POSTs the status and then refreshes both ledgers; it does not touch the data', async () => {
  const app = makeApp({ api: true });
  useRecordingFetch(app, { rows: fixture.reservations['fx-live-long'] });
  app.editLive('fx-live-long', 'upcoming');
  await flushAsync();
  app.fetchCalls.length = 0;

  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), true);

  const post = app.fetchCalls.find((call) => call.options.method === 'POST');
  assert.equal(post.path, '/api/admin/ticket-reservations/fx-res-1/status');
  assert.deepEqual(JSON.parse(post.options.body), { status: 'handled' });
  const reads = app.fetchCalls.filter((call) => !call.options.method || call.options.method === 'GET').map((call) => call.path);
  assert.ok(reads.some((path) => path.startsWith('/api/admin/ticket-reservations?') && path.includes('liveId=fx-live-long') && path.includes('limit=200')), 'the Live ledger is read again');
  assert.ok(reads.some((path) => path.startsWith('/api/admin/ticket-reservations?') && !path.includes('liveId=') && path.includes('limit=200')), 'the cross-Live list is read again');
  assert.equal(app.fetchCalls.some((call) => call.options.method === 'PUT'), false);
});

test('T46-PIN (e) a status id is URL-encoded, a failed change reports and reads nothing again, and Local Mode is a no-op', async () => {
  const app = makeApp({ api: true });
  useRecordingFetch(app, { statusOk: false });
  app.fetchCalls.length = 0;
  assert.equal(await app.markTicketStatus('a/b c', 'cancelled'), false);
  assert.equal(app.fetchCalls.length, 1, 'only the POST; nothing is refreshed after a failure');
  assert.equal(app.fetchCalls[0].path, '/api/admin/ticket-reservations/a%2Fb%20c/status');

  const local = makeApp({ api: false });
  assert.equal(await local.markTicketStatus('x', 'handled'), false);
  assert.equal(local.fetchCalls.length, 0);
});

test('T46-PIN (e) totals count every row except cancelled: records by row, seats by quantity, non-numeric as 0', () => {
  const app = makeApp();
  const { count, pendingEvery, cancelledEvery } = fixture.reservationsMany;
  const rows = Array.from({ length: count }, (_, index) => ({
    id: `many-${index}`,
    quantity: (index % 4) + 1,
    status: (index + 1) % cancelledEvery === 0 ? 'cancelled' : ((index + 1) % pendingEvery === 0 ? 'pending' : 'handled'),
  }));
  rows.push({ id: 'odd', quantity: 'abc', status: 'pending' });
  const active = rows.filter((row) => row.status !== 'cancelled');
  const expected = {
    records: active.length,
    seats: active.reduce((sum, row) => sum + (Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : 0), 0),
  };
  const totals = app.calculateActiveReservationTotals(rows);
  assert.deepEqual(plain({ records: totals.records, seats: totals.seats }), expected);
  assert.ok(rows.length >= 10, 'two-digit row count');
  assert.deepEqual(plain(app.calculateActiveReservationTotals([])), { records: 0, seats: 0 });
  assert.deepEqual(plain(app.calculateActiveReservationTotals(undefined)), { records: 0, seats: 0 });
});

test('T46-PIN (e) the Live ledger shows the active totals of the rows it reads', async () => {
  const app = makeApp({ api: true });
  useRecordingFetch(app, { rows: fixture.reservations['fx-live-long'] });
  app.editLive('fx-live-long', 'upcoming');
  await flushAsync();
  const html = app.elements.get('live-reservation-ledger').innerHTML;
  // Issue #46: the same active totals (cancelled left out), shown as "5枚" and "2件" (design §6).
  assert.match(html, /<strong>5<\/strong>枚/);
  assert.match(html, />2件</);
});

// ---- T46-PIN (f): manual hold -------------------------------------------------------------------------
test('T46-PIN (f) a manual hold sends only the filled keys, and refuses a missing name or a quantity outside 1-10', async () => {
  const app = makeApp({ api: true });
  useRecordingFetch(app);
  app.editLive('fx-live-long', 'upcoming');
  await flushAsync();
  const field = (id) => app.elements.get(id);

  field('manual-reservation-name').value = '架空 取り置き';
  field('manual-reservation-quantity').value = '2';
  field('manual-reservation-contact').value = '  ';
  field('manual-reservation-note').value = '';
  app.fetchCalls.length = 0;
  assert.equal(await app.submitManualReservation(), true);
  const post = app.fetchCalls.find((call) => call.options.method === 'POST');
  assert.equal(post.path, '/api/admin/ticket-reservations');
  assert.deepEqual(JSON.parse(post.options.body), { liveId: 'fx-live-long', name: '架空 取り置き', quantity: 2 });

  for (const [name, quantity] of [['', '2'], ['架空', '0'], ['架空', '11'], ['架空', '1.5'], ['架空', 'x']]) {
    field('manual-reservation-name').value = name;
    field('manual-reservation-quantity').value = quantity;
    app.fetchCalls.length = 0;
    assert.equal(await app.submitManualReservation(), false, `${name}/${quantity}`);
    assert.equal(field('manual-reservation-error').textContent, 'お名前と1〜10の枚数を確認してください。');
    assert.equal(app.fetchCalls.length, 0);
  }
});

test('T46-PIN (f) a manual hold needs the API and a saved Live', async () => {
  const local = makeApp({ api: false });
  local.editLive('fx-live-long', 'upcoming');
  assert.equal(await local.submitManualReservation(), false);
  assert.equal(local.elements.get('manual-reservation-error').textContent, '手動取り置きにはAPI接続が必要です。');

  const api = makeApp({ api: true });
  useRecordingFetch(api);
  api.addLive();
  assert.equal(await api.submitManualReservation(), false);
  assert.equal(api.elements.get('manual-reservation-error').textContent, '先にLiveを保存してください。');
  assert.equal(api.fetchCalls.some((call) => call.options.method === 'POST'), false);
});

// ---- T46-PIN (g): announcement text and share URL -----------------------------------------------------
test('T46-PIN (g) the announcement preview is buildXAnnouncementText with the saved Live and its og share URL', () => {
  const app = makeApp({ api: true });
  app.editLive('fx-live-long', 'upcoming');
  setLiveForm(app.elements, {
    'edit-date': '2099-12-12',
    'edit-title': '架空の公演 長い文',
    'edit-venue': 'テスト会場B',
    'edit-openTime': '17:30',
    'edit-startTime': '18:00',
    'edit-ticket': '¥3,000 + 1D',
    'edit-notes': '入場時にドリンク代が必要です',
    'edit-performers': '架空A / 架空B',
    'edit-xComment': 'ぜひ来てください',
  });
  app.updateXPreviewInModal();
  const preview = app.elements.get('x-post-preview').value;
  assert.equal(preview, [
    '2099.12.12(土) テスト会場B',
    '「架空の公演 長い文」',
    'OPEN / 17:30 START / 18:00\n¥3,000 + 1D\n※入場時にドリンク代が必要です',
    '-act-\n架空A\n架空B',
    'ぜひ来てください',
    '#ライブ',
    `${SHARE_ORIGIN}/og/live/fx-live-long`,
  ].join('\n\n'));
  assert.equal(preview, LiveOperations.buildXAnnouncementText({
    date: '2099-12-12', title: '架空の公演 長い文', venue: 'テスト会場B', openTime: '17:30', startTime: '18:00',
    ticket: '¥3,000 + 1D', notes: '入場時にドリンク代が必要です', performers: '架空A / 架空B',
  }, 'ぜひ来てください', `${SHARE_ORIGIN}/og/live/fx-live-long`));
});

test('T46-PIN (g) the share URL encodes the id and a new Live has none', () => {
  const data = structuredClone(fixture.data);
  data.live.upcoming.push({ id: 'fx live/space', date: '2099-01-01', venue: 'テスト会場J', title: '架空' });
  const app = makeApp({ api: true, data });
  app.editLive('fx live/space', 'upcoming');
  app.updateXPreviewInModal();
  assert.ok(app.elements.get('x-post-preview').value.endsWith(`${SHARE_ORIGIN}/og/live/fx%20live%2Fspace`));

  app.addLive();
  app.updateXPreviewInModal();
  assert.equal(app.elements.get('x-post-preview').value.includes('/og/live/'), false, 'a Live that is not saved has no share URL');
});

// ---- T46-PIN (h): Ticket Page common settings, as saved data -------------------------------------------
test('T46-PIN (h) the saved Ticket settings are completeText and the six fields only, with no introText or noticeText', async () => {
  const data = structuredClone(fixture.data);
  data.ticket.introText = '旧案内';
  data.ticket.noticeText = '旧注意';
  const app = makeApp({ api: true, data });
  assert.equal('introText' in app.getSiteData().ticket, false);
  assert.equal('noticeText' in app.getSiteData().ticket, false);
  const next = plain(app.getSiteData());
  next.ticket.completeText = '変えた完了文';
  next.ticket.fields.showQuantity = false;
  next.ticket.fields.submitLabel = '送る';
  app.setSiteData(next);
  const puts = useRecordingFetch(app);

  await app.saveToApi();

  assert.deepEqual(Object.keys(puts[0].ticket).sort(), ['completeText', 'fields']);
  assert.deepEqual(Object.keys(puts[0].ticket.fields).sort(), ['labelMessage', 'labelQuantity', 'placeholderMessage', 'showMessage', 'showQuantity', 'submitLabel']);
  assert.equal(puts[0].ticket.completeText, '変えた完了文');
  assert.equal(puts[0].ticket.fields.showQuantity, false);
  assert.deepEqual(puts[0].contact, fixture.data.contact);
});

test('T46-PIN (h) the settings screen reads the seven values out of the saved ticket data', () => {
  const app = makeApp();
  app.renderTicketSettings();
  const ticket = fixture.data.ticket;
  assert.equal(app.elements.get('ticket-complete-text').value, ticket.completeText);
  assert.equal(app.elements.get('ticket-field-quantity').checked, true);
  assert.equal(app.elements.get('ticket-field-message').checked, true);
  assert.equal(app.elements.get('ticket-field-label-quantity').value, ticket.fields.labelQuantity);
  assert.equal(app.elements.get('ticket-field-label-message').value, ticket.fields.labelMessage);
  assert.equal(app.elements.get('ticket-field-placeholder-message').value, ticket.fields.placeholderMessage);
  assert.equal(app.elements.get('ticket-field-submit-label').value, ticket.fields.submitLabel);
});

// ---- T46-PIN (i): the draft creation contract is pinned by the existing tests -------------------------
test('T46-PIN (i) the existing AI source-intake tests stay in place (they pin the request, the ten fields and the failure keep)', () => {
  const source = readFileSync(join(repoRoot, 'test/admin-live-operations.test.mjs'), 'utf8');
  for (const title of [
    'source intake posts the exact source once, replaces all ten fields including empty strings, and never parses or saves',
    'source intake keeps every field and preview unchanged for HTTP, network, JSON, or schema failure',
    'source intake never falls back from a custom API base to canonical production',
    'source intake fails atomically when one of the ten destination fields is missing',
  ]) assert.ok(source.includes(title), title);
});

// ---- T46-PIN (j): what the existing Worker routes answer ------------------------------------------------
function createD1Stub({ rows = [] } = {}) {
  const calls = [];
  const DB = {
    prepare(sql) {
      const call = { sql: String(sql), bindings: [] };
      calls.push(call);
      const statement = {
        bind(...bindings) { call.bindings = bindings; return statement; },
        async first() { return null; },
        async all() { return { results: rows }; },
        async run() { return { success: true, meta: { changes: 1 } }; },
      };
      return statement;
    },
  };
  return { DB, calls };
}
const workerEnv = (DB) => ({ DB, ADMIN_SHARED_TOKEN: 'fixture-admin-token' });
function workerRequest(path, { method = 'GET', body, authenticated = true } = {}) {
  const headers = {};
  if (authenticated) headers.Authorization = 'Bearer fixture-admin-token';
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(`https://worker.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const LIST_COLUMNS = ['id', 'liveId', 'liveDate', 'liveVenue', 'name', 'email', 'quantity', 'message', 'status', 'createdAt', 'updatedAt', 'source', 'contact', 'internalNote'];

test('T46-PIN (j) GET /api/admin/ticket-reservations answers { reservations } and 401 without a token before reading the DB', async () => {
  const rows = [{ id: 'r1', liveId: 'fx-live-long', liveDate: '2099.12.12', liveVenue: 'テスト会場B', name: '架空', email: '', quantity: 1, message: '', status: 'pending', createdAt: 'x', updatedAt: 'y', source: 'web', contact: null, internalNote: null }];
  const ok = createD1Stub({ rows });
  const response = await worker.fetch(workerRequest('/api/admin/ticket-reservations?liveId=fx-live-long&status=pending&limit=200'), workerEnv(ok.DB), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reservations: rows });
  const sql = ok.calls[0].sql.replace(/\s+/g, ' ');
  for (const column of ['live_id as liveId', 'internal_note as internalNote', "COALESCE(source, 'web') as source"]) assert.ok(sql.includes(column), column);
  assert.deepEqual(ok.calls[0].bindings, ['fx-live-long', 'pending', 200]);
  assert.equal(LIST_COLUMNS.length, 14);

  const denied = createD1Stub();
  const unauthorized = await worker.fetch(workerRequest('/api/admin/ticket-reservations', { authenticated: false }), workerEnv(denied.DB), {});
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), { error: 'unauthorized' });
  assert.equal(denied.calls.length, 0);
});

test('T46-PIN (j) POST .../status answers { ok, updated } and 400 for an unknown status; the CSV is an attachment', async () => {
  const d1 = createD1Stub();
  const response = await worker.fetch(workerRequest('/api/admin/ticket-reservations/fx-res-1/status', { method: 'POST', body: { status: 'handled' } }), workerEnv(d1.DB), {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.deepEqual(Object.keys(payload.updated).sort(), ['id', 'status', 'updatedAt']);
  assert.equal(payload.updated.id, 'fx-res-1');
  assert.equal(payload.updated.status, 'handled');
  assert.deepEqual(d1.calls[0].bindings.slice(0, 1), ['handled']);

  const bad = await worker.fetch(workerRequest('/api/admin/ticket-reservations/fx-res-1/status', { method: 'POST', body: { status: 'done' } }), workerEnv(createD1Stub().DB), {});
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: 'invalid status' });

  const csv = await worker.fetch(workerRequest('/api/admin/ticket-reservations.csv?limit=200'), workerEnv(createD1Stub({ rows: [] }).DB), {});
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('Content-Type'), /^text\/csv/);
  assert.match(csv.headers.get('Content-Disposition'), /attachment; filename="ticket_reservations\.csv"/);
  assert.match(await csv.text(), /^id,status,createdAt,updatedAt,liveId,liveDate,liveVenue,name,email,quantity/);
});

test('T46-PIN (j) the site-data admin routes refuse a missing token with 401 and never read the DB; an unknown path is 404', async () => {
  for (const method of ['GET', 'PUT']) {
    const d1 = createD1Stub();
    const response = await worker.fetch(workerRequest('/api/admin/site-data', { method, body: method === 'PUT' ? {} : undefined, authenticated: false }), workerEnv(d1.DB), {});
    assert.equal(response.status, 401, method);
    assert.deepEqual(await response.json(), { error: 'unauthorized' });
    assert.equal(d1.calls.length, 0, method);
  }
  const missing = await worker.fetch(workerRequest('/api/admin/fixture-unknown-route'), workerEnv(createD1Stub().DB), {});
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'not found' });
});

test('T46-PIN (j) OPTIONS answers 204 and the CORS headers allow GET, PUT, POST and OPTIONS', async () => {
  const response = await worker.fetch(new Request('https://worker.test/api/admin/ticket-reservations', {
    method: 'OPTIONS',
    headers: { Origin: 'http://127.0.0.1:8080', 'Access-Control-Request-Method': 'GET' },
  }), workerEnv(createD1Stub().DB), {});
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, PUT, POST, OPTIONS');
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Authorization, Content-Type, X-Admin-Token');
});

// ---- T46-FIXTURE ------------------------------------------------------------------------------------
test('T46-FIXTURE the fixture has the required shapes, counts and cases', () => {
  assert.deepEqual(Object.keys(fixture), ['meta', 'data', 'reservations', 'reservationsMany', 'summary', 'scenarios', 'sites']);
  assert.deepEqual(Object.keys(fixture.scenarios), [
    'base', 'legacy-only', 'no-reservations', 'many-reservations', 'summary-404', 'summary-401', 'summary-500',
    'api-fallback', 'local-mode', 'save-fail', 'delete-fail', 'status-fail', 'draft-fail', 'empty-lists',
  ]);
  const { upcoming, past } = fixture.data.live;
  assert.ok(upcoming.length >= 2 && past.length >= 6);
  const sizes = new Set(allLives().map(({ live }) => Object.keys(live).length));
  assert.deepEqual([...sizes].sort((a, b) => a - b), [7, 14], 'the complete 14-key form and the 7-key old form');
  assert.ok(allLives().some(({ live }) => Object.keys(live).length === 14 && live.description === ''), 'empty description');
  assert.ok(allLives().some(({ live }) => Object.keys(live).length === 14 && live.openTime === '' && live.startTime === ''), 'empty times');
  assert.ok(allLives().some(({ live }) => live.title === ''), 'empty title');
  assert.ok(allLives().some(({ live }) => live.image === ''), 'no flyer');
  assert.ok(allLives().some(({ live }) => /^https:\/\//.test(live.image)) && allLives().some(({ live }) => /^assets\//.test(live.image)), 'absolute URL and relative path flyers');
  assert.ok(allLives().some(({ live }) => live.date === fixture.meta.today), 'a Live dated today');
  assert.ok(allLives().some(({ live }) => /^\d{4}-\d{2}-\d{2}$/.test(live.date)) && allLives().some(({ live }) => /^\d{4}\.\d{1,2}\.\d{1,2}$/.test(live.date)) && allLives().some(({ live }) => /\([日月火水木金土]\)$/.test(live.date)), 'three ways to write a date');
  const prices = allLives().map(({ live }) => live.ticket);
  assert.ok(prices.some((value) => value?.startsWith('¥')) && prices.some((value) => value && !value.startsWith('¥') && value !== 'free') && prices.includes('free') && prices.includes(''), 'price styles');
  const titles = allLives().map(({ live }) => live.title).filter(Boolean);
  assert.ok(new Set(titles).size < titles.length, 'a duplicate title');
  assert.ok(Math.max(...allLives().map(({ live }) => (live.description || '').length)) >= 130, '130-character description');
  assert.ok(Math.max(...allLives().map(({ live }) => (live.performers || '').length)) >= 100, '100-character performers');
  assert.ok(fixture.data.live.ticketLink, 'live.ticketLink');
  assert.ok(fixture.data.site.heroImage && fixture.data.site.featuredReleaseId, '#41 site items');
  assert.ok(fixture.data.discography.digital[0].releaseType && fixture.data.discography.digital[0].playbackVideoId && fixture.data.discography.digital[0].releaseDate, '#41 release items');
  assert.equal(new Set(allLives().map(({ live }) => live.id)).size, allLives().length, 'ids are unique');
});


test('T46-FIXTURE the whole-site variants used by the scenarios exist: legacy-only (7-key lives) and empty lists', () => {
  const named = Object.entries(fixture.scenarios).map(([, scenario]) => scenario.site).filter((site) => site !== 'data');
  assert.deepEqual([...new Set(named)].sort(), Object.keys(fixture.sites).filter((key) => key !== 'note').sort(), 'every site a scenario names is defined');
  const legacy = fixture.sites.legacyOnly.live;
  assert.ok(legacy.upcoming.length >= 1 && legacy.past.length >= 3);
  for (const live of [...legacy.upcoming, ...legacy.past]) assert.equal(Object.keys(live).length, 7, `${live.id} has the 7-key old form`);
  assert.equal(fixture.sites.emptyLists.live.upcoming.length, 0);
  assert.equal(fixture.sites.emptyLists.live.past.length, 0);
  assert.equal(fixture.sites.emptyLists.live.ticketLink, fixture.data.live.ticketLink);
  const app = loadAdminApp();
  for (const key of ['legacyOnly', 'emptyLists']) {
    const data = structuredClone(fixture.data);
    data.live = structuredClone(fixture.sites[key].live);
    const normalized = app.normalizeSiteData(data);
    assert.equal(normalized.live.ticketLink, fixture.data.live.ticketLink, `${key} keeps live.ticketLink`);
    assert.equal(normalized.live.upcoming.length, fixture.sites[key].live.upcoming.length);
  }
});
test('T46-FIXTURE the reservation rows and the expected summary follow the rule', () => {
  const rows = Object.values(fixture.reservations).flat();
  const statuses = new Set(rows.map((row) => row.status));
  for (const status of ['pending', 'handled', 'cancelled']) assert.ok(statuses.has(status), status);
  assert.ok(rows.some((row) => row.source === 'manual' && row.contact && row.internalNote), 'a manual row with contact and note');
  assert.ok(rows.some((row) => row.source === 'web' && row.email && row.message), 'a web row with e-mail and note');
  assert.ok(fixture.reservationsMany.count >= 10, 'a two-digit row set');
  assert.deepEqual(fixture.reservations['fx-live-today'], [], 'a Live with no reservation');

  const byLive = new Map();
  for (const row of fixture.summary.groupedRows) {
    if (row.status === 'cancelled') continue;
    const entry = byLive.get(row.liveId) || { liveId: row.liveId, seats: 0, records: 0, pending: 0 };
    entry.seats += Number(row.seats) || 0;
    entry.records += row.records;
    if (row.status === 'pending') entry.pending += row.records;
    byLive.set(row.liveId, entry);
  }
  const expected = [...byLive.values()].sort((a, b) => (a.liveId < b.liveId ? -1 : 1));
  assert.deepEqual(fixture.summary.expected, expected);
  assert.equal(fixture.summary.groupedRows.some((row) => row.liveId === 'fx-live-past-3'), true, 'a Live with cancelled rows only');
  assert.equal(expected.some((entry) => entry.liveId === 'fx-live-past-3'), false);
  const app = makeApp();
  for (const entry of expected) {
    const totals = app.calculateActiveReservationTotals(fixture.reservations[entry.liveId]);
    assert.deepEqual(plain({ records: totals.records, seats: totals.seats }), { records: entry.records, seats: entry.seats }, entry.liveId);
    assert.equal(fixture.reservations[entry.liveId].filter((row) => row.status === 'pending').length, entry.pending, entry.liveId);
  }
});

test('T46-FIXTURE every Live renders, opens, saves and reopens without an error and with the values it was saved with', () => {
  const app = makeApp();
  assert.equal(app.elements.get('live-upcoming-list').children.length, fixture.data.live.upcoming.length);
  assert.equal(app.elements.get('live-past-list').children.length, fixture.data.live.past.length);
  const fields = {
    date: 'edit-date', title: 'edit-title', venue: 'edit-venue', openTime: 'edit-openTime', startTime: 'edit-startTime',
    ticket: 'edit-ticket', notes: 'edit-notes', performers: 'edit-performers', description: 'edit-description',
    image: 'edit-image', link: 'edit-link', ticketUrl: 'edit-ticketUrl', sourceText: 'edit-sourceText', xComment: 'edit-xComment',
  };
  for (const { live, category } of allLives()) {
    assert.equal(app.editLive(live.id, category), true, live.id);
    // Issue #46 (F46-21): the 説明 field is always mounted inside 予約先・リンクなど; it opens empty when the Live has no description.
    for (const [key, id] of Object.entries(fields)) {
      const element = app.elements.get(id);
      assert.ok(element, `${live.id} ${id}`);
      if (key === 'description' && !live.description) assert.equal(element.value, '', `${live.id} the description field opens empty`);
      // A missing ticketUrl opens with what the existing rule infers from the old link (and nothing otherwise).
      const absentValue = key === 'ticketUrl' ? LiveOperations.getTicketUrl(live) : '';
      if (!(key in live)) assert.equal(element.value, absentValue, `${live.id} ${id} opens empty when the key is absent`);
    }
    const saved = app.saveLiveItem().item;
    assert.equal(saved.description, live.description ?? '', `${live.id} description survives a save`);
    // editLive on the Live that is already open is a no-op, so close the editor first to really reopen it.
    assert.equal(app.closeLiveEditor(), true);
    assert.equal(app.editLive(live.id, category), true);
    for (const [key, id] of Object.entries(fields)) {
      const value = app.elements.get(id).value;
      let expected = saved[key];
      if (key === 'date') expected = LiveOperations.normalizeLiveDateInput(saved.date);
      assert.equal(value, expected ?? '', `${live.id} reopened ${key}`);
    }
    assert.equal(app.elements.get('edit-reservationClosed').checked, Boolean(saved.reservationClosed), `${live.id} reservationClosed`);
    assert.equal(app.elements.get('edit-isPast').checked, category === 'past', `${live.id} category`);
  }
});

test('T46-FIXTURE the 130-character description and 100-character performers survive a save unchanged', () => {
  const app = makeApp();
  app.editLive('fx-live-long', 'upcoming');
  const saved = app.saveLiveItem().item;
  assert.equal(saved.description, fixture.data.live.upcoming[1].description);
  assert.equal(saved.performers, fixture.data.live.upcoming[1].performers);
});

test('T46-FIXTURE nothing in the fixture points at production: every URL is example.test or a relative path', () => {
  const text = readFileSync(join(repoRoot, 'test/fixtures/admin-live-states.json'), 'utf8');
  for (const match of text.matchAll(/https?:\/\/([^/\s"]+)/g)) assert.match(match[1], /(^|\.)example\.test$/, match[0]);
  assert.doesNotMatch(text, /1212hp|workers\.dev|itsuki|matsumoto|giftee/i);
  assert.doesNotMatch(text, /@(?!example\.test)/, 'e-mail addresses use example.test');
});

// ---- T46-SUM (admin side): the Worker's counting rule and the ledger total are the same rule ------------
test('T46-SUM the Worker summary and calculateActiveReservationTotals give the same seats and records for the same rows', () => {
  const app = makeApp();
  const { count, pendingEvery, cancelledEvery } = fixture.reservationsMany;
  const many = Array.from({ length: count }, (_, index) => ({
    id: `many-${index}`,
    liveId: 'fx-live-many',
    quantity: (index % 4) + 1,
    status: (index + 1) % cancelledEvery === 0 ? 'cancelled' : ((index + 1) % pendingEvery === 0 ? 'pending' : 'handled'),
  }));
  many.push({ id: 'odd', liveId: 'fx-live-many', quantity: 'abc', status: 'pending' });
  const rows = [...Object.values(fixture.reservations).flat(), ...many];
  // The same grouping the Worker's SQL does: one row per live and status with COUNT and SUM (a non-number sums as 0).
  const grouped = new Map();
  for (const reservation of rows) {
    const key = `${reservation.liveId}\u0000${reservation.status}`;
    const entry = grouped.get(key) || { liveId: reservation.liveId, status: reservation.status, records: 0, seats: 0 };
    entry.records += 1;
    entry.seats += Number.isFinite(Number(reservation.quantity)) ? Number(reservation.quantity) : 0;
    grouped.set(key, entry);
  }
  const summaries = summarizeTicketReservationRows([...grouped.values()]);
  assert.ok(summaries.length >= 3);
  for (const summary of summaries) {
    const liveRows = rows.filter((reservation) => reservation.liveId === summary.liveId);
    const totals = app.calculateActiveReservationTotals(liveRows);
    assert.deepEqual({ seats: summary.seats, records: summary.records }, { seats: totals.seats, records: totals.records }, summary.liveId);
    assert.equal(summary.pending, liveRows.filter((reservation) => reservation.status === 'pending').length, summary.liveId);
  }
  assert.equal(summaries.find((summary) => summary.liveId === 'fx-live-many').records, many.filter((row) => row.status !== 'cancelled').length);
});
