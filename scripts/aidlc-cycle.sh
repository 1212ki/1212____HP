#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  scripts/aidlc-cycle.sh verify
  scripts/aidlc-cycle.sh start <issue-number> <topic>
  scripts/aidlc-cycle.sh status
  scripts/aidlc-cycle.sh resume <cycle-id> <issue-number>
  scripts/aidlc-cycle.sh close <cycle-id>
USAGE
}

fail() {
  echo "AI-DLC cycle command failed: $*" >&2
  exit 1
}

repo_root="${AIDLC_REPO_ROOT:-}"
if [[ -z "${repo_root}" ]]; then
  repo_root="$(git rev-parse --show-toplevel)"
fi
repo_root="$(cd "${repo_root}" && pwd -P)"
active_root="${repo_root}/aidlc-docs"
state_file="${active_root}/aidlc-state.md"
audit_file="${active_root}/audit.md"
archive_parent="${repo_root}/docs/records/aidlc-cycles"
verify_command="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/aidlc-verify.sh"

md_value() {
  local file="$1"
  local label="$2"
  local value
  value="$(sed -n -E "s/^- \*\*${label}\*\*: ?//p" "${file}" | head -n 1)"
  if [[ "${value}" == \`*\` ]]; then
    value="${value#\`}"
    value="${value%\`}"
  fi
  printf '%s\n' "${value}"
}

md_text() {
  local file="$1"
  local label="$2"
  local value
  value="$(md_value "${file}" "${label}")"
  if [[ "${value}" != '|' ]]; then
    printf '%s\n' "${value}"
    return
  fi
  awk -v marker="- **${label}**: |" '
    $0 == marker {block = 1; next}
    block && /^  / {sub(/^  /, ""); print; next}
    block {exit}
  ' "${file}"
}

state_value() {
  md_value "${state_file}" "$1"
}

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

active_content_digest() {
  local non_regular
  non_regular="$(cd "${active_root}" && find . ! -type d ! -type f -print -quit)"
  [[ -z "${non_regular}" ]] || fail "active workspace contains non-regular entry: ${non_regular}"
  (
    cd "${active_root}"
    find . -type f -print | LC_ALL=C sort | while IFS= read -r path; do
      shasum -a 256 "${path}"
    done
  ) | shasum -a 256 | awk '{print $1}'
}

validate_cycle_id() {
  local cycle_id="$1"
  [[ "${cycle_id}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_issue-([0-9]+)_[a-z0-9]+(-[a-z0-9]+)*$ ]] || fail "invalid cycle ID"
  printf '%s\n' "${BASH_REMATCH[1]}"
}

validate_identity() {
  local requested_cycle="$1"
  local requested_issue="$2"
  [[ -f "${state_file}" ]] || fail "no active cycle"
  local state_cycle state_issue state_branch state_base state_root git_root branch
  state_cycle="$(state_value 'Cycle ID')"
  state_issue="$(state_value Issue)"
  state_issue="${state_issue#\#}"
  state_branch="$(state_value Branch)"
  state_base="$(state_value 'Base Commit')"
  state_root="$(state_value 'Workspace Root')"

  [[ "${state_cycle}" == "${requested_cycle}" ]] || fail "cycle ID does not match state: ${state_cycle}"
  [[ "${state_issue}" == "${requested_issue}" ]] || fail "Issue does not match state: #${state_issue}"
  git_root="$(git -C "${repo_root}" rev-parse --show-toplevel 2>/dev/null)" || fail "workspace is not a git worktree"
  git_root="$(cd "${git_root}" && pwd -P)"
  [[ "${git_root}" == "${repo_root}" && "${state_root}" == "${git_root}" ]] || fail "Workspace Root mismatch: state=${state_root}, current=${git_root}"
  branch="$(git -C "${repo_root}" symbolic-ref --quiet --short HEAD 2>/dev/null)" || fail "detached HEAD is not allowed"
  [[ "${branch}" == "${state_branch}" ]] || fail "branch mismatch: state=${state_branch}, current=${branch}"
  [[ -n "${state_base}" ]] || fail "Base Commit is missing"
  git -C "${repo_root}" cat-file -e "${state_base}^{commit}" 2>/dev/null || fail "Base Commit does not resolve: ${state_base}"
  git -C "${repo_root}" merge-base --is-ancestor "${state_base}" HEAD || fail "Base Commit is not an ancestor of HEAD: ${state_base}"
}

approval_mapping() {
  case "$1" in
    Requirements) echo 'inception/requirements/requirements.md|approvals/01-requirements-approval.md' ;;
    'Workflow Plan') echo 'inception/plans/execution-plan.md|approvals/02-workflow-plan-approval.md' ;;
    'Code Generation Plan') echo 'construction/plans/aidlc-integration-code-generation-plan.md|approvals/03-code-generation-plan-approval.md' ;;
    'Code Generation Result') echo 'construction/aidlc-integration/code/code-generation-summary.md|approvals/04-code-generation-result-approval.md' ;;
    'Build/Test Result') echo 'construction/build-and-test/build-and-test-summary.md|approvals/05-build-test-result-approval.md' ;;
    *) return 1 ;;
  esac
}

validate_approval() {
  local stage="$1"
  local artifact_rel="$2"
  local record_rel="$3"
  local artifact="${active_root}/${artifact_rel}"
  local record="${active_root}/${record_rel}"
  [[ -f "${artifact}" && ! -L "${artifact}" ]] || fail "missing required artifact for ${stage}: aidlc-docs/${artifact_rel}"
  [[ -f "${record}" && ! -L "${record}" ]] || fail "missing approval record for ${stage}: aidlc-docs/${record_rel}"

  local status record_stage record_path absolute_path recorded_digest actual_digest approver prompt_at prompt response_at response decision choice_prompt
  status="$(md_value "${record}" 'Record status')"
  record_stage="$(md_value "${record}" Stage)"
  record_path="$(md_value "${record}" 'Artifact repository-relative path')"
  absolute_path="$(md_value "${record}" 'Artifact absolute path')"
  recorded_digest="$(md_value "${record}" 'Artifact SHA-256')"
  approver="$(md_value "${record}" Approver)"
  prompt_at="$(md_value "${record}" 'Prompt timestamp')"
  prompt="$(md_text "${record}" 'Approval prompt')"
  response_at="$(md_value "${record}" 'Response timestamp')"
  response="$(md_text "${record}" 'Complete raw human response')"
  decision="$(md_value "${record}" Decision)"
  choice_prompt='Reply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other.'

  [[ "${status}" == APPROVED ]] || fail "approval record is not APPROVED for ${stage}"
  [[ "${record_stage}" == "${stage}" ]] || fail "approval stage mismatch for ${stage}: ${record_stage}"
  [[ "${record_path}" == "aidlc-docs/${artifact_rel}" ]] || fail "approval artifact path mismatch for ${stage}"
  [[ "${absolute_path}" == "${artifact}" ]] || fail "approval absolute path mismatch for ${stage}"
  [[ "${recorded_digest}" =~ ^[0-9a-f]{64}$ ]] || fail "invalid approval digest for ${stage}"
  actual_digest="$(sha256_file "${artifact}")"
  [[ "${actual_digest}" == "${recorded_digest}" ]] || fail "approval digest mismatch for ${stage}"
  [[ -n "${approver}" ]] || fail "human approver is missing for ${stage}"
  if printf '%s\n' "${approver}" | grep -Eiq '^(pending|ai|agent|worker|system|unknown|n/a)$'; then
    fail "human approver is invalid for ${stage}"
  fi
  [[ "${prompt_at}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T.+ ]] || fail "prompt timestamp is missing for ${stage}"
  [[ "${response_at}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T.+ ]] || fail "response timestamp is missing for ${stage}"
  [[ -n "${prompt}" && "${prompt}" == *"${stage}"* && "${prompt}" == *"aidlc-docs/${artifact_rel}"* && "${prompt}" == *"${recorded_digest}"* ]] || fail "approval prompt is not artifact-bound for ${stage}"
  [[ "${prompt}" == *"${choice_prompt}"* ]] || fail "approval prompt lacks canonical A/B/X choice for ${stage}"
  [[ "${response}" == A ]] || fail "raw human response must be exactly A for ${stage}"
  [[ "${decision}" == APPROVED* ]] || fail "approval decision is not explicit for ${stage}"
}

validate_close_ready() {
  local required=(audit.md cycle-summary.md inception/plans/execution-plan.md construction/plans/aidlc-integration-code-generation-plan.md construction/aidlc-integration/code/code-generation-summary.md construction/build-and-test/build-and-test-summary.md)
  local path
  for path in "${required[@]}"; do
    [[ -f "${active_root}/${path}" && ! -L "${active_root}/${path}" ]] || fail "missing required artifact: aidlc-docs/${path}"
  done
  [[ "$(state_value 'Cycle Status')" == Complete ]] || fail "Cycle Status must be Complete before close"
  [[ "$(state_value 'Current Stage')" == Complete ]] || fail "Current Stage must be Complete before close"
  [[ "$(state_value 'Approval Gate')" == None && "$(state_value 'Approval Status')" == Complete ]] || fail "approval state is incomplete"
  if grep -R -E '^\[Answer\]:[[:space:]]*$' "${active_root}" --include='*.md' >/dev/null; then
    fail "one or more question answers are empty"
  fi
  if grep -R -E '^- \[ \]' "${state_file}" "${active_root}/inception/plans" "${active_root}/construction/plans" --include='*.md' >/dev/null 2>&1; then
    fail "state or execution plan contains unchecked required work"
  fi
  [[ "$(md_value "${active_root}/construction/build-and-test/build-and-test-summary.md" 'Blocking Findings')" == None ]] || fail "Build/Test Blocking Findings must be None"
  [[ "$(md_value "${active_root}/cycle-summary.md" 'Blocking Findings')" == None ]] || fail "cycle-summary Blocking Findings must be None"

  local plan="${active_root}/inception/plans/execution-plan.md"
  local stage expected artifact record declared count line reason
  for stage in Requirements 'Workflow Plan' 'Code Generation Plan' 'Code Generation Result' 'Build/Test Result'; do
    expected="$(approval_mapping "${stage}")"
    count="$(grep -F -c "REQUIRED|${stage}|" "${plan}" || true)"
    [[ "${count}" -eq 1 ]] || fail "required approval stage must appear exactly once: ${stage}"
    line="$(grep -F "REQUIRED|${stage}|" "${plan}")"
    [[ "${line}" == '- [x] '* ]] || fail "required approval stage is not checked: ${stage}"
    declared="${line#*REQUIRED|${stage}|}"
    [[ "${declared}" == "${expected}" ]] || fail "required artifact mapping mismatch for ${stage}"
    artifact="${expected%%|*}"
    record="${expected#*|}"
    validate_approval "${stage}" "${artifact}" "${record}"
  done
  while IFS= read -r line; do
    [[ "${line}" == '- [x] '* ]] || fail "skip is not approved by the Workflow Plan"
    reason="${line#*SKIP|}"
    reason="${reason#*|}"
    [[ -n "${reason}" ]] || fail "approved skip rationale is empty"
  done < <(grep 'SKIP|' "${plan}" || true)
}

generate_manifest() {
  local root="$1"
  (
    cd "${root}"
    find . -type f ! -path './manifest.sha256' -print | LC_ALL=C sort | while IFS= read -r path; do
      shasum -a 256 "${path}"
    done > manifest.sha256
  )
}

archive_value() {
  local file="$1"
  local key="$2"
  sed -n "s/^${key}=//p" "${file}" | head -n 1
}

verify_existing_archive() {
  local archive_root="$1"
  local cycle_id="$2"
  local issue="$3"
  local fresh_digest="$4"
  local identity="${archive_root}/archive-identity.env"
  local source_digest_file="${archive_root}/source-active.sha256"
  local output
  if ! output="$("${verify_command}" --archive "${archive_root}" 2>&1)"; then
    fail "existing archive failed exact verification: ${output}"
  fi
  [[ -f "${identity}" && -f "${source_digest_file}" ]] || fail "existing archive lacks binding metadata"
  [[ "$(archive_value "${identity}" cycle_id)" == "${cycle_id}" ]] || fail "existing archive Cycle ID mismatch"
  [[ "$(archive_value "${identity}" issue)" == "${issue}" ]] || fail "existing archive Issue mismatch"
  [[ "$(archive_value "${identity}" branch)" == "$(state_value Branch)" ]] || fail "existing archive branch mismatch"
  [[ "$(archive_value "${identity}" base_commit)" == "$(state_value 'Base Commit')" ]] || fail "existing archive base mismatch"
  [[ "$(archive_value "${identity}" workspace_root)" == "${repo_root}" ]] || fail "existing archive worktree mismatch"
  [[ "$(archive_value "${identity}" source_active_sha256)" == "${fresh_digest}" ]] || fail "existing archive source active-content digest mismatch"
  [[ "$(awk '{print $1}' "${source_digest_file}")" == "${fresh_digest}" ]] || fail "existing archive source digest record mismatch"
}

safe_remove_temp() {
  local path="$1"
  case "${path}" in
    "${archive_parent}"/.aidlc-stage-*|"${repo_root}"/.aidlc-idle-*|"${repo_root}"/.aidlc-recovery-*) rm -rf "${path}" ;;
    *) fail "refusing to remove unexpected temporary path: ${path}" ;;
  esac
}

reset_to_idle() {
  local cycle_id="$1"
  local idle_root recovery_root
  if [[ "${AIDLC_FAIL_AT:-}" == idle_prepare ]]; then
    fail "injected idle_prepare failure"
  fi
  idle_root="$(mktemp -d "${repo_root}/.aidlc-idle-${cycle_id}.XXXXXX")"
  cat > "${idle_root}/README.md" <<EOF
# AI-DLC Active Workspace

No cycle is active. This repository is ready for the next design or implementation change to start a formal AI-DLC cycle.

1. Run \`scripts/aidlc-verify.sh --local\`.
2. Create an Issue branch and isolated worktree from current \`origin/main\`.
3. Run \`scripts/aidlc-cycle.sh start <issue-number> <topic>\` before changing canonical design or implementation.

Closed formal-cycle history: \`docs/records/aidlc-cycles/\`.
Bootstrap/setup history: \`docs/records/aidlc-bootstrap/\`.
EOF
  recovery_root="${repo_root}/.aidlc-recovery-${cycle_id}.$$"
  [[ ! -e "${recovery_root}" ]] || { safe_remove_temp "${idle_root}"; fail "recovery path already exists"; }
  mv "${active_root}" "${recovery_root}"
  if [[ "${AIDLC_FAIL_AT:-}" == active_reset ]]; then
    mv "${recovery_root}" "${active_root}"
    safe_remove_temp "${idle_root}"
    fail "injected active_reset failure"
  fi
  if ! mv "${idle_root}" "${active_root}"; then
    [[ ! -e "${active_root}" ]] || safe_remove_temp "${active_root}"
    mv "${recovery_root}" "${active_root}"
    fail "active-to-idle reset failed; active workspace restored"
  fi
  safe_remove_temp "${recovery_root}"
}

command_status() {
  if [[ ! -f "${state_file}" ]]; then
    echo "No active AI-DLC cycle."
    return
  fi
  echo "Cycle ID: $(state_value 'Cycle ID')"
  echo "Issue: $(state_value Issue)"
  echo "Current Stage: $(state_value 'Current Stage')"
  echo "Cycle Status: $(state_value 'Cycle Status')"
}

command_start() {
  local issue="$1"
  local topic="$2"
  [[ "${issue}" =~ ^[0-9]+$ ]] || fail "issue number must be numeric"
  [[ "${topic}" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || fail "topic must be lowercase kebab-case"
  [[ ! -e "${state_file}" ]] || fail "an active cycle already exists"
  [[ -x "${verify_command}" ]] || fail "missing executable verification command"
  "${verify_command}" --payload-only "${repo_root}" >/dev/null
  local branch base started_at start_date cycle_id
  branch="$(git -C "${repo_root}" symbolic-ref --quiet --short HEAD 2>/dev/null)" || fail "detached HEAD is not allowed"
  [[ "${branch}" == "feature/${issue}-"* ]] || fail "branch ${branch} does not match Issue #${issue}"
  base="$(git -C "${repo_root}" rev-parse HEAD)"
  started_at="$(date -Iseconds)"
  start_date="${started_at%%T*}"
  cycle_id="${start_date}_issue-${issue}_${topic}"
  mkdir -p "${active_root}/inception/requirements" "${active_root}/inception/plans" "${active_root}/construction/plans" "${active_root}/construction/build-and-test" "${active_root}/approvals" "${active_root}/operations"
  cat > "${state_file}" <<EOF
# AI-DLC State Tracking

- **Cycle ID**: ${cycle_id}
- **Issue**: #${issue}
- **Base Commit**: ${base}
- **Branch**: ${branch}
- **Workspace Root**: ${repo_root}
- **Start Date**: ${started_at}
- **Current Stage**: INCEPTION - Workspace Detection
- **Cycle Status**: In Progress
- **Approval Gate**: Requirements
- **Approval Status**: Pending
EOF
  cat > "${audit_file}" <<EOF
# AI-DLC Audit Trail

## Cycle Start

- **Timestamp**: ${started_at}
- **Cycle ID**: ${cycle_id}
- **Issue**: #${issue}
- **Base Commit**: ${base}
- **Branch**: ${branch}
- **Workspace Root**: ${repo_root}
- **Event**: Active workspace initialized. Record the complete initial request before proceeding.
EOF
  cat > "${active_root}/README.md" <<EOF
# AI-DLC Active Workspace

Cycle ${cycle_id} is active. Read \`aidlc-state.md\` and \`audit.md\` before editing artifacts.
EOF
  echo "Started AI-DLC cycle ${cycle_id}"
}

command_resume() {
  local cycle_id="$1"
  local issue="$2"
  validate_cycle_id "${cycle_id}" >/dev/null
  [[ "${issue}" =~ ^[0-9]+$ ]] || fail "issue number must be numeric"
  validate_identity "${cycle_id}" "${issue}"
  command_status
  echo "Identity verified. Read aidlc-docs/aidlc-state.md, load prerequisite artifacts, and append the resumption event to aidlc-docs/audit.md."
}

command_close() {
  local cycle_id="$1"
  local issue archive_root fresh_digest stage_root
  issue="$(validate_cycle_id "${cycle_id}")"
  validate_identity "${cycle_id}" "${issue}"
  validate_close_ready
  mkdir -p "${archive_parent}"
  archive_root="${archive_parent}/${cycle_id}"
  fresh_digest="$(active_content_digest)"

  if [[ -e "${archive_root}" || -L "${archive_root}" ]]; then
    [[ -d "${archive_root}" && ! -L "${archive_root}" ]] || fail "existing archive target must be a physical directory (symlinks are not allowed)"
    verify_existing_archive "${archive_root}" "${cycle_id}" "${issue}" "${fresh_digest}"
    echo "Verified existing archive; entering PUBLISHED-resume."
  else
    stage_root="$(mktemp -d "${archive_parent}/.aidlc-stage-${cycle_id}.XXXXXX")"
    mkdir -p "${stage_root}/_trace"
    if [[ "${AIDLC_FAIL_AT:-}" == copy ]]; then
      safe_remove_temp "${stage_root}"
      fail "injected copy failure"
    fi
    cp -R "${active_root}" "${stage_root}/_trace/aidlc-docs"
    cp "${active_root}/cycle-summary.md" "${stage_root}/README.md"
    cat > "${stage_root}/archive-identity.env" <<EOF
cycle_id=${cycle_id}
issue=${issue}
base_commit=$(state_value 'Base Commit')
branch=$(state_value Branch)
workspace_root=${repo_root}
source_active_sha256=${fresh_digest}
EOF
    printf '%s  _trace/aidlc-docs\n' "${fresh_digest}" > "${stage_root}/source-active.sha256"
    generate_manifest "${stage_root}"
    if [[ "${AIDLC_FAIL_AT:-}" == manifest ]]; then
      safe_remove_temp "${stage_root}"
      fail "injected manifest failure"
    fi
    if ! "${verify_command}" --archive "${stage_root}" >/dev/null; then
      safe_remove_temp "${stage_root}"
      fail "staged archive manifest verification failed"
    fi
    if [[ "${AIDLC_FAIL_AT:-}" == publish ]]; then
      safe_remove_temp "${stage_root}"
      fail "injected publish failure"
    fi
    mv "${stage_root}" "${archive_root}"
    "${verify_command}" --archive "${archive_root}" >/dev/null || fail "published archive failed verification"
  fi

  reset_to_idle "${cycle_id}"
  "${verify_command}" --archive "${archive_root}" >/dev/null || fail "final archive failed verification"
  echo "Closed and archived AI-DLC cycle ${cycle_id}; active workspace is idle."
}

command="${1:-}"
case "${command}" in
  verify)
    shift; [[ $# -eq 0 ]] || { usage; exit 2; }
    "${verify_command}" --local "${repo_root}"
    ;;
  start)
    shift; [[ $# -eq 2 ]] || { usage; exit 2; }
    command_start "$1" "$2"
    ;;
  status)
    shift; [[ $# -eq 0 ]] || { usage; exit 2; }
    command_status
    ;;
  resume)
    shift; [[ $# -eq 2 ]] || { usage; exit 2; }
    command_resume "$1" "$2"
    ;;
  close)
    shift; [[ $# -eq 1 ]] || { usage; exit 2; }
    command_close "$1"
    ;;
  *) usage; exit 2 ;;
esac
