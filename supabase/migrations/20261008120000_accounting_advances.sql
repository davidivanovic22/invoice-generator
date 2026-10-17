begin;
-- An application is an explicit ledger transfer, never a fabricated bank payment.
create table public.paperwork_advance_applications (
 firm_id uuid not null, id uuid not null, advance_id uuid not null, invoice_id uuid not null,
 net numeric(24,0) not null check(net>=0), tax numeric(24,0) not null check(tax>=0),
 applied_by uuid not null references auth.users(id), applied_at timestamptz not null default now(),
 primary key(firm_id,id), check(net+tax>0 and net+tax<1e24), check(advance_id<>invoice_id),
 foreign key(firm_id,advance_id) references public.paperwork_business_documents(firm_id,id),
 foreign key(firm_id,invoice_id) references public.paperwork_business_documents(firm_id,id),
 foreign key(firm_id,id) references public.paperwork_journals(firm_id,id)
);
create table public.paperwork_advance_cancellations (
 firm_id uuid not null, application_id uuid not null, reason text not null check(length(trim(reason)) between 1 and 1000),
 cancelled_by uuid not null references auth.users(id), cancelled_at timestamptz not null default now(),
 primary key(firm_id,application_id), foreign key(firm_id,application_id) references public.paperwork_advance_applications(firm_id,id)
);
create index paperwork_advance_source on public.paperwork_advance_applications(firm_id,advance_id);
create index paperwork_advance_invoice on public.paperwork_advance_applications(firm_id,invoice_id);
create table public.paperwork_advance_requests (
 firm_id uuid not null, request_key text not null check(length(request_key) between 1 and 100), request_hash text not null,
 application_id uuid not null, revision bigint not null check(revision in (1,2)), journal_id uuid not null,
 primary key(firm_id,request_key),
 foreign key(firm_id,application_id) references public.paperwork_advance_applications(firm_id,id),
 foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id)
);
do $$ declare t text; begin
 foreach t in array array['paperwork_advance_applications','paperwork_advance_cancellations','paperwork_advance_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy accounting_read on public.%I for select to authenticated using(public.paperwork_accounting_readable(firm_id))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger immutable_advance before update or delete on public.%I for each row execute function public._paperwork_accounting_immutable()',t);
 end loop;
end $$;

-- Remaining source components after issued credit notes and active applications.
create function public._paperwork_document_remaining(p_firm uuid,p_document uuid) returns table(net numeric,tax numeric)
language sql stable set search_path='' as $$
 select coalesce((select sum(l.net) from public.paperwork_business_document_lines l where l.firm_id=p_firm and l.document_id=p_document),0)
 -coalesce((select sum(l.net) from public.paperwork_business_document_lines l join public.paperwork_business_documents d on d.firm_id=l.firm_id and d.id=l.document_id where d.firm_id=p_firm and d.reference_id=p_document and d.lifecycle='issued'),0)
 -coalesce((select sum(a.net) from public.paperwork_advance_applications a where a.firm_id=p_firm and (a.advance_id=p_document or a.invoice_id=p_document) and not exists(select 1 from public.paperwork_advance_cancellations c where c.firm_id=a.firm_id and c.application_id=a.id)),0),
 coalesce((select sum(l.tax) from public.paperwork_business_document_lines l where l.firm_id=p_firm and l.document_id=p_document),0)
 -coalesce((select sum(l.tax) from public.paperwork_business_document_lines l join public.paperwork_business_documents d on d.firm_id=l.firm_id and d.id=l.document_id where d.firm_id=p_firm and d.reference_id=p_document and d.lifecycle='issued'),0)
 -coalesce((select sum(a.tax) from public.paperwork_advance_applications a where a.firm_id=p_firm and (a.advance_id=p_document or a.invoice_id=p_document) and not exists(select 1 from public.paperwork_advance_cancellations c where c.firm_id=a.firm_id and c.application_id=a.id)),0);
$$;

