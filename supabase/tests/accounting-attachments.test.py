"""Immutable, scoped attachment registry; disposable database only."""
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
def identity(user):return "select set_config('request.jwt.claims','"+json.dumps({'sub':user})+"',false);set role authenticated;"
def user_sql(user,sql):return run(identity(user)+sql).splitlines()[-1]
def denied(user,sql,error=None):
 r=execute(identity(user)+sql);assert r.returncode,sql
 if error:assert error in r.stderr,r.stderr
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261008190000_accounting_attachments.sql').read_text(encoding='utf-8'))
owner,viewer,stranger=[uid() for _ in range(3)]
for u in [owner,viewer,stranger]:run(f"insert into auth.users(id,email) values('{u}','attachments-{u}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('Attachment fixture','ATT-{uid()}');")
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{viewer}','viewer');")
year,partner,document,bank=[uid() for _ in range(4)]
for kind,data in [('year',dict(id=year,label=2026,startsOn='2026-01-01',endsOn='2026-12-31')),('partner',dict(id=partner,name='Fixture partner'))]:user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','{kind}',{lit(data)});")
source=dict(id=document,firmId=firm,partnerId=partner,direction='outgoing',kind='invoice',referenceId=None,number=uid(),documentDate='2026-01-01',dueDate='2026-01-31',description='Attachment source',currency='RSD',lines=[dict(id='one',description='Source',net='100',tax='0')])
user_sql(owner,f"select paperwork_business_document_command('save',{lit(source)},'0','{uid()}');")
user_sql(owner,f"select paperwork_create_bank_account({lit(dict(firmId=firm,id=bank,name='Fixture bank',number='16000000000000400',currency='RSD'))},'{uid()}');")
statement=json.loads(user_sql(owner,f"select paperwork_import_bank_statement({lit(dict(firmId=firm,bankAccountId=bank,fiscalYearId=year,reference=uid(),startsOn='2026-01-01',endsOn='2026-01-31',opening='0',closing='100',rows=[dict(externalId=uid(),bookingDate='2026-01-10',valueDate='2026-01-10',incoming='100',outgoing='0',counterparty='Fixture',reference='',description='Fixture')]))},'{uid()}');"))['statementId']
def payload(kind='document'):return dict(firmId=firm,id=uid(),targetType=kind,targetId=document if kind=='document' else statement,targetRevision='1' if kind=='document' else None,name='source.pdf',bytes='3',sha256='a'*64,externalReference='Archive/2026/source')
def cmd(action,data,key=None):return f"select paperwork_attachment_command('{action}',{lit(data)},'{key or uid()}');"
def workspace(user=owner,kind='document',target=None):return json.loads(user_sql(user,f"select paperwork_attachment_workspace('{firm}','{kind}','{target or (document if kind=='document' else statement)}');"))
data=payload();key=uid();command=cmd('register',data,key)
denied(viewer,command,'ACCOUNTING_FORBIDDEN');denied(stranger,command,'ACCOUNTING_FORBIDDEN')
receipt=json.loads(user_sql(owner,command));assert receipt['attachmentId']==data['id'] and receipt['revision']=='1'
assert json.loads(user_sql(owner,command))==receipt
denied(owner,cmd('register',{**data,'name':'different.pdf'},key),'IDEMPOTENCY_REUSE')
for change in [{'bytes':3},{'bytes':'0'},{'bytes':'10485761'},{'bytes':'03'},{'name':'../bad.pdf'},{'name':'a\\b.pdf'},{'sha256':'A'*64},{'externalReference':' '},{'targetRevision':None},{'targetRevision':'2'},{'targetId':statement}]:denied(owner,cmd('register',{**payload(),**change}))
assert len(workspace(viewer)['attachments'])==1
assert workspace(viewer)['attachments'][0]['bytes']=='3'
denied(stranger,f"select paperwork_attachment_workspace('{firm}','document','{document}');",'ACCOUNTING_FORBIDDEN')
assert user_sql(stranger,'select count(*) from paperwork_accounting_attachments;')=='0'
denied(owner,f"delete from paperwork_accounting_attachments where firm_id='{firm}';",'permission denied')
r=execute(f"update paperwork_accounting_attachments set name='bad' where firm_id='{firm}';");assert r.returncode
withdraw=dict(firmId=firm,id=data['id'],targetType='document',targetId=document,expectedRevision='1',reason='Wrong scanned file')
denied(owner,cmd('withdraw',{**withdraw,'targetId':statement}),'INVALID_ATTACHMENT_TARGET')
denied(owner,cmd('withdraw',{**withdraw,'reason':' '}))
wkey=uid();wcmd=cmd('withdraw',withdraw,wkey);assert json.loads(user_sql(owner,wcmd))['revision']=='2'
assert json.loads(user_sql(owner,wcmd))['revision']=='2'
assert json.loads(user_sql(owner,command))==receipt # Original registration receipt survives withdrawal.
denied(owner,cmd('withdraw',withdraw),'STALE_REVISION')
assert workspace()['attachments'][0]['status']=='withdrawn'
assert workspace()['attachments'][0]['reason']==withdraw['reason']
user_sql(owner,f"select paperwork_business_document_command('save',{lit({**source,'description':'Revised source'})},'1','{uid()}');")
denied(owner,cmd('register',payload()),'STALE_REVISION')
assert workspace()['attachments'][0]['targetRevision']=='1'
assert json.loads(user_sql(owner,command))==receipt
bankdata=payload('bank_statement');bkey=uid();bcommand=cmd('register',bankdata,bkey)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:user_sql(owner,bcommand),range(2)))
assert results[0]==results[1] and len(workspace(kind='bank_statement')['attachments'])==1
denied(owner,cmd('register',{**payload('bank_statement'),'targetRevision':'1'}),'INVALID_ATTACHMENT_TARGET')
assert run(f"select count(*) from paperwork_accounting_events where firm_id='{firm}' and action like 'attachment.%';")=='3'
print('Attachment registry SQL PASS: scopes, roles, exact metadata, replay/race, immutable rows, withdrawals and audit.')
