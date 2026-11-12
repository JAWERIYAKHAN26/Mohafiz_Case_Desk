-- Apply after 20261121_filter_options_issue.sql. No case data is modified.
--
-- Problem: the dashboard/case-board RPCs ran as SECURITY INVOKER, so row-level
-- security re-checked every workbook row through desk_readable_case_keys(),
-- which itself scans the whole workbook table. Each call therefore scanned the
-- big table twice and hash-matched every row before counting anything. With
-- several of these firing together on dashboard load, they passed the
-- authenticated role's statement timeout (57014).
--
-- Fix: run these read-only RPCs as SECURITY DEFINER and apply the exact same
-- role scope as a plain WHERE clause (one scan, no per-row policy check).
-- Scope comes only from the trusted JWT app_metadata, mirroring
-- desk_readable_case_keys(); callers cannot widen it.
begin;

-- Deliberately no SET clause: that lets Postgres inline this into the calling
-- query so the JWT claims are read once per query, not once per row. Every
-- reference inside is schema-qualified, so no search_path is needed.
create or replace function public.desk_case_in_scope(p_company text,p_city text,p_officer text) returns boolean
language sql stable as $$
 select auth.uid() is not null and case (select auth.jwt()->'app_metadata'->>'role')
  when 'CRO' then true
  when 'CRO Manager' then true
  when 'Client' then p_company=nullif((select auth.jwt()->'app_metadata'->>'company'),'')
  when 'SFSO' then p_city=nullif((select auth.jwt()->'app_metadata'->>'city'),'') or ((select auth.jwt()->'app_metadata'->>'city')='Islamabad' and p_city='Rawalpindi')
  when 'SOM' then p_city=nullif((select auth.jwt()->'app_metadata'->>'city'),'') or ((select auth.jwt()->'app_metadata'->>'city')='Islamabad' and p_city='Rawalpindi')
  when 'FSO' then p_city=nullif((select auth.jwt()->'app_metadata'->>'city'),'') and p_officer=nullif((select auth.jwt()->'app_metadata'->>'officer_name'),'')
  else false end;
$$;
revoke all on function public.desk_case_in_scope(text,text,text) from public,anon;
grant execute on function public.desk_case_in_scope(text,text,text) to authenticated;

