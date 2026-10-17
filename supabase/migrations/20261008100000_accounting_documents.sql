begin;
create table public.paperwork_business_documents (
 firm_id uuid not null references public.paperwork_firms(id), id uuid not null, partner_id uuid not null,
 direction text not null check(direction in ('incoming','outgoing')), kind text not null check(kind in ('invoice','advance','credit_note')),
 reference_id uuid, number text not null check(length(trim(number)) between 1 and 100),
 document_date date not null, due_date date not null, description text not null, currency text not null default 'RSD' check(currency='RSD'),
 revision bigint not null check(revision>0), lifecycle text not null default 'draft' check(lifecycle in ('draft','issued')),
 partner_name text not null, saved_by uuid not null references auth.users(id), saved_at timestamptz not null default now(),
 issued_by uuid references auth.users(id), issued_at timestamptz,
 primary key(firm_id,id), unique(firm_id,direction,partner_id,number),
 foreign key(firm_id,partner_id) references public.paperwork_accounting_partners(firm_id,id),
 foreign key(firm_id,reference_id) references public.paperwork_business_documents(firm_id,id),
 check(due_date>=document_date), check((kind='credit_note')=(reference_id is not null)), check(reference_id is distinct from id),
 check((lifecycle='draft' and issued_at is null and issued_by is null) or (lifecycle='issued' and issued_at is not null and issued_by is not null))
);
create table public.paperwork_business_document_lines (
 firm_id uuid not null, document_id uuid not null, id text not null check(length(id) between 1 and 100), position integer not null,
 description text not null check(length(trim(description)) between 1 and 500),
 net numeric(24,0) not null check(net>=0), tax numeric(24,0) not null check(tax>=0),
 primary key(firm_id,document_id,id), unique(firm_id,document_id,position),
 foreign key(firm_id,document_id) references public.paperwork_business_documents(firm_id,id)
);
create unique index paperwork_outgoing_document_number on public.paperwork_business_documents(firm_id,number) where direction='outgoing';
create table public.paperwork_business_document_workflow (
 firm_id uuid not null, document_id uuid not null, revision bigint not null default 1 check(revision>0),
 approval text not null default 'pending' check(approval in ('pending','approved','rejected')),
 delivery text not null default 'not_recorded' check(delivery in ('not_recorded','sent')),
 primary key(firm_id,document_id), foreign key(firm_id,document_id) references public.paperwork_business_documents(firm_id,id)
);
create table public.paperwork_document_journals (
 firm_id uuid not null, document_id uuid not null, journal_id uuid not null,
 primary key(firm_id,document_id), unique(firm_id,journal_id),
 foreign key(firm_id,document_id) references public.paperwork_business_documents(firm_id,id),
 foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id)
);
create trigger immutable_document_journals before update or delete on public.paperwork_document_journals for each row execute function public._paperwork_accounting_immutable();
create table public.paperwork_business_document_requests (
 firm_id uuid not null, request_key text not null check(length(request_key) between 1 and 100), request_hash text not null,
 document_id uuid not null, revision bigint not null, action text not null,
 primary key(firm_id,request_key), foreign key(firm_id,document_id) references public.paperwork_business_documents(firm_id,id)
);
create trigger immutable_business_document_requests before update or delete on public.paperwork_business_document_requests for each row execute function public._paperwork_accounting_immutable();

create function public._paperwork_guard_issued_document() returns trigger language plpgsql set search_path='' as $$
declare f uuid; d uuid; begin
 if tg_table_name='paperwork_business_documents' then
 if old.lifecycle='issued' then raise exception 'ACCOUNTING_IMMUTABLE'; end if;
 else
 if tg_op='INSERT' then f:=new.firm_id;d:=new.document_id; else f:=old.firm_id;d:=old.document_id; end if;
 if exists(select 1 from public.paperwork_business_documents where firm_id=f and id=d and lifecycle='issued') then raise exception 'ACCOUNTING_IMMUTABLE'; end if;
 if tg_op='UPDATE' and exists(select 1 from public.paperwork_business_documents where firm_id=new.firm_id and id=new.document_id and lifecycle='issued') then raise exception 'ACCOUNTING_IMMUTABLE'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger guard_issued_document before update or delete on public.paperwork_business_documents for each row execute function public._paperwork_guard_issued_document();
