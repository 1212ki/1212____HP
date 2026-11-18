# Requirements — Homeと共通の外枠（Issue #42）

- Status: Draft / Itsuki承認待ち
- Cycle ID: `2026-11-17_issue-42_home`
- Owner / approver: Itsuki Matsumoto
- Reader: human_reader / ja-JP / designated_text_editor（Frontが提示する）
- 現在地: 確認1の候補。コード・試験・current canonicalは未変更。確認1はgate 1〜3の3文書と設計書提案版を対象とする。

## 1. 目的と変更の単位

ライブで知った人がHomeを開き、作品を聴き、次のライブの予約へ進めるようにする。画像の帯を作品のジャケットに置き換え、その近くに作品名・再生・次のライブを置く。下にはnews、ほかの作品2件、短い紹介、外部リンクを残す。

#42はHomeと全公開ページのヘッダー・フッター・Menu、および共通部品の定義を一緒に公開する。Live・Ticket・Discography・YouTube・Profile・Contactの本文へ新しい部品を適用する作業は#43〜#45へ渡す。管理画面は共有画像の説明と公開表示に関する説明だけを更新する。

根拠はIssue #42、Approvedの公開設計§2〜7・管理設計§5.3、FigmaのHome section `35:273`（画面`23:36 / 24:43`、状態`24:139`、要件メモ`25:83`、Menu`39:850`）、部品`20:23`・方針`20:5`。snapshotの絶対path・hash・取得時刻、完全なIssue本文、原典と現コードの差は`aidlc-docs/audit.md`に残す。下の採用案には、Frontが固定した範囲・途中の状態・受入手順を含む。Ownerの原文とFrontの翻訳を混同しない。

参照するFigmaはFront反映後の`/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-223255_1212hp-42-home/figma-snapshot-v2/`。文言の書き出しは2026-11-17T23:16:01+09:00、`page-0-1_master-home.md`のSHA-256は`b08d37109e0f407cbf15c65442c027c677cfb7297dcd3e913d12f7b7a27483c8`、`SHA256SUMS`のSHA-256は`27defc5c6f6b7f1c2f6b5d6dd8cb29645050c038cf31b69020f87bec6071428f`。`diff-vs-v1.md`の結論は`unexpected: none`で、差はE1〜E14だけ。修正前の`figma-snapshot/`（v1）は比較用provenanceとしてauditに残す。`39:850`・`20:23`のspecとrenderはv1の写しで、新しいlayout/style観測とはしない。

F42-01はFrontのD1（ロゴ維持）を、F42-02〜09はD2（推奨案採用）を反映済み。別紙の採否・E-id対応を確認1でItsukiに示す。Owner承認はまだない。

## 2. 要件

