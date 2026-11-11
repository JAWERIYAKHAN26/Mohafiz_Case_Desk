import {useEffect,useState} from 'react';
import {ArrowLeft,CheckCircle2,FileText,MapPin,Navigation,Paperclip,UserRound} from 'lucide-react';
import {supabase} from './supabase';
import {workbookFields} from './workbookFields';
import {workbookSelect,sourceText,safeEvidenceUrl,type WorkbookCase,type WorkbookProfile,type WorkbookNote,type WorkbookLink} from './workbookData';
import {databaseMessage} from './liveOperations';
import LiveLocationModal from './LiveLocationModal';
import LiveCaseReport from './LiveCaseReport';

type Attachment={name:string;path:string;type:string};
type Event={id:string;action:string;body:string|null;actor_name:string;created_at:string;attachments?:Attachment[]};
type DeskState={stage:string;assigned_fso?:string|null;recovered_amount?:number|null;classification?:string|null;reopened_at?:string|null};
type Officer={name:string;busy:boolean};
const at=(value:string)=>new Intl.DateTimeFormat('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'}).format(new Date(value))+' PKT';

export default function LiveCaseDetail({item:initialItem,profile,onBack,onChange,onConversation}:{item:WorkbookCase;profile:WorkbookProfile;onBack:()=>void;onChange:()=>void;onConversation:(item:WorkbookCase)=>void}) {
  const [item,setItem]=useState(initialItem),[notes,setNotes]=useState<WorkbookNote[]>([]),[links,setLinks]=useState<WorkbookLink[]>([]);
  const [state,setState]=useState<DeskState|null>(null),[events,setEvents]=useState<Event[]>([]),[officers,setOfficers]=useState<Officer[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
  const [rejectOpen,setRejectOpen]=useState(false),[rejection,setRejection]=useState('');
  const [noteOpen,setNoteOpen]=useState(false),[findingOpen,setFindingOpen]=useState(false),[note,setNote]=useState(''),[finding,setFinding]=useState(''),[files,setFiles]=useState<File[]>([]);
  const [recovered,setRecovered]=useState(''),[classification,setClassification]=useState(''),[locationOpen,setLocationOpen]=useState(false),[reportOpen,setReportOpen]=useState(false);
  const cro=['CRO','CRO Manager'].includes(profile.role),sfso=profile.role==='SFSO',reviewer=cro||['SFSO','SOM'].includes(profile.role),fso=profile.role==='FSO';
  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      if(!supabase){setError('Database connection is unavailable.');setLoading(false);return;}
      const scoped=(table:string,columns:string)=>supabase!.from(table).select(columns).eq('source_sha256',initialItem.source_sha256).eq('source_sheet',initialItem.source_sheet).eq('source_row',initialItem.source_row);
      const all=async(table:string,columns:string,order:string)=>{
        const rows:unknown[]=[];
        for(let start=0;;start+=500){const result=await scoped(table,columns).order(order).range(start,start+499);if(result.error)return result;rows.push(...(result.data||[]));if((result.data||[]).length<500)return {data:rows,error:null};}
      };
      const results=await Promise.allSettled([
        scoped('workbook_effective_cases',workbookSelect).single(),
        all('workbook_import_notes','source_note_id,source_cell,source_column,author,note_text','source_note_id'),
        supabase.from('workbook_import_links').select('source_link_id,source_ref,target,location,display').eq('source_sha256',initialItem.source_sha256).eq('source_sheet',initialItem.source_sheet).in('source_ref',workbookFields.map(field=>`${field.column}${initialItem.source_row}`)).order('source_link_id'),
        scoped('case_workflow','*').maybeSingle(),
        all('case_workflow_events','*','created_at'),
        reviewer?supabase.rpc('desk_case_officers',{p_sha:initialItem.source_sha256,p_sheet:initialItem.source_sheet,p_row:initialItem.source_row}):Promise.resolve({data:[],error:null}),
      ]);
      if(!alive)return;
      const failures:string[]=[];
      results.forEach((result,index)=>{
        if(result.status==='rejected'){failures.push(databaseMessage(result.reason));return;}
        if(result.value.error){failures.push((index===5?'Officer assignment: ':'')+databaseMessage(result.value.error));return;}
        const data=result.value.data;
        if(index===0)setItem(data as unknown as WorkbookCase);
        if(index===1)setNotes((data||[]) as WorkbookNote[]);
        if(index===2)setLinks((data||[]) as WorkbookLink[]);
        if(index===3){const current=data as unknown as DeskState|null;setState(current);setRecovered(String(current?.recovered_amount??initialItem.recovered??''));setClassification(current?.classification||'');}
        if(index===4)setEvents((data||[]) as Event[]);
        if(index===5)setOfficers((data||[]) as Officer[]);
      });
      setError(failures.join(' | '));setLoading(false);
    };
    void load();
    let timer:number|undefined;
    const queue=()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>void load(),150);};
    const channel=supabase?.channel('case-detail-'+crypto.randomUUID()).on('postgres_changes',{event:'*',schema:'public',table:'case_workflow',filter:`source_sha256=eq.${initialItem.source_sha256}`},queue).on('postgres_changes',{event:'INSERT',schema:'public',table:'case_workflow_events',filter:`source_sha256=eq.${initialItem.source_sha256}`},queue).subscribe();
    const poll=window.setInterval(()=>{if(document.visibilityState==='visible')queue();},30000);
    return()=>{alive=false;window.clearTimeout(timer);window.clearInterval(poll);if(channel)void supabase!.removeChannel(channel);};
  },[initialItem.source_sha256,initialItem.source_sheet,initialItem.source_row,reviewer,revision]);
  const stage=state?.reopened_at?state.stage:item.status==='Closed'?'Closed':state?.stage||'New';
  const closed=stage==='Closed';
  const clientRaised=item.source_sheet==='Portal Intake';
  const assigned=(state?.assigned_fso??item.assigned_fso)||'Unassigned';
  const description=[item.description,item.description_cell,...notes.filter(note=>note.source_column==='AB').map(note=>note.note_text)].filter(value=>value!=null&&String(value).trim()).map(String);
  const originalFindings=profile.role==='Client'?[]:[item.findings,item.findings_cell,...notes.filter(note=>note.source_column==='AC').map(note=>note.note_text)].filter(value=>value!=null&&String(value).trim()).map(String);
  const findings=events.filter(event=>['findings','report'].includes(event.action)&&event.body?.trim());
  const visibleFindings=profile.role==='Client'?(closed?findings.filter(event=>event.action==='findings'):[]):findings;
  const hasFindings=originalFindings.length>0||findings.length>0;
  const effectiveItem={...item,assigned_fso:assigned==='Unassigned'?null:assigned,case_workflow:{stage}} as unknown as WorkbookCase;

  async function act(action:string,data:Record<string,unknown>={}) {
    if(!supabase||busy)return false;
    setBusy(true);setError('');setNotice('');
    const uploaded:string[]=[];
    try {
      const attachments:Attachment[]=[];
      if(action==='findings'&&files.length){
        const user=await supabase.auth.getUser();if(user.error||!user.data.user)throw new Error('Sign in again before uploading evidence.');
        for(const file of files){
          if(!file.size||file.size>25*1024*1024)throw new Error('Each attachment must be between 1 byte and 25 MB.');
          const path=`${user.data.user.id}/${crypto.randomUUID()}/${crypto.randomUUID()}`;
          const result=await supabase.storage.from('field-evidence').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
          if(result.error)throw result.error;
          uploaded.push(path);attachments.push({name:file.name,path,type:file.type});
        }
      }
      const result=await supabase.rpc('desk_case_action',{p_sha:item.source_sha256,p_sheet:item.source_sheet,p_row:item.source_row,p_action:action,p_data:{...data,attachments}});
      if(result.error)throw result.error;
      setState(result.data as DeskState);setRevision(value=>value+1);onChange();
      setNotice(
        action==='close'
          ? `Case ${sourceText(item.case_id)} closed. Notification auto-sent to internal and client groups.`
          : action==='assign'
          ? `Case ${sourceText(item.case_id)} acknowledged & assigned to ${String(data?.officer || 'FSO')}. Notification auto-sent to internal group.`
          : action==='start'
          ? `Case ${sourceText(item.case_id)} acknowledged by FSO. Notification auto-sent to internal group.`
          : 'Saved successfully.'
      );
      if(action==='note'){setNote('');setNoteOpen(false);}
      if(action==='findings'){setFinding('');setFiles([]);setFindingOpen(false);}
      return true;
    } catch(problem){
      if(uploaded.length)await supabase.storage.from('field-evidence').remove(uploaded);
      setError(databaseMessage(problem));return false;
    } finally{setBusy(false);}
  }
  async function acknowledgeClientCase(){
    if(!supabase||busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await supabase.rpc('sfso_acknowledge_case',{p_sha:item.source_sha256,p_sheet:item.source_sheet,p_row:item.source_row});
      if(result.error)throw result.error;
      setState(result.data as DeskState);setRevision(value=>value+1);onChange();setNotice(`Case ${sourceText(item.case_id)} acknowledged by SFSO. Notification auto-sent to internal and client groups.`);
    }catch(problem){setError(databaseMessage(problem));}finally{setBusy(false);}
  }
  async function openEvidence(file:Attachment){
    const result=await supabase?.storage.from('field-evidence').createSignedUrl(file.path,300);
    if(result?.error)setError(databaseMessage(result.error));
    else if(result?.data?.signedUrl)window.open(result.data.signedUrl,'_blank','noopener,noreferrer');
  }
  const attachmentButtons=(event:Event)=>(event.attachments||[]).map(file=><button className="link service-evidence" key={file.path} onClick={()=>void openEvidence(file)}><Paperclip size={12}/>{file.name}</button>);
  return <>
    {locationOpen&&<LiveLocationModal item={effectiveItem} onClose={()=>setLocationOpen(false)}/>}
    {reportOpen&&<LiveCaseReport item={item} profile={profile} onClose={()=>setReportOpen(false)}/>}
    <div className="live-detail-toolbar"><button onClick={onBack}><ArrowLeft size={14}/>Back to list</button><div>
      {cro&&closed&&<button className="primary" disabled={busy||loading} onClick={()=>{if(window.confirm(`Reopen case ${sourceText(item.case_id)} and resume it In Progress?`))void (async()=>{if(!supabase)return;setBusy(true);setError('');try{const result=await supabase.rpc('desk_reopen_case',{p_sha:item.source_sha256,p_sheet:item.source_sheet,p_row:item.source_row});if(result.error){if(result.error.code==='PGRST202')throw new Error('Case reopening is not installed in Supabase yet. Apply supabase/migrations/20261114_case_reopen.sql, then reload the portal.');throw result.error;}setState(result.data as DeskState);setRevision(value=>value+1);onChange();setNotice('Case reopened and resumed In Progress. The previous FSO assignment was restored and the city and company chats were notified.');}catch(problem){setError(databaseMessage(problem));}finally{setBusy(false);}})();}}>Reopen Case</button>}
      {sfso&&item.source_sheet==='Portal Intake'&&!closed&&stage==='New'&&<button className="primary" disabled={busy||loading} onClick={()=>void acknowledgeClientCase()}><CheckCircle2 size={13}/>Acknowledge Case</button>}
      {cro&&!closed&&<>{stage==='New'&&!clientRaised&&<button className="primary" disabled={busy||loading} onClick={()=>void act('acknowledge')}><CheckCircle2 size={13}/>Acknowledge &amp; Send to SFSO</button>}{(!clientRaised||stage!=='New')&&!['In progress','Arrived','Submitted','Reviewed'].includes(stage)&&<button disabled={busy||loading} onClick={()=>void act('progress')}>Mark In Progress</button>}<button className="live-close-case" disabled={busy||loading||!hasFindings} title="Case findings must be saved before closing" onClick={()=>{if(window.confirm(`Close case ${sourceText(item.case_id)}?`))void act('close');}}>Close Case Directly</button></>}
      {fso&&!closed&&<>{['Acknowledged','In progress'].includes(stage)&&<button disabled={busy||loading} onClick={()=>setRejectOpen(true)}>Reject assignment</button>}{stage==='Acknowledged'&&<button className="primary" disabled={busy||loading} onClick={()=>void act('start')}>Acknowledge &amp; start dispatch</button>}{stage==='In progress'&&<button className="primary" disabled={busy||loading} onClick={()=>void act('arrive')}>Confirm arrival</button>}</>}
      {reviewer&&stage==='Submitted'&&<button disabled={busy||loading} onClick={()=>void act('review')}>Mark findings reviewed</button>}
    </div></div>
    {error&&<div className="workbook-error" role="alert">{error}<button disabled={busy} onClick={()=>setRevision(value=>value+1)}>Retry</button></div>}
    {notice&&<p role="status" className="live-detail-notice">{notice}</p>}
    {loading&&<p role="status">Loading case details...</p>}
    {reviewer&&!closed&&stage==='Acknowledged'&&<form className="box live-detail-assignment" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);void act('assign',{officer:data.get('officer'),sfso_unavailable:data.get('sfsoUnavailable')==='on'});}}><h3>Assign Field Officer</h3><div className="bar"><label>FSO<select name="officer" required defaultValue=""><option value="" disabled>Select FSO</option>{officers.map(officer=><option key={officer.name} value={officer.name}>{officer.name} — {officer.busy?'Busy':'Free'}</option>)}</select></label>{cro&&<label className="live-sfso-unavailable"><input type="checkbox" name="sfsoUnavailable" required/>SFSO is unavailable</label>}<button className="primary" disabled={busy||loading||!officers.length}>Assign FSO</button></div>{!loading&&!officers.length&&<small>No registered FSOs available for this city.</small>}</form>}
    {rejectOpen&&<form className="box live-detail-composer" onSubmit={event=>{event.preventDefault();void act('reject',{body:rejection.trim()}).then(saved=>{if(saved){setRejectOpen(false);onBack();}});}}><h3>Reject this assignment</h3><p>The case stays open for SFSO reassignment. Your reason will be sent to the internal city group.</p><label>Reason<textarea required minLength={10} maxLength={2000} value={rejection} onChange={e=>setRejection(e.target.value)}/></label><button className="primary" disabled={busy||rejection.trim().length<10}>Reject and notify SFSO</button><button type="button" onClick={()=>setRejectOpen(false)}>Keep assignment</button></form>}
    <div className="field-service-layout live-case-detail">
      <section className="box field-service-main">
        <div className="service-title"><div><small>FIELD SERVICE · {sourceText(item.city)}</small><h2>{sourceText(item.issue)} · {sourceText(item.rider_name||item.company)}</h2></div><span className={'chip '+(closed?'closed':'new')}>{stage}</span></div>
        <dl className="service-fields">{[['Project','Field Service'],['Case ID',item.case_id],['Category',item.issue],['Customer',item.company],['City',item.city],['Hub',item.hub],['Assigned to',assigned],['Reported date',item.reported_date],['Contact',item.rider_name],['Incident date',item.incident_date]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{sourceText(value)}</dd></div>)}</dl>
        <div className="service-tabs"><button type="button" aria-expanded="true" aria-controls="live-case-description">Description</button></div>
        <section id="live-case-description" className="service-tab-content"><div className="live-description-copy">{[...new Set(description)].map((text,index)=><p key={index}>{text}</p>)}{!description.length&&<p>No description recorded.</p>}</div><span className={'chip '+String(item.priority||'').toLowerCase()}>{sourceText(item.priority)}</span>
          <div className="live-detail-location"><div><div><small>EXACT LOCATION (CLIENT-REPORTED)</small><p><MapPin size={13}/>{sourceText(item.location)}</p></div><button onClick={()=>setLocationOpen(true)}><Navigation size={12}/>View on Map Pin</button></div><div className="live-detail-contact"><span>Rider: <b>{sourceText(item.rider_name)}</b></span><span>Phone: {sourceText(item.rider_phone)}</span><span>Incident date: {sourceText(item.incident_date)}</span></div></div>
          <p>Exposure: PKR {sourceText(item.total_loss)} · Recovered: PKR {sourceText(state?.recovered_amount??item.recovered)}</p>
          <p>Assigned Officer: <b>{assigned}</b> · Classification: <b>{state?.classification||'Not classified'}</b></p>
        </section>
        {reviewer&&!closed&&<form className="bar live-detail-recovery" onSubmit={event=>{event.preventDefault();void act('recovery',{amount:recovered});}}><label>Recovered Amount (PKR)<input type="number" min="0" max={item.total_loss==null?undefined:Number(item.total_loss)||undefined} step="0.01" required value={recovered} onChange={event=>setRecovered(event.target.value)}/></label><button disabled={busy||loading}>Save recovery</button></form>}
        <div className="live-case-action-buttons"><button className="primary" onClick={()=>onConversation(item)}>Open Case Conversation →</button>{(cro||(fso&&['Arrived','Submitted'].includes(stage)))&&!closed&&<button aria-expanded={findingOpen} onClick={()=>setFindingOpen(value=>!value)}>+ Add Findings</button>}{(closed||hasFindings||profile.role==='Client')&&<button onClick={()=>setReportOpen(true)}><FileText size={14}/>Generate / Print Case Report</button>}</div>
        {cro&&!closed&&!hasFindings&&<p className="live-detail-warning">Case findings are compulsory before closing this case. Click “+ Add Findings” to record findings and attach files.</p>}
        {findingOpen&&<form className="live-detail-composer" onSubmit={event=>{event.preventDefault();void act(fso?'report':'findings',{body:finding});}}><label>Case findings<textarea required minLength={20} maxLength={10000} value={finding} onChange={event=>setFinding(event.target.value)}/></label>{cro&&<label>Attachments<input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/*,application/pdf" onChange={event=>{const selected=Array.from(event.target.files||[]);if(selected.length>6){setError('Attach up to 6 files.');return;}setFiles(selected);}}/></label>}<div className="live-case-action-buttons"><button className="primary" disabled={busy||finding.trim().length<20}>Save Findings</button><button type="button" disabled={busy} onClick={()=>setFindingOpen(false)}>Cancel</button></div></form>}
        {(originalFindings.length>0||visibleFindings.length>0)&&<section className="live-detail-findings"><h3>Official Case Findings</h3>{[...new Set(originalFindings)].map((text,index)=><article className="workbook-note" key={index}><small>Original workbook findings</small><p>{text}</p></article>)}{visibleFindings.map(event=><article className="workbook-note" key={event.id}><b>{event.actor_name}</b><small>{at(event.created_at)}</small><p>{event.body}</p>{attachmentButtons(event)}</article>)}</section>}
        <details className="live-source-details"><summary>All original case fields and evidence</summary><small>{item.source_sheet} · Row {item.source_row}</small><dl className="workbook-field-grid">{workbookFields.map(field=><div key={field.key}><dt>{field.label}</dt><dd>{sourceText(item[field.key])}</dd></div>)}</dl>{links.map(link=>{const href=safeEvidenceUrl(link.target);return <div className="workbook-evidence-link" key={link.source_link_id}><small>{link.source_ref}</small>{href?<a href={href} target="_blank" rel="noreferrer">{link.display||'Open evidence reference'}</a>:<span>{sourceText(link.target||link.location)}</span>}</div>;})}</details>
      </section>
      {profile.role!=='Client'&&<section className="box service-activity" aria-label="Case notes and activity">
        <div className="service-activity-actions"><button onClick={()=>onConversation(item)}>Send message</button>{cro&&<button aria-expanded={noteOpen} onClick={()=>setNoteOpen(value=>!value)}>Log notes</button>}</div>
        {noteOpen&&cro&&<form className="inline-follow-up log-note-composer" onSubmit={event=>{event.preventDefault();void act('note',{body:note.trim(),classification});}}><span className="note-avatar"><UserRound size={18}/></span><div className="log-note-form"><label>Classification<select value={classification} onChange={event=>setClassification(event.target.value)}><option value="">Not classified</option><option>Genuine</option><option>Fake</option><option>Under investigation</option></select></label><label>Internal note<textarea required minLength={1} maxLength={10000} value={note} onChange={event=>setNote(event.target.value)}/></label><button className="primary" disabled={busy||loading||!note.trim()}>{busy?'Saving...':'Save note'}</button><small>Enter an internal note to enable saving.</small></div></form>}
        <h3>Case activity</h3>
        {[...events].filter(event=>cro||event.action!=='note').reverse().map(event=><article className="service-event" key={event.id}><small>{at(event.created_at)}</small><b>{event.actor_name}</b><p>{event.body||event.action}</p>{event.body&&<small>{event.action}</small>}{attachmentButtons(event)}</article>)}
        {cro&&notes.map(note=><article className="service-event" key={'source-'+note.source_note_id}><small>Original workbook note · {note.source_cell}</small><b>{note.author||'Recorded note'}</b><p>{note.note_text}</p></article>)}
        {!loading&&!events.length&&(!cro||!notes.length)&&<p className="sub">No activity recorded yet.</p>}
      </section>}
    </div>
  </>;
}
