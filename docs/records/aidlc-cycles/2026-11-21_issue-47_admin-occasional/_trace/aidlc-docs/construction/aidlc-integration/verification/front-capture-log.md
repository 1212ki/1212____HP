# Front の撮影の記録（Issue #47）

UI の確認は「初回＋根拠のある修正1回」で1 cycle。次の cycle は新しい宣言をここに残す。

## 撮影1（段2のあと。最初の1画面）

- 2026-11-21 11時台（JST）。worktree `feature/47-admin-occasional`、Worker 02b の成果（`admin/app.js` `b62a5cb4…`、`admin/style.css` `470c1478…`、`admin/index.html` `a7a4aef3…`）。
- 実行: `ADMIN_CAPTURE_OUT=capture-front-1 /usr/bin/python3 test/support/admin-preview/capture-admin-occasional.py --base http://127.0.0.1:8080`（execution target の root から）。log は `capture-front-1.log`。
- 結果: 36枚すべて撮れた。本番へ届いた request は0件（`network_problems` 空）。自動の合否は4枚が不合格。
  - `news-failed-390`: 「#news-save-btn ← #toast」。失敗の toast が下の「保存して公開」に重なる。#46 の Live も同じ動き（`open-public-save-failed-390.png`。本番に出ている承認済みの形）で、toast は数秒で消え、理由は欄の上に1行出ている。→ 実装は Live と同じまま。撮影 script の覆いの検査から toast を除く（script の期待の誤り）。既知の制限として結果に書く。
  - `live-open-390`: 「Liveの一覧の行が出ていない」。スマホでライブを開いている間は一覧を隠すのが #46 の形。→ script の期待の誤り。
  - `live-open-390`・`live-open-1440`: 「覆われて押せない操作がある」（`#edit-ticketUrl`・`#edit-link`・`#edit-sourceText` など）。どれも閉じた折りたたみの中の欄で、見えていない。→ script の期待の誤り（見えていない欄を覆いの検査に入れている）。
- 実測で合っていたもの: 接続中の Header 46px（幅390）・62px（幅1440）、Tabs 49px・53px、5つの名前と順序、横スクロールなし、幅390 で変更なしの時に「保存して公開」が出ず、未保存で下に固定、幅1440 で見出しの右・変更なしは薄く押せない。
- Front の目視（原寸）: `news-list-390`・`news-edit-390`・`news-unsaved-390`・`news-failed-390`・`news-delete-confirm-390`・`news-list-1440`・`news-edit-1440`・`live-list-390`・`live-open-390`・`chrome-local-390`・`chrome-music-390` を、Figma の `render-38-425`・`render-38-541`・`render-222-806` と #46 の `open-public-saved-390`・`open-public-save-failed-390` と並べて見た。
  - 合っている: 上の帯（「1212 Admin」と右の「接続中」）、タブ5つ、News の一覧の行（日付と題、開いている行の色）、編集の欄の並び、画像の「画像を変える」と文字の「画像を外す」、「パス: …」、削除の確認の面、幅1440 の未選択の面、Local Mode の「JSONを書き出す」と帯、Live の一覧と公開内容（#46 と同じ）。開いた時に最初の欄にフォーカスが入るのは Live と同じ動き。
  - 直す（実装）:
    1. News の説明の textarea の文字が、ほかの欄と違う font（太く見える）。Live は `.live-workspace .textarea` で `font: inherit` にしているが、`.occ-tab .occ-field` の入力に `font` の指定がない。
    2. 幅1440 のタブ: 文字の位置が Figma（`render-38-425`: Site の文字の左端 x=32、文字と文字の間 40、下線は文字の幅）より右にずれ（Site は x≈41）、間隔も広い（News と Live の文字の間 ≈52）。`.tab-nav .tab-btn` の `min-width: 44px` で文字が中央に寄るため。幅390 は Figma（`render-222-806`）とほぼ同じ。
  - Music・Site・Profile は段3・4で作り直すので、今回は見ていない（旧の画面を積んだだけ）。
- 次: 上の「直す」2つと script の期待の誤り3つを、Worker（Packet 02c）が段3の前に直す。撮り直しは段4のあと（撮影の修正1回）。

## 撮影の修正1回（段4のあと。撮影1の直しの確認＋段3・4の画面）

