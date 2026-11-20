import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Event, buildData, deferred, envelope, badJsonResponse, jsonResponse, loadFixture, loadPage, settle, FIXED_NOW } from './support/dom-harness.mjs';

const fixture = loadFixture();
const API = 'https://1212hp.itsukimatsumoto.workers.dev';
const NOW = Date.parse(FIXED_NOW);

function open(file, url, { scenarios = [], data = buildData(fixture, ...scenarios), fetch = async () => jsonResponse(envelope(data)), skip = ['script.js'] } = {}) {
  const page = loadPage({ file, url: `https://1212hp.example${url}`, fetch, skip });
  page.data = data;
  return page;
}
const list = async (opts) => { const page = open('live/index.html', '/live/', opts); await settle(); return page; };
const detail = async (query, opts) => { const page = open('live/detail/index.html', `/live/detail/${query}`, opts); await settle(); return page; };
const q = (page, selector) => page.document.querySelector(selector);
const qa = (page, selector) => page.document.querySelectorAll(selector);
const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
const testids = (page, id) => qa(page, `[data-testid="${id}"]`);
const ops = (page) => page.window.LiveOperations;
const order = (page) => page.window.LiveOrder;

test('T43-LIST real HTML: body class, hooks, script order, no site-content.js, new stylesheet', () => {
  for (const [file, rootId] of [['live/index.html', 'live-content'], ['live/detail/index.html', 'live-detail-content']]) {
    const html = readFileSync(file, 'utf8');
    assert.match(html, /<body class="site-live">/);
    assert.ok(html.includes(`id="${rootId}"`));
    assert.match(html, /live-ticket\.css\?v=20261119-43/);
    assert.doesNotMatch(html, /site-content\.js/);
    const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1].split('?')[0].split('/').pop());
    assert.deepEqual(scripts, ['site-config.js', 'live-operations.js', 'live-order.js', 'reservation-cta.js', 'live-pages.js', 'script.js']);
    assert.match(html, /data-state="loading"/);
    assert.match(html, /aria-busy="true"/);
  }
});

test('T43-LIST upcoming cards are in nearest-first order with flyer, date, venue, title, two detail lines, reserve and 詳細', async () => {
  const page = await list({ scenarios: ['multi-upcoming'] });
  const cards = testids(page, 'live-card');
  assert.deepEqual(cards.map((c) => c.getAttribute('data-live-id')), ['fx-up-stale', 'fx-up-near', 'fx-up-far', 'fx-up-ext', 'fx-up-closed', 'fx-up-invalid', 'fx-up-social']);
  const far = cards[2];
  assert.equal(text(far.querySelector('.live-card-date')), '2026.12.26(Sat)');
  assert.equal(text(far.querySelector('.live-card-venue')), '架空ホールA');
  assert.equal(text(far.querySelector('.live-card-title')), '架空の公演 A');
  const lines = ops(page).formatLiveDetails(page.data.live.upcoming.find((l) => l.id === 'fx-up-far')).split('\n');
  assert.equal(far.querySelector('.live-card-details').textContent, lines.slice(0, 2).join('\n'));
  assert.ok(!far.textContent.includes(lines[2]), 'only the first two lines');
  const flyer = far.querySelector('a.live-card-flyer');
  assert.equal(flyer.getAttribute('href'), 'detail/?liveId=fx-up-far');
  assert.equal(flyer.querySelector('img').getAttribute('src'), 'https://fixture-images.example/flyer-up-far.png?v=2026-11-18T00%3A00%3A00.000Z');
  const [reserve, more] = far.querySelector('.live-card-actions').children;
  assert.equal(reserve.getAttribute('data-testid'), 'live-reserve');
  assert.equal(text(reserve), '予約する');
  assert.equal(reserve.getAttribute('href'), '../ticket/?liveId=fx-up-far');
  assert.ok(reserve.classList.contains('site-button--primary'));
  assert.equal(text(more), '詳細');
  assert.equal(more.getAttribute('href'), 'detail/?liveId=fx-up-far');
  assert.ok(more.classList.contains('site-button--secondary'));
  assert.equal(cards[0].querySelector('.live-card-title'), null, 'an empty title is not rendered');
});

