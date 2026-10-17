"""Current partner cards, evidence aging inputs and explicit ledger differences. Disposable DB only."""
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
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261008210000_accounting_partner_reports.sql').read_text(encoding='utf-8'))
owner,viewer,stranger=[uid() for _ in range(3)]
for u in [owner,viewer,stranger]:run(f"insert into auth.users(id,email) values('{u}','partner-report-{u}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('Partner report fixture','PART-{uid()}');")
other=user_sql(owner,f"select paperwork_connect_firm('Other partner firm','OTHER-{uid()}');")
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{viewer}','viewer');")
year,prior,period,prior_period,partner,bank,clearing,receivable,income,bank_source,advance_account,other_partner=[uid() for _ in range(12)]
def entity(kind,data):return user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','{kind}',{lit(data)});")
for y,p,label in [(year,period,2026),(prior,prior_period,2025)]:
 entity('year',dict(id=y,label=label,startsOn=f'{label}-01-01',endsOn=f'{label}-12-31'))
 entity('period',dict(id=p,fiscalYearId=y,startsOn=f'{label}-01-01',endsOn=f'{label}-12-31'))
for id,name in [(partner,'=Literal partner'),(other_partner,'Other buyer')]:entity('partner',dict(id=id,name=name))
for id,code,required in [(bank,'241',False),(clearing,'299',False),(receivable,'204',True),(income,'614',False),(advance_account,'430',False)]:entity('account',dict(id=id,code=code,name=code,requiresPartner=required,validFrom='2025-01-01'))
user_sql(owner,f"select paperwork_create_bank_account({lit(dict(firmId=firm,id=bank_source,name='Statement source',number='16000000000000400',currency='RSD'))},'{uid()}');")
def draft(amount,direction='outgoing',date='2026-01-01',account=None,reversed=False):
 debit=(direction=='outgoing')!=reversed
 return dict(id=uid(),firmId=firm,fiscalYearId=prior if date.startswith('2025') else year,periodId=prior_period if date.startswith('2025') else period,postingDate=date,description='=Literal journal',lines=[dict(id='partner',accountId=account or receivable,partnerId=partner,debit=amount if debit else '0',credit='0' if debit else amount,description='=Literal line'),dict(id='base',accountId=income,debit='0' if debit else amount,credit=amount if debit else '0',description='Base')])
def doc(amount='10001',direction='outgoing',book=True,kind='invoice',reference=None,date='2026-01-01',due='2026-01-31'):
 id=uid();data=dict(id=id,firmId=firm,partnerId=partner,direction=direction,kind=kind,referenceId=reference,number=uid(),documentDate=date,dueDate=due,description='Source',currency='RSD',lines=[dict(id='one',description='Source',net=amount,tax='0')])
 user_sql(owner,f"select paperwork_business_document_command('save',{lit(data)},'0','{uid()}');")
 for action in ['approve','issue']:user_sql(owner,f"select paperwork_business_document_command('{action}',{lit(dict(firmId=firm,id=id))},'1','{uid()}');")
 if book:post_doc(id,amount,direction,kind,date)
 return id
def post_doc(id,amount,direction='outgoing',kind='invoice',date='2026-01-01'):
 data=draft(amount,direction,date,receivable,kind=='credit_note')
 if kind=='advance':data['lines'][1]['accountId']=advance_account
 user_sql(owner,f"select paperwork_post_document_journal('{id}','2',{lit(data)},'0','{uid()}');");return data['id']
