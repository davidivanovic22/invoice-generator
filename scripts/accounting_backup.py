"""Persistent, verified recovery artifacts for disposable local regression databases."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
import uuid

from accounting_recovery import docker, fingerprint, restore as restore_archive, sql, validate_database
from accounting_attachments import load_input, descriptors, read_files, check_targets

WORKSPACE = Path(__file__).resolve().parents[1]
BACKUP_ROOT = WORKSPACE / '.accounting-backups'
IDENTIFIER = re.compile(r'\d{8}T\d{6}Z-[0-9a-f]{32}')


def new_id():
    return datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def root(create=False):
    # Artifacts must stay in the ignored workspace folder, including symlink resolution.
    if BACKUP_ROOT.is_symlink() or BACKUP_ROOT.resolve() != WORKSPACE / '.accounting-backups':
        raise ValueError('The backup root must be a real directory inside this workspace.')
    if create:
        BACKUP_ROOT.mkdir(mode=0o700, exist_ok=True)
    if not BACKUP_ROOT.is_dir():
        raise ValueError('The local backup directory does not exist.')
    return BACKUP_ROOT


def folder(identifier):
    if not isinstance(identifier, str) or not IDENTIFIER.fullmatch(identifier):
        raise ValueError('Use a generated backup ID, not a path.')
    target = root() / identifier
    if target.is_symlink() or target.resolve().parent != root() or not target.is_dir():
        raise ValueError('The backup must be a real directory inside the backup root.')
    return target


def write_new(path, contents):
    # Exclusive creation prevents overwriting any existing artifact or report.
    with path.open('xb') as handle:
        handle.write(contents)
        handle.flush()
        os.fsync(handle.fileno())


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=True, sort_keys=True, indent=2) + '\n').encode()


def create(database, attachments=None):
    validate_database(database)
    if sql(database, "select to_regclass('public.paperwork_payment_ledger_requests') is not null;") != 't':
        raise ValueError('Prepare the disposable fixture with all eight accounting migrations first.')
    expected = fingerprint(database)
    items, files = load_input(attachments, database) if attachments else ([], {})
    archive = docker('pg_dump', '-U', 'postgres', '-d', database, '--format=custom', '--no-owner').stdout
    if not archive.startswith(b'PGDMP') or len(archive) < 1000:
        raise ValueError('The database dump is not a complete custom archive.')
    if fingerprint(database) != expected:
        raise ValueError('The source changed during backup. Create a new consistent copy.')
    identifier = new_id()
    target_root = root(create=True)
    published = target_root / identifier
    if published.exists() or published.is_symlink():
        raise ValueError('A backup with this ID already exists. Nothing was overwritten.')
    partial = target_root / ('.partial-' + identifier)
    partial.mkdir(mode=0o700)
    manifest = {'version': 2, 'id': identifier, 'database': database, 'createdAt': utc_now(),
                'format': 'postgres-custom', 'noOwner': True, 'bytes': len(archive),
                'sha256': hashlib.sha256(archive).hexdigest(), 'fingerprints': expected, 'attachments': items}
    write_new(partial / 'database.dump', archive)
    (partial / 'attachments').mkdir(mode=0o700)
    for attachment_id, content in files.items():
        write_new(partial / 'attachments' / (attachment_id+'.bin'), content)
    write_new(partial / 'manifest.json', json_bytes(manifest))
    # Only a completely written pair is published; failed writes remain .partial-*.
    partial.rename(published)
    return identifier


def verify(identifier):
    target = folder(identifier)
    manifest_path, archive_path = target / 'manifest.json', target / 'database.dump'
    for path in (manifest_path, archive_path):
        if path.is_symlink() or not path.is_file():
            raise ValueError('A backup file is missing, linked or not a regular file.')
    if manifest_path.stat().st_size > 16 * 1024 * 1024:
        raise ValueError('The manifest exceeds the supported size.')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    required = {'version','id','database','createdAt','format','noOwner','bytes','sha256','fingerprints'}
    if isinstance(manifest,dict) and type(manifest.get('version')) is int and manifest['version'] == 2:
        required.add('attachments')
    if not isinstance(manifest, dict) or set(manifest) != required:
        raise ValueError('The backup manifest has an invalid structure.')
    if type(manifest['version']) is not int or manifest['version'] not in (1,2) or manifest['id'] != identifier:
        raise ValueError('The manifest version or backup ID is invalid.')
    validate_database(manifest['database'])
    if manifest['format'] != 'postgres-custom' or manifest['noOwner'] is not True:
        raise ValueError('The backup uses an unsupported restore policy.')
    if not isinstance(manifest['createdAt'], str) or datetime.fromisoformat(manifest['createdAt']).utcoffset() is None:
        raise ValueError('The backup timestamp must include its timezone.')
    if type(manifest['bytes']) is not int or manifest['bytes'] < 1000:
        raise ValueError('The backup size is invalid.')
    if not isinstance(manifest['sha256'], str) or not re.fullmatch(r'[0-9a-f]{64}', manifest['sha256']):
        raise ValueError('The backup checksum is invalid.')
    expected = manifest['fingerprints']
    if not isinstance(expected, dict) or set(expected) != {'data','metadata'} or not isinstance(expected['data'], dict) or not expected['data'] or not isinstance(expected['metadata'], list) or not expected['metadata']:
        raise ValueError('The manifest must contain data and schema fingerprints.')
    archive = archive_path.read_bytes()
    if len(archive) != manifest['bytes'] or hashlib.sha256(archive).hexdigest() != manifest['sha256']:
        raise ValueError('Backup integrity failed: size or SHA256 mismatch. Nothing was restored.')
    files = read_files(target / 'attachments', descriptors(manifest['attachments'])) if manifest['version'] == 2 else {}
    if not archive.startswith(b'PGDMP') or docker('pg_restore', '--list', data=archive, allow_failure=True).returncode:
        raise ValueError('The backup is not a readable PostgreSQL custom archive.')
    return manifest, archive, files


def restore(identifier):
    # Verify files in a fresh invocation BEFORE creating a database. Restore these
    # exact verified bytes, so a later disk change cannot change this operation.
    manifest, archive, files = verify(identifier)
    destination = 'paperwork_relational_' + str(time.time_ns())
    reports = folder(identifier) / 'restores'
    if reports.is_symlink() or reports.resolve() != folder(identifier) / 'restores':
        raise ValueError('The recovery report directory must not be a link.')
    reports.mkdir(mode=0o700, exist_ok=True)
    recovery_id = new_id()
    report_path = reports / (recovery_id + '.json')
    started = time.monotonic()
    report = {'version':1,'backupId':identifier,'sha256':manifest['sha256'],
              'destination':destination,'startedAt':utc_now(),'status':'failed'}
    try:
        restore_archive(destination, archive, source_database=manifest['database'])
        actual = fingerprint(destination)
        if actual != manifest['fingerprints']:
            raise ValueError('Restored rows or schema differ from the saved fingerprints. Recovery is unverified.')
        items = manifest.get('attachments', [])
        check_targets(destination, items)
        if files:
            partial = reports / ('.partial-'+recovery_id)
            partial.mkdir(mode=0o700)
            (partial / 'attachments').mkdir(mode=0o700)
            for attachment_id, content in files.items():
                write_new(partial / 'attachments' / (attachment_id+'.bin'), content)
            write_new(partial / 'attachments.json', json_bytes({'version':1,'attachments':items}))
            read_files(partial / 'attachments', items)
            partial.rename(reports / recovery_id)
        report.update(status='verified', tablesAndSequences=len(actual['data']),attachmentCount=len(files),
                      attachmentDirectory=recovery_id if files else None)
    finally:
        report.update(finishedAt=utc_now(),seconds=round(time.monotonic()-started,3))
        write_new(report_path, json_bytes(report))
    return destination, report_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    create_parser = sub.add_parser('create')
    create_parser.add_argument('--database', required=True)
    create_parser.add_argument('--attachments', help='Explicit local attachment fixture input ID')
    for action in ('verify','restore'):
        sub.add_parser(action).add_argument('--backup', required=True)
    args = parser.parse_args()
    try:
        if args.action == 'create':
            identifier = create(args.database, args.attachments)
            print(f'Saved local backup: {identifier}')
            print(f'Backup directory: {folder(identifier)}')
        elif args.action == 'verify':
            manifest, _, files = verify(args.backup)
            print(f'PASS: saved backup size, SHA256, manifest and archive verified ({manifest["bytes"]} bytes).')
            print(f'Verified attachments: {len(files)}')
        else:
            destination, report_path = restore(args.backup)
            print(f'PASS: persisted SQL backup restored with matching rows, sequences and schema.')
            print(f'Restored disposable database: {destination}')
            print(f'Recovery report: {report_path}')
    except (ValueError, OSError, RuntimeError, TypeError) as error:
        print(f'Backup operation refused: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
