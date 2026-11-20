# ProfileとContactの実装結果（Code Generation Result）

ProfileとContactが新しい見た目になりました。Profileは見出しの下に写真と名前、登録した文章、links、出演依頼の入口の順で並び、Contactは入力誤り・送信中・完了・失敗がページの中に出ます（重ねて開く表示はなくなりました）。送信に失敗しても入力は消えず、「もう一度送信する」で送り直せます（失敗のあとに入力誤りが出る時は、前の失敗の知らせを隠します）。完了では、送った内容がそのまま画面に出ます。送る先・送る項目・送り方は今のままです。

- Cycle: `2026-11-19_issue-45_profile-contact`
- 対象: `feature/45-profile-contact` / base `ba124011ce5e0ae56ddb1c6ac47d1783600687b4`
- reader_profile: audience_class=hybrid / language=ja-JP / review_surface=designated_text_editor / reader_ready=true / open_status=not_opened（Frontが開く）
- 実装と自動試験: 完了。Frontの撮影（51枚）と全画像の目視、本番の公開データでの画面確認、独立review（APPROVED、blocking 0）: 実施済み（下の「確認の結果」）。Frontが直す判断をした4点は反映済みで、その後の再撮影もFrontが行い、51枚すべて自動の合否を通りました。Owner承認（gate 4・5）・close・PR・merge: 未成立。

## できるようになったこと

| 場面 | 変わったこと |
|---|---|
| Profile | 写真（PCは左、スマホは上）、名前（固定の文字）、登録した文章（段落の区切りと段落内の改行をそのまま。HTMLとしては解釈しない）、links、「出演のご依頼・お問い合わせ」と「Contactへ」。 |
| Profileのlinks | Homeと同じ判定でBandcamp・YouTube・X・Instagram・noteを先に出し、続けて、この5つに当たらないProfileのリンクを登録順に出します。同じ行き先は1つ、http(s)以外は出しません。今のProfileに出ているリンクは1件も減らず、本番と同じ形（Site 5件・Profile 4件がすべて5サービス）では5件のままです。 |
| Profileの状態 | 読み込み中（写真の枠が淡い面で「読み込み中」）、写真なし・写真だけ読めない（枠ごと消えて文章が幅いっぱい）、全体の失敗（「プロフィールを読み込めませんでした。」と「もう一度読み込む」）、`profile`のデータが空（名前と依頼の入口が出ます。Siteに登録したlinksがあれば、それも出ます。下の「確認2でお伝えすること」）。再読込は二重に要求せず、古い応答や離脱後の応答で表示を上書きしません。 |
| Contactの設定 | 導入文と送信先は、これまでどおり管理画面のSite > Contactの設定に従います。設定が届くまでは導入文の場所が「読み込み中」になり、送信ボタンは押せません。読めない時や8秒たっても届かない時は、知らせを出さず、ページに埋め込まれた導入文と送信先で今のまま送れます（遅れて届いた設定は導入文と送信先にだけ反映します）。 |
| Contactの入力誤り | 名前・e-mail・内容が空（空白だけを含む）、またはe-mailの形式が誤りの時、その欄のすぐ下に文を出し、最初の誤りの欄へ移り、送りません。入力は残ります。文は黒（赤にしません）、誤りのある欄の枠は黒の1pxです。 |
| Contactの送信中・完了・失敗 | 送信中はボタンが「送信しています…」で押せず、3項目は読み取り専用で値が残り、二重に送れません。完了は導入文とフォームを「送信しました。」とお礼、送った内容（名前・e-mail・内容）、「Home →」に置き換えます。失敗（通信失敗・HTTPの失敗・送信先が空）は、知らせを出してボタンを「もう一度送信する」に戻し、入力は1文字も消しません。 |
| 赤の使い方 | 赤は「送信する」（失敗後の「もう一度送信する」も同じボタン）と見出しの線だけです。入力誤りの文・誤りのある欄の枠・失敗の知らせ・hover・focusには使っていません。 |

変えていないこと: 送る先（送信時点の`form`の`action`）・POST・`Accept: application/json`・`FormData`のキー（`name`・`_replyto`・`message`）・成功の判定（`ok`）、`contact/index.html`に埋め込まれた導入文と送信先、データの形、管理画面、Cloudflare Worker、ヘッダー・ナビ・フッター・Menu、Home・Music・Live・Ticketの本文。

