// Minimal DOM for the Issue #43 tests. It parses the real HTML files and runs the real
// browser sources in a Node `vm` context. No dependency is added; only the DOM surface the
// production code uses is modelled (tree, attributes, classList, dataset, selectors, events,
// form values, focus). Production logic is never re-implemented here.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);
const REFLECTED = { title: 'title', src: 'src', href: 'href', alt: 'alt', type: 'type', name: 'name', placeholder: 'placeholder', target: 'target', rel: 'rel', lang: 'lang', htmlFor: 'for' };
const BOOLEAN = { hidden: 'hidden', disabled: 'disabled', required: 'required', readOnly: 'readonly', selected: 'selected', open: 'open' };

export function decodeEntities(text) {
  return String(text)
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&copy;/g, '©')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function camel(name) { return name.replace(/-([a-z])/g, (_m, c) => c.toUpperCase()); }
function kebab(name) { return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`); }

class Text {
  constructor(data) { this.nodeType = 3; this.data = String(data); this.parentNode = null; }
  get textContent() { return this.data; }
}

class Event {
  constructor(type, init = {}) {
    Object.assign(this, { bubbles: true, cancelable: true, defaultPrevented: false, target: null, currentTarget: null }, init, { type });
    this._stop = false;
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this._stop = true; }
  stopImmediatePropagation() { this._stop = true; }
}

class Target {
  constructor() { this._listeners = new Map(); }
  addEventListener(type, fn, options) {
    const capture = typeof options === 'boolean' ? options : Boolean(options && options.capture);
    const list = this._listeners.get(type) || [];
    if (!list.some((entry) => entry.fn === fn && entry.capture === capture)) list.push({ fn, capture });
    this._listeners.set(type, list);
  }
  removeEventListener(type, fn, options) {
    const capture = typeof options === 'boolean' ? options : Boolean(options && options.capture);
    this._listeners.set(type, (this._listeners.get(type) || []).filter((entry) => !(entry.fn === fn && entry.capture === capture)));
  }
  listenerCount(type) { return (this._listeners.get(type) || []).length; }
  _path() { return [this]; }
  dispatchEvent(event) {
    const path = this._path();
    event.target = event.target || this;
    const pending = [];
    const call = (node, capturePhase) => {
      event.currentTarget = node;
      for (const entry of [...(node._listeners.get(event.type) || [])]) {
        if (node === event.target ? false : entry.capture !== capturePhase) continue;
        if (node === event.target && capturePhase) continue;
        const result = entry.fn.call(node, event);
        if (result && typeof result.then === 'function') pending.push(result);
        if (event._stop) return true;
      }
      return false;
    };
    for (let i = path.length - 1; i > 0; i -= 1) if (call(path[i], true)) { event._pending = pending; return !event.defaultPrevented; }
    if (call(path[0], false)) { event._pending = pending; return !event.defaultPrevented; }
    if (event.bubbles) for (let i = 1; i < path.length; i += 1) if (call(path[i], false)) break;
    event._pending = pending;
    return !event.defaultPrevented;
  }
}

// ---- selectors ----------------------------------------------------------------------------
function parseCompound(text) {
  const parts = { tag: '', id: '', classes: [], attrs: [], not: [] };
  let rest = text;
  const tag = rest.match(/^[a-zA-Z][\w-]*|^\*/);
  if (tag) { parts.tag = tag[0] === '*' ? '' : tag[0].toLowerCase(); rest = rest.slice(tag[0].length); }
  while (rest) {
    let m;
    if ((m = rest.match(/^#([\w-]+)/))) parts.id = m[1];
    else if ((m = rest.match(/^\.([\w-]+)/))) parts.classes.push(m[1]);
    else if ((m = rest.match(/^\[([\w-]+)(?:(\^|\$|\*)?=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/))) parts.attrs.push({ name: m[1], op: m[2] || (m[3] !== undefined || m[4] !== undefined || m[5] !== undefined ? '=' : ''), value: m[3] ?? m[4] ?? m[5] ?? '' });
    else if ((m = rest.match(/^:not\((.*?)\)/))) parts.not.push(parseCompound(m[1]));
    else throw new Error(`unsupported selector: ${text}`);
    rest = rest.slice(m[0].length);
  }
  return parts;
}
function parseSelector(selector) {
  return selector.split(',').map((chain) => {
    const tokens = chain.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
    const steps = [];
    let combinator = ' ';
    for (const token of tokens) {
      if (token === '>') { combinator = '>'; continue; }
      steps.push({ combinator, compound: parseCompound(token) });
      combinator = ' ';
    }
    return steps;
  });
}
function matchCompound(el, c) {
  if (c.tag && el.localName !== c.tag) return false;
  if (c.id && el.id !== c.id) return false;
  for (const name of c.classes) if (!el.classList.contains(name)) return false;
  for (const a of c.attrs) {
    const v = el.getAttribute(a.name);
    if (v === null) return false;
    if (a.op === '=' && v !== a.value) return false;
    if (a.op === '^' && !v.startsWith(a.value)) return false;
    if (a.op === '$' && !v.endsWith(a.value)) return false;
    if (a.op === '*' && !v.includes(a.value)) return false;
  }
  return !c.not.some((n) => matchCompound(el, n));
}
function matchChain(el, steps, index) {
  const step = steps[index];
  if (!matchCompound(el, step.compound)) return false;
  if (index === 0) return true;
  if (step.combinator === '>') return el.parentNode && el.parentNode.nodeType === 1 && matchChain(el.parentNode, steps, index - 1);
  for (let p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) if (matchChain(p, steps, index - 1)) return true;
  return false;
}
const matches = (el, selector) => parseSelector(selector).some((steps) => matchChain(el, steps, steps.length - 1));

// ---- elements -----------------------------------------------------------------------------
class Element extends Target {
  constructor(doc, tag) {
    super();
    this.nodeType = 1;
    this.ownerDocument = doc;
    this.localName = tag.toLowerCase();
    this.tagName = tag.toUpperCase();
    this.parentNode = null;
    this.childNodes = [];
    this._attrs = new Map();
    this._value = null;
    this._checked = false;
    this.style = { setProperty() {}, removeProperty() {} };
    const element = this;
    this.classList = {
      add(...names) { element._setClasses([...element._classes(), ...names]); },
      remove(...names) { element._setClasses(element._classes().filter((n) => !names.includes(n))); },
      contains(name) { return element._classes().includes(name); },
      toggle(name, force) {
        const has = element._classes().includes(name);
        const next = force === undefined ? !has : Boolean(force);
        if (next && !has) this.add(name);
        if (!next && has) this.remove(name);
        return next;
      },
    };
    this.dataset = new Proxy({}, {
      get: (_t, key) => (typeof key === 'string' ? element.getAttribute(`data-${kebab(key)}`) ?? undefined : undefined),
      set: (_t, key, value) => { element.setAttribute(`data-${kebab(String(key))}`, value); return true; },
      has: (_t, key) => element.hasAttribute(`data-${kebab(String(key))}`),
      deleteProperty: (_t, key) => { element.removeAttribute(`data-${kebab(String(key))}`); return true; },
    });
  }
  _classes() { return (this.getAttribute('class') || '').split(/\s+/).filter(Boolean); }
  _setClasses(list) { if (list.length) this._attrs.set('class', [...new Set(list)].join(' ')); else this._attrs.delete('class'); }
  _path() {
    const path = [];
    for (let n = this; n; n = n.parentNode) path.push(n);
    const doc = this.ownerDocument;
    if (path[path.length - 1] === doc._root) { path.push(doc); if (doc.defaultView) path.push(doc.defaultView); }
    return path;
  }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get firstElementChild() { return this.children[0] || null; }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get nextSibling() { return this.parentNode ? this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this) + 1] || null : null; }
  get nextElementSibling() { const sibs = this.parentNode ? this.parentNode.children : []; return sibs[sibs.indexOf(this) + 1] || null; }
  get previousElementSibling() { const sibs = this.parentNode ? this.parentNode.children : []; return sibs[sibs.indexOf(this) - 1] || null; }
  getAttribute(name) { return this._attrs.has(name) ? this._attrs.get(name) : null; }
  setAttribute(name, value) {
    this._attrs.set(name, String(value));
    if (name === 'value' && this._value === null && this.localName !== 'select') this._defaultValue = String(value);
  }
  hasAttribute(name) { return this._attrs.has(name); }
  removeAttribute(name) { this._attrs.delete(name); }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(v) {
    this.childNodes.forEach((n) => { n.parentNode = null; });
    this.childNodes = [];
    if (String(v) !== '') this.appendChild(new Text(v));
  }
  get innerHTML() { return this.childNodes.map((n) => serialize(n)).join(''); }
  set innerHTML(html) {
    this.childNodes.forEach((n) => { n.parentNode = null; });
    this.childNodes = [];
    if (this.localName === 'select') this._value = null;
    for (const node of parseFragment(this.ownerDocument, String(html))) this.appendChild(node);
  }
  get outerHTML() { return serialize(this); }
  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }
  insertBefore(node, ref) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    const index = ref ? this.childNodes.indexOf(ref) : -1;
    if (index < 0) this.childNodes.push(node); else this.childNodes.splice(index, 0, node);
    return node;
  }
  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  contains(node) { for (let n = node; n; n = n.parentNode) if (n === this) return true; return false; }
  closest(selector) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (matches(n, selector)) return n; return null; }
  matches(selector) { return matches(this, selector); }
  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => { for (const child of node.children) { if (matches(child, selector)) out.push(child); walk(child); } };
    walk(this);
    return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  _hiddenAncestor() { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (n.hasAttribute('hidden')) return true; return false; }
  focus() {
    if (this.hasAttribute('disabled') || this._hiddenAncestor() || !this.ownerDocument._root.contains(this)) return;
    this.ownerDocument.activeElement = this;
  }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null; }
  scrollIntoView() {}
  click() { return this.ownerDocument.click(this); }
  // form controls ------------------------------------------------------------------------
  get options() { return this.localName === 'select' ? this.querySelectorAll('option') : []; }
  get selectedIndex() {
    const options = this.options;
    if (this._value !== null) return options.findIndex((o) => o.value === this._value);
    const marked = options.findIndex((o) => o.hasAttribute('selected'));
    return marked >= 0 ? marked : (options.length ? 0 : -1);
  }
  set selectedIndex(i) { const o = this.options[i]; this._value = o ? o.value : ''; }
  get value() {
    if (this.localName === 'select') { const o = this.options[this.selectedIndex]; return o ? o.value : ''; }
    if (this.localName === 'option') return this.hasAttribute('value') ? this.getAttribute('value') : this.textContent;
    if (this.localName === 'textarea') return this._value !== null ? this._value : this.textContent;
    return this._value !== null ? this._value : (this._defaultValue ?? this.getAttribute('value') ?? '');
  }
  set value(v) {
    const s = String(v ?? '');
    if (this.localName === 'select') { this._value = this.options.some((o) => o.value === s) ? s : ''; return; }
    this._value = s;
  }
  get checked() { return this._checked; }
  set checked(v) { this._checked = Boolean(v); }
  get form() { return this.closest('form'); }
  get elements() { return this.querySelectorAll('input, select, textarea, button'); }
  reset() { for (const c of this.elements) c._value = null; }
  get selected() { return this.hasAttribute('selected'); }
}
for (const [prop, attr] of Object.entries(REFLECTED)) {
  Object.defineProperty(Element.prototype, prop, { get() { return this.getAttribute(attr) ?? ''; }, set(v) { this.setAttribute(attr, v); }, configurable: true });
}
for (const [prop, attr] of Object.entries(BOOLEAN)) {
  Object.defineProperty(Element.prototype, prop, { get() { return this.hasAttribute(attr); }, set(v) { if (v) this.setAttribute(attr, ''); else this.removeAttribute(attr); }, configurable: true });
}

function serialize(node) {
  if (node.nodeType === 3) return escapeText(node.data);
  const attrs = [...node._attrs].map(([k, v]) => (v === '' && (k in { hidden: 1, disabled: 1, required: 1, selected: 1 }) ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`)).join('');
  if (VOID.has(node.localName)) return `<${node.localName}${attrs}>`;
  return `<${node.localName}${attrs}>${node.childNodes.map(serialize).join('')}</${node.localName}>`;
}

