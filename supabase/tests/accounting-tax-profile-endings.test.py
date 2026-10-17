"""Prospective profile changes: synthetic isolated database only."""
import os,re,runpy,subprocess,sys
from pathlib import Path
database=os.environ.get('RELATIONAL_TEST_DB','')
assert re.fullmatch(r'paperwork_relational_\d+',database)
if '--existing-schema' not in sys.argv:
 result=subprocess.run(['docker','exec','-i','supabase_db_invoice-generator','psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=Path('supabase/migrations/20261010100000_accounting_tax_profile_endings.sql').read_text(encoding='utf-8'),text=True,encoding='utf-8',capture_output=True)
 assert result.returncode==0,result.stderr
# Recheck every previous tax invariant against the new command and workspace.
sys.argv.append('--existing-schema')
g=runpy.run_path('supabase/tests/accounting-tax-evidence.test.py')
globals().update({k:v for k,v in g.items() if not k.startswith('__')})
nov,dec=uid(),uid()
for i,start,end in [(nov,'2026-11-01','2026-11-30'),(dec,'2026-12-01','2026-12-31')]:
 entity('period',dict(id=i,fiscalYearId=year,startsOn=start,endsOn=end))
later,_=document(date='2026-11-15',period_id=nov)
le={**record(later),'periodId':nov};user_sql(owner,cmd('record',le))
cut=lambda date:{**base(p['id']),'endsOn':date,'reason':'Dated status change evidence'}
for date in ['bad','2026-02-30']:
 denied(owner,cmd('end_profile',cut(date)))
denied(owner,cmd('end_profile',cut('2025-12-31')),'INVALID_TAX_PROFILE_END')
denied(owner,cmd('end_profile',cut('2026-01-31')),'INVALID_TAX_PROFILE_END')
denied(owner,cmd('end_profile',cut('2026-12-31')),'INVALID_TAX_PROFILE_END')
denied(owner,cmd('end_profile',cut('2026-10-31')),'TAX_PROFILE_HAS_LATER_HISTORY')
user_sql(owner,cmd('cancel_event',{**base(le['id']),'periodId':nov,'reason':'Cancelled future evidence still belongs to history'}))
denied(owner,cmd('end_profile',cut('2026-10-31')),'TAX_PROFILE_HAS_LATER_HISTORY')
ending=cut('2026-11-30');key=uid()
denied(reader,cmd('end_profile',ending,key),'ACCOUNTING_FORBIDDEN')
denied(stranger,cmd('end_profile',ending,key),'ACCOUNTING_FORBIDDEN')
denied(owner,cmd('end_profile',{**ending,'expectedRevision':'0'},key),'STALE_REVISION')
before=state()['revision'];receipt=json.loads(user_sql(owner,cmd('end_profile',ending,key)))
assert json.loads(user_sql(owner,cmd('end_profile',ending,key)))==receipt
assert int(state()['revision'])==int(before)+1
denied(owner,cmd('end_profile',{**ending,'reason':'Different'},key),'IDEMPOTENCY_REUSE')
original=next(x for x in state()['profiles'] if x['id']==p['id'])
assert original['validTo']=='2026-12-31' and original['ending']['endsOn']=='2026-11-30'
assert original['ending']['createdBy']==owner and original['ending']['reason']==ending['reason']
denied(owner,cmd('end_profile',cut('2026-11-29')),'duplicate key')
denied(owner,cmd('cancel_profile',{**base(p['id']),'reason':'Must retain ending'}),'TAX_PROFILE_HAS_HISTORY')
successor={**p,**base(),'regime':'small_taxpayer','frequency':'none','validFrom':'2026-12-01','evidence':'Separately verified new status'}
denied(owner,cmd('create_profile',{**successor,'validFrom':'2026-11-30'}),'TAX_PROFILE_OVERLAP')
user_sql(owner,cmd('create_profile',successor))
future,_=document(date='2026-12-15',period_id=dec)
after={**record(future),'periodId':dec}
denied(owner,cmd('record',after),'INVALID_TAX_PERIOD')
denied(owner,cmd('record',{**after,'profileId':successor['id']}),'INVALID_TAX_CATEGORY')
valid,_=document(tax='0',date='2026-12-16',period_id=dec)
new_event={**record(valid,category='small_taxpayer'),'periodId':dec,'profileId':successor['id']}
user_sql(owner,cmd('record',new_event))
assert json.loads(user_sql(owner,cmd('end_profile',ending,key)))==receipt
assert state(reader)==state()
assert user_sql(stranger,f"select count(*) from paperwork_tax_profile_endings where firm_id='{firm}';")=='0'
denied(owner,f"delete from paperwork_tax_profile_endings where firm_id='{firm}';")
assert execute(f"update paperwork_tax_profile_endings set reason='changed' where firm_id='{firm}';").returncode
assert execute(f"delete from paperwork_tax_profile_endings where firm_id='{firm}';").returncode
assert run(f"select count(*) from paperwork_accounting_events where firm_id='{firm}' and action='tax.end_profile' and target_id='{p['id']}';")=='1'
print('Tax profile endings SQL PASS: immutable original/end proof, prospective date, all-history guard, successor overlap, effective source dates, regime change, replay/stale revision, authorization and RLS.')
