begin;
create table public.paperwork_opening_batches (
 firm_id uuid not null,id uuid not null,journal_id uuid not null,source_reference text not null check(length(trim(source_reference))>=1 and length(source_reference)<=200),
 source_tax_id text not null,file_name text not null,file_sha256 text not null check(file_sha256~'^[a-f0-9]{64}$'),posting_date date not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(firm_id,id),unique(firm_id,source_reference),unique(firm_id,journal_id),foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id)
);
create table public.paperwork_opening_balances (
 firm_id uuid not null,batch_id uuid not null,row_no integer not null,source_account text not null,source_partner text not null,account_id uuid not null,partner_id uuid,
 debit numeric(24,0) not null check(debit>=0),credit numeric(24,0) not null check(credit>=0),check((debit>0)<>(credit>0)),
 primary key(firm_id,batch_id,row_no),unique(firm_id,batch_id,source_account,source_partner),
 foreign key(firm_id,batch_id) references public.paperwork_opening_batches(firm_id,id),foreign key(firm_id,account_id) references public.paperwork_accounts(firm_id,id),foreign key(firm_id,partner_id) references public.paperwork_accounting_partners(firm_id,id)
);
create table public.paperwork_opening_items (
 firm_id uuid not null,id uuid not null,batch_id uuid not null,row_no integer not null,source_sequence integer not null check(source_sequence>0),external_id text not null,number text not null,document_date date not null,due_date date not null check(due_date>=document_date),
 direction text not null check(direction in('receivable','payable')),amount numeric(24,0) not null check(amount>0),journal_line_id text not null,
 primary key(firm_id,id),unique(firm_id,batch_id,source_sequence),unique(firm_id,batch_id,external_id),foreign key(firm_id,batch_id,row_no) references public.paperwork_opening_balances(firm_id,batch_id,row_no)
);
create table public.paperwork_opening_cancellations (
 firm_id uuid not null,batch_id uuid not null,journal_id uuid not null,reason text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,batch_id),unique(firm_id,journal_id),foreign key(firm_id,batch_id) references public.paperwork_opening_batches(firm_id,id),foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id) deferrable initially deferred
);
create table public.paperwork_opening_applications (
 firm_id uuid not null,id uuid not null,item_id uuid not null,journal_id uuid not null,line_id text not null,amount numeric(24,0) not null check(amount>0),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(firm_id,id),
 foreign key(firm_id,item_id) references public.paperwork_opening_items(firm_id,id),foreign key(firm_id,journal_id,line_id) references public.paperwork_journal_lines(firm_id,journal_id,id)
);
create table public.paperwork_opening_requests (
 firm_id uuid not null,request_key text not null,request_hash text not null,batch_id uuid not null,item_id uuid,application_id uuid,journal_id uuid not null,revision bigint not null,
 primary key(firm_id,request_key),foreign key(firm_id,batch_id) references public.paperwork_opening_batches(firm_id,id),foreign key(firm_id,item_id) references public.paperwork_opening_items(firm_id,id),foreign key(firm_id,application_id) references public.paperwork_opening_applications(firm_id,id),foreign key(firm_id,journal_id) references public.paperwork_journals(firm_id,id)
);
do $$declare t text;begin foreach t in array array['paperwork_opening_batches','paperwork_opening_balances','paperwork_opening_items','paperwork_opening_cancellations','paperwork_opening_applications','paperwork_opening_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy accounting_read on public.%I for select to authenticated using(public.paperwork_accounting_readable(firm_id))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger immutable_opening before update or delete on public.%I for each row execute function public._paperwork_accounting_immutable()',t);
end loop;end $$;
create function public._paperwork_opening_journals(f uuid) returns table(id uuid) language sql stable set search_path='' as $$
 select journal_id from public.paperwork_opening_batches where firm_id=f union select journal_id from public.paperwork_opening_cancellations where firm_id=f;
$$;
create function public._paperwork_opening_item_state(f uuid,i uuid) returns table(revision bigint,remaining numeric) language sql stable set search_path='' as $$
 select 1+count(a.id)+count(r.id),p.amount-coalesce(sum(a.amount) filter(where r.id is null),0)
 from public.paperwork_opening_items p left join public.paperwork_opening_applications a on a.firm_id=p.firm_id and a.item_id=p.id
 left join public.paperwork_journals r on r.firm_id=a.firm_id and r.reversal_of=a.journal_id where p.firm_id=f and p.id=i group by p.amount;
