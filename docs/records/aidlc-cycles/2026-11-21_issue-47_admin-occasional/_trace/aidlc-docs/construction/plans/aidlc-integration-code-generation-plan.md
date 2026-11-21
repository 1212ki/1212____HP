# Code Generation Plan — 管理画面のたまにする更新（Issue #47）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-21_issue-47_admin-occasional`
- Execution target: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-47-admin-occasional`
- Branch: `feature/47-admin-occasional` / base `1f3a1cdcdf9852b3f2cabaa2978352572e0b9d82`
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 1. 到達点と責任

Itsukiがスマホで、Site・News・Music（作品と映像）・Profileの更新を、Liveと同じ型（一覧と編集、保存して公開、未保存の確認）で終えられ、**保存が今と同じ確かさで動く**（送る内容・データの形・ほかの入力を巻き込まないこと）状態を作る。実装入力はRequirements R47-01〜26・S47-01〜20・ADM-47-01〜13、設計提案版（§3）、Figma整合案F47-01〜26。原典はauditに固定する。1つの実装単位`aidlc-integration`として8段で作り、内部工程ごとに別Workerを起動しない（Frontが長さの都合でPacketを区切る場合も、本計画の段の境界で区切り、計画は変えない）。

確認1でItsukiがgate 1〜3と、本計画に含まれる設計提案版2文書・Figma整合案の採否を承認し、Frontが承認記録を作るまで実装しない。後続Workerは昇格・コード・試験・撮影script・架空API・fixtureを持ち、Frontが撮影の実行・画像の目視・独立review手配を持つ。結果を確認2（gate 4・5）へ出す。Owner確認・review・Front completionは別であり、Workerは自己承認・再委任・Git writeをしない。merge・PRはItsukiの別の明示承認。**Cloudflare Workerは変更しない**（変更が要る事情が出たら、止めてFrontへ返し、理由とdeployの順番を示す）。

## 2. 採用する設計

### 決定と理由（Frontの判断VF1〜VF14の具体化と、Workerが決めた点）

| ID | 決定 | 理由 |
|---|---|---|
| D47-01 | **5タブ**。`data-tab`は`site`・`news`・`live`・`music`・`profile`。`#youtube-tab`・`#discography-tab`を`#music-tab`に統合し、中で作品／映像を切り替える。Channel URLは映像の側の上に置く。 | VF1(a)。Issueの範囲。 |
| D47-02 | **上の帯**は、Liveのマスタの形（`44:494`・`47:584`、Figma整合案F47-01・02）にする。幅899px以下は高さ46px（padding 12/16、左「1212 Admin」Label、右「接続中」Caption）、幅900px以上は高さ62px（padding 16/32、Heading 2）。Tabsは幅899px以下が両端揃え・高さ49px、幅900px以上が左寄せ・gap 40・高さ53px。`style.css`の`--admin-header-sticky-height`・`--admin-tab-nav-sticky-height`をこの高さにし、Liveのstickyの位置は変数経由で追従させる。**実装の事実**: 今のHeaderは高さ92px・接続の文字がロゴの下で、#46はこの帯を作り直していない。このため、Liveのタブの上の帯も#47で変わる（Liveの本文は変えない）。 | VF1(e)・VF4。Liveの帯が変わることは、Itsukiが確認1で承認する（Code Generation Planの§2・F47-01に明記）。 |
| D47-03 | **一覧→編集**。幅900px以上（`isWideLiveLayout()`と同じ`matchMedia('(min-width: 900px)')`を共有）は左320の一覧＋右の編集。幅899px以下は一覧→編集に切り替え、編集を開いている間は`body.is-occ-editing`でHeader・接続の帯・Tabs・Musicの切り替えを隠し、上の帯を「‹ 一覧｜題｜保存の状態」の1行にする（Liveの`body.is-live-editing`と同じ作り。F47-06）。編集は同時に1つだけ開く。 | VF1(b)・VF4。 |
| D47-04 | **保存の単位**: Siteはタブ全体、Profileはタブ全体、News・作品・映像は開いている1件、Channel URLはその欄だけ（開いている映像とは別の保存）。 | VF3。Site・Profileは件数が少なく同じ公開面で、Figmaも1画面・1つの保存。News・作品・映像は1件ずつ開いて直す。Channel URLは映像の1件と対象が違い、同時に保存する理由がない（1つのボタンに混ぜると、確認していない値が一緒に公開される）。 |
| D47-05 | **入力は編集面の中だけに持つ**。Site・Profile・Channel URLの入力は`siteData`へ書かない（今は`change`で`siteData`へ書き`markChanged()`している）。保存の成功で`siteData`へ反映する。API接続中は`siteData`が常に「最後に保存できた内容」と一致する（Liveの編集中の一時的な変更を除く）。 | VF3。未保存の入力が`siteData`に混ざると、別の保存の本文に入る。 |
| D47-06 | **保存は`saveScoped`に乗せる**。`saveOccPanel(key)`（`key`は`site`・`profile`・`channel`・`item`）が、入力を読み、対象のslice関数（`applySiteSlice`・`applyProfileSlice`・`applyChannelSlice`・`applyNewsSlice`・`applyReleaseSlice`・`applyVideoSlice`・`applyOccDeleteSlice`）を`saveScoped(slice, { fallbackBase: siteData })`へ渡す。成功したら同じsliceを`siteData`へ適用し（`clearDanglingMusicReferences`を通して再代入）、`releaseDateBaseline`は`saveToApi`が更新する。Local Modeは`saveScoped`を呼ばず、`siteData`へ反映して`markChanged()`し「JSON書き出し待ち」。今の保存と同じkey・値・並びで組む（R47-10）。 | VF3。#46の型。 |
| D47-07 | **未保存の判定**。編集面の入力を、開いた時の値と比べる（`snapshot`の文字列比較）。レジストリ`occPanels`（`site`・`profile`・`channel`・`item`）が、それぞれ`read()`・`baseline`・`dirty`・`saving`を持つ。`isOccDirty()`はいずれかが違う、またはその編集のアップロード中なら真。`requestLiveEditorTransition`（今の移動の確認の関数）を広げ、`liveEditorDirty`・`ticketDirty`に加えて`isOccDirty()`を見て、同じ確認の面（`openLiveDialog`）を出す。「破棄して移動」は`discardOccPanels()`（入力を`siteData`の内容へ戻し、その入力のアップロードを`releaseImageOperations`で止める）。 | VF3。確認の面は新しく作らない。 |
| D47-08 | **headerの「保存」をなくす**（全タブが新しい保存になる段5で。段2〜4の間は旧タブのため`hasChanges`が真の間だけ出す）。API接続中は`#saveBtn`を`hidden`にし、`saveData`のAPI分（公開データ全体を送る経路）を持たない（呼ばれたら何もせず`false`）。Local Modeだけ`#saveBtn`を残し、「JSONを書き出す」（`saveData`のJSON書き出しの分は今のまま）。 | VF3（Frontの推奨）。残す理由は現行コードにない（全タブがその場の保存を持つ）。全体を送る入口が残ると、未保存の入力を巻き込んだ保存の入口が残る。 |
| D47-09 | **削除**は確認（`openLiveDialog`。文言はS47-03）のあと、`applyOccDeleteSlice`（baselineから対象を除く）を`saveScoped`へ渡し、payloadが`clearDanglingMusicReferences`を通るので、**参照の空への戻りが同じ1回のPUT**になる。確認の面には、参照が空に戻ることを示す（顔にする作品: `featuredReleaseId`が対象の`id`／再生する映像: `playbackVideoId`が対象の映像の`id`の作品の件数）。失敗したら`siteData`を戻し、項目を一覧に戻し、編集面と入力を残す。 | VF3。Liveの削除と同じ型。 |
| D47-10 | **同じ画面の別の入力との関係**。1つのタブで、保存・削除の対象でない入力（映像の側のChannel URLの未保存、Siteの別の面）は、保存・削除の本文に入らず、入力もそのまま残る。保存・削除のあとは、Siteの「顔にする作品」と作品の「その場で再生する映像」の選択肢を再描画するが、**編集中の選択値は保つ**。選択肢から消えた値（削除した作品・映像）だけ空に戻す（`rebaseOccDrafts()`）。タブを離れる時は確認が出るので、ほかのタブの未保存の入力は実際には存在しない（保存の本文がbaseline＋対象だけなのは、念のための二重の安全）。 | VF3の「対象をまたぐ場合」。 |
| D47-11 | **別の端末の保存を取り込む仕組みは持たない**（#46と同じ既知の制限）。設計書§4.6が「#47で保存全体を見直す時に扱う」とした点は、扱わない。 | 使うのは1人で、2台から同じ項目を同時に保存する頻度が低い。照合（更新時刻の突き合わせ）はAPIとWorkerの変更とdeployの順序を伴い、「Workerを変えない・deployなし」（VF2・VF10）と両立しない。必要なら別のIssue。 |
| D47-12 | **#46の既知の制限**（Ticket Page共通設定の保存が`ticket`を完了文と6項目だけに置き換える）は直さない。 | Liveの範囲（対象外）。旧keyは#37で削除済みで実害がない。#47の新しいsliceは対象のkeyだけを重ねるので、同じ制限を持ち込まない。 |
| D47-13 | **画像**は、`getImageFormHtml`の共有の形をやめ、Liveのフライヤー（`getFlyerFormHtml`）と同じ3つの言葉（画像を選ぶ／変える／外す）の関数に一般化する（`getOccImageFormHtml(currentImage, inputId, options)`。pathの表示は残す。F47-12・23）。`handleImageSelect`・`clearImage`・`uploadImageToApi`・所有権（`resolveImageOperationOwner`）は、`edit-image`・`currentEditType`・`currentEditId`・`modalGeneration`を**そのまま使う**（News・作品の編集面は`edit-*`のidを保つ）。Site・Profileの画像（`site-hero-image`・`profile-image`）は`page`の所有のままで、`setImagePathForInputId`は`siteData`へ書かず入力（hidden）だけを更新して未保存の判定を呼ぶ。 | 画像の競合制御は#41・#46で試験済みの複雑な部分で、所有権の仕組みを作り直さない。 |
| D47-14 | **編集面は`edit-*`のid・`currentEditType`（`news`・`discography-<cat>`・`youtube-<cat>`）・`currentEditId`・`isNewItem`・`modalGeneration`を保つ**。汎用modal（DOM・`showModal`・`closeModal`・`saveModal`・`deleteItem`のNews・映像・作品の分岐・`handleModalKeydown`・`restoreGenericModalCanonicalValues`）を外す。`.modal*`のCSSは外さない（Liveのまとまりの試験・撮影への影響を避ける。未使用のCSSは後の整理に回す）。 | 画像の所有権・既存の関数名を保つため。 |
| D47-15 | **CSSの方針**。新しいまとまり`/* ----- Occasional Updates ----- */`を、共有のまとまりの後（`/* ----- Safe Area ----- */`の直前）に置く。すべてのclassは`occ-`で始め、共有のclass（`.form-group`・`.text-input`・`.textarea`・`.select`・`.btn`・`.image-upload-area`・`.item-card`）を上書きする規則は、`.occ-tab`（各タブのsectionの祖先class）をつけた`.occ-tab .text-input`の形（特異度(0,2,0)以上）で書き、書く順番に依存させない。Header・Tab Navigation・Reset & Baseの変数（`--admin-header-sticky-height`など）は、そのまとまりの中で直接直す（上の帯をLiveの形にするため。これが唯一の共有のまとまりへの変更）。値は`DESIGN_RULES.md`・tokensの変数だけ（`#`・`rgb`の直書きなし）。 | VF5。#46で起きた「専用の規則が共有のclassと同じ特異度で順序に負ける」を防ぐ（§5のT47-STYLE-SPECで縛る）。 |
| D47-16 | **Liveの保護**。Header・Tabsの変更以外でLiveの見た目・動きを変えないことを、(a) Liveの既存の試験（保護試験を§3の表のとおり改めたあと）、(b) Frontの撮影で、Liveの画面を#46の画像（150枚）と、上の帯を除いて比べる（§6）で確かめる。共有のclassを変えないので、Liveの特異度は変わらない。 | VF5。 |
| D47-17 | **`id`の比較は文字列にそろえる**（`String(a) === String(b)`）。新しい項目の`id`の付け方は今のまま（`news-`・`disc-`・`yt-`＋`Date.now()`）。保存で、baselineに対象の`id`がない時（想定外）は、既存の置き換えではなく新規と同じく先頭へ追加する（保存が黙って何もしないことを避ける）。 | 本番のNewsの`id`は連番で型が分類にない（Gap-03）。データの形は変えない。 |
| D47-18 | **並びは今のまま**。Newsは既存の項目を同じ位置で置き換え、新規は先頭。作品・映像は、保存のたびに元のカテゴリから除き、保存先のカテゴリの**先頭**へ追加する（カテゴリを変えない保存でも先頭に移る。今の動き）。 | データの形・並びを変えない（VF2）。 |
| D47-19 | **Cloudflare Workerは変更しない**。`cloudflare/`・`wrangler.toml`・`schema.sql`は無変更（`git diff 1f3a1cd -- cloudflare`が空）。 | VF2・VF10。保存の経路・形・認証・検査（#41の日付・参照の照合）は今のまま。 |
| D47-20 | **版**。`ADMIN_BUILD_ID`を`2026-11-21T…Z`（実装の日の値）、`style.css`・`app.js`・`music-data.js`の`?v=`を`20261121-47`に揃える（`music-data.js`の中身は変えないが、#46と同じく3つを揃える）。READMEの記載と試験で一致を縛る。 | #46と同じ作法。 |
| D47-21 | **試験の方針**。振る舞いはNodeの決定論的な試験（`test/support/admin-app-harness.mjs`、APIは差し替え、networkへ出ない、依存を足さない）。**「今と同じ」は、同じ操作を#47の前のコード（`git show 1f3a1cd:admin/app.js`をharnessに読ませる）と新しいコードで行い、PUTの本文を文字列として比べて縛る**（T47-EQ）。段1では前のコードだけで期待を固定する（GREEN）。 | VF2。#46のT46-COMPATと同じ作法。 |
| D47-22 | **撮影・手元配信の道具は`test/support/admin-preview/`を広げる**（`aidlc-docs/`に運用で使うscriptを置かない。closeでpathが切れる）。`capture-admin-occasional.py`を足し、`fake_admin_api.py`・`fake_admin_server.py`は`--fixture`と新しいscenarioを受けるように広げる。出力はrepoの外。 | VF7。 |