## 設計書の昇格

昇格前の元版が計画の値と一致することを先に確認してから、提案版2ファイルを同じbytesでcopyしました（文字の置換・日付の追補・書式の変更なし）。

| 昇格先 | 昇格前のSHA-256（計画の元版） | 昇格後のSHA-256 | 計画の提案版 |
|---|---|---|---|
| `docs/specs/current/public-site-ui.md` | `1aa471ebbb9680f762b4bcd2e97788aedd6f259fe82ad67ebc1f8b9e65e30a56`（一致） | `56fd415e660dc4899dc5d6930e3dd06df2d40c2fd347943b0cdbb93b88184b3f` | 一致（`cmp -s`も一致） |
| `docs/specs/current/README.md` | `8ecd9e3c00ad1025acf8683417780f7071d8d9d8be29e0bd9a98044c890dea0a`（一致） | `58453fcc636245bc91367255cfbdcca73a0d9a943c95af0739e2f175907837dc` | 一致（`cmp -s`も一致） |

提案版2ファイルも`aidlc-docs/construction/aidlc-integration/canonical-proposals/`に残っています。承認済みのRequirements・Workflow Plan・Code Generation Plan・`figma-fix-requests.md`のbytesも変えていません（SHA-256を再確認済み）。`live-operations-admin-ui.md`は計画どおり更新していません。

## 変えたファイルと段ごとの内容

| 段 | 内容 | 主なファイル |
|---|---|---|
| 1. 入力と昇格 | 3つの承認記録の転記と検査、設計書の昇格、既存の関連試験（113件）の確認、fixtureと仮DOMの補助の用意。 | `aidlc-docs/approvals/01〜03`、`docs/specs/current/*`、`test/fixtures/profile-contact-states.json`、`test/profile-contact-dom.mjs` |
| 2〜3. Profile | `main`の新しい構成、`bootProfile`・`renderProfileContent`・`renderProfileFailure`・`wireProfile`・`buildProfileLinks`、状態（読み込み中・写真なし・写真の失敗・全体の失敗・空）、再読込（二重要求・古い応答・`pagehide`・`pageshow`・focus）。 | `profile/index.html`、`assets/js/site-content.js`、`test/profile-rendering.test.mjs` |
| 4. Contactの構造・設定・送る仕組み | `main`の新しい構成（重ねて開く表示を外した）、`bootContact`（設定の反映・読み込み中・8秒・読めない時）、`contact.js`の送信（旧コードと同じ送り方）。 | `contact/index.html`、`assets/js/site-content.js`、`assets/js/contact.js`、`test/contact-form.test.mjs` |
| 5. Contactのページ内の状態 | 入力誤り・送信中・完了（送った内容）・失敗（入力が残る・もう一度送信する）・二重送信・focus・読み上げ。 | `assets/js/contact.js`、`test/contact-form.test.mjs` |
| 6. 見た目と外枠の保護 | CSSの追補（Figma v2の寸法・色・文字、全体の`form`の規則の打ち消し）、外枠と他ページを変えないことの試験。`site-shell.test.mjs`の最小の改修。 | `assets/css/style.css`（末尾62行）、`test/profile-contact-shell.test.mjs`、`test/site-shell.test.mjs` |
| 7. 画面確認の材料と全試験 | Front用の撮影scriptの作成と構文・契約の検査、全試験の2回目・最終。 | `aidlc-docs/construction/aidlc-integration/verification/capture-profile-contact.py` |
| 8. 結果 | 本書とBuild/Test Result・cycle-summary。 | `aidlc-docs/` |

### 実装の場所

