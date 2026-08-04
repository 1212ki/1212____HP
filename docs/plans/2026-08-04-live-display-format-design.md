# Live表示フォーマット構造化 Design

## Scope

管理画面のLive編集、元情報のAI整理、公開Live一覧・詳細、チケット予約画面・予約完了画面、X返信用テキスト、Workerに残るX API fallbackを、同じ構造化データと表示ルールへ揃える。チケット予約先URL、予約台帳、X親投稿の既存仕様は維持する。

## 変わること

### 保存データ

Live項目に次の文字列フィールドを追加する。

| field | 保存形式 | 空欄時 |
|---|---|---|
| `date` | 新規・更新値は`YYYY-MM-DD`。解析不能な既存値は有効日付へ置換するまで原文保持 | 日付なし |
| `openTime` | `HH:mm` | Open行を省略 |
| `startTime` | `HH:mm` | Start行を省略 |
| `ticket` | 料金・券種の本文。ラベルなし | ticket行を省略 |
| `notes` | 1補足1行。`※`なしで保存 | 補足行を省略 |
| `performers` | ` / ` 区切り | 共演者行を省略 |

`title`、`venue`、`ticketUrl`、`link`、`sourceText`、`reservationClosed`、`xComment`は既存どおり保持する。`description`は過去データ互換のため削除しないが、新規入力の主項目にはしない。

### 表示

日付は保存値や過去データの区切り・曜日表記にかかわらず、実日付から曜日を再計算して `YYYY.MM.DD(Day)` と表示する。曜日は `Sun / Mon / Tue / Wed / Thu / Fri / Sat` とする。不正または解析不能な日付は、情報欠落を避けるため元文字列をそのまま表示する。

詳細は次の順序で組み立てる。

```text
Open/Start: 18:30/19:00
ticket: ¥2,500 + 1D
※再入場不可
w. 共演者A / 共演者B
```

- OpenとStartがある: `Open/Start: {openTime}/{startTime}`
- Startだけがある: `Start: {startTime}`
- Openだけがある: `Open: {openTime}`
- ticketがある: `ticket: {ticket}`
- notesは各行の先頭をちょうど1つの`※`に揃える
- performersがある: `w. {performers}`。複数名は1行の` / `区切り。保存値に残った明示ラベル`w.`と`w/`だけを正規化時に除く。`With Confidence`等、`with`で始まる固有名詞はそのまま保持する
- 構造化項目がすべて空の場合だけ、既存`description`を従来どおり表示する

同じformatterを公開一覧、Live詳細、モーダル、チケット予約画面の選択肢・選択Live preview、予約完了画面、X返信用テキストで共有し、表示面ごとの表記揺れを防ぐ。公開一覧の短縮表示はformatter出力の先頭2行を使う。WorkerのOGとX API fallbackは、同じ契約をserver-side formatterで再現する。

### 管理画面

- 日付を`type=date`で入力する。
- OpenとStartをそれぞれ`type=time`で入力する。
- ticket、notes、performersを別々に入力する。
- performersは管理画面で改行または`/`区切りを受け付け、保存時に` / `へ正規化する。
- notesは1補足1行で入力し、表示側が`※`を付ける。
- 過去Liveを開く際は、既存日付をISOへ正規化してdate inputへ表示する。
- 解析不能な既存日付は元値を明示し、date inputを変更しない保存では元値を保持する。有効な日付を入力した場合だけ`YYYY-MM-DD`へ置換する。
- 構造化項目がない過去Liveの`description`は「旧詳細」として確認・保持できるようにし、保存で消さない。

### AI整理

Workerのstrict Structured Outputsは次の10文字列項目を必須keyとして返す。

```text
date, title, venue, openTime, startTime,
ticket, notes, performers, ticketUrl, link
```

