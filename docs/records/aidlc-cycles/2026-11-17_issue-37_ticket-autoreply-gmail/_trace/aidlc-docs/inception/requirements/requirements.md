# Requirements — ticket予約の控えをメールで届ける（Issue #37）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-17_issue-37_ticket-autoreply-gmail`
- Reader: human_reader / ja-JP / CotEditor（表示はFrontが担当）

## 目的と変更後の体験

公開フォームで予約した人に、申し込み内容の控えをメールで残す。同じ控えを`1212ki.info@gmail.com`にもBCCで届ける。差出人は同アカウントが所有するGoogle Apps ScriptからのGmailとする。外部メール送信サービスへの登録やDNS設定を必要にしない。

ticketページでは操作の案内文と自動返信の注意文を項目ごと外す。完了文の既定値は「予約しました。」とし、保存済みの`completeText`はそのまま表示する。メール送信の成否を画面の成功条件に加えない。

## 要件

| ID | 実装する契約 |
|---|---|
| R1 | 公開予約のDB保存成功後、WorkerがApps Script Webアプリへ受付ID・ライブ（日付と会場）・名前・e-mail・枚数・備考と合言葉をPOSTする。既存の`ctx.waitUntil`による通知分離を維持する。予約失敗・honeypot・重複拒否では送らない |
| R2 | Apps Scriptは設定済み合言葉と一致し、必須項目が揃い、単一メールアドレスと1〜10枚の枚数が妥当な場合だけGmailで送る。備考はキー必須・空文字可で、本文には「なし」と表示する。合言葉不一致・不足項目・不正入力・重複parameterでは送らない |
| R3 | 宛先は申込者1名、BCCは固定の`1212ki.info@gmail.com`。件名は「ticket予約の控え | 松本一樹」、差出人表示名は「松本一樹 ticket」。本文は受付ID・ライブ・名前・e-mail・枚数・備考を含む申込者向けの日本語。詳細な逐語コードはCode Generation Plan §3に固定する |
| R4 | WorkerのURLまたは合言葉未設定なら送信をskipする。通信・HTTP・応答形式・Apps Script送信失敗でも予約APIは既存の201成功のまま。手動取り置き（`source: manual`）では送らず、LINE通知のコード・設定は変えない。自動再送や送信状態のDB追加は行わない |
| R5 | `ticket.introText`・`ticket.noticeText`を公開HTML、公開JS、管理画面の設定項目・既定値・正規化、Workerの既定値・正規化から外す。旧D1値は移行削除せず、読み込み時の正規化で除外する。保存値が残る／APIが旧payloadを返す／API読込に失敗する場合も公開フォームに出ない。完了ページの静的既定文とWorker・adminの既定`completeText`から自動返信の言及を外す。保存済み`completeText`を置換しない |
| R6 | repoにApps Scriptの`doPost`全文とOwner設定手順を置く。Ownerが`1212ki.info`で作成し、Script Propertiesに合言葉を設定し、実行者を自分・アクセスを全員としてWebアプリ公開する。URLと同じ合言葉をWorker secretへ登録する。認証は公開ブラウザへ渡さない |
| R7 | current canonicalは`docs/DOCS_RULES.md`のmapに従う。Live設計・索引とWorker README・wrangler例をCode Generation Planの逐語差分に揃え、Draft→Approved後に実装する。確認1（gate 1〜3）のgate 3承認がcanonical本文のOwner確認を兼ねる。確認2（gate 4〜5）の前に独立reviewを実装後1回行う |

## 受入条件と証拠

