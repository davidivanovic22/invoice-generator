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
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261009000000_accounting_fx_bank.sql').read_text(encoding='utf-8'))
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
bank=uid();cash=uid();entity('account',dict(id=cash,code='244.EUR',name='Foreign cash',requiresPartner=False,validFrom='2026-01-01'))
account_data=dict(firmId=firm,id=bank,name='EUR account',number='RS35160000999',currency='EUR',cashAccountId=cash)
def bank_cmd(data,key=None):return f"select paperwork_create_fx_bank_account({lit(data)},'{key or uid()}');"
def imp(data,key=None):return f"select paperwork_import_fx_bank_statement({lit(data)},'{key or uid()}');"
def read(s,u=owner):return json.loads(user_sql(u,f"select paperwork_fx_bank_reconciliation('{firm}','{s}');"))
def link(tx,settlement,key=None):return f"select paperwork_link_fx_bank_payment({lit(dict(firmId=firm,transactionId=tx,settlementId=settlement))},'{key or uid()}');"
def row(external='FX-TX-1',amount='4000',incoming=True):return dict(externalId=external,bookingDate='2026-01-15',valueDate='2026-01-15',incoming=amount if incoming else '0',outgoing='0' if incoming else amount,counterparty='Foreign partner',reference='',description='Synthetic')
def statement(rows=None):return dict(firmId=firm,bankAccountId=bank,fiscalYearId=year,reference='FX-001',startsOn='2026-01-15',endsOn='2026-01-15',opening='10000',closing='14000',rows=rows or [row()])
def pay(p,source='FX-TX-1',amount='4000'):return dict(firmId=firm,id=p['id'],expectedRevision='1',journalId=uid(),fiscalYearId=year,periodId=period,postingDate='2026-01-15',foreignMinor=amount,currency='EUR',cashAccountId=cash,gainAccountId=gain,lossAccountId=loss,sourceAccount=account_data['number'],sourceId=source,**rate('120000000'))
denied(reader,bank_cmd(account_data),'ACCOUNTING_FORBIDDEN')
key=uid();user_sql(owner,bank_cmd(account_data,key));user_sql(owner,bank_cmd(account_data,key))
denied(owner,bank_cmd({**account_data,'currency':'USD'},key),'IDEMPOTENCY_REUSE')
denied(owner,f"select paperwork_create_bank_account({lit(dict(firmId=firm,id=uid(),name='RSD collision',number=account_data['number'],currency='RSD'))},'{uid()}');",'FX_BANK_IDENTITY_CONFLICT')
p=create();user_sql(owner,cmd('create',p));payment=pay(p);user_sql(owner,cmd('settle',payment))
before=run(f"select count(*) from paperwork_journals where firm_id='{firm}';")
bad=statement([row(amount='4100')]);bad['closing']='14100'
denied(owner,imp(bad),'FX_BANK_PAYMENT_CONFLICT')
assert run(f"select count(*) from paperwork_fx_bank_statements where firm_id='{firm}';")=='0'
data=statement();key=uid();receipt=json.loads(user_sql(owner,imp(data,key)));sid=receipt['statementId']
assert json.loads(user_sql(owner,imp(data,key)))==receipt
assert json.loads(user_sql(owner,imp(data)))['previouslyImported']
assert run(f"select count(*) from paperwork_journals where firm_id='{firm}';")==before
view=read(sid);tx=view['rows'][0]['id'];assert view['currency']=='EUR' and view['links'][0]['linked']==False
denied(reader,link(tx,payment['journalId']),'ACCOUNTING_FORBIDDEN');denied(stranger,link(tx,payment['journalId']),'ACCOUNTING_FORBIDDEN')
key=uid();receipt=json.loads(user_sql(owner,link(tx,payment['journalId'],key)));assert json.loads(user_sql(owner,link(tx,payment['journalId'],key)))==receipt
denied(owner,link(tx,uid(),key),'IDEMPOTENCY_REUSE')
assert read(sid)['links'][0]['linked'] and run(f"select count(*) from paperwork_journals where firm_id='{firm}';")==before
# Reversals retain the source link but remove active reconciliation coverage.
cancel_payment=dict(firmId=firm,id=p['id'],expectedRevision='2',settlementId=payment['journalId'],periodId=period,postingDate='2026-01-16',reason='Synthetic reversal')
user_sql(owner,cmd('cancel_settlement',cancel_payment));assert read(sid)['links'][0]['cancelled']
assert json.loads(user_sql(owner,link(tx,payment['journalId'],key)))==receipt
denied(owner,link(tx,payment['journalId']),'FX_BANK_PAYMENT_CANCELLED')
# Metadata identity and balance errors never persist partial rows/receipts.
denied(owner,imp({**data,'closing':'14001'}),'BANK_BALANCE_MISMATCH')
denied(owner,imp({**data,'reference':'OVERLAP'}),'FX_BANK_OVERLAP')
denied(owner,imp({**data,'rows':[row(),row()]}),'DUPLICATE_BANK_ROW')
denied(owner,imp({**data,'closing':14000}),'INVALID_AMOUNT')
denied(owner,imp({**data,'reference':'FX-001','opening':'10001','closing':'14001'}),'BANK_STATEMENT_CONFLICT')
# Import before a manual payment: mismatch must roll back the journal and receipt too.
second={**data,'reference':'FX-002','startsOn':'2026-01-17','endsOn':'2026-01-17','opening':'14000','closing':'17000','rows':[{**row('FX-TX-2','3000'),'bookingDate':'2026-01-17','valueDate':'2026-01-17'}]}
sid2=json.loads(user_sql(owner,imp(second)))['statementId'];p2=create(p=uid());entity('partner',dict(id=p2['partnerId'],name='Second FX partner'));user_sql(owner,cmd('create',p2))
a=pay(p2,'FX-TX-2','3001');a['postingDate']='2026-01-17'
denied(owner,cmd('settle',a),'FX_BANK_PAYMENT_CONFLICT');assert position(p2['id'])['revision']=='1'
a['foreignMinor']='3000';user_sql(owner,cmd('settle',a));assert read(sid2)['links'][0]['settlementId']==a['journalId']
for changed in [dict(currency='USD'),dict(cashAccountId=base),dict(postingDate='2026-01-18')]:
 b=pay(p2,'FX-TX-2','3000');b['expectedRevision']='2';b['postingDate']='2026-01-17';b.update(changed)
 # Permanent source uniqueness may reject before the metadata trigger; use an imported unclaimed ID instead below.
 denied(owner,cmd('settle',b))
