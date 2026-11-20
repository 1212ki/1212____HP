// Issue #46 stage 7: T46-STYLE, T46-MODE, T46-COMPAT.
// - T46-STYLE: the new CSS stays inside the Live group, uses only token variables, keeps the 44px taps, switches arrangement at
//   899/900px, and the wide screens (heading save, columns, reservation table, settings screen) behave as designed.
// - T46-MODE: read-only (API connection failed) and Local Mode, and when the header 保存 is shown.
// - T46-COMPAT: public output and the other tabs behave as at the base commit.
// The comparisons with the base use `git show <commit>:<path>` (commit contents, never a diff against the working tree), and
// a later Issue that changes one of the other groups / tabs names it in LATER_ISSUE_* below (as #46 did for #43-#45's guards).
// All data is synthetic (test/fixtures/admin-live-states.json).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  answerLiveDialog,
  flushAsync,
  jsonResponse,
  loadAdminApp,
} from './support/admin-app-harness.mjs';

const repoRoot = process.cwd();
const BASE = 'e191e53ada480014e03ad2fa23835f6178ce371a';
const fixture = JSON.parse(readFileSync(join(repoRoot, 'test/fixtures/admin-live-states.json'), 'utf8'));
const adminHtml = readFileSync(join(repoRoot, 'admin/index.html'), 'utf8');
const adminCss = readFileSync(join(repoRoot, 'admin/style.css'), 'utf8');
const adminJs = readFileSync(join(repoRoot, 'admin/app.js'), 'utf8');

// Groups of admin/style.css (the `/* ----- Name ----- */` comments) that a later Issue is allowed to change. Empty for #46.
const LIVE_GROUP = 'Live Operations Hub';
const LATER_ISSUE_STYLE_GROUPS = [];
// Tabs whose rendering a later Issue (#47) is allowed to change; the comparison with the base skips them.
const LATER_ISSUE_TABS = [];

