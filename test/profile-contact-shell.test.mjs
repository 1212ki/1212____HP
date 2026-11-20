import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import test from 'node:test';
import {BASE, atBase, read} from './profile-contact-dom.mjs';

const allPages = ['index.html', 'live/index.html', 'live/detail/index.html', 'ticket/index.html', 'ticket/complete/index.html', 'discography/index.html', 'youtube/index.html', 'profile/index.html', 'contact/index.html', 'music/index.html'];
// #45 lands on the branch that already has #43 (Live and Ticket). Outside #45's own scope the reference is that
// parent commit; files neither Issue owns are byte-identical at BASE and at PARENT.
const PARENT = '01c8b20534e5321dd9788cc7123592d4755639e8';
const atParent = path => execFileSync('git', ['show', `${PARENT}:${path}`], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
const own = ['profile/index.html', 'contact/index.html'];
const tag = (html, name) => html.match(new RegExp(`<${name}\\b[\\s\\S]*?</${name}>`))[0];
const scripts = html => [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]);

// ---- T45-SHELL -------------------------------------------------------------------------------------
for (const path of own) {
  test(`T45-SHELL ${path}: header, nav, logo, footer and head are the base bytes; five nav items; script order`, () => {
    const html = read(path), old = atBase(path);
    for (const name of ['header', 'nav', 'footer']) assert.equal(tag(html, name), tag(old, name), name);
    assert.equal(tag(html, 'h1'), tag(old, 'h1'), 'logo');
    assert.equal(html.match(/<head>[\s\S]*?<\/head>/)[0], old.match(/<head>[\s\S]*?<\/head>/)[0], 'head');
    const nav = [...tag(html, 'nav').matchAll(/<a href="([^"]*)"[^>]*>([^<]+)<\/a>/g)];
    assert.deepEqual(nav.map(m => m[2]), ['Home', 'Live', 'Music', 'Profile', 'Contact']);
    assert.deepEqual(nav.map(m => m[1]), ['../', '../live/', '../music/', '../profile/', '../contact/']);
    const expected = path === 'contact/index.html'
      ? ['site-config.js', 'site-content.js?v=20261118-44', 'contact.js?v=20261119-45', 'script.js?v=20261118-44']
      : ['site-config.js', 'site-content.js?v=20261118-44', 'script.js?v=20261118-44'];
    assert.deepEqual(scripts(html).map(src => src.replace('../assets/js/', '')), expected);
    for (const src of scripts(html)) assert.ok(existsSync(new URL(src.split('?')[0], 'file://' + process.cwd() + '/' + path)), src);
  });
}

