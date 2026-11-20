# Code Generation Plan — Live一覧からTicket完了までの予約の流れ（Issue #43）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-19_issue-43_live-ticket`
- Execution target: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-43-live-ticket`
- Branch: `feature/43-live-ticket` / base `ba124011ce5e0ae56ddb1c6ac47d1783600687b4`（`origin/feature/39-public-pages`）
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 1. 到達点と責任

Live一覧・Live詳細・終了したライブ（全件）・Ticket・Ticket完了の本文を作り直し、送信中・失敗をTicketのページ内、成功をTicket完了のページで示す。実装入力はRequirements R43-01〜20、状態S43-01〜16・L、承認済みの設計書、Figma整合案F43-01〜11。原典はauditに固定する。1つの実装単位`aidlc-integration`として9段で作り、内部の工程ごとに別Workerを起動しない。

確認1でItsukiがgate 1〜3と、本計画に含まれる設計書3文書の提案版・Figma整合案（採否はFront判断ですべて推奨案）・Q43-01（Front判断で、Homeの不正な予約先の文言を「予約先を確認中」に揃える変更。Aで採用、Bなら元に戻す）を承認し、Frontが承認記録を作るまで実装しない。後続Workerは昇格・コード・試験・撮影scriptを持ち、Frontが画像の撮影・目視・本番の公開データでの画面確認・独立reviewの手配を持つ。結果を確認2（gate 4・5）へ出す。Owner確認・review・Front completionは別であり、Workerは自己承認・再委任・Git writeをしない。

## 2. 採用する設計

### 2.1 決定と理由（VF1〜VF15）

| 項目 | 決定 | 理由 |
|---|---|---|
| 範囲（VF1） | 5画面の`main`と、そのJS・CSS・試験・設計書。ヘッダー・ナビ・フッター・Menuと、Home・Music・Profile・Contactの本文、データ・Workerは変えない。例外は1つだけ: Homeの次のライブで予約先のアドレスが正しくない時の文言を、Live・Ticketと同じ「予約先を確認中」へ改める（Front判断、Q43-01。`site-content.js`の1か所、`home-rendering`の期待、設計書§7の1文）。Homeのほかの表示・文言・構成は変えない。 | #44が外枠を作り、#45が別の本文を並行して実装する。同じ状態に2つの言い方を置かないため、不正な予約先の文言だけをHomeでも揃える。 |
| アドレス（VF2） | `live/detail/?liveId=<id>`と`ticket/?liveId=<id>`の形を変えない。終了したライブ（全件）の入口は`live/detail/?view=past`のまま保ち、同じHTMLが`?liveId`の有無で詳細と全件を出し分ける（`?liveId`が優先、今のまま）。新しい`live/past/`は作らない。 | Homeの「これまでのライブ →」とX告知（`/og/live/<id>`はLive詳細をcanonicalにする）が行き止まりにならない。Homeを変えずに済む（VF1）。 |
| 予約の流れ（VF3） | 一覧 → Ticket → 完了の3画面。送信前の確認の段は置かない。送信中・失敗はTicketのページ内、成功は`location.replace`で完了へ。 | 今も送信前の確認はなく（modalは送信中の表示と成功後の控えを兼ねた）、マスタ・要件メモにも確認の段がない。`replace`にすると、戻るで入力済みのTicketに戻って二重に送らない。 |
| 受け渡し（VF4） | 同じタブの`sessionStorage`に受付内容1件、URLは`liveId`と受付番号だけ。§2.6で比較。 | 名前・e-mail・備考をURLに載せない。再読み込みで消えず、別タブでは出ない。 |
| 予約の出し分けの共有（VF5） | 新しい`reservation-cta.js`を作り、Live・Ticket側が使う。判定は`LiveOperations.getTicketCta`をそのまま呼ぶ。Homeは共有moduleへ移さず、`site-content.js`の不正な予約先の文言1か所だけを「予約先を確認中」に改める（Q43-01）。 | Homeに共有moduleを使わせると、Home・Profile・Contact・Musicの各HTMLの読み込みを変えることになり、並行する#45の面に触れる。規則は1つ（`getTicketCta`）なので、文言の対応づけだけを共有し、Homeと4分岐の文言が完全に一致することを試験で守る（§5 T43-CTA）。Homeの変更は1文言に絞り、各HTMLは変えない。 |
| 並びの共有（VF9） | 新しい`live-order.js`に、Homeと同じ解釈の日付の並びを持つ。Homeの私的な並び（`site-content.js`内）は変えず、一致を試験で守る。 | Ticketも同じ並びが要る。Homeを変えず、先頭が一致することを保証する。 |
| 見られる項目（VF6） | Requirements§4の対応表F-01〜19。 | 「見られる情報が減らない」を受入条件にする。 |
| 当日までに聴く（VF7） | `MusicData.resolveFeaturedRelease`と`home-player.js`を使う。PC 480×270、390px幅いっぱい・高さ200px以上。 | 同じ役割の処理を作り直さない。YouTubeの埋め込みの最小（200×200以上、16:9は480×270推奨）を、#44の修理と同じ値で守る。 |
| 状態16個（VF8） | §2.8の対応表。#42の条件の書き方に合わせる。 | 状態の網羅。 |
| 本番データの形（VF9） | 同じ形を持つ架空のfixture（§5）で試験する。 | #42で本番データの崩れを後から見つけた。 |
| 見た目（VF10） | 新しい`live-ticket.css`を5ページだけで読み、`body.site-live`・`body.site-ticket`にscopeする。共通部品は`style.css`のものを使う。 | `style.css`・`site-content.js`の末尾はMusicが追記し、#45も追記する。別ファイルにすれば#43は`style.css`を触らず、衝突しない。`site-content.js`はHomeの1文言（末尾ではなく`renderHomeLive`内の1行）だけを改め、追記はしない（§7）。 |
| 試験（VF11） | Nodeの決定論的な試験。dependencyを足さない。`site-shell`の期待は承認済みの変更に合わせて改める（削らない）。 | 今の試験の作法。 |
| 出し方（VF12） | PR baseは`feature/39-public-pages`。§8のrollback。 | Owner決定（2026-11-18）。 |
| 設計書（VF13） | 公開設計・管理設計・索引の3文書に提案版を作り、gate 3でexact bytesを固定して昇格する（§3）。 | 実装で決まること（受け渡し、状態、入口、まとめ出し）を現行の正本へ反映するため。 |
| 承認（VF14）・工程（VF15） | 5 gateともItsukiのA。9段、全試験は段5と段7の後。 | repoのvalidatorの要求。 |

### 2.2 追加・変更するファイルの責務

| ファイル | 責務 |
|---|---|
| 新規`assets/js/live-order.js`（UMD、`window.LiveOrder`） | `parseLiveDateTime`・`sortByDate`・`sortUpcoming`（近い順）・`sortPast`（新しい順）。解析できない値は末尾、同じ日付と解析不能どうしは保存順、入力の配列を変えない。`site-content.js`のHome用の並びと同じ解釈。 |
| 新規`assets/js/reservation-cta.js`（UMD、`window.ReservationCta`） | `resolve(siteData, liveId, internalUrl)`と`resolveLive(live, category, internalUrl)`が`{kind, active, url, external, label, reason, live, category}`を返す。`kind`は`internal`・`external`・`closed`・`invalid`・`unknown`・`ambiguous`・`helper`。`LiveOperations.getTicketCta`の`reason`（`reservationClosed`・`past`→closed、`invalidTicketUrl`→invalid）を文言へ対応づけるだけで、規則は書き直さない。`LABELS`は予約する／予約する（外部サイト）／予約受付終了／予約先を確認中。`reasonSentence(kind)`はS43-10・11の文（invalidは「指定されたライブの予約先を確認中です。別のライブを選択してください。」で、今のTicketの「予約URLが無効です」の文から改める）。`isInstagramUrl(url)`（`https?://(www.)?instagram.com/`）。 |
| 新規`assets/js/live-pages.js`（`window.LivePages`） | Live一覧・Live詳細・終了したライブ（全件）の取得・描画・状態・再試行。`#live-content`があれば一覧、`#live-detail-content`があれば詳細と全件を扱う。HTML文字列を作って`innerHTML`へ入れる（今の作法）。取得は`data.live`と`upcoming`・`past`が配列かを検査し、空配列と不正を区別する。 |
| 書き換え`assets/js/ticket.js` | Ticketの初期選択・状態・検証・送信・失敗・重複・成功。受付内容を`TicketReceipt`へ保存して完了へ。 |
| 新規`assets/js/ticket-receipt.js`（UMD、`window.TicketReceipt`） | 受付内容の保存・読み出し・消去・期限（30分）・URLとの一致検査。保存先は注入可能（試験で差し替える）。 |
| 書き換え`assets/js/ticket-complete.js` | 受付内容の表示、受付内容なし、完了文・ラベル、次に行く先、「当日までに聴く」。 |
| 新規`assets/css/live-ticket.css` | 5ページ専用。すべて`body.site-live`か`body.site-ticket`の下。 |
| 改める`assets/js/site-content.js`（1か所だけ） | `renderHomeLive`の不正な予約先のラベル「予約URLが無効です」を「予約先を確認中」に改める（Q43-01）。この1つの文字列以外のbyteを変えない。 |
| `live/index.html`・`live/detail/index.html`・`ticket/index.html`・`ticket/complete/index.html` | `main`を新しい構成にし、`<body>`に`site-live`／`site-ticket`、`live-ticket.css`の読み込み、script一覧を変える。`<header>`・`<nav>`・`<footer>`は変えない。 |

