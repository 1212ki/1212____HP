# Code Generation Result — 管理画面のたまにする更新（Issue #47）

- Status: 確認2（gate 4）の候補 / Owner承認待ち（承認記録は作っていない）。実装（段1〜7）・段ごとの全試験・Frontの撮影（3回。最終は357枚＋Liveの150枚がすべて合格）と目視・独立review（APPROVED）を経た最終の状態。Itsukiが手元配信で触る確認は未実施（任意。Itsukiは「mergeだけを行う」と決めた。§9）。merge後の本番の確認も未実施
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-21_issue-47_admin-occasional`
- Execution target: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-47-admin-occasional`
- Branch: `feature/47-admin-occasional` / base `1f3a1cdcdf9852b3f2cabaa2978352572e0b9d82`
- **Blocking Findings**: None
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

`Blocking Findings: None` は、独立reviewのblockingが0件、Frontの撮影の不合格が最終で0件、全試験のfailが0件であることを指す。§9の未確認が通ることを意味しない。

## 何ができるようになったか

Itsukiがスマホで、Site・News・Music（作品と映像）・Profileの更新を、Liveと同じ型（一覧→編集、「保存して公開」、未保存の確認）で終えられる管理画面になりました。**保存の送り方・データの形・認証は今と同じ**で、Cloudflare Worker・公開側のページ・データは変えていません（`git diff 1f3a1cd -- cloudflare assets data DESIGN_RULES.md` は空）。保存が今と同じ確かさで動くことは、先に今のコードの動きを試験で固定し（T47-PIN 44件）、同じ操作を今のコードと新しいコードで行ってPUTの本文を文字列で比べる試験（T47-EQ）で確かめました。

- **タブは5つ（Site・News・Live・Music・Profile）。** 「YouTube」「Disco」のタブはなくなり、Musicの中で「作品／映像」を切り替えます。映像の側にChannel URLの欄があります。
- **上の帯が薄い1行になった。** 幅390pxで高さ46px＋タブ49px、幅900px以上で62px＋53px（Liveを開いた画面も同じ。前は92px＋54px）。右に「接続中」だけが出ます。API接続中は、どのタブにも上の帯の「保存」ボタンがありません。
- **News・Music・Site・Profileは「一覧→編集」。** 幅899px以下は一覧→編集の1画面ずつ（「‹ 一覧｜題｜状態」の上の帯）、幅900px以上は左に一覧（幅320）・右に編集。汎用の編集ダイアログ（modal）はなくなりました。
- **「保存して公開」は、幅899px以下は未保存・保存中・失敗の時だけ画面の下に固定、幅900px以上は見出しの右（変更がない間は薄く押せない）。** 保存の状態は「保存済み」「未保存」「保存しています…」「保存できませんでした」で、失敗の理由は1行出ます。
- **保存は、その編集面の中身だけを送る。** 送る内容は「最後に保存できた内容に、その保存の対象だけを重ねたもの」です。News・作品・映像・Site・Profile・Channel URLは、別々に保存され、ほかの面の未保存の入力を一緒に公開しません（前は「更新」も上の帯の「保存」も、ほかのタブの未保存の入力ごと全体を送りました）。保存に失敗しても入力と編集面は残ります。
- **削除は、確認のあと、その場で保存する。** 作品を消す時は「顔にする作品は『自動（最新のリリース）』に戻ります。」、再生する映像に選ばれている映像を消す時は作品の件数が確認に出て、参照は同じ1回の保存で空に戻ります。失敗した時は項目が一覧に残り、入力が残ります。
- **未保存のまま別へ移ろうとすると、画面の中の確認が出る**（「破棄して移動」「編集を続ける」）。別の項目・「‹ 一覧」・「+ 追加」・作品／映像の切り替え・タブの切り替えのすべてが通ります。再読込・戻る・閉じるはブラウザ標準の確認で止めます。
- **API接続失敗は読み取り専用、Local Modeは上の帯に小さい「JSONを書き出す」だけ。** 各「保存して公開」はメモリへ反映して「JSON書き出し待ち」になります。
- **直した不具合が1つ。** 数字に見える`id`のNews（本番に出るかは未確認。形としてありうる）は、今の管理画面では一覧から開けませんでした（文字列と数値の比較）。新しい管理画面は開けて、保存しても`id`の型は変わりません（D47-17）。
- **触って確かめる入口が用意してあります。** 架空のAPIで動く手元配信（`fake_admin_server.py --fixture test/fixtures/admin-occasional-states.json`）。本番のデータは書き換わりません。起動の手順は`admin/README.md`と`build-and-test-summary.md` §6。

## 確認2で知っておいてほしいこと（詳細は§5・§6・§9と`build-and-test-summary.md` §9）

- **Itsukiが手元で触る確認はしていません。** 「PRが上がったらmergeだけやる」と決めたため（2026-11-21）。結果の文書は、実施したようには書いていません。代わりに、撮影（357枚、本番へのrequest 0件）・全試験・独立reviewで確かめ、merge後の本番の確認（`build-and-test-summary.md` §6）で補います。
- **計画からの差が5つあります**（§5）。うち1つ（#46の撮影script`capture-admin-live.py`の期待の変更）は、計画の変更ファイルの表にないファイルです。Frontがdiffを目視しました。
- **既知の制限は、計画 §9の8件に、実装・撮影・reviewで分かった7件を足した1つの表**にしました（`build-and-test-summary.md` §9）。使い勝手に響くものは次の3つです。保存に失敗した直後のお知らせが、下の「保存して公開」に数秒重なります（#46のLiveと同じ）。Local Modeの「JSONを書き出す」は、各タブの未保存の入力を書き出しに入れません（入力は「未保存」と出続けます。RV47-01）。ライブや項目を開いた直後に最初の欄にフォーカスが入ります（Liveと同じ。RV47-02）。
- 先の Issue（#46まで）の保護試験・既存試験を、#47が意図して変える所だけ更新しています（§6の表。assertは、modalを直接呼ぶ1件を除いて消していません。外した1件の置き換えの観測も§6に示しました）。

**まだ確認できていないこと**: Itsukiが触る確認、merge後の本番の確認（本番の件数の桁・題の長さ・画像の実在）、実機（iOSのSafari）、幅360・821・900・1011の191枚の全数の目視（自動の実測は全部合格）、README・手元配信のtunnelの例の実機での確認。§9。

## 1. 昇格と承認済み文書のSHA-256

