## 判定

- verdict: APPROVED。blocking の指摘は 0 件で、確認2（gate 4・5）に出してよい。
- ただし私の環境には実行の道具（Bash）が無かった。次の確認ができていない。
  - 試験の再実行
  - `git diff 1f3a1cd`
  - SHA-256 の再計算
  - base 版 `app.js` そのものの読み取り
- 根拠はコード全体、試験の中身、各 Worker の結果の log、画像、Front の撮影の記録の読み取りに限る。「試験が 1326／1323 pass」は Worker 02e の log の値で、私は再現していない。出す前に Front が全試験を1回走らせることを推奨する。

## acceptance_review

**ADM-47-01〜13**

- ADM-47-01 今の保存と同じ本文: OK（試験の作りを読んだ範囲）
  - `test/admin-occasional-save.test.mjs:65-94` の `baseNewsSave` は、`openOccasionalApp({ base: true })` で `git show 1f3a1cd:admin/app.js` を読み、同じ操作の PUT 本文を文字列で `assert.equal` している。新しい実装を写しただけの試験ではない。
  - 範囲は `:108-193`（News）、`:856-966`（作品・映像）、`:992-1095`（Channel URL・Site・Profile・画像）。
  - 日付の自由な書き方、二重引用符・全角、旧形式の 7 キー再構成、数字に見える id、カテゴリの移動もこの中にある。
- ADM-47-02 未保存の確認: OK
  - `admin/app.js:1142-1166` の `requestLiveEditorTransition` が `isOccDirty` を見て確認の面を出す。
  - 確認の面は `:3675-3717`。`#app` の子を `inert` にするので、背面は操作できない。
  - `beforeunload` は `:5513-5518`。
- ADM-47-03 必須項目を増やさない: OK
  - 映像の ID 不正は `:4423-4427`、作品の日付は `:4408-4412`。どちらも今ある検査のままで、新しい必須項目は無い。
  - 試験は `T47-DATE`（`:1469`）。
- ADM-47-04 新しい3項目を空のままでも今と同じ: OK
  - `T47-DELETE`（`:1315`・`:1327`）が、削除と参照の空戻しが同じ1回の PUT になることを base と比べて縛る。
  - コードは `:5471` の `applyOccDeleteSlice` を `saveScoped` へ渡し、`:3806` の `clearDanglingMusicReferences` を通す。
- ADM-47-05 タブ 5 つ: OK
  - `admin/index.html:23-29`、`T47-TABS`。
  - 画像は `capture-front-3/screenshots/news-edit-1440.png`。
- ADM-47-06 「保存して公開」の出し方: OK
  - `app.js:4806-4824` の `syncOccActionsOf`。
  - 幅 899px 以下は変更がある時だけ表示し、幅 900px 以上は常に表示して、変更がなければ押せない。
  - 画像は `news-edit-390`（変更なし＝出ない）、`news-edit-1440`（薄く押せない）、`site-unsaved-390`（下に固定）。
- ADM-47-07 他の入力を巻き込まない: OK（RF1 参照）
- ADM-47-08 削除は確認のあとその場で保存: OK
  - `app.js:5448-5492`。
  - 画像は `news-delete-confirm-390`。「削除すると公開画面からも消えます。」と「やめる／削除する」が出ている。
- ADM-47-09 幅 900px 以上は左に一覧・右に編集: OK
  - `news-edit-1011.png`、`news-edit-1440.png`、`profile-edit-1440.png`。
  - 画像は 821・900・1011・360 の一部だけ見た。
- ADM-47-10 Live と公開側が壊れない: OK（RF6 参照）
- ADM-47-11 本番の形で崩れない: OK
  - `T47-FIXTURE` と、`long-values` の画像（`news-long-values-*`）が撮影2の一覧にある。長い値の画像は開いていない。
- ADM-47-12 API 接続失敗・Local Mode: OK
  - `app.js:200-213` の `shouldConcealGlobalSave`、`:279-311` の `applyApiFallbackReadOnlyState`。
  - 画像は `fallback-news-edit-390`（入力が薄く無効）、`local-news-saved-1440`（「JSONを書き出す *」と「JSON書き出し待ち」）。
- ADM-47-13 上の帯の高さ: OK
  - CSS は `style.css:35-54`、`:71-82`、`:202-214`。幅 899px 以下が 46px／49px、幅 900px 以上が 62px／53px。
  - Front の実測は front-capture-log（撮影1）に記録済み。

**RF1〜RF10**

