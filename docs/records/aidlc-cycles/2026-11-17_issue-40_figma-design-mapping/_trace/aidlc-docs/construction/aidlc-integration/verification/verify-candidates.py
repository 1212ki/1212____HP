#!/usr/bin/env python3
"""Issue #40の文書候補を原典・承認計画・許可範囲と照合する。read-only。"""

import argparse
import hashlib
from pathlib import Path
import re
import subprocess


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check(condition, label):
    if not condition:
        raise SystemExit('FAIL: ' + label)
    print('PASS: ' + label)


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--promoted', action='store_true', help='昇格後のcanonicalとのbyte一致も照合する')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[4]
cycle = repo / 'aidlc-docs'
proposed = cycle / 'construction/aidlc-integration/proposed'
context = repo.parent.parent
sources = context / '_scratch/codex-work/20261117-133000_1212hp-40-figma-design-mapping'
base = '00cdea5e69d5b341fc0a2b21a4eece9a53c8a2cd'


def git(*arguments):
    return subprocess.check_output(['git', '-C', str(repo), *arguments])


check(git('rev-parse', 'HEAD').decode().strip() == base, 'HEADが指定baseと一致')
check(git('symbolic-ref', '--short', 'HEAD').decode().strip() == 'feature/40-figma-design-mapping', '指定branch')
home_path = sources / 'figma-snapshot/page-0-1_master-home.md'
admin_path = sources / 'figma-snapshot/page-1-2_master-admin.md'
check(digest(home_path) == 'ed3e3cca558c4c164adf85d10cbb2cc48b9019f69e7b343f7e0292b83ea1fe54', '公開snapshot SHA-256')
check(digest(admin_path) == '0465fba06e455f4951f2b6568c32bcd4739ebc909d6d10f711170f1a9627466d', '管理snapshot SHA-256')
home = home_path.read_text()
admin_source = admin_path.read_text()
delta_path = sources / 'figma-snapshot/delta-02_front-fixes-FF40.md'
front_path = sources / 'front-figma-changes.md'
check(digest(delta_path) == '3631e5951febb9e21aa8f5329148d32742b96ce5f0f35fece6ff75c3694c6019', 'delta-02 SHA-256')
check(digest(front_path) == 'bd22667e9446f8e3d583e1261a2b9fdba0faf7e9def42876e779ccd1b02c5da6', '更新後のFront修正記録 SHA-256')
delta_rows = []
for line in delta_path.read_text().splitlines():
    if line.startswith('| FF40-'):
        fields = [value.strip() for value in line.strip('|').split('|')]
        check(len(fields) == 4, 'delta-02の修正行の構造')
        delta_rows.append((fields[0], re.search(r'`(\d+:\d+)`', fields[1]).group(1), fields[2], fields[3]))
check([(row[0], row[1]) for row in delta_rows] == [
    ('FF40-01', '24:185'), ('FF40-02', '117:300'), ('FF40-03', '29:366'),
    ('FF40-04', '39:839'), ('FF40-05', '39:842'), ('FF40-06', '39:833'),
    ('FF40-07', '39:833'), ('FF40-07', '45:586'),
], 'delta-02のFF40-01〜07を全8行受領')


def overlay(source, anchor, old, new, label):
    # snapshotはtext-node IDを省略するため、deltaのnodeを親見出しに対応させる。
    match = re.search(r'^#{3,4} (?:FRAME )?' + re.escape(anchor) + r' [^\n]*\n(.*?)(?=^#{3,4} |\Z)', source, re.M | re.S)
    check(match is not None and match.group(1).count(old) == 1, label + ': snapshotの親領域・旧原文を特定')
    body = match.group(1).replace(old, new, 1)
    return source[:match.start(1)] + body + source[match.end(1):]


