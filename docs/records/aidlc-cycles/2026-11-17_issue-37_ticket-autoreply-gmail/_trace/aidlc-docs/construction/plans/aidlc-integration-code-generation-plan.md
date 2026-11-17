# Code Generation Plan — Gmailでticket予約の控えを届ける（Issue #37）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-17_issue-37_ticket-autoreply-gmail`
- Base Commit: `218e2103ecaca0893cb63a9f4d7393b48e0c9f76`
- Reader: human_reader / ja-JP / CotEditor（表示はFrontが担当）

公開予約の保存後に、Workerから合言葉付きのPOSTを送り、`1212ki.info@gmail.com`のApps Scriptで申込者宛＋同アカウントBCCの控えを送る。ticketの案内・注意文は項目ごと削除する。予約の成功条件・LINE・contact・入力項目・確認／完了画面の構成は維持する。

## 1. 変更するpathと実装順序

| path | 変更 |
|---|---|
| `docs/specs/current/live-operations-admin-ui.md`、`docs/specs/current/README.md` | §2の逐語差分をDraft→Approvedで反映するcurrent canonical |
| `cloudflare/worker/README.md`、`cloudflare/worker/wrangler.toml.example` | §2の設定契約を逐語反映 |
| `cloudflare/worker/apps-script/ticket-autoreply.gs`（新規） | §3の全文。Googleサービスを呼ぶのはこのscriptのみ |
| `cloudflare/worker/apps-script/README.md`（新規） | §4のOwner設定・確認・停止手順 |
| `cloudflare/worker/src/worker.js` | §5のform-encoded送信、応答確認、既定値と正規化。既存helperのexportも整合させる |
| `ticket/index.html`、`ticket/complete/index.html`、`assets/js/ticket.js` | §6の2文言項目の削除と完了既定文の変更 |
| `admin/index.html`、`admin/app.js` | §6の設定欄・既定値・正規化・event bindingの削除 |
| `cloudflare/worker/test/ticket-autoreply.test.js` | 既存送信testを新契約へ更新 |
| `cloudflare/worker/test/ticket-autoreply-apps-script.test.js`（新規） | Node VMで§3の実fileを直接読みGmail等をstubする |
| `cloudflare/worker/test/public-ticket-boundaries.test.js`、`cloudflare/worker/test/manual-ticket-reservations.test.js` | 公開予約の送信・失敗分離、手動取り置き非送信、旧文言の正規化を検証 |
| `test/public-ticket-routing.test.mjs`、`test/admin-live-operations.test.mjs` | HTML・DOM・admin設定・保存済み完了文・contact保持を検証 |
| `aidlc-docs/**` | state・audit・実装結果・検証結果・cycle summary。承認済み3文書のbytesは固定 |

実装順序はcanonical昇格→focused testのRED→最小実装→GREEN→全回帰→独立review→結果固定→確認2→close事前確認である。code/testはgate 1〜3の実承認と後続委任の確認後にのみ変更する。依存追加・migration・data/site-data.jsonの一括書換え・CSS変更は不要。

## 2. canonical本文の逐語差分とDraft→Approved

以下の「変更前→変更後」は改行を含めてそのまま置換する。追加節は、変更前の見出しを含む変更後ブロックで置き換える。ここにないcanonical本文を変更しない。

`docs/DOCS_RULES.md`のCurrent Specification Gateに従い、gate 1〜3承認後にLive設計の`- Status: Approved`を一時的に`- Status: Draft`へ、索引の該当行のStatusを一時的に`Draft`へ戻す。本文を以下の最終形へ反映し、gate 3の承認recordとexact差分一致・実装判断のopen questionなしを確認して、両方を`Approved`へ戻す。これは承認済み本文の反映であり、別のOwner確認を追加しない。途中のDraft状態ではdependent code/testを始めない。差分外の判断が必要なら新digestでgate 3へ戻る。今回canonical自体は未変更。

### 2.1 `docs/specs/current/live-operations-admin-ui.md`

