# Code Generation Plan — 管理画面のよくする3つ（Issue #46）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-20_issue-46_admin-live-ops`
- Execution target: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-46-admin-live-ops`
- Branch: `feature/46-admin-live-ops` / base `e191e53ada480014e03ad2fa23835f6178ce371a`
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 1. 到達点と責任

Itsukiがスマホで、新しいライブの登録・告知・予約の管理を手間なく終えられ、保存・削除・予約の状態変更が今と同じ確かさで動く状態を作る。実装入力はRequirements R46-01〜24・S46-01〜25・AC46-01〜14、設計提案版（§3）、Figma整合案F46-01〜24。原典はauditに固定する。1つの実装単位`aidlc-integration`として8段で作り、内部工程ごとに別Workerを起動しない（Frontが長さの都合でPacketを区切る場合も、本計画の段の境界で区切り、計画は変えない）。

確認1でItsukiがgate 1〜3と、本計画に含まれる設計提案版2文書・Figma整合案・VF3の確定を承認し、Frontが承認記録を作るまで実装しない。後続Workerは昇格・コード・試験・撮影script・架空APIを持ち、Frontが撮影の実行・画像の目視・Worker deploy・独立review手配を持つ。結果を確認2（gate 4・5）へ出す。Owner確認・review・Front completionは別であり、Workerは自己承認・再委任・Git writeをしない。merge・Worker deploy・PRはItsukiの別の明示承認。

## 2. 採用する設計

### 決定と理由（Frontの判断VF1〜VF13の具体化と、Workerが決めた点）

| 項目 | 決定 | 理由 |
|---|---|---|
| 範囲 | `admin/index.html`・`admin/app.js`・`admin/style.css`のLive・予約・Ticket共通設定、`cloudflare/worker/src/worker.js`の集計1経路、README2つ、試験・fixture・撮影script。Site・News・YouTube・Disco・Profileのタブ、公開側、`live-operations.js`は変えない。 | Issue #46の範囲どおり（VF1）。 |
| 変えない動きを先に固定 | 段1で、ライブの保存で送る内容、旧形式のライブを開いて保存した形、削除、予約の状態変更と合計、取り置き、告知文と共有用のアドレス、Ticket共通設定の保存を、**現行コードに対する試験（GREEN）で先に固定**する（`T46-PIN`）。以降はその試験を通したまま画面を変える。固定の試験を意図して更新するのは、要件が変わった所（文言・確認の形・保存の送り方）だけで、更新の一覧と理由を結果に残す。 | 保存を壊すと実害が出る本番の道具（VF2）。 |
| 保存の対象の分離 | Live・削除・Ticket共通設定の保存は、`PUT /api/admin/site-data`（経路・全体を送る形・認証は不変）の送る内容を、**最後に読み込めた／保存できた内容（`savedBaseline`。今の`releaseDateBaseline`と同じもの）の複製に、その操作の対象だけを重ねたもの**にする。siteData全体は送らない。成功したら`savedBaseline`を送った内容に更新し、`hasChanges`（headerの待ち）は保存前の値のままにする。失敗は今の`rollback`と同じ（siteDataを元へ戻し、入力と編集面を残す）。Local Modeは今のまま（メモリ上に反映し`markChanged`）。#47のタブの保存（`saveData`・各modal）は変えない。 | 今の保存は公開データ全体の上書きなので、その場の保存を足すと、別のタブの未保存の変更（headerの待ち）が気づかないうちに公開される。削除とTicket共通設定を「その場」に変える要件（R46-06・R46-15）で、この巻き込みが新しく起きるため、対象だけを重ねる。siteDataを送る形のまま共通設定の入力だけ分ける案は、Site等の未保存を巻き込むので採らない。別の端末の保存を取り込む再取得は足さない（保存の経路・形を変えない決定。今と同じく最後に保存した側が残る既知の制限。#47で保存全体を見直す時に扱う）。 |
| 重ねる内容 | Liveの保存＝その`id`の旧エントリを両区分から取り除き、保存先の区分の先頭に追加（今の`saveLiveItem`と同じ並び）。削除＝その`id`を両区分から取り除く。共通設定＝`ticket`を入力の複製に置き換える。いずれも`clearDanglingMusicReferences`と重複`id`の検査を通してから送る。`live.ticketLink`・#41の3項目・`site.heroImage`は`savedBaseline`のまま運ばれる。 | 今の保存と同じ結果になること（T46-PIN）と、他の領域を落とさないこと（T46-SCOPE）を試験で縛る。 |
| 未保存の判定 | 編集面を開いた時（`openLiveEditor`直後）に入力欄の値をまとめた文字列を控え、入力のたびに今の値と比べる。違えば未保存、同じなら変更なし。新しいライブは、開いた時の値（すべて空）と比べる。AIの下書き・画像の選択も同じ判定に入る。Ticket共通設定も同じ方式。 | 「保存して公開」を未保存の時だけ出す要件（R46-04）。入力して戻した時に残らないようにする。`markLiveEditorDirty`の呼び出し点（入力・画像・AI）は残し、判定だけ差し替える。 |
| 確認の面 | 画面の中の`role="alertdialog"`（`#live-dialog`）を1つ置き、`openLiveDialog({title, body, actions})`が`Promise`で選んだ操作を返す。未保存の確認（「破棄して移動」「編集を続ける」）、削除の確認（「やめる」「削除する」）が使う。`requestLiveEditorTransition(action)`は、変更がなければ今と同じく同期で`action()`を実行し、変更があれば確認の面を出して、選択後に実行する（Promiseを返す）。Escと背景は安全側（やめる・編集を続ける）。ブラウザ標準の`confirm`はLive・共通設定では使わない（他のタブのmodal・Localの画像書き出しの`confirm`は変えない）。 | 状態`39:758`・`52:671`のボタン名（破棄して移動・編集を続ける・やめる・削除する）は、標準の`confirm`では出せない。同期の呼び出し点が多いので、変更がない時の経路は同期のまま残して影響を絞る。 |
| 再読込・戻る・閉じる | 既存の`beforeunload`（`hasChanges`・`liveEditorDirty`・保存中・画像アップロード中）に、Ticket共通設定の未保存を足す。文言はブラウザ標準。iOSのSafariは標準の確認を出さないことがあり、その環境では止められない既知の制限。 | ブラウザの戻る・再読込の確認は`beforeunload`でしか止められない。履歴を差し込む方式は、戻るの意味を変え保存の導線を複雑にする（比例しない）。 |
| 集計（Worker） | `GET /api/admin/ticket-reservation-summary`。`SELECT live_id AS liveId, status, COUNT(*) AS records, COALESCE(SUM(quantity), 0) AS seats FROM ticket_reservations GROUP BY live_id, status`（個人の列を読まない）を1回実行し、純関数`summarizeTicketReservationRows(rows)`が規則を持つ（`cancelled`を除く、`records`・`seats`・`pending`、`liveId`昇順、数でない`seats`は0）。応答は`{summaries:[{liveId,seats,records,pending}]}`。`isAdminAuthorized`の後でだけDBを読む。`export`に関数を足す。 | 規則を1か所に置き、管理画面の台帳の合計と同じ入力で同じ値になることを試験で縛る（VF3）。応答に個人情報を入れない（列を選ばない）。 |
| 一覧の取得と表示 | API接続中（読み取り専用でない）で、`loadTickets`の後に1回取得し、保存・削除・状態変更・取り置きのあとにも取り直す（連続の呼び出しは最後だけ採る）。失敗は4種類を区別する: 取得できない（404・通信・形の不正）→「予約の数を読み込めませんでした。」、認証が通らない（401・403・合言葉を入れない）→「認証できませんでした。」、API接続失敗・Local Mode→呼ばず案内なし、読み込み中→行なし。 | R46-09・R46-11。保存・予約の操作を妨げない（一覧の表示だけが落ちる）。 |
| 予約の数の見せ方 | 各開催予定の行に「予約 N枚」（`seats`）と、`pending`が1以上なら札「未対応 N」。`summaries`に無いライブは「予約 0枚」。予約の切り替え（公開内容／告知／予約）の枚数は、開いた時は集計の`seats`（公演終了や取得失敗は空欄）、予約の一覧を読み込んだら台帳の合計に差し替える。 | 一覧を開いただけで分かること（ADM-40-03）と、台帳との数のずれを出さないこと。 |
| 新規ライブの画面 | 編集面に画面状態`source`→`edit`→`postsave`を持たせる。`source`は元情報・「下書きを作る」・「手入力で作る」だけ（公開の欄は`hidden`）。「下書きを作る」の成功・「手入力で作る」で`edit`（フライヤー先頭の確認）、Headerの右は「未保存」。保存成功で`postsave`（「保存して公開しました。」・告知の内容・「Xで告知する」・「あとで」）。`postsave`は新規の保存の直後だけ。 | R46-07・F46-17。ボタン3つの列を崩さない（確認の面を挟まない）。 |
| 開いた画面の構造 | 編集面の見出し（Header）は`‹ 一覧｜日付と会場｜保存の状態`の1行。予約1件・取り置きを追加では`‹ 予約｜名前と枚数または「取り置きを追加」`に替え、公演の中の切り替えを隠す。幅899px以下でライブを開いている間は、グローバルのHeader・接続の帯・タブ・見出し・workspaceの切り替え・一覧の切り替え・一覧の領域を隠す（`body.is-live-editing`。幅900px以上は隠さない）。 | R46-01・R46-02。要件メモの「上の帯を1行」。 |
| 保存して公開の置き場 | 幅899px以下は編集面の下に固定（`position: sticky; bottom: 0`、`padding-bottom: env(safe-area-inset-bottom)`。未保存の時だけ表示）。幅900px以上は編集の見出しの右（変更がない時は`opacity`と`disabled`）。同じ`#live-editor-save-btn`を使い、幅で場所だけ変える。 | R46-04。今の固定フッターの「祖先にスクロールの仕組みがない」条件（既存の試験）を守る。 |
| 削除 | `#live-editor-delete-btn`は公開内容の末尾の文字（`btn-text`）にし、既存ライブの公開内容の時だけ表示する。押すと予約の件数を決め（台帳の読み込み済みの合計→無ければ`/api/admin/ticket-reservations?liveId=…&limit=200`を1回。失敗は件数不明）、確認の面を出す。「削除する」でsiteDataから外して再描画し、スコープ保存。失敗はsiteDataを戻して再描画・編集面を残す。成功は一覧へ戻る。 | R46-06。予約の件数は削除を止める根拠ではなく、確認の材料（件数不明でも削除は妨げない）。 |
| 画像（フライヤー） | Live専用の`getFlyerFormHtml`を作り、Live編集面の`edit-image`だけで使う（同じid・同じ`handleImageSelect`・`clearImage`）。共有の`getImageFormHtml`（News・Disco・Profile・Site）は変えない。アップロード中・失敗の文言は、`inputId === 'edit-image'`の時だけ新しい文言（「アップロードしています…」「画像をアップロードできませんでした」＋理由）にする。 | #47のタブの見た目・文言を変えない（R46-22）。 |
| 文言 | 画面に出す文言は`LIVE_UI_TEXT`の1つの定数にまとめ、試験は定数ではなく実文字列で検証する。マスタの名前へ揃える（Figma整合案§5の表）。既存の試験が固定している旧文言（下書き・告知・予約の名前、AIの失敗・実行中の文）は、意図した変更として更新する。provider成功の固定文（設計§7.4）は変えない。 | 方針`43:509`。文言の意図しない変更を試験が拾えるようにする。 |
| 見た目 | 色・文字・余白は`DESIGN_RULES.md`と`assets/css/1212-music.tokens.css`のtokensのまま。寸法・文字はfigma snapshotのspec（§4.2・§4.3）に合わせ、新しい色・余白の値を直書きしない。新しいCSSは`/* ----- Live Operations Hub ----- */`のまとまりの中（`admin/style.css` 226〜690行目付近）で、Live・予約・共通設定のclassにだけ当てる。`.item-card`・`.modal*`・`.btn*`など他のタブが使う共有classは変えず、Live用のclass（`.live-row`・`.live-sheet`など）を新設する。 | R46-21。#47のタブの見た目を変えない。 |
| 幅900px以上 | 左の一覧は幅320固定、右の編集面は残り（最大幅は制限しない）。公開内容は`grid`で日付・会場の2列、OPEN・START・料金の3列、補足・共演者の2列。右の幅が1180px相当に満たない間は`@container`ではなく`@media (max-width: 1179px)`で列を1つ減らす。予約の表は連絡先の列が縮む。行を押すと表の右に幅320の面を開く。 | R46-18。`@container`は使わず、既存のmedia queryの流儀に合わせる。 |
| 新旧の組み合わせ | 新しい管理画面＋古いWorker: 集計だけが404になり、一覧は予約の数なし＋案内の1行。保存・予約は変わらず動く（PUT・予約の経路は不変）。古い管理画面＋新しいWorker: 新経路を呼ばないので今のまま。Workerを先にdeployする（§8）ので、新しい管理画面と古いWorkerの組み合わせは、通常は生じない（rollback時だけ）。 | ADM-46-09。 |
| 管理画面の読み込みと合言葉 | `ensureAdminToken`の動き（入力の窓で聞く）は変えない。一覧の集計と「予約」「予約管理」の取得は同じ合言葉を使う。通らなかった時の「認証できませんでした。」は、一覧の上・予約の一覧の上・保存の失敗の理由に出す。 | 状態`52:677`の「今のまま」。 |
| 画面の確認と手元での確認 | 撮影はFront、架空のAPIは`fake_admin_api.py`（撮影と手元配信で共有）。Itsukiが触る確認は架空のAPIの手元配信（§7）。 | VF7・VF8。 |
| 設計書 | 提案版（§3）を昇格する。直さない節は今の文面を保つ。#47の行・#33・#35・#37の節は変えない。 | VF10。 |
| 比例 | 試験は「保存・削除・予約を壊さない」「スマホで手間なく終わる」に効く所へ寄せる。起こりにくく害の小さい所（§9の既知の制限）は書いて残す。 | VF13。 |

