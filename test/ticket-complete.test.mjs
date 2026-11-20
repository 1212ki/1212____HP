import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Event, FIXED_NOW, buildData, deferred, envelope, jsonResponse, loadFixture, loadPage, settle } from './support/dom-harness.mjs';

const fixture = loadFixture();
const NOW = Date.parse(FIXED_NOW);
const KEY = '1212hp_ticket_receipt_v1';
const ADDRESS = '/ticket/complete/?liveId=fx-up-far&rid=fixture-ticket-0001';
const ids = ['site-config.js', 'live-operations.js', 'music-data.js', 'home-player.js', 'ticket-receipt.js', 'ticket-complete.js', 'script.js'];

const entry = (extra = {}) => ({
  v: 1,
  rid: 'fixture-ticket-0001',
  liveId: 'fx-up-far',
  savedAt: NOW - 60 * 1000,
  live: { date: '2026-12-26', venue: '架空ホールA', title: '架空の公演 A', image: 'https://fixture-images.example/flyer-up-far.png' },
  name: '架空 太郎',
  email: 'taro@example.test',
  quantity: 2,
  message: '架空の備考',
  ui: { completeText: '予約を受け付けました。当日お待ちしています。（架空）', labelQuantity: '枚数（架空）', labelMessage: 'ご連絡（架空）', showQuantity: true, showMessage: true },
  ...extra,
});
function storageWith(value) {
  const store = new Map(value === undefined ? [] : [[KEY, typeof value === 'string' ? value : JSON.stringify(value)]]);
  return { store, failWrites: false, getItem(k) { return store.has(k) ? store.get(k) : null; }, setItem(k, v) { store.set(k, String(v)); }, removeItem(k) { store.delete(k); } };
}
function open(address = ADDRESS, { receipt = entry(), data = buildData(fixture), fetch, scenarios = [], sessionStorage } = {}) {
  const payload = scenarios.length ? buildData(fixture, ...scenarios) : data;
  const page = loadPage({
    file: 'ticket/complete/index.html',
    url: `https://1212hp.example${address}`,
    fetch: fetch || (async () => jsonResponse(envelope(payload))),
    sessionStorage: sessionStorage || storageWith(receipt),
    skip: ['script.js'],
  });
  page.data = payload;
  return page;
}
const boot = async (...args) => { const page = open(...args); await settle(); return page; };
const q = (page, selector) => page.document.querySelector(selector);
const qa = (page, selector) => page.document.querySelectorAll(selector);
const el = (page, id) => page.document.getElementById(id);
const text = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);

// ---- real HTML ----------------------------------------------------------------------------
test('T43-COMPLETE real HTML: scripts, hooks, and a static default that never pretends a booking was made', () => {
  const html = readFileSync('ticket/complete/index.html', 'utf8');
  assert.match(html, /<body class="site-ticket">/);
  assert.match(html, /live-ticket\.css\?v=20261119-43/);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1].split('?')[0].split('/').pop());
  assert.deepEqual(scripts, ids);
  assert.doesNotMatch(html, /site-content\.js|Receipt ID/);
  const page = loadPage({ file: 'ticket/complete/index.html', url: `https://1212hp.example${ADDRESS}`, fetch: async () => {}, runScripts: false });
  const d = page.document;
  assert.equal(d.getElementById('ticket-complete-missing').hidden, false);
  assert.equal(d.getElementById('ticket-complete-ready').hidden, true);
  assert.equal(text(d.getElementById('ticket-complete-missing')), '予約の受付内容を表示できませんでした。 ライブの一覧へ →');
  assert.equal(text(d.getElementById('ticket-complete-message')), '予約しました。');
  assert.equal(d.getElementById('ticket-listen').hidden, true);
  assert.equal(d.querySelector('main').getAttribute('data-state'), 'missing');
  for (const id of ['ticket-complete-card', 'ticket-complete-message', 'ticket-player']) assert.ok(d.getElementById(id), id);
});

