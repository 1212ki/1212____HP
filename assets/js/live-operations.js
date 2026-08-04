(function initLiveOperations(root, factory) {
  const api = factory();
  const isCommonJs = typeof module === 'object' && module.exports;

  if (isCommonJs) {
    module.exports = api;
  } else if (root) {
    root.LiveOperations = api;
  }
}(typeof window !== 'undefined' ? window : globalThis, function createLiveOperations() {
  'use strict';

  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const ENGLISH_WEEKDAYS = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };
  const SOCIAL_HOSTS = [
    'instagram.com',
    'x.com',
    'twitter.com',
    'youtube.com',
    'youtu.be',
    'facebook.com',
    'fb.com',
    'tiktok.com',
    'threads.net',
    'bandcamp.com',
    'soundcloud.com',
    'spotify.com',
  ];
  const TICKET_HOSTS = [
    'tiget.net',
    'eplus.jp',
    'pia.jp',
    'l-tike.com',
    'livepocket.jp',
    'zaiko.io',
    'peatix.com',
    'teket.jp',
    'ticketpay.jp',
    'confetti-web.com',
    'rakuten-ticket.com',
    'ticketbook.jp',
    'eventregist.com',
  ];
  const TOKYO_UTC_OFFSET_MS = 9 * 60 * 60 * 1000;

  function own(object, property) {
    return object != null && Object.prototype.hasOwnProperty.call(object, property);
  }

  function stringValue(value) {
    return value == null ? '' : String(value).trim();
  }

  function hostMatches(hostname, candidate) {
    return hostname === candidate || hostname.endsWith(`.${candidate}`);
  }

  function cleanUrl(value) {
    return stringValue(value)
      .replace(/^[\s\u300c\u300e\u3010(<\[]+/u, '')
      .replace(/[\s\u300d\u300f\u3011。、，．!！?？;；:：)>\]}]+$/u, '');
  }

  function parseSafeHttpUrl(value) {
    let parsed;
    try {
      parsed = new URL(stringValue(value));
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      decodeURIComponent(parsed.pathname);
      decodeURIComponent(parsed.search);
      decodeURIComponent(parsed.hash);
    } catch (_error) {
      return null;
    }
    return parsed;
  }

  function isRecognizableBookingUrl(value) {
    const cleaned = cleanUrl(value);
    const parsed = parseSafeHttpUrl(cleaned);
    if (!parsed) return false;

    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (SOCIAL_HOSTS.some((candidate) => hostMatches(hostname, candidate))) return false;
    const path = decodeURIComponent(parsed.pathname).toLowerCase();
    if (/(?:^|\/)profile(?:\/|$)/.test(path)) return false;
    if (/(?:^|\/)live\/detail(?:\/|$)/.test(path)) return false;
    if (hostname === 'ssl.form-mailer.jp' && /^\/fms\/[a-z0-9_-]+\/?$/i.test(path)) return true;
    if (TICKET_HOSTS.some((candidate) => hostMatches(hostname, candidate))) return true;

    if (/(?:^|[\/_.-])(?:tickets?|reserve|reservation|reservations|booking)(?:$|[\/_.-])/.test(path)) {
      return true;
    }

    for (const key of parsed.searchParams.keys()) {
      if (/^(?:ticket|tickets|reserve|reservation|booking)$/i.test(key)) return true;
    }
    return false;
  }

  function parseWeekday(value) {
    const normalized = stringValue(value).toLowerCase();
    if (WEEKDAYS.includes(normalized)) return WEEKDAYS.indexOf(normalized);
    return Object.prototype.hasOwnProperty.call(ENGLISH_WEEKDAYS, normalized)
      ? ENGLISH_WEEKDAYS[normalized]
      : null;
  }

  function parseLiveDate(value) {
    const text = String(value == null ? '' : value);
    const match = text.match(/(20\d{2})\s*(?:[.\/-]|年)\s*(\d{1,2})\s*(?:[.\/-]|月)\s*(\d{1,2})\s*日?/u);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day
    ) {
      return null;
    }

    const afterDate = text.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 20);
    const weekdayMatch = afterDate.match(/^\s*[（(\[]?\s*(日|月|火|水|木|金|土|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\s*(?:曜(?:日)?)?\s*[）)\]]?/iu);
    const declaredWeekday = weekdayMatch ? parseWeekday(weekdayMatch[1]) : null;

    return {
      date: `${String(year).padStart(4, '0')}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`,
      year,
      month,
      day,
      weekday: date.getUTCDay(),
      declaredWeekday,
      matchedText: match[0] + (weekdayMatch ? weekdayMatch[0] : ''),
    };
  }

  function getWeekdayMismatchWarning(parsedDate) {
    if (!parsedDate || parsedDate.declaredWeekday == null || parsedDate.declaredWeekday === parsedDate.weekday) {
      return '';
    }
    return `記載曜日（${WEEKDAYS[parsedDate.declaredWeekday]}）と日付の曜日（${WEEKDAYS[parsedDate.weekday]}）が一致しません。`;
  }

  function emptyDraft(sourceText) {
    return {
      sourceText,
      date: '',
      title: '',
      venue: '',
      details: '',
      description: '',
      ticketUrl: '',
    };
  }

  function isDetailMarker(line) {
    return /^(?:open\b|start\b|open\s*\/\s*start\b|出演|act\b|lineup\b|w\/|with\b|adv\b|door\b|前売|当日|料金|charge\b|ticket\b|予約)/iu.test(line);
  }

  function splitSourceSegments(sourceText) {
    const openStartSeparator = '\u0000OPEN_START_SEPARATOR\u0000';
    return sourceText
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .flatMap((line) => line
        .replace(/(\bOPEN\s+\S+)\s+\/\s+(START\s+\S+)/giu, `$1${openStartSeparator}$2`)
        .split(/\s+\/\s+/u))
      .map((line) => line.replace(openStartSeparator, ' / ').trim())
      .filter(Boolean);
  }

  function removeSelectedTicketUrl(line, ticketUrl) {
    if (!ticketUrl) return line;

    let removed = false;
    const remaining = line.replace(/https?:\/\/[^\s<>"']+/giu, (candidate) => {
      if (cleanUrl(candidate) !== ticketUrl) return candidate;
      removed = true;
      return '';
    });
    if (!removed) return line;

    return remaining
      .replace(/^\s*(?:予約(?:\s*URL)?|ticket(?:\s*URL)?)\s*[:：]?\s*/iu, '')
      .replace(/\s{2,}/gu, ' ')
      .trim();
  }

  function parseLiveSourceText(input) {
    const sourceText = input == null ? '' : String(input);
    const draft = emptyDraft(sourceText);
    const warnings = [];

    if (!sourceText.trim()) {
      warnings.push('入力テキストが空です。');
      return { draft, warnings };
    }

    const lines = splitSourceSegments(sourceText);
    let parsedDate = null;
    let dateLineIndex = -1;
    let titleLineIndex = -1;
    let venueLineIndex = -1;

    for (let index = 0; index < lines.length; index += 1) {
      const candidate = parseLiveDate(lines[index]);
      if (candidate) {
        parsedDate = candidate;
        dateLineIndex = index;
        draft.date = candidate.date;
        break;
      }
    }

    if (!parsedDate) {
      warnings.push('日付を特定できませんでした。');
    } else {
      const weekdayWarning = getWeekdayMismatchWarning(parsedDate);
      if (weekdayWarning) warnings.push(weekdayWarning);
    }

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const labeledVenue = line.match(/^(?:会場|場所|venue)\s*[:：]\s*(.+)$/iu);
      const atVenue = line.match(/^@\s*([^\s].*)$/u);
      if (labeledVenue || atVenue) {
        draft.venue = stringValue((labeledVenue || atVenue)[1]);
        venueLineIndex = index;
        break;
      }
    }
    if (!draft.venue) warnings.push('会場を特定できませんでした。');

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const labeledTitle = line.match(/^(?:タイトル|公演名|event|live)\s*[:：]\s*(.+)$/iu);
      const bracketedTitle = line.match(/^[『「【]\s*(.+?)\s*[』」】]$/u);
      if (labeledTitle || bracketedTitle) {
        draft.title = stringValue((labeledTitle || bracketedTitle)[1]);
        titleLineIndex = index;
        break;
      }
    }

    if (!draft.title) {
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (index === dateLineIndex || index === venueLineIndex) continue;
        if (/^@/u.test(line) || /https?:\/\//iu.test(line) || isDetailMarker(line)) continue;
        draft.title = line;
        titleLineIndex = index;
        break;
      }
    }

    const urls = sourceText.match(/https?:\/\/[^\s<>"']+/giu) || [];
    for (const candidate of urls) {
      const cleaned = cleanUrl(candidate);
      if (isRecognizableBookingUrl(cleaned)) {
        draft.ticketUrl = cleaned;
        break;
      }
    }

    const details = lines.map((line, index) => {
      if (index === dateLineIndex || index === titleLineIndex || index === venueLineIndex) return '';
      return removeSelectedTicketUrl(line, draft.ticketUrl);
    }).filter(Boolean).join('\n');
    draft.details = details;
    draft.description = details;

    return { draft, warnings };
  }

  function getTicketUrl(live) {
    if (!live || typeof live !== 'object') return '';
    if (own(live, 'ticketUrl')) return stringValue(live.ticketUrl);

    const legacyLink = cleanUrl(live.link);
    return isRecognizableBookingUrl(legacyLink) ? legacyLink : '';
  }

  function getLiveEntries(input) {
    const source = input && typeof input === 'object' && input.live && typeof input.live === 'object'
      ? input.live
      : (input && typeof input === 'object' ? input : {});
    const upcoming = Array.isArray(source.upcoming) ? source.upcoming : [];
    const past = Array.isArray(source.past) ? source.past : [];
    return [
      ...upcoming.map((live) => ({ live, category: 'upcoming' })),
      ...past.map((live) => ({ live, category: 'past' })),
    ];
  }

  function resolveLiveById(input, liveId) {
    const id = stringValue(liveId);
    const matches = id
      ? getLiveEntries(input).filter((entry) => stringValue(entry.live && entry.live.id) === id)
      : [];
    if (matches.length === 0) return { status: 'missing', id, live: null, category: null };
    if (matches.length !== 1) return { status: 'ambiguous', id, live: null, category: null };
    return { status: 'unique', id, live: matches[0].live, category: matches[0].category };
  }

  function findDuplicateLiveIds(input) {
    const counts = new Map();
    for (const entry of getLiveEntries(input)) {
      const id = stringValue(entry.live && entry.live.id);
      if (!id) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id)
      .sort();
  }

  function isPastLive(live, options) {
    if (options.isPast === true || live.isPast === true || live.past === true) return true;
    const parsed = parseLiveDate(live.date);
    if (!parsed) return false;

    const now = options.now instanceof Date
      ? options.now
      : new Date(options.now == null ? Date.now() : options.now);
    if (Number.isNaN(now.getTime())) return false;
    const tokyoNow = new Date(now.getTime() + TOKYO_UTC_OFFSET_MS);
    const today = Date.UTC(tokyoNow.getUTCFullYear(), tokyoNow.getUTCMonth(), tokyoNow.getUTCDate());
    const liveDate = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
    return liveDate < today;
  }

  function getTicketCta(liveInput, internalUrl, optionsInput) {
    const live = liveInput && typeof liveInput === 'object' ? liveInput : {};
    const options = optionsInput && typeof optionsInput === 'object' ? optionsInput : {};

    if (live.reservationClosed === true) {
      return { active: false, url: '', external: false, label: '予約終了', reason: 'reservationClosed' };
    }
    if (isPastLive(live, options)) {
      return { active: false, url: '', external: false, label: '予約終了', reason: 'past' };
    }

    const ticketUrl = getTicketUrl(live);
    if (ticketUrl) {
      if (!parseSafeHttpUrl(ticketUrl)) {
        return { active: false, url: '', external: false, label: '予約URLが無効です', reason: 'invalidTicketUrl' };
      }
      return { active: true, url: ticketUrl, external: true, label: '外部サイトで予約', reason: '' };
    }
    return { active: true, url: stringValue(internalUrl), external: false, label: 'このサイトで予約', reason: '' };
  }

  function buildXParentText(_live, comment, canonicalUrl) {
    return [stringValue(comment), '#ライブ', stringValue(canonicalUrl)].filter(Boolean).join('\n\n');
  }

  function buildXReplyText(liveInput) {
    const live = liveInput && typeof liveInput === 'object' ? liveInput : {};
    const details = stringValue(live.details || live.description);
    const lines = ['【ライブ詳細】'];
    if (stringValue(live.title)) lines.push(`公演：${stringValue(live.title)}`);
    if (stringValue(live.date)) lines.push(`日付：${stringValue(live.date)}`);
    if (stringValue(live.venue)) lines.push(`会場：${stringValue(live.venue)}`);
    if (details) lines.push('', details);
    return lines.join('\n');
  }

  return {
    buildXParentText,
    buildXReplyText,
    findDuplicateLiveIds,
    getTicketCta,
    getTicketUrl,
    getWeekdayMismatchWarning,
    isRecognizableBookingUrl,
    parseLiveDate,
    parseLiveSourceText,
    resolveLiveById,
  };
}));