変更前:
```text
- Last updated: 2026-11-16
- Related issues: #35, #33, #29
- Related implementation issues: #19, #20, #21, #22, #33, #35
- Owner approval: Issue #35のCode Generation Planに記載した本版の差分に対するItsuki Matsumotoのgate 3承認（本人回答`A`）。根拠はactive時の`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後の`docs/records/aidlc-cycles/2026-11-16_issue-35_openai-reasoning-speed/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`。本文反映後に承認済み差分との一致を検証する
```

変更後:
```text
- Last updated: 2026-11-17
- Related issues: #37, #35, #33, #29
- Related implementation issues: #19, #20, #21, #22, #33, #35, #37
- Owner approval: Issue #37のCode Generation Planに記載した本版の差分に対するItsuki Matsumotoのgate 3承認（本人回答`A`）。根拠はactive時の`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後の`docs/records/aidlc-cycles/2026-11-17_issue-37_ticket-autoreply-gmail/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`。本文反映後に承認済み差分との一致を検証する
- Prior Owner approval（Issue #35）: Issue #35のgate 3承認。根拠は`docs/records/aidlc-cycles/2026-11-16_issue-35_openai-reasoning-speed/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`
```

変更前:
```text
- Implementation gate: Issue #35はgate 1〜3の承認と、承認済みCode Generation PlanどおりのDraft→Approved反映を確認してから実装する。独立reviewは実装後に設計と実装をまとめて1回行い、gate 4〜5で結果を確認する。merge・production deployは別のOwner承認、本番の速度確認はdeploy後のOwner確認とする
```

変更後:
```text
- Implementation gate: Issue #37はgate 1〜3の承認と、承認済みCode Generation PlanどおりのDraft→Approved反映を確認してから実装する。独立reviewは実装後に設計と実装をまとめて1回行い、gate 4〜5で結果を確認する。merge・production deployは別のOwner承認。Apps Script作成・公開とsecret登録はOwnerが行い、本番のメール到達はdeploy後にOwnerが確認する
- Prior implementation gate（Issue #35）: Issue #35のgate 1〜5、実装・検証・独立reviewの記録は`docs/records/aidlc-cycles/2026-11-16_issue-35_openai-reasoning-speed/`を参照する。本番の速度確認はdeploy後のOwner確認とする
```

変更前:
```text
- Ticket Page設定への導線
```

変更後:
```text
- Ticket Page設定への導線、案内・注意文の項目削除とGmailによる予約控え（Issue #37）
```

変更前:
```text
| Ticket Page | `Live > Liveページ > Ticket Page共通設定` | 内部予約ページの説明・表示設定 |
```

変更後:
```text
| Ticket Page | `Live > Liveページ > Ticket Page共通設定` | 完了文と表示項目。操作案内文・自動返信注意文の設定は持たない |
```

変更前:
```text
## 6. 情報の優先順位
```

変更後:
```text
### 5.2 Ticket Pageと予約控え（Issue #37）

申込者の手元に予約の控えを残し、同じ控えを運営にも届ける。Ticket Pageの案内文`introText`と注意文`noticeText`は項目ごと削除する。公開HTML・JS、admin設定・既定値・正規化、Worker既定値・正規化から外し、旧D1値は読み込み時に除外する。移行SQLで削除しない。完了ページの静的既定文とWorker・adminの既定`completeText`は「予約しました。」とし、保存済み`completeText`は従来どおり表示する。desktop/mobileとも同じ項目を外し、入力・確認・完了の構成と既存の表示項目設定を維持する。contactは変更しない。

公開予約の保存成功後、Workerは`TICKET_AUTOREPLY_FORM_URL`に`application/x-www-form-urlencoded`で`receipt_id`・`live`（日付と会場）・`name`・`email`・`quantity`・`message`・`token`をPOSTする。合言葉は`TICKET_AUTOREPLY_TOKEN`から読みbodyだけに入れる。URLか合言葉が未設定ならskipする。Apps Scriptは`1212ki.info@gmail.com`が所有し、実行者を自分として公開する。Script Propertiesの`TICKET_AUTOREPLY_TOKEN`との一致、6項目の存在（備考のみ空可）、単一e-mail、1〜10枚、重複parameterなしを検証してからGmailで送る。

件名は「ticket予約の控え | 松本一樹」、差出人表示名は「松本一樹 ticket」。宛先は申込者、BCCは固定の`1212ki.info@gmail.com`。本文は受付ID・ライブ・名前・e-mail・枚数・備考を含み、備考空は「なし」。宛先・BCC・件名・本文の任意指定は受け付けない。Apps Scriptの逐語コードと本文は`cloudflare/worker/apps-script/ticket-autoreply.gs`、Owner設定手順は同directoryの`README.md`を参照する。

