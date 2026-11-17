from pathlib import Path
import hashlib
import json
import re
import subprocess

r = Path.cwd()
scratch = Path('/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-160800_1212hp-41-data-fields')
v = r / 'aidlc-docs/construction/aidlc-integration/verification'
lines = []

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def git(*args):
    return subprocess.check_output(['git', *args], text=True)

assert sha(scratch / 'worker-02-result.md') == '9d371f65486b0b89dbf113a60d34ea62432f5428236120f39ff70f6d0e40f3f0'
assert sha(scratch / 'gate-123-prompt.md') == '39c28054399006ec035774940ced29eb967223b83071384a324c82848c135c34'
assert sha(scratch / 'gate-123-owner-responses.md') == 'e2d4266d8359f1e43b8e63c3e45eacc482231c9fb042604c68d938ffd2963d99'
prompt = (scratch / 'gate-123-prompt.md').read_bytes()
original = (scratch / 'worker-02-result.md').read_text()
records = sorted((r / 'aidlc-docs/approvals').glob('*.md'))
assert len(records) == 3
for p in records:
    text = p.read_text()
    assert re.search(re.escape(str(p)) + r'; SHA-256: ' + sha(p), original)
    body = text.split('- **Approval prompt**: |\n', 1)[1].split('- **Response timestamp**:', 1)[0]
    assert ''.join(line[2:] for line in body.splitlines(True)).encode() == prompt
    for field, value in [('Complete raw human response', 'A'), ('Approver', 'Itsuki Matsumoto'), ('Prompt timestamp', '2026-11-17T17:17:00+09:00'), ('Response timestamp', '2026-11-17T18:08:06+09:00')]:
        assert f'- **{field}**: {value}\n' in text
    rel = re.search(r'^- \*\*Artifact repository-relative path\*\*: (.+)$', text, re.M)[1]
    digest = re.search(r'^- \*\*Artifact SHA-256\*\*: (.+)$', text, re.M)[1]
    assert sha(r / rel) == digest
    lines.append(f'{p.relative_to(r)} SHA-256 {sha(p)} unchanged; exact prompt/response/identity/timestamps/artifact PASS')
for name, digest in [('live-operations-admin-ui.md', '43e4c9f407f26a8a6e2df8fe41636d7c714c03d9ebd83f2d339b5801b5767177'), ('public-site-ui.md', '8b886e4346c16eaec93ca4c5b76d13285d85c45255d38664ca3f778433bf58a6'), ('README.md', '6b48f3d983fb4e46073b5a28c29537508156a51a696ab3d448acf2654cc32ac7')]:
    current = r / 'docs/specs/current' / name
    proposed = r / 'aidlc-docs/construction/aidlc-integration/proposed' / name
    assert current.read_bytes() == proposed.read_bytes()
    assert sha(current) == digest
    lines.append(f'{current.relative_to(r)} SHA-256 {digest} plan/canonical/proposed byte match PASS')

allowed = {'docs/specs/current/live-operations-admin-ui.md', 'docs/specs/current/public-site-ui.md', 'docs/specs/current/README.md', 'assets/js/music-data.js', 'admin/index.html', 'admin/app.js', 'cloudflare/worker/src/worker.js', 'test/music-data.test.mjs', 'test/admin-live-operations.test.mjs', 'test/admin-image-form.test.mjs', 'test/public-music-data-compatibility.test.mjs', 'cloudflare/worker/test/music-data-fields.test.js', 'cloudflare/worker/test/og-live.test.js', 'admin/README.md', 'cloudflare/worker/README.md'}
tracked = git('diff', '--name-only').splitlines()
staged = git('diff', '--cached', '--name-only').splitlines()
untracked = git('ls-files', '--others', '--exclude-standard').splitlines()
paths = sorted(set(tracked + staged + untracked))
assert all(p in allowed or p.startswith('aidlc-docs/') for p in paths)
assert git('diff', '--check') == ''
assert '- **Approval Gate**: Code Generation Result\n' in (r / 'aidlc-docs/aidlc-state.md').read_text()
assert '- **Approval Status**: Pending\n' in (r / 'aidlc-docs/aidlc-state.md').read_text()
assert '- **Cycle Status**: In Progress\n' in (r / 'aidlc-docs/aidlc-state.md').read_text()
for rel in ['construction/aidlc-integration/code/code-generation-summary.md', 'construction/build-and-test/build-and-test-summary.md', 'cycle-summary.md']:
    p = r / 'aidlc-docs' / rel
    assert p.read_bytes() == (scratch / 'close-dryrun/aidlc-docs' / rel).read_bytes()
    lines.append(f'{p.relative_to(r)} SHA-256 {sha(p)} close copy byte match PASS')

data = json.loads((scratch / 'prod-data/public-site-data.json').read_text())
needles = set()
content_keys = {'title', 'description', 'performers', 'notes', 'sourceText', 'xComment', 'text'}
def visit(value, key='', path=''):
    if isinstance(value, dict):
        for k, child in value.items():
            visit(child, k, path + '/' + k)
    elif isinstance(value, list):
        for child in value:
            visit(child, key, path)
    elif isinstance(value, str) and (len(value) >= 20 or key in content_keys and len(value) >= 8):
        if path.startswith('/meta/'):
            return  # 取得時刻等は承認済み原典に保持されたprovenance。
        if path == '/data/site/heroImage':
            assert value in git('show', 'HEAD:cloudflare/worker/src/worker.js')
            return  # base実装の既定画像と同じ静的path。取得データ由来の本文ではない。
        needles.add(value)
visit(data)
added = '\n'.join(line[1:] for line in git('diff', '--unified=0').splitlines() if line.startswith('+') and not line.startswith('+++'))
texts = [added] + [(r / p).read_text() for p in untracked]
result = scratch / 'worker-02b-result.md'
if result.exists():
    texts.append(result.read_text())
hits = sum(1 for needle in needles if any(needle in text for text in texts))
assert hits == 0, f'production content matches: {hits}'
lines.append(f'Production content scan: {len(needles)} distinct strings; added lines + all untracked files + worker result (if present); hits {hits}; contents not logged')
lines.append('Excluded: metadata timestamps (approved provenance); site.heroImage (verified against base Worker default). Initial broad scan matched these 2 baseline/provenance values only; no content matches.')
lines.append('git diff --check: PASS; allowed scope PASS; real approval records 3 only; real state Pending/In Progress PASS')
status = git('status', '--short')
lines.append('git status --short:\n' + status)
(v / 'repair-git-status.log').write_text(status)
(v / 'repair-final-check.log').write_text('\n'.join(lines) + '\n')
print('\n'.join(lines))
