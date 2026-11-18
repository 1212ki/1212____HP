import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('assets/js/site-content.js', 'utf8');
const fixture = JSON.parse(readFileSync('test/fixtures/home-states.json', 'utf8'));
const clone = () => structuredClone(fixture.data);
const settle = () => new Promise(resolve => setImmediate(resolve));

// The harness executes the browser source. HTML strings and dispatched events are
// the boundary under test; no renderer logic is duplicated here.
function harness(data = clone(), options = {}) {
  const nodes = new Map();
  function element(id = '', tag = 'div') {
    const attrs = new Map(), listeners = new Map(), classes = new Set();
    let html = '';
    const e = {id, tagName: tag.toUpperCase(), style: {}, dataset: {}, hidden: false, disabled: false, textContent: '', children: [],
      classList: {add(...n) {n.forEach(x=>classes.add(x));}, remove(...n) {n.forEach(x=>classes.delete(x));}, contains(n) {return classes.has(n);}, toggle(n, yes) {if(yes ?? !classes.has(n)) classes.add(n); else classes.delete(n);}},
      setAttribute(n,v) {attrs.set(n,String(v)); if(n==='src') e.src=String(v);}, getAttribute(n) {return attrs.get(n) ?? null;}, removeAttribute(n) {attrs.delete(n);},
      addEventListener(t,fn) {const group=listeners.get(t)||[];group.push(fn);listeners.set(t,group);},
      dispatch(t, target=e) {for(const fn of listeners.get(t)||[]) fn({target, preventDefault(){}});},
      listenerCount(t) {return (listeners.get(t)||[]).length;},
      appendChild(child) {e.children.push(child);child.parentNode=e;return child;}, remove() {if(e.parentNode)e.parentNode.children=e.parentNode.children.filter(x=>x!==e);},
      focus() {document.activeElement=e;}, contains(child) {return child===e || [...nodes.values()].includes(child);},
      closest(selector) {return selector==='[data-home-action]' && e.dataset.homeAction ? e : null;},
      querySelectorAll(selector) {return selector==='img[data-home-image]' ? e.images || [] : selector==='[data-home-action="retry"]' ? [...nodes.values()].filter(x=>x.dataset.homeAction==='retry') : [];}, querySelector(){return null;}
    };
    Object.defineProperty(e,'innerHTML',{get(){return html;},set(value){html=String(value);e.children=[];e.images=[];
      for(const match of html.matchAll(/<([\w-]+)\b([^>]*)>/g)) {
        const a=match[2], ident=a.match(/\bid="([^"]*)"/), action=a.match(/data-home-action="([^"]*)"/);
        if(!ident && !action && !/data-home-image/.test(a)) continue;
        const child=element(ident?.[1]||'',match[1]);
        for(const pair of a.matchAll(/([\w-]+)="([^"]*)"/g)) child.setAttribute(pair[1],pair[2]);
        if(action) child.dataset.homeAction=action[1];
        if(/data-home-image/.test(a)) {e.images.push(child);child.nextElementSibling={hidden:true};}
        if(ident)nodes.set(ident[1],child);
      }
    }});
    return e;
  }
  // Declare only real Home hooks, reading their initial markup from index.html.
  const html=readFileSync('index.html','utf8');
  for(const id of ['home-content','home-artwork','home-featured-release','home-release-caption','home-player','home-next-live-events','home-next-live-empty','home-news','news-items','home-music-items','home-profile-text','home-link-list','home-load-error','home-top','home-bands','home-about']) nodes.set(id,element(id));
  nodes.set('site-footer',element('site-footer'));nodes.get('site-footer').textContent='Default footer';
  const releaseSection=element();releaseSection.appendChild(nodes.get('home-release-caption'));
  const document={getElementById(id){return nodes.get(id)||null;}, querySelectorAll(){return[];}, createElement(tag){return element('',tag);}, activeElement:null};
  const events=new Map();
  const window={location:{pathname:'/',search:''},addEventListener(t,fn){events.set(t,fn);}};
  let calls=0;
  const context={window,document,console,URL,URLSearchParams,Date:class extends Date {constructor(...args){super(...(args.length?args:['2026-11-17T12:00:00Z']));} static now(){return new Date('2026-11-17T12:00:00Z').getTime();}},fetch:()=>{calls++;return options.fetch ? options.fetch(calls) : Promise.resolve({ok:true,json:async()=>options.body ? data : {data,meta:fixture.meta}});}};
  context.globalThis=window;
  if(!options.noLiveHelper) vm.runInNewContext(readFileSync('assets/js/live-operations.js','utf8'),context);
  if(!options.noMusicHelper) vm.runInNewContext(readFileSync('assets/js/music-data.js','utf8'),context);
  if(options.liveThrow)window.LiveOperations.formatLiveDetails=()=>{throw Error('Synthetic local error');};
  if(options.player)window.HomePlayer=options.player;
  vm.runInNewContext(source,context);
  return {nodes,window,document,html,calls:()=>calls,events,element};
}
async function render(data=clone(),opts={}) {const h=harness(data,opts);await settle();return h;}
const get=(h,id)=>h.nodes.get(id);
const output=(h,id)=>get(h,id).innerHTML;

