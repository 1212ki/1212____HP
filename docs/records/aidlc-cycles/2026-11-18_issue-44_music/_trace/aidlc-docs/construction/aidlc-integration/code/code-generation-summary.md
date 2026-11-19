# Musicと5項目ナビの実装結果（Code Generation Result）

Musicで全作品と映像を選び、作品の「聴く」や映像のサムネイルからその場で再生できるようになりました。公開10ページのナビはHome / Live / Music / Profile / Contactの5項目で、Homeの「music →」と古い2つのアドレスもMusicへつながります。

実装後に、本番の公開データをPC幅で開くとプレーヤーが小さすぎる（作品220×124、映像310×174）と分かり、Itsukiの決定「両方大きくする」で作り直しました。いまの採用値は、PCの作品が480×270、映像が474×267、スマホ幅（390px）は358×201のままです。

この作り直しを含め、実装・自動試験・Frontの撮影と目視・本番の公開データでの確認・独立review2回を終えています。確認2で承認いただく対象は、Code Generation Plan（第2版）、本書、Build/Test Resultの3つです。実音の確認、gate 3の再承認、gate 4・5、Front completion、cycle close、PR、mergeは、まだ成立していません。

- Cycle: `2026-11-18_issue-44_music`
- 対象: `feature/44-music` / base `080325887576655f27461cb15f28a3c590a292ee`
- reader_profile: audience_class=human_reader / language=ja-JP / review_surface=notion_paper（Frontが投影） / reader_ready=true / open_status=not_opened

## Itsukiに確認いただきたいこと

1. **Code Generation Planの第2版**: 確認1で承認いただいたのは第1版（SHA-256 `f462589ba9beeb9ae381ac3e99cc2d0dba394510e1b00c387079c43ee5c96646`）です。プレーヤーの寸法を変えたため、第2版（`e9ce7059c877f2c9dcdb46906db48cd9a691054a20181cb19560b540f1c65f9a`）の再承認が要ります。Requirements（gate 1）とWorkflow Plan（gate 2）は変わっていないので、確認1の承認がそのまま有効です。
2. **Requirementsの「作品直下」の読み方**: Requirementsは「選んだ作品直下」にプレーヤーを置くと書いています。PCで並びの2番目以降の作品を押すと、プレーヤーは押した作品の真下ではなく、押した作品を含む並びのすぐ下に開きます。これは決定「作品の並びの下」に従った実装で、Requirementsの「作品直下」を「PCでは押した作品の並びのすぐ下」と読んでいます。この読みでよいかを、確認2のAで併せて確認します。字面どおり真下を求める場合は、Requirementsの再承認（gate 1）になります。
3. **既知の制限**（下の「既知の制限」）を受け入れるか。
4. **Homeのプレーヤー**: Homeのプレーヤーは#42のままで、置ける幅が356px未満（おおむね画面幅388px未満のスマホ）では高さが200pxを下回ります。390pxでは358×201で下回りません。#44では変えていません。Homeにも最小の高さを当てるかは範囲外で、別の判断です。

## できるようになったこと

`music/index.html`はrelease・demo・videoの順に全件を表示します。作品の日付順は既存MusicData、種別と日付の表示はHomeのhelperを共用しました。作品名を解析せず、説明の全文と曲目の改行を保ちます。空の区分とページ内移動は出さず、有効なチャンネル入口は映像0件でも残します。選択映像は作品とvideoの両方に掲載されます。

`site-content.js`のMusic専用bootが公開GETを1回行い、Musicとfooterを描画します。起点は区分と元配列の番号から作り、登録idやタイトルをDOM hookへ埋め込みません。リンクは安全なhttp(s)、文字はescape、相対画像とversion queryは既存の処理を共用します。旧rendererと他ページのgeneral bootは保持しました。

`home-player.js`の単一sessionをHome/Music adapterで共用します。閉じると起点とfocusを復元し、別作品・別映像・同じ映像の別起点へ切り替える時は前のiframeを破棄して最初から再生します。有音autoplayをclick内で要求し、再描画・再読込・pagehideでも停止します。Homeの公開API・DOM移動・既存testidと操作は維持しています。

