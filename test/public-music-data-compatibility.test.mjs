import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { loadPage, settle as settleDom, jsonResponse } from './support/dom-harness.mjs';
const renderer=readFileSync('assets/js/site-content.js','utf8');
const liveHelper=readFileSync('assets/js/live-operations.js','utf8');
const musicHelper=readFileSync('assets/js/music-data.js','utf8');
function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function createElement(id, tagName = 'div') {
  const listeners = new Map();
  const classes = new Set();
  const attributes = new Map();
  let html = '';
  let currentValue = '';
  const element = {
    id,
    tagName: tagName.toUpperCase(),
    style: {},
    dataset: {},
    hidden: false,
    disabled: false,
    required: false,
    checked: false,
    textContent: '',
    options: [],
    selectedIndex: -1,
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        if (force === true || (force === undefined && !classes.has(name))) classes.add(name);
        else classes.delete(name);
        return classes.has(name);
      },
    },
    addEventListener(type, listener) {
      const group = listeners.get(type) || [];
      group.push(listener);
      listeners.set(type, group);
    },
    async dispatch(type, init = {}) {
      const event = {
        type,
        target: element,
        currentTarget: element,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        ...init,
      };
      for (const listener of listeners.get(type) || []) await listener(event);
      return event;
    },
    setAttribute(name, value) {
      const normalized = String(value);
      attributes.set(name, normalized);
      if (name === 'href' || name === 'target' || name === 'rel') element[name] = normalized;
      if (name === 'aria-hidden') element.ariaHidden = normalized;
      if (name === 'placeholder') element.placeholder = normalized;
    },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === 'href' || name === 'target' || name === 'rel' || name === 'src') delete element[name];
    },
    querySelector() { return null; },
    closest() { return null; },
    reset() {},
  };

  Object.defineProperty(element, 'innerHTML', {
    configurable: true,
    get() { return html; },
    set(value) {
      html = String(value);
      if (element.tagName !== 'SELECT') return;
      element.options = [...html.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((match) => {
        const attrs = match[1];
        const valueMatch = attrs.match(/\bvalue="([^"]*)"/i);
        return {
          value: decodeHtml(valueMatch ? valueMatch[1] : ''),
          textContent: decodeHtml(match[2].replace(/<[^>]*>/g, '')),
          disabled: /\bdisabled(?:\s|>|$)/i.test(attrs),
          selected: /\bselected(?:\s|>|$)/i.test(attrs),
        };
      });
      const selectedIndex = element.options.findIndex((option) => option.selected);
      element.selectedIndex = selectedIndex >= 0 ? selectedIndex : (element.options.length ? 0 : -1);
      currentValue = element.selectedIndex >= 0 ? element.options[element.selectedIndex].value : '';
    },
  });
  Object.defineProperty(element, 'value', {
    configurable: true,
    get() { return currentValue; },
    set(value) {
      const normalized = String(value ?? '');
      if (element.tagName !== 'SELECT') {
        currentValue = normalized;
        return;
      }
      const index = element.options.findIndex((option) => option.value === normalized);
      element.selectedIndex = index;
      currentValue = index >= 0 ? normalized : '';
    },
  });
  element.forceValue = (value) => { currentValue = String(value); };
  return element;
}

function createDom(spec = {}) {
  const elements = new Map();
  const tagById = spec.tagById || {};
  for (const id of spec.ids || []) elements.set(id, createElement(id, tagById[id] || 'div'));
  const document = {
    title: '',
    body: createElement('body', 'body'),
    getElementById(id) { return elements.get(id) || null; },
    querySelectorAll() { return []; },
  };
  return { document, elements };
}

function response(json, ok = true) {
  return { ok, async json() { return json; } };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}


