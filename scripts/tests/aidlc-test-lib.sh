#!/usr/bin/env bash

set -euo pipefail

repo_source="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cycle_command="${repo_source}/scripts/aidlc-cycle.sh"
verify_command="${repo_source}/scripts/aidlc-verify.sh"

tests_run=0
tests_failed=0

record_failure() {
  local label="$1"
  local detail="$2"
  tests_run=$((tests_run + 1))
  tests_failed=$((tests_failed + 1))
  printf 'not ok - %s: %s\n' "${label}" "${detail}" >&2
}

record_success() {
  local label="$1"
  tests_run=$((tests_run + 1))
  printf 'ok - %s\n' "${label}"
}

expect_success() {
  local label="$1"
  shift
  local output status
  set +e
  output="$("$@" 2>&1)"
  status=$?
  set -e
  if [[ ${status} -ne 0 ]]; then
    record_failure "${label}" "expected success, exit=${status}, output=${output}"
  else
    record_success "${label}"
  fi
}

expect_failure_contains() {
  local label="$1"
  local needle="$2"
  shift 2
  local output status
  set +e
  output="$("$@" 2>&1)"
  status=$?
  set -e
  if [[ ${status} -eq 0 ]]; then
    record_failure "${label}" "expected failure containing '${needle}', command succeeded"
  elif [[ "${output}" != *"${needle}"* ]]; then
    record_failure "${label}" "missing '${needle}', exit=${status}, output=${output}"
  else
    record_success "${label}"
  fi
}

assert_true() {
  local label="$1"
  shift
  if "$@"; then
    record_success "${label}"
  else
    record_failure "${label}" "assertion failed: $*"
  fi
}

assert_equal() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "${expected}" == "${actual}" ]]; then
    record_success "${label}"
  else
    record_failure "${label}" "expected '${expected}', got '${actual}'"
  fi
}

finish_tests() {
  local suite="$1"
  if [[ ${tests_failed} -ne 0 ]]; then
    printf '%s: %s/%s checks failed\n' "${suite}" "${tests_failed}" "${tests_run}" >&2
    exit 1
  fi
  printf '%s: %s checks passed\n' "${suite}" "${tests_run}"
}

new_test_root() {
  mktemp -d "/private/tmp/1212hp-aidlc-${1}.XXXXXX"
}

replace_literal() {
  local path="$1"
  local from="$2"
  local to="$3"
  perl -0pi -e 'BEGIN {$from = shift; $to = shift} s/\Q$from\E/$to/g' -- "${from}" "${to}" "${path}"
}

tree_digest() {
  local root="$1"
  (
    cd "${root}"
    find . -type f -print | LC_ALL=C sort | while IFS= read -r path; do
      shasum -a 256 "${path}"
    done
  ) | shasum -a 256 | awk '{print $1}'
}

init_git_fixture() {
  local root="$1"
  mkdir -p "${root}"
  git -C "${root}" init -q
  git -C "${root}" config user.name "AI-DLC Test"
  git -C "${root}" config user.email "aidlc-test@example.invalid"
  printf '# fixture\n' > "${root}/README.md"
  git -C "${root}" add README.md
  git -C "${root}" -c core.hooksPath=/dev/null commit -qm baseline
  git -C "${root}" switch -q -c feature/1011-test-topic
}

write_approval() {
  local root="$1"
  local stage="$2"
  local artifact_rel="$3"
  local record_rel="$4"
  local digest
  digest="$(shasum -a 256 "${root}/aidlc-docs/${artifact_rel}" | awk '{print $1}')"
  mkdir -p "$(dirname "${root}/aidlc-docs/${record_rel}")"
  cat > "${root}/aidlc-docs/${record_rel}" <<EOF
# ${stage} Approval Record

- **Record status**: APPROVED
- **Stage**: ${stage}
- **Artifact repository-relative path**: aidlc-docs/${artifact_rel}
- **Artifact absolute path**: ${root}/aidlc-docs/${artifact_rel}
- **Artifact SHA-256**: ${digest}
- **Digest command**: shasum -a 256 aidlc-docs/${artifact_rel}
- **Approver**: Human Owner
- **Prompt timestamp**: 2026-08-30T10:00:00+09:00
- **Approval prompt**: |
  Approve Stage ${stage}, exact artifact aidlc-docs/${artifact_rel}, SHA-256 ${digest} only.
  Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other.
- **Response timestamp**: 2026-08-30T10:01:00+09:00
- **Complete raw human response**: A
- **Decision**: APPROVED for this exact artifact digest only.
- **Recorder**: lifecycle test fixture
EOF
}

