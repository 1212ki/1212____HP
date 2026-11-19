# Code Generation Plan — Musicと5項目ナビ（Issue #44）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-18_issue-44_music`
- Execution target: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-44-music`
- Branch: `feature/44-music` / base `080325887576655f27461cb15f28a3c590a292ee`
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 1. 到達点と責任

Musicで全作品と映像を選べる状態を作り、全公開ページのナビ・Home入口・旧URLを揃える。実装入力はRequirements R44-01〜15とS44-01〜06・L、Approved canonical、Figma整合案F44-01〜06。原典はauditに固定する。1つの実装単位`aidlc-integration`として8段で作り、内部工程ごとに別Workerを起動しない。

確認1でItsukiがgate 1〜3と本計画に含まれる設計提案版・Figma整合案を承認し、Frontが承認記録を作るまで実装しない。後続Workerは昇格・コード・試験・撮影scriptを持ち、Frontが画像撮影・目視・本番公開データの画面確認・独立review手配を持つ。結果を確認2（gate 4・5）へ出す。Owner確認・review・Front completionは別であり、Workerは自己承認・再委任・Git writeをしない。

## 2. 採用する設計

### ページとデータ

新規`music/index.html`は`body.site-music`と`#music-content`。music見出し、ページ内移動、release、demo、video、footerの順。`id=release / demo / video`をsectionに付ける。sectionは中身がなければDOMごと出さず、ページ内移動も外す。video内の小区分はmusic video / live movie / demo、空ならその見出しも外す。demo説明は「宅録のデモ。ライブ会場とBandcampで販売しています。」。作品はカード全体をリンクにせず、名前・種別/日付・説明・操作を分ける。

`site-content.js`のbootでHome分岐に続けてMusic専用分岐を置き、Musicでは1回の公開GETとMusic renderer、既存`renderSite`によるfooterだけを行う。他ページのgeneral boot・rendererは変更しない。既存`renderDiscography / renderYouTube`は呼出先の互換性と差分縮小のためこのIssueでは残すが、旧2HTMLはそれを読み込まない。専用rendererを旧2rendererの組合せで作る案は、並び・操作・状態・常時iframeが契約に合わないため採らない。

作品は`MusicData.sortReleasesByDate`を区分ごとに使う。既存helperは変更せず、同日元順・不正/空末尾・非破壊を継承する。Homeの顔選択や最新2件の規則も変更しない。`homeReleaseMeta`をそのまま共用し、タイトルの解析や種別の補完をしない。説明は既存の`<br>`互換→改行正規化→HTML escape→表示改行の順にし、すべての曲目を表示する。digitalの説明も空でなければ出す。

映像は日付を追加せず、3配列の登録順を維持する。作品の`playbackVideoId`はmusicVideos→liveMovies→demosの順で`id`照合し、有効なyoutubeIdだけを使う。選択済み映像もvideo一覧から除かない。公開URL/画像は既存`safeHomeUrl / resolveImageSrc / withCacheBust`を再利用し、http(s)以外の外部操作は出さない。相対画像をMusicの深さから解決し、version queryを保持する。API envelope/body両対応とendpointは既存`fetchSiteData`のまま。

チャンネルの通常入口は`youtube.channelUrl`。有効なら映像が0でもmusic見出し側へ残す。全体0/失敗のBandcamp・YouTubeは、取得済みの安全なSiteリンクとchannelUrlを優先し、未取得/未登録では既存Home/READMEの静的公開fallback定数を共有する。新たに本番JSONからURLを写さない。個々の作品でリンク・映像がない時に、その作品固有の行き先を捏造しない。Music自身のnoscriptにも「音源と映像はこちらからご覧いただけます。」と既存の静的Bandcamp/YouTubeリンクを置き、JS無効のまま旧URL→Musicへ進んでも外部で聴く入口が残るようにする。

### 6状態・読込・hash・再試行

RequirementsのS44表を試験の期待値とする。初期HTMLは見出し・淡いskeleton・`role=status`の「読み込み中」・`aria-busy=true`を持つ。成功時はskeletonを除く。Musicのデータrootがnull/配列、明示された作品/映像配列が非配列、要素がオブジェクトでない等は不正入力としてS44-05。旧データでcollection/keyが欠落している場合は空として扱う。画像・リンク・再生参照の欠落/不正は個別fallbackとし、ほかの全作品・全映像を消さない。不正youtubeIdの映像もタイトルと淡い「video」を残し、押せる再生を作らずチャンネルへ進める。

成功空は`data-state=empty`、通信/構造/描画失敗は`error`。どちらも「音源の情報を読み込めませんでした。」と再読込、Bandcamp/YouTubeを1組だけ表示する。retry開始時にplayerを破棄し、ボタン無効・pendingで同時GETを1つにする。request serialで古い応答を捨てる。rootへのlistenerは1回のdelegationで、再描画で増殖させない。pagehideでserialを進めpendingを解き、iframeを止める。bfcache復帰時、離脱中に中断した要求があればpageshow.persistedで読み直し、操作不能のloadingを残さない。Homeの既存処理を変更しない。

