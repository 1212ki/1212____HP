# Live Operations Admin UI

- Status: Approved
- Owner: Itsuki Matsumoto
- Last updated: 2026-08-17
- Related issue: #29
- Related implementation issues: #19, #20, #21, #22
- Owner approval: 2026-08-17（Issue #29のstable Worker share URLによるOGP回帰復旧設計）
- Design review: APPROVED（Issue #22 AC0〜AC9、Issue #29 owner-approved design）
- Implementation gate: Statusが`Approved`の間はIssue #29の実装入力として利用可

## 1. 目的

公開サイトの構成との対応を保ちながら、Liveの登録・編集・告知・予約対応を、管理者1名が迷わず短時間で完了できるadmin UIへ再設計する。

## 2. 現行UI inventoryと解決する課題

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

- adminのグローバルナビゲーションとLive入口
- Live一覧と開催状態
- Live新規登録・編集
- 元情報取込とAI整理の配置
- X告知の準備・外部遷移
- Live単位の予約確認
- 全Live横断の予約管理
- Ticket Page設定への導線
- desktop/mobileの情報階層

### 非スコープ

- Site、News、YouTube、Discography、Profileの各編集画面の詳細再設計
- X APIによる自動投稿
- production deploy、認証、secret、DB構成の変更
- #19、#20、#21の実装そのもの

## 4. 確定している設計判断

### 4.0 比較したアプローチ

| 案 | 概要 | 利点 | 欠点 | 判断 |
|---|---|---|---|---|
| A. adaptive master-detail | desktopは一覧＋編集、mobileは一覧→編集。公演内をタブ化 | 一覧の文脈を保ちつつ1公演へ集中でき、長大modalを解消できる | 画面構造とresponsive実装の変更量が中程度 | 採用 |
| B. 現行modalの整理 | bottom sheetを維持し、内部だけタブ・折りたたみ化 | 実装変更が小さい | desktopで横幅を活かせず、一覧との往復と長いoverlayが残る | 不採用 |
| C. Live編集を独立ページ化 | 一覧と編集を完全に別routeへ分離 | 編集領域を最も広く取れる | vanilla構成ではrouting・戻る操作・状態保持が過剰になる | 不採用 |

推奨案Aを採用する。公開サイト対応を保ちながら、desktopとmobileで同じ情報構造を異なるcontainerへ適応させる。

### 4.1 adminの外枠は公開サイトに合わせる

グローバルカテゴリは次を維持する。

`Site / News / Live / YouTube / Disco / Profile`

告知や予約は独立したグローバルカテゴリにせず、Liveの内側に置く。

### 4.2 Live内は公開面と運用タスクの2層で整理する

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
- `Ticket Page共通設定`: Live単位ではない共通設定のため、Liveページheaderから専用panelを開く

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

セクションまたは項目単位で次を判別できるようにする。

- `公開画面に表示`: Live一覧・Live詳細・Ticket Pageへ表示される値
- `管理専用`: 元情報、AI抽出状態、任意コメント、予約対応メモなど

### 4.5 Desktop / Mobileのcontainer

- 幅900px以上は、左320pxのLive一覧と右の選択中Live編集面を並べるmaster-detailとする。
- 幅900px未満は一覧を初期表示し、Live選択後は専用編集面へ切り替える。
- Live編集には汎用bottom-sheet modalを使わない。News等の既存modalは変更しない。
- `予約管理`はdesktop/mobileとも全幅のfilter＋横断予約一覧とする。

### 4.6 保存と未保存状態

- 自動保存は採用しない。Live内容は明示的な`保存して公開`で保存し、そのまま公開サイトへ反映する。
- `公開内容 / 告知 / 予約`の内部タブ切替では入力を保持する。
- 未保存のまま別Live、Live一覧、グローバルタブへ移る場合は、`破棄して移動 / 編集を続ける`の確認を出す。
- 新規Liveでは`告知 / 予約`をdisabledにし、初回保存後に利用可能にする。
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
| Ticket Page | `Live > Liveページ > Ticket Page共通設定` | 内部予約ページの説明・表示設定 |
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

