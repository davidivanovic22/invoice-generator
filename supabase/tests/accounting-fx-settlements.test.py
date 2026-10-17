"""FX settlement migrations/regressions on disposable databases only."""
import os,re,sys,runpy,json,concurrent.futures,subprocess
from pathlib import Path
database=os.environ.get('RELATIONAL_TEST_DB','');assert re.fullmatch(r'paperwork_relational_\d+',database)
if '--existing-schema' not in sys.argv:
 r=subprocess.run(['docker','exec','-i','supabase_db_invoice-generator','psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=Path('supabase/migrations/20261008230000_accounting_fx_settlements.sql').read_text(encoding='utf-8'),text=True,capture_output=True);assert r.returncode==0,r.stderr
sys.argv.append('--existing-schema')
fixture=runpy.run_path('supabase/tests/accounting-fx.test.py')
globals().update({k:v for k,v in fixture.items() if not k.startswith('__')})
def fresh(direction='receivable',amount='10000',rv='117000000'):
 p=uid();entity('partner',dict(id=p,name='Settlement partner'));data=create(direction,amount,rv,p=p);user_sql(owner,cmd('create',data));return data

def pay(p,revision,amount='4000',rv='120000000',source=None):
 return dict(firmId=firm,id=p['id'],expectedRevision=revision,journalId=uid(),fiscalYearId=year,periodId=period,postingDate='2026-01-15',foreignMinor=amount,currency='EUR',cashAccountId=base,gainAccountId=gain,lossAccountId=loss,sourceAccount='rs35 160-0001',sourceId=source or uid(),**rate(rv))
def undo(p,s,revision):return dict(firmId=firm,id=p['id'],expectedRevision=revision,settlementId=s['journalId'],periodId=period,postingDate='2026-01-16',reason='Payment correction')
# Revaluation changes only the remaining principal; cancellation follows the mixed sequence.
p=fresh();v=revalue(p['id'],'1');user_sql(owner,cmd('revalue',v));s=pay(p,'2');key=uid();receipt=json.loads(user_sql(owner,cmd('settle',s,key)))
q=position(p['id']);assert q['revision']=='3' and q['analyticBalance']=='714000' and not q['externalMovements']
assert q['settlements'][0]['carryingRsd']=='476000' and q['settlements'][0]['paidRsd']=='480000' and q['settlements'][0]['delta']=='4000'
assert q['settlements'][0]['sourceAccount']=='RS351600001'
assert json.loads(user_sql(owner,cmd('settle',s,key)))==receipt
denied(owner,cmd('settle',{**s,'foreignMinor':'5000'},key),'IDEMPOTENCY_REUSE')
denied(owner,reverse(s['journalId']),'ACTIVE_FX_LINK')
denied(owner,cmd('cancel',cancel(p['id'],v['journalId'],'3')),'FX_REVERSE_LATEST_FIRST')
denied(owner,cmd('settle',pay(p,'3','6001')),'FX_PAYMENT_CAP')
denied(owner,cmd('settle',pay(p,'3',source=s['sourceId'])),'DUPLICATE_SOURCE')
v2=revalue(p['id'],'3','118000000');user_sql(owner,cmd('revalue',v2));q=position(p['id']);assert q['analyticBalance']=='708000' and q['events'][1]['foreignMinor']=='6000' and q['events'][1]['delta']=='-6000'
denied(owner,cmd('cancel_settlement',undo(p,s,'4')),'FX_REVERSE_LATEST_FIRST')
user_sql(owner,cmd('cancel',cancel(p['id'],v2['journalId'],'4')));user_sql(owner,cmd('cancel_settlement',undo(p,s,'5')));assert position(p['id'])['analyticBalance']=='1190000'
user_sql(owner,cmd('cancel',cancel(p['id'],v['journalId'],'6')));assert position(p['id'])['analyticBalance']=='1170000'
full=pay(p,'7','10000','116000000');full['postingDate']='2026-01-16';user_sql(owner,cmd('settle',full));q=position(p['id']);assert q['analyticBalance']=='0' and q['revision']=='8'
denied(owner,cmd('revalue',revalue(p['id'],'8')),'INVALID_FX_DATE')
late=revalue(p['id'],'8');late['postingDate']='2026-01-16';denied(owner,cmd('revalue',late),'FX_FULLY_SETTLED')
denied(owner,cmd('close',dict(firmId=firm,id=p['id'],expectedRevision='8',periodId=period,postingDate='2026-01-16',reason='Source correction')),'ACTIVE_FX_SETTLEMENTS')
# Both directions, gain/loss signs and balanced 2/3-line journals.
for direction,rv,contra,side in [('receivable','119000000',gain,'credit'),('receivable','115000000',loss,'debit'),('payable','119000000',loss,'debit'),('payable','115000000',gain,'credit')]:
 item=fresh(direction);settled=pay(item,'1','10000',rv);user_sql(owner,cmd('settle',settled));assert position(item['id'])['analyticBalance']=='0'
 assert run(f"select {side}::text from paperwork_journal_lines where firm_id='{firm}' and journal_id='{settled['journalId']}' and account_id='{contra}';")=='20000'
 user_sql(owner,cmd('cancel_settlement',undo(item,settled,'2')));assert position(item['id'])['analyticBalance']==('1170000' if direction=='receivable' else '-1170000')
# Final residual, precision refusal and no-change settlements without a difference line.
tiny=fresh(amount='3',rv='500000');a=pay(tiny,'1','1','1000000');user_sql(owner,cmd('settle',a));assert position(tiny['id'])['analyticBalance']=='1'
denied(owner,cmd('settle',pay(tiny,'2','1','1000000')),'FX_PAYMENT_PRECISION')
a=pay(tiny,'2','2','500000');user_sql(owner,cmd('settle',a));assert position(tiny['id'])['analyticBalance']=='0'
assert run(f"select count(*) from paperwork_journal_lines where firm_id='{firm}' and journal_id='{a['journalId']}';")=='2'
large=fresh(amount='900719925474099301',rv='1000000');a=pay(large,'1','900719925474099300','1000000');user_sql(owner,cmd('settle',a));assert position(large['id'])['analyticBalance']=='1'
a=pay(large,'2','1','1000000');user_sql(owner,cmd('settle',a));assert position(large['id'])['analyticBalance']=='0'
# Rollback protects settlement markers, journals and receipts in closed periods.
item=fresh();a=pay(item,'1');denied(reader,cmd('settle',a),'ACCOUNTING_FORBIDDEN');denied(stranger,cmd('settle',a),'ACCOUNTING_FORBIDDEN')
denied(owner,cmd('settle',{**a,'currency':'USD'}),'INVALID_FX_AMOUNT');denied(owner,cmd('settle',{**a,'cashAccountId':gain}),'INVALID_FX_ACCOUNT');denied(owner,cmd('settle',{**a,'cashAccountId':uid()}),'INVALID_FX_ACCOUNT')
period_revision=run(f"select revision from paperwork_accounting_periods where firm_id='{firm}' and id='{period}';")
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','closed','{period_revision}','Close settlement fixture');")
denied(owner,cmd('settle',a),'CLOSED_PERIOD');assert position(item['id'])['revision']=='1'
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','open','{int(period_revision)+1}','Open settlement fixture');")
# Firm serialization gives a single winner, with distinct source identities.
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:execute(identity(owner)+cmd('settle',pay(item,'1'))),range(2)))
assert sum(r.returncode==0 for r in results)==1 and position(item['id'])['revision']=='2'
a=position(item['id'])['settlements'][0];cancel_data=dict(firmId=firm,id=item['id'],expectedRevision='2',settlementId=a['id'],periodId=period,postingDate='2026-01-16',reason='Close rollback')
period_revision=run(f"select revision from paperwork_accounting_periods where firm_id='{firm}' and id='{period}';")
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','closed','{period_revision}','Close cancellation fixture');")
denied(owner,cmd('cancel_settlement',cancel_data),'CLOSED_PERIOD');assert not position(item['id'])['settlements'][0]['cancelled']
user_sql(owner,f"select paperwork_set_period_status('{firm}','{period}','open','{int(period_revision)+1}','Open cancellation fixture');")
user_sql(owner,cmd('cancel_settlement',cancel_data));assert position(item['id'])['analyticBalance']=='1170000'
# The bank identity survives cancellation and cannot be reused through a different ledger account/position.
other=fresh();cash=uid();entity('account',dict(id=cash,code='241.FX',name='Alternate cash',requiresPartner=False,validFrom='2026-01-01'))
duplicate={**pay(other,'1',source=s['sourceId']),'cashAccountId':cash,'sourceAccount':'RS351600001'}
denied(owner,cmd('settle',duplicate),'DUPLICATE_SOURCE')
bank_id=uid()
user_sql(owner,f"select paperwork_create_bank_account({lit(dict(firmId=firm,id=bank_id,name='Registered bank',number='RS351600001',currency='RSD'))},'{uid()}');")
run(f"insert into paperwork_bank_transactions values('{firm}','{uid()}','{bank_id}','REGISTERED-FX','2026-01-15','2026-01-15',4000,0,'Fixture','','','synthetic');")
denied(owner,cmd('settle',pay(other,'1',source='REGISTERED-FX')),'FX_SOURCE_ALREADY_REGISTERED')
denied(owner,f"delete from paperwork_fx_settlements where firm_id='{firm}';")
assert execute(f"update paperwork_fx_settlements set foreign_minor=1 where firm_id='{firm}';").returncode
assert run("select count(*) from information_schema.columns where table_schema='public' and table_name like 'paperwork_fx_%' and data_type in('json','jsonb');")=='0'
assert state(reader)['positions'];denied(stranger,f"select paperwork_fx_workspace('{firm}');",'ACCOUNTING_FORBIDDEN')
assert user_sql(stranger,f"select count(*) from paperwork_fx_settlements where firm_id='{firm}';")=='0'
assert int(user_sql(reader,f"select count(*) from paperwork_fx_settlements where firm_id='{firm}';"))>0
user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','read',true);")
user_sql(owner,f"select paperwork_set_agency_assignment('{firm}','{agency}','{stranger}','read',true);")
assert any(p['settlements'] for p in state(stranger)['positions'])
user_sql(owner,f"select paperwork_set_agency_consent('{firm}','{agency}','read',false);")
denied(stranger,f"select paperwork_fx_workspace('{firm}');",'ACCOUNTING_FORBIDDEN')
print('FX settlement SQL PASS: partial/full/residual/large exact payments, asset/liability realized gain/loss, remaining-principal revaluation, mixed latest-first storno, source dedup, replay/race, precision/currency/scope caps, period rollback, immutable records and reader isolation.')
