"""Generate the explicit relational schema and JSON transport adapters.

JSON exists only at the API boundary; every persisted value is a typed column.
Run from the repository root: python supabase/generate-relational.py
"""
from pathlib import Path

OUT = Path('supabase/migrations/20261007140000_relational_documents.sql')
sql = ['-- Relational documents. JSON is a transport format only, never a stored column.', 'begin;']
nodes = []

def fields(spec, prefix=''):
    return [(prefix + name, path, kind, default) for name, path, kind, default in spec]

party = [(name, name2, 'text', "''") for name, name2 in [
    ('name','name'), ('address','address'), ('city_country','cityCountry'),
    ('tax_id_label','taxIdLabel'), ('tax_id','taxId'), ('reg_id_label','regIdLabel'),
    ('reg_no','regNo'), ('email','email')]]
bank = [('iban','iban','text',"''"), ('swift','swift','text',"''"), ('bank_name','bankName','text',"''")]

def nested(spec, column_prefix, json_prefix):
    return [(column_prefix+n, json_prefix+'.'+p, k, d) for n,p,k,d in spec]

def field(name, path=None, kind='text', default="''"):
    return (name, path or name, kind, default)

def node(name, scope, fs, parent=None, identity=False, children=None, extras=None, root=False):
    n = dict(name='paperwork_'+name, scope=scope, fs=fs, parent=parent, identity=identity,
             children=children or [], extras=extras or [], root=root)
    nodes.append(n)
    return n

invoice_design = [field('template',kind='text',default="'modern'"), field('accent_color','accentColor',default="'#4f46e5'"),
                  field('language',default="'en'"), field('seasonal_month','seasonalMonth',default=None),
                  field('seasonal_variant','seasonalVariant','integer',None)]
settings = node('invoice_settings','firm_id',
    nested(party,'issuer_','profile.party') + nested(bank,'bank_','profile.bank') +
    [field('logo','profile.logo'),field('signature','profile.signature')] +
    nested([field('currency',default="'EUR'"),field('vat_percent','vatPercent','numeric','0'),
            field('payment_days','paymentDays','integer','14'),field('note'),field('number_prefix','numberPrefix'),
            field('language',default="'en'"),field('template',default="'modern'"),field('accent_color','accentColor',default="'#4f46e5'"),
            field('unit',default="'h'")], 'default_', 'profile.defaults'), root=True)
clients = node('clients','firm_id',nested(party,'','party')+[field('currency',default="'EUR'"),field('last_used_at','lastUsedAt')],settings,True)
invoices = node('invoices','firm_id',[
    field('number'),field('status',default="'draft'"),field('issue_date','issueDate','date',None),
    field('service_date','serviceDate','date',None),field('due_date','dueDate','date',None),field('billing_period','billingPeriod'),
    field('currency',default="'EUR'"),field('vat_percent','vatPercent','numeric','0'),field('client_id','clientId',default=None),
    field('note'),field('logo'),field('signature'),field('paid_at','paidAt','date',None),field('repeat_day','repeatDay','integer',None),
    field('created_at','createdAt','timestamptz',None),field('updated_at','updatedAt','timestamptz',None)
] + nested(party,'issuer_','issuer')+nested(party,'client_','client')+nested(bank,'bank_','bank')+
    nested(invoice_design,'design_','design'),settings,True,extras=[
    "foreign key (firm_id, client_id) references public.paperwork_clients(firm_id,id) deferrable initially deferred",
    "check (status in ('draft','sent','paid','cancelled'))",
    'check (repeat_day is null or repeat_day between 1 and 31)'])
items = node('invoice_items','firm_id',[field('title'),field('description'),field('quantity',kind='numeric',default='1'),
    field('unit',default="'h'"),field('unit_price','unitPrice','numeric','0')],invoices,True)
year = node('yearly_taxes','firm_id',[field('monthly',kind='numeric',default='0'),field('currency',default="'EUR'"),
    field('rsd_per_eur','rsdPerEur','numeric','0')],settings,True,extras=['paid_months_explicit boolean not null default false'])
months = node('tax_paid_months','firm_id',[field('month', '$','integer','0')],year,extras=['check (month between 1 and 12)', 'unique (firm_id,parent_id,month)'])
kpo = node('kpo_books','firm_id',[field('currency',default="'EUR'"),field('entry_template','entryTemplate'),field('book_on','bookOn',default="'paid'")]+
    nested([field('pib'),field('taxpayer'),field('business'),field('seat'),field('taxpayer_code','taxpayerCode'),field('activity')],'header_','header'),root=True,
    extras=["check (currency in ('EUR','RSD'))", "check (book_on in ('paid','issued'))"])
