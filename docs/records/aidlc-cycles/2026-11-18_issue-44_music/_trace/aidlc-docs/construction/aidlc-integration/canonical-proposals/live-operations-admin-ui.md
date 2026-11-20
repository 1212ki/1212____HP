# 管理画面 UI 設計（Live運用・Site・News・Music・Profile）

- Status: Approved
- Owner: Itsuki Matsumoto
- Last updated: 2026-11-18
- Related issues: #39, #40, #37, #35, #33, #29
- Related implementation issues: #41, #46, #47（公開側の対応: #42, #43, #44, #45）、既存契約: #19, #20, #21, #22, #33, #35, #37
- Implementation baseline: origin/main `00cdea5e69d5b341fc0a2b21a4eece9a53c8a2cd`（以下`00cdea5`）
- Owner approval: Issue #44のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。active時は`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後は`docs/records/aidlc-cycles/2026-11-18_issue-44_music/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。
- Prior Owner approval（Issue #42）: Issue #42のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。active時は`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-42_home/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。
- Prior Owner approval（Issue #41）: Issue #41のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。active時は`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-41_data-fields/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。
- Prior Owner approval（Issue #40）: Issue #40のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。close済みの`docs/records/aidlc-cycles/2026-11-17_issue-40_figma-design-mapping/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する
- Prior Owner approval（Issue #37）: Issue #37のCode Generation Planに記載した本版の差分に対するItsuki Matsumotoのgate 3承認（本人回答`A`）。根拠はactive時の`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後の`docs/records/aidlc-cycles/2026-11-17_issue-37_ticket-autoreply-gmail/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`。本文反映後に承認済み差分との一致を検証する
- Prior Owner approval（Issue #35）: Issue #35のgate 3承認。根拠は`docs/records/aidlc-cycles/2026-11-16_issue-35_openai-reasoning-speed/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`
- Prior Owner approval（Issue #33）: APPROVED（Itsuki Matsumoto、2026-11-16T13:34:12+09:00、提示された本版のSHA-256 `8c9ceb61cbee4e897f8afad63245410c8bca69f5ea89c8e6a5b57e6f89038864` に対する本人回答 `A`）
- Prior Owner approval: 2026-08-17（Issue #29のstable Worker share URLによるOGP回帰復旧設計）
- Prior design review（Issue #33）: APPROVED（review-04、Issue #33の更新内容。blocking findingなし）
- Prior design review: APPROVED（Issue #22 AC0〜AC9、Issue #29 owner-approved design）
- Implementation gate: 本設計は実装の入力であり、Approvedはマスタの実装完了を意味しない。#40のgate 3承認後に同一bytesで昇格する。#41・#46・#47はそれぞれのformal cycleで実装を計画・承認する。確認1前の内容reviewと昇格後のbytes・記録reviewはFrontが手配する
- Prior implementation gate（Issue #37）: Issue #37はgate 1〜3の承認と、承認済みCode Generation PlanどおりのDraft→Approved反映を確認してから実装する。独立reviewは実装後に設計と実装をまとめて1回行い、gate 4〜5で結果を確認する。merge・production deployは別のOwner承認。Apps Script作成・公開とsecret登録はOwnerが行い、本番のメール到達はdeploy後にOwnerが確認する
- Prior implementation gate（Issue #35）: Issue #35のgate 1〜5、実装・検証・独立reviewの記録は`docs/records/aidlc-cycles/2026-11-16_issue-35_openai-reasoning-speed/`を参照する。本番の速度確認はdeploy後のOwner確認とする
- Prior implementation gate（Issue #33）: Issue #33の本版確認済み。実装・全回帰・独立review-07を完了し、Code Generation Resultは本人回答`A`で承認済み（2026-11-16T14:29:00+09:00）。Build/Test Resultは書式修正後の新digestに対する本人回答`A`で再承認済み（2026-11-16T14:52:21+09:00）。cycle完了記録は`docs/records/aidlc-cycles/2026-11-16_issue-33_ai-provider-fallback/`。canonical確認原典: context rootの`_scratch/codex-work/20261116-114342_1212hp-ai-provider-fallback/canonical-owner-confirmation.md`（prompt: 2026-11-16T13:33:01+09:00）。本文中の実装未着手という時点記述は確認時点の記録として保持する。本番反映は別のOwner操作

## 1. 目的

公開サイトとの対応を保ち、Itsukiがスマホを中心に、ライブの登録・告知・予約の管理を手間なく終えられる管理画面とする。Site・News・Music・Profileの更新も同じ操作の型に揃える。

実装: #46（よくする3つ）、#47（たまにする更新）、#41（追加項目）。`00cdea5`: Liveの一覧と編集・内部タブ・未保存確認は実装済み。マスタの表示・保存動作と5タブ・3項目は未実装。画面ごとの差と根拠は§15に示す。

## 2. 現行UI inventoryと解決する課題

本節のinventoryと課題はIssue #22の設計時点の記録を保持する。`00cdea5`ではLive workspaceと未保存guardが実装されており、下表をそのまま現行実装とはみなさない。今回の実装Issueは#41・#46・#47、base sourceで確かめた現状は§15を参照する。

### 2.1 現行UI inventory

| 対象 | 現行構造・状態 | desktop / mobile | Source |
|---|---|---|---|
| admin外枠 | `Site / News / Live / YouTube / Disco / Profile`のグローバルタブ。Liveが初期選択 | 横幅に関係なく同じタブ列 | `admin/index.html:22`、`admin/app.js:541` |
| Live一覧 | 開催予定と公演終了を縦に連続表示。各カードから編集modalを開く | 同一単一カラム | `admin/index.html:97`、`admin/app.js:834` |
| Ticket Page設定 | Live一覧の下に`details`として配置 | 開いた分だけ縦に伸びる | `admin/index.html:111` |
| 横断予約台帳 | Live一覧の下に`details`として配置。Live/status filterとCSVを持つ | 開いた分だけ縦に伸びる | `admin/index.html:158`、`admin/app.js:802` |
| Live編集container | 画面下から開く最大90vhのbottom-sheet modal | desktop/mobileとも全幅bottom sheet | `admin/index.html:247`、`admin/style.css:815` |
| 元情報・AI整理 | 編集modalの先頭に常時展開 | 新規/既存とも大きな入力面を占有 | `admin/app.js:1368` |
| 公開内容 | Live情報として全fieldを1本の長いformに表示 | 420px以下でfield rowが縦積み | `admin/app.js:1379`、`admin/style.css:1151` |
| X告知 | 公開内容の下に常時表示 | 入力・preview・actionが縦に続く | `admin/app.js:1445` |
| 個別予約 | X告知の下に常時表示。未保存/Local Modeではgateを表示 | 長いmodal末尾まで移動が必要 | `admin/app.js:1467`、`admin/app.js:2164` |
| 保存 | modal action後、API Modeは即API保存。Local Modeは一覧反映後にheader保存 | modeで完了状態が異なる | `admin/app.js:1659` |
| close / navigation | Escape・close・別グローバルタブへの移動にdirty guardなし | 入力破棄の可能性あり | `admin/app.js:541`、`admin/app.js:1620` |
| API読込失敗 | ローカルJSONをfallback表示するが`IS_API_MODE`は維持 | 見た目上編集可能でも保存は再びAPIへ向かう | `admin/app.js:514`、`admin/app.js:1901` |

### 2.2 課題構造

現行画面では、Live一覧、元情報の取込、公開内容の編集、X告知、個別予約台帳、横断予約台帳、Ticket Page設定が同じLiveタブと長い編集面に並ぶ。入力欄・セクション・ボタンの視覚的な強さも近く、次の問題が起きている。

| 観測事実 | ユーザー影響 | 原因仮説 |
|---|---|---|
| Live一覧、共通設定、横断予約が1つの縦面に並ぶ | 目的の操作へ移るまで画面を探す必要がある | 公開面と運用タスクのnavigation階層がない |
| 元情報、公開内容、告知、個別予約が1つの長いmodalに常時表示される | 入力項目が実数以上に多く見え、現在の仕事を見失う | 利用タイミングの違う領域をprogressive disclosureしていない |
| field、section、buttonの視覚的な強さが近い | 必須入力と補助操作を見分けにくい | 重要度・頻度ではなくcomponent種別だけでstyleが決まっている |
| desktopでも全幅bottom sheetと単一カラムを使う | 横幅を活かせず、一覧との文脈が切れる | mobile向けcontainerをdesktopへそのまま拡張している |
| 個別予約と横断予約が同じLive面の異なる位置にある | 1公演の確認か全体対応かを毎回判断する | scopeの違う台帳をnavigationで分離していない |
| API/Localで保存完了の意味が異なり、未保存移動guardがない | 公開済みか、JSON書き出し待ちか、破棄されるか判断しにくい | 保存状態を画面状態として設計していない |
| admin fieldと公開表示先の対応が画面上にない | 変更結果を予測しにくい | 公開情報と管理専用情報の所有関係が明示されていない |

## 3. 対象範囲

実装: #46（Live）、#47（Site・News・Music・Profileと5タブ）、#41（追加項目）。`00cdea5`: 既存項目の編集とLiveの型は一部実装済み。News・作品・映像の型統一とマスタ配置は未実装。

- adminのグローバルナビゲーションとLive入口
- Live一覧と開催状態
- Live新規登録・編集
- 元情報取込とAI整理の配置・provider自動切替（Issue #33）・OpenAIの考える量の最小化（Issue #35）
- X告知の準備・外部遷移
- Live単位の予約確認
- 全Live横断の予約管理
- Ticket Page設定への導線、案内・注意文の項目削除とGmailによる予約控え（Issue #37）
- desktop/mobileの情報階層
- Site・News・Music（作品と映像）・Profileの編集面、保存と未保存の確認の統一
- 顔にする作品、その場で再生する映像、種別と、共有時の画像の持ち方

### 非スコープ

