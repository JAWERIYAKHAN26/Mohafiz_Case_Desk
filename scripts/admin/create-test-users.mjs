// Backend-only Supabase Admin API. Creates test users; never modifies existing accounts.
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const roster=JSON.parse(await readFile(new URL('./test-roster.json',import.meta.url),'utf8'));
if(!process.argv.includes('--create')) {
 console.table(roster.map(({email,role,city,company,officer_name})=>({email,role,coverage:city||company||'All cases',officer:officer_name||''})));
 console.log(`${roster.length} planned accounts. No remote changes. Use --create with backend credentials to create them.`);
 process.exit(0);
}
const url=process.env.ARCHIVE_SUPABASE_URL;
const secret=process.env.ARCHIVE_SERVICE_ROLE_KEY;
if(!url||!secret)throw new Error('Add backend URL/key to private .env.archive.local first. Never share the secret key.');
if(secret.startsWith('sb_publishable_'))throw new Error('ARCHIVE_SERVICE_ROLE_KEY contains a publishable key. Replace it with a backend sb_secret_ key or legacy service_role key from Supabase Settings > API Keys.');
const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const folder=new URL('../../outputs/test-accounts/',import.meta.url);
await mkdir(folder,{recursive:true});
const journalFile=new URL('real-test-logins.json',folder);
let journal;
try{journal=JSON.parse(await readFile(journalFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;journal={run_id:randomUUID(),accounts:roster.map(item=>({...item,password:randomBytes(24).toString('base64url')+'aA7!',state:'planned'}))};await writeFile(journalFile,JSON.stringify(journal,null,2),{flag:'wx',mode:0o600});}
// Password journal is written before requests so an interrupted successful creation remains recoverable.
async function save(){await writeFile(journalFile,JSON.stringify(journal,null,2),{mode:0o600});}
const users=new Map();
for(let page=1;;page++){
 const result=await client.auth.admin.listUsers({page,perPage:200});
 if(result.error)throw new Error(`Cannot inspect existing accounts: ${result.error.message}`);
 for(const user of result.data.users)users.set(user.email?.toLowerCase(),user);
 if(result.data.users.length<200)break;
}
let created=0,skipped=0;
for(const account of journal.accounts){
 if(!account.email.endsWith('@case-desk.test'))throw new Error('Unexpected test email domain; stopped.');
 const existing=users.get(account.email.toLowerCase());
 if(existing){
  account.state=existing.app_metadata?.test_run_id===journal.run_id?'created':'existing-unmodified';account.uid=existing.id;
  await save();skipped++;continue;
 }
 const {password,state,uid,email,...metadata}=account;
 const result=await client.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{...metadata,test_account:true,test_run_id:journal.run_id}});
 if(result.error){account.state='failed';await save();throw new Error(`Account creation failed for ${email}: ${result.error.message}. Existing accounts were not modified.`);}
 account.state='created';account.uid=result.data.user.id;await save();created++;
}
const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
const columns=['email','password','role','city','company','officer_name','uid','state'];
const csv=[columns,...journal.accounts.map(account=>columns.map(key=>key==='password'&&account.state!=='created'?'':account[key]))].map(row=>row.map(quote).join(',')).join('\r\n');
await writeFile(new URL('real-test-logins.csv',folder),'\ufeff'+csv,{mode:0o600});
console.log(JSON.stringify({created,existing:skipped,credentials_file:'outputs/test-accounts/real-test-logins.csv'}));
console.log('Passwords are in the private local file only. Test inboxes do not receive email. Existing accounts were not changed.');
