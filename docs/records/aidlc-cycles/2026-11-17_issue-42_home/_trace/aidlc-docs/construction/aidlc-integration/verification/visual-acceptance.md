# 画面の検証状況

- status: visual_acceptance_pending
- ui_route: headless_acceptance:PS-H-01,PS-H-02,PS-H-04,PS-H-06,PS-COM-01,PS-COM-02
- 撮影画像: Worker時点0枚（localhost bind拒否）。その後Frontが52枚を撮影し、RV42修理後も52枚を再撮影済み。FR-N1修理後はFrontが54枚撮影済み（capture-front-5.log、全判定通過）。FR-N2修理後は未撮影。
- PS-H-01 box判定: 修正前1440×900は成功。RV42修理後は判定通過。FR-N1修理後も判定通過。FR-N2修理後は未取得。
- PS-H-02 box判定: 修正前390×844／390×667は成功。RV42修理後は判定通過。FR-N1修理後も判定通過。FR-N2修理後は未取得。
- 目視比較: 修正前52枚は独立Reviewerが比較しRV42-01〜07を指摘。RV42修理後の再撮影・2回目reviewはAPPROVED。FR-N1修理後は54枚・全判定通過。そこで発見したFR-N2修理後の再撮影・再確認は未実施。
- 実音・本番公開データ: 未実施・確認2で行う。

## 起動失敗の原典

実行command（execution targetから）:

```bash
/usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-home.py --serve > aidlc-docs/construction/aidlc-integration/verification/capture-attempt-1.log 2>&1
```

Worker時点ではexit 1、`socket.bind`で`PermissionError: [Errno 1] Operation not permitted`となり0枚だった（`capture-attempt-1.log`）。その後Frontが同じscriptで52枚を撮影した（`capture-front-1.log`・`capture-front-2.log`）。撮影時の`capture-metrics.json`のSHA-256は`1bbfdc6dfd66b03c02b8fb416bf04f06ed03fadc95d373c876b4f2f2a9ccd042`。Frontは`page.clock.install(time=1794916800000)`を`time=1794916800`へ1行修正した。Playwright for Pythonの数値は秒であり、この修正を保持している。

修正前画像の独立reviewはREJECTED。前回RV42-01〜07を修理した。撮影用仮YouTube HTMLにUTF-8、待機routeのabort・終了待ち、playerの順序・Secondary外観・作品0件の見出し非表示assertを加えた。その後の経緯と現在の残件は以下のFR-N1節に記録する。Workerは今回新規撮影を行っていない（ui_route=none）。

initial attemptは1回。別portや同じ権限での再起動がbind拒否を解消する根拠はないため、corrective retryは行っていない。別のUI routeへの切替も行っていない。

## Frontが続ける手順

localhost bindと既存Chromiumの起動を許可する実行環境で、同じexecution targetから上のcommandを実行する。依存のinstallは不要。自分でサーバーを立てる場合は`/usr/bin/python3 -m http.server 8888 --bind 127.0.0.1`を使い、capture scriptの`--serve`を外す。既存Chromiumの選択が必要なら`--chromium <installed executable>`を指定する。

scriptは`test/fixtures/home-states.json`だけを公開GETへ返し、localhost以外をabortする。YouTube iframeは通信を送らずダミーHTMLで返す。normalの5画像、Menuの3画像、12状態×2幅、中間幅2画像、ほか8route×2幅、長いタイトル2幅の計52画像に、FR-N1の架空日付シナリオ2枚を加えた54画像を予定している。状態名とファイル名は承認済み計画§6に合わせた。`screenshots/`と`capture-metrics.json`へ出力し、scrollY・scrollWidth・各box・font・pageerror・script失敗を記録する。

Frontは全画像を開いて、同じ幅のv2 renderと比較する。通常の初期画面だけでPS-H-01・02を判定し、Menu・loadingを混ぜない。各状態、PS-H-04の予約なし、PS-H-06の赤の範囲、PS-COM-01の6項目と短い高さのMenuを確認する。外部font遮断時は厳密な字形・折返しの受入を分ける。9routeの外枠と本文smoke、pageerror・予期しないconsole error・script取得失敗0を確認し、必要な修理はfocused testと該当画像で再検証する。

修理の比較対象（いずれも`screenshots/`配下）:

