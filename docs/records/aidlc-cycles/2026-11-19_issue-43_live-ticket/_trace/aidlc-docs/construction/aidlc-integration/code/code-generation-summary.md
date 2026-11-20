# Live一覧からTicket完了までの実装結果（Code Generation Result）

Live一覧・Live詳細・終了したライブ（全件）・Ticket・Ticket完了の5画面を作り直しました。ライブを見つけて「予約する」を押すと、通る画面は一覧・Ticket・完了の3つです。送信中と失敗はTicketのページの中で示し、送れたら完了のページへ進みます（今の「重ねて出す確認の表示」はなくなりました）。完了のページは、受付番号と送った内容、次に行く先、当日までに聴く作品（Homeの顔の作品）を出します。

実装と自動試験に加えて、Frontの画像の撮影（45の場面を1440・390幅で全部見ました）、本番の公開データでの画面確認、独立reviewを2回行いました。1回目は、Ticketの2列が821〜1011px幅で切れる問題（RV43-01）で差し戻され、直したうえで実測し、2回目で承認（blocking なし）です。

このファイルは、確認2でItsukiが読む結果です。確認2で承認いただく対象は、本書とBuild/Test Resultの2つです。承認はまだありません（gate 4・5は未記録）。

- Cycle: `2026-11-19_issue-43_live-ticket`
- 対象: `feature/43-live-ticket` / base `ba124011ce5e0ae56ddb1c6ac47d1783600687b4`
- reader_profile: audience_class=human_reader / language=ja-JP / review_surface=designated_text_editor / reader_ready=true / open_status=not_opened（Frontが開く）

## Itsukiに確認いただきたいこと

1. **計画からの差（下の「計画との差」）のうち、見た目や動きに関わるもの**。概要の固定位置を「上から24px」ではなく「ヘッダーの下24px」にしたこと。相対pathの画像をページの深さで読むようにしたこと。修理で、Ticketの2列を「縮められる」形にし（1440幅の値は計画どおり560・364・間隔56）、390幅の画像なしカードの字を12pxにしたこと。いずれも計画の意図の範囲内の直しとして実装しています。
2. **既知の制限**（下の「既知の制限」）を、Frontは受け入れています。特に、実音とスマホの実機は確かめておらず、スマホは390px幅の画像で代えています。
3. **Requirements F-15の読み方**。F-15の「送信前に開く確認の表示」は、元のコードで送信の操作をした時に開く、重ねた表示（ライブ・名前・e-mail・枚数・備考を並べる）のことです。新しい画面ではこの表示を作らず、同じ内容を完了の受付内容で見せます。Requirementsの文は変えていません。
4. **手元で開く時の注意**。画面の「予約する」から送ると本番に予約が入るので押さないでください。送信を試す時は、アドレスの末尾に`&dryRun=1`を付けると、送らずに完了までの流れを確かめられます。

## できるようになったこと

**Live一覧**（`live/`）は、開催予定を日付の近い順に出します。1件ごとにフライヤー、日付、会場、タイトル（あれば）、時間・料金の先頭2行、「予約する」と「詳細」を持ちます。その下に、終了したライブを新しい順の先頭3件（日付・会場・タイトル・「→」、行全体がリンク）と、4件以上ある時だけ「終了したライブをすべて見る →」を出します。画像が無い・読めない時は、淡い面に日付だけを置きます（「Coming Soon」は出しません）。

**Live詳細**（`live/detail/?liveId=…`）は、日付と会場を見出しにして、その下にタイトル（空なら出さない）、予約とInstagram（リンクがInstagramのアドレスの時だけ）、フライヤー、公演情報の順に並べます。スマホ幅では日付・会場・予約がフライヤーより上に来ます。公演情報は時間・料金・注記・共演をHomeと同じ行で出し、4つとも空の時は説明を改行・空行のまま全文で出します。

