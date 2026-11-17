# Workflow Plan — Figmaマスタと設計書の対応づけ（Issue #40）

- Status: Draft / Itsuki承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-17_issue-40_figma-design-mapping`
- Base Commit: `00cdea5e69d5b341fc0a2b21a4eece9a53c8a2cd`
- Branch: `feature/40-figma-design-mapping`
- Reader: human_reader / ja-JP / designated_text_editor（Frontが開く）

## 責任と2回の確認

Figmaのマスタと要件メモへ、設計の正本から画面ごとに戻れるようにする。確認1では要件・工程・昇格する3ファイルを固定し、承認後は提案版のbytesをそのまま昇格する。コードとFigmaは変えない。

| 確認 | Itsukiがまとめて判断する対象 |
|---|---|
| 確認1 | gate 1 Requirements、gate 2 Workflow Plan、gate 3 Code Generation Planのexact digest。gate 3はplanに固定されたcanonical提案版3ファイルのexact bytesのOwner確認を兼ね、Issue #40のStatus Approved条件に当たる。 |
| 確認2 | gate 4 Code Generation Result、gate 5 Build/Test Resultのexact digest。昇格・検証・独立reviewの結果と未確認範囲を確認する。 |

| Executor Plan | 担当と権限 |
|---|---|
| judgment_policy_ref | context rootの`docs/ai-governance/10_org/roles/governance/dispatch-lead/judgment-policy.md`、対象repoの`AGENTS.md`と`docs/operations/AI_DLC_WORKFLOW.md`。 |
| owner / approver | Itsuki Matsumoto。5 gateとも本人の`A`で記録する。 |
| executor | bounded Worker。今回の範囲は未承認3候補・canonical提案版3ファイル・audit/state・自己検証。昇格は承認後の後続委任。 |
| reviewer | executorから独立したread-only Reviewer。確認1前に提案版の内容を確認し、昇格後に承認済みbytesとの一致と記録を確認する計2回。手配はFront、Workerは再委任・自己承認しない。 |
| completion gate owner | VECTOR / Front Runtime。Owner対話、承認記録、review管理、全体受入を担う。 |
| commit_mode | confirm。canonical昇格は確認1の後。Workerはcommit・push・PRを行わない。close後のcommit・PR作成はFront。merge・本番反映はItsukiの明示承認。 |
| risk_class | yellow / Full・D1 intent-sensitive。採用済み方針と承認済みLive契約を保持する設計文書の変更。merge・production deploy・PR承認は別Owner gate。 |

## 工程と停止位置

1. 開始済みcycleのidentityを確認し、原依頼、repo規約、現行canonical、Figma snapshot、これに優先する`figma-snapshot/delta-02_front-fixes-FF40.md`、更新後の`front-figma-changes.md`とbaseのsourceを読む。Issue #37とFF40-01〜07を反映した現在のマスタを使う。
2. Requirements、Workflow Plan、Code Generation Planとcanonical提案版3ファイルを先行作成する。SHA-256・node-id・scopeを自己検証し、Requirements承認待ちで停止する。先行作成はgate通過を意味しない。
3. Frontが独立reviewを手配し、提案内容・既存契約の保持・マスタとの差・読者向け日本語を確認する。修理があれば候補を更新し、digestを取り直す。
4. Frontが確認1を提示する。3対象のstage・repository-relative/absolute path・fresh SHA-256、planと提案版の関係を含む同一の完全promptと、本人の完全raw responseを、各stageの承認recordへ保存する。Itsukiの単一ASCII `A`だけを承認にする。
5. 後続executorはgate 1〜3のrecordと3提案版のSHA-256を確認する。`docs/specs/current/`に提案版と同じbytesを置き、byte比較とSHA-256一致を確かめる。提案版は昇格後の最終形で、追加のDraft編集や承認情報の書換えを挟まない。承認までは現在の正本を保つ。
6. Code Generation ResultとBuild/Test Resultを作り、canonical map・node・受入条件・baseとの範囲・local integrityを検証する。Frontが独立reviewを手配し、承認対象と昇格後bytes、承認record、結果の整合を確認する。
7. Frontが確認2を提示し、gate 4・5を本人のexact digest承認で記録する。全承認・findings・state・Front受入を揃えて正式closeする。cycleのcloseは今回のWorkerの範囲外。
8. merge・production deploy・PR承認は別のItsuki明示承認とする。#41〜#47の実装・画面受入を#40の文書検証で済ませない。

承認済みartifactは進捗更新のために編集しない。進捗はstate/audit/resultへ記録する。提案版に1 byteでも修正が必要ならplanのSHA-256も更新し、影響する旧recordをSUPERSEDEDとして保持して新digestで確認し直す。正常時のOwner確認は2回。

## 5 gateの固定mapping

checkedは採用する工程とpathの最終形であり、実施済み・承認済みの印ではない。pathは`aidlc-docs/`からの相対指定。

- [x] REQUIRED|Requirements|inception/requirements/requirements.md|approvals/01-requirements-approval.md
- [x] REQUIRED|Workflow Plan|inception/plans/execution-plan.md|approvals/02-workflow-plan-approval.md
- [x] REQUIRED|Code Generation Plan|construction/plans/aidlc-integration-code-generation-plan.md|approvals/03-code-generation-plan-approval.md
- [x] REQUIRED|Code Generation Result|construction/aidlc-integration/code/code-generation-summary.md|approvals/04-code-generation-result-approval.md
- [x] REQUIRED|Build/Test Result|construction/build-and-test/build-and-test-summary.md|approvals/05-build-test-result-approval.md

各recordはexact stage、repository-relative/absolute path、fresh SHA-256、human approver Itsuki Matsumoto、prompt/response timestamps、完全prompt/raw response、explicit Decisionを持つ。確認1の`A`が列挙した全artifactのexact digestと提案版3ファイルを承認することを日本語で明示する。最終行は次の原文と完全一致させる。

`Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other.`

有効なのはraw responseが単一ASCII `A`でDecisionが`APPROVED`から始まる場合だけ。VECTOR、Worker、Reviewerの判断、沈黙、別stageの承認で代替しない。今回承認recordは作らない。

## 不要stageのtailoring

- [x] SKIP|Reverse Engineering|base sourceとcanonicalの差をauditと設計書に記録し、文書だけの変更でシステム全体の別冊再構成を要しないため。
- [x] SKIP|User Stories|読む人・実装者・管理者の目的と受入条件をRequirementsと提案版へ統合するため。
- [x] SKIP|Application Design|画面・要件・データの対応と判断を提案版の設計書に集約し、アプリ構造を変更しないため。
- [x] SKIP|Units Generation|3つの設計文書をaidlc-integrationの単位で一括昇格・受入するため。
- [x] SKIP|Functional Design|機能・state・失敗時の設計はcanonical提案版へ記録し、別冊で複製しないため。
- [x] SKIP|NFR Requirements|文書の追跡可能性・日本語・安全なscope・既存tokens保持をRequirementsへ定義し、実行性能を変更しないため。
- [x] SKIP|NFR Design|承認・byte一致・Gap・rollbackをplanに固定し、新しい非機能方式を設計しないため。
- [x] SKIP|Infrastructure Design|hosting・DB・API・認証・環境設定を変更しないため。
- [x] SKIP|Operations|文書の昇格だけを行い、merge・deploy・GitHub更新と後続運用は別authorityとするため。

## 停止と自己検証

必要なnode・文言が不足して文書を書けない場合、cycle/statusの手順外故障、許可外write・network・secretが必要な場合、採用済み方針にないOwner-only判断が必要な場合はBLOCKEDでFrontへ返す。Figma側の修正が要る差は止めず、今のマスタを記述してGapと修正要求を残す。

今回の自己検証は5 gateのexact mapping各1回、SKIP理由、未チェック行なし、承認recordなし、Requirements承認待ち、status成功、提案版とplanのSHA-256一致、node-id・名前と受入条件のsnapshot＋delta-02優先照合、git scopeを対象にする。独立review、Owner承認、canonical昇格、Front完了を自己検証で成立させない。