const gitShow = (path) => execFileSync('git', ['show', `${BASE}:${path}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const plain = (value) => JSON.parse(JSON.stringify(value));

function splitGroups(css) {
  const parts = css.split(/^\/\* ----- (.+?) ----- \*\/$/m);
  const groups = new Map();
  for (let index = 1; index < parts.length; index += 2) groups.set(parts[index], parts[index + 1]);
  return { preamble: parts[0], groups };
}

// Rules (with the @media / @supports they sit in) of a piece of CSS, comments removed.
function parseRules(css, context = []) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf('{', index);
    if (open < 0) break;
    const prelude = text.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < text.length && depth > 0) {
      if (text[cursor] === '{') depth += 1;
      else if (text[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    const body = text.slice(open + 1, cursor - 1);
    if (/^@(media|supports)/.test(prelude)) rules.push(...parseRules(body, [...context, prelude]));
    else rules.push({ prelude, body, context });
    index = cursor;
  }
  return rules;
}

const selectorsOf = (rule) => rule.prelude.split(',').map((selector) => selector.trim()).filter(Boolean);
const liveGroupOf = (css) => splitGroups(css).groups.get(LIVE_GROUP) || '';
const rulesFor = (selector, rules = parseRules(liveGroupOf(adminCss))) => rules.filter((rule) => selectorsOf(rule).includes(selector));
const hasDeclaration = (rules, declaration) => rules.some((rule) => new RegExp(`(?:^|[;\\s])${declaration}\\s*;?\\s*$|(?:^|[;\\s])${declaration}\\s*;`).test(rule.body));
const minHeightOf = (rules) => Math.max(0, ...rules.flatMap((rule) => [...rule.body.matchAll(/min-height:\s*(\d+)px/g)].map((match) => Number(match[1]))));
const inContext = (rule, text) => rule.context.some((entry) => entry.includes(text));

// ---------------------------------------------------------------------------------------------------------
// T46-STYLE
// ---------------------------------------------------------------------------------------------------------
test('T46-STYLE every group of style.css except the Live group has the bytes of the base commit', () => {
  const base = splitGroups(gitShow('admin/style.css'));
  const current = splitGroups(adminCss);
  assert.equal(current.preamble, base.preamble);
  assert.deepEqual([...current.groups.keys()], [...base.groups.keys()], 'no group was added, removed or reordered');
  for (const [name, text] of base.groups) {
    if (name === LIVE_GROUP || LATER_ISSUE_STYLE_GROUPS.includes(name)) continue;
    assert.equal(current.groups.get(name), text, `the "${name}" group is unchanged`);
  }
  assert.notEqual(current.groups.get(LIVE_GROUP), base.groups.get(LIVE_GROUP), 'the work of #46 is in the Live group');
});

test('T46-STYLE every rule #46 added is scoped to Live, reservation or settings classes, never to a shared class alone', () => {
  const baseSelectors = new Set(parseRules(splitGroups(gitShow('admin/style.css')).groups.get(LIVE_GROUP)).flatMap(selectorsOf));
  const live = /live-|reservation|ticket-settings|tickets-|manual-reservation|announcement|x-intent|x-post|x-link|next-live|source-intake|edit-image/;
  const shared = /^(?:\.(?:item-card|modal[\w-]*|btn[\w-]*|add-btn|select|text-input|textarea|form-group|toast|tab-btn|tab-nav|header|logo|empty-state|image-[\w-]+)|body|html|\*)$/;
  const added = parseRules(liveGroupOf(adminCss)).flatMap(selectorsOf).filter((selector) => !baseSelectors.has(selector));
  assert.ok(added.length > 40, 'the stage 4-7 rules were added');
  for (const selector of added) {
    assert.match(selector, live, `"${selector}" names a Live / reservation / settings class`);
    assert.doesNotMatch(selector, shared, `"${selector}" is not a bare shared class`);
  }
});

test('T46-STYLE the lines #46 added use token variables only: no hex, rgb or hsl colors', () => {
  const baseLines = new Set(splitGroups(gitShow('admin/style.css')).groups.get(LIVE_GROUP).split('\n').map((line) => line.trim()));
  const added = liveGroupOf(adminCss).split('\n').map((line) => line.trim()).filter((line) => line && !baseLines.has(line));
  assert.ok(added.length > 400);
  for (const line of added) assert.doesNotMatch(line, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, line);
  assert.ok(added.some((line) => /var\(--/.test(line)));
});

test('T46-STYLE the main controls are at least 44px to tap, at every width', () => {
  const rules = parseRules(liveGroupOf(adminCss));
  const targets = [
    '.live-row', '.live-collapse-summary', '.live-segment-option', '.reservation-chip', '.reservation-row', '.live-switch-row',
    '.live-text-button', '.live-flyer-clear', '.live-editor-task-tab', '.live-dialog-actions .btn', '.reservation-row-action',
  ];
  for (const selector of targets) {
    assert.ok(minHeightOf(rulesFor(selector, rules)) >= 44, `${selector} has min-height of 44px or more`);
  }
  // The back button and the list / workspace switches are 44px on a narrow screen (the existing rule), and the footer buttons are 46px.
  const narrow = rules.filter((rule) => inContext(rule, 'max-width: 899px'));
  for (const selector of ['.live-workspace-tab', '.live-list-tab', '.live-workspace-utility', '.live-editor-back']) {
    assert.ok(minHeightOf(rulesFor(selector, narrow)) >= 44, selector);
  }
  assert.ok(minHeightOf(rulesFor('.live-editor-footer .btn', rules)) >= 46);
  assert.ok(minHeightOf(rulesFor('.ticket-settings-actions .btn', rules)) >= 46);
});

test('T46-STYLE the arrangement switches at 899px and 900px, and the page chrome steps aside only below 900px', () => {
  const rules = parseRules(liveGroupOf(adminCss));
  const media = [...new Set(rules.flatMap((rule) => rule.context).filter((entry) => entry.startsWith('@media')))];
  assert.ok(media.includes('@media (max-width: 899px)'));
  assert.ok(media.includes('@media (min-width: 900px)'));
  assert.ok(media.includes('@media (min-width: 900px) and (max-width: 1179px)'));
  for (const entry of media) assert.doesNotMatch(entry, /max-width:\s*900px|min-width:\s*899px|max-width:\s*1180px/, entry);
  for (const rule of rules) {
    if (selectorsOf(rule).some((selector) => /^body\.is-live-(?:editing|ticket-settings)\s+(?:\.header|\.connection-banner|\.tab-nav)/.test(selector))) {
      assert.ok(inContext(rule, 'max-width: 899px'), `"${rule.prelude}" hides the global chrome only below 900px`);
    }
  }
  assert.ok(rulesFor('.live-master-detail', rules).some((rule) => inContext(rule, 'min-width: 900px') && /grid-template-columns:\s*320px\s+minmax\(0,\s*1fr\)/.test(rule.body)));
  assert.ok(rulesFor('.live-editor-back', rules).some((rule) => inContext(rule, 'min-width: 900px') && /display:\s*none/.test(rule.body)), 'no back button on the wide arrangement');
});

test('T46-STYLE at 900px and above the fields are 2 and 3 columns, one column less between 900px and 1179px', () => {
  const rules = parseRules(liveGroupOf(adminCss));
  const columns = (selector, contextText, exact) => rulesFor(selector, rules)
    .filter((rule) => (exact ? rule.context.length === 1 && rule.context[0] === contextText : inContext(rule, contextText)))
    .map((rule) => rule.body.match(/grid-template-columns:\s*([^;]+);/)?.[1].replace(/\s+/g, ' '));
  const wideOnly = (selector) => columns(selector, '@media (min-width: 900px)', true).filter(Boolean).at(-1);
  const middle = (selector) => columns(selector, 'and (max-width: 1179px)').filter(Boolean).at(-1);
  assert.equal(wideOnly('.live-field-grid-venue'), 'repeat(2, minmax(0, 1fr))');
  assert.equal(wideOnly('.live-field-grid-notes'), 'repeat(2, minmax(0, 1fr))');
  assert.equal(wideOnly('.live-field-grid-times'), 'repeat(3, minmax(0, 1fr))');
  assert.equal(middle('.live-field-grid-venue'), 'minmax(0, 1fr)');
  assert.equal(middle('.live-field-grid-notes'), 'minmax(0, 1fr)');
  assert.equal(middle('.live-field-grid-times'), 'repeat(2, minmax(0, 1fr))');
  assert.ok(rulesFor('.announcement-panel:not([hidden])', rules).some((rule) => inContext(rule, '@media (min-width: 900px)') && /grid-template-columns:\s*minmax\(0, 1fr\) 420px/.test(rule.body)), 'announcement: text on the left, the post in a 420px column on the right (Figma 47:742)');
  assert.ok(rulesFor('.announcement-panel:not([hidden])', rules).some((rule) => inContext(rule, 'and (max-width: 1179px)') && /display:\s*block/.test(rule.body)));
  // the markup carries the classes the grid places
  const editor = adminJs.match(/function buildLiveEditorHtml[\s\S]*?\n}\n/)[0];
  assert.match(editor, /live-field-grid-venue/);
  assert.match(editor, /live-field-grid-times/);
  assert.match(editor, /live-field-grid-notes/);
  assert.match(editor, /live-announce-comment/);
  assert.match(editor, /live-announce-preview/);
});

test('T46-STYLE wide: 保存して公開 sits at the right of the heading, dimmed while it cannot be pressed; the Live tab is not capped at 980px', () => {
  const rules = parseRules(liveGroupOf(adminCss));
  const wide = rules.filter((rule) => rule.context.length === 1 && rule.context[0] === '@media (min-width: 900px)');
  const footer = wide.filter((rule) => selectorsOf(rule).includes('.live-editor-footer'));
  assert.ok(footer.some((rule) => /position:\s*absolute/.test(rule.body) && /top:\s*18px/.test(rule.body) && /right:\s*24px/.test(rule.body)));
  assert.ok(wide.some((rule) => selectorsOf(rule).includes('.ticket-settings-actions') && /position:\s*absolute/.test(rule.body)), 'the settings screen has the same arrangement');
  assert.ok(wide.some((rule) => selectorsOf(rule).includes('.live-editor-footer .btn:disabled') && /opacity:\s*0\.4/.test(rule.body)));
  assert.ok(wide.some((rule) => selectorsOf(rule).includes('.live-editor-pane') && /position:\s*relative/.test(rule.body)));
  assert.ok(wide.some((rule) => selectorsOf(rule).includes('#live-tab') && /max-width:\s*none/.test(rule.body)));
  // the narrow footer is still the sticky bar at the bottom (the base rule)
  assert.ok(rulesFor('.live-editor-footer', rules).some((rule) => rule.context.length === 0 && /position:\s*sticky/.test(rule.body) && /bottom:\s*0/.test(rule.body)));
});

test('T46-STYLE the sticky bottom bars (an open Live, the settings screen) have no scrolling mechanism in their ancestors', () => {
  const css = adminCss;
  const bodies = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))].map((match) => match[1]);
  };
  for (const selector of ['body', '#app', '.tab-content', '#live-tab', '.live-workspace', '.live-workspace-panel', '#live-page-primary', '.live-master-detail', '.live-editor-pane', '.live-editor-body', '.live-ticket-settings-panel', '.live-ticket-settings-body']) {
    assert.doesNotMatch(bodies(selector).join('\n'), /overflow(?:-x|-y)?:\s*(?:hidden|auto|scroll)\s*;/, `${selector} must not create a scrolling mechanism`);
  }
  const rules = parseRules(liveGroupOf(adminCss));
  assert.ok(rulesFor('.ticket-settings-actions', rules).some((rule) => inContext(rule, 'max-width: 899px') && /position:\s*sticky/.test(rule.body) && /bottom:\s*0/.test(rule.body)));
  assert.ok(rulesFor('.ticket-settings-actions', rules).some((rule) => inContext(rule, 'env(safe-area-inset-bottom)')), 'the bar clears the home indicator');
  assert.match(adminHtml, /id="live-page-primary"[\s\S]*id="live-master-detail"[\s\S]*id="live-ticket-settings-panel"[\s\S]*id="ticket-settings-actions"/);
});

test('T46-STYLE the reservation table: six columns on a wide screen and a pane of 320px on its right', () => {
  const rules = parseRules(liveGroupOf(adminCss));
  const wide = rules.filter((rule) => rule.context.length === 1 && rule.context[0] === '@media (min-width: 900px)');
  const detail = wide.find((rule) => selectorsOf(rule).some((selector) => selector.includes('data-reservation-view="detail"')));
  assert.ok(detail && /grid-template-columns:\s*minmax\(0, 1fr\) 320px/.test(detail.body));
  assert.ok(selectorsOf(detail).includes('.live-reservations-panel[data-tickets-view="detail"]'), 'the 予約管理 table opens the same pane');
  assert.ok(wide.some((rule) => selectorsOf(rule).includes('.reservation-cell') && /display:\s*block/.test(rule.body)));
  assert.ok(wide.some((rule) => selectorsOf(rule).includes('.reservation-row-action') && /display:\s*inline-flex/.test(rule.body)));
  for (const selector of ['.reservation-cell', '.reservation-row-action', '.reservation-table-head', '.reservation-pane-close']) {
    assert.ok(rulesFor(selector, rules).some((rule) => rule.context.length === 0 && /display:\s*none/.test(rule.body)), `${selector} is hidden on a narrow screen`);
  }
  const head = fixture.reservations['fx-live-long'];
  assert.ok(head.length >= 1);
});

// ---- the wide arrangement in the app ---------------------------------------------------------------------
function makeApp({ api = true, wide = false, readOnly = false } = {}) {
  const app = loadAdminApp({ wide });
  app.setApiMode(api);
  app.setSiteData(app.normalizeSiteData(structuredClone(fixture.data)));
  app.setSavedBaseline(plain(app.getSiteData()));
  if (readOnly) app.setApiFallbackReadOnly(true);
  app.setupLiveWorkspace();
  app.setupTabs();
  app.renderLive();
  app.renderTicketSettings();
  return app;
}

function useRoutes(app, { rows = [], put, status } = {}) {
  const calls = { puts: [], statuses: [], reads: [], summary: 0 };
  app.useAdminFetch(async (path, options = {}) => {
    if (path === '/api/admin/ticket-reservation-summary') { calls.summary += 1; return jsonResponse({ summaries: [] }); }
    if (path === '/api/admin/site-data' && options.method === 'PUT') { calls.puts.push(JSON.parse(options.body)); return put ? put() : jsonResponse({ ok: true }); }
    if (/\/status$/.test(path)) { calls.statuses.push({ path, body: JSON.parse(options.body) }); return status ? status() : jsonResponse({ ok: true, updated: 1 }); }
    if (path.startsWith('/api/admin/ticket-reservations')) { calls.reads.push(path); return jsonResponse({ reservations: structuredClone(rows) }); }
    return jsonResponse({});
  });
  return calls;
}

const LIVE_ID = 'fx-live-long';
const reservationRows = () => structuredClone(fixture.reservations[LIVE_ID]);
const fakeTarget = (attrs) => {
  const key = Object.keys(attrs)[0];
  const node = { dataset: attrs, closest(selector) { return selector.includes(`data-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`) ? node : null; } };
  return { target: node, preventDefault() {} };
};
const click = (app, attrs) => app.handleReservationViewAction(fakeTarget(attrs));
const typeInto = async (app, id, value) => { app.elements.get(id).value = value; await app.elements.get(id).dispatch('input'); };

async function openLive(app, id = LIVE_ID, category = 'upcoming') {
  assert.equal(app.editLive(id, category), true);
  await flushAsync();
}

test('T46-STYLE wide: 保存して公開 is in the heading for every task, dimmed until something is unsaved, and a narrow screen keeps the bar hidden', async () => {
  const wide = makeApp({ wide: true });
  useRoutes(wide, { rows: reservationRows() });
  await openLive(wide);
  const footer = () => wide.elements.get('live-editor-footer');
  const button = () => wide.elements.get('live-editor-save-btn');
  for (const task of ['public', 'announcement', 'reservation']) {
    wide.setLiveEditorTask(task);
    await flushAsync();
    assert.equal(footer().hidden, false, `shown on ${task}`);
    assert.equal(button().disabled, true, `dimmed and not pressable on ${task} while nothing is unsaved`);
  }
  wide.setLiveEditorTask('public');
  const original = wide.elements.get('edit-title').value;
  await typeInto(wide, 'edit-title', `${original} 変更`);
  assert.equal(button().disabled, false, 'pressable once something is unsaved');
  assert.equal(wide.elements.get('live-editor-save-status').textContent, '未保存');
  await typeInto(wide, 'edit-title', original);
  assert.equal(button().disabled, true, 'typed back = nothing unsaved = dimmed again');
  assert.equal(footer().hidden, false);

  const narrow = makeApp({ wide: false });
  useRoutes(narrow, { rows: reservationRows() });
  await openLive(narrow);
  assert.equal(narrow.elements.get('live-editor-footer').hidden, true, 'narrow: the bar is hidden while nothing is unsaved');
  await typeInto(narrow, 'edit-title', 'x');
  assert.equal(narrow.elements.get('live-editor-footer').hidden, false);
  assert.equal(narrow.elements.get('live-editor-save-btn').disabled, false);
});

test('T46-STYLE wide: saving keeps the heading button dimmed while it runs and after it is saved; a failure makes it pressable again', async () => {
  const app = makeApp({ wide: true });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const calls = useRoutes(app, { put: async () => { await gate; return jsonResponse({ ok: true }); } });
  await openLive(app);
  await typeInto(app, 'edit-venue', 'テスト会場Z');
  const saving = app.saveLiveWorkspace();
  await flushAsync();
  assert.equal(app.elements.get('live-editor-save-btn').disabled, true, 'not pressable while saving');
  release();
  assert.equal(await saving, true);
  assert.equal(calls.puts.length, 1);
  assert.equal(app.elements.get('live-editor-save-btn').disabled, true, 'saved: nothing unsaved, dimmed');
  assert.equal(app.elements.get('live-editor-footer').hidden, false);

  const failing = makeApp({ wide: true });
  useRoutes(failing, { put: () => jsonResponse({ error: 'x' }, { ok: false, status: 400 }) });
  await openLive(failing);
  await typeInto(failing, 'edit-venue', 'テスト会場Y');
  assert.equal(await failing.saveLiveWorkspace(), false);
  assert.equal(failing.elements.get('live-editor-save-status').textContent, '保存できませんでした');
  assert.equal(failing.elements.get('live-editor-save-btn').disabled, false, 'failed: pressable again');
});

test('T46-STYLE wide: one reservation opens beside the list and the Header stays on the Live; narrow replaces the list and shows the reservation in the Header', async () => {
  const wide = makeApp({ wide: true });
  useRoutes(wide, { rows: reservationRows() });
  await openLive(wide);
  wide.setLiveEditorTask('reservation');
  await flushAsync();
  const heading = wide.elements.get('live-editor-heading').textContent;
  assert.match(heading, /2099\.12\.12/);
  const first = reservationRows().find((row) => row.status === 'pending');
  click(wide, { reservationOpen: first.id, reservationScope: 'live' });
  assert.equal(wide.getReservationViewState().view, 'detail');
  assert.equal(wide.elements.get('live-reservation-list-view').hidden, false, 'the list stays');
  assert.equal(wide.elements.get('live-reservation-detail').hidden, false);
  assert.equal(wide.elements.get('live-editor-task-tabs').hidden, false, 'the 公開内容／告知／予約 switch stays');
  assert.equal(wide.elements.get('live-editor-heading').textContent, heading, 'the Header stays on the Live');
  assert.equal(wide.elements.get('live-editor-panel-reservation').getAttribute('data-reservation-view'), 'detail');
  assert.match(wide.elements.get('live-reservation-detail').innerHTML, /data-reservation-close/);
  assert.equal(wide.elements.get('live-editor-footer').hidden, false);
  click(wide, { reservationClose: '' });
  assert.equal(wide.getReservationViewState().view, 'list');
  assert.equal(wide.elements.get('live-reservation-detail').hidden, true);

  const narrow = makeApp({ wide: false });
  useRoutes(narrow, { rows: reservationRows() });
  await openLive(narrow);
  narrow.setLiveEditorTask('reservation');
  await flushAsync();
  click(narrow, { reservationOpen: first.id, reservationScope: 'live' });
  assert.equal(narrow.elements.get('live-reservation-list-view').hidden, true, 'narrow: the list is replaced');
  assert.equal(narrow.elements.get('live-editor-task-tabs').hidden, true);
  assert.match(narrow.elements.get('live-editor-heading').textContent, /　\d+枚$/);
});

test('T46-STYLE wide: the 取り置き form opens on the right of the list; crossing 900px re-applies the arrangement without losing what is open', async () => {
  const app = makeApp({ wide: true });
  useRoutes(app, { rows: reservationRows() });
  await openLive(app);
  app.setLiveEditorTask('reservation');
  await flushAsync();
  app.elements.get('live-reservation-add-btn').dispatch('click');
  assert.equal(app.getReservationViewState().view, 'add');
  assert.equal(app.elements.get('live-reservation-list-view').hidden, false);
  assert.equal(app.elements.get('manual-reservation-form').hidden, false);
  app.elements.get('manual-reservation-name').value = '架空 五郎';

  app.setWide(false);
  assert.equal(app.getReservationViewState().view, 'add', 'the form stays open');
  assert.equal(app.elements.get('manual-reservation-name').value, '架空 五郎', 'what was typed stays');
  assert.equal(app.elements.get('live-reservation-list-view').hidden, true, 'narrow: the form takes the place of the list');
  assert.equal(app.elements.get('live-editor-heading').textContent, '取り置きを追加');
  app.setWide(true);
  assert.equal(app.elements.get('live-reservation-list-view').hidden, false);
  assert.match(app.elements.get('live-editor-heading').textContent, /2099\.12\.12/);
});

test('T46-STYLE the reservation rows carry the table cells, a pending row can be marked 対応済み in the row, and the status route is unchanged', async () => {
  const app = makeApp({ wide: true });
  const calls = useRoutes(app, { rows: reservationRows() });
  await openLive(app);
  app.setLiveEditorTask('reservation');
  await flushAsync();
  const html = app.elements.get('live-reservation-ledger').innerHTML;
  assert.match(html, /class="reservation-table-head" aria-hidden="true"/);
  for (const name of ['名前', '枚数', '連絡先', '受付', '状態', '操作']) assert.match(html, new RegExp(`<span>${name}</span>`));
  for (const cell of ['reservation-cell-name', 'reservation-cell-seats', 'reservation-cell-contact', 'reservation-cell-received']) assert.match(html, new RegExp(cell));
  const pending = reservationRows().filter((row) => row.status === 'pending');
  const rows = reservationRows();
  assert.equal([...html.matchAll(/reservation-row-action/g)].length, pending.length, 'only pending rows have the in-row action');
  assert.match(html, new RegExp(`class="btn btn-secondary reservation-row-action" data-reservation-id="${pending[0].id}" data-reservation-status="handled">対応済みにする<`));
  assert.doesNotMatch(html, /<button[^>]*reservation-row-action[^>]*>[^<]*<button/, 'a button is never nested in a button');
  assert.ok(rows.length >= 3);
  await app.markTicketStatus(pending[0].id, 'handled');
  assert.deepEqual(calls.statuses, [{ path: `/api/admin/ticket-reservations/${encodeURIComponent(pending[0].id)}/status`, body: { status: 'handled' } }]);
});

test('T46-STYLE the 予約管理 table opens one reservation on its right on a wide screen, and replaces the list on a narrow one', async () => {
  for (const wide of [true, false]) {
    const app = makeApp({ wide });
    useRoutes(app, { rows: reservationRows() });
    await app.loadTickets();
    const html = app.elements.get('tickets-list').innerHTML;
    assert.match(html, /reservation-table-head/);
    const row = reservationRows()[0];
    click(app, { reservationOpen: row.id, reservationScope: 'cross' });
    assert.equal(app.elements.get('tickets-detail-view').hidden, false);
    assert.equal(app.elements.get('tickets-list-view').hidden, !wide, wide ? 'wide: the table stays' : 'narrow: the table is replaced');
    assert.equal(app.elements.get('live-reservations-panel').getAttribute('data-tickets-view'), 'detail');
    click(app, { reservationClose: '' });
    assert.equal(app.elements.get('tickets-detail-view').hidden, true);
    assert.equal(app.elements.get('tickets-list-view').hidden, false);
    assert.equal(app.elements.get('live-reservations-panel').getAttribute('data-tickets-view'), 'list');
  }
});

test('T46-STYLE the Ticket Page共通設定 screen: back, title and state in the Header, the seven inputs, and 保存して公開 only while unsaved (always, dimmed, when wide)', async () => {
  assert.match(adminHtml, /<header class="live-editor-header live-ticket-settings-header">\s*<button type="button" id="live-ticket-settings-close" class="live-editor-back">‹ 一覧<\/button>\s*<div class="live-editor-title-group">\s*<h3 id="live-ticket-settings-title">Ticket Page共通設定<\/h3>\s*<\/div>\s*<span id="ticket-settings-status"/);
  for (const label of ['完了文', '枚数を表示', '枚数のラベル', '備考を表示', '備考のラベル', '備考の入力例', '送信ボタンの文言']) assert.match(adminHtml, new RegExp(`>${label}<`), label);
  const panel = adminHtml.slice(adminHtml.indexOf('id="live-ticket-settings-panel"'), adminHtml.indexOf('id="live-workspace-reservations-panel"'));
  assert.doesNotMatch(panel, /空なら既定のまま|Liveページへ戻る|live-workspace-eyebrow|Quantity（枚数）|（任意）/);
  assert.doesNotMatch(adminHtml, /Liveページへ戻る|live-workspace-eyebrow/);
  assert.match(adminHtml, /class="live-switch" id="ticket-field-quantity"/);
  assert.match(adminHtml, /class="live-switch" id="ticket-field-message"/);

  const narrow = makeApp({ wide: false });
  narrow.setTicketSettingsOpen(true);
  assert.equal(narrow.elements.get('ticket-settings-actions').hidden, true);
  assert.equal(narrow.elements.get('ticket-settings-status').textContent, '保存済み');
  narrow.elements.get('ticket-complete-text').value = '変えた完了文';
  await narrow.elements.get('ticket-complete-text').oninput();
  assert.equal(narrow.elements.get('ticket-settings-actions').hidden, false);
  assert.equal(narrow.elements.get('ticket-settings-save-btn').disabled, false);

  const wide = makeApp({ wide: true });
  wide.setTicketSettingsOpen(true);
  assert.equal(wide.elements.get('ticket-settings-actions').hidden, false, 'wide: always in the heading');
  assert.equal(wide.elements.get('ticket-settings-save-btn').disabled, true, 'dimmed while nothing is unsaved');
  wide.elements.get('ticket-complete-text').value = '変えた完了文';
  await wide.elements.get('ticket-complete-text').oninput();
  assert.equal(wide.elements.get('ticket-settings-save-btn').disabled, false);
  const calls = useRoutes(wide);
  assert.equal(await wide.saveTicketSettings(), true);
  assert.equal(calls.puts.length, 1);
  assert.equal(wide.elements.get('ticket-settings-save-btn').disabled, true, 'saved: dimmed again');
  assert.equal(wide.elements.get('ticket-settings-actions').hidden, false);
  assert.equal(wide.elements.get('ticket-settings-status').textContent, '保存済み');
});

test('T46-STYLE the settings screen takes the place of the editor and marks the page, and a Live opened from the list closes it', async () => {
  const app = makeApp({ wide: true });
  useRoutes(app);
  const primary = app.elements.get('live-page-primary');
  app.setTicketSettingsOpen(true);
  assert.equal(primary.classList.contains('is-ticket-settings'), true);
  assert.equal(app.document.body.classList.contains('is-live-ticket-settings'), true);
  assert.equal(app.elements.get('live-ticket-settings-panel').hidden, false);
  await openLive(app);
  assert.equal(primary.classList.contains('is-ticket-settings'), false, 'opening a Live closes the settings');
  assert.equal(app.document.body.classList.contains('is-live-ticket-settings'), false);
  assert.equal(app.document.body.classList.contains('is-live-editing'), true);
  const css = parseRules(liveGroupOf(adminCss));
  assert.ok(rulesFor('#live-page-primary.is-ticket-settings .live-editor-pane', css).length);
  const toolbar = rulesFor('#live-page-primary.is-ticket-settings .live-page-toolbar', css);
  assert.ok(toolbar.length && toolbar.every((rule) => inContext(rule, 'max-width: 899px')), 'the list switch and the list itself stay on a wide screen');
});

// ---------------------------------------------------------------------------------------------------------
// T46-STYLE (visual repair after the Front's first capture, Packet 04). The shared groups come later in style.css, so a Live rule
// that has to beat one of their classes wins only through specificity; a bare Live class silently lost (the flyer frame, the fields).
// ---------------------------------------------------------------------------------------------------------
function specificityOf(selector) {
  const text = selector.replace(/::?[\w-]+\(([^)]*)\)/g, ' $1 ');
  const ids = (text.match(/#[\w-]+/g) || []).length;
  const classes = (text.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
  const elements = (text.replace(/[#.][\w-]+|\[[^\]]+\]|::?[\w-]+/g, ' ').match(/(?:^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return [ids, classes, elements];
}
const beats = (a, b) => {
  const x = specificityOf(a);
  const y = specificityOf(b);
  for (let index = 0; index < 3; index += 1) if (x[index] !== y[index]) return x[index] > y[index];
  return false;
};

test('T46-STYLE a Live rule that must beat a shared class is scoped (.live-workspace …) so that it wins by specificity, not by file order', () => {
  const pairs = [
    ['.live-workspace .live-flyer-row', '.image-upload-area'],
    ['.live-workspace .live-flyer-preview', '.image-preview-container'],
    ['.live-workspace .live-flyer-actions', '.image-actions'],
    ['.live-workspace .live-flyer-actions .btn-image-select', '.btn-image-select'],
    ['.live-workspace .live-flyer-clear', '.btn-image-clear'],
    ['.live-workspace .form-group label', '.form-group label'],
    ['.live-workspace .text-input', '.text-input'],
    ['.live-workspace .textarea', '.textarea'],
    ['.live-workspace .live-source-textarea', '.textarea'],
    ['.live-workspace .btn', '.btn'],
    ['.live-workspace .btn-secondary', '.btn-secondary'],
    ['.live-workspace .live-add-button', '.btn'],
  ];
  const live = parseRules(liveGroupOf(adminCss));
  const shared = parseRules(adminCss.replace(liveGroupOf(adminCss), ''));
  for (const [liveSelector, sharedSelector] of pairs) {
    assert.ok(rulesFor(liveSelector, live).length, `${liveSelector} is in the Live group`);
    assert.ok(rulesFor(sharedSelector, shared).length, `${sharedSelector} is a shared rule that comes later`);
    assert.ok(beats(liveSelector, sharedSelector), `${liveSelector} has more specificity than ${sharedSelector}`);
  }
});

test('T46-STYLE the flyer is a 96px picture with 画像を変える and 画像を外す in one row beside it, and may not stretch to the pane', () => {
  const live = parseRules(liveGroupOf(adminCss));
  const body = (selector) => rulesFor(selector, live).map((rule) => rule.body).join('\n');
  assert.match(body('.live-workspace .live-flyer-row'), /display:\s*flex/);
  assert.match(body('.live-workspace .live-flyer-row'), /border:\s*0/, 'the dashed gray frame of the shared upload area is removed');
  assert.match(body('.live-workspace .live-flyer-row'), /background:\s*transparent/);
  assert.match(body('.live-workspace .live-flyer-preview'), /width:\s*96px/);
  assert.match(body('.live-workspace .live-flyer-preview'), /flex:\s*0 0 auto/);
  assert.match(body('.live-workspace .live-flyer-actions'), /flex-flow:\s*row wrap/);
  assert.match(body('.live-workspace .live-flyer-actions'), /min-width:\s*0/, 'the action column can shrink inside the pane');
  const change = body('.live-workspace .live-flyer-actions .btn-image-select');
  assert.match(change, /white-space:\s*nowrap/);
  assert.match(change, /border:\s*1px solid var\(--ink\)/);
  assert.match(change, /min-height:\s*48px/);
  assert.ok(minHeightOf(rulesFor('.live-flyer-clear', live)) >= 44);
});

test('T46-STYLE a note or warning that is not shown keeps no height, so the fields sit 16px apart', async () => {
  const live = parseRules(liveGroupOf(adminCss));
  const error = rulesFor('.live-workspace .form-error', live).map((rule) => rule.body).join('\n');
  assert.match(error, /min-height:\s*0/, 'the shared 1.6em reservation is removed inside Live');
  const empty = rulesFor('.live-workspace .form-error:empty', live)[0];
  assert.ok(empty && selectorsOf(empty).includes('.live-workspace .form-warning:empty') && selectorsOf(empty).includes('.live-workspace .live-draft-notice:empty'));
  assert.match(empty.body, /display:\s*none/);
  const app = makeApp();
  assert.equal(app.editLive('fx-live-today', 'upcoming'), true);
  await flushAsync();
  const html = app.elements.get('live-editor-body').innerHTML;
  // :empty only applies when nothing, not even a space, is between the tags
  for (const id of ['edit-date-error', 'edit-venue-error', 'live-category-warning']) {
    assert.match(html, new RegExp(`<p id="${id}"[^>]*></p>`), `${id} is an empty element until it has something to say`);
  }
  assert.match(html, /class="live-public-fields"[^>]*>\s*<div class="form-group live-flyer"/, 'an existing Live has no draft notice before the flyer');
});

test('T46-STYLE the list switch, the settings entry and the Live switch are 44px to tap at every width (not only below 900px)', () => {
  const live = parseRules(liveGroupOf(adminCss));
  for (const selector of ['.live-list-tab', '.live-workspace-utility', '.live-workspace-tab']) {
    assert.ok(minHeightOf(rulesFor(selector, live.filter((rule) => rule.context.length === 0))) >= 44, `${selector} has the 44px at every width`);
  }
  assert.ok(minHeightOf(rulesFor('.live-workspace .live-add-button', live)) >= 46);
  assert.ok(minHeightOf(rulesFor('.live-workspace .btn-secondary', live)) >= 48);
});

test('T46-STYLE the list of a narrow screen: the Live switch in two equal halves, a full width Primary 「+ 新しいライブ」 under it, a text row for 開催予定／公演終了 (Figma 44:492)', () => {
  const live = parseRules(liveGroupOf(adminCss));
  const base = (selector) => rulesFor(selector, live.filter((rule) => rule.context.length === 0)).map((rule) => rule.body).join('\n');
  assert.match(base('.live-workspace-tabs'), /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(base('.live-workspace-bar'), /flex-direction:\s*column/);
  assert.match(base('.live-workspace .live-add-button'), /width:\s*100%/);
  assert.match(base('.live-list-tabs'), /background:\s*transparent/, 'no filled control behind 開催予定／公演終了');
  assert.match(base('.live-list-panel .items-list'), /gap:\s*0/, 'the rows are divided by their lines, not by a gap');
  assert.match(base('.live-workspace'), /display:\s*flex/);
  assert.doesNotMatch(base('.live-workspace'), /border:|background:/, 'the workspace is no longer a white card');
  assert.ok(rulesFor('#live-tab', live).some((rule) => inContext(rule, 'max-width: 899px') && /padding:\s*20px 16px/.test(rule.body)), 'a body padding of 20 / 16 (a 358px column at 390px)');
  // markup: the switch and the button share one bar; the 開催予定／公演終了 switch is the first thing of the list column
  assert.match(adminHtml, /class="live-workspace-bar">\s*<div class="live-workspace-tabs"[\s\S]*?<button type="button" class="btn btn-primary live-primary-action live-add-button" id="live-add-btn"/);
  assert.match(adminHtml, /id="live-master-pane">\s*<div class="live-page-toolbar">/);
  assert.doesNotMatch(adminHtml, /<div class="section-header">\s*<h2>Live<\/h2>\s*<button/, 'the add button left the section heading');
});

test('T46-STYLE while a Live (or the settings) is open on a narrow screen the page is full width on the gray page, and the bar with the Live switch is gone', () => {
  const live = parseRules(liveGroupOf(adminCss));
  const narrow = live.filter((rule) => inContext(rule, 'max-width: 899px'));
  assert.ok(rulesFor('body.is-live-editing #live-tab', narrow).some((rule) => /padding:\s*0/.test(rule.body)));
  assert.ok(rulesFor('body.is-live-ticket-settings #live-tab', narrow).some((rule) => /padding:\s*0/.test(rule.body)));
  assert.ok(rulesFor('body.is-live-editing', narrow).some((rule) => /background:\s*var\(--gray-100\)/.test(rule.body)));
  assert.ok(rulesFor('body.is-live-editing .live-workspace-bar', narrow).some((rule) => /display:\s*none/.test(rule.body)));
});

test('T46-STYLE on a narrow screen the reason a save failed stays in view above the bar of 保存して公開 (Figma 195:749), also when the bar is not shown', () => {
  const live = parseRules(liveGroupOf(adminCss));
  const narrow = live.filter((rule) => inContext(rule, 'max-width: 899px'));
  const reason = rulesFor('body.is-live-editing #live-editor-save-error:not(:empty)', narrow).map((rule) => rule.body).join('\n');
  assert.match(reason, /position:\s*sticky/);
  assert.match(reason, /bottom:\s*0/, 'with no bar the reason sits at the bottom edge');
  const aboveBar = narrow.find((rule) => selectorsOf(rule).some((selector) => /:has\(\.live-editor-footer:not\(\[hidden\]\)\) #live-editor-save-error/.test(selector)));
  assert.ok(aboveBar && /bottom:\s*calc\(75px \+ env\(safe-area-inset-bottom/.test(aboveBar.body), 'with the bar shown the reason clears it (the bar is 75px and the home indicator)');
  const html = adminJs.match(/function buildLiveEditorHtml[\s\S]*?\n}\n/)[0];
  assert.ok(html.indexOf('id="live-editor-save-error"') < html.indexOf('id="live-editor-footer"'), 'the reason comes before the bar in the document');
});

test('T46-STYLE wide (Figma 47:582 / 47:688): one white list card, tabs that fit their text, a gray 区分 beside its label, gray folds, a 420px post', () => {
  const live = parseRules(liveGroupOf(adminCss));
  const wide = live.filter((rule) => rule.context.length === 1 && rule.context[0] === '@media (min-width: 900px)');
  const body = (selector) => rulesFor(selector, wide).map((rule) => rule.body).join('\n');
  assert.match(body('.live-master-pane'), /background:\s*var\(--white\)/);
  assert.match(body('.live-master-pane'), /border-radius:\s*var\(--radius\)/);
  assert.match(body('.live-editor-task-tabs'), /display:\s*flex/);
  assert.match(body('.live-editor-task-tabs'), /gap:\s*32px/);
  assert.match(body('.live-category-field .live-segment'), /background:\s*var\(--gray-100\)/);
  assert.match(body('.live-category-field'), /display:\s*flex/);
  assert.match(body('.live-workspace .live-collapse'), /background:\s*var\(--gray-100\)/);
  assert.match(body('.live-public-fields > .live-delete-link'), /grid-column:\s*2/, '「このライブを削除」 is at the right end of the 区分 row');
  assert.match(body('.live-source-actions'), /flex-direction:\s*row/, '下書きを作る and 手入力で作る sit side by side (Figma 47:873)');
  assert.match(body('.live-workspace-bar'), /justify-content:\s*space-between/);
  assert.match(body('.live-workspace .live-add-button'), /min-width:\s*153px/);
  assert.match(body('.live-row.is-selected .arrow'), /display:\s*none/, 'the open Live has no › (Figma 47:607)');
  assert.match(body('#x-intent-btn, #x-post-copy-btn, #x-link-copy-btn') || rulesFor('#x-intent-btn', wide).map((rule) => rule.body).join('\n'), /flex:\s*0 0 auto/, 'the three buttons of the announcement fit their text on a wide screen');
  // the selected row of the list is a fill (accent-soft), on every width
  assert.match(rulesFor('.live-row.live-edit-trigger.is-selected', live).map((rule) => rule.body).join('\n'), /background:\s*var\(--accent-soft\)/);
});

test('T46-STYLE the tab under the open tab and the 公演の中の切り替え are color/text, not the accent', () => {
  const live = parseRules(liveGroupOf(adminCss));
  assert.match(rulesFor('.live-editor-task-tab.is-active', live).map((rule) => rule.body).join('\n'), /border-bottom-color:\s*var\(--ink\)/);
});

test('T46-STYLE the confirmation surface is a fixed layer over the page, 360px at most, with its two buttons side by side', () => {
  const rules = parseRules(liveGroupOf(adminCss));
  const overlay = rulesFor('.live-dialog-overlay', rules).find((rule) => rule.context.length === 0);
  assert.match(overlay.body, /position:\s*fixed/);
  assert.match(overlay.body, /inset:\s*0/);
  assert.ok(Number(overlay.body.match(/z-index:\s*(\d+)/)[1]) > 201, 'above the header, the tabs and the generic modal (201)');
  assert.ok(rulesFor('.live-dialog-overlay::before', rules).some((rule) => /opacity:\s*0\.5/.test(rule.body) && /var\(--ink\)/.test(rule.body)), 'the page behind is dimmed with a token color');
  assert.match(rulesFor('.live-dialog', rules).find((rule) => rule.context.length === 0).body, /max-width:\s*360px/);
  const actions = rulesFor('.live-dialog-actions', rules).find((rule) => rule.context.length === 0).body;
  assert.match(actions, /flex-flow:\s*row wrap/);
  assert.match(actions, /justify-content:\s*flex-end/);
  assert.ok(minHeightOf(rulesFor('.live-dialog-actions .btn', rules)) >= 44);
});

test('T46-STYLE while the confirmation surface is open the page behind is inert, and it is restored when the surface closes', async () => {
  const app = makeApp({ api: true });
  useRoutes(app);
  await openLive(app);
  await typeInto(app, 'edit-venue', 'テスト会場N');
  const moving = app.addLive();
  await flushAsync();
  const inertOf = (id) => app.elements.get(id).hasAttribute('inert');
  for (const id of ['live-tab', 'news-tab', 'site-tab', 'saveBtn']) assert.equal(inertOf(id), true, `${id} cannot be reached while the surface is open`);
  assert.equal(inertOf('live-dialog-overlay'), false);
  assert.equal(inertOf('toast'), false);
  assert.equal(app.elements.get('live-dialog-action-discard').classList.contains('btn-secondary'), true);
  assert.equal(app.elements.get('live-dialog-action-stay').classList.contains('btn-primary'), true, 'the safe choice is the Primary one');
  assert.equal(app.document.activeElement, app.elements.get('live-dialog-action-stay'));
  await answerLiveDialog(app, 'stay');
  assert.equal(await moving, false);
  for (const id of ['live-tab', 'news-tab', 'site-tab', 'saveBtn']) assert.equal(inertOf(id), false, `${id} is back`);

  const deleting = app.deleteLiveFromWorkspace();
  await flushAsync();
  assert.equal(inertOf('live-tab'), true);
  assert.equal(app.elements.get('live-dialog-action-cancel').classList.contains('btn-secondary'), true);
  assert.equal(app.elements.get('live-dialog-action-delete').classList.contains('btn-primary'), true);
  await answerLiveDialog(app, 'cancel');
  await deleting;
  assert.equal(inertOf('live-tab'), false);
});

// ---------------------------------------------------------------------------------------------------------
// T46-MODE
// ---------------------------------------------------------------------------------------------------------
const GLOBAL_TABS = ['global-tab-site', 'global-tab-news'];

test('T46-MODE the header 保存 is hidden on the Live tab only while the API is connected and nothing else is unsaved', async () => {
  const app = makeApp({ api: true });
  const save = app.elements.get('saveBtn');
  app.syncGlobalSaveButton();
  assert.equal(save.classList.contains('is-live-concealed'), true, 'API Mode, Live tab, nothing waiting');
  assert.equal(app.getActiveGlobalTab(), 'live');

  await app.elements.get('global-tab-news').dispatch('click');
  assert.equal(app.getActiveGlobalTab(), 'news');
  assert.equal(save.classList.contains('is-live-concealed'), false, 'other tabs keep it');
  await app.elements.get('global-tab-live').dispatch('click');
  assert.equal(save.classList.contains('is-live-concealed'), true);

  app.markChanged();
  assert.equal(save.classList.contains('is-live-concealed'), false, 'something unsaved from another tab: shown on the Live tab too');
  assert.match(save.textContent, /保存 \*/);
  const calls = useRoutes(app);
  await app.invokeSaveData();
  assert.equal(calls.puts.length, 1);
  assert.equal(save.classList.contains('is-live-concealed'), true, 'saved: hidden again on the Live tab');

  for (const id of GLOBAL_TABS) await app.elements.get(id).dispatch('click');
  assert.equal(save.classList.contains('is-live-concealed'), false);
  assert.match(adminHtml, /<button class="save-btn" id="saveBtn" data-admin-mutation onclick="saveData\(\)">保存<\/button>/, 'the button and its handler are unchanged');
});

test('T46-MODE Local Mode and read-only keep the header button on the Live tab', () => {
  const local = makeApp({ api: false });
  local.renderModeBadge();
  assert.equal(local.elements.get('saveBtn').classList.contains('is-live-concealed'), false);
  assert.equal(local.elements.get('saveBtn').textContent, 'JSONを書き出す');

  const readOnly = makeApp({ api: true, readOnly: true });
  assert.equal(readOnly.elements.get('saveBtn').classList.contains('is-live-concealed'), false);
  assert.equal(readOnly.elements.get('saveBtn').textContent, '読み取り専用');
  assert.equal(readOnly.elements.get('saveBtn').disabled, true);
});

test('T46-MODE API connection failure is read-only: every new operation is off, nothing is sent, the list can still be read', async () => {
  for (const wide of [false, true]) {
    const app = makeApp({ api: true, readOnly: true, wide });
    const calls = useRoutes(app, { rows: reservationRows() });
    await app.loadReservationSummary();
    assert.equal(calls.summary, 0, 'no summary is read');
    assert.match(app.elements.get('live-upcoming-list').innerHTML, /2099/, 'the list is still shown');
    assert.equal(app.elements.get('live-add-btn').disabled, true);
    app.setTicketSettingsOpen(true);
    assert.equal(app.elements.get('ticket-settings-save-btn').disabled, true);
    assert.equal(await app.saveTicketSettings(), false);
    app.setTicketSettingsOpen(false);
    await openLive(app);
    for (const id of ['live-editor-save-btn', 'live-editor-delete-btn', 'live-category-upcoming', 'live-category-past', 'live-source-parse-btn', 'live-manual-entry-btn',
      'edit-date', 'edit-venue', 'edit-title', 'edit-openTime', 'edit-startTime', 'edit-ticket', 'edit-notes', 'edit-performers', 'edit-ticketUrl', 'edit-reservationClosed', 'edit-link', 'edit-description', 'edit-xComment', 'edit-image-file']) {
      const element = app.elements.get(id);
      if (!element) continue;
      assert.equal(element.disabled, true, `${id} is off in read-only`);
    }
    assert.equal(await app.saveLiveWorkspace(), false);
    assert.equal(await app.deleteLiveFromWorkspace(), false);
    assert.equal(calls.puts.length, 0);
    assert.equal(calls.statuses.length, 0);
  }
});

test('T46-MODE read-only: the reservation operations (row actions, status buttons, the form) cannot change anything', async () => {
  const app = makeApp({ api: true, wide: true });
  const calls = useRoutes(app, { rows: reservationRows() });
  await openLive(app);
  app.setLiveEditorTask('reservation');
  await flushAsync();
  app.setApiFallbackReadOnly(true);
  const pending = reservationRows().find((row) => row.status === 'pending');
  assert.equal(await app.markTicketStatus(pending.id, 'handled'), false);
  assert.equal(calls.statuses.length, 0);
  assert.equal(app.elements.get('live-reservation-add-btn').disabled, true);
  assert.equal(app.elements.get('manual-reservation-submit').disabled, true);
});

test('T46-MODE Local Mode: save is 反映 to memory and 書き出し待ち, settings save is the same, and the API-only parts stay off', async () => {
  const app = makeApp({ api: false, wide: true });
  const calls = useRoutes(app);
  await app.loadReservationSummary();
  assert.equal(calls.summary, 0);
  await openLive(app);
  await typeInto(app, 'edit-venue', 'テスト会場L');
  assert.equal(await app.saveLiveWorkspace(), true);
  assert.equal(calls.puts.length, 0, 'Local Mode sends nothing');
  assert.equal(app.elements.get('live-editor-save-status').textContent, 'JSON書き出し待ち');
  assert.equal(app.getHasChanges(), true);
  assert.equal(app.elements.get('saveBtn').classList.contains('is-live-concealed'), false, 'the export button is available');
  app.setTicketSettingsOpen(true);
  app.elements.get('ticket-complete-text').value = 'ローカルの完了文';
  await app.elements.get('ticket-complete-text').oninput();
  assert.equal(await app.saveTicketSettings(), true);
  assert.equal(calls.puts.length, 0);
  assert.equal(app.elements.get('ticket-settings-status').textContent, 'JSON書き出し待ち');
  assert.equal(app.getSiteData().ticket.completeText, 'ローカルの完了文');
  assert.equal(app.elements.get('live-summary-note').textContent, '', 'no guide line in Local Mode');
});

test('T46-MODE leaving an unsaved Live through the global tab still asks first (the header button being hidden changes nothing)', async () => {
  const app = makeApp({ api: true });
  app.syncGlobalSaveButton();
  useRoutes(app);
  await openLive(app);
  await typeInto(app, 'edit-venue', 'テスト会場M');
  const clicked = app.elements.get('global-tab-news').dispatch('click');
  await answerLiveDialog(app, 'stay');
  await clicked;
  assert.equal(app.getActiveGlobalTab(), 'live');
  assert.equal(app.elements.get('saveBtn').classList.contains('is-live-concealed'), true);
});

// ---------------------------------------------------------------------------------------------------------
// T46-COMPAT
// ---------------------------------------------------------------------------------------------------------
test('T46-COMPAT the public Live script has the bytes of the base commit', () => {
  assert.equal(readFileSync(join(repoRoot, 'assets/js/live-operations.js'), 'utf8'), gitShow('assets/js/live-operations.js'));
});

test('T46-COMPAT the functions #46 promised not to touch have the bodies they had at the base commit', () => {
  const baseJs = gitShow('admin/app.js');
  const bodyOf = (source, name) => {
    const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    assert.ok(start >= 0, `${name} exists`);
    const open = source.indexOf('{', start);
    let depth = 0;
    let cursor = open;
    do {
      if (source[cursor] === '{') depth += 1;
      else if (source[cursor] === '}') depth -= 1;
      cursor += 1;
    } while (depth > 0);
    return source.slice(start, cursor);
  };
  for (const name of ['saveLiveItem', 'readLiveFromModal', 'getLiveShareUrl', 'updateXPreviewInModal', 'calculateActiveReservationTotals', 'normalizeLiveSourceIntakePayload']) {
    assert.equal(bodyOf(adminJs, name), bodyOf(baseJs, name), name);
  }
  const constant = (source, name) => source.match(new RegExp(`const ${name}\\s*=[\\s\\S]*?;\\n`))?.[0];
  for (const name of ['LIVE_SOURCE_INTAKE_FIELD_IDS', 'LIVE_SOURCE_INTAKE_TEXT_FIELD_IDS', 'LIVE_SOURCE_INTAKE_API_FIELDS']) {
    if (constant(baseJs, name)) assert.equal(constant(adminJs, name), constant(baseJs, name), name);
  }
});

// The other tabs, rendered by the base app and by this one from the same data, print the same HTML and save the same body.
const baseSource = gitShow('admin/app.js');
const OTHER_TAB_DATA = {
  site: { featuredReleaseId: '', heroImage: 'assets/images/fixture-hero.jpg', links: { bandcamp: 'https://example.test/b', youtube: '', x: '', instagram: '', note: '' }, footerText: 'フッター' },
  news: [{ id: 'fx-news-1', date: '2026-11-01', title: 'テストのお知らせ', body: '本文', link: 'https://example.test/n' }],
  youtube: { channelUrl: 'https://example.test/yt', musicVideos: [{ id: 'fx-mv', title: 'テスト映像', youtubeId: 'abcdefghijk' }], liveMovies: [], demos: [] },
  discography: { digital: [{ id: 'fx-disc-1', title: 'テスト作品', releaseDate: '2026.01.01', description: '説明', image: '', link: '', category: 'single' }], demo: [] },
  profile: { image: 'assets/images/fixture-profile.jpg', text: 'プロフィール', links: [{ id: 'fx-link-1', name: 'テスト', url: 'https://example.test/p' }] },
  contact: { introText: '導入', formAction: 'https://example.test/c' },
};

function loadWith(source, wide = false) {
  const app = loadAdminApp({ wide, adminSource: source });
  app.setApiMode(true);
  const data = structuredClone(fixture.data);
  Object.assign(data, structuredClone(OTHER_TAB_DATA));
  app.setSiteData(app.normalizeSiteData(data));
  app.setSavedBaseline(plain(app.getSiteData()));
  return app;
}

test('T46-COMPAT News, YouTube, Disco, Profile and Site print the same markup and form values as at the base commit', { skip: LATER_ISSUE_TABS.length > 0 }, () => {
  const baseApp = loadWith(baseSource);
  const app = loadWith(adminJs);
  for (const target of [baseApp, app]) {
    target.renderSiteSettings();
    target.renderYouTube();
    target.renderDiscography();
    target.renderProfile();
  }
  baseApp.renderAll();
  app.renderAll();
  for (const id of ['news-list', 'youtube-musicVideos-list', 'youtube-liveMovies-list', 'youtube-demos-list', 'disc-digital-list', 'disc-demo-list', 'profile-links-list', 'profile-image-form', 'site-hero-image-form']) {
    assert.equal(app.elements.get(id).innerHTML, baseApp.elements.get(id).innerHTML, id);
  }
  for (const id of ['site-link-bandcamp', 'site-footer-text', 'contact-intro-text', 'contact-form-action', 'youtube-channel-url', 'profile-text']) {
    assert.equal(app.elements.get(id).value, baseApp.elements.get(id).value, id);
  }
});

test('T46-COMPAT the generic modals open with the same fields, and the picture wording of the other tabs is the base wording', { skip: LATER_ISSUE_TABS.length > 0 }, () => {
  const baseApp = loadWith(baseSource);
  const app = loadWith(adminJs);
  for (const open of [(a) => a.addNews(), (a) => a.editNews('fx-news-1'), (a) => a.addYouTubeVideo('musicVideos'), (a) => a.editYouTubeVideo('fx-mv', 'musicVideos'),
    (a) => a.addDiscography(), (a) => a.editDiscography('fx-disc-1', 'digital'), (a) => a.addProfileLink()]) {
    open(baseApp);
    open(app);
    assert.equal(app.elements.get('modal-body').innerHTML, baseApp.elements.get('modal-body').innerHTML);
    assert.equal(app.elements.get('modal-title').textContent, baseApp.elements.get('modal-title').textContent);
    app.closeModal();
    baseApp.closeModal();
  }
});

test('T46-COMPAT the header 保存 (saveData) sends the whole data, including a change made in another tab, exactly as at the base commit', { skip: LATER_ISSUE_TABS.length > 0 }, async () => {
  const bodies = [];
  for (const source of [baseSource, adminJs]) {
    const app = loadWith(source);
    const puts = [];
    app.useAdminFetch(async (path, options = {}) => {
      if (path === '/api/admin/site-data' && options.method === 'PUT') { puts.push(JSON.parse(options.body)); return jsonResponse({ ok: true }); }
      return jsonResponse({ reservations: [], summaries: [] });
    });
    app.getSiteData().news[0].title = '他のタブで直したお知らせ';
    app.markChanged();
    assert.equal(await app.invokeSaveData(), true);
    assert.equal(puts.length, 1);
    bodies.push(puts[0]);
  }
  assert.deepEqual(bodies[1], bodies[0], 'the same PUT body as at the base commit');
  assert.equal(bodies[1].news[0].title, '他のタブで直したお知らせ');
});

test('T46-COMPAT the shared picture form keeps the other tabs wording; only the Live flyer has the new wording', () => {
  const html = (app) => app.elements.get('profile-image-form').innerHTML;
  const baseApp = loadWith(baseSource);
  const app = loadWith(adminJs);
  baseApp.renderProfile();
  app.renderProfile();
  assert.equal(html(app), html(baseApp));
  assert.match(html(app), /画像を選択/);
  assert.doesNotMatch(html(app), /画像を選ぶ|画像を変える|画像を外す/);
});

// ---------------------------------------------------------------------------------------------------------
// T46-VERSION: the build marker, the ?v= of the three assets, and the operator docs agree
// ---------------------------------------------------------------------------------------------------------
const adminReadme = readFileSync(join(repoRoot, 'admin/README.md'), 'utf8');
const workerReadme = readFileSync(join(repoRoot, 'cloudflare/worker/README.md'), 'utf8');

test('T46-VERSION ADMIN_BUILD_ID and the ?v= of style.css, app.js and music-data.js are the build of this Issue and agree with each other and the README', () => {
  const build = adminHtml.match(/window\.ADMIN_BUILD_ID\s*=\s*'(\d{4})-(\d{2})-(\d{2})T(\d{4})Z';/);
  assert.ok(build, 'ADMIN_BUILD_ID is a date and a time (UTC)');
  const versions = {
    style: adminHtml.match(/style\.css\?v=([\w-]+)/)?.[1],
    app: adminHtml.match(/app\.js\?v=([\w-]+)/)?.[1],
    music: adminHtml.match(/music-data\.js\?v=([\w-]+)/)?.[1],
  };
  assert.deepEqual(versions, { style: '20261120-46', app: '20261120-46', music: '20261120-46' });
  assert.equal(`${build[1]}${build[2]}${build[3]}`, versions.app.slice(0, 8), 'the build marker is dated the same day as ?v=');
  assert.ok(adminHtml.indexOf('music-data.js?v=20261120-46') < adminHtml.indexOf('app.js?v=20261120-46'), 'the helper loads before the app');
  assert.match(adminReadme, new RegExp(build[0].match(/'([^']+)'/)[1]));
  assert.match(adminReadme, /20261120-46/);
  // the three files the docs name as unchanged keep their previous versions
  assert.match(adminHtml, /live-operations\.js\?v=20260804-2/);
  assert.match(adminHtml, /config\.js\?v=20260216-2001/);
});

test('T46-VERSION the operator docs describe the new flow, the commands that exist, and the order: Worker first, then merge', () => {
  for (const phrase of ['保存して公開', '予約 N枚', '未対応 N', '下書きを作る', 'Xで告知する', '予約管理', 'Ticket Page共通設定', '対象だけを重ねた', '手元での確認', '画面の確認（撮影）', '反映順序とrollback', 'Workerを先にdeploy']) {
    assert.ok(adminReadme.includes(phrase.replace('対象だけを重ねた', '対象だけを重ねたもの')), `admin/README.md says: ${phrase}`);
  }
  for (const script of ['fake_admin_server.py', 'capture-admin-live.py']) {
    assert.match(adminReadme, new RegExp(`test/support/admin-preview/${script}`));
    assert.ok(readFileSync(join(repoRoot, 'test/support/admin-preview', script), 'utf8').length > 1000, `${script} exists`);
  }
  assert.match(adminReadme, /本物の合言葉を入力しない/);
  for (const phrase of ['GET /api/admin/ticket-reservation-summary', 'summarizeTicketReservationRows', '`liveId`・`seats`・`records`・`pending`', '先にWorkerをdeploy', '追加だけ', 'rollback']) {
    assert.ok(workerReadme.includes(phrase), `cloudflare/worker/README.md says: ${phrase}`);
  }
  assert.doesNotMatch(adminReadme + workerReadme, /fixture-admin-token|sk-[A-Za-z0-9]{10,}/);
});

test('T46-VERSION the Worker has the summary route and exports its rule (that the diff is additions only is checked at deploy time: git diff against the base)', () => {
  const worker = readFileSync(join(repoRoot, 'cloudflare/worker/src/worker.js'), 'utf8');
  assert.match(worker, /\/api\/admin\/ticket-reservation-summary/);
  assert.match(worker, /export[\s\S]{0,400}summarizeTicketReservationRows/);
  assert.match(workerReadme, /git diff|追加だけ/);
});

// ---------------------------------------------------------------------------------------------------------
// Packet 05: repairs after the second capture (Front 2). Each test names the defect it stops from coming back.
// ---------------------------------------------------------------------------------------------------------
const WIDE = '@media (min-width: 900px)';
const MID = '@media (min-width: 900px) and (max-width: 1179px)';
const pxOf = (body, property) => {
  const match = body.match(new RegExp(`(?:^|[;\\s])${property}:\\s*(-?\\d+)px`));
  return match ? Number(match[1]) : null;
};

test('T46-OVERLAP at 900px and above the 保存して公開 box is lifted into the heading and keeps no bottom, no safe-area padding and no hit area when hidden (it covered 削除 and 取り置きを追加 at 1440)', () => {
  const rules = parseRules(liveGroupOf(adminCss));
  const wide = rules.filter((rule) => rule.context.length === 1 && rule.context[0] === WIDE);
  const applies = (rule) => rule.context.length === 0 || rule.context.every((entry) => entry.includes('min-width: 900px'));
  // Generic: a box the wide arrangement makes `position: absolute` with a `top` must not keep a `bottom` that a rule valid at that width gave it
  // (the base bar rule says `bottom: 0`: with `top` set the box then reached from the heading to the bottom of the pane).
  const lifted = wide.filter((rule) => /position:\s*absolute/.test(rule.body) && /(?:^|[;\s])top:\s*\d+px/.test(rule.body));
  assert.ok(lifted.some((rule) => selectorsOf(rule).includes('.live-editor-footer')), 'the footer is lifted into the heading');
  assert.ok(lifted.some((rule) => selectorsOf(rule).includes('.ticket-settings-actions')), 'so is the settings button');
  for (const rule of lifted) {
    for (const selector of selectorsOf(rule)) {
      const keepsBottom = rules.some((other) => selectorsOf(other).includes(selector) && applies(other) && /(?:^|[;\s])bottom:\s*(?!auto)[^;]+/.test(other.body) && !/position:\s*absolute/.test(other.body));
      if (!keepsBottom) continue;
      const reset = wide.some((other) => (selectorsOf(other).includes(selector) || selectorsOf(other).includes(`.live-workspace ${selector}`)) && /(?:^|[;\s])bottom:\s*auto/.test(other.body));
      assert.ok(reset, `${selector} resets bottom at 900px and above`);
    }
  }
  const scoped = (selector) => rulesFor(`.live-workspace ${selector}`, wide).map((rule) => rule.body).join('\n');
  for (const selector of ['.live-editor-footer', '.ticket-settings-actions']) {
    assert.match(scoped(selector), /bottom:\s*auto/, `${selector}: bottom auto, scoped by .live-workspace so it beats the safe-area rule further down`);
    assert.match(scoped(selector), /padding:\s*0/, `${selector}: no padding left from the safe-area rule`);
    assert.ok(rulesFor(`${selector}[hidden]`, wide).some((rule) => /display:\s*none/.test(rule.body)), `${selector}[hidden] stays hidden at 900px and above (display: block must not win over hidden)`);
  }
  // The narrow bar is unchanged: sticky at the bottom.
  const narrow = rulesFor('.live-editor-footer', rules).find((rule) => rule.context.length === 0);
  assert.match(narrow.body, /position:\s*sticky/);
  assert.match(narrow.body, /bottom:\s*0/);
});

test('T46-OVERLAP the footer has no box over the editor at 900px and above, in the app: shown only on the editing screen, as the button of the heading', async () => {
  for (const wide of [true, false]) {
    const app = makeApp({ wide });
    await openLive(app);
    const footer = app.elements.get('live-editor-footer');
    assert.equal(footer.hidden, !wide, wide ? 'wide: the heading button is on the editing screen (dimmed while nothing is unsaved)' : 'narrow: the bar is hidden until something is unsaved');
    assert.equal(app.elements.get('live-editor-save-btn').disabled, wide, 'wide: not pressable while nothing is unsaved');
  }
  const html = adminJs.slice(adminJs.indexOf('<footer class="live-editor-footer"'), adminJs.indexOf('</footer>', adminJs.indexOf('<footer class="live-editor-footer"')));
  assert.match(html, /id="live-editor-footer" hidden>/, 'the footer starts hidden');
  assert.equal([...html.matchAll(/<button/g)].length, 1, 'the footer holds only the save button');
});

test('T46-MANUAL the 取り置き form checks its input itself (novalidate), so an empty name gets the Japanese line instead of a browser bubble that stops the submit', async () => {
  assert.match(adminJs, /<form id="manual-reservation-form" class="manual-reservation-form" novalidate hidden>/);
  const app = makeApp({ api: true, wide: true });
  useRoutes(app, { rows: reservationRows() });
  await openLive(app);
  app.setLiveEditorTask('reservation');
  await flushAsync();
  app.setLiveReservationView('add');
  assert.equal(app.elements.get('manual-reservation-form').hidden, false);
  // `required`, min and max stay on the inputs (assistive technology); novalidate only keeps the browser from swallowing the submit event
  assert.match(adminJs, /id="manual-reservation-name" class="text-input" required maxlength="200"/);
  assert.match(adminJs, /id="manual-reservation-quantity" class="text-input" value="1" min="1" max="10" step="1" required/);
  app.elements.get('manual-reservation-name').value = '   ';
  assert.equal(await app.submitManualReservation(), false);
  assert.equal(app.elements.get('manual-reservation-error').textContent, 'お名前と1〜10の枚数を確認してください。');
});

test('T46-OVERLAP a failure line above the tabs is not covered: the tabs are pulled up by 24px, so the line keeps 40px under it (Figma: the reason sits under the heading at 900px and above)', () => {
  const rules = parseRules(liveGroupOf(adminCss));
  const wide = rules.filter((rule) => rule.context.length === 1 && rule.context[0] === WIDE);
  const error = rulesFor('#live-editor-save-error', wide).map((rule) => rule.body).join('\n');
  const tabs = rulesFor('.live-editor-task-tabs', wide).map((rule) => rule.body).join('\n');
  const pull = Math.abs(Number((tabs.match(/margin:\s*(-\d+)px/) || [])[1]));
  assert.ok(pull >= 20, 'the tabs are pulled over the body padding');
  assert.ok(pxOf(error, 'margin-bottom') >= pull + 16, `the line keeps at least ${pull + 16}px under it`);
  assert.match(error, /order:\s*-1/);
});

test('T46-STYLE at 900px and above the draft notice and the saved post are boxed in gray-100 (white on the white editor hid the card), and the post buttons fit their text', () => {
  const rules = parseRules(liveGroupOf(adminCss));
  const wide = rules.filter((rule) => rule.context.length === 1 && rule.context[0] === WIDE);
  for (const selector of ['.live-workspace .live-draft-notice', '.live-workspace .live-postsave-preview']) {
    assert.ok(rulesFor(selector, wide).some((rule) => /background:\s*var\(--gray-100\)/.test(rule.body)), selector);
  }
  assert.ok(rulesFor('.live-workspace .live-postsave', wide).some((rule) => /align-items:\s*flex-start/.test(rule.body)));
  assert.ok(rulesFor('.live-workspace .live-postsave-preview', wide).some((rule) => /align-self:\s*stretch/.test(rule.body)));
});

test('T46-STYLE the reservation rows of a Live: 6 columns from 1180px; between 900px and 1179px the two-line rows stay (the table squeezed names and contacts to nothing at 900px); 予約管理 keeps its table', () => {
  const rules = parseRules(liveGroupOf(adminCss));
  const mid = rules.filter((rule) => rule.context.length === 1 && rule.context[0] === MID);
  const text = (selector) => rulesFor(selector, mid).map((rule) => rule.body).join('\n');
  assert.match(text('#live-editor-panel-reservation .reservation-cell'), /display:\s*none/);
  assert.match(text('#live-editor-panel-reservation .reservation-table-head'), /display:\s*none/);
  assert.match(text('#live-editor-panel-reservation .reservation-row'), /display:\s*flex/);
  assert.match(text('#live-editor-panel-reservation .reservation-row-main'), /display:\s*flex/);
  assert.match(text('#live-editor-panel-reservation .reservation-row-item'), /grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  // not for the 予約管理 table, which has the whole width: no unscoped hide in that range
  for (const selector of ['.reservation-cell', '.reservation-table-head', '.reservation-row', '.reservation-row-item']) assert.equal(rulesFor(selector, mid).length, 0, `${selector} is not changed for 予約管理 between 900px and 1179px`);
  // from 1180px the six columns are the ones of the wide rule, with the in-row action centred in its cell
  const wide = rules.filter((rule) => rule.context.length === 1 && rule.context[0] === WIDE);
  assert.ok(rulesFor('.reservation-row', wide).some((rule) => /grid-template-columns:\s*minmax\(0, 1\.2fr\) 56px minmax\(0, 1\.4fr\) 96px 88px/.test(rule.body)));
  assert.ok(rulesFor('.reservation-row-action', wide).some((rule) => /display:\s*inline-flex/.test(rule.body) && /align-items:\s*center/.test(rule.body)), 'the action text is centred in its row (it sat at the top of the cell)');
});

test('T46-STYLE wide reservations: the filter chips that are not chosen are gray-100 pills (Figma 47:757), the 取り置き form keeps its top padding, 予約管理 draws one frame for the open reservation and CSVで書き出す is the outlined button beside the filters', () => {
  const rules = parseRules(liveGroupOf(adminCss));
  const wide = rules.filter((rule) => rule.context.length === 1 && rule.context[0] === WIDE);
  assert.ok(rulesFor('.live-workspace .reservation-chip:not(.is-selected)', wide).some((rule) => /background:\s*var\(--gray-100\)/.test(rule.body)));
  assert.ok(rulesFor('.reservation-panel .manual-reservation-form', wide).some((rule) => /padding-top:\s*16px/.test(rule.body)));
  assert.ok(rulesFor('.tickets-detail-view .live-reservation-detail', wide).some((rule) => /padding:\s*0/.test(rule.body) && /border:\s*0/.test(rule.body)));
  const csv = rulesFor('.live-workspace #tickets-csv-btn', wide).map((rule) => rule.body).join('\n');
  assert.match(csv, /position:\s*absolute/);
  assert.match(csv, /border:\s*1px solid var\(--ink\)/);
  assert.ok(minHeightOf(rulesFor('.live-workspace #tickets-csv-btn', wide)) >= 44);
  assert.ok(rulesFor('.live-workspace .tickets-list-view', wide).some((rule) => /position:\s*relative/.test(rule.body)));
  assert.ok(rulesFor('.live-workspace .live-reservations-panel[data-tickets-view="detail"] #tickets-csv-btn', wide).some((rule) => /position:\s*static/.test(rule.body)), 'while a reservation is open the button does not sit over the narrower filters');
});
