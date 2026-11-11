begin;

alter table public.case_workflow add column if not exists reopened_at timestamptz;

create or replace function public.desk_reopen_case(p_sha text,p_sheet text,p_row integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; w public.case_workflow%rowtype; metadata jsonb:=auth.jwt()->'app_metadata';
begin
 if auth.uid() is null or coalesce(metadata->>'role','') not in ('CRO','CRO Manager') then raise exception 'Only CRO may reopen a case'; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=p_sha and source_sheet=p_sheet and source_row=p_row for update;
 if not coalesce(public.desk_case_visible(p_sha,p_sheet,p_row),false) then raise exception 'Case outside your coverage'; end if;
 select * into w from public.case_workflow where source_sha256=p_sha and source_sheet=p_sheet and source_row=p_row for update;
 if c.status is distinct from 'Closed' and w.stage is distinct from 'Closed' then raise exception 'This case is not closed'; end if;
 insert into public.case_workflow(source_sha256,source_sheet,source_row,stage,assigned_fso,recovered_amount,classification,queued,reopened_at)
 values(p_sha,p_sheet,p_row,'In progress',coalesce(w.assigned_fso,c.assigned_fso),w.recovered_amount,w.classification,false,now())
 on conflict(source_sha256,source_sheet,source_row) do update set stage='In progress',assigned_fso=coalesce(case_workflow.assigned_fso,excluded.assigned_fso),queued=false,reopened_at=now(),updated_at=now()
 returning * into w;
 insert into public.case_workflow_events(source_sha256,source_sheet,source_row,action,body,actor_id,actor_name)
 values(p_sha,p_sheet,p_row,'reopen','Case reopened by CRO',auth.uid(),coalesce(metadata->>'display_name',metadata->>'officer_name',metadata->>'role'));
 return to_jsonb(w);
end; $$;
revoke all on function public.desk_reopen_case(text,text,integer) from public,anon;
grant execute on function public.desk_reopen_case(text,text,integer) to authenticated;

create or replace function public.portal_case_reopened_messages() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; city_group text; officer text;
begin
 if new.action<>'reopen' then return new; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=new.source_sha256 and source_sheet=new.source_sheet and source_row=new.source_row;
 select coalesce(w.assigned_fso,c.assigned_fso) into officer from public.case_workflow w
  where (w.source_sha256,w.source_sheet,w.source_row)=(new.source_sha256,new.source_sheet,new.source_row);
 city_group:=case when c.city='Rawalpindi' then 'Islamabad' else c.city end;
 if city_group in ('Islamabad','Karachi','Lahore') then
  insert into public.workspace_messages(id,group_key,body)
  values(gen_random_uuid(),'group:city:'||city_group,'Case '||coalesce(c.case_id,'')||' has been reopened by CRO and returned to In Progress. The previous FSO assignment'||case when nullif(officer,'') is null then ' is unchanged.' else ' to '||officer||' is restored.' end||' SFSO team: please resume coordination from the existing case conversation.');
 end if;
 if c.company in ('PostEx','Daraz','Buscaro') then
  insert into public.workspace_messages(id,group_key,body)
  values(gen_random_uuid(),'group:company:'||c.company,'Case '||coalesce(c.case_id,'')||' has been reopened by CRO. Work is continuing from the existing case history.');
 end if;
 return new;
end; $$;
revoke all on function public.portal_case_reopened_messages() from public,anon,authenticated;
drop trigger if exists portal_case_reopened_messages on public.case_workflow_events;
create trigger portal_case_reopened_messages after insert on public.case_workflow_events for each row execute function public.portal_case_reopened_messages();

create or replace function public.desk_case_action(p_sha text,p_sheet text,p_row integer,p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; w public.case_workflow%rowtype;
 metadata jsonb:=auth.jwt()->'app_metadata'; role_name text:=metadata->>'role';
 cro boolean:=coalesce(role_name in ('CRO','CRO Manager'),false);
 reviewer boolean:=coalesce(role_name in ('CRO','CRO Manager','SFSO','SOM'),false);
 body text:=nullif(trim(p_data->>'body'),''); officer text:=nullif(trim(p_data->>'officer'),'');
 amount numeric; attachments jsonb:=coalesce(p_data->'attachments','[]'::jsonb); officer_busy boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=p_sha and source_sheet=p_sheet and source_row=p_row for update;
 if not coalesce(public.desk_case_visible(p_sha,p_sheet,p_row),false) then raise exception 'Case outside your coverage'; end if;
 select * into w from public.case_workflow where source_sha256=p_sha and source_sheet=p_sheet and source_row=p_row for update;
 if (c.status='Closed' and w.reopened_at is null) or w.stage='Closed' then raise exception 'This case is closed'; end if;
 if p_action='acknowledge' and cro and (w.stage is null or w.stage='New') then w.stage:='Acknowledged';
 elsif p_action='progress' and cro and (w.stage is null or w.stage in ('New','Acknowledged')) then w.stage:='In progress';
 elsif p_action='assign' and reviewer then
  if cro and not coalesce((p_data->>'sfso_unavailable')::boolean,false) then raise exception 'CRO fallback assignment requires SFSO unavailability'; end if;
  if officer is null or not exists(select 1 from auth.users u where u.raw_app_meta_data->>'role'='FSO' and u.raw_app_meta_data->>'officer_name'=officer and u.raw_app_meta_data->>'city'=c.city and (u.banned_until is null or u.banned_until<now())) then raise exception 'Choose a registered FSO in the case city'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.city||':'||officer,0));
  select exists(select 1 from public.workbook_import_cases other join public.case_workflow ow using(source_sha256,source_sheet,source_row)
   where coalesce(ow.assigned_fso,other.assigned_fso)=officer and other.city=c.city and ow.stage in ('In progress','Arrived','Submitted','Reviewed') and other.status is distinct from 'Closed'
   and (other.source_sha256,other.source_sheet,other.source_row)<>(p_sha,p_sheet,p_row)) into officer_busy;
  w.assigned_fso:=officer;w.stage:='Acknowledged';w.queued:=officer_busy;body:='Assigned to '||officer||case when officer_busy then ' (queued behind current field case)' else '' end;
 elsif p_action='reject' and role_name='FSO' and w.stage in ('Acknowledged','In progress') then
  if coalesce(length(body),0) not between 10 and 2000 then raise exception 'Explain rejection in 10 to 2000 characters'; end if;
  w.assigned_fso:='';w.stage:='Acknowledged';w.queued:=false;
 elsif p_action='start' and role_name='FSO' and w.stage='Acknowledged' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.city||':'||coalesce(w.assigned_fso,c.assigned_fso),0));
  if exists(select 1 from public.workbook_import_cases other join public.case_workflow ow using(source_sha256,source_sheet,source_row)
   where coalesce(ow.assigned_fso,other.assigned_fso)=metadata->>'officer_name' and other.city=c.city and ow.stage in ('In progress','Arrived','Submitted','Reviewed') and other.status is distinct from 'Closed'
   and (other.source_sha256,other.source_sheet,other.source_row)<>(p_sha,p_sheet,p_row)) then raise exception 'Complete the current field case before starting this queued case'; end if;
  w.stage:='In progress';w.queued:=false;
 elsif p_action='arrive' and role_name='FSO' and w.stage='In progress' then w.stage:='Arrived';
 elsif p_action='report' and role_name='FSO' and w.stage in ('Arrived','Submitted') and length(body) between 20 and 10000 then w.stage:='Submitted';
 elsif p_action='review' and reviewer and w.stage='Submitted' then w.stage:='Reviewed';
 elsif p_action='findings' and cro and length(body) between 20 and 10000 then w.stage:=coalesce(w.stage,'New');
 elsif p_action='note' and reviewer and length(body) between 1 and 10000 then
  if coalesce(p_data->>'classification','') not in ('','Genuine','Fake','Under investigation') then raise exception 'Invalid classification'; end if;
  w.classification:=nullif(p_data->>'classification','');w.stage:=coalesce(w.stage,'New');
 elsif p_action='recovery' and reviewer then
  amount:=(p_data->>'amount')::numeric;
  if amount is null or amount<0 or amount>999999999999 or (c.total_loss_numeric is not null and amount>c.total_loss_numeric) then raise exception 'Recovery must be between zero and the case exposure'; end if;
  w.recovered_amount:=amount;w.stage:=coalesce(w.stage,'New');body:='Recovered amount updated to PKR '||amount;
 elsif p_action='close' and cro then
  if nullif(trim(c.findings),'') is null and nullif(trim(c.findings_cell),'') is null
   and not exists(select 1 from public.workbook_import_notes where source_sha256=p_sha and source_sheet=p_sheet and source_row=p_row and source_column='AC' and length(trim(note_text))>0)
   and not exists(select 1 from public.case_workflow_events e where e.source_sha256=p_sha and e.source_sheet=p_sheet and e.source_row=p_row and e.action in ('findings','report') and length(trim(e.body))>=20)
  then raise exception 'Save case findings before closing'; end if;
  w.stage:='Closed';w.queued:=false;body:='Case closed by CRO';
 else raise exception 'Action is not permitted for this role or workflow stage'; end if;
 if jsonb_typeof(attachments)<>'array' or jsonb_array_length(attachments)>6 then raise exception 'Attach up to six files'; end if;
 if jsonb_array_length(attachments)>0 then
  if p_action<>'findings' or not cro then raise exception 'Attachments are only allowed with CRO findings'; end if;
  if exists(select 1 from jsonb_array_elements(attachments) a where not coalesce(
   length(a->>'name') between 1 and 255 and a->>'path' like auth.uid()::text||'/%'
   and exists(select 1 from storage.objects o where o.bucket_id='field-evidence' and o.name=a->>'path' and o.owner_id=auth.uid()::text),false)) then raise exception 'Invalid evidence reference'; end if;
 end if;
 insert into public.case_workflow(source_sha256,source_sheet,source_row,stage,assigned_fso,recovered_amount,classification,queued)
 values(p_sha,p_sheet,p_row,w.stage,w.assigned_fso,w.recovered_amount,w.classification,coalesce(w.queued,false))
 on conflict(source_sha256,source_sheet,source_row) do update set stage=excluded.stage,assigned_fso=excluded.assigned_fso,recovered_amount=excluded.recovered_amount,classification=excluded.classification,queued=excluded.queued,updated_at=now()
 returning * into w;
 insert into public.case_workflow_events(source_sha256,source_sheet,source_row,action,body,actor_id,actor_name,attachments)
 values(p_sha,p_sheet,p_row,p_action,body,auth.uid(),coalesce(metadata->>'display_name',metadata->>'officer_name',role_name),attachments);
 return to_jsonb(w);
