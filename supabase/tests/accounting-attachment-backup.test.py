"""Scoped file bundles and cold-process recovery, disposable fixtures only."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import uuid
from unittest.mock import patch

WORKSPACE=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(WORKSPACE/'scripts'))
import accounting_backup
from accounting_backup import BACKUP_ROOT,new_id
from accounting_attachments import INPUT_ROOT
from accounting_recovery import docker,sql,fingerprint,validate_database

database=os.environ.get('RELATIONAL_TEST_DB','')
validate_database(database)


def command(action,*args,succeed=True):
    result=subprocess.run([sys.executable,str(WORKSPACE/'scripts/accounting_backup.py'),action,*args],cwd=WORKSPACE,capture_output=True,text=True,encoding='utf-8')
    assert (result.returncode==0)==succeed,result.stderr
    return result


def databases():
    return set(docker('psql','-X','-qAt','-U','postgres','-d','postgres',data=b"select datname from pg_database where datname ~ '^paperwork_relational_[0-9]+$';").stdout.decode().splitlines())


INPUT_ROOT.mkdir(exist_ok=True)
input_id=uuid.uuid4().hex
input_folder=INPUT_ROOT/input_id
input_folder.mkdir();(input_folder/'files').mkdir()
items=[];original_files={}
for table,kind,name,content in [('paperwork_business_documents','document','source-document.pdf',b'%PDF-1.4\nSynthetic recovery fixture\n%%EOF'),
                              ('paperwork_bank_statements','bank_statement','original-statement.txt',b'Bank statement fixture\r\n000001;100.01\r\n')]:
    target=json.loads(sql(database,f"select jsonb_build_object('firmId',firm_id,'targetId',id) from public.{table} order by id limit 1;"))
    identity=str(uuid.uuid4());original_files[identity]=content
    items.append(dict(id=identity,**target,targetType=kind,name=name,bytes=len(content),sha256=hashlib.sha256(content).hexdigest()))
    if sql(database,"select to_regclass('public.paperwork_accounting_attachments') is not null;") == 't':
        owner=sql(database,f"select user_id from paperwork_members where firm_id='{target['firmId']}' and role='owner' limit 1;")
        revision=sql(database,f"select revision from paperwork_business_documents where firm_id='{target['firmId']}' and id='{target['targetId']}';") if kind=='document' else None
        data={**items[-1],'bytes':str(len(content)),'targetRevision':revision,'externalReference':'Synthetic local recovery archive'}
        quoted=json.dumps(data).replace("'","''")
        sql(database,"select set_config('request.jwt.claims','"+json.dumps({'sub':owner})+"',false);set role authenticated;"+f"select paperwork_attachment_command('register','{quoted}'::jsonb,'{uuid.uuid4()}');")
    (input_folder/'files'/(identity+'.bin')).write_bytes(content)
(input_folder/'index.json').write_text(json.dumps({'version':1,'attachments':items}),encoding='utf-8')
before=fingerprint(database)
created=command('create','--database',database,'--attachments',input_id)
identifier=re.search(r'Saved local backup: (\S+)',created.stdout)[1]
backup=BACKUP_ROOT/identifier
manifest=json.loads((backup/'manifest.json').read_text())
assert manifest['version']==2 and manifest['attachments']==items
verified=command('verify','--backup',identifier)
assert 'Verified attachments: 2' in verified.stdout
restored=command('restore','--backup',identifier)
destination=re.search(r'Restored disposable database: (paperwork_relational_\d+)',restored.stdout)[1]
assert fingerprint(destination)==before
report=json.loads(next((backup/'restores').glob('*.json')).read_text())
assert report['status']=='verified' and report['attachmentCount']==2
recovered=backup/'restores'/report['attachmentDirectory']
assert json.loads((recovered/'attachments.json').read_text())['attachments']==items
for identity,content in original_files.items():assert (recovered/'attachments'/(identity+'.bin')).read_bytes()==content


def clone():
    identity=new_id();target=BACKUP_ROOT/identity
    assert target.resolve().parent==BACKUP_ROOT.resolve()
    shutil.copytree(backup,target)
    info=json.loads((target/'manifest.json').read_text());info['id']=identity
    (target/'manifest.json').write_text(json.dumps(info),encoding='utf-8')
    return identity,target,info


for mode in ('missing','changed','duplicate','path_name','bad_uuid','undeclared','oversized'):
    identity,target,info=clone();attachment=info['attachments'][0]
    file=target/'attachments'/(attachment['id']+'.bin')
    if mode=='missing':file.unlink()
    elif mode=='changed':file.write_bytes(b'X'*attachment['bytes'])
    elif mode=='undeclared':(target/'attachments'/'extra.bin').write_bytes(b'Unexpected')
    else:
        if mode=='duplicate':info['attachments'].append(attachment.copy())
        elif mode=='path_name':attachment['name']='../outside.pdf'
        elif mode=='bad_uuid':attachment['firmId']="not-a-uuid'"
        else:attachment['bytes']=11*1024*1024
        (target/'manifest.json').write_text(json.dumps(info),encoding='utf-8')
    existing=databases()
    command('restore','--backup',identity,succeed=False)
    assert databases()==existing,'Invalid file bundle created a database.'

# A valid file with the wrong firm/target must not become a published backup.
bad_input=uuid.uuid4().hex;bad=INPUT_ROOT/bad_input
shutil.copytree(input_folder,bad)
index=json.loads((bad/'index.json').read_text());index['attachments'][0]['firmId']=str(uuid.uuid4())
(bad/'index.json').write_text(json.dumps(index),encoding='utf-8')
existing_backups={p.name for p in BACKUP_ROOT.iterdir()}
command('create','--database',database,'--attachments',bad_input,succeed=False)
assert {p.name for p in BACKUP_ROOT.iterdir()}==existing_backups
command('create','--database',database,'--attachments','../Downloads',succeed=False)

if sql(database,"select to_regclass('public.paperwork_accounting_attachments') is not null;") == 't':
    # A valid target is insufficient: file descriptors must match the registry.
    mismatch=uuid.uuid4().hex;folder=INPUT_ROOT/mismatch;shutil.copytree(input_folder,folder)
    index=json.loads((folder/'index.json').read_text());index['attachments'][0]['name']='different-original.pdf'
    (folder/'index.json').write_text(json.dumps(index),encoding='utf-8')
    existing_backups={p.name for p in BACKUP_ROOT.iterdir()}
    command('create','--database',database,'--attachments',mismatch,succeed=False)
    assert {p.name for p in BACKUP_ROOT.iterdir()}==existing_backups
    identity,target,info=clone();info['attachments'][0]['name']='different-original.pdf'
    (target/'manifest.json').write_text(json.dumps(info),encoding='utf-8')
    command('restore','--backup',identity,succeed=False)
    assert any(json.loads(p.read_text())['status']=='failed' for p in (target/'restores').glob('*.json'))

# Fingerprints alone cannot authenticate altered sidecar links: scope is checked
# again in the restored database, and a mismatched link has a failed report.
identity,target,info=clone();info['attachments'][0]['firmId']=str(uuid.uuid4())
(target/'manifest.json').write_text(json.dumps(info),encoding='utf-8')
command('restore','--backup',identity,succeed=False)
assert any(json.loads(p.read_text())['status']=='failed' for p in (target/'restores').glob('*.json'))

# A file-system error after SQL recovery must never publish a verified recovery.
write_new=accounting_backup.write_new
def fail_recovery_file(path,content):
    if path.suffix=='.bin':raise OSError('Simulated recovery file write failure')
    write_new(path,content)
with patch.object(accounting_backup,'write_new',side_effect=fail_recovery_file):
    try:accounting_backup.restore(identifier)
    except OSError:pass
    else:raise AssertionError('Recovery file failure unexpectedly succeeded.')
reports=[json.loads(p.read_text()) for p in (backup/'restores').glob('*.json')]
assert any(r['status']=='failed' for r in reports)
assert fingerprint(database)==before
assert all((input_folder/'files'/(i+'.bin')).read_bytes()==c for i,c in original_files.items())
print('PASS: persisted SQL + scoped document/statement attachment bundles; cold-process recovery preserves files/names/links and SQL fingerprints; missing/changed/duplicate/unsafe/undeclared/oversized files rejected; cross-firm links and recovery write failures never verified; source files/database unchanged.')
print(f'Attachment test backup: {identifier}')
print(f'Restored attachment-backup database: {destination}')
