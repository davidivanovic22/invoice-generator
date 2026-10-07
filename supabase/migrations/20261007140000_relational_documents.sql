-- Relational documents. JSON is a transport format only, never a stored column.

begin;

create table if not exists public.paperwork_invoice_settings (
  firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
  issuer_name text not null default '',
  issuer_address text not null default '',
  issuer_city_country text not null default '',
  issuer_tax_id_label text not null default '',
  issuer_tax_id text not null default '',
  issuer_reg_id_label text not null default '',
  issuer_reg_no text not null default '',
  issuer_email text not null default '',
  bank_iban text not null default '',
  bank_swift text not null default '',
  bank_bank_name text not null default '',
  logo text not null default '',
  signature text not null default '',
  default_currency text not null default 'EUR',
  default_vat_percent numeric not null default 0,
  default_payment_days integer not null default 14,
  default_note text not null default '',
  default_number_prefix text not null default '',
  default_language text not null default 'en',
  default_template text not null default 'modern',
  default_accent_color text not null default '#4f46e5',
  default_unit text not null default 'h',
  primary key (firm_id)
);

alter table public.paperwork_invoice_settings enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_invoice_settings;

drop policy if exists "Edit accessible rows" on public.paperwork_invoice_settings;

create policy "Read accessible rows" on public.paperwork_invoice_settings for select to authenticated using (public.paperwork_role(firm_id) is not null);

create policy "Edit accessible rows" on public.paperwork_invoice_settings for all to authenticated using (public.paperwork_role(firm_id) in ('owner','accountant')) with check (public.paperwork_role(firm_id) in ('owner','accountant'));

grant select on public.paperwork_invoice_settings to authenticated;

create table if not exists public.paperwork_clients (
  firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
  id text not null,
  position integer not null,
  name text not null default '',
  address text not null default '',
  city_country text not null default '',
  tax_id_label text not null default '',
  tax_id text not null default '',
  reg_id_label text not null default '',
  reg_no text not null default '',
  email text not null default '',
  currency text not null default 'EUR',
  last_used_at text not null default '',
  primary key (firm_id,id),
  foreign key (firm_id) references public.paperwork_invoice_settings(firm_id) on delete cascade
);

alter table public.paperwork_clients enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_clients;

drop policy if exists "Edit accessible rows" on public.paperwork_clients;

create policy "Read accessible rows" on public.paperwork_clients for select to authenticated using (public.paperwork_role(firm_id) is not null);

create policy "Edit accessible rows" on public.paperwork_clients for all to authenticated using (public.paperwork_role(firm_id) in ('owner','accountant')) with check (public.paperwork_role(firm_id) in ('owner','accountant'));

grant select on public.paperwork_clients to authenticated;

create table if not exists public.paperwork_invoices (
  firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
  id text not null,
  position integer not null,
  number text not null default '',
  status text not null default 'draft',
  issue_date date,
  service_date date,
  due_date date,
  billing_period text not null default '',
  currency text not null default 'EUR',
  vat_percent numeric not null default 0,
  client_id text,
  note text not null default '',
  logo text not null default '',
  signature text not null default '',
  paid_at date,
  repeat_day integer,
  created_at timestamptz,
  updated_at timestamptz,
  issuer_name text not null default '',
  issuer_address text not null default '',
  issuer_city_country text not null default '',
  issuer_tax_id_label text not null default '',
  issuer_tax_id text not null default '',
  issuer_reg_id_label text not null default '',
  issuer_reg_no text not null default '',
  issuer_email text not null default '',
  client_name text not null default '',
  client_address text not null default '',
  client_city_country text not null default '',
  client_tax_id_label text not null default '',
  client_tax_id text not null default '',
  client_reg_id_label text not null default '',
  client_reg_no text not null default '',
  client_email text not null default '',
  bank_iban text not null default '',
  bank_swift text not null default '',
  bank_bank_name text not null default '',
  design_template text not null default 'modern',
  design_accent_color text not null default '#4f46e5',
  design_language text not null default 'en',
  design_seasonal_month text,
  design_seasonal_variant integer,
  primary key (firm_id,id),
  foreign key (firm_id) references public.paperwork_invoice_settings(firm_id) on delete cascade,
  foreign key (firm_id, client_id) references public.paperwork_clients(firm_id,id) deferrable initially deferred,
  check (status in ('draft','sent','paid','cancelled')),
  check (repeat_day is null or repeat_day between 1 and 31)
);

alter table public.paperwork_invoices enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_invoices;

drop policy if exists "Edit accessible rows" on public.paperwork_invoices;

create policy "Read accessible rows" on public.paperwork_invoices for select to authenticated using (public.paperwork_role(firm_id) is not null);

create policy "Edit accessible rows" on public.paperwork_invoices for all to authenticated using (public.paperwork_role(firm_id) in ('owner','accountant')) with check (public.paperwork_role(firm_id) in ('owner','accountant'));

grant select on public.paperwork_invoices to authenticated;

create table if not exists public.paperwork_invoice_items (
  firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
  id text not null,
  position integer not null,
  parent_id text not null,
  title text not null default '',
  description text not null default '',
  quantity numeric not null default 1,
  unit text not null default 'h',
  unit_price numeric not null default 0,
  primary key (firm_id,id),
  foreign key (firm_id,parent_id) references public.paperwork_invoices(firm_id,id) on delete cascade
);

create index if not exists paperwork_invoice_items_parent on public.paperwork_invoice_items (firm_id,parent_id);

alter table public.paperwork_invoice_items enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_invoice_items;

drop policy if exists "Edit accessible rows" on public.paperwork_invoice_items;

create policy "Read accessible rows" on public.paperwork_invoice_items for select to authenticated using (public.paperwork_role(firm_id) is not null);

create policy "Edit accessible rows" on public.paperwork_invoice_items for all to authenticated using (public.paperwork_role(firm_id) in ('owner','accountant')) with check (public.paperwork_role(firm_id) in ('owner','accountant'));

grant select on public.paperwork_invoice_items to authenticated;

create table if not exists public.paperwork_yearly_taxes (
  firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
  id text not null,
  position integer not null,
  monthly numeric not null default 0,
  currency text not null default 'EUR',
  rsd_per_eur numeric not null default 0,
  primary key (firm_id,id),
  foreign key (firm_id) references public.paperwork_invoice_settings(firm_id) on delete cascade,
  paid_months_explicit boolean not null default false
);

alter table public.paperwork_yearly_taxes enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_yearly_taxes;

drop policy if exists "Edit accessible rows" on public.paperwork_yearly_taxes;

create policy "Read accessible rows" on public.paperwork_yearly_taxes for select to authenticated using (public.paperwork_role(firm_id) is not null);

create policy "Edit accessible rows" on public.paperwork_yearly_taxes for all to authenticated using (public.paperwork_role(firm_id) in ('owner','accountant')) with check (public.paperwork_role(firm_id) in ('owner','accountant'));

grant select on public.paperwork_yearly_taxes to authenticated;

create table if not exists public.paperwork_tax_paid_months (
  firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
  position integer not null,
  parent_id text not null,
  month integer not null default 0,
  primary key (firm_id,parent_id,position),
  foreign key (firm_id,parent_id) references public.paperwork_yearly_taxes(firm_id,id) on delete cascade,
  check (month between 1 and 12),
  unique (firm_id,parent_id,month)
);

create index if not exists paperwork_tax_paid_months_parent on public.paperwork_tax_paid_months (firm_id,parent_id);

alter table public.paperwork_tax_paid_months enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_tax_paid_months;

drop policy if exists "Edit accessible rows" on public.paperwork_tax_paid_months;

create policy "Read accessible rows" on public.paperwork_tax_paid_months for select to authenticated using (public.paperwork_role(firm_id) is not null);

create policy "Edit accessible rows" on public.paperwork_tax_paid_months for all to authenticated using (public.paperwork_role(firm_id) in ('owner','accountant')) with check (public.paperwork_role(firm_id) in ('owner','accountant'));

grant select on public.paperwork_tax_paid_months to authenticated;

