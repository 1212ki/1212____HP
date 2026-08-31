#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/aidlc-test-lib.sh"
suite_root="$(new_test_root transaction)"
trap 'rm -rf "${suite_root}"' EXIT

case_root() {
  local name="$1"
  local root="${suite_root}/${name}"
  make_complete_cycle "${root}"
  printf '%s\n' "${root}"
}

cycle_id="2026-08-30_issue-1011_test-topic"

start_case_root() {
  local name="$1"
  local root="${suite_root}/${name}"
  init_git_fixture "${root}"
  cp -R "${repo_source}/.aidlc" "${root}/.aidlc"
  printf '%s\n' "${root}"
}

# F6: start binds the full Issue/topic branch identity before creating active state.
root="$(start_case_root start-topic-mismatch)"
git -C "${root}" switch -q -c feature/1011-other-topic
expect_failure_contains "F6 start rejects mismatched topic" "does not match requested Issue/topic" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" start 1011 test-topic
assert_true "F6 mismatched start creates no active workspace" test ! -e "${root}/aidlc-docs"

root="$(start_case_root start-identity-green)"
expect_success "F6 start accepts exact Issue/topic branch" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" start 1011 test-topic
assert_true "F6 valid start records exact branch" grep -Fq -- "- **Branch**: feature/1011-test-topic" "${root}/aidlc-docs/aidlc-state.md"
assert_true "F6 valid start creates audit" test -f "${root}/aidlc-docs/audit.md"

# F3: failures before publication preserve active; failures after publication restore it.
for point in copy manifest publish; do
  root="$(case_root "fail-${point}")"
  before="$(tree_digest "${root}/aidlc-docs")"
  expect_failure_contains "F3 injected ${point} failure" "injected ${point} failure" env AIDLC_REPO_ROOT="${root}" AIDLC_FAIL_AT="${point}" "${cycle_command}" close "${cycle_id}"
  after="$(tree_digest "${root}/aidlc-docs")"
  assert_equal "F3 ${point} keeps active byte-identical" "${before}" "${after}"
  assert_true "F3 ${point} leaves no final archive" test ! -e "${root}/docs/records/aidlc-cycles/${cycle_id}"
done

for point in idle_prepare active_reset; do
  root="$(case_root "fail-${point}")"
  before="$(tree_digest "${root}/aidlc-docs")"
  expect_failure_contains "F3 injected ${point} failure" "injected ${point} failure" env AIDLC_REPO_ROOT="${root}" AIDLC_FAIL_AT="${point}" "${cycle_command}" close "${cycle_id}"
  after="$(tree_digest "${root}/aidlc-docs")"
  assert_equal "F3 ${point} restores active byte-identical" "${before}" "${after}"
  assert_true "F3 ${point} retains one published archive" test -f "${root}/docs/records/aidlc-cycles/${cycle_id}/manifest.sha256"
done

root="$(case_root published-resume)"
before="$(tree_digest "${root}/aidlc-docs")"
expect_failure_contains "F3 post-publication reset failure" "injected active_reset failure" env AIDLC_REPO_ROOT="${root}" AIDLC_FAIL_AT=active_reset "${cycle_command}" close "${cycle_id}"
archive_before="$(tree_digest "${root}/docs/records/aidlc-cycles/${cycle_id}")"
set +e
resume_output="$(AIDLC_REPO_ROOT="${root}" "${cycle_command}" close "${cycle_id}" 2>&1)"
resume_status=$?
set -e
if [[ ${resume_status} -eq 0 && "${resume_output}" == *"PUBLISHED-resume"* ]]; then
  record_success "F3 retry enters PUBLISHED-resume"
else
  record_failure "F3 retry enters PUBLISHED-resume" "exit=${resume_status}, output=${resume_output}"
fi
archive_after="$(tree_digest "${root}/docs/records/aidlc-cycles/${cycle_id}")"
assert_equal "F3 retry leaves published archive byte-identical" "${archive_before}" "${archive_after}"
assert_true "F3 retry leaves one accepted archive" test "$(find "${root}/docs/records/aidlc-cycles" -mindepth 1 -maxdepth 1 -type d -name "${cycle_id}" | wc -l | tr -d ' ')" -eq 1
assert_true "F3 retry leaves idle workspace" test -f "${root}/aidlc-docs/README.md"
assert_true "F3 retry removes active state" test ! -e "${root}/aidlc-docs/aidlc-state.md"
assert_true "F3 retry never nests workspace" test ! -e "${root}/aidlc-docs/aidlc-docs"

