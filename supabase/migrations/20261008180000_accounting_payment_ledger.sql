begin;
create table public.paperwork_bank_journals (
 firm_id uuid not null,transaction_id uuid not null,journal_id uuid not null,bank_account_id uuid not null,clearing_account_id uuid not null,
 primary key(firm_id,transaction_id),unique(firm_id,journal_id),check(bank_account_id<>clearing_account_id),
 foreign key(firm_id,transaction_id) references public.paperwork_bank_transactions(firm_id,id),
 foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id),
 foreign key(firm_id,bank_account_id) references public.paperwork_accounts(firm_id,id),
 foreign key(firm_id,clearing_account_id) references public.paperwork_accounts(firm_id,id)
);
create table public.paperwork_payment_journals (
 firm_id uuid not null,allocation_id uuid not null,journal_id uuid not null,document_account_id uuid not null,
 primary key(firm_id,allocation_id),unique(firm_id,journal_id),
 foreign key(firm_id,allocation_id) references public.paperwork_payment_allocations(firm_id,id),
 foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id),
 foreign key(firm_id,document_account_id) references public.paperwork_accounts(firm_id,id)
);
create table public.paperwork_payment_ledger_requests (
 firm_id uuid not null,request_key text not null check(length(request_key) between 1 and 100),request_hash text not null,
 transaction_id uuid not null,allocation_id uuid,journal_id uuid not null,
 primary key(firm_id,request_key),foreign key(firm_id,transaction_id) references public.paperwork_bank_transactions(firm_id,id),
 foreign key(firm_id,allocation_id) references public.paperwork_payment_allocations(firm_id,id),foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id)
);
do $$ declare t text;begin
 foreach t in array array['paperwork_bank_journals','paperwork_payment_journals','paperwork_payment_ledger_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy accounting_read on public.%I for select to authenticated using(public.paperwork_accounting_readable(firm_id))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger immutable_payment_ledger before update or delete on public.%I for each row execute function public._paperwork_accounting_immutable()',t);
 end loop;
end $$;

