import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// Issue #43 keeps the #44 frame (header, nav, footer) and every other page byte for byte.
const BASE = 'ba124011ce5e0ae56ddb1c6ac47d1783600687b4';
const BASE_SITE_CONTENT_SHA = 'f4136e012985a5fd156a001cdbfd6d5c28b9d69738d4b45d869c0696e2fdd7dd';
const read = (path) => readFileSync(path, 'utf8');
const before = (path) => execFileSync('git', ['show', `${BASE}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// Issue #45 (Profile and Contact) was approved separately and sits on top of #43 in the integrated branch.
// Its files and its one named block in each shared file are not counted as #43 changes; nothing else is excused.
const ISSUE45_PAGES = ['profile/index.html', 'contact/index.html'];
const ISSUE45_DISPATCH = ['    if (document.getElementById("profile-content")) { wireProfile(); return bootProfile(); }\n', '    if (document.getElementById("contact-content")) return bootContact();\n'];
const withoutIssue45Js = (text) => {
  const start = text.indexOf('  // Issue #45: Profile.\n');
  if (start < 0) return text;
  const end = text.indexOf('  async function boot() {\n');
  assert.ok(end > start, 'the Issue #45 block sits before boot()');
  let rest = text.slice(0, start) + text.slice(end);
  for (const line of ISSUE45_DISPATCH) { assert.equal(rest.split(line).length, 2, line); rest = rest.replace(line, ''); }
  return rest;
};
const sha = (text) => createHash('sha256').update(text).digest('hex');
const part = (html, tag) => html.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`))[0];
const scripts = (html) => [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
const names = (html) => scripts(html).map((src) => src.split('?')[0].split('/').pop());

const pages = {
  'live/index.html': { body: 'site-live', up: '../', scripts: ['site-config.js', 'live-operations.js', 'live-order.js', 'reservation-cta.js', 'live-pages.js', 'script.js'], root: 'live-content' },
  'live/detail/index.html': { body: 'site-live', up: '../../', scripts: ['site-config.js', 'live-operations.js', 'live-order.js', 'reservation-cta.js', 'live-pages.js', 'script.js'], root: 'live-detail-content' },
  'ticket/index.html': { body: 'site-ticket', up: '../', scripts: ['site-config.js', 'live-operations.js', 'live-order.js', 'reservation-cta.js', 'ticket-receipt.js', 'ticket.js', 'script.js'], root: 'ticket-content' },
  'ticket/complete/index.html': { body: 'site-ticket', up: '../../', scripts: ['site-config.js', 'live-operations.js', 'music-data.js', 'home-player.js', 'ticket-receipt.js', 'ticket-complete.js', 'script.js'], root: 'ticket-complete-content' },
};

for (const [path, spec] of Object.entries(pages)) {
  test(`T43-SHELL ${path}: header, nav and footer are the #44 bytes; only body class, stylesheet link, main and scripts changed`, () => {
    const now = read(path);
    const old = before(path);
    for (const tag of ['header', 'nav', 'footer']) assert.equal(part(now, tag), part(old, tag), tag);
    assert.match(now, new RegExp(`<body class="${spec.body}">`));
    assert.deepEqual(names(now), spec.scripts);
    assert.doesNotMatch(now, /site-content\.js/);
    const link = `  <link rel="stylesheet" href="${spec.up}assets/css/live-ticket.css?v=20261119-43">\n`;
    const style = `  <link rel="stylesheet" href="${spec.up}assets/css/style.css?v=20261118-44">\n`;
    assert.ok(now.includes(style + link), 'live-ticket.css follows style.css');
    assert.equal(now.match(/<head>[\s\S]*?<\/head>/)[0].replace(link, ''), old.match(/<head>[\s\S]*?<\/head>/)[0], 'the head is otherwise unchanged');
    assert.ok(scripts(now).some((src) => src.endsWith('script.js?v=20261118-44')));
    assert.ok(scripts(now).some((src) => src.endsWith('live-operations.js?v=20260804-2')));
    assert.match(now, new RegExp(`id="${spec.root}"[^>]*data-site-root="${spec.up.replace(/\./g, '\\.')}"`));
    for (const src of scripts(now)) assert.ok(existsSync(join(path, '..', src.split('?')[0])), src);
    assert.equal((now.match(/<nav\b/g) || []).length, 1);
    assert.doesNotMatch(part(now, 'nav'), />\s*Ticket\s*</i);
  });
}

test('T43-SHELL new files carry the #43 cache version and nothing else changes the shared versions', () => {
  for (const path of Object.keys(pages)) {
    const html = read(path);
    for (const file of ['live-order', 'reservation-cta', 'live-pages', 'ticket-receipt', 'ticket', 'ticket-complete']) {
      if (html.includes(`/${file}.js`)) assert.match(html, new RegExp(`/${file}\\.js\\?v=20261119-43"`), `${path} ${file}`);
    }
    assert.match(html, /css\/style\.css\?v=20261118-44/);
    assert.match(html, /js\/script\.js\?v=20261118-44/);
  }
});

test('T43-COMPAT Home, Music, Profile, Contact, the two old pages and index.html are byte-identical to the base', () => {
  for (const path of ['index.html', 'music/index.html', 'discography/index.html', 'youtube/index.html']) {
    assert.equal(read(path), before(path), path);
    assert.equal(part(read(path), 'main'), part(before(path), 'main'), `${path} main`);
    assert.doesNotMatch(read(path), /live-ticket\.css/, path);
  }
  // Profile and Contact belong to #45: only their main may differ; the frame and head stay the #44 bytes.
  for (const path of ISSUE45_PAGES) {
    for (const tag of ['header', 'nav', 'footer']) assert.equal(part(read(path), tag), part(before(path), tag), `${path} ${tag}`);
    assert.equal(read(path).match(/<head>[\s\S]*?<\/head>/)[0], before(path).match(/<head>[\s\S]*?<\/head>/)[0], `${path} head`);
    assert.doesNotMatch(read(path), /live-ticket\.css/, path);
  }
});

test('T43-COMPAT shared code, tokens, design rules, admin and the Worker are untouched', () => {
  for (const path of ['assets/js/live-operations.js', 'assets/js/music-data.js', 'assets/js/home-player.js', 'assets/js/script.js', 'assets/js/site-config.js', 'assets/css/1212-music.tokens.css', 'DESIGN_RULES.md']) {
    assert.equal(read(path), before(path), path);
  }
  // style.css: the base bytes stay as they were; the only addition is the Issue #45 block appended at the end.
  const baseCss = before('assets/css/style.css');
  const nowCss = read('assets/css/style.css');
  assert.ok(nowCss.startsWith(baseCss), 'style.css keeps every base byte');
  const addedCss = nowCss.slice(baseCss.length);
  assert.ok(addedCss === '' || addedCss.trimStart().startsWith('/* Issue #45'), 'anything added to style.css is the Issue #45 block');
  assert.doesNotMatch(nowCss, /live-ticket|\.live-ticket-/, 'no #43 selector in style.css');
  // Issue #46 changes admin/ and the Worker after #43. What #43 must hold is that they did not change between its base
  // and #46's base commit (commit vs commit); data/ and scripts/ are still compared with the working tree.
  const BASE46 = 'e191e53ada480014e03ad2fa23835f6178ce371a';
  const changedByIssue43 = execFileSync('git', ['diff', '--name-only', BASE, BASE46, '--', 'admin', 'cloudflare'], { encoding: 'utf8' }).trim();
  assert.equal(changedByIssue43, '', 'admin/ and cloudflare/ have no change between the #43 base and the #46 base');
  const unchanged = execFileSync('git', ['diff', '--name-only', BASE, '--', 'data', 'scripts'], { encoding: 'utf8' }).trim();
  assert.equal(unchanged, '', 'data/ and scripts/ have no change');
});

test('T43-COMPAT the Worker still answers a repeat send with the exact text the Ticket page checks', () => {
  const worker = read('cloudflare/worker/src/worker.js');
  assert.ok(worker.includes('new PublicReservationError("reservation already submitted recently")'));
  assert.ok(read('assets/js/ticket.js').includes("'reservation already submitted recently'"));
});

test('T43-COMPAT site-content.js differs from the base in exactly one line (the Home invalid-booking label), apart from the Issue #45 block', () => {
  const now = withoutIssue45Js(read('assets/js/site-content.js'));
  const old = before('assets/js/site-content.js');
  assert.equal(sha(old), BASE_SITE_CONTENT_SHA, 'the base file is the one the plan recorded');
  const a = old.split('\n');
  const b = now.split('\n');
  assert.equal(a.length, b.length);
  const changed = a.map((line, index) => (line === b[index] ? -1 : index)).filter((index) => index >= 0);
  assert.equal(changed.length, 1);
  const line = changed[0];
  assert.equal(b[line], a[line].replace('"予約URLが無効です"', '"予約先を確認中"'));
  assert.equal((now.match(/予約URLが無効です/g) || []).length, 0);
  assert.equal((now.match(/予約先を確認中/g) || []).length, 1);
  const start = now.indexOf('function renderHomeLive');
  const end = now.indexOf('function renderHomeNews');
  assert.ok(now.indexOf('予約先を確認中') > start && now.indexOf('予約先を確認中') < end, 'inside renderHomeLive');
  assert.equal(now.replace('"予約先を確認中"', '"予約URLが無効です"'), old, 'no other byte changed');
  assert.match(now, /<span class="home-reservation-status">/);
});

test('T43-COMPAT the shared query strings of the other pages did not move', () => {
  for (const path of ['index.html', 'music/index.html', 'profile/index.html', 'contact/index.html']) {
    const html = read(path);
    assert.match(html, /css\/style\.css\?v=20261118-44/, path);
    assert.match(html, /js\/script\.js\?v=20261118-44/, path);
    if (html.includes('site-content.js')) assert.match(html, /js\/site-content\.js\?v=20261118-44/, path);
  }
});

test('T43-COMPAT the only files changed by #43 are the planned ones (no stray page, asset or script)', () => {
  const changed = execFileSync('git', ['diff', '--name-only', BASE], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const allowed = [
    /^assets\/js\/(live-order|reservation-cta|live-pages|ticket-receipt|ticket|ticket-complete|site-content)\.js$/,
    /^assets\/css\/(live-ticket|style)\.css$/,
    /^assets\/js\/contact\.js$/,
    /^(profile|contact)\/index\.html$/,
    /^test\/(contact-form|profile-rendering|profile-contact-shell)\.test\.mjs$/,
    /^test\/profile-contact-dom\.mjs$/,
    /^test\/fixtures\/profile-contact-states\.json$/,
    /^(live\/index|live\/detail\/index|ticket\/index|ticket\/complete\/index)\.html$/,
    /^test\/(live-order|reservation-cta|live-pages|ticket-flow|ticket-receipt|ticket-complete|live-ticket-shell|home-rendering|public-ticket-routing|site-shell|public-music-data-compatibility)\.test\.mjs$/,
    /^test\/support\/dom-harness\.mjs$/,
    /^test\/fixtures\/live-ticket-states\.json$/,
    /^docs\/specs\/current\/(public-site-ui|live-operations-admin-ui|README)\.md$/,
    /^aidlc-docs\//,
    /^docs\/records\/aidlc-cycles\/2026-11-19_issue-43_live-ticket\//,
    /^docs\/records\/aidlc-cycles\/2026-11-19_issue-45_profile-contact\//,
    // Issue #46 (admin live operations): the planned files only.
    /^admin\/(index\.html|app\.js|style\.css|README\.md)$/,
    /^cloudflare\/worker\/(src\/worker\.js|README\.md|test\/ticket-reservation-summary\.test\.js)$/,
    /^test\/support\/admin-app-harness\.mjs$/,
    /^test\/support\/admin-preview\/(capture-admin-live|fake_admin_api|fake_admin_server)\.py$/,
    /^test\/admin-live-[\w-]+\.test\.mjs$/,
    /^test\/(admin-live-operations|admin-image-form)\.test\.mjs$/,
    /^test\/fixtures\/admin-live-states\.json$/,
    /^test\/(live-ticket-shell|profile-contact-shell|site-shell)\.test\.mjs$/,
    /^docs\/records\/aidlc-cycles\/2026-11-20_issue-46_admin-live-ops\//,
    // Issue #47 (admin occasional updates): the planned files only. admin/, docs/specs/current/, aidlc-docs/, the harness and
    // fake_admin_*.py are already allowed above. The cycle record is written when the cycle is closed, through the close
    // command's temporary paths.
    /^docs\/records\/aidlc-cycles\/2026-11-21_issue-47_admin-occasional\//,
    /^docs\/records\/aidlc-cycles\/\.aidlc-(stage|idle|recovery)-[^/]+\//,
    /^\.aidlc-(idle|recovery)-[^/]+\//,
    /^test\/admin-occasional-[\w-]+\.test\.mjs$/,
    /^test\/fixtures\/admin-occasional-states\.json$/,
    /^test\/support\/admin-preview\/capture-admin-occasional\.py$/,
  ];
  for (const path of [...changed, ...untracked]) assert.ok(allowed.some((pattern) => pattern.test(path)), `unexpected change: ${path}`);
});

// ---- style --------------------------------------------------------------------------------
const css = read('assets/css/live-ticket.css');
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
function rules(source) {
  const out = [];
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf('{', index);
    if (open < 0) break;
    const selector = source.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (depth > 0 && cursor < source.length) {
      if (source[cursor] === '{') depth += 1;
      if (source[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    const body = source.slice(open + 1, cursor - 1);
    if (selector.startsWith('@media')) out.push(...rules(body).map((rule) => ({ ...rule, media: selector })));
    else out.push({ selector, body: body.trim(), media: '' });
    index = cursor;
  }
  return out;
}
const all = rules(bare);
const rule = (selector, media = '') => all.find((r) => r.selector === selector && (media ? r.media.includes(media) : !r.media));

test('T43-STYLE every selector is under body.site-live or body.site-ticket', () => {
  assert.ok(all.length > 80);
  for (const { selector } of all) {
    for (const part of selector.split(',').map((item) => item.trim())) assert.match(part, /^body\.site-(live|ticket)\b/, part);
  }
});

test('T43-STYLE no red anywhere: no accent variable, no brand red, no hex literals', () => {
  assert.doesNotMatch(bare, /--accent|accent|#BF554D/i);
  assert.doesNotMatch(bare, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(bare, /\brgba?\(\s*191\s*,\s*85\s*,\s*77/i);
  assert.doesNotMatch(bare, /(?:^|[;{\s])color:\s*(?:red|crimson|firebrick|tomato)/i);
});

test('T43-STYLE nothing is cut off: no line clamp or ellipsis; long words wrap', () => {
  assert.doesNotMatch(bare, /line-clamp|text-overflow:\s*ellipsis/);
  for (const selector of ['body.site-live .live-card-venue', 'body.site-live .live-past-title', 'body.site-live .live-info-list li', 'body.site-ticket .ticket-complete-fields', 'body.site-ticket .ticket-complete-number']) assert.match(rule(selector).body, /overflow-wrap:\s*anywhere/, selector);
  for (const selector of ['body.site-live .live-info-list li', 'body.site-live .live-detail-description', 'body.site-ticket .ticket-complete-fields', 'body.site-live .live-card-details']) assert.match(rule(selector).body, /white-space:\s*pre-wrap/, selector);
});

test('T43-STYLE hidden elements stay hidden even for .site-button; focus is dark; selection and scrollbars are not red', () => {
  assert.match(rule('body.site-live [hidden], body.site-ticket [hidden]').body, /display:\s*none\s*!important/);
  assert.match(rule('body.site-live :focus-visible, body.site-ticket :focus-visible').body, /outline:\s*2px solid var\(--ink\)/);
});

test('T43-STYLE the player is 480 wide on the desktop (at most the card), 16:9, never under 200px tall; full width on the phone', () => {
  const player = rule('body.site-ticket .ticket-listen .home-player');
  assert.match(player.body, /width:\s*min\(480px,\s*100%\)/);
  assert.match(player.body, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(player.body, /min-height:\s*200px/);
  assert.match(rule('body.site-ticket .ticket-listen .home-player', '820px').body, /width:\s*100%/);
  assert.match(rule('body.site-ticket .ticket-listen .home-player').body, /grid-column:\s*1\s*\/\s*-1/);
});

test('T43-STYLE layout numbers from the master: 980 frames, 420+56+504 detail, 560+56+364 ticket, one column under 820px', () => {
  assert.match(rule('body.site-live .live-container, body.site-ticket .live-container').body, /width:\s*min\(calc\(100% - 32px\),\s*var\(--max-width\)\)/);
  assert.match(rule('body.site-live .live-detail-main').body, /grid-template-columns:\s*420px minmax\(0, 504px\)/);
  assert.match(rule('body.site-live .live-detail-main').body, /column-gap:\s*56px/);
  // 1440 keeps 560 + 56 + 364; the columns may shrink so 821-1011px never pushes the summary past the frame
  assert.match(rule('body.site-ticket .ticket-layout').body, /grid-template-columns:\s*minmax\(0, 560px\) minmax\(0, 364px\)/);
  assert.match(rule('body.site-ticket .ticket-layout').body, /column-gap:\s*56px/);
  assert.match(rule('body.site-ticket .ticket-layout', '820px').body, /grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(rule('body.site-live .live-card').body, /grid-template-columns:\s*136px/);
  assert.match(rule('body.site-live .live-card', '820px').body, /grid-template-columns:\s*96px/);
  assert.match(rule('body.site-live .live-card-flyer').body, /width:\s*136px;\s*height:\s*192px/);
  assert.match(rule('body.site-live .live-card-flyer', '820px').body, /width:\s*96px;\s*height:\s*136px/);
  assert.match(rule('body.site-live .live-past-date').body, /flex:\s*0 0 160px/);
  assert.match(rule('body.site-live .live-past-venue').body, /flex:\s*0 0 240px/);
  assert.match(rule('body.site-live .live-detail-flyer').body, /width:\s*420px/);
  assert.match(rule('body.site-ticket .ticket-complete-figure').body, /width:\s*96px;\s*height:\s*136px/);
  assert.match(rule('body.site-ticket .ticket-field--quantity').body, /width:\s*160px/);
  assert.match(rule('body.site-ticket .ticket-field--quantity', '820px').body, /width:\s*120px/);
  assert.match(rule('body.site-ticket .ticket-field input, body.site-ticket .ticket-field select, body.site-ticket .ticket-field textarea').body, /min-height:\s*52px[^}]*border:\s*1px solid var\(--color-gray-300\)[^}]*border-radius:\s*var\(--radius-button\)/);
  assert.match(rule('body.site-ticket .ticket-actions .site-button', '820px').body, /width:\s*100%/);
});

test('T43-STYLE RV43-01 the Ticket columns can shrink: no fixed-width pair, and the contents may shrink with them', () => {
  const columns = rule('body.site-ticket .ticket-layout').body.match(/grid-template-columns:\s*([^;]+);/)[1];
  assert.doesNotMatch(columns, /(^|\s)\d+px(\s|$)/, 'every column track must be minmax(0, …), not a bare px width');
  assert.deepEqual(columns.match(/minmax\(0, \d+px\)/g), ['minmax(0, 560px)', 'minmax(0, 364px)']);
  assert.match(rule('body.site-ticket .ticket-form').body, /min-width:\s*0/);
  assert.match(rule('body.site-ticket .ticket-summary').body, /min-width:\s*0/);
  assert.match(rule('body.site-ticket #ticket-summary-body').body, /min-width:\s*0/);
  assert.match(rule('body.site-ticket .ticket-field').body, /min-width:\s*0/);
  assert.match(rule('body.site-ticket .ticket-field input, body.site-ticket .ticket-field select, body.site-ticket .ticket-field textarea').body, /(^|;)\s*width:\s*100%/);
  assert.match(rule('body.site-ticket .ticket-summary-img').body, /width:\s*100%/);
  assert.match(rule('body.site-ticket .ticket-summary-date').body, /overflow-wrap:\s*anywhere/);
  assert.match(rule('body.site-ticket .ticket-summary-details').body, /overflow-wrap:\s*anywhere/);
  // the single-column switch stays at 820px
  assert.ok(all.some((r) => r.selector === 'body.site-ticket .ticket-layout' && /max-width:\s*820px/.test(r.media)));
  assert.equal(all.filter((r) => r.selector === 'body.site-ticket .ticket-layout' && r.media).length, 1);
});

test('T43-STYLE RV43-02 on the phone a Live card without a flyer keeps its date on one line (no break inside the digits); desktop and detail faces are untouched', () => {
  const phone = rule('body.site-live .live-card-flyer .live-flyer-fallback', '820px');
  assert.ok(phone, 'a phone-only rule for the list card face');
  assert.match(phone.body, /overflow-wrap:\s*normal/);
  assert.match(phone.body, /font:\s*500 12px\/18px/);
  assert.match(phone.body, /letter-spacing:\s*0/);
  assert.match(phone.body, /padding:\s*var\(--space-4\)/);
  assert.doesNotMatch(phone.body, /anywhere|break-all|break-word/);
  // the base face (also used by the PC card and the detail flyer) is not changed
  const base = rule('body.site-live .live-flyer-fallback').body;
  assert.match(base, /padding:\s*var\(--space-8\)/);
  assert.match(base, /font:\s*500 14px\/22px/);
  assert.match(base, /overflow-wrap:\s*anywhere/);
  assert.equal(all.filter((r) => /live-flyer-fallback/.test(r.selector) && r.media).length, 1, 'only the list card face has a phone rule');
  assert.match(rule('body.site-live .live-detail-flyer .live-flyer-fallback').body, /aspect-ratio:\s*420 \/ 593/);
});

test('T43-STYLE RV43-03 on the phone the Live detail children fill the column width; the desktop grid keeps align-items: start', () => {
  assert.match(rule('body.site-live .live-detail-main', '820px').body, /align-items:\s*stretch/);
  assert.match(rule('body.site-live .live-detail-main', '820px').body, /flex-direction:\s*column/);
  assert.match(rule('body.site-live .live-detail-main').body, /align-items:\s*start/);
  // the button row stays a left-aligned wrapping row, so stretching does not widen the buttons
  const actions = rule('body.site-live .live-detail-actions').body;
  assert.match(actions, /display:\s*flex/);
  assert.match(actions, /flex-wrap:\s*wrap/);
  assert.doesNotMatch(actions, /justify-content:\s*(space-between|center|space-around|space-evenly)/);
  assert.doesNotMatch(rule('body.site-live .live-detail-actions', '820px')?.body || '', /flex:\s*1|width:\s*100%/);
});

test('T43-STYLE the Ticket summary stays in view while typing (sticky below the header) and moves above the form on the phone', () => {
  const summary = rule('body.site-ticket .ticket-summary');
  assert.match(summary.body, /position:\s*sticky/);
  assert.match(summary.body, /top:\s*calc\(79px \+ var\(--space-24\)\)/);
  assert.match(summary.body, /background:\s*var\(--paper-deep\)/);
  const phone = rule('body.site-ticket .ticket-summary', '820px');
  assert.match(phone.body, /order:\s*-1/);
  assert.match(phone.body, /position:\s*static/);
});

test('T43-STYLE cannot-click reservations and sending look the same: opacity .4, no pointer; errors and notices use ink, not red', () => {
  assert.match(rule('body.site-live .site-button.is-inactive, body.site-ticket .site-button.is-inactive').body, /opacity:\s*\.4/);
  assert.match(rule('body.site-live .site-button.is-inactive:hover, body.site-ticket .site-button.is-inactive:hover').body, /opacity:\s*\.4/);
  assert.match(rule('body.site-ticket .ticket-error').body, /color:\s*var\(--ink\)/);
  assert.match(rule('body.site-ticket .ticket-field input[aria-invalid="true"]').body, /border-color:\s*var\(--ink\)/);
  assert.match(rule('body.site-live .live-notice, body.site-ticket .live-notice').body, /background:\s*var\(--paper-deep\)/);
});

test('T43-STYLE the stylesheet is loaded by the four pages only, and uses tokens for colour and space', () => {
  for (const path of ['index.html', 'music/index.html', 'profile/index.html', 'contact/index.html', 'discography/index.html', 'youtube/index.html']) assert.doesNotMatch(read(path), /live-ticket\.css/);
  for (const path of Object.keys(pages)) assert.match(read(path), /live-ticket\.css\?v=20261119-43/);
  const used = new Set([...bare.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  const tokens = read('assets/css/1212-music.tokens.css') + read('assets/css/style.css');
  for (const name of used) assert.ok(tokens.includes(`${name}:`), `undefined variable ${name}`);
  assert.ok(statSync('assets/css/live-ticket.css').size > 0);
  assert.equal(readdirSync('assets/css').includes('live-ticket.css'), true);
});
