#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/aidlc-test-lib.sh"
suite_root="$(new_test_root approvals)"
trap 'rm -rf "${suite_root}"' EXIT

case_root() {
  local name="$1"
  local root="${suite_root}/${name}"
  make_complete_cycle "${root}"
  printf '%s\n' "${root}"
}

# F1: every gate must be an exact artifact-bound human approval.
root="$(case_root missing-record)"
rm "${root}/aidlc-docs/approvals/03-code-generation-plan-approval.md"
expect_failure_contains "F1 missing approval record" "missing approval record" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root empty-response)"
replace_literal "${root}/aidlc-docs/approvals/01-requirements-approval.md" "- **Complete raw human response**: A" "- **Complete raw human response**:"
expect_failure_contains "F1 empty raw response" "raw human response" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root inferred-response)"
replace_literal "${root}/aidlc-docs/approvals/01-requirements-approval.md" "- **Complete raw human response**: A" "- **Complete raw human response**: inferred from Issue assignment"
expect_failure_contains "F1 inferred response" "raw human response" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root empty-response-block)"
replace_literal "${root}/aidlc-docs/approvals/01-requirements-approval.md" "- **Complete raw human response**: A" "- **Complete raw human response**: |"
expect_failure_contains "F1 empty multiline raw response" "raw human response" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

# F-02-02: the raw response itself must be the unambiguous approved A choice.
for case in \
  'negative:B — reject/request changes' \
  'other:X' \
  'ambiguous:approve' \
  'mixed:A or B'; do
  name="${case%%:*}"
  response="${case#*:}"
  root="$(case_root "response-${name}")"
  replace_literal "${root}/aidlc-docs/approvals/01-requirements-approval.md" "- **Complete raw human response**: A" "- **Complete raw human response**: ${response}"
  expect_failure_contains "F-02-02 ${name} raw response" "raw human response must be exactly A" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic
done

root="$(case_root missing-choice-prompt)"
replace_literal "${root}/aidlc-docs/approvals/01-requirements-approval.md" " Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other." ""
expect_failure_contains "F-02-02 prompt lacks canonical A/B/X choice" "approval prompt lacks canonical A/B/X choice" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root ambiguous-instruction-after-choice)"
replace_literal "${root}/aidlc-docs/approvals/01-requirements-approval.md" \
  "Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other." \
  "Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other. You may also explain your answer."
expect_failure_contains "F-02-02 prompt rejects content after canonical A/B/X choice" "approval prompt must end with canonical A/B/X choice" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root wrong-stage)"
replace_literal "${root}/aidlc-docs/approvals/03-code-generation-plan-approval.md" "- **Stage**: Code Generation Plan" "- **Stage**: Requirements"
expect_failure_contains "F1 wrong approval stage" "approval stage mismatch" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root stale-digest)"
printf '\nchanged after approval\n' >> "${root}/aidlc-docs/inception/requirements/requirements.md"
expect_failure_contains "F1 stale digest" "approval digest mismatch" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root missing-prerequisite)"
perl -ni -e 'print unless /REQUIRED\|Requirements\|/' "${root}/aidlc-docs/inception/plans/execution-plan.md"
write_approval "${root}" "Workflow Plan" "inception/plans/execution-plan.md" "approvals/02-workflow-plan-approval.md"
expect_failure_contains "F1 missing prerequisite gate declaration" "required approval stage" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

# F2: complete plan/state/artifact readiness is required before staging.
root="$(case_root missing-audit)"
rm "${root}/aidlc-docs/audit.md"
expect_failure_contains "F2 missing audit" "missing required artifact" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root missing-result)"
rm "${root}/aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md"
expect_failure_contains "F2 missing selected artifact" "missing required artifact" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root unchecked-plan)"
printf '\n- [ ] Required follow-up\n' >> "${root}/aidlc-docs/construction/plans/aidlc-integration-code-generation-plan.md"
expect_failure_contains "F2 unchecked required work" "unchecked required work" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root state-disagreement)"
replace_literal "${root}/aidlc-docs/aidlc-state.md" "- **Current Stage**: Complete" "- **Current Stage**: Build and Test"
expect_failure_contains "F2 state disagreement" "Current Stage must be Complete" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root unanswered)"
printf '\n[Answer]:\n' >> "${root}/aidlc-docs/audit.md"
expect_failure_contains "F2 unresolved answer" "question answers are empty" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root blocking-finding)"
replace_literal "${root}/aidlc-docs/construction/build-and-test/build-and-test-summary.md" "- **Blocking Findings**: None" "- **Blocking Findings**: Failing integration test"
write_approval "${root}" "Build/Test Result" "construction/build-and-test/build-and-test-summary.md" "approvals/05-build-test-result-approval.md"
expect_failure_contains "F2 unresolved blocking finding" "Blocking Findings must be None" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root empty-skip)"
replace_literal "${root}/aidlc-docs/inception/plans/execution-plan.md" "SKIP|User Stories|No end-user behavior changes in this fixture." "SKIP|User Stories|"
write_approval "${root}" "Workflow Plan" "inception/plans/execution-plan.md" "approvals/02-workflow-plan-approval.md"
expect_failure_contains "F2 empty approved skip rationale" "skip rationale" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic

root="$(case_root complete)"
expect_success "F1/F2 complete approved fixture closes" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close 2026-08-30_issue-1011_test-topic
assert_true "F2 complete fixture reaches verified archive" test -f "${root}/docs/records/aidlc-cycles/2026-08-30_issue-1011_test-topic/manifest.sha256"

finish_tests "aidlc approvals and readiness"