変えないファイル: `assets/js/live-operations.js`（`getTicketCta`の規則と返す値は変えない）、`music-data.js`、`home-player.js`、`script.js`、`site-config.js`、`assets/css/style.css`・`1212-music.tokens.css`、`DESIGN_RULES.md`、`admin/`、`cloudflare/`、Home・Music・Profile・Contactの各HTML、`docs/specs/current/`の昇格対象以外。`site-content.js`は上の1文言だけを改め、他は変えない。`site-content.js`のLive用の旧描画（一覧・詳細・全件・modal）と`style.css`の旧Live・Ticketのselectorは、5画面が読まなくなってデッドコードになるが、#45との衝突を避けるためこのcycleでは消さない（§7、まとめ出しの後の別Issueで整理）。`getTicketCta`が返す`label`（不正な予約先は今も「予約URLが無効です」）は、旧Live用の描画だけが読むので、5画面の後は画面に出ない。この値と旧描画は同じ別Issueで整理し、このcycleでは`live-operations.js`のbytesを保つ（Homeと5画面の文言は呼び出し側の対応づけで決める）。

### 2.3 5画面の構成

共通: 各ページの`<body>`は`class="site-live"`（Live一覧・詳細）／`class="site-ticket"`（Ticket・完了）。本文は`main`の中の1つの幅980（`width: min(calc(100% - 32px), var(--max-width))`）の枠。`[hidden]`は`display: none !important`をscopeの中で効かせる（`.site-button`の`display`で隠れなくなるのを防ぐ）。読み込み中は`data-state="loading"`と`aria-busy="true"`。取得結果で`ready`・`error`・`empty`にする。

**Live一覧**（`live/`、script: site-config → live-operations → live-order → reservation-cta → live-pages → script）
- 見出し`site-section-title`「live」、「開催予定」（`h3`、Label）、開催予定のカード、「終了したライブ」（`h3`）、終了したライブの行、「終了したライブをすべて見る →」（`site-text-link`、`detail/?view=past`）。
- 開催予定は`LiveOrder.sortUpcoming`の順。カード（`article`、`data-testid="live-card"`）は、フライヤー（136×192・角丸12・線1px、リンク）、日付（28/42・weight 500）、会場（16/26）、タイトル（14/22・weight 500・字間.04em、空なら出さない）、詳細の先頭2行（14/22・`--ink-muted`、`formatLiveDetails`の行）、操作（予約と「詳細」、右揃え・間隔12）。予約は`ReservationCta`の4分岐。「詳細」は`site-button--secondary`。390pxはフライヤー96×136・日付20/30の概要の下に操作を横に並べ、下に24の余白と線。
- 終了したライブは`LiveOrder.sortPast`の先頭3件。行（`a`、`data-testid="live-past-row"`）は日付（160幅）・会場（240幅）・タイトル（残り）・「→」を横に並べ、間隔24・上下16・下線。390pxは日付・会場・タイトルを縦に並べる。3件を超える時だけ「すべて見る」を出す。
- 画像は`resolveImageSrc`相当（相対pathは`../`を前置、`meta.updatedAt`をversion queryにする。今と同じ）。画像が無い・読めないときは淡い面に`YYYY.MM.DD`（`LiveOperations.parseLiveDate(date).date`、解析できなければ元の文字）。

**Live詳細**（`live/detail/?liveId=`）
- 「← live」（`../`）、日付（Display 40/56・字間2%。390pxは28/42）、会場（20/30）、タイトル（16/26、空なら出さない）、操作（予約、Instagramなら「Instagram」`site-button--secondary`・別タブ）、フライヤー（PC: 幅420・角丸16・線。切り取らず元の比率で出す）、公演情報。
- DOMは「見出し → 操作 → フライヤー → 公演情報」の順で、PCは`grid-template-areas`でフライヤーを左（420）、他を右（504）、間隔56。390pxは1列。
- 公演情報は`formatLiveDetails`の行を1行ずつ`li`（上下12・下線・16/26・`white-space: pre-wrap`・`overflow-wrap: anywhere`）にする。説明が出る場合（4つが空）は、説明の改行・空行を保つ1つのブロックにする。
- 取得失敗はS43-03、`liveId`が無い・見つからない・重複はS43-04（予約操作を出さない）。`document.title`は今のまま（タイトル・日付会場・松本一樹）。

**終了したライブ（全件）**（`live/detail/?view=past`、`?liveId`が無い時）
- 「← live」、`site-section-title`「live」、見出し「終了したライブ（全件）」、全行（`LiveOrder.sortPast`）。0件は「終了したライブはまだありません。」。`document.title`は「終了したライブ（全件） | 松本一樹」。取得失敗はS43-03。

**Ticket**（`ticket/`、script: site-config → live-operations → live-order → reservation-cta → ticket-receipt → ticket → script）
- 「← ライブの詳細」（選択中のLive詳細へ。無ければ「← live」で`../live/`）、`site-section-title`「ticket」、通知欄（`#ticket-notice`、`role=status`・`aria-live=polite`）、`form#ticket-form`（`novalidate`）と`aside#ticket-live-preview`（「予約するライブ」）。
- 既存のidを保つ: `liveId`・`name`・`email`・`quantity`・`message`・`company`（honeypot）・`submitBtn`・`ticket-field-quantity`・`ticket-field-message`・`ticket-label-quantity`・`ticket-label-message`。旧`ticket-route-message`と`ticket-result`は`ticket-notice`に統合し、旧modal（`ticketConfirm*`）は無くなる（試験は§5の移し替えで置き換える）。ライブの選択（`#ticket-field-live`）の下に、名前・e-mail・枚数・備考・honeypot・送信ボタンを包む`#ticket-fields`を置き、S43-10・11・12・16・14では`hidden`にする。
- 1440pxは2列（フォーム560・概要364・間隔56、概要は`position: sticky; top: 24px`）、390pxは1列で概要を上（`order: -1`）、送信ボタンは全幅（`width: 100%`）、枚数の欄は120幅。入力欄は高さ52・白・線1px`--color-gray-300`・角丸12・padding 12/16・16/26。ラベル14/22・weight 500・字間.04em。
- 概要は画像（120×170。390pxは72×102）、日付（20/30）、会場（16/26）、タイトル（14/22）、詳細（`formatLiveDetails`の全行、14/22）、「Instagram →」（`site-text-link`・別タブ、Instagramのときだけ）。画像が無い・読めない時は枠ごと出さない（S43-05）。

**Ticket完了**（`ticket/complete/`、script: site-config → live-operations → music-data → home-player → ticket-receipt → ticket-complete → script）
- 静的HTMLの既定は「受付内容なし」（S43-13）で、JSが受付内容を見つけたら「ready」へ切り替える（JSなしで偽の完了を出さない）。完了の知らせ（`#ticket-complete-message`、28/42）、受付内容（`#ticket-complete-card`、白・線1px`--color-border`・角丸16・padding 24、フライヤー96×136と文字の2列。390pxは72×102・padding 16）、次に行く先（3つの`site-text-link`、PCは横・間隔24、390pxは縦・間隔12）、「当日までに聴く」。
- 受付内容の文字は、受付番号（14/22、「受付番号　<番号>」、`overflow-wrap: anywhere`）、日付と会場（20/30、`formatLiveDate`）、タイトル（16/26、空なら出さない）、名前・e-mail・枚数・備考（14/22・`white-space: pre-wrap`、各行「ラベル　値」。枚数と備考は送信時点の表示設定に従い、備考が空なら「-」）。
- 「当日までに聴く」は`#ticket-listen`（`home-caption`の見出し、作品の行、`#ticket-player`、`music →`）。

### 2.4 予約の出し分けの共有

`ReservationCta.resolve`が返す`kind`の対応（規則は`getTicketCta`）:

| `getTicketCta`の結果 | `kind` | ボタンの文言 | 操作 |
|---|---|---|---|
| `active`かつ`external` | external | 予約する（外部サイト） | 別タブ（`rel="noopener noreferrer"`） |
| `active`かつ内部 | internal | 予約する | `ticket/?liveId=<encoded id>`（Live詳細・一覧）。Ticketでは送信可 |
| `reason`が`reservationClosed`または`past` | closed | 予約受付終了 | 押せない（`span.site-button.site-button--secondary.is-inactive[aria-disabled="true"]`、不透明度.4） |
| `reason`が`invalidTicketUrl` | invalid | 予約先を確認中 | 押せない（同上） |
| `resolveLiveById`が`missing` | unknown | （Live詳細はS43-04、Ticketは「見つかりません」の文） | 操作なし |
| `resolveLiveById`が`ambiguous` | ambiguous | （Live詳細はS43-04、TicketはS43-16） | 操作なし |
| `LiveOperations`が読めていない | helper | （S43-16） | 操作なし |

保存区分を正本とし（`category`を`isPast`として渡す）、日付で区分を変えない。日付を過ぎたupcomingは`getTicketCta`が`past`を返してclosedになる。