make_complete_cycle() {
  local root="$1"
  local cycle_id="2026-08-30_issue-1011_test-topic"
  init_git_fixture "${root}"
  local base_commit
  base_commit="$(git -C "${root}" rev-parse HEAD)"

  mkdir -p \
    "${root}/aidlc-docs/inception/requirements" \
    "${root}/aidlc-docs/inception/plans" \
    "${root}/aidlc-docs/construction/plans" \
    "${root}/aidlc-docs/construction/aidlc-integration/code" \
    "${root}/aidlc-docs/construction/build-and-test" \
    "${root}/aidlc-docs/approvals" \
    "${root}/docs/records/aidlc-cycles"

  cat > "${root}/aidlc-docs/aidlc-state.md" <<EOF
# AI-DLC State Tracking

- **Cycle ID**: ${cycle_id}
- **Issue**: #1011
- **Base Commit**: ${base_commit}
- **Branch**: feature/1011-test-topic
- **Workspace Root**: ${root}
- **Current Stage**: Complete
- **Cycle Status**: Complete
- **Approval Gate**: None
- **Approval Status**: Complete
EOF
  printf '# Audit\n\nAll required events are recorded.\n' > "${root}/aidlc-docs/audit.md"
  printf '# Requirements\n\nApproved requirements.\n' > "${root}/aidlc-docs/inception/requirements/requirements.md"
  cat > "${root}/aidlc-docs/inception/plans/execution-plan.md" <<'EOF'
# Workflow Plan

## Close Contract

- [x] REQUIRED|Requirements|inception/requirements/requirements.md|approvals/01-requirements-approval.md
- [x] REQUIRED|Workflow Plan|inception/plans/execution-plan.md|approvals/02-workflow-plan-approval.md
- [x] REQUIRED|Code Generation Plan|construction/plans/aidlc-integration-code-generation-plan.md|approvals/03-code-generation-plan-approval.md
- [x] REQUIRED|Code Generation Result|construction/aidlc-integration/code/code-generation-summary.md|approvals/04-code-generation-result-approval.md
- [x] REQUIRED|Build/Test Result|construction/build-and-test/build-and-test-summary.md|approvals/05-build-test-result-approval.md
- [x] SKIP|User Stories|No end-user behavior changes in this fixture.
EOF
  printf '# Code Generation Plan\n\n- [x] Implement the approved fixture.\n' > "${root}/aidlc-docs/construction/plans/aidlc-integration-code-generation-plan.md"
  printf '# Code Generation Result\n\nAll approved paths are inventoried.\n' > "${root}/aidlc-docs/construction/aidlc-integration/code/code-generation-summary.md"
  cat > "${root}/aidlc-docs/construction/build-and-test/build-and-test-summary.md" <<'EOF'
# Build and Test Result

- **Blocking Findings**: None
- **Result**: PASS
EOF
  cat > "${root}/aidlc-docs/cycle-summary.md" <<'EOF'
# Test Cycle

- **Blocking Findings**: None
- **Outcome**: Complete.
EOF

  write_approval "${root}" "Requirements" "inception/requirements/requirements.md" "approvals/01-requirements-approval.md"
  write_approval "${root}" "Workflow Plan" "inception/plans/execution-plan.md" "approvals/02-workflow-plan-approval.md"
  write_approval "${root}" "Code Generation Plan" "construction/plans/aidlc-integration-code-generation-plan.md" "approvals/03-code-generation-plan-approval.md"
  write_approval "${root}" "Code Generation Result" "construction/aidlc-integration/code/code-generation-summary.md" "approvals/04-code-generation-result-approval.md"
  write_approval "${root}" "Build/Test Result" "construction/build-and-test/build-and-test-summary.md" "approvals/05-build-test-result-approval.md"
}

