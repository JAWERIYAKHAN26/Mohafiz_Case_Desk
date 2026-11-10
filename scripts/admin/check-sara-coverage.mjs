import {createClient} from '@supabase/supabase-js';
const c=createClient(process.env.ARCHIVE_SUPABASE_URL,process.env.ARCHIVE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
for(const spelling of ['Sara Ahmed','Sara Ahmad']){
 const r=await c.from('workbook_import_cases').select('source_row',{count:'exact',head:true}).eq('assigned_fso',spelling).eq('city','Islamabad');
 console.log(JSON.stringify({officer:spelling,city:'Islamabad',cases:r.count,error:r.error?.code||null}));
}
const r=await c.from('workbook_import_cases').select('assigned_fso,city').ilike('assigned_fso','%sara%').limit(100);
const combinations=[...new Set((r.data||[]).map(row=>JSON.stringify(row)))].map(row=>JSON.parse(row));
console.log(JSON.stringify({similar_assignments:combinations,error:r.error?.code||null,limited_to:100}));
