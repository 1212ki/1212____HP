# 実装と試験の結果（Issue #42）

Homeと共通の外枠のRV42-01〜07は、Frontの再撮影と2回目の独立review（APPROVED、新しい指摘なし）で解消を確認しました。その後の実データ表示で見つかったFR-N1の日付折返しと、その修理後の54枚の撮影で見つかったFR-N2の行ごとの本文位置のずれを修理し、自動検証を通過しています。**今回の修理後の撮影・再確認と、確認2でのPC・スマホ画面・実機の音の最終確認が残っています。**

- **Cycle ID**: 2026-11-17_issue-42_home
- **Stage**: Build/Test Result（gate 5の候補、未承認）
- **Blocking Findings**: None
- reader_profile: audience_class=human_reader; language=ja-JP; review_surface=notion_paper（Frontが提示）; reader_ready=true; open_status=not_opened
- independent_review: 初回REJECTED、2回目APPROVED（RV42-01〜07 RESOLVED、新しい指摘なし、`review-02-result.md`）。FR-N2修理後の独立再reviewは未実施、Frontが手配する。
- visual_acceptance: **visual_acceptance_pending**。FR-N1後のFront撮影54枚はすべて判定通過（capture-front-5.log）。FR-N2修理後は未撮影。
- 実際のデータでの画面・実機の音: 準備中の画面観察でFR-N1を検出。修理後のPC・スマホ画面と実音の最終確認は**未実施・確認2で行う**。

Blocking Findingsは、自動検証で検出した未修理のblocking findingの欄です。Noneでも画面受入・review・Owner承認が成立したことにはなりません。gate 4・5の承認記録は作っておらず、close・mergeの判断は残っています。

## 全試験と静的検証

実行場所は`/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-42-home`。NodeはPATH先頭に`/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin`を指定しました。dependencyの追加・installはありません。静的サイトのため別bundle buildはありません。

ログの基点を`aidlc-docs/construction/aidlc-integration/verification/`（以下`verification/`）とします。command・exit・件数・ログは`step-4-results.json`と`step-6-results.json`にも記録しています。

| command | Step 4 | Step 6 | log（verification/配下） |
|---|---|---|---|
| `node --test test/` | tests 333 / pass 333 / fail 0、exit 0 | tests 367 / pass 367 / fail 0、exit 0 | `step-4-01.log`、`step-6-01.log` |
| `npm --prefix cloudflare/worker test` | tests 347 / pass 347 / fail 0、exit 0 | tests 347 / pass 347 / fail 0、exit 0 | `step-4-02.log`、`step-6-02.log` |
| `node --check assets/js/site-content.js` | PASS、exit 0 | PASS、exit 0 | `step-4-03.log`、`step-6-03.log` |
| `node --check assets/js/home-player.js` | PASS、exit 0 | PASS、exit 0 | `step-4-04.log`、`step-6-04.log` |
| `node --check assets/js/script.js` | PASS、exit 0 | PASS、exit 0 | `step-4-05.log`、`step-6-05.log` |
| `scripts/aidlc-verify.sh --local` | PASS、exit 0 | PASS、exit 0 | `step-4-06.log`、`step-6-06.log` |
| `scripts/aidlc-cycle.sh status` | PASS、exit 0 | PASS、exit 0 | `step-4-07.log`、`step-6-07.log` |
| `git diff --check` | PASS、exit 0 | PASS、exit 0 | `step-4-08.log`、`step-6-08.log` |
| `git status --short` | 成功、exit 0 | 成功、exit 0 | `step-4-09.log`、`step-6-09.log` |

local verifyは固定されたAI-DLC payloadと履歴の整合を確認する検査で、外部のsource authenticityを新たに検証したものではありません。