昇格した設計書2文書は、提案版と同じbytes（`cmp -s`一致。昇格前の元版hashが計画 §3の値と一致することを昇格前に確認済み。Worker 02a）。承認済みの文書は、この結果までの全Packetで変えていない（Packet 02fで`shasum -a 256`を再計算して一致を確認）。

| 文書 | SHA-256 | 状態 |
|---|---|---|
| `docs/specs/current/live-operations-admin-ui.md`（昇格） | `799ef584b63f7767052f6eecb352e8d3e5a2c8d0f0c8344ed2297b46e54d2d64` | 計画 §3の提案版hashと一致 |
| `docs/specs/current/README.md`（昇格） | `3f64dcf9ebb79ccf714592d6eea5cd0ca88943c9e223b30accd83621a35fa56f` | 同上 |
| `aidlc-docs/inception/requirements/requirements.md` | `d1d7fa30612c96bc2d801a336155afc7f7fdad23358c76d7ca775b10abc49926` | 承認済み・不変 |
| `aidlc-docs/inception/plans/execution-plan.md` | `c29a87cbb315818c2f11cf764c9dd26bc122685913ef9d8313c8e5328c5af0b8` | 承認済み・不変 |
| `aidlc-docs/construction/plans/aidlc-integration-code-generation-plan.md` | `fa7792cb69f8d78b229a3770665c8a760bb9cf71b1b37dc6cd062e69e68bb35c` | 承認済み・不変 |
| `aidlc-docs/construction/aidlc-integration/figma-fix-requests.md` | `968dda2d62f6b4b14c7d81480e2f814446e121bb2a8ac851f2b158173ac1dee2` | 承認済み・不変 |

承認記録3件（`approvals/01`〜`03`。Worker 02aが原典を逐語で転記。3件ともscriptの`validate_approval`相当でPASS）は変えていない。gate 4・5の承認記録は、この結果の承認前なので作っていない。

## 2. 変えたファイルとSHA-256（基準`1f3a1cd`からの差のある全ファイル）

`aidlc-docs/`の外の変更は次の28ファイル（変更19・新規9）。Packet 02fで再計算した値（段7の最終）。

| path | 内容 | SHA-256 |
|---|---|---|
| `admin/index.html` | 上の帯・タブ5つ・各タブの構造・modalのDOMの削除・版（`ADMIN_BUILD_ID`=`2026-11-21T0300Z`、`?v=20261121-47`） | `fc1b7955322fd58049d1ea6545525782f24604b89c6d9a51bcfd148773fbc03b` |
| `admin/app.js` | 編集面の土台（`occPanels`・slice関数・`saveOccPanel`・`saveScoped`・`deleteOccItem`）、News・Music・Site・Profile・Channel URL、modalの撤去、headerの「保存」、Local Mode・読み取り専用 | `904232aa2798da3f33f64d56afef2ed837ec935817f55fef28b4e288b0080e95` |
| `admin/style.css` | `Reset & Base`（変数だけ）・`Header`・`Tab Navigation`・新しいまとまり`Occasional Updates`だけ。ほかのまとまり（`Live Operations Hub`を含む）は基準とbytes一致 | `2ea0f443e73024146576b6102f071ba71c814c45575f97c69c52f7481f9ffcad` |
| `admin/README.md` | 5タブ・運用・保存の動き・既知の制限・手元での確認・画面の確認・反映順序とrollback。履歴の節（#41〜#46）は残し、古くなった文に注記 | `fa9b87b998098ed9506b89f773678f8359f0972b89318f3a31f9645aa0bbe3ee` |
| `docs/specs/current/live-operations-admin-ui.md` | 設計書の昇格（§1） | `799ef584b63f7767052f6eecb352e8d3e5a2c8d0f0c8344ed2297b46e54d2d64` |
| `docs/specs/current/README.md` | 同上 | `3f64dcf9ebb79ccf714592d6eea5cd0ca88943c9e223b30accd83621a35fa56f` |
| `test/admin-occasional-pin.test.mjs`（新規・44件） | T47-PIN。今のコード（`git show 1f3a1cd:admin/app.js`）の動きの固定 | `8ad2079b3c76ff1cdd35c77f8330360422bfafb965e74ae9dab754a0756cbcc1` |
| `test/admin-occasional-save.test.mjs`（新規・85件） | T47-EQ・SAVE・SCOPE・DELETE・DATE・IMAGE・FIX5 | `c9b8b8ba3cbbc7072b33e1c666485ca6b4bd3eae0b14c3919f5007d512dde276` |
| `test/admin-occasional-screens.test.mjs`（新規・64件） | T47-HEADER・TABS・NEWS・MUSIC・SITE・PROFILE・IMAGE・STYLE-SPEC・STYLE・FIX1・2・4 | `424c2643f662303eec1eb42320215df2f2b26ca8fe596ae47cbecc4cea155aaf` |
| `test/admin-occasional-guard.test.mjs`（新規・85件。計画の4つに足した） | T47-GUARD。全移動経路×6画面×未保存／変更なし、画像のアップロード中・保存中・Live・`beforeunload` | `fb221e2e5f4bb0256db78ab08f560c2c01d21ac71a55732f0e00781364ff0d6e` |
| `test/admin-occasional-states.test.mjs`（新規・42件。計画の4つに足した） | T47-STATES S47-01〜20・MODE・A11Y・FIXTURE | `ff116232f638e761e29e52985f6c6d20a107f537701280daaf4d1e734f285aab` |
| `test/admin-occasional-style.test.mjs`（新規・14件） | T47-STYLE・STYLE-SPEC・LIVE-COMPAT。変えたまとまり以外が基準とbytes一致 | `12f8ff8eedc39c7c23df12e37c7ef070095ea3eb25efe3994a66059c9787f79b` |
| `test/admin-occasional-version.test.mjs`（新規・4件） | T47-VERSION・T47-README | `c2a59d4feb7e0d2857e81e84e656fd4d4d6673552ba483d1d45b25d0ea7030fe` |
| `test/fixtures/admin-occasional-states.json`（新規） | 本番の形を持つ架空のfixture（全値が架空） | `2847789a5abd1f2ca9487d70ed822b5086ef906807410be917802bde9be3ec6b` |
| `test/support/admin-preview/capture-admin-occasional.py`（新規） | 撮影script（357画像 / 9画面 / 7scenario） | `1ed55187cd6203659905aa613282d72878089f061aea5d1adc2ef643439a5fc0` |
| `test/support/admin-preview/capture-admin-live.py` | #46の撮影scriptの期待2点（§5の2） | `f00e4481f1df5fa10df9acaead0ad0761ab932c2e1d238c0f24e5f59eb39c8d9` |
| `test/support/admin-preview/fake_admin_api.py` | `--fixture`・#47のscenario・画像アップロードの失敗 | `9b2580ef5d43cad6eb3cc87e8e489a1d3159a0717f118227d9358e03596342e4` |
| `test/support/admin-preview/fake_admin_server.py` | `--fixture`（repoの2つのfixtureだけ） | `b93c8e545576ada1ae264e9d52b52d5153ac4509db48d88f2fcf5bc9015961f6` |
| `test/support/admin-app-harness.mjs` | 新しい関数・状態を読む窓、base版の`app.js`を読む補助（`loadBaseAdminApp`）。動きは変えていない | `86ee26a0a33216b7fe75175a8d8187844ed172470faa37e43d024f35e8b26f29` |
| `test/admin-image-form.test.mjs` | §6 | `cce19eab47d907b998f55b77aaee9492ae44107899ca46023a3da73ecd8527ae` |
| `test/admin-live-operations.test.mjs` | §6 | `1ccc87c9b2761bbcb0c6856c3e0807983078bd634b8baa5d79c5aa89dd2fb923` |
| `test/admin-live-pin.test.mjs` | §6 | `c2b9d4ba2ad005cb26d69395a5041dcd1352a870c12d70dffa8c70381713efd6` |
| `test/admin-live-review-fixes.test.mjs` | §6 | `7c502b0c766c00220a5ff9468156c8da1e7c7ae5ce2510931df6a96093829fcd` |
| `test/admin-live-save.test.mjs` | §6 | `0a5d871ff82282b267c73bd006e276a652d77bb408323c13a0a903e8e19cde49` |
| `test/admin-live-screens.test.mjs` | §6 | `0587675204e1855463e9d93e1f0fee339a6c6b7d63f24598cd94d1a2c313a26c` |
| `test/admin-live-style.test.mjs` | §6 | `4a6b9465bb00ccedbe1a832b7b5f3ce23a96dfc461a42df48e95039b73ca6797` |
| `test/live-ticket-shell.test.mjs` | §6（`T43-COMPAT`の許可の一覧に#47のpathを追加） | `ec8ef4226f07257b47af7ceb8a1b2adbf904104fa9168b08b8abe5a358732782` |
| `test/site-shell.test.mjs` | §6 | `c6257790e229b696b4f4b975d6f422ec8e9865466f3784960412b265ca74d7b7` |

