# Requirements — 顔にする作品・再生映像・種別の登録（Issue #41）

- Status: Draft / Owner承認待ち
- Owner: Itsuki Matsumoto
- Cycle ID: `2026-11-17_issue-41_data-fields`
- Branch: `feature/41-data-fields`
- Base Commit: `060858b754e0d0c8a70bb98536e35c72523a4a48`
- Reader: human_reader / ja-JP / designated_text_editor（Frontが開く）

## 目的と現在地

HomeとMusicで作品をその場で聴けるようにするため、顔にする作品・再生する映像・種別をデータと今の管理画面へ足す。#40で承認した見せ方を、後続の公開UI実装で使える保存契約にする。今回は確認1の未承認候補を揃える段階で、コード・試験・現在の設計書は変更しない。

依頼種別は既存機能への項目追加。admin・Worker API・公開データにまたがる中程度の変更で、既存データの保存互換性が主なリスク。仕様の根拠は`docs/specs/current/live-operations-admin-ui.md`§5.3・§12.3・§15と`public-site-ui.md`§5・§7。Figmaの指定snapshotと、原文を全量保持した`aidlc-docs/audit.md`を参照する。

## 範囲と対象外

範囲は3項目、Home Heroの表示名を「共有時の画像」にすること、リリース日の形の検査、選択先を削除した時に参照を空に戻すこと。入力は現在のSiteとDiscoの編集面へ足し、YouTubeの登録済み全カテゴリから映像を選べるようにする。

Home・Music・Ticket完了で新項目を表示・再生する実装は#42・#44・#43、タブ・編集面・保存と未保存guardの統一は#46・#47に残す。作品名の分解、既存の日付・ライブの移行、一括書換え、DB schema・認証・予約・AI整理・共有URL・デザインtokensの変更は含めない。merge・production deploy・PR承認はItsukiの別操作。

## 要件

| ID | 要件 |
|---|---|
| R41-01 | Siteに「顔にする作品」を追加する。Digital Releaseと宅録Demoの作品から1つ選び、作品の`id`を保持する。空は「自動（最新のリリース）」。 |
| R41-02 | 各作品に「その場で再生する映像」を追加する。`youtube.musicVideos / liveMovies / demos`の登録済み映像の`id`を1つ保持する。空は「選ばない」。`youtubeId`や埋め込みHTMLを参照値として保存しない。 |
| R41-03 | 各作品に任意の「種別」を文字列で保持する。タイトルと別の入力にし、タイトル内の種別を移行・分解しない。 |
| R41-04 | 3項目の欠落は空として扱い、空のまま成立させる。保存後の公開API（`/api/public/site-data`の`data`）とLocal ModeのJSONに3項目を出し、再読込して値を保つ。公開専用projectionによる`sourceText / xComment`の除去を保つ。 |
| R41-05 | 作品削除でSiteの選択を空へ、映像削除で全作品の該当選択を空へ戻す。カテゴリ移動は同じ`id`なら参照を保つ。adminの削除直後とAPI保存時の双方で切れた参照を処理する。永続化の操作は現在の型を維持する。 |
| R41-06 | リリース日は空のまま許可する。空でない新規作品の日付と既存作品で変更した日付に限り、ASCII数字の`YYYY.MM.DD`の形をadminと保存APIで検査する。日付を触らない他項目の保存・カテゴリ移動では既存の不揃い日付を保持する。 |
| R41-07 | 日付が不正なら対象の直下に`「2025.05.05」の形で入力してください。`を示し、入力・modal・保存済みデータを保持して保存しない。APIでも400と対象fieldを返し、DB書込を行わない。空は任意のまま、実在日・未来日等の新しい検査は追加しない。 |
| R41-08 | 自動選択とリリース順の共通処理は両作品collectionを合わせ、形の合う日付だけから最新を選ぶ。不揃い／空の日付は候補外、並びの末尾。同日は連結前の順序を保ち、候補なしは作品なし。明示選択した存在する作品は日付の形を問わず優先する。保存配列や既存公開表示を並べ替えない。 |
| R41-09 | 「Home Hero」の表示名だけを「共有時の画像」に変える。`site.heroImage`と画像操作、Live画像→共有画像のOG fallbackを保持する。現在のHomeがこの画像を表示する挙動も#42まで保つ。 |
| R41-10 | 既存の管理項目・API fallback時のread-only・Local Mode・画像upload guard・Live ID重複検査を保持する。新項目もread-onlyとmutation guardの対象にする。タイトル・optionの表示をescapeし、文字列で渡されたHTMLを実行しない。 |
| R41-11 | 新旧adminとWorkerの途中の組合せでデータを失わない。Itsukiがmerge前にPR最終版のtested revisionから新Workerをdeployし、旧adminが省いた3項目は既存保存値から補う。明示的な空文字は解除。その後のmergeでGitHub Pagesの`main`・`/`配信を更新し、新adminと共有helperを同じrevisionで公開する。別の静的反映操作は行わない。 |
| R41-12 | 本番snapshotで分類した既存データを保存・表示で壊さない。日付不揃いとdescriptionのみLiveは架空fixtureで回帰を確かめ、本番内容をfixtureへ転記しない。設計書の提案版はgate 3承認後に同一bytesだけを昇格する。 |

## 受入条件

Issue本文の4条件は以下のAC41-01〜04で原文を保持する。