- X APIによる自動投稿
- production deploy、認証、本番secret登録操作、DB構成の変更
- #19、#20、#21の実装そのもの
- 公開UIの実装（#42〜#45）、新しいkey名・保存形式の確定（#41のCode Generation Plan）、文書体系全体の再設計

## 4. 確定している設計判断

### 4.0 比較したアプローチ

| 案 | 概要 | 利点 | 欠点 | 判断 |
|---|---|---|---|---|
| A. adaptive master-detail | desktopは一覧＋編集、mobileは一覧→編集。公演内をタブ化 | 一覧の文脈を保ちつつ1公演へ集中でき、長大modalを解消できる | 画面構造とresponsive実装の変更量が中程度 | 採用 |
| B. 現行modalの整理 | bottom sheetを維持し、内部だけタブ・折りたたみ化 | 実装変更が小さい | desktopで横幅を活かせず、一覧との往復と長いoverlayが残る | 不採用 |
| C. Live編集を独立ページ化 | 一覧と編集を完全に別routeへ分離 | 編集領域を最も広く取れる | vanilla構成ではrouting・戻る操作・状態保持が過剰になる | 不採用 |

推奨案Aを採用する。公開サイト対応を保ちながら、desktopとmobileで同じ情報構造を異なるcontainerへ適応させる。

### 4.1 adminの外枠は公開サイトに合わせる

実装: #47。`00cdea5`: 6カテゴリが実装済みで、5カテゴリ化は未実装。公開側Musicは#44で扱う。

最終形のグローバルカテゴリは`Site / News / Live / Music / Profile`。YouTubeとDiscoをMusicへまとめ、作品と映像を内側で切り替える。#46はLiveの改修を先に行い、#47まで既存6タブを保つ。

告知や予約は独立したグローバルカテゴリにせず、Liveの内側に置く。

### 4.2 Live内は公開面と運用タスクの2層で整理する

実装: #46。`00cdea5`: Liveページ・予約管理・共通設定の分離は実装済み。共通設定の入口をマスタの一覧下へ揃える配置は未実装。

```text
Live
├── Liveページ
│   ├── 開催予定
│   ├── 公演終了
│   └── Ticket Page共通設定（低頻度action）
└── 予約管理
```

- `Liveページ`: 公開サイトに掲載する公演の管理
- `予約管理`: 全Liveを横断した受付・対応状況の管理
- `Ticket Page共通設定`: Live単位ではない共通設定のため、Live一覧の下の入口から専用の設定面を開く

公開サイトをmirrorするとは、public/adminのラベルを完全一致させることではない。公開面の情報所有関係を保ち、「どこを編集すると公開画面のどこが変わるか」を追跡可能にすることを指す。

### 4.3 Liveを選んだ後は1公演の仕事に集中する

```text
Live詳細
├── 公開内容
├── 告知
└── 予約
```

- `公開内容`: 公開ページに反映される情報の登録・編集
- `告知`: 公開内容を元にしたX告知preview、コメント、外部遷移、コピー
- `予約`: 対象Liveの予約数・予約者・手動受付

AI取込は独立タブにせず、`公開内容` の入力支援として置く。

### 4.4 公開情報と管理専用情報を表示上も分ける

実装: #46（Live）、#47（他の更新面）。`00cdea5`: 「公開画面に表示」「管理専用」の説明ラベルを出している。マスタの切り替え名で分ける形は未実装。

公開内容／告知／予約の切り替え名と入力の配置で、公開面と管理の仕事を区別する。公開・管理専用という設計説明のラベルは画面へ足さない。元情報・AI抽出状態・ひとこと・内部メモを公開情報へ混ぜないデータの境界は§5.1、§7・§8を保つ。

### 4.5 Desktop / Mobileのcontainer

実装: #46（Live）、#47（News・作品・映像等）。`00cdea5`: Liveだけに幅900pxを境にした一覧＋編集／一覧→編集が実装済み。News・作品・映像はmodalのまま。

- 390pxを先に設計し、1440pxは同じ内容を広げる。幅900px以上は左に一覧、右に編集面を置き、幅900px未満は一覧→編集に切り替える。
- Liveを開いたスマホの上の帯は「戻る・日付と会場・区分と保存状態」の1行と、公開内容／告知／予約の切り替えに絞る。入力欄を囲む枠は1重、切り替えは3等分にする。
- LiveだけでなくNews・作品・映像も汎用bottom-sheet modalをやめ、同じ一覧と編集の型に揃える。SiteとProfileも同じ見た目・保存状態にする。
- `予約管理`は全Liveのfilterと一覧。1440pxでは予約の行を押すと右に1件の備考・内部メモ・状態操作を開く。未対応の行には`対応済みにする`を置き、1件を開かずに状態を変えられる。390pxでは一覧から予約1件へ進む。取り置き追加は別の画面で行う。

### 4.6 保存と未保存状態

実装: #46（Live・削除・共通設定・保存直後）、#47（全タブへの統一）。`00cdea5`: Liveの明示保存とguardは実装済み。ボタン条件、削除・共通設定の独立保存、保存直後の告知入口、他タブの統一は未実装。

- 自動保存は採用しない。内容は明示的な`保存して公開`で保存し、そのまま公開サイトへ反映する。
- スマホのLiveの`保存して公開`は、未保存の変更がある時だけ下へ出す。公開内容だけでなく告知の「ひとこと」を変えた時も対象にし、変更がなければ出さない。幅1440pxでは見出しの右に置き、変更がない時は薄くして押せないようにする。保存中は押せず、失敗時は入力を残す。
- `公開内容 / 告知 / 予約`の内部タブ切替では入力を保持する。
- 未保存のまま別Live、Live一覧、グローバルタブへ移る場合は、`破棄して移動 / 編集を続ける`の確認を出す。
- News・作品・映像も、更新時にその場で保存する型から`保存して公開`と未保存の確認に揃える。Site・Profileを含め、確認なしに変更を失わせない。
- 新規Liveでは`告知 / 予約`をdisabledにし、初回保存後に利用可能にする。
- 新規Liveの保存直後は、告知内容と`Xで告知する`・`あとで`を出す。`あとで`は一覧へ戻る。保存とXへの外部遷移は別操作で、自動送信しない。
- Live削除は公開内容のいちばん下の文字に置く。確認後その場で保存し、公開画面からも消す。予約がある場合は確認に件数を出す。headerの別保存操作を待たせない。
- Ticket Page共通設定は、その画面の`保存して公開`で保存する。Liveの保存に混ぜず、上部の別保存操作を待たせない。
- 予約追加・予約status変更はLive内容とは別の即時操作とし、`保存して公開`の対象に含めない。
- Local ModeではLive編集の反映後、header actionを`JSONを書き出す`と表示し、API保存と区別する。

### 4.7 必須項目と開催状態

- 公開必須は`date`と`venue`。`title`は任意とする。
- `開催予定 / 公演終了`の正本は、保存先の`upcoming / past` collectionとする。
- 日付と選択区分が矛盾する場合は保存前にwarningを出すが、自動で区分を変更しない。
- 必須項目がない場合は`保存して公開`を行わず、対象項目の近くにerrorを表示する。

## 5. 公開画面とadminの対応

| 公開面 | admin入口 | 主な管理内容 |
|---|---|---|
| HomeのNext Live | `Live > Liveページ > 開催予定` | 次回Liveとして表示される公演の公開内容 |
| Live一覧（開催予定） | `Live > Liveページ > 開催予定` | 日付、会場、タイトル、出演、予約導線 |
| Live一覧（公演終了） | `Live > Liveページ > 公演終了` | 過去公演の表示内容 |
| Live詳細 | 対象Liveの`公開内容` | 日付、曜日、会場、タイトル、OPEN/START、料金、出演、画像、説明、リンク |
| Live詳細からの予約 | 対象Liveの`公開内容`と`予約` | 予約方式、予約URL、受付状態、対象Liveの受付状況 |
| Ticket Page | `Live > Liveページ > Ticket Page共通設定` | 完了文と表示項目。操作案内文・自動返信注意文の設定は持たない |
| X告知 | 対象Liveの`告知` | 公開内容から生成した告知、任意コメント、詳細URL |

### 5.1 Field matrix

| field | 区分 | 必須 | admin上の場所 | 公開先・用途 |
|---|---|---:|---|---|
| `date` | 公開 | 必須 | 公開内容 > 基本情報 | Home Next Live、Live一覧、Live詳細、Ticket Page |
| `venue` | 公開 | 必須 | 公開内容 > 基本情報 | Home Next Live、Live一覧、Live詳細、Ticket Page |
| `title` | 公開 | 任意 | 公開内容 > 基本情報 | Live一覧、Live詳細、告知 |
| `openTime` | 公開 | 任意 | 公開内容 > 公演情報 | Live詳細、告知 |
| `startTime` | 公開 | 任意 | 公開内容 > 公演情報 | Live詳細、告知 |
| `ticket` | 公開 | 任意 | 公開内容 > 公演情報 | Live詳細、告知 |
| `notes` | 公開 | 任意 | 公開内容 > 公演情報 | Live詳細、告知 |
| `performers` | 公開 | 任意 | 公開内容 > 出演者 | Live詳細、告知 |
| `description` | 公開 | 任意 | 公開内容 > 詳細設定 | Live詳細 |
| `image` | 公開 | 任意 | 公開内容 > 画像 | Home、Live一覧、Live詳細、OG |
| `ticketUrl` | 公開導線 | 任意 | 公開内容 > 予約導線 | 外部予約先。空なら内部Ticket Page |
| `link` | 公開導線 | 任意 | 公開内容 > 詳細設定 | 補助リンク。予約URLとは兼用しない |
| `reservationClosed` | 公開状態 | 任意 | 公開内容 > 予約導線 | 予約CTAとTicket Page受付可否 |
| `sourceText` | 管理専用 | 任意 | 公開内容 > 元情報から作成 | AI抽出元。public APIへ出さない |
| `xComment` | 管理専用 | 任意 | 告知 | X用任意コメント。public APIへ出さない |
| `upcoming / past` | 公開状態 | 必須 | 公開内容 > 公開区分 | Live一覧の開催予定 / 公演終了 |

