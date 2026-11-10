-- Apply after portal parity if the earlier version was already installed.
-- Only Clients can raise cases; CRO and CRO Manager review incoming cases.
begin;
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
notify pgrst,'reload schema';
commit;
