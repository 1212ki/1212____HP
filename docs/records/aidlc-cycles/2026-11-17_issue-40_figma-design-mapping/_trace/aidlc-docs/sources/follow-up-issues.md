# 後続Issue #41〜#47の原典写し

- Source: GitHub `1212ki/1212____HP`（`gh issue view --json number,title,body,url`、read-only）
- Fetched at: 2026-11-17 05:21:21 UTC
- 用途: 実装Issueの分担・依存・対象外の確認。snapshotは取得時点の証跡で、設計の正本ではない。

## Issue #41 — 顔にする作品・その場で再生する映像・種別を登録できるようにする

- URL: https://github.com/1212ki/1212____HP/issues/41

```markdown
親: #39

## 目的
Home を新作型にし、その場で聴けるようにするために必要な項目を、データと管理画面に足す。公開側の見た目はこの Issue では変えない。

## 範囲
- サイト設定に「顔にする作品」（空なら、リリース日がいちばん新しい作品）。
- 作品に「その場で再生する映像」（登録済みの映像から1つ。空でよい）と「種別」（2nd Single など。空でよい）。
- 今の「Home Hero」画像を「共有時の画像」と名前を変えて残す（ライブ共有時の画像の予備としての働きは変えない）。
- 作品のリリース日を `2025.05.05` の形で入力させる（新しく保存する時だけ検査）。
- 選んでいた作品・映像が削除された時は、空に戻す。
- 入力欄は、今の管理画面の形のまま足す（管理画面の作り直しは別 Issue）。

## デザインの根拠（Figma マスタ）
- 管理画面の要件メモ「新しく足す項目（3つ）」: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817
- Site: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=38-274
- Music 作品: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-366
- 状態: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741

## 受入条件
- 3項目を空のままにしても、公開サイトが今と同じ表示になる。
- 3項目を入れて保存すると、公開用のデータに出る。
- 既存のデータ（リリース日の形が違う作品を含む）で保存・表示が壊れない。
- ライブを共有した時の画像の予備が、今と同じに働く。

## 先に要るもの
#40

## 対象外
公開サイトの見た目の変更。管理画面のタブや編集面の作り直し。

## 確かめていないこと
本番のデータ（リリース日の形、説明だけを持つ古いライブ）は見ていない。

## 進め方
- この repo の AI-DLC で進める（1 Issue / 1 branch / 1 worktree / 1 cycle）。
- デザインの根拠は Figma の「マスタ」と、その横の要件メモ。画面と要件メモが食い違う時、または実装中にデザインを変える必要が出た時は、先に Figma のマスタと設計書を直してから実装する。
- 色・文字・余白は `DESIGN_RULES.md` と `assets/css/1212-music.tokens.css` のまま。
- merge、本番反映、PR の承認は Itsuki。
```

## Issue #42 — Homeを新作型にし、ヘッダー・フッター・共通の部品を作り直す

- URL: https://github.com/1212ki/1212____HP/issues/42

```markdown
親: #39

## 目的
ライブで知った人が、Home を開いてすぐ音源を聴けて、次のライブを予約できるようにする。

## 範囲
- Home を新作型にする（顔にする作品のジャケット、「聴く」、「配信先へ」、次のライブ、news、music、profile、links）。
- ヘッダー、フッター、狭い幅の Menu、共通の部品（ボタン、リンク、見出し、作品カード、お知らせの行）。
- 読み込み中と、読み込めなかった時の見え方。
- ナビは、Music のページができるまで今の6項目のままにする。Home の「music →」は、それまで今の Discography へ送る。

## デザインの根拠（Figma マスタ）
- Home（幅1440px、390px、状態、要件メモ、Menu）: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=35-273
- 要件メモ: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=25-83
- 状態: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=24-139
- 部品: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=20-23

## 受入条件
要件メモ「受入条件」のとおり。主なもの:
- 幅1440px で開いた最初の画面に、ジャケット、作品名、次のライブの日付と「予約する」が入っている。
- 幅390px で、スクロールせずにジャケットと作品名が見える。
- 「聴く」が出ている時、押してから1回の操作で音が出る（YouTube の映像をその場で再生）。
- 今の Home で見られる外部リンク5つ、next live、news（6件、説明とリンクの文言つき）が、すべて残っている。
- 状態10個の見え方が、マスタどおり。

## 先に要るもの
#41

## 対象外
Live、Ticket、Music、Profile、Contact の各ページ。ナビの5項目化。

## 進め方
- この repo の AI-DLC で進める（1 Issue / 1 branch / 1 worktree / 1 cycle）。
- デザインの根拠は Figma の「マスタ」と、その横の要件メモ。画面と要件メモが食い違う時、または実装中にデザインを変える必要が出た時は、先に Figma のマスタと設計書を直してから実装する。
- 色・文字・余白は `DESIGN_RULES.md` と `assets/css/1212-music.tokens.css` のまま。
- merge、本番反映、PR の承認は Itsuki。
```

## Issue #43 — Live一覧からTicket完了までの予約の流れを作り直す

