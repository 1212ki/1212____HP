// Issue #46, after the independent review: T46-HEADER (RV46-01), T46-SUMMARY-BASE (RV46-04), T46-ERRORLINE (the reservation
// failure line that stays when the same reservation is drawn again).
// - T46-HEADER: with the API connected the Header says 接続中 and no band is shown; the band is for a failed connection
//   (read-only) and for Local Mode only; the build mark is the title attribute, not text. Only this display changes for the other tabs.
// - T46-SUMMARY-BASE: a failed summary read (404 / 401 / 403 / 500 / no connection) never switches API_BASE_URL and never makes the page read-only.
// - T46-ERRORLINE: the failure line of a status change survives a redraw of the same reservation, and is gone for another one.
// All data is synthetic (test/fixtures/admin-live-states.json).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  flushAsync,
  jsonResponse,
  loadAdminApp,
} from './support/admin-app-harness.mjs';

const repoRoot = process.cwd();
const BASE = 'e191e53ada480014e03ad2fa23835f6178ce371a';
const fixture = JSON.parse(readFileSync(join(repoRoot, 'test/fixtures/admin-live-states.json'), 'utf8'));
const adminHtml = readFileSync(join(repoRoot, 'admin/index.html'), 'utf8');
const adminJs = readFileSync(join(repoRoot, 'admin/app.js'), 'utf8');
const gitShow = (path) => execFileSync('git', ['show', `${BASE}:${path}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

const CUSTOM_BASE = 'https://custom-admin.example.test';
const CANONICAL_BASE = 'https://1212hp.itsukimatsumoto.workers.dev';
const BUILD = '2026-11-20T1600Z';
const SUMMARY_PATH = '/api/admin/ticket-reservation-summary';
const plain = (value) => JSON.parse(JSON.stringify(value));

const siteDataBody = () => ({ data: structuredClone(fixture.data) });
const element = (app, id) => app.elements.get(id);

// ---------------------------------------------------------------------------------------------------------
// T46-HEADER
// ---------------------------------------------------------------------------------------------------------
function connectedApp(options = {}) {
  return loadAdminApp({
    buildId: BUILD,
    adminConfig: { apiBaseUrl: CUSTOM_BASE, adminToken: 'test-token' },
    networkFetch: async (url) => {
      if (url.endsWith('/api/admin/site-data')) return jsonResponse(siteDataBody());
      if (url.endsWith(SUMMARY_PATH)) return jsonResponse({ summaries: [] });
      return jsonResponse({ reservations: [] });
    },
    ...options,
  });
}

test('T46-HEADER API connected: the Header says only 接続中, the band is not shown, and the build mark is the title, not text', async () => {
  const app = connectedApp();
  app.renderModeBadge();
  assert.equal(element(app, 'modeBadge').textContent, '接続中');
  assert.equal(element(app, 'modeBadge').getAttribute('title'), BUILD);
  assert.equal(element(app, 'connectionBanner').hidden, true);
  await app.loadData();
  await flushAsync();
  assert.equal(element(app, 'modeBadge').textContent, '接続中');
  assert.equal(element(app, 'connectionBanner').hidden, true, 'a successful read keeps the band away');
  assert.doesNotMatch(element(app, 'connectionBanner').textContent, /Cloudflare/);
  for (const id of ['modeBadge', 'connectionBanner']) assert.doesNotMatch(element(app, id).textContent, /API Mode|2026-11-20T1600Z|\(/, id);
  assert.equal(element(app, 'saveBtn').textContent, '保存');
  assert.equal(element(app, 'saveBtn').disabled, false);
});

test('T46-HEADER API connection failed: the band says so, the Header stays 読み取り専用 and the 保存 button is off', async () => {
  const app = connectedApp({ networkFetch: async (url) => (url === 'data/site-data.json' ? jsonResponse(fixture.data) : jsonResponse({ error: 'offline' }, { ok: false, status: 503 })) });
  app.renderModeBadge();
  await app.loadData();
  app.applyApiFallbackReadOnlyState();
  const banner = element(app, 'connectionBanner');
  assert.equal(banner.hidden, false);
  assert.match(banner.textContent, /API接続失敗.*ローカルJSONを読み取り専用で表示/);
  assert.equal(banner.classList.contains('is-error'), true);
  assert.notEqual(element(app, 'modeBadge').textContent, '接続中', 'a failed connection is not announced as connected');
  assert.equal(element(app, 'modeBadge').textContent, 'API Fallback');
  assert.equal(element(app, 'modeBadge').getAttribute('title'), BUILD);
  assert.equal(element(app, 'saveBtn').textContent, '読み取り専用');
  assert.equal(element(app, 'saveBtn').disabled, true);
  // renderModeBadge on the same state gives the same display.
  app.renderModeBadge();
  assert.equal(element(app, 'modeBadge').textContent, 'API Fallback');
  assert.equal(banner.hidden, false);
  assert.match(banner.textContent, /読み取り専用/);
});

test('T46-HEADER Local Mode: the band says ローカルJSONモード, the Header says Local Mode, and the button exports JSON', () => {
  const app = loadAdminApp({ buildId: BUILD });
  app.renderModeBadge();
  assert.equal(element(app, 'modeBadge').textContent, 'Local Mode');
  assert.equal(element(app, 'modeBadge').getAttribute('title'), BUILD);
  assert.equal(element(app, 'connectionBanner').hidden, false);
  assert.equal(element(app, 'connectionBanner').textContent, 'ローカルJSONモード（従来運用）');
  assert.equal(element(app, 'saveBtn').textContent, 'JSONを書き出す');
  assert.equal(element(app, 'saveBtn').disabled, false);
});

test('T46-HEADER without a build mark there is no title; a connection that comes back after a failure hides the band again', async () => {
  const app = connectedApp({ buildId: '' });
  app.renderModeBadge();
  assert.equal(element(app, 'modeBadge').getAttribute('title'), null);
  app.setApiFallbackReadOnly(true);
  assert.equal(element(app, 'connectionBanner').hidden, false);
  app.setApiFallbackReadOnly(false);
  await app.loadData();
  assert.equal(element(app, 'connectionBanner').hidden, true);
});

test('T46-HEADER the other tabs differ from the base commit only in this display: 保存 button, Local Mode and read-only band, six tabs, header markup', async () => {
  const baseSource = gitShow('admin/app.js');
  const states = {
    local: (app) => app.renderModeBadge(),
    readOnly: async (app) => { app.setApiMode(true); app.setApiFallbackReadOnly(true); app.renderModeBadge(); },
  };
  for (const [name, setup] of Object.entries(states)) {
    const snapshot = async (source) => {
      const app = loadAdminApp({ adminSource: source, adminConfig: name === 'local' ? {} : { apiBaseUrl: CUSTOM_BASE, adminToken: 'test-token' } });
      await setup(app);
      const banner = element(app, 'connectionBanner');
      return plain({
        saveText: element(app, 'saveBtn').textContent,
        saveDisabled: element(app, 'saveBtn').disabled,
        bannerText: banner.textContent,
        bannerError: banner.classList.contains('is-error'),
        bannerApi: banner.classList.contains('is-api'),
      });
    };
    assert.deepEqual(await snapshot(adminJs), await snapshot(baseSource), `${name}: 保存 button and band are as at the base commit`);
  }
  const block = (html, open, close) => html.slice(html.indexOf(open), html.indexOf(close, html.indexOf(open)) + close.length);
  assert.equal(block(adminHtml, '<header class="header">', '</header>'), block(gitShow('admin/index.html'), '<header class="header">', '</header>'), 'the Header markup is the base');
  const nav = block(adminHtml, '<nav class="tab-nav">', '</nav>');
  assert.equal(nav, block(gitShow('admin/index.html'), '<nav class="tab-nav">', '</nav>'), 'the tab navigation is the base');
  assert.deepEqual([...nav.matchAll(/data-tab="([a-z]+)"[^>]*>([^<]+)</g)].map((match) => `${match[1]}:${match[2]}`), ['site:Site', 'news:News', 'live:Live', 'youtube:YouTube', 'discography:Disco', 'profile:Profile']);
});

test('T46-HEADER a load error shows the band again with its message; the boot marker keeps the build out of the visible text', () => {
  assert.match(adminHtml, /banner\.hidden\s*=\s*false/);
  assert.doesNotMatch(adminHtml, /textContent\s*=\s*'Loading \('/);
  assert.match(adminHtml, /setAttribute\('title',\s*window\.ADMIN_BUILD_ID\)/);
  assert.doesNotMatch(adminJs, /'API Mode'|API Mode"|Cloudflare API接続中/, 'the old display texts are gone from the app');
});

// ---------------------------------------------------------------------------------------------------------
// T46-SUMMARY-BASE
// ---------------------------------------------------------------------------------------------------------
// The custom base answers `summary`; the canonical base (the production Worker's name, never reached: this is a fake) answers 200 for everything.
function summaryApp(summary) {
  return loadAdminApp({
    // A 401 / 403 makes adminFetch forget the token and ask again; the answer lets the later save and status change go out.
    promptValue: 'test-token',
    adminConfig: { apiBaseUrl: CUSTOM_BASE, adminToken: 'test-token' },
    networkFetch: async (url, options = {}) => {
      if (url.startsWith(CANONICAL_BASE)) return url.endsWith(SUMMARY_PATH) ? jsonResponse({ summaries: [] }) : jsonResponse({ ok: true, reservations: [] });
      if (url === `${CUSTOM_BASE}${SUMMARY_PATH}`) return summary(options);
      if (url.endsWith('/status') || options.method === 'PUT' || options.method === 'POST') return jsonResponse({ ok: true, updated: 1 });
      return jsonResponse({ reservations: [] });
    },
  });
}

const FAILURES = {
  '404': () => jsonResponse({ error: 'not found' }, { ok: false, status: 404 }),
  '401': () => jsonResponse({ error: 'forbidden' }, { ok: false, status: 401 }),
  '403': () => jsonResponse({ error: 'forbidden' }, { ok: false, status: 403 }),
  '500': () => jsonResponse({ error: 'broken' }, { ok: false, status: 500 }),
  'no connection': () => { throw new Error('通信できません'); },
};

for (const [name, answer] of Object.entries(FAILURES)) {
  test(`T46-SUMMARY-BASE a summary read that fails (${name}) is only ever sent to the one base, keeps the base URL, and the save and reservation routes go on using it`, async () => {
    const app = summaryApp(answer);
    app.setSiteData(app.normalizeSiteData(structuredClone(fixture.data)));
    app.setSavedBaseline(plain(app.getSiteData()));
    await app.loadReservationSummary();
    const summaryCalls = app.networkFetchCalls.filter((call) => call.url.endsWith(SUMMARY_PATH));
    // A 401 / 403 asks for the passphrase again and retries on the same base (existing behavior); nothing is ever sent to another base.
    assert.deepEqual([...new Set(summaryCalls.map((call) => call.url))], [`${CUSTOM_BASE}${SUMMARY_PATH}`], 'no try on another base');
    assert.equal(summaryCalls.length, ['401', '403'].includes(name) ? 2 : 1);
    assert.notEqual(app.getReservationSummary().status, 'ready');
    assert.equal(app.getLiveEditorState().readOnly, false, 'a summary failure never makes the page read-only');
    assert.equal(element(app, 'connectionBanner').hidden === true || !/読み取り専用/.test(element(app, 'connectionBanner').textContent), true);

    assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), true);
    await app.saveToApi(plain(app.getSiteData()));
    const sent = app.networkFetchCalls.filter((call) => call.options.method === 'POST' || call.options.method === 'PUT').map((call) => call.url);
    assert.ok(sent.length >= 2, 'a status change and a save were sent');
    for (const url of sent) assert.ok(url.startsWith(`${CUSTOM_BASE}/`), `${url} goes to the same base`);
    assert.ok(app.networkFetchCalls.every((call) => !call.url.startsWith(CANONICAL_BASE)), 'the canonical base was never tried');
  });
}

test('T46-SUMMARY-BASE the summary read asks adminFetch not to fall back, and the other reads and writes keep the default policy', async () => {
  const app = loadAdminApp({ adminConfig: { apiBaseUrl: CUSTOM_BASE, adminToken: 'test-token' } });
  app.setSiteData(app.normalizeSiteData(structuredClone(fixture.data)));
  app.useAdminFetch(async (path) => (path === SUMMARY_PATH ? jsonResponse({ summaries: [] }) : jsonResponse({ reservations: [] })));
  await app.loadReservationSummary();
  await app.loadTickets();
  await app.markTicketStatus('fx-res-1', 'handled');
  const policyOf = (predicate) => app.fetchCalls.filter(predicate).map((call) => ({ ...call.policy }));
  const summaryPolicies = policyOf((call) => call.path === SUMMARY_PATH);
  assert.ok(summaryPolicies.length >= 2, 'the list read and the reload after the status change both read the summary');
  for (const policy of summaryPolicies) assert.deepEqual(policy, { allowBaseFallback: false });
  assert.ok(app.fetchCalls.length >= 4);
  for (const policy of policyOf((call) => call.path !== SUMMARY_PATH)) assert.deepEqual(policy, {}, 'every other call is unchanged');
});

test('T46-SUMMARY-BASE the other reads still fall back to the canonical base as before (only the summary is exempt)', async () => {
  const app = loadAdminApp({
    adminConfig: { apiBaseUrl: CUSTOM_BASE, adminToken: 'test-token' },
    networkFetch: async (url) => (url.startsWith(CANONICAL_BASE) ? jsonResponse({ reservations: [] }) : jsonResponse({ error: 'not found' }, { ok: false, status: 404 })),
  });
  app.setSiteData(app.normalizeSiteData(structuredClone(fixture.data)));
  app.renderTicketsUi();
  await app.loadTickets();
  assert.ok(app.networkFetchCalls.some((call) => call.url.startsWith(CANONICAL_BASE)), 'the tickets read reached the canonical base after the 404');
});

// ---------------------------------------------------------------------------------------------------------
// T46-ERRORLINE
// ---------------------------------------------------------------------------------------------------------
const LIVE_ID = 'fx-live-long';
const reservationRows = () => structuredClone(fixture.reservations[LIVE_ID]);
const errorText = (app) => element(app, 'reservation-detail-error').textContent;
const failStatus = () => jsonResponse({ error: '更新できません' }, { ok: false, status: 500 });

function reservationApp({ wide = true, status = failStatus, rows = reservationRows() } = {}) {
  const app = loadAdminApp({ wide });
  app.setApiMode(true);
  app.setSiteData(app.normalizeSiteData(structuredClone(fixture.data)));
  app.setSavedBaseline(plain(app.getSiteData()));
  app.setupLiveWorkspace();
  app.setupTabs();
  app.renderLive();
  const calls = { statuses: 0, reads: 0 };
  app.useAdminFetch(async (path) => {
    if (path === SUMMARY_PATH) return jsonResponse({ summaries: [] });
    if (/\/status$/.test(path)) { calls.statuses += 1; return status(calls.statuses); }
    calls.reads += 1;
    return jsonResponse({ reservations: typeof rows === 'function' ? rows() : rows });
  });
  return { app, calls };
}

async function openDetail({ id = 'fx-res-1', ...options } = {}) {
  const context = reservationApp(options);
  assert.equal(context.app.editLive(LIVE_ID, 'upcoming'), true);
  await flushAsync();
  context.app.setLiveEditorTask('reservation');
  await flushAsync();
  assert.equal(context.app.openReservationDetail(id, 'live'), true);
  return context;
}

test('T46-ERRORLINE (a) after a failed status change, drawing the same reservation again keeps the failure line (width change, ledger read, the view called again)', async () => {
  const { app } = await openDetail();
  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), false);
  assert.equal(errorText(app), '更新失敗: 更新できません');
  assert.equal(app.getReservationViewState().view, 'detail');

  app.setWide(false);
  assert.equal(app.getReservationViewState().detailId, 'fx-res-1');
  assert.equal(errorText(app), '更新失敗: 更新できません', 'crossing 900px (narrow) keeps the line');
  app.setWide(true);
  assert.equal(errorText(app), '更新失敗: 更新できません', 'crossing 900px (wide) keeps the line');

  await app.loadLiveReservations(LIVE_ID);
  await flushAsync();
  assert.equal(app.getReservationViewState().view, 'detail');
  assert.equal(errorText(app), '更新失敗: 更新できません', 'a ledger read keeps the line');

  app.setLiveReservationView('detail', 'fx-res-1', { focus: false });
  assert.equal(errorText(app), '更新失敗: 更新できません', 'the same reservation drawn again keeps the line');
});

test('T46-ERRORLINE (a) the same holds for the 予約管理 detail, and an authentication failure line is kept as well', async () => {
  const app = reservationApp({ status: () => jsonResponse({ error: 'unauthorized' }, { ok: false, status: 401 }) }).app;
  await app.loadTickets();
  assert.equal(app.openReservationDetail('fx-res-1', 'cross'), true);
  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), false);
  const line = errorText(app);
  assert.notEqual(line, '');
  app.setWide(false);
  assert.equal(app.getReservationViewState().crossDetailId, 'fx-res-1');
  assert.equal(errorText(app), line);
  app.setWide(true);
  app.syncCrossReservationView({ focus: false });
  assert.equal(errorText(app), line);
});

test('T46-ERRORLINE (b) another reservation, the list, and then the same reservation again start without the line', async () => {
  const { app } = await openDetail();
  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), false);
  assert.equal(errorText(app), '更新失敗: 更新できません');

  assert.equal(app.openReservationDetail('fx-res-2', 'live'), true);
  assert.equal(app.getReservationViewState().detailId, 'fx-res-2');
  assert.equal(errorText(app), '', 'another reservation has no line');

  assert.equal(app.openReservationDetail('fx-res-1', 'live'), true);
  assert.equal(errorText(app), '', 'the line belonged to the earlier opening');
  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), false);
  assert.equal(errorText(app), '更新失敗: 更新できません');
  app.setLiveReservationView('list');
  assert.equal(app.getReservationViewState().view, 'list');
  app.setLiveReservationView('detail', 'fx-res-1');
  assert.equal(errorText(app), '', 'back to the list and in again: no line');
});

test('T46-ERRORLINE (b) the 予約管理 detail: closing it and opening it again, or opening another one, starts without the line', async () => {
  const { app } = reservationApp({ status: failStatus });
  await app.loadTickets();
  app.openReservationDetail('fx-res-1', 'cross');
  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), false);
  assert.equal(errorText(app), '更新失敗: 更新できません');
  app.openReservationDetail('fx-res-2', 'cross');
  assert.equal(errorText(app), '');
  app.openReservationDetail('fx-res-1', 'cross');
  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), false);
  app.closeCrossReservationDetail();
  app.openReservationDetail('fx-res-1', 'cross');
  assert.equal(errorText(app), '');
});

test('T46-ERRORLINE (c) a status change that succeeds leaves no line: the reservation closes and opens clean', async () => {
  const { app, calls } = await openDetail({ status: (count) => (count === 1 ? failStatus() : jsonResponse({ ok: true, updated: 1 })) });
  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), false);
  assert.equal(errorText(app), '更新失敗: 更新できません');
  assert.equal(await app.markTicketStatus('fx-res-1', 'handled'), true, 'the second try succeeds');
  await flushAsync();
  assert.equal(calls.statuses, 2);
  assert.equal(app.getReservationViewState().detailId, null);
  assert.equal(app.openReservationDetail('fx-res-1', 'live'), true);
  assert.equal(errorText(app), '', 'no line after a success');
  app.setWide(false);
  app.setWide(true);
  assert.equal(errorText(app), '');
});