create trigger guard_issued_document_lines before insert or update or delete on public.paperwork_business_document_lines for each row execute function public._paperwork_guard_issued_document();

create function public.paperwork_read_business_document(p_firm uuid,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare d public.paperwork_business_documents; begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 select * into d from public.paperwork_business_documents where firm_id=p_firm and id=p_id;
 if not found then return null; end if;
 return jsonb_build_object('document',jsonb_build_object('id',d.id,'firmId',d.firm_id,'partnerId',d.partner_id,'direction',d.direction,'kind',d.kind,'referenceId',d.reference_id,'number',d.number,'documentDate',d.document_date::text,'dueDate',d.due_date::text,'description',d.description,'currency',d.currency,
 'lines',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'description',description,'net',net::text,'tax',tax::text) order by position),'[]'::jsonb) from public.paperwork_business_document_lines where firm_id=p_firm and document_id=p_id)),
 'revision',d.revision::text,'lifecycle',d.lifecycle,'partnerName',d.partner_name,'issuedAt',d.issued_at,'issuedBy',d.issued_by,
 'workflow',(select jsonb_build_object('revision',revision::text,'approval',approval,'delivery',delivery) from public.paperwork_business_document_workflow where firm_id=p_firm and document_id=p_id),
 'payment','not_tracked','journalId',(select journal_id from public.paperwork_document_journals where firm_id=p_firm and document_id=p_id));
