"""Full SQL backup/restore rehearsal; only disposable local regression databases.

RELATIONAL_TEST_DB=paperwork_relational_<digits> python supabase/tests/accounting-restore.test.py
Retains fresh restored databases for inspection. Never overwrites an existing database.
This tests database restoration, not storage objects, hosted auth or production recovery.
"""
import hashlib
import json
import os
import re
import time
import uuid

CONTAINER = 'supabase_db_invoice-generator'
source = os.environ.get('RELATIONAL_TEST_DB', '')
if not re.fullmatch(r'paperwork_relational_\d+', source):
    raise SystemExit('Only an explicitly selected disposable local regression database is allowed.')


from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from accounting_recovery import docker, sql, fingerprint, restore as restore_archive

def restore(database, archive, allow_failure=False):
    return restore_archive(database, archive, allow_failure, source_database=source)


assert sql(source, "select to_regclass('public.paperwork_payment_ledger_requests') is not null;") == 't', 'Apply all eight accounting migrations first.'
before = fingerprint(source)
assert before['data']['public.paperwork_payment_journals']['rows'] > 0, 'Posted payment fixtures are required.'
archive = docker('pg_dump', '-U', 'postgres', '-d', source, '--format=custom', '--no-owner').stdout
assert archive.startswith(b'PGDMP') and len(archive) > 1000
checksum = hashlib.sha256(archive).hexdigest()
destination = 'paperwork_relational_' + str(time.time_ns())
restore(destination, archive)
after = fingerprint(destination)
assert before['data'] == after['data'], 'Restored rows or sequence states differ.'
assert before['metadata'] == after['metadata'], 'Restored schema, permissions, RLS or triggers differ.'

# Real authenticated reads and idempotent bank-post replay still work after restore.
fixture = json.loads(sql(destination, """
select jsonb_build_object('owner',m.user_id,'key',r.request_key,'data',jsonb_build_object(
 'firmId',b.firm_id,'transactionId',b.transaction_id,'journalId',b.journal_id,
 'fiscalYearId',j.fiscal_year_id,'periodId',j.period_id,'postingDate',j.posting_date::text,
 'bankAccountId',b.bank_account_id,'clearingAccountId',b.clearing_account_id))
from paperwork_bank_journals b join paperwork_journals j on j.firm_id=b.firm_id and j.id=b.journal_id
join paperwork_payment_ledger_requests r on r.firm_id=b.firm_id and r.journal_id=b.journal_id and r.allocation_id is null
join paperwork_members m on m.firm_id=b.firm_id and m.role='owner' order by r.request_key limit 1;
"""))


def as_user(database, user, statement):
    claims = json.dumps({'sub': user}).replace("'", "''")
    return sql(database, f"select set_config('request.jwt.claims','{claims}',false); set role authenticated;" + statement).splitlines()[-1]


firm, transaction = fixture['data']['firmId'], fixture['data']['transactionId']
read = f"select paperwork_payment_workbench('{firm}','{transaction}');"
assert json.loads(as_user(source, fixture['owner'], read)) == json.loads(as_user(destination, fixture['owner'], read))
payload = json.dumps(fixture['data']).replace("'", "''")
key = fixture['key'].replace("'", "''")
receipt = json.loads(as_user(destination, fixture['owner'], f"select paperwork_payment_ledger_command('bank','{payload}'::jsonb,'{key}');"))
assert receipt['journalId'] == fixture['data']['journalId'] and receipt['allocationId'] is None
assert fingerprint(destination)['data'] == before['data'], 'Replay changed restored data.'
if sql(destination,"select to_regclass('public.paperwork_fx_bank_links') is not null;")=='t':
    fx_fixture=json.loads(sql(destination,"""
    select jsonb_build_object('owner',l.created_by,'key',l.request_key,'statement',sl.statement_id,
    'data',jsonb_build_object('firmId',l.firm_id,'transactionId',l.transaction_id,'settlementId',l.settlement_id))
    from paperwork_fx_bank_links l join paperwork_fx_bank_statement_lines sl
    on sl.firm_id=l.firm_id and sl.transaction_id=l.transaction_id order by l.created_at limit 1;
    """))
    fx_firm=fx_fixture['data']['firmId'];fx_read=f"select paperwork_fx_bank_reconciliation('{fx_firm}','{fx_fixture['statement']}');"
    assert json.loads(as_user(source,fx_fixture['owner'],fx_read))==json.loads(as_user(destination,fx_fixture['owner'],fx_read))
    fx_payload=json.dumps(fx_fixture['data']).replace("'","''");fx_key=fx_fixture['key'].replace("'","''")
    assert json.loads(as_user(destination,fx_fixture['owner'],f"select paperwork_link_fx_bank_payment('{fx_payload}'::jsonb,'{fx_key}');"))==fx_fixture['data']
    assert fingerprint(destination)['data']==before['data'],'FX link replay changed restored data.'
    print('PASS: restored FX statement snapshot/cancellation evidence and original link receipt replay without new journals or mutations.')
