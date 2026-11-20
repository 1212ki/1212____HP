# Workflow Plan — Live一覧からTicket完了までの予約の流れ（Issue #43）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-19_issue-43_live-ticket`
- Base Commit: `ba124011ce5e0ae56ddb1c6ac47d1783600687b4`
- Branch: `feature/43-live-ticket`
- Workspace Root: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-43-live-ticket`
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 1. 責任と2回の確認

Live一覧・Live詳細・終了したライブ（全件）・Ticket・Ticket完了の本文を作り直し、送信中・失敗をTicketのページ内、成功をTicket完了のページで示す。既存のcycleを使い、再startしない。候補が3つ揃ったことと、各stageの承認を区別する。

| 確認 | Ownerが判断する対象 |
|---|---|
| 確認1 | gate 1 Requirements、gate 2 Workflow Plan、gate 3 Code Generation Plan。3 artifactのfresh SHA-256を列挙する。gate 3は設計書3文書の提案版のexact bytes、Figma整合案F43-01〜11（Front判断ですべて推奨案を採る）、Q43-01（Front判断: Homeの次のライブの不正な予約先の文言をLive・Ticketと同じ「予約先を確認中」へ揃える。確認1で明示し、Aで採用、Bなら元に戻す）を含む。 |
| 確認2 | gate 4 Code Generation Result、gate 5 Build/Test Result。実装・試験・Frontのfixture撮影・本番の公開データでの画面確認・独立reviewと修理を示す2 artifactのfresh SHA-256。PC用の手元URLを必ず渡し、Itsukiの閲覧は任意。手元配信ではTicketの送信が本番に届くため、送信しない旨（`?dryRun=1`の使い方）を提示文に書く。まとめ出し前の本人の画面確認は別に必須。 |

| Executor Plan | 担当と権限 |
|---|---|
| owner / approver | Itsuki Matsumoto。5 gateとも本人のA/B/X。merge・本番反映・PR承認は別の明示承認。 |
| executor | bounded Worker。本Packetは3候補・設計書の提案版・Figma整合案・audit/state・自己検証まで。承認後の後続Workerは昇格・実装・試験と撮影script/fixtureを担当する。Workerは再委任しない。 |
| reviewer | executorと独立したread-onlyのReviewer。実装後に設計と実装をまとめて1回。受け渡しの安全、状態16個、旧入口、Home互換、まとめ出しも見る。Frontが手配する。 |
| completion gate owner | VECTOR / Front Runtime。確認の提示・本人との対話・承認記録・Figmaの整合・撮影・本番データでの画面確認・review管理・全体の受入を持つ。 |
| commit_mode | WorkerのGit writeなし。formal closeの後、別途許可されたFrontが`feature/43-live-ticket`をcommit/pushし、既存の`ai-feature-push`・`ai-pr-create`で`feature/39-public-pages`へPRを作る。まとめ用branchへのmerge・PR承認はItsuki。今回のWorkerはclose/commit/push/PRを実行しない。 |
| risk_class | Full / D1 intent-sensitive。候補は可逆。受付内容の受け渡しの安全（個人情報をURLに載せない）、旧入口の到達、状態16個、予約の保存とメールの分離、Homeの回帰、#45とのファイルの重なりが重点。 |

PR baseの`feature/39-public-pages`はItsuki決定（2026-11-18）。mainを既定とするrepoの規定への例外をRequirements§8とauditに残す。#44は先にmerge済み、#45は並行して同じbranchへ出る。Issue・Projectのcloseはまとめ出しがmainに入った時で、それまでReview。

## 2. 工程と停止位置

1. cycle identity、Issue写し、承認済み設計書、Figma snapshot、本番データの分類、対象のcodeと試験を読む。着手前の基準（サイト513 pass / 0 fail、Worker347 pass / 0 fail、`scripts/aidlc-verify.sh --local` PASS）はFrontの報告、`scripts/aidlc-cycle.sh status`はWorkerの実測として区別する。
2. Requirements、本計画、Code Generation Plan、設計書3文書の提案版、Figma整合案を作る。stateをRequirements承認待ちで止める。承認記録は作らない。
3. Frontが確認1を出す。3 artifactのstage・path・fresh digest、提案版のpathとhash、Figma整合案のdigestと採否（Front判断）、Q43-01（Homeの文言の統一とその根拠、Bで戻す形）、まとめ出しの扱いを完全なpromptに含める。マスタへの反映（F43-02〜09）はFrontが別に手配し、反映後にauditへ追補する。提示文に本番のタイトル・日付・会場・URL・画像を入れない。
4. Itsukiの完全なraw response `A`をFrontが各recordに保存する。B/Xやdigestの変更があれば候補を直して再承認する。承認済みの計画を進捗のために書き換えない。
5. 後続Workerが3承認、canonicalの元版hash、Figmaの整合を照合し、提案版を同じbytesで昇格する。元版hashが合わない時、Figmaに未解消の食い違いがある時、意味が変わる時は実装を止めてFrontへ返す。
6. Code Generation Planの9段で実装する。focused testはRED→GREEN。全試験は段5の後と段7の後の2回。撮影scriptとfixtureはWorker、撮影の実行・画像の目視・本番データでの画面確認はFront。
7. Frontが独立reviewを1回手配し、修理と必要な再検証を結果に反映する。本番データでの確認を確認2より後へ回さない。PC用の手元URLをItsukiへ渡し、確認2でgate 4・5の本人Aを得る。任意閲覧の未実施を実施扱いにしない。
8. 必須の証拠・5承認・state・findings・Frontの受入が揃ってから、Front側の許可範囲でformal close/archiveし、PRへ進む。#43のPRはまとめ用branch向け。Itsukiの明示merge後もIssue/ProjectはcloseせずReviewを保つ。本番の公開とPages確認はまとめ出しの担当へ渡す。

確認1のAはコードを作るための仕様承認であり、merge・外部write全般・本番反映の承認ではない。確認2の後の公開前の直しは、閉じたcycleを書き換えず新Issueで行う。

## 3. 5 gateの固定mapping

checkedは採用する工程とpathの固定で、実施済み・承認済みの印ではない。pathは`aidlc-docs/`からの相対指定。

- [x] REQUIRED|Requirements|inception/requirements/requirements.md|approvals/01-requirements-approval.md
- [x] REQUIRED|Workflow Plan|inception/plans/execution-plan.md|approvals/02-workflow-plan-approval.md
- [x] REQUIRED|Code Generation Plan|construction/plans/aidlc-integration-code-generation-plan.md|approvals/03-code-generation-plan-approval.md
- [x] REQUIRED|Code Generation Result|construction/aidlc-integration/code/code-generation-summary.md|approvals/04-code-generation-result-approval.md
- [x] REQUIRED|Build/Test Result|construction/build-and-test/build-and-test-summary.md|approvals/05-build-test-result-approval.md

各recordはexact stage、repository相対または絶対のartifact path、fresh SHA-256、人の承認者Itsuki Matsumoto、promptとresponseの時刻、完全なprompt・raw response、明示のDecisionを持つ。1つの本人Aで3つ（確認2は2つ）の列挙digestを承認する意味を日本語で明記し、各stageへ別recordとして結び付ける。validatorはraw responseが単一のASCII `A`で、Decisionが`APPROVED`から始まる場合だけ受け入れる。promptの最終行は次と完全一致させる。

`Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other.`

## 4. 不要stageのtailoring

- [x] SKIP|Reverse Engineering|対象5画面・関連script・既存試験・管理設定・Workerの受付応答の調査を、auditとCode Generation Planへ統合し、全systemの別冊再構成を不要とするため。
- [x] SKIP|User Stories|ライブを知った人が予約を終えるまでの目的を、Requirementsの安定IDと受入条件へ直接対応させるため。
- [x] SKIP|Application Design|静的HTMLと公開APIを維持し、共有の予約判定・並び・受付内容の受け渡しの責務をCode Generation Planに固定して、新しいサービス境界を足さないため。
- [x] SKIP|Units Generation|5画面と共有の処理をaidlc-integrationの1単位で一括して受け入れるため。
- [x] SKIP|Functional Design|状態16個・受け渡し・並び・予約の出し分けをRequirementsとCode Generation Plan、設計書の提案版へ集約するため。
- [x] SKIP|NFR Requirements|安全性（個人情報をURLに載せない）・互換性・accessibility・外観と実音の境界をRequirementsへ統合するため。
- [x] SKIP|NFR Design|CSSのscope・二重送信と古い応答の防止・player寸法・撮影の具体方式をCode Generation Planへ固定するため。
- [x] SKIP|Infrastructure Design|GitHub Pagesと既存の公開APIを維持し、DB・secret・Worker・hostingを変更しないため。
- [x] SKIP|Operations|まとめ用branchへの統合と2種類のrollbackをCode Generation Planへ記し、本番公開を別のOwner gateとするため。

## 5. 停止と自己検証

許可外のwrite・network・secret、データの形・保存・Cloudflare Workerの変更が必要になること、aidlc-cycleの手順外の故障は、BLOCKEDでFrontへ返す。局所的なOwner判断が残る場合は推奨案つきowner_questionsを返し、作れる候補は完成させる。独立review待ちだけでは候補作成を止めない。

自己検証は、5 mappingが各1回でpathが一致、SKIPの理由、未チェック行なし、承認記録なし、Requirements承認待ち、statusの成功、提案版のSHA-256とplanの記載の一致、git scope、本番の値が無いこと、を対象にする。Workerの結果、独立review、Ownerの承認、Front completionは別の信号として返す。