async描画後とhashchangeに、許可するhash `#release / #demo / #video`だけを処理する。存在するsectionへscroll、sticky headerを避けるscroll-marginを設定する。初回は表示がreadyになった後に実行する。空sectionや不明hashは`history.replaceState`でhashを除いてMusic上部へscrollし、空の見出しは作らない。Music自身のqueryは解釈しない。既存script.js末尾の全hash-anchor用preventDefault/smooth-scrollは、Music内のanchorを対象から外す。fetchがDOMContentLoaded前後のどちらで解決しても標準hash遷移とhashchangeが動くよう、実scriptとの統合試験で縛る。page内移動は通常のanchor、hash除去はreplaceで履歴を増やさない。選択中playerとhash移動は独立で、再描画時だけ必ず停止する。

### 「聴く」と映像の共有player

`assets/js/home-player.js`を拡張する。別々にiframe制御を複製する案、新dependencyやYouTube API SDKを入れる案は不要。既存`window.HomePlayer.open(container, button, videoId, title)`と`close(options)`は完全互換で、Homeのplayer移動・class・data-testid・focusを保つ。

同じファイルで`window.MusicPlayer.open({host, trigger, closeButton, youtubeId, title, mode})`と`close(options)`を公開する。modeは`release | video`。共通のiframe生成/破棄と単一active sessionを持ち、sessionに復元処理を保持する。別adapterからのopenでも旧sessionを`restoreFocus:false`で先に閉じる。Home固有のDOM移動/classはHome adapterだけに置く。

- releaseはarticle内に専用hostを持ち、作品の情報・操作の直下へ表示する。「聴く」button自身が「閉じる」になり、secondaryへ切り替わる。閉じれば元のlabel/class/ariaを復元し、明示closeだけ起点へfocus。別作品へ切替時に旧起点へfocusを跳ばさない。
- videoはサムネイルbuttonとplayer host、別の「閉じる」buttonを持つ。再生時はthumbnailを隠し同じ場所にplayer、下に閉じる。閉じるとthumbnailを復元しそこへfocus。非表示buttonのまま閉じる操作を失わない。
- 有効なclickの同期処理中にiframeを生成する。srcは既存と同じembed形式、`autoplay=1&playsinline=1&controls=1&rel=0`、muteなし、既存allow/allowfullscreen/referrerpolicyを継承する。閉じる時はabout:blank→remove。初期表示はiframe 0、開いた時1、切替後も1、閉じる/離脱/再描画後0。
- 同じ映像の作品起点→video起点でも同一sessionとは扱わず、旧iframeを破棄して新起点で作り直す。再生位置の継承はしない。Q42-01のiPhone追加tapは受入済みの同じ端末制約として記録し、新しいOwner質問にしない。

DOM hookは作品・映像の区分と元配列のordinalから生成し、HTMLへ生のidやタイトルを埋め込まない。例は`music-release-digital-0 / music-video-musicVideos-0`。host idとaria-controlsを一致させ、イベント処理は保持したmapから解決する。data-testidはmusic-listen / music-close / music-video-play / music-retry等の役割を固定し、複数要素はarticle内で特定する。Homeの既存testidは変えない。

### 旧URLの方式比較と固定

| 方式 | 評価 |
|---|---|
| server 301/308 | GitHub Pagesの前提では使えない。 |
| meta refresh | JS無効でも自動移動できるが、履歴・自動移動がブラウザ依存になり、戻る操作と静的fallbackの検査が複雑になる。採らない。 |
| `location.replace`＋常時リンク | 行き先を固定でき、履歴を置き換え、JS失敗・無効でも明示リンクが残る。採用。 |

旧2HTMLは5項目の共通header/footerを残し、mainを短い案内と常時リンクに替える。discographyは「作品はMusicにまとめました。」＋「Musicの作品へ →」（`../music/#release`）、youtubeは「映像はMusicにまとめました。」＋「Musicの映像へ →」（`../music/#video`）。このリンクはnoscript内だけに置かない。外部URLを受け付けず、query/旧hashはすべて破棄する。意図しない追跡値・旧要素idを新ページに持ち込まないためである。

新規`assets/js/music-redirect.js`をdeferで読む。`document.body.dataset.musicDestination`の`release | video`だけを認め、`new URL('../music/#'+destination, window.location.href)`から作った固定行き先に`window.location.replace`。それ以外の値で外部へ飛ばない。script load失敗でもHTMLリンクで成立する。旧ページではAPI GETもsite-contentも不要、script.jsによるMenu/ロゴは維持する。footerは既存の静的fallbackを残し、新たなfooter取得通信をしない。

