begin;
-- Bank reconciliation evidence. Ledger posting remains a separate, explicit workflow.
create table public.paperwork_payment_allocations (
 firm_id uuid not null,id uuid not null,transaction_id uuid not null,document_id uuid not null,
 kind text not null check(kind in ('payment','refund')),refund_of uuid,
 amount numeric(24,0) not null check(amount>0),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,id),
 foreign key(firm_id,transaction_id) references public.paperwork_bank_transactions(firm_id,id),
 foreign key(firm_id,document_id) references public.paperwork_business_documents(firm_id,id),
 foreign key(firm_id,refund_of) references public.paperwork_payment_allocations(firm_id,id),
 check((kind='refund')=(refund_of is not null)),check(refund_of<>id)
);
create index paperwork_payment_transaction on public.paperwork_payment_allocations(firm_id,transaction_id);
create index paperwork_payment_document on public.paperwork_payment_allocations(firm_id,document_id);
create index paperwork_payment_refund on public.paperwork_payment_allocations(firm_id,refund_of);
create table public.paperwork_payment_cancellations (
 firm_id uuid not null,allocation_id uuid not null,reason text not null check(length(trim(reason)) between 1 and 1000),
 cancelled_by uuid not null references auth.users(id),cancelled_at timestamptz not null default now(),
 primary key(firm_id,allocation_id),foreign key(firm_id,allocation_id) references public.paperwork_payment_allocations(firm_id,id)
);
create table public.paperwork_payment_requests (
 firm_id uuid not null,request_key text not null check(length(request_key) between 1 and 100),request_hash text not null,
 allocation_id uuid not null,revision bigint not null check(revision in (1,2)),
 primary key(firm_id,request_key),foreign key(firm_id,allocation_id) references public.paperwork_payment_allocations(firm_id,id)
);
do $$ declare t text;begin
 foreach t in array array['paperwork_payment_allocations','paperwork_payment_cancellations','paperwork_payment_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy accounting_read on public.%I for select to authenticated using(public.paperwork_accounting_readable(firm_id))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger immutable_payment before update or delete on public.%I for each row execute function public._paperwork_accounting_immutable()',t);
 end loop;
end $$;

create function public._paperwork_payment_active(p_firm uuid,p_id uuid) returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from public.paperwork_payment_allocations a where a.firm_id=p_firm and a.id=p_id
 and not exists(select 1 from public.paperwork_payment_cancellations c where c.firm_id=a.firm_id and c.allocation_id=a.id));
$$;
create function public._paperwork_payment_refundable(p_firm uuid,p_id uuid) returns numeric
language sql stable set search_path='' as $$
 select coalesce((select a.amount from public.paperwork_payment_allocations a where a.firm_id=p_firm and a.id=p_id and a.kind='payment'
 and public._paperwork_payment_active(p_firm,a.id)),0)
 -coalesce((select sum(r.amount) from public.paperwork_payment_allocations r where r.firm_id=p_firm and r.refund_of=p_id and public._paperwork_payment_active(p_firm,r.id)),0);
$$;
create function public._paperwork_payment_balance(p_firm uuid,p_document uuid) returns jsonb
language plpgsql stable set search_path='' as $$
declare d public.paperwork_business_documents;gross numeric;credits numeric;advances numeric:=0;paid numeric;obligation numeric;status text;
begin
 select * into strict d from public.paperwork_business_documents where firm_id=p_firm and id=p_document;
 select coalesce(sum(net+tax),0) into gross from public.paperwork_business_document_lines where firm_id=p_firm and document_id=p_document;
 select coalesce(sum(l.net+l.tax),0) into credits from public.paperwork_business_document_lines l join public.paperwork_business_documents c on c.firm_id=l.firm_id and c.id=l.document_id
 where c.firm_id=p_firm and c.reference_id=p_document and c.lifecycle='issued';
 if d.kind='invoice' then
 select coalesce(sum(a.net+a.tax),0) into advances from public.paperwork_advance_applications a where a.firm_id=p_firm and a.invoice_id=p_document
 and not exists(select 1 from public.paperwork_advance_cancellations c where c.firm_id=a.firm_id and c.application_id=a.id);
 end if;
 select coalesce(sum(case when a.kind='payment' then a.amount else -a.amount end),0) into paid from public.paperwork_payment_allocations a
 where a.firm_id=p_firm and a.document_id=p_document and public._paperwork_payment_active(p_firm,a.id);
 obligation:=gross-credits-advances;
 if d.lifecycle<>'issued' or d.kind='credit_note' or not exists(select 1 from public.paperwork_payment_allocations where firm_id=p_firm and document_id=p_document) then status:='not_tracked';
 elsif paid>obligation then status:='overpaid';elsif paid=obligation then status:='paid';elsif paid>0 then status:='partial';else status:='unpaid';end if;
 return jsonb_build_object('gross',gross::text,'credits',credits::text,'advances',advances::text,'paid',paid::text,
 'due',greatest(obligation-paid,0)::text,'overpaid',greatest(paid-obligation,0)::text,'status',status);
