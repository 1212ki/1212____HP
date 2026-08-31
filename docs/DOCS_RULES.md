# 1212HP Docs Rules

> 最終更新: 2026-08-30

## 目的

1212HP の current truth、作業中の検討、accepted history、setup audit、reusable rationale を重複なく管理します。AI-DLC は判断から実装・検証までを接続しますが、current canonical を置き換えません。

## Canonical Map

| 場所 | 責務 | 現在の正本か |
|---|---|---|
| `specs/current/` | 現在有効な system / product / UX design | はい |
| `../DESIGN_RULES.md` | サイト全体の visual rules | はい |
| `product/` | formal cycle と必要な承認を経た current product guidance | 承認済み内容のみ |
| `plans/` | 承認済み設計を実装へ分解する日付付き plan | いいえ |
| `../aidlc-docs/` | 1 worktree に exactly one の mutable active formal cycle | いいえ |
| `records/aidlc-cycles/` | verified close 後の accepted formal-cycle history | いいえ。append-only history |
| `records/aidlc-bootstrap/` | 導入・移行・setup の audit | いいえ。accepted cycle ではない |
| `records/decisions/` | 再利用可能な判断理由、代替案、見直し条件 | いいえ。append-only rationale |
| `../documents/` | legacy requirements / specs / use cases | いいえ。history |

同じ概念について競合した場合、現在の仕様は `specs/current/`、サイト横断の見た目は `../DESIGN_RULES.md`、承認済み product guidance は `product/` を確認します。closed cycle と decision record は理由を説明しますが、current truth を上書きしません。`plans/` と `documents/` から仕様を昇格させる場合は、該当 current canonical を明示的に更新します。

## 設計先行と AI-DLC

bootstrap が repository に統合された後の次の設計・実装変更から、規模にかかわらず次を行います。

1. Issue、branch、物理 worktree を確定する。
2. local payload を検証し、current canonical や code を変える前に formal cycle を開始する。
3. 要件、選択肢、対象 canonical、failure / rollback、受入条件を active cycle で明確にする。
4. mandatory gate ごとに対象 artifact の digest に結び付いた human approval を得る。
5. 承認された内容を current canonical へ反映してから実装する。
6. 実装・検証・independent review の結果を cycle へ戻す。
7. close gate 通過後に accepted history を publish し、active workspace を idle に戻す。

明らかな typo で current truth や implementation behavior を変えない変更は repository rules に従って簡略化できます。設計判断が変わる場合は cycle と approval を省略しません。

## Current Specification Gate

`specs/current/` を変える場合は、該当設計書を `Draft` に戻し、次の情報を揃えます。

- status: `Draft` / `Approved` / `Superseded`
- owner と最終更新日
- scope と non-scope
- 解決する課題
- 設計原則、選択肢、判断理由
- 画面・機能・データの対応関係
- 主要 flow と state
- desktop / mobile behavior
- failure / fallback / rollback
- acceptance criteria と verification
- related Issue、implementation plan、canonical file map

Itsuki の確認を受け、実装判断に影響する open question がなくなり `Approved` になるまで dependent implementation を開始しません。

## History Rules

- `records/aidlc-cycles/<cycle-id>/` は publish 後 append-only。訂正は addendum または新 cycle で行う
- `records/decisions/` は append-only。後の判断で supersede 関係を示す
- `records/aidlc-bootstrap/` は setup audit であり、formal approval や accepted-cycle evidence に使わない
- `documents/` は既存名と内容を保持し、current canonical との競合時に優先しない
- raw secret、credential、個人情報 export、大きな generated artifact を docs に置かない

## Naming

- accepted cycle: `YYYY-MM-DD_issue-<number>_<lowercase-kebab-topic>/`
- decision record: `YYYY-MM-DD_<topic>.md`
- bootstrap record: 日付と setup 内容が分かる directory 名

詳細な start / resume / approval / close / recovery は `operations/AI_DLC_WORKFLOW.md` を正本とします。
