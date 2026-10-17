"""Isolated PostgreSQL draft and agency authorization scenarios."""
import concurrent.futures
import json
import os
import re
import subprocess
import uuid
from pathlib import Path

database = os.environ.get('RELATIONAL_TEST_DB', '')
assert re.fullmatch(r'paperwork_relational_\d+', database), 'Isolated database required'
def execute(sql):
    return subprocess.run(['docker','exec','-i','supabase_db_invoice-generator','psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=sql,text=True,encoding='utf-8',capture_output=True)
def run(sql):
    r=execute(sql)
    if r.returncode: raise RuntimeError(r.stderr)
    return r.stdout.strip()
def identity(user): return "select set_config('request.jwt.claims','"+json.dumps({'sub':user})+"',false); set role authenticated;"
def user_sql(user,sql): return run(identity(user)+sql).splitlines()[-1]
def denied(user,sql,error=None):
    r=execute(identity(user)+sql)
    assert r.returncode, sql
    if error: assert error in r.stderr,r.stderr
def literal(value): return "'"+json.dumps(value).replace("'","''")+"'::jsonb"
def uid(): return str(uuid.uuid4())

run(Path('supabase/migrations/20261007210000_accounting_workflows.sql').read_text(encoding='utf-8'))
owner,admin,staff,outsider=[uid() for _ in range(4)]
for user in [owner,admin,staff,outsider]: run(f"insert into auth.users(id,email) values('{user}','workflows-{user}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('Agency fixture','WF-{uid()}');")
other=user_sql(owner,f"select paperwork_connect_firm('Other agency fixture','WF-{uid()}');")
agency=uid()
user_sql(admin,f"select paperwork_create_agency('{agency}','Agency fixture');")
user_sql(admin,f"select paperwork_set_agency_member('{agency}','{staff}',true);")
denied(staff,f"select paperwork_set_agency_member('{agency}','{outsider}',true);",'ACCOUNTING_FORBIDDEN')
denied(admin,f"select paperwork_set_agency_member('{agency}','{admin}',false);",'INVALID_AGENCY_MEMBER')
denied(admin,f"select paperwork_set_agency_consent('{firm}','{agency}','post_journal',true);",'ACCOUNTING_FORBIDDEN')
denied(admin,f"select paperwork_set_agency_assignment('{firm}','{agency}','{staff}','read',true);")
for cap in ['read','post_journal']:
    user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','{cap}',true);")
    user_sql(admin,f"select paperwork_set_agency_assignment('{firm}','{agency}','{staff}','{cap}',true);")
assert user_sql(staff,f"select paperwork_accounting_can('{firm}','post_journal');")=='t'
assert user_sql(admin,f"select paperwork_accounting_readable('{firm}');")=='f'
assert user_sql(staff,f"select paperwork_accounting_readable('{other}');")=='f'
assert user_sql(staff,f"select paperwork_role('{firm}') is null;")=='t'
assert user_sql(staff,f"select count(*) from paperwork_firms where id='{firm}';")=='0'
denied(admin,f"select paperwork_set_agency_assignment('{firm}','{agency}','{staff}','manage_periods',true);")
denied(staff,f"select paperwork_set_agency_assignment('{firm}','{agency}','{staff}','manage_periods',true);",'ACCOUNTING_FORBIDDEN')
denied(staff,f"insert into paperwork_agency_assignments values('{firm}','{agency}','{staff}','manage_periods','{staff}');")

year,period,next_period,a,b=[uid() for _ in range(5)]
def create(kind,data): user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','{kind}',{literal(data)});")
create('year',dict(id=year,label=2026,startsOn='2026-01-01',endsOn='2026-12-31'))
create('period',dict(id=period,fiscalYearId=year,startsOn='2026-01-01',endsOn='2026-01-31'))
create('period',dict(id=next_period,fiscalYearId=year,startsOn='2026-02-01',endsOn='2026-02-28'))
for code,account in [('204',a),('614',b)]: create('account',dict(id=account,code=code,name='Fixture '+code,validFrom='2026-01-01'))
def draft(): return dict(id=uid(),firmId=firm,fiscalYearId=year,periodId=period,postingDate='2026-01-15',description='Unfinished sale',lines=[])
def save(value,revision='0',key=None): return f"select paperwork_save_journal_draft({literal(value)},'{revision}','{key or uid()}');"
def post(value,revision,key): return f"select paperwork_post_journal({literal(value)},'{revision}','{key}');"
value=draft(); key=uid()
receipt=json.loads(user_sql(staff,save(value,key=key)))
assert receipt['revision']=='1' and receipt['savedBy']==staff
assert json.loads(user_sql(staff,save(value,key=key)))==receipt
changed={**value,'description':'Changed'}
denied(staff,save(changed,key=key),'IDEMPOTENCY_REUSE')
denied(staff,save(changed),'STALE_REVISION')
foreign_account=uid()
user_sql(owner,f"select paperwork_create_accounting_entity('{other}','account',"+literal(dict(id=foreign_account,code='204',name='Other firm account',validFrom='2026-01-01'))+");")
wrong_scope={**value,'lines':[dict(id='a',accountId=foreign_account,debit='1',credit='0',description='')]}
denied(staff,save(wrong_scope,'1'))
bad_amount={**value,'lines':[dict(id='a',accountId=a,debit=900719925474099301,credit='0',description='')]}
denied(staff,save(bad_amount,'1'),'INVALID_AMOUNT')
assert json.loads(user_sql(staff,f"select paperwork_read_journal_draft('{firm}','{value['id']}');"))['revision']=='1'
denied(outsider,f"select paperwork_read_journal_draft('{firm}','{value['id']}');",'ACCOUNTING_FORBIDDEN')
assert user_sql(outsider,f"select count(*) from paperwork_journal_drafts where firm_id='{firm}';")=='0'
amount='900719925474099301'
value['lines']=[dict(id='a',accountId=a,debit=amount,credit='0',description=''),dict(id='b',accountId=b,debit='0',credit='1',description='')]
user_sql(staff,save(value,'1'))
denied(staff,post(value,'2',uid()),'INVALID_JOURNAL_BALANCE')
assert run(f"select count(*) from paperwork_journals where firm_id='{firm}';")=='0'
value['lines'][1]['credit']=amount
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(lambda key:execute(identity(staff)+save(value,'2',key)),[uid(),uid()]))
assert sum(r.returncode==0 for r in results)==1
assert any('STALE_REVISION' in r.stderr for r in results)
saved=json.loads(user_sql(staff,f"select paperwork_read_journal_draft('{firm}','{value['id']}');"))
assert saved['draft']==value and saved['revision']=='3'
altered={**value,'description':'Unreviewed alteration'}
denied(staff,post(altered,'3',uid()),'STALE_REVISION')
post_key=uid(); posted=json.loads(user_sql(staff,post(value,'3',post_key)))
assert posted['postedBy']==staff
assert json.loads(user_sql(staff,post(value,'3',post_key)))==posted
assert json.loads(user_sql(staff,f"select paperwork_read_journal('{firm}','{value['id']}');"))['draft']['lines'][0]['debit']==amount
denied(staff,save(value,'3'),'STALE_REVISION')
denied(staff,post(value,'0',uid()),'STALE_REVISION')
denied(staff,f"update paperwork_journal_drafts set description='bypass' where firm_id='{firm}';")
assert execute(f"update paperwork_journal_drafts set description='bypass' where firm_id='{firm}' and id='{value['id']}';").returncode!=0
assert execute(f"delete from paperwork_journal_draft_lines where firm_id='{firm}' and draft_id='{value['id']}';").returncode!=0

closed=draft(); user_sql(staff,save(closed))
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','closed','1','Month complete');")
assert json.loads(user_sql(staff,post(value,'3',post_key)))==posted
moved={**closed,'periodId':next_period,'postingDate':'2026-02-15'}
denied(staff,save(moved,'1'),'CLOSED_PERIOD')
user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','read',false);")
assert user_sql(staff,f"select paperwork_accounting_can('{firm}','post_journal');")=='f'
denied(staff,f"select paperwork_read_journal('{firm}','{value['id']}');",'ACCOUNTING_FORBIDDEN')
assert user_sql(staff,f"select count(*) from paperwork_journal_lines where firm_id='{firm}';")=='0'
user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','read',true);")
assert user_sql(staff,f"select paperwork_accounting_readable('{firm}');")=='f' # New consent never restores old assignment.
user_sql(admin,f"select paperwork_set_agency_assignment('{firm}','{agency}','{staff}','read',true);")
user_sql(admin,f"select paperwork_set_agency_member('{agency}','{staff}',false);")
assert user_sql(staff,f"select paperwork_accounting_readable('{firm}');")=='f'
assert user_sql(staff,f"select paperwork_accounting_can('{firm}','post_journal');")=='f'
user_sql(admin,f"select paperwork_set_agency_member('{agency}','{staff}',true);")
assert user_sql(staff,f"select paperwork_accounting_readable('{firm}');")=='f'
assert run(f"select count(*) from paperwork_accounting_events where firm_id='{firm}' and action='draft.saved';")=='4'
assert execute(f"delete from paperwork_agency_events where agency_id='{agency}';").returncode!=0
assert run("select count(*) from information_schema.columns where table_schema='public' and table_name in ('paperwork_agencies','paperwork_agency_members','paperwork_agency_consents','paperwork_agency_assignments','paperwork_agency_events','paperwork_journal_drafts','paperwork_journal_draft_lines','paperwork_draft_requests') and data_type in ('json','jsonb');")=='0'
print('Accounting workflows passed: draft replay/revisions/race/exact amounts/posting/closed periods; agency consent/assignment/revocation/RLS/audit.')
