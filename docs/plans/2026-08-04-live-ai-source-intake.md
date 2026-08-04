# Live元情報 AI整理 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 管理画面に貼った公演元情報を、認証済みWorker経由のAIで既存Liveフォーム6項目へ安全に整理する。

**Architecture:** `admin/app.js`は元テキストだけを管理APIへ送り、Cloudflare Workerが`OPENAI_API_KEY`を使ってOpenAI Responses API Structured Outputsを呼ぶ。Workerで入力・schema・日付・URLを検証し、管理画面は成功した非空値だけを一括反映するため、失敗時や空出力で既存フォームを壊さない。

**Tech Stack:** Vanilla HTML/CSS/JavaScript、Cloudflare Worker、OpenAI Responses API（`gpt-5-mini`、`text.format` JSON Schema、`strict: true`）、Node.js test runner。

**Repository policy override:** commitしない。push、PR、merge、production secret変更、migration、deploy、その他の外部writeも行わない。skillのcommit例よりworkspace方針を優先し、検証済み未commit差分を残す。

---

### Task 1: WorkerのAI抽出契約をTDDで追加する

**Files:**
- Create: `cloudflare/worker/test/live-ai-source-intake.test.js`
- Modify: `cloudflare/worker/src/worker.js`

**Step 1: 認証・入力境界の失敗テストを書く**

`POST /api/admin/live-source-intake`について、未認証が401、空／非文字列／12,000文字超が400、OpenAI `fetch`が呼ばれないことをテストする。テスト用envは`ADMIN_SHARED_TOKEN: "test-admin-token"`と`OPENAI_API_KEY: "test-openai-key"`を使い、実ネットワークへ接続しない。

**Step 2: REDを確認する**

Run: `cd cloudflare/worker && node --test test/live-ai-source-intake.test.js`

Expected: FAIL（route未実装または404）。

**Step 3: provider呼び出し契約の失敗テストを書く**

global `fetch`をstubし、次をassertする。

- URLは`https://api.openai.com/v1/responses`。
- `Authorization: Bearer test-openai-key`で、キーがレスポンスに含まれない。
- bodyの`model`は`gpt-5-mini`。
- `text.format`は`type: "json_schema"`、`strict: true`、`additionalProperties: false`、6文字列propertyをrequiredにする。
- 原文にない値を補完しないこと、日付、`ticketUrl`／`link`、`description`の整理規則がinstructionに含まれる。

**Step 4: 正常系と検証失敗のテストを書く**

Responses APIの成功fixtureから`{ draft }`を返すことに加え、余分なkey、型違反、不正／実在しない日付、`javascript:` URL、credential入りURL、長すぎるfield、refusal、空output、不正JSONを502にする。providerの4xx/5xx本文やAPIキーをクライアントへ返さないこともassertする。

**Step 5: timeoutテストを書く**

abortされるまでpendingになるfetch stubを使い、15秒timeoutが504のsanitized errorになることをfake timerまたは注入可能なtimeout helperでテストする。

**Step 6: 最小実装を行う**

`cloudflare/worker/src/worker.js`へ以下を追加する。

- 管理認証後に処理する`POST /api/admin/live-source-intake` route。
- 12,000文字の入力validator。
- `AbortController`を使う15秒timeout付きResponses API client。
- 6項目のstrict JSON schemaと抽出instruction。
- Responses APIのstructured textを取り出すhelper。
- object/schema/長さ/date/URLのserver-side validator。
- provider詳細を隠す400/502/504 response。

外部API呼び出しはroute内から直接散らさず、小さいhelperへ分離してテスト可能にする。`OPENAI_API_KEY`未設定は503のsanitized errorとする。

**Step 7: GREENを確認する**

Run: `cd cloudflare/worker && node --test test/live-ai-source-intake.test.js`

Expected: PASS。ここではcommitしない。

### Task 2: 管理画面のAI整理フローをTDDで追加する

