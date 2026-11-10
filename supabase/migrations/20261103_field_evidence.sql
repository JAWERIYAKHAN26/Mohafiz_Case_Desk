-- Supabase query name: Create Field Evidence Storage
-- Run after workbook import tables exist. Existing workbook records are not changed.
begin;

create function public.field_report_case_access(p_sha text, p_sheet text, p_row integer, p_write boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.workbook_import_cases c
    where c.source_sha256 = p_sha and c.source_sheet = p_sheet and c.source_row = p_row
      and (not p_write or c.status is distinct from 'Closed')
      and (
        auth.jwt()->'app_metadata'->>'role' in ('CRO','CRO Manager')
        or (auth.jwt()->'app_metadata'->>'role' = 'FSO'
          and c.assigned_fso = auth.jwt()->'app_metadata'->>'officer_name'
          and c.city = auth.jwt()->'app_metadata'->>'city')
        or (auth.jwt()->'app_metadata'->>'role' in ('SFSO','SOM')
          and (c.city = auth.jwt()->'app_metadata'->>'city'
            or (auth.jwt()->'app_metadata'->>'city' = 'Islamabad' and c.city = 'Rawalpindi')))
      )
  );
$$;
revoke all on function public.field_report_case_access(text,text,integer,boolean) from public;
grant execute on function public.field_report_case_access(text,text,integer,boolean) to authenticated;

create table public.case_field_reports (
  id uuid primary key,
  source_sha256 text not null,
  source_sheet text not null,
  source_row integer not null,
  uploader_id uuid not null references auth.users(id),
  submitted_by text not null default (auth.jwt()->'app_metadata'->>'officer_name'),
  report_text text not null check (length(trim(report_text)) >= 20),
  attachments jsonb not null default '[]'::jsonb
    check(jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 6),
  created_at timestamptz not null default now(),
  foreign key(source_sha256,source_sheet,source_row)
    references public.workbook_import_cases(source_sha256,source_sheet,source_row)
);
create index case_field_reports_case on public.case_field_reports(source_sha256,source_sheet,source_row);
alter table public.case_field_reports enable row level security;
revoke all on public.case_field_reports from anon, authenticated;
grant select, insert on public.case_field_reports to authenticated;

-- Validate that attachment paths belong to this uploader/report and refer to uploaded objects.
create function public.field_report_evidence_valid(p_report uuid, p_attachments jsonb)
returns boolean language sql stable security definer set search_path = '' as $$
  select jsonb_typeof(p_attachments) = 'array'
    and jsonb_array_length(p_attachments) <= 6
    and not exists (
      select 1 from jsonb_array_elements(p_attachments) a
      where not coalesce(
        a->>'kind' in ('photo','video','voice')
        and a->>'path' like auth.uid()::text || '/' || p_report::text || '/%'
        and exists (select 1 from storage.objects o where o.bucket_id='field-evidence'
          and o.name = a->>'path' and o.owner_id = auth.uid()::text), false)
    );
$$;
revoke all on function public.field_report_evidence_valid(uuid,jsonb) from public;
grant execute on function public.field_report_evidence_valid(uuid,jsonb) to authenticated;

create policy "field_reports_read_authorized" on public.case_field_reports for select to authenticated
using (uploader_id = (select auth.uid()) or public.field_report_case_access(source_sha256,source_sheet,source_row));

create policy "field_reports_submit_assigned_fso" on public.case_field_reports for insert to authenticated
with check (
  uploader_id = (select auth.uid())
  and auth.jwt()->'app_metadata'->>'role' = 'FSO'
  and public.field_report_case_access(source_sha256,source_sheet,source_row,true)
  and public.field_report_evidence_valid(id,attachments)
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('field-evidence','field-evidence',false,26214400,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif',
        'video/mp4','video/webm','video/quicktime','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-m4a']);

create policy "field_evidence_upload_own_folder" on storage.objects for insert to authenticated
with check (bucket_id='field-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text
  and auth.jwt()->'app_metadata'->>'role'='FSO');

create policy "field_evidence_read_authorized" on storage.objects for select to authenticated
using (bucket_id='field-evidence' and (
  owner_id=(select auth.uid())::text
  or exists (select 1 from public.case_field_reports r
    where exists (select 1 from jsonb_array_elements(r.attachments) a where a->>'path'=storage.objects.name))
));

-- Only allow cleanup of an uploader's own unlinked files after a failed submission.
create policy "field_evidence_cleanup_unlinked" on storage.objects for delete to authenticated
using (bucket_id='field-evidence' and owner_id=(select auth.uid())::text
  and not exists (select 1 from public.case_field_reports r
    where exists (select 1 from jsonb_array_elements(r.attachments) a where a->>'path'=storage.objects.name))
);
commit;
