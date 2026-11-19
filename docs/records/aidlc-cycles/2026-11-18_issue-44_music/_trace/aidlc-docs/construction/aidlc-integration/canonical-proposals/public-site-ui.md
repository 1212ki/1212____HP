# 公開サイト UI 設計

- Status: Approved
- Owner: Itsuki Matsumoto
- Last updated: 2026-11-18
- Related issues: #39, #40
- Related implementation issues: #41, #42, #43, #44, #45
- Implementation baseline: origin/main `00cdea5e69d5b341fc0a2b21a4eece9a53c8a2cd`（以下`00cdea5`）
- Owner approval: Issue #44のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。active時は`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後は`docs/records/aidlc-cycles/2026-11-18_issue-44_music/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。
- Prior Owner approval（Issue #42）: Issue #42のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。active時は`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-42_home/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。
- Prior Owner approval（Issue #41）: Issue #41のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。active時は`aidlc-docs/approvals/03-code-generation-plan-approval.md`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-41_data-fields/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。
- Prior Owner approval（Issue #40）: Issue #40のgate 3における、本ファイルのexact bytesを含むCode Generation PlanへのItsuki Matsumotoの本人回答`A`。close済みの`docs/records/aidlc-cycles/2026-11-17_issue-40_figma-design-mapping/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md`を参照する。

## 1. 目的と範囲

ライブなどで松本一樹を知った人が、音源をすぐ聴けて、次のライブに来られる場所をつくる。Homeは作品のジャケットを顔にする新作型とし、音源と映像はMusicへまとめる。

解決する課題は、既存Homeが画像帯を顔とし、作品と映像の入口が別ページに分かれていること、送信の状態が重ねて開く表示に分散していることである。作品を聴く入口と次のライブへの入口を近づけ、受付内容を落ち着いて確認できる構成にする。

本設計は実装の入力である。Approvedは採用する設計の承認を示し、画面の実装完了を示さない。§3の各行に`00cdea5`時点の実装状況と担当Issueを記す。#40は文書の対応づけ、実装は#41〜#45で行う。

対象はHome、Menu、Live一覧・詳細、Ticket・完了、終了したライブ（全件）、Music、Profile、Contactと共通のヘッダー・フッター。管理側の編集・保存とデータの持ち方は`live-operations-admin-ui.md`と対応させる。

対象外は、掲載情報の追加、作品ごとの詳細ページ、配信サービスごとのボタン、Contactの項目追加、予約受付・メール送信の仕組み変更、料金の支払い方の表示、hosting・認証・本番反映である。色・文字・余白は`DESIGN_RULES.md`と`assets/css/1212-music.tokens.css`を使う。

## 2. 判断と根拠

実装: #41（項目）、#42（Home・共通）、#43（予約の流れ）、#44（Music）、#45（Profile・Contact）。`00cdea5`: 掲載データと既存機能はあるが、新作型Home・Music統合・ページ内の送信状態は未実装。

選択肢は、Homeの画像帯を維持する形と作品を顔にする形、音源と映像を別ページに置く形とMusicへまとめる形、予約完了を重ねて示す形と完了ページへ進む形である。要件メモの「今の画面との違い」「案の判断と理由」に沿い、次の採用内容と理由を固定する。

| 判断 | 理由 | Figmaの根拠 |
|---|---|---|
| Homeは顔にする作品を1つ選び、直下に「聴く」と次のライブを置く。既定はリリース日が最新の作品。 | 開いた人が音源と次回公演へすぐ進めるようにする。 | [方針｜誰に・何を・どう見せる `20:5`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=20-5)、要件メモ｜Home「情報の優先順位」「振る舞い」 |
| Homeのnext liveは文字で見せ、newsのサムネイルは出さない。 | 顔をジャケットに絞り、日付の入る部分を飾らない。 | 要件メモ｜Home「案の判断と理由」`25:106` |
| 「聴く」は作品に選んだYouTubeの映像をその場で再生する。映像未選択なら出さない。外部のリンクは1つで、Digital Releaseは「配信先へ」、宅録Demoは「購入先へ」。 | 入口と動作を揃え、登録されていない操作を出さない。 | 要件メモ｜Home「振る舞い」`25:91`、要件メモ｜Music「振る舞い」`30:497`。 |
| Home / Live / Music / Profile / Contactの5項目にする。 | 聴く場所をMusicの1か所へまとめる。 | [全体計画｜残りの画面 `28:108`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=28-108)「共通」、要件メモ｜Music「案の判断と理由」 |
| 物販はHome linksのBandcampとMusicの宅録Demoの購入先を入口にする。noteはHome linksとnewsで扱う。 | 今の情報の範囲を保つ。 | 方針「載せる情報」`23:13`、要件メモ｜Music「振る舞い」 |
| 送信中・失敗はページ内、予約完了はTicket完了ページで示す。 | 受付内容を確かめ、Liveから聴く体験へつなげる。 | 要件メモ｜予約の流れ「振る舞い」「案の判断と理由」`29:355`・`29:370` |
| UIには実際の表示文言だけを置く。判断理由と新旧の説明は設計側に持つ。 | 操作する人へ制作上の説明を負わせない。 | 管理方針「画面と説明の分け方」`43:509`、#37の承認済み設計§5.2 |

