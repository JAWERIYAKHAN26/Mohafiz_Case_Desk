-- Apply after 20261106_workbook_calculations.sql. No case data is modified.
begin;
-- This non-inlined helper computes the caller's permitted keys once per scan.
-- No caller-supplied identity or scope; only trusted JWT app_metadata is used.
create or replace function public.desk_readable_case_keys()
returns table(source_sha256 text,source_sheet text,source_row integer)
language plpgsql stable security definer set search_path='' as $$
declare m jsonb:=auth.jwt()->'app_metadata'; r text:=m->>'role';
begin
 if auth.uid() is null then return; end if;
 if r in ('CRO','CRO Manager') then
  return query select c.source_sha256,c.source_sheet,c.source_row from public.workbook_import_cases c;
 elsif r='Client' and nullif(m->>'company','') is not null then
  return query select c.source_sha256,c.source_sheet,c.source_row from public.workbook_import_cases c where c.company=m->>'company';
 elsif r in ('SFSO','SOM') and nullif(m->>'city','') is not null then
  return query select c.source_sha256,c.source_sheet,c.source_row from public.workbook_import_cases c
   where c.city=m->>'city' or (m->>'city'='Islamabad' and c.city='Rawalpindi');
 elsif r='FSO' and nullif(m->>'officer_name','') is not null and nullif(m->>'city','') is not null then
  return query select c.source_sha256,c.source_sheet,c.source_row from public.workbook_import_cases c
   left join public.case_workflow w using(source_sha256,source_sheet,source_row)
   where c.city=m->>'city' and coalesce(w.assigned_fso,c.assigned_fso)=m->>'officer_name';
 end if;
end; $$;
revoke all on function public.desk_readable_case_keys() from public,anon;
grant execute on function public.desk_readable_case_keys() to authenticated;
-- Uncorrelated membership allows one permitted-key set instead of a lookup per row.
alter policy workbook_cases_scoped_read on public.workbook_import_cases using (
 (source_sha256,source_sheet,source_row) in (select * from public.desk_readable_case_keys())
);
alter policy workflow_read on public.case_workflow using (
 (source_sha256,source_sheet,source_row) in (select * from public.desk_readable_case_keys())
);
alter policy workflow_events_read on public.case_workflow_events using (
 (source_sha256,source_sheet,source_row) in (select * from public.desk_readable_case_keys())
);
create index if not exists workbook_cases_city_scope on public.workbook_import_cases(city,source_sha256,source_sheet,source_row);
create index if not exists workbook_cases_company_scope on public.workbook_import_cases(company,source_sha256,source_sheet,source_row);
create index if not exists workflow_events_closure on public.case_workflow_events(source_sha256,source_sheet,source_row,created_at desc) where action='close';
create or replace function public.desk_case_list(p_sha text,p_filters jsonb default '{}'::jsonb,p_page integer default 0,p_size integer default 50) returns jsonb
language sql stable security invoker set search_path='' as $$
 with filtered as materialized (
  select c.*,w.stage as desk_stage,w.assigned_fso as desk_officer,w.recovered_amount as desk_recovered
  from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
  where c.source_sha256=p_sha
   and (coalesce(p_filters->>'company','')='' or c.company=p_filters->>'company')
   and (coalesce(p_filters->>'city','')='' or c.city=p_filters->>'city')
   and (coalesce(p_filters->>'priority','')='' or (case when c.source_sheet='Portal Intake' or c.formula_metadata ? 'AV' then coalesce((select priority from public.workbook_issue_rules where lower(issue)=lower(c.issue)),'') else c.priority end)=p_filters->>'priority')
   and (coalesce(trim(p_filters->>'search'),'')='' or position(lower(trim(p_filters->>'search')) in lower(c.case_id))>0)
   and (nullif(p_filters->>'from','') is null or c.reported_date_iso>=(p_filters->>'from')::date)
   and (nullif(p_filters->>'to','') is null or c.reported_date_iso<=(p_filters->>'to')::date)
   and case coalesce(p_filters->>'status','')
    when '' then true
    when '__to_ack__' then c.status='Pending' and (w.stage is null or w.stage='New')
    when '__active__' then c.status is distinct from 'Closed' and w.stage in ('In progress','Arrived','Submitted','Reviewed')
    when '__review__' then c.status is distinct from 'Closed' and w.stage='Submitted'
    when '__open__' then c.status is distinct from 'Closed' and w.stage is distinct from 'Closed'
    when '__blank__' then (c.status is null or c.status='') and w.stage is distinct from 'Closed'
    when 'Closed' then c.status='Closed' or w.stage='Closed'
    when 'Pending' then c.status='Pending' and (w.stage is null or w.stage in ('New','Acknowledged'))
    else c.status=p_filters->>'status' and w.stage is distinct from 'Closed' end
   and (coalesce((select auth.jwt()->'app_metadata'->>'role'),'')<>'FSO' or (c.city=(select auth.jwt()->'app_metadata'->>'city') and coalesce(w.assigned_fso,c.assigned_fso)=(select auth.jwt()->'app_metadata'->>'officer_name')))
 ), paged as (
  select * from filtered order by reported_date_iso desc nulls last,source_sheet,source_row desc
  limit greatest(1,least(p_size,100)) offset greatest(0,p_page)*greatest(1,least(p_size,100))
 )
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(
  public.workbook_calculated(to_jsonb(p)-'desk_stage'-'desk_officer'-'desk_recovered',jsonb_build_object('stage',p.desk_stage,'assigned_fso',p.desk_officer,'recovered_amount',p.desk_recovered,'closed_date',(select (max(e.created_at) at time zone 'Asia/Karachi')::date from public.case_workflow_events e where (e.source_sha256,e.source_sheet,e.source_row)=(p.source_sha256,p.source_sheet,p.source_row) and e.action='close'))) ||jsonb_build_object(
   'case_workflow',case when p.desk_stage is null then null else jsonb_build_object('stage',p.desk_stage) end
  ) order by p.reported_date_iso desc nulls last,p.source_sheet,p.source_row desc
 ) from paged p),'[]'::jsonb));
