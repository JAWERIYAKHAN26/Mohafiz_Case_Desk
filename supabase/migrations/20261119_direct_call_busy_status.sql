-- Make direct-call busy responses clear for both callers and selected recipients.
begin;

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
  if exists(select 1 from public.workspace_direct_calls where status<>'ended' and (caller_id=uid or callee_id=uid)) then
   raise exception 'You are already on another call';
  end if;
  if exists(select 1 from public.workspace_direct_calls where status<>'ended' and (caller_id=p_target or callee_id=p_target)) then
   raise exception 'This person is already on another call';
  end if;
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

revoke all on function public.workspace_direct_call_action(text,uuid,uuid) from public,anon;
grant execute on function public.workspace_direct_call_action(text,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