## 6. 情報の優先順位

### 常時表示

- 選択中Liveの開催状態、日付・曜日、会場、タイトル
- `未保存 / 保存中 / 保存済み / 保存失敗`と`保存して公開`
- 公開必須の`date / venue`
- `公開内容 / 告知 / 予約`の現在位置

### 対象タスクを選んだときに表示

- 告知previewとコピー・Xを開く操作
- 対象Liveの予約一覧と手動受付
- Ticket Page設定

### 条件表示または折りたたみ

- 既存LiveのAI取込元テキストと抽出warning
- 画像・補足説明・低頻度リンク
- 履歴、例外対応、詳細設定

### 新規Liveだけ最初に表示

- `元情報から作成`を展開し、textarea＋`AIで下書きを作る`を主導線にする。
- 同じ面に`手入力で作成`を副導線として置く。
- AI整理完了または手入力選択後に、公開必須項目を含む編集フォームへ進む。

## 7. AI整理の位置づけ

- 元情報を保持し、その内容を抽出の入力とする。
- 既存フィールドに値があっても、明示的にAI整理を実行した場合は対象項目を再抽出する。
- 抽出対象、全置換する項目、保持する管理専用情報を設計とテストで固定する。
- 抽出結果は保存前に確認でき、失敗しても現在の入力と元情報を失わない。
- 詳細な抽出・置換仕様はIssue #21で扱う。

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

### Desktop

```text
[1212 Admin] [接続状態]       [Site News Live YouTube Disco Profile]

Live
[Liveページ] [予約管理]                         [+ 新規Live]
[開催予定] [公演終了]             [Ticket Page共通設定]

┌ Live一覧 320px ─────┬ 選択中Live ─────────────────────┐
│ ● Next Live          │ 2026.8.10(月) 下北沢おてまえ     │
│ 8/10 下北沢...       │ 未保存 / 公開中                  │
│ 8/23 渋谷...         │ [公開内容] [告知] [予約]           │
│                      │                                  │
│                      │ 元情報・AI整理（折りたたみ）       │
│                      │ 基本情報  日付｜会場               │
│                      │ 公演情報  OPEN｜START｜料金         │
│                      │ 出演者／画像                       │
│                      │ 予約導線・補助リンク（詳細設定）    │
│                      │                    [保存して公開]  │
└──────────────────────┴──────────────────────────────────┘
```

- 編集面の最大幅を制限し、入力欄を意味のある組で横並びにする。
- 主要actionと補助actionのサイズ・強さを分ける。
- `予約管理`選択時は2ペインを外し、全幅のfilter＋横断予約一覧にする。

### Mobile

