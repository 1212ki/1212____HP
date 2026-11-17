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

  local status record_stage record_path absolute_path recorded_digest actual_digest approver prompt_at prompt response_at response decision choice_prompt final_prompt_line
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
  final_prompt_line="${prompt##*$'\n'}"

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
  [[ "${prompt}" == *"${choice_prompt}" ]] || fail "approval prompt must end with canonical A/B/X choice for ${stage}"
  [[ "${final_prompt_line}" == "${choice_prompt}" ]] || fail "approval prompt final line must exactly match canonical A/B/X choice for ${stage}"
  [[ "${response}" == A ]] || fail "raw human response must be exactly A for ${stage}"
  [[ "${decision}" == APPROVED* ]] || fail "approval decision is not explicit for ${stage}"
}

validate_approval Requirements inception/requirements/requirements.md approvals/01-requirements-approval.md
echo 'validate_approval PASS: Requirements'
validate_approval 'Workflow Plan' inception/plans/execution-plan.md approvals/02-workflow-plan-approval.md
echo 'validate_approval PASS: Workflow Plan'
validate_approval 'Code Generation Plan' construction/plans/aidlc-integration-code-generation-plan.md approvals/03-code-generation-plan-approval.md
echo 'validate_approval PASS: Code Generation Plan'
