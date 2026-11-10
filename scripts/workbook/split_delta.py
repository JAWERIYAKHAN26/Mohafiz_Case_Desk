"""Stage small SQL Editor uploads, then apply the original delta atomically.

No live connection. Case data changes only when APPLY_STAGED_IMPORT.sql is run.
"""
import hashlib
import json
from pathlib import Path
from build_delta import ROOT, REVISION, SHA, sql_json


def build():
    payload = json.loads((ROOT / 'delta-payload.json').read_text(encoding='utf-8'))
    text = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    checksum = hashlib.sha256(text.encode('utf-8')).hexdigest()
    # Split on Unicode characters; every upload is comfortably below the failed query size.
    chunks, current, size = [], [], 0
    for char in text:
        length = len(char.encode('utf-8'))
        if size + length > 160_000:
            chunks.append(''.join(current));current=[];size=0
        current.append(char);size+=length
    if current:
        chunks.append(''.join(current))
    folder = ROOT / ('sql-editor-parts-' + checksum[:12])
    folder.mkdir(exist_ok=True)
    files = []
    setup = '''create table if not exists public.workbook_revision_uploads(
 revision text not null,part integer not null,chunk text not null,
 primary key(revision,part));
alter table public.workbook_revision_uploads enable row level security;
revoke all on public.workbook_revision_uploads from public,anon,authenticated;
'''
    for index, chunk in enumerate(chunks, 1):
        # Convert a JSON string back to text without changing quotes, escapes or newlines.
        value = '(' + sql_json(chunk) + " #>> '{}')"
        sql = ('-- Upload only: does not import or change cases. Safe to rerun.\nbegin;\n' + setup +
               f"insert into public.workbook_revision_uploads values('{REVISION}',{index},{value}) " +
               'on conflict(revision,part) do update set chunk=excluded.chunk;\ncommit;\n')
        path = folder / f'UPLOAD_{index:02d}_OF_{len(chunks):02d}.sql'
        path.write_text(sql, encoding='utf-8');files.append(path.name)
    verification = f'''do $check$ declare full_text text; n integer;begin
 select string_agg(chunk,'' order by part),count(*) into full_text,n
 from public.workbook_revision_uploads where revision='{REVISION}';
 if n<>{len(chunks)} or encode(sha256(convert_to(coalesce(full_text,''),'UTF8')),'hex')<>'{checksum}' then
  raise exception 'Upload is incomplete or changed. Run all {len(chunks)} UPLOAD files first. No cases imported.';
 end if;end;$check$;
'''
    expression = f"(select string_agg(chunk,'' order by part)::jsonb from public.workbook_revision_uploads where revision='{REVISION}')"
    sql = Path('scripts/workbook/delta_transaction.sql').read_text(encoding='utf-8')
    sql = sql.replace('__PAYLOAD__', expression).replace('__REVISION__', REVISION).replace('__SHA__', SHA)
    sql = sql.replace('do $import$', verification + '\ndo $import$', 1)
    (folder / 'APPLY_STAGED_IMPORT.sql').write_text(sql, encoding='utf-8')
    files.append('APPLY_STAGED_IMPORT.sql')
    manifest = {'folder': str(folder), 'revision': REVISION, 'payload_sha256': checksum,
                'upload_parts': len(chunks), 'files': files,
                'largest_sql_bytes': max((folder / name).stat().st_size for name in files)}
    (ROOT / 'sql-editor-parts.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    (folder / 'START_HERE.txt').write_text(
        'Run UPLOAD files in numeric order in Supabase SQL Editor. These only stage text.\n'
        'Then run APPLY_STAGED_IMPORT.sql once. It verifies the complete checksum and imports in one transaction.\n'
        'If an upload fails, rerun that file. All files are rerunnable.\n'
        'Then run ../VERIFY_AFTER_IMPORT.sql. Do not rerun backend setup if already installed.\n', encoding='utf-8')
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    build()
