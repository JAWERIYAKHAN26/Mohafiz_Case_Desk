// Read-only diagnostic. Passwords/tokens are never printed.
import {createClient} from '@supabase/supabase-js';
import {readFile} from 'node:fs/promises';
const journal=JSON.parse(await readFile(new URL('../../outputs/test-accounts/real-test-logins.json',import.meta.url),'utf8'));
const account=journal.accounts.find(item=>item.role==='FSO'&&item.state==='created');
if(!account)throw new Error('No provisioned FSO account found.');
const client=createClient(process.env.ARCHIVE_SUPABASE_URL,process.env.ARCHIVE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await client.auth.signInWithPassword({email:account.email,password:account.password});
if(login.error)throw new Error('FSO login failed: '+login.error.message);
// Use the signed-in FSO token, not the backend credential, for every diagnostic request.

const sha='1be36f4fe2c0daf28c1a3b5b02432d7d7a30fdf211a456e9c3d3e412861f48b3';
for(const scoped of [false,true]){
 let q=client.from('workbook_import_cases').select('source_sha256,source_sheet,source_row,case_id',{count:'exact'}).eq('source_sha256',sha);
 if(scoped)q=q.eq('assigned_fso',account.officer_name).eq('city',account.city);
 const start=Date.now();
 const result=await q.order('reported_date_iso',{ascending:false,nullsFirst:false}).order('source_sheet').order('source_row',{ascending:false}).range(0,49);
 console.log(JSON.stringify({scoped,milliseconds:Date.now()-start,count:result.count,error:result.error?{code:result.error.code,message:result.error.message}:null}));
}
await client.auth.signOut();
