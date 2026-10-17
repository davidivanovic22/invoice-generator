"""Inventory business invariants, only synthetic disposable local databases."""
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
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261009100000_accounting_inventory.sql').read_text(encoding='utf-8'))
owner,reader,stranger=[uid() for _ in range(3)]
for u in [owner,reader,stranger]:run(f"insert into auth.users(id,email) values('{u}','stock-{u}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('Inventory fixture','STOCK-{uid()}');")
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{reader}','viewer');")
year,period,stock,base,cost,partner=[uid() for _ in range(6)]
def entity(kind,data):user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','{kind}',{lit(data)});")
entity('year',dict(id=year,label=2026,startsOn='2026-01-01',endsOn='2026-12-31'))
entity('period',dict(id=period,fiscalYearId=year,startsOn='2026-01-01',endsOn='2026-01-31'))
entity('partner',dict(id=partner,name='Stock supplier'))
for a,code,required in [(stock,'132.TEST',False),(base,'435.TEST',True),(cost,'501.TEST',False)]:entity('account',dict(id=a,code=code,name=code,requiresPartner=required,validFrom='2026-01-01'))
def cmd(action,data,key=None):return f"select paperwork_stock_command('{action}',{lit(data)},'{key or uid()}');"
def state(u=owner):return json.loads(user_sql(u,f"select paperwork_stock_workspace('{firm}');"))
def item(i):return next(x for x in state()['items'] if x['id']==i)
def create(sku='SKU-1'):return dict(firmId=firm,itemId=uid(),expectedRevision='0',sku=sku,name='Stock item',warehouse='MAIN',unit='kom',accountId=stock)
def movement(i,rev,q,v=None,date='2026-01-02'):
 d=dict(firmId=firm,itemId=i,expectedRevision=rev,journalId=uid(),fiscalYearId=year,periodId=period,postingDate=date,quantity=q,counterAccountId=base if v else cost,externalId=uid())
 if v:d.update(value=v,partnerId=partner)
 return d
def cancel(i,rev,target,date='2026-01-05'):return dict(firmId=firm,itemId=i,expectedRevision=rev,targetId=target,fiscalYearId=year,periodId=period,postingDate=date,reason='Fixture correction')
def reverse(j):return f"select paperwork_reverse_journal('{firm}','{j}','{period}','2026-01-05','Bypass','1','{uid()}');"
d=create();key=uid();denied(reader,cmd('create',d),'ACCOUNTING_FORBIDDEN');user_sql(owner,cmd('create',d,key));assert json.loads(user_sql(owner,cmd('create',d,key)))['revision']=='1'
denied(owner,cmd('create',{**d,'name':'Changed'},key),'IDEMPOTENCY_REUSE');denied(owner,cmd('create',create()),'duplicate key')
i=d['itemId'];r1=movement(i,'1','10000','10000');key=uid();denied(reader,cmd('receipt',r1),'ACCOUNTING_FORBIDDEN');receipt=json.loads(user_sql(owner,cmd('receipt',r1,key)));assert json.loads(user_sql(owner,cmd('receipt',r1,key)))==receipt
r2=movement(i,'2','10000','20000');user_sql(owner,cmd('receipt',r2));assert item(i)['quantity']=='20000' and item(i)['value']=='30000'
issue=movement(i,'3','4000');user_sql(owner,cmd('issue',issue));assert item(i)['value']=='24000' and state()['movements'][-1]['value']=='6000'
denied(owner,reverse(issue['journalId']),'ACTIVE_STOCK_LINK');denied(owner,cmd('cancel',cancel(i,'4',r1['journalId'])),'STOCK_REVERSE_LATEST_FIRST')
denied(owner,cmd('issue',movement(i,'4','16001')),'STOCK_INSUFFICIENT');denied(owner,cmd('issue',movement(i,'3','1')),'STALE_REVISION')
denied(owner,cmd('receipt',{**movement(i,'4','1000','1000'),'counterAccountId':stock}),'INVALID_STOCK_COUNTER')
denied(owner,cmd('receipt',{**movement(i,'4','1000','1000'),'externalId':r1['externalId']}),'DUPLICATE_SOURCE')
denied(owner,cmd('receipt',movement(i,'4','1','1','2026-01-01')),'INVALID_STOCK_DATE')
before=state();user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','closed','1','Closed fixture');")
denied(owner,cmd('cancel',cancel(i,'4',issue['journalId'])),'CLOSED_PERIOD');assert state()==before
denied(owner,cmd('receipt',movement(i,'4','1','1')),'CLOSED_PERIOD');assert state()==before
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','open','2','Open fixture');")
user_sql(owner,cmd('cancel',cancel(i,'4',issue['journalId'])));assert item(i)['quantity']=='20000' and item(i)['value']=='30000'
full=movement(i,'5','20000',date='2026-01-05');user_sql(owner,cmd('issue',full));assert item(i)['value']=='0' and item(i)['quantity']=='0'
user_sql(owner,cmd('cancel',cancel(i,'6',full['journalId'])));user_sql(owner,cmd('cancel',cancel(i,'7',r2['journalId'])));user_sql(owner,cmd('cancel',cancel(i,'8',r1['journalId'])));assert item(i)['value']=='0'
denied(owner,cmd('receipt',{**movement(i,'9','1000','1000','2026-01-05'),'externalId':r1['externalId']}),'DUPLICATE_SOURCE')
# Two items can share the same inventory account without disturbing each other's average.
tiny=create('TINY');user_sql(owner,cmd('create',tiny));ti=tiny['itemId'];user_sql(owner,cmd('receipt',movement(ti,'1','3','5')))
for rev,v in [('2','2'),('3','2'),('4','1')]:
 m=movement(ti,rev,'1');user_sql(owner,cmd('issue',m));assert next(x for x in state()['movements'] if x['id']==m['journalId'])['value']==v