**終了したライブ（全件）**（`live/detail/?view=past`）は、新しい順に全行を出します。0件の時は「終了したライブはまだありません。」です。`?liveId`があれば詳細が優先される今の扱いと、Homeの「これまでのライブ →」・Xの告知のアドレスは変えていません。

**Ticket**（`ticket/`）は、アドレスで指定したライブ、なければ入力途中のライブ、なければ日付がいちばん近いライブを選んで始まります。ライブの選択肢は予約できる（このサイトで受け付ける）開催予定だけで、近い順です。「予約するライブ」の概要（画像・日付・会場・タイトル・時間・料金・注記・共演・Instagram）は、PCでは入力欄の横に固定され、スマホでは入力欄の上に小さく出ます。入力の誤りは、その項目の直下に直し方を書き、最初の誤りへ移ります（通信しません）。送信中はボタンが「送信しています…」で押せず、入力はそのまま残ります。失敗しても入力・下書き・選択は残り、同じボタンが「もう一度送信する」になります。同じ内容を続けて送った時（サーバーが受付済みを返した時）は「同じ内容の予約を、すでに受け付けています。」を出して止めます。管理画面で変えられる完了文・枚数と備考の表示・ラベル・入力例・送信ボタンの文言は、そのまま使います。

**Ticket完了**（`ticket/complete/`）は、完了文（管理設定。既定「予約しました。」）、受付番号、日付・会場・タイトル、送った内容（名前・e-mail・枚数・備考）、次に行く先（ライブの詳細・ほかのライブ・Home）、「当日までに聴く」の順です。送った内容は、名前・e-mail・備考をアドレスに載せず、同じタブの中（sessionStorage）に30分だけ置いて渡します。アドレスにあるのは`liveId`と受付番号だけです。直接開いた時・30分を過ぎた時・別のライブや別の受付番号のアドレスの時・別のタブで開いた時は、内容を作らず「予約の受付内容を表示できませんでした。」を出します。再読み込みしても同じ内容が出ます。「当日までに聴く」はHomeと同じ作品（顔にしている作品）で、有効な映像がある時だけ「聴く」を出し、押すとその場でプレーヤーが開きます。映像が無ければ配信先・購入先のリンクだけ、作品が0件なら区画ごと出しません。

**状態16個と読み込み中**は、Figmaの状態frameの文言どおりに作りました。読み込み中は見出しと枠を先に出し、「読み込み中」の淡い面を置きます。再読み込みは二重に送らず、古い応答は捨て、ページを離れて戻った時（bfcache）は中断していれば取り直します。

**予約の出し分け**（予約する／予約する（外部サイト）／予約受付終了／予約先を確認中）は、Live・Ticketで共通です。Homeの次のライブで予約先のアドレスが正しくない時の文言も「予約先を確認中」に揃えました（Homeで変えたのはこの1か所の文言だけ）。

**色**: 赤は見出しの線と、各画面のいちばんしてほしい操作（予約する・送信する）だけです。入力誤り・送信失敗の知らせ・お知らせ・hover・focus・選択には使っていません。

## 承認と昇格

確認1（gate 1〜3）は、2026-11-19T17:46:32+09:00にItsuki本人が`A`と回答しました（提示17:43:01）。承認記録は`approvals/01〜03`で、提示文・回答・digestを原典から言い換えずに転記してあります。今も、承認時点のdigestと現在のSHA-256は一致しています。

| 対象 | SHA-256 |
|---|---|
| Requirements | `20ccd1f7ebd9ce0d20c47f613814d284a172800df8059d832c44d94ca67339b4` |
| Workflow Plan | `ab675c0b57d5aa2bee61c4d35d7dc94896e61c98a2e104a2e48a9f0b7d6b96d5` |
| Code Generation Plan | `bc6901d707b23e62925765b76f96724048ccfde9fd75e36b751bebb235a04d2a` |
| `figma-fix-requests.md` | `892b62d7bb3a86ff4bbe93976ef73b99751fcfa11a2579f631a85e276f2e91a7` |

