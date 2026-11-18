# Issue #42 Homeと共通の外枠

- **Cycle ID**: 2026-11-17_issue-42_home
- **Issue**: #42
- **Status**: Complete。gate 4・5はOwnerのAで承認、review-02・review-03はAPPROVED。transactional closeの実行結果はworker-06b-result.mdに記録する。
- **Blocking Findings**: None

確認1の本人回答Aをgate 1〜3へ原典どおりに転記し、承認された提案版3文書をexact bytesでcurrent canonicalへ昇格した。Home・その場の再生・10状態・共通部品・全9ページの外枠を実装した。Home以外の本文8件、データhelper、tokens、保存処理とCloudflareは保持した。

Step 4はNode 333/333・Worker 347/347、Step 6はNode 367/367・Worker 347/347。RV42修理のfocusedは83 pass／7 failのREDから90 pass／0 failのGREENへ進めた。RED→GREEN、承認validator、SHA-256／cmp、変更範囲、本文保護をログで検証した。

RV42修理後の全試験はNode 374/374・Worker 347/347。JS3件の構文検査、local verify、status、diff checkはexit 0。証拠は`corrective-1-results.json`と対応logに保持する。

Worker時点の撮影はlocalhostをbindできず0枚だった。その後Frontが同じscriptで52枚を撮影した（`capture-front-1.log`・`capture-front-2.log`）。Frontによる時計の1行修正（`page.clock.install(time=1794916800000)` → `time=1794916800`）は保持した。Playwright for Pythonは数を秒として読む。撮影時の`capture-metrics.json`のSHA-256は`1bbfdc6dfd66b03c02b8fb416bf04f06ed03fadc95d373c876b4f2f2a9ccd042`。修正前のPS-H-01・02のbox判定は成功した。

FrontはRV42修理後に同じscriptで52枚を再撮影し、判定はすべて通過しました（`capture-front-3.log`、撮影時`capture-metrics.json`のSHA-256 `709c904f51c9e7f13b1e34db6d709a65dacd21cbd636aaa441b4ba9d93ab4e96`）。独立reviewの2回目はAPPROVEDで、RV42-01〜07はすべてRESOLVED、新しい指摘はありません（root scratchの`review-02-result.md`）。その後、確認2の準備でFrontが本番の公開データを読むbranch画面を開き、newsの日付が語の途中で折れる問題FR-N1を見つけました。計画とfixtureが短い日付だけを想定していたことが原因です。

FR-N1では、日付欄を88pxから内容に合わせて広げ、上限を240pxまたは画面幅−236pxの小さい方にしました。390pxでは左右16px・間隔24pxを保ち、本文欄に180px以上を残します。Home専用rendererで空白ごとのまとまりをspanに包み、空白で折り返します。上限を超える1語だけは欄内で折り返します。原文の文字と空白・既存の並べ方は保持し、全行が通常のYYYY.MM.DDの場合は88pxと24pxの見え方を保ちます。旧`.news-*`は変更していません。

FR-N1修理後、Frontは文字nodeの行数を数えるよう撮影scriptを2か所修正しました。gridの行高まで伸びた日付要素の高さを行数と誤認したためです（`capture-front-4.log`は修正前の失敗、`capture-front-5.log`は修正後の54枚・全判定通過）。ただし画像では、各行が別のgridを持つため、1440pxの日付欄が88・100・181・215・240pxに分かれ、タイトルと本文の開始位置がそろわない問題FR-N2が見つかりました。

FR-N2では、`#news-items`を2列の親gridとし、全行をsubgridで同じ列に合わせました。表示中の最長日付に合わせた1つの幅を使い、下限88px・上限min(240px,画面幅−236px)、gap24px、390pxの本文180px以上を保ちます。全件がYYYY.MM.DD形式なら88pxです。短い日付が自由記述日付と混在する場合も同じ列幅です。語中折返しの制限・文字原文・上下padding16px・行の下線・390pxの行間8px・旧`.news-*`は保持しています。

**FR-N2修理後の撮影と再確認は、このあとFrontが行います（この文書の時点では未実施）。** 同じ`capture-home.py --serve`で、通常の画像に加え`home-freeform-news-dates-1440.png`（1440×900）と`home-freeform-news-dates-390.png`（390×844）を撮影します。追加の架空日付・長い1語を含め、日付要素と語の行数・幅・はみ出し、本文幅、通常日付88px・間隔24pxをassertし、`capture-metrics.json`へ記録します。新しい全撮影は54枚の予定です。今回のWorkerは新規撮影しておらず、FR-N1後の既存54枚・metricsを保持しています。撮影scriptには、全行の`.site-news-content`の左端の差が0.5px以内というassertを追加しました。Frontの文字nodeによる`lines`と高さ換算の`boxLines`は保持しています。

FR-N1のfocusedはRED 2 fail→GREEN 2 pass（82 skip）。全試験はNode 376/376・Worker 347/347、JS構文3件・local verify・status・diff checkはexit 0。証拠はverification/fr-n1-*.logとfr-n1-results.json。

Blocking Findingsは既知の未修理blockingがないことを示す。FR-N2後の独立再review・画面受入・gate 4/5のOwner承認・Front completionは未実施。確認2でPC・スマホ画面と実音・閉じるを最終確認する。Q42-01の例外未受入ならmergeへ進めず、stateは承認待ちを保つ。

使い捨てcopyだけに仮承認・Completeを置いた`validate_close_ready`の書式事前検査はPASS。実際のstateは承認待ちのまま保持している。

