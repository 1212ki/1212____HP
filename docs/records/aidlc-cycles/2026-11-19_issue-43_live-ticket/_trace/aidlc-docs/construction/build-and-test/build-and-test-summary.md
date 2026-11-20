# Live一覧からTicket完了までの試験結果（Build/Test Result）

自動試験は、サイトが680件、Workerが347件で、どちらも失敗0です（2026-11-19、Node v20.19.4で再実行）。Frontは、91画像の撮影（自動metricsの指摘0件）、45の場面の目視、中間の幅の実測、本番の公開データでの58ページの確認を行い、独立reviewは1回目がREJECTED、修理のあとの2回目がAPPROVED（blockingなし）です。設計書3文書は承認済みのbytesのまま昇格し、承認記録3件は正本の検査（`validate_approval`相当）に通ります。

確かめていないことは、実音とスマホの実機です（390px幅の画像で代えます）。gate 4・5の承認、Front completion、cycleのclose、PR、mergeは、まだ成立していません。

- Cycle: `2026-11-19_issue-43_live-ticket`
- 対象: `feature/43-live-ticket` / base `ba124011ce5e0ae56ddb1c6ac47d1783600687b4`
- **Blocking Findings**: None
- reader_profile: audience_class=human_reader / language=ja-JP / review_surface=designated_text_editor / reader_ready=true / open_status=not_opened（Frontが開く）

Blocking Findingsの「None」は、未解消の阻害所見がないという意味です。1回目のreviewのblocking（RV43-01、Ticketの2列が821〜1011px幅で切れる）は、直して実測で収まったことを確かめ、2回目のreviewで承認されました。2回目のlow所見（RV43-07）は、Frontが既知の制限として受け入れています（下の「既知の制限」）。

## 実行した試験と最後の件数

logは`aidlc-docs/construction/aidlc-integration/verification/logs/`にあります。最後の件数は、修理（review 1回目の後）のあとにFrontとWorkerが再実行した値です。

| コマンド | 結果 | log |
|---|---|---|
| `node --test test/` | tests 680 / pass 680 / fail 0 / exit 0 | `round3-node-test-all.log`（`round2-node-test-all.log`も同じ680 / 0） |
| `npm --prefix cloudflare/worker test` | tests 347 / pass 347 / fail 0 / exit 0（`cloudflare/`は変えていない） | `round3-worker-test.log`（`round2-worker-test.log`も同じ） |
| `node --check`（`assets/js/*.js`、`test/*.mjs`、`test/support/*.mjs`） | すべて成功 | `round3-node-check.log` |
| `git diff --check` | exit 0。追跡されていない新規のtext file（log・json・txt・画像を除く）の末尾空白・EOF改行も別に走査して0件 | `round3-git-diff-check.log` |
| `scripts/aidlc-cycle.sh status` | 成功（Current Stageは確認2の待ち） | `round3-aidlc-cycle-status.log` |
| `scripts/aidlc-verify.sh --local` | 成功（`v1.0.1`、source authenticityは未確認の表示のまま） | `round3-aidlc-verify-local.log` |
| `validate_approval`相当（Requirements・Workflow Plan・Code Generation Plan） | 3件PASS | `approvals-validate-1-3.log` |
| 撮影（`capture-live-ticket.py --serve`、Front、2026-11-19T19:55:15+09:00） | exit 0、「91画像。自動metricsの指摘 0 件」 | `capture-front.log`、`capture-live-ticket-metrics.json`、`flow-log.json` |

`scripts/aidlc-verify.sh --local`は、Workerの環境が`/dev/fd`と`/private/tmp`を拒否するため、`diff`と`mktemp`の薄い代替（script本体は変えていない）を`PATH`の先頭に置いて実行しました（置き場所はscratch）。

件数の変遷（修理の前の記録）: 段5の区切りの全試験の1回目は652件中31件失敗、2回目は674件・失敗0、実装直後の最後の1回は677件・失敗0でした（`full-run-1-before-old-test-migration.log`、`full-run-2.log`、`full-run-final.log`）。修理でRV43-01〜03の試験（`T43-STYLE`）が3件増え、今は680件です。baseのFront基準はサイト513件・Worker347件でした。

### ファイルごとの件数（`round3-test-counts-by-file.txt`）

19ファイルの合計は679件で、`node --test test/`は`test/support/dom-harness.mjs`も試験ファイルとして1件走らせるため680件になります。失敗はありません。

