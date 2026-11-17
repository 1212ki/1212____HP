# Build/Test Result — 作品の選択・再生映像・種別（Issue #41）

保存失敗後の再試行で作品が二重登録されるRV41-01を修理し、サイト側280件・Worker側347件の全試験が成功しました。3設計書は承認済み提案版とbyte一致し、gate 1〜3の承認記録も再検査を通りました。修理後の独立再reviewと確認2のOwner承認を待ちます。

- Status: 確認2の候補
- Cycle ID: `2026-11-17_issue-41_data-fields`
- **Blocking Findings**: None
- 独立review: 1回目はREJECTED（RV41-01 blocking、RV41-02非blocking）。修理後の再reviewは未実施。Frontが手配する。以下の自己検証は再reviewの代わりではない。
- 本番での確認（計画 §8）: 未実施・Owner 操作待ち。
- Reader profile: human_reader / ja-JP / review_surface=notion_paper（投影・提示はFront） / reader_ready=true / open_status=not_opened
- 実行環境: Node `v20.19.4`。全Node commandのPATH先頭は`/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin`。dependency追加・installなし。
- ui_route: none。source・決定論的VM DOM・stub D1とworker.fetchで検証。新規capture／実UI観測なし。

以下のlogは`aidlc-docs/construction/aidlc-integration/verification/`からの相対pathです。

## 独立review後の修理と再検証

RV41-01の原因は、API失敗時に開いたままの作品モーダルが移動前のカテゴリを記憶していたことです。`saveDiscographyItem`で移動先への追加直後に`currentEditType`を同期しました。修理差分は`admin/app.js`と`test/admin-live-operations.test.mjs`、結果・検証を記録する`aidlc-docs/`です。承認済み計画・提案版・昇格先は不変です。

| command | 結果 | log |
|---|---|---|
| `node --test --test-name-pattern=RV41-01 test/admin-live-operations.test.mjs`（修理前） | tests 133 / pass 1 / fail 4 / skipped 128、exit 1。再試行3件が期待1／実際2、移動後の削除1件で作品が残る。Site保存再試行は成功。 | `repair-red.log` |
| 同command（修理後） | tests 133 / pass 5 / fail 0 / skipped 128、exit 0。REDと同じ5件を実行。 | `repair-green.log` |
| `node --test --test-name-pattern='music data fields' test/admin-live-operations.test.mjs` | tests 136 / pass 27 / fail 0 / skipped 109、exit 0。追加8件を含む。 | `repair-focused.log` |
| `node --test test/` | tests 280 / pass 280 / fail 0、exit 0 | `repair-all-site.log` |
| `npm --prefix cloudflare/worker test` | tests 347 / pass 347 / fail 0、exit 0 | `repair-all-worker.log` |
| `node --check admin/app.js`、`node --check assets/js/music-data.js`、`node --check cloudflare/worker/src/worker.js` | 3件ともexit 0 | `repair-gates.log` |
| `bash aidlc-docs/construction/aidlc-integration/verification/validate-approvals.sh` | `validate_approval` 3/3 PASS、exit 0。実scriptとの相違はvalidator配置に伴うverifyコマンド絶対pathと呼出部分だけ。 | `repair-gates.log` |
| `scripts/aidlc-cycle.sh status` | Issue #41／In Progress、exit 0。Approval GateはCode Generation Result／Pending。 | `repair-gates.log` |
| `scripts/aidlc-verify.sh --local` | exit 0。source authenticityは未検査。 | `repair-gates.log` |
| `git diff --check`、変更範囲・本番内容非混入・canonical／承認bytes照合 | PASS、最終文書も検査 | `repair-final-check.log` |
| close事前検査（更新後の文書をコピー） | `validate_close_ready` PASS、exit 0。仮承認とCompleteはコピー内だけ。 | `close-dryrun.log` |

