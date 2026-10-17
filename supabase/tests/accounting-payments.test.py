"""Bank allocation/refund evidence. Only disposable local databases are accepted."""
import concurrent.futures,json,os,re,subprocess,uuid,sys
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
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261008160000_accounting_payments.sql').read_text(encoding='utf-8'))
owner,viewer,stranger=[uid() for _ in range(3)]
for u in [owner,viewer,stranger]:run(f"insert into auth.users(id,email) values('{u}','pay-{u}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('Payment fixture','PAY-{uid()}');")
other=user_sql(owner,f"select paperwork_connect_firm('Foreign payment fixture','PAY-{uid()}');")
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{viewer}','viewer');")
year,partner,account=[uid() for _ in range(3)]
for kind,data in [('year',dict(id=year,label=2026,startsOn='2026-01-01',endsOn='2026-12-31')),('partner',dict(id=partner,name='Evidence partner'))]:
 user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','{kind}',{lit(data)});")
user_sql(owner,f"select paperwork_create_bank_account({lit(dict(firmId=firm,id=account,name='Operating',number='16000000000000300',currency='RSD'))},'{uid()}');")
def document(number,amount='10001',direction='outgoing',kind='invoice',reference=None):
 id=uid();data=dict(id=id,firmId=firm,partnerId=partner,direction=direction,kind=kind,referenceId=reference,number=number,documentDate='2026-01-01',dueDate='2026-01-31',description=number,currency='RSD',lines=[dict(id='one',description=number,net=amount,tax='0')])
 user_sql(owner,f"select paperwork_business_document_command('save',{lit(data)},'0','{uid()}');")
 for action in ['approve','issue']:user_sql(owner,f"select paperwork_business_document_command('{action}',{lit(dict(firmId=firm,id=id))},'1','{uid()}');")
 return id
invoice=document('PAY-INV');second=document('PAY-SECOND');supplier=document('PAY-SUPPLIER',direction='incoming');advance=document('PAY-ADV',kind='advance');wide=document('PAY-WIDE','900719925474099301')
def bank_tx(amount,incoming=True,date='2026-01-10'):
 data=dict(firmId=firm,bankAccountId=account,fiscalYearId=year,reference=uid(),startsOn='2026-01-01',endsOn='2026-01-31',opening='0',closing=amount if incoming else '-'+amount,rows=[dict(externalId=uid(),bookingDate=date,valueDate=date,incoming=amount if incoming else '0',outgoing='0' if incoming else amount,counterparty='Unverified source name',reference='000001',description='Source')])
 receipt=json.loads(user_sql(owner,f"select paperwork_import_bank_statement({lit(data)},'{uid()}');"))
 saved=json.loads(user_sql(owner,f"select paperwork_read_bank_statement('{firm}','{receipt['statementId']}');"));return saved['rows'][0]['id']