end $$;

create function public.paperwork_payment_command(p_action text,p_data jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_data->>'firmId')::uuid;j uuid:=(p_data->>'id')::uuid;h text;r public.paperwork_payment_requests;
 a public.paperwork_payment_allocations;original public.paperwork_payment_allocations;tx public.paperwork_bank_transactions;original_tx public.paperwork_bank_transactions;
 d public.paperwork_business_documents;available numeric;value numeric;balance jsonb;rev bigint;refund boolean;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') or (p_action='cancel' and not public.paperwork_accounting_can(f,'reverse_journal')) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY';end if;
 h:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data)::text,'UTF8')),'hex');
 select * into r from public.paperwork_payment_requests where firm_id=f and request_key=p_key;
 if found then
 if r.request_hash<>h then raise exception 'IDEMPOTENCY_REUSE';end if;
 select * into strict a from public.paperwork_payment_allocations where firm_id=f and id=r.allocation_id;rev:=r.revision;
 else
 if p_action='allocate' then
 select * into strict tx from public.paperwork_bank_transactions where firm_id=f and id=(p_data->>'transactionId')::uuid;
 select * into strict d from public.paperwork_business_documents where firm_id=f and id=(p_data->>'documentId')::uuid;
 if d.lifecycle<>'issued' or d.kind not in ('invoice','advance') or d.currency<>'RSD' then raise exception 'INVALID_PAYMENT_DOCUMENT';end if;
 if jsonb_typeof(p_data->'documentRevision') is distinct from 'string' or (p_data->>'documentRevision') is distinct from d.revision::text then raise exception 'STALE_REVISION';end if;
 if jsonb_typeof(p_data->'amount') is distinct from 'string' or (p_data->>'amount') !~ '^[1-9][0-9]{0,23}$' then raise exception 'INVALID_AMOUNT';end if;
 value:=(p_data->>'amount')::numeric;refund:=p_data->>'kind'='refund';
 if p_data->>'kind' is null or p_data->>'kind' not in ('payment','refund') then raise exception 'INVALID_PAYMENT_KIND';end if;
 if ((d.direction='outgoing') <> refund) <> (tx.incoming>0) then raise exception 'INVALID_PAYMENT_DIRECTION';end if;
 select tx.incoming+tx.outgoing-coalesce(sum(amount),0) into available from public.paperwork_payment_allocations
 where firm_id=f and transaction_id=tx.id and public._paperwork_payment_active(f,id);
 if value>available then raise exception 'PAYMENT_CAPACITY_EXCEEDED';end if;
 if refund then
 select * into strict original from public.paperwork_payment_allocations where firm_id=f and id=(p_data->>'refundOf')::uuid and kind='payment';
 if original.document_id<>d.id or not public._paperwork_payment_active(f,original.id) or original.id=j then raise exception 'INVALID_REFUND_SOURCE';end if;
 select * into strict original_tx from public.paperwork_bank_transactions where firm_id=f and id=original.transaction_id;
 if tx.booking_date<original_tx.booking_date or value>public._paperwork_payment_refundable(f,original.id) then raise exception 'REFUND_CAPACITY_EXCEEDED';end if;
 else
 if p_data->'refundOf' is distinct from 'null'::jsonb then raise exception 'INVALID_REFUND_SOURCE';end if;
 balance:=public._paperwork_payment_balance(f,d.id);
 if value>(balance->>'due')::numeric then raise exception 'DOCUMENT_PAYMENT_EXCEEDED';end if;
 end if;
 insert into public.paperwork_payment_allocations values(f,j,tx.id,d.id,p_data->>'kind',case when refund then original.id else null end,value,auth.uid(),now()) returning * into a;rev:=1;
 elsif p_action='cancel' then
 select * into strict a from public.paperwork_payment_allocations where firm_id=f and id=j;
 if a.transaction_id is distinct from (p_data->>'transactionId')::uuid or a.document_id is distinct from (p_data->>'documentId')::uuid then raise exception 'INVALID_PAYMENT_SOURCE';end if;
 if jsonb_typeof(p_data->'expectedRevision') is distinct from 'string' or p_data->>'expectedRevision' is distinct from '1' or not public._paperwork_payment_active(f,j) then raise exception 'STALE_REVISION';end if;
 if jsonb_typeof(p_data->'reason') is distinct from 'string' or length(trim(p_data->>'reason')) not between 1 and 1000 then raise exception 'INVALID_REASON';end if;
 if exists(select 1 from public.paperwork_payment_allocations where firm_id=f and refund_of=j and public._paperwork_payment_active(f,id)) then raise exception 'ACTIVE_PAYMENT_REFUNDS';end if;
 insert into public.paperwork_payment_cancellations values(f,j,trim(p_data->>'reason'),auth.uid(),now());rev:=2;
 else raise exception 'INVALID_PAYMENT_ACTION';end if;
 insert into public.paperwork_payment_requests values(f,p_key,h,a.id,rev);
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id) values(f,auth.uid(),'payment.'||p_action,a.id::text);
 end if;
 return jsonb_build_object('firmId',f,'allocationId',a.id,'transactionId',a.transaction_id,'documentId',a.document_id,'revision',rev::text);