create table if not exists public.paperwork_kpo_books (
  firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
  currency text not null default 'EUR',
  entry_template text not null default '',
  book_on text not null default 'paid',
  header_pib text not null default '',
  header_taxpayer text not null default '',
  header_business text not null default '',
  header_seat text not null default '',
  header_taxpayer_code text not null default '',
  header_activity text not null default '',
  primary key (firm_id),
  check (currency in ('EUR','RSD')),
  check (book_on in ('paid','issued'))
);

alter table public.paperwork_kpo_books enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_kpo_books;

drop policy if exists "Edit accessible rows" on public.paperwork_kpo_books;

create policy "Read accessible rows" on public.paperwork_kpo_books for select to authenticated using (public.paperwork_role(firm_id) is not null);

create policy "Edit accessible rows" on public.paperwork_kpo_books for all to authenticated using (public.paperwork_role(firm_id) in ('owner','accountant')) with check (public.paperwork_role(firm_id) in ('owner','accountant'));

grant select on public.paperwork_kpo_books to authenticated;

create table if not exists public.paperwork_kpo_entries (
  firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
  id text not null,
  position integer not null,
  date date,
  description text not null default '',
  products numeric not null default 0,
  services numeric not null default 0,
  source text not null default 'manual',
  invoice_id text,
  primary key (firm_id,id),
  foreign key (firm_id) references public.paperwork_kpo_books(firm_id) on delete cascade,
  foreign key (firm_id,invoice_id) references public.paperwork_invoices(firm_id,id) deferrable initially deferred,
  check (source in ('invoice','import','manual'))
);

alter table public.paperwork_kpo_entries enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_kpo_entries;

drop policy if exists "Edit accessible rows" on public.paperwork_kpo_entries;

create policy "Read accessible rows" on public.paperwork_kpo_entries for select to authenticated using (public.paperwork_role(firm_id) is not null);

create policy "Edit accessible rows" on public.paperwork_kpo_entries for all to authenticated using (public.paperwork_role(firm_id) in ('owner','accountant')) with check (public.paperwork_role(firm_id) in ('owner','accountant'));

grant select on public.paperwork_kpo_entries to authenticated;

create table if not exists public.paperwork_kpo_settled_invoices (
  firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
  position integer not null,
  invoice_id text not null default '',
  primary key (firm_id,position),
  foreign key (firm_id) references public.paperwork_kpo_books(firm_id) on delete cascade,
  foreign key (firm_id,invoice_id) references public.paperwork_invoices(firm_id,id) deferrable initially deferred,
  unique (firm_id,invoice_id)
);

alter table public.paperwork_kpo_settled_invoices enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_kpo_settled_invoices;

drop policy if exists "Edit accessible rows" on public.paperwork_kpo_settled_invoices;

create policy "Read accessible rows" on public.paperwork_kpo_settled_invoices for select to authenticated using (public.paperwork_role(firm_id) is not null);

create policy "Edit accessible rows" on public.paperwork_kpo_settled_invoices for all to authenticated using (public.paperwork_role(firm_id) in ('owner','accountant')) with check (public.paperwork_role(firm_id) in ('owner','accountant'));

grant select on public.paperwork_kpo_settled_invoices to authenticated;

create table if not exists public.paperwork_audit_entries (
  firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
  position integer not null,
  at timestamptz,
  who text not null default '',
  action text not null default '',
  target text not null default '',
  detail text,
  primary key (firm_id,position)
);

alter table public.paperwork_audit_entries enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_audit_entries;

drop policy if exists "Edit accessible rows" on public.paperwork_audit_entries;

create policy "Read accessible rows" on public.paperwork_audit_entries for select to authenticated using (public.paperwork_role(firm_id) is not null);

create policy "Edit accessible rows" on public.paperwork_audit_entries for all to authenticated using (public.paperwork_role(firm_id) in ('owner','accountant')) with check (public.paperwork_role(firm_id) in ('owner','accountant'));

grant select on public.paperwork_audit_entries to authenticated;

create table if not exists public.paperwork_resumes (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  position integer not null,
  name text not null default '',
  created_at timestamptz,
  updated_at timestamptz,
  cover_letter text,
  personal_full_name text not null default '',
  personal_headline text not null default '',
  personal_email text not null default '',
  personal_phone text not null default '',
  personal_location text not null default '',
  personal_website text not null default '',
  personal_linkedin text not null default '',
  personal_github text not null default '',
  personal_photo text not null default '',
  design_template text not null default 'modern',
  design_accent_color text not null default '#4f46e5',
  design_font text not null default 'sans',
  design_density text not null default 'normal',
  design_show_photo boolean not null default true,
  design_language text not null default 'en',
  ats_job_description text not null default '',
  ats_keywords_source text not null default '',
  primary key (user_id,id)
);

alter table public.paperwork_resumes enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_resumes;

drop policy if exists "Edit accessible rows" on public.paperwork_resumes;

create policy "Read accessible rows" on public.paperwork_resumes for select to authenticated using (auth.uid() = user_id);

create policy "Edit accessible rows" on public.paperwork_resumes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.paperwork_resumes to authenticated;

create table if not exists public.paperwork_resume_contacts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  position integer not null,
  parent_id text not null,
  label text not null default '',
  value text not null default '',
  primary key (user_id,id),
  foreign key (user_id,parent_id) references public.paperwork_resumes(user_id,id) on delete cascade
);

create index if not exists paperwork_resume_contacts_parent on public.paperwork_resume_contacts (user_id,parent_id);

alter table public.paperwork_resume_contacts enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_resume_contacts;

drop policy if exists "Edit accessible rows" on public.paperwork_resume_contacts;

create policy "Read accessible rows" on public.paperwork_resume_contacts for select to authenticated using (auth.uid() = user_id);

create policy "Edit accessible rows" on public.paperwork_resume_contacts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.paperwork_resume_contacts to authenticated;

create table if not exists public.paperwork_resume_keywords (
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  parent_id text not null,
  keyword text not null default '',
  primary key (user_id,parent_id,position),
  foreign key (user_id,parent_id) references public.paperwork_resumes(user_id,id) on delete cascade
);

create index if not exists paperwork_resume_keywords_parent on public.paperwork_resume_keywords (user_id,parent_id);

alter table public.paperwork_resume_keywords enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_resume_keywords;

drop policy if exists "Edit accessible rows" on public.paperwork_resume_keywords;

create policy "Read accessible rows" on public.paperwork_resume_keywords for select to authenticated using (auth.uid() = user_id);

create policy "Edit accessible rows" on public.paperwork_resume_keywords for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.paperwork_resume_keywords to authenticated;

create table if not exists public.paperwork_resume_sections (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  position integer not null,
  parent_id text not null,
  kind text not null default '',
  title text not null default '',
  hidden boolean not null default false,
  type text not null default '',
  text text,
  primary key (user_id,id),
  foreign key (user_id,parent_id) references public.paperwork_resumes(user_id,id) on delete cascade,
  check (type in ('text','entries','tags','languages'))
);

create index if not exists paperwork_resume_sections_parent on public.paperwork_resume_sections (user_id,parent_id);

alter table public.paperwork_resume_sections enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_resume_sections;

drop policy if exists "Edit accessible rows" on public.paperwork_resume_sections;

create policy "Read accessible rows" on public.paperwork_resume_sections for select to authenticated using (auth.uid() = user_id);

create policy "Edit accessible rows" on public.paperwork_resume_sections for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.paperwork_resume_sections to authenticated;

create table if not exists public.paperwork_resume_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  position integer not null,
  parent_id text not null,
  title text not null default '',
  subtitle text not null default '',
  location text not null default '',
  start_label text not null default '',
  end_label text not null default '',
  description text not null default '',
  primary key (user_id,id),
  foreign key (user_id,parent_id) references public.paperwork_resume_sections(user_id,id) on delete cascade
);

create index if not exists paperwork_resume_entries_parent on public.paperwork_resume_entries (user_id,parent_id);

alter table public.paperwork_resume_entries enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_resume_entries;

drop policy if exists "Edit accessible rows" on public.paperwork_resume_entries;

create policy "Read accessible rows" on public.paperwork_resume_entries for select to authenticated using (auth.uid() = user_id);

create policy "Edit accessible rows" on public.paperwork_resume_entries for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.paperwork_resume_entries to authenticated;