6状態と読み込み中を分けました。全件0は`empty`、HTTP/JSON/network・構造・描画失敗は`error`。全体の知らせは1つと再読込・Bandcamp・YouTubeの1組です。再試行の二重GETを防ぎ、遅応答を捨て、bfcache復帰時の中断要求を再開します。不存在hashは履歴を増やさず上部へ戻します。画像の未登録・不正・load errorでも作品名や操作を残し、淡い面にartist名またはvideoを表示します。

旧`discography/`は`music/#release`、旧`youtube/`は`music/#video`へ`location.replace`で移動します。query/旧hashを破棄し、JavaScriptが無効・失敗でも常時リンクから進めます。旧2HTMLはAPIを読みません。Musicのnoscriptにも外部で聴く入口を残しました。canonicalとnoindexはHTMLへ設定し、旧ページがHTTP 301になったとは主張しません。

全10HTMLで同じ5項目ナビを使い、Ticket系はLive、旧2URLはMusicを現在地にします。Menuとロゴの既存処理は保持しています。Live・Live詳細・Ticket・Ticket完了・Profile・Contactの`main`はbase bytesと一致します。Home本文は「music →」のhrefのみ変更しています。

管理説明は`admin/README.md`だけを修正しました。公開Musicの作品はDisco、映像とChannel URLはYouTubeで編集し、6タブの統合は#47と案内しています。Ticket完了の案内は#43、公開は#43・#45とまとめることも明記しました。

修理のとき、次の2点も直しました（独立review1回目の指摘）。「もう一度読み込む」が成功したあとはfocusがbodyに落ちず、`music`の見出しへ移ります（失敗が残る時は新しい再読込ボタン）。作品の「配信先へ」「購入先へ」の読み上げ名は、見える文字で始まり作品名と「外部サイト・別タブ」を含みます（見た目の文字は変えていません）。

## 採用した寸法（第2版）

許容は丸め±2pxです。決定の原典は`_scratch/codex-work/20261118-110045_1212hp-44-music/owner-decision-player-size.md`（2026-11-18T13:51:35+09:00、SHA-256 `307eb5109b7563ccf601acc47d9e12219273908913616aa5410f3ff0bd3c7eaa`）。

| 場面 | 第2版（いまの実装） | 第1版の記録 |
|---|---|---|
| 作品の「聴く」、PC（本文980） | 480×270。押した作品を含む並びのすぐ下の行に開く。ほかの作品に重ならず、一覧からはみ出さない | 220×124 |
| video、PC（本文980） | 2列、間隔32。サムネイルとプレーヤーは474×267、題名の幅も474。押すと同じ場所に同じ大きさで開く | 310×174、間隔24 |
| スマホ（390px、本文358） | 作品の行の全幅358×201、映像358×201、作品画像120 | 同じ |
| 途中の幅 | 置ける幅に合わせて16:9を保つ。820px以下でスマホの配置に切り替える。820pxを超える最小の本文789pxでも、映像は1列あたり378.5×212.9で200pxを下回らない | — |
| 最小の高さ | Musicの作品・映像のプレーヤーとサムネイルは、幅が356px未満でも高さ200pxを下回らない（360pxで328×200） | — |

作品の一覧はPCでgridにし、押した作品の番号と実際の列数から`grid-row`を計算してプレーヤーの宿を並びのすぐ下の行へ置きます。宿はDOM上では押した作品のカードの直後にあり、動かしません（動かすとiframeが読み直されるため）。画面幅を変えた時は`grid-row`だけを入れ直します。どの作品のプレーヤーかは、並びのすぐ下の位置、押した作品の「聴く」が「閉じる」に替わること、宿の`role="group"`と`aria-label`（「<作品名>の再生」）で示します。

Figmaマスタも同じ大きさに直しました（F44-07、Frontが反映）。