再試行3件は、失敗後にそのまま保存／元カテゴリへ戻して保存／別項目を変えて保存し、成功後のメモリと実際に送信するPUT payloadの両方で同じidが全カテゴリで1件になることを確認しました。参照・変更した値・成功時closeも検査しています。移動後の削除も正しい所属を対象とします。

同種経路の確認として、Site／header保存はsnapshotの再送なので追加を繰り返さないこと、作品と共有映像の削除はモーダルを閉じてheaderで保存するため、失敗後の再送でも削除・参照解除を保つことを確認しました。新規作品の通信例外後のカテゴリ変更もidを保持します。これら追加3件は既存動作の確認で、REDの4失敗とは分けています。Local Modeと保存成功時の既存試験も全件成功しています。Workerの比較・補完コードに変更はありません。

## 初回実装の全試験と統合検査（修理前の履歴）

| command | Step 3の区切り | Step 7の区切り／修理後 | log |
|---|---|---|---|
| `node --test test/` | tests 245 / pass 245 / fail 0、exit 0 | tests 272 / pass 272 / fail 0、exit 0 | `step3-all-1.log` / `step7-recheck-all-1.log` |
| `npm --prefix cloudflare/worker test` | tests 344 / pass 344 / fail 0、exit 0 | tests 347 / pass 347 / fail 0、exit 0 | `step3-all-2.log` / `step7-all-2.log` |
| `node --check admin/app.js` | exit 0 | exit 0 | `step3-all-3.log` / `step7-all-3.log` |
| `node --check assets/js/music-data.js` | exit 0 | exit 0 | `step3-all-4.log` / `step7-all-4.log` |
| `node --check cloudflare/worker/src/worker.js` | exit 0 | exit 0 | `step3-all-5.log` / `step7-all-5.log` |
| `scripts/aidlc-verify.sh --local` | exit 0 | exit 0 | `step3-all-6.log` / `step7-all-6.log` |
| `scripts/aidlc-cycle.sh status` | exit 0、Issue #41、In Progress | exit 0、Issue #41、In Progress | `step3-all-7.log` / `step7-all-7.log`。最終stateは`final-gates.log`。 |
| `git diff --check` | exit 0 | exit 0 | `step3-all-8.log` / `step7-all-8.log`。最終文書も`final-gates.log`。 |
| `git status --short` | 許可範囲内 | 許可範囲内 | `step3-all-9.log` / `step7-all-9.log` / `git-status-final.log` |

Step 7の最初のサイト全試験は272件中269 pass／3 failでした（`step7-all-1.log`）。2件は計画で変更したapp cache queryに旧値／CSSとの同一値を要求する既存assert、1件は新しい映像候補のためのyoutube collectionがない画像試験fixtureでした。queryのassertをapp/helper同値・CSS旧値へ変更し、画像試験に空のyoutube collectionを補いました。既存画像assertを削っていません。修理後のadmin回帰は195件すべて成功（`node --test test/admin-image-form.test.mjs test/admin-live-operations.test.mjs`、`step7-admin-regression.log`）し、サイト全試験272件を再実行してすべて成功しました。Worker codeの修理はなく、同じStep 7の347件成功が適用されます。

local integrity検証はpinned payloadの一致を確認し、networkでのsource authenticityを主張しません。bundle／compile工程の追加はなく、既存scriptのsyntax検査と全試験をBuild/Testの根拠にしています。

## 初回実装のREDからGREENへの記録

