# Homeと共通の外枠の実装結果（Issue #42）

Homeを作品中心の構成へ変更し、作品を聴く操作、次のライブ、news、ほかの作品、紹介、外部リンクを実装しました。全9ページのヘッダー・フッター・Menuも更新しました。Home以外の本文8件は変更前のbytesと一致しています。

初回の独立reviewの修理は、Frontの再撮影52枚と2回目の独立review（APPROVED）で確認済みです。その後Frontが実データ表示で見つけたnews日付の折返しFR-N1と、修理後の54枚の撮影で見つけた行ごとの本文位置のずれFR-N2を修理しました。自動試験は通過しています。**今回の日付修理後の撮影・再確認と、確認2のPC・スマホ表示・実音の最終確認が残っています。** 本文はgate 4の承認候補で、Owner承認・Front受入は未実施です。

- Cycle ID: `2026-11-17_issue-42_home`
- Stage: Code Generation Result / 承認待ち
- reader_profile: audience_class=human_reader; language=ja-JP; review_surface=notion_paper（Frontが提示）; reader_ready=true; open_status=not_opened
- 実装の正本: 承認済みCode Generation Plan、昇格後の設計書3件、Figmaマスタv2。承認済み入力のbytesは保持しています。
- 試験対象の特定: `../verification/implementation-manifest.sha256`に実装・試験・設計書のSHA-256を記録しています。

## 変更後の表示と操作

顔にする作品は既存の共通処理で選びます。作品名は登録どおりに表示し、種別と日付を別に表示します。残る作品は日付順に最大2件です。「聴く」は選択した映像を3カテゴリから解決できる時に表示し、押したclickの中でiframeを生成して有音再生を要求します。「閉じる」、再描画、再読込、ページ遷移時にはiframeを破棄します。Menuの開閉では再生を維持します。実際に音が出るかは端末での確認が必要です。

次のライブはupcomingの先頭を既存の並べ方で選び、日付・会場・タイトルと共通formatterの詳細を表示します。内部予約、外部予約、受付終了、不正予約URLを分け、識別できない公演には予約リンクを作りません。upcomingが空の時は未定の文と過去の全件への入口を表示します。

newsは日付の新しい順に最大6件で、説明全文と登録リンク文言を表示します。画像は出しません。profileは最初の段落、linksはSite優先・Profile補完で5種類の入口を扱います。未登録・不正な外部URLは表示しません。footerは設定された全文を表示します。

読込中と10状態を分け、取得失敗を空件数に置き換えません。Liveだけの失敗は他の内容を保ち、同じ公開GETで再試行します。全体失敗は1つの知らせと静的なBandcamp・YouTube入口を表示します。再試行中の連打を抑止し、ページを離れた後の遅い応答を反映しません。通信待機中の離脱ではbusyとdisabledを解除し、bfcacheから戻った場合に初回取得またはLiveの再試行を再開します。

外枠は白地・細い線・モノクロの文字で統一しました。既存6項目のナビと階層別の行き先を保ち、狭い幅ではMenu／閉じる・Escape・リンク選択・resizeを同期します。ロゴの赤いiと波紋・26個の音符のコードとanimationは保持しています。赤いhover線を外し、Homeの赤は予約と主要見出しの線に使います。

## 承認と設計書の昇格

確認1のItsuki Matsumotoの回答`A`を、原典の完全prompt・時刻・digestとともにgate 1〜3の記録へ転記しました。`validate_approval`は3件ともPASSです。新しい承認の代行ではありません。

昇格前のcanonicalのSHA-256を計画§3と照合した後、次の3ファイルを提案版からcopyしました。提案版を残し、各昇格先は計画のSHA-256と一致し、`cmp -s`も成功しています。

| 昇格先 | SHA-256 |
|---|---|
| `docs/specs/current/public-site-ui.md` | `62f98fa71d78ba008b25219e57d574d58641ffdf8e8d3e69307c752ffafa9d14` |
| `docs/specs/current/live-operations-admin-ui.md` | `3d2bbcb5556b3cec861812836cc7f7c7cd81b0702fc80f6e5dbd9f8f3ac953a8` |
| `docs/specs/current/README.md` | `542d49ceb65c0aa5ba33ece3e9508d378cd009e1f7a5d9e40008083647467062` |

