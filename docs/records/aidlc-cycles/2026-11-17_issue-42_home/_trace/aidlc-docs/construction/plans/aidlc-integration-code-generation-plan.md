# Code Generation Plan — Homeと共通の外枠（Issue #42）

- Status: Draft / Itsuki承認待ち
- Unit: `aidlc-integration`
- Cycle ID: `2026-11-17_issue-42_home`
- Execution target: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-42-home`
- Base: `c26641815502d7d7fc64c0f00eed6cd0f35ced33`、branch `feature/42-home`
- Inputs: Requirements R42-01〜17・S42-01〜10/L、Approved公開設計§2〜7・管理設計§5.3、Figma反映済みv2 snapshotと下のF42採否・反映結果。
- Reader: human_reader / ja-JP / designated_text_editor。確認1でgate 3の対象とし、提案版のexact bytesを含める。

## 1. 変更後の体験と権限

Homeは作品を顔にし、その場で聴く入口と次のライブを近づける。1440pxは上部を2列、390pxはジャケットから縦1列に並べる。全9ページのヘッダー・フッター・Menuを同じ外枠へ更新する。Home以外の本文は現在のままで、共通部品の本文への適用は#43〜45へ渡す。

owner/approverはItsuki、executorは後続bounded Worker、reviewerはFrontが手配する独立read-only Reviewer、completion gate ownerはVECTOR。WorkerはGit write・外部write・承認記録・merge・deployを行わない。commit_modeは、formal closeのあとFrontが`feature/42-home`にcommit・pushし、`tools/_shared/ai-feature-push`・`tools/_shared/ai-pr-create`でPRを作る（#41と同じ形）。merge・PR承認・本番反映はItsukiの明示判断。risk_classはFull / D1 intent-sensitive。今回のPacketは候補作成までで、以下は確認1のA後に別Packetで実行する手順である。

方式は、既存rendererへHome専用の分岐を加える。Home全体を別のフレームワークへ移す案は依存と他ページへの影響が増えるため採らない。共有selectorの一括差し替えも他ページ本文を変えてしまうため採らない。再生はclick同期のiframe生成と破棄に絞り、IFrame Player APIを追加しない（§2.3）。

## 2. 実装する契約

### 2.1 Homeのデータと描画の責務

`index.html`にHome専用root `id=home-content`と`body.site-home`を置く。共通の`boot`はこのrootの存在でHomeを判定し、URLの階層推測だけに依存しない。`renderSite`のfooter処理は共有し、Home画像帯の処理と`home-hero-image`は撤去する。Home branchで`renderHome`を呼び、他ページは既存の`renderLive / renderLiveDetailPage / renderDiscography / renderProfile / renderYouTube / renderContact`を維持する。Home branchと既存`renderLive`の両方から次回欄を二重描画しない。

HomeのDOMには`home-featured-release / home-player / home-next-live-events / home-next-live-empty / home-news / news-items / home-music-items / home-profile-text / home-link-list / home-load-error`を固定idとして持たせる。section見出しとの`aria-labelledby`、再読込と聴く・閉じるの安定した`data-testid`を付ける。状態判定をDOMから逆算せず、取得状態と選択結果から1度決めて描画する。

| 内容 | 規則と実装上の注意 |
|---|---|
| 顔 | `MusicData.resolveFeaturedRelease(data)`をそのまま呼ぶ。nullはS42-08。明示id・日付・同日の選択を書き直さない。helperがない時は全体エラーとして安全側へ倒す。 |
| music | digital→demoを連結した配列から顔のidを除く。`sortReleasesByDate(...).slice(0,2)`。カテゴリは元collectionから対応づける。保存配列は不変。全日付不正で顔がnullでもmusicには残る。 |
| 名前・メタ | titleをescapeして登録どおり表示。releaseTypeとreleaseDateは別のmetaで、空でない値を` ／ `で結ぶ。日付の検査・分類が必要な箇所は`isReleaseDateFormat`を呼び、別regexを書かない。不揃いの旧日付を勝手に整形しない。 |
| 作品リンク | trim後、URLを構文解析してhttp(s)だけ許可。空、不正、javascript/data schemeなら非表示。digitalは配信先へ、demoは購入先へ。anchorのtarget/relとaccessible nameで外部遷移を伝える。 |
| news | 日付parserは既存`parseLiveDateTime`を再利用して安定降順sort（非破壊）、空・不正は末尾。先頭6件。説明はbrを改行にしてescape、全文を表示。linkTextは登録値、空なら既存`view...` fallback。旧先頭▷・末尾矢印を整えて末尾` →`を1つ付ける。内容途中の記号は削らない。サムネイルなし。 |
| profile | CRLF/CRとbrをLFへ→trim→`\n[\t ]*\n`で最初の段落→escape→単一LFをbr表示。空本文は空の文章を作らず、見出しとprofile →は残す。Profile本体のrendererは変えない。 |
| links | 既存`buildSharedLinks`のSite優先・Profile fallbackは保ち、その結果をHomeだけhttp(s)のURL検査でfilterする。Homeだけchip表示・Bandcamp（音源・物販）、外部iconのCDN呼出しは外す。Profileのリンク生成にHomeのラベルやclassを漏らさない。 |
| footer | `site.footerText`を全幅で全文表示。幅で削らない。成功時の空設定は現行どおり空。fetch失敗中はHTMLの既存の既定文言を保ち、現在年やサンプル文で捏造しない。Ticket/完了の既存footer処理も維持。 |

### 2.2 次のライブと4分岐

既存`sortUpcomingLives`の先頭を選び、過去日という理由でupcomingから取り除かない。日付は`formatSharedLiveDate`、詳細文字は`formatSharedLiveDetails`を使い、タイトルをその上へ別表示する。これにより構造化時間・料金・注記・共演を含む現在の情報と、構造化5項目が全空ならdescriptionを出す既存fallbackを保つ。Homeではフライヤーを出さない。Figma v2はE5〜E7でLiveと同じ書き方とOpen/Start・ticket:のサンプルへ反映済みで、この共通formatterを保つ。

`getSharedResolvedTicketCta(live,id,internalUrl)`を呼ぶ。内部urlは`ticket/?liveId=${encodeURIComponent(id)}`。helperが空id・重複id・欠落を拒否する経路を迂回しない。表示ラベルだけHome内で次へ対応づける。

| helperの結果 | Homeの表示 |
|---|---|
| active / external=false | 赤の予約する、内部Ticketへ。 |
| active / external=true | 赤の予約する（外部サイト）、helperのurlへ別タブ・noopener noreferrer。 |
| inactive / reason=reservationClosedまたはpast | 予約受付終了。anchorや押せそうなdisabled buttonにせず非操作の文字。 |
| inactive / reason=invalidTicketUrl | 予約URLが無効です。hrefなし。 |
| inactive / helperUnavailable / missing / ambiguous | 予約情報を確認できません。hrefなし。 |

有効idの詳細は`live/detail/?liveId=…`、識別不能なら`live/`。通常・外部・終了・無効でも`all live →`は`live/`へ。upcoming空だけは「次のライブは、決まり次第ここでお知らせします。」と「これまでのライブ →」を`live/detail/?view=past`へ。現行archive routeを使い、#43の新しいページを先取りしない。

日付が過去でもupcoming欄に残るケースで、表示は残り予約だけ閉じることを固定時刻の試験にする。説明だけの本番14件はpastなので現在のHome選択に影響しないが、架空のupcoming description-onlyでも情報を失わない試験を用意する。

### 2.3 「聴く」の生成・停止と限界

新規`assets/js/home-player.js`を小さいbrowser IIFEとして作り、`window.HomePlayer`に`open / close`の2操作を持たせる。indexだけでsite-contentより前に読み込む。映像を3カテゴリから連結して`id===playbackVideoId`で解決する。youtubeIdはtrim後の11文字の`[A-Za-z0-9_-]`として検査し、不正・空・切れた参照はS42-06。これは入力保存の制約追加ではなく、埋込URLを作る公開側の防御である。

押したclick handler内で、await、timer、外部APIのready待ちを挟まず、前のiframeを閉じ、新しいiframeを生成して挿入する。srcは`https://www.youtube.com/embed/<encodeURIComponent(youtubeId)>?autoplay=1&playsinline=1&controls=1&rel=0`。`allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`、`allowfullscreen`、`referrerpolicy="strict-origin-when-cross-origin"`、作品名を含むtitleを設定する。mute指定、隠れた自動再生、初期ページ読込時のYouTube接続は行わない。

