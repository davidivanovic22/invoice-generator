"""Business document transactions and source posting in an isolated local DB."""
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
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261008100000_accounting_documents.sql').read_text(encoding='utf-8'))
owner,viewer,stranger=[uid() for _ in range(3)]
for u in [owner,viewer,stranger]:run(f"insert into auth.users(id,email) values('{u}','documents-{u}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('Document fixture','DOC-{uid()}');")
other=user_sql(owner,f"select paperwork_connect_firm('Other document fixture','DOC-{uid()}');")
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{viewer}','viewer');")
year,period,partner,foreign_partner,a,b=[uid() for _ in range(6)]
def entity(kind,data,target=firm):user_sql(owner,f"select paperwork_create_accounting_entity('{target}','{kind}',{lit(data)});")
entity('year',dict(id=year,label=2026,startsOn='2026-01-01',endsOn='2026-12-31'))
entity('period',dict(id=period,fiscalYearId=year,startsOn='2026-01-01',endsOn='2026-01-31'))
entity('partner',dict(id=partner,name='Buyer'));entity('partner',dict(id=foreign_partner,name='Foreign'),other)
entity('account',dict(id=a,code='204',name='Counterpart',requiresPartner=True,validFrom='2026-01-01'))
entity('account',dict(id=b,code='614',name='Other side',validFrom='2026-01-01'))
def doc(kind='invoice',reference=None,direction='outgoing',net='10000',tax='2000'):
 return dict(id=uid(),firmId=firm,partnerId=partner,direction=direction,kind=kind,referenceId=reference,number=uid(),documentDate='2026-01-15',dueDate='2026-01-30',description='Fixture',currency='RSD',lines=[dict(id='one',description='Service',net=net,tax=tax)])
def cmd(action,data,rev='0',key=None):return f"select paperwork_business_document_command('{action}',{lit(data)},'{rev}','{key or uid()}');"
def action(action,document,rev,key=None):return cmd(action,dict(firmId=firm,id=document),rev,key)
def issue(value):
 user_sql(owner,cmd('save',value));user_sql(owner,action('approve',value['id'],'1'));user_sql(owner,action('issue',value['id'],'1'))
value=doc(net='900719925474099301',tax='0');key=uid()
denied(viewer,cmd('save',value),'ACCOUNTING_FORBIDDEN');denied(stranger,cmd('save',value),'ACCOUNTING_FORBIDDEN')
receipt=json.loads(user_sql(owner,cmd('save',value,key=key)));assert receipt['revision']=='1'
assert json.loads(user_sql(owner,cmd('save',value,key=key)))==receipt
denied(owner,cmd('save',{**value,'description':'Changed'},key=key),'IDEMPOTENCY_REUSE')
denied(owner,action('issue',value['id'],'1'),'DOCUMENT_NOT_APPROVED')
user_sql(owner,action('approve',value['id'],'1'))
user_sql(owner,cmd('save',value,'1'))
denied(owner,action('issue',value['id'],'2'),'DOCUMENT_NOT_APPROVED')
user_sql(owner,action('approve',value['id'],'3'))
issue_key=uid();user_sql(owner,action('issue',value['id'],'2',issue_key))
assert json.loads(user_sql(owner,action('issue',value['id'],'2',issue_key)))['revision']=='3'
read=json.loads(user_sql(viewer,f"select paperwork_read_business_document('{firm}','{value['id']}');"))
assert read['document']['lines'][0]['net']=='900719925474099301' and read['payment']=='not_tracked'
assert read['workflow']['delivery']=='not_recorded' and read['lifecycle']=='issued'
denied(owner,cmd('save',value,'3'),'STALE_REVISION')
assert execute(f"update paperwork_business_documents set number='fake' where firm_id='{firm}' and id='{value['id']}';").returncode
assert execute(f"insert into paperwork_business_document_lines values('{firm}','{value['id']}','extra',2,'Extra',1,0);").returncode
user_sql(owner,cmd('record_delivery',dict(firmId=firm,id=value['id'],evidence='Recorded external email receipt'),'4'))
denied(owner,cmd('save',{**doc(),'partnerId':foreign_partner}))
denied(owner,cmd('save',{**doc(),'lines':[dict(id='one',description='Bad number',net=100,tax='0')]}),'INVALID_AMOUNT')
assert user_sql(stranger,'select count(*) from paperwork_business_documents;')=='0'
denied(stranger,f"select paperwork_list_business_documents('{firm}','{year}');",'ACCOUNTING_FORBIDDEN')
def journal(document,debit=True):
 gross=str(sum(int(l['net'])+int(l['tax']) for l in document['lines']))
 return dict(id=uid(),firmId=firm,fiscalYearId=year,periodId=period,postingDate='2026-01-15',description='Source posting',lines=[dict(id='a',accountId=a,partnerId=partner,debit=gross if debit else '0',credit='0' if debit else gross,description=''),dict(id='b',accountId=b,debit='0' if debit else gross,credit=gross if debit else '0',description='')])
def post(document,draft,rev,key):return f"select paperwork_post_document_journal('{document['id']}','{rev}',{lit(draft)},'0','{key}');"
draft=journal(value);post_key=uid()
receipt=json.loads(user_sql(owner,post(value,draft,'3',post_key)))
assert json.loads(user_sql(owner,post(value,draft,'3',post_key)))==receipt
denied(owner,post(value,journal(value),'3',uid()),'DUPLICATE_SOURCE')
assert run(f"select count(*) from paperwork_document_journals where firm_id='{firm}';")=='1'
invoice=doc();issue(invoice)
bad=journal(invoice,False);denied(owner,post(invoice,bad,'2',uid()),'INVALID_SOURCE_AMOUNT')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 results=list(pool.map(lambda j:execute(identity(owner)+post(invoice,j,'2',uid())),[journal(invoice),journal(invoice)]))
assert sum(r.returncode==0 for r in results)==1
credit=doc('credit_note',invoice['id'],net='5000',tax='1000');issue(credit)
user_sql(owner,post(credit,journal(credit,False),'2',uid()))
excess=doc('credit_note',invoice['id'],net='10000',tax='2000');user_sql(owner,cmd('save',excess));user_sql(owner,action('approve',excess['id'],'1'))
denied(owner,action('issue',excess['id'],'1'),'EXCESS_CREDIT')
# Equal gross is insufficient: corrections may not move net into tax or exceed either component.
for net,tax in [('0','2000'),('6000','0')]:
 component=doc('credit_note',invoice['id'],net=net,tax=tax)
 user_sql(owner,cmd('save',component));user_sql(owner,action('approve',component['id'],'1'))
 denied(owner,action('issue',component['id'],'1'),'EXCESS_CREDIT')
incoming=doc(direction='incoming');issue(incoming);user_sql(owner,post(incoming,journal(incoming,False),'2',uid()))
advance=doc('advance');issue(advance) # Registration only; applying advances to final invoices remains unfinished.
denied(owner,f"delete from paperwork_document_journals where firm_id='{firm}';")
assert execute(f"delete from paperwork_document_journals where firm_id='{firm}';").returncode
assert run("select count(*) from information_schema.columns where table_schema='public' and table_name like 'paperwork_business_document%' and data_type in ('json','jsonb');")=='0'
print('PASS: document scope/exact money/revisions/replay/approval invalidation/issuance immutability/delivery separation; atomic source posting/race/credit cap/incoming direction.')
