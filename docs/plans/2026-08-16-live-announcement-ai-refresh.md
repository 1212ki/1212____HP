# Live管理画面3課題 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** X投稿preview、Live詳細URL操作、AI整理を、独立して検証・closeできる3課題として改善する。

**Architecture:** X投稿文は`assets/js/live-operations.js`の純粋関数、URLコピーは既存canonical URL helper、AI整理は既存strict schemaと原子的rollbackをそれぞれ境界にする。共通ファイルを触ってもACとtestはIssueごとに分ける。

**Tech Stack:** Vanilla HTML/CSS/JavaScript、Cloudflare Worker、OpenAI Responses API Structured Outputs、Node.js test runner。

**Issue #21 delivery authority:** Itsuki承認により、Issue #21のcommit、push、draft PR作成は実行可。merge、production deploy、secret変更、migrationはowner-onlyであり、このplanでは実行しない。

**Implementation gate:** canonical spec `docs/specs/current/live-operations-admin-ui.md` は `Approved`。承認済みscope内の実装を進め、新しい設計判断が必要な場合はspecを `Draft` に戻す。

**Canonical spec:** `docs/specs/current/live-operations-admin-ui.md`

**Supporting notes:** `docs/plans/2026-08-16-live-announcement-ai-refresh-design.md`

## Issue map

| Issue | 主課題 | 独立completion signal |
|---|---|---|
| #19 | X投稿previewと告知テンプレート | 統合formatter・単一previewのtest |
| #20 | Live詳細URLコピーと操作密度 | URL clipboard・disabled・layoutのtest |
| #21 | AI整理の抽出・反映不具合 | 10項目全置換・prompt契約・原子性のtest |

---

### Task 1 / Issue #19: X統合formatterをTDDで追加する

**Files:**
- Modify: `test/live-operations.test.mjs`
- Modify: `assets/js/live-operations.js`

1. `buildXAnnouncementText`がIssue #19の例文を、`YYYY.M.D(曜) 会場`、引用符付き公演名、OPEN/START、ticket、notes、`-act-`出演者、コメント、`#ライブ`、URLの順で生成するfailing testを書く。
2. 片方の時刻だけ、タイトル/会場/performersなし、notes複数行、誤った既存曜日の再計算をtestへ追加する。
3. `node --test test/live-operations.test.mjs --test-name-pattern="X announcement"`で期待したREDを確認する。
4. `parseLiveDate`と`normalizeLivePerformers`を再利用してX専用日付formatterと統合投稿formatterを最小実装する。
5. 同じfocused commandでGREENを確認する。

### Task 2 / Issue #19: 管理画面を単一previewへ変更する

**Files:**
- Modify: `test/admin-live-operations.test.mjs`
- Modify: `admin/app.js`

1. `x-post-preview`が1つだけ存在し、旧parent/reply previewがないfailing testを書く。
2. Web Intentと投稿文コピーが同じ統合previewを使い、saveを呼ばないtestを書く。
3. focused testでREDを確認する。
4. editor HTML、preview更新、Intent、投稿文copy、event bindingを統合formatterへ移す。
5. `node --test test/admin-live-operations.test.mjs`でGREENを確認する。

### Task 3 / Issue #20: Live詳細URLコピーをTDDで追加する

**Files:**
- Modify: `test/admin-live-operations.test.mjs`
- Modify: `admin/app.js`

1. 保存済みLiveの「リンクをコピー」が`getCanonicalLiveUrl`の値だけを書くfailing testを書く。
2. 未保存Liveではリンクコピーがdisabledで、clipboardとsaveを呼ばないtestを書く。
3. focused testでREDを確認する。
4. `copyLiveLinkFromModal`とbutton bindingを最小実装し、既存clipboard fallback/toastを再利用する。
5. focused testでGREENを確認する。

### Task 4 / Issue #20: 3操作をコンパクトな同一列へ整理する

**Files:**
- Modify: `test/admin-live-operations.test.mjs`
- Modify: `admin/app.js`
- Modify: `admin/style.css`
- Modify: `admin/index.html`

1. Web Intent、投稿文コピー、リンクコピーが`announcement-actions`内にあるDOM contract testを書く。
2. `.announcement-actions`だけにflex row、wrap、縮小padding/font、`white-space: nowrap`を設定する。420px以下の汎用縦積みをこの列だけ上書きする。
3. 変更assetのcache bustを更新する。
4. admin focused testでGREENを確認する。

### Task 5 / Issue #21: AI整理を10項目全置換へ変更する

**Files:**
- Modify: `test/admin-live-operations.test.mjs`
- Modify: `admin/app.js`

1. 10項目に古い値を入れ、AI draftの空文字を含めて全項目が置換されるfailing regression testを書く。
2. `sourceText`、site data、save回数が不変であることもassertする。
3. focused testで現在の`if (draft[key])`によるREDを確認する。
4. validated draftの10項目を条件なしで代入する。input snapshot、owner generation、rollback snapshotは変更しない。
5. admin全testでGREENを確認する。

### Task 6 / Issue #21: 実告知フォーマットの抽出契約を固定する

**Files:**
- Modify: `cloudflare/worker/test/live-ai-source-intake.test.js`
- Modify: `cloudflare/worker/src/worker.js`

1. OpenAI requestの`instructions`が引用符付き公演名、同一行の日付＋会場、OPEN/START、ADV/DOOR、`-act-`出演者のmappingを含むfailing testを書く。
2. `cd cloudflare/worker && node --test test/live-ai-source-intake.test.js --test-name-pattern="announcement format"`でREDを確認する。
3. `LIVE_AI_INSTRUCTIONS`だけを最小変更し、schema、model、timeout、validation、error sanitizationを維持する。
4. WorkerのAI source intake testでGREENを確認する。

### Task 7: 文書・全回帰・Issue別reviewを行う

**Files:**
- Modify: `admin/README.md`
- Modify: `cloudflare/worker/README.md`

1. READMEへ単一X preview、URLコピー、AI全置換を課題別に記載する。
2. `node --test test/*.test.mjs`を実行し、root全testのPASSを確認する。
3. `cd cloudflare/worker && npm test`を実行し、Worker全testのPASSを確認する。
4. `node --check admin/app.js`、`node --check assets/js/live-operations.js`、`node --check cloudflare/worker/src/worker.js`、`git diff --check`を実行する。
5. secret、credential、`.env`、対象外差分がないことを監査する。
6. read-only reviewerが#19、#20、#21を別々にAC-by-AC reviewし、各Issueへ独立した`APPROVED | REJECTED | BLOCKED`を返す。
