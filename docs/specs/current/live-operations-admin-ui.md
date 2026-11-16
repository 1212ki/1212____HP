# Live Operations Admin UI

- Status: Approved
- Owner: Itsuki Matsumoto
- Last updated: 2026-11-16
- Related issues: #35, #33, #29
- Related implementation issues: #19, #20, #21, #22, #33, #35
- Owner approval: Issue #35のCode Generation Planに記載した本版の差分に対するItsuki Matsumotoのgate 3承認（本人回答`A`）。根拠はactive時の`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後の`docs/records/aidlc-cycles/2026-11-16_issue-35_openai-reasoning-speed/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`。本文反映後に承認済み差分との一致を検証する
- Prior Owner approval（Issue #33）: APPROVED（Itsuki Matsumoto、2026-11-16T13:34:12+09:00、提示された本版のSHA-256 `8c9ceb61cbee4e897f8afad63245410c8bca69f5ea89c8e6a5b57e6f89038864` に対する本人回答 `A`）
- Prior Owner approval: 2026-08-17（Issue #29のstable Worker share URLによるOGP回帰復旧設計）
- Prior design review（Issue #33）: APPROVED（review-04、Issue #33の更新内容。blocking findingなし）
- Prior design review: APPROVED（Issue #22 AC0〜AC9、Issue #29 owner-approved design）
- Implementation gate: Issue #35はgate 1〜3の承認と、承認済みCode Generation PlanどおりのDraft→Approved反映を確認してから実装する。独立reviewは実装後に設計と実装をまとめて1回行い、gate 4〜5で結果を確認する。merge・production deployは別のOwner承認、本番の速度確認はdeploy後のOwner確認とする
- Prior implementation gate（Issue #33）: Issue #33の本版確認済み。実装・全回帰・独立review-07を完了し、Code Generation Resultは本人回答`A`で承認済み（2026-11-16T14:29:00+09:00）。Build/Test Resultは書式修正後の新digestに対する本人回答`A`で再承認済み（2026-11-16T14:52:21+09:00）。cycle完了記録は`docs/records/aidlc-cycles/2026-11-16_issue-33_ai-provider-fallback/`。canonical確認原典: context rootの`_scratch/codex-work/20261116-114342_1212hp-ai-provider-fallback/canonical-owner-confirmation.md`（prompt: 2026-11-16T13:33:01+09:00）。本文中の実装未着手という時点記述は確認時点の記録として保持する。本番反映は別のOwner操作

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
- 元情報取込とAI整理の配置・provider自動切替（Issue #33）・OpenAIの考える量の最小化（Issue #35）
- X告知の準備・外部遷移
- Live単位の予約確認
- 全Live横断の予約管理
- Ticket Page設定への導線
- desktop/mobileの情報階層

### 非スコープ

- Site、News、YouTube、Discography、Profileの各編集画面の詳細再設計
- X APIによる自動投稿
- production deploy、認証、本番secret登録操作、DB構成の変更
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

## 14. Canonical file map

- 本設計: `docs/specs/current/live-operations-admin-ui.md`
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
- 旧来の要件・仕様・ユースケース: `documents/`