### 画面の状態（JavaScript）

`admin/app.js`は1ファイルのまま、既存の関数を所定の場所で直し、新しい関数は「Issue #46」の見出しコメントのまとまりに足す（新しいscriptを足さず、試験のharnessが読む1ファイルを保つ）。新しい状態の変数は次のとおり。

- `liveEditorScreen`（`'source' | 'edit' | 'postsave'`）、`liveEditorBaseline`（文字列）、`liveReservationView`（`'list' | 'detail' | 'add'`）、`liveReservationDetailId`、`crossReservationDetailId`、`reservationRowsById`（読み込んだ予約の行をidで引く）、`reservationSummary`（`{status: 'idle'|'loading'|'ready'|'failed'|'unauthorized', byLiveId}`）、`reservationSummarySequence`、`ticketSettingsBaseline`・`ticketSettingsDraft`（共通設定の入力）、`liveDialog`（開いている確認の面の状態）、`savedBaseline`（`releaseDateBaseline`への別名。既存名は残す）。
- 新しい関数: `openLiveDialog`・`closeLiveDialog`、`snapshotLiveEditor`・`recomputeLiveEditorDirty`、`saveScoped(applySlice)`・`applyLiveSlice`・`applyDeleteSlice`・`applyTicketSlice`、`loadReservationSummary`・`renderReservationSummaryNote`・`getLiveSummaryText`、`renderLivePostSave`、`setLiveReservationView`・`renderReservationDetail`・`renderReservationAddForm`、`renderLiveRow`（`renderLiveItem`の置き換え。classとdata属性`data-live-edit`・`data-live-id`・`data-live-category`は残す）、`saveTicketSettings`・`recomputeTicketDirty`、`syncLiveEditingBody`（`body.is-live-editing`）、`getFlyerFormHtml`。
- 触る既存の関数: `renderModeBadge`・`applyApiFallbackReadOnlyState`（新しい操作のidを足す）、`setupTabs`・`requestLiveEditorTransition`・`setLiveWorkspaceView`・`setLiveListView`・`setTicketSettingsOpen`・`addLive`・`editLive`・`closeLiveEditor`（確認の面とPromise対応）、`renderLive`・`renderLiveItem`、`buildLiveEditorHtml`・`openLiveEditor`・`wireLiveOperationsModal`・`setLiveEditorTask`、`setLiveEditorDirty`・`markLiveEditorDirty`・`bindLiveEditorDirtyState`、`saveLiveWorkspace`・`deleteLiveFromWorkspace`・`saveToApi`（引数を受けられるようにする）、`renderLiveReservationLedger`・`renderTicketRow`・`loadTickets`・`loadLiveReservations`・`markTicketStatus`・`submitManualReservation`・`downloadTicketsCsv`（表示だけ）、`renderTicketSettings`（入力を下書きへ）、`handleLiveSourceParse`の文言、`handleImageSelect`・`clearImage`の文言（`edit-image`だけ）、`beforeunload`。`saveLiveItem`・`readLiveFromModal`・`getLiveShareUrl`・`updateXPreviewInModal`・`calculateActiveReservationTotals`・`normalizeLiveSourceIntakePayload`・`LIVE_SOURCE_INTAKE_*`は**中身を変えない**（固定の試験で縛る）。

