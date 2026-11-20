import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Event, buildData, deferred, envelope, badJsonResponse, jsonResponse, loadFixture, loadPage, settle } from './support/dom-harness.mjs';

const fixture = loadFixture();
const API = 'https://1212hp.itsukimatsumoto.workers.dev';
const DRAFT_KEY = '1212hp_ticket_draft_v1';
const SKIP = ['script.js'];

function openTicket(query = '', { scenarios = [], data = buildData(fixture, ...scenarios), fetch, draft = null, skip = SKIP, sessionStorage } = {}) {
  const storage = { store: new Map(draft ? [[DRAFT_KEY, JSON.stringify(draft)]] : []) };
  const local = {
    store: storage.store,
    failWrites: false,
    getItem(k) { return this.store.has(k) ? this.store.get(k) : null; },
    setItem(k, v) { if (this.failWrites) throw new Error('quota'); this.store.set(k, String(v)); },
    removeItem(k) { this.store.delete(k); },
  };
  const page = loadPage({
    file: 'ticket/index.html',
    url: `https://1212hp.example/ticket/${query}`,
    fetch: fetch || (async () => jsonResponse(envelope(data))),
    localStorage: local,
    sessionStorage,
    skip,
  });
  page.data = data;
  page.draftStore = local;
  return page;
}
const boot = async (query, opts) => { const page = openTicket(query, opts); await settle(); return page; };
const q = (page, selector) => page.document.querySelector(selector);
const qa = (page, selector) => page.document.querySelectorAll(selector);
const inside = (node, selector) => node.querySelector(selector);
const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
const el = (page, id) => page.document.getElementById(id);
const notice = (page) => el(page, 'ticket-notice');
const optionIds = (page) => el(page, 'liveId').options.map((o) => o.value);
function setValue(page, id, value) {
  const control = el(page, id);
  control.value = value;
  control.dispatchEvent(new Event('input'));
  control.dispatchEvent(new Event('change'));
}
function fill(page, { name = '架空 太郎', email = 'taro@example.test', quantity = '2', message = '架空の備考' } = {}) {
  setValue(page, 'name', name);
  setValue(page, 'email', email);
  if (quantity !== null) setValue(page, 'quantity', quantity);
  if (message !== null) setValue(page, 'message', message);
}
const submit = async (page) => { await el(page, 'submitBtn').click(); await settle(); };
const posts = (page) => page.fetchCalls.filter((c) => c.method === 'POST');

// ---- real HTML ---------------------------------------------------------------------------
test('T43-TICKET-INIT real HTML: scripts in order, no site-content.js, no confirmation modal, retained ids, novalidate form', () => {
  const html = readFileSync('ticket/index.html', 'utf8');
  assert.match(html, /<body class="site-ticket">/);
  assert.match(html, /live-ticket\.css\?v=20261119-43/);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1].split('?')[0].split('/').pop());
  assert.deepEqual(scripts, ['site-config.js', 'live-operations.js', 'live-order.js', 'reservation-cta.js', 'ticket-receipt.js', 'ticket.js', 'script.js']);
  assert.doesNotMatch(html, /site-content\.js|ticketConfirm|ticket-modal|ticket-route-message|ticket-result/);
  const page = loadPage({ file: 'ticket/index.html', url: 'https://1212hp.example/ticket/', fetch: async () => {}, runScripts: false });
  const d = page.document;
  for (const id of ['liveId', 'name', 'email', 'quantity', 'message', 'company', 'submitBtn', 'ticket-field-quantity', 'ticket-field-message', 'ticket-label-quantity', 'ticket-label-message', 'ticket-fields', 'ticket-notice', 'ticket-live-preview', 'ticket-form']) assert.ok(d.getElementById(id), id);
  assert.equal(d.getElementById('ticket-form').hasAttribute('novalidate'), true);
  assert.equal(d.getElementById('ticket-notice').getAttribute('role'), 'status');
  assert.equal(d.getElementById('ticket-notice').getAttribute('aria-live'), 'polite');
  assert.equal(d.getElementById('ticket-fields').contains(d.getElementById('name')), true);
  assert.equal(d.getElementById('ticket-fields').contains(d.getElementById('submitBtn')), true);
  assert.equal(d.getElementById('ticket-fields').contains(d.getElementById('liveId')), false);
  assert.equal(d.getElementById('company').getAttribute('tabindex'), '-1');
  assert.equal(d.getElementById('submitBtn').getAttribute('type'), 'submit');
  assert.equal(d.querySelector('main').getAttribute('data-state'), 'loading');
});

// ---- initial selection --------------------------------------------------------------------
test('T43-TICKET-INIT options are the bookable internal upcoming Lives, nearest first, and the first one is selected', async () => {
  const page = await boot('', { scenarios: ['multi-upcoming'] });
  assert.deepEqual(optionIds(page), ['fx-up-near', 'fx-up-far', 'fx-up-social']);
  assert.equal(el(page, 'liveId').value, 'fx-up-near');
  assert.equal(text(el(page, 'liveId').options[0]), '2026.12.05(Sat) 架空ホールC');
  assert.equal(q(page, 'main').getAttribute('data-state'), 'ready');
  assert.equal(notice(page).hidden, true);
  assert.equal(el(page, 'ticket-fields').hidden, false);
  assert.equal(page.fetchCalls[0].url, `${API}/api/public/site-data`);
});

test('T43-TICKET-INIT priority: a valid ?liveId, then the draft, then the nearest', async () => {
  const draft = { liveId: 'fx-up-social', name: 'draft name' };
  assert.equal(el(await boot('', { scenarios: ['multi-upcoming'], draft }), 'liveId').value, 'fx-up-social');
  assert.equal(el(await boot('?liveId=fx-up-far', { scenarios: ['multi-upcoming'], draft }), 'liveId').value, 'fx-up-far');
  assert.equal(el(await boot('', { scenarios: ['multi-upcoming'], draft: { liveId: 'fx-up-ext' } }), 'liveId').value, 'fx-up-near');
  assert.equal(el(await boot('', { scenarios: ['multi-upcoming'], draft: { liveId: 'fx-nope' } }), 'liveId').value, 'fx-up-near');
});

