#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/aidlc-test-lib.sh"
suite_root="$(new_test_root verifier)"
trap 'rm -rf "${suite_root}"' EXIT

verify_relative_archive() {
  local working_root="$1"
  local archive_path="$2"
  (
    cd "${working_root}"
    "${verify_command}" --archive "${archive_path}"
  )
}

# F4: exact manifest path set and bytes.
archive_base="${suite_root}/archive-base"
make_archive_fixture "${archive_base}"
mkdir "${archive_base}/child"
expect_success "F4 complete archive" "${verify_command}" --archive "${archive_base}"
expect_success "F3X1 physical absolute one trailing slash" "${verify_command}" --archive "${archive_base}/"
expect_success "F3X1 physical absolute repeated trailing slash" "${verify_command}" --archive "${archive_base}///"
expect_success "F3X1 physical absolute dot" "${verify_command}" --archive "${archive_base}/."
expect_success "F3X1 physical absolute repeated dot slash" "${verify_command}" --archive "${archive_base}/././"
expect_success "F3X1 physical absolute child dotdot" "${verify_command}" --archive "${archive_base}/child/.."
expect_success "F3X1 physical absolute child dotdot trailing slash" "${verify_command}" --archive "${archive_base}/child/../"
expect_success "F3X1 physical relative ordinary" verify_relative_archive "${suite_root}" "./archive-base"
expect_success "F3X1 physical relative one trailing slash" verify_relative_archive "${suite_root}" "./archive-base/"
expect_success "F3X1 physical relative repeated trailing slash" verify_relative_archive "${suite_root}" "./archive-base///"
expect_success "F3X1 physical relative dot" verify_relative_archive "${suite_root}" "./archive-base/."
expect_success "F3X1 physical relative repeated dot slash" verify_relative_archive "${suite_root}" "./archive-base/././"
expect_success "F3X1 physical relative child dotdot" verify_relative_archive "${suite_root}" "./archive-base/child/.."
expect_success "F3X1 physical relative child dotdot trailing slash" verify_relative_archive "${suite_root}" "./archive-base/child/../"

archive="${suite_root}/archive-missing"
cp -R "${archive_base}" "${archive}"
rm "${archive}/README.md"
expect_failure_contains "F4 missing listed file" "manifest path set" "${verify_command}" --archive "${archive}"

archive="${suite_root}/archive-changed"
cp -R "${archive_base}" "${archive}"
printf 'changed\n' >> "${archive}/README.md"
expect_failure_contains "F4 changed bytes" "digest mismatch" "${verify_command}" --archive "${archive}"

archive="${suite_root}/archive-extra"
cp -R "${archive_base}" "${archive}"
printf 'extra\n' > "${archive}/extra.md"
expect_failure_contains "F4 extra unlisted file" "manifest path set" "${verify_command}" --archive "${archive}"

archive="${suite_root}/archive-duplicate"
cp -R "${archive_base}" "${archive}"
head -n 1 "${archive}/manifest.sha256" >> "${archive}/manifest.sha256"
expect_failure_contains "F4 duplicate manifest entry" "duplicate manifest" "${verify_command}" --archive "${archive}"

archive="${suite_root}/archive-malformed"
cp -R "${archive_base}" "${archive}"
printf 'not-a-manifest-entry\n' >> "${archive}/manifest.sha256"
expect_failure_contains "F4 malformed manifest entry" "malformed manifest" "${verify_command}" --archive "${archive}"

archive="${suite_root}/archive-symlink"
cp -R "${archive_base}" "${archive}"
ln -s README.md "${archive}/linked.md"
expect_failure_contains "F4 symlink rejected" "non-regular" "${verify_command}" --archive "${archive}"