### Workerの集計

`cloudflare/worker/src/worker.js`に、`handleRequest`の`/api/admin/ticket-reservations/…/status`の前後に`GET /api/admin/ticket-reservation-summary`を足す。`jsonResponse`が`Cache-Control: no-store`とCORSを付ける。`OPTIONS`は既存の分岐で204（`GET`は許可済み）。応答の形・規則は設計提案版§5.4。DBのschema・migration・secret・binding・`ALLOWED_ORIGINS`は変えない。READMEに経路・応答・公開順序を足す。

### 見た目（CSS）の要点

figma snapshotのspec（`admin-live-layout-spec.md` §4.1〜4.3）の値を、tokensの変数に当てる。主なもの: 本文の余白20/16・gap 16、入力欄の高さ52・角丸12、Button/Primary高さ46・Secondary 48、2択の切り替え（白・角丸12・padding 4）、公演の中の切り替え（3等分・下線2px・padding 14/0）、折りたたみの行（高さ50・角丸12・padding 14/16）、入・切の切り替え（44×26）、予約の札（未対応は`color/accent-soft`・`color/accent`、対応済みは`color/gray-100`・`color/subtext`、キャンセルは白地・線1px・`color/subtext`）、Header（padding 12/16・下線1px）。タップの高さは44px以上（折りたたみの行・切り替え・札を含む）。数値は変数があればそれを使い、無い値は`admin/style.css`の既存の値に合わせる（新しい色・余白のtokenは足さない）。

## 3. 変更ファイルと設計書の昇格

| path | 変更範囲 |
|---|---|
| `admin/index.html` | Liveタブの構造（編集面のHeader・確認の面`#live-dialog`・Ticket共通設定の専用画面・予約管理の一覧→1件・`+ 新しいライブ`の文言）、`style.css`・`app.js`・`music-data.js`の`?v=`を`20261120-46`、`ADMIN_BUILD_ID`、`saveBtn`の表示条件のclass。Site・News・YouTube・Disco・Profile・modalの構造は変えない。既存の`id`（`live-workspace-*`・`live-list-*`・`live-master-*`・`live-editor-*`・`tickets-*`・`ticket-*`）は残す。 |
| `admin/app.js` | §2の関数。1ファイル。 |
| `admin/style.css` | Liveのまとまりの内側にclassを足す・直す。他のまとまりは変えない。 |
| `admin/README.md` | 運用（Liveの新しい流れ・保存して公開の条件・削除・共通設定の保存）、手元での確認（§7）、反映順序とrollback（§8・§9）、他のタブの保存の動きは今のままの説明。 |
| `cloudflare/worker/src/worker.js` | 集計の関数・経路・`export`。他は変えない（差分は追加のみ）。 |
| `cloudflare/worker/README.md` | 集計APIの経路・応答・数え方・認証・新旧の組み合わせ・公開順序・rollback。 |
| `docs/specs/current/live-operations-admin-ui.md`・`README.md` | 下の提案版をexact bytesで昇格。 |
| 新規`test/support/admin-app-harness.mjs` | `admin-live-operations.test.mjs`にあるharness（`loadAdminApp`・`createElement`・補助）をそのまま切り出す（動きは変えない。切り出し後に全試験の数が同じこと）。 |
| 新規`test/admin-live-pin.test.mjs`、`test/admin-live-save.test.mjs`、`test/admin-live-screens.test.mjs`、`test/admin-live-style.test.mjs`、`test/fixtures/admin-live-states.json`、`cloudflare/worker/test/ticket-reservation-summary.test.js` | §5のT46試験と架空のfixture。Node標準機能だけ。依存は足さない。 |
| `test/admin-live-operations.test.mjs`・`test/admin-image-form.test.mjs` | 意図して変える所だけ（§4・§5）。固定の試験は消さない。 |
| 新規`aidlc-docs/construction/aidlc-integration/verification/capture-admin-live.py`・`fake_admin_api.py`・`fake_admin_server.py` | Front用の撮影script、架空のAPIの共通モジュール、手元配信のserver（§6・§7）。 |

`assets/js/live-operations.js`・`assets/js/music-data.js`・`assets/js/*`の公開側・`assets/css/1212-music.tokens.css`・`DESIGN_RULES.md`・各ページのHTML・`cloudflare/worker/schema.sql`・`wrangler.toml`・`data/`は変更しない。

### exact bytesの提案版

提案版は昇格後の最終形（Status: Approved、Owner approvalは#46のgate 3を参照）。配置時点では未承認候補であり、Approvedという文字列だけで昇格しない。直さない節は今の文面を保ち、#47の行・#33・#35・#37の節は変えていない。変更は、先頭の記録・§4.5の1文・§4.6の末尾（#46の保存契約）・§5.4（新設）・§6の2文・§9の箇条2つ・§10.2（新設）・§11.2の#46の行・§12.3のADM-40-03の行・§12.4（新設）・§13.4（新設）・§14の箇条3つ・§15.1の箇条3つ。

| 提案版（aidlc-docs/から） | 昇格先 | 提案版SHA-256 | 昇格前の元版SHA-256 |
|---|---|---|---|
| `construction/aidlc-integration/canonical-proposals/live-operations-admin-ui.md` | `docs/specs/current/live-operations-admin-ui.md` | `4035f4e793a44f414eea787d4b9a79314d12ee98f3649fcb72bb9d748ea7ef8a` | `80a3363ed23b60bfc42dcd8a03583cbbf89ce27a6ca18b1b6ed26dd63ce4e62f` |
| `construction/aidlc-integration/canonical-proposals/README.md` | `docs/specs/current/README.md` | `d5b35b8eb81f438dacc60037830dcaa8dc5beb994a2335feff16aaf8ba63cb3e` | `1569ff994f9caf2f0642ae37df8a8df5ae31f4ed71741e6a61c4309ec6a7a8e3` |

手順: 確認1の3承認digestと提案版hashを照合→現在の昇格先が表の元版hashであることを確認→対応する提案版のbytesをそのまま昇格先へcopy→提案版と昇格先のSHA-256一致と、元版からの差分範囲（上の変更箇所だけ）を確認→実装開始。文字の置換、日付の追補、書式の変更を昇格時に加えない。昇格先が元版hashと違っていたら（他のIssueが先に昇格した場合）、上書きせず停止し、Frontへ差分を返す。Figma整合で意味・採用値が変わった時も同様に停止し、候補の修理と新しいhashの承認で解消してから再開する。`system-design-principles.md`は変えない（管理画面の保存契約を持たない）。`public-site-ui.md`も変えない。