// ---- T45-COMPAT ------------------------------------------------------------------------------------
for (const path of allPages.filter(p => !own.includes(p))) {
  test(`T45-COMPAT main of ${path} is the base bytes (the #43 parent for Live and Ticket)`, () => {
    assert.equal(tag(read(path), 'main'), tag(atParent(path), 'main'));
  });
}
test('T45-COMPAT every page keeps the shared cache query; only contact.js gets the new one', () => {
  for (const path of allPages) {
    const html = read(path), old = atParent(path);
    const queries = h => [...h.matchAll(/(style\.css|script\.js|site-content\.js)\?v=([\w-]+)/g)].map(m => m[1] + '?v=' + m[2]);
    assert.deepEqual(queries(html), queries(old), path);
    for (const q of queries(html)) assert.match(q, /\?v=20261118-44$/);
  }
  assert.ok(!/contact\.js\?v=/.test(atBase('contact/index.html')));
  assert.match(read('contact/index.html'), /contact\.js\?v=20261119-45/);
});
test('T45-COMPAT untouched files keep the base bytes (shared scripts, tokens, rules, admin, data, Worker)', () => {
  for (const path of ['assets/js/live-operations.js', 'assets/js/music-data.js', 'assets/js/home-player.js', 'assets/js/script.js', 'assets/js/site-config.js', 'assets/css/1212-music.tokens.css', 'DESIGN_RULES.md']) {
    assert.equal(read(path), atBase(path), path);
  }
  // Issue #46 changes admin/ and the Worker after #45. What #45 must hold is that they did not change between its base
  // and #46's base commit (commit vs commit); data/ is still compared with the working tree.
  const BASE46 = 'e191e53ada480014e03ad2fa23835f6178ce371a';
  const changedByIssue45 = execFileSync('git', ['diff', '--name-only', BASE, BASE46, '--', 'admin', 'cloudflare'], {encoding: 'utf8'}).trim();
  assert.equal(changedByIssue45, '', 'admin/ and cloudflare/ are untouched between the #45 base and the #46 base');
  const changed = execFileSync('git', ['diff', '--name-only', BASE, '--', 'data'], {encoding: 'utf8'}).trim();
  assert.equal(changed, '', 'data/ is untouched');
});
test('T45-COMPAT site-content.js differs from the #43 parent only by the Issue #45 block and two dispatch lines', () => {
  const now = read('assets/js/site-content.js'), old = atParent('assets/js/site-content.js');
  const start = now.indexOf('  // Issue #45: Profile.\n');
  const end = now.indexOf('  async function boot() {\n');
  assert.ok(start > 0 && end > start);
  assert.equal(now.indexOf('// Issue #45', end), -1);
  const lines = ['    if (document.getElementById("profile-content")) { wireProfile(); return bootProfile(); }\n', '    if (document.getElementById("contact-content")) return bootContact();\n'];
  let rest = now.slice(0, start) + now.slice(end);
  for (const line of lines) { assert.equal(rest.split(line).length, 2, line); rest = rest.replace(line, ''); }
  assert.equal(rest, old);
  assert.ok(now.indexOf(lines[0]) > end && now.indexOf(lines[1]) > now.indexOf(lines[0]), 'branches sit inside boot() after the Music branch');
});
test('T45-COMPAT legacy Profile and Contact renderers and selectors are kept for other pages', () => {
  const js = read('assets/js/site-content.js'), css = read('assets/css/style.css');
  assert.match(js, /function renderProfile\(profile, siteLinks, version\)/);
  assert.match(js, /function renderContact\(contact\)/);
  for (const name of ['.artist-photo', '.profile-links', '.application-link', '.ticket-modal-overlay', '.ticket-modal ']) assert.ok(css.includes(name), name);
  assert.match(css, /\nform label \{/);
});

// ---- T45-STYLE -------------------------------------------------------------------------------------
const css = read('assets/css/style.css'), baseCss = atBase('assets/css/style.css');
const added = css.slice(baseCss.length);
const parseRules = text => (text.replace(/\/\*[^]*?\*\//g, '').match(/[^{}]+\{[^{}]*\}/g) || []).map(rule => {
  const [, selector, body] = rule.match(/^([^{}]+)\{([^{}]*)\}$/);
  const declarations = body.split(';').map(d => d.trim()).filter(Boolean).map(d => { const i = d.indexOf(':'); return {prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim()}; });
  return {selector: selector.trim(), declarations};
});
const mediaAt = added.indexOf('@media (max-width: 820px)');
const rules = parseRules(added);                                   // every rule, wide and narrow
const wideRules = parseRules(mediaAt < 0 ? added : added.slice(0, mediaAt));
const find = selector => wideRules.filter(rule => rule.selector === selector);
const decl = (selector, prop) => find(selector).flatMap(rule => rule.declarations).filter(d => d.prop === prop).map(d => d.value).at(-1);

test('T45-STYLE base CSS bytes stay first; one Issue #45 block follows; old selectors remain', () => {
  assert.equal(css.slice(0, baseCss.length), baseCss);
  assert.ok(added.trimStart().startsWith('/* Issue #45: Profile and Contact. */'));
  assert.equal((added.match(/\/\* Issue #45:/g) || []).length, 1);
  assert.ok(rules.length > 30);
});
test('T45-STYLE every added selector is scoped to body.site-profile or body.site-contact', () => {
  for (const rule of rules) for (const part of rule.selector.split(',')) assert.match(part.trim(), /^body\.site-(?:profile|contact)\b/, part);
});
test('T45-STYLE no literal colors and no red: --accent, --accent-soft and the primary tokens are not used in the added rules', () => {
  assert.doesNotMatch(added, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
  assert.doesNotMatch(added, /--accent|--color-primary|--color-accent|--shadow/);
});
test('T45-STYLE pixel values: master dimensions and type only; 56 and 6 appear once each in their own rule and property', () => {
  const allowed = new Set([1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 80, 14, 20, 22, 26, 28, 30, 42, 52, 136, 364, 560, 820]);
  const exceptions = {56: ['body.site-profile .profile-intro', 'gap'], 6: ['body.site-contact .contact-field', 'gap']};
  const seen = {56: 0, 6: 0};
  for (const rule of rules) for (const d of rule.declarations) for (const m of d.value.matchAll(/(-?\d*\.?\d+)px/g)) {
    const n = Math.abs(Number(m[1]));
    if (exceptions[n]) { assert.deepEqual([rule.selector, d.prop], exceptions[n], `${n}px only in ${exceptions[n].join(' ')}`); seen[n] += 1; continue; }
    assert.ok(allowed.has(n), `${rule.selector} { ${d.prop}: ${d.value} }`);
  }
  assert.ok(added.includes('(max-width: 820px)'));
  assert.deepEqual(seen, {56: 1, 6: 1});
});
test('T45-STYLE master layout: Profile columns, photo ratio, name and text type, links, entry panel', () => {
  assert.equal(decl('body.site-profile .profile-container', 'width'), 'min(calc(100% - 32px), var(--max-width))');
  assert.equal(decl('body.site-profile .profile-container', 'padding'), 'var(--space-64) 0');
  assert.equal(decl('body.site-profile .profile-container', 'gap'), 'var(--space-32)');
  assert.equal(decl('body.site-profile .profile-intro', 'display'), 'flex');
  assert.equal(decl('body.site-profile .profile-intro', 'gap'), '56px');
  assert.equal(decl('body.site-profile .profile-photo', 'flex'), '0 0 364px');
  assert.equal(decl('body.site-profile .profile-photo', 'aspect-ratio'), '4 / 5');
  assert.equal(decl('body.site-profile .profile-photo', 'background'), 'var(--paper-deep)');
  assert.equal(decl('body.site-profile .profile-photo', 'border-radius'), 'var(--radius-card)');
  assert.equal(decl('body.site-profile .profile-photo img', 'object-fit'), 'cover');
  assert.equal(decl('body.site-profile .profile-body', 'flex'), '1 1 0');
  assert.equal(decl('body.site-profile .profile-body', 'gap'), 'var(--space-24)');
  assert.equal(decl('body.site-profile .profile-name', 'gap'), 'var(--space-4)');
  assert.match(decl('body.site-profile .profile-name h2', 'font'), /^500 28px\/42px /);
  assert.match(decl('body.site-profile .profile-name p', 'font'), /^400 14px\/22px /);
  assert.equal(decl('body.site-profile .profile-name p', 'color'), 'var(--ink-muted)');
  assert.match(decl('body.site-profile .profile-text', 'font'), /^400 16px\/26px /);
  assert.equal(decl('body.site-profile .profile-text', 'white-space'), 'pre-wrap');
  assert.equal(decl('body.site-profile .profile-text', 'overflow-wrap'), 'anywhere');
  assert.equal(decl('body.site-profile .profile-link-list', 'gap'), 'var(--space-8)');
  assert.equal(decl('body.site-profile .profile-link-list', 'flex-wrap'), 'wrap');
  assert.equal(decl('body.site-profile .profile-contact-entry', 'background'), 'var(--paper-deep)');
  assert.equal(decl('body.site-profile .profile-contact-entry', 'padding'), 'var(--space-24)');
  assert.equal(decl('body.site-profile .profile-contact-entry', 'gap'), 'var(--space-12)');
  assert.equal(decl('body.site-profile .profile-contact-entry', 'align-items'), 'flex-start');
  assert.equal(decl('body.site-profile .profile-state:empty', 'display'), 'none');
});
test('T45-STYLE narrow layout (820px and below): one column, square photo, tighter spacing, full width submit', () => {
  const at = added.indexOf('@media (max-width: 820px)');
  assert.ok(at > 0);
  const narrow = added.slice(at);
  assert.match(narrow, /body\.site-profile \.profile-container \{[^}]*padding: var\(--space-32\) 0/);
  assert.match(narrow, /body\.site-profile \.profile-intro \{[^}]*flex-direction: column;[^}]*gap: var\(--space-24\)/);
  assert.match(narrow, /body\.site-profile \.profile-photo \{[^}]*width: 100%;[^}]*aspect-ratio: 1\b/);
  assert.match(narrow, /body\.site-contact \.contact-container \{[^}]*padding: var\(--space-32\) 0/);
  assert.match(narrow, /body\.site-contact \.contact-panel \{[^}]*max-width: none/);
  assert.match(narrow, /body\.site-contact \.contact-form \.site-button \{[^}]*width: 100%/);
});
test('T45-STYLE Contact form: 560 wide, gap 20, field gap 6, 52 and 136 high controls, gray-300 border, muted placeholder', () => {
  assert.equal(decl('body.site-contact .contact-panel', 'max-width'), '560px');
  assert.equal(decl('body.site-contact .contact-container', 'gap'), 'var(--space-24)');
  assert.equal(decl('body.site-contact .contact-form', 'gap'), 'var(--space-20)');
  assert.equal(decl('body.site-contact .contact-field', 'gap'), '6px');
  assert.match(decl('body.site-contact .contact-field label', 'font'), /^500 14px\/22px /);
  const control = 'body.site-contact .contact-field input, body.site-contact .contact-field textarea';
  assert.equal(decl(control, 'min-height'), '52px');
  assert.equal(decl(control, 'padding'), 'var(--space-12) var(--space-16)');
  assert.equal(decl(control, 'border'), '1px solid var(--color-gray-300)');
  assert.equal(decl(control, 'border-radius'), 'var(--radius-button)');
  assert.equal(decl(control, 'background'), 'var(--paper)');
  assert.match(decl(control, 'font'), /^400 16px\/26px /);
  assert.equal(decl('body.site-contact .contact-field textarea', 'min-height'), '136px');
  assert.equal(decl('body.site-contact .contact-field textarea', 'resize'), 'vertical');
  assert.equal(decl('body.site-contact .contact-field input::placeholder, body.site-contact .contact-field textarea::placeholder', 'color'), 'var(--ink-muted)');
  assert.equal(decl('body.site-contact .contact-error', 'color'), 'var(--ink)');
  assert.equal(decl('body.site-contact .contact-failure', 'background'), 'var(--paper-deep)');
  assert.equal(decl('body.site-contact .contact-failure', 'color'), 'var(--ink)');
  assert.equal(decl('body.site-contact .contact-failure', 'border-radius'), 'var(--radius-button)');
  assert.match(decl('body.site-contact .contact-done-title', 'font'), /^500 20px\/30px /);
  assert.equal(decl('body.site-contact .contact-sent-row', 'white-space'), 'pre-wrap');
});
test('T45-STYLE the global form rules are cancelled inside Contact only; focus and hover never use red; disabled keeps the shared 0.4', () => {
  const control = 'body.site-contact .contact-field input, body.site-contact .contact-field textarea';
  const focus = 'body.site-contact .contact-field input:focus, body.site-contact .contact-field textarea:focus';
  assert.equal(decl(focus, 'border-color'), 'var(--ink)');
  assert.equal(decl(focus, 'box-shadow'), 'none');
  assert.equal(decl(focus, 'outline'), '2px solid var(--ink)');
  assert.equal(decl(control, 'transition'), 'none');
  assert.equal(decl('body.site-contact .site-button:hover', 'transform'), 'none');
  assert.equal(decl('body.site-contact .site-button:hover', 'box-shadow'), 'none');
  assert.equal(decl('body.site-contact .contact-form', 'margin-top'), '0');
  assert.equal(decl('body.site-profile :focus-visible, body.site-contact :focus-visible', 'outline-color'), 'var(--ink)');
  assert.ok(!rules.some(rule => /:disabled/.test(rule.selector)), 'disabled look comes from the shared .site-button:disabled');
  for (const rule of rules) if (/:hover|:focus/.test(rule.selector)) for (const d of rule.declarations) assert.doesNotMatch(d.value, /accent|rgba?\(/, rule.selector);
  assert.match(css.slice(0, baseCss.length), /\.site-button:disabled \{ opacity: \.4; cursor: wait; \}/);
});
test('T45-STYLE invalid border is ink only for aria-invalid; every other ink border belongs to :focus', () => {
  const invalid = 'body.site-contact .contact-field input[aria-invalid="true"], body.site-contact .contact-field textarea[aria-invalid="true"]';
  assert.equal(decl(invalid, 'border-color'), 'var(--ink)');
  assert.equal(find(invalid).flatMap(r => r.declarations).length, 1);
  for (const rule of rules) if (rule.declarations.some(d => /^border(-color)?$/.test(d.prop) && /var\(--ink\)/.test(d.value))) assert.match(rule.selector, /aria-invalid="true"|:focus/, rule.selector);
});
test('T45-STYLE [hidden] stays hidden, decoration and selection are monochrome, screen-reader text is clipped', () => {
  assert.equal(decl('body.site-profile [hidden], body.site-contact [hidden]', 'display'), 'none !important');
  assert.equal(decl('body.site-profile::before, body.site-contact::before', 'display'), 'none');
  assert.match(decl('body.site-contact .contact-sr', 'position'), /absolute/);
  assert.match(decl('body.site-contact .contact-sr', 'clip'), /rect\(0, 0, 0, 0\)/);
});
