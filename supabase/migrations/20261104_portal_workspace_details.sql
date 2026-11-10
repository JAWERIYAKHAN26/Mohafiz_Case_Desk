-- Apply after workflow/realtime and portal parity migrations.
-- The original imported fields remain unchanged; operational values live in case_workflow.
begin;
alter table public.case_workflow add column if not exists assigned_fso text;
alter table public.case_workflow add column if not exists recovered_amount numeric check(recovered_amount>=0);
alter table public.case_workflow add column if not exists classification text;
alter table public.case_workflow add column if not exists queued boolean not null default false;
alter table public.case_workflow drop constraint if exists case_workflow_stage_check;
alter table public.case_workflow add constraint case_workflow_stage_check check(stage in ('New','Acknowledged','In progress','Arrived','Submitted','Reviewed','Closed'));
alter table public.case_workflow_events add column if not exists attachments jsonb not null default '[]'::jsonb;

create or replace function public.desk_case_visible(p_sha text,p_sheet text,p_row integer) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
  where c.source_sha256=p_sha and c.source_sheet=p_sheet and c.source_row=p_row
   and case when auth.jwt()->'app_metadata'->>'role'='FSO' then
    c.city=auth.jwt()->'app_metadata'->>'city' and nullif(auth.jwt()->'app_metadata'->>'officer_name','') is not null
    and coalesce(w.assigned_fso,c.assigned_fso)=auth.jwt()->'app_metadata'->>'officer_name'
   else public.workbook_row_readable(c.company,c.city,c.assigned_fso) end
 );
$$;
revoke all on function public.desk_case_visible(text,text,integer) from public,anon;
grant execute on function public.desk_case_visible(text,text,integer) to authenticated;

-- FSO access follows the effective assignment, including revocation from a former assignee.
alter policy workbook_cases_scoped_read on public.workbook_import_cases using (
 (select auth.uid()) is not null and case (select auth.jwt()->'app_metadata'->>'role')
 when 'CRO' then true when 'CRO Manager' then true
 when 'Client' then company=(select auth.jwt()->'app_metadata'->>'company') and nullif((select auth.jwt()->'app_metadata'->>'company'),'') is not null
 when 'FSO' then city=(select auth.jwt()->'app_metadata'->>'city') and public.desk_case_visible(source_sha256,source_sheet,source_row)
 when 'SFSO' then city=(select auth.jwt()->'app_metadata'->>'city') or ((select auth.jwt()->'app_metadata'->>'city')='Islamabad' and city='Rawalpindi')
 when 'SOM' then city=(select auth.jwt()->'app_metadata'->>'city') or ((select auth.jwt()->'app_metadata'->>'city')='Islamabad' and city='Rawalpindi')
 else false end
);

