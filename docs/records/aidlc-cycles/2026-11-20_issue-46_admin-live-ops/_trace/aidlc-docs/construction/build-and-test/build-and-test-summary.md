# Build/Test Result — 管理画面のよくする3つ（Issue #46）

- Status: 確認2（gate 5）の候補 / Owner承認待ち（承認記録は作っていない）。最終の結果は §11（Frontの6回の撮影・独立review・Packet 06の修理の後）。この後にFrontの撮り直し（外枠の接続の表示を変えた後の1回）がある
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-20_issue-46_admin-live-ops`
- Execution target: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-46-admin-live-ops`
- Branch: `feature/46-admin-live-ops` / base `e191e53ada480014e03ad2fa23835f6178ce371a`
- **Blocking Findings**: None
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

この文書は、Workerが実行した自動の試験・検査の結果です。§1〜§10は各Packet時点の記録、**最終は§11**。Frontの撮影（6回。最終は150枚すべて合格）と独立review（APPROVED）の結果は§11に書きました。Frontの撮り直し（外枠の接続の表示を変えた後）、Itsukiが触る確認、Worker deploy前後の読み取りの確認、merge後の本番の確認は**この後に行うので「未実施」**で、結果を先取りしていません。`Blocking Findings: None`は、このPacketまでに見つかった未解決の阻害事項がないことを指し、未実施の確認が通ることを意味しません。

## 1. 実行したcommandと結果（最終。段8。Packet 04の修理の後は§9、Packet 05の修理の後は§10）

Node v20.19.4（`node --test test/`はv24で動かないので必ずv20.19.4）。log は`aidlc-docs/construction/aidlc-integration/verification/logs/`。

| command | 結果 | log |
|---|---|---|
| `node --test test/` | tests 952 / pass 952 / fail 0 / skipped 0 / cancelled 0 | `stage8-final-site.log` |
| `npm --prefix cloudflare/worker test` | tests 361 / pass 361 / fail 0 | `stage8-final-worker.log` |
| `node --check admin/app.js`・`node --check cloudflare/worker/src/worker.js` | 成功 | `stage8-syntax.log` |
| 撮影script3つの構文（`python3 -B -c 'import ast,sys; …'`。`/usr/bin/python3`でも） | 成功 | `stage8-syntax.log` |
| `/usr/bin/python3 …/capture-admin-live.py --self-check`（ブラウザ・bindなし） | 契約OK: 150画像 / 16画面 / 14 scenario（`fake_admin_api.py`・`fake_admin_server.py`の自己検査を含む） | `stage8-syntax.log` |
| `scripts/aidlc-verify.sh --local` | passed（sandboxが`/dev/fd`・`/private/tmp`を拒むので、`diff`・`mktemp`のshimをPATH先頭に置いて実行。script本体は変えていない） | `stage8-aidlc-verify.log` |
| `scripts/aidlc-cycle.sh status` | 成功（Current Stage: CONSTRUCTION - Code Generation / In Progress） | `stage8-cycle-status.log` |
| `git diff --check` | 成功 | `stage8-syntax.log` |

### 基準との差の内訳

基準（Front着手前）はサイト776 pass / 0 fail、Worker 347 pass / 0 fail。基準より減っていない。

| | tests | 内訳 |
|---|---:|---|
| サイト 基準 | 776 | |
| 段1: harnessの切り出し | +1 | `test/support/admin-app-harness.mjs`がnodeにtest fileとして数えられる分（切り出し直後 777） |
| 段1: T46-PIN・T46-FIXTURE | +30 | `admin-live-pin.test.mjs`（段1。変更前のコードでGREEN）。のち、段3のT46-SUMの比較を同じファイルに足した分を含む |
| 段3: 保存の土台 | +38 | `admin-live-save.test.mjs`（T46-SAVE・GUARD・DELETE・SCOPE・TICKET）→ 845 |
| 段4〜6 | +72 | `admin-live-screens.test.mjs`（T46-LIST・OPEN・FIELDS・NEW・DRAFT・ANNOUNCE・IMAGE・RESERVE・AUTH）→ 917 |
| 段7・8 | +34 | `admin-live-style.test.mjs`（T46-STYLE 19・MODE 6・COMPAT 6・VERSION 3＝計34のうち、段7が31、段8が3）|
| 段8 | +1 | `admin-live-pin.test.mjs`にfixtureの全体データの変種（`sites`）の試験を1つ |
| サイト 最終 | **952** | 776 + 1 + 30 + 38 + 72 + 34 + 1 |
| Worker 基準 | 347 | |
| 段2: T46-SUM | +14 | `cloudflare/worker/test/ticket-reservation-summary.test.js` |
| Worker 最終 | **361** | 既存のWorker試験は無変更 |

