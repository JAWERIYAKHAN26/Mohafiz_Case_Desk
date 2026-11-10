import {useEffect,useState} from 'react';
import {Paperclip,Play} from 'lucide-react';
import {supabase} from './supabase';
import {databaseMessage} from './liveOperations';
export default function ChatAttachment({file}:{file:{path:string;name:string;type:string}}){
 const [url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!url)return;const timer=window.setTimeout(()=>setUrl(''),240000);return()=>window.clearTimeout(timer);},[url]);
 async function open(){if(!supabase)return;setBusy(true);setError('');try{const r=await supabase.storage.from('chat-attachments').createSignedUrl(file.path,300);if(r.error)throw r.error;setUrl(r.data.signedUrl);}catch(e){setError(databaseMessage(e));}finally{setBusy(false);}}
 return <div className="chat-attachment">{!url?<button type="button" className="chat-file-link" disabled={busy} onClick={()=>void open()}>{file.type.startsWith('audio/')?<Play size={14}/>:<Paperclip size={14}/>} {busy?'Opening...':file.name}</button>:file.type.startsWith('audio/')?<audio className="chat-voice-player" controls src={url} aria-label={file.name}/>:<a className="chat-file-link" href={url} target="_blank" rel="noreferrer"><Paperclip size={14}/>{file.name}</a>}{error&&<small role="alert">{error}</small>}</div>;
}
