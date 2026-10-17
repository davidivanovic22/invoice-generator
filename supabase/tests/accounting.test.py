"""Accounting regression in an isolated database created by relational.test.py.
Never connects to hosted databases. Requires RELATIONAL_TEST_DB and local Docker.
"""
import concurrent.futures
import json
import os
import re
import subprocess
import uuid
from pathlib import Path

database = os.environ.get('RELATIONAL_TEST_DB', '')
assert re.fullmatch(r'paperwork_relational_\d+', database), 'An isolated relational test database is required'
container = 'supabase_db_invoice-generator'

def execute(sql):
    return subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'], input=sql, text=True, encoding='utf-8', capture_output=True)

def run(sql):
    result = execute(sql)
    if result.returncode: raise RuntimeError(result.stderr)
    return result.stdout.strip()

def literal(data): return "'" + json.dumps(data).replace("'", "''") + "'::jsonb"
def identity(user): return "select set_config('request.jwt.claims','" + json.dumps({'sub':user}) + "',false); set role authenticated;"
def as_user(user, sql): return run(identity(user)+sql).splitlines()[-1]
def denied(user, sql, error=None):
    result = execute(identity(user)+sql)
    assert result.returncode != 0, 'Expected refusal: '+sql
    if error: assert error in result.stderr, result.stderr

run(Path('supabase/migrations/20261007200000_accounting_core.sql').read_text(encoding='utf-8'))
owner, accountant, viewer, stranger = [str(uuid.uuid4()) for _ in range(4)]
for user in [owner, accountant, viewer, stranger]:
    run(f"insert into auth.users(id,email) values('{user}','ledger-{user}@example.test');")
firm = as_user(owner, "select paperwork_connect_firm('Ledger fixture','LEDGER-"+str(uuid.uuid4())+"');")
other = as_user(owner, "select paperwork_connect_firm('Other ledger fixture','LEDGER-"+str(uuid.uuid4())+"');")
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{accountant}','accountant'),('{firm}','{viewer}','viewer');")

def create(kind, value, target=firm, user=owner):
    return as_user(user, f"select paperwork_create_accounting_entity('{target}','{kind}',{literal(value)});")

year, period, next_period, receivable, income, buyer, foreign_account, parent = [str(uuid.uuid4()) for _ in range(8)]
create('year',dict(id=year,label=2026,startsOn='2026-01-01',endsOn='2026-12-31'))
create('period',dict(id=period,fiscalYearId=year,startsOn='2026-01-01',endsOn='2026-01-31'))
create('period',dict(id=next_period,fiscalYearId=year,startsOn='2026-02-01',endsOn='2026-02-28'))
create('account',dict(id=receivable,code='204',name='Receivable fixture',requiresPartner=True,validFrom='2026-01-01'))
create('account',dict(id=income,code='614',name='Income fixture',validFrom='2026-01-01'))
create('account',dict(id=parent,code='6',name='Parent fixture',allowsPosting=False,validFrom='2026-01-01'))
create('partner',dict(id=buyer,name='Buyer fixture'))
create('account',dict(id=foreign_account,code='204',name='Foreign fixture',validFrom='2026-01-01'),other)

def draft(amount='10000', account=receivable, partner=buyer, target=firm, date='2026-01-15'):
    return dict(id=str(uuid.uuid4()),firmId=target,fiscalYearId=year,periodId=period,postingDate=date,description='Fixture',lines=[
      dict(id='a',accountId=account,partnerId=partner,debit=amount,credit='0',description=''),
      dict(id='b',accountId=income,debit='0',credit=amount,description='')])

def post_sql(value,key=None,expected='0'):
    return f"select paperwork_post_journal({literal(value)},'{expected}','{key or str(uuid.uuid4())}');"

