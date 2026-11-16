# Requirements — AI整理のprovider自動切替（Issue #33）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-16_issue-33_ai-provider-fallback`
- 作成日: 2026-11-16
- 対象: `POST /api/admin/live-source-intake`と管理画面の「元情報から作成」

## 1. 目的と現在地

管理者がOpenAIとClaudeのどちらにAPIクレジットがあるかを気にせず、元情報からLiveの下書きを作れるようにする。OpenAIを先に試し、利用できなければ同じ元情報でClaudeを呼ぶ。どちらかの検証済み結果が得られた時だけ、対象10項目を一括反映する。

現在はOpenAIだけを呼び、失敗するとAI整理が止まる。変更後も、元情報を保持して再抽出し、保存前に内容を確認し、管理者の「保存して公開」で公開する流れを維持する。

変更種別は既存機能の拡張、対象はWorkerとadminの2箇所、複雑さは中程度である。本書・Workflow Plan・Code Generation Planは承認前の候補で、現在有効な仕様や実装をまだ変更しない。本人原文と調査根拠は`aidlc-docs/audit.md`に保持する。

## 2. 期待する動作

### R1. providerを選ぶ順序

| 設定されたsecret | 呼出順と成功時 |
|---|---|
| `OPENAI_API_KEY`と`ANTHROPIC_API_KEY` | OpenAIを1回呼ぶ。有効なdraftなら終了し、Claudeは呼ばない。OpenAI側の失敗ならClaudeを1回呼ぶ |
| `OPENAI_API_KEY`だけ | OpenAIを1回だけ呼ぶ |
| `ANTHROPIC_API_KEY`だけ | Claudeを1回だけ呼ぶ |
| 両方なし・空・空白のみ | 外部APIを呼ばず`503` |

管理認証失敗は`401`、JSON不正またはtrim後1〜12,000文字の範囲外の`sourceText`は`400`として、providerを呼ぶ前に返す。2社を呼ぶ場合、最初にtrimして確定した同じ`sourceText`を使い、既存fieldや途中結果を次の入力へ混ぜない。

### R2. OpenAI側の失敗はすべて切替対象

クレジット切れに限定せず、認証、rate limit、上流HTTP非2xx（4xx・5xx）、通信失敗、timeout、refusal、incomplete、空出力、上流JSON不正、抽出JSON不正、schema不正、`validateLiveAiDraft`不合格のすべてでClaudeへ進む。HTTP `200`だけでは成功としない。クレジット残高照会やprovider内部のエラーcodeによる限定判定は行わない。

呼出しは各provider最大1回、合計最大2回とする。失敗状態を記憶せず、次の整理でも設定されたOpenAIを先に試す。全体期限を使い切った後は新しい呼出しを始めない。

### R3. 抽出・検証・反映の契約

`LIVE_AI_INSTRUCTIONS`と`LIVE_AI_OUTPUT_SCHEMA`を内容変更せず両providerで使い、両方の結果に同じ`validateLiveAiDraft`を適用する。対象は`date`、`title`、`venue`、`openTime`、`startTime`、`ticket`、`notes`、`performers`、`ticketUrl`、`link`の10項目だけで、型、文字数、実在日付、時刻、URLの検証を保つ。不明な値は空文字とし、空文字も全置換する。

成功時は10項目と告知previewを一括更新する。両方失敗、payload不正、反映途中の失敗では10項目・preview・元情報を元のまま保持する。待機中に元情報または対象入力が変わった場合、古い応答を反映しない。別Liveへ移った後の応答も反映しない。AI整理は保存・公開・X送信・DB更新を起こさない。

## 3. 待ち時間とエラー

### R4. 全体上限は30秒、各providerは最大15秒

入力検証後、provider処理を開始した時点から、fetch、body受信、JSON解析、draft検証を含む全体期限を`30,000 ms`とする。OpenAIは現行と同じ最大`15,000 ms`、Claudeは最大`15,000 ms`かつ全体の残り時間以内とする。キーが片方だけでもそのproviderは最大15秒である。Claudeに入る時点で全体期限をリセットしない。

根拠は、現在成功しているOpenAIの15秒枠を縮めず、切替先にも同程度の処理枠を与え、管理者の待機を約30秒以内に収めるためである。期限後の結果は採用せず、外部fetchをabortし、body受信が止まった場合も待機を打ち切る。30秒はWorker内の処理予算であり、ブラウザとWorker間の通信遅延・入力upload・event loop停止を含む厳密なend-to-end保証ではない。実APIの速度や初回schema compilationによる成功率は未計測である。

### R5. 返すエラーは既存の固定文言

| 条件 | HTTP | `error` |
|---|---:|---|
| 管理認証失敗 | 401 | `unauthorized` |
| 入力不正 | 400 | `invalid sourceText` |
| 両方のsecretが未設定 | 503 | `AI source intake is not configured` |
| 全体期限到達、または最後に試したproviderがtimeout | 504 | `AI source intake timed out` |
| 利用できるproviderがすべて失敗し、上記timeoutに当たらない | 502 | `AI source intake failed` |

OpenAIのtimeout後にClaudeが成功すれば`200`、ClaudeがHTTPエラーなどで失敗すれば`502`、Claudeもtimeoutすれば`504`とする。単一providerの場合は現行と同じ失敗分類となる。APIキー、providerのエラー本文、request ID、抽出プロンプトはクライアントへ返さず、新たにrawログへ出力しない。

## 4. provider表示とAPIの変更

### R6. 成功したproviderだけを小さく表示