for fix_id, node_id, current, previous in delta_rows:
    label = fix_id + ' / ' + node_id
    if fix_id == 'FF40-01':
        home = overlay(home, '24:179', previous, current, label)
    elif fix_id == 'FF40-02':
        home = overlay(home, '29:210', '- 下北沢DY CUBE\n', '- 下北沢DY CUBE\n- ' + current + '\n', label)
    elif fix_id == 'FF40-03':
        home = overlay(home, '29:364', previous, current, label)
    elif fix_id == 'FF40-04':
        admin_source = overlay(admin_source, '39:837', previous, current, label)
    elif fix_id == 'FF40-05':
        admin_source = overlay(admin_source, '39:840', previous, current, label)
    elif fix_id == 'FF40-06':
        old = current.split('幅1440pxでは', 1)[0]
        admin_source = overlay(admin_source, '39:831', old + '\n', current + '\n', label)
    elif node_id == '39:833':
        old = current.split('未対応の行には', 1)[0]
        admin_source = overlay(admin_source, '39:831', old + '\n', current + '\n', label)
    else:
        old = current.split('幅1440pxで予約の1件', 1)[0]
        admin_source = overlay(admin_source, '45:584', old + '\n', current + '\n', label)
    check(current in (home if fix_id in ('FF40-01', 'FF40-02', 'FF40-03') else admin_source), label + ': delta-02の修正後原文を優先適用')

nodes = {}
for source in (home, admin_source):
    for match in re.finditer(r'^(?:### FRAME|## SECTION|# PAGE) (\d+:\d+) (.+?)(?: \(\d+x\d+\))?$', source, re.M):
        nodes[match.group(1)] = match.group(2)
    for match in re.finditer(r'^#### (\d+:\d+) (.+)$', source, re.M):
        nodes[match.group(1)] = match.group(2)

public = (proposed / 'public-site-ui.md').read_text()
admin = (proposed / 'live-operations-admin-ui.md').read_text()
index = (proposed / 'README.md').read_text()
linked = 0
for name, content in [('public-site-ui.md', public), ('live-operations-admin-ui.md', admin)]:
    for node_id in re.findall(r'`(\d+:\d+)`', content):
        check(node_id in nodes, name + ': inline node ' + node_id)
    for match in re.finditer(r'\[([^\]]+)\]\(https://www\.figma\.com/design/82QH1c3hUrv1fKCd2AMULK/HP-itsukimatsumoto\?node-id=(\d+)-(\d+)\)', content):
        label, major, minor = match.groups()
        node_id = major + ':' + minor
        label = re.sub(r'\s+`\d+:\d+`$', '', label)
        check(nodes.get(node_id) == label, name + ': node名/URL ' + node_id + ' / ' + label)
        linked += 1
print('nodeリンク照合数: ' + str(linked))

public_frames = '23:36 24:43 39:850 27:104 27:148 28:141 29:133 28:182 29:167 28:233 29:210 30:169 30:198 30:220 30:335 31:247 31:294 31:336 31:370'.split()
admin_frames = '44:492 44:531 44:546 44:595 44:610 50:634 44:676 44:704 44:755 44:786 44:811 50:664 47:582 47:688 47:757 47:873 47:926 38:274 38:350 38:425 38:500 38:541 39:366 39:461 39:533 39:589 39:664'.split()
for name, content, heading, stop, frames, row_count in [
    ('公開', public, '## 3.', '## 4.', public_frames, 10),
    ('管理', admin, '## 15.', '### 15.1', admin_frames, 18),
]:
    mapping = content.split(heading, 1)[1].split(stop, 1)[0]
    for node_id in frames:
        check('node-id=' + node_id.replace(':', '-') + ')' in mapping, name + ': 対応表frame ' + node_id)
    rows = [line for line in mapping.splitlines() if line.startswith('| ') and re.search(r'\| (?:#\d|#41)', line)]
    check(len(rows) == row_count, name + ': 対応表の画面行数 ' + str(row_count))
    check(all('一部実装' in row or '未実装' in row or '実装済み' in row for row in rows), name + ': 全行に実装時点')
    check(all('受入条件ID' not in row and ('PS-' in row or 'ADM-' in row) for row in rows), name + ': 全行に受入条件ID')