| ID | 実装後の振る舞い |
|---|---|
| R42-01 | 顔の作品は`MusicData.resolveFeaturedRelease(data)`で選ぶ。明示idを優先し、未指定・切れた参照ならdigital→demoを合わせた最新の有効日付の作品。同日は元順。候補0なら顔なし。保存配列は変えない。 |
| R42-02 | タイトルを登録どおりに出し、`releaseType`があれば別の文字として出す。タイトル内の種別を解析・削除しない。日付も元文字列を保持し、メタは空でない種別と日付を` ／ `で結ぶ。種別なしでも日付を独立したメタとして出せる。空の区切りは出さない。 |
| R42-03 | `playbackVideoId`を3映像カテゴリの`id`へ解決し、利用できる`youtubeId`がある時だけ「聴く」。押した箇所の直下にYouTubeプレーヤーを開き、有音の再生開始を要求する。「閉じる」でiframeを破棄して止め、元の「聴く」へfocusを戻す。端末制限は§6のGapとQ42-01に従う。 |
| R42-04 | 顔の作品に安全なhttp(s)の`link`があれば、Digital Releaseは「配信先へ」、宅録Demoは「購入先へ」。別タブ・`rel=noopener noreferrer`。リンクなし・不正URLなら出さない。再生アイコンを外部リンクへ使わない。 |
| R42-05 | 次のライブは既存`sortUpcomingLives`で近い順にした`live.upcoming`の先頭1件。日付を過ぎても区分がupcomingなら表示を残す。日付・会場・タイトル・既存の詳細文字を保持し、フライヤーは出さない。予約可否は`LiveOperations.resolveLiveById / getTicketCta`で判定し、Home側で同じ規則を再実装しない。 |
| R42-06 | 予約の4分岐は内部予約→`ticket/?liveId=…`、有効な外部予約→別タブ、受付終了／日付を過ぎたライブ→非操作の「予約受付終了」、不正URL→非操作の「予約URLが無効です」。helper不在・重複id・空idも安全側で「予約情報を確認できません」。詳細と一覧の入口は保つ。 |
| R42-07 | newsは有効な日付の新しい順で最大6件、同日は元順、不正／空日付は末尾。日付・タイトル・説明・登録したリンク文言を保持し、画像は出さない。説明は省略記号をデータに書き込まず、全文を読める。リンクなしならリンク文言なし。文言末尾の矢印は1つに揃える。 |
| R42-08 | musicはdigital→demoの連結から顔のidを除き、`sortReleasesByDate`で並べた先頭2件。0〜1件でも成立する。タイトル・種別・日付・ジャケットを出す。個別の新しい操作を足さず、下の「music →」から既存Discographyへ進める。 |
| R42-09 | profileは`profile.text`の改行を正規化し、最初の空行までを表示する。空白だけの行も区切り、単一改行は保持、`<br>`は改行として扱い、その後HTMLをescapeする。写真はHomeへ追加しない。「profile →」は`profile/`へ。 |
| R42-10 | linksはSiteのHome Linksを正本としてBandcamp・YouTube・X・Instagram・noteの順に5入口を残す。HomeのBandcamp表記は「Bandcamp（音源・物販）」。欠落URLは既存のProfile同名リンクfallbackを保ち、無効／未登録なら操作を捏造しない。Profile本文側のラベルは変えない。 |
| R42-11 | 全9ページの外枠を同じ寸法・書体・色にする。ナビは今の順序と表示名（Home / Profile / Live / YouTube / Discography / Contact）と行き先を維持する。390pxはMenu／閉じるで開閉し、6項目すべてへ進める。ロゴの波紋・音符、reduced-motion対応、各ページ固有のscript読込を保つ。 |
| R42-12 | ボタン、リンク、見出し、作品カード、news行を共通の明示classとして定義し、今回はHomeと外枠に適用する。既存の本文用selectorを一括変更しない。Home以外の本文・送信処理・予約処理・動画・Contact設定が従来どおり動くことを回帰確認する。 |
| R42-13 | 色・書体・余白の正本は`DESIGN_RULES.md`とtokens。Homeの赤は「予約する」と主要見出しの短い線に使い、ロゴの赤いiと押した時の波紋・音符の演出は今のまま保つ。ナビ・リンクのhover/focus、選択色、scrollbar、背景、ロゴhoverの線には赤を使わない。FrontのD1をE1・E3で反映したv2とF42一覧に従う。 |
| R42-14 | Homeは`site.heroImage`を読み取って表示しない。管理画面の表示名「共有時の画像」、key・保存・画像操作、Live OGの予備は保持する。説明とREADMEからHomeの帯を兼ねる意味と「公開画面は現在の表示を維持する」という現状と違う記述を除く。 |
| R42-15 | 下の10状態と読み込み中を独立して試験する。全体失敗とLiveだけの失敗を区別し、未取得を空件数と取り違えない。再読込は同じ公開GETをユーザー操作で再試行し、二重fetch・二重listener・古い応答による上書きを防ぐ。 |
| R42-16 | #42単独で公開した時点のリンク文言と行き先、管理画面説明が一致する。#44完成を前提にしたMusicナビ・旧URL転送は導入しない。 |
| R42-17 | #42は単独公開。確認2の前にFrontがItsukiへ実際の1作品の種別・映像とSiteの顔の選択の保存を頼み、保存済みなら入れ直さない。確認2でbranchの本番公開データを読む新HomeをPC・スマホから開き、顔・種別・聴くの実音・閉じるをmerge前に確かめる。fixture撮影とは別の受入とする。merge後はFrontがPages buildと公開Homeの新版配信をread-only確認し、差がある時だけItsukiへ返す。Worker APIのdeployは不要。反映とrollbackはCode Generation Planに従う。 |

