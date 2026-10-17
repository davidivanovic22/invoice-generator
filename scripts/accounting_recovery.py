"""Shared helpers for disposable local SQL recovery rehearsals only."""
import json
import re
import subprocess

CONTAINER = 'supabase_db_invoice-generator'

def validate_database(database):
    if not isinstance(database, str) or not re.fullmatch(r'paperwork_relational_\d+', database):
        raise ValueError('Only disposable local regression database names are allowed.')


def docker(*args, data=None, allow_failure=False):
    result = subprocess.run(['docker', 'exec', '-i', CONTAINER, *args], input=data, capture_output=True)
    if result.returncode and not allow_failure:
        # Do not echo SQL dumps, row contents or credentials on failure.
        raise RuntimeError(f'Local database operation {args[0]} failed (exit {result.returncode}).')
    return result


def sql(database, statement):
    validate_database(database)
    return docker('psql', '-X', '-qAt', '-U', 'postgres', '-d', database,
                  '-v', 'ON_ERROR_STOP=1', data=statement.encode()).stdout.decode().strip()


def fingerprint(database):
    # A single repeatable-read snapshot covers all tables, sequences and metadata.
    # Hash canonical rows instead of printing or exporting financial/person data.
    statement = """
    begin isolation level repeatable read;
    set timezone='UTC'; set datestyle='ISO, YMD';
    create temporary table restore_checks(name text, value jsonb);
    do $$ declare r record; v jsonb; begin
      for r in select n.nspname,c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','auth') and c.relkind in ('r','p','S') order by n.nspname,c.relname loop
        if r.relkind='S' then
          execute format('select jsonb_build_object(''lastValue'',last_value::text,''called'',is_called) from %I.%I',r.nspname,r.relname) into v;
        else
          execute format('select jsonb_build_object(''rows'',count(*),''sha256'',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E''\\n'' order by to_jsonb(t)::text),''''),''UTF8'')),''hex'')) from %I.%I t',r.nspname,r.relname) into v;
        end if;
        insert into restore_checks values(r.nspname||'.'||r.relname,v);
      end loop;
    end $$;
    select jsonb_build_object('data',(select jsonb_object_agg(name,value) from restore_checks),'metadata',
      (select jsonb_agg(v order by v::text) from (
        select jsonb_build_array('relation',n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text) v
          from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth') and c.relkind in ('r','p','S','v')
        union all select jsonb_build_array('column',n.nspname,c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid),a.attacl::text)
          from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
          left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname in ('public','auth') and a.attnum>0 and not a.attisdropped
        union all select jsonb_build_array('constraint',n.nspname,c.relname,k.conname,k.convalidated,pg_get_constraintdef(k.oid))
          from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth')
        union all select jsonb_build_array('trigger',n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid))
          from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth') and not t.tgisinternal
        union all select jsonb_build_array('policy',schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check)
          from pg_policies where schemaname in ('public','auth')
        union all select jsonb_build_array('function',n.nspname,p.proname,pg_get_functiondef(p.oid),p.proacl::text)
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','auth') and p.prokind='f'
        union all select jsonb_build_array('schema',n.nspname,n.nspacl::text) from pg_namespace n where n.nspname in ('public','auth')
        union all select jsonb_build_array('index',schemaname,tablename,indexname,indexdef) from pg_indexes where schemaname in ('public','auth')
        union all select jsonb_build_array('sequence',n.nspname,c.relname,s.seqstart::text,s.seqincrement::text,s.seqmin::text,s.seqmax::text,s.seqcache::text,s.seqcycle)
          from pg_sequence s join pg_class c on c.oid=s.seqrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth')
      ) definitions));
    rollback;
    """
    result = json.loads(sql(database, statement).splitlines()[-1])
    # PostgreSQL expands BETWEEN to a nested AND, then flattens that AND when
    # pg_dump's SQL is reparsed. Accept only these two known equivalent forms;
    # arbitrary constraint changes still fail the complete metadata comparison.
    between_forms = {
        "CHECK ((((length(number) >= 5) AND (length(number) <= 50)) AND (number ~ '^[A-Z0-9]+$'::text)))",
        "CHECK (((length(number) >= 5) AND (length(number) <= 50) AND (number ~ '^[A-Z0-9]+$'::text)))",
    }
    fx_between_forms = {
        "CHECK ((((length(number) >= 5) AND (length(number) <= 64)) AND (number ~ '^[A-Z0-9]+$'::text)))",
        "CHECK (((length(number) >= 5) AND (length(number) <= 64) AND (number ~ '^[A-Z0-9]+$'::text)))",
    }
    for definition in result['metadata']:
        if definition[:4] == ['constraint', 'public', 'paperwork_bank_accounts', 'paperwork_bank_accounts_number_check'] and definition[-1] in between_forms:
            definition[-1] = 'CHECK number length 5..50 AND uppercase alphanumeric'
        if definition[:4] == ['constraint', 'public', 'paperwork_fx_bank_accounts', 'paperwork_fx_bank_accounts_number_check'] and definition[-1] in fx_between_forms:
            definition[-1] = 'CHECK number length 5..64 AND uppercase alphanumeric'
    result['metadata'].sort(key=lambda value: json.dumps(value, sort_keys=True))
    return result


def restore(database, archive, allow_failure=False, source_database=None):
    # CREATEDB fails if the destination already exists. No drop/clean command.
    validate_database(database)
    if database == source_database:
        raise ValueError('The restore destination must differ from the source.')
    docker('createdb', '-U', 'postgres', database)
    return docker('pg_restore', '-U', 'postgres', '-d', database, '--no-owner',
                  '--single-transaction', '--exit-on-error', data=archive, allow_failure=allow_failure)


