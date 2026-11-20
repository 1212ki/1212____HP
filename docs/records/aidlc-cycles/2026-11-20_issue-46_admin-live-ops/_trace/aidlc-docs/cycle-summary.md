# Cycle Summary — 管理画面のよくする3つ（Issue #46）

- Cycle ID: `2026-11-20_issue-46_admin-live-ops`
- Issue: #46
- Branch: `feature/46-admin-live-ops` / base `e191e53ada480014e03ad2fa23835f6178ce371a`
- Status: 完了（Complete）。実装・自動の試験・Frontの撮影（6回。最終は150枚すべて合格）と目視・独立review（APPROVED）を経て、確認2（gate 4・5）をItsuki本人が2026-11-21T07:49:47+09:00にAで承認し、cycleを閉じた。Itsukiが触る確認・実機・Worker deploy前後の確認・merge後の本番の確認は未実施で、cycleの外（PR・deploy・mergeの段）で行う
- **Blocking Findings**: None
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

## 何ができるようになったか

Itsukiがスマホで、新しいライブの登録・告知・予約の管理を、今より少ない操作で終えられる管理画面になりました（Live一覧・開いた画面の公開内容／告知／予約・予約管理・Ticket Page共通設定）。一覧に「予約 N枚」「未対応 N」が出て、ライブを開くと入力欄がすぐ見え、「保存して公開」は変更がある時だけ出ます。新しいライブは「下書きを作る」→「保存して公開」→「Xで告知する」の3つで進みます。外枠の接続の表示は、API接続中はHeaderの「接続中」だけになり、帯は接続失敗とLocal Modeの時だけ出ます。

保存・削除・予約の状態変更・取り置き・告知文・共有用のアドレスは、今と同じ送り方・同じ数え方のまま動きます（先に試験で固定してから画面を変えました）。Live・削除・Ticket Page共通設定の保存は、ほかのタブの未保存の変更を一緒に公開しない形（最後に保存できた内容に、その操作の対象だけを重ねて送る）です。Cloudflare Workerには、一覧のための件数だけを返す読み取りを1つ足しました（追加だけ。個人情報は返しません）。予約の数の読み取りが失敗しても、基準のAPIの切り替えや読み取り専用への切り替えは起こりません。

## 確認2で知っておいてほしいこと（詳細は`code-generation-summary.md` §4・§11）

- **要件の食い違いを1つ、承認済みの側で解いた**: R46-02・S46-14の「保存すると使えます。」と、R46-07・Figma `44:546`の「新しいライブの確認の画面に切り替えを出さない」は両立しません。後者を採ったので、この文は画面に出ません（独立review RV46-02。直していない）。
- 先の Issue（#43・#44・#45）の保護試験3ファイル（4件）を更新しています（守りたい事実は commit どうしの比較で保っています）。
- 幅1440の見出しの状態の文字は「保存済み」だけです（マスタの「開催予定・保存済み」ではありません）。
- Headerの「接続中」は、今のHeaderの小さい文字の場所です（Figmaの右寄せ・高さ46pxの形ではありません）。
- 既知の制限: Ticket Page共通設定の保存は`ticket`を6項目だけに置き換えます（RV46-03。直していない）。

## 経過

- Frontが6回撮影した（同じscript・headless Chromiumだけ。本番へ届いたrequestは全回0件）。1回目は150枚が不合格、修理（Packet 04）の後の2回目は143枚合格、修理（Packet 05）の後の3回目は41枚不合格（40枚は撮影scriptの検査の誤り、1枚は失敗の理由の行が消えた）、4回目は149枚合格。Frontが直接、検査の誤りと理由の行の2つを直し、5回目（該当8枚）・**6回目（最終）は150枚すべて合格**。
- Frontの目視: スマホ幅73枚は縮小の一覧で全部。幅821〜1440の77枚は縮小の一覧12枚と原寸1枚（残りはPacket 05のWorkerが原寸で見た）。
- Frontが直接入れた変更2つ: 撮影scriptの覆いの検査が閉じた`details`の中身を測らない（4行）。同じ予約を描き直す時に失敗の理由の行の文を残す（`admin/app.js`の2か所）。
- 独立review: **APPROVED**、指摘4件はすべて`blocking: false`。RV46-01（外枠の接続の表示）・RV46-04（集計の読み取りの基準の切り替え）は直した（Packet 06）。RV46-02（「保存すると使えます。」）・RV46-03（`ticket`の置き換え）は直さず、確認2で示す。
- Packet 06: D1（接続の表示）・D4（集計の読み取り）・D5（理由の行の試験）・D6（撮影script）。詳細は`code-generation-summary.md` §11.5。