end; $$;
revoke all on function public.desk_case_action(text,text,integer,text,jsonb) from public,anon;
grant execute on function public.desk_case_action(text,text,integer,text,jsonb) to authenticated;

create or replace view public.workbook_effective_cases with(security_invoker=true) as
select c.source_sha256,c.source_sheet,c.source_row,calculated.source_row_sha256,calculated.serial_no,calculated.reporting_day,calculated.reporting_month,calculated.reporting_year,calculated.reported_date,calculated.company,calculated.city,calculated.region,calculated.incident_date,calculated.reporting_delay_days,calculated.issue,calculated.case_id,calculated.rider_name,calculated.rider_phone,calculated.rider_cnic,calculated.customer_name,calculated.customer_phone,calculated.customer_cnic,calculated.location,calculated.coordinates,calculated.consignment,calculated.hub,calculated.company_loss,calculated.personal_loss,calculated.total_loss,calculated.recovered,calculated.remaining_recovery,calculated.description_cell,calculated.findings_cell,calculated.last_update_date,calculated.assigned_fso,calculated.status,calculated.days_pending,calculated.sla_breach,calculated.delay_reason,calculated.closure_date,calculated.actions_taken,calculated.actions_recommended,calculated.rm_closing_remarks,calculated.nom_closing_remarks,calculated.police_station,calculated.fir_status,calculated.evidence_reference,calculated.logged_by,calculated.closed_by,calculated.case_duration,calculated.days_since_closure,calculated.priority,calculated.sla_formula_input,calculated.score_formula_input,calculated.fso_score,calculated.total_score,calculated.team_case_type,calculated.closure_sla,calculated.week,calculated.description,calculated.findings,calculated.updates_added_by,calculated.reported_date_iso,calculated.incident_date_iso,calculated.last_update_date_iso,calculated.closure_date_iso,calculated.company_loss_numeric,calculated.personal_loss_numeric,calculated.total_loss_numeric,calculated.recovered_numeric,calculated.remaining_recovery_numeric,calculated.formula_metadata,calculated.raw_cell_metadata from public.workbook_import_cases c
left join public.case_workflow w using(source_sha256,source_sheet,source_row)
cross join lateral jsonb_populate_record(null::public.workbook_import_cases,
 public.workbook_calculated(to_jsonb(c)||case when c.status='Closed' and w.reopened_at is not null and w.stage is distinct from 'Closed' then jsonb_build_object('status','Pending','closure_date_iso','','closure_date','') else '{}'::jsonb end,
 coalesce(to_jsonb(w),'{}')||jsonb_build_object('closed_date',
  (select (max(e.created_at) at time zone 'Asia/Karachi')::date from public.case_workflow_events e
   where (e.source_sha256,e.source_sheet,e.source_row)=(c.source_sha256,c.source_sheet,c.source_row) and e.action='close')))) calculated;