-- Account capacity includes posted corrections, as well as active application transfers.
create function public._paperwork_source_account_remaining(p_firm uuid,p_document uuid,p_account uuid,p_debit boolean) returns numeric
language sql stable set search_path='' as $$
 select coalesce((select sum(case when p_debit then l.debit-l.credit else l.credit-l.debit end)
 from public.paperwork_journal_lines l join public.paperwork_document_journals dj on dj.firm_id=l.firm_id and dj.journal_id=l.journal_id
 join public.paperwork_business_documents d on d.firm_id=dj.firm_id and d.id=dj.document_id
 where l.firm_id=p_firm and l.account_id=p_account and (d.id=p_document or (d.reference_id=p_document and d.lifecycle='issued'))
 and not exists(select 1 from public.paperwork_journals r where r.firm_id=p_firm and r.reversal_of=l.journal_id)),0)
 +coalesce((select sum(case when p_debit then l.debit-l.credit else l.credit-l.debit end)
 from public.paperwork_advance_applications a join public.paperwork_journal_lines l on l.firm_id=a.firm_id and l.journal_id=a.id
 where a.firm_id=p_firm and (a.advance_id=p_document or a.invoice_id=p_document) and l.account_id=p_account
 and not exists(select 1 from public.paperwork_advance_cancellations c where c.firm_id=a.firm_id and c.application_id=a.id)),0);
$$;

create function public.paperwork_advance_workspace(p_firm uuid,p_invoice uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare d public.paperwork_business_documents; n numeric;t numeric; begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 select * into strict d from public.paperwork_business_documents where firm_id=p_firm and id=p_invoice and kind='invoice' and lifecycle='issued';
 select net,tax into n,t from public._paperwork_document_remaining(p_firm,p_invoice);
 return jsonb_build_object('firmId',p_firm,'invoiceId',p_invoice,'remainingNet',n::text,'remainingTax',t::text,
 'advances',(select coalesce(jsonb_agg(jsonb_build_object('source',public.paperwork_read_business_document(p_firm,a.id),'remainingNet',r.net::text,'remainingTax',r.tax::text) order by a.document_date,a.id),'[]'::jsonb)
 from public.paperwork_business_documents a cross join lateral public._paperwork_document_remaining(p_firm,a.id) r
 where a.firm_id=p_firm and a.kind='advance' and a.lifecycle='issued' and a.partner_id=d.partner_id and a.direction=d.direction and a.document_date<=d.document_date and r.net+r.tax>0),
 'applications',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'advanceId',a.advance_id,'net',a.net::text,'tax',a.tax::text,'revision',case when c.application_id is null then '1' else '2' end,'status',case when c.application_id is null then 'active' else 'cancelled' end,'journalId',a.id,'reversalId',(select id from public.paperwork_journals where firm_id=p_firm and reversal_of=a.id),'reason',c.reason) order by a.applied_at,a.id),'[]'::jsonb)
 from public.paperwork_advance_applications a left join public.paperwork_advance_cancellations c on c.firm_id=a.firm_id and c.application_id=a.id where a.firm_id=p_firm and a.invoice_id=p_invoice));
end $$;