const unavailable = {
  'fx-up-closed': '指定されたライブの予約受付は終了しています。別のライブを選択してください。',
  'fx-up-invalid': '指定されたライブの予約先を確認中です。別のライブを選択してください。',
  'fx-up-stale': '指定されたライブは終了したライブです。別のライブを選択してください。',
  'fx-past-01': '指定されたライブは終了したライブです。別のライブを選択してください。',
  'fx-does-not-exist': '指定されたライブが見つかりません。別のライブを選択してください。',
};
for (const [id, sentence] of Object.entries(unavailable)) {
  test(`T43-TICKET-INIT S43-11 ${id}: one reason, no fields, another Live can be chosen`, async () => {
    const page = await boot(`?liveId=${id}`, { scenarios: ['multi-upcoming'] });
    assert.equal(notice(page).getAttribute('data-kind'), 'unavailable');
    assert.equal(text(notice(page)), sentence);
    assert.equal(notice(page).hidden, false);
    assert.equal(el(page, 'ticket-fields').hidden, true);
    const select = el(page, 'liveId');
    assert.equal(select.value, '');
    assert.equal(select.options[0].hasAttribute('disabled'), true);
    assert.equal(text(select.options[0]), 'ライブを選択してください');
    assert.deepEqual(select.options.slice(1).map((o) => o.value), ['fx-up-near', 'fx-up-far', 'fx-up-social']);
    assert.doesNotMatch(page.document.body.textContent, /予約URLが無効です/);
    assert.equal(el(page, 'ticket-live-preview').hidden, true);
    assert.equal(posts(page).length, 0);
  });
}

test('T43-TICKET-INIT S43-10 an external Live shows only the select and a new-tab link', async () => {
  const page = await boot('?liveId=fx-up-ext', { scenarios: ['multi-upcoming'] });
  assert.equal(notice(page).getAttribute('data-kind'), 'external');
  assert.match(text(notice(page)), /このライブの予約は外部サイトで受け付けています。/);
  const link = notice(page).querySelector('a');
  assert.equal(text(link), '外部サイトで予約');
  assert.equal(link.getAttribute('href'), 'https://tickets.example.test/e/100?from=fx&slot=1');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(el(page, 'ticket-fields').hidden, true);
  assert.equal(el(page, 'ticket-field-live').hidden, false);
  assert.equal(el(page, 'ticket-label-live').textContent, 'ライブ');
});

for (const [name, query, scenarios] of [
  ['an empty id', '?liveId=', []],
  ['spaces only', '?liveId=%20%20', []],
  ['a 129-character id', `?liveId=${'a'.repeat(129)}`, []],
  ['a control character', '?liveId=fx%07up', []],
  ['a duplicated id', '?liveId=fx-up-far', ['duplicate-id']],
]) {
  test(`T43-TICKET-INIT S43-16 ${name}: cannot identify the Live, nothing to submit`, async () => {
    const page = await boot(query, { scenarios });
    assert.equal(notice(page).getAttribute('data-kind'), 'unidentified');
    assert.match(text(notice(page)), /予約情報を確認できません。時間をおいて再度お試しください。/);
    assert.equal(text(notice(page).querySelector('a')), 'ライブの一覧へ →');
    assert.equal(notice(page).querySelector('a').getAttribute('href'), '../live/');
    assert.equal(el(page, 'ticket-layout').hidden, true);
    assert.equal(posts(page).length, 0);
  });
}

test('T43-TICKET-INIT a 128-character id is allowed to be looked up (it is simply not found)', async () => {
  const page = await boot(`?liveId=${'a'.repeat(128)}`);
  assert.equal(notice(page).getAttribute('data-kind'), 'unavailable');
});

test('T43-TICKET-INIT S43-16 when a helper script is missing, no field or option is offered', async () => {
  for (const missing of ['live-operations.js', 'live-order.js', 'reservation-cta.js', 'ticket-receipt.js']) {
    const page = await boot('', { skip: [...SKIP, missing] });
    assert.equal(notice(page).getAttribute('data-kind'), 'unidentified', missing);
    assert.equal(el(page, 'ticket-layout').hidden, true, missing);
    assert.equal(el(page, 'liveId').options.length, 0, missing);
    assert.equal(page.fetchCalls.length, 0, `${missing}: no request is made`);
  }
});

test('T43-TICKET-INIT S43-12 no bookable Live and no ?liveId: a sentence and a way back, no fields', async () => {
  const data = buildData(fixture, 'multi-upcoming');
  data.live.upcoming = data.live.upcoming.filter((l) => ['fx-up-ext', 'fx-up-closed', 'fx-up-invalid', 'fx-up-stale'].includes(l.id));
  const page = await boot('', { data });
  assert.equal(notice(page).getAttribute('data-kind'), 'empty');
  assert.match(text(notice(page)), /現在、このサイトで予約できるライブはありません。/);
  assert.equal(notice(page).querySelector('a').getAttribute('href'), '../live/');
  assert.equal(el(page, 'ticket-layout').hidden, true);
  const none = await boot('', { scenarios: ['empty-upcoming'] });
  assert.equal(notice(none).getAttribute('data-kind'), 'empty');
  const withQuery = await boot('?liveId=fx-up-ext', { data });
  assert.equal(notice(withQuery).getAttribute('data-kind'), 'external', 'a specified Live keeps its own reason');
  assert.equal(el(withQuery, 'ticket-layout').hidden, true);
});

test('T43-TICKET-INIT choosing another Live from an unavailable state clears the notice and reveals the fields', async () => {
  const page = await boot('?liveId=fx-up-closed', { scenarios: ['multi-upcoming'] });
  const select = el(page, 'liveId');
  select.value = 'fx-up-far';
  select.dispatchEvent(new Event('change'));
  assert.equal(notice(page).hidden, true);
  assert.equal(notice(page).getAttribute('data-kind'), null);
  assert.equal(el(page, 'ticket-fields').hidden, false);
  assert.equal(text(q(page, '#ticket-live-preview .ticket-summary-date')), '2026.12.26(Sat)');
  assert.equal(JSON.parse(page.draftStore.getItem(DRAFT_KEY)).liveId, 'fx-up-far');
  assert.equal(el(page, 'ticket-back').getAttribute('href'), '../live/detail/?liveId=fx-up-far');
});

// ---- load states --------------------------------------------------------------------------
test('T43-STATE-TICKET loading: busy and a status, no fields yet', async () => {
  const gate = deferred();
  const page = openTicket('', { fetch: () => gate.promise });
  await settle();
  assert.equal(q(page, 'main').getAttribute('data-state'), 'loading');
  assert.equal(q(page, 'main').getAttribute('aria-busy'), 'true');
  assert.equal(text(q(page, '[role="status"].live-skeleton')), '読み込み中');
  assert.equal(el(page, 'ticket-layout').hidden, true);
  gate.resolve(jsonResponse(envelope(buildData(fixture))));
  await settle();
  assert.equal(q(page, 'main').getAttribute('aria-busy'), 'false');
  assert.equal(q(page, '.live-skeleton'), null);
});

