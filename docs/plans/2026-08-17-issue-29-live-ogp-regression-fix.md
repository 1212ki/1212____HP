# Issue #29 Live OGP Regression Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 保存済みLiveのX投稿preview、Web Intent、リンクコピーを、Live固有OGPを返す既存Workerのstable share URLへ復旧する。

**Architecture:** adminは固定Worker originから`/og/live/:liveId`を組み立て、その同一URLをX投稿previewとclipboardへ渡す。Workerは変更せず、既存routeがLive固有metadataを初期HTMLで返し、canonical／`og:url`／human destinationだけを`1212hp.com`のLive詳細に保つ契約をcharacterization testで固定する。

**Tech Stack:** Vanilla JavaScript、Cloudflare Worker、Node.js test runner。

---

**Repository policy override:** 実装workerはcommit、push、PR作成、merge、deploy、X cache refreshを行わない。`writing-plans`のcommit例よりworkspace方針を優先し、検証済み未commit差分をreviewへ渡す。別review完了後のDraft PR境界はTask 5で定義する。

## Grounded facts and fixed decisions

### Repository facts

- 計画作成時のHEADは`4defa036f010c1b5eb1cd20755c62a05d50b17f0`。root suiteは177 tests PASS、Worker suiteは96 tests PASSである。
- `admin/app.js:55`には固定Worker origin `CANONICAL_API_BASE_URL = 'https://1212hp.itsukimatsumoto.workers.dev'`がある。SC1の「deterministic canonical Worker originがない」状態ではない。
- 現行`admin/app.js:3050-3065`は`getCanonicalLiveUrl`でcanonical detail URLを作り、X投稿previewへ渡す。`admin/app.js:3235-3265`のWeb Intentはそのpreviewを使い、リンクコピーも同じcanonical detail URLを使う。
- `cloudflare/worker/src/worker.js:1647-1688`の既存`GET /og/live/:liveId`は、Live固有OG/Twitter metadataを初期HTMLで返す。canonical link、`og:url`、JavaScript redirect、`詳細を見る`リンクはcanonical detail URLを指す。Live不在は404／`no-store`である。
- `cloudflare/worker/test/og-live.test.js`はmetadata formatterを検証しているが、UA、canonical、`og:url`、human fallback／redirectの一体契約はまだ固定していない。

### Owner-approved decisions

- stable share URLは`https://1212hp.itsukimatsumoto.workers.dev/og/live/:liveId`とし、保存済みLiveのX投稿preview、Web Intent、リンクコピーで同一値を使う。
- canonical detail URLは`https://1212hp.com/live/detail/?liveId=...`とし、Worker HTMLのcanonical、`og:url`、human destinationとして維持する。共有文字列としては使わない。
- `liveId`は`encodeURIComponent`する。stable share URLへcache-bust queryを付けない。
- この設計は`docs/plans/2026-08-16-issue-20-live-link-actions-ogp.md`に残るcanonical detail共有の判断だけをsupersedeする。同planは履歴として書き換えず、unsaved gate、clipboard fallback、save-free behavior、compact action rowは維持する。

### Non-goals

- Worker production source、public Live detail、DNS/CDN/hosting、API/data schemaを変更しない。
- Issue #19のformatter内容、Issue #21のAI抽出、generic admin UIを変更しない。
- 新規配信基盤、same-origin routing、cache-bust、X cache refreshを追加しない。
- merge、production deploy、PR approvalを行わない。

## Task 1: Baselineと実装seamを固定する

**Files:**
- Read: `admin/app.js:52-73`
- Read: `admin/app.js:3050-3065`
- Read: `admin/app.js:3235-3265`
- Read: `test/admin-live-operations.test.mjs:2420-2540`
- Read: `cloudflare/worker/src/worker.js:357-408`
- Read: `cloudflare/worker/src/worker.js:1647-1688`
- Read: `cloudflare/worker/test/og-live.test.js:1-75`

**Step 1: worktreeの開始状態を確認する**

Run:

```sh
git status --short
git rev-parse HEAD
```