予約保存と通知は既存の`ctx.waitUntil`で分離する。Workerはredirectの既定追従後、HTTP成功かつJSONの`ok: true`を送信処理の成功とする。通信・HTTP・不正応答・Gmail失敗でも予約APIは201のまま。手動取り置き（`source: manual`）では送らず、LINE処理は変えない。自動再送・送信状態DB・外部送信サービス・DNS設定・`@1212hp.com`差出人は追加しない。

個人Gmailの1日100宛先にはBCCも含まれ、1予約2宛先なら最大50件／日（他の送信分で減る）。超過時はメール失敗、予約成功となる。個人Gmailアドレスは申込者に見える。合言葉漏洩時は任意の宛先への固定書式メールと送信枠消費が可能になるため、OwnerがWebアプリ公開を停止し、Script PropertiesとWorker secretを更新する。合言葉・予約情報・上流応答本文はログや公開APIへ出さない。

検証はfetch stub、Apps Script実fileを読むNode VMとGmail stub、旧値入りD1 stub、公開/adminのHTML・DOM testで行う。受入条件は、公開成功後の6項目＋合言葉POST、合言葉と必須値による送信制御・申込者＋BCC・本文6項目、送信失敗時の予約成功と手動非送信、旧文言の非表示と保存済み完了文保持、canonical整合と全回帰成功である。gate 1〜3とgate 4〜5を2回のOwner確認にまとめ、gate 3が逐語canonical差分の確認を兼ねる。独立reviewは実装後1回で設計と実装を確認する。

Google側のPOST後302と最終応答は未観測で、stubは実到達を証明しない。Apps Script公開・secret登録・deploy後、Ownerが申込者と`1212ki.info@gmail.com`の両方への到達・差出人・内容を確認するまで本番受入は未検証とする。設定と公開はOwner操作。送信停止はWorker URL secretの解除とWebアプリ公開停止、漏洩時は合言葉更新を行う。rollbackはIssue #37の承認差分だけを対象にし、予約データ・LINE・contactを戻さない。

関連Issueは#37、実装計画はactive時の`aidlc-docs/construction/plans/aidlc-integration-code-generation-plan.md`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-37_ticket-autoreply-gmail/`を参照する。

## 6. 情報の優先順位
```

変更前:
```text
- Issue #33 API・公開手順: `cloudflare/worker/README.md`「Live元情報のAI整理」
```

変更後:
```text
- Issue #33 API・公開手順: `cloudflare/worker/README.md`「Live元情報のAI整理」
- Issue #37 予約控えの実装計画と証拠: active時は`aidlc-docs/`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-37_ticket-autoreply-gmail/`
- Issue #37 Gmail送信: `cloudflare/worker/apps-script/ticket-autoreply.gs`
- Issue #37 Owner設定・確認・停止手順: `cloudflare/worker/apps-script/README.md`
```

### 2.2 `docs/specs/current/README.md`

変更前:
```text
| `live-operations-admin-ui.md` | Approved | Live運用のadmin UIと公開画面の対応。Issue #33のAI整理provider自動切替とIssue #35のOpenAI reasoning.effort=minimalを反映。Issue #35のgate 3承認を本文差分のOwner確認とし、#21の抽出内容と#29のshare URL契約を保持 |
```

変更後:
```text
| `live-operations-admin-ui.md` | Approved | Live運用のadmin UIと公開画面の対応。Issue #37のGmail予約控えとTicket Pageの案内・注意文削除を反映し、gate 3承認を本文差分のOwner確認とする。#21の抽出内容、#29のshare URL、#33のprovider自動切替、#35のOpenAI reasoning.effort=minimalを保持 |
```

### 2.3 `cloudflare/worker/README.md`

変更前:
```text
   - （任意）チケット予約の申込者向け自動返信
     - `wrangler secret put TICKET_AUTOREPLY_FORM_URL`
     - Formspreeなど、`FormData` のPOSTを受け付ける送信先URLを設定します
     - 未設定または送信失敗時も、予約APIの成功レスポンスは妨げません
