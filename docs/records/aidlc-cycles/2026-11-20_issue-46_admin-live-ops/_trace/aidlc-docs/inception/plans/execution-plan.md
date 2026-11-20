# Workflow Plan — 管理画面のよくする3つ（Issue #46）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-20_issue-46_admin-live-ops`
- Base Commit: `e191e53ada480014e03ad2fa23835f6178ce371a`
- Branch: `feature/46-admin-live-ops`
- Workspace Root: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-46-admin-live-ops`
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 1. 責任と2回の確認

管理画面のLive（一覧・開いた画面の公開内容／告知／予約・予約管理・Ticket Page共通設定）をスマホ中心に作り直し、Cloudflare Workerに予約の集計を返す処理を1つ足す。既存cycleを使い、再startしない。候補が3つ揃ったこととstageの承認を区別する。Itsukiが毎日使う本番の道具が、mergeで入れ替わる。保存・削除・予約の状態変更を壊さないことを最優先にし、今の動きを固定する試験を実装より先に置く。

| 確認 | Ownerが判断する対象 |
|---|---|
| 確認1 | gate 1 Requirements、gate 2 Workflow Plan、gate 3 Code Generation Plan。3 artifactのfresh SHA-256を列挙する。gate 3は、設計提案版2文書（`live-operations-admin-ui.md`・`README.md`）のexact bytesと、Figma整合案`figma-fix-requests.md`（F46-01〜24）の採否、**VF3（一覧に予約の枚数と未対応の件数を出すか。推奨は「出す」。外す場合はBで返す）の確定**を含む。 |
| 確認2 | gate 4 Code Generation Result、gate 5 Build/Test Result。実装・試験・Frontの撮影・独立reviewと修理を示す2 artifactのfresh SHA-256。**Itsukiが自分で触る確認（Code Generation Plan §7）の入口を渡す**。merge・Worker deploy・PRの承認は別の明示承認。 |

| Executor Plan | 担当と権限 |
|---|---|
| owner / approver | Itsuki Matsumoto。5 gateとも本人のA/B/X。merge・Worker deploy・PR承認は別の明示承認。 |
| executor | bounded Worker。本Packetは3候補・設計提案版・Figma整合案・audit/state・自己検証まで。承認後の後続Workerは昇格・実装・試験と撮影script・架空API・fixtureを担当（再委任しない）。 |
| reviewer | executorと独立したread-onlyのReviewer。実装後に設計と実装をまとめて1回。保存・削除・予約の状態変更・取り置き・集計・新旧の組み合わせ・#47のタブと公開側が変わらないこと・Figma整合・本番データの形を見る。Frontが手配する。通常の修理・再検証は同じ実装範囲で行う。 |
| completion gate owner | VECTOR / Front Runtime。確認提示・本人対話・承認記録・Figma整合・撮影・Worker deployの手順・review管理・全体受入を持つ。 |
| commit_mode | WorkerのGit writeなし。formal close後、別途許可されたFrontが`feature/46-admin-live-ops`をcommit/pushし、既存のai-feature-push / ai-pr-createで`main`へPRを作る（#46単独。公開側のまとめ出しに混ぜない。Itsukiの決定 2026-11-18）。 |
| risk_class | Full / D1 intent-sensitive。保存・削除・予約の状態変更、全体上書きの保存での他タブの巻き込み、新旧の組み合わせ、本番データの形、Worker deployの順序が重点。 |

PR baseは`main`（repo規定どおり。#45のようなまとめ用branchは使わない）。merge＝本番（GitHub Pagesがmainから配信）なので、Worker deployはmergeより先。Issue・Projectのcloseはmerge後。

## 2. 工程と停止位置

1. cycle identity、Issue写し、Approved設計、Figma snapshot、本番データの分類、codeと試験を読む。着手前の基準（`node --test test/` pass 776 / fail 0、`npm --prefix cloudflare/worker test` pass 347 / fail 0、`scripts/aidlc-verify.sh --local` PASS、Issue #46のProject StatusのIn Progress）はFrontの報告、`scripts/aidlc-cycle.sh status`はWorkerの実測として区別する。
2. Requirements、本計画、Code Generation Plan、設計提案版2文書、Figma整合案を作る。stateをRequirements承認待ちで停止する。approval recordは作らない。
3. Frontが確認1を提示し、3 artifactのstage・両path・fresh digest、提案版2文書のpath・hash、Figma整合案のhash、VF3の確定を完全promptへ含める。提示文に本番の値（ライブ名・会場名・URL・文章・予約者）を入れない。
4. Itsukiの完全なraw response `A`をFrontが各recordに保存する。B/X・digest変更なら候補を修理し再承認する（外す場合のVF3は§10の切り方）。承認済みplanを進捗記録のために書き換えない。
5. 後続Workerが3承認・canonical元版hash・Figma整合を照合し、提案版を同じbytesで昇格する。元版hashが一致しない時、Figma整合案に未解消の食い違いがある時、sourceの意味が変わった時は、実装を止めてFrontへ返す。
6. Code Generation Planの8段で実装する。段1は今の動きを固定する試験（GREENで固定。不要なREDは作らない）。以降のfocused testはRED→GREEN。全試験は挙動が揃う区切り（段3の後・段6の後・段8）だけ。撮影script・架空API・fixtureはWorker、実行・画像の目視はFront。
7. Frontが独立reviewを1回手配し、修理と必要な再検証を結果へ反映する。確認2の前に、Frontが撮影・目視・Worker deploy前の確認を済ませる。ItsukiへItsukiが触る確認の入口を渡し、gate 4・5の本人Aを得る。任意の触る確認の未実施を実施扱いにしない。
8. Itsukiの明示承認のもと、Frontが「Worker deploy → 本番の古い管理画面が今のまま動くことの確認 → merge → 本番の確認」の順に進める（Code Generation Plan §8）。各段のrollbackは§9。
9. 必須の証拠・5承認・state・findings・Front受入が揃ってから、Front側の許可範囲でformal close/archiveし、PRへ進む。closeが作る一時path（`docs/records/aidlc-cycles/.aidlc-stage-*`、リポジトリ直下の`.aidlc-idle-*`と`.aidlc-recovery-*`、`aidlc-docs/.audit-resume.*`、`/private/tmp/aidlc-archive-verify.*`・`/private/tmp/aidlc-source-verify.*`、保存先の`docs/records/aidlc-cycles/2026-11-20_issue-46_admin-live-ops/`）は、closeのPacketの許可pathに入れる。Build/Test Resultとcycle-summaryの`Blocking Findings`は`- **Blocking Findings**: None`のfield形式で書く。

確認1のAはコードを作るための仕様承認であり、merge・Worker deploy・外部write全般の承認ではない。確認2後の公開前の修理は閉じたcycleを書き換えず新Issueで行う。

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

- [x] SKIP|Reverse Engineering|対象の管理画面（`admin/index.html`・`app.js`・`style.css`）、Worker、共有`live-operations.js`、既存試験の調査をauditとCode Generation Planへ統合し、全systemの別冊再構成を不要とするため。
- [x] SKIP|User Stories|Itsukiがスマホでライブの登録・告知・予約の管理を終える目的を、Requirementsの安定IDと受入条件へ直接対応させるため。
- [x] SKIP|Application Design|既存の管理画面とWorkerに画面・APIの経路を1つ足すだけで、新しいサービス境界を作らないため。
- [x] SKIP|Units Generation|管理画面とWorkerの集計をaidlc-integrationの1単位で一括受入するため。
- [x] SKIP|Functional Design|状態・保存の対象の分離・集計の数え方をRequirements・Code Generation Plan・設計提案版へ集約するため。
- [x] SKIP|NFR Requirements|互換性・accessibility・新旧の組み合わせ・本番データの形をRequirementsへ統合するため。
- [x] SKIP|NFR Design|CSS scope・focus・保存の排他・撮影の具体方式をCode Generation Planへ固定するため。
- [x] SKIP|Infrastructure Design|D1のschema・binding・secret・CORSの許可元・hostingを変えず、読み取りの経路を1つ足すだけのため。deployの順序はCode Generation Plan §8に固定する。
- [x] SKIP|Operations|merge・Worker deployの順序とrollbackをCode Generation Plan §8・§9へ記し、本番への反映を別のOwner gateとするため。

## 5. 停止と自己検証

許可外のwrite/network/secret、データの形・予約の状態と数え方・告知文・共有用のアドレス・抽出契約を変えないと要件を満たせない時、aidlc-cycleの手順外の故障はBLOCKED。局所的なOwner判断が残る場合は、推奨案つきのowner_questionsをFrontへ返し、作れる候補は完成させる。独立review待ちだけでは候補作成を止めない。

自己検証は、5 mappingが各1回でpathが一致すること、SKIPの理由、未チェック行がないこと、承認記録がないこと、Requirements承認待ち、`scripts/aidlc-cycle.sh status`の成功、提案版のSHA-256と計画の記載の一致、`git status`でaidlc-docs以外が無変更、aidlc-docsに本番の値がないことを対象にする。Worker result、独立review、Owner承認、Front completionを別の信号で返す。
