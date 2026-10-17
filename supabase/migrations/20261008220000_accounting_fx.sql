begin;
create table public.paperwork_fx_positions (
 firm_id uuid not null,id uuid not null,source_journal_id uuid not null,account_id uuid not null,partner_id uuid not null,
 direction text not null check(direction in('receivable','payable')),currency text not null check(currency in('EUR','USD','CHF','GBP')),
 foreign_minor numeric(24,0) not null check(foreign_minor>0),initial_rsd numeric(24,0) not null check(initial_rsd>0),
 rate_micros numeric(18,0) not null check(rate_micros>0),quote_units integer not null check(quote_units in(1,100)),
 rate_date date not null,published_on date not null check(published_on<=rate_date),rate_source text not null check(length(trim(rate_source)) between 1 and 200),
 source_reference text not null check(length(trim(source_reference)) between 1 and 1000),posting_date date not null check(rate_date<=posting_date),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,id),unique(firm_id,source_journal_id),
 foreign key(firm_id,source_journal_id) references public.paperwork_journals(firm_id,id),
 foreign key(firm_id,account_id) references public.paperwork_accounts(firm_id,id),foreign key(firm_id,partner_id) references public.paperwork_accounting_partners(firm_id,id)
);
create table public.paperwork_fx_revaluations (
 firm_id uuid not null,id uuid not null,position_id uuid not null,journal_id uuid not null,sequence bigint not null check(sequence>1),previous_rsd numeric(24,0) not null,target_rsd numeric(24,0) not null,
 delta numeric(24,0) not null check(delta<>0 and delta=target_rsd-previous_rsd),rate_micros numeric(18,0) not null check(rate_micros>0),quote_units integer not null check(quote_units in(1,100)),
 rate_date date not null,published_on date not null check(published_on<=rate_date),rate_source text not null check(length(trim(rate_source)) between 1 and 200),source_reference text not null check(length(trim(source_reference)) between 1 and 1000),posting_date date not null check(rate_date<=posting_date),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,id),unique(firm_id,journal_id),foreign key(firm_id,position_id) references public.paperwork_fx_positions(firm_id,id),foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id),check(previous_rsd>0 and target_rsd>0)
);
create table public.paperwork_fx_cancellations (
 firm_id uuid not null,revaluation_id uuid not null,journal_id uuid not null,sequence bigint not null check(sequence>1),posting_date date not null,reason text not null check(length(trim(reason)) between 1 and 1000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(firm_id,revaluation_id),unique(firm_id,journal_id),
 foreign key(firm_id,revaluation_id) references public.paperwork_fx_revaluations(firm_id,id),foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id) deferrable initially deferred
);
create table public.paperwork_fx_closures (
 firm_id uuid not null,position_id uuid not null,journal_id uuid not null,sequence bigint not null check(sequence>1),posting_date date not null,reason text not null check(length(trim(reason)) between 1 and 1000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(firm_id,position_id),unique(firm_id,journal_id),
 foreign key(firm_id,position_id) references public.paperwork_fx_positions(firm_id,id),foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id) deferrable initially deferred
);
create table public.paperwork_fx_requests (
 firm_id uuid not null,request_key text not null check(length(request_key) between 1 and 100),request_hash text not null,position_id uuid not null,revision bigint not null,journal_id uuid not null,
 primary key(firm_id,request_key),foreign key(firm_id,position_id) references public.paperwork_fx_positions(firm_id,id),foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id)
);
create index paperwork_fx_pair on public.paperwork_fx_positions(firm_id,account_id,partner_id);
do $$declare t text;begin foreach t in array array['paperwork_fx_positions','paperwork_fx_revaluations','paperwork_fx_cancellations','paperwork_fx_closures','paperwork_fx_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy accounting_read on public.%I for select to authenticated using(public.paperwork_accounting_readable(firm_id))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger immutable_fx before update or delete on public.%I for each row execute function public._paperwork_accounting_immutable()',t);
end loop;end $$;

