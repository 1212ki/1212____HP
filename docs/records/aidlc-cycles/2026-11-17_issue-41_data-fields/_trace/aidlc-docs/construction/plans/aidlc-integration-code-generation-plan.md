# Code Generation Plan — 作品の選択・再生映像・種別（Issue #41）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-17_issue-41_data-fields`
- Workspace Root: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-41-data-fields`
- Base Commit: `060858b754e0d0c8a70bb98536e35c72523a4a48`
- Branch: `feature/41-data-fields`
- Reader: human_reader / ja-JP / designated_text_editor（Frontが開く）

## 1. 承認する変更と実装開始条件

3つの任意項目を今の管理画面で登録・保存し、公開APIとLocal JSONへ出せるようにする。選択先の削除と日付検査を両保存経路で扱い、古い値と今の公開表示を保つ。新項目の公開画面での使用は#42・#43・#44、タブ・編集面・保存guard全体の統一は#46・#47に残す。要件はR41-01〜12、受入はAC41-01〜09とADM-40-05・06の#41分。

後続Workerはgate 1〜3の承認recordについて、stage、relative/absolute artifact path、fresh SHA-256、Itsuki Matsumoto、prompt/response日時、完全prompt・raw response `A`、Decisionが`APPROVED`であることを確認する。確認1は3 artifactを列挙し、本計画に固定した設計提案版のexact bytesの確認を兼ねる。今回は承認recordを作らず、コード・試験・current canonicalを変えず停止する。

## 2. データ形式と判断理由

### 2.1 key・保存形・省略との互換

| 内容 | 保存先 | 型／既定値 | 理由 |
|---|---|---|---|
| 顔にする作品 | `site.featuredReleaseId` | string、空は`""` | 既存のsite設定へ置く。Digital Releaseと宅録Demoを合わせた作品の`id`で参照し、作品のコピーを保存しない。 |
| その場で再生する映像 | `discography.digital[*].playbackVideoId` / `discography.demo[*].playbackVideoId` | string、空は`""` | 作品に属する選択。参照は全映像カテゴリ共通の`id`で、再生用`youtubeId`とは別。 |
| 種別 | 各作品の`releaseType` | string、空は`""` | 既存のcamelCaseと任意文字列の形に揃える。タイトルと分け、カテゴリとの混同を避ける。 |

配列・埋め込みobject・カテゴリ付き複合参照の案も考えられるが、1選択という承認済み概念には文字列idが十分。カテゴリ移動で参照を書き換えずに済み、既存の`id`をそのまま使える。本番の作品4件／映像5件に重複・欠落idはない。保存collectionや既存idを改名しない。

adminとWorkerの`DEFAULT_SITE_DATA`へ`site.featuredReleaseId: ""`を足し、各`normalizeSiteData`で既存作品に新規2keyの空既定を補う。新規3keyはstringだけを採用し、欠落・null・他型は空として扱う。文字列の値を勝手にtrim・分割しない。全体をdeep cloneしてから追加keyを補い、比較用の保存前データや関数入力を破壊しない。新規key以外の既存正規化・デフォルト差（adminのseed動画、WorkerのheroImage既定など）を統一しない。

API保存ではnormalize前に既存の`site_data`行をSELECTする。`getSiteDataRow`は空行の初期書込があるため、検査のためには呼ばず、保存内で副作用のない既存行読取を使う。JSON原本を比較用に保持する。新規3keyがpayloadに**存在しない時だけ**、Siteの値と全作品collectionを横断した同じ作品`id`の値を既存行から補う。新規作品で旧値がなければ空。keyが存在する空文字・null等は既定処理後の空として明示解除を尊重する。作品・映像collectionそのものが省略された場合の既存full-replacement挙動は変更しない。欠けた作品をDBから復活させない。

これにより旧adminが作品を再構築して新keyを落としても、新Workerが3項目を保持する。既存行がなければ比較元は空。既存行の読込・JSON解析が失敗した時は比較元を捏造せず、保存を失敗させDBを書かない（解析不能は固定の`SiteDataValidationError`、通信・DB故障は既存のエラー経路）。get/read時の既存fallbackは維持する。

既存DBや`admin/data/site-data.json`を一括書換えしない。読込時の補完はメモリだけで、通常保存が新keyを永続化する。Local JSONは既存どおりenvelopeなしのsite data本体。公開APIの応答は従来の`data / meta` envelopeを保つ。

### 2.2 リリース日の形と検査範囲

検査対象は「新規作品」または「保存前の同一作品idと日付の値が異なる作品」。日付はcollectionを横断して比較するため、カテゴリ移動だけでは新規扱いしない。欠落した日付は空と同等とする。日付を触らない他項目の保存は不揃いの旧文字列をそのまま通し、新規／変更の空文字も許可する。新規／変更の非文字列値は拒否する。既存の非文字列日付も同一値の保持だけを許し、書換え時は文字列規則へ従う。

空でない新規／変更値は長さ10文字かつ正規表現`^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$`へ完全一致させる（JavaScriptの`$`だけで末尾改行を許さない）。`2025.5.05`、`2025/05/05`、前後空白、全角数字、途中改行は拒否する。空白をtrimして保存可能にはしない。今回は形だけを扱い、実在日・未来日・年の範囲等の追加制約は設けない。空を禁じないのは「新しい必須項目は足さない」、未変更の旧日付を通すのは「既存データで保存が壊れない」に基づく。

adminでは起動時の正規化後データをdeep cloneした日付比較baselineを持つ。成功したAPI保存／JSON書き出し時だけ、その送信・出力snapshotでbaselineを更新する。失敗では更新しない。作品modalの保存前とheader保存／JSON出力前の両方でbaselineとの比較を検査する。modal検査は配列削除・追加・参照解除・close・markChanged・fetchより先に行う。

不正時は`edit-releaseDate`へ`aria-invalid="true"`、`aria-describedby="edit-releaseDate-error"`、直下の`edit-releaseDate-error`（既存の`.form-error`と`role="alert"`を再利用）へ`「2025.05.05」の形で入力してください。`をtextContentで表示し、対象へfocusする。新しい色・余白・CSSは追加しない。正しい値へ直した時はerrorを消す。header検査で見つけた作品は当該editorを開いて同じfieldへ示す。

APIも同じ比較・文字列規則を`saveSiteData`内でDB書込前に適用する。`SiteDataValidationError`へ任意の`fields`を追加し、日付違反ならHTTP 400、`error: "invalid releaseDate"`と`fields`（各要素は`id`、`field: "releaseDate"`、上記固定`message`）を返す。返すidはJSONとして安全にencodeし、UIはtextContentで扱う。既存のLive ID重複エラーには余分なfieldを加えず従来応答を保つ。adminはstructured errorを開いている同じ作品へ結び付ける。保存失敗時はdraftを保持し、DB未変更を成功と表示しない。

### 2.3 最新作品と並びの共通処理

新規`assets/js/music-data.js`を、既存`assets/js/live-operations.js`と同じUMD（browserの`MusicData`／CommonJS）で作る。公開rendererにはまだ読み込ませない。APIへのimportや新bundle依存は加えない。exportする処理は`isReleaseDateFormat`（長さ10・ASCIIの形に完全一致。空はfalse）、`sortReleasesByDate`（作品配列のcopyを返す）、`resolveFeaturedRelease`（site dataから作品またはnull）、`clearDanglingMusicReferences`（入力site dataをdeep cloneし、新規3keyの補完と参照解除をした新しいsite dataを返す。入力は破壊しない）とする。adminが実際に使う選択肢・参照処理と、#42・#44が再利用する自動選択を1つに揃える。Workerは正規化／解除と日付検査だけをworker.js内に実装し、両経路を同じ架空test casesで照合する。

自動選択はdigital→demoの順で配列を連結し、形の合う非空日付を降順比較。zero-padding済みのため文字列比較でよく、Date.parseによる曖昧な解釈を使わない。同日は元の連結順で安定。空・不揃いは最新候補から外し、sortの末尾で相互の順を保つ。候補0件ならnull。明示idが存在すれば日付の形によらずその作品を優先し、存在しなければ空扱いにして自動へ戻す。保存配列をsortしない。#41ではadmin選択肢の並びにだけsortを使い、公開の配列・見た目・表示順を変えない。

### 2.4 削除と参照の整合

adminの`deleteItem`では既存read-only guard・confirmを通った後、対象作品／映像をfilterし、その**全collection完成後**のid集合で参照を照合する。作品idが存在しない`site.featuredReleaseId`を空へ、映像idが存在しない全作品の`playbackVideoId`を空へ戻す。複数作品で同じ映像を参照していても全て処理する。未選択の削除、confirm取消、read-onlyでは値を変えない。

作品／映像のカテゴリ移動では、元配列から取り除いた中間状態ではなく移動先への追加後にだけ照合する。id不変なので参照を保つ。新規追加・編集・削除後にSiteの作品候補と作品の映像候補を再生成し、古いoptionを残さない。切れた参照を復活させない。

APIの`normalizeSiteData`も全collection確定後に同じ解除を行い、管理UIを通さないPUTでも整合させる。無効な文字列参照は400でなく空へ補正する。削除は現在のheader保存（LocalはJSON出力）で永続化する。#47の即時保存・guard全体へ先回りしない。GETはメモリ内の参照を補正するが、既存行の修復書込はしない。

### 2.5 管理画面・共有画像・公開projection

| 今の場所 | 追加／変更 | 固定する表示 |
|---|---|---|
| `admin/index.html` Siteの現在のHome Hero小見出し周辺 | 小見出しを`Home`にし、作品selectと画像のlabelを縦に置く。画像form id／upload処理は維持。select idは`site-featured-release-id`、既存mutation guard対象。 | `顔にする作品`、空option `自動（最新のリリース）`、画像label `共有時の画像`。Figma `38:274 / 38:350`。 |
| `addDiscography / editDiscography`の既存modal | 既存fieldを残し、リンクURLの後へ種別text（`edit-releaseType`）と映像select（`edit-playbackVideoId`）を足す。 | `種別`、`その場で再生する映像`、空option `選ばない`。見本はplaceholder `2nd Single`だけで、本番値は自動入力しない。 |
| 同modalの日付 | `edit-releaseDate-error`と関連ARIA。placeholderを`2025.05.05`に揃える。 | エラー文はFigma `42:522`どおり。 |

作品selectは両カテゴリから全件、映像selectは3カテゴリから全件を選べる。optgroupのカテゴリ名は既存のDigital Release／宅録Demo、Music Video／Live Movie／Demo。各optionのlabelは保存済みtitle、valueはidをそれぞれescapeする。選択解除を残す。技術説明・公開先の補助ラベルを新たに画面へ載せない（Figmaにないため）。6タブ、modal、現在の既存fieldの順序は上記差分以外維持する。

`saveDiscographyItem`はbooleanを返し、`saveModal`はその結果を`ok`へ受ける（現在は戻り値を無視している）。3項目と既存fieldを保存し、旧title内の種別を削除しない。API Modeの作品modalはAPI成功後に閉じ、検査／API失敗時は開いたままdraftとerrorを保つ。Local Modeは検査成功後に既存どおりメモリへ反映し、headerでJSON出力する。`restoreGenericModalCanonicalValues`の作品2fieldも追加し、read-only／fallbackで値の改変が残らないようにする。

公開GETは`normalizeSiteData`から`projectPublicSiteData`へ渡る現在の経路で3keyを保持する。projectionが`live.upcoming / past`の`sourceText / xComment`を消す処理は残す。Localの`downloadJson`直前でも新key補完と参照解除を行い、両modeで保存形を揃える。`site.heroImage`のkey、保存値、`resolveOgImageUrl(live.image) || resolveOgImageUrl(site.heroImage)`は変えない。`assets/js/site-content.js / script.js`や公開HTML/CSSは変更しない。

## 3. 昇格する設計書のexact bytes

提案版は昇格後の最終形（Status: Approved、Owner approvalは#41 gate 3参照）。現時点の承認済みを意味しない。keyがcanonicalに残らないと後続Issueで解釈が分かれるため、管理設計§5.3と公開設計§5へ保存契約・結果参照を足す。管理§12.3には#41分の境界だけを追記する。索引も承認根拠と保存契約の入口を揃える。過去の実装baselineと未変更節は維持し、実装済みと先取りして書かない。

| 提案版（repository-relative） | 昇格先 | SHA-256 |
|---|---|---|
| `aidlc-docs/construction/aidlc-integration/proposed/live-operations-admin-ui.md` | `docs/specs/current/live-operations-admin-ui.md` | `43e4c9f407f26a8a6e2df8fe41636d7c714c03d9ebd83f2d339b5801b5767177` |
| `aidlc-docs/construction/aidlc-integration/proposed/public-site-ui.md` | `docs/specs/current/public-site-ui.md` | `8b886e4346c16eaec93ca4c5b76d13285d85c45255d38664ca3f778433bf58a6` |
| `aidlc-docs/construction/aidlc-integration/proposed/README.md` | `docs/specs/current/README.md` | `6b48f3d983fb4e46073b5a28c29537508156a51a696ab3d448acf2654cc32ac7` |

昇格前のcurrent canonicalはbaseのままであり、次に一致することを確認する。

| path | 昇格前SHA-256 |
|---|---|
| `docs/specs/current/live-operations-admin-ui.md` | `47764d8591dcb3af793935645a5ed5e5c2124d1a94a405159e22c7eb522bf3a6` |
| `docs/specs/current/public-site-ui.md` | `a551e50c3ff93c4f28665fbb73544e7c23dae7c68e2c8edf0030b78f35846e22` |
| `docs/specs/current/README.md` | `6190a72a88748e667d6365d64a3a6e139abec2ef5f89dccb5afb0b95f7fd2603` |

gate 3記録・提案版のdigest・昇格前のbase bytesを確認した後、提案版を対応先へコピーする。文字・改行・日付・Status・承認情報を編集しない。各組で`cmp`と`shasum -a 256`を実行し、両側が上表のdigestに一致することを結果へ残す。違えば上書きを止めFrontへ返す。コピー後にStatusを変える工程はない。依存コード・試験は3組の一致確認後に着手する。

```bash
cp aidlc-docs/construction/aidlc-integration/proposed/live-operations-admin-ui.md docs/specs/current/live-operations-admin-ui.md
cp aidlc-docs/construction/aidlc-integration/proposed/public-site-ui.md docs/specs/current/public-site-ui.md
cp aidlc-docs/construction/aidlc-integration/proposed/README.md docs/specs/current/README.md
cmp aidlc-docs/construction/aidlc-integration/proposed/live-operations-admin-ui.md docs/specs/current/live-operations-admin-ui.md
cmp aidlc-docs/construction/aidlc-integration/proposed/public-site-ui.md docs/specs/current/public-site-ui.md
cmp aidlc-docs/construction/aidlc-integration/proposed/README.md docs/specs/current/README.md
shasum -a 256 docs/specs/current/live-operations-admin-ui.md docs/specs/current/public-site-ui.md docs/specs/current/README.md
```

| 確認1の他入力 | SHA-256 |
|---|---|
| `aidlc-docs/inception/requirements/requirements.md` | `eb7b688f8e453d679a15ceb635f7e7ccc88080a41dd2a95fe796ea70bfcfd8f8` |
| `aidlc-docs/inception/plans/execution-plan.md` | `e9ad4f4ea40f0882eb2e4c5d014681435be8274bcbad909a57cb81ca1bbf55c3` |

本計画自身のhashは循環参照を避け、worker resultとFrontの完全承認promptで固定する。

## 4. 変えるファイル

| path | 変更 |
|---|---|
| 上表のcurrent canonical 3文書 | 承認後にexact bytesを昇格。system-design-principlesは変更しない。 |
| `assets/js/music-data.js`（新規） | §2.3の純粋な選択・並び・参照処理。公開rendererからは未使用。 |
| `admin/index.html` | Siteの新select・label、helper読込をappの前へ追加、app/helperのcache queryを`v=20261117-41`へ同時更新。 |
| `admin/app.js` | defaults・normalize・baseline・選択肢・作品2field・日付error・saveModalのboolean／作品成功時close・参照解除・JSON出力。 |
| `cloudflare/worker/src/worker.js` | defaults・normalize・副作用なしの既存行比較・省略新key補完・日付検査・structured 400・参照解除。 |
| `test/music-data.test.mjs`（新規） | 日付の形、最新・同日・不揃い・空・非破壊・参照解除。 |
| `test/admin-live-operations.test.mjs` | 既存VM DOM harnessを拡張し、実際の作品／Site操作・両mode・read-onlyを検証。helperをVMへ読み込む。 |
| `test/admin-image-form.test.mjs` | 既存admin VMにも新helperを渡す最小のharness対応。既存画像試験の意味とassertを保つ。 |
| `test/public-music-data-compatibility.test.mjs`（新規） | 既存public-ticketのVMの型を用い、現公開rendererへ空／登録ありを渡したDOMの不変を確認。 |
| `cloudflare/worker/test/music-data-fields.test.js`（新規） | D1 stub＋worker.fetchでGET/PUT・旧payload・日付・参照・projection・書込回数を観測。 |
| `cloudflare/worker/test/og-live.test.js` | 共有画像の予備とLive画像優先、新3項目が影響しない回帰を追加。 |
| `admin/README.md` / `cloudflare/worker/README.md` | 3項目・日付の互換・API 400・Worker先行・rollbackを該当節へ追加。既存AI整理の公開順序はその機能の履歴として保持し、#41の反映順序と区別する。 |

`admin/data/site-data.json`はfixture sourceとして読むだけで書き換えない。公開renderer・script.js・公開HTML/CSS・admin/style.css・DESIGN_RULES・tokens・D1 schema・wrangler設定・secretは変更しない。追加dependency／installは不要。

## 5. 実装と試験の8段

以下は後続委任の作業順。全段を先行完了とせず、進捗とcommand・exit・REDの失敗理由はaudit/resultへ残す。承認済み本計画のbytesを進捗checkboxで変えない。

全commandはWorkspace Rootをcwdとし、先に次を設定する。

```bash
export PATH=/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH
node --version
```

### Step 1 — 承認とcanonicalを揃える

§1と§3を検査し3提案版を同じbytesで昇格する。`cmp`・hash・identity・`scripts/aidlc-cycle.sh status`・変更前の`git status --short`を記録。digest差・他作業のcanonical変更なら止める。以後は昇格後の設計を実装入力とする。この段には機能変更がないためREDを作らない。

### Step 2 — 共通の選択・日付・参照処理（R41-01〜03・05・08）

新規`test/music-data.test.mjs`を作り、次のcommandでhelper未実装のREDを確認してからUMDを実装し、同じcommandをGREENにする。

```bash
node --test test/music-data.test.mjs
```

架空のrelease/videoだけで、digital＋demoの最新、非padding／区切り違い／全角／前後空白、空、同日、全候補不正、明示指定、消えた指定、無効日付の末尾、共有映像削除、移動、入力配列非破壊を試験する。新field補完・string以外の空変換も確認する。暦の追加検査を混ぜない。

### Step 3 — Workerの保存・公開データ境界（R41-04〜07・10〜12）

新規Worker testにD1の可変site_data stubを置き、同じfixtureをGET→PUT→GETで往復させる。検証前RED→worker.js実装→同commandでGREEN。外部fetchや実D1を呼ばない。

```bash
node --test cloudflare/worker/test/music-data-fields.test.js
```

T41-Wのケース群（§6）を含め、認証なしPUTは401で書込0、日付不正は400・DB書込0・fields、成功は保存済みJSONから公開GETへ3keyが出ることをassertする。Live ID重複の既存拒否とprivate field除去を維持。getSiteDataRowの初期INSERTを検査に流用しない。段の最後に最初の全試験（§7）を実行する。

### Step 4 — Siteと作品の入力・保存（R41-01〜04・06・07・09・10）

既存admin VM harness（admin-live-operationsとadmin-image-formの両方）へhelper読込と新要素を加える。空・登録・選択解除、全カテゴリoption、escape、項目保持、Local JSON blob、API PUTと再読込、日付変更のみの検査、boolean falseでmodalが閉じないことを先にREDにする。admin/indexとappを変更し、同commandをGREENにする。

```bash
node --test --test-name-pattern='music data fields' test/admin-live-operations.test.mjs
```

新test名は全て`music data fields`を含めてfocused commandから0件にならないようにする。siteのmutation guard、restoreGenericModalCanonicalValues、isSaving／upload guardも通す。日付エラーのtext・直下配置・ARIA・focus・入力保持は実際の生成DOMと呼出し回数で確認する。API failure時の作品modal保持、baselineが成功時だけ更新されることも確認。

### Step 5 — 削除・移動・保存前後の参照（R41-05・10・11）

同じadmin focused commandで、作品削除、複数作品から参照する映像削除、未参照削除、取消、fallback read-only、作品／映像カテゴリ移動を先にREDにする。全collection確定後の解除と選択肢再生成を実装しGREEN。Localではheader JSONまで、APIでは既存header保存後に公開GET相当の保存shapeまで確かめる。API直接PUTの削除ケースもStep 3のcommandで再実行する。この段では全試験は流し直さない。

### Step 6 — 公開表示と共有画像の回帰（R41-04・09・12）

新public compatibility testとOG focused testを追加する。公開表示は現rendererを変えないため、変更前からPASSするcharacterizationとして記録し、偽のREDに数えない。追加helper／3key導入後にも同じ結果となることを確認する。OGの実装も変更不要ならcharacterization PASSでよい。

```bash
node --test test/public-music-data-compatibility.test.mjs test/public-ticket-routing.test.mjs
node --test cloudflare/worker/test/og-live.test.js
```

公開fetchをstub化し、API envelopeとLocal JSON相当のdata本体それぞれを3key欠落・空・登録ありで描画し、既存の画像URL・title・日付原文・description・リンク・順序・news・Live等を比較する。`meta.updatedAt`は比較fixtureで同じに固定し、キャッシュqueryの時刻差を表示差と取り違えない。descriptionのみLiveは既存rendererとhelperを実行し、文字が落ちないことを観測する。再生ボタンや種別表示が増えないことも確認する。

### Step 7 — 運用文書と統合の区切り（全AC）

admin/Worker READMEへ§2の契約と§8・§9の手順を統合する。新helper・appのcache queryと読込順を揃える。§7の全試験・syntax・diff・local integrity・scopeを実行し、結果を保存する。全ACとtest evidenceの対応、canonicalと提案版の3組のbyte一致、本番内容非混入を確認する。

### Step 8 — 結果を固定しFrontへ返す

次の結果候補を実施事実で作る。新しいテスト／成果物／知見を本計画へ追記して承認digestを変えず、結果・auditへ残す。

| 成果物 | path |
|---|---|
| Code Generation Result | `aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md` |
| Build/Test Result | `aidlc-docs/construction/build-and-test/build-and-test-summary.md` |
| 実行ログ | `aidlc-docs/construction/aidlc-integration/verification/`配下（後続Workerが作る） |
| cycle summary | `aidlc-docs/cycle-summary.md` |

Code Generation Resultには実際の差分・昇格先hash・実装契約との一致・未完を、Build/Test Resultにはcommand・exit・件数・RED理由・GREEN・全AC対応・本番未確認を残す。summaryとBuild/Testの`- **Blocking Findings**: None`は未解消blockingがない時だけ使う。

Frontが実装後に独立reviewを1回手配し、設計・互換・実装・試験・canonical bytesをまとめて確認する。修理後は影響するfocused／必要な区切りの試験を更新し、Frontが確認2でgate 4・5をItsukiのAへ結び付ける。承認記録・close・Owner対話・全体完了はWorkerが代行しない。

## 6. 必須の試験ケースと受入対応

| ケース群 | 必須の観測 | AC |
|---|---|---|
| T41-H | 最新・両カテゴリ・同日・候補0・全不正・空・明示指定・切れた参照・安定sort・非破壊。 | AC41-07・08 |
| T41-W | 欠落3keyの旧行GET、入力ありPUT→公開GET、Localと同shape、`sourceText / xComment`非公開。 | AC41-01・02・06 |
| T41-W legacy | `2025.5.5`・`2025/05/05`・`2025.05`・空／欠落の架空旧日付。日付未変更のtitle／種別／Site／Live保存・作品カテゴリ移動は成功し旧値保持。 | AC41-03・08 |
| T41-W changed | 新規／既存変更の不正→400とDB書込0、空→成功、正形→成功、無行の初回不正PUT→INSERT 0。エラーのfieldsと他項目の不変。 | AC41-03・08・09 |
| T41-W references | 指定作品削除、共有映像削除、直接不正id、カテゴリ移動でid存続、空指定、複数参照、旧admin省略keyの保持。明示空で解除、削除作品の復活なし。 | AC41-07・09 |
| T41-A | 実操作の新規／編集／解除、全カテゴリoption、既存field保持、XSS文字列、Local JSON blob／API PUT、reload後同値、fallback read-only。 | AC41-02・05・06 |
| T41-A validation | invalidでfalse、modal保持・focus・項目下の固定文、配列・hasChanges・fetch不変。成功baseline更新／失敗保持。header経由も検査。 | AC41-03・08 |
| T41-P | 空／欠落／登録ありで既存公開DOMが同一。Home hero・全作品の旧日付文字列・descriptionのみLive・リンク・順序を保持。 | AC41-01・03・06 |
| T41-OG | Live画像あり優先、なしはheroImage、heroもなしは既存fallback、新3keyで予備画像が変わらない。canonical URL／共有URLは既存回帰。 | AC41-04・05 |

production_dataの観測は日付不揃い0件、descriptionのみLive 14件。旧日付ケースは本番0件でも省略しない。fixtureは架空のid・作品・Live本文で新しく作り、snapshotのタイトル・本文・画像URL・個人情報をコピーしない。既存repo fixtureを使う場合も新しいproduction_dataからの転記はしない。

## 7. 区切りで実行する全試験と検証

次はStep 3完了とStep 7完了の2つの区切りで実行する。失敗・新しい修理・未解消の懸念がある時だけ追加の全試験を行う。各commandのexitとtests/failをログと結果へ残す。

```bash
node --test test/
npm --prefix cloudflare/worker test
node --check admin/app.js
node --check assets/js/music-data.js
node --check cloudflare/worker/src/worker.js
scripts/aidlc-verify.sh --local
scripts/aidlc-cycle.sh status
git diff --check
git status --short
```

Step 3時点では新helperがStep 2で存在する。dependencyのネットワークinstallを行わず既存環境で実行する。local verifyはsource authenticityを主張しない。後続Packetではlocal verifierが使う`/private/tmp/aidlc-archive-verify.*`等の一時pathも明示許可する。今回の許可path外なので本Packetでは再実行せず、Frontの既済PASSとread-onlyのstatus／artifact検証を区別して返す。

承認済み提案版の昇格後はcanonical bytesが一致すること、変更scopeが§4だけであること、試験fixtureに本番本文がないことを確認する。GUIや新規captureをこの計画の必須条件にはしない。項目・入力・保存・DOM不変は決定論的なVM／API試験で確認し、390px／1440pxのマスタ配置と実再生の受入は#42以降へ残す（ui_route=none）。

## 8. 本番への反映順序とItsukiの確認

公開サイトと`admin/`はGitHub Pagesが`main`の`/`から配信する。Frontが2026-11-17に`gh api repos/1212ki/1212____HP/pages`で確認した値は`build_type: legacy`、`source: branch main, path /`、`cname: 1212hp.com`、`status: built`。mergeが新adminとhelperの公開を起動し、別の「静的反映」操作はない。一方、mergeだけではWorker APIは更新されない。

Itsukiの別承認・操作で**PR最終版のtested revisionから新Workerをdeploy→PRをmerge→Pages build完了後に管理タブを再読込**の順にする。これなら通常の更新途中は旧admin＋新Workerになり、新admin＋旧Workerを作らない。merge後のWorker deployは、日付・参照・旧payload互換が揃わない期間を作るため採用しない。公開rendererは現状のまま。

| 途中状態 | 成立する理由と注意 |
|---|---|
| 旧admin＋新Worker | Workerが3key省略を既存行から補う。旧日付未変更は通す。旧adminは新しい日付の形に対するinline表示を持たないので、短い切替期間は旧タブで日付編集をせず再読込する。 |
| 新admin＋新Worker | merge後のPages buildで新adminとhelperが公開される。新3key・structured日付error・削除参照処理が揃う。 |
| 新admin＋旧Worker | additive JSONを旧Workerも保持するが日付・参照・旧admin省略互換は保証できないため、通常の反映順序に採用しない。 |

### Itsukiが行う3つの操作

1. **Workerをdeployする。** formal close後にFrontがcommit・push・PR作成を済ませ、試験を通したコードと一致するPR最終commitを提示する。Itsukiはそのrevisionの`cloudflare/worker`を対象に、既存の`npm run cf:deploy`（wrangler deploy）を実行する。mergeはまだ行わない。DB migration・新secret登録は不要。deploy後にPRのコードが変わった場合は、Frontが影響する再試験とdeploy済みrevisionの一致を確認するまでmergeしない。
2. **PRをmergeする。** Frontの下記read-only確認で新Workerの公開APIが正常と分かった後にItsukiがmergeする。Pages buildが失敗・未完了なら新Worker＋旧静的サイトのまま保存確認を待つ。mergeを見送ると決めた場合は§9で新Workerを戻す。
3. **1作品で保存と公開結果を確認する。** FrontがPagesの新revision配信を確認した後、管理タブを再読込する。残したい実際の設定として、Siteの顔にする作品にその作品を選び、その作品に登録済み映像と種別を入れて現在の操作で保存し、再読込で値が残ることを見る。Frontが照合する公開データの結果と、公開画面のHome画像・その作品・Live情報・リンクが従来どおりであることを確認する。試験専用値の入力と復元は要求しない。

### Frontのread-only確認

- deploy前にPR最終commitと試験済みコードの一致を確認し、Cloudflareのdeployment履歴から今回の直前versionをrollback先として特定しておく。versionの控えをItsukiの別作業にしない。復旧先を特定できない時はdeployへ進めず、Frontが必要な判断を返す。
- Worker deploy後・merge前に公開GETの`data / meta`、新3keyの形、Liveの管理専用`sourceText / xComment`の非公開を確認する。既存LiveのOGが成功し、Live画像優先／共有画像へのfallbackが現行のままであることを該当する公開応答で確認する。新規GET本文をrepoへ保存しない。
- merge後にGitHub Pagesのbuild完了と対象commitを確認し、`admin/index.html`のapp/helper読込順・新cache query、および両scriptのHTTP 200を確認する。build成功だけで配信revision一致としない。
- Itsukiの保存後に公開GETの3項目を当該作品・映像id／入力した種別と照合し、成功／未確認・時刻・revisionだけを結果へ残す。Frontから直接readできない場合はItsukiの`!`実行結果で確認し、未観測のまま成功としない。これはAPI確認の代替経路であり、管理API原本のexportは求めない。

日付拒否・削除時の参照解除・Local JSON・旧admin互換は§5〜§7の決定論的試験で確かめ、本番で繰り返さない。DB schema・既存行の一括移行がなく、deploy自体はデータを書き換えないため、通常の復旧はWorkerのcode rollbackで足り、事前の管理データexportやD1全体の控えをItsukiへ要求しない。実データ破損の復旧は§9の例外として扱う。

本番の実UI観測はOwnerの受入であり、このWorkerは行わない。反映・書込確認は確認1のAだけでは実行しない。

## 9. 失敗・rollback・停止

- 昇格前の承認欠落・stale digest・canonical変更は停止する。提案版を編集して承認済みbytesに見せず、影響する候補と承認をFrontで取り直す。
- 実装時の不正日付は入力と既存保存値を保持して拒否する。保存失敗時はbaselineを進めず、公開済みと表示しない。DB読取・解析の失敗時は旧値を捏造して上書きしない。
- **deploy失敗・merge前のAPI不具合・merge見送り**: mergeせず、Itsukiが今回の直前のWorker versionへrollbackする。復旧先はFrontがdeploy前に特定したdeployment履歴のversionで、Cloudflareのdeployment rollbackで戻す。GitHub Pagesはまだ旧`main`のため静的側の操作は不要。戻した後にFrontが公開APIの正常応答をread-onlyで確認する。deploy成功をmergeの既成事実にしない。
- **merge後の不具合**: 管理画面の保存を止める。Frontが#41差分だけを戻すrevert PRを準備し、Itsukiが承認・mergeする。Pagesが旧adminを配信したことをFrontが確認してから、ItsukiがWorkerを直前versionへrollbackする。Pagesは`main`配信なので、別の静的deployで旧版へ差し替える手順にはしない。Worker側の障害で先に戻す必要がある場合も保存停止を続け、静的側の復旧が揃うまで再開しない。Git write・revert PR準備・復旧の承認はこのPacketでは実行しない。
- DB schemaは変えず、code rollbackで既存JSONと予約等を保持する。旧Workerは追加keyを含むJSONの読込を許容するが旧adminの作品保存は新keyを落とすため、rollback中の作品編集は止め、復旧版へ戻してから再開する。追加keyの一括削除やD1全体の巻き戻しを通常手順に含めない。D1の復元設定・保持期間は今回未確認で、復旧の成立をそれに依存させない。実データ破損が見つかった場合だけ保存を停止したまま、Frontが利用可能なD1復元手段と失われる更新を確認してItsukiへ別判断を求める。Workerのcode rollbackはデータ復元の証明にはしない。
- canonicalの撤回が必要な時は本cycleの3文書だけをbaseのexact bytesへ戻す（§3の昇格前hash）。コードの撤回とは別にFrontへ承認状態を返す。他作業・Figma・既存#37の契約・本番データを戻さない。新helper等のファイル削除が必要ならItsukiの明示確認を得る。git reset・branch操作を使わない。
- 許可外write／network／secret、手順外cycle故障、既存原典で決まらないOwner-only価値判断はFrontへ返す。正常時の独立review待ちは候補作成のblockerではない。

## 10. 未確認事項と今回の停止位置

Figmaは取得済みsnapshotの指定nodeを照合し、liveへ接続しない。本番データは公開projectionのshape分類だけで、管理原本・取得後変更・deploy・実画面は未確認。hosting経路は§8のFrontによるGitHub Pages API確認で確定し、Workerはnetworkへ接続していない。実際の反映時のPages build・配信revision・Cloudflare deployment履歴／rollback先はFrontがread-onlyで確認する。D1の復元設定・保持期間は未確認だが、通常のcode rollbackにデータ復元を必要としない。後続Issueの範囲は#40 cycleの保存済み写しによる。descriptionのみLive 14件は#42・#43へ形と件数を引き渡し、#41では保持回帰だけを行う。

今回の3候補と提案版は未承認。stateはRequirements承認待ち。Code Generation Result・Build/Test Result・承認記録・canonical昇格はまだ作らない。Frontの確認1とOwnerのAの後、後続Workerが本計画を実装入力にする。
