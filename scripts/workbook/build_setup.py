"""Package existing backend migrations and workbook calculations for SQL Editor.

Does not connect to Supabase. Run from the repository root.
"""
import re
from pathlib import Path


def body(name):
    sql = Path('supabase/migrations', name).read_text(encoding='utf-8')
    sql = re.sub(r'^\s*(begin;|commit;|notify pgrst[^\n]*;)\s*$', '', sql, flags=re.M | re.I)
    sql = re.sub(r'\bcreate function\b', 'create or replace function', sql, flags=re.I)
    # A repair bundle must also tolerate previously installed storage policies.
    sql = re.sub(r'(?im)^(create policy ("[^"]+"|\w+) on ([\w.]+))',
                 lambda match: 'drop policy if exists ' + match[2] + ' on ' + match[3] + ';\n' + match[1], sql)
    return sql


def guarded(condition, name):
    sql = body(name)
    assert '$migration$' not in sql
    return f"do $setup$ begin if {condition} then execute $migration${sql}$migration$;end if;end;$setup$;\n"


def build():
    sql = '''-- Backend repair and standard Excel calculations. No cases are deleted.
-- Review catalog first. Run in Supabase SQL Editor as project administrator.
begin;
select pg_advisory_xact_lock(20261106,2);
do $preflight$ begin
 if to_regclass('public.case_workflow') is null or to_regclass('public.workbook_import_cases') is null
 or to_regprocedure('public.workspace_group_access(text)') is null then
 raise exception 'Base workbook/read-access/workflow migrations must be installed first';end if;
end;$preflight$;
'''
    sql += guarded("to_regclass('public.case_field_reports') is null", '20261103_field_evidence.sql')
    sql += body('20261104_portal_parity.sql')
    sql += body('20261104_portal_parity_client_only.sql')
    sql += body('20261104_portal_workspace_details.sql')
    sql += body('20261106_workbook_calculations.sql')
    sql += body('20261110_workflow_query_performance.sql')
    sql += body('20261111_field_chat_updates.sql')
    sql += body('20261112_group_call_invites.sql')
    sql += body('20261112_incoming_group_calls.sql')
    sql += body('20261117_direct_voice_calls.sql')
    sql += body('20261118_workflow_chat_counter_performance.sql')
    sql += body('20261119_direct_call_busy_status.sql')
    sql += "\nnotify pgrst,'reload schema';\ncommit;\n"
    out = Path('outputs/current-workbook-audit/INSTALL_WORKBOOK_BACKEND.sql')
    out.write_text(sql, encoding='utf-8')
    print(str(out))


if __name__ == '__main__':
    build()