作品の直下に幅100%・aspect-ratio 16/9（max-widthは親幅）のplayerを置く。v2の状態frame `24:184` はE11で530×298（round(530×9/16)）へ反映済み。CSSは親幅に追従する16:9で実装する。聴くを閉じるへ替え、aria-expanded/controlsを同期する。開いたplayerへ勝手にscrollしない。外部の配信／購入リンクは残す。

closeはsrcをabout:blankへしてiframeをremoveし、残った参照をnullへ、元の聴くを復元しfocusを戻す（再描画・pagehideによるcloseはfocusを動かさない）。同じ箇所の連打と再openでもiframeは最大1つ。再読込・Home再描画前・pagehideでもcloseする。Menuは表示を開閉するだけなので再生は継続し、Menuのリンク選択による遷移はpagehideで停止する。

IFrame Player APIの事前読込案はready前の最初のtapを保証できず、非同期境界と外部script依存を増やす。click後にAPIをloadする案も初回再生を遅らせる。直接iframe案は既存YouTube rendererと同じ埋込方式を利用し、click同期で有音の開始を要求する。しかしブラウザのautoplay制限を解除する保証はない。外部公式仕様の最新確認とPC/iPhoneの実音はGapである。iframe loadを音の開始とみなさず、再生がブロックされた時は標準controlsから再生できる状態を残す。

Q42-01の推奨は、確認2で実機結果を見て追加tapの例外採否をItsukiが決めること。例外を認めない・埋込禁止・再生不能ならmergeしない。1操作の基準を試験だけで緩和しない。公式資料のread-only調査が可能な後続環境では、YouTube Embedded Players and Player ParametersとWebKitのvideo policyを確認しURL・取得日・適用範囲を結果へ記録する。調査の結果がこの方式を変えるならgate 3へ戻す。

### 2.4 外枠と共通部品

全9 HTMLのheader/footerへ`.site-header / .site-footer`を付け、`id=global-nav / .nav-toggle / .nav-toggle-text / .logo / id=site-footer`のhookは保つ。新しいJSによる外枠のfetch挿入は採らず、各HTMLに同じ構造を置く。階層別の既存hrefを維持し、6項目の順序・表示名を変えない。Ticket/完了にsite-contentを追加しない。

外枠は白地と細いline、文字はink/subtext。既存のstickyは維持し、header-scrolledで高さ・余白・影を変えない。blur・pill型active背景・赤いhoverを新外枠では解除する。navはLabel、activeだけink、他はsubtext。footerはmargin-topの旧60pxを新外枠で解除し、線・Caption・所定paddingで区切る。これらの変更を本文のbackground/section/文字には波及させない。

