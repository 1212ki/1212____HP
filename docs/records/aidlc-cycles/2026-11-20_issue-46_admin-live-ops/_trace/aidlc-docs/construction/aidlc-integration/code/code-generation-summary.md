# Code Generation Result — 管理画面のよくする3つ（Issue #46）

- Status: 確認2（gate 4）の候補 / Owner承認待ち（承認記録は作っていない）。Frontの6回の撮影（最終は150枚すべて合格）と独立review（APPROVED）を経た最終の状態（§11）。独立reviewの指摘のうちRV46-01・RV46-04と、Frontが直接入れた修理の試験をPacket 06で直した。この後にFrontの撮り直し（外枠の接続の表示を変えた後の1回）がある。Itsukiが触る確認・Worker deploy前後の確認・merge後の本番の確認は未実施
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-20_issue-46_admin-live-ops`
- Execution target: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-46-admin-live-ops`
- Branch: `feature/46-admin-live-ops` / base `e191e53ada480014e03ad2fa23835f6178ce371a`
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 何ができるようになったか

Itsukiがスマホで、新しいライブの登録・告知・予約の管理を、今より少ない操作で終えられる管理画面になりました。保存・削除・予約の状態変更は、今と同じ送り方・同じ数え方のまま動きます（動きを先に試験で固定してから画面を変えました）。

- **ライブを開くと、入力欄がすぐ見える。** 上の帯は「‹ 一覧｜日付と会場｜保存の状態」の1行だけになり、その下に公開内容／告知／予約の切り替え（予約には枚数）が続きます。公開内容はフライヤー→日付・会場→ライブ名→OPEN・START→料金→補足・共演者の順で、「予約先・リンクなど」と「元情報から作り直す」は折りたたみです。今まで編集できた項目はすべて残っています。
- **「保存して公開」は変更がある時だけ出る。** スマホは画面の下に固定で、幅900px以上は見出しの右に（変更がない間は薄く押せない）出ます。入力して元に戻せば「変更なし」に戻ります。保存の状態は「保存済み」「未保存」「保存しています…」「保存できませんでした」で、失敗の理由は「保存して公開」の上に1行出ます。
- **新しいライブは、押すボタンが3つ。** 「+ 新しいライブ」→元情報を貼って「下書きを作る」→内容を確認して「保存して公開」→「Xで告知する」。間に確認の面は出ません。保存の直後の告知の画面は新しいライブの時だけ出ます。
- **一覧に「予約 N枚」と「未対応 N」が出る**（API接続中の開催予定。あなたが確認1で「出す」と確定したもの）。そのために Cloudflare Worker に、件数だけを返す読み取りを1つ足しました（個人情報は返しません）。読めない時は一覧の上に1行の知らせが出るだけで、保存・予約の操作は止まりません。
- **予約を1件ずつ開いて状態を変えられる。** ライブごとの予約（合計・絞り込みの札・行）と、全ライブの「予約管理」で、行を押すと1件が開き、「対応済みにする」「キャンセルにする」「未対応に戻す」を押せます。「+ 取り置きを追加」は別の画面です。幅900px以上は表になり、1件は表の右に開きます。
- **削除は、いちばん下の文字「このライブを削除」から。** 確認の面（予約があれば件数つき）で「削除する」を押すと、その場で保存して公開画面からも消えます。失敗した時はライブが一覧に戻り、入力が残ります。
- **Ticket Page共通設定は専用の画面で、その画面の「保存して公開」で保存する。** 保存するまで公開データへ反映しません。
- **ほかのタブの「保存していない変更」を巻き込まない。** Live・削除・共通設定の保存は「最後に保存できた内容に、その操作の対象だけを重ねたもの」を送ります。Site・News・YouTube・Disco・Profile のタブの保存（headerの「保存」）は今のままです。
- **未保存のまま別へ移ろうとすると、画面の中の確認が出る**（「破棄して移動」「編集を続ける」）。再読込・戻る・閉じるはブラウザ標準の確認で止めます。
- **幅900px以上は、左に一覧（幅320）、右に編集面。** 公開内容は2列・3列、幅900〜1179pxは列を1つ減らします。
- **外枠の接続の表示が短くなった。** API接続中はHeaderの小さい文字の場所（「1212 Admin」の下）に「接続中」だけを出し、接続の帯は出しません。帯は、API接続に失敗して読み取り専用で表示している時と、Local Modeの時だけ出ます（文言は今のまま）。ビルド標識（版）は画面の文字にせず、その表示の`title`属性に入れました。他のタブ（Site・News・YouTube・Disco・Profile）で変わるのは、この接続の表示だけです（6タブの表記・並び・ほかの外枠は変えていません）。
- **一覧の予約の数が読めなくても、接続先は動かない。** 予約の数の読み取りが失敗（404・401・403・500・通信失敗）しても、基準のAPIの切り替えや読み取り専用への切り替えは起こらず、保存と予約の操作は同じ接続先へ出続けます。
- **触って確かめる入口が用意してあります。** 架空のAPIで動く手元配信です（本番のデータは書き換わりません。入力の窓も出ません）。起動の1行は「撮影・手元配信の材料」にあります。

**確認2で知っておいてほしいこと**（詳細は §4・§11）:

- 要件の2つの記述が両立しない所が1つあり、承認済みのR46-07とFigma `44:546`の側を採りました。新しいライブの確認の画面は、公演の中の切り替え（公開内容／告知／予約）を出さないので、「保存すると使えます。」（R46-02・S46-14）を出す場面がありません（§4の10）。
- 先の Issue（#43・#44・#45）の保護試験3ファイル（4件）を更新しています（§5.1。守りたい事実は commit どうしの比較で保っています）。
- 幅1440の編集の見出しの状態の文字は、マスタの「開催予定・保存済み」でなく「保存済み」だけ（保存の状態だけ）にしています（§4の3）。
- Ticket Page共通設定の保存は、`ticket`を`completeText`と`fields`の6項目だけに置き換えます（既知の制限。§11.8）。
- Headerの「接続中」は、今のHeaderの小さい文字の場所に出しています（Figmaの右寄せの46px高のHeaderにはしていません。§4の12）。

**まだ確認できていないこと**: Frontの撮り直し（外枠の接続の表示を変えた後の1回）、Itsukiが触る確認、Worker deployの前後の読み取り確認、実機（特にiOSのSafari）、merge後の本番の確認と本番の予約の件数の桁での見え方。この文書は結果を先取りしません（§11.9）。

## 1. 昇格と承認済み文書のSHA-256

昇格先は提案版と同じbytes（`cmp -s`一致。昇格前の元版hashが計画 §3 の値と一致することを昇格前に確認済み）。いずれもこのPacketで変えていない。

| 文書 | SHA-256 |
|---|---|
| `docs/specs/current/live-operations-admin-ui.md`（昇格済み。提案版と一致） | `4035f4e793a44f414eea787d4b9a79314d12ee98f3649fcb72bb9d748ea7ef8a` |
| `docs/specs/current/README.md`（昇格済み。提案版と一致） | `d5b35b8eb81f438dacc60037830dcaa8dc5beb994a2335feff16aaf8ba63cb3e` |
| `aidlc-docs/inception/requirements/requirements.md`（承認済み） | `d27587c0d54ad30c9b458561bbcaffbfacb06db3adf79c9ae90c94efc1def964` |
| `aidlc-docs/inception/plans/execution-plan.md`（承認済み） | `bb8682c4b3d700a45cd208b6f5d20a18b47a96e8f2a6c31ee92b53edfc4a8bd3` |
| `aidlc-docs/construction/plans/aidlc-integration-code-generation-plan.md`（承認済み） | `0f2ebf99ea9c5023e4a8b9918f6c40690866c7a6b9c94a88593328506c9bfe04` |
| `aidlc-docs/construction/aidlc-integration/figma-fix-requests.md`（承認済み） | `31ee3c2a9d8ca086099b4ff920e5aeb5b3783f359bf24aa0fceaa51b03d9ba77` |
| `aidlc-docs/approvals/01-requirements-approval.md` | `22462390c6dd2060f47f77217ba168b48876d5926f9867abbee2bdb233fbb520` |
| `aidlc-docs/approvals/02-workflow-plan-approval.md` | `02ce5185e8de62bff4aaeea9e705f59a86bdd7c89f79bac305b504bf5dcf269e` |
| `aidlc-docs/approvals/03-code-generation-plan-approval.md` | `c9e325b6295bf579c54346c28a59bfaaf92aeeecf12ecca4e87710f23691ed57` |

gate 4・5の承認記録は作っていない（確認2でItsuki本人のAを得てからFrontが記録する）。

## 2. 変えたファイルと段ごとの内容

`git diff e191e53 --numstat`（追加 / 削除。Packet 06の後の最終値）と、新規ファイルの行数。

| path | 内容 |
|---|---|
| `admin/index.html`（+102 / -83） | 一覧の案内の行・「+ 新しいライブ」・確認の面`#live-dialog`・Ticket Page共通設定の専用画面（Headerと7項目と保存して公開。一覧と同じ`.live-master-detail`の中）・予約管理の一覧→1件・`ADMIN_BUILD_ID`と`?v=20261120-46` |
| `admin/app.js`（+1383 / -330） | 下の「実装箇所」。1ファイルのまま（新しいscriptは足していない） |
| `admin/style.css`（+1956 / -167） | `Live Operations Hub`のまとまりの中だけ（他のまとまりは基準とbytesが同じ） |
| `admin/README.md`（+57 / -6）・`cloudflare/worker/README.md`（+17 / -0） | 運用・手元での確認・画面の確認・反映順序とrollback、集計APIの経路・応答・数え方・新旧の組み合わせ・公開順序 |
| `cloudflare/worker/src/worker.js`（+40 / -0） | 集計の経路と関数だけ（追加のみ。このPacketでは変えていない） |
| `cloudflare/worker/test/ticket-reservation-summary.test.js`（208行・14件） | T46-SUM |
| `test/admin-live-pin.test.mjs`（31件）・`admin-live-save.test.mjs`（38件）・`admin-live-screens.test.mjs`（75件）・`admin-live-style.test.mjs`（50件）・`admin-live-review-fixes.test.mjs`（18件） | T46-PIN・FIXTURE／SAVE・GUARD・DELETE・SCOPE・TICKET／LIST・OPEN・FIELDS・NEW・DRAFT・ANNOUNCE・IMAGE・RESERVE・AUTH／STYLE・MODE・COMPAT・VERSION・OVERLAP・MANUAL／HEADER・SUMMARY-BASE・ERRORLINE |
| `test/support/admin-app-harness.mjs`・`test/fixtures/admin-live-states.json` | 切り出したharness（追加だけ）と架空のfixture（`sites`を足して全scenarioを実データ化） |
| `aidlc-docs/construction/aidlc-integration/verification/{capture-admin-live.py,fake_admin_api.py,fake_admin_server.py}` | 撮影・架空のAPI・手元配信（実行はFront） |
| 既存の試験5ファイル | 下の「更新した既存試験」 |

