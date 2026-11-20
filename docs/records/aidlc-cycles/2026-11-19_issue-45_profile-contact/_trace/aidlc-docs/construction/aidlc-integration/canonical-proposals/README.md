# Current Specifications

- Status: Approved
- Owner: Itsuki Matsumoto
- Last updated: 2026-11-19
- Owner approval: Issue #45のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。active時は`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後は`docs/records/aidlc-cycles/2026-11-19_issue-45_profile-contact/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。
- Prior Owner approval（Issue #44）: Issue #44のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。active時は`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後は`docs/records/aidlc-cycles/2026-11-18_issue-44_music/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。
- Prior Owner approval（Issue #42）: Issue #42のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。active時は`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-42_home/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。
- Prior Owner approval（Issue #41）: Issue #41のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。active時は`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-41_data-fields/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。
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

#42の入力は公開設計§3の追記・§5〜7と管理設計§5.3の追記に示す。Homeと共通外枠を実装し、既存6項目ナビ・他ページ本文・保存とWorkerを保持する。共有時の画像の説明を実態に揃える。Figmaは公開設計§3の反映済みv2を使い、ロゴの赤いiと押した時の演出は維持する。#41の1作品保存は確認2前に行う（保存済みなら入れ直さない）。本番データを読むbranchでの顔・種別・実音・閉じるは確認2でmerge前に確かめ、fixture撮影は別に保つ。merge後はFrontがPages buildと新版配信をread-only確認し、差がある時だけItsukiへ返す。#42の実装・画面・実音・独立reviewの成否は同cycleの結果文書を参照し、この索引のApprovedを完了としない。

#44の入力は公開設計§3の#44対応表・§5のMusic表示契約・§6のMusicとHome入口・§7の状態とまとめ出し、および管理設計§5.3の#44対応に示す。`/music/`の全作品・全映像、旧URL誘導、全10公開HTMLの5項目ナビとHome入口を対象にする。公開Musicの作品は管理Disco、映像とChannel URLは管理YouTubeで編集し、タブ統合は#47。#44の設計承認・実装・試験・Frontの画面確認・独立review・公開は別の信号である。

#45の入力は公開設計§3の#45対応表・§5のProfile・Contact表示契約・§6のProfileとContact・§7の状態とまとめ出しに示す。`profile/index.html`と`contact/index.html`の本文、`assets/js/contact.js`の送信状態を対象にする。ヘッダー・ナビ・フッターは#44のまま。Contactの送る先・送る項目・送り方、データの形、管理画面、Cloudflare Workerは変えないため、管理設計は更新しない。#45の設計承認・実装・試験・Frontの画面確認・独立review・公開は別の信号である。

Owner決定（2026-11-18）：#44を先に`feature/39-public-pages`へ統合し、#43・#45も同branchへ集約してmainへ1回で公開する。#44のmergeでは本番配信は変わらず、Worker deployはない。Issue/Projectはまとめ出しまでReview。確認1はgate 1〜3、確認2はgate 4〜5。Frontは確認2前にfixtureとは別に本番公開データの画面を確認し、毎回PC/スマホURLを渡す。確認2のItsukiの閲覧は任意、必須の本人画面確認はまとめ出し前の1回。#42の単独公開時点の記述は履歴として保つ。

設計内容を変更したら、この索引の状態と対象も更新します。

画面や要件を変える時は、先にFigmaマスタと要件メモを揃え、設計書と索引をDraftに戻し、影響する要件・計画とともにItsukiの承認を受けてから実装します。変更と検証の手順は各設計書、文書の責務は`docs/DOCS_RULES.md`、5 gateと履歴は`docs/operations/AI_DLC_WORKFLOW.md`を参照します。
