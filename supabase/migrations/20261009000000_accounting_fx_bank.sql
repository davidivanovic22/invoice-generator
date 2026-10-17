begin;
-- Declared foreign-currency Excel statements, immutable metadata; import never posts journals.
create table public.paperwork_fx_bank_accounts (
 firm_id uuid not null references public.paperwork_firms(id),id uuid not null,
 name text not null check(length(trim(name)) between 1 and 200),
 number text not null check(length(number) between 5 and 64 and number ~ '^[A-Z0-9]+$'),
 currency text not null check(currency in('EUR','USD','CHF','GBP')),cash_account_id uuid not null,
 foreign key(firm_id,cash_account_id) references public.paperwork_accounts(firm_id,id),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,id),unique(firm_id,number)
);
create table public.paperwork_fx_bank_account_requests (
 firm_id uuid not null,request_key text not null check(length(request_key) between 1 and 100),request_hash text not null,account_id uuid not null,
 primary key(firm_id,request_key),foreign key(firm_id,account_id) references public.paperwork_fx_bank_accounts(firm_id,id)
);
create table public.paperwork_fx_bank_statements (
 firm_id uuid not null,id uuid not null default gen_random_uuid(),bank_account_id uuid not null,fiscal_year_id uuid not null,
 reference text not null check(length(trim(reference)) between 1 and 100),starts_on date not null,ends_on date not null check(ends_on>=starts_on),
 opening numeric(24,0) not null,closing numeric(24,0) not null,content_hash text not null,
 imported_by uuid not null references auth.users(id),imported_at timestamptz not null default now(),
 primary key(firm_id,id),unique(firm_id,bank_account_id,fiscal_year_id,reference),unique(firm_id,id,bank_account_id),
 foreign key(firm_id,bank_account_id) references public.paperwork_fx_bank_accounts(firm_id,id),
 foreign key(firm_id,fiscal_year_id) references public.paperwork_fiscal_years(firm_id,id)
);
create table public.paperwork_fx_bank_transactions (
 firm_id uuid not null,id uuid not null default gen_random_uuid(),bank_account_id uuid not null,
 external_id text not null check(length(trim(external_id)) between 1 and 100),booking_date date not null,value_date date not null,
 incoming numeric(24,0) not null check(incoming>=0),outgoing numeric(24,0) not null check(outgoing>=0),
 counterparty text not null check(length(counterparty)<=500),reference text not null check(length(reference)<=500),description text not null check(length(description)<=1000),content_hash text not null,
 primary key(firm_id,id),unique(firm_id,bank_account_id,external_id),unique(firm_id,id,bank_account_id),
 foreign key(firm_id,bank_account_id) references public.paperwork_fx_bank_accounts(firm_id,id),check((incoming>0 and outgoing=0) or (outgoing>0 and incoming=0))
);
create index paperwork_fx_bank_transaction_dates on public.paperwork_fx_bank_transactions(firm_id,bank_account_id,booking_date);
create table public.paperwork_fx_bank_statement_lines (
 firm_id uuid not null,statement_id uuid not null,bank_account_id uuid not null,transaction_id uuid not null,position integer not null check(position>=0),
 primary key(firm_id,statement_id,transaction_id),unique(firm_id,statement_id,position),
 foreign key(firm_id,statement_id,bank_account_id) references public.paperwork_fx_bank_statements(firm_id,id,bank_account_id),
 foreign key(firm_id,transaction_id,bank_account_id) references public.paperwork_fx_bank_transactions(firm_id,id,bank_account_id)
);
create table public.paperwork_fx_bank_import_requests (
 firm_id uuid not null,request_key text not null check(length(request_key) between 1 and 100),request_hash text not null,statement_id uuid not null,
 new_count integer not null check(new_count>=0),reused_count integer not null check(reused_count>=0),previously_imported boolean not null,
 primary key(firm_id,request_key),foreign key(firm_id,statement_id) references public.paperwork_fx_bank_statements(firm_id,id)
);
do $$ declare t text; begin
 foreach t in array array['paperwork_fx_bank_accounts','paperwork_fx_bank_account_requests','paperwork_fx_bank_statements','paperwork_fx_bank_transactions','paperwork_fx_bank_statement_lines','paperwork_fx_bank_import_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy accounting_read on public.%I for select to authenticated using(public.paperwork_accounting_readable(firm_id))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger immutable_bank before update or delete on public.%I for each row execute function public._paperwork_accounting_immutable()',t);
 end loop;