const loadFailures = {
  'network failure': () => { throw new TypeError('Failed to fetch'); },
  'HTTP failure': () => jsonResponse({}, { ok: false, status: 502 }),
  'invalid JSON': () => badJsonResponse(true),
  'data is not an object': () => jsonResponse({ data: [], meta: {} }),
  'live missing': () => jsonResponse({ data: { site: {}, ticket: {} }, meta: {} }),
  'upcoming is not an array': () => jsonResponse({ data: { live: { upcoming: null, past: [] } }, meta: {} }),
};
for (const [name, make] of Object.entries(loadFailures)) {
  test(`T43-STATE-TICKET S43-14 ${name}: a retry notice, no fields`, async () => {
    const page = await boot('', { fetch: async () => make() });
    assert.equal(notice(page).getAttribute('data-kind'), 'load-error');
    assert.match(text(notice(page)), /予約に必要な情報を読み込めませんでした。/);
    assert.equal(text(q(page, '[data-testid="ticket-retry"]')), 'もう一度読み込む');
    assert.equal(el(page, 'ticket-layout').hidden, true);
    assert.equal(q(page, 'main').getAttribute('data-state'), 'error');
  });
}

test('T43-STATE-TICKET retry: one request at a time, focus to the heading on success and to the new button on failure', async () => {
  let attempt = 0;
  const gate = deferred();
  const page = await boot('', { fetch: async () => { attempt += 1; if (attempt <= 2) throw new TypeError('down'); await gate.promise; return jsonResponse(envelope(buildData(fixture))); } });
  assert.equal(page.document.activeElement, null);
  await q(page, '[data-testid="ticket-retry"]').click();
  await settle();
  assert.equal(attempt, 2);
  assert.equal(page.document.activeElement, q(page, '[data-testid="ticket-retry"]'));
  const pendingClick = q(page, '[data-testid="ticket-retry"]').click();
  q(page, '[data-testid="ticket-retry"]')?.click();
  await settle();
  assert.equal(attempt, 3, 'a click during a pending request sends nothing');
  gate.resolve();
  await pendingClick;
  await settle();
  assert.equal(q(page, 'main').getAttribute('data-state'), 'ready');
  assert.equal(page.document.activeElement, q(page, 'h1.site-section-title'));
  assert.equal(notice(page).hidden, true);
});

test('T43-STATE-TICKET listeners do not accumulate across retries; pagehide drops a stale response; pageshow reloads once', async () => {
  const first = deferred();
  let calls = 0;
  const page = openTicket('', { fetch: () => { calls += 1; return calls === 1 ? first.promise : Promise.resolve(jsonResponse(envelope(buildData(fixture)))); } });
  await settle();
  page.fire('pagehide');
  first.resolve(jsonResponse(envelope(buildData(fixture, 'empty-upcoming'))));
  await settle();
  assert.equal(notice(page).getAttribute('data-kind'), null, 'the stale response is not rendered');
  page.fire('pageshow', { persisted: true });
  await settle();
  assert.equal(calls, 2);
  assert.equal(q(page, 'main').getAttribute('data-state'), 'ready');
  page.fire('pageshow', { persisted: true });
  await settle();
  assert.equal(calls, 2);
  const form = el(page, 'ticket-form');
  const counts = [form.listenerCount('submit'), el(page, 'liveId').listenerCount('change'), el(page, 'name').listenerCount('input')];
  const failing = await boot('', { fetch: async () => { throw new TypeError('x'); } });
  const before = failing.winTarget.listenerCount('pagehide');
  for (let i = 0; i < 3; i += 1) { await q(failing, '[data-testid="ticket-retry"]').click(); await settle(); }
  assert.equal(failing.winTarget.listenerCount('pagehide'), before);
  assert.deepEqual(counts, [form.listenerCount('submit'), el(page, 'liveId').listenerCount('change'), el(page, 'name').listenerCount('input')]);
  assert.deepEqual(counts, [1, 1, 1]);
});

test('T43-STATE-TICKET the footer text comes from the site data', async () => {
  const page = await boot('');
  assert.equal(el(page, 'site-footer').textContent, 'Synthetic studio — All rights reserved. 架空の確認用フッターです。');
});

// ---- summary ------------------------------------------------------------------------------
test('T43-TICKET-FORM the summary shows image, date, venue, title, every detail line and Instagram, and follows the selection', async () => {
  const page = await boot('?liveId=fx-up-far', { scenarios: ['multi-upcoming'] });
  const box = el(page, 'ticket-live-preview');
  assert.equal(box.hidden, false);
  assert.equal(text(q(page, '#ticket-summary-label')), '予約するライブ');
  assert.equal(inside(box, 'img').getAttribute('src'), 'https://fixture-images.example/flyer-up-far.png?v=2026-11-18T00%3A00%3A00.000Z');
  assert.equal(text(inside(box, '.ticket-summary-date')), '2026.12.26(Sat)');
  assert.equal(text(inside(box, '.ticket-summary-venue')), '架空ホールA');
  assert.equal(text(inside(box, '.ticket-summary-title')), '架空の公演 A');
  const lines = page.window.LiveOperations.formatLiveDetails(page.data.live.upcoming.find((l) => l.id === 'fx-up-far'));
  assert.equal(inside(box, '.ticket-summary-details').textContent, lines);
  const link = inside(box, 'a.site-text-link');
  assert.equal(text(link), 'Instagram →');
  assert.equal(link.getAttribute('href'), 'https://www.instagram.com/fixture_account/');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(text(el(page, 'ticket-back')), '← ライブの詳細');
  assert.equal(el(page, 'ticket-back').getAttribute('href'), '../live/detail/?liveId=fx-up-far');
  const select = el(page, 'liveId');
  select.value = 'fx-up-near';
  select.dispatchEvent(new Event('change'));
  assert.equal(text(inside(box, '.ticket-summary-date')), '2026.12.05(Sat)');
  assert.equal(inside(box, 'a.site-text-link'), null, 'no Instagram link for a Live without one');
});