```

変更後:
```text
   - （任意）チケット予約の控えをGmailで送信
     - Ownerが`1212ki.info@gmail.com`でApps Script Webアプリを作成・公開します。コードと設定・到達確認・停止手順は`apps-script/README.md`、送信コードは`apps-script/ticket-autoreply.gs`を参照してください
     - `wrangler secret put TICKET_AUTOREPLY_FORM_URL`（Webアプリの`/exec` URL。合言葉をqueryに含めない）
     - `wrangler secret put TICKET_AUTOREPLY_TOKEN`（Script Propertiesの同名項目と同じ合言葉）
     - Workerは`application/x-www-form-urlencoded`のbodyに`receipt_id`・`live`・`name`・`email`・`quantity`・`message`・`token`を入れてPOSTします。合言葉はheader・query・公開ブラウザへ渡しません
     - Apps Scriptは合言葉と項目を検証し、申込者へ控えを送って`1212ki.info@gmail.com`にBCCします。件名は「ticket予約の控え | 松本一樹」、表示名は「松本一樹 ticket」、本文には受付ID・ライブ・名前・e-mail・枚数・備考を入れます
     - URLまたは合言葉が未設定ならskipします。redirect追従後のHTTP成功かつJSON `ok: true`だけを送信処理の成功とします。通信・HTTP・応答・Gmailの失敗時も予約APIは201のままです。手動取り置きでは送信せず、LINE通知は変更しません
     - 個人Gmailは1日100宛先にBCCを含むため最大50予約／日（他の送信で減る）です。Gmailアドレスは申込者に見えます。302と最終応答・実到達は公開とdeploy後にOwnerが確認します
     - 合言葉漏洩時はWebアプリ公開を停止し、Script PropertiesとWorker secretを更新してください。合言葉・予約情報・上流応答本文をログへ出しません。本番操作とdeployはOwnerが行います
