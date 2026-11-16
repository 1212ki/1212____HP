# Code Generation Plan — AI整理のprovider自動切替（Issue #33）

- Status: Draft / Owner承認待ち・実装未着手
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-16_issue-33_ai-provider-fallback`
- Unit: `aidlc-integration`（repository adapterが指定するartifact名。変更単位はLive AI整理）
- 実行先: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-33-ai-provider-fallback`
- 要件: `aidlc-docs/inception/requirements/requirements.md` R1〜R7 / AC-01〜09
- 工程: `aidlc-docs/inception/plans/execution-plan.md`

## 1. 完成させる変更と依存

OpenAIで有効な10項目を得られない時に、同じ元情報でClaudeを1回呼び、成功したproviderを管理画面へ小さく表示する。Workerとadminを一括の受入単位とする。永続entity・DB schema・公開API・新しいpackage依存は追加しない。

| 既存path | 変更内容 |
|---|---|
| `cloudflare/worker/src/worker.js` | OpenAI処理をprovider adapterとして保持し、Claude adapterとdeadline付きcoordinatorを追加。endpointのkey判定・成功応答を更新 |
| `admin/app.js` | `normalizeLiveSourceIntakePayload`と`handleLiveSourceParse`を更新し、provider付き/旧payloadの検証と成功statusの固定表示を追加 |
| `cloudflare/worker/test/live-ai-source-intake.test.js` | provider順序・key構成・API wire contract・失敗網羅・deadline・sanitizeのtestを追加し、成功応答の期待を更新 |
| `test/admin-live-operations.test.mjs` | provider表示とpayload互換性を追加し、既存一括反映・rollback・stale/duplicate/save-free testへ両providerを適用 |

下流の公開Live、X preview生成器、保存経路は既存のものを使う。providerはAI整理の応答と現在のstatusにだけ存在し、site dataやpublic serializationへ追加しない。単位内の工程は同じexecutorが持ち、独立reviewとOwner判断はFrontへ返す。

## 2. Step 1 — current canonicalを先に更新する

前提はRequirements・Workflow Plan・本Code Generation Planのexact digestに対するOwner承認である。承認前は以下を実行しない。

| current canonical / 説明path | 実装前に反映する変更 |
|---|---|
| `docs/specs/current/live-operations-admin-ui.md` | statusをDraftへ戻し、Owner・更新日・Issue #33を関連付ける。§7にOpenAI優先、全失敗切替、key4構成、共通指示/schema/validator、10項目一括反映、30秒/15秒、provider表示と互換性を追加。§10に固定エラー分類・失敗時保持・stale対策、§11に#33のprovider拡張境界、§12/§13にAC-01〜09と検証、§14にactive plan参照を追加。#21の抽出内容と#29のshare URL契約を保持する |
| `docs/specs/current/README.md` | 設計書のDraft/Approved、対象Issueの説明を実体と同期する |
| `cloudflare/worker/README.md`「Live元情報のAI整理」 | 2社の順序、fallback分類、`draft`+`provider`の成功応答、旧payloadとのadmin互換性、secret2種、モデル変数2種、deadline/timeout、固定error、漏洩防止、Ownerの反映順序を記載 |

`docs/specs/current/system-design-principles.md`は参照のみとする。§2.6の元情報からの再抽出、§2.7の保存・公開・外部送信の分離、§2.9の失敗時保持に沿った変更であり、原則の改訂は必要ない。`DESIGN_RULES.md`も変更せず、既存のstatus表示を使う。

更新したcurrent specをItsukiが確認した証拠を得て、specと索引をApprovedに揃えてから、以下のtest/code変更へ進む。計画承認だけから未確認のcanonicalをApprovedと記録しない。新しい仕様判断が出れば、該当artifact・canonicalを再提示し、digest再承認を経る。

## 3. Step 2 — APIと期限の実装方針を固定する

### provider adapter

OpenAI adapterは現在のResponses API payload、`LIVE_AI_MODEL`のoverrideと既定`gpt-5-mini`、output/refusal/incompleteの判定を維持する。`LIVE_AI_INSTRUCTIONS`、`LIVE_AI_OUTPUT_SCHEMA`、`validateLiveAiDraft`の抽出内容・制約は変更しない。HTTP成功からdraft検証までを1つのattemptに含め、validationの失敗もcoordinatorへ返す。

