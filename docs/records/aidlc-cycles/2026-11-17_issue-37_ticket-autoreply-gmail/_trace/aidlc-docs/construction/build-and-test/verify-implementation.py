"""planの逐語差分、承認digest、許可pathをread-onlyで照合する。"""
from pathlib import Path
import hashlib
import re
import subprocess

root = Path(__file__).resolve().parents[3]
plan_path = root / 'aidlc-docs/construction/plans/aidlc-integration-code-generation-plan.md'
plan = plan_path.read_text()
section = plan.split('## 2. canonical')[1].split('## 3. Apps Script')[0]
parts = re.split(r'### 2\.\d+ `([^`]+)`', section)
for index in range(1, len(parts), 2):
    path, body = parts[index:index + 2]
    expected = subprocess.check_output(['git', 'show', '218e2103ecaca0893cb63a9f4d7393b48e0c9f76:' + path], cwd=root, text=True)
    pairs = re.findall(r'変更前:\n```text\n(.*?)```\n\n変更後:\n```text\n(.*?)```', body, re.S)
    for old, new in pairs:
        assert expected.count(old) == 1, path
        expected = expected.replace(old, new, 1)
    assert (root / path).read_bytes() == expected.encode(), path
    print(f'PASS {path}: {len(pairs)} literal pairs; exact bytes')

assert '- Status: Approved\n' in (root / 'docs/specs/current/live-operations-admin-ui.md').read_text()
assert '| `live-operations-admin-ui.md` | Approved |' in (root / 'docs/specs/current/README.md').read_text()
code = re.search(r'## 3\. Apps Script.*?```javascript\n(.*?)```', plan, re.S)[1]
assert (root / 'cloudflare/worker/apps-script/ticket-autoreply.gs').read_bytes() == code.encode()
print('PASS Apps Script: plan §3 exact bytes')

for path, digest in [
    ('inception/requirements/requirements.md', '094eeeefe460e8329d9c9f2f31e07d8001a7db27078df10d10423ed0972ff833'),
    ('inception/plans/execution-plan.md', '891951401030004af9beaa60039a1780d12cc891b3a4b9594d51761dd913ab07'),
    ('construction/plans/aidlc-integration-code-generation-plan.md', 'de060fea8a26bc2f4267cfdca33303ddd758cb9116279e667e6f4dbfcf74cda1'),
]:
    assert hashlib.sha256((root / 'aidlc-docs' / path).read_bytes()).hexdigest() == digest
    print(f'PASS approved artifact: {path} {digest}')

assert sorted(p.name for p in (root / 'aidlc-docs/approvals').iterdir()) == [
    '01-requirements-approval.md', '02-workflow-plan-approval.md', '03-code-generation-plan-approval.md',
]
prompt = Path('/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-093619_1212hp-ticket-autoreply-gmail/gate-123-prompt.txt').read_text()
for record in (root / 'aidlc-docs/approvals').glob('*.md'):
    text = record.read_text()
    block = text.split('- **Approval prompt**: |\n')[1].split('- **Response timestamp**:')[0]
    assert ''.join(line[2:] + '\n' for line in block.splitlines()) == prompt
    assert '- **Complete raw human response**: A\n' in text
print('PASS approval prompt: all 3 exact source copies; raw response A; 04/05 absent')

allowed = set('''docs/specs/current/live-operations-admin-ui.md
docs/specs/current/README.md
cloudflare/worker/README.md
cloudflare/worker/wrangler.toml.example
cloudflare/worker/apps-script/ticket-autoreply.gs
cloudflare/worker/apps-script/README.md
cloudflare/worker/src/worker.js
ticket/index.html
ticket/complete/index.html
assets/js/ticket.js
admin/index.html
admin/app.js
cloudflare/worker/test/ticket-autoreply.test.js
cloudflare/worker/test/ticket-autoreply-apps-script.test.js
cloudflare/worker/test/public-ticket-boundaries.test.js
cloudflare/worker/test/manual-ticket-reservations.test.js
test/public-ticket-routing.test.mjs
test/admin-live-operations.test.mjs'''.splitlines())
changed = subprocess.check_output(['git', 'diff', '--name-only'], cwd=root, text=True).splitlines()
changed += subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard'], cwd=root, text=True).splitlines()
for path in changed:
    assert path.startswith('aidlc-docs/') or path in allowed, path
print('PASS changed paths: packet allowlist only')