### 5.2 Ticket Pageと予約控え（Issue #37）

申込者の手元に予約の控えを残し、同じ控えを運営にも届ける。Ticket Pageの案内文`introText`と注意文`noticeText`は項目ごと削除する。公開HTML・JS、admin設定・既定値・正規化、Worker既定値・正規化から外し、旧D1値は読み込み時に除外する。移行SQLで削除しない。完了ページの静的既定文とWorker・adminの既定`completeText`は「予約しました。」とし、保存済み`completeText`は従来どおり表示する。desktop/mobileとも同じ項目を外し、入力・確認・完了の構成と既存の表示項目設定を維持する。contactは変更しない。

公開予約の保存成功後、Workerは`TICKET_AUTOREPLY_FORM_URL`に`application/x-www-form-urlencoded`で`receipt_id`・`live`（日付と会場）・`name`・`email`・`quantity`・`message`・`token`をPOSTする。合言葉は`TICKET_AUTOREPLY_TOKEN`から読みbodyだけに入れる。URLか合言葉が未設定ならskipする。Apps Scriptは`1212ki.info@gmail.com`が所有し、実行者を自分として公開する。Script Propertiesの`TICKET_AUTOREPLY_TOKEN`との一致、6項目の存在（備考のみ空可）、単一e-mail、1〜10枚、重複parameterなしを検証してからGmailで送る。

件名は「ticket予約の控え | 松本一樹」、差出人表示名は「松本一樹 ticket」。宛先は申込者、BCCは固定の`1212ki.info@gmail.com`。本文は受付ID・ライブ・名前・e-mail・枚数・備考を含み、備考空は「なし」。宛先・BCC・件名・本文の任意指定は受け付けない。Apps Scriptの逐語コードと本文は`cloudflare/worker/apps-script/ticket-autoreply.gs`、Owner設定手順は同directoryの`README.md`を参照する。

予約保存と通知は既存の`ctx.waitUntil`で分離する。Workerはredirectの既定追従後、HTTP成功かつJSONの`ok: true`を送信処理の成功とする。通信・HTTP・不正応答・Gmail失敗でも予約APIは201のまま。手動取り置き（`source: manual`）では送らず、LINE処理は変えない。自動再送・送信状態DB・外部送信サービス・DNS設定・`@1212hp.com`差出人は追加しない。

個人Gmailの1日100宛先にはBCCも含まれ、1予約2宛先なら最大50件／日（他の送信分で減る）。超過時はメール失敗、予約成功となる。個人Gmailアドレスは申込者に見える。合言葉漏洩時は任意の宛先への固定書式メールと送信枠消費が可能になるため、OwnerがWebアプリ公開を停止し、Script PropertiesとWorker secretを更新する。合言葉・予約情報・上流応答本文はログや公開APIへ出さない。

検証はfetch stub、Apps Script実fileを読むNode VMとGmail stub、旧値入りD1 stub、公開/adminのHTML・DOM testで行う。受入条件は、公開成功後の6項目＋合言葉POST、合言葉と必須値による送信制御・申込者＋BCC・本文6項目、送信失敗時の予約成功と手動非送信、旧文言の非表示と保存済み完了文保持、canonical整合と全回帰成功である。gate 1〜3とgate 4〜5を2回のOwner確認にまとめ、gate 3が逐語canonical差分の確認を兼ねる。独立reviewは実装後1回で設計と実装を確認する。

Google側のPOST後302と最終応答は未観測で、stubは実到達を証明しない。Apps Script公開・secret登録・deploy後、Ownerが申込者と`1212ki.info@gmail.com`の両方への到達・差出人・内容を確認するまで本番受入は未検証とする。設定と公開はOwner操作。送信停止はWorker URL secretの解除とWebアプリ公開停止、漏洩時は合言葉更新を行う。rollbackはIssue #37の承認差分だけを対象にし、予約データ・LINE・contactを戻さない。

関連Issueは#37、実装計画はactive時の`aidlc-docs/construction/plans/aidlc-integration-code-generation-plan.md`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-37_ticket-autoreply-gmail/`を参照する。

### 5.3 Site・News・Music・Profileと追加項目

実装: #41（項目と日付・共有画像の表示名）、#47（編集面）、公開側#42〜#45。`00cdea5`: 既存項目は編集可能。新しい3項目、日付の形の検査、Music統合は未実装。根拠は要件メモ｜管理画面「新しく足す項目（3つ）」`39:825`・「変わらない項目」`39:828`。

| 管理する内容 | 持ち方・公開先 | `00cdea5`の事実 |
|---|---|---|
| Site > Home「顔にする作品」 | サイト設定に作品の番号を1つ。空は自動（最新のリリース）。Digital Releaseと宅録Demoから選べる。HomeとTicket完了で同じ作品を出す。 | 未実装。作品の既存collectionは`discography.digital / demo`。 |
| Music > 作品「その場で再生する映像」 | 作品ごとに登録済み映像の番号を1つ。空なら「聴く」を出さない。 | 未実装。登録済み映像は`youtube.musicVideos / liveMovies / demos`、`id`と`youtubeId`を持つ。 |
| Music > 作品「種別」 | 作品ごとに文字を1つ。任意入力で、公開画面ではタイトルと分ける。 | 未実装。タイトル内の文字を自動で分解・移行する決定はしない。 |
| Site > Home「共有時の画像」 | `site.heroImage`を保持する。#42以降のHomeは作品のジャケットを使い、この画像は表示しない。Live共有時の画像の予備としての働きは維持する。 | `site.heroImage`、WorkerのOG画像fallbackに使用。key名を変える決定ではない。 |
| Siteの既存項目 | Home Links（Bandcamp、YouTube、X、Instagram、note）、フッター文言、Contact導入文とForm Actionを保持。 | `site.links / footerText`、`contact.introText / formAction`。Ticketの削除済み項目とは別。 |
| News | 日付、タイトル、説明、画像、詳細リンクURL、リンクテキストを保持。 | `news`の既存項目。編集面・保存方式の統一は#47。 |
| Music 作品 | カテゴリ（Digital Release／宅録Demo）、タイトル、リリース日、説明（曲リスト等）、画像、リンクURLを保持。 | 作品の既存fieldsは`id / title / releaseDate / description / image / link`。 |
| Music 映像 | Channel URL、カテゴリ（Music Video／Live Movie／Demo）、タイトル、YouTube URL / IDを保持。 | `youtube.channelUrl`と各映像collectionの既存fields。 |
| Profile | 写真、プロフィールテキスト、SNSリンク（名前・URL）を保持。 | `profile.image / text / links`。本文は登録文をそのまま表示。 |

3項目はどれも空のままで公開画面が成立する。選んでいた作品・映像が削除された場合は参照を空に戻す。作品の選択が空なら最新のリリースへ戻り、映像の選択が空なら「聴く」を出さない。#41で固定したkey名・保存形式と保存互換性は本節末尾に示す。

「最新のリリース」はリリース日が最も新しい作品。日付の形が`2025.05.05`でない既存作品は最新候補から外し、並びの最後に回す。新しく保存する時に形が違えば保存せず項目下に示す。新しい必須項目は足さず、未入力で成立する条件を保つ。既存の日付を一括書換えする決定はしない。

#### Issue #41の保存契約と実装状態

本節はgate 3承認後の実装入力。`00cdea5`の事実列と§15の実装状況は比較時点の記録として保持する。#41の実装・試験・独立reviewの成否は、active時の`aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md`と`aidlc-docs/construction/build-and-test/build-and-test-summary.md`、close後の`docs/records/aidlc-cycles/2026-11-17_issue-41_data-fields/_trace/aidlc-docs/`内の同pathを参照する。本設計のApprovedだけで実装済みとはしない。

| 入力欄 | 保存先と空の表し方 | 参照する範囲 |
|---|---|---|
| 顔にする作品 | `site.featuredReleaseId`、作品の`id`を文字列で1つ。空は`""`。 | `discography.digital / demo`を合わせた作品。空は自動（最新のリリース）。 |
| その場で再生する映像 | 各作品の`playbackVideoId`、映像の`id`を文字列で1つ。空は`""`。 | `youtube.musicVideos / liveMovies / demos`を合わせた登録済み映像。`youtubeId`自体は保存しない。 |
| 種別 | 各作品の`releaseType`、任意の文字列。空は`""`。 | タイトルとは別の入力。タイトルを分解・移行しない。 |

欠けた新規keyは読込時に空として扱う。通常の保存で新規keyを出力し、既存データの一括移行や読込による既存行の書換えはしない。作品・映像のカテゴリを移しても`id`が同じなら参照を保つ。削除された作品への`featuredReleaseId`と、削除された映像への全作品の`playbackVideoId`は空に戻す。adminの削除直後とWorkerの保存時に参照先を照合する。選択解除は既存の保存操作で永続化し、削除だけを即時保存する型への変更は#47に残す。

日付を新しく保存する範囲は、新規作品と、既存作品の`releaseDate`を変更した時。日付を変えない他項目の保存や作品のカテゴリ移動では、既存の不揃い日付をそのまま保持する。空文字は引き続き任意入力として許可する。新規・変更後の空でない日付はASCII数字の`YYYY.MM.DD`（`^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$`）に合うことをadminと保存APIの両方で検査する。これは形の検査で、実在日・未来日等の新しい制約は加えない。不正なら保存せず、adminでは`「2025.05.05」の形で入力してください。`を対象の直下に表示し、入力を保持する。

自動選択は両作品collectionを合わせ、上の形に合う空でない日付だけを候補にし、日付文字列の降順で先頭を選ぶ。同日は元の配列順（digital、demoの順で連結）を保つ。候補なしは作品なし。並び用の処理は不揃い日付を末尾へ回すが、保存配列は並べ替えない。明示選択した作品は日付の形によらず優先する。#41ではこの選択・並びの共通処理と管理画面の選択肢までを用意し、公開画面へ適用するのは#42・#44（Ticket完了は#43）。

