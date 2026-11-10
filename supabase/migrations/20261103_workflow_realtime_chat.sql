-- Supabase query name: Connect Workflow And Realtime Chat
-- Requires workbook import/read-access and scoped dashboard fix. No imported values are overwritten.
begin;
create table public.case_workflow (
 source_sha256 text not null,source_sheet text not null,source_row integer not null,
 stage text not null check(stage in ('Acknowledged','In progress','Arrived','Submitted','Reviewed')),
 updated_at timestamptz not null default now(),
 primary key(source_sha256,source_sheet,source_row),
 foreign key(source_sha256,source_sheet,source_row) references public.workbook_import_cases(source_sha256,source_sheet,source_row)
);
create table public.case_workflow_events (
 id uuid primary key default gen_random_uuid(),source_sha256 text not null,source_sheet text not null,source_row integer not null,
 action text not null,body text,actor_id uuid not null,actor_name text not null,created_at timestamptz not null default now(),
 foreign key(source_sha256,source_sheet,source_row) references public.workbook_import_cases(source_sha256,source_sheet,source_row)
);
create index case_workflow_events_case on public.case_workflow_events(source_sha256,source_sheet,source_row,created_at);
alter table public.case_workflow enable row level security;
alter table public.case_workflow_events enable row level security;
revoke all on public.case_workflow,public.case_workflow_events from public,anon,authenticated;
grant select on public.case_workflow,public.case_workflow_events to authenticated;
create policy workflow_read on public.case_workflow for select to authenticated using(exists(select 1 from public.workbook_import_cases c where (c.source_sha256,c.source_sheet,c.source_row)=(case_workflow.source_sha256,case_workflow.source_sheet,case_workflow.source_row)));
create policy workflow_events_read on public.case_workflow_events for select to authenticated using(exists(select 1 from public.workbook_import_cases c where (c.source_sha256,c.source_sheet,c.source_row)=(case_workflow_events.source_sha256,case_workflow_events.source_sheet,case_workflow_events.source_row)));
create function public.case_workflow_action(p_sha text,p_sheet text,p_row integer,p_action text,p_body text default '') returns text
language plpgsql security definer set search_path='' as $$
declare c public.workbook_import_cases%rowtype; current_stage text; next_stage text; metadata jsonb:=auth.jwt()->'app_metadata'; role_name text:=metadata->>'role';
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into strict c from public.workbook_import_cases where source_sha256=p_sha and source_sheet=p_sheet and source_row=p_row for update;
 if not coalesce(public.workbook_row_readable(c.company,c.city,c.assigned_fso),false) then raise exception 'Case outside your coverage'; end if;
 if c.status='Closed' then raise exception 'Closed source cases cannot be dispatched'; end if;
 select stage into current_stage from public.case_workflow where source_sha256=p_sha and source_sheet=p_sheet and source_row=p_row;
 if p_action='acknowledge' and role_name in ('CRO','CRO Manager') and current_stage is null then next_stage:='Acknowledged';
 elsif p_action='start' and role_name='FSO' and current_stage='Acknowledged' then next_stage:='In progress';
 elsif p_action='arrive' and role_name='FSO' and current_stage='In progress' then next_stage:='Arrived';
 elsif p_action='report' and role_name='FSO' and current_stage in ('Arrived','Submitted') and length(trim(p_body)) between 20 and 10000 then next_stage:='Submitted';
 elsif p_action='review' and role_name in ('CRO','CRO Manager','SFSO','SOM') and current_stage='Submitted' then next_stage:='Reviewed';
 else raise exception 'Action is not permitted for this role or workflow stage'; end if;
 insert into public.case_workflow(source_sha256,source_sheet,source_row,stage) values(p_sha,p_sheet,p_row,next_stage)
 on conflict(source_sha256,source_sheet,source_row) do update set stage=excluded.stage,updated_at=now();
 insert into public.case_workflow_events(source_sha256,source_sheet,source_row,action,body,actor_id,actor_name)
 values(p_sha,p_sheet,p_row,p_action,nullif(p_body,''),auth.uid(),coalesce(metadata->>'display_name',metadata->>'officer_name',role_name));
 return next_stage;
end; $$;
revoke all on function public.case_workflow_action(text,text,integer,text,text) from public,anon;
grant execute on function public.case_workflow_action(text,text,integer,text,text) to authenticated;

