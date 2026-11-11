import {useEffect,useRef,useState} from 'react';
import {Printer,X} from 'lucide-react';
import {supabase} from './supabase';
import {caseReportHtml} from './caseReport';
import {databaseMessage} from './liveOperations';
import {workbookSelect,type WorkbookCase,type WorkbookNote,type WorkbookLink,type WorkbookProfile} from './workbookData';
import {workbookFields} from './workbookFields';
export default function LiveCaseReport({item,profile,onClose}:{item:WorkbookCase;profile:WorkbookProfile;onClose:()=>void}){
 const [html,setHtml]=useState(''),[error,setError]=useState(''),[ready,setReady]=useState(false),[retry,setRetry]=useState(0);
 const frame=useRef<HTMLIFrameElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  let alive=true;setHtml('');setError('');setReady(false);closeButton.current?.focus();
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',escape);
  void(async()=>{
   try{
    if(!supabase)throw new Error('Database connection unavailable.');
    const scoped=(table:string,columns:string)=>supabase!.from(table).select(columns).eq('source_sha256',item.source_sha256).eq('source_sheet',item.source_sheet);
    const allRows=async(build:(start:number,end:number)=>PromiseLike<{data:unknown[]|null;error:{message:string;code:string}|null}>)=>{const rows:unknown[]=[];for(let start=0;;start+=500){const result=await build(start,start+499);if(result.error)return {data:null,error:result.error};rows.push(...(result.data||[]));if((result.data||[]).length<500)return {data:rows,error:null};}};
    const canReadNotes=['CRO','CRO Manager'].includes(profile.role);
    const [record,notes,links,events,workflow]=await Promise.all([
     scoped('workbook_effective_cases',workbookSelect).eq('source_row',item.source_row).single(),
     canReadNotes?allRows((start,end)=>scoped('workbook_import_notes','source_note_id,source_cell,source_column,author,note_text').eq('source_row',item.source_row).order('source_note_id').range(start,end)):Promise.resolve({data:[],error:null}),
     allRows((start,end)=>scoped('workbook_import_links','source_link_id,source_ref,target,location,display').in('source_ref',workbookFields.map(field=>`${field.column}${item.source_row}`)).order('source_link_id').range(start,end)),
    allRows((start,end)=>scoped('case_workflow_events','id,actor_name,action,body,created_at,attachments').eq('source_row',item.source_row).order('created_at').order('id').range(start,end)),
     scoped('case_workflow','stage').eq('source_row',item.source_row).maybeSingle()
    ]);
    if(record.error||notes.error||links.error||workflow.error)throw record.error||notes.error||links.error||workflow.error;
    // Source fields/notes must load fully. An uninstalled workflow schema is explicitly disclosed.
    if(events.error&&!['42P01','PGRST205'].includes(events.error.code))throw events.error;
    const isClosed=(record.data as unknown as WorkbookCase).status==='Closed'||(workflow.data as {stage?:string}|null)?.stage==='Closed';
    let reportEvents=(events.data||[]) as unknown as ReportEvent[];
    if(profile.role==='Client')reportEvents=isClosed?reportEvents.filter(event=>event.action==='findings'):[];
    else if(!['CRO','CRO Manager'].includes(profile.role))reportEvents=reportEvents.filter(event=>event.action!=='note');
    const attachmentPaths=[...new Set(reportEvents.flatMap(event=>event.attachments||[]).map(file=>file.path).filter(Boolean))];
    if(attachmentPaths.length){
     const signed=await supabase.storage.from('field-evidence').createSignedUrls(attachmentPaths,300);
     if(signed.error)throw signed.error;
     const urls=new Map((signed.data||[]).map(file=>[file.path,file.signedUrl]));
    for(const event of reportEvents)event.attachments=(event.attachments||[]).map(file=>({...file,url:urls.get(file.path)||undefined}));
    }
    const report=caseReportHtml(record.data as unknown as WorkbookCase,notes.data as unknown as WorkbookNote[],links.data as unknown as WorkbookLink[],reportEvents,events.error?'Operational history is unavailable: workflow tables have not been installed.':'',{role:profile.role,closed:isClosed});
    if(alive)setHtml(report);
   }catch(problem){if(alive)setError(databaseMessage(problem));}
  })();
  return()=>{alive=false;window.removeEventListener('keydown',escape);};
 },[item.source_sha256,item.source_sheet,item.source_row,profile.role,retry]);
 return <div className="modal-overlay live-report-overlay" onClick={onClose}><section className="modal-card live-report-card" role="dialog" aria-modal="true" aria-labelledby="live-report-title" onClick={event=>event.stopPropagation()}><div className="modal-header"><h3 id="live-report-title">Case report</h3><div className="live-case-action-buttons"><button disabled={!html||!ready} onClick={()=>{frame.current?.contentWindow?.focus();frame.current?.contentWindow?.print();}}><Printer size={15}/>Print / Save PDF</button><button ref={closeButton} className="modal-close" aria-label="Close report" onClick={onClose}><X size={19}/></button></div></div>{error?<div role="alert" className="workbook-error">{error}<button onClick={()=>setRetry(value=>value+1)}>Retry</button></div>:!html?<p role="status">Generating full case report...</p>:<iframe ref={frame} title="Case report preview" srcDoc={html} sandbox="allow-same-origin allow-modals" onLoad={()=>setReady(true)}/>}</section></div>;
}

type ReportEvent={actor_name:string;action:string;body:string|null;created_at:string;attachments?:{name:string;path:string;type?:string;url?:string}[]};
