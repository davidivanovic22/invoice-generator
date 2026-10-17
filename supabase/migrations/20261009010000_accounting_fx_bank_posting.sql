begin;
-- A bank row posts cash once. Allocations consume its clearing balance in both currencies.
create table public.paperwork_fx_bank_postings (
 firm_id uuid not null,transaction_id uuid not null,journal_id uuid not null,clearing_account_id uuid not null,
 foreign_minor numeric(24,0) not null check(foreign_minor>0),rsd_minor numeric(24,0) not null check(rsd_minor>0),
 rate_micros numeric(18,0) not null check(rate_micros>0),quote_units integer not null check(quote_units in(1,100)),
 rate_date date not null,published_on date not null check(published_on<=rate_date),
 rate_source text not null check(length(trim(rate_source)) between 1 and 200),source_reference text not null check(length(trim(source_reference)) between 1 and 1000),
 posting_date date not null check(rate_date<=posting_date),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,transaction_id),unique(firm_id,journal_id),
 foreign key(firm_id,transaction_id) references public.paperwork_fx_bank_transactions(firm_id,id),
 foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id),
 foreign key(firm_id,clearing_account_id) references public.paperwork_accounts(firm_id,id)
);
create table public.paperwork_fx_bank_allocations (
 firm_id uuid not null,id uuid not null,transaction_id uuid not null,position_id uuid not null,bank_sequence bigint not null check(bank_sequence>1),
 foreign_minor numeric(24,0) not null check(foreign_minor>0),paid_rsd numeric(24,0) not null check(paid_rsd>0),
 previous_foreign numeric(24,0) not null,previous_rsd numeric(24,0) not null,posting_date date not null,
 primary key(firm_id,id),unique(firm_id,transaction_id,bank_sequence),
 check(previous_foreign>=foreign_minor and previous_rsd>=paid_rsd and (previous_foreign=foreign_minor or previous_rsd>paid_rsd)),
 foreign key(firm_id,transaction_id) references public.paperwork_fx_bank_postings(firm_id,transaction_id),
 foreign key(firm_id,position_id) references public.paperwork_fx_positions(firm_id,id),
 foreign key(firm_id,id) references public.paperwork_fx_settlements(firm_id,id) deferrable initially deferred
);
create table public.paperwork_fx_bank_fees (
 firm_id uuid not null,id uuid not null,transaction_id uuid not null,bank_sequence bigint not null check(bank_sequence>1),
 foreign_minor numeric(24,0) not null check(foreign_minor>0),paid_rsd numeric(24,0) not null check(paid_rsd>0),
 previous_foreign numeric(24,0) not null,previous_rsd numeric(24,0) not null,fee_account_id uuid not null,posting_date date not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,id),unique(firm_id,transaction_id,bank_sequence),
 check(previous_foreign>=foreign_minor and previous_rsd>=paid_rsd and (previous_foreign=foreign_minor or previous_rsd>paid_rsd)),
 foreign key(firm_id,transaction_id) references public.paperwork_fx_bank_postings(firm_id,transaction_id),
 foreign key(firm_id,id) references public.paperwork_journals(firm_id,id),
 foreign key(firm_id,fee_account_id) references public.paperwork_accounts(firm_id,id)
);
create table public.paperwork_fx_bank_cancellations (
 firm_id uuid not null,id uuid not null,transaction_id uuid not null,kind text not null check(kind in('bank','allocation','fee')),
 bank_sequence bigint not null check(bank_sequence>1),journal_id uuid not null,posting_date date not null,
 reason text not null check(length(trim(reason)) between 1 and 1000),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,id),unique(firm_id,journal_id),unique(firm_id,transaction_id,bank_sequence),
 foreign key(firm_id,transaction_id) references public.paperwork_fx_bank_postings(firm_id,transaction_id),
 foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id) deferrable initially deferred
);
create table public.paperwork_fx_bank_posting_requests (
 firm_id uuid not null,request_key text not null check(length(request_key) between 1 and 100),request_hash text not null,
 transaction_id uuid not null,revision bigint not null check(revision>0),journal_id uuid not null,
 primary key(firm_id,request_key),foreign key(firm_id,transaction_id) references public.paperwork_fx_bank_postings(firm_id,transaction_id),
 foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id)
);
alter table public.paperwork_fx_settlements add column bank_transaction_id uuid;
alter table public.paperwork_fx_settlements add constraint fx_settlement_bank_source foreign key(firm_id,bank_transaction_id) references public.paperwork_fx_bank_postings(firm_id,transaction_id);
alter table public.paperwork_fx_settlements drop constraint paperwork_fx_settlements_firm_id_source_account_source_id_key;
create unique index paperwork_fx_manual_source on public.paperwork_fx_settlements(firm_id,source_account,source_id) where bank_transaction_id is null;

do $$declare t text;begin foreach t in array array['paperwork_fx_bank_postings','paperwork_fx_bank_allocations','paperwork_fx_bank_fees','paperwork_fx_bank_cancellations','paperwork_fx_bank_posting_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy accounting_read on public.%I for select to authenticated using(public.paperwork_accounting_readable(firm_id))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger immutable_fx_bank before update or delete on public.%I for each row execute function public._paperwork_accounting_immutable()',t);
end loop;end $$;

create function public._paperwork_fx_bank_revision(f uuid,t uuid) returns bigint language sql stable set search_path='' as $$
 select (select count(*) from public.paperwork_fx_bank_postings where firm_id=f and transaction_id=t)
 +(select count(*) from public.paperwork_fx_bank_allocations where firm_id=f and transaction_id=t)
 +(select count(*) from public.paperwork_fx_bank_fees where firm_id=f and transaction_id=t)
 +(select count(*) from public.paperwork_fx_bank_cancellations where firm_id=f and transaction_id=t)
$$;
create function public._paperwork_fx_bank_remaining(f uuid,t uuid) returns table(foreign_minor numeric,rsd_minor numeric) language sql stable set search_path='' as $$
 select p.foreign_minor-coalesce((select sum(a.foreign_minor) from public.paperwork_fx_bank_allocations a where a.firm_id=f and a.transaction_id=t and not exists(select 1 from public.paperwork_fx_bank_cancellations c where c.firm_id=f and c.id=a.id)),0)
 -coalesce((select sum(a.foreign_minor) from public.paperwork_fx_bank_fees a where a.firm_id=f and a.transaction_id=t and not exists(select 1 from public.paperwork_fx_bank_cancellations c where c.firm_id=f and c.id=a.id)),0),
 p.rsd_minor-coalesce((select sum(a.paid_rsd) from public.paperwork_fx_bank_allocations a where a.firm_id=f and a.transaction_id=t and not exists(select 1 from public.paperwork_fx_bank_cancellations c where c.firm_id=f and c.id=a.id)),0)
 -coalesce((select sum(a.paid_rsd) from public.paperwork_fx_bank_fees a where a.firm_id=f and a.transaction_id=t and not exists(select 1 from public.paperwork_fx_bank_cancellations c where c.firm_id=f and c.id=a.id)),0)
 from public.paperwork_fx_bank_postings p where p.firm_id=f and p.transaction_id=t