Claude adapterは次のwire contractを使う。SDKを追加せず既存fetchで実装する。

| 項目 | 値・処理 |
|---|---|
| endpoint | `POST https://api.anthropic.com/v1/messages` |
| headers | `x-api-key: <ANTHROPIC_API_KEY>`、`anthropic-version: 2023-06-01`、`content-type: application/json`。secretはWorker内だけで使用 |
| model | trimした`LIVE_AI_CLAUDE_MODEL`、未設定・空白時は`claude-haiku-5-5` |
| max_tokens | `16_384`。入力上限12,000文字と10項目のJSONに加えadaptive thinkingの余地を確保する設計値。実入力での十分性・速度は未実測であり、打切り応答は採用しない |
| system / messages | `system`に既存`LIVE_AI_INSTRUCTIONS`をそのまま、`messages`の唯一のuser messageに確定済みの同じ`sourceText`を渡す |
| output_config | `effort: low`、`format.type: json_schema`、`format.schema: LIVE_AI_OUTPUT_SCHEMA`。OpenAI用の`name`/`strict`をこのformatへ流用しない |
| 省略するfield | `thinking`、`budget_tokens`、`temperature`、`top_p`、`top_k`、assistant prefill、server-side `fallbacks`、tools。抽出指示を追記して調整しない |
| 応答 | 非2xx、error envelope、非object、`stop_reason`が`end_turn`以外（`refusal`・`max_tokens`等）、content不正/空、JSON不正を失敗にする |
| text抽出 | `content`配列から`type: text`かつstringのblockを順に読み、textを連結して1つのJSONとしてparseする。thinking blockを先頭と仮定せず、内容を返却・保存しない |
| 共通検証 | parseしたobjectを必ず既存`validateLiveAiDraft`に通す。型、10 key、日付、時刻、文字数、URLの違反は失敗 |

根拠はaudit記載のcached official skillのStructured Outputs、Haiku 5.5 migration、raw HTTP例である。model固有の説明に従ってcontentをtypeで選び、cURL簡易例の`content[0].text`は使わない。structured outputsに非対応のmin/max等をschemaへ追加せず、既存validatorで制約を担保する。

### coordinatorとdeadline

1. 現在どおり管理認証→request JSON→trimした入力の検証を行う。その後に両secretの有無を判定し、両方空なら503を返す。
2. 各requestで候補を`openai`→`claude`の順に作る。未設定のproviderを除き、providerごとのattemptは1回とする。永続・module-levelな失敗記憶は作らない。
3. 単調時計`performance.now()`で開始時刻と全体deadline（開始+30,000 ms）を1回だけ決める。各attemptの期限は開始+15,000 msと全体deadlineの早い方で、残余が0以下なら呼び出さない。
4. 共通attempt helperを導入し、fetch→`response.json()`→envelope/text/JSON判定→`validateLiveAiDraft`全体を、abortを伴うtimeout rejectionとの`Promise.race`に入れる。fetchがabortに協調せず、body読取も終わらない場合にrequestを待ち続けない。
5. さらにcoordinator全体を全体deadlineのrejectionで囲み、期限到達時は現在のAbortControllerをabortして504へ進める。attempt終了時と成功採用直前にも時計・signalを確認し、timerが遅延しても期限後のdraftを採用しない。
6. 失敗にはenvelope/JSON/validator不合格も含め、OpenAIが失敗したら全体残余の中でClaudeを試す。前のattemptの遅い完了はrequest結果を書き換えない。
7. 最初の合格結果を`draft`と固定enumの`provider`として返す。OpenAI合格時はClaudeを呼ばない。全体期限または最後のattempt timeoutなら504、他は502。途中のtimeoutだけでClaudeの成功や最終失敗を上書きしない。
8. `finally`でattempt timerとglobal timerを必ずclearし、abort listenerやactive controller参照を解放する。raceで遅れてrejectするpromiseも処理済みにし、unhandled rejectionや待ち続けるhandleを残さない。

