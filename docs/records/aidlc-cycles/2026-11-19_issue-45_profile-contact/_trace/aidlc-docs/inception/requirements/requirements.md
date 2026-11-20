# Requirements — ProfileとContactの新しい見た目（Issue #45）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-19_issue-45_profile-contact`
- Base Commit: `ba124011ce5e0ae56ddb1c6ac47d1783600687b4`（`origin/feature/39-public-pages`。#44のPR #51をmerge済み）
- Branch: `feature/45-profile-contact`
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 1. 目的と範囲

Profileでどんな人かを短く確かめられ、Contactで用件を迷わず送れて、送れたことが分かるようにする。ProfileとContactの本文を新しい見た目（Figmaマスタ）に揃え、Contactの送信中・完了・失敗を重ねて開く表示からページ内の表示へ替える。

対象は`profile/index.html`と`contact/index.html`の`main`、`assets/js/contact.js`、`assets/js/site-content.js`のProfile・Contactの読み込みと描画、`assets/css/style.css`の末尾に足すProfile・Contactの規則、対応する試験、設計書（Profile・Contactに関わる所だけ）。

対象外は次のとおり。Contactの項目を増やすこと、送信の仕組み（送る先・送る項目・送り方）の変更、データの形・保存・管理画面・Cloudflare Workerの変更、ヘッダー・ナビ・フッター・Menu（#44の持ち分）、Home・Live・Ticket・Musicの本文、色・文字・余白の正本（`DESIGN_RULES.md`・tokens）。これらを変えないと満たせない要件が出たら、止めてFrontへ返す。

要件の正本は`docs/specs/current/public-site-ui.md`（§1の対象外、§2の判断表、§3のProfile・Contactの行、§4のPS-PC-01〜04とPS-COM系、§5、§6、§7）と`docs/specs/current/live-operations-admin-ui.md`（Site > ContactとProfileタブの項目）。Figmaはマスタ section `35:276`（Profile｜1440 `31:247`、Profile｜390 `31:294`、Contact｜1440 `31:336`、Contact｜390 `31:370`、状態 `31:400`、要件メモ `31:443`）、部品`20:23`、Menu `39:850`。原典・読取範囲・SHA-256は`aidlc-docs/audit.md`。Figmaの写真・文章・入力例・送った内容の例は表示構造の見本であり、掲載情報として採用しない。

## 2. 満たすべき要件