test('T43-TICKET-FORM the summary has no picture frame when the image is missing or fails (S43-05)', async () => {
  const none = await boot('?liveId=fx-up-social', { scenarios: ['multi-upcoming'] });
  assert.equal(q(none, '#ticket-live-preview img'), null);
  assert.equal(q(none, '#ticket-live-preview .ticket-summary-figure'), null);
  const page = await boot('?liveId=fx-up-far', { scenarios: ['multi-upcoming'] });
  const img = q(page, '#ticket-live-preview img');
  const figure = q(page, '#ticket-live-preview .ticket-summary-figure');
  assert.equal(figure.hidden, false);
  img.dispatchEvent(new Event('error', { bubbles: false }));
  assert.equal(figure.hidden, true);
  const relative = await boot('', { scenarios: ['internal-only'] });
  assert.equal(relative.document.querySelector('#ticket-live-preview img').getAttribute('src').startsWith('https://fixture-images.example/'), true);
});

test('T43-TICKET-FORM with no selection the back link goes to the list and the summary is hidden', async () => {
  const page = await boot('?liveId=fx-up-closed', { scenarios: ['multi-upcoming'] });
  assert.equal(text(el(page, 'ticket-back')), '← live');
  assert.equal(el(page, 'ticket-back').getAttribute('href'), '../live/');
});

// ---- validation ---------------------------------------------------------------------------
test('T43-TICKET-FORM empty name and e-mail: messages under the fields, aria-invalid, describedby, focus on the first, no request', async () => {
  const page = await boot('?liveId=fx-up-far', { scenarios: ['multi-upcoming'] });
  await submit(page);
  assert.equal(text(el(page, 'ticket-error-name')), 'お名前を入力してください。');
  assert.equal(text(el(page, 'ticket-error-email')), 'e-mailを入力してください。');
  assert.equal(el(page, 'ticket-error-name').getAttribute('role'), 'alert');
  assert.equal(el(page, 'name').getAttribute('aria-invalid'), 'true');
  assert.equal(el(page, 'name').getAttribute('aria-describedby'), 'ticket-error-name');
  assert.equal(el(page, 'email').getAttribute('aria-describedby'), 'ticket-error-email');
  assert.equal(page.document.activeElement, el(page, 'name'));
  assert.equal(posts(page).length, 0);
  assert.equal(el(page, 'ticket-error-quantity').hidden, true, 'a valid quantity shows no error');
  // the message sits directly after the field it belongs to
  assert.equal(el(page, 'name').parentNode, el(page, 'ticket-error-name').parentNode);
});

test('T43-TICKET-FORM e-mail checks: required, shape, length', async () => {
  const page = await boot('?liveId=fx-up-far', { scenarios: ['multi-upcoming'] });
  for (const bad of ['example@', 'no-at.example', 'a b@example.test', 'a@b', `${'x'.repeat(250)}@a.bc`, '@a.bc']) {
    fill(page, { email: bad });
    await submit(page);
    assert.equal(text(el(page, 'ticket-error-email')), 'e-mailの形式を確認してください。', bad);
    assert.equal(page.document.activeElement, el(page, 'email'), bad);
  }
  for (const good of ['taro@example.test', ' taro@example.test ', 'a.b+c@sub.example.test']) {
    fill(page, { email: good });
    await submit(page);
    assert.equal(el(page, 'ticket-error-email').hidden, true, good);
  }
});

test('T43-TICKET-FORM quantity must be a whole number from 1 to 10, using the configured label', async () => {
  const page = await boot('?liveId=fx-up-far', { scenarios: ['multi-upcoming'] });
  for (const bad of ['0', '11', '1.5', '', 'abc', '-1', '１']) {
    fill(page, { quantity: bad });
    await submit(page);
    assert.equal(text(el(page, 'ticket-error-quantity')), '枚数（架空）は1〜10で入力してください。', JSON.stringify(bad));
    assert.equal(el(page, 'quantity').getAttribute('aria-invalid'), 'true');
    assert.equal(page.document.activeElement, el(page, 'quantity'));
    assert.equal(posts(page).length, 0);
  }
  for (const good of ['1', '10', ' 5 ']) {
    fill(page, { quantity: good });
    await submit(page);
    assert.equal(el(page, 'ticket-error-quantity').hidden, true, good);
  }
});

test('T43-TICKET-FORM fixing a field and typing clears only that field’s error', async () => {
  const page = await boot('?liveId=fx-up-far', { scenarios: ['multi-upcoming'] });
  await submit(page);
  assert.equal(el(page, 'ticket-error-name').hidden, false);
  assert.equal(el(page, 'ticket-error-email').hidden, false);
  setValue(page, 'name', '架空 花子');
  assert.equal(el(page, 'ticket-error-name').hidden, true);
  assert.equal(el(page, 'name').getAttribute('aria-invalid'), null);
  assert.equal(el(page, 'name').getAttribute('aria-describedby'), null);
  assert.equal(el(page, 'ticket-error-email').hidden, false);
});

// ---- settings and the draft ---------------------------------------------------------------
test('T43-FIELDS labels, placeholder and submit label come from the admin settings', async () => {
  const page = await boot('?liveId=fx-up-far', { scenarios: ['multi-upcoming'] });
  assert.equal(text(el(page, 'ticket-label-quantity')), '枚数（架空）');
  assert.equal(text(el(page, 'ticket-label-message')), 'ご連絡（架空）');
  assert.equal(el(page, 'message').getAttribute('placeholder'), '例: 架空の入力例です');
  assert.equal(text(el(page, 'submitBtn')), 'この内容で予約する');
  const bare = buildData(fixture, 'multi-upcoming');
  bare.ticket = {};
  const defaults = await boot('?liveId=fx-up-far', { data: bare });
  assert.equal(text(el(defaults, 'ticket-label-quantity')), '枚数');
  assert.equal(text(el(defaults, 'ticket-label-message')), '備考');
  assert.equal(text(el(defaults, 'submitBtn')), '予約する');
});

for (const [scenario, quantity, message] of [['fields-hidden', true, true], ['fields-quantity-only', false, true], ['fields-message-only', true, false]]) {
  test(`T43-FIELDS ${scenario}: hidden fields are removed from view and from validation`, async () => {
    const page = await boot('?liveId=fx-up-far', { scenarios: ['multi-upcoming', scenario] });
    assert.equal(el(page, 'ticket-field-quantity').hidden, quantity);
    assert.equal(el(page, 'ticket-field-message').hidden, message);
    fill(page, { quantity: '99', message: null });
    await submit(page);
    assert.equal(el(page, 'ticket-error-quantity').hidden, quantity, quantity ? 'a hidden quantity is not validated' : 'a shown quantity is validated');
  });
}

