-- Supabase query name: Test Realtime Chat Permissions
-- Run after Connect Workflow And Realtime Chat. All test messages roll back.
begin;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000123","role":"authenticated","app_metadata":{"role":"CRO","display_name":"Permission test"}}',true);
set local role authenticated;
do $$
declare test_id uuid:=gen_random_uuid();
begin
 if not public.workspace_group_access('group:city:Islamabad') then raise exception 'CRO group access failed'; end if;
 insert into public.workspace_messages(id,group_key,body) values(test_id,'group:city:Islamabad','Permission check - rolled back');
 if not exists(select 1 from public.workspace_messages where id=test_id and sender_id=auth.uid() and sender_role='CRO') then raise exception 'Server sender identity test failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000124","role":"authenticated","app_metadata":{"role":"Client","company":"PostEx"}}',true);
set local role authenticated;
do $$ begin
 if public.workspace_group_access('group:city:Islamabad') or public.workspace_group_access('group:company:Daraz') then raise exception 'Client isolation failed'; end if;
 if not public.workspace_group_access('group:company:PostEx') then raise exception 'Client company access failed'; end if;
 begin
  insert into public.workspace_messages(id,group_key,body) values(gen_random_uuid(),'group:city:Islamabad','Forbidden test');
  raise exception 'Unauthorized insert was accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
select 'Chat permission checks passed; all test messages rolled back' as result;
