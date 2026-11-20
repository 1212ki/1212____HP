# Requirements — Musicと5項目ナビ（Issue #44）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-18_issue-44_music`
- Base Commit: `080325887576655f27461cb15f28a3c590a292ee`
- Branch: `feature/44-music`
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 1. 目的と範囲

Homeで1曲聴いた人が、音源と映像を同じ場所で選べるようにする。新しい`/music/`にrelease・demo・videoをまとめ、公開ナビをHome / Live / Music / Profile / Contactの5項目にする。旧Discography・YouTubeの入口もMusicへつなぎ、既存の全作品・全映像・チャンネルへの到達性を保つ。

対象はMusic本文、既存9公開HTMLとMusicのヘッダー・ナビ、旧2URLの誘導、Homeの「music →」、対応する管理説明・設計書・試験。Live・Ticket・Profile・Contactの本文と各送信処理は、それぞれ#43・#45の範囲として保持する。作品ごとの詳細、配信サービス別ボタン、管理タブ統合（#47）、データの追加・変更・保存、Cloudflare Worker、hosting・認証の変更は対象外。

要件の正本は`docs/specs/current/public-site-ui.md`§2〜7と管理設計§5.3。Figmaは`30:220 / 30:335 / 30:446 / 30:489`、Menuは`39:850`、共通部品は`20:23`を使う。原典・読取範囲・SHA-256は`aidlc-docs/audit.md`。Figmaの作品や映像のサンプルは表示構造の見本であり、掲載情報として採用しない。

## 2. 満たすべき要件