Expected: implementation用の予期しない差分がない。current specと本planが未commitで残っている場合はpre-existing docs差分として記録し、実装workerは編集しない。HEAD差異や対象code/testの既存差分があれば実装を止め、orchestratorへ返す。

**Step 2: pre-change root baselineを確認する**

Run: `node --test test/*.test.mjs`

Expected: exit 0、177 tests PASS。失敗または件数差異があればIssue #29のREDとして扱わず、baseline driftとして停止する。

**Step 3: pre-change Worker baselineを確認する**

Run: `cd cloudflare/worker && npm test`

Expected: exit 0、96 tests PASS。失敗または件数差異があればbaseline driftとして停止する。

**Step 4: URL data flowを再確認する**

`getCanonicalLiveUrl`の全call site、`buildXIntentUrlFromModal`、`copyLiveLinkFromModal`、Worker `/og/live/:liveId` routeを読む。上記Grounded factsと異なる場合、新しい仕様判断をせず停止する。

## Task 2: 既存Worker routeをcharacterization testで固定する

**Files:**
- Modify: `cloudflare/worker/test/og-live.test.js:1-75`
- Do not modify: `cloudflare/worker/src/worker.js`

**Step 1: 既存behaviorのcharacterization testを書く**

`cloudflare/worker/test/og-live.test.js`へ次のtestを追加する。これは既存routeの観測を固定するtestであり、Issue #29のREDには数えない。

```js
test("Issue #29 Worker OGP route characterization keeps canonical metadata and human destination for bot and human UAs", async () => {
  const live = {
    id: "issue-29-characterization",
    date: "2026-08-17",
    title: "Issue 29 Live",
    venue: "Hall",
    image: "https://cdn.example/issue-29.jpg",
  };
  const shareUrl = "https://1212hp.itsukimatsumoto.workers.dev/og/live/issue-29-characterization";
  const canonicalUrl = "https://1212hp.com/live/detail/?liveId=issue-29-characterization";
  const bodies = [];

  for (const userAgent of ["Twitterbot/1.0", "Mozilla/5.0"]) {
    const response = await worker.fetch(
      new Request(shareUrl, { headers: { "User-Agent": userAgent } }),
      createEnv(live),
      {},
    );
    const html = await response.text();
    bodies.push(html);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, max-age=300");
    assert.ok(html.includes(`<link rel="canonical" href="${canonicalUrl}" />`));
    assert.ok(html.includes(`<meta property="og:url" content="${canonicalUrl}" />`));
    assert.ok(html.includes('<meta property="og:title" content="Issue 29 Live'));
    assert.ok(html.includes('<meta property="og:description"'));
    assert.ok(html.includes('<meta property="og:image" content="https://cdn.example/issue-29.jpg" />'));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image" />'));
    assert.ok(html.includes('<meta name="twitter:title" content="Issue 29 Live'));
    assert.ok(html.includes('<meta name="twitter:description"'));
    assert.ok(html.includes('<meta name="twitter:image" content="https://cdn.example/issue-29.jpg" />'));
    assert.ok(html.includes('<a class="btn" href="' + canonicalUrl + '" rel="noopener">詳細を見る</a>'));
    assert.ok(html.includes(`location.replace(${JSON.stringify(canonicalUrl)})`));
    assert.doesNotMatch(html, /[?&](?:v|t|cacheBust)=/);
  }

  assert.equal(bodies[0], bodies[1]);

  const missing = await worker.fetch(
    new Request("https://1212hp.itsukimatsumoto.workers.dev/og/live/missing"),
    createEnv(live),
    {},
  );
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("cache-control"), "no-store");
});
```

**Step 2: characterizationがproduction変更前からPASSすることを確認する**

Run:

```sh
cd cloudflare/worker
node --test --test-name-pattern='Issue #29 Worker OGP route characterization' test/og-live.test.js
```

Expected: exit 0、対象test PASS。これをRED証跡として報告しない。FAILする場合はWorker sourceを直さず、SC1またはbaseline driftとして停止する。

