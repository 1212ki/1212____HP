# Code Generation Plan — ProfileとContactの新しい見た目（Issue #45）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-19_issue-45_profile-contact`
- Execution target: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-45-profile-contact`
- Branch: `feature/45-profile-contact` / base `ba124011ce5e0ae56ddb1c6ac47d1783600687b4`
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 1. 到達点と責任

Profileで写真・文章・links・Contactへの入口を新しい構成で確かめられ、Contactで入力誤り・送信中・完了・失敗がページ内に示され、失敗しても入力が消えず、完了で送った内容が分かる状態を作る。実装入力はRequirements R45-01〜21、S45-01〜06・L・X1・X2、Approved設計、Figma整合案F45-01〜11。原典はauditに固定する。1つの実装単位`aidlc-integration`として8段で作り、内部工程ごとに別Workerを起動しない。

確認1でItsukiがgate 1〜3と、本計画に含まれる設計提案版2文書・Figma整合案を承認し、Frontが承認記録を作るまで実装しない。後続Workerは昇格・コード・試験・撮影scriptを持ち、Frontが画像撮影・目視・本番公開データの画面確認・独立review手配を持つ。結果を確認2（gate 4・5）へ出す。Owner確認・review・Front completionは別であり、Workerは自己承認・再委任・Git writeをしない。

## 2. 採用する設計

### 決定と理由（Frontの判断VF1〜VF12の具体化と、Workerが決めた点）

| 項目 | 決定 | 理由 |
|---|---|---|
| 範囲 | `profile/index.html`・`contact/index.html`の`main`、`contact.js`、`site-content.js`のProfile・Contactの読み込みと描画、CSSの追加、試験。ヘッダー・ナビ・フッターは触らない。 | Issue #45の範囲どおり。外枠は#44の持ち分。 |
| 送信の仕組み | 送る先（`<form action>`）、POST、`Accept: application/json`、`FormData`、キー`name`・`_replyto`・`message`、成功は`res.ok`。変えない。試験で縛る。 | 対象外（Issue）。PS-PC-02。 |
| Profileのlinks | Homeと同じ`buildSharedLinks`（Site優先・Profile補完、5種類）を先に出し、続けて5種類に当たらないProfileのリンクを登録順に出す。同じ行き先は1つ。Siteと同じサービスのProfile側は出さない（Homeと同じ）。表記はBandcamp。 | PS-PC-01は「今出ているリンクが減らない」ことで、今のコードはSiteのlinksが1件でもあると5種類以外のProfileのリンクを出さない。マスタ`31:451`の「続けて出す」を5種類以外に限って足し、今の5種類は変えない。本番の形（Profile 4件がSiteの5サービスに含まれる）では5件のまま。Homeの表示と試験は変えない。 |
| 文章 | `textContent`＋`white-space: pre-wrap`。改行の表記ゆれ（CRLF・CR・文字列`<br>`）だけ今のProfileと同じく改行へ揃える。 | 「登録された文章をそのまま」。段落ごとに`<p>`へ割ると連続した空行が消える。HTMLとして解釈しない（本番の文章は段落2つ・段落内の改行・行頭「・」）。 |
| 写真の失敗 | 読み込めなければ枠ごと消し、写真なしと同じにする（S45-X1）。読み込み中は枠を淡い面で確保する。 | マスタに状態がない。空の枠や「写真」の文字を公開に出さない。 |
| Contactの設定 | 設定が届くまで送信ボタンを押せなくし、最長8秒で埋め込みの導入文・送信先へ切り替える。読めない時は知らせを出さず埋め込みの値で送れる。 | 連絡できなくなる方が、設定が古い可能性より重い。今の挙動（読めなくても送れる）を保つ。応答が止まったままでも送れなくならない。 |
| 入力誤り | `novalidate`にしてページ内に出す。必須の空と形式の誤り。形式は`validity.typeMismatch`（今の標準検査と同じ基準）。 | マスタ`31:413`は標準の知らせではなくページ内の表示。新しい検査基準は作らない。 |
| 送信中 | 送信ボタンを無効化、3項目を`readonly`、送信中の`submit`は無視。ネットワークの時間切れは設けない。 | 「ボタンを押せなくし、入力内容はそのまま残す」。時間切れで中断するとサーバーに届いて重複する恐れがあり、送り方を変えることになる。 |
| 完了 | フォームを置き換え、送信時点の3項目の値を文字で出す。続けて送る入口は設けない。完了の文言は固定。 | PS-PC-04。マスタ`31:427`に続けて送る操作はない。文言を管理画面に出すとデータの形が変わる。 |
| 失敗 | 通信失敗・HTTP失敗・送信先が空。固定の文言、ボタンは「もう一度送信する」。相手のエラーの詳細は出さない。 | PS-PC-03。マスタ`31:435`は固定の文言。 |
| 旧selector・旧コード | 消さない: 旧`renderProfile`・`renderContact`（`site-content.js`）、`.artist-photo`・`.profile-links`・`.application-link`・`.ticket-modal*`・全体の`form`の規則（CSS）。書き換える・外す: `contact.js`（全面的に書き換え）、`contact/index.html`の重ねて開く表示（`contactConfirm*`）。 | 既存の試験（前のCSSのbytesを保つ）と、Ticketなど他ページの利用のため。#43が`site-content.js`の`boot()`とCSS末尾を同時に触るので、不要コードの整理はまとめ出しの後の別Issueに回す。重ねて開く表示のHTML（`contactConfirm*`）は`contact/index.html`から外す。 |
| cache query | 共有assetの`?v=20261118-44`は変えない。`contact.js`だけ`?v=20261119-45`を付ける（Contactしか読まない）。 | 全10ページの同じ行を#43と同時に触ると毎回衝突する。静的hostingはqueryを無視して現在のファイルを返す。公開前のまとめ出しで1回、全ページを揃えて上げる（§9）。 |
| 設計書 | 提案版2文書（`public-site-ui.md`・`README.md`）。`live-operations-admin-ui.md`は更新しない。 | 実装で決まる事実を設計へ反映する。管理画面・データの形を変えないため管理設計は変わらない。 |

### Profileの構造と描画

`profile/index.html`は`<body class="site-profile">`にし、`main`を次の構成にする（`id`・`class`は固定。マークアップの細部は後続Workerが決める）。

- `main#profile-content.profile-container`（`data-state` = `loading | ready | error`、`aria-busy`はJSが付ける。JSが無い時の表示を壊さないため、HTMLの初期値には`data-state`と`aria-busy`を持たせない）
  - `h1.site-section-title`「profile」
  - `div.profile-intro`
    - `div#profile-photo.profile-photo`（`hidden`が初期値）の中に`img#profile-image`（alt「松本一樹」）
    - `div.profile-body`: `div.profile-name`（`h2`「松本一樹」、`p`「itsuki matsumoto」）、`div#profile-state`（読み込み中・失敗の表示場所）、`p#profile-text.profile-text`（`hidden`）、`div#profile-links-block`（`hidden`、`h2.home-caption#profile-links-title`「links」と`div#profile-link-list`）、`div.profile-contact-entry`（「出演のご依頼・お問い合わせ」と`a.site-button.site-button--secondary`「Contactへ」`href="../contact/"`）