`git diff --numstat 1f3a1cd -- . ':!aidlc-docs'`（変更19ファイル）は +3902 / −1345。`assets/`（`assets/js/music-data.js`・`assets/js/live-operations.js`を含む。`?v=`は`admin/index.html`の側で変えた）・`cloudflare/`・`data/`・`DESIGN_RULES.md`・`admin/config.js`・`admin/data/`は変えていない。

`aidlc-docs/`の中の追加: 承認記録3件、昇格した設計書の提案版2件・`figma-fix-requests.md`（承認済み）、`aidlc-state.md`・`audit.md`（追記）、この結果の文書3件、`verification/`（`logs/`のstage1〜stage8、撮影の証拠。`build-and-test-summary.md` §4）。`aidlc-docs/README.md`の変更はcycle開始時のものです。

## 3. 段ごとの作業とRED→GREEN

log は`aidlc-docs/construction/aidlc-integration/verification/logs/`。試験は先にREDにしてからGREENにした（T47-PINと、既に実装済みの動きを全経路で縛る試験だけは、不要なREDを作らずGREENで固定した。理由はそのつど下に書く）。

| 段 | 作業 | RED → GREEN（log） | 区切りの全試験 |
|---|---|---|---|
| 1（Worker 02a） | 承認記録3件の転記、設計書の昇格、架空のfixture、**T47-PIN 44件を今のコードに対して書いてGREENで固定**、保護試験の追加だけの更新 | REDなし（今の動きの固定のため）。固定が効くことの確認: 今のappを5通りに壊した一時コピーで、44件のうち2・7・1・2・28件が落ちる（無変異は0）。`stage1-01-focused.log` | 1033 / pass 1030 / fail 0 / skipped 3（`stage1-02`） |
| 2（Worker 02b） | 土台（`occPanels`・slice・`saveOccPanel`・`saveScoped`・`deleteOccItem`・移動の確認・`beforeunload`）、上の帯、5タブ、Newsの一覧と編集、撮影1の道具、`fake_admin_api.py`の拡張 | RED `stage2-01-red.log`（64件中63件失敗）→ GREEN `stage2-02-green-new.log`（66 / 66） | 1099 / 1096 / 0 / 3（`stage2-04`） |
| 撮影1の直し（02c） | FIX1（textareaの書体）・FIX2（幅1440のタブの位置）・FIX3（撮影scriptの期待の誤り） | RED `stage3-01-fix-red.log`（2件失敗）→ GREEN `stage3-02-fix-green.log`（29 / 29） | — |
| 3・4（02c） | 土台を「項目の種類ごとの設定」に一般化し、Music（作品・映像・Channel URL・参照・日付）、Site、Profileを載せた | RED `stage3-03-red-new-tests.log`（144件中69件失敗）→ GREEN `stage3-04-green-new-tests.log`（144 / 144） | 1177 / 1174 / 0 / 3（`stage4-02`） |
| 修正1回の直し（02d） | FIX4（誤りの文の行の高さ）・FIX5（削除の確認の段落）・FIX6（撮影scriptの期待の誤り） | RED `stage5-01-fix-red.log`（4件失敗）→ GREEN `stage5-02-fix-green.log`（149 / 149） | — |
| 5（02d） | 状態S47-01〜20、全移動経路、Local Mode・読み取り専用、modalの撤去、headerの「保存」 | RED `stage5-03-red-new-tests.log`（127件中4件失敗）→ GREEN `stage5-04-green-new-tests.log`（127 / 127）。**残り123件はREDで既にGREEN**（段2〜4で実装済みの動きを全画面・全経路で縛る試験の追加のため。不要なREDは作っていない） | — |
| 6（02d） | 全幅のCSS・共有CSSの安全・Liveの非回帰（`style.css`は変更不要だった） | 最初からGREEN。試験が効くことは`stage6-01-red-mutations.log`（4つの一時変更で1・3・1・1件が落ち、そのつど元に戻した）。GREEN `stage6-02-green-new-tests.log`（14 / 14） | 1322 / 1319 / 0 / 3（`stage6-04`） |
| 7（02e） | `admin/README.md`・版・版の一致の試験、FIX7・FIX8（撮影scriptの期待） | 新しい試験4件（`stage7-*`） | 1326 / 1323 / 0 / 3（`stage7-01`） |
| 8（Packet 02f） | 結果の文書、撮影・reviewの証拠の複製、全試験の再実行 | — | 1326 / 1323 / 0 / 3（`stage8-01`）。`build-and-test-summary.md` §1 |

