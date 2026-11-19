import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import vm from 'node:vm';

const base='080325887576655f27461cb15f28a3c590a292ee';
const paths=['index.html','live/index.html','live/detail/index.html','ticket/index.html','ticket/complete/index.html','discography/index.html','youtube/index.html','profile/index.html','contact/index.html','music/index.html'];
const read=p=>readFileSync(p,'utf8');
const before=p=>execFileSync('git',['show',`${base}:${p}`],{encoding:'utf8'});
const scripts=html=>[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
const normalizedNav=html=>[...html.match(/<nav\b[\s\S]*?<\/nav>/)[0].matchAll(/<a href="([^"]*)"[^>]*>([^<]+)<\/a>/g)];

for(const path of paths)test('T44-SHELL ten routes and five shared nav URLs '+path,()=>{
  const html=read(path),old=path==='music/index.html'?'':before(path);
  assert.match(html,/<header class="site-header">/);assert.match(html,/<footer class="site-footer">/);
  assert.match(html,/aria-controls="global-nav"/);assert.match(html,/id="site-footer"/);
  const nav=normalizedNav(html);assert.equal(nav.length,5);
  assert.deepEqual(nav.map(m=>m[2]),['Home','Live','Music','Profile','Contact']);
  assert.deepEqual(nav.map(m=>new URL(m[1],'http://localhost/'+path).pathname.replace(/index\.html$/, '')),['/','/live/','/music/','/profile/','/contact/']);
  let expected=scripts(old);
  if(['discography/index.html','youtube/index.html'].includes(path))expected=['../assets/js/music-redirect.js','../assets/js/script.js'];
  if(path==='music/index.html')expected=['site-config.js','music-data.js','home-player.js','site-content.js','script.js'].map(x=>'../assets/js/'+x);
  assert.deepEqual(scripts(html),expected);
  if(!['index.html','music/index.html','discography/index.html','youtube/index.html'].includes(path))assert.equal(html.match(/<main\b[\s\S]*?<\/main>/)[0],old.match(/<main\b[\s\S]*?<\/main>/)[0], 'non-Home main bytes');
  for(const src of scripts(html))assert.ok(existsSync(new URL(src,'file://'+process.cwd()+'/'+path)),src);
});
test('T44-SHELL shared style and script cache version aligned for every consumer',()=>{
  for(const path of paths){const html=read(path);assert.match(html,/css\/style.css\?v=20261118-44/);assert.match(html,/js\/script.js\?v=20261118-44/);if(scripts(html).some(x=>x.includes('site-content.js')))assert.match(html,/js\/site-content.js\?v=20261118-44/);}
});
test('T42-SHELL new classes and Home scoped color/layout preserve previous CSS bytes',()=>{
  const css=read('assets/css/style.css');const previous=before('assets/css/style.css');assert.equal(css.slice(0,previous.length),previous);
  for(const name of ['site-header','site-footer','site-button','site-chip','site-text-link','site-section-title','site-release-card','site-news-item','home-caption'])assert.ok(css.includes('.'+name),name);
  assert.match(css,/body\.site-home/);assert.match(css,/100dvh - 81px/);assert.match(css,/aspect-ratio: 16\s*\/\s*9/);assert.match(css,/\.site-header[^{}]*\.logo::after\s*\{[^}]*display: none/);
  assert.match(css,/\.site-header[^{}]*a:hover[\s\S]*?color: var\(--ink\)/);
});
test('T42-SHELL logo behavior and animation CSS bytes preserved',()=>{
  const script=read('assets/js/script.js'),old=before('assets/js/script.js');
  const block=s=>s.slice(s.indexOf('  const logo ='),s.indexOf('  const fadeTargets ='));assert.equal(block(script),block(old));
  const css=read('assets/css/style.css'),previous=before('assets/css/style.css');
  for(const name of ['logoPulse','particleFly','rippleExpand']){
    const start=previous.indexOf('@keyframes '+name);if(start>=0){const end=previous.indexOf('\n}\n',start)+3;assert.ok(css.includes(previous.slice(start,end)));}
  }
});
test('T42-SHELL admin share explanation and current Home use, no hero consumer',()=>{
  assert.doesNotMatch(read('index.html')+read('assets/js/site-content.js'),/home-hero-image/);
  assert.match(read('admin/index.html'),/ライブの画像がない時、共有時の画像に使います。Homeには作品のジャケットを表示します。/);
  assert.match(read('admin/index.html'),/class="field-hint">ライブの画像がない時/);
  const doc=read('admin/README.md');assert.doesNotMatch(doc,/公開画面は現在の表示を維持します。/);assert.match(doc,/#42.*Home/);assert.match(doc,/Worker.*deploy.*不要/);assert.match(doc,/#41の反映と復旧（履歴）/);
});

function shell({width=390,reduce=true,home=false,pathname='/'}={}) {
  const events=new Map(),windowEvents=new Map(),scheduled=[],created=[];
  let active=null;
  function element() {const classes=new Set(),attrs=new Map(),listeners=new Map();const e={style:{setProperty(){}},hidden:false,textContent:'',className:'',children:[],classList:{add(...n){n.forEach(x=>classes.add(x));},remove(...n){n.forEach(x=>classes.delete(x));},contains(n){return classes.has(n);},toggle(n,yes){if(yes??!classes.has(n))classes.add(n);else classes.delete(n);return classes.has(n);}},setAttribute(k,v){attrs.set(k,String(v));},getAttribute(k){return attrs.get(k)??null;},removeAttribute(k){attrs.delete(k);},addEventListener(t,fn){listeners.set(t,fn);},dispatch(t,init={}){listeners.get(t)?.({key:'',...init});},focus(){active=e;},getBoundingClientRect(){return {left:0,top:0,width:100,height:30};},appendChild(c){e.children.push(c);created.push(c);},remove(){}};return e;}
  const header=element(),toggle=element(),label=element(),nav=element(),logo=element(),fade=element();
  const page=pathname==='/'?'index.html':pathname.slice(1)+(pathname.endsWith('index.html')?'':'index.html');
  const links=normalizedNav(read(page)).map(m=>m[1]).map(href=>{const e=element();e.setAttribute('href',href);return e;});
  const document={body:element(),addEventListener(t,fn){events.set(t,fn);},querySelector(s){return ({header,'.nav-toggle':toggle,'.nav-toggle-text':label,'#global-nav':nav,'.logo':logo})[s]||null;},getElementById(id){return id==='global-nav'?nav:id==='home-content'&&home?element():null;},querySelectorAll(s){if(s==='nav ul li a'||s==='nav a')return links;if(s.includes('.news-item'))return [fade];return[];},createElement:element};
  const window={location:{pathname,href:'http://localhost'+pathname},innerWidth:width,matchMedia:s=>({matches:s.includes('reduced-motion')?reduce:false}),addEventListener(t,fn){windowEvents.set(t,fn);}};
  vm.runInNewContext(read('assets/js/script.js'),{window,document,URL,console,setTimeout:(fn,ms)=>{scheduled.push({fn,ms});},IntersectionObserver:class {observe(){}unobserve(){}}});events.get('DOMContentLoaded')();
  return {header,toggle,label,nav,logo,fade,links,window,events,windowEvents,scheduled,created,active:()=>active};
}
test('T42-SHELL mobile Menu label/hidden/aria, Escape and explicit-close focus',()=>{
  const h=shell();assert.equal(h.nav.hidden,true);assert.equal(h.label.textContent,'Menu');h.toggle.dispatch('click');assert.equal(h.nav.hidden,false);assert.equal(h.toggle.getAttribute('aria-expanded'),'true');assert.equal(h.label.textContent,'閉じる');h.events.get('keydown')({key:'Escape'});assert.equal(h.nav.hidden,true);assert.equal(h.active(),h.toggle);h.toggle.dispatch('click');h.toggle.dispatch('click');assert.equal(h.label.textContent,'Menu');assert.equal(h.active(),h.toggle);
});
test('T42-SHELL every nav link closes without focus jump and desktop resize clears hidden',()=>{
  for(let i=0;i<5;i++){const h=shell();h.toggle.dispatch('click');h.links[i].dispatch('click');assert.equal(h.nav.hidden,true);assert.equal(h.active(),null);}
  const h=shell();h.toggle.dispatch('click');h.window.innerWidth=821;h.windowEvents.get('resize')();assert.equal(h.nav.hidden,false);assert.equal(h.toggle.getAttribute('aria-expanded'),'false');assert.equal(h.header.classList.contains('nav-open'),false);
  assert.equal(shell({width:1440}).nav.hidden,false);
});
test('T42-SHELL logo click keeps ripple, 26 timed particles and reduced-motion opt-out',()=>{
  const h=shell({reduce:false});h.logo.dispatch('click');assert.equal(h.created.filter(x=>x.className==='ripple-effect').length,1);const particleTimers=h.scheduled.filter(x=>x.ms<=450);assert.equal(particleTimers.length,26);assert.deepEqual(particleTimers.map(x=>x.ms),Array.from({length:26},(_,i)=>i*18));for(const t of particleTimers)t.fn();assert.equal(h.created.filter(x=>x.className==='particle').length,26);assert.equal(h.header.classList.contains('nav-open'),false);
  const reduced=shell({reduce:true});reduced.logo.dispatch('click');assert.equal(reduced.created.length,0);
});
test('T42-SHELL Home initial content is visible and other pages keep fade-in',()=>{
  assert.equal(shell({home:true}).fade.classList.contains('fade-in-element'),false);assert.equal(shell({home:false}).fade.classList.contains('fade-in-element'),true);
});
test('RV42-04 narrow Menu preserves active hover row lines and eight pixel list padding',()=>{
  const css=read('assets/css/style.css').split('/* Issue #42:')[1];
  assert.doesNotMatch(css,/a\.active[^{}]*\{[^}]*border-color:\s*transparent/);
  const mobile=css.slice(css.indexOf('@media (max-width: 820px)'));
  assert.match(mobile,/\.site-header nav ul\s*\{[^}]*padding: var\(--space-8\) 0;/);
  assert.match(mobile,/\.site-header nav ul li a\s*\{[^}]*border-bottom: 1px solid var\(--line\)/);
});
test('RV42-07 Home caption and news spacing match master without changing shared title gap',()=>{
  const css=read('assets/css/style.css').split('/* Issue #42:')[1];
  assert.match(css,/\.home-release-title\s*\{[^}]*margin-top: var\(--space-12\)/);
  assert.match(css,/\.home-next-live \.home-caption\s*\{[^}]*margin-bottom: var\(--space-8\)/);
  assert.match(css,/#home-news-title\s*\{[^}]*margin-bottom: var\(--space-16\)/);
  assert.match(css.slice(css.indexOf('@media (max-width: 820px)')),/#home-news-title\s*\{[^}]*margin-bottom: var\(--space-8\)/);
  assert.match(css,/\.site-section-title\s*\{[^}]*margin-bottom: var\(--space-24\)/);
  assert.match(css,/\.home-release-actions--playing\s*\{[^}]*flex-direction: row;[^}]*flex-wrap: wrap/);
});

test('FR-N1 news date column grows from master 88px within a bounded width and keeps body space',()=>{
  const css=read('assets/css/style.css').split('/* Issue #42:')[1];
  assert.match(css,/#news-items\s*\{[^}]*grid-template-columns: minmax\(88px, max-content\) minmax\(0, 1fr\)/);
  assert.match(css,/#news-items\s*\{[^}]*column-gap: var\(--space-24\)/);
  assert.match(css,/\.site-news-date\s*\{[^}]*max-width: min\(240px, calc\(100vw - 236px\)\)/);
  assert.match(css,/\.site-news-date-word\s*\{[^}]*display: inline-block;[^}]*max-width: 100%;[^}]*overflow-wrap: anywhere/);
});

test('FR-N2 all Home news rows share the longest bounded date column and content start',()=>{
  const css=read('assets/css/style.css').split('/* Issue #42:')[1];
  assert.match(css,/#news-items\s*\{[^}]*display: grid;[^}]*grid-template-columns: minmax\(88px, max-content\) minmax\(0, 1fr\);[^}]*column-gap: var\(--space-24\)/);
  assert.match(css,/\.site-news-item\s*\{[^}]*display: grid;[^}]*grid-column: 1 \/ -1;[^}]*grid-template-columns: subgrid;[^}]*padding: var\(--space-16\) 0;[^}]*border-bottom: 1px solid var\(--line\)/);
  assert.doesNotMatch(css,/\.site-news-item\s*\{[^}]*grid-template-columns: (?!subgrid)[^;}]+/);
  assert.match(css.slice(css.indexOf('@media (max-width: 820px)')),/\.site-news-item \+ \.site-news-item\s*\{[^}]*margin-top: var\(--space-8\)/);
});