$$;
create function public._paperwork_fx_bank_portion(rsd numeric,remaining numeric,amount numeric) returns numeric language plpgsql immutable set search_path='' as $$declare v numeric;begin
 if amount<=0 or amount>remaining or remaining<=0 then raise exception 'FX_BANK_CAP';end if;
 v:=case when amount=remaining then rsd else div(rsd*amount*2+remaining,remaining*2) end;
 if v<=0 or (amount<remaining and v>=rsd) then raise exception 'FX_BANK_PRECISION';end if;return v;
end $$;

create or replace function public.paperwork_fx_command(p_action text,p_data jsonb,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_data->>'firmId')::uuid;v_position_id uuid:=(p_data->>'id')::uuid;j uuid:=(p_data->>'journalId')::uuid;h text;r public.paperwork_fx_requests;p public.paperwork_fx_positions;v_event public.paperwork_fx_revaluations;s public.paperwork_fx_settlements;remaining numeric;v_source_account text;cash uuid;bank_tx uuid;bank_alloc public.paperwork_fx_bank_allocations;
 rev bigint;value numeric;before_value numeric;amount numeric;rate numeric;units integer;account uuid;partner uuid;contra uuid;gain uuid;loss uuid;is_debit boolean;date date;last_date date;lines jsonb;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') or (p_action in('cancel','close','cancel_settlement') and not public.paperwork_accounting_can(f,'reverse_journal')) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY';end if;
 h:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data)::text,'UTF8')),'hex');
 select * into r from public.paperwork_fx_requests where firm_id=f and request_key=p_key;
 if found then if r.request_hash<>h then raise exception 'IDEMPOTENCY_REUSE';end if;return jsonb_build_object('firmId',f,'positionId',r.position_id,'revision',r.revision::text,'journalId',r.journal_id);end if;
 if jsonb_typeof(p_data->'postingDate') is distinct from 'string' or (p_data->>'postingDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_FX_DATE';end if;date:=(p_data->>'postingDate')::date;
 if p_action in('create','revalue','settle') then
  if jsonb_typeof(p_data->'rateMicros') is distinct from 'string' or (p_data->>'rateMicros') !~ '^[1-9][0-9]{0,17}$' or p_data->>'quoteUnits' not in('1','100') then raise exception 'INVALID_FX_RATE';end if;
  rate:=(p_data->>'rateMicros')::numeric;units:=(p_data->>'quoteUnits')::integer;
  if jsonb_typeof(p_data->'rateDate') is distinct from 'string' or jsonb_typeof(p_data->'publishedOn') is distinct from 'string' or (p_data->>'rateDate') !~ '^\d{4}-\d{2}-\d{2}$' or (p_data->>'publishedOn') !~ '^\d{4}-\d{2}-\d{2}$'
   or (p_data->>'rateDate')::date>date or (p_data->>'publishedOn')::date>(p_data->>'rateDate')::date or length(trim(coalesce(p_data->>'rateSource',''))) not between 1 and 200 or length(trim(coalesce(p_data->>'sourceReference',''))) not between 1 and 1000 then raise exception 'INVALID_FX_SOURCE';end if;
 end if;
 if p_action='create' then
  if p_data->>'expectedRevision' is distinct from '0' or exists(select 1 from public.paperwork_fx_positions where firm_id=f and id=v_position_id) then raise exception 'STALE_REVISION';end if;
  account:=(p_data->>'accountId')::uuid;partner:=(p_data->>'partnerId')::uuid;contra:=(p_data->>'counterAccountId')::uuid;
  if p_data->>'direction' not in('receivable','payable') or p_data->>'currency' not in('EUR','USD','CHF','GBP') or jsonb_typeof(p_data->'foreignMinor') is distinct from 'string' or (p_data->>'foreignMinor') !~ '^[1-9][0-9]{0,23}$' then raise exception 'INVALID_FX_AMOUNT';end if;
  if account=contra or not exists(select 1 from public.paperwork_accounts where firm_id=f and id=account and requires_partner) or not exists(select 1 from public.paperwork_accounts where firm_id=f and id=contra and not requires_partner) then raise exception 'INVALID_FX_ACCOUNT';end if;
  if exists(select 1 from public.paperwork_fx_positions x where x.firm_id=f and x.account_id=account and x.partner_id=partner and not exists(select 1 from public.paperwork_fx_closures c where c.firm_id=f and c.position_id=x.id)) or public._paperwork_fx_external(f,account,partner) then raise exception 'FX_DEDICATED_ANALYTIC_REQUIRED';end if;
  amount:=(p_data->>'foreignMinor')::numeric;value:=public._paperwork_fx_convert(amount,rate,units);is_debit:=p_data->>'direction'='receivable';
  if value<=0 or value>=1e24 then raise exception 'INVALID_FX_AMOUNT';end if;
  lines:=jsonb_build_array(jsonb_build_object('id','fx','accountId',account,'partnerId',partner,'debit',case when is_debit then value::text else '0' end,'credit',case when is_debit then '0' else value::text end,'description',p_data->>'sourceReference'),jsonb_build_object('id','base','accountId',contra,'debit',case when is_debit then '0' else value::text end,'credit',case when is_debit then value::text else '0' end,'description',p_data->>'sourceReference'));
  perform public.paperwork_post_journal(jsonb_build_object('id',j,'firmId',f,'fiscalYearId',p_data->>'fiscalYearId','periodId',p_data->>'periodId','postingDate',date,'description','FX initial: '||(p_data->>'currency'),'lines',lines),'0','fx:'||md5(p_key));
  insert into public.paperwork_fx_positions values(f,v_position_id,j,account,partner,p_data->>'direction',p_data->>'currency',amount,value,rate,units,(p_data->>'rateDate')::date,(p_data->>'publishedOn')::date,trim(p_data->>'rateSource'),trim(p_data->>'sourceReference'),date,auth.uid(),now());rev:=1;
 else
  select * into strict p from public.paperwork_fx_positions x where x.firm_id=f and x.id=v_position_id;
  rev:=public._paperwork_fx_revision(f,v_position_id);if p_data->>'expectedRevision' is distinct from rev::text or exists(select 1 from public.paperwork_fx_closures where firm_id=f and position_id=v_position_id) then raise exception 'STALE_REVISION';end if;
  if public._paperwork_fx_external(f,p.account_id,p.partner_id) then raise exception 'FX_EXTERNAL_MOVEMENTS';end if;
  last_date:=public._paperwork_fx_last_date(f,v_position_id);
  if date<last_date then raise exception 'INVALID_FX_DATE';end if;
  before_value:=public._paperwork_fx_balance(f,v_position_id);remaining:=public._paperwork_fx_foreign_at(f,v_position_id,rev+1);
  if p_action='revalue' then
   if remaining<=0 then raise exception 'FX_FULLY_SETTLED';end if;value:=public._paperwork_fx_convert(remaining,rate,units);if value<=0 or value>=1e24 then raise exception 'INVALID_FX_AMOUNT';end if;
   amount:=value-before_value;if amount=0 then raise exception 'NO_FX_CHANGE';end if;
   gain:=(p_data->>'gainAccountId')::uuid;loss:=(p_data->>'lossAccountId')::uuid;
   if gain=loss or p.account_id in(gain,loss) or (select count(*) from public.paperwork_accounts where firm_id=f and id in(gain,loss) and not requires_partner and active and allows_posting and valid_from<=date and (valid_to is null or valid_to>=date))<>2 then raise exception 'INVALID_FX_ACCOUNT';end if;
   is_debit:=(p.direction='receivable')=(amount>0);contra:=case when is_debit then gain else loss end;
   lines:=jsonb_build_array(jsonb_build_object('id','fx','accountId',p.account_id,'partnerId',p.partner_id,'debit',case when is_debit then abs(amount)::text else '0' end,'credit',case when is_debit then '0' else abs(amount)::text end,'description',p.currency),jsonb_build_object('id','difference','accountId',contra,'debit',case when is_debit then '0' else abs(amount)::text end,'credit',case when is_debit then abs(amount)::text else '0' end,'description',p_data->>'sourceReference'));
   perform public.paperwork_post_journal(jsonb_build_object('id',j,'firmId',f,'fiscalYearId',p_data->>'fiscalYearId','periodId',p_data->>'periodId','postingDate',date,'description','FX revaluation: '||p.currency,'lines',lines),'0','fx:'||md5(p_key));
   insert into public.paperwork_fx_revaluations values(f,j,v_position_id,j,rev+1,before_value,value,amount,rate,units,(p_data->>'rateDate')::date,(p_data->>'publishedOn')::date,trim(p_data->>'rateSource'),trim(p_data->>'sourceReference'),date,auth.uid(),now());
  elsif p_action='cancel' then
   select * into strict v_event from public.paperwork_fx_revaluations x where x.firm_id=f and x.id=(p_data->>'revaluationId')::uuid and x.position_id=v_position_id and not exists(select 1 from public.paperwork_fx_cancellations c where c.firm_id=f and c.revaluation_id=x.id);
   if v_event.sequence<>public._paperwork_fx_latest(f,v_position_id) or v_event.target_rsd<>before_value or exists(select 1 from public.paperwork_fx_revaluations x where x.firm_id=f and x.position_id=v_position_id and not exists(select 1 from public.paperwork_fx_cancellations c where c.firm_id=f and c.revaluation_id=x.id) and x.sequence>v_event.sequence) then raise exception 'FX_REVERSE_LATEST_FIRST';end if;
   -- Core reversal IDs are deterministic; obtain the same ID the core actually generates.
   j:=md5(f::text||':'||v_event.journal_id::text||':'||'fx:'||md5(p_key))::uuid;
   insert into public.paperwork_fx_cancellations values(f,v_event.id,j,rev+1,date,trim(p_data->>'reason'),auth.uid(),now());
   perform public.paperwork_reverse_journal(f,v_event.journal_id,(p_data->>'periodId')::uuid,date,p_data->>'reason','1','fx:'||md5(p_key));
  elsif p_action='settle' then
   if jsonb_typeof(p_data->'foreignMinor') is distinct from 'string' or (p_data->>'foreignMinor') !~ '^[1-9][0-9]{0,23}$' or p_data->>'currency' is distinct from p.currency then raise exception 'INVALID_FX_AMOUNT';end if;
   amount:=(p_data->>'foreignMinor')::numeric;if amount>remaining or remaining<=0 then raise exception 'FX_PAYMENT_CAP';end if;
   value:=case when amount=remaining then before_value else div(before_value*amount*2+remaining,remaining*2) end;
   if value<=0 or (amount<remaining and value>=before_value) then raise exception 'FX_PAYMENT_PRECISION';end if;
   bank_tx:=(p_data->>'bankTransactionId')::uuid;
   if bank_tx is not null then
    select * into strict bank_alloc from public.paperwork_fx_bank_allocations where firm_id=f and id=j and transaction_id=bank_tx and position_id=v_position_id;
    if bank_alloc.foreign_minor<>amount or bank_alloc.posting_date<>date then raise exception 'FX_BANK_PAYMENT_CONFLICT';end if;
    rate:=bank_alloc.paid_rsd;
   else rate:=public._paperwork_fx_convert(amount,rate,units);end if;if rate<=0 or rate>=1e24 then raise exception 'INVALID_FX_AMOUNT';end if;
   cash:=(p_data->>'cashAccountId')::uuid;gain:=(p_data->>'gainAccountId')::uuid;loss:=(p_data->>'lossAccountId')::uuid;
   if (select count(*) from public.paperwork_accounts where firm_id=f and id in(cash,gain,loss) and not requires_partner and active and allows_posting and valid_from<=date and (valid_to is null or valid_to>=date))<>3 then raise exception 'INVALID_FX_ACCOUNT';end if;
   v_source_account:=upper(regexp_replace(coalesce(p_data->>'sourceAccount',''),'[[:space:]-]','','g'));
   if v_source_account !~ '^[A-Z0-9]{5,64}$' or length(trim(coalesce(p_data->>'sourceId',''))) not between 1 and 200 then raise exception 'INVALID_FX_PAYMENT_SOURCE';end if;
   if exists(select 1 from public.paperwork_fx_settlements where firm_id=f and source_account=v_source_account and source_id=trim(p_data->>'sourceId') and (bank_tx is null or bank_transaction_id is null)) then raise exception 'DUPLICATE_SOURCE';end if;
   if exists(select 1 from public.paperwork_bank_transactions t join public.paperwork_bank_accounts a on a.firm_id=t.firm_id and a.id=t.bank_account_id where t.firm_id=f and a.number=v_source_account and t.external_id=trim(p_data->>'sourceId')) then raise exception 'FX_SOURCE_ALREADY_REGISTERED';end if;
   is_debit:=p.direction='receivable';
   lines:=jsonb_build_array(jsonb_build_object('id','cash','accountId',cash,'debit',case when is_debit then rate::text else '0' end,'credit',case when is_debit then '0' else rate::text end,'description',p_data->>'sourceId'),jsonb_build_object('id','fx','accountId',p.account_id,'partnerId',p.partner_id,'debit',case when is_debit then '0' else value::text end,'credit',case when is_debit then value::text else '0' end,'description',p.currency));
   if rate<>value then
    is_debit:=(p.direction='receivable')=(rate<value);contra:=case when is_debit then loss else gain end;
    lines:=lines||jsonb_build_array(jsonb_build_object('id','realized','accountId',contra,'debit',case when is_debit then abs(rate-value)::text else '0' end,'credit',case when is_debit then '0' else abs(rate-value)::text end,'description','Realized FX'));
   end if;
   perform public.paperwork_post_journal(jsonb_build_object('id',j,'firmId',f,'fiscalYearId',p_data->>'fiscalYearId','periodId',p_data->>'periodId','postingDate',date,'description','FX settlement: '||p.currency,'lines',lines),'0','fx:'||md5(p_key));
   insert into public.paperwork_fx_settlements values(f,j,v_position_id,j,rev+1,amount,remaining,before_value,value,rate,rate-value,cash,gain,loss,p.currency,v_source_account,trim(p_data->>'sourceId'),(p_data->>'rateMicros')::numeric,units,(p_data->>'rateDate')::date,(p_data->>'publishedOn')::date,trim(p_data->>'rateSource'),trim(p_data->>'sourceReference'),date,auth.uid(),now(),bank_tx);
  elsif p_action='cancel_settlement' then
   select * into strict s from public.paperwork_fx_settlements x where x.firm_id=f and x.id=(p_data->>'settlementId')::uuid and x.position_id=v_position_id and not exists(select 1 from public.paperwork_fx_settlement_cancellations c where c.firm_id=f and c.settlement_id=x.id);
   if s.bank_transaction_id is not null and not exists(select 1 from public.paperwork_fx_bank_cancellations where firm_id=f and id=s.id and transaction_id=s.bank_transaction_id and kind='allocation') then raise exception 'FX_BANK_USE_CANCELLATION';end if;
   if s.sequence<>public._paperwork_fx_latest(f,v_position_id) then raise exception 'FX_REVERSE_LATEST_FIRST';end if;
   j:=md5(f::text||':'||s.journal_id::text||':'||'fx:'||md5(p_key))::uuid;
   insert into public.paperwork_fx_settlement_cancellations values(f,s.id,j,rev+1,date,trim(p_data->>'reason'),auth.uid(),now());
   perform public.paperwork_reverse_journal(f,s.journal_id,(p_data->>'periodId')::uuid,date,p_data->>'reason','1','fx:'||md5(p_key));
  elsif p_action='close' then
   if exists(select 1 from public.paperwork_fx_settlements x where x.firm_id=f and x.position_id=v_position_id and not exists(select 1 from public.paperwork_fx_settlement_cancellations c where c.firm_id=f and c.settlement_id=x.id)) then raise exception 'ACTIVE_FX_SETTLEMENTS';end if;
   if exists(select 1 from public.paperwork_fx_revaluations x where x.firm_id=f and x.position_id=v_position_id and not exists(select 1 from public.paperwork_fx_cancellations c where c.firm_id=f and c.revaluation_id=x.id)) then raise exception 'ACTIVE_FX_REVALUATIONS';end if;
   j:=md5(f::text||':'||p.source_journal_id::text||':'||'fx:'||md5(p_key))::uuid;
   insert into public.paperwork_fx_closures values(f,v_position_id,j,rev+1,date,trim(p_data->>'reason'),auth.uid(),now());
   perform public.paperwork_reverse_journal(f,p.source_journal_id,(p_data->>'periodId')::uuid,date,p_data->>'reason','1','fx:'||md5(p_key));
  else raise exception 'INVALID_FX_ACTION';end if;rev:=rev+1;
 end if;
 insert into public.paperwork_fx_requests values(f,p_key,h,v_position_id,rev,j);
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(f,auth.uid(),'fx.'||p_action,v_position_id::text,p_data->>'sourceReference');
 return jsonb_build_object('firmId',f,'positionId',v_position_id,'revision',rev::text,'journalId',j);
end $$;

create or replace function public.paperwork_fx_workspace(p_firm uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare result jsonb;begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if (select count(*) from public.paperwork_fx_positions where firm_id=p_firm)>500 or (select count(*) from public.paperwork_fx_revaluations where firm_id=p_firm)>5000 or (select count(*) from public.paperwork_fx_settlements where firm_id=p_firm)>5000 then raise exception 'FX_READ_TOO_LARGE';end if;
 select jsonb_build_object('firmId',p_firm,'generatedAt',statement_timestamp(),'positions',coalesce(jsonb_agg(jsonb_build_object(
 'id',p.id,'revision',public._paperwork_fx_revision(p_firm,p.id)::text,'sourceJournalId',p.source_journal_id,'accountId',p.account_id,'partnerId',p.partner_id,'direction',p.direction,'currency',p.currency,'foreignMinor',p.foreign_minor::text,'initialRsd',p.initial_rsd::text,'postingDate',p.posting_date::text,
 'rateMicros',p.rate_micros::text,'quoteUnits',p.quote_units::text,'rateDate',p.rate_date::text,'publishedOn',p.published_on::text,'rateSource',p.rate_source,'sourceReference',p.source_reference,
 'closed',exists(select 1 from public.paperwork_fx_closures c where c.firm_id=p_firm and c.position_id=p.id),'externalMovements',public._paperwork_fx_external(p_firm,p.account_id,p.partner_id),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'sequence',e.sequence::text,'journalId',e.journal_id,'foreignMinor',public._paperwork_fx_foreign_at(p_firm,p.id,e.sequence)::text,'previousRsd',e.previous_rsd::text,'targetRsd',e.target_rsd::text,'delta',e.delta::text,'rateMicros',e.rate_micros::text,'quoteUnits',e.quote_units::text,'rateDate',e.rate_date::text,'publishedOn',e.published_on::text,'rateSource',e.rate_source,'sourceReference',e.source_reference,'postingDate',e.posting_date::text,'createdAt',e.created_at,'cancelled',c.revaluation_id is not null,'reversalId',c.journal_id,'reason',c.reason,'cancelDate',c.posting_date::text,'cancelSequence',c.sequence::text) order by e.sequence),'[]'::jsonb) from public.paperwork_fx_revaluations e left join public.paperwork_fx_cancellations c on c.firm_id=e.firm_id and c.revaluation_id=e.id where e.firm_id=p_firm and e.position_id=p.id),
 'analyticBalance',(select coalesce(sum(l.debit-l.credit),0)::text from public.paperwork_journal_lines l where l.firm_id=p_firm and l.account_id=p.account_id and l.partner_id=p.partner_id),
 'settlements',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'sequence',s.sequence::text,'journalId',s.journal_id,'foreignMinor',s.foreign_minor::text,'previousForeign',s.previous_foreign::text,'previousRsd',s.previous_rsd::text,'carryingRsd',s.carrying_rsd::text,'paidRsd',s.paid_rsd::text,'delta',s.delta::text,'cashAccountId',s.cash_account_id,'gainAccountId',s.gain_account_id,'lossAccountId',s.loss_account_id,'currency',s.currency,'sourceAccount',s.source_account,'sourceId',s.source_id,'rateMicros',s.rate_micros::text,'quoteUnits',s.quote_units::text,'rateDate',s.rate_date::text,'publishedOn',s.published_on::text,'rateSource',s.rate_source,'sourceReference',s.source_reference,'postingDate',s.posting_date::text,'createdAt',s.created_at,'cancelled',c.settlement_id is not null,'reversalId',c.journal_id,'reason',c.reason,'cancelDate',c.posting_date::text,'cancelSequence',c.sequence::text,'bank',(select jsonb_build_object('transactionId',a.transaction_id,'previousForeign',a.previous_foreign::text,'previousRsd',a.previous_rsd::text) from public.paperwork_fx_bank_allocations a where a.firm_id=s.firm_id and a.id=s.id)) order by s.sequence),'[]'::jsonb) from public.paperwork_fx_settlements s left join public.paperwork_fx_settlement_cancellations c on c.firm_id=s.firm_id and c.settlement_id=s.id where s.firm_id=p_firm and s.position_id=p.id),
 'closure',(select jsonb_build_object('sequence',c.sequence::text,'journalId',c.journal_id,'postingDate',c.posting_date::text,'reason',c.reason) from public.paperwork_fx_closures c where c.firm_id=p_firm and c.position_id=p.id)
 ) order by p.created_at,p.id),'[]'::jsonb)) into result from public.paperwork_fx_positions p where p.firm_id=p_firm;return result;