```text
[1212 Admin] [接続]
[Site News Live YouTube Disco Profile →]

Live
[Liveページ] [予約管理]
[開催予定] [公演終了]        [+]
[Next Live]
[8/10 下北沢おてまえ  ›]
[8/23 渋谷 ...        ›]

選択後:
[‹ Live一覧]  保存済み
2026.8.10(月) 下北沢おてまえ
[公開内容] [告知] [予約]   ← sticky

公開内容
[元情報・AI整理 ▼]
[日付]
[会場]
[ライブ名]
[OPEN] [START]
[料金]
[出演者]
[画像・リンクなど ▼]

[保存して公開]           ← bottom sticky
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

## 11. Issue境界

- Issue #22はLive workspace、master-detail、内部タブ、progressive disclosure、保存状態、responsive構造を実装する。
- Issue #19は統合X投稿previewとテンプレート内容を実装する。#22では既存preview内容を変えない。
- Issue #20は詳細URLコピーとX操作ボタンのcompact化を実装する。#22では新しいURL操作を追加しない。
- Issue #21はAI抽出と10項目全置換を実装する。#22ではAI処理・prompt・置換挙動を変えない。
- #19〜#21のworktreeと同じファイルを触る場合も、各Issueのbehaviorを先取りしない。
- Issue #29は、保存済みLiveのX投稿preview、Web Intent、リンクコピーをstable Worker share URLへ復旧し、既存Worker OGP routeの契約をcharacterization testで固定する。production変更は`admin/app.js`のshare URL helperとそのX／リンクコピーcall siteだけに限定する。
- Issue #29ではWorker source、公開Live詳細、DNS/CDN/hosting、Issue #19/#21、generic admin UIを変更しない。merge、production deploy、X cache refreshも行わない。
- Issue #29のowner-approved設計は、`docs/plans/2026-08-16-issue-20-live-link-actions-ogp.md`に残る「canonical detail URLを共有する」「Worker share URLへ戻さない」という過去判断だけをsupersedeする。Issue #20の計画自体は履歴として書き換えず、compact action、unsaved gate、clipboard fallback、save-free behaviorは維持する。

### 11.1 Issue #22の実装段階

| 順序 | 実装単位 | 独立して確認する価値 | 主な検証 |
|---:|---|---|---|
| 1 | Live workspace navigation | `Liveページ / 予約管理`と`開催予定 / 公演終了`を迷わず切り替えられる | DOM contract、keyboard/ARIA、既存一覧・filter回帰 |
| 2 | adaptive master-detail | desktopで一覧文脈を保ち、mobileで一覧→編集へ集中できる | breakpoint contract、選択・戻る・focus restoration |
| 3 | 公演内task tabsとprogressive disclosure | 公開内容、告知、個別予約を必要時だけ表示できる | tab semantics、入力保持、新規Live gate、既存handler回帰 |
| 4 | validation・dirty guard・保存状態 | 必須不足、区分矛盾、未保存移動、API fallbackを安全に扱える | RED→GREEN unit/DOM test、API/Local mode回帰 |
| 5 | visual densityとresponsive refinement | 主要actionと補助actionの優先順位がdesktop/mobileで伝わる | CSS contract、overflow、focus、manual responsive review |

実装は1→5の順で行う。各段階でfocused testを通し、#19〜#21の既存behaviorを変えていないことを確認してから次へ進む。

## 12. Acceptance Criteria

- 公開サイトの各Live表示とadminの編集入口・fieldを追跡できる。
- Live一覧、1公演の公開内容、告知、個別予約、横断予約を混同せず移動できる。
- desktopは一覧＋編集、mobileは一覧→編集として同じ情報構造を利用できる。
- 常時表示、タスク選択時表示、条件表示の区別がwireframeで確認できる。
- `date / venue`の必須validation、開催区分warning、未保存移動guardが定義どおり動く。
- 保存が`保存して公開`として明示され、外部送信・予約即時操作と混同されない。
- X告知、詳細URLコピー、AI整理は#19・#20・#21の既存behaviorを維持し、#20の共有URL判断だけが#29によりsupersedeされている。
- Itsuki確認後にStatusが`Approved`へ更新されている。
- 実装Issueとplanがこの設計書を参照している。
- share URLとcanonical detail URLの責務が分かれ、保存済みLiveのX投稿preview、Web Intent、リンクコピーが同一のstable Worker share URLを使う。
- Worker HTMLのcanonical、`og:url`、human destinationはcanonical detail URLを維持し、共有文字列にはcanonical detail URLもcache-bustも混入しない。
- unsaved gate、clipboard fallback、save-free behaviorと既存Workerのmetadata／human fallbackをautomated testで観測できる。

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

## 14. Canonical file map

- 本設計: `docs/specs/current/live-operations-admin-ui.md`
- システム設計原則: `docs/specs/current/system-design-principles.md`
- 文書体系: `docs/README.md`
- ビジュアルルール: `DESIGN_RULES.md`
- 関連実装計画: `docs/plans/`
- Issue #29実装計画: `docs/plans/2026-08-17-issue-29-live-ogp-regression-fix.md`
- 旧来の要件・仕様・ユースケース: `documents/`
