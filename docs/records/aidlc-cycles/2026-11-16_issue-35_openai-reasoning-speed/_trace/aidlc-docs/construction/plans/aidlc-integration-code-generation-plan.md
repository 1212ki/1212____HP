# Code Generation Plan — OpenAIの考える量を最小にする（Issue #35）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-16_issue-35_openai-reasoning-speed`
- Base Commit: `799b29fe340431654f7a21fbdb2fbd58cd8c22e3`

## 1. 実装する差分と境界

`cloudflare/worker/src/worker.js`の`requestOpenAiLiveDraft`に、次の1行だけを追加する。既存の`model`と`instructions`の間に置く。

```javascript
      model: String(env.LIVE_AI_MODEL || "").trim() || "gpt-5-mini",
      reasoning: { effort: "minimal" },
      instructions: LIVE_AI_INSTRUCTIONS,
```

他のOpenAI request body（`model`・`instructions`・`input`・`text.format`）、Claude側、provider順、各15秒／全体30秒、エラー分類、管理画面表示、抽出指示・10項目schema・validatorを保持する。SDK・設定変数・dependencyは追加しない。

後続の変更pathはproduction codeの上記1file、testの`cloudflare/worker/test/live-ai-source-intake.test.js`、§2の3文書、active cycle evidenceに限る。後続実装packetでこれらのwrite権限を明示する。本packetではcycle候補・audit・stateだけを作り、承認記録・canonical・code・testには触れない。

## 2. current canonicalの逐語変更とDraft→Approved

### 承認と反映の順序

gate 1〜3を確認1でまとめて提示する。**gate 3は本節の変更前→変更後の本文差分に対するOwner確認を兼ねる**。Frontはその点を承認promptに明記し、Itsukiの単一ASCII `A`を得た後で、Code Generation Planのexact digestに結び付いたgate 3記録を作る。`docs/DOCS_RULES.md`のCurrent Specification Gate（41〜55行）の「Itsukiの確認」は、この記録と以下の逐語差分を根拠に満たす。別のcanonical専用確認は挟まない。

後続Workerはcode/test変更前に次の順序で反映する。

1. gate 1〜3の全recordとfresh SHA-256が現在の3成果物に一致し、gate 3 promptが本節のcanonical差分を明示していることを読む。
2. `docs/specs/current/live-operations-admin-ui.md`を一時的に `- Status: Approved` → `- Status: Draft` とする。索引の既存行は次の変更前→変更後でDraftへ同期する。

```text
変更前: | `live-operations-admin-ui.md` | Approved | Live運用のadmin UIと公開画面の対応。Issue #33のAI整理provider自動切替を反映し、Owner確認済み。#21の抽出内容と#29のshare URL契約を保持 |
変更後: | `live-operations-admin-ui.md` | Draft | Live運用のadmin UIと公開画面の対応。Issue #33のAI整理provider自動切替を反映し、Owner確認済み。#21の抽出内容と#29のshare URL契約を保持 |
```

3. 以下のdiffを最終本文の唯一の変更指示として反映する。diffの索引行は変更前のStatusをDraftとして照合し、変更後のStatusもいったんDraftで置く。他の`-`行は現行行と逐語一致させる。`+`行が変更後の正確な本文であり、追記・言い換えは行わない。Last updatedは既に2026-11-16なので保持する。
4. gate 3承認済み差分と全変更行を突合し、open questionがないことを確認する。specは `- Status: Draft` → `- Status: Approved`、索引の新しい行も `| Draft |` → `| Approved |` として、以下の最終本文に一致させる。承認根拠・一致結果をauditへ残し、その後にtest/codeへ進む。
5. 変更前の行が一致しない、または本文の追加修正が必要なら反映・実装を停止する。旧承認を保ったままFrontへ戻し、影響するartifactを新digestで再承認する。

`Owner approval`等の新しい行は、この手順を実際に通過した後の文面である。候補作成だけでは現行文書をApprovedにしない。Issue #33の承認・review・実装経過は`Prior`として保持し、今回の承認・reviewへ転用しない。

