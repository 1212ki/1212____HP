#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
failures=0

pass() {
  printf 'ok - %s\n' "$1"
}

fail() {
  printf 'not ok - %s\n' "$1" >&2
  failures=$((failures + 1))
}

require_path() {
  local path="$1"
  if [[ -e "${repo_root}/${path}" ]]; then
    pass "integration path exists: ${path}"
  else
    fail "missing integration path: ${path}"
  fi
}

require_text() {
  local path="$1"
  local text="$2"
  local label="$3"
  if [[ -f "${repo_root}/${path}" ]] && grep -Fq -- "${text}" "${repo_root}/${path}"; then
    pass "${label}"
  else
    fail "${label}"
  fi
}

reject_text() {
  local path="$1"
  local text="$2"
  local label="$3"
  if [[ -f "${repo_root}/${path}" ]] && ! grep -Fq -- "${text}" "${repo_root}/${path}"; then
    pass "${label}"
  else
    fail "${label}"
  fi
}

for path in \
  AGENTS.md \
  CLAUDE.md \
  .aidlc/SOURCE.lock \
  aidlc-docs/README.md \
  docs/DOCS_RULES.md \
  docs/operations/AI_DLC_WORKFLOW.md \
  docs/product/README.md \
  docs/records/aidlc-cycles/README.md \
  docs/records/aidlc-bootstrap/README.md \
  docs/records/aidlc-bootstrap/2026-08-30_aidlc-v1.0.1-setup/README.md \
  docs/records/decisions/README.md \
  scripts/aidlc-cycle.sh \
  scripts/aidlc-verify.sh; do
  require_path "${path}"
done

if [[ -f "${repo_root}/AGENTS.md" && -f "${repo_root}/CLAUDE.md" ]] && cmp -s "${repo_root}/AGENTS.md" "${repo_root}/CLAUDE.md"; then
  pass "root contributor guides are byte-identical"
else
  fail "root contributor guides are byte-identical"
fi

if [[ -f "${repo_root}/docs/AGENTS.md" && -f "${repo_root}/docs/CLAUDE.md" ]] && cmp -s "${repo_root}/docs/AGENTS.md" "${repo_root}/docs/CLAUDE.md"; then
  pass "docs contributor guides are byte-identical"
else
  fail "docs contributor guides are byte-identical"
fi

require_text docs/README.md '`specs/current/`' "docs map retains current specifications"
require_text docs/README.md '`../DESIGN_RULES.md`' "docs map retains site-wide visual canonical"
require_text docs/README.md '`plans/`' "docs map classifies implementation plans"
require_text docs/README.md '`../documents/`' "docs map classifies legacy documents"
require_text docs/README.md '`../aidlc-docs/`' "docs map classifies mutable active work"
require_text docs/README.md '`records/aidlc-cycles/`' "docs map classifies accepted cycle history"
require_text docs/README.md '`records/aidlc-bootstrap/`' "docs map classifies bootstrap audit history"
require_text docs/README.md '`records/decisions/`' "docs map classifies reusable decisions"
require_text docs/README.md '`product/`' "docs map classifies approved product guidance"

require_text AGENTS.md '1212HP' "root guide is 1212hp-specific"
require_text AGENTS.md 'origin/main' "root guide uses origin/main"
reject_text AGENTS.md 'origin/dev' "root guide does not use origin/dev"
require_text AGENTS.md '次の設計・実装変更' "root guide requires the next change to use AI-DLC"

require_text aidlc-docs/README.md 'No cycle is active.' "active workspace is idle"
require_text aidlc-docs/README.md 'origin/main' "idle guidance uses origin/main"
reject_text aidlc-docs/README.md 'origin/dev' "idle guidance does not use origin/dev"

require_text docs/records/aidlc-bootstrap/README.md 'not accepted' "bootstrap history is not accepted-cycle evidence"
require_text docs/records/aidlc-bootstrap/2026-08-30_aidlc-v1.0.1-setup/README.md 'formal cycleではありません' "dated setup record rejects formal-cycle status"
require_text docs/records/aidlc-cycles/README.md 'YYYY-MM-DD_issue-<number>_<topic>' "accepted discovery naming is documented"
require_text docs/records/aidlc-cycles/README.md 'Bootstrap' "accepted discovery excludes bootstrap"
require_text docs/records/aidlc-cycles/README.md 'staging' "accepted discovery excludes staging"
require_text docs/records/aidlc-cycles/README.md 'idle' "accepted discovery excludes idle"
require_text docs/records/aidlc-cycles/README.md 'recovery' "accepted discovery excludes recovery"

if [[ -d "${repo_root}/aidlc-docs" ]] && [[ "$(find "${repo_root}/aidlc-docs" -mindepth 1 -maxdepth 1 -print | wc -l | tr -d '[:space:]')" == 1 ]] && [[ -f "${repo_root}/aidlc-docs/README.md" ]]; then
  pass "idle workspace contains only README.md"
else
  fail "idle workspace contains only README.md"
fi

accepted_count="$(find "${repo_root}/docs/records/aidlc-cycles" -mindepth 1 -maxdepth 1 -type d -regex '.*/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_issue-[0-9]+_[a-z0-9]+\(-[a-z0-9]+\)*' 2>/dev/null | wc -l | tr -d '[:space:]')"
if [[ "${accepted_count}" == 0 ]]; then
  pass "bootstrap created no accepted formal cycle"
else
  fail "bootstrap created no accepted formal cycle"
fi

if [[ ${failures} -ne 0 ]]; then
  printf '1212hp AI-DLC bootstrap acceptance: %s failure(s)\n' "${failures}" >&2
  exit 1
fi

echo "1212hp AI-DLC bootstrap acceptance passed"
