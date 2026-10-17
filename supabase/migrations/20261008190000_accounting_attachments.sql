begin;
create table public.paperwork_accounting_attachments (
 firm_id uuid not null,id uuid not null,document_id uuid,statement_id uuid,target_revision bigint,
 name text not null check(length(name)>=1 and length(name)<=255 and name !~ '[\\/:[:cntrl:]]' and name not in ('.','..')),
 bytes bigint not null check(bytes between 1 and 10485760),sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 external_reference text not null check(length(trim(external_reference)) between 1 and 1000),
 registered_by uuid not null references auth.users(id),registered_at timestamptz not null default now(),
 primary key(firm_id,id),foreign key(firm_id,document_id) references public.paperwork_business_documents(firm_id,id),
 foreign key(firm_id,statement_id) references public.paperwork_bank_statements(firm_id,id),
 check((document_id is not null and statement_id is null and target_revision is not null and target_revision>0) or (document_id is null and statement_id is not null and target_revision is null))
);
create table public.paperwork_attachment_withdrawals (
 firm_id uuid not null,attachment_id uuid not null,reason text not null check(length(trim(reason)) between 1 and 1000),
 withdrawn_by uuid not null references auth.users(id),withdrawn_at timestamptz not null default now(),
 primary key(firm_id,attachment_id),foreign key(firm_id,attachment_id) references public.paperwork_accounting_attachments(firm_id,id)
);
create table public.paperwork_attachment_requests (
 firm_id uuid not null,request_key text not null check(length(request_key) between 1 and 100),request_hash text not null,
 attachment_id uuid not null,revision bigint not null check(revision in (1,2)),
 primary key(firm_id,request_key),foreign key(firm_id,attachment_id) references public.paperwork_accounting_attachments(firm_id,id)
);
do $$declare t text;begin
 foreach t in array array['paperwork_accounting_attachments','paperwork_attachment_withdrawals','paperwork_attachment_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy accounting_read on public.%I for select to authenticated using(public.paperwork_accounting_readable(firm_id))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger immutable_attachment before update or delete on public.%I for each row execute function public._paperwork_accounting_immutable()',t);
 end loop;
end $$;
create function public.paperwork_attachment_command(p_action text,p_data jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_data->>'firmId')::uuid;i uuid:=(p_data->>'id')::uuid;h text;r public.paperwork_attachment_requests;
 a public.paperwork_accounting_attachments;v bigint;doc uuid;stmt uuid;rev bigint;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY';end if;
 h:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data)::text,'UTF8')),'hex');
 select * into r from public.paperwork_attachment_requests where firm_id=f and request_key=p_key;
 if found then
 if r.request_hash<>h then raise exception 'IDEMPOTENCY_REUSE';end if;
 select * into strict a from public.paperwork_accounting_attachments where firm_id=f and id=r.attachment_id;rev:=r.revision;
 else
 if p_action='register' then
 if jsonb_typeof(p_data->'bytes') is distinct from 'string' or (p_data->>'bytes') !~ '^[1-9][0-9]{0,7}$'
 or jsonb_typeof(p_data->'name') is distinct from 'string' or jsonb_typeof(p_data->'sha256') is distinct from 'string'
 or jsonb_typeof(p_data->'externalReference') is distinct from 'string' then raise exception 'INVALID_ATTACHMENT';end if;
 if p_data->>'targetType'='document' then
 doc:=(p_data->>'targetId')::uuid;
 select revision into strict v from public.paperwork_business_documents where firm_id=f and id=doc;
 if jsonb_typeof(p_data->'targetRevision') is distinct from 'string' or p_data->>'targetRevision' is distinct from v::text then raise exception 'STALE_REVISION';end if;
 elsif p_data->>'targetType'='bank_statement' then
 stmt:=(p_data->>'targetId')::uuid;
 perform 1 from public.paperwork_bank_statements where firm_id=f and id=stmt;
 if not found or p_data->'targetRevision' is distinct from 'null'::jsonb then raise exception 'INVALID_ATTACHMENT_TARGET';end if;
 else raise exception 'INVALID_ATTACHMENT_TARGET';end if;
 insert into public.paperwork_accounting_attachments values(f,i,doc,stmt,v,p_data->>'name',(p_data->>'bytes')::bigint,p_data->>'sha256',trim(p_data->>'externalReference'),auth.uid(),now()) returning * into a;rev:=1;
 elsif p_action='withdraw' then
 select * into strict a from public.paperwork_accounting_attachments where firm_id=f and id=i;
 if (case when a.document_id is not null then 'document' else 'bank_statement' end) is distinct from p_data->>'targetType'
 or coalesce(a.document_id,a.statement_id) is distinct from (p_data->>'targetId')::uuid then raise exception 'INVALID_ATTACHMENT_TARGET';end if;
 if jsonb_typeof(p_data->'expectedRevision') is distinct from 'string' or p_data->>'expectedRevision' is distinct from '1'
 or exists(select 1 from public.paperwork_attachment_withdrawals where firm_id=f and attachment_id=i) then raise exception 'STALE_REVISION';end if;
 if jsonb_typeof(p_data->'reason') is distinct from 'string' then raise exception 'INVALID_REASON';end if;
 insert into public.paperwork_attachment_withdrawals values(f,i,trim(p_data->>'reason'),auth.uid(),now());rev:=2;
 else raise exception 'INVALID_ATTACHMENT_ACTION';end if;
 insert into public.paperwork_attachment_requests values(f,p_key,h,a.id,rev);
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id) values(f,auth.uid(),'attachment.'||p_action,a.id::text);
 end if;
 return jsonb_build_object('firmId',f,'attachmentId',a.id,'targetType',case when a.document_id is not null then 'document' else 'bank_statement' end,'targetId',coalesce(a.document_id,a.statement_id),'revision',rev::text);
end $$;
create function public.paperwork_attachment_workspace(p_firm uuid,p_type text,p_target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if not ((p_type='document' and exists(select 1 from public.paperwork_business_documents where firm_id=p_firm and id=p_target))
 or (p_type='bank_statement' and exists(select 1 from public.paperwork_bank_statements where firm_id=p_firm and id=p_target))) then raise exception 'INVALID_ATTACHMENT_TARGET';end if;
 return jsonb_build_object('firmId',p_firm,'targetType',p_type,'targetId',p_target,'attachments',
 (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'bytes',a.bytes::text,'sha256',a.sha256,'externalReference',a.external_reference,'targetRevision',a.target_revision::text,
 'registeredAt',a.registered_at,'registeredBy',a.registered_by,'status',case when w.attachment_id is null then 'externally_retained' else 'withdrawn' end,'reason',w.reason) order by a.registered_at desc,a.id),'[]'::jsonb)
 from (select * from public.paperwork_accounting_attachments where firm_id=p_firm and ((p_type='document' and document_id=p_target) or (p_type='bank_statement' and statement_id=p_target)) order by registered_at desc,id limit 100) a
 left join public.paperwork_attachment_withdrawals w on w.firm_id=a.firm_id and w.attachment_id=a.id));
end $$;
revoke all on function public.paperwork_attachment_command(text,jsonb,text),public.paperwork_attachment_workspace(uuid,text,uuid) from public,anon;
grant execute on function public.paperwork_attachment_command(text,jsonb,text),public.paperwork_attachment_workspace(uuid,text,uuid) to authenticated;
commit;
