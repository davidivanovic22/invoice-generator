"""Explicit FX monetary positions/revaluation on synthetic disposable databases only."""
import concurrent.futures,json,os,re,subprocess,sys,uuid
from pathlib import Path
database=os.environ.get('RELATIONAL_TEST_DB','');assert re.fullmatch(r'paperwork_relational_\d+',database)
def execute(sql):return subprocess.run(['docker','exec','-i','supabase_db_invoice-generator','psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=sql,text=True,encoding='utf-8',capture_output=True)
def run(sql):
 r=execute(sql)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
def uid():return str(uuid.uuid4())
def lit(data):return "'"+json.dumps(data).replace("'","''")+"'::jsonb"
def identity(u):return "select set_config('request.jwt.claims','"+json.dumps({'sub':u})+"',false);set role authenticated;"
def user_sql(u,sql):return run(identity(u)+sql).splitlines()[-1]
def denied(u,sql,error=None):
 r=execute(identity(u)+sql);assert r.returncode,sql
 if error:assert error in r.stderr,r.stderr
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261008220000_accounting_fx.sql').read_text(encoding='utf-8'))
owner,reader,stranger=[uid() for _ in range(3)]
for u in [owner,reader,stranger]:run(f"insert into auth.users(id,email) values('{u}','fx-{u}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('FX fixture','FX-{uid()}');")
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{reader}','viewer');")
year,period,account,base,gain,loss,partner=[uid() for _ in range(7)]
def entity(kind,data):user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','{kind}',{lit(data)});")
entity('year',dict(id=year,label=2026,startsOn='2026-01-01',endsOn='2026-12-31'))
entity('period',dict(id=period,fiscalYearId=year,startsOn='2026-01-01',endsOn='2026-01-31'))
entity('partner',dict(id=partner,name='Foreign partner'))
for a,code,required in [(account,'204.EUR',True),(base,'614',False),(gain,'663',False),(loss,'563',False)]:entity('account',dict(id=a,code=code,name=code,requiresPartner=required,validFrom='2026-01-01'))
def rate(value='117000000'):return dict(rateMicros=value,quoteUnits='1',rateDate='2026-01-01',publishedOn='2025-12-31',rateSource='Synthetic manual rate',sourceReference='Retained list fixture')
def create(direction='receivable',amount='10000',rate_value='117000000',p=None,a=None):return dict(firmId=firm,id=uid(),expectedRevision='0',journalId=uid(),fiscalYearId=year,periodId=period,postingDate='2026-01-01',accountId=a or account,counterAccountId=base,partnerId=p or partner,currency='EUR',direction=direction,foreignMinor=amount,**rate(rate_value))
def cmd(action,data,key=None):return f"select paperwork_fx_command('{action}',{lit(data)},'{key or uid()}');"
def state(u=owner):return json.loads(user_sql(u,f"select paperwork_fx_workspace('{firm}');"))
def position(id):return next(p for p in state()['positions'] if p['id']==id)
def revalue(id,revision,rate_value='119000000'):return dict(firmId=firm,id=id,expectedRevision=revision,journalId=uid(),fiscalYearId=year,periodId=period,postingDate='2026-01-15',gainAccountId=gain,lossAccountId=loss,**rate(rate_value))
def cancel(id,event,revision):return dict(firmId=firm,id=id,expectedRevision=revision,revaluationId=event,periodId=period,postingDate='2026-01-16',reason='FX correction')
def reverse(j):return f"select paperwork_reverse_journal('{firm}','{j}','{period}','2026-01-17','Direct reversal','1','{uid()}');"
initial=create();key=uid();denied(reader,cmd('create',initial),'ACCOUNTING_FORBIDDEN');denied(stranger,cmd('create',initial),'ACCOUNTING_FORBIDDEN')
r=json.loads(user_sql(owner,cmd('create',initial,key)));assert r['revision']=='1' and r['journalId']==initial['journalId']
assert json.loads(user_sql(owner,cmd('create',initial,key)))==r
denied(owner,cmd('create',{**initial,'foreignMinor':'20000'},key),'IDEMPOTENCY_REUSE')
denied(owner,cmd('create',initial),'STALE_REVISION');denied(owner,cmd('create',create()),'FX_DEDICATED_ANALYTIC_REQUIRED')
assert position(initial['id'])['initialRsd']=='1170000' and position(initial['id'])['analyticBalance']=='1170000'
denied(owner,reverse(initial['journalId']),'ACTIVE_FX_LINK')
one=revalue(initial['id'],'1');user_sql(owner,cmd('revalue',one));p=position(initial['id']);assert p['revision']=='2' and p['analyticBalance']=='1190000'
assert p['events'][0]['delta']=='20000' and p['events'][0]['previousRsd']=='1170000'
assert run(f"select credit::text from paperwork_journal_lines where firm_id='{firm}' and journal_id='{one['journalId']}' and account_id='{gain}';")=='20000'
two=revalue(initial['id'],'2','116000000');user_sql(owner,cmd('revalue',two));assert position(initial['id'])['analyticBalance']=='1160000'
denied(owner,cmd('cancel',cancel(initial['id'],one['journalId'],'3')),'FX_REVERSE_LATEST_FIRST')
denied(owner,reverse(two['journalId']),'ACTIVE_FX_LINK')
close=dict(firmId=firm,id=initial['id'],expectedRevision='3',periodId=period,postingDate='2026-01-16',reason='Close source correction')
denied(owner,cmd('close',close),'ACTIVE_FX_REVALUATIONS')
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','closed','1','Close fixture');")
denied(owner,cmd('cancel',cancel(initial['id'],two['journalId'],'3')),'CLOSED_PERIOD')
assert not position(initial['id'])['events'][1]['cancelled']
assert run(f"select count(*) from paperwork_fx_cancellations where firm_id='{firm}';")=='0'
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','open','2','Open fixture');")
cancel_key=uid();receipt=json.loads(user_sql(owner,cmd('cancel',cancel(initial['id'],two['journalId'],'3'),cancel_key)))
assert receipt['revision']=='4' and position(initial['id'])['analyticBalance']=='1190000'
assert json.loads(user_sql(owner,cmd('cancel',cancel(initial['id'],two['journalId'],'3'),cancel_key)))==receipt
user_sql(owner,cmd('cancel',cancel(initial['id'],one['journalId'],'4')));assert position(initial['id'])['analyticBalance']=='1170000'
user_sql(owner,cmd('close',{**close,'expectedRevision':'5'}));assert position(initial['id'])['closed'] and position(initial['id'])['revision']=='6' and position(initial['id'])['analyticBalance']=='0'
denied(owner,cmd('revalue',revalue(initial['id'],'6')),'STALE_REVISION')
# Liability increase is an expense rather than income; prior closed cycles can reuse the dedicated pair.
liability=create('payable');user_sql(owner,cmd('create',liability));v=revalue(liability['id'],'1');user_sql(owner,cmd('revalue',v))
assert position(liability['id'])['analyticBalance']=='-1190000'
assert run(f"select debit::text from paperwork_journal_lines where firm_id='{firm}' and journal_id='{v['journalId']}' and account_id='{loss}';")=='20000'
denied(owner,cmd('revalue',revalue(liability['id'],'2','119000000')),'NO_FX_CHANGE')
denied(owner,cmd('revalue',{**revalue(liability['id'],'2'),'rateDate':'2026-01-16'}),'INVALID_FX_SOURCE')
denied(owner,cmd('revalue',{**revalue(liability['id'],'2'),'rateMicros':'1.5'}),'INVALID_FX_RATE')
denied(owner,cmd('revalue',{**revalue(liability['id'],'2','118000000'),'gainAccountId':loss}),'INVALID_FX_ACCOUNT')
# Serialization gives one winner for the same expected revision.
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:execute(identity(owner)+cmd('revalue',revalue(liability['id'],'2','118000000'))),range(2)))
assert sum(r.returncode==0 for r in results)==1 and position(liability['id'])['revision']=='3'
# A manual movement even with later offsetting reversal blocks automatic inference of remaining foreign principal.
manual=dict(id=uid(),firmId=firm,fiscalYearId=year,periodId=period,postingDate='2026-01-16',description='Independent payment',lines=[dict(id='p',accountId=account,partnerId=partner,debit='100',credit='0',description=''),dict(id='b',accountId=base,debit='0',credit='100',description='')])
user_sql(owner,f"select paperwork_post_journal({lit(manual)},'0','{uid()}');")
assert position(liability['id'])['externalMovements'];denied(owner,cmd('revalue',revalue(liability['id'],'3')),'FX_EXTERNAL_MOVEMENTS')
# Exact half-up and quote multiplier, without JS/float conversions.
assert run("select _paperwork_fx_convert(1,500000,1)::text;")=='1'
assert run("select _paperwork_fx_convert(10000,11700000000,100)::text;")=='1170000'
for amount,rv in [('900719925474099301','1000000'),('1','500000')]:
 new_partner=uid();entity('partner',dict(id=new_partner,name='Exact partner'));data=create(amount=amount,rate_value=rv,p=new_partner);user_sql(owner,cmd('create',data));assert position(data['id'])['initialRsd']==(amount if rv=='1000000' else '1')