large=create('LARGE');user_sql(owner,cmd('create',large));li=large['itemId'];user_sql(owner,cmd('receipt',movement(li,'1','900719925474099301','900719925474099301')))
user_sql(owner,cmd('issue',movement(li,'2','900719925474099300')));assert item(li)['quantity']=='1' and item(li)['value']=='1'
user_sql(owner,cmd('issue',movement(li,'3','1')));assert item(li)['value']=='0'
# Serialized quantity/revision prevents selling the same stock twice.
race=create('RACE');user_sql(owner,cmd('create',race));ri=race['itemId'];user_sql(owner,cmd('receipt',movement(ri,'1','1000','100')))
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda x:execute(identity(owner)+cmd('issue',x)),[movement(ri,'2','1000'),movement(ri,'2','1000')]))
assert sum(r.returncode==0 for r in results)==1 and item(ri)['value']=='0'
assert state(reader)==state();denied(stranger,f"select paperwork_stock_workspace('{firm}');",'ACCOUNTING_FORBIDDEN')
assert user_sql(stranger,f"select count(*) from paperwork_stock_items where firm_id='{firm}';")=='0'
denied(owner,f"delete from paperwork_stock_items where firm_id='{firm}';")
assert execute(f"update paperwork_stock_movements set value=1 where firm_id='{firm}';").returncode
assert run("select count(*) from information_schema.columns where table_schema='public' and table_name like 'paperwork_stock_%' and data_type in('json','jsonb');")=='0'
assert all(a['balance']=='0' for a in state()['accounts'])
# A manual value difference blocks stock changes; its full reversal restores control without erasing history.
manual=dict(id=uid(),firmId=firm,fiscalYearId=year,periodId=period,postingDate='2026-01-05',description='External stock test',lines=[dict(id='s',accountId=stock,debit='1',credit='0',description='External'),dict(id='c',accountId=cost,debit='0',credit='1',description='External')])
user_sql(owner,f"select paperwork_post_journal({lit(manual)},'0','{uid()}');")
assert all(x['externalMovements'] for x in state()['items'])
denied(owner,cmd('receipt',movement(i,'9','1000','1000','2026-01-05')),'STOCK_EXTERNAL_MOVEMENTS')
user_sql(owner,reverse(manual['id']));assert not any(x['externalMovements'] for x in state()['items'])
print('Inventory SQL PASS: two receipt prices/weighted average, exact residual/large values, immutable source/replay, serialized stock caps, latest-first atomic storno, period rollback, shared account balance, reader/RLS and relational provenance.')
