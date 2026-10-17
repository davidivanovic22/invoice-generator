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
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261009010000_accounting_fx_bank_posting.sql').read_text(encoding='utf-8'))
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
bank,cash,clearing,fee_account=[uid() for _ in range(4)]
for a,code in [(cash,'244'),(clearing,'289'),(fee_account,'553')]:entity('account',dict(id=a,code=code,name=code,requiresPartner=False,validFrom='2026-01-01'))
user_sql(owner,f"select paperwork_create_fx_bank_account({lit(dict(firmId=firm,id=bank,name='EUR',number='RS35160000999',currency='EUR',cashAccountId=cash))},'{uid()}');")
def fresh(direction='receivable',amount='10000'):
 p=uid();entity('partner',dict(id=p,name='Split partner'));d=create(direction,amount,p=p);user_sql(owner,cmd('create',d));return d
def imported(amount='10000',incoming=True,day='2026-01-15'):
 external=uid();rows=[dict(externalId=external,bookingDate=day,valueDate=day,incoming=amount if incoming else '0',outgoing='0' if incoming else amount,counterparty='Split partner',reference='',description='Synthetic')]
 d=dict(firmId=firm,bankAccountId=bank,fiscalYearId=year,reference=uid(),startsOn=day,endsOn=day,opening='0',closing=amount if incoming else '-'+amount,rows=rows)
 r=json.loads(user_sql(owner,f"select paperwork_import_fx_bank_statement({lit(d)},'{uid()}');"));v=json.loads(user_sql(owner,f"select paperwork_fx_bank_reconciliation('{firm}','{r['statementId']}');"));return v['rows'][0]['id']
def bc(action,d,key=None):return f"select paperwork_fx_bank_posting_command('{action}',{lit(d)},'{key or uid()}');"
def common(tx,revision,date='2026-01-15'):return dict(firmId=firm,transactionId=tx,expectedRevision=revision,fiscalYearId=year,periodId=period,postingDate=date)
def post(tx,day='2026-01-15',rv='120000000'):return dict(**common(tx,'0',day),journalId=uid(),clearingAccountId=clearing,**rate(rv))
def allocate(tx,rev,p,amount,posrev='1',date='2026-01-15'):return dict(**common(tx,rev,date),journalId=uid(),positionId=p['id'],positionRevision=posrev,foreignMinor=amount,gainAccountId=gain,lossAccountId=loss)
def work(tx,u=owner):return json.loads(user_sql(u,f"select paperwork_fx_bank_workbench('{firm}','{tx}');"))
def cancel_bank(tx,rev,target,position_rev=None,date='2026-01-17'):
 d=dict(**common(tx,rev,date),targetId=target,reason='Synthetic correction')
 if position_rev:d['positionRevision']=position_rev
 return d
