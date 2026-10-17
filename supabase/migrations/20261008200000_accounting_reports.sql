begin;
create index paperwork_journal_report_dates on public.paperwork_journals(firm_id,fiscal_year_id,posting_date,id);

-- One statement snapshot, complete posted entries only. Never silently truncate.
create function public.paperwork_accounting_report(p_firm uuid,p_year uuid,p_from date,p_to date) returns jsonb
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
   l.id line_id,l.account_id,l.account_code,l.account_name,l.partner_id,p.name partner_name,l.description,l.debit,l.credit
  from public.paperwork_journals j join public.paperwork_journal_lines l on l.firm_id=j.firm_id and l.journal_id=j.id
  left join public.paperwork_accounting_partners p on p.firm_id=l.firm_id and p.id=l.partner_id
  where j.firm_id=p_firm and j.fiscal_year_id=p_year and j.posting_date<=p_to
 ), balances as (
  select account_id,coalesce(sum(debit) filter(where posting_date<p_from),0) od,coalesce(sum(credit) filter(where posting_date<p_from),0) oc,
   coalesce(sum(debit) filter(where posting_date>=p_from),0) d,coalesce(sum(credit) filter(where posting_date>=p_from),0) c
  from entries group by account_id
 ), accounts as (select b.*,a.code,a.name from balances b join public.paperwork_accounts a on a.firm_id=p_firm and a.id=b.account_id)
 select jsonb_build_object('firmId',p_firm,'firmName',(select name from public.paperwork_firms where id=p_firm),
  'yearId',p_year,'yearLabel',y.label,'yearStart',y.starts_on::text,'yearEnd',y.ends_on::text,'from',p_from::text,'to',p_to::text,'currency','RSD','generatedAt',statement_timestamp(),
  'journalCount',(select count(distinct journal_id)::text from entries where posting_date>=p_from),'lineCount',(select count(*)::text from entries where posting_date>=p_from),
  'lines',(select coalesce(jsonb_agg(jsonb_build_object('journalId',journal_id,'number',number,'postingDate',posting_date::text,'postedAt',posted_at,'journalDescription',journal_description,'reversalOf',reversal_of,'reason',reason,
   'lineId',line_id,'accountId',account_id,'accountCode',account_code,'accountName',account_name,'partnerId',partner_id,'partnerName',partner_name,'description',description,'debit',debit::text,'credit',credit::text)
   order by posting_date,posted_at,journal_id,line_id),'[]'::jsonb) from entries where posting_date>=p_from),
  'accounts',(select coalesce(jsonb_agg(jsonb_build_object('accountId',account_id,'code',code,'name',name,'openingDebit',od::text,'openingCredit',oc::text,'debit',d::text,'credit',c::text,
   'openingBalance',(od-oc)::text,'closingBalance',(od+d-oc-c)::text) order by code,account_id),'[]'::jsonb) from accounts),
  'totals',(select jsonb_build_object('openingDebit',coalesce(sum(od),0)::text,'openingCredit',coalesce(sum(oc),0)::text,'debit',coalesce(sum(d),0)::text,'credit',coalesce(sum(c),0)::text,
   'openingBalanceDebit',coalesce(sum(greatest(od-oc,0)),0)::text,'openingBalanceCredit',coalesce(sum(greatest(oc-od,0)),0)::text,
   'closingBalanceDebit',coalesce(sum(greatest(od+d-oc-c,0)),0)::text,'closingBalanceCredit',coalesce(sum(greatest(oc+c-od-d,0)),0)::text) from accounts)
 ) into result;
 return result;
end $$;
revoke all on function public.paperwork_accounting_report(uuid,uuid,date,date) from public,anon;
grant execute on function public.paperwork_accounting_report(uuid,uuid,date,date) to authenticated;
commit;
