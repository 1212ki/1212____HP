# GitHub Workflow

この repo の作業管理は GitHub Issue と GitHub Project を正本にする。

- Repository: `1212ki/1212____HP`
- Project: `1212hp` (`https://github.com/users/1212ki/projects/1`)
- Account: `1212ki`
- SSH remote: `git@github.com-new-account:1212ki/1212____HP.git`

## 基本フロー

1. 作業前に `git pull --ff-only` で `main` を最新化する。
2. 既存 Issue を確認し、該当がなければ Issue を作成する。
3. Issue を Project `1212hp` に追加し、作業中は Status を `In Progress` にする。
4. current `origin/main` を基準に isolated worktree を作り、branch に Issue 番号を含める。
   - 例: `feature/13-ticket-autoreply`
5. bootstrap 統合後の次の設計・実装変更から、`scripts/aidlc-verify.sh --local` を通し、current canonical や code を変える前に `scripts/aidlc-cycle.sh start <issue-number> <topic>` を実行する。
6. approved canonical に基づいて実装し、テスト・独立 review・AI-DLC close/archive を完了する。
7. `git status` と secret 混入を確認する。
8. PR 作成直前に Project Status を `Review` にする。
9. PR は gate 通過後に作成する。PR 作成に個別のユーザー許可は不要。
10. PR 本文に `Closes #XX` を入れ、Issue と PR を紐付ける。
11. PR 作成後、Project item に linked pull request が表示されていることを確認する。
12. owner-approved merge / completion 後、Project Status を `close` にする。

PR 作成はレビュー依頼の入口であり、反映そのものではない。merge、production deploy、PR approval は Itsuki の明示承認がある場合だけ行う。AI-DLC close や review pass を暗黙の承認とみなさない。

今回の AI-DLC setup は bootstrap であり、accepted formal cycle ではない。setup audit は `docs/records/aidlc-bootstrap/`、後続する accepted cycle history は `docs/records/aidlc-cycles/` に分ける。

## Status

| Status | 意味 |
|---|---|
| `Backlog` | 未着手候補 |
| `Sprint` | 近く着手するもの |
| `In Progress` | 作業中 |
| `Review` | PR作成済み、またはレビュー待ち |
| `close` | 完了 |

## PR前チェック

- Issue の完了条件を満たしている。
- 必要なテストまたは静的検証を実行している。
- `git status` で対象外ファイルが混ざっていない。
- `.env`、credential、token、key、個人情報CSVを commit に含めていない。
- PR body に `Closes #XX` を入れている。
- Project Status を `Review` にしている。
- 設計・実装変更では AI-DLC cycle が verified close され、`aidlc-docs/` が idle になっている。
- owner-only merge / deploy / PR approval gate が別途満たされている。

## Issue作成例

```bash
gh issue create \
  --repo 1212ki/1212____HP \
  --title "ticket申し込み時に申し込み内容つき自動返信を送る" \
  --body-file issue.md \
  --assignee @me \
  --project "1212hp"
```

## Project Status更新例

```bash
gh project item-edit \
  --project-id PVT_kwHOC3C5cM4BTxWk \
  --id <PROJECT_ITEM_ID> \
  --field-id PVTSSF_lAHOC3C5cM4BTxWkzhA9-vw \
  --single-select-option-id <STATUS_OPTION_ID>
```

Status option ID は変更されることがあるため、更新前に確認する。

```bash
gh project field-list 1 --owner 1212ki --format json
```
