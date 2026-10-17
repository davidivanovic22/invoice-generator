"""Initial RSD migration and outstanding items on synthetic disposable local databases."""
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
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261009110000_accounting_opening.sql').read_text(encoding='utf-8'))
owner,reader,stranger=[uid() for _ in range(3)]
for u in [owner,reader,stranger]:run(f"insert into auth.users(id,email) values('{u}','opening-{u}@example.test');")
def setup():
 global firm,tax,year,period,ar,ap,cash,equity,partner
 tax='OPEN-'+uid();firm=user_sql(owner,f"select paperwork_connect_firm('Opening fixture','{tax}');")
 tax=run(f"select tax_id from paperwork_firms where id='{firm}';")
 run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{reader}','viewer');")
 year,period,ar,ap,cash,equity,partner=[uid() for _ in range(7)]
 entity('year',dict(id=year,label=2026,startsOn='2026-01-01',endsOn='2026-12-31'))
 entity('period',dict(id=period,fiscalYearId=year,startsOn='2026-01-01',endsOn='2026-01-31'))
 entity('partner',dict(id=partner,name='Opening partner'))
 for a,code,required in [(ar,'204.OPEN',True),(ap,'435.OPEN',True),(cash,'241.OPEN',False),(equity,'300.OPEN',False)]:entity('account',dict(id=a,code=code,name=code,requiresPartner=required,validFrom='2026-01-01'))
def entity(kind,data):user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','{kind}',{lit(data)});")
def cmd(action,data,key=None):return f"select paperwork_opening_command('{action}',{lit(data)},'{key or uid()}');"
def state(u=owner):return json.loads(user_sql(u,f"select paperwork_opening_workspace('{firm}');"))
def data():return dict(firmId=firm,batchId=uid(),journalId=uid(),expectedRevision='0',fiscalYearId=year,periodId=period,postingDate='2026-01-01',asOf='2025-12-31',currency='RSD',sourceTaxId=tax,sourceReference='OPEN-'+uid(),fileName='synthetic.xlsx',fileSha256='a'*64,
 balances=[dict(sourceAccount='OLD-AR',sourcePartner='P1',accountId=ar,partnerId=partner,debit='10000',credit='0'),dict(sourceAccount='OLD-AP',sourcePartner='P1',accountId=ap,partnerId=partner,debit='0',credit='5000'),dict(sourceAccount='OLD-CASH',sourcePartner='',accountId=cash,debit='2000',credit='0'),dict(sourceAccount='OLD-EQ',sourcePartner='',accountId=equity,debit='0',credit='7000')],
 items=[dict(id=uid(),sourceAccount=a,sourcePartner='P1',externalId='OLD-'+uid(),number='Old invoice',documentDate='2025-12-01',dueDate='2025-12-31',direction=d,amount=n) for a,d,n in [('OLD-AR','receivable','4000'),('OLD-AR','receivable','6000'),('OLD-AP','payable','5000')]])
def payment(amount='4000'):
 d=dict(id=uid(),firmId=firm,fiscalYearId=year,periodId=period,postingDate='2026-01-10',description='Existing manual closing',lines=[dict(id='close',accountId=ar,partnerId=partner,debit='0',credit=amount,description='Closing'),dict(id='cash',accountId=cash,debit=amount,credit='0',description='Cash')])
 user_sql(owner,f"select paperwork_post_journal({lit(d)},'0','{uid()}');");return d
