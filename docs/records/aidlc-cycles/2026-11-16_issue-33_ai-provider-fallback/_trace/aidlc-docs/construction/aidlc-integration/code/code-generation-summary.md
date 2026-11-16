# Code Generation Result — AI整理のprovider自動切替（Issue #33）

- 状態: 実装候補作成済み / focused GREEN / gate 4未承認
- 自己検証: 承認済みPlanの全回帰PASS（Node v20.19.4） / B1解消 / gate 4承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-16_issue-33_ai-provider-fallback`
- 実行先: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-33-ai-provider-fallback`
- Branch: `feature/33-ai-provider-fallback`
- 作成日: 2026-11-16

## 変更後の動作

Liveの「元情報から作成」は、OpenAIで有効な下書きを得られない時に、同じ元情報でClaudeを1回試す。片方のキーだけでも動作し、成功したproviderを既存の小さいstatus欄へ表示する。10項目と告知previewを反映する処理、失敗時の入力保持、保存前に内容を確認する流れを維持した。

変更前baselineと同じNode v20.19.4で承認済みPlanのcommand群を再実行し、すべてexit 0を確認した。rootの指定command `node --test test/` は239/239、Worker全回帰は268/268、admin全回帰は154/154 PASSだった。Node v24.4.1ではdirectory引数が`MODULE_NOT_FOUND`になるが、同じ4ファイルを`node --test test/*.test.mjs`で指定すると239/239 PASSとなる。B1はNodeの実行環境差として解消した。今回の再検証でcode・test・承認済みPlan・確認済みcanonicalは変更していない。

## canonicalの確認と保持した設計

Itsuki Matsumotoの`2026-11-16T13:34:12+09:00`の本人回答`A`を、Frontの確認原典から照合した。promptは`2026-11-16T13:33:01+09:00`。原典はcontext rootの`_scratch/codex-work/20261116-114342_1212hp-ai-provider-fallback/canonical-owner-confirmation.md`で、3文書の提示前後digestが一致している。

確認対象はspec `8c9ceb61cbee4e897f8afad63245410c8bca69f5ea89c8e6a5b57e6f89038864`、索引 `8c94730500807702bc5e1ca36cdaf9386b2ff4aeaa1795f97a96a8ea7941b024`、Worker README `9be14ae10cf28c1f5f7e74c35315cb9be2c668edfd6cce60fa073b82a9cfc7ba`。specと索引をApprovedに揃え、specの確認記録とauditへ根拠を記載してからtest/codeを変更した。

spec本文は変更していない。status・確認記録を除いて復元したbytesのdigestがOwner提示版と一致することを検証した。本文に残る「code・test未変更」は確認時点の記録であり、現在の実装状態は本結果とstateに示す。Worker READMEは実装前という冒頭の時点表現だけを更新した。

`LIVE_AI_INSTRUCTIONS`、`LIVE_AI_OUTPUT_SCHEMA`、10項目の定義・文字数制約、`validateLiveAiDraft`、OpenAIのrefusal/output判定はHEADとbytes一致する。Requirements・Workflow Plan・Code Generation Plan・approvals/01〜03も開始時digestを保持した。

## 実装と設計の対応

| 対象file | 変更と設計の対応 |
|---|---|
| `cloudflare/worker/src/worker.js` | Plan §3。既存Responses APIを`requestOpenAiLiveDraft`へ分離。`requestClaudeLiveDraft`、期限検査、共通attemptとcoordinatorを追加。両keyを検査し、成功時だけ`draft`と固定enumの`provider`を返す |
| `admin/app.js` | Plan §5。旧`draft`単独と、`draft`+有効な`provider`だけを受理。固定の対応表から成功文言を選び、全項目・preview・dirty処理の成功後に既存`textContent`表示へ渡す |
| `cloudflare/worker/test/live-ai-source-intake.test.js` | Plan §4。key構成、切替・再実行、wire contract、両adapterの失敗、漏洩防止、単調時計とmock timerによる期限・cleanupを追加。旧即発火timeout fixtureを仮想時計へ置換 |
| `test/admin-live-operations.test.mjs` | Plan §4。既存の一括反映・失敗時保持・stale/逆順/rollback/duplicate/Local Mode/custom API baseをlegacy/openai/claudeへ適用。未知provider、余分なkey、status・保存中排他も検証 |
| `docs/specs/current/live-operations-admin-ui.md`、`docs/specs/current/README.md` | Owner確認後のApproved化と確認記録だけを同期 |
| `cloudflare/worker/README.md` | 実装済み・gate 4/5未承認・本番未反映の現在位置へ冒頭の表現を同期 |
| `aidlc-docs/aidlc-state.md`、`aidlc-docs/README.md`、`aidlc-docs/audit.md` | gate 4待ち、B1解消、全回帰の結果と証拠を同期。review-04 F1の古い入口状態を解消。auditは追記のみ |
| 本書と`construction/build-and-test/build-and-test-summary.md` | 2つの承認前resultを作成。approval04/05は作成していない |

