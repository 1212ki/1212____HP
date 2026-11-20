import assert from 'node:assert/strict';
import test from 'node:test';
import {FakeFormData, atBase, failStatus, fakeTimers, fixture, loadPage, okJson, read, scenarioData, scenarioFetch, settle} from './profile-contact-dom.mjs';

const contentSource = read('assets/js/site-content.js');
const contactSource = read('assets/js/contact.js');
const contactHtml = read('contact/index.html');
const baseHtml = atBase('contact/index.html');
// The embedded intro and endpoint are compared with the base page, never copied into the tests.
const embedded = {
  action: baseHtml.match(/<form[^>]*\baction="([^"]*)"/)[1],
  intro: baseHtml.match(/<p id="contact-intro">([^<]*)<\/p>/)[1],
  placeholders: [...baseHtml.matchAll(/placeholder="([^"]*)"/g)].map(m => m[1]),
};
const SYNTHETIC_ACTION = fixture.data.contact.formAction;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };

async function contactPage({scenario = 'base', settings, submit, timers = fakeTimers(), noSettle = false} = {}) {
  const settingsFetch = settings || scenarioFetch(scenario);
  const page = loadPage({
    html: contactHtml, pathname: '/contact/', sources: [contentSource, contactSource], timers,
    fetch: (url, init) => (String(url).endsWith('/api/public/site-data') ? settingsFetch(url, init) : (submit ? submit(url, init) : okJson({}))),
  });
  page.emitDocument('DOMContentLoaded');
  if (!noSettle) await settle();
  return page;
}
const submits = page => page.calls.filter(call => !String(call.url).endsWith('/api/public/site-data'));
const root = page => page.$('contact-content');
const form = page => page.$('contact-form');
const button = page => page.$('contact-submit');
const intro = page => page.$('contact-intro');
function fill(page, values = {}) {
  const v = {name: '架空 太郎', email: 'taro@example.test', message: '1行目\n2行目 <script>x</script> & "q"', ...values};
  page.$('name').value = v.name; page.$('email').value = v.email; page.$('message').value = v.message;
  return v;
}
const send = page => form(page).dispatch('submit');
const values = page => ({name: page.$('name').value, email: page.$('email').value, message: page.$('message').value});

test('T45-CON-SETTINGS real HTML: three fields, embedded intro and endpoint untouched, in-page validation switch, no overlay', () => {
  assert.match(contactHtml, /<body class="site-contact">/);
  const page = loadPage({html: contactHtml, pathname: '/contact/', sources: [], fetch: () => new Promise(() => {})});
  const f = form(page);
  assert.equal(f.getAttribute('action'), embedded.action);
  assert.equal(f.getAttribute('method'), 'POST');
  assert.ok(f.hasAttribute('novalidate'));
  assert.equal(intro(page).textContent, embedded.intro);
  const name = page.$('name'), email = page.$('email'), message = page.$('message');
  assert.deepEqual([name.tagName, name.getAttribute('type'), name.getAttribute('name'), name.hasAttribute('required')], ['INPUT', 'text', 'name', true]);
  assert.deepEqual([email.tagName, email.getAttribute('type'), email.getAttribute('name'), email.hasAttribute('required')], ['INPUT', 'email', '_replyto', true]);
  assert.deepEqual([message.tagName, message.getAttribute('name'), message.hasAttribute('required'), message.getAttribute('rows')], ['TEXTAREA', 'message', true, '5']);
  assert.deepEqual([name, email, message].map(el => el.getAttribute('placeholder')), embedded.placeholders);
  assert.deepEqual(f.querySelectorAll('label').map(l => [l.getAttribute('for'), l.textContent]), [['name', '名前'], ['email', 'e-mail'], ['message', '内容']]);
  assert.equal(button(page).getAttribute('type'), 'submit');
  assert.equal(button(page).textContent, '送信する');
  assert.ok(button(page).classList.contains('site-button') && button(page).classList.contains('site-button--primary'));
  assert.equal(page.$('contact-content').getAttribute('data-settings'), null);
  assert.doesNotMatch(contactHtml, /contactConfirm|ticket-modal/);
  assert.deepEqual([...contactHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]), ['../assets/js/site-config.js', '../assets/js/site-content.js?v=20261118-44', '../assets/js/contact.js?v=20261119-45', '../assets/js/script.js?v=20261118-44']);
});

