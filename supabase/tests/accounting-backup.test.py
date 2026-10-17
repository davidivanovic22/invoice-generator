"""Cold-process persistence/integrity/recovery checks on disposable local fixtures."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from unittest.mock import patch

WORKSPACE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(WORKSPACE / 'scripts'))
from accounting_backup import BACKUP_ROOT, new_id
import accounting_backup
from accounting_recovery import docker, fingerprint, validate_database

database = os.environ.get('RELATIONAL_TEST_DB', '')
validate_database(database)


def command(action, *args, succeed=True):
    result = subprocess.run([sys.executable, str(WORKSPACE/'scripts/accounting_backup.py'), action, *args],
                            cwd=WORKSPACE, capture_output=True, text=True, encoding='utf-8')
    assert (result.returncode == 0) == succeed, result.stderr
    return result


def databases():
    result = docker('psql','-X','-qAt','-U','postgres','-d','postgres',
                    data=b"select datname from pg_database where datname ~ '^paperwork_relational_[0-9]+$' order by datname;")
    return set(result.stdout.decode().splitlines())


original = fingerprint(database)
created = command('create', '--database', database)
identifier = re.search(r'Saved local backup: (\S+)', created.stdout)[1]
backup = BACKUP_ROOT / identifier
assert backup.resolve().parent == BACKUP_ROOT.resolve()
manifest = json.loads((backup/'manifest.json').read_text())
assert manifest['fingerprints'] == original
assert not (BACKUP_ROOT/('.partial-'+identifier)).exists()
# Each CLI invocation starts a new process and reads persisted disk files.
command('verify', '--backup', identifier)

# A write failure must never publish a complete-looking backup. Existing IDs
# must never replace a previously saved archive/manifest.
partial_id = new_id()
write_new = accounting_backup.write_new
def fail_manifest(path, contents):
    if path.name == 'manifest.json': raise OSError('Simulated disk write failure')
    write_new(path, contents)
with patch.object(accounting_backup,'new_id',return_value=partial_id), patch.object(accounting_backup,'write_new',side_effect=fail_manifest):
    try: accounting_backup.create(database)
    except OSError: pass
    else: raise AssertionError('Failed manifest write unexpectedly succeeded.')
assert not (BACKUP_ROOT/partial_id).exists()
assert (BACKUP_ROOT/('.partial-'+partial_id)/'database.dump').exists()
command('verify','--backup',partial_id,succeed=False)
with patch.object(accounting_backup,'new_id',return_value=identifier):
    try: accounting_backup.create(database)
    except ValueError: pass
    else: raise AssertionError('Existing backup ID was reused.')
restored = command('restore', '--backup', identifier)
destination = re.search(r'Restored disposable database: (paperwork_relational_\d+)', restored.stdout)[1]
assert destination != database and fingerprint(destination) == original
reports = list((backup/'restores').glob('*.json'))
assert len(reports) == 1
report = json.loads(reports[0].read_text())
assert report['status'] == 'verified' and report['destination'] == destination and report['seconds'] >= 0
assert report['sha256'] == manifest['sha256']
command('verify', '--backup', identifier)


def clone():
    identity = new_id()
    target = BACKUP_ROOT/identity
    assert target.resolve().parent == BACKUP_ROOT.resolve() and not target.exists()
    shutil.copytree(backup, target)
    info = json.loads((target/'manifest.json').read_text())
    info['id'] = identity
    (target/'manifest.json').write_text(json.dumps(info), encoding='utf-8')
    return identity, target, info


def refuse_before_database(identity):
    before = databases()
    command('verify','--backup',identity,succeed=False)
    command('restore','--backup',identity,succeed=False)
    assert databases() == before, 'Integrity failure created a database.'


# Different corruption modes, including same-sized byte changes.
for mode in ('truncated','bitflip','missing','version','wrong_id','missing_fingerprints'):
    identity, target, info = clone()
    path = target/'database.dump'
    if mode == 'truncated': path.write_bytes(path.read_bytes()[:1000])
    elif mode == 'bitflip':
        archive = bytearray(path.read_bytes()); archive[-1] ^= 1; path.write_bytes(archive)
    elif mode == 'missing': path.unlink()
    else:
        if mode == 'version': info['version'] = True
        elif mode == 'wrong_id': info['id'] = identifier
        else: info['fingerprints'] = {}
        (target/'manifest.json').write_text(json.dumps(info), encoding='utf-8')
    refuse_before_database(identity)

before = databases()
command('create','--database','postgres',succeed=False)
command('restore','--backup','../manifest.json',succeed=False)
assert databases() == before

# A readable archive with incorrect expected rows is NOT a verified recovery.
identity, target, info = clone()
table = next(name for name in info['fingerprints']['data'] if 'rows' in info['fingerprints']['data'][name])
info['fingerprints']['data'][table]['rows'] += 1
(target/'manifest.json').write_text(json.dumps(info), encoding='utf-8')
command('restore','--backup',identity,succeed=False)
failed_reports = [json.loads(path.read_text()) for path in (target/'restores').glob('*.json')]
assert any(r['status'] == 'failed' and r['backupId'] == identity for r in failed_reports)

assert fingerprint(database) == original, 'Persistent backup/recovery changed the source database.'
assert json.loads((backup/'manifest.json').read_text()) == manifest, 'Original manifest was overwritten.'
command('verify','--backup',identifier)
print('PASS: persisted custom archive + manifest, cold-process verify/restore, exact fingerprints and durable recovery report; failed writes not published, existing backup protected; corruption/missing files/invalid manifests/unsafe names rejected before database creation; fingerprint mismatch recorded as failed; source and original backup unchanged.')
print(f'Persistent local test backup: {identifier}')
print(f'Restored persisted-backup database: {destination}')