end $$;

create function public.paperwork_payment_workspace(p_firm uuid,p_transaction uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare tx public.paperwork_bank_transactions;begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 select * into strict tx from public.paperwork_bank_transactions where firm_id=p_firm and id=p_transaction;
 return jsonb_build_object('firmId',p_firm,'transaction',jsonb_build_object('id',tx.id,'accountId',tx.bank_account_id,'externalId',tx.external_id,'bookingDate',tx.booking_date::text,'incoming',tx.incoming::text,'outgoing',tx.outgoing::text,
 'available',(tx.incoming+tx.outgoing-coalesce((select sum(amount) from public.paperwork_payment_allocations where firm_id=p_firm and transaction_id=tx.id and public._paperwork_payment_active(p_firm,id)),0))::text),
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'number',d.number,'partnerName',d.partner_name,'direction',d.direction,'kind',d.kind,'revision',d.revision::text,'balance',public._paperwork_payment_balance(p_firm,d.id)) order by d.document_date desc,d.id),'[]'::jsonb)
 from (select * from public.paperwork_business_documents where firm_id=p_firm and lifecycle='issued' and kind in ('invoice','advance') order by document_date desc,id limit 100) d),
 'allocations',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'documentId',a.document_id,'number',d.number,'kind',a.kind,'refundOf',a.refund_of,'amount',a.amount::text,'status',case when c.allocation_id is null then 'active' else 'cancelled' end,'reason',c.reason,'refundable',public._paperwork_payment_refundable(p_firm,a.id)::text) order by a.created_at,a.id),'[]'::jsonb)
 from public.paperwork_payment_allocations a join public.paperwork_business_documents d on d.firm_id=a.firm_id and d.id=a.document_id left join public.paperwork_payment_cancellations c on c.firm_id=a.firm_id and c.allocation_id=a.id where a.firm_id=p_firm and a.transaction_id=tx.id),
 'refundablePayments',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'documentId',a.document_id,'number',d.number,'externalId',source.external_id,'bookingDate',source.booking_date::text,'available',public._paperwork_payment_refundable(p_firm,a.id)::text) order by a.created_at desc,a.id),'[]'::jsonb)
 from (select a.* from public.paperwork_payment_allocations a join public.paperwork_bank_transactions t on t.firm_id=a.firm_id and t.id=a.transaction_id
 where a.firm_id=p_firm and a.kind='payment' and t.booking_date<=tx.booking_date and (t.incoming>0)<>(tx.incoming>0) and public._paperwork_payment_refundable(p_firm,a.id)>0 order by a.created_at desc,a.id limit 100) a
 join public.paperwork_business_documents d on d.firm_id=a.firm_id and d.id=a.document_id
 join public.paperwork_bank_transactions source on source.firm_id=a.firm_id and source.id=a.transaction_id));
end $$;
create or replace function public.paperwork_read_business_document(p_firm uuid,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare d public.paperwork_business_documents; begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 select * into d from public.paperwork_business_documents where firm_id=p_firm and id=p_id;
 if not found then return null; end if;
 return jsonb_build_object('document',jsonb_build_object('id',d.id,'firmId',d.firm_id,'partnerId',d.partner_id,'direction',d.direction,'kind',d.kind,'referenceId',d.reference_id,'number',d.number,'documentDate',d.document_date::text,'dueDate',d.due_date::text,'description',d.description,'currency',d.currency,
 'lines',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'description',description,'net',net::text,'tax',tax::text) order by position),'[]'::jsonb) from public.paperwork_business_document_lines where firm_id=p_firm and document_id=p_id)),
 'revision',d.revision::text,'lifecycle',d.lifecycle,'partnerName',d.partner_name,'issuedAt',d.issued_at,'issuedBy',d.issued_by,
 'workflow',(select jsonb_build_object('revision',revision::text,'approval',approval,'delivery',delivery) from public.paperwork_business_document_workflow where firm_id=p_firm and document_id=p_id),
 'payment',public._paperwork_payment_balance(p_firm,p_id)->>'status','journalId',(select journal_id from public.paperwork_document_journals where firm_id=p_firm and document_id=p_id));
end $$;
revoke all on function public._paperwork_payment_active(uuid,uuid),public._paperwork_payment_refundable(uuid,uuid),public._paperwork_payment_balance(uuid,uuid) from public,anon,authenticated;
revoke all on function public.paperwork_payment_command(text,jsonb,text),public.paperwork_payment_workspace(uuid,uuid) from public,anon;
grant execute on function public.paperwork_payment_command(text,jsonb,text),public.paperwork_payment_workspace(uuid,uuid) to authenticated;
commit;