既存の試験は減っていない。意図して置き換えた試験（assertは消していない）の表は`code-generation-summary.md` §5。

## 2. RED→GREENの記録

新しい試験は先にREDを確かめた（実装前のコード＝基準の`admin/`・Workerを使う複製に対して流す）。T46-PINだけは「今の動きの固定」なので変更前のコードでGREEN。

| 段 | 試験 | RED | GREEN |
|---|---|---|---|
| 1 | T46-PIN・T46-FIXTURE | 該当なし（変更前のコードでGREENで固定） | `stage1-pin-green.log` |
| 2 | T46-SUM（Worker 14件） | `stage2-sum-red.log`（`summarizeTicketReservationRows`が無い） | `stage2-sum-green.log`（`manual-ticket-reservations`・`public-ticket-boundaries`を無変更で通す） |
| 3 | T46-SAVE・GUARD・DELETE・SCOPE・TICKET（38件） | `stage3-save-red.log`（37件中32件が失敗、5件は元から満たす動きの保護） | `stage3-final-site.log` |
| 4 | T46-LIST（19件） | `stage4-list-red.log`（17件が失敗） | `stage4-list-green.log` |
| 5 | T46-OPEN・FIELDS・NEW・DRAFT・ANNOUNCE・IMAGE | `stage5-screens-red.log`（22件が失敗） | `stage5-screens-green.log` |
| 6 | T46-RESERVE・T46-AUTH | `stage6-reserve-red.log`（20件が失敗） | `stage6-final-site.log`・`stage6-focused-green.log` |
| 7 | T46-STYLE・MODE・COMPAT・VERSION（`admin-live-style.test.mjs`） | `stage7-style-red.log`（**34件中27件が失敗**。残る7件は基準のコードでも成立する保護＝T46-COMPAT 6件とLocal Mode・読み取り専用でheader保存が残ること） | `stage7-focused-green.log`（style・screens・operations 288件）、最終 `stage8-final-site.log` |
| 8 | 撮影script・架空API・手元配信・README・版 | 構文・`--self-check`・各scriptの自己検査（bindなし） | `stage8-syntax.log` |

注: 段7は、実装を先に書いてから試験を書く順序になった。試験は実装後に、基準のコードの複製に対して流してREDを確認している（上の表）。

### T46-PINが通り続けること

`test/admin-live-pin.test.mjs`（31件）は最終の全試験で全件pass。変えたのは、(e) の合計の見せ方、T46-FIXTUREの説明の欄、fixtureのkey一覧に`sites`を足した分だけ（`code-generation-summary.md` §5）。状態の変更・取り置きの送る内容・検査・数え方・保存のPUT・告知文・共有用のアドレス・Ticket設定の保存の形のassertは無変更。

## 3. AC46-01〜14の証拠

`code-generation-summary.md` §6の表のとおり（自動で確かめたことと、まだ確かめていないこと）。撮影の実測（AC46-01・04）、本番の件数の見え方（AC46-03・14）、deploy後の確認（AC46-09）は未実施。

## 4. canonicalの照合

