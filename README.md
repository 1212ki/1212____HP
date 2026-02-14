# 松本一樹 Official Website

松本一樹（Itsuki Matsumoto）のアーティスト公式ホームページです。

## Overview

- **URL**: [https://1212hp.com](https://1212hp.com)
- **Tech Stack**: HTML / CSS / JavaScript + Cloudflare Worker API
- **Hosting**: Public site（GitHub Pages or Cloudflare Pages）/ Admin & API（Cloudflare）

## Design

### Main Color
- **Accent（テラコッタ）**: `#BF674D`
- ベースは **黒/白/グレー（モノクロ）**、アクセントのみテラコッタを最小限で使用

### Design Rules
- デザインルール（配色/タイポ/余白/コンポーネント）: `DESIGN_RULES.md`
- 音楽活動用トークン（1212 Design System由来）: `assets/css/1212-music.tokens.css`

### Features
- スティッキーヘッダー（スクロール追従）
- パーティクル＆波紋エフェクト（タイトルクリック時）
- 3Dチルトカード（ニュースセクション）
- スクロールフェードインアニメーション
- レスポンシブ対応（PC / スマートフォン）

## Structure

```
1212____HP/
├── index.html          # トップページ（News）
├── profile/            # プロフィール
├── live/               # ライブ情報
├── youtube/            # YouTube
├── discography/        # ディスコグラフィー
├── contact/            # お問い合わせ
├── assets/
│   ├── css/style.css   # スタイルシート
│   ├── js/script.js    # JavaScript
│   └── js/site-content.js  # APIデータ描画
│   └── images/         # 画像素材
├── admin/              # 管理画面（スマホ編集・X投稿）
├── cloudflare/
│   └── worker/         # 公開API・管理API・X投稿Worker
├── _config.yml         # Jekyll設定
└── CNAME               # カスタムドメイン設定
```

## Admin/API Setup

1. 管理画面設定
   - `admin/config.example.js` を `admin/config.js` にコピー
   - `apiBaseUrl` と `adminToken` を設定
2. Worker設定
   - `cloudflare/worker/wrangler.toml.example` を `wrangler.toml` へコピー
   - `setx CLOUDFLARE_API_TOKEN "<token>"` を設定
   - `pwsh ./cloudflare/worker/setup.ps1` を実行（D1作成+schema適用）
   - X APIキーを `wrangler secret put` で登録
3. デプロイ
   - `wrangler deploy`

## Local Development

```bash
# リポジトリをクローン
git clone https://github.com/1212ki/1212____HP.git
cd 1212____HP

# ローカルサーバーを起動
python3 -m http.server 8888

# ブラウザで確認
open http://localhost:8888
```

## Links

- [YouTube](https://www.youtube.com/@1212ki)
- [Bandcamp](https://1212ki.bandcamp.com/)
- [note](https://note.com/1212_4939)

## License

All rights reserved. Copyright 2025 Itsuki Matsumoto.