test('T43-LIST reservation kinds in the list: closed, invalid and past-dated upcoming show no 予約する; external opens a new tab', async () => {
  const page = await list({ scenarios: ['multi-upcoming'] });
  const by = Object.fromEntries(testids(page, 'live-card').map((c) => [c.getAttribute('data-live-id'), c.querySelector('[data-testid="live-reserve"]')]));
  assert.equal(by['fx-up-stale'].getAttribute('data-kind'), 'closed');
  assert.equal(by['fx-up-closed'].getAttribute('data-kind'), 'closed');
  assert.equal(by['fx-up-invalid'].getAttribute('data-kind'), 'invalid');
  assert.equal(text(by['fx-up-invalid']), '予約先を確認中');
  for (const id of ['fx-up-stale', 'fx-up-closed', 'fx-up-invalid']) {
    assert.equal(by[id].localName, 'span');
    assert.equal(by[id].getAttribute('aria-disabled'), 'true');
    assert.ok(by[id].classList.contains('is-inactive'));
    assert.equal(by[id].getAttribute('href'), null);
    assert.notEqual(text(by[id]), '予約する');
  }
  assert.equal(by['fx-up-ext'].getAttribute('data-kind'), 'external');
  assert.equal(text(by['fx-up-ext']), '予約する（外部サイト）');
  assert.equal(by['fx-up-ext'].getAttribute('target'), '_blank');
  assert.equal(by['fx-up-ext'].getAttribute('rel'), 'noopener noreferrer');
  assert.equal(by['fx-up-ext'].getAttribute('href'), 'https://tickets.example.test/e/100?from=fx&slot=1');
  assert.equal(by['fx-up-social'].getAttribute('data-kind'), 'internal');
  assert.doesNotMatch(page.document.body.textContent, /予約URLが無効です/);
});

test('T43-LIST past: newest first, only the first three, with date, venue, title and an arrow; whole row is the link', async () => {
  const page = await list();
  const rows = testids(page, 'live-past-row');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.getAttribute('href')), ['detail/?liveId=fx-past-01', 'detail/?liveId=fx-past-02', 'detail/?liveId=fx-past-03']);
  assert.equal(rows[0].localName, 'a');
  assert.equal(text(rows[0].querySelector('.live-past-date')), '2026.10.31(Sat)');
  assert.equal(text(rows[0].querySelector('.live-past-venue')), '架空ライブハウス C');
  assert.equal(text(rows[0].querySelector('.live-past-title')), '架空の企画「ハロウィン」');
  assert.equal(text(rows[0].querySelector('.live-past-arrow')), '→');
  assert.equal(rows[0].querySelector('.live-past-arrow').getAttribute('aria-hidden'), 'true');
  const all = q(page, '#live-past-all');
  assert.equal(all.hidden, false);
  assert.equal(text(all), '終了したライブをすべて見る →');
  assert.equal(all.getAttribute('href'), './detail/?view=past');
  assert.ok(all.classList.contains('site-text-link'));
});

test('T43-LIST the all-link appears only above three past Lives; three or fewer show every row', async () => {
  const data = buildData(fixture);
  data.live.past = data.live.past.slice(0, 3);
  const three = await list({ data });
  assert.equal(testids(three, 'live-past-row').length, 3);
  assert.equal(q(three, '#live-past-all').hidden, true);
  data.live.past = data.live.past.slice(0, 1);
  const one = await list({ data });
  assert.equal(testids(one, 'live-past-row').length, 1);
  assert.equal(q(one, '#live-past-all').hidden, true);
});

test('T43-LIST hrefs encode the Live ID once and keep dangerous characters out of markup', async () => {
  const data = buildData(fixture);
  const id = 'internal "&/?=<live>';
  data.live.upcoming = [{ id, date: '2027-02-01', venue: '<Hall & "Co">', title: '<b>x</b>', ticketUrl: '' }];
  data.live.past = [{ id: 'p "&', date: '2026-01-01', venue: 'v', title: 't' }];
  const page = await list({ data });
  const encoded = encodeURIComponent(id);
  assert.equal(q(page, '[data-testid="live-reserve"]').getAttribute('href'), `../ticket/?liveId=${encoded}`);
  assert.equal(q(page, '.live-card-actions .site-button--secondary').getAttribute('href'), `detail/?liveId=${encoded}`);
  assert.equal(q(page, '[data-testid="live-past-row"]').getAttribute('href'), `detail/?liveId=${encodeURIComponent('p "&')}`);
  assert.equal(q(page, '.live-card-venue').textContent, '<Hall & "Co">');
  assert.equal(qa(page, '.live-card b').length, 0);
  assert.doesNotMatch(q(page, '#live-upcoming').innerHTML, /<b>x<\/b>/);
});

test('T43-LIST duplicate or empty IDs offer neither reservation nor detail; the helper missing offers none either', async () => {
  const dup = await list({ scenarios: ['duplicate-id'] });
  for (const card of testids(dup, 'live-card').filter((c) => c.getAttribute('data-live-id') === 'fx-up-far')) {
    assert.equal(card.querySelector('[data-testid="live-reserve"]'), null);
    assert.equal(card.querySelector('.site-button--secondary'), null);
  }
  const data = buildData(fixture);
  data.live.upcoming[0].id = '';
  const empty = await list({ data });
  assert.equal(testids(empty, 'live-card')[1].querySelector('[data-testid="live-reserve"]'), null);
  const page = open('live/index.html', '/live/', { skip: ['script.js', 'live-operations.js'] });
  await settle();
  assert.equal(page.document.getElementById('live-content').getAttribute('data-state'), 'error');
  assert.equal(testids(page, 'live-reserve').length, 0);
});

