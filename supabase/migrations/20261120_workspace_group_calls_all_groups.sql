-- Enable one group call per authorized city or company chat, including Client accounts.
begin;

create or replace function public.workspace_call_action(p_action text,p_group text default null,p_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.workspace_calls%rowtype; uid uuid:=auth.uid(); m jsonb:=auth.jwt()->'app_metadata';
begin
 if uid is null then raise exception 'Sign in required';end if;
 if p_action='start' then
  if p_group !~ '^group:(city|company):[^:]+$' or not coalesce(public.workspace_group_access(p_group),false) then raise exception 'Call outside your accessible chat group';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_group,12));
  update public.workspace_calls set status='ended' where group_key=p_group and status<>'ended'
   and (expires_at<=now() or caller_seen_at<=now()-interval '35 seconds' or (status='ringing' and ring_until<=now()));
  if exists(select 1 from public.workspace_calls where group_key=p_group and status<>'ended') then raise exception 'A group call is already in progress in this chat';end if;
  insert into public.workspace_calls(group_key,caller_id,caller_name) values(p_group,uid,coalesce(m->>'display_name',m->>'officer_name',m->>'role','Staff')) returning * into c;
  insert into public.workspace_call_responses values(c.id,uid,'accepted');
  return to_jsonb(c)||jsonb_build_object('is_caller',true,'my_response','accepted');
 end if;
 select * into strict c from public.workspace_calls where id=p_id for update;
 if not coalesce(public.workspace_group_access(c.group_key),false) then raise exception 'Call outside your accessible chat group';end if;
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

revoke all on function public.workspace_call_action(text,text,uuid) from public,anon;
grant execute on function public.workspace_call_action(text,text,uuid) to authenticated;

do $setup$ begin
 if to_regclass('realtime.messages') is not null then
  execute 'drop policy if exists desk_group_call_read on realtime.messages';
  execute 'drop policy if exists desk_group_call_send on realtime.messages';
  execute $policy$create policy desk_group_call_read on realtime.messages for select to authenticated using (
   realtime.topic() ~ '^call:group:(city|company):[^:]+:(?:[0-9a-f-]{36}|lobby|active)$' and
   public.workspace_group_access(split_part(realtime.topic(),':',2)||':'||split_part(realtime.topic(),':',3)||':'||split_part(realtime.topic(),':',4))
  )$policy$;
  execute $policy$create policy desk_group_call_send on realtime.messages for insert to authenticated with check (
   realtime.topic() ~ '^call:group:(city|company):[^:]+:(?:[0-9a-f-]{36}|lobby|active)$' and
   public.workspace_group_access(split_part(realtime.topic(),':',2)||':'||split_part(realtime.topic(),':',3)||':'||split_part(realtime.topic(),':',4))
  )$policy$;
 end if;
end; $setup$;

notify pgrst,'reload schema';
commit;