段ごとの内容（各段のRED→GREENは`build-and-test-summary.md`）:

- 段1（今の動きの固定）: harness切り出し、fixture、T46-PIN・T46-FIXTURE（変更前のコードでGREEN）。
- 段2（Workerの集計）: `GET /api/admin/ticket-reservation-summary`。
- 段3（保存の土台）: 確認の面、未保存の判定、対象だけを重ねる保存、削除、共通設定の下書きと保存、`beforeunload`。
- 段4（一覧と集計の表示）／段5（開いた画面・新規・告知）／段6（予約・取り置き・予約管理）: 前のPacketの結果どおり（`worker-02b-result.md`）。
- **段7（このPacket）**: 幅900px以上（左に幅320の一覧・右に編集面、見出しの右の「保存して公開」＝変更がない間は薄く押せない、公開内容の2・3列、900〜1179pxの列の削減、告知の2列、予約の表と右に開く幅320の面、予約管理の表と1件の面、行の中の「対応済みにする」）、Ticket Page共通設定の専用画面（上の帯「‹ 一覧｜Ticket Page共通設定｜保存の状態」、未保存の時だけ下の操作、幅900px以上は見出しの右に薄く常時、一覧は左に残る）、`saveBtn`の表示条件、確認の面の寸法・ボタンの配置・背面を`inert`にすること、T46-STYLE・MODE・COMPAT。
- **段8（このPacket）**: 撮影script・架空のAPI・手元配信・fixtureの全scenario、README2つ、`ADMIN_BUILD_ID`と`?v=20261120-46`、版の一致の試験（T46-VERSION）、最終の全試験、結果の文書。

### 段7で足した関数・状態・DOM（`admin/app.js`）

- 状態: `activeGlobalTab`・`liveLayoutListenerBound`。関数: `isWideLiveLayout`・`bindLiveLayoutListener`・`syncLiveLayoutMode`（幅900pxをまたいだ時に開いているものを残したまま並びだけ替える）、`shouldConcealGlobalSave`・`syncGlobalSaveButton`、`syncTicketSettingsActions`、`renderReservationTableHead`、`setLiveDialogBackdropInert`。変えた関数: `syncLiveEditorFooter`・`syncLiveEditorHeader`・`setLiveReservationView`（`options.focus`）・`syncCrossReservationView`（同）・`setLiveEditorSaveStatus`・`handleLiveEditorBack`・`syncTicketSettingsPanel`・`recomputeTicketDirty`・`saveTicketSettings`・`renderReservationRow`（表のセルと行の操作）・`renderReservationDetail`（「閉じる」）・`handleReservationViewAction`（`data-reservation-close`）・`openLiveDialog`（`tone`）・`setupTabs`・`markChanged`・`setSaveStateSaved`・`renderModeBadge`・`applyApiFallbackReadOnlyState`。
- DOM: `#live-reservations-panel`（`data-tickets-view`）、予約の`#live-editor-panel-reservation[data-reservation-view]`、`.reservation-row-item`・`.reservation-cell*`・`.reservation-row-action`・`.reservation-table-head`・`[data-reservation-close]`、`.live-announce-comment`・`.live-announce-preview`、`#live-page-primary.is-ticket-settings`・`body.is-live-ticket-settings`、`.save-btn.is-live-concealed`。既存の`id`は残している。

## 3. 保存の対象の分離・集計・新旧の組み合わせの実装箇所

- **保存の対象の分離**（`admin/app.js`）: `saveScoped(applySlice)`が`releaseDateBaseline`（最後に読み込めた／保存できた内容。`getSavedBaseline()`）の複製に`applyLiveSlice`・`applyDeleteSlice`・`applyTicketSlice`の対象だけを重ね、`clearDanglingMusicReferences`と重複`id`の検査を通して`saveToApi(payload, {authReason})`で`PUT /api/admin/site-data`する。成功で`baseline`が送った内容になり、`hasChanges`（headerの待ち）は触らない。失敗は`siteData`を保存前へ戻す。呼び出し: `saveLiveWorkspace`・`deleteLiveFromWorkspace`・`saveTicketSettings`。他のタブの保存（`saveData`・各modal）は変えていない。試験: T46-SCOPE・T46-SAVE・T46-DELETE・T46-TICKET。
- **集計**: `cloudflare/worker/src/worker.js`の`TICKET_RESERVATION_SUMMARY_SQL`（個人の列を読まない）・`summarizeTicketReservationRows`（キャンセルを除く。`liveId`昇順、数でない`seats`は0）・`listTicketReservationSummary`・経路`GET /api/admin/ticket-reservation-summary`（`isAdminAuthorized`の後でだけDBを読む）。管理画面側は`reservationSummary`・`loadReservationSummary`・`renderReservationSummaryNote`・`getLiveSummaryText`・`renderLiveRow`。試験: T46-SUM（Worker 14件）・T46-PIN（管理画面の台帳の合計と同じ入力で同じ値）・T46-LIST。
- **新旧の組み合わせ**: 新しい管理画面＋古いWorker＝集計だけが`404`→`loadReservationSummary`（`adminFetch`に`allowBaseFallback: false`を渡し、基準のAPIの切り替えはしない。§11.5のD4）が「予約の数を読み込めませんでした。」の案内の行にするだけで、`PUT`・予約の経路は変わらない（T46-LIST。撮影scenario `summary-404`）。古い管理画面＋新しいWorker＝新しい経路を呼ばない（Workerは追加だけ。`git diff e191e53 --numstat`で`40 0`）。401・403は「認証できませんでした。」（`summary-401`）。Workerを先にdeployする順序は`cloudflare/worker/README.md`・`admin/README.md`に書いた。

## 4. 計画からの差

承認済み計画のbytesは変えていない。以下はすべて、細部の選択か、計画 §3 の外の許可の追加で、意味の違う見せ方を選んだものはない。

1. **保護試験3ファイル（4件）の更新**（Frontの決定FD2〜FD4。計画 §3 にない既存試験）: 先の Issue（#43・#44・#45）の保護試験が、#46が変える`admin/`・`cloudflare/`に反応したため、守りたかった事実を commit どうしの比較で保つ形に改め、許可リストに #46 のファイルを名前で足した。assert は消していない。詳細は「更新した既存試験」の表。**Itsuki は確認2でこの更新を知る。**
2. `test/admin-live-pin.test.mjs`の`T46-FIXTURE`のkey一覧に`sites`を足し、全scenarioを実データ化する試験を1つ足した（このPacket。計画 §3「fixtureの全scenarioを実データ化」の範囲）。
3. 幅1440の見出しの状態の文字は、マスタ（`47:627`「開催予定・保存済み」）でなく、Requirements R46-18・設計書のとおり「保存の状態だけ」にした（幅390と同じ要素・文言。前のPacketのdesign_choices。Frontも同じ判断）。
4. Ticket Page共通設定の専用画面は、計画 §2「専用画面」と F46-12（幅1440は左の一覧を残して右に開く）に合わせて、`#live-ticket-settings-panel`を`.live-master-detail`の中へ移した。これにより、設定を開いた時に`#live-page-primary`を`hidden`にする代わりに`is-ticket-settings`のclassを付ける形になり、既存の試験1件を更新した（表）。
5. 幅900px以上の「区分と削除」を1行にする（Figma `47:679`）ことは、Packet 04で行った（§9）。当初は縦のままにしていたが、Frontの初回撮影の目視で食い違いと分かった。
6. 確認の面のボタンの色は、未保存の確認は「編集を続ける」がPrimary・「破棄して移動」がSecondary（Figma `39:762`）、削除の確認は「やめる」がSecondary・「削除する」がPrimary（整合案 F46-15）。ボタンは横に並べる。背面は`inert`。
7. 前のPacketの計画からの差・design_choicesは`worker-02a2-result.md`・`worker-02b-result.md`のとおり（段4〜6の「`renderTicketRow`の置き換え」「予約管理の`#tickets-*`の追加」「`.live-announcement-actions`の規則を残してIDの選択子で当てた」「日付の表記は`formatLiveDate`の出力」「コピーの結果はボタンの近く」「説明の文を足さない方針」など）。
8. 撮影は、静的配信のserverもbindも要らない作りにした（計画 §6 は`python3 -m http.server`をFrontが起動し`--base`を渡す形。`context.route`が必要なファイルだけをrepoから応えるので、`--base`は応えるページの見かけの配信元の指定だけで足りる）。1行の command で全scenarioを撮れる。
9. `admin/config.js`の値・実ファイルは読んでいない。撮影と手元配信は架空の設定で応える。
10. **要件の2つの記述の食い違い（独立review RV46-02。直さない）**: Requirements R46-02・S46-14は、新しいライブを保存するまで告知・予約を押せないことを「保存すると使えます。」で示すと定める。一方、R46-07とFigma `44:546`は、新しいライブの確認の画面に公演の中の切り替え（公開内容／告知／予約）を出さないと定める。両方は成り立たない（切り替えが無いので、押せない告知・予約の操作が見えず、文を出す場面が生じない）。**Frontは承認済みのR46-07とFigmaの側を採った**。文は告知・予約の面の中にだけあり、保存前の新しいライブでは画面に届かない。コードは変えていない。理由は、新しいライブの画面の構成を決めているのがR46-07とFigmaであること、切り替えを出すと押せない操作を見せることになり1画面1目的に反することの2つ。確認2でItsukiにこの食い違いと採った側を示す。S46-14を「出さない」へ改める場合は、要件を新しいhashで承認し直す必要がある。
11. 保存の状態の文言は、保存前の新しいライブの「保存すると使えます。」以外はすべて画面に出る（T46-SAVE・T46-NEW）。
12. **Headerの「接続中」の置き場所**: 要件 §6の最後の行は「Headerの『接続中』」とだけ定める。Figma v2は右寄せの高さ46pxのHeaderだが、Headerのmarkupと`style.css`の`Header`のまとまりは全タブ共通で#47の範囲（T46-STYLE・T46-HEADERが基準のbytesと同じことを検査している）。そのため、今のHeaderの小さい文字（`#modeBadge`。「1212 Admin」の下）の文言を「接続中」にし、帯を出さないことで、一覧の上の段を1つ減らした（Header・タブの2段。Figmaの46pxにはなっていない）。Header自体の高さ・並びは変えていない。
13. **前のPacketのdesign_choicesのうち、要件・マスタと違う所**（意味の違う見せ方を選んだものはない。順序はRequirements→設計書→Figma）:
    - 日付の表記は`formatLiveDate`の出力（`2099.12.12(Sat)`）で、Figmaの見本の空白は採らない（F46-24）。
    - 幅900〜1179pxの「ライブごとの予約」は、表でなく2行の形（名前と枚数・受付・状態の札、右に「対応済みにする」）で、表の6列は幅1180px以上から（編集面が440〜600pxで6列が入らず、行に名前が出なかったため。Packet 05のH3）。予約管理の表は全幅で表。
    - 予約の表・予約管理の表に、Figmaにある「ひらく」と「ライブ」の列を足していない（Requirements R46-14と設計書§10.2の表に無い）。
    - 新しいライブの`edit`で何も入力していない間は、右の文字を出さない（R46-04「何も入力していない間は未保存としない」を優先）。
    - 画像アップロード失敗の文言「画像をアップロードできませんでした（理由）」、コピーの結果を押したボタンの近くに出すこと、ローカルモードの下書きの2つの文は、文書に定めが無く、設計 §10の趣旨で決めた。
    - 幅899px以下でライブを開いている間はHeaderと接続の帯が退くので、読み取り専用であることは画面に出ない（R46-01。操作は無効）。