```

### 2.4 `cloudflare/worker/wrangler.toml.example`

変更前:
```text
# チケット予約の申込者向け自動返信（任意: FormspreeなどのPOST先）
# wrangler secret put TICKET_AUTOREPLY_FORM_URL
```

変更後:
```text
# チケット予約の控え（任意: 1212ki.info@gmail.com所有のApps Script Webアプリ）
# 設定・到達確認・停止手順: apps-script/README.md。値をこのfileへ書かない
# wrangler secret put TICKET_AUTOREPLY_FORM_URL
# wrangler secret put TICKET_AUTOREPLY_TOKEN
```

## 3. Apps Scriptの全文（新規fileにこのまま置く）

path: `cloudflare/worker/apps-script/ticket-autoreply.gs`。送信の成功はGmailAppが例外なく戻ることを指し、メールボックス到達の保証ではない。

```javascript
function ticketReplyResult_(ok) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var expected = PropertiesService.getScriptProperties()
      .getProperty("TICKET_AUTOREPLY_TOKEN");
    var type = String(e && e.postData && e.postData.type || "")
      .split(";")[0].trim().toLowerCase();
    if (!expected || type !== "application/x-www-form-urlencoded") {
      return ticketReplyResult_(false);
    }
    var p = e && e.parameter || {};
    var all = e && e.parameters || {};
    var keys = ["token", "receipt_id", "live", "name", "email", "quantity", "message"];
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (!Object.prototype.hasOwnProperty.call(p, key)
          || typeof p[key] !== "string"
          || !Array.isArray(all[key]) || all[key].length !== 1) {
        return ticketReplyResult_(false);
      }
    }
    if (p.token !== expected) return ticketReplyResult_(false);
    var receiptId = p.receipt_id.trim();
    var live = p.live.trim();
    var name = p.name.trim();
    var email = p.email.trim();
    var quantity = p.quantity.trim();
    var message = p.message.trim();
    if (!receiptId || !live || !name
        || /[\r\n]/.test(receiptId + live + name)
        || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)
        || !/^(?:[1-9]|10)$/.test(quantity)) {
      return ticketReplyResult_(false);
    }
    var body = [
      "ticket予約を受け付けました。",
      "",
      "受付ID: " + receiptId,
      "ライブ: " + live,
      "名前: " + name,
      "e-mail: " + email,
      "枚数: " + quantity,
      "備考: " + (message || "なし"),
      "",
      "当日はお気をつけてお越しください。"
    ].join("\n");
    GmailApp.sendEmail(email, "ticket予約の控え | 松本一樹", body, {
      name: "松本一樹 ticket",
      bcc: "1212ki.info@gmail.com"
    });
    return ticketReplyResult_(true);
  } catch (_error) {
    return ticketReplyResult_(false);
  }
}
```

不明な追加parameterは使わない。`to`・`bcc`・`subject`・`body`を渡されてもメールに反映しない。合言葉にtrimをかけず一致比較し、Ownerは前後空白のない値を双方へ設定する。GETは送信入口を持たせない。Apps Scriptにログ出力・再試行・別サービス呼出しを追加しない。

## 4. Owner用READMEに残す手順

新規`cloudflare/worker/apps-script/README.md`には、次をこの順に日本語で記載する。手順の例に実URL・実合言葉・予約個人情報を埋め込まない。

1. `1212ki.info@gmail.com`でGoogle Apps Scriptの新規projectを作り、§3のfile全文を貼る。別アカウント・別名義の差出人設定は使わない。
2. Project SettingsのScript Propertiesへ`TICKET_AUTOREPLY_TOKEN`を追加する。Ownerが十分に長い推測困難な合言葉を用意し、値はrepo・chat・URL・ログへ残さない。Workerと完全一致する値を使う。
3. DeployのNew deploymentでWeb appを選び、実行者を自分（`1212ki.info@gmail.com`）、アクセスを全員として公開し、OwnerがGmail送信権限を許可する。匿名アクセス可能な`/exec` URLを控える。`/dev`・ログイン画面のURLは使わない。Apps Scriptの表示や選択肢は実際のOwner画面で確認する。
4. Ownerが`cloudflare/worker`で`wrangler secret put TICKET_AUTOREPLY_FORM_URL`と`wrangler secret put TICKET_AUTOREPLY_TOKEN`を実行し、対話入力でURLと同じ合言葉を登録する。URLに合言葉を付けない。wrangler例の`[vars]`に値を置かない。secret操作は自動test・Workerが代行しない。
5. Owner承認済みのmerge・公開サイト反映・Worker deployを行う。Apps Scriptと両secretが揃うまで送信しない。更新したscriptの反映にはdeploymentのversion更新も必要となるので、更新後の`/exec`を確認する。
6. 公開フォームでOwner自身が使える申込者アドレスを指定して予約し、成功表示と予約台帳、申込者と`1212ki.info@gmail.com`の両方への到達、差出人Gmail・表示名・件名・本文6項目を確認する。保存済み完了文の表示も確認する。200だけ・送信済みフォルダだけを到達完了としない。迷惑メールも確認する。
7. POST後の302や最終JSONの実挙動は未確認。送信と応答が一致しない・届かない場合はFrontへ返し、再予約の連打で確認しない。stubの成功は実到達の代用にならない。1日100宛先（BCC含む）、最大50予約／日、超過時も予約成功、再送キューなしを説明する。
8. 停止する場合、OwnerがWorker URL secretを解除して新規依頼を止め、Webアプリdeploymentも無効化する。漏洩時は公開停止後、Script PropertiesとWorker secretを両方更新してから再公開する。URL secret解除だけでは既知のWebアプリへの第三者依頼を止められない。Gmailアドレスは申込者に見えることを明記する。

根拠URLはGoogle Web apps・quotas（auditのURL）とし、Frontの2026-11-17確認とWorkerによるlive未確認を区別する。外部メール送信サービスやDNSの手順を混在させない。

## 5. Workerの送信契約

`buildTicketAutoReplyText`とFormspree用`buildTicketAutoReplyFormData`は削除し、exportも削除する。代わりに`buildTicketAutoReplyPayload(reservation, token)`をexportし、`URLSearchParams`を返す。項目は以下の7つだけ。

| parameter | 元データと変換 |
|---|---|
| `token` | `TICKET_AUTOREPLY_TOKEN`。空白のみは未設定としてskip。送信値はtrimせず設定値そのもの |
| `receipt_id` | `String(reservation.id || "").trim()` |
| `live` | `liveDate`と`liveVenue`を各trimして半角spaceで連結し、全体trim（既存と同じ） |
| `name`、`email` | 各値を文字列化してtrim |
| `quantity` | 枚数を文字列化（APIで1〜10を検証済み） |
| `message` | 文字列化してtrim、空でもキーを送る |

`sendTicketAutoReply`はURLをtrimし、URLか合言葉が空白のみなら既存の`{ skipped: true, reason: "not configured" }`を返してfetchしない。`source: manual`は防御的にもskipする（公開API以外から呼ばれても送信しない）。POST headersは`Accept: application/json`と`Content-Type: application/x-www-form-urlencoded;charset=UTF-8`、bodyは上記URLSearchParams。予約情報・合言葉をURLへ結合しない。redirect optionは追加せずfetchの既定追従を使う。

fetchのnetwork例外、HTTP非2xx、JSON解析失敗、`ok !== true`は固定エラー`ticket auto-reply failed`にする。HTTP失敗のみstatusの数字を付けてよい。上流body・URL・parameter・元の例外messageを結果やログへ含めない。成功は`{ ok: true }`。`notifyTicketAutoReply`は失敗を固定の`{ ok: false, error: "ticket auto-reply failed" }`へ変換する。通知を公開API responseへ足さない。

`/api/public/ticket-reservations`の保存・validation・honeypot・重複拒否・`Promise.all`と`ctx.waitUntil`・成功201は変更しない。manualの呼出経路を通知へ接続しない。LINEのhelper・呼出し・設定を変更しない。再試行・送信状態DB・別サービスfallbackを追加しない。

## 6. 文言項目を削除する実装

- `ticket/index.html`: `#ticket-intro`と`#ticket-notice`の`p`要素を丸ごと削除する。代替の説明文を追加しない。
- `assets/js/ticket.js`: `renderTicketCopy`定義と呼出しを削除する。古いAPI payloadに2キーがあっても読まない。入力項目・routing・確認modalは変更しない。
- `ticket/complete/index.html`: `#ticket-complete-message`の静的本文を「予約しました。」へ変更する。receipt cardとlinksは維持する。`assets/js/ticket-complete.js`は保存済み`completeText`を表示できるので変更不要。
- `admin/index.html`: `#ticket-intro-text`と`#ticket-notice-text`それぞれのlabelを含む`form-group`を削除する。完了文と表示項目の設定は維持する。
- `admin/app.js`: ticketのDEFAULTから2キーを外し、`completeText`の既定値を「予約しました。」にする。ticket正規化で2キーを埋める行を`delete normalized.ticket.introText;`と`delete normalized.ticket.noticeText;`へ置換する。`renderTicketSettings`の2要素参照と2つのbinding blockを削除する。contactの同名`introText`には触れない。
- `cloudflare/worker/src/worker.js`: `DEFAULT_SITE_DATA.ticket`の2キーを外し、`completeText`を「予約しました。」にする。`normalizeSiteData`の2つのfallback代入を`delete data.ticket.introText;`と`delete data.ticket.noticeText;`へ置換する。既存`completeText`のfallback・他のfieldsとcontactは維持する。公開・管理のread/saveが同じ正規化を通り、旧D1値はresponseや次回保存へ再混入しない。