def acceptance(source, node_id):
    match = re.search(r'^#### ' + re.escape(node_id) + r' 受入条件\n(.*?)(?=^#### |^### |\Z)', source, re.M | re.S)
    check(match is not None, '原典AC見出し ' + node_id)
    return [line[1:].strip() for line in match.group(1).splitlines() if line.startswith('・')]


for source, content, node_id, prefix, count in [
    (home, public, '25:100', 'PS-H', 6),
    (home, public, '29:364', 'PS-L', 8),
    (home, public, '30:506', 'PS-M', 4),
    (home, public, '31:460', 'PS-PC', 4),
    (admin_source, admin, '39:837', 'ADM-40', 7),
]:
    rows = re.findall(r'^\| (' + re.escape(prefix) + r'-\d\d) \| (.*?) \|', content, re.M)
    check(len(rows) == count, prefix + ': 項目数/一意性')
    expected = [(prefix + '-' + str(i + 1).zfill(2), value) for i, value in enumerate(acceptance(source, node_id))]
    check(rows == expected, prefix + ': 全項目の順序・ID・逐語一致')


def section(text, heading, sub=False):
    start = text.index(heading)
    pattern = r'^##(?:#)? ' if sub else r'^## '
    match = re.search(pattern, text[start + len(heading):], re.M)
    end = start + len(heading) + match.start() if match else len(text)
    return text[start:end].strip()


base_admin = git('show', base + ':docs/specs/current/live-operations-admin-ui.md').decode()
unchanged = [
    ('### 2.1 ', True), ('### 2.2 ', True),
    ('### 4.0 ', True), ('### 4.3 ', True), ('### 4.7 ', True),
    ('### 5.1 ', True), ('### 5.2 ', True),
    ('## 7. ', False), ('## 8. ', False), ('## 10. ', False),
    ('### 11.1 ', True), ('### 12.1 ', True), ('### 12.2 ', True),
    ('### 13.1 ', True), ('### 13.2 ', True),
]
for heading, sub in unchanged:
    check(section(base_admin, heading, sub) == section(admin, heading, sub), '管理の未変更節の文面保持 ' + heading.strip())

workflow = (cycle / 'inception/plans/execution-plan.md').read_text()
mapping = [
    ('Requirements', 'inception/requirements/requirements.md', 'approvals/01-requirements-approval.md'),
    ('Workflow Plan', 'inception/plans/execution-plan.md', 'approvals/02-workflow-plan-approval.md'),
    ('Code Generation Plan', 'construction/plans/aidlc-integration-code-generation-plan.md', 'approvals/03-code-generation-plan-approval.md'),
    ('Code Generation Result', 'construction/aidlc-integration/code/code-generation-summary.md', 'approvals/04-code-generation-result-approval.md'),
    ('Build/Test Result', 'construction/build-and-test/build-and-test-summary.md', 'approvals/05-build-test-result-approval.md'),
]
for stage, artifact, approval in mapping:
    exact = '- [x] REQUIRED|' + '|'.join((stage, artifact, approval))
    check(workflow.count('REQUIRED|' + stage + '|') == 1 and exact in workflow.splitlines(), '5 gate mapping ' + stage)
skip_lines = [line for line in workflow.splitlines() if 'SKIP|' in line]
check(len(skip_lines) == 9 and all(line.startswith('- [x] SKIP|') and len(line.split('|', 2)) == 3 and line.split('|', 2)[2].strip() for line in skip_lines), '9 SKIPがchecked・理由あり')
for folder in [cycle / 'inception/plans', cycle / 'construction/plans']:
    check(all(not re.search(r'^- \[ \]', path.read_text(), re.M) for path in folder.rglob('*.md')), str(folder.relative_to(repo)) + ': 未チェック行なし')