### 途中の状態で使う文言と行き先

| 表示 | #42公開時の行き先・意味 |
|---|---|
| Home / Profile / Live / YouTube / Discography / Contact | `/`、`/profile/`、`/live/`、`/youtube/`、`/discography/`、`/contact/`。相対hrefは今の階層別指定を保つ。 |
| music → | `discography/`。ナビにMusicはまだない。音源作品の一覧へ進む意味で使用。 |
| all live → | `live/`。通常・外部・受付終了でも同じ一覧への入口。 |
| これまでのライブ → | `live/detail/?view=past`。現行の過去全件表示が実在し、古いLiveの詳細へ進める。 |
| 詳細 / profile → | `live/detail/?liveId=…` / `profile/`。id不明なら詳細を`live/`に向ける。 |
| 共有時の画像 | Live共有時、ライブ画像がない場合の予備。Homeは作品のジャケットを使用。 |

## 3. Homeの状態

状態の見本にある説明用の見出し・プレーヤーの説明文はサイト本文へ写さない。通常の内部予約は基準状態で、下の10個には数えない。複数条件は合成できるが、全体失敗は全体表示を優先する。

| 安定ID / node-id | 条件 | 表示と操作 |
|---|---|---|
| S42-01 / `24:141` | 選ばれたupcomingの予約CTAがactiveかつexternal | 「予約する（外部サイト）」を別タブ。日付・会場・タイトル・詳細文字・詳細・all liveを保つ。 |
| S42-02 / `24:153` | reservationClosedまたは日付経過による予約不可 | 「予約受付終了」を非操作の文字として出す。予約hrefなし。詳細・all liveを残す。 |
| S42-03 / `24:165` | live.upcomingが取得済みの空配列 | 「次のライブは、決まり次第ここでお知らせします。」「これまでのライブ →」。予約なし。 |
| S42-04 / `24:171` | payload全体は取得できたがliveが不正、upcomingが配列でない、またはHomeのLive描画処理だけが失敗 | 「ライブ情報を読み込めませんでした。」「もう一度読み込む」。ほかの欄を保つ。同じGETを再試行。空配列と区別。 |
| S42-05 / `24:179` | 有効な「聴く」を押した後 | 作品直下にiframe、「閉じる」と外部リンク。閉じると停止・破棄。遷移や再描画の前にも破棄。 |
| S42-06 / `24:193` | 顔はあるが映像指定空・切れた参照・無効youtubeId | 「聴く」を出さない。有効な作品リンクだけ「配信先へ」／「購入先へ」。リンクもなければ操作なし。 |
| S42-07 / `24:203` | 顔の画像が空・安全でない、または画像load error | 元の画像と同じ寸法の淡い面へ作品タイトルと「松本一樹」。同じジャケットへの無限retryをしない。 |
| S42-08 / `42:489` | 顔の候補がnull（作品0、または自動候補が全件不正日付） | 顔の場所に「松本一樹」、次のライブを幅いっぱい。「聴く」なし、linksを残す。作品自体が残る場合はmusicに最大2件出す。 |
| S42-09 / `42:493` | 取得済みnewsが空 | newsの見出し・欄を隠す。musicを隠さない。 |
| S42-10 / `42:497` | GETのnetwork/HTTP/JSONエラー、またはrootデータが非object/null/配列 | ヘッダー・フッターを残し、新作・次のライブ・news・musicの場所を1つの「情報を読み込めませんでした。」「もう一度読み込む」に置換。静的fallbackのBandcamp・YouTube入口を同じ知らせに添える。profileの未取得内容を捏造しない。 |
| S42-L / `25:91` | 初回GET待ち、全体の再試行待ち | 見出しと枠を先に出し淡い面を置く。`aria-busy=true`と読込状態を示し、架空のタイトル・日付・予約操作を出さない。終端でbusyを解除。Liveだけの再試行中はその枠だけbusy。 |