create or replace function public.workbook_summary(p_source_sha text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('total',count(*),'closed',count(*) filter(where w.stage='Closed' or c.status='Closed' and w.reopened_at is null),
  'pending',count(*) filter(where (c.status='Pending' or c.status='Closed' and w.reopened_at is not null and w.stage is distinct from 'Closed') and (w.stage is null or w.stage in ('New','Acknowledged'))),
  'unclassified',count(*) filter(where (c.status is null or c.status='') and w.stage is distinct from 'Closed'),
  'exposure',coalesce(sum(case when c.source_sheet='Portal Intake' or c.formula_metadata ? 'Y' then coalesce(c.company_loss_numeric,0)+coalesce(c.personal_loss_numeric,0) else c.total_loss_numeric end),0)::text,'recovered',coalesce(sum(coalesce(w.recovered_amount,c.recovered_numeric)),0)::text)
 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
 where c.source_sha256=p_source_sha
  and public.desk_case_in_scope(c.company,c.city,coalesce(w.assigned_fso,c.assigned_fso));
$$;
revoke all on function public.workbook_summary(text) from public,anon;
grant execute on function public.workbook_summary(text) to authenticated;

create or replace function public.workbook_filter_options(p_source_sha text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'companies',coalesce(jsonb_agg(distinct company) filter(where company is not null and company<>''),'[]'::jsonb),
  'cities',coalesce(jsonb_agg(distinct city) filter(where city is not null and city<>''),'[]'::jsonb),
  'statuses',coalesce(jsonb_agg(distinct status) filter(where status is not null and status<>''),'[]'::jsonb),
  'priorities',coalesce(jsonb_agg(distinct priority) filter(where priority is not null and priority<>''),'[]'::jsonb),
  'issues',coalesce(jsonb_agg(distinct issue) filter(where issue is not null and issue<>''),'[]'::jsonb))
 from (select c.company,c.city,c.status,c.issue,case when c.source_sheet='Portal Intake' or c.formula_metadata ? 'AV' then coalesce(r.priority,'') else c.priority end as priority
  from public.workbook_import_cases c
  left join public.case_workflow w using(source_sha256,source_sheet,source_row)
  left join public.workbook_issue_rules r on lower(r.issue)=lower(c.issue)
  where c.source_sha256=p_source_sha
   and public.desk_case_in_scope(c.company,c.city,coalesce(w.assigned_fso,c.assigned_fso))) options;
$$;
revoke all on function public.workbook_filter_options(text) from public,anon;
grant execute on function public.workbook_filter_options(text) to authenticated;

create or replace function public.workflow_counters(p_sha text) returns jsonb
language sql stable security definer set search_path='' as $$
 with unread as materialized (select public.workspace_unread_count() as n)
 select jsonb_build_object(
  'to_acknowledge',count(*) filter(where (c.status='Pending' or c.status='Closed' and w.reopened_at is not null and w.stage is distinct from 'Closed') and (w.stage is null or w.stage='New')),
  'in_progress',count(*) filter(where (c.status is distinct from 'Closed' or w.reopened_at is not null) and w.stage in ('In progress','Arrived','Submitted','Reviewed')),
  'reports_to_review',count(*) filter(where (c.status is distinct from 'Closed' or w.reopened_at is not null) and w.stage='Submitted'),
  'unread_messages',(select n from unread),
  'updates_to_review',count(*) filter(where (c.status is distinct from 'Closed' or w.reopened_at is not null) and w.stage='Submitted')+(select n from unread))
 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
 where c.source_sha256=p_sha
  and public.desk_case_in_scope(c.company,c.city,coalesce(w.assigned_fso,c.assigned_fso));
$$;
revoke all on function public.workflow_counters(text) from public,anon;
grant execute on function public.workflow_counters(text) to authenticated;

create or replace function public.desk_case_list(p_sha text,p_filters jsonb default '{}'::jsonb,p_page integer default 0,p_size integer default 50) returns jsonb
language sql stable security definer set search_path='' as $$
 with filtered as materialized (
  select c.*,w.stage as desk_stage,w.assigned_fso as desk_officer,w.recovered_amount as desk_recovered,w.reopened_at as desk_reopened_at
  from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
  where c.source_sha256=p_sha
   and public.desk_case_in_scope(c.company,c.city,coalesce(w.assigned_fso,c.assigned_fso))
   and (coalesce(p_filters->>'company','')='' or c.company=p_filters->>'company')
   and (coalesce(p_filters->>'city','')='' or c.city=p_filters->>'city')
   and (coalesce(p_filters->>'priority','')='' or (case when c.source_sheet='Portal Intake' or c.formula_metadata ? 'AV' then coalesce((select priority from public.workbook_issue_rules where lower(issue)=lower(c.issue)),'') else c.priority end)=p_filters->>'priority')
   and (coalesce(p_filters->>'issue','')='' or c.issue=p_filters->>'issue')
   and (coalesce(trim(p_filters->>'search'),'')='' or position(lower(trim(p_filters->>'search')) in lower(c.case_id))>0)
   and (nullif(p_filters->>'from','') is null or c.reported_date_iso>=(p_filters->>'from')::date)
   and (nullif(p_filters->>'to','') is null or c.reported_date_iso<=(p_filters->>'to')::date)
   and case coalesce(p_filters->>'status','')
    when '' then true
    when '__to_ack__' then (c.status='Pending' or c.status='Closed' and w.reopened_at is not null and w.stage is distinct from 'Closed') and (w.stage is null or w.stage='New')
    when '__active__' then (c.status is distinct from 'Closed' or w.reopened_at is not null) and w.stage in ('In progress','Arrived','Submitted','Reviewed')
    when '__review__' then (c.status is distinct from 'Closed' or w.reopened_at is not null) and w.stage='Submitted'
    when '__open__' then (c.status is distinct from 'Closed' and w.stage is distinct from 'Closed') or (w.reopened_at is not null and w.stage is distinct from 'Closed')
    when '__blank__' then (c.status is null or c.status='') and w.stage is distinct from 'Closed'
    when 'Closed' then (c.status='Closed' and w.reopened_at is null) or w.stage='Closed'
    when 'Pending' then (c.status='Pending' or c.status='Closed' and w.reopened_at is not null and w.stage is distinct from 'Closed') and (w.stage is null or w.stage in ('New','Acknowledged'))
    else (c.status=p_filters->>'status' or (p_filters->>'status'='Pending' and c.status='Closed' and w.reopened_at is not null)) and w.stage is distinct from 'Closed' end
 ), paged as (
  select * from filtered order by reported_date_iso desc nulls last,source_sheet,source_row desc
  limit greatest(1,least(p_size,100)) offset greatest(0,p_page)*greatest(1,least(p_size,100))
 )
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(
  public.workbook_calculated((to_jsonb(p)-'desk_stage'-'desk_officer'-'desk_recovered'-'desk_reopened_at')||case when p.status='Closed' and p.desk_reopened_at is not null and p.desk_stage is distinct from 'Closed' then jsonb_build_object('status','Pending','closure_date_iso','','closure_date','') else '{}'::jsonb end,
   jsonb_build_object('stage',p.desk_stage,'assigned_fso',p.desk_officer,'recovered_amount',p.desk_recovered,'closed_date',(select (max(e.created_at) at time zone 'Asia/Karachi')::date from public.case_workflow_events e where (e.source_sha256,e.source_sheet,e.source_row)=(p.source_sha256,p.source_sheet,p.source_row) and e.action='close' and not exists(select 1 from public.case_workflow_events reopened where (reopened.source_sha256,reopened.source_sheet,reopened.source_row)=(e.source_sha256,e.source_sheet,e.source_row) and reopened.action='reopen' and reopened.created_at>e.created_at))) ||jsonb_build_object(
    'case_workflow',case when p.desk_stage is null then null else jsonb_build_object('stage',p.desk_stage) end
     )) order by p.reported_date_iso desc nulls last,p.source_sheet,p.source_row desc
 ) from paged p),'[]'::jsonb));
$$;
revoke all on function public.desk_case_list(text,jsonb,integer,integer) from public,anon;
grant execute on function public.desk_case_list(text,jsonb,integer,integer) to authenticated;

-- Helps the newest-first ordering on the case board/new-cases list.
create index if not exists workbook_cases_board_order on public.workbook_import_cases(source_sha256,reported_date_iso desc nulls last,source_sheet,source_row desc);

analyze public.workbook_import_cases;
analyze public.case_workflow;
notify pgrst,'reload schema';
commit;