| ID | 要件と理由 |
|---|---|
| R45-01 | Profileの`main`は、見出し「profile」、写真と名前、登録された文章、links、依頼の入口の順。1440pxは写真（364×455、4:5）を左、内容（幅560）を右に置き、間隔56（マスタの値のまま。364＋56＋560＝980。F45-11は採らない）。本文は幅980、上下64。390pxは縦1列で、写真（358×358）を上、内容を下（間隔24）。本文は左右16、上下32。名前（「松本一樹」Heading 1 28/42、「itsuki matsumoto」Body sm・`--ink-muted`）はHTMLの固定の文字で、`profile`のデータ項目ではない。 |
| R45-02 | 写真は`profile.image`。枠は`--paper-deep`・角丸16・`object-fit: cover`（中央）。相対pathは既存の`resolveImageSrc`（`../`と更新versionのquery）で解決し、大文字拡張子（`.JPG`など）のpathもそのまま使う。http(s)でも相対でもない値は未登録として扱う。未登録、または画像を読み込めなかった時は、枠も代替の文字も出さず、名前と文章を幅いっぱいに置く（S45-01・X1）。読み込み中は枠の場所を淡い面で空ける。altは「松本一樹」。 |
| R45-03 | 文章は`profile.text`を登録どおりに出す。空行の段落の区切りと段落内の改行の両方を保ち（空行は1行分の高さ）、HTMLとして解釈しない（`textContent`で入れ、`white-space: pre-wrap`と折返しで見せる）。改行の表記ゆれ（CRLF・CR・文字列の`<br>`）は今のProfileと同じく改行に揃える。行頭の「・」の行も崩さない。空または空白だけなら文章の要素を出さない（余分な空きを作らない）。Homeのprofile欄（最初の空行まで、#42）は変えない。 |
| R45-04 | linksは、管理画面のSiteのHome Links（Bandcamp・YouTube・X・Instagram・note）をHomeと同じ判定（`buildSharedLinks`: Siteを優先、無ければProfileの同名リンクで補う）と同じ並びで先に出し、続けて、この5種類のどれにも当たらないProfileのリンクを登録順に出す。同じ行き先（正規化したURL）は1つにまとめる。Siteにあるサービスと同じサービスのProfile側のリンクは、Homeと同じくSiteの行き先を優先して出さない。表記は各サービスの名前（「Bandcamp」。Homeの「Bandcamp（音源・物販）」にはしない）。部品は`.site-chip`、別タブ（`target=_blank`、`rel=noopener noreferrer`）、http(s)以外は出さない。今のProfileに出ているリンクは1件も減らさない。1件もなければlinksの見出しごと出さない。「links」の見出しは`.home-caption`（赤い線なし）。Homeのlinks（#42の受入と試験）は変えない。 |
| R45-05 | 依頼の入口は、淡い面（`--paper-deep`、角丸16、padding 24、間隔12）に「出演のご依頼・お問い合わせ」（Label）と`.site-button--secondary`の「Contactへ」（`contact/`へ。どの幅でも中身に合わせた幅）。新しい情報は足さない。読み込み中・失敗の時も出す。 |
| R45-06 | Profileの読み込みは、Homeの`fetchSiteData`と同じ公開GETを1回行い、読み込み中（S45-L）→成功（読み込めた内容）／失敗（S45-02）の状態を`#profile-content`の`data-state`（`loading` / `ready` / `error`）と`aria-busy`で示す。HTTP・通信・JSONの失敗、データのrootがobjectでない、`profile`が配列・文字列などobjectでない時は失敗。`profile`が無い（未定義・null）、または項目がすべて空の時は失敗ではなく、名前と依頼の入口だけの`ready`。再読込は同じGETで、通信中は二重要求を防ぎ、古い応答と離脱後の応答で今の表示を上書きしない。 |
| R45-07 | Contactの`main`は、見出し「contact」、導入文（Body sm・`--ink-muted`）、名前・e-mail・内容の3項目、送信ボタンの順。フォームは1440pxで幅560、390pxで幅いっぱい（358）、縦並び間隔20。各項目は、ラベル（Label）と入力欄（高さ52、padding 12/16、白、1px `--color-gray-300`、角丸12、文字Body 16/26）で、内容の欄は高さ136以上の複数行。項目の`id`（`name`・`email`・`message`）と`name`属性（`name`・`_replyto`・`message`）、3項目すべて必須、入力例（placeholder）の文は今のまま。入力例は`--ink-muted`で出す。ラベルと入力欄の間隔は部品Field（`27:84`）の6（マスタの値のまま）。 |
| R45-08 | 送信ボタンは`.site-button--primary`（赤。Contactでいちばんしてほしい操作）で、文言は「送信する」。1440pxは中身に合わせた幅（106×46）、820px以下は幅いっぱい（358×46）。今のContactの`form button`（持ち上げ・赤い影・999の角丸）は使わない。 |
| R45-09 | 導入文と送信先は管理画面のSite > Contactの設定（`contact.introText` / `contact.formAction`）に従う（PS-PC-02）。設定が届くまで（読み込み中、S45-L）導入文の場所を淡い面にして送信ボタンを押せなくし、届いたら導入文と`<form action>`へ反映して押せるようにする。設定が空文字なら今と同じ扱い（導入文は空なら出さない、送信先は埋め込みの値のまま）。設定を読めない時（HTTP・通信・JSON・不正な形。S45-X2）、または8秒以内に届かない時は、知らせを出さず、ページに埋め込まれた導入文と送信先で今のまま送れるようにする。8秒を過ぎて届いた設定は、導入文と送信先にだけ反映する（送信中の操作は妨げない）。JavaScriptが働かない時も、埋め込みの導入文と送信先で今のまま送れる（標準のform送信）。 |
| R45-10 | 送信の仕組みを変えない。送る先は送信の時点の`form`の`action`、方法はPOST、`Accept: application/json`、本文は3項目を入れた`FormData`（キーは`name`・`_replyto`・`message`）、成功の判定は応答の`ok`。`action`が空の時は送らず、失敗（S45-06）として扱う。これらを`test`で縛る（送信は`fetch`を差し替え、networkへ出さない）。 |
| R45-11 | 入力誤り（S45-03）は、ブラウザの標準の知らせではなくページ内で示す（`form`に`novalidate`を付け、`required`と`type=email`は残す）。検査は、名前・e-mail・内容が空または空白だけ、e-mailの形式の誤り（ブラウザの`validity.typeMismatch`。今の標準検査と同じ基準）。誤りの文はその欄のすぐ下（Body sm・`--ink`。赤にしない）、`aria-invalid`と`aria-describedby`でつなぎ、誤りのある欄は`aria-invalid="true"`の時だけ枠を`--ink`の1pxにし、最初の誤りの欄へfocusを移す。誤りがあれば送らない。入力は消さない。欄に入力すると、その欄の誤りを消す。文言は「名前を入力してください。」「e-mailを入力してください。」「内容を入力してください。」「e-mailの形式を確認してください。」（最後の1つ以外はマスタにない案で、figma-fix-requests F45-06）。 |
| R45-12 | 送信中（S45-04）は、送信ボタンを「送信しています…」にして押せなくし（`disabled`。共通の`.site-button:disabled`の不透明度.4をそのまま使い、Contact専用の値は作らない）、3項目は`readonly`にして入力内容をそのまま残す。二重送信を防ぐ（送信中は`submit`が来ても無視する。Enterキーも同じ）。公開に出す文は「送信しています…」だけで、マスタの説明（「ボタンを押せなくし…」）は出さない。読み上げは`role=status`の領域に「送信しています…」を入れる。 |
| R45-13 | 完了（S45-05、PS-PC-04）は、導入文とフォームを完了の表示に置き換える（見出し「contact」は残す）。上から「送信しました。」（Heading 2 20/30）、「お問い合わせありがとうございます。内容を確認して、入力いただいたe-mail宛にご連絡します。」（Body）、送った内容（淡い面、角丸12、padding 16、Body sm。「名前」「e-mail」「内容」の3行、項目名と値の間は全角空白）、「Home →」（`.site-text-link`、Homeへ）。送った内容は送信の時点に取った3項目の値を文字として出し（HTMLとして解釈しない）、内容の改行は保つ。完了の文言は固定で、管理画面では変えない（F45-09）。focusは「送信しました。」へ移す。完了後に続けて送る入口は設けず、再度送る時はContactを開き直す。 |
| R45-14 | 失敗（S45-06、PS-PC-03）は、通信の失敗・HTTPの失敗（`ok`でない）・`action`が空のいずれか。知らせ（依頼の入口と同じ淡い面（R45-05の`--paper-deep`。Figma `color/gray-100`）、角丸12、padding 12/16、文字は`--ink`のBody sm、「送信できませんでした。入力内容は残っています。時間をおいて、もう一度お試しください。」、`role=alert`）を内容欄と送信ボタンの間に出し、送信ボタンを「もう一度送信する」にして押せる状態に戻す。3項目の入力は1文字も消さない。再度の送信は同じ検査と同じ送り方で、成功すれば完了、失敗すれば同じ表示のまま。focusは送信ボタンへ戻す。相手のエラーの内容は画面に出さない。 |
| R45-15 | 読み込み中・誤り・送信中・完了・失敗のどの状態でも、表示名を持つラベルとボタン、見出し階層、キーボードだけの操作、focus-visible（`--ink`の輪郭。赤にしない）が成り立つ。誤り・失敗を色だけで伝えず、文を出す。`prefers-reduced-motion`でも動作が変わらない（動きを足さない）。 |
| R45-16 | 見た目は#42の共通部品（`.site-button`・`.site-chip`・`.site-text-link`・`.site-section-title`・`.home-caption`）を再利用し、同じ役割の部品を作り直さない。色・文字・余白は`DESIGN_RULES.md`のスケールとtokensだけを使い、新しい色・余白値を直書きしない。新しい規則は`body.site-profile` / `body.site-contact`のscopeに閉じ、末尾に足す。旧selector（`.artist-photo`・`.profile-links`・`.application-link`・`.ticket-modal*`・全体の`form`の規則）は、Ticketなど他のページが使うか、既存の「前のCSSのbytesを保つ」試験の対象なので消さない。赤（`--accent`）は、Contactの「送信する」（失敗後の「もう一度送信する」も同じ1つのボタン）と見出しの線だけで、例外は作らない（F45-10は採らない）。入力誤りの文・誤りのある欄の枠・失敗の知らせは赤にしない。Profileには赤の操作を置かない。 |
| R45-17 | Profile・Contact以外を壊さない。ヘッダー・ナビ・フッター・ロゴは#44のbytesのまま。Home・Live・Live詳細・Ticket・Ticket完了・Musicの`main`と、共通のcache query（`20261118-44`）は変えない。Homeのlinks・profile欄の表示、Musicの描画、Live・Ticketの予約処理、管理画面、Cloudflare Workerに変更を広げない。Profile・Contactの現在地がナビで濃色になる既存の仕組み（#44）を保つ。 |
| R45-18 | 振る舞いはNodeの決定論的な試験（依存を足さず、本物のHTMLとscriptを使い、networkに出ない）で縛る。見た目は、Frontが幅1440pxと390px（と中間幅）でfixtureを撮り、数値と画像で確かめる（`ui_route=headless_acceptance:PS-COM-02,PS-PC-03,PS-PC-04,AC45-COMPAT`）。実際の本番の送信は#45のcycleでは行わない（R45-20）。 |
| R45-19 | マスタ・要件メモ・設計書・現行コード・tokensの食い違いは`figma-fix-requests.md`（F45-01〜11）に挙げ、設計書の側で黙って解かない。確認1のAは採用の判断で、Figma更新済みの証拠ではない。Frontが必要なFigmaの整合を記録する。 |
| R45-20 | PRの行き先（base）は`feature/39-public-pages`。Owner決定（2026-11-18、§6）。mergeしても本番には出ず、Cloudflare Workerのdeployも本番の確認もない。Issue・Projectのcloseはまとめ出しのmainへのmerge時で、それまでProject StatusはReview。#43と重なる面を決めた範囲に限る（Code Generation Plan §7）。 |
| R45-21 | 実装で決まる事実（Profile・Contactの行の実装状況、Profileのlinksの扱い、§6・§7）は、設計書の提案版（`public-site-ui.md`と`README.md`、Profile・Contactに関わる所だけ）を確認1で固定し、承認後に同じbytesで昇格する。管理設計は、管理画面・データの形を変えないため更新しない。 |