def query(p=None,f=None):return f"select paperwork_partner_report('{f or firm}',{'null' if p is None else chr(39)+p+chr(39)});"
def report(user=owner,p=None):return json.loads(user_sql(user,query(p)))
def row(id):return next(d for d in report()['documents'] if d['id']==id)
invoice=doc();unposted=doc('200',book=False);supplier=doc('300',direction='incoming');advance=doc('4001',kind='advance');historical=doc('999',date='2025-01-01',due='2025-12-31')
assert row(invoice)['difference']=='0' and row(invoice)['hasControlAccount'] and row(invoice)['unpostedEvidenceCount']=='0'
assert row(unposted)['difference']=='-200' and row(unposted)['sourceStatus']=='unposted'
assert row(supplier)['ledgerBalance']=='-300' and row(supplier)['difference']=='0'
assert row(advance)['ledgerBalance'] is None and row(advance)['difference'] is None
assert row(historical)['ledgerBalance']=='999'
# Unbooked corrections change evidence before the ledger, then converge when posted.
credit=doc('1000',book=False,kind='credit_note',reference=invoice)
assert row(invoice)['difference']=='1000' and row(invoice)['unpostedEvidenceCount']=='1'
credit_journal=post_doc(credit,'1000',kind='credit_note');assert row(invoice)['difference']=='0'
user_sql(owner,f"select paperwork_reverse_journal('{firm}','{credit_journal}','{period}','2026-01-16','Correction reversal','1','{uid()}');")
assert row(invoice)['difference']=='1000'  # Issued evidence persists after a ledger reversal.
deposit=dict(firmId=firm,bankAccountId=bank_source,fiscalYearId=year,reference=uid(),startsOn='2026-01-01',endsOn='2026-01-31',opening='0',closing='4001',rows=[dict(externalId=uid(),bookingDate='2026-01-10',valueDate='2026-01-10',incoming='4001',outgoing='0',counterparty='Buyer',reference='',description='Source')])
saved=json.loads(user_sql(owner,f"select paperwork_import_bank_statement({lit(deposit)},'{uid()}');"))
tx=json.loads(user_sql(owner,f"select paperwork_read_bank_statement('{firm}','{saved['statementId']}');"))['rows'][0]['id']
allocation=uid();user_sql(owner,f"select paperwork_payment_command('allocate',{lit(dict(firmId=firm,id=allocation,transactionId=tx,documentId=invoice,documentRevision='2',kind='payment',refundOf=None,amount='4001'))},'{uid()}');")
assert row(invoice)['evidence']['due']=='5000' and row(invoice)['difference']=='5001' and row(invoice)['unpostedEvidenceCount']=='2'
for action in ['bank','allocation']:
 data=dict(firmId=firm,transactionId=tx,journalId=uid(),fiscalYearId=year,periodId=period,postingDate='2026-01-15')
 data.update(dict(bankAccountId=bank,clearingAccountId=clearing) if action=='bank' else dict(allocationId=allocation,documentAccountId=receivable))
 user_sql(owner,f"select paperwork_payment_ledger_command('{action}',{lit(data)},'{uid()}');")
assert row(invoice)['ledgerBalance']=='6000' and row(invoice)['difference']=='1000' and row(invoice)['unpostedEvidenceCount']=='1'
# Opposite discrepancies can net to zero: an unposted refund offsets the reversed credit.
outgoing={**deposit,'reference':uid(),'closing':'-1000','rows':[{**deposit['rows'][0],'externalId':uid(),'incoming':'0','outgoing':'1000'}]}
saved_refund=json.loads(user_sql(owner,f"select paperwork_import_bank_statement({lit(outgoing)},'{uid()}');"))
refund_tx=json.loads(user_sql(owner,f"select paperwork_read_bank_statement('{firm}','{saved_refund['statementId']}');"))['rows'][0]['id']
refund=uid();user_sql(owner,f"select paperwork_payment_command('allocate',{lit(dict(firmId=firm,id=refund,transactionId=refund_tx,documentId=invoice,documentRevision='2',kind='refund',refundOf=allocation,amount='1000'))},'{uid()}');")
assert row(invoice)['difference']=='0' and row(invoice)['unpostedEvidenceCount']=='2'
user_sql(owner,f"select paperwork_payment_command('cancel',{lit(dict(firmId=firm,id=refund,transactionId=refund_tx,documentId=invoice,expectedRevision='1',reason='Refund correction'))},'{uid()}');")
assert row(invoice)['difference']=='1000' and row(invoice)['unpostedEvidenceCount']=='1'
user_sql(owner,f"select paperwork_payment_command('cancel',{lit(dict(firmId=firm,id=allocation,transactionId=tx,documentId=invoice,expectedRevision='1',reason='Payment correction',periodId=period,postingDate='2026-01-16'))},'{uid()}');")
assert row(invoice)['ledgerBalance']=='10001' and row(invoice)['difference']=='1000'
# Active advance transfer changes invoice evidence and only its source analytical accounts.
application=uid();user_sql(owner,f"select paperwork_advance_command('apply',{lit(dict(firmId=firm,id=application,expectedRevision='0',advanceId=advance,invoiceId=invoice,advanceRevision='2',invoiceRevision='2',net='500',tax='0',invoiceAccountId=receivable,advanceAccountId=advance_account,fiscalYearId=year,periodId=period,postingDate='2026-01-15'))},'{uid()}');")
assert row(invoice)['ledgerBalance']=='9501' and row(invoice)['difference']=='1000' and row(invoice)['evidence']['advances']=='500'
assert row(advance)['appliedOut']=='500' and row(advance)['ledgerBalance'] is None
user_sql(owner,f"select paperwork_advance_command('cancel',{lit(dict(firmId=firm,id=application,expectedRevision='1',advanceId=advance,invoiceId=invoice,advanceRevision='2',invoiceRevision='2',periodId=period,postingDate='2026-01-16',reason='Transfer correction'))},'{uid()}');")
assert row(invoice)['ledgerBalance']=='10001' and row(advance)['appliedOut']=='0'
# Independent opening/manual entries are displayed, never silently netted into document controls.
manual=draft('900719925474099301');user_sql(owner,f"select paperwork_post_journal({lit(manual)},'0','{uid()}');")
r=report();a=next(a for a in r['accounts'] if a['accountId']==receivable)
assert a['unlinkedBalance']=='900719925474099301'
assert int(a['balance'])==sum(int(l['debit'])-int(l['credit']) for l in r['lines'] if l['accountId']==receivable)
assert row(invoice)['difference']=='1000' and any(l['reversalOf'] for l in r['lines'])
for d in r['documents']:
 if d['kind']=='invoice':assert int(d['ledgerBalance'])==sum(int(l['debit'])-int(l['credit']) for l in r['lines'] if l['partnerId']==d['partnerId'] and l['accountId'] in d['controlAccountIds'] and l['journalId'] in d['journalIds'])
