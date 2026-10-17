begin;

-- Financial workspace discovery includes explicit agency assignments, without
-- exposing legacy documents or changing legacy firm membership.
create function public.paperwork_accounting_firms() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'taxId',tax_id) order by name,id),'[]'::jsonb)
 from public.paperwork_firms where public.paperwork_accounting_readable(id)
$$;
create function public.paperwork_accounting_workspace(p_firm uuid,p_year uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$ begin
 if not public.paperwork_accounting_readable(p_firm) then raise exception 'ACCOUNTING_FORBIDDEN'; end if;
 if p_year is not null and not exists(select 1 from public.paperwork_fiscal_years where firm_id=p_firm and id=p_year) then raise exception 'INVALID_YEAR'; end if;
 return jsonb_build_object(
 'firmId',p_firm,'yearId',p_year,
 'capabilities',(select coalesce(jsonb_agg(c),'[]'::jsonb) from unnest(array['manage_chart','post_journal','reverse_journal','manage_periods']) c where public.paperwork_accounting_can(p_firm,c)),
 'years',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'startsOn',starts_on::text,'endsOn',ends_on::text) order by label desc),'[]'::jsonb) from public.paperwork_fiscal_years where firm_id=p_firm),
 'periods',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'startsOn',starts_on::text,'endsOn',ends_on::text,'status',status,'revision',revision::text) order by starts_on),'[]'::jsonb) from public.paperwork_accounting_periods where firm_id=p_firm and fiscal_year_id=p_year),
 'accounts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'active',active,'allowsPosting',allows_posting,'requiresPartner',requires_partner,'validFrom',valid_from::text,'validTo',valid_to::text) order by code),'[]'::jsonb) from public.paperwork_accounts where firm_id=p_firm),
 'partners',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id),'[]'::jsonb) from public.paperwork_accounting_partners where firm_id=p_firm),
 'drafts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'postingDate',posting_date::text,'description',description,'revision',revision::text) order by saved_at desc,id),'[]'::jsonb) from (select * from public.paperwork_journal_drafts where firm_id=p_firm and fiscal_year_id=p_year and status='draft' order by saved_at desc,id limit 100) d),
 'journals',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'number',number,'postingDate',posting_date::text,'description',description) order by posted_at desc,id),'[]'::jsonb) from (select * from public.paperwork_journals where firm_id=p_firm and fiscal_year_id=p_year order by posted_at desc,id limit 100) j)
 );
end $$;
revoke all on function public.paperwork_accounting_firms(),public.paperwork_accounting_workspace(uuid,uuid) from public,anon;
grant execute on function public.paperwork_accounting_firms(),public.paperwork_accounting_workspace(uuid,uuid) to authenticated;
commit;