end $$;

create function public.paperwork_create_fx_bank_account(p_data jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare f uuid:=(p_data->>'firmId')::uuid;j uuid:=(p_data->>'id')::uuid;h text;r public.paperwork_fx_bank_account_requests;begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'manage_chart') then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
 h:=encode(sha256(convert_to(p_data::text,'UTF8')),'hex');select * into r from public.paperwork_fx_bank_account_requests where firm_id=f and request_key=p_key;
 if found then if h<>r.request_hash then raise exception 'IDEMPOTENCY_REUSE'; end if;return jsonb_build_object('firmId',f,'accountId',r.account_id);end if;
 if coalesce(p_data->>'currency','') not in('EUR','USD','CHF','GBP') then raise exception 'INVALID_CURRENCY';end if;
 if not exists(select 1 from public.paperwork_accounts where firm_id=f and id=(p_data->>'cashAccountId')::uuid and active and allows_posting and not requires_partner) then raise exception 'INVALID_FX_ACCOUNT';end if;
 insert into public.paperwork_fx_bank_accounts values(f,j,trim(p_data->>'name'),p_data->>'number',p_data->>'currency',(p_data->>'cashAccountId')::uuid,auth.uid(),now());
 insert into public.paperwork_fx_bank_account_requests values(f,p_key,h,j);
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id) values(f,auth.uid(),'bank.account_created',j::text);
 return jsonb_build_object('firmId',f,'accountId',j);
end $$;

