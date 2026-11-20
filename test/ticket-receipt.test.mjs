import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('assets/js/ticket-receipt.js', 'utf8');
const KEY = '1212hp_ticket_receipt_v1';
const T0 = Date.parse('2026-11-19T12:00:00+09:00');
const MIN = 60 * 1000;

function load() {
  const context = vm.createContext({});
  context.window = context;
  vm.runInContext(source, context, { filename: 'assets/js/ticket-receipt.js' });
  return context.window.TicketReceipt;
}
function memory() {
  const store = new Map();
  return { store, getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
}
const receipt = (extra = {}) => ({
  rid: 'fixture-ticket-0001',
  liveId: 'fx-up-far',
  live: { date: '2026-12-26', venue: '架空ホールA', title: '架空の公演 A', image: 'https://fixture-images.example/flyer-up-far.png' },
  name: '架空 太郎',
  email: 'taro@example.test',
  quantity: 2,
  message: '架空の備考\n2行目',
  ui: { completeText: '予約を受け付けました。', labelQuantity: '枚数（架空）', labelMessage: 'ご連絡（架空）', showQuantity: true, showMessage: true },
  ...extra,
});
const query = { liveId: 'fx-up-far', rid: 'fixture-ticket-0001' };

test('T43-RECEIPT exposes window.TicketReceipt with the fixed key, version and 30 minute limit', () => {
  const api = load();
  assert.equal(api.KEY, KEY);
  assert.equal(api.VERSION, 1);
  assert.equal(api.TTL_MS, 30 * MIN);
  for (const name of ['save', 'load', 'clear']) assert.equal(typeof api[name], 'function');
});

test('T43-RECEIPT saves one entry and reads every field back; reading does not remove it (reload, back and forward show the same content)', () => {
  const api = load();
  const storage = memory();
  assert.equal(api.save(receipt(), { storage, now: T0 }), true);
  assert.deepEqual([...storage.store.keys()], [KEY]);
  const stored = JSON.parse(storage.store.get(KEY));
  assert.equal(stored.v, 1);
  assert.equal(stored.savedAt, T0);
  const first = api.load({ ...query, storage, now: T0 + 5 * MIN });
  assert.equal(first.rid, 'fixture-ticket-0001');
  assert.equal(first.liveId, 'fx-up-far');
  assert.deepEqual(JSON.parse(JSON.stringify(first.live)), receipt().live);
  assert.equal(first.name, '架空 太郎');
  assert.equal(first.email, 'taro@example.test');
  assert.equal(first.quantity, 2);
  assert.equal(first.message, '架空の備考\n2行目');
  assert.deepEqual(JSON.parse(JSON.stringify(first.ui)), receipt().ui);
  const second = api.load({ ...query, storage, now: T0 + 6 * MIN });
  assert.deepEqual(JSON.parse(JSON.stringify(second)), JSON.parse(JSON.stringify(first)));
  assert.equal(storage.store.has(KEY), true);
});

test('T43-RECEIPT keeps exactly one entry: a new save replaces the old; clear removes it', () => {
  const api = load();
  const storage = memory();
  api.save(receipt(), { storage, now: T0 });
  api.save(receipt({ rid: 'fixture-ticket-0002' }), { storage, now: T0 + MIN });
  assert.equal(storage.store.size, 1);
  assert.equal(api.load({ liveId: 'fx-up-far', rid: 'fixture-ticket-0001', storage, now: T0 + MIN }), null);
  assert.equal(api.load({ liveId: 'fx-up-far', rid: 'fixture-ticket-0002', storage, now: T0 + MIN }).rid, 'fixture-ticket-0002');
  api.clear({ storage });
  assert.equal(storage.store.size, 0);
  assert.equal(api.load({ liveId: 'fx-up-far', rid: 'fixture-ticket-0002', storage, now: T0 + MIN }), null);
});

test('T43-RECEIPT a different liveId or receipt number in the address returns nothing and shows nobody else’s content', () => {
  const api = load();
  const storage = memory();
  api.save(receipt(), { storage, now: T0 });
  assert.equal(api.load({ liveId: 'fx-up-near', rid: 'fixture-ticket-0001', storage, now: T0 }), null);
  assert.equal(api.load({ liveId: 'fx-up-far', rid: 'other', storage, now: T0 }), null);
  assert.equal(api.load({ liveId: '', rid: '', storage, now: T0 }), null);
  assert.equal(api.load({ storage, now: T0 }), null);
  assert.equal(storage.store.has(KEY), true, 'a mismatch does not destroy the stored receipt');
});

test('T43-RECEIPT expires after 30 minutes and an expired entry is removed when read', () => {
  const api = load();
  const storage = memory();
  api.save(receipt(), { storage, now: T0 });
  assert.ok(api.load({ ...query, storage, now: T0 + 30 * MIN }), 'exactly 30 minutes is still valid');
  assert.equal(api.load({ ...query, storage, now: T0 + 30 * MIN + 1 }), null);
  assert.equal(storage.store.has(KEY), false);
  api.save(receipt(), { storage, now: T0 });
  assert.equal(api.load({ ...query, storage, now: T0 - 1 }), null, 'a saved time in the future is not trusted');
  assert.equal(api.load({ ...query, storage, now: new Date(T0 + MIN) }) , null, 'removed by the previous read');
});

test('T43-RECEIPT accepts a Date or a number for now', () => {
  const api = load();
  const storage = memory();
  api.save(receipt(), { storage, now: new Date(T0) });
  assert.ok(api.load({ ...query, storage, now: new Date(T0 + MIN) }));
  assert.ok(api.load({ ...query, storage, now: T0 + MIN }));
});

const broken = {
  'another version': (r) => ({ ...r, v: 2 }),
  'no version': (r) => { const { v, ...rest } = r; return rest; },
  'no rid': (r) => ({ ...r, rid: '' }),
  'no liveId': (r) => ({ ...r, liveId: '' }),
  'no savedAt': (r) => ({ ...r, savedAt: 'x' }),
  'no live': (r) => ({ ...r, live: null }),
  'no live.date': (r) => ({ ...r, live: { ...r.live, date: undefined } }),
  'no live.venue': (r) => ({ ...r, live: { ...r.live, venue: undefined } }),
  'no name': (r) => ({ ...r, name: '' }),
  'no email': (r) => ({ ...r, email: '' }),
  'no quantity': (r) => ({ ...r, quantity: 'two' }),
  'quantity out of range': (r) => ({ ...r, quantity: 11 }),
};
for (const [name, mutate] of Object.entries(broken)) {
  test(`T43-RECEIPT an entry with ${name} is treated as missing`, () => {
    const api = load();
    const storage = memory();
    api.save(receipt(), { storage, now: T0 });
    const raw = JSON.parse(storage.store.get(KEY));
    storage.store.set(KEY, JSON.stringify(mutate(raw)));
    assert.equal(api.load({ ...query, storage, now: T0 + MIN }), null);
  });
}

test('T43-RECEIPT unreadable stored text is treated as missing, never as content', () => {
  const api = load();
  for (const raw of ['{broken', '', 'null', '[]', '"text"', '123', 'true']) {
    const storage = memory();
    storage.store.set(KEY, raw);
    assert.equal(api.load({ ...query, storage, now: T0 }), null, JSON.stringify(raw));
  }
});

test('T43-RECEIPT blocked or full storage never throws: save returns false, load returns nothing', () => {
  const api = load();
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(api.save(receipt(), { storage: blocked, now: T0 }), false);
  assert.equal(api.load({ ...query, storage: blocked, now: T0 }), null);
  assert.doesNotThrow(() => api.clear({ storage: blocked }));
  assert.equal(api.save(receipt(), { storage: null, now: T0 }), false);
  const context = vm.createContext({});
  context.window = context;
  Object.defineProperty(context, 'sessionStorage', { get() { throw new Error('SecurityError'); } });
  vm.runInContext(source, context);
  assert.equal(context.window.TicketReceipt.save(receipt(), { now: T0 }), false);
  assert.equal(context.window.TicketReceipt.load({ ...query, now: T0 }), null);
});

test('T43-RECEIPT uses the window sessionStorage (same tab only) by default and never localStorage', () => {
  const context = vm.createContext({});
  context.window = context;
  const session = memory();
  const local = memory();
  context.sessionStorage = session;
  context.localStorage = local;
  vm.runInContext(source, context);
  const api = context.window.TicketReceipt;
  assert.equal(api.save(receipt(), { now: T0 }), true);
  assert.equal(session.store.size, 1);
  assert.equal(local.store.size, 0);
  assert.ok(api.load({ ...query, now: T0 }));
  assert.doesNotMatch(source, /localStorage/);
});

test('T43-RECEIPT keeps blanks the server may legitimately return (venue, title, image, message, ui) without inventing content', () => {
  const api = load();
  const storage = memory();
  assert.equal(api.save(receipt({ live: { date: '2026-12-26', venue: '', title: '', image: '' }, message: '', ui: undefined }), { storage, now: T0 }), true);
  const loaded = api.load({ ...query, storage, now: T0 });
  assert.equal(loaded.live.venue, '');
  assert.equal(loaded.live.title, '');
  assert.equal(loaded.message, '');
  assert.equal(loaded.ui.completeText, '');
  assert.equal(loaded.ui.showQuantity, true);
  assert.equal(loaded.ui.showMessage, true);
});