名前の2行と依頼の入口は固定の文字・リンクで、JSが無い時も表示される。写真・文章・linksはJSが公開データから入れる。`site-content.js`は、Musicの分岐の次に`if (document.getElementById("profile-content")) { wireProfile(); return bootProfile(); }`を足す（Profile専用の1回のGET。他の欄の描画は行わない。footerは既存`renderSite`）。実装は`boot()`の直前に「Issue #45」の見出しコメントを付けた1つのまとまりとして置き、`boot()`への差分は分岐の2行だけにする。Musicのコード・既存`renderProfile`は触らない（Profileページはもう通らない）。

`bootProfile`: 開始時に`data-state=loading`・`aria-busy=true`、`#profile-photo`を淡い面で表示、`#profile-state`に`<p role="status">読み込み中</p>`（淡い面）を入れる。`fetchSiteData()`を待ち、世代番号（serial）が古ければ捨てる。成功なら`ready`、`#profile-state`を空にして写真・文章・linksを入れる。失敗なら`error`（`#profile-state`に「プロフィールを読み込めませんでした。」と`button.site-button.site-button--secondary[data-profile-action=retry]`「もう一度読み込む」）、写真・文章・linksを出さない。失敗の判定は、`payload`がnull、データがobjectでない（配列を含む）、`data.profile`が配列・文字列などobjectでない（未定義とnullは無いものとして扱う）。`data.profile`が無い（未定義・null）・空のobjectは`ready`で、名前と依頼の入口だけが残る。再読込は、押すと無効化して同じGETを行い、通信中の二重要求を防ぎ、`pagehide`で世代を進めて通信中の表示を解き、`pageshow`の`persisted`で中断していれば読み直す（Musicと同じ作法）。再読込後のfocusは、成功なら`h1`（`tabindex=-1`）、失敗なら再度出たボタン。

写真: `profile.image`を`safeHomeUrl(value, true)`（http(s)または相対）で検査し、`resolveImageSrc(value, version)`で解決する。検査に落ちたら未登録として扱う。`onload`で枠を表示のまま確定、`onerror`（`error`イベントは`img`に直接付ける）で`#profile-photo`を`hidden`にする。読み込み中は枠を表示して淡い面のままにし、`onerror`のときだけ消す（レイアウトの跳ねは許容）。

文章: `String(text).replace(/\r\n?/g, "\n").replace(/<br\s*\/?>/gi, "\n")`を`textContent`へ入れる。空白だけなら`#profile-text`を`hidden`のまま。Homeの`home-profile-text`の処理は変えない。

links: 新しい純関数`buildProfileLinks(siteLinks, profileLinks)`を足す（`boot()`の直前のまとまりの中）。
1. `shared = buildSharedLinks(siteLinks, profileLinks)`のうち、`safeHomeUrl(url, false)`を通るものを`{label, url}`の並びにする（表記は`entry.label`）。
2. 残りは、Profileのリンク（登録順）のうち、`name`が5種類のどれにも当たらないもの（`findProfileLink`と同じ別名の判定。`buildSharedLinks`が使うのと同じ述語を共有する）で、`safeHomeUrl`を通り、正規化したURL（`new URL(raw).href`の末尾の`/`を除いたもの）が既に出したどれとも異なるもの。表記は`name`（空ならURLのhost）。
3. 1と2を連結する。5種類のうち`buildSharedLinks`が出すものは今と同じ順で先頭にある。

実装はmarkupを`.site-chip`の`<a>`（`target=_blank`、`rel="noopener noreferrer"`、`aria-label`は「<表記>（外部サイト・別タブ）」）として作り、値はHTML escapeする。`#profile-links-block`はリンクが1件もなければ`hidden`。`name`に5種類の別名が含まれるだけの名前（例: 名前に「x」を含むもの）の判定は`findProfileLink`の既存の判定（部分一致を含む）をそのまま使い、直さない（Homeの判定と同じにするため。直す場合はHomeの試験を変えるので別Issue）。

### Contactの構造・設定・送信

`contact/index.html`は`<body class="site-contact">`にし、`main`を次の構成にする。`<form>`の`action`属性の値と`#contact-intro`の埋め込みの文は、現行の`contact/index.html`から1文字も変えずに写す（この文書には値を書かない）。

- `main#contact-content.contact-container`（`data-settings` = `loading | ready | fallback`はJSが付ける）
  - `h1.site-section-title`「contact」
  - `div#contact-panel.contact-panel`
    - `p#contact-intro.contact-intro`（埋め込みの導入文）
    - `form#contact-form.contact-form`（`action`は埋め込みのまま、`method="POST"`、`novalidate`）: 3つの`div.contact-field`（`label`と、`input#name[name=name]`・`input#email[type=email][name=_replyto]`・`textarea#message[name=message][rows=5]`。`required`と`placeholder`は今のまま、それぞれの下に`p.contact-error[hidden]`）、`div#contact-failure.contact-failure[role=alert][hidden]`、`button#contact-submit[type=submit].site-button.site-button--primary`「送信する」
    - `div#contact-done.contact-done[hidden][tabindex=-1]`
  - `p#contact-status.contact-sr[role=status]`（視覚的に隠した読み上げ用）

`#contactConfirm*`（overlay・modal）はHTMLから外す。`script`は`site-config.js`、`site-content.js`、`contact.js?v=20261119-45`、`script.js`の順（今と同じ）。

`site-content.js`: `if (document.getElementById("contact-content")) return bootContact();`を`boot()`に足す。`bootContact`は、`data-settings=loading`・`aria-busy=true`にし、導入文の場所を「読み込み中」の淡い面にして（埋め込みの文は変数に保存）、`#contact-submit`を`disabled`にする（送信中は`form.dataset.submitState === "sending"`を見て有効化しない）。8秒のタイマー（`setTimeout`）を置き、先に来たほうで`fallback`または`ready`にする。`fetchSiteData()`が成功し、データがobjectで`contact`がobjectまたは未定義なら、既存`renderContact`と同じ意味で反映する（`introText`が空なら導入文は出さない、`formAction`が空なら埋め込みの`action`のまま）。`data-settings=ready`・`aria-busy=false`・送信ボタンを有効化。失敗、不正な形、8秒の時間切れは、埋め込みの導入文を戻し、`fallback`にして送信ボタンを有効化する（知らせは出さない）。時間切れ後に来た成功の応答は、導入文と`action`にだけ反映し`ready`にする。既存`renderContact`は、Contact以外の経路で呼ばれなくなるが残す。

