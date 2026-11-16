# Build/Test Result — OpenAIの考える量を最小にする（Issue #35）

- 状態: 自動検証PASS / gate 4・5のOwner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-16_issue-35_openai-reasoning-speed`
- 作成日: 2026-11-16
- **Blocking Findings**: None

Node `v20.19.4`で承認済み計画のtestを実行し、root 239/239、Worker 271/271が合格した。各回帰のfail / cancelled / skippedは0。Workerはbaselineの268件から、空白・trimのtable testと2 subtestの計3件が増えた。

実行時は`/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin`をPATHの先頭に置いた。実APIはfetch stubで隔離し、既存の依存を使用した。npmのcacheと内部tempfileは許可済み`dryrun/`内へ向けている。

| command（repository rootから） | 結果 |
|---|---|
| `node --version` | `v20.19.4` |
| `node --test cloudflare/worker/test/live-ai-source-intake.test.js`（実装前、18:46:18+09:00） | exit 1。185件中180 PASS / 5 FAIL、cancelled / skipped 0。追加したreasoning assertion 4件と親test集約1件の期待したRED |
| 同command（1行追加後、18:47:11+09:00） | exit 0。185/185 PASS、fail / cancelled / skipped 0 |
| `node --test --test-name-pattern='AIで整理 source intake' test/admin-live-operations.test.mjs` | exit 0。対象81/81 PASS、登録150 / skipped 69（pattern対象外）、fail / cancelled 0 |
| `node --test test/` | exit 0。239/239 PASS、fail / cancelled / skipped 0 |
| `npm --prefix cloudflare/worker test` | exit 0。271/271 PASS、fail / cancelled / skipped 0 |
| `node --check cloudflare/worker/src/worker.js` | exit 0 |
| `scripts/aidlc-verify.sh --local` | exit 0。v1.0.1、manifest `02c49d1de2167f0ed2c90123871bce6d96cf052294672f451df83b1aa5cff9e9`。live source authenticityは未確認 |
| `scripts/aidlc-cycle.sh status` | exit 0。Code Generation Result / In Progress。stateのApproval GateもCode Generation Result、Approval StatusはPending |
| `git diff --check` | exit 0 |
| `git status --short`、`git diff --stat`、`git diff -- cloudflare/worker/src/worker.js` | 許可範囲だけ。production差分はreasoningの1行。既存180fileのhash照合でも、cycle外の変更は指定の5fileだけ |
| `validate_close_ready`（隔離copyだけ） | exit 0。実Owner承認を使わない書式・構造の事前検査。copy内だけで仮04・05、stateの終端値、01〜03のabsolute path bindingを準備 |

全回帰とadmin focusedは2026-11-16T18:47:52+09:00に開始した。生出力は`aidlc-docs/verification/`の`focused-red.tap`、`focused-green.tap`、`root-regression.tap`、`worker-regression.tap`、`admin-focused.tap`。MockTimersの既存`ExperimentalWarning`がWorker出力にあるが、予期しない失敗・skipはない。

canonicalは計画§2のdiffを`git apply`し、HEADと承認済みhunkから別計算した期待全文に3文書ともbytes一致した。逆patchの`git apply --reverse --check --verbose -`も通過した。productionは追加したreasoning 1行を取り除くとHEADとbytes一致し、既存testのassertionを削っていない。承認記録01〜03の`validate_approval`は3件ともexit 0。

`Blocking Findings: None`は自己検証範囲に技術的な阻害がないことを示す。独立reviewはFront手配待ち、実worktreeの承認記録04・05は未作成。隔離copyでは仮記録以外にstateの5fieldと、copyされた01〜03のabsolute path・fixture注記だけを変え、対象5成果物のbytesを保持した。`command_close`は呼んでいない。この構造検査は実worktreeのclose readinessやOwner承認を成立させず、実承認後の計画§5のread-only検査とFront受入は別工程である。

AC-35-04はdeploy後のOwner確認待ち。実APIの`minimal`対応・速度・抽出精度・権限・creditは未検証で、mockの合格では証明できない。Ownerは同じ元情報でOpenAI表示と待ち短縮を確認し、保存前に抽出内容を確かめる。
