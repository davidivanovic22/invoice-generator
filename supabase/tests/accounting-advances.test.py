"""Atomic advance applications, ledger transfers and cancellation; local disposable DB only."""
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
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261008120000_accounting_advances.sql').read_text(encoding='utf-8'))
owner,viewer,stranger=[uid() for _ in range(3)]
for u in [owner,viewer,stranger]:run(f"insert into auth.users(id,email) values('{u}','advances-{u}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('Advance fixture','ADV-{uid()}');")
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{viewer}','viewer');")
year,period,partner,a,b,c=[uid() for _ in range(6)]
def entity(kind,data):user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','{kind}',{lit(data)});")
entity('year',dict(id=year,label=2026,startsOn='2026-01-01',endsOn='2026-12-31'))
entity('period',dict(id=period,fiscalYearId=year,startsOn='2026-01-01',endsOn='2026-01-31'))
entity('partner',dict(id=partner,name='Application partner'))
for account,code,required in [(a,'204',True),(b,'614',False),(c,'430',False)]:entity('account',dict(id=account,code=code,name=code,requiresPartner=required,validFrom='2026-01-01'))
def doc(kind='invoice',net='10000',tax='2000',direction='outgoing',reference=None,book=True):
 d=dict(id=uid(),firmId=firm,partnerId=partner,direction=direction,kind=kind,referenceId=reference,number=uid(),documentDate='2026-01-10',dueDate='2026-01-30',description='Advance fixture',currency='RSD',lines=[dict(id='one',description='Source',net=net,tax=tax)])
 user_sql(owner,f"select paperwork_business_document_command('save',{lit(d)},'0','{uid()}');")
 for action in ['approve','issue']:user_sql(owner,f"select paperwork_business_document_command('{action}',{lit(dict(firmId=firm,id=d['id']))},'1','{uid()}');")
 if book:
  debit=direction=='outgoing';gross=str(int(net)+int(tax));draft=dict(id=uid(),firmId=firm,fiscalYearId=year,periodId=period,postingDate='2026-01-10',description='Source',lines=[dict(id='partner',accountId=a,partnerId=partner,debit=gross if debit else '0',credit='0' if debit else gross,description=''),dict(id='other',accountId=c if kind=='advance' else b,debit='0' if debit else gross,credit=gross if debit else '0',description='')])
  user_sql(owner,f"select paperwork_post_document_journal('{d['id']}','2',{lit(draft)},'0','{uid()}');")
 return d
def apply(advance,invoice,net='4000',tax='800'):
 return dict(firmId=firm,id=uid(),expectedRevision='0',advanceId=advance['id'],invoiceId=invoice['id'],advanceRevision='2',invoiceRevision='2',net=net,tax=tax,invoiceAccountId=a,advanceAccountId=c,fiscalYearId=year,periodId=period,postingDate='2026-01-15')
