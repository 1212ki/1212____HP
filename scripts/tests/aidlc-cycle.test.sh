#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"${test_dir}/aidlc-1212hp-bootstrap.test.sh"
"${test_dir}/aidlc-approvals.test.sh"
"${test_dir}/aidlc-transaction.test.sh"
"${test_dir}/aidlc-verifier.test.sh"

echo "aidlc lifecycle suite passed"