$$;
create function public._paperwork_opening_reversal_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.reversal_of is not null and exists(select 1 from public.paperwork_opening_batches b where b.firm_id=new.firm_id and b.journal_id=new.reversal_of and not exists(select 1 from public.paperwork_opening_cancellations c where c.firm_id=b.firm_id and c.batch_id=b.id and c.journal_id=new.id)) then raise exception 'ACTIVE_OPENING_LINK';end if;return new;
end $$;
create trigger opening_reversal_guard before insert on public.paperwork_journals for each row execute function public._paperwork_opening_reversal_guard();
create function public.paperwork_opening_command(p_action text,p_data jsonb,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare f uuid:=(p_data->>'firmId')::uuid;b uuid:=(p_data->>'batchId')::uuid;j uuid:=(p_data->>'journalId')::uuid;i uuid;app uuid;h text;r public.paperwork_opening_requests;batch public.paperwork_opening_batches;y public.paperwork_fiscal_years;
 row jsonb;oi jsonb;acc public.paperwork_accounts;ar public.paperwork_opening_balances;it public.paperwork_opening_items;line public.paperwork_journal_lines;js public.paperwork_journals;state record;
 n integer:=0;di numeric;cr numeric;dv numeric:=0;cv numeric:=0;cnt numeric;sumq numeric;amt numeric;rev bigint:=1;lines jsonb:='[]'::jsonb;d date;reason text;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if p_action not in('import','cancel','apply') or p_action is null then raise exception 'INVALID_OPENING_ACTION';end if;
 if not public.paperwork_accounting_can(f,'post_journal') or (p_action='cancel' and not public.paperwork_accounting_can(f,'reverse_journal')) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if p_key is null or length(p_key)<1 or length(p_key)>100 then raise exception 'INVALID_IDEMPOTENCY_KEY';end if;
 h:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data)::text,'UTF8')),'hex');
 select * into r from public.paperwork_opening_requests where firm_id=f and request_key=p_key;
 if found then if r.request_hash<>h then raise exception 'IDEMPOTENCY_REUSE';end if;return jsonb_build_object('firmId',f,'batchId',r.batch_id,'itemId',r.item_id,'applicationId',r.application_id,'journalId',r.journal_id,'revision',r.revision::text);end if;
 if p_action='import' then
  if p_data->>'expectedRevision' is distinct from '0' or b is null or j is null then raise exception 'STALE_REVISION';end if;
  if exists(select 1 from public.paperwork_opening_batches x where x.firm_id=f and not exists(select 1 from public.paperwork_opening_cancellations c where c.firm_id=f and c.batch_id=x.id))
   or exists(select 1 from public.paperwork_journals where firm_id=f and id not in(select id from public._paperwork_opening_journals(f))) or exists(select 1 from public.paperwork_business_documents where firm_id=f and lifecycle='issued') then raise exception 'OPENING_REQUIRES_PRISTINE_LEDGER';end if;
  select * into strict y from public.paperwork_fiscal_years where firm_id=f and id=(p_data->>'fiscalYearId')::uuid;
  if jsonb_typeof(p_data->'postingDate') is distinct from 'string' or p_data->>'postingDate' is distinct from y.starts_on::text or p_data->>'asOf' is distinct from (y.starts_on-1)::text or p_data->>'currency' is distinct from 'RSD' then raise exception 'INVALID_OPENING_DATE';end if;d:=y.starts_on;
  if p_data->>'sourceTaxId' is distinct from (select tax_id from public.paperwork_firms where id=f) or length(trim(coalesce(p_data->>'sourceReference','')))<1 or length(p_data->>'sourceReference')>200
   or length(trim(coalesce(p_data->>'fileName','')))<1 or length(p_data->>'fileName')>255 or coalesce(p_data->>'fileSha256','') !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_OPENING_SOURCE';end if;
  if jsonb_typeof(p_data->'balances') is distinct from 'array' or jsonb_array_length(p_data->'balances')<2 or jsonb_array_length(p_data->'balances')>500 or jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')>500 then raise exception 'INVALID_OPENING_ROWS';end if;
  if exists(select 1 from jsonb_array_elements(p_data->'balances') e group by e->>'sourceAccount' having count(distinct e->>'accountId')<>1)
   or exists(select 1 from jsonb_array_elements(p_data->'balances') e where e->>'sourcePartner'<>'' group by e->>'sourcePartner' having count(distinct e->>'partnerId')<>1)
   or exists(select 1 from jsonb_array_elements(p_data->'balances') e group by e->>'accountId',coalesce(e->>'partnerId','') having count(*)>1)
   or exists(select 1 from jsonb_array_elements(p_data->'items') e group by e->>'externalId' having count(*)>1) then raise exception 'INVALID_OPENING_MAPPING';end if;
  for row in select value from jsonb_array_elements(p_data->'balances') loop
   n:=n+1;select * into strict acc from public.paperwork_accounts where firm_id=f and id=(row->>'accountId')::uuid;
   if length(trim(coalesce(row->>'sourceAccount','')))<1 or length(row->>'sourceAccount')>100 or jsonb_typeof(row->'sourcePartner') is distinct from 'string' or length(row->>'sourcePartner')>100
    or acc.requires_partner<>(coalesce(row->>'sourcePartner','')<>'') or acc.requires_partner<>((row->>'partnerId') is not null) then raise exception 'INVALID_OPENING_MAPPING';end if;
   if jsonb_typeof(row->'debit') is distinct from 'string' or jsonb_typeof(row->'credit') is distinct from 'string' or (row->>'debit') !~ '^(0|[1-9][0-9]{0,23})$' or (row->>'credit') !~ '^(0|[1-9][0-9]{0,23})$' then raise exception 'INVALID_OPENING_AMOUNT';end if;
   di:=(row->>'debit')::numeric;cr:=(row->>'credit')::numeric;if (di>0)=(cr>0) then raise exception 'INVALID_OPENING_AMOUNT';end if;dv:=dv+di;cv:=cv+cr;
   if acc.requires_partner then
    select coalesce(sum((e->>'amount')::numeric) filter(where e->>'direction'='receivable'),0),coalesce(sum((e->>'amount')::numeric) filter(where e->>'direction'='payable'),0) into cnt,sumq from jsonb_array_elements(p_data->'items') e where e->>'sourceAccount'=row->>'sourceAccount' and e->>'sourcePartner'=row->>'sourcePartner';
    if cnt<>di or sumq<>cr then raise exception 'OPENING_ITEMS_BALANCE_MISMATCH';end if;
   else
    if exists(select 1 from jsonb_array_elements(p_data->'items') e where e->>'sourceAccount'=row->>'sourceAccount' and e->>'sourcePartner'=row->>'sourcePartner') then raise exception 'INVALID_OPENING_ITEM';end if;
    lines:=lines||jsonb_build_array(jsonb_build_object('id','balance-'||n,'accountId',acc.id,'debit',di::text,'credit',cr::text,'description','Opening: '||(row->>'sourceAccount')));
   end if;
  end loop;
  if dv<>cv then raise exception 'OPENING_UNBALANCED';end if;
  for oi in select value from jsonb_array_elements(p_data->'items') loop
   if jsonb_typeof(oi->'amount') is distinct from 'string' or (oi->>'amount') !~ '^[1-9][0-9]{0,23}$' or oi->>'direction' not in('receivable','payable') or length(trim(coalesce(oi->>'externalId','')))<1 or length(oi->>'externalId')>200 or length(trim(coalesce(oi->>'number','')))<1 or length(oi->>'number')>200
    or jsonb_typeof(oi->'documentDate') is distinct from 'string' or jsonb_typeof(oi->'dueDate') is distinct from 'string' or (oi->>'documentDate') !~ '^\d{4}-\d{2}-\d{2}$' or (oi->>'dueDate') !~ '^\d{4}-\d{2}-\d{2}$'
    or (oi->>'documentDate')::date>=d or (oi->>'dueDate')::date<(oi->>'documentDate')::date then raise exception 'INVALID_OPENING_ITEM';end if;
   select e into strict row from jsonb_array_elements(p_data->'balances') e where e->>'sourceAccount'=oi->>'sourceAccount' and e->>'sourcePartner'=oi->>'sourcePartner';
   if row->>'partnerId' is null then raise exception 'INVALID_OPENING_ITEM';end if;
   lines:=lines||jsonb_build_array(jsonb_build_object('id','open-'||((oi->>'id')::uuid)::text,'accountId',row->>'accountId','partnerId',row->>'partnerId','debit',case when oi->>'direction'='receivable' then oi->>'amount' else '0' end,'credit',case when oi->>'direction'='payable' then oi->>'amount' else '0' end,'description','Opening item: '||(oi->>'number')));
  end loop;
  perform public.paperwork_post_journal(jsonb_build_object('id',j,'firmId',f,'fiscalYearId',y.id,'periodId',p_data->>'periodId','postingDate',d,'description','Opening migration: '||(p_data->>'sourceReference'),'lines',lines),'0','opening:'||md5(p_key));
  insert into public.paperwork_opening_batches values(f,b,j,trim(p_data->>'sourceReference'),p_data->>'sourceTaxId',p_data->>'fileName',p_data->>'fileSha256',d,auth.uid(),now());
  n:=0;for row in select value from jsonb_array_elements(p_data->'balances') loop n:=n+1;
   insert into public.paperwork_opening_balances values(f,b,n,row->>'sourceAccount',row->>'sourcePartner',(row->>'accountId')::uuid,(row->>'partnerId')::uuid,(row->>'debit')::numeric,(row->>'credit')::numeric);
  end loop;
  n:=0;for oi in select value from jsonb_array_elements(p_data->'items') loop
   n:=n+1;select * into strict ar from public.paperwork_opening_balances where firm_id=f and batch_id=b and source_account=oi->>'sourceAccount' and source_partner=oi->>'sourcePartner';
   insert into public.paperwork_opening_items values(f,(oi->>'id')::uuid,b,ar.row_no,n,oi->>'externalId',oi->>'number',(oi->>'documentDate')::date,(oi->>'dueDate')::date,oi->>'direction',(oi->>'amount')::numeric,'open-'||((oi->>'id')::uuid)::text);
  end loop;
 else
  select * into strict batch from public.paperwork_opening_batches where firm_id=f and id=b;
  if exists(select 1 from public.paperwork_opening_cancellations where firm_id=f and batch_id=b) then raise exception 'OPENING_CANCELLED';end if;
  if p_action='cancel' then
   if p_data->>'expectedRevision' is distinct from '1' then raise exception 'STALE_REVISION';end if;
   if exists(select 1 from public.paperwork_journals where firm_id=f and id not in(select id from public._paperwork_opening_journals(f))) then raise exception 'OPENING_HAS_LATER_MOVEMENTS';end if;
   if not exists(select 1 from public.paperwork_accounting_periods p join public.paperwork_journals o on o.firm_id=p.firm_id and o.fiscal_year_id=p.fiscal_year_id where p.firm_id=f and p.id=(p_data->>'periodId')::uuid and o.id=batch.journal_id) then raise exception 'INVALID_OPENING_PERIOD';end if;
   reason:=trim(p_data->>'reason');if length(coalesce(reason,''))<1 or length(reason)>1000 then raise exception 'INVALID_REASON';end if;
   j:=md5(f::text||':'||batch.journal_id::text||':opening:'||md5(p_key))::uuid;
   insert into public.paperwork_opening_cancellations values(f,b,j,reason,auth.uid(),now());
   perform public.paperwork_reverse_journal(f,batch.journal_id,(p_data->>'periodId')::uuid,batch.posting_date,reason,'1','opening:'||md5(p_key));rev:=2;
  else
   i:=(p_data->>'itemId')::uuid;app:=(p_data->>'applicationId')::uuid;select * into strict it from public.paperwork_opening_items where firm_id=f and id=i and batch_id=b;
   select * into strict ar from public.paperwork_opening_balances where firm_id=f and batch_id=b and row_no=it.row_no;
   select * into state from public._paperwork_opening_item_state(f,i);if p_data->>'expectedRevision' is distinct from state.revision::text then raise exception 'STALE_REVISION';end if;
   select * into strict line from public.paperwork_journal_lines where firm_id=f and journal_id=j and id=p_data->>'lineId';select * into strict js from public.paperwork_journals where firm_id=f and id=j;
   if js.reversal_of is not null or js.posting_date<batch.posting_date or line.account_id<>ar.account_id or line.partner_id is distinct from ar.partner_id or exists(select 1 from public.paperwork_journals where firm_id=f and reversal_of=j)
    or j in(select id from public._paperwork_opening_journals(f)) or exists(select 1 from public.paperwork_document_journals where firm_id=f and journal_id=j)
    or exists(select 1 from public.paperwork_payment_journals where firm_id=f and journal_id=j) or exists(select 1 from public.paperwork_bank_journals where firm_id=f and journal_id=j)
    or exists(select 1 from public.paperwork_stock_movements where firm_id=f and id=j) or exists(select 1 from public.paperwork_advance_applications where firm_id=f and id=j)
    or exists(select 1 from public.paperwork_fx_positions where firm_id=f and source_journal_id=j) or exists(select 1 from public.paperwork_fx_settlements where firm_id=f and id=j) or exists(select 1 from public.paperwork_fx_revaluations where firm_id=f and journal_id=j)
    then raise exception 'INVALID_OPENING_PAYMENT';end if;
   if jsonb_typeof(p_data->'amount') is distinct from 'string' or (p_data->>'amount') !~ '^[1-9][0-9]{0,23}$' then raise exception 'INVALID_OPENING_AMOUNT';end if;amt:=(p_data->>'amount')::numeric;
   cnt:=case when it.direction='receivable' then line.credit else line.debit end;
   if amt>state.remaining or amt>cnt-coalesce((select sum(amount) from public.paperwork_opening_applications where firm_id=f and journal_id=j and line_id=line.id),0) then raise exception 'OPENING_PAYMENT_CAP';end if;
   insert into public.paperwork_opening_applications values(f,app,i,j,line.id,amt,auth.uid(),now());rev:=state.revision+1;
  end if;
 end if;
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(f,auth.uid(),'opening.'||p_action,b::text,reason);
 insert into public.paperwork_opening_requests values(f,p_key,h,b,i,app,j,rev);
 return jsonb_build_object('firmId',f,'batchId',b,'itemId',i,'applicationId',app,'journalId',j,'revision',rev::text);