## 4. 保存の対象の分離・各画面の実装箇所（`admin/app.js`）

- **保存の経路**: 各編集面の「保存して公開」→ `saveOccPanel(key, options)` → `saveScoped(applySlice, …)`。`saveScoped`は`releaseDateBaseline`（最後に保存できた内容）の複製に、その面の対象だけ（slice）を重ねて`clearDanglingMusicReferences`（#41の参照の照合）を通し、重複Live IDを検査してPUTし、成功したらbaselineを進める。失敗では`siteData`もbaselineも動かない。変更なしの保存は何も送らない（`options.force`は、今のコードが変更なしでも保存したことと比べる試験のための引数）。
- **slice**: `applyNewsSlice`・`applyReleaseSlice`・`applyVideoSlice`・`applySiteSlice`・`applyProfileSlice`・`applyChannelSlice`・`applyOccDeleteSlice(data, kind, id, category?)`。Site・Profile・Channel URLの入力は`siteData`に書かず、保存の成功のあとに`commitOccPageToSiteData`が反映する。
- **削除**: `deleteOccItem` が確認の面（`openLiveDialog`。本文は1行ごとの段落）を出し、「削除する」で`saveScoped`に載せる。参照は同じPUTで空に戻る。
- **移動の確認**: すべての経路が`requestLiveEditorTransition`を通る（`scope: 'item'`は開いている項目だけ、既定は全panel）。Channel URLの未保存は映像の項目間の移動を止めない。
- **Local Mode / API接続**: `saveData`はAPI Modeで何も送らず`false`を返す（headerの「保存」は常に`hidden`）。Local Modeは`saveScoped`を呼ばずメモリへ反映して`markChanged()`、headerの「JSONを書き出す」で書き出す。`validateMusicBeforeSave`は、Local Modeの書き出しの安全網として残した（§5の4）。
- **撤去**: `showModal`・`closeModal`・`handleModalKeydown`・`saveModal`・`saveYouTubeItem`・`saveDiscographyItem`・`restoreGenericModalCanonicalValues`・`prepareGenericEditorTransition`とmodalのDOM。`deleteItem`はLiveの削除への転送だけ残した。
- **死んだ分岐（残してある。RV47-05）**: `resolveImageOperationOwner`の`generic-modal`の分岐、`modalReturnFocusLive`（変数だけ。何も代入しない）、`saveToApi`の「payloadなしで`siteData`を送る」既定。本番の呼び出しからは届かない（`saveToApi`の呼び出しはすべて`saveScoped`の1か所で、payloadつき。`T47-MODE`が縛る）。`saveToApi`の既定は`T46-PIN (h)`が引数なしで呼ぶ窓のために残した。

## 5. 計画からの差

承認済みの計画の本文・bytesは変えていない。差は次の5つ。

| # | 計画 | 実際 | 理由・影響 | 決めた人・確認 |
|---|---|---|---|---|
| 1 | §3「新規 `test/admin-occasional-pin`・`save`・`screens`・`style`の4つ」 | 4つに加えて**2つ**（`admin-occasional-guard.test.mjs`＝T47-GUARD、`admin-occasional-states.test.mjs`＝T47-STATES・MODE・A11Y・FIXTURE）を足した。`style`は計画どおり。さらにversion（`admin-occasional-version.test.mjs`、段7。版・READMEの一致）も足したので、新規の試験ファイルは計7 | 1ファイルが大きくなり過ぎるため（02d）。群の名前は計画 §5のまま。`T43-COMPAT`の許可の`test/admin-occasional-*.test.mjs`に収まる | Worker 02d・02e。独立reviewが確認 |
| 2 | §3の変更ファイルの表に`capture-admin-live.py`はない | #46の撮影script`capture-admin-live.py`の期待を**2点だけ**変えた（FIX8）。(1) 外枠のタブ6つ→5つ（`FIVE_TABS`）、(2) 接続失敗の時に上の帯の「保存」を出さない（以前は「読み取り専用」の押せないボタンを求めた）。`--self-check`に両方の合格・不合格の見本を足した | 変えないと#46のLiveの撮影が、#47のあと全150枚で不合格になり、READMEが案内する道具として使えない。Liveの画面・状態・実測・通信の検査は変えていない。許可の一覧は#46が既に入れていた | Worker 02e。**Frontがdiffを目視して「2点だけ」を確認**（独立review RV47-04）。撮影3で150枚すべて合格 |
| 3 | §2「`saveToApi`のpayloadなしの既定」「`validateMusicBeforeSave`」の扱いは明記なし | どちらも**残した**。`saveToApi`の既定は`T46-PIN (h)`の窓（その試験を変えないため）、`validateMusicBeforeSave`はLocal Modeの書き出しの安全網 | `T46-PIN`を変えない・Local Modeの書き出しで不正な日付の作品を黙って出さない、ため。本番の呼び出しからは届かない（`T47-MODE`が縛る）。後の整理でよい（RV47-05） | Worker 02d。独立reviewが到達しないことをgrepで確認 |
| 4 | §6「撮影は3回置く。画像を目視して、残りの段へ進むか直すかを決める」 | Frontが撮影で見つけた点を、段の途中でWorkerに直させた（FIX1〜FIX8。下の一覧） | 撮影の目的どおり。実装の直しは4つ（FIX1・2・4・5）、撮影scriptの期待の誤りが4つ（FIX3・6・7・8）。要件・設計書・承認済みの計画は変わらない | Front（`front-capture-log.md`） |
| 5 | 整合案（F47-13〜22）の「Figmaに足すframe」の量（Worker 01の最初の案） | **確認1の前に量を減らした**（Worker 01b）。足すframeは合計8枚（画面全体3枚＝F47-13、状態の見本5枚＝F47-18が2・F47-19が1・F47-22が2）。F47-15・F47-17は「実装で決める」（Figmaは変えない）、F47-16・F47-21は既存nodeを直すだけ（新しいframeは0枚）にした。A・F47-14・C・Dは区分・採用値を変えていない | 確認1の判断の量を減らすため。採用値・要件の意味は変えていない。確認1（2026-11-21T09:21:56+09:00）でItsukiが整合案を承認済み（`figma-fix-requests.md`の`968dda2d…`）。FrontのFigmaへの反映は`figma-delta-47.md`（意図しない変更0件。SHA256SUMS `efd2f466d97a6c6cb1085fd9809ef968907432e2ecb7bac9650b9b7a78639168`） | Worker 01b。Itsuki承認済み |

