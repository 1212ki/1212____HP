# Workflow Plan — Homeと共通の外枠（Issue #42）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-17_issue-42_home`
- Base Commit: `c26641815502d7d7fc64c0f00eed6cd0f35ced33`
- Branch: `feature/42-home`
- Workspace Root: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-42-home`
- Reader: human_reader / ja-JP / designated_text_editor（Frontが開く）

## 責任と2回の確認

Homeの新作型と全公開ページの外枠を、既存本文・保存・APIを保って実装する。準備済みcycleを使い、再startしない。FrontがFigmaへ反映したD1/D2とE1〜E14の版、および再生例外の問いを確認1で提示する。承認済みの構成・6項目ナビ・データkeyを再検討しない。

| 確認 | Ownerが判断する対象 |
|---|---|
| 確認1 | gate 1 Requirements、gate 2 Workflow Plan、gate 3 Code Generation Plan。3 artifactのfresh digestを列挙し、gate 3は提案版3文書のexact bytesとF42整合案のcanonical採用を含む。Q42-01は実機で1操作再生できなかった場合の確認2での停止条件を含む。 |
| 確認2 | gate 4 Code Generation Result、gate 5 Build/Test Result。実装・全試験・独立review・fixture画像と、本番公開データを読むbranchのPC/スマホ画面・実再生の証拠を示す2 artifactのexact digest。Itsukiは確認2前に保存した実際の1作品を同URLで確認する。 |

| Executor Plan | 担当と権限 |
|---|---|
| owner / approver | Itsuki Matsumoto。5 gateとも本人のA/B/Xで判断する。merge・本番反映・PR承認も本人の明示判断。 |
| executor | bounded Worker。今回は未承認3候補・設計提案版・audit/state・自己検証まで。後続の実装Workerが昇格、コード、試験、許可されたheadless撮影を担当する。 |
| reviewer | executorと独立したread-only Reviewer。実装後に設計と実装をまとめて1回。Frontが手配し、Workerは再委任しない。通常修理・再検証は省略しない。 |
| completion gate owner | VECTOR / Front Runtime。Owner対話・承認記録・Figma整合・review管理・提示・全体受入を担当。 |
| commit_mode | WorkerのGit writeはなし。formal closeのあとにFrontがbranch `feature/42-home`にcommit・pushし、`tools/_shared/ai-feature-push`・`tools/_shared/ai-pr-create`でPRを作る（#41と同じ形）。merge・PR承認・本番反映はItsuki。merge＝Pages本番公開で、本人の明示承認を別に要する。 |
| risk_class | Full / D1 intent-sensitive。候補は可逆。見せ方・再生の端末制限・全ページ外枠回帰と#42単独公開時の文言を重点確認。 |

参照するFigmaはFront反映後の`/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-223255_1212hp-42-home/figma-snapshot-v2/`。文言の書き出しは2026-11-17T23:16:01+09:00、`page-0-1_master-home.md`のSHA-256は`b08d37109e0f407cbf15c65442c027c677cfb7297dcd3e913d12f7b7a27483c8`、`SHA256SUMS`のSHA-256は`27defc5c6f6b7f1c2f6b5d6dd8cb29645050c038cf31b69020f87bec6071428f`。`diff-vs-v1.md`の結論は`unexpected: none`で、差はE1〜E14だけ。修正前の`figma-snapshot/`（v1）は比較用provenanceとしてauditに残す。`39:850`・`20:23`のspecとrenderはv1の写しで、新しいlayout/style観測とはしない。

## 工程と停止位置

1. 既存cycle identity、Issue写し、Approved設計、snapshot、対象code/testを読む。baseline試験とlocal verify PASSはFront報告、statusは今回Workerが再確認する。
2. 要件・本計画・Code Generation Planと設計書提案版を未承認で作る。stateはRequirements承認待ちで停止。先行して候補を揃えることをstage通過としない。
3. Frontが反映済みF42採否（F42-01はD1、02〜09はD2）とv2のprovenance・diffの`unexpected: none`を示し、確認1をItsukiへ提示する。対象3文書のstage・両path・fresh SHA-256、提案版のpath・hash、判断対象を完全promptへ含める。A以外なら必要な候補を修理して再提示する。
4. Frontが本人の完全raw response `A`を各gate recordへ結び付ける。後続Workerはcycle identity・3承認digest・Figma整合を確認し、提案版3文書を同じbytesのままcurrent canonicalへ昇格する。hash一致の後に実装する。
5. Code Generation Planの8段でHome・再生・全ページ外枠と試験を実装する。focused testはRED→GREEN。全試験はHomeの振る舞いが揃った区切りと外枠統合後の2回。許可されたlocalhost配信で主要状態を撮影する。
6. WorkerがCode Generation Result・Build/Test Result・cycle summaryを実施事実で作る。Frontが独立reviewを1回手配し、必要な修理と再検証を結果へ反映する。sandboxで撮れなければFrontが同じcapture手順を実行する。撮影未完を受入済みにしない。
7. 確認2の前にFrontがItsukiへ実際の1作品の種別・映像の保存とSiteの顔の選択・保存を頼む（保存済みなら入れ直さない）。Frontは公開projectionをread-only照合し、fixtureの撮影とは別に、本番公開データを読むbranchの手元配信をPCとスマホから開けるURLで用意する。確認2でItsukiが同じ作品の顔・種別・1操作の実音・閉じるをmerge前に確認する。Q42-01が未受入、または保存・実データ表示の確認が未完ならmergeへ進めない。確認結果を2 artifactへ反映してfresh digestに本人Aを記録する。5承認・findings・state・Front受入が揃ってからformal closeし、そのあとFrontが`feature/42-home`にcommit・pushしてPRを作る。
8. #42を単独で本番へ出す。Worker APIは不変でdeploy不要。merge・PR承認・本番反映はItsuki。merge後はFrontがPages build成功と公開Homeの新版配信・revision・確認2との一致をread-onlyで確認し、結果を追補する。保存済みの同じデータ・画面の2回目の本人確認は頼まない。Frontの確認で差が見つかった時だけItsukiへ返す。

承認対象のbytesは進捗のために更新しない。state/audit/resultに実施状況を残す。要件や計画の変更が必要なら旧recordをSUPERSEDEDとして新digestを承認する。確認1のAをmergeや外部writeの包括承認にしない。

## 5 gateの固定mapping

checkedは採用する工程とpathの固定で、承認済み・実施済みの印ではない。pathは`aidlc-docs/`からの相対指定。

- [x] REQUIRED|Requirements|inception/requirements/requirements.md|approvals/01-requirements-approval.md
- [x] REQUIRED|Workflow Plan|inception/plans/execution-plan.md|approvals/02-workflow-plan-approval.md
- [x] REQUIRED|Code Generation Plan|construction/plans/aidlc-integration-code-generation-plan.md|approvals/03-code-generation-plan-approval.md
- [x] REQUIRED|Code Generation Result|construction/aidlc-integration/code/code-generation-summary.md|approvals/04-code-generation-result-approval.md
- [x] REQUIRED|Build/Test Result|construction/build-and-test/build-and-test-summary.md|approvals/05-build-test-result-approval.md

各recordはexact stage、両path、fresh SHA-256、Itsuki Matsumoto、prompt/response timestamps、完全prompt/raw response、explicit Decisionを持つ。Aが列挙した全artifactのexact digestを承認する意味を日本語で示し、別stageへの承認を流用しない。promptの最終行は次の原文と完全一致させる。

`Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other.`

単一ASCII `A`と`APPROVED`で始まるDecisionだけが有効。今回のWorkerはapproval recordを作らない。

## 不要stageのtailoring

- [x] SKIP|Reverse Engineering|既存公開renderer・予約helper・9ページ・試験の調査をauditへ統合し、全systemの別冊再構成を不要とするため。
- [x] SKIP|User Stories|来訪者の聴く・予約する目的と管理者の1作品設定をRequirementsの受入へ統合するため。
- [x] SKIP|Application Design|既存の静的HTML・共有renderer・公開GETを維持し、Homeとplayerの責務をCode Generation Planに固定するため。
- [x] SKIP|Units Generation|Homeと共通外枠をaidlc-integrationの1単位で一括受入するため。
- [x] SKIP|Functional Design|表示条件・10状態・予約分岐・再生・途中の文言をRequirementsとCode Generation Planおよび設計書提案版へ集約するため。
- [x] SKIP|NFR Requirements|互換性・URL安全性・accessibility・端末制限・描画受入をRequirementsへ統合するため。
- [x] SKIP|NFR Design|CSSのscope・イベントとiframeの破棄・失敗とretry・撮影をCode Generation Planに固定するため。
- [x] SKIP|Infrastructure Design|GitHub Pagesと既存APIを使い、サービス・DB・secret・Worker変更を追加しないため。
- [x] SKIP|Operations|本番反映とrollbackはItsukiの別承認で行い、具体的手順をCode Generation Planへ残すため。

## 停止と自己検証

許可外write・network・secret、手順外cycle故障、データshape・保存・Cloudflare変更の必要が出たらFrontへBLOCKEDで返す。局所的なOwner判断は推奨計画とowner_questionsへ残し、候補作成は完了する。独立review待ちは候補のblockerにしない。

自己検証は5 gate各1回・path一致、SKIP理由、未チェック行なし、承認記録なし、Requirements承認待ち、status成功、提案版hashと計画の一致、git scope、本番本文非混入を確認する。候補のready、実装、実音、独立review、Owner承認、Front completionを別信号として扱う。
