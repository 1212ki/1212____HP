# 1212HP AI-DLC v1.0.1 Setup

- **Date**: 2026-08-30
- **Classification**: bootstrap/setup audit
- **Formal cycle status**: この setup は formal cycleではありません
- **External state**: local repository setup only; no Issue、Project update、PR、merge、deploy

## Purpose

1212HP の次の設計・実装変更から、requirement、decision、current canonical、implementation、verification、accepted history を一つの formal cycle として追跡できるようにします。

## Pinned Source

- Official project: `awslabs/aidlc-workflows`
- Release: `v1.0.1`
- Provenance lock and digests: `.aidlc/SOURCE.lock`
- Per-file payload manifest: `.aidlc/aidlc-rules.MANIFEST.sha256`
- Local implementation precedent: immutable `kondate-loop-aidlc-introduction` commit `ba6058aa9fdaff5fa2a283a771caed65dd1e3172`

The vendored rule payload, lock, manifest, lifecycle implementation, and generic tests are reused from that immutable precedent. Repository text and integration checks are adapted only for 1212HP's `main` base and existing canonical structure.

## Installed Boundary

- `docs/specs/current/` remains current system/product/UX design truth.
- `DESIGN_RULES.md` remains site-wide visual truth.
- `docs/product/` accepts only separately approved current guidance.
- `docs/plans/` remains implementation planning.
- `documents/` remains legacy/history.
- `aidlc-docs/` is idle after setup and will hold exactly one mutable formal cycle per isolated worktree.
- `docs/records/aidlc-cycles/` is reserved for verified accepted cycles.
- `docs/records/aidlc-bootstrap/` remains audit-only setup history.
- `docs/records/decisions/` retains reusable append-only rationale.

## Limitations and Gate

This record does not approve a future requirement, workflow plan, implementation, merge, or deployment. The next design or implementation change must have its own Issue-bound branch/worktree, formal cycle, artifact-bound approvals, tests, independent review, and owner-only integration gates.