create or replace function public.desk_case_officers(p_sha text,p_sheet text,p_row integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target_city text; result jsonb;
begin
 if not coalesce(public.desk_case_visible(p_sha,p_sheet,p_row),false) or coalesce(auth.jwt()->'app_metadata'->>'role','') not in ('CRO','CRO Manager','SFSO','SOM') then raise exception 'Officer list is not permitted'; end if;
 select city into strict target_city from public.workbook_import_cases where source_sha256=p_sha and source_sheet=p_sheet and source_row=p_row;
 select coalesce(jsonb_agg(jsonb_build_object('name',name,'busy',busy) order by name),'[]'::jsonb) into result from (
  select distinct u.raw_app_meta_data->>'officer_name' as name,
   exists(select 1 from public.workbook_import_cases c join public.case_workflow w using(source_sha256,source_sheet,source_row)
    where coalesce(w.assigned_fso,c.assigned_fso)=u.raw_app_meta_data->>'officer_name' and c.city=target_city and c.status is distinct from 'Closed' and w.stage in ('In progress','Arrived','Submitted','Reviewed')) as busy
  from auth.users u where u.raw_app_meta_data->>'role'='FSO' and u.raw_app_meta_data->>'city'=target_city
   and nullif(u.raw_app_meta_data->>'officer_name','') is not null and (u.banned_until is null or u.banned_until<now())
 ) officers;
 return result;
end; $$;
revoke all on function public.desk_case_officers(text,text,integer) from public,anon;
grant execute on function public.desk_case_officers(text,text,integer) to authenticated;

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
 if c.status='Closed' or w.stage='Closed' then raise exception 'This case is closed'; end if;
 if p_action='acknowledge' and cro and (w.stage is null or w.stage='New') then w.stage:='Acknowledged';
 elsif p_action='progress' and cro and (w.stage is null or w.stage in ('New','Acknowledged')) then w.stage:='In progress';
 elsif p_action='assign' and reviewer then
  if cro and not coalesce((p_data->>'sfso_unavailable')::boolean,false) then raise exception 'CRO fallback assignment requires SFSO unavailability'; end if;
  if officer is null or not exists(select 1 from auth.users u where u.raw_app_meta_data->>'role'='FSO' and u.raw_app_meta_data->>'officer_name'=officer and u.raw_app_meta_data->>'city'=c.city and (u.banned_until is null or u.banned_until<now())) then raise exception 'Choose a registered FSO in the case city'; end if;
  -- Serialize assignment/start per officer to avoid two simultaneous active dispatches.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.city||':'||officer,0));
  select exists(select 1 from public.workbook_import_cases other join public.case_workflow ow using(source_sha256,source_sheet,source_row)
   where coalesce(ow.assigned_fso,other.assigned_fso)=officer and other.city=c.city and ow.stage in ('In progress','Arrived','Submitted','Reviewed') and other.status is distinct from 'Closed'
   and (other.source_sha256,other.source_sheet,other.source_row)<>(p_sha,p_sheet,p_row)) into officer_busy;
  w.assigned_fso:=officer;w.stage:='Acknowledged';w.queued:=officer_busy;body:='Assigned to '||officer||case when officer_busy then ' (queued behind current field case)' else '' end;
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
 elsif p_action='note' and reviewer and length(body) between 10 and 10000 then
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

-- Keep existing field controls on the same authoritative state machine.
create or replace function public.case_workflow_action(p_sha text,p_sheet text,p_row integer,p_action text,p_body text default '') returns text
language sql security invoker set search_path='' as $$
 select public.desk_case_action(p_sha,p_sheet,p_row,p_action,jsonb_build_object('body',p_body))->>'stage';
$$;

