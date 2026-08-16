import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const liveFormatCases = JSON.parse(readFileSync(join(repoRoot, 'test/fixtures/live-format-cases.json'), 'utf8'));
const {
  buildXAnnouncementText,
  buildXParentText,
  buildXReplyText,
  formatLiveDate,
  formatLiveDetails,
  getTicketCta,
  getTicketUrl,
  normalizeLiveDateInput,
  normalizeLivePerformers,
  parseLiveSourceText,
  resolveLiveById,
} = require(join(repoRoot, 'assets/js/live-operations.js'));

test('browser Live formatters satisfy the shared fixture matrix', () => {
  for (const fixture of liveFormatCases.dates) {
    assert.equal(formatLiveDate(fixture.input), fixture.expected, fixture.name);
  }
  for (const fixture of liveFormatCases.details) {
    assert.equal(formatLiveDetails(fixture.live), fixture.expected, fixture.name);
  }
});

test('formatLiveDate normalizes legacy separators and recomputes the weekday', () => {
  for (const value of ['2026-09-28', '2026.9.28(月)', '2026/09/28', '2026.09.28(Sun)']) {
    assert.equal(formatLiveDate(value), '2026.09.28(Mon)', value);
  }
  assert.equal(formatLiveDate('  date TBA  '), 'date TBA');
  assert.equal(formatLiveDate(''), '');
  assert.equal(normalizeLiveDateInput('2026.9.28(月)'), '2026-09-28');
  assert.equal(normalizeLiveDateInput('date TBA'), '');
});

test('formatLiveDetails uses canonical order, labels, and normalization', () => {
  assert.equal(formatLiveDetails({
    openTime: '18:30',
    startTime: '19:00',
    ticket: '¥2,500 + 1D',
    notes: '再入場不可\n※受付は18:00から',
    performers: '共演者A\n共演者B / 共演者C',
    description: 'legacy details must not win',
  }), [
    'Open/Start: 18:30/19:00',
    'ticket: ¥2,500 + 1D',
    '※再入場不可',
    '※受付は18:00から',
    'w. 共演者A / 共演者B / 共演者C',
  ].join('\n'));

  assert.equal(formatLiveDetails({ startTime: '19:00' }), 'Start: 19:00');
  assert.equal(formatLiveDetails({ openTime: '18:30' }), 'Open: 18:30');
  assert.equal(formatLiveDetails({ description: 'OPEN 18:30 / START 19:00\n出演：旧データ' }), 'OPEN 18:30 / START 19:00\n出演：旧データ');
  assert.equal(normalizeLivePerformers(' A / B\nC '), 'A / B / C');
});

const sample = [
  '2026/08/02(日)',
  '『1212 presents』',
  '@柴崎mod',
  '出演：松本一樹 / another band',
  'open/start 18:30/19:00',
  '前売 ¥2,500',
  '予約：https://tiget.net/events/510753。',
].join('\n');

test('parseLiveSourceText preserves source text and extracts a conservative draft', () => {
  const result = parseLiveSourceText(sample);

  assert.equal(result.draft.sourceText, sample);
  assert.equal(result.draft.date, '2026.08.02');
  assert.equal(result.draft.title, '1212 presents');
  assert.equal(result.draft.venue, '柴崎mod');
  assert.equal(result.draft.ticketUrl, 'https://tiget.net/events/510753');
  assert.match(result.draft.details, /出演：松本一樹/);
  assert.match(result.draft.details, /open\/start 18:30\/19:00/);
  assert.equal(result.draft.description, result.draft.details);
});

test('empty source text returns an empty draft and a warning', () => {
  const { draft, warnings } = parseLiveSourceText('  \n');

  assert.deepEqual(draft, {
    sourceText: '  \n',
    date: '',
    title: '',
    venue: '',
    details: '',
    description: '',
    ticketUrl: '',
  });
  assert.ok(warnings.length > 0);
});