## 3. 状態と読み込み中

状態は合成できる（例: 写真なしでlinksなし）。全体失敗（S45-02）では写真・文章・linksを出さず、知らせを1つにする。説明用の状態名やマスタの説明文を公開本文へ写さない。

| 安定ID / Figma | 発生条件 | 公開表示と操作 |
|---|---|---|
| S45-01 / `31:402` | Profileの読み込みに成功し、`profile.image`が未登録（空・空白・http(s)でも相対でもない値） | 写真の枠を出さず、名前と文章を幅いっぱいに置く。390pxも縦1列のまま写真だけ無い。 |
| S45-02 / `31:406` | Profileの公開GETが通信・HTTP・JSONで失敗、データのrootがobjectでない、`profile`がobjectでない | 「profile」見出し・名前・依頼の入口はそのまま、写真・文章・linksの場所を「プロフィールを読み込めませんでした。」と`.site-button--secondary`の「もう一度読み込む」だけにする。再読込は二重要求・古い応答を防ぎ、成功したら通常の表示へ、失敗なら同じ表示のまま。再読込後のfocusは、成功なら見出し、失敗なら同じボタン。 |
| S45-03 / `31:413` | Contactの送信ボタンを押した時に、必須欄が空・空白だけ、またはe-mailの形式が誤り | 誤りのある欄のすぐ下に誤りの文（`--ink`）、その欄の枠は`--ink`の1px。最初の誤りの欄へfocus。送らない。入力は残る。 |
| S45-04 / `31:421` | 検査を通り、送信が終わるまで | 送信ボタンが「送信しています…」で押せない（共通の`.site-button:disabled`、不透明度.4）。3項目は`readonly`で内容は残る。二重送信しない。 |
| S45-05 / `31:427` | 送信の応答が`ok` | 導入文とフォームを完了の表示に置き換え、送った内容を出す。「Home →」で戻れる。 |
| S45-06 / `31:435` | 送信が通信・HTTPで失敗、または送信先が空 | 内容欄と送信ボタンの間に知らせ（淡い面`color/gray-100`、赤にしない）。ボタンは「もう一度送信する」。入力は残る。 |
| S45-L / 要件メモ`31:451` | Profile・Contactの初回GET・再読込が未解決 | 見出しと枠を先に出し、Profileは写真の枠と文章の場所を淡い面にして「読み込み中」（status）、Contactは導入文の場所を淡い面にして「読み込み中」を出し、送信ボタンは押せない。`aria-busy=true`。0件や失敗と解釈しない。完了後に淡い面を消す。 |
| S45-X1（マスタにない） | Profileの写真が登録されているが読み込めない（load error） | S45-01と同じ見え方（枠を出さず文章を広げる）。空の枠は残さない。 |
| S45-X2（マスタにない） | Contactの設定（導入文・送信先）を読めない、または8秒以内に届かない | 知らせは出さず、埋め込みの導入文と送信先で今のまま送れる（送信ボタンは押せる）。 |