### 変更前の行 → 変更後の行（最終本文の全文差分）

`-`は削除する既存行、`+`は追加する行、先頭空白は位置を特定するための既存行。対象はcurrent specのprovider設定・Issue #35のAC/検証/承認根拠、索引、Worker READMEのAI整理節である。

```diff
--- a/docs/specs/current/live-operations-admin-ui.md
+++ b/docs/specs/current/live-operations-admin-ui.md
@@ -4,11 +4,13 @@
 - Owner: Itsuki Matsumoto
 - Last updated: 2026-11-16
-- Related issues: #33, #29
-- Related implementation issues: #19, #20, #21, #22, #33
-- Owner approval: APPROVED（Itsuki Matsumoto、2026-11-16T13:34:12+09:00、提示された本版のSHA-256 `8c9ceb61cbee4e897f8afad63245410c8bca69f5ea89c8e6a5b57e6f89038864` に対する本人回答 `A`）
+- Related issues: #35, #33, #29
+- Related implementation issues: #19, #20, #21, #22, #33, #35
+- Owner approval: Issue #35のCode Generation Planに記載した本版の差分に対するItsuki Matsumotoのgate 3承認（本人回答`A`）。根拠はactive時の`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後の`docs/records/aidlc-cycles/2026-11-16_issue-35_openai-reasoning-speed/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`。本文反映後に承認済み差分との一致を検証する
+- Prior Owner approval（Issue #33）: APPROVED（Itsuki Matsumoto、2026-11-16T13:34:12+09:00、提示された本版のSHA-256 `8c9ceb61cbee4e897f8afad63245410c8bca69f5ea89c8e6a5b57e6f89038864` に対する本人回答 `A`）
 - Prior Owner approval: 2026-08-17（Issue #29のstable Worker share URLによるOGP回帰復旧設計）
-- Design review: APPROVED（review-04、Issue #33の更新内容。blocking findingなし）
+- Prior design review（Issue #33）: APPROVED（review-04、Issue #33の更新内容。blocking findingなし）
 - Prior design review: APPROVED（Issue #22 AC0〜AC9、Issue #29 owner-approved design）
-- Implementation gate: Issue #33の本版確認済み。実装・全回帰・独立review-07を完了し、Code Generation Resultは本人回答`A`で承認済み（2026-11-16T14:29:00+09:00）。Build/Test Resultは書式修正後の新digestに対する本人回答`A`で再承認済み（2026-11-16T14:52:21+09:00）。cycle完了記録は`docs/records/aidlc-cycles/2026-11-16_issue-33_ai-provider-fallback/`。canonical確認原典: context rootの`_scratch/codex-work/20261116-114342_1212hp-ai-provider-fallback/canonical-owner-confirmation.md`（prompt: 2026-11-16T13:33:01+09:00）。本文中の実装未着手という時点記述は確認時点の記録として保持する。本番反映は別のOwner操作
+- Implementation gate: Issue #35はgate 1〜3の承認と、承認済みCode Generation PlanどおりのDraft→Approved反映を確認してから実装する。独立reviewは実装後に設計と実装をまとめて1回行い、gate 4〜5で結果を確認する。merge・production deployは別のOwner承認、本番の速度確認はdeploy後のOwner確認とする
+- Prior implementation gate（Issue #33）: Issue #33の本版確認済み。実装・全回帰・独立review-07を完了し、Code Generation Resultは本人回答`A`で承認済み（2026-11-16T14:29:00+09:00）。Build/Test Resultは書式修正後の新digestに対する本人回答`A`で再承認済み（2026-11-16T14:52:21+09:00）。cycle完了記録は`docs/records/aidlc-cycles/2026-11-16_issue-33_ai-provider-fallback/`。canonical確認原典: context rootの`_scratch/codex-work/20261116-114342_1212hp-ai-provider-fallback/canonical-owner-confirmation.md`（prompt: 2026-11-16T13:33:01+09:00）。本文中の実装未着手という時点記述は確認時点の記録として保持する。本番反映は別のOwner操作

 ## 1. 目的
