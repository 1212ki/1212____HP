# AI整理のprovider自動切替 — Issue #33 完了記録

- **Cycle ID**: 2026-11-16_issue-33_ai-provider-fallback
- **Issue**: #33
- **Branch**: feature/33-ai-provider-fallback
- **Base Commit**: efae6108d4b6cdc126f2f7b626806460727acc34
- **Owner**: Itsuki Matsumoto
- **Cycle Status**: Complete
- **Blocking Findings**: None

Liveの「元情報から作成」に、OpenAIが失敗した時だけ同じ元情報をClaudeで整理する処理を実装した。検証済みの10項目と告知previewを一括反映し、成功したproviderを既存の小さい欄に表示する。5 gateは各artifactのexact digestに対する本人回答`A`で承認済み。gate 5は書式1行修正後の新digestに対する再承認を記録し、旧承認05をSUPERSEDED履歴として保持する。独立reviewは3回ともAPPROVEDで、実装reviewの非blocking指摘1件はFrontの判断により既知の制限として残す。

本番反映は未実施。merge、production deploy、公開時のタブ再読込・動作確認はOwnerの別操作として残る。本記録とrepositoryのcycle closeは、公開承認やFrontの全体受入を代行しない。

## 要件と実装結果

| 要件 | 成立した動作と根拠 |
|---|---|
| R1・R2 / AC-01〜03 | 設定済みkeyをOpenAI→Claudeの順に各1回まで試す。OpenAI成功時はClaudeを呼ばず、全失敗分類で切替対象とする。片方のkeyだけでも動き、両方なしは既存503。認証・入力不正では呼出0回。次requestは再びOpenAIから開始する |
| R3 / AC-04・08 | 既存の指示、10項目schema、共通validatorを保持。空値を含む全置換・preview更新は一括で行い、失敗、不正payload、入力変更、editor交代、反映例外では元情報と入力を保持する。保存・公開・X送信は行わない |
| R4・R5 / AC-05・07 | 全体30秒・各社最大15秒と残余予算、body停止・abort非協調・期限後結果の棄却を実装。最終timeout/全体期限は固定504、その他の全失敗は固定502。secret、上流本文、request ID、promptを応答・新規ログへ出さない。期限testの証明範囲は下記F1に示す |
| R6・R7 / AC-06・08 | 成功反映後だけOpenAI/Claudeの固定文言を表示。旧Workerのdraft単独応答を受理し、未知providerや余分なkeyを拒否する。Local Mode、custom API base、editor ownership、save-freeを保持する |
| R7・承認境界 / AC-09 | 実装前にcurrent spec・索引・Worker READMEを更新し、Ownerが変更後canonicalを確認。spec・索引はApproved。5 gateは各exact digestで承認済み。gate 5は書式修正後の新digestへの再承認 |

現在の仕様正本は`docs/specs/current/live-operations-admin-ui.md`と`docs/specs/current/README.md`、APIと公開手順は`cloudflare/worker/README.md`にある。accepted historyの保存先は`docs/records/aidlc-cycles/2026-11-16_issue-33_ai-provider-fallback/`。transactional closeが本summaryとactive文書を保存し、`aidlc-docs/`をidleへ戻す。closeの成否とclose後の検証実測は`worker-10.result.md`に記録する。

## 5件のartifact-bound承認

5件の有効な承認は、Record statusがAPPROVED、ApproverがItsuki Matsumoto、Complete raw human responseが単一ASCII `A`、Decisionが`APPROVED`である。旧gate 5のRecord statusはSUPERSEDED。以下のartifact/recordはclose前の`aidlc-docs/`を基準とし、archive後は`_trace/aidlc-docs/`に同じbytesを保持する。