マスタの状態frameは幅640の見本だけで、390pxの見え方、完了の置き換え、失敗の知らせの位置、必須欄が空の時、読み込み中、Contactの設定を読めない時は描かれていない。上の表はそれを補う採用案で、`figma-fix-requests.md`のF45-06〜08に対応する（390pxの完了・失敗、読み込み中などのframeは足さず、要件メモの文で示す）。

## 4. 受入条件と証拠

要件メモ「受入条件」`31:460`の4項目は次のとおり対応する。

| 要件メモ`31:460` | 対応 |
|---|---|
| 今のProfileにある写真、プロフィール文、SNSリンクが、すべて残っている | PS-PC-01 |
| 今のContactの入力項目（名前、e-mail、内容）と、管理画面で変えられる導入文・送信先が、すべて残っている | PS-PC-02 |
| 送信に失敗しても、入力した内容が消えない | PS-PC-03 |
| 送信できた時、送った内容を画面で確認できる | PS-PC-04 |

| ID | 成立条件 | 必要な証拠 |
|---|---|---|
| PS-PC-01 | 今のProfileの写真・文章・SNSリンクがすべて残り、マスタの構成になっている。 | T45-PROF：fixtureで写真（大文字拡張子の相対path、更新version付き）、文章の段落と改行と行頭「・」と`<`の文字、links（Site 5件・Profile 4件、Bandcampなし、Siteと同じ行き先、5種類以外のProfile 2件）、依頼の入口。今のProfileに出ていたリンクが1件も減らず同じ並びで先頭にあること。Home側のlinks試験が無変更で通る。 |
| PS-PC-02 | Contactの3項目と、管理画面で変えられる導入文・送信先が残る。 | T45-CON-SETTINGS：実HTMLの3項目の`id`・`name`・`required`、導入文と`action`の反映、空の設定、読み込めない時と8秒の時の埋め込み値、設定が届くまで送信不可、JS無しで標準のform送信が残る構造。T45-CON-SEND：送る先・メソッド・ヘッダー・キー3つが今のまま。 |
| PS-PC-03 | 送信に失敗しても入力が消えない。 | T45-CON-FAIL：通信失敗・HTTP失敗・送信先が空の各場合に、3項目の値が同一、知らせ・「もう一度送信する」・focus、再送で成功すれば完了。 |
| PS-PC-04 | 送信できた時、送った内容が画面で分かる。 | T45-CON-DONE：完了の表示に3項目が文字として出る（`<`・`&`・改行を含む値でHTMLにならない）、送信後に欄を書き換えても出る値は送信時のまま、「Home →」、focus。 |
| PS-COM-02（Profile・Contact分） | S45-01〜06・L・X1・X2の表示・非表示・復元が仕様どおり。 | T45-PROF-STATE・T45-CON-VALID・T45-CON-SEND・T45-CON-FAIL・T45-CON-DONE・T45-CON-DOUBLE：全状態と、再読込の二重要求・古い応答・離脱、二重送信、Enterキー、必須欄が空・形式誤りの各場合。状態の外観は幅1440pxと390pxの画像。 |
| PS-COM-01（#45分） | ヘッダー・ナビ・Menuが#44のまま、Profile・Contactが現在地。 | T45-SHELL：ProfileとContactのheader・nav・logo・footerが基準commit（`ba12401`）とbytes一致、スクリプトの読込順、現在地。390pxのMenuを開いたProfile・Contactのsmoke画像。 |
| AC45-LINKS | Profileのlinksの扱い（R45-04）が本番の形で崩れない。 | T45-PROF-LINKS：本番の形（Site 5・Profile 4・全件がSiteの5サービスのどれか）で5件のまま、Siteだけ・Profileだけ・両方・5種類以外・重複・不正URLの各場合の件数と並び。 |
| AC45-COMPAT | Profile・Contact以外の本文・外枠・送信の仕組み・データ・Workerが変わらない。 | T45-COMPAT：4ページ（Live・Live詳細・Ticket・Ticket完了）の`main`が基準commitとbytes一致、Homeの`main`が#44と同じ、共通のcache queryが変わらない、`admin/`・`cloudflare/`・`assets/js/live-operations.js`・`music-data.js`・`DESIGN_RULES.md`・tokensが基準commitとbytes一致、Home・Music・Live・Ticketの既存試験が無変更で通る。 |
| AC45-STYLE | 新しい規則が範囲内で、赤が許可された所だけ。 | T45-STYLE：基準commitのCSSのbytesが先頭に残る、追加分の選択子がすべて`body.site-profile` / `body.site-contact`のscope、直書きの色・非スケールのpxがない、`--accent`は送信ボタン（既存部品）と見出しの線以外にない（`--accent-soft`も使わない）、非スケールのpxは次の2つだけ許可し（選択子とpropertyまで限る）、`.site-profile`の紹介の列の間隔56・内容の幅560と、Contactの項目（ラベルと入力欄）の間隔6の2か所、全体の`form`の規則（持ち上げ・赤い影）がContactで打ち消される。1440/390の撮影数値。 |
| AC45-PROD | 本番データの件数・形でProfile・Contactが崩れない。 | 確認2の前にFrontが本番の公開データを読むPC画面で確認（時刻・revision・件数・成否だけを記録）。本文・URL・送信先の値はrepoに残さない。Contactの送信は試さない。 |
| AC45-RELEASE | まとめ用branchへのPRと公開・close・rollbackの区別が明確。 | PRのbase、Project Review、Owner merge gate、2種類のrollback、#43との重なり面を、計画と独立reviewで確認。 |

