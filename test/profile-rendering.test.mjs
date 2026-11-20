import assert from 'node:assert/strict';
import test from 'node:test';
import {atBase, fixture, loadPage, okJson, failStatus, read, scenarioData, scenarioFetch, settle} from './profile-contact-dom.mjs';

const source = read('assets/js/site-content.js');
const profileHtml = read('profile/index.html');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };

async function profilePage({scenario = 'base', data, fetch} = {}) {
  const page = loadPage({
    html: profileHtml, pathname: '/profile/', sources: [source],
    fetch: fetch || (data ? () => okJson({data, meta: fixture.meta}) : scenarioFetch(scenario)),
  });
  await settle();
  return page;
}
const chips = page => page.$('profile-link-list').querySelectorAll('a').map(a => ({label: a.textContent, url: a.getAttribute('href')}));
const state = page => page.$('profile-content').dataset.state;

test('T45-PROF-DATA real HTML: ids, structure, fixed name and contact entry, no initial state attributes', () => {
  assert.match(profileHtml, /<body class="site-profile">/);
  const page = loadPage({html: profileHtml, pathname: '/profile/', sources: [], fetch: () => new Promise(() => {})});
  const main = page.$('profile-content');
  assert.equal(main.tagName, 'MAIN');
  assert.ok(main.classList.contains('profile-container'));
  assert.equal(main.getAttribute('data-state'), null);
  assert.equal(main.getAttribute('aria-busy'), null);
  const h1 = main.querySelector('h1');
  assert.equal(h1.textContent, 'profile');
  assert.ok(h1.classList.contains('site-section-title'));
  assert.equal(page.$('profile-photo').hidden, true);
  assert.equal(page.$('profile-image').getAttribute('alt'), '松本一樹');
  assert.equal(page.$('profile-text').hidden, true);
  assert.equal(page.$('profile-links-block').hidden, true);
  assert.ok(page.$('profile-links-title').classList.contains('home-caption'));
  assert.equal(page.$('profile-links-title').textContent, 'links');
  assert.ok(page.$('profile-state'));
  const name = main.querySelector('.profile-name');
  assert.equal(name.querySelector('h2').textContent, '松本一樹');
  assert.equal(name.querySelector('p').textContent, 'itsuki matsumoto');
  const entry = main.querySelector('.profile-contact-entry');
  assert.match(entry.textContent, /出演のご依頼・お問い合わせ/);
  const cta = entry.querySelector('a');
  assert.equal(cta.getAttribute('href'), '../contact/');
  assert.equal(cta.textContent, 'Contactへ');
  assert.ok(cta.classList.contains('site-button') && cta.classList.contains('site-button--secondary'));
  assert.deepEqual([...profileHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1].split('?')[0]), ['../assets/js/site-config.js', '../assets/js/site-content.js', '../assets/js/script.js']);
});

test('T45-PROF-DATA success renders photo src (../ prefix, version, upper-case extension), text via textContent, one GET', async () => {
  const page = await profilePage();
  assert.equal(state(page), 'ready');
  assert.equal(page.$('profile-content').getAttribute('aria-busy'), 'false');
  assert.equal(page.calls.length, 1);
  assert.equal(page.calls[0].url, '/api/public/site-data');
  assert.equal(page.calls[0].init.cache, 'no-store');
  assert.equal(page.$('profile-photo').hidden, false);
  assert.equal(page.$('profile-image').getAttribute('src'), '../assets/images/synthetic-profile.JPG?v=2026-11-17T00%3A00%3A00Z');
  const text = page.$('profile-text');
  assert.equal(text.hidden, false);
  assert.equal(text.textContent, fixture.data.profile.text);
  assert.equal(text.childNodes.length, 1, 'text is one text node, never parsed as HTML');
  assert.equal(text.childNodes[0].nodeType, 3);
  assert.equal(text.children.length, 0);
  assert.match(text.textContent, /\n\n〜活動〜\n・2026年1月/);
  assert.match(text.textContent, /<b>タグ<\/b> & "引用"/);
  assert.equal(page.$('profile-state').innerHTML, '');
});