## 承認とexact bytesの昇格

gate 1〜3はItsuki Matsumotoの原典回答A（prompt `2026-11-18T12:18:51+09:00`、response `2026-11-18T12:22:07+09:00`）から3承認記録（`approvals/01〜03`）へ転記しました。gate 3の記録は第1版のdigestの記録として残し、書き換えていません。第1版の写し（Code Generation Plan・figma-fix-requests.md・提案版public-site-ui.md）は`construction/aidlc-integration/superseded/`にあり、READMEの元SHA-256と一致します。

第2版でdigestが変わったもの（gate 3の再承認の対象）と、変わっていないもの:

| 文書 | 第2版のSHA-256 | 第1版からの変化 |
|---|---|---|
| Code Generation Plan | `e9ce7059c877f2c9dcdb46906db48cd9a691054a20181cb19560b540f1c65f9a` | 変更（再承認待ち） |
| `figma-fix-requests.md` | `3c292f72e3b3e7522b775b02a0e5ff2cc42ec98abc3e78822197e9176f00f918` | 変更 |
| 提案版・`docs/specs/current/public-site-ui.md` | `1aa471ebbb9680f762b4bcd2e97788aedd6f259fe82ad67ebc1f8b9e65e30a56` | 変更（第1版は`4ab8696607364df31178a78ebe824e50a69c4d71315a7c4343f7ac8fa486ea44`） |
| 提案版・`docs/specs/current/live-operations-admin-ui.md` | `f031cc243749714ecdbead55ed9e79dd6f33e73c9fd851390346fdcc681c4cb1` | 変わらない |
| 提案版・`docs/specs/current/README.md` | `8ecd9e3c00ad1025acf8683417780f7071d8d9d8be29e0bd9a98044c890dea0a` | 変わらない |
| Requirements | `5751641557852624a5189c40352bdd4537c5fc8322b299a4ba1ca376b8124c6d` | 変わらない（gate 1は有効） |
| Workflow Plan | `1f511514eeb5f38c4246b572c802b6ee4f02eaf320f7efb988eaf81bc282937a` | 変わらない（gate 2は有効） |

`docs/specs/current/`の3ファイルは、提案版の3ファイルとexact bytesで一致します（`cmp -s`。最初の昇格は`verification/promotion.log`、第2版の置き直しは`verification/round2-promotion.log`）。第2版のplanはその後、Worker 06aが本文の幅の数字を788pxから789px（821−32）に直し、`e9ce7059…`になりました。寸法の決定と820pxの切替は変えていません。

## 変えたファイル

第1版の8段（段1〜8）と、第2版の段9（PC幅のプレーヤー、`verification/round2-*.log`）、review後の修理（`round4-*.log`）で変えたのは、次の25ファイルです。これにactive cycleの承認・結果・検証記録（`aidlc-docs/`）を加えています。

- 公開HTML（10）: `index.html`、`music/index.html`（新規）、`live/index.html`、`live/detail/index.html`、`ticket/index.html`、`ticket/complete/index.html`、`profile/index.html`、`contact/index.html`、`discography/index.html`、`youtube/index.html`。
- 共有処理・説明（6）: `assets/js/site-content.js`、`assets/js/home-player.js`、`assets/js/music-redirect.js`（新規）、`assets/js/script.js`、`assets/css/style.css`、`admin/README.md`。
- 試験・fixture（6）: `test/music-rendering.test.mjs`、`test/music-player.test.mjs`、`test/music-redirect.test.mjs`、`test/fixtures/music-states.json`（以上新規）、`test/site-shell.test.mjs`、`test/public-music-data-compatibility.test.mjs`。
- 設計書（3）: `docs/specs/current/public-site-ui.md`、`live-operations-admin-ui.md`、`README.md`。