| 項目 | 結果 |
|---|---|
| `docs/specs/current/live-operations-admin-ui.md` | SHA-256 `4035f4e793a44f414eea787d4b9a79314d12ee98f3649fcb72bb9d748ea7ef8a`（提案版と一致。このPacketで変更なし） |
| `docs/specs/current/README.md` | SHA-256 `d5b35b8eb81f438dacc60037830dcaa8dc5beb994a2335feff16aaf8ba63cb3e`（同上） |
| 承認済みのRequirements・Workflow Plan・Code Generation Plan・`figma-fix-requests.md` | `code-generation-summary.md` §1のSHA-256と一致（bytesを変えていない） |
| Figma マスタ v2 | `figma-snapshot-v2/SHA256SUMS` `6d1539a1c210915145b5583f827aec959c9bde239b69dde4bbdb42b4d8b60d41`。Frontが整合案のうちマスタを直すとした9件（F46-01〜05・07〜10）と要件メモ`39:833`の1句を反映済み（意図しない変更0件）。`audit.md`に「Front追補」として追記した |
| `assets/`・tokens・`DESIGN_RULES.md`・`admin/config.js`・`admin/data/`・`cloudflare/worker/schema.sql`・`wrangler.toml`・`data/`・公開側のHTML | 変更なし（`git status`に出ない。`assets/js/live-operations.js`のbytesは基準と同じ。T46-COMPAT） |

## 5. 承認記録の検査

`scripts/aidlc-cycle.sh`の`validate_approval`（関数を取り出して実行）で、Requirements・Workflow Plan・Code Generation Planの3件がPASS（`approvals/01〜03`のSHA-256は`code-generation-summary.md` §1）。gate 4・5の承認記録は作っていない。

## 6. 変更範囲とWorkerの差分

`git status --short`（`aidlc-docs/`を除く。` M aidlc-docs/README.md`は着手前からの差分でWorkerの変更ではない）:

- 変更: `admin/app.js`・`admin/index.html`・`admin/style.css`・`admin/README.md`、`cloudflare/worker/src/worker.js`・`cloudflare/worker/README.md`、`docs/specs/current/{README.md,live-operations-admin-ui.md}`（昇格）、`test/{admin-image-form,admin-live-operations,live-ticket-shell,profile-contact-shell,site-shell}.test.mjs`
- 新規: `cloudflare/worker/test/ticket-reservation-summary.test.js`、`test/{admin-live-pin,admin-live-save,admin-live-screens,admin-live-style}.test.mjs`、`test/fixtures/admin-live-states.json`、`test/support/admin-app-harness.mjs`、`aidlc-docs/…`（approvals・inception・construction・state・audit・cycle-summary）
- 計画 §3 のファイルと保護試験3ファイルと`aidlc-docs/`だけ。許可リスト（`live-ticket-shell.test.mjs`）に足した#46の行は前のPacketのもので、このPacketでは広げていない（`test/admin-live-style.test.mjs`・`admin/README.md`・`cloudflare/worker/README.md`・`aidlc-docs/…/verification/*.py`は既に許可済みの名前・場所）。
- **Workerの差分は追加だけ**: `git diff e191e53 --numstat -- cloudflare/worker/src/worker.js` = `40 0`（削除0行）。このPacketでは`worker.js`を変えていない。
- 本番の値: fixture・試験・文書・scriptに本番データの値は入れていない（fixtureのURLがすべて`example.test`、本番の名前・会場・予約者がないことを`T46-FIXTURE`が検査。撮影scriptの`--self-check`も検査）。`admin/config.js`・secret・予約のデータは参照していない。network接続なし（localhostも使っていない）。

## 7. close前の検査（事前）

使い捨てのコピー（`_scratch/codex-work/20261120-145511_1212hp-46-admin-live-ops/close-dryrun/`）に、gate 4・5の仮の承認記録とCompleteのstateを置き、`scripts/aidlc-cycle.sh`の`validate_close_ready`を取り出して通した。結果と方法は`worker-02c-result.md`（本物の`aidlc-docs/`には仮の記録・Completeのstateを置いていない）。

## 8. 残るGap・未実施

