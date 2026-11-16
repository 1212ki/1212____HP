# Build/Test Result — AI整理のprovider自動切替（Issue #33）

- 状態: 全回帰PASS / B1解消 / gate 4・5未承認
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-16_issue-33_ai-provider-fallback`
- 作成日: 2026-11-16
- 実行環境: 正式回帰はNode `v20.19.4`（`/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin/node`）。環境差の追加検証はNode `v24.4.1`（`/opt/homebrew/bin/node`）。既存のWorker依存を使用

## 検証で成立したこと

OpenAI→Claudeの自動切替と成功provider表示のfocused testは、production codeを変える前のREDからGREENへ移行した。変更前baselineと同じNode v20.19.4で承認済みPlanのcommand群を再実行し、すべてexit 0を確認した。指定されたroot全回帰`node --test test/`は239/239、Worker全回帰は268/268、admin全回帰は154/154 PASSだった。

Node v24.4.1ではdirectory引数が`MODULE_NOT_FOUND`になる。同じ4ファイルをglobで指定すれば239/239 PASSとなり、B1は実行環境差として解消した。全回帰を通過した自己検証済み候補であり、独立reviewとOwner gate 4・5は未実施である。

## 実行commandと結果

以下は2026-11-16T14:03:58〜14:04:11+09:00に実行したfreshな結果である。`PATH=/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`を設定し、`node --version`が`v20.19.4`であることを確認した。承認済みPlan §4・§6のcommandを変更していない。testは外部fetchをstubし、実API・実secret・networkを使っていない。

| command（repository rootから） | 件数・結果 |
|---|---|
| `node --test cloudflare/worker/test/live-ai-source-intake.test.js` | 182/182 PASS、exit 0 |
| `node --test --test-name-pattern='AIで整理 source intake' test/admin-live-operations.test.mjs` | 対象81/81 PASS、登録150 / skipped 69（name pattern対象外）、exit 0 |
| `node --test test/admin-live-operations.test.mjs` | 154/154 PASS、exit 0 |
| `node --test test/` | 239/239 PASS、exit 0（baselineの178件に61件追加） |
| `npm --prefix cloudflare/worker test` | 268/268 PASS、exit 0（baselineの97件に171件追加） |
| `node --check cloudflare/worker/src/worker.js` | PASS、exit 0 |
| `node --check admin/app.js` | PASS、exit 0 |
| `scripts/aidlc-verify.sh --local` | PASS、exit 0。v1.0.1、manifest `02c49d1de2167f0ed2c90123871bce6d96cf052294672f451df83b1aa5cff9e9`。source authenticityは未確認 |
| `scripts/aidlc-cycle.sh status` | PASS、exit 0。Issue #33 / Code Generation Result / In Progress |
| `git diff --check` | PASS、exit 0 |
| `git status --short`、`git diff --stat` | 確認済み。前工程の既存差分と今回の許可範囲内変更を区別 |

上記v20のtest runはfail / cancelledが0。name patternで絞ったadmin focusedの対象外69件を除き、skippedは0。root・Worker・adminの全件回帰ではskippedは0だった。前回の実行環境はv24.4.1で、baseline取得時はv20.19.4だった。今回、その既存runtimeを選んで指定commandの成功を直接確認した。

### Node v24.4.1での環境差の確認

`/opt/homebrew/bin/node`の`--version`が`v24.4.1`であることを確認し、同じcode・testで次を実行した。rootのglobは`test/admin-image-form.test.mjs`、`test/admin-live-operations.test.mjs`、`test/live-operations.test.mjs`、`test/public-ticket-routing.test.mjs`の4ファイルに展開される。

| command / 実行場所 | 件数・結果 |
|---|---|
| `node --test test/` / repository root | 14:04:38+09:00、exit 1、`MODULE_NOT_FOUND`。実test未起動、runner入口1件FAIL |
| `node --test test/*.test.mjs` / repository root | 14:05:24+09:00、239/239 PASS、exit 0 |
| `node --test` / `cloudflare/worker` | 14:05:28+09:00、268/268 PASS、exit 0 |

成功した2件はfail / cancelled / skippedとも0。v24のglob指定は同じtest集合が通ることを確かめる追加検証であり、正式回帰はv20.19.4でPlanのdirectory引数をそのまま使っている。

## RED → GREENの根拠

Workerはproduction未変更で182件中166件FAIL、adminは81件中12件FAILを確認した。OpenAIの失敗38 fixturesとClaudeの失敗45 fixturesのsingle/dual構成、wire contract、deadline、adminの両provider付き応答が未実装によって失敗した。既存の失敗保持など、最初から通る保護testを追加挙動のREDとは扱っていない。

実装後、共通の指示・schema・validator、deadline付きattempt、2 provider coordinator、adminの厳密なpayload互換性と固定表示を検証し、focusedの全263件が通過した。仮想時計では単独15秒・全体30秒、body停止、abort非協調、残余10秒、期限直前/同時/直後、validationの期限超過、遅い完了/拒否、timer/listener解放を固定した。

初回GREEN確認時には、200/502 fixtureが本処理に渡していないPromiseのrejectによる終了後エラーを検出した。late rejectを実際に渡す504 fixtureだけで起こすように修正し、同じ検証でunhandled rejectionを解消した。productionのエラーをtest側で握り潰す変更は加えていない。失敗したtest名・理由の詳細は`aidlc-docs/audit.md`とCode Generation Resultを参照する。

## RequirementsのAC対応

| 要件AC | 自己検証と限界 |
|---|---|
| AC-01 | 両key時のOpenAI優先・Claude 0回、既存正規化・Responses API契約がPASS |
| AC-02 | 全OpenAI失敗fixtureからClaudeへ1回切替。同一sourceと次requestのOpenAI再試行がPASS |
| AC-03 | key構成・空白、401/400で2社とも0回がPASS |
| AC-04 | 固定502/504分類、admin一括反映、失敗・不正payload・preview例外のrollbackがPASS |
| AC-05 | 仮想時計による各社/全体/残余・body停止・abort・期限後棄却・cleanupがPASS |
| AC-06 | 両providerの固定文言、旧payloadの中立表示、未反映/stale時の非表示がPASS。既存markup/CSSの0.85emを決定論的に確認 |
| AC-07 | 両社のsecret・本文・ID・prompt・thinkingのresponse/log非混入、UIの固定textContentがPASS |
| AC-08 | baselineと同じNode v20.19.4でPlanの全回帰commandがPASS。指定root入口は239/239、Workerは268/268、adminは154/154。B1解消 |
| AC-09 | canonicalのOwner確認を記録し、Approvedを同期。gate 1〜3の固定bytesを保持。gate 4・5は未承認 |

## 不変条件と変更範囲

変更の本体は`cloudflare/worker/src/worker.js`、`admin/app.js`、各focused testの計4ファイル。canonicalはstatus・確認記録だけ、Worker READMEは実装後の時点表現だけを変えた。残りは2 result summary、state、active README、audit追記である。

Owner提示版を基準に、specのstatus/確認metadata、索引のstatus、Worker READMEの時点表現を逆変換したSHA-256が3文書の提示digestと一致した。`LIVE_AI_INSTRUCTIONS`、schema、draft制約、validator、OpenAI出力判定はHEADとbytes一致。承認済み3成果物とapprovals/01〜03も開始時digestと一致し、approval04/05は存在しない。開始前auditの先頭39,731 bytesもSHA-256 `9ea9d3a9b6861fad29925f064d680c6ed0c82a5d621272bdb50479d6ca1c5053`を保持した。

B1の再検証では2 result summary、state、active README、audit追記だけを更新した。code・test・承認済み3成果物・approvals/01〜03・確認済みcanonicalのSHA-256は再検証開始時から不変。auditの既存53,225 bytesはSHA-256 `97bf371b72285673dbaf807df91b22c05f2ff19c27926c387c7c31b8475368d9`を保持した。

DB、認証、公開Live、X共有URL、CSS/layout、依存を変更していない。保存・公開・X送信の既存境界を保持した。ui_routeは`none`で、新しいUI観察は行っていない。

## 独立reviewと承認

review-02は計画、review-04は更新後canonicalを対象とした前工程の独立reviewである。今回の実装に対する独立reviewは未実施であり、WorkerはReviewerを兼任・dispatchしない。Frontが独立reviewを手配し、Owner gate 4・5へ進める。stateはgate 4のPendingを保持し、cycleをcloseしていない。

今回、context rootの`PYTHONDONTWRITEBYTECODE=1 python3 -B tools/codex-parity/session-end-check.py`を再実行し、exit 0、`WORKSPACE_PARITY: pass; TASK_PARITY: not_assessed`を確認した。workspace parityは本変更の受入判定とは別である。

## B1の解消理由

Node v24.4.1は`node --test test/`のdirectory引数をmoduleとして解決し、`Cannot find module '/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-33-ai-provider-fallback/test'`を返した。baselineと同じNode v20.19.4では、同じ承認済みcommandが239/239 PASS、exit 0となった。v24でも同じ4ファイルのglob指定は239/239 PASS、Workerは268/268 PASSである。

承認済みPlanは作成時のNode v24.4.1の観測記録も含め、そのまま保持した。command・code・test・canonical・依存を変更せず、既存のv20.19.4を選んで再検証した。repoへのNode版指定も追加していない。B1は環境差として解消し、未解決のblocking findingはない。

## Blocking Findings

- **Blocking Findings**: None

## 本番前に残る限界

実APIのcredit・権限・model entitlement・速度・初回schema compilationは未検証。Claudeのmax_tokensやeffortは承認した設計値で、全入力が15秒で成功することは保証しない。30秒はWorkerの処理予算で、transportやevent loop停止を含む厳密なend-to-end上限ではない。

旧adminはprovider付き応答を拒否するため、公開時は新admin→既存タブ再読込・新admin/旧payload受理確認→新Workerの順序が必要。本番反映・rollbackはOwnerの別操作であり、本検証には含めない。
