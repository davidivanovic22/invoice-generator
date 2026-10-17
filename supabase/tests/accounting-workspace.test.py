"""Workspace discovery never expands legacy permissions or leaks another year."""
import json
import os
import re
import subprocess
import uuid
from pathlib import Path

database=os.environ.get('RELATIONAL_TEST_DB','')
assert re.fullmatch(r'paperwork_relational_\d+',database), 'Isolated local database required'
def execute(sql): return subprocess.run(['docker','exec','-i','supabase_db_invoice-generator','psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=sql,text=True,encoding='utf-8',capture_output=True)
def run(sql):
    result=execute(sql)
    if result.returncode: raise RuntimeError(result.stderr)
    return result.stdout.strip()
def identity(user): return "select set_config('request.jwt.claims','"+json.dumps({'sub':user})+"',false); set role authenticated;"
def user_sql(user,sql): return run(identity(user)+sql).splitlines()[-1]
def literal(value): return "'"+json.dumps(value).replace("'","''")+"'::jsonb"
def uid(): return str(uuid.uuid4())
run(Path('supabase/migrations/20261007220000_accounting_workspace.sql').read_text(encoding='utf-8'))
owner,staff,stranger=[uid() for _ in range(3)]
for user in [owner,staff,stranger]:run(f"insert into auth.users(id,email) values('{user}','workspace-{user}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('Workspace assigned','WS-{uid()}');")
other=user_sql(owner,f"select paperwork_connect_firm('Workspace private','WS-{uid()}');")
agency=uid();user_sql(owner,f"select paperwork_create_agency('{agency}','Workspace agency');")
user_sql(owner,f"select paperwork_set_agency_member('{agency}','{staff}',true);")
user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','read',true);")
user_sql(owner,f"select paperwork_set_agency_assignment('{firm}','{agency}','{staff}','read',true);")
assert json.loads(user_sql(stranger,'select paperwork_accounting_firms();'))==[]
firms=json.loads(user_sql(staff,'select paperwork_accounting_firms();'))
assert len(firms)==1 and firms[0]['id']==firm and firms[0]['name']=='Workspace assigned'
assert user_sql(staff,f"select count(*) from paperwork_firms where id='{firm}';")=='0'
year,prior,period,prior_period,foreign_year=[uid() for _ in range(5)]
def create(kind,data,target=firm):user_sql(owner,f"select paperwork_create_accounting_entity('{target}','{kind}',{literal(data)});")
for target,y,label in [(firm,year,2026),(firm,prior,2025),(other,foreign_year,2026)]:create('year',dict(id=y,label=label,startsOn=f'{label}-01-01',endsOn=f'{label}-12-31'),target)
create('period',dict(id=period,fiscalYearId=year,startsOn='2026-01-01',endsOn='2026-01-31'))
create('period',dict(id=prior_period,fiscalYearId=prior,startsOn='2025-01-01',endsOn='2025-01-31'))
draft=dict(id=uid(),firmId=firm,fiscalYearId=prior,periodId=prior_period,postingDate='2025-01-01',description='Prior year only',lines=[])
user_sql(owner,f"select paperwork_save_journal_draft({literal(draft)},'0','{uid()}');")
current=json.loads(user_sql(staff,f"select paperwork_accounting_workspace('{firm}','{year}');"))
assert current['firmId']==firm and current['yearId']==year and current['capabilities']==[]
assert len(current['periods'])==1 and current['periods'][0]['id']==period and current['periods'][0]['revision']=='1'
assert current['drafts']==[] and current['journals']==[]
assert [y['label'] for y in current['years']]==[2026,2025]
old=json.loads(user_sql(staff,f"select paperwork_accounting_workspace('{firm}','{prior}');"))
assert len(old['drafts'])==1 and old['drafts'][0]['id']==draft['id']
for user,target,selected in [(stranger,firm,year),(staff,other,foreign_year),(staff,firm,foreign_year)]:
    assert execute(identity(user)+f"select paperwork_accounting_workspace('{target}','{selected}');").returncode!=0
user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','read',false);")
assert json.loads(user_sql(staff,'select paperwork_accounting_firms();'))==[]
assert execute(identity(staff)+f"select paperwork_accounting_workspace('{firm}','{year}');").returncode!=0
assert execute("set role anon; select paperwork_accounting_firms();").returncode!=0
print('PASS: accounting workspace discovery, agency-only access, empty stranger list, exact revisions, firm/year isolation and revoked access.')