root="$(case_root mismatched-archive)"
expect_failure_contains "F3 setup existing publication" "injected idle_prepare failure" env AIDLC_REPO_ROOT="${root}" AIDLC_FAIL_AT=idle_prepare "${cycle_command}" close "${cycle_id}"
replace_literal "${root}/docs/records/aidlc-cycles/${cycle_id}/archive-identity.env" "issue=1011" "issue=9999"
active_before="$(tree_digest "${root}/aidlc-docs")"
archive_before="$(tree_digest "${root}/docs/records/aidlc-cycles/${cycle_id}")"
expect_failure_contains "F3 mismatched existing archive fails closed" "existing archive" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close "${cycle_id}"
assert_equal "F3 mismatch keeps active unchanged" "${active_before}" "$(tree_digest "${root}/aidlc-docs")"
assert_equal "F3 mismatch keeps archive unchanged" "${archive_before}" "$(tree_digest "${root}/docs/records/aidlc-cycles/${cycle_id}")"

root="$(case_root archive-root-symlink)"
expect_failure_contains "FX3 setup exact published archive" "injected idle_prepare failure" env AIDLC_REPO_ROOT="${root}" AIDLC_FAIL_AT=idle_prepare "${cycle_command}" close "${cycle_id}"
archive_path="${root}/docs/records/aidlc-cycles/${cycle_id}"
external_archive="${suite_root}/external-exact-archive"
mv "${archive_path}" "${external_archive}"
ln -s "${external_archive}" "${archive_path}"
active_before="$(tree_digest "${root}/aidlc-docs")"
archive_before="$(tree_digest "${external_archive}")"
expect_failure_contains "FX3 close rejects exact external archive root symlink" "existing archive target must be a physical directory" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close "${cycle_id}"
assert_equal "FX3 root symlink rejection keeps active byte-identical" "${active_before}" "$(tree_digest "${root}/aidlc-docs")"
assert_equal "FX3 root symlink rejection keeps external archive byte-identical" "${archive_before}" "$(tree_digest "${external_archive}")"
assert_true "FX3 canonical archive path remains a symlink for operator recovery" test -L "${archive_path}"
assert_true "FX3 active state remains available" test -f "${root}/aidlc-docs/aidlc-state.md"

# F6: resume and close validate branch/base/worktree/cycle/Issue before mutation.
root="$(case_root wrong-branch)"
git -C "${root}" switch -q -c feature/1011-other
expect_failure_contains "F6 resume wrong branch" "branch mismatch" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" resume "${cycle_id}" 1011
expect_failure_contains "F6 close wrong branch" "branch mismatch" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" close "${cycle_id}"

root="$(case_root detached)"
git -C "${root}" checkout -q --detach
expect_failure_contains "F6 detached HEAD" "detached HEAD" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" resume "${cycle_id}" 1011

root="$(case_root invalid-base)"
replace_literal "${root}/aidlc-docs/aidlc-state.md" "$(git -C "${root}" rev-parse HEAD)" "0000000000000000000000000000000000000000"
expect_failure_contains "F6 invalid base" "Base Commit does not resolve" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" resume "${cycle_id}" 1011

root="$(case_root nonancestor)"
nonancestor="$(printf 'unrelated\n' | git -C "${root}" commit-tree "$(git -C "${root}" write-tree)")"
replace_literal "${root}/aidlc-docs/aidlc-state.md" "$(git -C "${root}" rev-parse HEAD)" "${nonancestor}"
state_before="$(shasum -a 256 "${root}/aidlc-docs/aidlc-state.md" | awk '{print $1}')"
audit_before="$(shasum -a 256 "${root}/aidlc-docs/audit.md" | awk '{print $1}')"
expect_failure_contains "F6 non-ancestor base" "not an ancestor" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" resume "${cycle_id}" 1011
assert_equal "F6 failed resume preserves state" "${state_before}" "$(shasum -a 256 "${root}/aidlc-docs/aidlc-state.md" | awk '{print $1}')"
assert_equal "F6 failed resume preserves audit" "${audit_before}" "$(shasum -a 256 "${root}/aidlc-docs/audit.md" | awk '{print $1}')"

root="$(case_root wrong-root)"
replace_literal "${root}/aidlc-docs/aidlc-state.md" "- **Workspace Root**: ${root}" "- **Workspace Root**: ${root}-other"
expect_failure_contains "F6 wrong workspace root" "Workspace Root mismatch" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" resume "${cycle_id}" 1011

root="$(case_root wrong-cycle)"
expect_failure_contains "F6 wrong requested Cycle ID" "cycle ID does not match state" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" resume 2026-08-30_issue-1011_other-topic 1011

