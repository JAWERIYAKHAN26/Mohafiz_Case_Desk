-- Live intake, server-generated IDs, navigation activity, and per-group unread badges.
-- Requires 20261103_workflow_realtime_chat.sql. Original imported rows are preserved.
begin;

create table if not exists public.portal_visits (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null,
 actor_name text not null, page text not null, created_at timestamptz not null default now()
);
create index if not exists portal_visits_actor_time on public.portal_visits(actor_id,created_at desc);
alter table public.portal_visits enable row level security;
revoke all on public.portal_visits from public,anon,authenticated;
grant select on public.portal_visits to authenticated;
drop policy if exists own_visits on public.portal_visits;
create policy own_visits on public.portal_visits for select to authenticated using(actor_id=(select auth.uid()));

create or replace function public.portal_record_visit(p_page text) returns void
language plpgsql security definer set search_path='' as $$
declare metadata jsonb:=auth.jwt()->'app_metadata';
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_page not in ('dashboard','cases','reports','new','intake') and not coalesce(public.workspace_group_access(p_page),false) then raise exception 'Unknown or inaccessible page'; end if;
 insert into public.portal_visits(actor_id,actor_name,page) values(auth.uid(),coalesce(metadata->>'display_name',metadata->>'officer_name',metadata->>'role','User'),p_page);
end; $$;
revoke all on function public.portal_record_visit(text) from public,anon;
grant execute on function public.portal_record_visit(text) to authenticated;

create or replace function public.portal_recent_activity(p_sha text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(recent) order by created_at desc),'[]'::jsonb) from (
  select id,action,actor_name,source_sheet,source_row,created_at from public.case_workflow_events where source_sha256=p_sha
  union all
  select id,'Opened '||case page when 'dashboard' then 'Dashboard' when 'cases' then 'Case Board' when 'reports' then 'Reports' when 'new' then 'New Cases' when 'intake' then 'Raise a Case' else 'Mohafiz X '||split_part(page,':',3) end,actor_name,''::text,0,created_at from public.portal_visits
  order by created_at desc limit 6
 ) recent;
$$;
revoke all on function public.portal_recent_activity(text) from public,anon;
grant execute on function public.portal_recent_activity(text) to authenticated;

create or replace function public.workspace_unread_groups() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select coalesce(jsonb_object_agg(group_key,n),'{}'::jsonb) into result from (
  select m.group_key,count(*) as n from public.workspace_messages m
  left join public.workspace_read_cursors r on r.user_id=auth.uid() and r.group_key=m.group_key
  where m.sender_id<>auth.uid() and m.created_at>coalesce(r.read_at,'-infinity'::timestamptz) and public.workspace_group_access(m.group_key)
  group by m.group_key
 ) unread;
 return result;
end; $$;
revoke all on function public.workspace_unread_groups() from public,anon;
grant execute on function public.workspace_unread_groups() to authenticated;

-- The same acknowledgement transaction notifies the relevant city and client chats.
create or replace function public.portal_acknowledgement_messages() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; city_group text;
begin
 if new.action<>'acknowledge' then return new; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=new.source_sha256 and source_sheet=new.source_sheet and source_row=new.source_row;
 city_group:=case when c.city='Rawalpindi' then 'Islamabad' else c.city end;
 if city_group in ('Islamabad','Karachi','Lahore') then
  insert into public.workspace_messages(id,group_key,body)
  values(gen_random_uuid(),'group:city:'||city_group,'Case '||coalesce(c.case_id,'')||' acknowledged by CRO. Sent to SFSO for field coordination. City: '||coalesce(c.city,'')||'. Location: '||coalesce(c.location,'Not recorded'));
 end if;
 if c.company in ('PostEx','Daraz','Buscaro') then
  insert into public.workspace_messages(id,group_key,body)
  values(gen_random_uuid(),'group:company:'||c.company,'Case '||coalesce(c.case_id,'')||' has been acknowledged by CRO and forwarded for field coordination.');
 end if;
 return new;
end; $$;
revoke all on function public.portal_acknowledgement_messages() from public,anon,authenticated;
drop trigger if exists portal_acknowledgement_messages on public.case_workflow_events;
create trigger portal_acknowledgement_messages after insert on public.case_workflow_events for each row execute function public.portal_acknowledgement_messages();

-- New records are explicitly labelled Portal Intake, never substituted for Excel rows.
create table if not exists public.portal_case_requests (
 request_id uuid primary key, actor_id uuid not null, source_sha256 text not null,
 source_row integer not null, case_id text not null unique
);
alter table public.portal_case_requests enable row level security;
revoke all on public.portal_case_requests from public,anon,authenticated;
create sequence if not exists public.portal_case_rows;
revoke all on sequence public.portal_case_rows from public,anon,authenticated;