**Homeの文言（Q43-01、Front判断）**: Homeの次のライブも、不正な予約先を「予約先を確認中」（押せない）に揃え、同じ状態に2つの言い方を置かない。この計画の中の作業として行う（別の差分や再承認を待たない。確認1でItsukiがAで採用し、Bなら候補を「Homeは今の文言のまま」の形へ直して再承認を取る）。変えるのは次の4か所だけで、`getTicketCta`の規則（`live-operations.js`）と、Homeのほかの表示・文言・構成は変えない。

- `assets/js/site-content.js`の`renderHomeLive`の不正な予約先のラベル1か所（今「予約URLが無効です」→「予約先を確認中」）。
- `test/home-rendering.test.mjs`の`T42-LIVE booking invalid`の期待（今`<span>予約URLが無効です</span>`→`<span>予約先を確認中</span>`）。
- 設計書§7の1文（Homeの#42の契約。提案版`public-site-ui.md`。§3）。
- Ticketのページ内の文: 新しい`ticket.js`は`ReservationCta.reasonSentence`の「指定されたライブの予約先を確認中です。別のライブを選択してください。」（S43-11、状態`29:330`と整合。終了・受付終了・見つからないの文は変えない）。今の`ticket.js`の「予約URLが無効です」の文は改める前の文言。

`getTicketCta`が返す`label`（不正な予約先は今も「予約URLが無効です」）は、旧Live用の描画（`site-content.js`のデッドコード）だけが読む。5画面とHomeの表示は呼び出し側の対応づけ（Home: `renderHomeLive`、Live・Ticket: `ReservationCta`）で決めるので、画面には出ない。このcycleでは`live-operations.js`のbytesを保ち、この値と旧描画は同じ別Issueで整理する。

### 2.5 Ticketの進み方

**初期化**（bootの順）: ①`LiveOperations`・`LiveOrder`・`ReservationCta`・`TicketReceipt`が読めなければS43-16（入力欄を出さない）。②下書きを読む。③`site-data`を取得し、失敗・不正（`live`が無い、`upcoming`が配列でない）ならS43-14。④フッター文・表示設定（`ticket.fields`）を反映する。⑤選択肢＝予約できる内部のupcomingを`LiveOrder.sortUpcoming`の順に並べたもの。⑥`liveId`の指定があるか（`searchParams.has`）。

指定の判定: 指定があり、空・空白だけ・128文字を超える・制御文字を含む時はS43-16。同じ番号が重なっていればS43-16。見つからなければS43-11（見つからない）。`kind`がclosed・invalidならS43-11、externalならS43-10、internalなら選択に使う。指定が無く選択肢が0ならS43-12。

初期選択: 内部の指定があればそのライブ。指定が無ければ、下書きの`liveId`が選択肢にあればそれ、なければ先頭（日付が最も近いライブ）。指定が選べないとき（S43-10・11）は「ライブを選択してください」（選べない項目）を選んだ状態にし、入力欄と送信を隠す（`hidden`）。ライブの選択から選択肢を選ぶと、通知を消し、入力欄と送信を出し、概要・「← ライブの詳細」・下書きの`liveId`を更新する。

**入力と検証**: 下書き（localStorage `1212hp_ticket_draft_v1`）は`input`・`change`で保存し、指定が無い時だけ`liveId`も復元する。他の項目は復元する（今のまま）。検証は送信時に、名前（trim後に空なら「お名前を入力してください。」）、e-mail（空なら「e-mailを入力してください。」、Workerと同じ`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`・5〜254文字を外れたら「e-mailの形式を確認してください。」）、枚数（表示している時だけ。1〜10の整数でなければ「<ラベル>は1〜10で入力してください。」）。誤りは項目の直下（`#ticket-error-<id>`、`role=alert`）に出し、入力欄に`aria-invalid="true"`と`aria-describedby`を付け、最初の誤りへfocusし、通信しない。その項目を直して入力したら、その項目の誤りを消す。枚数を表示しない設定のときは1、備考を表示しない設定のときは空を送る（今のまま）。

**送信**: 送信の時点で選んだライブのスナップショット（id・日付・会場・タイトル・画像・ラベル）を作り、payloadを凍結する（`liveId`・`name`・`email`・`quantity`・`message`・`company`、今と同じ形・trim）。`submitting`が真なら何もしない。前の受付内容を消し、送信中（S43-08）にする。`?dryRun=1`は通信せず、受付番号`dry-run-<時刻>`の受付内容を作って成功と同じに進む（今の機能。Frontの確認用）。

応答の分類: ①通信が例外（`fetch`の失敗）→失敗（S43-09）。②`res.ok`が偽で`json.error`が`reservation already submitted recently`→重複（S43-15）。③`res.ok`が偽のその他→失敗。④`res.ok`が真で`json.reservation.id`が空→失敗（成功を装わない）。⑤それ以外→成功。この文字列はWorkerの`PublicReservationError`と同じで、試験が`cloudflare/worker/src/worker.js`の同じ文字列の存在を確かめる。

成功: 受付内容（§2.6）を保存し、下書きを消し、`location.replace('./complete/?liveId=<id>&rid=<受付番号>')`。保存が失敗しても完了へ進む（予約は成功している）。メール送信の結果は見ない（Workerが保存の成功を先に返す、#37の契約）。失敗・重複: 入力・下書き・選択を保ち、操作を戻す。失敗の通知は`role=alert`で、送信ボタンの文言を「もう一度送信する」にする（管理の`submitLabel`は初期状態の文言）。重複は文言を`submitLabel`のまま。

### 2.6 完了ページへ渡す内容

| 方法 | 長所 | 短所 | 判断 |
|---|---|---|---|
| A. URLのquery・hashに名前等を載せる | 実装が単純 | 名前・e-mail・備考が履歴・Referer・共有URLに残る。VF4が禁止 | 不採用 |
| B. 受付番号だけをURLに載せ、内容を取り直す | 個人情報がURLにない | 公開APIに受付を読むGETがなく、名前・e-mail・備考を取り直せない。Worker変更（対象外）が要る | 不採用 |
| C. 同じタブの`sessionStorage`に受付内容を置き、URLは`liveId`と受付番号だけ | 個人情報がURLにない。再読み込みで消えない。別タブ・端末には出ない。Worker変更なし | 保存を禁止した環境では内容を出せない（受付内容なしになる）。タブに残る間は同じタブで読める | **採用** |
| D. `history.state` | URLに載らない | 文書をまたぐ遷移（`location.replace`）で引き継げない | 不採用 |
| E. localStorage | 保存できる範囲が広い | 他のタブ・次回の訪問でも読める。個人情報の残り方が長い | 不採用 |

保存内容（版1）: `{v:1, rid, liveId, savedAt, live:{date, venue, title, image}, name, email, quantity, message, ui:{completeText, labelQuantity, labelMessage, showQuantity, showMessage}}`。`name`・`email`・`quantity`・`message`・`live.date`・`live.venue`・`rid`・`liveId`は成功応答の`reservation`の値を使う（サーバーが受け付けた値）。`live.title`・`live.image`と`ui`は送信時点のスナップショットと設定。

読み出し（`TicketReceipt.load({liveId, rid, now})`）: JSONが読め、`v===1`で、`rid`・`liveId`・`savedAt`・`live.date`・`live.venue`・`name`・`email`・`quantity`がそろい、`now - savedAt`が30分以内で、URLの`liveId`と`rid`が保存と一致する時だけ返す。期限切れは消す。それ以外は`null`（S43-13）で、内容を補わない。保存と消去は`try/catch`し、失敗は例外にしない（`save`が`false`を返す）。受付内容を読んでも消さない（再読み込み・戻る・進むで同じ内容を出す）。

### 2.7 Ticket完了と「当日までに聴く」

- 完了の知らせは保存した`ui.completeText`（空なら「予約しました。」）。受付内容の表示はネットワークを待たない。`site-data`の取得はフッター文と「当日までに聴く」のために行い、失敗しても受付内容は出し続ける（区画は出さない）。
- 作品: `MusicData.resolveFeaturedRelease(data)`。映像は`data.youtube`の`musicVideos`・`liveMovies`・`demos`を連結し、`playbackVideoId`と一致する`id`の`youtubeId`が`/^[A-Za-z0-9_-]{11}$/`に合う時だけ「聴く」（Homeと同じ解決。試験でHomeと一致を確かめる）。種別と日付は` ／ `で結ぶ（Homeと同じ）。外部リンクは安全なhttp(s)のときだけ、`discography.demo`の作品は「購入先へ」、それ以外は「配信先へ」（`site-chip`、別タブ）。作品が無ければ`#ticket-listen`を`hidden`にする。
- ジャケット（96×96・角丸12。390pxは72×72・角丸8）は、画像が無い・読めない時は淡い面に「松本一樹」だけ（作品名は文字の位置に残る）。
- プレーヤー: 「聴く」を押すと`HomePlayer.open(#ticket-player, 聴くボタン, youtubeId, 作品名)`。もう一度押す（`aria-expanded="true"`）と`HomePlayer.close()`。`home-player.js`は`pagehide`でも閉じる。作り直さず、`.home-player`の`style.css`の規則も変えない。
- 配置: 作品の行は`display: grid`で、ジャケット・文字・操作の3列（96 / 1fr / auto、間隔16）。プレーヤーは操作の前（`HomePlayer.open`が操作の前へ移す）に、行の全幅（`grid-column: 1 / -1`）の次の行へ入る。390pxは2列（72 / 1fr）で、操作は次の行・全幅。
- 寸法: `.site-ticket .ticket-listen .home-player { width: min(480px, 100%); margin-top: var(--space-16); aspect-ratio: 16 / 9; min-height: 200px; }`。1440pxでは受付内容の枠の内側が932幅で、プレーヤーは480×270。390pxでは枠の内側が326幅で、プレーヤーは326×200（16:9だと183で200に届かないため、高さ200を保つ）。どちらもYouTubeの埋め込みの最小（200×200以上）を満たす。Homeの`.home-player`の規則（`style.css`）は変えない。
- iPhoneで「聴く」のあとにもう1回押す場合（Q42-01）は受入済みで、蒸し返さない。