- URL: https://github.com/1212ki/1212____HP/issues/43

```markdown
親: #39

## 目的
ライブを知った人が、いつ・どこで・いくらかを確かめて、迷わず予約を終えられるようにする。

## 範囲
- Live一覧、Live詳細、終了したライブ（全件）、Ticket、Ticket完了。
- 送信中・失敗はページ内で示し、完了は Ticket完了のページへ進む（今は重ねて出す表示で、Ticket完了のページは使っていない）。
- Ticket完了に、送った内容と「当日までに聴く」を出す。
- 予約ボタンの出し分け、入力項目、管理画面で変えられる文言と表示の設定は、今のまま。

## デザインの根拠（Figma マスタ）
- Live・Ticket（全画面、状態、要件メモ）: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=35-274
- 要件メモ: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-347
- 状態: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-249

## 受入条件
要件メモ「受入条件」のとおり。主なもの:
- Live一覧から予約の完了まで、画面の移動は最短3回。
- Ticket で、どのライブを予約しようとしているかが、入力中ずっと見えている。
- 送信に失敗しても、入力した内容が消えない。送信できた時、送った内容を画面で確認できる。
- 今の Live詳細と Ticket で見られる項目が、すべて残っている。
- 状態16個の見え方が、マスタどおり。

## 先に要るもの
#42（共通の部品）。Ticket完了の「当日までに聴く」は #41。

## 対象外
予約の受付や自動返信メールの仕組みの変更。料金の支払い方の表示（決まりを確認できていないため、画面に書かない）。

## 進め方
- この repo の AI-DLC で進める（1 Issue / 1 branch / 1 worktree / 1 cycle）。
- デザインの根拠は Figma の「マスタ」と、その横の要件メモ。画面と要件メモが食い違う時、または実装中にデザインを変える必要が出た時は、先に Figma のマスタと設計書を直してから実装する。
- 色・文字・余白は `DESIGN_RULES.md` と `assets/css/1212-music.tokens.css` のまま。
- merge、本番反映、PR の承認は Itsuki。
```

## Issue #44 — DiscographyとYouTubeをMusicにまとめ、ナビを5項目にする

- URL: https://github.com/1212ki/1212____HP/issues/44

```markdown
親: #39

## 目的
音源と映像を1つの場所でまとめて聴ける・見られるようにする。

## 範囲
- Music のページを新しく作る（release、demo、video）。
- ナビを Home / Live / Music / Profile / Contact の5項目にする。
- 今の `/youtube/` と `/discography/` のアドレスで来た人を、Music の該当する区分へ送る。
- Home の「music →」を Music へ向ける。

## デザインの根拠（Figma マスタ）
- Music（幅1440px、390px、状態、要件メモ）: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=35-275
- 要件メモ: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=30-489
- 状態: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=30-446

## 受入条件
要件メモ「受入条件」のとおり。主なもの:
- 今の Discography の全作品と、今の YouTube の全映像・チャンネルへのリンクが、すべて Music にある。
- どの作品からも、1回の操作で聴き始められるか、配信先・購入先へ行ける。
- 古いアドレスから来ても、行き止まりにならない。
- 状態6個の見え方が、マスタどおり。

## 先に要るもの
#42（共通の部品）、#41（聴く）

## 対象外
作品ごとの詳細ページ。配信サービスごとのボタン。

## 進め方
- この repo の AI-DLC で進める（1 Issue / 1 branch / 1 worktree / 1 cycle）。
- デザインの根拠は Figma の「マスタ」と、その横の要件メモ。画面と要件メモが食い違う時、または実装中にデザインを変える必要が出た時は、先に Figma のマスタと設計書を直してから実装する。
- 色・文字・余白は `DESIGN_RULES.md` と `assets/css/1212-music.tokens.css` のまま。
- merge、本番反映、PR の承認は Itsuki。
```

## Issue #45 — ProfileとContactを新しい見た目に揃える

- URL: https://github.com/1212ki/1212____HP/issues/45

```markdown
親: #39

## 目的
Profile でどんな人かを短く確かめられ、Contact で用件を迷わず送れて、送れたことが分かるようにする。

## 範囲
- Profile（写真、登録された文章をそのまま、links、Contact への入口）。
- Contact（項目は今のまま。送信中・完了・失敗をページ内で示す）。

## デザインの根拠（Figma マスタ）
- Profile・Contact（幅1440px、390px、状態、要件メモ）: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=35-276
- 要件メモ: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=31-443
- 状態: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=31-400

## 受入条件
要件メモ「受入条件」のとおり。主なもの:
- 今の Profile の写真、文章、SNS リンクと、今の Contact の入力項目・導入文・送信先の設定が、すべて残っている。
- 送信に失敗しても、入力した内容が消えない。送信できた時、送った内容を画面で確認できる。
- 状態6個の見え方が、マスタどおり。

## 先に要るもの
#42（共通の部品）

## 対象外
Contact の項目を増やすこと。

## 進め方
- この repo の AI-DLC で進める（1 Issue / 1 branch / 1 worktree / 1 cycle）。
- デザインの根拠は Figma の「マスタ」と、その横の要件メモ。画面と要件メモが食い違う時、または実装中にデザインを変える必要が出た時は、先に Figma のマスタと設計書を直してから実装する。
- 色・文字・余白は `DESIGN_RULES.md` と `assets/css/1212-music.tokens.css` のまま。
- merge、本番反映、PR の承認は Itsuki。
```