$$;
revoke all on function public.desk_case_list(text,jsonb,integer,integer) from public,anon;
grant execute on function public.desk_case_list(text,jsonb,integer,integer) to authenticated;

create or replace function public.workbook_summary(p_source_sha text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('total',count(*),'closed',count(*) filter(where c.status='Closed' or w.stage='Closed'),
  'pending',count(*) filter(where c.status='Pending' and (w.stage is null or w.stage in ('New','Acknowledged'))),
  'unclassified',count(*) filter(where (c.status is null or c.status='') and w.stage is distinct from 'Closed'),
  'exposure',coalesce(sum(case when c.source_sheet='Portal Intake' or c.formula_metadata ? 'Y' then coalesce(c.company_loss_numeric,0)+coalesce(c.personal_loss_numeric,0) else c.total_loss_numeric end),0)::text,'recovered',coalesce(sum(coalesce(w.recovered_amount,c.recovered_numeric)),0)::text)
 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
 where c.source_sha256=p_source_sha
 and (coalesce((select auth.jwt()->'app_metadata'->>'role'),'')<>'FSO' or (c.city=(select auth.jwt()->'app_metadata'->>'city') and coalesce(w.assigned_fso,c.assigned_fso)=(select auth.jwt()->'app_metadata'->>'officer_name')));
$$;
create or replace function public.workbook_filter_options(p_source_sha text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'companies',coalesce(jsonb_agg(distinct company) filter(where company is not null and company<>''),'[]'::jsonb),
  'cities',coalesce(jsonb_agg(distinct city) filter(where city is not null and city<>''),'[]'::jsonb),
  'statuses',coalesce(jsonb_agg(distinct status) filter(where status is not null and status<>''),'[]'::jsonb),
  'priorities',coalesce(jsonb_agg(distinct priority) filter(where priority is not null and priority<>''),'[]'::jsonb))
 from (select c.company,c.city,c.status,case when c.source_sheet='Portal Intake' or c.formula_metadata ? 'AV' then coalesce(r.priority,'') else c.priority end as priority from public.workbook_import_cases c left join public.workbook_issue_rules r on lower(r.issue)=lower(c.issue) where c.source_sha256=p_source_sha) options;
$$;
create or replace function public.workflow_counters(p_sha text) returns jsonb
language sql stable security invoker set search_path='' as $$
 with unread as materialized (select public.workspace_unread_count() as n)
 select jsonb_build_object(
  'to_acknowledge',count(*) filter(where c.status='Pending' and (w.stage is null or w.stage='New')),
  'in_progress',count(*) filter(where c.status is distinct from 'Closed' and w.stage in ('In progress','Arrived','Submitted','Reviewed')),
  'reports_to_review',count(*) filter(where c.status is distinct from 'Closed' and w.stage='Submitted'),
  'unread_messages',(select n from unread),
  'updates_to_review',count(*) filter(where c.status is distinct from 'Closed' and w.stage='Submitted')+(select n from unread))
 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row) where c.source_sha256=p_sha;
$$;


analyze public.workbook_import_cases;
analyze public.case_workflow;
analyze public.case_workflow_events;
notify pgrst,'reload schema';
commit;