旧HTMLの`<link rel=canonical href="https://1212hp.com/music/">`、`<meta name=robots content="noindex, follow">`、titleもMusicへの案内にする。Musicのcanonicalは同じfragmentなしURL。これはrepoの公開origin設定に基づく静的値であり、取得した本番データの複写ではない。旧ページはHTTP 200のままであり、301や検索engineの移転処理成功とは主張しない。戻る時に旧ページへ戻る履歴を作らず、Musicから旧URLへ逆誘導しない。JSなしは1回のリンク操作を要するが行き止まりにはならない。

### 外枠・見た目とFigmaの整合

ナビは全10HTMLを5項目へ変更する。hrefはHome=`/`相当、Live、Music、Profile、Contact。rootのHomeは既存の空href、1階層は`../`、2階層は`../../`を用いて新5項目の同じ絶対pathへ解決する。Musicは常に`music/`、`../music/`または`../../music/`。`script.js`のcurrent-path正規化を最小拡張してTicket系→Live、旧2URL→Music、Music→Music、Live詳細→Liveとする。navに`aria-current=page`も付け、複数の現在地を作らない。既存Menuとlogoのblockは保持する。Music内anchorだけは既存のsmooth-scroll listener登録から除外し、ほかのページのanchor動作は保持する。

DESIGN_RULES/tokensは無変更。F44-01〜06の推奨採用を前提に、nav gap32、desktop区分間64/mobile48、textと操作上8。980幅のdesktop本文（1440で左右230）、390で左右16・本文358。上paddingはdesktop64/mobile32、区分内見出しから一覧24、作品一覧gap32/mobile24、映像一覧gap24/mobile16を使う。中間幅では本文を`min(980px, 100% - 32px)`、820px以下でmobileへ切り替え、作品・映像gridは折返し可能とする。

`.site-release-card`にMusic専用modifierを組み合わせ、desktop220幅/画像220角・縦、mobileは画像120角＋gap16＋残222幅の文字。playerはarticleの最後で、desktop220幅、mobileは2列を跨ぐ358幅。16:9、host/iframe幅100%。title20/30、meta/説明14/22、video区分は既存`.home-caption`を再利用、videoタイトル14/22。`.site-section-title`はmusicに使い、ページ内移動との間16となるMusic scopeのmarginだけ調整する。release/demo/videoのh2は20/30で赤線なし。

配信先はsite-chip、購入先はsite-button--secondary、聴くはsite-button--play、channelはsite-text-link。角丸12・細い罫線・淡い面は既存部品を使う。本文にはprimary操作・赤いhover/選択/focus/scrollbar/背景を設けない。body.site-musicの装飾背景を切り、focus/selectionをモノクロ化する。`.site-music [hidden]`はdisplay:none!importantで確実に隠す。共通ロゴの赤いi・押下演出とHomeのprimaryは維持する。

作品なし画像は通常画像枠と同寸法の淡い面中央に松本一樹だけを表示する（Home fallbackのtitle+artistは流用しない）。動画thumbnailは有効youtubeIdから既存YouTube画像URL形式を組み立て、全カテゴリに適用し、画像errorは淡い「video」。タイトル・操作は画像失敗でも残す。すべての長文にmin-width:0/overflow-wrapを適用し、作品/説明の高さ固定・line-clampをしない。Figma差分の詳細と理由は`figma-fix-requests.md`、Frontの整合記録はauditへ残す。

## 3. 変更ファイルと設計書の昇格

| path | 変更範囲 |
|---|---|
| 新規`music/index.html` | Music本文・初期skeleton・noscriptの外部入口・5ナビ・canonical。script順はsite-config→music-data→home-player→site-content→script。Live helperは不要。 |
| `index.html` | ナビとmusic →のhref、共有assetのcache queryだけ。 |
| `live/index.html / live/detail/index.html / ticket/index.html / ticket/complete/index.html / profile/index.html / contact/index.html` | ナビ・共有asset queryだけ。mainと固有scriptをbase bytesで保護する。 |
| `discography/index.html / youtube/index.html` | 5ナビ・旧URL案内main・canonical/robots・redirect script。site-content読込を外す。 |
| `assets/js/site-content.js` | Music専用boot/render/state/retry/hash、Homeとのmeta/URL処理共用。旧rendererと他本文の処理は保持。 |
| `assets/js/home-player.js` | 単一sessionの内部共用とMusic adapter追加。Home公開APIと動作は完全互換。 |
| 新規`assets/js/music-redirect.js` | 旧URLの固定replaceのみ。 |
| `assets/js/script.js` | ナビ現在地mapping/aria、Music内hash-anchorを旧smooth-scroll対象から除外。Menu/ロゴblockは無変更。 |
| `assets/css/style.css` | Music scopeと既存部品modifierを追補。既存共通とHome/旧本文のCSS bytesは保持。 |
| `admin/README.md` | §7の最小説明修正のみ。admin/index.html、app.js、style.cssは無変更。 |
| 新規`test/music-rendering.test.mjs / test/music-player.test.mjs / test/music-redirect.test.mjs / test/fixtures/music-states.json` | 下のT44と架空fixture。Node標準機能だけで実source/実HTMLを実行する。 |
| `test/site-shell.test.mjs` | 10HTML/5ナビ、深さ・script差異・現在地・legacy案内・管理説明へ更新。Homeと旧CSSの既存保護を保持。 |
| `test/public-music-data-compatibility.test.mjs` | 実際に廃止した旧2ページの本文renderer期待だけを旧URL互換へ移す。Live/Profile/Contact/詳細の元の互換検査とHomeの新3key適用を保持。 |
| `aidlc-docs/construction/aidlc-integration/verification/capture-music.py`（新規） | #42のcaptureを雛形にしたFront用撮影script。script/fixtureの作成は承認後。 |
| `docs/specs/current/public-site-ui.md / live-operations-admin-ui.md / README.md` | 下の提案版をexact bytesで昇格。 |