create or replace function public.field_report_case_access(p_sha text,p_sheet text,p_row integer,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select public.desk_case_visible(p_sha,p_sheet,p_row) and coalesce(auth.jwt()->'app_metadata'->>'role','') in ('CRO','CRO Manager','FSO','SFSO','SOM')
 and (not p_write or exists(select 1 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
  where c.source_sha256=p_sha and c.source_sheet=p_sheet and c.source_row=p_row and c.status is distinct from 'Closed' and w.stage is distinct from 'Closed'));
$$;

-- Evidence remains private. A saved event prevents uploader cleanup from deleting its files.
create policy desk_evidence_upload on storage.objects for insert to authenticated with check(bucket_id='field-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text and (select auth.jwt()->'app_metadata'->>'role') in ('CRO','CRO Manager'));
create policy desk_evidence_read on storage.objects for select to authenticated using(bucket_id='field-evidence' and exists(select 1 from public.case_workflow_events e where exists(select 1 from jsonb_array_elements(e.attachments) a where a->>'path'=storage.objects.name)));
alter policy field_evidence_cleanup_unlinked on storage.objects using(bucket_id='field-evidence' and owner_id=(select auth.uid())::text
 and not exists(select 1 from public.case_field_reports r where exists(select 1 from jsonb_array_elements(r.attachments) a where a->>'path'=storage.objects.name))
 and not exists(select 1 from public.case_workflow_events e where exists(select 1 from jsonb_array_elements(e.attachments) a where a->>'path'=storage.objects.name)));
update storage.buckets set allowed_mime_types=array(select distinct unnest(allowed_mime_types||array['application/pdf'])) where id='field-evidence';
-- Effective list values keep dashboard/board/reports in sync without rewriting source fields.
create or replace function public.desk_case_list(p_sha text,p_filters jsonb default '{}'::jsonb,p_page integer default 0,p_size integer default 50) returns jsonb
language sql stable security invoker set search_path='' as $$
 with filtered as materialized (
  select c.*,w.stage as desk_stage,w.assigned_fso as desk_officer,w.recovered_amount as desk_recovered
  from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
  where c.source_sha256=p_sha
   and (coalesce(p_filters->>'company','')='' or c.company=p_filters->>'company')
   and (coalesce(p_filters->>'city','')='' or c.city=p_filters->>'city')
   and (coalesce(p_filters->>'priority','')='' or c.priority=p_filters->>'priority')
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
   and (coalesce(auth.jwt()->'app_metadata'->>'role','')<>'FSO' or (c.city=auth.jwt()->'app_metadata'->>'city' and coalesce(w.assigned_fso,c.assigned_fso)=auth.jwt()->'app_metadata'->>'officer_name'))
 ), paged as (
  select * from filtered order by reported_date_iso desc nulls last,source_sheet,source_row desc
  limit greatest(1,least(p_size,100)) offset greatest(0,p_page)*greatest(1,least(p_size,100))
 )
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(
  (to_jsonb(p)-'desk_stage'-'desk_officer'-'desk_recovered')||jsonb_build_object(
   'assigned_fso',coalesce(p.desk_officer,p.assigned_fso),
   'recovered',coalesce(p.desk_recovered::text,p.recovered),
   'status',case when p.desk_stage='Closed' then 'Closed' else p.status end,
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
  'exposure',coalesce(sum(c.total_loss_numeric),0)::text,'recovered',coalesce(sum(coalesce(w.recovered_amount,c.recovered_numeric)),0)::text)
 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row)
 where c.source_sha256=p_source_sha
 and (coalesce(auth.jwt()->'app_metadata'->>'role','')<>'FSO' or (c.city=auth.jwt()->'app_metadata'->>'city' and coalesce(w.assigned_fso,c.assigned_fso)=auth.jwt()->'app_metadata'->>'officer_name'));
$$;
create or replace function public.workbook_filter_options(p_source_sha text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'companies',coalesce(jsonb_agg(distinct company) filter(where company is not null and company<>''),'[]'::jsonb),
  'cities',coalesce(jsonb_agg(distinct city) filter(where city is not null and city<>''),'[]'::jsonb),
  'statuses',coalesce(jsonb_agg(distinct status) filter(where status is not null and status<>''),'[]'::jsonb),
  'priorities',coalesce(jsonb_agg(distinct priority) filter(where priority is not null and priority<>''),'[]'::jsonb))
 from public.workbook_import_cases where source_sha256=p_source_sha;
$$;
create or replace function public.workflow_counters(p_sha text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'to_acknowledge',count(*) filter(where c.status='Pending' and (w.stage is null or w.stage='New')),
  'in_progress',count(*) filter(where c.status is distinct from 'Closed' and w.stage in ('In progress','Arrived','Submitted','Reviewed')),
  'reports_to_review',count(*) filter(where c.status is distinct from 'Closed' and w.stage='Submitted'),
  'unread_messages',public.workspace_unread_count(),
  'updates_to_review',count(*) filter(where c.status is distinct from 'Closed' and w.stage='Submitted')+public.workspace_unread_count())
 from public.workbook_import_cases c left join public.case_workflow w using(source_sha256,source_sheet,source_row) where c.source_sha256=p_sha;
$$;
notify pgrst,'reload schema';
commit;