test('T43-LIST images: relative paths resolve from the site root, a missing image shows the date on a pale face, a broken image swaps in the face', async () => {
  const data = buildData(fixture, 'multi-upcoming');
  const page = await list({ data });
  const stale = testids(page, 'live-card').find((c) => c.getAttribute('data-live-id') === 'fx-up-stale');
  assert.equal(stale.querySelector('img').getAttribute('src'), '../assets/images/fixture-flyer-b.png?v=2026-11-18T00%3A00%3A00.000Z');
  const closed = testids(page, 'live-card').find((c) => c.getAttribute('data-live-id') === 'fx-up-closed');
  assert.equal(closed.querySelector('img'), null);
  assert.equal(text(closed.querySelector('[data-testid="live-flyer-fallback"]')), '2027.01.17');
  const far = testids(page, 'live-card').find((c) => c.getAttribute('data-live-id') === 'fx-up-far');
  const image = far.querySelector('img');
  const fallback = far.querySelector('[data-testid="live-flyer-fallback"]');
  assert.equal(fallback.hidden, true);
  image.dispatchEvent(new Event('error', { bubbles: false }));
  assert.equal(image.hidden, true);
  assert.equal(fallback.hidden, false);
  assert.equal(text(fallback), '2026.12.26');
});

test('T43-LIST sections and headings: 開催予定 and 終了したライブ are headings; the page keeps one live title with the red rule class', async () => {
  const page = await list();
  assert.equal(text(q(page, '#live-upcoming-heading')), '開催予定');
  assert.equal(text(q(page, '#live-past-heading')), '終了したライブ');
  assert.equal(q(page, '#live-upcoming-heading').localName, 'h2');
  const title = q(page, 'main h1.site-section-title');
  assert.equal(text(title), 'live');
  assert.equal(page.document.getElementById('live-content').getAttribute('data-state'), 'ready');
  assert.equal(page.document.getElementById('live-content').getAttribute('aria-busy'), 'false');
});

test('T43-STATE-LIST loading first: skeleton with role=status 読み込み中 and aria-busy, not an empty list', async () => {
  const pending = deferred();
  const page = open('live/index.html', '/live/', { fetch: () => pending.promise });
  await settle();
  const main = page.document.getElementById('live-content');
  assert.equal(main.getAttribute('data-state'), 'loading');
  assert.equal(main.getAttribute('aria-busy'), 'true');
  assert.equal(text(q(page, '[role="status"]')), '読み込み中');
  assert.equal(q(page, '#live-upcoming').hidden, true);
  assert.equal(testids(page, 'live-empty-upcoming').length, 0);
  assert.equal(page.fetchCalls[0].url, `${API}/api/public/site-data`);
  assert.equal(page.fetchCalls[0].options.cache, 'no-store');
  pending.resolve(jsonResponse(envelope(buildData(fixture))));
  await settle();
  assert.equal(main.getAttribute('data-state'), 'ready');
  assert.equal(q(page, '[role="status"]'), null);
});

test('T43-STATE-LIST S43-01 and S43-02: empty arrays are states, not errors', async () => {
  const none = await list({ scenarios: ['empty-upcoming'] });
  assert.equal(text(q(none, '[data-testid="live-empty-upcoming"]')), '次のライブは、決まり次第ここでお知らせします。');
  assert.equal(text(q(none, '#live-upcoming-heading')), '開催予定');
  assert.equal(q(none, '#live-past').hidden, false);
  assert.equal(testids(none, 'live-error').length, 0);
  const noPast = await list({ scenarios: ['empty-past'] });
  assert.equal(q(noPast, '#live-past').hidden, true);
  assert.equal(q(noPast, '#live-past-all').hidden, true);
  assert.equal(testids(noPast, 'live-card').length, 2);
  assert.equal(testids(noPast, 'live-error').length, 0);
});