Figma整合案もgate 3の対象に含める: `aidlc-docs/construction/aidlc-integration/figma-fix-requests.md` SHA-256 `31ee3c2a9d8ca086099b4ff920e5aeb5b3783f359bf24aa0fceaa51b03d9ba77`。

## 4. 実装の8段とfocused test

作業前にNode20を選ぶ。以下のcommandはexecution targetから実行し、RED/GREENのexitと対象ACをverification logへ残す。新規試験名は提案で、承認後に作る。承認済みplanには進捗checkboxを足さず、state/resultへ記録する。

```bash
export PATH=/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH
node --version
```

| 段 | 作業とRED→GREEN / focused command | 見積 |
|---|---|---|
| 1. 入力・昇格・今の動きの固定 | cycle・承認・提案版・元版hashを照合し、2つの設計書を同じbytesで昇格。harnessを`test/support/admin-app-harness.mjs`へ切り出し、全試験の数が変わらないこと（776 / 0）を確かめる。架空fixture`admin-live-states.json`（§5）を作る。`T46-PIN`と`T46-FIXTURE`を**現行コードに対して**書き、GREENで固定する（不要なREDは作らない）。Workerの既存API（予約の一覧・状態・取り置き・CSV・site-data・認証）の応答の形も`T46-PIN`に固定する。`node --test test/admin-live-pin.test.mjs test/admin-live-operations.test.mjs test/live-operations.test.mjs` | 3h |
| 2. Workerの集計 | `ticket-reservation-summary.test.js`（T46-SUM）を先にRED→`summarizeTicketReservationRows`・経路・`export`をGREEN。認証前にDBを読まない、列が個人情報を含まない、応答のkey集合が固定、既存の経路の応答が不変（`manual-ticket-reservations.test.js`・`public-ticket-boundaries.test.js`を無変更で通す）。`node --test cloudflare/worker/test/ticket-reservation-summary.test.js cloudflare/worker/test/manual-ticket-reservations.test.js cloudflare/worker/test/public-ticket-boundaries.test.js` | 2h |
| 3. 保存の土台 | `T46-SAVE`・`T46-GUARD`・`T46-DELETE`・`T46-SCOPE`・`T46-TICKET`を先にRED。`openLiveDialog`、未保存の判定（`snapshotLiveEditor`）、`saveScoped`と3つの重ね方、`saveLiveWorkspace`・`deleteLiveFromWorkspace`の差し替え、`requestLiveEditorTransition`のPromise対応、Ticket共通設定の下書きと`saveTicketSettings`、`beforeunload`の追加をGREEN。**DOMの見た目はこの段では最小**（既存のフッターの「保存して公開」・削除ボタンのまま、確認の面と保存の動きだけ新しくする）。`node --test test/admin-live-save.test.mjs test/admin-live-pin.test.mjs test/admin-live-operations.test.mjs`。区切りとして§5の全試験1回目。 | 6h |
| 4. 一覧と集計の表示 | `T46-LIST`を先にRED。`reservationSummary`・`loadReservationSummary`・`renderLiveRow`・案内の1行・Next Live・Local/API失敗・空の一覧・予約の切り替えの枚数、`index.html`の一覧の構造をGREEN。古いWorker（404）・認証失敗・通信失敗の組み合わせ。`node --test test/admin-live-screens.test.mjs test/admin-live-pin.test.mjs` | 3h |
| 5. ライブを開いた画面と新規・告知 | `T46-OPEN`・`T46-FIELDS`・`T46-NEW`・`T46-DRAFT`・`T46-ANNOUNCE`・`T46-IMAGE`を先にRED。Header 1行・`body.is-live-editing`・3等分の切り替え・公開内容の並び（フライヤー先頭・折りたたみ2つ・区分・削除の文字）・下に固定の「保存して公開」・新規の`source`→`edit`→`postsave`・告知の画面・`LIVE_UI_TEXT`と旧文言の試験の更新（AIの実行中・失敗、ボタン名）をGREEN。ボタン3つの列、確認の面を挟まないこと。 `node --test test/admin-live-screens.test.mjs test/admin-live-operations.test.mjs test/admin-image-form.test.mjs` | 7h |
| 6. 予約・取り置き・予約管理 | `T46-RESERVE`・`T46-AUTH`を先にRED。予約の一覧（合計・札・絞り込み）、予約1件（状態の操作・内部メモ・受付元）、取り置きの追加の画面、予約管理の一覧→1件・CSVで書き出す・状態の変更の成功で一覧へ戻る・失敗の表示をGREEN。状態の変更・取り置きの送る内容・数え方は`T46-PIN`が無変更で通ること。`node --test test/admin-live-screens.test.mjs test/admin-live-pin.test.mjs test/admin-live-operations.test.mjs`。区切りとして§5の全試験2回目。 | 6h |
| 7. 幅900px以上・CSS・共通設定の画面・外枠 | `T46-STYLE`・`T46-MODE`・`T46-COMPAT`を先にRED。幅900px以上のmaster-detail（見出しの右の「保存して公開」・2〜3列・予約の表と右の面・予約管理の表）、Ticket共通設定の専用画面、`style.css`のLiveのまとまり、`saveBtn`の表示条件（API接続中のLiveでは隠し、他のタブ・Local Mode・未保存の他タブの変更がある時は出す）、他のタブのCSS・markupが変わらないことをGREEN。`node --test test/admin-live-style.test.mjs test/admin-live-screens.test.mjs test/admin-live-operations.test.mjs` | 5h |
| 8. 画面確認の材料・README・結果 | Workerが§6の撮影script・`fake_admin_api.py`・`fake_admin_server.py`・fixtureの全scenarioを完成させ、構文を検査してFrontへ渡す（localhostのbindができないためWorkerは実行しない）。`admin/README.md`・`cloudflare/worker/README.md`・`ADMIN_BUILD_ID`と`?v=`・版の一致試験を更新。§5の全試験3回目（最終）。結果（code-generation-summary・build-and-test-summary）を固定しFrontへ返す。Frontが撮影・全画像の目視・独立review手配を行う。修理は影響するfocused testと該当画像を再確認し、全体へ波及する新しい変更だけ全試験を追加する。 | 5h |

段3・5・6では、先行する共有の変更が既存試験を壊したら、その時点で原因を直してから次へ進む。全試験を通すために未移行の保護を消さない。既存の試験を変えた時は、試験名・変えた理由（どの要件か）・変えていない動きのassertを`code-generation-summary.md`の「更新した既存試験」の表に残す。

## 5. 決定論的試験と全試験

fixture `test/fixtures/admin-live-states.json`は`home-states.json`と同じ形（`meta` / `data` / `scenarios`）。値はすべて架空（会場は「テスト会場A」のような名前、URLは`example.test`、人名は架空）。dataのライブは本番の形を持つ4通り（時間・料金・予約のキーを持つ完全な形／説明文が空の形／時刻が空の形／7キーだけの旧形式）で、開催予定2件・公演終了6件以上。次を含める: タイトルが空のライブ、日付の書き方3通り（`YYYY-MM-DD`・`YYYY.M.D`・曜日つき）、料金の書き方の混在（`¥`あり・なし・`free`・空）、フライヤーなし1件・絶対URLと相対pathの混在、今日の日付のライブ、重複タイトル、130字の説明・100字の出演者、`live.ticketLink`、#41の3項目を持つSiteと作品。予約rowsは0件・1件・多数（二桁の行）・未対応あり／なし・対応済み・キャンセル・手動（`source: manual`、連絡先・内部メモあり）・Web（e-mail・備考あり）。`summary`の期待値（規則どおり）を持つ。scenarioは`base` / `legacy-only` / `no-reservations` / `many-reservations` / `summary-404` / `summary-401` / `summary-500` / `api-fallback` / `local-mode` / `save-fail` / `delete-fail` / `status-fail` / `draft-fail` / `empty-lists`。