test('T45-PROF-DATA footer text comes from site.footerText', async () => {
  const page = await profilePage();
  assert.equal(page.document.querySelector('#site-footer') !== null, true);
  assert.equal(page.$('site-footer').textContent, fixture.data.site.footerText);
});

for (const [label, raw, expected] of [
  ['CRLF', 'a\r\nb', 'a\nb'],
  ['CR', 'a\rb', 'a\nb'],
  ['literal <br>', 'a<br>b<BR />c<br/>d', 'a\nb\nc\nd'],
  ['mixed with blank line', '1\r\n\r\n2<br><br>3', '1\n\n2\n\n3'],
  ['markup stays literal', '<script>x</script> & "q"', '<script>x</script> & "q"'],
]) {
  test(`T45-PROF-DATA text normalization: ${label}`, async () => {
    const data = scenarioData(); data.profile.text = raw;
    const page = await profilePage({data});
    assert.equal(page.$('profile-text').textContent, expected);
    assert.equal(page.$('profile-text').children.length, 0);
  });
}

for (const [label, value] of [['whitespace only', ' \n\t '], ['empty', ''], ['missing', undefined], ['null', null], ['number zero', 0]]) {
  test(`T45-PROF-DATA text ${label} keeps the text element hidden`, async () => {
    const data = scenarioData(); if (value === undefined) delete data.profile.text; else data.profile.text = value;
    const page = await profilePage({data});
    assert.equal(state(page), 'ready');
    assert.equal(page.$('profile-text').hidden, value === 0 ? false : true);
  });
}