- `assets/js/site-content.js`: 差分は追加213行・削除0行。`boot()`の直前に「Issue #45」の見出しコメントを付けた1つのまとまり（Profile: `isPlainObject`・`isSharedServiceLink`・`profileLinkKey`・`buildProfileLinks`・`validProfileData`・`renderProfileContent`・`renderProfileFailure`・`bootProfile`・`wireProfile`、Contact: `bootContact`）を置き、`boot()`にはMusicの分岐の次に分岐2行（`profile-content`・`contact-content`）だけを足しました。既存の関数のbytesは変えていません（試験で、まとまりと2行を除くと基準commitと同じbytesになることを確かめています）。既存の`renderProfile`・`renderContact`はContact・Profile以外の経路では呼ばれなくなりますが、計画どおり残しています。
- `assets/js/contact.js`: 全面的に書き換え。送り方（`submitToFormspree`: `fetch(action, { method: "POST", headers: { Accept: "application/json" }, body: formData })`、成功は`res.ok`）は旧コードと同じです。
- `assets/css/style.css`: 基準commitのbytesが先頭にそのまま残り、末尾に`/* Issue #45: Profile and Contact. */`の1つのまとまり（62行）を足しました。選択子はすべて`body.site-profile`または`body.site-contact`で始まります。色・余白は`DESIGN_RULES.md`のスケールとtokensだけで、スケール外のpxは`body.site-profile .profile-intro`の`gap: 56px`と`body.site-contact .contact-field`の`gap: 6px`の2か所だけです。`--accent`・`--accent-soft`は追加分で使っていません。
- `profile/index.html`・`contact/index.html`: `<body class>`と`main`だけを変えました（`contact.js`のqueryは`?v=20261119-45`。共有assetのqueryは`20261118-44`のまま）。`contact/index.html`の導入文と送信先は、元の行から1文字も変えずに写しています。

## 計画との差と、Workerが決めたこと

計画の読み替えが必要な差はありません。計画が細部をWorkerに任せていた点は次のとおり決めました。

- 送信後に応答の本文（`res.json()`）は読みません。計画は「解析を試みてもよいが結果は使わない」としていたため、結果を使わない解析と、本文が届かない時の完了表示の遅れを省きました。`fetch`の引数と、成功を`ok`で決めることは変わりません。
- 文章の前後の空白は削りません（登録どおり）。空白だけなら文章の要素を出しません。
- 写真の`error`の処理は、`wireProfile`で`#profile-image`に一度だけ付けます。
- 失敗の固定の文言は、`contact/index.html`に隠した状態で置き、JavaScriptは表示するだけです。完了の固定の文言と「送った内容」の枠はJavaScriptが入れます。
- 名前に5サービスの別名を含むだけのProfileのリンク（例: 名前に「x」を含む「box」）は、計画どおりHomeの既存の判定（部分一致）を共有するため、5サービスのリンクとして扱われ、5種類以外の後ろに続けるリンクには入りません。これはHomeと同じ挙動です。
- 試験の補助として、仮DOMを`test/profile-contact-dom.mjs`に置きました（`node --test test/`はこの補助ファイルも1つのファイルとして数えますが、試験は含みません）。
- `test/public-music-data-compatibility.test.mjs`は、仮DOMの`setTimeout`・`clearTimeout`が足りずContactの分岐で失敗したため、その2語を仮DOMのcontextへ足しただけです（期待値は変えていません）。`test/site-shell.test.mjs`は計画§5のとおり、ProfileとContactを`main`のbytes一致の例外に足し、#44の末尾CSSの検査3つを「#44が足した範囲」に限りました。
- 撮影scriptに、ブラウザもbindも使わず契約だけを検査する`--self-check`を足しました（Frontの1行の実行は計画どおり`--serve`）。
- 保護の試験（T45-SHELL・T45-COMPAT）は、実装前から通る性質のもの（変えてはいけないものを縛る）なので、REDにはなりません。REDを確かめた試験群は、Build/Test Resultの表のとおりです。

## 画面確認の材料（Front用）

`aidlc-docs/construction/aidlc-integration/verification/capture-profile-contact.py`と`test/fixtures/profile-contact-states.json`を作りました。Frontはexecution targetから次の1行で全シナリオを撮れます。

```bash
/usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-profile-contact.py --serve
```

