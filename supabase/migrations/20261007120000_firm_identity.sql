-- PIB is a business identity, not an automatically generated cloud UUID.
-- Preserve legacy duplicate documents; reject any new duplicate identity.
create or replace function public.paperwork_normalize_tax_id(value text) returns text
language sql immutable set search_path = public as $$
  select nullif(upper(regexp_replace(trim(coalesce(value, '')), '[[:space:].-]', '', 'g')), '')
$$;

alter table public.paperwork_firms add column if not exists tax_id text;

-- Only unambiguous legacy identities can be backfilled without choosing which documents to discard.
with identities as (
  select firm_id, public.paperwork_normalize_tax_id(data #>> '{profile,party,taxId}') as tax_id
  from public.paperwork_firm_data where key = 'invoices'
), unique_identities as (
  select tax_id from identities where tax_id is not null group by tax_id having count(*) = 1
)
update public.paperwork_firms f set tax_id = i.tax_id
from identities i join unique_identities u using (tax_id)
where f.id = i.firm_id and f.tax_id is null;

create unique index if not exists paperwork_firms_tax_id_unique
on public.paperwork_firms(tax_id) where tax_id is not null;

create or replace function public.paperwork_check_firm_identity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.tax_id := public.paperwork_normalize_tax_id(new.tax_id);
  if new.tax_id is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('paperwork-pib:' || new.tax_id, 0));
  if exists (
    select 1 from public.paperwork_firms f
    left join public.paperwork_firm_data d on d.firm_id = f.id and d.key = 'invoices'
    where f.id <> new.id
      and (f.tax_id = new.tax_id or public.paperwork_normalize_tax_id(d.data #>> '{profile,party,taxId}') = new.tax_id)
  ) then
    raise exception 'A firm with this PIB already exists. Ask its owner for access.' using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists paperwork_check_firm_identity on public.paperwork_firms;
create trigger paperwork_check_firm_identity before insert or update of tax_id on public.paperwork_firms
for each row execute function public.paperwork_check_firm_identity();

-- Also protect direct invoice/profile writes (including accountant edits and old clients).
create or replace function public.paperwork_profile_identity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  identity text;
  previous_identity text;
begin
  if new.key <> 'invoices' then return new; end if;
  -- Old payloads without a profile must not silently remove a registered identity.
  if not coalesce((new.data #> '{profile,party}' ? 'taxId'), false) then return new; end if;
  identity := public.paperwork_normalize_tax_id(new.data #>> '{profile,party,taxId}');
  if tg_op = 'UPDATE' then
    previous_identity := public.paperwork_normalize_tax_id(old.data #>> '{profile,party,taxId}');
    -- Existing legacy duplicates may still save their documents; changing PIB is checked.
    if identity is not distinct from previous_identity then return new; end if;
  end if;
  update public.paperwork_firms set tax_id = identity where id = new.firm_id;
  return new;
end $$;

drop trigger if exists paperwork_profile_identity on public.paperwork_firm_data;
create trigger paperwork_profile_identity before insert or update of data on public.paperwork_firm_data
for each row execute function public.paperwork_profile_identity();

-- Atomic explicit connection: reuse an accessible firm; never grant access merely by knowing its PIB.
create or replace function public.paperwork_connect_firm(p_name text, p_tax_id text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  identity text := public.paperwork_normalize_tax_id(p_tax_id);
  existing_ids uuid[];
  result_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in before connecting a firm.'; end if;
  if identity is null then raise exception 'Enter the firm PIB before connecting it to the cloud.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('paperwork-pib:' || identity, 0));
  select array_agg(f.id) into existing_ids from public.paperwork_firms f
  left join public.paperwork_firm_data d on d.firm_id = f.id and d.key = 'invoices'
  where f.tax_id = identity or public.paperwork_normalize_tax_id(d.data #>> '{profile,party,taxId}') = identity;
  if cardinality(existing_ids) > 1 then
    raise exception 'There are existing cloud firms with the same PIB. Resolve the duplicates before syncing.';
  end if;
  if cardinality(existing_ids) = 1 then
    result_id := existing_ids[1];
    if public.paperwork_role(result_id) is null then
      raise exception 'A firm with this PIB already exists. Ask its owner for access.';
    end if;
    return result_id;
  end if;
  insert into public.paperwork_firms(name, tax_id, created_by)
  values (trim(coalesce(p_name, '')), identity, auth.uid()) returning id into result_id;
  return result_id;
end $$;

revoke all on function public.paperwork_connect_firm(text,text) from public, anon;
grant execute on function public.paperwork_connect_firm(text,text) to authenticated;

-- Old clients must not create blank-PIB firms on each refresh before the profile write.
-- Company creation goes through the explicit authenticated RPC above, with a required unique PIB.
drop policy if exists "Signed-in users create firms" on public.paperwork_firms;