承認のあと、設計書3文書の昇格前のSHA-256が計画§3の元版と一致することを先に確かめてから、提案版を同じbytesで`docs/specs/current/`へ置きました。提案版も`aidlc-docs/`に残しています。差分の範囲は、計画§3「変更点」のとおりです。記録は`verification/logs/step1-canonical-promotion.txt`です。

| 設計書 | 昇格後（＝提案版）のSHA-256 | `cmp -s` |
|---|---|---|
| `public-site-ui.md` | `51d9c23e37525c79b8f87b889f7e4758441cf3d1852600a29b5b617cf2a0691a` | 一致 |
| `live-operations-admin-ui.md` | `80a3363ed23b60bfc42dcd8a03583cbbf89ce27a6ca18b1b6ed26dd63ce4e62f` | 一致 |
| `README.md` | `3e10bd642a8d8441d35a75ce0417a424a38dd738d841abbb50638f34953aac75` | 一致 |

gate 4・5（確認2）の承認記録は、まだ作っていません。

## 変えたファイル

実装は9段で進めました。段8は撮影scriptとfixtureまで、段9（撮影・確認・review）はFrontが行いました。

| 段 | 変えたファイル | 内容 |
|---|---|---|
| 1 入力と昇格 | `aidlc-docs/approvals/01〜03`、`docs/specs/current/` 3件、`test/support/dom-harness.mjs`、`test/fixtures/live-ticket-states.json` | 承認3件の転記、設計書の昇格、試験用の最小DOMと架空fixture |
| 2 共通の基盤 | `assets/js/live-order.js`、`reservation-cta.js`、`assets/js/site-content.js`（1行）、`test/home-rendering.test.mjs`（1か所） | 日付の並びと予約の出し分けの共有module。Homeの不正な予約先の文言1か所 |
| 3 Live一覧・詳細・全件 | `assets/js/live-pages.js`、`live/index.html`、`live/detail/index.html`、`assets/css/live-ticket.css`（Live分） | 3画面の取得・描画・状態・再試行 |
| 4 Ticketの初期化と入力 | `ticket/index.html`、`assets/js/ticket.js`（前半）、CSS（Ticket分） | 初期選択・状態・下書き・検証・概要 |
| 5 送信と受け渡し | `assets/js/ticket.js`（後半）、`assets/js/ticket-receipt.js` | 送信・失敗・重複・成功・dryRun、受付内容の保存と読み出し |
| 6 Ticket完了と当日までに聴く | `ticket/complete/index.html`、`assets/js/ticket-complete.js`、CSS（完了分） | 受付内容・次に行く先・聴く |
| 7 外枠の統合・既存試験・見た目の試験 | `test/live-ticket-shell.test.mjs`、`test/site-shell.test.mjs`、`test/public-ticket-routing.test.mjs`、`test/public-music-data-compatibility.test.mjs` | 外枠のbytes一致、見た目の規則、既存試験の移し替え |
| 8 画面確認の材料 | `verification/capture-live-ticket.py` | 撮影script（fixtureは段1） |
| review 1回目の修理 | `assets/css/live-ticket.css`、`assets/js/ticket.js`、`test/live-ticket-shell.test.mjs`、`test/ticket-flow.test.mjs`、`test/fixtures/live-ticket-states.json`、`verification/capture-live-ticket.py`、`verification/logs/round2-*.log` | RV43-01〜05（下の「独立review」） |

新規の試験は`live-order`・`reservation-cta`・`live-pages`・`ticket-flow`・`ticket-receipt`・`ticket-complete`・`live-ticket-shell`の7ファイルです。`aidlc-docs/README.md`はcycle開始時の変更です。

変えていない共有ファイル: `live-operations.js`、`music-data.js`、`home-player.js`、`script.js`、`site-config.js`、`style.css`、tokens、`DESIGN_RULES.md`、`admin/`、`cloudflare/`、Home・Music・Profile・Contact・旧2ページ・`index.html`（試験でbytes一致を確認）。

