"""Only synthetic disposable databases; tax evidence is not a filing validation."""
import concurrent.futures,json,os,re,subprocess,sys,uuid
from pathlib import Path
database=os.environ.get('RELATIONAL_TEST_DB','');assert re.fullmatch(r'paperwork_relational_\d+',database)
def execute(sql):return subprocess.run(['docker','exec','-i','supabase_db_invoice-generator','psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=sql,text=True,encoding='utf-8',capture_output=True)
def run(sql):
 r=execute(sql)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
def uid():return str(uuid.uuid4())
def lit(d):return "'"+json.dumps(d).replace("'","''")+"'::jsonb"
def identity(u):return "select set_config('request.jwt.claims','"+json.dumps({'sub':u})+"',false);set role authenticated;"
def user_sql(u,sql):return run(identity(u)+sql).splitlines()[-1]
def denied(u,sql,error=None):
 r=execute(identity(u)+sql);assert r.returncode,sql
 if error:assert error in r.stderr,r.stderr
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261009120000_accounting_tax_evidence.sql').read_text(encoding='utf-8'))
owner,reader,stranger=[uid() for _ in range(3)]
for u in [owner,reader,stranger]:run(f"insert into auth.users(id,email) values('{u}','tax-{u}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('Tax evidence fixture','TAX-{uid()}');")
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{reader}','viewer');")
year,period,partner,a,b=[uid() for _ in range(5)]
def entity(kind,data):user_sql(owner,f"select paperwork_create_accounting_entity('{firm}','{kind}',{lit(data)});")
entity('year',dict(id=year,label=2026,startsOn='2026-01-01',endsOn='2026-12-31'))
entity('period',dict(id=period,fiscalYearId=year,startsOn='2026-01-01',endsOn='2026-01-31'))
entity('partner',dict(id=partner,name='Tax partner'))
entity('account',dict(id=a,code='204.TAX',name='Counterpart',requiresPartner=True,validFrom='2026-01-01'))
entity('account',dict(id=b,code='614.TAX',name='Other side',validFrom='2026-01-01'))
def state(u=owner):return json.loads(user_sql(u,f"select paperwork_tax_workspace('{firm}','{year}');"))
def cmd(action,data,key=None):return f"select paperwork_tax_command('{action}',{lit(data)},'{key or uid()}');"
def base(i=None):return dict(firmId=firm,id=i or uid(),expectedRevision=state()['revision'])
policy='rs-vat-reference-2026-v1'
p={**base(), 'legalForm':'doo','regime':'regular_vat','frequency':'monthly','validFrom':'2026-01-01','validTo':'2026-12-31','evidence':'Fixture registration and monthly status','policyId':policy}
denied(reader,cmd('create_profile',p),'ACCOUNTING_FORBIDDEN');key=uid();receipt=json.loads(user_sql(owner,cmd('create_profile',p,key)))
assert json.loads(user_sql(owner,cmd('create_profile',p,key)))==receipt
denied(owner,cmd('create_profile',{**p,'evidence':'Changed'},key),'IDEMPOTENCY_REUSE')
denied(owner,cmd('create_profile',{**p,**base()}),'TAX_PROFILE_OVERLAP')
denied(owner,cmd('create_profile',{**p,**base(),'validFrom':'2027-01-01','validTo':'2027-12-31'}),'UNSUPPORTED_TAX_DATE')
def document(direction='outgoing',net='100000',tax='20000',kind='invoice',post=True,lines=None,date='2026-01-15',period_id=None):
 d=dict(id=uid(),firmId=firm,partnerId=partner,direction=direction,kind=kind,referenceId=None,number='TAX-'+uid(),documentDate=date,dueDate=date,description='Tax fixture',currency='RSD',lines=lines or [dict(id='one',description='Ordinary service',net=net,tax=tax)])
 user_sql(owner,f"select paperwork_business_document_command('save',{lit(d)},'0','{uid()}');")
 user_sql(owner,f"select paperwork_business_document_command('approve',{lit(dict(firmId=firm,id=d['id']))},'1','{uid()}');")
 user_sql(owner,f"select paperwork_business_document_command('issue',{lit(dict(firmId=firm,id=d['id']))},'1','{uid()}');")
 gross=str(sum(int(l['net'])+int(l['tax']) for l in d['lines']))
 j=dict(id=uid(),firmId=firm,fiscalYearId=year,periodId=period_id or period,postingDate=date,description='Source tax posting',lines=[dict(id='a',accountId=a,partnerId=partner,debit=gross if direction=='outgoing' else '0',credit=gross if direction=='incoming' else '0',description=''),dict(id='b',accountId=b,debit=gross if direction=='incoming' else '0',credit=gross if direction=='outgoing' else '0',description='')])
 if post:user_sql(owner,f"select paperwork_post_document_journal('{d['id']}','2',{lit(j)},'0','{uid()}');")
 return d,j
def record(d,category='standard',deductible='0',deduction='',point=None):
 l=dict(lineId='one',category=category,classificationEvidence='Classification fixture' if point else '',deductible=deductible,deductionEvidence=deduction)
 if point:l['reducedPoint']=point
 return {**base(),'profileId':p['id'],'documentId':d['id'],'documentRevision':'2','fiscalYearId':year,'periodId':period,'taxDate':d['documentDate'],'policyId':policy,'evidence':'Ordinary domestic supply confirmed; no advance','confirmedOrdinaryDomesticSupply':True,'lines':[l]}
d,j=document();e=record(d);key=uid();receipt=json.loads(user_sql(owner,cmd('record',e,key)));assert json.loads(user_sql(owner,cmd('record',e,key)))==receipt
assert state()['events'][0]['lines'][0]['tax']=='20000'
denied(owner,cmd('record',{**e,**base()}),'DUPLICATE_SOURCE')
denied(owner,cmd('cancel_profile',{**base(p['id']),'reason':'Must preserve historic profile'}),'TAX_PROFILE_HAS_HISTORY')
reverse=f"select paperwork_reverse_journal('{firm}','{j['id']}','{period}','2026-01-20','Bypass','1','{uid()}');"
denied(owner,reverse,'ACTIVE_TAX_EVIDENCE')
# A cancellation is immutable history, and enables the explicit source reversal.
cancel={**base(e['id']),'periodId':period,'reason':'Fixture annulment'};ck=uid();cr=json.loads(user_sql(owner,cmd('cancel_event',cancel,ck)));assert json.loads(user_sql(owner,cmd('cancel_event',cancel,ck)))==cr
user_sql(owner,reverse);assert state()['documents'][0]['sourceReversed'] and state()['events'][0]['cancelled']
denied(owner,cmd('record',{**e,**base()}),'TAX_DOCUMENT_NOT_POSTED')
incoming,_=document('incoming');ie=record(incoming,deductible='15000',deduction='Article 28 conditions confirmed; remaining VAT not deducted')
user_sql(owner,cmd('record',ie));assert next(e for e in state()['events'] if e['id']==ie['id'])['lines'][0]['deductible']=='15000'
bad,_=document(tax='19000');before=state()['revision'];denied(owner,cmd('record',record(bad)),'TAX_AMOUNT_MISMATCH');assert state()['revision']==before
small,_=document(net='5',tax='1');se=record(small,'reduced',point='1');user_sql(owner,cmd('record',se))
unposted,_=document(post=False);denied(owner,cmd('record',record(unposted)),'TAX_DOCUMENT_NOT_POSTED')
advance,_=document(kind='advance');denied(owner,cmd('record',record(advance)),'UNSUPPORTED_TAX_DOCUMENT')
large,_=document(net='900719925474099301',tax='180143985094819860');user_sql(owner,cmd('record',record(large)))
reduced,_=document(net='5',tax='1');rr=record(reduced,'reduced')
for patch in [{},{'reducedPoint':'1a'},{'reducedPoint':'1','classificationEvidence':''}]:
 denied(owner,cmd('record',{**rr,'lines':[{**rr['lines'][0],**patch}]}),'violates check constraint')
multi,_=document(lines=[dict(id='one',description='One',net='100000',tax='20000'),dict(id='two',description='Two',net='100000',tax='20000')]);mr=record(multi)
denied(owner,cmd('record',mr),'INVALID_TAX_LINES')
denied(owner,cmd('record',{**mr,'lines':[mr['lines'][0],mr['lines'][0]]}),'duplicate key')
out,_=document();oe=record(out);user_sql(owner,cmd('record',oe))
guard=execute(f"insert into paperwork_advance_applications values('{firm}','{uid()}','{advance['id']}','{out['id']}',1,0,'{owner}',now());")
assert guard.returncode and 'ACTIVE_TAX_EVIDENCE' in guard.stderr,guard.stderr
other=user_sql(owner,f"select paperwork_connect_firm('Tax other owned firm','TAX-OTHER-{uid()}');")
op={**p,'firmId':other,'id':uid(),'expectedRevision':'0'};user_sql(owner,cmd('create_profile',op))
denied(owner,cmd('record',{**record(reduced,'reduced',point='1'),'profileId':op['id']}))
user_sql(owner,cmd('cancel_profile',dict(firmId=other,id=op['id'],expectedRevision='1',reason='Unused profile correction')))
assert run(f"select count(*) from paperwork_tax_profile_cancellations where firm_id='{other}';")=='1'
assert execute(f"update paperwork_tax_profile_cancellations set reason='tampered' where firm_id='{other}';").returncode
# Full line set / uniqueness / classification / deduction / scope are checked server-side.
target,_=document('incoming');r=record(target)
for patch,error in [({'documentRevision':'1'},'STALE_REVISION'),({'confirmedOrdinaryDomesticSupply':False},'UNSUPPORTED_TAX_SCOPE'),({'taxDate':'2026-02-01'},'INVALID_TAX_PERIOD'),({'fiscalYearId':None},'INVALID_TAX_PERIOD'),({'profileId':uid()},None),({'documentId':uid()},None),({'lines':[]},'INVALID_TAX_LINES')]:denied(owner,cmd('record',{**r,**patch}),error)
for line,error in [({'deductible':'20001','deductionEvidence':'Test'},'INVALID_TAX_DEDUCTION'),({'deductible':1},'INVALID_TAX_AMOUNT'),({'deductible':'1.5'},'INVALID_TAX_AMOUNT'),({'deductible':'1'},'INVALID_TAX_DEDUCTION'),({'category':'reduced','reducedPoint':None},'TAX_AMOUNT_MISMATCH')]:
 denied(owner,cmd('record',{**r,'lines':[{**r['lines'][0],**line}]}),error)
# Race consumes a single firm revision; duplicate requests never duplicate the event.
r=record(target,deduction='No input deduction claimed')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda x:execute(identity(owner)+cmd('record',x)),[r,{**r,'id':uid()}]))
assert sum(x.returncode==0 for x in results)==1
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','closed','1','Fixture close');")
denied(owner,cmd('cancel_event',{**base(ie['id']),'periodId':period,'reason':'Closed period'}),'CLOSED_PERIOD')
denied(owner,cmd('record',record(bad)),'CLOSED_PERIOD')
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','open','2','Fixture reopen');")
assert state(reader)==state();denied(stranger,f"select paperwork_tax_workspace('{firm}','{year}');",'ACCOUNTING_FORBIDDEN')
for table in ['profiles','profile_cancellations','events','event_lines','event_cancellations','requests']:
 assert user_sql(stranger,f"select count(*) from paperwork_tax_{table} where firm_id='{firm}';")=='0'
 denied(owner,f"delete from paperwork_tax_{table} where firm_id='{firm}';")
 if run(f"select count(*) from paperwork_tax_{table} where firm_id='{firm}';")!='0':assert execute(f"update paperwork_tax_{table} set firm_id=firm_id where firm_id='{firm}';").returncode
assert run("select count(*) from information_schema.columns where table_schema='public' and table_name like 'paperwork_tax_%' and data_type in('json','jsonb');")=='0'
print('Tax evidence SQL PASS: immutable dated profiles, overlap/history guards, exact source/VAT validation, explicit input deduction, replay/race, cancellation/source reversal, unsupported scope, closed periods, reader/RLS and relational storage.')
