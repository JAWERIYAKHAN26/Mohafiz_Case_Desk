-- Apply after 20261110_workflow_query_performance.sql.
begin;
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


create or replace function public.portal_field_action_messages() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; city_group text;
begin
 if new.action not in ('start','reject') then return new; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=new.source_sha256 and source_sheet=new.source_sheet and source_row=new.source_row;
 city_group:=case when c.city='Rawalpindi' then 'Islamabad' else c.city end;
 insert into public.workspace_messages(id,group_key,body) values(gen_random_uuid(),'group:city:'||city_group,
 'Case '||coalesce(c.case_id,'')||case when new.action='start' then ' acknowledged by FSO '||new.actor_name||'. Dispatch started.'
 else ' rejected by FSO '||new.actor_name||'. Reason: '||new.body||'. Awaiting SFSO reassignment.' end);
 return new;
end; $$;
revoke all on function public.portal_field_action_messages() from public,anon,authenticated;
drop trigger if exists portal_field_action_messages on public.case_workflow_events;
create trigger portal_field_action_messages after insert on public.case_workflow_events for each row execute function public.portal_field_action_messages();
create or replace function public.portal_city_hubs(p_city text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(hub order by hub),'[]'::jsonb) from
 (select distinct trim(c.hub) as hub from public.workbook_import_cases c
 where c.city=p_city and nullif(trim(c.hub),'') is not null) hubs;
$$;
revoke all on function public.portal_city_hubs(text) from public,anon;
grant execute on function public.portal_city_hubs(text) to authenticated;
alter table public.workspace_messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.workspace_messages add column if not exists live_location jsonb;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-attachments','chat-attachments',false,26214400,array['image/jpeg','image/png','image/webp','application/pdf','audio/webm','audio/ogg','audio/mp4','audio/mpeg','video/mp4','video/webm'])
on conflict(id) do nothing;
drop policy if exists chat_upload on storage.objects;
create policy chat_upload on storage.objects for insert to authenticated with check(
 bucket_id='chat-attachments' and split_part(name,'/',1)=auth.uid()::text and public.workspace_group_access(split_part(name,'/',2)));
drop policy if exists chat_read on storage.objects;
create policy chat_read on storage.objects for select to authenticated using(
 bucket_id='chat-attachments' and public.workspace_group_access(split_part(name,'/',2)));
drop policy if exists chat_cleanup on storage.objects;
create policy chat_cleanup on storage.objects for delete to authenticated using(
 bucket_id='chat-attachments' and owner_id=auth.uid()::text and not exists(
 select 1 from public.workspace_messages m where m.attachments @> jsonb_build_array(jsonb_build_object('path',storage.objects.name))));
create or replace function public.chat_validate_media() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if jsonb_typeof(new.attachments)<>'array' or jsonb_array_length(new.attachments)>6 then raise exception 'Attach up to six files';end if;
 if exists(select 1 from jsonb_array_elements(new.attachments) a where not coalesce(
 length(a->>'name') between 1 and 255 and length(a->>'type') between 1 and 200
 and split_part(a->>'path','/',1)=auth.uid()::text and split_part(a->>'path','/',2)=new.group_key
 and exists(select 1 from storage.objects o where o.bucket_id='chat-attachments' and o.name=a->>'path' and o.owner_id=auth.uid()::text),false)) then raise exception 'Invalid chat attachment';end if;
 if new.live_location is not null then raise exception 'Use location sharing action';end if;
 return new;
end; $$;
revoke all on function public.chat_validate_media() from public,anon,authenticated;
drop trigger if exists chat_validate_media on public.workspace_messages;
create trigger chat_validate_media before insert on public.workspace_messages for each row execute function public.chat_validate_media();
create or replace function public.chat_share_location(p_id uuid,p_lat double precision,p_lng double precision,p_until timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare m public.workspace_messages%rowtype;
begin
 select * into strict m from public.workspace_messages where id=p_id for update;
 if auth.uid() is null or m.sender_id<>auth.uid() or auth.jwt()->'app_metadata'->>'role' is distinct from 'FSO'
 or m.group_key not like 'group:city:%' or not coalesce(public.workspace_group_access(m.group_key),false)
 then raise exception 'Only the FSO who shared this location may update it';end if;
 if p_until is null then update public.workspace_messages set live_location=live_location||jsonb_build_object('active',false,'updated_at',now()) where id=p_id;return;end if;
 if p_lat is null or p_lng is null or not (p_lat between -90 and 90) or not (p_lng between -180 and 180)
 or p_until<=now() or p_until>now()+interval '1 hour' then raise exception 'Invalid coordinates or sharing duration';end if;
 update public.workspace_messages set live_location=jsonb_build_object('lat',p_lat,'lng',p_lng,'active',true,'until',p_until,'updated_at',now()) where id=p_id;
end; $$;
revoke all on function public.chat_share_location(uuid,double precision,double precision,timestamptz) from public,anon;
grant execute on function public.chat_share_location(uuid,double precision,double precision,timestamptz) to authenticated;
-- Private broadcast/presence authorization for in-app group audio calls.
-- Supabase has realtime.messages; the isolated SQL harness does not.
do $setup$ begin
 if to_regclass('realtime.messages') is not null then
  execute 'drop policy if exists desk_group_call_read on realtime.messages';
  execute 'drop policy if exists desk_group_call_send on realtime.messages';
  execute $policy$create policy desk_group_call_read on realtime.messages for select to authenticated using (
   realtime.topic() ~ '^call:group:city:[^:]+:[0-9a-f-]{36}$' and
   public.workspace_group_access(split_part(realtime.topic(),':',2)||':'||split_part(realtime.topic(),':',3)||':'||split_part(realtime.topic(),':',4))
  )$policy$;
  execute $policy$create policy desk_group_call_send on realtime.messages for insert to authenticated with check (
   realtime.topic() ~ '^call:group:city:[^:]+:[0-9a-f-]{36}$' and
   public.workspace_group_access(split_part(realtime.topic(),':',2)||':'||split_part(realtime.topic(),':',3)||':'||split_part(realtime.topic(),':',4))
  )$policy$;
 end if;
end; $setup$;
notify pgrst,'reload schema';
commit;
