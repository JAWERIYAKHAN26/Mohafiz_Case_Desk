-- Apply after 20261115_client_intake_sfso_routing.sql.
-- Automatically dispatches notifications to internal and client groups:
-- 1. When CRO closes a case: sends message to internal city group and client company group with case ID
-- 2. When SFSO acknowledges and assigns case to an FSO: sends message to internal city group
-- 3. When FSO acknowledges case: sends message to internal city group
begin;

-- Safe identity fallback for workspace messages inserted via triggers or background jobs
create or replace function public.workspace_message_identity() returns trigger language plpgsql set search_path='' as $$
begin
 new.sender_id:=coalesce(auth.uid(),'00000000-0000-0000-0000-000000000000'::uuid);
 new.sender_role:=coalesce(auth.jwt()->'app_metadata'->>'role','System');
 new.sender_name:=coalesce(auth.jwt()->'app_metadata'->>'display_name',auth.jwt()->'app_metadata'->>'officer_name',new.sender_role);
 new.created_at:=clock_timestamp();
 return new;
end; $$;

-- 1. Trigger when CRO closes a case: auto-sends message to internal city group and client company group
create or replace function public.portal_case_closed_messages() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; city_group text;
begin
 if new.action<>'close' then return new; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=new.source_sha256 and source_sheet=new.source_sheet and source_row=new.source_row;
 city_group:=case when trim(c.city)='Rawalpindi' then 'Islamabad' else trim(c.city) end;
 -- Message to internal city group:
 if city_group in ('Islamabad','Karachi','Lahore') then
  insert into public.workspace_messages(id,group_key,body)
  values(gen_random_uuid(),'group:city:'||city_group,'Case '||coalesce(c.case_id,'')||' has been closed by CRO.');
 end if;
 -- Message to client company group:
 if trim(c.company) in ('PostEx','Daraz','Buscaro') then
  insert into public.workspace_messages(id,group_key,body)
  values(gen_random_uuid(),'group:company:'||trim(c.company),'Case '||coalesce(c.case_id,'')||' has been closed by CRO.');
 end if;
 return new;
end; $$;
revoke all on function public.portal_case_closed_messages() from public,anon,authenticated;
drop trigger if exists portal_case_closed_messages on public.case_workflow_events;
create trigger portal_case_closed_messages after insert on public.case_workflow_events for each row execute function public.portal_case_closed_messages();

-- 2. Trigger when SFSO assigns to an FSO: auto-sends message to internal city group that case is acknowledged by SFSO and assigned to FSO
create or replace function public.portal_sfso_assignment_messages() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; city_group text; officer text;
begin
 if new.action<>'assign' then return new; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=new.source_sha256 and source_sheet=new.source_sheet and source_row=new.source_row;
 select coalesce(w.assigned_fso,c.assigned_fso) into officer from public.case_workflow w
  where (w.source_sha256,w.source_sheet,w.source_row)=(new.source_sha256,new.source_sheet,new.source_row);
 city_group:=case when trim(c.city)='Rawalpindi' then 'Islamabad' else trim(c.city) end;
 if city_group in ('Islamabad','Karachi','Lahore') then
  insert into public.workspace_messages(id,group_key,body)
  values(gen_random_uuid(),'group:city:'||city_group,'Case '||coalesce(c.case_id,'')||' is acknowledged by SFSO '||new.actor_name||' and assigned to FSO '||coalesce(nullif(officer,''),'(unassigned)')||'.');
 end if;
 return new;
end; $$;
revoke all on function public.portal_sfso_assignment_messages() from public,anon,authenticated;
drop trigger if exists portal_sfso_assignment_messages on public.case_workflow_events;
create trigger portal_sfso_assignment_messages after insert on public.case_workflow_events for each row execute function public.portal_sfso_assignment_messages();

-- 3. Trigger when SFSO acknowledges case: auto-sends message to internal group and client group
create or replace function public.portal_acknowledgement_messages() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; city_group text; actor_role text:=auth.jwt()->'app_metadata'->>'role';
begin
 if new.action<>'acknowledge' then return new; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=new.source_sha256 and source_sheet=new.source_sheet and source_row=new.source_row;
 city_group:=case when trim(c.city)='Rawalpindi' then 'Islamabad' else trim(c.city) end;
 if actor_role='SFSO' then
  if city_group in ('Islamabad','Karachi','Lahore') then
   insert into public.workspace_messages(id,group_key,body)
   values(gen_random_uuid(),'group:city:'||city_group,'Case '||coalesce(c.case_id,'')||' is acknowledged by SFSO '||new.actor_name||'. Ready for FSO assignment.');
  end if;
  if trim(c.company) in ('PostEx','Daraz','Buscaro') then
   insert into public.workspace_messages(id,group_key,body)
   values(gen_random_uuid(),'group:company:'||trim(c.company),'Case '||coalesce(c.case_id,'')||' has been acknowledged by SFSO '||new.actor_name||'. The field team can now be assigned.');
  end if;
 elsif actor_role in ('CRO','CRO Manager') then
  if city_group in ('Islamabad','Karachi','Lahore') then
   insert into public.workspace_messages(id,group_key,body)
   values(gen_random_uuid(),'group:city:'||city_group,'Case '||coalesce(c.case_id,'')||' acknowledged by CRO. Sent to SFSO for field coordination. City: '||coalesce(c.city,'')||'. Location: '||coalesce(c.location,'Not recorded'));
  end if;
  if trim(c.company) in ('PostEx','Daraz','Buscaro') then
   insert into public.workspace_messages(id,group_key,body)
   values(gen_random_uuid(),'group:company:'||trim(c.company),'Case '||coalesce(c.case_id,'')||' has been acknowledged by CRO and forwarded for field coordination.');
  end if;
 end if;
 return new;
end; $$;
revoke all on function public.portal_acknowledgement_messages() from public,anon,authenticated;
drop trigger if exists portal_acknowledgement_messages on public.case_workflow_events;
create trigger portal_acknowledgement_messages after insert on public.case_workflow_events for each row execute function public.portal_acknowledgement_messages();

-- 4. Trigger when FSO acknowledges case (action = 'start'): auto-sends message to internal city group
create or replace function public.portal_field_action_messages() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; city_group text;
begin
 if new.action not in ('start','reject') then return new; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=new.source_sha256 and source_sheet=new.source_sheet and source_row=new.source_row;
 city_group:=case when trim(c.city)='Rawalpindi' then 'Islamabad' else trim(c.city) end;
 if new.action='start' then
  insert into public.workspace_messages(id,group_key,body) values(gen_random_uuid(),'group:city:'||city_group,
  'Case '||coalesce(c.case_id,'')||' acknowledged by FSO '||new.actor_name||'. Dispatch started.');
 else
  insert into public.workspace_messages(id,group_key,body) values(gen_random_uuid(),'group:city:'||city_group,
  'Case '||coalesce(c.case_id,'')||' rejected by FSO '||new.actor_name||'. Reason: '||new.body||'. Awaiting SFSO reassignment.');
 end if;
 return new;
end; $$;
revoke all on function public.portal_field_action_messages() from public,anon,authenticated;
drop trigger if exists portal_field_action_messages on public.case_workflow_events;
create trigger portal_field_action_messages after insert on public.case_workflow_events for each row execute function public.portal_field_action_messages();

notify pgrst,'reload schema';
commit;

