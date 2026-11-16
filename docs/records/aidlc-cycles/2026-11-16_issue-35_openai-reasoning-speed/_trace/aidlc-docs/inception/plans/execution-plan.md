# Workflow Plan — AI整理の待ち時間を短くする（Issue #35）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-16_issue-35_openai-reasoning-speed`
- Base Commit: `799b29fe340431654f7a21fbdb2fbd58cd8c22e3`
- Branch: `feature/35-openai-reasoning-speed`

## 1. 責任と進め方

OpenAIのrequest設定を1行追加する。要件・工程・canonical本文の逐語差分を先に揃え、本人は次の2回で判断する。

| 確認 | 対象 | 判断の範囲 |
|---|---|---|
| 確認1 | gate 1 Requirements、gate 2 Workflow Plan、gate 3 Code Generation Plan | 3つのexact digestと、gate 3内に固定したcanonical本文差分を一緒に確認する |
| 確認2 | gate 4 Code Generation Result、gate 5 Build/Test Result | 実装、RED→GREEN、全回帰、独立review、残る本番確認を一緒に確認する |

canonical専用のOwner確認は追加しない。独立read-only reviewは実装後に設計と実装をまとめて1回行う。変更が1行で可逆であり、設計前提・canonical・実コード・検証の一致を同時に確認できるためである。実装前の独立reviewを別途必須にはしない。欠陥が出た場合の修理・再確認は省略しない。

| Executor Plan | 担当・境界 |
|---|---|
| owner / approver | Itsuki Matsumoto。5 gateとも本人のA/B/Xを必要とする |
| executor | bounded Worker。本packetは候補3文書・audit・stateと自己検証まで。後続実装は明示委任後 |
| reviewer | executorから独立したread-only Reviewer。実装後にFrontが手配する。Workerは兼任・再委任しない |
| completion gate owner | VECTOR / Front Runtime。Owner対話、承認記録、review管理、全体受入 |
| commit_mode / risk_class | none（commit・push・PRは行わない）／Lite・D1。merge・production deployは別Owner承認 |

## 2. 工程と停止位置

1. Workspace Detection: branch・base・物理worktree・Issue写し・canonical/code/test・local payloadを確認してcycleをstartする。
2. Requirements・Workflow Plan・Code Generation Planを未承認候補として作る。**現在位置はRequirements gate承認待ち**。候補を先行作成してもgateを通過した扱いにしない。
3. Frontが確認1を提示し、gate 1→2→3の承認をそれぞれのartifactに記録する。gate 3の逐語差分がcanonical本文のOwner確認を兼ねる。
4. 後続WorkerがCode Generation Plan §2どおりcurrent specと索引をDraftに戻し、本文・READMEを逐語反映する。gate 3承認と差分一致を確認しApprovedにする。ここまでcode/test未変更。
5. Workerがfocused testを先にREDにし、request設定1行でGREENにする。全回帰・syntax・local integrity・scope確認を実施し、gate 4・5のresult候補とcycle summaryを作る。
6. Frontが独立Reviewerを1回手配し、設計・実装・canonical・AC・証拠をまとめて確認する。修理が必要ならWorkerへ返し、影響する検証・review・resultを更新する。
7. Frontが確認2を提示し、gate 4→5をそれぞれ記録する。5 gateのfresh digest・state・findingsを照合し、Front受入後にcloseする。close前に使い捨てvalidator copyで`validate_close_ready`を事前確認する。
8. merge・deployはOwnerの別承認で進め、本番でのOpenAI表示と待ち時間はdeploy後にOwnerが確認する。AC-35-04を未検証のまま本番受入済みにしない。

承認済み3文書は実施記録として編集せず、bytesを固定する。進捗・結果・review・本番確認待ちはstate、audit、result summaryへ記録する。修正で承認済みbytesが変わる場合は、旧recordをSUPERSEDEDとして保持し、新digestの承認を得る。