## 5. 本番公開データから分かったこと（件数と形だけ）

分類は2026-11-19の14時台（JST）に取得した公開データに基づく（`meta.updatedAt`は`2026-11-17T23:44:01.468Z`で、#44の取得時から変わっていない）。元の値はscratchにだけ置き、fixtureはすべて架空の値にする。

- Profileの文章は、空行で区切った段落が2つ（段落内に改行あり）。行頭に「・」を使う行がある。Markdownの記号・URL・HTML・絵文字・全角スペースはない。1段落目は人の名前に当たる行から始まる、と分類にある（R45-03のとおり登録どおりに出すため、固定の名前の表示と並んだ時に名前が2回出る可能性がある。確認2前にFrontが本番の表示で確かめ、重なる時は管理画面の文章を直すのはOwner。コードでは文章を加工しない）。
- 写真は値があり、相対pathで拡張子は大文字。写真の元の比率は未確認（枠は`cover`で切り抜く）。
- Profileのlinksは配列4件（`name`と`url`）で、Bandcampはない。Siteのlinksは5件ですべて非空、Profileの4件はSiteの5件のサービスに含まれる（host単位の確認）。URLの文字列が同一かは確認できていない。Homeの判定ではProfileのページは今5件を出す。#45の判定（R45-04）でも本番の形は5件のままのはずで、確認2前にFrontが5件であることを確かめる。
- Contactの導入文は1段落（改行なし）。送信先はFormspree形式のendpoint。
- 送信先は管理画面の設定のほかに、`contact/index.html`にも埋め込みの既定がある。#45は埋め込みの既定のbytesを変えない（設定を読めない時の送信先であるため。R45-09）。
- 本番の値（文章・URL・送信先のid）をrepoの文書・fixture・試験・承認の提示文に写さない。

