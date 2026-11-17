# Code Generation Result — Figmaマスタ対応の設計書を昇格（Issue #40）

公開サイトのUI設計を新設し、管理画面全体の設計と索引を更新した。画面ごとにFigmaの場所、要件メモ、受入条件、担当Issueと実装状況へ戻れる。Itsukiの確認1で固定された提案版3ファイルを、追加編集せず現在の正本へ置いた。

- Status: Draft / gate 4 Code Generation Result の承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: 2026-11-17_issue-40_figma-design-mapping
- reader_profile: audience_class=hybrid / language=ja-JP / review_surface=notion_paper / reader_ready=true（結果候補として。Frontによる投影・独立review・Owner承認は別）
- source_of_truth: 承認記録、承認済み計画、昇格後canonical、検証log。

## 昇格した内容と根拠

| 昇格先 | SHA-256 | 検証 |
|---|---|---|
| `docs/specs/current/public-site-ui.md` | `a551e50c3ff93c4f28665fbb73544e7c23dae7c68e2c8edf0030b78f35846e22` | 同一bytes / plan一致 |
| `docs/specs/current/live-operations-admin-ui.md` | `47764d8591dcb3af793935645a5ed5e5c2124d1a94a405159e22c7eb522bf3a6` | 同一bytes / plan一致 |
| `docs/specs/current/README.md` | `6190a72a88748e667d6365d64a3a6e139abec2ef5f89dccb5afb0b95f7fd2603` | 同一bytes / plan一致 |

公開設計は10画面・19frameと公開の原文AC22件＋共通2件を対応づけた。管理設計は27frame、原文AC7件、スマホとPCの保存条件、予約一覧の直接操作と詳細操作、保存後の告知入口を対応づけた。#37の予約控え、元情報からの下書き作成、共有URL、失敗時の契約と、色・文字・余白の正本は保持した。コードとFigmaの更新は今回の成果に含まない。

確認1の原典は `/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-133000_1212hp-40-figma-design-mapping/gate-123-owner-responses.md`。Itsuki Matsumotoのraw response `A`（2026-11-17T15:06:33+09:00）をgate 1〜3の承認記録へ転記し、`scripts/aidlc-cycle.sh` の実関数 `validate_approval` で3件とも検証した。gate 3が固定する上表のbytesは提案版・承認済みplan・canonicalの3者で一致した。承認済みRequirementsと2計画はbytesを保ち、本文の旧 `Draft / Itsuki承認待ち` 表記は書き換えていない。現在の承認状態はapproval recordとstateで判別する。

## 成立したことと次の確認

`verification/verify-candidates.py --promoted` でnode-id・名前・URL、原文AC29件、保持節、5 gateと9 SKIP、承認参照、planのhash、昇格bytes、許可範囲を検証した。Frontの `front-targeted-verification-01.md` は確認1前にnode-id84個をliveマスタへ照合した記録であり、今回のWorkerが新たにlive検証した結果ではない。

独立レビューは提案内容についてreview-01 REJECTED → 修正01c・01d → review-01b APPROVED（F01〜F05と修正差分に限定）まで成立。昇格後の独立レビューは未実施で、結果を先取りしない。Build/Test Resultは `aidlc-docs/construction/build-and-test/build-and-test-summary.md`。

## 残る確認範囲

- 1440pxの下書き確認・保存直後・予約先/リンク・Ticket Page共通設定、予約の右詳細・取り置き追加、390pxのMusic映像一覧・作品/映像編集は専用frame未作成。
- 見た目、viewport内の入力欄数・1行表示、音、実際の再生・遷移・失敗、本番データ・実速度・メール到達は未検証。ui_route=none。文書照合は#41〜#47の実装受入の代わりにならない。
- 新しいkey・保存形式は#41、一覧集計の採否は#46着手時に確認する既定の後続条件。
- 昇格後の独立レビューは未実施。Frontが手配する。確認2のgate 4・5、close、Front completionは未実施。
