# Gmailでticket予約の控えを送る

申込者へ予約の控えを送り、`1212ki.info@gmail.com`へ同じ控えをBCCします。差出人は同Gmail、表示名は「松本一樹 ticket」、件名は「ticket予約の控え | 松本一樹」です。本文に受付ID・ライブ・名前・e-mail・枚数・備考が入ります。Gmailアドレスは申込者に見えます。

以下はOwnerの設定・確認手順です。

1. `1212ki.info@gmail.com`でGoogle Apps Scriptの新規projectを作り、[ticket-autoreply.gs](ticket-autoreply.gs)の全文を貼ります。別アカウント・別名義の差出人設定は使いません。
2. Project SettingsのScript Propertiesへ`TICKET_AUTOREPLY_TOKEN`を追加します。十分に長い推測困難な合言葉を用意し、値をrepo・chat・URL・ログへ残さず、Workerと完全一致する値を設定します。前後に空白を含めないでください。
3. DeployのNew deploymentでWeb appを選び、実行者を自分（`1212ki.info@gmail.com`）、アクセスを全員として公開し、Gmail送信権限を許可します。匿名アクセス可能な`/exec` URLを控えます。`/dev`・ログイン画面のURLは使いません。表示や選択肢は実際のOwner画面で確認してください。
4. `cloudflare/worker`で`wrangler secret put TICKET_AUTOREPLY_FORM_URL`と`wrangler secret put TICKET_AUTOREPLY_TOKEN`を実行し、対話入力でURLと同じ合言葉を登録します。URLに合言葉を付けず、wrangler例の`[vars]`に値を置かないでください。secret操作は自動test・Workerが代行しません。
5. Owner承認済みのmerge・公開サイト反映・Worker deployを行います。Apps Scriptと両secretが揃うまで送信しません。script更新時はdeploymentのversionも更新し、更新後の`/exec`を確認します。
6. 公開フォームでOwner自身が使える申込者アドレスを指定して予約し、成功表示と予約台帳、申込者と`1212ki.info@gmail.com`の両方への到達、差出人Gmail・表示名・件名・本文6項目を確認します。保存済み完了文の表示も確認します。HTTP 200や送信済みフォルダだけでは到達完了とせず、迷惑メールも確認してください。
7. POST後の302や最終JSONの実挙動は未確認です。送信と応答が一致しない・届かない場合はFrontへ返し、再予約の連打で確認しないでください。stubの成功は実到達の代用になりません。個人Gmailは1日100宛先（BCC含む）、1予約2宛先で最大50予約／日です。他の送信分で減ります。超過時も予約は成功しますが、メールは失敗し、再送キューはありません。
8. 停止時はWorker URL secretを解除して新規依頼を止め、Webアプリdeploymentも無効化します。漏洩時は公開停止後、Script PropertiesとWorker secretの合言葉を両方更新して再公開します。URL secret解除だけでは既知のWebアプリへの第三者依頼を止められません。

根拠はGoogleの[Web apps](https://developers.google.com/apps-script/guides/web)と[Quotas for Google Services](https://developers.google.com/apps-script/guides/services/quotas)です。Frontが2026-11-17に確認した仕様を基にしています。実装WorkerはGoogleへ接続しておらず、認可・公開設定・redirect・実到達はOwner確認待ちです。
