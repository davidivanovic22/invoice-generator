"""Real PostgreSQL regression in an isolated local database; never uses hosted data.
Run: python supabase/tests/relational.test.py (local Supabase Docker must be running).
The disposable test database is retained for inspection.
"""
import json
import subprocess
import time
import uuid
from pathlib import Path

container = 'supabase_db_invoice-generator'
database = 'paperwork_relational_' + str(int(time.time()))

def docker(*args, source=None):
    result = subprocess.run(['docker','exec','-i',container,*args],input=source,text=True,encoding='utf-8',capture_output=True)
    if result.returncode: raise RuntimeError(result.stderr)
    return result.stdout

def run(source):
    return docker('psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1',source=source).strip()

def literal(value): return "'"+json.dumps(value,ensure_ascii=True).replace("'","''")+"'::jsonb"

docker('createdb','-U','postgres',database)
auth = docker('pg_dump','-U','postgres','-d','postgres','--schema=auth','--schema-only','--no-owner','--no-acl')
run(auth)
for name in ['20261005120000_paperwork.sql','20261007120000_firm_identity.sql']:
    run((Path('supabase/migrations')/name).read_text(encoding='utf-8'))

owner,viewer,stranger,accountant = [str(uuid.uuid4()) for _ in range(4)]
for user in [owner,viewer,stranger,accountant]: run(f"insert into auth.users(id,email) values('{user}','{user}@example.test');")
claims=lambda user: "select set_config('request.jwt.claims','"+json.dumps({'sub':user,'email':'test@example.test'})+"',false);"
firm=run(claims(owner)+"select public.paperwork_connect_firm('Example business','TEST-RELATIONAL');").splitlines()[-1]
other=run(claims(owner)+"select public.paperwork_connect_firm('Other business','TEST-OTHER');").splitlines()[-1]

party=dict(name='Example business',address='Example street',cityCountry='Example city',taxIdLabel='PIB',taxId='TESTRELATIONAL',regIdLabel='Registration',regNo='123',email='office@example.test')
client_party={**party,'name':'Example client','taxId':'CLIENT'}
bank=dict(iban='EXAMPLE',swift='EXAMPLE',bankName='Example bank')
design=dict(template='seasonal',accentColor='#112233',language='en',seasonalMonth=None,seasonalVariant=2,showSignature=True)
invoice=dict(id='invoice-1',number='2026-01',status='paid',issueDate='2026-01-01',serviceDate='2026-01-31',dueDate='2026-02-14',billingPeriod='January',currency='EUR',vatPercent=0,
 issuer=party,bank=bank,client=client_party,clientId='client-1',items=[dict(id='item-1',title='Work',description='Description',quantity=2.5,unit='h',unitPrice=20)],note='Example note',logo='logo',signature='signature',design=design,paidAt='2026-02-14',repeatDay=15,createdAt='2026-01-01T00:00:00Z',updatedAt='2026-02-14T00:00:00Z')