create function public.paperwork_import_fx_bank_statement(p_data jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_data->>'firmId')::uuid;a uuid:=(p_data->>'bankAccountId')::uuid;y public.paperwork_fiscal_years;
 request public.paperwork_fx_bank_import_requests;statement public.paperwork_fx_bank_statements;tx public.paperwork_fx_bank_transactions;
 item jsonb;canonical jsonb:='[]'::jsonb;normalized jsonb;h text;content text;th text;s date;e date;n numeric:=0;o numeric:=0;balance_open numeric;balance_close numeric;fresh integer:=0;reused integer:=0;pos integer:=0;duplicate boolean:=false;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY';end if;
 h:=encode(sha256(convert_to(p_data::text,'UTF8')),'hex');select * into request from public.paperwork_fx_bank_import_requests where firm_id=f and request_key=p_key;
 if found then
 if h<>request.request_hash then raise exception 'IDEMPOTENCY_REUSE';end if;
 select * into strict statement from public.paperwork_fx_bank_statements where firm_id=f and id=request.statement_id;
 return jsonb_build_object('firmId',f,'accountId',a,'statementId',statement.id,'newCount',request.new_count,'reusedCount',request.reused_count,'previouslyImported',request.previously_imported);
 end if;
 if not exists(select 1 from public.paperwork_fx_bank_accounts where firm_id=f and id=a) then raise exception 'INVALID_BANK_ACCOUNT';end if;
 select * into strict y from public.paperwork_fiscal_years where firm_id=f and id=(p_data->>'fiscalYearId')::uuid;
 if jsonb_typeof(p_data->'startsOn') is distinct from 'string' or jsonb_typeof(p_data->'endsOn') is distinct from 'string' or (p_data->>'startsOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (p_data->>'endsOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or jsonb_typeof(p_data->'reference') is distinct from 'string' then raise exception 'INVALID_STATEMENT';end if;
 s:=(p_data->>'startsOn')::date;e:=(p_data->>'endsOn')::date;
 if s is null or e is null or e<s or s<y.starts_on or e>y.ends_on or length(trim(coalesce(p_data->>'reference',''))) not between 1 and 100 then raise exception 'INVALID_STATEMENT';end if;
 if jsonb_typeof(p_data->'opening') is distinct from 'string' or jsonb_typeof(p_data->'closing') is distinct from 'string' or (p_data->>'opening') !~ '^-?(0|[1-9][0-9]{0,23})$' or (p_data->>'closing') !~ '^-?(0|[1-9][0-9]{0,23})$' or p_data->>'opening'='-0' or p_data->>'closing'='-0' then raise exception 'INVALID_AMOUNT';end if;
 balance_open:=(p_data->>'opening')::numeric;balance_close:=(p_data->>'closing')::numeric;
 if jsonb_typeof(p_data->'rows') is distinct from 'array' or jsonb_array_length(p_data->'rows') not between 1 and 2000 then raise exception 'INVALID_STATEMENT_ROWS';end if;
 if exists(select 1 from jsonb_array_elements(p_data->'rows') r group by trim(r->>'externalId') having count(*)>1) then raise exception 'DUPLICATE_BANK_ROW';end if;
 for item in select value from jsonb_array_elements(p_data->'rows') loop
 if jsonb_typeof(item->'externalId') is distinct from 'string' or jsonb_typeof(item->'bookingDate') is distinct from 'string' or jsonb_typeof(item->'valueDate') is distinct from 'string' or (item->>'bookingDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (item->>'valueDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or jsonb_typeof(item->'counterparty') is distinct from 'string' or jsonb_typeof(item->'reference') is distinct from 'string' or jsonb_typeof(item->'description') is distinct from 'string' then raise exception 'INVALID_BANK_ROW';end if;
 if length(trim(coalesce(item->>'externalId',''))) not between 1 and 100 or (item->>'bookingDate')::date is null or (item->>'valueDate')::date is null or (item->>'bookingDate')::date not between s and e
 or jsonb_typeof(item->'incoming') is distinct from 'string' or jsonb_typeof(item->'outgoing') is distinct from 'string' or (item->>'incoming') !~ '^(0|[1-9][0-9]{0,23})$' or (item->>'outgoing') !~ '^(0|[1-9][0-9]{0,23})$' then raise exception 'INVALID_BANK_ROW';end if;
 if not (((item->>'incoming')::numeric>0 and (item->>'outgoing')::numeric=0) or ((item->>'outgoing')::numeric>0 and (item->>'incoming')::numeric=0)) then raise exception 'INVALID_BANK_ROW';end if;
 if length(coalesce(item->>'counterparty',''))>500 or length(coalesce(item->>'reference',''))>500 or length(coalesce(item->>'description',''))>1000 then raise exception 'INVALID_BANK_ROW';end if;
 normalized:=jsonb_build_object('externalId',trim(item->>'externalId'),'bookingDate',((item->>'bookingDate')::date)::text,'valueDate',((item->>'valueDate')::date)::text,'incoming',item->>'incoming','outgoing',item->>'outgoing','counterparty',trim(coalesce(item->>'counterparty','')),'reference',trim(coalesce(item->>'reference','')),'description',trim(coalesce(item->>'description','')));
 canonical:=canonical||jsonb_build_array(normalized);n:=n+(item->>'incoming')::numeric;o:=o+(item->>'outgoing')::numeric;
 end loop;
 if n>=1e24 or o>=1e24 or balance_open+n-o<>balance_close then raise exception 'BANK_BALANCE_MISMATCH';end if;
 content:=encode(sha256(convert_to(jsonb_build_object('version',1,'account',a,'year',y.id,'reference',trim(p_data->>'reference'),'startsOn',s,'endsOn',e,'opening',balance_open::text,'closing',balance_close::text,'rows',(select jsonb_agg(value order by (value->>'externalId') collate "C") from jsonb_array_elements(canonical)))::text,'UTF8')),'hex');
 select * into statement from public.paperwork_fx_bank_statements where firm_id=f and bank_account_id=a and fiscal_year_id=y.id and reference=trim(p_data->>'reference');
 if found then
 if content<>statement.content_hash then raise exception 'BANK_STATEMENT_CONFLICT';end if;
 duplicate:=true;reused:=jsonb_array_length(canonical);
 else
 if exists(select 1 from public.paperwork_fx_bank_statements where firm_id=f and bank_account_id=a and starts_on<=e and ends_on>=s) then raise exception 'FX_BANK_OVERLAP';end if;
 insert into public.paperwork_fx_bank_statements(firm_id,bank_account_id,fiscal_year_id,reference,starts_on,ends_on,opening,closing,content_hash,imported_by) values(f,a,y.id,trim(p_data->>'reference'),s,e,balance_open,balance_close,content,auth.uid()) returning * into statement;
 for item in select value from jsonb_array_elements(canonical) loop
 th:=encode(sha256(convert_to(item::text,'UTF8')),'hex');select * into tx from public.paperwork_fx_bank_transactions where firm_id=f and bank_account_id=a and external_id=item->>'externalId';
 if found then
 if tx.content_hash<>th then raise exception 'BANK_TRANSACTION_CONFLICT';end if;reused:=reused+1;
 else
 insert into public.paperwork_fx_bank_transactions(firm_id,bank_account_id,external_id,booking_date,value_date,incoming,outgoing,counterparty,reference,description,content_hash) values(f,a,item->>'externalId',(item->>'bookingDate')::date,(item->>'valueDate')::date,(item->>'incoming')::numeric,(item->>'outgoing')::numeric,item->>'counterparty',item->>'reference',item->>'description',th) returning * into tx;fresh:=fresh+1;
 end if;
 insert into public.paperwork_fx_bank_statement_lines values(f,statement.id,a,tx.id,pos);pos:=pos+1;
 end loop;
 end if;
 insert into public.paperwork_fx_bank_import_requests values(f,p_key,h,statement.id,fresh,reused,duplicate);
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id) values(f,auth.uid(),'bank.statement_imported',statement.id::text);
 return jsonb_build_object('firmId',f,'accountId',a,'statementId',statement.id,'newCount',fresh,'reusedCount',reused,'previouslyImported',duplicate);
end $$;

create function public.paperwork_fx_bank_workspace(p_firm uuid,p_year uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if (select count(*) from public.paperwork_fx_bank_statements where firm_id=p_firm and fiscal_year_id=p_year)>500 then raise exception 'FX_BANK_READ_LIMIT';end if;
 if not exists(select 1 from public.paperwork_fiscal_years where firm_id=p_firm and id=p_year) then raise exception 'INVALID_YEAR';end if;
 return jsonb_build_object('firmId',p_firm,'yearId',p_year,
 'accounts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'number',number,'currency',currency,'cashAccountId',cash_account_id) order by name,id),'[]'::jsonb) from public.paperwork_fx_bank_accounts where firm_id=p_firm),
 'statements',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'accountId',s.bank_account_id,'reference',s.reference,'startsOn',s.starts_on::text,'endsOn',s.ends_on::text,'opening',s.opening::text,'closing',s.closing::text,'rowCount',(select count(*) from public.paperwork_fx_bank_statement_lines where firm_id=p_firm and statement_id=s.id)) order by s.ends_on desc,s.id),'[]'::jsonb) from (select * from public.paperwork_fx_bank_statements where firm_id=p_firm and fiscal_year_id=p_year order by ends_on desc,id) s));