create function public.workspace_group_access(p_group text) returns boolean
language sql stable security invoker set search_path='' as $$
 select (select auth.uid()) is not null and case
 when p_group like 'group:city:%' then
  (auth.jwt()->'app_metadata'->>'role' in ('CRO','CRO Manager') and split_part(p_group,':',3) in ('Islamabad','Karachi','Lahore'))
  or (auth.jwt()->'app_metadata'->>'role' in ('FSO','SFSO','SOM') and split_part(p_group,':',3)=case when auth.jwt()->'app_metadata'->>'city'='Rawalpindi' then 'Islamabad' else auth.jwt()->'app_metadata'->>'city' end)
 when p_group like 'group:company:%' then
  (auth.jwt()->'app_metadata'->>'role' in ('CRO','CRO Manager','SFSO','SOM') and split_part(p_group,':',3) in ('PostEx','Daraz','Buscaro'))
  or (auth.jwt()->'app_metadata'->>'role'='Client' and split_part(p_group,':',3)=auth.jwt()->'app_metadata'->>'company')
 else false end;
$$;
revoke all on function public.workspace_group_access(text) from public,anon;
grant execute on function public.workspace_group_access(text) to authenticated;
create table public.workspace_messages (
 id uuid primary key,group_key text not null,body text not null check(length(trim(body)) between 1 and 4000),
 sender_id uuid not null,sender_name text not null,sender_role text not null,created_at timestamptz not null default now()
);
create index workspace_messages_group_time on public.workspace_messages(group_key,created_at desc,id desc);
create function public.workspace_message_identity() returns trigger language plpgsql set search_path='' as $$
begin
 new.sender_id:=auth.uid();
 new.sender_role:=auth.jwt()->'app_metadata'->>'role';
 new.sender_name:=coalesce(auth.jwt()->'app_metadata'->>'display_name',auth.jwt()->'app_metadata'->>'officer_name',new.sender_role);
 new.created_at:=clock_timestamp();return new;
end; $$;
create trigger workspace_message_identity before insert on public.workspace_messages for each row execute function public.workspace_message_identity();
alter table public.workspace_messages enable row level security;
revoke all on public.workspace_messages from public,anon,authenticated;
grant select,insert on public.workspace_messages to authenticated;
create policy messages_read on public.workspace_messages for select to authenticated using(public.workspace_group_access(group_key));
create policy messages_send on public.workspace_messages for insert to authenticated with check(sender_id=(select auth.uid()) and public.workspace_group_access(group_key));
create table public.workspace_read_cursors(user_id uuid not null,group_key text not null,read_at timestamptz not null,primary key(user_id,group_key));
alter table public.workspace_read_cursors enable row level security;
revoke all on public.workspace_read_cursors from public,anon,authenticated;
create function public.workspace_mark_read(p_group text,p_through timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.workspace_group_access(p_group),false) or p_through>clock_timestamp() then raise exception 'Invalid read cursor'; end if;
 insert into public.workspace_read_cursors values(auth.uid(),p_group,p_through) on conflict(user_id,group_key) do update set read_at=greatest(workspace_read_cursors.read_at,excluded.read_at);
end; $$;
revoke all on function public.workspace_mark_read(text,timestamptz) from public,anon;
grant execute on function public.workspace_mark_read(text,timestamptz) to authenticated;
create function public.workspace_unread_count() returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
 if auth.uid() is null then return 0; end if;
 select count(*) into result from public.workspace_messages m left join public.workspace_read_cursors r on r.user_id=auth.uid() and r.group_key=m.group_key
 where m.sender_id<>auth.uid() and m.created_at>coalesce(r.read_at,'-infinity'::timestamptz) and public.workspace_group_access(m.group_key);
 return result;
end; $$;
revoke all on function public.workspace_unread_count() from public,anon;
grant execute on function public.workspace_unread_count() to authenticated;
create function public.workflow_counters(p_sha text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare waiting bigint; active bigint; reports bigint; unread bigint;
begin
 select count(*) into waiting from public.workbook_import_cases c where c.source_sha256=p_sha and c.status='Pending' and not exists(select 1 from public.case_workflow w where (w.source_sha256,w.source_sheet,w.source_row)=(c.source_sha256,c.source_sheet,c.source_row));
 select count(*) filter(where stage in ('In progress','Arrived','Submitted','Reviewed')),count(*) filter(where stage='Submitted') into active,reports from public.case_workflow where source_sha256=p_sha;
 unread:=public.workspace_unread_count();
 return jsonb_build_object('to_acknowledge',waiting,'in_progress',active,'updates_to_review',reports+unread,'reports_to_review',reports,'unread_messages',unread);
end; $$;
revoke all on function public.workflow_counters(text) from public,anon;
grant execute on function public.workflow_counters(text) to authenticated;
-- Default publication privileges do not replace SELECT policies.
do $$ declare name text; begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime; end if;
 foreach name in array array['workspace_messages','case_workflow','case_workflow_events'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=name) then execute format('alter publication supabase_realtime add table public.%I',name); end if;
 end loop;
end $$;
commit;

-- Ask the API to pick up the new relationships and RPCs after commit.
notify pgrst, 'reload schema';
