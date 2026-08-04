# Live表示フォーマット構造化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Liveの日付と詳細を構造化保存し、管理画面・AI取込・公開表示・X返信・OGを同じフォーマットへ統一する。

**Architecture:** 表示規則は`assets/js/live-operations.js`の純粋関数へ集約する。管理画面とWorker AI契約は同じ10項目を扱い、公開面は共有formatterを参照する。既存`description`は構造化項目がない過去Liveだけの互換fallbackとして維持し、DB migrationなしで段階移行する。

**Tech Stack:** Vanilla HTML/CSS/JavaScript、Cloudflare Worker、OpenAI Responses API Structured Outputs、Node.js test runner。

**Repository policy override:** commitしない。push、PR、merge、production deploy、secret変更、migration、その他の外部writeも行わない。検証済み未commit差分を残す。

**Companion spec:** `docs/plans/2026-08-04-live-display-format-design.md`

---

### Task 1: 共有formatterをTDDで追加する

**Files:**
- Create: `test/fixtures/live-format-cases.json`
- Modify: `test/live-operations.test.mjs`
- Modify: `assets/js/live-operations.js`
- Create: `cloudflare/worker/test/live-format-fixtures.test.js`
- Modify: `cloudflare/worker/src/worker.js`

**Step 1: 日付formatterの失敗テストを書く**

`formatLiveDate`についてISO、dot、slash、日本語/英語曜日付きのlegacy値が`YYYY.MM.DD(Day)`になること、誤った記載曜日を再計算すること、不正値はtrim後の原文へfallbackすることをassertする。

**Step 2: REDを確認する**

Run: `node --test test/live-operations.test.mjs --test-name-pattern="formatLiveDate"`

Expected: FAIL（関数未実装）。

**Step 3: 詳細formatterの失敗テストを書く**

`formatLiveDetails`について、Open/Start、Startのみ、Openのみ、ticket、複数notes、`※`の重複除去、複数performersの`w. A / B`、明示ラベル`w.`・`w/`の除去、`with`で始まる固有名詞の完全保持、表示順、構造化項目優先、`description` fallbackをassertする。`normalizeLiveDateInput`とperformers正規化も境界値をテストする。

**Step 4: 最小実装を行う**

`assets/js/live-operations.js`へ純粋関数を追加しexportする。既存`parseLiveDate`を再利用し、曜日は英語3文字を実日付から算出する。構造化フィールドの判定とlegacy fallbackを1箇所へ集約する。

browserとWorkerが同じ`test/fixtures/live-format-cases.json`を読むfixture testを追加し、server-side formatterとのdriftを検出する。

**Step 5: X返信を共有formatterへ切り替える**

失敗テストを追加し、`buildXReplyText`の日付と詳細が共有formatterの出力になるように変更する。

**Step 6: GREENを確認する**

Run: `node --test test/live-operations.test.mjs`

Expected: PASS。

### Task 2: 管理画面を構造化Live editorへ変更する

**Files:**
- Modify: `test/admin-live-operations.test.mjs`
- Modify: `admin/app.js`
- Modify: `admin/style.css`
- Modify: `admin/index.html`

**Step 1: editorと保存契約の失敗テストを書く**

次をassertする。

- date inputが`type=date`でlegacy日付をISO表示する。
- 解析不能な既存dateは元値を明示し、別fieldだけを編集して保存しても保持し、X返信previewでも元値を使い、有効日付入力時だけ置換する。
- `edit-openTime`、`edit-startTime`、`edit-ticket`、`edit-notes`、`edit-performers`が存在する。
- 保存時に各fieldがLive itemへ入り、performersが` / `へ正規化される。
- 構造化項目がない既存Liveの`description`を保存後も保持する。
- X preview更新監視に新fieldが含まれる。

**Step 2: REDを確認する**

Run: `node --test test/admin-live-operations.test.mjs --test-name-pattern="構造化|structured|Live editor"`

Expected: FAIL。

**Step 3: 最小実装を行う**

`buildLiveEditorHtml`、`saveLiveItem`、`readLiveFromModal`、preview event bindingを変更する。`description`は新規Liveでは空、既存値はoriginal itemから保持する。解析不能な元dateを読む処理は保存とpreviewで共通helperを使い、日付とperformersの正規化も共有helperを使う。

**Step 4: UIの最小スタイルとcache bustを更新する**

Open/Startを同一rowに配置し、既存tokenとspacing scaleだけを使う。`admin/index.html`の変更対象asset queryだけを更新する。

**Step 5: GREENを確認する**

Run: `node --test test/admin-live-operations.test.mjs`

Expected: PASS。

### Task 3: AI抽出契約を10構造化項目へ変更する

**Files:**
- Modify: `cloudflare/worker/test/live-ai-source-intake.test.js`
- Modify: `cloudflare/worker/src/worker.js`
- Modify: `admin/app.js`