`contact.js`は全面的に書き換える（旧ファイルはoverlayの処理だけで、`submitToFormspree`の送り方は新しいコードへそのまま移す）。構造は次のとおり。
- 初期化（`DOMContentLoaded`）: `#contact-form`がなければ何もしない。`submit`・各欄の`input`を結ぶ。
- `submit`: `preventDefault`。`data-submit-state === "sending"`、または`#contact-content`の`data-settings === "loading"`なら何もしない。入力の検査（空・空白だけ、e-mailは`validity.typeMismatch`）。誤りがあれば欄ごとの`p.contact-error`に文を入れ（`hidden`を外し）、欄に`aria-invalid="true"`と`aria-describedby`、最初の誤りの欄へ`focus()`、`data-submit-state="invalid"`、送らずに終わる。誤りがなければ、全誤りを消し、送信時の値（`FormData`から取った`name`・`_replyto`・`message`）を控え、`data-submit-state="sending"`、ボタンを「送信しています…」＋`disabled`、3欄を`readonly`、`#contact-failure`を隠し、`#contact-status`に「送信しています…」を入れる。`action`は`form.getAttribute("action")`の送信の時点の値。空なら送らず失敗へ。`fetch(action, { method: "POST", headers: { Accept: "application/json" }, body: formData })`。`res.ok`なら完了、そうでなければ（`json`の解析は今のまま試みてよいが結果は使わない）失敗。例外も失敗。
- 完了: `data-submit-state="done"`。`#contact-intro`と`form`を`hidden`、`#contact-done`に見出し「送信しました。」（`h2`）、お礼文、送った内容、`a.site-text-link`「Home →」（`../`）を入れて表示、見出しへfocus。送った内容は控えた値を`textContent`で入れ、内容の改行は`white-space: pre-wrap`で保つ。3欄は`readonly`を外す前に値をクリアしない（完了後はフォームが隠れているだけ。`form.reset()`はしない）。
- 失敗: `data-submit-state="failed"`。`#contact-failure`を表示（固定の文言）、ボタンを「もう一度送信する」＋有効、3欄の`readonly`を外す。値は1文字も変えない。focusを送信ボタンへ。`#contact-status`に失敗の文言は入れない（`role=alert`が読み上げる）。
- `input`: その欄の`aria-invalid`・誤りの文を消す。

`bootContact`が送信ボタンを有効化する経路と`contact.js`が無効化する経路が競合しないよう、無効化の根拠を2つの属性（`data-settings=loading`、`data-submit-state=sending`）で持ち、どちらかが成り立つ間は有効にしない。

### 見た目（CSS）

`assets/css/style.css`の末尾に、`/* Issue #45: Profile and Contact. */`の見出しコメントのまとまりを1つ足す。全選択子を`body.site-profile`・`body.site-contact`の下に置く。既存のbytesを1つも変えない。使う値は`DESIGN_RULES.md`のスケール（4, 8, 12, 16, 24, 32, 48, 64, 80）とtokens・既存の変数（`--paper`・`--paper-deep`・`--ink`・`--ink-muted`・`--accent`・`--line`・`--space-*`・`--radius-card`・`--radius-button`・`--color-gray-300`・`--max-width`）。新しい色・pxの直書きをしない（`1px`の線、`364px`・`52px`・`136px`・`358`などマスタの寸法として決まっているものを除く。後者は試験で値を列挙して縛る）。スケール外の`56`と`6`は、マスタの値として次の2か所だけ使い（tokensに無い値を新しいtokenにしない）、選択子とpropertyまで試験で縛る：`body.site-profile`の紹介の横並びの`gap: 56px`（内容の幅は`flex: 1 1 0`で560になる）、`body.site-contact`の項目（ラベルと入力欄を縦に並べる要素）の`gap: 6px`（FD2）。

| 項目 | 値（1440px→820px以下） | 根拠 |
|---|---|---|
| 本文の幅と余白 | `width: min(calc(100% - 32px), var(--max-width))`、`margin: 0 auto`。上下64→32、要素の間隔32→24（Profile）、24（Contact） | `31:258`・`31:300`・`31:347`・`31:376` |
| 見出し | `.site-section-title`（既存）。`margin-bottom`は0にして間隔で取る | Musicと同じ作法 |
| Profileの紹介 | 820超: 横並び、写真`flex: 0 0 364px`・`aspect-ratio: 4 / 5`、内容`flex: 1 1 0`（幅560）、間隔56（マスタの値。F45-11は採らない。364＋56＋560＝980）。820以下: 縦並び、写真は幅いっぱい・`aspect-ratio: 1`（358×358）、間隔24 | `31:262`・`31:263`・`31:304`・`31:305` |
| 写真の枠 | `--paper-deep`、角丸`--radius-card`、`overflow: hidden`、`img`は`object-fit: cover`・中央。読み込み中は淡い面のまま | `31:263` |
| 名前 | 「松本一樹」は`500 28px/42px`、「itsuki matsumoto」は`400 14px/22px`・`--ink-muted`、間隔4 | `31:266`〜`31:268` |
| 文章 | `400 16px/26px`、`white-space: pre-wrap`、`overflow-wrap: anywhere`、色`--ink` | `31:269` |
| links | `.home-caption`の見出し、チップ（`.site-chip`）は`display:flex; flex-wrap: wrap; gap: 8px`、見出しとの間隔8 | `31:274`・`31:276` |
| 依頼の入口 | `--paper-deep`、角丸16、padding 24、縦、間隔12、`align-items: flex-start`。ラベルは`500 14px/22px`・字間.04em・`--ink` | `31:287`・`31:329` |
| Contactのフォーム | 820超: 幅560、820以下: 幅100%。縦、間隔20 | `31:351`・`31:380` |
| 導入文 | `400 14px/22px`・`--ink-muted`。読み込み中は`--paper-deep`の面に「読み込み中」 | `31:352` |
| 項目 | ラベルと入力欄の間隔6（部品Field `27:84`の値。F45-11は採らない）、ラベル`500 14px/22px`、入力欄は最小高さ52、padding 12/16、1px `--color-gray-300`、角丸`--radius-button`、背景`--paper`、`400 16px/26px`、placeholderは`--ink-muted`、誤りのある欄（`[aria-invalid="true"]`）の時だけ枠を`--ink`の1px。内容は最小高さ136、縦方向だけ大きさを変えられる | `27:84`・`27:86` |
| 誤りの文 | `400 14px/22px`・`--ink`（赤にしない）、欄の下 | `31:420` |
| 失敗の知らせ | `--paper-deep`（依頼の入口と同じ。Figma `color/gray-100`）、角丸12、padding 12/16、`400 14px/22px`・`--ink` | `31:438` |
| 送信ボタン | 既存`.site-button--primary`。820超は幅を中身に合わせて左寄せ、820以下は`width: 100%`。無効時は共通の`.site-button:disabled`（不透明度.4）をそのまま使い、Contact専用の値を作らない | `31:365`・`31:394`・`31:424` |
| 完了 | 見出し`500 20px/30px`、お礼文`400 16px/26px`、送った内容は`--paper-deep`・角丸12・padding 16・`400 14px/22px`・間隔4、「Home →」は`.site-text-link` | `31:429`〜`31:434` |
| 状態のscope | `body.site-profile`・`body.site-contact`の背景の装飾（`::before`）を切り、選択色・scrollbarをモノクロにし、`[hidden]`は`display:none !important`、focus-visibleの輪郭は`--ink` | `.site-music`と同じ作法 |