# A zero evidence amount with a reversed source is explicitly not declared reconciled.
source=run(f"select journal_id from paperwork_document_journals where firm_id='{firm}' and document_id='{supplier}';")
user_sql(owner,f"select paperwork_reverse_journal('{firm}','{source}','{period}','2026-01-16','Source correction','1','{uid()}');")
assert row(supplier)['sourceStatus']=='reversed' and row(supplier)['difference']=='300'
r=report();rv=report(viewer);assert {k:v for k,v in r.items() if k!='generatedAt'}=={k:v for k,v in rv.items() if k!='generatedAt'}
assert report(p=other_partner)['lines']==[] and report(p=other_partner)['documents']==[]
assert all(l['partnerId']==partner for l in report(p=partner)['lines'])
denied(stranger,query(),'ACCOUNTING_FORBIDDEN');denied(owner,query(uid()),'INVALID_PARTNER');denied(viewer,query(f=other),'ACCOUNTING_FORBIDDEN')
assert execute('set role anon;'+query()).returncode
agency=uid();user_sql(owner,f"select paperwork_create_agency('{agency}','Report agency');")
user_sql(owner,f"select paperwork_set_agency_member('{agency}','{stranger}',true);")
user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','read',true);")
user_sql(owner,f"select paperwork_set_agency_assignment('{firm}','{agency}','{stranger}','read',true);")
assert len(report(stranger)['documents'])==len(r['documents'])
user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','read',false);");denied(stranger,query(),'ACCOUNTING_FORBIDDEN')
before=run(f"select count(*) from paperwork_accounting_events where firm_id='{firm}';")
utc=json.loads(user_sql(owner,"set timezone='Europe/Belgrade';"+query()))
assert utc['generatedAt'].endswith('+00:00') and all(l['postedAt'].endswith('+00:00') for l in utc['lines'])
assert run(f"select count(*) from paperwork_accounting_events where firm_id='{firm}';")==before
# No workspace truncation; narrowing to another partner remains possible after overflow.
template=json.dumps(draft('1')).replace("'","''")
user_sql(owner,f"do $$declare n int;d jsonb;begin for n in 1..101 loop d:='{template}'::jsonb||jsonb_build_object('id',gen_random_uuid());perform paperwork_post_journal(d,'0',gen_random_uuid()::text);end loop;end $$;select 'ok';")
assert len(report()['lines'])>100
run(f"begin;insert into paperwork_journals(firm_id,id,fiscal_year_id,period_id,posting_date,description,number,posted_by) select '{firm}',md5('{firm}'||'-cap-'||n)::uuid,'{year}','{period}','2026-01-25','Cap','CAP-'||n,'{owner}' from generate_series(1,20)n;insert into paperwork_journal_lines(firm_id,journal_id,id,account_id,partner_id,debit,credit,description,account_code,account_name) select '{firm}',md5('{firm}'||'-cap-'||j)::uuid,n::text,case when n<=500 then '{receivable}'::uuid else '{income}'::uuid end,case when n<=500 then '{partner}'::uuid end,case when n<=500 then 1 else 0 end,case when n>500 then 1 else 0 end,'Cap','cap','cap' from generate_series(1,20)j cross join generate_series(1,1000)n;commit;")
denied(owner,query(),'REPORT_TOO_LARGE');assert report(p=other_partner)['accounts']==[]
# The document cap also applies when there are no ledger lines for that partner.
run(f"insert into paperwork_business_documents(firm_id,id,partner_id,direction,kind,number,document_date,due_date,description,revision,lifecycle,partner_name,saved_by,issued_by,issued_at) select '{firm}',md5('{firm}'||'-doc-cap-'||n)::uuid,'{other_partner}','outgoing','invoice','DOC-CAP-'||n,'2026-01-01','2026-01-31','Document cap fixture',2,'issued','Other buyer','{owner}','{owner}',now() from generate_series(1,5001)n;")
denied(owner,query(other_partner),'REPORT_TOO_LARGE')
print('Partner reports SQL PASS: all years, complete cards, exact totals, invoice/advance separation, unposted evidence differences, correction/payment/storno controls, manual entries, reader/agency revoke, UTC, no writes, >100 and explicit overflow.')