test('T42-DATA Home root, fixed hooks and scripts exist in real HTML',()=>{
  const html=readFileSync('index.html','utf8');
  assert.match(html,/<body class="site-home"/);
  for(const id of ['home-content','home-featured-release','home-player','home-next-live-events','home-next-live-empty','home-news','news-items','home-music-items','home-profile-text','home-link-list','home-load-error'])assert.ok(html.includes(`id="${id}"`),id);
  assert.doesNotMatch(html,/home-hero-image/);
});
for(const body of [false,true]) test('T42-DATA featured and music render from '+(body?'body':'envelope'),async()=>{
  const data=clone(),before=JSON.stringify(data);const h=await render(data,{body});
  assert.match(output(h,'home-featured-release'),/架空の作品 A/);
  assert.match(output(h,'home-featured-release'),/Single ／ 2026.10.10/);
  assert.match(output(h,'home-music-items'),/架空の作品 B/);assert.match(output(h,'home-music-items'),/架空のデモ C/);
  assert.doesNotMatch(output(h,'home-music-items'),/架空の作品 A/);assert.equal(JSON.stringify(data),before);
});
for(const explicit of ['', 'missing', 'release-c'])test('T42-DATA explicit/automatic/broken reference '+explicit,async()=>{
  const data=clone();data.site.featuredReleaseId=explicit;const h=await render(data);
  assert.match(output(h,'home-featured-release'),explicit==='release-c'?/架空のデモ C/:/架空の作品 A/);
});
test('T42-DATA ties retain digital then demo source order',async()=>{
  const data=clone();data.site.featuredReleaseId='';for(const item of [...data.discography.digital,...data.discography.demo])item.releaseDate='2026.01.01';
  const h=await render(data);assert.match(output(h,'home-featured-release'),/架空の作品 A/);
  const music=output(h,'home-music-items');assert.ok(music.indexOf('作品 B')<music.indexOf('デモ C'));
});
test('T42-DATA invalid dates produce no face but keep music; empty and 0/1 music work',async()=>{
  const data=clone();data.site.featuredReleaseId='';for(const item of [...data.discography.digital,...data.discography.demo])item.releaseDate='legacy';
  let h=await render(data);assert.match(output(h,'home-featured-release'),/松本一樹/);assert.match(output(h,'home-music-items'),/作品 A/);
  data.discography={digital:[],demo:[]};h=await render(data);assert.match(output(h,'home-featured-release'),/松本一樹/);assert.equal(output(h,'home-music-items'),'');
  data.discography.digital=[{id:'one',title:'Single remaining',releaseDate:'2026.01.01'}];h=await render(data);assert.equal(output(h,'home-music-items'),'');
  data.discography.demo=[{id:'two',title:'Other',releaseDate:'2025.01.01'}];h=await render(data);assert.equal((output(h,'home-music-items').match(/class="site-release-card"/g)||[]).length,1);
});
for(const kind of ['missing','empty','populated'])test('T42-DATA three fields '+kind+' and original title',async()=>{
  const data=clone();const item=data.discography.digital[0];item.title='EP <old> & "title"';
  if(kind==='missing'){delete data.site.featuredReleaseId;delete item.releaseType;delete item.playbackVideoId;}
  if(kind==='empty'){data.site.featuredReleaseId='';item.releaseType='';item.playbackVideoId='';}
  const h=await render(data);assert.match(output(h,'home-featured-release'),/EP &lt;old&gt; &amp; &quot;title&quot;/);
  assert.match(output(h,'home-featured-release'),kind==='populated'?/Single ／ 2026.10.10/:/2026.10.10/);
  if(kind!=='populated')assert.doesNotMatch(output(h,'home-featured-release'),/ ／ /);
});
test('T42-DATA missing music helper fails safely',async()=>{const h=await render(clone(),{noMusicHelper:true});assert.equal(get(h,'home-load-error').hidden,false);assert.match(output(h,'home-load-error'),/情報を読み込めませんでした/);});

