import {createClient} from '@supabase/supabase-js';
const client=createClient(process.env.ARCHIVE_SUPABASE_URL,process.env.ARCHIVE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
for(const table of ['case_workflow','workspace_messages']){
 const result=await client.from(table).select('*',{head:true,count:'exact'}).limit(1);
 console.log(JSON.stringify({table,count:result.count,error:result.error?{code:result.error.code,message:result.error.message}:null}));
}
const joined=await client.from('workbook_import_cases').select('source_row,case_workflow(stage)').limit(1);
console.log(JSON.stringify({relationship_error:joined.error?{code:joined.error.code,message:joined.error.message}:null}));