test('T45-CON-SETTINGS success applies intro and endpoint, becomes ready, footer from site', async () => {
  const page = await contactPage();
  assert.equal(root(page).dataset.settings, 'ready');
  assert.equal(root(page).getAttribute('aria-busy'), 'false');
  assert.equal(intro(page).textContent, fixture.data.contact.introText);
  assert.equal(intro(page).hidden, false);
  assert.equal(form(page).getAttribute('action'), SYNTHETIC_ACTION);
  assert.equal(button(page).disabled, false);
  assert.equal(page.$('site-footer').textContent, fixture.data.site.footerText);
  assert.equal(page.calls.length, 1);
  assert.equal(page.calls[0].url, '/api/public/site-data');
});

test('T45-CON-SETTINGS loading: intro place shows 読み込み中, submit disabled and ignored', async () => {
  const page = await contactPage({scenario: 'loading'});
  assert.equal(root(page).dataset.settings, 'loading');
  assert.equal(root(page).getAttribute('aria-busy'), 'true');
  assert.equal(intro(page).textContent, '読み込み中');
  assert.equal(intro(page).dataset.state, 'loading');
  assert.equal(button(page).disabled, true);
  fill(page);
  assert.equal(send(page).defaultPrevented, true);
  assert.equal(submits(page).length, 0);
  assert.equal(form(page).getAttribute('action'), embedded.action);
});

test('T45-CON-SETTINGS empty settings keep the embedded endpoint and show no intro; missing contact behaves the same', async () => {
  for (const mutate of [d => { d.contact = {introText: '', formAction: ''}; }, d => { d.contact = {introText: '  ', formAction: ' '}; }, d => { delete d.contact; }, d => { d.contact = null; }]) {
    const data = scenarioData(); mutate(data);
    const page = await contactPage({settings: () => okJson({data, meta: fixture.meta})});
    assert.equal(root(page).dataset.settings, 'ready');
    assert.equal(intro(page).hidden, true);
    assert.equal(intro(page).textContent, '');
    assert.equal(form(page).getAttribute('action'), embedded.action);
    assert.equal(button(page).disabled, false);
  }
});

const unreadable = {
  'HTTP failure': () => failStatus(503),
  'network failure': () => Promise.reject(new Error('offline')),
  'invalid JSON': () => Promise.resolve({ok: true, json: async () => { throw new SyntaxError('bad'); }}),
  'null root': () => okJson(null),
  'array root': () => okJson([]),
  'contact is an array': () => okJson({data: {contact: []}, meta: {}}),
  'contact is a string': () => okJson({data: {contact: 'x'}, meta: {}}),
};
for (const [label, settings] of Object.entries(unreadable)) {
  test(`T45-CON-SETTINGS S45-X2 ${label}: embedded intro and endpoint, sendable, no notice`, async () => {
    const page = await contactPage({settings});
    assert.equal(root(page).dataset.settings, 'fallback');
    assert.equal(root(page).getAttribute('aria-busy'), 'false');
    assert.equal(intro(page).textContent, embedded.intro);
    assert.equal(intro(page).hidden, false);
    assert.equal(intro(page).getAttribute('data-state'), null);
    assert.equal(form(page).getAttribute('action'), embedded.action);
    assert.equal(button(page).disabled, false);
    assert.equal(page.$('contact-failure').hidden, true);
    assert.equal(page.$('contact-status').textContent, '');
  });
}