### 画面の状態（JavaScript）の設計

- 状態変数: `occPanels`（`Map`）、`occActiveItem`（`{ kind: 'news'|'release'|'video', id, category, isNew } | null`）、`musicView`（`'works'|'videos'`）、`occSaveOperation`（保存・削除中の操作の印。`liveWorkspaceSaveOperation`と同じ型）。`activeGlobalTab`は5つの名前。
- 画面の関数（新規・置き換え）: `renderNews`・`renderMusicWorks`・`renderMusicVideos`（一覧）、`openNewsEditor`・`openReleaseEditor`・`openVideoEditor`（`id`と`category`を受ける。新規は`isNew`）、`closeOccEditor`（一覧へ戻る）、`renderSiteSettings`・`renderProfile`・`renderProfileLinks`（入力の描画と、未保存の判定の結び付け）、`syncOccLayout`（幅の切り替え）、`syncOccSaveActions`（「保存して公開」の出し分け）、`setOccStatus`・`setOccError`。`addNews`・`addDiscography`・`addYouTubeVideo`は「+ 追加」のhandlerとして残し、編集面を開く（modalを開かない）。`editNews`・`editDiscography`・`editYouTubeVideo`は同じ名前で編集面を開く関数として残す（一覧の行のhandlerと既存の呼び出しを保つ）。
- 保存の関数: `saveOccPanel`・`deleteOccItem`・`rebaseOccDrafts`・`discardOccPanels`・`readNewsDraft`・`readReleaseDraft`・`readVideoDraft`・`readSiteDraft`・`readProfileDraft`・`readChannelDraft`（それぞれ今の`saveNewsItem`・`saveDiscographyItem`・`saveYouTubeItem`のkey・値の作り方を移す）。検査（`releaseDateIsAllowed`・Workerの構造化された400の日付の応答・`getYouTubeVideoId`）は今のまま、エラーは欄の直下に出す。
- `saveData`は、Local Modeの書き出し専用にする（API分を外す）。`markChanged`・`setSaveStateSaved`・`hasChanges`はLocal Modeの「JSON書き出し待ち」だけに使う。`beforeunload`の条件に`isOccDirty()`・`occSaveOperation`を足す。
- 外から見える関数名（`setupTabs`・`requestLiveEditorTransition`・`afterLiveTransition`・`prepareGenericEditorTransition`）は、Liveの呼び出し元を壊さない形で広げる（`prepareGenericEditorTransition`は役目を終えるので外す。外す時は、呼び出し元が`requestLiveEditorTransition`に移ったことを試験で確かめる）。

### 見た目（CSS）の要点

- 値の根拠はspec（`admin-occasional-layout-spec.md`）の8〜19節と、F47で決めたLiveの形。レイアウト: Site・Profile（§8・9・16・17）は白い面（角丸16・padding 24・gap）を縦に並べる（幅900px以上は幅880、左寄せ）。News・Music（§10〜15）は幅900px以上で一覧320＋gap 24＋編集の残り、編集の入力欄は最大984幅。一覧の行は padding 12/16・gap 2・下線 1px `color/line`（News）、ジャケット40x40・角丸6（作品）、見出しの行は`color/gray-100`・padding 8/16・Caption（Music）。開いている1件は`color/accent-soft`（幅900px以上）。Musicの切り替えは、幅899px以下は幅いっぱい（358x50、各項目padding 10/12）、幅900px以上は134x46。
- 上の帯・Tabs・本文の余白はF47-01〜03（Liveの値）。「保存して公開」は幅899px以下が下に固定（Liveの`下の操作`と同じ作り。固定の祖先にスクロールの仕組みを置かない）、幅900px以上が見出しの右（変更がない時は`opacity: 0.4`・押せない）。タップの高さは44px以上。