照合の詳細は`verification/promotion.log`、`approval-validation.log`、`integrity.log`にあります。実装開始前にこの一致を確かめています。

## 計画の8段と変更したファイル

| 段 | 実施した内容・ファイル |
|---|---|
| 1 承認と昇格 | `approvals/01`〜`03`の転記、設計書3件の昇格。変更前のHTML本文・script一覧を専用scratchへ保存し、既存試験44件を通過。 |
| 2 顔と骨格 | `index.html`にHomeの固定root・見出し・骨組み。`site-content.js`に顔とmusicの描画。`test/home-rendering.test.mjs`・`test/fixtures/home-states.json`に架空入力とDOM試験。 |
| 3 再生と作品リンク | 新規`assets/js/home-player.js`、Homeのclick delegation、安全な配信先／購入先、`test/home-player.test.mjs`。iframe同期生成、属性、1個制御、破棄・focusを検証。 |
| 4 ライブと掲載内容 | `site-content.js`のHome専用Live・news・profile・links。`public-music-data-compatibility.test.mjs`は実在する非Home DOMだけを保護する形に修理。Homeの旧「不変」期待はT42-DATA等へ対応。全試験を実施。 |
| 5 状態とretry | `site-content.js`の全体／局所失敗、busy、同時要求抑止、request serial、画像error。全S42と読込中のfocused testを実施。 |
| 6 共通の外枠 | 全9 HTMLのheader/footer class、既存script順を保ったcache query、`assets/css/style.css`の明示class、`assets/js/script.js`のMenu。`admin/index.html`と`admin/README.md`の画像・公開説明、`test/site-shell.test.mjs`。全試験を実施。 |
| 7 画面 | Worker時点ではlocalhost bind拒否で0枚。その後Frontが同じscriptで52枚を撮影。RV42-01〜07修理後の再撮影と2回目reviewは完了（APPROVED）。FR-N1後のFront54枚は判定通過。その画像で見つけたFR-N2の修理後はFrontが再撮影する。 |
| 8 結果 | 本文、Build/Test Result、cycle summary、state/audit、close書式の事前検査と実装manifestを更新。FR-N2修理後の独立再reviewはFrontが手配する。 |

共通部品は`.site-button / .site-chip / .site-text-link / .site-section-title / .site-release-card / .site-news-item`、補助ラベルは`.home-caption`です。旧本文用selectorは保持し、Home以外の本文には新部品を適用していません。既存のhelper・tokens・DESIGN_RULES・保存処理・Cloudflareは変更していません。

## Figmaとの対応と残る確認

v2の`SHA256SUMS`を照合し、1440／390の既存renderとlayout specを読みました。実装値は上段440/492・gap48、下段492/440・gap48、390の左右16、ジャケット358角、Caption／Label／Displayの寸法に対応させています。F42-01のロゴ維持、02の外部chip、03の公演名と一覧入口、04の画像代替、05のfooter全文、06の余白、07の見出し線と閉じる、08の16:9、09の共通詳細formatterを実装しています。

Workerの初回撮影はlocalhostをbindできず0枚でした。その後Frontが同じscriptで52枚を撮影しました（`capture-front-1.log`・`capture-front-2.log`）。Frontは時計の単位を1行修正し、`page.clock.install(time=1794916800000)`を`time=1794916800`にしました。Playwright for Pythonは数を秒として読むためです。この修正は保持しています。撮影時の`capture-metrics.json`のSHA-256は`1bbfdc6dfd66b03c02b8fb416bf04f06ed03fadc95d373c876b4f2f2a9ccd042`です。修正前のPS-H-01・02のbox判定は成功しました。

その52枚と原典・コードを使った初回独立reviewはREJECTEDで、RV42-01〜07を指摘しました。前回の修理で、チップの可視記号を除去し別タブのaccessible nameを統一、再生中のDOMを作品情報→プレーヤー→横並び操作へ変更し閉じるをSecondary化、作品0件では新作見出しと作品メタ・操作を隠して名前を独立表示、Menuの全行の下線と上下8px、作品見出し12px・次回見出し8px・news下16px/8pxを修正しました。閉じる時にはDOM順・play外観・focusを復元します。bfcacheの通信再開と、結果文書の撮影状況も更新しました。

