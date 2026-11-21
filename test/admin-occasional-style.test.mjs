// Issue #47 stage 6: the CSS at every width, the shared CSS left alone, and Live left alone.
//   T47-STYLE        the layout switches at 899px / 900px and nowhere else (checked at 360, 390, 821, 899, 900, 1011 and 1440), the upper band is
//                    46px / 49px up to 899px and 62px / 53px from 900px, a fixed 保存して公開 has no ancestor that would stop it from being fixed,
//                    everything pressable is 44px tall, only the four groups #47 owns differ from the base commit
//   T47-STYLE-SPEC   every rule of "Occasional Updates" is an occ- rule; a rule that restyles a shared class is under .occ-tab and out-weighs
//                    the shared rules it overlaps (by specificity, not by being written later)
//   T47-LIVE-COMPAT  the Live tab draws the same markup, saves, deletes and saves its Ticket Page settings with the same PUT body as the base
//                    commit, and the Live script, the Worker, the public pages and the data are the bytes of the base commit
// The CSS tests read admin/style.css and admin/index.html as text (what a browser draws is the capture's job, run by Front).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  ADMIN_APP_BASE_COMMIT_47,
  answerLiveDialog,
  flushAsync,
  jsonResponse,
  loadAdminApp,
  loadBaseAdminApp,
  setLiveForm,
} from './support/admin-app-harness.mjs';

const repoRoot = process.cwd();
const BASE = ADMIN_APP_BASE_COMMIT_47;
const css = readFileSync(join(repoRoot, 'admin/style.css'), 'utf8');
const html = readFileSync(join(repoRoot, 'admin/index.html'), 'utf8');
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const baseCss = git('show', `${BASE}:admin/style.css`);

// ---------------------------------------------------------------------------------------------------------------------
// reading the CSS
// ---------------------------------------------------------------------------------------------------------------------
function splitGroups(text) {
  const marker = /\/\* ----- ([^\n]*?) ----- \*\/\n/g;
  const found = [...text.matchAll(marker)];
  const groups = new Map();
  found.forEach((match, index) => {
    const start = match.index;
    const end = index + 1 < found.length ? found[index + 1].index : text.length;
    groups.set(match[1], text.slice(start, end));
  });
  return { preamble: text.slice(0, found[0].index), groups };
}

function parseRules(text) {
  const rules = [];
  const source = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const walk = (chunk, media) => {
    let index = 0;
    while (index < chunk.length) {
      const open = chunk.indexOf('{', index);
      if (open === -1) break;
      const prelude = chunk.slice(index, open).trim();
      let depth = 1;
      let close = open + 1;
      while (close < chunk.length && depth > 0) {
        if (chunk[close] === '{') depth += 1;
        if (chunk[close] === '}') depth -= 1;
        close += 1;
      }
      const inner = chunk.slice(open + 1, close - 1);
      if (/^@(media|supports)/.test(prelude)) walk(inner, `${media} ${prelude}`.trim());
      else if (prelude && !prelude.startsWith('@')) rules.push({ selectors: prelude.split(',').map((selector) => selector.trim()), media, body: inner });
      index = close;
    }
  };
  walk(source, '');
  return rules;
}

const declarations = (body) => Object.fromEntries(body.split(';').map((line) => line.trim()).filter(Boolean).map((line) => {
  const at = line.indexOf(':');
  return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
}));

