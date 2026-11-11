begin;

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

drop policy if exists workflow_events_read on public.case_workflow_events;
create policy workflow_events_read on public.case_workflow_events for select to authenticated using (
 (source_sha256,source_sheet,source_row) in (select * from public.desk_readable_case_keys())
 and (action<>'note' or coalesce(auth.jwt()->'app_metadata'->>'role','') in ('CRO','CRO Manager'))
);

create or replace function public.restrict_internal_note_event() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.action='note' and coalesce(auth.jwt()->'app_metadata'->>'role','') not in ('CRO','CRO Manager') then
  raise exception 'Internal case notes are restricted to CRO and CRO Manager';
 end if;
 return new;
end; $$;
drop trigger if exists restrict_internal_note_event on public.case_workflow_events;
create trigger restrict_internal_note_event before insert on public.case_workflow_events
 for each row execute function public.restrict_internal_note_event();
revoke all on function public.restrict_internal_note_event() from public,anon,authenticated;

commit;