## 5. 更新した既存試験

assertは消していない。skipもしていない。試験の数は減っていない。理由はすべて「#46が意図して変える所」か、「他のIssueの保護が#46のファイルに反応した」こと。

### 5.1 保護試験3ファイル（前のPacket。計画 §3 にない更新。Frontの決定）

| 試験名 | 変えた理由 | 保ったassert |
|---|---|---|
| `test/live-ticket-shell.test.mjs` `T43-COMPAT shared code, tokens, design rules, admin and the Worker are untouched` | #46が admin・Worker を変える。`admin`・`cloudflare`は、#43のBASEから#46のbase `e191e53a…`までの commit どうしの差分なし（#43が admin・Worker を変えていない事実）に | 共有 script・tokens・DESIGN_RULES・`style.css`のbytes、`data`・`scripts`の作業ツリーとの比較 |
| 同 `T43-COMPAT the only files changed by #43 are the planned ones` | 許可リストが#46のファイルを知らない。#46のファイルを名前で追加（`admin/index.html`・`app.js`・`style.css`・`README.md`、Workerの`src/worker.js`・`README.md`・集計の試験、`test/support/admin-app-harness.mjs`、`test/admin-live-*.test.mjs`、`admin-live-states.json`、更新した既存試験の名前、`docs/records/aidlc-cycles/2026-11-20_issue-46_admin-live-ops/`）。広い正規表現にしていない | それ以外はすべて「予期しない変更」として落ちる |
| `test/profile-contact-shell.test.mjs` `T45-COMPAT untouched files keep the base bytes (…admin, data, Worker)` | 同上。`admin`・`cloudflare`は#45のBASEから`e191e53a…`までの commit どうしの差分なしに | 共有 script・tokens・DESIGN_RULES のbytes、`data`の作業ツリーとの比較 |
| `test/site-shell.test.mjs` `T44-STYLE/COMPAT all previous CSS bytes retained and new rules scoped to Music only` | 末尾の`admin/index.html`・`app.js`・`style.css`を、作業ツリーでなく「`e191e53a…`のbytes＝#44の基準のbytes」に | CSSの追加がMusicだけ・色の直書きなし、DESIGN_RULES・tokens・`music-data.js`・`live-operations.js`・`site-config.js`のbytes |

### 5.2 `test/admin-live-operations.test.mjs`・`test/admin-image-form.test.mjs`（段3。計画 §3 が許す。要件が変わった所だけ）

| 試験名 | 変えた理由 | 変えていない動きのassert |
|---|---|---|
| `Live API save reports saving, saved, and failed states around the existing save route` | 保存の状態の文言（保存中→保存しています…、保存失敗→保存できませんでした。§10.2・AC46-07） | PUTの経路、「保存済み」、保存の戻り値 true/false、再入力後の失敗 |
| `Live dirty guard blocks and then discards navigation to another Live, list, and global tab` | `window.confirm`→確認の面（R46-03・§10.2） | 別Live・一覧へ戻る・予約管理・グローバルタブの4つの移動が止まる、`currentEditId`・入力値・タブの状態、確認が4回、破棄すると移る |
| `beforeunload protects global changes and Live dirty or saving states` | 破棄の確認が確認の面になった分、保存のstubが`saveData`→`saveToApi` | クリーンで止めない・未保存で止める・保存中で止める・保存後に止めない |
| `Live edit workspace API save uses the existing save route and deletion keeps existing collection semantics` | 保存のstubが`saveToApi`。削除は確認の面で、その場で保存される（R46-06）ので「`getSaveCalls() === 1`」を「その場で2回目の保存（`saveToApi` 2回）・`saveData` 0回」に | 保存の成功と「保存済み」、削除したLiveが`siteData`から外れる、編集面が「Liveを選択」に戻る |
| `Live editor isolation guards dirty transition and prevents duplicate edit IDs from contaminating News save` | `confirm`→確認の面。`addNews()`は確認の間`false`、破棄で続きのmodalが開く | 止めた時はmodalが開かず`currentEditId`と入力が残る、破棄後は編集面が空でmodalが開く、NewsがLiveの入力・idに混ざらない |
| `Live API save transaction deduplicates clicks and locks mutations, navigation, back, and delete while pending` | stubが`saveToApi` | すべて（保存の呼び出し1回、操作の無効化と`aria-disabled`・`aria-busy`、移動・削除の拒否、遅れて返ったAIの応答の破棄、終了後の復帰） |
| `Live API save transaction rolls back failure, preserves form values, and cannot leak failed data through later header save` | stubが`saveToApi`、失敗は`resolve(false)`でなくreject（理由つき）。状態の文言と理由の行`live-editor-save-error`のassertを追加。失敗で未保存のままなので、Newsを開く前に確認の面で破棄を選ぶ | 保存中の`siteData`の隔離、失敗後に`siteData`・入力・区分・headerの保存の無効が戻る/残る、headerの保存に失敗の内容が漏れない |
| `Live API publish blocks global tab navigation …`・`global tabs re-enable and navigate normally after Live API publish succeeds` | stubが`saveToApi` | assertは変えていない |
| `global tabs re-enable after Live API publish rollback while the failed Live form stays dirty` | stubと失敗の与え方、状態の文言、グローバルタブの移動が確認の面（破棄） | タブの再有効化、入力が残る、`saveBtn`が無効 |
| `deleting the selected Live falls back to all Lives and reloads the guarded ledger once` | `confirm`→確認の面。件数を決める読み取りが1回増えるので「fetchが1回」を「全Liveの台帳を取り直す読み取りが1回」に | 絞り込みの選択肢から消える、選択が全Liveに戻る、台帳の結果が出る |
| `Ticket settings remove legacy copy and keep completion, field editing and contact in saved data` | 入力が下書きになった（R46-15）ので、編集の後に「`siteData`は変わっていない」を足し、保存は`saveTicketSettings` | 旧文言の欄・keyが無い、`completeText`の既定・保存済みの値、保存の本文の`ticket`（編集した完了文・`showQuantity` false・`labelMessage`）と`contact`の保持 |
| `test/admin-image-form.test.mjs` `a Live image upload cannot update a replacement workspace editor that reuses edit-image IDs`・`Local Live image read blocks transition until confirmed discard releases its owner` | `confirm`→確認の面（stay / discard）。別harnessに確認の面の要素と`setSaveToApi`を追加 | 止めた時のeditor・入力・`ensureNoActiveImageUploads`、破棄でrelease、古いuploadの結果が新しいeditorに入らない |
| 同 `Live image overlapping same-ID uploads release the superseded request when latest settles`・`clearImage is latest across API and Local Live image operations` | 保存のstubが`saveData`→`saveToApi` | assertは変えていない |

### 5.3 `test/admin-live-operations.test.mjs`（段4〜6。前のPacket）

| 試験名 | 変えた理由（要件） | 変えていない動きのassert |
|---|---|---|
| `Live edit workspace renders add and edit in the detail pane while News keeps the generic dialog` | 見出しの上の小さい文字を外す・見出しが日付と会場だけ・新規の見出しが「新しいライブ」・削除が文字・新規には削除が無い（R46-01・03・07） | 編集面の開閉、`edit-sourceText`が出る、モーダルが開かない、`currentEditId`、戻るの表示、選択中の`aria-current`・`is-selected`、「保存して公開」、一覧へ戻る、確認のあとNewsのモーダルが開く |
| `Live task tabs are semantic, keyboard operable, and preserve mounted input` | 「予約」に枚数の要素が付く（R46-02） | 切り替えのrole・`aria-selected`、キーボード操作、入力の保持 |
| `new Live prioritizes source intake and gates post-save tasks until first save` | 新規の元情報は折りたたみでなく専用の面、既存は折りたたみ（R46-07） | 告知・予約が保存前は押せず保存後に使える、手入力で作るで公開の欄が出て日付にフォーカス、非表示の入力が残る、既存は閉じた折りたたみで欄が隠れない |
| `responsive Live workspace fixes overflow, focus, sticky actions, and action hierarchy deterministically` | 「Xで告知する」は告知のPrimary（R46-08・figma 44:676） | 「保存して公開」のPrimary、表の列・固定・44px・`overflow-wrap`・`@supports`・`prefers-reduced-motion`、`addLive()`の導線 |
| `AIで整理 source intake …`（legacy・openai・claude各系統）のうち、ボタン名・実行中・失敗・手入力の文言を見るもの | 下書きの名前（F46-16・§10.2） | 送る本文、10項目の置き換え、provider表示の固定文、入力・元情報の保持、古い応答の破棄、Local Modeで APIを呼ばない、予約の保存の排他、読み込み先の固定 |
| `…stays local-only in Local Mode…` | ローカルの案内文の名前 | API・解析・プレビュー・保存を呼ばない |
| `Live editor exposes new fields and conservatively infers only a missing legacy ticketUrl` | 「予約先」の説明文と「詳細・SNSリンク」の名前を外す（Requirements §6） | 旧`link`から`ticketUrl`を推定する規則と、明示の空値は推定しない |
| `structured Live editor normalizes legacy date and saves independent detail fields` | 旧詳細の見出しを外して説明を常に出す（F46-21） | 旧詳細の値が入る・日付の正規化・保存で各項目が別々に入る・説明の値が保たれる |
| `unified X announcement preview drives Intent and copy without save` | 「X投稿プレビュー」→「投稿の内容」 | プレビューが1つ、`updateXPreviewInModal`、コピー・Intentが保存を呼ばない |
| `Issue #20 live link actions copy only the saved stable share URL …`・`…use the existing clipboard fallback and report both outcomes` | コピーの結果をボタンの近くの「コピーしました。」「コピーできませんでした」へ（§10.2） | 共有用のアドレス（保存済みだけ）、クリップボードの書き込み・代替、保存を呼ばない |
| `new Live requires an explicit save before X Intent or reservation operations` | 「保存すると使えます。」（R46-02） | 保存前は`x-intent-btn`・`manual-reservation-submit`がdisabled、`buildXIntentUrlFromModal`が空 |
| `saved Live ledger shows Local Mode gate and API mode fetches one Live …` | 合計が「N枚」「N件」、連絡先・内部メモ・受付元は1件の画面へ（R46-12） | Local Modeの案内、`liveId`つきの1回の取得、キャンセルを除く件数・枚数、手動・Webの別 |
| `active totals exclude cancelled reservations and cross-Live rows expose source/contact/note` | `renderTicketRow`を`renderReservationDetail`に置き換え | キャンセルを除く合計、手動の札・連絡先・内部メモ、HTMLのエスケープ |
| `reservation status actions use escaped data attributes and delegated event handling` | 同上 | `onclick`を使わない、`data-reservation-id`のエスケープ、`data-reservation-status`、委譲した処理、状態のPOSTの経路 |
| `test/admin-live-pin.test.mjs` `T46-PIN (e) the Live ledger shows the active totals of the rows it reads` | 合計の見せ方（R46-12） | 合計（キャンセルを除く件数2・枚数5） |
| 同 `T46-FIXTURE every Live renders, opens, saves and reopens …` | 説明の欄を常に出す（F46-21） | 全ライブが例外なく開く・保存・開き直しで値が同じ |
| `test/admin-live-save.test.mjs` `T46-SAVE a new Live is not unsaved until something is typed …` | `source`の面は状態の文字を出さない（R46-07） | 新規は入力するまで未保存でない、入力して戻せば未保存でなくなる |
| 同 `T46-DELETE a new Live has nothing to delete` | 新規には削除が出ない（R46-03） | 新規で削除が呼ばれても何もしない・確認の面が出ない |