create function public._paperwork_fx_convert(p_amount numeric,p_rate numeric,p_units integer) returns numeric language sql immutable set search_path='' as $$
 select div(p_amount*p_rate*2+p_units*1000000,p_units*2000000);
$$;
create function public._paperwork_fx_journals(p_firm uuid,p_account uuid,p_partner uuid) returns table(journal_id uuid) language sql stable set search_path='' as $$
 with positions as(select id,source_journal_id from public.paperwork_fx_positions where firm_id=p_firm and account_id=p_account and partner_id=p_partner),events as(select id,journal_id from public.paperwork_fx_revaluations where firm_id=p_firm and position_id in(select id from positions))
 select source_journal_id from positions union select journal_id from events union select c.journal_id from public.paperwork_fx_cancellations c where c.firm_id=p_firm and c.revaluation_id in(select id from events)
 union select c.journal_id from public.paperwork_fx_closures c where c.firm_id=p_firm and c.position_id in(select id from positions);
$$;
create function public._paperwork_fx_revision(p_firm uuid,p_id uuid) returns bigint language sql stable set search_path='' as $$
 select 1+(select count(*) from public.paperwork_fx_revaluations where firm_id=p_firm and position_id=p_id)+(select count(*) from public.paperwork_fx_cancellations c join public.paperwork_fx_revaluations e on e.firm_id=c.firm_id and e.id=c.revaluation_id where e.firm_id=p_firm and e.position_id=p_id)+(select count(*) from public.paperwork_fx_closures where firm_id=p_firm and position_id=p_id);
$$;
-- No automatic payment linkage: independently altered monetary analytics must be reviewed before revaluation.
create function public._paperwork_fx_external(p_firm uuid,p_account uuid,p_partner uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.paperwork_journal_lines l where l.firm_id=p_firm and l.account_id=p_account and l.partner_id=p_partner and l.journal_id not in(select journal_id from public._paperwork_fx_journals(p_firm,p_account,p_partner)));
$$;
create function public._paperwork_fx_reversal_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.reversal_of is not null and (
  exists(select 1 from public.paperwork_fx_positions p where p.firm_id=new.firm_id and p.source_journal_id=new.reversal_of and not exists(select 1 from public.paperwork_fx_closures c where c.firm_id=p.firm_id and c.position_id=p.id))
  or exists(select 1 from public.paperwork_fx_revaluations e where e.firm_id=new.firm_id and e.journal_id=new.reversal_of and not exists(select 1 from public.paperwork_fx_cancellations c where c.firm_id=e.firm_id and c.revaluation_id=e.id))
 ) then raise exception 'ACTIVE_FX_LINK';end if;return new;
end $$;
create trigger fx_reversal_guard before insert on public.paperwork_journals for each row execute function public._paperwork_fx_reversal_guard();