| gate・stage | 対象artifact | SHA-256 | 承認記録・回答日時 |
|---|---|---|---|
| 1 Requirements | `inception/requirements/requirements.md` | `d363d38e87c036a5c625692d6338bb83217a8707f305101f6ec21c87aa207e05` | `approvals/01-requirements-approval.md` / 2026-11-16T12:12:47+09:00 |
| 2 Workflow Plan | `inception/plans/execution-plan.md` | `c700d9d88a417a22c7579a2d54fc32e54288271f83fee5083a9ee6e9c61ad5f7` | `approvals/02-workflow-plan-approval.md` / 同上 |
| 3 Code Generation Plan | `construction/plans/aidlc-integration-code-generation-plan.md` | `6f90c647587e11d316003cde3cf4220e68931157a557d250c337943738e7afd7` | `approvals/03-code-generation-plan-approval.md` / 同上 |
| 4 Code Generation Result | `construction/aidlc-integration/code/code-generation-summary.md` | `1c2a572015f4ffb95992b427b40a6fff14499769dfc8f9c6a6a46c344715d7e7` | `approvals/04-code-generation-result-approval.md` / 2026-11-16T14:29:00+09:00 |
| 5 Build/Test Result | `construction/build-and-test/build-and-test-summary.md` | `c620c89eb01ae4af34ea3570088a4116efd7f6a78f66dbd9298a71547ab6c7fe` | `approvals/05-build-test-result-approval.md` / 2026-11-16T14:52:21+09:00 |

gate 1〜3のprompt提示は2026-11-16T12:11:14+09:00、gate 4・旧gate 5は2026-11-16T14:25:53+09:00。gate 5の再承認promptは2026-11-16T14:52:02+09:00、本人回答`A`は2026-11-16T14:52:21+09:00。canonical確認は2026-11-16T13:34:12+09:00の本人回答`A`で、根拠はspecのOwner approvalとauditに保持する。他4成果物とapprovals/01〜04のbytesは保持し、Build/Test ResultもBlocking Findings以外のbytesは変えていない。本文に残る承認前・実装前の時点記述は当時の記録として保持する。

## gate 5の再承認経緯

p09でBlocking Findingsの単独`None`を`- **Blocking Findings**: None`へ1行だけ書式修正し、旧digest `6ee345da…`の承認を`approvals/05-build-test-result-approval-SUPERSEDED-6ee345da.md`へ保持した。
Frontは単一file・1行・可逆・内容判断なし、validate_close_readyの事前検証PASSを理由に独立reviewを省略。Ownerの新digestへの回答`A`（2026-11-16T14:52:21+09:00）から固定pathの新承認05を作成した。

## 独立reviewとFrontの採否判断

| review | 対象・結果 | 指摘の扱い |
|---|---|---|
| review-02 | Requirements・2 plan、APPROVED、blockingなし | R1（MEDIUM、非blocking）は旧adminタブが残る互換性リスク。新admin公開後の既存タブ再読込、新adminと旧Worker応答の受理確認を公開手順へ追加し、review-04で整合を確認した |
| review-04 | 承認記録01〜03・current canonical、APPROVED、blockingなし | F1（LOW、非blocking）はactive READMEの古い状態表現。後続工程で入口とstateを同期し解消。承認済みartifactは変更していない |
| review-07 | 実装とB1修正、要件R1〜R7・AC-01〜09、APPROVED、blockingなし | F1（LOW、非blocking）は下記の期限test helperの限界。Frontが今回の採用と再検討条件を判断した |

review-07 F1では、test helperの`jump()`が`performance.now()`だけを進め、mock timerの時刻を進めない。したがってjump後の残余testはattempt期限を検証するが、その経路のglobal timerが元の30秒期限で発火することまでは証明しない。独立probeでこの性質が再現された。通常の30秒到達testと、実装が結果の採用前に期限を再確認する処理は別途成立しており、production不具合は確認されていない。

Frontは、管理者1名の管理画面で、最悪でも待ち時間がわずかに延びる程度と評価し、今回は既知の制限として採用し修正しないと判断した。この影響評価はFrontの判断であり、本番での実測ではない。再検討するのは、期限まわりを次に変更する時、または本番で30秒を超える待ちが観測された時である。その際はtimerと単調時計を同じ仮想時刻で管理し、同期処理後も元のglobal deadlineで発火するcaseを追加する提案を再評価する。

## 検証と実API確認