| 群 | 必須assert / AC |
|---|---|
| T46-PIN（段1、現行コードでGREEN） | (a) `saveLiveItem`が作る項目（`id`・`date`正規化・`title`・`venue`・`openTime`・`startTime`・`ticket`・`notes`（`※`除去・空行除去）・`performers`正規化・`description`（欄が無ければ元の値）・`image`・`link`・`sourceText`・`ticketUrl`・`reservationClosed`・`xComment`、元の未知のkeyを保つ）と、保存先の区分の先頭へ追加・元の区分から除去。(b) 旧形式（7キー）を開いて何も変えず保存した時のkey集合と値（日付が`YYYY-MM-DD`へ変わる、曜日の不一致が直る、`ticketUrl`が既存の規則だけで推定される）。(c) 保存のPUTが`/api/admin/site-data`・`PUT`・JSON本文・既存の他のkey（`live.ticketLink`・`site`・`discography`・`youtube`・`profile`・`ticket`・`contact`・`news`）を保つこと。(d) 削除がsiteDataから外し、headerの保存で同じ内容がPUTされること。(e) 予約の状態変更が`POST /api/admin/ticket-reservations/{id}/status`・本文`{"status":…}`で、成功後に一覧と台帳を取り直すこと。合計がキャンセルを除く件数・枚数であること。(f) 取り置きの追加の本文（`liveId`・`name`・`quantity`、任意の`contact`・`internalNote`）と検査（お名前・1〜10）。(g) 告知文（`buildXAnnouncementText`）と共有用のアドレス（`getLiveShareUrl`）が、既存の試験どおり。(h) Ticket共通設定の保存の形（`ticket.completeText`・`fields`の6項目、`introText`・`noticeText`が無い）。(i) 下書き作成の送る内容・10項目の置き換え・失敗時の保持（既存の試験を無変更で通す）。(j) Workerの既存の経路の応答の形。AC46-05・08・13。 |
| T46-FIXTURE | 4通りの形・タイトル空・日付3通り・画像なし・長い文で、一覧の描画・開く・保存・開き直しが例外なく、各欄が空で開くこと。開き直した値が保存した値と同じこと。AC46-14。 |
| T46-SUM（Worker） | 認証なし・誤りは401で、DB（`prepare`）を呼ばない。成功は200、`summaries`が`liveId`昇順、`records`・`seats`・`pending`がキャンセルを除いた規則どおり（未対応のみ・対応済みのみ・キャンセルのみ・混在・manual・数でない`seats`・空）、応答の全keyが`liveId`・`seats`・`records`・`pending`だけ（氏名・連絡先・備考・内部メモ・日時・idを含まない）、SQLに個人情報の列が無い（文字列で検査）。`OPTIONS`が204で許可メソッドに`GET`、CORSが不変。管理画面の`calculateActiveReservationTotals`と同じ入力で`seats`・`records`が一致する（`test/admin-live-pin.test.mjs`でWorkerの関数を取り込んで比べる）。AC46-03・09。 |
| T46-SAVE | 保存の状態の4つ（保存済み・未保存・保存中・失敗）の文言と、いつ変わるか。入力して戻すと変更なしに戻る。新しいライブは入力するまで未保存でない。保存中は入力・移動・削除・予約が押せず、二重のclickは1回しか送らない。失敗でsiteDataが保存前へ戻り、入力・編集面が残り、理由が出る。必須が空なら保存せず空の項目の下に文言。日付と区分の警告は保存を妨げない。保存成功後は同じ編集面に留まり（新規は`postsave`へ）、今のタスク（公開内容／告知）を保つ。Local Modeは`markChanged`と「JSON書き出し待ち」。AC46-07・11。 |
| T46-GUARD | 未保存で、別のライブ・一覧へ戻る・開催予定／公演終了・Liveページ／予約管理・グローバルタブ・「+ 新しいライブ」・Ticket Page共通設定へ移ろうとすると確認の面が出て（文言・ボタン・初期のフォーカスは「編集を続ける」）、「編集を続ける」・Esc・背景では何も変わらず、「破棄して移動」で移る。変更がない時は面を出さず同期で動く。公開内容／告知／予約の切り替えでは出ない。画像のアップロード中も出る。Ticket共通設定の未保存も同じ。`beforeunload`がLive・共通設定の未保存・保存中で止める。AC46-07。 |
| T46-DELETE | 確認の面の文言3種（予約なし・予約N件・件数不明）とボタン。「やめる」で何も変えない。「削除する」で`PUT`の本文がbaselineから該当のライブだけを除いたもの（他のkey・未保存の他タブの変更を含まない）。成功で一覧へ戻り、一覧・予約管理の絞り込み・集計を更新。失敗でライブが一覧に戻り、編集面と入力が残る。新しいライブには削除が出ない。Local Modeは今の動き。予約の件数の決め方（読み込み済み・取得・失敗）。AC46-07・08。 |
| T46-SCOPE | 保存の本文が`savedBaseline`の複製＋対象だけであること: (1) Site・News・Profile等に未保存の変更があっても、Live保存・削除・共通設定の保存の本文に入らず、headerの待ち（`hasChanges`）が保存前の値のまま残る。(2) 共通設定の未保存の入力はLive保存の本文に入らず、Live・削除は共通設定の保存の本文に入らない。(3) `live.ticketLink`・#41の3項目・`site.heroImage`・他のlive・作品を落とさない。(4) 保存の成功で`savedBaseline`が更新され、続く保存の本文が最新になる。(5) 失敗で`savedBaseline`は変わらない。(6) 重複`id`はPUTせず拒否。AC46-08。 |
| T46-TICKET | 共通設定の画面の構造（7項目・`id`・ラベル）。入力はsiteDataへ反映せず、保存で`ticket`のsliceだけをPUT。保存の状態4つ、未保存の時だけ下の操作、失敗で入力が残る、`introText`・`noticeText`が出ない。AC46-05・07。 |
| T46-LIST | 開催予定の行に「予約 N枚」と「未対応 N」（未対応0なら札なし、予約なしは「予約 0枚」）、公演終了には出ない。ライブ名・日付・会場・画像なし・Next Live。読み込み中・取得失敗（404・500・形の不正・通信）で案内1行、認証失敗で別の案内、API接続失敗・Local Modeで呼ばず案内なし。保存・予約の操作が案内の有無に関わらず動く。古いWorker（404）で`PUT`・予約の経路が呼ばれ続けること。連続の呼び出しで古い応答を捨てる。AC46-03・09。 |
| T46-OPEN | ライブを開いた時のDOMの構造（Header 1行の要素、右は状態の文字だけ、切り替えが3つ・予約に枚数、`body.is-live-editing`、公開内容の最初の入力欄がフライヤーの次）、タップの高さ（CSSのmin-height 44px）、`保存して公開`・開催予定・公演終了が`white-space: nowrap`。入力欄の数の実測は撮影（AC46-01・04）で行い、ここは構造だけ。AC46-01・04。 |
| T46-FIELDS | §6の対応表の全項目が編集面に存在し、`id`・`name`が今と同じで、保存で今と同じ項目に入る（旧詳細・予約URL・受付終了・リンク・区分・ひとこと・元情報・フライヤー・画像の保存の動き）。折りたたみの中の項目が`hidden`でなく開けば入力でき、開いていなくても値が保存される。AC46-05。 |
| T46-NEW | 新しいライブの押下の列が「下書きを作る」→「保存して公開」→「Xで告知する」の3つで、間に確認の面が出ない。`source`→`edit`→`postsave`の遷移、`edit`の構成（公演の中の切り替え・区分・削除・元情報の作り直しが出ない）、`postsave`の文言と「あとで」で一覧へ戻る、「Xで告知する」が保存と別でX投稿の画面を開く（保存・送信は呼ばない）。保存前の告知・予約の「保存すると使えます。」。手入力で作る。AC46-02。 |
| T46-DRAFT | 実行中の文言とボタンの無効、成功のprovider表示（設計§7.4の固定文）、失敗の文言2行、入力と元情報が残る、待機中の入力の変更・別のライブへの移動で古い応答を反映しない（既存の試験を、文言の更新だけで通す）。AC46-02・13。 |
| T46-ANNOUNCE | 告知の構成（ひとこと・投稿の内容・「Xで告知する」・2つのコピー）、ひとこと変更が未保存になる、コピーの成功・失敗の文言、保存前に押せない、投稿の内容と共有用のアドレスが今と同じ。AC46-05・13。 |
| T46-IMAGE | フライヤーの表示（未選択・登録済み・画像なし）、アップロード中・失敗の文言（`edit-image`だけ）、他のタブの画像の文言が今のまま（`admin-image-form.test.mjs`を通す）、プレビューを押して保存できる。AC46-05・10。 |
| T46-RESERVE | 予約の一覧（合計がキャンセルを除く、札、絞り込みの選択・解除、0件の文言）、予約1件（行・内部メモ・受付元、未対応は2操作、対応済み・キャンセルは「未対応に戻す」だけ）、状態の変更の成功で一覧へ戻り集計が更新される、失敗の文言、取り置きの追加（検査・本文・成功で一覧へ戻る）、予約管理（絞り込みの初期値・行・1件・CSV）、古い応答の破棄。送る内容・数え方は`T46-PIN`。AC46-05。 |
| T46-AUTH | 合言葉が未入力で入力の窓を閉じた時、通らなかった時の、一覧・予約・保存の近くの「認証できませんでした。」。再入力後の再試行。AC46-11。 |
| T46-MODE | API接続失敗は読み取り専用（新しい操作のid・ボタンがすべて無効、集計を呼ばない）。Local Modeは保存のボタンが「JSONを書き出す」、集計・予約・下書き・CSVが使えない。AC46-11。 |
| T46-STYLE | 新しいCSSがLiveのまとまりに閉じる（`admin/style.css`の既存のLive以外のまとまりのbytesが基準と同じ。`git show`の基準commitと比べる）、色が`var(--…)`のみ（`#`の直書き・新しい`rgb`が無い）、44pxのmin-height、幅899/900の境界、固定フッターの祖先にスクロールの仕組みが無い（既存の試験の条件を新しい構造へ移す）、幅900px以上で見出しの右のボタンが薄く押せない。AC46-10・11。 |
| T46-COMPAT | 公開側の出力・他のタブの描画（News・YouTube・Disco・Profile・Site・modal）・`handleImageSelect`の他タブの文言・headerの保存（`saveData`）の動きが、基準commitと同じ。`live-operations.js`のbytesが基準と同じ。AC46-10。 |