test('T45-CON-SETTINGS 8 seconds: falls back to embedded values, still sendable, a late success is applied without blocking', async () => {
  const late = deferred();
  const timers = fakeTimers();
  const page = await contactPage({settings: () => late.promise, timers});
  assert.deepEqual(timers.pending().map(t => t.ms), [8000]);
  assert.equal(root(page).dataset.settings, 'loading');
  timers.fire(8000);
  assert.equal(root(page).dataset.settings, 'fallback');
  assert.equal(intro(page).textContent, embedded.intro);
  assert.equal(button(page).disabled, false);
  assert.equal(form(page).getAttribute('action'), embedded.action);
  late.resolve({ok: true, json: async () => ({data: scenarioData(), meta: fixture.meta})});
  await settle();
  assert.equal(root(page).dataset.settings, 'ready');
  assert.equal(intro(page).textContent, fixture.data.contact.introText);
  assert.equal(form(page).getAttribute('action'), SYNTHETIC_ACTION);
  assert.equal(button(page).disabled, false);
});

test('T45-CON-SETTINGS a timely response clears the timer; a late failure changes nothing', async () => {
  const timers = fakeTimers();
  const page = await contactPage({timers});
  assert.equal(timers.list.length, 1);
  assert.equal(timers.list[0].cleared, true);
  timers.fire();
  assert.equal(root(page).dataset.settings, 'ready');
  const late = deferred(), timers2 = fakeTimers();
  const page2 = await contactPage({settings: () => late.promise, timers: timers2});
  timers2.fire(8000);
  late.resolve({ok: false, status: 500, json: async () => ({})});
  await settle();
  assert.equal(root(page2).dataset.settings, 'fallback');
  assert.equal(intro(page2).textContent, embedded.intro);
});

test('T45-CON-SEND posts to the action at submit time with Accept json and a FormData of exactly three keys', async () => {
  const page = await contactPage();
  const v = fill(page);
  form(page).setAttribute('action', 'https://forms.example.test/f/changed');
  const event = send(page);
  assert.equal(event.defaultPrevented, true);
  assert.equal(submits(page).length, 1);
  const [call] = submits(page);
  assert.equal(call.url, 'https://forms.example.test/f/changed');
  assert.equal(call.init.method, 'POST');
  assert.deepEqual(Object.keys(call.init.headers), ['Accept']);
  assert.equal(call.init.headers.Accept, 'application/json');
  assert.ok(call.init.body instanceof FakeFormData);
  assert.deepEqual([...call.init.body.keys()], ['name', '_replyto', 'message']);
  assert.deepEqual([...call.init.body.entries()], [['name', v.name], ['_replyto', v.email], ['message', v.message]]);
  assert.deepEqual(Object.keys(call.init).sort(), ['body', 'headers', 'method']);
  await settle();
  assert.equal(page.calls.length, 2, 'only the settings GET and the one submission leave the page');
});

test('T45-CON-SEND works with the embedded endpoint when settings were unreadable, and success needs only ok', async () => {
  const page = await contactPage({settings: () => failStatus(500), submit: () => Promise.resolve({ok: true})});
  fill(page);
  send(page);
  assert.equal(submits(page)[0].url, embedded.action);
  await settle();
  assert.equal(form(page).dataset.submitState, 'done');
});

const MESSAGES = {name: '名前を入力してください。', email: 'e-mailを入力してください。', message: '内容を入力してください。', format: 'e-mailの形式を確認してください。'};
const errorOf = (page, id) => page.$(id + '-error');
const FAILURE_TEXT = '送信できませんでした。入力内容は残っています。時間をおいて、もう一度お試しください。';

