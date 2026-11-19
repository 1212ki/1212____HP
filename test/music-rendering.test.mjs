import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read = p => readFileSync(p, 'utf8');
const fixture = JSON.parse(read('test/fixtures/music-states.json'));
const clone = () => structuredClone(fixture.data);
const settle = () => new Promise(resolve => setImmediate(resolve));
const decode = s => s.replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');

// Minimal DOM boundary: the shipped HTML/source create all hooks and listeners.
// The harness does not supply Music markup or duplicate its rendering decisions.
function harness(data=clone(), options={}) {
  const nodes=new Map(), events=new Map(), documentEvents=new Map(), replacements=[], scrolls=[], calls=[], measured=[], focusArgs=[];
  let document;
  function element(tag='div') {
    const attrs=new Map(), listeners=new Map(), classes=new Set();let html='';
    const e={tagName:tag.toUpperCase(),id:'',dataset:{},style:{setProperty(){}},children:[],parentNode:null,hidden:false,disabled:false,textContent:'',
      classList:{add(...ns){ns.forEach(n=>classes.add(n));},remove(...ns){ns.forEach(n=>classes.delete(n));},contains(n){return classes.has(n);},toggle(n,yes){if(yes??!classes.has(n))classes.add(n);else classes.delete(n);}},
      setAttribute(k,v){v=String(v);attrs.set(k,v);if(k==='id'){e.id=v;nodes.set(v,e);}if(k==='class')v.split(/\s+/).forEach(n=>classes.add(n));if(k.startsWith('data-'))e.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;},
      getAttribute(k){return attrs.get(k)??null;},removeAttribute(k){attrs.delete(k);},
      addEventListener(t,fn){const a=listeners.get(t)||[];a.push(fn);listeners.set(t,a);},listenerCount(t){return (listeners.get(t)||[]).length;},
      dispatch(t,target=e){const ev={target,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};for(const fn of listeners.get(t)||[])fn(ev);return ev;},
      appendChild(c){c.remove();e.children.push(c);c.parentNode=e;return c;},insertBefore(c,ref){c.remove();const n=e.children.indexOf(ref);e.children.splice(n<0?e.children.length:n,0,c);c.parentNode=e;},
      remove(){if(e.parentNode)e.parentNode.children=e.parentNode.children.filter(c=>c!==e);e.parentNode=null;},focus(options){focusArgs.push({el:e,options});document.activeElement=e;},
      contains(c){return c===e||e.children.some(n=>n.contains(c));},closest(selector){return matches(e,selector)?e:e.parentNode?.closest(selector)||null;},
      querySelectorAll(selector){return descendants(e).filter(n=>matches(n,selector));},querySelector(selector){return e.querySelectorAll(selector)[0]||null;},
      scrollIntoView(){scrolls.push(e.id);},getBoundingClientRect(){return {top:0,left:0,width:100,height:30};}
    };
    Object.defineProperty(e,'nextSibling',{get(){const a=e.parentNode?.children||[];return a[a.indexOf(e)+1]||null;}});
    Object.defineProperty(e,'nextElementSibling',{get(){return e.nextSibling;}});
    Object.defineProperty(e,'innerHTML',{get(){return html;},set(value){html=String(value);for(const child of descendants(e))if(child.id)nodes.delete(child.id);e.children=[];parse(html,e);}});
    return e;
  }
  function descendants(e){return e.children.flatMap(c=>[c,...descendants(c)]);}
  function matches(e,s){
    if(s==='a[href^="#"]')return e.tagName==='A'&&String(e.getAttribute('href')||'').startsWith('#');
    if(s.startsWith('#'))return e.id===s.slice(1);
    if(s.startsWith('.'))return e.classList.contains(s.slice(1));
    const m=s.match(/^(\w+)?\[([\w-]+)(?:="([^"]*)")?\]$/);
    if(m)return (!m[1]||e.tagName===m[1].toUpperCase())&&e.getAttribute(m[2])!==null&&(m[3]===undefined||e.getAttribute(m[2])===m[3]);
    return e.tagName===s.toUpperCase();
  }
  function parse(html,parent){
    const stack=[parent];
    for(const m of html.matchAll(/<!--[^]*?-->|<\/?([\w-]+)\b([^>]*?)>|([^<]+)/g)){
      if(m[0].startsWith('<!--'))continue;
      if(m[3]){stack.at(-1).textContent+=decode(m[3]);continue;}
      if(m[0].startsWith('</')){if(stack.length>1)stack.pop();continue;}
      const child=element(m[1]);for(const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g))child.setAttribute(a[1],decode(a[2]));
      child.hidden=/(?:^|\s)hidden(?:\s|$)/.test(m[2]);stack.at(-1).appendChild(child);
      if(!['meta','link','img','br','input','hr'].includes(m[1]))stack.push(child);
    }
  }
  const body=element('body'), html=existsSync('music/index.html')?read('music/index.html'):'';
  parse(html.match(/<body[^>]*>([^]*?)<\/body>/)?.[1]||'',body);
  // When Music is missing, keep just an empty host so the RED diagnoses no renderer.
  if(!nodes.has('music-content')){const root=element();root.setAttribute('id','music-content');body.appendChild(root);}
  document={body,activeElement:null,getElementById:id=>nodes.get(id)||null,createElement:element,querySelector:s=>body.querySelector(s),querySelectorAll:s=>body.querySelectorAll(s),addEventListener(t,f){documentEvents.set(t,f);}};
  const window={location:{href:'http://localhost/music/'+(options.hash||''),pathname:'/music/',search:'',hash:options.hash||''},innerWidth:390,matchMedia:()=>({matches:true}),scrollTo(){scrolls.push('top');},getComputedStyle:el=>{measured.push(el);return options.layout?options.layout(el):{display:'flex',gridTemplateColumns:'none'};},history:{replaceState(...args){replacements.push(args);window.location.hash='';}},addEventListener(t,f){const a=events.get(t)||[];a.push(f);events.set(t,a);}};
  const context={window,document,URL,URLSearchParams,console,setTimeout,IntersectionObserver:class{observe(){}unobserve(){}},fetch(url,init){calls.push({url,init});return options.fetch?options.fetch(calls.length):Promise.resolve({ok:true,json:async()=>options.body?data:{data,meta:fixture.meta}});}};context.globalThis=window;
  if(!options.noHelper)vm.runInNewContext(read('assets/js/music-data.js'),context);
  if(options.sortSpy){const sort=window.MusicData.sortReleasesByDate;window.MusicData.sortReleasesByDate=a=>{options.sortSpy.push(a);return sort(a);};}
  if(options.player)window.MusicPlayer=options.player;
  vm.runInNewContext(read('assets/js/site-content.js'),context);
  if(options.withScript)vm.runInNewContext(read('assets/js/script.js'),context);
  const emit=(t,event={})=>{for(const f of events.get(t)||[])f(event);};
  return {nodes,document,window,html,calls,measured,focusArgs,events,documentEvents,replacements,scrolls,emit,element};
}
async function render(data=clone(),options={}){const h=harness(data,options);await settle();return h;}
const root=h=>h.nodes.get('music-content');
const out=h=>root(h).innerHTML;

