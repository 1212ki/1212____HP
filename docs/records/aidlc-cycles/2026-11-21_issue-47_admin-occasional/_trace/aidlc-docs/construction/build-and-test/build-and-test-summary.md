# Build/Test Result — 管理画面のたまにする更新（Issue #47）

- Status: 確認2（gate 5）の候補 / Owner承認待ち（承認記録は作っていない）。実装・全試験・Frontの撮影3回（最終は357枚＋Liveの150枚がすべて合格）・独立review（APPROVED）を経た最終の結果。Itsukiが手元配信で触る確認と、merge後の本番の確認は未実施（§6）
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-21_issue-47_admin-occasional`
- Execution target: `/Users/itsuki.matsumoto/claude-code/_worktrees/1212hp-47-admin-occasional`
- Branch: `feature/47-admin-occasional` / base `1f3a1cdcdf9852b3f2cabaa2978352572e0b9d82`
- **Blocking Findings**: None
- reader_profile: audience=human_reader / language=ja-JP / review_surface=designated_text_editor / open_status=not_opened（Frontが開く）

この文書は、Workerが実行した自動の試験・検査の結果と、Frontの撮影・独立reviewの結果の記録です。`Blocking Findings: None`は、独立reviewのblockingが0件、Frontの撮影の不合格が最終で0件、全試験のfailが0件で、**未解決の阻害事項がない**ことを指します。Itsukiが触る確認・merge後の本番の確認は未実施で、その結果を先取りしていません（§6・§11）。作ったものと計画からの差は`code-generation-summary.md`にあります。

## 1. 実行したcommandと結果（最終。Packet 02f。2026-11-21）

Node v20.19.4（`node --test test/`はv20.19.4で動かす）。log は`aidlc-docs/construction/aidlc-integration/verification/logs/stage8-*.log`。結果の文書と撮影の証拠をaidlc-docsに置いたあとの状態で流した（記録の複製で`T43-COMPAT`などが止まらないことを含む）。

| command | 結果 | log |
|---|---|---|
| `node --test test/` | tests 1326 / pass 1323 / fail 0 / skipped 3 / cancelled 0 | `stage8-01-node-test-all.log` |
| `npm --prefix cloudflare/worker test` | tests 361 / pass 361 / fail 0 / skipped 0 | `stage8-02-worker-test.log` |
| `node --check admin/app.js` | exit 0 | `stage8-03-node-check.log` |
| 撮影script2つ・`fake_admin_api.py`・`fake_admin_server.py`の構文（`python3 -B -c ast.parse`） | exit 0 | `stage8-04-python-syntax-and-self-check.log` |
| `/usr/bin/python3 …/capture-admin-occasional.py --self-check`（ブラウザ・bindなし） | 契約OK: 357画像 / 9画面 / 7scenario | 同上 |
| `/usr/bin/python3 …/capture-admin-live.py --self-check` | 契約OK: 150画像 / 16画面 / 14scenario | 同上 |
| `fake_admin_server.py --self-check`・`fake_admin_api.py`（自己検査） | OK（#46のfixture 14 scenario・#47のfixture 9 scenario。bindなし・networkなし） | 同上 |
| `git diff --stat 1f3a1cd -- cloudflare assets data DESIGN_RULES.md` | 空（差なし） | `stage8-05-diff-stat-protected.log` |
| `scripts/aidlc-verify.sh --local` | passed（`AI-DLC local integrity verification passed: v1.0.1`、exit 0） | `stage8-06-aidlc-verify-local.log` |
| `git diff --check` | exit 0（空白の誤りなし） | `stage8-07-diff-check.log` |
| `scripts/aidlc-cycle.sh status` | exit 0（`Cycle Status: In Progress`。承認前なので正しい状態） | `stage8-08-aidlc-cycle-status.log` |

- 全試験のskipped 3は、段1から変わらない恒久のskip（`admin-live-style.test.mjs`の`T46-COMPAT`3件。#47が一覧・modalのmarkupとheaderの「保存」の全体送信を意図して変えるため。観測の移し先は`code-generation-summary.md` §6.1）。減った試験・新しいskipはありません。
- sandboxが`/dev/fd`・`/private/tmp`を拒むため、`scripts/aidlc-verify.sh --local`は、`diff`・`mktemp`のshim（#46・段1から使っているもの）をPATH先頭に置いて実行しました。script本体は変えていません。shimなしでは`diff: /dev/fd/63: Operation not permitted`で失敗します（sandboxの制約）。
- `scripts/aidlc-cycle.sh close`は実行していません。

## 2. 基準との試験数の差の内訳（989 → 1326）

基準（着手前。`baseline-node-test.txt`）: tests 989 / pass 989 / fail 0 / skipped 0。Worker 361 / 361。

| 段（Worker） | 区切りの結果（tests / pass / fail / skipped） | 差 | 内訳 |
|---|---|---|---|
| 段1（02a） | 1033 / 1030 / 0 / 3 | +44 tests・pass は +41 | T47-PIN +44。`T46-COMPAT`3件がskip（pass 989＋44−3＝1030、skipped 3） |
| 段2（02b） | 1099 / 1096 / 0 / 3 | +66 | `admin-occasional-save` 39（T47-EQ・SAVE・SCOPE・GUARD・DELETE・IMAGE）、`admin-occasional-screens` 27（T47-HEADER・TABS・NEWS・IMAGE・STYLE-SPEC・STYLE） |
| 段3・4（02c） | 1177 / 1174 / 0 / 3 | +78 | FIX1・2の試験 +2、`admin-occasional-screens` +33（T47-MUSIC 12・SITE 7・PROFILE 5・IMAGE 1・STYLE 8）、`admin-occasional-save` +43（T47-EQ 16・SCOPE 5・DELETE 8・DATE 5・SAVE 6・IMAGE 3）。`music data fields …` は27→27（入口を置き換えただけ） |
| 段5・6（02d） | 1322 / 1319 / 0 / 3 | +145 | FIX4・5の試験 +5（screens 2・save 3）、新しい試験 +141（`admin-occasional-guard` 85、`admin-occasional-states` 42＝STATES 20・MODE 5・A11Y 5・FIXTURE 12、`admin-occasional-style` 14＝STYLE 9・STYLE-SPEC 2・LIVE-COMPAT 3）、modalを直接呼ぶ試験 **−1**（`generic edit modal …`。置き換えは`code-generation-summary.md` §6.4） |
| 段7（02e） | 1326 / 1323 / 0 / 3 | +4 | `admin-occasional-version`（T47-VERSION 1・T47-README 3）。版・タブ名の期待を改めた既存の試験は件数が同じ |
| 段8（02f） | 1326 / 1323 / 0 / 3 | 0 | 試験は足していない。再実行して同じ値 |

- 合計: 989 + 44 + 66 + 78 + 145 + 4 = **1326**（pass 1323＝1326 − skipped 3）。新規の試験ファイルは7つ（計338件）で、そこから−1（外した1件）。
- 新規の試験ファイル別の件数: `admin-occasional-pin` 44、`-save` 85、`-screens` 64、`-guard` 85、`-states` 42、`-style` 14、`-version` 4。
- 段1〜6の件数は各Workerの記録を引いた値で、Packet 02fで段ごとに再計算してはいない（最終の1326 / 1323 / 0 / 3は、Packet 02fで再実行して確かめた）。

## 3. RED→GREEN

段ごとのRED→GREENのlogとexit、固定が効くことの確認（T47-PINを5通りに壊す、段6の4つの一時変更）は`code-generation-summary.md` §3の表にあります。要点:

- T47-PIN（44件）は、今のコードに対して書いてGREENで固定した（不要なREDは作らない）。段2以降も**無変更で通り続けている**（SHA-256 `8ad2079b…`）。
- 新しい試験は、実装の前にREDにした: 段2 64件中63件失敗、段3・4 144件中69件失敗、FIX 2件／4件失敗、段5 127件中4件失敗（残り123件は、段2〜4で実装済みの動きを全経路で縛る試験の追加のため、REDで既にGREEN）。
- 段6のCSS・Liveの非回帰の試験は、最初からGREEN。効くことは4つの一時変更で確かめた（1・3・1・1件が落ち、元に戻して`cmp`で一致を確認）。

## 4. 撮影（Front。headless Chromiumだけ。本番へのrequestは全回0件）

`ui_route=required_by:計画 §6`（承認済みの計画がFrontの撮影を求める）。1回の撮影は「初回＋根拠のある修正1回」で閉じ、次は新しい宣言で行いました。記録は`verification/front-capture-log.md`（Frontの原本のまま複製）。

| 回 | 対象 | 枚数 | 自動の合否 | 見つけたこと・直したこと |
|---|---|---|---|---|
| 撮影1（段2のあと） | 上の帯・5タブ・News・Liveの2画面（`capture-admin-occasional.py`） | 36 | 4枚が不合格 | **実装の直し2つ**: ①Newsの「説明」の書体（FIX1）、②幅1440のタブの文字の位置（FIX2）。**撮影scriptの期待の誤り**（FIX3）: 失敗のtoastが下の「保存して公開」に重なる＝#46のLiveと同じ動きなので実装は直さない、スマホでライブを開いている間は一覧を隠すのが#46の形、閉じた折りたたみの中の欄は覆いの検査に入れない。残る1枚（`chrome-profile-390`。横スクロール scrollWidth 424）は、段2では旧Profileの画面を積んだだけで、段4で作り直す対象（修正1回の撮影では出ていない。Frontの記録に個別の項目はない） |
| 撮影の修正1回（段4のあと） | 撮影1の直しの確認＋Music・Site・Profile | 82 | 2枚が不合格 | 撮影1の直しは確認できた。不合格2枚は`music-works-date-error-*`（新規で日付の形が違う作品は一覧に載らないので、開いている行は無いのが正しい。R47-06）＝撮影scriptの期待の誤り（FIX6）。**実装の直し2つ**: ①作品の編集のリリース日の下の空き（FIX4）、②削除の確認の説明が1つの段落につながっていた（FIX5） |
| 撮影2（段6のあと） | 全画面×全幅×状態、Liveの#46との比較 | 357＋150 | `capture-admin-occasional.py`は1枚不合格、`capture-admin-live.py`（#46のscript・無変更）は150枚すべて不合格 | `local-news-saved-1440`は、書き出し待ちの「JSONを書き出す *」を完全一致で探していた＝期待の誤り（FIX7）。Liveの150枚の不合格は、**#47が意図して変えた2点**（タブが5つ＝R47-01、接続失敗の時に上の帯の「保存」を出さない＝R47-15・R47-16）。このままではLiveの撮影が今後ずっと使えないので、期待をその2点だけ改めた（FIX8。計画からの差） |
| **撮影3（最終）**（段7のあと） | 全画面×全幅×状態、Liveの比較 | **357＋150** | **357枚すべて合格、Live 150枚すべて合格** | 撮影2との画素の比較（同じ名前の357枚）: 同じ352枚、差5枚（`music-videos-empty-821`は1pxの縦線、`music-works-failed-1440`・`site-failed-1440`・`profile-failed-360`はtoastの出方の瞬間、`music-works-playback-reset-900`はtoastの文字の一部）。いずれも撮影の瞬間の違いで、画面の作りの違いではない |

- **意図した不合格**: 撮影2の`capture-admin-live.py`の150枚の不合格は、#47が変える2点だけ（タブの数・接続失敗の「保存」）。撮影scriptの期待を直してから、撮影3で合格を確かめた。自動の不合格は、撮影scriptの期待の誤り（FIX3・6・7）、#47が意図して変えた点（FIX8）、段2の暫定の画面（撮影1の`chrome-profile-390`）で、最終の実装の不具合ではなかった。toastの重なり（`news-failed-390`）は#46のLiveと同じ動きなので実装を直さず、既知の制限にした（§9の9）。実装を直したのは、Frontが目視で見つけた4点（FIX1・2・4・5）。
- **本番へのrequest 0件**: 撮影3の`capture-admin-occasional-metrics.json`・`capture-admin-live-metrics.json`の`network_problems`は空（`captures[].production_attempts_aborted`・`other_blocked`・`denied_local_paths`も空）。logの最終行は「357画像。構造と実測の確認はすべて合格。本番へ届いたrequest: 0件。」「150画像。…本番へ届いたrequestは全件0。」。
- **Liveの#46との比較**（`capture-front-4-live-compare.json`。#46の画像と、上の帯（#46は146px、#47は幅899px以下95px・幅900px以上115px）を切り落として比べる。Frontの`compare_live.py`）: 150枚中、**同じ81枚、高さだけ違い共通部分は同じ46枚、共通部分に差ありの23枚**（上の帯が低くなった分、画面の高さを固定した撮影で本文の見える範囲が伸びた）。**意図しない差は0件**（Frontが差の内訳を目視で確認）。差ありの23枚の内訳:
  - 確認の面（`dialog-*-1440`の4枚）とtoast（`open-public-save-failed-390`・`open-public-save-failed-1440`・`postsave-announce-1440`・`reservation-detail-status-failed-1440`・`ticket-settings-failed-1440`の5枚）: 画面の中央・下に出る位置が、本文の見える範囲が伸びた分だけずれた。中身は同じ。
  - 接続失敗・Local Mode（`list-upcoming-*`・`tickets-*`の`read-only`・`local-mode`の各幅の8枚と`open-public-read-only-1440`の計9枚）: 帯の文言はHeaderとTabsの間のまま。比較の切り落としがずれた分に加え、Local Modeの「JSONを書き出す」は大きい赤いボタンから小さい枠のボタンになった（承認済みのF47-22、Figma `223:892`）。接続失敗の上の帯の「読み取り専用」ボタンは出ない（R47-16）。
  - 文字の描画の揺れ（`ticket-settings-saved-900/1011/1440`・`ticket-settings-unsaved-1440`の4枚は1px、`postsave-announce-390`は9×12px）。
  - Liveの本文・一覧・予約・Ticket Page共通設定は#46と同じ。
  - この23枚の分類は、Frontの記録（撮影2・3）の内訳に、差の範囲（`diff_box`）の大きさと画像の名前を当てて割り当てた。件数はJSONの`rows`から数えた値で、Frontの撮影の記録の数え方（撮影2: 47・22、撮影3: 58・11）とは1〜2枚の違いがある（§11）。
- **Frontの目視**（原寸。Figmaのrenderと#46の画像と並べた）: 約28枚（撮影1の11枚・修正1回の7枚・撮影2の10枚）。合っていた点: 上の帯・5タブ・Newsの一覧と編集・画像の「画像を変える」と文字の「画像を外す」・削除の確認の面・作品／映像の切り替え・Siteの4つの面・Profileの写真・文・SNSリンク・保存中／失敗／接続失敗／Local Modeの状態・幅821は1列・幅900は2列・幅360でも横にはみ出さない。目視していない範囲は`code-generation-summary.md` §9。
- **証拠の置き場**（FD1）: `aidlc-docs/construction/aidlc-integration/verification/`
  - `screenshots/`: 撮影3の幅390と幅1440の**166枚**（`*-390.png` 83枚・`*-1440.png` 83枚。合計 16,296,960 bytes＝約15.5 MiB。#46の150枚・13MBと同じ程度）。複製は`cmp`で元と一致を確認した。
  - `capture-admin-occasional-metrics.json`・`capture-front-4.log`（撮影3の`capture-admin-occasional.py`）、`capture-admin-live-metrics.json`・`capture-front-4-live.log`（撮影3の`capture-admin-live.py`）、`capture-front-4-live-compare.json`（Liveの比較）、`front-capture-log.md`（Frontの撮影の記録）、`front-review-decisions.md`（Frontのreviewの判断）、`review-01-raw.md`（独立reviewの原文）。
  - **repoに入れていない画像**: 撮影3の幅360・821・900・1011の**191枚**（`/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261121-082147_1212hp-47-admin-occasional/capture-front-4/screenshots/`。自動の実測は全部合格）、Liveの150枚（#46の画像と上の帯を除いて同じなので複製せず、比較のJSONで示す）。scratchは後で消えうるので、必要なら撮り直せる（`capture-admin-occasional.py`）。
- 撮影の実行: `ADMIN_CAPTURE_OUT=<repoの外> /usr/bin/python3 test/support/admin-preview/capture-admin-occasional.py --base http://127.0.0.1:8080`、`…/capture-admin-live.py`（同様）。出力は`screenshots/`・`capture-*-metrics.json`・log。