test('T45-CON-VALID empty, whitespace-only and malformed values: no request, in-page sentence per field, aria wiring, first field focused, values kept', async () => {
  const cases = [
    {values: {name: '', email: '', message: ''}, errors: {name: MESSAGES.name, email: MESSAGES.email, message: MESSAGES.message}, focus: 'name'},
    {values: {name: '  ', email: ' ', message: '\n\t'}, errors: {name: MESSAGES.name, email: MESSAGES.email, message: MESSAGES.message}, focus: 'name'},
    {values: {email: 'example@'}, errors: {email: MESSAGES.format}, focus: 'email'},
    {values: {email: 'no-at-sign'}, errors: {email: MESSAGES.format}, focus: 'email'},
    {values: {message: ''}, errors: {message: MESSAGES.message}, focus: 'message'},
    {values: {name: '', message: ''}, errors: {name: MESSAGES.name, message: MESSAGES.message}, focus: 'name'},
  ];
  for (const c of cases) {
    const page = await contactPage();
    const v = fill(page, c.values);
    const event = send(page);
    assert.equal(event.defaultPrevented, true);
    assert.equal(submits(page).length, 0);
    for (const id of ['name', 'email', 'message']) {
      const input = page.$(id), error = errorOf(page, id);
      if (c.errors[id]) {
        assert.equal(error.hidden, false, id);
        assert.equal(error.textContent, c.errors[id]);
        assert.equal(input.getAttribute('aria-invalid'), 'true');
        assert.equal(input.getAttribute('aria-describedby'), error.id);
      } else {
        assert.equal(error.hidden, true, id);
        assert.equal(input.getAttribute('aria-invalid'), null);
        assert.equal(input.getAttribute('aria-describedby'), null);
      }
    }
    assert.equal(page.document.activeElement, page.$(c.focus));
    assert.deepEqual(values(page), {name: v.name, email: v.email, message: v.message});
    assert.equal(form(page).dataset.submitState, 'invalid');
    assert.equal(button(page).disabled, false);
    assert.equal(button(page).textContent, '送信する');
  }
});

test('T45-CON-VALID typing clears only that field error; fixing everything sends; the browser typeMismatch standard decides the format', async () => {
  const page = await contactPage();
  fill(page, {name: '', email: 'bad', message: ''});
  send(page);
  page.$('email').dispatch('input');
  assert.equal(errorOf(page, 'email').hidden, true);
  assert.equal(errorOf(page, 'email').textContent, '');
  assert.equal(page.$('email').getAttribute('aria-invalid'), null);
  assert.equal(page.$('email').getAttribute('aria-describedby'), null);
  assert.equal(errorOf(page, 'name').hidden, false);
  assert.equal(page.$('name').getAttribute('aria-invalid'), 'true');
  fill(page, {email: 'a@b'});
  page.$('name').value = '架空'; page.$('message').value = '本文';
  send(page);
  assert.equal(submits(page).length, 1, 'a@b passes the standard check');
  assert.equal(errorOf(page, 'name').hidden, true);
  assert.equal(errorOf(page, 'message').hidden, true);
});

