import {useCallback,useEffect,useRef,useState} from 'react';
import {Phone,PhoneCall,PhoneOff,X} from 'lucide-react';
import {supabase} from './supabase';
import GroupAudioCall from './GroupAudioCall';
import {databaseMessage} from './liveOperations';
import type {WorkbookProfile} from './workbookData';
import type {RealtimeChannel} from '@supabase/supabase-js';

type DirectoryUser={id:string;name:string;role:string;city:string|null;company:string|null};
type DirectCall={id:string;caller_id:string;callee_id:string;caller_name:string;callee_name:string;status:'ringing'|'active'|'ended';ring_until:string;is_caller:boolean};
export default function DirectVoiceCalls({profile,open,onClose}:{profile:WorkbookProfile;open:boolean;onClose:()=>void}){
 const [directory,setDirectory]=useState<DirectoryUser[]>([]),[calls,setCalls]=useState<DirectCall[]>([]),[loading,setLoading]=useState(false),[starting,setStarting]=useState<string|null>(null),[responding,setResponding]=useState(false),[search,setSearch]=useState(''),[error,setError]=useState(''),[ringtoneEnabled,setRingtoneEnabled]=useState(false);
 const alive=useRef(true),inFlight=useRef(false),channel=useRef<RealtimeChannel|null>(null),ringtoneContext=useRef<AudioContext|null>(null);
 const refresh=useCallback(async()=>{
  if(!supabase||inFlight.current)return;inFlight.current=true;
  try{const result=await supabase.rpc('workspace_direct_call_state');if(result.error)throw result.error;if(alive.current)setCalls((result.data||[]) as DirectCall[]);}
  catch(problem){if(alive.current)setError(databaseMessage(problem));}finally{inFlight.current=false;}
 },[]);
 useEffect(()=>{
  alive.current=true;if(!supabase)return;void refresh();
  const realtime=supabase.channel('direct-voice-calls-'+crypto.randomUUID()).on('postgres_changes',{event:'*',schema:'public',table:'workspace_direct_calls'},()=>void refresh()).subscribe();channel.current=realtime;
  const timer=window.setInterval(()=>void refresh(),3000);
  return()=>{alive.current=false;window.clearInterval(timer);void supabase.removeChannel(realtime);channel.current=null;};
 },[refresh,profile.email]);
 useEffect(()=>{
  if(!open||!supabase)return;let active=true;setLoading(true);setError('');
  void supabase.rpc('workspace_call_directory').then(result=>{if(!active)return;if(result.error)setError(databaseMessage(result.error));else setDirectory((result.data||[]) as DirectoryUser[]);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[open,profile.email]);
 const outgoing=calls.find(call=>call.is_caller&&call.status==='ringing');
 const incoming=calls.find(call=>!call.is_caller&&call.status==='ringing'&&Date.parse(call.ring_until)>Date.now());
 const activeCall=calls.find(call=>call.status==='active');
 const audioCall=activeCall||outgoing;
 function unlockRingtone(){
  if(!('AudioContext' in window))return;
  const ctx=ringtoneContext.current??(ringtoneContext.current=new AudioContext());
  void ctx.resume().then(()=>setRingtoneEnabled(ctx.state==='running')).catch(()=>setRingtoneEnabled(false));
 }
 useEffect(()=>{
  window.addEventListener('pointerdown',unlockRingtone);window.addEventListener('keydown',unlockRingtone);
  return()=>{window.removeEventListener('pointerdown',unlockRingtone);window.removeEventListener('keydown',unlockRingtone);if(ringtoneContext.current){void ringtoneContext.current.close();ringtoneContext.current=null;}};
 },[]);
 useEffect(()=>{
  if(!incoming||!('AudioContext' in window))return;
  const ctx=ringtoneContext.current??(ringtoneContext.current=new AudioContext()),tones=new Set<OscillatorNode>();let stopped=false;
  const ring=()=>{
   if(stopped||ctx.state!=='running')return;
   const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type='sine';osc.frequency.setValueAtTime(440,now);osc.frequency.setValueAtTime(480,now+0.48);
   gain.gain.setValueAtTime(0.0001,now);gain.gain.linearRampToValueAtTime(0.12,now+0.04);gain.gain.setValueAtTime(0.12,now+0.24);gain.gain.linearRampToValueAtTime(0.0001,now+0.34);
   gain.gain.setValueAtTime(0.0001,now+0.5);gain.gain.linearRampToValueAtTime(0.12,now+0.54);gain.gain.setValueAtTime(0.12,now+0.74);gain.gain.linearRampToValueAtTime(0.0001,now+0.84);
   osc.connect(gain);gain.connect(ctx.destination);tones.add(osc);osc.onended=()=>tones.delete(osc);osc.start(now);osc.stop(now+0.9);
  };
  ring();const timer=window.setInterval(ring,1900);
  return()=>{stopped=true;window.clearInterval(timer);for(const tone of tones){try{tone.stop();}catch{}}tones.clear();};
 },[incoming?.id]);
 useEffect(()=>{
  if(!audioCall?.is_caller||!supabase)return;
  const timer=window.setInterval(()=>{void supabase.rpc('workspace_direct_call_action',{p_action:'heartbeat',p_id:audioCall.id}).then(result=>{if(result.error&&alive.current)setError(databaseMessage(result.error));});},10000);
  return()=>window.clearInterval(timer);
 },[audioCall?.id,audioCall?.is_caller]);
 async function beginCall(user:DirectoryUser){
  if(!supabase||starting)return;setStarting(user.id);setError('');
  try{const result=await supabase.rpc('workspace_direct_call_action',{p_action:'start',p_target:user.id});if(result.error)throw result.error;await refresh();}
  catch(problem){setError(databaseMessage(problem));}finally{if(alive.current)setStarting(null);}
 }
 async function respond(action:'answer'|'decline'|'end',call:DirectCall){
  if(!supabase||responding)return;setResponding(true);setError('');
  try{const result=await supabase.rpc('workspace_direct_call_action',{p_action:action,p_id:call.id});if(result.error)throw result.error;await refresh();}
  catch(problem){setError(databaseMessage(problem));}finally{if(alive.current)setResponding(false);}
 }
 const visibleDirectory=directory.filter(user=>`${user.name} ${user.role} ${user.city||''} ${user.company||''}`.toLowerCase().includes(search.toLowerCase()));
 return <>
  {open&&<div className="direct-call-directory-scrim"><section className="box direct-call-directory" role="dialog" aria-modal="true" aria-labelledby="direct-call-title"><header><div><h2 id="direct-call-title">Voice calls</h2><p>Call any portal user. Calls are audio only; private chats are not available.</p></div><button aria-label="Close voice calls" onClick={onClose}><X size={18}/></button></header><label className="direct-call-search">Find a person<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search name, role, city, or company"/></label>{error&&<p className="workbook-error" role="alert">{error}</p>}{loading?<p>Loading portal users…</p>:<div className="direct-call-directory-list">{visibleDirectory.map(user=><article key={user.id}><div><b>{user.name}</b><small>{user.role}{user.city?` · ${user.city}`:''}{user.company?` · ${user.company}`:''}</small></div><button className="primary" disabled={starting!==null} onClick={()=>void beginCall(user)}><Phone size={16}/>{starting===user.id?'Calling…':'Call'}</button></article>)}{!visibleDirectory.length&&<p>No other users found.</p>}</div>}</section></div>}
  {incoming&&<section className="direct-incoming-call" role="alertdialog" aria-label="Incoming voice call"><span className="incoming-call-icon"><PhoneCall size={28}/></span><h2>Incoming voice call</h2><p><strong>{incoming.caller_name}</strong> is calling you</p><div><button className="call-decline" disabled={responding} onClick={()=>void respond('decline',incoming)}><PhoneOff size={17}/>Decline</button><button className="call-answer" disabled={responding||!!activeCall||!!outgoing} onClick={()=>void respond('answer',incoming)}><Phone size={17}/>Answer</button></div>{!ringtoneEnabled&&<button className="call-notification-optin" onClick={unlockRingtone}>Enable call sounds</button>}</section>}
  {audioCall&&<div className="direct-active-call"><p>{audioCall.is_caller&&audioCall.status==='ringing'?'Calling':'Voice call'} · {audioCall.is_caller?audioCall.callee_name:audioCall.caller_name}</p><GroupAudioCall key={audioCall.id} room={audioCall.id} group="direct" topic={`direct-call:${audioCall.id}`} title="Private voice call" name={profile.name} onLeave={()=>void respond('end',audioCall)}/></div>}
 </>;
}