test('T43-TICKET-FORM the draft is saved on input and restored; a ?liveId is not overwritten by the draft', async () => {
  const page = await boot('?liveId=fx-up-far', { scenarios: ['multi-upcoming'] });
  fill(page, { name: '架空 太郎', email: 'taro@example.test', quantity: '3', message: '下書きの備考' });
  assert.deepEqual(JSON.parse(page.draftStore.getItem(DRAFT_KEY)), { liveId: 'fx-up-far', name: '架空 太郎', email: 'taro@example.test', quantity: '3', message: '下書きの備考' });
  const draft = JSON.parse(page.draftStore.getItem(DRAFT_KEY));
  const again = await boot('', { scenarios: ['multi-upcoming'], draft });
  assert.equal(el(again, 'name').value, '架空 太郎');
  assert.equal(el(again, 'email').value, 'taro@example.test');
  assert.equal(el(again, 'quantity').value, '3');
  assert.equal(el(again, 'message').value, '下書きの備考');
  assert.equal(el(again, 'liveId').value, 'fx-up-far');
  const withQuery = await boot('?liveId=fx-up-social', { scenarios: ['multi-upcoming'], draft });
  assert.equal(el(withQuery, 'liveId').value, 'fx-up-social');
  assert.equal(el(withQuery, 'name').value, '架空 太郎');
});

test('T43-TICKET-FORM a draft never selects an excluded Live and a broken or blocked storage is ignored', async () => {
  const page = await boot('', { scenarios: ['multi-upcoming'], draft: { liveId: 'fx-up-closed', name: 'n' } });
  assert.equal(el(page, 'liveId').value, 'fx-up-near');
  const garbage = openTicket('', { scenarios: ['multi-upcoming'] });
  garbage.draftStore.store.set(DRAFT_KEY, '{not json');
  await settle();
  assert.equal(q(garbage, 'main').getAttribute('data-state'), 'ready');
  const blocked = openTicket('', { scenarios: ['multi-upcoming'] });
  blocked.draftStore.failWrites = true;
  await settle();
  fill(blocked, {});
  assert.equal(q(blocked, 'main').getAttribute('data-state'), 'ready');
});

// ---- sending ------------------------------------------------------------------------------
const RECEIPT_KEY = '1212hp_ticket_receipt_v1';
const DUPLICATE = 'reservation already submitted recently';
const OPEN_ON_FAR = '?liveId=fx-up-far';
const NOTICE = {
  failed: '予約を送信できませんでした。入力内容は残っています。時間をおいて、もう一度お試しください。',
  duplicate: '同じ内容の予約を、すでに受け付けています。',
};

// Answers GETs with the site data and POSTs with `reply(call)`; records every call.
function responder(data, reply) {
  return async (url, options, call) => {
    if (call.method === 'POST') return reply(call);
    return jsonResponse(envelope(data));
  };
}
const created = (extra = {}) => (call) => jsonResponse({
  ok: true,
  reservation: { id: 'fixture-ticket-0001', liveId: call.body.liveId, liveDate: '2026-12-26', liveVenue: '架空ホールA', name: call.body.name, email: call.body.email, quantity: call.body.quantity, message: call.body.message, status: 'pending', source: 'web', createdAt: '2026-11-19T03:00:00.000Z', ...extra },
}, { status: 201 });
async function readyTicket(query = OPEN_ON_FAR, reply = created(), opts = {}) {
  const data = opts.data || buildData(fixture, 'multi-upcoming');
  const page = openTicket(query, { data, fetch: responder(data, reply), ...opts });
  await settle();
  return page;
}
const sendPayload = (page) => posts(page)[0].body;