## Issue #46 — 管理画面: スマホでライブの登録・告知・予約の管理を手間なくできるようにする

- URL: https://github.com/1212ki/1212____HP/issues/46

```markdown
親: #39

## 目的
Itsuki が、よくする3つの更新（新しいライブの登録、告知、予約の管理）を、スマホから手間なく終えられるようにする。

## 範囲
- スマホでライブを開いた時の上の帯を1行にし、公開内容／告知／予約の切り替えを押しやすくする。
- フライヤーを公開内容のいちばん上に出す。「予約先・リンクなど」は折りたたむ。
- 「保存して公開」は未保存の変更がある時だけ下に出す。削除はいちばん下の文字にし、確認のあとその場で保存する。
- 保存の直後に、告知の内容と「Xで告知する」を出す。
- 一覧に、ライブごとの予約の枚数と未対応の件数を出す（集計を返す処理を新しく作る）。
- 予約の1件を開いて状態を変える。取り置きの追加。全ライブの予約管理。
- Ticket Page共通設定は、その画面で保存する。
- 幅1440px は同じ中身を広げた形にする。

## デザインの根拠（Figma マスタ）
- 管理画面（よくする3つの幅390px・1440px、状態、要件メモ）: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=15-20
- 方針: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=43-491
- 要件メモ: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817
- 状態: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741

## 受入条件
要件メモ「受入条件」のとおり。主なもの:
- 幅390px でライブを開いた時、最初の画面に入力欄が3つ以上見えている。
- 新しいライブの登録は、元情報を貼ってから公開まで、ボタンを押す回数が3回。
- 未対応の予約があるかどうかが、一覧を開いただけで分かる。
- 「保存して公開」「開催予定」「公演終了」が、幅390px で1行に収まる。
- 元情報からの下書き作成、告知の文の作り方、予約の状態と数え方、共有用のアドレスは、今のまま。

## 先に要るもの
#40（設計書の更新）

## 対象外
Site、News、Music、Profile のタブの作り直し。タブの5項目化。

## 確かめていないこと
予約の一覧に枚数を出すための集計は、今は仕組みがない。作る量を減らすなら外せる（Itsuki 判断）。

## 進め方
- この repo の AI-DLC で進める（1 Issue / 1 branch / 1 worktree / 1 cycle）。
- デザインの根拠は Figma の「マスタ」と、その横の要件メモ。画面と要件メモが食い違う時、または実装中にデザインを変える必要が出た時は、先に Figma のマスタと設計書を直してから実装する。
- 色・文字・余白は `DESIGN_RULES.md` と `assets/css/1212-music.tokens.css` のまま。
- merge、本番反映、PR の承認は Itsuki。
```

## Issue #47 — 管理画面: Site・News・Music・ProfileをLiveの型に揃え、タブを5つにする

- URL: https://github.com/1212ki/1212____HP/issues/47

```markdown
親: #39

## 目的
たまにする更新も、Live と同じ操作の型（一覧と編集、保存して公開、未保存の確認）でできるようにする。

## 範囲
- タブを Site / News / Live / Music / Profile の5つにする（YouTube と Disco を Music にまとめる）。
- News、作品、映像の編集を、画面下から開く編集面から、一覧と編集の2列（スマホは一覧 → 編集）に変える。
- 保存の仕方を「更新でその場保存」から「保存して公開」と未保存の確認に揃える。
- Site と Profile を同じ見た目に揃える。

## デザインの根拠（Figma マスタ）
- 管理画面（たまにする更新、状態、要件メモ）: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=15-20
- 要件メモ: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-817
- 状態: https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-741

## 受入条件
要件メモ「受入条件」のとおり。主なもの:
- 今の管理画面で編集できる項目が、すべて残っている。
- 未保存の変更が、確認なしに消えることがない。
- News・作品・映像に、新しい必須項目を作らない。

## 先に要るもの
#41（項目）、#44（公開側の Music）、#46（Live の型）

## 対象外
Live のタブの中身。

## 確かめていないこと
急がない。項目の追加とタブの統合だけを先に行う進め方もできる（要件メモ「案の判断」）。

## 進め方
- この repo の AI-DLC で進める（1 Issue / 1 branch / 1 worktree / 1 cycle）。
- デザインの根拠は Figma の「マスタ」と、その横の要件メモ。画面と要件メモが食い違う時、または実装中にデザインを変える必要が出た時は、先に Figma のマスタと設計書を直してから実装する。
- 色・文字・余白は `DESIGN_RULES.md` と `assets/css/1212-music.tokens.css` のまま。
- merge、本番反映、PR の承認は Itsuki。
```