上限の根拠は、既存OpenAIの15秒を維持し、Claudeにも最大15秒を配分しつつ、各呼出しの間の処理時間を含めて30秒で打ち切るためである。単純に15秒timerを2本直列に足す方式では、解析・validationやbody停止を含む全体上限を証明できない。単一keyの最大15秒も保持する。保証範囲はWorker内の処理予算であり、transportやevent loop停止はRequirements R4の限界として明示する。

## 4. Step 3 — focused testを先にREDにする

Step 1のcanonical確認後、まず既存test fileだけを変更し、production code未変更で次のcommandを実行する。失敗が新しい契約に由来することを確認し、syntax/import/fixture破損による失敗をREDとして数えない。既存のfailure/atomicity testを消してGREENにしない。

| test file / 要件 | REDで追加する観測 |
|---|---|
| Worker / AC-01〜03 | 両key・片key・両keyなし・空白値、OpenAI合格時Claude0回、失敗時順序と同一sourceText、次requestのOpenAI再試行、401/400で両社0回 |
| Worker / AC-02・04 | OpenAIの401/403/429/5xx、throw、timeout、refusal/incomplete、空・不正envelope/JSON、全既存invalid draft fixtureを、Claude成功へ繋げる。各失敗で呼出2回・部分結果不採用を確認 |
| Worker / AC-04・07 | Claude側にも非2xx/throw/refusal/max_tokens/空・不正JSON・validator違反を適用し、単一/両側失敗の502/504分類を確認。エラーbody・headers・secret・request ID・promptのsentinelがclient responseに出ない |
| Worker / AC-01・02・07 | 実際に捕捉した2社のoutbound bodyで同じinstructions/schema/sourceを比較。Anthropic headers、model override/default、max_tokens、effort、thinking→text順の読取、非対応fieldの不送信を確認 |
| Worker / AC-05 | 下表のfake clock検証。network/live keyを使わない。単調時計とtimerを同じ仮想時刻で制御する |
| admin / AC-04・06〜08 | `openai`/`claude`の2成功で全10項目（空値含む）とpreviewを反映し、既存status欄へ固定文言をtextContentで表示。旧draft単独応答は中立文言で成功 |
| admin / AC-04・06〜08 | 未知/空/null/非string provider、余分なtop-level key、不正draft、HTTP/network/JSON失敗で全項目・preview・sourceText不変。provider付きでも入力変更・editor交代・逆順応答・preview例外・重複click・保存中排他が既存どおり動く |
| admin / AC-08 | Local Mode/接続fallback read-only/custom API baseでは既存の制限と`allowBaseFallback: false`を維持。保存・X外部送信0回 |

### 実時間待機を使わない期限test

Node `v24.4.1`を観測済み。`node:test`のmock timerと単調時計のstubを併用し、fetch stubのsignal・遅延promise・body読取を制御する。global timerが増えるため、現行の「すべてのsetTimeoutを即発火」するtimeout fixtureは、各deadlineを区別する仮想時計へ変更する。

| case | 必須の観測 |
|---|---|
| OpenAI単独 / Claude単独の停止 | 14,999 msではpending、15,000 msでabortと504、余分な呼出しなし |
| OpenAI 15秒timeout→Claude成功 | 15秒でOpenAI abort後にClaude開始。30秒より前の合格を200で採用 |
| 両provider停止 | OpenAIは15秒、Claudeは全体30秒まで。abort非協調fetchでも30秒で504を返す |
| OpenAI即時失敗→Claude停止 | Claudeは開始から15秒で504。全体30秒まで無条件に待たない |
| headersだけ到着してbody停止 | `response.json()`待機もattempt期限で中断し、fallbackまたは最終504へ進む |
| 途中処理が時間を消費 | Claudeのbudgetが`min(15秒, 全体残余)`になる。全体残余ゼロでClaudeを呼ばない |
| deadlineと成功の競合 | 期限ちょうど/期限後の成功は棄却。OpenAIの遅い結果がClaude成功を上書きしない |
| 成功・502・504すべての終了 | timer/listenerの解放、unhandled rejectionなし、late resolutionによる追加responseなし |