## 3. 変更ファイルと設計書の昇格

| path | 変更範囲 |
|---|---|
| `admin/index.html` | 上の帯（`#saveBtn`を`hidden`の既定へ。`#modeBadge`を右）、タブ5つ、`#site-tab`・`#news-tab`・`#music-tab`・`#profile-tab`の構造（既存の入力・一覧の`id`は残す）、汎用modalのDOMの削除、`style.css`・`app.js`・`music-data.js`の`?v=`を`20261121-47`、`ADMIN_BUILD_ID`。`#live-*`・`#tickets-*`・`#ticket-*`・`#live-dialog-overlay`は変えない。 |
| `admin/app.js` | §2の関数・状態。1ファイル。Liveの関数は、`requestLiveEditorTransition`・`setupTabs`・`beforeunload`・`renderModeBadge`・`shouldConcealGlobalSave`・`syncGlobalSaveButton`・`applyApiFallbackReadOnlyState`の広げる所だけ触る。 |
| `admin/style.css` | `Reset & Base`（変数だけ）・`Header`・`Tab Navigation`（上の帯をLiveの形に）、新しいまとまり`Occasional Updates`（`Tab Content`・`Section Header`・`Subsection`は、`occ-tab`の配下で上書きするだけで、まとまり自体は変えない）。ほかのまとまり（`Live Operations Hub`を含む）は変えない。 |
| `admin/README.md` | タブの案内（5タブ）、運用（各タブの「保存して公開」・未保存の確認・削除・Local Mode）、手元での確認（§7）、反映順序とrollback（§8・§9。Workerのdeployなし）、版の一致。履歴の節（#41〜#46）は残す（`test/site-shell.test.mjs`の確認が参照する語を保つ）。 |
| `docs/specs/current/live-operations-admin-ui.md`・`README.md` | 下の提案版をexact bytesで昇格。 |
| 新規`test/admin-occasional-pin.test.mjs`・`admin-occasional-save.test.mjs`・`admin-occasional-screens.test.mjs`・`admin-occasional-style.test.mjs` | §5のT47試験。Node標準機能だけ。依存は足さない。 |
| 新規`test/fixtures/admin-occasional-states.json` | 本番の形を持つ架空のfixture（§5）。 |
| `test/support/admin-app-harness.mjs` | 新しい関数・状態を試験から読む窓（`__adminLiveTest`への追加）と、base版の`app.js`を読む補助。動きは変えない。 |
| `test/support/admin-preview/capture-admin-occasional.py`（新規）・`fake_admin_api.py`・`fake_admin_server.py` | 撮影script、架空のAPI（`--fixture`・新scenario）、手元配信のserver（§6・§7）。 |
| **先の Issueの保護試験・既存の試験（下の表）** | 作業ツリーの差分・タブの名前・modal・headerの「保存」を名前で縛る試験を、#47の新しい期待に改める。固定の試験は消さず、期待を置き換える。 |

`assets/js/live-operations.js`・`assets/js/music-data.js`（`?v=`以外）・公開側の`assets/js/*`・`assets/css/*`・各ページのHTML・`DESIGN_RULES.md`・`cloudflare/`・`data/`は変更しない。

### 保護試験・既存の試験の更新表（VF8。現行の`test/`から洗い出した。段は改める段）

洗い出しは、`data-tab`・`tab-btn`・`'youtube'`・`*-tab`のid・`saveBtn`・`saveModal`・`editNews`ほかのmodalの関数・`hasChanges`・`markChanged`・`render*`・「6タブ」・「画像を選択」・`getImageFormHtml`を、`test/*.mjs`と`test/support/*.mjs`のtest本文で検索した72件（`admin-live-operations` 35・`admin-live-style` 11・`admin-live-save` 8・`admin-image-form` 6・`admin-live-review-fixes` 4・`admin-live-screens` 4・`admin-live-pin` 3・`site-shell` 1）。`cloudflare/worker/test`は管理画面の関数を参照せず、Workerを変えないので無変更。

