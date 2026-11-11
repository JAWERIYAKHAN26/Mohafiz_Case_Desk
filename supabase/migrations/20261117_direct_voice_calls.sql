-- Direct voice calls between authenticated portal users. No chat messages are created.
begin;
create table if not exists public.workspace_direct_calls(
 id uuid primary key default gen_random_uuid(),
 caller_id uuid not null references auth.users(id),
 callee_id uuid not null references auth.users(id),
 caller_name text not null,
 callee_name text not null,
 status text not null default 'ringing' check(status in ('ringing','active','ended')),
 created_at timestamptz not null default now(),
 ring_until timestamptz not null default now()+interval '45 seconds',
 expires_at timestamptz not null default now()+interval '4 hours',
 caller_seen_at timestamptz not null default now(),
 check(caller_id<>callee_id)
);
create index if not exists workspace_direct_calls_live on public.workspace_direct_calls(caller_id,callee_id,created_at desc) where status<>'ended';
create index if not exists workspace_direct_calls_callee_live on public.workspace_direct_calls(callee_id,created_at desc) where status<>'ended';
alter table public.workspace_direct_calls enable row level security;
revoke all on public.workspace_direct_calls from public,anon,authenticated;
grant select on public.workspace_direct_calls to authenticated;
drop policy if exists direct_calls_read on public.workspace_direct_calls;
create policy direct_calls_read on public.workspace_direct_calls for select to authenticated using(caller_id=auth.uid() or callee_id=auth.uid());

create or replace function public.workspace_call_directory() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',u.id,'name',coalesce(nullif(u.raw_app_meta_data->>'display_name',''),nullif(u.raw_app_meta_data->>'officer_name',''),u.raw_app_meta_data->>'role','Portal user'),
  'role',u.raw_app_meta_data->>'role','city',u.raw_app_meta_data->>'city','company',u.raw_app_meta_data->>'company'
 ) order by coalesce(nullif(u.raw_app_meta_data->>'display_name',''),nullif(u.raw_app_meta_data->>'officer_name',''),u.raw_app_meta_data->>'role','Portal user')),'[]'::jsonb)
 from auth.users u
 where u.id<>auth.uid() and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())
 and u.raw_app_meta_data->>'role' in ('CRO','CRO Manager','SOM','SFSO','FSO','Client')
 and coalesce(auth.jwt()->'app_metadata'->>'role','') in ('CRO','CRO Manager','SOM','SFSO','FSO','Client');
$$;

create or replace function public.workspace_direct_call_state() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('is_caller',c.caller_id=auth.uid()) order by c.created_at desc),'[]'::jsonb)
 from public.workspace_direct_calls c
 where c.status<>'ended' and c.expires_at>now() and c.caller_seen_at>now()-interval '35 seconds'
 and (c.status='active' or c.ring_until>now()) and (c.caller_id=auth.uid() or c.callee_id=auth.uid());
$$;

create or replace function public.workspace_direct_call_action(p_action text,p_target uuid default null,p_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.workspace_direct_calls%rowtype; uid uuid:=auth.uid(); m jsonb:=auth.jwt()->'app_metadata'; target_meta jsonb;
begin
 if uid is null or coalesce(m->>'role','') not in ('CRO','CRO Manager','SOM','SFSO','FSO','Client') then raise exception 'Sign in with an eligible portal account';end if;
 if p_action='start' then
  if p_target is null or p_target=uid then raise exception 'Choose another portal user to call';end if;
  select raw_app_meta_data into target_meta from auth.users where id=p_target and deleted_at is null and (banned_until is null or banned_until<now());
  if target_meta is null or coalesce(target_meta->>'role','') not in ('CRO','CRO Manager','SOM','SFSO','FSO','Client') then raise exception 'That portal user is unavailable';end if;
  perform pg_advisory_xact_lock(hashtextextended(least(uid::text,p_target::text),91));
  perform pg_advisory_xact_lock(hashtextextended(greatest(uid::text,p_target::text),91));
  update public.workspace_direct_calls set status='ended' where status<>'ended'
   and (caller_id in (uid,p_target) or callee_id in (uid,p_target))
   and (expires_at<=now() or caller_seen_at<=now()-interval '35 seconds' or (status='ringing' and ring_until<=now()));
  if exists(select 1 from public.workspace_direct_calls where status<>'ended' and (caller_id in (uid,p_target) or callee_id in (uid,p_target))) then raise exception 'One of these users is already on a call';end if;
  insert into public.workspace_direct_calls(caller_id,callee_id,caller_name,callee_name)
   values(uid,p_target,coalesce(nullif(m->>'display_name',''),nullif(m->>'officer_name',''),m->>'role','Portal user'),coalesce(nullif(target_meta->>'display_name',''),nullif(target_meta->>'officer_name',''),target_meta->>'role','Portal user')) returning * into c;
  return to_jsonb(c)||jsonb_build_object('is_caller',true);
 end if;
 select * into strict c from public.workspace_direct_calls where id=p_id for update;
 if uid not in (c.caller_id,c.callee_id) then raise exception 'You are not a participant in this call';end if;
 if p_action='end' then update public.workspace_direct_calls set status='ended' where id=c.id;return '{}'::jsonb;end if;
 if p_action='heartbeat' and c.caller_id=uid then
  if c.expires_at<=now() or (c.status='ringing' and c.ring_until<=now()) then update public.workspace_direct_calls set status='ended' where id=c.id;
  elsif c.status<>'ended' then update public.workspace_direct_calls set caller_seen_at=now() where id=c.id;end if;
  return '{}'::jsonb;
 end if;
 if c.status='ended' or c.expires_at<=now() or c.caller_seen_at<=now()-interval '35 seconds' then raise exception 'This call has ended';end if;
 if p_action='answer' and c.callee_id=uid then
  if c.ring_until<=now() then raise exception 'This call is no longer ringing';end if;
  update public.workspace_direct_calls set status='active' where id=c.id;
 elsif p_action='decline' and c.callee_id=uid then
  update public.workspace_direct_calls set status='ended' where id=c.id;
 else raise exception 'Invalid call action';end if;
 return '{}'::jsonb;
end; $$;

revoke all on function public.workspace_call_directory(),public.workspace_direct_call_state(),public.workspace_direct_call_action(text,uuid,uuid) from public,anon;
grant execute on function public.workspace_call_directory(),public.workspace_direct_call_state(),public.workspace_direct_call_action(text,uuid,uuid) to authenticated;
do $publication$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='workspace_direct_calls') then
  alter publication supabase_realtime add table public.workspace_direct_calls;
 end if;
 if to_regclass('realtime.messages') is not null then
  execute 'drop policy if exists desk_direct_call_read on realtime.messages';
  execute 'drop policy if exists desk_direct_call_send on realtime.messages';
  execute $policy$create policy desk_direct_call_read on realtime.messages for select to authenticated using (
   realtime.topic() ~ '^direct-call:[0-9a-f-]{36}$' and exists(
    select 1 from public.workspace_direct_calls c where c.id=split_part(realtime.topic(),':',2)::uuid and c.status<>'ended' and auth.uid() in (c.caller_id,c.callee_id)
   )
  )$policy$;
  execute $policy$create policy desk_direct_call_send on realtime.messages for insert to authenticated with check (
   realtime.topic() ~ '^direct-call:[0-9a-f-]{36}$' and exists(
    select 1 from public.workspace_direct_calls c where c.id=split_part(realtime.topic(),':',2)::uuid and c.status<>'ended' and auth.uid() in (c.caller_id,c.callee_id)
   )
  )$policy$;
 end if;
end; $publication$;
notify pgrst,'reload schema';
commit;