| ファイル | 件数 | ファイル | 件数 |
|---|---|---|---|
| `admin-image-form` | 21 | `music-redirect` | 43 |
| `admin-live-operations` | 182 | `music-rendering` | 64 |
| `home-player` | 8 | `public-music-data-compatibility` | 11 |
| `home-rendering` | 64 | `public-ticket-routing` | 6 |
| `live-operations` | 30 | `reservation-cta` | 8 |
| `live-order` | 6 | `site-shell` | 39 |
| `live-pages` | 40 | `ticket-complete` | 26 |
| `live-ticket-shell` | 23 | `ticket-flow` | 70 |
| `music-data` | 3 | `ticket-receipt` | 22 |
| `music-player` | 13 | | |

### 旧Live・Ticketの試験の移し替え

削って合わせたものはありません。件数は、baseと今の試験名の差と、段5の区切りのlogから数え直しました。

| 数え方 | 件数 |
|---|---|
| `public-ticket-routing`の試験（baseと今） | 25件 → 4件 |
| うち、名前が無くなったもの | 22件（21件は新しい試験群へ全面的に移し、1件は重複したライブidの試験で、Homeの分だけを同じファイルに残して残りを移した） |
| 残ったもの | 3件（helperを読む順番の1件は期待を新しいscript一覧に改め、2件はそのまま）。Homeの分の1件を足して4件 |
| 期待を新しい描画に合わせ直して残したもの（ほか） | 10件（`public-music-data-compatibility`のLive一覧2・Live詳細2、`site-shell`のscript一覧4、`home-rendering`の不正な予約先1、routingのscript一覧1） |
| 新しい試験群 | 7ファイル（`live-order`・`reservation-cta`・`live-pages`・`ticket-flow`・`ticket-receipt`・`ticket-complete`・`live-ticket-shell`）。`public-music-data-compatibility`にも1件足した |

「31件」は、移した件数ではありません。段5の区切りで全試験を流した1回目（652件中31件失敗）の失敗件数で、内訳は試験20件（routing 17件、`site-shell`のscript一覧3件）と、その中の下位の試験11件です。以前の文書にあった「21件」は、routingで全面的に移した件数にあたります（Homeの分を残した1件を足すと22件）。

移し先の対応は、Code Generation Resultの「既存試験の移し替え」にあります。

## RED→GREEN（段ごと）

新しい試験は、実装より先に書いてREDを確かめ、実装後にGREENにしました。

| 段 | RED（実装前） | GREEN | 備考 |
|---|---|---|---|
| 1 入力と昇格 | — | 169 / 0（base上の既存4ファイル） | characterization。`step1-characterization-on-base.log`、昇格の照合は`step1-canonical-promotion.txt` |
| 2 共通の基盤 | 103件中10件失敗（`step2-red.log`） | 108件・失敗0（`step2-green.log`） | `live-order.js`・`reservation-cta.js`の不在と、Homeの不正な予約先の期待が失敗。GREENの1回目は試験側の誤りで1件失敗し、直して再実行 |
| 3 Live一覧・詳細・全件 | 112件中37件失敗（`step3-red.log`） | 113件・失敗0（`step3-green.log`） | `live-pages.js`とHTMLの不在で失敗 |
| 4 Ticketの初期化と入力 | 41件中39件失敗（`step4-red.log`） | 41件・失敗0（`step4-green.log`） | この段では送信は未実装（検証まで） |
| 5 送信と受け渡し | 64件中63件失敗（`step5-red.log`） | 85件・失敗0（`step5-green.log`） | `ticket-receipt.js`の不在と送信の未実装 |
| 6 Ticket完了と当日までに聴く | 25件中23件失敗（`step6-red.log`） | 97件・失敗0（`step6-green.log`、`home-player`・`home-rendering`を含む） | |
| 7 外枠・既存試験・見た目 | 新しい`live-ticket-shell.test.mjs`をbaseの木に当てると、`live-ticket.css`が無く失敗（`step7-red.log`） | 322件・失敗0（`step7-green.log`、7ファイル） | 実装は段3〜6で先に入っていたため、REDはbase上で確かめた |
| 修理（round2、review 1回目の後） | 93件中5件失敗（`round2-red.log`、`live-ticket-shell`・`ticket-flow`の2ファイル） | 93件・失敗0（`round2-green-targeted.log`）。全体は680 / 0（`round2-node-test-all.log`） | RV43-01〜03の見た目の規則3件と、送信中の`aria-busy`の期待。期待を変えた既存の試験は`T43-STYLE layout numbers…`の1行だけ（`560px 364px`→`minmax(0, 560px) minmax(0, 364px)`） |

