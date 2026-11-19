import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function setup() {
  let focused=null;const events=new Map(),frames=[];
  function element(){const attrs=new Map(),classes=new Set();const e={id:'',children:[],hidden:false,textContent:'',classList:{add(n){classes.add(n);},remove(n){classes.delete(n);},contains(n){return classes.has(n);}},setAttribute(k,v){attrs.set(k,String(v));},getAttribute(k){return attrs.get(k)??null;},removeAttribute(k){attrs.delete(k);},appendChild(c){c.remove();e.children.push(c);c.parentNode=e;},insertBefore(c,ref){c.remove();const i=e.children.indexOf(ref);e.children.splice(i<0?e.children.length:i,0,c);c.parentNode=e;},remove(){if(e.parentNode)e.parentNode.children=e.parentNode.children.filter(c=>c!==e);e.parentNode=null;},focus(){focused=e;}};Object.defineProperty(e,'nextSibling',{get(){const a=e.parentNode?.children||[];return a[a.indexOf(e)+1]||null;}});return e;}
  const document={createElement(){const e=element();frames.push(e);return e;}};
  const window={addEventListener(t,f){events.set(t,f);}};
  vm.runInNewContext(readFileSync('assets/js/home-player.js','utf8'),{document,window});
  function adapter(mode='release',id='abcdefghijk'){
    const article=element(),host=element(),trigger=element(),closeButton=mode==='release'?trigger:element();
    const actions=element();article.appendChild(actions);actions.appendChild(trigger);article.appendChild(host);if(mode==='video')article.appendChild(closeButton);
    host.id='host-'+frames.length;host.hidden=true;trigger.textContent='聴く';trigger.classList.add('site-button--play');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',host.id);trigger.setAttribute('data-testid',mode==='release'?'music-listen':'music-video-play');if(mode==='video')closeButton.hidden=true;
    return {host,trigger,closeButton,youtubeId:id,title:'架空 "Title / Player"',mode,article,actions};
  }
  return {window,events,frames,adapter,focused:()=>focused,liveFrames:()=>frames.filter(f=>f.parentNode)};
}
test('T44-PLAY Music adapter exists and makes one unmuted iframe synchronously',()=>{
  const h=setup();assert.ok(h.window.MusicPlayer,'MusicPlayer must exist');const a=h.adapter();assert.equal(h.frames.length,0);h.window.MusicPlayer.open(a);
  assert.equal(h.liveFrames().length,1);const frame=h.frames[0];assert.equal(frame.src,'https://www.youtube.com/embed/abcdefghijk?autoplay=1&playsinline=1&controls=1&rel=0');assert.doesNotMatch(frame.src,/mute/);
  assert.equal(frame.getAttribute('allow'),'autoplay; encrypted-media; picture-in-picture; fullscreen');assert.equal(frame.getAttribute('allowfullscreen'),'');assert.equal(frame.getAttribute('referrerpolicy'),'strict-origin-when-cross-origin');assert.match(frame.title,/架空/);
  assert.equal(a.host.hidden,false);assert.equal(a.trigger.textContent,'閉じる');assert.equal(a.trigger.getAttribute('data-testid'),'music-close');assert.equal(a.trigger.getAttribute('aria-expanded'),'true');assert.equal(a.trigger.getAttribute('aria-controls'),a.host.id);assert.equal(a.host.parentNode,a.article);
});
test('T44-PLAY release close restores focus/label/classes/aria and blanks before removal',()=>{
  const h=setup(),a=h.adapter();assert.ok(h.window.MusicPlayer);h.window.MusicPlayer.open(a);assert.equal(a.trigger.classList.contains('site-button--secondary'),true);const frame=h.frames[0];h.window.MusicPlayer.close();
  assert.equal(frame.src,'about:blank');assert.equal(h.liveFrames().length,0);assert.equal(a.host.hidden,true);assert.equal(a.trigger.textContent,'聴く');assert.equal(a.trigger.classList.contains('site-button--play'),true);assert.equal(a.trigger.classList.contains('site-button--secondary'),false);assert.equal(a.trigger.getAttribute('aria-expanded'),'false');assert.equal(a.trigger.getAttribute('data-testid'),'music-listen');assert.equal(h.focused(),a.trigger);h.window.MusicPlayer.close();
});
test('T44-PLAY video swaps thumbnail for player; visible close restores thumbnail focus',()=>{
  const h=setup(),a=h.adapter('video');assert.ok(h.window.MusicPlayer);h.window.MusicPlayer.open(a);assert.equal(a.trigger.hidden,true);assert.equal(a.closeButton.hidden,false);assert.equal(a.host.hidden,false);
  h.window.MusicPlayer.close();assert.equal(a.trigger.hidden,false);assert.equal(a.closeButton.hidden,true);assert.equal(a.host.hidden,true);assert.equal(h.focused(),a.trigger);
});
for(const pair of [['release','release'],['release','video'],['video','release'],['video','video']])test('T44-PLAY replacing '+pair.join(' → ')+' including same youtubeId restarts exactly one session',()=>{
  const h=setup(),a=h.adapter(pair[0]),b=h.adapter(pair[1]);assert.ok(h.window.MusicPlayer);h.window.MusicPlayer.open(a);const first=h.frames[0];h.window.MusicPlayer.open(b);
  assert.equal(h.frames.length,2);assert.notEqual(h.frames[1],first);assert.equal(first.src,'about:blank');assert.equal(h.liveFrames().length,1);assert.equal(a.host.hidden,true);assert.equal(a.trigger.hidden,false);assert.equal(h.focused(),null);
  h.events.get('pagehide')();assert.equal(h.liveFrames().length,0);assert.equal(b.host.hidden,true);assert.equal(h.focused(),null);
});
test('T44-PLAY Home ↔ Music adapters share a single session and Home restores original DOM',()=>{
  const h=setup();assert.ok(h.window.MusicPlayer);const home=h.adapter(),music=h.adapter('video');const original=home.host.parentNode,next=home.host.nextSibling;
  h.window.HomePlayer.open(home.host,home.trigger,'abcdefghijk','Home');const first=h.frames[0];h.window.MusicPlayer.open(music);assert.equal(first.src,'about:blank');assert.equal(h.liveFrames().length,1);assert.equal(home.host.parentNode,original);assert.equal(home.host.nextSibling,next);assert.equal(home.trigger.getAttribute('data-testid'),'home-listen');
  h.window.HomePlayer.open(home.host,home.trigger,'lmnopqrstuv','Home again');assert.equal(music.trigger.hidden,false);assert.equal(music.closeButton.hidden,true);assert.equal(h.liveFrames().length,1);h.window.HomePlayer.close();assert.equal(h.liveFrames().length,0);assert.equal(h.focused(),home.trigger);
});
for(const id of ['', 'bad', 'abcdefghij!', 'abcdefghijk/evil'])test('T44-PLAY refuses invalid id '+id,()=>{
  const h=setup();assert.ok(h.window.MusicPlayer);h.window.MusicPlayer.open(h.adapter('video',id));assert.equal(h.liveFrames().length,0);
});
test('T44-PLAY invalid mode, missing host/trigger/closeButton never opens',()=>{
  for(const patch of [{mode:'unknown'},{host:null},{trigger:null},{closeButton:null}]){const h=setup();assert.ok(h.window.MusicPlayer);h.window.MusicPlayer.open({...h.adapter('video'),...patch});assert.equal(h.frames.length,0);}
});
