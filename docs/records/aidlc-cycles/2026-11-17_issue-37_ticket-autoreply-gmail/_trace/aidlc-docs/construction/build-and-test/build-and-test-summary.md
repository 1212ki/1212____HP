# 検証結果 — ticket予約のGmail控え（Issue #37）

- Status: Candidate / gate 5 Owner承認待ち（gate 4と同時に提示）
- Cycle ID: `2026-11-17_issue-37_ticket-autoreply-gmail`
- Reader: human_reader / ja-JP / CotEditor（Frontが開く）
- **Blocking Findings**: None
- 独立review: APPROVED（2026-11-17、作成者とは別のread-only Codex実行 `1212hp-37-r04-review`、findingsなし）

自動検証はすべてPASS。実装前に新契約の不足で失敗することを確認し、実装後に同じfocused群と全回帰を実行した。実API・Google・secret・本番D1には接続していない。

各Node commandはPATH先頭を`/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin`に固定して実行した。

| command | 結果 | 証拠（このdirectory内） |
|---|---|---|
| `node --version` | `v20.19.4`、exit 0 | `node-version.log` |
| `node --test cloudflare/worker/test/ticket-autoreply.test.js cloudflare/worker/test/ticket-autoreply-apps-script.test.js cloudflare/worker/test/public-ticket-boundaries.test.js cloudflare/worker/test/manual-ticket-reservations.test.js` | RED: 79 PASS / 55 FAIL、exit 1 → GREEN: 134/134、exit 0 | `focused-red-1.log`、`focused-green-1.log` |
| `node --test test/public-ticket-routing.test.mjs test/admin-live-operations.test.mjs` | RED: 188 PASS / 3 FAIL、exit 1 → GREEN: 191/191、exit 0 | `focused-red-2.log`、`focused-green-2.log` |
| `node --test test/` | 242/242、exit 0 | `root-regression.log` |
| `npm --prefix cloudflare/worker test` | 324/324、exit 0 | `worker-regression.log` |
| `node --check cloudflare/worker/src/worker.js`、`node --check assets/js/ticket.js`、`node --check admin/app.js` | すべてexit 0 | `checks.log` |
| `scripts/aidlc-verify.sh --local` | exit 0、manifest `02c49d1de2167f0ed2c90123871bce6d96cf052294672f451df83b1aa5cff9e9`。source authenticityは未検証 | `checks.log` |
| `bash aidlc-docs/construction/build-and-test/validate-approvals.sh` | repositoryの`validate_approval`が01〜03をすべてPASS、04・05は未作成 | `approval-validation.log` |
| `python3 -B aidlc-docs/construction/build-and-test/verify-implementation.py` | canonical 4文書9組・Apps Script全文・承認済み3 digest・prompt転記・許可path照合PASS | `canonical-verification.log` |
| `scripts/aidlc-cycle.sh status`、`git diff --check`、`git status --short`、`git diff --stat` | exit 0、active / 独立review待ち・gate 4待ち、許可path内のみ | `final-checks.log` |

GREEN・全回帰のfailure・cancelled・skipはすべて0。baseline（root 239、Worker 271）からroot 3件、Worker 53件増えた。

REDは新helper／新gs不在だけでなく、既存送信のmultipart形式、token未設定でも送る挙動、HTTP成功だけの判定、上流エラー露出、旧HTML・正規化の残存でも失敗した。syntax破損をREDの根拠にしていない。公開/adminの追加testでは、既存の複数行HTMLと戻り値なしの保存APIにassertionを合わせた（承認済み動作の変更なし）。

Apps Scriptの実fileをNode VMで読み、Gmail等をstubして38件を検証した。宛先・BCC・表示名・件名・本文の完全一致、不正token／未設定、必須キー欠落・空値、重複、MIME、メール・CRLF・枚数、備考空、Gmail例外、任意宛先・件名・本文指定の無視を含む。公開D1 stubは保存後POST・失敗時201、旧2キー除外・既定／保存済み完了文・contact保持を確認。既存routing・確認・manual・LINEの回帰もPASS。

- AC-37-05: Apps Script公開・secret登録・deploy後のOwner到達確認待ち。
- AC-37-06: 自動検証と独立review（APPROVED、findingsなし）まで成立。gate 4・5 Owner承認とFront受入は未実施。

Googleの公開設定・送信枠の実状態、POST後302と最終JSON、申込者と運営への実到達をstubでは証明できない。Ownerが公開後に確認する。close validator・cycle closeは実行していない。
