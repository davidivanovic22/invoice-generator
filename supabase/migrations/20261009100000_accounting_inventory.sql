begin;
create table public.paperwork_stock_items (
 firm_id uuid not null,id uuid not null,sku text not null check(length(trim(sku))>=1 and length(sku)<=100),name text not null check(length(trim(name))>=1 and length(name)<=200),
 warehouse text not null check(length(trim(warehouse))>=1 and length(warehouse)<=100),unit text not null check(length(trim(unit))>=1 and length(unit)<=20),account_id uuid not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(firm_id,id),unique(firm_id,warehouse,sku),
 foreign key(firm_id,account_id) references public.paperwork_accounts(firm_id,id)
);
create table public.paperwork_stock_movements (
 firm_id uuid not null,id uuid not null,item_id uuid not null,sequence bigint not null check(sequence>1),kind text not null check(kind in('receipt','issue')),
 quantity numeric(24,0) not null check(quantity>0),value numeric(24,0) not null check(value>0),previous_quantity numeric(24,0) not null check(previous_quantity>=0),previous_value numeric(24,0) not null check(previous_value>=0),
 counter_account_id uuid not null,partner_id uuid,external_id text not null check(length(trim(external_id))>=1 and length(external_id)<=200),posting_date date not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(firm_id,id),unique(firm_id,external_id),unique(firm_id,item_id,sequence),
 foreign key(firm_id,item_id) references public.paperwork_stock_items(firm_id,id),foreign key(firm_id,id) references public.paperwork_journals(firm_id,id),
 foreign key(firm_id,counter_account_id) references public.paperwork_accounts(firm_id,id),foreign key(firm_id,partner_id) references public.paperwork_accounting_partners(firm_id,id)
);
create table public.paperwork_stock_cancellations (
 firm_id uuid not null,movement_id uuid not null,journal_id uuid not null,item_id uuid not null,sequence bigint not null check(sequence>1),posting_date date not null,
 reason text not null check(length(trim(reason))>=1 and length(reason)<=1000),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,movement_id),unique(firm_id,journal_id),unique(firm_id,item_id,sequence),foreign key(firm_id,movement_id) references public.paperwork_stock_movements(firm_id,id),
 foreign key(firm_id,item_id) references public.paperwork_stock_items(firm_id,id),foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id) deferrable initially deferred
);
create table public.paperwork_stock_requests (
 firm_id uuid not null,request_key text not null check(length(request_key)>=1 and length(request_key)<=100),request_hash text not null,item_id uuid not null,revision bigint not null,
 journal_id uuid,primary key(firm_id,request_key),foreign key(firm_id,item_id) references public.paperwork_stock_items(firm_id,id),foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id)
);
create index stock_item_history on public.paperwork_stock_movements(firm_id,item_id,sequence);
do $$declare t text;begin foreach t in array array['paperwork_stock_items','paperwork_stock_movements','paperwork_stock_cancellations','paperwork_stock_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy accounting_read on public.%I for select to authenticated using(public.paperwork_accounting_readable(firm_id))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger immutable_stock before update or delete on public.%I for each row execute function public._paperwork_accounting_immutable()',t);
end loop;end $$;
create function public._paperwork_stock_state(f uuid,i uuid) returns table(revision bigint,quantity numeric,value numeric,last_date date) language sql stable set search_path='' as $$
 select 1+(select count(*) from public.paperwork_stock_movements where firm_id=f and item_id=i)+(select count(*) from public.paperwork_stock_cancellations where firm_id=f and item_id=i),
 coalesce(sum(case when m.kind='receipt' then m.quantity else -m.quantity end) filter(where c.movement_id is null),0),
 coalesce(sum(case when m.kind='receipt' then m.value else -m.value end) filter(where c.movement_id is null),0),
 greatest(max(m.posting_date),(select max(posting_date) from public.paperwork_stock_cancellations where firm_id=f and item_id=i))
 from public.paperwork_stock_movements m left join public.paperwork_stock_cancellations c on c.firm_id=m.firm_id and c.movement_id=m.id where m.firm_id=f and m.item_id=i;
$$;
create function public._paperwork_stock_external(f uuid,a uuid) returns boolean language sql stable set search_path='' as $$
 select coalesce(sum(l.debit-l.credit),0)<>0 from public.paperwork_journal_lines l where l.firm_id=f and l.account_id=a and not exists(select 1 from public.paperwork_stock_movements m where m.firm_id=f and m.id=l.journal_id)
 and not exists(select 1 from public.paperwork_stock_cancellations c where c.firm_id=f and c.journal_id=l.journal_id);
$$;
create function public._paperwork_stock_reversal_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.reversal_of is not null and exists(select 1 from public.paperwork_stock_movements m where m.firm_id=new.firm_id and m.id=new.reversal_of and not exists(select 1 from public.paperwork_stock_cancellations c where c.firm_id=m.firm_id and c.movement_id=m.id and c.journal_id=new.id)) then raise exception 'ACTIVE_STOCK_LINK';end if;
 return new;