`script.js`のMenuは820px以下を狭い幅の境界として維持し、Menu⇄閉じる、aria-expanded、navのhiddenを同じ関数で同期する。desktopではhiddenを外す。開いた時にtoggleからTabで6項目へ順に進め、閉じたnavはfocus対象から外す。Escape・リンク選択・幅>820へのresizeで閉じる。Escape/明示閉じるはtoggleへfocus、リンク選択は遷移を妨げない。6行分を固定max-height 360pxに収めず、短い画面では`max-height:calc(100dvh - 81px)`と縦scrollで最後まで選べる。body全体のscroll lockやmodal化は不要。

ロゴの赤いi、クリックhook・波紋・26個の音符粒子の色・動き・タイミングとreduced-motionの停止は今のまま維持する（Front D1、E1・E3）。ロゴを押した時の演出をmonochrome化しない。ロゴhoverの赤い線は解除する。ナビやリンクのhover/focus、選択色、scrollbar、背景にも赤を使わない。Homeの初期コンテンツはfade-inのopacity 0にせず、動的newsの表示もIntersectionObserverの初回検索から漏れて不可視にならないようにする。他ページの既存fade-inは保つ。

| 部品の新class | 寸法・構成 | 今回のconsumer |
|---|---|---|
| `.site-button`＋primary/secondary/play modifier | Label 14/22・weight500・4%、padding12/24、radius12。Primary/Playは高さ46、Secondaryは線込み48。Playだけ白の16×16再生icon。 | Homeの予約／詳細／聴く／閉じる／retry。 |
| `.site-chip`、`.site-text-link` | chipはpadding8/16・radius999・gray100。文字linkは文字＋→。hover/focusもmonochrome。 | Homeの作品外部link・links・一覧入口。 |
| `.site-section-title`、`.home-caption` | 主要見出し28/42・500、gap8で40×2赤線。new release/next liveは12/18・8%のsubtext captionで線なし。 | Homeの主要4見出し、補助2ラベル。 |
| `.site-release-card` | PCは画像208角・radius12、gap8、LabelとCaption。390pxは72角画像＋文字、gap16。 | Homeのmusic 0〜2件。後続#44で本文適用。 |
| `.site-news-item` | 日付88幅、右列、gap24、上下padding16・下線1。右列gap4、タイトル16/26・説明14/22・link Label。 | Homeのnews。行間PC0、390px8。 |

既存`.cta / .section-title / .live-event / .discography-item / .application-link`全体のstyleを書き換えない。共通部品は後続でも同じclassを付けて使える形に定義し、今回は未使用の本文へclassを追加しない。共通footerのCaptionを全9ページへ適用する。

### 2.5 レイアウトとFigma整合

色は既存の`--paper / --paper-deep / --ink / --ink-muted / --line / --accent`を使用し、新しい色・書体・weightを増やさない。tokensファイルとDESIGN_RULESは変更しない。FigmaのDisplay/Label/Captionは既存family/400/500とsnapshotの寸法をcomponent classへ対応づける。

- PC 1440: 中身max-width980を中央（左右230）。header上下24、約79高。上部上下64、ジャケット440角・radius16、右列492、gap48（F42-06）。右列は作品→gap32→区切り→次回。作品名40/56・2%、次回日付28/42。下の2帯は492/440の2列・gap48・上下64。news/music帯はgray100、profile/links帯は白。footer上下32。
- 390: 左右16・中身358。header上下16・名前20/30と英文12/18の縦並びで81高。新作と次回の上下24、後続欄上下32、footer上下24。ジャケット358角、new releaseより上へ置く。作品名28/42。次回とmusicの帯はgray100、他は白。news→music→profile→linksの順を変えない。
- 中間幅: 820以下を1列。PC側画像は幅min(440px,45%)、右列はmin-width:0で残りを使い、gap48。6項目navが収まることを821/1024でも確認する。body.site-homeだけ既存のradial背景・紙目・赤いscrollbar/selectionをmonochromeに上書きし、全ページ本文を巻き込まない。focus outlineはHomeと新外枠でinkを使う。
- 長いタイトル・長い登録文は折返し、カードや操作をはみ出させない。PS-H-01/02の初期範囲に収まらない実データが出たらfontを黙って縮めず画面付きでFrontへ返す。

参照するFigmaはFront反映後の`/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-223255_1212hp-42-home/figma-snapshot-v2/`。文言の書き出しは2026-11-17T23:16:01+09:00、`page-0-1_master-home.md`のSHA-256は`b08d37109e0f407cbf15c65442c027c677cfb7297dcd3e913d12f7b7a27483c8`、`SHA256SUMS`のSHA-256は`27defc5c6f6b7f1c2f6b5d6dd8cb29645050c038cf31b69020f87bec6071428f`。`diff-vs-v1.md`の結論は`unexpected: none`で、差はE1〜E14だけ。修正前の`figma-snapshot/`（v1）は比較用provenanceとしてauditに残す。`39:850`・`20:23`のspecとrenderはv1の写しで、新しいlayout/style観測とはしない。

F42-01〜09の具体的node・修正前・Front採否・反映後・E-idは`aidlc-docs/construction/aidlc-integration/figma-fix-requests.md`に固定し、SHA-256を§3に含める。F42-01はD1のロゴ維持、02〜09はD2の推奨案採用でFigmaへ反映済み。修正の定義は`/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-223255_1212hp-42-home/figma-delta-42.md`（SHA-256 `909acbee1e1b20e27a1db3790592b2dff524bd2b8d47eda18273c0bbcf285b81`）。確認1でItsukiに同じ版を示し、新しい変更が要る時は影響する候補・提案版を修理して新digestで承認する。