test('multiple common date styles normalize to the existing YYYY.MM.DD format', () => {
  for (const dateLine of ['2026.8.2 Sun', '2026年8月2日（日）', '2026-08-02 (SUN)']) {
    assert.equal(parseLiveSourceText(`${dateLine}\n会場：柴崎mod`).draft.date, '2026.08.02');
  }
});

test('open/start and lineup markers remain structured detail instead of becoming the title', () => {
  const { draft } = parseLiveSourceText([
    '2026/08/02',
    '会場：柴崎mod',
    'OPEN 18:30 / START 19:00',
    'w/ band A, band B',
  ].join('\n'));

  assert.equal(draft.title, '');
  assert.match(draft.details, /OPEN 18:30 \/ START 19:00/);
  assert.match(draft.details, /w\/ band A, band B/);
});

test('ticket URL extraction cleans surrounding and trailing punctuation', () => {
  const { draft } = parseLiveSourceText('2026/08/02\n会場：柴崎mod\n予約【https://tiget.net/events/510753?from=artist】。');

  assert.equal(draft.ticketUrl, 'https://tiget.net/events/510753?from=artist');
});

test('malformed percent-encoding is rejected by the parser without throwing', () => {
  let result;

  assert.doesNotThrow(() => {
    result = parseLiveSourceText('2026/08/02\n会場：柴崎mod\n予約：https://tiget.net/events/%ZZ');
  });
  assert.equal(result.draft.ticketUrl, '');
});

test('one-line booking text extracts fields without splitting date and URL slashes', () => {
  const source = '2026/8/2(日) / 会場：柴崎mod / OPEN 18:30 / START 19:00 / 予約：https://tiget.net/events/510753';
  const { draft } = parseLiveSourceText(source);

  assert.equal(draft.date, '2026.08.02');
  assert.equal(draft.venue, '柴崎mod');
  assert.match(draft.details, /OPEN 18:30/);
  assert.match(draft.details, /START 19:00/);
  assert.equal(draft.ticketUrl, 'https://tiget.net/events/510753');
});

test('detail cleanup removes only the selected ticket URL and preserves other HTTPS text', () => {
  const { draft } = parseLiveSourceText([
    '2026/08/02',
    '会場：柴崎mod',
    '配信：https://youtube.com/watch?v=abc',
    '予約：https://tiget.net/events/510753 当日券は会場で販売',
  ].join('\n'));

  assert.match(draft.details, /配信：https:\/\/youtube\.com\/watch\?v=abc/);
  assert.match(draft.details, /当日券は会場で販売/);
  assert.doesNotMatch(draft.details, /tiget\.net/);
});

test('declared weekday mismatch produces a warning while a matching weekday does not', () => {
  const mismatch = parseLiveSourceText('2026/08/02(月)\n会場：柴崎mod');
  const match = parseLiveSourceText('2026/08/02(日)\n会場：柴崎mod');

  assert.ok(mismatch.warnings.some((warning) => /曜日.*一致/.test(warning)));
  assert.ok(!match.warnings.some((warning) => /曜日.*一致/.test(warning)));
});

test('parsing does not mutate input or add save and publish state', () => {
  const source = new String(sample); // eslint-disable-line no-new-wrappers
  Object.freeze(source);

  const { draft } = parseLiveSourceText(source);

  assert.equal(String(source), sample);
  assert.equal(Object.hasOwn(draft, 'published'), false);
  assert.equal(Object.hasOwn(draft, 'status'), false);
  assert.equal(Object.hasOwn(draft, 'id'), false);
});

test('an own ticketUrl property is authoritative, including an explicit empty value', () => {
  assert.equal(getTicketUrl({ ticketUrl: 'https://tiget.net/x', link: 'https://tiget.net/legacy' }), 'https://tiget.net/x');
  assert.equal(getTicketUrl({ ticketUrl: '', link: 'https://tiget.net/legacy' }), '');
  assert.equal(getTicketUrl(Object.create({ ticketUrl: 'https://tiget.net/inherited' }, {
    link: { value: 'https://tiget.net/events/legacy', enumerable: true },
  })), 'https://tiget.net/events/legacy');
});

