begin;

-- Accounting is opt-in: no automatic years, accounts, permissions or journal conversion.
create table public.paperwork_accounting_permissions (
  firm_id uuid not null,
  user_id uuid not null,
  capability text not null check (capability in ('manage_chart','post_journal','reverse_journal','manage_periods')),
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (firm_id,user_id,capability),
  foreign key (firm_id,user_id) references public.paperwork_members(firm_id,user_id) on delete cascade
);

create table public.paperwork_fiscal_years (
  firm_id uuid not null references public.paperwork_firms(id) on delete restrict,
  id uuid not null,
  label integer not null check (label between 1900 and 9999),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  next_number bigint not null default 1 check (next_number > 0),
  primary key (firm_id,id), unique (firm_id,label)
);
create table public.paperwork_accounting_periods (
  firm_id uuid not null,
  id uuid not null,
  fiscal_year_id uuid not null,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  status text not null default 'open' check (status in ('open','closed')),
  revision bigint not null default 1,
  primary key (firm_id,id), unique (firm_id,fiscal_year_id,id),
  foreign key (firm_id,fiscal_year_id) references public.paperwork_fiscal_years(firm_id,id)
);
create table public.paperwork_accounts (
  firm_id uuid not null references public.paperwork_firms(id) on delete restrict,
  id uuid not null,
  code text not null check (code ~ '^[A-Za-z0-9._-]{1,20}$'),
  name text not null check (length(trim(name)) between 1 and 200),
  parent_id uuid,
  active boolean not null default true,
  allows_posting boolean not null default true,
  requires_partner boolean not null default false,
  valid_from date not null,
  valid_to date check (valid_to >= valid_from),
  template_version text not null default 'manual-v1',
  primary key (firm_id,id), unique (firm_id,code),
  foreign key (firm_id,parent_id) references public.paperwork_accounts(firm_id,id),
  check (parent_id is distinct from id)
);
-- Separate ledger partners: replacing an old invoice store cannot delete ledger analytics.
create table public.paperwork_accounting_partners (
  firm_id uuid not null references public.paperwork_firms(id) on delete restrict,
  id uuid not null,
  name text not null check (length(trim(name)) between 1 and 200),
  primary key (firm_id,id)
);
create table public.paperwork_journals (
  firm_id uuid not null,
  id uuid not null,
  fiscal_year_id uuid not null,
  period_id uuid not null,
  posting_date date not null,
  description text not null,
  number text not null,
  revision bigint not null default 1,
  posted_by uuid not null references auth.users(id),
  posted_at timestamptz not null default now(),
  reversal_of uuid,
  reason text,
  primary key (firm_id,id), unique (firm_id,fiscal_year_id,number), unique (firm_id,reversal_of),
  foreign key (firm_id,fiscal_year_id,period_id) references public.paperwork_accounting_periods(firm_id,fiscal_year_id,id),
  foreign key (firm_id,reversal_of) references public.paperwork_journals(firm_id,id),
  check ((reversal_of is null and reason is null) or (reversal_of is not null and length(trim(reason)) between 1 and 1000))
);
create table public.paperwork_journal_lines (
  firm_id uuid not null,
  journal_id uuid not null,
  id text not null check (length(id) between 1 and 100),
  account_id uuid not null,
  partner_id uuid,
  debit numeric(24,0) not null check (debit >= 0),
  credit numeric(24,0) not null check (credit >= 0),
  description text not null,
  account_code text not null,
  account_name text not null,
  primary key (firm_id,journal_id,id),
  foreign key (firm_id,journal_id) references public.paperwork_journals(firm_id,id),
  foreign key (firm_id,account_id) references public.paperwork_accounts(firm_id,id),
  foreign key (firm_id,partner_id) references public.paperwork_accounting_partners(firm_id,id),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);
create table public.paperwork_accounting_requests (
  firm_id uuid not null,
  request_key text not null check (length(request_key) between 1 and 100),
  request_hash text not null,
  journal_id uuid not null,
  primary key (firm_id,request_key),
  foreign key (firm_id,journal_id) references public.paperwork_journals(firm_id,id)
);
create table public.paperwork_accounting_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.paperwork_firms(id) on delete restrict,
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_id text not null,
  reason text,
  occurred_at timestamptz not null default now()
);