| ファイル | 試験（名前の要点） | 改め方 | 段 |
|---|---|---|---|
| `test/live-ticket-shell.test.mjs` | `T43-COMPAT the only files changed by #43 are the planned ones`の許可の一覧 | 追加: `docs/records/aidlc-cycles/2026-11-21_issue-47_admin-occasional/`、closeの一時path（`docs/records/aidlc-cycles/.aidlc-(stage\|idle\|recovery)-*/`、リポジトリ直下の`.aidlc-idle-*`・`.aidlc-recovery-*`）、`test/admin-occasional-*.test.mjs`、`test/fixtures/admin-occasional-states.json`、`test/support/admin-preview/capture-admin-occasional.py`。`admin/`・`docs/specs/current/`・`aidlc-docs/`・`test/support/admin-app-harness.mjs`・`fake_admin_*.py`は既に許可（#46）。 | 1 |
| `test/admin-live-style.test.mjs` | `LATER_ISSUE_STYLE_GROUPS`・`LATER_ISSUE_TABS`、`T46-STYLE every group … has the bytes of the base commit`（「グループの追加なし」の検査） | `LATER_ISSUE_STYLE_GROUPS`に`Reset & Base`・`Header`・`Tab Navigation`を、`LATER_ISSUE_TABS`に`site`・`news`・`youtube`・`discography`・`profile`を追加（#47が変えるまとまり・タブ）。新しいまとまり`Occasional Updates`を許す検査（`LATER_ISSUE_NEW_GROUPS`）に改める。 | 1（追加は先に。GREEN）、2（Header） |
| 同上 | `T46-COMPAT News, YouTube, Disco, Profile and Site print the same markup…`・`T46-COMPAT the generic modals open with the same fields…`・`T46-COMPAT the header 保存 (saveData) sends the whole data…` | `LATER_ISSUE_TABS`で対象外になる（skip）。同じ観測は`T47-EQ`・`T47-PIN`・`T47-SCOPE`に移す。 | 1 |
| 同上 | `T46-COMPAT the shared picture form keeps the other tabs wording; only the Live flyer has the new wording` | 期待を「全タブの画像のフォームが『画像を選ぶ／変える／外す』」に置き換える（T47-IMAGE）。 | 2 |
| 同上 | `T46-MODE the header 保存 is hidden on the Live tab only while…`・`T46-MODE Local Mode and read-only keep the header button on the Live tab`・`T46-MODE Local Mode: save is 反映 to memory…`・`T46-MODE leaving an unsaved Live through the global tab still asks first`・`T46-STYLE while the confirmation surface is open the page behind is inert`（`saveBtn`・`news-tab`・`site-tab`・`youtube`の名前） | 「API接続中はheaderの保存がない（`hidden`）、Local Modeだけ『JSONを書き出す』がある」に置き換える。確認の面のinertの試験は新しいタブの`id`に改める。 | 2 |
| 同上 | `T46-VERSION ADMIN_BUILD_ID and the ?v= … are the build of this Issue`・READMEの記載の確認 | `20261121-47`・新しい`ADMIN_BUILD_ID`・READMEの記載に改める。 | 7 |
| `test/admin-live-review-fixes.test.mjs` | `T46-HEADER API connected…`・`API connection failed…`・`Local Mode…`・`the other tabs differ from the base commit only in this display: 保存 button, … six tabs, header markup` | Header・Tabs・`#saveBtn`の期待をR47-02・R47-16に改める（`6つのタブ`・Headerのmarkupの基準commit比較を、`T47-HEADER`へ移す）。接続中・接続失敗・Local Modeの文言と帯の期待は今のまま。 | 2 |
| `test/admin-live-operations.test.mjs` | `Live is the initial primary tab and Tickets is not a global tab`（`data-tab`・`tab-btn`） | タブ5つ・名前（`youtube`・`discography`が無い）に改める。 | 2 |
| 同上 | `Live edit workspace renders add and edit in the detail pane while News keeps the generic dialog` | 「Newsも一覧＋編集の編集面」に置き換える（汎用dialogの期待を外す）。 | 2 |
| 同上 | `API fallback is read-only while keeping Live navigation available`・`API fallback keeps every admin collection immutable while existing details remain viewable`・`API fallback blocks direct Live item and API save calls…` | `saveBtn`・modalの関数の呼び出しを、新しい編集面の入力・保存・削除・追加の無効（S47-15）に置き換える。一覧と各項目が読めること、Liveのnavigationが使えることは保つ。 | 5 |
| 同上 | `beforeunload protects global changes and Live dirty or saving states`・`explicit Local Mode labels the header action as JSON export` | `hasChanges`（Local Modeの書き出し待ち）と`isOccDirty()`・保存中でも止めることに広げる。Local Modeのheader「JSONを書き出す」は今のまま。 | 5 |
| 同上 | `Live edit workspace saves a category move…`・`…API save uses the existing save route and deletion keeps existing collection semantics`・`Live editor isolation guards dirty transition and prevents duplicate edit IDs from contaminating News save`・`Live API save transaction rolls back failure… cannot leak failed data through later header save`・`production Live lock gives every workspace button a disabled affordance`・`global tabs …` | Live自体の期待は変えない。`saveBtn`・`saveData`・`addNews`・`saveModal`・`site-tab`・`news-tab`を使う箇所を、新しい入口（`openNewsEditor`・`saveOccPanel`・`#site-tab`・`#news-tab`と、`invokeSaveData`はLocal Modeだけ）に置き換える。 | 2 |
| 同上 | `deleting the selected Live falls back…`（`deleteItem`）・`saving a rendered Live keeps its editor… after a category move`（`saveModal`）・`AIで整理 source intake marks an applied AI draft dirty…`（`saveBtn`） | Liveの観測は保つ。呼び出す関数名を新しい入口に置き換える。 | 2 |
| 同上 | `generic edit modal remains an accessible dialog with Escape close, initial focus, and focus restoration` | 削除する。置き換えとして、編集面の戻る・フォーカス・Escで確認の面を閉じる動き（T47-GUARD・T47-A11Y）を足す。 | 2 |
| 同上 | `admin site-data save rejects cross-collection and same-collection duplicate Live IDs in API and Local modes`（`saveData`） | Liveの保存（`saveScoped`）で重複IDを拒否する観測に改める（`saveData`はLocal Modeだけ）。API Modeの`saveData`が何も送らないことを足す。 | 2 |
| 同上 | `Ticket settings remove legacy copy and keep completion, field editing and contact in saved data`（`editDiscography`） | Liveの観測は保つ。Contactの保存を新しいSiteの保存の入口に置き換える。 | 4 |
| 同上 | `music data fields …`（2597〜2785行。Site・modal・日付・参照・カテゴリ移動・画像・RV41-01の再試行・削除。計約16試験） | 期待（保存の本文・参照が空に戻る・日付のbaselineは成功の後だけ進む・失敗でbaselineを保つ・カテゴリを移しても`id`を保つ・再試行で重複しない）は**保つ**。入口を、`openReleaseEditor`・`openVideoEditor`・`saveOccPanel`・`deleteOccItem`・Siteの入力に置き換える。modalの`modal-body`・`saveModal`・`delete-btn`の観測は、編集面の`id`に移す。 | 3・4 |
| `test/admin-image-form.test.mjs` | `default image forms keep the existing path display for non-live images`・`default image path display escapes the current image path`・`downloadable live flyer forms hide path text…` | 非Liveの画像フォームが「選ぶ／変える／外す」になる（pathの表示と`escapeHtml`は保つ）ことに改める。Liveのフライヤーの期待は変えない。 | 2 |
| 同上 | `Live image clear marks the workspace editor dirty and disables the global save route`・`generic modal close and replacement release abandoned image operations`・`clearImage is latest for generic page images after API success and Local failure` | Liveの観測は保つ。modalの閉じる・置き換えは「編集面の閉じる・別の項目を開く」で、アップロードが解放されることに置き換える。ページの画像（Site・Profile）は、`hasChanges`でなく未保存の判定を見る。 | 2・4 |
| `test/admin-live-save.test.mjs` | `T46-SAVE … unsaved only while its values differ`・`while saving… a second click sends one PUT`・`in Local Mode a save reflects into memory…`・`T46-DELETE …`・`T46-SCOPE a Live save does not send unsaved changes of other tabs and leaves the header save waiting for them`（`'youtube'`・`invokeSaveData`・`saveBtn`・`markChanged`） | Liveの観測は保つ。`T46-SCOPE`は「他のタブの未保存の変更」の作り方（`siteData`を直接書き換える）を新しい入力の作り方に置き換え、「headerの保存が待つ」を「他の編集面の入力が残る」に改める。 | 2 |
| `test/admin-live-screens.test.mjs` | `T46-OPEN the public fields run flyer → … → delete`・`T46-NEW …`（`delete-btn`）・`T46-IMAGE the other tabs keep their picture wording`（`addNews`・`modal-body`・`画像を選択`） | `delete-btn`はmodalの共有idなので、Liveの編集面の削除のid・位置の観測に改める（Liveの期待は変えない）。`T46-IMAGE the other tabs…`は「他のタブも選ぶ／変える／外す」に置き換える。 | 2 |
| `test/admin-live-pin.test.mjs` | `T46-PIN (c) a Live save PUTs …`・`(c) a Live save in Local Mode …`（`saveBtn`）・`(d) deleting a Live removes it…`（`invokeSaveData`・`'youtube'`） | Liveの観測は保つ。`(d)`の「その後のheaderの保存で同じ内容がPUTされる」は、Liveの削除がその場で保存される#46の動きに合わせて確認し直す（`invokeSaveData`はLocal Modeだけ）。 | 2 |
| `test/site-shell.test.mjs` | `T44-ADMIN public Music maps to existing six admin tabs, feature state and save paths remain`（`tab-btn`が6） | `tab-btn`は5。`admin/README.md`が引き続き持つ語（`Music`・`#44`・`#43`・`Disco`・`YouTube`・`#47`・`#42の公開反映（履歴）`・`feature/39-public-pages`）は、READMEの履歴の節に残す。名前を「five admin tabs」に改める。 | 2 |
| `test/profile-contact-shell.test.mjs`・`test/live-ticket-shell.test.mjs`の`T43-COMPAT admin/ … untouched`・`T45-COMPAT … admin, data, Worker` | 基準commit同士の比較（`BASE`と#46の基準の間）なので作業ツリーは見ない | 変えない（確認だけ）。 | 1 |
| `cloudflare/worker/test/*.test.js` | 管理画面の関数を参照しない | 変えない。Workerは無変更なので全件をそのまま通す。 | 4・6・8 |

「保護試験の更新で消える観測」（headerの保存が全体を送る、modalの更新がその場で保存する）は、`code-generation-summary.md`の「更新した既存試験」の表に、試験名・変えた理由（どの要件か）・変えていない動きのassertを残す。固定の試験を、全試験を通すためだけに消さない。

### exact bytesの提案版

提案版は昇格後の最終形（Status: Approved、Owner approvalは#47のgate 3を参照）。配置時点では未承認候補であり、Approvedという文字列だけで昇格しない。直さない節は今の文面を保ち、#33・#35・#37・#46の節の契約は変えていない。変更は、先頭の記録（Last updated・Owner approval・Prior approval（#46）・Implementation gate（#47））・§4.1の1文・§4.5の1つの箇条・§4.6（#46の契約の1文と、新設の「Issue #47の保存契約」）・§5.3の4か所（#41の契約の1文・#44の記述の前置き・#42の記述の前置き・Newsの表の1行）・§6（たまにする更新）・§9（たまにする更新の新設）・§10.3（新設）・§11.2の#47の行・§12.3の後の§12.4のADM-46-10の注・§12.5（新設）・§13.5（新設）・§14の箇条3つ・§15の6行の末尾と§15.1の箇条2つ。

| 提案版（aidlc-docs/から） | 昇格先 | 提案版SHA-256 | 昇格前の元版SHA-256 |
|---|---|---|---|
| `construction/aidlc-integration/canonical-proposals/live-operations-admin-ui.md` | `docs/specs/current/live-operations-admin-ui.md` | `799ef584b63f7767052f6eecb352e8d3e5a2c8d0f0c8344ed2297b46e54d2d64` | `4035f4e793a44f414eea787d4b9a79314d12ee98f3649fcb72bb9d748ea7ef8a` |
| `construction/aidlc-integration/canonical-proposals/README.md` | `docs/specs/current/README.md` | `3f64dcf9ebb79ccf714592d6eea5cd0ca88943c9e223b30accd83621a35fa56f` | `d5b35b8eb81f438dacc60037830dcaa8dc5beb994a2335feff16aaf8ba63cb3e` |

手順: 確認1の3承認digestと提案版hashを照合→現在の昇格先が表の元版hashであることを確認→対応する提案版のbytesをそのまま昇格先へcopy→提案版と昇格先のSHA-256一致と、元版からの差分範囲（上の変更箇所だけ）を確認→実装開始。文字の置換、日付の追補、書式の変更を昇格時に加えない。昇格先が元版hashと違っていたら（他のIssueが先に昇格した場合）、上書きせず停止し、Frontへ差分を返す。Figma整合で意味・採用値が変わった時も同様に停止し、候補の修理と新しいhashの承認で解消してから再開する。`system-design-principles.md`・`public-site-ui.md`は変えない。

Figma整合案もgate 3の対象に含める: `aidlc-docs/construction/aidlc-integration/figma-fix-requests.md` SHA-256 `968dda2d62f6b4b14c7d81480e2f814446e121bb2a8ac851f2b158173ac1dee2`。

## 4. 実装の8段とfocused test

作業前にNode20を選ぶ。以下のcommandはexecution targetから実行し、RED/GREENのexitと対象ACをverification logへ残す。新規試験名は提案で、承認後に作る。承認済みplanには進捗checkboxを足さず、state/resultへ記録する。

```bash
export PATH=/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH
node --version
```

