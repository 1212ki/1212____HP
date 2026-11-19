# Music・5項目ナビの検証結果（Build/Test Result）

修理と独立review2回を終えた最終の実装で、サイト全513件、Worker全347件の試験が失敗0で通りました。Frontの撮影56枚（script内の判定はすべて通過）の全目視と、本番の公開データでの確認も済んでいます。実音と実際のfontでの確認は、まだです。

- **Blocking Findings**: None
- Cycle: `2026-11-18_issue-44_music`
- 対象: `feature/44-music` / base `080325887576655f27461cb15f28a3c590a292ee`
- reader_profile: audience_class=hybrid / language=ja-JP / review_surface=notion_paper（Front投影） / reader_ready=true / open_status=not_opened
- 実装・自動検証・撮影・本番データの確認・独立review2回: 完了。gate 3の再承認・gate 4・gate 5・Front completion・close・PR・merge: 未成立。

Blocking Findingsは、既知の実装・自動試験・独立review2回に、未解消の阻害所見がない意味です。実音・実fontの未確認と、下の既知の制限をPASSにはしません。

## 実行した試験

execution targetからNode v20.19.4で実行しました。dependencyのinstall、外部network、Worker deployは行っていません。静的HTML/CSS/JavaScriptのため別bundle buildはありません。logの`tests/pass/fail`を採用します。

```bash
export PATH=/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH
node --test test/
npm --prefix cloudflare/worker test
```

最終の結果です。最後のコード変更（Worker 06aの修理）のあとに、Frontが2026-11-19に再実行して同じ件数を確認しました。

| 区切り | command | tests / pass / fail | exit | log（`construction/aidlc-integration/`から） |
|---|---|---|---|---|
| 最終・サイト | `node --test test/` | 513 / 513 / 0 | 0 | `verification/round5-all-site.log`（修理直後は`round4-all-site.log`） |
| 最終・Worker | `npm --prefix cloudflare/worker test` | 347 / 347 / 0 | 0 | `verification/round5-all-worker.log`（修理直後は`round4-all-worker.log`） |
| 最終・構文 | `node --check`（site-content / home-player / music-redirect / script） | 全件 exit 0 | 0 | `verification/round5-check-js.log` |
| 最終・空白 | `git diff --check` | 指摘なし | 0 | `verification/round5-diff-check.log` |
| 最終・整合 | `scripts/aidlc-verify.sh --local` | 通過 | 0 | `verification/round5-local.log` |

途中の区切り（第1版の記録を含む）です。

| 区切り | tests / pass / fail | log |
|---|---|---|
| 着手前（Front報告の基準） | サイト377 / 0失敗、Worker347 / 0失敗 | — |
| 段4後（第1版） | サイト436 / 436 / 0、Worker347 / 347 / 0 | `step-4-all-site.log`、`step-4-all-worker.log` |
| 段6後・第1版の最終 | サイト492 / 492 / 0、Worker347 / 347 / 0 | `step-6-all-*.log`、`final-all-*.log` |
| 第2版・段9後 | サイト511 / 511 / 0、Worker347 / 347 / 0 | `round2-all-site.log`、`round2-all-worker.log` |
| 修理（review 2回目の指摘）後 | サイト513 / 513 / 0、Worker347 / 347 / 0 | `round4-all-site.log`、`round4-all-worker.log` |

全試験にskip・cancel・todoはありません。サイトの件数が492→511→513と増えたのは追加だけで、既存の試験は削っていません（段9で、旧寸法310を縛っていた既存の期待1件だけを、新寸法を縛る形に改めました）。段1のcharacterizationは`node --test test/music-data.test.mjs test/home-player.test.mjs test/home-rendering.test.mjs`で75/75/0です（`step-1-characterization.log`）。

focused 10ファイルのcommand（第2版・段9後に299/299/0、`round2-green-focused.log`。第1版の最終は280/280/0、`final-focused.log`）:

```bash
node --test test/music-rendering.test.mjs test/music-player.test.mjs test/music-redirect.test.mjs test/music-data.test.mjs test/home-rendering.test.mjs test/home-player.test.mjs test/site-shell.test.mjs test/public-music-data-compatibility.test.mjs test/public-ticket-routing.test.mjs test/admin-image-form.test.mjs
```

## RED→GREENの記録