前回RV42修理後の区切りでは`node --test test/`が374 tests／374 pass／0 fail、`npm --prefix cloudflare/worker test`が347 tests／347 pass／0 failでした。JS3件の`node --check`、`scripts/aidlc-verify.sh --local`、`scripts/aidlc-cycle.sh status`、`git diff --check`もすべてexit 0です。commandとexitは`corrective-1-results.json`、ログは`corrective-1-node.log`・`corrective-1-worker.log`・`corrective-1-site-check.log`・`corrective-1-player-check.log`・`corrective-1-script-check.log`・`corrective-1-local-verify.log`・`corrective-1-status.log`・`corrective-1-diff-check.log`を参照してください。

## focused testとRED→GREEN

| 段・command | RED（pass / fail） | GREEN（tests / pass / fail） | log（verification/配下） |
|---|---|---|---|
| 1 `node --test test/public-music-data-compatibility.test.mjs test/public-ticket-routing.test.mjs` | 既存characterizationなのでRED対象外 | 44 / 44 / 0 | `step-1-characterization.log` |
| 2 `node --test test/home-rendering.test.mjs test/music-data.test.mjs` | 3 / 12 | 15 / 15 / 0 | `step-2-red.log`、`step-2-green.log` |
| 3 `node --test test/home-player.test.mjs test/home-rendering.test.mjs` | 16 / 14 | 30 / 30 / 0 | `step-3-red.log`、`step-3-green.log` |
| 4 `node --test test/home-rendering.test.mjs test/public-ticket-routing.test.mjs test/public-music-data-compatibility.test.mjs` | 63 / 23 | 90 / 90 / 0 | `step-4-red.log`、`step-4-green.log` |
| 5 `node --test test/home-rendering.test.mjs test/home-player.test.mjs` | 50 / 16 | 66 / 66 / 0 | `step-5-red.log`、`step-5-green.log` |
| 6 `node --test test/site-shell.test.mjs test/public-ticket-routing.test.mjs` | 38 / 15 | 53 / 53 / 0 | `step-6-red.log`、`step-6-green.log` |
| 6 `node --test test/admin-image-form.test.mjs` | 既存回帰 | 21 / 21 / 0 | `step-6-admin.log` |
| 6 `node --test cloudflare/worker/test/og-live.test.js` | 既存回帰 | 6 / 6 / 0 | `step-6-og.log` |
| 仕上げ `node --test test/home-player.test.mjs` | 5 / 2（開閉のtestid） | 次行で再検証 | `final-player-hooks-red.log` |
| 仕上げ `node --test test/home-player.test.mjs test/home-rendering.test.mjs test/site-shell.test.mjs test/admin-image-form.test.mjs` | — | 104 / 104 / 0 | `final-focused-green.log` |
| RV42修理 `node --test test/home-rendering.test.mjs test/home-player.test.mjs test/site-shell.test.mjs` | 83 / 7 | 90 / 90 / 0 | `corrective-1-red.log`、`corrective-1-green.log` |

REDは新しいHome・再生・状態・外枠の未実装を検出したログです。Step 4のREDにはheroの旧assertも含まれます。互換試験は実HTMLのidだけを生成するよう修理し、非Homeに存在しないHome用idを除きました。Discographyの日付原文・順序・説明・リンク、Liveのdescription-only・詳細の本文は保護しています。Homeの3項目の欠落／空／登録済みの期待はT42-DATA／PLAYの新しい表示試験へ移しました。

## 受入条件ごとの証拠