共有CSS・script・site-content・home-playerのconsumer queryは`20261118-44`です。Musicのscript順はsite-config→music-data→home-player→site-content→scriptで、Live helperを読みません。第2版では`home-player.js`・`music/index.html`・fixture・tokens・`DESIGN_RULES.md`・データの形・admin・Cloudflareは変えていません。撮影の材料は`verification/capture-music.py`（56画像、判定の誤りを1件直しました）と`capture-image-inventory.json`です。

| 段 | 内容 |
|---|---|
| 1 入力と昇格 | 承認記録01〜03、設計書3件の昇格、fixture。昇格後に既存characterization 75件を確認。 |
| 2 通常表示 | Musicページ・renderer。全4作品/5映像・順序・説明・URL・画像・チャンネル。 |
| 3 共有再生 | Home/Musicでiframe最大1つ、同じ映像の別起点、閉じる復元。 |
| 4 状態と復帰 | 6状態＋loading、retry/serial/bfcache/hash、画像error。 |
| 5 古いアドレス | 旧2HTMLの誘導と互換試験の移行。 |
| 6 外枠・見た目・説明 | 5nav/現在地、Home入口、Music scope、管理説明。 |
| 7 撮影の材料 | 撮影script・fixture。 |
| 8 結果 | 本書、Build/Test Result、cycle-summary、state/audit。 |
| 9 PC幅のプレーヤー（第2版） | 作品の宿の配置、映像2列、最小の高さ、retry後のfocus、読み上げ名。 |
| 修理（review 2回目の指摘） | retry成功後のfocusがhashの位置を戻さない、試験の緩み、planの数字。 |

## 計画との差（第1版からの変更と理由）

- **プレーヤーの寸法・配置・最小の高さ**: 第1版（220×124・310×174）は、YouTubeの埋め込みの最小（200×200。16:9は480×270を推奨）に届かず、Frontが本番の公開データで確かめて分かりました。Itsukiの決定で第2版にしました（上の表）。
- **作品の宿の位置**: カードの中から、カードの直後の兄弟要素に移しました。一覧のgridが宿に全幅の行を与えられるようにするためです。id・testidは変えていません。
- **retry後のfocus**: 見出しへのfocusは、hashが有効なら`preventScroll`にしました。focusがhashのsectionの位置を上へ戻さないためです（review 2回目のRV44-10）。
- **試験の緩み**: 測った要素を記録して確かめる形にし、数値だけの式を、CSSの値から計算する形に改めました（RV44-11）。既存の試験は削っていません。
- **意味・対象ファイル・データ契約・ナビ**は計画どおりです。scope内のclass名、単一sessionの復元closure、Mapによる操作解決はWorkerが具体化しました。既存のmobile `nav`がMusicのページ内移動を隠すため、Music scopeでその規則を解除しています。

承認済み計画やF44案のDraft/実装前の文言、設計書の過去時点の未実装表は、digestと履歴のため保持しています。root READMEの旧構成木は今回の対象外で、過去#42の単独公開・CORSの記述も履歴として保持し、今回の条件へ流用していません。公開APIは許可リストのオリジンだけに応えます。

## Frontの撮影・本番データの確認・独立reviewの結果

**撮影（Front、2026-11-19T12:28:58+09:00）**: execution targetから次の1行を実行し、exit 0、56枚、script内の判定はすべて通過しました（`verification/capture-front-3.log`、`capture-music-metrics.json`、画像は`verification/screenshots/`）。

```bash
/usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-music.py --serve
```

- 実測: 1440pxで作品のプレーヤー480×270、押した作品の並びのすぐ下。videoは2列・474×267・間隔32。390pxで358×201。360pxで作品のプレーヤー328×200（16:9なら184.5になる幅で、最小の高さが効きました）。821px・1024pxでもvideoは2列です。
- 目視: 56枚すべてをFrontが縮小の一覧で見て、修理が効く画像は原寸で見ました。作品・映像・プレーヤーの重なり、横のはみ出し、赤が見出しの線以外に出ること、状態の崩れは見当たりませんでした。古いアドレス・Menu・他の6ページは第1版の撮影と同じ見た目です。
- 前提: 外部fontは遮断したので文字は代わりのfontです。YouTubeとサムネイルは撮影用の仮の面です。
- 第1版の記録: 最初の撮影（`capture-front-1.log`、55枚）は第1版の寸法の記録で、いまの受入の根拠にしていません。2回目（`capture-front-2.log`）は、再生中に隠れたサムネイルまで寸法を判定する撮影scriptの誤りで途中で止まり、判定を直して3回目に通りました。実装の誤りではありません。

