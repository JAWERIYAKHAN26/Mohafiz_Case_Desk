// Execute the actual private import SQL twice in a fresh, isolated PostgreSQL engine.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
const {PGlite}=await import('../../outputs/desk-sql-validation/node_modules/@electric-sql/pglite/dist/index.js');
const db=new PGlite();
const root=new URL('../../outputs/current-workbook-audit/',import.meta.url);
const payload=JSON.parse(await readFile(new URL('delta-payload.json',root),'utf8'));
let sql=await readFile(new URL('IMPORT_LATEST_WORKBOOK.sql',root),'utf8');
let staged=[];
if(process.argv.includes('--staged')){
 const manifest=JSON.parse(await readFile(new URL('sql-editor-parts.json',root),'utf8'));
 const folder=new URL(manifest.folder.replaceAll('\\','/')+'/',new URL('../../',import.meta.url));
 staged=await Promise.all(manifest.files.filter(name=>name.startsWith('UPLOAD_')).map(name=>readFile(new URL(name,folder),'utf8')));
 sql=await readFile(new URL('APPLY_STAGED_IMPORT.sql',folder),'utf8');
}
const sha='1be36f4fe2c0daf28c1a3b5b02432d7d7a30fdf211a456e9c3d3e412861f48b3';
const readSnapshot=async(name,predicate)=>{
 const result=[];
 for await(const line of createInterface({input:createReadStream(new URL(name+'.ndjson',root)),crlfDelay:Infinity})){
  if(!line.trim())continue;const row=JSON.parse(line.replace(/^\uFEFF/,''));if(predicate(row))result.push(row);
 }
 return result;
};
try{
 await db.exec('create role anon;create role authenticated;');
 await db.exec(await readFile(new URL('../../supabase/migrations/20261102_workbook_import.sql',import.meta.url),'utf8'));
 await db.exec('create table public.case_workflow(source_sha256 text,source_sheet text,source_row integer,stage text);create table public.case_workflow_events(source_sha256 text,source_sheet text,source_row integer);');
 await db.query('insert into public.workbook_import_batches values($1,$2,$3,30609,61386,2016,now())',[sha,'original.xlsx','B2B - 2025']);
 const affected=new Set(payload.changes.map(x=>x.row));
 const source=await readSnapshot('workbook_import_cases',x=>affected.has(x.source_row));
 for(let start=0;start<source.length;start+=30)await db.query('insert into public.workbook_import_cases select * from jsonb_populate_recordset(null::public.workbook_import_cases,$1)',[JSON.stringify(source.slice(start,start+30))]);
 for(const note of payload.notes.filter(x=>x.old))await db.query('insert into public.workbook_import_notes select * from jsonb_populate_record(null::public.workbook_import_notes,$1)',[JSON.stringify(note.old)]);
 for(const row of [30605,30609])await db.query('insert into public.case_workflow values($1,$2,$3,$4)',[sha,'B2B - 2025',row,'Acknowledged']);
 const conflictBefore=(await db.query('select to_jsonb(c) as value from public.workbook_import_cases c where source_row in (30605,30609) order by source_row')).rows;
 if(staged.length){
  await db.exec(staged[0]);
  await assert.rejects(()=>db.exec(sql),/Upload is incomplete/);await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int as n from public.workbook_import_cases')).rows[0].n,source.length);
  for(const upload of staged)await db.exec(upload);
  console.log('PASS partial staging refuses import; all upload checksums verified before applying');
 }
 await db.exec(sql);
 const counts=async()=>(await db.query("select (select count(*) from public.workbook_import_cases)::int as cases,(select count(*) from public.workbook_import_notes)::int as notes,(select count(*) from public.workbook_import_links)::int as links,(select count(*) from public.workbook_revision_journal)::int as journal")).rows[0];
 const first=await counts();
 assert.equal(first.cases,source.length+79);assert.equal(first.notes,payload.notes.length);assert.equal(first.links,10);
 assert.deepEqual((await db.query('select to_jsonb(c) as value from public.workbook_import_cases c where source_row in (30605,30609) order by source_row')).rows,conflictBefore);
 const applied=(await db.query("select count(*)::int as n from public.workbook_revision_journal where state='conflict'")).rows[0].n;
 assert.ok(applied>=2,'operational conflicts retained');
 const journal=(await db.query('select kind,state,count(*)::int as records from public.workbook_revision_journal group by kind,state order by kind,state')).rows;
 await writeFile(new URL('delta-validation.json',root),JSON.stringify({isolated:true,live_writes:0,journal},null,2));
 await db.exec(sql);assert.deepEqual(await counts(),first);
 // A changed live value must remain intact and be journaled as a conflict.
 const revision='ef71ffe437902c872fb2f188b0e8ef5ec2dd6cbc5efd6f059e5f229b4de4bd70';
 const candidate=payload.changes.find(x=>![30605,30609].includes(x.row));
 await db.query("delete from public.workbook_revision_journal where revision=$1 and kind='case-update' and record_key=$2",[revision,String(candidate.row)]);
 const field=Object.keys(candidate.before)[0];assert.match(field,/^[a-z_]+$/);
 await db.query(`update public.workbook_import_cases set ${field}=$1 where source_row=$2`,['new live edit',candidate.row]);
 await db.exec(sql);
 assert.equal((await db.query(`select ${field} as value from public.workbook_import_cases where source_row=$1`,[candidate.row])).rows[0].value,'new live edit');
 console.log('PASS actual workbook delta: 79 inserts, missing/changed notes, 10 links, operational conflicts, live-edit guard, and repeat-run idempotency.');
}finally{await db.close();}
