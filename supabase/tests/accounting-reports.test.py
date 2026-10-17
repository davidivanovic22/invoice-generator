"""Read-only complete RSD journal/ledger/trial snapshots, disposable DB only."""
import json,os,re,subprocess,sys,uuid
from pathlib import Path
database=os.environ.get('RELATIONAL_TEST_DB','');assert re.fullmatch(r'paperwork_relational_\d+',database)
def execute(sql):return subprocess.run(['docker','exec','-i','supabase_db_invoice-generator','psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=sql,text=True,encoding='utf-8',capture_output=True)
def run(sql):
 r=execute(sql)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
def uid():return str(uuid.uuid4())
def lit(data):return "'"+json.dumps(data).replace("'","''")+"'::jsonb"
def identity(user):return "select set_config('request.jwt.claims','"+json.dumps({'sub':user})+"',false);set role authenticated;"
def user_sql(user,sql):return run(identity(user)+sql).splitlines()[-1]
def denied(user,sql,error=None):
 r=execute(identity(user)+sql);assert r.returncode,sql
 if error:assert error in r.stderr,r.stderr
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261008200000_accounting_reports.sql').read_text(encoding='utf-8'))
owner,viewer,stranger=[uid() for _ in range(3)]
for u in [owner,viewer,stranger]:run(f"insert into auth.users(id,email) values('{u}','reports-{u}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('Report fixture','REP-{uid()}');")
other=user_sql(owner,f"select paperwork_connect_firm('Other report firm','REP-O-{uid()}');")
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{viewer}','viewer');")
year,prior,period,a,b,partner=[uid() for _ in range(6)]
for kind,data in [('year',dict(id=year,label=2026,startsOn='2026-01-01',endsOn='2026-12-31')),('year',dict(id=prior,label=2025,startsOn='2025-01-01',endsOn='2025-12-31')),('period',dict(id=period,fiscalYearId=year,startsOn='2026-01-01',endsOn='2026-01-31')),('account',dict(id=a,code='204',name='Receivable',requiresPartner=True,validFrom='2026-01-01')),('account',dict(id=b,code='614',name='Income',validFrom='2026-01-01')),('partner',dict(id=partner,name='=Literal partner'))]:user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','{kind}',{lit(data)});")
def draft(amount,date='2026-01-01'):return dict(id=uid(),firmId=firm,fiscalYearId=year,periodId=period,postingDate=date,description='=Literal journal',lines=[dict(id='a',accountId=a,partnerId=partner,debit=amount,credit='0',description='=Literal line'),dict(id='b',accountId=b,debit='0',credit=amount,description='Credit')])
def post(data):return json.loads(user_sql(owner,f"select paperwork_post_journal({lit(data)},'0','{uid()}');"))
huge='999999999999999999999999';first=post(draft(huge));post(draft(huge));post(draft('150','2026-01-10'))
user_sql(owner,f"select paperwork_reverse_journal('{firm}','{first['journalId']}','{period}','2026-01-15','Correction','1','{uid()}');")
unsent=draft('300','2026-01-10');user_sql(owner,f"select paperwork_save_journal_draft({lit(unsent)},'0','{uid()}');")
def query(start='2026-01-10',end='2026-01-20',f=firm,y=year):return f"select paperwork_accounting_report('{f}','{y}','{start}','{end}');"
def report(user=owner,**kwargs):return json.loads(user_sql(user,query(**kwargs)))
before=run(f"select count(*) from paperwork_accounting_events where firm_id='{firm}';")
r=report();assert r['currency']=='RSD' and r['journalCount']=='2' and r['lineCount']=='4'
assert r['totals']['openingDebit']==str(2*int(huge)) and r['totals']['openingDebit']==r['totals']['openingCredit']
assert r['totals']['debit']==str(int(huge)+150)==r['totals']['credit']
card=next(x for x in r['accounts'] if x['accountId']==a)
assert card['openingBalance']==str(2*int(huge)) and card['closingBalance']==str(int(huge)+150)
assert sum(int(l['debit'])-int(l['credit']) for l in r['lines'] if l['accountId']==a)+int(card['openingBalance'])==int(card['closingBalance'])
assert any(l['reversalOf']==first['journalId'] and l['reason']=='Correction' for l in r['lines'])
assert not any(l['journalId']==unsent['id'] for l in r['lines'])
rv=report(viewer);assert {k:v for k,v in r.items() if k!='generatedAt'}=={k:v for k,v in rv.items() if k!='generatedAt'}
assert report(start='2026-01-21',end='2026-01-31')['lines']==[]
assert report(start='2025-01-01',end='2025-12-31',y=prior)['accounts']==[]
assert report(start='2026-01-01',end='2026-01-01')['lineCount']=='4'
denied(stranger,query(),'ACCOUNTING_FORBIDDEN')
denied(owner,query(f=other),'INVALID_YEAR')
for args in [dict(start='2025-12-31'),dict(end='2027-01-01'),dict(start='2026-01-21',end='2026-01-20')]:denied(owner,query(**args),'INVALID_REPORT_RANGE')
assert run(f"select count(*) from paperwork_accounting_events where firm_id='{firm}';")==before

# A complete report must include journals omitted by the 100-item workspace.
template=draft('1','2026-01-20');body=json.dumps(template).replace("'","''")
user_sql(owner,f"do $$declare n int;d jsonb;begin for n in 1..101 loop d:='{body}'::jsonb||jsonb_build_object('id',gen_random_uuid());perform paperwork_post_journal(d,'0',gen_random_uuid()::text);end loop;end $$; select 'ok';")
assert report(start='2026-01-01',end='2026-01-31')['journalCount']=='105'
assert len(json.loads(user_sql(owner,f"select paperwork_accounting_workspace('{firm}','{year}');"))['journals'])==100

# Balanced fixture journals with 1000 lines each exceed the explicit detail cap.
cap=f"insert into paperwork_journals(firm_id,id,fiscal_year_id,period_id,posting_date,description,number,posted_by) select '{firm}',md5('{firm}'||'-cap-'||n)::uuid,'{year}','{period}','2026-01-25','Cap fixture','CAP-'||n,'{owner}' from generate_series(1,11)n;"
cap+=f"insert into paperwork_journal_lines(firm_id,journal_id,id,account_id,partner_id,debit,credit,description,account_code,account_name) select '{firm}',md5('{firm}'||'-cap-'||j)::uuid,n::text,case when n<=500 then '{a}'::uuid else '{b}'::uuid end,case when n<=500 then '{partner}'::uuid end,case when n<=500 then 1 else 0 end,case when n>500 then 1 else 0 end,'Cap fixture',case when n<=500 then '204' else '614' end,'Fixture' from generate_series(1,11)j cross join generate_series(1,1000)n;"
run('begin;'+cap+'commit;')
denied(owner,query(start='2026-01-01',end='2026-01-31'),'REPORT_TOO_LARGE')
assert report(start='2026-01-10',end='2026-01-20')['journalCount']=='103'
agency=uid();user_sql(owner,f"select paperwork_create_agency('{agency}','Reporting agency');")
user_sql(owner,f"select paperwork_set_agency_member('{agency}','{stranger}',true);")
user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','read',true);")
user_sql(owner,f"select paperwork_set_agency_assignment('{firm}','{agency}','{stranger}','read',true);")
assert report(stranger)['lineCount']==report(owner)['lineCount']
denied(stranger,query(f=other),'ACCOUNTING_FORBIDDEN')
user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','read',false);")
denied(stranger,query(),'ACCOUNTING_FORBIDDEN')
denied(owner,f"select paperwork_accounting_report('{firm}','{year}',null,null);",'INVALID_REPORT_RANGE')
assert execute('set role anon;'+query()).returncode
utc=json.loads(user_sql(owner,"set timezone='Europe/Belgrade';"+query()))
assert utc['generatedAt'].endswith('+00:00') and all(l['postedAt'].endswith('+00:00') for l in utc['lines'])
print('Accounting reports SQL PASS: complete snapshot, >100 journals, opening/movement/closing, exact >24-digit totals, reversal history, draft exclusion, scope/roles/agency revocation/range, no writes and explicit overflow rejection.')