- **未実施（この後に行う。結果を先取りしない）**: Frontの撮影（`capture-admin-live.py`の実行）・全画像の目視とFigma v2との照合、Itsukiが触る確認（手元配信）、独立review（Frontが手配）、Worker deployの前後の読み取り確認、merge後の本番の確認。
- 撮影・手元配信はWorkerのsandboxがlocalhostをbindできず、実行していない（構文と契約の検査まで）。画像が無いことを合格と書かない。
- 実機（iOSのSafari）の`beforeunload`・キーボード・安全領域、本番の予約の件数の桁での見え方、1ライブ200件超の予約での集計と台帳の差、幅900px以上の「区分と削除」の1行配置（未実装）、新しいライブの`edit`で「保存すると使えます。」が画面からは届かないこと（`code-generation-summary.md` §8）。
- `T46-STYLE`の「Live以外のまとまりのbytes」と`T46-COMPAT`の「他のタブの描画」は、基準commitとの比較（`git show`）で書いた。後続の#47が`admin/`のそれらを変える時は、`test/admin-live-style.test.mjs`の`LATER_ISSUE_STYLE_GROUPS`・`LATER_ISSUE_TABS`に名前を足す（#46が#43〜#45の保護へ許可を足したのと同じ流儀。#47の作業を黙って止めないよう、足すのは1行）。

## 9. Packet 04（Frontの初回撮影の後の見た目の修理）の後の結果

Frontの初回撮影は150枚とも自動の合否が不合格だった（内訳と直した所は`code-generation-summary.md` §9）。このPacketは、撮った画像とFigma v2のrenderを読み比べて`admin/index.html`・`admin/app.js`・`admin/style.css`・撮影script・試験を直した。撮り直しはしていない（localhostをbindできない）。**撮り直し・全画像の目視・独立review・Itsukiが触る確認は未実施**。

Node v20.19.4。log は`aidlc-docs/construction/aidlc-integration/verification/logs/`の`packet04-*.log`。

| command | 結果 | log |
|---|---|---|
| `node --test test/` | tests 964 / pass 964 / fail 0 / skipped 0 | `packet04-final-site.log` |
| `npm --prefix cloudflare/worker test` | tests 361 / pass 361 / fail 0（`worker.js`は無変更） | `packet04-final-worker.log` |
| `node --check admin/app.js`・`node --check cloudflare/worker/src/worker.js` | 成功 | `packet04-syntax.log` |
| 撮影script3つの構文（`python3 -B -c 'import ast,sys; …'`） | 成功 | `packet04-syntax.log` |
| `/usr/bin/python3 …/capture-admin-live.py --self-check` | 契約OK: 150画像 / 16画面 / 14 scenario | `packet04-syntax.log` |
| `scripts/aidlc-verify.sh --local` | 下の「aidlc-verify」を参照 | `packet04-aidlc-verify.log` |
| `git diff --check` | 成功 | `packet04-syntax.log` |

試験の数: サイト 952 → **964**（+12: `admin-live-style.test.mjs`に9件＝特異度の対・フライヤー・空の注記が高さを取らない・全幅で44px・幅390の一覧・開いている間の全幅と灰色の面・幅900px以上・公演の中の切り替えの色、`admin-live-screens.test.mjs`に3件＝確認の画面の知らせ・失敗の時と既存のライブ・予約管理で「+ 新しいライブ」が隠れる）。Worker 361のまま。減った試験はない。

意図して更新した既存試験2件は`code-generation-summary.md` §5.5（試験名・理由・変えていない動きのassert）。`test/admin-live-pin.test.mjs`（T46-PIN）は無変更で通る。

RED→GREEN: 新しい試験は、修理の前の`admin/`では成立しない内容（`.live-workspace`で特異度を上げた規則・`#live-draft-notice`・`#live-add-btn`の置き場・列の定義）を検査するので、修理の前のコードでは落ちる。REDのlogは取っていない（修理の後に試験を足した順序。検査の効き目は、特異度の関数を数例で確かめた）。

画像でしか分からない見え方（実際の描画）は、撮影scriptの実測の検査に足した（編集面からのはみ出し、日付・会場・ライブ名の間が44px前後、出していない注記の高さ0、幅390の一覧の切り替えの2等分・ボタンの幅と位置、フライヤーの操作の右端）。撮影の実行はFront。