end $$;
create function public.paperwork_read_fx_bank_statement(p_firm uuid,p_statement uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare s public.paperwork_fx_bank_statements;begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 select * into strict s from public.paperwork_fx_bank_statements where firm_id=p_firm and id=p_statement;
 return jsonb_build_object('firmId',p_firm,'statementId',s.id,'accountId',s.bank_account_id,'yearId',s.fiscal_year_id,'reference',s.reference,'startsOn',s.starts_on::text,'endsOn',s.ends_on::text,'opening',s.opening::text,'closing',s.closing::text,
 'rows',(select jsonb_agg(jsonb_build_object('id',t.id,'externalId',t.external_id,'bookingDate',t.booking_date::text,'valueDate',t.value_date::text,'incoming',t.incoming::text,'outgoing',t.outgoing::text,'counterparty',t.counterparty,'reference',t.reference,'description',t.description) order by l.position) from public.paperwork_fx_bank_statement_lines l join public.paperwork_fx_bank_transactions t on t.firm_id=l.firm_id and t.id=l.transaction_id where l.firm_id=p_firm and l.statement_id=p_statement));
end $$;
revoke all on function public.paperwork_create_fx_bank_account(jsonb,text),public.paperwork_import_fx_bank_statement(jsonb,text),public.paperwork_fx_bank_workspace(uuid,uuid),public.paperwork_read_fx_bank_statement(uuid,uuid) from public,anon;
grant execute on function public.paperwork_create_fx_bank_account(jsonb,text),public.paperwork_import_fx_bank_statement(jsonb,text),public.paperwork_fx_bank_workspace(uuid,uuid),public.paperwork_read_fx_bank_statement(uuid,uuid) to authenticated;

create table public.paperwork_fx_bank_links (
 firm_id uuid not null,transaction_id uuid not null,settlement_id uuid not null,
 request_key text not null check(length(request_key) between 1 and 100),request_hash text not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,transaction_id),unique(firm_id,settlement_id),unique(firm_id,request_key),
 foreign key(firm_id,transaction_id) references public.paperwork_fx_bank_transactions(firm_id,id),
 foreign key(firm_id,settlement_id) references public.paperwork_fx_settlements(firm_id,id)
);
alter table public.paperwork_fx_bank_links enable row level security;
create policy accounting_read on public.paperwork_fx_bank_links for select to authenticated using(public.paperwork_accounting_readable(firm_id));
revoke all on public.paperwork_fx_bank_links from public,anon,authenticated;
grant select on public.paperwork_fx_bank_links to authenticated;
create trigger immutable_fx_bank_link before update or delete on public.paperwork_fx_bank_links for each row execute function public._paperwork_accounting_immutable();