// ---- the receipt --------------------------------------------------------------------------
test('T43-COMPLETE a saved receipt shows the completion text, number, date, venue, title and everything that was sent', async () => {
  const page = await boot();
  assert.equal(q(page, 'main').getAttribute('data-state'), 'ready');
  assert.equal(el(page, 'ticket-complete-ready').hidden, false);
  assert.equal(el(page, 'ticket-complete-missing').hidden, true);
  assert.equal(text(el(page, 'ticket-complete-message')), '予約を受け付けました。当日お待ちしています。（架空）');
  const card = el(page, 'ticket-complete-card');
  assert.equal(card.querySelector('.ticket-complete-number').textContent, '受付番号　fixture-ticket-0001');
  assert.equal(card.querySelector('.ticket-complete-live').textContent, '2026.12.26(Sat)　架空ホールA');
  assert.equal(text(card.querySelector('.ticket-complete-title')), '架空の公演 A');
  assert.equal(card.querySelector('.ticket-complete-fields').textContent, '名前　架空 太郎\ne-mail　taro@example.test\n枚数（架空）　2\nご連絡（架空）　架空の備考');
  assert.equal(card.querySelector('img').getAttribute('src'), 'https://fixture-images.example/flyer-up-far.png');
  assert.doesNotMatch(page.document.body.textContent, /Receipt ID/);
});

test('T43-COMPLETE the completion text falls back to 予約しました。; the settings of the moment decide which lines appear; an empty note shows "-"', async () => {
  const empty = await boot(ADDRESS, { receipt: entry({ ui: { completeText: '', labelQuantity: '枚数', labelMessage: '備考', showQuantity: true, showMessage: true }, message: '' }) });
  assert.equal(text(el(empty, 'ticket-complete-message')), '予約しました。');
  assert.equal(q(empty, '.ticket-complete-fields').textContent, '名前　架空 太郎\ne-mail　taro@example.test\n枚数　2\n備考　-');
  const noQuantity = await boot(ADDRESS, { receipt: entry({ ui: { completeText: 'x', labelQuantity: '枚数', labelMessage: '備考', showQuantity: false, showMessage: true } }) });
  assert.doesNotMatch(q(noQuantity, '.ticket-complete-fields').textContent, /枚数/);
  const noMessage = await boot(ADDRESS, { receipt: entry({ ui: { completeText: 'x', labelQuantity: '枚数', labelMessage: '備考', showQuantity: true, showMessage: false } }) });
  assert.doesNotMatch(noMessage.document.querySelector('.ticket-complete-fields').textContent, /備考/);
  const neither = await boot(ADDRESS, { receipt: entry({ ui: { completeText: 'x', labelQuantity: '枚数', labelMessage: '備考', showQuantity: false, showMessage: false } }) });
  assert.equal(q(neither, '.ticket-complete-fields').textContent, '名前　架空 太郎\ne-mail　taro@example.test');
});

test('T43-COMPLETE text is escaped, long values are not cut, and no picture frame is drawn without a picture', async () => {
  const long = '長い備考です。'.repeat(80);
  const page = await boot(ADDRESS, { receipt: entry({ name: '<b>名前</b> & "q"', message: `${long}\n2行目`, live: { date: '2026-12-26', venue: '架空ホールA', title: '', image: '' }, rid: 'fixture-ticket-0001-with-a-very-long-receipt-number-without-any-break-0123456789' }) });
  assert.equal(page.document.getElementById('ticket-complete-ready').hidden, true, 'a different receipt number in the address is not shown');
  const shown = await boot('/ticket/complete/?liveId=fx-up-far&rid=fixture-ticket-0001-with-a-very-long-receipt-number-without-any-break-0123456789', { receipt: entry({ name: '<b>名前</b> & "q"', message: `${long}\n2行目`, live: { date: '2026-12-26', venue: '架空ホールA', title: '', image: '' }, rid: 'fixture-ticket-0001-with-a-very-long-receipt-number-without-any-break-0123456789' }) });
  const fields = q(shown, '.ticket-complete-fields');
  assert.equal(fields.querySelector('b'), null);
  assert.ok(fields.textContent.includes('<b>名前</b> & "q"'));
  assert.ok(fields.textContent.includes(`${long}\n2行目`));
  assert.equal(q(shown, '.ticket-complete-number').textContent, '受付番号　fixture-ticket-0001-with-a-very-long-receipt-number-without-any-break-0123456789');
  assert.equal(q(shown, '.ticket-complete-title'), null);
  assert.equal(q(shown, '#ticket-complete-card img'), null);
  assert.equal(q(shown, '#ticket-complete-card .ticket-complete-figure'), null);
});