@@ -54,5 +56,5 @@
 - Live一覧と開催状態
 - Live新規登録・編集
-- 元情報取込とAI整理の配置・provider自動切替（Issue #33）
+- 元情報取込とAI整理の配置・provider自動切替（Issue #33）・OpenAIの考える量の最小化（Issue #35）
 - X告知の準備・外部遷移
 - Live単位の予約確認
@@ -218,5 +220,5 @@
 - 詳細な抽出・置換仕様はIssue #21で扱う。

-Issue #33では、#21の抽出・置換内容を保持したままprovider自動切替を追加する。以下は本版のOwner確認後に実装する契約であり、現時点でcode・testは未変更である。
+Issue #33のprovider自動切替と#21の抽出・置換内容を保持し、Issue #35ではOpenAI requestの`reasoning.effort`だけを`minimal`にする。Issue #33の承認・実装経過は完了cycleを参照する。

 ### 7.1 入力とproviderの順序（R1・R2）
@@ -268,8 +270,10 @@
 ### 7.5 設定、公開順序、rollback（R7）

-| provider | Worker secret | 任意のモデル変数 | 未設定・空白時の既定モデル |
-|---|---|---|---|
-| OpenAI | `OPENAI_API_KEY` | `LIVE_AI_MODEL` | `gpt-5-mini` |
-| Claude | `ANTHROPIC_API_KEY` | `LIVE_AI_CLAUDE_MODEL` | `claude-haiku-5-5` |
+| provider | Worker secret | 任意のモデル変数 | 未設定・空白時の既定モデル | requestで指定する考える量 |
+|---|---|---|---|---|
+| OpenAI | `OPENAI_API_KEY` | `LIVE_AI_MODEL` | `gpt-5-mini` | `reasoning.effort: "minimal"` |
+| Claude | `ANTHROPIC_API_KEY` | `LIVE_AI_CLAUDE_MODEL` | `claude-haiku-5-5` | `output_config.effort: "low"` |
+
+管理者が画面で待つ操作で、元情報から10項目を抽出する処理のため、OpenAIの考える量を`minimal`（最小）に固定する。既定モデル・抽出指示・schema・validator・provider順・各15秒／全体30秒の期限・エラー分類・画面表示は変更しない。`LIVE_AI_MODEL`で上書きしたモデルにも同じ指定を送り、非対応モデルがHTTP 400を返した場合は既存の失敗時切替を使う。Claudeが設定され利用可能ならClaudeの結果を返し、Claude未設定なら既存の失敗応答になる。

 新しい設定UI・モデル選択UI・SDK依存は追加しない。API接続先の切替fallbackを追加せず、`allowBaseFallback: false`を維持する。
@@ -449,4 +453,15 @@
 | AC-09 / R7・承認境界 | 実装前に本設計・索引・Worker READMEを揃え、変更後canonicalのOwner確認を得る。5 gateは各artifactのexact digestと結び付ける |

+### 12.2 Issue #35の受入条件
+
+| ID / Issue本文の受入条件 | 合格にする観測 |
+|---|---|
+| AC-35-01 / 1 | OpenAI outbound bodyに`reasoning: { effort: "minimal" }`があり、既定・上書き・空白モデルでfocused testがPASSする |
+| AC-35-02 / 2 | 他のOpenAI request field、Claude側、provider順、各15秒／全体30秒、エラー分類、管理画面表示、抽出指示・10項目schema・validatorが変わらず、既存testと全回帰がPASSする |
+| AC-35-03 / 3 | 本設計・索引・Worker READMEが承認済みCode Generation Planの差分と一致する。gate 3が本差分のOwner確認を兼ね、別のcanonical確認を挟まない |
+| AC-35-04 / 4 | Ownerがdeploy後に同じ元情報で試し、「OpenAIで整理しました」と表示され、従来より待ちが短いと確認する |
+
+AC-35-04はdeploy後のOwner確認として残す。mock testやcycle closeで本番の成功・速度を証明した扱いにしない。
+
 ## 13. 検証方法