for(const category of ['musicVideos','liveMovies','demos'])test('T42-PLAY video resolves in '+category+' and click calls player synchronously',async()=>{
  const data=clone();data.youtube={musicVideos:[],liveMovies:[],demos:[]};data.youtube[category]=[{id:'video-a',youtubeId:' abcdefghijk '}];
  const calls=[];const player={close(){},open(...args){calls.push(args);}};const h=await render(data,{player});
  assert.match(output(h,'home-featured-release'),/data-testid="home-listen"/);
  assert.match(output(h,'home-featured-release'),/配信先へ/);assert.doesNotMatch(output(h,'home-featured-release'),/<iframe/);
  const button=get(h,'home-listen');get(h,'home-content').dispatch('click',button);
  assert.equal(calls.length,1);assert.equal(calls[0][2],'abcdefghijk');assert.equal(calls[0][3],'架空の作品 A');
});
for(const id of ['', 'missing', 'bad'])test('T42-PLAY missing or unsafe playback reference '+id,async()=>{
  const data=clone();data.discography.digital[0].playbackVideoId=id;data.youtube.musicVideos.push({id:'bad',youtubeId:'bad/value'});
  const h=await render(data);assert.doesNotMatch(output(h,'home-featured-release'),/data-home-action="play"/);assert.match(output(h,'home-featured-release'),/配信先へ/);
});
for(const url of ['', 'javascript:alert(1)', 'data:text/plain,hi', 'not a url'])test('T42-PLAY hides unsafe release URL '+url,async()=>{
  const data=clone();data.discography.digital[0].link=url;const h=await render(data);assert.doesNotMatch(output(h,'home-featured-release'),/配信先へ/);
});
test('T42-PLAY Demo purchase and escaped accessible external label',async()=>{
  const data=clone();data.site.featuredReleaseId='release-c';const h=await render(data);const html=output(h,'home-featured-release');assert.match(html,/購入先へ/);assert.match(html,/target="_blank" rel="noopener noreferrer"/);assert.match(html,/aria-label="購入先へ（外部サイト・別タブ）"/);assert.doesNotMatch(html,/data-home-action="play"/);
});