共有CSS/script/site-content/home-playerのqueryは`20261118-44`に揃え、既存の固有script queryは維持する。全consumerの実在確認と読込順を試験する。旧2HTMLの削除はしない。`music-data.js / DESIGN_RULES.md / tokens / adminの機能 / cloudflare/ / data/`は無変更。root READMEの古い構成木は今回は対象外の履歴案内として残し、公開リンクの移行完了とは混同しない。

### exact bytesの提案版

提案版は昇格後の最終形（Status: Approved、Owner approvalは#44 gate 3参照）。配置時点では未承認候補であり、Approvedという文字列だけで昇格しない。履歴表の`00cdea5`や#42手順は保ち、#44の実装入力・Music/ナビ/旧URL/管理対応・まとめ出しを追記する。#44の完了を先に主張しない。

| 提案版（aidlc-docs/から） | 昇格先 | 提案版SHA-256 | 昇格前の元版SHA-256 |
|---|---|---|---|
| `construction/aidlc-integration/canonical-proposals/public-site-ui.md` | `docs/specs/current/public-site-ui.md` | `4ab8696607364df31178a78ebe824e50a69c4d71315a7c4343f7ac8fa486ea44` | `62f98fa71d78ba008b25219e57d574d58641ffdf8e8d3e69307c752ffafa9d14` |
| `construction/aidlc-integration/canonical-proposals/live-operations-admin-ui.md` | `docs/specs/current/live-operations-admin-ui.md` | `f031cc243749714ecdbead55ed9e79dd6f33e73c9fd851390346fdcc681c4cb1` | `3d2bbcb5556b3cec861812836cc7f7c7cd81b0702fc80f6e5dbd9f8f3ac953a8` |
| `construction/aidlc-integration/canonical-proposals/README.md` | `docs/specs/current/README.md` | `8ecd9e3c00ad1025acf8683417780f7071d8d9d8be29e0bd9a98044c890dea0a` | `542d49ceb65c0aa5ba33ece3e9508d378cd009e1f7a5d9e40008083647467062` |

手順：確認1の3承認digestと提案版hashを照合→現在の昇格先が表の元版hashであることを確認→対応する提案版のbytesをそのまま昇格先へcopy→提案版と昇格先のSHA-256一致と差分範囲を確認→実装開始。文字の置換、日付追補、フォーマット変更を昇格時に加えない。#43/#45等で昇格先が変化していたら上書きせず停止し、Frontへbase差分を返す。候補の修理と新hash承認で解消してから再開する。Figma整合で別の意味・採用値が生じた時も同様。

Figma整合案もgate 3の対象に含める：`aidlc-docs/construction/aidlc-integration/figma-fix-requests.md` SHA-256 `24c3d070d857f9f8d6e8b895dbea4373d40f389a316736b37ca6f67ad93996e0`。

## 4. 実装の8段とfocused test

作業前にNode20を選ぶ。以下のcommandはexecution targetから実行し、RED/GREENのexitと対象ACをverification logへ残す。新規試験名は提案で、承認後に作る。承認済みplanには進捗checkboxを足さず、state/resultへ記録する。

```bash
export PATH=/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH
node --version
```