end $$;
create function public.paperwork_opening_workspace(p_firm uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if (select count(*) from public.paperwork_opening_balances where firm_id=p_firm)>5000 or (select count(*) from public.paperwork_opening_items where firm_id=p_firm)>5000 or (select count(*) from public.paperwork_opening_applications where firm_id=p_firm)>10000 then raise exception 'OPENING_READ_LIMIT';end if;
 select jsonb_build_object('firmId',p_firm,'businessDate',(statement_timestamp() at time zone 'Europe/Belgrade')::date,
 'batches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'journalId',b.journal_id,'sourceReference',b.source_reference,'sourceTaxId',b.source_tax_id,'fileName',b.file_name,'fileSha256',b.file_sha256,'postingDate',b.posting_date,'cancelled',c.batch_id is not null,'reversalId',c.journal_id,'reason',c.reason) order by b.created_at,b.id) from public.paperwork_opening_batches b left join public.paperwork_opening_cancellations c on c.firm_id=b.firm_id and c.batch_id=b.id where b.firm_id=p_firm),'[]'::jsonb),
 'balances',coalesce((select jsonb_agg(jsonb_build_object('batchId',b.batch_id,'row',b.row_no,'sourceAccount',b.source_account,'sourcePartner',b.source_partner,'accountId',b.account_id,'partnerId',b.partner_id,'debit',b.debit::text,'credit',b.credit::text) order by b.batch_id,b.row_no) from public.paperwork_opening_balances b where b.firm_id=p_firm),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'batchId',i.batch_id,'row',i.row_no,'externalId',i.external_id,'number',i.number,'documentDate',i.document_date,'dueDate',i.due_date,'direction',i.direction,'amount',i.amount::text,'journalLineId',i.journal_line_id,'revision',s.revision::text,'remaining',case when exists(select 1 from public.paperwork_opening_cancellations c where c.firm_id=i.firm_id and c.batch_id=i.batch_id) then '0' else s.remaining::text end) order by i.batch_id,i.source_sequence) from public.paperwork_opening_items i cross join lateral public._paperwork_opening_item_state(p_firm,i.id) s where i.firm_id=p_firm),'[]'::jsonb),
 'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'itemId',a.item_id,'journalId',a.journal_id,'lineId',a.line_id,'amount',a.amount::text,'lineAmount',case when i.direction='receivable' then l.credit::text else l.debit::text end,'accountId',l.account_id,'partnerId',l.partner_id,'postingDate',j.posting_date,'reversed',r.id is not null,'reversalId',r.id) order by a.created_at,a.id) from public.paperwork_opening_applications a join public.paperwork_opening_items i on i.firm_id=a.firm_id and i.id=a.item_id join public.paperwork_journal_lines l on l.firm_id=a.firm_id and l.journal_id=a.journal_id and l.id=a.line_id join public.paperwork_journals j on j.firm_id=a.firm_id and j.id=a.journal_id left join public.paperwork_journals r on r.firm_id=j.firm_id and r.reversal_of=j.id where a.firm_id=p_firm),'[]'::jsonb),
 'controls',coalesce((select jsonb_agg(jsonb_build_object('accountId',p.account_id,'partnerId',p.partner_id,'balance',coalesce((select sum(debit-credit) from public.paperwork_journal_lines l where l.firm_id=p_firm and l.account_id=p.account_id and l.partner_id=p.partner_id),0)::text)) from (select distinct account_id,partner_id from public.paperwork_opening_balances where firm_id=p_firm and partner_id is not null) p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public._paperwork_opening_journals(uuid),public._paperwork_opening_item_state(uuid,uuid),public._paperwork_opening_reversal_guard() from public,anon,authenticated;
revoke all on function public.paperwork_opening_command(text,jsonb,text),public.paperwork_opening_workspace(uuid) from public,anon;
grant execute on function public.paperwork_opening_command(text,jsonb,text),public.paperwork_opening_workspace(uuid) to authenticated;
create or replace function public.paperwork_accounting_report(p_firm uuid,p_year uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare y public.paperwork_fiscal_years;result jsonb;
begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 select * into y from public.paperwork_fiscal_years where firm_id=p_firm and id=p_year;
 if not found then raise exception 'INVALID_YEAR';end if;
 if p_from is null or p_to is null or p_from>p_to or p_from<y.starts_on or p_to>y.ends_on then raise exception 'INVALID_REPORT_RANGE';end if;
 if (select count(*) from public.paperwork_journals j join public.paperwork_journal_lines l on l.firm_id=j.firm_id and l.journal_id=j.id where j.firm_id=p_firm and j.fiscal_year_id=p_year and j.posting_date between p_from and p_to)>10000
 or (select count(distinct l.account_id) from public.paperwork_journals j join public.paperwork_journal_lines l on l.firm_id=j.firm_id and l.journal_id=j.id where j.firm_id=p_firm and j.fiscal_year_id=p_year and j.posting_date<=p_to)>5000 then raise exception 'REPORT_TOO_LARGE';end if;
 with entries as (
  select j.id journal_id,j.number,j.posting_date,j.posted_at,j.description journal_description,j.reversal_of,j.reason,
   l.id line_id,l.account_id,l.account_code,l.account_name,l.partner_id,p.name partner_name,l.description,l.debit,l.credit,exists(select 1 from public._paperwork_opening_journals(p_firm) o where o.id=j.id) opening
  from public.paperwork_journals j join public.paperwork_journal_lines l on l.firm_id=j.firm_id and l.journal_id=j.id
  left join public.paperwork_accounting_partners p on p.firm_id=l.firm_id and p.id=l.partner_id
  where j.firm_id=p_firm and j.fiscal_year_id=p_year and j.posting_date<=p_to
 ), balances as (
  select account_id,coalesce(sum(debit) filter(where posting_date<p_from or opening),0) od,coalesce(sum(credit) filter(where posting_date<p_from or opening),0) oc,
   coalesce(sum(debit) filter(where posting_date>=p_from and not opening),0) d,coalesce(sum(credit) filter(where posting_date>=p_from and not opening),0) c
  from entries group by account_id
 ), accounts as (select b.*,a.code,a.name from balances b join public.paperwork_accounts a on a.firm_id=p_firm and a.id=b.account_id)
 select jsonb_build_object('firmId',p_firm,'firmName',(select name from public.paperwork_firms where id=p_firm),
  'yearId',p_year,'yearLabel',y.label,'yearStart',y.starts_on::text,'yearEnd',y.ends_on::text,'from',p_from::text,'to',p_to::text,'currency','RSD','generatedAt',statement_timestamp(),
  'journalCount',(select count(distinct journal_id)::text from entries where posting_date>=p_from),'lineCount',(select count(*)::text from entries where posting_date>=p_from),
  'lines',(select coalesce(jsonb_agg(jsonb_build_object('journalId',journal_id,'number',number,'postingDate',posting_date::text,'postedAt',posted_at,'journalDescription',journal_description,'reversalOf',reversal_of,'reason',reason,
   'lineId',line_id,'accountId',account_id,'accountCode',account_code,'accountName',account_name,'partnerId',partner_id,'partnerName',partner_name,'description',description,'opening',opening,'debit',debit::text,'credit',credit::text)
   order by posting_date,posted_at,journal_id,line_id),'[]'::jsonb) from entries where posting_date>=p_from),
  'accounts',(select coalesce(jsonb_agg(jsonb_build_object('accountId',account_id,'code',code,'name',name,'openingDebit',od::text,'openingCredit',oc::text,'debit',d::text,'credit',c::text,
   'openingBalance',(od-oc)::text,'closingBalance',(od+d-oc-c)::text) order by code,account_id),'[]'::jsonb) from accounts),
  'totals',(select jsonb_build_object('openingDebit',coalesce(sum(od),0)::text,'openingCredit',coalesce(sum(oc),0)::text,'debit',coalesce(sum(d),0)::text,'credit',coalesce(sum(c),0)::text,
   'openingBalanceDebit',coalesce(sum(greatest(od-oc,0)),0)::text,'openingBalanceCredit',coalesce(sum(greatest(oc-od,0)),0)::text,
   'closingBalanceDebit',coalesce(sum(greatest(od+d-oc-c,0)),0)::text,'closingBalanceCredit',coalesce(sum(greatest(oc+c-od-d,0)),0)::text) from accounts)
 ) into result;
 return result;
end $$;

create or replace function public.paperwork_partner_report(p_firm uuid,p_partner uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare result jsonb;today date:=(statement_timestamp() at time zone 'Europe/Belgrade')::date;
begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if p_partner is not null and not exists(select 1 from public.paperwork_accounting_partners where firm_id=p_firm and id=p_partner) then raise exception 'INVALID_PARTNER';end if;
 if (select count(*) from public.paperwork_journal_lines where firm_id=p_firm and partner_id is not null and (p_partner is null or partner_id=p_partner))>10000
 or (select count(*) from public.paperwork_business_documents where firm_id=p_firm and lifecycle='issued' and kind in ('invoice','advance') and (p_partner is null or partner_id=p_partner))>5000 then raise exception 'REPORT_TOO_LARGE';end if;
 with linked_base as (
  select journal_id from public.paperwork_document_journals where firm_id=p_firm
  union select id from public.paperwork_advance_applications where firm_id=p_firm
  union select journal_id from public.paperwork_payment_journals where firm_id=p_firm
  union select id from public._paperwork_opening_journals(p_firm)
 ), linked as (
  select journal_id from linked_base union select id from public.paperwork_journals where firm_id=p_firm and reversal_of in(select journal_id from linked_base)
 ), entries as (
  select l.*,j.number,j.posting_date,j.posted_at,j.reversal_of,j.reason,j.description journal_description,p.name partner_name,exists(select 1 from linked k where k.journal_id=j.id) linked
  from public.paperwork_journal_lines l join public.paperwork_journals j on j.firm_id=l.firm_id and j.id=l.journal_id
  join public.paperwork_accounting_partners p on p.firm_id=l.firm_id and p.id=l.partner_id
  where l.firm_id=p_firm and (p_partner is null or l.partner_id=p_partner)
 ), balances as (
  select partner_id,account_id,sum(debit) d,sum(credit) c,coalesce(sum(debit-credit) filter(where linked),0) linked_balance from entries group by partner_id,account_id
 ), docs as (
  select d.*,public._paperwork_payment_balance(p_firm,d.id) evidence,dj.journal_id,
   case when dj.journal_id is null then 'unposted' when exists(select 1 from public.paperwork_journals r where r.firm_id=p_firm and r.reversal_of=dj.journal_id) then 'reversed' else 'active' end source_status
  from public.paperwork_business_documents d left join public.paperwork_document_journals dj on dj.firm_id=d.firm_id and dj.document_id=d.id
  where d.firm_id=p_firm and d.lifecycle='issued' and d.kind in ('invoice','advance') and (p_partner is null or d.partner_id=p_partner)
 ), document_accounts as (
  select distinct d.id document_id,l.account_id from docs d join public.paperwork_journal_lines l on l.firm_id=d.firm_id and l.journal_id=d.journal_id and l.partner_id=d.partner_id
  join public.paperwork_accounts a on a.firm_id=l.firm_id and a.id=l.account_id where a.requires_partner and d.kind='invoice'
 ), document_base as (
  select d.id document_id,j.journal_id from docs d join public.paperwork_document_journals j on j.firm_id=d.firm_id and j.document_id=d.id
  union select d.id,j.journal_id from docs d join public.paperwork_business_documents c on c.firm_id=d.firm_id and c.reference_id=d.id and c.lifecycle='issued' join public.paperwork_document_journals j on j.firm_id=c.firm_id and j.document_id=c.id
  union select d.id,a.id from docs d join public.paperwork_advance_applications a on a.firm_id=d.firm_id and a.invoice_id=d.id
  union select d.id,j.journal_id from docs d join public.paperwork_payment_allocations a on a.firm_id=d.firm_id and a.document_id=d.id join public.paperwork_payment_journals j on j.firm_id=a.firm_id and j.allocation_id=a.id
 ), document_links as (
  select * from document_base union select b.document_id,r.id from document_base b join public.paperwork_journals r on r.firm_id=p_firm and r.reversal_of=b.journal_id
 ), amounts as (
  select d.*,
   case when d.kind='invoice' then coalesce((select sum(l.debit-l.credit) from document_links k join public.paperwork_journal_lines l on l.firm_id=p_firm and l.journal_id=k.journal_id where k.document_id=d.id and l.partner_id=d.partner_id and l.account_id in(select a.account_id from document_accounts a where a.document_id=d.id)),0) else null end ledger_balance,
   ((d.evidence->>'due')::numeric-(d.evidence->>'overpaid')::numeric)*case when d.direction='outgoing' then 1 else -1 end expected_balance,
   exists(select 1 from document_accounts a where a.document_id=d.id) has_control_account,
   (select count(*) from public.paperwork_business_documents c left join public.paperwork_document_journals j on j.firm_id=c.firm_id and j.document_id=c.id where c.firm_id=p_firm and c.reference_id=d.id and c.lifecycle='issued' and (j.journal_id is null or exists(select 1 from public.paperwork_journals r where r.firm_id=p_firm and r.reversal_of=j.journal_id)))
   +(select count(*) from public.paperwork_payment_allocations a left join public.paperwork_payment_journals j on j.firm_id=a.firm_id and j.allocation_id=a.id where a.firm_id=p_firm and a.document_id=d.id and public._paperwork_payment_active(p_firm,a.id) and (j.journal_id is null or exists(select 1 from public.paperwork_journals r where r.firm_id=p_firm and r.reversal_of=j.journal_id))) unposted_evidence_count,
   coalesce((select sum(a.net+a.tax) from public.paperwork_advance_applications a where a.firm_id=p_firm and a.advance_id=d.id and not exists(select 1 from public.paperwork_advance_cancellations c where c.firm_id=a.firm_id and c.application_id=a.id)),0) applied_out
  from docs d
 )
 select jsonb_build_object('firmId',p_firm,'firmName',(select name from public.paperwork_firms where id=p_firm),'partnerId',p_partner,'currency','RSD','generatedAt',statement_timestamp(),'businessDate',today::text,
  'lines',(select coalesce(jsonb_agg(jsonb_build_object('journalId',journal_id,'lineId',id,'number',number,'postingDate',posting_date::text,'postedAt',posted_at,'reversalOf',reversal_of,'reason',reason,'description',description,'journalDescription',journal_description,'partnerId',partner_id,'partnerName',partner_name,'accountId',account_id,'accountCode',account_code,'accountName',account_name,'debit',debit::text,'credit',credit::text,'linked',linked) order by posting_date,posted_at,journal_id,id),'[]'::jsonb) from entries),
  'accounts',(select coalesce(jsonb_agg(jsonb_build_object('partnerId',b.partner_id,'partnerName',p.name,'accountId',b.account_id,'code',a.code,'name',a.name,'debit',b.d::text,'credit',b.c::text,'balance',(b.d-b.c)::text,'linkedBalance',b.linked_balance::text,'unlinkedBalance',(b.d-b.c-b.linked_balance)::text) order by p.name,b.partner_id,a.code,b.account_id),'[]'::jsonb) from balances b join public.paperwork_accounts a on a.firm_id=p_firm and a.id=b.account_id join public.paperwork_accounting_partners p on p.firm_id=p_firm and p.id=b.partner_id),
  'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'partnerId',partner_id,'partnerName',partner_name,'number',number,'direction',direction,'kind',kind,'documentDate',document_date::text,'dueDate',due_date::text,'evidence',evidence,'sourceStatus',source_status,'hasControlAccount',has_control_account,
   'controlAccountIds',(select coalesce(jsonb_agg(a.account_id order by a.account_id),'[]'::jsonb) from document_accounts a where a.document_id=amounts.id),
   'journalIds',case when kind='invoice' then (select coalesce(jsonb_agg(k.journal_id order by k.journal_id),'[]'::jsonb) from document_links k where k.document_id=amounts.id) else '[]'::jsonb end,
   'ledgerBalance',ledger_balance::text,'expectedBalance',expected_balance::text,'difference',(ledger_balance-expected_balance)::text,'unpostedEvidenceCount',unposted_evidence_count::text,'appliedOut',applied_out::text) order by due_date,id),'[]'::jsonb) from amounts)
 ) into result;
 return result||jsonb_build_object('migration',public.paperwork_opening_workspace(p_firm));
end $$;

commit;
