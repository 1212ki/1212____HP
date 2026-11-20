(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root) root.LiveOrder = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // The same reading of Live dates as the Home next Live (site-content.js), so the first
  // upcoming Live on every page is the same Live.
  function toDateTime(year, month, day) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return NaN;
    if (m < 1 || m > 12 || d < 1 || d > 31) return NaN;
    return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
  }

  function parseLiveDateTime(rawDate) {
    const text = String(rawDate || '').trim();
    if (!text) return NaN;

    const japanese = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (japanese) return toDateTime(japanese[1], japanese[2], japanese[3]);

    const normalized = text.replace(/[.]/g, '/').replace(/-/g, '/');
    const slash = normalized.match(/(\d{4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
    if (slash) return toDateTime(slash[1], slash[2], slash[3]);

    const fallback = Date.parse(text);
    return Number.isFinite(fallback) ? fallback : NaN;
  }

  // Unreadable dates go last; equal dates and unreadable dates keep the stored order.
  // The input array is never changed.
  function sortByDate(events, direction) {
    const list = Array.isArray(events) ? events.slice() : [];
    const ascending = direction === 'asc';
    return list
      .map((item, index) => ({ item, index, timestamp: parseLiveDateTime(item && item.date) }))
      .sort((a, b) => {
        const aValid = Number.isFinite(a.timestamp);
        const bValid = Number.isFinite(b.timestamp);
        if (aValid && bValid) {
          const delta = ascending ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
          if (delta !== 0) return delta;
        } else if (aValid !== bValid) {
          return aValid ? -1 : 1;
        }
        return a.index - b.index;
      })
      .map((entry) => entry.item);
  }

  return {
    parseLiveDateTime,
    sortByDate,
    sortUpcoming(events) { return sortByDate(events, 'asc'); },
    sortPast(events) { return sortByDate(events, 'desc'); },
  };
}));