test('legacy link inference accepts known ticket providers and explicit booking paths', () => {
  assert.equal(getTicketUrl({ link: 'https://tiget.net/events/legacy' }), 'https://tiget.net/events/legacy');
  assert.equal(getTicketUrl({ link: 'https://eplus.jp/sf/detail/123456' }), 'https://eplus.jp/sf/detail/123456');
  assert.equal(getTicketUrl({ link: 'https://artist.example.com/reservations/live-1' }), 'https://artist.example.com/reservations/live-1');
});

test('legacy form-mailer inference accepts only the existing fms booking pattern', () => {
  assert.equal(
    getTicketUrl({ link: 'https://ssl.form-mailer.jp/fms/abc123' }),
    'https://ssl.form-mailer.jp/fms/abc123',
  );
  assert.equal(getTicketUrl({ link: 'https://ssl.form-mailer.jp/contact/abc123' }), '');
});

test('malformed percent-encoding is rejected by legacy inference without throwing', () => {
  assert.doesNotThrow(() => {
    assert.equal(getTicketUrl({ link: 'https://tiget.net/events/%ZZ' }), '');
  });
});

test('legacy link inference rejects social, profile, detail, and arbitrary URLs', () => {
  for (const link of [
    'https://instagram.com/example',
    'https://x.com/example/status/1',
    'https://twitter.com/example',
    'https://youtube.com/watch?v=abc',
    'https://facebook.com/events/123',
    'https://tiktok.com/@example',
    'https://artist.example.com/profile',
    'https://artist.example.com/live/detail/123',
    'https://artist.example.com/news/live-1',
  ]) {
    assert.equal(getTicketUrl({ link }), '', link);
  }
});

test('known ticket providers still reject profile and Live detail URLs', () => {
  const links = [
    'https://tiget.net/profile/artist',
    'https://tiget.net/live/detail/123',
    'https://eplus.jp/profile/artist',
  ];

  assert.deepEqual(links.map((link) => getTicketUrl({ link })), ['', '', '']);
});

test('getTicketCta routes external and explicit-empty tickets deterministically', () => {
  assert.deepEqual(
    getTicketCta({ date: '2026.08.02', ticketUrl: 'https://tiget.net/events/1' }, '/ticket/?liveId=1', {
      now: new Date('2026-07-31T12:00:00Z'),
    }),
    {
      active: true,
      url: 'https://tiget.net/events/1',
      external: true,
      label: '外部サイトで予約',
      reason: '',
    },
  );
  assert.deepEqual(
    getTicketCta({ date: '2026.08.02', ticketUrl: '', link: 'https://tiget.net/events/legacy' }, '/ticket/?liveId=1', {
      now: new Date('2026-07-31T12:00:00Z'),
    }),
    {
      active: true,
      url: '/ticket/?liveId=1',
      external: false,
      label: 'このサイトで予約',
      reason: '',
    },
  );
});

test('invalid authoritative ticketUrl values stay authoritative but produce an inactive CTA', () => {
  for (const ticketUrl of [
    'javascript:alert(1)',
    '/ticket/?liveId=1',
    'https://tiget.net/events/%ZZ',
  ]) {
    const live = { ticketUrl, link: 'https://tiget.net/events/legacy' };
    const cta = getTicketCta(live, '/ticket/?liveId=1');

    assert.equal(getTicketUrl(live), ticketUrl);
    assert.equal(cta.active, false);
    assert.equal(cta.url, '');
    assert.equal(cta.external, false);
    assert.equal(cta.reason, 'invalidTicketUrl');
  }
});