test('T43-SEND the POST goes to the public endpoint with exactly the six fields, trimmed, quantity as a number', async () => {
  const page = await readyTicket();
  fill(page, { name: '  架空 太郎  ', email: ' taro@example.test ', quantity: ' 3 ', message: '  下の備考  ' });
  await submit(page);
  assert.equal(posts(page).length, 1);
  const call = posts(page)[0];
  assert.equal(call.url, `${API}/api/public/ticket-reservations`);
  assert.equal(call.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(call.body, { liveId: 'fx-up-far', name: '架空 太郎', email: 'taro@example.test', quantity: 3, message: '下の備考', company: '' });
  assert.deepEqual(Object.keys(call.body), ['liveId', 'name', 'email', 'quantity', 'message', 'company']);
});

test('T43-SEND the honeypot value is passed through untouched; a hidden quantity sends 1 and a hidden message sends nothing', async () => {
  const page = await readyTicket(OPEN_ON_FAR, created(), { data: buildData(fixture, 'multi-upcoming', 'fields-hidden') });
  fill(page, { quantity: '7', message: 'ignored' });
  el(page, 'company').value = 'bot ';
  await submit(page);
  assert.deepEqual(sendPayload(page), { liveId: 'fx-up-far', name: '架空 太郎', email: 'taro@example.test', quantity: 1, message: '', company: 'bot ' });
});

test('T43-SEND only the selected Live id is read from the select, never from another control', async () => {
  const page = await readyTicket('?liveId=fx-up-social');
  fill(page, {});
  await submit(page);
  assert.equal(sendPayload(page).liveId, 'fx-up-social');
  const stale = await readyTicket(OPEN_ON_FAR);
  fill(stale, {});
  el(stale, 'liveId').value = 'fx-up-closed';
  await submit(stale);
  assert.equal(posts(stale).length, 0, 'a Live that is not bookable can never be sent');
  assert.equal(notice(stale).getAttribute('data-kind'), 'unavailable');
});

test('T43-SEND while sending: the button is disabled and says 送信しています…, inputs keep their values, a second submit sends nothing', async () => {
  const gate = deferred();
  const page = await readyTicket(OPEN_ON_FAR, () => gate.promise);
  fill(page, { message: '送信中の備考' });
  const pendingSubmit = submit(page);
  await settle();
  const button = el(page, 'submitBtn');
  assert.equal(button.hasAttribute('disabled'), true);
  assert.equal(text(button), '送信しています…');
  assert.equal(text(el(page, 'ticket-status')), '送信しています…');
  // plan §2: aria-busy is for loading only; a busy region would keep the 送信しています… status from being read out
  assert.notEqual(q(page, 'main').getAttribute('aria-busy'), 'true', 'main is not busy while sending');
  assert.equal(el(page, 'ticket-status').getAttribute('role'), 'status');
  assert.equal(el(page, 'name').value, '架空 太郎');
  assert.equal(el(page, 'message').value, '送信中の備考');
  await el(page, 'ticket-form').dispatchEvent(new Event('submit'));
  await button.click();
  assert.equal(posts(page).length, 1, 'no second request while one is in flight');
  gate.resolve(created()({ body: sendPayload(page) }));
  await pendingSubmit;
  await settle();
});

test('T43-SEND the payload is frozen at the moment of sending, even if the form changes while waiting', async () => {
  const gate = deferred();
  const page = await readyTicket(OPEN_ON_FAR, () => gate.promise);
  fill(page, { name: '送信時の名前', message: '送信時の備考' });
  const first = submit(page);
  await settle();
  setValue(page, 'name', '後から変えた名前');
  el(page, 'liveId').value = 'fx-up-near';
  el(page, 'liveId').dispatchEvent(new Event('change'));
  assert.equal(sendPayload(page).name, '送信時の名前');
  assert.equal(sendPayload(page).liveId, 'fx-up-far');
  gate.resolve(created()({ body: sendPayload(page) }));
  await first;
  await settle();
  const saved = JSON.parse(page.sessionStorage.store.get(RECEIPT_KEY));
  assert.equal(saved.liveId, 'fx-up-far');
  assert.equal(saved.live.title, '架空の公演 A', 'the snapshot belongs to the Live that was sent');
});

const failures2 = {
  'a network failure': () => { throw new TypeError('Failed to fetch'); },
  'a server error': () => jsonResponse({ error: 'internal server error' }, { ok: false, status: 500 }),
  'a rejected request': () => jsonResponse({ error: 'live is not available for public reservation' }, { ok: false, status: 400 }),
  'an unreadable error body': () => badJsonResponse(false),
  'a success without a reservation': () => jsonResponse({ ok: true }, { status: 201 }),
  'a success with an empty receipt number': () => jsonResponse({ ok: true, reservation: { id: '' } }, { status: 201 }),
  'a success that is not JSON': () => badJsonResponse(true),
};
for (const [name, make] of Object.entries(failures2)) {
  test(`T43-SEND S43-09 ${name}: input, draft and selection stay; the same button now says もう一度送信する; nothing is stored or navigated`, async () => {
    const page = await readyTicket(OPEN_ON_FAR, make);
    fill(page, { name: '残る名前', message: '残る備考' });
    el(page, 'quantity').value = '4';
    el(page, 'quantity').dispatchEvent(new Event('input'));
    await submit(page);
    assert.equal(notice(page).getAttribute('data-kind'), 'failed');
    assert.equal(text(notice(page)), NOTICE.failed);
    assert.equal(notice(page).getAttribute('role'), 'alert');
    assert.equal(notice(page).hidden, false);
    assert.equal(text(el(page, 'submitBtn')), 'もう一度送信する');
    assert.equal(el(page, 'submitBtn').hasAttribute('disabled'), false);
    assert.equal(el(page, 'name').value, '残る名前');
    assert.equal(el(page, 'message').value, '残る備考');
    assert.equal(el(page, 'quantity').value, '4');
    assert.equal(el(page, 'liveId').value, 'fx-up-far');
    assert.deepEqual(JSON.parse(page.draftStore.getItem(DRAFT_KEY)), { liveId: 'fx-up-far', name: '残る名前', email: 'taro@example.test', quantity: '4', message: '残る備考' });
    assert.equal(page.location.replaced.length, 0);
    assert.equal(page.sessionStorage.store.has(RECEIPT_KEY), false);
    assert.equal(text(el(page, 'ticket-status')), '');
  });
}

test('T43-SEND after a failure the same button sends again; the old failure notice is replaced and the retry can succeed', async () => {
  let attempt = 0;
  const page = await readyTicket(OPEN_ON_FAR, (call) => { attempt += 1; return attempt === 1 ? jsonResponse({ error: 'x' }, { ok: false, status: 500 }) : created()(call); });
  fill(page, {});
  await submit(page);
  assert.equal(notice(page).getAttribute('data-kind'), 'failed');
  await submit(page);
  assert.equal(posts(page).length, 2);
  assert.equal(notice(page).hidden, true);
  assert.equal(page.location.replaced.length, 1);
});

test('T43-SEND S43-15 the server saying "already submitted recently" stops here with its own message and the normal button label', async () => {
  const page = await readyTicket(OPEN_ON_FAR, () => jsonResponse({ error: DUPLICATE }, { ok: false, status: 400 }));
  fill(page, {});
  await submit(page);
  assert.equal(notice(page).getAttribute('data-kind'), 'duplicate');
  assert.equal(text(notice(page)), NOTICE.duplicate);
  assert.equal(text(el(page, 'submitBtn')), 'この内容で予約する');
  assert.equal(el(page, 'submitBtn').hasAttribute('disabled'), false);
  assert.equal(page.location.replaced.length, 0);
  assert.equal(el(page, 'name').value, '架空 太郎');
  assert.equal(page.sessionStorage.store.has(RECEIPT_KEY), false);
});

test('T43-SEND the duplicate message is the Worker’s own text (public contract, not a copy that can drift)', () => {
  assert.ok(readFileSync('cloudflare/worker/src/worker.js', 'utf8').includes(`"${DUPLICATE}"`));
  assert.ok(readFileSync('assets/js/ticket.js', 'utf8').includes(`'${DUPLICATE}'`));
});

test('T43-SEND success: replaces to complete/?liveId=&rid= with no personal data in the address; draft cleared; receipt in sessionStorage only', async () => {
  const page = await readyTicket(OPEN_ON_FAR, created());
  fill(page, { name: '架空 太郎', email: 'taro@example.test', message: '備考のひみつ' });
  await submit(page);
  assert.equal(page.location.replaced.length, 1);
  assert.equal(page.location.assigned.length, 0, 'replace, so Back never returns to a filled form');
  const target = page.location.replaced[0];
  assert.equal(target, './complete/?liveId=fx-up-far&rid=fixture-ticket-0001');
  for (const secret of ['架空', 'taro', 'example.test', 'ひみつ', encodeURIComponent('架空 太郎')]) assert.ok(!decodeURIComponent(target).includes(secret), secret);
  assert.equal(page.draftStore.getItem(DRAFT_KEY), null);
  assert.equal([...page.draftStore.store.keys()].some((k) => /receipt/.test(k)), false, 'never in localStorage');
  const saved = JSON.parse(page.sessionStorage.store.get(RECEIPT_KEY));
  assert.equal(saved.v, 1);
  assert.equal(saved.rid, 'fixture-ticket-0001');
  assert.deepEqual([saved.name, saved.email, saved.quantity, saved.message], ['架空 太郎', 'taro@example.test', 2, '備考のひみつ']);
  assert.deepEqual([saved.live.date, saved.live.venue, saved.live.title], ['2026-12-26', '架空ホールA', '架空の公演 A']);
  assert.equal(saved.live.image, 'https://fixture-images.example/flyer-up-far.png');
  assert.deepEqual(saved.ui, { completeText: '予約を受け付けました。当日お待ちしています。（架空）', labelQuantity: '枚数（架空）', labelMessage: 'ご連絡（架空）', showQuantity: true, showMessage: true });
  assert.equal(el(page, 'submitBtn').hasAttribute('disabled'), true, 'the button stays disabled while the page is leaving');
});

test('T43-SEND the saved values are the ones the server accepted (including a trimmed name), and the snapshot keeps the settings of that moment', async () => {
  const page = await readyTicket(OPEN_ON_FAR, created({ name: 'サーバーが受けた名前', quantity: 5 }), { data: buildData(fixture, 'multi-upcoming', 'fields-quantity-only') });
  fill(page, { quantity: '5', message: null });
  await submit(page);
  const saved = JSON.parse(page.sessionStorage.store.get(RECEIPT_KEY));
  assert.equal(saved.name, 'サーバーが受けた名前');
  assert.equal(saved.quantity, 5);
  assert.equal(saved.ui.showMessage, false);
  assert.equal(saved.ui.showQuantity, true);
});

test('T43-SEND a new send clears the previous receipt first; a blocked storage still moves on (the booking succeeded)', async () => {
  const gate = deferred();
  const page = await readyTicket(OPEN_ON_FAR, () => gate.promise);
  page.sessionStorage.store.set(RECEIPT_KEY, '{"old":true}');
  fill(page, {});
  const sending = submit(page);
  await settle();
  assert.equal(page.sessionStorage.store.has(RECEIPT_KEY), false);
  gate.resolve(created()({ body: sendPayload(page) }));
  await sending;
  await settle();
  const blocked = await readyTicket(OPEN_ON_FAR, created());
  blocked.sessionStorage.failWrites = true;
  fill(blocked, {});
  await submit(blocked);
  assert.equal(blocked.location.replaced.length, 1);
  assert.equal(blocked.sessionStorage.store.has(RECEIPT_KEY), false);
});

test('T43-SEND ?dryRun=1 never calls the API, saves a dry-run receipt and moves on exactly like a success', async () => {
  const page = await readyTicket(`${OPEN_ON_FAR}&dryRun=1`);
  fill(page, {});
  await submit(page);
  assert.equal(posts(page).length, 0);
  assert.equal(page.location.replaced.length, 1);
  const rid = new URL(page.location.replaced[0], 'https://1212hp.example/ticket/').searchParams.get('rid');
  assert.match(rid, /^dry-run-\d+$/);
  const saved = JSON.parse(page.sessionStorage.store.get(RECEIPT_KEY));
  assert.equal(saved.rid, rid);
  assert.equal(saved.name, '架空 太郎');
  assert.equal(saved.live.venue, '架空ホールA');
});

test('T43-SEND a failed validation sends nothing and does not clear the previous receipt', async () => {
  const page = await readyTicket(OPEN_ON_FAR);
  page.sessionStorage.store.set(RECEIPT_KEY, '{"keep":true}');
  await submit(page);
  assert.equal(posts(page).length, 0);
  assert.equal(page.sessionStorage.store.has(RECEIPT_KEY), true);
});

// ---- list → ticket → complete -------------------------------------------------------------
test('T43-FLOW the list reserve link opens Ticket on the same Live and a successful send replaces to the complete page', async () => {
  const data = buildData(fixture, 'multi-upcoming');
  const listPage = loadPage({ file: 'live/index.html', url: 'https://1212hp.example/live/', skip: ['script.js'], fetch: async () => jsonResponse(envelope(data)) });
  await settle();
  const reserve = listPage.document.querySelectorAll('[data-testid="live-card"]').find((c) => c.getAttribute('data-live-id') === 'fx-up-far').querySelector('[data-testid="live-reserve"]');
  const ticketUrl = new URL(reserve.getAttribute('href'), 'https://1212hp.example/live/');
  assert.equal(ticketUrl.pathname, '/ticket/');
  assert.equal(ticketUrl.searchParams.get('liveId'), 'fx-up-far');
  const shared = { store: new Map(), getItem(k) { return this.store.has(k) ? this.store.get(k) : null; }, setItem(k, v) { this.store.set(k, String(v)); }, removeItem(k) { this.store.delete(k); } };
  const ticket = loadPage({ file: 'ticket/index.html', url: ticketUrl.href, skip: ['script.js'], sessionStorage: shared, fetch: responder(data, created()) });
  await settle();
  assert.equal(el(ticket, 'liveId').value, 'fx-up-far');
  fill(ticket, {});
  await submit(ticket);
  const complete = new URL(ticket.location.replaced[0], ticketUrl);
  assert.equal(complete.pathname, '/ticket/complete/');
  assert.deepEqual([...complete.searchParams.keys()], ['liveId', 'rid']);
  assert.equal(complete.searchParams.get('liveId'), 'fx-up-far');
  assert.equal(complete.searchParams.get('rid'), 'fixture-ticket-0001');
  assert.ok(shared.store.has(RECEIPT_KEY));
});

test('T43-FLOW there is no confirmation step: no dialog or overlay on Ticket, and the screens visited are exactly list, Ticket and complete', async () => {
  const html = readFileSync('ticket/index.html', 'utf8');
  assert.doesNotMatch(html, /role="dialog"|aria-modal|ticketConfirm|ticket-modal|overlay/i);
  const page = await readyTicket(OPEN_ON_FAR);
  fill(page, {});
  await submit(page);
  assert.equal(qa(page, '[role="dialog"], [aria-modal="true"]').length, 0);
  const visited = ['/live/', new URL('https://1212hp.example/ticket/').pathname, new URL(page.location.replaced[0], 'https://1212hp.example/ticket/').pathname];
  assert.deepEqual(visited, ['/live/', '/ticket/', '/ticket/complete/']);
  assert.equal(page.location.assigned.length, 0);
});

// ---- carried over from the old public-ticket-routing tests (intent kept, new screens) -------
const DANGEROUS_ID = 'internal "&/?=<live>';
function dangerousData() {
  const data = buildData(fixture, 'multi-upcoming');
  data.live.upcoming.push({ id: DANGEROUS_ID, date: '2026-12-10', venue: '<Internal & Hall>', title: 'Internal <Live>', ticketUrl: '', link: 'https://tickets.example.test/legacy-only' });
  return data;
}

test('T43-SEND a Live ID with quotes, ampersands, slashes and angle brackets survives the address, the select, the payload and the receipt', async () => {
  const data = dangerousData();
  const page = await readyTicket(`?liveId=${encodeURIComponent(DANGEROUS_ID)}`, created(), { data });
  assert.equal(el(page, 'liveId').value, DANGEROUS_ID);
  assert.equal(text(q(page, '#ticket-live-preview .ticket-summary-venue')), '<Internal & Hall>');
  assert.equal(qa(page, '#ticket-live-preview Live').length, 0);
  assert.equal(el(page, 'ticket-back').getAttribute('href'), `../live/detail/?liveId=${encodeURIComponent(DANGEROUS_ID)}`);
  fill(page, {});
  await submit(page);
  assert.equal(sendPayload(page).liveId, DANGEROUS_ID, 'a legacy booking-site link on the Live does not turn it into an external one');
  const target = new URL(page.location.replaced[0], 'https://1212hp.example/ticket/');
  assert.equal(target.searchParams.get('liveId'), DANGEROUS_ID);
  assert.equal(JSON.parse(page.sessionStorage.store.get(RECEIPT_KEY)).liveId, DANGEROUS_ID);
});

test('T43-SEND the selected Live is taken at the moment of submit; reading other fields (even if that changes the select) cannot change it', async () => {
  const page = await readyTicket(OPEN_ON_FAR);
  let name = '架空 太郎';
  let armed = false;
  Object.defineProperty(el(page, 'name'), 'value', {
    configurable: true,
    get() { if (armed) el(page, 'liveId').value = 'fx-up-near'; return name; },
    set(value) { name = String(value); },
  });
  setValue(page, 'email', 'taro@example.test');
  armed = true;
  await submit(page);
  assert.equal(posts(page).length, 1);
  assert.equal(sendPayload(page).liveId, 'fx-up-far');
});

test('T43-SEND extra same-named controls injected into the form never reach the payload', async () => {
  const page = await readyTicket(OPEN_ON_FAR);
  const form = el(page, 'ticket-form');
  for (const [name, value] of [['liveId', 'fx-up-ext'], ['name', 'Injected Name'], ['email', 'injected@example.test'], ['quantity', 'not-a-number'], ['message', 'injected message'], ['company', 'injected company']]) {
    const input = page.document.createElement('input');
    input.setAttribute('name', name);
    input.setAttribute('value', value);
    form.appendChild(input);
  }
  fill(page, { name: 'Canonical <Name>', email: 'canonical@example.test', quantity: '3', message: 'front row & aisle' });
  await submit(page);
  assert.deepEqual(sendPayload(page), { liveId: 'fx-up-far', name: 'Canonical <Name>', email: 'canonical@example.test', quantity: 3, message: 'front row & aisle', company: '' });
  assert.doesNotMatch(JSON.stringify(sendPayload(page)), /Injected|injected|not-a-number/);
});

for (const [label, scenario] of [['the same id in upcoming and past', () => { const d = buildData(fixture); d.live.past.push({ ...d.live.upcoming[0], date: '2000-01-01' }); return d; }], ['the same id twice in upcoming', () => buildData(fixture, 'duplicate-id')]]) {
  test(`T43-TICKET-INIT duplicate Live IDs (${label}): the Ticket page refuses to identify the Live and sends nothing`, async () => {
    const page = await readyTicket(OPEN_ON_FAR, created(), { data: scenario() });
    assert.equal(notice(page).getAttribute('data-kind'), 'unidentified');
    assert.equal(el(page, 'ticket-layout').hidden, true);
    assert.equal(el(page, 'liveId').options.length, 0);
    await el(page, 'ticket-form').dispatchEvent(new Event('submit'));
    assert.equal(posts(page).length, 0);
    const noQuery = await readyTicket('', created(), { data: scenario() });
    assert.deepEqual(optionIds(noQuery).includes('fx-up-far'), false, 'an ambiguous Live is never offered');
  });
}

test('T43-TICKET-INIT the old admin copy elements stay removed: introText and noticeText are never read and no intro element exists', async () => {
  const html = readFileSync('ticket/index.html', 'utf8');
  assert.doesNotMatch(html, /id="ticket-intro"/);
  const data = buildData(fixture);
  let reads = 0;
  const ticket = { fields: data.ticket.fields, completeText: data.ticket.completeText };
  for (const key of ['introText', 'noticeText']) Object.defineProperty(ticket, key, { enumerable: true, get() { reads += 1; return 'legacy copy sentinel'; } });
  data.ticket = ticket;
  const page = await readyTicket('', created(), { data });
  assert.equal(reads, 0);
  assert.equal(el(page, 'ticket-intro'), null);
  assert.doesNotMatch(page.document.body.textContent, /legacy copy sentinel/);
  assert.equal(notice(page).hidden, true, 'the state notice is not fed by the removed notice text');
  assert.equal(el(page, 'submitBtn').hasAttribute('disabled'), false);
});

test('T43-FIELDS F-13 to F-15: every Ticket input, setting and summary item is on the new page', async () => {
  const page = await boot(OPEN_ON_FAR, { scenarios: ['multi-upcoming'] });
  for (const id of ['liveId', 'name', 'email', 'quantity', 'message', 'company', 'submitBtn']) assert.ok(el(page, id), `F-13 ${id}`);
  assert.equal(el(page, 'message').getAttribute('placeholder'), '例: 架空の入力例です', 'F-13 placeholder from settings');
  assert.equal(text(el(page, 'ticket-label-quantity')), '枚数（架空）', 'F-13 label');
  assert.equal(text(el(page, 'submitBtn')), 'この内容で予約する', 'F-13 submit label');
  const summary = el(page, 'ticket-live-preview');
  for (const selector of ['img', '.ticket-summary-date', '.ticket-summary-venue', '.ticket-summary-title', '.ticket-summary-details', 'a.site-text-link']) assert.ok(summary.querySelector(selector), `F-14 ${selector}`);
  fill(page, {});
  await submit(page);
  assert.ok(sendPayload(page), 'F-15 the send is on the page; the old confirmation overlay is gone');
  assert.equal(qa(page, '#ticketConfirmModal, .ticket-modal').length, 0, 'F-15');
});
