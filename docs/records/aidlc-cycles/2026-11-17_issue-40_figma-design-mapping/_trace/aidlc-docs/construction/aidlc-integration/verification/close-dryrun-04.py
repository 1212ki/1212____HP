from pathlib import Path
import hashlib, shutil, subprocess, os, re
r=Path(__file__).resolve().parents[4]
s=Path('/Users/itsuki.matsumoto/claude-code/_scratch/codex-work/20261117-133000_1212hp-40-figma-design-mapping/close-dryrun')
fixture=s/'fixture'
a=r/'aidlc-docs'; copy=fixture/'aidlc-docs'
# Existence prevents accidental overwrite of a prior disposable result.
assert not fixture.exists(), 'use fresh fixture path'
shutil.copytree(a,copy)
state=(copy/'aidlc-state.md').read_text()
for key,value in [('Current Stage','Complete'),('Cycle Status','Complete'),('Approval Gate','None'),('Approval Status','Complete')]:
 state=re.sub(r'^- \*\*'+key+r'\*\*:.*$', '- **'+key+'**: '+value, state, flags=re.M)
(copy/'aidlc-state.md').write_text(state)
for path in (copy/'approvals').glob('*.md'):
 text=path.read_text()
 text=re.sub(r'^- \*\*Artifact absolute path\*\*: '+re.escape(str(r))+r'(/.*)$', lambda m:'- **Artifact absolute path**: '+str(fixture)+m.group(1),text,flags=re.M)
 path.write_text(text)
for stage,artifact,record in [('Code Generation Result','construction/aidlc-integration/code/code-generation-summary.md','04-code-generation-result-approval.md'),('Build/Test Result','construction/build-and-test/build-and-test-summary.md','05-build-test-result-approval.md')]:
 digest=hashlib.sha256((copy/artifact).read_bytes()).hexdigest()
 prompt=stage+' aidlc-docs/'+artifact+' '+digest+'\nReply with exactly one ASCII character: A=approve this exact artifact digest, B=request changes, X=other.'
 text='# SYNTHETIC FIXTURE ONLY — NOT OWNER EVIDENCE\n\n'
 for key,val in [('Record status','APPROVED'),('Stage',stage),('Artifact repository-relative path','aidlc-docs/'+artifact),('Artifact absolute path',str(copy/artifact)),('Artifact SHA-256',digest),('Approver','Dry-run fixture human placeholder'),('Prompt timestamp','2026-11-17T00:00:00+09:00')]:
  text+='- **'+key+'**: '+val+'\n'
 text+='- **Approval prompt**: |\n'+''.join('  '+line+'\n' for line in prompt.splitlines())
 text+='- **Response timestamp**: 2026-11-17T00:00:01+09:00\n- **Complete raw human response**: A\n- **Decision**: APPROVED — SYNTHETIC FIXTURE ONLY\n'
 (copy/'approvals'/record).write_text(text)
source=(r/'scripts/aidlc-cycle.sh').read_text().split('\ncommand="${1:-}"')[0]
# Keep actual functions verbatim; only add invocation before original CLI dispatch.
harness=s/'validate-close-ready.sh'
harness.write_text(source+'\nvalidate_close_ready\necho "validate_close_ready PASS (synthetic disposable fixture only; no close)"\n')
env=os.environ.copy();env['AIDLC_REPO_ROOT']=str(fixture)
p=subprocess.run(['bash',str(harness)],capture_output=True,text=True,env=env)
log=a/'construction/aidlc-integration/verification/close-dryrun-04.log'
log.write_text('method: verbatim functions before CLI dispatch; validate_close_ready only\nfixture: '+str(fixture)+'\nsource_sha256: '+hashlib.sha256((r/'scripts/aidlc-cycle.sh').read_bytes()).hexdigest()+'\n'+p.stdout+p.stderr+'exit_code: '+str(p.returncode)+'\n')
print(p.stdout+p.stderr);assert p.returncode==0
assert not (a/'approvals/04-code-generation-result-approval.md').exists()
assert not (a/'approvals/05-build-test-result-approval.md').exists()
assert '- **Cycle Status**: In Progress' in (a/'aidlc-state.md').read_text()
print('Real state and gate4/5 absence preserved; fixture retained for inspection.')