各段で新しいfocused assertionが失敗することを確認してから実装しました。logはすべて`construction/aidlc-integration/verification/`にあります。

第1版の段2〜6:

| 段 | RED pass / fail | GREEN pass / fail | 時系列log |
|---|---|---|---|
| 2 | 3 / 8 | 11 / 0 | `step-2-red.log` → `step-2-green.log` |
| 3 | 80 / 14 | 94 / 0 | `step-3-red.log` → `step-3-green.log` |
| 4 | 27 / 32 | 59 / 0 | `step-4-red.log` → `step-4-green.log` |
| 5 | 13 / 42 | 53 / 0 | `step-5-red.log` → `step-5-green.log` |
| 6 | 115 / 24 | 139 / 0 | `step-6-red.log` → `step-6-green.log` |

修理（第2版以降）:

| 修理 | command | RED pass / fail | GREEN pass / fail | log |
|---|---|---|---|---|
| 段9（PC幅のプレーヤー・RV44-06・RV44-07） | `node --test test/music-rendering.test.mjs test/site-shell.test.mjs test/music-player.test.mjs` | 97 / 17（全114件） | 114 / 0 | `round2-red.log` → `round2-green-focused.log`（focused 10ファイルは299 / 0） |
| RV44-10（retry成功後のfocusがhashの位置を戻す） | `node --test test/music-rendering.test.mjs` | 63 / 1（全64件） | 64 / 0 | `round4-red.log` → `round4-green-focused.log` |

段9のREDの17件は、T44-LAYOUT 10・T44-FOCUS 3・T44-A11Y 1・寸法のSTYLE 3です（そのうち1件は旧寸法310を縛っていた既存の期待で、新寸法を縛る形に改めました）。RV44-10のREDは、修正を戻して実行した記録です。RV44-11は試験の緩みの修理で、試験自体を強くしたためREDを置いていません。

段2〜6の説明: 段2はMusicページ・renderer不在、段3はMusic adapter・click配線不在、段4は失敗/空/再試行/復帰/hashの未実装、段5は旧HTMLの誘導不在、段6は5nav/CSS/現在地/管理説明の未移行を検出しました。既存試験を削って合わせず、旧2本文の期待のみ承認済みの旧URL互換へ移しています。

第1版の時系列logはshellの末尾が`tail`だったため、Node exitを個別には保存していません。`focused-ledger.json`はこの区別を明記しています。後に許可済みの使い捨てcopyで実装前の機能境界を復元し、REDのNode exit=1を5群とも直接測定しました（`step-2〜6-red-exit-replay.log`）。これは元の時系列logの差し替えではありません。段6の途中で、試験harnessの修理（`step-6-attempt-1.log`）と、mobile navがMusic内リンクを隠す問題の追加RED（35 pass / 1 fail、`step-6-nav-css-red.log`）を経ています。

## 受入条件ごとの証拠

「撮影」はFrontの56枚（script内の判定はすべて通過し、全目視済み）、「本番データ」はFrontの本番の公開データでの確認です。実音と実fontは、どの行でも未確認です。

