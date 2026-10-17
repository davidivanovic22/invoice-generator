"""Bank register import, semantic identity and exact balances; disposable local DB only."""
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
if '--existing-schema' not in sys.argv:run(Path('supabase/migrations/20261008140000_accounting_bank.sql').read_text(encoding='utf-8'))
owner,viewer,stranger=[uid() for _ in range(3)]
for u in [owner,viewer,stranger]:run(f"insert into auth.users(id,email) values('{u}','bank-{u}@example.test');")
firm=user_sql(owner,f"select paperwork_connect_firm('Bank fixture','BANK-{uid()}');")
other=user_sql(owner,f"select paperwork_connect_firm('Other bank fixture','BANK-{uid()}');")
run(f"insert into paperwork_members(firm_id,user_id,role) values('{firm}','{viewer}','viewer');")
year,other_year=uid(),uid()
for f,y in [(firm,year),(other,other_year)]:user_sql(owner,f"select paperwork_create_accounting_entity('{f}','year',{lit(dict(id=y,label=2026,startsOn='2026-01-01',endsOn='2026-12-31'))});")
account=dict(firmId=firm,id=uid(),name='Operating RSD',number='16000000000000100',currency='RSD')
def create(data,key=None):return f"select paperwork_create_bank_account({lit(data)},'{key or uid()}');"
account_key=uid();denied(viewer,create(account),'ACCOUNTING_FORBIDDEN')
account_receipt=json.loads(user_sql(owner,create(account,account_key)));assert account_receipt['accountId']==account['id']
assert json.loads(user_sql(owner,create(account,account_key)))==account_receipt
denied(owner,create({**account,'name':'Changed'},account_key),'IDEMPOTENCY_REUSE')
denied(owner,create({**account,'id':uid()}))
foreign_account={**account,'firmId':other,'id':uid()};user_sql(owner,create(foreign_account))
def row(external,incoming='0',outgoing='0'):
 return dict(externalId=external,bookingDate='2026-01-10',valueDate='2026-01-11',incoming=incoming,outgoing=outgoing,counterparty='Same partner',reference='Same reference',description='Same description')
def statement(rows,reference=None):
 return dict(firmId=firm,bankAccountId=account['id'],fiscalYearId=year,reference=reference or uid(),startsOn='2026-01-01',endsOn='2026-01-31',opening='-100',closing=str(-100+sum(int(r['incoming'])-int(r['outgoing']) for r in rows)),rows=rows)
def cmd(data,key=None):return f"select paperwork_import_bank_statement({lit(data)},'{key or uid()}');"
def read(id,user=owner):return json.loads(user_sql(user,f"select paperwork_read_bank_statement('{firm}','{id}');"))
value=statement([row('BANK-IN-1','900719925474099301'),row('BANK-OUT-1',outgoing='1000')]);key=uid()
denied(viewer,cmd(value),'ACCOUNTING_FORBIDDEN');denied(stranger,cmd(value),'ACCOUNTING_FORBIDDEN')
receipt=json.loads(user_sql(owner,cmd(value,key)));assert receipt['newCount']==2 and receipt['reusedCount']==0 and not receipt['previouslyImported']
assert json.loads(user_sql(owner,cmd(value,key)))==receipt
denied(owner,cmd({**value,'reference':'Changed'},key),'IDEMPOTENCY_REUSE')
repeated=json.loads(user_sql(owner,cmd({**value,'rows':list(reversed(value['rows']))})))
assert repeated['statementId']==receipt['statementId'] and repeated['newCount']==0 and repeated['reusedCount']==2 and repeated['previouslyImported']
saved=read(receipt['statementId'],viewer);assert saved['rows'][0]['incoming']=='900719925474099301' and saved['opening']=='-100' and saved['closing']==value['closing']
# Overlapping sources reuse transactions; same content with a different bank ID is still a real second transaction.
overlap=statement([value['rows'][0],row('BANK-IN-2','900719925474099301')]);overlap_receipt=json.loads(user_sql(owner,cmd(overlap)))
assert overlap_receipt['newCount']==1 and overlap_receipt['reusedCount']==1
assert run(f"select count(*) from paperwork_bank_transactions where firm_id='{firm}';")=='3'
denied(owner,cmd({**value,'closing':'0'}),'BANK_BALANCE_MISMATCH')
denied(owner,cmd(statement([row('DUP','1'),row('DUP','1')])),'DUPLICATE_BANK_ROW')
denied(owner,cmd(statement([row('BOTH','1','1')])),'INVALID_BANK_ROW')
denied(owner,cmd({**value,'rows':[{**row('NUMBER','1'),'incoming':1}]}),'INVALID_BANK_ROW')
denied(owner,cmd({**value,'bankAccountId':foreign_account['id']}),'INVALID_BANK_ACCOUNT')
denied(owner,cmd({**value,'fiscalYearId':other_year}))
denied(owner,cmd({**value,'startsOn':'2025-12-31'}),'INVALID_STATEMENT')
denied(owner,cmd({**value,'rows':[{**value['rows'][0],'bookingDate':'2026-02-01'},value['rows'][1]]}),'INVALID_BANK_ROW')
denied(owner,cmd({**value,'reference':value['reference'],'rows':[row('Different','1')],'closing':'-99'}),'BANK_STATEMENT_CONFLICT')
# A conflict late in a new statement rolls back its header, new transactions and links.
conflict=statement([row('MUST-ROLLBACK','2'),{**value['rows'][0],'description':'Changed bank data'}]);before=run(f"select count(*) from paperwork_bank_statements where firm_id='{firm}';")
denied(owner,cmd(conflict),'BANK_TRANSACTION_CONFLICT')
assert run(f"select count(*) from paperwork_bank_statements where firm_id='{firm}';")==before
assert run(f"select count(*) from paperwork_bank_transactions where firm_id='{firm}' and external_id='MUST-ROLLBACK';")=='0'
race=statement([row('RACE','100')]);race_keys=[uid(),uid()]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 results=list(pool.map(lambda k:execute(identity(owner)+cmd(race,k)),race_keys))
assert all(r.returncode==0 for r in results)
assert run(f"select count(*) from paperwork_bank_transactions where firm_id='{firm}' and external_id='RACE';")=='1'
assert run(f"select count(*) from paperwork_bank_statements where firm_id='{firm}' and reference='{race['reference']}';")=='1'
denied(stranger,f"select paperwork_bank_workspace('{firm}','{year}');",'ACCOUNTING_FORBIDDEN')
denied(stranger,f"select paperwork_read_bank_statement('{firm}','{receipt['statementId']}');",'ACCOUNTING_FORBIDDEN')
assert user_sql(stranger,'select count(*) from paperwork_bank_transactions;')=='0'
assert execute(f"update paperwork_bank_transactions set incoming=1 where firm_id='{firm}';").returncode
assert execute(f"delete from paperwork_bank_statements where firm_id='{firm}';").returncode
denied(owner,f"insert into paperwork_bank_statement_lines select firm_id,statement_id,bank_account_id,transaction_id,999 from paperwork_bank_statement_lines where firm_id='{firm}' limit 1;")
assert run(f"select count(*) from paperwork_journals where firm_id='{firm}';")=='0'
assert run("select count(*) from information_schema.columns where table_schema='public' and table_name like 'paperwork_bank_%' and data_type in ('json','jsonb');")=='0'
print('PASS: exact signed balances/inflows/outflows, account scope/RLS, bank-ID identity, replay/reordered duplicate/overlap, race, atomic conflict rollback, immutable records and no automatic ledger postings.')
