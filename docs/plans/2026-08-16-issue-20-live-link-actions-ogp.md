# Issue #20 Liveリンク操作・OGP調査 実装計画

- 対象Issue: #20
- 作成日: 2026-08-16
- 実装入力: `docs/specs/current/system-design-principles.md` / `docs/specs/current/live-operations-admin-ui.md`
- 設計状態: Approved
- 設計証跡: `e64fd73` / `4296ebd`
- 実装branch: `feature/20-live-link-actions-ogp`

## 1. 目的と完了状態

保存済みLiveの告知面で、既存の `getCanonicalLiveUrl` が返す詳細URLだけをコピーできるようにする。`Xを開く`、投稿文コピー、リンクコピーは、入力欄より弱いcompactな同一操作列にまとめる。未保存Liveやclipboard失敗を安全に扱い、いずれの操作も保存処理を起動しない。

合わせて、コピー／X投稿に含まれる正本URLでOGPが表示されない原因をIssue #20の証跡として固定する。Live固有OGPの修復は本Issueでは実装せず、必要なowner/external follow-upを記録する。別Issue化はowner/VECTORへ推奨するに留める。

## 2. 設計・統合ゲート

- 現行設計の正本は `docs/specs/current/`。`documents/` や未統合の旧planを仕様判断に使わない。
- Approved設計commit `e64fd73` / `4296ebd` を設計証跡とする。Issue #22とそのfollow-upである#27はcurrent `main` へ統合済みで、固定baselineは `HEAD == origin/main == 6d6bb1b94ad28b027c636f95b905d2c66e038538` である。
- `feature/20-live-link-actions-ogp` は上記baselineを指しており、worktreeの差分は未追跡の本計画だけである。Issue #20の対象3ファイルに予期しない重複差分はない。
- current mainのDOM、handler、CSS、test harnessを再読し、`getCanonicalLiveUrl` の呼出し、保存済みID source、告知actionのDOM/event wiring、専用CSSを追加するseam、focused test harnessが本計画と一致することを確認してからREDへ進む。競合や追加の仕様判断が残る場合はSC4で停止する。
- 通常の `main` 向けPRを作成し、独断で別branchの設計差分をIssue #20 PRへ混在させない。
- 本計画はApproved仕様を実装手順へ分解するものであり、新しい仕様判断の正本にはしない。

## 3. 対象と非対象

### 対象ファイル

- `admin/app.js`
- `admin/style.css`
- `test/admin-live-operations.test.mjs`

### 非対象

- Issue #19の投稿formatter・preview内容
- Issue #21のAI抽出・prompt・置換・Worker処理
- 汎用 `.field-row` のlayout
- `getCanonicalLiveUrl` とは別のLive URL実装
- Cloudflare/DNS/CDN/hosting設定、production deploy
- `live/detail/index.html` へのgeneric OGP追加
- 共有URLをWorker `/og/live/:liveId` に戻す変更

## 4. 実装仕様

### 4.1 リンクコピー

- 保存済みLiveでは、保存済みgate通過後に既存 `getCanonicalLiveUrl(currentEditId)` を呼び、その戻り値だけをclipboardへ渡す。`readLiveFromModal().id` は現行実装上 `currentEditId` から導出される同値であり、別の実装選択肢にはしない。別URL builderは追加しない。
- 投稿本文、ハッシュタグ、管理者コメント、予約URLは混ぜない。
- 未保存Liveではリンクコピーボタンをdisabledにし、clipboard・fallback・save handlerを呼ばない。
- コピー成功／失敗は既存toastで通知する。
- Clipboard API失敗時は既存fallbackを使い、fallback結果に対応したtoastを出す。

### 4.2 操作列

- `Xを開く`、投稿文コピー、リンクコピーを専用action-row classの同一行に置く。
- desktop/mobileともsecondary actionとしてcompactに表示する。
- 狭幅では必要時だけwrapし、横overflowを発生させない。
- generic `.field-row` や他formのbutton layoutは変更しない。

### 4.3 保存との分離

- 上記3操作はLive保存handlerを呼ばない。
- 未保存Liveのリンクコピーを理由に暗黙saveしない。
- `保存して公開` とX/clipboardの成功・失敗状態を混同しない。

## 5. OGP調査結果と境界

