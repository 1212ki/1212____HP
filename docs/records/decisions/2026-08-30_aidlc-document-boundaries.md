# AI-DLC Document Boundaries

- **Date**: 2026-08-30
- **Status**: repository boundary established for local bootstrap
- **Review trigger**: current-canonical policy、default branch、one-cycle-per-worktree isolation、formal applicability の変更

## Context

1212HP already keeps current system/product/UX design under `docs/specs/current/` and site-wide visual rules in `DESIGN_RULES.md`. AI-DLC needs to preserve how later changes are decided and verified without creating a second current source of truth.

## Decision

1. Existing current documents remain canonical.
2. `aidlc-docs/` holds exactly one active mutable formal cycle per isolated worktree.
3. verified closed cycles publish append-only to `docs/records/aidlc-cycles/`.
4. bootstrap/setup evidence remains separate under `docs/records/aidlc-bootstrap/` and cannot satisfy a later approval gate.
5. reusable rationale is append-only under `docs/records/decisions/`.
6. approved cross-feature product guidance is promoted to `docs/product/` only through a dedicated formal cycle.

The bootstrap leaves `aidlc-docs/` idle. The next design or implementation change must start the first formal cycle before editing current canonical documents or code.

## Alternatives

### Count bootstrap as a completed formal cycle

Not selected. The workflow was not yet the repository's active process, and setup evidence cannot retroactively satisfy artifact-bound gates.

### Make cycle trace the current canonical

Not selected. Active work is mutable and closed trace is historical; neither can safely define current behavior.

### Move 1212HP knowledge to a separate repository

Not selected. This product is managed in one repository, and cross-repository synchronization would add a failure boundary without a separate authority need.

### Promote existing plans or legacy documents wholesale

Not selected. `docs/plans/` is implementation planning and `documents/` is history. Any still-valid content must be reviewed and deliberately promoted to the existing current canonical.

## Consequences

- readers can identify current truth without reading conversation or setup trace
- later cycle summaries explain why while current canonical explains what is true now
- published history is not rewritten to match later changes
- workflow and payload updates require their own provenance review