| 段 | 作業とRED→GREEN / focused command |
|---|---|
| 1. 入力と昇格 | cycle/承認/提案版/元版hashを照合し、3canonicalを同じbytesで昇格。既存`node --test test/music-data.test.mjs test/home-player.test.mjs test/home-rendering.test.mjs`をcharacterizationとして実行（不要なREDは作らない）。fixtureの架空4作品/5映像とvariantを用意。 |
| 2. Musicの通常表示 | T44-DATAを先にRED。実HTML hooks/読込、全件・区分・順序・同日/不正/空日付・非破壊・title/meta/説明・link/channel・escape・相対画像を縛り、専用boot/renderでGREEN。`node --test test/music-rendering.test.mjs test/music-data.test.mjs`。 |
| 3. 再生の共有 | T44-PLAYを先にRED。Music release/video adapterと同一sessionを実装。起点切替、同じ映像2箇所、close/pagehide/render、無効参照、Home adapterとの相互排他までGREEN。`node --test test/music-player.test.mjs test/home-player.test.mjs test/music-rendering.test.mjs test/home-rendering.test.mjs`。 |
| 4. 状態と復帰 | T44-STATEを先にRED。S44全件・pending/empty/error・retry/race/bfcache・画像error・empty hash/初回anchorを実装しGREEN。`node --test test/music-rendering.test.mjs test/music-player.test.mjs`。Musicの挙動が揃う区切りとして§5の全試験1回目。 |
| 5. 旧URLの到達 | T44-LEGACYを先にRED。実旧HTMLを誘導へ替えscript有/無、index.html、query/hash破棄、noindex/canonical、static linkの解決先・Musicのsection・空区分fallbackをGREEN。`node --test test/music-redirect.test.mjs test/public-music-data-compatibility.test.mjs`。互換試験の旧本文期待をこの新契約へ移す。 |
| 6. ナビ・見た目・管理説明 | T44-SHELL/STYLEを先にRED。全10HTMLのナビ・Home入口・current mapping、Music scope、管理READMEを実装しGREEN。`node --test test/site-shell.test.mjs test/music-rendering.test.mjs test/public-ticket-routing.test.mjs test/admin-image-form.test.mjs`。既存Home・他本文/Workerの保護も確認。§5の全試験2回目。 |
| 7. 画面確認の材料と実行 | Workerが§6のcapture scriptとfixture variantを完成させ、構文を検査してFrontへ渡す。Frontが撮影・metrics・全画像目視、本番データ画面確認を行う。修理は影響focused testと該当画像を再確認し、全体回帰へ波及する新変更だけ全試験を追加する。 |
| 8. 結果と独立review | 実ファイル・昇格hash・RED/GREEN・全試験・AC別証拠・未確認を結果に固定しFrontへ返す。Frontが独立reviewを1回手配し、修理と再検証を結果へ反映して確認2へ提示する。Owner承認を代行しない。 |

段4時点ではshell/互換試験の旧契約をまだ保つ。段5・6で意図した期待だけ更新し、全試験を通すために未移行の保護を消さない。段4で先行shared変更が既存試験を壊したら、その時点で原因を修理してから次へ進む。

## 5. 決定論的試験と全試験

fixtureは既存`home-states.json`と同じenvelope形式を用い、dataにdigital2/demo2、musicVideos2/liveMovies2/demos1、releaseType1/playbackVideoId1、全作品linkありを持つ。日付・タイトル・URL/idは架空。タイトルは24文字以上・ASCII引用符・`/`・`<>&`を含め、説明空/2行/4行、相対画像、種別欠落/空/ありを再現する。シナリオはbase / release-playing / no-selection / video-playing / empty-demo / empty-live-movie / empty-video / all-empty / error / loading / no-image / broken-image / long-title。試験には同日・不正/空日付・dangling参照・不正URL/youtubeId・missing keyも加える。

| 群 | 必須assert / AC |
|---|---|
| T44-DATA | 実source VMと実HTMLから4作品/5映像・channel全件、helper sort呼出と順序・非破壊、各説明改行、引用符/HTML escape、空metadata、日付の未加工表示、リンクtarget/rel/安全性・画像解決。PS-M-01/02。 |
| T44-PLAY | click直後のunmuted autoplay要求とallow属性、初期iframe0→open1→別起点1→close0、別作品・別映像・同youtubeIdの別起点、Home↔Music adapter、close focus・hidden/aria/class復元、pagehide・render停止、無効入力でiframe0。実音はこの試験でPASSにしない。 |
| T44-STATE | S44-01〜06・L、全体0とHTTP/JSON/network/不正構造の状態差、1知らせ＋2fallback＋retry、単一区分空/映像だけ/作品だけ、channel単独、画像error、再読込二重要求抑止・遅応答・pagehide/pageshow・listener増殖なし、初回hashがready後に実sectionへ移動し空hashはreplace。script.js同時読込でDOMContentLoadedの前/後の両方の描画順でもhash遷移が妨げられない。 |
| T44-LEGACY | 実旧HTMLのscriptを読みVMでreplace呼出を検査。両pathとindex.html、queryあり/なし、旧hashあり/なし、不明hash・外部URL風queryでも固定origin/path/hash、replace1回、assign/href代入なし。JS未実行でも常時anchorが存在し、Music実HTML/rendererに対応sectionまたは上部fallbackがあり、Musicのnoscriptに外部の聴く入口2つが残る。meta refreshなし、robotsとcanonical、旧ページからfetchなし。 |
| T44-SHELL | 全10HTMLで5label/順序/URL解決、PC/Menu同じnav、5リンクそれぞれの閉動作・Escape/resize/focus、Ticket系Live/旧URL Musicのcurrent、logo block/animation保持、固有script順と存在、共有query、Homeのmusic →。 |
| T44-STYLE/COMPAT | baseのCSS全bytesを保持してMusic scopeを追補。Home画像/文字/動作、対象外6mainのbase bytes、Ticket/Contact設定と送信、admin6タブ・modal/保存不変、README対応。Workerに公開Music path依存追加なし。PS-M-04、AC44-COMPAT/ADMIN。 |