create function public.paperwork_payment_ledger_command(p_action text,p_data jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_data->>'firmId')::uuid;j uuid:=(p_data->>'journalId')::uuid;tx public.paperwork_bank_transactions;
 a public.paperwork_payment_allocations;d public.paperwork_business_documents;b public.paperwork_bank_journals;previous public.paperwork_payment_journals;
 r public.paperwork_payment_ledger_requests;h text;bank uuid;clearing uuid;doc_account uuid;linked uuid;lines jsonb;receipt jsonb;value numeric;inflow boolean;date date;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY';end if;
 h:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data)::text,'UTF8')),'hex');
 select * into r from public.paperwork_payment_ledger_requests where firm_id=f and request_key=p_key;
 if found then
 if h<>r.request_hash then raise exception 'IDEMPOTENCY_REUSE';end if;
 return jsonb_build_object('firmId',f,'transactionId',r.transaction_id,'allocationId',r.allocation_id,'journalId',r.journal_id);
 end if;
 if exists(select 1 from public.paperwork_journals where firm_id=f and id=j) then raise exception 'DUPLICATE_SOURCE';end if;
 select * into strict tx from public.paperwork_bank_transactions where firm_id=f and id=(p_data->>'transactionId')::uuid;
 if jsonb_typeof(p_data->'postingDate') is distinct from 'string' or (p_data->>'postingDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'INVALID_PAYMENT_DATE';end if;
 date:=(p_data->>'postingDate')::date;if date<tx.booking_date then raise exception 'INVALID_PAYMENT_DATE';end if;
 inflow:=tx.incoming>0;
 if p_action='bank' then
 if exists(select 1 from public.paperwork_bank_journals where firm_id=f and transaction_id=tx.id) then raise exception 'DUPLICATE_SOURCE';end if;
 bank:=(p_data->>'bankAccountId')::uuid;clearing:=(p_data->>'clearingAccountId')::uuid;
 if bank=clearing or bank is null or clearing is null or exists(select 1 from public.paperwork_accounts where firm_id=f and id in (bank,clearing) and requires_partner) then raise exception 'INVALID_BANK_LEDGER_ACCOUNTS';end if;
 value:=tx.incoming+tx.outgoing;
 lines:=jsonb_build_array(jsonb_build_object('id','bank','accountId',bank,'debit',case when inflow then value::text else '0' end,'credit',case when inflow then '0' else value::text end,'description',tx.external_id),
 jsonb_build_object('id','clearing','accountId',clearing,'debit',case when inflow then '0' else value::text end,'credit',case when inflow then value::text else '0' end,'description',tx.external_id));
 elsif p_action='allocation' then
 select * into strict a from public.paperwork_payment_allocations where firm_id=f and id=(p_data->>'allocationId')::uuid and transaction_id=tx.id;
 if not public._paperwork_payment_active(f,a.id) then raise exception 'INVALID_PAYMENT_SOURCE';end if;
 if exists(select 1 from public.paperwork_payment_journals where firm_id=f and allocation_id=a.id) then raise exception 'DUPLICATE_SOURCE';end if;
 select * into strict b from public.paperwork_bank_journals where firm_id=f and transaction_id=tx.id;
 if exists(select 1 from public.paperwork_journals where firm_id=f and reversal_of=b.journal_id) then raise exception 'REVERSED_BANK_SOURCE';end if;
 if date<(select posting_date from public.paperwork_journals where firm_id=f and id=b.journal_id) then raise exception 'INVALID_PAYMENT_DATE';end if;
 select * into strict d from public.paperwork_business_documents where firm_id=f and id=a.document_id;
 select journal_id into linked from public.paperwork_document_journals where firm_id=f and document_id=d.id;
 doc_account:=(p_data->>'documentAccountId')::uuid;
 if linked is null or exists(select 1 from public.paperwork_journals where firm_id=f and reversal_of=linked) or doc_account in (b.bank_account_id,b.clearing_account_id)
 or not exists(select 1 from public.paperwork_journal_lines l join public.paperwork_accounts c on c.firm_id=l.firm_id and c.id=l.account_id where l.firm_id=f and l.journal_id=linked and l.account_id=doc_account and l.partner_id=d.partner_id and c.requires_partner and (case when d.direction='outgoing' then l.debit-l.credit else l.credit-l.debit end)>0) then raise exception 'INVALID_PAYMENT_DOCUMENT_ACCOUNT';end if;
 if date<(select posting_date from public.paperwork_journals where firm_id=f and id=linked) then raise exception 'INVALID_PAYMENT_DATE';end if;
 if a.kind='refund' then
 select * into strict previous from public.paperwork_payment_journals where firm_id=f and allocation_id=a.refund_of;
 if previous.document_account_id<>doc_account or exists(select 1 from public.paperwork_journals where firm_id=f and reversal_of=previous.journal_id) then raise exception 'INVALID_REFUND_LEDGER_SOURCE';end if;
 if date<(select posting_date from public.paperwork_journals where firm_id=f and id=previous.journal_id) then raise exception 'INVALID_PAYMENT_DATE';end if;
 elsif a.amount>public._paperwork_source_account_remaining(f,d.id,doc_account,d.direction='outgoing') then raise exception 'PAYMENT_ACCOUNT_CAPACITY_EXCEEDED';end if;
 value:=a.amount;
 lines:=jsonb_build_array(jsonb_build_object('id','clearing','accountId',b.clearing_account_id,'debit',case when inflow then value::text else '0' end,'credit',case when inflow then '0' else value::text end,'description',tx.external_id),
 jsonb_build_object('id','document','accountId',doc_account,'partnerId',d.partner_id,'debit',case when inflow then '0' else value::text end,'credit',case when inflow then value::text else '0' end,'description',d.number));
 else raise exception 'INVALID_PAYMENT_LEDGER_ACTION';end if;
 receipt:=public.paperwork_post_journal(jsonb_build_object('id',j,'firmId',f,'fiscalYearId',p_data->>'fiscalYearId','periodId',p_data->>'periodId','postingDate',date::text,'description','Bank '||p_action||': '||tx.external_id,'lines',lines),'0','payment.ledger:'||md5(p_key));
 if p_action='bank' then insert into public.paperwork_bank_journals values(f,tx.id,j,bank,clearing);
 else insert into public.paperwork_payment_journals values(f,a.id,j,doc_account);end if;
 insert into public.paperwork_payment_ledger_requests values(f,p_key,h,tx.id,case when p_action='allocation' then a.id else null end,j);
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id) values(f,auth.uid(),'payment.ledger_'||p_action,j::text);
 return jsonb_build_object('firmId',f,'transactionId',tx.id,'allocationId',case when p_action='allocation' then a.id else null end,'journalId',j);