const failures = {
  'network failure': () => { throw new TypeError('Failed to fetch'); },
  'HTTP failure': () => jsonResponse({}, { ok: false, status: 503 }),
  'invalid JSON': () => badJsonResponse(true),
  'data is an array': () => jsonResponse({ data: [], meta: {} }),
  'data is null': () => jsonResponse({ data: null, meta: {} }),
};
for (const [name, make] of Object.entries(failures)) {
  test(`T43-STATE-LIST S43-03 ${name} shows the load error with a retry`, async () => {
    const page = await list({ fetch: async () => make() });
    assert.equal(page.document.getElementById('live-content').getAttribute('data-state'), 'error');
    assert.equal(page.document.getElementById('live-content').getAttribute('aria-busy'), 'false');
    assert.match(text(q(page, '[data-testid="live-error"]')), /ライブ情報を読み込めませんでした。/);
    assert.equal(text(q(page, '[data-testid="live-retry"]')), 'もう一度読み込む');
    assert.equal(testids(page, 'live-card').length, 0);
    assert.equal(testids(page, 'live-empty-upcoming').length, 0);
  });
}
for (const scenario of ['invalid-live', 'invalid-upcoming', 'invalid-past']) {
  test(`T43-STATE-LIST S43-03 malformed shape (${scenario}) is an error, distinct from an empty array`, async () => {
    const page = await list({ scenarios: [scenario] });
    assert.equal(page.document.getElementById('live-content').getAttribute('data-state'), 'error');
    assert.equal(testids(page, 'live-empty-upcoming').length, 0);
    assert.equal(testids(page, 'live-retry').length, 1);
  });
}

test('T43-STATE-LIST retry: one request at a time, the old error is replaced, focus moves to the heading on success', async () => {
  let attempt = 0;
  const gate = deferred();
  const page = await list({ fetch: async () => { attempt += 1; if (attempt === 1) throw new TypeError('x'); await gate.promise; return jsonResponse(envelope(buildData(fixture))); } });
  const retry = () => q(page, '[data-testid="live-retry"]');
  assert.equal(page.document.activeElement, null, 'the first load does not move focus');
  const first = retry().click();
  retry()?.click();
  await settle();
  assert.equal(page.fetchCalls.length, 2, 'a second click while pending sends no request');
  gate.resolve();
  await first;
  await settle();
  assert.equal(page.document.getElementById('live-content').getAttribute('data-state'), 'ready');
  assert.equal(testids(page, 'live-error').length, 0);
  assert.equal(page.document.activeElement, q(page, 'main h1.site-section-title'));
});

test('T43-STATE-LIST a failing retry puts focus on the new retry button; listeners do not accumulate', async () => {
  const page = await list({ fetch: async () => { throw new TypeError('down'); } });
  const main = page.document.getElementById('live-content');
  const before = main.listenerCount('click');
  const windowBefore = page.winTarget.listenerCount('pagehide') + page.winTarget.listenerCount('pageshow');
  for (let i = 0; i < 3; i += 1) {
    await q(page, '[data-testid="live-retry"]').click();
    await settle();
    assert.equal(page.document.activeElement, q(page, '[data-testid="live-retry"]'));
  }
  assert.equal(page.fetchCalls.length, 4);
  assert.equal(main.listenerCount('click'), before);
  assert.equal(page.winTarget.listenerCount('pagehide') + page.winTarget.listenerCount('pageshow'), windowBefore);
});

test('T43-STATE-LIST pagehide discards a pending response; pageshow from the cache loads again', async () => {
  const first = deferred();
  let calls = 0;
  const page = open('live/index.html', '/live/', { fetch: () => { calls += 1; return calls === 1 ? first.promise : Promise.resolve(jsonResponse(envelope(buildData(fixture)))); } });
  await settle();
  page.fire('pagehide');
  assert.equal(page.document.getElementById('live-content').getAttribute('aria-busy'), 'false');
  first.resolve(jsonResponse(envelope(buildData(fixture, 'empty-upcoming'))));
  await settle();
  assert.equal(testids(page, 'live-empty-upcoming').length, 0, 'the stale response is dropped');
  page.fire('pageshow', { persisted: false });
  await settle();
  assert.equal(calls, 1);
  page.fire('pageshow', { persisted: true });
  await settle();
  assert.equal(calls, 2);
  assert.equal(testids(page, 'live-card').length, 2);
  page.fire('pageshow', { persisted: true });
  await settle();
  assert.equal(calls, 2, 'only an interrupted load is repeated');
});

test('T43-STATE-LIST the footer text comes from the site data', async () => {
  const page = await list();
  assert.equal(page.document.getElementById('site-footer').textContent, 'Synthetic studio — All rights reserved. 架空の確認用フッターです。');
});