| ID | 要件と理由 |
|---|---|
| R44-01 | Musicは`/music/`。release（`discography.digital`）、demo（`discography.demo`）、video（`youtube`の3配列）の順。ページ内移動は`#release / #demo / #video`。中身のある区分だけを見出しと移動に出す。 |
| R44-02 | 全作品を区分ごとに`MusicData.sortReleasesByDate`で新しい順にする。同日は元順、空・形の違う日付は末尾、保存配列は変更しない。作品を顔や最新だけに絞らない。Homeの`resolveFeaturedRelease / sortReleasesByDate / isReleaseDateFormat`の規則を保持し、別実装しない。 |
| R44-03 | 作品タイトルを登録どおりに表示する。`releaseType`と日付は別行で、空でない値を` ／ `で結ぶ（Homeと同じ）。タイトルに含まれる種別・引用符・`/`は解析・除去しない。説明は両作品区分で登録全文と改行を保持する。空の説明・種別は余分な空行や区切りを作らない。 |
| R44-04 | 有効な`playbackVideoId`が全映像の`id`に一致し、その`youtubeId`が11文字の許可文字列なら「聴く」。作品直下で有音autoplayを要求し、同じ操作位置の「閉じる」で停止する。Digital Releaseの有効な作品リンクは「配信先へ」、宅録Demoは「購入先へ」として別タブ。映像・リンクの両方がなければ操作を出さない。1作品の操作は最大2つ。 |
| R44-05 | video内はmusic video→live movie→demoの順、各配列の登録順を保ち、全映像を出す。映像に日付はなく、新しい順を推測しない。サムネイルのbuttonからその場で再生し、閉じればサムネイルへ戻る。`youtube.channelUrl`を「YouTubeチャンネル →」に使う。映像が0でも有効なチャンネル入口は残す。 |
| R44-06 | ページ内で動くiframeは最大1つ。別作品・別映像・同じ映像の別の表示場所を開けば、前のiframeを破棄して新しい場所で最初から再生する。再描画・再読込・pagehideでも止める。HomeのAPI・DOM・フォーカス・再生・停止を維持する。iPhoneの追加tapは#42で受入済みのQ42-01を引き継ぐ。 |
| R44-07 | `/discography/`→`/music/#release`、`/youtube/`→`/music/#video`。`index.html`付きも同じ。JavaScript有効時は`location.replace`、無効・失敗時は常時表示の「Musicの作品へ →」「Musicの映像へ →」から進める。queryと旧hashは引き継がず、行き先を固定する。空の行き先ならMusic上部へ戻し、他区分・外部入口が使える状態を保つ。Music自身もJS無効時にBandcamp・YouTubeの静的入口を残す。 |
| R44-08 | 全10公開HTMLのナビはHome / Live / Music / Profile / Contactの順、解決後のpathは`/ /live/ /music/ /profile/ /contact/`。1440pxと390pxのMenuで一致させ、階層ごとに相対hrefを指定する。Ticket・Ticket完了はLiveを現在地にする。旧2URLはMusicを現在地にする。Menu/閉じる、Escape・選択・resize・フォーカスとロゴ演出を維持する。 |
| R44-09 | Homeの「music →」だけを`music/`へ付け替える。Homeの作品カードは現在の非リンク表示のまま。作品2件・顔・各外部リンク・実音と停止、他ページ本文・読込scriptの固有機能を保つ。Ticket完了に新しい「当日までに聴く」は追加しない（#43）。 |
| R44-10 | #42の`.site-button / .site-chip / .site-text-link / .site-section-title / .site-release-card`を再利用し、Musicに必要な寸法・文字の差だけをscope付きで適用する。色・書体・余白の正本とtokensは変更しない。Music本文の赤は見出しの線だけで、全作品を同格に扱う。ロゴの赤いi・押した時の演出は承認済み共通例外を保持する。 |
| R44-11 | §3の6状態と読み込み中を独立に出し分ける。空と取得失敗を内部では区別し、全体0と失敗にはマスタと同じ知らせ・再読込・Bandcamp・YouTubeを出す。再読込は同じ公開GET、通信中は二重要求を防ぎ、遅れた応答と離脱後の応答で現在表示を上書きしない。 |
| R44-12 | 公開Musicと管理画面のYouTube・Discoタブが併存する時の説明を揃える。`admin/README.md`の「Musicは後続」「公開と同じカテゴリ」の説明を最小修正し、作品はDisco、映像とChannel URLはYouTube、タブ統合は#47とする。`admin/index.html / app.js`の実タブ・見出し・modal・保存は維持する。 |
| R44-13 | 文字はHTMLとして実行せず、リンクは安全なhttp(s)、画像は既存の相対path解決とversion queryを維持する。新しいdependencyを追加せずNode VM/実HTMLによる決定論的試験で挙動を縛る。表示名付きbutton、見出し階層、aria-expanded/controls、focus-visible、読み込み通知を持つ。 |
| R44-14 | Frontが幅1440px・390pxと主要状態・Menu・他ページ外枠をfixtureで撮影する。別に確認2前にbranchの画面を本番公開データでPC・スマホから確認する。公開APIは許可リストのオリジンだけに応える。fixture画像・実データ表示・実音の成否を分け、本番の値をrepo・承認提示文へ残さない。 |
| R44-15 | PR baseはOwner決定の`feature/39-public-pages`。#43・#44・#45をまとめてmainへ公開する。#44のmergeで本番は変わらずWorker deployもない。Issue/Projectのcloseはまとめ出しがmainに入った時、それまではReview。§6の2回のOwner確認と独立reviewを通す。 |

## 3. 6つの状態と読み込み中

説明用の状態名や「プレーヤー（埋め込み）」等を公開本文へ写さない。局所状態は合成でき、全体失敗・全体0では一覧を隠して知らせを1つにする。

