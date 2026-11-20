# ProfileとContactの検証結果（Build/Test Result）

独立reviewの指摘を反映した最終のコードで、サイト全609件、Worker全347件の試験が失敗0で通りました。サイトの試験はFront着手前の513件に、新規の試験と補助ファイル1つが加わった件数です。Frontの撮影（51枚）・全画像の目視・本番の公開データでの画面確認・独立review（APPROVED、blocking 0）は実施済みです（結果は`code-generation-summary.md`の「確認の結果」）。独立reviewの指摘のうちFrontが直すと決めた4点を反映したため、Frontがもう一度撮影します（その結果はFrontが追記します）。

- **Blocking Findings**: None
- Cycle: `2026-11-19_issue-45_profile-contact`
- 対象: `feature/45-profile-contact` / base `ba124011ce5e0ae56ddb1c6ac47d1783600687b4`
- reader_profile: audience_class=hybrid / language=ja-JP / review_surface=designated_text_editor / reader_ready=true / open_status=not_opened（Frontが開く）
- 実装・自動検証: 完了（独立reviewの指摘の反映を含む）。Frontの撮影・全画像の目視・本番の公開データでの画面確認・独立review: 実施済み。反映後の再撮影: Frontが実施済み（51枚すべて自動の合否を通過）。gate 4・5のOwner承認・Front completion・close・PR・merge: 未成立。

Blocking Findingsは、既知の実装・自動試験・Frontの画面確認に未解消の阻害所見がない意味です。下の「残る確認とGap」をPASSにはしません。

## 実行した試験

execution targetからNode v20.19.4で実行しました。dependencyのinstall、外部network、Worker deployは行っていません。試験は`fetch`を差し替え、networkへ出ません（Contactの本番の送信先へのrequestもありません）。静的HTML/CSS/JavaScriptのため別bundle buildはありません。

```bash
export PATH=/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH
node --test test/
npm --prefix cloudflare/worker test
```

最終の結果です（log は`construction/aidlc-integration/verification/logs/`。`p04-`で始まるlogが、独立reviewの指摘の反映後のものです。`final-`で始まるlogは反映前です）。

| command | tests / pass / fail | exit | log |
|---|---|---|---|
| `node --test test/` | 609 / 609 / 0 | 0 | `p04-final-all-site.log`（反映前の607 / 607 / 0は`final-all-site.log`） |
| `npm --prefix cloudflare/worker test` | 347 / 347 / 0 | 0 | `p04-final-all-worker.log` |
| `node --check`（site-content / contact / script） | 全件 ok | 0 | `p04-check-js.log` |
| `git diff --check`（追跡ファイルの差分） | 指摘なし | 0 | `p04-diff-check.log` |
| focused（新規・関連の8ファイル。反映前） | profile-rendering 43、contact-form 26（反映後は28）、profile-contact-shell 24、site-shell 39、home-rendering 64、public-music-data-compatibility 10、music-rendering 64、public-ticket-routing 36。すべて失敗0 | 0 | `final-focused.log` |
| `scripts/aidlc-verify.sh --local` | 通過（v1.0.1、`source authenticity was not checked`＝本番networkの照合は行っていない） | 0 | `p04-local.log` |
| `scripts/aidlc-cycle.sh status` | Cycle ID・Issue #45・Current Stage `CONSTRUCTION - Code Generation Result`・Cycle Status `In Progress` を表示 | 0 | `p04-status.log` |
| 撮影scriptの`--self-check` | 契約OK（51画像 / 14シナリオ、ブラウザ・bindなし） | 0 | `p04-self-check.log` |

`aidlc-verify.sh --local`は、sandboxが`diff`のプロセス置換（`/dev/fd`）と`/private/tmp`への`mktemp`を拒むため、作業用の一時directoryに置いた`diff`と`mktemp`の薄いshimをPATHの先頭に置いて実行しました（scriptの本体は変えていません。shimは`/dev/fd`の入力を一時fileへ写して本物の`diff`へ渡す／`/private/tmp`の下の`mktemp`の置き場を作業用の一時directoryへ替えるだけ）。変更範囲、承認記録・canonicalの照合、closeの書式の事前検査は、下の各節に書きます。