既存`test/site-shell.test.mjs`の基準commitは#42以前の`c266418...`で、6ナビ・9ページ・非Home main同一・script順を期待している。#44の比較元は`080325887576655f27461cb15f28a3c590a292ee`へ更新し、新規Music/旧2誘導を明示例外にする。非対象6mainとHomeの意図したhref以外、既存ロゴblockとCSSの不変は引き続き検査する。旧2pageのscript省略とMusicの新規読込を期待表へ明記する。互換testの旧2rendererのhookがなくなる点は新T44-LEGACYへ移し、他pageの保護は残す。

全試験は段4・段6後に実施。baselineはFront着手前報告のサイト377 pass / 0 fail、Worker347 pass / 0 failで、実装後の件数を固定しない。command/exit/pass/failを記録する。

```bash
node --test test/
npm --prefix cloudflare/worker test
node --check assets/js/site-content.js
node --check assets/js/home-player.js
node --check assets/js/music-redirect.js
node --check assets/js/script.js
scripts/aidlc-verify.sh --local
scripts/aidlc-cycle.sh status
git diff --check
git status --short
```

Music-redirectがまだない段4はそのcheckのみ段5以降に実行する。静的サイトのため別bundle buildはない。Node24では`node --test test/`が動かないため指定Node20を用いる。local verifyが使うtempとcloseの一時pathは後続Packetで明示許可を得る。このPacketはそのtempを許可しないため再verifyを行わず、Front済PASSとstatus実測を区別する。network source verifyはこのIssueのWorkerでは行わない。

## 6. Frontの画面確認

今回Workerは`ui_route=none`。後続Frontが撮影前に`ui_route=headless_acceptance:PS-M-04,PS-COM-01,PS-COM-02,AC44-COMPAT`を宣言する。挙動の判定は§5のNodeで行い、画像は配置・折返し・状態の外観を証明する。

### fixture撮影scriptの契約

雛形は`docs/records/aidlc-cycles/2026-11-17_issue-42_home/_trace/aidlc-docs/construction/aidlc-integration/verification/capture-home.py`。新規`verification/capture-music.py`は`--serve`（既存同様localhostのみ）と既存Chromiumを指定する`--chromium`を持つ。Frontはexecution targetから次を実行する。インストールは不要、Workerはbindしない。

```bash
/usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-music.py --serve
```

Pythonは`-I`なし、既存Playwright 1.58.0。clockは`page.clock.install(time=1794916800)`のように秒で固定する。fixture GETは`**/api/public/site-data`にfulfill、YouTube iframe/thumbnailはローカル生成stubでfulfillし、その他localhost以外のrequestはabortする。本番API・YouTubeへ実通信しない。routeは再生・画像error・fetch pending/failureをscenarioごとに制御する。既存local画像を使い、文字・データは架空。fontは既存の同版local cacheが使えるなら読み、外部遮断のfallbackならfont familyとその限界をmetricsに記す。fallback fontのpixel一致を合格にしない。

device_scale_factor=1、reduced_motion=reduce、1440×900 / 390×844。ready/skeletonの状態・document.fonts.ready・画像load完了を待つ。各撮影でconsole/pageerror/script失敗、横overflow、各section/画像/title/meta/操作/player/ナビのbox、computed色/文字/余白、文字nodeのRange.getClientRectsを行topごとに数えた実行数を保存する。高さ÷line-heightや要素の高さを行数に使わない。

| シナリオ | screenshots/内の名前と確認内容 |
|---|---|
| base | `music-1440-first.png / music-1440-full.png / music-390-first.png / music-390-full.png`。全3区分、4作品/5映像、channel、文字・操作、左右余白。 |
| S44-01/02/03 | `music-release-playing-<width>.png / music-no-selection-<width>.png / music-video-playing-<width>.png`。作品直下/thumbnail位置のplayerと閉じる、no-selectionに聴くなし。 |
| S44-04 | `music-empty-demo-<width>.png / music-empty-live-movie-<width>.png / music-empty-video-<width>.png`。空の見出し/移動なし、channel残存。 |
| S44-05/L | `music-all-empty-<width>.png / music-error-<width>.png / music-loading-<width>.png`。知らせ1組・fallback・retry、skeletonとbusy。 |
| S44-06/長文 | `music-no-image-<width>.png / music-broken-image-<width>.png / music-long-title-<width>.png`。artist名のみの淡い面、24文字以上/引用符/slash、2行/4行曲目が欠けずに折返す。 |
| Menu | Musicで`menu-music-390-open.png / menu-music-390-closed.png`、Homeで`menu-home-390-open.png`。5行と現在地の色、Contactまで到達、短い667高でもMenu内scrollで到達できること。 |
| 中間幅 | `music-821.png / music-1024.png`。ナビとカード/操作の折返し、横overflowなし。 |
| 旧2URL | redirect完了後の`legacy-discography-<width>.png / legacy-youtube-<width>.png`で該当区分に到達。JS無効contextでも旧HTMLの案内とリンクを撮る`legacy-<route>-nojs-<width>.png`。HTML遷移先と同じURLへの到達を確認。 |
| ほか7公開ページ | Home・Live・Live詳細・Ticket・Ticket完了・Profile・Contactを2幅で`smoke-<route>-<width>.png`。5ナビ・本文smoke・script/console異常なし。Ticket/Contactは実送信しない。Homeの再生もstubで開閉する。 |