test('getTicketCta is inactive for past and reservation-closed Lives', () => {
  const now = new Date('2026-07-31T12:00:00Z');
  const past = getTicketCta({ date: '2026.07.30', ticketUrl: 'https://tiget.net/events/1' }, '/ticket/', { now });
  const pastByContext = getTicketCta({ date: '2026.08.02' }, '/ticket/', { isPast: true, now });
  const closed = getTicketCta({ date: '2026.08.02', reservationClosed: true }, '/ticket/', { now });
  const closedExternal = getTicketCta({
    date: '2026.08.02',
    reservationClosed: true,
    ticketUrl: 'https://tiget.net/events/1',
  }, '/ticket/', { now });

  assert.equal(past.active, false);
  assert.equal(past.url, '');
  assert.equal(past.reason, 'past');
  assert.equal(pastByContext.reason, 'past');
  assert.equal(closed.active, false);
  assert.equal(closed.url, '');
  assert.equal(closed.reason, 'reservationClosed');
  assert.equal(closedExternal.active, false);
  assert.equal(closedExternal.url, '');
  assert.equal(closedExternal.reason, 'reservationClosed');
});

test('getTicketCta changes business date exactly at Asia/Tokyo midnight on a UTC-like host', () => {
  class UtcHostDate extends Date {
    getFullYear() { return this.getUTCFullYear(); }
    getMonth() { return this.getUTCMonth(); }
    getDate() { return this.getUTCDate(); }
  }

  const live = { id: 'tokyo-boundary', date: '2026.08.01', ticketUrl: '' };
  const justBeforeMidnight = getTicketCta(live, '/ticket/?liveId=tokyo-boundary', {
    now: new UtcHostDate('2026-08-01T14:59:59.999Z'),
  });
  const atMidnight = getTicketCta(live, '/ticket/?liveId=tokyo-boundary', {
    now: new UtcHostDate('2026-08-01T15:00:00.000Z'),
  });

  assert.equal(justBeforeMidnight.active, true);
  assert.equal(justBeforeMidnight.reason, '');
  assert.equal(atMidnight.active, false);
  assert.equal(atMidnight.reason, 'past');
});

test('resolveLiveById returns one canonical record/category and fails closed for duplicate IDs', () => {
  assert.equal(typeof resolveLiveById, 'function');

  const unique = { id: 'unique-live', date: '2099.08.01', ticketUrl: '' };
  const crossUpcoming = { id: 'cross-duplicate', date: '2099.08.02', ticketUrl: '' };
  const crossPast = { id: 'cross-duplicate', date: '2000.08.02', ticketUrl: '' };
  const sameFirst = { id: 'same-duplicate', date: '2099.08.03', ticketUrl: '' };
  const sameSecond = { id: 'same-duplicate', date: '2099.08.04', ticketUrl: '' };
  const data = {
    live: {
      upcoming: [unique, crossUpcoming, sameFirst, sameSecond],
      past: [crossPast],
    },
  };

  const uniqueResult = resolveLiveById(data, 'unique-live');
  assert.equal(uniqueResult.status, 'unique');
  assert.equal(uniqueResult.live, unique);
  assert.equal(uniqueResult.category, 'upcoming');

  for (const duplicateId of ['cross-duplicate', 'same-duplicate']) {
    const duplicateResult = resolveLiveById(data, duplicateId);
    assert.equal(duplicateResult.status, 'ambiguous', duplicateId);
    assert.equal(duplicateResult.live, null, duplicateId);
    assert.equal(duplicateResult.category, null, duplicateId);
  }

  const missingResult = resolveLiveById(data, 'missing-live');
  assert.equal(missingResult.status, 'missing');
  assert.equal(missingResult.live, null);
  assert.equal(missingResult.category, null);
});

