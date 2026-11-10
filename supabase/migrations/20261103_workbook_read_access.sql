-- Supabase query name: Enable Verified Workbook Read Access
-- Read access only. No imported values, roles or memberships are changed.
begin;
create function public.workbook_row_readable(p_company text, p_city text, p_officer text)
returns boolean language sql stable security invoker set search_path='' as $$
 select (select auth.uid()) is not null and case auth.jwt()->'app_metadata'->>'role'
  when 'CRO' then true
  when 'CRO Manager' then true
  when 'Client' then nullif(auth.jwt()->'app_metadata'->>'company','') is not null
    and p_company=auth.jwt()->'app_metadata'->>'company'
  when 'FSO' then nullif(auth.jwt()->'app_metadata'->>'officer_name','') is not null
    and p_officer=auth.jwt()->'app_metadata'->>'officer_name'
    and p_city=auth.jwt()->'app_metadata'->>'city'
  when 'SFSO' then nullif(auth.jwt()->'app_metadata'->>'city','') is not null
    and (p_city=auth.jwt()->'app_metadata'->>'city'
      or (auth.jwt()->'app_metadata'->>'city'='Islamabad' and p_city='Rawalpindi'))
  when 'SOM' then nullif(auth.jwt()->'app_metadata'->>'city','') is not null
    and (p_city=auth.jwt()->'app_metadata'->>'city'
      or (auth.jwt()->'app_metadata'->>'city'='Islamabad' and p_city='Rawalpindi'))
  else false end;
$$;
revoke all on function public.workbook_row_readable(text,text,text) from public;
grant execute on function public.workbook_row_readable(text,text,text) to authenticated;

alter table public.workbook_import_cases enable row level security;
alter table public.workbook_import_notes enable row level security;
alter table public.workbook_import_links enable row level security;
grant select on public.workbook_import_cases, public.workbook_import_notes, public.workbook_import_links to authenticated;

create policy "workbook_cases_scoped_read" on public.workbook_import_cases for select to authenticated
using (public.workbook_row_readable(company,city,assigned_fso));
create policy "workbook_notes_scoped_read" on public.workbook_import_notes for select to authenticated
using (exists(select 1 from public.workbook_import_cases c
 where c.source_sha256=workbook_import_notes.source_sha256
 and c.source_sheet=workbook_import_notes.source_sheet and c.source_row=workbook_import_notes.source_row));
create policy "workbook_links_scoped_read" on public.workbook_import_links for select to authenticated
using (exists(select 1 from public.workbook_import_cases c
 where c.source_sha256=workbook_import_links.source_sha256 and c.source_sheet=workbook_import_links.source_sheet
 and c.source_row=case when workbook_import_links.source_ref ~ '^[A-Z]+[0-9]{1,7}$'
   then regexp_replace(workbook_import_links.source_ref,'^[A-Z]+','')::integer else null end));

create function public.workbook_summary(p_source_sha text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'total',count(*),'closed',count(*) filter(where status='Closed'),
  'pending',count(*) filter(where status='Pending'),
  'unclassified',count(*) filter(where status is null or status=''),
  'exposure',coalesce(sum(total_loss_numeric),0)::text,
  'recovered',coalesce(sum(recovered_numeric),0)::text)
 from public.workbook_import_cases where source_sha256=p_source_sha;
$$;
create function public.workbook_filter_options(p_source_sha text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'companies',coalesce(jsonb_agg(distinct company) filter(where company is not null and company<>''),'[]'::jsonb),
 'cities',coalesce(jsonb_agg(distinct city) filter(where city is not null and city<>''),'[]'::jsonb),
 'statuses',coalesce(jsonb_agg(distinct status) filter(where status is not null and status<>''),'[]'::jsonb),
 'priorities',coalesce(jsonb_agg(distinct priority) filter(where priority is not null and priority<>''),'[]'::jsonb))
 from public.workbook_import_cases where source_sha256=p_source_sha;
$$;
revoke all on function public.workbook_summary(text),public.workbook_filter_options(text) from public;
grant execute on function public.workbook_summary(text),public.workbook_filter_options(text) to authenticated;
-- No INSERT/UPDATE/DELETE grants or policies are added to the verified source tables.
commit;
