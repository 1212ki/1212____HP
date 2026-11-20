(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root) root.TicketReceipt = api;
}(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  // The receipt the Ticket page hands to the complete page: one entry in this tab's
  // sessionStorage. Names, e-mail addresses and notes are never put in the address.
  const KEY = '1212hp_ticket_receipt_v1';
  const VERSION = 1;
  const TTL_MS = 30 * 60 * 1000;

  function defaultStorage() {
    try { return root && root.sessionStorage ? root.sessionStorage : null; } catch (_error) { return null; }
  }

  function storageOf(options) {
    return options && Object.prototype.hasOwnProperty.call(options, 'storage') ? options.storage : defaultStorage();
  }

  function timeOf(options) {
    const now = options && options.now;
    if (Object.prototype.toString.call(now) === '[object Date]') return now.getTime();
    return typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
  }

  const text = (value) => (typeof value === 'string' ? value : '');

  function normalize(receipt, savedAt) {
    const source = receipt && typeof receipt === 'object' ? receipt : {};
    const live = source.live && typeof source.live === 'object' ? source.live : {};
    const ui = source.ui && typeof source.ui === 'object' ? source.ui : {};
    return {
      v: VERSION,
      rid: text(source.rid),
      liveId: text(source.liveId),
      savedAt,
      live: { date: text(live.date), venue: text(live.venue), title: text(live.title), image: text(live.image) },
      name: text(source.name),
      email: text(source.email),
      quantity: source.quantity,
      message: text(source.message),
      ui: {
        completeText: text(ui.completeText),
        labelQuantity: text(ui.labelQuantity),
        labelMessage: text(ui.labelMessage),
        showQuantity: ui.showQuantity !== false,
        showMessage: ui.showMessage !== false,
      },
    };
  }

  function complete(entry) {
    return entry && entry.v === VERSION
      && typeof entry.rid === 'string' && entry.rid !== ''
      && typeof entry.liveId === 'string' && entry.liveId !== ''
      && typeof entry.savedAt === 'number' && Number.isFinite(entry.savedAt)
      && entry.live && typeof entry.live === 'object'
      && typeof entry.live.date === 'string' && typeof entry.live.venue === 'string'
      && typeof entry.name === 'string' && entry.name !== ''
      && typeof entry.email === 'string' && entry.email !== ''
      && Number.isInteger(entry.quantity) && entry.quantity >= 1 && entry.quantity <= 10;
  }

  function save(receipt, options) {
    try {
      const storage = storageOf(options);
      if (!storage) return false;
      const entry = normalize(receipt, timeOf(options));
      if (!complete(entry)) return false;
      storage.setItem(KEY, JSON.stringify(entry));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function clear(options) {
    try {
      const storage = storageOf(options);
      if (storage) storage.removeItem(KEY);
    } catch (_error) { /* nothing to clear */ }
  }

  // Returns the receipt only when it is whole, within 30 minutes, and for exactly the Live
  // and receipt number in the address. Anything else is "no receipt"; nothing is invented.
  function load(query, options) {
    const input = query && typeof query === 'object' ? query : {};
    const settings = options || input;
    try {
      const storage = storageOf(settings);
      if (!storage) return null;
      const raw = storage.getItem(KEY);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (!complete(entry)) return null;
      const age = timeOf(settings) - entry.savedAt;
      if (age < 0 || age > TTL_MS) {
        clear(settings);
        return null;
      }
      if (entry.liveId !== text(input.liveId) || entry.rid !== text(input.rid)) return null;
      return normalize(entry, entry.savedAt);
    } catch (_error) {
      return null;
    }
  }

  return { KEY, VERSION, TTL_MS, save, load, clear };
}));