残る未実施: Frontの撮り直し（`capture-admin-live.py`の再実行）・全画像の目視とFigma v2との照合、Itsukiが触る確認、独立review、Worker deployの前後の読み取り確認、実機（iOSのSafari）、本番の予約の件数の桁での見え方。`Blocking Findings: None`は、Packet 04までに見つかった未解決の阻害事項がないことを指し、未実施の確認が通ることを意味しない。

## 10. Packet 05（Frontの2回目の撮影の後の修理）の後の結果

Frontの2回目の撮影（Packet 04の修理の後）は、150枚のうち143枚が合格・7枚が不合格だった（本番へ届いたrequestは0件。内訳と直した所は`code-generation-summary.md` §10）。このPacketは、不合格の2種類（幅1440で見えない下の帯が操作を覆う実装の不具合、取り置きの入力の誤りが出ない実装の不具合）を直し、150枚のうち147枚を原寸でReadで開いてFigma v2・Requirements・設計書と見比べて見つけた食い違いも直した。撮り直しはしていない（localhostをbindできない）。**3回目の撮影・Frontの全画像の目視・独立review・Itsukiが触る確認・Worker deploy前後の確認は未実施**。

Node v20.19.4。log は`aidlc-docs/construction/aidlc-integration/verification/logs/`の`packet05-*.log`。

| command | 結果 | log |
|---|---|---|
| `node --test test/` | tests 971 / pass 971 / fail 0 / skipped 0 / cancelled 0 | `packet05-final-site.log` |
| `npm --prefix cloudflare/worker test` | tests 361 / pass 361 / fail 0 / skipped 0（`worker.js`は無変更） | `packet05-final-worker.log` |
| `node --check admin/app.js`・`node --check cloudflare/worker/src/worker.js` | 成功 | `packet05-syntax.log` |
| 撮影script3つの構文（`/usr/bin/python3 -B -c 'import ast,sys; …'`） | 成功 | `packet05-syntax.log` |
| `/usr/bin/python3 …/capture-admin-live.py --self-check` | 契約OK: 150画像 / 16画面 / 14 scenario（覆われた操作・潰れた行が不合格になる検査を足した） | `packet05-syntax.log` |
| `scripts/aidlc-verify.sh --local`（`diff`・`mktemp`のshimをPATH先頭に置いて実行） | passed | `packet05-aidlc-verify.log` |
| `scripts/aidlc-cycle.sh status` | 成功（Current Stage: CONSTRUCTION - Code Generation / In Progress） | `packet05-cycle-status.log` |
| `git diff --check` | 成功 | （出力なし） |

試験の数: サイト 964 → **971**（+7: `admin-live-style.test.mjs`にT46-OVERLAP 3件・T46-MANUAL 1件・T46-STYLE 3件）。Worker 361のまま。減った試験はない。**既存の試験は変えていない**（足しただけ。T46-PIN・保護試験3ファイル・既存のT46-STYLEは無変更で通る）。

RED→GREEN（変異による確認）: 新しい試験は、修理の後に足したので、通常のREDのlogは無い。代わりに、修理を1つずつ外して落ちることを確かめた（結果は次のとおり。`style.css`・`app.js`は確認の後に元へ戻し、`cmp`で一致を確認）: 幅900px以上の`bottom: auto`と`.live-workspace`の規則を外すとT46-OVERLAPの1件目が落ちる。理由の行の`margin-bottom`を16pxへ戻す・ライブごとの予約の2行の形（`display: flex`）を外すと、T46-OVERLAPの理由の行の1件とT46-STYLEの予約の行の1件が落ちる。`novalidate`を外すとT46-MANUALが落ちる。

画像でしか分からない見え方は、撮影scriptの実測の検査に足した（全操作の中心の点で一番上の要素がその操作自身か＝`covered`、幅900〜1179pxの予約の行の名前の欄、`comment-filled`の中身、`status-failed`の理由の行が撮影の後も残るか）。本番へ届くrequestが0件の検査は緩めていない。合否の基準を変えた所は`code-generation-summary.md` §10.5（幅900〜1179pxの予約の6列を要求しない。名前の欄の幅120px以上を新しく要求）。

fixtureに`xComment`を足す案は、T46-FIXTURE（形の固定）が落ちたので戻し、撮影scriptの`data_patch`で足す形にした（fixtureは無変更）。