- RV42-01: `home-1440-full.png`・`home-390-full.png`（作品とlinksのチップ）、`home-error-1440.png`・`home-error-390.png`（失敗時チップ）。購入先はfixtureのDemoを選ぶDOM試験で検証済み。
- RV42-02: `home-player-1440.png`・`home-player-390.png`。作品情報→player→横並び操作、閉じるの白地と線、390でも作品情報の直下にplayer。
- RV42-03: `home-no-release-1440.png`・`home-no-release-390.png`。new release・作品メタ・操作なし、独立した名前、幅いっぱいのLive、links保持。
- RV42-04: `menu-390-open.png`・`menu-390-short.png`。active・hover時にも各行の線、一覧の上下8px。各`shell-<route>-390.png`の共通外枠も確認する。
- RV42-07: `home-1440-full.png`・`home-390-full.png`。新作見出し下12px、next live見出し下8px、news下16px／8px。

## ソース上の照合で分かること

1440の980幅、上段440/492、gap48、390の左右16と358角、16:9、共通部品、ロゴ演出の保持はソースと試験で照合した。サンプルとは作品・公演・news・profile・footerの本文とジャケットが異なる。ナビ6項目と行き先は#42の承認済み途中仕様で、v2画面の最終5項目とは意図して異なる。これらは描画結果の目視確認を代替しない。

## FR-N1の日付表示

FrontはRV42修理後に同じscriptで52枚を再撮影し、判定はすべて通過しました（`capture-front-3.log`、撮影時`capture-metrics.json`のSHA-256 `709c904f51c9e7f13b1e34db6d709a65dacd21cbd636aaa441b4ba9d93ab4e96`）。独立reviewの2回目はAPPROVEDで、RV42-01〜07はすべてRESOLVED、新しい指摘はありません（root scratchの`review-02-result.md`）。その後、確認2の準備でFrontが本番の公開データを読むbranch画面を開き、newsの日付が語の途中で折れる問題FR-N1を見つけました。計画とfixtureが短い日付だけを想定していたことが原因です。

FR-N1では、日付欄を88pxから内容に合わせて広げ、上限を240pxまたは画面幅−236pxの小さい方にしました。390pxでは左右16px・間隔24pxを保ち、本文欄に180px以上を残します。Home専用rendererで空白ごとのまとまりをspanに包み、空白で折り返します。上限を超える1語だけは欄内で折り返します。原文の文字と空白・既存の並べ方は保持し、全行が通常のYYYY.MM.DDの場合は88pxと24pxの見え方を保ちます。旧`.news-*`は変更していません。

FR-N1修理後、Frontは文字nodeの行数を数えるよう撮影scriptを2か所修正しました。gridの行高まで伸びた日付要素の高さを行数と誤認したためです（`capture-front-4.log`は修正前の失敗、`capture-front-5.log`は修正後の54枚・全判定通過）。ただし画像では、各行が別のgridを持つため、1440pxの日付欄が88・100・181・215・240pxに分かれ、タイトルと本文の開始位置がそろわない問題FR-N2が見つかりました。

FR-N2では、`#news-items`を2列の親gridとし、全行をsubgridで同じ列に合わせました。表示中の最長日付に合わせた1つの幅を使い、下限88px・上限min(240px,画面幅−236px)、gap24px、390pxの本文180px以上を保ちます。全件がYYYY.MM.DD形式なら88pxです。短い日付が自由記述日付と混在する場合も同じ列幅です。語中折返しの制限・文字原文・上下padding16px・行の下線・390pxの行間8px・旧`.news-*`は保持しています。

**FR-N2修理後の撮影と再確認は、このあとFrontが行います（この文書の時点では未実施）。** 同じ`capture-home.py --serve`で、通常の画像に加え`home-freeform-news-dates-1440.png`（1440×900）と`home-freeform-news-dates-390.png`（390×844）を撮影します。追加の架空日付・長い1語を含め、日付要素と語の行数・幅・はみ出し、本文幅、通常日付88px・間隔24pxをassertし、`capture-metrics.json`へ記録します。新しい全撮影は54枚の予定です。今回のWorkerは新規撮影しておらず、FR-N1後の既存54枚・metricsを保持しています。撮影scriptには、全行の`.site-news-content`の左端の差が0.5px以内というassertを追加しました。Frontの文字nodeによる`lines`と高さ換算の`boxLines`は保持しています。