**全試験**（段3・段6・段8の3回。区切りだけ）:

```bash
export PATH=/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH
node --test test/
npm --prefix cloudflare/worker test
node --check admin/app.js
node --check cloudflare/worker/src/worker.js
python3 -B -c 'import ast,sys; [ast.parse(open(p).read()) for p in sys.argv[1:]]' aidlc-docs/construction/aidlc-integration/verification/capture-admin-live.py aidlc-docs/construction/aidlc-integration/verification/fake_admin_api.py aidlc-docs/construction/aidlc-integration/verification/fake_admin_server.py
scripts/aidlc-verify.sh --local
git diff --check
git status --short
```

基準（Front着手前）はサイト776 pass / 0 fail、Worker347 pass / 0 fail。基準より減らない（意図して置き換えた試験の差は結果に表で示す）。減った数と増えた数の内訳を`build-and-test-summary.md`に書く。`node --test test/`はNode v24で動かないので、必ずv20.19.4を使う。

## 6. Frontの画面確認（撮影）

Workerはlocalhostをbindできないため、撮影scriptと架空のAPI・fixtureを用意し、Frontが実行する。

### 撮影scriptの契約

- 置き場: `aidlc-docs/construction/aidlc-integration/verification/capture-admin-live.py`（#45の`capture-profile-contact.py`を雛形にする）、共有の架空API `fake_admin_api.py`、画像・metrics・logは同じ`verification/`の下（`screenshots/`・`capture-admin-live-metrics.json`・`capture-admin-live.log`）。fixtureは`test/fixtures/admin-live-states.json`（Node試験と共通）。
- 実行: `/usr/bin/python3`（`-I`を付けない）＋Playwright 1.58.0。静的配信はFrontが`python3 -m http.server 8080 --bind 127.0.0.1`（worktreeのroot）で起動し、scriptは`--base http://127.0.0.1:8080`を受ける。時計は`page.clock.install(time=...)`（秒）で固定する。
- 通信: `context.route('**/*')`で、`http://127.0.0.1`・`http://localhost`のページ・assetだけを通し、`admin/config.js`はscriptが架空の設定（`apiBaseUrl: 'https://api.fixture.test'`・架空の合言葉）で応答して**実ファイルを読まない**。`https://api.fixture.test/**`は`fake_admin_api.py`の関数が`route.fulfill`する（`/api/admin/site-data`・予約の一覧・状態・取り置き・CSV・集計・下書き・画像の取得、`scenario`で応答を切り替える）。それ以外はすべて`abort`し、abortした一覧をlogへ残す（本番のAPI・本番の予約・AIのproviderへのrequestが出ないことの証拠）。X投稿の画面（`twitter.com`）への遷移は`window.open`の呼び出しだけを記録し、開かない。
- 画面: §5（Requirements）のP46-01〜16。幅390・360・1440と、2列以上になる画面（P46-01・06・10・11・13・14）は821・900・1011も。状態ごとに1枚（画像の名前は`{画面}-{状態}-{幅}.png`）。操作の列（新しいライブの3押下、保存して公開、削除の確認、予約の状態変更）は、各段の直後に撮る。
- 実測（metrics）: ADM-46-01=幅390×844と390×667で、ライブを開いた直後（公開内容、スクロール0）の、全体が画面に入る`input`・`textarea`・`select`（非表示・ファイル入力を除く）の数（3以上）。ADM-46-04=幅390・360で、「保存して公開」「開催予定」「公演終了」と上の帯の文字を`Range.getClientRects`の行（文字nodeの行）で数え、各1行。要素の高さで行数を判断しない。そのほか: 横スクロールが出ない（`scrollWidth <= innerWidth`）、主要な操作の高さが44px以上、ボタン・入力に表示名がある、`body.is-live-editing`で隠れるはずの要素が隠れている、幅900の前後でレイアウトが切り替わる、画像の読み込み失敗でレイアウトが崩れない。
- 合否: 各画面の期待（構造・実測）を検査し、不合格があっても最後まで撮り、末尾でまとめて失敗（exit 1）にする。合格の基準は`T46-OPEN`の構造・上のmetrics・fixtureの全scenarioが例外なく描画されること。
- 目視: Frontが全画像を見て、figma snapshotのrender（`render-44-*`・`render-47-*`・`render-50-*`）と並べて、配置・文字の大きさ・色・余白・状態を確かめる。マスタに描かれていない画面（Figma整合案F46-12・13・14）は採用値どおりかを確かめる。差があれば、Figmaを直すか実装を直すかをFrontが決め、実装の修理は影響するfocused testと該当の画像だけを再確認する。
- 本番の公開データでの画面確認: 管理画面は認証が要り、予約は個人情報なので、本番の値では撮らない。本番の形（Requirements §7）は架空のfixtureで撮る。本番の見え方（件数の桁・実際の予約の数）は、Itsukiがmerge後に画面で確認する（§8）。

## 7. Itsukiが自分で触る確認

管理画面は管理用の合言葉が要り、公開側の手元配信の手順をそのまま使えない。**推奨は、架空のAPIで動く手元配信**（本番のデータを一切書き換えない）。

