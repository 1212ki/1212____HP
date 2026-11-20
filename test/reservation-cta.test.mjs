import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { FIXED_NOW, buildData, envelope, loadFixture, loadPage, settle, jsonResponse } from './support/dom-harness.mjs';

const fixture = loadFixture();
const NOW = Date.parse(FIXED_NOW);

function load({ helper = true } = {}) {
  const context = vm.createContext({ URL });
  context.window = context;
  if (helper) vm.runInContext(readFileSync('assets/js/live-operations.js', 'utf8'), context);
  vm.runInContext(readFileSync('assets/js/reservation-cta.js', 'utf8'), context, { filename: 'assets/js/reservation-cta.js' });
  return context.window;
}
const live = (extra) => ({ id: 'x', date: '2027-01-01', venue: 'V', title: 'T', ...extra });
const wrap = (...items) => ({ live: { upcoming: items, past: [] } });

test('T43-CTA exposes window.ReservationCta and the four fixed labels', () => {
  const { ReservationCta } = load();
  assert.deepEqual({ ...ReservationCta.LABELS }, { internal: '予約する', external: '予約する（外部サイト）', closed: '予約受付終了', invalid: '予約先を確認中' });
});

test('T43-CTA each branch: kind, active, url, external, label, reason', () => {
  const { ReservationCta } = load();
  const opts = { now: NOW };
  const internal = ReservationCta.resolveLive(live({ ticketUrl: '' }), 'upcoming', 'ticket/?liveId=x', opts);
  assert.deepEqual([internal.kind, internal.active, internal.url, internal.external, internal.label], ['internal', true, 'ticket/?liveId=x', false, '予約する']);
  const external = ReservationCta.resolveLive(live({ ticketUrl: 'https://tickets.example.test/e/1?a=1&b=2' }), 'upcoming', 'ticket/?liveId=x', opts);
  assert.deepEqual([external.kind, external.active, external.url, external.external, external.label], ['external', true, 'https://tickets.example.test/e/1?a=1&b=2', true, '予約する（外部サイト）']);
  const closed = ReservationCta.resolveLive(live({ reservationClosed: true }), 'upcoming', 'ticket/?liveId=x', opts);
  assert.deepEqual([closed.kind, closed.active, closed.url, closed.label, closed.reason], ['closed', false, '', '予約受付終了', 'reservationClosed']);
  const past = ReservationCta.resolveLive(live({ date: '2020-01-01' }), 'upcoming', 'ticket/?liveId=x', opts);
  assert.deepEqual([past.kind, past.active, past.label, past.reason], ['closed', false, '予約受付終了', 'past']);
  const archived = ReservationCta.resolveLive(live({ date: '2099-01-01' }), 'past', 'ticket/?liveId=x', opts);
  assert.deepEqual([archived.kind, archived.reason], ['closed', 'past']);
  const invalid = ReservationCta.resolveLive(live({ ticketUrl: 'javascript:alert(1)' }), 'upcoming', 'ticket/?liveId=x', opts);
  assert.deepEqual([invalid.kind, invalid.active, invalid.label, invalid.reason], ['invalid', false, '予約先を確認中', 'invalidTicketUrl']);
  assert.doesNotMatch(JSON.stringify(invalid), /予約URLが無効です/);
});

test('T43-CTA the stored category decides past; a past-dated upcoming Live is closed but stays upcoming', () => {
  const { ReservationCta } = load();
  const data = buildData(fixture);
  const stale = ReservationCta.resolve(data, 'fx-up-stale', 'ticket/?liveId=fx-up-stale', { now: NOW });
  assert.equal(stale.kind, 'closed');
  assert.equal(stale.category, 'upcoming');
  const far = ReservationCta.resolve(data, 'fx-up-far', 'ticket/?liveId=fx-up-far', { now: NOW });
  assert.equal(far.kind, 'internal');
  assert.equal(far.category, 'upcoming');
  assert.equal(far.live.id, 'fx-up-far');
  // A stored past Live is closed even when its date is in the future.
  const futurePast = { live: { upcoming: [], past: [live({ id: 'fp', date: '2099-01-01' })] } };
  const result = ReservationCta.resolve(futurePast, 'fp', 'ticket/?liveId=fp', { now: NOW });
  assert.deepEqual([result.kind, result.category, result.reason], ['closed', 'past', 'past']);
});

test('T43-CTA unknown, ambiguous and missing helper never offer a reservation', () => {
  const { ReservationCta } = load();
  const data = buildData(fixture, 'duplicate-id');
  const missing = ReservationCta.resolve(data, 'nope', 'ticket/?liveId=nope', { now: NOW });
  assert.deepEqual([missing.kind, missing.active, missing.url, missing.live], ['unknown', false, '', null]);
  const ambiguous = ReservationCta.resolve(data, 'fx-up-far', 'ticket/?liveId=fx-up-far', { now: NOW });
  assert.deepEqual([ambiguous.kind, ambiguous.active, ambiguous.url], ['ambiguous', false, '']);
  const empty = ReservationCta.resolve(buildData(fixture), '', 'ticket/?liveId=', { now: NOW });
  assert.equal(empty.kind, 'unknown');
  const bare = load({ helper: false });
  const helper = bare.ReservationCta.resolve(buildData(fixture), 'fx-up-far', 'x', { now: NOW });
  assert.deepEqual([helper.kind, helper.active, helper.url], ['helper', false, '']);
  assert.equal(bare.ReservationCta.resolveLive(live({}), 'upcoming', 'x').kind, 'helper');
});