test('T43-COMPLETE a picture that fails to load is dropped with its frame', async () => {
  const page = await boot();
  const img = q(page, '#ticket-complete-card img');
  const figure = q(page, '#ticket-complete-card .ticket-complete-figure');
  img.dispatchEvent(new Event('error', { bubbles: false }));
  assert.equal(figure.hidden, true);
});

test('T43-COMPLETE next steps: the Live detail, the other Lives and Home', async () => {
  const page = await boot();
  const links = qa(page, '.ticket-next a');
  assert.deepEqual(links.map((a) => text(a)), ['ライブの詳細 →', 'ほかのライブ →', 'Home →']);
  assert.deepEqual(links.map((a) => a.getAttribute('href')), ['../../live/detail/?liveId=fx-up-far', '../../live/', '../../']);
  assert.ok(links.every((a) => a.classList.contains('site-text-link')));
  const odd = 'internal "&/?=<live>';
  const encoded = `/ticket/complete/?liveId=${encodeURIComponent(odd)}&rid=fixture-ticket-0001`;
  const dangerous = await boot(encoded, { receipt: entry({ liveId: odd }) });
  assert.equal(qa(dangerous, '.ticket-next a')[0].getAttribute('href'), `../../live/detail/?liveId=${encodeURIComponent(odd)}`);
});

const missing = {
  'nothing saved': { receipt: undefined },
  'another receipt number in the address': { address: '/ticket/complete/?liveId=fx-up-far&rid=other' },
  'another Live in the address': { address: '/ticket/complete/?liveId=fx-up-near&rid=fixture-ticket-0001' },
  'no query at all (opened directly)': { address: '/ticket/complete/' },
  'older than 30 minutes': { receipt: entry({ savedAt: NOW - 30 * 60 * 1000 - 1 }) },
  'another version': { receipt: entry({ v: 2 }) },
  'broken JSON': { receipt: '{broken' },
  'a required value missing': { receipt: entry({ email: '' }) },
};
for (const [name, options] of Object.entries(missing)) {
  test(`T43-COMPLETE S43-13 ${name}: only the notice and a way back; no content is made up`, async () => {
    const page = await boot(options.address || ADDRESS, { receipt: options.receipt, sessionStorage: options.receipt === undefined ? storageWith() : undefined });
    assert.equal(q(page, 'main').getAttribute('data-state'), 'missing');
    assert.equal(el(page, 'ticket-complete-ready').hidden, true);
    assert.equal(el(page, 'ticket-complete-missing').hidden, false);
    assert.equal(text(el(page, 'ticket-complete-missing')), '予約の受付内容を表示できませんでした。 ライブの一覧へ →');
    assert.equal(el(page, 'ticket-complete-missing').querySelector('a').getAttribute('href'), '../../live/');
    assert.doesNotMatch(page.document.body.textContent, /架空 太郎|taro@example|fixture-ticket-0001|Receipt ID/);
    assert.equal(el(page, 'ticket-listen').hidden, true, 'no "listen" block without a receipt');
  });
}

test('T43-COMPLETE reading never removes the receipt (reload, Back and Forward show the same content); the listen data does not touch it', async () => {
  const storage = storageWith(entry());
  const first = await boot(ADDRESS, { sessionStorage: storage });
  const again = await boot(ADDRESS, { sessionStorage: storage });
  assert.equal(text(q(first, '#ticket-complete-card')), text(q(again, '#ticket-complete-card')));
  assert.equal(storage.store.has(KEY), true);
});