@@ -481,4 +496,10 @@
 current canonicalとR1〜R7の整合は独立Reviewerが確認し、Ownerのcanonical確認・Code Generation Result・Build/Test Result・Front受入を区別して記録する。mock PASSは本番key、credit、model entitlement、実速度、初回schema compilationの成功を証明しない。

+### 13.2 Issue #35の検証
+
+gate 1〜3承認後、Code Generation Planに固定した差分を本設計・索引・Worker READMEへ反映してから、既存Worker focused testにrequest bodyのassertionを加えてRED→GREENを確認する。Node v20.19.4で§13.1のfocused・全回帰・syntax・local integrity・scope確認を行い、実装後の独立Reviewerが設計・実装・承認済み差分の一致をまとめて確認する。Owner確認はgate 1〜3とgate 4〜5の2回にまとめる。
+
+現行のOpenAI公式docsでは`gpt-5-mini`の`minimal`対応・既定effortを再確認できておらず、実APIも未検証である。Claude表示は切替後の成功providerだけを示し、非対応400や遅延原因を確定しない。本番でのOpenAI成功と待ち時間はdeploy後にOwnerが確認する。
+
 ## 14. Canonical file map

--- a/docs/specs/current/README.md
+++ b/docs/specs/current/README.md
@@ -14,5 +14,5 @@
 |---|---|---|
 | `system-design-principles.md` | Approved | 1212HP全体の設計・運用原則 |
-| `live-operations-admin-ui.md` | Approved | Live運用のadmin UIと公開画面の対応。Issue #33のAI整理provider自動切替を反映し、Owner確認済み。#21の抽出内容と#29のshare URL契約を保持 |
+| `live-operations-admin-ui.md` | Approved | Live運用のadmin UIと公開画面の対応。Issue #33のAI整理provider自動切替とIssue #35のOpenAI reasoning.effort=minimalを反映。Issue #35のgate 3承認を本文差分のOwner確認とし、#21の抽出内容と#29のshare URL契約を保持 |

 設計内容を変更したら、この索引の状態と対象も更新します。
--- a/cloudflare/worker/README.md
+++ b/cloudflare/worker/README.md
@@ -40,5 +40,5 @@
 ## Live元情報のAI整理

-> Issue #33のprovider自動切替を実装済みです。`docs/specs/current/live-operations-admin-ui.md`はOwner確認済みのApprovedです。Code Generation ResultはOwner承認済み、Build/Test Resultも書式修正後の新digestで再承認済みです。cycle履歴は`docs/records/aidlc-cycles/2026-11-16_issue-33_ai-provider-fallback/`にarchive済みで、`aidlc-docs/`はidleです。本番反映は未実施です。
+> AI整理の現在の設計は`docs/specs/current/live-operations-admin-ui.md`を正本とします。Issue #33のprovider自動切替を保持し、Issue #35ではOpenAIの考える量だけを最小にします。実装・検証・承認・本番反映の状態は各cycleの記録で区別します。

 `POST /api/admin/live-source-intake`は、管理画面で貼り付けたLiveの元情報をOpenAI Responses APIで先に整理し、OpenAI側の失敗時は同じ`sourceText`でClaude（Anthropic Messages API）へ切り替えます。既存の管理APIと同じBearer認証が必要です。
@@ -70,8 +70,10 @@
 ### secretとモデル