test('T44-DATA Music real HTML hooks, loading status, canonical and script order',()=>{
  assert.ok(existsSync('music/index.html'),'Music page must exist');const html=read('music/index.html');
  assert.match(html,/<body class="site-music"/);assert.match(html,/id="music-content"[^>]*aria-busy="true"/);assert.match(html,/role="status"[^>]*>読み込み中/);
  assert.match(html,/rel="canonical" href="https:\/\/1212hp.com\/music\/"/);
  assert.deepEqual([...html.matchAll(/<script src="[^\"]*\/([^/]+?)(?:\?[^\"]*)?"/g)].map(m=>m[1]),['site-config.js','music-data.js','home-player.js','site-content.js','script.js']);
});
for(const body of [false,true])test('T44-DATA all four releases/five videos, exact title/meta/channel '+body,async()=>{
  const data=clone(),before=JSON.stringify(data),sorts=[];const h=await render(data,{body,sortSpy:sorts});
  assert.equal(root(h).dataset.state,'ready');assert.equal(h.calls.length,1);assert.equal(h.calls[0].url,'/api/public/site-data');assert.equal(h.calls[0].init.cache,'no-store');
  assert.equal((out(h).match(/data-music-release=/g)||[]).length,4);assert.equal((out(h).match(/data-music-video=/g)||[]).length,5);
  assert.equal(sorts.length,2);assert.equal(JSON.stringify(data),before);
  assert.match(out(h),/架空の作品 &quot;Synthetic \/ Alpha&quot; &lt;&gt;&amp; の長いタイトル/);assert.match(out(h),/Single ／ 2026.10.12/);
  for(const id of ['release','demo','video'])assert.ok(h.nodes.has(id),id);
  assert.match(out(h),/href="https:\/\/example.test\/channel"/);assert.match(out(h),/YouTubeチャンネル →/);
  assert.equal((out(h).match(/data-testid="music-listen"/g)||[]).length,1);assert.equal((out(h).match(/data-testid="music-video-play"/g)||[]).length,5);
  assert.doesNotMatch(out(h),/<iframe/);assert.match(out(h),/宅録のデモ。ライブ会場とBandcampで販売しています。/);
});
test('T44-DATA sort uses helper per category; ties and malformed/blank dates stay stable and nonmutating',async()=>{
  const data=clone();data.discography.digital=['2020.01.01','2026.01.01','2026.01.01','bad',''].map((releaseDate,i)=>({id:'r'+i,title:'Ordered-'+i,releaseDate}));
  const before=JSON.stringify(data),h=await render(data),html=out(h);const order=[1,2,0,3,4].map(i=>html.indexOf('>Ordered-'+i+'<'));
  for(let i=1;i<order.length;i++)assert.ok(order[i]>order[i-1]);assert.equal(JSON.stringify(data),before);assert.match(html,/>bad<\/p>/);
  const titles=data.youtube.musicVideos.map(x=>x.title);assert.ok(html.indexOf(titles[0])<html.indexOf(titles[1]));
});
test('T44-DATA metadata missing/empty has no blank row or separator; titles never parsed',async()=>{
  const data=clone(),item=data.discography.digital[0];item.title='EP "Title / Unparsed"';delete item.releaseType;item.releaseDate='';
  const html=out(await render(data));assert.match(html,/EP &quot;Title \/ Unparsed&quot;/);assert.doesNotMatch(html,/music-release-meta[^>]*>\s*<\/p>| ／ /);
});
test('T44-DATA description br/CRLF normalization and escape retains every numbered line in both categories',async()=>{
  const data=clone();data.discography.digital[0].description='1. <script>\r\n2. "quoted"<br />3. &last\r4. end';
  const html=out(await render(data));assert.match(html,/1. &lt;script&gt;<br>2. &quot;quoted&quot;<br>3. &amp;last<br>4. end/);
  assert.match(html,/1. 架空の曲 Gamma<br>2. 架空の曲 Delta<br>3. 架空の曲 Epsilon<br>4. 架空の曲 Zeta/);assert.match(html,/1. 架空の曲 Eta<br>2. 架空の曲 Theta/);assert.doesNotMatch(html,/<script>/);
});
test('T44-DATA safe external operations, relative images and cache query; no id/title injected into hooks',async()=>{
  const data=clone();data.discography.digital[0].id='raw" id';data.discography.digital[0].image='assets/images/album1.jpg?crop=1';
  const h=await render(data),html=out(h);assert.match(html,/src="\.\.\/assets\/images\/album1.jpg\?crop=1&amp;v=2026-11-17T00%3A00%3A00Z"/);
  assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length,5);assert.match(html,/配信先へ/);assert.match(html,/購入先へ/);
  assert.match(html,/id="music-release-digital-0"/);assert.doesNotMatch(html,/raw&quot; id/);
  for(const url of ['javascript:alert(1)','data:text/plain,bad','/relative','']){data.discography.digital[0].link=url;data.youtube.channelUrl=url;const s=out(await render(data));assert.equal((s.match(/>配信先へ<\/a>/g)||[]).length,1);assert.doesNotMatch(s,/YouTubeチャンネル →/);}
});
test('T44-DATA first matching id by category; invalid selected id has no listen; bad video still has title/placeholder',async()=>{
  const data=clone();data.youtube.musicVideos[0].youtubeId='bad/id';data.youtube.liveMovies[0].id='clip-alpha';
  const html=out(await render(data));assert.doesNotMatch(html,/data-testid="music-listen"/);assert.equal((html.match(/data-testid="music-video-play"/g)||[]).length,4);assert.match(html,/架空の映像 Alpha/);assert.match(html,/>video<\/span>/);
  data.discography.digital[0].playbackVideoId='dangling';assert.doesNotMatch(out(await render(data)),/data-testid="music-listen"/);
});

