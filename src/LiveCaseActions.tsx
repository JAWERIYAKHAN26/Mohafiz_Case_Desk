import {useEffect,useState} from 'react';
import {supabase} from './supabase';
import {databaseMessage} from './liveOperations';
import type {WorkbookCase,WorkbookProfile} from './workbookData';
export default function LiveCaseActions({item,profile,onChange}:{item:WorkbookCase;profile:WorkbookProfile;onChange:()=>void}){
 const [stage,setStage]=useState<string|null>(null),[events,setEvents]=useState<{id:string;action:string;body:string|null;actor_name:string;created_at:string}[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[body,setBody]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let alive=true;
  const load=async()=>{
   if(!supabase)return;
   const [state,history]=await Promise.all([supabase.from('case_workflow').select('stage').eq('source_sha256',item.source_sha256).eq('source_sheet',item.source_sheet).eq('source_row',item.source_row).maybeSingle(),supabase.from('case_workflow_events').select('id,action,body,actor_name,created_at').eq('source_sha256',item.source_sha256).eq('source_sheet',item.source_sheet).eq('source_row',item.source_row).order('created_at',{ascending:false}).limit(100)]);
   if(!alive)return;setLoading(false);
   if(state.error||history.error){setError(databaseMessage(state.error||history.error));return;}
   setError('');setStage(state.data?.stage||null);setEvents(history.data||[]);
  };
  void load();
  const channel=supabase?.channel(`case-action-${item.source_row}-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'case_workflow',filter:`source_sha256=eq.${item.source_sha256}`},()=>void load()).subscribe();
  return()=>{alive=false;if(channel)void supabase!.removeChannel(channel);};
 },[item.source_sha256,item.source_sheet,item.source_row,revision]);
 async function act(action:string){
  if(!supabase||busy)return;setBusy(true);setError('');
  try{
   const result=await supabase.rpc('case_workflow_action',{p_sha:item.source_sha256,p_sheet:item.source_sheet,p_row:item.source_row,p_action:action,p_body:action==='report'?body:''});
   if(result.error)throw result.error;setStage(result.data as string);setBody('');setRevision(value=>value+1);onChange();
  }catch(problem){setError(databaseMessage(problem));}finally{setBusy(false);}
 }
 const cro=['CRO','CRO Manager'].includes(profile.role),reviewer=cro||['SFSO','SOM'].includes(profile.role),fso=profile.role==='FSO';
 return <section className="box live-case-actions"><h2>Case workflow</h2>{loading?<p role="status">Loading workflow...</p>:<p>Stage: <b>{stage||(item.status==='Closed'?'Closed':'Awaiting acknowledgement')}</b></p>}{error&&<div role="alert" className="workbook-error">{error}</div>}
 {!loading&&item.status!=='Closed'&&<div className="live-case-action-buttons">{cro&&!stage&&<button className="primary" disabled={busy} onClick={()=>void act('acknowledge')}>Acknowledge & forward to field team</button>}{fso&&stage==='Acknowledged'&&<button className="primary" disabled={busy} onClick={()=>void act('start')}>Acknowledge & start dispatch</button>}{fso&&stage==='In progress'&&<button className="primary" disabled={busy} onClick={()=>void act('arrive')}>Confirm arrival</button>}{reviewer&&stage==='Submitted'&&<button className="primary" disabled={busy} onClick={()=>void act('review')}>Mark findings reviewed</button>}</div>}
 {fso&&['Arrived','Submitted'].includes(stage||'')&&<form onSubmit={event=>{event.preventDefault();void act('report');}}><label>Field findings<textarea value={body} minLength={20} maxLength={10000} required onChange={event=>setBody(event.target.value)} placeholder="Describe what you found on site..."/></label><button className="primary" disabled={busy||body.trim().length<20}>Send field findings</button></form>}
 {events.map(event=><article className="workbook-note" key={event.id}><b>{event.actor_name} · {event.action}</b><small>{new Intl.DateTimeFormat('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'}).format(new Date(event.created_at))} PKT</small>{event.body&&<p>{event.body}</p>}</article>)}
 </section>;
}