Claudeは`POST https://api.anthropic.com/v1/messages`へ指定3 headerで送り、既定`claude-haiku-5-5`、任意の`LIVE_AI_CLAUDE_MODEL`、`max_tokens: 16384`、`output_config.effort: low`を使う。共通指示とschema、確定した同じsourceだけを渡す。`thinking`、sampling、prefill、tools、server-side fallbacks、OpenAI用の`name`/`strict`は送らない。`stop_reason: end_turn`だけを認め、`type: text`かつstringのblockを順に連結してparse・共通検証する。

全体のdeadlineは`performance.now()`で開始時に一度だけ30秒後へ固定する。各attemptは15秒と全体残余の小さい方で、fetchからbody読取・parse・validationまでをabort付きraceに含めた。全体にもraceを設け、処理完了時と採用直前に期限を再検査する。abort listenerとtimerはfinallyで解放する。前attemptの遅い完了・rejectは応答を上書きせず、未処理rejectにもならない。

## focused RED → GREEN

production code未変更のSHA-256をRED直後に確認した。Workerは`b64083097b323eb314d8c1b2fcbb59009af72267131761f73d6e84db485de6a5`、adminは`e560e06cafcc7dc24327f9a0219176d5e019add8289a08b8a9d805c3f2417a1f`で、開始時と一致した。

| focused test / fixture群 | REDで確認した不足 | GREEN |
|---|---|---|
| Responses API成功、nested output、key構成 | 成功応答のprovider欠落、Claude単独は200を期待して503 | 正規化済み10項目・provider、順序・回数が一致 |
| `every OpenAI failure falls back once to Claude...`（38 fixtures） | Claude成功の200を期待して502 | 各fixtureで同一sourceをOpenAI→Claudeへ送り、次requestもOpenAIから開始 |
| `Claude wire contract shares instructions and schema...`（3 model fixtures） | OpenAI失敗後に終了し、Anthropic outboundなし | header・model・全body key・共通指示/schema・複数text blockの読取が一致 |
| `every Claude failure returns a sanitized 502...`（45 fixtures × single/dual） | singleは502を期待して503、dualは2回を期待して1回 | HTTP/throw/envelope/stop/content/JSON/20種のdraft不正が固定502 |
| success/failureの漏洩防止 | provider付き成功が未実装で不一致。既存のエラー秘匿はPASS | secret・上流本文・ID・prompt・thinkingをresponse/logへ出さない |
| 単独停止・timeout後のsuccess/HTTP/timeout・body停止・残余・期限競合 | 非協調fetch/bodyはpending、fallbackなし、OpenAIの15秒以後の成功を採用 | 14,999/15,000 ms、29,999/30,000/30,001 ms、10秒残余、期限後のvalidation棄却・abort・cleanupが一致 |
| admin一括反映・dirty・入力変更・editor交代/逆順（両provider） | providerを余分なkeyとして拒否し、一般失敗に到達 | 空値を含む全置換・preview・固定成功表示。変更済み入力や別editorには反映しない |
| admin成功statusの消去（両provider） | 最初の成功がfalse | 整理中・失敗・editor交代に古いprovider成功を表示しない |
| 既存の失敗保持・Local Mode・custom base・重複・rollback、新規の未知provider/保存中排他 | 既存動作の保護testはRED時からPASS。追加挙動のREDと区別 | 両providerと旧payloadでも入力・previewを保持し、勝手な保存・X送信なし |

focused commandはrepository rootから実行した。

- `node --test cloudflare/worker/test/live-ai-source-intake.test.js`: RED 182件中PASS 16 / FAIL 166、GREEN 182/182。
- `node --test --test-name-pattern='AIで整理 source intake' test/admin-live-operations.test.mjs`: RED 81件中PASS 69 / FAIL 12、GREEN 81/81。

診断収集時のみ同commandに`--test-reporter=tap`を追加した。syntax/import破損をREDには数えていない。初回GREEN確認中に、200/502用fixtureが本処理へ渡していないdeferredをrejectするtest自身の問題を検出した。late rejectを実際に渡す504 fixtureへ限定し、再実行では終了後のunhandled rejectionも0だった。詳細な失敗名と理由は`aidlc-docs/audit.md`に残した。

## 残る確認と受入境界

Build/Test ResultのBlocking FindingsはNone。承認済みPlanの回帰commandは、既存の`/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin`をPATHの先頭に置いて成功した。v24のglob指定は環境差を確認する追加検証であり、正式回帰はPlanのcommandをそのまま使った。v20のfocused再実行はWorker 182/182、admin 81/81 PASSで、adminはname patternによる対象外69件をskippedとして報告した。全件回帰のcancelled / skippedは0。件数・exit codeと実行環境はBuild/Test Resultを参照する。

実APIのcredit、権限、model entitlement、初回schema compilation、実入力に対する15秒内の成功率は未検証。30秒はWorker内の処理予算で、transportやevent loop停止の厳密な上限ではない。本番反映は新admin→既存タブ再読込・旧payload受理確認→新Workerの順序を守る。

本結果はWorkerの自己検証済み候補である。実装後の独立review、gate 4・5のOwner判断、Front completionは未実施。cycleはactiveのままである。
