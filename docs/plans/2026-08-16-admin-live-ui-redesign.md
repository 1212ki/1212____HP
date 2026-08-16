# Live運用admin UI再設計 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 公開サイトとの対応を保ちながら、Live運用admin UIをdesktopのadaptive master-detailとmobileの一覧→編集導線へ再構成し、1公演の公開内容・告知・予約を迷わず扱えるようにする。

**Architecture:** Vanilla HTML/CSS/JavaScriptと既存Cloudflare API契約を維持する。Liveだけを汎用bottom-sheet modalからworkspace内のdetail paneへ移し、workspace tabs、list filter、event task tabs、dirty/save/read-only stateを小さな状態関数で管理する。Issue #19・#20・#21のX投稿内容、URLコピー、AI抽出・置換behaviorは変更しない。

**Tech Stack:** HTML、CSS、Vanilla JavaScript、Node.js built-in test runner、Cloudflare Worker（回帰確認のみ）

**Canonical spec:** `docs/specs/current/live-operations-admin-ui.md`（Approved）

**Repository policy:** Issue #22だけを変更する。commitとpush、draft PR作成は許可済み。merge、production deploy、secret、DB、migration、公開サイト変更は行わない。

---

### Task 1: Live workspace navigationを追加する

**Files:**

- Modify: `admin/index.html`
- Modify: `admin/app.js`
- Modify: `admin/style.css`
- Modify: `test/admin-live-operations.test.mjs`

**Step 1: failing DOM contract testを書く**

`test/admin-live-operations.test.mjs`へ次を個別testとして追加する。

- Live直下に`role="tablist"`の`Liveページ / 予約管理`がある。
- Liveページ内に`開催予定 / 公演終了`のsemantic filterがある。
- 横断予約台帳は`予約管理`tabpanel、Ticket Page設定は`Ticket Page共通設定`専用panelにあり、Live一覧の`details`ではない。
- 初期状態はLiveページ・開催予定である。

**Step 2: REDを確認する**

Run: `node --test test/admin-live-operations.test.mjs --test-name-pattern="Live workspace"`

Expected: 現行`details.live-secondary`構造のためFAILする。

**Step 3: 最小のworkspace DOMとstate controllerを実装する**

- `admin/index.html`のLive領域を`live-workspace`へ組み替える。
- workspace tabは`data-live-workspace-view="page|reservations"`、list filterは`data-live-list-view="upcoming|past"`を正本にする。
- `Ticket Page共通設定` buttonと専用panel、戻るactionを用意する。
- `setupLiveWorkspace()`、`setLiveWorkspaceView(view)`、`setLiveListView(view)`、`setTicketSettingsOpen(open)`を追加する。
- `aria-selected`、`tabindex`、`hidden`をstateと同期し、ArrowLeft/ArrowRight/Home/Endでtab移動できるようにする。
- 既存`loadTickets()`、`renderTicketsUi()`、Ticket Page field IDと保存処理は変えない。

**Step 4: GREENと関連回帰を確認する**

Run: `node --test test/admin-live-operations.test.mjs`

Expected: PASS。

**Step 5: self-reviewしてcommitする**

Run: `git diff --check && git status --short`

Commit: `feat(admin): structure Live workspace navigation`

---

### Task 2: Live編集をadaptive master-detailへ移す

**Files:**

- Modify: `admin/index.html`
- Modify: `admin/app.js`
- Modify: `admin/style.css`
- Modify: `test/admin-live-operations.test.mjs`
- Modify: `test/admin-image-form.test.mjs`

**Step 1: failing behavior testを書く**

- desktop用workspaceにLive一覧paneと`live-editor-pane`がある。
- `editLive()`と`addLive()`が汎用`showModal()`を呼ばず、detail paneへeditorを描画する。
- 既存News等は引き続き汎用dialogを使う。
- Live選択時に選択card、editor heading、保存状態、mobile戻るactionが更新される。
- 開催予定の先頭cardが`Next Live`として識別される。
- workspace editorに`保存して公開`と`削除`があり、既存の保存・削除契約を維持する。
- editor差替え時に古いAI/reservation responseが新しいLiveを変更できない既存ownership contractを維持する。
- flyer preview/downloadと画像uploadのmodal-owner相当のstale guardを維持する。

**Step 2: REDを確認する**

Run: `node --test test/admin-live-operations.test.mjs test/admin-image-form.test.mjs --test-name-pattern="master-detail|Live edit workspace|Live image"`

Expected: Live編集が`modal-body`へ描画されるためFAILする。

**Step 3: workspace editor ownerを実装する**