既存の全体の`form`・`form label`・`form input`・`form button`の規則（持ち上げ・赤い影・999の角丸・赤いfocusの輪郭と影）は、Contactのscopeで次を明示して打ち消す。`.site-contact .contact-form`の`gap`と`margin-top`、`label`の太さ・大きさ、`input`・`textarea`の`padding`・`border`・`border-radius`・`background`・`font`、`:focus`の`border-color`（`--ink`）・`box-shadow: none`・`outline`（`2px solid var(--ink)`、`outline-offset: 2px`）、`.site-button:hover`の`transform: none`・`box-shadow: none`。送信中の`opacity`は、`.site-button:disabled`（詳細度0,2,0、不透明度.4）が全体の`form button:disabled`（詳細度0,1,2、不透明度.5）より強いため打ち消さず、Contactでは`opacity`を宣言しない。打ち消しは`.site-contact`のscopeに閉じ、Ticketなど他のページの`form`は変えない。この打ち消しは試験（CSSの文字列）とFrontの撮影（hover・focus・disabledの画像と計算値）で確かめる。

## 3. 変更ファイルと設計書の昇格

| path | 変更範囲 |
|---|---|
| `profile/index.html` | `<body class="site-profile">`、`main`のみ（§2のProfileの構成）。ヘッダー・ナビ・フッター・scriptの並びは変えない。 |
| `contact/index.html` | `<body class="site-contact">`、`main`のみ（§2のContactの構成。overlay・modalを外す）、`contact.js`の`?v=20261119-45`。ヘッダー・ナビ・フッター・scriptの並びは変えない。 |
| `assets/js/contact.js` | 全面的に書き換え（§2）。 |
| `assets/js/site-content.js` | `boot()`の直前に「Issue #45」のまとまり（`bootProfile`・`wireProfile`・`buildProfileLinks`・`bootContact`・補助）、`boot()`に分岐2行。既存の関数は変更しない。 |
| `assets/css/style.css` | 末尾に§2の見出しコメントのまとまりを追補。既存のbytesは保持。 |
| 新規`test/profile-rendering.test.mjs`、`test/contact-form.test.mjs`、`test/profile-contact-shell.test.mjs`、`test/fixtures/profile-contact-states.json` | §5のT45試験と架空のfixture。Node標準機能だけで実source・実HTMLを実行する。必要なら共通の仮DOMを`test/`内の補助ファイルへ置く（依存は足さない）。 |
| `test/site-shell.test.mjs` | 最小の改修（§5）。ProfileとContactの`main`のbytes一致の期待を、対象から外して`profile-contact-shell.test.mjs`の肯定的な検査へ移す。#44の末尾CSSの検査の基準を、#44が足した範囲に限る。ヘッダー・ナビ・フッターが基準と同じ検査は残す。 |
| `test/public-music-data-compatibility.test.mjs` | 変えない。新しい分岐で仮DOMが足りず失敗する場合に限り、仮DOMの不足分だけを補う（期待値は変えない）。 |
| `aidlc-docs/construction/aidlc-integration/verification/capture-profile-contact.py`（新規） | Front用の撮影script。#44の`capture-music.py`を雛形にする。 |
| `docs/specs/current/public-site-ui.md`・`README.md` | 下の提案版をexact bytesで昇格。 |

`assets/js/music-data.js`・`live-operations.js`・`home-player.js`・`script.js`・`assets/css/1212-music.tokens.css`・`DESIGN_RULES.md`・`admin/`・`cloudflare/`・`data/`・他のHTMLは変更しない。

### exact bytesの提案版

提案版は昇格後の最終形（Status: Approved、Owner approvalは#45のgate 3を参照）。配置時点では未承認候補であり、Approvedという文字列だけで昇格しない。履歴表や#42・#44の節は保ち、Profile・Contactの実装入力・表示契約・状態・まとめ出しだけを追記・改訂した。

| 提案版（aidlc-docs/から） | 昇格先 | 提案版SHA-256 | 昇格前の元版SHA-256 |
|---|---|---|---|
| `construction/aidlc-integration/canonical-proposals/public-site-ui.md` | `docs/specs/current/public-site-ui.md` | `56fd415e660dc4899dc5d6930e3dd06df2d40c2fd347943b0cdbb93b88184b3f` | `1aa471ebbb9680f762b4bcd2e97788aedd6f259fe82ad67ebc1f8b9e65e30a56` |
| `construction/aidlc-integration/canonical-proposals/README.md` | `docs/specs/current/README.md` | `58453fcc636245bc91367255cfbdcca73a0d9a943c95af0739e2f175907837dc` | `8ecd9e3c00ad1025acf8683417780f7071d8d9d8be29e0bd9a98044c890dea0a` |

手順：確認1の3承認digestと提案版hashを照合→現在の昇格先が表の元版hashであることを確認→対応する提案版のbytesをそのまま昇格先へcopy→提案版と昇格先のSHA-256一致と差分範囲（§3・§5・§6・§7と先頭の記述だけ）を確認→実装開始。文字の置換、日付の追補、書式の変更を昇格時に加えない。#43が先に昇格して昇格先が変化していたら上書きせず停止し、Frontへbase差分を返す。候補の修理と新しいhashの承認で解消してから再開する。Figma整合で意味・採用値が変わった時も同様。

Figma整合案もgate 3の対象に含める：`aidlc-docs/construction/aidlc-integration/figma-fix-requests.md` SHA-256 `510b45af15f987fb2aae21574f1459203c2cd13b925fad24e3bb1e813ea4c7bf`。

## 4. 実装の8段とfocused test

作業前にNode20を選ぶ。以下のcommandはexecution targetから実行し、RED/GREENのexitと対象ACをverification logへ残す。新規試験名は提案で、承認後に作る。承認済みplanには進捗checkboxを足さず、state/resultへ記録する。

```bash
export PATH=/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH
node --version
```

