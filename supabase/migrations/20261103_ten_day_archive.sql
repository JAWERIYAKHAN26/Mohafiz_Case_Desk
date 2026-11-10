-- Supabase query name: Create Ten Day Case Archive
-- Installs backend-only archive helpers. Does NOT delete cases or start the job.
begin;
create table public.case_archive_runs (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 state text not null default 'pending' check(state in ('pending','complete')),
 keys jsonb not null,
 payload_sha256 text not null,
 object_prefix text not null,
 case_count integer not null,
 verified_files jsonb
);
alter table public.case_archive_runs enable row level security;
revoke all on public.case_archive_runs from public,anon,authenticated;

create function public.archive_payload(p_keys jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare result jsonb; reports jsonb := '[]'::jsonb;
begin
 if to_regclass('public.case_field_reports') is not null then
  execute 'select coalesce(jsonb_agg(to_jsonb(r) order by r.id),''[]''::jsonb) from public.case_field_reports r where exists(select 1 from jsonb_to_recordset($1) k(source_sha256 text,source_sheet text,source_row integer) where (r.source_sha256,r.source_sheet,r.source_row)=(k.source_sha256,k.source_sheet,k.source_row))' into reports using p_keys;
 end if;
 with k as (select * from jsonb_to_recordset(p_keys) x(source_sha256 text,source_sheet text,source_row integer))
 select jsonb_build_object('version',1,'retention_days',10,
 'cases',(select coalesce(jsonb_agg(to_jsonb(c) order by c.source_sha256,c.source_sheet,c.source_row),'[]'::jsonb) from public.workbook_import_cases c join k using(source_sha256,source_sheet,source_row)),
 'notes',(select coalesce(jsonb_agg(to_jsonb(n) order by n.source_sha256,n.source_note_id),'[]'::jsonb) from public.workbook_import_notes n join k using(source_sha256,source_sheet,source_row)),
 'links',(select coalesce(jsonb_agg(to_jsonb(l) order by l.source_sha256,l.source_link_id),'[]'::jsonb) from public.workbook_import_links l where exists(select 1 from k where k.source_sha256=l.source_sha256 and k.source_sheet=l.source_sheet and l.source_ref ~ '^[A-Z]+[0-9]{1,7}$' and k.source_row=case when l.source_ref ~ '^[A-Z]+[0-9]{1,7}$' then regexp_replace(l.source_ref,'^[A-Z]+','')::integer end)),
 'field_reports',reports) into result;
 return result::text;
end; $$;

create function public.prepare_case_archive() returns jsonb
language plpgsql security definer set search_path='' as $$
declare batch public.case_archive_runs%rowtype; selected_keys jsonb; payload text; checksum text;
begin
 perform pg_advisory_xact_lock(192604,10);
 select * into batch from public.case_archive_runs where state='pending' order by created_at limit 1 for update;
 if not found then
  select jsonb_agg(jsonb_build_object('source_sha256',c.source_sha256,'source_sheet',c.source_sheet,'source_row',c.source_row) order by c.source_sha256,c.source_sheet,c.source_row) into selected_keys
  from (select c.* from public.workbook_import_cases c
   where c.status='Closed' and c.closure_date_iso is not null
    -- Date-only closures have no timestamp: retain ten full days after the end of closure day in PKT.
    and c.closure_date_iso < (now() at time zone 'Asia/Karachi')::date - 10
    -- Unmapped/range hyperlinks cannot safely be attributed to one case. Keep that sheet intact.
    and not exists(select 1 from public.workbook_import_links l where l.source_sha256=c.source_sha256 and l.source_sheet=c.source_sheet and l.source_ref !~ '^[A-Z]+[0-9]{1,7}$')
   order by c.source_sha256,c.source_sheet,c.source_row limit 20) c;
  if selected_keys is null then return jsonb_build_object('done',true); end if;
  payload=public.archive_payload(selected_keys);
  checksum=encode(sha256(convert_to(payload,'UTF8')),'hex');
  insert into public.case_archive_runs(keys,payload_sha256,object_prefix,case_count)
   values(selected_keys,checksum,'closed-cases/'||gen_random_uuid()::text,jsonb_array_length(selected_keys)) returning * into batch;
 else
  payload=public.archive_payload(batch.keys);
  if encode(sha256(convert_to(payload,'UTF8')),'hex') <> batch.payload_sha256 then
   raise exception 'Pending archive changed. No deletion performed; administrator must review archive run %',batch.id;
  end if;
 end if;
 return jsonb_build_object('done',false,'id',batch.id,'prefix',batch.object_prefix,'sha256',batch.payload_sha256,'payload',payload,'case_count',batch.case_count);
end; $$;

create function public.finish_case_archive(p_id uuid,p_sha256 text,p_files jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare batch public.case_archive_runs%rowtype; payload text; removed integer; eligible integer;
begin
 perform pg_advisory_xact_lock(192604,10);
 select * into strict batch from public.case_archive_runs where id=p_id for update;
 if batch.state='complete' then return 0; end if;
 -- Serialize case/child writes while rechecking the exact archived snapshot and deleting.
 lock table public.workbook_import_cases,public.workbook_import_notes,public.workbook_import_links in share row exclusive mode;
 if to_regclass('public.case_field_reports') is not null then execute 'lock table public.case_field_reports in share row exclusive mode'; end if;
 payload=public.archive_payload(batch.keys);
 if p_sha256 is distinct from batch.payload_sha256 or encode(sha256(convert_to(payload,'UTF8')),'hex') <> batch.payload_sha256 then
  raise exception 'Archive checksum changed. No deletion performed';
 end if;
 if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files)<2 or not exists(select 1 from jsonb_array_elements(p_files) f where f->>'path'=batch.object_prefix||'/snapshot.json' and f->>'sha256'=batch.payload_sha256) or not exists(select 1 from jsonb_array_elements(p_files) f where f->>'path'=batch.object_prefix||'/cases.xml' and length(f->>'sha256')=64) then
  raise exception 'Verified archive receipts are missing';
 end if;
 select count(*) into eligible from public.workbook_import_cases c join jsonb_to_recordset(batch.keys) k(source_sha256 text,source_sheet text,source_row integer) using(source_sha256,source_sheet,source_row)
 where c.status='Closed' and c.closure_date_iso < (now() at time zone 'Asia/Karachi')::date-10;
 if exists(select 1 from public.workbook_import_links l join jsonb_to_recordset(batch.keys) k(source_sha256 text,source_sheet text,source_row integer) on l.source_sha256=k.source_sha256 and l.source_sheet=k.source_sheet where l.source_ref !~ '^[A-Z]+[0-9]{1,7}$') then raise exception 'Unmapped evidence reference appeared. No deletion performed'; end if;
 if eligible<>batch.case_count then raise exception 'Case reopened or retention changed. No deletion performed'; end if;
 if to_regclass('public.case_field_reports') is not null then
  execute 'delete from public.case_field_reports r using jsonb_to_recordset($1) k(source_sha256 text,source_sheet text,source_row integer) where (r.source_sha256,r.source_sheet,r.source_row)=(k.source_sha256,k.source_sheet,k.source_row)' using batch.keys;
 end if;
 delete from public.workbook_import_links l using jsonb_to_recordset(batch.keys) k(source_sha256 text,source_sheet text,source_row integer)
 where l.source_sha256=k.source_sha256 and l.source_sheet=k.source_sheet and l.source_ref ~ '^[A-Z]+[0-9]{1,7}$'
 and k.source_row=case when l.source_ref ~ '^[A-Z]+[0-9]{1,7}$' then regexp_replace(l.source_ref,'^[A-Z]+','')::integer end;
 delete from public.workbook_import_notes n using jsonb_to_recordset(batch.keys) k(source_sha256 text,source_sheet text,source_row integer)
 where (n.source_sha256,n.source_sheet,n.source_row)=(k.source_sha256,k.source_sheet,k.source_row);
 delete from public.workbook_import_cases c using jsonb_to_recordset(batch.keys) k(source_sha256 text,source_sheet text,source_row integer)
 where (c.source_sha256,c.source_sheet,c.source_row)=(k.source_sha256,k.source_sheet,k.source_row);
 get diagnostics removed=row_count;
 if removed<>batch.case_count then raise exception 'Deletion count mismatch'; end if;
 update public.case_archive_runs set state='complete',completed_at=now(),verified_files=p_files where id=p_id;
 return removed;
end; $$;
revoke all on function public.archive_payload(jsonb),public.prepare_case_archive(),public.finish_case_archive(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_case_archive(),public.finish_case_archive(uuid,text,jsonb) to service_role;
grant select on public.workbook_import_cases to service_role;
create index if not exists workbook_cases_archive_eligible on public.workbook_import_cases(closure_date_iso,source_sha256,source_sheet,source_row) where status='Closed';
insert into storage.buckets(id,name,public) values('case-archives','case-archives',false) on conflict(id) do nothing;
-- Refuse to use a pre-existing public bucket for sensitive archives.
do $$ begin if exists(select 1 from storage.buckets where id='case-archives' and public) then raise exception 'case-archives must be private'; end if; end $$;
commit;