end $$;
create function public.paperwork_list_business_documents(p_firm uuid,p_year uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare y public.paperwork_fiscal_years; begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 select * into strict y from public.paperwork_fiscal_years where firm_id=p_firm and id=p_year;
 return (select coalesce(jsonb_agg(public.paperwork_read_business_document(p_firm,id) order by document_date desc,id),'[]'::jsonb)
 from (select id,document_date from public.paperwork_business_documents where firm_id=p_firm and document_date between y.starts_on and y.ends_on order by document_date desc,id limit 100) d);
end $$;

-- Save/issue/workflow share one key namespace, stable acknowledgements and audit.
create function public.paperwork_business_document_command(p_action text,p_data jsonb,p_expected text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_data->>'firmId')::uuid; j uuid:=(p_data->>'id')::uuid; d public.paperwork_business_documents; ref public.paperwork_business_documents;
 w public.paperwork_business_document_workflow; r public.paperwork_business_document_requests; hash text; item jsonb; pos integer:=0; rev bigint; total numeric; original_total numeric; credits numeric;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
 hash:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data,'expected',p_expected)::text,'UTF8')),'hex');
 select * into r from public.paperwork_business_document_requests where firm_id=f and request_key=p_key;
 if found then
 if hash<>r.request_hash then raise exception 'IDEMPOTENCY_REUSE'; end if;
 return jsonb_build_object('firmId',f,'documentId',r.document_id,'revision',r.revision::text,'action',r.action);
 end if;
 select * into d from public.paperwork_business_documents where firm_id=f and id=j for update;
 if p_action='save' then
 if p_expected is distinct from coalesce(d.revision::text,'0') or d.lifecycle='issued' then raise exception 'STALE_REVISION'; end if;
 if jsonb_typeof(p_data->'lines') is distinct from 'array' or jsonb_array_length(p_data->'lines') not between 1 and 1000 then raise exception 'INVALID_DOCUMENT'; end if;
 if p_data->>'currency' is distinct from 'RSD' then raise exception 'INVALID_CURRENCY'; end if;
 rev:=coalesce(d.revision,0)+1;
 insert into public.paperwork_business_documents(firm_id,id,partner_id,direction,kind,reference_id,number,document_date,due_date,description,revision,partner_name,saved_by)
 select f,j,p.id,p_data->>'direction',p_data->>'kind',(p_data->>'referenceId')::uuid,p_data->>'number',(p_data->>'documentDate')::date,(p_data->>'dueDate')::date,p_data->>'description',rev,p.name,auth.uid()
 from public.paperwork_accounting_partners p where firm_id=f and id=(p_data->>'partnerId')::uuid
 on conflict(firm_id,id) do update set partner_id=excluded.partner_id,direction=excluded.direction,kind=excluded.kind,reference_id=excluded.reference_id,number=excluded.number,document_date=excluded.document_date,due_date=excluded.due_date,description=excluded.description,revision=excluded.revision,partner_name=excluded.partner_name,saved_by=excluded.saved_by,saved_at=now();
 if not found then raise exception 'INVALID_PARTNER'; end if;
 delete from public.paperwork_business_document_lines where firm_id=f and document_id=j;
 for item in select value from jsonb_array_elements(p_data->'lines') loop
 if jsonb_typeof(item->'net') is distinct from 'string' or jsonb_typeof(item->'tax') is distinct from 'string' or (item->>'net') !~ '^(0|[1-9][0-9]{0,23})$' or (item->>'tax') !~ '^(0|[1-9][0-9]{0,23})$' then raise exception 'INVALID_AMOUNT'; end if;
 insert into public.paperwork_business_document_lines values(f,j,item->>'id',pos,item->>'description',(item->>'net')::numeric,(item->>'tax')::numeric);pos:=pos+1;
 end loop;
 insert into public.paperwork_business_document_workflow(firm_id,document_id) values(f,j) on conflict do nothing;
 -- Editing content invalidates any previous approval of the draft.
 if d.id is not null then update public.paperwork_business_document_workflow set approval='pending',revision=revision+1 where firm_id=f and document_id=j; end if;
 elsif p_action='issue' then
 if d.id is null or p_expected is distinct from d.revision::text or d.lifecycle<>'draft' then raise exception 'STALE_REVISION'; end if;
 select * into strict w from public.paperwork_business_document_workflow where firm_id=f and document_id=j;
 if w.approval<>'approved' then raise exception 'DOCUMENT_NOT_APPROVED'; end if;
 select sum(net+tax) into total from public.paperwork_business_document_lines where firm_id=f and document_id=j;
 if total is null or total<=0 or total>=1e24 then raise exception 'INVALID_DOCUMENT_TOTAL'; end if;
 if d.kind='credit_note' then
 select * into strict ref from public.paperwork_business_documents where firm_id=f and id=d.reference_id;
 if ref.lifecycle<>'issued' or ref.kind='credit_note' or ref.partner_id<>d.partner_id or ref.direction<>d.direction or ref.currency<>d.currency or d.document_date<ref.document_date then raise exception 'INVALID_DOCUMENT_REFERENCE'; end if;
 select sum(net+tax) into original_total from public.paperwork_business_document_lines where firm_id=f and document_id=ref.id;
 select coalesce(sum(l.net+l.tax),0) into credits from public.paperwork_business_document_lines l join public.paperwork_business_documents c on c.firm_id=l.firm_id and c.id=l.document_id where c.firm_id=f and c.reference_id=ref.id and c.lifecycle='issued';
 if credits+total>original_total then raise exception 'EXCESS_CREDIT'; end if;
 if exists(select 1 from (
 select coalesce(sum(l.net),0) n,coalesce(sum(l.tax),0) t from public.paperwork_business_document_lines l join public.paperwork_business_documents c on c.firm_id=l.firm_id and c.id=l.document_id
 where c.firm_id=f and (c.id=j or (c.reference_id=ref.id and c.lifecycle='issued'))
 ) sums where sums.n>(select sum(net) from public.paperwork_business_document_lines where firm_id=f and document_id=ref.id)
 or sums.t>(select sum(tax) from public.paperwork_business_document_lines where firm_id=f and document_id=ref.id)) then raise exception 'EXCESS_CREDIT'; end if;
 end if;
 rev:=d.revision+1;
 update public.paperwork_business_documents set lifecycle='issued',revision=rev,issued_by=auth.uid(),issued_at=now() where firm_id=f and id=j;
 elsif p_action in ('approve','reject','record_delivery') then
 if d.id is null then raise exception 'INVALID_DOCUMENT'; end if;
 select * into strict w from public.paperwork_business_document_workflow where firm_id=f and document_id=j for update;
 if p_expected is distinct from w.revision::text then raise exception 'STALE_REVISION'; end if;
 if p_action='record_delivery' and (d.lifecycle<>'issued' or length(trim(coalesce(p_data->>'evidence',''))) not between 1 and 1000) then raise exception 'INVALID_DELIVERY'; end if;
 if p_action in ('approve','reject') and d.lifecycle<>'draft' then raise exception 'INVALID_DOCUMENT'; end if;
 rev:=w.revision+1;
 update public.paperwork_business_document_workflow set revision=rev,approval=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else approval end,delivery=case when p_action='record_delivery' then 'sent' else delivery end where firm_id=f and document_id=j;
 else raise exception 'INVALID_DOCUMENT_ACTION'; end if;
 insert into public.paperwork_business_document_requests values(f,p_key,hash,j,rev,p_action);
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(f,auth.uid(),'document.'||p_action,j::text,p_data->>'evidence');
 return jsonb_build_object('firmId',f,'documentId',j,'revision',rev::text,'action',p_action);
