"""Explicitly supplied, scoped attachment fixtures for local recovery bundles."""
import hashlib
import json
from pathlib import Path
import re
import uuid

from accounting_recovery import sql

WORKSPACE = Path(__file__).resolve().parents[1]
INPUT_ROOT = WORKSPACE / '.accounting-backup-inputs'
MAX_FILE = 10 * 1024 * 1024
MAX_TOTAL = 50 * 1024 * 1024


def canonical_uuid(value):
    if not isinstance(value, str) or str(uuid.UUID(value)) != value:
        raise ValueError('Attachment identifiers must be canonical UUID strings.')
    return value


def descriptors(value):
    if not isinstance(value, list) or len(value) > 100:
        raise ValueError('Attachment bundles support at most 100 files.')
    seen = set()
    total = 0
    for item in value:
        if not isinstance(item, dict) or set(item) != {'id','firmId','targetType','targetId','name','bytes','sha256'}:
            raise ValueError('Invalid attachment descriptor.')
        for field in ('id','firmId','targetId'): canonical_uuid(item[field])
        if item['id'] in seen: raise ValueError('Duplicate attachment ID.')
        seen.add(item['id'])
        if item['targetType'] not in ('document','bank_statement'):
            raise ValueError('Unsupported attachment target.')
        name = item['name']
        if not isinstance(name, str) or not 1 <= len(name) <= 255 or name in ('.','..') or any(c in name for c in '/\\:') or any(ord(c) < 32 or ord(c) == 127 for c in name):
            raise ValueError('Attachment names must be plain filenames.')
        if type(item['bytes']) is not int or not 0 < item['bytes'] <= MAX_FILE:
            raise ValueError('Attachment size must be between 1 byte and 10 MiB.')
        if not isinstance(item['sha256'], str) or not re.fullmatch(r'[0-9a-f]{64}', item['sha256']):
            raise ValueError('Invalid attachment checksum.')
        total += item['bytes']
    if total > MAX_TOTAL: raise ValueError('Attachments exceed the 50 MiB bundle limit.')
    return value


def check_targets(database, items):
    descriptors(items)
    registry = sql(database, "select to_regclass('public.paperwork_accounting_attachments') is not null;") == 't'
    for item in items:
        table = 'paperwork_business_documents' if item['targetType'] == 'document' else 'paperwork_bank_statements'
        # UUIDs are canonical before SQL construction; table is an internal enum.
        if sql(database, f"select exists(select 1 from public.{table} where firm_id='{item['firmId']}' and id='{item['targetId']}');") != 't':
            raise ValueError('Attachment target does not belong to the stated firm/database.')
        if registry:
            stored = sql(database, f"select jsonb_build_object('targetType',case when document_id is not null then 'document' else 'bank_statement' end,'targetId',coalesce(document_id,statement_id),'name',name,'bytes',bytes,'sha256',sha256) from public.paperwork_accounting_attachments where firm_id='{item['firmId']}' and id='{item['id']}';")
            expected = {k:item[k] for k in ('targetType','targetId','name','bytes','sha256')}
            if not stored or json.loads(stored) != expected:
                raise ValueError('Attachment does not match its registered metadata.')


def read_files(base, items):
    descriptors(items)
    if base.is_symlink() or base.resolve() != base.parent.resolve() / base.name or not base.is_dir():
        raise ValueError('Attachment files must be in a real bundle directory.')
    files = {}
    for item in items:
        path = base / (item['id'] + '.bin')
        if path.is_symlink() or not path.is_file() or path.resolve().parent != base.resolve():
            raise ValueError('Attachment file is missing, linked or outside its bundle.')
        if path.stat().st_size != item['bytes']:
            raise ValueError('Attachment integrity failed: size mismatch.')
        content = path.read_bytes()
        if len(content) != item['bytes'] or hashlib.sha256(content).hexdigest() != item['sha256']:
            raise ValueError('Attachment integrity failed: SHA256 mismatch.')
        files[item['id']] = content
    # Unexpected files could mean a missing descriptor: never silently omit them.
    if {p.name for p in base.iterdir()} != {i['id']+'.bin' for i in items}:
        raise ValueError('The attachment directory contains undeclared files.')
    return files


def load_input(identifier, database):
    if not isinstance(identifier, str) or not re.fullmatch(r'[0-9a-f]{32}', identifier):
        raise ValueError('Use an attachment input ID, not a path.')
    if INPUT_ROOT.is_symlink() or INPUT_ROOT.resolve() != WORKSPACE / '.accounting-backup-inputs':
        raise ValueError('Attachment inputs must stay in this workspace.')
    base = INPUT_ROOT / identifier
    index = base / 'index.json'
    if base.is_symlink() or base.resolve().parent != INPUT_ROOT or index.is_symlink() or not index.is_file() or index.stat().st_size > 1024 * 1024:
        raise ValueError('Attachment index is missing, linked or outside its bundle.')
    index_value = json.loads(index.read_text(encoding='utf-8'))
    if not isinstance(index_value, dict) or set(index_value) != {'version','attachments'} or type(index_value['version']) is not int or index_value['version'] != 1:
        raise ValueError('Unsupported attachment index.')
    items = descriptors(index_value['attachments'])
    check_targets(database, items)
    return items, read_files(base / 'files', items)
