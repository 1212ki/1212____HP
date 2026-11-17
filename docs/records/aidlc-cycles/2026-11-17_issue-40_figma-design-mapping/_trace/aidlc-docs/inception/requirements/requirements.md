# Requirements — Figmaマスタと設計書の対応づけ（Issue #40）

- Status: Draft / Itsuki承認待ち
- Owner: Itsuki Matsumoto
- Last updated: 2026-11-17
- Cycle ID: `2026-11-17_issue-40_figma-design-mapping`
- Base Commit: `00cdea5e69d5b341fc0a2b21a4eece9a53c8a2cd`
- Reader: human_reader / ja-JP / designated_text_editor（Frontが開く）

## 1. 目的と範囲

後続のUI実装が、画面ごとにFigmaのマスタ・要件メモ・受入条件へ戻れるようにする。公開サイトの設計書を新設し、管理画面の設計書と索引を更新する設計文書の変更である。全画面の追跡可能性と、既存の承認済みLive設計を保つ点に注意が必要な、3ファイルの変更とする。

画面と要件メモの内容はFigmaマスタを根拠とする。設計書は対応表、判断理由、データの持ち方、変更手順、受入条件を持ち、要件メモ全文は複製しない。承認後の設計は実装への入力であり、現行コードの完成報告ではない。

対象は公開サイトのHome、Menu、Live一覧、Live詳細、Ticket、Ticket完了、終了したライブ（全件）、Music、Profile、Contactと、マスタにある管理画面の全画面である。管理画面はよくする3つ（ライブの登録・告知・予約の管理）と、Site・News・Music・Profileの更新を含む。

## 2. 要件

| ID | 満たす条件 |
|---|---|
| R40-01 | `docs/specs/current/public-site-ui.md`を新設し、`live-operations-admin-ui.md`と`README.md`を更新する。今回の候補は`aidlc-docs/construction/aidlc-integration/proposed/`に置く。 |
| R40-02 | 各画面からFigmaのnode-idとURL、1440・390のframe、状態frame、要件メモのnode-id・見出し、受入条件ID、実装Issueをたどれる。マスタにない幅・状態は創作せずGapを示す。 |
| R40-03 | 要件メモの「受入条件」を項目ごとに転記し、公開側は`PS-H-*`・`PS-L-*`・`PS-M-*`・`PS-PC-*`、管理側は`ADM-40-*`の安定IDを付ける。後続の計画と検証はこれらのIDを参照する。 |
| R40-04 | 管理画面の§3・§4.1・§4.4・§4.5・§4.6・§6と保存直後の告知入口をマスタに揃える。共通設定の入口と矛盾するwireframeも同じ範囲で揃える。§5.2の#37、§7・§8・§10のAI整理・共有URL・失敗時の契約は文面を保つ。 |
| R40-05 | 一覧の予約枚数と未対応件数は「入れる。外せる」とし、新しい集計処理が必要なことと、#46着手時にItsukiへ採否を確かめることを記す。 |
| R40-06 | 足す3項目は「顔にする作品」「その場で再生する映像」「種別」に限る。空で成立し、削除された参照は空に戻し、最新作品はリリース日で選ぶ。リリース日の形の扱いと、Home Heroの表示名を「共有時の画像」へ変え共有画像の予備機能を保つことを書く。新しいkey・保存形式は#41のCode Generation Planで決める。 |
| R40-07 | 各対応行と変更節に、実装Issue（#41〜#47）とbase `00cdea5`で実装済みかを示す。Approvedはto-beの採用であり、実装・本番確認済みを意味しない。 |
| R40-08 | 仕様を変える時は先にFigmaマスタと要件メモを揃え、設計書をDraftに戻し、影響する受入条件・計画とともに承認し直してから実装する。食い違いは設計書で黙って解かず、node-id・今の文面・修正案・理由で返す。 |
| R40-09 | 5 gateはすべてItsukiの本人回答`A`を記録する。確認1はgate 1〜3とcanonical提案版のexact bytes、確認2はgate 4〜5。独立reviewは確認1前の内容と昇格後のbytes・記録の2回をFrontが手配する。 |
| R40-10 | 提案版3ファイルは最終形の`Status: Approved`とgate 3のOwner approval参照を持ち、昇格先とSHA-256をCode Generation Planへ固定する。gate 3承認後はbytesのまま昇格し、一致を確認する。候補ディレクトリ内のApproved表記は承認成立を表さない。 |
| R40-11 | 色・文字・余白は`DESIGN_RULES.md`とtokensを維持する。画面に設計の理由や新旧の説明を追加しない。人向け説明は日本語とする。 |