公開APIの`data`とLocal ModeのJSONには上記3項目を出す。`site.heroImage`のkey・画像操作・OG画像fallbackは保持し、表示名だけを「共有時の画像」にする。#41の段階では新規3項目の空／登録ありのどちらでも、既存公開画面の表示・配列順・Homeの画像の使い方を変えない。公開サイトとadminはGitHub Pagesの`main`・`/`配信なので、Itsukiはmerge前にPR最終版のtested revisionから新Workerをdeployし、その後にmergeする。mergeが新adminとhelperの公開を起動し、別の静的反映操作は行わない。新Workerは旧adminが省いた新規keyを既存の同一`id`から補う。明示的な空文字は選択解除として尊重する。mergeを見送る場合のWorker rollbackとmerge後の復旧手順は#41のCode Generation Plan §9に従う。

#### Issue #42公開時の説明

上の#41単独時の公開表示維持・deploy順序は#41の履歴である。#42はHomeで顔・種別・選択映像を使い始める。管理画面の共有時の画像はLive共有画像の予備で、Homeの帯を兼ねない。表示名・説明・READMEをこの実際の働きに揃える。key・画像操作・保存・Workerは変更しない。管理の6タブと作品modalは#47まで現状を保ち、公開ナビも#44まで6項目とする。#42はGitHub Pagesへの単独mergeで公開し、Worker deployは不要。失敗時は#42の静的変更と対応説明を同じrevertで戻し、#41の保存契約を維持する。

確認2の前にFrontがItsukiへ実際の1作品の種別・映像を選ぶ保存と、Siteの顔にその作品を選ぶ保存を頼む（保存済みなら入れ直さない）。#41の公開互換試験は3項目で現公開画面が変わらないことを保護するため、merge前に保存できる。確認2では本番公開データを直接読むbranchの新HomeをPC・スマホ用URLで出し、Itsukiが顔・種別・「聴く」の実音・「閉じる」を確認する。fixture撮影と分け、本番データをrepoへ保存しない。merge後はFrontがPages buildと公開Homeの新版配信をread-only確認し、差がある時だけItsukiへ返す。同じデータ・画面の2回目の本人確認は頼まない。保存した3項目はmerge見送り時もrollback時もそのまま保持する。

#### Issue #44と公開側まとめ出し時の対応

#44の公開Musicは`/music/`で作品と映像を統合する。管理の実タブは#47までSite / News / Live / YouTube / Disco / Profileを保つ。作品の種別・再生映像はDiscoで作品カードを押した「Discography編集」、映像とChannel URLはYouTubeから編集する。上の表のMusic > 作品/映像は最終形の設計上の名称であり、#47前の実タブ名ではない。`admin/README.md`の案内をこの実態へ揃え、タブ・入力・保存・key・Workerは#44で変更しない。

公開側#43・#44・#45はOwner決定（2026-11-18）により`feature/39-public-pages`へ集約してからmainへ1回で出す。#44のPR mergeでは本番も管理のタブも変わらない。公開ナビ5項目と管理6タブが併存する状態で文言と働きを照合する。#42の単独公開手順は履歴として保持する。#44の確認2前にはFrontが本番公開データでMusicの表示・再生を確認し、Itsukiの追加保存を不要とする。復旧は#44の公開差分と説明を同じ単位で戻し、保存済みデータは保持する。

## 6. 情報の優先順位

実装: #46（Live）、#47（たまにする更新）。`00cdea5`: 上部の複数の帯、折りたたみ内の画像、常時表示の保存・削除、集計なしの一覧がある。以下のマスタ配置は未実装。

### Liveを開いた時に見せるもの

- スマホの上は「戻る・日付と会場・区分と保存状態」の1行と、公開内容／告知／予約の切り替え。予約の切り替えには枚数を出す。
- 公開内容はフライヤーをいちばん上に置き、選ぶ・変える・外す操作を置く。続けて日付、会場、ライブ名、OPEN/START、料金、補足、共演者を見せる。必須は日付と会場だけ。
- `予約先・リンクなど`（予約URL・受付終了・リンク・説明）と`元情報から作り直す`は折りたたむ。区分と削除は下へ置く。
- スマホの`保存して公開`は未保存の変更がある時だけ下へ出す。告知の「ひとこと」の変更も含み、変更がない時は出さない。幅1440pxでは見出しの右に置き、変更がない時は薄くして押せないようにする。削除は固定せず公開内容の末尾の文字にし、告知と予約の画面に出さない。

### 新しいライブ・告知・予約

- 新規登録は`+ 新しいライブ`→元情報を貼る→`下書きを作る`→下書きを確かめる→`保存して公開`→保存直後の告知内容と`Xで告知する`へ進む。`手入力で作る`も選べる。フライヤーは下書きを確かめる画面の先頭で選び、下書きは貼った文字だけから作る。未保存の告知・予約は「保存すると使えます。」とする。
- 告知はひとこと、既存規則による投稿preview、`Xで告知する`、投稿文・リンクのコピーを見せる。§7のprovider表示と§8の生成・共有URL契約は保持する。
- §8の`Xを開く / 詳細をコピー`は、マスタの`Xで告知する / 投稿文をコピー`と同じ操作を指す。表示名を揃え、投稿内容・共有URL・保存を起こさない性質は保つ。
- 予約は枚数・件数・未対応等の状態、一覧、予約1件、取り置き追加を分ける。スマホは1件を開いて状態を変える。幅1440pxでは行を押すと右に1件の備考・内部メモ・状態操作を開き、未対応の行の`対応済みにする`では開かずに状態を変えられる。枚数と件数にキャンセルを含めない。内部メモは追加時に入力し、その後は表示のみ。状態変更は即時反映し、`未対応に戻す`も残す。
- 一覧の予約枚数と未対応件数は**入れる。外せる**。開催予定だけに表示し、API接続失敗・Local Modeでは出さない。今は一覧で数を取る仕組みがなく、新しくLiveごとの集計を返す処理が必要。**#46着手時にItsukiへ入れるかを確かめる**。この確認を#40で済ませた扱いにしない。

### たまにする更新

Site・News・Music・Profileは、一覧と編集、保存して公開、未保存の確認をLiveの型に揃える。保持する項目と公開先は§5.3、画面とマスタは§15を参照する。画面には実際に表示する文言だけを置き、設計の理由や新旧の区別を載せない。

## 7. AI整理の位置づけ

- 元情報を保持し、その内容を抽出の入力とする。
- 既存フィールドに値があっても、明示的にAI整理を実行した場合は対象項目を再抽出する。
- 抽出対象、全置換する項目、保持する管理専用情報を設計とテストで固定する。
- 抽出結果は保存前に確認でき、失敗しても現在の入力と元情報を失わない。
- 詳細な抽出・置換仕様はIssue #21で扱う。

Issue #33のprovider自動切替と#21の抽出・置換内容を保持し、Issue #35ではOpenAI requestの`reasoning.effort`だけを`minimal`にする。Issue #33の承認・実装経過は完了cycleを参照する。

### 7.1 入力とproviderの順序（R1・R2）

`POST /api/admin/live-source-intake`は管理Bearer認証、request JSON、trim後1〜12,000文字の`sourceText`を検証してからproviderを呼ぶ。認証失敗は`401`、JSONまたは入力不正は`400`で、どちらのproviderも呼ばない。

| 設定されたsecret | 呼出順 |
|---|---|
| `OPENAI_API_KEY`と`ANTHROPIC_API_KEY` | OpenAIを1回試し、検証済みdraftなら終了。失敗した時だけClaudeを1回試す |
| `OPENAI_API_KEY`だけ | OpenAIを1回だけ試す |
| `ANTHROPIC_API_KEY`だけ | Claudeを1回だけ試す |
| 両方なし・空・空白のみ | 外部APIを呼ばず`503` |

OpenAI側のHTTP非2xx（認証、クレジット切れ、rate limit、4xx・5xx）、通信失敗、timeout、refusal、incomplete、空出力、上流JSON不正、抽出JSON不正、schema不正、`validateLiveAiDraft`不合格はすべて切替対象とする。HTTP `200`だけでは成功としない。両providerには最初に確定した同じ`sourceText`を送り、既存fieldや途中結果を混ぜない。

各provider最大1回、合計最大2回とする。失敗状態を記憶せず、次の整理でも設定されたOpenAIを先に試す。残高照会、同一providerへのretry、全体期限後の新しい呼出しは行わない。

### 7.2 共通の抽出・検証と一括反映（R3）

- `LIVE_AI_INSTRUCTIONS`と`LIVE_AI_OUTPUT_SCHEMA`は内容を変えず両providerで共有し、どちらの結果も既存の`validateLiveAiDraft`を通す。
- 抽出対象は`date`、`title`、`venue`、`openTime`、`startTime`、`ticket`、`notes`、`performers`、`ticketUrl`、`link`の10項目だけとする。型、文字数、実在日付、時刻、URLの検証を保持する。不明値は空文字で、空文字も全置換する。
- #21の内容を保持し、`notes`は`※`なしの1補足1行、`performers`は松本一樹／1212本人を除く共演者だけを`w.`なしの` / `区切りとする。共演者なしは空文字で、`description`は生成しない。
- 成功時は10項目と告知previewを一括更新し、保存前に管理者が確認する。AI整理は保存・公開・X送信・DB更新を起こさず、元情報と対象外の情報を保持する。
- 両provider失敗、payload不正、反映途中の例外、待機中の入力変更、別Liveへの移動後の応答は§10.1に従って現在の編集内容を保持する。

### 7.3 待ち時間の上限（R4）

入力検証後のprovider処理開始から、fetch、body受信、JSON解析、draft検証を含め全体`30,000 ms`とする。OpenAIは最大`15,000 ms`、Claudeは最大`15,000 ms`かつ全体の残り時間以内とする。単一keyでもそのproviderは最大15秒で、Claude開始時に全体期限をリセットしない。