| 段 | 作業とRED→GREEN / focused command | 見積 |
|---|---|---|
| 1. 入力・昇格・今の動きの固定・保護試験の改め | cycle・承認・提案版・元版hashを照合し、2つの設計書を同じbytesで昇格。架空fixture`admin-occasional-states.json`（§5）を作る。**`T47-PIN`を#47の前のコードに対して書き、GREENで固定する**（不要なREDは作らない）: (a) 各modalの「更新」が送る内容（News・作品・映像の、既存の変更・新規・カテゴリの移動・日付の検査・不揃いの既存の日付・不正なYouTube ID）、(b) 削除（News・作品・映像。参照が空に戻る）、(c) headerの「保存」が送る内容（Site・Profile・Channel URL・画像。全体を送ること）、(d) 開いて1項目だけ変えて保存した時の、ほかの値・key（Newsの自由な日付・改行と空行・空文字・二重引用符・全角・旧形式の項目の7/8/3キーへの再構成・数字に見える`id`）、(e) #41の参照の照合（顔にする作品・その場で再生する映像の参照先を削除）、(f) 画像の選択と保存（API・Local）。保護試験の追加だけの更新（§3の表の段1）。`node --test test/admin-occasional-pin.test.mjs test/live-ticket-shell.test.mjs test/admin-live-style.test.mjs test/admin-live-operations.test.mjs` | 5h |
| 2. 土台＋上の帯＋5タブ＋News（最初の1画面） | `T47-HEADER`・`T47-TABS`・`T47-EQ`（News）・`T47-SAVE`・`T47-SCOPE`・`T47-GUARD`・`T47-DELETE`（News）・`T47-NEWS`を先にRED。`occPanels`・slice関数・`saveOccPanel`・`deleteOccItem`・`requestLiveEditorTransition`の広げ・`beforeunload`・`#saveBtn`の扱い・上の帯とTabsのmarkupとCSS（Header・Tab Navigation・Reset & Base）・`#news-tab`の編集面（幅899px以下と900px以上）・「保存して公開」の出し分け・`getOccImageFormHtml`をGREEN。News以外（Music・Site・Profile）は、この段では今の入力とmodalのまま5タブの中へ移すだけにし（YouTubeとDiscoの旧DOMを`#music-tab`へ積む）、段3・4で置き換える。その間、旧タブの保存はheaderの「保存」の旧経路を使うので、`#saveBtn`は`hasChanges`が真の間だけ出す（#46の`shouldConcealGlobalSave`と同じ作り）。段5で、API接続中は常に`hidden`にし、`saveData`のAPI分を外す（D47-08）。§3の表の段2の試験を改める。`node --test test/admin-occasional-save.test.mjs test/admin-occasional-screens.test.mjs test/admin-occasional-pin.test.mjs test/admin-live-operations.test.mjs test/admin-live-review-fixes.test.mjs`。**区切りでFrontの撮影（§6 撮影1）** | 9h |
| 3. Music（作品・映像・Channel URL・参照） | `T47-MUSIC`・`T47-EQ`（作品・映像・Channel URL）・`T47-DELETE`（作品・映像・参照の照合）・`T47-DATE`を先にRED。`#music-tab`（作品／映像の切り替え・見出しつきの一覧・編集・Channel URLの欄とその保存）、`openReleaseEditor`・`openVideoEditor`、`musicOptions`・`playbackVideoOptions`の編集面への付け替え、日付と映像IDの欄の直下の表示、`music data fields …`の試験の置き換えをGREEN。`node --test test/admin-occasional-save.test.mjs test/admin-occasional-screens.test.mjs test/admin-live-operations.test.mjs test/public-music-data-compatibility.test.mjs` | 8h |
| 4. SiteとProfile | `T47-SITE`・`T47-PROFILE`・`T47-EQ`（Site・Profile・画像）・`T47-SCOPE`（Site・Profile）を先にRED。`#site-tab`・`#profile-tab`（入力を編集面だけに持ち、`siteData`へ書かない。画像は`setImagePathForInputId`の変更）、「顔にする作品」の選択肢の更新と編集中の選択値の保持（`rebaseOccDrafts`）、リンクの追加・削除、`T47-IMAGE`をGREEN。`node --test test/admin-occasional-save.test.mjs test/admin-occasional-screens.test.mjs test/admin-image-form.test.mjs test/admin-live-operations.test.mjs`。**区切りとして§5の全試験1回目** | 6h |
| 5. 状態・全移動経路・Local Mode・接続失敗・modalの撤去 | `T47-STATES`・`T47-GUARD`（全移動経路×タブ）・`T47-MODE`・`T47-A11Y`・`T47-FIXTURE`を先にRED。`#saveBtn`をAPI接続中は常に`hidden`にし`saveData`のAPI分を外す（D47-08。`invokeSaveData`はAPI Modeで何も送らないことを試験で縛る）、S47-01〜20の出し分け、API接続失敗の読み取り専用（入力・保存・削除・追加の無効。一覧と各項目は読める）、Local Modeの「JSONを書き出す」と「JSON書き出し待ち」、`beforeunload`の全条件、modalのDOM・関数の撤去、`prepareGenericEditorTransition`の整理、§3の表の段5の試験をGREEN。`node --test test/admin-occasional-*.test.mjs test/admin-live-operations.test.mjs test/admin-live-save.test.mjs test/admin-live-screens.test.mjs` | 6h |
| 6. 全幅のCSS・共有CSSの安全・Liveの非回帰 | `T47-STYLE`・`T47-STYLE-SPEC`・`T47-LIVE-COMPAT`を先にRED。幅900px以上の2列と幅899px以下の1列の切り替え（821・900・1011を含む）、固定の「保存して公開」の祖先にスクロールの仕組みがないこと、タップの高さ、`occ-`の特異度の規則、Header・Tabsの高さ、他のまとまりのbytesが基準と同じ（`Live Operations Hub`を含む）、Liveの既存のCSSの試験をGREEN。`node --test test/admin-occasional-style.test.mjs test/admin-live-style.test.mjs test/admin-live-screens.test.mjs`。**区切りとして§5の全試験2回目。Frontの撮影（§6 撮影2。全画面）** | 6h |
| 7. 画面確認の材料・README・版 | Workerが§6の撮影script・`fake_admin_api.py`・`fake_admin_server.py`・fixtureの全scenarioを完成させ、構文を検査してFrontへ渡す（localhostのbindができないためWorkerは実行しない）。`admin/README.md`・`ADMIN_BUILD_ID`・`?v=`・版の一致試験（`T46-VERSION`の更新）を更新。`node --test test/admin-live-style.test.mjs test/site-shell.test.mjs` | 4h |
| 8. 全試験・結果・修理 | §5の全試験3回目（最終）。結果（code-generation-summary・build-and-test-summary・cycle-summary）を固定しFrontへ返す。Frontが撮影（§6 撮影3。修理後の最終）・全画像の目視・独立review手配を行う。修理は、影響するfocused testと該当画像を再確認し、全体へ波及する新しい変更だけ全試験を追加する。 | 4h |

段2・3・4で、先行する共有の変更が既存試験を壊したら、その時点で原因を直してから次へ進む。全試験を通すために未移行の保護を消さない。既存の試験を変えた時は、試験名・変えた理由（どの要件か）・変えていない動きのassertを`code-generation-summary.md`の「更新した既存試験」の表に残す。

## 5. 決定論的試験と全試験

fixture `test/fixtures/admin-occasional-states.json`は`admin-live-states.json`と同じ形（`meta` / `data` / `scenarios`）。値はすべて架空（題は「テスト作品A」のような名前、URLは`example.test`、人名は架空）。本番の値（題・文章・URL・id）を写さず、**件数と形だけ**を持たせる。dataの形（Requirements §7）: Newsは6件（キーは7つ。`date`は自由な書き方の3通り＝曜日つきゼロ埋めなし・末尾に語がつく・`YYYY/M/D`だけ。1か所並びが逆。一覧と編集で崩れない長さの題。画像は相対pathのjpg・png）、作品は4件（Digital 2・Demo 2。キーは8つ。説明は空・短い・番号つき曲目の改行入り。`releaseType`は1件だけ値、3件は空文字。`playbackVideoId`は1件だけ映像の`id`（`yt-…`の形）を指し、3件は空。`releaseDate`は`YYYY.MM.DD`＋形の違う1件を別scenarioで。題に二重引用符・全角の記号。画像は拡張子が大文字のpathを含む）、映像は5件（3カテゴリ。`youtubeId`は11字）、`channelUrl`は`/@handle`の形、`profile`は9行で空行を含む文・`links`は`{name,url}`の4件・画像の拡張子が大文字、`site.links`は5つのkeyのobject・`featuredReleaseId`は作品の`id`・`heroImage`、`contact`の2項目、`ticket`・`live`は#46のfixtureと同じ形の最小。数字に見える`id`を持つNewsを別scenarioで。scenario: `base` / `empty-lists` / `legacy-shapes`（欠けたkey・余分なkeyを持つ旧形式の項目、形の違う日付）/ `long-values` / `api-fallback` / `local-mode` / `save-fail` / `delete-fail` / `numeric-ids`。

