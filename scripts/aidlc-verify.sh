#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  scripts/aidlc-verify.sh [--local|--payload-only] [repo-root]
  scripts/aidlc-verify.sh --source [repo-root]
  scripts/aidlc-verify.sh --archive <archive-root>
USAGE
}

fail() {
  echo "AI-DLC verification failed: $*" >&2
  exit 1
}

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

require_physical_path() {
  local candidate="$1"
  local absolute_path component path_prefix remainder
  if [[ "${candidate}" == /* ]]; then
    absolute_path="${candidate}"
  else
    absolute_path="${PWD}/${candidate}"
  fi
  path_prefix="/"
  remainder="${absolute_path#/}"
  while [[ -n "${remainder}" ]]; do
    component="${remainder%%/*}"
    if [[ "${remainder}" == */* ]]; then
      remainder="${remainder#*/}"
    else
      remainder=""
    fi
    [[ -n "${component}" ]] || continue
    if [[ "${path_prefix}" == "/" ]]; then
      path_prefix="/${component}"
    else
      path_prefix="${path_prefix}/${component}"
    fi
    [[ ! -L "${path_prefix}" ]] || fail "archive root must be a physical directory (symlink path components are not allowed): ${candidate} (symlink component: ${path_prefix})"
  done
}

verify_archive() {
  local root="$1"
  require_physical_path "${root}"
  local manifest="${root}/manifest.sha256"
  [[ -d "${root}" && ! -L "${root}" ]] || fail "archive root must be a physical directory (symlinks are not allowed): ${root}"
  [[ -f "${manifest}" && ! -L "${manifest}" ]] || fail "missing regular manifest.sha256"

  local non_regular
  non_regular="$(cd "${root}" && find . ! -type d ! -type f -print -quit)"
  [[ -z "${non_regular}" ]] || fail "archive contains non-regular entry: ${non_regular}"

  local temp_root manifest_paths actual_paths line digest path actual duplicate
  temp_root="$(mktemp -d /private/tmp/aidlc-archive-verify.XXXXXX)"
  manifest_paths="${temp_root}/manifest-paths"
  actual_paths="${temp_root}/actual-paths"
  : > "${manifest_paths}"

  while IFS= read -r line || [[ -n "${line}" ]]; do
    if [[ ! "${line}" =~ ^([0-9a-f]{64})[[:space:]][[:space:]](\./.+)$ ]]; then
      rm -rf "${temp_root}"
      fail "malformed manifest entry: ${line}"
    fi
    digest="${BASH_REMATCH[1]}"
    path="${BASH_REMATCH[2]}"
    case "${path}" in
      ./manifest.sha256|./../*|*/../*|*/..|*\\*)
        rm -rf "${temp_root}"
        fail "malformed manifest path: ${path}"
        ;;
    esac
    printf '%s\n' "${path}" >> "${manifest_paths}"
    [[ -f "${root}/${path#./}" && ! -L "${root}/${path#./}" ]] || continue
    actual="$(sha256_file "${root}/${path#./}")"
    if [[ "${actual}" != "${digest}" ]]; then
      rm -rf "${temp_root}"
      fail "archive digest mismatch: ${path}"
    fi
  done < "${manifest}"

  duplicate="$(LC_ALL=C sort "${manifest_paths}" | uniq -d | head -n 1)"
  if [[ -n "${duplicate}" ]]; then
    rm -rf "${temp_root}"
    fail "duplicate manifest entry: ${duplicate}"
  fi

  (cd "${root}" && find . -type f ! -path './manifest.sha256' -print | LC_ALL=C sort) > "${actual_paths}"
  LC_ALL=C sort "${manifest_paths}" -o "${manifest_paths}"
  if ! cmp -s "${manifest_paths}" "${actual_paths}"; then
    rm -rf "${temp_root}"
    fail "archive manifest path set differs from actual regular-file path set"
  fi
  rm -rf "${temp_root}"
  echo "AI-DLC archive verification passed: ${root}"
}