### 2.6 10状態・読込・retry

RequirementsのS42表を実装の状態表として使う。初期HTMLに空見出しと淡い面を用意し、fetch待ちの間だけbusy。成功後は骨組みを消す。Home以外のfetch失敗時の見え方はこのIssueで変更しない。

Homeのfetchは既存の公開endpointとenvelope/body両対応を維持し、null・配列等のrootを成功とみなさない。HTTP/JSON/network失敗はS42-10。全体は成功でもlive.upcomingが配列でない場合とLive局所描画失敗はS42-04として隔離する。news未登録は空配列扱いでS42-09。1つのfetchしかないためLive専用APIや独立通信を追加しない。局所失敗のretryも同じGETを読み直す。

再読込ボタンは進行中無効、request serialで遅れた応答を無視する。listenerはrootへのdelegationを1回だけ登録する。retryで前のplayerを閉じる。全体失敗の1つの知らせには、既存READMEにあるBandcamp/YouTubeの公開URLを静的fallbackとして含める。新しい本番dataや管理原本を埋め込まない。

### 2.7 管理説明と途中の文言

`admin/index.html`の共有時の画像label・form id・保存処理は維持する。Homeの帯を兼ねる説明は置かず、既存説明が必要な場所には「ライブの画像がない時、共有時の画像に使います。Homeには作品のジャケットを表示します。」とする。画像helpを追加する場合は既存のhelp classだけを使い、技術keyを画面に出さない。`admin/README.md`の「公開画面は現在の表示を維持します。新項目を使う公開表示・再生は#42〜#44の範囲です。」を、#42後はHomeで使い、Music/Ticket完了は後続、という現在の説明へ置き換える。#41の反映・復旧段落は履歴と明示して残し、現在の#42の手順はWorker deployなしと記す。

Homeのmusic → / all live → / これまでのライブ → / profile →、6ナビと管理説明はRequirementsの行き先表どおり。Figmaの最終5項目は#44まで採らない。ほかの本文にMusic統合やContact新状態を先行実装しない。

## 3. 設計書の提案版と昇格

以下は昇格後の最終形で`Status: Approved`だが、保存場所は提案版であり今回承認済みではない。Owner approval欄は#42 gate 3を参照し、#41/40の承認をPriorとして保持する。関係のない本文・比較時点`00cdea5`の事実は保持し、#42の実装入力と結果への参照を追記した。

| 提案版（repo相対path） | 昇格先 | SHA-256 |
|---|---|---|
| `aidlc-docs/construction/aidlc-integration/proposed/public-site-ui.md` | `docs/specs/current/public-site-ui.md` | `62f98fa71d78ba008b25219e57d574d58641ffdf8e8d3e69307c752ffafa9d14` |
| `aidlc-docs/construction/aidlc-integration/proposed/live-operations-admin-ui.md` | `docs/specs/current/live-operations-admin-ui.md` | `3d2bbcb5556b3cec861812836cc7f7c7cd81b0702fc80f6e5dbd9f8f3ac953a8` |
| `aidlc-docs/construction/aidlc-integration/proposed/README.md` | `docs/specs/current/README.md` | `542d49ceb65c0aa5ba33ece3e9508d378cd009e1f7a5d9e40008083647467062` |
| `aidlc-docs/construction/aidlc-integration/figma-fix-requests.md` | 昇格なし。承認対象の採否・反映結果 | `b018bf75a86fb4063b113878ffa72ebb705864c55867f6c1baa934fc9ee791c4` |

昇格前canonical hashは公開`8b886e4346c16eaec93ca4c5b76d13285d85c45255d38664ca3f778433bf58a6`、管理`43e4c9f407f26a8a6e2df8fe41636d7c714c03d9ebd83f2d339b5801b5767177`、索引`6b48f3d983fb4e46073b5a28c29537508156a51a696ab3d448acf2654cc32ac7`。後続Workerはこれらが別作業で変わっていないことを確認し、3承認のexact digestとcycle identityを検証する。その後、各提案版を文字・改行・日付・Statusを変えず対応先へcopyし、`shasum -a 256`と`cmp -s`の両方で一致を確認する。昇格先で文章を仕上げる工程は作らない。

公開設計は§3のHome/Menu実装入力、§5のデータ表示、§6の途中状態、§7のHome条件と再生を追記。管理設計は§5.3の共有画像の実態と#41時点の履歴の区別だけ。索引はその対応と結果参照を追記。system-design-principlesと他の節を変更しない。承認後に仕様の変更が必要なら提案版から再承認する。

## 4. 後続Workerが変えるファイル