create table if not exists public.paperwork_resume_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  parent_id text not null,
  tag text not null default '',
  primary key (user_id,parent_id,position),
  foreign key (user_id,parent_id) references public.paperwork_resume_sections(user_id,id) on delete cascade
);

create index if not exists paperwork_resume_tags_parent on public.paperwork_resume_tags (user_id,parent_id);

alter table public.paperwork_resume_tags enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_resume_tags;

drop policy if exists "Edit accessible rows" on public.paperwork_resume_tags;

create policy "Read accessible rows" on public.paperwork_resume_tags for select to authenticated using (auth.uid() = user_id);

create policy "Edit accessible rows" on public.paperwork_resume_tags for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.paperwork_resume_tags to authenticated;

create table if not exists public.paperwork_resume_languages (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  position integer not null,
  parent_id text not null,
  name text not null default '',
  level text not null default '',
  primary key (user_id,id),
  foreign key (user_id,parent_id) references public.paperwork_resume_sections(user_id,id) on delete cascade
);

create index if not exists paperwork_resume_languages_parent on public.paperwork_resume_languages (user_id,parent_id);

alter table public.paperwork_resume_languages enable row level security;

drop policy if exists "Read accessible rows" on public.paperwork_resume_languages;

drop policy if exists "Edit accessible rows" on public.paperwork_resume_languages;

create policy "Read accessible rows" on public.paperwork_resume_languages for select to authenticated using (auth.uid() = user_id);

create policy "Edit accessible rows" on public.paperwork_resume_languages for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.paperwork_resume_languages to authenticated;

create table if not exists public.paperwork_document_versions (
 firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
 key text not null check (key in ('invoices','kpo','audit')),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid references auth.users(id) on delete set null,
 primary key(firm_id,key)
);
create table if not exists public.paperwork_personal_versions (
 user_id uuid not null references auth.users(id) on delete cascade,
 key text not null check (key = 'studio.resumes.v2'),
 updated_at timestamptz not null default clock_timestamp(), primary key(user_id,key)
);
create table if not exists public.paperwork_user_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active_firm_id uuid references public.paperwork_firms(id) on delete set null
);
create table if not exists public.paperwork_open_firms (
 user_id uuid not null references auth.users(id) on delete cascade,
 firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
 position integer not null, primary key(user_id,firm_id)
);

alter table public.paperwork_document_versions enable row level security;

drop policy if exists "Own accessible rows" on public.paperwork_document_versions;

create policy "Own accessible rows" on public.paperwork_document_versions for select to authenticated using (public.paperwork_role(firm_id) is not null);

grant select on public.paperwork_document_versions to authenticated;

alter table public.paperwork_personal_versions enable row level security;

drop policy if exists "Own accessible rows" on public.paperwork_personal_versions;

create policy "Own accessible rows" on public.paperwork_personal_versions for select to authenticated using (user_id=auth.uid());

grant select on public.paperwork_personal_versions to authenticated;

alter table public.paperwork_user_settings enable row level security;

drop policy if exists "Own accessible rows" on public.paperwork_user_settings;

create policy "Own accessible rows" on public.paperwork_user_settings for select to authenticated using (user_id=auth.uid());

grant select on public.paperwork_user_settings to authenticated;

alter table public.paperwork_open_firms enable row level security;

drop policy if exists "Own accessible rows" on public.paperwork_open_firms;

create policy "Own accessible rows" on public.paperwork_open_firms for select to authenticated using (user_id=auth.uid() and public.paperwork_role(firm_id) is not null);

grant select on public.paperwork_open_firms to authenticated;

create or replace function public.paperwork_relational_touch() returns trigger
language plpgsql security definer set search_path=public as $$
declare scope uuid;
begin
 if tg_argv[0]='personal' then
  if tg_op='DELETE' then scope:=old.user_id; else scope:=new.user_id; end if;
  if exists(select 1 from auth.users where id=scope) then
   insert into public.paperwork_personal_versions(user_id,key,updated_at) values(scope,'studio.resumes.v2',clock_timestamp())
   on conflict(user_id,key) do update set updated_at=excluded.updated_at;
  end if;
 else
  if tg_op='DELETE' then scope:=old.firm_id; else scope:=new.firm_id; end if;
  if exists(select 1 from public.paperwork_firms where id=scope) then
   insert into public.paperwork_document_versions(firm_id,key,updated_at,updated_by) values(scope,tg_argv[0],clock_timestamp(),auth.uid())
   on conflict(firm_id,key) do update set updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  end if;
 end if;
 return null;
end $$;

drop trigger if exists paperwork_document_touch on public.paperwork_invoice_settings;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_invoice_settings for each row execute function public.paperwork_relational_touch('invoices');

drop trigger if exists paperwork_document_touch on public.paperwork_clients;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_clients for each row execute function public.paperwork_relational_touch('invoices');

drop trigger if exists paperwork_document_touch on public.paperwork_invoices;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_invoices for each row execute function public.paperwork_relational_touch('invoices');

drop trigger if exists paperwork_document_touch on public.paperwork_invoice_items;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_invoice_items for each row execute function public.paperwork_relational_touch('invoices');

drop trigger if exists paperwork_document_touch on public.paperwork_yearly_taxes;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_yearly_taxes for each row execute function public.paperwork_relational_touch('invoices');

drop trigger if exists paperwork_document_touch on public.paperwork_tax_paid_months;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_tax_paid_months for each row execute function public.paperwork_relational_touch('invoices');

drop trigger if exists paperwork_document_touch on public.paperwork_kpo_books;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_kpo_books for each row execute function public.paperwork_relational_touch('kpo');

drop trigger if exists paperwork_document_touch on public.paperwork_kpo_entries;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_kpo_entries for each row execute function public.paperwork_relational_touch('kpo');

drop trigger if exists paperwork_document_touch on public.paperwork_kpo_settled_invoices;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_kpo_settled_invoices for each row execute function public.paperwork_relational_touch('kpo');

drop trigger if exists paperwork_document_touch on public.paperwork_audit_entries;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_audit_entries for each row execute function public.paperwork_relational_touch('audit');

drop trigger if exists paperwork_document_touch on public.paperwork_resumes;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_resumes for each row execute function public.paperwork_relational_touch('personal');

drop trigger if exists paperwork_document_touch on public.paperwork_resume_contacts;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_resume_contacts for each row execute function public.paperwork_relational_touch('personal');

drop trigger if exists paperwork_document_touch on public.paperwork_resume_keywords;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_resume_keywords for each row execute function public.paperwork_relational_touch('personal');

drop trigger if exists paperwork_document_touch on public.paperwork_resume_sections;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_resume_sections for each row execute function public.paperwork_relational_touch('personal');

drop trigger if exists paperwork_document_touch on public.paperwork_resume_entries;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_resume_entries for each row execute function public.paperwork_relational_touch('personal');

drop trigger if exists paperwork_document_touch on public.paperwork_resume_tags;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_resume_tags for each row execute function public.paperwork_relational_touch('personal');

drop trigger if exists paperwork_document_touch on public.paperwork_resume_languages;

create trigger paperwork_document_touch after insert or update or delete on public.paperwork_resume_languages for each row execute function public.paperwork_relational_touch('personal');