value=draft('900719925474099300')
key=str(uuid.uuid4())
denied(accountant,post_sql(value,key),'ACCOUNTING_FORBIDDEN')
denied(viewer,post_sql(value,key),'ACCOUNTING_FORBIDDEN')
denied(stranger,post_sql(value,key),'ACCOUNTING_FORBIDDEN')
as_user(owner,f"select paperwork_set_accounting_permission('{firm}','{accountant}','post_journal',true);")
denied(accountant,f"select paperwork_set_accounting_permission('{firm}','{accountant}','manage_periods',true);",'ACCOUNTING_FORBIDDEN')
receipt=json.loads(as_user(accountant,post_sql(value,key)))
assert receipt['postedBy']==accountant and receipt['number']=='2026/000001' and receipt['revision']=='1'
assert json.loads(as_user(accountant,post_sql(value,key)))==receipt
assert as_user(stranger,f"select count(*) from paperwork_journals where firm_id='{firm}';")=='0'
assert as_user(viewer,f"select count(*) from paperwork_journals where firm_id='{firm}';")=='1'
assert run(f"select debit::text from paperwork_journal_lines where firm_id='{firm}' and id='a';")=='900719925474099300'
read=json.loads(as_user(viewer,f"select paperwork_read_journal('{firm}','{value['id']}');"))
assert read['draft']['lines'][0]['debit']=='900719925474099300'
denied(stranger,f"select paperwork_read_journal('{firm}','{value['id']}');",'ACCOUNTING_FORBIDDEN')

changed={**value,'description':'Changed'}
denied(owner,post_sql(changed,key),'IDEMPOTENCY_REUSE')
denied(owner,post_sql(value,expected='1'),'STALE_REVISION')
denied(owner,f"update paperwork_journal_lines set debit=1 where firm_id='{firm}';")
denied(owner,f"delete from paperwork_journals where firm_id='{firm}';")
denied(owner,f"insert into paperwork_journals(firm_id,id) values('{firm}',gen_random_uuid());")
denied(owner,f"update paperwork_accounting_events set action='fake' where firm_id='{firm}';")
assert execute(f"update paperwork_journal_lines set debit=1 where firm_id='{firm}';").returncode != 0

for bad in [draft(account=foreign_account),draft(account=parent),draft(partner=None),draft(date='2026-02-01')]:
    denied(owner,post_sql(bad))
foreign_buyer=str(uuid.uuid4()); create('partner',dict(id=foreign_buyer,name='Foreign buyer'),other)
denied(owner,post_sql(draft(partner=foreign_buyer)))
expired=str(uuid.uuid4()); create('account',dict(id=expired,code='999',name='Expired fixture',validFrom='2025-01-01',validTo='2025-12-31'))
denied(owner,post_sql(draft(account=expired)))
denied(owner,f"select paperwork_create_accounting_entity('{firm}','account',"+literal(dict(id=str(uuid.uuid4()),code='615',name='Wrong parent',parentId=income,validFrom='2026-01-01'))+");",'INVALID_PARENT_ACCOUNT')
for amount in ['1.5','-1','NaN','01','1e3',100]: denied(owner,post_sql(draft(amount)))
unbalanced=draft(); unbalanced['lines'][1]['credit']='10001'
denied(owner,post_sql(unbalanced),'INVALID_JOURNAL_BALANCE')
duplicate=draft(); duplicate['lines'][1]['id']='a'
denied(owner,post_sql(duplicate))
assert run(f"select count(*) from paperwork_journals where firm_id='{firm}';")=='1'
assert run(f"select next_number from paperwork_fiscal_years where firm_id='{firm}';")=='2'

# Two callers retrying a committed request get one result, not two journals.
concurrent_value=draft(); concurrent_key=str(uuid.uuid4())
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    receipts=list(pool.map(lambda _: json.loads(as_user(owner,post_sql(concurrent_value,concurrent_key))),range(2)))
assert receipts[0]==receipts[1]
assert run(f"select count(*) from paperwork_journals where firm_id='{firm}';")=='2'
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    receipts=list(pool.map(lambda _: json.loads(as_user(owner,post_sql(draft()))),range(4)))
assert len({r['number'] for r in receipts})==4