focused command（すべてrepository rootから実行）:

```bash
node --test cloudflare/worker/test/live-ai-source-intake.test.js
node --test --test-name-pattern='AIで整理 source intake' test/admin-live-operations.test.mjs
```

## 5. Step 4 — 最小実装をGREENにする

REDの証拠を残してから、§3の設計を既存2つのcode fileへ実装する。変更の順序はWorkerの共通deadline helper→provider adapter/coordinator→endpoint→admin payload検証・statusとする。

adminのnormalizerは、厳密な10項目draftの検証を維持し、top-levelを旧`draft`のみ、または`draft`と有効な`provider`だけに限定する。呼出側で扱えるよう正規化結果にdraftとproviderを分け、旧応答のproviderは未指定として扱う。フィールドmapへproviderを追加しない。

`handleLiveSourceParse`では既存のeditor generation、request input snapshot、duplicate/save guard、rollback snapshotを維持し、有効なproviderとdraftを確認してから反映する。preview生成・public fields表示・dirty処理が成功した後にだけprovider成功文言を出す。失敗・入力変更・stale responseではその成功文言を出さず、現行の安全なstatusへ戻す。既存status要素と`.parse-warnings`を再利用し、CSSやlayoutの別変更を加えない。

§4と同じfocused commandでGREENを確認する。test結果、差分、実装位置、AC対応、既存契約を保持した証拠とGapを`aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md`へ記録し、Frontへ返す。Code Generation ResultのOwner承認を受けてからBuild and Testへ進む。

## 6. Step 5 — 全回帰と独立review

focused GREEN後、次をfreshに実行する。下記は実装後のcommand計画であり、この文書作成で実施済みという意味ではない。`npm test`はtest scriptが`node --test`であることを確認済みで、依存追加は不要である。

```bash
node --test test/admin-live-operations.test.mjs
node --test test/
npm --prefix cloudflare/worker test
node --check cloudflare/worker/src/worker.js
node --check admin/app.js
scripts/aidlc-verify.sh --local
git diff --check
git status --short
git diff --stat
```

期待結果はfocusedと全回帰がfailure 0、syntax/local integrity/diff checkがexit 0、変更pathが§1・§2とcycle記録に限定されることである。Front提供baselineのWorker 97/97、root 178/178を引継ぎ情報として参照し、追加後の件数とfreshな結果を記録する。既存PASSをこの変更のGREENに流用しない。

独立ReviewerはR1〜R7/AC-01〜09、両adapterのsanitize、共通定数の内容不変、bodyを含むdeadline、旧adminとの互換性、atomicity、current canonicalのApproved根拠を確認する。reviewerは修正せずfindingを返す。executorが修理した場合は影響する検証とreviewを更新する。

`aidlc-docs/construction/build-and-test/build-and-test-summary.md`にcommands、結果、AC coverage、独立review、実API未検証の限界を残す。blocking findingを解消し、Build/Test ResultのOwner承認とFront受入後にcycle summary/stateを揃える。close時には5 gateのfresh digest一致を確認する。本planのチェック欄を後から書き換えず、結果はstate/audit/summaryへ記録する。

## 7. 公開順序・rollback・残る限界

productionへの操作はOwnerが別途行う。新adminは旧Workerの応答を受理するため、反映順序は新admin→新Workerとする。旧adminは新しいprovider付き応答を拒否するため、逆順の反映は行わない。rollbackする場合もOwnerがWorkerを旧応答へ戻してから、必要に応じてadminを戻す。DB変更はなく、ローカル修理は承認した当該差分に限定し、unrelated workを戻さない。

本番key/credit/model entitlement、実APIの成功率・速度・初回schema compilation、ブラウザ〜Worker間の通信時間はmock testの証明範囲外である。Claudeの`max_tokens`とeffortは、固定の指示・schema・validatorを保ったまま採用する設計値で、全入力が15秒以内に成功するとの保証ではない。モデル・timeout・抽出指示・成功条件を変える必要が出た時は、該当設計のOwner判断へ戻る。

