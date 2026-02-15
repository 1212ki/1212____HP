# LINE通知（チケット予約）設定まとめ

このホームページでは、チケット予約（`POST /api/public/ticket-reservations`）が作成されたタイミングで、Cloudflare Workerが非同期に通知を送ります。

実装箇所: `tools/1212____HP/cloudflare/worker/src/worker.js`

## 1. 通知の方式（どちらかでOK）

### 方式A: LINE Messaging API の push（推奨）
LINEの公式APIで、指定した相手（ユーザーID / グループID / ルームID）にテキストをpushします。

必要なWorker Secret（必須）:
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_TO`

### 方式B: 任意Webhook（Slack互換などでも可）
指定したURLにJSONをPOSTします（LINEに直接送る用途ではなく「自分の受け口」を作れる方式）。

必要なWorker Secret（必須）:
- `LINE_WEBHOOK_URL`

注:
- 方式A/Bは併用も可能です（両方設定すると両方送ります）。
- どちらも未設定の場合、通知は「スキップ」されます（予約処理自体は成功します）。

## 2. Cloudflare Worker 側の設定（共通）

前提:
- Workerプロジェクト: `tools/1212____HP/cloudflare/worker`
- すでに `wrangler.toml` にcronが入っています（X予約投稿用。LINE通知には必須ではありません）。

設定コマンド（PowerShell想定）:
```powershell
cd tools/1212____HP/cloudflare/worker
```

以降の `wrangler secret put ...` は「Workerに秘密情報を登録」します（gitにはコミットしません）。

## 3. 方式A（Messaging API push）の設定手順

### 3-1. LINE Developers 側で用意するもの
1. LINE DevelopersでProviderを作成
2. Messaging APIチャネルを作成
3. チャネルの「Messaging API」設定を有効化
4. **Channel access token（Long-lived）** を発行

この値が `LINE_CHANNEL_ACCESS_TOKEN` です。

### 3-2. 通知先ID（LINE_TO）を用意する
`LINE_TO` には以下のいずれかを入れます。
- 1人に送りたい: `userId`
- グループに送りたい: `groupId`（Botをグループに参加させた上で）
- ルームに送りたい: `roomId`

重要:
- push通知をユーザーに送るには、通常「ユーザーがBotを友だち追加済み」である必要があります。
- `userId/groupId/roomId` は、LINE側のWebhookイベント（ユーザーがメッセージ送信等した時）から取得するのが一般的です。

メモ:
- いったん自分でBotを友だち追加して、何かメッセージを送ってWebhook受信ログから `userId` を取るのが最短です。
- 受信Webhookの受け口をこのWorkerに作っていない場合は、一時的に別の受信先（RequestBin等）を用意するか、必要ならこのWorkerに受信エンドポイントを追加します。

### 3-3. Secret登録
```powershell
cd tools/1212____HP/cloudflare/worker

# Messaging API push（推奨）
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put LINE_TO
```

入力プロンプトが出るので、それぞれ貼り付けてEnterします。

### 3-4. デプロイ
```powershell
cd tools/1212____HP/cloudflare/worker
npx wrangler deploy
```

## 4. 方式B（任意Webhook）の設定手順

### 4-1. 送信先URL（LINE_WEBHOOK_URL）を用意する
例:
- 自分用のサーバー/Cloudflare Worker/Google Apps Script等
- Slack Incoming Webhookのような「受け取りURL」

Workerは以下を `POST` します:
- `Content-Type: application/json`
- body（例）:
  - `text`: 通知テキスト
  - `reservation`: 予約データ（id/live/name/email/quantity/message...）

### 4-2. Secret登録
```powershell
cd tools/1212____HP/cloudflare/worker
npx wrangler secret put LINE_WEBHOOK_URL
```

### 4-3. デプロイ
```powershell
cd tools/1212____HP/cloudflare/worker
npx wrangler deploy
```

## 5. 動作確認

注意:
- ticketページの `?dryRun=1` は「APIに送信しない」ため、LINE通知も飛びません。

確認方法:
1. 公開サイトの `ticket/` から通常通り予約を1件送信する（本当にD1に1件入ります）
2. LINEに通知が来ることを確認

## 6. いまWorkerが参照する設定キー（一覧）

Secret（推奨: `wrangler secret put` で登録）:
- `ADMIN_SHARED_TOKEN`（管理API認証）
- `X_CONSUMER_KEY` / `X_CONSUMER_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET`（X投稿）
- `LINE_CHANNEL_ACCESS_TOKEN`（方式A）
- `LINE_TO`（方式A）
- `LINE_WEBHOOK_URL`（方式B）

Vars（`wrangler.toml` の `[vars]`）:
- `ALLOWED_ORIGINS`
- `BYPASS_ADMIN_TOKEN`
- `X_DEFAULT_HASHTAGS`