root="$(case_root wrong-issue)"
expect_failure_contains "F6 wrong requested Issue" "Issue does not match state" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" resume "${cycle_id}" 9999

root="$(case_root resume-stdout-failure)"
state_before="$(shasum -a 256 "${root}/aidlc-docs/aidlc-state.md" | awk '{print $1}')"
audit_before="$(shasum -a 256 "${root}/aidlc-docs/audit.md" | awk '{print $1}')"
set +e
AIDLC_REPO_ROOT="${root}" "${cycle_command}" resume "${cycle_id}" 1011 1>&- 2>"${suite_root}/resume-stdout-failure.stderr"
resume_status=$?
set -e
if [[ ${resume_status} -ne 0 ]]; then
  record_success "F6 stdout failure makes resume fail"
else
  record_failure "F6 stdout failure makes resume fail" "command unexpectedly succeeded"
fi
assert_equal "F6 stdout failure preserves state" "${state_before}" "$(shasum -a 256 "${root}/aidlc-docs/aidlc-state.md" | awk '{print $1}')"
assert_equal "F6 stdout failure preserves audit" "${audit_before}" "$(shasum -a 256 "${root}/aidlc-docs/audit.md" | awk '{print $1}')"
assert_true "F6 stdout failure leaves no resume temp" test -z "$(find "${root}/aidlc-docs" -maxdepth 1 -name '.audit-resume.*' -print -quit)"

root="$(case_root resume-audit-symlink)"
external_audit="${suite_root}/resume-external-audit.md"
mv "${root}/aidlc-docs/audit.md" "${external_audit}"
ln -s "${external_audit}" "${root}/aidlc-docs/audit.md"
state_before="$(shasum -a 256 "${root}/aidlc-docs/aidlc-state.md" | awk '{print $1}')"
audit_before="$(shasum -a 256 "${external_audit}" | awk '{print $1}')"
expect_failure_contains "F6 resume rejects audit symlink" "missing regular audit trail" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" resume "${cycle_id}" 1011
assert_equal "F6 audit symlink rejection preserves state" "${state_before}" "$(shasum -a 256 "${root}/aidlc-docs/aidlc-state.md" | awk '{print $1}')"
assert_equal "F6 audit symlink rejection preserves target" "${audit_before}" "$(shasum -a 256 "${external_audit}" | awk '{print $1}')"
assert_true "F6 audit symlink rejection leaves no resume temp" test -z "$(find "${root}/aidlc-docs" -maxdepth 1 -name '.audit-resume.*' -print -quit)"

root="$(case_root identity-green)"
state_before="$(shasum -a 256 "${root}/aidlc-docs/aidlc-state.md" | awk '{print $1}')"
audit_before="$(shasum -a 256 "${root}/aidlc-docs/audit.md" | awk '{print $1}')"
expect_success "F6 valid resume identity" env AIDLC_REPO_ROOT="${root}" "${cycle_command}" resume "${cycle_id}" 1011
assert_equal "F6 valid resume leaves state unchanged" "${state_before}" "$(shasum -a 256 "${root}/aidlc-docs/aidlc-state.md" | awk '{print $1}')"
assert_true "F6 valid resume durably changes audit" test "${audit_before}" != "$(shasum -a 256 "${root}/aidlc-docs/audit.md" | awk '{print $1}')"
assert_true "F6 valid resume appends one Cycle Resume event" test "$(grep -c '^## Cycle Resume$' "${root}/aidlc-docs/audit.md")" -eq 1
assert_true "F6 resume event records timestamp" grep -Eq '^- \*\*Timestamp\*\*: [0-9]{4}-[0-9]{2}-[0-9]{2}T.+' "${root}/aidlc-docs/audit.md"
assert_true "F6 resume event records cycle" grep -Fq -- "- **Cycle ID**: ${cycle_id}" "${root}/aidlc-docs/audit.md"
assert_true "F6 resume event records Issue" grep -Fq -- "- **Issue**: #1011" "${root}/aidlc-docs/audit.md"
assert_true "F6 resume event records branch" grep -Fq -- "- **Branch**: feature/1011-test-topic" "${root}/aidlc-docs/audit.md"
assert_true "F6 resume event records workspace" grep -Fq -- "- **Workspace Root**: ${root}" "${root}/aidlc-docs/audit.md"
assert_true "F6 resume event states artifact contents were not validated" grep -Fq -- "- **Event**: Cycle identity revalidated and resume recorded. This command did not validate prerequisite or current-stage artifact contents." "${root}/aidlc-docs/audit.md"

finish_tests "aidlc transaction and identity"
