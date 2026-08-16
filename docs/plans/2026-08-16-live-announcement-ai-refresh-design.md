# Live管理画面3課題 Design

> Supporting design notes for Issues #19-#21. The canonical current spec is
> `docs/specs/current/live-operations-admin-ui.md`. Do not implement while that
> spec is `Draft`; if these notes conflict with it, the current spec wins.

## Scope

管理画面のLive編集モーダルにある3つの独立課題を扱う。Issue #19はX告知previewと投稿文、Issue #20はLive詳細URLコピーと操作密度、Issue #21はAI整理の抽出・反映不具合である。実装順は調整できるが、各Issueは他の完了を前提にせず検証・closeできる。公開Live画面、予約導線、保存schema、OpenAI key、production runtimeは変更しない。

## 変わること

### X投稿preview

「親投稿」と「返信用詳細」を廃止し、1つの「X投稿プレビュー」に統合する。統合投稿はLive編集フォームの現在値を使い、次のブロックを空要素なしで組み立てる。

1. `YYYY.M.D(曜) 会場`
2. `「公演名」`
3. `OPEN / HH:mm START / HH:mm`（片方だけでも成立）
4. ticket本文
5. notes（1補足1行、先頭の`※`を1つに正規化）
6. `-act-`と共演者（1組1行）
7. オーナーコメント
8. `#ライブ`
9. canonical Live詳細URL

日付の曜日は保存済み表記を信用せず実日付から再計算し、日本語1文字を括弧で付ける。X専用表記だけを変更し、公開面の`YYYY.MM.DD(Day)`契約は維持する。

Web Intentと「詳細をコピー」は同じ統合previewを使う。保存済みLiveにはcanonical URLだけをコピーする「リンクをコピー」を追加する。未保存LiveではWeb Intentとリンクコピーをdisabledにする。

### 操作密度

3操作は`announcement-actions`という専用のflex rowに置く。既存のPrimary/Secondary hierarchyを維持しつつ、paddingとfont sizeを下げ、狭幅では横方向のまま必要時だけwrapする。汎用`.field-row`のモバイル縦積みルールは他フォームへ影響させない。

### AI整理

Workerは引き続き`sourceText`だけをOpenAIへ送り、strict schemaで10項目を返す。抽出指示に、引用符付きタイトル、日付と会場の同一行、OPEN/START、ADV/DOOR、`-act-`出演者ブロックの対応を明記する。

clientはvalidated draft受領後、10項目を空文字も含めて一括代入する。これにより、別公演の既存値を残さず、貼り付けた元情報を正とする1公演分の下書きになる。元情報、保存済みsite data、自動保存・自動公開のauthorityは変えない。

## 変わらないこと

- AI通信中に元情報または10項目が変わった場合は結果を反映しない。
- HTTP、JSON、schema、preview更新の失敗時は全項目とpreviewをrollbackする。
- AI整理はAPI Mode限定で、OpenAI keyはWorker secretのまま扱う。
- Live保存schema、予約仕様、公開Live表示、OG、X API fallbackは変更しない。
- production deploy、secret変更、migration、mergeは行わない。

## Error handling / rollback

- 未保存Liveのcanonical URLは空とし、URLコピーをdisabledにする。
- Clipboard API失敗時は既存fallbackを使い、toastで失敗を通知する。
- 統合preview生成が失敗した場合、AI整理の原子的rollbackを維持する。
- 変更はHTML/CSS/JSとprompt instructionだけで、DB rollbackは不要。

## Acceptance criteria

- X投稿previewとテンプレート: GitHub Issue #19のAC1〜AC6。
- Live詳細URLコピーと操作密度: GitHub Issue #20のAC1〜AC6。
- AI整理の抽出・全置換: GitHub Issue #21のAC1〜AC6。

## Canonical file map

- `assets/js/live-operations.js`: X専用日付と統合投稿の純粋formatter。
- `admin/app.js`: 単一preview、3操作、URLコピー、AI全置換。
- `admin/style.css`: X操作列の専用compact layout。
- `admin/index.html`: 変更assetのcache bust。
- `test/live-operations.test.mjs`: X formatter契約。
- `test/admin-live-operations.test.mjs`: DOM、clipboard、Intent、AI原子性の契約。
- `cloudflare/worker/src/worker.js`: AI抽出instruction。
- `cloudflare/worker/test/live-ai-source-intake.test.js`: 実告知フォーマットのprompt契約。
- `admin/README.md` / `cloudflare/worker/README.md`: 運用説明。

## Verification

- focused testをRED→GREENで確認する。
- root全Node testとWorker全testを実行する。
- JS syntax、`git diff --check`、secret/credential/対象外差分を監査する。
- 実装したIssueごとに、実装者とは別のread-only reviewerが独立してAC単位で確認する。
