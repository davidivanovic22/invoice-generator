begin;

create table public.paperwork_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '' check (length(first_name) <= 80),
  last_name text not null default '' check (length(last_name) <= 80),
  username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  phone text not null default '' check (phone = '' or phone ~ '^\+?[0-9 ()-]{6,32}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.paperwork_profiles enable row level security;
create policy profiles_read_own on public.paperwork_profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_update_own on public.paperwork_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.paperwork_profiles from anon, authenticated;
grant select on public.paperwork_profiles to authenticated;
grant update (first_name,last_name,username,phone) on public.paperwork_profiles to authenticated;

create function public._paperwork_create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.paperwork_profiles(user_id,first_name,last_name,username,phone)
  values (new.id, trim(coalesce(new.raw_user_meta_data->>'first_name','')),
    trim(coalesce(new.raw_user_meta_data->>'last_name','')),
    nullif(lower(trim(coalesce(new.raw_user_meta_data->>'username',''))),''),
    trim(coalesce(new.raw_user_meta_data->>'phone','')));
  return new;
end;
$$;
revoke all on function public._paperwork_create_profile() from public,anon,authenticated;
create trigger paperwork_create_profile after insert on auth.users
for each row execute function public._paperwork_create_profile();

-- Existing accounts remain valid and can complete their profile in Account settings.
insert into public.paperwork_profiles(user_id) select id from auth.users;

create function public._paperwork_profile_updated() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public._paperwork_profile_updated() from public,anon,authenticated;
create trigger paperwork_profile_updated before update on public.paperwork_profiles
for each row execute function public._paperwork_profile_updated();

create function public.paperwork_username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(trim(p_username)) ~ '^[a-z0-9_]{3,30}$'
    and not exists (select 1 from public.paperwork_profiles where username = lower(trim(p_username)));
$$;
revoke all on function public.paperwork_username_available(text) from public;
grant execute on function public.paperwork_username_available(text) to anon,authenticated;

notify pgrst, 'reload schema';
commit;