| 段 | 作業とRED→GREEN / focused command |
|---|---|
| 1. 入力と昇格 | cycle・承認・提案版・元版hashを照合し、2つの設計書を同じbytesで昇格。既存`node --test test/site-shell.test.mjs test/home-rendering.test.mjs test/public-music-data-compatibility.test.mjs`をcharacterizationとして実行（不要なREDは作らない）。架空fixture`profile-contact-states.json`と仮DOMの補助を用意する。 |
| 2. Profileの通常表示 | T45-PROF-DATAとT45-PROF-LINKSを先にRED。`profile/index.html`の`main`、`bootProfile`の成功の描画、`buildProfileLinks`をGREEN。`node --test test/profile-rendering.test.mjs test/home-rendering.test.mjs`。Homeのlinksの試験が無変更で通ること。 |
| 3. Profileの状態 | T45-PROF-STATEを先にRED。読み込み中・写真なし・写真の失敗・全体の失敗・再読込（二重要求・古い応答・`pagehide`・`pageshow`）をGREEN。`node --test test/profile-rendering.test.mjs`。 |
| 4. Contactの構造・設定・送る仕組み | T45-CON-SETTINGSとT45-CON-SENDを先にRED。`contact/index.html`の`main`、`bootContact`（設定の反映・読み込み中・8秒・読めない時）、`contact.js`の送信（送る先・メソッド・ヘッダー・キー3つ）を、完了と失敗の最小の経路までGREEN。`node --test test/contact-form.test.mjs test/public-music-data-compatibility.test.mjs`。 |
| 5. Contactのページ内の状態 | T45-CON-VALID・T45-CON-FAIL・T45-CON-DONE・T45-CON-DOUBLEを先にRED。入力誤り・送信中・完了（送った内容）・失敗（入力が残る・もう一度送信する）・二重送信・focus・読み上げをGREEN。`node --test test/contact-form.test.mjs test/profile-rendering.test.mjs`。ProfileとContactの挙動が揃う区切りとして§5の全試験1回目。 |
| 6. 見た目と外枠の保護 | T45-STYLE・T45-SHELL・T45-COMPATを先にRED。CSSの追補（§2の表と打ち消し）、`site-shell.test.mjs`の最小の改修、`profile-contact-shell.test.mjs`をGREEN。`node --test test/profile-contact-shell.test.mjs test/site-shell.test.mjs test/music-rendering.test.mjs test/public-ticket-routing.test.mjs`。 |
| 7. 画面確認の材料と全試験 | Workerが§6の撮影scriptとfixtureの全scenarioを完成させ、構文を検査してFrontへ渡す。§5の全試験2回目。Frontが撮影・metrics・全画像の目視・本番データの画面確認を行う。修理は影響するfocused testと該当画像を再確認し、全体へ波及する新しい変更だけ全試験を追加する。 |
| 8. 結果と独立review | 実ファイル・昇格hash・RED/GREEN・全試験・AC別の証拠・未確認を結果に固定しFrontへ返す。Frontが独立reviewを1回手配し、修理と再検証を結果へ反映して確認2へ提示する。Owner承認を代行しない。 |

段4・5・6では、先行する共有の変更が既存試験を壊したら、その時点で原因を直してから次へ進む。全試験を通すために未移行の保護を消さない。

## 5. 決定論的試験と全試験

fixture `test/fixtures/profile-contact-states.json`は`music-states.json`と同じ形（`meta` / `data` / `scenarios`）。値はすべて架空で、URLは`example.test`、送信先は`https://forms.example.test/f/synthetic`。dataに、段落2つ（段落内の改行、行頭「・」の行、`<`・`&`・`"`を含む1行）の文章、大文字拡張子の相対pathの写真、Profileのlinks 4件（X・Instagram・YouTube・note）、Siteのlinks 5件（Profileの4件のうち1件は同じ行き先、残りは別の行き先）、Contactの導入文1段落と架空の送信先を持たせる。scenarioは`base` / `no-photo` / `broken-photo` / `empty-text` / `no-links` / `site-links-only` / `profile-links-only` / `extra-links`（5種類に当たらないProfileのリンク2件、重複1件、不正なURL1件）/ `empty-profile` / `bad-profile`（`profile`が配列）/ `error`（HTTP失敗）/ `loading`（応答が来ない）/ `contact-empty-settings` / `contact-unreadable`。