## 受入条件ごとの証拠

「自動」はNodeの試験（実際のHTMLと実際のsourceを動かす）、「Front」はFrontが画面で確かめたことです。Frontの確認の原典は、`audit.md`の「Front追補 — 撮影・本番の公開データでの確認・独立review（確認2の前、2026-11-19）」です。「本番データ」は、本番の公開データの写しをlocalhostで配って確かめたことで、値はこの文書に写していません。

| ID | 自動で確かめたこと（試験群） | Frontの確認 |
|---|---|---|
| PS-L-01 | 一覧の予約のリンク（`ticket/?liveId=`）→Ticketで同じライブが選ばれる→送信成功の`location.replace`が`complete/?liveId=&rid=`→完了で受付内容が出る。送信前の確認（dialog・overlay・`ticketConfirm*`）が無く、通る画面が3つ（T43-FLOW） | 撮影の流れ（`flow-log.json`）と、本番データで`?dryRun=1`から完了へ進むこと |
| PS-L-02 | 概要が選択に追従、初期選択の優先順位、スマホで概要が上（`order:-1`）、PCで固定（sticky）のCSS（T43-TICKET-FORM・STYLE） | 1440幅の固定時の上端105px（metricsの`stickyTopAfterScroll`）。821・834・900・1011・1024幅で概要の右端が画面内（概要364px、入力の列369〜560px） |
| PS-L-03 | 通信失敗・サーバーエラー・拒否・読めない応答・受付内容のない成功・JSONでない成功の7種で、入力・下書き・選択が残りボタンが「もう一度送信する」。失敗後に同じボタンで再送できる（T43-SEND） | 本番データで、送信を止めると失敗の表示になり入力が残ること。撮影の`ticket-failed`・`ticket-duplicate`のconsoleの指摘が0件 |
| PS-L-04 | 保存した受付内容が完了に全項目出る（受付番号・日付・会場・タイトル・名前・e-mail・枚数・備考）。送信時点の完了文・ラベル・表示設定に従う（T43-RECEIPT・COMPLETE） | 完了の場面の画像（1440・390） |
| PS-L-05 | 4分岐（予約する／予約する（外部サイト）／予約受付終了／予約先を確認中）、日付を過ぎたupcomingが受付終了、押せない時は`span`・`aria-disabled`・リンクなし、Ticketの外部・終了・受付終了・不正・見つからない・重複・空の文（T43-CTA・LIST・DETAIL・TICKET-INIT） | 全場面の画像（押せない予約の見た目を含む）。本番データでHomeの次のライブの予約が「予約する」（予約先が正しくない状態のライブは本番に無い） |
| PS-L-06 | 完了文・枚数と備考の表示・ラベル・入力例・送信ボタン文言の設定どおりの表示（4通りの表示設定、既定値）、`introText`・`noticeText`を読まない（T43-FIELDS・TICKET-FORM・COMPLETE） | — |
| PS-L-07 | 画像・タイトル・日付・会場・時間・料金・注記・共演・説明・予約・Instagram・戻る・「すべて見る」がすべて新しい画面にある（要件§4のF-01〜19を項目ごとに確認、T43-FIELDS）。本番の形の全ライブ（空のタイトル・説明だけ・長いタイトル・画像の3通り・自由な料金と共演）で例外なく描画し、文字が欠けない（T43-PROD） | 本番データの1440・390幅の58ページで、横のはみ出し・「Coming Soon」・壊れた画像・consoleのエラーが無い |
| PS-L-08 | 終了したライブの行にタイトルが出る（先頭3件と全件、空のタイトルは行に空の欄を作らない、長いタイトル）。1440pxの4列・390pxの縦並びのCSS（T43-LIST・ARCHIVE・STYLE） | 2幅の画像。本番データで終了したライブが新しい順 |
| PS-COM-02（Live/Ticket分） | S43-01〜16と読み込み中の条件と文言、空の配列と不正の区別、HTTP失敗・JSON不正・network失敗・形の不正、二重要求の抑止、古い応答の無視、pagehide・pageshow、リスナーが増えない、再試行後のfocus（T43-STATE-LIST・DETAIL・TICKET、ARCHIVE、COMPLETE） | 45の場面を1440・390幅ですべて目視（360幅の1枚はmetricsの高さ）。ただし、Figmaのrender画像とのpixel比較はしていない |
| AC43-MEMO | 下の表 | |
| AC43-ADDR | `?view=past`と`?liveId`の優先（大小文字・空の`liveId`を含む）、Homeの「これまでのライブ →」のアドレスが全件へ進む、一覧の「すべて見る」、X（`live/detail/?liveId=`）が詳細へ進む（T43-ARCHIVE） | |
| AC43-HANDOFF | `sessionStorage`の1件・キー`1212hp_ticket_receipt_v1`、アドレスは`liveId`と受付番号だけで個人情報なし、別のライブ・別の受付番号で返さない、30分ちょうどは有効で1ミリ秒超過で消える、版違い・必須欠落・壊れたJSONは「受付内容なし」、保存の失敗でも例外にせず完了へ進む、再読み込みで同じ内容、新しい送信の開始で前の内容を消す、localStorageを使わない、別のタブには出ない（T43-RECEIPT・SEND・COMPLETE） | |
| AC43-LISTEN | Homeと同じ作品（顔の指定・自動・不明な指定・demo・映像なしの5設定でHomeと突き合わせ）、「聴く」は有効なYouTube IDの時だけ（3種類の映像リスト、不正なIDは出さない）、映像なしは配信先・購入先、作品0件は区画ごと非表示、押した直後にiframeが1つ（`autoplay=1`・`allow`）、もう一度押す・pagehideで破棄、`music →`（T43-LISTEN） | 本番データで、当日までに聴くのプレーヤーが1440幅で480×270、390幅で326×200。360幅の高さはmetricsで確認。**実音は未確認** |
| AC43-HOME-CTA | Homeの4分岐の文言がLive・Ticketと完全一致し、Homeに「予約URLが無効です」が出ない（T43-CTA）。`site-content.js`の差分が1か所の文言だけ（T43-COMPAT。下の確認） | 本番データで、Homeの次のライブの予約が「予約する」 |
| AC43-COMPAT | 4ページのヘッダー・ナビ・フッターと`<head>`（追加した`<link>`以外）がbaseとbytes一致、Home・Music・Profile・Contact・旧2ページ・`index.html`がファイルごとbytes一致、変えない共有ファイル・tokens・`DESIGN_RULES.md`・`admin/`・`cloudflare/`・`data/`・`scripts/`の差分が空、Workerの重複文字列、`style.css?v=`・`script.js?v=`・`site-content.js?v=`の不変、変更ファイルが計画§3の範囲だけ（T43-SHELL・COMPAT） | 撮影の外枠のsmoke（5ルート×2幅） |
| AC43-PROD | 架空のfixture（項目の3つの型、日付の3つの書き方と曜日の有無、保存順が日付順でない、同日2件、読めない日付、説明が多い行と空行、空のタイトル、長いタイトル、画像の絶対URL・相対path・なし・読めない、日付を過ぎたupcoming、自由な書き方の料金と共演）での描画（T43-PROD）。fixtureの値はすべて架空 | 本番の公開データでの画面確認（PC。スマホは390px幅の画像で代える）。上のPS-L-07・08のとおり |
| AC43-RELEASE | 計画§9のとおり（PR baseは`feature/39-public-pages`、rollbackは2段）。本書では扱わない | 独立review 2回（下の表）。PRとmergeはItsuki |