途中の区切りです。

| 区切り | tests / pass / fail | log |
|---|---|---|
| 着手前（Front報告の基準） | サイト513 / 0失敗、Worker347 / 0失敗 | — |
| 段1 characterization（site-shell・home-rendering・public-music-data-compatibility） | 113 / 113 / 0 | `step1-characterization.log` |
| 段5後の全試験1回目 | 583 / 581 / **2** | `step-5-all-site.log` |
| 段7の全試験2回目 | サイト607 / 607 / 0、Worker347 / 347 / 0 | `step-7-all-site.log`、`step-7-all-worker.log` |
| 反映前の最終 | サイト607 / 607 / 0、Worker347 / 347 / 0 | `final-all-*.log` |
| 独立reviewの指摘の反映（RV45-01・03）のRED | contact-form 28 / 26 / **2**（追加した2件だけ失敗） | `p04-rv45-01-03-red.log` |
| 同GREEN | contact-form 28 / 28 / 0 | `p04-rv45-01-03-green.log` |
| 最終（上の表） | サイト609 / 609 / 0、Worker347 / 347 / 0 | `p04-final-all-*.log` |

段5後の1回目の失敗2件は、`site-shell.test.mjs`の「Profile・Contact以外の`main`は基準と同じ」の期待が、段4・5で変わったProfile・Contactの`main`に当たったためです。計画§5のとおり段6でその例外を足し、検査は`profile-contact-shell.test.mjs`の肯定的な検査へ移しました。既存の試験を削って合わせたのではありません。

## RED→GREEN

focused testは、実装より先に書いて失敗（RED）を確かめ、実装後にGREENにしました。

| 段 | 試験群 | RED（tests / pass / fail） | GREEN（tests / pass / fail） |
|---|---|---|---|
| 2〜3 | T45-PROF-DATA・T45-PROF-LINKS・T45-PROF-STATE（`profile-rendering.test.mjs`、2段分を同時に書いたため1本のRED） | 43 / 2 / 41（`step-2-red.log`） | 107 / 107 / 0（`step-2-3-green.log`。`home-rendering`を同時に実行。最初のGREEN試行は104 / 3失敗で、原因は試験側の2点＝名前に「x」を含む試験の入力と、Homeを動かす仮DOMに`globalThis`が無かったこと。コードは変えず試験を直した。`step-2-3-green-attempt1.log`） |
| 4 | T45-CON-SETTINGS・T45-CON-SEND（`contact-form.test.mjs`の前半）と`public-music-data-compatibility` | 25 / 11 / 14（`step-4-red.log`） | 25 / 25 / 0（`step-4-green.log`。`public-music-data-compatibility`は仮DOMに`setTimeout`・`clearTimeout`を足して通した） |
| 5 | T45-CON-VALID・T45-CON-FAIL・T45-CON-DONE・T45-CON-DOUBLE（後半） | 69 / 58 / 11（`step-5-red.log`） | 69 / 69 / 0（`step-5-green.log`） |
| 6 | T45-STYLE（`profile-contact-shell.test.mjs`）と、関連の既存試験 | 163 / 155 / 8（`step-6-red.log`。失敗はT45-STYLEの8件） | 163 / 163 / 0（`step-6-green.log`。最初のGREEN試行は3件失敗で、原因は新しいT45-STYLE試験側＝許可するpxにスケール値を入れ忘れたことと、PC用・スマホ用の規則を区別していなかったこと。CSSは変えず試験を直した。この試行のlogは上書きされて残っていない） |

注記:
- T45-CON-SENDの1件は、旧`contact.js`が既に同じ送り方をしているため、REDの時点から通っています（送り方を変えていないことを縛る試験）。
- T45-SHELL・T45-COMPATは、変えてはいけないものを縛る保護の試験なので、実装前から通り、REDにはなりません。T45-STYLEのうち「選択子がscope内」「色の直書きがない」の2件は、追加のCSSが空の間は何も見つからず、REDでも通っています。
- 段7の撮影script・fixtureは、構文と契約（`--self-check`）の検査です。ブラウザ試験ではありません。

