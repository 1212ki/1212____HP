# Build/Test Result — 設計書昇格の検証（Issue #40）

承認済みの設計書3件は提案版と同一bytesで昇格し、既存テストも成功した。今回の結果は設計文書の対応づけと既存機能の自動回帰検証であり、後続UI実装の完成や本番動作の確認を表さない。

- Status: Draft / gate 5 Build/Test Result の承認待ち
- **Blocking Findings**: None
- Cycle ID: 2026-11-17_issue-40_figma-design-mapping
- reader_profile: audience_class=hybrid / language=ja-JP / review_surface=notion_paper / reader_ready=true（結果候補として。Frontによる投影・独立review・Owner承認は別）
- source_of_truth: 承認記録、承認済み計画、昇格後canonical、検証log。

## 自動検証

Nodeはbaselineと同じv20.19.4。PATH先頭を `/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin` とした。文書のみの変更のため新しい機能テストは追加せず、既存の両テストを実行した。専用のcompile/build工程は今回の変更に不要で、local integrityと既存テストを検証対象とした。

logはすべて `aidlc-docs/construction/aidlc-integration/verification/` 配下。

| コマンド | 結果 | log |
|---|---|---|
| `scripts/aidlc-verify.sh --local` | exit 0。v1.0.1 / local integrity一致。source authenticityは未検証。 | `local-integrity-04.log` |
| `node --test test/` | exit 0。242 pass / 0 fail。 | `node-tests-04.log` |
| `npm --prefix cloudflare/worker test` | exit 0。324 pass / 0 fail。 | `worker-tests-04.log` |
| `python3 -B aidlc-docs/construction/aidlc-integration/verification/verify-candidates.py --promoted` | exit 0。原典・構造・保持節・昇格byte一致。 | `promoted-checks-04.log` |
| `bash aidlc-docs/construction/aidlc-integration/verification/validate-gates-04.sh` | exit 0。実validate_approvalでgate 1〜3 PASS。 | `approvals-04.log` |
| `git status --short --untracked-files=all`、`git diff HEAD --name-only`、`git diff --check`、base/branch照合 | 許可したcanonical3件とaidlc-docsのみ。空白エラーなし。 | `git-scope-04.log` |
| `scripts/aidlc-cycle.sh status` | exit 0。指定cycle / Issue #40 / Code Generation Result承認待ち / In Progress。 | `git-scope-04.log` |
| 使い捨てコピーで実 `validate_close_ready` | exit 0。仮gate 4・5とCompleteはコピー内だけに配置。実closeは未実行。 | `close-dryrun-04.log` |

承認検査のharnessは `scripts/aidlc-cycle.sh` のcommand dispatch直前までをそのまま抽出したもの。validatorの再実装はしていない。別途、3記録のApproval promptを原典と逐語比較し、raw response `A`、回答時刻、6承認対象のhashを照合した。

closeの事前検査は `/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-133000_1212hp-40-figma-design-mapping/close-dryrun/fixture/aidlc-docs/` だけに仮のgate 4・5 recordとComplete stateを置く。gate 1〜3のコピーではArtifact absolute pathだけをコピー先に結び直し、promptと対象bytesは保持する。実関数 `validate_close_ready` を実行し、必須artifact、5 mapping、5 digest承認、未回答/未チェック、Blocking Findings fieldの書式を検査する。これは書式の事前検査であり、Owner承認や独立reviewの代替ではない。再現手順は `verification/close-dryrun-04.py` に残す。

## 独立レビューの履歴

- `/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-133000_1212hp-40-figma-design-mapping/review-01-result.md`: REJECTED。F01〜F05（最新AC、保存条件、PC予約操作、解消済みGap、検証入力の古さ）。
- `/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-133000_1212hp-40-figma-design-mapping/worker-01c-result.md` と `worker-01d-result.md`: delta-02反映、指定の文面修正、検証入力とhashの整合を修理。
- `/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-133000_1212hp-40-figma-design-mapping/review-01b-result.md`: APPROVED。F01〜F05と修正差分に限定、new_findingsなし。Owner承認・全体完了とは別。
- 昇格後の独立レビュー: **未実施**。Frontが承認record・昇格bytes・結果artifactの整合を別途レビューへ出す。

## 残るGapと解釈上の注意

- 1440pxの下書き確認・保存直後・予約先/リンク・Ticket Page共通設定、予約の右詳細・取り置き追加、390pxのMusic映像一覧・作品/映像編集は専用frame未作成。
- 見た目、viewport内の入力欄数・1行表示、音、実際の再生・遷移・失敗、本番データ・実速度・メール到達は未検証。ui_route=none。文書照合は#41〜#47の実装受入の代わりにならない。
- 新しいkey・保存形式は#41、一覧集計の採否は#46着手時に確認する既定の後続条件。
- 昇格後の独立レビューは未実施。Frontが手配する。確認2のgate 4・5、close、Front completionは未実施。

承認済みのRequirements・Workflow Plan・Code Generation Planは元の文面とbytesを保つため、作成当時の未承認/今回停止位置の表記が残る。現在はgate 1〜3の原典転記済みで、state/audit/resultが進捗を表す。Requirements AC40-07/08の「Requirements承認待ち・候補作成のみ」は前段の受入時点の記述として保持し、昇格後の現在状態に適用し直さない。

baseとHEADとorigin/mainは `00cdea5e69d5b341fc0a2b21a4eece9a53c8a2cd`。ローカルmainは古い `4defa036f010c1b5eb1cd20755c62a05d50b17f0` であり、比較の基準は承認済みplanのbaseとする（review-01bの参照差を保持）。