const failureCases = {
  'network exception': {submit: () => Promise.reject(new TypeError('offline'))},
  'HTTP 400': {submit: () => failStatus(400)},
  'HTTP 500': {submit: () => failStatus(500)},
  'empty action': {action: '', submit: () => okJson({})},
  'whitespace action': {action: '   ', submit: () => okJson({})},
};
for (const [label, c] of Object.entries(failureCases)) {
  test(`T45-CON-FAIL ${label}: input untouched, fixed notice, retry button, focus on the button; retry can succeed or fail again`, async () => {
    let attempt = 0;
    const page = await contactPage({submit: (url, init) => { attempt += 1; return attempt === 1 ? c.submit(url, init) : (attempt === 2 ? failStatus(502) : okJson({})); }});
    const v = fill(page);
    if (c.action !== undefined) form(page).setAttribute('action', c.action);
    send(page);
    await settle();
    assert.equal(form(page).dataset.submitState, 'failed');
    assert.deepEqual(values(page), {name: v.name, email: v.email, message: v.message});
    const notice = page.$('contact-failure');
    assert.equal(notice.hidden, false);
    assert.equal(notice.textContent, FAILURE_TEXT);
    assert.equal(notice.getAttribute('role'), 'alert');
    assert.equal(button(page).textContent, 'もう一度送信する');
    assert.equal(button(page).disabled, false);
    for (const id of ['name', 'email', 'message']) assert.equal(page.$(id).hasAttribute('readonly'), false);
    assert.equal(page.document.activeElement, button(page));
    assert.equal(page.$('contact-status').textContent, '');
    assert.equal(form(page).hidden, false);
    assert.equal(page.$('contact-done').hidden, true);
    if (c.action !== undefined) {
      assert.equal(submits(page).length, 0, 'an empty destination is never requested');
      form(page).setAttribute('action', SYNTHETIC_ACTION);
    }
    send(page);
    await settle();
    if (c.action !== undefined) {
      assert.equal(form(page).dataset.submitState, 'done');
      return;
    }
    assert.equal(form(page).dataset.submitState, 'failed', 'second failure shows the same state');
    assert.equal(notice.hidden, false);
    assert.equal(button(page).textContent, 'もう一度送信する');
    assert.deepEqual(values(page), {name: v.name, email: v.email, message: v.message});
    send(page);
    await settle();
    assert.equal(form(page).dataset.submitState, 'done');
    assert.equal(notice.hidden, true);
  });
}

test('T45-CON-FAIL a new attempt hides the previous notice while sending', async () => {
  const gate = deferred();
  let n = 0;
  const page = await contactPage({submit: () => (++n === 1 ? failStatus(500) : gate.promise)});
  fill(page); send(page); await settle();
  assert.equal(page.$('contact-failure').hidden, false);
  send(page);
  assert.equal(page.$('contact-failure').hidden, true);
  assert.equal(form(page).dataset.submitState, 'sending');
  gate.resolve({ok: true});
  await settle();
});

test('T45-CON-DONE ok shows the sent content as text, keeps the heading, moves focus, ignores later edits', async () => {
  const page = await contactPage();
  const v = fill(page, {message: '1行目\n<script>alert(1)</script> & "q"\n3行目'});
  send(page);
  await settle();
  assert.equal(form(page).dataset.submitState, 'done');
  assert.equal(intro(page).hidden, true);
  assert.equal(form(page).hidden, true);
  const done = page.$('contact-done');
  assert.equal(done.hidden, false);
  assert.equal(done.getAttribute('tabindex'), '-1');
  assert.equal(root(page).querySelector('h1').textContent, 'contact');
  const heading = done.querySelector('h2');
  assert.equal(heading.textContent, '送信しました。');
  assert.equal(page.document.activeElement, heading);
  assert.match(done.textContent, /お問い合わせありがとうございます。内容を確認して、入力いただいたe-mail宛にご連絡します。/);
  const rows = done.querySelectorAll('.contact-sent-row');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => r.textContent), [`名前　${v.name}`, `e-mail　${v.email}`, `内容　${v.message}`]);
  assert.equal(done.querySelectorAll('script').length, 0);
  assert.ok(rows.every(r => r.children.length === 0 && r.childNodes.length === 1), 'values are plain text nodes');
  const home = done.querySelector('a');
  assert.equal(home.textContent, 'Home →');
  assert.equal(home.getAttribute('href'), '../');
  assert.ok(home.classList.contains('site-text-link'));
  page.$('name').value = '後から書き換え'; page.$('message').value = '別の内容';
  assert.deepEqual(rows.map(r => r.textContent), [`名前　${v.name}`, `e-mail　${v.email}`, `内容　${v.message}`]);
  assert.equal(form(page).resetCalls, 0, 'form.reset is never called');
  assert.equal(page.$('contact-status').textContent, '');
  assert.equal(done.querySelector('.contact-sent').children.length, 3);
});