test('T45-PROF-LINKS production shape (Site 5, Profile 4 all among the five services) stays five, Home order, label Bandcamp', async () => {
  const data = scenarioData();
  assert.equal(Object.keys(data.site.links).length, 5);
  assert.equal(data.profile.links.length, 4);
  const page = await profilePage({data});
  assert.deepEqual(chips(page).map(c => c.label), ['Bandcamp', 'YouTube', 'X', 'Instagram', 'note']);
  assert.deepEqual(chips(page).map(c => c.url), ['https://example.test/shop', 'https://example.test/videos', 'https://example.test/x', 'https://example.test/photos', 'https://example.test/notes']);
  assert.equal(page.$('profile-links-block').hidden, false);
  for (const a of page.$('profile-link-list').querySelectorAll('a')) {
    assert.ok(a.classList.contains('site-chip'));
    assert.equal(a.getAttribute('target'), '_blank');
    assert.equal(a.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(a.getAttribute('aria-label'), `${a.textContent}（外部サイト・別タブ）`);
  }
});

// The pre-change Profile (base commit) is run in the same DOM as the reference for "no link may disappear".
async function legacyLinks(data) {
  const page = loadPage({html: atBase('profile/index.html'), pathname: '/profile/', sources: [atBase('assets/js/site-content.js')], fetch: () => okJson({data, meta: fixture.meta})});
  await settle();
  return page.$('profile-links').querySelectorAll('a').map(a => ({label: a.textContent, url: a.getAttribute('href')}));
}
const safe = list => list.filter(link => /^https?:\/\//.test(link.url));

const linkCases = {
  'both Site and Profile (production shape)': () => scenarioData('base'),
  'Site only': () => scenarioData('site-links-only'),
  'Profile only': () => scenarioData('profile-links-only'),
  'neither': () => scenarioData('no-links'),
  'extra links beyond the five services': () => scenarioData('extra-links'),
  'Profile with extras only and no Site links': () => { const d = scenarioData('profile-links-only'); d.profile.links = [{name: 'Synthetic Blog', url: 'https://example.test/blog'}, {name: 'Other Page', url: 'https://example.test/other'}]; return d; },
  'Profile links not an array': () => { const d = scenarioData('base'); d.profile.links = {name: 'X', url: 'https://example.test/x'}; return d; },
};
for (const [label, build] of Object.entries(linkCases)) {
  test(`T45-PROF-LINKS no link of the current Profile disappears, same order at the head: ${label}`, async () => {
    const before = safe(await legacyLinks(build()));
    const page = await profilePage({data: build()});
    const now = chips(page);
    assert.deepEqual(now.slice(0, before.length), before);
    assert.equal(page.$('profile-links-block').hidden, now.length === 0);
  });
}

test('T45-PROF-LINKS extras: registered order after the five services, one per destination, unsafe URL dropped, empty name shows host', async () => {
  const page = await profilePage({scenario: 'extra-links'});
  assert.deepEqual(chips(page).map(c => c.label), ['Bandcamp', 'YouTube', 'X', 'Instagram', 'note', 'Synthetic Blog', 'extra.example.test']);
  assert.equal(chips(page)[5].url, 'https://example.test/blog/');
  assert.ok(!chips(page).some(c => /javascript/.test(c.url)));
});

test('T45-PROF-LINKS a Site service wins over the same service on Profile; the same destination appears once', async () => {
  const data = scenarioData();
  data.profile.links = [{name: 'Synthetic Page', url: 'https://example.test/shop/'}, {name: 'Another', url: 'https://example.test/another'}];
  const page = await profilePage({data});
  assert.deepEqual(chips(page).map(c => c.label), ['Bandcamp', 'YouTube', 'X', 'Instagram', 'note', 'Another']);
});

test('T45-PROF-LINKS without Site links Profile services are completed like Home, unsafe Site links are not rendered', async () => {
  const data = scenarioData('profile-links-only');
  const page = await profilePage({data});
  assert.deepEqual(chips(page).map(c => c.label), ['YouTube', 'X', 'Instagram', 'note']);
  const unsafe = scenarioData(); unsafe.site.links.x = 'javascript:alert(1)'; unsafe.profile.links = [];
  assert.deepEqual(chips(await profilePage({data: unsafe})).map(c => c.label), ['Bandcamp', 'YouTube', 'Instagram', 'note']);
});

test('T45-PROF-LINKS markup in labels and URLs is escaped', async () => {
  const data = scenarioData('site-links-only'); data.site.links = {};
  data.profile.links = [{name: '<u>Tag & "q"</u>', url: 'https://example.test/a?x="1"&y=2'}];
  const page = await profilePage({data});
  const [chip] = page.$('profile-link-list').querySelectorAll('a');
  assert.equal(chip.textContent, '<u>Tag & "q"</u>');
  assert.equal(chip.getAttribute('href'), 'https://example.test/a?x="1"&y=2');
  assert.equal(page.$('profile-link-list').querySelectorAll('u').length, 0);
});

test('T45-PROF-LINKS Home links output is unchanged by the Issue #45 block', async () => {
  const homeHtml = read('index.html');
  const run = async code => {
    const page = loadPage({html: homeHtml, pathname: '/', sources: [read('assets/js/live-operations.js'), read('assets/js/music-data.js'), code], fetch: () => okJson({data: scenarioData('extra-links'), meta: fixture.meta})});
    await settle();
    return {links: page.$('home-link-list').innerHTML, text: page.$('home-profile-text').innerHTML, state: page.$('home-content').dataset.state};
  };
  const now = await run(source);
  assert.equal(now.state, 'ready');
  assert.notEqual(now.links, '');
  assert.deepEqual(now, await run(atBase('assets/js/site-content.js')));
});

test('T45-PROF-STATE S45-L loading: busy, photo frame and status shown, no text or links, fixed entry present', async () => {
  const page = await profilePage({scenario: 'loading'});
  assert.equal(state(page), 'loading');
  assert.equal(page.$('profile-content').getAttribute('aria-busy'), 'true');
  assert.equal(page.$('profile-photo').hidden, false);
  assert.equal(page.$('profile-image').getAttribute('src'), null);
  const status = page.$('profile-state').querySelector('[role="status"]');
  assert.equal(status.textContent, '読み込み中');
  assert.equal(page.$('profile-text').hidden, true);
  assert.equal(page.$('profile-links-block').hidden, true);
  assert.equal(page.$('profile-content').querySelector('.profile-contact-entry a').getAttribute('href'), '../contact/');
});

test('T45-PROF-STATE S45-01 no photo: frame hidden, text kept, still ready; invalid image values count as unregistered', async () => {
  for (const image of ['', '   ', 'javascript:alert(1)', 'data:image/png;base64,AAAA', undefined]) {
    const data = scenarioData(); if (image === undefined) delete data.profile.image; else data.profile.image = image;
    const page = await profilePage({data});
    assert.equal(state(page), 'ready', String(image));
    assert.equal(page.$('profile-photo').hidden, true, String(image));
    assert.equal(page.$('profile-image').getAttribute('src'), null, String(image));
    assert.equal(page.$('profile-text').hidden, false);
  }
});

test('T45-PROF-STATE S45-X1 photo load error hides the frame while text and links stay', async () => {
  const page = await profilePage({scenario: 'broken-photo'});
  assert.equal(page.$('profile-photo').hidden, false, 'frame stays while loading');
  assert.equal(page.$('profile-image').getAttribute('src'), '../assets/images/synthetic-missing.JPG?v=2026-11-17T00%3A00%3A00Z');
  page.$('profile-image').dispatch('error');
  assert.equal(page.$('profile-photo').hidden, true);
  assert.equal(state(page), 'ready');
  assert.equal(page.$('profile-text').hidden, false);
  assert.equal(page.$('profile-links-block').hidden, false);
});

const failures = {
  'HTTP failure': () => failStatus(503),
  'network failure': () => Promise.reject(new Error('offline')),
  'invalid JSON': () => Promise.resolve({ok: true, json: async () => { throw new SyntaxError('bad'); }}),
  'null root': () => okJson(null),
  'array root': () => okJson([]),
  'array data': () => okJson({data: [], meta: {}}),
  'string data': () => okJson({data: 'x', meta: {}}),
  'profile is an array': () => okJson({data: {profile: []}, meta: {}}),
  'profile is a string': () => okJson({data: {profile: 'text'}, meta: {}}),
};
for (const [label, fetch] of Object.entries(failures)) {
  test(`T45-PROF-STATE S45-02 ${label} gives error, never ready, one notice with retry`, async () => {
    const page = await profilePage({fetch});
    assert.equal(state(page), 'error');
    assert.equal(page.$('profile-content').getAttribute('aria-busy'), 'false');
    assert.equal(page.$('profile-photo').hidden, true);
    assert.equal(page.$('profile-text').hidden, true);
    assert.equal(page.$('profile-links-block').hidden, true);
    assert.equal(page.$('profile-state').querySelectorAll('p').length, 1);
    assert.equal(page.$('profile-state').querySelector('p').textContent, 'プロフィールを読み込めませんでした。');
    const retry = page.$('profile-state').querySelector('[data-profile-action="retry"]');
    assert.equal(retry.textContent, 'もう一度読み込む');
    assert.ok(retry.classList.contains('site-button') && retry.classList.contains('site-button--secondary'));
    assert.equal(page.$('profile-content').querySelector('.profile-contact-entry a').getAttribute('href'), '../contact/');
  });
}

test('T45-PROF-STATE profile missing, null or empty object is ready with name and entry only', async () => {
  for (const mutate of [d => { delete d.profile; }, d => { d.profile = null; }, d => { d.profile = {}; }]) {
    const data = scenarioData(); mutate(data);
    const page = await profilePage({data});
    assert.equal(state(page), 'ready');
    assert.equal(page.$('profile-photo').hidden, true);
    assert.equal(page.$('profile-text').hidden, true);
    assert.equal(page.$('profile-links-block').hidden, !(Object.keys(data.site.links).length > 0));
    assert.equal(page.$('profile-state').innerHTML, '');
  }
});

test('T45-PROF-STATE retry: one request, success moves focus to the heading, failure keeps focus on the new button', async () => {
  let n = 0;
  const page = await profilePage({fetch: () => (++n === 1 ? failStatus(500) : n === 2 ? failStatus(500) : okJson({data: scenarioData(), meta: fixture.meta}))});
  assert.equal(state(page), 'error');
  const first = page.$('profile-state').querySelector('[data-profile-action="retry"]');
  first.dispatch('click');
  first.dispatch('click');
  assert.equal(first.disabled, true);
  assert.equal(page.calls.length, 2, 'second click on the same button does not issue a request');
  assert.equal(state(page), 'loading');
  await settle();
  assert.equal(state(page), 'error');
  const second = page.$('profile-state').querySelector('[data-profile-action="retry"]');
  assert.equal(page.document.activeElement, second);
  second.dispatch('click');
  await settle();
  assert.equal(state(page), 'ready');
  const h1 = page.$('profile-content').querySelector('h1');
  assert.equal(h1.getAttribute('tabindex'), '-1');
  assert.equal(page.document.activeElement, h1);
  assert.equal(page.calls.length, 3);
});

test('T45-PROF-STATE stale responses never overwrite the current state (pagehide then pageshow)', async () => {
  const first = deferred(), second = deferred();
  let n = 0;
  const page = await profilePage({fetch: () => (++n === 1 ? first.promise : second.promise)});
  assert.equal(state(page), 'loading');
  page.emitWindow('pagehide');
  assert.equal(page.$('profile-content').getAttribute('aria-busy'), 'false', 'pagehide releases the busy state');
  page.emitWindow('pageshow', {persisted: false});
  assert.equal(page.calls.length, 1, 'a non-persisted pageshow does not refetch');
  page.emitWindow('pageshow', {persisted: true});
  assert.equal(page.calls.length, 2, 'an interrupted request is retried on restore');
  first.resolve({ok: true, json: async () => ({data: 'broken', meta: {}})});
  await settle();
  assert.equal(state(page), 'loading', 'the old response is dropped');
  second.resolve({ok: true, json: async () => ({data: scenarioData(), meta: fixture.meta})});
  await settle();
  assert.equal(state(page), 'ready');
  assert.equal(page.$('profile-content').getAttribute('aria-busy'), 'false');
  page.emitWindow('pageshow', {persisted: true});
  assert.equal(page.calls.length, 2, 'no refetch when nothing was interrupted');
});

test('T45-PROF-STATE retry is not repeated while a request is pending', async () => {
  const slow = deferred();
  let n = 0;
  const page = await profilePage({fetch: () => (++n === 1 ? failStatus(500) : slow.promise)});
  const button = page.$('profile-state').querySelector('[data-profile-action="retry"]');
  button.dispatch('click');
  assert.equal(page.calls.length, 2);
  page.$('profile-content').dispatch('click', {target: button});
  assert.equal(page.calls.length, 2, 'a click that reaches the root while pending is ignored');
  slow.resolve({ok: true, json: async () => ({data: scenarioData(), meta: fixture.meta})});
  await settle();
  assert.equal(state(page), 'ready');
});

test('T45-PROF-STATE Home profile column is untouched: first paragraph only, same as before', async () => {
  const run = async code => {
    const page = loadPage({html: read('index.html'), pathname: '/', sources: [read('assets/js/live-operations.js'), read('assets/js/music-data.js'), code], fetch: () => okJson({data: scenarioData(), meta: fixture.meta})});
    await settle();
    return page.$('home-profile-text').innerHTML;
  };
  const now = await run(source);
  assert.notEqual(now, '');
  assert.equal(now, await run(atBase('assets/js/site-content.js')));
});
