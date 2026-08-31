# AI-DLC Cycle History

This directory stores accepted, closed formal AI-DLC cycles. The 2026-08-30 setup is Bootstrap history under `../aidlc-bootstrap/` and must not appear here as an accepted cycle.

## Accepted Discovery Pattern

Only direct child directories matching this exact pattern are accepted-cycle discovery targets:

`YYYY-MM-DD_issue-<number>_<topic>`

`<topic>` is lowercase kebab-case. Bootstrap, rejected, staging (`.aidlc-stage-*`), idle (`.aidlc-idle-*`), recovery (`.aidlc-recovery-*`), files, symlinks, and non-matching directories are excluded.

## Contents

Each accepted cycle contains:

- `README.md`: reader-facing outcome, canonical updates, implementation evidence, remaining gaps, and next state
- `manifest.sha256`: exact archive integrity manifest
- `archive-identity.env`: Cycle ID, Issue, branch, base commit, physical worktree root, and source binding
- `source-active.sha256`: deterministic digest of the source active-workspace path set and bytes
- `_trace/aidlc-docs/`: complete state, audit, requirements, plans, approvals, implementation, and verification trace

The `_trace/` directory explains provenance; it is not current specification truth.

## Immutability

After verified publication, do not rewrite a cycle. Add a dated addendum or create a new decision/cycle that links back. Verify with `scripts/aidlc-verify.sh --archive <cycle-path>`; missing, changed, extra, malformed, duplicate, symlink, or non-regular content fails closed.