def apply(b,i,j,amount,rev='1'):return dict(firmId=firm,batchId=b,itemId=i,applicationId=uid(),expectedRevision=rev,journalId=j,lineId='close',amount=amount)
def reverse(j):return f"select paperwork_reverse_journal('{firm}','{j}','{period}','2026-01-11','Fixture reversal','1','{uid()}');"
setup();d=data();key=uid();denied(reader,cmd('import',d),'ACCOUNTING_FORBIDDEN')
denied(owner,cmd('import',{**d,'sourceTaxId':'OTHER'}),'INVALID_OPENING_SOURCE')
denied(owner,cmd('import',{**d,'asOf':'2026-01-01'}),'INVALID_OPENING_DATE')
bad=json.loads(json.dumps(d));bad['balances'][0]['debit']='9999';denied(owner,cmd('import',bad),'OPENING_ITEMS_BALANCE_MISMATCH')
bad=json.loads(json.dumps(d));bad['balances'][3]['credit']='7001';denied(owner,cmd('import',bad),'OPENING_UNBALANCED')
assert not state()['batches'] and run(f"select count(*) from paperwork_journals where firm_id='{firm}';")=='0'
r=json.loads(user_sql(owner,cmd('import',d,key)));assert json.loads(user_sql(owner,cmd('import',d,key)))==r
denied(owner,cmd('import',{**d,'fileName':'Changed'},key),'IDEMPOTENCY_REUSE');denied(owner,cmd('import',data()),'OPENING_REQUIRES_PRISTINE_LEDGER');denied(owner,reverse(d['journalId']),'ACTIVE_OPENING_LINK')
w=state();assert len(w['items'])==3 and run(f"select count(*) from paperwork_journal_lines where firm_id='{firm}';")=='5'
report=json.loads(user_sql(owner,f"select paperwork_accounting_report('{firm}','{year}','2026-01-01','2026-01-31');"));assert report['totals']['openingDebit']=='12000' and report['totals']['debit']=='0' and all(l['opening'] for l in report['lines'])
assert json.loads(user_sql(owner,f"select paperwork_partner_report('{firm}',null);"))['migration']['items']==w['items']
closing=payment();before_journals=run(f"select count(*) from paperwork_journals where firm_id='{firm}';")
a1=apply(d['batchId'],d['items'][0]['id'],closing['id'],'2000');key=uid();receipt=json.loads(user_sql(owner,cmd('apply',a1,key)));assert json.loads(user_sql(owner,cmd('apply',a1,key)))==receipt
a2=apply(d['batchId'],d['items'][1]['id'],closing['id'],'2000');user_sql(owner,cmd('apply',a2));assert run(f"select count(*) from paperwork_journals where firm_id='{firm}';")==before_journals
denied(owner,cmd('apply',apply(d['batchId'],d['items'][0]['id'],closing['id'],'1','2')),'OPENING_PAYMENT_CAP')
denied(owner,cmd('apply',apply(d['batchId'],d['items'][2]['id'],closing['id'],'1')),'INVALID_OPENING_PAYMENT')
assert sorted(i['remaining'] for i in state()['items'])==['2000','4000','5000']
report=json.loads(user_sql(owner,f"select paperwork_accounting_report('{firm}','{year}','2026-01-01','2026-01-31');"));assert report['totals']['debit']=='4000' and report['totals']['openingDebit']=='12000'
cancel=dict(firmId=firm,batchId=d['batchId'],expectedRevision='1',periodId=period,reason='Correction');denied(owner,cmd('cancel',cancel),'OPENING_HAS_LATER_MOVEMENTS')
user_sql(owner,reverse(closing['id']));assert sorted(i['remaining'] for i in state()['items'])==['4000','5000','6000'] and all(a['reversed'] for a in state()['applications'])
assert next(i for i in state()['items'] if i['id']==d['items'][0]['id'])['revision']=='3'
denied(owner,cmd('apply',apply(d['batchId'],d['items'][0]['id'],closing['id'],'1','3')),'INVALID_OPENING_PAYMENT')
race=payment('1000');payloads=[apply(d['batchId'],d['items'][0]['id'],race['id'],'1000','3') for _ in range(2)]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda a:execute(identity(owner)+cmd('apply',a)),payloads))
assert sum(r.returncode==0 for r in results)==1
# A stock receipt is an operational source, never a free payment line even on the same AR partner/account.
stock_account,stock_item,stock_journal=[uid() for _ in range(3)]
entity('account',dict(id=stock_account,code='132.OPEN',name='Stock',validFrom='2026-01-01'))
stock_data=dict(firmId=firm,itemId=stock_item,expectedRevision='0',sku='OPEN-STOCK',name='Synthetic stock',warehouse='MAIN',unit='kom',accountId=stock_account)
user_sql(owner,f"select paperwork_stock_command('create',{lit(stock_data)},'{uid()}');")
stock_data=dict(firmId=firm,itemId=stock_item,expectedRevision='1',journalId=stock_journal,fiscalYearId=year,periodId=period,postingDate='2026-01-12',quantity='1000',value='1000',counterAccountId=ar,partnerId=partner,externalId='STOCK-OPENING')
user_sql(owner,f"select paperwork_stock_command('receipt',{lit(stock_data)},'{uid()}');")
stock_apply={**apply(d['batchId'],d['items'][0]['id'],stock_journal,'1','4'),'lineId':'counter'}
denied(owner,cmd('apply',stock_apply),'INVALID_OPENING_PAYMENT')
assert state(reader)==state();denied(stranger,f"select paperwork_opening_workspace('{firm}');",'ACCOUNTING_FORBIDDEN');assert user_sql(stranger,f"select count(*) from paperwork_opening_items where firm_id='{firm}';")=='0'
denied(owner,f"delete from paperwork_opening_batches where firm_id='{firm}';");assert execute(f"update paperwork_opening_balances set debit=debit;").returncode
# A pristine import can be reversed atomically, then corrected by an explicitly new source version.
setup();d=data();user_sql(owner,cmd('import',d));cancel=dict(firmId=firm,batchId=d['batchId'],expectedRevision='1',periodId=period,reason='Wrong mapping')
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','closed','1','Fixture closed');")
denied(owner,cmd('cancel',cancel),'CLOSED_PERIOD');assert not state()['batches'][0]['cancelled']
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','open','2','Fixture open');")
user_sql(owner,cmd('cancel',cancel));assert state()['batches'][0]['cancelled'] and all(i['remaining']=='0' for i in state()['items'])
large=data();large['items']=[];large['balances']=[dict(sourceAccount='L',sourcePartner='',accountId=cash,debit='900719925474099301',credit='0'),dict(sourceAccount='E',sourcePartner='',accountId=equity,debit='0',credit='900719925474099301')];user_sql(owner,cmd('import',large))
assert json.loads(user_sql(owner,f"select paperwork_accounting_report('{firm}','{year}','2026-01-01','2026-01-31');"))['totals']['openingBalanceDebit']=='900719925474099301'
assert run("select count(*) from information_schema.columns where table_schema='public' and table_name like 'paperwork_opening_%' and data_type in('json','jsonb');")=='0'
print('Opening SQL PASS: atomic exact initial mapping/balances/open items, no duplicate turnover, pristine import/source replay, linked existing closing line caps/race/reversal, opening vs movement reports, correction/period rollback, RLS and immutable relational sources.')