revoke all on public.workbook_effective_cases from public,anon;
grant select on public.workbook_effective_cases to authenticated;

create or replace function public.desk_case_list(p_sha text,p_filters jsonb default '{}'::jsonb,p_page integer default 0,p_size integer default 50) returns jsonb
language sql stable security invoker set search_path='' as $$
 with filtered as materialized (
  select c.*,w.stage as desk_stage,w.assigned_fso as desk_officer,w.recovered_amount as desk_recovered,w.reopened_at as desk_reopened_at
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
    when '__to_ack__' then (c.status='Pending' or c.status='Closed' and w.reopened_at is not null and w.stage is distinct from 'Closed') and (w.stage is null or w.stage='New')
    when '__active__' then (c.status is distinct from 'Closed' or w.reopened_at is not null) and w.stage in ('In progress','Arrived','Submitted','Reviewed')
    when '__review__' then (c.status is distinct from 'Closed' or w.reopened_at is not null) and w.stage='Submitted'
    when '__open__' then (c.status is distinct from 'Closed' and w.stage is distinct from 'Closed') or (w.reopened_at is not null and w.stage is distinct from 'Closed')
    when '__blank__' then (c.status is null or c.status='') and w.stage is distinct from 'Closed'
    when 'Closed' then (c.status='Closed' and w.reopened_at is null) or w.stage='Closed'
    when 'Pending' then (c.status='Pending' or c.status='Closed' and w.reopened_at is not null and w.stage is distinct from 'Closed') and (w.stage is null or w.stage in ('New','Acknowledged'))
    else (c.status=p_filters->>'status' or (p_filters->>'status'='Pending' and c.status='Closed' and w.reopened_at is not null)) and w.stage is distinct from 'Closed' end
   and (coalesce((select auth.jwt()->'app_metadata'->>'role'),'')<>'FSO' or (c.city=(select auth.jwt()->'app_metadata'->>'city') and coalesce(w.assigned_fso,c.assigned_fso)=(select auth.jwt()->'app_metadata'->>'officer_name')))
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

create or replace function public.workbook_summary(p_source_sha text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('total',count(*),'closed',count(*) filter(where w.stage='Closed' or c.status='Closed' and w.reopened_at is null),
  'pending',count(*) filter(where (c.status='Pending' or c.status='Closed' and w.reopened_at is not null and w.stage is distinct from 'Closed') and (w.stage is null or w.stage in ('New','Acknowledged'))),
  'unclassified',count(*) filter(where (c.status is null or c.status='') and w.stage is distinct from 'Closed'),
  'exposure',coalesce(sum(case when c.source_sheet='Portal Intake' or c.formula_metadata ? 'Y' then coalesce(c.company_loss_numeric,0)+coalesce(c.personal_loss_numeric,0) else c.total_loss_numeric end),0)::text,'recovered',coalesce(sum(coalesce(w.recovered_amount,c.recovered_numeric)),0)::text)
 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
 where c.source_sha256=p_source_sha
 and (coalesce((select auth.jwt()->'app_metadata'->>'role'),'')<>'FSO' or (c.city=(select auth.jwt()->'app_metadata'->>'city') and coalesce(w.assigned_fso,c.assigned_fso)=(select auth.jwt()->'app_metadata'->>'officer_name')));
$$;

create or replace function public.workflow_counters(p_sha text) returns jsonb
language sql stable security invoker set search_path='' as $$
 with unread as materialized (select public.workspace_unread_count() as n)
 select jsonb_build_object(
  'to_acknowledge',count(*) filter(where (c.status='Pending' or c.status='Closed' and w.reopened_at is not null and w.stage is distinct from 'Closed') and (w.stage is null or w.stage='New')),
  'in_progress',count(*) filter(where (c.status is distinct from 'Closed' or w.reopened_at is not null) and w.stage in ('In progress','Arrived','Submitted','Reviewed')),
  'reports_to_review',count(*) filter(where (c.status is distinct from 'Closed' or w.reopened_at is not null) and w.stage='Submitted'),
  'unread_messages',(select n from unread),
  'updates_to_review',count(*) filter(where (c.status is distinct from 'Closed' or w.reopened_at is not null) and w.stage='Submitted')+(select n from unread))
 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row) where c.source_sha256=p_sha;
$$;

create or replace function public.field_report_case_access(p_sha text,p_sheet text,p_row integer,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select public.desk_case_visible(p_sha,p_sheet,p_row) and coalesce(auth.jwt()->'app_metadata'->>'role','') in ('CRO','CRO Manager','FSO','SFSO','SOM')
 and (not p_write or exists(select 1 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
  where c.source_sha256=p_sha and c.source_sheet=p_sheet and c.source_row=p_row and (c.status is distinct from 'Closed' or w.reopened_at is not null) and w.stage is distinct from 'Closed'));
$$;

notify pgrst,'reload schema';
commit;