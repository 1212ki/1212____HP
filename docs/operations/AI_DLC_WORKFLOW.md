# 1212HP AI-DLC Workflow

> Status: current repository workflow
>
> Applies from: the first design or implementation change after this bootstrap is integrated

## Purpose and Bootstrap Boundary

AI-DLC は requirement、decision、current canonical、implementation、verification、history を接続します。今回の local setup は workflow を導入・検証する bootstrap であり、completed formal cycle ではありません。setup audit は `docs/records/aidlc-bootstrap/` に分離し、後続 cycle の approval evidence として使いません。

## Knowledge Flow

| Layer | Location | Rule |
|---|---|---|
| Pinned rules and provenance | `.aidlc/` | v1.0.1 payload、lock、manifest を固定して検証する |
| Active formal cycle | `aidlc-docs/` | isolated worktree ごとに exactly one の mutable workspace |
| Accepted formal-cycle history | `docs/records/aidlc-cycles/<cycle-id>/` | verified publication 後 append-only |
| Bootstrap audit | `docs/records/aidlc-bootstrap/` | setup history。accepted cycle ではない |
| Reusable decision history | `docs/records/decisions/` | append-only。変更は新 record で supersede |
| Current approved truth | `docs/specs/current/`, `docs/product/`, `DESIGN_RULES.md` | canonical map に従い、承認後に更新する |

`docs/plans/` は implementation planning、`documents/` は legacy/history です。active work、closed trace、decision record は current canonical を置き換えません。

## Official Rules and Precedence

- Official source: `awslabs/aidlc-workflows`
- Pinned provenance: `.aidlc/SOURCE.lock`
- Vendored payload: `.aidlc/aidlc-rules/`
- Per-file manifest: `.aidlc/aidlc-rules.MANIFEST.sha256`
- Repository adapters: `scripts/aidlc-cycle.sh`, `scripts/aidlc-verify.sh`

repository-local contributor rules、canonical map、security、Issue/Project、branch/worktree、review、owner-only merge/deploy gate は upstream の汎用文面より優先します。payload 更新は別 Issue で、release/tag/commit/asset provenance、downloaded bytes、vendored diff、manifest を review します。

## Cycle Identity and Start

1 Issue / 1 `feature/<issue-number>-<topic>` branch / 1 physical worktree / 1 active cycle を使います。integration/default base は `main`、cycle ID は `YYYY-MM-DD_issue-<number>_<topic>` です。

1. GitHub Issue を確認し、Project Status を `In Progress` にする。
2. current `origin/main` から isolated worktree を作る。
3. repository と対象 directory の contributor rules を読む。
4. `scripts/aidlc-verify.sh --local` を実行する。
5. current canonical や code を変える前に `scripts/aidlc-cycle.sh start <issue-number> <topic>` を実行する。
6. complete initial request、source provenance、Fact / Inference / Gap を `aidlc-docs/audit.md` に残す。
7. separately approved Workflow Plan に従い、必要な stage だけを tailoring する。

`start` は Issue、branch、base commit、物理 worktree root、timestamp を state に固定し、不正な identifier、detached/mismatched branch、active state、invalid payload を拒否します。

## Status and Resume

- `scripts/aidlc-cycle.sh status`
- `scripts/aidlc-cycle.sh resume <cycle-id> <issue-number>`

resume は requested Cycle ID / Issue、attached branch、state branch、Base Commit の解決と ancestor 関係、Git top-level、state Workspace Root を mutation 前に照合します。pass 後に state、prerequisite、current-stage artifact、approval、open question、audit を読み、resumption event を audit に追記します。

## Artifact-Bound Human Approvals

mandatory gate は Requirements、Workflow Plan、Code Generation Plan、Code Generation Result、Build/Test Result の 5 つです。各 approval record は exact stage、repository-relative/absolute artifact path、fresh SHA-256、human approver、prompt/response timestamps、complete prompt、complete raw response、explicit decision を保持します。

approval prompt は次の exact choice で終えます。

`Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other.`

valid approval は raw response が single ASCII `A` で、Decision が `APPROVED` から始まる場合だけです。Issue assignment、worker authority、silence、inference、別 stage の承認、successful command は承認ではありません。artifact bytes が変わったら旧 record を `SUPERSEDED` として保持し、新 digest で再承認します。

approved `aidlc-docs/inception/plans/execution-plan.md` は fixed artifact mapping を `REQUIRED|...` row で exactly once 宣言し、tailored stage は checked `SKIP|<stage>|<non-empty rationale>` で残します。unchecked work、missing/stale approval、wrong stage、empty answer、state disagreement、blocking finding は close 前に失敗します。

## Canonical Promotion and Construction

implementation 前に affected current canonical を特定し、requirements と plan を承認し、同じ feature branch で current canonical を更新します。Code Generation Plan に path を記録し、更新後の canonical に対して実装します。design が変わった場合は該当 artifact と approval gate に戻り、過去の rationale は書き換えず新 decision として残します。

## Verification and Owner Gates

close 前に focused test、repository test、local payload verification、必要な source verification、independent read-only review を fresh evidence で完了します。Build/Test Result と cycle summary の `Blocking Findings` は `None` で、exact Build/Test Result approval が必要です。

merge、production deploy、release、PR approval は Itsuki の明示承認が必要です。cycle close や review pass はこれらの承認を含みません。

## Transactional Close and Recovery

`scripts/aidlc-cycle.sh close <cycle-id>` は次の state を取ります。

1. `ACTIVE`: identity、state、plan、artifact、answer、finding、approval を mutation なしで検証
2. `STAGED`: active workspace を同一 filesystem の unique staging path に copy し、summary、identity、source digest、exact manifest を生成・検証
3. `PUBLISHED`: verified stage を previously absent final archive path へ atomic rename
4. `PUBLISHED-resume`: publication 後の idle transition failure では existing archive identity、manifest、active digest を再検証し、publication を繰り返さず idle transition のみ retry
5. `IDLE`: prepared idle directory と active workspace を sibling recovery rename で交換し、failure 時は original active workspace を復元

publication 前の failure は active workspace を byte-identical に保ち、final archive を作りません。mismatched/invalid existing archive は置換せず fail closed します。`.aidlc-stage-*`、`.aidlc-idle-*`、`.aidlc-recovery-*` は temporary path で accepted discovery 対象ではありません。

archive manifest は root `manifest.sha256` 以外の exact regular-file path set と bytes を覆います。missing、changed、extra、duplicate、malformed、symlink、non-regular entry は拒否します。

## Integrity and Live Source Verification

- `scripts/aidlc-verify.sh --local`: lock format、VERSION、manifest digest、vendored path set/bytes、integration paths、mirror、accepted archives を検証する。source authenticity を確認していないことを成功文に明示する
- `scripts/aidlc-verify.sh --source`: official GitHub release/tag/asset metadata を確認し、tag を pinned commit へ解決し、published asset digest と locked tag-archive digest を照合する。ZIP の安全な entry type/path/set を extraction 前に確認し、extracted payload の全 path/bytes を vendored payload と比較する
- `scripts/aidlc-verify.sh --archive <cycle-path>`: archive の exact path set、bytes、regular-file-only constraint を検証する

network、metadata、tag、digest、archive entry、extraction、path、byte の failure は non-green です。annotated tag に cryptographic signature があるとは主張しません。authenticity claim は official GitHub endpoints、pinned release/tag/commit/asset identity、published asset digest、separately pinned tag-archive digest、exact payload comparison の範囲です。