test('T43-CTA the decision is getTicketCta; the shared module adds no rule of its own', () => {
  const window = load();
  const { ReservationCta, LiveOperations } = window;
  const cases = [live({}), live({ ticketUrl: 'https://t.example.test/e' }), live({ reservationClosed: true }), live({ ticketUrl: 'ftp://nope' }), live({ date: '2001-01-01' }), live({ ticketUrl: '', link: 'https://instagram.com/a' }), live({ link: 'https://eplus.jp/sf/detail/123456' })];
  for (const item of cases) {
    const direct = LiveOperations.getTicketCta(item, 'ticket/?liveId=x', { isPast: false, now: NOW });
    const shared = ReservationCta.resolveLive(item, 'upcoming', 'ticket/?liveId=x', { now: NOW });
    assert.equal(shared.active, direct.active);
    assert.equal(shared.external, direct.external);
    assert.equal(shared.url, direct.url);
    assert.equal(shared.reason, direct.reason);
  }
});

test('T43-CTA sentences for the Ticket page (S43-10, S43-11, S43-16)', () => {
  const { ReservationCta } = load();
  const sentence = (item, category = 'upcoming') => ReservationCta.reasonSentence(ReservationCta.resolveLive(item, category, 'x', { now: NOW }));
  assert.equal(sentence(live({ date: '2001-01-01' })), '指定されたライブは終了したライブです。別のライブを選択してください。');
  assert.equal(sentence(live({}), 'past'), '指定されたライブは終了したライブです。別のライブを選択してください。');
  assert.equal(sentence(live({ reservationClosed: true })), '指定されたライブの予約受付は終了しています。別のライブを選択してください。');
  assert.equal(sentence(live({ ticketUrl: 'javascript:1' })), '指定されたライブの予約先を確認中です。別のライブを選択してください。');
  assert.equal(ReservationCta.reasonSentence('unknown'), '指定されたライブが見つかりません。別のライブを選択してください。');
  assert.equal(ReservationCta.reasonSentence('external'), 'このライブの予約は外部サイトで受け付けています。');
  for (const kind of ['ambiguous', 'helper']) assert.equal(ReservationCta.reasonSentence(kind), '予約情報を確認できません。時間をおいて再度お試しください。');
  assert.equal(ReservationCta.reasonSentence('internal'), '');
  for (const kind of ['closed', 'invalid', 'unknown', 'external', 'ambiguous', 'helper']) assert.doesNotMatch(ReservationCta.reasonSentence(kind), /予約URLが無効です/);
});

test('T43-CTA isInstagramUrl accepts only instagram.com over http(s)', () => {
  const { ReservationCta } = load();
  for (const good of ['https://www.instagram.com/a/', 'http://instagram.com/a', ' https://INSTAGRAM.com/x ']) assert.equal(ReservationCta.isInstagramUrl(good), true, good);
  for (const bad of ['', null, 'https://instagram.com.evil.test/', 'https://notinstagram.com/', 'javascript:alert(1)', 'https://example.test/instagram.com/']) assert.equal(ReservationCta.isInstagramUrl(bad), false, String(bad));
});

// Home renders its next Live through site-content.js. Its four labels must be exactly the shared ones.
async function homeAction(mutate) {
  const data = buildData(fixture);
  data.live.upcoming = [data.live.upcoming[0]];
  mutate(data.live.upcoming[0]);
  const page = loadPage({
    file: 'index.html',
    url: 'https://1212hp.example/',
    fetch: async () => jsonResponse(envelope(data)),
    only: ['site-config.js', 'live-operations.js', 'music-data.js', 'home-player.js', 'site-content.js'],
  });
  await settle();
  const root = page.document.getElementById('home-next-live-events');
  const action = root.querySelector('.home-live-actions').children[0];
  return { text: action.textContent, tag: action.localName, window: page.window, live: data.live.upcoming[0], data };
}

test('T43-CTA Home four-way labels equal the shared labels; Home never says 予約URLが無効です', async () => {
  const cases = [
    ['internal', (item) => { item.ticketUrl = ''; }],
    ['external', (item) => { item.ticketUrl = 'https://tickets.example.test/e/9'; }],
    ['closed', (item) => { item.reservationClosed = true; }],
    ['invalid', (item) => { item.ticketUrl = 'javascript:alert(1)'; }],
  ];
  const shared = load().ReservationCta;
  for (const [kind, mutate] of cases) {
    const home = await homeAction(mutate);
    const result = shared.resolveLive(home.live, 'upcoming', 'ticket/?liveId=x', { now: NOW });
    assert.equal(result.kind, kind);
    assert.equal(home.text, shared.LABELS[kind], kind);
    assert.doesNotMatch(home.text, /予約URLが無効です/);
  }
  const past = await homeAction((item) => { item.date = '2020-01-01'; });
  assert.equal(past.text, shared.LABELS.closed);
});
