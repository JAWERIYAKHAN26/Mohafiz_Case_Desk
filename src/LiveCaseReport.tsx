import {useEffect,useRef,useState} from 'react';
import {Download,Printer,X} from 'lucide-react';
import {supabase} from './supabase';
import {caseReportHtml} from './caseReport';
import {databaseMessage} from './liveOperations';
import {workbookSelect,type WorkbookCase,type WorkbookNote,type WorkbookLink} from './workbookData';
import {workbookFields} from './workbookFields';
export default function LiveCaseReport({item,onClose}:{item:WorkbookCase;onClose:()=>void}){
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
    const [record,notes,links,events]=await Promise.all([
     scoped('workbook_effective_cases',workbookSelect).eq('source_row',item.source_row).single(),
     allRows((start,end)=>scoped('workbook_import_notes','source_note_id,source_cell,source_column,author,note_text').eq('source_row',item.source_row).order('source_note_id').range(start,end)),
     allRows((start,end)=>scoped('workbook_import_links','source_link_id,source_ref,target,location,display').in('source_ref',workbookFields.map(field=>`${field.column}${item.source_row}`)).order('source_link_id').range(start,end)),
     allRows((start,end)=>scoped('case_workflow_events','id,actor_name,action,body,created_at').eq('source_row',item.source_row).order('created_at').order('id').range(start,end))
    ]);
    if(record.error||notes.error||links.error)throw record.error||notes.error||links.error;
    // Source fields/notes must load fully. An uninstalled workflow schema is explicitly disclosed.
    if(events.error&&!['42P01','PGRST205'].includes(events.error.code))throw events.error;
    const report=caseReportHtml(record.data as unknown as WorkbookCase,notes.data as unknown as WorkbookNote[],links.data as unknown as WorkbookLink[],(events.data||[]) as unknown as {actor_name:string;action:string;body:string|null;created_at:string}[],events.error?'Operational history is unavailable: workflow tables have not been installed.':'');
    if(alive)setHtml(report);
   }catch(problem){if(alive)setError(databaseMessage(problem));}
  })();
  return()=>{alive=false;window.removeEventListener('keydown',escape);};
 },[item.source_sha256,item.source_sheet,item.source_row,retry]);
 function download(){const blob=new Blob([html],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`case-report-${String(item.case_id||'case').replace(/[^a-zA-Z0-9_-]/g,'-')}-row-${item.source_row}.html`;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <div className="modal-overlay live-report-overlay" onClick={onClose}><section className="modal-card live-report-card" role="dialog" aria-modal="true" aria-labelledby="live-report-title" onClick={event=>event.stopPropagation()}><div className="modal-header"><h3 id="live-report-title">Case report</h3><div className="live-case-action-buttons"><button disabled={!html||!ready} onClick={()=>{frame.current?.contentWindow?.focus();frame.current?.contentWindow?.print();}}><Printer size={15}/>Print / Save PDF</button><button disabled={!html} onClick={download}><Download size={15}/>Download HTML</button><button ref={closeButton} className="modal-close" aria-label="Close report" onClick={onClose}><X size={19}/></button></div></div>{error?<div role="alert" className="workbook-error">{error}<button onClick={()=>setRetry(value=>value+1)}>Retry</button></div>:!html?<p role="status">Generating full case report...</p>:<iframe ref={frame} title="Case report preview" srcDoc={html} sandbox="allow-same-origin allow-modals" onLoad={()=>setReady(true)}/>}</section></div>;
}