### 5.4 このPacket（段7・8）の更新

| 試験名 | 変えた理由 | 変えていない動きのassert |
|---|---|---|
| `test/admin-live-operations.test.mjs` `Live workspace separates reservations and Ticket Page共通設定 from Live list details` | 共通設定の戻る操作が上の帯の「‹ 一覧」になった（R46-15。「Liveページへ戻る」→「‹ 一覧」） | 予約管理のpanel・一覧、入口の名前と`aria-controls`・`aria-expanded`、共通設定のpanelが`role="region"` |
| 同 `Live workspace Ticket Page settings moves focus and synchronizes disclosure state` | 共通設定を開いた時、`#live-page-primary`を`hidden`にする代わりに`is-ticket-settings`のclassを付ける（一覧を左に残すため。F46-12） | `aria-expanded`の同期、共通設定のpanelの表示・非表示、フォーカスが戻るボタン／入口へ移る |
| 同 `responsive Live workspace fixes …` | `?v=`の更新（`style.css`・`app.js`を`20261120-46`へ。計画 §3） | 上の段5の行のとおり |
| 同 `shared LiveOperations script is loaded before the admin application` | `style.css?v=`の更新 | 共有scriptがadminより先に読まれる |
| 同 `music data fields Site and modal labels, choices, escaping and Local JSON roundtrip` | `music-data.js`・`app.js`の`?v=`の更新（順序の検査） | `music-data.js`が`app.js`より先、他の項目 |
| 同 `admin build marker and operator docs match the merged Live UI assets` | `ADMIN_BUILD_ID`の日付と`?v=`、READMEの`AIで下書きを作る`→`下書きを作る`（F46-16の改名） | `?v=`が3つ揃う、`10項目を一括置換`の記載、`style.css`と`app.js`と`music-data.js`の版の一致 |
| `test/admin-live-pin.test.mjs` `T46-FIXTURE the fixture has the required shapes, counts and cases` | fixtureに全体データの変種`sites`を足した（top-levelのkey一覧に`sites`） | scenario名14件、4通りの形、日付3通り、料金の混在、フライヤー、130字・100字、`live.ticketLink`、#41の項目 |
| `test/support/admin-app-harness.mjs` | 追加だけ: `wide`（`matchMedia`）・`setWide`・`adminSource`（基準のapp.jsで比べる）・`removeAttribute`・`hasAttribute`・静的要素`app`・`live-reservations-panel`・公開する関数 | 切り出した動き |

### 5.5 Packet 04（見た目の修理）の更新

| 試験名 | 変えた理由 | 変えていない動きのassert |
|---|---|---|
| `test/admin-live-operations.test.mjs` `responsive Live workspace fixes overflow, focus, sticky actions, and action hierarchy deterministically` | 「+ 新しいライブ」をPrimaryにして切り替えの隣へ移した（Figma `44:492`。F5）ため、ボタンのclass名の検査を`add-btn live-primary-action`から`btn btn-primary live-primary-action live-add-button`へ | `onclick="addLive()"`、`style.css`・`app.js`の`?v=`、幅900pxのgrid、固定の保存の帯、タブの44px・フォーカス、`overflow-wrap`、`safe-area-inset-bottom`、`prefers-reduced-motion` |
| `test/admin-live-style.test.mjs` `T46-STYLE at 900px and above the fields are 2 and 3 columns, one column less between 900px and 1179px` | 幅900px以上の告知の列を、等分から「左1fr・右420px」へ（Figma `47:742`の幅420固定の投稿の列。F6） | 日付・会場・補足・共演者の2列、OPEN・START・料金の3列、幅900〜1179pxで列を1つ減らすこと、幅1179px以下で告知が縦に積まれること、markupがgridの置き場のclassを持つこと |

`test/admin-live-pin.test.mjs`（T46-PIN）は無変更。

### 5.6 Packet 05（2回目の撮影の後の修理）の更新

既存の試験は変えていない（足しただけ）。`test/admin-live-style.test.mjs`に7件（T46-OVERLAP 3件・T46-MANUAL 1件・T46-STYLE 3件。サイト 964 → 971）。T46-PIN（`test/admin-live-pin.test.mjs`）・保護試験3ファイル・既存のT46-STYLEは無変更で通る。fixtureに`xComment`を足す案はT46-FIXTUREの形の固定が落ちたので戻した（fixtureは無変更。§10.3のH9）。

### 5.7 Packet 06（独立reviewの後の修理）の更新

既存の試験の期待値（assert）は変えていない。外枠の接続の表示の文言を見ている既存の試験（`admin-live-operations.test.mjs`の`/読み取り専用/`・`/Local Mode/`、`admin-live-style.test.mjs`のheader保存の試験）は、新しい表示でもそのまま通る（更新が要らなかった）。足したのは`test/admin-live-review-fixes.test.mjs`（18件）と、`test/support/admin-app-harness.mjs`の2つのoption（追加だけ）。

| 変更 | 内容 | 変えていない動き |
|---|---|---|
| `test/support/admin-app-harness.mjs` | `loadAdminApp`に`buildId`（`window.ADMIN_BUILD_ID`の値。既定は空のまま）と`promptValue`（`window.prompt`の返す値。既定は空のまま）を追加 | 既定の動きは同じ。他の試験は無変更で通る |

## 6. AC46-01〜14の証拠（Packet 03時点の表。最終は §11.7）

「結果」は自動の試験・検査まで。撮影・目視・実機・本番の読み取りは未実施で、AC単位で`visual_acceptance_pending`（Frontが撮影・目視、Itsukiが触って確認）。

| AC | 自動で確かめたこと（このPacketまで） | まだ確かめていないこと |
|---|---|---|
| AC46-01 | T46-OPEN（上の帯1行・切り替え3つ・入力欄がフライヤーの次）。撮影scriptが幅390×844・390×667で全体が画面に入る入力欄を数える（`open-public-saved-390x844.png`・`x667.png`） | 撮影の実行と実測（Front） |
| AC46-02 | T46-NEW（押下の列が3つ・間に確認の面なし）。撮影scriptが押したボタンの列と確認の面の有無を検査（`new-edit-unsaved-*`・`postsave-announce-*`） | 撮影の実行（Front） |
| AC46-03 | T46-LIST（予約の数・未対応・読み込み中・404/401/500・形の不正・通信・API接続失敗・Local Mode）、T46-SUM（Worker）、T46-PIN（台帳の合計と同じ値） | 撮影、本番の件数の桁（merge後にItsuki） |
| AC46-04 | T46-OPEN・T46-STYLE（`white-space: nowrap`）。撮影scriptが文字nodeの行で1行を検査（幅390・360） | 撮影の実行（Front）。font取得を遮断するので代替fontでの実測 |
| AC46-05 | T46-FIELDS（対応表の全項目・`id`・`name`・保存の動き）、T46-PIN | — |
| AC46-07 | T46-GUARD、T46-SAVE、T46-DELETE、`beforeunload`（T46-MODEの「global tabでも確認が出る」を含む） | iOSのSafariでの`beforeunload`（既知の制限） |
| AC46-08 | T46-PIN、T46-SCOPE（他のタブの未保存を送らない・`live.ticketLink`・#41の3項目・`site.heroImage`を落とさない） | — |
| AC46-09 | T46-LIST（集計の404・401・500）、T46-SUM（既存の経路が不変）。撮影scenario `summary-404`/`401`/`500` | Worker deploy後の読み取りの確認（Front） |
| AC46-10 | T46-COMPAT（`live-operations.js`のbytes、他のタブの描画・modal・header保存のPUT本文を基準commitと比較）、T46-STYLE（Live以外のまとまりのbytesが基準と同じ）、全試験 | — |
| AC46-11 | T46-SAVE・TICKET・MODE・LIST・RESERVE・AUTHの各状態。撮影scriptが状態別の画像と文言を検査 | 撮影の実行（Front） |
| AC46-12 | AC46-01〜05・07・08の上記 | 同上 |
| AC46-13 | T46-PIN（既存の下書き・告知・状態・共有用のアドレスの試験は無変更で通る） | — |
| AC46-14 | T46-FIXTURE、T46-PIN。fixtureの4通りの形・全scenarioを撮影scriptが描画 | 撮影の実行（Front）、本番の見え方（merge後にItsuki） |

## 7. 撮影・手元配信の材料（Frontが実行）

execution target（worktreeのroot）で:

- 全scenarioの撮影（1行）: `/usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/capture-admin-live.py`（Playwright 1.58.0。`--only <部分文字列>`で撮り直し、`--chromium <path>`で既存のChromium、`--self-check`でブラウザなしの契約検査）。画像は`verification/screenshots/`、実測は`capture-admin-live-metrics.json`、logは`capture-admin-live.log`。不合格があっても最後まで撮り、末尾でまとめてexit 1。
- 手元配信（1行）: `/usr/bin/python3 aidlc-docs/construction/aidlc-integration/verification/fake_admin_server.py --port 8080` → PCで`http://127.0.0.1:8080/admin/`（本物の合言葉を入力しない。入力の窓は出ない）。
- 撮影: 150画像 = 16画面（P46-01〜16）× 幅（390・360・821・900・1011・1440。2列以上になる画面はすべて）× 状態。画像名は`{画面}-{状態}-{幅}.png`（390×844・390×667の2枚だけ`-390x844`・`-390x667`）。fixtureの14のscenarioをすべて使う。架空のAPIが応える経路・検査の内容は`fake_admin_api.py`・`capture-admin-live.py`の冒頭。
- Packet 04で撮影scriptを直した（§9）: 架空の画像で応えるhostに`img.youtube.com`を足した、新しいライブの確認画面の待ち条件を`#live-draft-notice`へ、測る箱の一覧と合否の誤りを直した、重なって押せない時に記録して先へ進む、編集面からのはみ出し・入力欄の間の空き・一覧の切り替えの2等分の検査を足した、測る前にいつも先頭へスクロールする（押す間にページが送られると、画像の途中に上の帯がstickyで写っていた）。画像・metrics・Frontの初回のlogは書き換えていない。
- Workerが確かめた範囲: 3つのscriptの構文（`/usr/bin/python3 -B -c 'import ast…'`）、`--self-check`（画像名の重複なし・画面とscenarioの網羅・fixtureが架空・合否の関数が測っていない値でも落ちない）、`fake_admin_api.py`の全scenarioの応答と、手元配信向けの`strict`が401・403・404・5xxを返さないこと、`fake_admin_server.py`の配信の許可（`.git`・`admin/config.js`・`admin/data`は配らない）、`admin/config.js`を読まないこと。**実行していない**: ブラウザでの撮影、手元配信のbind、画面の目視、実機。