end $$;

create or replace function public._paperwork_fx_bank_payment_guard() returns trigger language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare a public.paperwork_fx_bank_accounts;t public.paperwork_fx_bank_transactions;s public.paperwork_fx_settlements;begin
 perform 1 from public.paperwork_firms where id=new.firm_id for update;
 if tg_table_name='paperwork_fx_bank_transactions' then
 select * into strict a from public.paperwork_fx_bank_accounts where firm_id=new.firm_id and id=new.bank_account_id;
 select * into s from public.paperwork_fx_settlements where firm_id=new.firm_id and source_account=a.number and source_id=new.external_id;
 if found and not public._paperwork_fx_bank_matches(a,new,s) then raise exception 'FX_BANK_PAYMENT_CONFLICT';end if;
 else
 if new.bank_transaction_id is not null then
 if not exists(select 1 from public.paperwork_fx_bank_allocations x join public.paperwork_fx_bank_postings b on b.firm_id=x.firm_id and b.transaction_id=x.transaction_id
 join public.paperwork_fx_bank_transactions t on t.firm_id=b.firm_id and t.id=b.transaction_id
 join public.paperwork_fx_bank_accounts a on a.firm_id=t.firm_id and a.id=t.bank_account_id
 join public.paperwork_fx_positions p on p.firm_id=x.firm_id and p.id=x.position_id
 where x.firm_id=new.firm_id and x.id=new.id and x.transaction_id=new.bank_transaction_id and x.position_id=new.position_id
 and x.foreign_minor=new.foreign_minor and x.paid_rsd=new.paid_rsd and x.posting_date=new.posting_date
 and b.clearing_account_id=new.cash_account_id and a.number=new.source_account and a.currency=new.currency and t.external_id=new.source_id
 and ((t.incoming>0 and p.direction='receivable') or (t.outgoing>0 and p.direction='payable')))
 then raise exception 'FX_BANK_PAYMENT_CONFLICT';end if;return new;
 end if;
 if exists(select 1 from public.paperwork_fx_bank_postings b join public.paperwork_fx_bank_transactions t on t.firm_id=b.firm_id and t.id=b.transaction_id
 join public.paperwork_fx_bank_accounts a on a.firm_id=t.firm_id and a.id=t.bank_account_id where b.firm_id=new.firm_id and a.number=new.source_account and t.external_id=new.source_id) then raise exception 'FX_BANK_SOURCE_POSTED';end if;
 select * into a from public.paperwork_fx_bank_accounts where firm_id=new.firm_id and number=new.source_account;
 if found then
 if a.currency<>new.currency or a.cash_account_id<>new.cash_account_id then raise exception 'FX_BANK_PAYMENT_CONFLICT';end if;
 select * into t from public.paperwork_fx_bank_transactions where firm_id=new.firm_id and bank_account_id=a.id and external_id=new.source_id;
 if found and not public._paperwork_fx_bank_matches(a,t,new) then raise exception 'FX_BANK_PAYMENT_CONFLICT';end if;
 end if;
 end if;return new;