| path | 変更内容 |
|---|---|
| `index.html` | Home構造・静的読込骨組み・失敗fallback、music-data/home-playerの読込順、全体の外枠。 |
| `live/index.html`、`live/detail/index.html`、`ticket/index.html`、`ticket/complete/index.html`、`discography/index.html`、`youtube/index.html`、`profile/index.html`、`contact/index.html` | header/footerの構造・明示classと共有style/scriptのcache queryだけ。本文・ページ固有scriptの順序と値は保つ。 |
| `assets/css/style.css` | 明示classの共通部品・外枠とHome限定レイアウト、旧Homeの不要selector整理。本文用のglobal selectorを一括改変しない。 |
| `assets/js/site-content.js` | Home専用renderer、shared footer維持、Homeのfetch失敗・状態・retry。ほかのrendererは現挙動を保つ。 |
| `assets/js/home-player.js`（新規） | click同期iframe生成・破棄・1個制御。 |
| `assets/js/script.js` | Menu同期とEscape、Home初期表示を隠さない調整。ロゴの赤いiと押した時の波紋・音符の色/動き/タイミング/reduced-motionを維持し、monochrome classを加えない。ロゴhoverの赤い線はCSS側で解除する。 |
| `admin/index.html`、`admin/README.md` | 共有画像と#42公開後の説明。保存処理・app.js・style.cssは変更不要。 |
| `test/home-rendering.test.mjs`、`test/home-player.test.mjs`、`test/site-shell.test.mjs`（新規） | 下のfocused test。Node標準test/vm/assertだけで実DOM出力とイベントを検査。 |
| `test/public-music-data-compatibility.test.mjs` | #41時のHome不変期待を新しい意図したHome期待へ置換。非Homeの公開互換・description-only保持は残す。 |
| `test/fixtures/home-states.json`（新規） | 架空の作品・Live・news・段落・5リンク・10状態。公開用bodyで構成し、本番JSONを複写しない。 |
| `docs/specs/current/public-site-ui.md / live-operations-admin-ui.md / README.md` | §3のexact bytesを昇格するだけ。 |
| `aidlc-docs/` | 後続のaudit/state/result、検証ログ・画面・撮影script・cycle summary。 |

`assets/js/music-data.js / live-operations.js / site-config.js`、tokens、DESIGN_RULES、`admin/app.js`、全`cloudflare/`、データshape・保存値、依存packageは変更しない。既存の`public-ticket-routing / music-data / live-operations`試験を削って合わせない。style/script更新のcache queryは全consumerを同じ#42版へ揃えるが、scriptの順序は変更しない。indexだけsite-config→live-operations→music-data→home-player→site-content→scriptの順とする。

## 5. 8段の実装とfocused test

全commandはexecution targetから実行し、先にNode 20を選ぶ。以下の新しいtest名は提案で、後続Workerが実装する。各focused commandで0件を成功としない。

```bash
export PATH="/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH"
node --version
```

### Step 1 — 承認・昇格と保護する比較を固定

3承認・提案版hash・Figma整合を確認し§3を昇格する。現行各HTMLのheader/footer以外とscript一覧、shared rendererの非Home出力を試験で保護する。既存VM harnessを参考にfake documentへevent・classList・attribute・focus・iframe生成/削除の最小機能を実装し、既存sourceをvmで実行する。架空fixtureを作り、本番本文を使わない。

```bash
node --test test/public-music-data-compatibility.test.mjs test/public-ticket-routing.test.mjs
```

変更前のcharacterization PASSは偽のREDにしない。新Home要件のREDはStep 2以降で記録する。HTML本文は実装前のbytesをscratchに控えて比較し、後から自己生成した期待値だけで検査しない。scratchは後続Packetで許可された専用pathを使う。

### Step 2 — 顔・作品名・music・Home骨格（R42-01/02/08）

新Home DOMをfixtureから描画する試験を先に追加しRED。明示指定・自動・同日・両カテゴリ・切れた参照・全日付不正・空・非破壊・顔を除く2件・0/1件・種別空/入力あり・旧タイトル保持を検査する。indexとHome rendererを実装してGREEN。helper未読込のfail-safe、API envelope/body両対応、3key欠落/空/登録ありを含む。

```bash
node --test test/home-rendering.test.mjs test/music-data.test.mjs
```

新Home以外に3keyによる表示変化を漏らさない。既存Home不変試験の変更理由と新試験への対応を結果に残す。

既存compatibility harnessは非Homeのrouteでも`home-hero-image`等のHome専用idを作っている。後続の試験では実HTMLに対応するidだけを作り、Homeは新rootと必要なhelperを読み込む。非Homeに存在しないheroのassertだけを整理し、実在するDiscography/Liveの本文・日付原文・description-only・リンク不変のassertは残す。

### Step 3 — その場の再生と作品リンク（R42-03/04）

clickを実dispatchするplayer試験をREDにして、home-playerとHome操作を実装しGREEN。3映像カテゴリ、youtubeId不正、未選択、リンクのみ、再生＋リンク、Demo文言、危険なURL、escape、同期生成、iframe属性、1個制御、closeのsrc解除/remove、focus、retry/pagehide停止を検査する。Promise待ち後に開く実装が通らないよう、dispatch直後にsrcとDOM挿入をassertする。

```bash
node --test test/home-player.test.mjs test/home-rendering.test.mjs
```

ここで証明するのは再生要求と停止・UI状態まで。実音のPASSは付けない。

### Step 4 — 次のライブ・news・profile・links（R42-05〜10）

内部/外部/受付終了/不正URL、過去日のupcoming、重複id、空id、helper不在、予定0、description-onlyのケースをRED→GREEN。Homeの日付・会場・タイトル・詳細文字とhrefを検査し、全体Live helperは変更しない。newsは逆順7件・同日・不正/空・画像ありでもサムネイル0・description/linkText保持・linkなしを検査。profileはCRLF/空白行/br/空/単一改行/escape。linksは5つ・順序・Site優先・fallback・不正URL・HomeとProfileのラベル分離。

```bash
node --test test/home-rendering.test.mjs test/public-ticket-routing.test.mjs test/public-music-data-compatibility.test.mjs
```