end $$;

create function public.paperwork_post_document_journal(p_document uuid,p_document_expected text,p_draft jsonb,p_expected text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_draft->>'firmId')::uuid; d public.paperwork_business_documents; bound uuid; receipt jsonb; gross numeric; counterpart numeric; debit_side boolean;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 select * into strict d from public.paperwork_business_documents where firm_id=f and id=p_document;
 if d.lifecycle<>'issued' or p_document_expected is distinct from d.revision::text then raise exception 'STALE_REVISION'; end if;
 select journal_id into bound from public.paperwork_document_journals where firm_id=f and document_id=p_document;
 if bound is not null and bound is distinct from (p_draft->>'id')::uuid then raise exception 'DUPLICATE_SOURCE'; end if;
 if bound is null and exists(select 1 from public.paperwork_journals where firm_id=f and id=(p_draft->>'id')::uuid) then raise exception 'DUPLICATE_SOURCE'; end if;
 select sum(net+tax) into gross from public.paperwork_business_document_lines where firm_id=f and document_id=p_document;
 debit_side:=(d.direction='outgoing')<>(d.kind='credit_note');
 -- The source partner balance must equal the gross document, on its proper side.
 select coalesce(sum(case when debit_side then (l->>'debit')::numeric-(l->>'credit')::numeric else (l->>'credit')::numeric-(l->>'debit')::numeric end),0)
 into counterpart from jsonb_array_elements(p_draft->'lines') l join public.paperwork_accounts a on a.firm_id=f and a.id=(l->>'accountId')::uuid and a.requires_partner
 where (l->>'partnerId')::uuid=d.partner_id;
 if counterpart<>gross or exists(select 1 from jsonb_array_elements(p_draft->'lines') l where l->>'partnerId' is not null and (l->>'partnerId')::uuid<>d.partner_id) then raise exception 'INVALID_SOURCE_AMOUNT'; end if;
 receipt:=public.paperwork_post_journal(p_draft,p_expected,p_key);
 if bound is null then
 insert into public.paperwork_document_journals values(f,p_document,(p_draft->>'id')::uuid);
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(f,auth.uid(),'document.posted',p_document::text,(p_draft->>'id'));
 end if;
 return receipt;
end $$;
do $$ declare t text; begin
 foreach t in array array['paperwork_business_documents','paperwork_business_document_lines','paperwork_business_document_workflow','paperwork_document_journals','paperwork_business_document_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy accounting_read on public.%I for select to authenticated using(public.paperwork_accounting_readable(firm_id))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
revoke all on function public._paperwork_guard_issued_document() from public,anon,authenticated;
revoke all on function public.paperwork_read_business_document(uuid,uuid),public.paperwork_list_business_documents(uuid,uuid),public.paperwork_business_document_command(text,jsonb,text,text),public.paperwork_post_document_journal(uuid,text,jsonb,text,text) from public,anon;
grant execute on function public.paperwork_read_business_document(uuid,uuid),public.paperwork_list_business_documents(uuid,uuid),public.paperwork_business_document_command(text,jsonb,text,text),public.paperwork_post_document_journal(uuid,text,jsonb,text,text) to authenticated;
commit;