- `live-editor-pane`とempty stateをLiveページへ追加する。
- Live editor rootを取得するhelperを作り、Liveのrender・focus・generation ownershipをmodalから分離する。
- `addLive()` / `editLive()`はworkspace editorを開き、`closeLiveEditor()`は一覧へ戻す。
- `modalGeneration`と同じstale-response防止をLive editor generationでも成立させる。既存AI/画像/予約処理の通信契約は変えない。
- 幅900px以上は`320px minmax(0, 1fr)`、未満は選択中だけdetailを表示するCSSにする。
- 保存後も選択中Liveのeditorを維持し、category移動後は対応するlist/filterと選択状態を更新する。
- `saveLiveWorkspace()`の基本経路とLive専用footerをこのTaskで移設する。API Modeは既存`saveData({ silent: true })`まで行い、Local ModeはsiteDataへ反映してheaderのJSON書き出し待ちにする。
- `deleteLiveFromWorkspace()`は既存のconfirm・配列更新・API/Local保存契約を再利用する。汎用modal footerからLive削除を呼ばない。
- Live editorがdirtyの間だけglobal header saveをdisabledにし、editor内の`保存して公開`を案内する。workspace保存後は再度利用可能にする。

**Step 4: GREENと回帰を確認する**

Run: `node --test test/admin-live-operations.test.mjs test/admin-image-form.test.mjs`

Expected: PASS。

**Step 5: self-reviewしてcommitする**

Run: `git diff --check && node --check admin/app.js`

Commit: `feat(admin): add adaptive Live master detail`

---

### Task 3: 公演内task tabsとprogressive disclosureを実装する

**Files:**

- Modify: `admin/app.js`
- Modify: `admin/style.css`
- Modify: `test/admin-live-operations.test.mjs`
- Modify: `test/admin-image-form.test.mjs`

**Step 1: failing task-navigation testを書く**

- editor内に`公開内容 / 告知 / 予約`のsemantic tabsがあり、初期は公開内容だけ表示する。
- 内部tab切替でform input値を保持し、saveやAPI requestを発生させない。
- 新規Liveでは告知・予約tabがdisabled、保存済みLiveでは利用可能である。
- 新規Liveは`元情報から作成`を展開し、`AIで下書きを作る`と`手入力で作成`を表示する。
- 既存Liveは元情報取込を折りたたみ、公開必須fieldを最初から表示する。
- AI成功または手入力選択で新規Liveの公開fieldを表示する。
- 新規Liveの公開fieldはAI handlerが参照できるよう最初からDOMへmountし、`hidden`/classで視覚的に隠す。AI処理後は同じnodeを表示する。
- 公開内容の低頻度fieldは`画像・リンクなど`detailsへ入り、field IDと保存payloadは変わらない。

**Step 2: REDを確認する**

Run: `node --test test/admin-live-operations.test.mjs --test-name-pattern="Live task tabs|progressive disclosure"`

Expected: 現行editorが全sectionを常時表示するためFAILする。

**Step 3: task tabとsection hierarchyを最小実装する**

- `buildLiveEditorHtml()`をpublic content、announcement、reservationの3tabpanelへ再編する。
- `setLiveEditorTask(task)`でARIAと`hidden`を同期し、keyboard navigationを実装する。
- `sourceText`とAI actionは公開内容の入力支援として置く。
- `public/admin-only`のeyebrow label、基本情報、公演情報、出演者、予約導線、詳細設定へfieldを再配置する。
- X preview/action、AI handler、reservation handlerの内容・endpoint・payloadは変更しない。

**Step 4: GREENと回帰を確認する**

Run: `node --test test/admin-live-operations.test.mjs test/admin-image-form.test.mjs`

Expected: PASS。

**Step 5: self-reviewしてcommitする**

Run: `git diff --check && node --check admin/app.js`

Commit: `feat(admin): focus Live editor by task`

---

### Task 4: validation・dirty guard・保存/read-only stateを実装する

**Files:**

- Modify: `admin/index.html`
- Modify: `admin/app.js`
- Modify: `admin/style.css`
- Modify: `test/admin-live-operations.test.mjs`

**Step 1: failing state testを書く**

- `date`または`venue`が空なら保存/API callを行わず、fieldに`aria-invalid`とerrorを出す。
- 日付と`upcoming/past`が矛盾する場合はwarningを出すがcategoryを自動変更せず保存できる。
- input/change後は`未保存`、API save中は`保存中`、成功は`保存済み`、失敗は`保存失敗`になる。
- editor内部task tabの切替はconfirm不要で値を保持する。
- 別Live、一覧、Live workspace tab、global tabへ移るときだけdirty guardを通す。
- `confirm=false`なら移動せず、`confirm=true`なら破棄して移動する。
- API読込fallbackはread-onlyとなり、保存・AI・予約変更を無効化する。
- 明示Local Modeではheader actionが`JSONを書き出す`、API Modeでは`保存`である。

**Step 2: REDを確認する**

Run: `node --test test/admin-live-operations.test.mjs --test-name-pattern="Live validation|dirty guard|read-only fallback|save state"`