**Frontが撮影で見つけて直した点（FIX1〜FIX8）**:

| FIX | 内容 | 種別 | 見つけた撮影 |
|---|---|---|---|
| FIX1 | Newsの「説明」のtextareaの書体がほかの欄と違う（`font: inherit`・`color`）。`.occ-tab .occ-field`の入力に追加 | 実装（CSS） | 撮影1 |
| FIX2 | 幅1440のタブの文字がFigmaより右・間隔が広い（`min-width: 44px`）。`min-width: 0`にし、押せる範囲44px以上は`::before`で保つ | 実装（CSS） | 撮影1 |
| FIX3 | 撮影scriptの期待の誤り: 幅390でライブを開いている間は一覧の行を求めない／閉じた折りたたみの中の欄・toastを覆いの検査から除く | 撮影script | 撮影1 |
| FIX4 | 作品の編集で、リリース日の欄の下に欄1つ分の空き（誤りの文の行が、誤りのない時も高さを取る）。誤りのない時は高さを取らない | 実装（CSS） | 撮影の修正1回 |
| FIX5 | 削除の確認の説明が1つの段落につながっていた。1行ごとに別の段落（Liveの確認は1段落のまま） | 実装（`openLiveDialog`・CSS） | 撮影の修正1回 |
| FIX6 | 撮影scriptの期待の誤り: 新規でまだ保存していない作品に「開いている行がある」を求めない | 撮影script | 撮影の修正1回 |
| FIX7 | 撮影scriptの期待の誤り: Local Modeの書き出し待ちの「JSONを書き出す *」を受け入れる | 撮影script | 撮影2 |
| FIX8 | 計画外ファイル`capture-admin-live.py`の期待2点（上の2） | 撮影script | 撮影2 |

**今の動きから意図して変えた所**（承認済みの要件どおり。試験の名前に`intended difference`などで明示）: 削除がその場で保存（今は確認のあと「保存」で確定）／保存の失敗で入力と編集面を残す（今はmodalが閉じ、変更はメモリに残って上の帯が「未保存」）／映像IDの誤りは欄の直下に出す（今はtoast）／保存は面の対象だけを送る（今は全体）／Site・Profile・Channel URLの入力は保存が成功するまで`siteData`に書かない（今は入力のたびに書く）／上の帯の「保存」の廃止／画像のフォームの言葉が全タブで「選ぶ／変える／外す」／数字に見える`id`のNewsが開ける。

## 6. 更新した既存試験

理由の要件は R47-26（保護試験の更新）に加え、各行に記す。**assertは、modalを直接呼ぶ1件（下の「外した試験」）を除いて消していない。** 数は`build-and-test-summary.md` §2。詳細は各Workerの結果（`worker-02a`〜`02e`の`changed_existing_tests`）。

### 6.1 段1（Worker 02a。追加だけの更新）

| 試験 | 変えた内容 | 理由 | 変えていない動き |
|---|---|---|---|
| `live-ticket-shell.test.mjs` `T43-COMPAT the only files changed by #43 are the planned ones` | 許可の一覧に#47のpath（cycle記録、closeの一時path、`test/admin-occasional-*.test.mjs`、fixture、`capture-admin-occasional.py`）を追加 | #47の計画済みの変更を「想定外」と判定しないため（計画 §3の表の段1） | 「想定外の変更は失敗」の検査（追加は計画のpathだけ）。試験数 23→23 |
| `admin-live-style.test.mjs` `LATER_ISSUE_STYLE_GROUPS`・`LATER_ISSUE_TABS`・`T46-STYLE every group … bytes of the base commit` | 変えてよいまとまりに`Reset & Base`・`Header`・`Tab Navigation`、対象外のタブに`site`・`news`・`youtube`・`discography`・`profile`、新しいまとまり`Occasional Updates`だけ追加を許す（`LATER_ISSUE_NEW_GROUPS`） | #47が上の帯を変え、新しいまとまりを足すため（R47-02） | ほかのまとまりのbytesが基準と同じ、`preamble`の一致、Liveのまとまりが変わっていること。ほかのまとまりの追加・削除・順序の変更は今も失敗。試験数 50→50 |
| 同上 `T46-COMPAT` の3件: ①News・YouTube・Disco・Profile・Siteが基準と同じmarkupとフォームの値、②汎用modalが同じ欄で開く、③headerの「保存」が全体を送る | `LATER_ISSUE_TABS`により対象外（skip）になった（**恒久のskip 3件**） | ①②はmodalと一覧のmarkupを#47が意図して変えるため、③はheaderの「保存」を廃止するため（R47-03・R47-16） | 観測の移し先: ①のフォームの値と②の欄・初期値・`id`は T47-PIN (a)(d)・T47-EQ・T47-NEWS・MUSIC・SITE・PROFILE。③は T47-PIN (c)・T47-EQ・T47-SCOPE・T47-MODE。**markupのbytesそのものは移し先なし**（意図して変わる）。modalのmarkupの一致も移し先なし（modalは撤去。置き換えは T47-GUARD・T47-A11Y） |

### 6.2 段2（Worker 02b。News）