| ID / Issue #37の受入条件 | 合格にする観測 |
|---|---|
| AC-37-01 / 1（R1） | fetch stubで保存済み予約からPOST先・content type・7 parameter（6項目と合言葉）を検証する。公開API成功は201・DB insert 1回。拒否・honeypotでは送信0回 |
| AC-37-02 / 2（R2・R3） | Node VMでrepoのApps Scriptコードを直接実行し、GmailApp stubの宛先・BCC・表示名・件名・本文6項目を検証する。合言葉不一致／設定なし／各必須キー欠落／不正e-mail・枚数／重複parameterは送信0回。備考空は「なし」 |
| AC-37-03 / 3（R4） | URL・合言葉の未設定、fetch拒否、HTTP非2xx、200で`ok: false`、JSON不正を確認し、公開予約は成功のまま。既存手動取り置きtestは新しいsecretが両方あっても送信0回。LINE処理の差分なし・既存test PASS |
| AC-37-04 / 4（R5） | 公開HTMLに2要素がなく、JSに描画処理がなく、adminに2設定欄がない。旧値入りD1 stubの公開APIから2キーが出ず、旧payloadを受ける公開DOMでも出ない。既定完了文は「予約しました。」、保存済み「予約しました。当日はお気をつけて！」は引き続き表示される。contactと既存入力・確認・完了の構成は維持 |
| AC-37-05 / 5（R6） | Apps Script公開・secret登録・deploy後、Ownerが公開フォームで試し、申込者と`1212ki.info@gmail.com`の両方へ同じ控えが届き、差出人・内容を確認する。自動testやcycle closeでは達成としない |
| AC-37-06 / 運用整合（R7） | canonicalがgate 3の逐語差分と一致し、設定手順・focused RED→GREEN・全回帰・独立reviewの証拠が結果にある。5 gateは各artifactのexact digestに対応する |

AC-37-05は本番操作後のOwner確認待ちとして残せる。実装・自動検証・独立review・gate承認・Front受入・本番到達を別の信号として記録する。

## 範囲外

- contactフォームとその文言、LINE通知の設定、`@1212hp.com`の差出人、外部メール送信サービスの導入。
- 予約入力項目・確認画面・完了画面の構成変更（上記の文言項目削除を除く）。
- 本番deploy・merge、Apps Script作成・公開、secret登録はOwnerの操作。今回の候補作成ではcanonical・code・test・承認記録を変更しない。

## 選択と失敗時の扱い

form-encoded bodyに合言葉を置く。queryはURLへの混入、headerはApps Scriptイベントから読めないため採用しない。secret名は既存`TICKET_AUTOREPLY_FORM_URL`を維持し、`TICKET_AUTOREPLY_TOKEN`を追加する。本文はApps Script側で6項目から組み立て、任意の宛先・BCC・subject・bodyを依頼側から指定させない。

旧D1値の物理削除は不要。Worker・adminの正規化で2キーを落とし、公開HTMLとJSから描画口を外す。次回の通常保存では正規化後の値が保存されるが、移行SQLや本番D1操作は行わない。

## リスクと未確認事項

| 区分 | 影響と対処 |
|---|---|
| Fact（FrontがGoogle公式docsで確認） | 個人Gmailは1日100宛先。BCCも数えるので1予約2宛先なら最大50件／日。他の送信があればさらに少ない。上限でメールが失敗しても予約は成功する。再送キューは今回追加しない |
| Gap | GoogleのPOST後302 redirectと最終応答は未観測。Workerは既定redirect追従と最終HTTP成功＋JSON `ok: true`で判定する。stubのPASSは実到達を証明しない。Ownerが公開後に確認し、異なる応答ならFrontへ返して修正・必要な再承認を行う |
| Risk | 合言葉が漏れると第三者が任意の申込者へ固定書式のメールを送り、BCCや日次枠を消費できる。OwnerがWebアプリ公開を停止し、Script PropertiesとWorker secretの合言葉を更新する。送信停止だけならWorkerのURL secret解除も使えるが、漏洩したWebアプリ自体の停止も必要 |
| Risk | 申込者に個人Gmailアドレス`1212ki.info@gmail.com`が差出人として見える。表示名でもアドレスは隠れない。Owner指定の送信元として採用する |
| Risk | 合言葉・予約個人情報はbodyだけで送り、URL・ログ・エラー本文・公開APIへ出さない。受信拒否や迷惑メール判定、送信後の不達は自動testでは分からない。自動再試行・重複送信防止の新設は範囲外 |

## 参照

Issue #37の写しと本人原文・Front検証の出典は`aidlc-docs/audit.md`。実装契約は`construction/plans/aidlc-integration-code-generation-plan.md`、工程は`inception/plans/execution-plan.md`。Google公式docsの確認はFront提供の2026-11-17時点の事実で、このWorkerはnetwork・secret・D1にアクセスしていない。