## 結果

- サイトの試験 989 pass / 0 fail（基準 776。Packet 06で+18）、Workerの試験 361 pass / 0 fail（基準 347）。`node --check`・撮影script3つの構文と`--self-check`・`scripts/aidlc-verify.sh --local`・`scripts/aidlc-cycle.sh status`・`git diff --check`は成功。T46-PINは無変更で通る。試験数の内訳は`build-and-test-summary.md` §11.2。
- Workerの差分は追加だけ（`git diff e191e53 --numstat`で`40 0`）。設計書2文書は提案版と同じbytesで昇格済み。
- 結果の文書: `construction/aidlc-integration/code/code-generation-summary.md`（Code Generation Result。何ができるようになったか・昇格とSHA-256・実装箇所・計画・要件からの差・更新した既存試験の表・ACの証拠・既知の制限・未実施）、`construction/build-and-test/build-and-test-summary.md`（Build/Test Result。command・pass/fail・RED→GREEN・試験数の内訳・close前の検査・残るGap）。

## 計画・要件からの差（要点。詳細は`code-generation-summary.md` §4・§5）

- 先の Issue（#43・#44・#45）の保護試験4件（3ファイル）が、#46が変える`admin/`・`cloudflare/`に反応したため、守りたかった事実を commit どうしの比較で保つ形に改め、許可リストに #46 のファイルを名前で足した（Frontの決定。assertは消していない。Itsukiには確認2で示す）。
- 上の要件の食い違い（「保存すると使えます。」）、幅1440の見出しの状態の文字、Headerの「接続中」の置き場所。
- 幅900〜1179pxの予約は2行の形（表は幅1180px以上）。予約の表に「ひらく」「ライブ」の列を足していない。日付の表記は`formatLiveDate`の出力。
- 撮影は、静的配信のserverもbindも要らない作りにした（`context.route`が必要なファイルだけをrepoから応える）。

## まだ確かめていないこと

Frontの撮り直し（外枠の接続の表示を変えた後の`capture-admin-live.py`の再実行。見る点は`code-generation-summary.md` §11.10）、Itsukiが触る確認（手元配信`fake_admin_server.py`）、Worker deployの前後の読み取りの確認、merge後の本番の確認と本番の予約の件数の桁での見え方、実機（iOSのSafari）。これらは「未実施」で、この文書は結果を先取りしない。

## 出し方（予定。別の明示承認が要る）

Worker deploy（Itsukiの明示承認。戻し先を控える）→本番の古い管理画面が今のまま動くことの確認→PRのmerge（Itsukiの明示承認。mergeで本番の管理画面が入れ替わる）→merge後の確認。rollbackは`construction/plans/aidlc-integration-code-generation-plan.md` §9。

## 確認2の承認とclose（Worker 07、2026-11-21）

- 確認2: Itsuki Matsumotoが2026-11-21T07:49:47+09:00にraw response `A`を返した（Prompt 2026-11-21T03:16:05+09:00）。Code Generation ResultとBuild/Test Resultの2対象のexact digestを承認した。原典は`gate-45-owner-responses.md`（SHA-256 `092172ef4c3ed5e2f883b2c62a5b648472000c4c281e597778139f7bca739623`）。`approvals/04`・`05`へ逐語で転記した。
- 承認の範囲: merge・Worker deploy・PRの承認は含まない。要件・マスタと違う所（新しいライブの確認の画面で「保存すると使えます。」が出ない、幅1440の見出しの状態は保存の状態だけ、「接続中」の置き場所、Ticket Page共通設定の保存は置き換え、先の Issue の保護試験4件の更新）は、Itsukiに示したうえでAを得た。
- Front completion: VECTORが、実装・試験（Frontの再実行でサイト989 / 0、Worker 361 / 0）、撮影（7回目で150枚すべて合格、本番へ届いたrequest 0件）、Frontの目視（スマホ幅73枚すべてと幅821〜1440の13枚）、独立review1回と指摘の反映、結果文書の受入、手元配信とtunnelの通信先の確認、確認2のAを確かめ、closeを許可した。
- cycleの外に残ること: Itsukiが手元配信を触ったかどうか（記録していない）、実機のiPhoneのSafari、Worker deployの前後の読み取りの確認、mergeの後の本番の確認。
- Blocking Findings: None（上の先頭の項目のとおり）。本番の値は書いていない。