denied(owner,f"select paperwork_create_accounting_entity('{firm}','period',"+literal(dict(id=str(uuid.uuid4()),fiscalYearId=year,startsOn='2026-01-10',endsOn='2026-01-20'))+");",'OVERLAPPING_PERIOD')
assert as_user(owner,f"select paperwork_set_period_status('{firm}','{period}','closed','1','Month checked');")=='2'
denied(owner,post_sql(draft()),'CLOSED_PERIOD')
assert json.loads(as_user(accountant,post_sql(value,key)))==receipt, 'Retry remains valid after period closure'
denied(accountant,f"select paperwork_set_period_status('{firm}','{period}','open','2','Reason');",'ACCOUNTING_FORBIDDEN')
denied(owner,f"select paperwork_set_period_status('{firm}','{period}','open','1','Reason');",'STALE_REVISION')
denied(owner,f"select paperwork_set_period_status('{firm}','{period}','open','2','');",'INVALID_REASON')

# Reverse in an open period; preserve the original and use positive opposite sides.
reverse_key=str(uuid.uuid4())
reverse=f"select paperwork_reverse_journal('{firm}','{value['id']}','{next_period}','2026-02-05','Correction','1','{reverse_key}');"
reversal=json.loads(as_user(owner,reverse))
assert json.loads(as_user(owner,reverse))==reversal
assert run(f"select debit::text from paperwork_journal_lines where firm_id='{firm}' and journal_id='{reversal['journalId']}' and id='b';")=='900719925474099300'
assert run(f"select reversal_of from paperwork_journals where firm_id='{firm}' and id='{reversal['journalId']}';")==value['id']
denied(owner,reverse.replace(reverse_key,str(uuid.uuid4())))
# Constraints protect the original even if a caller has bypassed API privileges.
assert execute(f"delete from paperwork_accounting_events where firm_id='{firm}';").returncode != 0
assert execute(f"begin; insert into paperwork_journals(firm_id,id,fiscal_year_id,period_id,posting_date,description,number,posted_by) values('{firm}',gen_random_uuid(),'{year}','{next_period}','2026-02-05','','invalid','{owner}'); commit;").returncode != 0
assert as_user(owner,f"select paperwork_set_period_status('{firm}','{period}','open','2','Reviewed correction');")=='3'
limited=str(uuid.uuid4()); create('account',dict(id=limited,code='998',name='Limited fixture',validFrom='2026-01-01',validTo='2026-01-31'))
limited_draft=draft(account=limited)
as_user(owner,post_sql(limited_draft))
as_user(owner,f"select paperwork_reverse_journal('{firm}','{limited_draft['id']}','{next_period}','2026-02-05','Historical correction','1','{uuid.uuid4()}');")

# Serialize close against a post. The only legal outcomes are committed-before-close or refused.
race=draft()
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    posting=pool.submit(execute,identity(owner)+post_sql(race))
    closing=pool.submit(as_user,owner,f"select paperwork_set_period_status('{firm}','{period}','closed','3','Race close');")
    post_result=posting.result(); assert closing.result()=='4'
if post_result.returncode: assert 'CLOSED_PERIOD' in post_result.stderr
assert run(f"select count(*) from paperwork_journals where firm_id='{firm}' and id='{race['id']}';")==('0' if post_result.returncode else '1')

as_user(owner,f"select paperwork_set_accounting_permission('{firm}','{accountant}','post_journal',false);")
denied(accountant,post_sql(value,key),'ACCOUNTING_FORBIDDEN')
assert run(f"select count(*) from paperwork_accounting_events where firm_id='{firm}' and actor_id='{accountant}' and action='journal.posted';")=='1'
as_user(owner,f"delete from paperwork_members where firm_id='{firm}' and user_id='{accountant}';")
denied(accountant,f"select paperwork_read_journal('{firm}','{value['id']}');",'ACCOUNTING_FORBIDDEN')
assert as_user(accountant,f"select count(*) from paperwork_journals where firm_id='{firm}';")=='0'
denied(owner,f"delete from paperwork_firms where id='{firm}';")
print('PASS: accounting scope, explicit permissions, exact money, atomic balanced posting, idempotency, concurrent numbering, immutable audit/storno and period locking.')