create or replace function public.portal_create_case(p_sha text,p_request uuid,p_data jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare
 metadata jsonb:=auth.jwt()->'app_metadata'; role_name text:=metadata->>'role';
 company_name text:=trim(p_data->>'company'); city_name text:=trim(p_data->>'city');
 today date:=(now() at time zone 'Asia/Karachi')::date; incident date;
 prefix text; generated text; next_number bigint; row_number integer; amount numeric; prior public.portal_case_requests%rowtype;
begin
 if auth.uid() is null or role_name is null or role_name<>'Client' then raise exception 'Case creation is not permitted'; end if;
 if p_request is null or p_sha is null or p_sha<>'1be36f4fe2c0daf28c1a3b5b02432d7d7a30fdf211a456e9c3d3e412861f48b3' then raise exception 'Invalid case request'; end if;
 company_name:=metadata->>'company';
 if company_name is null or city_name is null or not exists(select 1 from public.workbook_import_cases where source_sha256=p_sha and company=company_name) or not exists(select 1 from public.workbook_import_cases where source_sha256=p_sha and city=city_name) then raise exception 'Select a known company and city'; end if;
 if not coalesce(public.workbook_row_readable(company_name,city_name,null),false) then raise exception 'Case outside your coverage'; end if;
 if coalesce(length(trim(p_data->>'hub')),0) not between 1 and 200
 or coalesce(length(trim(p_data->>'location')),0) not between 1 and 2000
 or coalesce(length(trim(p_data->>'description')),0) not between 10 and 10000
 or coalesce(length(trim(p_data->>'rider_name')),0) not between 1 and 200
 or coalesce(length(trim(p_data->>'rider_phone')),0) not between 1 and 50
 or coalesce(length(trim(p_data->>'issue')),0) not between 1 and 200
 or coalesce(p_data->>'priority','') not in ('High','Medium','Low') then raise exception 'Complete the required case information'; end if;
 amount:=(p_data->>'amount')::numeric;
 incident:=(p_data->>'incident_date')::date;
 if amount is null or amount<0 or amount>999999999999 or incident is null or incident>today then raise exception 'Invalid amount or incident date'; end if;
 -- One transaction allocates both the display ID and row key; retries return the saved ID.
 perform pg_catalog.pg_advisory_xact_lock(6472491104);
 select * into prior from public.portal_case_requests where request_id=p_request;
 if found then
  if prior.actor_id<>auth.uid() or prior.source_sha256<>p_sha then raise exception 'Request belongs to a different session'; end if;
  return prior.case_id;
 end if;
 prefix:=upper(left(company_name,3)||'-'||left(city_name,3)||'-'||to_char(today,'MON-YY')||'-');
 select coalesce(max(n),0)+1 into next_number from (
  select substring(case_id from length(prefix)+1)::bigint as n
  from public.workbook_import_cases where left(case_id,length(prefix))=prefix and substring(case_id from length(prefix)+1)~'^[0-9]{1,12}$'
  union all
  select substring(case_id from length(prefix)+1)::bigint
  from public.portal_case_requests where left(case_id,length(prefix))=prefix and substring(case_id from length(prefix)+1)~'^[0-9]{1,12}$'
 ) allocated;
 generated:=prefix||next_number;
 row_number:=nextval('public.portal_case_rows')::integer;
 insert into public.workbook_import_cases(source_sha256,source_sheet,source_row,source_row_sha256,case_id,company,city,hub,issue,priority,location,rider_name,rider_phone,reported_date,reported_date_iso,incident_date,incident_date_iso,reporting_month,reporting_year,total_loss,total_loss_numeric,company_loss,company_loss_numeric,recovered,recovered_numeric,status,description,logged_by,formula_metadata,raw_cell_metadata)
 values(p_sha,'Portal Intake',row_number,repeat(md5(p_request::text),2),generated,company_name,city_name,trim(p_data->>'hub'),trim(p_data->>'issue'),p_data->>'priority',trim(p_data->>'location'),trim(p_data->>'rider_name'),trim(p_data->>'rider_phone'),today::text,today,incident::text,incident,to_char(today,'Mon'),to_char(today,'YYYY'),amount::text,amount,amount::text,amount,'0',0,'Pending',trim(p_data->>'description'),coalesce(metadata->>'display_name',role_name),'{}'::jsonb,jsonb_build_object('origin','portal','request_id',p_request,'created_by',auth.uid()));
 insert into public.portal_case_requests values(p_request,auth.uid(),p_sha,row_number,generated);
 insert into public.case_workflow_events(source_sha256,source_sheet,source_row,action,actor_id,actor_name)
 values(p_sha,'Portal Intake',row_number,'Raised a case',auth.uid(),coalesce(metadata->>'display_name',role_name));
 return generated;
end; $$;
revoke all on function public.portal_create_case(text,uuid,jsonb) from public,anon;
grant execute on function public.portal_create_case(text,uuid,jsonb) to authenticated;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='workbook_import_cases') then
  alter publication supabase_realtime add table public.workbook_import_cases;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