D1の既存rowをこの変更のために書換えない。`completeText`が空・未設定なら新既定値、値があるなら既存どおり表示する。古い保存済み完了文自体を検索置換しない。desktop/mobileとも同じHTML要素を削除するため別layout・CSSは不要。

## 7. focused testを先にRED、最小実装でGREEN

Node v20.19.4を使用し、実API・secret・D1へ接続しない。fixtureは架空の予約とテスト専用の固定文字列を使う。既存assertionを削って成功を作らない。

| 順序 | testと観測 |
|---|---|
| 1 | `ticket-autoreply.test.js`を新payload helperとfetch stubへ更新。7キーだけ、URLSearchParams、content type、queryに合言葉なし、備考空、日本語・改行・`&+`のround trip、trim、URL/合言葉の各未設定、manual skip、HTTP/network/JSON/`ok:false`失敗の無害化を検証する |
| 2 | 新規`ticket-autoreply-apps-script.test.js`で`readFileSync(new URL("../apps-script/ticket-autoreply.gs", import.meta.url))`を読み`vm.runInNewContext`する。`PropertiesService`・`ContentService`・`GmailApp`をstub。正常時は送信1回、宛先・BCC・表示名・固定件名・本文6項目が完全一致。不一致token、token未設定、各キー欠落、空の必須値、複数parameter、MIME不正、単一でないe-mail、CRLF、枚数0/11/小数で送信0回。備考空は「なし」。Gmail例外は`ok:false`、任意bcc/subject/bodyの追加は無視する |
| 3 | `public-ticket-boundaries.test.js`へ保存成功後の1回POSTと本文値、両secretありの通知失敗でも201・insert1回を追加。既存のwaitUntil故障testのenvにも合言葉を加え、メール経路を実際に通す。旧値入りD1 stubで公開site-dataのticket2キー欠落、既定完了文／保存完了文保持、contact保持も検証する |
| 4 | `manual-ticket-reservations.test.js`のURL設定fixtureすべてに合言葉も追加する。手動送信禁止testは両secret有効でも送信0回。既存`explicit-empty internal reservation remains web and public notifications still run`は公開payloadの`source: manual`が保存結果では`web`となり、メールとLINEの両通知が引き続き走ることを保つ。公開予約の不正・honeypot・重複拒否は送信0回を既存stubで確認する |
| 5 | `public-ticket-routing.test.mjs`で静的HTMLに2要素なし・既定完了文一致、旧payloadを渡しても2文言を描画しないことを既存VMで検証する。DOM fixtureは削除後のHTMLに合わせる。保存済み完了文がそのまま表示され、receiptやrouting・confirmが変わらないことも確認する |
| 6 | `admin-live-operations.test.mjs`で2設定欄の不存在、旧ticket2キーが正規化・保存から落ちること、完了文と表示項目の編集維持、contactが変わらないことを既存VMで確認する |
| 7: RED | production未変更で下記focused群を実行し、新contractの不足により失敗することを記録する。新helper・新gsがまだない失敗はその不足を明記し、既存helperを通るwire assertionや旧HTML・旧正規化へのassertionも挙動差で失敗することを確認する。単なるsyntax/fixture破損だけをREDとしない |
| 8: 実装 | §3・§5・§6だけを実装する。§2のApproved反映済みと後続packetのwrite権限を確認してから行う |
| 9: GREEN | 同じfocused群を再実行しfailure/cancelled 0を記録する。失敗は原因を調べ修理し、仕様変更が必要なら承認へ戻る |