## 5. 独立reviewの結果とFrontの判断

独立review（別プロセス。Packet `packet-03-review.md`）: **verdict APPROVED、blocking 0件、low 5件**（`verification/review-01-raw.md`）。ADM-47-01〜13・RF1〜RF10はすべてOK。reviewは実行の道具（Bash）が無く、試験の再実行・`git diff`・SHA-256の再計算・base版`app.js`の直接の読み取りはしていない（コード・試験の中身・各Workerのlog・画像の読み取りによる）。

| id | 内容 | Frontの判断 | 理由 |
|---|---|---|---|
| RV47-01 | Local Modeの「JSONを書き出す」は各タブの未保存の入力を書き出しに入れない（今は入力の時点で入っていた） | 直さない。既知の制限（§9） | 承認済みのR47-15（各「保存して公開」でメモリへ反映し、headerで書き出す）どおり。入力は「未保存」と出続けるので気づける。Local Modeはふだん使わない従来の運用 |
| RV47-02 | 開いた直後に最初の欄にフォーカスが入り赤い枠が出る。スマホではキーボードが開くことがある | 直さない。既知の制限（§9） | #46のLiveと同じ動き（本番に出ていて、Itsukiが毎日使っている型）。#47だけ変えると型が揃わない。変えるならLiveと一緒に別のIssueで |
| RV47-03 | Profileのリンクを変えると、全行の`name`・`url`を書き直す（今は変えた行だけ） | 直さない（§9） | 本番の`profile.links`は全件`{name, url}`（2026-11-21の分類）で、書き直しても値は同じ。T47-EQ（Profile）は今のコードと同じ本文で通っている。違いが出るのは`url`を持たない行がある時だけで、実データにない |
| RV47-04 | `capture-admin-live.py`を「2点だけ」変えたことを守る試験がない | Frontがdiffを目視して確認済み（2026-11-21） | diffは、タブの期待（6→5）、接続失敗の上の帯の「保存」の期待、その2点の`--self-check`の追加だけ。ほかの検査は#46のまま。撮影の道具なので、試験で縛る量は足さない |
| RV47-05 | modalを外したあとの死んだ分岐（`generic-modal`、`modalReturnFocusLive`、`saveToApi`のpayloadなしの既定） | 直さない。後の整理 | 本番の呼び出しから届かない（reviewがgrepで確認、T47-MODEが「`saveData`は`saveToApi`を呼ばない」「呼び出しはすべてpayloadつき」を縛る）。`saveToApi`の既定は`T46-PIN (h)`の窓 |

