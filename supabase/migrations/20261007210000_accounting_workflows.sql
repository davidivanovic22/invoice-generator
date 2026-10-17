begin;

-- Agency administration is separate from a firm's financial permissions.
create table public.paperwork_agencies (
 id uuid primary key, name text not null check(length(trim(name)) between 1 and 200),
 owner_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.paperwork_agency_members (
 agency_id uuid references public.paperwork_agencies(id), user_id uuid references auth.users(id),
 primary key(agency_id,user_id)
);
create table public.paperwork_agency_consents (
 firm_id uuid references public.paperwork_firms(id), agency_id uuid references public.paperwork_agencies(id),
 capability text check(capability in ('read','manage_chart','post_journal','reverse_journal','manage_periods')),
 granted_by uuid not null references auth.users(id), primary key(firm_id,agency_id,capability)
);
create table public.paperwork_agency_assignments (
 firm_id uuid not null, agency_id uuid not null, user_id uuid not null, capability text not null,
 assigned_by uuid not null references auth.users(id), primary key(firm_id,agency_id,user_id,capability),
 foreign key(firm_id,agency_id,capability) references public.paperwork_agency_consents on delete cascade,
 foreign key(agency_id,user_id) references public.paperwork_agency_members on delete cascade
);
create table public.paperwork_agency_events (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.paperwork_agencies(id),
 actor_id uuid not null references auth.users(id), action text not null, target_id uuid not null, occurred_at timestamptz not null default now()
);
create trigger immutable_agency_events before update or delete on public.paperwork_agency_events for each row execute function public._paperwork_accounting_immutable();

create function public.paperwork_agency_member(p_agency uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.paperwork_agency_members where agency_id=p_agency and user_id=auth.uid())
$$;
create function public.paperwork_accounting_readable(p_firm uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.paperwork_role(p_firm) is not null or exists(select 1 from public.paperwork_agency_assignments
 where firm_id=p_firm and user_id=auth.uid() and capability='read')
$$;
create or replace function public.paperwork_accounting_can(p_firm uuid,p_capability text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_capability in ('manage_chart','post_journal','reverse_journal','manage_periods') and
 (exists(select 1 from public.paperwork_members m where m.firm_id=p_firm and m.user_id=auth.uid()
 and (m.role='owner' or (m.role='accountant' and exists(select 1 from public.paperwork_accounting_permissions p
 where p.firm_id=m.firm_id and p.user_id=m.user_id and p.capability=p_capability))))
 or (public.paperwork_accounting_readable(p_firm) and exists(select 1 from public.paperwork_agency_assignments
 where firm_id=p_firm and user_id=auth.uid() and capability=p_capability)))
$$;

create function public.paperwork_create_agency(p_id uuid,p_name text) returns uuid
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 insert into public.paperwork_agencies(id,name,owner_id) values(p_id,p_name,auth.uid());
 insert into public.paperwork_agency_members values(p_id,auth.uid());
 insert into public.paperwork_agency_events(agency_id,actor_id,action,target_id) values(p_id,auth.uid(),'agency.created',p_id);
 return p_id;
end $$;
create function public.paperwork_set_agency_member(p_agency uuid,p_user uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$ declare a public.paperwork_agencies; begin
 select * into strict a from public.paperwork_agencies where id=p_agency for update;
 if a.owner_id is distinct from auth.uid() then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 if p_enabled is null or (p_user=a.owner_id and not p_enabled) then raise exception 'INVALID_AGENCY_MEMBER'; end if;
 if p_enabled then insert into public.paperwork_agency_members values(p_agency,p_user) on conflict do nothing;
 else delete from public.paperwork_agency_members where agency_id=p_agency and user_id=p_user; end if;
 insert into public.paperwork_agency_events(agency_id,actor_id,action,target_id) values(p_agency,auth.uid(),case when p_enabled then 'member.added' else 'member.removed' end,p_user);
end $$;
create function public.paperwork_set_agency_consent(p_firm uuid,p_agency uuid,p_capability text,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform 1 from public.paperwork_firms where id=p_firm for update;
 if public.paperwork_role(p_firm) is distinct from 'owner' then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 perform 1 from public.paperwork_agencies where id=p_agency for update;
 if p_enabled is null or p_capability is null or p_capability not in ('read','manage_chart','post_journal','reverse_journal','manage_periods') then raise exception 'INVALID_CAPABILITY'; end if;
 if p_enabled then insert into public.paperwork_agency_consents values(p_firm,p_agency,p_capability,auth.uid()) on conflict do nothing;
 else delete from public.paperwork_agency_consents where firm_id=p_firm and agency_id=p_agency and capability=p_capability; end if;
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(p_firm,auth.uid(),'agency.consent',p_agency::text,p_capability||':'||p_enabled::text);
end $$;
create function public.paperwork_set_agency_assignment(p_firm uuid,p_agency uuid,p_user uuid,p_capability text,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$ declare a public.paperwork_agencies; begin
 perform 1 from public.paperwork_firms where id=p_firm for update;
 select * into strict a from public.paperwork_agencies where id=p_agency for update;
 if a.owner_id is distinct from auth.uid() and public.paperwork_role(p_firm) is distinct from 'owner' then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 if p_enabled is null or p_capability is null or p_capability not in ('read','manage_chart','post_journal','reverse_journal','manage_periods') then raise exception 'INVALID_CAPABILITY'; end if;
 if p_enabled then insert into public.paperwork_agency_assignments values(p_firm,p_agency,p_user,p_capability,auth.uid()) on conflict do nothing;
 else delete from public.paperwork_agency_assignments where firm_id=p_firm and agency_id=p_agency and user_id=p_user and capability=p_capability; end if;
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(p_firm,auth.uid(),'agency.assignment',p_user::text,p_agency::text||':'||p_capability||':'||p_enabled::text);
end $$;

-- Drafts can be unbalanced. Only the existing posting transaction confirms them.
create table public.paperwork_journal_drafts (
 firm_id uuid not null, id uuid not null, fiscal_year_id uuid not null, period_id uuid not null,
 posting_date date not null, description text not null, revision bigint not null check(revision>0),
 status text not null default 'draft' check(status in ('draft','posted')),
 saved_by uuid not null references auth.users(id), saved_at timestamptz not null default now(),
 primary key(firm_id,id), foreign key(firm_id,fiscal_year_id,period_id) references public.paperwork_accounting_periods(firm_id,fiscal_year_id,id)
);
create table public.paperwork_journal_draft_lines (
 firm_id uuid not null, draft_id uuid not null, id text not null check(length(id) between 1 and 100), position integer not null,
 account_id uuid not null, partner_id uuid, debit numeric(24,0) not null check(debit>=0), credit numeric(24,0) not null check(credit>=0), description text not null,
 primary key(firm_id,draft_id,id), unique(firm_id,draft_id,position),
 foreign key(firm_id,draft_id) references public.paperwork_journal_drafts(firm_id,id),
 foreign key(firm_id,account_id) references public.paperwork_accounts(firm_id,id),
 foreign key(firm_id,partner_id) references public.paperwork_accounting_partners(firm_id,id)
);
create table public.paperwork_draft_requests (
 firm_id uuid not null, request_key text not null check(length(request_key) between 1 and 100), request_hash text not null,
 draft_id uuid not null, revision bigint not null, saved_by uuid not null references auth.users(id), saved_at timestamptz not null default now(),
 primary key(firm_id,request_key), foreign key(firm_id,draft_id) references public.paperwork_journal_drafts(firm_id,id)
);
create trigger immutable_draft_requests before update or delete on public.paperwork_draft_requests for each row execute function public._paperwork_accounting_immutable();

create function public._paperwork_guard_posted_draft() returns trigger
language plpgsql set search_path='' as $$ begin
 if tg_table_name='paperwork_journal_drafts' then
 if old.status='posted' then raise exception 'ACCOUNTING_IMMUTABLE'; end if;
 else
 if exists(select 1 from public.paperwork_journal_drafts where firm_id=old.firm_id and id=old.draft_id and status='posted') then raise exception 'ACCOUNTING_IMMUTABLE'; end if;
 end if;
 return old;
end $$;
create trigger immutable_posted_draft before update or delete on public.paperwork_journal_drafts for each row when (old.status='posted') execute function public._paperwork_guard_posted_draft();
create trigger immutable_posted_draft_lines before update or delete on public.paperwork_journal_draft_lines for each row execute function public._paperwork_guard_posted_draft();

create function public._paperwork_draft_payload(p_firm uuid,p_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',d.id,'firmId',d.firm_id,'fiscalYearId',d.fiscal_year_id,'periodId',d.period_id,'postingDate',d.posting_date::text,'description',d.description,
 'lines',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'accountId',account_id,'partnerId',partner_id,'debit',debit::text,'credit',credit::text,'description',description)) order by position)
 from public.paperwork_journal_draft_lines where firm_id=d.firm_id and draft_id=d.id),'[]'::jsonb)) from public.paperwork_journal_drafts d where firm_id=p_firm and id=p_id
$$;
create function public.paperwork_read_journal_draft(p_firm uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare d public.paperwork_journal_drafts; begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 select * into d from public.paperwork_journal_drafts where firm_id=p_firm and id=p_id;
 if not found then return null; end if;
 return jsonb_build_object('draft',public._paperwork_draft_payload(p_firm,p_id),'revision',d.revision::text,'status',d.status,'savedBy',d.saved_by,'savedAt',d.saved_at);
end $$;
create function public.paperwork_save_journal_draft(p_draft jsonb,p_expected text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_draft->>'firmId')::uuid; j uuid:=(p_draft->>'id')::uuid; d public.paperwork_journal_drafts; p public.paperwork_accounting_periods;
 r public.paperwork_draft_requests; hash text; item jsonb; pos integer:=0; rev bigint;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
 hash:=encode(sha256(convert_to(jsonb_build_object('draft',p_draft,'expected',p_expected)::text,'UTF8')),'hex');
 select * into r from public.paperwork_draft_requests where firm_id=f and request_key=p_key;
 if found then
 if r.request_hash<>hash then raise exception 'IDEMPOTENCY_REUSE'; end if;
 return jsonb_build_object('firmId',f,'draftId',r.draft_id,'revision',r.revision::text,'savedBy',r.saved_by,'savedAt',r.saved_at);
 end if;
 select * into d from public.paperwork_journal_drafts where firm_id=f and id=j for update;
 if p_expected is distinct from coalesce(d.revision::text,'0') or d.status='posted' or exists(select 1 from public.paperwork_journals where firm_id=f and id=j) then raise exception 'STALE_REVISION'; end if;
 if d.id is not null and exists(select 1 from public.paperwork_accounting_periods where firm_id=f and id=d.period_id and status='closed') then raise exception 'CLOSED_PERIOD'; end if;
 select * into strict p from public.paperwork_accounting_periods where firm_id=f and id=(p_draft->>'periodId')::uuid for update;
 if p.status<>'open' then raise exception 'CLOSED_PERIOD'; end if;
 if p.fiscal_year_id is distinct from (p_draft->>'fiscalYearId')::uuid or (p_draft->>'postingDate')::date not between p.starts_on and p.ends_on then raise exception 'INVALID_PERIOD'; end if;
 if jsonb_typeof(p_draft->'lines') is distinct from 'array' or jsonb_array_length(p_draft->'lines')>1000 then raise exception 'INVALID_JOURNAL'; end if;
 rev:=coalesce(d.revision,0)+1;
 insert into public.paperwork_journal_drafts(firm_id,id,fiscal_year_id,period_id,posting_date,description,revision,saved_by)
 values(f,j,p.fiscal_year_id,p.id,(p_draft->>'postingDate')::date,p_draft->>'description',rev,auth.uid())
 on conflict(firm_id,id) do update set fiscal_year_id=excluded.fiscal_year_id,period_id=excluded.period_id,posting_date=excluded.posting_date,description=excluded.description,revision=excluded.revision,saved_by=excluded.saved_by,saved_at=now();
 delete from public.paperwork_journal_draft_lines where firm_id=f and draft_id=j;
 for item in select value from jsonb_array_elements(p_draft->'lines') loop
 if jsonb_typeof(item->'debit') is distinct from 'string' or jsonb_typeof(item->'credit') is distinct from 'string'
 or (item->>'debit') !~ '^(0|[1-9][0-9]{0,23})$' or (item->>'credit') !~ '^(0|[1-9][0-9]{0,23})$' then raise exception 'INVALID_AMOUNT'; end if;
 insert into public.paperwork_journal_draft_lines values(f,j,item->>'id',pos,(item->>'accountId')::uuid,(item->>'partnerId')::uuid,(item->>'debit')::numeric,(item->>'credit')::numeric,item->>'description');
 pos:=pos+1;
 end loop;
 insert into public.paperwork_draft_requests values(f,p_key,hash,j,rev,auth.uid(),now()) returning * into r;
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id) values(f,auth.uid(),'draft.saved',j::text);
 return jsonb_build_object('firmId',f,'draftId',j,'revision',rev::text,'savedBy',r.saved_by,'savedAt',r.saved_at);
end $$;
create or replace function public.paperwork_post_journal(p_draft jsonb,p_expected text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare d public.paperwork_journal_drafts; receipt jsonb; f uuid:=(p_draft->>'firmId')::uuid; begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 select * into d from public.paperwork_journal_drafts where firm_id=f and id=(p_draft->>'id')::uuid for update;
 if found then
 if p_expected is distinct from d.revision::text or p_draft is distinct from public._paperwork_draft_payload(f,d.id) then raise exception 'STALE_REVISION'; end if;
 receipt:=public._paperwork_post_journal(p_draft,'0',p_key);
 update public.paperwork_journal_drafts set status='posted' where firm_id=f and id=d.id and status='draft';
 return receipt;
 end if;
 return public._paperwork_post_journal(p_draft,p_expected,p_key);
end $$;

create or replace function public.paperwork_read_journal(p_firm uuid,p_journal uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare header public.paperwork_journals; lines jsonb;
begin
  if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
  select * into header from public.paperwork_journals where firm_id=p_firm and id=p_journal;
  if not found then return null; end if;
  select jsonb_agg(jsonb_build_object('id',id,'accountId',account_id::text,'partnerId',partner_id::text,'debit',debit::text,'credit',credit::text,'description',description) order by id)
    into lines from public.paperwork_journal_lines where firm_id=p_firm and journal_id=p_journal;
  return jsonb_build_object('receipt',public._paperwork_journal_receipt(p_firm,p_journal),'draft',jsonb_build_object('id',header.id::text,'firmId',p_firm::text,'fiscalYearId',header.fiscal_year_id::text,'periodId',header.period_id::text,'postingDate',header.posting_date::text,'description',header.description,'lines',lines),'reversalOf',header.reversal_of::text,'reason',header.reason);
end $$;


-- Extend only accounting reads; legacy document membership remains unchanged.
do $$ declare t text; begin
 foreach t in array array['paperwork_accounting_permissions','paperwork_fiscal_years','paperwork_accounting_periods','paperwork_accounts','paperwork_accounting_partners','paperwork_journals','paperwork_journal_lines','paperwork_accounting_requests','paperwork_accounting_events'] loop
 execute format('drop policy accounting_read on public.%I',t);
 execute format('create policy accounting_read on public.%I for select to authenticated using (public.paperwork_accounting_readable(firm_id))',t);
 end loop;
 foreach t in array array['paperwork_journal_drafts','paperwork_journal_draft_lines','paperwork_draft_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy accounting_read on public.%I for select to authenticated using (public.paperwork_accounting_readable(firm_id))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t); execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['paperwork_agencies','paperwork_agency_members','paperwork_agency_consents','paperwork_agency_assignments','paperwork_agency_events'] loop
 execute format('alter table public.%I enable row level security',t);
 if t='paperwork_agencies' then execute format('create policy agency_read on public.%I for select to authenticated using (public.paperwork_agency_member(id))',t);
 elsif t in ('paperwork_agency_consents','paperwork_agency_assignments') then execute format('create policy agency_read on public.%I for select to authenticated using (public.paperwork_agency_member(agency_id) or public.paperwork_role(firm_id)=''owner'')',t);
 else execute format('create policy agency_read on public.%I for select to authenticated using (public.paperwork_agency_member(agency_id))',t); end if;
 execute format('revoke all on public.%I from public,anon,authenticated',t); execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;

revoke all on function public._paperwork_draft_payload(uuid,uuid) from public,anon,authenticated;
revoke all on function public._paperwork_guard_posted_draft() from public,anon,authenticated;
revoke all on function public.paperwork_agency_member(uuid),public.paperwork_accounting_readable(uuid),public.paperwork_create_agency(uuid,text),public.paperwork_set_agency_member(uuid,uuid,boolean),public.paperwork_set_agency_consent(uuid,uuid,text,boolean),public.paperwork_set_agency_assignment(uuid,uuid,uuid,text,boolean),public.paperwork_save_journal_draft(jsonb,text,text),public.paperwork_read_journal_draft(uuid,uuid) from public,anon;
grant execute on function public.paperwork_agency_member(uuid),public.paperwork_accounting_readable(uuid),public.paperwork_create_agency(uuid,text),public.paperwork_set_agency_member(uuid,uuid,boolean),public.paperwork_set_agency_consent(uuid,uuid,text,boolean),public.paperwork_set_agency_assignment(uuid,uuid,uuid,text,boolean),public.paperwork_save_journal_draft(jsonb,text,text),public.paperwork_read_journal_draft(uuid,uuid) to authenticated;
commit;