mode="local"
if [[ "${1:-}" == "--archive" ]]; then
  [[ $# -eq 2 ]] || { usage; exit 2; }
  verify_archive "$2"
  exit 0
elif [[ "${1:-}" == "--source" ]]; then
  mode="source"
  shift
elif [[ "${1:-}" == "--payload-only" ]]; then
  mode="payload"
  shift
elif [[ "${1:-}" == "--local" ]]; then
  shift
fi
[[ $# -le 1 ]] || { usage; exit 2; }

repo_root="${1:-${AIDLC_REPO_ROOT:-}}"
if [[ -z "${repo_root}" ]]; then
  repo_root="$(git rev-parse --show-toplevel)"
fi
repo_root="$(cd "${repo_root}" && pwd -P)"
lock_file="${repo_root}/.aidlc/SOURCE.lock"
manifest_file="${repo_root}/.aidlc/aidlc-rules.MANIFEST.sha256"
rules_root="${repo_root}/.aidlc/aidlc-rules"

read_lock() {
  local key="$1"
  awk -F= -v key="${key}" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "${lock_file}"
}

required_keys=(source_repository release release_url published_at tag_object release_commit asset_id asset asset_url asset_sha256 tag_archive_sha256 payload_file_count payload_manifest_sha256)
[[ -f "${lock_file}" && ! -L "${lock_file}" ]] || fail "missing regular .aidlc/SOURCE.lock"
[[ -f "${manifest_file}" && ! -L "${manifest_file}" ]] || fail "missing regular payload manifest"
[[ -d "${rules_root}" && ! -L "${rules_root}" ]] || fail "missing regular rules directory"
for key in "${required_keys[@]}"; do
  [[ "$(grep -c "^${key}=" "${lock_file}" || true)" -eq 1 ]] || fail "SOURCE.lock key must appear exactly once: ${key}"
done
if grep -Ev '^(source_repository|release|release_url|published_at|tag_object|release_commit|asset_id|asset|asset_url|asset_sha256|tag_archive_sha256|payload_file_count|payload_manifest_sha256)=' "${lock_file}" | grep -q .; then
  fail "SOURCE.lock contains an unknown or malformed field"
fi

source_repository="$(read_lock source_repository)"
release="$(read_lock release)"
release_url="$(read_lock release_url)"
published_at="$(read_lock published_at)"
tag_object="$(read_lock tag_object)"
release_commit="$(read_lock release_commit)"
asset_id="$(read_lock asset_id)"
asset="$(read_lock asset)"
asset_url="$(read_lock asset_url)"
asset_sha256="$(read_lock asset_sha256)"
tag_archive_sha256="$(read_lock tag_archive_sha256)"
expected_file_count="$(read_lock payload_file_count)"
expected_manifest_sha256="$(read_lock payload_manifest_sha256)"

[[ "${source_repository}" == "https://github.com/awslabs/aidlc-workflows" ]] || fail "unexpected source repository"
[[ "${release}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "invalid pinned release: ${release}"
[[ "${tag_object}" =~ ^[0-9a-f]{40}$ && "${release_commit}" =~ ^[0-9a-f]{40}$ ]] || fail "invalid tag or commit SHA"
[[ "${asset_id}" =~ ^[0-9]+$ ]] || fail "invalid asset ID"
[[ "${asset_sha256}" =~ ^[0-9a-f]{64}$ && "${tag_archive_sha256}" =~ ^[0-9a-f]{64}$ && "${expected_manifest_sha256}" =~ ^[0-9a-f]{64}$ ]] || fail "invalid pinned digest"
[[ "${expected_file_count}" =~ ^[0-9]+$ ]] || fail "invalid payload file count"
[[ -f "${rules_root}/VERSION" && -f "${rules_root}/aws-aidlc-rules/core-workflow.md" && -d "${rules_root}/aws-aidlc-rule-details" ]] || fail "incomplete vendored payload"
[[ "v$(tr -d '[:space:]' < "${rules_root}/VERSION")" == "${release}" ]] || fail "VERSION does not match ${release}"
[[ "$(sha256_file "${manifest_file}")" == "${expected_manifest_sha256}" ]] || fail "manifest digest mismatch"

non_regular="$(cd "${repo_root}/.aidlc" && find aidlc-rules ! -type d ! -type f -print -quit)"
[[ -z "${non_regular}" ]] || fail "vendored payload contains non-regular entry: ${non_regular}"
actual_file_count="$(find "${rules_root}" -type f | wc -l | tr -d '[:space:]')"
[[ "${actual_file_count}" == "${expected_file_count}" ]] || fail "payload file count mismatch: expected ${expected_file_count}, got ${actual_file_count}"
if ! diff -u \
  <(cd "${repo_root}/.aidlc" && find aidlc-rules -type f -print | LC_ALL=C sort) \
  <(awk '{sub(/^[0-9a-f]+  /, ""); print}' "${manifest_file}" | LC_ALL=C sort) >/dev/null; then
  fail "manifest path set differs from vendored payload"
fi
(cd "${repo_root}/.aidlc" && shasum -a 256 -c "$(basename "${manifest_file}")" >/dev/null) || fail "vendored payload digest mismatch"

if [[ "${mode}" == "local" ]]; then
  required_paths=(AGENTS.md CLAUDE.md README.md DESIGN_RULES.md docs/AGENTS.md docs/CLAUDE.md docs/DOCS_RULES.md docs/README.md docs/operations/AI_DLC_WORKFLOW.md docs/product/README.md docs/records/aidlc-cycles/README.md docs/records/aidlc-bootstrap/README.md docs/records/decisions/README.md scripts/aidlc-cycle.sh aidlc-docs/README.md)
  for path in "${required_paths[@]}"; do
    [[ -e "${repo_root}/${path}" ]] || fail "missing integration path: ${path}"
  done
  cmp -s "${repo_root}/AGENTS.md" "${repo_root}/CLAUDE.md" || fail "root AGENTS.md and CLAUDE.md differ"
  cmp -s "${repo_root}/docs/AGENTS.md" "${repo_root}/docs/CLAUDE.md" || fail "docs AGENTS.md and CLAUDE.md differ"
  if [[ -d "${repo_root}/docs/records/aidlc-cycles" ]]; then
    for archive_root in "${repo_root}"/docs/records/aidlc-cycles/*; do
      archive_name="$(basename "${archive_root}")"
      [[ "${archive_name}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_issue-[0-9]+_[a-z0-9]+(-[a-z0-9]+)*$ ]] || continue
      [[ -d "${archive_root}" && ! -L "${archive_root}" ]] || fail "accepted archive root must be a physical directory (symlinks are not allowed): ${archive_root}"
      verify_archive "${archive_root}" >/dev/null
    done
  fi
fi

if [[ "${mode}" == "source" ]]; then
  command -v jq >/dev/null || fail "official source unavailable: jq is required"
  command -v unzip >/dev/null || fail "official source unavailable: unzip is required"
  temp_root="$(mktemp -d /private/tmp/aidlc-source-verify.XXXXXX)"
  release_json="${temp_root}/release.json"
  ref_json="${temp_root}/ref.json"
  tag_json="${temp_root}/tag.json"
  downloaded_asset="${temp_root}/asset.zip"
  downloaded_tag_archive="${temp_root}/tag-archive.tar.gz"
  fixture="${AIDLC_SOURCE_FIXTURE_DIR:-}"
  if [[ -n "${fixture}" ]]; then
    for file in release.json ref.json tag.json asset.zip tag-archive.tar.gz; do
      [[ -f "${fixture}/${file}" ]] || { rm -rf "${temp_root}"; fail "official source unavailable: missing fixture ${file}"; }
    done
    cp "${fixture}/release.json" "${release_json}"
    cp "${fixture}/ref.json" "${ref_json}"
    cp "${fixture}/tag.json" "${tag_json}"
    cp "${fixture}/asset.zip" "${downloaded_asset}"
    cp "${fixture}/tag-archive.tar.gz" "${downloaded_tag_archive}"
  else
    command -v curl >/dev/null || { rm -rf "${temp_root}"; fail "official source unavailable: curl is required"; }
    api="https://api.github.com/repos/awslabs/aidlc-workflows"
    curl -fsSL --retry 2 --connect-timeout 15 "${api}/releases/tags/${release}" -o "${release_json}" || { rm -rf "${temp_root}"; fail "official source unavailable: release metadata"; }
    curl -fsSL --retry 2 --connect-timeout 15 "${api}/git/ref/tags/${release}" -o "${ref_json}" || { rm -rf "${temp_root}"; fail "official source unavailable: tag reference"; }
    curl -fsSL --retry 2 --connect-timeout 15 "${api}/git/tags/${tag_object}" -o "${tag_json}" || { rm -rf "${temp_root}"; fail "official source unavailable: annotated tag metadata"; }
  fi

  release_tag="$(jq -r '.tag_name // empty' "${release_json}")"
  live_release_url="$(jq -r '.html_url // empty' "${release_json}")"
  live_published_at="$(jq -r '.published_at // empty' "${release_json}")"
  asset_count="$(jq --arg name "${asset}" '[.assets[] | select(.name == $name)] | length' "${release_json}")"
  [[ "${release_tag}" == "${release}" && "${live_release_url}" == "${release_url}" && "${live_published_at}" == "${published_at}" && "${asset_count}" == 1 ]] || { rm -rf "${temp_root}"; fail "release metadata mismatch"; }
  live_asset_id="$(jq -r --arg name "${asset}" '.assets[] | select(.name == $name) | .id | tostring' "${release_json}")"
  live_asset_url="$(jq -r --arg name "${asset}" '.assets[] | select(.name == $name) | .browser_download_url' "${release_json}")"
  live_asset_digest="$(jq -r --arg name "${asset}" '.assets[] | select(.name == $name) | .digest // empty' "${release_json}")"
  [[ "${live_asset_id}" == "${asset_id}" && "${live_asset_url}" == "${asset_url}" ]] || { rm -rf "${temp_root}"; fail "release asset identity mismatch"; }
  [[ "${live_asset_digest}" == "sha256:${asset_sha256}" ]] || { rm -rf "${temp_root}"; fail "published asset digest mismatch"; }

  ref_type="$(jq -r '.object.type // empty' "${ref_json}")"
  ref_sha="$(jq -r '.object.sha // empty' "${ref_json}")"
  resolved_type="$(jq -r '.object.type // empty' "${tag_json}")"
  resolved_sha="$(jq -r '.object.sha // empty' "${tag_json}")"
  [[ "${ref_type}" == tag && "${ref_sha}" == "${tag_object}" && "${resolved_type}" == commit && "${resolved_sha}" == "${release_commit}" ]] || { rm -rf "${temp_root}"; fail "tag resolution mismatch"; }

  if [[ -z "${fixture}" ]]; then
    curl -fsSL --retry 2 --connect-timeout 15 --proto '=https' --tlsv1.2 "${asset_url}" -o "${downloaded_asset}" || { rm -rf "${temp_root}"; fail "official source unavailable: release asset"; }
    curl -fsSL --retry 2 --connect-timeout 15 --proto '=https' --tlsv1.2 "${source_repository}/archive/refs/tags/${release}.tar.gz" -o "${downloaded_tag_archive}" || { rm -rf "${temp_root}"; fail "official source unavailable: tag archive"; }
  fi
  [[ "$(sha256_file "${downloaded_asset}")" == "${asset_sha256}" ]] || { rm -rf "${temp_root}"; fail "downloaded asset digest mismatch"; }
  [[ "$(sha256_file "${downloaded_tag_archive}")" == "${tag_archive_sha256}" ]] || { rm -rf "${temp_root}"; fail "downloaded tag archive digest mismatch"; }

  entries="${temp_root}/entries"
  modes="${temp_root}/modes"
  expected_entries="${temp_root}/expected-entries"
  unzip -Z1 "${downloaded_asset}" > "${entries}" || { rm -rf "${temp_root}"; fail "official source extraction failed"; }
  unzip -Z -l "${downloaded_asset}" | sed '1,2d;$d' | awk '{print $1}' > "${modes}" || { rm -rf "${temp_root}"; fail "official source metadata inspection failed"; }
  [[ "$(wc -l < "${entries}" | tr -d '[:space:]')" == "$(wc -l < "${modes}" | tr -d '[:space:]')" ]] || { rm -rf "${temp_root}"; fail "unsupported official asset entry metadata"; }
  duplicate="$(LC_ALL=C sort "${entries}" | uniq -d | head -n 1)"
  [[ -z "${duplicate}" ]] || { rm -rf "${temp_root}"; fail "unsafe archive path: duplicate ${duplicate}"; }
  while IFS=$'\t' read -r entry entry_mode; do
    case "/${entry}/" in
      *'/../'*|//*|*\\*) rm -rf "${temp_root}"; fail "unsafe archive path: ${entry}" ;;
    esac
    case "${entry}:${entry_mode}" in
      */:d?????????|*[^/]:-?????????) ;;
      *) rm -rf "${temp_root}"; fail "unsupported official asset entry type: ${entry}" ;;
    esac
  done < <(paste "${entries}" "${modes}")
  awk '{ sub(/^[0-9a-f]+  /, ""); print; n=split($0, part, "/"); dir=""; for (i=1; i<n; i++) { dir=dir part[i] "/"; print dir } }' "${manifest_file}" | LC_ALL=C sort -u > "${expected_entries}"
  LC_ALL=C sort "${entries}" -o "${entries}"
  cmp -s "${entries}" "${expected_entries}" || { rm -rf "${temp_root}"; fail "official asset entry set mismatch"; }
  extract_root="${temp_root}/extract"
  mkdir "${extract_root}"
  unzip -qq "${downloaded_asset}" -d "${extract_root}" || { rm -rf "${temp_root}"; fail "official source extraction failed"; }
  non_regular="$(cd "${extract_root}" && find . ! -type d ! -type f -print -quit)"
  [[ -z "${non_regular}" ]] || { rm -rf "${temp_root}"; fail "unsafe archive payload entry: ${non_regular}"; }
  [[ -d "${extract_root}/aidlc-rules" ]] || { rm -rf "${temp_root}"; fail "official payload path set mismatch"; }
  if ! diff -u \
    <(cd "${extract_root}" && find aidlc-rules -type f -print | LC_ALL=C sort) \
    <(cd "${repo_root}/.aidlc" && find aidlc-rules -type f -print | LC_ALL=C sort) >/dev/null; then
    rm -rf "${temp_root}"
    fail "official payload path set mismatch"
  fi
  while IFS= read -r path; do
    cmp -s "${extract_root}/${path}" "${repo_root}/.aidlc/${path}" || { rm -rf "${temp_root}"; fail "official payload bytes mismatch: ${path}"; }
  done < <(cd "${extract_root}" && find aidlc-rules -type f -print | LC_ALL=C sort)
  rm -rf "${temp_root}"
  if [[ -n "${fixture}" ]]; then
    echo "AI-DLC controlled source fixture verification passed: ${release} (not a live authenticity claim)"
  else
    echo "AI-DLC live official-source verification passed: ${release}, asset ${asset_id} sha256 ${asset_sha256}, tag archive sha256 ${tag_archive_sha256}, commit ${release_commit}"
  fi
  exit 0
fi

echo "AI-DLC local integrity verification passed: ${release}, manifest ${expected_manifest_sha256}; source authenticity was not checked"