function parseFragment(doc, html) {
  const root = new Element(doc, 'fragment');
  let current = root;
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+|<)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!')) continue;
    if (m[1]) {
      const tag = m[1].toLowerCase();
      for (let n = current; n && n !== root; n = n.parentNode) if (n.localName === tag) { current = n.parentNode; break; }
      continue;
    }
    if (m[2]) {
      const tag = m[2].toLowerCase();
      const el = new Element(doc, tag);
      const attrRe = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
      let a;
      while ((a = attrRe.exec(m[3]))) el.setAttribute(a[1], decodeEntities(a[2] ?? a[3] ?? a[4] ?? ''));
      current.appendChild(el);
      if (RAW.has(tag)) {
        const end = html.toLowerCase().indexOf(`</${tag}`, re.lastIndex);
        const stop = end < 0 ? html.length : end;
        if (stop > re.lastIndex) el.appendChild(new Text(html.slice(re.lastIndex, stop)));
        const close = html.indexOf('>', stop);
        re.lastIndex = close < 0 ? html.length : close + 1;
      } else if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) current = el;
      continue;
    }
    if (m[4]) current.appendChild(new Text(decodeEntities(m[4])));
  }
  return [...root.childNodes].map((n) => { n.parentNode = null; return n; });
}

class Document extends Target {
  constructor() {
    super();
    this.nodeType = 9;
    this.activeElement = null;
    this.defaultView = null;
    this.readyState = 'complete';
    this.cookie = '';
    this._root = new Element(this, 'html');
    this.documentElement = this._root;
    this.body = new Element(this, 'body');
    this._root.appendChild(this.body);
    this.title = '';
  }
  _path() { return [this, this.defaultView].filter(Boolean); }
  createElement(tag) { return new Element(this, tag); }
  createTextNode(text) { return new Text(text); }
  getElementById(id) { return this._root.querySelector(`#${id}`); }
  querySelector(selector) { return this._root.querySelector(selector); }
  querySelectorAll(selector) { return this._root.querySelectorAll(selector); }
  // Click with the default actions the pages rely on (submit buttons, no navigation).
  click(el) {
    if (el.hasAttribute('disabled')) return null;
    const event = new Event('click', { target: el, detail: 1 });
    el.dispatchEvent(event);
    if (!event.defaultPrevented) {
      const submit = el.closest('button, input');
      if (submit && submit.form && (submit.getAttribute('type') || (submit.localName === 'button' ? 'submit' : '')) === 'submit') {
        const submitEvent = new Event('submit', { target: submit.form });
        submit.form.dispatchEvent(submitEvent);
        return Promise.all(submitEvent._pending || []).then(() => submitEvent);
      }
    }
    return Promise.all(event._pending || []).then(() => event);
  }
}

