# 1212 Homepage Cloudflare Worker

管理画面と公開サイト向けのAPI、およびX自動投稿を担当するWorkerです。

※現在の推奨運用は「管理画面 → Web Intentで半自動投稿（X APIを使わない）＋OGPリンクカード」です。X APIを使うエンドポイントは将来拡張として残しています。

## 機能

- `GET /api/public/site-data`
  - 公開サイト表示用のデータ取得
- `GET /images/<key>`
  - 画像配信（R2に保存した画像をWorker経由で配信）
- `GET /api/admin/site-data`
  - 管理画面用データ取得（認証必須）
- `PUT /api/admin/site-data`
  - 管理画面の保存
- `POST /api/admin/upload-image`
  - 画像アップロード（認証必須、R2に保存）
- `POST /api/admin/live-source-intake`
  - Liveの元情報をAIで既存フォーム項目へ整理（管理Bearer認証必須）
- `GET /api/admin/x-posts`
  - X投稿履歴取得
- `GET /api/admin/ticket-reservations`
  - Web予約と手動取り置きの一覧取得（認証必須）
- `POST /api/admin/ticket-reservations`
  - Liveに手動取り置きを追加（認証必須）
  - `liveId`、`name`、1〜10の整数`quantity`、任意の`contact`、`internalNote`を受け付けます
  - 手動取り置きは`source: manual`、`status: handled`で保存され、公開予約の通知・自動返信は実行しません
- `GET /api/admin/ticket-reservations.csv`
  - Web予約と手動取り置きをCSV出力（認証必須）
- `POST /api/admin/live/:liveId/post-x`
  - 指定ライブ情報を整形してXへ投稿
  - `?dryRun=1` を付けると投稿せずに連携確認と投稿文プレビューのみ実行
- `POST /api/admin/live/:liveId/schedule-x`
  - 指定ライブ情報を整形してXの予約投稿（D1に保存）
  - Cron Triggerで予約時刻になったらWorkerが自動実行
- `POST /api/admin/x-posts/:id/cancel`
  - 予約投稿のキャンセル

## Live元情報のAI整理

`POST /api/admin/live-source-intake`は、管理画面で貼り付けたLiveの元情報をOpenAI Responses APIのStructured Outputsで整理します。既存の管理APIと同じBearer認証が必要です。

- Request: `{ "sourceText": "..." }`
  - `sourceText`はtrim後1〜12,000文字です。範囲外は`400`を返します。
- Response: `{ "draft": { ... } }`
  - `draft`は`date`、`title`、`venue`、`description`、`ticketUrl`、`link`の6項目です。
- OpenAI呼び出しは15秒でtimeoutし、`504`を返します。
- 主なエラーは、入力不正`400`、認証失敗`401`、provider／出力検証失敗`502`、設定不足`503`、timeout`504`です。
- providerのレスポンス本文、request ID、APIキー、プロンプトなどはクライアントへ返さず、エラー内容をsanitizeします。

`OPENAI_API_KEY`はWorker secretとしてのみ設定し、コード、HTML、ブラウザ側JavaScript、レスポンスへ置かないでください。モデルは任意の`LIVE_AI_MODEL`で変更でき、未設定時は`gpt-5-mini`を使います。

本番のsecret設定とdeployは、ownerの明示承認後にのみ実施してください。

## 初期セットアップ

1. `wrangler.toml.example` を `wrangler.toml` にコピー
2. Cloudflare APIトークンを環境変数に設定
   - `setx CLOUDFLARE_API_TOKEN "<token>"`
   - 必要権限（最低限）:
     - Account: Workers Scripts (Edit)
     - Account: D1 (Edit)
     - Account: R2 Storage (Edit)
3. セットアップスクリプト実行（D1作成 + schema適用）
   - `pwsh ./setup.ps1`
4. シークレット設定
   - `wrangler secret put ADMIN_SHARED_TOKEN`（管理API保護トークン。リポジトリにコミットしない）
   - （任意）X APIを使う場合のみ
     - `wrangler secret put X_CONSUMER_KEY`
     - `wrangler secret put X_CONSUMER_SECRET`
     - `wrangler secret put X_ACCESS_TOKEN`
     - `wrangler secret put X_ACCESS_TOKEN_SECRET`
   - （任意）チケット予約のLINE通知
     - 方式A: LINE Messaging API push（推奨）
       - `wrangler secret put LINE_CHANNEL_ACCESS_TOKEN`
       - `wrangler secret put LINE_TO`（通知先。ユーザーID/グループIDなど）
     - 方式B: 任意Webhook（Slack互換など）
       - `wrangler secret put LINE_WEBHOOK_URL`
   - （任意）チケット予約の申込者向け自動返信
     - `wrangler secret put TICKET_AUTOREPLY_FORM_URL`
     - Formspreeなど、`FormData` のPOSTを受け付ける送信先URLを設定します
     - 未設定または送信失敗時も、予約APIの成功レスポンスは妨げません
5. デプロイ
   - `wrangler deploy`

## 既存D1の手動取り置き対応マイグレーション

既存のD1には`schema.sql`の変更だけでは列が追加されません。新しいWorkerをデプロイする前に、`migrations/0001_manual_ticket_reservations.sql`を一度だけ適用してください。順序は必ず「マイグレーションを先、Workerデプロイを後」です。マイグレーションは対象DBのpreflightで未適用を確認した場合に限り、一度だけ実施してください。

1. `cloudflare/worker`ディレクトリから、preflight（事前確認）として対象のremote DBで列一覧を確認します。

   ```bash
   npx wrangler d1 execute itsuki-homepage --remote --command="PRAGMA table_info('ticket_reservations');"
   ```

   `source`、`contact`、`internal_note`の3列すべてが存在しないことを確認します。一部の列が存在する場合、または3列がすでに存在する場合はここで停止し、マイグレーションを再実行しないでください。

2. `migrations/0001_manual_ticket_reservations.sql`を対象DBへ一度だけ適用します。

   ```bash
   npx wrangler d1 execute itsuki-homepage --remote --file=./migrations/0001_manual_ticket_reservations.sql
   ```

3. postflight（事後確認）として同じremote DBで再確認します。

   ```bash
   npx wrangler d1 execute itsuki-homepage --remote --command="PRAGMA table_info('ticket_reservations');"
   ```

   `source TEXT NOT NULL DEFAULT 'web'`、`contact TEXT`、`internal_note TEXT`が追加され、既存行の`source`が`web`として読めることを確認します。

4. postflight確認が完了してから、新しいWorkerをデプロイします。

## 認証方針

- 推奨: Cloudflare Accessで管理画面を保護
- API直叩き時は `Authorization: Bearer <ADMIN_SHARED_TOKEN>` を利用（Secret）

## 備考

- 画像は管理画面からアップロード可能（R2へ保存、`/images/` で配信）
- 投稿テンプレートは `src/worker.js` の `buildTweetText` で調整できます
- （任意）X予約投稿を動かすには `wrangler.toml` の `triggers.crons` が必要です（1分ごと推奨）