## 8. 未確認

最終の状態は §11.9。この節は、前のPacketまでに分かっていた未確認のうち、今も残るもの。

- 実機（iOSのSafariの`beforeunload`・キーボード・固定の保存の帯・安全領域）。確認の面の`inert`の実機での挙動。
- 本番の予約の件数の桁での一覧の見え方（個人情報のため取得していない。merge後にItsuki）。1ライブ200件超の予約で集計と台帳の合計に差が出うる（既知の制限）。
- Workerのdeploy前後の読み取りの確認（Front）、Itsukiが触る確認。
- 撮影のfontは取得を遮断するので代替fontでの実測（文字の最終確認は別）。
- 新しいライブの`edit`の間は切り替えが隠れるため、「保存すると使えます。」は画面に届かない（独立reviewのRV46-02。採った側と理由は §4の10）。

## 9. Packet 04 — Frontの初回撮影（150枚）で見つけた不具合と、見た目の修理

### 9.1 事実（Frontの初回撮影）

- 2026-11-21にFrontが`capture-admin-live.py`を1回実行した。150枚すべて撮れ、本番へ届いたrequestは0件。自動の合否は**150枚とも不合格**だった（logは`_scratch`の`capture-front-1.log`）。Frontが`open-public-saved-390`・`list-upcoming-reserved-390`・`open-public-saved-1440`を原寸で見て、実装の見た目の不具合を画像で確認した。
- 前のPacketはlocalhostをbindできず、ブラウザで見た目を確かめないまま、CSSとmarkupを書いた（試験はDOMの構造とCSSの文字列だけ）。このPacketは、Frontが撮った画像（原寸のPNG）をReadで開き、Figma v2（無い所はv1）のrenderと見比べて直した。**撮り直しはしていない**（localhostをbindできない）。直した後の見え方は、CSSとmarkupの読みと、撮った画像からの推定で確かめたもの。

### 9.2 食い違いの原因と直した所

最大の原因は1つ: **Liveの単一classのルールが、ファイルの後ろにある共有のclass（`.image-upload-area`・`.image-preview-container`・`.image-actions`・`.btn-image-select`・`.form-group label`・`.text-input`・`.btn`など）と同じ特異度で、順序に負けていた**。このため、フライヤー・入力欄・ボタンのLive用の指定が効いていなかった。直し方は、`.live-workspace`を頭に付けて特異度で勝たせること（共有のまとまりは変えていない。T46-STYLEの「Live以外のまとまりのbytesが基準と同じ」を保つ）。

| # | 見えた食い違い | 原因 | 直した所（`admin/`） | 足した試験・検査 |
|---|---|---|---|---|
| F1 | フライヤーの枠が幅いっぱい（幅390で282）、「画像を変える」「画像を外す」が右に切れる | 上の最大の原因（`.live-flyer-row`・`.live-flyer-preview`・`.live-flyer-actions`・`.btn-image-select`が共有のclassに負けていた） | `style.css`: `.live-workspace .live-flyer-row`（点線の灰色の枠なし）・`.live-flyer-preview`（96×136、縮まない）・`.live-flyer-actions`（行・折り返し可・縮める）・「画像を変える」（白・線1px・高さ48）・「画像を外す」 | T46-STYLE（特異度の対12組・フライヤー）。撮影script: 編集面からのはみ出し・「画像を変える」「画像を外す」の右端 |
| F2 | 黒い丸い要素が、料金の欄（幅390）・ライブ名の見出しの横（幅1440）に出る | **アプリの不具合ではない**。共有の空の`.toast`（`position: fixed`、`translateY(100px)`で画面の外に隠れている）が、全体を撮る時に画像が伸びて見えてしまう撮影の副作用。位置が画面の幅の中央で、見えるたびに違う要素に重なることと一致する | アプリは変えていない（共有の部品）。撮影script: 撮影の間だけ`.toast:not(.show)`を隠す | 撮影script: 自己検査（隠す対象を限る） |
| F3 | 日付・会場の下に大きな空き。390×667で全体が入る入力欄が2つ | 共有の`.form-error`の`min-height: 1.6em`と`margin-bottom: 8px`が、空の注記・警告でも高さを取っていた | `style.css`: `.live-workspace .form-error`（高さ0）、空なら`display: none`（`.form-warning`・`.live-draft-notice`も）。入力欄の間はgap 16 | T46-STYLE（空の注記が高さを取らない。`:empty`が効くよう空の要素に空白がないこと）。撮影script: 入力欄の間が44px前後、注記の高さ |
| F4 | 幅900px以上で「開催予定／公演終了」が38.5px、「Ticket Page共通設定」が37px | 44pxの指定が幅899px以下だけだった | `style.css`: `.live-list-tab`・`.live-workspace-utility`・`.live-workspace-tab`の`min-height: 44px`を全幅に | T46-STYLE（全幅で44px） |
| F5 | 幅390の一覧がFigma `44:492`と違う | 「+ 新しいライブ」が見出しの横の点線の小さいボタン。切り替えが2等分でない。一覧がworkspaceの入れ子の枠の中 | `index.html`: 「+ 新しいライブ」を切り替えの隣（`.live-workspace-bar`）へ移し、Primaryにした。開催予定／公演終了の切り替えを一覧の列の先頭へ。「Live」見出しは見た目だけ隠した（読み上げには残す。R46-01が「Live見出し」を隠す対象に挙げているため要素は残す）。`style.css`: 切り替えは2等分（白・角丸12・padding 4）、「+ 新しいライブ」は幅いっぱい、開催予定／公演終了は文字の行、workspaceは枠なし、本文のpaddingは20/16（幅390で358）。`app.js`: 予約管理では「+ 新しいライブ」を隠す（Figma `44:811`・`47:926`）。外枠（「1212 Admin」・接続の帯・6タブ）は#47の範囲なので変えていない | T46-STYLE（幅390の一覧）・T46-LIST（予約管理で隠れる）。撮影script: 切り替えの2等分・ボタンの幅と位置 |
| F6 | 幅900px以上: 区分が白い面でない、折りたたみに色がない、フライヤーが広がる | 同上の最大の原因と、幅900px以上のルールが無かった | `style.css`: 左の一覧を1枚の白いカード（切り替えの行・行・共通設定の入口）、開いているライブの行は`accent-soft`の塗りで›なし、公演の中の切り替えは文字幅・左寄せ・下線は`color/text`、区分は灰色の面で「区分」の隣・「このライブを削除」は行の右端、折りたたみは`gray-100`、告知の投稿は幅420の列、「Xで告知する」とコピー2つは文字幅、予約の「対応済みにする」は文字、幅1180px以上は合計の右に絞り込みと「+ 取り置きを追加」 | T46-STYLE（幅900px以上）。既存のT46-STYLE 1件を意図して更新（§5.5） |
| F6b | 幅900〜1179で「日付と会場が2列でない／2列のまま」の2件 | **撮影scriptの期待の誤り**。計画 §2は「幅1179px以下で列を1つ減らす」（日付と会場は1列）なのに、scriptは幅900以上で2列を要求し、もう1件は条件が逆だった | 撮影script: 幅1180以上は2列、幅900〜1179は縦に積まれていること | 撮影scriptの合否（基準は計画 §2に合わせた。緩めていない） |
| F7a | 「画像が読めなくても枠が崩れない」 | F1と同じ原因（枠の幅が96でない） | F1で直る | F1と同じ |
| F7b | 幅900px以上: 未保存の間は押せる「保存して公開」 | 実装でなく**測り方**。buttonの`transition: all 0.3s`の途中の`opacity`を測っていた疑い（reduced-motionでも1フレーム残る）。実装は未保存で有効化する（T46-STYLE・T46-SAVEが検査済み） | 撮影script: 撮影の間だけtransitionを切り、2フレーム待ってから測る | 撮影script。**確かめられていない**: 実際にこれが原因かは撮り直しで確認（§9.4） |
| F7c | 「予約先・リンクなど」が開いて予約URLが出る／「元情報から作り直す」が開いて元情報と「下書きを作る」が出る | **撮影scriptの誤り**。測る箱の一覧（BOX_SELECTORS）に`#edit-ticketUrl`・`#live-links-details`・`#edit-sourceText`が無く、画像では開いているのに「出ていない」と判定されていた | 撮影script: 箱の一覧に足した | 撮影script |
| F7d | 「API接続失敗は読み取り専用（headerの保存が出て押せない）」（幅390） | **撮影scriptの期待の誤り**。幅899px以下でライブを開いている間はheaderごと退く設計（R46-01）なので、画面に出ない。表示は幅900px以上だけで確かめる | 撮影script: 文言と無効はいつでも検査し、「出ている」は幅900px以上だけ | 撮影script |
| F8 | 「想定外のhostへのrequest」138枚 | YouTubeタブの見本のthumbnail（`img.youtube.com`）へのrequestをscriptが数えていた（abort済み。本番のAPI・予約・AI providerではない） | 撮影script: `img.youtube.com`を架空の画像で応えるhostに足した。本番の判定（`.workers.dev`・`openai.com`など）と、本番へ届くrequestが0件であることは緩めていない | 撮影scriptの自己検査（`img.youtube.com`は架空の画像、`www.youtube.com`は想定外、`x.com`は本番） |
| F9a | 新しいライブの確認画面（new-edit）・保存のあと（postsave）の撮影が`wait_for_function`で時間切れ（12枚） | **実装の不具合**。「下書きを作る」が成功すると元情報の画面が隠れ、その中にある成功の知らせ（「OpenAIで整理しました。内容を確認してから更新してください。」。Figma `44:546`の白い面）が画面から見えなくなっていた（scriptは見える文字だけを読むので時間切れになった） | `app.js`: 確認の画面の先頭に`#live-draft-notice`（新しいライブだけ）を足し、成功の時に同じ文を出す。`style.css`: 白い面・空なら出さない。元情報の画面の`#live-source-warnings`と文言は変えていない | T46-DRAFT（確認の画面に同じ文が出る・失敗の時は出ない・既存のライブには無い）。撮影script: 待つ条件と検査を`#live-draft-notice`へ |
| F9b | 予約の幅900・1011の撮影が例外（`waiting 500ms`） | **原因は特定できていない**（画像は、タブを押そうとして画面が下へ送られた状態）。幅900〜1179だけで起き、1440・821・390では起きない | 撮影script: 押せない時は5秒で諦め、重なっている要素を記録して不合格にし、`click()`の呼び出しで先へ進む。原因の手がかりが次の撮影のlogに出る | 撮影script。**確かめられていない**（§9.4） |

