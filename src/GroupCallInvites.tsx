import {useEffect,useRef,useState} from 'react';
import {Phone,PhoneOff} from 'lucide-react';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {supabase} from './supabase';
import GroupAudioCall from './GroupAudioCall';
import {workspaceGroups,type WorkspaceGroup} from './workspaceGroups';
import type {WorkbookProfile} from './workbookData';

type IncomingCall={group:WorkspaceGroup;caller:string;expiresAt:number;room:string};

export default function GroupCallInvites({profile}:{profile:WorkbookProfile}){
 const [incoming,setIncoming]=useState<IncomingCall|null>(null),[activeGroup,setActiveGroup]=useState<WorkspaceGroup|null>(null),[activeRoom,setActiveRoom]=useState<string|null>(null);
 const channels=useRef(new Map<string,RealtimeChannel>()),expiryTimer=useRef<number|undefined>(undefined);
 const claimedRooms=useRef(new Set<string>());

 useEffect(()=>{
  if(!supabase)return;
  let active=true;const subscribed:RealtimeChannel[]=[];
  const connect=async()=>{
   await supabase!.realtime.setAuth();
    for(const group of workspaceGroups(profile)){
    if(!active)return;
    const channel=supabase!.channel(`call:${group.key}:lobby`,{config:{private:true,broadcast:{self:false}}});
    channels.current.set(group.key,channel);subscribed.push(channel);
    channel.on('broadcast',{event:'incoming-call'},({payload})=>{
    const invitation=payload as {caller?:string;callerEmail?:string;expiresAt?:number;room?:string;targetRole?:string|null};
    const roleMatches=!invitation.targetRole||invitation.targetRole===profile.role;
    if(!active||!roleMatches||invitation.callerEmail===profile.email||!invitation.caller||!invitation.room||claimedRooms.current.has(invitation.room)||!Number.isFinite(invitation.expiresAt)||invitation.expiresAt!<=Date.now())return;
     window.clearTimeout(expiryTimer.current);
    const next={group,caller:invitation.caller,expiresAt:invitation.expiresAt!,room:invitation.room};setIncoming(next);
     expiryTimer.current=window.setTimeout(()=>setIncoming(current=>current?.expiresAt===next.expiresAt?null:current),Math.max(0,next.expiresAt-Date.now()));
    });
    channel.on('broadcast',{event:'call-response'},({payload})=>{
     const response=payload as {response?:string;room?:string;responderEmail?:string};
     if(response.response!=='join'||!response.room)return;
     claimedRooms.current.add(response.room);
     if(response.responderEmail!==profile.email)setIncoming(current=>{
      if(current?.room!==response.room)return current;
      window.clearTimeout(expiryTimer.current);return null;
     });
    });
    channel.subscribe();
   }
  };
  void connect().catch(error=>console.error('Group call invitations unavailable:',error));
  return()=>{active=false;window.clearTimeout(expiryTimer.current);channels.current.clear();for(const channel of subscribed)void supabase?.removeChannel(channel);};
 },[profile.role,profile.city,profile.company,profile.email]);

 function respond(join:boolean){
  if(!incoming)return;
  const invitation=incoming;
  if(join)claimedRooms.current.add(invitation.room);
  void channels.current.get(invitation.group.key)?.send({type:'broadcast',event:'call-response',payload:{response:join?'join':'decline',responder:profile.name,responderEmail:profile.email,room:invitation.room}});
  window.clearTimeout(expiryTimer.current);setIncoming(null);
    if(join){setActiveGroup(invitation.group);setActiveRoom(invitation.room);}
 }

 return <>
  {incoming&&!activeGroup&&<div className="call-invite-scrim"><section className="call-invite-dialog" role="dialog" aria-modal="true" aria-labelledby="call-invite-title">
    <span className="call-invite-icon"><Phone size={20}/></span><small>{incoming.group.label}</small><h2 id="call-invite-title">{incoming.caller} is calling</h2><p>Join the audio call?</p>
   <div><button className="primary" onClick={()=>respond(true)}><Phone size={15}/>Join call</button><button onClick={()=>respond(false)}><PhoneOff size={15}/>Decline</button></div>
  </section></div>}
    {activeGroup&&activeRoom&&<div className="call-active-scrim"><GroupAudioCall room={activeRoom} group={activeGroup.key} name={profile.name} onLeave={()=>{setActiveGroup(null);setActiveRoom(null);}}/></div>}
 </>;
}