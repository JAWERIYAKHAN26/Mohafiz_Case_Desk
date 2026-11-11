begin;

create or replace function public.sfso_acknowledge_case(p_sha text,p_sheet text,p_row integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; w public.case_workflow%rowtype; metadata jsonb:=auth.jwt()->'app_metadata';
begin
 if auth.uid() is null or coalesce(metadata->>'role','')<>'SFSO' then raise exception 'Only SFSO may acknowledge client-raised cases'; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=p_sha and source_sheet=p_sheet and source_row=p_row for update;
 if c.source_sheet<>'Portal Intake' then raise exception 'SFSO acknowledgement is only available for client-raised cases'; end if;
 if not coalesce(public.desk_case_visible(p_sha,p_sheet,p_row),false) then raise exception 'Case outside your coverage'; end if;
 select * into w from public.case_workflow where source_sha256=p_sha and source_sheet=p_sheet and source_row=p_row for update;
 if c.status='Closed' or w.stage='Closed' then raise exception 'This case is closed'; end if;
 if coalesce(w.stage,'New')<>'New' then raise exception 'This case has already entered the workflow'; end if;
 insert into public.case_workflow(source_sha256,source_sheet,source_row,stage,assigned_fso,queued)
 values(p_sha,p_sheet,p_row,'Acknowledged',coalesce(w.assigned_fso,c.assigned_fso),false)
 on conflict(source_sha256,source_sheet,source_row) do update set stage='Acknowledged',queued=false,updated_at=now()
 returning * into w;
 insert into public.case_workflow_events(source_sha256,source_sheet,source_row,action,body,actor_id,actor_name)
 values(p_sha,p_sheet,p_row,'acknowledge','Client-raised case acknowledged by SFSO',auth.uid(),coalesce(metadata->>'display_name',metadata->>'officer_name','SFSO'));
 return to_jsonb(w);
end; $$;
revoke all on function public.sfso_acknowledge_case(text,text,integer) from public,anon;
grant execute on function public.sfso_acknowledge_case(text,text,integer) to authenticated;

create or replace function public.portal_acknowledgement_messages() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; city_group text; actor_role text:=auth.jwt()->'app_metadata'->>'role';
begin
 if new.action<>'acknowledge' then return new; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=new.source_sha256 and source_sheet=new.source_sheet and source_row=new.source_row;
 city_group:=case when c.city='Rawalpindi' then 'Islamabad' else c.city end;
 if actor_role='SFSO' and c.source_sheet='Portal Intake' then
  if c.company in ('PostEx','Daraz','Buscaro') then
   insert into public.workspace_messages(id,group_key,body)
   values(gen_random_uuid(),'group:company:'||c.company,'Case '||coalesce(c.case_id,'')||' has been acknowledged by SFSO '||new.actor_name||'. The field team can now be assigned.');
  end if;
  if city_group in ('Islamabad','Karachi','Lahore') then
   insert into public.workspace_messages(id,group_key,body)
   values(gen_random_uuid(),'group:city:'||city_group,'SFSO '||new.actor_name||' acknowledged client-raised case '||coalesce(c.case_id,'')||'. Ready for FSO assignment.');
  end if;
 elsif actor_role in ('CRO','CRO Manager') then
  if city_group in ('Islamabad','Karachi','Lahore') then
   insert into public.workspace_messages(id,group_key,body)
   values(gen_random_uuid(),'group:city:'||city_group,'Case '||coalesce(c.case_id,'')||' acknowledged by CRO. Sent to SFSO for field coordination. City: '||coalesce(c.city,'')||'. Location: '||coalesce(c.location,'Not recorded'));
  end if;
  if c.company in ('PostEx','Daraz','Buscaro') then
   insert into public.workspace_messages(id,group_key,body)
   values(gen_random_uuid(),'group:company:'||c.company,'Case '||coalesce(c.case_id,'')||' has been acknowledged by CRO and forwarded for field coordination.');
  end if;
 end if;
 return new;
end; $$;
revoke all on function public.portal_acknowledgement_messages() from public,anon,authenticated;
drop trigger if exists portal_acknowledgement_messages on public.case_workflow_events;
create trigger portal_acknowledgement_messages after insert on public.case_workflow_events for each row execute function public.portal_acknowledgement_messages();

create or replace function public.portal_client_case_routing_messages() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; city_group text;
begin
 if new.action<>'Raised a case' then return new; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=new.source_sha256 and source_sheet=new.source_sheet and source_row=new.source_row;
 city_group:=case when c.city='Rawalpindi' then 'Islamabad' else c.city end;
 if c.company in ('PostEx','Daraz','Buscaro') then
  insert into public.workspace_messages(id,group_key,body)
  values(gen_random_uuid(),'group:company:'||c.company,'Case '||coalesce(c.case_id,'')||' was raised by the client and forwarded to SFSO for acknowledgement.');
 end if;
 if city_group in ('Islamabad','Karachi','Lahore') then
  insert into public.workspace_messages(id,group_key,body)
  values(gen_random_uuid(),'group:city:'||city_group,'New client-raised case '||coalesce(c.case_id,'')||' is awaiting SFSO acknowledgement and FSO assignment.');
 end if;
 return new;
end; $$;
revoke all on function public.portal_client_case_routing_messages() from public,anon,authenticated;
drop trigger if exists portal_client_case_routing_messages on public.case_workflow_events;
create trigger portal_client_case_routing_messages after insert on public.case_workflow_events for each row execute function public.portal_client_case_routing_messages();

create or replace function public.portal_sfso_assignment_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; role_name text:=auth.jwt()->'app_metadata'->>'role';
begin
 if new.action not in ('acknowledge','assign') then return new; end if;
 select * into c from public.workbook_import_cases where (source_sha256,source_sheet,source_row)=(new.source_sha256,new.source_sheet,new.source_row);
 if c.source_sheet<>'Portal Intake' then return new; end if;
 if new.action='acknowledge' and role_name<>'SFSO' then raise exception 'Client-raised cases are routed to SFSO for acknowledgement'; end if;
 if new.action='assign' then
  if role_name<>'SFSO' then raise exception 'Only SFSO may assign a client-raised case'; end if;
  if not exists(
   select 1 from public.case_workflow_events e join auth.users u on u.id=e.actor_id
   where (e.source_sha256,e.source_sheet,e.source_row)=(new.source_sha256,new.source_sheet,new.source_row)
    and e.action='acknowledge' and u.raw_app_meta_data->>'role'='SFSO'
  ) then raise exception 'Acknowledge this client-raised case before assigning an FSO'; end if;
 end if;
 return new;
end; $$;
revoke all on function public.portal_sfso_assignment_guard() from public,anon,authenticated;
drop trigger if exists portal_sfso_assignment_guard on public.case_workflow_events;
create trigger portal_sfso_assignment_guard before insert on public.case_workflow_events for each row execute function public.portal_sfso_assignment_guard();

create or replace function public.portal_sfso_assignment_messages() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; city_group text; officer text;
begin
 if new.action<>'assign' then return new; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=new.source_sha256 and source_sheet=new.source_sheet and source_row=new.source_row;
 select coalesce(w.assigned_fso,c.assigned_fso) into officer from public.case_workflow w
  where (w.source_sha256,w.source_sheet,w.source_row)=(new.source_sha256,new.source_sheet,new.source_row);
 city_group:=case when c.city='Rawalpindi' then 'Islamabad' else c.city end;
 if city_group in ('Islamabad','Karachi','Lahore') then
  insert into public.workspace_messages(id,group_key,body)
  values(gen_random_uuid(),'group:city:'||city_group,'SFSO '||new.actor_name||' assigned case '||coalesce(c.case_id,'')||' to FSO '||coalesce(nullif(officer,''),'(unassigned)')||'.');
 end if;
 return new;
end; $$;
revoke all on function public.portal_sfso_assignment_messages() from public,anon,authenticated;
drop trigger if exists portal_sfso_assignment_messages on public.case_workflow_events;
create trigger portal_sfso_assignment_messages after insert on public.case_workflow_events for each row execute function public.portal_sfso_assignment_messages();

notify pgrst,'reload schema';
commit;