| 群 | 必須assert / AC |
|---|---|
| T45-PROF-DATA | 実HTMLのid・構造、写真の`src`（`../`と更新version、大文字拡張子のpath）、文章が`textContent`で登録どおり（空行・段落内の改行・行頭「・」・`<`の文字・CRLFと文字列`<br>`の改行化）、`innerHTML`で入れていないこと、依頼の入口（文言・`href="../contact/"`・Secondary）、名前の固定表示。PS-PC-01。 |
| T45-PROF-LINKS | 本番の形（Site 5・Profile 4・全件がSiteの5サービスのどれか）で5件、並びがHomeの`buildSharedLinks`と同じで、表記が「Bandcamp」。Siteだけ・Profileだけ・両方・5種類以外（登録順に後ろ）・重複（1つ）・不正なURL（出さない）・名前が空（hostを表記）・Profileのlinksが配列でない。基準commit（`ba12401`）の`site-content.js`と`profile/index.html`（`git show`）を同じ仮DOMで動かした「今のProfileの出力」と比べ、どのfixtureでも今の出力の全件が同じ並びで先頭にあること。Homeのlinksの出力が無変更であること。AC45-LINKS・PS-PC-01。 |
| T45-PROF-STATE | S45-01（写真なし、枠が出ない）、S45-X1（`error`イベントで枠が消える）、S45-02（HTTP・通信・JSON・root不正・`profile`が配列で`error`、`ready`にならない）、S45-L（`loading`の表示と`aria-busy`）、`profile`が空のobjectで`ready`、再読込（二重要求なし、古い応答は捨てる、`pagehide`で通信中を解く、`pageshow`の再取得、再読込後のfocus）、Homeのprofile欄が無変更。PS-COM-02。 |
| T45-CON-SETTINGS | 実HTMLの3項目の`id`・`name`・`type`・`required`・`placeholder`、導入文と`action`の反映、`introText`・`formAction`が空、`contact`が無い、読み込み中は送信不可、`fetch`の失敗・HTTP失敗・不正なJSON・不正なrootで埋め込みの値のまま送信可（知らせなし）、8秒（差し替えた`setTimeout`）で埋め込みの値のまま送信可・遅れて来た成功を反映、JS無しで標準のform送信が成り立つ構造（`action`・`method`・`name`が埋め込みのまま）。PS-PC-02・S45-L・S45-X2。 |
| T45-CON-SEND | `fetch`の差し替えで、送る先が送信の時点の`action`、`method=POST`、`headers.Accept=application/json`、`body`が`FormData`でキーが`name`・`_replyto`・`message`だけ、値が入力のまま。networkへ出ない（`fetch`以外の通信がない）。旧`contact.js`の送り方と同じ。R45-10。 |
| T45-CON-VALID | 3欄が空・空白だけ・e-mailの形式の誤りの各場合に、`fetch`が呼ばれない、欄ごとの文（F45-06の文言）、`aria-invalid`・`aria-describedby`、最初の誤りの欄へfocus、入力値が残る、入力で当該の誤りが消える、誤りが解消すれば送る。S45-03。 |
| T45-CON-FAIL | 通信の例外・HTTP 4xx/5xx・`action`が空の各場合に、3項目の値が同一、知らせ（固定の文言・`role=alert`）、ボタンが「もう一度送信する」で有効、`readonly`が外れる、focusがボタン、再送で成功すれば完了、再び失敗すれば同じ表示。PS-PC-03・S45-06。 |
| T45-CON-DONE | `res.ok`で、導入文とフォームが隠れ、完了の表示（見出し・お礼文・送った内容3行・「Home →」の`href="../"`）、送った内容が文字で入る（`<script>`・`&`・改行を含む値で`textContent`、子要素が増えない）、送信後に欄を書き換えても表示は送信時の値、focusが見出し。PS-PC-04・S45-05。 |
| T45-CON-DOUBLE | 送信中に`submit`を再度発火しても`fetch`は1回、ボタンは無効で「送信しています…」、3欄は`readonly`で値が残る、`#contact-status`に読み上げの文、設定の読み込み中の`submit`は無視、完了・失敗の後に状態が戻る。S45-04。 |
| T45-STYLE | 基準commit（`ba12401`）のCSSのbytesが先頭に残る。追加分の選択子がすべて`body.site-profile`または`body.site-contact`で始まる。直書きの色（`#`・`rgb`）がない。`--accent`の使用が、追加分のCSSに1つもない（赤は既存部品の`.site-button--primary`と見出しの線だけ。`--accent-soft`も使わない）。非スケールのpxが、上の2つ（Profileの紹介の`gap: 56px`、Contactの項目の`gap: 6px`）以外にない。誤りのある欄の枠は`[aria-invalid="true"]`の時だけ`--ink`の1px。§2の表の主な寸法（364・4/5・1・52・136・560・820の分岐）と、全体の`form`の規則を打ち消す宣言（`transform`・`box-shadow`・`outline`・`:disabled`の`opacity`は宣言しない。共通の`.site-button:disabled`が効く）が入っている。旧selectorが残っている。AC45-STYLE。 |
| T45-SHELL | ProfileとContactの`<header>`・`<nav>`・ロゴ・`<footer>`が基準commit（`ba12401`）とbytes一致、scriptの並び（`site-config`→`site-content`→（Contactは`contact.js`）→`script`）、現在地の表示、ナビ5項目。PS-COM-01（#45分）。 |
| T45-COMPAT | Live・Live詳細・Ticket・Ticket完了の`main`と、Homeの`main`が基準commitとbytes一致。`admin/`・`cloudflare/`・`assets/js/live-operations.js`・`music-data.js`・`home-player.js`・`script.js`・`DESIGN_RULES.md`・tokensが基準commitとbytes一致。共有assetのcache query（`20261118-44`）が全10ページで変わらない。AC45-COMPAT。 |

`test/site-shell.test.mjs`の基準commitは#44の`080325887576655f27461cb15f28a3c590a292ee`。#45では次の最小の改修だけを行う。(1) 「Home・Music・旧2ページ以外の`main`がbaseとbytes一致」の例外にProfileとContactを足す（検査は`profile-contact-shell.test.mjs`が肯定的に行う）。(2) #44の末尾CSS（Musicのscope）の検査3つ（`T44-STYLE/COMPAT`、`T44-STYLE PC release player`、`T44-STYLE PC video`）が`css.slice(old.length)`を使う所を、「#44が足した範囲」（`ba12401`のCSSから`0803258`のCSSを除いた末尾）に限る。(3) それ以外（nav・ロゴ・script・現在地・`T42-SHELL`・`T44-COMPAT`・`T44-ADMIN`・前のCSSのbytes保持）は変えない。「削って合わせる」ことはしない。

全試験は段5・段7の後に実施。baselineはFront着手前の報告でnode 513 pass / 0 fail、Worker 347 pass / 0 fail。実装後の件数を固定せず、command・exit・pass・failを記録する。

```bash
node --test test/
npm --prefix cloudflare/worker test
node --check assets/js/site-content.js
node --check assets/js/contact.js
node --check assets/js/script.js
scripts/aidlc-verify.sh --local
scripts/aidlc-cycle.sh status
git diff --check
git status --short
```

Node24では`node --test test/`が動かないため、指定のNode20を使う。静的サイトのため別のbundle buildはない。`scripts/aidlc-verify.sh --local`が使うtempとcloseの一時pathは後続Packetで明示許可を得る。network sourceのverifyは#45のWorkerでは行わない。

## 6. Frontの画面確認

今回Workerは`ui_route=none`。後続Frontが撮影前に`ui_route=headless_acceptance:PS-COM-02,PS-PC-03,PS-PC-04,AC45-COMPAT,AC45-STYLE`を宣言する。挙動の判定は§5のNodeで行い、画像は配置・折返し・状態の外観を証明する。

### fixture撮影scriptの契約

雛形は`docs/records/aidlc-cycles/2026-11-18_issue-44_music/_trace/aidlc-docs/construction/aidlc-integration/verification/capture-music.py`。新規`capture-profile-contact.py`は`--serve`（localhostのみ）と、インストール済みのChromiumを指定する`--chromium`を持つ。Frontはexecution targetから次を実行する。インストールは不要、Workerはbindしない。

```bash
/usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-profile-contact.py --serve
```

Pythonは`-I`なし、既存のPlaywright 1.58.0。clockは`page.clock.install(time=<秒>)`で固定する（単位は秒）。`**/api/public/site-data`をfixtureでfulfillし、送信先の`https://forms.example.test/**`は成功・HTTP失敗・通信失敗・応答なしをscenarioごとに差し替える。ページに埋め込まれた本番の送信先のhost（`formspree.io`）と、localhost以外のrequestはabortし、**本番の送信先へのrequestが0件であることを各scenarioで検査する**（0件でなければ失敗）。YouTube・本番APIへは通信しない。既存のlocal画像を使い、文字・データは架空。fontは既存の同版のlocal cacheが使えれば読み、遮断されてfallbackなら、font familyとその限界をmetricsに記す。fallback fontの画素一致を合格にしない。

device_scale_factor=1、reduced_motion=reduce、幅1440×900・390×844。ready・淡い面の状態・`document.fonts.ready`・画像のloadを待つ。各撮影で、console・pageerror・script失敗、横overflow、各section・画像・見出し・名前・文章・チップ・依頼の入口・フォームの各欄・送信ボタンのbox、computedの色・文字・余白、文字nodeの`Range.getClientRects`を行のtopごとに数えた実行数を保存する。高さ÷line-heightや要素の高さを行数に使わない。

