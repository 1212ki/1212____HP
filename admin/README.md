# 1212 Homepage Admin

`tools/1212____HP/admin` は、1212ホームページの管理画面です。

## モード

- Local Mode
  - `data/site-data.json` を読み込み、保存時にJSONダウンロード
- API Mode
  - Cloudflare Worker APIへ保存し、LiveごとにX投稿（Web Intent + OGPリンクカード）可能

## 設定

1. `config.example.js` を `config.js` としてコピー
2. `apiBaseUrl` にWorkerの公開URLを設定
3. `adminToken` をWorker側の `ADMIN_SHARED_TOKEN`（secret）と一致させる
4. 公開サイト側も `assets/js/site-config.js` の `SITE_API_BASE` を同じWorker URLに設定する

Cloudflare Accessで管理画面を保護する場合は、Worker側を `BYPASS_ADMIN_TOKEN = "true"` にして、`adminToken` を空にできます。

## 起動

```bash
cd tools/1212____HP/admin
python -m http.server 8080
```

## 運用

1. News/Live/Discography/Profile を編集
2. `保存` で反映
3. Live編集モーダルの `Xに反映` ボタンで告知投稿（Web Intent）

## 注意

- 画像ファイルアップロードはMVP範囲外です。画像は `tools/1212____HP/assets/images/` へ配置してパスを指定してください。