tx2=read(sid2)['rows'][0]['id']
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:execute(identity(owner)+link(tx2,a['journalId'])),range(2)))
assert sum(r.returncode==0 for r in results)==1
assert run(f"select count(*) from paperwork_fx_bank_links where firm_id='{firm}' and transaction_id='{tx2}';")=='1'
wrong={**second,'reference':'WRONG','startsOn':'2026-01-18','endsOn':'2026-01-18','rows':[{**row('FX-TX-3','3000',False),'bookingDate':'2026-01-18','valueDate':'2026-01-18'}],'closing':'11000'}
sid3=json.loads(user_sql(owner,imp(wrong)))['statementId']
a3=pay(p2,'FX-TX-3','3000');a3['expectedRevision']='2';a3['postingDate']='2026-01-18';denied(owner,cmd('settle',a3),'FX_BANK_PAYMENT_CONFLICT')
for changed in [dict(cashAccountId=base),dict(postingDate='2026-01-19')]:denied(owner,cmd('settle',{**a3,**changed}),'FX_BANK_PAYMENT_CONFLICT')
# A new account mapping cannot contradict already saved manual payment history.
p3=create(p=uid());entity('partner',dict(id=p3['partnerId'],name='Unregistered source'));user_sql(owner,cmd('create',p3))
a4={**pay(p3,'BEFORE-ACCOUNT'),'sourceAccount':'RS35160000888'};user_sql(owner,cmd('settle',a4))
denied(owner,bank_cmd({**account_data,'id':uid(),'number':a4['sourceAccount'],'cashAccountId':base}),'FX_BANK_PAYMENT_CONFLICT')
denied(owner,bank_cmd({**account_data,'id':uid(),'number':a4['sourceAccount'],'currency':'USD'}),'FX_BANK_PAYMENT_CONFLICT')
# Reader scope, immutable relations and exact amounts beyond JS Number.
assert read(sid,reader)['links'][0]['cancelled'];denied(stranger,f"select paperwork_fx_bank_reconciliation('{firm}','{sid}');",'ACCOUNTING_FORBIDDEN')
assert user_sql(stranger,f"select count(*) from paperwork_fx_bank_links where firm_id='{firm}';")=='0'
denied(owner,f"delete from paperwork_fx_bank_links where firm_id='{firm}';")
assert execute(f"update paperwork_fx_bank_links set request_hash='bad' where firm_id='{firm}';").returncode
huge={**data,'reference':'HUGE','startsOn':'2026-01-20','endsOn':'2026-01-20','opening':'-1','closing':'900719925474099300','rows':[{**row('HUGE','900719925474099301'),'bookingDate':'2026-01-20','valueDate':'2026-01-20'}]}
sid4=json.loads(user_sql(owner,imp(huge)))['statementId'];assert read(sid4)['rows'][0]['incoming']=='900719925474099301'
print('FX bank SQL PASS: exact import/balance, metadata conflicts in both arrival orders, source linkage without duplicate journals, cancellation-aware coverage, replay, overlap and identity guards, immutable links, reader isolation and large amounts.')