const fixture = {
  site:{heroImage:'assets/images/synthetic-hero.jpg',footerText:'Synthetic footer',links:{bandcamp:'https://example.test/music'}},
  discography:{digital:[{id:'r',title:'Synthetic title',releaseDate:'2025.5.5',description:'Synthetic track list',image:'assets/images/synthetic-release.jpg',link:'https://example.test/r'},{id:'s',title:'Second synthetic title',releaseDate:'2026.01.01'}],demo:[{id:'t',title:'Synthetic demo',releaseDate:'2025/05/05',description:'Synthetic demo description'}]},
  news:[{id:'n',title:'Synthetic news',date:'2026.01.01',description:'Synthetic news description',link:'https://example.test/news'}],
  live:{upcoming:[{id:'l',date:'2099.01.01',title:'Synthetic live',venue:'Synthetic venue',description:'Synthetic description only Live',image:'assets/images/synthetic-live.jpg'}],past:[{id:'p',date:'2000.01.01',description:'Synthetic past description only'}]},
  youtube:{musicVideos:[{id:'v',title:'Synthetic video',youtubeId:'abcdefghijk'}],liveMovies:[],demos:[]}
};
async function render(data,envelope,helper,pathname,detailId) {
  const page = pathname === '/' ? 'index.html' : pathname.slice(1) + 'index.html';
  const ids=[...readFileSync(page,'utf8').matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  if(detailId)ids.push('live-detail','live-detail-title','live-detail-heading','live-detail-description','live-detail-single','live-detail-notfound');
  const {document,elements}=createDom({ids});
  const window={SITE_API_BASE:'',location:{pathname,search:detailId?'?liveId='+detailId:''},addEventListener(){}};
  const context={document,window,globalThis:window,console,URL,URLSearchParams,structuredClone,setTimeout,clearTimeout,fetch:async()=>response(envelope?{data,meta:{updatedAt:'fixed-version'}}:data)};
  vm.runInNewContext(liveHelper,context);
  if(helper)vm.runInNewContext(musicHelper,context);
  vm.runInNewContext(renderer,context);await settle();
  return Object.fromEntries([...elements].map(([id,e])=>[id,{html:e.innerHTML,text:e.textContent,src:e.src,href:e.href,display:e.style.display}]));
}
// Issue #43 moved the Live and Live detail checks to the new live-pages.js rendering (below); Profile and Contact keep the shared renderer.
for(const envelope of [false,true]) for(const pathname of ['/profile/','/contact/']) test('music fields public DOM unchanged for missing, empty and populated fields '+pathname+' '+(envelope?'envelope':'body'),async()=>{
  const base=await render(fixture,envelope,false,pathname);
  for(const populated of [false,true]) {
    const data=structuredClone(fixture);data.site.featuredReleaseId=populated?'s':'';
    for(const item of [...data.discography.digital,...data.discography.demo]){item.playbackVideoId=populated?'v':'';item.releaseType=populated?'Synthetic new type':'';}
    assert.deepEqual(await render(data,envelope,true,pathname),base);
  }
  // Home's intentional change is covered by T42-DATA/PLAY/CONTENT. These
  // routes protect actual page DOM rather than fabricated Home-only hooks.
});

// Issue #43: the same compatibility checks, now against the real Live and Live detail pages (live-pages.js).
async function renderLivePage(data,envelope,file,url){
  const page=loadPage({file,url:'https://1212hp.example'+url,skip:['script.js'],fetch:async()=>jsonResponse(envelope?{data,meta:{updatedAt:'fixed-version'}}:data)});
  await settleDom();
  const main=page.document.querySelector('main');
  return {html:main.innerHTML,state:main.getAttribute('data-state'),title:page.document.title};
}
for(const envelope of [false,true]) test('music fields public DOM unchanged for missing, empty and populated fields /live/ '+(envelope?'envelope':'body'),async()=>{
  const base=await renderLivePage(fixture,envelope,'live/index.html','/live/');
  assert.equal(base.state,'ready');
  for(const populated of [false,true]) {
    const data=structuredClone(fixture);data.site.featuredReleaseId=populated?'s':'';
    for(const item of [...data.discography.digital,...data.discography.demo]){item.playbackVideoId=populated?'v':'';item.releaseType=populated?'Synthetic new type':'';}
    assert.deepEqual(await renderLivePage(data,envelope,'live/index.html','/live/'),base);
  }
  assert.match(base.html,/Synthetic description only Live/);
  assert.match(base.html,/liveId=p/);
});
for(const id of ['l','p']) test('music fields description-only Live detail keeps legacy text '+id,async()=>{
  const before=await renderLivePage(fixture,true,'live/detail/index.html','/live/detail/?liveId='+id);
  const data=structuredClone(fixture);data.site.featuredReleaseId='r';data.discography.digital[0].releaseType='Single';data.discography.digital[0].playbackVideoId='v';
  assert.deepEqual(await renderLivePage(data,true,'live/detail/index.html','/live/detail/?liveId='+id),before);
  assert.equal(before.state,'ready');
  assert.match(before.html,id==='p'?/Synthetic past description only/:/Synthetic description only Live/);
  assert.match(before.html,/data-testid="live-detail-description"/);
});
test('unaligned legacy dates keep rendering on the Live page and the detail heading',async()=>{
  const data=structuredClone(fixture);data.live.upcoming[0].date='2099.1.2(Fri.)';
  const list=await renderLivePage(data,true,'live/index.html','/live/');
  assert.match(list.html,/2099\.01\.02\(Fri\)/);
  const detail=await renderLivePage(data,true,'live/detail/index.html','/live/detail/?liveId=l');
  assert.match(detail.html,/2099\.01\.02\(Fri\)/);
});

for(const route of ['discography','youtube']) test('music compatibility legacy route retains static link and drops old data renderer '+route,()=>{
  const html=readFileSync(route+'/index.html','utf8');
  assert.match(html,/href="..\/music\/#(?:release|video)"/);
  assert.match(html,/music-redirect.js/);assert.doesNotMatch(html,/site-content.js|disc-digital-items|youtube-content/);
  // Exact replacement, query/hash disposal and JS-disabled arrival are T44-LEGACY.
});