撮影の`capture-live-ticket-metrics.json`の中の`visual_review`・`real_audio`・`production_data`の「未実施」は、撮影scriptが撮影時点で出す定型の記載です。目視と本番データの結果は、上の表と`audit.md`のFront追補が原典です。

### 独立review

Claudeのread-onlyのReviewerで、試験は実行できない環境です（読みと、既存のlog・metrics・画像で確かめました）。

| 回 | 結果 | 所見と扱い |
|---|---|---|
| 1回目 | REJECTED | RV43-01（high・blocking）Ticketの2列が821〜1011pxで切れる → 直し、実測で収まった（834で概要の右端が996まで出ていた）。RV43-02（medium）390幅の画像なしカードの日付の折れ → 直した。RV43-03（medium）Live詳細の公演情報の行の幅 → 直した。RV43-04（low）撮影scriptの誤り2つ（360幅の撮影の数え違い・想定した失敗応答のconsoleを想定外に数えた）と送信中の`aria-busy` → 直した。RV43-05（low）fixtureの日付が本番の1件と一致 → 架空の日付に替えた。RV43-06（medium）結果文書が事実と合わない → 3文書の書き直しで閉じた |
| 2回目 | APPROVED（blockingなし） | RV43-07（low）読めない日付が登録された時だけ、390幅の代わりの面で長い文字が折れずに左右が切れうる → Frontが既知の制限として受け入れ、直さない |