既存のOpenAIの15秒枠を保ち、切替先にも同程度の枠を与えつつ、管理者の待機を約30秒以内に収める。期限後の成功は採用せず、外部fetchをabortし、body停止やabortに協調しない処理でも待機を打ち切る。

30秒はWorker内の処理予算で、ブラウザとの通信遅延、入力upload、event loop停止を含む厳密なend-to-end保証ではない。実APIの速度と初回schema compilationによる成功率は未計測である。

### 7.4 成功応答と小さいprovider表示（R6）

新しい成功応答のtop-levelは`draft`と`provider`で、`provider`は`openai`または`claude`だけとする。10項目schemaには追加せず、失敗応答にもprovider、失敗履歴、モデル名を加えない。

管理画面は反映成功後だけ、既存の`live-source-warnings`へ固定の対応表と`textContent`で次を表示する。desktop/mobileとも既存の`.parse-warnings`（`font-size: 0.85em`）を使う。

| 成功応答のprovider | 表示 |
|---|---|
| `openai` | OpenAIで整理しました。内容を確認してから更新してください。 |
| `claude` | Claudeで整理しました。内容を確認してから更新してください。 |

Claude表示は今回成功したproviderを示す。OpenAIのクレジット切れの確定診断には使わない。整理中、失敗、入力変更による未反映、editor切替では今回の成功providerを表示しない。providerは管理用の一時表示とし、Liveデータや公開画面へ保存しない。

新adminは旧Workerの`draft`だけの応答も受理し、「AIで整理しました。内容を確認してから更新してください。」と表示する。providerを推定しない。provider付き応答は上記enum以外の値・型、および余分なtop-level keyを拒否し、全項目を不反映とする。

### 7.5 設定、公開順序、rollback（R7）

| provider | Worker secret | 任意のモデル変数 | 未設定・空白時の既定モデル | requestで指定する考える量 |
|---|---|---|---|---|
| OpenAI | `OPENAI_API_KEY` | `LIVE_AI_MODEL` | `gpt-5-mini` | `reasoning.effort: "minimal"` |
| Claude | `ANTHROPIC_API_KEY` | `LIVE_AI_CLAUDE_MODEL` | `claude-haiku-5-5` | `output_config.effort: "low"` |

管理者が画面で待つ操作で、元情報から10項目を抽出する処理のため、OpenAIの考える量を`minimal`（最小）に固定する。既定モデル・抽出指示・schema・validator・provider順・各15秒／全体30秒の期限・エラー分類・画面表示は変更しない。`LIVE_AI_MODEL`で上書きしたモデルにも同じ指定を送り、非対応モデルがHTTP 400を返した場合は既存の失敗時切替を使う。Claudeが設定され利用可能ならClaudeの結果を返し、Claude未設定なら既存の失敗応答になる。

新しい設定UI・モデル選択UI・SDK依存は追加しない。API接続先の切替fallbackを追加せず、`allowBaseFallback: false`を維持する。

Ownerが本番反映する際は新admin→新Workerの順にする。既存adminタブを再読込し、新adminが読み込まれ、旧Workerの`draft`だけの応答を受理できることを確認してからWorkerを更新する。旧adminはprovider付き応答を拒否するため、開いたままの旧タブを残すと適用できない。rollbackはWorkerを旧応答へ戻し、その後に必要に応じてadminを戻す。

## 8. X告知の位置づけ

- 親投稿と詳細投稿を別々の情報として編集しない。
- Liveの公開内容を元に、日付・曜日・会場・タイトル・OPEN/START・料金・出演が分かる1つの告知previewを作る。
- 管理者の任意コメントは告知本文とは別に入力し、最終投稿時に組み合わせる。
- `Xを開く`、`詳細をコピー`、`リンクをコピー` は同じ操作群としてコンパクトに配置する。
- 詳細テンプレートと操作仕様はIssue #19・#20で扱う。

### 8.1 Live share URLとcanonical detail URL

Live固有OGPを取得する共有入口と、人が最終的に閲覧する公開詳細を別の責務として固定する。

| URL | 形式 | 責務 |
|---|---|---|
| stable share URL | `https://1212hp.itsukimatsumoto.workers.dev/og/live/:liveId` | X crawlerを含む共有アクセスへ、Live固有のOG/Twitter metadataを初期HTMLで返す |
| canonical detail URL | `https://1212hp.com/live/detail/?liveId=...` | Worker HTMLのcanonical、`og:url`、人が到達する公開Live詳細 |

- `:liveId`とqueryの`liveId`は、同じ保存済みLive IDを`encodeURIComponent`した値とする。
- 保存済みLiveのX投稿preview、X Web Intent、「リンクをコピー」は、すべて同一のstable share URLを共有文字列として使う。
- stable share URLはadminの固定Worker originを正本にし、実行中に切り替わり得るAPI接続先やcanonical detail URLへfallbackしない。
- stable share URLにcache-bust用のquery parameter、timestamp、versionを付けない。
- WorkerはLive固有の`og:title`、`og:description`、`og:image`と対応する`twitter:*`を初期HTMLで返す。canonical linkと`og:url`はcanonical detail URLを指す。
- human UAにも同じWorker HTMLを返し、JavaScript redirectでcanonical detail URLへ移動する。redirectできない場合は`詳細を見る`リンクをfallbackとする。
- canonical detail URLは共有文字列としてX投稿preview、Web Intent、clipboardへ直接入れない。ただしWorker metadataとhuman destinationとして維持する。

## 9. Desktop / Mobile wireframe

実装: #46（Live）、#47（5タブと他の編集面）。`00cdea5`: Liveの一覧＋編集構造は実装済み。以下のマスタ配置・5タブ・保存条件は未実装。寸法・色・文字・余白はマスタと既存rules/tokensで決め、ここで新しい値を足さない。

### Desktop

```text
[1212 Admin] [接続状態]       [Site News Live Music Profile]

Live
[Liveページ] [予約管理]                         [+ 新規Live]
[開催予定] [公演終了]

┌ Live一覧 ──────────┬ 選択中Live ─────────────────────┐
│ ● Next Live          │ 2026.8.10(月) 下北沢おてまえ   [保存して公開] │
│ 8/10 下北沢...       │ 未保存 / 公開中                  │
│ 8/23 渋谷...         │ [公開内容] [告知] [予約]           │
│                      │                                  │
│ 予約の枚数・未対応    │ フライヤー                         │
│                      │ 日付｜会場｜ライブ名               │
│                      │ OPEN｜START｜料金｜補足｜共演者     │
│                      │ [予約先・リンクなど ›]             │
│                      │ [元情報から作り直す ›]             │
│                      │ 区分／このライブを削除             │
│ [Ticket Page共通設定] │                                  │
└──────────────────────┴──────────────────────────────────┘
```

- `保存して公開`は見出しの右。変更がない時は薄くして押せない。公開内容と告知の「ひとこと」の未保存変更を対象にする。
- 編集面の最大幅を制限し、入力欄を意味のある組で横並びにする。
- 主要actionと補助actionのサイズ・強さを分ける。
- Liveの`予約`と`予約管理`の一覧では、行を押すと右に1件の内容（備考・内部メモ・状態操作）を開く。未対応の行には`対応済みにする`を置き、開かずに状態を変えられる。`予約管理`には全Liveのfilterも表示する。右に1件を開いた専用frameは未作成。

### Mobile

```text
[1212 Admin] [接続]
[Site News Live Music Profile]

Live
[Liveページ] [予約管理]
[開催予定] [公演終了]        [+]
[日付・会場  ›]
[予約の枚数・未対応]
[Ticket Page共通設定]

選択後:
[‹ 一覧｜日付と会場｜区分・保存の状態]
[公開内容] [告知] [予約 枚数]

公開内容
[フライヤー]
[日付]
[会場]
[ライブ名]
[OPEN] [START]
[料金]
[補足]
[共演者]
[予約先・リンクなど ›]
[元情報から作り直す ›]
[区分]
このライブを削除

[保存して公開]（未保存の変更がある時だけ下へ）
```

- 主要actionは到達しやすくするが、補助actionまで全幅・大型にしない。
- 長いフォームを一度に見せず、現在のタスクを明確にする。

## 10. 状態・失敗時の原則

- `未保存 / 保存中 / 保存済み / 保存失敗`を選択中Liveの近くに表示する。
- 保存とXを開く操作は別状態として扱う。
- AI抽出失敗時は既存入力と元情報を保持し、warningと再試行を提供する。
- API接続に失敗してローカルJSONをfallback表示する場合はread-onlyとし、保存・AI整理・予約変更を無効化する。Local Modeとして明示的に起動した場合のJSON書き出しとは区別する。
- 外部遷移やclipboard失敗は対象ボタンの近くで通知する。
- 未保存LiveまたはIDなしではstable share URLを生成せず、X Web Intentとリンクコピーをdisabledにする。clipboard、fallback、保存処理は呼ばない。
- Clipboard API失敗時は既存のcopy fallbackを使い、fallbackの成否を既存toastで通知する。入力値と保存状態は変更しない。
- WorkerでLiveが見つからない場合は`404`と`Cache-Control: no-store`を返し、canonical detailやgeneric cardへ暗黙fallbackしない。
- human redirectが実行できない場合はWorker HTML内のcanonical detailリンクを利用できる状態を維持する。
- X側のplatform cache失敗を理由にshare URLへcache-bustを追加しない。origin responseとplatform cacheを分けて検証する。

### 10.1 AI整理の失敗・応答競合（R3〜R6）

| 条件 | HTTP | 固定の`error` |
|---|---:|---|
| 管理認証失敗 | 401 | `unauthorized` |
| JSONまたは`sourceText`不正 | 400 | `invalid sourceText` |
| 両providerのsecret未設定 | 503 | `AI source intake is not configured` |
| 全体期限到達、または最後に試したproviderがtimeout | 504 | `AI source intake timed out` |
| 利用できるproviderがすべて失敗し、上記timeoutに該当しない | 502 | `AI source intake failed` |