test('T43-COMPLETE the receipt does not wait for the network, and a failing network never hides it (only the listen block is skipped)', async () => {
  const gate = deferred();
  const waiting = open(ADDRESS, { fetch: () => gate.promise });
  await settle();
  assert.equal(q(waiting, 'main').getAttribute('data-state'), 'ready');
  assert.equal(el(waiting, 'ticket-complete-ready').hidden, false);
  assert.equal(el(waiting, 'ticket-listen').hidden, true);
  gate.resolve(jsonResponse(envelope(buildData(fixture))));
  await settle();
  assert.equal(el(waiting, 'ticket-listen').hidden, false);
  for (const make of [() => { throw new TypeError('offline'); }, () => jsonResponse({}, { ok: false, status: 500 }), () => jsonResponse(new Error('bad json')), () => jsonResponse({ data: [], meta: {} })]) {
    const page = await boot(ADDRESS, { fetch: async () => make() });
    assert.equal(el(page, 'ticket-complete-ready').hidden, false);
    assert.equal(q(page, '.ticket-complete-number').textContent, '受付番号　fixture-ticket-0001');
    assert.equal(el(page, 'ticket-listen').hidden, true);
  }
});

test('T43-COMPLETE the footer text comes from the site data and the page asks the public endpoint once', async () => {
  const page = await boot();
  assert.equal(el(page, 'site-footer').textContent, 'Synthetic studio — All rights reserved. 架空の確認用フッターです。');
  assert.equal(page.fetchCalls.length, 1);
  assert.equal(page.fetchCalls[0].url, 'https://1212hp.itsukimatsumoto.workers.dev/api/public/site-data');
  assert.equal(page.fetchCalls[0].method, 'GET');
});

test('T43-COMPLETE the old admin copy and query-string receipt are gone: nothing is read from ?date= or ?venue=', async () => {
  const page = await boot('/ticket/complete/?liveId=fx-up-far&rid=fixture-ticket-0001&date=2000-01-01&venue=Injected&name=Injected');
  assert.doesNotMatch(page.document.body.textContent, /Injected|2000/);
  assert.equal(q(page, '.ticket-complete-live').textContent, '2026.12.26(Sat)　架空ホールA');
});

// ---- listen -------------------------------------------------------------------------------
const listen = (page) => el(page, 'ticket-listen');
const play = (page) => q(page, '[data-ticket-action="play"]');

