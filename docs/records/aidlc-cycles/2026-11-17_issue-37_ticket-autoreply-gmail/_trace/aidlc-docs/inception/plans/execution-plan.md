# Workflow Plan — ticket予約の控えをメールで届ける（Issue #37）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-17_issue-37_ticket-autoreply-gmail`
- Base Commit: `218e2103ecaca0893cb63a9f4d7393b48e0c9f76`
- Branch: `feature/37-ticket-autoreply-gmail`
- Reader: human_reader / ja-JP / CotEditor（Frontが開く）

## 責任と2回の確認

予約後の送信先をApps Scriptへ差し替え、ticketページの2つの文言項目を外す。要件・工程・canonical逐語差分と送信契約を先に固定する。

| 確認 | Ownerがまとめて判断する対象 |
|---|---|
| 確認1 | gate 1 Requirements、gate 2 Workflow Plan、gate 3 Code Generation Plan。列挙した3 artifactのexact digestを承認し、gate 3内のcanonical逐語差分のOwner確認を兼ねる |
| 確認2 | gate 4 Code Generation Result、gate 5 Build/Test Result。実装・全検証・独立review・本番確認待ちを含む2 artifactのexact digestを承認する |

| Executor Plan | 担当と権限 |
|---|---|
| owner / approver | Itsuki Matsumoto。5 gateとも本人のA/B/Xで判断する |
| executor | bounded Worker。今回は未承認3候補とaudit/state、自己検証まで。実装は後続の明示委任後 |
| reviewer | executorから独立したread-only Reviewer。設計と実装をまとめて実装後1回確認する。手配はFront、Workerは再委任・自己承認しない |
| completion gate owner | VECTOR / Front Runtime。Owner対話、承認記録、review管理、全体受入を担う |
| commit_mode / risk_class | none / Lite・D1。commit・push・PRを行わない。merge・production deployは別のOwner承認 |

実装後1回の独立reviewで、送信の認証・宛先・失敗分離、公開／admin／正規化の一貫性、canonicalとの一致をまとめて見る。欠陥の修理と影響する再検証・再確認は省略しない。

## 工程と停止位置

1. branch・base・物理worktree・Issue写し・rules/canonical/code/testを確認し、local integrity PASS後にcycleをstartする。
2. 3成果物を未承認候補として揃え、Requirements gateの承認待ちで停止する。先行作成はgate通過を意味しない。
3. Frontが確認1を提示する。各gateのrecordへ、3対象のstage・repository-relative/absolute path・fresh SHA-256・gate 3によるcanonical確認の意味を含む同一の完全promptと、同じ本人の完全raw応答を保存する。
4. 後続Workerが承認済みCode Generation Planの逐語差分をcurrent spec・索引へDraftとして反映する。gate 3承認と一致を確認してApprovedに戻し、Worker README・wrangler例も揃える。dependent code/testはその後に着手する。
5. focused testを先に追加してREDを確認し、Apps Script・Worker・公開／adminの削除を実装してGREENにする。全回帰・syntax・integrity・scopeを確認し、gate 4・5の結果候補とcycle summaryを作る。
6. Frontが独立reviewを1回手配する。必要な修理と検証を結果へ反映し、bytesを固定する。
7. Frontが確認2を提示し、gate 4・5を各artifactのexact digestで記録する。実際の5承認・findings・state・Front受入を揃え、使い捨てvalidator copyによる事前確認後に正式closeする。
8. merge・deployは別Owner承認。Apps Script作成・公開、secret登録もOwnerが行い、本番到達AC-37-05を確認する。closeを本番到達の証明にしない。

承認済み3文書のbytesは進捗更新のために変更しない。進捗はstate/audit/resultへ残す。承認対象の変更が必要なら旧recordをSUPERSEDEDとして保持し、新digestで再承認する。正常時のOwner確認は上記2回にまとめ、追加のcanonical専用確認は挟まない。

## 5 gateの固定mapping

checkedは採用する工程とpathの最終形であり、承認済み・実施済みの印ではない。pathは`aidlc-docs/`からの相対指定。

- [x] REQUIRED|Requirements|inception/requirements/requirements.md|approvals/01-requirements-approval.md
- [x] REQUIRED|Workflow Plan|inception/plans/execution-plan.md|approvals/02-workflow-plan-approval.md
- [x] REQUIRED|Code Generation Plan|construction/plans/aidlc-integration-code-generation-plan.md|approvals/03-code-generation-plan-approval.md
- [x] REQUIRED|Code Generation Result|construction/aidlc-integration/code/code-generation-summary.md|approvals/04-code-generation-result-approval.md
- [x] REQUIRED|Build/Test Result|construction/build-and-test/build-and-test-summary.md|approvals/05-build-test-result-approval.md

各recordはexact stage、両path、fresh SHA-256、Itsuki Matsumoto、prompt/response timestamps、完全prompt/raw response、explicit Decisionを持つ。Aが「列挙した全artifactのexact digestを承認する」と日本語で明示する。別stageだけへの承認を流用しない。最終行は次の原文と完全一致させる。

`Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other.`

単一ASCII `A`と`APPROVED`で始まるDecisionだけが有効。B・X・沈黙・推測・Workerの自己検証では通過しない。今回承認recordは作らない。

## 不要stageのtailoring

- [x] SKIP|Reverse Engineering|対象codeと既存testの現行契約を直接読みauditへ残し、システム全体の別冊再構成を必要としないため。
- [x] SKIP|User Stories|申込者と管理者の目的・挙動・検証可能な受入条件をRequirementsへ統合するため。
- [x] SKIP|Application Design|WorkerからApps Scriptへの境界と公開・adminの項目削除をCode Generation Planへ固定し、別冊のcomponent設計を不要とするため。
- [x] SKIP|Units Generation|小規模な送信先差し替えと文言削除をaidlc-integrationの単位で一括受入するため。
- [x] SKIP|Functional Design|wire contract・doPost全文・画面と保存値の扱いをCode Generation Planに集約するため。
- [x] SKIP|NFR Requirements|日次枠・secret境界・非blocking・本番応答のGapをRequirementsに明示するため。
- [x] SKIP|NFR Design|認証・検証・エラー無害化・停止とrollbackをCode Generation Planに固定するため。
- [x] SKIP|Infrastructure Design|Apps Script公開とWorker secretのOwner手順をrepoへ残し、DB・hosting・DNSの設計変更を行わないため。
- [x] SKIP|Operations|公開・secret登録・merge・deployはOwner操作とし、本cycleには手順・rollback・本番到達確認を残すため。

## 停止と自己検証

mustと正本・workflowが矛盾する場合、許可外write・network・secret参照が必要な場合、start/statusの手順外故障、Ownerにしか決められない価値判断はBLOCKEDでFrontへ返す。open技術項目はWorkerの判断範囲とする。

今回の自己検証は、逐語差分の元行一致、5 gateのexact mapping各1回、SKIP理由、planに未チェック行なし、approval recordなし、stateのRequirements承認待ち、status成功、git scope、3 digestを確認する。実装・回帰test・独立review・Owner承認・Frontの全体完了とは分ける。