end $$;

-- Read both reconciliation evidence and the amount actually posted to the clearing account.
create function public.paperwork_payment_ledger_workspace(p_firm uuid,p_transaction uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare tx public.paperwork_bank_transactions;b public.paperwork_bank_journals;posted numeric;begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 select * into strict tx from public.paperwork_bank_transactions where firm_id=p_firm and id=p_transaction;
 select * into b from public.paperwork_bank_journals where firm_id=p_firm and transaction_id=tx.id;
 select coalesce(sum(a.amount),0) into posted from public.paperwork_payment_allocations a join public.paperwork_payment_journals l on l.firm_id=a.firm_id and l.allocation_id=a.id
 where a.firm_id=p_firm and a.transaction_id=tx.id and public._paperwork_payment_active(p_firm,a.id);
 return jsonb_build_object('firmId',p_firm,'transactionId',tx.id,
 'bank',case when b.journal_id is null then null else jsonb_build_object('journalId',b.journal_id,'bankAccountId',b.bank_account_id,'clearingAccountId',b.clearing_account_id,'reversed',exists(select 1 from public.paperwork_journals where firm_id=p_firm and reversal_of=b.journal_id),'clearingRemaining',(tx.incoming+tx.outgoing-posted)::text) end,
 'allocations',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'journalId',l.journal_id,'documentAccountId',l.document_account_id,'reversalId',(select id from public.paperwork_journals where firm_id=p_firm and reversal_of=l.journal_id),'accountRemaining',public._paperwork_source_account_remaining(p_firm,a.document_id,l.document_account_id,d.direction='outgoing')::text) order by a.created_at,a.id),'[]'::jsonb)
 from public.paperwork_payment_allocations a join public.paperwork_payment_journals l on l.firm_id=a.firm_id and l.allocation_id=a.id join public.paperwork_business_documents d on d.firm_id=a.firm_id and d.id=a.document_id where a.firm_id=p_firm and a.transaction_id=tx.id));
end $$;

create function public._paperwork_guard_payment_reversal() returns trigger language plpgsql set search_path='' as $$ begin
 if new.reversal_of is null then return new;end if;
 if exists(select 1 from public.paperwork_payment_journals l where l.firm_id=new.firm_id and l.journal_id=new.reversal_of and public._paperwork_payment_active(new.firm_id,l.allocation_id))
 or exists(select 1 from public.paperwork_bank_journals b join public.paperwork_payment_allocations a on a.firm_id=b.firm_id and a.transaction_id=b.transaction_id join public.paperwork_payment_journals l on l.firm_id=a.firm_id and l.allocation_id=a.id where b.firm_id=new.firm_id and b.journal_id=new.reversal_of and public._paperwork_payment_active(new.firm_id,a.id))
 or exists(select 1 from public.paperwork_document_journals d join public.paperwork_payment_allocations a on a.firm_id=d.firm_id and a.document_id=d.document_id join public.paperwork_payment_journals l on l.firm_id=a.firm_id and l.allocation_id=a.id where d.firm_id=new.firm_id and d.journal_id=new.reversal_of and public._paperwork_payment_active(new.firm_id,a.id)) then raise exception 'ACTIVE_PAYMENT_LEDGER_LINK';end if;
 return new;