独立reviewの指摘（RV45-01・03）の反映は、試験を先に足してREDを確かめました（`T45-CON-GUARD`は、送信に要る要素を1つずつ外したHTMLで、submitが`preventDefault`されず要求も出ないことを確かめる。`T45-CON-VALID RV45-03`は、失敗のあとに入力誤りを出すと失敗の知らせが隠れることを確かめる）。REDは、反映前のコードと同じ形に戻して2件の失敗を確かめたものです。

## 要件・AC別の証拠

| ID | 証拠（試験名は`test/`内） | 状態 |
|---|---|---|
| PS-PC-01 | T45-PROF-DATA（写真のsrc、文章の`textContent`・段落・改行・行頭「・」・`<`・CRLF・文字列`<br>`、依頼の入口）、T45-PROF-LINKS（基準commitの`profile/index.html`と`site-content.js`を同じ仮DOMで動かした「今のProfileの出力」の全件が、どのfixtureでも同じ並びで先頭にある） | 自動試験PASS |
| PS-PC-02 | T45-CON-SETTINGS（3項目の`id`・`name`・`type`・`required`・placeholder、導入文と`action`の反映、空の設定、読めない7通り、8秒、JS無しの標準form送信の構造）、T45-CON-SEND（送る先・メソッド・ヘッダー・キー3つ・networkへ出ない） | 自動試験PASS |
| PS-PC-03 | T45-CON-FAIL（通信の例外・HTTP 400・500・送信先が空・空白だけの各場合に、3項目の値が同一、固定の知らせ・`role=alert`、「もう一度送信する」、`readonly`解除、focus、再送で成功／再び失敗） | 自動試験PASS |
| PS-PC-04 | T45-CON-DONE（導入文とフォームが隠れ、完了の見出し・お礼・送った内容3行・「Home →」、`<script>`・`&`・改行が文字として出る、送信後に欄を書き換えても表示は送信時の値、`form.reset`なし、focusが見出し） | 自動試験PASS |
| PS-COM-02（Profile・Contact分） | T45-PROF-STATE（読み込み中・写真なし・写真の失敗・全体の失敗9通り・空・再読込の二重要求・古い応答・`pagehide`・`pageshow`・focus・Homeのprofile欄が無変更）、T45-CON-VALID・T45-CON-DOUBLE | 挙動は自動試験PASS。外観は未確認（Frontの撮影） |
| PS-COM-01（#45分） | T45-SHELL（ProfileとContactの`header`・`nav`・ロゴ・`footer`・`head`が基準commitとbytes一致、5項目ナビ、scriptの並び）。現在地は既存のT44-SHELL（`/profile/`・`/contact/`）が無変更で通る | 自動試験PASS。Menuの画像は未確認（Front） |
| AC45-LINKS | T45-PROF-LINKS（本番の形で5件・並びがHomeと同じ・表記Bandcamp、Siteだけ・Profileだけ・両方・5種類以外・重複・不正URL・名前が空・配列でない、Homeの出力が無変更） | 自動試験PASS。本番データでの件数はFrontが確認 |
| AC45-COMPAT | T45-COMPAT（Home・Music・Live・Live詳細・Ticket・Ticket完了・旧2ページの`main`が基準commitとbytes一致、共有assetのcache queryが全10ページで変わらず`contact.js`だけ新しい、live-operations・music-data・home-player・script・site-config・tokens・`DESIGN_RULES.md`・`admin/`が基準commitとbytes一致、`admin/`・`cloudflare/`・`data/`に差分なし、`site-content.js`は「Issue #45」のまとまりと分岐2行を除くと基準commitと同じbytes）。Home・Music・Live・Ticketの既存試験が無変更で通る | 自動試験PASS |
| AC45-STYLE | T45-STYLE（基準commitのCSSが先頭に残る、1つのまとまり、全選択子が`body.site-profile`／`body.site-contact`で始まる、色の直書きがない、`--accent`・`--accent-soft`・影のtokenを使わない、スケール外のpxは56と6だけでそれぞれ1回・指定の規則とproperty、マスタの寸法364・4/5・52・136・560・820、全体の`form`の規則の打ち消し、誤りのある欄だけ`--ink`の枠、`:disabled`の`opacity`を宣言しない） | CSSの文字列はPASS。描画結果は未確認（Frontの撮影数値） |
| AC45-PROD | Frontの画面確認（`code-generation-summary.md`の「本番の公開データでの画面確認」。値は書かない） | 実施済み。Profile・Contactとも1440/390で読み込め、写真は枠に収まり、文章は段落2つのまま、links 5件、横scrollなし、名前が2回出る（確認2でお伝えする）、Contactの送信先は設定とページの既定の両方と一致、項目3つ、送信していない |
| AC45-RELEASE | PRのbase・Project Review・Owner merge gate・rollback・#43との重なりは計画§7・§9。本書では確認していない | 独立reviewで文面を確認（OK） |

