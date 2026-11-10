import {createClient} from '@supabase/supabase-js';
const c=createClient(process.env.ARCHIVE_SUPABASE_URL,process.env.ARCHIVE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const sha='1be36f4fe2c0daf28c1a3b5b02432d7d7a30fdf211a456e9c3d3e412861f48b3';
for(const kind of ['all','snapshot','closed','pending','blank']){
 let q=c.from('workbook_import_cases').select('source_row',{head:true,count:'exact'});
 if(kind!=='all')q=q.eq('source_sha256',sha);
 if(kind==='closed')q=q.eq('status','Closed');
 if(kind==='pending')q=q.eq('status','Pending');
 if(kind==='blank')q=q.or('status.is.null,status.eq.');
 const r=await q;console.log(JSON.stringify({kind,count:r.count,error:r.error?.code||null}));
}