| 安定ID / Figma | 発生条件 | 公開表示と操作 |
|---|---|---|
| S44-01 / `30:448` | 有効な作品の「聴く」を押した後 | 選んだ作品直下に1つのplayer。作品名・メタ情報・外部リンクを保持し「聴く」を「閉じる」へ。別の再生では前を閉じる。 |
| S44-02 / `30:455` | 映像未選択・参照先削除・不正なyoutubeId | 「聴く」なし。有効な作品リンクだけを「配信先へ」または「購入先へ」で残す。リンクもなければ操作なし。公開のエラー説明は追加しない。 |
| S44-03 / `30:464` | 有効な映像のサムネイルを押した後 | サムネイルの場所をplayerに替えてその場再生。「閉じる」で停止・サムネイル復元・起点へfocus。作品再生との相互排他も適用。 |
| S44-04 / `30:468` | 成功データ中の特定作品区分または映像小区分が空 | 該当見出し・一覧・ページ内移動を出さない。video全体空ならvideoへの移動も消す。有効なチャンネルはmusic見出し側へ残す。不存在hashは上部へ戻す。 |
| S44-05 / `30:472` | 成功して全作品・全映像0、またはHTTP/JSON/network失敗・不正root・Music入力構造不正・描画不能 | 「音源の情報を読み込めませんでした。」「もう一度読み込む」「Bandcamp」「YouTube」。成功空は`empty`、失敗は`error`として識別。ヘッダー・フッター・music見出しを保つ。 |
| S44-06 / `30:484` | 作品画像未登録・不正URL・load error | 同じ正方形の淡い面中央に「松本一樹」のみ。作品タイトルは右または下の本来の位置に保持し、二重表示しない。1440pxは220角、390pxは120角。 |
| S44-L / `30:497` | 初回GET・再読込が未解決 | musicと区分の見出し・枠、淡いskeleton、「読み込み中」（status）、aria-busy。件数0と解釈しない。完了後にskeletonを消す。 |

Figmaの状態`30:459`は外部リンクを再生アイコンで表す一方、通常frameはChip/Linkを使う。ナビ間隔、player寸法、カード部品との違いも`construction/aidlc-integration/figma-fix-requests.md`に推奨案を固定する。確認1で採用対象を示し、Frontが必要なFigma整合を記録してから実装する。

## 4. 受入条件と証拠

| ID | 成立条件 | 必要な証拠 |
|---|---|---|
| PS-M-01 | digital・demoの全作品、musicVideos・liveMovies・demosの全映像、チャンネルへのリンクがMusicにある。 | T44-DATA：4作品/5映像の架空fixture、各要素の件数・タイトル・リンク・登録順と日付順・channelUrlの一致。映像の重複参照でもvideoから除かない。 |
| PS-M-02 | 各作品から1操作で聴き始めるか配信先・購入先へ進める（両方未登録を除く）。 | T44-PLAY：click中のiframe生成・src・属性・全操作の存在、外部URL一致と別タブ。実音はFrontの実データ確認、iPhone追加tapは受入済みQ42-01を明記する。 |
| PS-M-03 | 旧2URLで行き止まりがない。 | T44-LEGACY：実HTMLからscriptをVM実行したreplace先、JSを実行しないHTMLのリンクとMusicの行き先。query/hash・index.html・戻る履歴・区分空を検査。 |
| PS-M-04 | 本文の赤は見出しの線だけ。特定作品の優先操作はない。 | T44-STYLEのscope検査、1440/390画像、通常/hover/focus/選択/scrollbarの色。ロゴの既存例外は別に保持。 |
| PS-COM-01（#44分） | 全10HTMLで5項目の順序・解決先が一致し、390pxのMenuから全項目へ進める。 | T44-SHELL：実HTML・script VM、5リンク個別の選択、開閉・Escape・resize・現在地、1440/390のMenu画像。 |
| PS-COM-02（Music分） | S44-01〜06・Lの表示・非表示・復元が仕様どおり。 | T44-STATEと全7状態の画像。HTTP失敗/空成功/不正入力を分離し、retry/race/画像error/pagehide/pageshowも試験。 |
| AC44-HOME | Homeの「music →」が`/music/`へ進み、既存Homeの作品選択・2件・再生・停止が壊れない。 | HTMLのhref解決、既存home-rendering/home-player回帰。Homeカードに余分な個別リンクを追加しない。 |
| AC44-ADMIN | まとめ出し後の公開Musicと、#47前の管理YouTube・Discoが説明と一致する。 | READMEの最小差分、タブ6つとmodal名の保持、admin挙動の既存試験、独立reviewの明示チェック。 |
| AC44-COMPAT | Musicと旧2ページ以外の本文・各固有script・保存・Workerを保つ。 | 6ページ（Live・Live詳細・Ticket・Ticket完了・Profile・Contact）のmainのbase bytes一致。script順序、全Node/Worker試験、外枠smoke。Homeの意図した入口変更は別検査。 |
| AC44-PROD | 本番データの件数・形でbranchのMusic・Home・旧URL・管理説明が成立する。 | 確認2前にFrontがPC/スマホURLで本番公開データを読み、文字・画像・リンク・同一映像2箇所の再生と停止を照合。記録は時刻/revision/件数/成否、本文・idをrepoに保存しない。 |
| AC44-RELEASE | まとめ用branchへのPRと公開・close・rollbackの区別が明確。 | PR base、Project Review、Owner merge gate、2種類のrollbackと#43/#45衝突面を計画・独立reviewで確認。 |

