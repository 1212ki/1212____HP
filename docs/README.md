# 1212HP Documentation

`docs/` は 1212HP の current design と、その判断・実装履歴を役割別に管理します。入口は `DOCS_RULES.md`、AI-DLC の実行手順は `operations/AI_DLC_WORKFLOW.md` です。

## Source-of-Truth Map

| 場所 | 役割 | 更新条件 |
|---|---|---|
| `specs/current/` | 現在参照する system / product / UX design の正本 | 仕様判断を変えるとき。実装より先に更新 |
| `../DESIGN_RULES.md` | サイト全体の visual truth | 共通の配色・typography・layout 原則を変えるとき |
| `product/` | 承認済みの current product guidance のみ | dedicated formal cycle と必要な承認後 |
| `plans/` | current design を実装へ分解した計画 | 実装着手前。design truth にはしない |
| `../aidlc-docs/` | isolated worktree 内の mutable active formal cycle | cycle start から close まで |
| `records/aidlc-cycles/` | accepted closed formal-cycle history | verified transactional close 時。publish 後 append-only |
| `records/aidlc-bootstrap/` | AI-DLC setup / migration audit | bootstrap 時。accepted cycle や approval evidence にはしない |
| `records/decisions/` | reusable rationale、代替案、見直し条件 | 判断確定時。append-only |
| `../documents/` | legacy requirements / specs / use cases | 原則 history として保持。current specs より優先しない |

closed cycle trace と decision record は「なぜ」を説明する履歴です。現在の behavior を決めるときは `specs/current/`、`product/`、`../DESIGN_RULES.md` の該当 current canonical を参照します。

## Start Here

1. `DOCS_RULES.md`
2. `operations/AI_DLC_WORKFLOW.md`
3. `specs/current/README.md`
4. `product/README.md`
5. `records/decisions/README.md`
6. `records/aidlc-cycles/README.md`
7. `records/aidlc-bootstrap/README.md`

## Design Gate

bootstrap 統合後の次の設計・実装変更から、current canonical や code を変更する前に formal AI-DLC cycle を開始します。要件・計画を承認し、採用内容を current canonical に反映した後で実装します。実装中に新しい判断が発生した場合も、code で先回りせず該当 artifact と approval gate に戻ります。