function specificity(selector) {
  const stripped = selector.replace(/:not\(([^)]*)\)/g, ' $1 ').replace(/:is\(([^)]*)\)/g, ' $1 ').replace(/:has\(([^)]*)\)/g, ' $1 ');
  const ids = (stripped.match(/#[\w-]+/g) || []).length;
  const classes = (stripped.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
  const elements = (stripped.replace(/[#.][\w-]+|\[[^\]]+\]|:+[\w-]+(\([^)]*\))?/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return [ids, classes, elements];
}

const heavier = (a, b) => {
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] > b[index];
  return false;
};

// does a media prelude (a chain of @media / @supports) apply at this width? (@supports are taken as supported)
function mediaApplies(media, width) {
  return [...media.matchAll(/@media\s*\(\s*(min|max)-width:\s*(\d+)px\s*\)/g)].every(([, kind, px]) => (kind === 'min' ? width >= Number(px) : width <= Number(px)))
    && ![...media.matchAll(/@media\s*([^{]*)/g)].some(([, query]) => /prefers-reduced-motion|print/.test(query));
}

// the value a rule with exactly this selector gives a property at this width (the last such rule that applies wins)
function valueAt(rules, width, selector, property) {
  let found;
  for (const rule of rules) {
    if (!rule.selectors.includes(selector) || !mediaApplies(rule.media, width)) continue;
    const value = declarations(rule.body)[property];
    if (value !== undefined) found = value;
  }
  return found;
}

const groupOf = (text, name) => {
  const group = splitGroups(text).groups.get(name);
  assert.ok(group, `the group ${name} exists`);
  return group;
};
const OWN_GROUPS = ['Reset & Base', 'Header', 'Tab Navigation', 'Occasional Updates'];
const WIDTHS = [360, 390, 821, 899, 900, 1011, 1440];
const occRules = parseRules(groupOf(css, 'Occasional Updates'));
const allRules = parseRules(css);

// ---------------------------------------------------------------------------------------------------------------------
// T47-STYLE
// ---------------------------------------------------------------------------------------------------------------------
test('T47-STYLE the layout switches at 899px / 900px and nowhere else: every media query of the groups #47 owns is (max-width: 899px) or (min-width: 900px)', () => {
  const current = splitGroups(css).groups;
  for (const name of OWN_GROUPS) {
    const queries = [...current.get(name).matchAll(/@media\s*([^{]+)\{/g)].map((match) => match[1].trim());
    for (const query of queries) assert.match(query, /^\((?:max-width: 899px|min-width: 900px)\)$/, `${name}: ${query}`);
  }
  const occQueries = [...current.get('Occasional Updates').matchAll(/@media\s*([^{]+)\{/g)].map((match) => match[1].trim());
  assert.ok(occQueries.includes('(max-width: 899px)') && occQueries.includes('(min-width: 900px)'), 'both sides are written');
  const script = readFileSync(join(repoRoot, 'admin/app.js'), 'utf8');
  assert.match(script, /const LIVE_WIDE_QUERY = '\(min-width: 900px\)'/, 'the script switches on the same 900px');
  assert.equal((script.match(/matchMedia\?*\.?\(/g) || []).length, (script.match(/matchMedia\?*\.?\(LIVE_WIDE_QUERY\)/g) || []).length, 'and on nothing else');
});

test('T47-STYLE at 360, 390, 821 and 899px News and Music are one column (the list, then an edit that takes its place); at 900, 1011 and 1440px they are two columns of 320px and the rest', () => {
  for (const width of WIDTHS) {
    const wide = width >= 900;
    assert.equal(valueAt(occRules, width, '.occ-master-detail', 'display'), wide ? 'grid' : 'block', `${width}: master-detail`);
    assert.equal(valueAt(occRules, width, '.occ-master-detail', 'grid-template-columns'), wide ? '320px minmax(0, 1fr)' : undefined, `${width}: columns`);
    assert.equal(valueAt(occRules, width, '.occ-master-detail', 'gap'), wide ? '24px' : undefined, `${width}: gap`);
    assert.equal(valueAt(occRules, width, '.occ-editor-pane', 'display'), 'none', `${width}: the edit pane is not shown until...`);
    assert.equal(valueAt(occRules, width, '.occ-master-detail .occ-editor-pane', 'display'), wide ? 'block' : undefined, `${width}: ...it stands beside the list (wide); narrow it opens in the list's place (below)`);
    assert.equal(valueAt(occRules, width, '.occ-master-detail.has-occ-selection .occ-editor-pane', 'display'), wide ? undefined : 'block', `${width}: an open edit shows its pane`);
    assert.equal(valueAt(occRules, width, '.occ-master-detail.has-occ-selection .occ-list-pane', 'display'), wide ? undefined : 'none', `${width}: and the list steps aside (narrow only)`);
    assert.equal(valueAt(occRules, width, '.occ-editor-bar', 'display'), wide ? 'none' : 'flex', `${width}: the ‹ 一覧 bar is for the one-column layout`);
    assert.equal(valueAt(occRules, width, '.tab-content.occ-tab', 'padding'), wide ? '24px 32px' : '20px 16px', `${width}: the body padding`);
  }
});

test('T47-STYLE 保存して公開 is a bar fixed to the bottom up to 899px and part of the heading from 900px (a button of 135px or more, dimmed when it cannot be pressed)', () => {
  for (const width of WIDTHS) {
    const wide = width >= 900;
    assert.equal(valueAt(occRules, width, '.occ-save', 'position'), wide ? 'static' : 'fixed', `${width}: position`);
    assert.equal(valueAt(occRules, width, '.occ-save', 'display'), wide ? 'contents' : 'flex', `${width}: display`);
    assert.equal(valueAt(occRules, width, '.occ-tab .occ-save-btn', 'width'), wide ? 'auto' : '100%', `${width}: the button`);
    assert.equal(valueAt(occRules, width, '.occ-tab .occ-save-btn', 'min-height'), '46px', `${width}: 46px tall (44px or more)`);
    assert.equal(valueAt(occRules, width, '.occ-tab .occ-save-btn:disabled', 'opacity'), '0.4', `${width}: dimmed while it cannot be pressed`);
  }
  assert.equal(valueAt(occRules, 900, '.occ-tab .occ-save-btn', 'min-width'), '135px');
});

test('T47-STYLE the upper band is 46px (Tabs 49px) up to 899px and 62px (Tabs 53px) from 900px, as variables the Header, the Tabs and the Live sticky offsets all read', () => {
  const baseGroup = groupOf(css, 'Reset & Base');
  const rules = parseRules(baseGroup);
  for (const width of WIDTHS) {
    const wide = width >= 900;
    assert.equal(valueAt(rules, width, ':root', '--admin-header-sticky-height'), wide ? '62px' : '46px', `${width}: Header`);
    assert.equal(valueAt(rules, width, ':root', '--admin-tab-nav-sticky-height'), wide ? '53px' : '49px', `${width}: Tabs`);
    assert.equal(valueAt(parseRules(groupOf(css, 'Header')), width, '.header', 'height'), 'var(--admin-header-sticky-height)');
    assert.equal(valueAt(parseRules(groupOf(css, 'Tab Navigation')), width, '.tab-nav', 'height'), 'var(--admin-tab-nav-sticky-height)');
    assert.equal(valueAt(parseRules(groupOf(css, 'Tab Navigation')), width, '.tab-nav', 'justify-content'), wide ? 'flex-start' : 'space-between', `${width}: the tabs share the width up to 899px and stand on the left from 900px`);
    assert.equal(valueAt(parseRules(groupOf(css, 'Tab Navigation')), width, '.tab-nav', 'gap'), wide ? '40px' : '0', `${width}: the gap between the tabs`);
  }
  assert.match(css, /--admin-global-chrome-sticky-offset:\s*calc\(var\(--admin-header-sticky-height\) \+ var\(--admin-tab-nav-sticky-height\)\)/);
  assert.doesNotMatch(css, /\b92px\b|\b54px\b/, 'nothing keeps the old 92px band or 54px tabs');
});

// the tags and classes that stand around a 保存して公開, read from the page's own markup
function ancestorsOfSaveBars() {
  const open = [];
  const chains = [];
  for (const match of html.matchAll(/<(\/?)([a-z0-9]+)([^>]*?)(\/?)>/gi)) {
    const [, closing, tag, attributes, selfClosing] = match;
    if (/^(meta|link|input|br|img|hr|script)$/i.test(tag)) continue;
    if (closing) { open.pop(); continue; }
    const classes = (attributes.match(/class="([^"]*)"/) || [, ''])[1].split(/\s+/).filter(Boolean);
    const id = (attributes.match(/id="([^"]*)"/) || [, ''])[1];
    const entry = { tag: tag.toLowerCase(), classes, id };
    if (classes.includes('occ-save')) chains.push(open.map((item) => ({ ...item })));
    if (!selfClosing) open.push(entry);
  }
  return chains;
}

test('T47-STYLE a fixed 保存して公開 has no ancestor that scrolls or makes a containing block for it (overflow, transform, filter, contain, will-change, perspective, backdrop-filter), at 360 to 899px', () => {
  const chains = ancestorsOfSaveBars();
  assert.equal(chains.length, 5, 'News, Music (works / videos), Channel URL, Site and Profile have one each');
  const breaking = /^(overflow(-[xy])?|transform|filter|backdrop-filter|contain|will-change|perspective|content-visibility)$/;
  const problems = [];
  for (const chain of chains) {
    const ancestors = [{ tag: 'html', classes: [], id: '' }, ...chain];
    for (const rule of allRules) {
      if (!mediaApplies(rule.media, 390)) continue;
      for (const selector of rule.selectors) {
        const compound = selector.split(/[\s>+~]+/).pop().replace(/::?[\w-]+(\([^)]*\))?/g, '');
        if (!compound || /:(hover|active|focus)/.test(selector)) continue;
        const parts = compound.match(/(^[a-z][\w-]*)|(\.[\w-]+)|(#[\w-]+)/gi) || [];
        const matchesAncestor = ancestors.some((entry) => parts.length > 0 && parts.every((part) => (
          part.startsWith('.') ? entry.classes.includes(part.slice(1)) : part.startsWith('#') ? entry.id === part.slice(1) : entry.tag === part.toLowerCase()
        )));
        if (!matchesAncestor) continue;
        for (const property of Object.keys(declarations(rule.body))) {
          const value = declarations(rule.body)[property];
          if (breaking.test(property) && !/^(visible|none|auto|normal)$/.test(value)) problems.push(`${selector} { ${property}: ${value} }`);
        }
      }
    }
  }
  assert.deepEqual([...new Set(problems)], [], 'rules that would stop a fixed bar from being fixed to the screen');
});

test('T47-STYLE everything pressable the occasional updates add is 44px or more tall (rows, switch, add, back, delete, link delete, picture buttons, 保存して公開) and the header button keeps a 44px area', () => {
  const minHeight = (selector) => {
    const found = occRules.filter((rule) => rule.selectors.includes(selector) && !rule.media).map((rule) => declarations(rule.body)['min-height']).filter(Boolean).pop();
    return found ? Number(found.replace('px', '')) : 0;
  };
  for (const selector of ['.occ-tab .occ-row', '.occ-switch-btn', '.occ-tab .occ-add', '.occ-tab .occ-back', '.occ-tab .occ-delete', '.occ-tab .occ-link-delete', '.occ-tab .occ-image .btn-image-select', '.occ-tab .occ-image .btn-image-clear', '.occ-tab .occ-save-btn']) {
    assert.ok(minHeight(selector) >= 44, `${selector} is ${minHeight(selector)}px`);
  }
  assert.match(groupOf(css, 'Header'), /\.save-btn::before\s*\{[^}]*inset:\s*-6px 0/, 'the 32px header button has a 44px area to press (32 + 6 + 6)');
  assert.match(groupOf(css, 'Tab Navigation'), /\.tab-nav \.tab-btn::before[\s\S]*?width:\s*max\(100%,\s*44px\)/, 'the tabs keep 44px to press from 900px');
});

test('T47-STYLE only four groups differ from the base commit: Reset & Base (the two sticky-height variables), Header, Tab Navigation, and the new Occasional Updates; every other group, Live Operations Hub included, is the same bytes', () => {
  const base = splitGroups(baseCss);
  const current = splitGroups(css);
  assert.equal(current.preamble, base.preamble);
  const currentNames = [...current.groups.keys()];
  assert.deepEqual(currentNames.filter((name) => name !== 'Occasional Updates'), [...base.groups.keys()], 'no group was removed or reordered; one was added');
  assert.equal(currentNames.indexOf('Occasional Updates'), currentNames.indexOf('Safe Area') - 1, 'the new group stands right before Safe Area');
  const changed = [...base.groups].filter(([name, text]) => current.groups.get(name) !== text).map(([name]) => name);
  assert.deepEqual(changed, ['Reset & Base', 'Header', 'Tab Navigation']);
  assert.equal(current.groups.get('Live Operations Hub'), base.groups.get('Live Operations Hub'), 'the Live group is the base commit\'s, byte for byte');
  for (const name of ['Tab Content', 'Section Header', 'Subsection', 'Add Button', 'Items List', 'Simple Field Layout', 'Item Card', 'Form Elements', 'Link Item (Profile)', 'Modal', 'Buttons', 'Toast', 'Drag Handle', 'Empty State', 'Checkbox', 'Utilities', 'Image Preview', 'Image Upload Area', 'Safe Area']) {
    assert.equal(current.groups.get(name), base.groups.get(name), `${name} is unchanged`);
  }
  // Reset & Base: with the two variables and the 900px block put back to the base values the group is the base's group
  const restored = current.groups.get('Reset & Base')
    .replace('--admin-header-sticky-height: 46px;', '--admin-header-sticky-height: 92px;')
    .replace('--admin-tab-nav-sticky-height: 49px;', '--admin-tab-nav-sticky-height: 54px;')
    .replace(/\n\/\* Issue #47: the upper band[^\n]*\n@media \(min-width: 900px\) \{[\s\S]*?\n\}\n/, '');
  assert.equal(restored, base.groups.get('Reset & Base'), 'Reset & Base changed the two variables and added the 900px values, nothing else');
});

test('T47-STYLE the shared classes keep their look: nothing outside Occasional Updates mentions an occ- class, and no rule of the unchanged groups is new', () => {
  const current = splitGroups(css).groups;
  for (const [name, text] of current) {
    if (name === 'Occasional Updates') continue;
    assert.doesNotMatch(text.replace(/\/\*[\s\S]*?\*\//g, ''), /occ-/, `${name} does not know the occ- classes`);
  }
  const baseSelectors = new Set(parseRules(baseCss).flatMap((rule) => rule.selectors.map((selector) => `${rule.media}|${selector}`)));
  const outside = parseRules(css.replace(groupOf(css, 'Occasional Updates'), ''));
  for (const rule of outside) {
    for (const selector of rule.selectors) {
      if (!baseSelectors.has(`${rule.media}|${selector}`)) assert.ok(/\.(header|logo|header-right|header-meta|save-btn|tab-nav)|body\.has-header-action|:root/.test(selector), `${selector} is a new rule outside the Header and Tabs`);
    }
  }
});

test('T47-STYLE the colours of the new rules are token variables only (no hex, rgb or hsl): the whole Occasional Updates group and the lines #47 added to Reset & Base, Header and Tab Navigation', () => {
  const baseLines = new Set(baseCss.split('\n').map((line) => line.trim()));
  const checked = groupOf(css, 'Occasional Updates').split('\n');
  assert.ok(checked.length > 900, 'the lines of the new group');
  for (const name of ['Reset & Base', 'Header', 'Tab Navigation']) {
    for (const line of groupOf(css, name).split('\n').map((text) => text.trim())) if (line && !baseLines.has(line)) checked.push(line);
  }
  for (const line of checked) assert.doesNotMatch(line, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, line);
  assert.ok(checked.some((line) => /var\(--/.test(line)));
});

// ---------------------------------------------------------------------------------------------------------------------
// T47-STYLE-SPEC
// ---------------------------------------------------------------------------------------------------------------------
const SHARED_CLASSES = ['form-group', 'text-input', 'textarea', 'select', 'btn', 'btn-primary', 'btn-secondary', 'btn-danger', 'image-upload-area', 'image-actions', 'image-preview-container', 'image-preview-large', 'image-placeholder', 'image-path-display', 'btn-image-select', 'btn-image-clear', 'item-card', 'tab-content', 'section-header', 'subsection', 'empty-state', 'add-btn', 'field-hint', 'form-error'];

test('T47-STYLE-SPEC every rule of Occasional Updates has an occ- class (or is a body state of an occ- screen), and the group stands after the shared groups it restyles', () => {
  const rules = parseRules(groupOf(css, 'Occasional Updates'));
  assert.ok(rules.length > 100, 'the group has its rules');
  const problems = [];
  for (const rule of rules) for (const selector of rule.selectors) if (!/occ-/.test(selector)) problems.push(selector);
  assert.deepEqual(problems, []);
  const order = [...splitGroups(css).groups.keys()];
  for (const shared of ['Tab Content', 'Section Header', 'Subsection', 'Item Card', 'Form Elements', 'Buttons', 'Image Preview', 'Image Upload Area']) {
    assert.ok(order.indexOf('Occasional Updates') > order.indexOf(shared), `after ${shared}`);
  }
});

test('T47-STYLE-SPEC a rule that restyles a shared class is under .occ-tab and out-weighs every shared rule it overlaps with, so no rule depends on being written later', () => {
  const sharedRules = parseRules(css.replace(groupOf(css, 'Occasional Updates'), '')).filter((rule) => !/live-|reservation|ticket|modal|tab-nav|header|\.tab-btn|\.toast/.test(rule.selectors.join()));
  const problems = [];
  let compared = 0;
  for (const rule of rules()) {
    const own = declarations(rule.body);
    for (const selector of rule.selectors) {
      const classes = new Set([...selector.matchAll(/\.([\w-]+)/g)].map((match) => match[1]));
      const used = SHARED_CLASSES.filter((name) => classes.has(name));
      if (used.length === 0) continue;
      if (!classes.has('occ-tab')) problems.push(`not under .occ-tab: ${selector}`);
      const mine = specificity(selector);
      const mineApplies = (width) => mediaApplies(rule.media, width);
      for (const shared of sharedRules) {
        for (const sharedSelector of shared.selectors) {
          // a shared rule can reach the same element when its whole selector is made of shared classes (and a state)
          if (!/^(?:\.[\w-]+)+(?::[\w-]+(?:\([^)]*\))?)*$/.test(sharedSelector)) continue;
          const sharedClasses = [...sharedSelector.matchAll(/\.([\w-]+)/g)].map((match) => match[1]);
          if (!sharedClasses.every((name) => SHARED_CLASSES.includes(name) || name === 'active') || !sharedClasses.some((name) => used.includes(name))) continue;
          if (![360, 390, 900, 1440].some((width) => mineApplies(width) && mediaApplies(shared.media, width))) continue;
          const overlap = Object.keys(declarations(shared.body)).filter((property) => property in own);
          if (overlap.length === 0) continue;
          compared += 1;
          if (!heavier(mine, specificity(sharedSelector))) problems.push(`${selector} (${mine.join(',')}) does not out-weigh ${sharedSelector} (${specificity(sharedSelector).join(',')}) on ${overlap.join(', ')}`);
        }
      }
    }
  }
  assert.ok(compared > 20, `the check really compared rules (${compared})`);
  assert.deepEqual(problems, []);

  function rules() { return parseRules(groupOf(css, 'Occasional Updates')); }
});

// ---------------------------------------------------------------------------------------------------------------------
// T47-LIVE-COMPAT
// ---------------------------------------------------------------------------------------------------------------------
const liveFixture = JSON.parse(readFileSync(join(repoRoot, 'test/fixtures/admin-live-states.json'), 'utf8'));
const plain = (value) => JSON.parse(JSON.stringify(value));
const timeless = (text) => String(text).replace(/\d{13}/g, '<time>');

async function liveSession(base) {
  const app = base ? loadBaseAdminApp() : loadAdminApp();
  app.setApiMode(true);
  app.setSiteData(app.normalizeSiteData(structuredClone(liveFixture.data)));
  app.setSavedBaseline(plain(app.getSiteData()));
  const puts = [];
  app.useAdminFetch(async (path, options = {}) => {
    if (path === '/api/admin/site-data' && options.method === 'PUT') {
      puts.push(timeless(options.body));
      return jsonResponse({ ok: true });
    }
    if (path.startsWith('/api/admin/ticket-reservations')) return jsonResponse({ reservations: [] });
    return jsonResponse({});
  });
  app.setupLiveWorkspace();
  app.setupTabs();
  app.renderLive();
  app.renderTicketSettings();
  return { app, puts };
}

const livesOf = () => [
  ...liveFixture.data.live.upcoming.map((live) => ({ id: live.id, category: 'upcoming' })),
  ...liveFixture.data.live.past.map((live) => ({ id: live.id, category: 'past' })),
];

test('T47-LIVE-COMPAT the Live tab draws the same markup as the base commit: the two lists, the editor of every Live (and of a new one), the Ticket Page settings', async () => {
  const now = await liveSession(false);
  const before = await liveSession(true);
  for (const id of ['live-upcoming-list', 'live-past-list']) {
    assert.equal(timeless(now.app.elements.get(id).innerHTML), timeless(before.app.elements.get(id).innerHTML), id);
    assert.ok(now.app.elements.get(id).innerHTML.length > 100, `${id} has the Lives`);
  }
  for (const { id, category } of livesOf()) {
    assert.equal(now.app.editLive(id, category), true);
    assert.equal(before.app.editLive(id, category), true);
    await flushAsync();
    assert.equal(timeless(now.app.elements.get('live-editor-body').innerHTML), timeless(before.app.elements.get('live-editor-body').innerHTML), `the editor of ${id}`);
    assert.equal(now.app.elements.get('live-editor-heading')?.textContent, before.app.elements.get('live-editor-heading')?.textContent, `the heading of ${id}`);
    assert.equal(timeless(now.app.elements.get('live-upcoming-list').innerHTML), timeless(before.app.elements.get('live-upcoming-list').innerHTML), `the list with ${id} open`);
  }
  now.app.closeLiveEditor();
  before.app.closeLiveEditor();
  await flushAsync();
  assert.equal(now.app.addLive(), true);
  assert.equal(before.app.addLive(), true);
  await flushAsync();
  assert.equal(timeless(now.app.elements.get('live-editor-body').innerHTML), timeless(before.app.elements.get('live-editor-body').innerHTML), 'the editor of a new Live');
  now.app.closeLiveEditor();
  before.app.closeLiveEditor();
  await flushAsync();
  for (const id of ['ticket-complete-text', 'ticket-field-quantity', 'ticket-field-message', 'ticket-field-label-quantity', 'ticket-field-label-message', 'ticket-field-placeholder-message', 'ticket-field-submit-label']) {
    assert.equal(now.app.elements.get(id).value, before.app.elements.get(id).value, id);
    assert.equal(now.app.elements.get(id).checked, before.app.elements.get(id).checked, id);
  }
});

async function livePuts(base) {
  const { app, puts } = await liveSession(base);
  // a changed Live
  app.editLive('fx-live-long', 'upcoming');
  await flushAsync();
  setLiveForm(app.elements, { 'edit-date': '2099-12-12', 'edit-venue': 'テスト会場B', 'edit-title': '保存で変えたタイトル' });
  assert.equal(await app.saveLiveWorkspace(), true);
  // a category move
  setLiveForm(app.elements, { isPast: true });
  assert.equal(await app.saveLiveWorkspace(), true);
  app.closeLiveEditor();
  await flushAsync();
  // a new Live
  assert.equal(app.addLive(), true);
  await flushAsync();
  setLiveForm(app.elements, { 'edit-date': '2099-01-01', 'edit-venue': '新しい会場', 'edit-title': '新しいライブ' });
  assert.equal(await app.saveLiveWorkspace(), true);
  app.closeLiveEditor();
  await flushAsync();
  // a delete
  assert.equal(app.editLive('fx-live-past-1', 'past'), true);
  await flushAsync();
  const deleting = app.deleteLiveFromWorkspace();
  await flushAsync();
  await answerLiveDialog(app, 'delete');
  assert.equal(await deleting, true);
  // the Ticket Page settings
  app.setTicketSettingsOpen(true);
  app.elements.get('ticket-complete-text').value = '新しい完了文';
  await app.elements.get('ticket-complete-text').oninput();
  app.elements.get('ticket-field-submit-label').value = '送る';
  await app.elements.get('ticket-field-submit-label').oninput();
  app.elements.get('ticket-field-message').checked = false;
  await app.elements.get('ticket-field-message').oninput();
  assert.equal(await app.saveTicketSettings(), true);
  return puts;
}

test('T47-LIVE-COMPAT a Live save, a category move, a new Live, a delete and the Ticket Page settings PUT the same bodies (as strings) as the base commit', async () => {
  const now = await livePuts(false);
  const before = await livePuts(true);
  assert.equal(now.length, 5, 'one PUT for each of the five operations');
  assert.deepEqual(now, before);
});

test('T47-LIVE-COMPAT the Live script, the Worker, the public pages, the public scripts and styles, the data and DESIGN_RULES.md are the bytes of the base commit', () => {
  assert.equal(readFileSync(join(repoRoot, 'assets/js/live-operations.js'), 'utf8'), git('show', `${BASE}:assets/js/live-operations.js`));
  assert.equal(git('diff', '--stat', BASE, '--', 'cloudflare', 'assets', 'data', 'DESIGN_RULES.md').trim(), '', 'git diff --stat against the base commit is empty');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', 'cloudflare', 'assets', 'data', 'DESIGN_RULES.md').trim(), '', 'and nothing new was added there');
  const publicPages = git('ls-files', '*.html').split('\n').filter((file) => file && !file.startsWith('admin/') && !file.startsWith('docs/') && !file.startsWith('aidlc-docs/'));
  assert.ok(publicPages.length > 3, 'the public pages');
  assert.equal(git('diff', '--stat', BASE, '--', ...publicPages).trim(), '', 'the public pages are untouched');
  assert.equal(git('diff', '--stat', BASE, '--', 'admin/config.js', 'admin/data').trim(), '', 'the admin settings and data are untouched');
});
