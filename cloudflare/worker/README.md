# 1212 Homepage Cloudflare Worker

管理画面と公開サイト向けのAPI、およびX自動投稿を担当するWorkerです。

※現在の推奨運用は「管理画面 → Web Intentで半自動投稿（X APIを使わない）＋OGPリンクカード」です。X APIを使うエンドポイントは将来拡張として残しています。


## 作品データの追加項目（Issue #41）

`site_data`のJSON内に`site.featuredReleaseId`、`discography.digital[*] / demo[*]`の`playbackVideoId`と`releaseType`を保存します。3項目は任意のstringで、欠落・null・他型は空に補います。参照は作品／映像のidで持ち、全カテゴリ確定後に消えた参照を空へ戻します。カテゴリ移動はid不変なら参照を保ちます。種別の文字列はtrim・分割しません。

公開GETは既存の`data / meta` envelopeと3項目を返し、Liveの`sourceText / xComment`は公開しません。読込時の正規化・参照解除はメモリ内だけで、既存行の修復書込は行いません。既存の空行初期化は維持します。共有画像の`site.heroImage`とLive画像優先のOG契約は変更していません。

管理PUTは、副作用のないSELECTで保存前JSONを読み、新規作品または日付変更作品だけを検査してから書き込みます。リリース日は空またはASCII数字の`YYYY.MM.DD`完全一致（10文字）です。実在日の検査は行いません。日付未変更の旧文字列・旧非文字列は保持できます。違反はHTTP 400、`error: "invalid releaseDate"`と`fields`（`id`、`field: "releaseDate"`、`message: "「2025.05.05」の形で入力してください。"`）を返し、DBには書きません。既存のLive ID重複エラーの応答形は維持します。

旧adminのPUTで新keyが省略された場合だけ、保存前JSONの同じ作品idを全カテゴリから探して補います。明示空・null等による解除は尊重します。省略された作品やcollectionを復活させることはありません。保存前行がなければ空を比較元にし、読取失敗・JSON解析失敗なら書込を止めます。解析不能は固定の`invalid stored site data`（400）、DB故障は既存の500経路です。

### #41の反映順序・rollback

公開サイトとadminはGitHub Pagesの`main`配信です。Ownerが試験済みPR最終revisionからWorkerを先にdeployし、Frontの公開GET・OG確認後にmergeします。Pagesの新revision配信確認後にOwnerが管理タブを再読込し、実際に使う1作品の3項目を保存します。Frontが公開GETの値と公開表示を照合します。DB migration・新secret・既存JSON一括更新は不要です。既存AI整理や予約機能の反映手順は各機能の履歴として保持します。

deploy失敗・merge前の不具合・merge見送りは、OwnerがFrontの特定した直前Worker versionへrollbackします。merge後は保存を停止し、#41を戻すPRをOwnerが承認・merge、旧admin配信確認後にWorkerを戻します。Worker障害で先に戻す場合も静的側復旧まで保存を再開しません。旧adminで作品を編集すると新keyが落ちるため、rollback中は作品編集を止めます。通常復旧はcode rollbackで行い、D1全体の復元は実データ破損時の別判断です。詳細は本cycleのCode Generation Plan §8・§9を参照してください。

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

> AI整理の現在の設計は`docs/specs/current/live-operations-admin-ui.md`を正本とします。Issue #33のprovider自動切替を保持し、Issue #35ではOpenAIの考える量だけを最小にします。実装・検証・承認・本番反映の状態は各cycleの記録で区別します。

`POST /api/admin/live-source-intake`は、管理画面で貼り付けたLiveの元情報をOpenAI Responses APIで先に整理し、OpenAI側の失敗時は同じ`sourceText`でClaude（Anthropic Messages API）へ切り替えます。既存の管理APIと同じBearer認証が必要です。

- Request: `{ "sourceText": "..." }`
  - `sourceText`はtrim後1〜12,000文字です。範囲外は`400`を返します。
