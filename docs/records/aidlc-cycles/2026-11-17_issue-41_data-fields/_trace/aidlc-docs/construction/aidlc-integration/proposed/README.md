# Current Specifications

- Status: Approved
- Owner: Itsuki Matsumoto
- Last updated: 2026-11-17
- Owner approval: Issue #41のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。active時は`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-41_data-fields/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。
- Prior Owner approval（Issue #40）: Issue #40のgate 3における、本索引のexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。close済みの`docs/records/aidlc-cycles/2026-11-17_issue-40_figma-design-mapping/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。

このフォルダは1212HPで現在参照すべき設計書の正本です。

Approvedは実装の入力としての承認を示します。各設計書の画面対応表に、origin/main `00cdea5`時点の実装状況と後続Issueを示します。#40は設計書の対応づけ、#41〜#47がマスタに沿う実装を担当します。#41の保存先・日付検査・参照削除・互換性は管理設計§5.3、公開用データは公開設計§5に記載します。実装・試験・独立reviewの成否は各cycleの結果文書を参照し、設計承認と区別します。

## Status

- `Draft`: 検討中。実装開始不可
- `Approved`: Itsuki確認済み。実装の入力として利用可
- `Superseded`: 後継設計へ置き換え済み。通常はcurrentから移動する

## 設計書一覧

| 設計書 | Status | 対象 |
|---|---|---|
| `system-design-principles.md` | Approved | 1212HP全体の設計・運用原則 |
| [public-site-ui.md](public-site-ui.md) | Approved | Home・Menu・Live・Ticket・Music・Profile・ContactのFigmaマスタ、要件メモ、PS系受入条件と#41〜#45の対応。データ・状態・変更手順と実装時点を示す。 |
| [live-operations-admin-ui.md](live-operations-admin-ui.md) | Approved | Live運用とSite・News・Music・Profileの全マスタ画面、要件メモ、ADM系受入条件と#41・#46・#47の対応。3項目と共有時の画像の持ち方を含む。#21・#29・#33・#35のAI整理・共有URL、#37のGmail予約控えとTicket案内・注意文削除を保持。 |

設計内容を変更したら、この索引の状態と対象も更新します。

画面や要件を変える時は、先にFigmaマスタと要件メモを揃え、設計書と索引をDraftに戻し、影響する要件・計画とともにItsukiの承認を受けてから実装します。変更と検証の手順は各設計書、文書の責務は`docs/DOCS_RULES.md`、5 gateと履歴は`docs/operations/AI_DLC_WORKFLOW.md`を参照します。