- RF1 保存の対象の分離: OK
  - `saveScoped`（`app.js:3802-3819`）が `releaseDateBaseline` の複製に slice だけを重ねる。
  - 各 slice の置き場所は次のとおり。
    - News: `:4099`
    - 作品: `:4109`
    - 映像: `:4118`
    - 削除: `:4130`
    - Site: `:4158`
    - Profile: `:4163`
    - Channel URL: `:4169`
  - Site・Profile・Channel の入力は `siteData` に入らない。成功後に `commitOccPageToSiteData`（`:4632`）が反映する。
  - 保存の成功は `saveToApi` が baseline を更新する（`:2990`）。
  - 失敗では `siteData` と baseline を触らない。
  - `saveToApi` の既定（payload なしで `siteData` を送る）は、`grep` で呼び出しが `saveScoped`（`:3812`）の1か所だけと確認した。`saveData` は API 接続中に `false` を返す（`:2997`）。header の「保存」からも到達できない。
  - `live`・`ticket`・#41 の3項目・`site.heroImage` は、baseline を複製して重ねるだけなので落ちない。試験は `T47-SCOPE`（`:380`・`:1106-1196`）。
- RF2 今の保存と同じ本文: OK
  - T47-PIN の見出し44件は、base の挙動（失敗で modal を閉じる、削除が2段階、header 保存が全体を送る）を明示して固定している。
  - 意図して変えた3点（削除がその場で保存、失敗で入力と編集面を残す、映像 ID の誤りを欄の直下に出す）は、`T47-EQ ... (intended difference)`、`T47-SCOPE (intended difference ...)` として明記されている。要件どおり。
  - 数字に見える id: base は一覧から開けず、新しい実装は開ける（`:177-193`）。D47-17 のとおりで、id の型は保たれる。
- RF3 今の編集項目と情報: OK
  - News の画像は編集面に「画像を変える／外す」とパスがある（`news-edit-390`）。
  - 映像の ID は `edit-youtube` 欄に入る（`:4379`）。
  - 一覧の「›」は、行を押して開く形に置き換わっている。
  - 必須項目は増えていない。
- RF4 未保存の確認: OK
  - 全移動経路が `requestLiveEditorTransition` を通る。
    - 別の項目: `:5211`・`:5234`・`:5257`
    - 追加: `:5200`・`:5221`・`:5245`
    - 一覧へ戻る: `:5271`
    - 作品／映像の切り替え: `:5011`
    - グローバルタブ: `:1133`
  - `scope: 'item'` により、映像の移動では Channel URL の未保存を問わない。Channel の入力は `renderVideoList` だけを再描画するので残る（`:5293`）。
  - 作品／映像の切り替えとタブ移動は `scope: 'all'` で Channel も見る。
  - 画像のアップロード中は未保存として扱う（`:449`・`:4730`・`:4741`）。
  - 保存中は移動・追加・切り替えを返す（`:1117`・`:1143`・`:5199`）。
- RF5 状態: OK
  - 保存の4状態: `:4764-4780`
  - 失敗の理由: `:5400-5403`
  - 削除の確認の文: `:5502-5510`（`OCC_UI.featuredResets`・`playbackResets`）
  - 一覧が空: `:4916`
  - 画像は `news-failed-390`、`fallback-news-edit-390`、`local-news-saved-1440`。
- RF6 範囲外を壊さない: OK
  - `T47-STYLE`（`test/admin-occasional-style.test.mjs:234-252`）が、`Reset & Base`・`Header`・`Tab Navigation`・新しい `Occasional Updates` 以外の全グループを base とバイト一致で比べている。`Live Operations Hub` もこの比較に入っている。
  - `.occ-tab` を付けた共有 class の上書きは `style.css:3665-4011`。Live の section（`index.html:138`）には `occ-tab` が無いので当たらない。
  - 共有 class を `.occ-tab` 無しで書き直した規則は見当たらなかった。grep で拾った範囲による。
  - modal の撤去後も Live の `deleteItem` の転送は残っている（`:2932-2936`）。
  - Front の #46 比較は、同じ 81 枚、高さのみ違う 47 枚、差あり 22 枚で、意図しない差は 0 件（`capture-front-3-live-compare.json` の summary と front-capture-log の内訳が一致）。
  - `assets/`・`cloudflare/`・`data/` が無変更という点は、Worker 02e の `git diff --stat`（空）の記録に依る。私は `git` を実行していない。
- RF7 見た目: OK
  - 開いた画像は下の images_viewed のとおり。
  - Figma の `render-38-541`（News 編集 390）と構成が一致している。ラベルの太さはマスタが少し太いが、実害は無い。
  - 既知の制限のうち、失敗の直後の toast が下のボタンに重なる点（`news-failed-390`）と、Local Mode の toast（`local-news-saved-1440`）は、操作を妨げない。