// ---- detail -----------------------------------------------------------------------------
test('T43-DETAIL heading is date then venue then title; DOM order is heading, actions, flyer, information', async () => {
  const page = await detail('?liveId=fx-up-far');
  const root = q(page, '[data-testid="live-detail"]');
  assert.equal(text(q(page, 'h1.live-detail-date')), '2026.12.26(Sat)');
  assert.equal(text(q(page, '.live-detail-venue')), '架空ホールA');
  assert.equal(text(q(page, '.live-detail-title')), '架空の公演 A');
  const parts = root.querySelector('.live-detail-main').children.map((c) => c.getAttribute('data-part'));
  assert.deepEqual(parts, ['head', 'actions', 'flyer', 'info']);
  assert.equal(page.document.title, '架空の公演 A | 2026.12.26(Sat) 架空ホールA | 松本一樹');
  assert.equal(page.document.getElementById('live-detail-content').getAttribute('data-state'), 'ready');
  const back = q(page, '#live-back');
  assert.equal(text(back), '← live');
  assert.equal(back.getAttribute('href'), '../');
});

test('T43-DETAIL information rows are exactly the Home formatter lines; the empty title shows no Coming Soon', async () => {
  const page = await detail('?liveId=fx-up-far');
  const live = page.data.live.upcoming.find((l) => l.id === 'fx-up-far');
  const expected = ops(page).formatLiveDetails(live).split('\n');
  const rows = qa(page, '[data-part="info"] li').map((li) => li.textContent);
  assert.deepEqual(rows, expected);
  assert.equal(q(page, '[data-testid="live-detail-description"]'), null);
  const noTitle = await detail('?liveId=fx-up-stale');
  assert.equal(q(noTitle, '.live-detail-title'), null);
  assert.doesNotMatch(noTitle.document.body.textContent, /Coming Soon/);
  assert.equal(noTitle.document.title, '2026.11.18(Wed) 架空ライブハウスB | 松本一樹');
});

test('T43-DETAIL when the four detail fields are empty the description is shown whole, keeping line breaks and blank lines', async () => {
  const page = await detail('?liveId=fx-past-09');
  const block = q(page, '[data-testid="live-detail-description"]');
  assert.equal(qa(page, '[data-part="info"] li').length, 0);
  assert.equal(block.textContent, '1行目\n2行目\n3行目\n4行目\n5行目\n6行目\n\n8行目（空行のあと）\n9行目');
  const only = await detail('?liveId=fx-past-06');
  assert.equal(q(only, '[data-testid="live-detail-description"]').textContent, '架空の説明だけのライブ。\n時間や料金は未登録のため、説明を全文で出す。');
  const brs = buildData(fixture);
  brs.live.past[0] = { id: 'brs', date: '2026-01-01', venue: 'v', title: '', description: 'a<br>b<br/>c' };
  const withBr = await detail('?liveId=brs', { data: brs });
  assert.equal(q(withBr, '[data-testid="live-detail-description"]').textContent, 'a\nb\nc');
});

test('T43-DETAIL the Instagram button appears only for an Instagram address; other links are not shown', async () => {
  const insta = await detail('?liveId=fx-up-far');
  const button = qa(insta, '[data-part="actions"] a').find((a) => text(a) === 'Instagram');
  assert.equal(button.getAttribute('href'), 'https://www.instagram.com/fixture_account/');
  assert.equal(button.getAttribute('target'), '_blank');
  assert.equal(button.getAttribute('rel'), 'noopener noreferrer');
  assert.ok(button.classList.contains('site-button--secondary'));
  const form = await detail('?liveId=fx-past-02');
  assert.equal(qa(form, '[data-part="actions"] a').length, 0);
  assert.doesNotMatch(form.document.body.innerHTML, /forms\.example\.test/);
  const social = await detail('?liveId=fx-up-social', { scenarios: ['multi-upcoming'] });
  assert.equal(qa(social, '[data-part="actions"] a').filter((a) => text(a) === 'Instagram').length, 1);
});

test('T43-DETAIL the four reservation outcomes; none of the closed ones offers 予約する or a link', async () => {
  const expectations = { 'fx-up-far': ['internal', '予約する'], 'fx-up-ext': ['external', '予約する（外部サイト）'], 'fx-up-closed': ['closed', '予約受付終了'], 'fx-up-invalid': ['invalid', '予約先を確認中'], 'fx-up-stale': ['closed', '予約受付終了'], 'fx-past-01': ['closed', '予約受付終了'] };
  for (const [id, [kind, label]] of Object.entries(expectations)) {
    const page = await detail(`?liveId=${id}`, { scenarios: ['multi-upcoming'] });
    const reserve = q(page, '[data-testid="live-reserve"]');
    assert.equal(reserve.getAttribute('data-kind'), kind, id);
    assert.equal(text(reserve), label, id);
    if (kind === 'closed' || kind === 'invalid') {
      assert.equal(reserve.localName, 'span');
      assert.equal(reserve.getAttribute('href'), null);
      assert.equal(reserve.getAttribute('aria-disabled'), 'true');
    }
  }
  const internal = await detail('?liveId=fx-up-far');
  assert.equal(q(internal, '[data-testid="live-reserve"]').getAttribute('href'), '../../ticket/?liveId=fx-up-far');
  assert.ok(q(internal, '[data-testid="live-reserve"]').classList.contains('site-button--primary'));
});