画像51枚（Profile通常4・状態8・links6、Contact通常4・状態14・操作4、中間幅6、Menu2、他ページのsmoke3。名前は計画§6のとおり）を`verification/screenshots/`へ撮り、`capture-profile-contact-metrics.json`に数値を保存します。fixtureはすべて架空で、本番と同じ形（段落2つ・段落内の改行・行頭「・」・`<`を含む文章、大文字拡張子の相対pathの写真、Site 5件とProfile 4件のlinks、1段落の導入文）を持ちます。写真は、scriptが生成する架空の画像で置き換えます。送信は、`forms.example.test`だけを成功・HTTP失敗・通信失敗・応答なしに差し替え、本番の送信先のhost（`formspree.io`）とlocalhost以外はabortして記録し、本番の送信先へのrequestが0件であることを各シナリオで検査します（0件でなければ失敗）。

Workerが確かめたのは構文と契約（画像名の重複と件数、fixtureの形と架空の値、操作の種類）までで、ブラウザでの実行はしていません。実ブラウザでの撮影はFrontが行いました（下の「確認の結果」）。

## 確認の結果

### Frontの撮影（fixture、51枚）

- 初回は、scriptの期待値の誤り（文章の行数をFigmaの見本の8行のままにしていた）で1枚目で止まりました。Frontが期待値（fixtureの空でない行の数以上）と、不合格があっても最後まで撮る形に1回直しました。
- 直したあとの撮影で51枚すべてが撮れ、48枚が自動の合否を通りました。残る3枚（`profile-821`、`profile-empty-1440`、`profile-empty-390`）は、scriptの期待値の誤りでした（実装の誤りではありません）。この3枚の期待値は、Packet 04でscriptを直しました（下）。
- 全51枚で、本番の送信先へのrequestは0件、想定外のconsoleエラー・pageエラーは0件でした。Frontが全51枚を縮小の一覧と原寸で目視し、崩れ・横scrollはなく、状態はFigma v2と計画どおりでした。
- fontは、同じ版のcacheがなく代わりのfontです。文字の最終受入は未確認です。
- Packet 04のあとに、Frontがもう一度撮りました（2026-11-20）。51枚すべて自動の合否を通り、本番の送信先へのrequestは0件、想定外のconsoleエラー・pageエラーも0件でした。本番の公開データでの画面確認も流し直し、結果は前と同じでした。

### 本番の公開データでの画面確認（AC45-PROD、Front実施）

値は書きません（本番の値は撮影した画像にだけ残っています）。

- Profile・Contactとも、1440pxと390pxで読み込めました。
- 写真は枠の中に収まりました（切り抜きで顔は枠内）。文章は段落2つのままです。linksは5件で、横scrollはありません。
- 名前が2回出ます（固定の名前の下に、文章の1行目の名前）。コードは文章を加工しない計画どおりです。「確認2でお伝えすること」を見てください。
- Contactは、設定が読み込めて導入文は1段落、送信先は設定と一致し、ページに埋め込まれた既定とも一致、項目は3つです。Contactは送信していません（本番の送信先へのrequestは0件）。

### 独立review

結果はAPPROVED、blocking 0件です。指摘RV45-01〜07とFrontの採否は次のとおりです。

| 指摘 | 内容 | 採否 |
|---|---|---|
| RV45-01（medium） | 古いHTMLと新しいscriptが混ざると、必要な要素が無く送信が無反応になる | 直した（Packet 04） |
| RV45-02（low） | HTMLの`novalidate`のため、`contact.js`が読み込まれない時はブラウザの必須・e-mail検査が働かない | 直さない（既知の制限） |
| RV45-03（low） | 失敗のあとの入力誤りで、前の失敗の知らせが残る | 直した（Packet 04） |
| RV45-04（low） | 撮影scriptの`empty-profile`の期待が、実装・R45-04・T45-PROF-STATEとずれる | scriptを直した（Packet 04） |
| RV45-05（low） | 撮影scriptの1440以外の「内容の幅560」が`flex: 1 1 0`とずれる | scriptを直した（Packet 04） |
| RV45-06（low） | Profileに登録したlinksのうちhttp(s)以外は出さない（計画どおり） | 直さない（既知の制限） |
| RV45-07（medium） | 結果文書が撮影・本番確認の前の記述のまま | 本書とBuild/Test Result・cycle-summaryを更新（Packet 04） |

Reviewerのsessionでは`Bash`が使えず、試験の独立実行・SHA-256の再計算・画像の確認はしていません（試験の件数はWorkerのlogの読み取り）。Frontが確認2の前に照合します。