## canonical・承認記録の照合

| 項目 | 結果 |
|---|---|
| 承認記録3件（`approvals/01〜03`） | `aidlc-cycle.sh`の`validate_approval`の本体を読み出して実行し、Requirements・Workflow Plan・Code Generation Planの3件ともPASS。Approval promptは`gate-123-prompt.md`（SHA-256 `e8e5531e…`）を逐語で入れ、raw responseは`A`、timestampsはPrompt 2026-11-19T19:56:58+09:00・Response 2026-11-20T08:42:28+09:00、Approver Itsuki Matsumoto |
| 昇格前の元版 | `public-site-ui.md` `1aa471eb…`・`README.md` `8ecd9e3c…`。ともに計画§3の値と一致（昇格の前に確認） |
| 昇格後 | `public-site-ui.md` `56fd415e660dc4899dc5d6930e3dd06df2d40c2fd347943b0cdbb93b88184b3f`、`README.md` `58453fcc636245bc91367255cfbdcca73a0d9a943c95af0739e2f175907837dc`。計画の提案版と一致、提案版との`cmp -s`も一致 |
| 承認済みartifactのbytes | requirements `e3f73507…`、execution-plan `7830cef7…`、Code Generation Plan `99a1f2bd…`、`figma-fix-requests.md` `510b45af…`、提案版2ファイル。すべて承認時のSHA-256のまま |

## 変更範囲

`git status --short`の結果です（承認記録・昇格・実装・試験・結果文書だけ。`aidlc-docs/README.md`はcycle開始時のscriptの更新）。

- 変更: `assets/css/style.css`、`assets/js/contact.js`、`assets/js/site-content.js`、`contact/index.html`、`profile/index.html`、`docs/specs/current/public-site-ui.md`、`docs/specs/current/README.md`、`test/public-music-data-compatibility.test.mjs`、`test/site-shell.test.mjs`、`aidlc-docs/README.md`
- 新規: `test/contact-form.test.mjs`、`test/profile-rendering.test.mjs`、`test/profile-contact-shell.test.mjs`、`test/profile-contact-dom.mjs`、`test/fixtures/profile-contact-states.json`、`aidlc-docs/`配下（承認記録・計画の候補・本書・Code Generation Result・cycle-summary・撮影script・log）
- 触れていない: `assets/js/live-operations.js`・`music-data.js`・`home-player.js`・`script.js`・`site-config.js`、tokens、`DESIGN_RULES.md`、`admin/`、`cloudflare/`、`data/`、Profile・Contact以外のHTML（T45-COMPATが基準commitとのbytes一致で確認）

## 本番の値の非混入