## 実装した場所

| できること | 場所 |
|---|---|
| 並び（近い順・新しい順・解析できない日付は末尾・同日は保存順） | `assets/js/live-order.js`（Homeと同じ読み方。Homeの次のライブと先頭が一致することを試験で確認） |
| 予約の出し分けの共有 | `assets/js/reservation-cta.js`（規則は`LiveOperations.getTicketCta`のまま。文言と理由の文だけを持つ） |
| Live一覧・詳細・全件 | `assets/js/live-pages.js`、`live/index.html`、`live/detail/index.html` |
| Ticket | `assets/js/ticket.js`、`ticket/index.html` |
| 受け渡し | `assets/js/ticket-receipt.js`（保存・読み出し・消去・30分・アドレスとの一致） |
| Ticket完了・当日までに聴く | `assets/js/ticket-complete.js`、`ticket/complete/index.html`（`MusicData.resolveFeaturedRelease`と`home-player.js`を再利用） |
| 見た目 | `assets/css/live-ticket.css`（`body.site-live`・`body.site-ticket`の下だけ。`style.css`は変えていない） |
| Homeの1文言 | `assets/js/site-content.js`の`renderHomeLive`内の1行（「予約URLが無効です」→「予約先を確認中」）。baseとの差分は1行・1か所 |

状態16個の対応: S43-01〜04・05（Live一覧・詳細）は`live-pages.js`、S43-06は`reservation-cta.js`と`live-pages.js`、S43-07〜12・14〜16は`ticket.js`、S43-13は`ticket-complete.js`、S43-Lは各画面の読み込み中（`data-state="loading"`・`aria-busy`・`role="status"`）。

## 計画との差

実装時の差:

| 差 | 理由 |
|---|---|
| 概要の固定位置を`top: calc(79px + 24px)`にした（計画は`top: 24px`） | ヘッダーが画面上部に固定（高さ79px）されていて、`24px`だと概要の上がヘッダーに隠れるため。1440幅の撮影で、固定時の上端は105px（metricsの`stickyTopAfterScroll`）でした |
| 相対pathの画像は、ページごとの`data-site-root`（`../`または`../../`）を前置する（計画は`../`） | Live詳細・Ticket完了は2階層下にあり、`../`だと画像が出ないため（今のLive詳細にあった不具合）。一覧・Ticketは同じ値 |
| Ticketの通知欄`#ticket-notice`と、旧試験`ticket removes both copy elements…`の正規表現（`id="ticket-notice"`を禁止）が衝突した | 計画§2.3は`#ticket-notice`を通知欄にし、§5は旧試験を「保つ」としていた。旧試験の意図（`introText`・`noticeText`を読まない・案内文の要素がない）はT43-TICKET-INITへ移し、状態の通知欄とは別物であることを確かめている |
| 受け渡しの関数は`save(receipt, options)`・`load(query, options)`・`clear(options)`で、`KEY`・`VERSION`・`TTL_MS`も公開 | 計画は`load({liveId, rid, now})`だけを示していた。保存先・時刻を試験で差し替えるための引数 |
| `ReservationCta.resolve`・`resolveLive`に任意の4つ目の引数`{now}`、`reasonSentence`は結果の入れ物でも種別の文字でも受ける | 日付を過ぎたupcomingの判定を試験・撮影で固定時刻にするため。受付終了と終了で文が違うので結果の入れ物を取れるようにした |
| 完了の「次に行く先」は`nav`ではなく`role="group"`のdiv | 外枠のnav（5項目）と区別するため（外枠の試験は最初のnavだけを読む） |
| 試験用DOMを`test/support/dom-harness.mjs`に作った（実HTMLを解析し、実sourceをvmで動かす） | 計画は「既存のDOM模型を移す」だったが、描画したHTMLの検査が要るため木構造の模型にした。dependencyは足していない |
| 撮影scriptに`--from-disk`と`--check`を足した | 計画の契約（`--serve`と`--chromium`）はそのまま。bindできない環境での撮影と、ブラウザなしの整合検査のため |
| `Ticket`の送信時、選んだライブのidを検証より先に読み取る | 他の入力欄を読む処理がselectを書き換えても、送るライブが変わらないようにするため（旧試験の意図を保つ） |

