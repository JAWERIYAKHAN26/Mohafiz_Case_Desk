import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {Phone,PhoneOff,X} from 'lucide-react';
import {supabase} from './supabase';
import GroupAudioCall from './GroupAudioCall';
import {databaseMessage} from './liveOperations';
import type {WorkbookProfile} from './workbookData';
type Call={id:string;group_key:string;caller_name:string;status:string;ring_until:string;is_caller:boolean;my_response:string|null};
const Calls=createContext<{startCall:(group:string)=>void;starting:boolean}>({startCall:()=>{},starting:false});
export const useGroupCalls=()=>useContext(Calls);
export default function GroupCallProvider({children,profile,light=true}:{children:ReactNode;profile:WorkbookProfile;light?:boolean}){
 const [calls,setCalls]=useState<Call[]>([]),[active,setActive]=useState<Call|null>(null),[error,setError]=useState(''),[starting,setStarting]=useState(false),[responding,setResponding]=useState(false);
 const alive=useRef(true),current=useRef<Call|null>(null),inFlight=useRef(false),notified=useRef(new Set<string>()),dismissed=useRef(new Set<string>());current.current=active;
 const eligible=['CRO','CRO Manager','SFSO','SOM','FSO'].includes(profile.role);
 const refresh=useCallback(async()=>{
  if(!supabase||!eligible||inFlight.current)return;inFlight.current=true;
  try{const r=await supabase.rpc('workspace_call_state');if(r.error)throw r.error;if(!alive.current)return;const next=(r.data||[]) as Call[];setCalls(next);
   if(current.current){const found=next.find(c=>c.id===current.current?.id);if(found)setActive(found);else{setActive(null);setError('The call ended or was not answered.');}}
  }catch(e){if(alive.current&&current.current)setError(databaseMessage(e));}finally{inFlight.current=false;}
 },[eligible,profile.email]);
 useEffect(()=>{
  alive.current=true;if(!eligible||!supabase)return;void refresh();
  const ch=supabase.channel('incoming-group-calls-'+crypto.randomUUID()).on('postgres_changes',{event:'*',schema:'public',table:'workspace_calls'},()=>void refresh()).subscribe();
  const timer=window.setInterval(()=>void refresh(),3000);
  return()=>{alive.current=false;window.clearInterval(timer);void supabase!.removeChannel(ch);const c=current.current;if(c)void supabase!.rpc('workspace_call_action',{p_action:c.is_caller?'end':'decline',p_id:c.id});};
 },[eligible,refresh]);
 useEffect(()=>{if(!active?.is_caller)return;const timer=window.setInterval(()=>{void supabase?.rpc('workspace_call_action',{p_action:'heartbeat',p_id:active.id}).then(r=>{if(r.error&&alive.current)setError(databaseMessage(r.error));});},10000);return()=>window.clearInterval(timer);},[active?.id,active?.is_caller]);
 const incoming=calls.find(c=>!c.is_caller&&c.my_response!=='accepted'&&c.my_response!=='declined'&&!dismissed.current.has(c.id)&&Date.parse(c.ring_until)>Date.now());
 useEffect(()=>{
  if(!incoming||notified.current.has(incoming.id))return;notified.current.add(incoming.id);
  if('Notification' in window&&Notification.permission==='granted'){const n=new Notification('Incoming Mohafiz group call',{body:incoming.caller_name+' is calling '+incoming.group_key.split(':').at(-1),tag:incoming.id});n.onclick=()=>{window.focus();n.close();};const t=window.setTimeout(()=>n.close(),45000);return()=>{window.clearTimeout(t);n.close();};}
 },[incoming?.id]);
 async function startCall(group:string){
  if(!supabase||starting)return;if(current.current){setError('Leave your current call before starting another.');return;}setStarting(true);setError('');
  try{const r=await supabase.rpc('workspace_call_action',{p_action:'start',p_group:group});if(r.error)throw r.error;if(alive.current){setActive(r.data as Call);setCalls(v=>[r.data as Call,...v]);}}catch(e){if(alive.current)setError(databaseMessage(e));}finally{if(alive.current)setStarting(false);}
 }
 async function respond(call:Call,answer:boolean){
  if(!supabase||responding)return;setResponding(true);setError('');
  try{if(answer&&current.current){setError('Leave your current call before answering another.');return;}const r=await supabase.rpc('workspace_call_action',{p_action:answer?'answer':'decline',p_id:call.id});if(r.error)throw r.error;if(!alive.current)return;dismissed.current.add(call.id);setCalls(v=>v.map(c=>c.id===call.id?{...c,my_response:answer?'accepted':'declined'}:c));if(answer)setActive({...call,status:'active',my_response:'accepted'});
  }catch(e){if(alive.current)setError(databaseMessage(e));}finally{if(alive.current)setResponding(false);}
 }
 async function leave(){const c=current.current;if(!c||!supabase)return;setActive(null);dismissed.current.add(c.id);const r=await supabase.rpc('workspace_call_action',{p_action:c.is_caller?'end':'decline',p_id:c.id});if(r.error&&alive.current)setError(databaseMessage(r.error));}
 return <Calls.Provider value={{startCall:group=>void startCall(group),starting}}>{children}<div className={'desk '+(light?'light ':'')+'call-ui-root'}>
 {error&&<div className="call-notice" role="alert">{error}<button aria-label="Dismiss call notice" onClick={()=>setError('')}><X size={16}/></button></div>}
 {incoming&&<section className="incoming-call-card" role="alertdialog" aria-modal="false" aria-label="Incoming group call"><span className="incoming-call-icon"><Phone size={30}/></span><h2>Incoming group call</h2><p><strong>{incoming.caller_name}</strong> is calling</p><p>Mohafiz X {incoming.group_key.split(':').at(-1)}</p>{active&&<p>You are already in another call.</p>}<div className="incoming-call-actions"><button className="call-decline" disabled={responding} onClick={()=>void respond(incoming,false)}><PhoneOff size={18}/>Decline</button><button className="call-answer" disabled={responding||!!active} onClick={()=>void respond(incoming,true)}><Phone size={18}/>Answer</button></div>{'Notification' in window&&Notification.permission==='default'&&<button className="call-notification-optin" onClick={()=>void Notification.requestPermission()}>Enable desktop call notifications</button>}</section>}
 {active&&<div className="active-call-window"><p className="active-call-heading">{active.is_caller&&active.status==='ringing'?'Calling group...':'Group call'} - {active.group_key.split(':').at(-1)}</p><GroupAudioCall key={active.id} room={active.id} group={active.group_key} name={profile.name} onLeave={()=>void leave()}/></div>}
 </div></Calls.Provider>;
}