- 成功応答: `{ "draft": { ... }, "provider": "openai" }`または`provider: "claude"`
  - `draft`は`date`、`title`、`venue`、`openTime`、`startTime`、`ticket`、`notes`、`performers`、`ticketUrl`、`link`の10項目です。
  - `date`は`YYYY-MM-DD`、時刻は24時間の`HH:mm`です。不明な項目は空文字になります。
  - `notes`は`※`なしの1補足1行、`performers`は松本一樹／1212本人を除いた共演者だけを`w.`なしの` / `区切りで返します。共演者がいなければ空文字です。`description`は生成しません。
  - `provider`はtop-levelの`openai`／`claude`だけで、10項目schemaやLiveの保存データ・公開画面には追加しません。失敗応答にはprovider、モデル名、失敗履歴を含めません。
- 新adminは旧Workerの`{ "draft": { ... } }`も受理し、providerを推定せず「AIで整理しました。内容を確認してから更新してください。」と表示します。provider付き応答は上記enumだけを受理し、未知の値・型・余分なtop-level keyを拒否します。
- 成功したproviderは既存の小さいstatus欄へ「OpenAIで整理しました。内容を確認してから更新してください。」または「Claudeで整理しました。内容を確認してから更新してください。」と固定文言で表示します。Claude表示はOpenAIのクレジット切れの確定診断には使いません。
- 抽出指示`LIVE_AI_INSTRUCTIONS`、10項目schema`LIVE_AI_OUTPUT_SCHEMA`、`validateLiveAiDraft`は両社共通で、既存の内容・検証制約を保持します。合格した10項目（空文字を含む）とpreviewだけを一括更新し、AI整理では保存・公開・X送信・DB更新を行いません。

### providerの順序と切替条件

| 設定されたsecret | 動作 |
|---|---|
| `OPENAI_API_KEY`と`ANTHROPIC_API_KEY` | OpenAIを1回。検証済みdraftなら終了し、失敗時だけClaudeを1回 |
| `OPENAI_API_KEY`だけ | OpenAIを1回だけ |
| `ANTHROPIC_API_KEY`だけ | Claudeを1回だけ |
| 両方なし・空・空白のみ | 外部APIを呼ばず503 |

OpenAIの認証・クレジット切れ・rate limitを含む全HTTP非2xx、通信失敗、timeout、refusal、incomplete、空出力、上流／抽出JSON不正、schema不正、validator不合格をすべて切替対象にします。HTTP 200だけでは成功としません。管理認証・入力の検証はprovider呼出し前に行い、401／400の場合は2社とも呼びません。

各provider最大1回、合計最大2回で、両社には最初にtrimした同じ元情報だけを送ります。失敗状態を記憶せず、次の整理でもOpenAIから始めます。残高照会、同一providerのretry、providerの手動切替UIやSDK依存は追加しません。

### secretとモデル

| provider | Worker secret | 任意のWorker変数 | 未設定・空白時の既定モデル | requestで指定する考える量 |
|---|---|---|---|---|
| OpenAI | `OPENAI_API_KEY` | `LIVE_AI_MODEL` | `gpt-5-mini` | `reasoning.effort: "minimal"` |
| Claude | `ANTHROPIC_API_KEY` | `LIVE_AI_CLAUDE_MODEL` | `claude-haiku-5-5` | `output_config.effort: "low"` |

管理者が画面で待つ操作で、元情報から10項目を抽出する処理のため、OpenAIの考える量を`minimal`（最小）に固定する。既定モデル・抽出指示・schema・validator・provider順・各15秒／全体30秒の期限・エラー分類・画面表示は変更しない。`LIVE_AI_MODEL`で上書きしたモデルにも同じ指定を送り、非対応モデルがHTTP 400を返した場合は既存の失敗時切替を使う。Claudeが設定され利用可能ならClaudeの結果を返し、Claude未設定なら既存の失敗応答になる。

両APIキーはWorker secretとしてのみ設定し、コード、HTML、ブラウザ側JavaScript、レスポンスへ置かないでください。既存の`LIVE_AI_MODEL`はOpenAI専用のままです。モデル選択UIは追加しません。本番secret操作とdeployはOwnerの明示承認後に行います。

### 期限と固定エラー