stranger = str(uuid.uuid4())
if sql(destination,"select to_regclass('public.paperwork_fx_bank_postings') is not null;")=='t':
    bank_fixture=json.loads(sql(destination,"""
    select jsonb_build_object('owner',b.created_by,'key',r.request_key,'data',jsonb_build_object(
    'firmId',b.firm_id,'transactionId',b.transaction_id,'expectedRevision','0','journalId',b.journal_id,
    'fiscalYearId',j.fiscal_year_id,'periodId',j.period_id,'postingDate',b.posting_date::text,'clearingAccountId',b.clearing_account_id,
    'rateMicros',b.rate_micros::text,'quoteUnits',b.quote_units::text,'rateDate',b.rate_date::text,'publishedOn',b.published_on::text,'rateSource',b.rate_source,'sourceReference',b.source_reference))
    from paperwork_fx_bank_postings b join paperwork_journals j on j.firm_id=b.firm_id and j.id=b.journal_id
    join paperwork_fx_bank_posting_requests r on r.firm_id=b.firm_id and r.journal_id=b.journal_id and r.revision=1 order by b.created_at limit 1;
    """))
    bd=bank_fixture['data'];bank_read=f"select paperwork_fx_bank_workbench('{bd['firmId']}','{bd['transactionId']}');"
    sw=json.loads(as_user(source,bank_fixture['owner'],bank_read));dw=json.loads(as_user(destination,bank_fixture['owner'],bank_read))
    sw['fx'].pop('generatedAt');dw['fx'].pop('generatedAt');assert sw==dw,'Restored bank allocation/fee/cancellation snapshot differs.'
    bank_payload=json.dumps(bd).replace("'","''");bank_key=bank_fixture['key'].replace("'","''")
    br=json.loads(as_user(destination,bank_fixture['owner'],f"select paperwork_fx_bank_posting_command('post','{bank_payload}'::jsonb,'{bank_key}');"))
    assert br['journalId']==bd['journalId'] and br['revision']=='1'
    assert fingerprint(destination)['data']==before['data'],'FX bank source replay changed restored data.'
    print('PASS: restored FX cash/clearing allocations, fees and dependency history; original bank source receipt replays without a second cash posting.')
if sql(destination,"select to_regclass('public.paperwork_stock_items') is not null;")=='t':
    stock_fixture=json.loads(sql(destination,"""
    select jsonb_build_object('owner',m.created_by,'key',r.request_key,'data',jsonb_strip_nulls(jsonb_build_object(
    'firmId',m.firm_id,'itemId',m.item_id,'expectedRevision',(m.sequence-1)::text,'journalId',m.id,
    'fiscalYearId',j.fiscal_year_id,'periodId',j.period_id,'postingDate',m.posting_date::text,
    'quantity',m.quantity::text,'value',m.value::text,'counterAccountId',m.counter_account_id,'partnerId',m.partner_id,'externalId',m.external_id)))
    from paperwork_stock_movements m join paperwork_journals j on j.firm_id=m.firm_id and j.id=m.id
    join paperwork_stock_requests r on r.firm_id=m.firm_id and r.journal_id=m.id where m.kind='receipt' order by m.created_at limit 1;
    """))
    sd=stock_fixture['data'];stock_read=f"select paperwork_stock_workspace('{sd['firmId']}');"
    assert json.loads(as_user(source,stock_fixture['owner'],stock_read))==json.loads(as_user(destination,stock_fixture['owner'],stock_read))
    stock_payload=json.dumps(sd).replace("'","''");stock_key=stock_fixture['key'].replace("'","''")
    sr=json.loads(as_user(destination,stock_fixture['owner'],f"select paperwork_stock_command('receipt','{stock_payload}'::jsonb,'{stock_key}');"))
    assert sr['journalId']==sd['journalId'] and sr['revision']==str(int(sd['expectedRevision'])+1)
    assert fingerprint(destination)['data']==before['data'],'Stock replay changed restored data.'
    print('PASS: restored stock quantities/valuation/cards/cancellations and original receipt replay without duplicate inventory or journals.')