## 6. 承認とまとめ出し

確認1はRequirements・Workflow Plan・Code Generation Planの3つのexact digestと、計画に含む設計提案版（`public-site-ui.md`・`README.md`）のbytes、Figma整合案（F45-01〜11）を対象にする。5 gateすべてItsuki Matsumotoの本人回答`A`を必要とし、VECTORは承認者にならない。確認1前はRequirements承認待ちで止め、昇格・コード・試験の変更を行わない。

確認1の承認後に設計書の提案版をbytesのまま昇格して実装・試験する。Frontのfixture撮影、確認2前の本番公開データでの画面確認、設計と実装をまとめた独立review1回・修理を経て、確認2でCode Generation Result・Build/Test Resultを提示する。ItsukiにはPC・スマホのURLを毎回渡し、確認2の閲覧は任意。必須の本人の画面確認はまとめ出しの前の1回。画面の未確認を実施済みと記録しない。

Owner決定（2026-11-18）：公開側の#43・#44・#45は`feature/39-public-pages`へ集約し、最後にmainへ1回で出す。repo規定（worktreeは`origin/main`から作る、PR baseはmain）との違いは、この明示例外による。今回のbase commit `ba124011ce5e0ae56ddb1c6ac47d1783600687b4`は`origin/feature/39-public-pages`で、#44のPR #51をmerge済み。#45のmergeで本番は変わらず、Cloudflare Workerのdeploy・本番の確認も行わない。Git操作・外部管理操作・Owner対話・承認記録はFront、merge・本番反映・PR承認はItsuki。本番のContact送信は#45では行わず、まとめ出し後に1回試すかどうかは、まとめ出しへ渡す推奨（Code Generation Plan §9）に基づきItsukiが決める。