残る未実施: Frontの3回目の撮影・全画像の目視とFigma v2との照合、Itsukiが触る確認、独立review、Worker deployの前後の読み取り確認、実機（iOSのSafari）、本番の予約の件数の桁での見え方。`Blocking Findings: None`は、Packet 05までに見つかった未解決の阻害事項がないことを指し、未実施の確認が通ることを意味しない（`reservation-detail-status-failed-1440`の理由の行が画像に写らなかった件は、原因を特定できていない。撮影scriptに手がかりを足した。`code-generation-summary.md` §10.3のH10）。

## 11. 最終の結果（Frontの6回の撮影・独立review・Packet 06の修理の後）

独立reviewはAPPROVED（指摘4件、すべて`blocking: false`）。Packet 06は、そのうちRV46-01（外枠の接続の表示）・RV46-04（集計の読み取りの基準の切り替え）を直し、Frontが直接入れた修理（失敗の理由の行を残す）に試験を足し、撮影scriptを直した。RV46-02（「保存すると使えます。」が画面に出ない）・RV46-03（`ticket`の置き換え）は直さず、`code-generation-summary.md`の§4・§11.8に書いた。

### 11.1 実行したcommandと結果（最終）

Node v20.19.4。log は`aidlc-docs/construction/aidlc-integration/verification/logs/`の`packet06-*.log`。

| command | 結果 | log |
|---|---|---|
| `node --test test/` | tests 989 / pass 989 / fail 0 / skipped 0 / cancelled 0 | `packet06-final-site.log` |
| `npm --prefix cloudflare/worker test` | tests 361 / pass 361 / fail 0 / skipped 0 / cancelled 0（`worker.js`は無変更） | `packet06-final-worker.log` |
| `node --check admin/app.js`・`node --check cloudflare/worker/src/worker.js` | 成功 | `packet06-syntax.log` |
| 撮影script3つの構文（`python3 -B -c 'import ast,sys; …'`。`/usr/bin/python3`でも） | 成功 | `packet06-syntax.log` |
| `/usr/bin/python3 …/capture-admin-live.py --self-check`（ブラウザ・bindなし） | 契約OK: 150画像 / 16画面 / 14 scenario（閉じた`details`を測らない規則・接続の表示の検査を足した） | `packet06-syntax.log` |
| `git diff --check` | 成功 | `packet06-syntax.log` |
| `scripts/aidlc-verify.sh --local`（`diff`・`mktemp`のshimをPATH先頭に置いて実行） | passed（`AI-DLC local integrity verification passed: v1.0.1`。sandboxが`/dev/fd`・`/private/tmp`を拒むので、script本体は変えず`diff`・`mktemp`のshimをPATH先頭に置いた） | `packet06-aidlc-verify.log` |
| `scripts/aidlc-cycle.sh status` | 成功（Current Stage: CONSTRUCTION - Code Generation / In Progress） | `packet06-cycle-status.log` |

### 11.2 試験数の基準からの差の内訳

基準（Front着手前）はサイト776 pass / 0 fail、Worker 347 pass / 0 fail。基準より減っていない。

| | tests | 内訳 |
|---|---:|---|
| サイト 基準 | 776 | |
| 段1: harnessの切り出し | +1 | `test/support/admin-app-harness.mjs`がnodeにtest fileとして数えられる分 |
| 段1: T46-PIN・T46-FIXTURE | +30 | `admin-live-pin.test.mjs` |
| 段3: 保存の土台 | +38 | `admin-live-save.test.mjs` |
| 段4〜6 | +72 | `admin-live-screens.test.mjs`（LIST・OPEN・FIELDS・NEW・DRAFT・ANNOUNCE・IMAGE・RESERVE・AUTH） |
| 段7・8 | +34 | `admin-live-style.test.mjs`（STYLE・MODE・COMPAT・VERSION） |
| 段8 | +1 | `admin-live-pin.test.mjs`にfixtureの変種`sites`の試験 |
| Packet 04 | +12 | `admin-live-style.test.mjs` 9件、`admin-live-screens.test.mjs` 3件 |
| Packet 05 | +7 | `admin-live-style.test.mjs`（OVERLAP 3・MANUAL 1・STYLE 3） |
| **Packet 06** | **+18** | `admin-live-review-fixes.test.mjs`（HEADER 6・SUMMARY-BASE 7・ERRORLINE 5） |
| サイト 最終 | **989** | 776 + 1 + 30 + 38 + 72 + 34 + 1 + 12 + 7 + 18 |
| Worker 基準 | 347 | |
| 段2: T46-SUM | +14 | `cloudflare/worker/test/ticket-reservation-summary.test.js` |
| Worker 最終 | **361** | 既存のWorker試験は無変更 |