-- Shared bank identities cannot refer to RSD and foreign accounts simultaneously.
create function public._paperwork_fx_bank_identity_guard() returns trigger language plpgsql security definer set search_path='' as $$ begin
 perform 1 from public.paperwork_firms where id=new.firm_id for update;
 if tg_table_name='paperwork_fx_bank_accounts' then
 if exists(select 1 from public.paperwork_fx_settlements where firm_id=new.firm_id and source_account=new.number
 and (currency<>new.currency or cash_account_id<>new.cash_account_id)) then raise exception 'FX_BANK_PAYMENT_CONFLICT';end if;
 end if;
 if (tg_table_name='paperwork_bank_accounts' and exists(select 1 from public.paperwork_fx_bank_accounts where firm_id=new.firm_id and number=new.number))
 or (tg_table_name='paperwork_fx_bank_accounts' and exists(select 1 from public.paperwork_bank_accounts where firm_id=new.firm_id and number=new.number)) then raise exception 'FX_BANK_IDENTITY_CONFLICT';end if;
 return new;
end $$;
create trigger fx_bank_identity before insert on public.paperwork_bank_accounts for each row execute function public._paperwork_fx_bank_identity_guard();
create trigger fx_bank_identity before insert on public.paperwork_fx_bank_accounts for each row execute function public._paperwork_fx_bank_identity_guard();

create function public._paperwork_fx_bank_matches(a public.paperwork_fx_bank_accounts,t public.paperwork_fx_bank_transactions,s public.paperwork_fx_settlements) returns boolean
language sql stable set search_path='' as $$
 select a.firm_id=t.firm_id and a.firm_id=s.firm_id and a.id=t.bank_account_id
 and a.number=s.source_account and t.external_id=s.source_id and a.currency=s.currency
 and a.cash_account_id=s.cash_account_id and t.booking_date=s.posting_date
 and t.incoming+t.outgoing=s.foreign_minor
 and exists(select 1 from public.paperwork_fx_positions p where p.firm_id=s.firm_id and p.id=s.position_id
 and ((p.direction='receivable' and t.incoming>0) or (p.direction='payable' and t.outgoing>0)))
$$;
-- Validate in both arrival orders: manual payment then import, or import then payment.
create function public._paperwork_fx_bank_payment_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.paperwork_fx_bank_accounts;t public.paperwork_fx_bank_transactions;s public.paperwork_fx_settlements;begin
 perform 1 from public.paperwork_firms where id=new.firm_id for update;
 if tg_table_name='paperwork_fx_bank_transactions' then
 select * into strict a from public.paperwork_fx_bank_accounts where firm_id=new.firm_id and id=new.bank_account_id;
 select * into s from public.paperwork_fx_settlements where firm_id=new.firm_id and source_account=a.number and source_id=new.external_id;
 if found and not public._paperwork_fx_bank_matches(a,new,s) then raise exception 'FX_BANK_PAYMENT_CONFLICT';end if;
 else
 select * into a from public.paperwork_fx_bank_accounts where firm_id=new.firm_id and number=new.source_account;
 if found then
 if a.currency<>new.currency or a.cash_account_id<>new.cash_account_id then raise exception 'FX_BANK_PAYMENT_CONFLICT';end if;
 select * into t from public.paperwork_fx_bank_transactions where firm_id=new.firm_id and bank_account_id=a.id and external_id=new.source_id;
 if found and not public._paperwork_fx_bank_matches(a,t,new) then raise exception 'FX_BANK_PAYMENT_CONFLICT';end if;
 end if;
 end if;return new;
