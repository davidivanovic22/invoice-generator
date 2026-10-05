-- Paperwork: personal data, firms shared between people (owner, accountant, viewer), and invites.
-- Every table is protected by row-level security: a user only ever sees firms they are a member of.

------------------------------------------------------------------------------
-- Personal data (resumes): one row per user and key.
------------------------------------------------------------------------------
create table if not exists public.paperwork_data (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.paperwork_data enable row level security;

drop policy if exists "Own rows only" on public.paperwork_data;
create policy "Own rows only" on public.paperwork_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.paperwork_touch() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists paperwork_touch on public.paperwork_data;
create trigger paperwork_touch before insert or update on public.paperwork_data
  for each row execute function public.paperwork_touch();

------------------------------------------------------------------------------
-- Firms and who may work on them.
------------------------------------------------------------------------------
create table if not exists public.paperwork_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.paperwork_members (
  firm_id uuid not null references public.paperwork_firms on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  email text not null default '',
  role text not null check (role in ('owner', 'accountant', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);

create table if not exists public.paperwork_invites (
  firm_id uuid not null references public.paperwork_firms on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'accountant', 'viewer')),
  invited_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (firm_id, email)
);

-- Invoices, KPO book and history of one firm: one row per kind.
create table if not exists public.paperwork_firm_data (
  firm_id uuid not null references public.paperwork_firms on delete cascade,
  key text not null check (key in ('invoices', 'kpo', 'audit')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users on delete set null,
  primary key (firm_id, key)
);

-- Every save records when and by whom.
create or replace function public.paperwork_firm_data_touch() returns trigger
language plpgsql as $$ begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end $$;

drop trigger if exists paperwork_firm_data_touch on public.paperwork_firm_data;
create trigger paperwork_firm_data_touch before insert or update on public.paperwork_firm_data
  for each row execute function public.paperwork_firm_data_touch();

-- The caller's role in a firm (null when not a member). Security definer avoids policy recursion.
create or replace function public.paperwork_role(target uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.paperwork_members where firm_id = target and user_id = auth.uid()
$$;

-- Whoever creates a firm becomes its owner.
create or replace function public.paperwork_firm_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.paperwork_members (firm_id, user_id, email, role)
  values (new.id, auth.uid(), coalesce(auth.jwt() ->> 'email', ''), 'owner')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists paperwork_firm_created on public.paperwork_firms;
create trigger paperwork_firm_created after insert on public.paperwork_firms
  for each row execute function public.paperwork_firm_created();

-- Turns the invites for the caller's email into memberships. Returns how many.
create or replace function public.paperwork_accept_invites() returns integer
language plpgsql security definer set search_path = public as $$
declare
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  accepted integer;
begin
  if auth.uid() is null or my_email = '' then
    return 0;
  end if;
  insert into public.paperwork_members (firm_id, user_id, email, role)
  select firm_id, auth.uid(), my_email, role from public.paperwork_invites where lower(email) = my_email
  on conflict (firm_id, user_id) do update set role = excluded.role;
  get diagnostics accepted = row_count;
  delete from public.paperwork_invites where lower(email) = my_email;
  return accepted;
end $$;

revoke all on function public.paperwork_accept_invites() from public, anon;
grant execute on function public.paperwork_accept_invites() to authenticated;
grant execute on function public.paperwork_role(uuid) to authenticated;

------------------------------------------------------------------------------
-- Row-level security
------------------------------------------------------------------------------
alter table public.paperwork_firms enable row level security;
alter table public.paperwork_members enable row level security;
alter table public.paperwork_invites enable row level security;
alter table public.paperwork_firm_data enable row level security;

drop policy if exists "Members see their firms" on public.paperwork_firms;
create policy "Members see their firms" on public.paperwork_firms
  for select using (created_by = auth.uid() or public.paperwork_role(id) is not null);
drop policy if exists "Signed-in users create firms" on public.paperwork_firms;
create policy "Signed-in users create firms" on public.paperwork_firms
  for insert with check (auth.uid() is not null and created_by = auth.uid());
drop policy if exists "Owners rename firms" on public.paperwork_firms;
create policy "Owners rename firms" on public.paperwork_firms
  for update using (public.paperwork_role(id) = 'owner');
drop policy if exists "Owners delete firms" on public.paperwork_firms;
create policy "Owners delete firms" on public.paperwork_firms
  for delete using (public.paperwork_role(id) = 'owner');

drop policy if exists "Members see each other" on public.paperwork_members;
create policy "Members see each other" on public.paperwork_members
  for select using (public.paperwork_role(firm_id) is not null);
drop policy if exists "Owners manage members" on public.paperwork_members;
create policy "Owners manage members" on public.paperwork_members
  for update using (public.paperwork_role(firm_id) = 'owner');
drop policy if exists "Owners remove members, members leave" on public.paperwork_members;
create policy "Owners remove members, members leave" on public.paperwork_members
  for delete using (public.paperwork_role(firm_id) = 'owner' or user_id = auth.uid());

drop policy if exists "Owners and invitees see invites" on public.paperwork_invites;
create policy "Owners and invitees see invites" on public.paperwork_invites
  for select using (public.paperwork_role(firm_id) = 'owner' or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists "Owners invite" on public.paperwork_invites;
create policy "Owners invite" on public.paperwork_invites
  for insert with check (public.paperwork_role(firm_id) = 'owner');
drop policy if exists "Owners cancel invites" on public.paperwork_invites;
create policy "Owners cancel invites" on public.paperwork_invites
  for delete using (public.paperwork_role(firm_id) = 'owner');

drop policy if exists "Members read firm data" on public.paperwork_firm_data;
create policy "Members read firm data" on public.paperwork_firm_data
  for select using (public.paperwork_role(firm_id) is not null);
drop policy if exists "Owners and accountants write firm data" on public.paperwork_firm_data;
create policy "Owners and accountants write firm data" on public.paperwork_firm_data
  for insert with check (public.paperwork_role(firm_id) in ('owner', 'accountant'));
drop policy if exists "Owners and accountants update firm data" on public.paperwork_firm_data;
create policy "Owners and accountants update firm data" on public.paperwork_firm_data
  for update using (public.paperwork_role(firm_id) in ('owner', 'accountant'));
drop policy if exists "Owners delete firm data" on public.paperwork_firm_data;
create policy "Owners delete firm data" on public.paperwork_firm_data
  for delete using (public.paperwork_role(firm_id) = 'owner');