test('T43-LISTEN the featured release of Home appears with its type and date, a 聴く button, the store link and the way to Music', async () => {
  const page = await boot();
  assert.equal(listen(page).hidden, false);
  assert.equal(text(q(page, '#ticket-listen-label')), '当日までに聴く');
  assert.equal(text(q(page, '.ticket-listen-title')), '架空の作品 A');
  assert.equal(text(q(page, '.ticket-listen-meta')), 'Single ／ 2026.10.10');
  assert.equal(text(play(page)), '聴く');
  assert.equal(play(page).getAttribute('aria-expanded'), 'false');
  assert.equal(play(page).getAttribute('aria-controls'), 'ticket-player');
  const chip = q(page, '.ticket-listen-actions a.site-chip');
  assert.equal(text(chip), '配信先へ');
  assert.equal(chip.getAttribute('href'), 'https://music.example.test/release-a');
  assert.equal(chip.getAttribute('target'), '_blank');
  assert.equal(chip.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(chip.getAttribute('aria-label'), '配信先へ（外部サイト・別タブ）');
  const music = q(page, '#ticket-listen > a.site-text-link');
  assert.equal(text(music), 'music →');
  assert.equal(music.getAttribute('href'), '../../music/');
  assert.equal(q(page, '.ticket-listen-jacket img').getAttribute('src'), 'assets/images/fixture-art-a.png'.replace(/^/, '../../'));
});

test('T43-LISTEN it is the same work Home shows, in every featured-release setting', async () => {
  for (const [label, mutate] of [
    ['explicit', () => {}],
    ['automatic (newest)', (d) => { d.site.featuredReleaseId = ''; }],
    ['unknown id', (d) => { d.site.featuredReleaseId = 'nope'; }],
    ['a demo', (d) => { d.site.featuredReleaseId = 'release-c'; }],
    ['without a video', (d) => { d.site.featuredReleaseId = 'release-b'; }],
  ]) {
    const data = buildData(fixture);
    mutate(data);
    const home = loadPage({ file: 'index.html', url: 'https://1212hp.example/', fetch: async () => jsonResponse(envelope(data)), only: ['site-config.js', 'live-operations.js', 'music-data.js', 'home-player.js', 'site-content.js'] });
    await settle();
    const page = await boot(ADDRESS, { data });
    assert.equal(text(q(page, '.ticket-listen-title')), text(home.document.querySelector('.home-release-title')), label);
    assert.equal(text(q(page, '.ticket-listen-meta')), text(home.document.querySelector('.home-release-meta')), label);
    assert.equal(Boolean(play(page)), Boolean(home.document.querySelector('[data-testid="home-listen"]')), `${label}: 聴く shown on both or neither`);
    assert.equal(text(q(page, '.ticket-listen-actions a.site-chip')), text(home.document.querySelector('.home-release-actions a.site-chip')), `${label}: link label`);
  }
});

test('T43-LISTEN 聴く appears only for a valid video; otherwise only the external link (配信先へ / 購入先へ) remains', async () => {
  const noVideo = await boot(ADDRESS, { scenarios: ['no-video'] });
  assert.equal(play(noVideo), null);
  assert.equal(text(q(noVideo, '.ticket-listen-actions a.site-chip')), '配信先へ');
  assert.equal(q(noVideo, '#ticket-player').hidden, true);
  const bad = await boot(ADDRESS, { scenarios: ['bad-video'] });
  assert.equal(play(bad), null, 'a malformed YouTube id is not offered');
  const demo = buildData(fixture);
  demo.site.featuredReleaseId = 'release-c';
  demo.discography.demo[0].playbackVideoId = 'video-b';
  const demoPage = await boot(ADDRESS, { data: demo });
  assert.equal(text(q(demoPage, '.ticket-listen-actions a.site-chip')), '購入先へ');
  assert.ok(play(demoPage), 'a video from the live-movie list is found too');
  for (const link of ['', 'javascript:alert(1)', 'data:text/plain,x', 'not a url']) {
    const data = buildData(fixture);
    data.discography.digital[0].link = link;
    const page = await boot(ADDRESS, { data });
    assert.equal(q(page, '.ticket-listen-actions a.site-chip'), null, link);
  }
});

test('T43-LISTEN no release at all: the whole block is hidden', async () => {
  const page = await boot(ADDRESS, { scenarios: ['no-release'] });
  assert.equal(listen(page).hidden, true);
  assert.equal(qa(page, '#ticket-listen .ticket-listen-title').length, 0);
});

test('T43-LISTEN pressing 聴く opens exactly one embedded player; pressing again, pagehide or a second open closes it', async () => {
  const page = await boot();
  const host = el(page, 'ticket-player');
  await play(page).click();
  assert.equal(qa(page, 'iframe').length, 1);
  const frame = host.querySelector('iframe');
  assert.equal(frame.getAttribute('src'), 'https://www.youtube.com/embed/abcdefghijk?autoplay=1&playsinline=1&controls=1&rel=0');
  assert.equal(frame.getAttribute('allow'), 'autoplay; encrypted-media; picture-in-picture; fullscreen');
  assert.equal(frame.getAttribute('title'), '架空の作品 A — YouTube player');
  assert.equal(host.hidden, false);
  const button = q(page, '.ticket-listen-actions button');
  assert.equal(text(button), '閉じる');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(host.nextElementSibling, button.parentNode, 'the player sits right before the buttons');
  await button.click();
  assert.equal(qa(page, 'iframe').length, 0);
  assert.equal(host.hidden, true);
  assert.equal(text(play(page)), '聴く');
  assert.equal(play(page).getAttribute('aria-expanded'), 'false');
  await play(page).click();
  assert.equal(qa(page, 'iframe').length, 1);
  page.fire('pagehide');
  assert.equal(qa(page, 'iframe').length, 0);
});

test('T43-LISTEN the jacket falls back to a pale face with the artist name when there is no picture or it fails; the title stays as text', async () => {
  const noImage = buildData(fixture);
  noImage.discography.digital[0].image = '';
  const page = await boot(ADDRESS, { data: noImage });
  assert.equal(q(page, '.ticket-listen-jacket img'), null);
  assert.equal(text(q(page, '.ticket-listen-jacket .ticket-listen-fallback')), '松本一樹');
  assert.equal(text(q(page, '.ticket-listen-title')), '架空の作品 A');
  const broken = await boot();
  const img = q(broken, '.ticket-listen-jacket img');
  const face = q(broken, '.ticket-listen-jacket .ticket-listen-fallback');
  assert.equal(face.hidden, true);
  img.dispatchEvent(new Event('error', { bubbles: false }));
  assert.equal(img.hidden, true);
  assert.equal(face.hidden, false);
});

// ---- the three screens, joined ------------------------------------------------------------
test('T43-FLOW list → Ticket → complete: the receipt written by Ticket is what the complete page shows, in the same tab', async () => {
  const data = buildData(fixture, 'multi-upcoming');
  const shared = storageWith();
  const reply = async (url, options, call) => {
    if (call.method !== 'POST') return jsonResponse(envelope(data));
    return jsonResponse({ ok: true, reservation: { id: 'fixture-ticket-0001', liveId: call.body.liveId, liveDate: '2026-12-26', liveVenue: '架空ホールA', name: call.body.name, email: call.body.email, quantity: call.body.quantity, message: call.body.message } }, { status: 201 });
  };
  const listPage = loadPage({ file: 'live/index.html', url: 'https://1212hp.example/live/', skip: ['script.js'], fetch: async () => jsonResponse(envelope(data)) });
  await settle();
  const reserve = listPage.document.querySelectorAll('[data-testid="live-card"]').find((c) => c.getAttribute('data-live-id') === 'fx-up-far').querySelector('[data-testid="live-reserve"]');
  const ticketUrl = new URL(reserve.getAttribute('href'), 'https://1212hp.example/live/');
  const ticket = loadPage({ file: 'ticket/index.html', url: ticketUrl.href, skip: ['script.js'], sessionStorage: shared, fetch: reply });
  await settle();
  const set = (id, value) => { const c = ticket.document.getElementById(id); c.value = value; c.dispatchEvent(new Event('input')); };
  set('name', '架空 花子'); set('email', 'hanako@example.test'); set('quantity', '3'); set('message', '流れの確認');
  await ticket.document.getElementById('submitBtn').click();
  await settle();
  const completeUrl = new URL(ticket.location.replaced[0], ticketUrl);
  assert.equal(completeUrl.pathname, '/ticket/complete/');
  assert.doesNotMatch(completeUrl.href, /花子|hanako|流れ/);
  const complete = loadPage({ file: 'ticket/complete/index.html', url: completeUrl.href, skip: ['script.js'], sessionStorage: shared, fetch: async () => jsonResponse(envelope(data)) });
  await settle();
  assert.equal(complete.document.getElementById('ticket-complete-ready').hidden, false);
  assert.equal(complete.document.querySelector('.ticket-complete-fields').textContent, '名前　架空 花子\ne-mail　hanako@example.test\n枚数（架空）　3\nご連絡（架空）　流れの確認');
  assert.equal(complete.document.querySelector('.ticket-complete-live').textContent, '2026.12.26(Sat)　架空ホールA');
  assert.equal(text(complete.document.getElementById('ticket-complete-message')), '予約を受け付けました。当日お待ちしています。（架空）');
  const otherTab = loadPage({ file: 'ticket/complete/index.html', url: completeUrl.href, skip: ['script.js'], fetch: async () => jsonResponse(envelope(data)) });
  await settle();
  assert.equal(otherTab.document.getElementById('ticket-complete-ready').hidden, true, 'another tab has no receipt');
});

test('T43-FIELDS F-16 to F-19: completion text, receipt, next steps and the new listen block', async () => {
  const page = await boot();
  assert.equal(text(el(page, 'ticket-complete-message')), '予約を受け付けました。当日お待ちしています。（架空）', 'F-16');
  assert.match(el(page, 'ticket-complete-card').textContent, /受付番号　fixture-ticket-0001/, 'F-17 number');
  assert.match(el(page, 'ticket-complete-card').textContent, /2026\.12\.26\(Sat\)　架空ホールA/, 'F-17 date and venue');
  assert.deepEqual(qa(page, '.ticket-next a').map((a) => text(a)), ['ライブの詳細 →', 'ほかのライブ →', 'Home →'], 'F-18');
  assert.equal(el(page, 'ticket-listen').hidden, false, 'F-19');
  assert.equal(text(q(page, '#ticket-listen-label')), '当日までに聴く', 'F-19');
});