deposit=bank_tx('15001');refundtx=bank_tx('10001',False,'2026-01-12');supplier_tx=bank_tx('10001',False);wide_tx=bank_tx('900719925474099301')
def allocate(tx,doc,amount,refund=None):return dict(firmId=firm,id=uid(),transactionId=tx,documentId=doc,documentRevision='2',kind='refund' if refund else 'payment',refundOf=refund,amount=amount)
def cmd(data,action='allocate',key=None):return f"select paperwork_payment_command('{action}',{lit(data)},'{key or uid()}');"
def workspace(tx,user=owner):return json.loads(user_sql(user,f"select paperwork_payment_workspace('{firm}','{tx}');"))
def docstate(doc):return json.loads(user_sql(owner,f"select paperwork_read_business_document('{firm}','{doc}');"))['payment']
p=allocate(deposit,invoice,'4001');key=uid()
denied(viewer,cmd(p),'ACCOUNTING_FORBIDDEN');denied(stranger,cmd(p),'ACCOUNTING_FORBIDDEN')
receipt=json.loads(user_sql(owner,cmd(p,key=key)));assert receipt['allocationId']==p['id'] and receipt['revision']=='1'
assert json.loads(user_sql(owner,cmd(p,key=key)))==receipt
denied(owner,cmd({**p,'amount':'1'},key=key),'IDEMPOTENCY_REUSE')
assert docstate(invoice)=='partial';w=workspace(deposit,viewer);assert w['transaction']['available']=='11000'
assert next(d for d in w['documents'] if d['id']==invoice)['balance']['due']=='6000'
q=allocate(deposit,invoice,'6000');user_sql(owner,cmd(q));assert docstate(invoice)=='paid'
denied(owner,cmd(allocate(deposit,invoice,'1')),'DOCUMENT_PAYMENT_EXCEEDED')
user_sql(owner,cmd(allocate(deposit,second,'5000')));assert workspace(deposit)['transaction']['available']=='0'
denied(owner,cmd(allocate(deposit,second,'1')),'PAYMENT_CAPACITY_EXCEEDED')
denied(owner,cmd(allocate(refundtx,invoice,'1')),'INVALID_PAYMENT_DIRECTION')
denied(owner,cmd(allocate(refundtx,second,'1',p['id'])),'INVALID_REFUND_SOURCE')
r=allocate(refundtx,invoice,'2000',p['id']);user_sql(owner,cmd(r));assert docstate(invoice)=='partial'
denied(owner,cmd(allocate(refundtx,invoice,'2002',p['id'])),'REFUND_CAPACITY_EXCEEDED')
cancelp=dict(firmId=firm,id=p['id'],transactionId=deposit,documentId=invoice,expectedRevision='1',reason='Correction')
denied(owner,cmd(cancelp,'cancel'),'ACTIVE_PAYMENT_REFUNDS')
cancelr=dict(firmId=firm,id=r['id'],transactionId=refundtx,documentId=invoice,expectedRevision='1',reason='Refund correction');cancelkey=uid()
cancelreceipt=json.loads(user_sql(owner,cmd(cancelr,'cancel',cancelkey)));assert cancelreceipt['revision']=='2'
assert json.loads(user_sql(owner,cmd(cancelr,'cancel',cancelkey)))==cancelreceipt
assert docstate(invoice)=='paid';assert workspace(refundtx)['transaction']['available']=='10001'
user_sql(owner,cmd(cancelp,'cancel'));assert docstate(invoice)=='partial';assert workspace(deposit)['transaction']['available']=='4001'
denied(owner,cmd(cancelp,'cancel'),'STALE_REVISION')
denied(owner,cmd({**allocate(deposit,advance,'1'),'documentRevision':'1'}),'STALE_REVISION')
denied(owner,cmd({**allocate(deposit,advance,'1'),'amount':1}),'INVALID_AMOUNT')
denied(owner,cmd({**allocate(deposit,advance,'1'),'documentId':uid()}))
denied(owner,cmd({**allocate(deposit,advance,'1'),'firmId':other}))
user_sql(owner,cmd(allocate(supplier_tx,supplier,'10001')));assert docstate(supplier)=='paid'
user_sql(owner,cmd(allocate(wide_tx,wide,'900719925474099301')));assert docstate(wide)=='paid'
user_sql(owner,cmd(allocate(deposit,advance,'4001')));assert docstate(advance)=='partial'
# Two competing requests cannot spend the same remaining bank/document capacity.
race_doc=document('PAY-RACE','100');race_tx=bank_tx('100');commands=[allocate(race_tx,race_doc,'80') for _ in range(2)]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda data:execute(identity(owner)+cmd(data)),commands))
assert sum(r.returncode==0 for r in results)==1
assert workspace(race_tx)['transaction']['available']=='20'
# A later issued credit exposes overpayment; it never silently truncates bank evidence.
credit=document('PAY-CREDIT','5000',reference=invoice,kind='credit_note');assert docstate(invoice)=='overpaid'
balance=next(d for d in workspace(deposit)['documents'] if d['id']==invoice)['balance'];assert balance['due']=='0' and balance['overpaid']=='999'
refund=q['id'];user_sql(owner,cmd(allocate(refundtx,invoice,'999',refund)));assert docstate(invoice)=='paid'
denied(stranger,f"select paperwork_payment_workspace('{firm}','{deposit}');",'ACCOUNTING_FORBIDDEN')
assert user_sql(stranger,'select count(*) from paperwork_payment_allocations;')=='0'
denied(owner,f"delete from paperwork_payment_allocations where firm_id='{firm}';")
assert execute(f"update paperwork_payment_allocations set amount=1 where firm_id='{firm}';").returncode
assert execute(f"delete from paperwork_payment_cancellations where firm_id='{firm}';").returncode
assert run(f"select count(*) from paperwork_journals where firm_id='{firm}';")=='0'
# Advance transfers settle the final invoice once, while its advance document retains bank evidence.
period,receivable,income,clearing=[uid() for _ in range(4)]
user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','period',{lit(dict(id=period,fiscalYearId=year,startsOn='2026-01-01',endsOn='2026-01-31'))});")
for id,code,required in [(receivable,'204',True),(income,'614',False),(clearing,'430',False)]:
 user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','account',{lit(dict(id=id,code=code,name=code,requiresPartner=required,validFrom='2026-01-01'))});")