make_archive_fixture() {
  local root="$1"
  mkdir -p "${root}/_trace/aidlc-docs"
  printf '# cycle\n' > "${root}/README.md"
  printf '# state\n' > "${root}/_trace/aidlc-docs/aidlc-state.md"
  (
    cd "${root}"
    find . -type f ! -name manifest.sha256 -print | LC_ALL=C sort | while IFS= read -r path; do
      shasum -a 256 "${path}"
    done > manifest.sha256
  )
}

refresh_source_asset() {
  local root="$1"
  local fixture="$2"
  local asset_digest
  (
    cd "${fixture}/payload"
    zip -qry "${fixture}/asset.zip" aidlc-rules
  )
  asset_digest="$(shasum -a 256 "${fixture}/asset.zip" | awk '{print $1}')"
  replace_literal "${root}/.aidlc/SOURCE.lock" "asset_sha256=PLACEHOLDER" "asset_sha256=${asset_digest}"
  replace_literal "${fixture}/release.json" "sha256:PLACEHOLDER" "sha256:${asset_digest}"
}

make_source_fixture() {
  local root="$1"
  local fixture="$2"
  mkdir -p \
    "${root}/.aidlc/aidlc-rules/aws-aidlc-rules" \
    "${root}/.aidlc/aidlc-rules/aws-aidlc-rule-details" \
    "${fixture}/payload/aidlc-rules/aws-aidlc-rules" \
    "${fixture}/payload/aidlc-rules/aws-aidlc-rule-details"

  printf '1.0.1\n' > "${root}/.aidlc/aidlc-rules/VERSION"
  printf '# core\n' > "${root}/.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md"
  printf '# detail\n' > "${root}/.aidlc/aidlc-rules/aws-aidlc-rule-details/detail.md"
  cp -R "${root}/.aidlc/aidlc-rules/." "${fixture}/payload/aidlc-rules/"
  printf 'controlled tag archive bytes\n' > "${fixture}/tag-archive.tar.gz"

  (
    cd "${root}/.aidlc"
    find aidlc-rules -type f -print | LC_ALL=C sort | while IFS= read -r path; do
      shasum -a 256 "${path}"
    done > aidlc-rules.MANIFEST.sha256
  )
  local manifest_digest tag_archive_digest
  manifest_digest="$(shasum -a 256 "${root}/.aidlc/aidlc-rules.MANIFEST.sha256" | awk '{print $1}')"
  tag_archive_digest="$(shasum -a 256 "${fixture}/tag-archive.tar.gz" | awk '{print $1}')"
  cat > "${root}/.aidlc/SOURCE.lock" <<EOF
source_repository=https://github.com/awslabs/aidlc-workflows
release=v1.0.1
release_url=https://github.com/awslabs/aidlc-workflows/releases/tag/v1.0.1
published_at=2026-06-30T17:54:27Z
tag_object=e40f6a93a59d1a22be78314ff32585fdd6b60936
release_commit=e49341dbeb8af82758dd85e96ed7fe9bcf38a447
asset_id=462256823
asset=ai-dlc-rules-v1.0.1.zip
asset_url=https://github.com/awslabs/aidlc-workflows/releases/download/v1.0.1/ai-dlc-rules-v1.0.1.zip
asset_sha256=PLACEHOLDER
tag_archive_sha256=${tag_archive_digest}
payload_file_count=3
payload_manifest_sha256=${manifest_digest}
EOF
  cat > "${fixture}/release.json" <<'EOF'
{
  "tag_name": "v1.0.1",
  "html_url": "https://github.com/awslabs/aidlc-workflows/releases/tag/v1.0.1",
  "published_at": "2026-06-30T17:54:27Z",
  "assets": [{
    "id": 462256823,
    "name": "ai-dlc-rules-v1.0.1.zip",
    "browser_download_url": "https://github.com/awslabs/aidlc-workflows/releases/download/v1.0.1/ai-dlc-rules-v1.0.1.zip",
    "digest": "sha256:PLACEHOLDER"
  }]
}
EOF
  cat > "${fixture}/ref.json" <<'EOF'
{"object":{"type":"tag","sha":"e40f6a93a59d1a22be78314ff32585fdd6b60936"}}
EOF
  cat > "${fixture}/tag.json" <<'EOF'
{"object":{"type":"commit","sha":"e49341dbeb8af82758dd85e96ed7fe9bcf38a447"}}
EOF
  refresh_source_asset "${root}" "${fixture}"
}