- 判断の基準（Front）: この管理画面を使うのはItsuki1人で、たまにする更新は頻度が低い。頻度・影響・戻せるか・作る量で、直すか既知の制限にするかを選んだ。
- Reviewerが求めた確認（Frontの実施）: ①全試験を再実行（Frontが1326 / 1323 / 0 / 3、Worker 361 / 0。Packet 02fも同じ値）、②`capture-admin-live.py`のdiffの目視（上のRV47-04）、③撮影3の画像、④昇格した設計書2文書のSHA-256を計画 §3の値と照合（一致。承認済みのRequirements・Workflow Plan・Code Generation Plan・figma-fix-requests.mdのbytesも不変）。
- 修理のPacketは出していない（blocking 0件、lowはすべて上のとおり）。

## 6. Itsukiが触る確認（FD2）

**merge前に手元配信で触る確認（計画 §7）は実施していません。任意で、Itsukiは「PRが上がったらmergeだけやる」と決めました（2026-11-21）。** 触った結果の記録はありません。実施したとは扱いません。代わりに、撮影3の自動の実測（357枚）・全試験・独立reviewで確かめ、次の「merge後の確認」で補います。

**手元配信の入口（触りたい時のために残す。任意。起動はFront）**:
- 起動（worktreeのrootから）: `/usr/bin/python3 test/support/admin-preview/fake_admin_server.py --port 8080 --fixture test/fixtures/admin-occasional-states.json`。入力の窓（合言葉）は出ない。**本物の合言葉を入力しない**。書き換わるのはメモリ上の架空のデータだけ（止めると元に戻る）。
- PCは`http://127.0.0.1:8080/admin/`を開き、開発者ツールの画面幅を390にする。スマホはtunnel（例: `cloudflared tunnel --url http://127.0.0.1:8080`）の公開URL。tunnelでは、その公開URLをAPIの向き先にする設定をserverが返す（127.0.0.1のままだとスマホから届かず、管理画面が本番のAPIへ切り替えて再送する。#46の教訓）。Frontは渡す前にheadlessで通信先を確かめる。
- 触って確かめること: 上の帯が薄く1行でタブが5つ／Newsを開いて題を1文字変える→「未保存」と下に「保存して公開」→別のお知らせを押す→「保存していない変更があります。」→「編集を続ける」→「保存して公開」→「保存済み」／「+ 追加」→何も入れずに「‹ 一覧」（確認が出ない）／お知らせの「このお知らせを削除」→確認→「削除する」／Music→作品／映像の切り替え、作品の「その場で再生する映像」・「種別」、映像のChannel URL（その欄の「保存して公開」）／作品を削除する時に「顔にする作品は…に戻ります。」が出ること／Siteの「顔にする作品」と各リンク、Profileの文・リンクの追加と「削除」／未保存のままタブを替える確認。

