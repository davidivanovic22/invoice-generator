begin;
create table public.paperwork_tax_policies (
 id text primary key,valid_from date not null,valid_to date not null,law_sha256 text not null,bylaw_sha256 text not null,
 check(valid_from<=valid_to),check(law_sha256 ~ '^[0-9a-f]{64}$'),check(bylaw_sha256 ~ '^[0-9a-f]{64}$')
);
insert into public.paperwork_tax_policies values('rs-vat-reference-2026-v1','2026-01-01','2026-12-31','a03ad9356664763f1d487bcc3d8ca0795ce9c0b4cf8b8f00f6dd0e3e39f8d8e0','f89f574dc7e0d242514a512432b92709f295b24f308ce410c16aad06a64431de');
create table public.paperwork_tax_profiles (
 firm_id uuid not null references public.paperwork_firms(id),id uuid not null,legal_form text not null check(legal_form in('doo','sole_trader')),
 regime text not null check(regime in('regular_vat','small_taxpayer')),frequency text not null check(frequency in('monthly','quarterly','none')),
 valid_from date not null,valid_to date not null,evidence text not null check(length(trim(evidence)) between 1 and 1000),
 policy_id text not null references public.paperwork_tax_policies(id),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,id),check(valid_from<=valid_to),check((regime='small_taxpayer')=(frequency='none'))
);
create table public.paperwork_tax_profile_cancellations (
 firm_id uuid not null,profile_id uuid not null,reason text not null check(length(trim(reason)) between 1 and 1000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(firm_id,profile_id),
 foreign key(firm_id,profile_id) references public.paperwork_tax_profiles(firm_id,id)
);
create table public.paperwork_tax_events (
 firm_id uuid not null,id uuid not null,profile_id uuid not null,document_id uuid not null,document_revision bigint not null,
 fiscal_year_id uuid not null,period_id uuid not null,tax_date date not null,policy_id text not null references public.paperwork_tax_policies(id),
 evidence text not null check(length(trim(evidence)) between 1 and 1000),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,id),foreign key(firm_id,profile_id) references public.paperwork_tax_profiles(firm_id,id),
 foreign key(firm_id,document_id) references public.paperwork_business_documents(firm_id,id),
 foreign key(firm_id,fiscal_year_id) references public.paperwork_fiscal_years(firm_id,id),
 foreign key(firm_id,period_id) references public.paperwork_accounting_periods(firm_id,id)
);
create table public.paperwork_tax_event_lines (
 firm_id uuid not null,event_id uuid not null,document_id uuid not null,line_id text not null,category text not null check(category in('standard','reduced','small_taxpayer')),
 net numeric(24,0) not null check(net>=0),tax numeric(24,0) not null check(tax>=0),deductible numeric(24,0) not null check(deductible>=0 and deductible<=tax),
 reduced_point text,classification_evidence text not null,deduction_evidence text not null,
 primary key(firm_id,event_id,line_id),foreign key(firm_id,event_id) references public.paperwork_tax_events(firm_id,id),
 foreign key(firm_id,document_id,line_id) references public.paperwork_business_document_lines(firm_id,document_id,id),
 check(length(classification_evidence)<=1000 and length(deduction_evidence)<=1000),
 check((category='reduced' and reduced_point is not null and reduced_point in('1','2','2a','3','4','5','6','7','8','9','10','11','12','13','13a','14','15','16','17','18','19','20','21') and length(trim(classification_evidence))>0) or (category<>'reduced' and reduced_point is null))
);
create table public.paperwork_tax_event_cancellations (
 firm_id uuid not null,event_id uuid not null,period_id uuid not null,reason text not null check(length(trim(reason)) between 1 and 1000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(firm_id,event_id),
 foreign key(firm_id,event_id) references public.paperwork_tax_events(firm_id,id),foreign key(firm_id,period_id) references public.paperwork_accounting_periods(firm_id,id)
);
create table public.paperwork_tax_requests (
 firm_id uuid not null references public.paperwork_firms(id),request_key text not null check(length(request_key) between 1 and 100),request_hash text not null,
 action text not null,target_id uuid not null,revision bigint not null,primary key(firm_id,request_key),unique(firm_id,revision)
);
create index tax_events_document on public.paperwork_tax_events(firm_id,document_id);
do $$declare t text;begin
 foreach t in array array['paperwork_tax_profiles','paperwork_tax_profile_cancellations','paperwork_tax_events','paperwork_tax_event_lines','paperwork_tax_event_cancellations','paperwork_tax_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy accounting_read on public.%I for select to authenticated using(public.paperwork_accounting_readable(firm_id))',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
  execute format('create trigger immutable_tax before update or delete on public.%I for each row execute function public._paperwork_accounting_immutable()',t);
 end loop;
end $$;
alter table public.paperwork_tax_policies enable row level security;
create policy policy_read on public.paperwork_tax_policies for select to authenticated using(true);
revoke all on public.paperwork_tax_policies from public,anon,authenticated;
grant select on public.paperwork_tax_policies to authenticated;
create trigger immutable_tax before update or delete on public.paperwork_tax_policies for each row execute function public._paperwork_accounting_immutable();

create function public._paperwork_tax_reversal_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.reversal_of is not null and exists(select 1 from public.paperwork_document_journals j join public.paperwork_tax_events e on e.firm_id=j.firm_id and e.document_id=j.document_id
  where j.firm_id=new.firm_id and j.journal_id=new.reversal_of and not exists(select 1 from public.paperwork_tax_event_cancellations c where c.firm_id=e.firm_id and c.event_id=e.id)) then raise exception 'ACTIVE_TAX_EVIDENCE';end if;
 return new;
end $$;
create trigger tax_reversal_guard before insert on public.paperwork_journals for each row execute function public._paperwork_tax_reversal_guard();
create function public._paperwork_tax_advance_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.paperwork_tax_events e where e.firm_id=new.firm_id and e.document_id in(new.invoice_id,new.advance_id)
  and not exists(select 1 from public.paperwork_tax_event_cancellations c where c.firm_id=e.firm_id and c.event_id=e.id)) then raise exception 'ACTIVE_TAX_EVIDENCE';end if;
 return new;
end $$;
create trigger tax_advance_guard before insert on public.paperwork_advance_applications for each row execute function public._paperwork_tax_advance_guard();

create function public.paperwork_tax_command(p_action text,p_data jsonb,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare f uuid:=(p_data->>'firmId')::uuid;i uuid:=(p_data->>'id')::uuid;h text;r public.paperwork_tax_requests;rev bigint;
 profile public.paperwork_tax_profiles;doc public.paperwork_business_documents;ev public.paperwork_tax_events;per public.paperwork_accounting_periods;
 pol public.paperwork_tax_policies;df date;dt date;td date;item jsonb;dl public.paperwork_business_document_lines;category text;ded numeric;v numeric;pid uuid;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if p_action is null or p_action not in('create_profile','cancel_profile','record','cancel_event') then raise exception 'INVALID_TAX_ACTION';end if;
 if not public.paperwork_accounting_can(f,case when p_action in('create_profile','cancel_profile') then 'manage_periods' else 'post_journal' end)
  or (p_action='cancel_event' and not public.paperwork_accounting_can(f,'reverse_journal')) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 if i is null or p_key is null or length(p_key) not between 1 and 100 or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'INVALID_TAX_REQUEST';end if;
 h:=encode(sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data)::text,'UTF8')),'hex');
 select * into r from public.paperwork_tax_requests where firm_id=f and request_key=p_key;
 if found then if r.request_hash<>h then raise exception 'IDEMPOTENCY_REUSE';end if;return jsonb_build_object('firmId',f,'id',r.target_id,'action',r.action,'revision',r.revision::text);end if;
 select count(*) into rev from public.paperwork_tax_requests where firm_id=f;
 if p_data->>'expectedRevision' is distinct from rev::text then raise exception 'STALE_REVISION';end if;
 if p_action='create_profile' then
  if jsonb_typeof(p_data->'validFrom') is distinct from 'string' or jsonb_typeof(p_data->'validTo') is distinct from 'string' or (p_data->>'validFrom') !~ '^\d{4}-\d{2}-\d{2}$' or (p_data->>'validTo') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_TAX_DATE';end if;
  df:=(p_data->>'validFrom')::date;dt:=(p_data->>'validTo')::date;
  select * into strict pol from public.paperwork_tax_policies where id=p_data->>'policyId';
  if df<pol.valid_from or dt>pol.valid_to or df>dt then raise exception 'UNSUPPORTED_TAX_DATE';end if;
  if exists(select 1 from public.paperwork_tax_profiles p where p.firm_id=f and p.valid_from<=dt and p.valid_to>=df and not exists(select 1 from public.paperwork_tax_profile_cancellations c where c.firm_id=f and c.profile_id=p.id)) then raise exception 'TAX_PROFILE_OVERLAP';end if;
  insert into public.paperwork_tax_profiles values(f,i,p_data->>'legalForm',p_data->>'regime',p_data->>'frequency',df,dt,trim(p_data->>'evidence'),pol.id,auth.uid(),now());
 elsif p_action='cancel_profile' then
  select * into strict profile from public.paperwork_tax_profiles p where p.firm_id=f and p.id=i and not exists(select 1 from public.paperwork_tax_profile_cancellations c where c.firm_id=f and c.profile_id=p.id);
  if exists(select 1 from public.paperwork_tax_events where firm_id=f and profile_id=i) then raise exception 'TAX_PROFILE_HAS_HISTORY';end if;
  insert into public.paperwork_tax_profile_cancellations values(f,i,trim(p_data->>'reason'),auth.uid(),now());
 else
  pid:=(p_data->>'periodId')::uuid;select * into strict per from public.paperwork_accounting_periods where firm_id=f and id=pid;
  if per.status<>'open' then raise exception 'CLOSED_PERIOD';end if;
  if p_action='cancel_event' then
   select * into strict ev from public.paperwork_tax_events e where e.firm_id=f and e.id=i and not exists(select 1 from public.paperwork_tax_event_cancellations c where c.firm_id=f and c.event_id=e.id);
   if ev.period_id<>pid then raise exception 'INVALID_TAX_PERIOD';end if;
   insert into public.paperwork_tax_event_cancellations values(f,i,pid,trim(p_data->>'reason'),auth.uid(),now());
  else
   if p_data->>'policyId' is distinct from 'rs-vat-reference-2026-v1' or p_data->'confirmedOrdinaryDomesticSupply' is distinct from 'true'::jsonb then raise exception 'UNSUPPORTED_TAX_SCOPE';end if;
   select * into strict profile from public.paperwork_tax_profiles p where p.firm_id=f and p.id=(p_data->>'profileId')::uuid and not exists(select 1 from public.paperwork_tax_profile_cancellations c where c.firm_id=f and c.profile_id=p.id);
   if jsonb_typeof(p_data->'taxDate') is distinct from 'string' or (p_data->>'taxDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_TAX_DATE';end if;
   td:=(p_data->>'taxDate')::date;
   if profile.policy_id<>p_data->>'policyId' or td<profile.valid_from or td>profile.valid_to or td not between per.starts_on and per.ends_on or per.fiscal_year_id is distinct from (p_data->>'fiscalYearId')::uuid then raise exception 'INVALID_TAX_PERIOD';end if;
   select * into strict doc from public.paperwork_business_documents where firm_id=f and id=(p_data->>'documentId')::uuid;
   if doc.lifecycle<>'issued' or doc.kind<>'invoice' or doc.document_date<>td or doc.currency<>'RSD' or (doc.direction='incoming' and profile.regime<>'regular_vat') then raise exception 'UNSUPPORTED_TAX_DOCUMENT';end if;
   if doc.revision::text is distinct from p_data->>'documentRevision' then raise exception 'STALE_REVISION';end if;
   if not exists(select 1 from public.paperwork_business_document_workflow where firm_id=f and document_id=doc.id and approval='approved') then raise exception 'TAX_DOCUMENT_NOT_APPROVED';end if;
   if not exists(select 1 from public.paperwork_document_journals j where j.firm_id=f and j.document_id=doc.id and not exists(select 1 from public.paperwork_journals s where s.firm_id=f and s.reversal_of=j.journal_id)) then raise exception 'TAX_DOCUMENT_NOT_POSTED';end if;
   if exists(select 1 from public.paperwork_advance_applications where firm_id=f and (invoice_id=doc.id or advance_id=doc.id)) then raise exception 'UNSUPPORTED_TAX_ADVANCE';end if;
   if exists(select 1 from public.paperwork_tax_events e where e.firm_id=f and e.document_id=doc.id and not exists(select 1 from public.paperwork_tax_event_cancellations c where c.firm_id=f and c.event_id=e.id)) then raise exception 'DUPLICATE_SOURCE';end if;
   if jsonb_typeof(p_data->'lines') is distinct from 'array' or jsonb_array_length(p_data->'lines')<>(select count(*) from public.paperwork_business_document_lines where firm_id=f and document_id=doc.id) then raise exception 'INVALID_TAX_LINES';end if;
   insert into public.paperwork_tax_events values(f,i,profile.id,doc.id,doc.revision,per.fiscal_year_id,pid,td,profile.policy_id,trim(p_data->>'evidence'),auth.uid(),now());
   for item in select value from jsonb_array_elements(p_data->'lines') loop
    select * into strict dl from public.paperwork_business_document_lines where firm_id=f and document_id=doc.id and id=item->>'lineId';
    category:=item->>'category';
    if (profile.regime='small_taxpayer' and category is distinct from 'small_taxpayer') or (profile.regime='regular_vat' and (category is null or category not in('standard','reduced'))) then raise exception 'INVALID_TAX_CATEGORY';end if;
    v:=case category when 'standard' then div(dl.net*20+50,100) when 'reduced' then div(dl.net*10+50,100) else 0 end;
    if v<>dl.tax then raise exception 'TAX_AMOUNT_MISMATCH';end if;
    if jsonb_typeof(item->'deductible') is distinct from 'string' or (item->>'deductible') !~ '^(0|[1-9][0-9]{0,23})$' then raise exception 'INVALID_TAX_AMOUNT';end if;
    ded:=(item->>'deductible')::numeric;
    if ded>dl.tax or (doc.direction='outgoing' and ded<>0) or (doc.direction='incoming' and length(trim(coalesce(item->>'deductionEvidence',''))) not between 1 and 1000) then raise exception 'INVALID_TAX_DEDUCTION';end if;
    insert into public.paperwork_tax_event_lines values(f,i,doc.id,dl.id,category,dl.net,dl.tax,ded,item->>'reducedPoint',coalesce(item->>'classificationEvidence',''),coalesce(item->>'deductionEvidence',''));
   end loop;
  end if;
 end if;
 rev:=rev+1;
 insert into public.paperwork_tax_requests values(f,p_key,h,p_action,i,rev);
 insert into public.paperwork_accounting_events(firm_id,actor_id,action,target_id,reason) values(f,auth.uid(),'tax.'||p_action,i::text,coalesce(p_data->>'reason',p_data->>'evidence'));
 return jsonb_build_object('firmId',f,'id',i,'action',p_action,'revision',rev::text);
end $$;

create function public.paperwork_tax_workspace(p_firm uuid,p_year uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare y public.paperwork_fiscal_years;begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 select * into strict y from public.paperwork_fiscal_years where firm_id=p_firm and id=p_year;
 if (select count(*) from public.paperwork_tax_profiles where firm_id=p_firm)>1000 or (select count(*) from public.paperwork_tax_events where firm_id=p_firm)>10000 or (select count(*) from public.paperwork_business_documents where firm_id=p_firm and lifecycle='issued' and document_date between y.starts_on and y.ends_on)>1000 then raise exception 'TAX_WORKSPACE_TOO_LARGE';end if;
 return jsonb_build_object('firmId',p_firm,'yearId',p_year,'from',y.starts_on::text,'to',y.ends_on::text,
 'revision',(select count(*)::text from public.paperwork_tax_requests where firm_id=p_firm),
 'policies',(select jsonb_agg(jsonb_build_object('id',id,'validFrom',valid_from::text,'validTo',valid_to::text,'lawSha256',law_sha256,'bylawSha256',bylaw_sha256)) from public.paperwork_tax_policies),
 'profiles',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'legalForm',p.legal_form,'regime',p.regime,'frequency',p.frequency,'validFrom',p.valid_from::text,'validTo',p.valid_to::text,'evidence',p.evidence,'policyId',p.policy_id,'createdBy',p.created_by,'createdAt',p.created_at,'cancelled',exists(select 1 from public.paperwork_tax_profile_cancellations c where c.firm_id=p_firm and c.profile_id=p.id),'cancelReason',(select reason from public.paperwork_tax_profile_cancellations c where c.firm_id=p_firm and c.profile_id=p.id)) order by p.valid_from,p.id),'[]'::jsonb) from public.paperwork_tax_profiles p where p.firm_id=p_firm),
 'documents',(select coalesce(jsonb_agg(public.paperwork_read_business_document(p_firm,d.id)||jsonb_build_object('sourceReversed',exists(select 1 from public.paperwork_document_journals j join public.paperwork_journals s on s.firm_id=j.firm_id and s.reversal_of=j.journal_id where j.firm_id=p_firm and j.document_id=d.id)) order by d.document_date,d.id),'[]'::jsonb) from public.paperwork_business_documents d where d.firm_id=p_firm and d.lifecycle='issued' and d.document_date between y.starts_on and y.ends_on),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'profileId',e.profile_id,'documentId',e.document_id,'documentRevision',e.document_revision::text,'periodId',e.period_id,'taxDate',e.tax_date::text,'policyId',e.policy_id,'evidence',e.evidence,'createdBy',e.created_by,'createdAt',e.created_at,'cancelled',exists(select 1 from public.paperwork_tax_event_cancellations c where c.firm_id=p_firm and c.event_id=e.id),'cancelReason',(select reason from public.paperwork_tax_event_cancellations c where c.firm_id=p_firm and c.event_id=e.id),
 'lines',(select jsonb_agg(jsonb_build_object('lineId',l.line_id,'category',l.category,'net',l.net::text,'tax',l.tax::text,'deductible',l.deductible::text,'reducedPoint',l.reduced_point,'classificationEvidence',l.classification_evidence,'deductionEvidence',l.deduction_evidence) order by l.line_id) from public.paperwork_tax_event_lines l where l.firm_id=p_firm and l.event_id=e.id)) order by e.tax_date,e.id),'[]'::jsonb) from public.paperwork_tax_events e where e.firm_id=p_firm and e.fiscal_year_id=p_year));
end $$;
revoke all on function public._paperwork_tax_reversal_guard(),public._paperwork_tax_advance_guard() from public,anon,authenticated;
revoke all on function public.paperwork_tax_command(text,jsonb,text),public.paperwork_tax_workspace(uuid,uuid) from public,anon;
grant execute on function public.paperwork_tax_command(text,jsonb,text),public.paperwork_tax_workspace(uuid,uuid) to authenticated;
commit;
