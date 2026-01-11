# 松本一樹 Official Website

松本一樹（Itsuki Matsumoto）のアーティスト公式ホームページです。

## Overview

- **URL**: [https://1212hp.com](https://1212hp.com)
- **Tech Stack**: HTML / CSS / JavaScript（静的サイト）
- **Hosting**: GitHub Pages

## Design

### Main Color
- **Terracotta（テラコッタ）**: `#BF674D`
- 温かみのあるアースカラーをメインに、シンプルで洗練されたデザイン

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
│   └── images/         # 画像素材
├── _config.yml         # Jekyll設定
└── CNAME               # カスタムドメイン設定
```

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
