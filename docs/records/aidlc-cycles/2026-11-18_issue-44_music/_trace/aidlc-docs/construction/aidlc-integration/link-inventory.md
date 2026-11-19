# 旧pathの入口と管理説明 — Issue #44

- 比較元: `080325887576655f27461cb15f28a3c590a292ee`
- 判定: 公開時にクリックされる入口は付け替え、履歴は維持する。既存9HTML・assets/js・admin（config除外）・Workerの公開path依存と公開metadataを調査した。

## 公開HTMLの入口

以下の9行は各2本（YouTube/Discography）のnav anchor。全18本を取り外し、5項目のうちMusic1本へ替える。これは同じnavをPC/Menuで共用するので両方へ適用される。

| 元path / 行 | 現在のhref | #44の扱い |
|---|---|---|
| `index.html:36,37` | `youtube/`, `discography/` | `music/`にまとめる。順はHome/Live/Music/Profile/Contact。 |
| `live/index.html:36,37` | `../youtube/`, `../discography/` | `../music/`へ。mainは変更しない。 |
| `live/detail/index.html:33,34` | `../../youtube/`, `../../discography/` | `../../music/`へ。mainは変更しない。 |
| `ticket/index.html:31,32` | `../youtube/`, `../discography/` | `../music/`へ。mainは変更しない。 |
| `ticket/complete/index.html:31,32` | `../../youtube/`, `../../discography/` | `../../music/`へ。本文の新しい聴く案内は#43。 |
| `discography/index.html:37,38` | `../youtube/`, `../discography/` | `../music/`へ。旧path自体は誘導ページとして残す。 |
| `youtube/index.html:36,37` | `../youtube/`, `../discography/` | `../music/`へ。旧path自体は誘導ページとして残す。 |
| `profile/index.html:36,37` | `../youtube/`, `../discography/` | `../music/`へ。mainは変更しない。 |
| `contact/index.html:35,36` | `../youtube/`, `../discography/` | `../music/`へ。mainは変更しない。 |
| `index.html:64`の「music →」 | `discography/` | `music/`へ。Home本文の変更はこのhrefだけ。 |

合計19本の旧pathリンクを付け替える。新規Musicのnavは`../music/`。footerは全9HTMLともsite-footerのテキストで、旧2pathのリンクはない。Homeの作品カードはsite-content.jsのrenderHomeで非リンクarticleとして出るため付け替え対象なし。Ticket完了本文の既存Back/Live/Homeにも旧pathはなく保持する。

## 公開script・metadata・Worker

| 対象 | 観測と扱い |
|---|---|
| `assets/js/site-content.js` | 旧rendererのid・data keyはあるが、旧pathへのhrefを生成しない。Homeカードも非リンク。旧rendererは保ちMusic専用boot/renderを追加。 |
| `assets/js/ticket-complete.js / ticket.js / script.js / home-player.js / music-data.js` | 旧pathへの入口なし。script.jsの現在地mappingとhome-player.jsの共有拡張は別の目的で変更。MusicDataは無変更。 |
| sitemap / robots / OGの独立公開ファイル | baseのtracked公開ファイルにはsitemap/robots専用ファイルなし。新規サイトマップは追加しない。Musicと旧2HTMLのcanonical/robotsを計画どおり追加する。 |
| `cloudflare/worker/src/worker.js` | OGのcanonical/human destinationはLive詳細、旧Music pathへの依存なし。`discography / youtube`はデータkey、外部YouTube URLはchannel/embed/画像等でありサイト旧pathではない。Workerは無変更。 |
| 外部YouTube / Bandcamp | Musicのチャンネル・作品リンク・fallbackとして維持。`youtube/`という文字だけで外部YouTubeをMusicへ置換しない。 |

## adminと文書

| 対象 | 観測と扱い |
|---|---|
| `admin/index.html:24〜29,225〜276` | Site/News/Live/YouTube/Disco/Profileの6タブ、YouTube/Discographyのh2、Channel URLと既存section。公開の旧pathへのhrefや「旧ページを開く」説明はない。管理機能名として正しいため無変更。 |
| `admin/app.js` | renderer、追加/編集modalの「新規Discography」「Discography編集」、保存関数とデータkey。公開旧pathのリンク・ページ説明なし。既存管理機能として無変更。 |
| `admin/README.md`の作品選択節 | 「Musicへの適用とTicket完了の案内は後続」はまとめ出し後に古くなる。Musicは#44で公開、作品はDisco・映像/Channel URLはYouTube、Ticket完了は#43、タブ統合は#47と最小修正。 |
| `admin/README.md`の運用1 | 「公開画面と同じカテゴリから編集対象を選ぶ」は5nav/6tab併存時に探す場所を誤らせる。実タブと公開Musicの対応を示す文へ替える。 |
| `admin/README.md`の#42/#41反映節 | 過去の単独公開として保持。#44/#43/#45のまとめ出し・Worker deploy不要を短く追記し、今回も単独mergeで出るという読みを防ぐ。 |
| `docs/specs/current/public-site-ui.md` | §2末・§3対応・§5/6/7のMusicとHome入口・まとめ出しを提案版に反映。旧pathは履歴記述とPS-M-03の対象として残し、機械的全置換をしない。 |
| `docs/specs/current/live-operations-admin-ui.md / README.md` | 最終形の管理Musicと実タブの違い・#44入力・まとめ出しを提案版で追記。#41/#42履歴を保つ。 |
| root `README.md:47,48` | 構成木に旧2directory名が残る。旧directoryは誘導ページとして存続するため削除しない。本Packet/実装の公開リンク変更には含めず、既存構成説明の未更新点としてFrontへ返す。 |
| `docs/plans/ / docs/records/ / documents/`内の旧path | 過去の入力・受入・計画であり書換えない。currentと旧時点を区別する。 |

## #43・#45に渡す切り方

共有は各HTML header/nav、`assets/css/style.css`、`assets/js/site-content.js`、`test/site-shell.test.mjs`、current設計・索引。#44はMusicと外枠を持ち、Live/Ticket/Profile/Contactのmainはbase bytesを保持する。#43/#45は#44統合後の`feature/39-public-pages`を先に取り込む。CSSはMusic scope、rendererはMusic専用分岐、試験は5nav・10route契約を維持する。Ticket完了の新しい聴く入口は#43が`/music/`へ向ける。