- 不明な値は空文字とし、原文にない内容を補完しない。
- dateは`YYYY-MM-DD`、時刻は`HH:mm`。
- notesは1補足1行、先頭の`※`なし。
- performersは松本一樹／1212本人を除いた共演者だけを` / `区切りにし、共演者がいなければ空文字にする。`w.`等の表示ラベルは含めない。
- AIが返した非空項目だけ管理フォームへ反映する。
- 元情報は変更せず、自動保存・自動公開もしない。
- `description`への自由文生成は廃止する。

## 変わらないこと

- `ticketUrl`があれば予約ボタンは外部URLへ遷移し、空なら1212HP内予約を使う。
- AI整理は認証済みAPI Mode限定で、OpenAI keyはWorker secretのまま扱う。
- X親投稿はオーナーコメント・`#ライブ`・Live詳細URLの構成を維持する。
- 既存のLive ID、予約台帳、過去/今後カテゴリ、画像、詳細/SNSリンクは維持する。

## State / authority

構造化Liveデータの正本は既存site data JSONであり、公開APIは`sourceText`と`xComment`だけを除外して構造化項目を公開する。AI出力は下書きであり、保存のauthorityは管理画面を操作するItsukiに残る。production deployとmergeはowner-onlyとする。

## Failure / rollback

- AIレスポンスがschema、日付、時刻、URL、長さの検証に失敗した場合は全項目を不変にする。
- 入力中にフォームが変更された場合はAI結果を反映しない。
- 新formatterに構造化項目がなければ`description`へフォールバックする。
- 解析不能な既存dateは、管理画面で有効な置換日を入力するまで保存時に原文を保持する。
- ロールバックは本変更の差分を戻すだけでよく、DB migrationは不要。

## Acceptance criteria

1. `2026-09-28`、`2026.9.28(月)`、`2026/09/28`がすべて`2026.09.28(Mon)`になる。
2. 曜日が誤記された過去値も実日付に基づく曜日で表示される。
3. Open/Start、Startのみ、ticket、複数notes、複数performersが指定順で表示される。
4. 既存`description`だけのLiveは従来内容を表示できる。
5. 管理画面で各項目を個別に編集・保存でき、X返信previewも同じformatterを使う。
6. AI schemaと管理画面反映先が10項目で一致し、descriptionを生成しない。
7. 公開一覧、詳細、モーダル、OG descriptionが構造化データを利用する。
8. 既存のticket routingと予約台帳テストが回帰しない。
9. チケット予約画面のLive選択肢と選択Live previewがformat済み日付・詳細を使う。
10. 予約完了画面のquery dateが`YYYY.MM.DD(Day)`へ正規化される。
11. WorkerのX preview、schedule、post fallbackが構造化日付・詳細を欠落させない。
12. 解析不能な既存dateは別項目だけの編集で消えず、X返信previewにも残り、有効日付入力時だけ置換される。
13. AIのperformers契約は松本一樹／1212本人を除外し、共演者なしを空文字にする。
14. browserとWorkerのformatterが同じfixture matrixを通り、performersの明示ラベル`w.`・`w/`だけを除去し、`with`で始まる名前を完全保持する。

## Canonical file map

- `assets/js/live-operations.js`: 日付・詳細formatterとX返信組み立て
- `admin/app.js`: 構造化Live editor、保存、AI反映
- `assets/js/site-content.js`: 公開一覧・詳細・モーダル描画
- `assets/js/ticket.js`: 予約Live選択肢・選択Live preview
- `assets/js/ticket-complete.js`: 予約完了日付
- `ticket/index.html` / `ticket/complete/index.html`: formatter読込とcache bust
- `cloudflare/worker/src/worker.js`: AI schema/validation、OG description、X API fallback
- `test/fixtures/live-format-cases.json`: browser/Worker共通formatter契約
- `test/*.mjs`: 共有formatter、管理画面、公開表示の契約
- `cloudflare/worker/test/*.test.js`: 共通fixture、AI schema、OG、X API fallback回帰

## Verification

- focused Node testsをRED→GREENで確認する。
- root全テストとWorker全テストを実行する。
- `node --check`、`git diff --check`、対象外差分・secret混入監査を行う。
- spec reviewerとcode quality reviewerをexecutorと分離する。