export function loadHtml(html) {
  const doc = new Document();
  const nodes = parseFragment(doc, html);
  const find = (list, tag) => { for (const n of list) { if (n.nodeType !== 1) continue; if (n.localName === tag) return n; const hit = find(n.childNodes, tag); if (hit) return hit; } return null; };
  const htmlEl = find(nodes, 'html');
  const body = find(htmlEl ? htmlEl.childNodes : nodes, 'body');
  const head = find(htmlEl ? htmlEl.childNodes : nodes, 'head');
  doc._root = htmlEl || doc._root;
  doc._root.ownerDocument = doc;
  doc.documentElement = doc._root;
  if (body) doc.body = body;
  doc.head = head;
  doc.title = head && head.querySelector('title') ? head.querySelector('title').textContent : '';
  return doc;
}

export const tick = () => new Promise((resolve) => setImmediate(resolve));
export async function settle(times = 4) { for (let i = 0; i < times; i += 1) await tick(); }
export function deferred() {
  let resolveFn; let rejectFn;
  const promise = new Promise((res, rej) => { resolveFn = res; rejectFn = rej; });
  return { promise, resolve: resolveFn, reject: rejectFn };
}
export function jsonResponse(body, { ok = true, status } = {}) {
  return { ok, status: status ?? (ok ? 200 : 500), async json() { if (body instanceof Error) throw body; return body; } };
}
export const badJsonResponse = (ok = true) => ({ ok, status: ok ? 200 : 500, async json() { throw new SyntaxError('Unexpected token'); } });