| 試験 | 変えた内容と理由 | 変えていない動き |
|---|---|---|
| `admin-image-form.test.mjs` `generic modal close and replacement release abandoned image operations` → 名前を`closing the News edit surface and opening another edit release abandoned image operations`に | Newsがmodalでなく編集面になったため（R47-03・R47-12）。DOMの模型にNewsの編集面を足した | 閉じる・置き換えで待っているアップロードが解放され、あとから返った結果が次の項目に入らない（同じassert） |
| 同 `default image forms keep the existing path display for non-live images` | 「画像を変える／外す／選ぶ」の言葉を**足した**（R47-13） | `image-path-display`・`パス:`・`download-link`なし |
| `admin-live-operations.test.mjs` `Live is the initial primary tab and Tickets is not a global tab` | 5タブの名前・順序と、youtube/discographyがないことを足した（R47-01） | 既存のassert |
| 同 `Live edit workspace renders add and edit in the detail pane while News keeps the generic dialog` → 名前から"while News keeps the generic dialog"を外した | 末尾のNewsの期待を、modalが開かず`news-editor-body`に編集面が出る期待に置き換えた（R47-03） | Liveのassert（見出し・保存済み・保存して公開・削除・戻る・`aria-current`） |
| 同 `API fallback keeps every admin collection immutable while existing details remain viewable` | Newsをmodalのcaseから編集面のcase（読める・欄・保存・削除が無効・保存の試みで元に戻る・戻るは使える・fetch 0）へ（R47-15・S47-15） | YouTube・Disco（段3で置換）のcase、Site・Profile・News・Liveの無効の確認、`siteData`が変わらない |
| 同 `Live editor isolation guards dirty transition and prevents duplicate edit IDs from contaminating News save`・`Live API save transaction rolls back failure, preserves form values, …` | Newsが編集面になり、`addNews`が未保存の時にPromiseを返す（Liveと同じ）。modalの保存を`saveOccPanel`に | 未保存のLiveの上へNewsは開かない・「破棄して移動」でLiveが閉じてから開く・Newsの保存がLiveの値を巻き込まない・Liveの失敗とロールバック |
| 同 `generic edit modal remains an accessible dialog …` | 対象をDiscographyのmodalに付け替えた（modalはMusicが段5まで使うため）。**段5で外した**（下） | `role`・`aria-modal`・閉じる・初期フォーカス・Escape・フォーカスの復帰 |
| `admin-live-review-fixes.test.mjs` `T46-HEADER the other tabs differ from the base commit only in this display…` | Headerのmarkupと6タブを基準と同じとするassertを、新しいmarkup（ロゴ→`#modeBadge`→`#saveBtn` hidden、5タブ）のassertに置き換えた。基準と違うことも確認（R47-02・R47-01・R47-16） | local・read-onlyの「保存」の文字・disabled・帯の文言・`is-error`・`is-api`は基準と同じ |
| `admin-live-screens.test.mjs` `T46-IMAGE the other tabs keep their picture wording` → `…use the same three words as the Live flyer since #47` | 全タブで「選ぶ／変える／外す」。`画像を選択`・`タップして画像を選択`・`削除`がない（R47-13） | — |
| `admin-live-style.test.mjs` `T46-MODE the header 保存 is hidden on the Live tab only while the API is connected…`・`T46-MODE Local Mode and read-only keep the header button on the Live tab`・`T46-MODE leaving an unsaved Live through the global tab still asks first…`・`T46-COMPAT the shared picture form keeps the other tabs wording…` | 4件を#47の期待（`(rewritten by #47)`。API接続中はheaderの保存は`hidden`、Local Modeは「JSONを書き出す」、read-onlyにはheaderのボタンがない、画像の言葉）に置き換え（D47-08・R47-16・R47-13）。`is-live-concealed`→`hidden` | Local Modeの文字、read-onlyの文字「読み取り専用」・disabled、未保存のLiveをタブで離れる時の確認が出てLiveに留まる |
| `site-shell.test.mjs` `T44-ADMIN public Music maps to existing six admin tabs…` → `…the five admin tabs…` | `tab-btn`の数 6→5（R47-01） | READMEの語（`Music`・`#44`・`#43`・`Disco`・`YouTube`・`#47`ほか）のassert |
| `support/admin-app-harness.mjs` | Newsの編集面の要素・音楽とProfileのタブ・`__adminLiveTest`の新しい窓（`typeof`の守りつき）・`openOccasionalApp`を足した | 今の動きは変えていない。T47-PIN（base版を読む）は無変更 |

### 6.3 段3・4（Worker 02c。Music・Site・Profile）

| 試験 | 変えた内容と理由 | 変えていない動き |
|---|---|---|
| `admin-live-operations.test.mjs` `music data fields …` の27試験 | 作品・映像・Siteが編集面になり入口が変わったため（R47-03・R47-10・R47-14）。`saveModal()`→`saveOccPanel('item')`、`deleteItem()`（confirm）→`deleteOccItem()`＋確認の面の「削除する」、Siteの`onchange()`→`saveOccPanel('site')`、`modal-body`→`music-editor-body`。意図して変えた期待: 失敗で`siteData`は保存前のまま・入力が残る（S47-12）／削除はその場で保存／再試行は保存・削除自体の再試行 | 保存の本文・保存先のカテゴリ・`id`・参照が空に戻る・日付のbaselineは成功の後だけ進む・失敗でbaselineを保つ・不揃いの日付を保つ・Workerの400は該当の作品だけ・再試行で重複しない・Localの書き出し。27→27（数は変わらない） |
| 同 `API fallback keeps every admin collection immutable …` | YouTube・Disco・Siteのcaseを、News同様の編集面のcase（`music-add-btn`・`music-save-btn`・`music-delete-btn`が無効、`music-editor-back`は使える、fetch 0）に（R47-15・S47-15）。Siteの`onchange()`→入力（falseで元に戻る） | Site・Profile・News・Liveの無効の確認、`siteData`が変わらない、`saveBtn`・タブ・フィルターの状態 |
| 同 `generic edit modal …`（段3以降はどこからも開かれない） | 名前を`(kept until stage 5 removes it; since stage 3 nothing opens it)`に。`showModal`を直接呼ぶ | `role`・`aria-modal`・`aria-labelledby`・閉じる・初期フォーカス・Escape・フォーカスの復帰。**段5で外した** |
| `admin-image-form.test.mjs` `closing the News edit surface and opening another …`・`clearImage is latest for generic page images after API success and Local failure` | 作品も編集面（`editDiscography`は確認のあとに開くPromise）。Site・Profileの画像は`hasChanges`でなく`isOccDirty()`を見て、`siteData`の画像は変わらない（R47-03・R47-12・R47-13・D47-05） | 古いアップロードが次の項目の`edit-image`に入らない・入力とプレビューが清算後に動かない |
| `admin-occasional-save.test.mjs`・`admin-occasional-screens.test.mjs`（段2の自分の試験） | 他の入力を未保存にする手順を、旧経路（`footer.onchange()`）から入力への入力（`type`）に。`T47-TABS`を新しい`#music-tab`の`id`に（D47-05・R47-04） | 本文＝baseline＋対象だけ・live・ticket・参照・`heroImage`が落ちない・未保存の入力が残る |

### 6.4 段5・6（Worker 02d。modalの撤去・headerの「保存」）