新しい成功応答はtop-levelの`draft`に加えて`provider`を持ち、値は`openai`または`claude`に限定する。10項目schemaの中にはproviderを加えない。失敗応答にはprovider、失敗履歴、モデル名を加えない。

管理画面は「元情報から作成」の既存status欄`live-source-warnings`に、反映成功後だけ次を表示する。既存の`.parse-warnings`（`font-size: 0.85em`）を使い、desktop/mobileとも同じ場所に置く。

- `openai`: 「OpenAIで整理しました。内容を確認してから更新してください。」
- `claude`: 「Claudeで整理しました。内容を確認してから更新してください。」

表示は固定の対応表と`textContent`で作る。Claude表示は今回使ったproviderを知らせるもので、OpenAIのクレジット切れを確定する表示にはしない。整理中・失敗・入力変更で未反映・editor切替では今回の成功providerとして表示しない。providerは管理用の一時表示とし、Liveデータや公開画面へ保存しない。

### R7. 既存設定と公開順序

Claude secretは`ANTHROPIC_API_KEY`、任意のWorker変数は`LIVE_AI_CLAUDE_MODEL`、未設定・空白時のモデルは`claude-haiku-5-5`とする。既存の`LIVE_AI_MODEL`と既定`gpt-5-mini`はOpenAI専用のまま維持する。設定UI・モデル選択UI・新規SDK依存は追加しない。

新adminは旧Workerの`draft`だけの応答も受理し、その場合は既存の「AIで整理しました。内容を確認してから更新してください。」と表示する。providerを推定しない。provider付き応答では上記enumのみを受理し、未知の値・型・余分なtop-level keyを拒否する。

現行adminは余分なtop-level keyを拒否するため、Ownerが反映する際の順序は新admin→新Workerとする。Workerだけの先行反映は旧adminで整理結果を適用できなくなる。APIの接続先を切り替えるfallbackは追加せず、`allowBaseFallback: false`を維持する。

## 5. 検証可能な受入条件

Issue本文の受入条件を出現順にI1〜I9とする。以下は実装後の受入条件であり、現時点のPASS表明ではない。

| ID / Issue対応 | 観測して合格にする条件 | 検証場所 |
|---|---|---|
| AC-01 / I1 | 両key設定でOpenAIの検証済みdraftを返し、`provider=openai`。Claude呼出0回。既存の正規化済み10項目と指示・schema・モデル設定が変わらない | Worker focused test |
| AC-02 / I2 | R2の失敗分類を個別fixtureで再現し、OpenAI→Claudeの順で同一sourceTextを送り、Claudeの合格結果と`provider=claude`を返す。次のrequestは再びOpenAIから始まる | Worker focused test |
| AC-03 / I3 | keyの4組合せと空白値で呼出先・回数がR1通り。両方未設定は既存503。401/400時は2社とも0回 | Worker focused test |
| AC-04 / I4 | 2社失敗、片側だけの失敗、timeoutとの組合せがR5通り。adminの10項目・preview・sourceTextが不変で、反映途中の例外にもrollbackする | Worker/admin focused test |
| AC-05 / I5 | fake clockで各15秒・全体30秒の期限、残余時間、応答body停止、abort非協調、期限後の成功棄却を観測する。無期限待機や期限resetがない | Worker focused test |
| AC-06 / I6 | 両providerの成功文言が小さい既存欄に出る。失敗・未反映・stale responseでprovider成功を誤表示しない。旧応答は中立文言、未知providerは一括不反映 | admin focused test / markup・既存CSS確認 |
| AC-07 / I7 | OpenAI/Claude双方の成功・失敗で、secret、providerエラー本文、request ID、promptがresponseへ混入しない。UIは固定文言のみ | Worker/admin focused test |
| AC-08 / I8 | 既存のprovider契約・validation・editor ownership・Local Mode・custom API base・save-freeを含むfocused testと全回帰testがPASS | Code Generation Planのcommand群 |
| AC-09 / I9 | 実装前にlive-operations current specと索引・Worker READMEを更新し、変更するcurrent specのOwner承認を確認する。5 gateを各artifactのdigestに結び付ける | canonical差分・approval records・独立review |

## 6. 範囲外と承認境界

- 本番secret登録、production deploy、mergeはOwnerの操作とし、この計画の実行に含めない。
- 失敗状態の記憶、回路遮断、残高照会、同一providerへのretryは追加しない。
- 抽出項目・抽出指示の内容、Claude先行、provider手動切替UIは変更しない。
- 予約・X共有URL・公開ページ・DB schema・認証・一般admin UIを変更しない。

3成果物を作成しても実装承認にはならない。Requirements・Workflow Plan・Code Generation PlanのOwner承認、current canonicalのDraft→確認→Approvedを経てから実装する。残るCode Generation Result・Build/Test Resultも別gateである。

## 7. 根拠と限界

current canonicalは`docs/specs/current/live-operations-admin-ui.md` §7・§10、`docs/specs/current/system-design-principles.md` §2.6・§2.7である。Worker READMEと現行code/testを併読して要件化した。計画する変更はこれらの元情報保持・再抽出・保存前確認・失敗時保持と整合する。current specの具体的な更新範囲はCode Generation Plan §2に示す。

Anthropic Messages APIとHaiku 5.5の仕様は、packetに配送されたcached official skill（2026-10-06）をローカルで照合した。実アカウントの権限・クレジット・実速度は未確認で、mock testはこれらを証明しない。API速度を理由にモデル・順序・指示・成功条件を変更する場合は、該当設計と承認へ戻る。