test('T44-PLAY delegated real release/video clicks call adapter synchronously, close and render stop',async()=>{
  const opens=[],closes=[];const h=await render(clone(),{player:{open(a){opens.push(a);},close(a){closes.push(a);}}});
  const release=h.nodes.get('music-release-digital-0'),button=release.querySelector('[data-music-action="play"]');root(h).dispatch('click',button);
  assert.equal(opens.length,1);assert.equal(opens[0].host.id,'music-release-digital-0-player');assert.equal(opens[0].youtubeId,'abcdefghijk');assert.equal(opens[0].mode,'release');assert.equal(opens[0].trigger,button);assert.equal(opens[0].closeButton,button);
  const initialCloses=closes.length;button.setAttribute('aria-expanded','true');root(h).dispatch('click',button);assert.equal(closes.length,initialCloses+1);
  const video=h.nodes.get('music-video-musicVideos-0');root(h).dispatch('click',video.querySelector('[data-music-action="play"]'));assert.equal(opens.length,2);assert.equal(opens[1].youtubeId,opens[0].youtubeId);assert.equal(opens[1].mode,'video');assert.equal(opens[1].closeButton.dataset.musicAction,'close');
  root(h).dispatch('click',opens[1].closeButton);assert.equal(closes.length,initialCloses+2);assert.equal(root(h).listenerCount('click'),1);
});