create function public.paperwork_advance_command(p_action text,p_data jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_data->>'firmId')::uuid; j uuid:=(p_data->>'id')::uuid; a public.paperwork_business_documents; i public.paperwork_business_documents;
 application public.paperwork_advance_applications; r public.paperwork_advance_requests; h text; n numeric;t numeric; available record; receipt jsonb; invoice_account uuid; advance_account uuid; lines jsonb; is_outgoing boolean; advance_partner boolean; linked uuid; rev bigint;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 if p_action='cancel' and not public.paperwork_accounting_can(f,'reverse_journal') then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
 h:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data)::text,'UTF8')),'hex');
 select * into r from public.paperwork_advance_requests where firm_id=f and request_key=p_key;
 if found then
 if h<>r.request_hash then raise exception 'IDEMPOTENCY_REUSE'; end if;
 return jsonb_build_object('firmId',f,'applicationId',r.application_id,'revision',r.revision::text,'journalId',r.journal_id);
 end if;
 if p_action='apply' then
 if p_data->>'expectedRevision' is distinct from '0' or exists(select 1 from public.paperwork_advance_applications where firm_id=f and id=j) or exists(select 1 from public.paperwork_journals where firm_id=f and id=j) then raise exception 'STALE_REVISION'; end if;
 select * into strict a from public.paperwork_business_documents where firm_id=f and id=(p_data->>'advanceId')::uuid;
 select * into strict i from public.paperwork_business_documents where firm_id=f and id=(p_data->>'invoiceId')::uuid;
 if a.kind<>'advance' or i.kind<>'invoice' or a.lifecycle<>'issued' or i.lifecycle<>'issued' or a.partner_id<>i.partner_id or a.direction<>i.direction or a.currency<>i.currency or a.document_date>i.document_date
 or p_data->>'advanceRevision' is distinct from a.revision::text or p_data->>'invoiceRevision' is distinct from i.revision::text then raise exception 'INVALID_ADVANCE_REFERENCE'; end if;
 if jsonb_typeof(p_data->'net') is distinct from 'string' or jsonb_typeof(p_data->'tax') is distinct from 'string' or (p_data->>'net') !~ '^(0|[1-9][0-9]{0,23})$' or (p_data->>'tax') !~ '^(0|[1-9][0-9]{0,23})$' then raise exception 'INVALID_AMOUNT'; end if;
 n:=(p_data->>'net')::numeric;t:=(p_data->>'tax')::numeric;
 if n+t<=0 or n+t>=1e24 or (p_data->>'postingDate')::date<i.document_date then raise exception 'INVALID_ADVANCE_AMOUNT'; end if;
 for available in select * from public._paperwork_document_remaining(f,a.id) union all select * from public._paperwork_document_remaining(f,i.id) loop
 if n>available.net or t>available.tax then raise exception 'EXCESS_ADVANCE'; end if;
 end loop;
 invoice_account:=(p_data->>'invoiceAccountId')::uuid;advance_account:=(p_data->>'advanceAccountId')::uuid;is_outgoing:=i.direction='outgoing';
 if invoice_account=advance_account then raise exception 'INVALID_ADVANCE_ACCOUNT'; end if;
 -- Both sources must have live source journals. Selected accounts must occur on the expected sides.
 select journal_id into linked from public.paperwork_document_journals where firm_id=f and document_id=i.id;
 if (p_data->>'postingDate')::date<(select posting_date from public.paperwork_journals where firm_id=f and id=linked) then raise exception 'INVALID_ADVANCE_DATE'; end if;
 if linked is null or exists(select 1 from public.paperwork_journals where firm_id=f and reversal_of=linked)
 or not exists(select 1 from public.paperwork_journal_lines l join public.paperwork_accounts c on c.firm_id=l.firm_id and c.id=l.account_id where l.firm_id=f and l.journal_id=linked and l.account_id=invoice_account and c.requires_partner and l.partner_id=i.partner_id and (case when is_outgoing then l.debit-l.credit else l.credit-l.debit end)>0) then raise exception 'INVALID_ADVANCE_ACCOUNT'; end if;
 if n+t>public._paperwork_source_account_remaining(f,i.id,invoice_account,is_outgoing) then raise exception 'INVALID_ADVANCE_ACCOUNT'; end if;
 select journal_id into linked from public.paperwork_document_journals where firm_id=f and document_id=a.id;
 if (p_data->>'postingDate')::date<(select posting_date from public.paperwork_journals where firm_id=f and id=linked) then raise exception 'INVALID_ADVANCE_DATE'; end if;
 if linked is null or exists(select 1 from public.paperwork_journals where firm_id=f and reversal_of=linked)
 or not exists(select 1 from public.paperwork_journal_lines l where l.firm_id=f and l.journal_id=linked and l.account_id=advance_account and (case when is_outgoing then l.credit-l.debit else l.debit-l.credit end)>0) then raise exception 'INVALID_ADVANCE_ACCOUNT'; end if;
 if n+t>public._paperwork_source_account_remaining(f,a.id,advance_account,not is_outgoing) then raise exception 'INVALID_ADVANCE_ACCOUNT'; end if;
 select requires_partner into strict advance_partner from public.paperwork_accounts where firm_id=f and id=advance_account;
 lines:=jsonb_build_array(jsonb_build_object('id','invoice','accountId',invoice_account,'partnerId',i.partner_id,'debit',case when is_outgoing then '0' else (n+t)::text end,'credit',case when is_outgoing then (n+t)::text else '0' end,'description',i.number),
 jsonb_build_object('id','advance','accountId',advance_account,'partnerId',case when advance_partner then a.partner_id else null end,'debit',case when is_outgoing then (n+t)::text else '0' end,'credit',case when is_outgoing then '0' else (n+t)::text end,'description',a.number));
 receipt:=public.paperwork_post_journal(jsonb_build_object('id',j,'firmId',f,'fiscalYearId',p_data->>'fiscalYearId','periodId',p_data->>'periodId','postingDate',p_data->>'postingDate','description','Advance application: '||a.number||' / '||i.number,'lines',lines),'0','advance.apply:'||md5(p_key));
 insert into public.paperwork_advance_applications values(f,j,a.id,i.id,n,t,auth.uid(),now());rev:=1;
 elsif p_action='cancel' then
 select * into strict application from public.paperwork_advance_applications where firm_id=f and id=j;
 if p_data->>'expectedRevision' is distinct from '1' or exists(select 1 from public.paperwork_advance_cancellations where firm_id=f and application_id=j) then raise exception 'STALE_REVISION'; end if;
 if (p_data->>'postingDate')::date<(select posting_date from public.paperwork_journals where firm_id=f and id=j) then raise exception 'INVALID_REVERSAL_DATE'; end if;
 insert into public.paperwork_advance_cancellations values(f,j,trim(p_data->>'reason'),auth.uid(),now());
 receipt:=public.paperwork_reverse_journal(f,j,(p_data->>'periodId')::uuid,(p_data->>'postingDate')::date,p_data->>'reason','1','advance.cancel:'||md5(p_key));rev:=2;
 else raise exception 'INVALID_ADVANCE_ACTION'; end if;
 insert into public.paperwork_advance_requests values(f,p_key,h,j,rev,(receipt->>'journalId')::uuid);
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(f,auth.uid(),'advance.'||p_action,j::text,p_data->>'reason');
 return jsonb_build_object('firmId',f,'applicationId',j,'revision',rev::text,'journalId',receipt->>'journalId');
