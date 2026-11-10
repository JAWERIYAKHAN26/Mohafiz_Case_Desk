// Backend-only. Never import this script into Vite/frontend code.
import { createClient } from '@supabase/supabase-js';
import { digest, spreadsheet, storeAndVerify } from './core.mjs';
const commit=process.argv.includes('--commit');
const url=process.env.ARCHIVE_SUPABASE_URL;
const secret=process.env.ARCHIVE_SERVICE_ROLE_KEY;
if(!url||!secret)throw new Error('Set ARCHIVE_SUPABASE_URL and ARCHIVE_SERVICE_ROLE_KEY in private .env.archive.local.');
const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket=client.storage.from('case-archives');
async function rpc(name,args){const result=await client.rpc(name,args);if(result.error)throw new Error(`${name}: ${result.error.message}`);return result.data;}
async function preview(){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const cutoff=new Date(today+'T00:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()-10);
 const date=cutoff.toISOString().slice(0,10);
 const result=await client.from('workbook_import_cases').select('source_row',{count:'exact',head:true}).eq('status','Closed').lt('closure_date_iso',date);
 if(result.error)throw new Error(result.error.message);
 console.log(JSON.stringify({mode:'preview',retention_days:10,closure_before:date,candidate_cases:result.count,note:'Unmapped hyperlink ranges are excluded by the archive job. No uploads or deletion in preview.'}));
}
async function archive(){
 let cases=0,batches=0;
 for(;;){
  const batch=await rpc('prepare_case_archive',{});
  if(batch.done)break;
  const raw=Buffer.from(batch.payload,'utf8');
  if(digest(raw)!==batch.sha256)throw new Error('Database snapshot checksum mismatch.');
  const snapshot=JSON.parse(batch.payload);
  if(snapshot.cases.length!==batch.case_count)throw new Error('Snapshot case count mismatch.');
  const receipts=[];
  // Copy field-report media before deleting report records. External workbook links remain references.
  const paths=[...new Set(snapshot.field_reports.flatMap(report=>(report.attachments||[]).map(item=>item.path)))];
  for(let index=0;index<paths.length;index++){
    const path=paths[index];
    if(typeof path!=='string'||!path)throw new Error('Invalid evidence reference; no deletion.');
    const result=await client.storage.from('field-evidence').download(path);
    if(result.error)throw new Error('Could not archive field evidence; no deletion.');
    const bytes=Buffer.from(await result.data.arrayBuffer());
    receipts.push({...await storeAndVerify(bucket,`${batch.prefix}/media/${index}`,bytes,result.data.type||'application/octet-stream'),original_bucket:'field-evidence',original_path:path});
  }
  receipts.push(await storeAndVerify(bucket,`${batch.prefix}/snapshot.json`,raw,'application/json'));
  receipts.push(await storeAndVerify(bucket,`${batch.prefix}/cases.xml`,spreadsheet(snapshot),'application/xml'));
  const manifest=Buffer.from(JSON.stringify({version:1,batch_id:batch.id,retention_days:10,case_count:batch.case_count,files:receipts},null,2),'utf8');
  receipts.push(await storeAndVerify(bucket,`${batch.prefix}/manifest.json`,manifest,'application/json'));
  const removed=await rpc('finish_case_archive',{p_id:batch.id,p_sha256:batch.sha256,p_files:receipts});
  cases+=removed;batches++;
  console.log(JSON.stringify({batch_id:batch.id,verified_and_removed:removed,total_removed:cases}));
 }
 console.log(JSON.stringify({complete:true,batches,cases,retention_days:10}));
}
try{await(commit?archive():preview());}catch(error){console.error(error.message);process.exitCode=1;}