end $$;

-- BANK_COMMAND_AND_READ
create function public.paperwork_fx_bank_posting_command(p_action text,p_data jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare f uuid:=(p_data->>'firmId')::uuid;tx uuid:=(p_data->>'transactionId')::uuid;j uuid:=(p_data->>'journalId')::uuid;
 t public.paperwork_fx_bank_transactions;a public.paperwork_fx_bank_accounts;b public.paperwork_fx_bank_postings;
 r public.paperwork_fx_bank_posting_requests;x public.paperwork_fx_bank_allocations;e public.paperwork_fx_bank_fees;
 p public.paperwork_fx_positions;v record;rev bigint;dt date;yr uuid;amt numeric;paid numeric;rate numeric;units integer;clear uuid;fee uuid;target uuid;h text;lines jsonb;result jsonb;last_dt date;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') or (p_action like 'cancel_%' and not public.paperwork_accounting_can(f,'reverse_journal')) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if p_action not in('post','allocate','fee','cancel_allocation','cancel_fee','cancel_bank') or p_action is null then raise exception 'INVALID_FX_BANK_ACTION';end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY';end if;
 h:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data)::text,'UTF8')),'hex');
 select * into r from public.paperwork_fx_bank_posting_requests where firm_id=f and request_key=p_key;
 if found then if r.request_hash<>h then raise exception 'IDEMPOTENCY_REUSE';end if;
 return jsonb_build_object('firmId',f,'transactionId',tx,'revision',r.revision::text,'journalId',r.journal_id);end if;
 rev:=public._paperwork_fx_bank_revision(f,tx);
 if p_data->>'expectedRevision' is distinct from rev::text then raise exception 'STALE_REVISION';end if;
 select * into strict t from public.paperwork_fx_bank_transactions where firm_id=f and id=tx;
 select * into strict a from public.paperwork_fx_bank_accounts where firm_id=f and id=t.bank_account_id;
 if jsonb_typeof(p_data->'postingDate') is distinct from 'string' or (p_data->>'postingDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_FX_DATE';end if;
 dt:=(p_data->>'postingDate')::date;yr:=(p_data->>'fiscalYearId')::uuid;
 if not exists(select 1 from public.paperwork_fx_bank_statement_lines l join public.paperwork_fx_bank_statements s on s.firm_id=l.firm_id and s.id=l.statement_id where l.firm_id=f and l.transaction_id=tx and s.fiscal_year_id=yr) then raise exception 'INVALID_YEAR';end if;
 if p_action='post' then
 if rev<>0 or dt<>t.booking_date then raise exception 'INVALID_FX_BANK_DATE';end if;
 if exists(select 1 from public.paperwork_fx_settlements where firm_id=f and source_account=a.number and source_id=t.external_id) then raise exception 'FX_BANK_ALREADY_SETTLED';end if;
 clear:=(p_data->>'clearingAccountId')::uuid;
 if clear=a.cash_account_id or not exists(select 1 from public.paperwork_accounts where firm_id=f and id=clear and active and allows_posting and not requires_partner) then raise exception 'INVALID_FX_ACCOUNT';end if;
 if jsonb_typeof(p_data->'rateMicros') is distinct from 'string' or (p_data->>'rateMicros') !~ '^[1-9][0-9]{0,17}$' or coalesce(p_data->>'quoteUnits','') not in('1','100') then raise exception 'INVALID_FX_RATE';end if;
 if jsonb_typeof(p_data->'rateDate') is distinct from 'string' or jsonb_typeof(p_data->'publishedOn') is distinct from 'string' or (p_data->>'rateDate') !~ '^\d{4}-\d{2}-\d{2}$' or (p_data->>'publishedOn') !~ '^\d{4}-\d{2}-\d{2}$'
 or (p_data->>'rateDate')::date>dt or (p_data->>'publishedOn')::date>(p_data->>'rateDate')::date or length(trim(coalesce(p_data->>'rateSource',''))) not between 1 and 200 or length(trim(coalesce(p_data->>'sourceReference',''))) not between 1 and 1000 then raise exception 'INVALID_FX_SOURCE';end if;
 rate:=(p_data->>'rateMicros')::numeric;units:=(p_data->>'quoteUnits')::integer;amt:=t.incoming+t.outgoing;paid:=public._paperwork_fx_convert(amt,rate,units);
 if paid<=0 or paid>=1e24 then raise exception 'INVALID_FX_AMOUNT';end if;
 lines:=jsonb_build_array(jsonb_build_object('id','cash','accountId',a.cash_account_id,'debit',case when t.incoming>0 then paid::text else '0' end,'credit',case when t.incoming>0 then '0' else paid::text end,'description',t.external_id),jsonb_build_object('id','clearing','accountId',clear,'debit',case when t.incoming>0 then '0' else paid::text end,'credit',case when t.incoming>0 then paid::text else '0' end,'description',t.external_id));
 perform public.paperwork_post_journal(jsonb_build_object('firmId',f,'id',j,'fiscalYearId',yr,'periodId',p_data->>'periodId','postingDate',dt,'description','FX bank source: '||t.external_id,'lines',lines),'0','fxbank:'||md5(p_key));
 insert into public.paperwork_fx_bank_postings values(f,tx,j,clear,amt,paid,rate,units,(p_data->>'rateDate')::date,(p_data->>'publishedOn')::date,trim(p_data->>'rateSource'),trim(p_data->>'sourceReference'),dt,auth.uid(),now());
 else
 select * into strict b from public.paperwork_fx_bank_postings where firm_id=f and transaction_id=tx;
 if exists(select 1 from public.paperwork_fx_bank_cancellations where firm_id=f and transaction_id=tx and kind='bank') then raise exception 'FX_BANK_REVERSED';end if;
 select max(d) into last_dt from (select b.posting_date d union all select posting_date from public.paperwork_fx_bank_allocations where firm_id=f and transaction_id=tx union all select posting_date from public.paperwork_fx_bank_fees where firm_id=f and transaction_id=tx union all select posting_date from public.paperwork_fx_bank_cancellations where firm_id=f and transaction_id=tx) dates;
 if dt<last_dt then raise exception 'INVALID_FX_BANK_DATE';end if;
 select * into v from public._paperwork_fx_bank_remaining(f,tx);
 if p_action in('allocate','fee') then
 if jsonb_typeof(p_data->'foreignMinor') is distinct from 'string' or (p_data->>'foreignMinor') !~ '^[1-9][0-9]{0,23}$' then raise exception 'INVALID_FX_AMOUNT';end if;
 amt:=(p_data->>'foreignMinor')::numeric;paid:=public._paperwork_fx_bank_portion(v.rsd_minor,v.foreign_minor,amt);
 if p_action='allocate' then
 select * into strict p from public.paperwork_fx_positions where firm_id=f and id=(p_data->>'positionId')::uuid;
 if p.currency<>a.currency or ((p.direction='receivable')<>(t.incoming>0)) then raise exception 'FX_BANK_PAYMENT_CONFLICT';end if;
 insert into public.paperwork_fx_bank_allocations values(f,j,tx,p.id,rev+1,amt,paid,v.foreign_minor,v.rsd_minor,dt);
 result:=public.paperwork_fx_command('settle',jsonb_build_object('firmId',f,'id',p.id,'expectedRevision',p_data->>'positionRevision','journalId',j,'fiscalYearId',yr,'periodId',p_data->>'periodId','postingDate',dt,
 'foreignMinor',amt::text,'currency',a.currency,'cashAccountId',b.clearing_account_id,'gainAccountId',p_data->>'gainAccountId','lossAccountId',p_data->>'lossAccountId','sourceAccount',a.number,'sourceId',t.external_id,'bankTransactionId',tx,
 'rateMicros',b.rate_micros::text,'quoteUnits',b.quote_units::text,'rateDate',b.rate_date::text,'publishedOn',b.published_on::text,'rateSource',b.rate_source,'sourceReference',b.source_reference),'fxbank:alloc:'||md5(p_key));
 else
 if t.outgoing<=0 then raise exception 'FX_BANK_FEE_DIRECTION';end if;fee:=(p_data->>'feeAccountId')::uuid;
 if fee in(a.cash_account_id,b.clearing_account_id) or not exists(select 1 from public.paperwork_accounts where firm_id=f and id=fee and active and allows_posting and not requires_partner) then raise exception 'INVALID_FX_ACCOUNT';end if;
 lines:=jsonb_build_array(jsonb_build_object('id','fee','accountId',fee,'debit',paid::text,'credit','0','description',t.external_id),jsonb_build_object('id','clearing','accountId',b.clearing_account_id,'debit','0','credit',paid::text,'description',t.external_id));
 perform public.paperwork_post_journal(jsonb_build_object('firmId',f,'id',j,'fiscalYearId',yr,'periodId',p_data->>'periodId','postingDate',dt,'description','FX bank fee: '||t.external_id,'lines',lines),'0','fxbank:'||md5(p_key));
 insert into public.paperwork_fx_bank_fees values(f,j,tx,rev+1,amt,paid,v.foreign_minor,v.rsd_minor,fee,dt,auth.uid(),now());
 end if;
 else
 target:=(p_data->>'targetId')::uuid;
 if p_action='cancel_allocation' then
 select * into strict x from public.paperwork_fx_bank_allocations where firm_id=f and id=target and transaction_id=tx;
 j:=md5(f::text||':'||target::text||':'||'fx:'||md5('fxbank:cancel:'||md5(p_key)))::uuid;
 insert into public.paperwork_fx_bank_cancellations values(f,target,tx,'allocation',rev+1,j,dt,trim(p_data->>'reason'),auth.uid(),now());
 perform public.paperwork_fx_command('cancel_settlement',jsonb_build_object('firmId',f,'id',x.position_id,'expectedRevision',p_data->>'positionRevision','settlementId',target,'periodId',p_data->>'periodId','postingDate',dt,'reason',p_data->>'reason'),'fxbank:cancel:'||md5(p_key));
 else
 if p_action='cancel_fee' then select * into strict e from public.paperwork_fx_bank_fees where firm_id=f and id=target and transaction_id=tx;
 else
 if target<>b.journal_id or exists(select 1 from public.paperwork_fx_bank_allocations x where x.firm_id=f and x.transaction_id=tx and not exists(select 1 from public.paperwork_fx_bank_cancellations c where c.firm_id=f and c.id=x.id)) or exists(select 1 from public.paperwork_fx_bank_fees x where x.firm_id=f and x.transaction_id=tx and not exists(select 1 from public.paperwork_fx_bank_cancellations c where c.firm_id=f and c.id=x.id)) then raise exception 'FX_BANK_ACTIVE_DEPENDENCIES';end if;
 end if;
 j:=md5(f::text||':'||target::text||':'||'fxbank:'||md5(p_key))::uuid;
 insert into public.paperwork_fx_bank_cancellations values(f,target,tx,case when p_action='cancel_fee' then 'fee' else 'bank' end,rev+1,j,dt,trim(p_data->>'reason'),auth.uid(),now());
 perform public.paperwork_reverse_journal(f,target,(p_data->>'periodId')::uuid,dt,p_data->>'reason','1','fxbank:'||md5(p_key));
 end if;
 end if;
 end if;
 insert into public.paperwork_fx_bank_posting_requests values(f,p_key,h,tx,rev+1,j);
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(f,auth.uid(),'fx.bank_'||p_action,tx::text,p_data->>'reason');
 return jsonb_build_object('firmId',f,'transactionId',tx,'revision',(rev+1)::text,'journalId',j);
end $$;

create function public._paperwork_fx_bank_reversal_guard() returns trigger language plpgsql set search_path='' as $$begin
 if new.reversal_of is not null and (
 exists(select 1 from public.paperwork_fx_bank_postings b where b.firm_id=new.firm_id and b.journal_id=new.reversal_of and not exists(select 1 from public.paperwork_fx_bank_cancellations c where c.firm_id=b.firm_id and c.id=b.journal_id and c.kind='bank'))
 or exists(select 1 from public.paperwork_fx_bank_fees b where b.firm_id=new.firm_id and b.id=new.reversal_of and not exists(select 1 from public.paperwork_fx_bank_cancellations c where c.firm_id=b.firm_id and c.id=b.id and c.kind='fee')))
 then raise exception 'ACTIVE_FX_BANK_LINK';end if;return new;
end $$;
create trigger fx_bank_reversal_guard before insert on public.paperwork_journals for each row execute function public._paperwork_fx_bank_reversal_guard();

create function public.paperwork_fx_bank_workbench(p_firm uuid,p_transaction uuid) returns jsonb
language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare t public.paperwork_fx_bank_transactions;a public.paperwork_fx_bank_accounts;b public.paperwork_fx_bank_postings;v record;closed boolean;begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 select * into strict t from public.paperwork_fx_bank_transactions where firm_id=p_firm and id=p_transaction;
 select * into strict a from public.paperwork_fx_bank_accounts where firm_id=p_firm and id=t.bank_account_id;
 select * into b from public.paperwork_fx_bank_postings where firm_id=p_firm and transaction_id=p_transaction;
 select * into v from public._paperwork_fx_bank_remaining(p_firm,p_transaction);
 closed:=exists(select 1 from public.paperwork_fx_bank_cancellations where firm_id=p_firm and transaction_id=p_transaction and kind='bank');
 if (select count(*) from public.paperwork_fx_bank_allocations where firm_id=p_firm and transaction_id=p_transaction)+(select count(*) from public.paperwork_fx_bank_fees where firm_id=p_firm and transaction_id=p_transaction)>5000 then raise exception 'FX_BANK_READ_LIMIT';end if;
 return jsonb_build_object('firmId',p_firm,'transactionId',p_transaction,'revision',public._paperwork_fx_bank_revision(p_firm,p_transaction)::text,
 'transaction',jsonb_build_object('externalId',t.external_id,'bookingDate',t.booking_date::text,'incoming',t.incoming::text,'outgoing',t.outgoing::text),
 'account',jsonb_build_object('id',a.id,'number',a.number,'currency',a.currency,'cashAccountId',a.cash_account_id),
 'legacyPayment',exists(select 1 from public.paperwork_fx_settlements where firm_id=p_firm and source_account=a.number and source_id=t.external_id and bank_transaction_id is null),
 'posting',case when b.journal_id is null then null else jsonb_build_object('journalId',b.journal_id,'clearingAccountId',b.clearing_account_id,'foreignMinor',b.foreign_minor::text,'rsdMinor',b.rsd_minor::text,'postingDate',b.posting_date::text,
 'rateMicros',b.rate_micros::text,'quoteUnits',b.quote_units::text,'rateDate',b.rate_date::text,'publishedOn',b.published_on::text,'rateSource',b.rate_source,'sourceReference',b.source_reference,
 'closed',closed,'remainingForeign',case when closed then '0' else v.foreign_minor::text end,'remainingRsd',case when closed then '0' else v.rsd_minor::text end,
 'attributedBalance',(select coalesce(sum(l.debit-l.credit),0)::text from public.paperwork_journal_lines l where l.firm_id=p_firm and l.account_id=b.clearing_account_id and l.journal_id in(
 select b.journal_id union select id from public.paperwork_fx_bank_allocations where firm_id=p_firm and transaction_id=p_transaction union select id from public.paperwork_fx_bank_fees where firm_id=p_firm and transaction_id=p_transaction union select journal_id from public.paperwork_fx_bank_cancellations where firm_id=p_firm and transaction_id=p_transaction))) end,
 'allocations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'positionId',x.position_id,'sequence',x.bank_sequence::text,'foreignMinor',x.foreign_minor::text,'paidRsd',x.paid_rsd::text,'previousForeign',x.previous_foreign::text,'previousRsd',x.previous_rsd::text,'postingDate',x.posting_date::text) order by x.bank_sequence),'[]'::jsonb) from public.paperwork_fx_bank_allocations x where x.firm_id=p_firm and x.transaction_id=p_transaction),
 'fees',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'feeAccountId',x.fee_account_id,'sequence',x.bank_sequence::text,'foreignMinor',x.foreign_minor::text,'paidRsd',x.paid_rsd::text,'previousForeign',x.previous_foreign::text,'previousRsd',x.previous_rsd::text,'postingDate',x.posting_date::text) order by x.bank_sequence),'[]'::jsonb) from public.paperwork_fx_bank_fees x where x.firm_id=p_firm and x.transaction_id=p_transaction),
 'cancellations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'sequence',x.bank_sequence::text,'journalId',x.journal_id,'postingDate',x.posting_date::text,'reason',x.reason) order by x.bank_sequence),'[]'::jsonb) from public.paperwork_fx_bank_cancellations x where x.firm_id=p_firm and x.transaction_id=p_transaction),
 'fx',public.paperwork_fx_workspace(p_firm));