```bash
export PATH="/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH"
node --version
node --test cloudflare/worker/test/ticket-autoreply.test.js cloudflare/worker/test/ticket-autoreply-apps-script.test.js cloudflare/worker/test/public-ticket-boundaries.test.js cloudflare/worker/test/manual-ticket-reservations.test.js
node --test test/public-ticket-routing.test.mjs test/admin-live-operations.test.mjs
```

Apps Script VMはeventの`parameter`と`parameters`を両方作る。Googleの認可・実行者・送信枠・redirectをstubで証明した扱いにしない。

## 8. 全回帰と独立review

repository rootで次を実行する。v24.4.1のdirectory引数による失敗は既知なので使わない。依存は既存node_modulesを使い、install・fetchは行わない。

```bash
export PATH="/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:$PATH"
node --version
node --test test/
npm --prefix cloudflare/worker test
node --check cloudflare/worker/src/worker.js
node --check assets/js/ticket.js
node --check admin/app.js
scripts/aidlc-verify.sh --local
scripts/aidlc-cycle.sh status
git diff --check
git status --short
git diff --stat
```

期待値は`v20.19.4`、全testのfailure/cancelled 0・予期しないskipなし、syntax/integrity/diffのexit 0、§1の範囲だけの変更。Front確認baselineはroot 239/239・Worker 271/271であり、今回のWorkerによる再実行結果ではない。新規test数を含め、実際の件数とexit codeを結果へ書く。Apps ScriptはVM testで構文・挙動を確認する。

Frontが独立read-only Reviewerを1回手配し、R1〜R7／AC-37-01〜06、逐語canonical差分、Apps Scriptの認証・宛先・送信内容、失敗分離、旧文言・保存完了文・contact、RED→GREENと全回帰をまとめて確認する。Ownerによる本番確認未実施を保持する。blocking findingは修理と必要な再検証・再確認後に解消する。Worker自己検証は独立reviewを兼ねない。

## 9. 結果固定とclose前の使い捨て検証

gate 4候補は`aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md`、gate 5候補は`aidlc-docs/construction/build-and-test/build-and-test-summary.md`。独立reviewと修理反映後にbytesを固定し、Frontが確認2で両stageと両digestを提示する。承認後の書式修正でも再承認が必要になる。