Homeの主要振る舞いが揃った区切りとして§7の全試験を1回実行する。

### Step 5 — 10状態と読み込み・再試行（R42-15、PS-COM-02）

Requirementsの全S42をfixtureのvariantに割り当て、待ちPromise・HTTP失敗・JSON throw・network rejection・不正root・不正live・局所例外・成功空を分けてRED→GREEN。画像onerrorもイベントで発火する。エラー通知が1つ、busy解除、retryから回復、連打で同時要求1、古い応答無視、再描画でlistener/iframe増殖なしをassertする。

```bash
node --test test/home-rendering.test.mjs test/home-player.test.mjs
```

ここでは全試験を流し直さない。失敗を隠すcatchで全て空データにする実装を禁止する。

### Step 6 — 共通外枠・部品と管理説明（R42-11〜14/16）

9ページのhrefをURLで解決し、階層ごとに6項目のラベル・順序・行き先が一致する試験を先にRED。script一覧はpre-change比較を使い、indexの2script追加以外はcache queryを除き不変をassertする。DOMでMenu開閉・aria・hidden・Escape・resize・各リンク選択、logo clickの波紋と粒子、reduced-motionを検査。styleはnew classのscope、赤を許す部位、旧本文selectorの不変を検査する。

```bash
node --test test/site-shell.test.mjs test/public-ticket-routing.test.mjs
node --test test/admin-image-form.test.mjs
node --test cloudflare/worker/test/og-live.test.js
```

header/footerのHTML、style/script、管理説明を実装しGREEN。admin画像hookと#41の入力・保存は変えない。OG既存テストは回帰のcharacterizationでよく、不要なREDは作らない。Home hero非使用と管理READMEの現状説明をshell試験に含める。外枠統合後の区切りとして§7の全試験を実行する。

### Step 7 — localhostの画面とPC/スマホ再生の受入材料

§6の手順で画面を撮り、寸法と目視を照合する。必要な修理は影響するfocused testと撮影だけを更新し、新規変更が全体回帰へ波及した場合だけ全試験を追加する。sandboxでbrowserが起動しない場合は1回の具体的修正までで停止し、Frontへ同一手順・残るACを渡す。

### Step 8 — 結果を固定してFrontへ返す

実装したファイル、提案版昇格hash、実施したRED/GREEN、command/exit/件数、AC別の証拠、実音・画面・本番の未確認を結果に記録する。Frontが独立reviewを1回行い、修理後の結果を固定して確認2へ出す。承認済みplanは実施チェックのために書き換えない。

| 成果物 | path |
|---|---|
| Code Generation Result | `aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md` |
| Build/Test Result | `aidlc-docs/construction/build-and-test/build-and-test-summary.md` |
| 実行log / capture script / metrics | `aidlc-docs/construction/aidlc-integration/verification/` |
| 撮影画像 | `aidlc-docs/construction/aidlc-integration/verification/screenshots/` |
| cycle summary | `aidlc-docs/cycle-summary.md` |

Build/Test Resultとcycle summaryの`- **Blocking Findings**: None`は未解消blockingがない時だけ使う。実音例外が未受入、画面未確認、独立review未完ならその残件を正しく記す。後続の本番結果はFrontの追補で扱い、すでに承認した結果のbytesを無断で変えない。

## 6. 画面の撮影と実音の確認

今回Workerのui_routeはnoneで、既存Figma renderの読取だけ。後続の宣言は`ui_route=headless_acceptance:PS-H-01,PS-H-02,PS-H-04,PS-H-06,PS-COM-01,PS-COM-02`。新撮影は実装後に必要な外観ACに限る。

### localhostと決定論的な入力

`python3 -m http.server 8888 --bind 127.0.0.1`をexecution targetから起動する。`/usr/bin/python3`のplaywright 1.58.0と既存Chromiumを使い、installしない。新規`verification/capture-home.py`へ次の処理を実装する（このPacketではscriptを作らない）。

1. `test/fixtures/home-states.json`を読む。各scenarioは架空データだけで、repoの既存local画像を参照する。meta.updatedAtは固定する。API envelope/bodyの両方をVMで検査し、captureはenvelopeに統一する。
2. `context.route('**/api/public/site-data', handler)`でfixtureをfulfillし、実際の本番APIへ送らない。response pending/HTTP failure/不正liveも同じrouteで制御する。localhost以外の全requestをabortする。YouTube iframeはlocalhostのダミーplayer HTMLへfulfillする。この画像を実再生の証明にしない。
3. `reduced_motion='reduce'`、device_scale_factor=1、固定viewportと時刻を使用。`document.fonts.ready`とlocal画像loadを待つ。外部fontをabortした環境ではfallback fontとなるためfont名とmetricsを記録し、厳密な文字・折返しの受入は「未確認」とする。Frontの許可環境で既存fontを取得できる場合は同じ版を利用し、外部fontのためだけに本番dataへ接続しない。
4. ready状態、scrollY=0、document.scrollWidth≤viewport幅、対象bounding boxのtop/bottom/rightをJSON metricsへ保存。各画像をview_imageで目視し、Figma v2の同幅renderと比較する。sample本文とのピクセル一致を要求しない。