test('T44-STATE loading leaves one status, skeleton and busy until success',async()=>{
  let resolve;const h=harness(clone(),{fetch:()=>new Promise(r=>{resolve=r;})});
  assert.equal(root(h).dataset.state,'loading');assert.equal(root(h).getAttribute('aria-busy'),'true');assert.match(out(h),/読み込み中/);assert.match(out(h),/music-skeleton/);
  resolve({ok:true,json:async()=>({data:clone()})});await settle();assert.equal(root(h).dataset.state,'ready');assert.equal(root(h).getAttribute('aria-busy'),'false');assert.doesNotMatch(out(h),/music-skeleton|読み込み中/);
});
for(const variant of ['all-empty','missing-collections','channel-only','only-videos','only-releases','empty-demo','empty-live-movie','empty-video'])test('T44-STATE partial/empty successful data '+variant,async()=>{
  const data=clone();
  if(['all-empty','channel-only'].includes(variant)){data.discography={digital:[],demo:[]};for(const key of ['musicVideos','liveMovies','demos'])data.youtube[key]=[];}
  if(variant==='missing-collections'){delete data.discography;delete data.youtube;}
  if(variant==='only-videos')data.discography={};
  if(variant==='only-releases'||variant==='empty-video')for(const key of ['musicVideos','liveMovies','demos'])data.youtube[key]=[];
  if(variant==='empty-demo')data.discography.demo=[];
  if(variant==='empty-live-movie')data.youtube.liveMovies=[];
  const h=await render(data),html=out(h),empty=['all-empty','missing-collections','channel-only'].includes(variant);
  assert.equal(root(h).dataset.state,empty?'empty':'ready');assert.equal(root(h).getAttribute('aria-busy'),'false');
  if(empty){assert.equal((html.match(/音源の情報を読み込めませんでした。/g)||[]).length,1);assert.equal((html.match(/data-testid="music-retry"/g)||[]).length,1);assert.equal((html.match(/class="site-chip"/g)||[]).length,2);assert.doesNotMatch(html,/id="release"|id="demo"|id="video"/);}
  if(['empty-demo','only-videos'].includes(variant))assert.doesNotMatch(html,/id="demo"|href="#demo"/);
  if(['empty-video','only-releases'].includes(variant)){assert.doesNotMatch(html,/id="video"|href="#video"/);assert.match(html,/YouTubeチャンネル →/);}
  if(variant==='only-videos')assert.doesNotMatch(html,/id="release"|href="#release"/);
  if(variant==='empty-live-movie')assert.doesNotMatch(html,/>live movie<\/h3>/);
});
const invalidInputs=[null,[],{discography:[]},{discography:null},{discography:{digital:null}},{discography:{digital:{}}},{discography:{digital:[null]}},{discography:{digital:[[]]}},{youtube:[]},{youtube:{demos:'wrong'}},{youtube:{musicVideos:[7]}}];
for(const data of invalidInputs)test('T44-STATE malformed input is error '+JSON.stringify(data),async()=>{
  const h=await render(data);assert.equal(root(h).dataset.state,'error');assert.equal((out(h).match(/音源の情報を読み込めませんでした。/g)||[]).length,1);assert.match(out(h),/data-testid="music-retry"/);assert.equal(root(h).getAttribute('aria-busy'),'false');
});
for(const failure of ['http','network','json','render'])test('T44-STATE failure retains heading/footer, one retry and two safe fallbacks '+failure,async()=>{
  const options=failure==='render'?{noHelper:true}:{fetch:async()=>{if(failure==='network')throw Error('offline');return {ok:failure!=='http',json:async()=>{if(failure==='json')throw Error('JSON');return {data:clone()};}};}};
  const h=await render(clone(),options);assert.equal(root(h).dataset.state,'error');assert.equal((out(h).match(/音源の情報を読み込めませんでした。/g)||[]).length,1);assert.equal((out(h).match(/class="site-chip"/g)||[]).length,2);assert.match(out(h),/<h1 class="site-section-title">music/);assert.ok(h.nodes.has('site-footer'));
  if(failure==='render')assert.match(out(h),/href="https:\/\/example.test\/shop"/);else assert.match(out(h),/href="https:\/\/1212ki.bandcamp.com\/"/);
});
test('T44-STATE safe fetched Site and channel fallback URLs take priority for empty and render failure',async()=>{
  const data=clone();data.discography={};for(const key of ['musicVideos','liveMovies','demos'])data.youtube[key]=[];data.site.links.youtube='https://example.test/site-youtube';
  let html=out(await render(data));assert.match(html,/href="https:\/\/example.test\/shop"/);assert.match(html,/href="https:\/\/example.test\/site-youtube"/);
  data.site.links.youtube='javascript:bad';html=out(await render(data));assert.match(html,/href="https:\/\/example.test\/channel"/);assert.doesNotMatch(html,/javascript:/);
});
test('T44-STATE broken/unsafe images show only artist or video placeholder without losing title/actions',async()=>{
  const data=clone();data.discography.demo[0].image='javascript:bad';let h=await render(data);const article=h.nodes.get('music-release-demo-0');assert.equal(article.querySelector('img'),null);assert.match(out(h),/>松本一樹<\/span>/);
  const image=h.nodes.get('music-release-digital-0').querySelector('img');root(h).dispatch('error',image);assert.equal(image.hidden,true);assert.equal(image.nextElementSibling.hidden,false);assert.equal(image.nextElementSibling.textContent,'松本一樹');
  const video=h.nodes.get('music-video-musicVideos-0').querySelector('img');root(h).dispatch('error',video);assert.equal(video.hidden,true);assert.equal(video.nextElementSibling.hidden,false);assert.equal(video.nextElementSibling.textContent,'video');assert.match(out(h),/data-testid="music-listen"/);
});
test('T44-STATE retry suppresses double GET, disables button, closes player and reuses listeners',async()=>{
  const responses=[],closes=[];const h=harness(clone(),{fetch:n=>n===1?Promise.resolve({ok:false}):new Promise(r=>responses.push(r)),player:{close(o){closes.push(o);},open(){}}});await settle();
  const button=root(h).querySelector('[data-music-action="retry"]');assert.ok(button);const closed=closes.length;root(h).dispatch('click',button);root(h).dispatch('click',button);
  assert.equal(h.calls.length,2);assert.equal(button.disabled,true);assert.equal(root(h).dataset.state,'loading');assert.ok(closes.length>closed);
  responses.shift()({ok:true,json:async()=>({data:clone()})});await settle();assert.equal(root(h).dataset.state,'ready');assert.equal(root(h).listenerCount('click'),1);assert.equal(root(h).listenerCount('error'),1);
});
test('T44-STATE pagehide invalidates late response; bfcache retries interrupted request once',async()=>{
  const responses=[],closes=[];const h=harness(clone(),{fetch:()=>new Promise(r=>responses.push(r)),player:{close(o){closes.push(o);},open(){}}});
  h.emit('pagehide');const count=closes.length;h.emit('pageshow',{persisted:false});assert.equal(h.calls.length,1);h.emit('pageshow',{persisted:true});assert.equal(h.calls.length,2);h.emit('pageshow',{persisted:true});assert.equal(h.calls.length,2);
  responses[1]({ok:true,json:async()=>({data:clone()})});await settle();const current=out(h);responses[0]({ok:false});await settle();assert.equal(root(h).dataset.state,'ready');assert.equal(out(h),current);assert.ok(count>0);assert.equal(root(h).listenerCount('click'),1);
});
test('T44-STATE pagehide after ready stops player without extra GET on bfcache return',async()=>{
  const closes=[];const h=await render(clone(),{player:{close(o){closes.push(o);},open(){}}});const count=closes.length;h.emit('pagehide');assert.equal(closes.length,count+1);assert.equal(closes.at(-1).restoreFocus,false);h.emit('pageshow',{persisted:true});await settle();assert.equal(h.calls.length,1);
});
for(const hash of ['#release','#demo','#video','#unknown','#missing%20stuff'])test('T44-STATE async hash after ready and hashchange '+hash,async()=>{
  let resolve;const h=harness(clone(),{hash,fetch:()=>new Promise(r=>{resolve=r;})});assert.equal(h.scrolls.length,0);resolve({ok:true,json:async()=>({data:clone()})});await settle();
  if(['#release','#demo','#video'].includes(hash)){assert.equal(h.scrolls.at(-1),hash.slice(1));assert.equal(h.replacements.length,0);}else{assert.equal(h.replacements.length,1);assert.equal(h.scrolls.at(-1),'top');}
  h.window.location.hash='#demo';h.emit('hashchange');assert.equal(h.scrolls.at(-1),'demo');
});
test('T44-STATE empty section hash is removed by replace without adding history and top remains usable',async()=>{
  const data=clone();data.discography.demo=[];const h=await render(data,{hash:'#demo'});assert.equal(h.replacements.length,1);assert.equal(h.scrolls.at(-1),'top');assert.doesNotMatch(out(h),/href="#demo"|id="demo"/);
});
for(const before of [false,true])test('T44-STATE real script.js leaves Music anchors native before/after DOMContentLoaded '+before,async()=>{
  let resolve;const h=harness(clone(),{withScript:true,fetch:()=>new Promise(r=>{resolve=r;})});
  if(before)h.documentEvents.get('DOMContentLoaded')();resolve({ok:true,json:async()=>({data:clone()})});await settle();if(!before)h.documentEvents.get('DOMContentLoaded')();
  const anchor=root(h).querySelector('a');assert.ok(anchor);assert.equal(anchor.dispatch('click').defaultPrevented,false);h.window.location.hash='#release';h.emit('hashchange');assert.equal(h.scrolls.at(-1),'release');
});

