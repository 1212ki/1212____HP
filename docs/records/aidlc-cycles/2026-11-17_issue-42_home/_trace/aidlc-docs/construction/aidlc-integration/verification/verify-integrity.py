"""Read-only scope, approved bytes, non-Home protection and data-contamination checks."""
from pathlib import Path
import ast
import hashlib
import json
import re
import subprocess
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
SCRATCH = Path('/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-223255_1212hp-42-home')
BASE = 'c26641815502d7d7fc64c0f00eed6cd0f35ced33'
HTML = ['index.html', 'live/index.html', 'live/detail/index.html', 'ticket/index.html', 'ticket/complete/index.html', 'discography/index.html', 'youtube/index.html', 'profile/index.html', 'contact/index.html']
ALLOWED = HTML + ['assets/css/style.css', 'assets/js/site-content.js', 'assets/js/home-player.js', 'assets/js/script.js', 'admin/index.html', 'admin/README.md', 'test/home-rendering.test.mjs', 'test/home-player.test.mjs', 'test/site-shell.test.mjs', 'test/public-music-data-compatibility.test.mjs', 'test/fixtures/home-states.json']
PROMOTED = {
    'public-site-ui.md': '62f98fa71d78ba008b25219e57d574d58641ffdf8e8d3e69307c752ffafa9d14',
    'live-operations-admin-ui.md': '3d2bbcb5556b3cec861812836cc7f7c7cd81b0702fc80f6e5dbd9f8f3ac953a8',
    'README.md': '542d49ceb65c0aa5ba33ece3e9508d378cd009e1f7a5d9e40008083647467062',
}
APPROVED = {
    'inception/requirements/requirements.md': 'e84658d5a9b1a1f13787c0a87b972c3915c4d8ad4043dee69817133d319c66b6',
    'inception/plans/execution-plan.md': '7ec2f8c34c9b37e1e38a2195af8fdeef868ec833c2a63aaa529d54468fea404d',
    'construction/plans/aidlc-integration-code-generation-plan.md': '559a3e5111cb4392e62a4599dc5254503792f80429950002001ed78f86cf48e5',
    'construction/aidlc-integration/figma-fix-requests.md': 'b018bf75a86fb4063b113878ffa72ebb705864c55867f6c1baa934fc9ee791c4',
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check():
    for name, expected in PROMOTED.items():
        src = ROOT / 'aidlc-docs/construction/aidlc-integration/proposed' / name
        target = ROOT / 'docs/specs/current' / name
        assert digest(src) == digest(target) == expected
        assert subprocess.run(['cmp', '-s', str(src), str(target)]).returncode == 0
        print('PASS promotion SHA-256 + cmp -s:', name, expected)
    for relative, expected in APPROVED.items():
        assert digest(ROOT / 'aidlc-docs' / relative) == expected
        print('PASS immutable approved input:', relative)
    for record in (ROOT / 'aidlc-docs/approvals').glob('0[123]-*.md'):
        text = record.read_text()
        block = text.split('- **Approval prompt**: |\n')[1].split('- **Response timestamp**:')[0]
        prompt = '\n'.join(line[2:] for line in block.splitlines()) + '\n'
        assert prompt == (SCRATCH / 'gate-123-prompt.md').read_text()
        assert (SCRATCH / 'gate-123-owner-responses.md').read_text() in text
        print('PASS verbatim prompt + raw source:', record.name)
    for relative in HTML[1:]:
        before = (SCRATCH / 'worker-02-tmp/baseline' / relative).read_text()
        now = (ROOT / relative).read_text()
        assert re.search(r'<main\b[\s\S]*?</main>', before)[0] == re.search(r'<main\b[\s\S]*?</main>', now)[0]
        print('PASS pre-change main bytes:', relative)
    for relative in HTML:
        for source in re.findall(r'\b(?:src|href)="([^"]*)"', (ROOT / relative).read_text()):
            parsed = urlparse(source)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            path = ROOT / unquote(parsed.path.lstrip('/')) if parsed.path.startswith('/') else (ROOT / relative).parent / unquote(parsed.path)
            assert path.exists(), (relative, source)
    print('PASS all 9 HTML local href/src targets exist')
    status = subprocess.check_output(['git', 'status', '--short', '--untracked-files=all', '-z'], cwd=ROOT).decode()
    changed = [entry[3:] for entry in status.split('\0') if entry]
    allowed = set(ALLOWED + ['docs/specs/current/' + name for name in PROMOTED])
    assert all(path in allowed or path.startswith('aidlc-docs/') for path in changed), changed
    print('PASS allowed write scope:', len(changed), 'changed files')
    protected = ['assets/js/music-data.js', 'assets/js/live-operations.js', 'assets/js/site-config.js', 'assets/css/1212-music.tokens.css', 'DESIGN_RULES.md', 'admin/app.js', 'admin/style.css', 'cloudflare/']
    assert not subprocess.check_output(['git', 'diff', '--name-only', BASE, '--'] + protected, cwd=ROOT).strip()
    print('PASS protected helper/tokens/admin/Cloudflare byte identity to base (secret files not read)')
    # Compare only new content with significant production body fields. Never
    # print the values or copy the production payload into repo evidence.
    prod = json.loads((SCRATCH / 'prod-data/public-site-data-20261117T163802.json').read_text())
    prod = prod.get('data', prod)
    sensitive = set()
    def collect(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ['title', 'description', 'performers', 'text', 'notes'] and isinstance(child, str) and len(child.strip()) >= 12:
                    sensitive.add(child.strip())
                elif isinstance(child, (dict, list)):
                    collect(child)
        elif isinstance(value, list):
            for child in value:
                collect(child)
    collect(prod)
    scanned = []
    for relative in changed:
        path = ROOT / relative
        if not path.is_file() or path.suffix not in ['.md', '.js', '.mjs', '.json', '.html', '.py', '.log', '.css']:
            continue
        if relative.startswith('aidlc-docs/') and ('proposed/' in relative or relative.removeprefix('aidlc-docs/') in APPROVED):
            continue  # immutable approved inputs, not generated material
        content = path.read_text()
        if relative in ALLOWED and path.suffix != '.json':
            old = subprocess.run(['git', 'show', BASE + ':' + relative], cwd=ROOT, text=True, capture_output=True)
            if old.returncode == 0:
                old_lines = set(old.stdout.splitlines())
                content = '\n'.join(line for line in content.splitlines() if line not in old_lines)
        for value in sensitive:
            assert value not in content, 'Production body contamination: ' + relative
        scanned.append(relative)
    print('PASS production body absent from generated content:', len(scanned), 'files; values not logged')
    # Parsing does not produce __pycache__ or start a browser/server.
    for path in OUT.glob('*.py'):
        ast.parse(path.read_text(), filename=str(path))
    print('PASS Python verification/capture scripts parse')
    manifest_paths = ALLOWED + ['docs/specs/current/' + name for name in PROMOTED]
    (OUT / 'implementation-manifest.sha256').write_text(''.join(digest(ROOT / path) + '  ' + path + '\n' for path in sorted(manifest_paths)))
    print('PASS tested implementation manifest written')


if __name__ == '__main__':
    check()