| シナリオ | viewportと画像名（screenshots/配下） |
|---|---|
| 通常・内部予約・映像あり | 1440×900 `home-1440-first.png`と`home-1440-full.png`、390×844 `home-390-first.png`と`home-390-full.png`、390×667 `home-390-667-first.png`。 |
| Menu開→閉 | 390×844 `menu-390-open.png / menu-390-closed.png`。6項目・最後のContactまで、短い高さでもscrollで届くこと。 |
| 外部予約・受付終了・予定0・不正予約URL | 1440×900と390×844で`home-<scenario>-<width>.png`。最初の3つはS42-01/02/03、無効は追加防御。 |
| Live失敗・全体失敗・読込中 | 同2幅、S42-04/10/L。`home-live-error-*.png / home-error-*.png / home-loading-*.png`。 |
| 再生を開いた後・映像なし・画像なし・作品0・news0 | 同2幅、S42-05/06/07/08/09。`home-player-*.png / home-no-video-*.png / home-no-image-*.png / home-no-release-*.png / home-no-news-*.png`。 |
| 中間幅 | 821×900と1024×900 `home-821.png / home-1024.png`。nav折返し・横overflowなし。 |
| ほか8ページ | 1440×900と390×844 `shell-<route>-<width>.png`。各routeの外枠・本文のsmoke、pageerror/console errorとscript response失敗0。Ticket/Contactの実送信はしない。 |

PS-H-01はジャケット・タイトル・日付・予約・聴くのboxが900内、PS-H-02はジャケット全体と作品名が844/667内を確認する。読み込みやMenuで意図的に下へ押す画面を通常の初期範囲判定へ混ぜない。画像なしの淡い面と長い文字の折返しも確認する。

起動失敗もinitial attempt。concreteな修正仮説がある場合だけ同route/同ACで1回retryし、失敗なら`visual_acceptance_pending`と残るAC・command・logをFrontへ返す。GUI browser/OS screenshotへのfallback chainは作らない。Frontは同じscript・fixture・Playwright環境で実行する。

### 確認2のItsukiの操作

確認2の前にFrontがItsukiへ「管理画面で実際の1作品に種別と映像を選んで保存し、Siteの顔にする作品にその作品を選んで保存する」ことを頼む。すでに保存済みなら入れ直さない。実際に残す値を通常保存し、試験専用値の入力・復元は求めない。#41の`test/public-music-data-compatibility.test.mjs`が、3項目の欠落・空・登録ありで現在の公開画面が変わらないことを保証する。

Frontはfixture撮影の画像と別に、branchの本番公開データを直接読む手元配信URLをPC・スマホ用に用意する。`assets/js/site-config.js`の`window.SITE_API_BASE`は`https://1212hp.itsukimatsumoto.workers.dev`を指定しており、公開GET `/api/public/site-data`は認証不要。`Access-Control-Allow-Origin: *`の本番応答はFront確認済みである。新Homeをbranchから配信し、確認2の経路にはfixture応答・API route置換・YouTube stubを使わない。

端末からlocalhostは開けないため、Frontの許可範囲でLAN配信または既存previewのtunnelを使いURLを先に検証する。後続Packetのlocalhost-onlyをWorkerが広げない。repo全体のhttp.serverをそのまま外へtunnelせず、公開HTMLと必要な公開assetだけの一時copyを配信する。管理画面・token・管理原本・private fileは配信対象に含めない。本番の公開データはブラウザからAPIを直接読み、本番JSON・画像URL一覧・本文をrepoやfixtureへ保存しない。fixture撮影のlocalhost-only配信は前節の手順で別に続ける。

Frontが公開projectionの該当id・3項目とURLの到達性・tested revisionをread-only照合する。確認2ではItsukiがPCと実iPhone Safari（可能ならAndroid Chrome）で同じ作品の顔・種別・「聴く」の1操作実音・「閉じる」による停止を確かめる。ブラウザ名・OS・viewport・操作回数、時刻・tested revision・該当id・成否を記録する。初回未再生・追加tap・埋込拒否を分け、成功へ丸めない。問題が出た端末だけ追加確認を頼み、Q42-01の例外が未受入、または保存・実データ表示が未確認ならmergeを止める。

## 7. 区切りの全試験と静的検証

Step 4とStep 6完了の2回実施し、新しい修理・失敗・未解消の懸念がある時だけ追加する。基準のpass 280 / fail 0（Node）と347 / 0（Worker）はFrontの着手前報告であり、実装後の件数を固定しない。

```bash
node --test test/
npm --prefix cloudflare/worker test
node --check assets/js/site-content.js
node --check assets/js/home-player.js
node --check assets/js/script.js
scripts/aidlc-verify.sh --local
scripts/aidlc-cycle.sh status
git diff --check
git status --short
```

静的サイトなので別bundle buildはない。HTMLのhref/srcをファイル存在とURL解決で確認し、9ページの本文保護、3canonicalのbyte一致、approved plan digest不変、scope、production本文の非混入を検証する。verifyが作る`/private/tmp/aidlc-archive-verify.*`等の一時pathは後続Packetで明示許可する。今回のPacketはそのpathを許可していないのでlocal verifyを再実行せず、Frontの既済PASSと今回のread-only statusを分けて記録する。

