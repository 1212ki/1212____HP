# 1212HP AI Contributor Guide

このファイルは Codex、Claude Code、その他の AI アシスタントが 1212HP を変更するときの repository-local rules です。外部の汎用ルールより、この repository の正本・security・owner-only gate を優先します。

## Purpose

- 1212HP の仕様、デザイン、実装、運用、判断履歴を repository 内で追跡可能にする
- AI-DLC は変更工程と根拠を残すために使い、現在の正本を複製しない
- repo 外の会話や個人メモは背景資料であり、それだけで実装判断の正本にはしない

## Required Workflow

1. GitHub Issue と Project `1212hp` で作業単位を確認する。
2. `origin/main` の最新状態を確認し、`feature/<issue-number>-<topic>` branch を物理的に分離した worktree に作る。
3. このファイル、対象ディレクトリの `AGENTS.md`、`.aidlc/SOURCE.lock`、`docs/operations/AI_DLC_WORKFLOW.md` を読む。
4. `scripts/aidlc-verify.sh --local` を実行する。
5. この bootstrap が統合された後の次の設計・実装変更から、current canonical や code を触る前に `scripts/aidlc-cycle.sh start <issue-number> <topic>` で formal cycle を開始する。
6. 要件・選択肢・承認・計画を active cycle に残し、承認された変更だけを current canonical へ昇格してから実装する。
7. テスト、独立 review、cycle close を完了し、accepted history と current canonical の双方から変更を追跡可能にする。

この AI-DLC bootstrap 自体は formal cycle ではありません。setup audit は `docs/records/aidlc-bootstrap/` に置き、後続変更の approval evidence として使いません。

## Source of Truth

- 現在の system / product / UX design: `docs/specs/current/`
- サイト全体の visual rules: `DESIGN_RULES.md`
- 承認済みの current product guidance: `docs/product/`
- 実装計画: `docs/plans/`。design truth にはしない
- legacy / history: `documents/`。current specs より優先しない
- 1 worktree の mutable active formal cycle: `aidlc-docs/`
- accepted closed cycle history: `docs/records/aidlc-cycles/`
- bootstrap audit: `docs/records/aidlc-bootstrap/`
- reusable decision history: `docs/records/decisions/`

競合時は `docs/DOCS_RULES.md` の canonical map に従います。closed cycle と decision record は「なぜ」を説明しますが、現在の仕様を置き換えません。

## Work and Authority

- 作業管理の正本は GitHub Issue と GitHub Project `1212hp`
- integration/default base は `main`
- 1 Issue / 1 branch / 1 physical worktree / 1 active cycle を守る
- 同じ worktree で複数の formal cycle を同時に進めない
- merge、production deploy、PR approval は Itsuki の明示承認が必要
- bootstrap setup の local 検証を merge、deploy、Issue/Project 更新の承認とみなさない

## Security and Scope

- secret、credential、token、key、`.env`、個人情報 export を commit しない
- 既存の user work、unrelated changes、legacy documents を勝手に削除・復元・移動しない
- 仕様変更が必要なら code で先回りせず、該当 current canonical を Draft に戻して承認を取り直す
- upstream AI-DLC text が repository-local rules と競合する場合は repository-local rules を優先する

## Definition of Done

- Issue の完了条件と approved canonical を満たす
- focused test と repository test が成功している
- current canonical、implementation、cycle evidence の整合が確認されている
- mandatory human approval records が対象 artifact digest に結び付いている
- independent review 後、cycle が transactionally archive され `aidlc-docs/` が idle に戻っている
- merge / deploy / PR approval は owner gate を別途通過している