`<width>`は1440または390。保存先は`aidlc-docs/construction/aidlc-integration/verification/screenshots/`、metricsは同verificationの`capture-music-metrics.json`、実行logは`capture-front.log`。

合否：1440で本文980/画像220、390で本文358/画像120・文字領域222、画像正方形・player16:9・videoは310×約174または358×約201、5navとMenu、一覧全件、隠す条件、長文と説明の全内容、横scrollなし、意図しない赤なし。値の許容は罫線/丸め±2px。F44-05の間隔差とfixtureの文量による全高差は採用値を基準にする。Frontが全撮影画像を目視し、Musicの数値snapshotおよび#42のHome/部品/Menu renderと照合する。Music renderのpixel比較済みとは書かない。font不一致が文字の受入に影響する時は未確認として残し、Frontの同font環境または本人の明示受入で解消する。

startup failureもinitial attempt。同route/同ACの具体的修正仮説がある時だけ1回corrective retryし、失敗はAC単位の`visual_acceptance_pending`と残条件・必要なFront actionを返す。GUI/OS撮影への自動fallback chainを作らない。

### 本番公開データを読むbranchの確認

Frontが確認2の前に、fixture撮影と別のscratch配信用copyへ公開HTML/assetsだけを置く。repo全体・admin・token・private fileを配信しない。配信用site-configの変更はcopy内だけ。PCの`http://localhost:8888/`は公開APIの許可リストにあるoriginから直接読み、スマホURLは同公開データのscratch上の写しを読む。tunnelのoriginをAPIが受け入れると仮定しない。取得手段と配信はFront/Itsukiの許可範囲で行い、このWorkerは外部networkを使わない。

Frontが4作品/5映像・選択映像1・種別1・引用符/slash/説明改行・相対画像・全リンク/channel・同じ映像2起点の切替と閉じる・Home再生・旧URL・ナビをread-onlyで確認する。実音は実ブラウザで確認しstubと分ける。受入済みQ42-01の端末制約を記録する。保存済みデータの入れ直しは頼まない。記録は時刻・tested revision・件数・環境・成否と制約だけで、本番のタイトル・release日付・URL・映像idはrepo/承認promptへ書かない。Itsukiに渡す手元URLはscratchの提示材料に留める。

Frontの本番データ画面確認は必須、確認2でのItsukiの閲覧は任意。手元のPC/スマホURLは毎回提示する。Itsukiが必ず公開全ページを見るのはまとめ出しの直前1回。見たい画面を確認2で見ると、cycle close後の修正が新Issueになる手間を減らせる、とFrontが伝える。

## 7. 管理説明・入口の棚卸し・並行Issue

入口の全件は`construction/aidlc-integration/link-inventory.md`。公開HTMLで実際に旧pathを指すのは9navの18link＋Homeのmusic →。Homeカードは非リンク、Ticket完了本文/footer/admin内に旧pathへのリンクはない。sitemap/robotsの独立公開ファイルはない。WorkerのOGはLive詳細専用でMusic旧path依存がなく無変更。検索で見つかるcurrent設計のpathは提案版で現行/履歴を分け、closed trace/旧計画は履歴のまま残す。

adminの実タブはSite / News / Live / YouTube / Disco / Profile。indexのYouTube/Discography見出し、Channel URL、appの「新規Discography」「Discography編集」は現在の管理機能名として正しいため変えない。公開Discography/YouTubeページを表すhrefや説明はこの2ファイルにはない。READMEだけを次のように最小修正する。

- 「Musicへの適用とTicket完了の案内は後続」から、公開Musicの作品再生は#44、Ticket完了案内は#43、作品編集はDisco・映像/Channel URLはYouTube、タブ統合は#47とする。
- 運用の「公開画面と同じカテゴリから編集対象を選ぶ」は、現在のタブと公開Musicの対応を示す文へ替える。未来のMusicタブへ誘導しない。
- #42単独公開と#41反映/復旧の見出しは履歴として保持し、#44/#43/#45はまとめ用branch→mainで公開、#44のmergeでは本番変更なし・Worker deploy不要と補足する。

独立reviewは最終のまとめ出し状態（公開5nav、管理6tab）で説明が働きと一致するかを検査する。公開途中の未配信状態を解決するためのadmin機能変更はしない。

