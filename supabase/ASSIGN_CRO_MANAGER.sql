-- Supabase query name: Assign CRO Manager Account
-- Assigns only this existing account; preserves other app metadata.
begin;
do $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'CRO Manager')
  where id = '1cb92364-1168-44be-b548-0323ad6da96c'::uuid;
  if not found then
    raise exception 'Account UID not found. No account was changed.';
  end if;
end;
$$;
select id, raw_app_meta_data->>'role' as assigned_role
from auth.users
where id = '1cb92364-1168-44be-b548-0323ad6da96c'::uuid;
commit;
