# Workflow Plan — 管理画面のたまにする更新（Issue #47）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-21_issue-47_admin-occasional`
- Base Commit: `1f3a1cdcdf9852b3f2cabaa2978352572e0b9d82`
- Branch: `feature/47-admin-occasional`
- Workspace Root: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-47-admin-occasional`
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 1. 責任と2回の確認

管理画面のSite・News・Music（作品と映像）・Profileを、Liveの型（一覧と編集、保存して公開、未保存の確認）に揃え、タブを5つにする。範囲は1つのcycle・1回のmergeで全部出す（Itsukiの決定 2026-11-21）。既存cycleを使い、再startしない。候補が3つ揃ったこととstageの承認を区別する。Itsukiがスマホで使う本番の道具が、mergeで入れ替わる。この Issue は保存の仕方を変えるので、**保存を壊さないこと**（送る内容、データの形、ほかの入力を巻き込まないこと）を最優先にし、今の動きを固定する試験を実装より先に置く。

| 確認 | Ownerが判断する対象 |
|---|---|
| 確認1 | gate 1 Requirements、gate 2 Workflow Plan、gate 3 Code Generation Plan。3 artifactのfresh SHA-256を列挙する。gate 3は、設計提案版2文書（`live-operations-admin-ui.md`・`README.md`）のexact bytesと、Figma整合案`figma-fix-requests.md`（F47-01〜26）の採否を含む。 |
| 確認2 | gate 4 Code Generation Result、gate 5 Build/Test Result。実装・試験・Frontの撮影・独立reviewと修理を示す2 artifactのfresh SHA-256。**Itsukiが自分で触る確認（Code Generation Plan §7）の入口を渡す**。merge・PRの承認は別の明示承認。 |

| Executor Plan | 担当と権限 |
|---|---|
| owner / approver | Itsuki Matsumoto。5 gateとも本人のA/B/X。merge・PR承認は別の明示承認。 |
| executor | bounded Worker。本Packetは3候補・設計提案版・Figma整合案・audit/state・自己検証まで。承認後の後続Workerは昇格・実装・試験と撮影script・架空API・fixtureを担当（再委任しない）。 |
| reviewer | executorと独立したread-onlyのReviewer。実装後に設計と実装をまとめて1回。保存の本文の同一性・他の入力を巻き込まないこと・削除と参照の照合・未保存の確認の全経路・Liveと公開側が変わらないこと・Figma整合・本番データの形を見る。Frontが手配する。通常の修理・再検証は同じ実装範囲で行う。 |
| completion gate owner | VECTOR / Front Runtime。確認提示・本人対話・承認記録・Figma整合・撮影・review管理・全体受入を持つ。 |
| commit_mode | WorkerのGit writeなし。formal close後、別途許可されたFrontが`feature/47-admin-occasional`をcommit/pushし、既存のai-feature-push / ai-pr-createで`main`へPRを作る（#47単独）。 |
| risk_class | Full / D1 intent-sensitive。保存の送る内容の同一性、別の入力の巻き込み、削除と参照の照合、未保存の確認の取りこぼし、Header・Tabsの共有CSSがLiveに与える影響が重点。 |

PR baseは`main`（repo規定どおり）。merge＝本番（GitHub Pagesがmainから配信）。**Cloudflare Workerは変更しないので、Worker deployはない**（#46との違い）。Issue・Projectのcloseはmerge後。

## 2. 工程と停止位置

1. cycle identity、Issue写し、Approved設計、Figma snapshot、本番データの分類、codeと試験を読む。着手前の基準（`node --test test/` pass 989 / fail 0、`npm --prefix cloudflare/worker test` pass 361 / fail 0、`scripts/aidlc-verify.sh --local` PASS、Issue #47のProject StatusのIn Progress）はFrontの報告、`scripts/aidlc-cycle.sh status`はWorkerの実測として区別する。
2. Requirements、本計画、Code Generation Plan、設計提案版2文書、Figma整合案を作る。stateをRequirements承認待ちで停止する。approval recordは作らない。
3. Frontが確認1を提示し、3 artifactのstage・両path・fresh digest、提案版2文書のpath・hash、Figma整合案のhashを完全promptへ含める。提示文に本番の値（題・文章・URL・id）を入れない。
4. Itsukiの完全なraw response `A`をFrontが各recordに保存する。B/X・digest変更なら候補を修理し再承認する。承認済みplanを進捗記録のために書き換えない。
5. Frontが確認1のAのあと、Figma整合案の「直す」「足す」をマスタへ反映する（実装の前。反映の前後の書き出しのdiffで意図しない変更が0件であることを確かめる。足すframeは画面全体3枚と状態の見本5枚）。「実装で決める」は反映の対象ではなく、撮影で確かめる。反映で意味が変わった時は停止して候補を修理する。
6. 後続Workerが3承認・canonical元版hash・Figma整合を照合し、提案版を同じbytesで昇格する。元版hashが一致しない時、Figma整合案に未解消の食い違いがある時、sourceの意味が変わった時は、実装を止めてFrontへ返す。
7. Code Generation Planの8段で実装する。段1は今の動きを固定する試験（GREENで固定。不要なREDは作らない）と保護試験の改め。以降のfocused testはRED→GREEN。全試験は挙動が揃う区切り（段4の後・段6の後・段8）だけ。撮影script・架空API・fixtureはWorker、実行・画像の目視はFront。**Frontの撮影は、段2のあと（最初の1画面）と段6のあと（全画面）と、段8の修理後（最終）**。
8. Frontが独立reviewを1回手配し、修理と必要な再検証を結果へ反映する。確認2の前に、Frontが撮影・目視を済ませる。ItsukiへItsukiが触る確認の入口を渡し、gate 4・5の本人Aを得る。任意の触る確認の未実施を実施扱いにしない。
9. Itsukiの明示承認のもと、FrontがPRをmergeする（Worker deployなし。Code Generation Plan §8）。merge後の確認（Itsuki）。rollbackは§9。
10. 必須の証拠・5承認・state・findings・Front受入が揃ってから、Front側の許可範囲でformal close/archiveし、PRへ進む。closeが作る一時path（`docs/records/aidlc-cycles/.aidlc-stage-*`、リポジトリ直下の`.aidlc-idle-*`と`.aidlc-recovery-*`、`aidlc-docs/.audit-resume.*`、`/private/tmp/aidlc-archive-verify.*`・`/private/tmp/aidlc-source-verify.*`、保存先の`docs/records/aidlc-cycles/2026-11-21_issue-47_admin-occasional/`）は、closeのPacketの許可pathと、`test/live-ticket-shell.test.mjs`の許可の一覧に入れる。Build/Test Resultとcycle-summaryの`Blocking Findings`は`- **Blocking Findings**: None`のfield形式で書く。

確認1のAはコードを作るための仕様承認であり、merge・外部write全般の承認ではない。確認2後の公開前の修理は閉じたcycleを書き換えず新Issueで行う。

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

- [x] SKIP|Reverse Engineering|対象の管理画面（`admin/index.html`・`app.js`・`style.css`）、Worker、`music-data.js`、既存試験の調査をauditとCode Generation Planへ統合し、全systemの別冊再構成を不要とするため。
- [x] SKIP|User Stories|Itsukiがスマホで、Site・News・Music・Profileの更新をLiveと同じ型で終える目的を、Requirementsの安定IDと受入条件へ直接対応させるため。
- [x] SKIP|Application Design|既存の管理画面の中で編集面の作りを替えるだけで、新しいサービス境界・APIを作らないため。
- [x] SKIP|Units Generation|管理画面の1つの実装単位`aidlc-integration`で一括受入するため。
- [x] SKIP|Functional Design|状態・保存の単位・保存の対象の分離・削除と参照の照合をRequirements・Code Generation Plan・設計提案版へ集約するため。
- [x] SKIP|NFR Requirements|互換性（保存の同一性）・accessibility・本番データの形をRequirementsへ統合するため。
- [x] SKIP|NFR Design|CSSの特異度・focus・保存の排他・撮影の具体方式をCode Generation Planへ固定するため。
- [x] SKIP|Infrastructure Design|Cloudflare Worker・D1・binding・secret・CORS・hostingを変えないため。出し方（Workerのdeployがないこと）はCode Generation Plan §8に固定する。
- [x] SKIP|Operations|mergeの順序とrollbackをCode Generation Plan §8・§9へ記し、本番への反映を別のOwner gateとするため。

## 5. 停止と自己検証

許可外のwrite/network/secret、データの形・#41の参照の照合・Liveの動きを変えないと要件を満たせない時、aidlc-cycleの手順外の故障はBLOCKED。Cloudflare Workerの変更が要る場合は、理由とdeployの順番を示してFrontへ返す（今の計画ではWorkerは変えない）。局所的なOwner判断が残る場合は、推奨案つきのowner_questionsをFrontへ返し、作れる候補は完成させる。独立review待ちだけでは候補作成を止めない。

自己検証は、5 mappingが各1回でpathが一致すること、SKIPの理由、未チェック行がないこと、承認記録がないこと、Requirements承認待ち、`scripts/aidlc-cycle.sh status`の成功、提案版のSHA-256と計画の記載の一致、`git status`でaidlc-docs以外が無変更、aidlc-docsに本番の値がないこと、変更ファイルの表に保護試験が入っていることを対象にする。Worker result、独立review、Owner承認、Front completionを別の信号で返す。