### 推奨: 架空のAPIの手元配信（merge前）

- 仕組み: `fake_admin_server.py`（標準ライブラリだけ）が、branchの管理画面の必要なファイル（`admin/index.html`・`app.js`・`style.css`、`assets/css`・`assets/js`、架空のフライヤー画像）だけを許可して配り、`/admin/config.js`を**実ファイルを読まずに**架空の設定（同じ配信元をAPIとする、架空の合言葉）で応答する。`/api/admin/*`は`fake_admin_api.py`が、メモリ上の架空のデータ（fixtureと同じ形）で応答し、保存・削除・予約の状態変更・取り置きはメモリに書くだけ。サーバーを止めると元に戻る。許可外のpath（`.git`・`admin/data`・他のディレクトリ）は、管理画面が呼ばないので404でよい（管理画面が呼ぶ経路には404を返さない）。
- 起動（Front）: `/usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/fake_admin_server.py --port 8080`（worktreeのrootから）。架空の合言葉は設定が渡すので、**入力の窓は出ない。本物の合言葉を入力しない**。このserverは、管理画面が呼ぶ経路に401・404・5xxを返さない（管理画面の`adminFetch`は、これらを受けると本番のAPIへ切り替えて再送する作りで、本番へrequestが出るため）。合言葉の入力・未入力・違う時、古いWorker（集計が404）、通信の失敗の表示は、撮影（§6。本番へのrequestを遮断する）で確かめ、手元配信では試さない。
- PCで触る: ItsukiのPCのブラウザで`http://127.0.0.1:8080/admin/`を開き、開発者ツールの画面幅を390にする。
- スマホで触る: PCで起動したまま、tunnel（例: `cloudflared tunnel --url http://127.0.0.1:8080`）の公開URLをスマホで開く。URLを知る人は架空のデータだけを見られる（個人情報・本番の値はない）。tunnelが遮断される場所では、PCの幅390の表示で代える。
- 触って確かめること（本番の表記）: Liveタブで、一覧の「予約 N枚」「未対応 N」、ライブを開いた時の上の帯と入力欄、「+ 新しいライブ」→元情報を貼る→「下書きを作る」（架空の下書きが返る）→「保存して公開」→「Xで告知する」の3つ（Xの画面は開くだけで、投稿はしない）、フライヤー、「予約先・リンクなど」、「保存して公開」が未保存の時だけ下に出ること、削除（確認→消える）、予約→1件を開く→「対応済みにする」、「+ 取り置きを追加」、予約管理、Ticket Page共通設定（変更→「保存して公開」）、未保存のまま移ろうとした時の確認。
- 書き換わるもの: メモリ上の架空のデータだけ。本番のD1・予約・公開データは書き換わらない。後始末はサーバーを止めること。
- 見えないこと: 本番の予約の数の桁、本番のAIの下書き、実際の合言葉の通り方、通信の速さ。これらは§8の本番のread-onlyの確認と、merge後のItsukiの確認で補う。

### なぜ本番APIを相手にしないか

- 現行コードのAPIのCORSの許可元（`wrangler.toml`の`ALLOWED_ORIGINS`）は、本番のドメイン・Workersのドメインと、`http://127.0.0.1:8080`・`http://localhost:8080`・`:8888`・`null`だけ。**tunnelのURLは許可されない**ので、スマホからtunnel経由で本番APIにつなぐと、通信が止まり読み取り専用（API接続失敗）の表示になる。許可元を足すにはWorkerのvarsの変更が要り、範囲外。
- PCの`127.0.0.1:8080`から本番APIにつなぐ方法はあるが、`admin/config.js`（追跡されている）の中身を参照できない（Front・Workerは値を見ない）ため、どのAPIへつながるか・合言葉を入れるかを計画で保証できない。つながった場合、保存・削除・予約の状態変更が**本番のデータを書き換える**。
- 本番のデータを書き換える操作を確認に含めない。必要なら、Itsukiが自分で「保存して公開」を押す1回を、merge後の確認（§8）に置く。

### merge後の確認（本番の表記。Itsukiが見て判断する）

Pagesの反映（数分）のあと、管理画面を再読込して次を見る。

1. Liveタブの開催予定の一覧に、ライブごとの「予約 N枚」と、未対応があれば「未対応 N」が出る。数が実際の予約と合うか（予約管理の「未対応」の件数と見比べる）。
2. ライブを1つ開く。上の帯が1行で、日付・会場・ライブ名などの入力欄が最初の画面にいくつも見え、フライヤーが先頭にある。
3. 予約→1件を開く。内容と操作が出る（状態は変えない）。
4. 次に実際に行う更新を1件、「保存して公開」まで行い、公開サイトに反映されることを確かめる。これが本番を書き換える唯一の操作で、Itsukiが自分の判断で行う。

## 8. 出し方: Worker deploy → mergeの順番

GitHub Pagesがmainから配信するため、mergeした時点で本番の管理画面が入れ替わる。**Workerを先にdeployし、本番の古い管理画面が今のまま動くことを確かめてからmergeする**（新しい管理画面と古いWorkerの組み合わせを作らない）。集計の経路は追加だけなので、新しいWorkerに古い管理画面がつながっても、今と同じ動きになる。

1. **事前（Front）**: PR最終版のcommitと試験済みのコードが一致し、作業ツリーがcleanで、Workerの差分が追加だけ（`git diff e191e53 -- cloudflare/worker/src/worker.js`）であることを確かめる。`cd _worktrees/1212hp-46-admin-live-ops/cloudflare/worker && npx wrangler@4.65.0 deployments list`（読み取りだけ）で、今のversionを**戻し先として控える**（控えが取れない時はdeployへ進まない）。公開GET（`/api/public/site-data`）の状態・形・`meta.updatedAt`と本文のSHA-256、`OPTIONS`のCORS header、認証なしの`GET /api/admin/site-data`が401、認証なしの新しい経路が404（古いWorker）を、読み取りだけで控える（合言葉は使わない）。
2. **Itsukiの明示承認** → Frontが同じ場所で`npx --yes wrangler@4.65.0 deploy`を実行する。`BYPASS_ADMIN_TOKEN`・binding・varsが変わらないことをdeployの出力で確かめる。
3. **deploy後（Front、読み取りだけ）**: 認証なしの新しい経路が401（`{"error":"unauthorized"}`。経路があり、認証で守られている）、公開GETの状態・形・`meta.updatedAt`・本文のSHA-256が事前と同じ（データが書かれていない）、`OPTIONS`のCORS headerが同じ、認証なしの`site-data`が401、既存のライブのOG（`/og/live/{公開データのid}`）が200で今のとおり。**予約・認証付きの応答は取得しない**。
4. **本番の古い管理画面の確認（Itsuki）**: 今の本番の管理画面（まだ入れ替わっていない）を再読込し、Liveの一覧・予約管理が今のとおり動くことを見る（読むだけ。操作で書き換えない）。1〜2分。
5. **確認2のAの後、PRのmerge（Itsukiの明示承認）**。Frontが、Pagesのbuild・配信されたassetの版（`ADMIN_BUILD_ID`・`?v=20261120-46`）を読み取りで確認し、ItsukiへmergeとPagesの反映を知らせる。
6. **merge後の確認（Itsuki、§7）**。問題がなければIssue・ProjectをFrontが閉じる。

deploy後にPRのコードが変わった時は、影響する再試験とdeploy済みrevisionの一致をFrontが確かめるまでmergeしない（Workerの差分が変わった時は、再deployの承認から）。

## 9. rollbackと失敗・停止