| 群 | 必須assert / AC |
|---|---|
| T47-PIN（段1、#47の前のコードでGREEN。以降もbase版を読む形で残す） | §4の段1の(a)〜(f)。PUTの本文（JSON文字列）・保存先のカテゴリ・並び・keyの集合を、固定の期待で縛る。ADM-47-01・04。 |
| T47-EQ（段2〜4） | 同じ入力から、前のコード（`git show 1f3a1cd:admin/app.js`）の操作（modalの「更新」→`saveData`／`deleteItem`→`saveData`／Siteの`change`→`saveData`）と、新しいコードの操作（編集面の「保存して公開」・削除）が**同じPUTの本文（文字列）**になる。ケース: News（既存の1項目の変更・新規・削除・旧形式の項目を1項目変えると7キーへ再構成）、作品（変更・カテゴリの移動・新規・削除・顔にする作品を削除・参照を持つ作品の削除・日付を変える・不揃いの日付のまま別の項目を変える）、映像（変更・カテゴリの移動・新規・削除・参照される映像の削除）、Channel URL、Site（各面）、Profile（文・links・画像）。ADM-47-01・04。 |
| T47-SAVE | 保存の状態の4つ（保存済み・未保存・保存中・失敗）と、いつ変わるか。入力して戻すと変更なしに戻る。新規は入力するまで未保存でない。保存中は入力・移動・削除・追加・Musicの切り替えが押せず、二重のclickは1回しか送らない。失敗で`siteData`が保存前のまま、入力・編集面が残り、理由が出る。成功後は同じ編集面に留まる（新規は保存した項目の編集になる）。変更がない時の`saveOccPanel`は何も送らず`true`。Local Modeは`markChanged`と「JSON書き出し待ち」で、APIを呼ばない。アップロード中は保存せず通知。ADM-47-02・06。 |
| T47-SCOPE | 保存の本文が`savedBaseline`の複製＋対象だけ: (1) Channel URLの未保存の入力が、映像の保存・削除の本文に入らない（逆も）。(2) Siteの未保存の入力が、作品・映像の保存・削除の本文に入らない（同じ画面にある場合も）。(3) `live`・`ticket`・#41の3項目・`site.heroImage`・他の項目を落とさない。(4) 成功で`savedBaseline`が更新され、続く保存の本文が最新になる。(5) 失敗で`savedBaseline`は変わらない。(6) 重複するライブIDはPUTしない。(7) Siteは対象のkey以外（Siteの未知のkey）を置き換えない。ADM-47-07。 |
| T47-GUARD | 未保存の時、別の項目・「‹ 一覧」・「+ 追加」・作品／映像の切り替え・グローバルタブ（5つ）・SiteとProfileからのタブ移動で確認の面が出て（文言・ボタン・初期のフォーカスは「編集を続ける」）、「編集を続ける」・Esc・背景では何も変わらず、「破棄して移動」で移り入力が公開データの内容に戻る。変更がない時は面を出さず同期で動く。画像のアップロード中も出る。Liveの未保存・Ticket共通設定の未保存も同じ面で止まる（既存の観測を保つ）。`beforeunload`が未保存・保存中・アップロード中・Local Modeの書き出し待ちで止める。ADM-47-02。 |
| T47-DELETE | 確認の面の文言（題あり・題が空の3種・顔にする作品・再生する映像N件）とボタン。「やめる」で何も変えない。「削除する」で、PUTの本文がbaselineから対象を除き、参照が空に戻ったもの（他のkey・他の入力を含まない）。成功で一覧へ戻り、一覧・Siteの選択肢・作品の映像の選択肢が更新される。失敗で項目が一覧に戻り、編集面と入力が残る。新規には削除が出ない。Local Modeは今の動き。ADM-47-04・08。 |
| T47-HEADER・T47-TABS | Headerのmarkup（左「1212 Admin」・右に接続の文字、`#saveBtn`は`hidden`でAPI接続中は出ない）、Tabsは5つで名前・順序・`data-tab`、`youtube`・`discography`・「YouTube」「Disco」が無い。接続中・API Fallback・Local Modeの文言と帯が今のまま。ADM-47-05・13。 |
| T47-NEWS・T47-MUSIC・T47-SITE・T47-PROFILE | §6（Requirements）の対応表の全項目が編集面に存在し、`id`・`name`が今と同じで、保存で今と同じ項目に入る。欄の並び（Figma整合案F47-10）。一覧の行の中身（News=日付と題、作品=ジャケットと題とリリース日、映像=題。見出し）。空の一覧・編集面が未選択。作品／映像の切り替えの入力保持（確認のあと）。Channel URLの欄が映像の側にあること。ADM-47-01・03・05。 |
| T47-DATE | 新規・日付を変えた作品だけ形を検査（日付の直下の文言）、日付を変えない保存・カテゴリの移動は不揃いのまま通る、Workerの構造化された400（`fields`）が該当の項目の欄に出る、映像のID不正が欄の直下に出る。空のまま保存できる（News・作品・映像）。ADM-47-03。 |
| T47-IMAGE | 全タブの画像のフォームの言葉（選ぶ／変える／外す）、path（`パス:`／`URL:`）の表示と`escapeHtml`、アップロード中・失敗の文言と今の画像が残ること、アップロード中は未保存で保存が押せない、Site・Profileの画像が`siteData`へ書かれず入力だけに入る、「破棄して移動」でアップロードが解放される、Local Modeのファイル名と書き出し。ADM-47-01・02。 |
| T47-STATES | S47-01〜20の出す条件と文言（§3の表）。 |
| T47-MODE | API接続失敗は読み取り専用（入力・保存・削除・追加・画像が無効、一覧と各項目は読める、`#saveBtn`も出ない）。Local Modeは`#saveBtn`が「JSONを書き出す」で、各保存はメモリ上へ反映。ADM-47-12。 |
| T47-A11Y | 一覧の行がボタン、編集面の`role`・見出しの関連付け、確認の面の`role=alertdialog`と初期のフォーカス、戻ったあとのフォーカス（一覧の行へ）、状態の`aria-live`、作品／映像の切り替えがtablistでArrowLeft・ArrowRight・Home・Endで動く。 |
| T47-FIXTURE | 本番の形のfixtureの全scenarioで、一覧の描画・開く・1項目の変更→保存・開き直しが例外なく、開いて変えずに閉じても値が変わらない、二重引用符・全角・改行がそのまま、数字に見える`id`でも開ける。ADM-47-11。 |
| T47-STYLE | 新しいCSSが`Occasional Updates`のまとまりに閉じる（変更したまとまりは`LATER_ISSUE_STYLE_GROUPS`に名前がある。それ以外のまとまり（`Live Operations Hub`を含む）のbytesが基準commitと同じ）、色が`var(--…)`のみ、44pxのmin-height、幅899/900の境界、固定の「保存して公開」の祖先にスクロールの仕組みがない、Header・Tabsの高さ（変数）がR47-02の値。ADM-47-09・13。 |
| T47-STYLE-SPEC | `Occasional Updates`のすべての規則が`occ-`のclassを含み、共有のclassを上書きする規則は`.occ-tab`の祖先classを持ち特異度が共有のclassより大きい（特異度を計算して比べる）。まとまりが共有のまとまりの後にあること。 |
| T47-LIVE-COMPAT | Liveのタブの描画（`renderLive`・`buildLiveEditorHtml`の出力）、`live-operations.js`のbytes、Workerと公開側のファイルが基準と同じ。Liveの保存・削除・Ticket共通設定の保存の本文が基準commitと同じ（`T46-PIN`が通る）。ADM-47-10。 |
| 既存の試験 | §3の表のとおり改めたものを含め、Live・Ticket・公開側・Workerの試験は無変更で通る。 |

**全試験**（段4・段6・段8の3回。区切りだけ）:

```bash
export PATH=/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH
node --test test/
npm --prefix cloudflare/worker test
node --check admin/app.js
python3 -B -c 'import ast,sys; [ast.parse(open(p).read()) for p in sys.argv[1:]]' test/support/admin-preview/capture-admin-occasional.py test/support/admin-preview/capture-admin-live.py test/support/admin-preview/fake_admin_api.py test/support/admin-preview/fake_admin_server.py
git diff --stat 1f3a1cd -- cloudflare assets data DESIGN_RULES.md
scripts/aidlc-verify.sh --local
git diff --check
git status --short
```

基準（Front着手前）はサイト989 pass / 0 fail、Worker361 pass / 0 fail。基準より減らない（意図して置き換えた試験の差は結果に表で示す。減った数と増えた数の内訳を`build-and-test-summary.md`に書く）。`git diff --stat 1f3a1cd -- cloudflare assets data DESIGN_RULES.md`は空（Worker・公開側・データ・DESIGN_RULESが無変更）。`node --test test/`はNode v24で動かないので、必ずv20.19.4を使う。

### 網羅の線引き（頻度・影響・戻せるか・作る量で選んだ）

深く縛る: 保存の本文の同一性（保存を壊さない）、他の入力を巻き込まないこと、削除と参照の照合、未保存が確認なしに消えないこと（全移動経路）、今編集できる項目が残ること、本番の形の値で崩れないこと。**縛り過ぎない**: 画面の細かい余白の数値（Figmaのrenderがなく、撮影の目視で見る）、起こりにくく害の小さい場合（アップロード済みの画像の取り消し、2つ以上のタブを同時に開いた場合）は既知の制限として書く（§9）。

## 6. Frontの画面確認（撮影）