- Code Generation Result: `construction/aidlc-integration/code/code-generation-summary.md`
- Build/Test Result: `construction/build-and-test/build-and-test-summary.md`
- 実装の特定: `construction/aidlc-integration/verification/implementation-manifest.sha256`

FR-N2のCSS focusedはRED 1 fail（exit 1）→GREEN 1 pass（exit 0）、各20 skip。全試験はNode 377/377・Worker 347/347、focused全体85/85。JS構文3件・local verify・status・diff checkはexit 0。証拠はverification/fr-n2-results.json・fr-n2-*.log。承認1〜3・固定入力/昇格の照合と、使い捨てcopyだけでのclose書式事前検査はPASS。

## 確認2承認とclose準備（Worker 06b / 2026-11-18）

- owner/approver: Itsuki Matsumoto。executor: bounded Worker 06b。独立ReviewerとFront completionはFrontが担当し、本Workerは自己承認しない。commit_mode=none、risk_class=D0、ui_route=none。
- read_summary: 元Packet・06のBLOCKED結果・06b例外・承認原典・review結果・repo close/approval契約を照合。operation_class=local approval transcription and transactional cycle close。write_plan=承認2記録とcycle-summary/audit/stateを更新し、validate_close_ready後にclose、archive/local/status/試験/scopeを検証する。
- Packet原因と例外: 元Packetは原典全文転記と本番値非記録が矛盾していたためBLOCKED。06bでは承認記録2件への原典逐語引用とそのclose移動・検査複写だけを例外とし、新規要約・audit・stateには本番値を書かない（Front記録: /Users/itsuki.matsumoto/claude-code/docs/ai-governance/feedback/2026-11-18_gate-prompt-included-prod-values.md）。
- 独立review: review-01はREJECTED（RV42-01〜07）。修理後のreview-02はAPPROVED、RV42-01〜07は全てRESOLVED、新しい指摘なし。FR-N1・FR-N2修理差分のreview-03もAPPROVED、新しい指摘なし。原典はroot scratchのreview-02-result.md（SHA-256 d946ed0a9e70a77358159a75972eaabb3403560ea4c53569071b7839637189d7）とreview-03-result.md（SHA-256 f2374902ab9cfd1f6c28b55d3f6f34b09c68215e93cc2d395ed0edf73b2b4d78）。
- Front最終撮影: construction/aidlc-integration/verification/capture-front-6.log、54枚、判定は全て通過。capture-metrics.json SHA-256 c89dbc5ecc8e05158d273b529d59f1eec2ad0e7eb5e2539f16f4bb5525e1a5e5。logの54件とmetrics digestを本Workerが照合し、新規撮影はしていない。
- 承認済みCode Generation Result（SHA-256 e9e95b733335fe4086f90ffc2b7892880540d23b3eab419d0b94de58e37eea54）とBuild/Test Result（SHA-256 b33db14789a35396329d70757ed05f57f6e453862404d97dfcfa4bf26bcf290c）の「未実施」は最終撮影とreview-03より前のsnapshot。bytesを変えず、本節で後続結果を補完する。上の履歴中の「待ち」「未実施」も各記録時点の状態として保持する。
- #41から引き継いだ本番確認（Front証言）: Itsukiが本番管理画面で実際の1作品に「種別」「その場で再生する映像」を保存し、その作品を「顔にする作品」に選択。2026-11-18取得の本番公開データで3項目が入っていたことをFrontが確認。値は記録しない。
- 確認2画面（Front証言）: branch公開ページを手元配信し、PCは許可済みhttp://localhost:8888から本番公開APIを直接読み、スマホはngrok経由の同じ配信から公開データの写しを読んだ。提示前にFrontがPlaywrightの1440×900と390×844で両方を開き、Home ready、顔の作品の作品名・種別と日付・「聴く」・「配信先へ」、news 6件、links 5つ、console error 0、横スクロールなしを確認。画面内の本番値・repo外の画像は本記録に取り込まない。
- Owner承認: Prompt timestamp=2026-11-18T08:48:13+09:00、Response timestamp=2026-11-18T08:54:58+09:00、Approver=Itsuki Matsumoto、raw response=A。gate 4・5のexact digestを承認。Q42-01は提示文の条件に従いAで受け入れ。実機で追加の1回が必要だったかは回答に述べられておらず、実機の操作・実音結果を推測しない。再承認は行わない。
- 承認原典: /Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-223255_1212hp-42-home/gate-45-owner-responses.md SHA-256 9a87625511129fd9fcb52e90b9b96aeca1f79c163251d695cdfe535397c12d60。完全prompt SHA-256 14ca9e43a439ce30825a2b736f4c50df6b7d732d113d75f02e3f1464ad5d7576。逐語転記はapprovals/04-code-generation-result-approval.md・05-build-test-result-approval.mdに保存。
- close: stateをComplete / Complete / None / Completeへ更新し、validate_close_readyがPASSした場合だけscripts/aidlc-cycle.sh close 2026-11-17_issue-42_homeを実行する。publish後の本記録は書き換えず、実行結果・archive/local/status・close後の試験とscope検証はroot scratchのworker-06b-result.mdへ記録する。
- reader_profile: audience_class=machine_trace、language=ja-JP、review_surface=none、source_of_truth=承認原典・review原典・Front証言・repo validator。sanitize-artifactsのtrace境界に従い原典と必要な経緯を保持。Front-only管理、network、外部write、再委任は行わない。