### AC43-MEMO（要件メモ`29:364`の8条件）

| 条件 | 証拠 |
|---|---|
| 通る画面は最短3つ（一覧 → Ticket → 完了） | T43-FLOW（PS-L-01） |
| どのライブを予約しようとしているかが入力中ずっと見える | T43-TICKET-FORM・STYLE（PS-L-02）。固定表示と中間の幅の実測はFront |
| 送信に失敗しても入力した内容が消えない | T43-SEND（PS-L-03）。本番データでもFrontが確認 |
| 送信できた時、送った内容を画面で確認できる | T43-RECEIPT・COMPLETE（PS-L-04） |
| 予約できないライブでは「予約する」を出さず、理由を文で示す | T43-CTA・DETAIL・LIST・TICKET-INIT（PS-L-05） |
| 今のTicketの入力項目と、管理画面で変えられる文言・表示の設定がすべて残る | T43-FIELDS（F-13〜17）・TICKET-FORM（PS-L-06） |
| 今のLive詳細で見られる項目がすべて残る | T43-FIELDS（F-01〜12）・DETAIL・PROD（PS-L-07） |
| 終了したライブの行に、今と同じくタイトルが出る | T43-LIST・ARCHIVE（PS-L-08） |

Requirements F-15の「送信前に開く確認の表示」は、元のコードで送信の操作をした時に開く、重ねた表示のことです。新しい画面ではこの表示を作らず、同じ内容を完了の受付内容で見せます（T43-FLOWが、送信前の確認の要素が無いことを縛ります）。Requirementsの文は変えていません。

## 承認原典と設計書の照合

- 確認1（gate 1〜3）: Itsuki Matsumotoの2026-11-19T17:46:32+09:00の`A`（提示17:43:01）。承認記録3件（`approvals/01〜03`）は、原典（scratchの`gate-123-owner-responses.md`、`gate-123-prompt.md`）の提示文全文・raw response `A`・提示と回答の時刻・Approver・digestを逐語で転記し、`validate_approval`相当で3件PASSです。言い換えていません。
- 承認時点のdigestと、いまのSHA-256の照合（Frontが2026-11-19に確認、すべて一致）:

| 対象 | SHA-256 |
|---|---|
| Requirements | `20ccd1f7ebd9ce0d20c47f613814d284a172800df8059d832c44d94ca67339b4` |
| Workflow Plan | `ab675c0b57d5aa2bee61c4d35d7dc94896e61c98a2e104a2e48a9f0b7d6b96d5` |
| Code Generation Plan | `bc6901d707b23e62925765b76f96724048ccfde9fd75e36b751bebb235a04d2a` |
| `figma-fix-requests.md` | `892b62d7bb3a86ff4bbe93976ef73b99751fcfa11a2579f631a85e276f2e91a7` |
| `public-site-ui.md`（提案版と`docs/specs/current/`） | `51d9c23e37525c79b8f87b889f7e4758441cf3d1852600a29b5b617cf2a0691a` |
| `live-operations-admin-ui.md`（同上） | `80a3363ed23b60bfc42dcd8a03583cbbf89ce27a6ca18b1b6ed26dd63ce4e62f` |
| `README.md`（同上） | `3e10bd642a8d8441d35a75ce0417a424a38dd738d841abbb50638f34953aac75` |

- 設計書の昇格: 昇格前のSHA-256が計画§3の元版（`1aa471eb…`・`f031cc24…`・`8ecd9e3c…`）と一致することを確かめてから、コードと試験に着手しました。昇格後は提案版と同じSHA-256で、`cmp -s`も一致します（提案版も`aidlc-docs/`に残しています）。記録は`step1-canonical-promotion.txt`です。
- gate 4・5の承認記録は、作っていません（確認2のあとにFrontが記録します）。

## 変更範囲

`git status --short`（`aidlc-docs/`の中を除く）の変更は、計画§3の範囲だけです（試験`T43-COMPAT`でも縛っています）。