| 試験群 | 検証した内容 |
|---|---|
| T42-DATA | 明示／自動／切れたid／同日／両カテゴリ／全不正日付／0〜2件／非破壊／種別なし／旧タイトルescape／helper不在／API body・envelope。 |
| T42-PLAY | 3映像カテゴリ、空・不正youtubeId、リンクのみ／再生とリンク、Demo購入先、安全なURL、click dispatch直後のiframe、属性、最大1個、closeのsrc解除・remove・focus・testid、再open／pagehide。 |
| T42-LIVE | 内部／外部／受付終了／不正URL、過去日upcoming、重複・空id・helper不在、予定0、日付・会場・タイトル・詳細文字、description-only。 |
| T42-CONTENT | newsの逆順・同日・不正／空・先頭6・画像0・説明全文・登録linkText・矢印1つ・リンクなし。profileのCRLF／CR／br／空白行／escape／空。5リンクの順序・Site優先・Profile補完・無効URL、footer全文。 |
| T42-STATE | S42-01〜10・L。HTTP／JSON／network／root不正、Live不正・局所例外、全体と局所busy、再読込回復・連打抑止・listener1個、pagehide後の遅い応答無視、画像errorのイベント。 |
| T42-SHELL | 9route・6navの表示順とURL解決、本文8件のbytes、script順と存在、cache query、Menu hidden／aria／Escape／各リンク／resize／focus、ロゴの波紋・26音符・timing・reduced-motion、既存CSSとanimationの保持、admin説明とOG回帰。 |
| T42-VISUAL | RV42修理後52枚とboxをFrontが取得し、2回目の独立reviewで確認。FR-N1修理後のFront撮影54枚は全判定通過。**FR-N2修理後はpending**。Frontが同じscriptで再撮影・再確認する。 |

## canonical・承認記録・変更範囲

`verify-integrity.py`は3昇格先のSHA-256／cmp、承認済み4入力のdigest不変、完全promptと回答原典の逐語一致、変更前に保存した非Home本文、9 HTMLのlocal href/src存在、許可範囲と保護対象の不変を確認します。結果は`integrity.log`、実装のhashは`implementation-manifest.sha256`にあります。

`scripts/aidlc-cycle.sh`のCLI dispatchより前の関数定義をそのまま読み込み、`validate_approval`をgate 1〜3へ適用しました。3件ともPASSで、`approval-validation.log`に記録しています。原典はroot scratchの`gate-123-prompt.md`と`gate-123-owner-responses.md`です。提案版の昇格前／後のhashは`promotion.log`にあります。

前回RV42修理後の再照合もPASSです。`corrective-1-approvals.log`で承認3件、`corrective-1-integrity.log`で昇格・承認済み入力・非Home本文・許可scope・保護対象・本番本文の非混入とPython parseを確認しました。修理後の実装hashは`implementation-manifest.sha256`へ更新しています。

変更は計画§4のファイルと`aidlc-docs/`のみです。helper3件、tokens、DESIGN_RULES、adminのapp/style、Cloudflareはbaseから不変です。fixtureは架空の作品・公演・news・プロフィールで、画像は既存local assetを使います。本番snapshotの本文と生成内容を比較し、内容をコピーしていないことを検査しました。原文の値はログへ出していません。

## 画面と実音の残件

Worker時点の撮影は`/usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-home.py --serve`がexit 1、localhostの`socket.bind`で`PermissionError: [Errno 1] Operation not permitted`となり0枚でした（`capture-attempt-1.log`）。その後Frontが同じscriptで52枚を撮影しました（`capture-front-1.log`・`capture-front-2.log`）。時計の1行は`page.clock.install(time=1794916800000)`から`time=1794916800`へFrontが修正しました。Playwright for Pythonは数を秒として読みます。この修正は保持しています。撮影時metricsのSHA-256は`1bbfdc6dfd66b03c02b8fb416bf04f06ed03fadc95d373c876b4f2f2a9ccd042`です。

FrontはRV42修理後に同じscriptで52枚を再撮影し、判定はすべて通過しました（`capture-front-3.log`、撮影時`capture-metrics.json`のSHA-256 `709c904f51c9e7f13b1e34db6d709a65dacd21cbd636aaa441b4ba9d93ab4e96`）。独立reviewの2回目はAPPROVEDで、RV42-01〜07はすべてRESOLVED、新しい指摘はありません（root scratchの`review-02-result.md`）。その後、確認2の準備でFrontが本番の公開データを読むbranch画面を開き、newsの日付が語の途中で折れる問題FR-N1を見つけました。計画とfixtureが短い日付だけを想定していたことが原因です。