**merge後の確認（本番の表記。Itsukiが見て判断する。本番のデータを書き換える操作を含めない）**: Pagesの反映（数分）のあと、管理画面を再読込して見る。
1. 上の帯が薄く、タブが5つ（Site・News・Live・Music・Profile）。YouTubeとDiscoのタブがない。
2. Newsを開き、一覧の行と編集の入力欄が本番の内容で崩れていない（日付の書き方・題・説明・画像）。何も変えない間は「保存済み」で、「保存して公開」が出ない（スマホ）。
3. 題に1文字足す→「未保存」と下に「保存して公開」→別のお知らせを押す→「保存していない変更があります。」→「破棄して移動」で、変更は保存されずに戻る（保存は押さない）。
4. Musicで作品と映像を切り替え、作品の「種別」と「その場で再生する映像」、映像のChannel URLが今の値で出る。Siteの「顔にする作品」が今の選択で出る。Profileの文の改行が保たれている。
5. 次に実際に行う更新を1件、「保存して公開」まで行い、公開サイトに反映されることを確かめる。これが本番を書き換える唯一の操作で、Itsukiが自分の判断で行う（内容は自分の更新。後始末は不要）。

見えないこと（手元配信・撮影では確かめられない）: 本番の件数の桁・題の長さ・画像の実在、実際の合言葉の通り方、iOSのSafariの`beforeunload`、通信の速さ。上のmerge後の確認で補う。

