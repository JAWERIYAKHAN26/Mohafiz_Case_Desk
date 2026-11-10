-- Audit log access is restricted to CRO Manager, including direct RPC calls.
begin;
create or replace function public.portal_record_visit(p_page text) returns void
language plpgsql security definer set search_path='' as $$
declare metadata jsonb:=auth.jwt()->'app_metadata';
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_page='audit' then
  if coalesce(metadata->>'role','') <> 'CRO Manager' then raise exception 'Audit logs are restricted to CRO Manager'; end if;
 elsif p_page not in ('dashboard','cases','reports','new','intake') and not coalesce(public.workspace_group_access(p_page),false) then
  raise exception 'Unknown or inaccessible page';
 end if;
 insert into public.portal_visits(actor_id,actor_name,page)
 values(auth.uid(),coalesce(metadata->>'display_name',metadata->>'officer_name',metadata->>'role','User'),p_page);
end; $$;
revoke all on function public.portal_record_visit(text) from public,anon;
grant execute on function public.portal_record_visit(text) to authenticated;

create or replace function public.portal_audit_logs(p_sha text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','') <> 'CRO Manager' then
  raise exception 'Audit logs are restricted to CRO Manager' using errcode='42501';
 end if;
 return (
  select coalesce(jsonb_agg(to_jsonb(recent) order by created_at desc),'[]'::jsonb) from (
   select id,action,actor_name,source_sheet,source_row,created_at
   from public.case_workflow_events where source_sha256=p_sha
   union all
   select id,'Opened '||page,actor_name,''::text,0,created_at from public.portal_visits
   order by created_at desc limit 100
  ) recent
 );
end; $$;
revoke all on function public.portal_audit_logs(text) from public,anon;
grant execute on function public.portal_audit_logs(text) to authenticated;
commit;
