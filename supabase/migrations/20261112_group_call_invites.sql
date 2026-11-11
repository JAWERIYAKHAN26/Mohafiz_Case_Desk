begin;
do $setup$ begin
 if to_regclass('realtime.messages') is not null then
  execute 'drop policy if exists desk_group_call_read on realtime.messages';
  execute 'drop policy if exists desk_group_call_send on realtime.messages';
  execute $policy$create policy desk_group_call_read on realtime.messages for select to authenticated using (
   realtime.topic() ~ '^call:group:city:[^:]+:(?:[0-9a-f-]{36}|lobby|active)$' and
   public.workspace_group_access(split_part(realtime.topic(),':',2)||':'||split_part(realtime.topic(),':',3)||':'||split_part(realtime.topic(),':',4))
  )$policy$;
  execute $policy$create policy desk_group_call_send on realtime.messages for insert to authenticated with check (
   realtime.topic() ~ '^call:group:city:[^:]+:(?:[0-9a-f-]{36}|lobby|active)$' and
   public.workspace_group_access(split_part(realtime.topic(),':',2)||':'||split_part(realtime.topic(),':',3)||':'||split_part(realtime.topic(),':',4))
  )$policy$;
 end if;
end; $setup$;
commit;