## Task 3: Admin共有契約のfailing regression testを書く

**Files:**
- Modify: `test/admin-live-operations.test.mjs:2420-2540`
- Do not modify yet: `admin/app.js`

**Step 1: canonical detail共有を直接検出するtestを書く**

`test/admin-live-operations.test.mjs`へ次のtestを追加する。

```js
test('Issue #29 live OGP share URL replaces canonical detail across preview, Intent, and link copy', async () => {
  const liveId = 'live copy/東京?';
  const encodedId = encodeURIComponent(liveId);
  const shareUrl = `https://1212hp.itsukimatsumoto.workers.dev/og/live/${encodedId}`;
  const canonicalUrl = `https://1212hp.com/live/detail/?liveId=${encodedId}`;
  const app = loadAdminApp();
  app.setSiteData({ live: { upcoming: [{ id: liveId }], past: [] } });
  app.editLive(liveId, 'upcoming');
  setLiveForm(app.elements);
  app.setSaveSpy();

  app.updateXPreviewInModal();
  const firstPreview = app.elements.get('x-post-preview').value;
  app.updateXPreviewInModal();
  const secondPreview = app.elements.get('x-post-preview').value;

  assert.equal(firstPreview.endsWith(shareUrl), true);
  assert.equal(secondPreview, firstPreview);
  assert.equal(firstPreview.includes(canonicalUrl), false);
  assert.equal(new URL(shareUrl).search, '');

  const intent = new URL(app.buildXIntentUrlFromModal());
  assert.equal(intent.searchParams.get('text'), firstPreview);
  assert.equal(intent.searchParams.get('text').endsWith(shareUrl), true);
  assert.equal(intent.searchParams.get('text').includes(canonicalUrl), false);

  assert.equal(await app.copyLiveLinkFromModal(), true);
  assert.deepEqual(app.clipboardWrites, [shareUrl]);
  assert.equal(app.getSaveCalls(), 0);
});
```

**Step 2: production変更前のREDを確認する**

Run: `node --test --test-name-pattern='Issue #29 live OGP share URL' test/admin-live-operations.test.mjs`

Expected: exit 1。最初のfailureは`firstPreview.endsWith(shareUrl)`の`false !== true`で、現行previewが`https://1212hp.com/live/detail/?liveId=...`で終わることを示す。test harness、syntax、無関係なbehaviorのfailureは有効なREDに数えない。command、exit code、test名、最初のassertion、expected/actualを証跡に残す。

**Step 3: 既存admin testのURL期待値を新契約へ揃える**

production codeをまだ編集せず、同じfileの次の期待値だけを更新する。

- `unified X announcement preview drives Intent and copy without save`がformatterへ渡す末尾URLを`https://1212hp.itsukimatsumoto.workers.dev/og/live/live-x`へ変更する。
- 旧`Issue #20 live link actions copy only the saved canonical URL and keep X actions save-free`を`Issue #29 supersedes the Issue #20 URL choice while keeping live link actions save-free`へ変更する。local変数を`const shareUrl = 'https://1212hp.itsukimatsumoto.workers.dev/og/live/' + encodeURIComponent(liveId);`に置き換え、preview末尾、Intent末尾、clipboardの期待値をすべて`shareUrl`へ揃える。
- clipboard fallback成功／失敗testのlocal変数を`shareUrl = 'https://1212hp.itsukimatsumoto.workers.dev/og/live/fallback-live'`へ変更し、clipboardとfallback textareaの期待値を`shareUrl`へ揃える。
- unsaved gate、fallback、toast、save回数、compact action rowのassertionは変更しない。
- `assets/js/live-operations.js`と`test/live-operations.test.mjs`は変更しない。formatterは渡されたURLを末尾へ置く純粋関数のまま保つ。

**Step 4: REDがURL契約だけで継続することを確認する**

Run: `node --test --test-name-pattern='Issue #29 live OGP share URL' test/admin-live-operations.test.mjs`

Expected: exit 1。Step 2と同じcurrent admin URL contractによるfailureであり、production変更はまだない。