### 2.8 状態16個と読み込みの実装対応

| ID | 画面と要素の目印 | 条件（実装） | 試験 |
|---|---|---|---|
| S43-01 | `live/`、`[data-testid="live-empty-upcoming"]` | `Array.isArray(live.upcoming)`かつ長さ0 | T43-STATE-LIST |
| S43-02 | `live/`、`#live-past`が`hidden`、`live/detail/?view=past`の`[data-testid="live-archive-empty"]` | `Array.isArray(live.past)`かつ長さ0 | T43-STATE-LIST |
| S43-03 | `[data-testid="live-error"]`と`[data-testid="live-retry"]`（一覧・詳細・全件） | `fetch`の例外、`!res.ok`、JSON不正、`data`が配列・非objectか`data.live`が非object、`upcoming`か`past`が非配列 | T43-STATE-LIST/DETAIL |
| S43-04 | `[data-testid="live-detail-notfound"]` | `liveId`なし、`resolveLiveById`が`missing`か`ambiguous` | T43-STATE-DETAIL |
| S43-05 | `[data-testid="live-flyer-fallback"]` | 画像なし・空・`error`イベント | T43-STATE-DETAIL/LIST |
| S43-06 | `[data-testid="live-reserve"]`（`data-kind`） | `ReservationCta.kind`が4つ | T43-CTA |
| S43-07 | `#ticket-error-<id>` | §2.5の検証 | T43-TICKET-FORM |
| S43-08 | `#submitBtn`が`disabled`で文言「送信しています…」、`#ticket-status` | `submitting` | T43-SEND |
| S43-09 | `#ticket-notice[data-kind="failed"]`、`#submitBtn`の文言「もう一度送信する」 | §2.5の分類の失敗 | T43-SEND |
| S43-10 | `#ticket-notice[data-kind="external"]`と`<a>`、`#ticket-fields`が`hidden` | `kind=external`の指定 | T43-TICKET-INIT |
| S43-11 | `#ticket-notice[data-kind="unavailable"]` | `kind`が`closed`・`invalid`・`unknown`の指定 | T43-TICKET-INIT |
| S43-12 | `#ticket-notice[data-kind="empty"]` | 指定なしで選択肢が0 | T43-TICKET-INIT |
| S43-13 | `#ticket-complete-missing` | `TicketReceipt.load`が`null` | T43-COMPLETE |
| S43-14 | `#ticket-notice[data-kind="load-error"]`と`[data-testid="ticket-retry"]` | §2.5③ | T43-STATE-TICKET |
| S43-15 | `#ticket-notice[data-kind="duplicate"]` | §2.5② | T43-SEND |
| S43-16 | `#ticket-notice[data-kind="unidentified"]` | §2.5①と指定の判定 | T43-TICKET-INIT |
| S43-L | `[data-state="loading"]`、`role=status`「読み込み中」 | 取得が未解決 | T43-STATE-* |

再試行は`もう一度読み込む`を押すと同じ公開GETを呼び、通信中は二重要求を防ぎ（`pending`）、古い応答は連番で捨てる（`serial`）。`pagehide`で`pending`を解き、`pageshow`の`persisted`で、中断していれば再取得する（Homeの`bootHome`と同じ型）。再試行の成功後は見出しへfocusし、再度失敗したら新しい再読み込みボタンへfocusする（利用者が動かしたときと初回は動かさない。#44のRV44-06と同じ）。

### 2.9 見た目（`assets/css/live-ticket.css`）

- 先頭: `body.site-live, body.site-ticket`にHomeと同じ基底（フォント`--font-body`、背景`--paper`、字間0、`::before`なし、選択色と`scrollbar`は赤にしない）。
- 数値はFigma整合後のspecと§2.3。色は`--ink`・`--ink-muted`・`--paper`・`--paper-deep`・`--accent`・`--line`と、`--color-border`・`--color-gray-300`のtokens。16進の直書きと`var(--accent)`の乱用はしない。赤（`--accent`）は、`site-section-title`の線（共通部品のまま）と、各画面の主な操作1つ（Live詳細・一覧の「予約する」、Ticketの送信、完了では無し）だけ。入力誤り・失敗・通知・リンク・hover・focus・選択・scrollbarに赤を使わない（F43-02）。
- 幅の切り替えは`@media (max-width: 820px)`（#44と同じ）。余白は`--space-*`、角丸は`--radius-card`・`--radius-button`・12px。
- 押せない予約は`.is-inactive { opacity: .4; cursor: default }`。`.site-button:disabled`（.4）を送信中にも使う（F43-03）。`focus-visible`の輪郭を全部品に出す。
- 旧`style.css`のLive・Ticket・modalの規則（`.live-event`・`.ticket-modal`等）は、新しいmarkupが使わないので当たらない。`live-ticket.css`の規則は`body.site-live`・`body.site-ticket`の下に限り、特異性で旧規則に勝つ。

### 2.10 本番データの形への備え（架空のfixture）

`test/fixtures/live-ticket-states.json`（`home-states.json`と同じenvelope: `meta`・`data`・`scenarios`）に、次の形を架空の値で持つ。upcoming 2件（新しい形・遠い順で保存・1件は日付が基準の時刻より前＝日付を過ぎたupcoming）、past 12件ほど（新しい形5・項目が空で説明だけ1・古い7キーの形6）。日付は3つの書き方（`YYYY-MM-DD`・`YYYY.M.D`・`YYYY.MM.DD`）と曜日の有無、解析できない日付1件、保存順が日付順でない並び、同日2件。料金は自由な書き方（無料を表す語・数字＋`+1d`・`¥`と桁区切り）、共演は区切りの混在（` / `・`/`・`,`）と全角括弧の注記・8名、注記つきと注記なし、説明は1行・9行・空行つき・`w.`の後に改行で並べる形、空のタイトル、41文字を超えるタイトル・全角空白・和文の括弧・引用符・`<>&`、画像は絶対URL・相対path・空・読めないURL、`link`はInstagram・フォームの予約先・空、`ticketUrl`は外部（予約サイトのhost）・不正（`javascript:`）・空、`reservationClosed: true`、同じ`id`の重複（別のscenario）。`ticket`は完了文あり、表示設定の4通り（枚数・備考の表示/非表示）、ラベル・入力例・送信ボタン文言あり。作品2件（映像あり・なし）と映像3種で「当日までに聴く」を作る。scenarioの上書き（空の`upcoming`・空の`past`・不正な`live`・不明な`liveId`）はscenario名で切り替える。

## 3. 変更ファイルと設計書の昇格

| path | 変更範囲 |
|---|---|
| 新規`assets/js/live-order.js`、`reservation-cta.js`、`live-pages.js`、`ticket-receipt.js` | §2.2。`node --check`を通す。 |
| 書き換え`assets/js/ticket.js`、`ticket-complete.js` | §2.5・§2.7。query（`?v=`）は`20261119-43`に更新（キャッシュ回避）。 |
| 新規`assets/css/live-ticket.css` | §2.9。`?v=20261119-43`で読む。 |
| `live/index.html`・`live/detail/index.html`・`ticket/index.html`・`ticket/complete/index.html` | `<body>`のclass、`main`、`live-ticket.css`の`<link>`（`style.css`の次の行）、scriptの一覧（§2.3）。`style.css?v=20261118-44`と`script.js?v=20261118-44`は変えない。`site-content.js`をこの4ページから外す。 |
| 新規`test/live-order.test.mjs`、`reservation-cta.test.mjs`、`live-pages.test.mjs`、`ticket-flow.test.mjs`、`ticket-receipt.test.mjs`、`ticket-complete.test.mjs`、`live-ticket-shell.test.mjs`、`test/support/dom-harness.mjs`、`test/fixtures/live-ticket-states.json` | §5。Node標準機能だけ。 |
| 改める`assets/js/site-content.js`（1か所だけ） | §2.4。`renderHomeLive`の不正な予約先のラベルを「予約先を確認中」へ。差分が1行・1か所だけであることを段7で確かめる。`?v=`のqueryは変えない（§7）。 |
| 改める`test/home-rendering.test.mjs`（1か所だけ） | `T42-LIVE booking invalid`の期待を「予約先を確認中」へ改める（承認済みの変更に合わせる。削らない）。他の期待は変えない。 |
| 改める`test/public-ticket-routing.test.mjs` | §5「既存試験の扱い」。 |
| 改める`test/site-shell.test.mjs` | 4ページの`main`のbytes一致と、script一覧の期待を、承認済みの変更に合わせて改める（削らない）。 |
| 改める`test/public-music-data-compatibility.test.mjs` | Live・Live詳細の互換検査を新しい描画へ移す。Profile・Contactの検査は残す。 |
| `aidlc-docs/construction/aidlc-integration/verification/capture-live-ticket.py`（新規） | Front用の撮影script（§6）。 |
| `docs/specs/current/public-site-ui.md`・`live-operations-admin-ui.md`・`README.md` | 下の提案版をexact bytesで昇格。 |