entries = node('kpo_entries','firm_id',[field('date',kind='date',default=None),field('description'),field('products',kind='numeric',default='0'),
    field('services',kind='numeric',default='0'),field('source',default="'manual'"),field('invoice_id','invoiceId',default=None)],kpo,True,
    extras=["foreign key (firm_id,invoice_id) references public.paperwork_invoices(firm_id,id) deferrable initially deferred",
            "check (source in ('invoice','import','manual'))"])
settled = node('kpo_settled_invoices','firm_id',[field('invoice_id','$')],kpo,extras=[
    "foreign key (firm_id,invoice_id) references public.paperwork_invoices(firm_id,id) deferrable initially deferred",'unique (firm_id,invoice_id)'])
audit = node('audit_entries','firm_id',[field('at',kind='timestamptz',default=None),field('who'),field('action'),field('target'),field('detail',default=None)])
resumes = node('resumes','user_id',[field('name'),field('created_at','createdAt','timestamptz',None),field('updated_at','updatedAt','timestamptz',None),field('cover_letter','coverLetter',default=None)]+
    nested([field('full_name','fullName'),field('headline'),field('email'),field('phone'),field('location'),field('website'),field('linkedin'),field('github'),field('photo')],'personal_','personal')+
    nested([field('template',default="'modern'"),field('accent_color','accentColor',default="'#4f46e5'"),field('font',default="'sans'"),field('density',default="'normal'"),field('show_photo','showPhoto','boolean','true'),field('language',default="'en'")],'design_','design')+
    nested([field('job_description','jobDescription'),field('keywords_source','keywordsSource')],'ats_','ats'),identity=True)
extras = node('resume_contacts','user_id',[field('label'),field('value')],resumes,True)
keywords = node('resume_keywords','user_id',[field('keyword','$')],resumes)
sections = node('resume_sections','user_id',[field('kind'),field('title'),field('hidden',kind='boolean',default='false'),field('type'),field('text',default=None)],resumes,True,
    extras=["check (type in ('text','entries','tags','languages'))"])
resume_entries = node('resume_entries','user_id',[field('title'),field('subtitle'),field('location'),field('start_label','start'),field('end_label','end'),field('description')],sections,True)
tags = node('resume_tags','user_id',[field('tag','$')],sections)
languages = node('resume_languages','user_id',[field('name'),field('level')],sections,True)
settings['children']=[('clients',clients),('invoices',invoices),('profile.yearlyTax',year)]
invoices['children']=[('items',items)]
year['children']=[('paidMonths',months)]
kpo['children']=[('entries',entries),('settledInvoiceIds',settled)]
resumes['children']=[('personal.extras',extras),('ats.keywords',keywords),('sections',sections)]
sections['children']=[('items',resume_entries),('items',tags),('items',languages)]

for n in nodes:
    scope=n['scope']; parent=n['parent']
    columns=[f'{scope} uuid not null references '+('public.paperwork_firms(id)' if scope=='firm_id' else 'auth.users(id)')+' on delete cascade']
    if not n['root']:
        if n['identity']: columns+=['id text not null']
        columns+=['position integer not null']
    if parent and parent['identity']: columns+=['parent_id text not null']
    columns += [f'{name} {kind}'+(f' not null default {default}' if default is not None else '') for name,_,kind,default in n['fs']]
    pk=[scope]+(['id'] if n['identity'] else ([] if n['root'] else (['parent_id'] if parent and parent['identity'] else [])+['position']))
    columns+=['primary key ('+','.join(pk)+')']
    if parent:
        fk=[scope]+(['parent_id'] if parent['identity'] else [])
        ref=[scope]+(['id'] if parent['identity'] else [])
        columns+=['foreign key ('+','.join(fk)+') references public.'+parent['name']+'('+','.join(ref)+') on delete cascade']
    columns+=n['extras']
    sql+=['create table if not exists public.'+n['name']+' (\n  '+',\n  '.join(columns)+'\n);']
    if parent and parent['identity']: sql += [f'create index if not exists {n["name"]}_parent on public.{n["name"]} ({scope},parent_id);']
    sql += [f'alter table public.{n["name"]} enable row level security;']
    read=f'public.paperwork_role({scope}) is not null' if scope=='firm_id' else 'auth.uid() = user_id'
    write=f"public.paperwork_role({scope}) in ('owner','accountant')" if scope=='firm_id' else 'auth.uid() = user_id'
    sql += [f'drop policy if exists "Read accessible rows" on public.{n["name"]};',f'drop policy if exists "Edit accessible rows" on public.{n["name"]};',f'create policy "Read accessible rows" on public.{n["name"]} for select to authenticated using ({read});',
            f'create policy "Edit accessible rows" on public.{n["name"]} for all to authenticated using ({write}) with check ({write});',
            f'grant select on public.{n["name"]} to authenticated;']