## 7. 変更範囲と承認済みのbytes

- 基準`1f3a1cd`からの`aidlc-docs/`の外の差: 28ファイル（変更19・新規9）、変更19ファイルは +3902 / −1345（`git diff --numstat`）。一覧とSHA-256は`code-generation-summary.md` §2。
- **Worker・公開側・データは無変更**: `git diff --stat 1f3a1cd -- cloudflare assets data DESIGN_RULES.md`は空（`stage8-05`）。`admin/config.js`・`admin/data/`も変えていない。`cloudflare/worker/test/`も無変更で361 / 361。
- 昇格した設計書: `docs/specs/current/live-operations-admin-ui.md` `799ef584b63f7767052f6eecb352e8d3e5a2c8d0f0c8344ed2297b46e54d2d64`、`README.md` `3f64dcf9ebb79ccf714592d6eea5cd0ca88943c9e223b30accd83621a35fa56f`（提案版と同じbytes、計画 §3の値と一致）。
- 承認済みの文書のbytes（Packet 02fで再計算して一致）: requirements `d1d7fa30…c49926`、execution-plan `c29a87cb…af0b8`、Code Generation Plan `fa7792cb…b35c`、figma-fix-requests `968dda2d…1dee2`。
- Figmaの反映（Front）: `figma-snapshot-v2/figma-delta-47.md`（意図しない変更0件）、`SHA256SUMS` `efd2f466d97a6c6cb1085fd9809ef968907432e2ecb7bac9650b9b7a78639168`。この結果ではFigmaを変えていない。
- fixture・試験・文書・撮影scriptの値はすべて架空で、本番の値はない（`T47-FIXTURE`が件数・形・hostを検査）。