## 3. 対象外

コード・テスト・assets・`DESIGN_RULES.md`の変更、Figmaの変更、#41〜#47の実装、データkey・API・DB保存形式の新規決定、repo全体の文書時制・trace構造の再設計を含めない。canonicalへの昇格はgate 3の承認後に行う。merge・本番反映は別のOwner承認とする。

## 4. 受入条件と確認方法

| ID | 受入条件 | 確認方法 |
|---|---|---|
| AC40-01 | 公開サイトの全画面と管理画面の全画面について、Figmaの場所と受入条件が設計書からたどれる（Issue #40の受入条件1）。 | 全frameの網羅、node-id・名前・URL、要件メモ見出しと受入条件IDの参照をsnapshotにdelta-02を優先適用した原典と照合する。最終マスタ照合はFront。 |
| AC40-02 | 管理画面の設計がマスタと食い違わず、既存Live契約を保持する（Issue #40の受入条件2）。 | R40-04〜06を節ごとに確認し、未変更節のbytesをbaseと比較する。マスタ内の未解消差はGapと修正要求として明示し、実装で独断解決しない。 |
| AC40-03 | 設計書のStatusがApprovedとなり、Itsukiの確認に結び付く（Issue #40の受入条件3）。 | 確認1のgate 3 exact digest承認、同一bytesでの昇格、Owner approval参照と承認recordを検証する。候補作成だけでは達成しない。 |
| AC40-04 | to-beとbaseの実装事実を区別でき、全行・変更節に担当Issueがある。 | `00cdea5`のsourceに戻れる根拠と各行・節の未実装／一部実装／実装済みの表示を確認する。 |
| AC40-05 | 正常時のOwner確認が2回にまとまり、5 gateの承認と2回の独立reviewを区別できる。 | execution-planのfixed mapping各1回、SKIP理由、停止位置、raw `A`要件を確認する。 |
| AC40-06 | 提案版のSHA-256がplanに一致し、昇格に追加の編集判断が要らない。 | 3ファイルのfresh SHA-256とplan、昇格先、昇格後のbyte比較手順を確認する。 |
| AC40-07 | auditに完全な初回依頼、出典、Fact / Inference / Gapが残り、stateはRequirements承認待ちである。 | Issue写しの完全一致、snapshot・delta-02・更新後のFront修正記録のSHA-256、status成功、承認recordなしを確認する。 |
| AC40-08 | 許可された候補作成の範囲を守る。 | `git status --short`と差分で`aidlc-docs/`以外のrepo変更がないことを確認する。 |

公開側の画面受入条件24項目、管理側7項目は提案版に保持する。それらは#41〜#47の実装受入であり、#40の文書候補作成によって画面検証済みにはしない。

## 5. Gapと後続で確かめること

- snapshotはnode・文言・frame寸法の原典である。見た目、viewport内の入力欄数、1操作での再生、実際の遷移・失敗を検証するものではない。今回`ui_route=none`。実装時の画面確認は各Issueで行う。
- 管理要件メモが明記する1440pxの不足4状態（下書き確認・保存直後・予約先・共通設定）、右に予約1件を開いた状態・取り置き追加と、モバイルMusicの映像一覧・作品/映像編集frameは追加の視覚根拠がない。既存frameと文章要件で範囲を追跡し、未描画を記録する。
- 本番データ・接続先・secret・Gmail到達・画像・実速度は調べない。#37の未検証事項を本作業で解消した扱いにしない。
- 一覧集計の採否確認は#46着手時、3項目のkeyと保存形式は#41のCode Generation Planへ残す。#40のOwner確認と混同しない。

## 6. 参照

- 原依頼全文・出典・node-id・snapshotと優先するdelta-02・更新後のFront修正記録のSHA-256: `aidlc-docs/audit.md`
- Workflow Plan: `aidlc-docs/inception/plans/execution-plan.md`
- 提案版と昇格手順: `aidlc-docs/construction/plans/aidlc-integration-code-generation-plan.md`
- canonical: `docs/specs/current/README.md`、`public-site-ui.md`（新設先）、`live-operations-admin-ui.md`、`system-design-principles.md`
- formal workflow: `docs/operations/AI_DLC_WORKFLOW.md`、`docs/DOCS_RULES.md`
