# 1212 Homepage Cloudflare Worker

管理画面と公開サイト向けのAPI、およびX自動投稿を担当するWorkerです。

## 機能

- `GET /api/public/site-data`
  - 公開サイト表示用のデータ取得
- `GET /api/admin/site-data`
  - 管理画面用データ取得（認証必須）
- `PUT /api/admin/site-data`
  - 管理画面の保存
- `GET /api/admin/x-posts`
  - X投稿履歴取得
- `POST /api/admin/live/:liveId/post-x`
  - 指定ライブ情報を整形してXへ投稿
  - `?dryRun=1` を付けると投稿せずに連携確認と投稿文プレビューのみ実行

## 初期セットアップ

1. `wrangler.toml.example` を `wrangler.toml` にコピー
2. Cloudflare APIトークンを環境変数に設定
   - `setx CLOUDFLARE_API_TOKEN "<token>"`
3. セットアップスクリプト実行（D1作成 + schema適用）
   - `pwsh ./setup.ps1`
4. シークレット設定
   - `wrangler secret put X_CONSUMER_KEY`
   - `wrangler secret put X_CONSUMER_SECRET`
   - `wrangler secret put X_ACCESS_TOKEN`
   - `wrangler secret put X_ACCESS_TOKEN_SECRET`
   - `wrangler secret put ADMIN_SHARED_TOKEN`（管理API保護トークン。リポジトリにコミットしない）
5. デプロイ
   - `wrangler deploy`

## 認証方針

- 推奨: Cloudflare Accessで管理画面を保護
- API直叩き時は `Authorization: Bearer <ADMIN_TOKEN>` を利用

## 備考

- 画像アップロードは今回のMVP範囲外です（画像は既存運用どおり `assets/images` に配置）
- 投稿テンプレートは `src/worker.js` の `buildTweetText` で調整できます