function makeStorage(initial) {
  const store = new Map(initial || []);
  return {
    store,
    failWrites: false,
    failReads: false,
    getItem(key) { if (this.failReads) throw new Error('blocked'); return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { if (this.failWrites) throw new Error('quota'); store.set(key, String(value)); },
    removeItem(key) { if (this.failWrites) throw new Error('blocked'); store.delete(key); },
  };
}

export const FIXED_NOW = '2026-11-19T12:00:00+09:00';
function fixedDate(iso) {
  const ms = Date.parse(iso);
  return class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [ms])); }
    static now() { return ms; }
  };
}

/**
 * Load a real page (HTML file) and run its real scripts in order inside one vm context.
 * options: root, file, url, fetch, scripts (default: the page's own <script src> list;
 * pass `skip` names to leave some out), local/session storage, now.
 */
export function loadPage({ root = process.cwd(), file, url, fetch, now = FIXED_NOW, localStorage, sessionStorage, skip = [], only = null, extraGlobals = {}, runScripts = true }) {
  const abs = resolve(root, file);
  const doc = loadHtml(readFileSync(abs, 'utf8'));
  const pageUrl = new URL(url || `https://1212hp.example/${file.replace(/index\.html$/, '')}`);
  const winTarget = new Target();
  const fetchCalls = [];
  const location = {
    href: pageUrl.href,
    get pathname() { return new URL(this.href).pathname; },
    get search() { return new URL(this.href).search; },
    get hash() { return new URL(this.href).hash; },
    get origin() { return pageUrl.origin; },
    assigned: [],
    replaced: [],
    assign(value) { this.assigned.push(String(value)); },
    replace(value) { this.replaced.push(String(value)); },
    toString() { return this.href; },
  };
  const ls = localStorage || makeStorage();
  const ss = sessionStorage || makeStorage();
  const context = vm.createContext({
    console, URL, URLSearchParams, structuredClone, setTimeout, clearTimeout, Date: fixedDate(now),
    document: doc,
    location,
    localStorage: ls,
    sessionStorage: ss,
    fetch: (u, o = {}) => { fetchCalls.push({ url: String(u), method: (o.method || 'GET').toUpperCase(), options: o, body: o.body ? JSON.parse(o.body) : null }); return fetch(String(u), o, fetchCalls[fetchCalls.length - 1]); },
    ...extraGlobals,
  });
  context.window = context;
  context.globalThis = context;
  doc.defaultView = winTarget;
  for (const m of ['addEventListener', 'removeEventListener', 'dispatchEvent', 'listenerCount']) context[m] = winTarget[m].bind(winTarget);
  winTarget._path = () => [winTarget];
  winTarget.document = doc;
  const page = {
    context, window: context, document: doc, location, fetchCalls, localStorage: ls, sessionStorage: ss, winTarget,
    run(srcPath) {
      const source = readFileSync(resolve(root, srcPath), 'utf8');
      vm.runInContext(source, context, { filename: srcPath });
    },
    scriptList() {
      return [...doc.querySelectorAll('script')].map((s) => s.getAttribute('src')).filter(Boolean)
        .map((src) => ({ src, path: join(dirname(file), src.split('?')[0]) }));
    },
    fire(type, init = {}) {
      const event = new Event(type, init);
      winTarget.dispatchEvent(event);
      return event;
    },
  };
  if (runScripts) {
    for (const { src, path } of page.scriptList()) {
      const name = src.split('?')[0].split('/').pop();
      if (skip.includes(name) || (only && !only.includes(name))) continue;
      page.run(path);
    }
  }
  return page;
}