- RF8 試験と保護の質: OK（一部未確認）
  - 外した `generic edit modal ...` の置き換えは `T47-A11Y`（`test/admin-occasional-states.test.mjs:640-731`）と `T47-GUARD`。
  - `T43-COMPAT` の許可の一覧（`test/live-ticket-shell.test.mjs:168-177`）は、#47 の計画どおりの path だけを追加している。
  - `T46-STYLE` は `LATER_ISSUE_STYLE_GROUPS`（`test/admin-live-style.test.mjs:32`）と `LATER_ISSUE_NEW_GROUPS`（`:34`）で、変えてよいグループを名指ししている。範囲外の変更は見逃さない形。
  - `T46-COMPAT` の3件は `skip: LATER_ISSUE_TABS.length > 0` で恒久的に skip（`:824`・`:843`・`:857`）。同じ観測は T47-PIN・T47-EQ に移っている。
  - `capture-admin-live.py` の FIX8 が「2点だけ」かどうかは、Worker の `diff -u` の記録を読んだだけで、diff 自体は私は見ていない。許可の一覧は #46 から既に入っているので、試験は逸脱を検出しない。→ 指摘 RV47-04。
- RF9 承認記録と昇格: OK（SHA の再計算は未確認）
  - 承認記録 01・03 を `gate-123-owner-responses.md` と照合した。次の点がすべて一致した。
    - 回答は `A` のみ
    - 6つの digest
    - prompt／response の時刻
    - 承認者
  - 昇格した設計書 2 ファイルは、提案版と行数が一致した（888 行、48 行）。SHA-256 は私は計算していない。
  - 02（Workflow Plan）は開いていない。
- RF10 出し方: OK（コードで成り立つ範囲）
  - 保存の経路・形・認証は同じ `PUT /api/admin/site-data` のままで、Worker に変更が要る前提は見つからなかった。
  - 画像のアップロードは `/api/admin/upload-image`（`:1937`）で今のまま。
  - 旧 `app.js` との混在は、「最後に保存した側が残る」という既知の制限と同じ範囲に収まる。新しい形のデータは作らない。
  - revert 後も、保存するデータの形は同じなので旧管理画面が読める。
  - README の手順（`admin/README.md:75-103`）は本番の表記と照合した。実機での確認はしていない。

## findings

- RV47-01
  - severity: low
  - blocking: false
  - 根拠: `app.js:2996-3025` の `saveData`（Local Mode の「JSONを書き出す」）は `isOccDirty()` を見ない。Local Mode でタブの入力が未保存のまま header の「JSONを書き出す」を押すと、その入力は JSON に入らない。画面は「未保存」のまま。
  - 実害: 要件 R47-15 が定める動き（各「保存して公開」がメモリへ反映し、header が書き出す）には合っている。ただし base では入力した時点で書き出しに入っていたので、従来運用が変わる。Local Mode は普段使わない運用で、入力は「未保存」と表示され続ける。
  - 直す案: 対応は任せる。放置で良い。直すなら、書き出し時に未保存があれば toast で知らせる。
- RV47-02
  - severity: low
  - blocking: false
  - 根拠: `news-edit-390.png`・`music-works-edit-390.png` で、開いた直後に最初の欄（日付・カテゴリ）が focus され、赤い枠が出ている。赤い枠は失敗の表示とも読める。スマホでは行を押すとキーボードが開く可能性がある。
  - 実害: Live も同じ動き（Front の記録）で、承認済みの型。読みにくさが出る程度。
  - 直す案: 今回は直さなくて良い。直すなら、スマホ幅では自動 focus をしない。
- RV47-03
  - severity: low
  - blocking: false
  - 根拠: `app.js:4584-4596`。Profile の links が変わると、全行の `name` と `url` を書き直す。base は変えた行だけ触っていた。
  - 実害: `url` を持たない旧形式のリンク行があると、触っていない行にも `url: ''` が付く。本番の形は `{name,url}`（`prod-data/public-site-data-classification-20261121.md`）なので、現実の影響はほぼ無い。
  - 直す案: 対応は任せる。
- RV47-04
  - severity: low
  - blocking: false
  - 根拠: `test/admin-live-style.test.mjs:824-857`（恒久 skip の3件）と、`capture-admin-live.py` の FIX8（Worker 02e の記録のみ）。
  - 実害: `capture-admin-live.py` を「2点だけ」変えたことを守る試験が無い。実害は撮影の道具の期待が緩む程度。
  - 直す案: Front が diff を1回目視する。