共有の`style.css`・`script.js`・`site-content.js`のqueryは変えない（#45との衝突を避ける）。`site-content.js`のqueryを変えないため、古いcacheを持つ閲覧者のHomeでは、不正な予約先の文言が一時的に今の文言で出うる。本番に不正な予約先は0件で、GitHub Pagesの短いcacheで解消するので許容し、結果の未確認事項に記録する。`DESIGN_RULES.md`・tokens・`admin/`・`cloudflare/`・`data/`は無変更。

### exact bytesの提案版

提案版は昇格後の最終形（Status: Approved、Owner approvalは#43のgate 3を参照）。配置時点では未承認候補であり、Approvedという文字列だけで昇格しない。直さない節は今の文面のままbytesが一致する。#43の完了を先に主張しない。

| 提案版（`aidlc-docs/`から） | 昇格先 | 提案版SHA-256 | 昇格前の元版SHA-256 |
|---|---|---|---|
| `construction/aidlc-integration/canonical-proposals/public-site-ui.md` | `docs/specs/current/public-site-ui.md` | `51d9c23e37525c79b8f87b889f7e4758441cf3d1852600a29b5b617cf2a0691a` | `1aa471ebbb9680f762b4bcd2e97788aedd6f259fe82ad67ebc1f8b9e65e30a56` |
| `construction/aidlc-integration/canonical-proposals/live-operations-admin-ui.md` | `docs/specs/current/live-operations-admin-ui.md` | `80a3363ed23b60bfc42dcd8a03583cbbf89ce27a6ca18b1b6ed26dd63ce4e62f` | `f031cc243749714ecdbead55ed9e79dd6f33e73c9fd851390346fdcc681c4cb1` |
| `construction/aidlc-integration/canonical-proposals/README.md` | `docs/specs/current/README.md` | `3e10bd642a8d8441d35a75ce0417a424a38dd738d841abbb50638f34953aac75` | `8ecd9e3c00ad1025acf8683417780f7071d8d9d8be29e0bd9a98044c890dea0a` |

変更点: 公開設計は、見出しのOwner approval（#43）と最終更新日、§2の末尾に#44のmerge済みの事実、§3に「Issue #43のLive・Ticketの実装入力と比較時点」、§5に「Issue #43のLive・Ticket表示契約」（並び・表記・予約の出し分け・Ticket・受け渡し・当日までに聴く・見られる項目）、§6の1文（受け渡しの方法を固定）、§7に「Issue #43の状態とまとめ出し」（S43-01〜16・Lの表とまとめ出し）。管理設計は、見出しと§5.2の末尾に#43の1文、§5.3の後に「Issue #43のLive・Ticket対応」。索引は見出しと#43の1段落。公開設計は上に加えて、§7のHomeの#42の契約の1文（不正URLの文言を「予約URLが無効です」から「予約先を確認中」へ）と、§5の予約の出し分けの文（Homeも同じ文言に揃えたこと）を、Q43-01（Front判断）に合わせて含む。設計書は他の節を変えない。Q43-01がBなら、この2文を元の「Homeは#42の文言を保つ」形へ戻し、新しいdigestで承認を取り直す。

手順: 確認1の3承認digestと提案版hashを照合→現在の昇格先が表の元版hashであることを確認→提案版のbytesをそのまま昇格先へcopy→提案版と昇格先のSHA-256が一致し`cmp -s`が通ることを確認→差分の範囲が上の変更点だけであることを`diff`で確認→実装開始。昇格時に文字の置換・日付の追補・書式の変更を加えない。昇格先が#45等で変化していたら上書きせず停止し、Frontへ返す（候補の修理と新しいhashの承認で解消してから再開する）。Figma整合で別の意味・採用値が生じた時も同じ。

Figma整合案もgate 3の対象に含める: `aidlc-docs/construction/aidlc-integration/figma-fix-requests.md` SHA-256 `892b62d7bb3a86ff4bbe93976ef73b99751fcfa11a2579f631a85e276f2e91a7`。

## 4. 実装の9段とfocused test

作業前にNode20を選ぶ。以下のcommandはexecution targetから実行し、RED/GREENのexitと対象ACをverification logへ残す。新規試験名は提案で、承認後に作る。承認済みの計画に進捗checkboxを足さず、state/resultへ記録する。

```bash
export PATH=/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH
node --version
```

| 段 | 作業とRED→GREEN / focused command |
|---|---|
| 1. 入力と昇格 | cycle・承認・提案版・元版hashを照合し、3 canonicalを同じbytesで昇格（公開設計§7のHomeの不正URLの1文の改めを含む）。既存の`node --test test/live-operations.test.mjs test/home-rendering.test.mjs test/public-ticket-routing.test.mjs test/site-shell.test.mjs`をcharacterizationとして流す（不要なREDは作らない）。fixture`live-ticket-states.json`と`test/support/dom-harness.mjs`（既存`public-ticket-routing.test.mjs`のDOM模型を移す）を用意する。 |
| 2. 共通の基盤 | T43-ORDER・T43-CTAと、`home-rendering.test.mjs`の`T42-LIVE booking invalid`の期待（「予約先を確認中」）を先にRED（Homeは今の`site-content.js`が「予約URLが無効です」を返すので失敗する）。`live-order.js`・`reservation-cta.js`を実装し、`site-content.js`の1文言（§2.4）を改めてGREEN。Homeとの並び・文言の一致（Homeの`site-content.js`を実行して次のライブと予約のラベルを比べる。4分岐の文言が完全一致）を含む。`node --test test/live-order.test.mjs test/reservation-cta.test.mjs test/home-rendering.test.mjs test/live-operations.test.mjs`。 |
| 3. Live一覧・詳細・全件 | T43-LIST・T43-DETAIL・T43-ARCHIVE・T43-PROD・T43-STATE-LIST/DETAILを先にRED。`live-pages.js`、2つのHTML、`live-ticket.css`のLive分を実装してGREEN。`node --test test/live-pages.test.mjs test/public-music-data-compatibility.test.mjs test/home-rendering.test.mjs`。 |
| 4. Ticketの初期化と入力 | T43-TICKET-INIT（不正な予約先の文は「予約先を確認中です」）・T43-TICKET-FORM・T43-FIELDS（Ticket分）を先にRED。`ticket.js`の前半（boot・初期選択・状態・下書き・検証）、`ticket/index.html`、CSSのTicket分を実装してGREEN。`node --test test/ticket-flow.test.mjs`。 |
| 5. 送信と受け渡し | T43-SEND・T43-RECEIPT・T43-FLOWを先にRED。`ticket.js`の後半、`ticket-receipt.js`を実装してGREEN。Workerの重複文字列の契約を含む。`node --test test/ticket-flow.test.mjs test/ticket-receipt.test.mjs`。Live・Ticketの挙動が揃う区切りとして§5の全試験1回目。 |
| 6. Ticket完了と当日までに聴く | T43-COMPLETE・T43-LISTEN・T43-FIELDS（完了分）を先にRED。`ticket-complete.js`、`ticket/complete/index.html`、CSSの完了分を実装してGREEN。`node --test test/ticket-complete.test.mjs test/home-player.test.mjs test/home-rendering.test.mjs`。 |
| 7. 外枠の統合・既存試験・見た目の試験 | T43-SHELL・T43-STYLE・T43-COMPATを先にRED。`site-shell.test.mjs`・`public-ticket-routing.test.mjs`・`public-music-data-compatibility.test.mjs`を承認済みの変更に合わせて改め（§5）、4ページのHTMLの外枠・script・CSSの読み込みを仕上げてGREEN。`node --test test/live-ticket-shell.test.mjs test/site-shell.test.mjs test/public-ticket-routing.test.mjs test/public-music-data-compatibility.test.mjs test/admin-live-operations.test.mjs test/home-rendering.test.mjs`。`git diff ba124011ce5e0ae56ddb1c6ac47d1783600687b4 -- assets/js/site-content.js`が1行・1か所（不正な予約先のラベルだけ）の差分であること、`assets/js/live-operations.js`・`music-data.js`・`home-player.js`・`script.js`・`style.css`・tokensの差分が空であることを確かめ、結果に載せる。§5の全試験2回目。 |
| 8. 画面確認の材料と実行 | Workerが§6の撮影scriptとfixtureのscenarioを完成させ、構文を検査してFrontへ渡す。Frontが撮影・metrics・全画像の目視・本番の公開データでの画面確認を行う。修理は影響するfocused testと該当画像を再確認し、全体へ波及する変更だけ全試験を足す。 |
| 9. 結果と独立review | 実ファイル・昇格hash・RED/GREEN・全試験・AC別の証拠・未確認を結果に固定してFrontへ返す。Frontが独立reviewを1回手配し、修理と再検証を結果に反映して確認2へ出す。Owner承認を代行しない。 |