OpenAI timeout→Claude成功は`200`、OpenAI timeout→Claude HTTPエラーなどの失敗は`502`、Claudeもtimeoutなら`504`とする。単一providerでも同じ分類を使う。APIキー、providerのエラー本文、request ID、抽出プロンプトをクライアントへ返さず、新たなrawログへ出力しない。

失敗時は10項目・告知preview・元情報をそのまま保持し、反映途中の例外にもrollbackする。待機中に元情報または対象入力が変わった場合や別Liveへ移った場合は、古い応答を反映せず現在の編集を保つ。逆順応答、重複click、保存中の排他は既存のrequest snapshotとeditor ownershipで扱い、provider成功を誤表示しない。

## 11. Issue境界

- Issue #22はLive workspace、master-detail、内部タブ、progressive disclosure、保存状態、responsive構造を実装する。
- Issue #19は統合X投稿previewとテンプレート内容を実装する。#22では既存preview内容を変えない。
- Issue #20は詳細URLコピーとX操作ボタンのcompact化を実装する。#22では新しいURL操作を追加しない。
- Issue #21はAI抽出と10項目全置換を実装する。#22ではAI処理・prompt・置換挙動を変えない。
- #19〜#21のworktreeと同じファイルを触る場合も、各Issueのbehaviorを先取りしない。
- Issue #29は、保存済みLiveのX投稿preview、Web Intent、リンクコピーをstable Worker share URLへ復旧し、既存Worker OGP routeの契約をcharacterization testで固定する。production変更は`admin/app.js`のshare URL helperとそのX／リンクコピーcall siteだけに限定する。
- Issue #29ではWorker source、公開Live詳細、DNS/CDN/hosting、Issue #19/#21、generic admin UIを変更しない。merge、production deploy、X cache refreshも行わない。
- Issue #29のowner-approved設計は、`docs/plans/2026-08-16-issue-20-live-link-actions-ogp.md`に残る「canonical detail URLを共有する」「Worker share URLへ戻さない」という過去判断だけをsupersedeする。Issue #20の計画自体は履歴として書き換えず、compact action、unsaved gate、clipboard fallback、save-free behaviorは維持する。
- Issue #33はAI整理endpoint内のprovider順序・自動切替・期限・成功応答と、adminのpayload互換性・成功provider表示を拡張する。#21の抽出指示・10項目・検証・一括反映と、#29のstable share URL・canonical detail URL・save-free契約は保持する。
- Issue #33では失敗状態の記憶、残高照会、Claude先行、provider手動切替UI、抽出内容変更、DB・認証・予約・X共有・公開ページの変更を行わない。本番secret登録、production deploy、mergeは別のOwner操作とする。
- Issue #33の3計画承認と、更新した本設計のOwner確認は別に記録する。本設計と索引が`Draft`の間はcode・test変更を開始しない。

### 11.1 Issue #22の実装段階

| 順序 | 実装単位 | 独立して確認する価値 | 主な検証 |
|---:|---|---|---|
| 1 | Live workspace navigation | `Liveページ / 予約管理`と`開催予定 / 公演終了`を迷わず切り替えられる | DOM contract、keyboard/ARIA、既存一覧・filter回帰 |
| 2 | adaptive master-detail | desktopで一覧文脈を保ち、mobileで一覧→編集へ集中できる | breakpoint contract、選択・戻る・focus restoration |
| 3 | 公演内task tabsとprogressive disclosure | 公開内容、告知、個別予約を必要時だけ表示できる | tab semantics、入力保持、新規Live gate、既存handler回帰 |
| 4 | validation・dirty guard・保存状態 | 必須不足、区分矛盾、未保存移動、API fallbackを安全に扱える | RED→GREEN unit/DOM test、API/Local mode回帰 |
| 5 | visual densityとresponsive refinement | 主要actionと補助actionの優先順位がdesktop/mobileで伝わる | CSS contract、overflow、focus、manual responsive review |

実装は1→5の順で行う。各段階でfocused testを通し、#19〜#21の既存behaviorを変えていないことを確認してから次へ進む。

### 11.2 Issue #40〜#47の分担と実装時点

`00cdea5`を比較基準とする。#40は設計書とマスタの対応づけだけを行い、#41〜#47を先に実装しない。

| Issue | 実装する範囲 | `00cdea5`で実装済みか |
|---|---|---|
| #41 | 3項目、日付の形、削除した参照を空に戻す処理、共有時の画像の表示名。既存編集面へ足す。 | 未実装。§5.3。key名・保存形式は同IssueのCode Generation Plan。 |
| #42〜#45 | Home・共通、Live・Ticket、Music・5項目ナビ、Profile・Contact。 | 既存公開ページはある。マスタの追加・変更は未実装。`public-site-ui.md`。 |
| #46 | Liveのスマホの帯・フライヤー・保存と削除・保存直後・一覧集計・予約1件と取り置き・共通設定の保存。 | Liveの型と受付機能は一部実装。マスタの変更分と一覧集計は未実装。外枠の6→5タブはここでは変えない。 |
| #47 | 5タブ、News・作品・映像の一覧と編集、保存とguard、Site・Profileの見た目。 | 未実装。#41の項目、#44の公開Music、#46のLiveの型のあとに揃える。 |

## 12. Acceptance Criteria

- 公開サイトの各Live表示とadminの編集入口・fieldを追跡できる。
- Live一覧、1公演の公開内容、告知、個別予約、横断予約を混同せず移動できる。
- desktopは一覧＋編集、mobileは一覧→編集として同じ情報構造を利用できる。
- 常時表示、タスク選択時表示、条件表示の区別がwireframeで確認できる。
- `date / venue`の必須validation、開催区分warning、未保存移動guardが定義どおり動く。
- 保存が`保存して公開`として明示され、外部送信・予約即時操作と混同されない。
- X告知、詳細URLコピーは#19・#20の既存behaviorを維持し、#20の共有URL判断だけが#29によりsupersedeされている。AI整理は#21の抽出・全置換内容を維持し、providerの呼出しと表示だけを#33により拡張する。
- Itsuki確認後にStatusが`Approved`へ更新されている。
- 実装Issueとplanがこの設計書を参照している。
- share URLとcanonical detail URLの責務が分かれ、保存済みLiveのX投稿preview、Web Intent、リンクコピーが同一のstable Worker share URLを使う。
- Worker HTMLのcanonical、`og:url`、human destinationはcanonical detail URLを維持し、共有文字列にはcanonical detail URLもcache-bustも混入しない。
- unsaved gate、clipboard fallback、save-free behaviorと既存Workerのmetadata／human fallbackをautomated testで観測できる。

### 12.1 Issue #33の受入条件

以下は実装後の受入条件であり、本版更新時のPASSを意味しない。IDは承認済みRequirementsと対応する。

| ID / 要件 | 合格にする観測 |
|---|---|
| AC-01 / R1・R3・R7 | 両keyでOpenAI成功なら`provider=openai`、Claude呼出0回。指示・schema・モデル設定と正規化済み10項目が変わらない |
| AC-02 / R1・R2・R3 | OpenAIの全失敗分類で同じsourceTextをClaudeへ1回送り、合格時は`provider=claude`。次のrequestは再びOpenAIから始まる |
| AC-03 / R1 | keyの4構成・空白値が§7.1どおり。両keyなしは503、401/400時は2社とも呼出0回 |
| AC-04 / R3・R5 | 単一・両provider失敗とtimeoutの組合せが§10.1どおり。10項目・preview・元情報を保持し、反映例外にもrollbackする |
| AC-05 / R4 | fake clockで単一provider各15秒、全体30秒、残余予算、body停止、abort非協調、期限後成功の棄却、timer/listener解放を確認する |
| AC-06 / R6・R7 | 小さい固定provider表示が成功時だけ出る。旧応答は中立文言、未知providerは一括不反映。入力変更・editor交代・stale responseで成功を誤表示しない |
| AC-07 / R5・R6 | 両社の成功・失敗でsecret、providerエラー本文、request ID、promptをresponseへ漏らさず、UIは固定文言だけを使う |
| AC-08 / R1〜R7 | 共通validator、一括反映、editor ownership、Local Mode、custom API base、`allowBaseFallback: false`、save-freeを含むfocused testと全回帰がPASS |
| AC-09 / R7・承認境界 | 実装前に本設計・索引・Worker READMEを揃え、変更後canonicalのOwner確認を得る。5 gateは各artifactのexact digestと結び付ける |

### 12.2 Issue #35の受入条件

| ID / Issue本文の受入条件 | 合格にする観測 |
|---|---|
| AC-35-01 / 1 | OpenAI outbound bodyに`reasoning: { effort: "minimal" }`があり、既定・上書き・空白モデルでfocused testがPASSする |
| AC-35-02 / 2 | 他のOpenAI request field、Claude側、provider順、各15秒／全体30秒、エラー分類、管理画面表示、抽出指示・10項目schema・validatorが変わらず、既存testと全回帰がPASSする |
| AC-35-03 / 3 | 本設計・索引・Worker READMEが承認済みCode Generation Planの差分と一致する。gate 3が本差分のOwner確認を兼ね、別のcanonical確認を挟まない |
| AC-35-04 / 4 | Ownerがdeploy後に同じ元情報で試し、「OpenAIで整理しました」と表示され、従来より待ちが短いと確認する |

AC-35-04はdeploy後のOwner確認として残す。mock testやcycle closeで本番の成功・速度を証明した扱いにしない。

### 12.3 Figmaマスタの受入条件（Issue #40で対応づけ）

実装: #46・#47（項目は#41）。`00cdea5`: 既存項目・一部のguardは実装済み。以下のマスタの画面条件は未検証。「要件メモ｜管理画面」`39:817`の「受入条件」`39:837`を項目ごとに転記し、IDを後続の計画・テストで使う。