create or replace function public._store_paperwork_resume_languages(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_resume_languages(user_id,id,position,parent_id,name,level) values (p_scope,p_data->>'id',p_position,p_parent,coalesce(p_data #>> '{name}',''),coalesce(p_data #>> '{level}',''));
end $$;

revoke all on function public._store_paperwork_resume_languages(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_resume_languages(r public.paperwork_resume_languages) returns jsonb language sql stable security invoker set search_path=public as $$ select jsonb_build_object('id',r.id,'name',r.name,'level',r.level) $$;

revoke all on function public._read_paperwork_resume_languages(public.paperwork_resume_languages) from public,anon;

grant execute on function public._read_paperwork_resume_languages(public.paperwork_resume_languages) to authenticated;

create or replace function public._store_paperwork_resume_tags(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_resume_tags(user_id,position,parent_id,tag) values (p_scope,p_position,p_parent,coalesce(p_data #>> '{}',''));
end $$;

revoke all on function public._store_paperwork_resume_tags(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_resume_tags(r public.paperwork_resume_tags) returns jsonb language sql stable security invoker set search_path=public as $$ select to_jsonb(r.tag) $$;

revoke all on function public._read_paperwork_resume_tags(public.paperwork_resume_tags) from public,anon;

grant execute on function public._read_paperwork_resume_tags(public.paperwork_resume_tags) to authenticated;

create or replace function public._store_paperwork_resume_entries(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_resume_entries(user_id,id,position,parent_id,title,subtitle,location,start_label,end_label,description) values (p_scope,p_data->>'id',p_position,p_parent,coalesce(p_data #>> '{title}',''),coalesce(p_data #>> '{subtitle}',''),coalesce(p_data #>> '{location}',''),coalesce(p_data #>> '{start}',''),coalesce(p_data #>> '{end}',''),coalesce(p_data #>> '{description}',''));
end $$;

revoke all on function public._store_paperwork_resume_entries(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_resume_entries(r public.paperwork_resume_entries) returns jsonb language sql stable security invoker set search_path=public as $$ select jsonb_build_object('id',r.id,'title',r.title,'subtitle',r.subtitle,'location',r.location,'start',r.start_label,'end',r.end_label,'description',r.description) $$;

revoke all on function public._read_paperwork_resume_entries(public.paperwork_resume_entries) from public,anon;

grant execute on function public._read_paperwork_resume_entries(public.paperwork_resume_entries) to authenticated;

create or replace function public._store_paperwork_resume_sections(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_resume_sections(user_id,id,position,parent_id,kind,title,hidden,type,text) values (p_scope,p_data->>'id',p_position,p_parent,coalesce(p_data #>> '{kind}',''),coalesce(p_data #>> '{title}',''),coalesce(nullif(p_data #>> '{hidden}','')::boolean,false),coalesce(p_data #>> '{type}',''),p_data #>> '{text}');
if p_data->>'type'='entries' then
for item in select value,ordinality from jsonb_array_elements(coalesce(p_data #> '{items}','[]'::jsonb)) with ordinality loop
 perform public._store_paperwork_resume_entries(p_scope,item.value,item.ordinality::integer,p_data->>'id'); end loop;
end if;
if p_data->>'type'='tags' then
for item in select value,ordinality from jsonb_array_elements(coalesce(p_data #> '{items}','[]'::jsonb)) with ordinality loop
 perform public._store_paperwork_resume_tags(p_scope,item.value,item.ordinality::integer,p_data->>'id'); end loop;
end if;
if p_data->>'type'='languages' then
for item in select value,ordinality from jsonb_array_elements(coalesce(p_data #> '{items}','[]'::jsonb)) with ordinality loop
 perform public._store_paperwork_resume_languages(p_scope,item.value,item.ordinality::integer,p_data->>'id'); end loop;
end if;
end $$;

revoke all on function public._store_paperwork_resume_sections(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_resume_sections(r public.paperwork_resume_sections) returns jsonb language sql stable security invoker set search_path=public as $$ select (jsonb_build_object('id',r.id,'kind',r.kind,'title',r.title,'hidden',r.hidden,'type',r.type,'text',r.text,'items',case when r.type='entries' then coalesce((select jsonb_agg(public._read_paperwork_resume_entries(c) order by c.position) from public.paperwork_resume_entries c where c.user_id=r.user_id and c.parent_id=r.id),'[]'::jsonb) when r.type='tags' then coalesce((select jsonb_agg(public._read_paperwork_resume_tags(c) order by c.position) from public.paperwork_resume_tags c where c.user_id=r.user_id and c.parent_id=r.id),'[]'::jsonb) when r.type='languages' then coalesce((select jsonb_agg(public._read_paperwork_resume_languages(c) order by c.position) from public.paperwork_resume_languages c where c.user_id=r.user_id and c.parent_id=r.id),'[]'::jsonb) else '[]'::jsonb end) - case when r.type='text' then 'items' else 'text' end) $$;

revoke all on function public._read_paperwork_resume_sections(public.paperwork_resume_sections) from public,anon;

grant execute on function public._read_paperwork_resume_sections(public.paperwork_resume_sections) to authenticated;

create or replace function public._store_paperwork_resume_keywords(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_resume_keywords(user_id,position,parent_id,keyword) values (p_scope,p_position,p_parent,coalesce(p_data #>> '{}',''));
end $$;

revoke all on function public._store_paperwork_resume_keywords(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_resume_keywords(r public.paperwork_resume_keywords) returns jsonb language sql stable security invoker set search_path=public as $$ select to_jsonb(r.keyword) $$;

revoke all on function public._read_paperwork_resume_keywords(public.paperwork_resume_keywords) from public,anon;

grant execute on function public._read_paperwork_resume_keywords(public.paperwork_resume_keywords) to authenticated;

create or replace function public._store_paperwork_resume_contacts(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_resume_contacts(user_id,id,position,parent_id,label,value) values (p_scope,p_data->>'id',p_position,p_parent,coalesce(p_data #>> '{label}',''),coalesce(p_data #>> '{value}',''));
end $$;

revoke all on function public._store_paperwork_resume_contacts(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_resume_contacts(r public.paperwork_resume_contacts) returns jsonb language sql stable security invoker set search_path=public as $$ select jsonb_build_object('id',r.id,'label',r.label,'value',r.value) $$;

revoke all on function public._read_paperwork_resume_contacts(public.paperwork_resume_contacts) from public,anon;

grant execute on function public._read_paperwork_resume_contacts(public.paperwork_resume_contacts) to authenticated;

create or replace function public._store_paperwork_resumes(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_resumes(user_id,id,position,name,created_at,updated_at,cover_letter,personal_full_name,personal_headline,personal_email,personal_phone,personal_location,personal_website,personal_linkedin,personal_github,personal_photo,design_template,design_accent_color,design_font,design_density,design_show_photo,design_language,ats_job_description,ats_keywords_source) values (p_scope,p_data->>'id',p_position,coalesce(p_data #>> '{name}',''),nullif(p_data #>> '{createdAt}','')::timestamptz,nullif(p_data #>> '{updatedAt}','')::timestamptz,p_data #>> '{coverLetter}',coalesce(p_data #>> '{personal,fullName}',''),coalesce(p_data #>> '{personal,headline}',''),coalesce(p_data #>> '{personal,email}',''),coalesce(p_data #>> '{personal,phone}',''),coalesce(p_data #>> '{personal,location}',''),coalesce(p_data #>> '{personal,website}',''),coalesce(p_data #>> '{personal,linkedin}',''),coalesce(p_data #>> '{personal,github}',''),coalesce(p_data #>> '{personal,photo}',''),coalesce(p_data #>> '{design,template}','modern'),coalesce(p_data #>> '{design,accentColor}','#4f46e5'),coalesce(p_data #>> '{design,font}','sans'),coalesce(p_data #>> '{design,density}','normal'),coalesce(nullif(p_data #>> '{design,showPhoto}','')::boolean,true),coalesce(p_data #>> '{design,language}','en'),coalesce(p_data #>> '{ats,jobDescription}',''),coalesce(p_data #>> '{ats,keywordsSource}',''));
for item in select value,ordinality from jsonb_array_elements(coalesce(p_data #> '{personal,extras}','[]'::jsonb)) with ordinality loop
 perform public._store_paperwork_resume_contacts(p_scope,item.value,item.ordinality::integer,p_data->>'id'); end loop;
for item in select value,ordinality from jsonb_array_elements(coalesce(p_data #> '{ats,keywords}','[]'::jsonb)) with ordinality loop
 perform public._store_paperwork_resume_keywords(p_scope,item.value,item.ordinality::integer,p_data->>'id'); end loop;
for item in select value,ordinality from jsonb_array_elements(coalesce(p_data #> '{sections}','[]'::jsonb)) with ordinality loop
 perform public._store_paperwork_resume_sections(p_scope,item.value,item.ordinality::integer,p_data->>'id'); end loop;
end $$;

revoke all on function public._store_paperwork_resumes(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_resumes(r public.paperwork_resumes) returns jsonb language sql stable security invoker set search_path=public as $$ select jsonb_build_object('id',r.id,'name',r.name,'createdAt',r.created_at,'updatedAt',r.updated_at,'coverLetter',r.cover_letter,'personal',jsonb_build_object('fullName',r.personal_full_name,'headline',r.personal_headline,'email',r.personal_email,'phone',r.personal_phone,'location',r.personal_location,'website',r.personal_website,'linkedin',r.personal_linkedin,'github',r.personal_github,'photo',r.personal_photo,'extras',coalesce((select jsonb_agg(public._read_paperwork_resume_contacts(c) order by c.position) from public.paperwork_resume_contacts c where c.user_id=r.user_id and c.parent_id=r.id),'[]'::jsonb)),'design',jsonb_build_object('template',r.design_template,'accentColor',r.design_accent_color,'font',r.design_font,'density',r.design_density,'showPhoto',r.design_show_photo,'language',r.design_language),'ats',jsonb_build_object('jobDescription',r.ats_job_description,'keywordsSource',r.ats_keywords_source,'keywords',coalesce((select jsonb_agg(public._read_paperwork_resume_keywords(c) order by c.position) from public.paperwork_resume_keywords c where c.user_id=r.user_id and c.parent_id=r.id),'[]'::jsonb)),'sections',coalesce((select jsonb_agg(public._read_paperwork_resume_sections(c) order by c.position) from public.paperwork_resume_sections c where c.user_id=r.user_id and c.parent_id=r.id),'[]'::jsonb)) $$;

revoke all on function public._read_paperwork_resumes(public.paperwork_resumes) from public,anon;

grant execute on function public._read_paperwork_resumes(public.paperwork_resumes) to authenticated;

create or replace function public._store_paperwork_audit_entries(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_audit_entries(firm_id,position,at,who,action,target,detail) values (p_scope,p_position,nullif(p_data #>> '{at}','')::timestamptz,coalesce(p_data #>> '{who}',''),coalesce(p_data #>> '{action}',''),coalesce(p_data #>> '{target}',''),p_data #>> '{detail}');
end $$;

revoke all on function public._store_paperwork_audit_entries(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_audit_entries(r public.paperwork_audit_entries) returns jsonb language sql stable security invoker set search_path=public as $$ select jsonb_build_object('at',r.at,'who',r.who,'action',r.action,'target',r.target,'detail',r.detail) $$;

revoke all on function public._read_paperwork_audit_entries(public.paperwork_audit_entries) from public,anon;

grant execute on function public._read_paperwork_audit_entries(public.paperwork_audit_entries) to authenticated;

create or replace function public._store_paperwork_kpo_settled_invoices(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_kpo_settled_invoices(firm_id,position,invoice_id) values (p_scope,p_position,coalesce(p_data #>> '{}',''));
end $$;

revoke all on function public._store_paperwork_kpo_settled_invoices(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_kpo_settled_invoices(r public.paperwork_kpo_settled_invoices) returns jsonb language sql stable security invoker set search_path=public as $$ select to_jsonb(r.invoice_id) $$;

revoke all on function public._read_paperwork_kpo_settled_invoices(public.paperwork_kpo_settled_invoices) from public,anon;

grant execute on function public._read_paperwork_kpo_settled_invoices(public.paperwork_kpo_settled_invoices) to authenticated;

create or replace function public._store_paperwork_kpo_entries(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_kpo_entries(firm_id,id,position,date,description,products,services,source,invoice_id) values (p_scope,p_data->>'id',p_position,nullif(p_data #>> '{date}','')::date,coalesce(p_data #>> '{description}',''),coalesce(nullif(p_data #>> '{products}','')::numeric,0),coalesce(nullif(p_data #>> '{services}','')::numeric,0),coalesce(p_data #>> '{source}','manual'),p_data #>> '{invoiceId}');
end $$;

revoke all on function public._store_paperwork_kpo_entries(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_kpo_entries(r public.paperwork_kpo_entries) returns jsonb language sql stable security invoker set search_path=public as $$ select jsonb_build_object('id',r.id,'date',r.date,'description',r.description,'products',r.products,'services',r.services,'source',r.source,'invoiceId',r.invoice_id) $$;

revoke all on function public._read_paperwork_kpo_entries(public.paperwork_kpo_entries) from public,anon;

grant execute on function public._read_paperwork_kpo_entries(public.paperwork_kpo_entries) to authenticated;

create or replace function public._store_paperwork_kpo_books(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_kpo_books(firm_id,currency,entry_template,book_on,header_pib,header_taxpayer,header_business,header_seat,header_taxpayer_code,header_activity) values (p_scope,coalesce(p_data #>> '{currency}','EUR'),coalesce(p_data #>> '{entryTemplate}',''),coalesce(p_data #>> '{bookOn}','paid'),coalesce(p_data #>> '{header,pib}',''),coalesce(p_data #>> '{header,taxpayer}',''),coalesce(p_data #>> '{header,business}',''),coalesce(p_data #>> '{header,seat}',''),coalesce(p_data #>> '{header,taxpayerCode}',''),coalesce(p_data #>> '{header,activity}',''));
for item in select value,ordinality from jsonb_array_elements(coalesce(p_data #> '{entries}','[]'::jsonb)) with ordinality loop
 perform public._store_paperwork_kpo_entries(p_scope,item.value,item.ordinality::integer,null); end loop;
for item in select value,ordinality from jsonb_array_elements(coalesce(p_data #> '{settledInvoiceIds}','[]'::jsonb)) with ordinality loop
 perform public._store_paperwork_kpo_settled_invoices(p_scope,item.value,item.ordinality::integer,null); end loop;
end $$;

revoke all on function public._store_paperwork_kpo_books(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_kpo_books(r public.paperwork_kpo_books) returns jsonb language sql stable security invoker set search_path=public as $$ select jsonb_build_object('version',1,'currency',r.currency,'entryTemplate',r.entry_template,'bookOn',r.book_on,'header',jsonb_build_object('pib',r.header_pib,'taxpayer',r.header_taxpayer,'business',r.header_business,'seat',r.header_seat,'taxpayerCode',r.header_taxpayer_code,'activity',r.header_activity),'entries',coalesce((select jsonb_agg(public._read_paperwork_kpo_entries(c) order by c.position) from public.paperwork_kpo_entries c where c.firm_id=r.firm_id),'[]'::jsonb),'settledInvoiceIds',coalesce((select jsonb_agg(public._read_paperwork_kpo_settled_invoices(c) order by c.position) from public.paperwork_kpo_settled_invoices c where c.firm_id=r.firm_id),'[]'::jsonb)) $$;

revoke all on function public._read_paperwork_kpo_books(public.paperwork_kpo_books) from public,anon;

grant execute on function public._read_paperwork_kpo_books(public.paperwork_kpo_books) to authenticated;

create or replace function public._store_paperwork_tax_paid_months(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_tax_paid_months(firm_id,position,parent_id,month) values (p_scope,p_position,p_parent,coalesce(nullif(p_data #>> '{}','')::integer,0));
end $$;

revoke all on function public._store_paperwork_tax_paid_months(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_tax_paid_months(r public.paperwork_tax_paid_months) returns jsonb language sql stable security invoker set search_path=public as $$ select to_jsonb(r.month) $$;

revoke all on function public._read_paperwork_tax_paid_months(public.paperwork_tax_paid_months) from public,anon;

grant execute on function public._read_paperwork_tax_paid_months(public.paperwork_tax_paid_months) to authenticated;

create or replace function public._store_paperwork_yearly_taxes(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_yearly_taxes(firm_id,id,position,monthly,currency,rsd_per_eur,paid_months_explicit) values (p_scope,p_parent,p_position,coalesce(nullif(p_data #>> '{monthly}','')::numeric,0),coalesce(p_data #>> '{currency}','EUR'),coalesce(nullif(p_data #>> '{rsdPerEur}','')::numeric,0),p_data ? 'paidMonths');
for item in select value,ordinality from jsonb_array_elements(coalesce(p_data #> '{paidMonths}','[]'::jsonb)) with ordinality loop
 perform public._store_paperwork_tax_paid_months(p_scope,item.value,item.ordinality::integer,p_parent); end loop;
end $$;

revoke all on function public._store_paperwork_yearly_taxes(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_yearly_taxes(r public.paperwork_yearly_taxes) returns jsonb language sql stable security invoker set search_path=public as $$ select (jsonb_build_object('monthly',r.monthly,'currency',r.currency,'rsdPerEur',r.rsd_per_eur,'paidMonths',coalesce((select jsonb_agg(public._read_paperwork_tax_paid_months(c) order by c.position) from public.paperwork_tax_paid_months c where c.firm_id=r.firm_id and c.parent_id=r.id),'[]'::jsonb)) - case when r.paid_months_explicit then '' else 'paidMonths' end) $$;

revoke all on function public._read_paperwork_yearly_taxes(public.paperwork_yearly_taxes) from public,anon;

grant execute on function public._read_paperwork_yearly_taxes(public.paperwork_yearly_taxes) to authenticated;

create or replace function public._store_paperwork_invoice_items(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_invoice_items(firm_id,id,position,parent_id,title,description,quantity,unit,unit_price) values (p_scope,p_data->>'id',p_position,p_parent,coalesce(p_data #>> '{title}',''),coalesce(p_data #>> '{description}',''),coalesce(nullif(p_data #>> '{quantity}','')::numeric,1),coalesce(p_data #>> '{unit}','h'),coalesce(nullif(p_data #>> '{unitPrice}','')::numeric,0));
end $$;

revoke all on function public._store_paperwork_invoice_items(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_invoice_items(r public.paperwork_invoice_items) returns jsonb language sql stable security invoker set search_path=public as $$ select jsonb_build_object('id',r.id,'title',r.title,'description',r.description,'quantity',r.quantity,'unit',r.unit,'unitPrice',r.unit_price) $$;

revoke all on function public._read_paperwork_invoice_items(public.paperwork_invoice_items) from public,anon;

grant execute on function public._read_paperwork_invoice_items(public.paperwork_invoice_items) to authenticated;

create or replace function public._store_paperwork_invoices(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_invoices(firm_id,id,position,number,status,issue_date,service_date,due_date,billing_period,currency,vat_percent,client_id,note,logo,signature,paid_at,repeat_day,created_at,updated_at,issuer_name,issuer_address,issuer_city_country,issuer_tax_id_label,issuer_tax_id,issuer_reg_id_label,issuer_reg_no,issuer_email,client_name,client_address,client_city_country,client_tax_id_label,client_tax_id,client_reg_id_label,client_reg_no,client_email,bank_iban,bank_swift,bank_bank_name,design_template,design_accent_color,design_language,design_seasonal_month,design_seasonal_variant) values (p_scope,p_data->>'id',p_position,coalesce(p_data #>> '{number}',''),coalesce(p_data #>> '{status}','draft'),nullif(p_data #>> '{issueDate}','')::date,nullif(p_data #>> '{serviceDate}','')::date,nullif(p_data #>> '{dueDate}','')::date,coalesce(p_data #>> '{billingPeriod}',''),coalesce(p_data #>> '{currency}','EUR'),coalesce(nullif(p_data #>> '{vatPercent}','')::numeric,0),p_data #>> '{clientId}',coalesce(p_data #>> '{note}',''),coalesce(p_data #>> '{logo}',''),coalesce(p_data #>> '{signature}',''),nullif(p_data #>> '{paidAt}','')::date,nullif(p_data #>> '{repeatDay}','')::integer,nullif(p_data #>> '{createdAt}','')::timestamptz,nullif(p_data #>> '{updatedAt}','')::timestamptz,coalesce(p_data #>> '{issuer,name}',''),coalesce(p_data #>> '{issuer,address}',''),coalesce(p_data #>> '{issuer,cityCountry}',''),coalesce(p_data #>> '{issuer,taxIdLabel}',''),coalesce(p_data #>> '{issuer,taxId}',''),coalesce(p_data #>> '{issuer,regIdLabel}',''),coalesce(p_data #>> '{issuer,regNo}',''),coalesce(p_data #>> '{issuer,email}',''),coalesce(p_data #>> '{client,name}',''),coalesce(p_data #>> '{client,address}',''),coalesce(p_data #>> '{client,cityCountry}',''),coalesce(p_data #>> '{client,taxIdLabel}',''),coalesce(p_data #>> '{client,taxId}',''),coalesce(p_data #>> '{client,regIdLabel}',''),coalesce(p_data #>> '{client,regNo}',''),coalesce(p_data #>> '{client,email}',''),coalesce(p_data #>> '{bank,iban}',''),coalesce(p_data #>> '{bank,swift}',''),coalesce(p_data #>> '{bank,bankName}',''),coalesce(p_data #>> '{design,template}','modern'),coalesce(p_data #>> '{design,accentColor}','#4f46e5'),coalesce(p_data #>> '{design,language}','en'),p_data #>> '{design,seasonalMonth}',nullif(p_data #>> '{design,seasonalVariant}','')::integer);
for item in select value,ordinality from jsonb_array_elements(coalesce(p_data #> '{items}','[]'::jsonb)) with ordinality loop
 perform public._store_paperwork_invoice_items(p_scope,item.value,item.ordinality::integer,p_data->>'id'); end loop;
end $$;

revoke all on function public._store_paperwork_invoices(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_invoices(r public.paperwork_invoices) returns jsonb language sql stable security invoker set search_path=public as $$ select jsonb_build_object('id',r.id,'number',r.number,'status',r.status,'issueDate',r.issue_date,'serviceDate',r.service_date,'dueDate',r.due_date,'billingPeriod',r.billing_period,'currency',r.currency,'vatPercent',r.vat_percent,'clientId',r.client_id,'note',r.note,'logo',r.logo,'signature',r.signature,'paidAt',r.paid_at,'repeatDay',r.repeat_day,'createdAt',r.created_at,'updatedAt',r.updated_at,'issuer',jsonb_build_object('name',r.issuer_name,'address',r.issuer_address,'cityCountry',r.issuer_city_country,'taxIdLabel',r.issuer_tax_id_label,'taxId',r.issuer_tax_id,'regIdLabel',r.issuer_reg_id_label,'regNo',r.issuer_reg_no,'email',r.issuer_email),'client',jsonb_build_object('name',r.client_name,'address',r.client_address,'cityCountry',r.client_city_country,'taxIdLabel',r.client_tax_id_label,'taxId',r.client_tax_id,'regIdLabel',r.client_reg_id_label,'regNo',r.client_reg_no,'email',r.client_email),'bank',jsonb_build_object('iban',r.bank_iban,'swift',r.bank_swift,'bankName',r.bank_bank_name),'design',jsonb_build_object('template',r.design_template,'accentColor',r.design_accent_color,'language',r.design_language,'seasonalMonth',r.design_seasonal_month,'seasonalVariant',r.design_seasonal_variant),'items',coalesce((select jsonb_agg(public._read_paperwork_invoice_items(c) order by c.position) from public.paperwork_invoice_items c where c.firm_id=r.firm_id and c.parent_id=r.id),'[]'::jsonb)) $$;

revoke all on function public._read_paperwork_invoices(public.paperwork_invoices) from public,anon;

grant execute on function public._read_paperwork_invoices(public.paperwork_invoices) to authenticated;

create or replace function public._store_paperwork_clients(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_clients(firm_id,id,position,name,address,city_country,tax_id_label,tax_id,reg_id_label,reg_no,email,currency,last_used_at) values (p_scope,p_data->>'id',p_position,coalesce(p_data #>> '{party,name}',''),coalesce(p_data #>> '{party,address}',''),coalesce(p_data #>> '{party,cityCountry}',''),coalesce(p_data #>> '{party,taxIdLabel}',''),coalesce(p_data #>> '{party,taxId}',''),coalesce(p_data #>> '{party,regIdLabel}',''),coalesce(p_data #>> '{party,regNo}',''),coalesce(p_data #>> '{party,email}',''),coalesce(p_data #>> '{currency}','EUR'),coalesce(p_data #>> '{lastUsedAt}',''));
end $$;

revoke all on function public._store_paperwork_clients(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_clients(r public.paperwork_clients) returns jsonb language sql stable security invoker set search_path=public as $$ select jsonb_build_object('id',r.id,'party',jsonb_build_object('name',r.name,'address',r.address,'cityCountry',r.city_country,'taxIdLabel',r.tax_id_label,'taxId',r.tax_id,'regIdLabel',r.reg_id_label,'regNo',r.reg_no,'email',r.email),'currency',r.currency,'lastUsedAt',r.last_used_at) $$;

revoke all on function public._read_paperwork_clients(public.paperwork_clients) from public,anon;

grant execute on function public._read_paperwork_clients(public.paperwork_clients) to authenticated;

create or replace function public._store_paperwork_invoice_settings(p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null) returns void language plpgsql set search_path=public as $$ declare item record; begin
insert into public.paperwork_invoice_settings(firm_id,issuer_name,issuer_address,issuer_city_country,issuer_tax_id_label,issuer_tax_id,issuer_reg_id_label,issuer_reg_no,issuer_email,bank_iban,bank_swift,bank_bank_name,logo,signature,default_currency,default_vat_percent,default_payment_days,default_note,default_number_prefix,default_language,default_template,default_accent_color,default_unit) values (p_scope,coalesce(p_data #>> '{profile,party,name}',''),coalesce(p_data #>> '{profile,party,address}',''),coalesce(p_data #>> '{profile,party,cityCountry}',''),coalesce(p_data #>> '{profile,party,taxIdLabel}',''),coalesce(p_data #>> '{profile,party,taxId}',''),coalesce(p_data #>> '{profile,party,regIdLabel}',''),coalesce(p_data #>> '{profile,party,regNo}',''),coalesce(p_data #>> '{profile,party,email}',''),coalesce(p_data #>> '{profile,bank,iban}',''),coalesce(p_data #>> '{profile,bank,swift}',''),coalesce(p_data #>> '{profile,bank,bankName}',''),coalesce(p_data #>> '{profile,logo}',''),coalesce(p_data #>> '{profile,signature}',''),coalesce(p_data #>> '{profile,defaults,currency}','EUR'),coalesce(nullif(p_data #>> '{profile,defaults,vatPercent}','')::numeric,0),coalesce(nullif(p_data #>> '{profile,defaults,paymentDays}','')::integer,14),coalesce(p_data #>> '{profile,defaults,note}',''),coalesce(p_data #>> '{profile,defaults,numberPrefix}',''),coalesce(p_data #>> '{profile,defaults,language}','en'),coalesce(p_data #>> '{profile,defaults,template}','modern'),coalesce(p_data #>> '{profile,defaults,accentColor}','#4f46e5'),coalesce(p_data #>> '{profile,defaults,unit}','h'));
for item in select value,ordinality from jsonb_array_elements(coalesce(p_data #> '{clients}','[]'::jsonb)) with ordinality loop
 perform public._store_paperwork_clients(p_scope,item.value,item.ordinality::integer,null); end loop;
for item in select value,ordinality from jsonb_array_elements(coalesce(p_data #> '{invoices}','[]'::jsonb)) with ordinality loop
 perform public._store_paperwork_invoices(p_scope,item.value,item.ordinality::integer,null); end loop;
for item in select key,value from jsonb_each(coalesce(p_data #> '{profile,yearlyTax}','{}'::jsonb)) loop
 perform public._store_paperwork_yearly_taxes(p_scope,item.value,0,item.key); end loop;
end $$;

revoke all on function public._store_paperwork_invoice_settings(uuid,jsonb,integer,text) from public,anon,authenticated;

create or replace function public._read_paperwork_invoice_settings(r public.paperwork_invoice_settings) returns jsonb language sql stable security invoker set search_path=public as $$ select jsonb_build_object('version',2,'profile',jsonb_build_object('party',jsonb_build_object('name',r.issuer_name,'address',r.issuer_address,'cityCountry',r.issuer_city_country,'taxIdLabel',r.issuer_tax_id_label,'taxId',r.issuer_tax_id,'regIdLabel',r.issuer_reg_id_label,'regNo',r.issuer_reg_no,'email',r.issuer_email),'bank',jsonb_build_object('iban',r.bank_iban,'swift',r.bank_swift,'bankName',r.bank_bank_name),'logo',r.logo,'signature',r.signature,'defaults',jsonb_build_object('currency',r.default_currency,'vatPercent',r.default_vat_percent,'paymentDays',r.default_payment_days,'note',r.default_note,'numberPrefix',r.default_number_prefix,'language',r.default_language,'template',r.default_template,'accentColor',r.default_accent_color,'unit',r.default_unit),'yearlyTax',coalesce((select jsonb_object_agg(c.id,public._read_paperwork_yearly_taxes(c)) from public.paperwork_yearly_taxes c where c.firm_id=r.firm_id),'{}'::jsonb)),'clients',coalesce((select jsonb_agg(public._read_paperwork_clients(c) order by c.position) from public.paperwork_clients c where c.firm_id=r.firm_id),'[]'::jsonb),'invoices',coalesce((select jsonb_agg(public._read_paperwork_invoices(c) order by c.position) from public.paperwork_invoices c where c.firm_id=r.firm_id),'[]'::jsonb)) $$;

revoke all on function public._read_paperwork_invoice_settings(public.paperwork_invoice_settings) from public,anon;

grant execute on function public._read_paperwork_invoice_settings(public.paperwork_invoice_settings) to authenticated;

create or replace function public._paperwork_write(p_scope uuid,p_key text,p_data jsonb,p_personal boolean) returns timestamptz
language plpgsql set search_path=public as $$
declare item record; stamp timestamptz;
begin
 if p_personal then
  if p_key <> 'studio.resumes.v2' then raise exception 'Unknown personal document'; end if;
  delete from public.paperwork_resumes where user_id=p_scope;
  for item in select value,ordinality from jsonb_array_elements(coalesce(p_data->'resumes','[]')) with ordinality loop
   perform public._store_paperwork_resumes(p_scope,item.value,item.ordinality::integer);
  end loop;
  insert into public.paperwork_personal_versions(user_id,key,updated_at) values(p_scope,p_key,clock_timestamp())
  on conflict(user_id,key) do update set updated_at=excluded.updated_at returning updated_at into stamp;
 else
  if p_key='invoices' then
   delete from public.paperwork_invoice_settings where firm_id=p_scope;
   perform public._store_paperwork_invoice_settings(p_scope,p_data);
  elsif p_key='kpo' then
   delete from public.paperwork_kpo_books where firm_id=p_scope;
   perform public._store_paperwork_kpo_books(p_scope,p_data);
  elsif p_key='audit' then
   delete from public.paperwork_audit_entries where firm_id=p_scope;
   for item in select value,ordinality from jsonb_array_elements(p_data) with ordinality loop
    perform public._store_paperwork_audit_entries(p_scope,item.value,item.ordinality::integer);
   end loop;
  else raise exception 'Unknown firm document'; end if;
  insert into public.paperwork_document_versions(firm_id,key,updated_at,updated_by) values(p_scope,p_key,clock_timestamp(),auth.uid())
  on conflict(firm_id,key) do update set updated_at=excluded.updated_at,updated_by=excluded.updated_by returning updated_at into stamp;
 end if;
 return stamp;
end $$;
revoke all on function public._paperwork_write(uuid,text,jsonb,boolean) from public,anon,authenticated;

create or replace function public.paperwork_save_document(p_firm_id uuid,p_key text,p_data jsonb,p_expected timestamptz default null)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare previous timestamptz; scope uuid := coalesce(p_firm_id,auth.uid());
begin
 if auth.uid() is null then raise exception 'Sign in before saving'; end if;
 if p_firm_id is not null and coalesce(public.paperwork_role(p_firm_id),'') not in ('owner','accountant') then
  raise exception 'No permission to edit this firm';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('paperwork-doc:'||scope::text||':'||p_key,0));
 if p_firm_id is null then
  select updated_at into previous from public.paperwork_personal_versions where user_id=scope and key=p_key;
 else
  select updated_at into previous from public.paperwork_document_versions where firm_id=scope and key=p_key;
 end if;
 if p_expected is not null and previous is distinct from p_expected then
  raise exception 'The database document changed. Reload before saving.' using errcode='40001';
 end if;
 return public._paperwork_write(scope,p_key,p_data,p_firm_id is null);
end $$;
revoke all on function public.paperwork_save_document(uuid,text,jsonb,timestamptz) from public,anon;
grant execute on function public.paperwork_save_document(uuid,text,jsonb,timestamptz) to authenticated;

create or replace function public.paperwork_initialize_firm(p_firm_id uuid,p_data jsonb) returns void
language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is null or coalesce(public.paperwork_role(p_firm_id),'') not in ('owner','accountant') then raise exception 'Firm access denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended('paperwork-doc:'||p_firm_id::text||':invoices',0));
 if not exists(select 1 from public.paperwork_document_versions where firm_id=p_firm_id and key='invoices') then
  perform public._paperwork_write(p_firm_id,'invoices',p_data,false);
 end if;
end $$;
revoke all on function public.paperwork_initialize_firm(uuid,jsonb) from public,anon;
grant execute on function public.paperwork_initialize_firm(uuid,jsonb) to authenticated;

create or replace function public.paperwork_restore_documents(p_documents jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare doc jsonb;
begin
 for doc in select value from jsonb_array_elements(p_documents) order by value->>'firm_id',case value->>'key' when 'invoices' then 0 when 'kpo' then 1 else 2 end loop
  perform public.paperwork_save_document(nullif(doc->>'firm_id','')::uuid,doc->>'key',doc->'data');
 end loop;
end $$;
revoke all on function public.paperwork_restore_documents(jsonb) from public,anon;
grant execute on function public.paperwork_restore_documents(jsonb) to authenticated;

create or replace function public.paperwork_read_documents(p_firm_ids uuid[] default '{}',p_personal boolean default true)
returns table(firm_id uuid,key text,data jsonb,updated_at timestamptz)
language sql stable security invoker set search_path=public as $$
 select v.firm_id,v.key,
 case v.key
 when 'invoices' then (select public._read_paperwork_invoice_settings(s) from public.paperwork_invoice_settings s where s.firm_id=v.firm_id)
 when 'kpo' then (select public._read_paperwork_kpo_books(s) from public.paperwork_kpo_books s where s.firm_id=v.firm_id)
 when 'audit' then coalesce((select jsonb_agg(public._read_paperwork_audit_entries(s) order by s.position) from public.paperwork_audit_entries s where s.firm_id=v.firm_id),'[]')
 end,v.updated_at from public.paperwork_document_versions v where v.firm_id=any(p_firm_ids)
 union all
 select null::uuid,v.key,jsonb_build_object('version',2,'resumes',coalesce((select jsonb_agg(public._read_paperwork_resumes(r) order by r.position) from public.paperwork_resumes r where r.user_id=auth.uid()),'[]')),v.updated_at
 from public.paperwork_personal_versions v where p_personal and v.user_id=auth.uid()
$$;
revoke all on function public.paperwork_read_documents(uuid[],boolean) from public,anon;
grant execute on function public.paperwork_read_documents(uuid[],boolean) to authenticated;

create or replace function public.paperwork_select_firms(p_firm_ids uuid[],p_active_firm_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in before selecting firms'; end if;
 if exists(select 1 from unnest(p_firm_ids) f where public.paperwork_role(f) is null) then raise exception 'Firm access denied'; end if;
 if p_active_firm_id is not null and not p_active_firm_id=any(p_firm_ids) then raise exception 'Active firm must be selected'; end if;
 insert into public.paperwork_user_settings(user_id,active_firm_id) values(auth.uid(),p_active_firm_id)
 on conflict(user_id) do update set active_firm_id=excluded.active_firm_id;
 delete from public.paperwork_open_firms where user_id=auth.uid();
 insert into public.paperwork_open_firms(user_id,firm_id,position) select auth.uid(),id,ordinality::integer from unnest(p_firm_ids) with ordinality a(id,ordinality);
end $$;
revoke all on function public.paperwork_select_firms(uuid[],uuid) from public,anon;
grant execute on function public.paperwork_select_firms(uuid[],uuid) to authenticated;


do $$ declare row record; item record; begin
 for row in select * from public.paperwork_firm_data order by case key when 'invoices' then 0 when 'kpo' then 1 else 2 end loop
  perform public._paperwork_write(row.firm_id,row.key,row.data,false);
  update public.paperwork_document_versions set updated_at=row.updated_at,updated_by=row.updated_by where firm_id=row.firm_id and key=row.key;
 end loop;
 for row in select * from public.paperwork_data loop
  if row.key='studio.resumes.v2' then
   perform public._paperwork_write(row.user_id,row.key,row.data,true);
   update public.paperwork_personal_versions set updated_at=row.updated_at where user_id=row.user_id and key=row.key;
  elsif row.key='studio.firm-selection' then
   insert into public.paperwork_user_settings(user_id,active_firm_id)
   select row.user_id,f.id from public.paperwork_firms f where f.id::text=row.data->>'activeFirmId';
   if not found then insert into public.paperwork_user_settings(user_id) values(row.user_id); end if;
   insert into public.paperwork_open_firms(user_id,firm_id,position)
   select row.user_id,f.id,a.ordinality::integer from jsonb_array_elements_text(coalesce(row.data->'firmIds','[]')) with ordinality a(id,ordinality)
   join public.paperwork_firms f on f.id::text=a.id join public.paperwork_members m on m.firm_id=f.id and m.user_id=row.user_id;
  else raise exception 'Unrecognized personal dataset %. Migration stopped to preserve it.',row.key;
  end if;
 end loop;
end $$;

-- Identity checks now read typed columns; legacy duplicate identities stay visible and cannot multiply.
create or replace function public.paperwork_check_firm_identity() returns trigger
language plpgsql security definer set search_path=public as $$ begin
 new.tax_id := public.paperwork_normalize_tax_id(new.tax_id);
 if new.tax_id is null then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended('paperwork-pib:'||new.tax_id,0));
 if exists(select 1 from public.paperwork_firms f left join public.paperwork_invoice_settings s on s.firm_id=f.id
 where f.id<>new.id and (f.tax_id=new.tax_id or public.paperwork_normalize_tax_id(s.issuer_tax_id)=new.tax_id)) then
 raise exception 'A firm with this PIB already exists.' using errcode='23505'; end if;
 return new;
end $$;

create or replace function public.paperwork_relational_profile_identity() returns trigger
language plpgsql security definer set search_path=public as $$
declare registered text; identity text := public.paperwork_normalize_tax_id(new.issuer_tax_id);
begin
 select tax_id into registered from public.paperwork_firms where id=new.firm_id;
 if identity is not null and identity is distinct from registered then
  update public.paperwork_firms set tax_id=identity where id=new.firm_id;
 end if;
 return new;
end $$;
drop trigger if exists paperwork_profile_identity on public.paperwork_invoice_settings;
create trigger paperwork_profile_identity before insert or update of issuer_tax_id on public.paperwork_invoice_settings
 for each row execute function public.paperwork_relational_profile_identity();

create or replace function public.paperwork_connect_firm(p_name text,p_tax_id text) returns uuid
language plpgsql security definer set search_path=public as $$
declare identity text := public.paperwork_normalize_tax_id(p_tax_id); ids uuid[]; result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in before creating a firm'; end if;
 if identity is null then raise exception 'PIB is required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('paperwork-pib:'||identity,0));
 select array_agg(f.id) into ids from public.paperwork_firms f left join public.paperwork_invoice_settings s on s.firm_id=f.id
 where f.tax_id=identity or public.paperwork_normalize_tax_id(s.issuer_tax_id)=identity;
 if cardinality(ids)>1 then raise exception 'Existing duplicate PIBs require explicit cleanup'; end if;
 if cardinality(ids)=1 then
  if public.paperwork_role(ids[1]) is null then raise exception 'Ask the firm owner for access'; end if;
  return ids[1];
 end if;
 insert into public.paperwork_firms(name,tax_id,created_by) values(trim(coalesce(p_name,'')),identity,auth.uid()) returning id into result;
 return result;
end $$;

-- The transaction and foreign keys prevent partial conversion. No JSON document tables remain.
drop table public.paperwork_firm_data;
drop table public.paperwork_data;
drop function public.paperwork_profile_identity();
notify pgrst,'reload schema';
commit;