def cmd(action,data,key=None):return f"select paperwork_advance_command('{action}',{lit(data)},'{key or uid()}');"
def read(invoice,user=owner):return json.loads(user_sql(user,f"select paperwork_advance_workspace('{firm}','{invoice['id']}');"))
def reverse(journal,key=None):return f"select paperwork_reverse_journal('{firm}','{journal}','{period}','2026-01-16','Direct reversal','1','{key or uid()}');"
advance=doc('advance');invoice=doc();value=apply(advance,invoice);key=uid()
denied(viewer,cmd('apply',value),'ACCOUNTING_FORBIDDEN');denied(stranger,cmd('apply',value),'ACCOUNTING_FORBIDDEN')
receipt=json.loads(user_sql(owner,cmd('apply',value,key)));assert receipt['revision']=='1' and receipt['journalId']==value['id']
assert json.loads(user_sql(owner,cmd('apply',value,key)))==receipt
denied(owner,cmd('apply',{**value,'net':'3000'},key),'IDEMPOTENCY_REUSE')
denied(owner,cmd('apply',value),'STALE_REVISION')
state=read(invoice,viewer);assert state['remainingNet']=='6000' and state['remainingTax']=='1200'
assert state['applications'][0]['status']=='active' and state['applications'][0]['reversalId'] is None
posted=json.loads(user_sql(owner,f"select paperwork_read_journal('{firm}','{value['id']}');"))
assert next(l for l in posted['draft']['lines'] if l['accountId']==a)['credit']=='4800'
assert next(l for l in posted['draft']['lines'] if l['accountId']==c)['debit']=='4800'
invoice2=doc();second=apply(advance,invoice2,'1000','200');user_sql(owner,cmd('apply',second))
advance2=doc('advance','5000','1000');third=apply(advance2,invoice,'2000','400');user_sql(owner,cmd('apply',third))
assert read(invoice)['remainingNet']=='4000'
denied(owner,cmd('apply',apply(advance,invoice,'4001','0')),'EXCESS_ADVANCE')
denied(owner,cmd('apply',apply(advance,invoice,'0','801')),'EXCESS_ADVANCE')
denied(owner,cmd('apply',{**apply(advance,invoice),'net':4000}),'INVALID_AMOUNT')
denied(owner,cmd('apply',apply(advance,invoice,'0','0')),'INVALID_ADVANCE_AMOUNT')
denied(owner,cmd('apply',{**apply(advance,invoice),'invoiceAccountId':b}),'INVALID_ADVANCE_ACCOUNT')
denied(owner,cmd('apply',{**apply(advance,invoice),'postingDate':'2026-01-09'}),'INVALID_ADVANCE_AMOUNT')
denied(owner,cmd('apply',apply(doc('advance',book=False),invoice)),'INVALID_ADVANCE_ACCOUNT')
# A source may split tax and base across accounts; one account cannot cover their combined gross.
split=doc('advance',book=False);split_draft=dict(id=uid(),firmId=firm,fiscalYearId=year,periodId=period,postingDate='2026-01-10',description='Split source',lines=[dict(id='a',accountId=a,partnerId=partner,debit='12000',credit='0',description=''),dict(id='b',accountId=c,debit='0',credit='10000',description=''),dict(id='t',accountId=b,debit='0',credit='2000',description='')])
user_sql(owner,f"select paperwork_post_document_journal('{split['id']}','2',{lit(split_draft)},'0','{uid()}');")
denied(owner,cmd('apply',apply(split,doc(),'10000','2000')),'INVALID_ADVANCE_ACCOUNT')
# A posted credit on that selected account also reduces its transferable balance.
split_credit=doc('credit_note','5000','0',reference=split['id'],book=False)
credit_draft=dict(id=uid(),firmId=firm,fiscalYearId=year,periodId=period,postingDate='2026-01-10',description='Posted advance credit',lines=[dict(id='a',accountId=a,partnerId=partner,debit='0',credit='5000',description=''),dict(id='b',accountId=c,debit='5000',credit='0',description='')])
user_sql(owner,f"select paperwork_post_document_journal('{split_credit['id']}','2',{lit(credit_draft)},'0','{uid()}');")
denied(owner,cmd('apply',apply(split,doc(),'5000','2000')),'INVALID_ADVANCE_ACCOUNT')
denied(owner,cmd('apply',apply(advance,doc(direction='incoming'))),'INVALID_ADVANCE_REFERENCE')
denied(stranger,f"select paperwork_advance_workspace('{firm}','{invoice['id']}');",'ACCOUNTING_FORBIDDEN')
assert user_sql(stranger,'select count(*) from paperwork_advance_applications;')=='0'
denied(owner,reverse(value['id']),'ACTIVE_ADVANCE_APPLICATION')
source=run(f"select journal_id from paperwork_document_journals where firm_id='{firm}' and document_id='{advance['id']}';")
denied(owner,reverse(source),'ACTIVE_ADVANCE_APPLICATION')
assert execute(f"update paperwork_advance_applications set net=1 where firm_id='{firm}';").returncode
denied(owner,f"delete from paperwork_advance_applications where firm_id='{firm}';")
# A credit may not consume an amount already used by an active application.
credit=dict(id=uid(),firmId=firm,partnerId=partner,direction='outgoing',kind='credit_note',referenceId=invoice['id'],number=uid(),documentDate='2026-01-15',dueDate='2026-01-30',description='Credit',currency='RSD',lines=[dict(id='one',description='Credit',net='5000',tax='0')])
user_sql(owner,f"select paperwork_business_document_command('save',{lit(credit)},'0','{uid()}');")
user_sql(owner,f"select paperwork_business_document_command('approve',{lit(dict(firmId=firm,id=credit['id']))},'1','{uid()}');")
denied(owner,f"select paperwork_business_document_command('issue',{lit(dict(firmId=firm,id=credit['id']))},'1','{uid()}');",'EXCESS_ADVANCE_CREDIT')
cancel=dict(firmId=firm,id=value['id'],expectedRevision='1',periodId=period,postingDate='2026-01-16',reason='Wrong allocation')
denied(viewer,cmd('cancel',cancel),'ACCOUNTING_FORBIDDEN')
# Closed period causes a rollback of cancellation and reversal together.
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','closed','1','Fixture close');")
denied(owner,cmd('cancel',cancel),'CLOSED_PERIOD');assert read(invoice)['applications'][0]['status']=='active'
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','open','2','Fixture reopen');")
cancel_key=uid();cancelled=json.loads(user_sql(owner,cmd('cancel',cancel,cancel_key)));assert cancelled['revision']=='2'
assert json.loads(user_sql(owner,cmd('cancel',cancel,cancel_key)))==cancelled
state=read(invoice);assert state['remainingNet']=='8000' and state['applications'][0]['status']=='cancelled' and state['applications'][0]['reversalId']==cancelled['journalId']
denied(owner,cmd('cancel',cancel),'STALE_REVISION')
user_sql(owner,f"select paperwork_business_document_command('issue',{lit(dict(firmId=firm,id=credit['id']))},'1','{uid()}');")
assert read(invoice)['remainingNet']=='3000'
# Competing applications against the same available source cannot both commit.
race_advance=doc('advance');race_invoice=doc()
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 results=list(pool.map(lambda v:execute(identity(owner)+cmd('apply',v)),[apply(race_advance,race_invoice,'8000','1600'),apply(race_advance,race_invoice,'8000','1600')]))
assert sum(r.returncode==0 for r in results)==1
# Incoming flow clears the opposite sides, with exact large string amounts.
incoming_advance=doc('advance','900719925474099301','0','incoming');incoming_invoice=doc(net='900719925474099301',tax='0',direction='incoming')
incoming=apply(incoming_advance,incoming_invoice,'900719925474099301','0');user_sql(owner,cmd('apply',incoming))
incoming_posted=json.loads(user_sql(owner,f"select paperwork_read_journal('{firm}','{incoming['id']}');"))
assert next(l for l in incoming_posted['draft']['lines'] if l['accountId']==a)['debit']=='900719925474099301'
assert read(incoming_invoice)['remainingNet']=='0'
assert run("select count(*) from information_schema.columns where table_schema='public' and table_name like 'paperwork_advance_%' and data_type in ('json','jsonb');")=='0'
print('PASS: multiple/partial advances, exact transfer journals, component/account caps, replay/race, source reversal/credit protection, atomic cancellation/storno, incoming direction, RLS and immutable audit.')