if sql(destination,"select to_regclass('public.paperwork_opening_batches') is not null;")=='t':
    opening_fixture=json.loads(sql(destination,"""
    select jsonb_build_object('owner',b.created_by,'key',r.request_key,'data',jsonb_build_object(
     'firmId',b.firm_id,'batchId',b.id,'journalId',b.journal_id,'expectedRevision','0',
     'fiscalYearId',j.fiscal_year_id,'periodId',j.period_id,'postingDate',b.posting_date::text,
     'asOf',(b.posting_date-1)::text,'currency','RSD','sourceTaxId',b.source_tax_id,
     'sourceReference',b.source_reference,'fileName',b.file_name,'fileSha256',b.file_sha256,
     'balances',(select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('sourceAccount',s.source_account,'sourcePartner',s.source_partner,'accountId',s.account_id,'partnerId',s.partner_id,'debit',s.debit::text,'credit',s.credit::text)) order by s.row_no) from paperwork_opening_balances s where s.firm_id=b.firm_id and s.batch_id=b.id),
     'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'sourceAccount',s.source_account,'sourcePartner',s.source_partner,'externalId',i.external_id,'number',i.number,'documentDate',i.document_date::text,'dueDate',i.due_date::text,'direction',i.direction,'amount',i.amount::text) order by i.source_sequence) from paperwork_opening_items i join paperwork_opening_balances s on s.firm_id=i.firm_id and s.batch_id=i.batch_id and s.row_no=i.row_no where i.firm_id=b.firm_id and i.batch_id=b.id),'[]'::jsonb)))
    from paperwork_opening_batches b join paperwork_journals j on j.firm_id=b.firm_id and j.id=b.journal_id
    join paperwork_opening_requests r on r.firm_id=b.firm_id and r.batch_id=b.id and r.revision=1 and r.item_id is null order by b.created_at limit 1;
    """))
    od=opening_fixture['data'];opening_read=f"select paperwork_opening_workspace('{od['firmId']}');"
    assert json.loads(as_user(source,opening_fixture['owner'],opening_read))==json.loads(as_user(destination,opening_fixture['owner'],opening_read))
    opening_payload=json.dumps(od).replace("'","''");opening_key=opening_fixture['key'].replace("'","''")
    ore=json.loads(as_user(destination,opening_fixture['owner'],f"select paperwork_opening_command('import','{opening_payload}'::jsonb,'{opening_key}');"))
    assert ore['journalId']==od['journalId'] and ore['batchId']==od['batchId'] and ore['revision']=='1'
    assert fingerprint(destination)['data']==before['data'],'Opening replay changed restored data.'
    print('PASS: restored opening sources, item order, balances, existing payment/reversal evidence and original import receipt replay without duplicate initial turnover.')
if sql(destination,"select to_regclass('public.paperwork_tax_profiles') is not null;")=='t':
    tax_fixture=json.loads(sql(destination,"""
    select jsonb_build_object('owner',e.created_by,'key',r.request_key,'data',jsonb_build_object(
      'firmId',e.firm_id,'id',e.id,'expectedRevision',(r.revision-1)::text,'profileId',e.profile_id,
      'documentId',e.document_id,'documentRevision',e.document_revision::text,'fiscalYearId',e.fiscal_year_id,
      'periodId',e.period_id,'taxDate',e.tax_date::text,'policyId',e.policy_id,'evidence',e.evidence,'confirmedOrdinaryDomesticSupply',true,
      'lines',(select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('lineId',l.line_id,'category',l.category,
        'reducedPoint',l.reduced_point,'classificationEvidence',l.classification_evidence,'deductible',l.deductible::text,'deductionEvidence',l.deduction_evidence)) order by l.line_id)
        from paperwork_tax_event_lines l where l.firm_id=e.firm_id and l.event_id=e.id)))
    from paperwork_tax_events e join paperwork_tax_requests r on r.firm_id=e.firm_id and r.target_id=e.id and r.action='record'
    where (select count(*) from paperwork_tax_event_lines l where l.firm_id=e.firm_id and l.event_id=e.id)=1
    order by e.created_at limit 1;
    """))
    td=tax_fixture['data'];tax_read=f"select paperwork_tax_workspace('{td['firmId']}','{td['fiscalYearId']}');"
    assert json.loads(as_user(source,tax_fixture['owner'],tax_read))==json.loads(as_user(destination,tax_fixture['owner'],tax_read))
    tax_payload=json.dumps(td).replace("'","''");tax_key=tax_fixture['key'].replace("'","''")
    tr=json.loads(as_user(destination,tax_fixture['owner'],f"select paperwork_tax_command('record','{tax_payload}'::jsonb,'{tax_key}');"))
    assert tr['id']==td['id'] and tr['revision']==str(int(td['expectedRevision'])+1)
    assert fingerprint(destination)['data']==before['data'],'Tax replay changed restored rows.'
    assert as_user(destination,stranger,'select count(*) from paperwork_tax_events;')=='0'
    print('PASS: restored tax profiles, policy fingerprints, deductions/cancellation/source proof and original tax event replay without duplicate records or journals.')