| ID | 自動検証・sourceの証拠 | 画面・本番データ・reviewの結果 |
|---|---|---|
| PS-M-01 | T44-DATA。実HTML/source VMで4作品・5映像・channel、区分と登録順、helper日付sort/同日安定/非破壊、説明・escape・metadata、同一映像の重複掲載。 | 撮影で表示を目視。本番データで、PC・390pxの表示、並び、横のはみ出しなし、画像の読み込み失敗0、consoleのerrorなしを確認。独立review 1回目も本番データの画面を見てOK。 |
| PS-M-02 | T44-PLAY/DATA。全作品の安全な配信/購入先、click同期iframe、unmuted autoplay要求とallow/allowfullscreen/referrerpolicy、0→1→1→0、同じ映像の別起点。 | 本番データで、PCの作品480×270・映像474×267、390pxは358×201で、YouTubeの操作部品が欠けずに出る。**実音は未確認**。iPhone追加tapは受入済みQ42-01を継承。 |
| PS-M-03 | T44-LEGACY。2path×index有無×query/hash、固定replace 1回、assign不使用、不正destination拒否、常時リンク・noindex/canonical、旧HTMLのGETなし、Music noscript。T44-STATEで不存在/空hashはreplaceで上部へ。 | 本番データで`/discography/` → `/music/#release`、`/youtube/` → `/music/#video`を確認。JS有/無の旧URL 8枚を撮影・目視。HTTP 301や検索移転成功は主張しない。 |
| PS-M-04 | T44-STYLE。旧CSS全bytes保持、Music scope、追加accent指定なし、モノクロfocus/selection/scrollbar、共通部品/ロゴの保護。F44-01〜07をCSSへ反映。 | 撮影で、赤が見出しの線以外に出ないこと、重なり・はみ出しなしを目視。**文字は代わりのfontでの確認**で、実fontの字形・折返しは未確認。 |
| PS-COM-01（#44） | T44-SHELL。10HTML×5label/順序/解決先、PC/Menuの同一DOM、5link各閉動作、Escape/resize/focus、Ticket系/旧URLのcurrent/aria、ロゴblock不変。 | 撮影のMenu 3枚・他7ページのsmoke 14枚を目視。本番データでナビ5項目と今いるページを確認。 |
| PS-COM-02（Music） | T44-STATE/PLAY/FOCUS/A11Y。S44-01作品再生、02未選択/dangling/不正ID、03動画再生復元、04各空区分/channel、05emptyとHTTP/JSON/network/構造/描画error、06画像未登録/不正/error、L busy/skeleton。二重GET抑止・serial・pagehide/pageshow・listener1回、retry後のfocus、読み上げ名。 | 7状態（loading・empty・error・画像未登録・画像不正・長い題名ほか）の撮影を目視し、崩れなし。 |
| 第2版の寸法（Ownerの決定） | T44-LAYOUT（宿の位置、列数1〜4×作品の番号でgrid-row、狭い幅、resize、測れない時）、寸法のSTYLE（作品の宿480、映像2列474・間隔32・最小の高さ200・820px以下の1列、Homeのプレーヤーのbytes不変）。 | 撮影で、1440pxの作品480×270が並びのすぐ下、映像2列474×267・間隔32、390pxで358×201、360pxで328×200、821・1024pxで映像2列を実測。本番データでPCの作品480×270・映像474×267を確認。 |
| AC44-HOME | Home mainはmusic →のhrefだけが差分。既存Home rendering/player回帰、Home↔Musicの相互排他、非リンクカード/2件/顔/操作/停止を保護。 | Homeの撮影2枚を目視。Homeの実音は未確認。 |
| AC44-ADMIN | T44-ADMINと既存admin試験。6tab・modal・保存・admin assets bytes不変。READMEにDisco/YouTube/#47、#43/まとめ出しと履歴を最小修正。 | 独立review 1回目が、READMEの文言と実態（公開5項目、管理6タブ、統合は#47）の一致を確認。 |
| AC44-COMPAT | T44-STYLE/COMPAT、下の6mainのhash、固有script順/queryと実在、全Node/Worker試験、変更範囲。 | 他7ページの撮影を目視し、第1版と同じ見た目。 |
| AC44-PROD | 架空fixtureは作品2+2・映像2+2+1、種別1/選択1、空説明/番号2・4行、24文字以上/ASCII引用符/slash、相対画像、同一映像の2起点を再現。分類の形だけ使用。 | 本番データのPC・スマホ表示、リンク、画像、再生の操作部品をFrontが確認（値はrepoに写していない）。**実音は未確認**。 |
| AC44-RELEASE | 承認済み計画§7〜9と管理README。PR base `feature/39-public-pages`、#44単独mergeで本番変更なし、mainへのまとめ出しと2時点のrollbackを区別。 | 独立reviewで公開・復旧の記述を確認。Owner判断・統合・公開は未成立。 |

## 独立reviewの扱い

Claudeのread-only Reviewerが2回見ました。どちらも試験・`git diff`・SHA-256の再計算を実行できない環境で、コードと文書とlogを読んでの判定です。

