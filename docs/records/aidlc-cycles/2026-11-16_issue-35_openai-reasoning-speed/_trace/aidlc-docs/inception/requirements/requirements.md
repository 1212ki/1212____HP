# Requirements — AI整理の待ち時間を短くする（Issue #35）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-16_issue-35_openai-reasoning-speed`
- 対象: 管理画面の「元情報から作成」／`POST /api/admin/live-source-intake`

## 1. 目的と変更

元情報を貼ってAI整理を実行した人の待ち時間を短くする。OpenAIの考える量を最小にし、抽出が15秒枠で終わりやすくなることを狙う。現在は`reasoning`未指定である。変更は`requestOpenAiLiveDraft`のResponses API request bodyへ`reasoning: { effort: "minimal" }`を1行追加する。

本番で「Claudeで整理しました」と表示され、待ちが長かったことはOwnerの報告である。OpenAIの既定effortやtimeoutが原因だったこと、速度と抽出精度への効果は未確定で、今回の設定追加で確かめる仮説として扱う。

本書・Workflow Plan・Code Generation Planは未承認の候補である。3成果物の承認前はcurrent canonical・code・testを変更しない。

## 2. 満たす条件

| 要件 | 変更後の契約 |
|---|---|
| R1: 考える量 | OpenAIへ必ず`reasoning: { effort: "minimal" }`を送る。`LIVE_AI_MODEL`の未設定・空白・上書きでも同じ指定にする。新しい設定変数は作らない |
| R2: 既存契約の保持 | 他のOpenAI body（`model`・`instructions`・`input`・`text.format`）、Claude側、OpenAI→失敗時Claudeの順序、各15秒・全体30秒、エラー分類、管理画面表示を変更しない |
| R3: 抽出の保持 | `LIVE_AI_INSTRUCTIONS`、`LIVE_AI_OUTPUT_SCHEMA`、`validateLiveAiDraft`を変更しない。対象は`date`・`title`・`venue`・`openTime`・`startTime`・`ticket`・`notes`・`performers`・`ticketUrl`・`link`の10項目。元情報・失敗時の入力保持・保存前確認を維持する |
| R4: 正本と確認 | current specの§7.5、Issue #35のAC・検証、承認根拠、索引、Worker READMEのAI整理節を整合させる。Code Generation Planに変更前→変更後の全文差分を固定し、gate 3承認がその本文差分のOwner確認を兼ねる |

canonicalには、OpenAIの考える量が最小であることと、管理者が画面で待つ操作で元情報からの抽出だけを行うため、という理由を記載する。既定モデルは`gpt-5-mini`のままとする。

## 3. 受入条件

Issue #35本文の4条件を出現順に対応させる。以下は実装後・本番確認後の合格条件であり、今回の候補作成時点のPASSではない。

| ID / Issue本文対応 | 検証可能な条件 | 証拠 |
|---|---|---|
| AC-35-01 / 1 | OpenAI outbound bodyの`reasoning`が厳密に`{ effort: "minimal" }`。未設定・空白時の既定モデル、上書き値・trimを保持する | 既存fetch stubを使うWorker focused testのRED→GREEN |
| AC-35-02 / 2 | R2・R3が変更されず、OpenAI成功時はClaudeを呼ばない。HTTP 400を含む失敗時の切替、各15秒・全体30秒、最終エラー、provider表示の既存testが通る | production差分がR1の1行だけであることの確認、Worker focused・root全test・Worker全testがPASS |
| AC-35-03 / 3 | current spec・索引・Worker READMEが承認済みCode Generation Planの逐語差分に一致し、理由と設定が読める。gate 3のOwner承認を根拠にDraft→Approvedを完了してから実装する | 差分突合、5 gateのartifact-bound記録、実装後の独立review |
| AC-35-04 / 4 | deploy後にOwnerが同じ元情報で試し、「OpenAIで整理しました」と表示され、従来より待ちが短いと確認する | deploy後のOwner報告。mock test・review・cycle closeでは代用しない |

実APIの速度SLAや秒数の合格線は追加しない。Ownerが「待ちが短い」と確認できない場合、AC-35-04は未達として残し、モデル・timeout・順序等を追加変更せずFrontへ返す。

## 4. リスクと未確認事項

| 区分 | 内容と扱い |
|---|---|
| Gap: model対応 | Frontが2026-11-16に取得した公式docsではeffortの対応値がmodel依存とされ、現在の`gpt-5-mini`ページに`minimal`対応と既定effortの記載がない。従来のGPT-5系対応を根拠に今回採用する判断は、現行docsと実APIで再確認できていない |
| Risk: model上書き | `LIVE_AI_MODEL`を`minimal`非対応のモデルへ変えるとOpenAIが毎回HTTP 400となり、設定されたClaudeへ毎回切り替わり得る。Claudeも利用できなければ既存の502/504となる。モデルごとの自動effort調整は加えない |
| Risk: 本番効果 | `minimal`でも15秒超過・初回schema compilation・他のAPI失敗は残り得る。「Claudeで整理しました」は成功providerだけを示し、timeoutや非対応400の確定診断にはならない |
| Gap: 精度と速度 | mockはrequest契約・既存validatorの保持を証明するが、抽出精度・credit・model entitlement・実速度は証明しない。Ownerは本番の抽出内容も保存前に確認する |
| Fact / 範囲外 | Front取得のモデルページでは`gpt-5-mini`がDeprecated。既定モデルの見直しは別Issueにする |

根拠: `cloudflare/worker/src/worker.js`の`requestOpenAiLiveDraft`と既存test、current spec §7・§12.1、Worker README、Issue #35のローカル写し。公式調査はFront提供の[reasoning guide](https://developers.openai.com/api/docs/guides/reasoning)と[gpt-5-mini model page](https://developers.openai.com/api/docs/models/gpt-5-mini)。Workerはnetwork・実API・secretを使わない。本人原文、出典の役割、Fact／Inference／Gapは`aidlc-docs/audit.md`に保持する。

## 5. 非目標と承認境界

- 既定モデルの変更、Claude先行、timeout値の変更、effortを変数で切り替える機能。
- 抽出指示・10項目schema・validator・管理画面・DB・SDK依存の変更。
- 本packetでの承認記録、current canonical、code、testの変更。承認後の実装は後続委任で行う。
- merge・production deploy。本cycleの2回の成果物確認に加え、これらの操作はOwnerの明示承認を別途必要とする。

本人確認は確認1でgate 1〜3、確認2でgate 4〜5をそれぞれまとめる。canonical専用のOwner確認は挟まない。独立read-only reviewは、1行で可逆な変更のため、実装後に設計と実装をまとめて1回行う。Owner判断・独立review・Frontの全体受入を分け、本番の効果確認はdeploy後に残す。