### 5.1 確認済みデータフロー

1. `admin/app.js` の `getCanonicalLiveUrl` が `https://1212hp.com/live/detail/?liveId=<id>` を生成する。
2. リンクコピーはそのURLだけを共有し、X Web Intentは同じURLを投稿本文内にencodeする。
3. canonical URLはGitHub Pagesの静的 `live/detail/index.html` を返す。
4. 初期HTMLに `og:*` / `twitter:*` はなく、Live情報はbrowser JavaScriptがWorker APIから取得した後に描画される。
5. 既存Worker `/og/live/:liveId` はLive固有のOG/Twitter metadataを正常に返すが、現在共有される正本URLとは別origin/pathである。

したがって原因はmetadata builderやWeb Intent encodingではなく、正本URLの初期HTTPレスポンスを静的GitHub Pagesが担当しているserving/routing境界にある。

### 5.2 本Issueで修復しない理由

Live固有OGPを正本URLで返すには、同一canonical requestをserver-side runtimeで処理するrouting/hosting設計、crawler/humanの応答設計、cache/fallback設計、production設定・deployが必要である。これはIssue #20の権限・非スコープを超える。

generic static cardはLive固有title/description/imageを失うため代替にしない。Worker URLへの差し戻しは正本URLを二重化するため行わない。client JavaScriptによるmeta追加もcrawlerの初期レスポンスを直さないため行わない。

### 5.3 Owner/VECTORへ推奨するfollow-upと最小test seam

- Live固有OGPの修復は別scopeとしてowner/VECTORへ推奨する。別Issueはownerが明示承認した場合のみ作成・リンクする。
- Issue #20には「本Issueでは未修復」「same-origin server rendering/routingとproduction deployが必要」「owner/external follow-up」を正確に記録する。未作成の別Issueリンクをcompletion条件にしない。
- 修復scopeが承認された場合は、次のtest seamを設計入力にする。

- Twitterbot相当のrequestを正本URL形 `https://1212hp.com/live/detail/?liveId=structured-og` に送るroute testを追加する。
- JavaScript実行なしの初期HTMLで、同一canonical `og:url`、Live固有 `og:title` / `og:description` / `og:image` と対応する `twitter:*` を検証する。
- 既存 `/og/live/:liveId` testはmetadata builderの下位回帰として維持、または同一builderへ集約する。
- deploy後に同じ正本URLへ `Twitterbot/1.0` のread-only smoke checkを行う。platform cacheとorigin responseを分けて判定する。

## 6. Strict TDD実行順

### RED

current mainのtest harnessを再読し、RED test追加前のtest-only準備として `loadAdminApp(options)` を拡張し、Clipboard APIの拒否と `document.execCommand` のtrue/falseを注入できるようにする。これはtest harnessだけの変更とし、productionの `copyToClipboard` をtest都合で変更しない。

その後、`test/admin-live-operations.test.mjs` にtest名が `Issue #20 live link actions` を含むfocused testを先に追加する。production code変更前に次を実行し、exit 1を確認する。

```sh
node --test --test-name-pattern='Issue #20 live link actions' test/admin-live-operations.test.mjs
```

packetには実行command、exit code、失敗test名、最初に失敗したassertion、expected/actualを記録する。期待する最初の失敗は、次のいずれかの未実装behaviorを直接示すものに限る。

検証するbehavior:

1. link copy controlが未存在または未配線。
2. 未保存Liveでcontrolがdisabledになっていない、またはclipboard/fallback/saveが呼ばれる。
3. Clipboard API拒否時のfallback/toast結果が期待と異なる。
4. Web Intent、投稿文コピー、リンクコピーのいずれかでsave callが0ではない。
5. 3操作が専用compact action rowに属していない、または専用CSSのwrap/overflow contractがない。

### GREEN

1. `admin/app.js` に最小限のリンクコピーactionとsaved/unsaved gateを追加する。
2. 既存clipboard helper/fallback/toastを再利用する。
3. 3操作を専用action-rowへまとめる。
4. `admin/style.css` に専用classだけのcompact/wrap rulesを追加する。
5. REDと同じcommandを再実行し、exit 0をpacketへ記録する。

```sh
node --test --test-name-pattern='Issue #20 live link actions' test/admin-live-operations.test.mjs
```

