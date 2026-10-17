"""Explicit bank/settlement journals and atomic cancellation, disposable local DB only."""
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
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261008180000_accounting_payment_ledger.sql').read_text(encoding='utf-8'))
owner,viewer,stranger=[uid() for _ in range(3)]
for u in [owner,viewer,stranger]:run(f"insert into auth.users(id,email) values('{u}','pay-ledger-{u}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('Ledger payment fixture','PAY-L-{uid()}');")
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{viewer}','viewer');")
year,period,partner,bank,clearing,receivable,income,bank_source=[uid() for _ in range(8)]
def entity(kind,data):return user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','{kind}',{lit(data)});")
entity('year',dict(id=year,label=2026,startsOn='2026-01-01',endsOn='2026-12-31'))
entity('period',dict(id=period,fiscalYearId=year,startsOn='2026-01-01',endsOn='2026-01-31'))
entity('partner',dict(id=partner,name='Confirmed buyer'))
for id,code,required in [(bank,'241',False),(clearing,'299',False),(receivable,'204',True),(income,'614',False)]:entity('account',dict(id=id,code=code,name=code,requiresPartner=required,validFrom='2026-01-01'))
user_sql(owner,f"select paperwork_create_bank_account({lit(dict(firmId=firm,id=bank_source,name='Real bank source',number='16000000000000400',currency='RSD'))},'{uid()}');")
def doc(amount='10001',direction='outgoing',book=True,kind='invoice'):
 id=uid();data=dict(id=id,firmId=firm,partnerId=partner,direction=direction,kind=kind,referenceId=None,number=uid(),documentDate='2026-01-01',dueDate='2026-01-31',description='Source',currency='RSD',lines=[dict(id='one',description='Source',net=amount,tax='0')])
 user_sql(owner,f"select paperwork_business_document_command('save',{lit(data)},'0','{uid()}');")
 for action in ['approve','issue']:user_sql(owner,f"select paperwork_business_document_command('{action}',{lit(dict(firmId=firm,id=id))},'1','{uid()}');")
 if book:
  debit=direction=='outgoing';draft=dict(id=uid(),firmId=firm,fiscalYearId=year,periodId=period,postingDate='2026-01-01',description='Document source',lines=[dict(id='partner',accountId=receivable,partnerId=partner,debit=amount if debit else '0',credit='0' if debit else amount,description=''),dict(id='base',accountId=income,debit='0' if debit else amount,credit=amount if debit else '0',description='')])
  user_sql(owner,f"select paperwork_post_document_journal('{id}','2',{lit(draft)},'0','{uid()}');")
 return id
def tx(amount='15001',incoming=True):
 data=dict(firmId=firm,bankAccountId=bank_source,fiscalYearId=year,reference=uid(),startsOn='2026-01-01',endsOn='2026-01-31',opening='0',closing=amount if incoming else '-'+amount,rows=[dict(externalId=uid(),bookingDate='2026-01-10',valueDate='2026-01-10',incoming=amount if incoming else '0',outgoing='0' if incoming else amount,counterparty='Buyer',reference='',description='Source')])
 receipt=json.loads(user_sql(owner,f"select paperwork_import_bank_statement({lit(data)},'{uid()}');"))
 return json.loads(user_sql(owner,f"select paperwork_read_bank_statement('{firm}','{receipt['statementId']}');"))['rows'][0]['id']
def allocation(tx,document,amount,refund=None):
 data=dict(firmId=firm,id=uid(),transactionId=tx,documentId=document,documentRevision='2',kind='refund' if refund else 'payment',refundOf=refund,amount=amount)
 user_sql(owner,f"select paperwork_payment_command('allocate',{lit(data)},'{uid()}');");return data['id']
def payload(tx,allocation=None):
 common=dict(firmId=firm,transactionId=tx,journalId=uid(),fiscalYearId=year,periodId=period,postingDate='2026-01-15')
 return {**common,**(dict(allocationId=allocation,documentAccountId=receivable) if allocation else dict(bankAccountId=bank,clearingAccountId=clearing))}