denied(owner,cmd('create',{**create(p=uid()),'foreignMinor':'999999999999999999999999','rateMicros':'999999999999999999'}),'INVALID_FX_AMOUNT')
assert len(state(reader)['positions'])==len(state()['positions']);denied(stranger,f"select paperwork_fx_workspace('{firm}');",'ACCOUNTING_FORBIDDEN')
assert execute(f"set role anon;select paperwork_fx_workspace('{firm}');").returncode
agency=uid();user_sql(owner,f"select paperwork_create_agency('{agency}','FX read agency');")
user_sql(owner,f"select paperwork_set_agency_member('{agency}','{stranger}',true);");user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','read',true);");user_sql(owner,f"select paperwork_set_agency_assignment('{firm}','{agency}','{stranger}','read',true);")
assert state(stranger)['positions'];user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','read',false);");denied(stranger,f"select paperwork_fx_workspace('{firm}');",'ACCOUNTING_FORBIDDEN')
denied(owner,f"delete from paperwork_fx_positions where firm_id='{firm}';")
assert execute(f"update paperwork_fx_revaluations set delta=1 where firm_id='{firm}';").returncode
assert run("select count(*) from information_schema.columns where table_schema='public' and table_name like 'paperwork_fx_%' and data_type in('json','jsonb');")=='0'
assert json.loads(user_sql(owner,f"set timezone='Europe/Belgrade';select paperwork_fx_workspace('{firm}');"))['generatedAt'].endswith('+00:00')
print('FX SQL PASS: exact conversion/half-up/quote units, immutable historical rates, asset/liability gains/losses, chained revaluation, latest-first storno/closure, replay/race, period rollback, source protection, external movement guard, large amounts, roles/agency revoke and relational records.')
