-- Supabase query name: Fix Scoped Dashboard Timeouts
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


-- Explicit trusted coverage narrows the scan; RLS remains enabled.
create or replace function public.workbook_summary(p_source_sha text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$

declare
 access jsonb := auth.jwt()->'app_metadata';
 coverage text := 'false';
 result jsonb;
begin
 if auth.uid() is not null then
  case access->>'role'
   when 'CRO' then coverage := 'true';
   when 'CRO Manager' then coverage := 'true';
   when 'Client' then coverage := 'company=$2 and nullif($2,'''') is not null';
   when 'FSO' then coverage := 'assigned_fso=$4 and city=$3 and nullif($4,'''') is not null';
   when 'SFSO' then coverage := '(city=$3 or ($3=''Islamabad'' and city=''Rawalpindi'')) and nullif($3,'''') is not null';
   when 'SOM' then coverage := '(city=$3 or ($3=''Islamabad'' and city=''Rawalpindi'')) and nullif($3,'''') is not null';
   else coverage := 'false';
  end case;
 end if;
 execute 'select jsonb_build_object(''total'',count(*),''closed'',count(*) filter(where status=''Closed''),''pending'',count(*) filter(where status=''Pending''),''unclassified'',count(*) filter(where status is null or status=''''),''exposure'',coalesce(sum(total_loss_numeric),0)::text,''recovered'',coalesce(sum(recovered_numeric),0)::text) from public.workbook_import_cases where source_sha256=$1 and ' || coverage into result using p_source_sha,access->>'company',access->>'city',access->>'officer_name';
 return result;
end;
$$;

-- Explicit trusted coverage narrows the scan; RLS remains enabled.
create or replace function public.workbook_filter_options(p_source_sha text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$

declare
 access jsonb := auth.jwt()->'app_metadata';
 coverage text := 'false';
 result jsonb;
begin
 if auth.uid() is not null then
  case access->>'role'
   when 'CRO' then coverage := 'true';
   when 'CRO Manager' then coverage := 'true';
   when 'Client' then coverage := 'company=$2 and nullif($2,'''') is not null';
   when 'FSO' then coverage := 'assigned_fso=$4 and city=$3 and nullif($4,'''') is not null';
   when 'SFSO' then coverage := '(city=$3 or ($3=''Islamabad'' and city=''Rawalpindi'')) and nullif($3,'''') is not null';
   when 'SOM' then coverage := '(city=$3 or ($3=''Islamabad'' and city=''Rawalpindi'')) and nullif($3,'''') is not null';
   else coverage := 'false';
  end case;
 end if;
 execute 'select jsonb_build_object(''companies'',coalesce(jsonb_agg(distinct company) filter(where company is not null and company<>''''),''[]''::jsonb),''cities'',coalesce(jsonb_agg(distinct city) filter(where city is not null and city<>''''),''[]''::jsonb),''statuses'',coalesce(jsonb_agg(distinct status) filter(where status is not null and status<>''''),''[]''::jsonb),''priorities'',coalesce(jsonb_agg(distinct priority) filter(where priority is not null and priority<>''''),''[]''::jsonb)) from public.workbook_import_cases where source_sha256=$1 and ' || coverage into result using p_source_sha,access->>'company',access->>'city',access->>'officer_name';
 return result;
end;
$$;

commit;