### REFACTOR

- GREENを保ったまま重複だけを整理する。
- URL helper、formatter、AI処理、汎用layoutへ変更を広げない。
- refactor後にfocused testとroot suiteを再実行する。

## 7. 失敗時挙動

| 状態 | 期待動作 |
|---|---|
| Live未保存／IDなし | リンクコピーdisabled。空文字copy、fallback、saveなし |
| Clipboard API成功 | canonical URLのみcopyし、既存成功toast |
| Clipboard API失敗・fallback成功 | fallbackでcanonical URLのみcopyし、既存成功toast |
| Clipboard API失敗・fallback失敗 | 入力と保存状態を変えず、既存失敗toast |
| X外部遷移 | 保存状態と分離し、saveなし |
| 狭幅 | action rowだけwrapし、horizontal overflowなし |

## 8. Acceptance Criteria trace

| AC | 計画上の証跡 |
|---|---|
| AC1 | §4.1、RED-1 |
| AC2 | §4.1、RED-2、§7 |
| AC3 | §4.2、RED-5 |
| AC4 | §4.1、RED-3、§7 |
| AC5 | §4.3、RED-2/4 |
| AC6 | §6の同一name-pattern commandによるRED exit 1／GREEN exit 0とfailure evidence記録 |
| AC7 | §5.1とworker packetのFact / Inference / Gap証跡をIssue #20へ同期 |
| AC8 | §5.2/5.3のprecise owner/external follow-up。「未修復」を明記し、別Issueはowner承認・作成済みの場合のみリンク |
| AC9 | §9のfocused/root/syntax/diff/secret・scope確認 |
| AC10 | executorとは別のspec reviewerとcode-quality reviewer承認後にDraft PR |
| AC11 | 本計画がIssue #20、OGP原因、境界、data flow、失敗、testを記録 |
| AC12 | §2で `docs/specs/current/` / `docs/plans/` / `documents/` の権限を固定 |
| AC13 | §2でApproved証跡に加え、#22の安定・main統合・feature更新・対象seam再読までproduction code/test実装を禁止 |

## 9. 検証とcompletion gate

実装workerは以下のexact command、exit code、要約をpacketへ残す。REDのみ期待値はexit 1で、以降はすべてexit 0を要求する。

```sh
# RED: 新規focused testのみ。期待するassertion failureとexit 1を記録
node --test --test-name-pattern='Issue #20 live link actions' test/admin-live-operations.test.mjs

# GREEN: REDと同一commandでexit 0
node --test --test-name-pattern='Issue #20 live link actions' test/admin-live-operations.test.mjs

# 関連file suite
node --test test/admin-live-operations.test.mjs

# repository root suite
node --test test/*.test.mjs

# syntax / diff
node --check admin/app.js
node --check test/admin-live-operations.test.mjs
git diff --check
```

追加gate:

1. 実装前に、#22/#27が統合された固定baseline `HEAD == origin/main == 6d6bb1b94ad28b027c636f95b905d2c66e038538` にfeature branchがあり、worktree差分が未追跡の本計画だけであることを確認する。
2. current mainの対象3ファイルを再読し、ID source、DOM/event/CSS/test seamが計画と一致することを記録する。不一致・競合・新しい仕様判断があればSC4で停止する。
3. `git status --short` とdiffで対象3ファイル＋本計画以外の予期しない差分がないことを確認する。
4. `.env`、credential、key/pem、CSV、secretらしき内容がstage対象にないことを確認する。
5. executorとは別のspec reviewerがAC1–AC13、別code-quality reviewerが実装品質をAPPROVEDする。
6. OGPについてprecise owner/external follow-upをIssue #20へ記録する。別Issueリンクはowner承認のもと作成済みの場合だけ求める。
7. 上記を満たした後にDraft PRを作成する。merge/deployは行わない。

## 10. Rollback

- 本Issueはadminの表示・event handler・CSSとtestだけの変更で、schema/API/data migrationを含まない。
- 不具合時はowner判断でIssue #20の単一commit/PRを通常のrevert commitにより戻す。history rewrite、force-push、destructive resetは使わない。
- OGP servingは本Issueで変更しないため、本Issue rollbackにDNS/CDN/Worker deploy操作は含まれない。
