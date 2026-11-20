(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root) root.ReservationCta = api;
}(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  // The decision itself stays in LiveOperations.getTicketCta. This module only maps its
  // answer to the four public labels and to the Ticket-page sentences.
  const LABELS = Object.freeze({
    internal: '予約する',
    external: '予約する（外部サイト）',
    closed: '予約受付終了',
    invalid: '予約先を確認中',
  });
  const CHOOSE_OTHER = '別のライブを選択してください。';
  const UNIDENTIFIED = '予約情報を確認できません。時間をおいて再度お試しください。';
  const SENTENCES = Object.freeze({
    past: `指定されたライブは終了したライブです。${CHOOSE_OTHER}`,
    reservationClosed: `指定されたライブの予約受付は終了しています。${CHOOSE_OTHER}`,
    invalid: `指定されたライブの予約先を確認中です。${CHOOSE_OTHER}`,
    unknown: `指定されたライブが見つかりません。${CHOOSE_OTHER}`,
    external: 'このライブの予約は外部サイトで受け付けています。',
    ambiguous: UNIDENTIFIED,
    helper: UNIDENTIFIED,
  });

  function operations() {
    const helper = root && root.LiveOperations;
    return helper
      && typeof helper.getTicketCta === 'function'
      && typeof helper.resolveLiveById === 'function'
      ? helper
      : null;
  }

  function result(kind, extra) {
    return Object.assign({
      kind, active: false, url: '', external: false, label: '', reason: '', live: null, category: null,
    }, extra);
  }

  function resolveLive(live, category, internalUrl, options) {
    const helper = operations();
    if (!helper) return result('helper', { reason: 'helperUnavailable', category: category || null });
    const callOptions = { isPast: category === 'past' };
    if (options && options.now != null) callOptions.now = options.now;
    const cta = helper.getTicketCta(live, internalUrl, callOptions);
    const base = { live, category: category || null, url: cta.url || '', reason: cta.reason || '' };
    if (cta.active && cta.external) return result('external', Object.assign(base, { active: true, external: true, label: LABELS.external }));
    if (cta.active) return result('internal', Object.assign(base, { active: true, label: LABELS.internal }));
    if (cta.reason === 'invalidTicketUrl') return result('invalid', Object.assign(base, { url: '', label: LABELS.invalid }));
    return result('closed', Object.assign(base, { url: '', label: LABELS.closed }));
  }

  function resolve(siteData, liveId, internalUrl, options) {
    const helper = operations();
    if (!helper) return result('helper', { reason: 'helperUnavailable' });
    const found = helper.resolveLiveById(siteData, liveId);
    if (found.status === 'ambiguous') return result('ambiguous', { reason: 'ambiguous' });
    if (found.status !== 'unique') return result('unknown', { reason: 'missing' });
    return resolveLive(found.live, found.category, internalUrl, options);
  }

  // Accepts a result from resolve/resolveLive or a bare kind.
  function reasonSentence(input) {
    const kind = input && typeof input === 'object' ? input.kind : input;
    if (kind === 'closed') {
      return input && typeof input === 'object' && input.reason === 'past' ? SENTENCES.past : SENTENCES.reservationClosed;
    }
    return SENTENCES[kind] || '';
  }

  function isInstagramUrl(url) {
    const value = String(url || '').trim();
    if (!value) return false;
    return /^https?:\/\/(www\.)?instagram\.com\//i.test(value);
  }

  return { LABELS, resolve, resolveLive, reasonSentence, isInstagramUrl };
}));