-| provider | Worker secret | 任意のWorker変数 | 未設定・空白時の既定モデル |
-|---|---|---|---|
-| OpenAI | `OPENAI_API_KEY` | `LIVE_AI_MODEL` | `gpt-5-mini` |
-| Claude | `ANTHROPIC_API_KEY` | `LIVE_AI_CLAUDE_MODEL` | `claude-haiku-5-5` |
+| provider | Worker secret | 任意のWorker変数 | 未設定・空白時の既定モデル | requestで指定する考える量 |
+|---|---|---|---|---|
+| OpenAI | `OPENAI_API_KEY` | `LIVE_AI_MODEL` | `gpt-5-mini` | `reasoning.effort: "minimal"` |
+| Claude | `ANTHROPIC_API_KEY` | `LIVE_AI_CLAUDE_MODEL` | `claude-haiku-5-5` | `output_config.effort: "low"` |
+
+管理者が画面で待つ操作で、元情報から10項目を抽出する処理のため、OpenAIの考える量を`minimal`（最小）に固定する。既定モデル・抽出指示・schema・validator・provider順・各15秒／全体30秒の期限・エラー分類・画面表示は変更しない。`LIVE_AI_MODEL`で上書きしたモデルにも同じ指定を送り、非対応モデルがHTTP 400を返した場合は既存の失敗時切替を使う。Claudeが設定され利用可能ならClaudeの結果を返し、Claude未設定なら既存の失敗応答になる。

 両APIキーはWorker secretとしてのみ設定し、コード、HTML、ブラウザ側JavaScript、レスポンスへ置かないでください。既存の`LIVE_AI_MODEL`はOpenAI専用のままです。モデル選択UIは追加しません。本番secret操作とdeployはOwnerの明示承認後に行います。