#43/#45との共有面は各ページHTMLのheader/nav、style.css、site-content.js、site-shell.test.mjs、current/public-site-ui.mdとREADME。#44はHTML mainを6ページでbytes保護し、CSSはMusic scope、rendererはMusic分岐、試験は共通外枠の表に限定する。#43/#45は#44統合後のまとめ用branchを取り込んでから本文を編集する。後から統合する側が差分を解決し、完成した5nav/Music/旧URLを古い版へ戻さない。canonical衝突は章の意味を比較し、他Issueの承認済みbytesを無断で上書きしない。#43のTicket完了からのMusic入口は`/music/`を使い、#44では先行実装しない。

## 8. 結果ファイルと確認2

| 成果物 | path |
|---|---|
| Code Generation Result | `aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md` |
| Build/Test Result | `aidlc-docs/construction/build-and-test/build-and-test-summary.md` |
| 実行log/script/metrics | `aidlc-docs/construction/aidlc-integration/verification/` |
| 画像 | `aidlc-docs/construction/aidlc-integration/verification/screenshots/` |
| cycle summary | `aidlc-docs/cycle-summary.md` |

結果には実装path、昇格前後hash、RED→GREEN commandとexit、全試験のpass/fail、PS/AC別の証拠、Front撮影/本番データ画面確認、実音と端末制約、独立reviewの所見と修理を記す。未実施・未確認をPASSへ丸めない。Build/Test Resultとcycle-summaryは未解消blockingがない場合だけ`- **Blocking Findings**: None`のfield形式にする。

Frontが独立reviewを実装後1回手配し、設計/実装/試験/昇格/管理説明/公開・復旧をまとめて見る。確認2の前に結果bytesを固定し、本人Aをgate 4・5へ記録する。以後の説明追補で承認artifactを無断変更しない。5gateとFront completion条件が揃ってからcloseへ進む。このPacketでは結果・承認記録・closeを作らない。

## 9. まとめ用branchへの統合とrollback

Owner決定（2026-11-18）の例外としてPR baseは`feature/39-public-pages`、headは`feature/44-music`。元baseはmainと同一だったことをauditに保持する。formal close後に別途許可されたFrontが既存ai-feature-push/ai-pr-createを使い、試験済みrevision・scope・secret非混入・baseを確認する。PRには#44、AI-DLC archive、受入と検証、公開がまだ起きないことを記す。`Closes #44`と書いてもmain以外へのmergeでIssueは閉じず、ProjectはReviewのまま。merge/PR承認はItsukiの明示判断。

#44のmerge後はまとめ用branchの差分とcycle記録を確認し、#43/#45へ取り込みを渡す。本番API/Workerは不変でdeployはない。#44で本番配信確認を実行したことにしない。まとめ出し担当が#43/#45統合後に公開全ページの本人確認、mainへのPRとOwner merge、本番Pages確認、Issue/Project closeを行う。

| 戻す時点 | 復旧単位と確認 |
|---|---|
| #44がまとめ用branchに入った後、main公開前 | Frontが#44のmerge差分だけのrevertを準備し、Itsukiの明示承認でまとめ用branchへ適用。merge方式に応じて対象commitを特定し、無条件のmainline指定はしない。Music・5nav・旧URL誘導・Home入口・説明/canonicalを同じ単位で戻す。#43/#45が既に依存していれば本文の入口と共通試験の整合を確認し、必要な最小修理を具体差分としてOwnerへ示す。作業branchのresetやforce pushで戻さない。 |
| まとめ出しがmainへ入り、本番公開後 | Frontがmain上のまとめ出し差分のrevert PRを準備し、Itsuki承認でmerge。#43/#45も含む公開bundleの直前版へ戻すため、旧Discography/YouTube本文と6項目ナビ・Homeのdiscography入口が整合して戻る。公開説明/canonicalも同じ復旧単位。まとめ出し担当がPages buildと旧版配信・旧URL・Home・予約/Contactを確認する。#44だけを機械revertして新本文のMusicリンクを残さない。 |

どちらも#41のデータ/保存済み3項目/Worker、予約データ、Figma、unrelated変更は戻さない。データ移行・D1全体復元は不要。公開後に#44だけを戻す必要があれば、#43/#45との依存と6nav復旧の追加差分を別Issueで承認する。Ownerのmerge承認とcycle承認を取り違えない。

## 10. 停止条件と今回の返却点

許可外write/network/secret、手順外cycle故障、データ形・保存・Worker変更が不可欠ならBLOCKED。canonical元版hash不一致、Figma未整合、承認digest不一致は後続実装を止めFrontへ返す。価値判断が一部だけ残る場合は推奨案とowner_questionsを返し、作れる候補は完成させる。

今回は3つの未承認候補と設計提案版・整合案・棚卸し・audit/stateのみ。承認記録、canonical昇格、コード/テスト/公開ファイル、撮影script/fixtureの実装は行わない。Requirements承認待ちを保持する。render画像・font・実音・本番画面・独立review・Owner承認は今後の証拠であり、候補作成完了と分ける。