- 2026-11-21 11時台（JST）。Worker 02c の成果（`admin/app.js` `3d71a079…`、`admin/style.css` `9283913d…`、`admin/index.html` `d427609d…`）。
- 実行: `ADMIN_CAPTURE_OUT=capture-front-2 /usr/bin/python3 test/support/admin-preview/capture-admin-occasional.py --base http://127.0.0.1:8080`。log は `capture-front-2.log`。
- 結果: 82枚すべて撮れた。本番へ届いた request は0件。自動の合否は2枚が不合格。
  - `music-works-date-error-390`・`-1440`: 「works の開いている行が aria-current でない」。新規の作品（まだ保存していないので一覧に載らない）で日付の形が違う状態なので、開いている行は無いのが正しい（R47-06）。→ script の期待の誤り。
- 撮影1の直しの確認: `news-edit-390` の「説明」は他の欄と同じ書体になった。`news-list-1440`・`music-works-edit-1440` のタブは「Site」の文字が x=32、文字の間が約40で、Figma `render-38-425` と同じ。撮影1の不合格（toast・Live の一覧・閉じた折りたたみ）は出ていない。
- Front の目視（原寸）: `music-works-list-390`・`music-works-edit-390`・`music-works-edit-1440`・`music-videos-list-390`・`music-works-delete-confirm-390`・`site-unsaved-390`・`profile-edit-1440` を、Figma `render-39-366`・`render-39-533`・`render-222-698`・`render-222-806`・`render-38-350`・`render-39-589` と並べて見た。
  - 合っている: 作品／映像の切り替え（スマホは幅いっぱい、PC は中身の幅）、見出しつきの一覧とジャケット、作品の編集の欄の並び（カテゴリが先頭、種別・その場で再生する映像が最後）、映像の側の Channel URL の面と「保存済み」、Site の4つの面と見出しの行（「Site｜未保存」）・下の固定の「保存して公開」、Profile の写真・文（9行・空行を保つ）・SNS リンクの行と文字の「削除」、削除の確認の「顔にする作品は…に戻ります。」。
  - 直す（実装。段5で）:
    1. 作品の編集で、「リリース日」の欄の下に、欄1つ分ほどの空きがある（`music-works-edit-390`・`-1440`。日付の誤りの文の行が、誤りのない時も高さを取っている）。誤りのない時は他の欄と同じ間隔にする。
    2. 削除の確認の説明で、「削除すると公開画面からも消えます。」と「顔にする作品は…」が1つの段落に空白でつながっている。整合案 F47-14 は「説明に1行足す」なので、別の行（段落）にする。再生する映像N件の文も同じ。
- UI の確認の cycle: 撮影1＋修正1回でこの cycle を閉じる。次の撮影（段6のあとの全画面・全幅、Live の #46 との比較）は、計画 §6 の撮影2として新しい宣言で行う。

## 撮影2（段6のあと。新しい宣言）

- 宣言: 計画 §6 の撮影2。全画面×全幅×状態（`capture-admin-occasional.py`、357枚）と、Live の変化の確認（`capture-admin-live.py`、150枚を #46 の画像と上の帯を除いて比べる）。この cycle も「初回＋根拠のある修正1回」。
- 対象: Worker 02d の成果（段5・6。全試験 1322 / pass 1319 / fail 0 / skipped 3、Worker 361 / 0）。
- 実行: `capture-admin-occasional.py`（出力 `capture-front-3/`、log `capture-front-3.log`）→ `capture-admin-live.py`（出力 `capture-front-3-live/`、log `capture-front-3-live.log`）。どちらも本番へ届いた request は0件。
- `capture-admin-occasional.py`: 357枚、不合格1枚。
  - `local-news-saved-1440`: 「Headerに「JSONを書き出す」が出ていない」。実際は書き出し待ちの「JSONを書き出す *」が出ている（#46 の Live の Local Mode と同じ表記）。→ script の期待の誤り（完全一致で探している）。
- `capture-admin-live.py`（#46 の script。無変更）: 150枚すべて不合格。内訳は2種類で、どちらも #47 が意図して変えた所。
  - 150枚: 「外枠のタブが6つの表記でない: Site, News, Live, Music, Profile」（R47-01）。
  - 1枚 `open-public-read-only-1440`: 「API接続失敗は読み取り専用（header の保存は押せない…）」。#47 は接続失敗の時も header の「保存」を出さない（R47-15・R47-16、T47-MODE）。
