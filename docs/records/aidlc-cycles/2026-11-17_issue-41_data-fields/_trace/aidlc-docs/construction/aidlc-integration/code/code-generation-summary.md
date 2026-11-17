# Code Generation Result — 作品の選択・再生映像・種別（Issue #41）

顔にする作品・その場で再生する映像・種別を、現在の管理画面で入力し、APIとLocal JSONへ保存できるようにしました。旧データ・旧adminからの保存を保ち、新規／変更したリリース日だけを検査します。選択先の削除は参照を解除し、カテゴリ移動では参照を保ちます。公開画面と共有画像の優先順位は従来どおりです。

- Status: 確認2の候補／Code Generation Result承認待ち
- Cycle ID: `2026-11-17_issue-41_data-fields`
- Owner: Itsuki Matsumoto
- Executor: bounded Worker 02／修理 bounded Worker 02b
- Reader profile: human_reader / ja-JP / review_surface=notion_paper（投影・提示はFront） / reader_ready=true / open_status=not_opened
- 独立review: 1回目はREJECTED（RV41-01 blocking、RV41-02非blocking）。修理後の再reviewは未実施。Frontが手配する。
- 本番での確認: 未実施・Owner 操作待ち。

## 入力した承認と設計書

確認1の原典である完全promptと回答Aを3承認記録へ逐語転記しました。Approver、prompt／response日時と回答時digestを照合し、repositoryの`validate_approval`でgate 1〜3がすべてPASSしました。承認済みのRequirements・Workflow Plan・Code Generation Planと提案版は書き換えていません。

3設計書はコード・試験への着手前に提案版から同じbytesで昇格しました。`cmp`とSHA-256がCode Generation Plan §3に一致し、最終検査でも一致しています。

| 昇格先 | SHA-256 |
|---|---|
| `docs/specs/current/live-operations-admin-ui.md` | `43e4c9f407f26a8a6e2df8fe41636d7c714c03d9ebd83f2d339b5801b5767177` |
| `docs/specs/current/public-site-ui.md` | `8b886e4346c16eaec93ca4c5b76d13285d85c45255d38664ca3f778433bf58a6` |
| `docs/specs/current/README.md` | `6b48f3d983fb4e46073b5a28c29537508156a51a696ab3d448acf2654cc32ac7` |

証拠は`construction/aidlc-integration/verification/step1-approvals.log`、`step1-promotion.log`、`step7-canonical-scope-data.log`です（本cycle内相対path）。

## 保存と入力の動作

`site.featuredReleaseId`はdigital／demoを横断する作品id、各作品の`playbackVideoId`は全映像カテゴリ共通のid、`releaseType`は任意の文字列です。string以外と欠落は空に補い、入力文字列をtrim・分割しません。Homeの画像は表示名を「共有時の画像」にし、`site.heroImage`の値・upload処理を保っています。

共通処理`assets/js/music-data.js`はUMDで、`isReleaseDateFormat`、`sortReleasesByDate`、`resolveFeaturedRelease`、`clearDanglingMusicReferences`を公開します。コピーを作って処理し、入力や保存配列を並び替えません。明示idが存在すれば優先し、自動選択はdigital→demoを連結した安定順で、形の合う日付の最新を選びます。候補なしはnullです。公開rendererへの読込は追加していません。

adminの`normalizeSiteData`とWorkerの同名関数は入力をdeep cloneし、新keyを補い、全collection確定後に切れた参照を空にします。adminの`saveYouTubeItem`・`saveDiscographyItem`では移動先へ追加した後、`deleteItem`では削除後に照合します。映像を共有する全作品が対象です。作品と映像の候補を再生成し、取消・read-onlyでは変更しません。永続化は既存のheader保存／JSON書き出しです。

日付検査はadminの`releaseDateIsAllowed`・`validateMusicBeforeSave`とWorkerの`validateReleaseDates`にあります。新規または保存前の同じidから日付を変更した作品だけ、空かASCIIの`YYYY.MM.DD`完全一致（10文字）を要求します。実在日は検査しません。旧非文字列はフォームでの表示だけを文字列化し、同じ表示値のままなら元の値を保存します。日付比較baselineは起動時にcloneし、API成功／JSON書き出し成功時だけ送信・出力snapshotへ更新します。

作品modalの検査失敗では、配列操作・参照解除・close・変更マーク・fetchの前にfalseを返します。日付直下の既存`.form-error`、`role=alert`、ARIAとfocusで固定文を示し、正しい入力で消します。header保存時の違反もその作品のeditorで示します。`saveDiscographyItem`のbooleanを`saveModal`で受け、API保存に失敗した作品modalは開いたままdraftを保持します。structured errorは同じ作品idにだけ結び付けます。

Workerの`saveSiteData`は初期INSERTを伴う`getSiteDataRow`を検査に使わず、直接SELECTで保存前JSONを取得します。`preserveOmittedMusicFields`はpayloadに新keyが存在しない場合だけ、同じidの旧値をカテゴリ横断で補います。空文字・null等の明示解除と既存full-replacementを保ち、消した作品を復活させません。旧JSON解析不能は固定400、DB読取障害は既存500で、どちらも書込0です。日付違反の400には`fields`を付け、既存Live ID重複の応答は保ちます。公開projectionのLive管理専用field除去も維持します。