- 改めた既存ファイル: `assets/js/site-content.js`（1行）、`assets/js/ticket.js`、`assets/js/ticket-complete.js`、`live/index.html`、`live/detail/index.html`、`ticket/index.html`、`ticket/complete/index.html`、`docs/specs/current/`の3文書、`test/home-rendering.test.mjs`（1か所）、`test/public-ticket-routing.test.mjs`、`test/site-shell.test.mjs`、`test/public-music-data-compatibility.test.mjs`、`aidlc-docs/README.md`（cycle開始時の変更）
- 新規: `assets/js/live-order.js`・`reservation-cta.js`・`live-pages.js`・`ticket-receipt.js`、`assets/css/live-ticket.css`、`test/live-order.test.mjs`・`reservation-cta.test.mjs`・`live-pages.test.mjs`・`ticket-flow.test.mjs`・`ticket-receipt.test.mjs`・`ticket-complete.test.mjs`・`live-ticket-shell.test.mjs`、`test/support/dom-harness.mjs`、`test/fixtures/live-ticket-states.json`
- `git diff ba124011… -- assets/js/site-content.js`: 1行（1削除・1追加）・1か所。変わったのは`renderHomeLive`の不正な予約先のラベルだけ（「予約URLが無効です」→「予約先を確認中」）
- `git diff ba124011… --`が空: `assets/js/live-operations.js`・`music-data.js`・`home-player.js`・`script.js`・`site-config.js`、`assets/css/style.css`・`1212-music.tokens.css`、`DESIGN_RULES.md`、`admin/`、`cloudflare/`、Home・Music・Profile・Contact・旧2ページ・`index.html`

fixture・試験・文書・撮影scriptに入れた文字・日付・会場・料金・出演者・URL・画像のpath・完了文はすべて架空で、本番の公開データの値は含みません。review 1回目で、fixtureの日付1つが本番の1件と一致していたため、架空の日付に替えました（RV43-05）。

## closeの書式の事前検査

`scripts/aidlc-cycle.sh close`は実行していません（closeは確認2のあと）。代わりに、使い捨てのコピー（scratchの`worker-06-tmp/`）に、この時点の`aidlc-docs/`と`scripts/`を写し、コピーの中だけに、gate 4・5の**仮の**承認記録と`Complete`のstateを置いて、正本の`validate_close_ready`（`scripts/aidlc-cycle.sh`の関数。関数は変えず、dispatchの手前までを読み込んで呼ぶ）を通しました。結果はPASSです。次の書式に不備がないことを確かめました。

- Build/Test Resultと`cycle-summary.md`の`Blocking Findings`が、`None`のfield形式で読めること
- 先頭が`- [ ]`の未完了項目（stateと2つのplan）が無いこと
- 空の`[Answer]:`が無いこと
- Workflow Planの`REQUIRED`の5つの承認が1回ずつあり、対応するartifactと承認記録に結び付くこと
- `SKIP`の理由の書式

記録は`verification/logs/round3-close-precheck.log`です。コピーの承認記録01〜03は、絶対pathだけコピーの場所へ書き換えています。**これは書式の検査で、仮の承認です。gate 4・5のItsukiの承認ではありません。** 本物の`aidlc-docs/`には、仮の記録も`Complete`のstateも置いていません（`approvals/`は01〜03だけで、stateは確認2の待ちのままです）。

## 既知の制限

Frontが受け入れています。

- **RV43-07**: 読めない日付が登録された時だけ、390幅の画像なしカードで長い文字が折れずに左右が切れうる。本番の日付はすべて読める書き方で、起きても読みにくさだけです。
- **実音とスマホの実機は確かめていません**。スマホから開けるURLは用意せず、390px幅の画像で代えています。
- **旧Live用の使われないコード**（`site-content.js`の旧Liveの描画、`style.css`の旧規則）は残っています。消すなら別のIssueです。
- **`site-content.js`の`?v=`を変えていない**ため、古いcacheのHomeでは、予約先が正しくない時に旧文言が一時的に出うる。本番にこの状態のライブはありません。
- **本番の終了したライブのうち2件は、年の誤りの疑い**があります（データの運用。変えていません）。
- 保存を禁止したブラウザでは、受付内容を完了で出せません（受付済みの控えはGmailの自動返信が残します。#37）。
- 撮影は、外部のfontを遮断した代わりのfontで行い、YouTubeとフライヤーは撮影用の仮の面です。本物のfontでの表示は、本番データの確認で見ています。

## まだ成立していないこと

- gate 4・5（確認2）のItsukiの承認
- Front completion、cycleのclose
- PR、merge（Itsuki）
- 本番への反映と、Issue #43のclose（#45とまとめてmainへ出す時）