修理で足した差（review 1回目の後）:

| 差 | 理由 |
|---|---|
| Ticketの2列を`minmax(0, 560px) minmax(0, 364px)`にした（計画は固定の`560px 364px`）。1440幅の値（560・364・間隔56）と、820px以下で1列になる切替は変えていない | 821〜1011px幅で固定幅の2列が画面より広くなり、概要が切れたため（RV43-01） |
| 820px以下のライブ一覧で、フライヤーが無いカードの日付を12px・字間0にした（基本の規則とLive詳細は不変） | 390幅の画像なしカードで日付が折れたため（RV43-02） |
| 820px以下のLive詳細で、公演情報の行を本文幅まで伸ばした（`align-items: stretch`。ボタンは伸ばさない） | 公演情報の行の幅が足りなかったため（RV43-03） |

## 確かめたこと

自動試験の結果はBuild/Test Resultにあります。ここでは、Frontが画面で確かめたことを書きます。記録の原典は、`aidlc-docs/audit.md`の「Front追補 — 撮影・本番の公開データでの確認・独立review（確認2の前、2026-11-19）」です。

**撮影**（2026-11-19T19:55:15+09:00、修理の後）: `/usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-live-ticket.py --serve`がexit 0で、「91画像。自動metricsの指摘 0 件」です。Frontは45の場面を1440幅・390幅ですべて見ました。360幅の1枚は、metricsの高さで見ました。外部のfontは遮断して代わりのfontで、YouTubeとフライヤーは撮影用の仮の面です。画像は`verification/screenshots/`、metricsは`verification/capture-live-ticket-metrics.json`、流れの記録は`verification/flow-log.json`です。なお、metricsの中の`visual_review`・`real_audio`・`production_data`の「未実施」は、撮影scriptが撮影時点で出す定型の記載です。目視と本番データの結果は上のauditが原典です。

1回目の撮影（実装の直後）は、撮影scriptの誤りで最後の件数の照合で止まりました（`complete-playing-360.png`を2回数えた。RV43-04で直し、再撮影で通っています）。

**中間の幅の実測**（本番の公開データの写し）: 821・834・900・1011・1024px幅で、5画面のmainに画面の幅を越える要素はありません。Ticketの概要は364px、入力の列は369〜560pxです。

**本番の公開データでの確認**（repoの外。値はこの文書に写していません）:
- 1440・390幅の58ページで、横のはみ出し、「Coming Soon」、壊れた画像、consoleのエラーがありません。
- 並びは、開催予定が日付の近い順、終了したライブが新しい順です。
- 送信を止めると失敗の表示になり、入力が残ります。予約は1件も送っていません（確認に使った写しの`site-config.js`が予約のPOSTを拒否します）。
- `?dryRun=1`で完了へ進みます。当日までに聴くのプレーヤーは、1440幅で480×270、390幅で326×200です。
- Homeの次のライブの予約は「予約する」です。予約先が正しくない状態のライブは、本番にありません。
- 本番の画面では本物のfontで表示されました。

**独立review**（Claudeのread-onlyのReviewer。試験は実行できない環境で、読みと既存のlog・metrics・画像で確かめました）:

