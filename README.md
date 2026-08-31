# 松本一樹 Official Website

松本一樹（Itsuki Matsumoto）のアーティスト公式ホームページです。

## Overview

- **URL**: [https://1212hp.com](https://1212hp.com)
- **Tech Stack**: HTML / CSS / JavaScript + Cloudflare Worker API
- **Hosting**: Public site（GitHub Pages or Cloudflare Pages）/ Admin & API（Cloudflare）

## Authoritative Documents

- Current system / product / UX design: `docs/specs/current/`
- Site-wide visual rules: `DESIGN_RULES.md`
- Approved current product guidance: `docs/product/`
- Documentation and history map: `docs/README.md`
- AI-DLC workflow: `docs/operations/AI_DLC_WORKFLOW.md`

`docs/plans/` is implementation planning and `documents/` is legacy/history; neither replaces current specifications. Active AI-DLC work and closed traces explain the path to a decision but do not become current truth by themselves.

## Design

### Main Color
- **Accent（フィエスタレッド）**: `#BF554D`
- ベースは **黒/白/グレー（モノクロ）**、アクセントのみフィエスタレッドを最小限で使用

### Design Rules
- デザインルール（配色/タイポ/余白/コンポーネント）: `DESIGN_RULES.md`
- 音楽活動用トークン（1212 Design System由来）: `assets/css/1212-music.tokens.css`

### Features
- スティッキーヘッダー（スクロール追従）
- パーティクル＆波紋エフェクト（タイトルクリック時）
- スクロールフェードインアニメーション
- レスポンシブ対応（PC / スマートフォン）

## Structure

```
1212____HP/
├── .aidlc/            # pinned AI-DLC rules and provenance
├── aidlc-docs/        # one mutable active formal cycle (idle after setup)
├── docs/              # current design, workflow, decisions, and accepted history
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
   - `apiBaseUrl` / `adminToken` を設定
2. Worker設定
   - `cloudflare/worker/wrangler.toml.example` を `wrangler.toml` へコピー
   - `setx CLOUDFLARE_API_TOKEN "<token>"` を設定
   - `pwsh ./cloudflare/worker/setup.ps1` を実行（D1作成+schema適用）
   - `wrangler secret put ADMIN_SHARED_TOKEN` を設定
   - （任意）X APIを使う場合のみ、X系secretを設定
3. デプロイ
   - `wrangler deploy`

## Development Workflow

この repo の作業管理は GitHub Issue と GitHub Project `1212hp` で行います。
作業前に Issue を確認し、Project Status を `In Progress` にして、current `origin/main` から `feature/<issue-number>-<topic>` の isolated worktree を作ります。

この AI-DLC bootstrap が統合された後の次の設計・実装変更から、current canonical や code を変える前に formal cycle を開始します。

```bash
scripts/aidlc-verify.sh --local
scripts/aidlc-cycle.sh start <issue-number> <topic>
```

active cycle で要件・計画・承認を記録し、承認された内容を `docs/specs/current/`、必要に応じて `docs/product/` または `DESIGN_RULES.md` へ反映してから実装します。検証と独立 review 後に cycle を close すると、accepted history が `docs/records/aidlc-cycles/` に transactionally archive され、`aidlc-docs/` は idle に戻ります。

今回の setup は formal cycle ではありません。audit は `docs/records/aidlc-bootstrap/` に置かれ、後続変更の承認には使えません。PR 作成直前は Project Status を `Review` にします。merge、production deploy、PR approval は Itsuki の明示承認が必要です。

詳細:

- 文書体系と設計先行ルール: `docs/README.md`
- 現在有効な設計書: `docs/specs/current/`
- AI-DLCの開始・承認・close・復旧: `docs/operations/AI_DLC_WORKFLOW.md`
- GitHub運用: `GITHUB_WORKFLOW.md`

## Local Development

### 推奨（Windows / PowerShell）

```powershell
cd tools/1212____HP
pwsh -File .\\serve.ps1 start
```

ブラウザで `http://127.0.0.1:8888/` を開きます。

停止:

```powershell
pwsh -File .\\serve.ps1 stop
```

### 代替（任意の環境）

```bash
cd tools/1212____HP
python -m http.server 8888 --bind 127.0.0.1
```

## Links

- [YouTube](https://www.youtube.com/@1212____ki)
- [Bandcamp](https://1212ki.bandcamp.com/)
- [note](https://note.com/1212_4939)

## License

All rights reserved. Copyright 2025 Itsuki Matsumoto.
