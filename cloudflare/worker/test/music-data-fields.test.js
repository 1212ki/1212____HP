import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/worker.js';
import music from '../../../assets/js/music-data.js';

function fixture() {
  return { site:{featuredReleaseId:'r',heroImage:'assets/images/synthetic.jpg'},discography:{digital:[{id:'r',title:'Synthetic release',releaseDate:'2025.05.05',playbackVideoId:'v',releaseType:' Single '}],demo:[{id:'s',releaseDate:'',playbackVideoId:'v'}]},youtube:{musicVideos:[{id:'v',title:'Synthetic video',youtubeId:'abcdefghijk'}],liveMovies:[],demos:[]},live:{upcoming:[{id:'l',description:'Synthetic legacy description',sourceText:'private source',xComment:'private comment'}],past:[]}};
}
function store(initial, failure) {
  let raw = initial === undefined ? null : typeof initial === 'string' ? initial : JSON.stringify(initial);
  let writes=0;
  const env={ADMIN_SHARED_TOKEN:'synthetic-test-token',DB:{prepare(sql){return {bind(...args){this.args=args;return this;},async first(){if(failure)throw new Error('synthetic read failure');return raw===null?null:{data:raw,updated_at:'2026-01-01T00:00:00Z'};},async run(){assert.match(sql,/INSERT/);writes++;raw=this.args[0];return {success:true};}};}}};
  return {env,get writes(){return writes;},get raw(){return raw;}};
}
async function put(s,data,auth=true) {
  return worker.fetch(new Request('https://example.test/api/admin/site-data',{method:'PUT',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer synthetic-test-token'}:{})},body:JSON.stringify(data)}),s.env,{});
}
async function get(s) { const r=await worker.fetch(new Request('https://example.test/api/public/site-data'),s.env,{}); assert.equal(r.status,200); return r.json(); }
test('music fields GET defaults are memory-only and PUT public projection retains all three fields',async()=>{
  const old=fixture(); delete old.site.featuredReleaseId; for(const x of [...old.discography.digital,...old.discography.demo]) {delete x.playbackVideoId;delete x.releaseType;}
  const s=store(old); const p=await get(s); assert.equal(s.writes,0); assert.equal(p.data.site.featuredReleaseId,''); assert.equal(p.data.discography.digital[0].releaseType,'');
  const data=fixture(); assert.equal((await put(s,data)).status,200); const out=await get(s);
  assert.equal(out.data.site.featuredReleaseId,'r'); assert.equal(out.data.discography.digital[0].playbackVideoId,'v'); assert.equal(out.data.discography.digital[0].releaseType,' Single ');
  assert.equal(out.data.live.upcoming[0].description,'Synthetic legacy description'); assert.equal('sourceText' in out.data.live.upcoming[0],false); assert.equal('xComment' in out.data.live.upcoming[0],false); assert.ok(out.meta.updatedAt);
  assert.equal(JSON.parse(s.raw).live.upcoming[0].sourceText,'private source');
});
for(const date of ['2025.5.5','2025/05/05','2025.05','',undefined,42,null]) {
  test(`music fields unchanged legacy date ${String(date)} survives edits and category moves`,async()=>{
    const old=fixture(); old.discography.digital[0].releaseDate=date;
    const s=store(old); const next=structuredClone(old); next.discography.digital[0].title='Changed synthetic'; next.discography.digital[0].releaseType='Demo'; next.site.footerText='Changed'; next.live.upcoming[0].title='Changed';
    next.discography.demo.push(next.discography.digital.shift());
    assert.equal((await put(s,next)).status,200); assert.equal(JSON.parse(s.raw).discography.demo[1].releaseDate,date);
  });
}
for(const date of ['2025.5.05','2025/05/05','２０２５.０５.０５','2025.05.05\n',' 2025.05.05','2025.05.05 ',123,null]) {
  test(`music fields invalid new or changed date ${String(date)} rejects without DB write`,async()=>{
    for(const initial of [undefined,fixture()]) {
      const s=store(initial); const before=s.raw; const next=fixture(); next.discography.digital[0].releaseDate=date;
      const r=await put(s,next); assert.equal(r.status,400); const body=await r.json(); assert.equal(body.error,'invalid releaseDate'); assert.deepEqual(body.fields,[{id:'r',field:'releaseDate',message:'「2025.05.05」の形で入力してください。'}]); assert.equal(s.writes,0); assert.equal(s.raw,before);
    }
  });
}
test('music fields empty and shaped dates save including first PUT; auth and duplicate Live still reject',async()=>{
  for(const date of ['',undefined,'0000.99.99']) {const s=store();const data=fixture(); data.discography.digital[0].releaseDate=date; assert.equal((await put(s,data)).status,200);assert.equal(s.writes,1);}
  const s=store(); assert.equal((await put(s,fixture(),false)).status,401);assert.equal(s.writes,0);
  const data=fixture();data.live.past=[{id:'l'}];const r=await put(s,data);assert.equal(r.status,400);assert.deepEqual(await r.json(),{error:'duplicate Live ID: l'});assert.equal(s.writes,0);
});
test('music fields old payload omissions preserve by ID across categories, explicit null clears, missing releases never revive',async()=>{
  const s=store(fixture());const data=fixture();delete data.site.featuredReleaseId;delete data.discography.digital[0].releaseType;delete data.discography.digital[0].playbackVideoId;data.discography.demo.push(data.discography.digital.shift());
  assert.equal((await put(s,data)).status,200);let out=JSON.parse(s.raw); assert.equal(out.site.featuredReleaseId,'r');assert.equal(out.discography.demo[1].releaseType,' Single ');assert.equal(out.discography.demo[1].playbackVideoId,'v');
  out.site.featuredReleaseId=null;out.discography.demo[1].releaseType=null;out.discography.demo[1].playbackVideoId=null;assert.equal((await put(s,out)).status,200);out=JSON.parse(s.raw);assert.equal(out.site.featuredReleaseId,'');assert.equal(out.discography.demo[1].releaseType,'');assert.equal(out.discography.demo[1].playbackVideoId,'');
  delete out.discography;assert.equal((await put(s,out)).status,200);assert.deepEqual(JSON.parse(s.raw).discography,{digital:[],demo:[]});
});
test('music fields references match local helper for deletion, invalid IDs and moves',async()=>{
  for(const change of [d=>{d.discography.digital=[];},d=>{d.youtube.musicVideos=[];},d=>{d.site.featuredReleaseId='missing';d.discography.digital[0].playbackVideoId='missing';},d=>{d.youtube.demos=d.youtube.musicVideos;d.youtube.musicVideos=[];d.discography.demo.push(d.discography.digital.shift());},d=>{d.site.featuredReleaseId='';}]) {
    const data=fixture(); change(data);const expected=music.clearDanglingMusicReferences(data);const s=store(fixture());assert.equal((await put(s,data)).status,200);const actual=(await get(s)).data;assert.equal(actual.site.featuredReleaseId,expected.site.featuredReleaseId);assert.deepEqual(actual.discography,expected.discography);
  }
});
test('music fields malformed persisted JSON and read failure cannot overwrite existing row',async()=>{
  const s=store('{malformed');const r=await put(s,fixture());assert.equal(r.status,400);assert.equal((await r.json()).error,'invalid stored site data');assert.equal(s.writes,0);
  const failed=store(fixture(),true); assert.equal((await put(failed,fixture())).status,500);assert.equal(failed.writes,0);
});