## 8. close前の検査

- 必要な文書: `audit.md`・`cycle-summary.md`・`inception/plans/execution-plan.md`・Code Generation Plan・`code-generation-summary.md`・この文書がそろっている。`Blocking Findings`は、この文書と`cycle-summary.md`で`None`（field形式）。
- **未作成（gate 4・5の承認前）**: `approvals/04-code-generation-result-approval.md`・`approvals/05-build-test-result-approval.md`。`aidlc-state.md`のApproval Gateは`Code Generation Result`・Approval Statusは`Pending`（Itsukiの確認2の回答を待つ）。承認後にFrontが記録を作り、状態をCompleteにしてから`scripts/aidlc-cycle.sh close 2026-11-21_issue-47_admin-occasional`を実行する（Workerは実行していない）。
- `scripts/aidlc-cycle.sh status`は§1のとおり（closeの前提の`Cycle Status: Complete`などは、承認後に満たす）。

## 9. 既知の制限（計画 §9の8件＋実装・撮影・reviewで分かった7件）

頻度・影響・戻せるか・作る量で、直さずに既知の制限としたもの。Itsukiが確認2で知っておくべきもの。

| # | 制限 | 影響・戻せるか | 出どころ |
|---|---|---|---|
| 1 | 別の端末の保存を取り込まない（最後に保存した側が残る） | 1人で使い、同時に2台で同じ項目を保存する頻度が低い。#46と同じ。照合はWorkerの変更とdeployの順序を伴うので扱わない（D47-11） | 計画 §9 |
| 2 | iOSのSafariでは、再読込・戻るの確認（`beforeunload`）が出ないことがある | 画面内の移動は画面の確認で止まる。実機は未確認 | 計画 §9 |
| 3 | 画像を選ぶとその場でアップロードされる（今と同じ）。保存せずに破棄しても、アップロード済みのファイルは残る | 公開データには入らない。取り消す仕組みは作らない（頻度が低く害が小さい） | 計画 §9 |
| 4 | 作品・映像は、保存のたびにカテゴリの先頭へ移る（カテゴリを変えない保存でも。今の動き） | 並びを変えない保存はデータの並びを変えるので#47では行わない | 計画 §9 |
| 5 | Ticket Page共通設定の保存が`ticket`を6項目（`completeText`と`fields`）に置き換える | #46と同じ。そのまま | 計画 §9（#46） |
| 6 | Music映像の側では、幅900px以上で「保存して公開」が2つ（Channel URLの欄と、開いている映像の編集）見える | 対象が別で、押した方の入力だけが保存される | 計画 §9 |
| 7 | 計画の時点ではたまにする更新のFigma render画像がなかった（Gap-01） | 解消した。確認1のあとFigmaのマスタへ反映した時に、等倍の画像17枚（`figma-snapshot-v2/render-*.png`。Figmaの状態`39:741`・要件メモ`39:817`・Local Modeの幅1440`223:930`の3つは除く）を手に入れ、段2以降のWorkerの実装とFrontの撮影の目視の照合に使った | 計画 §9（Frontが2026-11-21に解消を追記） |
| 8 | 本番の画像の実在・動画IDの有効性・リンク先の到達は確かめていない（Gap-02） | merge後の確認で補う | 計画 §9 |
| 9 | 保存に失敗した直後のtoastが、幅390で下の「保存して公開」に数秒重なる | #46のLiveと同じ動き（`open-public-save-failed-390`。本番に出ている承認済みの形）。toastは数秒で消え、理由は欄の上に1行出ている。実装はLiveと同じまま | Front（撮影1）。`news-failed-390` |
| 10 | Local Modeの保存後のtoast「編集内容を反映しました。右上の「JSONを書き出す」で確定します」が、幅390で画面の左右にはみ出す | toastは共有の部品で、#46のLiveのLocal Modeと同じ文と見た目（本番に出ている）。Local Modeはふだん使わない従来の運用 | Front（撮影2）。`local-news-saved-390` |
| 11 | Local Modeの「JSONを書き出す」は、各タブの未保存の入力を書き出しに入れない（RV47-01） | 承認済みのR47-15どおり（各「保存して公開」でメモリへ反映→headerで書き出す）。今は入力の時点で入っていたので従来の運用が変わる。入力は「未保存」と出続ける。直すなら、書き出し時に未保存があればtoastで知らせる | 独立review |
| 12 | 開いた直後に最初の欄にフォーカスが入り、赤い枠が出る。スマホではキーボードが開くことがある（RV47-02） | Liveと同じ動き（承認済みの型）。直すなら、スマホ幅では自動フォーカスをしない。Liveと一緒に別のIssueで | 独立review |
| 13 | Profileのリンクを変えると全行の`name`・`url`を書き直す（RV47-03） | 本番の形は全件`{name,url}`で値は同じ。`url`を持たない行があると、触っていない行にも`url: ''`が付く（実データにない） | 独立review |
| 14 | `:has()`を1か所使っている（`.occ-save`が出ている間の下の余白。Safari 15.4+・Chrome 105+） | 古い環境では、固定の帯の下の余白がなくなるだけ（機能は同じ） | Worker 02c |
| 15 | modalを外したあとの死んだ分岐が残っている（`generic-modal`、`modalReturnFocusLive`、`saveToApi`のpayloadなしの既定。RV47-05） | 本番の呼び出しから届かない（T47-MODEが縛る）。後の整理でよい | 独立review・Worker 02d |