def cmd(data,key=None):return f"select paperwork_payment_ledger_command('{'allocation' if 'allocationId' in data else 'bank'}',{lit(data)},'{key or uid()}');"
def state(tx,user=owner):
 value=json.loads(user_sql(user,f"select paperwork_payment_workbench('{firm}','{tx}');"))
 evidence=value['reconciliation'];ledger=value['ledger']
 for link in ledger['allocations']:
  source=next(a for a in evidence['allocations'] if a['id']==link['id'])
  assert (source['status']=='active')==(link['reversalId'] is None)
 return ledger
def reverse(journal):return f"select paperwork_reverse_journal('{firm}','{journal}','{period}','2026-01-16','Direct reversal','1','{uid()}');"
def cancel(a,tx,doc,key=None):return f"select paperwork_payment_command('cancel',{lit(dict(firmId=firm,id=a,transactionId=tx,documentId=doc,expectedRevision='1',reason='Payment correction',periodId=period,postingDate='2026-01-16'))},'{key or uid()}');"
invoice=doc();deposit=tx();first=allocation(deposit,invoice,'4001');second=allocation(deposit,invoice,'6000')
assert state(deposit)['bank'] is None
bank_data=payload(deposit);key=uid()
denied(viewer,cmd(bank_data),'ACCOUNTING_FORBIDDEN');denied(stranger,cmd(bank_data),'ACCOUNTING_FORBIDDEN')
denied(owner,cmd({**bank_data,'clearingAccountId':bank}),'INVALID_BANK_LEDGER_ACCOUNTS')
denied(owner,cmd({**bank_data,'bankAccountId':receivable}),'INVALID_BANK_LEDGER_ACCOUNTS')
denied(owner,cmd({**bank_data,'postingDate':'2026-01-09'}),'INVALID_PAYMENT_DATE')
receipt=json.loads(user_sql(owner,cmd(bank_data,key)));assert receipt['journalId']==bank_data['journalId'] and receipt['allocationId'] is None
assert json.loads(user_sql(owner,cmd(bank_data,key)))==receipt
denied(owner,cmd({**bank_data,'postingDate':'2026-01-16'},key),'IDEMPOTENCY_REUSE')
denied(owner,cmd(payload(deposit)),'DUPLICATE_SOURCE')
assert state(deposit,viewer)['bank']['clearingRemaining']=='15001'
posted=json.loads(user_sql(owner,f"select paperwork_read_journal('{firm}','{receipt['journalId']}');"))
assert next(l for l in posted['draft']['lines'] if l['accountId']==bank)['debit']=='15001'
first_data=payload(deposit,first);first_key=uid();first_receipt=json.loads(user_sql(owner,cmd(first_data,first_key)))
assert json.loads(user_sql(owner,cmd(first_data,first_key)))==first_receipt
assert state(deposit)['bank']['clearingRemaining']=='11000';assert state(deposit)['allocations'][0]['accountRemaining']=='6000'
denied(owner,cmd({**payload(deposit,second),'documentAccountId':income}),'INVALID_PAYMENT_DOCUMENT_ACCOUNT')
second_data=payload(deposit,second)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:execute(identity(owner)+cmd({**second_data,'journalId':uid()})),range(2)))
assert sum(r.returncode==0 for r in results)==1
assert state(deposit)['bank']['clearingRemaining']=='5000'
assert all(a['accountRemaining']=='0' for a in state(deposit)['allocations'])
advance=doc('4001',kind='advance')
advance_application=dict(firmId=firm,id=uid(),expectedRevision='0',advanceId=advance,invoiceId=invoice,advanceRevision='2',invoiceRevision='2',net='1000',tax='0',invoiceAccountId=receivable,advanceAccountId=income,fiscalYearId=year,periodId=period,postingDate='2026-01-15')
denied(owner,f"select paperwork_advance_command('apply',{lit(advance_application)},'{uid()}');",'INVALID_ADVANCE_ACCOUNT')
denied(owner,reverse(bank_data['journalId']),'ACTIVE_PAYMENT_LEDGER_LINK')
denied(owner,reverse(first_data['journalId']),'ACTIVE_PAYMENT_LEDGER_LINK')
source=run(f"select journal_id from paperwork_document_journals where firm_id='{firm}' and document_id='{invoice}';")
denied(owner,reverse(source),'ACTIVE_PAYMENT_LEDGER_LINK')
refund_tx=tx('3000',False);refund=allocation(refund_tx,invoice,'2000',first)
denied(owner,cancel(first,deposit,invoice),'ACTIVE_PAYMENT_REFUNDS')
user_sql(owner,cmd(payload(refund_tx)));refund_data=payload(refund_tx,refund);user_sql(owner,cmd(refund_data))
assert state(refund_tx)['bank']['clearingRemaining']=='1000';assert state(refund_tx)['allocations'][0]['accountRemaining']=='2000'
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','closed','1','Close fixture');")
denied(owner,cancel(refund,refund_tx,invoice),'CLOSED_PERIOD')
assert run(f"select count(*) from paperwork_payment_cancellations where firm_id='{firm}' and allocation_id='{refund}';")=='0'
assert run(f"select count(*) from paperwork_journals where firm_id='{firm}' and reversal_of='{refund_data['journalId']}';")=='0'
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','open','2','Open fixture');")
cancel_key=uid();cancel_receipt=json.loads(user_sql(owner,cancel(refund,refund_tx,invoice,cancel_key)))
assert json.loads(user_sql(owner,cancel(refund,refund_tx,invoice,cancel_key)))==cancel_receipt
assert state(refund_tx)['bank']['clearingRemaining']=='3000' and state(refund_tx)['allocations'][0]['reversalId']
assert state(refund_tx)['allocations'][0]['accountRemaining']=='0'
user_sql(owner,cancel(first,deposit,invoice));assert state(deposit)['bank']['clearingRemaining']=='9001'
# Exact values above JS safe integer and incoming supplier direction.
wide=doc('900719925474099301');wide_tx=tx('900719925474099301');wide_a=allocation(wide_tx,wide,'900719925474099301')
user_sql(owner,cmd(payload(wide_tx)));user_sql(owner,cmd(payload(wide_tx,wide_a)));assert state(wide_tx)['bank']['clearingRemaining']=='0'
supplier=doc(direction='incoming');supplier_tx=tx('10001',False);supplier_a=allocation(supplier_tx,supplier,'10001')
user_sql(owner,cmd(payload(supplier_tx)));supplier_data=payload(supplier_tx,supplier_a);user_sql(owner,cmd(supplier_data))
supplier_journal=json.loads(user_sql(owner,f"select paperwork_read_journal('{firm}','{supplier_data['journalId']}');"))
assert next(l for l in supplier_journal['draft']['lines'] if l['accountId']==receivable)['debit']=='10001'
unbooked=doc(book=False);unbooked_tx=tx('10001');unbooked_a=allocation(unbooked_tx,unbooked,'10001');user_sql(owner,cmd(payload(unbooked_tx)))
denied(owner,cmd(payload(unbooked_tx,unbooked_a)),'INVALID_PAYMENT_DOCUMENT_ACCOUNT')
denied(stranger,f"select paperwork_payment_ledger_workspace('{firm}','{deposit}');",'ACCOUNTING_FORBIDDEN')
assert user_sql(stranger,'select count(*) from paperwork_payment_journals;')=='0'
denied(owner,f"delete from paperwork_bank_journals where firm_id='{firm}';")
assert execute(f"update paperwork_payment_journals set document_account_id='{income}' where firm_id='{firm}';").returncode
assert run("select count(*) from information_schema.columns where table_schema='public' and table_name in ('paperwork_bank_journals','paperwork_payment_journals','paperwork_payment_ledger_requests') and data_type in ('json','jsonb');")=='0'
print('PASS: full bank/clearing journals, exact partial allocation balances, supplier/refund directions, source/period/date/account guards, replay/race, dependent reversal blocking, atomic cancellation/storno rollback, RLS and immutable links.')
