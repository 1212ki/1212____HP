# Code Generation Result — OpenAIの考える量を最小にする（Issue #35）

- 状態: 実装・自己検証済み / gate 4のOwner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-16_issue-35_openai-reasoning-speed`
- 作成日: 2026-11-16
- **Blocking Findings**: None

管理画面で元情報をAI整理する際、OpenAIへのrequestに`reasoning: { effort: "minimal" }`を1行追加した。画面で人が待つ抽出操作のため、考える量を最小にする。速度改善は仮説であり、本番での効果はまだ確認していない。

`cloudflare/worker/src/worker.js`の`requestOpenAiLiveDraft`だけを変更した。追加1行を取り除いた全文がHEADとbytes一致し、モデル、他のrequest field、Claude側、provider順、期限、エラー、管理画面、抽出指示・10項目schema・validatorを保持している。

current spec・索引・Worker READMEは、gate 3承認済みのCode Generation Plan §2からdiffを抽出して機械適用した。specと索引をDraftへ戻し、承認済み差分と全文一致を確認してApprovedへ戻した。承認記録01〜03はFrontの完全な提示文・本人回答A・timestampを転記し、repositoryの`validate_approval`が3件とも通った。承認済み3成果物のbytesは不変。

| 受入条件 | 実装・自己検証の結果 |
|---|---|
| AC-35-01 | 既定・上書き・空白・前後空白付きモデルのoutboundに`reasoning.effort: "minimal"`。top-level key 5つと`text.format.name`も確認 |
| AC-35-02 | production差分は1行。既存assertionを残し、root 239/239、Worker 271/271、admin focused対象81/81がPASS |
| AC-35-03 | canonical 3文書が承認済み逐語差分と一致。gate 3を本文差分のOwner確認根拠にした。独立reviewはFront手配待ち |
| AC-35-04 | deploy後のOwner確認待ち。同じ元情報で「OpenAIで整理しました」と出て、従来より待ちが短いことを本人が確認する |

focused testは実装前に185件中180 PASS / 5 FAIL、追加後に185/185 PASSとなった。失敗は`undefined`と`{ effort: "minimal" }`の不一致4件と、その親testの集約1件。生出力は`aidlc-docs/verification/focused-red.tap`と`focused-green.tap`、全commandと件数はBuild/Test Resultにある。

`gpt-5-mini`の現在の`minimal`対応、実APIの成功・速度・抽出精度は未検証。非対応モデルのHTTP 400は既存のClaude切替へ進むため、Claude表示だけでは原因を確定できない。独立review、gate 4・5のOwner判断、Front受入、本番確認をそれぞれ残す。cycleはactiveのまま。