## 10. 出し方: mergeだけ（Worker deployなし）と、rollback

GitHub Pagesがmainから配信するため、mergeした時点で本番の管理画面が入れ替わります。**Cloudflare Workerは変更していないので、deployはありません**（#46との違い）。新しい管理画面は、保存の経路・形・認証が今と同じ（`PUT /api/admin/site-data`・`/api/admin/upload-image`）なので、今のWorkerにそのままつながります。

1. **事前（Front）**: PR最終版のcommitと試験済みのコードが一致し、作業ツリーがcleanで、`git diff 1f3a1cd -- cloudflare assets data DESIGN_RULES.md`が空であることを確かめる。公開GET（`/api/public/site-data`）の`meta.updatedAt`と本文のSHA-256を読み取りだけで控える（merge前後で変わらないことを確かめる。合言葉は使わない）。
2. **確認2のA**（gate 4・5）→ **Itsukiの明示承認**（PRのmerge。確認2のAはmergeの承認を含まない）→ PRのmerge。Frontが、Pagesのbuild・配信されたassetの版（`ADMIN_BUILD_ID`=`2026-11-21T0300Z`・`?v=20261121-47`）を読み取りで確認し、ItsukiへmergeとPagesの反映を知らせる。公開GETの`meta.updatedAt`・本文のSHA-256がmerge前と同じ（データが書かれていない）ことを確かめる。
3. **merge後の確認（Itsuki、§6）**。問題がなければIssue・ProjectをFrontが閉じる。

