# Workflow Plan — ProfileとContactの新しい見た目（Issue #45）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-19_issue-45_profile-contact`
- Base Commit: `ba124011ce5e0ae56ddb1c6ac47d1783600687b4`
- Branch: `feature/45-profile-contact`
- Workspace Root: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-45-profile-contact`
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 1. 責任と2回の確認

ProfileとContactの本文を新しい見た目に揃え、Contactの送信状態をページ内に示す。既存cycleを使い、再startしない。候補が3つ揃ったこととstageの承認を区別する。

| 確認 | Ownerが判断する対象 |
|---|---|
| 確認1 | gate 1 Requirements、gate 2 Workflow Plan、gate 3 Code Generation Plan。3 artifactのfresh SHA-256を列挙する。gate 3は設計提案版2文書（`public-site-ui.md`・`README.md`）のexact bytesと、Figma整合案F45-01〜11の採否（F45-10・F45-11は採らず、赤は「送信する」と見出しの線だけ、間隔はマスタの値のまま。Owner価値判断の問いは残らない）を含む。 |
| 確認2 | gate 4 Code Generation Result、gate 5 Build/Test Result。実装・試験・Frontのfixture撮影・本番公開データでの画面確認・独立reviewと修理を示す2 artifactのfresh SHA-256。PC・スマホの手元URLを必ず渡し、Itsukiの閲覧は任意。まとめ出し前の本人の画面確認は別に必須。 |

| Executor Plan | 担当と権限 |
|---|---|
| owner / approver | Itsuki Matsumoto。5 gateとも本人のA/B/X。merge・本番反映・PR承認は別の明示承認。 |
| executor | bounded Worker。本Packetは3候補・設計提案版・Figma整合案・audit/state・自己検証まで。承認後の後続Workerは昇格・実装・試験と撮影script/fixtureを担当。Workerは再委任しない。 |
| reviewer | executorと独立したread-onlyのReviewer。実装後に設計と実装をまとめて1回。Profileのlinks、文章と写真、Contactの送信状態6個と読み込み中、送信の仕組みが不変であること、Home・Musicなど他ページの互換、まとめ出しの記述も見る。Frontが手配する。通常の修理・再検証は同じ実装範囲で行う。 |
| completion gate owner | VECTOR / Front Runtime。確認提示・本人対話・承認記録・Figma整合・撮影・本番データの画面確認・review管理・全体受入を持つ。 |
| commit_mode | WorkerのGit writeなし。formal close後、別途許可されたFrontが`feature/45-profile-contact`をcommit/pushし、既存のai-feature-push / ai-pr-createで`feature/39-public-pages`へPRを作る。まとめ用branchへのmerge・PR承認はItsuki。今回のWorkerはclose/commit/push/PRを実行しない。 |
| risk_class | Full / D1 intent-sensitive。候補は可逆。Contactの送信の仕組みを変えないこと、失敗でも入力が消えないこと、Profileのlinksが減らないこと、#43との重なり面、赤の範囲が重点。 |

PR baseの`feature/39-public-pages`はItsuki決定（2026-11-18）。mainを既定とするrepo規定への例外をRequirements§6・auditに残す。#43と最後にmainへ入る。Issue・Projectのcloseはまとめ出しがmainへ入った時、それまではReview。

## 2. 工程と停止位置

1. cycle identity、Issue写し、Approved設計、Figma snapshot、本番データの分類、code/testを読む。baselineのnode 513 pass / 0 fail、Worker 347 pass / 0 fail、local verify PASS、Issue #45のProject StatusのIn ProgressはFrontの報告、`scripts/aidlc-cycle.sh status`はWorkerの実測として区別する。
2. Requirements、本計画、Code Generation Plan、設計提案版2文書とFigma整合案を作る。stateをRequirements承認待ちで停止する。approval recordは作らない。
3. Frontが確認1を提示し、3 artifactのstage・両path・fresh digest、提案版2文書のpath・hash、F45案、まとめ出しの扱いを完全promptへ含める。提示文に本番の文章・URL・送信先を入れない。
4. Itsukiの完全なraw response `A`をFrontが各recordに保存する。B/X・digest変更なら候補を修理し再承認する。承認済みplanを進捗記録のために書き換えない。
5. 後続Workerが3承認・canonical元版hash・Figma整合を照合し、提案版を同じbytesで昇格する。元版hashが一致しない時（#43が先に昇格した場合など）、F45に未解消の食い違いがある時、sourceの意味が変わった時は、実装を止めてFrontへ返す。
6. Code Generation Planの8段で実装する。focused testはRED→GREEN。全試験は挙動が揃う段4の後と外枠・CSSまで揃う段7の後の2回。撮影script/fixtureはWorker、実行・画像の目視・本番データの確認はFront。
7. Frontが独立reviewを1回手配し、修理と必要な再検証を結果へ反映する。本番公開データの画面確認を確認2より後へ回さない。ItsukiへPC・スマホのURLを渡し、確認2でgate 4・5の本人Aを得る。任意閲覧の未実施を実施扱いしない。Contactの本番の送信は試さない。
8. 必須の証拠・5承認・state・findings・Front受入が揃ってからFront側の許可範囲でformal close/archiveし、PRへ進む。closeが作る一時path（`docs/records/aidlc-cycles/.aidlc-stage-*`、リポジトリ直下の`.aidlc-idle-*`と`.aidlc-recovery-*`、`aidlc-docs/.audit-resume.*`、`/private/tmp/aidlc-archive-verify.*`・`/private/tmp/aidlc-source-verify.*`、保存先の`docs/records/aidlc-cycles/2026-11-19_issue-45_profile-contact/`）は、closeのPacketの許可pathに入れる。#45はまとめ用branchへのPR。Itsukiの明示merge後もIssue/ProjectはcloseせずReviewを保ち、#43へ衝突範囲を渡す。本番公開・Pages確認、本番のContact送信を試すかの判断はまとめ出しの担当へ渡す。

確認1のAはコードを作るための仕様承認であり、mergeや外部write全般の承認ではない。確認2後の公開前の修理は閉じたcycleを書き換えず新Issueで行う。

## 3. 5 gateの固定mapping

checkedは採用する工程とpathの固定で、実施済み・承認済みの印ではない。pathは`aidlc-docs/`からの相対指定。

- [x] REQUIRED|Requirements|inception/requirements/requirements.md|approvals/01-requirements-approval.md
- [x] REQUIRED|Workflow Plan|inception/plans/execution-plan.md|approvals/02-workflow-plan-approval.md
- [x] REQUIRED|Code Generation Plan|construction/plans/aidlc-integration-code-generation-plan.md|approvals/03-code-generation-plan-approval.md
- [x] REQUIRED|Code Generation Result|construction/aidlc-integration/code/code-generation-summary.md|approvals/04-code-generation-result-approval.md
- [x] REQUIRED|Build/Test Result|construction/build-and-test/build-and-test-summary.md|approvals/05-build-test-result-approval.md

各recordはexact stage、repository-relativeまたは絶対のartifact path、fresh SHA-256、human approver Itsuki Matsumoto、prompt/responseのtimestamp、完全なprompt/raw response、explicit Decisionを持つ。1つの本人Aで3つ（確認2は2つ）の列挙digestを承認する意味を日本語で明記し、各stageへ別recordとして結び付ける。validatorはraw responseが単一のASCII `A`、Decisionが`APPROVED`から始まる場合だけ受け入れる。promptの最終行は次と完全一致させる。

`Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other.`

## 4. 不要stageのtailoring

- [x] SKIP|Reverse Engineering|対象2HTML・renderer・contact.js・CSS・管理の項目・既存試験の調査をauditとCode Generation Planへ統合し、全systemの別冊再構成を不要とするため。
- [x] SKIP|User Stories|来訪者がプロフィールを確かめて連絡する目的をRequirementsの安定IDと受入条件へ直接対応させるため。
- [x] SKIP|Application Design|静的HTML・公開GET・既存のFormspree送信を保ち、新しいサービス境界を追加しないため。
- [x] SKIP|Units Generation|ProfileとContactをaidlc-integrationの1単位で一括受入するため。
- [x] SKIP|Functional Design|状態6個・読み込み中・linksの扱いをRequirementsとCode Generation Plan、設計提案版へ集約するため。
- [x] SKIP|NFR Requirements|互換性・accessibility・二重送信・外観の境界をRequirementsへ統合するため。
- [x] SKIP|NFR Design|CSS scope・focus・送信の排他・撮影の具体方式をCode Generation Planへ固定するため。
- [x] SKIP|Infrastructure Design|GitHub Pagesと既存API・Formspreeを維持し、DB・secret・Worker・hostingを変更しないため。
- [x] SKIP|Operations|まとめ用branchへの統合と2種類のrollbackをCode Generation Planへ記し、本番公開を別のOwner gateとするため。

## 5. 停止と自己検証

許可外のwrite/network/secret、データの形・保存・送信の仕組み・Cloudflare Workerの変更の必要、aidlc-cycleの手順外の故障はBLOCKED。局所的なOwner判断が残る場合は、推奨案つきのowner_questionsをFrontへ返し、作れる候補は完成させる。独立review待ちだけでは候補作成を止めない。

自己検証は、5 mappingが各1回でpathが一致すること、SKIPの理由、未チェック行がないこと、承認記録がないこと、Requirements承認待ち、`scripts/aidlc-cycle.sh status`の成功、提案版のSHA-256と計画の記載の一致、`git status`でaidlc-docs以外が無変更、aidlc-docsに本番の値がないことを対象にする。Worker result、独立review、Owner承認、Front completionを別の信号で返す。
