# 1212ホームページ Cloudflare設定Runbook

## 1. 目的
- 管理画面保存とX自動投稿をCloudflare上で安定運用する。

## 2. 事前準備
- Cloudflareアカウント
- （任意）X APIを使う場合のみ: X開発者アカウント（Consumer Key/Secret, Access Token/Secret）
- 画像アップロード運用をする場合: Cloudflare R2（バケット作成）

## 3. 使うリソース
- Workers: `1212hp`
- D1: `itsuki-homepage`

## 4. ローカル設定
1. `tools/1212____HP/cloudflare/worker/wrangler.toml` を確認
2. `setx CLOUDFLARE_API_TOKEN "<token>"`
3. ターミナル再起動

## 5. Cloudflareダッシュボード初回設定
- Workers未利用アカウントは以下で `workers.dev` サブドメインを1回だけ登録する
- URL: `https://dash.cloudflare.com/576337a7cfcbf54c39da846d70be5665/workers/onboarding`
- この登録が終わるまで `npx wrangler deploy` は失敗する

## 6. 初回セットアップ
`tools/1212____HP/cloudflare/worker` で実行:

```bash
pwsh ./setup.ps1
```

実行内容:
- D1作成（未作成時）
- `schema.sql` 適用
- `wrangler.toml` の `database_id` 反映

R2（画像アップロード）:
- `itsuki-homepage-images` バケットを作成
- `wrangler.toml` に `[[r2_buckets]] binding="IMAGES"` があることを確認
- もしCLIで作れない場合はCloudflareダッシュボードでR2を有効化してバケット作成する

## 7. Secret設定

```bash
npx wrangler secret put ADMIN_SHARED_TOKEN
```

※「管理画面 → Web Intentで半自動投稿（X APIを使わない）」運用なら、XのSecretは不要です。

## 8. デプロイ

```bash
npx wrangler deploy
```

## 9. 管理画面側設定
- `tools/1212____HP/admin/config.js`
  - `apiBaseUrl`: Worker URL
  - `adminToken`: 空のまま（初回アクセス時に入力しlocalStorageへ保存）

## 10. 公開サイト側設定
- `tools/1212____HP/assets/js/site-config.js`
  - `SITE_API_BASE`: Worker URL

## 11. 動作確認
1. 管理画面でLiveを1件追加して保存
2. 公開サイト `live` ページに反映されることを確認
3. Live編集モーダルの「Xに反映」から投稿画面が開くことを確認（Web Intent）
4. 投稿に含まれるURLでカード（画像/タイトル/説明）が出ることを確認

## 12. 障害対応
- `401 unauthorized`
  - `adminToken` 不一致 or `BYPASS_ADMIN_TOKEN` 設定不整合
- `500 X投稿失敗`
  - X Secret未設定/誤設定
- CORSエラー
  - `ALLOWED_ORIGINS` に現在の管理画面URLが含まれていない