撮影scriptの仮YouTube HTMLのUTF-8、待機routeの後片づけ、再生順・作品0件のassertは保持しています。

FrontはRV42修理後に同じscriptで52枚を再撮影し、判定はすべて通過しました（`capture-front-3.log`、撮影時`capture-metrics.json`のSHA-256 `709c904f51c9e7f13b1e34db6d709a65dacd21cbd636aaa441b4ba9d93ab4e96`）。独立reviewの2回目はAPPROVEDで、RV42-01〜07はすべてRESOLVED、新しい指摘はありません（root scratchの`review-02-result.md`）。その後、確認2の準備でFrontが本番の公開データを読むbranch画面を開き、newsの日付が語の途中で折れる問題FR-N1を見つけました。計画とfixtureが短い日付だけを想定していたことが原因です。

FR-N1では、日付欄を88pxから内容に合わせて広げ、上限を240pxまたは画面幅−236pxの小さい方にしました。390pxでは左右16px・間隔24pxを保ち、本文欄に180px以上を残します。Home専用rendererで空白ごとのまとまりをspanに包み、空白で折り返します。上限を超える1語だけは欄内で折り返します。原文の文字と空白・既存の並べ方は保持し、全行が通常のYYYY.MM.DDの場合は88pxと24pxの見え方を保ちます。旧`.news-*`は変更していません。

FR-N1修理後、Frontは文字nodeの行数を数えるよう撮影scriptを2か所修正しました。gridの行高まで伸びた日付要素の高さを行数と誤認したためです（`capture-front-4.log`は修正前の失敗、`capture-front-5.log`は修正後の54枚・全判定通過）。ただし画像では、各行が別のgridを持つため、1440pxの日付欄が88・100・181・215・240pxに分かれ、タイトルと本文の開始位置がそろわない問題FR-N2が見つかりました。

FR-N2では、`#news-items`を2列の親gridとし、全行をsubgridで同じ列に合わせました。表示中の最長日付に合わせた1つの幅を使い、下限88px・上限min(240px,画面幅−236px)、gap24px、390pxの本文180px以上を保ちます。全件がYYYY.MM.DD形式なら88pxです。短い日付が自由記述日付と混在する場合も同じ列幅です。語中折返しの制限・文字原文・上下padding16px・行の下線・390pxの行間8px・旧`.news-*`は保持しています。

**FR-N2修理後の撮影と再確認は、このあとFrontが行います（この文書の時点では未実施）。** 同じ`capture-home.py --serve`で、通常の画像に加え`home-freeform-news-dates-1440.png`（1440×900）と`home-freeform-news-dates-390.png`（390×844）を撮影します。追加の架空日付・長い1語を含め、日付要素と語の行数・幅・はみ出し、本文幅、通常日付88px・間隔24pxをassertし、`capture-metrics.json`へ記録します。新しい全撮影は54枚の予定です。今回のWorkerは新規撮影しておらず、FR-N1後の既存54枚・metricsを保持しています。撮影scriptには、全行の`.site-news-content`の左端の差が0.5px以内というassertを追加しました。Frontの文字nodeによる`lines`と高さ換算の`boxLines`は保持しています。

計画からの仕様変更はありません。撮影を未完として返す扱いは計画§6の環境例外です。ブラウザの有音autoplay制限に関する最新公式資料は外部network禁止のため未調査です。実データ表示の準備観察はFrontが実施しましたが、修理後のPC・スマホ画面と実機の音の最終確認は**未実施・確認2で行う**ものとし、Q42-01の追加tapの採否はItsukiの判断を待ちます。

FR-N2はHome newsの列指定だけの局所修理です。CSS focusedはRED 1 failからGREEN 1 pass、全試験はNode 377/377・Worker 347/347、構文3件・local verify・status・diff checkはexit 0。記録は`verification/fr-n2-results.json`と`fr-n2-red.log`・`fr-n2-green.log`です。承認済み計画・昇格した設計書とrenderer・fixtureは今回変更していません。
