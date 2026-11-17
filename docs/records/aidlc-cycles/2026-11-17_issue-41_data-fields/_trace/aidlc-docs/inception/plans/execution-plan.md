# Workflow Plan — 作品の選択・再生映像・種別の登録（Issue #41）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-17_issue-41_data-fields`
- Base Commit: `060858b754e0d0c8a70bb98536e35c72523a4a48`
- Branch: `feature/41-data-fields`
- Workspace Root: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-41-data-fields`
- Reader: human_reader / ja-JP / designated_text_editor（Frontが開く）

## 責任と2回の確認

3項目の保存・今の編集面への追加・日付検査・削除時の参照解除・共有画像の表示名を固定し、公開UIを変えずに後続Issueへ渡す。準備済みのcycleを再作成せず使用する。

| 確認 | Ownerが判断する対象 |
|---|---|
| 確認1 | gate 1 Requirements、gate 2 Workflow Plan、gate 3 Code Generation Plan。3 artifactのexact digestを列挙し、gate 3は提案版3文書のexact bytesのcanonical採用を含む。 |
| 確認2 | gate 4 Code Generation Result、gate 5 Build/Test Result。実装・全試験・独立review・本番未確認を含む2 artifactのexact digest。 |

| Executor Plan | 担当と権限 |
|---|---|
| owner / approver | Itsuki Matsumoto。5 gateとも本人のA/B/Xで判断する。 |
| executor | bounded Worker。今回は未承認3候補・提案版・audit/state・自己検証まで。コード・試験・current canonicalは後続の委任で実施。 |
| reviewer | executorと独立したread-only Reviewer。実装後に設計・実装をまとめて1回確認。Frontが手配し、Workerは再委任・自己承認しない。通常修理と必要な再検証は省略しない。 |
| completion gate owner | VECTOR / Front Runtime。Owner対話・承認記録・review管理・全体受入を担う。 |
| commit_mode | formal close後にFrontが`feature/41-data-fields`へcommit・pushし、PRを作成する。Workerは今回も後続実装もGitのwriteを行わない。merge・production deploy・PR承認はItsukiが行う。 |
| risk_class | Full / D1 intent-sensitive。候補は可逆、保存互換性と本番反映順序を要確認。merge・deploy・PR承認は別のOwner gate。 |

## 工程と停止位置

1. Issue写し・worktree identity・原典・code/test・snapshot digestを確認する。Frontのcycle startとlocal verify PASSを受け取り、statusを再確認する。
2. Requirements・Workflow Plan・Code Generation Planとcanonical提案版を未承認で揃える。stateはRequirements承認待ちで停止。候補の先行作成はgate通過ではない。
3. Frontが確認1を提示する。対象3文書のstage・両path・fresh SHA-256を含む完全promptと本人の完全raw responseを各gate recordへ保存する。gate 3に提案版のpath・hashとcanonical確認を兼ねる意味を明示する。
4. 後続Workerは3承認のexact digestとcycle identityを確認する。提案版3文書を、文字・Status・日付・改行を一切変えず対応canonicalへ置き、SHA-256とbyte一致を確かめてからコード・試験に着手する。
5. Code Generation Planの8段でfocused testのRED→GREEN、両mode・API・既存公開表示・OG回帰を実装する。全試験はbackend区切りと統合後の区切りで実施する。
6. Code Generation Result・Build/Test Result・cycle summaryを作る。Frontが独立reviewを1回手配し、必要な修理と影響範囲の再検証を反映して結果のbytesを固定する。
7. Frontが確認2を提示し、gate 4・5のexact digestへ本人のAを記録する。5承認・state・findings・Front受入を揃え、別の許可範囲でclose準備検証とformal closeを行う。本Packetはcloseしない。
8. formal close後にFrontが`feature/41-data-fields`へcommit・pushしPRを作る。GitHub Pagesは`main`の`/`から公開サイトとadminを配信するため、ItsukiはPR最終版のtested revisionからWorkerを先にdeployし、その後にmergeする。mergeが新adminとhelperの静的公開を起動し、別の静的反映操作は行わない。FrontがWorkerの公開APIとPages build・配信revisionをread-onlyで確認する。Itsukiは管理タブを再読込し、1作品に3項目を入れて保存して、Frontが照合する公開データと公開画面を確認する。mergeを見送る場合はItsukiがWorkerを直前のdeploymentへ戻す。詳細とmerge後のrollbackはCode Generation Plan §8・§9による。cycle closeを本番成功としない。

承認済み候補は進捗更新で書き換えず、進捗をstate/audit/resultへ残す。承認対象の修正は旧recordをSUPERSEDEDにし、新digestで再承認する。正常時の確認は上の2回にまとめる。

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

- [x] SKIP|Reverse Engineering|対象code・既存test・本番shapeの調査をauditへ統合し、全システムの別冊再構成を不要とするため。
- [x] SKIP|User Stories|1名の管理者と公開consumerの目的・受入条件をRequirementsへ統合するため。
- [x] SKIP|Application Design|既存admin・site_data JSON・公開APIの境界を維持し、3項目のflowと共通処理をCode Generation Planに集約するため。
- [x] SKIP|Units Generation|adminとWorkerをaidlc-integrationの1単位で一括受入し、別unitの依存を増やさないため。
- [x] SKIP|Functional Design|key・空・参照・検査・削除・最新候補の契約をCode Generation Planと昇格する提案版に固定するため。
- [x] SKIP|NFR Requirements|既存データ互換・read-only・機密projection・入力保持をRequirementsへ統合するため。
- [x] SKIP|NFR Design|新旧payload互換・失敗時の保持・rollbackをCode Generation Planに固定するため。
- [x] SKIP|Infrastructure Design|既存D1 JSONと既存hostingを使い、DB migration・新サービス・新secretを追加しないため。
- [x] SKIP|Operations|本番反映はItsukiの別操作とし、反映順序・確認・rollbackの手順をCode Generation Planに残すため。

## 停止と自己検証

許可外write・network・secret参照、手順外cycle故障、既存基準で決まらないOwner-only判断はFrontへ返す。一部の価値判断だけが未決なら推奨計画とowner_questionsを残し、独立review待ちだけでBLOCKEDにしない。

今回の自己検証は5 gate各1回・mapping一致、SKIP理由、未チェック行なし、承認記録なし、stateのRequirements承認待ち、status成功、提案版と本計画のSHA-256一致、git scope、本番データ本文非混入。実装・試験・独立review・Owner承認・Front completionとは分離する。