不正予約URL、識別不能なLive、外部リンク不正は上の10状態の追加防御として試験する。予約判定の「日付を過ぎたら不可」は既存共通処理に従い、upcomingから表示を消す処理には使わない。

## 4. 受入条件と確かめる方法

| ID | 条件 | 証拠 |
|---|---|---|
| PS-H-01 | 幅1440pxの最初の画面にジャケット・作品名・次のライブの日付・予約する、映像選択時は聴くが入る。 | 1440×900、scrollY=0の画像と各要素のbounding box。通常の予約可能fixtureで確認。 |
| PS-H-02 | 幅390pxでスクロールせずジャケットと作品名が見える。 | 390×844と390×667の画像・bounding box。実スマホでも確認。任意の長いタイトルは隠さず折返し、667で収まらない場合はOwnerへ画面付きで返す。 |
| PS-H-03 | 聴くがある時、押してから1回の操作で音が出る。 | Nodeでclick→有音autoplay要求を検査。実音はPCとiPhone Safariの実操作で確認。Node・Chromiumのstubを実音証拠にしない。 |
| PS-H-04 | 次のライブなしでは予約を出さず、未定の文を出す。 | S42-03のDOM・画像。 |
| PS-H-05 | 外部リンク5つ、next live、news最大6件の説明と登録リンク文言を保持。 | 日付の逆順・同日・7件以上の架空入力で実DOMを検査。5リンクのURL一致。 |
| PS-H-06 | 赤は予約すると主要見出しの線に使う。ロゴ（iの文字と、押した時の演出）は今のまま。 | v2の`25:100`（本文`25:102`、E1）・`28:111`（E3）、CSS適用範囲と1440/390画像。赤いi・波紋・音符の維持と、ナビ/リンクのhover・focus、選択色、scrollbar、背景、ロゴhoverの線が赤でないことを確認。 |
| PS-COM-01（#42分） | 390pxのMenuが開閉でき、既存6項目とPCの行き先が一致する。 | 9ページのhref解決、DOMイベント、Menu開閉の画面、Escape・resize・キーボード。5項目化は#44。 |
| PS-COM-02（Home分） | 10状態と読込中が定義どおり。 | S42-01〜10・Lの決定論的試験、主要状態の画像。送信状態はHomeにない。 |
| AC42-SHARE | 共有時の画像の表示名・説明・実際の働きが一致する。 | Homeのhero非使用、adminラベルとREADME、既存OG回帰を確認。keyと保存は不変。 |
| AC42-INTERIM | #42だけを出してもリンク・画面・管理説明に未完成の機能を示す誤りがない。 | 上の文言・行き先表を試験と独立reviewで照合。 |
| AC42-COMPAT | Home以外の本文、各script読込順、ナビ、ロゴの赤いi・押した時の波紋/音符の色と動き、reduced-motion、Ticket/Contactの既存操作が壊れない。 | VM/HTMLの回帰と全Node試験、9ページの表示smoke。既存#41試験のHomeに関する期待だけを意図した新挙動へ更新。 |
| AC42-PROD | #41の3項目を実際の1作品で保存し、本番の公開データがbranchの新Homeに顔・聴く・種別として反映することをmerge前に確かめる。 | 確認2前にItsukiが通常保存（保存済みなら再入力なし）。Frontが本番projectionとPC/スマホ用URLを照合し、確認2でItsukiが同じ作品・種別・1操作実音・閉じるを確認する。fixture撮影と分けて時刻・tested revision・id・成否を記録し、本文をrepoへ保存しない。merge後はFrontのread-only配信確認。 |

## 5. 本番データの観測と担当範囲

2026-11-17T16:38:02+09:00の公開projectionだけを分類した。データの内容はrepoへ複写しない。

