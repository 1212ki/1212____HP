import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { buildData, envelope, loadFixture, loadPage, settle, jsonResponse } from './support/dom-harness.mjs';

const require = createRequire(import.meta.url);
const fixture = loadFixture();
const orderSource = readFileSync('assets/js/live-order.js', 'utf8');
const ids = (list) => list.map((item) => item.id);

function loadOrder() {
  const context = vm.createContext({});
  context.window = context;
  vm.runInContext(orderSource, context, { filename: 'assets/js/live-order.js' });
  return context.window.LiveOrder;
}

test('T43-ORDER UMD exposes window.LiveOrder and the CommonJS export', () => {
  const browser = loadOrder();
  const node = require('../assets/js/live-order.js');
  for (const api of [browser, node]) {
    for (const name of ['parseLiveDateTime', 'sortByDate', 'sortUpcoming', 'sortPast']) assert.equal(typeof api[name], 'function', name);
  }
});

test('T43-ORDER reads the three date spellings, with or without a weekday, and rejects unreadable values', () => {
  const { parseLiveDateTime } = loadOrder();
  const day = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
  assert.equal(parseLiveDateTime('2026-12-26'), day(2026, 12, 26));
  assert.equal(parseLiveDateTime('2026.9.20'), day(2026, 9, 20));
  assert.equal(parseLiveDateTime('2026.09.20'), day(2026, 9, 20));
  assert.equal(parseLiveDateTime('2026.10.31(Sat)'), day(2026, 10, 31));
  assert.equal(parseLiveDateTime('2026.8.2(日)'), day(2026, 8, 2));
  assert.equal(parseLiveDateTime('2026/1/2'), day(2026, 1, 2));
  assert.equal(parseLiveDateTime('2026年1月2日'), day(2026, 1, 2));
  for (const bad of ['', '  ', null, undefined, '近日発表', '2026.13.40']) assert.ok(Number.isNaN(parseLiveDateTime(bad)), String(bad));
});

test('T43-ORDER upcoming is nearest first, past is newest first, ties and unreadable dates keep stored order', () => {
  const { sortUpcoming, sortPast } = loadOrder();
  const data = buildData(fixture);
  assert.deepEqual(ids(sortUpcoming(data.live.upcoming)), ['fx-up-stale', 'fx-up-far']);
  assert.deepEqual(ids(sortPast(data.live.past)), ['fx-past-01', 'fx-past-02', 'fx-past-03', 'fx-past-04', 'fx-past-05', 'fx-past-06', 'fx-past-07', 'fx-past-08', 'fx-past-09', 'fx-past-10', 'fx-past-11', 'fx-past-12']);
  const mixed = [{ id: 'u1', date: '近日' }, { id: 'a', date: '2027.2.1(Mon)' }, { id: 'u2', date: '' }, { id: 'b', date: '2027-02-01' }, { id: 'c', date: '2027.01.31' }];
  assert.deepEqual(ids(sortUpcoming(mixed)), ['c', 'a', 'b', 'u1', 'u2']);
  assert.deepEqual(ids(sortPast(mixed)), ['a', 'b', 'c', 'u1', 'u2']);
});

test('T43-ORDER never changes the input array or its items and tolerates non-arrays', () => {
  const { sortUpcoming, sortPast, sortByDate } = loadOrder();
  const data = buildData(fixture);
  const before = JSON.stringify(data.live);
  const sorted = sortPast(data.live.past);
  assert.notEqual(sorted, data.live.past);
  sortUpcoming(data.live.upcoming);
  assert.equal(JSON.stringify(data.live), before);
  for (const value of [null, undefined, {}, 'x', 3]) assert.deepEqual(Array.from(sortByDate(value, 'asc')), []);
  assert.deepEqual(Array.from(sortUpcoming([null, { id: 'a', date: '2027-01-01' }]).map((x) => x && x.id)), ['a', null]);
});

test('T43-ORDER the stored category is never changed by the date (past-dated upcoming stays upcoming)', () => {
  const { sortUpcoming } = loadOrder();
  const data = buildData(fixture);
  const sorted = sortUpcoming(data.live.upcoming);
  assert.equal(sorted.length, data.live.upcoming.length);
  assert.equal(sorted[0].id, 'fx-up-stale');
});

// The Home next live is chosen by the private order inside site-content.js. Run it and compare.
async function homeNextVenue(upcoming) {
  const data = buildData(fixture);
  data.live.upcoming = upcoming;
  const page = loadPage({
    file: 'index.html',
    url: 'https://1212hp.example/',
    fetch: async () => jsonResponse(envelope(data)),
    only: ['site-config.js', 'live-operations.js', 'music-data.js', 'home-player.js', 'site-content.js'],
  });
  await settle();
  return page.document.querySelector('.home-live-venue').textContent;
}

test('T43-ORDER the first upcoming Live equals the Home next Live for every stored order and date form', async () => {
  const { sortUpcoming } = loadOrder();
  const forms = [
    { id: 'p1', date: '2027.2.1(Mon)', venue: 'V-p1' },
    { id: 'p2', date: '2027-01-15', venue: 'V-p2' },
    { id: 'p3', date: '2027.01.20', venue: 'V-p3' },
    { id: 'p4', date: '近日', venue: 'V-p4' },
    { id: 'p5', date: '2027.01.15', venue: 'V-p5' },
    { id: 'p6', date: '2026.11.18', venue: 'V-p6' },
  ];
  for (let shift = 0; shift < forms.length; shift += 1) {
    const rotated = [...forms.slice(shift), ...forms.slice(0, shift)];
    const first = sortUpcoming(rotated)[0];
    assert.equal(await homeNextVenue(rotated), first.venue, `rotation ${shift}`);
  }
  const reversed = [...forms].reverse();
  assert.equal(await homeNextVenue(reversed), sortUpcoming(reversed)[0].venue);
  const stored = buildData(fixture).live.upcoming;
  assert.equal(await homeNextVenue(stored), sortUpcoming(stored)[0].venue);
});
