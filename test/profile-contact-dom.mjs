// Minimal DOM boundary for the Issue #45 tests. It parses the shipped HTML and runs the shipped scripts;
// it does not supply Profile or Contact markup, and it never touches the network (fetch is injected).
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

export const BASE = 'ba124011ce5e0ae56ddb1c6ac47d1783600687b4';
export const read = path => readFileSync(path, 'utf8');
export const atBase = path => execFileSync('git', ['show', `${BASE}:${path}`], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
export const settle = async (times = 4) => { for (let i = 0; i < times; i++) await new Promise(resolve => setImmediate(resolve)); };

const VOID = new Set(['meta', 'link', 'img', 'br', 'input', 'hr', 'source']);
const decode = value => String(value).replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const escapeText = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = value => escapeText(value).replace(/"/g, '&quot;');
const kebab = key => String(key).replace(/[A-Z]/g, char => '-' + char.toLowerCase());
const camel = key => String(key).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
// WHATWG "valid e-mail address" grammar (what type=email uses for validity.typeMismatch).
const EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function parseCompound(text) {
  const compound = {tag: null, id: null, classes: [], attrs: []};
  let rest = text, match = rest.match(/^[a-zA-Z][\w-]*/);
  if (match) { compound.tag = match[0].toUpperCase(); rest = rest.slice(match[0].length); }
  while (rest) {
    if ((match = rest.match(/^#([\w-]+)/))) compound.id = match[1];
    else if ((match = rest.match(/^\.([\w-]+)/))) compound.classes.push(match[1]);
    else if ((match = rest.match(/^\[([\w:-]+)(?:(=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/))) compound.attrs.push({name: match[1], value: match[2] ? (match[3] ?? match[4] ?? match[5]) : undefined});
    else throw new Error('unsupported selector: ' + text);
    rest = rest.slice(match[0].length);
  }
  return compound;
}
function compoundMatches(el, compound) {
  if (compound.tag && el.tagName !== compound.tag) return false;
  if (compound.id && el.id !== compound.id) return false;
  if (!compound.classes.every(name => el.classList.contains(name))) return false;
  return compound.attrs.every(attr => el.hasAttribute(attr.name) && (attr.value === undefined || el.getAttribute(attr.name) === attr.value));
}
function selectorMatches(el, selector) {
  return selector.split(',').some(group => {
    const parts = group.trim().split(/\s+/).filter(Boolean);
    const test = (node, index) => {
      if (!node || node.nodeType !== 1 || !compoundMatches(node, parseCompound(parts[index]))) return false;
      if (index === 0) return true;
      for (let ancestor = node.parentNode; ancestor; ancestor = ancestor.parentNode) if (test(ancestor, index - 1)) return true;
      return false;
    };
    return test(el, parts.length - 1);
  });
}

class Text {
  constructor(data) { this.nodeType = 3; this.data = data; this.parentNode = null; }
  get textContent() { return this.data; }
}

class Element {
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.attrs = new Map();
    this.childNodes = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.style = {setProperty() {}, removeProperty() {}};
    this._value = null;
    this.resetCalls = 0;
    const self = this;
    this.dataset = new Proxy({}, {
      get: (_, key) => self.attrs.get('data-' + kebab(key)),
      set: (_, key, value) => { self.setAttribute('data-' + kebab(key), value); return true; },
      deleteProperty: (_, key) => { self.attrs.delete('data-' + kebab(key)); return true; },
      has: (_, key) => self.attrs.has('data-' + kebab(key)),
      ownKeys: () => [...self.attrs.keys()].filter(name => name.startsWith('data-')).map(name => camel(name.slice(5))),
      getOwnPropertyDescriptor: (_, key) => (self.attrs.has('data-' + kebab(key)) ? {enumerable: true, configurable: true, value: self.attrs.get('data-' + kebab(key))} : undefined),
    });
    this.classList = {
      add: (...names) => this._setClasses([...this._classes(), ...names]),
      remove: (...names) => this._setClasses(this._classes().filter(name => !names.includes(name))),
      contains: name => this._classes().includes(name),
      toggle: (name, force) => { const has = this._classes().includes(name); const want = force ?? !has; if (want) this.classList.add(name); else this.classList.remove(name); return want; },
    };
  }
  _classes() { return (this.attrs.get('class') || '').split(/\s+/).filter(Boolean); }
  _setClasses(list) { this.attrs.set('class', [...new Set(list)].join(' ')); }
  get id() { return this.attrs.get('id') || ''; }
  set id(value) { this.setAttribute('id', value); }
  get className() { return this.attrs.get('class') || ''; }
  set className(value) { this.setAttribute('class', value); }
  get hidden() { return this.attrs.has('hidden'); }
  set hidden(value) { if (value) this.attrs.set('hidden', ''); else this.attrs.delete('hidden'); }
  get disabled() { return this.attrs.has('disabled'); }
  set disabled(value) { if (value) this.attrs.set('disabled', ''); else this.attrs.delete('disabled'); }
  get readOnly() { return this.attrs.has('readonly'); }
  set readOnly(value) { if (value) this.attrs.set('readonly', ''); else this.attrs.delete('readonly'); }
  get type() { return this.attrs.get('type') || (this.tagName === 'BUTTON' ? 'submit' : 'text'); }
  get name() { return this.attrs.get('name') || ''; }
  get value() {
    if (this._value !== null) return this._value;
    if (this.tagName === 'TEXTAREA') return this.textContent;
    return this.attrs.get('value') || '';
  }
  set value(next) { this._value = String(next); }
  get validity() {
    const text = this.value.trim();
    return {typeMismatch: this.tagName === 'INPUT' && this.type === 'email' && text !== '' && !EMAIL.test(text)};
  }
  get children() { return this.childNodes.filter(node => node.nodeType === 1); }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get isConnected() { for (let node = this; node; node = node.parentNode) if (node === this.ownerDocument.documentElement) return true; return false; }
  get textContent() { return this.childNodes.map(node => node.textContent).join(''); }
  set textContent(value) {
    this.childNodes.forEach(node => { node.parentNode = null; });
    this.childNodes = [];
    const text = String(value ?? '');
    if (text) { const node = new Text(text); node.parentNode = this; this.childNodes.push(node); }
  }
  get innerHTML() {
    return this.childNodes.map(node => {
      if (node.nodeType === 3) return escapeText(node.data);
      const attrs = [...node.attrs].map(([key, value]) => (value === '' ? ` ${key}` : ` ${key}="${escapeAttr(value)}"`)).join('');
      const tag = node.tagName.toLowerCase();
      return VOID.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>${node.innerHTML}</${tag}>`;
    }).join('');
  }
  set innerHTML(html) {
    this.childNodes.forEach(node => { node.parentNode = null; });
    this.childNodes = [];
    parseInto(this.ownerDocument, this, String(html));
  }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  hasAttribute(name) { return this.attrs.has(name); }
  removeAttribute(name) { this.attrs.delete(name); }
  appendChild(child) { if (child.parentNode) child.parentNode.childNodes = child.parentNode.childNodes.filter(node => node !== child); child.parentNode = this; this.childNodes.push(child); return child; }
  remove() { if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter(node => node !== this); this.parentNode = null; }
  contains(other) { for (let node = other; node; node = node.parentNode) if (node === this) return true; return false; }
  descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
  matches(selector) { return selectorMatches(this, selector); }
  closest(selector) { for (let node = this; node && node.nodeType === 1; node = node.parentNode) if (selectorMatches(node, selector)) return node; return null; }
  querySelectorAll(selector) { return this.descendants().filter(node => selectorMatches(node, selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, listener) { const list = this.listeners.get(type) || []; list.push(listener); this.listeners.set(type, list); }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
  dispatch(type, init = {}) {
    const event = {type, target: this, currentTarget: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...init};
    const bubbles = !['error', 'load'].includes(type);
    for (let node = this; node && node.listeners; node = bubbles ? node.parentNode : null) {
      event.currentTarget = node;
      for (const listener of node.listeners.get(type) || []) listener(event);
    }
    return event;
  }
  focus() { if (this.isConnected && !this.disabled) { this.ownerDocument.activeElement = this; this.ownerDocument.focusLog.push(this); } }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null; }
  reset() { this.resetCalls += 1; }
  scrollIntoView() {}
  getBoundingClientRect() { return {left: 0, top: 0, width: 100, height: 30}; }
}

function parseInto(doc, parent, html) {
  const stack = [parent];
  const token = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([\w-]+)\s*>|<([\w-]+)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>|([^<]+)/gi;
  for (const match of html.matchAll(token)) {
    if (match[0].startsWith('<!')) continue;
    if (match[4] !== undefined) { const text = new Text(decode(match[4])); text.parentNode = stack.at(-1); stack.at(-1).childNodes.push(text); continue; }
    if (match[1]) {
      const index = stack.map(node => node.tagName).lastIndexOf(match[1].toUpperCase());
      if (index > 0) stack.length = index;
      continue;
    }
    const element = new Element(doc, match[2]);
    for (const attr of match[3].matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) element.attrs.set(attr[1], decode(attr[2] ?? attr[3] ?? attr[4] ?? ''));
    element.parentNode = stack.at(-1);
    stack.at(-1).childNodes.push(element);
    if (!VOID.has(match[2].toLowerCase()) && !match[0].endsWith('/>')) stack.push(element);
  }
}

export class FakeFormData {
  constructor(form) {
    this.list = [];
    for (const el of form.querySelectorAll('input, textarea, select')) if (el.getAttribute('name') && !el.disabled) this.list.push([el.getAttribute('name'), String(el.value)]);
  }
  entries() { return this.list[Symbol.iterator](); }
  keys() { return this.list.map(pair => pair[0])[Symbol.iterator](); }
  get(key) { const pair = this.list.find(item => item[0] === key); return pair ? pair[1] : null; }
  getAll(key) { return this.list.filter(item => item[0] === key).map(item => item[1]); }
  [Symbol.iterator]() { return this.entries(); }
}

export function fakeTimers() {
  const list = [];
  let next = 1;
  return {
    list,
    setTimeout(fn, ms) { const id = next++; list.push({id, fn, ms, cleared: false, fired: false}); return id; },
    clearTimeout(id) { const timer = list.find(item => item.id === id); if (timer) timer.cleared = true; },
    pending() { return list.filter(item => !item.cleared && !item.fired); },
    fire(ms) { for (const timer of list.filter(item => !item.cleared && !item.fired && (ms === undefined || item.ms === ms))) { timer.fired = true; timer.fn(); } },
  };
}

// Loads real HTML text and runs real script sources in order. `fetch` receives (url, init) and must return a promise.
export function loadPage({html, pathname, sources, fetch, timers, search = '', hash = ''}) {
  const doc = {activeElement: null, focusLog: [], listeners: new Map(), documentElement: null, body: null};
  doc.documentElement = new Element(doc, 'html');
  doc.createElement = tag => new Element(doc, tag);
  doc.getElementById = id => doc.documentElement.descendants().find(node => node.id === id) || null;
  doc.querySelector = selector => doc.documentElement.querySelector(selector);
  doc.querySelectorAll = selector => doc.documentElement.querySelectorAll(selector);
  doc.addEventListener = (type, listener) => { const list = doc.listeners.get(type) || []; list.push(listener); doc.listeners.set(type, list); };
  const bodyTag = html.match(/<body\b([^>]*)>/i);
  const body = new Element(doc, 'body');
  for (const attr of (bodyTag ? bodyTag[1] : '').matchAll(/([^\s"'<>/=]+)(?:\s*=\s*"([^"]*)")?/g)) body.attrs.set(attr[1], decode(attr[2] ?? ''));
  doc.body = body;
  body.parentNode = doc.documentElement;
  doc.documentElement.childNodes.push(body);
  parseInto(doc, body, html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)[1]);

  const calls = [];
  const windowListeners = new Map();
  const window = {
    SITE_API_BASE: '',
    location: {href: 'http://localhost' + pathname + search + hash, pathname, search, hash},
    innerWidth: 390,
    matchMedia: () => ({matches: true}),
    addEventListener(type, listener) { const list = windowListeners.get(type) || []; list.push(listener); windowListeners.set(type, list); },
  };
  const context = {
    window, document: doc, URL, URLSearchParams, console, FormData: FakeFormData,
    setTimeout: timers ? timers.setTimeout : setTimeout,
    clearTimeout: timers ? timers.clearTimeout : clearTimeout,
    fetch: (url, init) => { calls.push({url, init}); return fetch(url, init); },
  };
  context.globalThis = window;
  vm.createContext(context);
  for (const code of sources) vm.runInContext(code, context);
  return {
    document: doc, window, context, calls, timers, body,
    $: id => doc.getElementById(id),
    emitDocument(type) { for (const listener of doc.listeners.get(type) || []) listener({type}); },
    emitWindow(type, event = {}) { for (const listener of windowListeners.get(type) || []) listener({type, ...event}); },
    windowListenerCount: type => (windowListeners.get(type) || []).length,
  };
}

export const okJson = body => Promise.resolve({ok: true, status: 200, json: async () => body});
export const failStatus = status => Promise.resolve({ok: false, status, json: async () => ({})});

// Fixture scenarios are declarative: {set: {"a.b": value}} patches a clone of data; {response} picks the HTTP outcome.
export const fixture = JSON.parse(read('test/fixtures/profile-contact-states.json'));
export function scenarioData(name = 'base') {
  const data = structuredClone(fixture.data);
  const scenario = fixture.scenarios[name];
  if (!scenario) throw new Error('unknown scenario ' + name);
  for (const [path, value] of Object.entries(scenario.set || {})) {
    const keys = path.split('.');
    const last = keys.pop();
    const holder = keys.reduce((node, key) => node[key], data);
    holder[last] = structuredClone(value);
  }
  return data;
}
export function scenarioFetch(name = 'base') {
  const scenario = fixture.scenarios[name];
  if (scenario.response === 'pending') return () => new Promise(() => {});
  if (scenario.response === 'http-error') return () => failStatus(scenario.status);
  return () => okJson({data: scenarioData(name), meta: fixture.meta});
}