profile=dict(party=party,bank=bank,logo='business-logo',signature='business-signature',yearlyTax={'2026':dict(monthly=25.5,currency='RSD',rsdPerEur=117.2,paidMonths=[1,3]),'2025':dict(monthly=10,currency='EUR',rsdPerEur=117)},defaults=dict(currency='EUR',vatPercent=0,paymentDays=14,note='Note',numberPrefix='',language='en',template='modern',accentColor='#112233',unit='h'))
invoices=dict(version=2,invoices=[invoice],clients=[dict(id='client-1',party=client_party,currency='EUR',lastUsedAt='2026-02-14T00:00:00Z')],profile=profile)
kpo=dict(version=1,currency='EUR',entryTemplate='Example template',bookOn='paid',header=dict(pib='TESTRELATIONAL',taxpayer='Example',business='Example business',seat='Example city',taxpayerCode='1',activity='Programming'),entries=[dict(id='kpo-1',date='2026-02-14',description='Example booking',products=0,services=50,source='invoice',invoiceId='invoice-1')],settledInvoiceIds=['invoice-1'])
resume=dict(id='resume-1',name='Example CV',personal=dict(fullName='Example Person',headline='Developer',email='person@example.test',phone='123',location='Example city',website='example.test',linkedin='example',github='example',photo='data:image/png;base64,example',extras=[dict(id='contact-1',label='Contact',value='Example')]),sections=[
 dict(id='summary',kind='summary',title='Profile',hidden=False,type='text',text='Example summary'),
 dict(id='experience',kind='experience',title='Experience',hidden=False,type='entries',items=[dict(id='job-1',title='Developer',subtitle='Example employer',location='Example city',start='2020',end='Present',description='Work')]),
 dict(id='skills',kind='skills',title='Skills',hidden=True,type='tags',items=['Python','TypeScript']),
 dict(id='languages',kind='languages',title='Languages',hidden=False,type='languages',items=[dict(id='language-1',name='English',level='B2')])],design=dict(template='creative',accentColor='#112233',font='serif',density='normal',showPhoto=True,language='en'),ats=dict(jobDescription='Job ad',keywords=['React','SQL'],keywordsSource='Source'),coverLetter='Example letter',createdAt='2026-01-01T00:00:00Z',updatedAt='2026-01-02T00:00:00Z')
resumes=dict(version=2,resumes=[resume])
audit=[dict(at='2026-02-14T00:00:00Z',who='Example',action='invoice.created',target='invoice-1',detail='Example detail')]
for key,data in [('invoices',invoices),('kpo',kpo),('audit',audit)]:
    run(claims(owner)+f"insert into paperwork_firm_data(firm_id,key,data) values('{firm}','{key}',{literal(data)});")
run(claims(owner)+f"insert into paperwork_data(user_id,key,data) values('{owner}','studio.resumes.v2',{literal(resumes)}); insert into paperwork_data(user_id,key,data) values('{owner}','studio.firm-selection',{literal(dict(firmIds=[firm],activeFirmId=firm))});")
run((Path('supabase/migrations')/'20261007140000_relational_documents.sql').read_text(encoding='utf-8'))
for name in ['20261007150000_remove_legacy_triggers.sql','20261007160000_invoice_signature_visibility.sql','20261007170000_account_profiles.sql']:
    run((Path('supabase/migrations')/name).read_text(encoding='utf-8'))
run('grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid(),auth.jwt() to authenticated,anon; grant select on paperwork_members,paperwork_firms to authenticated,anon;')
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{viewer}','viewer'),('{firm}','{accountant}','accountant');")

def as_user(user,sql): return run(claims(user)+'set role authenticated;'+sql)
def read(user=owner):
    output=as_user(user,f"select coalesce(jsonb_agg(r),'[]') from paperwork_read_documents(array['{firm}'::uuid],true) r;")
    return {r['key']:r['data'] for r in json.loads(output.splitlines()[-1])}

documents=read()
# PostgreSQL canonicalizes timezone strings; all persisted values must otherwise round-trip.
def canonical(value):
    if isinstance(value,dict): return {k:canonical(v) for k,v in value.items()}
    if isinstance(value,list): return [canonical(v) for v in value]
    if isinstance(value,str): return value.replace('Z','+00:00') if value.endswith('Z') and 'T' in value else value
    return value
assert canonical(documents)==canonical({'invoices':invoices,'kpo':kpo,'audit':audit,'studio.resumes.v2':resumes}), 'Every field must survive conversion'
assert run("select count(*) from information_schema.columns where table_schema='public' and data_type in ('json','jsonb');")=='0'
assert run("select count(*) from paperwork_firms;")=='2'
assert run("select count(*) from paperwork_invoice_items;")=='1'
assert as_user(owner,'select count(*) from paperwork_open_firms;').splitlines()[-1]=='1'
assert read(stranger)=={}
assert 'studio.resumes.v2' not in read(viewer)
assert read(viewer)['invoices']['invoices'][0]['clientId']=='client-1'