// Owner decision 2026-11-18 (round 2): on PC the release player opens at 480x270 directly under the row
// that holds the pressed work, never over another card. The host is a sibling of the cards in the list so
// the grid can give it its own full-width row; its row number follows the live column count.
const gridLayout=columns=>({value:columns,fn(){return {display:'grid',gridTemplateColumns:Array(this.value).fill('220px').join(' ')};}});
function manyReleases(count){const data=clone(),base=data.discography.digital[0];data.discography.digital=Array.from({length:count},(_,i)=>({...base,id:'grid-'+i,title:'Grid-'+i,releaseDate:'2026.10.'+String(28-i).padStart(2,'0'),playbackVideoId:'clip-alpha'}));return data;}
const press=(h,index)=>{const card=h.nodes.get('music-release-digital-'+index);root(h).dispatch('click',card.querySelector('[data-music-action="play"]'));};
test('T44-LAYOUT release player host is a list sibling right after its card and is named for the work',async()=>{
  const h=await render(clone());const card=h.nodes.get('music-release-digital-0'),host=h.nodes.get('music-release-digital-0-player');
  assert.ok(host);assert.equal(host.parentNode,card.parentNode);assert.equal(card.nextSibling,host);assert.equal(card.querySelector('.music-player'),null);
  assert.equal(host.hidden,true);assert.ok(host.classList.contains('music-player'));assert.ok(host.classList.contains('music-release-player'));
  assert.equal(host.getAttribute('role'),'group');assert.equal(host.getAttribute('aria-label'),'架空の作品 "Synthetic / Alpha" <>& の長いタイトルの再生');
  assert.equal(card.querySelector('[data-music-action="play"]').getAttribute('aria-controls'),host.id);
  const video=h.nodes.get('music-video-musicVideos-0');assert.ok(video.querySelector('.music-player'));assert.doesNotMatch(out(h),/width="310"|height="174"/);assert.match(out(h),/width="474" height="267"/);
});
for(const [columns,index,row] of [[4,0,2],[4,3,2],[4,4,3],[4,5,3],[3,2,2],[3,3,3],[2,5,4],[1,0,2]])test(`T44-LAYOUT PC grid with ${columns} columns: work ${index} opens its player in grid row ${row}, below the pressed row`,async()=>{
  const layout=gridLayout(columns),opens=[];const h=await render(manyReleases(6),{layout:layout.fn.bind(layout),player:{open(a){opens.push(a);},close(){}}});
  press(h,index);assert.equal(opens.length,1);assert.equal(opens[0].host.id,`music-release-digital-${index}-player`);assert.equal(opens[0].host.style.gridRow,String(row));
  assert.ok(h.measured.length>0);assert.ok(h.measured.every(el=>el===opens[0].host.parentNode&&el.classList.contains('music-release-list')),'only the release list (the host parent) is measured');
});
test('T44-LAYOUT narrow (one-column flex) layout leaves the player in flow under its own card, and resize re-places an open player',async()=>{
  const layout=gridLayout(4),opens=[];let mobile=false;const h=await render(manyReleases(6),{layout:el=>mobile?{display:'flex',gridTemplateColumns:'none'}:layout.fn(el),player:{open(a){opens.push(a);},close(){}}});
  press(h,5);const host=opens[0].host;assert.equal(host.style.gridRow,'3');host.hidden=false;
  layout.value=2;h.emit('resize');assert.equal(host.style.gridRow,'4');
  mobile=true;h.emit('resize');assert.ok(!host.style.gridRow);assert.equal(host.parentNode.children.indexOf(host),host.parentNode.children.indexOf(h.nodes.get('music-release-digital-5'))+1);
  const other=h.nodes.get('music-release-digital-0-player');other.style.gridRow='9';other.hidden=true;mobile=false;h.emit('resize');assert.equal(other.style.gridRow,'9');
  assert.equal(root(h).listenerCount('click'),1);
});
test('T44-LAYOUT press while the grid is not measurable (no computed style) never throws and sets no row',async()=>{
  const opens=[];const h=await render(manyReleases(6),{layout:()=>({}),player:{open(a){opens.push(a);},close(){}}});press(h,4);assert.equal(opens.length,1);assert.ok(!opens[0].host.style.gridRow);
});