### 9.3 V1で見つけた、Frontの所見に無い食い違い

| # | 食い違い（見た画像 → Figma） | 直した所 |
|---|---|---|
| A1 | 幅390でライブを開いている間、上の帯・切り替え・入力欄が左右20pxずつ内側に寄り、ページの背景が薄い桃色のグラデーション（`open-public-*`・`announce-*`・`reservation-*`・`ticket-settings-*`）。Figmaは全幅の白い帯と灰色（`gray-100`）の面 | `style.css`: 開いている間は`#live-tab`のpaddingを0、`body`を`gray-100`に（幅899px以下だけ） |
| A2 | ラベルが太字0.9em、入力欄の線が2px、日付・時刻・複数行の文字が等幅の小さい文字（Figmaはラベル14・字間4%、線1px `gray-300`、padding 12/16、本文16） | `style.css`: `.live-workspace`の中の`.form-group label`・`.text-input`・`.textarea`・`.select` |
| A3 | 複数行の欄が高さ約100（Figmaは64） | `style.css`: `min-height: 64px`、内容に合わせて伸びる（`field-sizing: content`。非対応のブラウザは`rows="2"`）。`app.js`: 補足・共演者・ひとこと・内部メモを`rows="2"`に |
| A4 | Secondaryのボタンが灰色の塗り（Figmaは白・線1px `color/text`・高さ48）、ボタンの文字が太字 | `style.css`: `.live-workspace .btn`・`.btn-secondary` |
| A5 | 告知: 投稿の内容が点線の入力欄、「投稿の内容」の見出しが見える（Figmaは白いカードで見出しなし。幅900px以上は`gray-100`の幅420の列） | `style.css`: 白いカード、見出しは見た目だけ隠す（読み上げには残す） |
| A6 | 取り置きの追加で入力欄の間に余白がない。予約1件でボタンの上に余分な空き（空の`.form-error`の高さ） | `style.css`: 列にしてgap 16、F3と同じ直し |
| A7 | 新しいライブの元情報が、余白のない灰色のカードの中でラベルが縁に触れている | `style.css`: カードをやめ、欄そのものにした（高さ204） |
| A8 | 公演の中の切り替えの下線が赤（Figmaは`color/text`） | `style.css` |
| A9 | 予約の絞り込みの札が灰色の丸（Figmaは文字。選ばれた札だけ`color/text`の塗り） | `style.css` |
| A11 | 保存・削除に失敗した時の理由の1行が、編集面のいちばん下（削除の文字の下）にあり、先頭にスクロールしていると見えない（Figma `195:749`は保存して公開の帯の中のボタンの上） | `style.css`: 幅899px以下は、理由の行を`position: sticky`で画面の下端（帯が出ている時は帯の上。`:has()`）に留める。帯が出ない削除の失敗でも下端に出る。`:has()`に非対応のブラウザでは帯の後ろに隠れうる |
| A12 | 幅900px以上の新しいライブの元情報で「下書きを作る」が幅いっぱい（Figma `47:873`は文字幅で、右に「手入力で作る」） | `style.css`: 幅900px以上は操作を横並び |
| A10 | 合計「5枚」の大きさ（Figmaは「枚」まで見出しの大きさ）、Ticket Page共通設定の見出しが16（Figmaは20）、予約管理・共通設定が枠の中（Figmaは枠なし）、workspaceが白い枠の入れ子 | `style.css` |

### 9.4 直さなかった所と、撮り直しで見る点（Workerが確かめられなかった）

直さなかった所（理由つき）:
- 幅1440の編集の見出しの状態の文字の「開催予定・」（Figma `47:627`）: 保存の状態の4つの文言（R46-04・要件メモ）を優先して「保存済み」だけ（§4の3）。
- 外枠（「1212 Admin」・接続の帯・6タブ）と、幅900px以上のページの背景のグラデーション: #47の範囲。カードの白が背景に溶けないよう、幅900px以上のカードには薄い線（`gray-200`）を残した（Figmaは線なし）。
- ライブを開いた時の最初の入力の位置（`#edit-date`にフォーカス。赤い枠が見える）: 既存の動き（キーボード・読み上げのための初期フォーカス）で、見た目のためには変えない。Figmaにはフォーカスの絵がない。
- 幅900px以上の予約の表・予約管理の表の細部（見出しの行の色・列の幅の微調整）: 画像で大きな食い違いは見えなかったので手を入れていない。
- 幅899px以下の読み取り専用: ライブを開いている間はheader・接続の帯が退くので、読み取り専用であることが画面に出ない（設計どおり。操作は無効）。

Frontの撮り直しで見る点: ①F1のフライヤー（幅390・360・1440で枠の中に収まり、幅360で「画像を外す」が折り返すか）、②F2の黒い丸が画像から消えたか、③390×667で全体が入る入力欄が3つ以上か、④幅390の一覧の並び（Figma `44:492`）、⑤幅900px以上の一覧のカード・区分の行・告知の幅420・幅1180px以上の予約の上の行（絶対配置の「+ 取り置きを追加」と絞り込みが重ならないか）、⑥新しいライブの確認画面に成功の知らせの白い面が出るか、⑦予約の幅900・1011の例外の原因（logの「押せない」）、⑧幅900px以上の未保存の「保存して公開」の測定が通るか、⑨`field-sizing: content`の複数行の欄が実際のブラウザで伸びるか、⑩日付・会場の下の空きが消えたか、⑪撮影のscriptが新しく足した検査（はみ出し・間の空き・切り替えの2等分）に誤検知がないか。

## 10. Packet 05 — Frontの2回目の撮影（150枚）の不合格7枚と、全画像の目視で見つけた食い違いの修理

### 10.1 事実（Frontの2回目の撮影）

- 2026-11-21にFrontがPacket 04の修理の後に`capture-admin-live.py`を撮り直した（`capture-front-2.log`）。150枚すべて撮れ、本番へ届いたrequestは0件。自動の合否は**143枚が合格・7枚が不合格**。7枚の内訳: ①幅1440で、見えない下の帯`#live-editor-footer`が「このライブを削除」と「+ 取り置きを追加」の上に重なり押せない（5枚: `dialog-delete-none/reserved/unknown-1440`・`manual-add-initial/failed-1440`）。②取り置きの入力の誤り`manual-add-invalid`（幅390・1440）が`wait_for_function`で時間切れ（2枚）。Frontは`open-public-saved-390`・`list-upcoming-reserved-390`・`open-public-unsaved-1440`の3枚を原寸で見て、Figmaと同じ並びを確認した。
- このPacketも撮り直しをしていない（localhostをbindできない）。WorkerがReadで開いた原寸の画像（150枚中147枚）と、Figma v2（無い所はv1）のrender・Requirements・設計書§10.2を見比べた。見ていない3枚（`new-edit-unsaved-360`・`manual-add-invalid-1440`・`ticket-settings-saved-821`。同じ画面・状態の別の幅を見た）は`worker-05-result.md`の末尾に名前で書いた。**直した後の見え方は、CSSとmarkupの読みと、撮った画像からの推定**。

### 10.2 Frontが見つけた2つの不具合

| # | 見えたこと | 原因 | 直した所 | 足した試験・検査 |
|---|---|---|---|---|
| G1 | 幅1440で下の帯が削除・取り置きの上に重なって押せない | **実装の不具合**。幅900px以上では「保存して公開」の箱（`.live-editor-footer`）を見出しの右へ`position: absolute; top: 18px; right: 24px`で持ち上げているが、幅899px以下の固定の帯の基本ルールの`bottom: 0`が残っていた。`top`と`bottom`が両方あるので、箱が見出しから編集面の下端まで伸び、幅が「保存して公開」の幅の透明な柱が右端の全高を覆っていた（削除の文字・取り置きの追加・右端の欄が押せなかった）。`ticket-settings-actions`は基本ルールに`bottom`が無く、影響なし | `style.css`（幅900px以上）: `bottom: auto`を足し、`.live-workspace .live-editor-footer`・`.live-workspace .ticket-settings-actions`で`bottom: auto; padding: 0`（後ろの安全領域の`padding-bottom`に特異度で勝つ）。`[hidden]`なら`display: none`（`display: block`が`hidden`に勝って、画面によらず箱が残っていた）。幅899px以下の固定の帯（`sticky; bottom: 0`）は変えていない | T46-OVERLAP 2件（CSS: 「幅900px以上で`position: absolute`+`top`の箱は、同じ幅で効く`bottom`を必ず`auto`に戻す」を全selectorに対して検査。アプリ: 幅900px以上は見出しの「保存して公開」・幅899px以下は未保存の時だけ）。撮影script: **全操作の中心の点で一番上の要素がその操作自身か**を測る`covered`検査（各操作を画面の中央へ寄せて`elementFromPoint`。ダイアログ中は測らない）と、`--self-check`での不合格の確認 |
| G2 | 取り置きの入力の誤り`manual-add-invalid`の撮影が時間切れ | **実装の不具合**（scriptの条件は正しかった。待っていたのは`#manual-reservation-error`の「お名前と1〜10の枚数を確認してください。」で、実装がその文を出す場所と同じ）。`manual-add-invalid-390`の画像には、アプリの文でなくブラウザ標準の英語の吹き出し（「Please fill out this field.」）が写っていた。`<form>`が`required`の入力を持つのに`novalidate`が無く、お名前が空の「追加する」はブラウザ標準の検証が止めて`submit`が起きず、アプリの文言も出なかった（実際の操作でも、日本語の1行でなくブラウザ標準の吹き出しが出ていた）。空白だけの名前の時だけアプリの文が出る状態だった | `app.js`: `<form id="manual-reservation-form" … novalidate hidden>`（`required`・`min`・`max`は入力に残す）。検査の文言・条件・送る内容は変えていない | T46-MANUAL（markupの`novalidate`と入力の属性。空白の名前で文言）。T46-PINは無変更で通る |

### 10.3 全画像の目視で見つけた食い違い（Frontの所見に無い）