| ID | 受入条件（要件メモ原文） | 実装Issue |
|---|---|---|
| ADM-40-01 | 幅390pxでライブを開いた時、最初の画面に入力欄が3つ以上見えている。 | #46 |
| ADM-40-02 | 新しいライブの登録は、元情報を貼ってから告知まで、押すボタンは3つ（下書きを作る → 保存して公開 → Xで告知する）。 | #46 |
| ADM-40-03 | 未対応の予約があるかどうかが、一覧を開いただけで分かる。 | #46（入れる。外せる。着手時にItsuki確認） |
| ADM-40-04 | 「保存して公開」「開催予定」「公演終了」が、幅390pxで1行に収まる。 | #46 |
| ADM-40-05 | 今の管理画面で編集できる項目が、すべて残っている（Home Heroは「共有時の画像」として残る）。 | #41, #46, #47 |
| ADM-40-06 | 新しい3項目を空のままにしても、公開画面が今と同じ情報を出せる。 | #41、公開#42〜#45 |
| ADM-40-07 | 未保存の変更が、確認なしに消えることがない。 | #46, #47 |

ADM-40-05の#41分は既存入力の保持と共有画像の表示名、ADM-40-06の#41分は3項目が空／登録ありでも既存公開表示が変わらないこととする。#46・#47の画面受入や未保存guardの完了は含めない。#41の実装状態は§5.3末尾の結果参照で確認する。

既存§12・§12.1・§12.2の受入条件は維持する。#37のTicketとメールは§5.2、共有URLは§8・§10、AI整理は§7・§10.1に従う。#40の文書確認は本番の成功や画面条件の合格を意味しない。

## 13. 検証方法

- 現行adminと公開サイトのsource inventoryとの突合
- desktop/mobile wireframe review
- 主要タスク別のwalkthrough
- #19・#20・#21との仕様境界review
- 実装時のUI contract test、responsive確認、主要操作のmanual verification
- admin focused testで、現行canonical detail共有契約に対するREDとstable Worker share URLへのGREENを同一commandで確認する。
- Worker UA testは既存routeのcharacterizationとしてproduction変更前からPASSすることを確認し、REDには数えない。
- root全test、Worker全test、syntax、diff、scope、secret監査を実行する。
- owner merge／deploy後にのみ、同じstable share URLへTwitterbot UAとhuman UAでread-only requestを送り、Live固有metadata、canonical、human導線を確認する。origin responseとX platform cacheは別々に判定する。

### 13.1 Issue #33の検証

本版のOwner確認後、承認済みCode Generation Planの順序でfocused testをRED→GREENにし、§12.1をmock API・fake clock・既存DOM testで検証する。実APIやlive secretを使わず、deadlineとbody停止、両社のsanitize、stale/rollback、旧payloadとの互換性を観測する。desktop/mobileのprovider表示は既存markupとCSSの同じstatus欄を確認する。

```bash
node --test cloudflare/worker/test/live-ai-source-intake.test.js
node --test --test-name-pattern='AIで整理 source intake' test/admin-live-operations.test.mjs
node --test test/admin-live-operations.test.mjs
node --test test/
npm --prefix cloudflare/worker test
node --check cloudflare/worker/src/worker.js
node --check admin/app.js
scripts/aidlc-verify.sh --local
git diff --check
git status --short
git diff --stat
```

current canonicalとR1〜R7の整合は独立Reviewerが確認し、Ownerのcanonical確認・Code Generation Result・Build/Test Result・Front受入を区別して記録する。mock PASSは本番key、credit、model entitlement、実速度、初回schema compilationの成功を証明しない。

### 13.2 Issue #35の検証

gate 1〜3承認後、Code Generation Planに固定した差分を本設計・索引・Worker READMEへ反映してから、既存Worker focused testにrequest bodyのassertionを加えてRED→GREENを確認する。Node v20.19.4で§13.1のfocused・全回帰・syntax・local integrity・scope確認を行い、実装後の独立Reviewerが設計・実装・承認済み差分の一致をまとめて確認する。Owner確認はgate 1〜3とgate 4〜5の2回にまとめる。

現行のOpenAI公式docsでは`gpt-5-mini`の`minimal`対応・既定effortを再確認できておらず、実APIも未検証である。Claude表示は切替後の成功providerだけを示し、非対応400や遅延原因を確定しない。本番でのOpenAI成功と待ち時間はdeploy後にOwnerが確認する。

### 13.3 マスタ対応・変更手順・rollback（Issue #40）

実装・検証: #40（文書）、#41・#46・#47（挙動と画面）。`00cdea5`: sourceの現行契約だけを確認し、マスタの見た目・本番データ・実操作は未検証。

- #40は全frame・要件見出し・安定AC・Issueをsnapshotと照合する。確認1前に独立Reviewerが内容、昇格後に別文脈で承認済みbytesと記録を確認する。gate 3の本人`A`後に提案版をbytesのまま昇格し、SHA-256を照合する。
- #41は空の3項目・保存後の公開データ・参照削除・日付の形・既存不揃い日付・共有画像fallbackを検証する。#46はLive・予約・共通設定の保存境界と§7・§8・§10の保持を検証し、390pxの初期入力欄数・1行表示・登録から告知までを確認する。#47は全更新面の項目保持・guard・保存とdesktop/mobileを確認する。各計画と結果はADM系IDを参照する。
- 画面・要件メモ・設計書の差はnode-id、現文、修正案、理由、影響するACを記録する。先にFigmaマスタと要件メモを揃え、設計書・索引をDraftへ戻し、要件・計画とともに再承認してから実装する。実装時に設計書だけで黙って解かない。
- #40のrollbackは設計書と索引だけをbase `00cdea5`の版へ戻す。新設公開設計書の撤回は明示確認後に行う。コード・データ・Figma・既存#37の決定をrollbackしない。後続実装のrollbackは各Issueの計画で固定する。

Gap: 幅1440pxで予約の1件を右に開いた状態の専用frameは未作成。ほかの未描画frameと本番未確認の範囲は§15.1に残す。文章要件の反映を、描画や実操作の検証済みとは扱わない。

## 14. Canonical file map

今回の対応づけは#40、実装は#41・#46・#47（公開側#42〜#45）。`00cdea5`では公開UI設計と本版のマスタ対応は未登録で、以下の#40参照を追加する。既存契約の参照先は保持する。

- 本設計: `docs/specs/current/live-operations-admin-ui.md`
- 公開UI設計: `docs/specs/current/public-site-ui.md`（#42〜#45、PS系の受入条件）
- 索引: `docs/specs/current/README.md`
- Issue #40の昇格計画: active時は`aidlc-docs/construction/plans/aidlc-integration-code-generation-plan.md`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-40_figma-design-mapping/_trace/aidlc-docs/construction/plans/aidlc-integration-code-generation-plan.md`
- Issue #40の承認・出典・検証: active時は`aidlc-docs/`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-40_figma-design-mapping/`
- 後続実装計画: #41・#46・#47のformal cycleで本設計のADM系IDと節を参照する。新しいkey名・保存形式は#41のCode Generation Planで確定する
- システム設計原則: `docs/specs/current/system-design-principles.md`
- 文書体系: `docs/README.md`
- ビジュアルルール: `DESIGN_RULES.md`
- 関連実装計画: `docs/plans/`
- Issue #29実装計画: `docs/plans/2026-08-17-issue-29-live-ogp-regression-fix.md`
- Issue #33 完了cycle: `docs/records/aidlc-cycles/2026-11-16_issue-33_ai-provider-fallback/`（以下はclosed traceであり、本設計を置き換えない）
- Issue #33 Requirements: `docs/records/aidlc-cycles/2026-11-16_issue-33_ai-provider-fallback/_trace/aidlc-docs/inception/requirements/requirements.md`（R1〜R7 / AC-01〜09）
- Issue #33 Workflow Plan: `docs/records/aidlc-cycles/2026-11-16_issue-33_ai-provider-fallback/_trace/aidlc-docs/inception/plans/execution-plan.md`
- Issue #33 Code Generation Plan: `docs/records/aidlc-cycles/2026-11-16_issue-33_ai-provider-fallback/_trace/aidlc-docs/construction/plans/aidlc-integration-code-generation-plan.md`（§2 Step 1）
- Issue #33 API・公開手順: `cloudflare/worker/README.md`「Live元情報のAI整理」
- Issue #37 予約控えの実装計画と証拠: active時は`aidlc-docs/`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-37_ticket-autoreply-gmail/`
- Issue #37 Gmail送信: `cloudflare/worker/apps-script/ticket-autoreply.gs`
- Issue #37 Owner設定・確認・停止手順: `cloudflare/worker/apps-script/README.md`
- 旧来の要件・仕様・ユースケース: `documents/`

## 15. 画面・Figmaマスタ・要件・実装の対応

実装: #41（項目）、#46（Live）、#47（他の更新面）。`00cdea5`: 下表のとおり。Figmaはfile `82QH1c3hUrv1fKCd2AMULK`、[マスタ｜管理画面 `1:2`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=1-2)の[10｜管理画面 `15:20`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=15-20)。[方針｜管理画面の目的と利用者 `43:491`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=43-491)の「誰が」「どこで」「何をいちばん多くする」「画面と説明の分け方」を判断の根拠とする。

要件メモの共通見出しは「受入条件」`39:837`、「状態ごとの見え方」`39:834`。各行のACは§12.3へ戻れる。状態はすべて共通frame内で扱い、該当する状態名を併記する。「専用frameなし」は、未描画のものを別の幅の設計として捏造しないことを示す。