| 段・command | RED | GREEN | log |
|---|---|---|---|
| 2: `node --test test/music-data.test.mjs` | tests 1 / pass 0 / fail 1、exit 1。未作成helperの`MODULE_NOT_FOUND`。計画指定の未実装RED。 | tests 3 / pass 3 / fail 0、exit 0 | `step2-red.log` / `step2-green.log` |
| 3: `node --test cloudflare/worker/test/music-data-fields.test.js` | tests 20 / pass 8 / fail 12、exit 1。新key既定・不正日付400・参照／旧payload保持・破損行拒否が未実装。 | tests 20 / pass 20 / fail 0、exit 0 | `step3-red.log` / `step3-green.log` |
| 4: `node --test --test-name-pattern='music data fields' test/admin-live-operations.test.mjs` | tests 121 / pass 0 / fail 12 / skipped 109、exit 1。新field・選択肢・検査・boolean／close・保持が未実装。 | tests 121 / pass 12 / fail 0 / skipped 109、exit 0 | `step4-red.log` / `step4-green.log` |
| 5: 同admin focused command | tests 125 / pass 14 / fail 2 / skipped 109、exit 1。両modeで削除直後の参照が残る。 | tests 125 / pass 16 / fail 0 / skipped 109、exit 0 | `step5-red.log` / `step5-green.log` |

Step 3の初回試験には、公開GETのpathを誤った404と、DB障害がfetchの500になる既存経路をrejectと期待した試験側不備も含まれていました。原典に合わせて`/api/public/site-data`と500応答へ修正しました。日付違反や省略key保持等の機能REDとは区別しています。最初の実装時にfieldsを別の400分岐へ入れた不備は、保存PUTの分岐へ限定して修理しました。最終GREENは全20件のHTTP応答・書込回数を観測しています。

Step 4の途中のselect本文未解析・非文字列日付の表示エラーは`step4-green-attempt1.log`に保持しました。VMのselect本文解析と日付表示だけの文字列化で修理しました。baseline成功／失敗、JSON失敗、upload／isSaving、別作品のstructured errorの追加観測は最終focused tests 128 / pass 19 / fail 0 / skipped 109（`step7-admin-edge.log`）です。Step 5のWorker再確認は20件成功（`step5-worker-green.log`）。

公開回帰は実装変更を要しないcharacterizationであり、REDとして数えていません。`node --test test/public-music-data-compatibility.test.mjs test/public-ticket-routing.test.mjs`はtests 44 / pass 44 / fail 0（`step6-public.log`）。`node --test cloudflare/worker/test/og-live.test.js`はtests 6 / pass 6 / fail 0（`step6-og.log`）。最初の公開試験はpast一覧にもdescriptionを期待しましたが、既存rendererは一覧で省略・detailで表示するため、実際のdetail表示を観測する試験へ直しました。公開codeは変えていません。

## 受入条件と試験の対応

| 受入条件 | 自動検証で確かめた内容 |
|---|---|
| AC41-01・06 | API envelopeとLocal JSON本体について、新3key欠落／空／登録ありの公開DOM・hero画像・リンク・news・Live・作品順が同一。新しい再生・種別表示は追加されない。 |
| AC41-02 | admin実操作→API PUTとreload、Local Blob JSON→reload。Worker PUT→公開GETで3key同値。新keyだけのhelper処理とWorkerの保存shapeを同じ架空fixtureで照合。 |
| AC41-03 | 旧不揃い・空・欠落・非文字列の日付の未変更保持、カテゴリ移動、header保存、失敗時baseline保持。descriptionのみLiveのGET構造とdetail表示を保持。 |
| AC41-04 | Live画像優先、なしはheroImage、heroも空なら従来のWorker既定画像。新3keyでOG HTMLが変わらない。既存canonical URL・共有URLの回帰も成功。 |
| AC41-05 / ADM-40-05の#41分 | 既存画像・Live・News・YouTube・Disco・Profile・ticket設定の回帰、既存作品field保持、read-only復元、新fieldのescapeと全カテゴリoption。CSS・tokens無変更。 |
| AC41-07 | 両modeの作品／共有映像削除、取消、未参照削除、read-only、カテゴリ移動、header永続化。API直接PUTの不正参照・移動・削除でも一致。 |
| AC41-08 | 共通helperの形・最新・安定順・候補0・明示id・非破壊。adminの不正時false／modal／ARIA／focus／固定文／入力保持／配列・hasChanges・fetch不変。API400／fields／書込0。 |
| AC41-09 | 無行の初回不正PUTでもINSERT 0、認証なし401／書込0、旧admin省略keyの保持、明示解除・削除作品の復活なし、読取・解析失敗時の書込0。 |