| # | 見えた食い違い（画像 → 基準） | 直した所（`admin/style.css`。幅900px以上は`min-width: 900px`の中） | 足した試験・検査 |
|---|---|---|---|
| H1 | 幅1440で保存・削除に失敗した時の理由の1行（`#live-editor-save-error`）の下半分が、上へ24px引き上げた公演の中の切り替えに隠れて切れる（`open-public-save-failed-1440`） | 理由の行の`margin-bottom`を16pxから40px（引き上げる24px＋空き16px）に | T46-OVERLAP（タブの引き上げ量＋16px以上） |
| H2 | 幅1440で新しいライブの知らせ（`new-edit-*-1440`）と保存直後の投稿（`postsave-announce-1440`）の白い面が白い編集面に溶けて枠が見えず、文字だけが16px内側に寄る。保存直後の「Xで告知する」が編集面の幅いっぱい | 幅900px以上は2つの面を`gray-100`の塗りに。保存直後のボタンは文字幅（告知の画面と同じ） | T46-STYLE |
| H3 | 幅900pxの予約（ライブごと）の表が潰れ、名前・連絡先の列が0幅で**行に名前が出ない**（`reservation-normal-900`）。幅1011でも名前・連絡先が「架空 …」「jiro@…」に切られる。編集面が440〜600pxで6列は入らない | 幅900〜1179pxは、ライブごとの予約だけ2行の形（名前と枚数・受付・状態の札、右に「対応済みにする」）を残し、表は幅1180px以上から（予約管理の表は全幅で見えているので変えない） | T46-STYLE（範囲・scope）。撮影script: 幅1180px以上は表、幅900〜1179pxは表の列なし・行の名前の欄が120px以上 |
| H4 | 幅900px以上の行の「対応済みにする」の文字が行の上寄せ（他の列は中央。`reservation-normal-1440`・`tickets-normal-1440`） | `.reservation-row-action`に`align-items: center` | T46-STYLE |
| H5 | 幅1440で、選ばれていない絞り込みの札が文字だけ（Figma `47:757`・`195:761`は`gray-100`の丸。幅390は文字だけで`44:704`のとおり） | 幅900px以上は選ばれていない札に`gray-100` | T46-STYLE |
| H6 | 幅1440の取り置きの追加で「お名前」のラベルが幅320の面の上端に触れる（上のpaddingが幅390用のルールで0になっていた） | 幅900px以上で`padding-top: 16px` | T46-STYLE |
| H7 | 幅900px以上の予約管理で、開いた予約の面が二重の枠（外の面の中にもう1つ枠） | `.tickets-detail-view .live-reservation-detail`の`padding`・`border`を0 | T46-STYLE |
| H8 | 幅900px以上の予約管理で「CSVで書き出す」が左下の文字（Figma `47:926`は絞り込みの右の枠のボタン） | 幅900px以上は絞り込みの右・選択の下端に合わせた枠のボタン。予約を1件開いている間（絞り込みの幅だけになる）は表の下に | T46-STYLE |
| H9 | **撮影の状態の誤り**: `announce-comment-filled`（幅390・1440）が、ひとことが空の画像だった（fixtureの`fx-live-long`に`xComment`が無い。`comment-empty`と同じ状態） | 撮影script: `data_patch='comment-filled'`で`fx-live-long`に架空の「架空のひとこと」を足し、ひとこと欄と投稿の内容にその文が入っていることを検査する。fixtureは変えない（試した結果、T46-FIXTUREの形の固定が落ちたので戻した） | 撮影scriptの合否（検査を足した）。`--self-check` |
| H10 | `reservation-detail-status-failed-1440`の画像に、状態の変更の失敗の理由の行が写っていない（metricsは「出ている」。測ってから撮るまでの間に消えたように見える。幅390では写っている） | **原因は特定できていない**（アプリは失敗の時に理由の行を残す。T46-RESERVEが検査済み）。撮影script: 撮った後にもう一度理由の行を読み、消えていれば不合格にして手がかりを残す | 撮影script |

### 10.4 直さなかった所（理由つき）

- 幅390のLocal Modeのheaderで「JSONを書き出す」が2行に折れる・版の文字が折れる: 外枠（header）は全タブ共通で#47の範囲。他のタブの見た目を変えないため触らない。
- 予約の表の行の右の「ひらく」と、予約管理の表の「ライブ」の列（Figma `47:757`・`47:926`）: Requirements R46-14（表の列は名前・枚数・連絡先・受付・状態・操作）と設計書§10.2（画面に出す文言はこの表だけ）に無いので足さない（Requirements→設計書→Figmaの順）。
- 新しいライブの元情報の注記「…そのまま貼り付け」が幅390で途中で折れる、補足の注記「1補足1行…」の文言: 既存の注記の文言で、文言は変えない。
- 画像が読めない一覧の行のサムネイルが消えて文字が左へ寄る: 既存の動き（`onerror`で隠す）。
- 全体の撮影に写る帯・toast（幅390の途中に固定の「保存して公開」の帯、実際のtoastが帯に重なる）: 画像が画面より長い時の固定・stickyの写り方と、共有のtoastの本来の動き（数秒で消える）。実機の画面では起きない。
- 予約管理の1件の「‹ 予約管理」が中央、選択の矢印がブラウザ標準、予約の表の見出しの行に色が無い、保存中の「‹ 一覧」の薄い面: Figmaにその画面・部品の絵が無いか、数pxの見た目の差で、読みやすさ・押しやすさに影響しない。
- Figmaの外枠・ページの背景のグラデーション（#47）、幅899px以下の読み取り専用で上の帯が退く（R46-01）は、Packet 04のまま（§9.4）。

### 10.5 撮影script（Frontの次の撮影の前に確認）の変更

- `capture-admin-live.py`だけ（`fake_admin_api.py`・`fake_admin_server.py`は無変更）。足した検査: 操作が別の要素に覆われていないか（`covered`）、幅900〜1179pxの予約の行の名前の欄、`comment-filled`の中身、`status-failed`の理由の行が撮影の後も残るか。
- 合否の基準を変えた所: 幅900〜1179pxの予約の「表の6列」を要求しない（実装を2行の形にしたため。名前の欄の幅は120px以上を新しく要求）。予約管理の表は全幅で要求のまま。それ以外は緩めていない（本番へ届くrequestが0件の検査・本番hostの判定・横スクロール・44px・表示名・ADM-46-01・04は同じ）。
- `--self-check`: 契約OK（150画像／16画面／14scenario）。覆われた操作・潰れた行が不合格になることを足して確認した。構文: 成功。

### 10.6 撮り直しで見る点（Packet 05）

①幅1440で`dialog-delete-*`・`manual-add-initial/failed`・`manual-add-invalid`が撮れ、`covered`検査に不合格が出ない（幅900・1011でも）。②`manual-add-invalid`で日本語の1行が出る。③`open-public-save-failed-1440`で理由の行が切れていない。④`reservation-normal-900`・`-1011`で行に名前が読める幅で出る。⑤`reservation-detail-status-failed-1440`の画像に理由の行が写るか（写らなければlogの「撮影の間に…消えた」）。⑥`announce-comment-filled`にひとことが入る。⑦幅1440の予約管理のCSVの枠のボタンと絞り込みの重なり、開いた予約の単一の枠。⑧`covered`検査の誤検知（固定の帯・toastを除いた画面で不合格が出ないか）。

## 11. 最終の状態（Frontの6回の撮影・独立review・Packet 06の修理の後）

### 11.1 Frontの6回の撮影の経過と最終の結果

すべて同じscript・headless Chromiumだけ（`ui_route=headless_acceptance:AC46-01,AC46-04,AC46-11,AC46-14`。1回ごとに宣言し、in-app Browser・Computer Useには切り替えていない）。本番のAPI・予約・AI provider・X投稿の画面へ届いたrequestは、6回とも**0件**（localhostと架空のhost以外は全件abort）。logは`_scratch`の`capture-front-*.log`。

| 回 | 時点 | 結果 | その後 |
|---|---|---|---|
| 1 | Packet 04の前 | 150枚撮れた。自動の合否は150枚が不合格（scriptの期待の誤り138枚、実装の不具合59枚ほか。§9.1） | Packet 04で修理 |
| 2 | Packet 04の後 | 143枚合格・7枚不合格（幅1440で見えない下の帯が操作を覆う5枚、取り置きの入力の誤りの時間切れ2枚。§10.1） | Packet 05で修理 |
| 3 | Packet 05の後 | 41枚不合格。40枚は、Packet 05で足した「操作が別の要素に覆われて押せない」検査の誤り（閉じた折りたたみの中の欄は描画されないのに測っていた）。1枚は`reservation-detail-status-failed-1440`（撮影の間に失敗の理由の行が消えた） | Front直接の修理2つ（§11.3） |
| 4 | 検査の修理の後 | 149枚合格・1枚不合格（上の1枚） | Front直接の修理 |
| 5 | 理由の行の修理の後 | 該当画面だけの撮り直し（`capture-front-5-only-reservation-detail.log`）。8枚すべて合格 | 最終の全画面 |
| 6 | 最終 | **150枚すべて合格**。本番へ届いたrequestは0件 | — |

この6回目の撮影は、Packet 06（外枠の接続の表示の変更・撮影scriptの接続の検査の追加）の**前**の状態のもの。Packet 06の後の撮り直しは未実施（§11.9）。

### 11.2 Frontの目視の範囲

- スマホ幅（390・360）の73枚: 縮小の一覧（`contact-sheets/narrow-01〜05`）で全部。一覧（予約の数・未対応の札・読み込めない時の1行・空・読み取り専用・Local Mode）、開いた画面（上の帯1行・3等分の切り替え・フライヤー先頭・折りたたみ・区分・削除の文字）、新しいライブ、告知、予約（合計・札・1件・状態ごとの操作）、取り置き、予約管理、Ticket Page共通設定、確認の面で、はみ出し・重なり・切れは見当たらなかった。
- 幅821〜1440: 77枚のうち、縮小の一覧の12枚と原寸1枚。残りの枚数は、Packet 05のWorkerが原寸で見た（150枚のうち147枚。見ていない3枚の名前は`worker-05-result.md`）。独立reviewは14枚を見た（§11.4）。
- 原寸で見たのは、`open-public-saved-390`・`list-upcoming-reserved-390`・`open-public-unsaved-1440`（初回・2回目・最終で繰り返し）。
- 全体を撮った画像では、下に固定の「保存して公開」が途中に写る（撮り方によるもの。実機の画面では起きない）。

### 11.3 Frontが直接入れた変更2つ

1. `capture-admin-live.py`の覆いの検査で、閉じた`details`の中身（summaryを除く）を測らないようにした（4行）。実装は変えていない。Packet 06で、`--self-check`にこの規則の確認を足した（§11.5のD6）。
2. `admin/app.js`の`setLiveReservationView`と`syncCrossReservationView`が、同じ予約を描き直す時に、失敗の理由の行（`#reservation-detail-error`）の文を残すようにした（2か所。幅900px以上では予約を一覧の右に開いたまま、台帳の再読込や幅の切り替わりで描き直され、理由の行が空に戻っていた）。送る内容・状態・数え方は変えていない。Packet 06で、Nodeの試験を足した（§11.5のD5）。

### 11.4 独立reviewの結果

- 結果: **APPROVED**（実装・試験・画像14枚を読んだ。sandboxにBashが無く、試験の再実行・`git diff`・SHA-256の再計算はしていない）。指摘4件、すべて`blocking: false`。