| 試験群 | 必須ケース / 受入 |
|---|---|
| T42-DATA | R42-01/02/08、3key欠落/空/登録、明示/自動/削除後/同日/全不正/空/非破壊。 |
| T42-PLAY | R42-03/04、S42-05/06、click同期のsrc/属性/insert、closeと遷移の停止、外部link安全性。実音は別証拠。 |
| T42-LIVE | R42-05/06、PS-H-04、予約4分岐、upcoming過去日・曖昧id・空id、title/詳細文字保持・description fallback。 |
| T42-CONTENT | PS-H-05、news6・sort・説明/linkText・no image、profile先頭段落、5リンク、music2、footer全文。 |
| T42-STATE | PS-COM-02 Home、全S42・busy・失敗/空の区別・retry/race・画像error。 |
| T42-SHELL | PS-COM-01 #42分、AC42-COMPAT/INTERIM/SHARE、6navと9route、Menu/scripts、本文保護、admin説明とOG不変。logoは赤いiと押した時の波紋/音符の色・動き・timing・reduced-motionを維持し、hoverの線だけ赤を除くことを検査。 |
| T42-VISUAL | PS-H-01/02/04/06、Menu/各状態、v2画像＋box＋目視。ロゴの赤いiと押した時の演出は維持し、ナビ/リンクのhover・focus、選択色、scrollbar、背景、ロゴhoverの線に赤がないことを照合。font制約・実音を分離。 |

## 8. #42の本番公開と#41の残る確認

このrepoはGitHub Pagesがmainの`/`から静的配信するとのFront確認を前提にする。**mergeが本番公開を起動する**。#42単独で公開し、Cloudflare Workerは変えないのでdeployしない。確認1のAやcycle closeをmerge承認にしない。

1. **確認2前・merge前**: 実装Workerの全試験・fixture撮影→Frontの独立review→修理。FrontがItsukiへ§6の実際の1作品の種別・映像・Siteの顔の保存を頼む（保存済みなら入れ直さない）。#41の公開互換試験を根拠に、現公開画面を保ったまま通常保存する。Frontが公開projectionをread-only照合し、本番公開データを直接読むbranchの新HomeをPCとスマホから開けるURLで出す。本番データをrepoやfixtureに取り込まない。
2. **確認2**: Itsukiが同じ作品の顔・種別・「聴く」の実音・「閉じる」をbranchの画面で確認する。これでAC42-PRODとPS-H-03の実機受入をmerge前に行う。再生例外の必要があればQ42-01を判断し、未受入なら止める。確認結果をCode Generation Result / Build/Test Resultに反映し、そのfresh digestへ本人Aを記録する。5 gate・独立review・Front受入を満たしてformal closeする。
3. **formal close後・merge直前**: Frontがbranch `feature/42-home`にcommit・pushし、`tools/_shared/ai-feature-push`・`tools/_shared/ai-pr-create`でPRを作る（#41と同じ形）。WorkerはGit writeをしない。Frontが試験済みrevision・PR差分・main配信設定・#41 APIの前提をread-only再確認し、現在の公開main revisionを戻し先として控える。確認2後にデータや画面の差が出た場合は受入への影響を確認し、未解消のままmergeしない。merge・PR承認・本番反映はItsuki。
4. **公開後**: Itsukiの明示承認によるmerge後、FrontがPages build成功と公開Homeが新しい版を配信していることをread-onlyで確認する。配信revision・index/script/styleと、確認2で見た同じデータ・同じ画面の一致を照合し、build成功だけで表示一致としない。管理画面の#42説明もread-only確認し、Worker deployは要求しない。Frontは時刻・revision・該当id・成否だけを追補し、本番本文をrepoへ保存しない。差が見つかった時だけItsukiへ返す。同じデータ・画面について2回目の本人確認や再保存は頼まない。

#41の1作品保存と新Homeへの実データ表示・実音の確認は、§6の確認2でmerge前に満たす。fixture画像とその試験は独立の証拠として維持する。保存・実データ表示・実機再生が未確認なら確認2の残件として止め、merge後へ先送りしない。merge後の配信確認はFrontの追補とし、承認済み結果のbytesを無断で変えない。

## 9. rollbackと停止

- merge前の問題はmergeせず、影響するfocused test・画面・承認を修理する。stale digest、Figma未整合、canonical base差分、未受入の再生例外はFrontへ返す。
- merge後の不具合はFrontが#42差分だけのrevertを準備し、Itsukiの明示承認でmergeする。Pagesが旧Home・旧外枠と**同じrevertに含めたadmin説明・設計書**を配信したことを確認する。#41のhelper・3key・保存・Workerは戻さず、新データも消さない。データmigrationやD1全体の復元は不要。
- rollbackでHomeがhero帯へ戻るため、「共有時の画像」が再びHomeの帯を兼ねる期間が生じる。#41のラベルは保持し、戻した管理説明に「#42を戻している間はHomeの帯にも使います」と明示して同じ復旧単位へ含める。labelだけをHome Heroへ勝手に戻さない。Frontはこの一時的な説明と旧Homeの実態を照合する。復旧のために#42のrevert以外の文言追補が必要なら、その具体的差分をOwnerに示して同時に承認する。
- source上の旧Homeには画像帯があり、#41 APIと旧公開画面はすでに互換である。rollback後のhero値は現在のsite.heroImageのままで、過去snapshotの値へ戻さない。確認2前にItsukiが本番へ通常保存した種別・映像・顔の作品の値は、そのまま保持する。mergeを見送る時もrollback時も試験値として消したり旧値へ戻したりせず、再公開後に再び使える。#41の旧公開画面はこの3項目を使わないため、保存を戻す必要はない。
- 許可外write/network/secret、データshape/保存/Cloudflare変更の必要、手順外cycle故障はBLOCKED。局所的Owner判断は推奨案を添えてFrontへ。承認された計画から価値判断が変わる修理を黙って進めない。

## 10. 今回の停止位置

3候補・設計書提案版・Figma整合案は未承認。stateはRequirements承認待ち。Code Generation Result、Build/Test Result、approval record、昇格、コード、試験、画面撮影は今回行わない。最新外部仕様と実音はGapであり、確認2のOwner判断と区別して保持する。
