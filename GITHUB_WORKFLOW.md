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
4. branch は Issue 番号を含める。
   - 例: `feature/13-ticket-autoreply`
5. 実装後、ローカル検証と `git status` / secret 混入確認を行う。
6. PR 作成直前に Project Status を `Review` にする。
7. PR 本文に `Closes #XX` を入れ、Issue と PR を紐付ける。
8. PR 作成後、Project item に linked pull request が表示されていることを確認する。
9. merge / completion 後、Project Status を `close` にする。

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