| シナリオ | screenshots/内の名前と確認内容 |
|---|---|
| Profile通常 | `profile-1440-first.png / profile-1440-full.png / profile-390-first.png / profile-390-full.png`。写真・名前・文章（段落と改行）・links・依頼の入口、左右の余白。 |
| Profileの状態 | `profile-no-photo-<width>.png`（S45-01）、`profile-photo-broken-<width>.png`（S45-X1）、`profile-error-<width>.png`（S45-02）、`profile-loading-<width>.png`（S45-L）。 |
| Profileのlinks | `profile-links-extra-<width>.png`（5種類以外あり）、`profile-no-links-<width>.png`、`profile-empty-<width>.png`（`profile`が空）。 |
| Contact通常 | `contact-<width>.png`（初期）、`contact-filled-<width>.png`（3項目に入力）。 |
| Contactの状態 | `contact-invalid-<width>.png`（e-mailの形式、S45-03）、`contact-empty-<width>.png`（必須欄がすべて空）、`contact-sending-<width>.png`（S45-04）、`contact-done-<width>.png`（S45-05、複数行の内容）、`contact-failed-<width>.png`（S45-06、入力が残っている）、`contact-loading-<width>.png`（S45-L）、`contact-fallback-<width>.png`（S45-X2）。 |
| 操作 | `contact-focus-<width>.png`（欄・送信ボタンのfocus）、`contact-hover-submit-1440.png`、`profile-hover-chip-1440.png`。赤の輪郭・影・持ち上げがないこと。 |
| 中間幅・狭い幅 | `profile-821.png / profile-1024.png / profile-360.png / contact-821.png / contact-1024.png / contact-360.png`。折返し・横overflowなし。 |
| Menu・他ページのsmoke | `menu-profile-390-open.png / menu-contact-390-open.png`（現在地の濃色だけを見る。Menuは#45で変えないので専用の合否は置かない）。`smoke-home-390.png / smoke-music-390.png / smoke-live-390.png`（変わっていないこと）。 |

合否（許容は罫線・丸めで±2px）：
- Profile 1440: 本文の幅980、写真364×455、内容の幅560、写真と内容の間隔56、名前は42px/22pxの行、文章は16px/26px、チップの高さ38、依頼の入口の面は幅560・高さ130前後。Profile 390: 写真358×358、内容の幅358、依頼の入口は幅358・ボタンは中身の幅（全幅にしない）。チップの折返しと文章の行数は文字の位置から数え、fontが同じ環境でない時は合否にしない。
- Contact 1440: フォームの幅560、入力欄の高さ52、内容の欄は136以上、送信ボタンは中身に合わせた幅で左寄せ、高さ46。Contact 390: フォームの幅358、送信ボタンの幅358。送信中のボタンの不透明度.4（共通の`.site-button:disabled`）。Contactの項目のラベルと入力欄の間隔6。
- 色: 送信ボタンの背景だけが`--accent`。誤りの文字は`--ink`、誤りのある欄の枠は`--ink`の1px、失敗の知らせの背景は`--paper-deep`（`--accent-soft`ではない）。それ以外のcomputedの色・輪郭・影に赤がない（見出しの線とロゴの既存の例外を除く）。hover・focusの画像で、赤い影・持ち上げ・赤い輪郭がない。
- 状態: 写真なし・失敗の表示、入力が残る失敗、送った内容が3行で出る完了、送信中に入力が残りボタンが押せない、読み込み中の淡い面。横scrollなし。意図しない赤なし。
- 本番の送信先へのrequestが0件。

Frontが全撮影画像を目視し、数値snapshotと`render-31-*.png`を照合する。renderとの画素比較済みとは書かない。fontが違い文字の受入に影響する時は未確認として残し、Frontの同font環境または本人の明示受入で解消する。startup failureもinitial attemptとし、同route・同ACの具体的な修正仮説がある時だけ1回corrective retryし、失敗はAC単位で`visual_acceptance_pending`と残条件を返す。GUI・OS撮影へのfallback chainを作らない。

### 本番公開データを読むbranchの確認

Frontが確認2の前に、fixture撮影と別のscratchの配信用copyへ公開HTML・assetsだけを置く。repo全体・admin・token・private fileを配信しない。配信用`site-config`の変更はcopy内だけ。PCの`http://localhost:8888/`は許可リストにあるoriginから公開APIを直接読む。「誰からでも読める」と書かない。スマホ用のtunnelはこの環境の規定で遮断されているため、390pxの画像とPCのURLで代える（Frontの記録に従う）。

Frontが確認するのは、Profileのlinksが5件であること（件数だけを記録）、文章が段落2つ・段落内の改行・行頭「・」のまま崩れないこと、写真の切り抜き方、名前が二重に見えないこと、依頼の入口、Contactの導入文が管理画面の設定どおりに出ること、`<form>`の`action`が公開データの`contact.formAction`と一致すること（比較の結果だけを記録し、値は残さない）。**Contactの送信は試さない。** 記録は時刻・tested revision・件数・環境・成否と制約だけで、本番の文章・URL・送信先はrepo・承認の提示文へ書かない。保存済みの設定の入れ直しは頼まない。Frontの本番データの画面確認は必須、確認2でのItsukiの閲覧は任意で、手元のURLは毎回提示する。Itsukiが必ず公開全ページを見るのはまとめ出しの直前の1回。

## 7. 並行Issue（#43）との重なり

#43はLive・Ticketの本文を並行で変える。#45が変えるファイルのうち重なりそうな所と、衝突を避ける切り方は次のとおり。

| ファイル | #45の変更 | 切り方 |
|---|---|---|
| `assets/css/style.css` | 末尾に1つのまとまりを追補 | 既存のbytesと#44の末尾に触れない。選択子は`body.site-profile`・`body.site-contact`だけ。#43も末尾へ足すと同じ場所の衝突になるが、後から入る側が両方のまとまりを残すだけで解ける。後から入る側が`profile-contact-shell.test.mjs`の基準commit定数を更新する。 |
| `assets/js/site-content.js` | `boot()`の直前に1つのまとまり、`boot()`に分岐2行 | 既存の関数は変更しない。#43はLive・Ticket側の関数と`boot()`の一般経路を触る見込み。分岐の2行の衝突は、両方を残して解ける。 |
| `test/site-shell.test.mjs` | 例外リストへの追加と末尾CSSの検査の基準の限定 | 最小の改修にとどめ、新しい検査は`profile-contact-shell.test.mjs`へ置く。#43も同じ例外リストに自分の対象を足すため、後から入る側が両方を残す。 |
| `docs/specs/current/public-site-ui.md`・`README.md` | 提案版（§3・§5・§6・§7の追記・改訂と先頭の記述） | Profile・Contactに関わる所だけ。#43も同じ設計書を直すなら、元版のhashが変わる。昇格は元版hash一致を条件にし、不一致なら止めてFrontへ返す。意味が重なる章は比較し、他Issueの承認済みbytesを無断で上書きしない。 |
| 共有assetのcache query（`?v=20261118-44`） | 変えない | #43とも全10ページの同じ行を触らない。まとめ出しの前に1回で全ページを上げる（§9）。 |
| `profile/index.html`・`contact/index.html`・`contact.js`・新規試験・fixture | #45だけ | #43は触らない（衝突なし）。 |