| 回 | 時点 | 判定 | 指摘と扱い |
|---|---|---|---|
| 1回目 | 実装後 | APPROVED、blockingなし | RV44-01 結果文書が事実と食い違う → 本書とCode Generation Resultで閉じた。RV44-02 PCの寸法 → Itsukiの決定で解消。RV44-03〜05 → 指摘にしない判定。RV44-06・07 → 第2版の修理で直した。 |
| 2回目 | 修理後 | APPROVED、blockingなし | RV44-08（PCでTabの順と見た目の順がずれる、low）→ 既知の制限として伝える。RV44-09（Requirementsの「作品直下」と決定「並びの下」、medium・非blocking）→ Requirementsは変えず、確認2の提示文で読み方を示してAで確認する。RV44-10・11（low）→ 直した。FO7（Homeのプレーヤーの最小の高さ）→ 事実として伝える（#44では変えていない）。 |

## 承認原典とcanonicalの照合

`approvals/01-requirements-approval.md`、`02-workflow-plan-approval.md`、`03-code-generation-plan-approval.md`は、原典の完全prompt・raw A・Approver・両timestamps・digestを逐語で持ちます（第1版の記録）。原典ファイルのSHA-256、回答時の3artifact digest、各recordから取り出したprompt bytesと原典、raw source全文を照合し、実`aidlc-cycle.sh`の関数を無変更で抽出したharnessで`validate_approval`を3回呼び、すべてPASSしました（`approvals.log`、第1版の時点）。自己承認や回答の言い換えはありません。

**gate 3は再承認待ちです。** 承認記録03は第1版のdigest（plan `f462589b…`）の記録として残しています。いまのCode Generation Plan（第2版、`e9ce7059…`）は03のdigestと一致しないため、このままcloseを呼ぶと止まります。再承認で第2版のdigestの記録が置かれるまで、gate 3は成立していません（下の事前検査の対照で確認）。gate 1・2のRequirements・Workflow Planのbytesは確認1のままで、記録01・02のdigestと一致します。

3canonicalは、昇格前のhashが計画§3の元版と一致することを先に検査し、提案版のexact bytesをcopyした後にSHA-256と`cmp -s`一致を検査しました（`promotion.log`）。第2版では、public-site-uiの提案版（`1aa471eb…`）を同じbytesへ置き直し、3ファイルとも`cmp -s`一致を確認しました（`round2-promotion.log`）。第1版の写し3件は`superseded/`にあり、元のSHA-256と一致します。Figma v2・v3の`SHA256SUMS`とv3の差（E7a〜E9だけ）も照合済みです。

## 6ページの本文保護

`test/site-shell.test.mjs`がbase commitの`main`全bytesを保護し、最終の全試験（513件）でも通っています。独立した照合の記録は`main-compatibility.log`です。

- `live/index.html main_sha256=9b1d0308042420d4e489a49dab6a4999c51c31d376fdfce03da4a1834842de8b base_bytes=PASS`
- `live/detail/index.html main_sha256=ec06d17fa642da178c437eb72222409d469fa2123b554e2f1e9ac20dcad8ba50 base_bytes=PASS`
- `ticket/index.html main_sha256=21052f7bdb3c106c7bc4f43b87dd0274478546d1948107fb8a6284c3e52dd45e base_bytes=PASS`
- `ticket/complete/index.html main_sha256=35e145e4cacb30ace009620f4588231715533ef98bbd47591d1a564bf0b1761a base_bytes=PASS`
- `profile/index.html main_sha256=a4759f14cfa08cc1e784f517c32672bee332ed02b72f464c0aa5d320b36325b3 base_bytes=PASS`
- `contact/index.html main_sha256=84a7205bc221b35f8458bc378148243020dd8155fa865ab4800740694b61f53d base_bytes=PASS`

Homeの意図したhref以外のmain、各既存ロゴblock、既存CSS全bytes、tokens/DESIGN_RULES/MusicData/LiveOperations/site-config/admin機能、Cloudflareの変更なし、Homeのプレーヤー（`.home-player`）のCSS不変も検査しています。

## 構文・運用・範囲の検査

- `scripts/aidlc-verify.sh --local`: exit 0（`round5-local.log`）。local integrityであり、networkによるsource再検証ではありません。sandboxでは`diff <(…)`と`mktemp`に使い捨てのshimが要り、scratchに置いて使いました（scriptは無変更）。
- `scripts/aidlc-cycle.sh status`: exit 0（`round5-status.log`）。確認2の待ちを示し、Cycle Statusはin Progress。
- 許可される変更は計画§3の25ファイルと`aidlc-docs/`のみ。6対象HTMLではnavと共有queryだけを変更し、旧2HTMLと新Musicは計画どおり例外としています。変更範囲は`round5-git-status.log`。
- fixtureのタイトル/id/URL/日付は架空で、本番の公開データのraw JSONを読まず、値をrepoへ写していません。capture scriptもそのfixtureだけを使います。