Build/Test Resultと`aidlc-docs/cycle-summary.md`には、実際にblocking findingを解消してから次のfield行を各1回記載する。見出しと本文に分割しない。

```markdown
- **Blocking Findings**: None
```

AC-37-05は結果とsummaryに「Apps Script公開・secret登録・deploy後のOwner到達確認待ち」と残す。`None`やcycle closeを本番到達の証明にしない。実装、自動検証、独立review、Owner gate判断、Front受入、本番到達は別signalとする。

実際の5承認record・fresh digest・review解決・Front受入が揃ってから、stateの`Cycle Status`と`Current Stage`を`Complete`、`Approval Gate`を`None`、`Approval Status`を`Complete`へ揃える。承認済みplanのchecked行は変更しない。未回答・未チェックのrequired work・不一致を残してcloseしない。

正式close前に使い捨てcopyで`validate_close_ready`を事前確認する。後続packetで許可されたscratchへ`scripts/aidlc-cycle.sh`の先頭からdispatch直前までをcopyし、末尾に`validate_close_ready`呼出しだけを付ける。切り出し境界は `command="${1:-}"` の行。`AIDLC_REPO_ROOT`を本worktreeの絶対pathに設定してbashで実行する。実artifactと元のabsolute bindingをread-onlyで検証し、`command_close`・archive・idle交換を呼ばない。approvalの仮造・path書換えでPASSを作らない。使い捨てcopyそのもののpathを後続packetで明示許可する。今回はこのcopy・事前validator・closeを実行しない。

事前確認のexit 0、同時点の5 artifact digest、4 state値、2つのBlocking Findings field、未チェック行なしを照合する。失敗時はstate/summary等を修理し、承認済みbytesを直す場合は新digestでOwner再承認する。正式closeはFrontのcompletion gateに従う。

### 後続packetに明記するclose/verifyのwrite先

`scripts/aidlc-cycle.sh`・`scripts/aidlc-verify.sh`を直接読んで確認したpathである。後続packetはarchive・一時path・使い捨てcopyを漏れなく許可し、Workerが直接一時pathへ書く許可とは分ける。

| 処理 | write path |
|---|---|
| active evidence | `<worktree>/aidlc-docs/**`（resume時の`.audit-resume.XXXXXX`を含む） |
| close stage | `<worktree>/docs/records/aidlc-cycles/.aidlc-stage-<cycle-id>.XXXXXX/**`。trace copy・README・identity・source digest・manifestを作り、finalへrenameする |
| close final | `<worktree>/docs/records/aidlc-cycles/2026-11-17_issue-37_ticket-autoreply-gmail/**` |
| idle prepare | `<worktree>/.aidlc-idle-<cycle-id>.XXXXXX/**` |
| active recovery | `<worktree>/.aidlc-recovery-<cycle-id>.<pid>/**`。activeをrenameし、idle交換失敗時に復旧する |
| archive verification | `/private/tmp/aidlc-archive-verify.XXXXXX/**`。scriptが作って消す |
| source verification | `/private/tmp/aidlc-source-verify.XXXXXX/**`。scriptが作って消す。`--source`はnetworkを使うため、今回とnetwork禁止packetでは実行不可 |
| pre-close validation | 後続packetで明示するscratch内の使い捨てvalidator copy。実artifactを読むだけ |

closeの最終archiveとtemporary siblingsは同一filesystemが必要。scriptが行うsafe cleanupを含む権限を後続packetで用意する。今回許可された一時pathを将来のclose全体の許可と解釈しない。

## 10. 本番確認とrollback

Ownerが§4を実施してからAC-37-05を確認する。届かない場合でも予約が保存されていることを台帳で確認し、実到達を未達としてFrontへ返す。送信枠・認可・redirect・受信側の原因をstubだけで断定しない。

送信停止の最小操作はWorker URL secret解除とWebアプリdeployment無効化。漏洩時は両側の合言葉を更新する。codeのrollbackはIssue #37の承認差分だけを対象とし、旧UIの自動返信言及が再表示され得ることをOwner判断に含める。予約データ・既存completeText・LINE・contact・他Issueの変更を戻さない。本番rollback・merge・deployはOwner判断とする。