## Task 4: Adminのshare helperとcall siteを最小変更する

**Files:**
- Modify: `admin/app.js:3050-3065`
- Modify: `admin/app.js:3259-3265`
- Test: `test/admin-live-operations.test.mjs`
- Do not modify: `assets/js/live-operations.js`
- Do not modify: `cloudflare/worker/src/worker.js`

**Step 1: share URL helperへ置き換える**

`getCanonicalLiveUrl`を次の`getLiveShareUrl`へ置き換える。実行中に変わり得る`API_BASE_URL`ではなく、固定`CANONICAL_API_BASE_URL`を使う。

```js
function getLiveShareUrl(liveId) {
  const origin = String(CANONICAL_API_BASE_URL || '').replace(/\/+$/, '');
  const id = String(liveId || '').trim();
  return origin && id ? `${origin}/og/live/${encodeURIComponent(id)}` : '';
}
```

**Step 2: X投稿previewのcall siteをshare URLへ切り替える**

`updateXPreviewInModal`を次の形にする。formatter自体は変更しない。

```js
const shareUrl = isNewItem ? '' : getLiveShareUrl(live.id);
previewEl.value = operations.buildXAnnouncementText(live, live.xComment, shareUrl);
```

`buildXIntentUrlFromModal`は現在どおりpreview全文を`text` parameterへ渡すため変更しない。これによりpreviewとWeb Intentが同一stable share URLを使う。

**Step 3: リンクコピーのcall siteをshare URLへ切り替える**

`copyLiveLinkFromModal`のsaved gateとclipboard fallback/toastを維持し、URL取得だけを変更する。

```js
async function copyLiveLinkFromModal() {
  if (isNewItem || !currentEditId) return false;
  const shareUrl = getLiveShareUrl(currentEditId);
  if (!shareUrl) return false;
  const ok = await copyToClipboard(shareUrl);
  showToast(ok ? 'リンクをコピーしました' : 'コピーできませんでした', ok ? 'success' : 'error');
  return ok;
}
```

**Step 4: 同一focused commandでGREENを確認する**

Run: `node --test --test-name-pattern='Issue #29 live OGP share URL' test/admin-live-operations.test.mjs`

Expected: exit 0、対象test PASS。previewを2回生成しても同じstable share URLで、canonical detailとcache-bustが混入せず、clipboardはshare URLだけ、save回数は0である。

**Step 5: admin file suiteを通す**

Run: `node --test test/admin-live-operations.test.mjs`

Expected: exit 0。新規1 testを含むadmin file suiteがすべてPASSし、Issue #20由来のunsaved、fallback、save-free、compact row testもPASSする。

## Task 5: 全検証、独立review、Draft PR境界を通す

**Files:**
- Verify: `admin/app.js`
- Verify: `test/admin-live-operations.test.mjs`
- Verify: `cloudflare/worker/test/og-live.test.js`
- Read-only review input: `docs/specs/current/live-operations-admin-ui.md`
- Read-only review input: `docs/plans/2026-08-17-issue-29-live-ogp-regression-fix.md`

**Step 1: focused admin testを再実行する**

Run: `node --test --test-name-pattern='Issue #29 live OGP share URL' test/admin-live-operations.test.mjs`

Expected: exit 0、対象test PASS。

**Step 2: admin file suiteを再実行する**

Run: `node --test test/admin-live-operations.test.mjs`

Expected: exit 0、全test PASS。

**Step 3: root回帰を実行する**

Run: `node --test test/*.test.mjs`

Expected: exit 0、pre-change baseline 177に新規admin regression test 1件を加えた178 tests PASS。

**Step 4: Worker characterizationを再実行する**

Run: `cd cloudflare/worker && node --test --test-name-pattern='Issue #29 Worker OGP route characterization' test/og-live.test.js`

Expected: exit 0、対象test PASS。これは既存routeのcharacterizationであり、REDではない。

**Step 5: Worker全回帰を実行する**

Run: `cd cloudflare/worker && npm test`