test('T44-FOCUS retry success moves focus to the music heading; the heading is focusable only by script',async()=>{
  const h=harness(clone(),{fetch:n=>n===1?Promise.resolve({ok:false}):Promise.resolve({ok:true,json:async()=>({data:clone()})})});await settle();
  const button=root(h).querySelector('[data-music-action="retry"]');button.focus();root(h).dispatch('click',button);await settle();
  assert.equal(root(h).dataset.state,'ready');const heading=root(h).querySelector('h1');assert.ok(heading);assert.equal(heading.getAttribute('tabindex'),'-1');assert.equal(h.document.activeElement,heading);
  assert.equal(h.focusArgs.at(-1).el,heading);assert.notEqual(h.focusArgs.at(-1).options&&h.focusArgs.at(-1).options.preventScroll,true,'no hash: the heading focus may scroll to the top');
});
test('T44-FOCUS retry success with a valid hash keeps the section position: heading focus uses preventScroll',async()=>{
  // A failed first load drops any hash (no section to land on), so a valid hash reaches a retry only when it is set while the retry loads.
  let h;h=harness(clone(),{fetch:n=>{if(n===1)return Promise.resolve({ok:false});h.window.location.hash='#release';return Promise.resolve({ok:true,json:async()=>({data:clone()})});}});await settle();
  const button=root(h).querySelector('[data-music-action="retry"]');button.focus();h.scrolls.length=0;root(h).dispatch('click',button);await settle();
  assert.equal(root(h).dataset.state,'ready');assert.ok(h.scrolls.includes('release'));const heading=root(h).querySelector('h1');
  assert.equal(h.document.activeElement,heading);assert.equal(h.focusArgs.at(-1).el,heading);assert.equal(h.focusArgs.at(-1).options&&h.focusArgs.at(-1).options.preventScroll,true);
});
test('T44-FOCUS retry that fails again with a hash still moves focus to the retry button',async()=>{
  const h=harness(clone(),{hash:'#release',fetch:()=>Promise.resolve({ok:false})});await settle();
  const first=root(h).querySelector('[data-music-action="retry"]');first.focus();root(h).dispatch('click',first);await settle();
  const next=root(h).querySelector('[data-music-action="retry"]');assert.equal(h.document.activeElement,next);assert.notEqual(next,first);
});
test('T44-FOCUS retry that fails again moves focus to the new retry button, not body',async()=>{
  const h=harness(clone(),{fetch:()=>Promise.resolve({ok:false})});await settle();
  const first=root(h).querySelector('[data-music-action="retry"]');first.focus();root(h).dispatch('click',first);await settle();
  const next=root(h).querySelector('[data-music-action="retry"]');assert.ok(next);assert.notEqual(next,first);assert.equal(next.disabled,false);assert.equal(h.document.activeElement,next);
});
test('T44-FOCUS empty result after retry keeps focus on the retry still shown',async()=>{
  const empty=clone();empty.discography={};for(const key of ['musicVideos','liveMovies','demos'])empty.youtube[key]=[];
  const h=harness(clone(),{fetch:n=>n===1?Promise.resolve({ok:false}):Promise.resolve({ok:true,json:async()=>({data:empty})})});await settle();
  const first=root(h).querySelector('[data-music-action="retry"]');first.focus();root(h).dispatch('click',first);await settle();
  assert.equal(root(h).dataset.state,'empty');assert.equal(h.document.activeElement,root(h).querySelector('[data-music-action="retry"]'));
});
test('T44-FOCUS focus is not stolen when the user moved it elsewhere while loading, nor on first load or a stale response',async()=>{
  const responses=[];const h=harness(clone(),{fetch:n=>n===1?Promise.resolve({ok:false}):new Promise(r=>responses.push(r))});await settle();assert.equal(h.document.activeElement,null);
  const button=root(h).querySelector('[data-music-action="retry"]');button.focus();root(h).dispatch('click',button);const elsewhere=h.element('a');elsewhere.focus();
  responses[0]({ok:true,json:async()=>({data:clone()})});await settle();assert.equal(root(h).dataset.state,'ready');assert.equal(h.document.activeElement,elsewhere);
  const stale=harness(clone(),{fetch:n=>n===1?Promise.resolve({ok:false}):new Promise(r=>responses.push(r))});await settle();
  const retry=stale.nodes.get('music-content').querySelector('[data-music-action="retry"]');retry.focus();stale.nodes.get('music-content').dispatch('click',retry);stale.emit('pagehide');
  responses[1]({ok:true,json:async()=>({data:clone()})});await settle();assert.equal(stale.document.activeElement,retry);
});