#42公開時はMusic完成まで既存6項目のナビを保ち、Homeの「music →」はDiscographyへ向けた。#44は5項目と`/music/`への入口・旧URLの行き先を揃える。公開側#43・#44・#45はOwner決定（2026-11-18）により`feature/39-public-pages`へ集約し、最後にmainへまとめて出す。#44の統合では本番配信は変わらず、管理画面は#47までYouTube・Discoタブを維持する。

## 3. 画面・マスタ・要件・実装の対応

### Issue #42の実装入力と比較時点

下表の`00cdea5`列は当時の比較記録として保持する。#42はHomeの新作型、10状態と読込中、全9公開ページのヘッダー・フッター・Menu、Homeで使う共通部品を実装する。Home以外の本文への新部品適用は#43〜#45、5項目ナビは#44。#42の実装・試験・独立review・画面受入の成否は、active時の`aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md`と`aidlc-docs/construction/build-and-test/build-and-test-summary.md`、close後の`docs/records/aidlc-cycles/2026-11-17_issue-42_home/_trace/aidlc-docs/`内の同pathを参照する。Approvedだけで実装済みとはしない。

参照するFigmaはFront反映後の`/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-223255_1212hp-42-home/figma-snapshot-v2/`。文言の書き出しは2026-11-17T23:16:01+09:00、`page-0-1_master-home.md`のSHA-256は`b08d37109e0f407cbf15c65442c027c677cfb7297dcd3e913d12f7b7a27483c8`、`SHA256SUMS`のSHA-256は`27defc5c6f6b7f1c2f6b5d6dd8cb29645050c038cf31b69020f87bec6071428f`。`diff-vs-v1.md`の結論は`unexpected: none`で、差はE1〜E14だけ。修正前の`figma-snapshot/`（v1）は比較用provenanceとしてauditに残す。`39:850`・`20:23`のspecとrenderはv1の写しで、新しいlayout/style観測とはしない。

Figma fileは`82QH1c3hUrv1fKCd2AMULK`、pageは[マスタ｜ホームページ `0:1`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=0-1)。リンク名はマスタのframe名を保つ。「一部実装」は既存ページ・データ・操作がある一方、マスタの構成と追加動作が未実装であることを示す。要件メモ列の受入条件は§4の同IDに対応する。

