import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const read=p=>readFileSync(p,'utf8');
const routes=[['discography','release','作品'],['youtube','video','映像']];

function run(route,suffix='',destination){
  const html=read(route+'/index.html'),replacements=[];
  const script=[...html.matchAll(/<script\b[^>]*src="([^\"]+)"[^>]*>/g)].map(m=>m[1]).find(src=>src.split('?')[0].endsWith('/music-redirect.js'));
  assert.ok(script,'legacy page loads redirect script');
  const url=new URL('http://localhost/'+route+'/'+suffix);
  const location={href:url.href,pathname:url.pathname,search:url.search,hash:url.hash,replace(value){replacements.push(value);},assign(){assert.fail('must use replace');}};
  const window={location};const document={body:{dataset:{musicDestination:destination===undefined?html.match(/data-music-destination="([^\"]+)"/)?.[1]:destination}}};
  vm.runInNewContext(read(new URL(script,'file://'+process.cwd()+'/'+route+'/index.html').pathname),{window,document,URL,fetch(){assert.fail('legacy must not fetch');}});
  return {html,replacements};
}
for(const [route,section,label] of routes){
  test('T44-LEGACY '+route+' real HTML is static guidance/canonical/noindex with no API and a visible link',()=>{
    const html=read(route+'/index.html');assert.match(html,/name="robots" content="noindex, follow"/);assert.match(html,/rel="canonical" href="https:\/\/1212hp.com\/music\/"/);assert.doesNotMatch(html,/<meta[^>]+http-equiv=/i);
    assert.ok(html.includes(label+'はMusicにまとめました。'));const main=html.match(/<main\b[^]*?<\/main>/)?.[0];assert.ok(main?.includes('Musicの'+label+'へ →'));assert.ok(main.includes('href="../music/#'+section+'"'));assert.doesNotMatch(main,/<noscript|<iframe|disc-digital-items|youtube-content/);
    assert.equal(new URL('../music/#'+section,'http://localhost/'+route+'/').href,'http://localhost/music/#'+section);
    assert.doesNotMatch(html,/site-config\.js|site-content\.js|music-data\.js/);assert.match(html,/<script[^>]*src="[^\"]*music-redirect.js[^\"]*"[^>]*defer/);
    assert.match(html,/script.js\?v=/);assert.match(html,/site-footer/);
  });
  for(const file of ['','index.html'])for(const query of ['','?utm_source=synthetic','?next=https://evil.test/path#ignored'])for(const hash of ['','#old','#video'])test('T44-LEGACY replace fixed destination '+route+'/'+file+query+hash,()=>{
    const h=run(route,file+query+hash);assert.deepEqual(h.replacements,['http://localhost/music/#'+section]);
  });
}
for(const destination of ['', 'other','https://evil.test/','../video'])test('T44-LEGACY invalid destination never redirects '+destination,()=>{assert.deepEqual(run('discography','',destination).replacements,[]);});
test('T44-LEGACY destination sections exist in actual renderer and no-JS Music keeps two listening links',()=>{
  assert.ok(existsSync('music/index.html'));const html=read('music/index.html');const nojs=html.match(/<noscript>([^]*?)<\/noscript>/)?.[1]||'';
  assert.match(nojs,/音源と映像はこちらからご覧いただけます。/);assert.equal((nojs.match(/<a\b/g)||[]).length,2);assert.match(nojs,/https:\/\/1212ki.bandcamp.com\//);assert.match(nojs,/https:\/\/www.youtube.com\/@1212____ki/);
  assert.match(read('assets/js/site-content.js'),/\["digital", "release"\]/);assert.match(read('assets/js/site-content.js'),/id="video"/);
});