if sql(destination,"select to_regclass('public.paperwork_tax_profile_endings') is not null;")=='t':
    ending_fixture=json.loads(sql(destination,"""
    select jsonb_build_object('owner',s.created_by,'key',r.request_key,'data',jsonb_build_object(
      'firmId',s.firm_id,'id',s.profile_id,'expectedRevision',(r.revision-1)::text,'endsOn',s.ends_on::text,'reason',s.reason))
    from paperwork_tax_profile_endings s join paperwork_tax_requests r on r.firm_id=s.firm_id and r.target_id=s.profile_id and r.action='end_profile'
    order by s.created_at limit 1;
    """))
    ed=ending_fixture['data'];ending_payload=json.dumps(ed).replace("'","''");ending_key=ending_fixture['key'].replace("'","''")
    er=json.loads(as_user(destination,ending_fixture['owner'],f"select paperwork_tax_command('end_profile','{ending_payload}'::jsonb,'{ending_key}');"))
    assert er['id']==ed['id'] and er['revision']==str(int(ed['expectedRevision'])+1)
    assert fingerprint(destination)['data']==before['data'],'Ending replay changed restored history.'
    assert as_user(destination,stranger,'select count(*) from paperwork_tax_profile_endings;')=='0'
    print('PASS: restored original profiles, dated ending author/reason and exact ending receipt replay without a second change.')
assert as_user(destination, stranger, 'select count(*) from paperwork_payment_journals;') == '0'
claims = json.dumps({'sub': stranger})
denied = docker('psql', '-X', '-qAt', '-U', 'postgres', '-d', destination, '-v', 'ON_ERROR_STOP=1',
                data=(f"select set_config('request.jwt.claims','{claims}',false);set role authenticated;" + read).encode(), allow_failure=True)
assert denied.returncode and b'ACCOUNTING_FORBIDDEN' in denied.stderr
owner_claims = json.dumps({'sub': fixture['owner']})
blocked_write = docker('psql', '-X', '-qAt', '-U', 'postgres', '-d', destination, '-v', 'ON_ERROR_STOP=1',
    data=(f"select set_config('request.jwt.claims','{owner_claims}',false);set role authenticated;delete from paperwork_payment_journals;").encode(), allow_failure=True)
assert blocked_write.returncode and b'permission denied' in blocked_write.stderr
blocked_change = docker('psql', '-X', '-qAt', '-U', 'postgres', '-d', destination, '-v', 'ON_ERROR_STOP=1',
    data=b'update paperwork_payment_journals set journal_id=journal_id;', allow_failure=True)
assert blocked_change.returncode and b'IMMUTABLE' in blocked_change.stderr

# A broken archive cannot leave a partially restored accounting schema.
broken_destination = 'paperwork_relational_' + str(time.time_ns())
failed = restore(broken_destination, archive[:len(archive)//2], allow_failure=True)
assert failed.returncode, 'A truncated archive unexpectedly restored.'
assert sql(broken_destination, "select count(*) from pg_tables where schemaname in ('public','auth');") == '0', 'Failed restore left partial tables.'
assert fingerprint(source) == before, 'Restore rehearsal changed the source fixture.'
print(f'PASS: SQL backup/restore preserves {len(before["data"])} table/sequence fingerprints, schema/indexes, grants, RLS, immutable triggers, exact rows, audit/receipts and replay; unauthorized read/write denied; truncated archive rolls back.')
print(f'Restored disposable database: {destination}')
print(f'Failed-restore disposable database: {broken_destination}')
print(f'Backup archive SHA256: {checksum}')
