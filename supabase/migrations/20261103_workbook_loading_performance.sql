-- Supabase query name: Speed Up Workbook Loading
-- Run after Enable Verified Workbook Read Access. No source values are changed.
-- Keeps exactly the same role/coverage rules; auth claims are evaluated by scalar subqueries.
begin;
alter policy "workbook_cases_scoped_read" on public.workbook_import_cases
using (
(select auth.uid()) is not null and case (select auth.jwt()->'app_metadata'->>'role')
  when 'CRO' then true
  when 'CRO Manager' then true
  when 'Client' then nullif((select auth.jwt()->'app_metadata'->>'company'),'') is not null
    and company=(select auth.jwt()->'app_metadata'->>'company')
  when 'FSO' then nullif((select auth.jwt()->'app_metadata'->>'officer_name'),'') is not null
    and assigned_fso=(select auth.jwt()->'app_metadata'->>'officer_name')
    and city=(select auth.jwt()->'app_metadata'->>'city')
  when 'SFSO' then nullif((select auth.jwt()->'app_metadata'->>'city'),'') is not null
    and (city=(select auth.jwt()->'app_metadata'->>'city')
      or ((select auth.jwt()->'app_metadata'->>'city')='Islamabad' and city='Rawalpindi'))
  when 'SOM' then nullif((select auth.jwt()->'app_metadata'->>'city'),'') is not null
    and (city=(select auth.jwt()->'app_metadata'->>'city')
      or ((select auth.jwt()->'app_metadata'->>'city')='Islamabad' and city='Rawalpindi'))
  else false end
);
create index if not exists workbook_cases_page_order
 on public.workbook_import_cases(source_sha256,reported_date_iso desc nulls last,source_sheet,source_row desc);
create index if not exists workbook_cases_status
 on public.workbook_import_cases(source_sha256,status);
create index if not exists workbook_cases_officer_city
 on public.workbook_import_cases(assigned_fso,city,source_sha256);
create index if not exists workbook_links_source_ref
 on public.workbook_import_links(source_sha256,source_sheet,source_ref);
analyze public.workbook_import_cases;
analyze public.workbook_import_links;
commit;
