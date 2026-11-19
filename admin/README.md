# 1212 Homepage Admin

`tools/1212____HP/admin` は、1212ホームページの管理画面です。

## モード

- Local Mode
  - `data/site-data.json` を読み込み、保存時にJSONダウンロード
- API Mode
  - Cloudflare Worker APIへ保存し、LiveごとにX投稿（Web Intent + OGPリンクカード）可能

## 作品の選択・再生映像・種別（Issue #41）

SiteのHomeで「顔にする作品」を選択できます。Digital Release／宅録Demoの全作品から1件を選び、空の「自動（最新のリリース）」にも戻せます。保存先は`site.featuredReleaseId`です。画像の表示名は「共有時の画像」で、保存先`site.heroImage`とLive共有画像の予備としての働きを保ちます。

作品の編集には「種別」（`releaseType`、任意文字列）と「その場で再生する映像」（`playbackVideoId`、全映像カテゴリ共通のid）を追加しました。どちらも空にできます。従来のタイトル・説明・画像・リンクは保持します。新項目を欠く旧データは読込時にメモリ上で補い、通常保存時に永続化します。Local Modeの書き出しは従来のsite data本体で、APIの`data / meta` envelopeとは異なります。

新規作品と日付を変更した作品だけ、リリース日を空または`2025.05.05`の形で検査します。ASCII数字・ゼロ埋め・区切りの形だけを確認し、実在日や未来日の制約は追加しません。旧日付を変えずに別項目を編集・カテゴリ移動する操作はそのまま保存できます。不正な入力は日付の直下に表示し、入力と編集画面を保持します。API Modeの作品編集画面は保存成功後に閉じます。

選択中の作品を削除すると顔の指定を空に、映像を削除すると参照する全作品の映像指定を空に戻します。カテゴリ移動はidが同じなら参照を保ちます。削除内容は右上の保存（Local ModeではJSON書き出し）で確定します。API接続失敗時のread-onlyでも新項目を変更できません。

公開画面は#42でHomeに顔の作品・種別・選択映像の「聴く」を表示します。公開Musicの全作品・映像と作品の再生は#44、Ticket完了の案内は#43で扱います。作品はDisco、映像とChannel URLはYouTubeから編集します。管理タブの統合は#47の予定です。Homeの自動選択は、明示idがあれば優先し、それ以外は形の合う日付を持つ最新作品を選びます。同日はdigital→demoの元の順で、候補0件なら顔を表示しません。保存配列は並び替えません。

### #42の公開反映（履歴）

#42はHomeと共通の外枠および本説明の変更です。Workerの変更・deployは不要で、GitHub Pagesがmainのルートから配信するため、mergeが本番への反映になります。mergeはOwnerの明示判断で行います。「共有時の画像」はLive共有の予備に使い、Homeは作品のジャケットを表示します。

### #44・#43・#45のまとめ出し

#44の公開Musicと5項目ナビは、#43・#45とともに`feature/39-public-pages`へ集め、最後にmainへ反映します。#44をまとめ用branchへmergeしても本番は変わりません。#44によるWorkerの変更・deployは不要です。公開時のmergeと確認はOwnerの明示判断で行います。

### #41の反映と復旧（履歴）

GitHub Pagesは`main`の`/`から管理画面も配信します。Ownerが、試験済みPR最終revisionから先にWorkerをdeployし、Frontの公開API確認後にmergeします。Pagesのbuild・配信revision・app/helperの取得をFrontが確認してから管理タブを再読込し、Ownerが実際に使う1作品の3項目を保存して確認します。DB migration・新secret・既存データの一括更新は不要です。

merge前の不具合・merge見送りでは、OwnerがFrontの控えた直前Worker versionへ戻します。merge後は保存を止め、#41差分を戻すPRをOwnerが承認・mergeし、旧adminの配信確認後にWorkerを戻します。復旧中は作品編集を止めます。通常復旧でD1全体を巻き戻さず、実データ破損時だけ別途判断します。詳細は本cycleのCode Generation Plan §8・§9を参照してください。既存AI整理機能の反映順序はその機能の履歴として扱います。

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

1. 編集対象を現在の6タブ（Site / News / Live / YouTube / Disco / Profile）から選ぶ。公開Musicの作品はDisco、映像とChannel URLはYouTubeで編集する
2. Liveは一覧から公演を選び、右側（mobileは選択後の画面）の編集面で更新する
3. Liveは`保存して公開`、その他はheaderの`保存`で反映する
4. Live編集面の`告知`から統合previewを確認し、Web IntentでXを開く

## Live元情報のAI整理

Live編集の`AIで下書きを作る`はAPI Mode限定です。ブッカー／ライブハウスから受け取った元情報を貼り付けると、`date`、`title`、`venue`、`openTime`、`startTime`、`ticket`、`notes`、`performers`、`ticketUrl`、`link`の10項目を一括置換します。Local Modeでは利用できません。

- AIが空文字を返した項目も含め、10項目すべてを同じresponseから一括置換します。
- 貼り付けた元情報は変更・消去しません。
- AI整理後に人が内容を修正・確認し、通常の保存操作で反映します。自動保存・自動公開は行いません。
- 処理失敗時、または通信中に元情報や10個のフォーム項目を編集した場合は、AI結果をフォームへ反映しません。
- 確信度、根拠、別プレビューは表示せず、既存フォームを確認画面として使います。

## API接続失敗時

API Modeで管理APIの読込に失敗した場合、ローカルJSONをfallback表示します。この状態ではadmin全体がread-onlyになり、新規追加、入力変更、画像操作、保存、削除、AI整理、予約変更を行えません。既存のNews・YouTube・Disco・Profileの詳細は閲覧でき、グローバルタブやLive一覧・予約一覧のnavigationも利用できます。明示的なLocal Modeとは異なり、JSON書き出しへ切り替わることはありません。

## Live表示フォーマット

- 日付は`YYYY-MM-DD`で保存し、公開画面では実日付から曜日を計算して`YYYY.MM.DD(Day)`で表示します。解析不能な過去の保存値は画面に明示し、有効日付を入力するまでは別項目の保存で消さずに保持します。
- OpenとStartは別々に入力し、両方あれば`Open/Start: 18:30/19:00`、Startだけなら`Start: 19:00`と表示します。
- `ticket`はラベルを含めず料金・券種だけ、`notes`は`※`を含めず1補足1行、`performers`は本人を除く共演者を1組1行または`/`区切りで入力します。
- 公開表示は`ticket:`、`※`、`w. A / B`を自動で付けます。AI整理後も、原文と照合してから保存してください。
- 旧`description`は過去データ互換として保持され、構造化項目がすべて空のLiveだけで表示されます。

## 注意

- 画像ファイルアップロードはMVP範囲外です。画像は `tools/1212____HP/assets/images/` へ配置してパスを指定してください。