既存の試験は減っていない。更新した既存試験の表（全Packet分）は`code-generation-summary.md` §5.1〜§5.7。Packet 06は既存の試験の期待値を変えていない。

### 11.3 RED→GREEN（Packet 06）

実装前のコード（Packet 05の最終の`admin/app.js`・`admin/index.html`）に、足した試験を流してREDを確かめ、実装の後にGREENを確かめた。

| 修理 | 試験 | RED | GREEN |
|---|---|---|---|
| D1 外枠の接続の表示 | T46-HEADER 6件 | 5件が落ちた（「他のタブは基準のcommitと同じ」の1件は基準との比較で前後とも通る保護）。`packet06-review-fixes-red.log` | 6件通る。`packet06-review-fixes-green.log` |
| D4 集計の読み取りの基準の切り替え | T46-SUMMARY-BASE 7件 | 6件が落ちた（404・401・403・500・通信失敗の後に正式なURLへ再送・接続先を書き換える。集計の呼び出しの`policy`が空）。「ほかの読み取りは今まで通り再送する」の1件は前後とも通る保護 | 7件通る |
| D5 理由の行を残す | T46-ERRORLINE 5件 | 修理が先に入っているので、通常のREDは無い。変異で確認: 修理の2か所を外すと(a)の2件が落ち、「同じ予約か」の条件を外す（いつも残す）と(b)の2件が落ちる。確認の後に元へ戻し`cmp`で一致 | 5件通る |
| D6 撮影script | `--self-check` | 閉じた`details`の規則を外すと`--self-check`が`AssertionError`で落ちる（元へ戻して確認） | 契約OK |

T46-PIN（`test/admin-live-pin.test.mjs`）・T46-COMPAT・T46-STYLEは**無変更で通る**。

### 11.4 変更範囲（Packet 06）

- 変更: `admin/app.js`（`renderModeLabel`の新設・`renderModeBadge`・`setConnectionBanner`・`loadData`・`applyApiFallbackReadOnlyState`・`loadReservationSummary`）、`admin/index.html`（起動の表示と読み込み失敗の帯だけ）、`admin/README.md`（接続の表示と集計の読み取りの説明）、`test/support/admin-app-harness.mjs`（optionを2つ。追加だけ）、`aidlc-docs/…/verification/capture-admin-live.py`、`aidlc-docs/…`の3文書・`audit.md`・`aidlc-state.md`。
- 新規: `test/admin-live-review-fixes.test.mjs`、`aidlc-docs/…/verification/logs/packet06-*.log`。
- 変えていない: 保存・削除・予約の送る内容と数え方、Cloudflare Workerの`src/`（`git diff e191e53 --numstat -- cloudflare/worker/src/worker.js` = `40 0`のまま）、`admin/style.css`（Headerを含む全タブ共通のまとまりは基準とbytesが同じ）、`assets/`・tokens・`DESIGN_RULES.md`・`admin/config.js`・`admin/data/`・`cloudflare/`（`src/`・READMEは前のPacketのまま）・`data/`・公開側のHTML。承認済みの文書と昇格済みの`docs/specs/current/`のbytes、`verification/screenshots/`・metrics・Frontのlogも変えていない。
- 本番の値: 試験・文書・scriptに本番データの値は入れていない。`admin/config.js`・secret・予約のデータは参照していない。network接続なし。

### 11.5 close前の検査（最終）