FR-N1では、日付欄を88pxから内容に合わせて広げ、上限を240pxまたは画面幅−236pxの小さい方にしました。390pxでは左右16px・間隔24pxを保ち、本文欄に180px以上を残します。Home専用rendererで空白ごとのまとまりをspanに包み、空白で折り返します。上限を超える1語だけは欄内で折り返します。原文の文字と空白・既存の並べ方は保持し、全行が通常のYYYY.MM.DDの場合は88pxと24pxの見え方を保ちます。旧`.news-*`は変更していません。

FR-N1修理後、Frontは文字nodeの行数を数えるよう撮影scriptを2か所修正しました。gridの行高まで伸びた日付要素の高さを行数と誤認したためです（`capture-front-4.log`は修正前の失敗、`capture-front-5.log`は修正後の54枚・全判定通過）。ただし画像では、各行が別のgridを持つため、1440pxの日付欄が88・100・181・215・240pxに分かれ、タイトルと本文の開始位置がそろわない問題FR-N2が見つかりました。

FR-N2では、`#news-items`を2列の親gridとし、全行をsubgridで同じ列に合わせました。表示中の最長日付に合わせた1つの幅を使い、下限88px・上限min(240px,画面幅−236px)、gap24px、390pxの本文180px以上を保ちます。全件がYYYY.MM.DD形式なら88pxです。短い日付が自由記述日付と混在する場合も同じ列幅です。語中折返しの制限・文字原文・上下padding16px・行の下線・390pxの行間8px・旧`.news-*`は保持しています。

**FR-N2修理後の撮影と再確認は、このあとFrontが行います（この文書の時点では未実施）。** 同じ`capture-home.py --serve`で、通常の画像に加え`home-freeform-news-dates-1440.png`（1440×900）と`home-freeform-news-dates-390.png`（390×844）を撮影します。追加の架空日付・長い1語を含め、日付要素と語の行数・幅・はみ出し、本文幅、通常日付88px・間隔24pxをassertし、`capture-metrics.json`へ記録します。新しい全撮影は54枚の予定です。今回のWorkerは新規撮影しておらず、FR-N1後の既存54枚・metricsを保持しています。撮影scriptには、全行の`.site-news-content`の左端の差が0.5px以内というassertを追加しました。Frontの文字nodeによる`lines`と高さ換算の`boxLines`は保持しています。

実際のPC・スマホ画面と実音・閉じるによる停止は未実施・確認2で行います。Q42-01の例外採否はItsukiが判断します。外部fontを遮断したfixtureの字形・厳密な折返しは別に受入を確認します。Workerは公開API・外部公式資料に接続していません。

### 確認2の手元配信の前提訂正

承認済みRequirements §6とCode Generation Plan §6の「公開APIはAccess-Control-Allow-Origin: *を返す（Front確認済み）」はFrontの誤りでした。実コード`cloudflare/worker/src/worker.js`の`createCorsHeaders`は、`ALLOWED_ORIGINS`（`cloudflare/worker/wrangler.toml`）内のOriginにはその値を、未許可のOriginには先頭の`https://1212hp.com`を返します。空リストの場合だけ`*`です。

Frontは確認2の手元配信を、PCは許可済み`http://localhost:8888`から本番の公開APIを直接読み、スマホは同じ配信から本番の公開データの写しを同じオリジンで読む形に変更しました。変更先は配信用の一時コピーだけで、repo・製品動作・設計書には影響しません。承認済み2文書のbytesは保持しています。Frontの訂正記録は`/Users/itsuki.matsumoto/claude-code/docs/ai-governance/feedback/2026-11-18_unverified-cors-fact-in-packet.md`です。Workerはこの配信や本番取得を行わず、fixture撮影のlocalhost限定・外部遮断を維持します。

## close書式の事前検査

`verification/close-dryrun.py`でactive workspaceを許可された使い捨てcopyへ複写し、そのcopy内だけに仮のgate 4・5とCompleteのstateを置いて`validate_close_ready`を適用します。実際の`aidlc-docs/`のgate 4・5は未作成、stateはCode Generation Result承認待ちです。