end $$;
create trigger fx_bank_payment before insert on public.paperwork_fx_bank_transactions for each row execute function public._paperwork_fx_bank_payment_guard();
create trigger fx_bank_payment before insert on public.paperwork_fx_settlements for each row execute function public._paperwork_fx_bank_payment_guard();

create function public.paperwork_link_fx_bank_payment(p_data jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=(p_data->>'firmId')::uuid;t public.paperwork_fx_bank_transactions;a public.paperwork_fx_bank_accounts;
 s public.paperwork_fx_settlements;r public.paperwork_fx_bank_links;h text;begin
 perform 1 from public.paperwork_firms where id=f for update;
 if not public.paperwork_accounting_can(f,'post_journal') then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'INVALID_IDEMPOTENCY_KEY';end if;
 h:=encode(sha256(convert_to(p_data::text,'UTF8')),'hex');
 select * into r from public.paperwork_fx_bank_links where firm_id=f and request_key=p_key;
 if found then
 if r.request_hash<>h then raise exception 'IDEMPOTENCY_REUSE';end if;
 return jsonb_build_object('firmId',f,'transactionId',r.transaction_id,'settlementId',r.settlement_id);
 end if;
 select * into strict t from public.paperwork_fx_bank_transactions where firm_id=f and id=(p_data->>'transactionId')::uuid;
 select * into strict a from public.paperwork_fx_bank_accounts where firm_id=f and id=t.bank_account_id;
 select * into strict s from public.paperwork_fx_settlements where firm_id=f and id=(p_data->>'settlementId')::uuid;
 if not public._paperwork_fx_bank_matches(a,t,s) then raise exception 'FX_BANK_PAYMENT_CONFLICT';end if;
 if exists(select 1 from public.paperwork_fx_settlement_cancellations where firm_id=f and settlement_id=s.id) then raise exception 'FX_BANK_PAYMENT_CANCELLED';end if;
 insert into public.paperwork_fx_bank_links values(f,t.id,s.id,p_key,h,auth.uid(),now());
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id) values(f,auth.uid(),'fx.bank_payment_linked',t.id::text);
 return jsonb_build_object('firmId',f,'transactionId',t.id,'settlementId',s.id);
end $$;

-- Single snapshot: exact source match candidates and cancellation-aware saved links.
create function public.paperwork_fx_bank_reconciliation(p_firm uuid,p_statement uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;a public.paperwork_fx_bank_accounts;begin
 result:=public.paperwork_read_fx_bank_statement(p_firm,p_statement);
 select * into strict a from public.paperwork_fx_bank_accounts where firm_id=p_firm and id=(result->>'accountId')::uuid;
 return result || jsonb_build_object('currency',a.currency,'number',a.number,'cashAccountId',a.cash_account_id,
 'links',(select coalesce(jsonb_agg(jsonb_build_object('transactionId',t.id,'settlementId',s.id,'linked',l.transaction_id is not null,
 'cancelled',exists(select 1 from public.paperwork_fx_settlement_cancellations c where c.firm_id=p_firm and c.settlement_id=s.id)) order by t.id),'[]'::jsonb)
 from public.paperwork_fx_bank_statement_lines sl join public.paperwork_fx_bank_transactions t on t.firm_id=sl.firm_id and t.id=sl.transaction_id
 join public.paperwork_fx_settlements s on s.firm_id=t.firm_id and s.source_account=a.number and s.source_id=t.external_id
 left join public.paperwork_fx_bank_links l on l.firm_id=t.firm_id and l.transaction_id=t.id
 where sl.firm_id=p_firm and sl.statement_id=p_statement and public._paperwork_fx_bank_matches(a,t,s)));
end $$;
revoke all on function public._paperwork_fx_bank_identity_guard(),public._paperwork_fx_bank_payment_guard(),public._paperwork_fx_bank_matches(public.paperwork_fx_bank_accounts,public.paperwork_fx_bank_transactions,public.paperwork_fx_settlements) from public,anon,authenticated;
revoke all on function public.paperwork_link_fx_bank_payment(jsonb,text),public.paperwork_fx_bank_reconciliation(uuid,uuid) from public,anon;
grant execute on function public.paperwork_link_fx_bank_payment(jsonb,text),public.paperwork_fx_bank_reconciliation(uuid,uuid) to authenticated;
commit;

