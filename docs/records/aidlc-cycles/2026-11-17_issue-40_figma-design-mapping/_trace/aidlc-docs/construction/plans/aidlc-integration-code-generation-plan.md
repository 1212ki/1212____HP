# Code Generation Plan — 設計書のマスタ対応を昇格する（Issue #40）

- Status: Draft / Itsuki承認待ち
- Owner: Itsuki Matsumoto
- Unit: aidlc-integration
- Cycle ID: `2026-11-17_issue-40_figma-design-mapping`
- Base Commit: `00cdea5e69d5b341fc0a2b21a4eece9a53c8a2cd`
- Branch: `feature/40-figma-design-mapping`
- Workspace Root: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-40-figma-design-mapping`
- Reader: human_reader / ja-JP / designated_text_editor（Frontが開く）

## 1. この計画で承認する変更

公開サイトのUI設計を新設し、管理画面の設計と索引を更新する。Figmaマスタの全画面、状態、要件メモ、受入条件ID、担当Issueとbaseの実装状況をつなぐ。コード・テスト・Figma・tokensは変えない。要件はR40-01〜11、文書受入はAC40-01〜08に対応する。

確認1でgate 1〜3を承認する。gate 3は、下表の3ファイルのexact bytesをcanonicalとして採用するItsukiの確認を兼ねる。提案版は昇格後の最終形で、`Status: Approved`、Owner approvalのactive/closed record参照を含む。候補ディレクトリの表記だけでは実際の承認は成立しない。現在のcanonicalを維持したまま内容reviewとOwner確認を行い、本人の`A`が記録されるまで昇格しない。

## 2. 昇格するexact bytes

pathはrepository-relative。絶対パスは上記Workspace Rootに各pathを連結したもの。SHA-256はファイル全体のbytesを対象にし、改行や末尾改行も含む。

| 提案版 | 昇格先 | SHA-256 |
|---|---|---|
| `aidlc-docs/construction/aidlc-integration/proposed/public-site-ui.md` | `docs/specs/current/public-site-ui.md` | `a551e50c3ff93c4f28665fbb73544e7c23dae7c68e2c8edf0030b78f35846e22` |
| `aidlc-docs/construction/aidlc-integration/proposed/live-operations-admin-ui.md` | `docs/specs/current/live-operations-admin-ui.md` | `47764d8591dcb3af793935645a5ed5e5c2124d1a94a405159e22c7eb522bf3a6` |
| `aidlc-docs/construction/aidlc-integration/proposed/README.md` | `docs/specs/current/README.md` | `6190a72a88748e667d6365d64a3a6e139abec2ef5f89dccb5afb0b95f7fd2603` |

| ファイル | 主な変更と境界 |
|---|---|
| public-site-ui.md | 全10画面の1440/390・状態・要件・実装対応。マスタの受入条件22項目をPS系IDで転記し、共通2条件を区別して追加。判断・データ・flow・failure・変更手順・検証・Gapを定義。実装は#41〜#45。 |
| live-operations-admin-ui.md | §3、§4.1/.4/.5/.6、§6をマスタへ揃える。§4.2は共通設定の入口の場所だけを一覧下へ揃える。§5.3に3項目と共有画像、§9に整合するwireframe、§11.2にIssue分担、§12.3にマスタ原文7条件、§13.3に変更・検証・rollback、§14/§15に参照と全frame対応を加える。§2に古いinventoryの時点を明記。§5.2・§7・§8・§10と既存の未変更節は維持。 |
| README.md | 公開設計の追加と管理設計の対象更新、承認根拠、実装時点と変更手順への入口。system-design-principles.mdの内容は変更しない。 |

確認1で本計画と併せて固定する入力は次のとおり。Code Generation Plan自身のfresh SHA-256は循環参照を避け、Worker結果と確認1の承認promptで特定する。

| 入力ファイル | SHA-256 |
|---|---|
| `aidlc-docs/inception/requirements/requirements.md` | `f58f4b913107b479ec746ebd3291565cb94237d85d1d18c0a93a6ce34408a939` |
| `aidlc-docs/inception/plans/execution-plan.md` | `e620b4a408931b92374ad509810574fa6d1271cfc0569bed46e17c67f72ff973` |

## 3. 昇格と検証の手順

### Step 1 — 承認と入力を確認する

後続executorはcycle identityとbase、Requirements・Workflow Plan・本計画に結び付くgate 1〜3の承認recordを読む。stage、relative/absolute path、fresh SHA-256、human approver Itsuki Matsumoto、完全promptとraw response `A`、Decisionを確認する。Frontによる内容reviewの返却も確認する。承認が欠ける・digestが古い場合は昇格しない。

提案版のSHA-256を再計算して§2に一致すること、現在のcanonicalがbaseのままであること、`docs/specs/current/public-site-ui.md`が未作成であることを確かめる。別作業の変更があれば上書きせずFrontへ返す。候補の修理が必要なら提案版・本計画のhashを更新し、影響する承認を取り直す。

### Step 2 — 同じbytesを置く

§2の3提案版をそれぞれの昇格先へコピーする。encoding変換、改行変換、日付変更、Status変更、承認者・timestamp・hashの追記、formatterは使わない。提案版とcanonicalのSHA-256およびbyte比較が3組とも一致することを確かめる。

```bash
cp aidlc-docs/construction/aidlc-integration/proposed/public-site-ui.md docs/specs/current/public-site-ui.md
cp aidlc-docs/construction/aidlc-integration/proposed/live-operations-admin-ui.md docs/specs/current/live-operations-admin-ui.md
cp aidlc-docs/construction/aidlc-integration/proposed/README.md docs/specs/current/README.md
cmp aidlc-docs/construction/aidlc-integration/proposed/public-site-ui.md docs/specs/current/public-site-ui.md
cmp aidlc-docs/construction/aidlc-integration/proposed/live-operations-admin-ui.md docs/specs/current/live-operations-admin-ui.md
cmp aidlc-docs/construction/aidlc-integration/proposed/README.md docs/specs/current/README.md
shasum -a 256 docs/specs/current/public-site-ui.md docs/specs/current/live-operations-admin-ui.md docs/specs/current/README.md
```

上の操作はgate 3承認後の後続委任で実行する。今回のWorkerは候補作成だけで停止する。

### Step 3 — 文書受入と範囲を確認する

- AC40-01/02: 公開19・管理27のscreen frame、状態と要件メモ、受入条件22+7項目の逐語一致、node-id・名前・URLをsnapshotにdelta-02を優先適用した原典と照合する。FF40-01〜07の差は解消済みとし、最終Figmaマスタ照合はFront。未描画のframe・見た目・本番確認のGapを保持する。
- AC40-03/06: 承認recordがplanのexact digestに結び付き、planが3提案版のhashを固定し、canonicalと提案版が同一bytesであることを確認する。Owner approval欄のactive/closed参照先を確認する。3ファイルは既に最終形なので、昇格後の編集を要しない。
- AC40-04: 各行・変更節の担当Issueとbase実装時点、#41で決めるkey/形式、#46で確かめる一覧集計の採否を確認する。
- AC40-05/07: 5 gateのmapping、SKIP、audit、state、独立review、実際の承認記録を区別する。planを進捗更新で書き換えない。
- AC40-08: git差分が3つのcanonicalとcycle traceだけであることを確認する。currentのsystem-design-principles.md、コード、テスト、`DESIGN_RULES.md`、`assets/`は変えない。

検証入力はcontext rootの`_scratch/codex-work/20261117-133000_1212hp-40-figma-design-mapping/`配下の`figma-snapshot/page-0-1_master-home.md`と`figma-snapshot/page-1-2_master-admin.md`、優先する`figma-snapshot/delta-02_front-fixes-FF40.md`、更新後の`front-figma-changes.md`。元snapshotを保持したままdelta-02の修正後原文を優先適用し、公開22件・管理7件の安定ID・順序・逐語一致を照合する。入力のpathとSHA-256、FFごとの解消内容はauditの追補へ記録する。

候補の構造検証は`aidlc-docs/construction/aidlc-integration/verification/verify-candidates.py`を使う。昇格前は引数なし、昇格後は`--promoted`でbyte一致も確認する。

```bash
python3 aidlc-docs/construction/aidlc-integration/verification/verify-candidates.py --promoted
scripts/aidlc-cycle.sh status
scripts/aidlc-verify.sh --local
git diff --check
git status --short
```

今回はMarkdownのみの変更で、新しい機能テストは追加しない。昇格後のBuild/Test Resultではrepository既存の`node --test test/`と`npm --prefix cloudflare/worker test`も実行し、文書・scopeの検証結果と分けて記録する。Node環境の不足等で実行不能なら成功にせずGapをFrontへ返す。実API・secret・新しいUI観察は不要。

### Step 4 — 結果、独立review、確認2へ進む

後続executorは次のpathに実行結果を書く。未実施の結果を先に作ったり、PASSを予定で埋めたりしない。

| 成果物 | pathと記録する内容 |
|---|---|
| Code Generation Result | `aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md`。実際の昇格先とhash、3組のbyte一致、変更範囲、承認参照、Gap。 |
| Build/Test Result | `aidlc-docs/construction/build-and-test/build-and-test-summary.md`。各command・exit・確認結果、全AC対応、独立review、`Blocking Findings`。未解消のblockingがあればNoneにしない。 |
| cycle summary | `aidlc-docs/cycle-summary.md`。全体結果、5承認、review、未検証事項、`Blocking Findings`。 |

Frontは昇格後の独立reviewで、同じbytesの昇格と承認record・結果の整合を確認する。正常時は確認2でgate 4〜5を本人の`A`に結び付け、必要なstateとclose条件を満たす。Worker result・独立review・Owner承認・Front completionは別の信号として残す。

## 4. 失敗・rollback・停止

- 昇格前のhash不一致、canonicalの予期しない変更、承認の欠落は停止し、上書きしない。コピー失敗・byte不一致は結果に記録し、未昇格の組と分ける。再編集して承認済みdigestに見せかけない。
- rollbackは今回の3設計文書だけをmainのbase `00cdea5e69d5b341fc0a2b21a4eece9a53c8a2cd`の版へ戻す。既存の管理設計書と索引はbaseのexact bytesへ戻し、新設の公開設計書はbaseに存在しない状態へ撤回する。ファイル削除が必要な場合はItsukiの明示確認を得てから行う。無関係な変更を戻さず、git resetやbranch操作を使わない。
- rollbackでFigma・コード・データ・既存の#37 §5.2・§7/§8/§10の承認内容を変えない。3ファイルの復旧をbyte比較で確かめ、state/auditへ経緯を残し、gate 3の扱いをFrontへ返す。
- 必要な原典不足、手順外のcycle故障、許可外write/network/secret、未決のOwner-only判断はBLOCKEDでFrontへ返す。Figma側の表現差は修正要求とGapに残し、現マスタを設計書で黙って変更しない。

## 5. 今回の停止位置

今回の3候補はすべて未承認。stateはRequirementsの承認待ちとし、承認record、canonical昇格、Code Generation Result、Build/Test Result、closeは作成・実行しない。確認1の内容reviewとOwner対話はFrontが担う。