入力検証後のprovider処理開始から、fetch・body受信・JSON解析・draft検証を含め全体30,000 msです。各providerは最大15,000 msで、Claudeは全体の残り時間との小さい方を使います。単一keyでも最大15秒で、切替時に全体期限をリセットしません。期限到達時はabortし、body停止・abort非協調でも待機を打ち切り、期限後の成功を採用しません。

既存OpenAIの15秒枠を保ち、切替先にも同程度の枠を与える配分です。Worker内の処理予算であり、ブラウザとの通信時間・upload・event loop停止を含む厳密な30秒保証ではありません。実API速度・初回schema compilationの成功率は未計測です。

| 条件 | HTTP | 固定の`error` |
|---|---:|---|
| 管理認証失敗 | 401 | `unauthorized` |
| JSONまたは`sourceText`不正 | 400 | `invalid sourceText` |
| 両key未設定 | 503 | `AI source intake is not configured` |
| 全体期限到達、または最終providerのtimeout | 504 | `AI source intake timed out` |
| 全provider失敗で、上記timeout以外 | 502 | `AI source intake failed` |

OpenAI timeout→Claude成功は200、→Claude HTTP失敗などは502、→Claudeもtimeoutなら504です。単一providerも同じ分類です。providerのレスポンス本文、request ID、APIキー、プロンプトをクライアントへ返さず、新たなrawログへ出力しません。

失敗・payload不正・反映例外では管理画面の10項目・preview・元情報を保持します。待機中の入力変更、別Liveへの移動、逆順応答も既存snapshot／editor ownershipで扱い、古い応答やprovider成功を反映しません。API接続先のfallbackは追加せず、`allowBaseFallback: false`を維持します。

### Owner向けの公開順序とrollback

1. 新adminを先に公開します。
2. 既存adminタブを再読込し、新adminが読み込まれたことと、旧Workerの`draft`だけの応答を受理できることを確認します。
3. その後に新Workerを公開します。

旧adminはprovider付き応答を拒否するため、Workerの先行公開や旧JavaScriptを保持したタブでは整理結果を適用できません。rollbackはWorkerを旧応答へ戻してから、必要に応じてadminを戻します。これらの本番操作は別途Ownerが行います。

公開LiveのOG titleは日付を`YYYY.MM.DD(Day)`へ正規化し、OG descriptionはOpen/Start、ticket、補足、共演者の構造化項目から組み立てます。構造化項目がすべて空の過去Liveだけ、旧`description`へフォールバックします。

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
   - （任意）チケット予約の控えをGmailで送信
     - Ownerが`1212ki.info@gmail.com`でApps Script Webアプリを作成・公開します。コードと設定・到達確認・停止手順は`apps-script/README.md`、送信コードは`apps-script/ticket-autoreply.gs`を参照してください
     - `wrangler secret put TICKET_AUTOREPLY_FORM_URL`（Webアプリの`/exec` URL。合言葉をqueryに含めない）
     - `wrangler secret put TICKET_AUTOREPLY_TOKEN`（Script Propertiesの同名項目と同じ合言葉）
     - Workerは`application/x-www-form-urlencoded`のbodyに`receipt_id`・`live`・`name`・`email`・`quantity`・`message`・`token`を入れてPOSTします。合言葉はheader・query・公開ブラウザへ渡しません
     - Apps Scriptは合言葉と項目を検証し、申込者へ控えを送って`1212ki.info@gmail.com`にBCCします。件名は「ticket予約の控え | 松本一樹」、表示名は「松本一樹 ticket」、本文には受付ID・ライブ・名前・e-mail・枚数・備考を入れます
     - URLまたは合言葉が未設定ならskipします。redirect追従後のHTTP成功かつJSON `ok: true`だけを送信処理の成功とします。通信・HTTP・応答・Gmailの失敗時も予約APIは201のままです。手動取り置きでは送信せず、LINE通知は変更しません
     - 個人Gmailは1日100宛先にBCCを含むため最大50予約／日（他の送信で減る）です。Gmailアドレスは申込者に見えます。302と最終応答・実到達は公開とdeploy後にOwnerが確認します
     - 合言葉漏洩時はWebアプリ公開を停止し、Script PropertiesとWorker secretを更新してください。合言葉・予約情報・上流応答本文をログへ出しません。本番操作とdeployはOwnerが行います
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
