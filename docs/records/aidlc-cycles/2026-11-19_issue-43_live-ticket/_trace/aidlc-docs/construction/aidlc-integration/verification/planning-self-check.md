# 候補作成の自己検証（Issue #43、Worker 1212hp-43-packet-01 → Packet 01b で再実施）

実施: 2026-11-19（Packet 01bでFront判断FD1・FD2を反映した後）。対象は未承認の候補で、実装・試験・撮影・承認は含まない。コード・試験・`docs/specs/current/`を変えていないため、アプリの全試験と撮影は実行していない。

| # | 検査 | 結果 | 根拠 |
|---|---|---|---|
| 1 | 5 gateのREQUIRED行が各1回で、checked、pathが`approval_mapping`と一致 | PASS | 実行計画§3。各行を`- [x] `つきの完全一致で数え、各1。 |
| 2 | 不要stageのSKIP行が9件、すべてchecked、理由が空でない | PASS | 実行計画§4。 |
| 3 | 未チェック行（`- [ ]`）がない | PASS | aidlc-docsのmarkdown全体で0。 |
| 4 | 承認記録を作っていない | PASS | `aidlc-docs/approvals/`は空。 |
| 5 | stateがRequirementsの承認待ち | PASS | `Approval Gate: Requirements`・`Approval Status: Pending`。Candidate Readinessの記述だけ第2版に改めた。 |
| 6 | `scripts/aidlc-cycle.sh status`が成功 | PASS | exit 0、`Cycle ID: 2026-11-19_issue-43_live-ticket`・`Cycle Status: In Progress`。 |
| 7 | 提案版3文書のSHA-256と、計画の記載が一致 | PASS | public-site-ui `51d9c23e37525c79b8f87b889f7e4758441cf3d1852600a29b5b617cf2a0691a`（Home・Live・Ticketの不正URLの文言の1文を改めた版）、live-operations-admin-ui `80a3363ed23b60bfc42dcd8a03583cbbf89ce27a6ca18b1b6ed26dd63ce4e62f`（変更なし）、README `3e10bd642a8d8441d35a75ce0417a424a38dd738d841abbb50638f34953aac75`（変更なし）。各hashが計画に1回ずつ載る。 |
| 8 | 昇格先の現行3文書が計画の「元版SHA-256」と一致（未昇格） | PASS | `1aa471eb…`・`f031cc24…`・`8ecd9e3c…`。 |
| 9 | 提案版public-site-uiは元版との差が意図した節だけ | PASS | 元版との`diff`で、見出し・§2末尾・§3・§5・§6の1文・§7（Home契約の1文と#43の節）だけが違う。Home契約の1文は「予約URLが無効です」から「予約先を確認中」へ、§5の予約の出し分けの1文はHomeも揃える記述へ（Q43-01）。 |
| 10 | Figma整合案のSHA-256が計画に載り、一致 | PASS | `figma-fix-requests.md` `892b62d7bb3a86ff4bbe93976ef73b99751fcfa11a2579f631a85e276f2e91a7`。計画に1回。 |
| 11 | Requirementsの安定ID（R43-01〜20、S43-01〜16・L、F-01〜19、AC。AC43-HOME-CTAを追加）が定義され、計画§2.8とFigma整合案F43-01〜11が対応 | PASS | 前回の110項目のscript検査の対象は変えておらず、追加したAC43-HOME-CTAはRequirements・計画の両方にある。 |
| 12 | `git status`でaidlc-docs以外が無変更 | PASS | 変更は`aidlc-docs/`配下だけ（`aidlc-docs/README.md`はcycle開始時の更新）。`git diff --check`もexit 0。コード・試験・`docs/specs/current/`・`assets/`・`admin/`・`cloudflare/`・各HTMLは無変更。 |
| 13 | 本番の値をaidlc-docsへ写していない | PASS | scratchの写しの全文字列値（152件、4文字以上）をaidlc-docs全体と照合し、一致は17件で、schemaのkey名・共通のUI文言（「予約する」）・`meta.updatedAt`だけ。タイトル・日付・会場・料金・出演者・URL・画像のpathは写していない。 |
| 14 | 計画に未決の印（二重波括弧・TODO・TBD）がない | PASS | このself-check以外のaidlc-docsで該当なし。 |
| 15 | Node20のpathと`- **Blocking Findings**: None`のfield形式が計画にある | PASS | 計画§4・§8。 |
| 16 | 「予約URLが無効」が今の文言・改める前の説明としてだけ残る | PASS | 該当は、Requirements（R43-06・S43-06・S43-11の注・§9）、計画（§2.2・§2.4・§3・§4・§5・§9）、Figma整合案F43-01、提案版§5の1文、auditの記述（Packet 01の時点の記録とPacket 01bの節）。いずれも「今の文言」「改める前」「元に戻す先」の説明で、新しい表示の期待としては残っていない。 |
| 17 | FD1の一貫性: Homeを揃える作業が計画の中にあり、「回答まで変えない」「再承認を取って足す」の分岐が残っていない | PASS | 計画§2.4・§3・§4（段2のRED→GREEN）・§5・§7・§9に反映。`回答まで変えない`・`再承認を取って足す`は計画に0件。 |

未確認（候補の作成の範囲外）: render画像、font、実音、実機、本番の画面、独立review、Owner承認、Front completion、マスタへの反映（F43-02〜09）、Homeの状態`24:139`への見本の追加。基準の513/0・347/0と`scripts/aidlc-verify.sh --local`のPASSはFrontの報告で、Workerの実測は`aidlc-cycle.sh status`と文書の自己検証だけ。