archive="${suite_root}/archive-root-symlink"
ln -s "${archive_base}" "${archive}"
expect_failure_contains "FX1 archive root symlink rejected" "archive root must be a physical directory" "${verify_command}" --archive "${archive}"
expect_failure_contains "F2X1 trailing-slash archive root symlink rejected" "archive root must be a physical directory" "${verify_command}" --archive "${archive}/"
expect_failure_contains "F3X2 symlink absolute repeated trailing slash rejected" "archive root must be a physical directory" "${verify_command}" --archive "${archive}///"
expect_failure_contains "F3X1 symlink absolute dot rejected" "archive root must be a physical directory" "${verify_command}" --archive "${archive}/."
expect_failure_contains "F3X2 symlink absolute repeated dot slash rejected" "archive root must be a physical directory" "${verify_command}" --archive "${archive}/././"
expect_failure_contains "F3X1 symlink absolute child dotdot rejected" "archive root must be a physical directory" "${verify_command}" --archive "${archive}/child/.."
expect_failure_contains "F3X2 symlink absolute child dotdot trailing slash rejected" "archive root must be a physical directory" "${verify_command}" --archive "${archive}/child/../"
expect_failure_contains "F3X2 symlink relative ordinary rejected" "archive root must be a physical directory" verify_relative_archive "${suite_root}" "./archive-root-symlink"
expect_failure_contains "F3X2 symlink relative one trailing slash rejected" "archive root must be a physical directory" verify_relative_archive "${suite_root}" "./archive-root-symlink/"
expect_failure_contains "F3X2 symlink relative repeated trailing slash rejected" "archive root must be a physical directory" verify_relative_archive "${suite_root}" "./archive-root-symlink///"
expect_failure_contains "F3X1 symlink relative dot rejected" "archive root must be a physical directory" verify_relative_archive "${suite_root}" "./archive-root-symlink/."
expect_failure_contains "F3X2 symlink relative repeated dot slash rejected" "archive root must be a physical directory" verify_relative_archive "${suite_root}" "./archive-root-symlink/././"
expect_failure_contains "F3X1 symlink relative child dotdot rejected" "archive root must be a physical directory" verify_relative_archive "${suite_root}" "./archive-root-symlink/child/.."
expect_failure_contains "F3X2 symlink relative child dotdot trailing slash rejected" "archive root must be a physical directory" verify_relative_archive "${suite_root}" "./archive-root-symlink/child/../"

local_root="${suite_root}/local-root-symlink"
mkdir -p \
  "${local_root}/docs/records/aidlc-cycles" \
  "${local_root}/docs/operations" \
  "${local_root}/docs/product" \
  "${local_root}/docs/records/aidlc-bootstrap" \
  "${local_root}/docs/records/decisions" \
  "${local_root}/scripts" \
  "${local_root}/aidlc-docs"
cp -R "${repo_source}/.aidlc" "${local_root}/.aidlc"
for path in \
  README.md \
  DESIGN_RULES.md \
  docs/DOCS_RULES.md \
  docs/README.md \
  docs/operations/AI_DLC_WORKFLOW.md \
  docs/product/README.md \
  docs/records/aidlc-cycles/README.md \
  docs/records/aidlc-bootstrap/README.md \
  docs/records/decisions/README.md \
  scripts/aidlc-cycle.sh \
  aidlc-docs/README.md; do
  printf '# fixture\n' > "${local_root}/${path}"
done
printf '# contributor fixture\n' > "${local_root}/AGENTS.md"
cp "${local_root}/AGENTS.md" "${local_root}/CLAUDE.md"
printf '# docs contributor fixture\n' > "${local_root}/docs/AGENTS.md"
cp "${local_root}/docs/AGENTS.md" "${local_root}/docs/CLAUDE.md"
external_archive="${suite_root}/local-external-archive"
make_archive_fixture "${external_archive}"
ln -s "${external_archive}" "${local_root}/docs/records/aidlc-cycles/2026-08-30_issue-1011_root-symlink"
expect_failure_contains "FX2 local discovery rejects matching archive root symlink" "archive root must be a physical directory" "${verify_command}" --local "${local_root}"

# F5: controlled official-source fixture; local integrity remains a distinct claim.
source_root="${suite_root}/source-root"
source_fixture="${suite_root}/source-fixture"
make_source_fixture "${source_root}" "${source_fixture}"

set +e
local_output="$("${verify_command}" --payload-only "${source_root}" 2>&1)"
local_status=$?
set -e
if [[ ${local_status} -eq 0 && "${local_output}" == *"source authenticity was not checked"* ]]; then
  record_success "F5 local integrity disclaims authenticity"
else
  record_failure "F5 local integrity disclaims authenticity" "exit=${local_status}, output=${local_output}"
fi

expect_success "F5 controlled source fixture" env AIDLC_SOURCE_FIXTURE_DIR="${source_fixture}" "${verify_command}" --source "${source_root}"