| 回 | 結果 | 所見と扱い |
|---|---|---|
| 1回目 | REJECTED | RV43-01（high・blocking）Ticketの2列が821〜1011pxで切れる → 直し、実測で収まった。RV43-02・03（medium）390幅の画像なしカードの日付の折れ・Live詳細の公演情報の行の幅 → 直した。RV43-04（low）撮影scriptの誤り2つと送信中の`aria-busy` → 直した。RV43-05（low）fixtureの日付が本番の1件と一致 → 架空の日付に替えた。RV43-06（medium）結果文書が事実と合わない → 本書を含む3文書の書き直しで閉じる |
| 2回目 | APPROVED（blocking なし） | RV43-07（low）読めない日付が登録された時だけ、390幅の代わりの面で長い文字が折れずに左右が切れうる → Frontが既知の制限として受け入れ、直さない |

## 既存試験の移し替え

削って合わせたものはありません。旧Live・Ticketの描画に結びついた試験は、意図を保って新しい試験へ移しました。件数は、baseと今の試験名の差と、段5の区切りの全試験のlogから数え直した値です。

- `test/public-ticket-routing.test.mjs`は、baseの25件のうち**22件の名前が無くなり**ました。うち21件は新しい試験群（T43-LIST・DETAIL・CTA・TICKET-INIT・FORM・SEND・RECEIPT・COMPLETE・FIELDSなど）へ移し、1件（重複したライブidで閉じる試験）はHomeの分だけを同じファイルに残して、Live・詳細・Ticketの分を新しい試験群へ移しました。残りの3件のうち1件（helperを読む順番）は期待を新しいscript一覧に改め、2件はそのままです。ファイルは25件から4件（残り3＋Home分1）になりました。
- 期待を新しい描画に合わせ直して残したものが、ほかに10件あります（`public-music-data-compatibility`のLive一覧2・Live詳細2、`site-shell`のscript一覧4、`home-rendering`の不正な予約先1、routingのscript一覧1）。`public-music-data-compatibility`には新しい試験を1件足し、ProfileとContactは変えていません。
- 「31件」は、段5の区切りで全試験を流した1回目（652件中31件失敗、`verification/logs/full-run-1-before-old-test-migration.log`）の**失敗件数**です。内訳は、試験20件（routing 17件、site-shellのscript一覧3件）と、その中の下位の試験11件です。移した件数ではありません。移し替えの対応表はBuild/Test Resultにあります。

意図して改めたもの: ライブ選択肢の順は「保存順」から「近い順」へ。確認の表示の検査は、受付内容の検査（T43-RECEIPT・COMPLETE）へ。静的な既定は「受付内容なし」へ（完了文の既定「予約しました。」は`ready`の中に残しています）。不正な予約先は「予約先を確認中」を期待する形へ。modalの検査は、入口が無いため移していません（要件メモ29:367）。

## 既知の制限

Frontが受け入れています。

- **RV43-07**: 読めない日付が登録された時だけ、390幅の画像なしカードで長い文字が折れずに左右が切れうる。本番の日付はすべて読める書き方で、起きても読みにくさだけです。
- **実音とスマホの実機は確かめていません**。スマホから開けるURLは用意せず、390px幅の画像で代えています。
- **旧Live用の使われないコード**（`site-content.js`の旧Liveの描画、`style.css`の旧規則）は残っています。#45との衝突を避けるためで、消すなら別のIssueです。
- **`site-content.js`の`?v=`を変えていない**ため、古いcacheのHomeでは、予約先が正しくない時に旧文言が一時的に出うる。本番にこの状態のライブはありません。
- **本番の終了したライブのうち2件は、年の誤りの疑い**があります（データの運用。変えていません）。
- 保存を禁止したブラウザでは、受付内容を完了で出せません。その場合は「受付内容なし」になり、受付済みの控えはGmailの自動返信が残します（#37）。

## まだ成立していないこと

- gate 4・5（確認2）のItsukiの承認
- Front completion、cycleのclose
- PR、merge（Itsuki）
- 本番への反映と、Issue #43のclose（#45とまとめてmainへ出す時）
- 実音・スマホの実機の確認（上の既知の制限のとおり、行わない）
