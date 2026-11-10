-- Apply after 20261111_field_chat_updates.sql. Calls are separate from chat messages.
begin;
create table if not exists public.workspace_calls(
 id uuid primary key default gen_random_uuid(), group_key text not null,
 caller_id uuid not null, caller_name text not null,
 status text not null default 'ringing' check(status in ('ringing','active','ended')),
 created_at timestamptz not null default now(), ring_until timestamptz not null default now()+interval '45 seconds',
 expires_at timestamptz not null default now()+interval '4 hours', caller_seen_at timestamptz not null default now()
);
create index if not exists workspace_calls_live on public.workspace_calls(group_key,created_at desc) where status<>'ended';
create table if not exists public.workspace_call_responses(
 call_id uuid not null references public.workspace_calls(id) on delete cascade,
 user_id uuid not null, response text not null check(response in ('accepted','declined')),
 primary key(call_id,user_id)
);
alter table public.workspace_calls enable row level security;
alter table public.workspace_call_responses enable row level security;
revoke all on public.workspace_calls,public.workspace_call_responses from public,anon,authenticated;
grant select on public.workspace_calls,public.workspace_call_responses to authenticated;
drop policy if exists calls_read on public.workspace_calls;
create policy calls_read on public.workspace_calls for select to authenticated using(public.workspace_group_access(group_key));
drop policy if exists call_responses_read on public.workspace_call_responses;
create policy call_responses_read on public.workspace_call_responses for select to authenticated using(
 user_id=auth.uid() and exists(select 1 from public.workspace_calls c where c.id=call_id));
create or replace function public.workspace_call_state() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('is_caller',c.caller_id=auth.uid(),'my_response',r.response) order by c.created_at desc),'[]'::jsonb)
 from public.workspace_calls c left join public.workspace_call_responses r on r.call_id=c.id and r.user_id=auth.uid()
 where c.status<>'ended' and c.expires_at>now() and c.caller_seen_at>now()-interval '35 seconds'
 and (c.status='active' or c.ring_until>now()) and (c.caller_id=auth.uid() or r.response='accepted' or c.ring_until>now());
$$;
create or replace function public.workspace_call_action(p_action text,p_group text default null,p_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.workspace_calls%rowtype; uid uuid:=auth.uid(); m jsonb:=auth.jwt()->'app_metadata';
begin
 if uid is null then raise exception 'Sign in required';end if;
 if p_action='start' then
  if p_group not like 'group:city:%' or not coalesce(public.workspace_group_access(p_group),false) then raise exception 'Call outside your internal group';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_group,12));
  update public.workspace_calls set status='ended' where group_key=p_group and status<>'ended'
   and (expires_at<=now() or caller_seen_at<=now()-interval '35 seconds' or (status='ringing' and ring_until<=now()));
  if exists(select 1 from public.workspace_calls where group_key=p_group and status<>'ended') then raise exception 'A call is already in progress in this group';end if;
  insert into public.workspace_calls(group_key,caller_id,caller_name) values(p_group,uid,coalesce(m->>'display_name',m->>'officer_name',m->>'role','Staff')) returning * into c;
  insert into public.workspace_call_responses values(c.id,uid,'accepted');
  return to_jsonb(c)||jsonb_build_object('is_caller',true,'my_response','accepted');
 end if;
 select * into strict c from public.workspace_calls where id=p_id for update;
 if not coalesce(public.workspace_group_access(c.group_key),false) then raise exception 'Call outside your internal group';end if;
 if p_action='end' and c.caller_id=uid then update public.workspace_calls set status='ended' where id=c.id;return '{}'::jsonb;end if;
 if p_action='heartbeat' and c.caller_id=uid then
  if c.expires_at<=now() or (c.status='ringing' and c.ring_until<=now()) then update public.workspace_calls set status='ended' where id=c.id;
  elsif c.status<>'ended' then update public.workspace_calls set caller_seen_at=now() where id=c.id;end if;
  return '{}'::jsonb;
 end if;
 if c.status='ended' or c.expires_at<=now() or c.caller_seen_at<=now()-interval '35 seconds' then raise exception 'This call has ended';end if;
 if p_action='answer' then
  if c.ring_until<=now() then raise exception 'This call is no longer ringing';end if;
  insert into public.workspace_call_responses values(c.id,uid,'accepted') on conflict(call_id,user_id) do update set response='accepted';
  update public.workspace_calls set status='active' where id=c.id;
 elsif p_action='decline' then
  insert into public.workspace_call_responses values(c.id,uid,'declined') on conflict(call_id,user_id) do update set response='declined';
 else raise exception 'Invalid call action';end if;
 return '{}'::jsonb;
end; $$;
revoke all on function public.workspace_call_state(),public.workspace_call_action(text,text,uuid) from public,anon;
grant execute on function public.workspace_call_state(),public.workspace_call_action(text,text,uuid) to authenticated;
do $publication$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='workspace_calls') then
 alter publication supabase_realtime add table public.workspace_calls;
 end if;
end; $publication$;
notify pgrst,'reload schema';
commit;