sql += ['''create table public.paperwork_document_versions (
 firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
 key text not null check (key in ('invoices','kpo','audit')),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid references auth.users(id) on delete set null,
 primary key(firm_id,key)
);
create table public.paperwork_personal_versions (
 user_id uuid not null references auth.users(id) on delete cascade,
 key text not null check (key = 'studio.resumes.v2'),
 updated_at timestamptz not null default clock_timestamp(), primary key(user_id,key)
);
create table public.paperwork_user_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active_firm_id uuid references public.paperwork_firms(id) on delete set null
);
create table public.paperwork_open_firms (
 user_id uuid not null references auth.users(id) on delete cascade,
 firm_id uuid not null references public.paperwork_firms(id) on delete cascade,
 position integer not null, primary key(user_id,firm_id)
);''']
for table,cond in [('document_versions','public.paperwork_role(firm_id) is not null'),('personal_versions','user_id=auth.uid()'),('user_settings','user_id=auth.uid()'),('open_firms','user_id=auth.uid() and public.paperwork_role(firm_id) is not null')]:
    sql += [f'alter table public.paperwork_{table} enable row level security;',f'drop policy if exists "Own accessible rows" on public.paperwork_{table};',f'create policy "Own accessible rows" on public.paperwork_{table} for select to authenticated using ({cond});',f'grant select on public.paperwork_{table} to authenticated;']

sql += ['''create or replace function public.paperwork_relational_touch() returns trigger
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
end $$;''']
for n in nodes:
    key='personal' if n['scope']=='user_id' else 'kpo' if n in [kpo,entries,settled] else 'audit' if n is audit else 'invoices'
    sql += [f'drop trigger if exists paperwork_document_touch on public.{n["name"]};',
            f"create trigger paperwork_document_touch after insert or update or delete on public.{n['name']} for each row execute function public.paperwork_relational_touch('{key}');"]

def extract(path, var='p_data'):
    return var if path=='$' else f"{var} #> '{{{path.replace('.',',')}}}'"

def scalar(path,kind,default,var='p_data'):
    expr=f"{var} #>> '{{{path.replace('.',',')}}}'" if path!='$' else f"{var} #>> '{{}}'"
    if kind!='text': expr=f"nullif({expr},'')::{kind}"
    return f'coalesce({expr},{default})' if default is not None else expr

def json_object(mapping):
    groups={}
    for path,value in mapping:
        keys=path.split('.'); cur=groups
        for key in keys[:-1]: cur=cur.setdefault(key,{})
        cur[keys[-1]]=value
    def emit(g): return 'jsonb_build_object('+','.join("'"+key+"',"+(emit(v) if isinstance(v,dict) else v) for key,v in g.items())+')'
    return emit(groups)