end $$;
revoke all on function public._paperwork_fx_bank_revision(uuid,uuid),public._paperwork_fx_bank_remaining(uuid,uuid),public._paperwork_fx_bank_portion(numeric,numeric,numeric),public._paperwork_fx_bank_reversal_guard() from public,anon,authenticated;
revoke all on function public.paperwork_fx_bank_posting_command(text,jsonb,text),public.paperwork_fx_bank_workbench(uuid,uuid) from public,anon;
grant execute on function public.paperwork_fx_bank_posting_command(text,jsonb,text),public.paperwork_fx_bank_workbench(uuid,uuid) to authenticated;
create or replace function public.paperwork_fx_bank_reconciliation(p_firm uuid,p_statement uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;a public.paperwork_fx_bank_accounts;begin
 result:=public.paperwork_read_fx_bank_statement(p_firm,p_statement);
 select * into strict a from public.paperwork_fx_bank_accounts where firm_id=p_firm and id=(result->>'accountId')::uuid;
 return result || jsonb_build_object('currency',a.currency,'number',a.number,'cashAccountId',a.cash_account_id,
 'postings',(select coalesce(jsonb_agg(jsonb_build_object('transactionId',b.transaction_id,'journalId',b.journal_id,'revision',public._paperwork_fx_bank_revision(p_firm,b.transaction_id)::text,
 'closed',exists(select 1 from public.paperwork_fx_bank_cancellations c where c.firm_id=p_firm and c.transaction_id=b.transaction_id and c.kind='bank'),
 'remainingForeign',case when exists(select 1 from public.paperwork_fx_bank_cancellations c where c.firm_id=p_firm and c.transaction_id=b.transaction_id and c.kind='bank') then '0' else v.foreign_minor::text end,
 'remainingRsd',case when exists(select 1 from public.paperwork_fx_bank_cancellations c where c.firm_id=p_firm and c.transaction_id=b.transaction_id and c.kind='bank') then '0' else v.rsd_minor::text end) order by b.transaction_id),'[]'::jsonb)
 from public.paperwork_fx_bank_statement_lines sl join public.paperwork_fx_bank_postings b on b.firm_id=sl.firm_id and b.transaction_id=sl.transaction_id
 cross join lateral public._paperwork_fx_bank_remaining(p_firm,b.transaction_id) v where sl.firm_id=p_firm and sl.statement_id=p_statement),
 'links',(select coalesce(jsonb_agg(jsonb_build_object('transactionId',t.id,'settlementId',s.id,'linked',l.transaction_id is not null,
 'cancelled',exists(select 1 from public.paperwork_fx_settlement_cancellations c where c.firm_id=p_firm and c.settlement_id=s.id)) order by t.id),'[]'::jsonb)
 from public.paperwork_fx_bank_statement_lines sl join public.paperwork_fx_bank_transactions t on t.firm_id=sl.firm_id and t.id=sl.transaction_id
 join public.paperwork_fx_settlements s on s.firm_id=t.firm_id and s.source_account=a.number and s.source_id=t.external_id
 left join public.paperwork_fx_bank_links l on l.firm_id=t.firm_id and l.transaction_id=t.id
 where sl.firm_id=p_firm and sl.statement_id=p_statement and public._paperwork_fx_bank_matches(a,t,s)));
end $$;

commit;