```

## 3. focused testをRED→GREENにする

§2のApproved反映と後続の実装委任を確認してから、既存のfetch stubを使ってoutbound requestを捕捉する。実API・実secret・networkを使わず、OpenAIのmock成功を返す。

| 順序 | path / 作業 | 観測 |
|---|---|---|
| 1: test追加 | `cloudflare/worker/test/live-ai-source-intake.test.js`の`calls Responses API with the strict extraction contract and returns a normalized draft`へ`assert.deepEqual(body.reasoning, { effort: "minimal" })`を追加 | 既定モデル・input・指示・strict schema・正規化結果の既存assertionを残す。top-level key集合を`model, reasoning, instructions, input, text`の5つに固定し、`text.format.name`が`live_source_intake`であることも確認 |
| 2: 上書き | 既存の`accepts the 12,000 character boundary, model override, and standard nested output text`へ同じreasoning assertionを追加 | model override・12,000文字・nested outputの既存検証を保持 |
| 3: 空白/trim | 同fileに`OpenAI minimal reasoning keeps whitespace defaults and trimmed model overrides`という小さいtable testを追加。モデル変数を空白だけ、および前後空白付きのoverrideにする | 捕捉したmodelがそれぞれ`gpt-5-mini`／trimしたoverrideで、reasoningは両方`{ effort: "minimal" }`、応答が既存のdraftと`provider: "openai"`になる |
| 4: RED | 下記focused commandをproduction code未変更で実行 | 追加したreasoning assertionの`undefined`対`{ effort: "minimal" }`の不一致で失敗することを記録。syntax/import/fixture破損はREDに数えない |
| 5: 最小実装 | `cloudflare/worker/src/worker.js`へ§1の1行だけ追加 | git差分でそれ以外のproduction変更がないことを確認 |
| 6: GREEN | REDと同じfocused commandを実行 | 新しいassertionと既存の全ケースがPASSする |

```bash
export PATH="/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH"
node --version
node --test cloudflare/worker/test/live-ai-source-intake.test.js
```

`node --version`は`v20.19.4`を必要とする。理由はv24.4.1の`node --test test/`でdirectory引数が失敗する環境差が確認済みのため。test数・失敗の要点・exit codeをaudit/resultへ記録し、GREENのために既存assertionを削らない。

HTTP 400→Claudeの切替、Claude wire contract、provider順、期限・エラー分類・sanitize・管理画面表示は既存testで回帰確認する。非対応effortを特別扱いするコードや、同じfallbackの重複testは増やさない。実速度の短縮・APIのmodel対応はmockでPASSとしない。

## 4. 回帰と独立review

repository rootで同じNode v20.19.4を使い、次を実行する。Worker依存は既存の`node_modules`を使い、install・fetchを行わない。

```bash
export PATH="/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH"
node --version
node --test cloudflare/worker/test/live-ai-source-intake.test.js
node --test --test-name-pattern='AIで整理 source intake' test/admin-live-operations.test.mjs
node --test test/
npm --prefix cloudflare/worker test
node --check cloudflare/worker/src/worker.js
scripts/aidlc-verify.sh --local
scripts/aidlc-cycle.sh status
git diff --check
git status --short
git diff --stat
git diff -- cloudflare/worker/src/worker.js
```

合格は対象testと全回帰のfailure/cancelledが0、syntax・integrity・diffがexit 0で、production差分がreasoningの1行だけ、canonicalが§2と一致すること。name pattern対象外のskipは別記し、全回帰は予期しないskipがないことを確認する。Front確認済みbaselineはroot 239/239、Worker 268/268であり、今回のWorkerによる再実行結果ではない。

実装・回帰後、Frontがexecutorから独立したread-only Reviewerを1回手配し、Issue #35／RequirementsのAC-35-01〜04、逐語差分、productionの1行、testのRED/GREENと既存契約の保持をまとめて確認する。Reviewerは本番確認未実施を保持し、blocking findingがあれば修理・必要な再検証の後に確認する。Workerの自己検証を独立reviewに読み替えない。

## 5. 結果の固定、closeの事前確認、残る本番確認

gate 4候補は`aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md`、gate 5候補は`aidlc-docs/construction/build-and-test/build-and-test-summary.md`へ作る。独立reviewと必要な修理を反映してbytesを固定した後、Frontが確認2で両artifactのexact digestを提示する。承認後に結果本文の書式を変えるだけでもdigestが変わるため、再承認が必要になる。

Build/Test Resultと`aidlc-docs/cycle-summary.md`は、blocking findingを実際にすべて解消してから、次の**field行**を各1回持たせる。見出しと本文への分割ではvalidatorが読めない。

```markdown
- **Blocking Findings**: None
```

AC-35-04は両resultとcycle summaryに「deploy後のOwner確認待ち」と明示し、技術的なblocking findingとは区別する。実装・自動検証・独立review・Ownerのgate判断・Front受入・本番効果の各signalを分ける。`None`は実API対応や本番AC合格の宣言ではない。

gate 4〜5の実際の承認記録、fresh digest、review解決、Front受入が揃ってから、stateのclose用4値を`Cycle Status: Complete`、`Current Stage: Complete`、`Approval Gate: None`、`Approval Status: Complete`へ揃える。承認済みplanのchecked行は編集しない。state/audit/resultに未回答・不一致を残したままcloseしない。

**close前に使い捨てcopyで`validate_close_ready`を事前確認する。** 本番のcloseを予行演習として実行しない。後続packetで許可されたscratchへ`scripts/aidlc-cycle.sh`のdispatch直前までの関数定義をcopyし、末尾に`validate_close_ready`呼出しだけを付ける。exactな切り出し境界は `command="${1:-}"` の行である。`AIDLC_REPO_ROOT`を本worktreeの絶対pathに設定して、この使い捨てvalidator copyをbashで実行する。これにより、署名対象の実artifact・元のabsolute path bindingをread-onlyで検証し、`command_close`・archive・idle交換を一切呼ばない。approvalを仮造したcopyや、pathを書き換えたapprovalで成功を作らない。

事前確認はexit 0を記録し、同じ時点の5 artifact digest・state・2つのBlocking Findings field・未チェック行なしを再確認する。失敗はstate/summary等の通常修理で解決し、承認済みartifactを直す必要が出たら新digestのOwner再承認へ戻る。確認後の正式closeはFrontのcompletion gateに従う。今回は使い捨てcopy・validator実行・closeを行わない。

本番のmerge・deployは別のOwner承認が必要。deploy後、Ownerが同じ元情報で実行し、OpenAI表示と待ちの短縮を確認する。Claude表示なら成功providerの記録に留め、原因を断定しない。改善を確認できなければAC-35-04を未達としてFrontへ返す。最小のrollback候補は今回のreasoning 1行と対応するcanonical差分だけを戻すことで、#33のfallback・UIやunrelated workを戻さない。本番rollbackもOwner判断とし、モデルやtimeoutを追加変更しない。