Expected: validation、dirty state、read-only stateがないためFAILする。

**Step 3: 状態関数を実装する**

- `validateLiveEditor()`、`setLiveEditorSaveState(state)`、`markLiveEditorDirty()`を追加する。
- `requestLiveEditorTransition(action)`を別Live・一覧・workspace/global tabの入口だけに適用する。
- Task 2で移設済みの`saveLiveWorkspace()`へvalidationとsave stateを追加する。API Modeだけ既存`saveData({ silent: true })`を呼び、Local ModeはsiteData反映後にheaderの`JSONを書き出す`を有効にする。
- `isApiFallbackReadOnly`をload時に設定し、banner、global save、Live/Ticket Pageのinput・textarea・select、AI action、予約のmutation actionをdisabledにする。workspace/list/filter/backなどread-only navigationは維持する。
- 既存のAPI endpoint、payload、AI instruction、予約即時更新を変更しない。

**Step 4: GREENと全admin回帰を確認する**

Run: `node --test test/admin-live-operations.test.mjs test/admin-image-form.test.mjs`

Expected: PASS。

**Step 5: self-reviewしてcommitする**

Run: `git diff --check && node --check admin/app.js`

Commit: `feat(admin): clarify Live publish state`

---

### Task 5: visual density・responsive・documentationを仕上げる

**Files:**

- Modify: `admin/style.css`
- Modify: `admin/index.html`
- Modify: `admin/README.md`
- Modify: `test/admin-live-operations.test.mjs`

**Step 1: failing CSS/accessibility contract testを書く**

- 900px breakpoint、320px master pane、mobile selected/unselected state、sticky task tabs/footerのselectorを固定する。
- tab/button focus-visible、minimum tap target、overflow-safe grid、reduced-motion対応を固定する。
- Primaryは`保存して公開`と`新規Live`だけ、workspace/task/utility actionはsecondary/compact hierarchyになることをDOM classで固定する。
- `admin/index.html`のasset cache-bustが更新されることを固定する。

**Step 2: REDを確認する**

Run: `node --test test/admin-live-operations.test.mjs --test-name-pattern="responsive Live workspace|Live action hierarchy"`

Expected: 最終selectorとcache-bustがないためFAILする。

**Step 3: editorial utilityのvisual refinementを実装する**

- 既存の黒・白・グレー＋`#BF554D` tokenを維持する。
- 新色や外部fontを追加せず、余白、細いrule、type scale、最大幅、label hierarchyで視線順を作る。
- 不要な影と大型buttonを増やさず、主要action以外はcompactにする。
- mobileでhorizontal overflowを出さず、sticky要素がsafe areaを尊重する。
- `admin/README.md`へ新しいLive運用導線と保存/read-onlyの違いを追記する。
- current specは実装結果へ合わせて変更しない。差異が見つかった場合は実装を止め、specをDraftへ戻してowner approvalとdesign reviewをやり直す。実装結果と検証evidenceはplan・PRへ記録する。

**Step 4: GREENと全回帰を確認する**

Run:

```bash
node --test test/*.test.mjs
node --check admin/app.js
cd cloudflare/worker && npm test
```

Expected: root 117件以上、Worker 95件以上が全PASS。件数増加は新規test分のみ。

**Step 5: scope/security checkしてcommitする**

Run:

```bash
git diff --check
git status --short
git diff --stat 64b8785..HEAD
```

Confirm: 公開サイト、Worker、DB、secret、#19〜#21 behavior、依存fileに対象外変更がない。

Commit: `style(admin): refine Live operations workspace`

---

### Task 6: 全体review・PR evidenceを作る

**Files:**

- Modify documentation or tests only when a reviewer finds a real gap.

**Step 1: Issue #22 AC0〜AC16のspec reviewを行う**

設計書、Issue body、baseからのdiff、test evidenceを照合し、各ACへpath/line/test evidenceを付ける。REJECTEDなら実装Workerへ戻し、再reviewする。

**Step 2: code quality/adversarial reviewを行う**

特に次を確認する。

- stale async responseとeditor owner
- unsaved transitionとfocus/keyboard
- API fallback read-only bypass
- category mismatchと保存payload
- mobile breakpointとhidden/ARIAの同期
- #19〜#21 behaviorの先取り・破壊

**Step 3: fresh verificationを行う**

Run:

```bash
node --test test/*.test.mjs
node --check admin/app.js
cd cloudflare/worker && npm test
git diff --check
git status --short
```

Expected: 全command exit 0、意図したtracked filesだけがbranchにある。

**Step 4: draft PRを作る**

- branch: `agent/admin-live-ui-redesign`
- base: `main`
- Issue: `Fixes #22`
- PR body: 変更理由、画面構造、保存/read-only contract、#19〜#21非スコープ、test evidenceを記載する。
- merge・deployは行わない。