初回・RV42修理後ともに検査結果は**PASS、exit 0**。`verification/close-dryrun.log`と`verification/corrective-1-close-dryrun.log`にcopyの絶対pathと`PASS validate_close_ready`を記録しています。実際のstateのhashが変わらず、gate 4・5の本物の記録がないことも検査しました。この検査が確認するのは書式・mapping・digestの結び付きで、実際のreviewやOwner承認、画面・実音の受入を代替しません。

## FR-N1の追加検証

`node --test --test-name-pattern=FR-N1 test/site-shell.test.mjs test/home-rendering.test.mjs`でREDは2 fail／0 pass（82 skip）、GREENは2 pass／0 fail（82 skip）でした（`fr-n1-red.log`・`fr-n1-green.log`）。CSSの幅・間隔と語の扱い、架空の日付の原文・escape・入力不変を検査しています。

追加後の`node --test test/`は376 tests／376 pass／0 fail、`npm --prefix cloudflare/worker test`は347 tests／347 pass／0 failです。JS3件の`node --check`、`scripts/aidlc-verify.sh --local`、`scripts/aidlc-cycle.sh status`、`git diff --check`はすべてexit 0。focused全体も84 pass／0 failです。command別の記録は`verification/fr-n1-results.json`、ログは同じ基点の`fr-n1-focused.log`・`fr-n1-node.log`・`fr-n1-worker.log`・`fr-n1-site-check.log`・`fr-n1-player-check.log`・`fr-n1-script-check.log`・`fr-n1-local-verify.log`・`fr-n1-status.log`・`fr-n1-diff-check.log`です。

昇格3件・固定入力・scope・本文保護・非混入・Python構文は`fr-n1-integrity.log`、承認1〜3は`fr-n1-approvals.log`で再確認し、すべてPASSでした。更新した結果文書のclose書式事前検査も使い捨てcopyのみで再実行しPASS／exit 0、結果は`fr-n1-close-dryrun.log`です。本物のstateとgate 4・5は変更しません。

## FR-N2の追加検証

全行で本文の開始位置をそろえるCSSのfocused testは、修理前に0 pass／1 fail（20 skip、exit 1）、修理後に1 pass／0 fail（20 skip、exit 0）となりました。test名は`FR-N2 all Home news rows share the longest bounded date column and content start`、記録は`verification/fr-n2-red.log`・`fr-n2-green.log`です。FR-N1の幅・間隔の既存試験は、列幅を持つ親gridを検査する形へ移しました。語の折返し・上限・本文幅の制約を保っています。

全試験はNode 377 tests／377 pass／0 fail、Worker 347 tests／347 pass／0 failです。Home描画と外枠のfocused全体も85 pass／0 fail。JS3件の`node --check`、`scripts/aidlc-verify.sh --local`、`scripts/aidlc-cycle.sh status`、`git diff --check`はすべてexit 0でした。command・exit・log対応は`verification/fr-n2-results.json`、全試験からstatus・diffまでの記録は`fr-n2-01.log`〜`fr-n2-08.log`、focusedは`fr-n2-focused.log`です。

撮影scriptはPython ASTと埋込JavaScript式10件の構文を静的確認しました（`fr-n2-capture-static.log`）。全行の本文左端を`bodyLeft`として記録し、最大値と最小値の差が0.5px以内であることを判定します。通常日付だけのシナリオでは日付幅88pxを検査し、自由記述と混在する短い日付は共有列幅で検査します。Frontの文字nodeによる行数計測2か所は保持しました。描画検証はFrontの次の撮影に残っています。

承認1〜3のvalidatorはPASS（`fr-n2-approvals.log`）、固定入力・昇格3件のSHA/cmp・許可範囲・保護対象・本番本文非混入もPASS（`fr-n2-integrity.log`）。最初のvalidator呼出は記録pathに`approvals/`を欠いたため失敗し、正しい引数で再実行しました（失敗記録は`fr-n2-approvals-attempt.log`）。承認原本は変更していません。使い捨てcopyでclose書式の事前検査を再実行しPASS／exit 0（`fr-n2-close-dryrun.log`）。本物のgate 4・5は作成せず、stateは承認待ちを保っています。