| 画面・用途 | 1440pxのマスタ | 390pxのマスタ | 状態frame・該当状態 | 要件メモ・見出し | 受入条件ID | 実装Issue | `00cdea5`で実装済みか |
|---|---|---|---|---|---|---|---|
| Live一覧 | 専用frameなし。[管理 Live 公開内容｜1440 `47:582`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=47-582)等の左一覧を参照。 | [管理 Live一覧｜390 `44:492`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=44-492) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「APIに接続できない時」「Local Mode」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「よくする3つの流れ」「振る舞い」「案の判断と理由」 | ADM-40-03, 04, 05 | #46（外枠5タブは#47） | 一部実装。`admin/index.html`・`app.js:renderLiveItem`に一覧と区分。予約枚数・未対応の集計は未実装。 |
| 新しいライブ①元情報 | [管理 新しいライブ｜1440 `47:873`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=47-873) | [管理 新しいライブ 元情報｜390 `44:531`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=44-531) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「下書きを作っている間」「下書きを作れなかった時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「よくする3つの流れ」「変わらない項目」 | ADM-40-02, 05, 07 | #46 | 一部実装。`buildLiveEditorHtml / handleLiveSourceParse`に元情報と手入力。配置・ラベルは変更対象、抽出契約は§7のまま。 |
| 新しいライブ②下書き確認 | 専用frameなし（「確かめていないこと」に明記）。 | [管理 新しいライブ 確認｜390 `44:546`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=44-546) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「必須の項目が空の時」「まだ保存していないライブで、告知・予約を開こうとした時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「よくする3つの流れ」「振る舞い」 | ADM-40-01, 02, 04, 05, 07 | #46 | 一部実装。`revealNewLivePublicFields`に確認段階あり。フライヤー先頭とスマホの帯は未実装。 |
| 新しいライブ③保存直後 | 専用frameなし（同メモに明記）。 | [管理 保存のあと｜390 `44:595`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=44-595) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「保存の状態」「投稿文・リンクをコピーした時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「よくする3つの流れ」「振る舞い」 | ADM-40-02, 05 | #46 | 未実装。`saveLiveWorkspace`は保存後に編集面を開き直す。告知内容・X・あとでの専用段階はない。 |
| Live公開内容 | [管理 Live 公開内容｜1440 `47:582`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=47-582) | [管理 Live 公開内容｜390 `44:610`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=44-610) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「保存の状態」「未保存のまま、別の項目・別のタブへ移ろうとした時」「画像を選んだあと」「予約があるライブを削除しようとした時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「変わらない項目」「振る舞い」 | ADM-40-01, 04, 05, 07 | #46 | 一部実装。`buildLiveEditorHtml / saveLiveWorkspace / deleteLiveFromWorkspace`。必須・guard・保存はあり、フライヤー配置・ボタン条件・削除の即時保存は未実装。 |
| 予約先・リンクなどを開いた状態 | 専用frameなし（同メモに明記）。 | [管理 Live 予約先・リンクなど｜390 `50:634`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=50-634) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「保存の状態」「未保存のまま、別の項目・別のタブへ移ろうとした時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「変わらない項目」「振る舞い」 | ADM-40-05, 07 | #46 | 一部実装。`buildLiveEditorHtml`に予約URL・受付終了・リンク・説明あり。画像と分ける配置は未実装。 |
| Live告知 | [管理 Live 告知｜1440 `47:688`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=47-688) | [管理 Live 告知｜390 `44:676`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=44-676) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「投稿文・リンクをコピーした時」「まだ保存していないライブで、告知・予約を開こうとした時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「よくする3つの流れ」「変わらない項目」「振る舞い」 | ADM-40-02, 05, 07 | #46 | 一部実装。`buildLiveEditorHtml / getLiveShareUrl`にpreview・ひとこと・コピー・X。生成とURLは保持し、表示名と保存条件を揃える。 |
| Live予約 | [管理 Live 予約｜1440 `47:757`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=47-757) 行を押すと右に1件を開く。未対応の行は`対応済みにする`で開かず変更できる。 | [管理 Live 予約｜390 `44:704`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=44-704) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「予約がまだない時」「管理用の合言葉がまだ入っていない時、違っている時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「よくする3つの流れ」「変わらない項目」「振る舞い」 | ADM-40-03, 05 | #46 | 一部実装。`loadLiveReservations / renderLiveReservationLedger`とWorker受付APIに集計・状態操作。1件を開く表示は未実装。 |
| 予約1件 | 専用frameなし。[管理 Live 予約｜1440 `47:757`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=47-757)の行と、メモの「右に1件の内容」を参照。 | [管理 予約1件｜390 `44:755`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=44-755) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「対応済み・キャンセルの予約を開いた時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「変わらない項目」「振る舞い」 | ADM-40-05 | #46 | 一部実装。予約field・状態変更・未対応に戻す処理はあり、別画面／右側詳細への分離は未実装。 |
| 取り置きを追加 | 専用frameなし。予約frameの追加入口と390pxを参照。 | [管理 取り置きを追加｜390 `44:786`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=44-786) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「管理用の合言葉がまだ入っていない時、違っている時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「よくする3つの流れ」「変わらない項目」「振る舞い」 | ADM-40-05 | #46 | 一部実装。手動追加の4項目とAPIはある。別の画面への分離は未実装。 |
| 予約管理（全Live） | [管理 予約管理｜1440 `47:926`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=47-926) 行を押すと右に1件を開く。未対応の行は`対応済みにする`で開かず変更できる。 | [管理 予約管理｜390 `44:811`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=44-811) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「予約がまだない時」「APIに接続できない時」「Local Mode」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「よくする3つの流れ」「変わらない項目」「振る舞い」 | ADM-40-05 | #46 | 一部実装。`admin/index.html`のfilter・CSV、`app.js`に横断台帳あり。表示と詳細の開き方は未実装。 |
| Ticket Page共通設定 | 専用frameなし（同メモに明記）。 | [管理 Ticket Page共通設定｜390 `50:664`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=50-664) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「保存の状態」「未保存のまま、別の項目・別のタブへ移ろうとした時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「変わらない項目」「振る舞い」 | ADM-40-05, 07 | #46 | 一部実装。#37の項目削除は実装済み。`admin/index.html`の共通設定は上の保存待ちで、専用保存は未実装。 |
| Site | [管理 Site｜1440 `38:274`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=38-274) | [管理 Site｜390 `38:350`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=38-350) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「顔にする作品｜選んでいた作品を削除した時」「画像を選んだあと」「保存の状態」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「新しく足す項目（3つ）」「変わらない項目」「振る舞い」 | ADM-40-05, 06, 07 | #41（項目）, #47（型） | 一部実装。Siteの既存fieldはあり、作品選択・表示名・全体guardと保存表示は未実装。 |
| News一覧 | [管理 News｜1440 `38:425`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=38-425)の左一覧 | [管理 News 一覧｜390 `38:500`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=38-500) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「一覧が空の時」「APIに接続できない時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「変わらない項目」「振る舞い」 | ADM-40-05, 07 | #47 | 一部実装。`renderNews / editNews`に一覧あり。右編集／一覧から編集へ進む型は未実装。 |
| News編集 | [管理 News｜1440 `38:425`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=38-425)の右編集 | [管理 News 編集｜390 `38:541`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=38-541) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「保存の状態」「削除しようとした時」「未保存のまま、別の項目・別のタブへ移ろうとした時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「変わらない項目」「振る舞い」 | ADM-40-05, 07 | #47 | 一部実装。`editNews / saveModal`のmodal内更新はあり、保存して公開とguardの型は未実装。 |
| Music作品 | [管理 Music 作品｜1440 `39:366`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-366) | [管理 Music 一覧｜390 `39:533`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-533)（作品の一覧。編集の専用frameなし） | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「作品のリリース日の形が違う時」「その場で再生する映像｜選んでいた映像を削除した時」「保存の状態」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「新しく足す項目（3つ）」「変わらない項目」「振る舞い」 | ADM-40-05, 06, 07 | #41（項目）, #47（型） | 一部実装。`editDiscography / saveDiscographyItem`の既存fieldはあり、作品の2項目・日付検査・統合・保存とguardの型は未実装。 |
| Music映像 | [管理 Music 映像｜1440 `39:461`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-461) | 映像一覧・編集の専用frameなし。[管理 Music 一覧｜390 `39:533`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-533)に作品／映像の切り替えあり。 | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「一覧が空の時」「保存の状態」「未保存のまま、別の項目・別のタブへ移ろうとした時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「変わらない項目」「振る舞い」 | ADM-40-05, 07 | #47 | 一部実装。`editYouTubeVideo / saveYouTubeItem`に既存fieldとURL検査あり。Music統合・編集面・保存とguardの型は未実装。 |
| Profile | [管理 Profile｜1440 `39:589`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-589) | [管理 Profile｜390 `39:664`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-664) | [管理｜状態 `39:741`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741)「画像を選んだあと」「保存の状態」「未保存のまま、別の項目・別のタブへ移ろうとした時」 | [要件メモ｜管理画面 `39:817`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817)「変わらない項目」「振る舞い」 | ADM-40-05, 07 | #47 | 一部実装。写真・本文・linksの編集はあり、マスタの見た目と全体guard・保存表示は未実装。 |

### 15.1 base sourceの確認範囲とGap

- `admin/index.html`・`admin/app.js`・`admin/style.css`でLive workspace、6タブ、既存編集field、非Liveのmodal、保存と削除、共通設定、予約の表示を確認した。`assets/js/live-operations.js`とWorkerの受付処理で予約状態と集計の既存契約を確認した。本文の「一部実装」はこのsourceの範囲に限る。
- 管理の状態frameは19状態。保存、未保存移動、必須不足、削除、画像、空一覧、選択作品削除、選択映像削除、API接続失敗、Local Mode、日付の形、下書き作成中、下書き失敗、未保存Live、コピー、予約0、予約ありLive削除、未対応に戻す、認証失敗を含む。AIの失敗・期限・stale応答と共有URLは§10を保持する。
- 1440pxの下書き確認・保存直後・予約先/リンク・Ticket共通設定は要件メモが390pxのみと明記する。1440pxの予約詳細・取り置き追加、390pxのMusic映像一覧と作品・映像編集も専用frameはない。メモの挙動と既存frameを参照し、描かれていない表示の検証済みを主張しない。
- 本番の古いLive、リリース日の形、予約件数、実速度は未調査。snapshotはnode・文言・寸法の証拠であり、初期表示の入力欄数・1行表示・操作回数・本番動作の証明ではない。