## 3. 必須5 gateの固定mapping

checked行は採用するgateとpathの最終形を表す。実施済み・承認済みを意味しない。artifactとrecordのpathは`aidlc-docs/`からの相対pathである。

- [x] REQUIRED|Requirements|inception/requirements/requirements.md|approvals/01-requirements-approval.md
- [x] REQUIRED|Workflow Plan|inception/plans/execution-plan.md|approvals/02-workflow-plan-approval.md
- [x] REQUIRED|Code Generation Plan|construction/plans/aidlc-integration-code-generation-plan.md|approvals/03-code-generation-plan-approval.md
- [x] REQUIRED|Code Generation Result|construction/aidlc-integration/code/code-generation-summary.md|approvals/04-code-generation-result-approval.md
- [x] REQUIRED|Build/Test Result|construction/build-and-test/build-and-test-summary.md|approvals/05-build-test-result-approval.md

Frontは各確認を1つの承認promptにまとめ、対象stage・repository-relative/absolute path・fresh SHA-256を全件明記し、Aが「列挙した各artifactのexact digestをすべて承認する」ことを日本語で明示する。確認1にはgate 3内のcanonical差分のOwner確認を含むことも明示する。各stageの記録には、その全promptと同じ本人の完全なraw応答を保存する。別stageだけを対象にした承認の流用は認めない。

各recordはexact stage、両path、SHA-256、Itsuki Matsumoto、prompt/response timestamp、完全なprompt/raw response、explicit Decisionを持つ。promptの最終行は次と完全一致させる。

`Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other.`

単一ASCII `A`と`APPROVED`から始まるDecisionのみ有効。`B`・`X`・沈黙・方向への「ok」では通過しない。本packetは承認recordを作らない。

## 4. 不要stageのtailoring

以下はWorkflow Planの承認対象となるskip方針の最終形である。必要な設計・受入内容はRequirementsとCode Generation Planへ集約する。

- [x] SKIP|Reverse Engineering|現行canonical・対象adapter・既存testを直接確認し、1行変更に必要な現行契約をauditへ記録するため、全体再構成の別冊は不要。
- [x] SKIP|User Stories|管理者の既存操作への変更で、目的と4つの検証可能なACをRequirementsに定義するため。
- [x] SKIP|Application Design|endpoint・component・data flowを追加せず、既存request bodyの設定だけを変えるため。
- [x] SKIP|Units Generation|Workerの単一変更をaidlc-integrationとして一括受入し、unit分割が不要なため。
- [x] SKIP|Functional Design|minimal指定と保持する契約・失敗時の挙動をRequirementsとCode Generation Planに固定するため。
- [x] SKIP|NFR Requirements|速度の目的・既存の期限・secret境界・実APIのGapをRequirementsに統合するため。
- [x] SKIP|NFR Design|既存timeout・fallbackを維持し、request設定1行と既存mock testの拡張で検証できるため。
- [x] SKIP|Infrastructure Design|hosting・DB・secret・package・モデル変数の追加変更がないため。
- [x] SKIP|Operations|merge・deployはOwnerの別承認で扱い、本cycleにはrollback計画とdeploy後のOwner確認だけを残すため。

## 5. 停止・見直しと受入

mustとcurrent canonical・DOCS_RULES・AI_DLC_WORKFLOWが矛盾する場合、許可外write・network・secret参照が必要な場合、手順外のstart/status故障、Ownerの価値判断が必要な場合はBLOCKEDでFrontへ返す。日常の技術判断・修理は委任境界内でWorkerが行う。

今回の自己検証は、5 gateのmapping、SKIP理由、未チェック行なし、承認record未作成、逐語差分の適用可能性、Requirements gate待ち、scope、3成果物のSHA-256まで。実装・全回帰・独立review・Owner承認・Frontの全体完了は未実施として分離する。既存local payloadの整合PASSは、公式sourceのlive authenticityを証明しない。
