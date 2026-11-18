import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function setup() {
  const events = new Map();
  let focused=null;
  function element() {
    const attrs=new Map(),listeners=new Map(),classes=new Set();
    const e={children:[],hidden:true,textContent:'',classList:{add(n){classes.add(n);},remove(n){classes.delete(n);},contains(n){return classes.has(n);}},setAttribute(k,v){attrs.set(k,String(v));},getAttribute(k){return attrs.get(k);},appendChild(c){c.remove();e.children.push(c);c.parentNode=e;},insertBefore(c,reference){c.remove();const index=e.children.indexOf(reference);e.children.splice(index<0?e.children.length:index,0,c);c.parentNode=e;},remove(){if(e.parentNode)e.parentNode.children=e.parentNode.children.filter(c=>c!==e);e.parentNode=null;},focus(){focused=e;},addEventListener(t,fn){listeners.set(t,fn);},dispatch(t){listeners.get(t)?.();}};
    Object.defineProperty(e,'nextSibling',{get(){return e.parentNode?.children[e.parentNode.children.indexOf(e)+1]||null;}});
    return e;
  }
  const document={createElement:element};
  const window={addEventListener(t,fn){events.set(t,fn);}};
  if(existsSync('assets/js/home-player.js'))vm.runInNewContext(readFileSync('assets/js/home-player.js','utf8'),{window,document});
  const button=element(),host=element(),section=element(),featured=element(),title=element(),meta=element(),actions=element();host.id='home-player';button.textContent='聴く';button.classList.add('site-button--play');
  section.appendChild(featured);section.appendChild(host);featured.appendChild(title);featured.appendChild(meta);featured.appendChild(actions);actions.appendChild(button);
  button.addEventListener('click',()=>button.getAttribute('aria-expanded')==='true' ? window.HomePlayer.close() : window.HomePlayer.open(host,button,'abcdefghijk','Synthetic title'));
  return {window,button,host,section,featured,title,meta,actions,focused:()=>focused,events};
}
test('T42-PLAY click inserts exactly one unmuted iframe synchronously',()=>{
  const h=setup();assert.ok(h.window.HomePlayer,'HomePlayer must exist');
  h.button.dispatch('click');assert.equal(h.host.children.length,1);
  const frame=h.host.children[0];
  assert.equal(frame.src,'https://www.youtube.com/embed/abcdefghijk?autoplay=1&playsinline=1&controls=1&rel=0');
  assert.equal(frame.getAttribute('allow'),'autoplay; encrypted-media; picture-in-picture; fullscreen');
  assert.equal(frame.getAttribute('allowfullscreen'),'');
  assert.equal(frame.getAttribute('referrerpolicy'),'strict-origin-when-cross-origin');
  assert.match(frame.title,/Synthetic title/);assert.doesNotMatch(frame.src,/mute/);
  assert.equal(h.button.getAttribute('aria-expanded'),'true');assert.equal(h.button.getAttribute('aria-controls'),'home-player');assert.equal(h.host.hidden,false);
  assert.equal(h.button.getAttribute('data-testid'),'home-close');
});
test('T42-PLAY close blanks then removes iframe, restores action and focus',()=>{
  const h=setup();assert.ok(h.window.HomePlayer);h.button.dispatch('click');const frame=h.host.children[0];h.button.dispatch('click');
  assert.equal(frame.src,'about:blank');assert.equal(h.host.children.length,0);assert.equal(h.host.hidden,true);assert.equal(h.button.getAttribute('aria-expanded'),'false');assert.match(h.button.textContent,/聴く/);assert.equal(h.focused(),h.button);
  assert.equal(h.button.getAttribute('data-testid'),'home-listen');
  h.button.dispatch('click');assert.equal(h.host.children.length,1);
});
test('T42-PLAY re-open replaces previous iframe and pagehide stops without focus',()=>{
  const h=setup();assert.ok(h.window.HomePlayer);h.button.dispatch('click');const old=h.host.children[0];
  h.window.HomePlayer.open(h.host,h.button,'lmnopqrstuv','Second');assert.equal(h.host.children.length,1);assert.equal(old.src,'about:blank');
  h.events.get('pagehide')();assert.equal(h.host.children.length,0);assert.equal(h.focused(),null);h.window.HomePlayer.close();assert.equal(h.host.children.length,0);
});
for(const id of ['', 'short', 'abcdefghij!', 'abcdefghijk/evil'])test('T42-PLAY refuses invalid youtube id '+id,()=>{
  const h=setup();assert.ok(h.window.HomePlayer);h.window.HomePlayer.open(h.host,h.button,id,'Invalid');assert.equal(h.host.children.length,0);
});
test('RV42-02 player sits after metadata before horizontal actions and close restores DOM classes focus',()=>{
  const h=setup();h.button.dispatch('click');
  assert.equal(h.host.parentNode,h.featured);
  assert.deepEqual(h.featured.children,[h.title,h.meta,h.host,h.actions]);
  assert.equal(h.button.classList.contains('site-button--secondary'),true);
  assert.equal(h.button.classList.contains('site-button--play'),false);
  assert.equal(h.actions.classList.contains('home-release-actions--playing'),true);
  h.button.dispatch('click');
  assert.deepEqual(h.section.children,[h.featured,h.host]);
  assert.deepEqual(h.featured.children,[h.title,h.meta,h.actions]);
  assert.equal(h.button.classList.contains('site-button--secondary'),false);
  assert.equal(h.button.classList.contains('site-button--play'),true);
  assert.equal(h.actions.classList.contains('home-release-actions--playing'),false);
  assert.equal(h.focused(),h.button);
  h.button.dispatch('click');h.events.get('pagehide')();assert.equal(h.host.parentNode,h.section);
  assert.equal(h.button.classList.contains('site-button--play'),true);
});