test('T43-DETAIL flyer: shown at its original ratio, a missing image shows the date, a broken image swaps to the date face', async () => {
  const page = await detail('?liveId=fx-up-far');
  const img = q(page, '[data-part="flyer"] img');
  assert.equal(img.getAttribute('src'), 'https://fixture-images.example/flyer-up-far.png?v=2026-11-18T00%3A00%3A00.000Z');
  assert.equal(img.getAttribute('alt'), '');
  const face = q(page, '[data-testid="live-flyer-fallback"]');
  assert.equal(face.hidden, true);
  img.dispatchEvent(new Event('error', { bubbles: false }));
  assert.equal(img.hidden, true);
  assert.equal(face.hidden, false);
  assert.equal(text(face), '2026.12.26');
  const none = await detail('?liveId=fx-up-closed', { scenarios: ['multi-upcoming'] });
  assert.equal(q(none, '[data-part="flyer"] img'), null);
  assert.equal(text(q(none, '[data-testid="live-flyer-fallback"]')), '2027.01.17');
  const relative = await detail('?liveId=fx-up-stale');
  assert.equal(q(relative, '[data-part="flyer"] img').getAttribute('src'), '../../assets/images/fixture-flyer-b.png?v=2026-11-18T00%3A00%3A00.000Z');
  const unreadable = await detail('?liveId=fx-past-12');
  assert.equal(text(q(unreadable, '[data-testid="live-flyer-fallback"]')), '近日発表', 'an unparsable date is shown as written');
});

test('T43-STATE-DETAIL S43-04: no liveId, unknown, duplicate: one notice, no reservation, a way back', async () => {
  for (const [query, scenarios] of [['', []], ['?liveId=', []], ['?liveId=fx-nope', []], ['?liveId=fx-up-far', ['duplicate-id']], ['?view=other', []]]) {
    const page = await detail(query, { scenarios });
    const notice = q(page, '[data-testid="live-detail-notfound"]');
    assert.ok(notice, query);
    assert.match(text(notice), /このライブは見つかりませんでした。/);
    assert.match(text(notice), /アドレスが変わったか、掲載が終わった可能性があります。/);
    const back = notice.querySelector('a');
    assert.equal(text(back), 'ライブの一覧へ →');
    assert.equal(back.getAttribute('href'), '../');
    assert.equal(testids(page, 'live-reserve').length, 0);
    assert.equal(page.document.getElementById('live-detail-content').getAttribute('data-state'), 'empty');
  }
});

test('T43-STATE-DETAIL S43-03 and loading: error with retry; skeleton while pending; retry reloads', async () => {
  const pending = deferred();
  const loading = open('live/detail/index.html', '/live/detail/?liveId=fx-up-far', { fetch: () => pending.promise });
  await settle();
  assert.equal(loading.document.getElementById('live-detail-content').getAttribute('data-state'), 'loading');
  assert.equal(text(q(loading, '[role="status"]')), '読み込み中');
  let attempt = 0;
  const page = await detail('?liveId=fx-up-far', { fetch: async () => { attempt += 1; if (attempt === 1) return jsonResponse({}, { ok: false, status: 500 }); return jsonResponse(envelope(buildData(fixture))); } });
  assert.match(text(q(page, '[data-testid="live-error"]')), /ライブ情報を読み込めませんでした。/);
  assert.equal(testids(page, 'live-detail-notfound').length, 0, 'a load failure is not "not found"');
  await q(page, '[data-testid="live-retry"]').click();
  await settle();
  assert.equal(page.document.activeElement, q(page, 'h1.live-detail-date'));
  assert.equal(text(q(page, 'h1.live-detail-date')), '2026.12.26(Sat)');
  for (const scenario of ['invalid-live', 'invalid-upcoming', 'invalid-past']) {
    const bad = await detail('?liveId=fx-up-far', { scenarios: [scenario] });
    assert.equal(testids(bad, 'live-retry').length, 1, scenario);
  }
});

