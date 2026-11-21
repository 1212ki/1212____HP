// Issue #47 stage 7: the build, the three ?v= and the operator README agree, and the README says what the screens now say.
//   T47-VERSION  ADMIN_BUILD_ID is dated the day of ?v=20261121-47; style.css, app.js and music-data.js carry the same ?v=; the unchanged scripts keep theirs;
//                the README names the build and the ?v=
//   T47-README   the README's operation section names the five tabs and the production wording of the buttons and the confirmation; it says there is no
//                header 保存 while the API is connected; it points at the commands that exist; it keeps the history sections and the known limits
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const html = readFileSync(join(repoRoot, 'admin/index.html'), 'utf8');
const readme = readFileSync(join(repoRoot, 'admin/README.md'), 'utf8');
const app = readFileSync(join(repoRoot, 'admin/app.js'), 'utf8');

const section = (heading) => {
  const start = readme.indexOf(`\n## ${heading}`);
  assert.ok(start >= 0, `README has "## ${heading}"`);
  const next = readme.indexOf('\n## ', start + 1);
  return readme.slice(start, next < 0 ? undefined : next);
};

test('T47-VERSION ADMIN_BUILD_ID is dated the day of ?v=20261121-47, the three assets carry the same ?v=, and the unchanged scripts keep theirs', () => {
  const build = html.match(/window\.ADMIN_BUILD_ID\s*=\s*'(\d{4})-(\d{2})-(\d{2})T(\d{4})Z';/);
  assert.ok(build, 'ADMIN_BUILD_ID is a date and a time (UTC): 2026-11-21T….Z');
  assert.equal(`${build[1]}${build[2]}${build[3]}`, '20261121');
  const versions = {
    style: html.match(/style\.css\?v=([\w-]+)/)?.[1],
    app: html.match(/app\.js\?v=([\w-]+)/)?.[1],
    music: html.match(/music-data\.js\?v=([\w-]+)/)?.[1],
  };
  assert.deepEqual(versions, { style: '20261121-47', app: '20261121-47', music: '20261121-47' });
  assert.ok(html.indexOf('music-data.js?v=') < html.indexOf('app.js?v='), 'the helper loads before the app');
  assert.match(html, /live-operations\.js\?v=20260804-2/);
  assert.match(html, /config\.js\?v=20260216-2001/);
  assert.equal(html.match(/\?v=20261120-46/g), null, 'no asset is left on the previous build');
  const revert = section('反映順序とrollback（Issue #47）');
  assert.ok(revert.includes(`\`${build[0].match(/'([^']+)'/)[1]}\``), 'the README names the build marker');
  assert.ok(revert.includes('`20261121-47`'), 'and the ?v=');
  assert.match(revert, /3つの`\?v=`を揃える/);
});

test('T47-README the operation section names the five tabs and the production wording, and says the header has no 保存 while the API is connected', () => {
  const tabs = section('タブ（5つ・Issue #47）');
  for (const tab of ['Site', 'News', 'Live', 'Music', 'Profile']) assert.ok(tabs.includes(`\`${tab}\``), `the tab ${tab}`);
  const operation = section('運用');
  assert.doesNotMatch(operation, /6タブ|YouTube|Disco/, 'the operation section does not describe the old six tabs');
  for (const phrase of ['保存して公開', '‹ 一覧', '+ 追加', 'JSONを書き出す', 'JSONを書き出す *', 'JSON書き出し待ち', '保存していない変更があります。', '破棄して移動', '編集を続ける',
    '保存済み', '未保存', '保存しています…', '保存できませんでした', 'やめる', '削除する', 'Site / News / Live / Music / Profile']) {
    assert.ok(operation.includes(phrase), `the operation section says: ${phrase}`);
  }
  assert.match(operation, /API接続中はheaderに`保存`のボタンが無い/);
  assert.match(operation, /Local Modeだけ、headerに`JSONを書き出す`/);
  // the words are the words the screens print (a README that names a button the app does not have is wrong)
  const printed = html + app;
  for (const phrase of ['保存して公開', '‹ 一覧', '+ 追加', 'JSONを書き出す', '保存していない変更があります。', '破棄して移動', '編集を続ける', '削除する', 'やめる', 'JSON書き出し待ち']) {
    assert.ok(printed.includes(phrase), `admin prints: ${phrase}`);
  }
});

test('T47-README the README points at the commands that exist, says never to type the real passphrase, and states the order and rollback without a Worker deploy', () => {
  const local = section('手元での確認（架空のAPI）');
  assert.match(local, /test\/support\/admin-preview\/fake_admin_server\.py --port 8080 --fixture test\/fixtures\/admin-occasional-states\.json/);
  assert.match(local, /本物の合言葉を入力しない/);
  assert.match(local, /tunnel[\s\S]*公開URLをAPIの向き先にする/);
  const capture = section('画面の確認（撮影）');
  for (const script of ['capture-admin-occasional.py', 'capture-admin-live.py', 'fake_admin_server.py']) {
    assert.ok((capture + local).includes(`test/support/admin-preview/${script}`), `README names ${script}`);
    assert.ok(readFileSync(join(repoRoot, 'test/support/admin-preview', script), 'utf8').length > 1000, `${script} exists`);
  }
  assert.ok(readFileSync(join(repoRoot, 'test/fixtures/admin-occasional-states.json'), 'utf8').length > 1000, 'the fixture exists');
  const revert = section('反映順序とrollback（Issue #47）');
  assert.match(revert, /Cloudflare Workerは変更しないので、deployはない/);
  assert.match(revert, /mergeした時点で本番の管理画面が入れ替わる/);
  assert.match(revert, /#47の差分だけを戻すPR/);
  assert.match(revert, /D1全体は巻き戻さない/);
});

test('T47-README the known limits a user needs are written, and the history sections of #41 to #46 stay', () => {
  assert.ok(readme.includes('### 既知の制限（Issue #47）'));
  const known = readme.slice(readme.indexOf('### 既知の制限（Issue #47）'), readme.indexOf('\n## 設定'));
  for (const phrase of ['別の端末の保存を取り込む仕組みは持たない', 'iPhoneのSafari', '保存のたびに元のカテゴリから外れて保存先のカテゴリの先頭へ移る',
    '幅900px以上で`保存して公開`が2つ見える', '数秒のあいだ下に固定した`保存して公開`に重なる']) {
    assert.ok(known.includes(phrase), `known limit: ${phrase}`);
  }
  for (const heading of ['## 作品の選択・再生映像・種別（Issue #41）', '### #42の公開反映（履歴）', '### #44・#43・#45のまとめ出し', '### #41の反映と復旧（履歴）',
    '## Liveの新しい流れ（Issue #46）', '## 反映順序とrollback（Issue #46・履歴）']) {
    assert.ok(readme.includes(heading), `history stays: ${heading}`);
  }
  assert.doesNotMatch(readme, /fixture-admin-token|sk-[A-Za-z0-9]{10,}/, 'no token in the README');
});