test('T44-A11Y release links keep the visible label and add the work name to the accessible name; channel and failure links are unchanged',async()=>{
  const h=await render(clone()),html=out(h);const title='架空の作品 &quot;Synthetic / Alpha&quot; &lt;&gt;&amp; の長いタイトル';
  assert.match(html,new RegExp(`aria-label="配信先へ（${title}・外部サイト・別タブ）"[^>]*>配信先へ</a>`));
  assert.match(html,/aria-label="購入先へ（架空のデモ Gamma・外部サイト・別タブ）"[^>]*>購入先へ<\/a>/);
  assert.doesNotMatch(html,/aria-label="配信先へ（外部サイト・別タブ）"|aria-label="購入先へ（外部サイト・別タブ）"/);
  assert.match(html,/aria-label="YouTubeチャンネル →（外部サイト・別タブ）"/);
  const data=clone();data.discography.digital[0].title='';assert.match(out(await render(data)),/aria-label="配信先へ（外部サイト・別タブ）"/);
  const failed=out(await render(clone(),{fetch:async()=>({ok:false})}));assert.match(failed,/aria-label="Bandcamp（外部サイト・別タブ）"/);assert.match(failed,/aria-label="YouTube（外部サイト・別タブ）"/);
});

export {harness,render,clone,settle,root,out};