**本番の公開データでの確認（Front、2026-11-19、repoの外）**: 本番の公開データを、このbranchの写しの公開ページに読ませて確かめました。PCの「聴く」は480×270で押した作品の並びのすぐ下、videoは474×267の2列、390pxは358×201で、横のはみ出しはありません。ナビは5項目で今いるページが示され、古いアドレスは`/discography/` → `/music/#release`、`/youtube/` → `/music/#video`へ送られます。画像の読み込み失敗は0、consoleのerrorはありません。YouTubeの操作部品は欠けずに出ます。本番のタイトル・日付・URL・映像idはrepoに写していません。

**実音は確かめていません。** iPhoneで追加の1回押しが要る件は、#42で受け入れたQ42-01を引き継ぎます。

**独立review（Claude、read-only。試験を実行できない環境）**:

- 1回目（実装後）: APPROVED、blockingなし。結果文書が事実と食い違う（RV44-01）は、本書とBuild/Test Resultで閉じました。PCの寸法（RV44-02）はItsukiの決定で解消し、RV44-03〜05は指摘にしない判定でした。RV44-06（retry後のfocus）・RV44-07（読み上げ名）は第2版の修理で直しました。
- 2回目（修理後）: APPROVED、blockingなし。RV44-10（retry成功後のfocusがhashの位置を戻す）・RV44-11（試験とplanの小さな緩み）は直しました。RV44-08（下の既知の制限）、RV44-09（上の確認事項2）、FO7（上の確認事項4）は、Itsukiへの事実の共有です。
- 試験の件数は、reviewerが実行したものではなく、Worker・Frontが実行した結果です（Build/Test Result）。

## 既知の制限

Frontが受け入れ、Itsukiにも伝えるものです。

- **PCでTabの順と見た目の順がずれる（RV44-08、low）**: 宿はDOM上で押した作品の直後にあるため、並びの先頭の作品を押すと、Tabは「押した作品の閉じる→プレーヤー（見た目は並びの下）→同じ並びの残りの作品」の順になります。操作の失敗やfocusの喪失は起きません。関係は`aria-controls`・`aria-expanded`・宿の`role="group"`と作品名つきの`aria-label`で示しています。並びの末尾の作品は見た目と一致します。
- **最初の取得に失敗したあと、旧アドレス経由のhashへ戻らない**: 最初の取得が失敗するとhashのsectionが無いためhashが捨てられ、再読み込みに成功してもrelease・videoの位置へは戻りません。頻度が低く、内容は欠けません。
- **並びをまたぐ5件以上の作品は画像で確かめていない**: fixtureが区分ごとに2件のため撮影に出ません。列数ごとの試験（T44-LAYOUT）だけで縛っています。
- **Homeのプレーヤーの最小の高さ（FO7）**: 上の確認事項4のとおり、#44では変えていません。

## まだ成立していないこと

- gate 3の再承認（Code Generation Plan第2版）、gate 4・5（本書とBuild/Test Result）のItsukiの承認。承認記録は01〜03だけで、04・05はありません。
- 実音の確認、実際のfontでの字形と折返しの確認。
- Front completion、cycle close（`scripts/aidlc-cycle.sh close`は実行していません）、PR、merge。
- 本番への反映とIssueのclose。#44は`feature/39-public-pages`へ統合する計画で、そのmergeでは本番は変わりません。#43・#45とまとめてmainへ出す時に、公開確認とIssue/Project closeを行います。

試験の詳細、受入条件ごとの証拠、closeの書式事前検査はBuild/Test Resultにあります。