**Step 1: Worker schemaの失敗テストを書く**

required keysが`date/title/venue/openTime/startTime/ticket/notes/performers/ticketUrl/link`であり、`description`がないことをassertする。dateは`YYYY-MM-DD`、時刻は24時間`HH:mm`、各fieldのinstructionと長さ検証、不正時刻・余分なkeyの502をテストする。

**Step 2: REDを確認する**

Run: `cd cloudflare/worker && node --test test/live-ai-source-intake.test.js`

Expected: FAIL（現在は6項目schema）。

**Step 3: Workerを最小変更する**

keys、limits、instructions、date/time validatorを更新する。performersは松本一樹／1212本人を除く共演者だけ、共演者なしは空文字とするinstruction契約をfixtureで固定する。既存の認証、timeout、URL安全性、provider error sanitizationは維持する。

**Step 4: 管理画面AI反映の失敗テストを書く**

10fieldのschema一致、非空値のみ反映、sourceText不変、編集中変更時不反映、失敗時全項目不変、preview更新をassertする。

**Step 5: 管理画面のfield mapを変更する**

`LIVE_SOURCE_INTAKE_FIELD_MAP`とpayload normalizationを10fieldへ揃え、旧`description`へのAI書込みを廃止する。

**Step 6: GREENを確認する**

Run:

```bash
cd cloudflare/worker && node --test test/live-ai-source-intake.test.js
cd ../.. && node --test test/admin-live-operations.test.mjs
```

Expected: PASS。

### Task 4: 公開表示とOGを共有フォーマットへ統一する

**Files:**
- Modify: `test/public-ticket-routing.test.mjs`
- Modify: `assets/js/site-content.js`
- Modify: `assets/js/ticket.js`
- Modify: `assets/js/ticket-complete.js`
- Modify: `ticket/index.html`
- Modify: `ticket/complete/index.html`
- Modify: `cloudflare/worker/test/og-live.test.js`（既存OGテスト名が異なる場合は該当testを変更）
- Modify: `cloudflare/worker/test/x-live-format.test.js`
- Modify: `cloudflare/worker/src/worker.js`

**Step 1: 公開表示の失敗テストを書く**

一覧、featured summary、detail、modal、チケット予約画面のLive選択肢・preview、予約完了画面がformat済み日付と詳細を使うこと、legacy descriptionが残ること、HTML escapeが維持されることをassertする。

**Step 2: REDを確認する**

Run: `node --test test/public-ticket-routing.test.mjs`

Expected: FAIL。

**Step 3: 公開描画を最小変更する**

`site-content.js`と`ticket.js`で`LiveOperations.formatLiveDate`と`formatLiveDetails`を呼び、一覧短縮だけ先頭2行へ絞る。詳細、モーダル、チケット選択Live previewは全行を表示する。`ticket-complete.js`もquery dateを共有formatterへ通す。

**Step 4: OGの失敗テストと実装を行う**

OG titleの日付とdescriptionが構造化formatter相当になるテストを先に追加する。Worker内にはbrowser共有fileをimportできないため、同じ契約の小さいserver-side formatterを追加するか、既存build helperを構造化field対応にする。表記契約をtestで同期させる。

続いてWorkerのX preview、schedule、post endpointがcustom `tweetText`未指定時に同じserver-side formatterを利用し、新構造化項目を欠落させない失敗テストを追加してから`buildTweetText`を変更する。

**Step 5: GREENを確認する**

Run:

```bash
node --test test/public-ticket-routing.test.mjs
cd cloudflare/worker && npm test
```

Expected: PASS。

### Task 5: 文書・全回帰・scope監査を行う

**Files:**
- Modify: `admin/README.md`
- Modify: `cloudflare/worker/README.md`

**Step 1: 運用文書を更新する**

構造化field、表示規則、AI整理後の人手確認、legacy description fallbackを記載する。secret値は書かない。

**Step 2: root全テストを実行する**

Run: `node --test test/*.test.mjs`

Expected: 全件PASS。

**Step 3: Worker全テストを実行する**

Run: `cd cloudflare/worker && npm test`

Expected: 全件PASS、実ネットワークアクセスなし。

**Step 4: 静的・差分検証を実行する**

Run:

```bash
node --check admin/app.js
node --check assets/js/live-operations.js
node --check assets/js/site-content.js
node --check assets/js/ticket.js
node --check assets/js/ticket-complete.js
node --check cloudflare/worker/src/worker.js
git diff --check
git status --short
git diff --stat
```

Expected: syntax error、whitespace error、対象外変更、secret、credential、`.env`なし。

**Step 5: 非スコープを監査する**

既存Live全件移行、重複整理、CSV取込、予約仕様変更、secret変更、deploy、commit、push、PR、mergeが実行または混入されていないことを確認する。
