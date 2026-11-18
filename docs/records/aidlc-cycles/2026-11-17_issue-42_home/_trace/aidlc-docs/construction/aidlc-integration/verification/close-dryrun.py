"""Validate close formatting only, with hypothetical approvals confined to scratch.

Never invokes the close CLI or changes the real cycle's approval/state files.
"""
from pathlib import Path
from datetime import datetime
import hashlib
import os
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[4]
SCRATCH = Path('/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-223255_1212hp-42-home/close-dryrun')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    real = ROOT / 'aidlc-docs'
    state_digest = digest(real / 'aidlc-state.md')
    assert not list((real / 'approvals').glob('0[45]-*.md'))
    SCRATCH.mkdir(exist_ok=True)
    copy = Path(tempfile.mkdtemp(prefix='worker-02-format-', dir=SCRATCH))
    active = copy / 'aidlc-docs'
    shutil.copytree(real, active)
    for record in (active / 'approvals').glob('0[123]-*.md'):
        record.write_text(record.read_text().replace('- **Artifact absolute path**: ' + str(real), '- **Artifact absolute path**: ' + str(active)))
    for stage, artifact, record in [
        ('Code Generation Result', 'construction/aidlc-integration/code/code-generation-summary.md', '04-code-generation-result-approval.md'),
        ('Build/Test Result', 'construction/build-and-test/build-and-test-summary.md', '05-build-test-result-approval.md'),
    ]:
        value = digest(active / artifact)
        timestamp = datetime.now().astimezone().isoformat(timespec='seconds')
        prompt = f'DRY RUN ONLY: {stage}, aidlc-docs/{artifact}, SHA-256 {value}\nReply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other.'
        (active / 'approvals' / record).write_text(
            f'# DRY RUN ONLY — 仮の書式検査。本人承認ではない\n\n- **Record status**: APPROVED\n- **Stage**: {stage}\n'
            f'- **Artifact repository-relative path**: aidlc-docs/{artifact}\n- **Artifact absolute path**: {active / artifact}\n'
            f'- **Artifact SHA-256**: {value}\n- **Approver**: Dry-run fixture (not human approval)\n- **Prompt timestamp**: {timestamp}\n'
            '- **Approval prompt**: |\n' + ''.join('  ' + line + '\n' for line in prompt.splitlines()) +
            f'- **Response timestamp**: {timestamp}\n- **Complete raw human response**: A\n- **Decision**: APPROVED (HYPOTHETICAL FORMAT CHECK ONLY)\n')
    state = active / 'aidlc-state.md'
    lines = state.read_text().splitlines()
    for index, line in enumerate(lines):
        for field, value in [('Cycle Status', 'Complete'), ('Current Stage', 'Complete'), ('Approval Gate', 'None'), ('Approval Status', 'Complete')]:
            if line.startswith('- **' + field + '**:'):
                lines[index] = '- **' + field + '**: ' + value
    state.write_text('\n'.join(lines) + '\n')
    source = (ROOT / 'scripts/aidlc-cycle.sh').read_text().split('command="${1:-}"')[0]
    functions = copy / 'validator-functions.sh'
    functions.write_text(source)
    env = os.environ.copy()
    env['AIDLC_REPO_ROOT'] = str(copy)
    result = subprocess.run(['bash', '-c', 'source "$1"\nvalidate_close_ready\necho "PASS validate_close_ready (disposable formatting copy only)"\n', 'format-check', str(functions)], cwd=ROOT, env=env, text=True, capture_output=True)
    (copy / 'validation.log').write_text(result.stdout + result.stderr)
    assert digest(real / 'aidlc-state.md') == state_digest
    assert not list((real / 'approvals').glob('0[45]-*.md'))
    print('Disposable copy:', copy)
    print(result.stdout + result.stderr, end='')
    print('Real state unchanged; real gate 4/5 records absent; close command never invoked.')
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
