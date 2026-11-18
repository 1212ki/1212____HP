"""Run the approved local verification commands without installing dependencies."""
from pathlib import Path
import json
import os
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
env = os.environ.copy()
env['PATH'] = '/Users/itsuki.matsumoto/.nvm/versions/node/v20.19.4/bin:' + env['PATH']
commands = [
    ['node', '--test', 'test/'],
    ['npm', '--prefix', 'cloudflare/worker', 'test'],
    ['node', '--check', 'assets/js/site-content.js'],
    ['node', '--check', 'assets/js/home-player.js'],
    ['node', '--check', 'assets/js/script.js'],
    ['scripts/aidlc-verify.sh', '--local'],
    ['scripts/aidlc-cycle.sh', 'status'],
    ['git', 'diff', '--check'],
    ['git', 'status', '--short'],
]
results = []
for index, command in enumerate(commands, 1):
    result = subprocess.run(command, cwd=ROOT, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    log = OUT / f'{sys.argv[1]}-{index:02d}.log'
    log.write_text(result.stdout)
    counts = dict(re.findall(r'^# (tests|pass|fail) (\d+)$', result.stdout, re.M))
    row = dict(command=' '.join(command), exit=result.returncode, counts=counts, log=str(log.relative_to(ROOT)))
    results.append(row)
    print(row, flush=True)
(OUT / f'{sys.argv[1]}-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
sys.exit(int(any(row['exit'] != 0 for row in results)))