def must_fail(user,statement):
    try: as_user(user,statement)
    except RuntimeError: return
    raise AssertionError('Operation must be rejected')

save=lambda key,data: f"select paperwork_save_document('{firm}','{key}',{literal(data)});"
must_fail(viewer,save('invoices',invoices))
must_fail(stranger,save('invoices',invoices))
must_fail(stranger,"select paperwork_connect_firm('Unknown','TESTRELATIONAL');")
must_fail(owner,f"select _paperwork_write('{firm}','invoices',{literal(invoices)},false);")
must_fail(owner,f"insert into paperwork_firms(name) values('Automatic');")
must_fail(owner,f"select paperwork_select_firms(array['{other}'::uuid],'{firm}'::uuid);")
as_user(accountant,save('invoices',invoices))
assert read()['kpo']==kpo, 'Saving invoice rows must preserve their KPO relationships'
bad={**invoices,'invoices':[{**invoice,'clientId':'missing-client'}]}
must_fail(owner,save('invoices',bad))
assert read()['invoices']['invoices'][0]['clientId']=='client-1'
cross={**kpo,'entries':[{**kpo['entries'][0],'invoiceId':'foreign-invoice'}]}
must_fail(owner,save('kpo',cross))
before=read()
batch=[dict(firm_id=firm,key='invoices',data={**invoices,'profile':{**profile,'logo':'Changed'}}),dict(firm_id=firm,key='kpo',data=cross)]
must_fail(owner,f"select paperwork_restore_documents({literal(batch)});")
assert read()==before, 'Failed batch restore must roll back every document'
stamp=as_user(owner,f"select updated_at from paperwork_document_versions where firm_id='{firm}' and key='invoices';").splitlines()[-1]
as_user(accountant,save('invoices',invoices))
must_fail(owner,f"select paperwork_save_document('{firm}','invoices',{literal(invoices)},'{stamp}'::timestamptz);")
assert as_user(owner,"select paperwork_connect_firm('Example business','TESTRELATIONAL');").splitlines()[-1]==firm
assert run('select count(*) from paperwork_firms;')=='2'
hidden={**invoices,'invoices':[{**invoice,'signature':'','design':{**design,'showSignature':False}}]}
as_user(owner,save('invoices',hidden))
assert read()['invoices']['invoices'][0]['design']['showSignature'] is False
assert read()['invoices']['profile']==profile
assert read()['invoices']['clients']==invoices['clients']
assert read()['kpo']==kpo
as_user(owner,save('invoices',invoices))
assert as_user(owner,'select count(*) from paperwork_profiles;').splitlines()[-1]=='1'
as_user(owner,"update paperwork_profiles set first_name='Example',last_name='Person',username='example_person',phone='+381 60 1234567';")
assert as_user(stranger,"select count(*) from paperwork_profiles where username='example_person';").splitlines()[-1]=='0'
assert run("set role anon; select paperwork_username_available('EXAMPLE_PERSON');")=='f'
must_fail(stranger,"update paperwork_profiles set username='example_person';")
must_fail(owner,"update paperwork_profiles set user_id=gen_random_uuid();")
new_user=str(uuid.uuid4())
run(f"insert into auth.users(id,email,raw_user_meta_data) values('{new_user}','new@example.test',"+literal(dict(first_name='New',last_name='Person',username='new_person',phone=''))+");")
assert as_user(new_user,'select first_name from paperwork_profiles;').splitlines()[-1]=='New'
assert run('select count(*) from paperwork_firms;')=='2', 'Registration must never create firms'
print('PASS: migration preserves every field, zero JSON columns, relational keys, RLS, atomic restore, optimistic concurrency, no automatic firms.')
print('Isolated local test database:',database)