Workerはlocalhostをbindできないため、撮影scriptと架空のAPI・fixtureを用意し、Frontが実行する。**撮影は計画の段の区切りに3回**置く。画像をWorkerがReadで開いて確かめてから、次の段へ進む。

- 撮影1（段2のあと。最初の1画面）: 上の帯・5タブ（全タブで同じ）、News 一覧→編集（幅390と1440。通常・未保存・保存中・失敗・削除の確認・空の一覧・新規）。Liveの一覧と編集1つ（幅390・1440）で、上の帯の変更を目視。Workerが画像を開いて、配置・文字の大きさ・色・余白・状態をFigma整合案と照らし、残りの段へ進むか、直すかを決める（直しは段2の中）。
- 撮影2（段6のあと。全画面）: §5（Requirements）のP47-01〜12の全画面×全幅×状態。Liveの画面の#46の画像との比較（下）。
- 撮影3（段8の修理後。最終）: 修理で触った画面と、全画面の再実行。

### 撮影scriptの契約

- 置き場: `test/support/admin-preview/capture-admin-occasional.py`（`capture-admin-live.py`を雛形にする）、共有の架空API `fake_admin_api.py`、fixtureは`test/fixtures/admin-occasional-states.json`（Node試験と共通）。**`aidlc-docs/`にscriptを置かない**（closeでpathが切れる）。画像・metrics・logはrepoの外に書く（既定は一時directoryの`admin-occasional-capture/`。`ADMIN_CAPTURE_OUT`で変える）。`--self-check`はブラウザを使わず契約だけを検査する。
- 実行: `/usr/bin/python3`（`-I`を付けない）＋Playwright 1.58.0。静的配信はFrontが`python3 -m http.server 8080 --bind 127.0.0.1`（worktreeのroot）で起動し、scriptは`--base http://127.0.0.1:8080`を受ける。時計は`page.clock.install(time=...)`で固定する。
- 通信: `context.route('**/*')`で、`http://127.0.0.1`・`http://localhost`のページ・assetだけを通し、`admin/config.js`はscriptが架空の設定（`apiBaseUrl: 'https://api.fixture.test'`・架空の合言葉）で応答して**実ファイルを読まない**。`https://api.fixture.test/**`は`fake_admin_api.py`の関数が`route.fulfill`する（`/api/admin/site-data`の取得と`PUT`・画像のアップロード・予約・集計は`base`）。**`adminFetch`は401・403・404・5xxを受けると本番のAPIへ切り替えて再送する作りなので、架空のAPIは管理画面が呼ぶ経路にこれらを返さない**（失敗の画面は、本番の`adminFetch`の切り替えが起きない`400`などの応答・`PUT`だけの失敗で作る）。それ以外のhostはすべて`abort`し、abortした一覧をlogへ残す。撮影の終わりに、`api.fixture.test`と`127.0.0.1`以外へのrequestが0件であることと、本番のhost（`itsukimatsumoto.workers.dev`・`1212hp.com`）への通信が0件であることを検査し、違えば失敗にする。
- 通信先の確認（headless、受け渡しの前）: 手元配信とtunnelの入口は、Itsukiへ渡す前に、headlessで`admin/config.js`の応答の`apiBaseUrl`と、ページが実際に呼んだhostを記録し、見本のserver以外に出ていないことを確かめる（#46の失敗の防止）。
- 画面・幅: Requirements §5。幅390・360・1440と、2列になる画面（P47-02〜04・11）は821・900・1011も。状態ごとに1枚（画像の名前は`{画面}-{状態}-{幅}.png`）。操作の列（保存・削除の確認・移動の確認）は、各段の直後に撮る。
- 実測（metrics）: ADM-47-13=幅390で上の帯の高さ（Header）が46px±1、幅900px以上で62px±1、Tabsが5つ。ADM-47-06・09=「保存して公開」の文字を`Range.getClientRects`の行で数え各1行（幅390・360）、幅899px以下は未保存でない時に出ていない／未保存の時に画面の下に固定、幅900px以上は見出しの右にあり変更がない時は`opacity`が低く押せない。そのほか: 横スクロールが出ない（`scrollWidth <= innerWidth`）、主要な操作の高さが44px以上、ボタン・入力に表示名がある、幅900の前後でレイアウトが切り替わる、画像の読み込み失敗でレイアウトが崩れない、二重引用符・全角の題が崩れない。
- 合否: 各画面の期待（構造・実測）を検査し、**不合格があっても最後まで撮り、末尾でまとめて失敗（exit 1）にする**。
- 目視: Frontが全画像を見て、figma snapshotの値（spec）と並べて、配置・文字の大きさ・色・余白・状態を確かめる。render画像がない間（Gap-01）は、spec §8〜19の値で判断する。Figmaに描かれていない画面・状態は、足したframeの値と、採用値どおりかを確かめる（F47-13は足した画面全体の3枚、F47-16・18・19・21・22は状態の見本。F47-15・17・20はFigmaを変えず実装の採用値で、F47-17は撮影2の実測も使う）。差があれば、Figmaを直すか実装を直すかをFrontが決める。
- **Liveの比較**: Liveのタブの全画面（#46の150枚と同じ名前・同じ幅）を撮り、#46の画像（`docs/records/aidlc-cycles/2026-11-20_issue-46_admin-live-ops/_trace/aidlc-docs/construction/aidlc-integration/verification/screenshots/`）と、**上の帯（Header＋Tabs）を除いて**比べる。#46の画像は上の帯が146px（Header 92＋Tabs 54）、#47は幅899px以下が95px（46＋49）・幅900px以上が115px（62＋53）なので、各画像の上の帯を切り落として比べる。上の帯が隠れている画面（`body.is-live-editing`・Ticket共通設定）は全体を比べる。差が出た所は、意図した（上の帯の変更に伴う位置のずれ）か、意図しない（共有のCSSの影響）かをFrontが判断し、意図しない差はCSSの修理へ。
- 本番の公開データでの画面確認: 管理画面は認証が要り、本番の値をrepoに入れないので、本番の値では撮らない。本番の形（Requirements §7）は架空のfixtureで撮る。本番の見え方（件数の桁・題の長さ）は、Itsukiがmerge後に画面で確認する（§8）。

## 7. Itsukiが自分で触る確認

管理画面は管理用の合言葉が要るので、**推奨は、架空のAPIで動く手元配信**（本番のデータを一切書き換えない）。Front・Workerは`admin/config.js`のtoken値を参照しない。

### 推奨: 架空のAPIの手元配信（merge前）

- 仕組み: `fake_admin_server.py`（標準ライブラリだけ。#46のものを広げる）が、branchの管理画面の必要なファイル（`admin/index.html`・`app.js`・`style.css`、`assets/css`・`assets/js`、架空の画像）だけを許可して配り、`/admin/config.js`を**実ファイルを読まずに**架空の設定（同じ配信元をAPIとする、架空の合言葉）で応答する。`/api/admin/*`は`fake_admin_api.py`が、メモリ上の架空のデータ（`admin-occasional-states.json`と同じ形）で応答し、保存・削除はメモリに書くだけ。止めると元に戻る。**管理画面が呼ぶ経路には401・403・404・5xxを返さない**（`adminFetch`が本番のAPIへ切り替えて再送するため）。
- 起動（Front。worktreeのrootから）: `/usr/bin/python3 test/support/admin-preview/fake_admin_server.py --port 8080 --fixture test/fixtures/admin-occasional-states.json`。入力の窓（合言葉）は出ない。**本物の合言葉を入力しない**。
- PCで触る: `http://127.0.0.1:8080/admin/`を開き、開発者ツールの画面幅を390にする。
- スマホで触る: PCで起動したまま、tunnel（例: `cloudflared tunnel --url http://127.0.0.1:8080`）の公開URLをスマホで開く。**tunnel経由では、その公開URLをAPIの向き先にする**（127.0.0.1のままだとスマホから届かず、管理画面が本番のAPIへ切り替えて再送する。#46の教訓）。Frontは渡す前にheadlessで通信先を確かめる（§6）。
- 触って確かめること（本番の表記）: 上の帯が薄く1行で、タブが5つ（Site・News・Live・Music・Profile）。Newsを開いて題を1文字変える→「未保存」と下に「保存して公開」が出る→別のお知らせを押す→「保存していない変更があります。」が出る→「編集を続ける」→「保存して公開」→「保存済み」。「+ 追加」→何も入れずに「‹ 一覧」（確認が出ない）。お知らせの「このお知らせを削除」→確認→「削除する」。Music→作品／映像の切り替え、作品の「その場で再生する映像」・「種別」、映像のChannel URL（その欄の「保存して公開」）。作品を削除する時に「顔にする作品は…に戻ります。」が出ること。Siteの「顔にする作品」と各リンク、Profileの文・リンクの追加と「削除」。未保存のままタブを替える確認。
- 書き換わるもの: メモリ上の架空のデータだけ。本番のD1・公開データは書き換わらない。後始末はサーバーを止めること。
- 見えないこと: 本番の件数の桁・題の長さ・画像の実在、実際の合言葉の通り方、iOS Safariの`beforeunload`、通信の速さ。これらは§8の確認で補う。

### なぜ本番APIを相手にしないか