plan = (cycle / 'construction/plans/aidlc-integration-code-generation-plan.md').read_text()
for relative in ('inception/requirements/requirements.md', 'inception/plans/execution-plan.md'):
    artifact = cycle / relative
    check('| `' + str(artifact.relative_to(repo)) + '` | `' + digest(artifact) + '` |' in plan.splitlines(), 'planの入力SHA-256 ' + relative)
audit = (cycle / 'audit.md').read_text()
for path in (home_path, admin_path, delta_path, front_path):
    check(str(path) in audit and digest(path) in audit, 'auditに最新検証入力のpath/SHA-256 ' + path.name)
check('snapshotにdelta-02を優先適用' in plan, 'planと検証の原典優先順位が一致')
for name in ('public-site-ui.md', 'live-operations-admin-ui.md', 'README.md'):
    proposal = proposed / name
    target = 'docs/specs/current/' + name
    exact = '| `' + str(proposal.relative_to(repo)) + '` | `' + target + '` | `' + digest(proposal) + '` |'
    check(exact in plan.splitlines(), 'planの昇格先/SHA-256 ' + name)
    check('- Status: Approved' in proposal.read_text(), '昇格後Status ' + name)
    check('aidlc-docs/approvals/03-code-generation-plan-approval.md' in proposal.read_text() and '2026-11-17_issue-40_figma-design-mapping/_trace/aidlc-docs/approvals/03-code-generation-plan-approval.md' in proposal.read_text(), 'active/closed Owner承認参照 ' + name)
    if args.promoted:
        check((repo / target).read_bytes() == proposal.read_bytes(), '昇格byte一致 ' + name)
    elif name != 'public-site-ui.md':
        check((repo / target).read_bytes() == git('show', base + ':' + target), 'current未変更 ' + name)
    else:
        check(not (repo / target).exists(), 'current公開設計書を未作成')

if not args.promoted:
    state = (cycle / 'aidlc-state.md').read_text()
    check('- **Approval Gate**: Requirements' in state and '- **Approval Status**: Pending' in state and 'Requirements Analysis' in state, 'stateはRequirements承認待ち')
    check(not re.search(r'^- \[ \]', state, re.M), 'stateに未チェック行なし')
    check(not (cycle / 'approvals').exists() or not list((cycle / 'approvals').rglob('*.md')), '承認record未作成')
    for _, artifact, _ in mapping[3:]:
        check(not (cycle / artifact).exists(), '未実施の結果を作成していない ' + artifact)
issue_text = (sources / 'issue-40.md').read_text()
check('```markdown\n' + issue_text + '```' in (cycle / 'audit.md').read_text(), 'auditにIssue #40全文を逐語保存')
status = subprocess.run(['bash', 'scripts/aidlc-cycle.sh', 'status'], cwd=repo, capture_output=True, text=True)
check(status.returncode == 0 and '2026-11-17_issue-40_figma-design-mapping' in status.stdout, 'aidlc-cycle status成功')
print(status.stdout.strip())
allowed = {'docs/specs/current/' + name for name in ('public-site-ui.md', 'live-operations-admin-ui.md', 'README.md')} if args.promoted else set()
entries = git('status', '--porcelain=v1', '-z', '--untracked-files=all').decode().split('\0')
unexpected = [entry for entry in entries if entry and not entry[3:].startswith('aidlc-docs/') and entry[3:] not in allowed]
check(not unexpected, 'git statusで許可外repo変更なし: ' + repr(unexpected))
check(subprocess.run(['git', 'diff', '--check'], cwd=repo, capture_output=True).returncode == 0, 'git diff --check')
print('verification_result: PASS')
print('mode: ' + ('promoted' if args.promoted else 'candidate'))
print('scope: 文書候補・source照合のみ。visual/runtime・独立review・Owner承認の証明ではない。')