| 指摘 | 内容 | 扱い |
|---|---|---|
| RV46-01（medium） | 接続の帯とHeaderの表示が要件 §6の最後の行・Figmaと違う | **直した**（Packet 06のD1）。実装を要件とFigmaに合わせた |
| RV46-02（medium→low） | 新しいライブで「保存すると使えます。」が画面に届かない（R46-02・S46-14とR46-07の食い違い） | **直さない**。R46-07とFigma `44:546`を採った。食い違いと理由を§4の10に書き、確認2で示す |
| RV46-03（low） | Ticket共通設定の保存が`ticket`を丸ごと置き換える | **直さない**。T46-PIN (h)の動き（#37で外した`introText`・`noticeText`を持ち込まない）を保つ形。既知の制限（§11.8） |
| RV46-04（low） | 開発用のAPI設定で、集計の404が基準URLの切り替えを起こしうる | **直した**（Packet 06のD4） |

Reviewerの確認の範囲外だったこと（試験の再実行・基準との差分・SHA-256の再計算・画像14枚以外）は、このPacketの全試験（§11.5）と`build-and-test-summary.md`で確かめた。

### 11.5 Packet 06の修理

**D1（RV46-01）外枠の接続の表示**（`admin/app.js`・`admin/index.html`・`admin/README.md`）
- `renderModeLabel`を新設: Headerの右の文字は、API接続中は「接続中」、API接続失敗は`API Fallback`、Local Modeは`Local Mode`。ビルド標識は`title`属性（空なら外す）。`renderModeBadge`と`applyApiFallbackReadOnlyState`が呼ぶ（読み取り専用への切り替えの後に「接続中」のままにならないため）。
- `setConnectionBanner`: API接続中（`'api'`）は帯を`hidden`にして文を空に、接続失敗・Local Modeは今の文言で出す（`hidden`を外す）。`loadData`の成功は帯を出さない。
- `admin/index.html`の起動の表示: 版を文字でなく`title`へ。読み込み失敗の帯は`hidden = false`にして出す。
- 変えていない: 「JSONを書き出す」「読み取り専用」「保存」の文言・無効・`is-live-concealed`、帯の文言（`API接続失敗（ローカルJSONを読み取り専用で表示）`・`ローカルJSONモード（従来運用）`）、Headerのmarkup・`style.css`（全タブ共通。T46-STYLEが基準のbytesと同じことを検査）、6タブの表記・並び。
- 試験: T46-HEADER 6件（接続中・接続失敗・Local Mode・版なし／復帰・他のタブが基準のcommitと同じこと・読み込み失敗の帯と起動の表示）。RED: 6件中5件が落ちた（「他のタブ…」は基準との比較で、実装の前後とも通る保護。`verification/logs/packet06-review-fixes-red.log`）。GREEN: 6件とも通る（`packet06-review-fixes-green.log`）。

**D4（RV46-04）集計の読み取りの基準の切り替え**（`admin/app.js`の`loadReservationSummary`）
- `adminFetch('/api/admin/ticket-reservation-summary', {}, { allowBaseFallback: false })`。`adminFetch`の第3引数`policy.allowBaseFallback`は既にあり、`false`なら正式なURLへの再送の候補を足さない（他に`false`を渡すのは`app.js:3839`の1か所だけ）。ほかの呼び出しは無変更。
- 試験: T46-SUMMARY-BASE 7件（404・401・403・500・通信失敗の後も、集計は1つの接続先にだけ出る・読み取り専用にならない・その後の保存（PUT）と予約の状態変更（POST）が同じ接続先へ出続ける／集計の呼び出しだけが`allowBaseFallback: false`で、ほかは既定／ほかの読み取りは今まで通り正式なURLへ再送する）。RED: 6件が落ちた（再送と接続先の書き換えが起きた）。GREEN: 7件とも通る。401・403は、合言葉の再入力の後に同じ接続先で1回やり直す（既存の動き）。

**D5 理由の行を残す修理の試験**（`admin/app.js`は変更なし。実装に穴は見つからなかった）
- T46-ERRORLINE 5件: (a) 状態の変更に失敗した後、同じ予約を描き直しても（幅の切り替え・台帳の再読込・同じ表示の呼び直し）理由の行が残る（ライブごとの予約・予約管理の1件の両方。認証失敗の行も）、(b) 別の予約を開く・一覧へ戻って開き直すと消える、(c) 状態の変更に成功すると残らない。
- 確認: 修理の2か所を外すと(a)の2件が落ち、「同じ予約か」の条件を外す（いつも残す）と(b)の2件が落ちる（試験の後に元へ戻して`cmp`で一致を確認）。通常のREDのlogは、修理が先に入っているので無い。

**D6 撮影script**（`capture-admin-live.py`。実行はFront）
- `--self-check`に、閉じた`details`の中身を覆いの検査から外す規則の確認を足した（規則が測る処理の前にあること、summaryは測ること。この規則を外すと落ちることを確認）。
- 外枠の接続の検査（`connection_findings`）: Headerが出ている画面で、API接続中は「接続中」・帯なし、API接続失敗は`API Fallback`・帯に読み取り専用の案内、Local Modeは`Local Mode`・帯に「ローカルJSONモード（従来運用）」、いつも版が文字に出ず`title`にあること。metricsに`badgeTitle`を足した。開いている間にHeaderが退く検査（`body.is-live-editing`）は変更なし。
- 予約の数の読み取り（summary-404/401/500）は、基準のAPIへ再送しない作りになったので、再送の試みを期待するscenarioから外した（試みが出たら不合格）。
- 変えていない: 本番へ届くrequestが0件の検査・本番hostの判定・44px・横スクロール・ADM-46-01・04。画像・metrics・Frontのlogは書き換えていない。

### 11.6 更新した既存試験

全Packet分の表は §5.1〜§5.7。Packet 06は期待値を変えていない（§5.7）。T46-PINは、Packet 01から無変更の部分（送る内容・検査・数え方・保存のPUT・告知文・共有用のアドレス・Ticket設定の保存の形）を含め、Packet 06でも無変更で通る。

### 11.7 AC46-01〜14の最終の証拠

「自動」は全試験（サイト989・Worker 361）まで。「撮影」はFrontの最終の撮影（150枚すべて合格。ただしPacket 06の前の状態。§11.1）。

| AC | 自動 | 撮影・目視・review | まだ |
|---|---|---|---|
| AC46-01 | T46-OPEN | 撮影の実測（390×844・390×667で全体が入る入力欄3つ以上）に合格。目視（スマホ幅73枚） | Packet 06後の撮り直し |
| AC46-02 | T46-NEW（押下の列が3つ） | 撮影・目視。独立reviewもOK | — |
| AC46-03 | T46-LIST・T46-SUM・T46-PIN | 撮影（集計の成功・失敗・読み込み中・空）に合格。reviewもOK | 本番の件数の桁（merge後） |
| AC46-04 | T46-OPEN・T46-STYLE | 撮影の実測（文字nodeの行で1行）に合格 | 代替fontでの実測。Packet 06後の撮り直し |
| AC46-05 | T46-FIELDS・T46-PIN | reviewもOK | — |
| AC46-07 | T46-GUARD・SAVE・DELETE | reviewもOK | iOSのSafariの`beforeunload` |
| AC46-08 | T46-PIN・T46-SCOPE | reviewもOK | — |
| AC46-09 | T46-LIST・T46-SUM・**T46-SUMMARY-BASE**（集計が失敗しても接続先が動かない） | reviewもOK | Worker deploy後の読み取り確認（Front） |
| AC46-10 | T46-COMPAT・T46-STYLE・**T46-HEADER**（他のタブは接続の表示だけが違う） | reviewもOK | — |
| AC46-11 | T46-SAVE・TICKET・MODE・LIST・RESERVE・AUTH・HEADER | 撮影（状態別）に合格。reviewは、S46-14「保存すると使えます。」が画面に出ない点を指摘（RV46-02） | **S46-14は出さない**（§4の10。確認2で示す） |
| AC46-12 | AC46-01〜05・07・08のとおり | 同上 | — |
| AC46-13 | T46-PIN（既存の下書き・告知・状態・共有用のアドレスは無変更で通る） | reviewもOK | — |
| AC46-14 | T46-FIXTURE・T46-PIN | 撮影（4通りの形・全scenario）に合格 | 本番の見え方（merge後にItsuki） |

### 11.8 既知の制限

- Ticket Page共通設定の保存は、`ticket`を`completeText`と`fields`の6項目だけに置き換える（重ねる形でない）。T46-PIN (h)の動き（#37で外した`introText`・`noticeText`を持ち込まない。重ねると古いキーが残る）を保つため。将来`ticket`にキーを足す時は、この保存の対象（`applyTicketSlice`）に足す（RV46-03）。
- 新しいライブの確認の画面に切り替えが無いので、「保存すると使えます。」は画面に出ない（§4の10）。
- Headerの「接続中」はFigmaの右寄せ・高さ46pxの形でなく、今のHeaderの小さい文字の場所（§4の12）。Figmaの形にするのは全タブ共通の外枠を変えるので#47の範囲。
- 1ライブ200件超の予約では、集計と台帳の合計に差が出うる。
- 幅899px以下でライブを開いている間は読み取り専用であることがHeader・帯に出ない（操作は無効）。
- 保存に失敗した時のtoastが、スマホの全体の撮影で「保存して公開」の一部に重なって写る（共有のtoastの本来の動き。数秒で消える）。
- 同じidの`reservation-detail-error`がライブごとの予約と予約管理の1件の両方のmarkupに出る作り（前からの作り。理由の行は`getElementById`で先に見つかる1つに出る。2つを同時に開く操作は見つかっていない）。

### 11.9 未実施（この文書は結果を先取りしない）

- **この後のFrontの撮り直し**: 外枠の接続の表示（Headerの「接続中」・帯）を変えたので、`capture-admin-live.py`を再実行する。ここで見る点は §11.10。
- **Itsukiが触る確認**（手元配信`fake_admin_server.py`、確認2）。
- **Workerのdeployの前後の読み取り確認**（Front。deployはItsukiの明示承認が要る）。
- **merge後の本番の確認**（Itsuki。本番の予約の件数の桁での見え方を含む）。
- 実機（iOSのSafari）の動き。
- Frontが幅821〜1440の77枚のうち縮小の一覧12枚・原寸1枚より多く見ること（目視の範囲は §11.2。残りはPacket 05のWorkerの目視と独立reviewの14枚）。

### 11.10 Frontの撮り直しで見る点（Packet 06）

①API接続中の画面（一覧・各タブ）で、Headerの右が「接続中」だけで、接続の帯が出ていない。幅390の一覧で上の段がHeader・タブの2段になる。②API接続失敗（読み取り専用）とLocal Modeで、帯が今の文言で出る。Headerの文字が`API Fallback`・`Local Mode`。③開いている間（幅899px以下）にHeaderが退く（`body.is-live-editing`）。④他のタブ（Site・News・YouTube・Disco・Profile）の外枠が、接続の表示以外は変わっていない（6タブの表記・並び）。⑤`summary-404`・`summary-401`・`summary-500`の画面で、再送の試み（本番への）が出ない（出たら新しい検査が不合格にする）。⑥撮影scriptの新しい接続の検査に誤検知がない（特に起動直後の「Loading」・「読み込み中...」の間に撮らないこと）。