- RV47-05
  - severity: low
  - blocking: false
  - 根拠: `app.js:496`・`:599`（`generic-modal` の分岐）、`:87` の `modalReturnFocusLive`、`:2974` の `saveToApi` の既定。
  - 実害: 死んだ分岐は、呼び出し元が無いことを確認した。本番から到達しない。Worker 02e も自己申告している。
  - 直す案: 後の整理で良い。

## images_viewed

- `capture-front-4/screenshots/`: `news-edit-390`、`news-edit-1440`、`news-leave-confirm-390`、`news-delete-confirm-390`、`music-works-edit-390`
- `capture-front-3/screenshots/`: `music-videos-list-390`、`site-unsaved-390`、`profile-edit-1440`、`news-failed-390`、`news-edit-1011`、`fallback-news-edit-390`、`local-news-saved-1440`
- `figma-snapshot-v2/`: `render-38-541`
- `capture-front-4/` は撮影3の途中のようで、一部の名前が存在しなかった（`music-videos-list-390` など）。その分は撮影2の画像で代替した。

## failure_modes

- FM_general_review_instead_of_contract_review: 該当なし。契約（RF1〜RF10、R47・S47・ADM-47）に沿って、file:line と試験名で照合した。
- FM_partial_as_done: 該当なし。見ていないことは gaps に分けた。
- FM_source_not_checked: 一部該当。
  - base 版 `app.js` は直接読めていない。PIN と EQ の試験の作りで間接的に確かめた。
  - `git diff`、SHA-256、試験の再実行はできていない。
- FM_owner_judgment_substitution: 該当なし。計画の是非は蒸し返していない。blocking は 0 件で、Itsuki の判断を代えていない。
- FM_scope_creep: 該当なし。read-only のまま、ファイル・git・network・secret に触れていない。他の agent への委任もしていない。

## gaps

- 私が実行できなかったこと（実行の道具が無い）。
  - `node --test test/`
  - `npm --prefix cloudflare/worker test`
  - `node --check`
  - `git diff 1f3a1cd -- cloudflare assets data DESIGN_RULES.md`
  - SHA-256 の計算
- base の `app.js`、`style.css`、`capture-admin-live.py` との行単位の diff。CSS の「変えたグループ以外は同じ」は、`T47-STYLE` の中身を読んだだけ。
- 画像は撮影2の357枚のうち一部だけ開いた。360 幅と 821・900 幅の多数、状態の多数は開いていない。撮影3（`capture-front-4/`）は未完了で、全体を見ていない。
- 承認記録 02（Workflow Plan）と、`worker-01*`・`worker-02a〜02d` の個別の結果の突き合わせはしていない。
- `fake_admin_server.py` の起動と、README の tunnel の例は実機で確認していない。
- iOS Safari の `beforeunload` の挙動は確認できない。計画の既知の制限として残っている。

---

Status: DONE（read-only review。verdict は APPROVED、blocking 0 件）
Implemented: none（read-only review のため）
Changed files: none（read-only review のため）
Tests: 実行していない（実行の道具が無い）。Worker 02e の log（`node --test test/` は 1326 tests／1323 pass／0 fail／3 skipped、Worker は 361 pass）を引用しただけ。再現は未確認。出す前に Front が1回走らせることを推奨する。
Runtime evidence: コード（`admin/app.js`、`admin/style.css`、`admin/index.html`）、試験（`test/admin-occasional-*.test.mjs`、`test/live-ticket-shell.test.mjs`、`test/admin-live-style.test.mjs`）、承認記録 01・03 と原典、Front の撮影の記録、`capture-front-3-live-compare.json`、画像の目視（上の images_viewed）。
Failure semantics: 保存の失敗では `siteData` と baseline を触らず、入力・編集面・理由を残す（`app.js:5398-5405`）。削除の失敗では項目と入力を残す（`:5478-5486`）。API 接続中は header から全体送信の経路が無い。Local Mode は各保存でメモリへ反映して「JSON書き出し待ち」になり、header が書き出す。
Remaining risks: RV47-01〜05（すべて low、非 blocking）。未確認は gaps のとおり（試験・hash・base との diff・画像の全数）。別の端末の保存を取り込まない制限は計画 §9 の既知の制限のまま。
Reviewer handoff: Front は、(1) 全試験を3回目として1回走らせて数を確かめる、(2) `capture-admin-live.py` の diff を1回目視する、(3) 撮影3の画像（`capture-front-4/`）を最終確認する、(4) 昇格した設計書2ファイルの SHA-256 を計画 §3 の値と照合する。そのうえで確認2へ出して良い。