applied_advance=document('PAY-APPLIED-ADV','4001',kind='advance');applied_invoice=document('PAY-APPLIED-INV')
for doc,amount,counter in [(applied_advance,'4001',clearing),(applied_invoice,'10001',income)]:
 draft=dict(id=uid(),firmId=firm,fiscalYearId=year,periodId=period,postingDate='2026-01-01',description='Source',lines=[dict(id='partner',accountId=receivable,partnerId=partner,debit=amount,credit='0',description=''),dict(id='base',accountId=counter,debit='0',credit=amount,description='')])
 user_sql(owner,f"select paperwork_post_document_journal('{doc}','2',{lit(draft)},'0','{uid()}');")
application=dict(firmId=firm,id=uid(),expectedRevision='0',advanceId=applied_advance,invoiceId=applied_invoice,advanceRevision='2',invoiceRevision='2',net='4001',tax='0',invoiceAccountId=receivable,advanceAccountId=clearing,fiscalYearId=year,periodId=period,postingDate='2026-01-15')
user_sql(owner,f"select paperwork_advance_command('apply',{lit(application)},'{uid()}');")
mixed_tx=bank_tx('10001');journal_count=run(f"select count(*) from paperwork_journals where firm_id='{firm}';")
user_sql(owner,cmd(allocate(mixed_tx,applied_invoice,'6000')));user_sql(owner,cmd(allocate(mixed_tx,applied_advance,'4001')))
assert docstate(applied_invoice)=='paid' and docstate(applied_advance)=='paid'
assert run(f"select count(*) from paperwork_journals where firm_id='{firm}';")==journal_count
canceladvance=dict(firmId=firm,id=application['id'],expectedRevision='1',periodId=period,postingDate='2026-01-16',reason='Undo advance transfer')
user_sql(owner,f"select paperwork_advance_command('cancel',{lit(canceladvance)},'{uid()}');")
assert docstate(applied_invoice)=='partial' and docstate(applied_advance)=='paid'
mixed_balance=next(d for d in workspace(mixed_tx)['documents'] if d['id']==applied_invoice)['balance']
assert mixed_balance['paid']=='6000' and mixed_balance['advances']=='0' and mixed_balance['due']=='4001'
assert run("select count(*) from information_schema.columns where table_schema='public' and table_name like 'paperwork_payment_%' and data_type in ('json','jsonb');")=='0'
print('PASS: exact partial/multiple payments, unallocated surplus, direction/source/revision caps, linked partial refunds, cancellation dependencies/replay, overpayment after credit, race, RLS/immutability; no automatic ledger posting.')