#45は#44のmerge後のまとめ用branchから作ってあり、#43は#44を取り込んでから本文を変える。#45が先に入れば、#43が取り込む。後から統合する側が差分を解決し、完成したナビ・Music・Profile・Contactを古い版へ戻さない。Ticket完了からの入口など#43の範囲は#45で先行実装しない。

## 8. 結果ファイルと確認2

| 成果物 | path |
|---|---|
| Code Generation Result | `aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md` |
| Build/Test Result | `aidlc-docs/construction/build-and-test/build-and-test-summary.md` |
| 実行log・script・metrics | `aidlc-docs/construction/aidlc-integration/verification/` |
| 画像 | `aidlc-docs/construction/aidlc-integration/verification/screenshots/` |
| cycle summary | `aidlc-docs/cycle-summary.md` |

結果には、実装path、昇格前後のhash、RED→GREENのcommandとexit、全試験のpass/fail、PS・AC別の証拠、Front撮影・本番データの画面確認、独立reviewの所見と修理を記す。未実施・未確認をPASSへ丸めない。Build/Test Resultとcycle-summaryは、未解消のblockingがない場合だけ`- **Blocking Findings**: None`のfield形式にする。

Frontが独立reviewを実装後に1回手配し、設計・実装・試験・昇格・まとめ出しの記述をまとめて見る。確認2の前に結果のbytesを固定し、本人Aをgate 4・5へ記録する。以後の説明の追補で承認済みartifactを無断で変更しない。5 gateとFront completionの条件が揃ってからcloseへ進む。このPacketでは結果・承認記録・closeを作らない。

## 9. まとめ用branchへの統合とrollback

Owner決定（2026-11-18）の例外としてPR baseは`feature/39-public-pages`、headは`feature/45-profile-contact`。元のbaseは`origin/feature/39-public-pages`の`ba124011ce5e0ae56ddb1c6ac47d1783600687b4`（#44のPR #51をmerge済み）。formal close後に別途許可されたFrontが既存のai-feature-push / ai-pr-createを使い、試験済みrevision・scope・secretの非混入・baseを確認する。PRには#45、AI-DLC archive、受入と検証、公開がまだ起きないことを記す。`Closes #45`と書いてもmain以外へのmergeでIssueは閉じず、ProjectはReviewのまま。merge・PR承認はItsukiの明示判断。

#45のmerge後はまとめ用branchの差分とcycle記録を確認し、#43へ取り込みを渡す。本番API・Workerは不変でdeployはない。#45で本番配信の確認を実行したことにしない。まとめ出しの担当が#43統合後に、共有assetのcache queryを全ページで1回だけ上げ（`style.css`・`site-content.js`・`script.js`・`contact.js`の公開前の整合）、公開全ページの本人確認、mainへのPRとOwner merge、本番Pagesの確認、Issue・Projectのcloseを行う。

| 戻す時点 | 復旧単位と確認 |
|---|---|
| #45がまとめ用branchに入った後、main公開前 | Frontが#45のmerge差分だけのrevertを準備し、Itsukiの明示承認でまとめ用branchへ適用する。merge方式に応じて対象commitを特定し、無条件のmainline指定はしない。ProfileとContactの`main`・`contact.js`・`site-content.js`の追補・CSSの追補・設計書の昇格・試験を同じ単位で戻す。Contactは旧contact.jsと重ねて開く表示に戻り、送る先・送る項目は不変なので連絡は届く。#43が既に依存していれば最小の修理を具体差分でOwnerへ示す。作業branchのresetやforce pushで戻さない。 |
| まとめ出しがmainへ入り、本番公開後 | Frontがmain上のまとめ出し差分のrevert PRを準備し、Itsuki承認でmergeする。#43も含む公開bundleの直前版へ戻るため、Contactは旧の表示に、Profileは旧の表示に整合して戻る。設計書・索引も同じ復旧単位。まとめ出しの担当がPages buildと旧版の配信、Profile・Contactの表示と送信の導線を確認する。#45だけを機械的にrevertして新しい設計書・試験とコードがずれる状態にしない。 |

どちらも保存データ・Worker・Formspree側の設定・Figma・無関係な変更は戻さない。データの移行は不要。公開後に#45だけを戻す必要があれば、#43との依存の追加差分を別Issueで承認する。Ownerのmerge承認とcycle承認を取り違えない。

### まとめ出しへ渡す推奨（VF8）：本番のContact送信を1回試すか

**推奨: 試す（1回だけ、公開の直後に）。** 理由は、fixtureと決定論的な試験では本番の送信先の応答（JSONの受け取り・CORS・成功の判定）を確かめられず、完了の表示が本番の応答で出るかを確かめられるのはここだけだから。送る側はItsuki本人が、実際のブラウザのPCかスマホから、件名に当たる冒頭に「テスト送信（削除してよい）」と書いた内容を、自分が受け取れるe-mailで1回だけ送る。Frontやworkerは送らない。届いた連絡はItsukiだけが確認し、受信箱から削除する（保存先がFormspreeのため、記録に残るのは回数だけ）。完了の表示と、届いたことを両方確かめる。失敗の表示は本番では試さず、試験とfixtureで確かめ済みとする。本番で試さない場合の影響は、完了の表示が本番の応答で出るかが公開後に初めて分かること。決めるのはItsuki。

## 10. 停止条件と今回の返却点

許可外のwrite/network/secret、手順外のcycle故障、データの形・保存・送信の仕組み・Cloudflare Workerの変更が不可欠ならBLOCKED。canonical元版のhash不一致（#43が先に昇格した場合を含む）、Figma未整合、承認digestの不一致は後続実装を止めFrontへ返す。価値判断が一部だけ残る場合は推奨案とowner_questionsを返し、作れる候補は完成させる。

今回は3つの未承認候補と設計提案版・整合案・audit/stateのみ。承認記録、canonical昇格、コード・試験・公開ファイル、撮影script・fixtureの実装は行わない。Requirements承認待ちを保持する。render画像・font・本番画面・独立review・Owner承認は今後の証拠であり、候補作成完了と分ける。