create function public.paperwork_fx_command(p_action text,p_data jsonb,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_data->>'firmId')::uuid;v_position_id uuid:=(p_data->>'id')::uuid;j uuid:=(p_data->>'journalId')::uuid;h text;r public.paperwork_fx_requests;p public.paperwork_fx_positions;v_event public.paperwork_fx_revaluations;
 rev bigint;value numeric;before_value numeric;amount numeric;rate numeric;units integer;account uuid;partner uuid;contra uuid;gain uuid;loss uuid;is_debit boolean;date date;last_date date;lines jsonb;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') or (p_action in('cancel','close') and not public.paperwork_accounting_can(f,'reverse_journal')) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY';end if;
 h:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data)::text,'UTF8')),'hex');
 select * into r from public.paperwork_fx_requests where firm_id=f and request_key=p_key;
 if found then if r.request_hash<>h then raise exception 'IDEMPOTENCY_REUSE';end if;return jsonb_build_object('firmId',f,'positionId',r.position_id,'revision',r.revision::text,'journalId',r.journal_id);end if;
 if jsonb_typeof(p_data->'postingDate') is distinct from 'string' or (p_data->>'postingDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_FX_DATE';end if;date:=(p_data->>'postingDate')::date;
 if p_action in('create','revalue') then
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
  select greatest(p.posting_date,coalesce(max(d),p.posting_date)) into last_date from (select posting_date d from public.paperwork_fx_revaluations where firm_id=f and position_id=v_position_id union all select c.posting_date from public.paperwork_fx_cancellations c join public.paperwork_fx_revaluations e on e.firm_id=c.firm_id and e.id=c.revaluation_id where e.firm_id=f and e.position_id=v_position_id) dates;
  if date<last_date then raise exception 'INVALID_FX_DATE';end if;
  before_value:=p.initial_rsd+coalesce((select sum(x.delta) from public.paperwork_fx_revaluations x where x.firm_id=f and x.position_id=v_position_id and not exists(select 1 from public.paperwork_fx_cancellations c where c.firm_id=f and c.revaluation_id=x.id)),0);
  if p_action='revalue' then
   value:=public._paperwork_fx_convert(p.foreign_minor,rate,units);if value<=0 or value>=1e24 then raise exception 'INVALID_FX_AMOUNT';end if;
   amount:=value-before_value;if amount=0 then raise exception 'NO_FX_CHANGE';end if;
   gain:=(p_data->>'gainAccountId')::uuid;loss:=(p_data->>'lossAccountId')::uuid;
   if gain=loss or p.account_id in(gain,loss) or (select count(*) from public.paperwork_accounts where firm_id=f and id in(gain,loss) and not requires_partner and active and allows_posting and valid_from<=date and (valid_to is null or valid_to>=date))<>2 then raise exception 'INVALID_FX_ACCOUNT';end if;
   is_debit:=(p.direction='receivable')=(amount>0);contra:=case when is_debit then gain else loss end;
   lines:=jsonb_build_array(jsonb_build_object('id','fx','accountId',p.account_id,'partnerId',p.partner_id,'debit',case when is_debit then abs(amount)::text else '0' end,'credit',case when is_debit then '0' else abs(amount)::text end,'description',p.currency),jsonb_build_object('id','difference','accountId',contra,'debit',case when is_debit then '0' else abs(amount)::text end,'credit',case when is_debit then abs(amount)::text else '0' end,'description',p_data->>'sourceReference'));
   perform public.paperwork_post_journal(jsonb_build_object('id',j,'firmId',f,'fiscalYearId',p_data->>'fiscalYearId','periodId',p_data->>'periodId','postingDate',date,'description','FX revaluation: '||p.currency,'lines',lines),'0','fx:'||md5(p_key));
   insert into public.paperwork_fx_revaluations values(f,j,v_position_id,j,rev+1,before_value,value,amount,rate,units,(p_data->>'rateDate')::date,(p_data->>'publishedOn')::date,trim(p_data->>'rateSource'),trim(p_data->>'sourceReference'),date,auth.uid(),now());
  elsif p_action='cancel' then
   select * into strict v_event from public.paperwork_fx_revaluations x where x.firm_id=f and x.id=(p_data->>'revaluationId')::uuid and x.position_id=v_position_id and not exists(select 1 from public.paperwork_fx_cancellations c where c.firm_id=f and c.revaluation_id=x.id);
   if v_event.target_rsd<>before_value or exists(select 1 from public.paperwork_fx_revaluations x where x.firm_id=f and x.position_id=v_position_id and not exists(select 1 from public.paperwork_fx_cancellations c where c.firm_id=f and c.revaluation_id=x.id) and x.sequence>v_event.sequence) then raise exception 'FX_REVERSE_LATEST_FIRST';end if;
   -- Core reversal IDs are deterministic; obtain the same ID the core actually generates.
   j:=md5(f::text||':'||v_event.journal_id::text||':'||'fx:'||md5(p_key))::uuid;
   insert into public.paperwork_fx_cancellations values(f,v_event.id,j,rev+1,date,trim(p_data->>'reason'),auth.uid(),now());
   perform public.paperwork_reverse_journal(f,v_event.journal_id,(p_data->>'periodId')::uuid,date,p_data->>'reason','1','fx:'||md5(p_key));
  elsif p_action='close' then
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

create function public.paperwork_fx_workspace(p_firm uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare result jsonb;begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if (select count(*) from public.paperwork_fx_positions where firm_id=p_firm)>500 or (select count(*) from public.paperwork_fx_revaluations where firm_id=p_firm)>5000 then raise exception 'FX_READ_TOO_LARGE';end if;
 select jsonb_build_object('firmId',p_firm,'generatedAt',statement_timestamp(),'positions',coalesce(jsonb_agg(jsonb_build_object(
 'id',p.id,'revision',public._paperwork_fx_revision(p_firm,p.id)::text,'sourceJournalId',p.source_journal_id,'accountId',p.account_id,'partnerId',p.partner_id,'direction',p.direction,'currency',p.currency,'foreignMinor',p.foreign_minor::text,'initialRsd',p.initial_rsd::text,'postingDate',p.posting_date::text,
 'rateMicros',p.rate_micros::text,'quoteUnits',p.quote_units::text,'rateDate',p.rate_date::text,'publishedOn',p.published_on::text,'rateSource',p.rate_source,'sourceReference',p.source_reference,
 'closed',exists(select 1 from public.paperwork_fx_closures c where c.firm_id=p_firm and c.position_id=p.id),'externalMovements',public._paperwork_fx_external(p_firm,p.account_id,p.partner_id),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'sequence',e.sequence::text,'journalId',e.journal_id,'previousRsd',e.previous_rsd::text,'targetRsd',e.target_rsd::text,'delta',e.delta::text,'rateMicros',e.rate_micros::text,'quoteUnits',e.quote_units::text,'rateDate',e.rate_date::text,'publishedOn',e.published_on::text,'rateSource',e.rate_source,'sourceReference',e.source_reference,'postingDate',e.posting_date::text,'createdAt',e.created_at,'cancelled',c.revaluation_id is not null,'reversalId',c.journal_id,'reason',c.reason,'cancelDate',c.posting_date::text,'cancelSequence',c.sequence::text) order by e.sequence),'[]'::jsonb) from public.paperwork_fx_revaluations e left join public.paperwork_fx_cancellations c on c.firm_id=e.firm_id and c.revaluation_id=e.id where e.firm_id=p_firm and e.position_id=p.id),
 'analyticBalance',(select coalesce(sum(l.debit-l.credit),0)::text from public.paperwork_journal_lines l where l.firm_id=p_firm and l.account_id=p.account_id and l.partner_id=p.partner_id),
 'closure',(select jsonb_build_object('sequence',c.sequence::text,'journalId',c.journal_id,'postingDate',c.posting_date::text,'reason',c.reason) from public.paperwork_fx_closures c where c.firm_id=p_firm and c.position_id=p.id)
 ) order by p.created_at,p.id),'[]'::jsonb)) into result from public.paperwork_fx_positions p where p.firm_id=p_firm;return result;
end $$;
revoke all on function public._paperwork_fx_convert(numeric,numeric,integer),public._paperwork_fx_journals(uuid,uuid,uuid),public._paperwork_fx_revision(uuid,uuid),public._paperwork_fx_external(uuid,uuid,uuid),public._paperwork_fx_reversal_guard() from public,anon,authenticated;
revoke all on function public.paperwork_fx_command(text,jsonb,text),public.paperwork_fx_workspace(uuid) from public,anon;
grant execute on function public.paperwork_fx_command(text,jsonb,text),public.paperwork_fx_workspace(uuid) to authenticated;
commit;