merge前に管理画面のタブを開いていた端末は、旧版の`app.js`が残る場合があります（旧版は今の保存の動きのまま、Workerと互換）。再読込で新版になります。

**rollback**（`aidlc-docs/construction/plans/aidlc-integration-code-generation-plan.md` §9）:

| 段 | 失敗・不具合 | 戻し方 |
|---|---|---|
| merge前 | 撮影・確認・独立reviewで不具合 | mergeしない。修理して再確認（影響するfocused testと該当の画像） |
| merge後 | 管理画面の不具合（保存・削除が動かない、表示が崩れる、タブから戻れない） | **保存を止める**（Itsukiは更新を後にする）。Frontが#47差分だけを戻すrevert PRを準備し、Itsukiが承認・mergeする。Pagesが旧adminを配信したこと（`?v=`・`ADMIN_BUILD_ID`）をFrontが確認する。公開データの形・Workerは変えていないので、旧管理画面は保存済みの内容をそのまま読める。Pagesのcacheで新版が残る端末は再読込する |
| merge後・データ | 保存が誤った内容を公開データへ書いた（誤って削除した・別の項目を落とした） | 保存を止める。新しい保存はbaseline＋対象だけで、他の領域を落とさない設計で試験済みだが、万一落ちた場合は、Frontが復旧の手段（D1の復元の可否は未確認。復旧の成立をそれに依存させない）と失われる更新をItsukiへ示し、別判断を求める。誤って削除した項目は、管理画面で入力し直す（自動の復元はない）。データの形・schemaを変えていないため、通常はコードのrevertで足りる |

D1・データは通常の手順で巻き戻しません。

## 11. 残るGap・未実施

- **Itsukiが手元配信で触る確認**: 未実施（§6。Itsukiは「mergeだけを行う」と決めた）。
- **merge後の確認**: 未実施。本番の件数の桁・題の長さ・画像の実在・本番の値での表示、実際の合言葉の通り方。
- **実機**: iOSのSafari。headless Chromium・代替fontだけで確かめた。
- **画像の全数の目視**: 自動の実測は357枚（＋Live 150枚）すべて合格。Frontの目視は約28枚、独立reviewは12枚。撮影3の357枚は撮影2との画素の比較で確かめた。幅360・821・900・1011の191枚のうち目視は一部。
- **README・手元配信のtunnelの例**: `ngrok http 8080`・`cloudflared tunnel`の例は実機で試していない。`fake_admin_server.py`の実際の起動はWorkerができず（localhostのbind不可）、`--self-check`だけ。
- **記録の数え方の食い違い（Frontへ）**: ①`front-capture-log.md`の撮影3の「Liveの#46との比較」の数（「高さだけ違い共通部分は同じ58枚、差あり11枚」）は、`capture-front-4-live-compare.json`の`summary`の`size-differs` 58（共通部分が同じ46＋共通部分に差ありの12）・`differs` 11を、そのまま3区分として読んだ値に見える。JSONの`rows`から数えると、同じ81・高さだけ違う46・差あり23（12＋11）。撮影2の記録（47・22）ともJSONの数え方で1枚違う。内訳の分類と「意図しない差0件」の結論は、この文書では変えていない。②撮影1の4枚の不合格のうち`chrome-profile-390`（横スクロール）は、Frontの記録に個別の項目がない（§4）。どちらも、Frontの記録は原本のまま複製し、この文書で補った。
- **独立reviewが実行できなかったこと**: 試験の再実行・`git diff`・SHA-256・base版`app.js`の直接の読み取り・画像の全数。試験・diff・SHA-256はFrontとPacket 02fが再実行した。
- **Front completion・Itsukiの確認2（gate 4・5）・merge・PR**: Workerの範囲外（自己承認していない）。