正式回帰は変更前baselineと同じNode v20.19.4を使用し、rootの`node --test test/`は239/239、Workerの全testは268/268 PASS。Worker focusedは182/182、admin focusedは81/81、admin全体は154/154 PASSである。実装前のfocused REDはWorkerが182件中166件FAIL、adminが81件中12件FAILで、review-07もHEAD codeへ現行testを接続してREDを独立再現した。

Node v24.4.1のdirectory引数による`MODULE_NOT_FOUND`は環境差B1として切り分け済み。同じ4ファイルを指定したroot 239件とWorker 268件はv24でもPASSした。承認済みPlanのbytesとcommandは変えず、正式回帰はv20で通した。p08のclose準備でもv20のroot・Worker全testと`--local`を再実行し、exit 0を確認した。p08当時は`validate_close_ready`がBuild/Test Resultの見出し形式を読めず停止した（`worker-08.result.md`）。p09の1行修正と新digestへの再承認により、この形式不一致を解消した。p10によるclose・archive検証・idle確認・Node v20.19.4のclose後全回帰は、実行後の`worker-10.result.md`に実測を返す。本summaryはclose前の承認・検証状態を保存する。

Frontは2026-11-16、実装後Workerのfetch handlerをNode v20.19.4から実Claude APIへ接続した。OpenAI keyなしのClaude単独経路でHTTP 200、3,125 ms、10項目が共通validatorを通り、本人を共演者から除外し、responseにキー文字列が含まれないことを確認した。この確認はFrontの`front-live-smoke.md`に基づき、p08による再実行ではない。実OpenAI経路と実APIでのOpenAI→Claude切替は未検証で、切替はmock testで確認した。本番Workerの速度、初回schema compilationの遅延、全入力で15秒以内に成功する割合も未計測である。

30秒はWorker内の処理予算で、通信遅延・upload・event loop停止を含む厳密なend-to-end保証ではない。

## 残るOwner操作と次の状態

5 gateの承認は完了した。repositoryのtransactional close後も、以下のOwner操作とFrontの全体受入は別に残る。

1. mergeとproduction deployは、それぞれItsukiの明示承認・操作として別途進める。
2. 新adminを先に公開する。
3. 既存adminタブを再読込し、新adminが読み込まれたことと、旧Workerのdraft単独応答を受理できることを確認する。
4. 確認後に新Workerを公開する。旧adminタブを残したままWorkerだけを先行公開しない。
5. rollbackが必要ならWorkerを旧応答へ戻し、その後に必要なadminの復元を行う。

本cycleの工程と5 gate承認はComplete。旧承認を含む履歴をtransactional closeでarchiveする。書式修正の独立review省略はFront原典に基づく判断であり、Workerの自己承認ではない。本Workerの実行結果と、Frontによる全体受入は区別する。

## 原典と来歴

次の原典はcontext rootの`_scratch/codex-work/20261116-114342_1212hp-ai-provider-fallback/`にある。本人対話・live smokeはFrontの記録を根拠とし、p08が直接観測したと扱わない。

| 原典 | SHA-256 |
|---|---|
| `gate-45-owner-responses.md`（本人回答・Front採否判断） | `b8467ed4df058dad83ae0fd74f86b560d5c68605a94088fc8db464230502d764` |
| `gate-5b-owner-response.md`（gate 5再承認・独立review省略理由） | `5e531cd12eb0641bdff8fc90b14c7a437c8f55941ad952819e6db2d4999486f2` |
| `front-live-smoke.md` | `e6713101c32340724588e747411beb21e75e39eb2e2bea380a2bb5dd3d7e0760` |
| `review-02.stdout.txt` | `f17266a47d08862d235b493f10c8122d49b6fbb02a86bbc0311bd8700c80c7ac` |
| `review-04.stdout.txt` | `7e8d3326aad1bf675865d1e93b1f7a284332f69ee6ad2ffedc049dc50fad08bc` |
| `review-07.stdout.txt` | `9794a9ff664fb396bfa584913b533b148fe5d07d039d290551e3ba8346b5d538` |