- 本番のAPIのCORSの許可元（`wrangler.toml`の`ALLOWED_ORIGINS`）に、tunnelのURLは入っていない。スマホからtunnel経由で本番APIにつなぐと、通信が止まり読み取り専用（API接続失敗）になる。許可元を足すにはWorkerの変更が要り、範囲外。
- PCの`127.0.0.1:8080`から本番APIにつなぐ方法はあるが、`admin/config.js`の中身を参照できず、保存・削除が**本番のデータを書き換える**。本番のデータを書き換える操作を確認に含めない。

### merge後の確認（本番の表記。Itsukiが見て判断する）

Pagesの反映（数分）のあと、管理画面を再読込して次を見る（**本番のデータを書き換える操作を含めない**）。

1. 上の帯が薄く、タブが5つ（Site・News・Live・Music・Profile）。YouTubeとDiscoのタブがない。
2. Newsを開き、一覧の行と編集の入力欄が本番の内容で崩れていない（日付の書き方・題・説明・画像）。何も変えない間は「保存済み」で、「保存して公開」が出ない（スマホ）。
3. 題に1文字足す→「未保存」と下に「保存して公開」が出る。別のお知らせを押す→「保存していない変更があります。」が出る→「破棄して移動」で、変更は保存されずに戻る（保存は押さない）。
4. Musicで作品と映像を切り替え、作品の「種別」と「その場で再生する映像」、映像のChannel URLが今の値で出る。Siteの「顔にする作品」が今の選択で出る。Profileの文の改行が保たれている。
5. 次に実際に行う更新を1件、「保存して公開」まで行い、公開サイトに反映されることを確かめる。これが本番を書き換える唯一の操作で、Itsukiが自分の判断で行う（後始末は不要。内容は自分の更新）。

## 8. 出し方: mergeだけ（Worker deployなし）

GitHub Pagesがmainから配信するため、mergeした時点で本番の管理画面が入れ替わる。**Cloudflare Workerは変更しないので、deployはない**（#46との違い）。新しい管理画面は、保存の経路・形・認証が今と同じなので、今のWorkerにそのままつながる。

1. **事前（Front）**: PR最終版のcommitと試験済みのコードが一致し、作業ツリーがcleanで、`git diff 1f3a1cd -- cloudflare assets data DESIGN_RULES.md`が空であることを確かめる。公開GET（`/api/public/site-data`）の`meta.updatedAt`と本文のSHA-256を読み取りだけで控える（merge前後で変わらないことを確かめるため。合言葉は使わない）。
2. **確認2のA**（gate 4・5）→ **Itsukiの明示承認** → PRのmerge。Frontが、Pagesのbuild・配信されたassetの版（`ADMIN_BUILD_ID`・`?v=20261121-47`）を読み取りで確認し、ItsukiへmergeとPagesの反映を知らせる。公開GETの`meta.updatedAt`・本文のSHA-256がmerge前と同じ（データが書かれていない）ことを確かめる。
3. **merge後の確認（Itsuki、§7）**。問題がなければIssue・ProjectをFrontが閉じる。

merge前に管理画面のタブを開いていた端末は、旧版の`app.js`が残る場合がある（旧版は今の保存の動きのまま、Workerと互換）。再読込で新版になる。

## 9. rollbackと失敗・停止

| 段 | 失敗・不具合 | 戻し方 |
|---|---|---|
| 実装中（merge前） | 試験の失敗・本番の形で崩れる | 該当の段の修理。承認済み計画・提案版を書き換えず、新しいhashの承認が要る変更はFrontへ返す。 |
| merge前 | 撮影・Itsukiの確認・独立reviewで不具合 | mergeしない。修理して再確認（影響するfocused testと該当の画像）。 |
| merge後 | 管理画面の不具合（保存・削除が動かない、表示が崩れる、タブから戻れない） | **保存を止める**（Itsukiは更新を後にする）。Frontが#47差分だけを戻すrevert PRを準備し、Itsukiが承認・mergeする。Pagesが旧adminを配信したこと（`?v=`・`ADMIN_BUILD_ID`）をFrontが確認する。公開データの形・Workerは変えていないので、旧管理画面は保存済みの内容をそのまま読める。Pagesのcacheで新版が残る端末は再読込する。 |
| merge後・データ | 保存が誤った内容を公開データへ書いた（誤って削除した・別の項目を落とした） | 保存を止める。新しい保存はbaseline＋対象だけで、他の領域を落とさない設計で試験済みだが、万一落ちた場合は、Frontが復旧の手段（D1の復元の可否は未確認。復旧の成立をそれに依存させない）と失われる更新をItsukiへ示し、別判断を求める。誤って削除した項目は、管理画面で入力し直す（自動の復元はない）。データの形・schemaを変えていないため、通常はコードのrevertで足りる。 |

D1・データは通常の手順で巻き戻さない。

停止条件: 許可外のwrite・network・secret、`admin/config.js`のtoken値の参照、データの形・#41の参照の照合・Liveの動き・Cloudflare Workerを変えないと要件を満たせない時、昇格先の元版hashが違う時、aidlc-cycleの手順外の故障、Figma整合で意味が変わった時は、実装を止めてFrontへ返す。

### 既知の制限（頻度・影響・戻せるか・作る量で選んだ）

- 別の端末の保存を取り込まない（最後に保存した側が残る）。#46と同じ。1人で使い、同時に2台で同じ項目を保存する頻度が低い。照合はWorkerの変更とdeployの順序を伴うため扱わない（D47-11）。
- iOSのSafariでは、再読込・戻るの確認（`beforeunload`）が出ないことがある。画面内の移動は画面の確認で止まる。
- 画像を選ぶとその場でアップロードされる（今と同じ）。保存せずに破棄しても、アップロード済みのファイルは残る（公開データには入らない）。取り消す仕組みは作らない（頻度が低く、害が小さい）。
- 作品・映像は、保存のたびにカテゴリの先頭へ移る（カテゴリを変えない保存でも。今の動き）。並びを変えない保存への変更はデータの並びを変えるため、#47では行わない。
- Ticket Page共通設定の保存が`ticket`を置き換える制限（#46）は、そのまま。
- Music映像の側では、幅900px以上で「保存して公開」が2つ（Channel URLの欄と、開いている映像の編集）見える。対象が別で、押した方の入力だけが保存される。
- たまにする更新の10 frameのrender画像がない（Gap-01）。値はspecで確かめ、画像で変わる判断は撮影の目視で扱う。
- 本番の画像の実在・動画IDの有効性・リンク先の到達は確かめていない（Gap-02）。

## 10. 時間の見積もり（実装からPRまで）

| 担当 | 内容 | 時間 |
|---|---|---|
| 後続Worker | 段1〜8（§4の表） | 約48時間（5＋9＋8＋6＋6＋6＋4＋4）。レビュー・修理の往復は含まない |
| Front | 昇格の照合・Figma整合の反映・撮影3回の実行と全画像の目視・結果の受入・merge後の読み取りの確認 | 約8時間 |
| 独立review＋修理 | 実装後に1回（設計と実装）、指摘の修理と再検証 | 約5〜7時間 |
| Itsuki | 確認1・確認2の回答、手元での確認（任意）、mergeの承認、merge後の確認 | 約1時間（承認の待ち時間を除く） |

合計は連続して進めて約7〜8営業日。段2（土台とNews）と段3（Music）が最も重い。Frontが長さの都合で段4の後と段6の後（全試験の区切り）でPacketを区切れる。

## 11. 結果ファイルと確認2

- Code Generation Result: `aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md`。実ファイルの一覧と昇格hash、段ごとのRED→GREEN、更新した既存試験の表、AC別の証拠、未確認を固定する。
- Build/Test Result: `aidlc-docs/construction/build-and-test/build-and-test-summary.md`と`aidlc-docs/cycle-summary.md`。基準との試験数の差、全試験・syntax・integrity・diffの結果、撮影のmetrics、独立reviewと修理、Itsukiが触る確認の結果を書く。**どちらも`- **Blocking Findings**: None`のfield形式**で書く。
- verification logは`aidlc-docs/construction/aidlc-integration/verification/logs/`（RED/GREEN・全試験）。画像・metricsはrepoの外に残し、結果にpathと件数を書く（撮影の画像を`aidlc-docs/`へ移す場合は、Frontの判断で、closeの記録に入る前提にする）。
- 確認2: Itsukiへ、gate 4・5のfresh SHA-256の列挙と、§7の手元配信の入口（URLの渡し方・起動の手順）を渡す。触る確認の未実施を実施扱いにしない。merge前に本人が画面を触って確かめることを推奨。
- close: `scripts/aidlc-cycle.sh close 2026-11-21_issue-47_admin-occasional`。closeのPacketの許可pathに、closeが作る一時path（`.aidlc-stage-*`・`.aidlc-idle-*`・`.aidlc-recovery-*`・`aidlc-docs/.audit-resume.*`・`docs/records/aidlc-cycles/2026-11-21_issue-47_admin-occasional/`）を入れる。

## 12. 今回の返却点

本Packetは、Requirements・Workflow Plan・本計画・設計提案版2文書・Figma整合案・audit・stateを作る。確認1でItsukiがAを返すまで実装しない。