段3〜6のうち、旧modalと旧確認の表示は新しい画面が置き換える。段7までは、`site-shell`・`public-ticket-routing`の旧契約を一部残す。全試験を通すために未移行の保護を消さない。段の途中で先行する共有の変更が既存試験を壊したら、その時点で原因を直してから次へ進む。

## 5. 決定論的試験と全試験

fixtureは§2.10。試験は実source（`live-order.js`・`reservation-cta.js`・`live-pages.js`・`ticket.js`・`ticket-receipt.js`・`ticket-complete.js`と実HTML）をNodeの`vm`で実行する（既存の作法）。

| 群 | 必須assert / AC |
|---|---|
| T43-ORDER | 3つの日付の書き方・曜日の有無・解析不能・同日・保存順の保持・入力配列を変えない。Homeの次のライブ（`site-content.js`を実行）と`LiveOrder.sortUpcoming`の先頭が、fixtureの各形で一致。R43-03。 |
| T43-CTA | 4分岐の文言・`active`・`external`・`url`・`rel`、`getTicketCta`の`reason`ごとの対応、日付を過ぎたupcomingがclosed、保存区分を日付で変えない、`missing`・`ambiguous`・helper無し。Homeの`renderHomeLive`（`site-content.js`を実行）の4分岐の文言（「予約する」「予約する（外部サイト）」「予約受付終了」「予約先を確認中」）が、`ReservationCta`の文言と完全一致（差がない）。Homeの不正URLで「予約URLが無効です」が出ない。PS-L-05、AC43-HOME-CTA。 |
| T43-LIST | 開催予定の順・カードの要素（フライヤー・日付・会場・タイトル・詳細2行・予約・詳細）、終了したライブの先頭3件と行の要素（日付・会場・タイトル・矢印）、3件を超える時だけ「すべて見る」、`href`の`encodeURIComponent`、閉じた・外部・不正で「予約する」を出さない。PS-L-05・08、AC43-ADDR。 |
| T43-DETAIL | 見出しが日付と会場、タイトルが空で「Coming Soon」を出さない、公演情報の行がHomeと同じformatter、4つが空で説明（改行・空行を保つ）、Instagramだけ別ボタン（それ以外のリンクは出さない）、予約4分岐、DOMの順（見出し→操作→フライヤー→公演情報）、画像なし・読めない時の淡い面、不明・重複・`liveId`なし。PS-L-05・07。 |
| T43-ARCHIVE | `?view=past`で全行・新しい順・タイトル、`?liveId`が優先、空で「終了したライブはまだありません。」、旧入口（Homeの`href`）が全件へ進む、`document.title`。PS-L-08、AC43-ADDR。 |
| T43-PROD | §2.10の形すべてで、例外なく描画し、タイトル・会場・詳細・画像の文字が欠けず（切り詰めのclassがない）、説明の行数・空行が保たれ、エスケープされる。AC43-PROD。 |
| T43-STATE-LIST/DETAIL/TICKET | S43-01〜04・05・14・Lの条件と文言、空配列と不正の区別、HTTP失敗・JSON不正・network失敗、再読み込みの二重要求の抑止、古い応答の無視、pagehide・pageshow、リスナーが増えない、再試行後のfocus。PS-COM-02。 |
| T43-TICKET-INIT | `liveId`の指定・下書き・先頭の優先順位、選択肢の順（近い順）、外部・終了・受付終了・不正・見つからない・重複・空・長すぎる・制御文字の各指定で正しい状態とメッセージ（不正は「指定されたライブの予約先を確認中です。別のライブを選択してください。」）、入力欄と送信の隠し、helper無し。S43-10・11・12・16。 |
| T43-TICKET-FORM | 枚数1〜10・名前・e-mailの誤りの文と位置・`aria-invalid`・focus・通信しない、表示設定4通り、ラベル・入力例・送信ボタン文言の反映、下書きの保存と復元（指定がある時は`liveId`を上書きしない）、概要の内容（画像・日付・会場・タイトル・詳細・Instagram）と切替。PS-L-02・06、S43-07。 |
| T43-SEND | payloadの形・trim・`company`、送信時のライブのスナップショット、送信中の表示（ボタン・入力・二重送信の抑止）、失敗の各種で入力・下書き・選択が残りボタンが「もう一度送信する」、再送、重複で完了へ進まない、2xxで受付内容なし・不正JSONは失敗、`dryRun`は通信しない、成功で下書きを消し`location.replace`の先が`complete/?liveId=&rid=`。個人情報がURLにない。PS-L-01・03、S43-08・09・15。 |
| T43-FLOW | 一覧の予約の`href`（`ticket/?liveId=`）→Ticketで同じライブが選ばれる→送信成功の`location.replace`の先が`complete/?liveId=&rid=`→完了で受付内容が出る、という3画面の連鎖を実source・実HTMLでつなぐ。送信前に確認の表示（overlay・dialog・`ticketConfirm*`）が無いこと、通る画面が一覧・Ticket・完了の3つであること。PS-L-01。 |
| T43-RECEIPT | 保存・読み出し・URLの不一致（別の`liveId`・別の受付番号）・期限切れ（30分）と消去・版違い・必須欠落・壊れたJSON・保存の失敗で例外にしない・新しい送信の開始で前の内容を消す・再読み込みで同じ内容。AC43-HANDOFF。 |
| T43-COMPLETE | 受付内容の全項目（受付番号・日付・会場・タイトル・名前・e-mail・枚数・備考）、完了文の優先と既定、枚数・備考の表示設定とラベル、備考が空で「-」、エスケープ、受付内容なし（直接開いた・期限切れ・不一致）で内容を作らない、次に行く先の3つの`href`、ネットワーク失敗でも受付内容は出る、静的HTMLの既定。PS-L-04・06、S43-13。 |
| T43-LISTEN | Homeと同じ作品（`featuredReleaseId`・空で最新）、「聴く」は有効な映像のときだけ、映像なしで外部リンクだけ、無効な参照・不正な`youtubeId`で「聴く」なし、作品0件で区画なし、「聴く」を押した直後にiframeが1つ（`autoplay=1`・`allow`属性）、2回目で破棄、別の遷移・`pagehide`で破棄、`music →`の`href`。AC43-LISTEN。 |
| T43-FIELDS | Requirements§4のF-01〜19が、新しい描画のどこにあるかをassertする表（項目ごとに1つ以上）。PS-L-06・07。 |
| T43-SHELL / COMPAT | 4ページの`<header>`・`<nav>`・`<footer>`が#44の版（`ba12401`）とbytesで一致、script一覧、`site-content.js`を読まない、`live-ticket.css`の読み込み、`style.css`・`script.js`のqueryが変わらない、Home・Music・Profile・Contact・旧2ページ・`index.html`の`main`のbytesが変わらない、変更禁止のファイル（`live-operations.js`・`music-data.js`・`home-player.js`・`script.js`・`style.css`・tokens・`DESIGN_RULES.md`・`admin/`）が`ba12401`とbytes一致、Workerの重複文字列。`site-content.js`は`ba12401`の版（SHA-256 `f4136e012985a5fd156a001cdbfd6d5c28b9d69738d4b45d869c0696e2fdd7dd`）との差が不正な予約先のラベル1か所だけであることを、①試験（`予約URLが無効です`が0回、`予約先を確認中`が`renderHomeLive`の中に1回、ほかの文字列の置換でないこと）と、②手順（段7の`git diff`が1行・1か所。#45が同じファイルに入った後は、後から入る側が#45の差分を除いて同じ確認をする）で縛る。AC43-COMPAT、AC43-HOME-CTA。 |
| T43-STYLE | `live-ticket.css`の全selectorが`body.site-live`か`body.site-ticket`の下、赤（`--accent`・`#BF554D`・`accent`）が許された箇所だけ、16進の直書きがない、player寸法（`min(480px, 100%)`・`aspect-ratio: 16 / 9`・`min-height: 200px`）、1列への切り替え（820px）、概要の`position: sticky`、`.is-inactive`の不透明度。R43-16。 |

**既存試験の扱い**（削って合わせない。各assertの意図は新しい試験へ移し、段7の独立reviewの前に対応表を結果に載せる）:

| 既存の試験（`public-ticket-routing.test.mjs`） | 扱い |
|---|---|
| `shared helper route matrix…`、`Home renders the shared external CTA…` | 変更なし（`live-operations.js`は変えず、この2つはHomeの不正な予約先の文言を縛らない）。 |
| `home-rendering.test.mjs`の`T42-LIVE booking invalid`（`/<span[^>]*>予約URLが無効です<\/span>/`） | 期待を`予約先を確認中`へ改める（Q43-01。段2でRED→GREEN）。`internal`・`external`・`closed`・`past`・`duplicate`・`empty-id`・`no-helper`の各期待は変えない。 |
| `Live list renders shared reservation…`、`public Live summary, detail, and modal share…`、`Live details preserve legacy description…`、`Live detail replaces stale CTA state…` | 新しい描画へ移す（T43-LIST/DETAIL/CTA）。modalの検査は、modalに入口がなく新しい画面に無いので移さない（要件メモ`29:367`）。formatterの共有・説明の保持・4分岐は移す。不正な予約先の期待（`Live list renders shared reservation…`の`/予約URLが無効です/`、`Live detail replaces stale CTA state…`の`/予約URLが無効/`）は、新しい描画で「予約先を確認中」を期待する形に改めて移す（Q43-01。削らない）。 |
| `Home, Live list, Live detail, and ticket form all fail closed for duplicate Live IDs` | HomeとTicketの分を保ち、Live・Live詳細の分をT43-STATE-DETAIL・CTAへ移す。 |
| `ticket form lists and falls back…`、`ticket options and selected Live preview…`、`ticket form shows the empty state…`、`ticket classifies rejected deep-links…`、`ticket valid internal query wins…`、`ticket rejects external, past, closed…`、`ticket draft never restores…` | T43-TICKET-INIT/FORMへ移す。選択肢の順は「保存順」から「近い順」へ意図して改める（Requirements R43-07）。不正な予約先の期待（`ticket classifies rejected deep-links…`・`ticket rejects external, past, closed, invalid…`の`/予約URLが無効/`）は、「予約先を確認中です」を期待する形に改めて移す（Q43-01。削らない）。 |
| `ticket valid submission preserves the public API endpoint…`、`ticket trims public text fields…`、`ticket submission sends the submit-time guarded Live ID…`、`ticket confirmation and payload share one immutable Live snapshot…`、`ticket confirmation and JSON use only canonical ID controls…`、`ticket rejects invalid canonical quantity…` | T43-SENDへ移す。payloadの形・trim・送信時のスナップショット・canonicalなidだけを読むこと・枚数の検査は保つ。確認の表示（modal）の検査は、受付内容（T43-RECEIPT/COMPLETE）の検査に置き換える。 |
| `ticket helper failure is clear and fail-safe` | T43-TICKET-INITへ移す（S43-16）。 |
| `public HTML loads the helper in order…` | 4ページのscript一覧を新しい期待に改め（`live-operations.js`が`ticket.js`・`live-pages.js`より前）、ナビにTicketが無い検査は保つ。 |
| `ticket removes both copy elements…` | 保つ（`introText`・`noticeText`を読まない・要素がない）。 |
| `ticket completion has neutral static default…` | T43-COMPLETEへ移す。静的な既定は「受付内容なし」へ意図して改め、完了文の既定「予約しました。」は`ready`の中に残す。 |
| `public-music-data-compatibility.test.mjs`のLive・Live詳細 | 新しい描画（`live-pages.js`）で同じ互換（説明の保持・不揃いの日付）を検査する。Profile・Contactは変えない。 |
| `site-shell.test.mjs` | 4ページの`main`のbytes一致を外し、`<header>`・`<nav>`・`<footer>`のbytes一致とscript一覧の新しい期待に置き換える。他のページの保護・共通のCSS・script・ナビの試験は変えない。T44-STYLEの「`live-operations.js`等がbaseとbytes一致」は保つ。 |

全試験は段5・段7の後。基準はFrontの着手前の報告（サイト513 pass / 0 fail、Worker347 pass / 0 fail）で、実装後の件数を固定しない。command・exit・pass・failを記録する。

```bash
node --test test/
npm --prefix cloudflare/worker test
node --check assets/js/live-order.js
node --check assets/js/reservation-cta.js
node --check assets/js/live-pages.js
node --check assets/js/ticket.js
node --check assets/js/ticket-receipt.js
node --check assets/js/ticket-complete.js
scripts/aidlc-verify.sh --local
scripts/aidlc-cycle.sh status
git diff --check
git status --short
```

静的サイトのため別のbundle buildはない。Node24では`node --test test/`が動かないため指定のNode20を使う。`scripts/aidlc-verify.sh --local`が使う一時pathと、closeの一時pathは、後続のPacketで明示の許可を得る（今回のPacketは再実行しない）。networkを使う`--source`はこのIssueのWorkerでは行わない。

## 6. Frontの画面確認

今回のWorkerは`ui_route=none`。後続のFrontが撮影前に`ui_route=headless_acceptance:PS-L-01,PS-L-02,PS-L-05,PS-COM-02,AC43-LISTEN,AC43-PROD`を宣言する。挙動の判定は§5のNodeで行い、画像は配置・折返し・状態の外観を示す。

### fixture撮影scriptの契約

雛形は`docs/records/aidlc-cycles/2026-11-18_issue-44_music/_trace/aidlc-docs/construction/aidlc-integration/verification/capture-music.py`と、#42の`capture-home.py`。新規`verification/capture-live-ticket.py`は`--serve`（localhostのみ）と`--chromium`を持つ。Frontはexecution targetから次を実行する。インストールは不要で、Workerはbindしない。

```bash
/usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-live-ticket.py --serve
```

Pythonは`-I`なし、既存のPlaywright 1.58.0。clockは`page.clock.install(time=<秒>)`で固定（秒）。`**/api/public/site-data`はfixtureでfulfillし、`**/api/public/ticket-reservations`のPOSTはscenarioごとのfixtureの応答（201・400重複・500・保留・abort）でfulfillする。YouTubeのiframeとサムネイルはローカルのstubでfulfillし、localhost以外のrequestはabortして記録する（本番APIや外部へ通信しない。**本番の公開APIへPOSTしない**）。viewportは1440×900と390×844、`device_scale_factor=1`、`reduced_motion=reduce`。ready・`document.fonts.ready`・画像のloadを待つ。各撮影でconsole・pageerror・横overflow・各要素のbox・computed色・文字nodeの行数（要素の高さではなく、`Range.getClientRects`を行のtopごとに数える）を`capture-live-ticket-metrics.json`へ保存する。

| scenario | screenshots/内の名前と確認内容 |
|---|---|
| Live一覧 | `list-base`・`list-empty-upcoming`・`list-empty-past`・`list-error`・`list-loading`・`list-stale-upcoming`（日付を過ぎたupcoming）・`list-long`（長いタイトル・会場）・`list-no-image`。各`-1440`・`-390`。 |
| Live詳細 | `detail-base`（時間・料金・注記・共演・Instagram）・`detail-desc-only`（説明が9行・空行）・`detail-no-title`・`detail-no-image`・`detail-external`・`detail-closed`・`detail-invalid`・`detail-notfound`・`detail-error`・`detail-loading`。各2幅。 |
| 全件 | `archive-base`（空のタイトル・長いタイトルを含む）・`archive-empty`・`archive-error`。各2幅。 |
| Ticket | `ticket-base`・`ticket-draft`・`ticket-invalid`（名前・e-mail・枚数の誤り）・`ticket-sending`（POSTを保留）・`ticket-failed`・`ticket-duplicate`・`ticket-external`・`ticket-unavailable`・`ticket-empty`・`ticket-load-error`・`ticket-unidentified`・`ticket-fields-hidden`（枚数・備考を非表示）。各2幅。 |
| Ticket完了 | `complete-base`（Ticketの送信を通した直後）・`complete-reload`・`complete-no-video`・`complete-no-release`・`complete-playing`（stubのiframe）・`complete-missing`・`complete-long`（長い名前・備考）。各2幅。`complete-playing`は360幅も1枚。 |
| 流れ | 一覧のクリック → Ticketの送信 → 完了の画面遷移のURLを順に記録し、通る画面が3つであることを`flow-log.json`に残す。 |
| 外枠のsmoke | Home・Music・Profile・Contact・旧Discographyを2幅で`smoke-<route>-<width>.png`。5ナビ・本文・script/console異常なし。 |

保存先は`aidlc-docs/construction/aidlc-integration/verification/screenshots/`、metricsは同verificationの`capture-live-ticket-metrics.json`、実行logは`capture-front.log`。

合否: 1440pxでLive詳細の枠が420+56+504=980、Ticketの枠が560+56+364=980で、概要が入力中に画面内に残る（`position: sticky`）。受付内容の枠の幅が980。390pxで各本文が358幅、横scrollなし。Live詳細は日付・会場・予約がフライヤーより上、Ticketは概要が入力欄の上、送信ボタンが全幅（358）。player（`complete-playing`）は1440で480×270（±2）、390で326×200以上、360で高さ200以上。押せない予約は不透明度.4。入力誤り・失敗・通知・hover・focusに赤を使わない（computed色が`--accent`でない）。赤は見出しの線と主な操作1つだけ。長いタイトル・説明・受付番号・備考が欠けず折り返す。値の許容は罫線・丸めの±2px。fixtureの文量による全高の差は採用値を基準にする。Frontが全画像を目視し、spec・#42・#44の部品と照合する。render PNGのpixel比較済みとは書かない。font不一致が文字の受入に影響する時は未確認として残し、Frontの同font環境か本人の明示の受入で解消する。

startup failureもinitial attempt。同じrouteと同じACに具体的な修正仮説がある時だけ1回corrective retryし、失敗はAC単位の`visual_acceptance_pending`と残条件・必要なFront actionを返す。GUI/OS撮影への自動fallback chainを作らない。

### 本番の公開データでの画面確認（Front、確認2の前）

fixtureの撮影とは別に、scratchの配信用copyへ公開HTML・assetsだけを置く（repo全体・admin・token・private fileを配信しない）。配信用の`site-config.js`の変更はcopyの中だけ。PCの`http://localhost:8888/`は公開APIの許可リストにあるoriginから直接読む。スマホの経路は社内の規定で遮断されるため、390pxの画像で代える。公開APIは許可リストのオリジンだけに応える。