| 段 | 失敗・不具合 | 戻し方 |
|---|---|---|
| 実装中（merge前） | 試験の失敗・本番データの形で崩れる | 該当の段の修理。承認済み計画・提案版を書き換えず、新しいhashの承認が要る変更はFrontへ返す。 |
| Worker deploy | deploy自体が失敗 | 何も変わらない。原因を直して再実行（再承認）。 |
| deploy後・merge前 | Workerの不具合・古い管理画面が動かない・merge見送り | mergeしない。Itsukiの承認で、控えた直前のversionへ`npx wrangler@4.65.0 rollback <version-id>`。Frontが公開GETと認証なしの経路を読み取りで再確認する。集計の経路は追加だけなので、**Worker自体に不具合がない限り戻さずに残してよい**（古い管理画面は新経路を呼ばない）。GitHub Pagesはまだ旧mainなので、静的側の操作は不要。 |
| merge後 | 管理画面の不具合（保存・削除・予約が動かない、表示が崩れる） | **保存を止める**（Itsukiは更新をやめ、公開内容の更新は後で）。Frontが#46差分だけを戻すrevert PRを準備し、Itsukiが承認・mergeする。Pagesが旧adminを配信したこと（`?v=`・`ADMIN_BUILD_ID`）をFrontが確認する。Workerは追加の経路なので、旧管理画面が新Workerにつながっても今のまま動く。Worker自体の不具合の時だけ、旧管理画面の配信を確認してからWorkerを直前のversionへ戻す。Pagesのcacheで旧版が残る端末は再読込する。 |
| merge後・データ | 保存が誤った内容を公開データへ書いた | 保存を止める。新しい管理画面の保存は既存と同じ形（全体を送る）で、他の領域を落とさない設計で試験済みだが、万一落ちた場合は、Frontが復旧の手段（D1の復元の可否は未確認。復旧の成立をそれに依存させない）と失われる更新をItsukiへ示し、別判断を求める。データの形・schemaを変えていないため、通常はコードのrevertで足りる。 |

予約・取り置き・状態の変更は、保存の経路と別でデータの形も変えないため、管理画面のrevertで戻る。D1のdata・予約は、通常の手順で巻き戻さない。

停止条件: 許可外のwrite・network・secret、`admin/config.js`の中身の参照、データの形・予約の状態と数え方・告知文・共有用のアドレス・抽出契約を変えないと要件を満たせない時、昇格先の元版hashが違う時、aidlc-cycleの手順外の故障、Figma整合で意味が変わった時は、実装を止めてFrontへ返す。

### 既知の制限（頻度・影響・戻せるか・作る量で選んだ）

- 別の端末の保存を取り込まない（最後に保存した側が残る）。今と同じ。1人で使い、同時に2台で保存する頻度が低い。#47で保存全体を見直す時に扱う。
- iOSのSafariでは、再読込・戻るの確認（`beforeunload`）が出ないことがある。画面内の移動（一覧へ戻る・別のライブ・別のタブ）は画面の確認で止まる。
- 集計の`records`・`seats`は予約の全件で数え、台帳の合計は最大200件の取得の範囲。200件を超えるライブで差が出うるが、1ライブの予約が200件を超える見込みは低い。
- ライブの一覧にライブ名が出ない（マスタの決定。F46-23）。
- 旧形式のライブを保存すると17キーになり日付の書き方が揃う（今と同じ。変えない）。

## 10. VF3（一覧の予約の枚数・未対応の件数）を外す場合に落とす範囲

確認1でItsukiがBで「外す」と返した場合、Frontは候補の修理（Workerへ差し戻し）と再承認を行う。外しても残りは成り立つ（保存・削除・予約・共通設定・スマホの帯は集計に依存しない）。

| 落とすもの | 内容 |
|---|---|
| 段 | 段2（Workerの集計）をすべて。段4は「集計の取得・案内の行・予約の数の表示」を落とし、一覧の行の置き換え・Next Live・空の一覧だけを残す。段5・6の「予約の切り替えの枚数」は台帳を読み込んだ後の合計だけにする（初期値を集計から取らない）。段8のWorker README・Worker deploy関連。 |
| ファイル | `cloudflare/worker/src/worker.js`・`cloudflare/worker/README.md`・`cloudflare/worker/test/ticket-reservation-summary.test.js`は変更しない。`admin/app.js`の`reservationSummary*`・`loadReservationSummary`・`renderReservationSummaryNote`・`getLiveSummaryText`、`admin/index.html`の案内の行、`fake_admin_api.py`の集計、fixtureの`summary*`のscenario。 |
| 試験 | `T46-SUM`と、`T46-LIST`の集計の項目（予約の数・案内の行・404・認証失敗）、`T46-PIN`の集計の一致の比較。残る試験は変えない。 |
| deploy | **Worker deployが不要**。§8の手順1〜4が消え、mergeだけになる（出し方が単純になる）。 |
| 設計提案版 | §5.4の削除、§6の1文を「一覧に予約の数は出さない（#46のgate 3でItsukiが確定した）」へ、§10.2の「一覧の予約の数」の行の削除、§12.4のADM-46-03を「対象外」へ、§11.2・§13.4・§14・§15.1・READMEの集計への言及を直す。提案版を作り直し、新しいhashの承認を得る。 |
| ADM-40-03 | 「未対応の予約があるかどうかが、一覧を開いただけで分かる」は満たされない（Itsukiの判断で外した範囲）。予約管理の絞り込みの初期値が「未対応」なので、未対応は予約管理を開けば分かる。 |

## 11. 時間の見積もり（実装からPRまで）

| 担当 | 内容 | 時間 |
|---|---|---|
| 後続Worker | 段1〜8（§4の表） | 約37時間（3＋2＋6＋3＋7＋6＋5＋5）。レビュー・修理の往復は含まない |
| Front | 昇格の照合・撮影の実行と全画像の目視・Figma整合・Worker deploy前後の確認・結果の受入 | 約6時間 |
| 独立review＋修理 | 実装後に1回（設計と実装）、指摘の修理と再検証 | 約4〜6時間 |
| Itsuki | 確認1・確認2の回答、手元での確認（任意）、deploy・mergeの承認、merge後の確認 | 約1時間（承認の待ち時間を除く） |

合計は連続して進めて約5〜6営業日。段3（保存の土台）と段5（ライブを開いた画面）が最も重く、ここで長引きやすい。Frontが長さの都合で段3の後と段6の後（全試験の区切り）でPacketを区切れる。

## 12. 結果ファイルと確認2

- Code Generation Result: `aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md`。実ファイルの一覧と昇格hash、段ごとのRED→GREEN、更新した既存試験の表、AC別の証拠、未確認を固定する。
- Build/Test Result: `aidlc-docs/construction/build-and-test/build-and-test-summary.md`と`aidlc-docs/cycle-summary.md`。基準との試験数の差、全試験・syntax・integrity・diffの結果、撮影のmetrics、独立reviewと修理、Itsukiが触る確認の結果を書く。**どちらも`- **Blocking Findings**: None`のfield形式**で書く。
- verification logは`aidlc-docs/construction/aidlc-integration/verification/logs/`（RED/GREEN・全試験・撮影）、画像は`verification/screenshots/`。
- 確認2: Itsukiへ、gate 4・5のfresh SHA-256の列挙と、§7の手元配信の入口（URLの渡し方・起動の手順）を渡す。触る確認の未実施を実施扱いにしない。Itsukiの閲覧は任意、**merge前に本人が画面を触って確かめることを推奨**。
- close: `scripts/aidlc-cycle.sh close 2026-11-20_issue-46_admin-live-ops`。closeのPacketの許可pathに、closeが作る一時path（`.aidlc-stage-*`・`.aidlc-idle-*`・`.aidlc-recovery-*`・`aidlc-docs/.audit-resume.*`・`docs/records/aidlc-cycles/2026-11-20_issue-46_admin-live-ops/`）を入れる。

## 13. 今回の返却点

本Packetは、Requirements・Workflow Plan・本計画・設計提案版2文書・Figma整合案・audit/stateまでで、approval recordを作らない。コード・試験・`docs/specs/current/`・`DESIGN_RULES.md`・`assets/`・`admin/`・`cloudflare/`・各ページのHTMLは変更していない。stateはRequirements承認待ち。