for n in reversed(nodes):
    table=n['name']; scope=n['scope']; parent=n['parent']; params='p_scope uuid,p_data jsonb,p_position integer default 0,p_parent text default null'
    columns=[scope]; values=['p_scope']
    if n['identity']: columns+=['id']; values += ["p_data->>'id'"]
    if not n['root']: columns+=['position']; values+=['p_position']
    if parent and parent['identity']: columns+=['parent_id']; values+=['p_parent']
    columns += [f[0] for f in n['fs']]; values += [scalar(path,kind,default) for _,path,kind,default in n['fs']]
    if n is year:
        values[1]='p_parent'; columns+=['paid_months_explicit'];values += ["p_data ? 'paidMonths'"]
    body='insert into public.'+table+'('+','.join(columns)+') values ('+','.join(values)+');\n'
    for path,ch in n['children']:
        if n is settings and ch is year:
            body+=f"for item in select key,value from jsonb_each(coalesce({extract(path)},'{{}}'::jsonb)) loop\n perform public._store_{ch['name']}(p_scope,item.value,0,item.key); end loop;\n"
        else:
            guard=''
            if n is sections:
                typ={resume_entries['name']:'entries',tags['name']:'tags',languages['name']:'languages'}[ch['name']]
                guard=f"if p_data->>'type'='{typ}' then\n"
            parentexpr="p_data->>'id'" if n['identity'] else 'null'
            if n is year: parentexpr='p_parent'
            body+=guard+f"for item in select value,ordinality from jsonb_array_elements(coalesce({extract(path)},'[]'::jsonb)) with ordinality loop\n perform public._store_{ch['name']}(p_scope,item.value,item.ordinality::integer,{parentexpr}); end loop;\n"+('end if;\n' if guard else '')
    sql += [f'create function public._store_{table}({params}) returns void language plpgsql set search_path=public as $$ declare item record; begin\n{body}end $$;',
            f'revoke all on function public._store_{table}(uuid,jsonb,integer,text) from public,anon,authenticated;']
    mapping=[(path,'r.'+col) for col,path,_,_ in n['fs'] if path!='$']
    if n['identity'] and n is not year: mapping=[('id','r.id')]+mapping
    if n is settings: mapping=[('version','2')]+mapping
    if n is kpo: mapping=[('version','1')]+mapping
    for path,ch in n['children']:
        parent_cond=' and c.parent_id=r.id' if n['identity'] else ''
        childjson=f'public._read_{ch["name"]}(c)'
        if ch is year:
            value=f"coalesce((select jsonb_object_agg(c.id,{childjson}) from public.{ch['name']} c where c.{scope}=r.{scope}),'{{}}'::jsonb)"
        else:
            value=f"coalesce((select jsonb_agg({childjson} order by c.position) from public.{ch['name']} c where c.{scope}=r.{scope}{parent_cond}),'[]'::jsonb)"
        if n is sections:
            # A section's items come from the table corresponding to its discriminant.
            existing=next((i for i,(p,_) in enumerate(mapping) if p=='items'),None)
            typ={resume_entries['name']:'entries',tags['name']:'tags',languages['name']:'languages'}[ch['name']]
            fragment=f"when r.type='{typ}' then {value}"
            if existing is None: mapping.append(('items','case '+fragment+' else \'[]\'::jsonb end'))
            else: mapping[existing]=('items',mapping[existing][1].replace(" else '[]'::jsonb end",' '+fragment+" else '[]'::jsonb end"))
        else: mapping.append((path,value))
    expr=json_object(mapping) if mapping else f'to_jsonb(r.{n["fs"][0][0]})'
    if n is year: expr=f"({expr} - case when r.paid_months_explicit then '' else 'paidMonths' end)"
    if n is sections: expr=f"({expr} - case when r.type='text' then 'items' else 'text' end)"
    sql += [f'create function public._read_{table}(r public.{table}) returns jsonb language sql stable security invoker set search_path=public as $$ select {expr} $$;',
            f'revoke all on function public._read_{table}(public.{table}) from public,anon;',f'grant execute on function public._read_{table}(public.{table}) to authenticated;']

sql += ['''create function public._paperwork_write(p_scope uuid,p_key text,p_data jsonb,p_personal boolean) returns timestamptz
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

create function public.paperwork_save_document(p_firm_id uuid,p_key text,p_data jsonb,p_expected timestamptz default null)
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

create function public.paperwork_restore_documents(p_documents jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare doc jsonb;
begin
 for doc in select value from jsonb_array_elements(p_documents) order by value->>'firm_id',case value->>'key' when 'invoices' then 0 when 'kpo' then 1 else 2 end loop
  perform public.paperwork_save_document(nullif(doc->>'firm_id','')::uuid,doc->>'key',doc->'data');
 end loop;
end $$;
revoke all on function public.paperwork_restore_documents(jsonb) from public,anon;
grant execute on function public.paperwork_restore_documents(jsonb) to authenticated;

create function public.paperwork_read_documents(p_firm_ids uuid[] default '{}',p_personal boolean default true)
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

create function public.paperwork_select_firms(p_firm_ids uuid[],p_active_firm_id uuid)
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
''']

# Move existing rows without creating, choosing, merging or deleting firms.
sql += ['''do $$ declare row record; item record; begin
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

create function public.paperwork_relational_profile_identity() returns trigger
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
''']
rendered = '\n\n'.join(sql)+'\n'
rendered = rendered.replace('create table public.', 'create table if not exists public.').replace('create function public.', 'create or replace function public.')
OUT.write_text(rendered,encoding='utf-8')
import json
migrations = ['20261005120000_paperwork.sql', '20261007120000_firm_identity.sql', OUT.name, '20261007150000_remove_legacy_triggers.sql', '20261007160000_invoice_signature_visibility.sql', '20261007170000_account_profiles.sql']
combined = '\n\n'.join((OUT.parent / name).read_text(encoding='utf-8').strip() for name in migrations)
Path('src/lib/cloudSql.ts').write_text('/** Database setup with relational documents and PIB protection. */\nexport const CLOUD_SQL = '+json.dumps(combined)+';\n', encoding='utf-8')
print(f'Generated {OUT} ({len(nodes)+4} relational tables).')