root="${suite_root}/source-malformed-tag-archive-digest"
fixture="${suite_root}/fixture-malformed-tag-archive-digest"
make_source_fixture "${root}" "${fixture}"
replace_literal "${root}/.aidlc/SOURCE.lock" "$(grep '^tag_archive_sha256=' "${root}/.aidlc/SOURCE.lock")" "tag_archive_sha256=not-a-sha256"
expect_failure_contains "F-02-03 malformed tag archive digest" "invalid pinned digest" "${verify_command}" --payload-only "${root}"

root="${suite_root}/source-tag-archive-digest"
fixture="${suite_root}/fixture-tag-archive-digest"
make_source_fixture "${root}" "${fixture}"
printf 'tamper\n' >> "${fixture}/tag-archive.tar.gz"
expect_failure_contains "F-02-03 tag archive digest mismatch" "downloaded tag archive digest mismatch" env AIDLC_SOURCE_FIXTURE_DIR="${fixture}" "${verify_command}" --source "${root}"

root="${suite_root}/source-metadata"
fixture="${suite_root}/fixture-metadata"
make_source_fixture "${root}" "${fixture}"
replace_literal "${fixture}/release.json" '"tag_name": "v1.0.1"' '"tag_name": "v9.9.9"'
expect_failure_contains "F5 release metadata mismatch" "release metadata mismatch" env AIDLC_SOURCE_FIXTURE_DIR="${fixture}" "${verify_command}" --source "${root}"

root="${suite_root}/source-tag"
fixture="${suite_root}/fixture-tag"
make_source_fixture "${root}" "${fixture}"
replace_literal "${fixture}/tag.json" "e49341dbeb8af82758dd85e96ed7fe9bcf38a447" "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
expect_failure_contains "F5 tag commit mismatch" "tag resolution mismatch" env AIDLC_SOURCE_FIXTURE_DIR="${fixture}" "${verify_command}" --source "${root}"

root="${suite_root}/source-digest"
fixture="${suite_root}/fixture-digest"
make_source_fixture "${root}" "${fixture}"
printf 'tamper\n' >> "${fixture}/asset.zip"
expect_failure_contains "F5 downloaded digest mismatch" "downloaded asset digest mismatch" env AIDLC_SOURCE_FIXTURE_DIR="${fixture}" "${verify_command}" --source "${root}"

root="${suite_root}/source-missing"
fixture="${suite_root}/fixture-missing"
make_source_fixture "${root}" "${fixture}"
rm "${fixture}/payload/aidlc-rules/aws-aidlc-rule-details/detail.md"
rm "${fixture}/asset.zip"
replace_literal "${root}/.aidlc/SOURCE.lock" "$(grep '^asset_sha256=' "${root}/.aidlc/SOURCE.lock")" "asset_sha256=PLACEHOLDER"
replace_literal "${fixture}/release.json" "$(grep -o 'sha256:[0-9a-f]*' "${fixture}/release.json")" "sha256:PLACEHOLDER"
refresh_source_asset "${root}" "${fixture}"
expect_failure_contains "F5 missing official payload file" "official asset entry set mismatch" env AIDLC_SOURCE_FIXTURE_DIR="${fixture}" "${verify_command}" --source "${root}"

root="${suite_root}/source-extra"
fixture="${suite_root}/fixture-extra"
make_source_fixture "${root}" "${fixture}"
printf 'extra\n' > "${fixture}/payload/aidlc-rules/extra.md"
rm "${fixture}/asset.zip"
replace_literal "${root}/.aidlc/SOURCE.lock" "$(grep '^asset_sha256=' "${root}/.aidlc/SOURCE.lock")" "asset_sha256=PLACEHOLDER"
replace_literal "${fixture}/release.json" "$(grep -o 'sha256:[0-9a-f]*' "${fixture}/release.json")" "sha256:PLACEHOLDER"
refresh_source_asset "${root}" "${fixture}"
expect_failure_contains "F5 extra official payload file" "official asset entry set mismatch" env AIDLC_SOURCE_FIXTURE_DIR="${fixture}" "${verify_command}" --source "${root}"

