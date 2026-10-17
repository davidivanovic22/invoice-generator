begin;
create index paperwork_partner_report_lines on public.paperwork_journal_lines(firm_id,partner_id,journal_id);
create index paperwork_partner_report_documents on public.paperwork_business_documents(firm_id,partner_id) where lifecycle='issued';
-- Current evidence and all recorded postings, across fiscal years. This is NOT an historical as-of report.
create function public.paperwork_partner_report(p_firm uuid,p_partner uuid default null) returns jsonb
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
 return result;
end $$;
revoke all on function public.paperwork_partner_report(uuid,uuid) from public,anon;
grant execute on function public.paperwork_partner_report(uuid,uuid) to authenticated;
commit;
