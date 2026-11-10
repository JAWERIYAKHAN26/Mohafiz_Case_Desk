-- Private workbook data. Execute in Supabase SQL Editor after reviewing conflicts.
-- Existing SHA identifies the application's dataset lineage; revision identifies this file.
begin;
select pg_advisory_xact_lock(20261106, 1);
lock table public.workbook_import_cases,public.workbook_import_notes,public.workbook_import_links in share row exclusive mode;
create table if not exists public.workbook_revision_journal (
 revision text not null,kind text not null,record_key text not null,
 before_value jsonb,after_value jsonb,state text not null,
 created_at timestamptz not null default now(),primary key(revision,kind,record_key)
);
alter table public.workbook_revision_journal enable row level security;
revoke all on public.workbook_revision_journal from public,anon,authenticated;
do $import$
declare payload jsonb:=__PAYLOAD__; x jsonb; prior jsonb; newer jsonb; key_text text;
 target_row integer; note_id bigint; link_id bigint; has_workflow boolean;
 sha constant text:='__SHA__'; rev constant text:='__REVISION__';
begin
 for x in select value from jsonb_array_elements(payload->'cases') loop
  target_row:=(x->>'source_row')::integer;key_text:=target_row::text;
  if exists(select 1 from public.workbook_revision_journal where revision=rev and kind='case-insert' and record_key=key_text and state='applied') then continue;end if;
  select to_jsonb(c) into prior from public.workbook_import_cases c where source_sha256=sha and source_sheet='B2B - 2025' and source_row=target_row;
  if prior is not null or exists(select 1 from public.workbook_import_cases where case_id=x->>'case_id') then
   raise exception 'New case collision at row %. No records committed.',target_row;
  end if;
  insert into public.workbook_import_cases select * from jsonb_populate_record(null::public.workbook_import_cases,x);
  insert into public.workbook_revision_journal values(rev,'case-insert',key_text,null,x,'applied',now());
 end loop;
 for x in select value from jsonb_array_elements(payload->'changes') loop
  target_row:=(x->>'row')::integer;key_text:=target_row::text;
  if exists(select 1 from public.workbook_revision_journal where revision=rev and kind='case-update' and record_key=key_text and state='applied') then continue;end if;
  select to_jsonb(c) into prior from public.workbook_import_cases c where source_sha256=sha and source_sheet='B2B - 2025' and source_row=target_row;
  select exists(select 1 from public.case_workflow where source_sha256=sha and source_sheet='B2B - 2025' and source_row=target_row)
    or exists(select 1 from public.case_workflow_events where source_sha256=sha and source_sheet='B2B - 2025' and source_row=target_row) into has_workflow;
  if prior->>'case_id' is distinct from x->>'case_id' or has_workflow or not coalesce(prior @> (x->'before'),false) then
   insert into public.workbook_revision_journal values(rev,'case-update',key_text,prior,x->'after','conflict',now()) on conflict do nothing;
   continue;
  end if;
  newer:=prior||(x->'after');
  -- Assign only mutable source fields; keys and formula/raw metadata remain untouched.
  execute format('update public.workbook_import_cases set (%s)=(select %s from jsonb_populate_record(null::public.workbook_import_cases,$1)) where source_sha256=$2 and source_sheet=''B2B - 2025'' and source_row=$3',
   (select string_agg(format('%I',k),',') from jsonb_object_keys(x->'after') k),
   (select string_agg(format('%I',k),',') from jsonb_object_keys(x->'after') k)) using newer,sha,target_row;
  insert into public.workbook_revision_journal values(rev,'case-update',key_text,prior,newer,'applied',now())
   on conflict(revision,kind,record_key) do update set before_value=excluded.before_value,after_value=excluded.after_value,state='applied';
 end loop;
 for x in select value from jsonb_array_elements(payload->'notes') loop
  key_text:=x->>'cell';target_row:=(x->>'row')::integer;
  if exists(select 1 from public.workbook_revision_journal where revision=rev and kind='note' and record_key=key_text and state='applied') then continue;end if;
  select to_jsonb(n) into prior from public.workbook_import_notes n where source_sha256=sha and source_sheet='B2B - 2025' and source_cell=key_text;
  if x->'old'<>'null'::jsonb then
   if prior is distinct from x->'old' or exists(select 1 from public.case_workflow where source_sha256=sha and source_sheet='B2B - 2025' and source_row=target_row) then
    insert into public.workbook_revision_journal values(rev,'note',key_text,prior,x,'conflict',now()) on conflict do nothing;continue;
   end if;
   update public.workbook_import_notes set author=x->>'author',note_text=x->>'text' where source_sha256=sha and source_note_id=(prior->>'source_note_id')::bigint;
  else
   if prior is not null then raise exception 'New note collision at %',key_text;end if;
   select coalesce(max(source_note_id),0)+1 into note_id from public.workbook_import_notes where source_sha256=sha;
   insert into public.workbook_import_notes values(sha,note_id,'B2B - 2025',key_text,target_row,x->>'column',x->>'author',x->>'text','revision/__REVISION__/xl/comments1.xml');
  end if;
  insert into public.workbook_revision_journal values(rev,'note',key_text,prior,x,'applied',now()) on conflict(revision,kind,record_key) do update set state='applied',before_value=excluded.before_value,after_value=excluded.after_value;
 end loop;
 for x in select value from jsonb_array_elements(payload->'links') loop
  key_text:=x->>'source_ref';
  if exists(select 1 from public.workbook_revision_journal where revision=rev and kind='link' and record_key=key_text and state='applied') then continue;end if;
  if exists(select 1 from public.workbook_import_links l where source_sha256=sha and source_sheet='B2B - 2025' and source_ref=key_text) then raise exception 'Link collision at %',key_text;end if;
  select coalesce(max(source_link_id),0)+1 into link_id from public.workbook_import_links where source_sha256=sha;
  insert into public.workbook_import_links values(sha,link_id,'B2B - 2025',key_text,x->>'target',x->>'location',x->>'display',x->>'tooltip');
  insert into public.workbook_revision_journal values(rev,'link',key_text,null,x,'applied',now());
 end loop;
end;$import$;
select kind,state,count(*) from public.workbook_revision_journal where revision='__REVISION__' group by kind,state order by kind,state;
commit;