| 画面 | 1440pxのマスタ | 390pxのマスタ | 状態frame | 要件メモ（node-id・見出し） | 受入条件ID | 実装Issue | `00cdea5`で実装済みか |
|---|---|---|---|---|---|---|---|
| Home | [Home｜1440 `23:36`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=23-36) | [Home｜390 `24:43`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=24-43) | [Home｜状態 `24:139`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=24-139)（10状態） | [要件メモ｜Home `25:83`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=25-83)「振る舞い」`25:91`・「狭い幅（390px）」`25:94`・「受入条件」`25:100` | PS-H-01〜06 | #41, #42（5項目化は#44） | 一部実装。`index.html`、`assets/js/site-content.js`にhero・links・next live・newsがある。新作型・選択映像・ほかの作品2件・profile抜粋は未実装。 |
| Menuを開いた状態 | 専用frameなし。1440pxは上記Homeのナビを表示。 | [Menu を開いた状態｜390 `39:850`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=39-850) | 開いた状態は`39:850`、閉じた状態はHome｜390 `24:43`。共通読込状態は`24:139`。 | [要件メモ｜Home `25:83`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=25-83)「狭い幅（390px）」`25:94`、全体計画「共通」`28:111` | PS-COM-01、PS-H-02 | #42, #44 | 一部実装。`index.html`・`assets/js/script.js`に既存モバイルナビ。Music統合後の5項目は未実装。 |
| Live一覧 | [Live一覧｜1440 `27:104`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=27-104) | [Live一覧｜390 `27:148`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=27-148) | [予約の流れ｜状態 `29:249`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-249)（予定なし・過去なし・読込失敗） | [要件メモ｜予約の流れ `29:347`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-347)「振る舞い」`29:355`・「受入条件」`29:364` | PS-L-01, PS-L-05, PS-L-08 | #43（共通は#42） | 一部実装。`live/index.html`・`site-content.js`に一覧・予約導線。表示構成・文言・状態の整備は未実装。 |
| Live詳細 | [Live詳細｜1440 `28:141`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=28-141) | [Live詳細｜390 `29:133`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-133) | [予約の流れ｜状態 `29:249`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-249)（読込失敗・不明Live・画像なし・予約4分岐） | [要件メモ｜予約の流れ `29:347`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-347)「情報の優先順位」`29:352`・「振る舞い」`29:355`・「狭い幅（390px）」`29:358`・「受入条件」`29:364` | PS-L-05, PS-L-07 | #43 | 一部実装。`live/detail/index.html`・`site-content.js`・`live-operations.js`に詳細と予約判定。日付・会場主見出しとInstagram入口の追加は未実装。 |
| Ticket | [Ticket｜1440 `28:182`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=28-182) | [Ticket｜390 `29:167`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-167) | [予約の流れ｜状態 `29:249`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-249)（入力誤り・送信中・失敗・外部・受付不可・候補なし・読込失敗・重複・識別不能） | [要件メモ｜予約の流れ `29:347`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-347)「振る舞い」`29:355`・「狭い幅（390px）」`29:358`・「受入条件」`29:364` | PS-L-01〜06 | #43 | 一部実装。`ticket/index.html`・`assets/js/ticket.js`に入力・復元・受付制御。案内文と注意文の項目削除は#37で実装済み。送信状態のページ内表示と完了ページ遷移は未実装。 |
| Ticket完了 | [Ticket完了｜1440 `28:233`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=28-233) | [Ticket完了｜390 `29:210`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-210) | [予約の流れ｜状態 `29:249`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-249)（受付内容を表示できない時） | [要件メモ｜予約の流れ `29:347`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-347)「振る舞い」`29:355`・「受入条件」`29:364` | PS-L-01, PS-L-04, PS-L-06 | #41, #43 | 一部実装。`ticket/complete/index.html`はあるが`ticket.js`の成功処理から呼ばれない。既定「予約しました。」は#37で実装済み。送った内容・タイトル・「当日までに聴く」は未実装。 |
| 終了したライブ（全件） | [終了したライブ（全件）｜1440 `30:169`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=30-169) | [終了したライブ（全件）｜390 `30:198`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=30-198) | [予約の流れ｜状態 `29:249`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-249)（過去なし・読込失敗を共用。専用frameなし） | [要件メモ｜予約の流れ `29:347`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=29-347)「振る舞い」`29:355`・「受入条件」`29:364` | PS-L-08、PS-L-07（詳細への入口） | #43 | 一部実装。`site-content.js`の`renderLivePastArchive`と詳細ページに既存全件表示。マスタの見出し・行構成へ揃える作業は未実装。 |
| Music | [Music｜1440 `30:220`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=30-220) | [Music｜390 `30:335`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=30-335) | [Music｜状態 `30:446`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=30-446)（6状態） | [要件メモ｜Music `30:489`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=30-489)「振る舞い」`30:497`・「狭い幅（390px）」`30:500`・「受入条件」`30:506` | PS-M-01〜04、PS-COM-01 | #41, #44（共通は#42） | 未実装。`discography/index.html`・`youtube/index.html`と各rendererは別々に存在。Music統合・旧URL誘導・作品の選択映像再生は未実装。 |
| Profile | [Profile｜1440 `31:247`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=31-247) | [Profile｜390 `31:294`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=31-294) | [Profile・Contact｜状態 `31:400`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=31-400)（写真なし・読込失敗） | [要件メモ｜Profile・Contact `31:443`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=31-443)「振る舞い」`31:451`・「狭い幅（390px）」`31:454`・「受入条件」`31:460` | PS-PC-01 | #45（共通は#42） | 一部実装。`profile/index.html`・`site-content.js`に写真・本文・共通linksとSNS。Contactへの依頼入口とマスタ構成は未実装。 |
| Contact | [Contact｜1440 `31:336`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=31-336) | [Contact｜390 `31:370`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=31-370) | [Profile・Contact｜状態 `31:400`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=31-400)（入力誤り・送信中・完了・失敗） | [要件メモ｜Profile・Contact `31:443`](https://www.figma.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto?node-id=31-443)「振る舞い」`31:451`・「受入条件」`31:460` | PS-PC-02〜04 | #45 | 一部実装。`contact/index.html`・`assets/js/contact.js`に3項目とFormspree送信、Site設定の反映。送信状態はoverlayで、ページ内表示は未実装。 |

### Issue #44のMusic・ナビの実装入力と比較時点

上表の`00cdea5`列と#42の記録は比較履歴として保持する。#44着手時点は`080325887576655f27461cb15f28a3c590a292ee`で、Homeと全9ページの共通外枠は#42の受入済み。Music本文と5項目化・旧URL誘導はここから実装する。Approvedは入力の承認であり、下の対象の実装完了を意味しない。

| 対象 | #44の対象と結果の参照 |
|---|---|
| Music | 新規`music/index.html`でrelease・demo・video、6状態と読込、全作品と全映像、選択映像のその場再生。旧2HTMLは誘導ページにする。 |
| Menu・全公開ナビ | 既存9HTML＋MusicをHome / Live / Music / Profile / Contactに揃える。Homeのmusic →もMusicへ向ける。Ticket系の現在地はLive、旧2URLはMusic。 |

結果はactive時の`aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md`と`aidlc-docs/construction/build-and-test/build-and-test-summary.md`、close後の`docs/records/aidlc-cycles/2026-11-18_issue-44_music/_trace/aidlc-docs/`内の同pathを参照する。#43・#45の本文には変更を広げない。

FigmaのMusic入力は`/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261118-110045_1212hp-44-music/figma-snapshot/`。文言取得2026-11-18T11:31:33+09:00、`page-0-1_master-home.md` SHA-256 `9e694cf09a238dabb044f0752c981733b3c1d638a07f5ae47e84599471936679`、`music-layout-spec.md` SHA-256 `bfff4827b9852b3a3c4831edf060823ab677c2d9f16cafbad3329b2c63ee3ab5`。今回のrender PNGはなく、数値・文言を根拠にする。nav32、再生/外部ボタンの区別、16:9のplayerとPC幅の寸法（作品の聴く480×270、映像474×267）、Music用カードvariant、tokensの間隔、ロゴ例外の整合案は同cycleの`construction/aidlc-integration/figma-fix-requests.md` F44-01〜07とgate 3の記録に対応する。意味が変わる別案は先に再承認する。

## 4. 受入条件

実装: #42〜#45（データ前提は#41）。`00cdea5`: 既存項目の保持条件は照合対象、マスタに基づく画面受入は未検証。以下22項目は各要件メモの「受入条件」を項目ごとに転記したもの。IDを後続の計画・テスト・検証結果で使い、項目の統合や再採番をしない。

| ID | 受入条件（要件メモ原文） | 元見出し | 実装Issue |
|---|---|---|---|
| PS-H-01 | 幅1440pxで開いた最初の画面に、ジャケット、作品名、次のライブの日付と「予約する」が入っている。映像を選んだ作品では「聴く」も入っている。 | Home「受入条件」`25:100` | #42 |
| PS-H-02 | 幅390pxで、スクロールせずにジャケットと作品名が見える。 | 同上 | #42 |
| PS-H-03 | 「聴く」が出ている時、押してから1回の操作で音が出る。 | 同上 | #41, #42 |
| PS-H-04 | 次のライブがない時は予約ボタンを出さず、決まっていないことを文で示す。 | 同上 | #42 |
| PS-H-05 | 今のHomeで見られる外部リンク5つ、next live、news（6件、説明とリンクの文言つき）が、すべて残っている。 | 同上 | #42 |
| PS-H-06 | アクセントの赤は「予約する」と見出しの線だけに使う。ロゴ（i の文字と、押した時の演出）は今のまま。 | 同上（v2本文`25:102`） | #42 |
| PS-L-01 | Live一覧から予約の完了まで、通る画面は最短3つ（一覧 → Ticket → 完了）。 | 予約の流れ「受入条件」`29:364` | #43 |
| PS-L-02 | Ticketで、どのライブを予約しようとしているかが、入力中ずっと見えている。 | 同上 | #43 |
| PS-L-03 | 送信に失敗しても、入力した内容が消えない。 | 同上 | #43 |
| PS-L-04 | 送信できた時、送った内容を画面で確認できる。 | 同上 | #43 |
| PS-L-05 | 予約できないライブでは「予約する」を出さず、理由を文で示す。 | 同上 | #43 |
| PS-L-06 | 今のTicketの入力項目と、管理画面で変えられる文言・表示の設定が、すべて残っている。 | 同上 | #43（#37反映後を基準） |
| PS-L-07 | 今のLive詳細で見られる項目（画像、タイトル、日付、会場、時間、料金、注記、共演、説明、予約）が、すべて残っている。 | 同上 | #43 |
| PS-L-08 | 終了したライブの行に、今と同じくタイトルが出る。 | 同上 | #43 |
| PS-M-01 | 今のDiscographyにある全作品（Digital Release、宅録Demo）と、今のYouTubeにある全映像（Music Video、Live Movie、Demo）とチャンネルへのリンクが、すべてこのページにある。 | Music「受入条件」`30:506` | #44 |
| PS-M-02 | どの作品からも、1回の操作で聴き始められるか、配信先・購入先へ行ける（リンクも映像も登録がない作品を除く）。 | 同上 | #41, #44 |
| PS-M-03 | 古いアドレス（/youtube/、/discography/）から来ても、行き止まりにならない。 | 同上 | #44 |
| PS-M-04 | 赤は見出しの線だけ。このページに「いちばんしてほしい操作」は置かない（どの作品を聴くかは見る人が選ぶ）。 | 同上 | #44 |
| PS-PC-01 | 今のProfileにある写真、プロフィール文、SNSリンクが、すべて残っている。 | Profile・Contact「受入条件」`31:460` | #45 |
| PS-PC-02 | 今のContactの入力項目（名前、e-mail、内容）と、管理画面で変えられる導入文・送信先が、すべて残っている。 | 同上 | #45 |
| PS-PC-03 | 送信に失敗しても、入力した内容が消えない。 | 同上 | #45 |
| PS-PC-04 | 送信できた時、送った内容を画面で確認できる。 | 同上 | #45 |

上表は22項目。次の2項目は「全体計画」と各メモの状態記述から追記する共通の受入条件で、要件メモの原文転記とは区別する。

| ID | 受入条件 | 根拠 | 実装Issue |
|---|---|---|---|
| PS-COM-01 | 390pxのMenuで開閉して各ページへ進める。#44完了時にナビは5項目となり、1440pxのナビと行き先が一致する。 | 全体計画「共通」`28:111`、Home「狭い幅（390px）」`25:94`、Menu frame `39:850` | #42, #44 |
| PS-COM-02 | 各画面で読み込み中・空・未登録・送信中・失敗を、対応する状態frameと要件メモどおりに扱う。 | 状態frame `24:139`（10）、`29:249`（16）、`30:446`（6）、`31:400`（6） | #42, #43, #44, #45 |

## 5. データと管理画面の対応

実装: #41（3項目・日付・共有画像の表示名）、#42〜#45（公開表示）、#47（管理の見え方）。`00cdea5`: 下表の既存データはあり、新しい3項目は未実装だった。下表に#41の実装入力として固定する保存先を追記する。#41の実装・試験・独立reviewの成否は、active時の`aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md`と`aidlc-docs/construction/build-and-test/build-and-test-summary.md`、close後の`docs/records/aidlc-cycles/2026-11-17_issue-41_data-fields/_trace/aidlc-docs/`内の同pathを参照する。Approvedは実装済みの意味ではない。

| 公開表示・用途 | 管理入口 | `00cdea5`のデータ事実／#41の追加契約 |
|---|---|---|
| Homeの顔・Ticket完了の「当日までに聴く」 | Site > Home「顔にする作品」 | `site.featuredReleaseId`に作品の`id`を文字列で1つ、空は`""`。空ならDigital Releaseと宅録Demoを合わせてリリース日が最新の作品。 |
| Home・Musicの「聴く」 | Music > 作品「その場で再生する映像」 | 各作品の`playbackVideoId`に登録済み映像の`id`を文字列で1つ、空は`""`。空なら「聴く」を出さない。既存映像は`youtube.musicVideos / liveMovies / demos`、映像IDと`youtubeId`を持つ。 |
| 作品名と分ける種別 | Music > 作品「種別」 | 各作品の`releaseType`に任意の文字列、空は`""`。空ならタイトルだけ。既存作品は`discography.digital / demo`に`id / title / releaseDate / description / image / link`を持つ。 |
| リリース順・最新作品 | Music > 作品「リリース日」 | `releaseDate`の空でない新規入力・変更値をASCII数字の`YYYY.MM.DD`として検査し、空は任意のまま。形が違う既存作品は最新候補から外し、並びの最後へ回す。日付を変えない他項目の保存は既存値を保持する。形が違う新規・変更値はadminと保存APIで保存を拒否し項目下へ示す。 |
| 共有画像の予備 | Site > Home「共有時の画像」 | 既存`site.heroImage`。Home Heroの表示名を変え、Live共有時の画像の予備としての働きは保つ。Homeの顔の選択とは別。 |
| 次のライブ・一覧・詳細・予約概要 | Live > 公開内容 | `live.upcoming / past`とLive fields。保存区分を正本とし、日付で勝手に区分を変えない。予約URLと補助リンクを区別する。 |
| Home newsと外部links、footer | News、Site | `news`、`site.links`（Bandcamp / YouTube / X / Instagram / note）、`site.footerText`。newsは新しい順6件、リンクなしならリンク文言を出さない。 |
| Profile本文・写真・SNS、Homeの短い紹介 | Profile、Site > Home Links | `profile.text / image / links`。Profileは登録文をそのまま、Homeは最初の空行まで。共通linksを先にSNSを続ける。 |
| Contactの導入文・送信先 | Site > Contact | `contact.introText / formAction`。#37が削除したTicketの案内文・注意文とは別の設定。 |
| Ticket表示と受付内容 | Live > Ticket Page共通設定、予約 | 完了文・枚数/備考の表示とラベル・入力例・送信ボタン文言を保持。#37の`introText / noticeText`削除は管理設計§5.2を維持。 |

3項目はどれも空で公開画面が成立する。選んでいた作品が削除されたら選択を空に戻し、自動選択に戻る。選んでいた映像が削除されたら作品の選択を空に戻し、「聴く」を出さない。追加項目が空でも登録されていても#41単独の段階では既存の公開表示を変えない。公開APIの`data`とLocal ModeのJSONに3項目を出し、表示への適用は#42〜#44へ渡す。自動選択・同日の順・参照削除・保存互換性は管理設計§5.3を正本とし、保存配列を並べ替えない。

### Issue #42のHome表示契約

#41の`MusicData.resolveFeaturedRelease / sortReleasesByDate / isReleaseDateFormat`を公開Homeで使い、同じ選択規則を書き直さない。顔以外はdigital→demoを連結し、顔のidを除いた新しい順の先頭2件。日付不正・空はsortの末尾に置き、保存配列は変更しない。顔候補がnullでも残る作品はmusicに出せる。タイトルを登録どおりに保ち、種別は別表示する。種別と日付の空でない値を` ／ `で結び、種別未登録時にタイトルを解析・移行しない。

Homeは`site.heroImage`を表示しない。Live共有時の予備画像としてのkey・保存・OGの働きは保つ。Home linksは5つのSite設定を優先し、既存Profile同名リンクfallbackを保持する。HomeのBandcamp表記は「Bandcamp（音源・物販）」とする。Profile本文側の表示名は変更しない。footerは全幅で`site.footerText`の全文を出し、狭い幅では折り返す。

newsは新しい順で6件、同日は元順、不正・空日付は末尾。画像なしで日付・タイトル・説明・登録リンク文言を保持し、リンクなしではその文言も出さない。Home profileは最初の空行まで（空白だけの行も空行、単一改行は保持）。

### Issue #44のMusic表示契約

Musicも既存`MusicData.sortReleasesByDate`を使い、digitalとdemoをそれぞれ新しい順に表示する。同日・日付不正・空の順序と非破壊性を保つ。タイトルは登録どおり、種別と日付はHomeと同じ` ／ `結合の別表示。説明は両区分とも全文・改行を保持する。リンクが有効ならdigitalは「配信先へ」、demoは「購入先へ」。選択映像は全3映像配列の`id`から解決し、有効なyoutubeIdがある作品だけ「聴く」を出す。映像配列内は登録順、music video→live movie→demoの順を保つ。作品に選ばれた映像もvideoから除かない。「YouTubeチャンネル →」は`youtube.channelUrl`を使う。

公開Musicの作品は現管理画面のDisco、映像とChannel URLはYouTubeで編集する。#44はタブ・modal名・保存・データの形を変えず、5タブ化は#47。`admin/README.md`はこの対応を記し、未来の管理Musicタブが現在使えるようには書かない。

## 6. 主要flowとdesktop / mobile

実装: #42〜#45。`00cdea5`: 既存の閲覧・外部リンク・送信はあるが、以下の構成・完了遷移は未実装。

- Homeは顔の作品→次のライブ→news→ほかの作品2件→profile→linksの順。390pxは縦1列でナビをMenuに畳む。1440pxの初期表示と390pxのジャケット表示はPS-H-01・02で確認する。ロゴの波紋・音符の演出は保持する。 #42公開時のナビは既存6項目だった。#44ではHome / Live / Music / Profile / Contactの5項目にし、Homeのmusic →は`music/`、all live →は`live/`、次回未定のこれまでのライブ →は`live/detail/?view=past`。外枠だけを全ページへ適用し、本文を一括変更しない。Menuは開くと閉じるに替わり、Escape・リンク選択・desktop幅へのresizeで閉じる。ロゴの赤いiと、押した時の波紋・音符の色・動き・タイミングは今のまま、reduced-motionも保つ。ナビ・リンクのhover/focus、選択色、scrollbar、背景、ロゴhoverの線には赤を使わない。全体計画`28:111`のv2は「・主な見出し（news、music、profile、links など）は小文字の英語と短い赤い線。new release・next live のような小さなラベルには線を付けない。本文と操作は日本語。」「・赤は、その画面でいちばんしてほしい操作1つと、見出しの線だけに使う。ロゴは今のまま。」とする。
- Live一覧は開催予定を日付の近い順、終了したライブは新しい順の先頭数件と全件への入口。Live詳細だけで公演の詳細を見せる。390pxの詳細は日付・会場・予約をフライヤーより上に置く。時間・料金・注記・共演がすべて未登録なら説明を出す。Homeの次のライブにも同じformatterを使う（v2の`25:91`は「時間・料金・注記・共演の文字は、Liveのページと同じ書き方で出す。」）。
- 内部予約はTicket、外部予約は別タブ、終了・受付終了・不正な予約URLは予約できない状態を示す。LiveリンクがInstagramなら詳細とTicket概要へ出し、それ以外の補助リンクを同じ入口としては出さない。
- Ticketは指定Live、なければ入力途中のLive、なければ先頭を初期選択する。1440pxは入力中も対象概要が横に見える。390pxは概要を入力欄の上に小さく置き、送信を全幅にする。入力の復元・枚数1〜10・表示設定を保持する。外部受付の選択時はLive選択だけを残し、他の入力と内部送信を隠す。
- 予約成功後はTicket完了へ進み、完了文・受付番号・対象Live・送った内容・次の入口・Homeと同じ作品を出す。完了文は管理設定を優先し、既定は「予約しました。」。メールの控えへの言及は置かない。渡す内容の方法は#43の計画で固定する。
- Musicのpathは`/music/`、release→demo→video、ページ内移動は`#release / #demo / #video`。作品は区分ごとにリリース日の新しい順。作品の再生は押した作品を含む並びのすぐ下、映像はサムネイルの場所に開く。ページ内のplayerは最大1つで、別の作品・映像・同じ映像の別の起点を開いたら前を破棄し、新しい場所で最初から再生する。閉じる・再描画・離脱でも停止する。1440pxは作品画像220角、カード幅220で、作品の「聴く」のplayerは押した作品を含む並びのすぐ下に480×270で開き、ほかの作品のカードに重ならず左右にはみ出さない。映像は2列・間隔32で、サムネイルとplayerは474×267（本文幅980の時）、題名の幅も同じ。390pxは画像120角を左、名前と操作を右、playerは作品行全幅の358×201、映像も1つずつ全幅の358×201。幅が足りない時、playerの幅は置ける幅に合わせて16:9を保ち、Musicのplayerの高さは200pxを下回らない（置ける幅が356px未満では高さ200pxを保つ）。映像の列は、1列あたりの幅で高さ200pxを保てなくなる前に1列にする（YouTubeの埋め込みは高さ200px以上、16:9は480×270以上が推奨）。playerは16:9、既存Homeの再生と停止を保持し、iPhoneで追加tapを要する場合は受入済みQ42-01を引き継ぐ。`/discography/`は`/music/#release`、`/youtube/`は`/music/#video`へ`location.replace`で送り、query・旧hashは破棄する。JSなし・失敗でも常時表示リンクから進める。Music自身もJS無効時にBandcamp・YouTubeの静的入口を残す。旧HTMLのcanonicalはMusic、robotsはnoindex, follow。空の区分のhashは読込後にMusic上部へ戻し、見出しと移動には空の区分を残さない。
- Profileは登録内容を保ち、Contactへの依頼入口を出す。390pxは写真を上、本文を下。Contactは既存3項目のまま、送信中・完了・失敗をページ内で示し、送信ボタンを全幅にする。

## 7. 状態・失敗・fallback・rollback

実装: #41〜#45。`00cdea5`: 一部の受付制御・入力復元・既存fallbackはある。状態frameとの一致は後続で検証する。

| 対象 | 状態と対応 | マスタ |
|---|---|---|
| Home | 外部予約、受付終了、次回未定、Live読込失敗、再生中、映像未選択、画像なし、作品0、news0、全体読込失敗。作品0は名前と次のライブを広く出し「聴く」を出さずlinksを残す。news0は欄ごと隠す。 | `24:139`の10状態 |
| Live/Ticket | 予定0、過去0、読込失敗、不明Live、フライヤーなし、予約4分岐、入力誤り、送信中、送信失敗、外部受付選択、予約不可指定、予約候補0、受付内容なし、Ticket読込失敗、重複、識別不能。送信中は入力を保って操作を無効化し、失敗は入力を保って再送できる。 | `29:249`の16状態。予約4分岐は1つの状態見本。 |
| Music | 再生中、映像未選択、映像サムネイル押下、空の区分、全体0/読込失敗、画像なし。空の区分は見出しとページ内移動から外す。全体0/失敗はマスタどおりの知らせとBandcamp・YouTubeを残す。 | `30:446`の6状態 |
| Profile/Contact | 写真なしは枠を出さず本文を広げる。読込失敗は再読込入口。Contactは入力誤り・送信中・完了・失敗をページ内で示し、失敗しても入力を保持する。 | `31:400`の6状態 |

### Issue #42の状態の条件

Homeの10状態は外部予約、予約受付終了、upcoming空、Live部分失敗、再生を開いた後、映像未選択／参照無効、画像未登録／load error、顔候補null、news空、全体GET失敗である。Live部分失敗は全体データが取得できてもlive.upcomingが配列でない等の場合とし、空配列と区別する。再試行は同じ公開GETを操作時に呼び、二重要求と古い応答による上書きを防ぐ。全体失敗では新作・次のライブ・news・musicの場所へ知らせを1つ出し、ヘッダー・フッターとBandcamp・YouTubeのfallback入口を残す。

次のライブはupcomingの最も近い1件で、日付を過ぎても区分を変えず表示を残す。予約可否は既存共通処理を使う。内部は「予約する」、外部は「予約する（外部サイト）」、終了は非操作の「予約受付終了」、不正URLは非操作の「予約URLが無効です」。識別不能時も予約操作を出さない。外部／終了の状態でも公演名と一覧への入口を保つ。

「聴く」は選択された映像の有効なyoutubeIdがある時だけ表示する。押した場所に有音autoplayを要求するiframeを開き、「閉じる」でiframeを破棄して再生を止め、プレーヤーを閉じて「聴く」に戻す（v2の`25:91`）。別のページへの遷移・Home再描画時にも破棄する。実音が1操作で開始するかはPCとiPhone Safariの実機受入で確かめ、端末制限による追加tapを未受入のままPS-H-03をPASSにしない。画像なしでは通常の画像比率の淡い面に作品タイトルと松本一樹を出す。

読み込み中は見出しと枠を先に出し、中身の場所を淡い面で空ける。Home全体の失敗はヘッダー・フッターを残し、新作・次のライブ・news・musicの場所へ1つの知らせと再読込を出す。画像がない場合の文字と淡い面もマスタを参照する。

TicketでLiveを識別できない場合は「予約情報を確認できません。時間をおいて再度お試しください。」を出す。受付内容がない完了ページでは内容を捏造せず、一覧への入口を出す。予約の保存成功とメール送信成功は分ける。#37の送信失敗時も予約成功を保つ契約は管理設計§5.2を参照する。

#40のrollbackは昇格した設計書・索引だけをbase `00cdea5`の版へ戻し、新設の公開設計書の撤回は明示確認後に行う。後続実装のrollbackは各Issueの承認済み計画で定義し、予約データ・Figma・無関係な設計を戻さない。

### Issue #42の確認2と公開

確認2の前にFrontがItsukiへ実際の1作品の種別・映像とSiteの顔の選択の通常保存を頼む（保存済みなら入れ直さない）。#41の公開互換試験が旧公開画面は3項目を使わないことを保護するため、merge前に保存できる。Frontが本番公開APIを直接読むbranchの新HomeをPC・スマホから開けるURLで示し、確認2でItsukiが同じ作品の顔・種別・1操作実音・閉じるを確かめる。fixtureの撮影は別に維持し、本番データをrepoやfixtureへ保存しない。手元配信は公開用ファイルだけとし、管理画面・token・private fileとrepo全体を外に出さない。merge後はFrontがPages buildと公開Homeの新版配信・確認2との一致をread-only確認し、差が見つかった時だけItsukiへ返す。同じデータ・画面の2回目の本人確認は頼まない。確認2前に保存した作品設定は、merge見送り時もrollback時も保持する。

### Issue #44の状態とまとめ出し

Musicの状態は同cycle RequirementsのS44-01〜06・Lへ対応する。全体0と取得失敗は内部の状態を分けつつ、ともに「音源の情報を読み込めませんでした。」「もう一度読み込む」「Bandcamp」「YouTube」を出す。読込中は見出し・枠・淡い面を先に出す。画像なし・load errorは通常の画像寸法の淡い面に「松本一樹」だけを出し、作品名は本来の位置に保持する。空の区分・映像小区分は見出しごと隠す。映像0でも有効なチャンネルはmusic見出し側へ残す。retryは二重要求・古い応答の上書きを防ぎ、離脱後の応答を無視する。公開本文の赤は見出しの線だけとし、共通ロゴの赤いiと押下演出は既存の例外を維持する。

確認1はgate 1〜3、確認2はgate 4〜5で、すべてItsuki本人のAを記録する。Frontはfixture画像とは別に、確認2前に本番公開データでbranchのMusic・Home・旧URLをPCとスマホから確認する。公開ファイルだけを手元配信し、`http://localhost:8888/`は許可リスト内の公開APIを読む。スマホは公開データのscratch上の写しを読む。公開APIは許可リストのオリジンだけに応える。repo・fixture・承認の提示文へ本番の値を入れない。設定は保存済みなら入れ直さない。毎回PC/スマホURLを渡し、確認2のItsukiの閲覧は任意、本人が必ず見るのはまとめ出し前の公開全ページ1回である。実音・画像・本番表示・独立reviewの成否は結果文書に分ける。

Owner決定（2026-11-18）により#44を先に`feature/39-public-pages`へ統合し、#43・#45はそれを取り込んで本文を実装する。PR base mainという通常規則への例外であり、最後はmainへまとめて出す。#44のmergeでは本番は変わらず、Worker deployも本番配信確認も行わない。Issue/ProjectはReviewを保ち、まとめ出しのmain merge時にcloseする。まとめ用branchで戻す場合は#44のmerge差分だけをrevertし、後続本文と整合を確認する。本番公開後に旧6項目へ戻す場合はmainのまとめ出し差分をrevertし、旧2ページとHome入口・説明を同じ復旧単位で戻す。いずれもItsukiの明示承認で実行し、保存データ・#41 Worker・Figmaを戻さない。具体手順と衝突範囲は#44のCode Generation Planを参照する。

## 8. 検証とマスタ更新の手順

実装・検証: #40（文書対応）、#41〜#45（挙動・画面）。`00cdea5`: 本文のマスタ受入は未検証。

1. #40では全frame・要件見出し・AC ID・担当Issueをsnapshotと照合し、Current Specification Gateを満たすことを独立reviewする。Itsukiがgate 3で確認したexact bytesだけを昇格し、SHA-256一致を確認する。
2. #41〜#45では計画・テストにPS系IDを記し、データ保持・未登録・削除・受付分岐・送信失敗をsourceと決定論的テストで確かめる。1440pxと390pxの初期表示・折返し・読み込み状態・再生は各Issueの画面受入で確かめる。#40の文書照合を実機受入に置き換えない。
3. 画面・要件メモ・設計が食い違う場合は、node-idと該当節、今の内容、変更案、理由、影響するACを記録する。先にFigmaマスタと要件メモを揃え、該当設計書と索引をDraftに戻す。影響する要件・計画を承認し、Approvedへ戻してから実装する。画面だけ・設計書だけで独断解決しない。

Gap: 現マスタのlive状態・見た目の最終照合と表示・実操作・本番の確認は、本文のsource照合とは別に行う。#40の文書照合ではこれらの検証済みを主張しない。

## 9. 関連Issue・計画・canonical file map

| 対象 | 正本・参照先 |
|---|---|
| 公開UI | `docs/specs/current/public-site-ui.md`（本設計） |
| 管理UI・既存Live契約・3項目 | `docs/specs/current/live-operations-admin-ui.md` |
| 横断設計・索引 | `docs/specs/current/system-design-principles.md`、`docs/specs/current/README.md` |
| 色・文字・余白 | `DESIGN_RULES.md`、`assets/css/1212-music.tokens.css` |
| #40の要件・昇格計画・証拠 | active時は`aidlc-docs/`、close後は`docs/records/aidlc-cycles/2026-11-17_issue-40_figma-design-mapping/_trace/aidlc-docs/`。Code Generation Planは各root内の`construction/plans/aidlc-integration-code-generation-plan.md`。 |
| 実装分担 | #41 データと項目、#42 Home・共通、#43 Live・Ticket、#44 Music・5項目ナビ・旧URL、#45 Profile・Contact。各Issueのformal cycleでPS系ACを実装計画へ対応させる。 |
| 既存予約の承認済み決定 | 管理設計§5.2、`docs/records/aidlc-cycles/2026-11-17_issue-37_ticket-autoreply-gmail/` |
| 文書・変更工程 | `docs/DOCS_RULES.md`、`docs/operations/AI_DLC_WORKFLOW.md`、後続の日付付き計画は`docs/plans/`。計画やclosed traceでcurrent設計を置き換えない。 |