end $$;
create trigger stock_reversal_guard before insert on public.paperwork_journals for each row execute function public._paperwork_stock_reversal_guard();
create function public.paperwork_stock_command(p_action text,p_data jsonb,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare f uuid:=(p_data->>'firmId')::uuid;i uuid:=(p_data->>'itemId')::uuid;j uuid:=(p_data->>'journalId')::uuid;
 item public.paperwork_stock_items;mov public.paperwork_stock_movements;r public.paperwork_stock_requests;s record;h text;q numeric;v numeric;a uuid;partner uuid;d date;lines jsonb;rev bigint;target uuid;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if p_action not in('create','receipt','issue','cancel') or p_action is null then raise exception 'INVALID_STOCK_ACTION';end if;
 if not public.paperwork_accounting_can(f,case when p_action='create' then 'manage_chart' else 'post_journal' end) or (p_action='cancel' and not public.paperwork_accounting_can(f,'reverse_journal')) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if p_key is null or length(p_key)<1 or length(p_key)>100 or i is null then raise exception 'INVALID_STOCK_REQUEST';end if;
 h:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data)::text,'UTF8')),'hex');
 select * into r from public.paperwork_stock_requests where firm_id=f and request_key=p_key;
 if found then if r.request_hash<>h then raise exception 'IDEMPOTENCY_REUSE';end if;return jsonb_build_object('firmId',f,'itemId',r.item_id,'revision',r.revision::text,'journalId',r.journal_id);end if;
 if p_action='create' then
  if p_data->>'expectedRevision' is distinct from '0' or exists(select 1 from public.paperwork_stock_items where firm_id=f and id=i) then raise exception 'STALE_REVISION';end if;
  a:=(p_data->>'accountId')::uuid;
  if not exists(select 1 from public.paperwork_accounts where firm_id=f and id=a and active and allows_posting and not requires_partner) or public._paperwork_stock_external(f,a) then raise exception 'STOCK_DEDICATED_ACCOUNT_REQUIRED';end if;
  insert into public.paperwork_stock_items values(f,i,trim(p_data->>'sku'),trim(p_data->>'name'),trim(p_data->>'warehouse'),trim(p_data->>'unit'),a,auth.uid(),now());rev:=1;j:=null;
 else
  select * into strict item from public.paperwork_stock_items where firm_id=f and id=i;
  select * into s from public._paperwork_stock_state(f,i);
  if p_data->>'expectedRevision' is distinct from s.revision::text then raise exception 'STALE_REVISION';end if;
  if public._paperwork_stock_external(f,item.account_id) then raise exception 'STOCK_EXTERNAL_MOVEMENTS';end if;
  if jsonb_typeof(p_data->'postingDate') is distinct from 'string' or (p_data->>'postingDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_STOCK_DATE';end if;
  d:=(p_data->>'postingDate')::date;if d<s.last_date then raise exception 'INVALID_STOCK_DATE';end if;
  if not exists(select 1 from public.paperwork_accounting_periods where firm_id=f and id=(p_data->>'periodId')::uuid and fiscal_year_id=(p_data->>'fiscalYearId')::uuid) then raise exception 'INVALID_STOCK_PERIOD';end if;
  rev:=s.revision+1;
  if p_action='cancel' then
   target:=(p_data->>'targetId')::uuid;
   select * into strict mov from public.paperwork_stock_movements m where m.firm_id=f and m.id=target and m.item_id=i and not exists(select 1 from public.paperwork_stock_cancellations c where c.firm_id=f and c.movement_id=m.id);
   if exists(select 1 from public.paperwork_stock_movements m where m.firm_id=f and m.item_id=i and m.sequence>mov.sequence and not exists(select 1 from public.paperwork_stock_cancellations c where c.firm_id=f and c.movement_id=m.id)) then raise exception 'STOCK_REVERSE_LATEST_FIRST';end if;
   if length(trim(coalesce(p_data->>'reason','')))<1 or length(p_data->>'reason')>1000 then raise exception 'INVALID_STOCK_REASON';end if;
   j:=md5(f::text||':'||target::text||':stock:'||md5(p_key))::uuid;
   insert into public.paperwork_stock_cancellations values(f,target,j,i,rev,d,trim(p_data->>'reason'),auth.uid(),now());
   perform public.paperwork_reverse_journal(f,target,(p_data->>'periodId')::uuid,d,p_data->>'reason','1','stock:'||md5(p_key));
  else
   if j is null or jsonb_typeof(p_data->'quantity') is distinct from 'string' or (p_data->>'quantity') !~ '^[1-9][0-9]{0,23}$' then raise exception 'INVALID_STOCK_QUANTITY';end if;q:=(p_data->>'quantity')::numeric;
   if p_action='receipt' then
    if jsonb_typeof(p_data->'value') is distinct from 'string' or (p_data->>'value') !~ '^[1-9][0-9]{0,23}$' then raise exception 'INVALID_STOCK_VALUE';end if;v:=(p_data->>'value')::numeric;
    if s.quantity+q>=1e24 or s.value+v>=1e24 then raise exception 'STOCK_OVERFLOW';end if;
   else
    if q>s.quantity then raise exception 'STOCK_INSUFFICIENT';end if;
    v:=case when q=s.quantity then s.value else div(s.value*q*2+s.quantity,s.quantity*2) end;
    if v<=0 or (q<s.quantity and v>=s.value) then raise exception 'STOCK_PRECISION';end if;
   end if;
   a:=(p_data->>'counterAccountId')::uuid;partner:=(p_data->>'partnerId')::uuid;
   if a=item.account_id or exists(select 1 from public.paperwork_stock_items where firm_id=f and account_id=a) then raise exception 'INVALID_STOCK_COUNTER';end if;
   if jsonb_typeof(p_data->'externalId') is distinct from 'string' or length(trim(coalesce(p_data->>'externalId','')))<1 or length(p_data->>'externalId')>200 then raise exception 'INVALID_STOCK_SOURCE';end if;
   if exists(select 1 from public.paperwork_stock_movements where firm_id=f and external_id=trim(p_data->>'externalId')) then raise exception 'DUPLICATE_SOURCE';end if;
   lines:=jsonb_build_array(jsonb_build_object('id','stock','accountId',item.account_id,'debit',case when p_action='receipt' then v::text else '0' end,'credit',case when p_action='issue' then v::text else '0' end,'description',p_data->>'externalId'),jsonb_build_object('id','counter','accountId',a,'partnerId',partner,'debit',case when p_action='issue' then v::text else '0' end,'credit',case when p_action='receipt' then v::text else '0' end,'description',p_data->>'externalId'));
   perform public.paperwork_post_journal(jsonb_build_object('id',j,'firmId',f,'fiscalYearId',p_data->>'fiscalYearId','periodId',p_data->>'periodId','postingDate',d,'description','Stock '||p_action||': '||item.sku,'lines',lines),'0','stock:'||md5(p_key));
   insert into public.paperwork_stock_movements values(f,j,i,rev,p_action,q,v,s.quantity,s.value,a,partner,trim(p_data->>'externalId'),d,auth.uid(),now());
  end if;
 end if;
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(f,auth.uid(),'stock.'||p_action,i::text,case when p_action='cancel' then trim(p_data->>'reason') else null end);
 insert into public.paperwork_stock_requests values(f,p_key,h,i,rev,j);
 return jsonb_build_object('firmId',f,'itemId',i,'revision',rev::text,'journalId',j);
end $$;
create function public.paperwork_stock_workspace(p_firm uuid) returns jsonb language plpgsql security definer stable set search_path='' set timezone='UTC' as $$
declare result jsonb;begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if (select count(*) from public.paperwork_stock_items where firm_id=p_firm)>1000 or (select count(*) from public.paperwork_stock_movements where firm_id=p_firm)>10000 then raise exception 'STOCK_READ_LIMIT';end if;
 select jsonb_build_object('firmId',p_firm,'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'sku',i.sku,'name',i.name,'warehouse',i.warehouse,'unit',i.unit,'accountId',i.account_id,'revision',s.revision::text,'quantity',s.quantity::text,'value',s.value::text,'externalMovements',public._paperwork_stock_external(p_firm,i.account_id)) order by i.warehouse,i.sku) from public.paperwork_stock_items i cross join lateral public._paperwork_stock_state(p_firm,i.id) s where i.firm_id=p_firm),'[]'::jsonb),
 'movements',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'itemId',m.item_id,'sequence',m.sequence::text,'kind',m.kind,'quantity',m.quantity::text,'value',m.value::text,'previousQuantity',m.previous_quantity::text,'previousValue',m.previous_value::text,'counterAccountId',m.counter_account_id,'partnerId',m.partner_id,'externalId',m.external_id,'postingDate',m.posting_date) order by m.item_id,m.sequence) from public.paperwork_stock_movements m where m.firm_id=p_firm),'[]'::jsonb),
 'cancellations',coalesce((select jsonb_agg(jsonb_build_object('movementId',c.movement_id,'itemId',c.item_id,'journalId',c.journal_id,'sequence',c.sequence::text,'postingDate',c.posting_date,'reason',c.reason) order by c.item_id,c.sequence) from public.paperwork_stock_cancellations c where c.firm_id=p_firm),'[]'::jsonb),
 'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.account_id,'balance',coalesce((select sum(l.debit-l.credit) from public.paperwork_journal_lines l where l.firm_id=p_firm and l.account_id=a.account_id),0)::text)) from (select distinct account_id from public.paperwork_stock_items where firm_id=p_firm) a),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public._paperwork_stock_state(uuid,uuid),public._paperwork_stock_external(uuid,uuid),public._paperwork_stock_reversal_guard() from public,anon,authenticated;
revoke all on function public.paperwork_stock_command(text,jsonb,text),public.paperwork_stock_workspace(uuid) from public,anon;
grant execute on function public.paperwork_stock_command(text,jsonb,text),public.paperwork_stock_workspace(uuid) to authenticated;
commit;