試験・fixture・文書・scriptに、本番の文章・URL・写真のpath・導入文・送信先のidを写していません。試験は`contact/index.html`の埋め込みの導入文と送信先を、基準commitのファイルから実行時に読んで比べます（値は保存しません）。失敗の出力を保存したlog 2本（`step-4-red.log`・`step-5-all-site.log`）には、埋め込みの値が出ていたため、保存後に`<embedded-endpoint-id>`・`<embedded-intro-sentence>`へ置き換えました。fixtureは`example.test`の架空の値だけで、`--self-check`も`example.test`以外のhostがないことを確かめます。

## closeの書式の事前検査

使い捨てのコピー（`aidlc-docs/`の写し）に、gate 4・5の仮の承認記録（「DRYRUN ONLY」と明記）とCompleteのstateだけを置き、`aidlc-cycle.sh`から読み出した`validate_close_ready`を通しました。本物の`aidlc-docs/`には仮の記録もCompleteのstateも置いていません（gate 4・5の記録は無く、stateは`Code Generation Result`・`Pending`のまま）。`scripts/aidlc-cycle.sh close`は実行していません。

| 項目 | 結果 |
|---|---|
| `validate_close_ready`（コピー） | PASS。`Blocking Findings: None`のfield形式（Build/Test Resultとcycle-summary）、承認5段のchecked・mapping、gate 1〜3の記録（本物をコピー）と仮のgate 4・5の記録のdigest・prompt・`A`の書式、未チェックの必須作業なし、を含む |
| 本物のgate 4・5の記録 | 存在しない（PASS） |
| 本物のstate | `Code Generation Result` / `Pending` のまま（PASS） |
| log | `verification/logs/close-dryrun.log`（検査した本書・Code Generation Result・cycle-summaryのSHA-256を記録）。コピーと手順は作業用の一時directory（`close-dryrun/`）にあり、repoには入れていません |

独立reviewの指摘の反映と結果文書の更新のあとに、同じ手順をやり直しました（`verification/logs/close-dryrun.log`を更新。検査した3文書のSHA-256を記録）。closeの書式の検査はコピーでの事前検査です。実際のgate 4・5の記録とcloseは、Frontの確認とOwnerの承認のあとに行われます。

## 残る確認とGap

- 独立reviewの指摘の反映（RV45-01・03・04・05）のあとの再撮影51枚: Frontが実施しました（2026-11-20）。51枚すべて自動の合否を通過し、本番の送信先へのrequestは0件、想定外のconsoleエラー・pageエラーも0件でした（作業ファイルの`capture-front-3.log`）。反映後のコードで本番の公開データの画面確認も流し直し、結果は前と同じでした。
- 同じfontでの文字確認（Frontの撮影はfontの同版のcacheがなく代わりのfontだったため、文字の最終受入は未確認）、`render-31-*.png`との照合。fontが違う環境では、文字の折返しと行数は合否にしません。
- 独立reviewのReviewerのsessionでは`Bash`が使えず、試験の独立実行・SHA-256の再計算・画像の確認はしていません。Frontが確認2の前に照合しました（試験はサイト609件・Worker 347件とも失敗0、承認時のSHA-256と設計書の昇格が一致、承認記録3件の提示文が原典と逐語一致、全画像を目視）。
- 実際のブラウザでのe-mail形式の検査は、Frontの撮影（`contact-invalid-*.png`）で確認済みです。試験の仮DOMは同じ文法の再現です。
- 既知の制限: 送信先が応答しない時は「送信しています…」が続く／Formspree側の入力検査エラーは「送信できませんでした」の1種類／`a@b`のような形はブラウザの標準検査を通る／（RV45-02）`contact.js`が読み込まれない時は、HTMLの`novalidate`のためブラウザの必須・e-mail検査が働かない／（RV45-06）Profileに登録したlinksのうちhttp(s)以外は出さない。
- #43との重なりの取り込みは、後から入る側がPRの時に行う。
- Owner承認（gate 4・5）と本人確認は、Frontの確認を終えたあとの確認2です。確認2でお伝えする2点（R45-06の「名前と依頼の入口だけ」の意味、本番の公開データで名前が2回出ること）は`code-generation-summary.md`にあります。