## 承認・canonical・範囲・close書式

gate 1〜3は原典hash・完全prompt・raw A・Approver・日時・artifact hashを照合済み。実scriptから抽出した未変更の`validate_approval`を呼び、3件PASSしました（`step1-approvals.log`、最終`final-gates.log`）。3組のcanonical／提案版は`cmp`成功、planのSHA-256と一致し、承認済み3入力のbytesも不変です（`step7-canonical-scope-data.log`）。

変更はCode Generation Plan §4と`aidlc-docs/`だけです。公開renderer・公開HTML/CSS・admin/style.css・tokens・D1 schema・wrangler設定・既存JSONは変えていません。fixtureは架空データです。初回はproduction snapshotの本文等34文字列（20文字以上）との機械照合で混入0でした（`final-scope-data.log`）。修理後は本文・タイトル等の短い値も加えた105文字列を、追加行・全未追跡ファイル・Worker結果へ照合し、混入0です（`repair-final-check.log`）。初回の広い照合で一致した取得metadataの日時と既存の静的既定画像pathは、承認済みprovenanceおよびbase Workerの値と確認して対象から除外しました。本文の一致はなく、照合logへ本番内容を出していません。

context rootのread-only終了parityは初回・修理後ともexit 0、WORKSPACE_PARITY=pass／TASK_PARITY=not_assessedでした（`session-end-parity.log`／`repair-session-end-parity.log`）。これは本候補の独立reviewやFront受入とは別の検査です。

close事前検査は、許可された`_scratch/codex-work/20261117-160800_1212hp-41-data-fields/close-dryrun/`に`aidlc-docs/`をコピーし、コピー側だけでgate 4・5のSYNTHETIC記録とComplete stateを置き、実scriptと同じ`validate_close_ready`を呼びます。既存1〜3の絶対pathもコピー側だけへ付け替えます。検査は書式・artifact／digest整合の確認で、人の承認・独立review・本番成功を証明しません。

- close事前検査: PASS（`close-dryrun.log`）。本物のgate 4・5記録なし、実stateはCode Generation Result / Pending。`scripts/aidlc-cycle.sh close`未実行。

## Gap・既知の制限と残る確認

RV41-02は今回修理していません。Workerの旧日付比較と省略key補完は作品idをMapのkeyにしており、重複・欠落idがあると別作品の値を比較・補完に使う可能性があります。独立reviewでは、異なる旧形式日付を持つ異常idの無変更PUTが`invalid releaseDate`の400となり、DB書込0であることが確認されました。

Frontが既知の制限として残した理由は、本番snapshotの4作品がすべて一意の文字列idであり、管理画面の通常作成は`'disc-' + Date.now()`を付与し、手編集等の異常データへの対応は今回の目的に対して変更が大きいためです。確認された拒否は書込前に止まりデータを失わず、異常データを元に戻せます。重複・欠落idの作品が見つかった時、または#47で保存の仕組みを作り直す時に見直します。Map衝突が及ぼす他のケース全般の保証は未実施です。

修理後の独立再reviewは未実施、本番確認は未実施・Owner 操作待ちです。Ownerの操作は計画どおり、試験済みPR最終revisionからWorker deploy→merge→Pages配信確認後の1作品保存確認です。FrontがAPI・OG・配信revisionとrollback先を確認します。#42以降の公開画面・再生・新レイアウトと#47の全体guardは今回の受入範囲外です。

既存root READMEのHosting表記はAdminをCloudflareとしていますが、Front確認済みの実配信元はGitHub Pagesです。既存admin READMEの「画像アップロードはMVP範囲外」という注意は、現在のAPI ModeのR2 upload実装／Worker READMEの説明と一致しません。これらは既存の説明差として保持し、無関係な設計・実装を変更していません。今回追加した#41手順は現在の配信経路に合わせています。
