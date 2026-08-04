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

## Live元情報のAI整理

Live編集の`AIで整理`はAPI Mode限定です。ブッカー／ライブハウスから受け取った元情報を貼り付けると、`date`、`title`、`venue`、`openTime`、`startTime`、`ticket`、`notes`、`performers`、`ticketUrl`、`link`の10項目へ整理します。Local Modeでは利用できません。

- AIのtrim後に非空な値だけをフォームへ反映し、空の項目は現在の値を保持します。
- 貼り付けた元情報は変更・消去しません。
- AI整理後に人が内容を修正・確認し、通常の保存操作で反映します。自動保存・自動公開は行いません。
- 処理失敗時、または通信中に元情報や10個のフォーム項目を編集した場合は、AI結果をフォームへ反映しません。
- 確信度、根拠、別プレビューは表示せず、既存フォームを確認画面として使います。

## Live表示フォーマット

- 日付は`YYYY-MM-DD`で保存し、公開画面では実日付から曜日を計算して`YYYY.MM.DD(Day)`で表示します。解析不能な過去の保存値は画面に明示し、有効日付を入力するまでは別項目の保存で消さずに保持します。
- OpenとStartは別々に入力し、両方あれば`Open/Start: 18:30/19:00`、Startだけなら`Start: 19:00`と表示します。
- `ticket`はラベルを含めず料金・券種だけ、`notes`は`※`を含めず1補足1行、`performers`は本人を除く共演者を1組1行または`/`区切りで入力します。
- 公開表示は`ticket:`、`※`、`w. A / B`を自動で付けます。AI整理後も、原文と照合してから保存してください。
- 旧`description`は過去データ互換として保持され、構造化項目がすべて空のLiveだけで表示されます。

## 注意

- 画像ファイルアップロードはMVP範囲外です。画像は `tools/1212____HP/assets/images/` へ配置してパスを指定してください。
