import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const music = require('../assets/js/music-data.js');
test('music date format uses exactly ten ASCII characters without calendar restrictions', () => {
  for (const value of ['2025.05.05', '0000.99.99']) assert.equal(music.isReleaseDateFormat(value), true);
  for (const value of ['', null, 20250505, '2025.5.05', '2025/05/05', '２０２５.０５.０５', ' 2025.05.05', '2025.05.05 ', '2025.05.05\n', '2025.\n5.05']) assert.equal(music.isReleaseDateFormat(value), false);
});
test('music stable sorting, automatic and explicit selection do not mutate inputs', () => {
  const data = { site: {}, discography: { digital: [{id:'a',releaseDate:'2025.05.05'}, {id:'old',releaseDate:'2025.5.5'}, {id:'b',releaseDate:'2026.01.01'}], demo: [{id:'c',releaseDate:'2026.01.01'},{id:'empty',releaseDate:''}] } };
  const before = structuredClone(data);
  assert.equal(music.resolveFeaturedRelease(data).id, 'b');
  assert.deepEqual(music.sortReleasesByDate([...data.discography.digital,...data.discography.demo]).map(x=>x.id), ['b','c','a','old','empty']);
  assert.deepEqual(data,before);
  data.site.featuredReleaseId='old'; assert.equal(music.resolveFeaturedRelease(data).id,'old');
  data.site.featuredReleaseId='gone'; assert.equal(music.resolveFeaturedRelease(data).id,'b');
  assert.equal(music.resolveFeaturedRelease({discography:{digital:[{releaseDate:'2025.05'}]}}),null);
  assert.equal(music.resolveFeaturedRelease({}),null);
});
test('music references clear after deletion, retain category moves and normalize only new keys', () => {
  const data={site:{featuredReleaseId:'r'},discography:{digital:[],demo:[{id:'r',playbackVideoId:'v',releaseType:'  Single  ',releaseDate:'old'},{id:'s',playbackVideoId:'v',releaseType:4},{id:'t',playbackVideoId:null}]},youtube:{musicVideos:[],liveMovies:[],demos:[{id:'v'}]}};
  const before=structuredClone(data);
  const kept=music.clearDanglingMusicReferences(data);
  assert.deepEqual(data,before); assert.equal(kept.site.featuredReleaseId,'r');
  assert.equal(kept.discography.demo[0].playbackVideoId,'v'); assert.equal(kept.discography.demo[0].releaseType,'  Single  ');
  assert.equal(kept.discography.demo[1].releaseType,''); assert.equal(kept.discography.demo[2].playbackVideoId,'');
  data.youtube.demos=[];
  assert.ok(music.clearDanglingMusicReferences(data).discography.demo.every(x=>x.playbackVideoId===''));
  data.discography.demo=[]; assert.equal(music.clearDanglingMusicReferences(data).site.featuredReleaseId,'');
  assert.equal(music.clearDanglingMusicReferences({site:{featuredReleaseId:7}}).site.featuredReleaseId,'');
});
