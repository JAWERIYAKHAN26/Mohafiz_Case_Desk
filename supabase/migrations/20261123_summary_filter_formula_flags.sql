-- Apply after 20261122_dashboard_aggregate_timeout_fix.sql. No case data is modified.
--
-- After 20261122, workflow_counters and desk_case_list load, but workbook_summary
-- and workbook_filter_options still hit the statement timeout (57014). They are
-- the only two that test formula_metadata ? 'Y' / ? 'AV' on every row. That
-- column is a large jsonb value stored out-of-line, so each test fetches and
-- decompresses it, for every case, on every dashboard load.
--
-- Fix: keep two small true/false columns, filled by a trigger on every insert
-- and update, and test those instead. A trigger (not a GENERATED column) is
-- used because the workbook importer inserts with `select * from
-- jsonb_populate_record(...)`, which Postgres rejects for generated columns.
-- The one-time backfill reads every row once; it can take a little while.
begin;

alter table public.workbook_import_cases
 add column if not exists formula_has_y boolean not null default false,
 add column if not exists formula_has_av boolean not null default false;

create or replace function public.workbook_cases_formula_flags() returns trigger
language plpgsql set search_path='' as $$
begin
 new.formula_has_y:=coalesce(new.formula_metadata ? 'Y',false);
 new.formula_has_av:=coalesce(new.formula_metadata ? 'AV',false);
 return new;
end; $$;
revoke all on function public.workbook_cases_formula_flags() from public,anon,authenticated;

drop trigger if exists workbook_cases_formula_flags on public.workbook_import_cases;
create trigger workbook_cases_formula_flags before insert or update on public.workbook_import_cases
 for each row execute function public.workbook_cases_formula_flags();

-- Backfill existing rows (only those whose flags are wrong, so re-runs are cheap).
update public.workbook_import_cases
 set formula_has_y=formula_metadata ? 'Y',formula_has_av=formula_metadata ? 'AV'
 where formula_has_y is distinct from (formula_metadata ? 'Y') or formula_has_av is distinct from (formula_metadata ? 'AV');

create or replace function public.workbook_summary(p_source_sha text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('total',count(*),'closed',count(*) filter(where w.stage='Closed' or c.status='Closed' and w.reopened_at is null),
  'pending',count(*) filter(where (c.status='Pending' or c.status='Closed' and w.reopened_at is not null and w.stage is distinct from 'Closed') and (w.stage is null or w.stage in ('New','Acknowledged'))),
  'unclassified',count(*) filter(where (c.status is null or c.status='') and w.stage is distinct from 'Closed'),
  'exposure',coalesce(sum(case when c.source_sheet='Portal Intake' or c.formula_has_y then coalesce(c.company_loss_numeric,0)+coalesce(c.personal_loss_numeric,0) else c.total_loss_numeric end),0)::text,'recovered',coalesce(sum(coalesce(w.recovered_amount,c.recovered_numeric)),0)::text)
 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
 where c.source_sha256=p_source_sha
  and public.desk_case_in_scope(c.company,c.city,coalesce(w.assigned_fso,c.assigned_fso));
$$;
revoke all on function public.workbook_summary(text) from public,anon;
grant execute on function public.workbook_summary(text) to authenticated;

create or replace function public.workbook_filter_options(p_source_sha text) returns jsonb
language sql stable security definer set search_path='' as $$
 with scoped as materialized (
  select c.company,c.city,c.status,c.issue,c.priority,(c.source_sheet='Portal Intake' or c.formula_has_av) as rule_priority
  from public.workbook_import_cases c
  left join public.case_workflow w using(source_sha256,source_sheet,source_row)
  where c.source_sha256=p_source_sha
   and public.desk_case_in_scope(c.company,c.city,coalesce(w.assigned_fso,c.assigned_fso))
 ), priorities as (
  select s.priority from scoped s where not s.rule_priority
  union
  select coalesce(r.priority,'') from (select distinct lower(issue) as issue from scoped where rule_priority) i
   left join public.workbook_issue_rules r on lower(r.issue)=i.issue
 )
 select jsonb_build_object(
  'companies',coalesce((select jsonb_agg(distinct company) from scoped where company is not null and company<>''),'[]'::jsonb),
  'cities',coalesce((select jsonb_agg(distinct city) from scoped where city is not null and city<>''),'[]'::jsonb),
  'statuses',coalesce((select jsonb_agg(distinct status) from scoped where status is not null and status<>''),'[]'::jsonb),
  'priorities',coalesce((select jsonb_agg(distinct priority) from priorities where priority is not null and priority<>''),'[]'::jsonb),
  'issues',coalesce((select jsonb_agg(distinct issue) from scoped where issue is not null and issue<>''),'[]'::jsonb));
$$;
revoke all on function public.workbook_filter_options(text) from public,anon;
grant execute on function public.workbook_filter_options(text) to authenticated;

analyze public.workbook_import_cases;
notify pgrst,'reload schema';
commit;
