# AI-DLC Active Workspace

No cycle is active. This repository is ready for the next design or implementation change to start a formal AI-DLC cycle.

1. Run `scripts/aidlc-verify.sh --local`.
2. Confirm the GitHub Issue, then create an isolated `feature/<issue-number>-<topic>` worktree from current `origin/main`.
3. Run `scripts/aidlc-cycle.sh start <issue-number> <topic>` before changing current canonical documents or implementation.

Current design truth remains in `docs/specs/current/` and `DESIGN_RULES.md`; approved current product guidance belongs in `docs/product/`. Closed formal-cycle history belongs in `docs/records/aidlc-cycles/`. Setup evidence belongs separately in `docs/records/aidlc-bootstrap/` and is not accepted cycle history.