## Packet 04の変更（独立reviewの指摘の反映）

- RV45-01: `assets/js/contact.js`は、送信の処理に要る要素（`#contact-form`・`#contact-submit`・`#contact-status`・`#contact-failure`・`#contact-done`・`#contact-intro`、3項目とその`-error`）が1つでも無いHTMLから読まれた時、submitのhandlerを付けず何もしません（`preventDefault`もしません）。標準のform送信がそのまま働きます。送る先・方法・項目・状態・文言は変えていません。
- RV45-03: 入力誤りで送らずに戻る時も、前の失敗の知らせ（`#contact-failure`）を隠します。
- 試験: `test/contact-form.test.mjs`に2件を追加（T45-CON-GUARD、T45-CON-VALID RV45-03）。先にREDを確かめ（28件中2件失敗。`p04-rv45-01-03-red.log`）、直したあとGREEN（28 / 28 / 0。`p04-rv45-01-03-green.log`）。既存の試験は削っていません。
- RV45-04・05: 撮影script（`capture-profile-contact.py`）の期待だけを直しました。`empty-profile`はSiteのlinksがあればlinksを出す（無ければ見出しごと出さない）、幅820px超の「内容の幅」は`min(560, 本文の幅 − 364 − 56)`です。実装は変えていません。Frontが直した2点（文章の行数の期待値、不合格でも最後まで撮る形）は残しています。`--self-check`は通ります（51画像 / 14シナリオ）。
- 全試験: `node --test test/`は609 / 609 / 0、`npm --prefix cloudflare/worker test`は347 / 347 / 0（`p04-final-all-site.log`、`p04-final-all-worker.log`）。サイトの件数は、追加した2件で607から609になりました。

## 確認2でお伝えすること

- 要件R45-06の「名前と依頼の入口だけ」は、`profile`のデータが空という意味です。Siteに登録したlinksがあれば出します（R45-04「Siteを先に」、T45-PROF-STATEのとおり）。承認済みの要件は変えていません。
- 本番の公開データでは、名前が2回出ます（固定の名前の下に、文章の1行目の名前）。コードでは文章を加工しません（計画どおり）。直すのは管理画面のProfileタブの文章で、まとめ出しのあとにします（今直すと、まとめ出しまでの今のProfileから名前が消えます）。

## 未確認・既知の制限と残ること

- 同じfontでの文字確認と、`render-31-*.png`との画素の比較: 未実施です。fontの同版のcacheが無く、代わりのfontで撮りました。Frontは全画像を目視し、計画とFigma v2の寸法・状態に照らしました。
- 独立reviewのReviewerが行えなかった確認（試験の独立実行、SHA-256の再計算、`docs/specs/current/`の提案版との一致、画像の確認）: Frontが確認2の前に照合します。
- RV45-02: HTMLの`novalidate`（承認済み計画§2）のため、`contact.js`が読み込まれない時は、ブラウザの必須・e-mailの検査が働かないまま標準のform送信になります。稀で影響は小さく、直すと承認済みのHTMLの設計を変えるため、直していません。
- RV45-06: Profileに登録したlinksのうちhttp(s)以外の値は出しません（計画どおり。base のProfileはSite側のlinksで出していました）。
- e-mailの形式の検査はブラウザの`validity.typeMismatch`です。試験の仮DOMは同じ文法（WHATWGのvalid e-mail address）で再現しています。実ブラウザでの確認は、Frontの撮影（`contact-invalid-*.png`、`example@`）で行いました。
- 送信先が応答しない時、送信中の表示が続きます（今のContactも同じで、時間切れは設けない決定です）。送信がサーバーに届いたかを画面で確かめる手段はありません。
- Formspree側の入力検査エラー（HTTP 4xx）は「送信できませんでした」の1種類になり、相手のエラーの詳細は出しません。
- #43（Live・Ticket）との重なり（`style.css`末尾・`site-content.js`の`boot()`の分岐・`site-shell.test.mjs`・設計書）は、計画§7のとおり、後から入る側が両方を残して解きます。基準commit定数は`test/profile-contact-shell.test.mjs`にあります。