Expected: exit 0、pre-change baseline 96にcharacterization test 1件を加えた97 tests PASS。Worker production sourceのdiffは0件である。

**Step 6: syntaxを確認する**

Run:

```sh
node --check admin/app.js
node --check test/admin-live-operations.test.mjs
node --check cloudflare/worker/test/og-live.test.js
```

Expected: 3 commandすべてexit 0、出力なし。

**Step 7: diffとscopeを確認する**

Run:

```sh
git diff --check
git status --short
git diff --name-only
git diff --stat
```

Expected: `git diff --check`はexit 0。implementation差分は`admin/app.js`、`test/admin-live-operations.test.mjs`、`cloudflare/worker/test/og-live.test.js`だけで、production変更は`admin/app.js`だけである。spec／planがpre-existing未commit差分なら別枠で記録し、実装workerは変更しない。それ以外の差分があれば停止する。

**Step 8: secret混入を確認する**

Run:

```sh
if git diff --name-only | rg -n '(^|/)(\.env($|\.)|.*credentials.*|.*\.(pem|key|p12|csv)$)'; then
  echo 'unexpected sensitive file in diff'
  exit 1
else
  echo 'sensitive filename scan: clean'
fi

if git diff -- admin/app.js test/admin-live-operations.test.mjs cloudflare/worker/test/og-live.test.js \
  | rg -n '(?i)(api[_-]?key\s*[:=]|admin[_-]?token\s*[:=]|password\s*[:=]|-----BEGIN [A-Z ]*PRIVATE KEY-----)'; then
  echo 'potential secret in diff'
  exit 1
else
  echo 'secret content scan: clean'
fi
```

Expected: 両方exit 0で`clean`。固定Worker originは公開URLでありsecretではない。

**Step 9: executorとは別のspec reviewerを通す**

reviewerはread-onlyでIssue #29、current spec、本plan、diff、RED/GREEN証跡を確認し、少なくとも次をAC-by-ACで判定する。

- X投稿preview、Web Intent、リンクコピーが同一stable share URLを使う。
- canonical detail URLが共有文字列へ混入せず、Worker側のcanonical／`og:url`／human destinationには残る。
- cache-bustなし、unsaved gate、clipboard fallback、save-free behaviorを維持する。
- Worker UA testをcharacterizationとして扱い、admin testだけをRED/GREEN証跡にしている。
- production scopeが`admin/app.js`のshare helperとcall siteだけで、non-goalへ広がっていない。

Expected verdict: `APPROVED`。`REJECTED`または`BLOCKED`ならDraft PRへ進まない。

**Step 10: executor／spec reviewerとは別のcode-quality reviewerを通す**

reviewerはread-onlyでURL encoding、固定origin、empty ID、test determinism、既存formatter／fallbackの再利用、scope、secretを確認する。

Expected verdict: `APPROVED`。指摘があればimplementation workerが最小修正し、Task 4 Step 4から全verificationと両reviewをやり直す。

**Step 11: Draft PR境界でhandoffする**

両reviewが`APPROVED`で全gateがPASSした後、実装workerはverified uncommitted diffと証跡をVECTORへ返す。VECTORまたは明示的に権限を与えられたrelease executorだけが、scopeを再確認してintentional commit、branch push、`Closes #29`を含むDraft PR作成を行う。

Draft PR作成はreview入口であり、PR approval、merge、production deploy、X cache refreshの承認ではない。これらはowner-onlyで、別の明示承認があるまで実行しない。

## Post-merge verification and rollback boundary

- ownerがmerge／deployを明示承認して完了した後にのみ、同一stable share URLへ`Twitterbot/1.0`とhuman UAでread-only requestを送る。
- bot responseではLive固有`og:*`／`twitter:*`、canonical detailを確認し、human responseではredirectまたは`詳細を見る`fallbackを確認する。
- origin responseが正しくX cardだけが古い場合はplatform cacheとして分離し、cache-bust URLを作らない。
- 回帰時はowner判断で通常のrevert commitを使う。history rewrite、force-push、destructive reset、DNS/CDN/hosting変更は行わない。