end $$;
create trigger guard_payment_reversal before insert on public.paperwork_journals for each row execute function public._paperwork_guard_payment_reversal();
create function public.paperwork_payment_workbench(p_firm uuid,p_transaction uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('reconciliation',public.paperwork_payment_workspace(p_firm,p_transaction),'ledger',public.paperwork_payment_ledger_workspace(p_firm,p_transaction));
$$;
revoke all on function public.paperwork_payment_workbench(uuid,uuid) from public,anon;
grant execute on function public.paperwork_payment_workbench(uuid,uuid) to authenticated;
revoke all on function public._paperwork_guard_payment_reversal() from public,anon,authenticated;
revoke all on function public.paperwork_payment_ledger_command(text,jsonb,text),public.paperwork_payment_ledger_workspace(uuid,uuid) from public,anon;
grant execute on function public.paperwork_payment_ledger_command(text,jsonb,text),public.paperwork_payment_ledger_workspace(uuid,uuid) to authenticated;
-- Updated cancellation and capacity functions are appended below before COMMIT.

create or replace function public._paperwork_source_account_remaining(p_firm uuid,p_document uuid,p_account uuid,p_debit boolean) returns numeric
language sql stable set search_path='' as $$
 select coalesce((select sum(case when p_debit then l.debit-l.credit else l.credit-l.debit end)
 from public.paperwork_journal_lines l join public.paperwork_document_journals dj on dj.firm_id=l.firm_id and dj.journal_id=l.journal_id
 join public.paperwork_business_documents d on d.firm_id=dj.firm_id and d.id=dj.document_id
 where l.firm_id=p_firm and l.account_id=p_account and (d.id=p_document or (d.reference_id=p_document and d.lifecycle='issued'))
 and not exists(select 1 from public.paperwork_journals r where r.firm_id=p_firm and r.reversal_of=l.journal_id)),0)
 +coalesce((select sum(case when p_debit then l.debit-l.credit else l.credit-l.debit end)
 from public.paperwork_advance_applications a join public.paperwork_journal_lines l on l.firm_id=a.firm_id and l.journal_id=a.id
 where a.firm_id=p_firm and (a.advance_id=p_document or a.invoice_id=p_document) and l.account_id=p_account
 and not exists(select 1 from public.paperwork_advance_cancellations c where c.firm_id=a.firm_id and c.application_id=a.id)),0)
 +coalesce((select sum(case when p_debit then l.debit-l.credit else l.credit-l.debit end) from public.paperwork_payment_allocations a join public.paperwork_payment_journals p on p.firm_id=a.firm_id and p.allocation_id=a.id join public.paperwork_journal_lines l on l.firm_id=p.firm_id and l.journal_id=p.journal_id where a.firm_id=p_firm and a.document_id=p_document and l.account_id=p_account and public._paperwork_payment_active(p_firm,a.id)),0);
$$;


create or replace function public.paperwork_payment_command(p_action text,p_data jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_data->>'firmId')::uuid;j uuid:=(p_data->>'id')::uuid;h text;r public.paperwork_payment_requests;
 a public.paperwork_payment_allocations;original public.paperwork_payment_allocations;tx public.paperwork_bank_transactions;original_tx public.paperwork_bank_transactions;ledger public.paperwork_payment_journals;
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
 select * into ledger from public.paperwork_payment_journals where firm_id=f and allocation_id=j;
 if found then
 if jsonb_typeof(p_data->'postingDate') is distinct from 'string' or (p_data->>'postingDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (p_data->>'postingDate')::date<(select posting_date from public.paperwork_journals where firm_id=f and id=ledger.journal_id) then raise exception 'INVALID_PAYMENT_DATE';end if;
 perform public.paperwork_reverse_journal(f,ledger.journal_id,(p_data->>'periodId')::uuid,(p_data->>'postingDate')::date,p_data->>'reason','1','payment.cancel:'||md5(p_key));
 end if;

 else raise exception 'INVALID_PAYMENT_ACTION';end if;
 insert into public.paperwork_payment_requests values(f,p_key,h,a.id,rev);
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id) values(f,auth.uid(),'payment.'||p_action,a.id::text);
 end if;
 return jsonb_build_object('firmId',f,'allocationId',a.id,'transactionId',a.transaction_id,'documentId',a.document_id,'revision',rev::text);
end $$;


commit;
