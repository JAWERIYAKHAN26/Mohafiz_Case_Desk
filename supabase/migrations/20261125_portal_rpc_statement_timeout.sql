-- Give the case portal RPCs more time to finish for every authenticated user.
-- This does not change workbook/case data or the timeout for unrelated queries.
-- Keep below the usual HTTP request deadline so PostgREST can return the result.
begin;

alter function public.desk_case_list(text,jsonb,integer,integer)
  set statement_timeout = '55s';
alter function public.workbook_summary(text)
  set statement_timeout = '55s';
alter function public.workbook_filter_options(text)
  set statement_timeout = '55s';
alter function public.workflow_counters(text)
  set statement_timeout = '55s';
alter function public.workspace_unread_count()
  set statement_timeout = '55s';
alter function public.workspace_unread_groups()
  set statement_timeout = '55s';

notify pgrst,'reload schema';
commit;
