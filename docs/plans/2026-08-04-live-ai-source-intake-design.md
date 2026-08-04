# Live元情報 AI整理 設計

## 目的

ブッカー／ライブハウスから受け取った非構造テキストを管理画面へ貼り付け、AIでLiveの既存フォーム項目へ整理する。AIは入力補助だけを担い、人が内容を修正・確認した後、既存の保存操作で反映する。

## 決定した体験

```text
元情報を貼る
  → 「AIで整理」
  → date / title / venue / description / ticketUrl / link に反映
  → 人が必要箇所を修正
  → 通常の「更新」→「保存」
```

- 確信度、根拠表示、別プレビューは設けない。既存フォーム自体を確認画面とする。
- AI処理後も自動保存・自動公開しない。
- 元情報のtextareaは変更・消去せず、そのまま保持する。通常保存時には既存の`sourceText`として保存される。
- AIの各出力は、trim後に非空の項目だけ対応フォームへ反映する。AIが空文字を返した項目は既存フォーム値を保持する。
- 既存のルールベース`parseLiveSourceText`は互換性のため削除しない。ただし「AIで整理」経路からは呼ばない（YAGNI）。

## 構成

管理画面は認証済みCloudflare Workerの`POST /api/admin/live-source-intake`へ`sourceText`を送る。WorkerだけがOpenAI Responses APIを呼び、ブラウザへAPIキーを渡さない。

```text
admin/app.js
  -- Bearer ADMIN_SHARED_TOKEN --> Cloudflare Worker
  -- { sourceText } -----------> POST /api/admin/live-source-intake
                                  |
                                  | OPENAI_API_KEY（Worker secret）
                                  v
                                OpenAI Responses API
                                  |
  <-- { draft: six fields } -----+
```

- モデル既定値は、こんだてLoopと同系統の`gpt-5-mini`とする。
- OpenAI Responses APIのStructured Outputsを使い、`text.format.type = "json_schema"`、`strict: true`で返却形を固定する。
- `OPENAI_API_KEY`はWorker secretのみ。`admin/config.js`、HTML、JavaScript、ログ、レスポンスへ露出させない。
- 本番secret設定、Worker deploy、production操作は今回の実装スコープ外とする。

## API契約

### Request

```http
POST /api/admin/live-source-intake
Authorization: Bearer <ADMIN_SHARED_TOKEN>
Content-Type: application/json

{"sourceText":"受け取った元情報"}
```

- 既存の管理API認証を必須とする。未認証は既存規約どおり`401 {"error":"unauthorized"}`。
- `sourceText`はtrim後に1文字以上、最大12,000文字。違反は`400`。

### OpenAI出力スキーマ

すべてのpropertyをrequiredにし、原文から判断できない値は空文字とする。

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "date": { "type": "string" },
    "title": { "type": "string" },
    "venue": { "type": "string" },
    "description": { "type": "string" },
    "ticketUrl": { "type": "string" },
    "link": { "type": "string" }
  },
  "required": ["date", "title", "venue", "description", "ticketUrl", "link"]
}
```

抽出指示は「原文にない情報を補わない」「日付は判断できる場合だけ`YYYY.MM.DD`」「予約・購入先URLだけを`ticketUrl`、公演詳細・SNS等は`link`」「OPEN/START、料金、出演者など既存独立欄のない情報は読みやすい`description`へ整理」とする。

### Response

```json
{
  "draft": {
    "date": "2026.08.20",
    "title": "公演名",
    "venue": "会場名",
    "description": "OPEN 18:30 / START 19:00\n出演: ...",
    "ticketUrl": "https://tickets.example/event/1",
    "link": "https://example.com/event-detail"
  }
}
```

WorkerはStructured Outputsを信用し切らず、返却前に次を検証・正規化する。

- object形状、6キー、文字列型、余分なキーがないこと。
- `date`は空または実在する暦日の`YYYY.MM.DD`。
- `ticketUrl`と`link`は空または`http:`／`https:` URL。credential埋め込みURLは拒否する。
- 各項目に上限を設ける（date 10、title/venue 300、URL 2,048、description 10,000文字）。
- 不正なprovider出力は`502`とし、部分反映しない。

## エラーと安全性

- OpenAI呼び出しは15秒でtimeoutし、`504`を返す。
- providerのレスポンス本文、request ID、APIキー、プロンプト等をクライアントへ返さない。管理画面向けエラーは`AIで整理できませんでした。元情報は変更されていません。`程度にsanitizeする。
- 認証失敗、入力不正、provider拒否／失敗、timeout、JSON/schema/date/URL不正のいずれでもフォーム6項目と元情報を一切変更しない。
- 二重送信防止のため処理中はボタンをdisabledにし、完了後に戻す。
- AI出力をHTMLとして挿入せず、input／textareaの`value`へ設定する。
- Local Modeでは利用不可とし、既存のローカル保存体験を壊さず説明メッセージを出す。

## 非スコープ

- 確信度・根拠・差分表示・別プレビュー。
- AIによる保存、公開、X投稿、予約操作。
- Liveデータスキーマの追加変更。
- 既存ルールベースparserの削除・改修。
- リトライキュー、キャッシュ、履歴、バッチ処理、CSV取込。
- 本番`OPENAI_API_KEY`／管理secretの更新、migration、deploy。

## 受け入れ条件

1. 認証済みAPI Modeで元情報から6項目をAI整理できる。
2. 非空AI出力だけがフォームへ入り、AIの空項目は既存値を保持する。
3. 元情報は保持され、別プレビューも自動保存も発生しない。
4. 失敗時は元情報を含む全フォーム値が処理前と同じである。
5. OpenAIキーとprovider詳細がブラウザ・レスポンスへ露出しない。
6. 入力上限、timeout、schema、日付、URL検証がテストされる。
7. 既存parserは残るがAIボタン経路では実行されない。