// ---- archive ----------------------------------------------------------------------------
test('T43-ARCHIVE ?view=past lists every past Live newest first with the title, linking to details on the same page', async () => {
  const page = await detail('?view=past');
  const rows = testids(page, 'live-past-row');
  assert.deepEqual(rows.map((r) => r.getAttribute('href')), order(page).sortPast(page.data.live.past).map((l) => `./?liveId=${encodeURIComponent(l.id)}`));
  assert.equal(rows.length, 12);
  assert.equal(rows[1].querySelector('.live-past-title').textContent, '架空のイベント　第3回（昼の部）');
  assert.equal(rows[4].querySelector('.live-past-title').textContent, 'これは非常に長いタイトルの架空の公演名であり四十一文字を確実に超える長さがあります（全角括弧の注記）');
  assert.equal(rows[9].querySelector('.live-past-title'), null, 'an empty title adds no empty text node');
  assert.equal(text(q(page, 'main h1.site-section-title')), 'live');
  assert.equal(text(q(page, 'h2.live-label')), '終了したライブ（全件）');
  assert.equal(page.document.title, '終了したライブ（全件） | 松本一樹');
  assert.equal(testids(page, 'live-reserve').length, 0);
  assert.equal(q(page, '#live-back').getAttribute('href'), '../');
});

test('T43-ARCHIVE ?liveId wins over ?view=past; an empty ?liveId falls back to the archive; view is case-insensitive', async () => {
  const win = await detail('?view=past&liveId=fx-past-01');
  assert.equal(testids(win, 'live-past-row').length, 0);
  assert.equal(text(q(win, 'h1.live-detail-date')), '2026.10.31(Sat)');
  const empty = await detail('?view=past&liveId=');
  assert.equal(testids(empty, 'live-past-row').length, 12);
  const upper = await detail('?view=PAST');
  assert.equal(testids(upper, 'live-past-row').length, 12);
});

test('T43-ARCHIVE S43-02: no past Live shows the written empty state; S43-03 shows the error', async () => {
  const none = await detail('?view=past', { scenarios: ['empty-past'] });
  assert.equal(text(q(none, '[data-testid="live-archive-empty"]')), '終了したライブはまだありません。');
  assert.equal(text(q(none, 'h2.live-label')), '終了したライブ（全件）');
  assert.equal(testids(none, 'live-past-row').length, 0);
  const bad = await detail('?view=past', { scenarios: ['invalid-past'] });
  assert.equal(testids(bad, 'live-retry').length, 1);
  assert.equal(testids(bad, 'live-archive-empty').length, 0);
});

test('T43-ARCHIVE the entrances keep working: Home link, the list link and X (live/detail/?liveId=) reach the right view', async () => {
  const home = readFileSync('index.html', 'utf8');
  const homeHref = home.match(/href="(live\/detail\/\?view=past)"/)[1];
  const viaHome = await detail(new URL(homeHref, 'https://1212hp.example/').search);
  assert.equal(testids(viaHome, 'live-past-row').length, 12);
  const viaList = await list();
  const href = q(viaList, '#live-past-all').getAttribute('href');
  const resolved = new URL(href, 'https://1212hp.example/live/');
  assert.equal(resolved.pathname, '/live/detail/');
  assert.equal(resolved.search, '?view=past');
  const viaX = await detail('?liveId=fx-up-far');
  assert.equal(testids(viaX, 'live-detail').length, 1);
});

// ---- production-shaped data -------------------------------------------------------------
test('T43-PROD every Live shape renders on all three views without error and without losing text', async () => {
  const data = buildData(fixture, 'multi-upcoming');
  const everyLive = [...data.live.upcoming, ...data.live.past];
  const listPage = await list({ data });
  assert.equal(listPage.document.getElementById('live-content').getAttribute('data-state'), 'ready');
  const archive = await detail('?view=past', { data });
  assert.equal(testids(archive, 'live-past-row').length, data.live.past.length);
  for (const live of everyLive) {
    const page = await detail(`?liveId=${encodeURIComponent(live.id)}`, { data });
    assert.equal(page.document.getElementById('live-detail-content').getAttribute('data-state'), 'ready', live.id);
    const body = q(page, '[data-testid="live-detail"]').textContent;
    const title = String(live.title || '').trim();
    const venue = String(live.venue || '').trim();
    if (title) assert.ok(body.includes(title), `${live.id} title`);
    assert.ok(body.includes(venue), `${live.id} venue`);
    const details = ops(page).formatLiveDetails(live);
    for (const line of details.split('\n').filter(Boolean)) assert.ok(body.includes(line), `${live.id} detail line ${line}`);
    assert.doesNotMatch(body, /Coming Soon/);
  }
});

test('T43-PROD text is escaped and no truncation class is used in the markup', async () => {
  const page = await detail('?liveId=fx-past-03');
  const html = q(page, '[data-testid="live-detail"]').innerHTML;
  assert.ok(html.includes('&lt;Title&gt;'));
  assert.ok(html.includes('&amp;'));
  assert.ok(!html.includes('<Title>'));
  assert.equal(text(q(page, '.live-detail-title')), '“Quoted” <Title> & \'ends\'');
  const rows = testids(await detail('?view=past'), 'live-past-row');
  assert.ok(rows.every((row) => !/ellipsis|clamp|truncate/.test(row.getAttribute('class'))));
  const performers = qa(page, '[data-part="info"] li').map((li) => li.textContent).find((t) => t.startsWith('w. '));
  assert.ok(performers.includes('架空の出演者O（架空の注記）'), 'the eighth performer and its note are not cut');
});