test('T44-STYLE/COMPAT all previous CSS bytes retained and new rules scoped to Music only',()=>{
  const css=read('assets/css/style.css'),old=before('assets/css/style.css');assert.equal(css.slice(0,old.length),old);
  const added=css.slice(old.length);assert.match(added,/body\.site-music/);assert.match(added,/width: min\(calc\(100% - 32px\), var\(--max-width\)\)/);
  assert.match(added,/grid-template-columns: 120px minmax\(0, 1fr\)/);assert.match(added,/width: 220px/);assert.match(added,/aspect-ratio: 16 \/ 9/);assert.doesNotMatch(added,/310px|\b24px\b|height: 174px/);
  assert.match(added,/\.site-music \[hidden\]\s*\{[^}]*display: none !important/);assert.match(added,/scroll-margin-top:/);
  assert.doesNotMatch(added,/var\(--accent|#[0-9a-fA-F]{3,8}\b|line-clamp|text-overflow: ellipsis|height: 160px/);
  assert.match(added,/\.site-music \.music-jumps\s*\{[^}]*max-height: none;[^}]*opacity: 1;[^}]*overflow: visible;[^}]*pointer-events: auto/);
  for(const match of added.replace(/\/\*[^]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    const selector=match[1].trim();if(selector.startsWith('@'))continue;
    for(const part of selector.split(','))assert.match(part.trim(),/^(?:body)?\.site-music\b/,part);
  }
  for(const path of ['DESIGN_RULES.md','assets/css/1212-music.tokens.css','assets/js/music-data.js','assets/js/live-operations.js','assets/js/site-config.js','admin/index.html','admin/app.js','admin/style.css'])assert.equal(read(path),before(path),path);
});
// Owner decision 2026-11-18 (round 2): YouTube asks embeds to be at least 200px tall and recommends 480x270 for 16:9.
const rule=(css,selector)=>{const m=css.replace(/\/\*[^]*?\*\//g,'').match(new RegExp('(?:^|\\})\\s*'+selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\{([^{}]*)\\}'));return m?m[1]:null;};
test('T44-STYLE PC release player: 480 wide, own full-width grid row under the pressed row, 16:9, never below 200px tall',()=>{
  const css=read('assets/css/style.css'),old=before('assets/css/style.css'),added=css.slice(old.length),desktop=added.slice(0,added.indexOf('@media (max-width: 820px)')),mobile=added.slice(added.indexOf('@media (max-width: 820px)'));
  const list=rule(desktop,'.site-music .music-release-list');assert.match(list,/display: grid/);assert.match(list,/grid-template-columns: repeat\(auto-fill, 220px\)/);assert.match(list,/gap: var\(--space-32\)/);assert.match(list,/justify-content: start/);
  const host=rule(desktop,'.site-music .music-release-player');assert.match(host,/grid-column: 1 \/ -1/);assert.match(host,/width: min\(480px, 100%\)/);
  const player=rule(desktop,'.site-music .music-player');assert.match(player,/aspect-ratio: 16 \/ 9/);assert.match(player,/min-height: 200px/);assert.doesNotMatch(player,/overflow: visible/);
  assert.match(rule(desktop,'.site-music .music-release-card'),/width: 220px/);
  const narrowList=rule(mobile,'.site-music .music-release-list');assert.match(narrowList,/display: flex/);assert.match(narrowList,/flex-direction: column/);
  assert.match(rule(mobile,'.site-music .music-release-player'),/width: 100%/);assert.doesNotMatch(mobile,/music-release-card > \.music-player/);
});
test('T44-STYLE PC video: two columns, gap 32, 474 wide thumbnail and player of equal size, one column before 200px tall is lost',()=>{
  const css=read('assets/css/style.css'),old=before('assets/css/style.css'),added=css.slice(old.length),desktop=added.slice(0,added.indexOf('@media (max-width: 820px)')),mobile=added.slice(added.indexOf('@media (max-width: 820px)'));
  const list=rule(desktop,'.site-music .music-video-list');assert.match(list,/display: grid/);assert.match(list,/grid-template-columns: repeat\(2, minmax\(0, 474px\)\)/);assert.match(list,/gap: var\(--space-32\)/);
  const card=rule(desktop,'.site-music .music-video-card');assert.match(card,/width: 100%/);assert.doesNotMatch(card,/310px/);assert.match(rule(desktop,'.site-music .music-video-title'),/width: 100%/);
  const thumbnail=rule(desktop,'.site-music .music-video-thumbnail');assert.match(thumbnail,/width: 100%/);assert.match(thumbnail,/aspect-ratio: 16 \/ 9/);assert.match(thumbnail,/min-height: 200px/);
  const narrow=rule(mobile,'.site-music .music-video-list');assert.match(narrow,/grid-template-columns: minmax\(0, 1fr\)/);assert.match(narrow,/gap: var\(--space-16\)/);
  // The mobile switch is at 820px (the media query above); the 32px gap and 474px cap are asserted above, and
  // the 200px floor via min-height, so the two-column size is derived from those values instead of repeated.
  assert.match(added,/@media \(max-width: 820px\)/);
  const gutter=Number(css.match(/\.site-music \.music-container \{ width: min\(calc\(100% - (\d+)px\)/)[1]),floor=Number(thumbnail.match(/min-height: (\d+)px/)[1]);
  const content=Math.min(820+1-gutter,Number(css.match(/--max-width: (\d+)px/)[1])),column=(content-32)/2;
  assert.ok(content===789&&column>=378&&column*9/16>=floor,`two columns of ${column}px (${column*9/16}px tall) at the narrowest wide layout`);
});
test('T44-STYLE Home player CSS is untouched (round 2 changes Music only)',()=>{
  const css=read('assets/css/style.css'),old=before('assets/css/style.css');assert.equal(css.slice(0,old.length),old);assert.doesNotMatch(css.slice(0,old.length).match(/\.home-player\s*\{[^}]*\}/)[0],/min-height/);
});
test('T44-COMPAT Home main changes only its music arrow href, cards and logo remain',()=>{
  const main=s=>s.match(/<main\b[^]*?<\/main>/)[0];assert.equal(main(read('index.html')),main(before('index.html')).replace('href="discography/">music →','href="music/">music →'));
  for(const path of paths.filter(x=>x!=='music/index.html')){
    const logo=s=>s.match(/<h1 class="logo">[^]*?<\/h1>/)[0];assert.equal(logo(read(path)),logo(before(path)),path);
  }
});
for(const [pathname,label] of [['/','Home'],['/index.html','Home'],['/music/','Music'],['/music/index.html','Music'],['/ticket/','Live'],['/ticket/complete/','Live'],['/live/detail/','Live'],['/discography/index.html','Music'],['/youtube/','Music'],['/profile/','Profile'],['/contact/','Contact']])test('T44-SHELL current mapping/aria '+pathname,()=>{
  const h=shell({pathname});const active=h.links.filter(link=>link.classList.contains('active'));assert.equal(active.length,1);assert.equal(active[0].getAttribute('aria-current'),'page');assert.equal(h.links.indexOf(active[0]),['Home','Live','Music','Profile','Contact'].indexOf(label));assert.equal(h.links.filter(link=>link.getAttribute('aria-current')==='page').length,1);
});
test('T44-ADMIN public Music maps to existing six admin tabs, feature state and save paths remain',()=>{
  const doc=read('admin/README.md');assert.doesNotMatch(doc,/Musicへの適用とTicket完了の案内は後続|公開画面と同じカテゴリから編集対象/);assert.match(doc,/Music.*#44/);assert.match(doc,/Ticket完了.*#43/);assert.match(doc,/Disco/);assert.match(doc,/YouTube/);assert.match(doc,/#47/);assert.match(doc,/#42の公開反映（履歴）/);assert.match(doc,/feature\/39-public-pages/);
  assert.equal((read('admin/index.html').match(/class="tab-btn/g)||[]).length,6);
});