- 作品4件（digital 2、demo 2。`disc-1 / disc-2 / disc-3 / disc-4`）はすべてASCIIの`YYYY.MM.DD`に一致。画像欠落0。#42で共通helperにそのまま渡す。空・不正日付の防御試験も省略しない。
- liveはupcoming 2、past 19。構造化5項目（`openTime / startTime / ticket / notes / performers`）がすべて空でdescriptionだけを持つ14件はすべてpast。該当idはauditに列挙する。現在のHomeの次回選択には入らない。#42ではデータや過去本文を変えず、既存詳細の保持回帰を行い、#43へ一覧・詳細の表示確認を渡す。
- news 6件、Siteの5リンクはすべて登録あり。Profileは空行で2段落。#42の6件・5リンク・先頭段落の規則に使える形である。本文はfixtureに使わない。
- snapshotは#41 deploy前で3keyを持たない。deploy後の公開APIは3keyを空で返すとのFront報告がある。取得後の変更と本番の実再生は未確認。欠落・空・入力済みの3形を#42で試験する。

## 6. 未確認事項とOwnerの判断

### Gap

- 外部network禁止のためYouTube公式の埋め込み仕様・ブラウザの最新autoplay policyを今回調査できない。現コードにYouTube iframeと`allow=autoplay`がある事実は確認した。有音autoplayを要求してもブラウザが必ず許可するという根拠はない。
- click同期で`autoplay=1&playsinline=1&controls=1&rel=0`のiframeを作る方式は、非同期API準備をclick後に挟まず最小の要求を出せるという設計上の推論。PC Chromium/Safari、iPhone Safariの可否・埋込禁止映像・省電力設定・通信状況は実機で未確認。
- FigmaはFront反映済みのv2 snapshotとdiffを確認した。E1〜E14の反映とD1/D2の採否は確定したFront判断で、確認1のItsuki承認は未実施。Workerはlive Figmaへ接続していない。外部の最新Issue #43〜47は未取得で、#40 cycle内の保存済み写しを範囲確認に使用した。
- viewportの高さはマスタでは受入条件になっていないため、確認用に900/844/667を提案する。実機Safariの表示領域と長い実タイトルの収まりは確認2で判断する。

### 確認2前の本番データによる受入

認証不要の公開API `GET https://1212hp.itsukimatsumoto.workers.dev/api/public/site-data`が`Access-Control-Allow-Origin: *`を返すことはFront確認済み。repoの`assets/js/site-config.js`はこの本番URLを指定しており、branchを手元配信すれば同じ公開データを読める。`#41`の公開互換試験は3項目の欠落・空・登録ありで旧公開表示が変わらないことを保護しているため、merge前の通常保存で現公開画面は変わらない。CORSのlive応答をWorkerが再取得したとはしない。

Frontは確認2前にItsukiへ1作品の種別と映像の保存、Siteの顔に同作品を選ぶ保存を頼む（保存済みなら入れ直さない）。fixtureの画像とは別に、本番データを直接読むbranchの手元配信をPC・スマホ用URLで提示し、Itsukiが顔・種別・「聴く」の実音・「閉じる」を確認する。未確認を残してmergeへ進めない。公開用ファイルだけを配信し、管理画面・token・private fileやrepo全体を外へ出さない。merge後はFrontがPages buildと公開Homeの新版配信をread-onlyで照合し、差が見つかった時だけItsukiへ返す。同じデータ・画面の2回目の本人確認は頼まない。

### owner_questions

- Q42-01: 一部の端末で最初の「聴く」だけでは音が出ず、埋込プレーヤーの再生をもう1度押す必要がある場合、どう扱うか。推奨は、同じ場所の有音再生要求と標準controlsを実装し、確認2で実機結果を見て、その端末での追加tapを例外として受け入れるか判断する。PS-H-03を現段階で弱めず、失敗をPASSにせず、受け入れられなければmergeを止める。Ownerが例外を採らない場合は、別方式の計画と承認を取り直す。

対象外はデータshape・保存・Cloudflare Worker、他ページの本文再設計、Music新設、5項目ナビ、#46/47の管理画面再構成、掲載内容の追加。本Packetは未承認候補の作成だけで停止する。
