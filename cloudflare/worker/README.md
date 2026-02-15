# 1212 Homepage Cloudflare Worker

管理画面と公開サイト向けのAPI、およびX自動投稿を担当するWorkerです。

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
- `GET /api/admin/x-posts`
  - X投稿履歴取得
- `POST /api/admin/live/:liveId/post-x`
  - 指定ライブ情報を整形してXへ投稿
  - `?dryRun=1` を付けると投稿せずに連携確認と投稿文プレビューのみ実行
- `POST /api/admin/live/:liveId/schedule-x`
  - 指定ライブ情報を整形してXの予約投稿（D1に保存）
  - Cron Triggerで予約時刻になったらWorkerが自動実行
- `POST /api/admin/x-posts/:id/cancel`
  - 予約投稿のキャンセル

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
   - `wrangler secret put X_CONSUMER_KEY`
   - `wrangler secret put X_CONSUMER_SECRET`
   - `wrangler secret put X_ACCESS_TOKEN`
   - `wrangler secret put X_ACCESS_TOKEN_SECRET`
   - `wrangler secret put ADMIN_SHARED_TOKEN`（管理API保護トークン。リポジトリにコミットしない）
   - （任意）チケット予約のLINE通知
     - 方式A: LINE Messaging API push（推奨）
       - `wrangler secret put LINE_CHANNEL_ACCESS_TOKEN`
       - `wrangler secret put LINE_TO`（通知先。ユーザーID/グループIDなど）
     - 方式B: 任意Webhook（Slack互換など）
       - `wrangler secret put LINE_WEBHOOK_URL`
5. デプロイ
   - `wrangler deploy`

## 認証方針

- 推奨: Cloudflare Accessで管理画面を保護
- API直叩き時は `Authorization: Bearer <ADMIN_SHARED_TOKEN>` を利用（Secret）

## 備考

- 画像は管理画面からアップロード可能（R2へ保存、`/images/` で配信）
- 投稿テンプレートは `src/worker.js` の `buildTweetText` で調整できます
- X予約投稿を動かすには `wrangler.toml` の `triggers.crons` が必要です（1分ごと推奨）
