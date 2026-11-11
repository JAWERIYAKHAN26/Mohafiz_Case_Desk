// Isolated PostgreSQL/WASM verification. Never connects to Supabase or reads credentials.
// Install the optional test dependency with:
// npm install --prefix outputs/desk-sql-validation --no-save --package-lock=false @electric-sql/pglite
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(new URL('../../outputs/desk-sql-validation/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url));
const db=new PGlite();
const sha='1be36f4fe2c0daf28c1a3b5b02432d7d7a30fdf211a456e9c3d3e412861f48b3';
let checks=0;
async function check(name,run){await run();checks++;console.log('PASS '+name);}
async function rejects(sql,params,pattern){await assert.rejects(()=>db.query(sql,params),pattern);}
const users={
 cro:{id:'10000000-0000-4000-8000-000000000001',role:'CRO',display_name:'Test CRO'},
 client:{id:'10000000-0000-4000-8000-000000000002',role:'Client',company:'Daraz',display_name:'Test Client'},
 fso:{id:'10000000-0000-4000-8000-000000000003',role:'FSO',city:'Islamabad',officer_name:'Test Officer One'},
 other:{id:'10000000-0000-4000-8000-000000000004',role:'FSO',city:'Islamabad',officer_name:'Test Officer Two'},
 sfso:{id:'10000000-0000-4000-8000-000000000005',role:'SFSO',city:'Karachi'},
 sfso_islamabad:{id:'10000000-0000-4000-8000-000000000006',role:'SFSO',city:'Islamabad'},
 fso_three:{id:'10000000-0000-4000-8000-000000000007',role:'FSO',city:'Islamabad',officer_name:'Test Officer Three'},
};
async function login(key){const {id,...app_metadata}=users[key];await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,app_metadata})]);await db.exec('set role authenticated');}
const action=(row,kind,data={})=>db.query('select public.desk_case_action($1,$2,$3,$4,$5) as value',[sha,'B2B - 2025',row,kind,JSON.stringify(data)]);
const list=async(filters={})=>(await db.query('select public.desk_case_list($1,$2,0,50) as value',[sha,JSON.stringify(filters)])).rows[0].value;
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create schema realtime;
 create table realtime.messages(id uuid default gen_random_uuid(),body text);
 alter table realtime.messages enable row level security;
 create function realtime.topic() returns text language sql stable as $$select current_setting('test.realtime_topic',true)$$;
 grant usage on schema realtime to authenticated;grant select,insert on realtime.messages to authenticated;grant execute on function realtime.topic() to authenticated;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
 create table auth.users(id uuid primary key,raw_app_meta_data jsonb,banned_until timestamptz);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);
 alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
 grant usage on schema auth,storage to authenticated;
 grant execute on all functions in schema auth,storage to authenticated;
 grant select,insert,delete on storage.objects to authenticated;`);
 const migrations=process.argv.includes('--bundle')
  ? ['20261102_workbook_import.sql','20261103_workbook_read_access.sql','20261103_scoped_dashboard_timeout_fix.sql','20261103_workflow_realtime_chat.sql']
  : ['20261102_workbook_import.sql','20261103_workbook_read_access.sql','20261103_scoped_dashboard_timeout_fix.sql','20261103_field_evidence.sql','20261103_workflow_realtime_chat.sql','20261104_portal_parity.sql','20261104_portal_parity_client_only.sql','20261104_portal_workspace_details.sql','20261106_workbook_calculations.sql','20261110_workflow_query_performance.sql','20261111_field_chat_updates.sql','20261112_group_call_invites.sql','20261112_incoming_group_calls.sql','20261113_portal_call_roles.sql','20261114_case_reopen.sql','20261115_client_intake_sfso_routing.sql','20261116_case_lifecycle_auto_messages.sql','20261117_direct_voice_calls.sql','20261118_workflow_chat_counter_performance.sql','20261119_direct_call_busy_status.sql','20261120_workspace_group_calls_all_groups.sql','20261121_filter_options_issue.sql'];
 for(const filename of migrations){
  try{await db.exec(await readFile(new URL('../../supabase/migrations/'+filename,import.meta.url),'utf8'));}
  catch(error){throw new Error(filename+': '+error.message,{cause:error});}
 }
 if(process.argv.includes('--bundle')){
  const bundle=await readFile(new URL('../../outputs/current-workbook-audit/INSTALL_WORKBOOK_BACKEND.sql',import.meta.url),'utf8');
  await db.exec(bundle);await db.exec(bundle);
  console.log('PASS backend installation bundle runs twice without duplicate objects');
 }
 await db.query("insert into public.workbook_import_batches(source_sha256,source_filename,source_sheet,expected_cases,expected_notes,expected_links) values($1,'test.xlsx','B2B - 2025',3,0,0)",[sha]);
 for(const {id,...metadata} of Object.values(users))await db.query('insert into auth.users(id,raw_app_meta_data) values($1,$2)',[id,JSON.stringify(metadata)]);
 for(const [row,company,id] of [[2,'Daraz','DAR-ISL-NOV-26-1'],[3,'PostEx','POS-ISL-NOV-26-1'],[4,'Daraz','DUPLICATE']]){
  await db.query(`insert into public.workbook_import_cases(source_sha256,source_sheet,source_row,source_row_sha256,case_id,company,city,hub,issue,status,priority,total_loss,total_loss_numeric,recovered,recovered_numeric,assigned_fso,formula_metadata,raw_cell_metadata)
   values($1,'B2B - 2025',$2,'original',$3,$4,'Islamabad','Test Hub','Test issue','Pending','Medium','1000',1000,'0',0,'Test Officer One','{}','{}')`,[sha,row,id,company]);
 }
 const original=(await db.query('select * from public.workbook_import_cases order by source_row')).rows;
 await check('Client sees own company and cannot use CRO actions',async()=>{
  await login('client');assert.equal((await list()).total,2);
  await rejects('select public.desk_case_action($1,$2,2,$3,$4)',[sha,'B2B - 2025','progress','{}'],/not permitted/);
  await rejects("select public.desk_case_action($1,$2,2,'note',$3)",[sha,'B2B - 2025',JSON.stringify({body:'Client cannot add internal notes'})],/not permitted/);
 });
 await check('CRO cannot create a case',async()=>{
  await login('cro');await rejects("select public.portal_create_case($1,gen_random_uuid(),'{}')",[sha],/not permitted/);
 });
 await check('Notes and classification preserve New queue; notes alone cannot close',async()=>{
  await action(2,'note',{body:'A saved internal note.',classification:'Genuine'});
  await login('client');
  assert.equal((await db.query("select id from public.case_workflow_events where source_sha256=$1 and source_row=2 and action='note'",[sha])).rows.length,0);
  await login('cro');
  assert.equal((await list({status:'__to_ack__'})).total,3);
  await rejects("select public.desk_case_action($1,'B2B - 2025',2,'close','{}')",[sha],/findings before closing/);
 });
 await check('Recovery validation and effective totals preserve the source',async()=>{
  await rejects("select public.desk_case_action($1,'B2B - 2025',2,'recovery',$2)",[sha,JSON.stringify({amount:1001})],/Recovery must/);
  await action(2,'recovery',{amount:250});
  assert.equal((await list()).rows.find(row=>row.source_row===2).recovered,'250');
  const summary=(await db.query('select public.workbook_summary($1) as value',[sha])).rows[0].value;assert.equal(summary.recovered,'250');
 });
 await check('Acknowledgement sends city and client notifications',async()=>{
  await action(2,'acknowledge');assert.equal((await list({status:'__to_ack__'})).total,2);
  assert.equal((await db.query('select count(*)::int as n from public.workspace_messages')).rows[0].n,2);
 });
 await check('CRO assignment requires unavailable SFSO; reassignment changes FSO coverage',async()=>{
  await rejects("select public.desk_case_action($1,'B2B - 2025',3,'assign',$2)",[sha,JSON.stringify({officer:'Test Officer Two'})],/unavailability/);
  await action(3,'assign',{officer:'Test Officer Two',sfso_unavailable:true});
  await login('fso');assert.ok(!(await list()).rows.some(row=>row.source_row===3));
  await rejects("select public.case_workflow_action($1,'B2B - 2025',3,'start','')",[sha],/outside your coverage/);
  await login('other');assert.equal((await list()).total,1);await action(3,'start');await action(3,'arrive');
  await action(3,'report',{body:'On-site field findings recorded for review.'});
 });
 await check('Out-of-city supervisor cannot access another city',async()=>{
  await login('sfso');assert.equal((await list()).total,0);
  await rejects("select public.desk_case_action($1,'B2B - 2025',3,'review','{}')",[sha],/outside your coverage/);
 });
 await check('Saved findings permit closure and update list/dashboard counts',async()=>{
  await login('cro');await action(2,'findings',{body:'Verified the incident and documented the resolution.'});await action(2,'close');
  assert.equal((await list({status:'Closed'})).total,1);
  const summary=(await db.query('select public.workbook_summary($1) as value',[sha])).rows[0].value;assert.equal(summary.closed,1);assert.equal(summary.pending,1);
  const closeNotices=(await db.query("select group_key,body from public.workspace_messages where body like '%closed by CRO%'")).rows;
  assert.ok(closeNotices.some(m=>m.group_key==='group:city:Islamabad'&&m.body.includes('DAR-ISL-NOV-26-1')&&m.body.includes('closed by CRO')));
  assert.ok(closeNotices.some(m=>m.group_key==='group:company:Daraz'&&m.body.includes('DAR-ISL-NOV-26-1')&&m.body.includes('closed by CRO')));
 });
 await check('Only CRO can reopen; effective status, counts, and actions return to open',async()=>{
  await login('client');
  await rejects("select public.desk_reopen_case($1,'B2B - 2025',2)",[sha],/Only CRO may reopen/);
  await login('cro');
  const reopened=(await db.query("select public.desk_reopen_case($1,'B2B - 2025',2) as value",[sha])).rows[0].value;
  assert.equal(reopened.stage,'In progress');
  assert.equal(reopened.assigned_fso,'Test Officer One');
  assert.equal((await list({status:'Closed'})).total,0);
  assert.equal((await list({status:'Pending'})).total,1);
  assert.equal((await list({status:'__open__'})).total,3);
  assert.ok((await list({status:'__active__'})).rows.some(row=>row.source_row===2));
  assert.equal((await db.query("select status from public.workbook_effective_cases where source_sha256=$1 and source_row=2",[sha])).rows[0].status,'Pending');
  const summary=(await db.query('select public.workbook_summary($1) as value',[sha])).rows[0].value;
  assert.equal(summary.closed,0);assert.equal(summary.pending,1);
  assert.equal((await db.query("select count(*)::int as n from public.case_workflow_events where source_sha256=$1 and source_row=2 and action='reopen'",[sha])).rows[0].n,1);
  const notices=(await db.query("select group_key,body from public.workspace_messages where body like '%DUPLICATE%' or body like '%DAR-ISL-NOV-26-1%'" )).rows;
  assert.ok(notices.some(message=>message.group_key==='group:city:Islamabad'&&message.body.includes('reopened by CRO')));
  assert.ok(notices.some(message=>message.group_key==='group:company:Daraz'&&message.body.includes('reopened by CRO')));
  assert.equal((await list({status:'Closed'})).total,0);
  assert.equal((await db.query("select status from public.workbook_effective_cases where source_sha256=$1 and source_row=2",[sha])).rows[0].status,'Pending');
  await action(2,'close');
 });
 await check('All original source rows remain unchanged after operational actions',async()=>{
  await db.exec('reset role');assert.deepEqual((await db.query('select * from public.workbook_import_cases order by source_row')).rows,original);
 });
 await check('Client IDs are unique and retries return the saved case',async()=>{
  await login('client');const data=JSON.stringify({company:'PostEx',city:'Islamabad',hub:'Test Hub',issue:'Theft',priority:'P2',location:'Test address',rider_name:'Test Rider',rider_phone:'00123',description:'A legitimate test case description.',incident_date:'2026-01-01',amount:'50'});
  const request='20000000-0000-4000-8000-000000000001';
  const create=async id=>(await db.query('select public.portal_create_case($1,$2,$3) as id',[sha,id,data])).rows[0].id;
  const first=await create(request);assert.equal(await create(request),first);
  const firstRow=(await db.query('select source_row from public.workbook_import_cases where case_id=$1',[first])).rows[0].source_row;
  assert.ok((await db.query('select body from public.workspace_messages where group_key=$1 and body like $2',['group:company:Daraz','%'+first+'%'])).rows.some(row=>row.body.includes('forwarded to SFSO')));
  await login('cro');
  await rejects('select public.desk_case_action($1,$2,$3,\'acknowledge\',$4)',[sha,'Portal Intake',firstRow,'{}'],/routed to SFSO/);
  await rejects('select public.desk_case_action($1,$2,$3,\'assign\',$4)',[sha,'Portal Intake',firstRow,JSON.stringify({officer:'Test Officer Three',sfso_unavailable:true})],/Only SFSO may assign/);
  await login('sfso_islamabad');
  assert.ok((await db.query('select body from public.workspace_messages where group_key=$1 and body like $2',['group:city:Islamabad','%'+first+'%'])).rows.some(row=>row.body.includes('awaiting SFSO acknowledgement')));
  await rejects("select public.desk_case_action($1,'Portal Intake',$2,'assign',$3)",[sha,firstRow,JSON.stringify({officer:'Test Officer Three'})],/Acknowledge this client-raised case/);
  const acknowledged=(await db.query('select public.sfso_acknowledge_case($1,$2,$3) as value',[sha,'Portal Intake',firstRow])).rows[0].value;
  assert.equal(acknowledged.stage,'Acknowledged');
  assert.ok((await db.query('select body from public.workspace_messages where group_key=$1 and body like $2',['group:company:Daraz','%'+first+'%'])).rows.some(row=>row.body.includes('acknowledged by SFSO')));
  await db.query('select public.desk_case_action($1,$2,$3,\'assign\',$4)',[sha,'Portal Intake',firstRow,JSON.stringify({officer:'Test Officer Three'})]);
  assert.ok((await db.query('select body from public.workspace_messages where group_key=$1 and body like $2',['group:city:Islamabad','%'+first+'%'])).rows.some(row=>row.body.includes('acknowledged by SFSO')&&row.body.includes('assigned to FSO Test Officer Three')));
  await login('fso_three');
  await db.query('select public.desk_case_action($1,$2,$3,\'start\',$4)',[sha,'Portal Intake',firstRow,'{}']);
  assert.ok((await db.query('select body from public.workspace_messages where group_key=$1 and body like $2',['group:city:Islamabad','%'+first+'%'])).rows.some(row=>row.body.includes('acknowledged by FSO Test Officer Three')));
  await login('client');
  const second=await create('20000000-0000-4000-8000-000000000002');assert.notEqual(first,second);assert.match(first,/^DAR-ISL-/);
  const retry='20000000-0000-4000-8000-000000000003';
  const concurrent=await Promise.all([create(retry),create(retry)]);assert.equal(concurrent[0],concurrent[1]);
  const stored=(await db.query('select * from public.workbook_import_cases where case_id=$1',[first])).rows[0];
  assert.equal(stored.priority,'P2');assert.ok(stored.reporting_day);
  const extra=JSON.stringify({...JSON.parse(data),personal_loss:'25',rider_cnic:'00123',customer_phone:'00321'});
  const extraId=(await db.query('select public.portal_create_case($1,$2,$3) as id',[sha,'20000000-0000-4000-8000-000000000004',extra])).rows[0].id;
  const extraStored=(await db.query('select * from public.workbook_effective_cases where case_id=$1',[extraId])).rows[0];
  assert.equal(Number(extraStored.total_loss),75);assert.equal(extraStored.rider_cnic,'00123');assert.equal(extraStored.customer_phone,'00321');
 });
 await check('Workbook date, money, SLA and score calculations follow standard Excel rules',async()=>{
  await login('cro');
  const input={source_sheet:'Portal Intake',issue:'Snatching',city:'Lahore',reported_date_iso:'2026-11-01',incident_date_iso:'2026-10-31',closure_date_iso:'2026-11-03',status:'Closed',company_loss:'1000',personal_loss:'100',recovered:'200'};
  const calc=async(c,w={})=>(await db.query("select public.workbook_calculated($1,$2,date '2026-11-06') as value",[JSON.stringify(c),JSON.stringify(w)])).rows[0].value;
  const closed=await calc(input);
  assert.equal(closed.region,'Central');assert.equal(closed.priority,'P1');
  assert.equal(closed.total_loss_numeric,1100);assert.equal(closed.remaining_recovery_numeric,900);
  assert.equal(closed.case_duration,'2');assert.equal(closed.days_since_closure,'3');assert.equal(closed.fso_score,'5');
  const pending=await calc({...input,status:'Pending',closure_date_iso:null});
  assert.equal(pending.days_pending,'5');assert.equal(pending.sla_breach,'');assert.equal(pending.days_since_closure,'');
  const overdue=await calc({...input,reported_date_iso:'2026-10-30',status:'Pending',closure_date_iso:null});
  assert.equal(Number(overdue.sla_breach),-2);
  const effective=await calc({...input,status:'Pending',closure_date_iso:null},{stage:'Closed',closed_date:'2026-11-05',recovered_amount:500});
  assert.equal(effective.status,'Closed');assert.equal(effective.days_since_closure,'1');assert.equal(effective.remaining_recovery_numeric,600);
  const manual=await calc({...input,source_sheet:'B2B - 2025',priority:'Manual',total_loss:'432',formula_metadata:{}});
  assert.equal(manual.priority,'Manual');assert.equal(manual.total_loss,'432');
  const broken=await calc({...input,source_sheet:'B2B - 2025',case_duration:'saved',formula_metadata:{AT:{expression:'#REF!'}}});
  assert.equal(broken.case_duration,'saved');
  const recoveryFormula=await calc({...input,source_sheet:'B2B - 2025',total_loss:'1100',formula_metadata:{Z:{expression:'SUM(X2:Y2)'},AA:{expression:'Y2-Z2'}}});
  assert.equal(Number(recoveryFormula.recovered),1200);assert.equal(Number(recoveryFormula.remaining_recovery),-100);
 });
 await check('Calculated view preserves company RLS',async()=>{
  await login('client');const result=await db.query('select distinct company from public.workbook_effective_cases');
  assert.deepEqual(result.rows.map(row=>row.company),['Daraz']);
 });
 await check('Short notes save; FSO rejection revokes access and allows reassignment with group notices',async()=>{
  await login('cro');await action(4,'note',{body:'OK',classification:'Genuine'});
  await action(4,'assign',{officer:'Test Officer One',sfso_unavailable:true});
  await login('fso');
  await rejects("select public.desk_case_action($1,'B2B - 2025',4,'reject',$2)",[sha,JSON.stringify({body:'short'})],/Explain rejection/);
  await action(4,'reject',{body:'Unable to attend because the assigned vehicle is unavailable.'});
  assert.ok(!(await list()).rows.some(c=>c.source_row===4));
  const notice=await db.query("select body from public.workspace_messages where body like '%rejected by FSO%'");assert.ok(notice.rows.some(n=>n.body.includes('vehicle is unavailable')));
  await login('cro');await action(4,'assign',{officer:'Test Officer One',sfso_unavailable:true});
  await login('fso');await action(4,'start');
  assert.ok((await db.query("select body from public.workspace_messages where body like '%acknowledged by FSO%'")).rows.length>0);
 });
 await check('City hubs respect client scope and media/location actions validate permissions',async()=>{
  await login('client');assert.deepEqual((await db.query("select public.portal_city_hubs('Islamabad') as value")).rows[0].value,['Test Hub']);
  await rejects("insert into public.workspace_messages(id,group_key,body) values(gen_random_uuid(),'group:city:Islamabad','Unauthorized')",[],/row-level security/);
  await login('fso');const id='30000000-0000-4000-8000-000000000001';
  await db.query("insert into public.workspace_messages(id,group_key,body) values($1,'group:city:Islamabad','Live location')",[id]);
  await rejects("select public.chat_share_location($1,100,73,now()+interval '15 minutes')",[id],/Invalid coordinates/);
  await db.query("select public.chat_share_location($1,33.7,73.1,now()+interval '15 minutes')",[id]);
  assert.equal((await db.query('select live_location from public.workspace_messages where id=$1',[id])).rows[0].live_location.active,true);
  await login('other');await rejects("select public.chat_share_location($1,33.7,73.1,now()+interval '15 minutes')",[id],/Only the FSO/);
  await login('fso');await db.query('select public.chat_share_location($1,null,null,null)',[id]);
  assert.equal((await db.query('select live_location from public.workspace_messages where id=$1',[id])).rows[0].live_location.active,false);
  await rejects("insert into public.workspace_messages(id,group_key,body,attachments) values(gen_random_uuid(),'group:city:Islamabad','Attachment',$1)",[JSON.stringify([{name:'bad.pdf',type:'application/pdf',path:'someone-else/group:city:Islamabad/fake'}])],/Invalid chat attachment/);
 });
 await check('Private call signaling allows same-city staff and rejects clients/other cities',async()=>{
  await login('cro');await db.query("select set_config('test.realtime_topic','call:group:city:Islamabad:lobby',false)");
  await db.query("insert into realtime.messages(body) values('incoming call')");
  await db.query("select set_config('test.realtime_topic','call:group:company:PostEx:lobby',false)");
  await db.query("insert into realtime.messages(body) values('client group invitation')");
  await db.query("select set_config('test.realtime_topic','call:group:city:Islamabad:active',false)");
  await db.query("insert into realtime.messages(body) values('audio signal')");
  await login('fso');await db.query("select set_config('test.realtime_topic','call:group:city:Islamabad:40000000-0000-4000-8000-000000000001',false)");
  await db.query("insert into realtime.messages(body) values('signal')");
  await login('client');await db.query("select set_config('test.realtime_topic','call:group:company:Daraz:lobby',false)");
  await db.query("insert into realtime.messages(body) values('client incoming call')");
  await db.query("select set_config('test.realtime_topic','call:group:city:Islamabad:lobby',false)");
  await rejects("insert into realtime.messages(body) values('incoming call')",[],/row-level security/);
  await db.query("select set_config('test.realtime_topic','call:group:city:Islamabad:40000000-0000-4000-8000-000000000001',false)");
  await rejects("insert into realtime.messages(body) values('signal')",[],/row-level security/);
  await login('sfso');await rejects("insert into realtime.messages(body) values('signal')",[],/row-level security/);
 });
 await check('Incoming calls ring authorized staff without chat invitations; answer, decline and end are scoped',async()=>{
  await login('cro');const before=(await db.query('select count(*)::int as n from public.workspace_messages')).rows[0].n;
  const call=(await db.query("select public.workspace_call_action('start','group:city:Islamabad') as value")).rows[0].value;
  assert.equal(call.is_caller,true);
  await login('client');assert.deepEqual((await db.query('select public.workspace_call_state() as value')).rows[0].value,[]);
  await rejects("select public.workspace_call_action('answer',null,$1)",[call.id],/outside your internal group/);
  await login('sfso');await rejects("select public.workspace_call_action('answer',null,$1)",[call.id],/outside your internal group/);
  await login('fso');let state=(await db.query('select public.workspace_call_state() as value')).rows[0].value;assert.equal(state[0].is_caller,false);assert.equal(state[0].status,'ringing');
  await db.query("select public.workspace_call_action('decline',null,$1)",[call.id]);
  state=(await db.query('select public.workspace_call_state() as value')).rows[0].value;assert.equal(state[0].my_response,'declined');
  await login('other');await db.query("select public.workspace_call_action('answer',null,$1)",[call.id]);
  state=(await db.query('select public.workspace_call_state() as value')).rows[0].value;assert.equal(state[0].my_response,'accepted');assert.equal(state[0].status,'active');
  await rejects("select public.workspace_call_action('end',null,$1)",[call.id],/Invalid call action/);
  await login('cro');await db.query("select public.workspace_call_action('end',null,$1)",[call.id]);
  assert.deepEqual((await db.query('select public.workspace_call_state() as value')).rows[0].value,[]);
  assert.equal((await db.query('select count(*)::int as n from public.workspace_messages')).rows[0].n,before);
 });
 await check('Bulk dashboard/list queries retain scope across 30,000 additional cases',async()=>{
  await db.exec('reset role');
  await db.query(`insert into public.workbook_import_cases(source_sha256,source_sheet,source_row,source_row_sha256,case_id,company,city,status,total_loss_numeric,recovered_numeric,assigned_fso,formula_metadata,raw_cell_metadata)
   select $1,'Bulk performance',n,'bulk','BULK-'||n,'PostEx',case when n%2=0 then 'Islamabad' else 'Karachi' end,'Pending',100,0,'Test Officer One','{}','{}' from generate_series(1,30000) n`,[sha]);
  for(const account of ['cro','client','fso','sfso']){
   await login(account);
   const started=Date.now();
   const summary=(await db.query('select public.workbook_summary($1) as value',[sha])).rows[0].value;
   const options=(await db.query('select public.workbook_filter_options($1) as value',[sha])).rows[0].value;
   const counters=(await db.query('select public.workflow_counters($1) as value',[sha])).rows[0].value;
   const page=await list();
   assert.equal(page.total,summary.total);assert.ok(page.rows.length<=50);assert.ok(counters.to_acknowledge>=0);
   if(account==='client'){assert.deepEqual(options.companies,['Daraz']);assert.ok(page.rows.every(c=>c.company==='Daraz'));}
   if(account==='fso'){assert.deepEqual(options.cities,['Islamabad']);assert.ok(page.rows.every(c=>c.assigned_fso==='Test Officer One'));}
   if(account==='sfso'){assert.deepEqual(options.cities,['Karachi']);assert.equal(summary.total,15000);}
   console.log(`  ${account}: four RPCs in ${Date.now()-started}ms; visible=${summary.total}`);
  }
 });
 await check('Unknown roles and anonymous callers cannot enumerate permitted keys',async()=>{
  await db.exec('reset role');
  for(const claims of [{},{sub:users.cro.id,app_metadata:{role:'Unknown'}}]){
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);
   await db.exec('set role authenticated');
   assert.equal((await db.query('select count(*)::int as n from public.desk_readable_case_keys()')).rows[0].n,0);
   await db.exec('reset role');
  }
 });
 console.log(`${checks} isolated database checks passed.`);
} finally {await db.close();}