**Files:**
- Modify: `test/admin-live-operations.test.mjs`
- Modify: `admin/app.js`
- Modify: `admin/style.css`
- Modify: `admin/index.html`

**Step 1: UI契約の失敗テストを書く**

既存Live editorの元情報セクションについて次をassertする。

- action labelが`AIで整理`である。
- API Modeでクリックすると`adminFetch('/api/admin/live-source-intake', { method: 'POST', body: JSON.stringify({ sourceText }) })`を1回だけ呼ぶ。
- 既存`LiveOperations.parseLiveSourceText`を呼ばない。
- 処理中はボタンdisabledと処理中ラベルになり、二重送信しない。

**Step 2: REDを確認する**

Run: `node --test test/admin-live-operations.test.mjs --test-name-pattern="AIで整理|source intake"`

Expected: FAIL（現状は同期parserを呼ぶ）。

**Step 3: 反映規則と失敗時不変のテストを書く**

処理前の`date/title/venue/description/ticketUrl/link/sourceText`をsnapshotし、次をassertする。

- 成功時はAIのtrim後に非空な値だけ対応fieldへ反映する。
- AIが空文字のfieldは既存値を保持する。
- `sourceText`は成功後も一字も変更しない。
- HTTP error、network error、不正payloadのとき6fieldと`sourceText`がsnapshotどおりである。
- 成功後だけX previewを再計算し、保存処理は呼ばない。
- Local ModeではAPIを呼ばず利用不可メッセージを表示する。

**Step 4: 最小実装を行う**

`admin/app.js`の`handleLiveSourceParse`をasyncなAI intake handlerへ置き換える。レスポンス全体を検証してからローカル変数へ正規化し、成功が確定した後に6fieldへ反映する。部分的なDOM更新後に失敗しない順序にする。既存`parseLiveSourceText`と`assets/js/live-operations.js`は削除・変更せず、AI経路では参照しない。

`admin/style.css`には既存design tokenだけを使ってbusy／error表示に必要な最小スタイルを追加する。`admin/index.html`は変更したJS/CSSのcache-bust値だけを更新し、OpenAI設定やkeyは追加しない。

**Step 5: GREENを確認する**

Run: `node --test test/admin-live-operations.test.mjs`

Expected: PASS。ここではcommitしない。

### Task 3: 設定文書を更新し、全回帰を確認する

**Files:**
- Modify: `cloudflare/worker/README.md`
- Modify: `admin/README.md`

**Step 1: READMEを更新する**

`cloudflare/worker/README.md`へendpoint、`OPENAI_API_KEY`がWorker secretであること、既定モデル`gpt-5-mini`、入力上限、timeoutを記載する。secret設定とdeployは将来のowner-only運用手順として記載するだけで、実行しない。

`admin/README.md`へ、AI整理はAPI Mode限定、元情報保持、非空値だけ反映、人による修正後に通常保存、自動保存なしを記載する。

**Step 2: Worker全テストを実行する**

Run: `cd cloudflare/worker && npm test`

Expected: 全テストPASS、実ネットワークアクセスなし。

**Step 3: 管理画面を含むrootテストを実行する**

Run: `node --test test/*.test.mjs`

Expected: 全テストPASS。

**Step 4: 静的・差分検証を実行する**

Run:

```bash
node --check admin/app.js
node --check cloudflare/worker/src/worker.js
git diff --check
git status --short
git diff --stat
```

Expected: syntax errorなし、whitespace errorなし、対象外変更・secret・credential・`.env`なし。

**Step 5: 非スコープを監査する**

次が実行／混入されていないことを確認する。

- `wrangler secret put`、`wrangler deploy`、本番API呼び出し。
- commit、push、PR、merge。
- 自動保存、確信度、根拠、別preview、parser削除、Live schema追加。

計画実装の完了条件はテストとscope監査までであり、本番反映は別途Itsukiの明示承認を得るowner-only作業とする。