- Live の #46 との比較（`front-tools/compare_live.py`、結果 `capture-front-3-live-compare.json`。上の帯 #46=146px、#47=95px/115px を切り落とす）: 同じ 81枚、高さだけ違い共通部分は同じ 47枚（画面の高さ固定の撮影で、上の帯が低くなった分だけ本文の見える範囲が伸びた）、差あり 22枚。差の内訳を目視で確かめた。
  - 確認の面（`dialog-*-1440`）と toast（`*-failed-1440`・`postsave-announce-1440`・`open-public-save-failed-390`）: 画面の中央・下に出る位置が、本文の見える範囲が伸びた分だけずれた。中身は同じ。
  - 接続失敗・Local Mode（`list-upcoming-read-only-*`・`list-upcoming-local-mode-*`・`open-public-read-only-1440`）: 帯（「API接続失敗…」「ローカルJSONモード…」）は Header と Tabs の間のままで、比較の切り落としがその分ずれただけ。Local Mode の「JSONを書き出す」は大きい赤いボタンから小さい枠のボタンになった（承認済みの F47-22、Figma `223:892`）。header の「読み取り専用」のボタンは出ない（R47-16）。
  - `ticket-settings-saved-*`（1px）・`postsave-announce-390`（9x12px）: 文字の描画の揺れ。
  - 意図しない差は 0件。Live の本文・一覧・予約・Ticket Page共通設定は #46 と同じ。
- Front の目視（原寸。並べた画像は `front-tools/pairs/`）: `site-saving-390`・`profile-failed-390`・`music-videos-channel-saving-390`・`fallback-news-edit-390`・`news-edit-821`・`news-edit-900`・`news-image-failed-390`・`local-news-saved-390`・`profile-edit-360`・`music-works-playback-reset-390`。
  - 合っている: 保存中は状態「保存しています…」・ボタンとタブが押せない、保存の失敗は「保存できませんでした」と理由、Channel URL の保存中は欄の下、接続失敗は入力がすべて薄く押せない、821 は1列（一覧→編集）・900 は2列、画像の失敗は欄の下に赤い文、Local Mode は「JSON書き出し待ち」、360 でも横にはみ出さない。FIX4（リリース日の下の空き）は直っている。
  - 既知の制限（直さない）: Local Mode の toast「編集内容を反映しました。右上の「JSONを書き出す」で確定します」が幅390 で画面の左右にはみ出す（`local-news-saved-390`）。toast は共有の部品で、#46 の Live の Local Mode と同じ文と見た目（本番に出ている）。Local Mode はふだん使わない従来の運用。
- 直す（段7で）:
  1. `capture-admin-occasional.py`: Local Mode の書き出し待ちの「JSONを書き出す *」を受け入れる。
  2. `capture-admin-live.py`: #47 のあとはタブが5つで、接続失敗の時に header の「保存」を出さない。このままでは #46 の Live の撮影が今後ずっと全部不合格になり、道具として使えない。#47 が意図して変えた2点（タブの表記、接続失敗の header の「保存」）だけ期待を改め、ほかの検査は変えない。計画 §3 の変更ファイルの表に無いファイルなので、「計画からの差」として結果に理由を残す。

## 撮影3（段7のあと。撮影2の修正1回＝最終）

- 2026-11-21 12時台（JST）。Worker 02e の成果（段7＝README と版、FIX7・FIX8）。`admin/app.js`・`admin/style.css` は撮影2と同じ bytes（段7は `index.html` の版と README だけ）。
- 実行: `capture-admin-occasional.py`（出力 `capture-front-4/`、log `capture-front-4.log`）→ `capture-admin-live.py`（出力 `capture-front-4-live/`、log `capture-front-4-live.log`）。
- 結果: `capture-admin-occasional.py` 357枚すべて合格、`capture-admin-live.py` 150枚すべて合格。どちらも本番へ届いた request は0件。
- 撮影2との画素の比較（同じ名前の357枚）: 同じ 352枚、差 5枚（`music-videos-empty-821` は1px の縦線、`music-works-failed-1440`・`site-failed-1440`・`profile-failed-360` は toast の出方の瞬間、`music-works-playback-reset-900` は toast の文字の一部）。いずれも撮影の瞬間の違いで、画面の作りの違いではない。
- Live の #46 との比較（`capture-front-4-live-compare.json`）: 同じ 81枚、高さだけ違い共通部分は同じ 58枚、差あり 11枚で、撮影2と同じ内訳（確認の面・toast の位置、接続失敗・Local Mode の帯の位置、Local Mode の「JSONを書き出す」の見た目＝F47-22）。意図しない差は 0件。
- 撮影2で直すとした2点は直った（`local-news-saved-1440` が合格、Live の150枚が合格）。
- UI の確認の cycle（撮影2＋修正1回）をここで閉じる。