root="${suite_root}/source-root-extra"
fixture="${suite_root}/fixture-root-extra"
make_source_fixture "${root}" "${fixture}"
printf 'unexpected root bytes\n' > "${fixture}/payload/UNEXPECTED.txt"
rm "${fixture}/asset.zip"
replace_literal "${root}/.aidlc/SOURCE.lock" "$(grep '^asset_sha256=' "${root}/.aidlc/SOURCE.lock")" "asset_sha256=PLACEHOLDER"
replace_literal "${fixture}/release.json" "$(grep -o 'sha256:[0-9a-f]*' "${fixture}/release.json")" "sha256:PLACEHOLDER"
(
  cd "${fixture}/payload"
  zip -qry "${fixture}/asset.zip" aidlc-rules UNEXPECTED.txt
)
digest="$(shasum -a 256 "${fixture}/asset.zip" | awk '{print $1}')"
replace_literal "${root}/.aidlc/SOURCE.lock" "asset_sha256=PLACEHOLDER" "asset_sha256=${digest}"
replace_literal "${fixture}/release.json" "sha256:PLACEHOLDER" "sha256:${digest}"
expect_failure_contains "F-02-01 unexpected ZIP-root regular file" "official asset entry set mismatch" env AIDLC_SOURCE_FIXTURE_DIR="${fixture}" "${verify_command}" --source "${root}"

root="${suite_root}/source-unsupported-symlink"
fixture="${suite_root}/fixture-unsupported-symlink"
make_source_fixture "${root}" "${fixture}"
rm "${fixture}/payload/aidlc-rules/aws-aidlc-rules/core-workflow.md" "${fixture}/asset.zip"
ln -s ../VERSION "${fixture}/payload/aidlc-rules/aws-aidlc-rules/core-workflow.md"
replace_literal "${root}/.aidlc/SOURCE.lock" "$(grep '^asset_sha256=' "${root}/.aidlc/SOURCE.lock")" "asset_sha256=PLACEHOLDER"
replace_literal "${fixture}/release.json" "$(grep -o 'sha256:[0-9a-f]*' "${fixture}/release.json")" "sha256:PLACEHOLDER"
refresh_source_asset "${root}" "${fixture}"
expect_failure_contains "F-02-01 unsupported ZIP symlink" "unsupported official asset entry type" env AIDLC_SOURCE_FIXTURE_DIR="${fixture}" "${verify_command}" --source "${root}"

root="${suite_root}/source-changed"
fixture="${suite_root}/fixture-changed"
make_source_fixture "${root}" "${fixture}"
printf 'changed\n' >> "${fixture}/payload/aidlc-rules/aws-aidlc-rules/core-workflow.md"
rm "${fixture}/asset.zip"
replace_literal "${root}/.aidlc/SOURCE.lock" "$(grep '^asset_sha256=' "${root}/.aidlc/SOURCE.lock")" "asset_sha256=PLACEHOLDER"
replace_literal "${fixture}/release.json" "$(grep -o 'sha256:[0-9a-f]*' "${fixture}/release.json")" "sha256:PLACEHOLDER"
refresh_source_asset "${root}" "${fixture}"
expect_failure_contains "F5 changed official payload bytes" "official payload bytes mismatch" env AIDLC_SOURCE_FIXTURE_DIR="${fixture}" "${verify_command}" --source "${root}"

root="${suite_root}/source-unavailable"
fixture="${suite_root}/fixture-unavailable"
make_source_fixture "${root}" "${fixture}"
rm "${fixture}/release.json"
expect_failure_contains "F5 source unavailable" "official source unavailable" env AIDLC_SOURCE_FIXTURE_DIR="${fixture}" "${verify_command}" --source "${root}"

root="${suite_root}/source-unsafe"
fixture="${suite_root}/fixture-unsafe"
make_source_fixture "${root}" "${fixture}"
python3 -c 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],"w"); z.writestr("../escape","bad"); z.close()' "${fixture}/asset.zip"
digest="$(shasum -a 256 "${fixture}/asset.zip" | awk '{print $1}')"
replace_literal "${root}/.aidlc/SOURCE.lock" "$(grep '^asset_sha256=' "${root}/.aidlc/SOURCE.lock")" "asset_sha256=${digest}"
replace_literal "${fixture}/release.json" "$(grep -o 'sha256:[0-9a-f]*' "${fixture}/release.json")" "sha256:${digest}"
expect_failure_contains "F5 unsafe archive path" "unsafe archive path" env AIDLC_SOURCE_FIXTURE_DIR="${fixture}" "${verify_command}" --source "${root}"

finish_tests "aidlc archive and source verifier"