test('T43-PROD a mixed-date list orders by the real date and keeps unreadable dates last without moving the saved data', async () => {
  const data = buildData(fixture);
  const before = JSON.stringify(data);
  const page = await detail('?view=past', { data });
  const ids = testids(page, 'live-past-row').map((r) => r.getAttribute('href').split('=')[1]);
  assert.equal(ids[0], 'fx-past-01');
  assert.equal(ids[ids.length - 1], 'fx-past-12');
  assert.equal(JSON.stringify(data), before);
  void NOW;
});

test('T43-STATE-DETAIL T43-CTA duplicate Live IDs across upcoming and past: the list offers no action and the detail is not found', async () => {
  const data = buildData(fixture);
  data.live.past.push({ ...data.live.upcoming[0], date: '2000-01-01', title: 'Past duplicate' });
  const listPage = await list({ data });
  for (const card of testids(listPage, 'live-card').filter((c) => c.getAttribute('data-live-id') === 'fx-up-far')) {
    assert.equal(card.querySelector('[data-testid="live-reserve"]'), null);
    assert.equal(card.querySelector('.site-button--secondary'), null);
  }
  const archiveRows = (await detail('?view=past', { data })).document.querySelectorAll('[data-testid="live-past-row"]').filter((r) => r.localName === 'div');
  assert.equal(archiveRows.length, 1, 'the duplicated past row is shown but not linked');
  const page = await detail('?liveId=fx-up-far', { data });
  assert.equal(testids(page, 'live-detail-notfound').length, 1);
  assert.equal(testids(page, 'live-reserve').length, 0);
  assert.doesNotMatch(page.document.body.textContent, /Past duplicate/);
});

// T43-FIELDS (Live part): every item that was visible before is still visible somewhere (Requirements section 4, F-01 to F-12).
test('T43-FIELDS F-01 to F-12: where each old Live item lives now', async () => {
  const data = buildData(fixture, 'multi-upcoming');
  const far = await detail('?liveId=fx-up-far', { data });
  const live = data.live.upcoming.find((l) => l.id === 'fx-up-far');
  const body = q(far, '[data-testid="live-detail"]');
  assert.ok(q(far, '[data-part="flyer"] img'), 'F-01 image');
  assert.equal(text(q(far, '.live-detail-title')), live.title, 'F-02 title');
  assert.equal(text(q(far, '.live-detail-date')), '2026.12.26(Sat)', 'F-03 date');
  assert.equal(text(q(far, '.live-detail-venue')), live.venue, 'F-03 venue');
  for (const line of ops(far).formatLiveDetails(live).split('\n')) assert.ok(body.textContent.includes(line), `F-04 ${line}`);
  const only = await detail('?liveId=fx-past-06', { data });
  assert.match(q(only, '[data-testid="live-detail-description"]').textContent, /架空の説明だけのライブ/, 'F-05 description');
  assert.equal(testids(far, 'live-reserve').length, 1, 'F-06 reservation');
  assert.equal(text(q(far, '#live-back')), '← live', 'F-07 back');
  assert.equal(qa(far, '[data-part="actions"] a').some((a) => text(a) === 'Instagram'), true, 'F-08 Instagram');
  const listPage = await list({ data });
  const card = testids(listPage, 'live-card').find((c) => c.getAttribute('data-live-id') === 'fx-up-far');
  for (const selector of ['.live-card-flyer img', '.live-card-date', '.live-card-venue', '.live-card-title', '.live-card-details', '[data-testid="live-reserve"]']) assert.ok(card.querySelector(selector), `F-09 ${selector}`);
  assert.equal(text(card.querySelector('.live-card-actions .site-button--secondary')), '詳細', 'F-09 detail');
  const row = testids(listPage, 'live-past-row')[0];
  for (const selector of ['.live-past-date', '.live-past-venue', '.live-past-title', '.live-past-arrow']) assert.ok(row.querySelector(selector), `F-10 ${selector}`);
  assert.equal(text(q(listPage, '#live-past-heading')), '終了したライブ', 'F-11 heading');
  assert.equal(text(q(listPage, '#live-past-all')), '終了したライブをすべて見る →', 'F-11 more');
  assert.equal(q(listPage, '[role="dialog"]'), null, 'F-12 no overlay');
  const pastDetail = await detail('?liveId=fx-past-01', { data });
  assert.equal(text(q(pastDetail, '[data-testid="live-reserve"]')), '予約受付終了', 'F-10 the "reservation ended" label moved to the detail');
});
