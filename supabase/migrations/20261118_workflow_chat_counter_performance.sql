-- Keep workflow counters and sidebar unread totals scoped to the caller's allowed chats.
begin;

create index if not exists workspace_messages_unread_lookup
 on public.workspace_messages(group_key,created_at,sender_id);

create or replace function public.workspace_accessible_chat_groups()
returns table(group_key text)
language sql stable security definer set search_path='' as $$
 with claims as materialized (
  select auth.jwt()->'app_metadata' as metadata
 ), candidates as materialized (
  select unnest(case
   when metadata->>'role' in ('CRO','CRO Manager') then array[
    'group:city:Islamabad','group:city:Karachi','group:city:Lahore',
    'group:company:PostEx','group:company:Daraz','group:company:Buscaro']::text[]
   when metadata->>'role' in ('SFSO','SOM') then array[
    'group:city:'||case when metadata->>'city'='Rawalpindi' then 'Islamabad' else coalesce(metadata->>'city','') end,
    'group:company:PostEx','group:company:Daraz','group:company:Buscaro']::text[]
   when metadata->>'role'='FSO' then array[
    'group:city:'||case when metadata->>'city'='Rawalpindi' then 'Islamabad' else coalesce(metadata->>'city','') end]::text[]
   when metadata->>'role'='Client' and nullif(metadata->>'company','') is not null then
    array['group:company:'||(metadata->>'company')]::text[]
   else array[]::text[] end) as group_key
  from claims
 )
 select c.group_key from candidates c
 where auth.uid() is not null and public.workspace_group_access(c.group_key);
$$;
revoke all on function public.workspace_accessible_chat_groups() from public,anon,authenticated;

create or replace function public.workspace_unread_count() returns bigint
language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
 if auth.uid() is null then return 0; end if;
 select count(*) into result
 from public.workspace_accessible_chat_groups() g
 join public.workspace_messages m on m.group_key=g.group_key
 left join public.workspace_read_cursors r on r.user_id=auth.uid() and r.group_key=m.group_key
 where m.sender_id<>auth.uid() and m.created_at>coalesce(r.read_at,'-infinity'::timestamptz);
 return result;
end; $$;
revoke all on function public.workspace_unread_count() from public,anon;
grant execute on function public.workspace_unread_count() to authenticated;

create or replace function public.workspace_unread_groups() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select coalesce(jsonb_object_agg(group_key,n),'{}'::jsonb) into result from (
  select m.group_key,count(*) as n
  from public.workspace_accessible_chat_groups() g
  join public.workspace_messages m on m.group_key=g.group_key
  left join public.workspace_read_cursors r on r.user_id=auth.uid() and r.group_key=m.group_key
  where m.sender_id<>auth.uid() and m.created_at>coalesce(r.read_at,'-infinity'::timestamptz)
  group by m.group_key
 ) unread;
 return result;
end; $$;
revoke all on function public.workspace_unread_groups() from public,anon;
grant execute on function public.workspace_unread_groups() to authenticated;

analyze public.workspace_messages;
notify pgrst,'reload schema';
commit;
