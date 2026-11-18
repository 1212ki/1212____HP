# AI-DLC State Tracking

- **Cycle ID**: 2026-11-17_issue-42_home
- **Issue**: #42
- **Base Commit**: c26641815502d7d7fc64c0f00eed6cd0f35ced33
- **Branch**: feature/42-home
- **Workspace Root**: /Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-42-home
- **Start Date**: 2026-11-17T22:33:36+09:00
- **Current Stage**: Complete
- **Cycle Status**: Complete
- **Approval Gate**: None
- **Approval Status**: Complete

## 修理後の確認状況

初回Workerの撮影はlocalhost bind拒否で0枚。その後Frontが同じscriptで52枚を撮影し、時計の値を1794916800000から1794916800秒へ1行修正した（Playwright for Pythonの数値は秒）。撮影logは`construction/aidlc-integration/verification/capture-front-1.log`・`capture-front-2.log`、撮影時metricsのSHA-256は`1bbfdc6dfd66b03c02b8fb416bf04f06ed03fadc95d373c876b4f2f2a9ccd042`。

FrontはRV42修理後に同じscriptで52枚を再撮影し、判定はすべて通過しました（`capture-front-3.log`、撮影時`capture-metrics.json`のSHA-256 `709c904f51c9e7f13b1e34db6d709a65dacd21cbd636aaa441b4ba9d93ab4e96`）。独立reviewの2回目はAPPROVEDで、RV42-01〜07はすべてRESOLVED、新しい指摘はありません（root scratchの`review-02-result.md`）。その後、確認2の準備でFrontが本番の公開データを読むbranch画面を開き、newsの日付が語の途中で折れる問題FR-N1を見つけました。計画とfixtureが短い日付だけを想定していたことが原因です。

FR-N1では、日付欄を88pxから内容に合わせて広げ、上限を240pxまたは画面幅−236pxの小さい方にしました。390pxでは左右16px・間隔24pxを保ち、本文欄に180px以上を残します。Home専用rendererで空白ごとのまとまりをspanに包み、空白で折り返します。上限を超える1語だけは欄内で折り返します。原文の文字と空白・既存の並べ方は保持し、全行が通常のYYYY.MM.DDの場合は88pxと24pxの見え方を保ちます。旧`.news-*`は変更していません。

FR-N1修理後、Frontは文字nodeの行数を数えるよう撮影scriptを2か所修正しました。gridの行高まで伸びた日付要素の高さを行数と誤認したためです（`capture-front-4.log`は修正前の失敗、`capture-front-5.log`は修正後の54枚・全判定通過）。ただし画像では、各行が別のgridを持つため、1440pxの日付欄が88・100・181・215・240pxに分かれ、タイトルと本文の開始位置がそろわない問題FR-N2が見つかりました。

FR-N2では、`#news-items`を2列の親gridとし、全行をsubgridで同じ列に合わせました。表示中の最長日付に合わせた1つの幅を使い、下限88px・上限min(240px,画面幅−236px)、gap24px、390pxの本文180px以上を保ちます。全件がYYYY.MM.DD形式なら88pxです。短い日付が自由記述日付と混在する場合も同じ列幅です。語中折返しの制限・文字原文・上下padding16px・行の下線・390pxの行間8px・旧`.news-*`は保持しています。

**FR-N2修理後の撮影と再確認は、このあとFrontが行います（この文書の時点では未実施）。** 同じ`capture-home.py --serve`で、通常の画像に加え`home-freeform-news-dates-1440.png`（1440×900）と`home-freeform-news-dates-390.png`（390×844）を撮影します。追加の架空日付・長い1語を含め、日付要素と語の行数・幅・はみ出し、本文幅、通常日付88px・間隔24pxをassertし、`capture-metrics.json`へ記録します。新しい全撮影は54枚の予定です。今回のWorkerは新規撮影しておらず、FR-N1後の既存54枚・metricsを保持しています。撮影scriptには、全行の`.site-news-content`の左端の差が0.5px以内というassertを追加しました。Frontの文字nodeによる`lines`と高さ換算の`boxLines`は保持しています。

FR-N2後の独立再reviewとgate 4・5のOwner承認は未実施。準備観察とは別に、修理後のPC・スマホ画面と実機の音の最終確認を確認2で行う。Cycle Statusと承認gateは変更しない。

FR-N2の自動検証は完了（Node 377/377・Worker 347/347、focused 85/85、JS3件・local verify・status・diff checkはexit 0）。承認1〜3・固定入力/昇格の照合と使い捨てclose事前検査もPASS。証拠はverification/fr-n2-*.logとfr-n2-results.json。修理後のFront撮影・独立review・Owner承認・Front completionは未実施であり、上記gate/stateを維持する。

## 確認2後の状態更新（2026-11-18）

上記の未実施・待機記載は修理時点の履歴。Front最終撮影54枚は全判定通過、review-03はAPPROVED、新しい指摘なし。Ownerの回答Aによりgate 4・5とQ42-01を受け入れ、close可能なCompleteへ更新した。実機の追加操作の有無は回答に明記されていない。詳細はcycle-summaryとauditの確認2承認節。Front completionは別判定。
