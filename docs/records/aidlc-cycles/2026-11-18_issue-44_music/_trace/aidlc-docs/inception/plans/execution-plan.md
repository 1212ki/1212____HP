# Workflow Plan — Musicと5項目ナビ（Issue #44）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-18_issue-44_music`
- Base Commit: `080325887576655f27461cb15f28a3c590a292ee`
- Branch: `feature/44-music`
- Workspace Root: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-44-music`
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 1. 責任と2回の確認

音源と映像をMusicにまとめ、全公開ページのナビと旧URL・Home入口を揃える。既存cycleを使い、再startしない。候補が3つ揃ったこととstageの承認を区別する。

| 確認 | Ownerが判断する対象 |
|---|---|
| 確認1 | gate 1 Requirements、gate 2 Workflow Plan、gate 3 Code Generation Plan。3 artifactのfresh SHA-256を列挙する。gate 3は設計提案版3文書のexact bytesとF44-01〜06の整合案の採否を含む。 |
| 確認2 | gate 4 Code Generation Result、gate 5 Build/Test Result。実装・試験・Frontのfixture撮影・本番公開データでの画面確認・独立reviewと修理を示す2 artifactのfresh SHA-256。PC/スマホの手元URLを必ず渡し、Itsukiの閲覧は任意。まとめ出し前の本人画面確認は別に必須。 |

| Executor Plan | 担当と権限 |
|---|---|
| owner / approver | Itsuki Matsumoto。5 gateとも本人のA/B/X。merge・本番反映・PR承認は別の明示承認。 |
| executor | bounded Worker。本Packetは3候補・設計提案版・Figma整合案・audit/state・自己検証まで。承認後の後続Workerは昇格・実装・試験と撮影script/fixtureを担当。Workerは再委任しない。 |
| reviewer | executorと独立したread-only Reviewer。実装後に設計と実装をまとめて1回。管理説明、旧URL両経路、6状態、Home互換、まとめ出しも見る。Frontが手配する。通常修理・再検証は同じ実装範囲で行う。 |
| completion gate owner | VECTOR / Front Runtime。確認提示・本人対話・承認記録・Figma整合・撮影・本番データ画面確認・review管理・全体受入を持つ。 |
| commit_mode | WorkerのGit writeなし。formal close後、別途許可されたFrontがfeature/44-musicをcommit/pushし、既存のai-feature-push / ai-pr-createでfeature/39-public-pagesへPRを作る。まとめ用branchへのmerge・PR承認はItsuki。今回のWorkerはclose/commit/push/PRを実行しない。 |
| risk_class | Full / D1 intent-sensitive。候補は可逆。全ページナビ、旧URL到達、再生共有のHome回帰、公開Musicと管理タブの食い違い、canonicalの並行変更が重点。 |

PR baseの`feature/39-public-pages`はItsuki決定（2026-11-18）。mainを既定とするrepo規定への例外をRequirements§6・auditに残す。#43/#45と最後にmainへ入る。Issue・Projectのcloseはまとめ出しがmainへ入った時、それまではReview。

## 2. 工程と停止位置

1. cycle identity、Issue写し、Approved設計、Figma snapshot、本番分類、code/testを読む。baseline 377/347件とlocal verify PASSはFrontの報告、statusはWorkerの実測として区別する。
2. Requirements、本計画、Code Generation Plan、設計提案版とFigma整合案を作る。stateをRequirements承認待ちで停止する。approval recordは作らない。
3. Frontが確認1を提示し、3 artifactのstage・両path・fresh digest、提案版path/hash、F44案、まとめ出しを完全promptへ含める。提示文に本番のタイトル・日付・URL・映像idを入れない。
4. Itsukiの完全raw response `A`をFrontが各recordに保存する。B/X・digest変更なら候補を修理し再承認。承認済みplanを進捗記録のために書き換えない。
5. 後続Workerが3承認・canonical元版hash・Figma整合を照合し、提案版を同じbytesで昇格する。F44整合に未解消の食い違いがある時やsourceの意味が変わった時は実装を止める。
6. Code Generation Planの8段で実装する。focused testはRED→GREEN。全試験はMusic挙動が揃った段4後と外枠統合の段6後の2回。撮影script/fixtureはWorker、実行・画像目視・本番データ確認はFront。
7. Frontが独立reviewを1回手配し、修理と必要な再検証を結果へ反映する。本番公開データの確認を確認2より後へ回さない。保存済みの作品設定を再入力させない。ItsukiへPC/スマホURLを渡し、確認2でgate 4・5の本人Aを得る。任意閲覧の未実施を実施扱いしない。
8. 必須証拠・5承認・state・findings・Front受入が揃ってからFront側の許可範囲でformal close/archiveし、PRへ進む。#44はまとめ用branchへのPR。Itsukiの明示merge後もIssue/ProjectはcloseせずReviewを保ち、#43/#45へ衝突範囲を渡す。本番公開・Pages確認はまとめ出しの担当へ渡す。

確認1のAはコードを作るための仕様承認であり、mergeや外部write全般の承認ではない。確認2後の公開前修理は閉じたcycleを書き換えず新Issueで行う。

## 3. 5 gateの固定mapping

checkedは採用する工程とpathの固定で、実施済み・承認済みの印ではない。pathは`aidlc-docs/`からの相対指定。

- [x] REQUIRED|Requirements|inception/requirements/requirements.md|approvals/01-requirements-approval.md
- [x] REQUIRED|Workflow Plan|inception/plans/execution-plan.md|approvals/02-workflow-plan-approval.md
- [x] REQUIRED|Code Generation Plan|construction/plans/aidlc-integration-code-generation-plan.md|approvals/03-code-generation-plan-approval.md
- [x] REQUIRED|Code Generation Result|construction/aidlc-integration/code/code-generation-summary.md|approvals/04-code-generation-result-approval.md
- [x] REQUIRED|Build/Test Result|construction/build-and-test/build-and-test-summary.md|approvals/05-build-test-result-approval.md

各recordはexact stage、repository-relative/absolute artifact path、fresh SHA-256、human approver Itsuki Matsumoto、prompt/response timestamps、完全prompt/raw response、explicit Decisionを持つ。1つの本人Aで3つ（確認2は2つ）の列挙digestを承認する意味を日本語で明記し、各stageへ別recordとして結び付ける。validatorはraw responseが単一ASCII `A`、Decisionが`APPROVED`から始まる場合だけ受け入れる。prompt最終行は次と完全一致させる。

`Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other.`

## 4. 不要stageのtailoring

- [x] SKIP|Reverse Engineering|対象10HTML・renderer・helper・管理説明・既存試験の調査をauditとCode Generation Planへ統合し、全systemの別冊再構成を不要とするため。
- [x] SKIP|User Stories|来訪者が音源と映像を選ぶ目的をRequirementsの安定IDと受入条件へ直接対応させるため。
- [x] SKIP|Application Design|静的HTML・公開GET・共有rendererとplayerの責務をCode Generation Planに固定し、新しいサービス境界を追加しないため。
- [x] SKIP|Units Generation|Musicと共通ナビをaidlc-integrationの1単位で一括受入するため。
- [x] SKIP|Functional Design|作品・映像・旧URL・6状態と読込をRequirementsとCode Generation Plan、設計提案版へ集約するため。
- [x] SKIP|NFR Requirements|互換性・accessibility・URL安全性・外観と実音の境界をRequirementsへ統合するため。
- [x] SKIP|NFR Design|CSS scope・iframe破棄・race防止・撮影の具体方式をCode Generation Planへ固定するため。
- [x] SKIP|Infrastructure Design|GitHub Pagesと既存APIを維持し、DB・secret・Worker・hostingを変更しないため。
- [x] SKIP|Operations|まとめ用branchへの統合と2種類のrollbackをCode Generation Planへ記し、本番公開を別Owner gateとするため。

## 5. 停止と自己検証

許可外write/network/secret、データshape・保存・Cloudflare Worker変更の必要、aidlc-cycleの手順外故障はBLOCKED。局所的なOwner判断が残る場合は推奨案付きowner_questionsをFrontへ返し、作れる候補は完成させる。独立review待ちだけでは候補作成を止めない。

自己検証は5 mapping各1回・path一致、SKIP理由、未チェック行なし、承認記録なし、Requirements承認待ち、status成功、提案版SHA-256、git scope、本番値非混入を対象にする。Worker result、独立review、Owner承認、Front completionを別信号で返す。
