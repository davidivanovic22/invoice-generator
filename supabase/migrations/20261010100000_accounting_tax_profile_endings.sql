begin;
-- Original profiles remain immutable; one separately authorized prospective ending.
create table public.paperwork_tax_profile_endings (
 firm_id uuid not null,profile_id uuid not null,ends_on date not null,
 reason text not null check(length(trim(reason)) between 1 and 1000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(firm_id,profile_id),foreign key(firm_id,profile_id) references public.paperwork_tax_profiles(firm_id,id)
);
alter table public.paperwork_tax_profile_endings enable row level security;
create policy accounting_read on public.paperwork_tax_profile_endings for select to authenticated using(public.paperwork_accounting_readable(firm_id));
revoke all on public.paperwork_tax_profile_endings from public,anon,authenticated;
grant select on public.paperwork_tax_profile_endings to authenticated;
create trigger immutable_tax before update or delete on public.paperwork_tax_profile_endings for each row execute function public._paperwork_accounting_immutable();
create or replace function public.paperwork_tax_command(p_action text,p_data jsonb,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare f uuid:=(p_data->>'firmId')::uuid;i uuid:=(p_data->>'id')::uuid;h text;r public.paperwork_tax_requests;rev bigint;
 profile public.paperwork_tax_profiles;doc public.paperwork_business_documents;ev public.paperwork_tax_events;per public.paperwork_accounting_periods;
 pol public.paperwork_tax_policies;df date;dt date;td date;item jsonb;dl public.paperwork_business_document_lines;category text;ded numeric;v numeric;pid uuid;
begin
 perform 1 from public.paperwork_firms where id=f for update;
 if p_action is null or p_action not in('create_profile','cancel_profile','end_profile','record','cancel_event') then raise exception 'INVALID_TAX_ACTION';end if;
 if not public.paperwork_accounting_can(f,case when p_action in('create_profile','cancel_profile','end_profile') then 'manage_periods' else 'post_journal' end)
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
  if exists(select 1 from public.paperwork_tax_profiles p where p.firm_id=f and p.valid_from<=dt and coalesce((select s.ends_on from public.paperwork_tax_profile_endings s where s.firm_id=f and s.profile_id=p.id),p.valid_to)>=df and not exists(select 1 from public.paperwork_tax_profile_cancellations c where c.firm_id=f and c.profile_id=p.id)) then raise exception 'TAX_PROFILE_OVERLAP';end if;
  insert into public.paperwork_tax_profiles values(f,i,p_data->>'legalForm',p_data->>'regime',p_data->>'frequency',df,dt,trim(p_data->>'evidence'),pol.id,auth.uid(),now());
 elsif p_action='end_profile' then
  select * into strict profile from public.paperwork_tax_profiles p where p.firm_id=f and p.id=i and not exists(select 1 from public.paperwork_tax_profile_cancellations c where c.firm_id=f and c.profile_id=p.id);
  if jsonb_typeof(p_data->'endsOn') is distinct from 'string' or (p_data->>'endsOn') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_TAX_DATE';end if;
  dt:=(p_data->>'endsOn')::date;
  if dt<profile.valid_from or dt>=profile.valid_to or dt<(now() at time zone 'Europe/Belgrade')::date then raise exception 'INVALID_TAX_PROFILE_END';end if;
  if exists(select 1 from public.paperwork_tax_events where firm_id=f and profile_id=i and tax_date>dt) then raise exception 'TAX_PROFILE_HAS_LATER_HISTORY';end if;
  insert into public.paperwork_tax_profile_endings values(f,i,dt,trim(p_data->>'reason'),auth.uid(),now());
 elsif p_action='cancel_profile' then
  select * into strict profile from public.paperwork_tax_profiles p where p.firm_id=f and p.id=i and not exists(select 1 from public.paperwork_tax_profile_cancellations c where c.firm_id=f and c.profile_id=p.id);
  if exists(select 1 from public.paperwork_tax_events where firm_id=f and profile_id=i) or exists(select 1 from public.paperwork_tax_profile_endings where firm_id=f and profile_id=i) then raise exception 'TAX_PROFILE_HAS_HISTORY';end if;
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
   if profile.policy_id<>p_data->>'policyId' or td<profile.valid_from or td>coalesce((select s.ends_on from public.paperwork_tax_profile_endings s where s.firm_id=f and s.profile_id=profile.id),profile.valid_to) or td not between per.starts_on and per.ends_on or per.fiscal_year_id is distinct from (p_data->>'fiscalYearId')::uuid then raise exception 'INVALID_TAX_PERIOD';end if;
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

create or replace function public.paperwork_tax_workspace(p_firm uuid,p_year uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare y public.paperwork_fiscal_years;begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN';end if;
 select * into strict y from public.paperwork_fiscal_years where firm_id=p_firm and id=p_year;
 if (select count(*) from public.paperwork_tax_profiles where firm_id=p_firm)>1000 or (select count(*) from public.paperwork_tax_events where firm_id=p_firm)>10000 or (select count(*) from public.paperwork_business_documents where firm_id=p_firm and lifecycle='issued' and document_date between y.starts_on and y.ends_on)>1000 then raise exception 'TAX_WORKSPACE_TOO_LARGE';end if;
 return jsonb_build_object('firmId',p_firm,'yearId',p_year,'from',y.starts_on::text,'to',y.ends_on::text,
 'revision',(select count(*)::text from public.paperwork_tax_requests where firm_id=p_firm),
 'policies',(select jsonb_agg(jsonb_build_object('id',id,'validFrom',valid_from::text,'validTo',valid_to::text,'lawSha256',law_sha256,'bylawSha256',bylaw_sha256)) from public.paperwork_tax_policies),
 'profiles',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'legalForm',p.legal_form,'regime',p.regime,'frequency',p.frequency,'validFrom',p.valid_from::text,'validTo',p.valid_to::text,'ending',(select jsonb_build_object('endsOn',s.ends_on::text,'reason',s.reason,'createdBy',s.created_by,'createdAt',s.created_at) from public.paperwork_tax_profile_endings s where s.firm_id=p_firm and s.profile_id=p.id),'evidence',p.evidence,'policyId',p.policy_id,'createdBy',p.created_by,'createdAt',p.created_at,'cancelled',exists(select 1 from public.paperwork_tax_profile_cancellations c where c.firm_id=p_firm and c.profile_id=p.id),'cancelReason',(select reason from public.paperwork_tax_profile_cancellations c where c.firm_id=p_firm and c.profile_id=p.id)) order by p.valid_from,p.id),'[]'::jsonb) from public.paperwork_tax_profiles p where p.firm_id=p_firm),
 'documents',(select coalesce(jsonb_agg(public.paperwork_read_business_document(p_firm,d.id)||jsonb_build_object('sourceReversed',exists(select 1 from public.paperwork_document_journals j join public.paperwork_journals s on s.firm_id=j.firm_id and s.reversal_of=j.journal_id where j.firm_id=p_firm and j.document_id=d.id)) order by d.document_date,d.id),'[]'::jsonb) from public.paperwork_business_documents d where d.firm_id=p_firm and d.lifecycle='issued' and d.document_date between y.starts_on and y.ends_on),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'profileId',e.profile_id,'documentId',e.document_id,'documentRevision',e.document_revision::text,'periodId',e.period_id,'taxDate',e.tax_date::text,'policyId',e.policy_id,'evidence',e.evidence,'createdBy',e.created_by,'createdAt',e.created_at,'cancelled',exists(select 1 from public.paperwork_tax_event_cancellations c where c.firm_id=p_firm and c.event_id=e.id),'cancelReason',(select reason from public.paperwork_tax_event_cancellations c where c.firm_id=p_firm and c.event_id=e.id),
 'lines',(select jsonb_agg(jsonb_build_object('lineId',l.line_id,'category',l.category,'net',l.net::text,'tax',l.tax::text,'deductible',l.deductible::text,'reducedPoint',l.reduced_point,'classificationEvidence',l.classification_evidence,'deductionEvidence',l.deduction_evidence) order by l.line_id) from public.paperwork_tax_event_lines l where l.firm_id=p_firm and l.event_id=e.id)) order by e.tax_date,e.id),'[]'::jsonb) from public.paperwork_tax_events e where e.firm_id=p_firm and e.fiscal_year_id=p_year));
end $$;
commit;
