# Current Specifications

このフォルダは1212HPで現在参照すべき設計書の正本です。

## Status

- `Draft`: 検討中。実装開始不可
- `Approved`: Itsuki確認済み。実装の入力として利用可
- `Superseded`: 後継設計へ置き換え済み。通常はcurrentから移動する

## 設計書一覧

| 設計書 | Status | 対象 |
|---|---|---|
| `system-design-principles.md` | Approved | 1212HP全体の設計・運用原則 |
| `live-operations-admin-ui.md` | Approved | Live運用のadmin UIと公開画面の対応。Issue #37のGmail予約控えとTicket Pageの案内・注意文削除を反映し、gate 3承認を本文差分のOwner確認とする。#21の抽出内容、#29のshare URL、#33のprovider自動切替、#35のOpenAI reasoning.effort=minimalを保持 |

設計内容を変更したら、この索引の状態と対象も更新します。