## 撮影scriptと実行環境

`verification/capture-music.py`と`test/fixtures/music-states.json`で、Frontが次の1行を実行しました。

```bash
/usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-music.py --serve
```

13variant・56画像（第1版の55枚に、360px幅の1枚を足した）です。画像は`verification/screenshots/`、metricsは`capture-music-metrics.json`、logは`capture-front-3.log`。各section/画像/title/meta/操作/player/navのbox・computed値・文字nodeの実行数、console/pageerror/script異常、横overflow、寸法と隠す条件を記録します。localhost公開HTML/assetsだけを配信し、公開APIはfixture fulfill、YouTube iframe/thumbnailはローカルstub、他外部requestと非GETは遮断します。外部fontは遮断するため、文字は代わりのfontです。

3回目（`capture-front-3.log`）がいまの受入の根拠です。1回目（`capture-front-1.log`、55枚）は第1版の寸法の記録です。2回目（`capture-front-2.log`）は、再生中に隠れたサムネイルまで寸法を判定するscriptの誤りで止まり、判定を`visible`の要素だけに絞って直しました（基準の474/358・267/201・許容差2は不変。自己検査は`round3-capture-contract-check.log`）。

## closeの書式事前検査

closeの書式事前検査: PASS / exit 0（`verification/round5-close-precheck.log`）。**これは書式の事前検査で、承認ではありません。**

使い捨てcopy（`_scratch/codex-work/20261118-110045_1212hp-44-music/worker-06b-tmp/precheck/`）へこの回の`aidlc-docs/`と`scripts/`を写し、copyの中だけで次を置きました。

- 仮の承認記録: 03（Code Generation Plan第2版のdigestで）・04・05。すべて「DRYRUN ONLY」と明記し、Approverも仮の名前です。Itsukiの回答ではありません。
- Complete stateの仮のstate。
- gate 1・2の記録は、絶対path fieldだけをcopy先へ向けました（原典promptとdigestは保持）。

実`aidlc-cycle.sh`の`generate_manifest`より前の関数を無変更で抽出し、`AIDLC_REPO_ROOT`をcopyへ向けて`validate_close_ready`だけを呼びました。確認した書式は、Blocking Findingsのfield形式、未チェックの項目、REQUIREDの対応と各1回、SKIPの理由、空のAnswer、承認記録のdigest・prompt・A/B/Xの形です。

- 対照: 仮の記録を置く前のcopyでは、gate 3のdigest不一致で止まりました。第1版の記録03と第2版のplanが合わないことを、事前検査が実際に見ていることの確認です。
- 本物の`aidlc-docs/`の前後のhash一致（state・承認記録01〜03は事前検査の前後で同じ）、本物の04・05と仮の記録が無いこと、`close`を実行していないことも、同じlogで確認しました。

実際のcloseは、確認2でItsukiのAが記録され、独立review・Front completionがそろったあとにFrontが扱います。第2版の承認記録の置き方（03を第2版のdigestの記録にする）はFrontの手順です。

## 残る確認と結果の境界

- **未確認**: 実音、実際のfont（字形・折返し）。
- **未成立**: gate 3の再承認、gate 4・5、Front completion、cycle close、PR、merge、本番への反映とIssueのclose。
- **既知の制限**（Code Generation Resultに詳細）: PCでTabの順と見た目の順がずれる（RV44-08）、最初の取得に失敗したあと旧アドレス経由のhashへ戻らない、並びをまたぐ5件以上の作品は列数ごとの試験だけで縛っている。Homeのプレーヤーの最小の高さ（FO7）は#44の範囲外。
- 本番のタイトル・日付・URL・映像idをrepoや承認promptへ保存していません。iPhone追加tapはQ42-01の受入範囲を継承します。

root READMEの旧構成木や過去trace、承認済み計画とcanonical内の比較時点の未実装表は保持しています。現在の進行は3承認record・state/audit追補と結果2文書で示し、実装候補・review・承認・Front completionを区別します。