end $$;

create function public._paperwork_guard_advance_dependencies() returns trigger language plpgsql set search_path='' as $$ declare r record;n numeric;t numeric; begin
 if tg_table_name='paperwork_journals' then
 if new.reversal_of is null then return new; end if;
 if exists(select 1 from public.paperwork_advance_applications a where a.firm_id=new.firm_id and a.id=new.reversal_of and not exists(select 1 from public.paperwork_advance_cancellations c where c.firm_id=a.firm_id and c.application_id=a.id))
 or exists(select 1 from public.paperwork_document_journals d join public.paperwork_advance_applications a on a.firm_id=d.firm_id and (a.advance_id=d.document_id or a.invoice_id=d.document_id) where d.firm_id=new.firm_id and d.journal_id=new.reversal_of and not exists(select 1 from public.paperwork_advance_cancellations c where c.firm_id=a.firm_id and c.application_id=a.id)) then raise exception 'ACTIVE_ADVANCE_APPLICATION'; end if;
 elsif new.kind='credit_note' and new.lifecycle='issued' and old.lifecycle='draft' then
 select * into r from public._paperwork_document_remaining(new.firm_id,new.reference_id);
 select sum(net),sum(tax) into n,t from public.paperwork_business_document_lines where firm_id=new.firm_id and document_id=new.id;
 if n>r.net or t>r.tax then raise exception 'EXCESS_ADVANCE_CREDIT'; end if;
 end if; return new;
end $$;
create trigger guard_advance_reversal before insert on public.paperwork_journals for each row execute function public._paperwork_guard_advance_dependencies();
create trigger guard_advance_credit before update on public.paperwork_business_documents for each row execute function public._paperwork_guard_advance_dependencies();
revoke all on function public._paperwork_document_remaining(uuid,uuid),public._paperwork_source_account_remaining(uuid,uuid,uuid,boolean),public._paperwork_guard_advance_dependencies() from public,anon,authenticated;
revoke all on function public.paperwork_advance_workspace(uuid,uuid),public.paperwork_advance_command(text,jsonb,text) from public,anon;
grant execute on function public.paperwork_advance_workspace(uuid,uuid),public.paperwork_advance_command(text,jsonb,text) to authenticated;
commit;