| 試験 | 変えた内容と理由 | 変えていない動き |
|---|---|---|
| `admin-live-operations.test.mjs` `admin site-data save rejects cross-collection and same-collection duplicate Live IDs in API and Local modes` | APIの4ケースは、`saveData()`が`false`で何も送らず、`saveScoped`が重複Live IDを拒否してfetch 0、に（R47-16・D47-08） | Localの4ケース（無変更）、重複はPUT・ダウンロードされない、toastの文言 |
| 同 `music data fields deletion clears featured and shared video references through API` | 上の帯の「保存」が全体を送らなくなったので、`saveData()`が`false`で何も足さず、最後のPUT（削除そのもの）の本文で参照が空に戻っていることを見る（R47-16） | 顔にする作品・再生する映像が空に戻る、選択肢から消える、Localの側 |
| 同 `saving a rendered Live keeps its editor and selected replacement trigger after a category move` | `saveModal()`→`saveLiveWorkspace()`（modalの関数が無いため） | 置き換えたtrigger・タブ・フォーカス・`aria-current`・編集が閉じない |
| 同 `generic edit modal (kept until stage 5 …) remains an accessible dialog …`（**外した試験**） | 外した（R47-03。modalが無い）。表（計画 §3）の「削除する。置き換えを足す」どおり | 置き換えの観測: modalが無い＝`T47-MODE the generic modal is gone`、`role`・`aria-modal`・`aria-labelledby`・初期フォーカス＝`T47-A11Y the confirmation surface is an alertdialog…`、Escapeで閉じる＝`T47-GUARD`、フォーカスの復帰＝`T47-A11Y the focus goes back…` |
| `admin-live-save.test.mjs` `T46-SCOPE a Live save does not send unsaved changes of other tabs …`・`T46-TICKET saving PUTs the saved content …` | 他のタブの未保存を`siteData`へ直接書く作り方を、入力への入力に置き換え。「headerの保存が待つ／全体を送る」を「ほかの編集面の入力が残り、`siteData`は持たず、headerの保存は何も送らない」に。順番を「Liveを開く→未保存を作る」に（D47-05・R47-16） | PUTの本文はbaseline＋対象だけ・`未保存`の文字を含まない・live/ticket/他のkeyが落ちない・Ticket設定の保存の本文 |
| `admin-live-style.test.mjs` `T46-MODE (rewritten by #47 stage 5) the header 保存 is hidden on every tab while the API is connected, whatever is waiting, and its handler sends nothing` | 段2の版を「何があっても出ない・何も送らない」に（R47-16） | 全タブでhidden、HTMLのボタンとハンドラが残る、Local Modeの「JSONを書き出す」、read-onlyの扱い |
| `admin-live-pin.test.mjs` `T46-PIN (d) deleting a Live …` | 「その後のheaderの保存で同じ内容がPUTされる」を、削除そのものが1回のPUTで、`invokeSaveData`が`false`で何も足さないことに（D47-08） | 本文のlive・他のkey・編集が閉じる。`T46-PIN (h)`は無変更 |
| `admin-occasional-save.test.mjs` `T47-SCOPE the header 保存 sends siteData …`→`(stage 5) … sends nothing …`、`admin-occasional-screens.test.mjs` `T47-HEADER …` | 段2〜4は旧経路があったので、API接続中は`markChanged`でもheaderが出ない・何も送らない、に（D47-08） | Newsの保存の本文・ほかの入力が入らないassert、Local Mode |
| `support/admin-app-harness.mjs`・`admin-image-form.test.mjs`（自前のDOM模型） | modalの関数のexportを`typeof`の守りにした／外した | 動きは変えていない |

### 6.5 段7（Worker 02e。版・README）

| 試験 | 変えた内容と理由 | 変えていない動き |
|---|---|---|
| `admin-live-style.test.mjs` `T46-VERSION ADMIN_BUILD_ID and the ?v= … are the build of this Issue …` | `20261120-46`→`20261121-47`（`?v=`3つ・helperがappより前・READMEの記載）。READMEが#46の版も履歴に持つassertを足した（D47-20） | `ADMIN_BUILD_ID`は日付＋時刻（UTC）、ビルドの日付と`?v=`の日付が同じ、`live-operations.js?v=20260804-2`・`config.js?v=20260216-2001`は旧版のまま |
| `admin-live-operations.test.mjs` の版を固定していた4試験（Liveの編集面の`?v=`・`admin build marker and operator docs match the merged Live UI assets`・`shared LiveOperations script is loaded before the admin application`・`music data fields Site and edit-surface labels …`） | `?v=`・`ADMIN_BUILD_ID`の期待を新しい値に（D47-20） | helperがappより前、`music-data.js`の版がappと同じ、READMEの`Live編集の「下書きを作る」`・`10項目を一括置換` |
| 同 `API fallback is read-only while keeping Live navigation available` の README の1行 | `既存のNews・YouTube・Disco・Profile`→`既存のNews・Music（作品・映像・Channel URL）・Site・Profile`（R47-01） | 同じ試験のread-onlyの動きのassert |

`T47-PIN`（44件）は、段1から無変更で最後まで通る（SHA-256 `8ad2079b…`）。`admin-live-review-fixes.test.mjs`の`BUILD`は架空の値で、HTMLの版を読まないので段7では無変更。`profile-contact-shell.test.mjs`・`live-ticket-shell.test.mjs`の`T43-COMPAT admin/ … untouched`・`T45-COMPAT`は、基準commit同士の比較なので変えていない（全試験で通る）。`cloudflare/worker/test/`は無変更（Workerを変えないため）。

## 7. ADM-47-01〜13と主な要件の証拠

「撮影」は最終の撮影3（357枚＋Live 150枚）の自動の実測。画像の目視は§9。

