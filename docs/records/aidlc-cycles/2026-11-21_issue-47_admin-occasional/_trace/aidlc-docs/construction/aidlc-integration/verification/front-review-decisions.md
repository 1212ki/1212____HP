# Front の判断: 独立 review（review-01）の指摘の扱い

- review: `review-01-raw.md`（Packet `packet-03-review.md`、SHA-256 は `packet-03.sha256`）。verdict APPROVED、blocking 0件、low 5件。
- 判断の基準: この管理画面を使うのは Itsuki 1人で、たまにする更新は頻度が低い。頻度・影響・戻せるか・作る量で、直すか既知の制限にするかを選ぶ。

| id | 内容 | 判断 | 理由 |
|---|---|---|---|
| RV47-01 | Local Mode の「JSONを書き出す」は、各タブの未保存の入力を書き出しに入れない（base は入力の時点で入っていた） | 直さない。既知の制限として結果に書く | 承認済みの R47-15（各「保存して公開」でメモリへ反映し、header で書き出す）どおり。入力は「未保存」と出続けるので、気づける。Local Mode はふだん使わない従来の運用。 |
| RV47-02 | 開いた直後に最初の欄に focus が入り、赤い枠が出る。スマホではキーボードが開くことがある | 直さない | #46 の Live と同じ動き（本番に出ていて、Itsuki が毎日使っている型）。#47 だけ変えると型が揃わなくなる。変えるなら Live と一緒に別の Issue で。 |
| RV47-03 | Profile のリンクを変えると、全行の `name`・`url` を書き直す（base は変えた行だけ） | 直さない | 本番の `profile.links` は全件 `{name, url}`（分類 2026-11-21）で、書き直しても値は同じ。T47-EQ（Profile）は base と同じ本文で通っている。違いが出るのは `url` を持たない行がある時だけで、実データに無い。 |
| RV47-04 | `capture-admin-live.py` を「2点だけ」変えたことを守る試験が無い | Front が diff を目視して確認済み（2026-11-21） | diff は、タブの期待（6→5）、接続失敗の header の「保存」の期待、その2点の `--self-check` の追加だけ。ほかの検査は #46 のまま。撮影の道具なので、試験で縛る量は足さない。 |
| RV47-05 | modal を外したあとの死んだ分岐（`generic-modal`、`modalReturnFocusLive`、`saveToApi` の payload なしの既定） | 直さない。後の整理 | 本番の呼び出しから到達しない（review が grep で確認、T47-MODE が「`saveData` は `saveToApi` を呼ばない」「呼び出しはすべて payload つき」を縛る）。`saveToApi` の既定は `T46-PIN (h)` の窓。 |

- Reviewer の求めた確認（handoff）:
  1. 全試験: Front が `node --test test/` を実行して 1326 tests / pass 1323 / fail 0 / skipped 3、`npm --prefix cloudflare/worker test` は 361 / 0（2026-11-21、段7のあと）。
  2. `capture-admin-live.py` の diff: 上の RV47-04 のとおり確認。
  3. 撮影3: `capture-front-4/`（front-capture-log の「撮影3」）。
  4. 昇格した設計書の SHA-256: `docs/specs/current/live-operations-admin-ui.md` `799ef584…`、`README.md` `3f64dcf9…`。計画 §3 の値と一致。承認済みの Requirements・Workflow Plan・Code Generation Plan・figma-fix-requests.md の bytes も不変（`d1d7fa30…`・`c29a87cb…`・`fa7792cb…`・`968dda2d…`）。
- 修理の Packet は出さない（blocking 0件、low はすべて上のとおり）。
