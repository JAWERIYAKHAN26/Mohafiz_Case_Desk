import {useEffect,useRef,useState} from 'react';
import {Mic,MicOff,PhoneOff} from 'lucide-react';
import {supabase} from './supabase';
import {databaseMessage} from './liveOperations';
import type {RealtimeChannel} from '@supabase/supabase-js';
type Peer={pc:RTCPeerConnection;audio:HTMLAudioElement;ice:RTCIceCandidateInit[]};
type Signal={from:string;to:string;description?:RTCSessionDescriptionInit;candidate?:RTCIceCandidateInit};
export default function GroupAudioCall({room,group,name,onLeave}:{room:string;group:string;name:string;onLeave:()=>void}){
 const [status,setStatus]=useState('Requesting microphone...'),[error,setError]=useState(''),[muted,setMuted]=useState(false),[participants,setParticipants]=useState<string[]>([]);
 const stream=useRef<MediaStream|null>(null),peers=useRef(new Map<string,Peer>()),channel=useRef<RealtimeChannel|null>(null),me=useRef(crypto.randomUUID());
 useEffect(()=>{
  let closed=false;const self=me.current;const peerMap=peers.current;
  const send=(to:string,data:Omit<Signal,'from'|'to'>)=>closed?undefined:channel.current?.send({type:'broadcast',event:'signal',payload:{from:self,to,...data}});
  function remove(id:string){const p=peerMap.get(id);if(p){p.pc.close();p.audio.srcObject=null;p.audio.remove();peerMap.delete(id);}}
  function peer(id:string){
   const old=peerMap.get(id);if(old)return old;
   let iceServers:RTCIceServer[]=[{urls:'stun:stun.l.google.com:19302'}];
   const configured=import.meta.env.VITE_RTC_ICE_SERVERS;
   if(configured){const parsed:unknown=JSON.parse(configured);if(!Array.isArray(parsed))throw new Error('Invalid call ICE server configuration.');iceServers=parsed as RTCIceServer[];}
   const pc=new RTCPeerConnection({iceServers}),audio=document.createElement('audio');audio.autoplay=true;document.body.appendChild(audio);
   const p:Peer={pc,audio,ice:[]};peerMap.set(id,p);stream.current?.getTracks().forEach(t=>pc.addTrack(t,stream.current!));
   pc.onicecandidate=e=>{if(e.candidate)void send(id,{candidate:e.candidate.toJSON()});};
   pc.ontrack=e=>{audio.srcObject=e.streams[0];void audio.play().catch(()=>{if(!closed)setError('Your browser blocked call audio. Use Enable audio below.');});};
   pc.onconnectionstatechange=()=>{if(closed)return;if(pc.connectionState==='connected')setStatus('Connected');if(pc.connectionState==='failed'){setError('Audio connection failed. Check microphone/network access and TURN server configuration.');remove(id);}};
   return p;
  }
  async function start(){
   try{
    if(!supabase||!navigator.mediaDevices?.getUserMedia)throw new Error('Calls require microphone support on HTTPS or localhost.');
    const media=await navigator.mediaDevices.getUserMedia({audio:true});if(closed){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;
    await supabase.realtime.setAuth();if(closed){media.getTracks().forEach(t=>t.stop());return;}
    const ch=supabase.channel(`call:${group}:${room}`,{config:{private:true,broadcast:{self:false},presence:{key:self}}});channel.current=ch;
    ch.on('broadcast',{event:'signal'},({payload})=>{void(async()=>{
     const s=payload as Signal;if(closed||s.to!==self||s.from===self||!s.from)return;
     try{const p=peer(s.from);if(s.description){await p.pc.setRemoteDescription(s.description);for(const ice of p.ice)await p.pc.addIceCandidate(ice);p.ice=[];if(s.description.type==='offer'){const answer=await p.pc.createAnswer();await p.pc.setLocalDescription(answer);await send(s.from,{description:answer});}}
      if(s.candidate){if(p.pc.remoteDescription)await p.pc.addIceCandidate(s.candidate);else p.ice.push(s.candidate);}
     }catch(e){if(!closed)setError(databaseMessage(e));}
    })();});
    ch.on('presence',{event:'sync'},()=>{void(async()=>{
     const state=ch.presenceState<{name:string}>();const ids=Object.keys(state);if(!closed)setParticipants(ids.map(id=>state[id][0]?.name||'Participant'));
     for(const id of peerMap.keys())if(!ids.includes(id))remove(id);
     for(const id of ids){if(id===self||self>id||peerMap.has(id))continue;try{const p=peer(id);const offer=await p.pc.createOffer();await p.pc.setLocalDescription(offer);await send(id,{description:offer});}catch(e){if(!closed)setError(databaseMessage(e));}}
    })();});
    ch.subscribe(s=>{if(closed)return;if(s==='SUBSCRIBED'){setStatus('Waiting for group members...');void ch.track({name});}else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT')setError('Call signaling unavailable. Apply the group call invites migration and check your connection.');});
   }catch(e){if(!closed)setError(databaseMessage(e));}
  }
  void start();
  return()=>{closed=true;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;for(const id of peerMap.keys())remove(id);const ch=channel.current;if(ch){void ch.untrack();void supabase?.removeChannel(ch);}channel.current=null;};
 },[room,group,name]);
 return <section className="chat-call-panel" aria-label="Group audio call"><b>Internal group audio call</b><p role="status">{status} ? {participants.length} participant{participants.length===1?'':'s'}</p><p>{participants.join(', ')}</p>{error&&<p role="alert">{error}</p>}<div className="live-case-action-buttons"><button onClick={()=>{stream.current?.getAudioTracks().forEach(t=>{t.enabled=muted;});setMuted(v=>!v);}}>{muted?<MicOff size={16}/>:<Mic size={16}/>} {muted?'Unmute':'Mute'}</button><button onClick={()=>{for(const p of peers.current.values())void p.audio.play().catch(()=>setError('Audio playback is blocked by the browser.'));}}>Enable audio</button><button onClick={onLeave}><PhoneOff size={16}/>Leave call</button></div></section>;
}