| ID | Issue本文の受入条件 | 合格にする観測 |
|---|---|---|
| AC41-01 | 3項目を空のままにしても、公開サイトが今と同じ表示になる。 | 空／key欠落のAPIデータとLocal JSONを既存rendererへ渡し、表示・リンク・順序・Home画像・Live説明が変わらない。 |
| AC41-02 | 3項目を入れて保存すると、公開用のデータに出る。 | adminで3項目を入力→API PUT→公開GET→admin再読込で同値。Local ModeはJSON download→再読込で同値。登録ありでも既存公開DOMは同じ。 |
| AC41-03 | 既存のデータ（リリース日の形が違う作品を含む）で保存・表示が壊れない。 | 旧文字列日付を変えない保存とカテゴリ移動が通り、新規・変更の不正日付は保存されない。descriptionのみLiveの構造と表示を保持する。 |
| AC41-04 | ライブを共有した時の画像の予備が、今と同じに働く。 | Live画像ありはそれを優先、Live画像なしは`site.heroImage`。顔の作品や選択映像をOG fallbackへ混ぜない。 |
| AC41-05 / ADM-40-05の#41分 | 今の管理画面で編集できる項目が、すべて残っている（Home Heroは「共有時の画像」として残る）。 | Site・News・Live・YouTube・Disco・Profileの既存fieldの保持を既存回帰と追加assertで確認。5タブ・編集面の改修は合格範囲に含めない。 |
| AC41-06 / ADM-40-06の#41分 | 新しい3項目を空のままにしても、公開画面が今と同じ情報を出せる。 | AC41-01と同じ空／欠落の回帰で情報を保持。#42以降の新しい見た目は未検証として残す。 |
| AC41-07 | 削除・カテゴリ移動・参照切れを扱える。 | 選択作品削除、共有映像を選ぶ複数作品、未選択の削除、カテゴリ移動、直接PUTの切れた参照を両modeで検証する。 |
| AC41-08 | 最新候補と日付の検査範囲が固定されている。 | 新旧日付・空・同日・全候補不正・明示選択・変更のみの検査を共通helperとAPIの試験で確認し、入力不正時にcollectionの削除・modal close・API callが起きない。 |
| AC41-09 | 新旧の途中状態でも追加値が失われない。 | 新Worker＋旧admin相当payloadの新key省略と明示空、作品カテゴリ移動、旧データ初回GETとPUT、DB未登録時の不正PUTを試験する。 |

## 本番データで分かったこと（Fact）

公開APIの取得済み応答をローカルで分類した。取得: 2026-11-17T16:38:02+09:00、`meta.updatedAt`: `2026-11-16T23:42:59.222Z`、SHA-256: `32af272311d7bf405351afa27f4118e4815e027ce1ecbe12e882a9f622ffb8a4`。応答は`data / meta`を持つ。内容はrepoへ転記しない。

- 作品はdigital 2件、demo 2件。`YYYY.MM.DD`に合わない日付は0件（id: none）。作品4件と映像5件の`id`は全件文字列で、同じ対象内の重複・欠落は0件。
- Liveはupcoming 2件、past 19件。説明が非空で`openTime / startTime / ticket / notes / performers`が全て空・欠落のものを「説明だけ」と分類すると、upcoming 0件、past 14件。
- 該当id: `live-1785058508166`, `live-1779197827074`, `live-1776593857032`, `live-1772374711480`, `live-1772374667641`, `live-1772374688977`, `live-1771155238151`, `live-1771155047590`, `live-1771423734489`, `live-1771149482380`, `live-1771122159455`, `live-2`, `live-3`, `live-1`。

## 判断の根拠（Inference）

日付を触らない保存も拒否すると、Issueの既存データ互換と設計の一括書換えなしに反するため、新規または日付変更だけを検査する。空を拒否すると新しい必須項目になるため、空は許可する。APIも検査して直接保存での迂回を防ぐ。最新の選択と並びは共通helperで固定し、今の公開UIには接続しない。未決の業務・見せ方の選択はない。

## Gapと後続への影響

配信元はFrontが2026-11-17に`gh api repos/1212ki/1212____HP/pages`で確認済み。`build_type: legacy`、`source: branch main, path /`、`cname: 1212hp.com`、`status: built`。公開サイトと`admin/`はいずれもGitHub Pagesから配信される。Workerはmergeでは更新されないため、新Workerのdeployをmerge前に行う。反映時のPages buildと公開APIの形・保存値の照合はFrontがread-onlyで確認し、Itsukiの確認は1作品の3項目の保存と公開データ・公開画面に絞る。削除・日付拒否・Local Mode・旧admin互換は決定論的試験で確認する。

- 取得済み公開projectionは管理用`sourceText / xComment`を含まない。認証済み原本・取得後の本番変更・実画面・本番反映は未確認。今回networkへ接続せず、fixture・sourceで検証計画を作る。
- 本番の日付不揃いは0件でも互換契約は必要なため、架空の不揃いfixtureを必須にする。
- descriptionのみLive 14件は#41で保持する。Home Next Liveの旧説明表示は#42、Live一覧・詳細の旧説明fallbackは#43で実データの形を踏まえて確認する。#41でその見せ方を変更しない。
- #42・#44の新公開画面での最新・並び・再生、#43のTicket完了、#46・#47の画面改修と保存guardは各Issueのformal cycleで受け入れる。PS-H-03 / PS-M-02の再生動作を#41完了とみなさない。
- 後続Issueはnetwork禁止のため#40 cycleに保存済みの`.../sources/follow-up-issues.md`（auditに完全path）を使用し、現在のGitHub状態は未確認。

## 承認と停止

確認1はRequirements・Workflow Plan・Code Generation Plan（設計書の提案版exact bytesを含む）の3つ。5 gateはItsuki本人の`A`で記録し、今回はRequirements承認待ちで止める。実装後の独立reviewはFrontが1回手配し、確認2で結果2つを判断する。Workerは承認記録と公開操作を行わない。
