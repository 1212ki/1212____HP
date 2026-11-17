# Issue #40 — 設計書とFigmaマスタの対応づけ

- Cycle ID: 2026-11-17_issue-40_figma-design-mapping
- Status: Complete / gate 1〜5承認済み、close transaction対象
- **Blocking Findings**: None

Itsukiの確認1（gate 1〜3、raw `A`）を原典から転記し、承認された3ファイルを同一bytesで `docs/specs/current/` へ昇格した。公開サイトと管理画面の設計からFigma・要件・受入条件・担当Issue・実装時点へ戻れる。コード・テスト・assets・DESIGN_RULES・Figmaの変更はない。

自動検証では原典照合・byte/SHA一致・承認record3件・local integrity・既存テスト（242件と324件）・git範囲を確認した。結果正本は `construction/aidlc-integration/code/code-generation-summary.md` と `construction/build-and-test/build-and-test-summary.md`。

提案内容のreview-01のF01〜F05は01c・01dで修理され、review-01bは限定範囲でAPPROVED。昇格後の独立レビューreview-02はAPPROVED（blocking・materialなし）。minorのR02-01（承認記録のRecorder欄の不足）は、Frontが3記録へRecorderを追記して解消し、validate_approvalの再実行で3件PASSを確認した。確認2のgate 4・5はItsukiのraw `A`（2026-11-17T15:23:43+09:00）で承認済み。Front completionは本Packetの実行結果と別に判定する。実UI・本番・未描画frameは結果文書のGapを保持する。先行close事前検査の仮承認とCompleteは使い捨てコピー専用であり、本cycleの承認を表さない。

## 確認2の承認とcycle close

Itsuki Matsumotoの回答原典 `gate-45-owner-responses.md` と完全promptを、`approvals/04-code-generation-result-approval.md`・`05-build-test-result-approval.md`へ逐語転記した。承認対象の2結果文書とcanonical3件のdigestは原典と一致し、5件の実 `validate_approval` はPASS。承認済み文書のbytesは変更していない。

close対象は `2026-11-17_issue-40_figma-design-mapping`。実 `validate_close_ready` のPASS後に `scripts/aidlc-cycle.sh close 2026-11-17_issue-40_figma-design-mapping` を実行し、このsummaryとauditを `docs/records/aidlc-cycles/2026-11-17_issue-40_figma-design-mapping/` に保存してactiveをidleへ戻す。保存記録の存在・manifest・コマンド結果は `worker-06-result.md` で検証する。publication前の本記録だけでclose成功とは扱わない。