| AC | 自動の試験で確かめたこと | 撮影・目視 | 残ること |
|---|---|---|---|
| ADM-47-01 今の保存と同じ本文（R47-10） | T47-PIN 44件（今のコードの動きを固定）、T47-EQ（同じ操作を今のコードと新しいコードで行い、PUTの本文を**文字列**で比べる。News・作品・映像・Channel URL・Site・Profile・画像。自由な日付・二重引用符・全角・旧形式の再構成・数字に見える`id`・カテゴリの移動を含む）。`T47-EQ … (intended difference)`は変えた所を明示 | — | 本番の値での確認は、merge後にItsukiが行う更新1件（§6） |
| ADM-47-02 未保存の確認（R47-04） | T47-GUARD 85件（全移動経路×6画面×未保存／変更なし、画像のアップロード中、保存中、`beforeunload`）、T47-STATES S47-02 | 撮影 `news-leave-confirm-*`・`site-leave-confirm-*` ほか | iOSのSafariの`beforeunload`（既知の制限） |
| ADM-47-03 必須項目を増やさない | T47-DATE（日付は新規・変えた作品だけ検査、映像IDの形は今のとおり、空のまま保存できる） | — | — |
| ADM-47-04 3項目を空のままでも今と同じ | T47-DELETE（削除と参照の空戻しが同じ1回のPUT。今のコードの2手と同じ本文）、T47-STATES S47-12・13 | `music-works-delete-confirm-*`・`music-works-playback-reset-*` | — |
| ADM-47-05 タブ5つ | T47-TABS（5つの名前・順序・「YouTube」「Disco」がない）、`T44-ADMIN … five admin tabs` | 全`chrome-*`の撮影でタブの名前・順序を実測 | — |
| ADM-47-06 「保存して公開」の出し方 | T47-SAVE・T47-STATES S47-01（4状態・二重clickは1回） | 撮影の実測（幅390: 変更なしで出ず、未保存・保存中・失敗で下に固定、1行。幅1440: 見出しの右、変更なしは薄く押せない） | — |
| ADM-47-07 他の入力を巻き込まない | T47-SCOPE（News・作品・映像・Channel URL・Site・Profileの各保存が、ほかの面の未保存を送らない。`live`・`ticket`・#41の3項目・`site.heroImage`が落ちない） | — | — |
| ADM-47-08 削除は確認のあとその場で保存 | T47-DELETE・T47-STATES S47-03・S47-11（失敗で項目・編集面・入力が残る）、FIX5 | `*-delete-confirm-*`・`*-delete-failed-*` | — |
| ADM-47-09 幅・44px・2列 | T47-STYLE（幅360・390・821・899・900・1011・1440）、T47-A11Y | 357枚の実測: 横スクロールなし・主要な操作44px以上・表示名・覆いなし。幅900px以上で2列、899px以下で一覧→編集 | 幅360・821・900・1011の目視は一部（§9） |
| ADM-47-10 Liveと公開側が壊れない（R47-21） | T47-LIVE-COMPAT・T47-STYLE（`Live Operations Hub`を含む、変えたまとまり以外が基準とbytes一致）、`T46-PIN`無変更、`git diff 1f3a1cd -- cloudflare assets data DESIGN_RULES.md`が空 | Liveの150枚（#46の画像と上の帯を除いて比較。同じ81・高さだけ違う46・差あり23。意図しない差は0件） | — |
| ADM-47-11 本番の形で崩れない（R47-20） | T47-FIXTURE（5つの形のfixtureで一覧・全項目を開く・変えずに閉じて`siteData`が同じ・1項目変えて保存→開き直し） | `*-long-values-*` | 本番の件数の桁・題の長さ・画像の実在（merge後にItsuki） |
| ADM-47-12 API接続失敗・Local Mode（R47-15・16） | T47-MODE（読み取り専用の全操作が無効・何も送らない、Localの全保存→書き出し→JSONの中身、API接続中の上の帯の保存が`hidden`）、S47-15・16 | `fallback-*`・`local-*` | — |
| ADM-47-13 上の帯の高さ（R47-02） | T47-HEADER・T47-STYLE-SPEC | 撮影の実測: Header 46px（幅390）・62px（幅1440）、Tabs 49px・53px | — |

主な要件: R47-01（タブ5つ）・R47-02（上の帯）＝上のADM-47-05・13。R47-13（画像の言葉）＝T47-IMAGE・T47-STATES S47-04。R47-26（保護試験の更新）＝§6。R47-22（撮影は架空のAPIだけ、本番へrequest 0件）＝撮影の`network_problems`が空（`build-and-test-summary.md` §4）。D47-17（数字に見える`id`）＝T47-EQ（数字に見える`id`）・T47-FIXTURE（numeric-ids）。

## 8. 撮影・手元配信の材料

- 撮影script: `test/support/admin-preview/capture-admin-occasional.py`（357画像）、`capture-admin-live.py`（Live 150画像）。`/usr/bin/python3`（Playwright 1.58.0）。通信は全requestを差し替え、本番のhost・`api.fixture.test`と`127.0.0.1`以外への通信は0件であることを検査する。`admin/config.js`は実ファイルを読まない。
- 手元配信（Itsukiが触る用。任意）: worktreeのrootで `/usr/bin/python3 test/support/admin-preview/fake_admin_server.py --port 8080 --fixture test/fixtures/admin-occasional-states.json` → PCは`http://127.0.0.1:8080/admin/`、スマホはtunnel経由（公開URLをAPIの向き先にする設定を返す）。**本物の合言葉を入力しない**。書き換わるのはメモリ上の架空のデータだけで、止めると元に戻る。起動するのはFront（Workerはlocalhostをbindできない）。

## 9. 未確認（この文書は結果を先取りしない）

- **Itsukiが手元配信で触る確認**: 未実施（任意。Itsukiは「mergeだけを行う」と決めた）。merge後の確認（`build-and-test-summary.md` §6）で補う。
- **merge後の本番の確認**: 本番の件数の桁・題の長さ・画像の実在・本番の値での表示。
- **実機**: iOSのSafari（`beforeunload`、フォーカス、キーボード）。headless Chromiumだけで確かめた。撮影は代替fontで描かれる（font取得を遮断するため）。
- **画像の目視の範囲**: 自動の実測は357枚すべて合格。目視したのはFrontが約28枚（撮影1の11枚・修正1回の7枚・撮影2の10枚）と、独立reviewが12枚。撮影3の357枚は撮影2との画素の比較（同じ352枚・差5枚。いずれも撮影の瞬間の違い）で確かめ、全数の目視はしていない。幅360・821・900・1011の191枚のうち目視したのは、`news-edit-821`・`news-edit-900`・`news-edit-1011`・`profile-edit-360`ほかの一部。
- **README・手元配信の例の実機確認**: `ngrok http 8080`・`cloudflared tunnel`の例は、計画 §7と`fake_admin_server.py`の説明に合わせて書いたもので、試していない。`fake_admin_server.py`の実際の起動（localhostのbind）は、Workerはできず、`--self-check`（bindなし）だけを流した。Frontの記録にも起動の確認はない。
- **Figmaの「足すframe」のrender画像がない（Gap-01）**: 値は`figma-delta-47.md`のspecで確かめ、画像の判断は撮影の目視で扱った。
- **本番の画像の実在・動画IDの有効性・リンク先の到達（Gap-02）**: 確かめていない。
- **独立reviewが実行できなかったこと**: 試験の再実行・`git diff`・SHA-256の再計算・base版`app.js`の直接の読み取り。これらはFrontが再実行し（全試験1326 / 1323 / 0 / 3、Worker 361 / 0）、Packet 02fが再度流して確かめた。
- **Front completion・Itsukiの確認2（gate 4・5）・merge・PR**: Workerの範囲外（自己承認していない）。`scripts/aidlc-cycle.sh close`は実行していない。