Frontがread-onlyで確認する: 一覧・詳細・全件・Ticketの概要の文字・日付・並び・画像、説明だけのライブ、空のタイトル、日付を過ぎたupcomingの「予約受付終了」、Ticketの初期選択、送信前のTicketの表示、**Ticketの送信は本番に届くので押さない**（送る時は`?dryRun=1`を付けるか、fixtureの撮影で代える）。完了ページは`?dryRun=1`の送信で確かめ、実際の本番の送信は、まとめ出しの直後に1件（Itsuki決定 2026-11-18）。記録は時刻・tested revision・件数・環境・成否と制約だけで、本番のタイトル・日付・会場・URL・画像のpathはrepoと承認の提示文へ書かない。Itsukiに渡す手元URLはscratchの提示材料に留める。Frontの確認は必須、確認2でのItsukiの閲覧は任意。必ず見るのはまとめ出しの前の1回で、見たい画面を確認2で見ると、cycleが閉じた後の直しが新Issueになる手間を減らせる、とFrontが伝える。

## 7. 並行Issue（#45）との重なりと切り方

#45（Profile・Contactの本文）は同じ`feature/39-public-pages`へ出る。重なりそうな面と、#43の切り方:

| 面 | #43の扱い |
|---|---|
| `assets/css/style.css` | 触らない。新規`live-ticket.css`に追記する（衝突なし）。 |
| `assets/js/site-content.js` | **1行だけ改める**（`renderHomeLive`の不正な予約先のラベル。Q43-01）。追記・移動・整形はしない。Live・Ticketは新規`live-pages.js`等で描画し、旧Live用の描画はデッドコードとして残す（まとめ出しの後に整理）。Music・#45の追記は末尾側で、この1行とは離れているため、textの衝突は起きない見込み。後から入る側がmergeで両方を残し、Homeの1行が「予約先を確認中」のままであること（`home-rendering`・T43-CTA）を取り込み後に再実行して確かめる。#45がこの行を触る、またはHomeの予約の文言を別の言い方に改める場合は意味の衝突なので、止めてFrontへ返す。 |
| 共有のcache query（`style.css?v=`・`script.js?v=`・`site-content.js?v=`） | 変えない。#43は新規ファイルと書き換えたファイルだけ`20261119-43`。`site-content.js`を改めてもqueryを変えないのは、Home・Music・Profile・Contactの各HTMLと#45の面に触れるため。古いcacheの閲覧者に旧文言が一時的に出うる点は§3に記録した。 |
| 4ページのHTML | `<link>`・scriptの行が#45の共有queryの更新と隣り合う。後から入る側が、#45のquery更新と#43の新規行を両方残す形で解決する（意味の衝突はない）。 |
| `test/home-rendering.test.mjs` | `T42-LIVE booking invalid`の期待1か所だけ改める。#45がHome以外の試験を変えるので重なりは小さい。 |
| `test/site-shell.test.mjs` | 4ページを例外にする行と期待表を最小の差分で改め、他は新規の試験ファイル（`live-ticket-shell.test.mjs`）へ置く。#45が同じ行を改める（Profile・Contactを例外にする）ので、後から入る側が例外の集合を足し合わせる。 |
| `docs/specs/current/public-site-ui.md`・`live-operations-admin-ui.md`・`README.md` | #43は§3・§5・§7に「Issue #43の…」の節を足し、他の節の文面を保つ。#45の追記とは節が別。後から入る側が節を並べて解決し、他Issueの承認済みbytesを無断で上書きしない。 |

後から入る側がまとめ用branchを取り込む。完成した#44の5ナビ・Music・旧URLを古い版へ戻さない。

## 8. 結果ファイルと確認2

| 成果物 | path |
|---|---|
| Code Generation Result | `aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md` |
| Build/Test Result | `aidlc-docs/construction/build-and-test/build-and-test-summary.md` |
| 実行log・script・metrics | `aidlc-docs/construction/aidlc-integration/verification/` |
| 画像 | `aidlc-docs/construction/aidlc-integration/verification/screenshots/` |
| cycle summary | `aidlc-docs/cycle-summary.md` |

結果には、実装path、昇格前後のhash、RED→GREENのcommandとexit、全試験のpass/fail、PS・AC別の証拠、既存試験の移し替えの対応表、Frontの撮影と本番データでの画面確認、実音と端末の制約、独立reviewの所見と修理を記す。未実施・未確認をPASSへ丸めない。Build/Test Resultとcycle-summaryは、未解消のblockingが無い場合だけ、次のfield形式にする。

```
- **Blocking Findings**: None
```

Frontが独立reviewを実装後に1回手配し、設計・実装・試験・昇格・受け渡しの安全・旧入口・Home互換・まとめ出しをまとめて見る。確認2の前に結果のbytesを固定し、本人のAをgate 4・5へ記録する。以後の説明追補で承認済みのartifactを無断で変えない。5 gateとFront completionの条件が揃ってからcloseへ進む。このPacketでは結果・承認記録・closeを作らない。

管理画面の操作をItsukiに頼む記述が必要になった場合は、本番の管理画面の表記（タブはSite / News / Live / YouTube / Disco / Profile）で書く。このcycleは管理画面の操作を頼まない（保存済みのデータをそのまま使う）。

## 9. まとめ用branchへの出し方とrollback

Owner決定（2026-11-18）の例外として、PR baseは`feature/39-public-pages`、headは`feature/43-live-ticket`。repoの規定（worktreeは`origin/main`から作り、PR baseはmain）との違いは、Requirements§8とauditに残す。着手時点で`origin/main`は`0803258`、`origin/feature/39-public-pages`は`ba12401`で、#43は`ba12401`から作った。formal closeの後に別途許可されたFrontが`ai-feature-push`・`ai-pr-create`で、試験済みrevision・scope・secretの非混入・baseを確認してPRを作る。PRには#43、AI-DLCのarchive、受入と検証、本番がまだ変わらないことを書く。`Closes #43`と書いてもmain以外へのmergeではIssueは閉じず、ProjectはReviewのまま。merge・PR承認はItsukiの明示判断。

#43のmerge後は、まとめ用branchの差分とcycle記録を確認し、#45へ取り込みを渡す。公開API・Worker・予約データは変わらず、Cloudflare Workerのdeployも本番の配信確認も行わない。まとめ出しの担当が、#43・#45の統合後に公開全ページの本人確認、mainへのPRとOwnerのmerge、本番のPages確認、本番のテスト予約1件、Issue・Projectのcloseを行う。

| 戻す時点 | 復旧単位と確認 |
|---|---|
| #43がまとめ用branchに入った後、main公開前 | Frontが#43のmerge差分だけのrevertを準備し、Itsukiの明示承認でまとめ用branchへ適用する。merge方式に応じて対象のcommitを特定し、無条件のmainline指定はしない。新しい4ページの本文・新規JS/CSS・試験・設計書の昇格・Homeの不正な予約先の文言（`site-content.js`の1行、`home-rendering`の期待、設計書§7の1文）が同じ単位で戻る（旧Live・Ticketの本文と旧modalに戻り、Homeの文言は「予約URLが無効です」に戻る）。#45が既に依存していれば、共通の試験と設計書の整合を確認し、必要な最小の修理を具体差分としてOwnerへ示す。作業branchのresetやforce pushで戻さない。 |
| まとめ出しがmainへ入り、本番公開後 | Frontがmain上のまとめ出し差分のrevert PRを準備し、Itsukiの承認でmergeする。#43・#44・#45を含む公開のbundleの直前版へ戻る（Homeの不正な予約先の文言も戻る）。まとめ出しの担当がPages buildと旧版の配信・予約の送信・Home・Live・Ticketを確認する。#43だけを機械的にrevertして、Musicとナビの新しい構成を壊さない。 |

どちらも、予約データ・Figma・#41のWorker・#44の変更・保存済みのデータは戻さない。受付内容はブラウザのsessionStorageだけにあり、移行や削除は不要。データの移行・D1の全体復元も不要。公開後に#43だけを戻す必要が出たら、#44・#45との依存を別Issueで承認する。Homeの文言だけを元に戻す場合は、`site-content.js`の1行・`home-rendering`の期待・設計書§7の1文を元の文言へ戻す小さな差分を、Frontが具体差分として示してItsukiの承認を取る（本番に不正な予約先は0件で、Homeの文言の誤りが予約の可否に影響しない）。Ownerのmerge承認とcycleの承認を取り違えない。

## 10. 停止条件と今回の返却点

許可外のwrite・network・secret、手順外のcycle故障、データの形・保存・Workerの変更が不可欠になること（たとえば受付内容を公開APIから読む必要）はBLOCKED。canonicalの元版hashの不一致、Figmaの未整合、承認digestの不一致は後続の実装を止めてFrontへ返す。価値判断が一部だけ残る場合は推奨案とowner_questionsを返し、作れる候補は完成させる。

今回は3つの未承認候補（Front判断FD1・FD2を反映した第2版）、設計書の提案版、Figma整合案、audit・stateまで。承認記録、canonicalの昇格、コード・試験・公開ファイル、撮影script・fixtureの実装は行わない。Requirements承認待ちを保つ。render画像・font・実音・本番の画面・独立review・Owner承認は今後の証拠で、候補の作成と分ける。