test('T45-CON-DOUBLE sending: one request, disabled button 送信しています…, read-only fields keep values, status announced, state restored afterwards', async () => {
  const gate = deferred();
  let n = 0;
  const page = await contactPage({submit: () => (++n === 1 ? gate.promise : okJson({}))});
  const v = fill(page);
  send(page);
  assert.equal(form(page).dataset.submitState, 'sending');
  assert.equal(button(page).disabled, true);
  assert.equal(button(page).textContent, '送信しています…');
  for (const id of ['name', 'email', 'message']) assert.equal(page.$(id).hasAttribute('readonly'), true, id);
  assert.deepEqual(values(page), {name: v.name, email: v.email, message: v.message});
  assert.equal(page.$('contact-status').textContent, '送信しています…');
  assert.equal(page.$('contact-failure').hidden, true);
  send(page); send(page); form(page).dispatch('submit');
  assert.equal(submits(page).length, 1, 'Enter or repeated submit during sending is ignored');
  gate.resolve({ok: false, status: 500});
  await settle();
  assert.equal(form(page).dataset.submitState, 'failed');
  assert.equal(button(page).disabled, false);
  assert.equal(page.$('contact-status').textContent, '');
  send(page);
  await settle();
  assert.equal(submits(page).length, 2);
  assert.equal(form(page).dataset.submitState, 'done');
});

test('T45-CON-DOUBLE late settings never re-enable the button during sending nor reopen the intro after completion', async () => {
  const late = deferred(), gate = deferred();
  const timers = fakeTimers();
  const page = await contactPage({settings: () => late.promise, submit: () => gate.promise, timers});
  timers.fire(8000);
  fill(page);
  send(page);
  assert.equal(button(page).disabled, true);
  late.resolve({ok: true, json: async () => ({data: scenarioData(), meta: fixture.meta})});
  await settle();
  assert.equal(root(page).dataset.settings, 'ready');
  assert.equal(button(page).disabled, true, 'still sending');
  assert.equal(submits(page)[0].url, embedded.action, 'the in-flight request keeps the action read at submit time');
  gate.resolve({ok: true});
  await settle();
  assert.equal(form(page).dataset.submitState, 'done');
  assert.equal(intro(page).hidden, true);
});

test('T45-CON-GUARD RV45-01 an HTML without the elements the handler needs gets no handler: submit is not prevented, nothing is requested', async () => {
  const required = ['contact-form', 'contact-submit', 'contact-status', 'contact-failure', 'contact-done', 'contact-intro', 'name', 'email', 'message', 'name-error', 'email-error', 'message-error'];
  for (const id of required) {
    const html = contactHtml.replace(new RegExp(`\\sid="${id}"`), ' data-removed="1"');
    assert.notEqual(html, contactHtml, id);
    const page = loadPage({
      html, pathname: '/contact/', sources: [contactSource], timers: fakeTimers(), fetch: () => okJson({}),
    });
    page.emitDocument('DOMContentLoaded');
    await settle();
    const f = page.$('contact-form');
    if (!f) continue;
    const event = f.dispatch('submit');
    assert.equal(event.defaultPrevented, false, `${id} missing: the standard form submission must stay in charge`);
    assert.equal(submits(page).length, 0, id);
  }
});

test('T45-CON-VALID RV45-03 an input error after a failed send hides the previous failure notice', async () => {
  const page = await contactPage({submit: () => failStatus(500)});
  fill(page); send(page); await settle();
  assert.equal(page.$('contact-failure').hidden, false);
  page.$('name').value = '';
  send(page);
  assert.equal(form(page).dataset.submitState, 'invalid');
  assert.equal(errorOf(page, 'name').hidden, false);
  assert.equal(page.$('contact-failure').hidden, true);
  assert.equal(submits(page).length, 1, 'the invalid retry sends nothing');
});