p1,p2=fresh(),fresh(amount='6000');tx=imported();d=post(tx);key=uid();r=json.loads(user_sql(owner,bc('post',d,key)))
assert json.loads(user_sql(owner,bc('post',d,key)))==r
denied(owner,bc('post',{**d,'rateMicros':'119000000'},key),'IDEMPOTENCY_REUSE')
assert work(tx)['posting']['remainingRsd']=='1200000' and work(tx)['posting']['attributedBalance']=='-1200000'
denied(owner,reverse(d['journalId']),'ACTIVE_FX_BANK_LINK');denied(reader,bc('allocate',allocate(tx,'1',p1,'4000')),'ACCOUNTING_FORBIDDEN')
a1=allocate(tx,'1',p1,'4000');key=uid();receipt=json.loads(user_sql(owner,bc('allocate',a1,key)));assert json.loads(user_sql(owner,bc('allocate',a1,key)))==receipt
assert position(p1['id'])['analyticBalance']=='702000' and work(tx)['posting']['remainingForeign']=='6000'
a2=allocate(tx,'2',p2,'6000');user_sql(owner,bc('allocate',a2));w=work(tx)
assert w['revision']=='3' and w['posting']['remainingRsd']=='0' and w['posting']['attributedBalance']=='0'
assert position(p2['id'])['analyticBalance']=='0'
assert run(f"select sum(debit-credit) from paperwork_journal_lines where firm_id='{firm}' and account_id='{cash}';")=='1200000'
assert run(f"select count(*) from paperwork_journal_lines where firm_id='{firm}' and account_id='{cash}';")=='1'
assert position(p1['id'])['settlements'][0]['sourceId']==position(p2['id'])['settlements'][0]['sourceId']
assert position(p1['id'])['settlements'][0]['bank']['previousForeign']=='10000'
denied(owner,bc('fee',dict(**common(tx,'3'),journalId=uid(),foreignMinor='1',feeAccountId=fee_account)),'FX_BANK_CAP')
denied(owner,bc('cancel_bank',cancel_bank(tx,'3',d['journalId'])),'FX_BANK_ACTIVE_DEPENDENCIES')
denied(owner,cmd('cancel_settlement',dict(firmId=firm,id=p1['id'],expectedRevision='2',settlementId=a1['journalId'],periodId=period,postingDate='2026-01-17',reason='Bypass')),'FX_BANK_USE_CANCELLATION')
v=revalue(p1['id'],'2','118000000');user_sql(owner,cmd('revalue',v))
denied(owner,bc('cancel_allocation',cancel_bank(tx,'3',a1['journalId'],'3')),'FX_REVERSE_LATEST_FIRST')
assert work(tx)['revision']=='3' and not work(tx)['cancellations']
user_sql(owner,cmd('cancel',cancel(p1['id'],v['journalId'],'3')))
user_sql(owner,bc('cancel_allocation',cancel_bank(tx,'3',a1['journalId'],'4')));assert work(tx)['posting']['remainingRsd']=='480000'
user_sql(owner,bc('cancel_allocation',cancel_bank(tx,'4',a2['journalId'],'2')))
user_sql(owner,bc('cancel_bank',cancel_bank(tx,'5',d['journalId'])));assert work(tx)['posting']['closed'] and work(tx)['posting']['attributedBalance']=='0'
assert work(tx)['posting']['remainingForeign']=='0'
# Outgoing principal plus fee, distinct from an incoming net-of-fee claim.
p3=fresh('payable');out=imported('10500',False,'2026-01-18');d=post(out,'2026-01-18');user_sql(owner,bc('post',d))
bad=allocate(out,'1',p1,'100','5','2026-01-18');denied(owner,bc('allocate',bad),'FX_BANK_PAYMENT_CONFLICT')
a3=allocate(out,'1',p3,'10000',date='2026-01-18');user_sql(owner,bc('allocate',a3));fd=dict(**common(out,'2','2026-01-18'),journalId=uid(),foreignMinor='500',feeAccountId=fee_account)
user_sql(owner,bc('fee',fd));assert work(out)['posting']['remainingForeign']=='0' and work(out)['posting']['attributedBalance']=='0'
assert position(p3['id'])['settlements'][0]['delta']=='30000'
denied(owner,reverse(fd['journalId']),'ACTIVE_FX_BANK_LINK')
denied(owner,bc('cancel_bank',cancel_bank(out,'3',d['journalId'],date='2026-01-18')),'FX_BANK_ACTIVE_DEPENDENCIES')
user_sql(owner,bc('cancel_fee',cancel_bank(out,'3',fd['journalId'],date='2026-01-18')));assert work(out)['posting']['remainingRsd']=='60000'
# Scope, period rollback, exact residual and serialized concurrency.
assert work(out,reader)['allocations'];denied(stranger,f"select paperwork_fx_bank_workbench('{firm}','{out}');",'ACCOUNTING_FORBIDDEN')
assert user_sql(stranger,f"select count(*) from paperwork_fx_bank_postings where firm_id='{firm}';")=='0'
race=imported('10000',True,'2026-01-19');rd=post(race,'2026-01-19');user_sql(owner,bc('post',rd));rp1,rp2=fresh(),fresh()
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda p:execute(identity(owner)+bc('allocate',allocate(race,'1',p,'4000',date='2026-01-19'))),[rp1,rp2]))
assert sum(r.returncode==0 for r in results)==1 and work(race)['revision']=='2'
denied(owner,bc('fee',dict(**common(race,'2','2026-01-19'),journalId=uid(),foreignMinor='100',feeAccountId=fee_account)),'FX_BANK_FEE_DIRECTION')
denied(owner,bc('allocate',allocate(race,'2',rp1,'6001','2','2026-01-19')),'FX_BANK_CAP')
period_rev=run(f"select revision from paperwork_accounting_periods where firm_id='{firm}' and id='{period}';")
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','closed','{period_rev}','Closed fixture');")
closed_tx=imported('100',True,'2026-01-22');denied(owner,bc('post',post(closed_tx,'2026-01-22')),'CLOSED_PERIOD');assert work(closed_tx)['posting'] is None
denied(owner,bc('fee',dict(**common(out,'4','2026-01-19'),journalId=uid(),foreignMinor='500',feeAccountId=fee_account)),'CLOSED_PERIOD');assert work(out)['revision']=='4'
denied(owner,bc('cancel_fee',cancel_bank(out,'4',fd['journalId'],date='2026-01-19')))
before=work(race)['revision']
available=next(p for p in [rp1,rp2] if position(p['id'])['revision']=='1')
denied(owner,bc('allocate',allocate(race,'2',available,'6000',date='2026-01-19')),'CLOSED_PERIOD');assert work(race)['revision']==before
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','open','{int(period_rev)+1}','Open fixture');")
denied(owner,f"delete from paperwork_fx_bank_allocations where firm_id='{firm}';")
assert execute(f"update paperwork_fx_bank_postings set rsd_minor=1 where firm_id='{firm}';").returncode
assert run("select count(*) from information_schema.columns where table_schema='public' and table_name like 'paperwork_fx_bank_%' and data_type in('json','jsonb');")=='0'
# Bank RSD is converted once: three one-cent allocations must sum to the booked five RSD cents.
tiny=imported('3',True,'2026-01-20');td=post(tiny,'2026-01-20','1500000');user_sql(owner,bc('post',td))
for i,expected in enumerate(['2','2','1']):
 p=fresh(amount='1');ad=allocate(tiny,str(i+1),p,'1',date='2026-01-20');user_sql(owner,bc('allocate',ad));assert position(p['id'])['settlements'][0]['paidRsd']==expected
assert work(tiny)['posting']['remainingRsd']=='0' and work(tiny)['posting']['attributedBalance']=='0'
# Beyond JS Number precision, allocating all but one unit and then the final residual stays exact.
large=imported('900719925474099301',True,'2026-01-21');ld=post(large,'2026-01-21','1000000');user_sql(owner,bc('post',ld));lp=fresh(amount='900719925474099301')
user_sql(owner,bc('allocate',allocate(large,'1',lp,'900719925474099300',date='2026-01-21')));assert work(large)['posting']['remainingRsd']=='1'
user_sql(owner,bc('allocate',allocate(large,'2',lp,'1','2','2026-01-21')));assert work(large)['posting']['remainingForeign']=='0'
print('FX bank posting SQL PASS: cash once, multi-position clearing allocations, exact RSD/FX caps, outgoing fees/unallocated balance, realized differences, dependency-aware bank/fee/position storno, atomic rollback/replay/race, scope/RLS and immutable relational provenance.')