test('buildXParentText contains only owner framing, hashtag, and canonical Live URL', () => {
  const live = {
    date: '2026.08.02',
    title: '1212 presents',
    venue: '柴崎mod',
    description: 'open/start 18:30/19:00\n前売 ¥2,500',
  };
  const canonicalUrl = 'https://1212hp.com/live/detail/?id=live-1';
  const text = buildXParentText(live, 'ぜひ来てください', canonicalUrl);

  assert.match(text, /#ライブ/);
  assert.match(text, /ぜひ来てください/);
  assert.match(text, new RegExp(canonicalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(text, /open\/start/);
  assert.doesNotMatch(text, /前売/);
});

test('buildXReplyText contains structured Live details', () => {
  const text = buildXReplyText({
    date: '2026-08-02',
    title: '1212 presents',
    venue: '柴崎mod',
    openTime: '18:30',
    startTime: '19:00',
    ticket: '¥2,500 + 1D',
    notes: '再入場不可',
    performers: '松本一樹 / another band',
    description: 'legacy must not render',
  });

  assert.match(text, /2026\.08\.02\(Sun\)/);
  assert.match(text, /1212 presents/);
  assert.match(text, /会場：柴崎mod/);
  assert.match(text, /Open\/Start: 18:30\/19:00/);
  assert.match(text, /ticket: ¥2,500 \+ 1D/);
  assert.match(text, /※再入場不可/);
  assert.match(text, /w\. 松本一樹 \/ another band/);
  assert.doesNotMatch(text, /legacy must not render/);
});

test('X announcement emits the unified Live post in canonical order', () => {
  const text = buildXAnnouncementText({
    date: '2026-08-10',
    title: '山頂',
    venue: '下北沢おてまえ',
    openTime: '18:30',
    startTime: '19:00',
    ticket: 'ADV¥2,300 / DOOR¥2,800(+1D)',
    notes: '再入場不可\n※受付は18:00から',
    performers: 'tiny-yang-yang / Erika\n小林義裕(晩年) / 棚上瑞',
  }, '任意コメント', 'https://1212hp.com/live/detail/?liveId=live-1');

  assert.equal(text, [
    '2026.8.10(月) 下北沢おてまえ',
    '「山頂」',
    [
      'OPEN / 18:30 START / 19:00',
      'ADV¥2,300 / DOOR¥2,800(+1D)',
      '※再入場不可',
      '※受付は18:00から',
    ].join('\n'),
    ['-act-', 'tiny-yang-yang', 'Erika', '小林義裕(晩年)', '棚上瑞'].join('\n'),
    '任意コメント',
    '#ライブ',
    'https://1212hp.com/live/detail/?liveId=live-1',
  ].join('\n\n'));
});

test('X announcement recomputes Japanese weekday and omits empty blocks', () => {
  assert.equal(buildXAnnouncementText({
    date: '2026.9.28(日)',
    startTime: '19:00',
    notes: '\n※※注意事項\n  受付で名前を伝える  \n',
  }, '', ''), [
    '2026.9.28(月)',
    ['START / 19:00', '※注意事項', '※受付で名前を伝える'].join('\n'),
    '#ライブ',
  ].join('\n\n'));

  assert.equal(buildXAnnouncementText({ openTime: '18:30' }, '', ''), [
    'OPEN / 18:30',
    '#ライブ',
  ].join('\n\n'));
  assert.equal(buildXAnnouncementText({}, '', ''), '#ライブ');
});

test('the dependency-free module exposes the same API to a browser global', () => {
  const source = readFileSync(join(repoRoot, 'assets/js/live-operations.js'), 'utf8');
  const context = { window: {} };
  context.globalThis = context.window;

  vm.runInNewContext(source, context);

  assert.equal(typeof context.window.LiveOperations.parseLiveSourceText, 'function');
  assert.equal(typeof context.window.LiveOperations.getTicketCta, 'function');
  assert.equal(typeof context.window.LiveOperations.buildXAnnouncementText, 'function');
  assert.equal(typeof context.window.LiveOperations.buildXParentText, 'function');
});

test('requiring the CommonJS module does not publish a Node global', () => {
  assert.equal(Object.hasOwn(globalThis, 'LiveOperations'), false);
});