create function public.paperwork_accounting_can(p_firm uuid,p_capability text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_capability in ('manage_chart','post_journal','reverse_journal','manage_periods') and exists(select 1 from public.paperwork_members m where m.firm_id=p_firm and m.user_id=auth.uid()
    and (m.role='owner' or (m.role='accountant' and exists(select 1 from public.paperwork_accounting_permissions p
      where p.firm_id=m.firm_id and p.user_id=m.user_id and p.capability=p_capability))))
$$;

do $$ declare t text; begin
  foreach t in array array['paperwork_accounting_permissions','paperwork_fiscal_years','paperwork_accounting_periods','paperwork_accounts','paperwork_accounting_partners','paperwork_journals','paperwork_journal_lines','paperwork_accounting_requests','paperwork_accounting_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy accounting_read on public.%I for select to authenticated using (public.paperwork_role(firm_id) is not null)',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;

create function public._paperwork_accounting_immutable() returns trigger
language plpgsql set search_path = '' as $$ begin raise exception 'ACCOUNTING_IMMUTABLE'; end $$;
create trigger immutable_journals before update or delete on public.paperwork_journals for each row execute function public._paperwork_accounting_immutable();
create trigger immutable_lines before update or delete on public.paperwork_journal_lines for each row execute function public._paperwork_accounting_immutable();
create trigger immutable_requests before update or delete on public.paperwork_accounting_requests for each row execute function public._paperwork_accounting_immutable();
create trigger immutable_events before update or delete on public.paperwork_accounting_events for each row execute function public._paperwork_accounting_immutable();

-- A malformed transaction cannot commit even if an internal caller omits a line.
create function public._paperwork_journal_balanced() returns trigger
language plpgsql set search_path = '' as $$
declare j uuid; n bigint; d numeric; c numeric;
begin
  if tg_table_name='paperwork_journals' then j:=new.id; else j:=new.journal_id; end if;
  select count(*),coalesce(sum(debit),0),coalesce(sum(credit),0) into n,d,c from public.paperwork_journal_lines where firm_id=new.firm_id and journal_id=j;
  if n<2 or d<>c then raise exception 'INVALID_JOURNAL_BALANCE'; end if;
  return null;
end $$;
create constraint trigger balanced_header after insert on public.paperwork_journals deferrable initially deferred for each row execute function public._paperwork_journal_balanced();
create constraint trigger balanced_lines after insert on public.paperwork_journal_lines deferrable initially deferred for each row execute function public._paperwork_journal_balanced();

create function public.paperwork_set_accounting_permission(p_firm uuid,p_user uuid,p_capability text,p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.paperwork_firms where id=p_firm for update;
  if public.paperwork_role(p_firm) is distinct from 'owner' then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
  if p_capability not in ('manage_chart','post_journal','reverse_journal','manage_periods') or p_capability is null then raise exception 'INVALID_CAPABILITY'; end if;
  if p_enabled is null then raise exception 'INVALID_CAPABILITY'; end if;
  if not exists(select 1 from public.paperwork_members where firm_id=p_firm and user_id=p_user and role='accountant') then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
  if p_enabled then
    insert into public.paperwork_accounting_permissions(firm_id,user_id,capability,granted_by) values(p_firm,p_user,p_capability,auth.uid()) on conflict do nothing;
  else delete from public.paperwork_accounting_permissions where firm_id=p_firm and user_id=p_user and capability=p_capability;
  end if;
  insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(p_firm,auth.uid(),'permission.changed',p_user::text,p_capability||':'||p_enabled::text);
end $$;

create function public.paperwork_create_accounting_entity(p_firm uuid,p_kind text,p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := (p_data->>'id')::uuid; y public.paperwork_fiscal_years; a date; b date;
begin
  perform 1 from public.paperwork_firms where id=p_firm for update;
  if not public.paperwork_accounting_can(p_firm,case when p_kind in ('year','period') then 'manage_periods' else 'manage_chart' end) then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
  if p_kind='year' then
    a:=(p_data->>'startsOn')::date; b:=(p_data->>'endsOn')::date;
    if exists(select 1 from public.paperwork_fiscal_years where firm_id=p_firm and starts_on<=b and ends_on>=a) then raise exception 'OVERLAPPING_YEAR'; end if;
    insert into public.paperwork_fiscal_years(firm_id,id,label,starts_on,ends_on) values(p_firm,v_id,(p_data->>'label')::integer,a,b);
  elsif p_kind='period' then
    select * into strict y from public.paperwork_fiscal_years where firm_id=p_firm and id=(p_data->>'fiscalYearId')::uuid;
    a:=(p_data->>'startsOn')::date; b:=(p_data->>'endsOn')::date;
    if a<y.starts_on or b>y.ends_on then raise exception 'INVALID_PERIOD'; end if;
    if exists(select 1 from public.paperwork_accounting_periods where firm_id=p_firm and starts_on<=b and ends_on>=a) then raise exception 'OVERLAPPING_PERIOD'; end if;
    insert into public.paperwork_accounting_periods(firm_id,id,fiscal_year_id,starts_on,ends_on) values(p_firm,v_id,y.id,a,b);
  elsif p_kind='account' then
    if p_data->>'parentId' is not null and not exists(select 1 from public.paperwork_accounts where firm_id=p_firm and id=(p_data->>'parentId')::uuid and not allows_posting) then raise exception 'INVALID_PARENT_ACCOUNT'; end if;
    insert into public.paperwork_accounts(firm_id,id,code,name,parent_id,active,allows_posting,requires_partner,valid_from,valid_to,template_version)
      values(p_firm,v_id,p_data->>'code',p_data->>'name',(p_data->>'parentId')::uuid,coalesce((p_data->>'active')::boolean,true),coalesce((p_data->>'allowsPosting')::boolean,true),coalesce((p_data->>'requiresPartner')::boolean,false),(p_data->>'validFrom')::date,(p_data->>'validTo')::date,coalesce(p_data->>'templateVersion','manual-v1'));
  elsif p_kind='partner' then
    insert into public.paperwork_accounting_partners(firm_id,id,name) values(p_firm,v_id,p_data->>'name');
  else raise exception 'INVALID_ENTITY_KIND'; end if;
  insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id) values(p_firm,auth.uid(),p_kind||'.created',v_id::text);
  return v_id;
end $$;

create function public._paperwork_journal_receipt(p_firm uuid,p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('journalId',id::text,'firmId',firm_id::text,'revision',revision::text,'number',number,'postedAt',posted_at,'postedBy',posted_by::text)
  from public.paperwork_journals where firm_id=p_firm and id=p_id
$$;

create function public._paperwork_post_journal(p_draft jsonb,p_expected text,p_key text,p_reverse uuid default null,p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare f uuid := (p_draft->>'firmId')::uuid; j uuid := (p_draft->>'id')::uuid; y public.paperwork_fiscal_years;
  p public.paperwork_accounting_periods; acc public.paperwork_accounts; r public.paperwork_accounting_requests;
  dt date := (p_draft->>'postingDate')::date; item jsonb; d numeric; c numeric; total_d numeric:=0; total_c numeric:=0;
  hash text; count_lines integer:=0; no text;
begin
  -- One lock order for posting, numbering, permissions and period changes.
  perform 1 from public.paperwork_firms where id=f for update;
  if not public.paperwork_accounting_can(f,'post_journal') then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
  if p_reverse is not null and not public.paperwork_accounting_can(f,'reverse_journal') then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
  if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  hash:=encode(sha256(convert_to(jsonb_build_object('draft',p_draft,'expected',p_expected,'reverse',p_reverse,'reason',p_reason)::text,'UTF8')),'hex');
  select * into r from public.paperwork_accounting_requests where firm_id=f and request_key=p_key;
  if found then
    if r.request_hash<>hash then raise exception 'IDEMPOTENCY_REUSE'; end if;
    return public._paperwork_journal_receipt(f,r.journal_id);
  end if;
  if p_expected is distinct from '0' then raise exception 'STALE_REVISION'; end if;
  if exists(select 1 from public.paperwork_journals where firm_id=f and id=j) then raise exception 'STALE_REVISION'; end if;
  select * into strict p from public.paperwork_accounting_periods where firm_id=f and id=(p_draft->>'periodId')::uuid for update;
  select * into strict y from public.paperwork_fiscal_years where firm_id=f and id=(p_draft->>'fiscalYearId')::uuid for update;
  if p.fiscal_year_id<>y.id or dt<p.starts_on or dt>p.ends_on or dt is null then raise exception 'INVALID_PERIOD'; end if;
  if p.status<>'open' then raise exception 'CLOSED_PERIOD'; end if;
  if jsonb_typeof(p_draft->'lines') is distinct from 'array' then raise exception 'INVALID_JOURNAL'; end if;
  no:=y.label::text||'/'||lpad(y.next_number::text,greatest(6,length(y.next_number::text)),'0');
  insert into public.paperwork_journals(firm_id,id,fiscal_year_id,period_id,posting_date,description,number,posted_by,reversal_of,reason)
    values(f,j,y.id,p.id,dt,coalesce(p_draft->>'description',''),no,auth.uid(),p_reverse,p_reason);
  for item in select value from jsonb_array_elements(p_draft->'lines') loop
    if jsonb_typeof(item->'debit') is distinct from 'string' or jsonb_typeof(item->'credit') is distinct from 'string'
      or (item->>'debit') !~ '^(0|[1-9][0-9]{0,23})$' or (item->>'credit') !~ '^(0|[1-9][0-9]{0,23})$' then raise exception 'INVALID_AMOUNT'; end if;
    d:=(item->>'debit')::numeric; c:=(item->>'credit')::numeric;
    select * into strict acc from public.paperwork_accounts where firm_id=f and id=(item->>'accountId')::uuid;
    -- An authorized full reversal preserves historical accounts, including expired ones.
    if p_reverse is null and (not acc.active or not acc.allows_posting or dt<acc.valid_from or dt>acc.valid_to) then raise exception 'INVALID_ACCOUNT'; end if;
    if acc.requires_partner and nullif(item->>'partnerId','') is null then raise exception 'INVALID_PARTNER'; end if;
    insert into public.paperwork_journal_lines(firm_id,journal_id,id,account_id,partner_id,debit,credit,description,account_code,account_name)
      values(f,j,item->>'id',acc.id,nullif(item->>'partnerId','')::uuid,d,c,coalesce(item->>'description',''),acc.code,acc.name);
    total_d:=total_d+d; total_c:=total_c+c; count_lines:=count_lines+1;
  end loop;
  if count_lines<2 or total_d<>total_c then raise exception 'INVALID_JOURNAL_BALANCE'; end if;
  update public.paperwork_fiscal_years set next_number=next_number+1 where firm_id=f and id=y.id;
  insert into public.paperwork_accounting_requests(firm_id,request_key,request_hash,journal_id) values(f,p_key,hash,j);
  insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(f,auth.uid(),case when p_reverse is null then 'journal.posted' else 'journal.reversed' end,j::text,p_reason);
  return public._paperwork_journal_receipt(f,j);
end $$;

create function public.paperwork_post_journal(p_draft jsonb,p_expected text,p_key text) returns jsonb
language sql security definer set search_path = '' as $$ select public._paperwork_post_journal(p_draft,p_expected,p_key) $$;

-- Numeric columns become exact strings at the API boundary, never JSON floats.
create function public.paperwork_read_journal(p_firm uuid,p_journal uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare header public.paperwork_journals; lines jsonb;
begin
  if public.paperwork_role(p_firm) is null then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
  select * into header from public.paperwork_journals where firm_id=p_firm and id=p_journal;
  if not found then return null; end if;
  select jsonb_agg(jsonb_build_object('id',id,'accountId',account_id::text,'partnerId',partner_id::text,'debit',debit::text,'credit',credit::text,'description',description) order by id)
    into lines from public.paperwork_journal_lines where firm_id=p_firm and journal_id=p_journal;
  return jsonb_build_object('receipt',public._paperwork_journal_receipt(p_firm,p_journal),'draft',jsonb_build_object('id',header.id::text,'firmId',p_firm::text,'fiscalYearId',header.fiscal_year_id::text,'periodId',header.period_id::text,'postingDate',header.posting_date::text,'description',header.description,'lines',lines),'reversalOf',header.reversal_of::text,'reason',header.reason);
end $$;

-- Initial reversal policy: opposite sides, positive amounts, full reversal only.
create function public.paperwork_reverse_journal(p_firm uuid,p_journal uuid,p_period uuid,p_date date,p_reason text,p_expected text,p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare original public.paperwork_journals; period public.paperwork_accounting_periods; draft jsonb; lines jsonb;
begin
  perform 1 from public.paperwork_firms where id=p_firm for update;
  if not public.paperwork_accounting_can(p_firm,'reverse_journal') then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
  select * into strict original from public.paperwork_journals where firm_id=p_firm and id=p_journal;
  if p_expected is distinct from original.revision::text then raise exception 'STALE_REVISION'; end if;
  if original.reversal_of is not null then raise exception 'INVALID_REVERSAL'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'INVALID_REASON'; end if;
  select * into strict period from public.paperwork_accounting_periods where firm_id=p_firm and id=p_period;
  select jsonb_agg(jsonb_build_object('id',id,'accountId',account_id::text,'partnerId',partner_id::text,'debit',credit::text,'credit',debit::text,'description',description) order by id)
    into lines from public.paperwork_journal_lines where firm_id=p_firm and journal_id=p_journal;
  draft:=jsonb_build_object('id',md5(p_firm::text||':'||p_journal::text||':'||p_key)::uuid::text,'firmId',p_firm::text,'fiscalYearId',period.fiscal_year_id::text,'periodId',p_period::text,'postingDate',p_date::text,'description','Reversal: '||original.number,'lines',lines);
  return public._paperwork_post_journal(draft,'0',p_key,p_journal,trim(p_reason));
end $$;

create function public.paperwork_set_period_status(p_firm uuid,p_period uuid,p_status text,p_expected text,p_reason text) returns text
language plpgsql security definer set search_path = '' as $$
declare p public.paperwork_accounting_periods;
begin
  perform 1 from public.paperwork_firms where id=p_firm for update;
  if not public.paperwork_accounting_can(p_firm,'manage_periods') then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
  if p_status is null or p_status not in ('open','closed') or p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'INVALID_REASON'; end if;
  select * into strict p from public.paperwork_accounting_periods where firm_id=p_firm and id=p_period for update;
  if p_expected is distinct from p.revision::text then raise exception 'STALE_REVISION'; end if;
  if p.status=p_status then return p.revision::text; end if;
  update public.paperwork_accounting_periods set status=p_status,revision=revision+1 where firm_id=p_firm and id=p_period;
  insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(p_firm,auth.uid(),'period.'||p_status,p_period::text,trim(p_reason));
  return (p.revision+1)::text;
end $$;

revoke all on function public._paperwork_accounting_immutable(), public._paperwork_journal_balanced(), public._paperwork_journal_receipt(uuid,uuid), public._paperwork_post_journal(jsonb,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.paperwork_accounting_can(uuid,text),public.paperwork_set_accounting_permission(uuid,uuid,text,boolean),public.paperwork_create_accounting_entity(uuid,text,jsonb),public.paperwork_post_journal(jsonb,text,text),public.paperwork_read_journal(uuid,uuid),public.paperwork_reverse_journal(uuid,uuid,uuid,date,text,text,text),public.paperwork_set_period_status(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.paperwork_accounting_can(uuid,text),public.paperwork_set_accounting_permission(uuid,uuid,text,boolean),public.paperwork_create_accounting_entity(uuid,text,jsonb),public.paperwork_post_journal(jsonb,text,text),public.paperwork_read_journal(uuid,uuid),public.paperwork_reverse_journal(uuid,uuid,uuid,date,text,text,text),public.paperwork_set_period_status(uuid,uuid,text,text,text) to authenticated;

commit;