## 7. 未確認事項と解消責任

- 写真の元の比率・本番の文章の見え方・linksが5件であること・名前の二重表示の有無は、確認2前にFrontが本番の公開データで確かめる。値はrepoに残さない。
- Figmaのrender PNGは読んだが、画像との画素の比較は行っていない。数値（spec）と文言を根拠にし、Frontが撮影した画像と寸法を照合する。fontが同じ環境でない時は、文字の受入を未確認として残す。
- マスタの390pxの完了・失敗、必須欄が空の時、読み込み中、Contactの設定を読めない時は描かれていない。採用案をF45-06〜08に固定し、確認1の採否に含める。390pxの完了・失敗と、読み込み中・設定を読めない時・写真だけ失敗の状態のframeは足さず、要件メモ`31:451`（振る舞い）と`31:454`（狭い幅）の文で示す。
- 通信が応答しない時、送信中の表示が続く（今のContactも同じ）。送り方を変えないため、時間切れは設けない。送信がサーバーに届いたかを画面で確かめる手段はない。
- ブラウザの標準のe-mail検査（`typeMismatch`）に従うため、「example@」のような明らかな誤りは検出するが、`a@b`のような形は通る（今の標準検査と同じ）。
- Formspree側の入力検査エラー（HTTP 4xx）は画面では「送信できませんでした」の1種類になる。相手のエラーの詳細は出さない。
- Worker sandboxはlocalhostをbindできないため、後続Workerは撮影script・fixture・手順を用意し、Frontが実行する。今回の`ui_route=none`。実装承認・独立review・Owner承認・Front completionは未成立である。
- 追加のOwner価値判断はない（Q45-01は、赤の範囲を例外なしにしたFD1で無くなった）。許可外の操作、データの形・保存・Workerの変更が必要になればBLOCKEDでFrontへ返す。