使い捨てのコピー（`_scratch/codex-work/20261120-145511_1212hp-46-admin-live-ops/close-dryrun/aidlc-docs/`）に、現在の結果の文書3つ・`audit.md`を写し、gate 4・5の仮の承認記録（`DRY-RUN placeholder (not an approval)`。Result 2つの現SHA-256に結び付け直した。正規のA/B/Xの最終行・単一の`A`・`APPROVED`の書式）とCompleteのstateを置き、`scripts/aidlc-cycle.sh`の`validate_close_ready`（`generate_manifest`より前を取り出し、`AIDLC_REPO_ROOT`をコピーに向けて実行。`close-dryrun/validate-close-ready.sh`・`refresh-and-run.sh`）を通した。結果: **`validate_close_ready: PASS (DRYRUN ONLY)`**（`close-dryrun/validate-close-ready.log`）。本物の`aidlc-docs/`に仮の記録・Completeのstateは置いていない（`approvals/`は01〜03のみ、stateはIn Progress / Code Generation Result / Pendingのまま）。`scripts/aidlc-cycle.sh close`は実行していない。

### 11.6 残るGap・未実施

- **未実施（この後に行う。結果を先取りしない）**: Frontの撮り直し（`capture-admin-live.py`の再実行。外枠の接続の表示を変えた後。見る点は`code-generation-summary.md` §11.10）、Itsukiが触る確認、Worker deployの前後の読み取り確認、merge後の本番の確認。
- Frontの目視の範囲（スマホ幅73枚は縮小の一覧で全部。幅821〜1440の77枚は縮小の一覧12枚と原寸1枚。残りはPacket 05のWorkerが原寸で見た）は`code-generation-summary.md` §11.2。
- 実機（iOSのSafari）、本番の予約の件数の桁での見え方、1ライブ200件超の予約での集計と台帳の差。
- 既知の制限（Ticket共通設定の`ticket`の置き換え、新しいライブで「保存すると使えます。」が画面に出ないこと）は`code-generation-summary.md` §11.8。
- `Blocking Findings: None`は、独立reviewのAPPROVED（指摘4件はすべて`blocking: false`）と、この文書の自動の試験の結果に基づく。未実施の確認が通ることを意味しない。

## Front追補（Packet 06 の後の最終確認。2026-11-21T03:13:00+09:00）

- Front が全試験を流し直した: `node --test test/` pass 989 / fail 0、`npm --prefix cloudflare/worker test` pass 361 / fail 0。Cloudflare Worker の `src/worker.js` の base からの差分は追加40行・削除0行。
- Front の撮り直し（7回目、`capture-admin-live.py`、headless Chromium）: 150枚すべて撮れ、構造と実測の確認は150枚すべて合格。本番へ届いた request は0件。外枠は、API 接続中は「接続中」だけで帯は出ない（原寸の `list-upcoming-reserved-390.png` を Front が見た）。
- Front の目視の範囲は変わらない（スマホ幅73枚は縮小の一覧で全部、幅821〜1440 は縮小の一覧12枚と原寸1枚。7回目の画像は一覧の1枚を原寸で見た）。
- 未実施のまま: Itsuki が触る確認、Worker deploy の前後の読み取り確認、merge 後の本番の確認、実機（iOS の Safari）。
- 手元配信の修理（Front direct）: `fake_admin_server.py` は、設定の API の向き先を常に `http://127.0.0.1:8080` にしていた。tunnel の公開URLをスマホで開くと、スマホからは 127.0.0.1 に届かず、管理画面が本番の API へ切り替えて再送する作りだった（見本の合言葉なので本番は認証で拒むが、本番へ request が出る）。tunnel 経由（Host が 127.0.0.1・localhost でない）の時は、その公開URLを API と画像の向き先にするよう直した。Front が tunnel 経由で幅390 の管理画面を headless で開き、API の request 3件（`site-data`・`ticket-reservations`・`ticket-reservation-summary`）がすべて tunnel の host へ出て、ほかの host への request は外部 font と YouTube の見本画像だけ（本番の API へは0件）であることを確かめた。`--self-check` は通る。この向き先の Node / Python の自動試験は足していない（既知の不足）。