for(const mode of ['internal','external','closed','invalid','past','duplicate','empty-id','no-helper'])test('T42-LIVE booking '+mode,async()=>{
  const data=clone(),live=data.live.upcoming[0];
  if(mode==='external')live.ticketUrl='https://example.test/booking?a=1&b=2';
  if(mode==='closed')live.reservationClosed=true;
  if(mode==='invalid')live.ticketUrl='javascript:alert(1)';
  if(mode==='past')live.date='2000.01.01';
  if(mode==='duplicate')data.live.past=[{...live}];
  if(mode==='empty-id')live.id='';
  const h=await render(data,{noLiveHelper:mode==='no-helper'});const html=output(h,'home-next-live-events');
  assert.match(html,/架空の公演 A/);assert.match(html,/架空の会場/);assert.doesNotMatch(html,/<img/);assert.match(html,/all live →/);
  if(mode==='internal')assert.match(html,/href="ticket\/\?liveId=live-a"[^>]*>予約する<\/a>/);
  if(mode==='external'){assert.match(html,/予約する（外部サイト）/);assert.match(html,/target="_blank" rel="noopener noreferrer"/);assert.match(html,/a=1&amp;b=2/);}
  if(['closed','past'].includes(mode)){assert.match(html,/<span[^>]*>予約受付終了<\/span>/);assert.doesNotMatch(html,/href="ticket\//);}
  if(mode==='invalid')assert.match(html,/<span[^>]*>予約URLが無効です<\/span>/);
  if(['duplicate','empty-id','no-helper'].includes(mode)){assert.match(html,/<span[^>]*>予約情報を確認できません<\/span>/);assert.match(html,/href="live\/"[^>]*>詳細/);}
});
test('T42-LIVE sort keeps earliest upcoming even past-date and detail-only description survives',async()=>{
  const data=clone();data.live.upcoming=[{id:'later',date:'2099.01.01',title:'Later'},{id:'first',date:'2000.01.01',title:'First',venue:'Venue',description:'Description only<br>second <line>'}];const before=JSON.stringify(data);
  const h=await render(data);const html=output(h,'home-next-live-events');assert.match(html,/First/);assert.doesNotMatch(html,/Later/);assert.match(html,/Description only<br>second &lt;line&gt;/);assert.equal(JSON.stringify(data),before);
});
test('T42-LIVE structured detail formatter output preserved',async()=>{
  const h=await render();const expected=h.window.LiveOperations.formatLiveDetails(clone().live.upcoming[0]);const escaped=expected.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');assert.ok(output(h,'home-next-live-events').includes(escaped));
});
test('T42-LIVE successful empty upcoming has archive entry and no reservation',async()=>{
  const data=clone();data.live.upcoming=[];const h=await render(data);assert.equal(get(h,'home-next-live-empty').hidden,false);assert.equal(output(h,'home-next-live-events'),'');assert.match(h.html,/次のライブは、決まり次第ここでお知らせします。/);assert.match(h.html,/live\/detail\/\?view=past/);
});
test('T42-CONTENT news stable descending 6, full descriptions, one suffix arrow, no images',async()=>{
  const data=clone();data.news=[
    {date:'',title:'Blank'}, {date:'invalid',title:'Invalid'},
    ...['2026.01.01','2026.06.01','2026.05.01','2026.06.01','2026.04.01','2026.03.01','2026.02.01'].map((date,i)=>({date,title:'News '+i,description:'Full description '+i+'<br><script>escape</script>',link:'https://example.test/n',linkText:'▷read → inside →',image:'assets/images/album1.jpg'}))
  ];const before=JSON.stringify(data);const h=await render(data);const html=output(h,'news-items');
  assert.equal((html.match(/class="site-news-item"/g)||[]).length,6);assert.ok(html.indexOf('News 1')<html.indexOf('News 3'));assert.ok(html.indexOf('News 3')<html.indexOf('News 2'));assert.doesNotMatch(html,/Blank|Invalid|News 0|<img|<script>/);assert.match(html,/Full description 1<br>&lt;script&gt;escape&lt;\/script&gt;/);assert.match(html,/>read → inside →<\/a>/);assert.equal(JSON.stringify(data),before);
});
test('T42-CONTENT news invalid/empty dates last, link fallback and no-link',async()=>{
  const data=clone();data.news=[{date:'bad',title:'Invalid',link:'https://example.test/n',linkText:''},{date:'',title:'Blank',linkText:'Must not show'},{date:'2026.01.01',title:'Valid'}];const h=await render(data);const html=output(h,'news-items');assert.ok(html.indexOf('Valid')<html.indexOf('Invalid'));assert.ok(html.indexOf('Invalid')<html.indexOf('Blank'));assert.match(html,/view\.\.\. →/);assert.doesNotMatch(html,/Must not show/);
});
for(const text of ['first\r\nline\r\n \t\r\nsecond','first<br>line<br><br>second','first\rline\r\rsecond'])test('T42-CONTENT profile normalizes paragraphs '+JSON.stringify(text),async()=>{
  const data=clone();data.profile.text=text;const h=await render(data);assert.equal(output(h,'home-profile-text'),'<p>first<br>line</p>');
});
test('T42-CONTENT profile escape, empty paragraph and single line',async()=>{
  const data=clone();data.profile.text='<b>artist</b>\nnext';let h=await render(data);assert.equal(output(h,'home-profile-text'),'<p>&lt;b&gt;artist&lt;/b&gt;<br>next</p>');
  data.profile.text=' \r\n ';h=await render(data);assert.equal(output(h,'home-profile-text'),'');assert.match(h.html,/profile →/);
});
test('T42-CONTENT 5 links order, Home label, Site priority, Profile fallback, URL filtering',async()=>{
  const data=clone();data.profile.links=[{name:'Bandcamp',url:'https://example.test/fallback-shop'},{name:'YouTube',url:'https://example.test/fallback-videos'}];
  let h=await render(data);let html=output(h,'home-link-list');assert.equal((html.match(/<a /g)||[]).length,5);assert.match(html,/Bandcamp（音源・物販）/);assert.doesNotMatch(html,/fallback-shop|simpleicons/);const labels=['Bandcamp','YouTube','X','Instagram','note'];for(let i=1;i<labels.length;i++)assert.ok(html.indexOf('>'+labels[i-1])<html.indexOf('>'+labels[i]));
  data.site.links.youtube='';data.site.links.x='javascript:alert(1)';h=await render(data);html=output(h,'home-link-list');assert.match(html,/fallback-videos/);assert.doesNotMatch(html,/javascript:/);assert.equal((html.match(/<a /g)||[]).length,4);
});
test('T42-CONTENT footer displays complete configured text including narrow screens',async()=>{
  const h=await render();assert.equal(get(h,'site-footer').textContent,fixture.data.site.footerText);
  const data=clone();data.site.footerText='';assert.equal(get(await render(data),'site-footer').textContent,'');
});

test('T42-STATE pending initial fetch is busy and has no fabricated reservation',async()=>{
  const h=harness(clone(),{fetch:()=>new Promise(()=>{})});assert.equal(get(h,'home-content').getAttribute('aria-busy'),'true');assert.equal(get(h,'home-content').dataset.state,'loading');assert.doesNotMatch(output(h,'home-next-live-events'),/予約する|2099/);
});
for(const mode of ['http','json','network','null','array','string'])test('T42-STATE full failure '+mode+' is one notice, default footer and static links',async()=>{
  const fetch=()=>mode==='network' ? Promise.reject(Error('Synthetic network error')) : Promise.resolve({ok:mode!=='http',json:async()=>{if(mode==='json')throw Error('Synthetic JSON error');return {data:mode==='null'?null:mode==='array'?[]:'bad'};}});
  const h=await render(clone(),{fetch});assert.equal(get(h,'home-content').getAttribute('aria-busy'),'false');assert.equal(get(h,'home-content').dataset.state,'error');assert.equal(get(h,'home-load-error').hidden,false);assert.equal(get(h,'home-top').hidden,true);assert.equal(get(h,'home-bands').hidden,true);assert.equal(get(h,'home-about').hidden,true);
  const html=output(h,'home-load-error');assert.equal((html.match(/情報を読み込めませんでした/g)||[]).length,1);assert.match(html,/もう一度読み込む/);assert.match(html,/https:\/\/1212ki.bandcamp.com\//);assert.match(html,/https:\/\/www.youtube.com\/@1212____ki/);assert.equal(get(h,'site-footer').textContent,'Default footer');
});
for(const live of [null,{}, {upcoming:null},{upcoming:'invalid'}])test('T42-STATE local invalid live isolated '+JSON.stringify(live),async()=>{
  const data=clone();data.live=live;const h=await render(data);assert.equal(get(h,'home-load-error').hidden,true);assert.match(output(h,'home-featured-release'),/作品 A/);assert.match(output(h,'home-next-live-events'),/ライブ情報を読み込めませんでした/);assert.match(output(h,'home-next-live-events'),/data-testid="home-retry"/);assert.equal(get(h,'home-next-live-empty').hidden,true);assert.equal(get(h,'home-content').dataset.state,'ready');
});
test('T42-STATE local rendering exception preserves other content',async()=>{const h=await render(clone(),{liveThrow:true});assert.match(output(h,'home-next-live-events'),/ライブ情報を読み込めませんでした/);assert.match(output(h,'news-items'),/お知らせ A/);assert.equal(get(h,'home-load-error').hidden,true);});
test('T42-STATE full retry recovers with one request, one listener and closes player',async()=>{
  let resolve;let closed=0;const h=await render(clone(),{player:{close(){closed++;}},fetch:n=>n===1?Promise.reject(Error('Synthetic failure')):new Promise(r=>resolve=r)});
  const button=get(h,'home-retry');get(h,'home-content').dispatch('click',button);get(h,'home-content').dispatch('click',button);
  assert.equal(h.calls(),2);assert.equal(button.disabled,true);assert.equal(get(h,'home-content').listenerCount('click'),1);assert.ok(closed>=2);
  resolve({ok:true,json:async()=>({data:clone(),meta:fixture.meta})});await settle();assert.equal(get(h,'home-load-error').hidden,true);assert.equal(get(h,'home-content').getAttribute('aria-busy'),'false');assert.match(output(h,'home-featured-release'),/作品 A/);
});
test('T42-STATE local retry keeps other sections and only Live busy, then recovers',async()=>{
  const data=clone();data.live.upcoming=null;let resolve;const h=await render(data,{fetch:n=>n===1?Promise.resolve({ok:true,json:async()=>({data,meta:fixture.meta})}):new Promise(r=>resolve=r)});const title=output(h,'home-featured-release');const button=get(h,'home-retry');get(h,'home-content').dispatch('click',button);
  assert.equal(get(h,'home-next-live-events').getAttribute('aria-busy'),'true');assert.equal(get(h,'home-content').getAttribute('aria-busy'),'false');assert.equal(output(h,'home-featured-release'),title);
  resolve({ok:true,json:async()=>({data:clone(),meta:fixture.meta})});await settle();assert.match(output(h,'home-next-live-events'),/予約する/);assert.equal(get(h,'home-next-live-events').getAttribute('aria-busy'),'false');
});
test('T42-STATE pagehide invalidates a late fetch response',async()=>{
  let resolve;const h=harness(clone(),{fetch:()=>new Promise(r=>resolve=r)});h.events.get('pagehide')();resolve({ok:true,json:async()=>({data:clone(),meta:fixture.meta})});await settle();assert.equal(output(h,'home-featured-release'),'');
});
test('T42-STATE no image and actual error event expose title/name fallback without retry',async()=>{
  const data=clone();data.discography.digital[0].image='javascript:alert(1)';let h=await render(data);assert.doesNotMatch(output(h,'home-artwork'),/<img/);assert.match(output(h,'home-artwork'),/架空の作品 A/);assert.match(output(h,'home-artwork'),/松本一樹/);
  h=await render();const image=get(h,'home-artwork').images[0];get(h,'home-content').dispatch('error',image);assert.equal(image.hidden,true);assert.equal(image.nextElementSibling.hidden,false);assert.equal(h.calls(),1);
});
test('T42-STATE news missing or empty hides only news, no releases retains links and Live',async()=>{
  const data=clone();delete data.news;data.discography={digital:[],demo:[]};const h=await render(data);assert.equal(get(h,'home-news').hidden,true);assert.match(output(h,'home-link-list'),/Bandcamp/);assert.match(output(h,'home-next-live-events'),/予約する/);assert.ok(get(h,'home-content').classList.contains('home-without-release'));assert.doesNotMatch(output(h,'home-featured-release'),/data-home-action="play"/);
});

test('RV42-01 chips have text-only labels and accessible safe external navigation',async()=>{
  function chips(html,labels) {
    const links=[...html.matchAll(/<a\b([^>]*class="site-chip"[^>]*)>([^<]*)<\/a>/g)];
    assert.deepEqual(links.map(m=>m[2]),labels);
    for(const [,attrs,label] of links) {
      assert.match(attrs,/target="_blank"/);assert.match(attrs,/rel="noopener noreferrer"/);
      assert.ok(attrs.includes(`aria-label="${label}（外部サイト・別タブ）"`));
    }
  }
  let h=await render();chips(output(h,'home-featured-release'),['配信先へ']);
  chips(output(h,'home-link-list'),['Bandcamp（音源・物販）','YouTube','X','Instagram','note']);
  const data=clone();data.site.featuredReleaseId='release-c';h=await render(data);chips(output(h,'home-featured-release'),['購入先へ']);
  h=await render(clone(),{fetch:()=>Promise.reject(Error('Synthetic failure'))});
  chips(output(h,'home-load-error'),['Bandcamp（音源・物販）','YouTube']);
});

test('RV42-03 no release hides new release caption and restores it on retry',async()=>{
  const data=clone();data.discography={digital:[],demo:[]};data.live.upcoming=null;
  const h=await render(data,{fetch:n=>Promise.resolve({ok:true,json:async()=>({data:n===1?data:clone(),meta:fixture.meta})})});
  assert.equal(get(h,'home-release-caption').hidden,true,'new release must not remain visible');
  assert.match(output(h,'home-featured-release'),/<h1 id="home-artist-name" class="home-artist-name">松本一樹<\/h1>/);
  assert.doesNotMatch(output(h,'home-featured-release'),/home-release-title|home-release-meta|home-release-actions/);
  assert.ok(get(h,'home-content').classList.contains('home-without-release'));
  assert.match(output(h,'home-link-list'),/Bandcamp/);
  get(h,'home-content').dispatch('click',get(h,'home-retry'));await settle();
  assert.equal(get(h,'home-release-caption').hidden,false);
  assert.equal(get(h,'home-content').classList.contains('home-without-release'),false);
});

for(const local of [false,true])test('RV42-05 bfcache resumes interrupted '+(local?'Live retry':'initial GET')+' and ignores old response',async()=>{
  const requests=[];const data=clone();data.live.upcoming=null;
  const h=harness(data,{fetch:n=>local&&n===1?Promise.resolve({ok:true,json:async()=>({data,meta:fixture.meta})}):new Promise(resolve=>requests.push(resolve))});
  await settle();let button;
  if(local){button=get(h,'home-retry');get(h,'home-content').dispatch('click',button);assert.equal(button.disabled,true);}
  const title=output(h,'home-featured-release');
  h.events.get('pagehide')({persisted:true});
  assert.equal(get(h,'home-content').getAttribute('aria-busy'),'false');
  assert.equal(get(h,'home-next-live-events').getAttribute('aria-busy'),'false');
  if(local)assert.equal(button.disabled,false);
  h.events.get('pageshow')?.({persisted:false});assert.equal(requests.length,1);
  h.events.get('pageshow')?.({persisted:true});assert.equal(requests.length,2);
  assert.equal(get(h,local?'home-next-live-events':'home-content').getAttribute('aria-busy'),'true');
  if(local)assert.equal(output(h,'home-featured-release'),title);
  requests[0]({ok:true,json:async()=>({data:clone(),meta:fixture.meta})});await settle();
  assert.equal(get(h,local?'home-next-live-events':'home-content').getAttribute('aria-busy'),'true','stale response must not finish resumed request');
  requests[1]({ok:true,json:async()=>({data:clone(),meta:fixture.meta})});await settle();
  assert.equal(get(h,'home-content').dataset.state,'ready');assert.match(output(h,'home-next-live-events'),/予約する/);
  assert.equal(get(h,'home-next-live-events').getAttribute('aria-busy'),'false');
  assert.equal(get(h,'home-content').getAttribute('aria-busy'),'false');
  const count=h.calls();h.events.get('pagehide')({persisted:true});h.events.get('pageshow')({persisted:true});assert.equal(h.calls(),count,'ready page needs no new request');
});

test('FR-N1 freeform news dates preserve raw text and isolate whitespace-delimited words safely',async()=>{
  const data=clone();data.news=structuredClone(fixture.scenarios['freeform-news-dates'].news);
  data.news[0].date='2099/1/2(Fri.) <unsafe>&';
  const before=JSON.stringify(data);const h=await render(data);const html=output(h,'news-items');
  const dates=[...html.matchAll(/<p class="site-news-date">([\s\S]*?)<\/p>/g)].map(m=>m[1]);
  assert.equal(dates.length,6);
  for(const item of data.news){
    const expected=item.date.split(/(\s+)/).map(word=>/\S/.test(word)?`<span class="site-news-date-word">${word.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`:word).join('');
    assert.ok(dates.includes(expected),item.id);
  }
  assert.equal(JSON.stringify(data),before);assert.doesNotMatch(html,/<unsafe>/);
});