## 5. 本番公開データから取り込む条件

分類は2026-11-18 11時台JSTに取得された公開projectionに基づく。元の値はscratchに留め、fixtureはすべて架空のタイトル・日付・URL・idにする。

- 作品4件＝digital 2・demo 2。全件に8key、日付は`YYYY.MM.DD`、画像は相対path、外部リンクは全件あり。`playbackVideoId`ありは1件、`releaseType`ありも1件。残る3件は聴くを出さず外部リンクで成立する。
- タイトルにASCII引用符と`/`、種別を含んだ旧タイトルがある。最長24文字。説明は空、または番号つき曲目4行/2行。R44-03で改行と文字を保持し、タイトルから種別を作り出さない。
- 映像5件＝musicVideos 2・liveMovies 2・demos 1。keyはid/title/youtubeId、youtubeIdは11文字。日付なし。仮の名前の映像も登録どおりに表示し、#44で命名や掲載を修正しない。
- 選択映像は映像の`id`参照であり、youtubeIdではない。同じ映像は作品の「聴く」とvideoの双方へ残し、起点を切り替えたら再生成する。
- #44はすべて表示・互換試験として扱う。内容の修正・再保存・移行は不要。#43へTicket完了の作品入口を`/music/`へ向ける契約、#47へ実管理タブと公開Musicの対応を渡す。

## 6. 承認とまとめ出し

確認1はRequirements・Workflow Plan・Code Generation Planの3つのexact digestと、計画に含む設計提案版のbytes・Figma整合案を対象にする。5 gateすべてItsuki Matsumotoの本人回答`A`を必要とし、VECTORは承認者にならない。確認1前はRequirements承認待ちで止め、昇格・コード・試験変更を行わない。

確認1の承認後に設計書の提案版をbytesのまま昇格して実装・試験する。Frontのfixture撮影と本番データ画面確認、設計と実装をまとめた独立review1回・修理を経て、確認2でCode Generation Result・Build/Test Resultを提示する。ItsukiにはPC/スマホURLを毎回渡し、確認2の閲覧は任意。必須の本人画面確認はまとめ出し前の1回。画面の未確認を実施済みと記録しない。

Owner決定（2026-11-18）：公開側#43・#44・#45は`feature/39-public-pages`へ集約し、最後にmainへ1回で出す。repo規定のorigin/mainからのworktree・PR base mainとの相違はこの明示例外による。今回のbase commitはorigin/mainとorigin/feature/39-public-pagesの同一commitである。#44は先に統合し、#43・#45はそれを取り込んで本文を変更する。#44単独mergeで本番確認・Worker deploy・Issue closeは行わない。Git操作・外部管理操作・Owner対話・承認記録はFront、merge・本番反映・PR承認はItsukiが担う。

## 7. 未確認事項と解消責任

- Musicのrender PNGは保存されていない。数値・文言は検査済みsnapshotが根拠。Frontが実装画像と寸法を照合し、Figma修正一覧を整合する。#42のHome/Menu/部品renderは参考に留める。
- Musicを開いたMenu専用frameはない。共通の現在地規則をMusicへ適用する。Homeナビ`23:41`のgap32は#42の観測であり、今回のlive再読取ではない。
- 本番取得後の変化、端末実音、今回の画面・font・文字行数は未検証。Frontが確認2前に解消し、結果の残件へ正しく記す。Q42-01の受入を再質問しない。
- localhost bindをWorkerのsandboxで行えないため、後続Workerは撮影script/fixture/手順を用意し、Frontが実行する。今回の`ui_route=none`。実装承認・独立review・Owner承認・Front completionは未成立である。
- 追加のOwner価値判断の問いはない。Figma整合案は確認1の採否に含める。許可外操作・データshape/保存/Workerの変更が必要になればBLOCKEDでFrontへ返す。