## 保存失敗後の再試行の修理（RV41-01）

1回目の独立reviewで、作品をdigitalからdemoへ移してAPI保存に失敗した後、同じモーダルから再保存すると作品が二重登録される不具合が見つかりました。作品はメモリ上ですでにdemoへ移っているのに、`currentEditType`がdigitalを指したままになることが原因でした。失敗時にモーダルを保持する今回の変更と、既存のカテゴリ移動処理の組合せを試験で捉えていませんでした。

`admin/app.js`の`saveDiscographyItem`で、移動先への追加直後に`currentEditType`を移動後のカテゴリへ同期しました。失敗後も編集中の所属とメモリ上の所属が一致し、再保存はその作品を置き換え、削除はその所属から取り除きます。API失敗時のdraft保持・baseline据置、成功時のclose、Local Modeのメモリ反映とheader保存の流れは維持します。Workerのコードはこの修理では変更していません。

`test/admin-live-operations.test.mjs`へ8件を追加しました。失敗→そのまま再保存、失敗→元カテゴリへ戻して再保存、失敗→タイトルを変えて再保存では、成功後のメモリとPUT payloadの両方で同じidが全カテゴリを通じて1件であることを検査します。失敗後の移動済み作品の削除、Site保存の再試行、作品／共有映像削除後のheader保存失敗と再試行、新規作品の通信失敗後のカテゴリ変更も確認しました。既存のLocal Mode・成功時・日付baselineの試験を含む関連27件と全試験が成功しています。RED／GREENの件数とlogはBuild/Test Resultに記載しています。

RV41-02（重複・欠落idによる旧日付比較／省略key補完の衝突）は既知の制限として残します。本番snapshotの4作品は一意の文字列idで、通常の作成処理は`'disc-' + Date.now()`を付与します。Frontは、手編集等による異常idの対応は今回の目的に対して変更が大きく、確認された旧日付のケースは400で書込前に止まりデータを失わないことから、今回の修理対象外と判断しています。重複・欠落idの作品が見つかった時、または#47で保存の仕組みを作り直す時に見直します。異常idの一般的な整合性保証は行っていません。

## 8段と変更ファイル

| 段 | 実施内容と対象 |
|---|---|
| 1 | 3承認記録を作成・検査後、上記current canonical 3文書をexact bytesで昇格。identity・status・変更前scopeを記録。 |
| 2 | `test/music-data.test.mjs`を先にREDにし、`assets/js/music-data.js`を実装してGREEN。日付・最新・安定順・非破壊・参照解除。 |
| 3 | `cloudflare/worker/test/music-data-fields.test.js`を先にREDにし、`cloudflare/worker/src/worker.js`の保存境界を実装してGREEN。最初の全試験を実施。 |
| 4 | `test/admin-live-operations.test.mjs`の実操作を先にREDにし、`admin/index.html`・`admin/app.js`でSite／作品field・日付・保存・baselineを実装してGREEN。`test/admin-image-form.test.mjs`へhelper読込と必要なfixtureを追加。 |
| 5 | 同admin試験へ削除・取消・移動・read-only・両保存経路を先に追加してRED、完成collectionでの参照照合を実装してGREEN。Workerの参照試験も再実行。 |
| 6 | `test/public-music-data-compatibility.test.mjs`と`cloudflare/worker/test/og-live.test.js`で公開DOM・旧日付・descriptionのみLive・OG画像の回帰を確認。実装変更が不要なcharacterizationとして扱う。 |
| 7 | `admin/README.md`・`cloudflare/worker/README.md`へ保存契約・日付・400・Worker先行・rollbackを統合。app/helperのcache queryを`v=20261117-41`へ揃え、helperをappの前で読む。全試験・scope・canonical照合を実施。 |
| 8 | 本結果、Build/Test Result、cycle summary、state／audit、検証ログを作成。使い捨てコピーでclose前の書式を検査。本物のgate 4・5記録とComplete stateは作成していない。 |

## 計画との一致と残る確認

承認済み計画からの機能・scope・反映順序の差はありません。関数の分解、ログ名、VMのselect本文解析は局所的な実装判断です。旧非文字列の日付を表示する箇所で`String`を使い、保存する元の値とは分けました。既存試験のapp query期待値を新値に、CSSの期待値は元の値に保ち、helperとappが同じqueryであることを検査します。画像試験のassertは維持しています。

既存adminのseed動画とWorkerのheroImage既定の差を保っています。既存公開past一覧はdescriptionを省き、detailでは表示する動作なので、その現状を回帰として固定しました。公開表示の改修は#42〜#44、全体の保存guard改修は#47に残ります。

試験結果と受入条件の対応はBuild/Test Resultを参照してください。修理後の独立再reviewと確認2のOwner承認、本番deploy→merge→保存確認は未実施です。本番はCode Generation Plan §8・§9の別操作で、ここでの試験合格を本番成功とは扱いません。