export { Event, Element };

// ---- fixture helpers ----------------------------------------------------------------------
export function loadFixture(root = process.cwd()) {
  return JSON.parse(readFileSync(join(root, 'test/fixtures/live-ticket-states.json'), 'utf8'));
}
function setPath(target, dotted, value) {
  const keys = dotted.split('.');
  let node = target;
  for (const key of keys.slice(0, -1)) node = node[key];
  node[keys[keys.length - 1]] = structuredClone(value);
}
function appendPath(target, dotted, items) {
  const keys = dotted.split('.');
  let node = target;
  for (const key of keys) node = node[key];
  node.push(...structuredClone(items));
}
/** Fresh deep copy of the fixture data with one or more named scenarios applied in order. */
export function buildData(fixture, ...names) {
  const data = structuredClone(fixture.data);
  for (const name of names) {
    const scenario = fixture.scenarios[name];
    if (!scenario) throw new Error(`unknown scenario ${name}`);
    for (const [path, value] of Object.entries(scenario.set || {})) setPath(data, path, value);
    for (const [path, items] of Object.entries(scenario.append || {})) appendPath(data, path, items);
  }
  return data;
}
export const envelope = (data, updatedAt = '2026-11-18T00:00:00.000Z') => ({ data, meta: { updatedAt } });
