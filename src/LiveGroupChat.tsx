import {useCallback,useEffect,useRef,useState} from 'react';
import {Send,RefreshCw,Search,Paperclip,Mic,Square,PhoneCall,MapPin,X} from 'lucide-react';
import ChatCaseText from './ChatCaseText';
import {WORKBOOK_SHA,workbookListSelect,workbookKey} from './workbookData';
import ChatAttachment from './ChatAttachment';
import {supabase} from './supabase';
import {databaseMessage,mergeMessages,type LiveMessage} from './liveOperations';
import type {WorkspaceGroup} from './workspaceGroups';
import type {WorkbookCase,WorkbookProfile} from './workbookData';
type ChatMember={id:string;name:string;role:string;city:string|null;company:string|null};
type CaseSuggestion={case_id:string;source_sheet:string;source_row:number;company:string|null;city:string|null};
type ComposerTrigger={kind:'member'|'case';query:string;start:number};
type ComposerOption={kind:'member';id:string;name:string;subtitle:string}|{kind:'case';case_id:string;subtitle:string};
function memberCanAccessGroup(member:ChatMember,group:WorkspaceGroup){
 const management=['CRO','CRO Manager'].includes(member.role);
 if(group.kind==='city')return management||(['FSO','SFSO','SOM'].includes(member.role)&&(member.city==='Rawalpindi'?'Islamabad':member.city)===group.value);
 if(management||['SFSO','SOM'].includes(member.role))return ['PostEx','Daraz','Buscaro'].includes(group.value);
 return member.role==='Client'&&member.company===group.value;
}
function readComposerTrigger(text:string,caret:number):ComposerTrigger|null{
 const before=text.slice(0,caret),match=/(^|\s)([@#])([^\s@#]*)$/.exec(before);
 if(!match)return null;
 return {kind:match[2]==='@'?'member':'case',query:match[3],start:before.length-match[0].length+match[1].length};
}
export default function LiveGroupChat({group,onRead,caseContext,profile,onOpenCase,onStartDirectCall}:{onOpenCase?:(item:WorkbookCase)=>void;onStartDirectCall:()=>void;profile:WorkbookProfile;group:WorkspaceGroup;onRead:()=>void;caseContext?:WorkbookCase|null}){
 const [openingCase,setOpeningCase]=useState(false),[caseMatches,setCaseMatches]=useState<WorkbookCase[]>([]);
 async function openCase(id:string){
  if(!supabase||openingCase)return;setOpeningCase(true);setError('');setCaseMatches([]);
  try{let query=supabase.from('workbook_import_cases').select(workbookListSelect).eq('source_sha256',WORKBOOK_SHA).eq('case_id',id);
   if(caseContext?.case_id===id)query=query.eq('source_sheet',caseContext.source_sheet).eq('source_row',caseContext.source_row);
   const result=await query.order('source_sheet').order('source_row').limit(100);if(result.error)throw result.error;if(!alive.current)return;
   const matches=(result.data||[]) as WorkbookCase[];if(matches.length===1)onOpenCase?.(matches[0]);else if(matches.length>1)setCaseMatches(matches);else setError('This case is unavailable or outside your assigned access.');
  }catch(e){if(alive.current)setError(databaseMessage(e));}finally{if(alive.current)setOpeningCase(false);}
 }
 const [messages,setMessages]=useState<LiveMessage[]>([]),[senderId,setSenderId]=useState(''),[draft,setDraft]=useState(''),[error,setError]=useState(''),[connection,setConnection]=useState('Connecting'),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[older,setOlder]=useState(true);
 const [search,setSearch]=useState(''),[searchOpen,setSearchOpen]=useState(false),[searchResults,setSearchResults]=useState<LiveMessage[]|null>(null),[searching,setSearching]=useState(false);
 const [composerTrigger,setComposerTrigger]=useState<ComposerTrigger|null>(null),[chatDirectory,setChatDirectory]=useState<ChatMember[]>([]),[caseSuggestions,setCaseSuggestions]=useState<CaseSuggestion[]>([]),[suggestionsLoading,setSuggestionsLoading]=useState(false),[suggestionIndex,setSuggestionIndex]=useState(0);
 const chatDirectoryLoaded=useRef(false),messageInput=useRef<HTMLInputElement>(null);
 const [files,setFiles]=useState<File[]>([]),[recording,setRecording]=useState(false),[sharing,setSharing]=useState(false);
 const fileInput=useRef<HTMLInputElement>(null),recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),recordTimer=useRef<number|undefined>(undefined);
 const locationWatch=useRef<number|null>(null),locationId=useRef<string|null>(null),locationExpiry=useRef(''),locationTimer=useRef<number|undefined>(undefined);
 const locationBusy=useRef(false),locationSession=useRef(0);
 const stopResources=useRef(()=>{});
 stopResources.current=()=>{if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());window.clearTimeout(recordTimer.current);void stopLocation();};
 useEffect(()=>()=>stopResources.current(),[]);
 useEffect(()=>{
  let active=true;
  void supabase?.auth.getSession().then(({data,error:sessionError})=>{if(active&&!sessionError)setSenderId(data.session?.user.id||'');});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(composerTrigger?.kind!=='member'||chatDirectoryLoaded.current||!supabase)return;
  let active=true;
  void supabase.rpc('workspace_call_directory').then(result=>{if(!active)return;if(result.error){setError(databaseMessage(result.error));return;}chatDirectoryLoaded.current=true;setChatDirectory((result.data||[]) as ChatMember[]);});
  return()=>{active=false;};
 },[composerTrigger?.kind]);
 useEffect(()=>{
  if(composerTrigger?.kind!=='case'||!supabase){setCaseSuggestions([]);setSuggestionsLoading(false);return;}
  const client=supabase;
  let active=true;setSuggestionsLoading(true);
  const term=composerTrigger.query.replace(/[\\%_]/g,'\\$&');
  const timer=window.setTimeout(()=>{void client.from('workbook_import_cases').select('case_id,source_sheet,source_row,company,city').eq('source_sha256',WORKBOOK_SHA).ilike('case_id',`${term}%`).order('case_id').limit(10).then(result=>{
   if(!active)return;setSuggestionsLoading(false);
   if(result.error){setCaseSuggestions([]);setError(databaseMessage(result.error));return;}
   const unique=new Map<string,CaseSuggestion>();for(const row of (result.data||[]) as CaseSuggestion[])if(row.case_id&&!unique.has(row.case_id))unique.set(row.case_id,row);
   setCaseSuggestions([...unique.values()]);
  });},180);
  return()=>{active=false;window.clearTimeout(timer);};
 },[composerTrigger?.kind,composerTrigger?.query]);
 useEffect(()=>{let active=true;const term=search.trim();if(!term){setSearchResults(null);setSearching(false);return;}setSearching(true);const timer=window.setTimeout(()=>{if(!supabase)return;void supabase.from('workspace_messages').select('*').eq('group_key',group.key).ilike('body','%'+term.replace(/[\\%_]/g,'\\$&')+'%').order('created_at',{ascending:false}).limit(100).then(r=>{if(!active)return;setSearching(false);if(r.error)setError(databaseMessage(r.error));else setSearchResults((r.data as LiveMessage[]).reverse());});},300);return()=>{active=false;window.clearTimeout(timer);};},[search,group.key,messages]);
 const composerOptions:ComposerOption[]=composerTrigger?.kind==='member'
  ?chatDirectory.filter(member=>member.id!==senderId&&memberCanAccessGroup(member,group)&&`${member.name} ${member.role} ${member.city||''} ${member.company||''}`.toLowerCase().includes(composerTrigger.query.toLowerCase())).slice(0,10).map(member=>({kind:'member',id:member.id,name:member.name,subtitle:[member.role,member.city,member.company].filter(Boolean).join(' · ')}))
  :composerTrigger?.kind==='case'?caseSuggestions.map(item=>({kind:'case',case_id:item.case_id,subtitle:[item.company,item.city].filter(Boolean).join(' · ')})):[];
 function updateComposerSuggestions(value:string,caret:number){setComposerTrigger(readComposerTrigger(value,caret));setSuggestionIndex(0);}
 function chooseComposerOption(option:ComposerOption){
  if(!composerTrigger)return;
  const input=messageInput.current,caret=input?.selectionStart??draft.length,after=draft.slice(caret),before=draft.slice(0,composerTrigger.start);
  const token=option.kind==='member'?`@[${option.name.replace(/[\[\]]/g,'')}](user:${option.id})`:option.case_id;
  const insertion=token+(!after||!/^\s/.test(after)?' ':''),next=before+insertion+after,nextCaret=before.length+insertion.length;
  setDraft(next);setComposerTrigger(null);setCaseSuggestions([]);setSuggestionIndex(0);
  requestAnimationFrame(()=>{input?.focus();input?.setSelectionRange(nextCaret,nextCaret);});
 }
 function addFiles(incoming:File[]){if(files.length+incoming.length>6){setError('Attach up to six files.');return;}if(incoming.some(f=>!f.size||f.size>25*1024*1024)){setError('Each file must be between 1 byte and 25 MB.');return;}setFiles(v=>[...v,...incoming]);}
 async function toggleRecording(){
  if(recording){if(recorder.current?.state==='recording')recorder.current.stop();return;}
  try{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Voice recording needs a supported browser on HTTPS or localhost.');
   const media=await navigator.mediaDevices.getUserMedia({audio:true});if(!alive.current){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;
   const mime=['audio/webm','audio/mp4','audio/ogg'].find(t=>MediaRecorder.isTypeSupported(t));
   const rec=new MediaRecorder(media,mime?{mimeType:mime}:undefined);recorder.current=rec;const chunks:Blob[]=[];
   rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.onstop=()=>{media.getTracks().forEach(t=>t.stop());window.clearTimeout(recordTimer.current);if(!alive.current)return;setRecording(false);const type=rec.mimeType.split(';')[0]||'audio/webm';const blob=new Blob(chunks,{type});if(blob.size)addFiles([new File([blob],`Voice-${Date.now()}.${type==='audio/mp4'?'m4a':type==='audio/ogg'?'ogg':'webm'}`,{type})]);};rec.start();setRecording(true);recordTimer.current=window.setTimeout(()=>{if(rec.state==='recording')rec.stop();},180000);
  }catch(e){stream.current?.getTracks().forEach(t=>t.stop());if(alive.current)setError(databaseMessage(e));}
 }
 async function stopLocation(){
  locationSession.current++;
  if(locationWatch.current!==null)navigator.geolocation.clearWatch(locationWatch.current);locationWatch.current=null;window.clearTimeout(locationTimer.current);
  const id=locationId.current;locationId.current=null;if(alive.current)setSharing(false);
  if(id){const r=await supabase?.rpc('chat_share_location',{p_id:id,p_lat:null,p_lng:null,p_until:null});if(r?.error&&alive.current)setError(databaseMessage(r.error));}
 }
 async function shareLocation(){
  if(sharing){await stopLocation();return;}if(profile.role!=='FSO'||group.kind!=='city'||!supabase)return;
  if(!navigator.geolocation){setError('Location sharing is unavailable in this browser.');return;}
  setError('');setSharing(true);const session=++locationSession.current;locationExpiry.current=new Date(Date.now()+15*60*1000).toISOString();
  locationWatch.current=navigator.geolocation.watchPosition(position=>{void(async()=>{
   if(session!==locationSession.current||!alive.current||locationBusy.current||Date.now()>Date.parse(locationExpiry.current))return;locationBusy.current=true;
   try{if(!locationId.current){const id=crypto.randomUUID();const result=await supabase!.from('workspace_messages').insert({id,group_key:group.key,body:'Live FSO location - sharing for 15 minutes'});if(result.error)throw result.error;if(session!==locationSession.current||!alive.current)return;locationId.current=id;}
    const currentId=locationId.current;const r=await supabase!.rpc('chat_share_location',{p_id:currentId,p_lat:position.coords.latitude,p_lng:position.coords.longitude,p_until:locationExpiry.current});if(r.error)throw r.error;if(session!==locationSession.current||!alive.current){await supabase!.rpc('chat_share_location',{p_id:currentId,p_lat:null,p_lng:null,p_until:null});return;}await load();
   }catch(e){if(alive.current&&session===locationSession.current){setError(databaseMessage(e));await stopLocation();}}finally{locationBusy.current=false;}
  })();},e=>{if(alive.current)setError(e.message);void stopLocation();},{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
  locationTimer.current=window.setTimeout(()=>void stopLocation(),15*60*1000);
 }
 const alive=useRef(true),pending=useRef<{id:string;body:string;fingerprint:string}|null>(null),lastRead=useRef(''),bottom=useRef<HTMLDivElement>(null);
 const readCallback=useRef(onRead);readCallback.current=onRead;
 const load=useCallback(async()=>{
  if(!supabase)return;
  const result=await supabase.from('workspace_messages').select('*').eq('group_key',group.key).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
  if(!alive.current)return;
  setLoading(false);
  if(result.error){setError(databaseMessage(result.error));return;}
  setError('');setMessages(current=>mergeMessages(current,result.data as LiveMessage[]));setOlder(result.data.length===100);
 },[group.key]);
 useEffect(()=>{
  alive.current=true;
  if(!supabase){setError('Database connection is unavailable.');setLoading(false);return;}
  const channel=supabase.channel(`group-chat-${group.key}`).on('postgres_changes',{event:'*',schema:'public',table:'workspace_messages',filter:`group_key=eq.${group.key}`},event=>{
   if(alive.current&&event.eventType!=='DELETE')setMessages(current=>mergeMessages(current,[event.new as LiveMessage]));
  }).subscribe(status=>{if(!alive.current)return;if(status==='SUBSCRIBED'){setConnection('Live');void load();}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setConnection('Reconnecting');else if(status==='CLOSED')setConnection('Offline');});
  void load();
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},15000);
  return()=>{alive.current=false;window.clearInterval(timer);void supabase!.removeChannel(channel);};
 },[group.key,load]);
 useEffect(()=>{
  const mark=async()=>{
   const latest=messages.at(-1)?.created_at;
   if(!supabase||!latest||latest===lastRead.current||document.visibilityState!=='visible')return;
   const result=await supabase.rpc('workspace_mark_read',{p_group:group.key,p_through:latest});
   if(!result.error&&alive.current){lastRead.current=latest;readCallback.current();}
  };
  void mark();document.addEventListener('visibilitychange',mark);
  return()=>document.removeEventListener('visibilitychange',mark);
 },[messages,group.key]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});},[messages.at(-1)?.id]);
 async function send(){
  const draftText=draft.trim()||(files.length?'Attachments':'');if(!supabase||!draftText||sending||recording)return;
  const text=caseContext?`Case ${caseContext.case_id} (${caseContext.source_sheet}, row ${caseContext.source_row})\n${draftText}`:draftText;
  if(text.length>4000){setError('Message including case reference must be under 4,000 characters.');return;}
  setSending(true);setError('');
  const fingerprint=JSON.stringify(files.map(f=>[f.name,f.type,f.size,f.lastModified]));
  const attempt=pending.current?.body===text&&pending.current.fingerprint===fingerprint?pending.current:{id:crypto.randomUUID(),body:text,fingerprint};pending.current=attempt;
  const uploaded:string[]=[];
  try{
   const attachments=[];
   const user=await supabase.auth.getUser();if(user.error||!user.data.user)throw new Error('Sign in again to send messages.');
   for(const file of files){const path=`${user.data.user.id}/${group.key}/${attempt.id}/${crypto.randomUUID()}`;const r=await supabase.storage.from('chat-attachments').upload(path,file,{contentType:file.type||'application/octet-stream'});if(r.error)throw r.error;uploaded.push(path);attachments.push({path,name:file.name,type:file.type||'application/octet-stream'});}
   const result=await supabase.from('workspace_messages').insert({id:attempt.id,group_key:group.key,body:text,attachments}).select('*').single();
   if(result.error){
    if(result.error.code!=='23505')throw result.error;
    const existing=await supabase.from('workspace_messages').select('*').eq('id',attempt.id).single();
    if(existing.error||existing.data.body!==text||existing.data.group_key!==group.key)throw result.error;
    if(uploaded.length)await supabase.storage.from('chat-attachments').remove(uploaded);
    if(alive.current)setMessages(current=>mergeMessages(current,[existing.data as LiveMessage]));
   }else if(alive.current)setMessages(current=>mergeMessages(current,[result.data as LiveMessage]));
   if(alive.current){setDraft('');setFiles([]);pending.current=null;}
  }catch(problem){if(uploaded.length)await supabase.storage.from('chat-attachments').remove(uploaded);if(alive.current)setError(databaseMessage(problem));}finally{if(alive.current)setSending(false);}
 }
 async function loadOlder(){
  const oldest=messages[0];if(!supabase||!oldest)return;
  setLoading(true);
  const result=await supabase.from('workspace_messages').select('*').eq('group_key',group.key).or(`created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
  if(!alive.current)return;setLoading(false);
  if(result.error)setError(databaseMessage(result.error));else{setMessages(current=>mergeMessages(current,result.data as LiveMessage[]));setOlder(result.data.length===100);}
 }
 return <section className="box live-workspace-group"><div className="chat-thread-header"><div><b>{group.label}</b><small>{connection}</small></div><div className="chat-header-tools"><button aria-label="Search chat" title="Search all messages" onClick={()=>{setSearchOpen(v=>!v);setSearch('');}}><Search size={18}/></button><button aria-label="Call options" title="Voice call or group call" onClick={onStartDirectCall}><PhoneCall size={18}/></button><button aria-label="Reload messages" onClick={()=>void load()}><RefreshCw size={16}/></button></div></div>
 {searchOpen&&<div className="chat-search"><Search size={16}/><input autoFocus aria-label="Search words or Case ID" placeholder="Search words or Case ID across this chat..." value={search} onChange={e=>setSearch(e.target.value)}/>{searching?<small>Searching...</small>:searchResults&&<small>{searchResults.length}{searchResults.length===100?'+':''} matches</small>}</div>}
 {caseContext&&<p className="live-chat-case-context">Case {caseContext.case_id} - Messages include this case reference.</p>}
 {openingCase&&<p role="status">Opening case...</p>}
 {caseMatches.length>0&&<div className="chat-case-picker"><b>Choose the case record</b><p>This Case ID appears on more than one record.</p>{caseMatches.map(item=><button type="button" key={workbookKey(item)} onClick={()=>onOpenCase?.(item)}>{item.case_id} - {item.company} - {item.city} - {item.source_sheet}, row {item.source_row}</button>)}<button type="button" onClick={()=>setCaseMatches([])}>Cancel</button></div>}
 {error&&<div className="workbook-error" role="alert">{error}</div>}
 <div className="messages live-chat-messages" role="log" aria-label="Group messages" aria-live="polite">{!searchResults&&older&&messages.length>0&&<button disabled={loading} onClick={()=>void loadOlder()}>Load older messages</button>}{loading&&!messages.length&&<p role="status">Loading messages...</p>}{!loading&&!messages.length&&!error&&<div className="field-empty"><p>No messages yet. Start the conversation.</p></div>}{searchResults?.length===0&&<p>No messages match this search.</p>}{(searchResults??messages).map(message=><article className={'live-chat-bubble'+(senderId&&message.sender_id===senderId?' is-mine':'')} key={message.id}><small>{message.sender_name} · {message.sender_role}</small><p><ChatCaseText text={message.body} disabled={openingCase} onOpen={id=>void openCase(id)}/></p>{message.attachments?.map(file=><ChatAttachment key={file.path} file={file}/>)}{message.live_location&&<a className="chat-location-link" href={`https://www.google.com/maps?q=${message.live_location.lat},${message.live_location.lng}`} target="_blank" rel="noreferrer"><MapPin size={14}/>{message.live_location.active&&Date.parse(message.live_location.until)>Date.now()?'Live location':'Last shared location'} - updated {new Date(message.live_location.updated_at).toLocaleTimeString()}</a>}<time dateTime={message.created_at}>{new Intl.DateTimeFormat('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'}).format(new Date(message.created_at))} PKT</time></article>)}<div ref={bottom}/></div>
 {files.length>0&&<div className="chat-selected-files">{files.map((file,index)=><span key={index}>{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={()=>setFiles(v=>v.filter((_,i)=>i!==index))}><X size={12}/></button></span>)}</div>}
 {sharing&&<div className="chat-sharing-status" role="status">Sharing your live location for up to 15 minutes while this chat is open.<button onClick={()=>void stopLocation()}>Stop sharing</button></div>}
 {composerTrigger&&<div className="chat-autocomplete" role="listbox" aria-label={composerTrigger.kind==='member'?'Chat members':'Cases'}>
  {suggestionsLoading&&<small>Loading suggestions…</small>}
  {composerOptions.map((option,index)=><button type="button" role="option" aria-selected={index===suggestionIndex} className={index===suggestionIndex?'active':''} key={option.kind==='member'?`member-${option.id}`:`case-${option.case_id}`} onMouseDown={event=>event.preventDefault()} onClick={()=>chooseComposerOption(option)}>
   <b>{option.kind==='member'?`@${option.name}`:`#${option.case_id}`}</b><small>{option.subtitle|| (option.kind==='member'?'Portal member':'Case')}</small>
  </button>)}
  {!suggestionsLoading&&!composerOptions.length&&<small>{composerTrigger.kind==='member'?'No group members found.':'No matching accessible cases found.'}</small>}
 </div>}
 <form className="chat-composer" onSubmit={event=>{event.preventDefault();void send();}}>
 <input ref={fileInput} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,application/pdf,audio/webm,audio/ogg,audio/mp4,audio/mpeg,video/mp4,video/webm" onChange={e=>{addFiles(Array.from(e.target.files||[]));e.target.value='';}}/>
 <button type="button" aria-label="Attach files" title="Attach files" disabled={sending||recording} onClick={()=>fileInput.current?.click()}><Paperclip size={19}/></button>
 {profile.role==='FSO'&&group.kind==='city'&&<button type="button" aria-label={sharing?'Stop location sharing':'Share live location'} title={sharing?'Stop location sharing':'Share live location for 15 minutes'} className={sharing?'chat-tool-active':''} onClick={()=>void shareLocation()}><MapPin size={19}/></button>}
 <input ref={messageInput} aria-label="Message" placeholder={recording?'Recording voice...':'Type a message'} value={draft} maxLength={4000} onChange={event=>{setDraft(event.target.value);updateComposerSuggestions(event.target.value,event.target.selectionStart??event.target.value.length);}} onClick={event=>updateComposerSuggestions(event.currentTarget.value,event.currentTarget.selectionStart??event.currentTarget.value.length)} onKeyDown={event=>{
  if(!composerTrigger)return;
  if(event.key==='Escape'){event.preventDefault();setComposerTrigger(null);return;}
  if(!composerOptions.length)return;
  if(event.key==='ArrowDown'){event.preventDefault();setSuggestionIndex(index=>(index+1)%composerOptions.length);}
  else if(event.key==='ArrowUp'){event.preventDefault();setSuggestionIndex(index=>(index+composerOptions.length-1)%composerOptions.length);}
  else if(event.key==='Enter'){event.preventDefault();chooseComposerOption(composerOptions[suggestionIndex]);}
 }} disabled={sending||recording}/>
 <button type="button" aria-label={recording?'Stop recording':'Record voice message'} title={recording?'Stop recording':'Record voice message'} className={recording?'chat-tool-active':''} disabled={sending||files.length>=6} onClick={()=>void toggleRecording()}>{recording?<Square size={18}/>:<Mic size={19}/>}</button>
 <button className="primary chat-composer-send" aria-label="Send message" disabled={sending||recording||(!draft.trim()&&!files.length)}><Send size={18}/></button></form></section>;
}
