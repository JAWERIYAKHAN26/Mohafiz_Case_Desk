import { UserRound, MapPin, Navigation, Clock, CheckCircle2, RefreshCw, Inbox, Phone, FileText } from 'lucide-react';
import { workbookKey, sourceText, type WorkbookCase, type WorkbookProfile, type WorkbookSummary } from './workbookData';
import './fso-workspace.css';
import {workflowStage} from './liveOperations';

type Props = { activeCount?:number; profile:WorkbookProfile; rows:WorkbookCase[]; summary:WorkbookSummary|null; loading:boolean; total:number; status:string; search:string; onStatus:(value:string)=>void; onSearch:(value:string)=>void; onOpen:(row:WorkbookCase)=>void; onReload:()=>void };
export default function LiveFsoWorkspace({activeCount,profile,rows,summary,loading,total,status,search,onStatus,onSearch,onOpen,onReload}:Props) {
  const count=(value:number|undefined)=>value===undefined?'—':value.toLocaleString();
  const tabs=[['','All',summary?.total],['__open__','Open',summary?summary.total-summary.closed:undefined],['Pending','Pending',summary?.pending],['Closed','Closed',summary?.closed]] as const;
  return <div className="field-workspace live-field-workspace">
    <section className="field-overview" aria-label="Officer overview">
      <div className="field-officer-line"><span className="field-officer-avatar"><UserRound size={24}/></span><div className="field-officer-copy"><small>FIELD OFFICER</small><h1>{profile.name}</h1><span><MapPin size={13}/>{profile.city} coverage</span></div><button className="live-field-reload" aria-label="Reload assignments" title="Reload assignments" onClick={onReload} disabled={loading}><RefreshCw size={15}/></button></div>
      <div className="field-stats"><button onClick={()=>onStatus('__active__')}><span><Navigation size={15}/>Active</span><b>{count(activeCount)}</b></button><button onClick={()=>onStatus('Pending')}><span><Clock size={15}/>Pending</span><b>{count(summary?.pending)}</b></button><button onClick={()=>onStatus('Closed')}><span><CheckCircle2 size={15}/>Completed</span><b>{count(summary?.closed)}</b></button></div>
    </section>
    <div className="field-list-heading"><div><small>YOUR ASSIGNMENTS</small><h2>My cases</h2></div><span>{loading?'Loading…':`${total.toLocaleString()} cases`}</span></div>
    <div className="field-tabs field-desktop-tabs" role="group" aria-label="Filter cases">{tabs.map(([value,label,n])=><button key={value} aria-pressed={status===value} onClick={()=>onStatus(value)}>{label}<span>{count(n)}</span></button>)}<button onClick={()=>onStatus('__active__')}>In progress<span>{count(activeCount)}</span></button></div>
    <label className="field-status-filter"><span>Status:</span><select value={status} onChange={event=>onStatus(event.target.value)}>{tabs.map(([value,label,n])=><option key={value} value={value}>{label} ({count(n)})</option>)}<option value="__active__">In progress ({count(activeCount)})</option></select></label>
    <label className="live-field-search"><span className="sr-only">Search Case ID</span><input type="search" placeholder="Search Case ID…" value={search} onChange={event=>onSearch(event.target.value)}/></label>
    <section className="field-section" aria-label="Assigned cases"><h2><span className="field-section-dot"/>{status==='Closed'?'Completed cases':status==='Pending'?'Pending cases':'Assigned cases'}<span>{total.toLocaleString()}</span></h2>
      {loading?<div className="field-empty" role="status"><RefreshCw size={22}/><p>Loading assignments…</p></div>:!rows.length?<div className="field-empty"><Inbox size={26}/><p>{search||status?'No assignments match this filter.':`No cases are assigned to ${profile.officerName} in ${profile.city}.`}</p></div>:<div className="field-case-grid">{rows.map(item=><article className="field-case field-case-active" key={workbookKey(item)}>
        <div className="field-case-top"><button className="link field-case-id" onClick={()=>onOpen(item)}>{sourceText(item.case_id)}</button><span className="workbook-priority">{sourceText(item.priority)}</span></div><h3>{sourceText(item.issue)}</h3><p className="field-case-company">{sourceText(item.company)}<span>·</span>{sourceText(item.hub)}</p>
        <small className="live-field-status">{workflowStage(item)||sourceText(item.status)} · {sourceText(item.reported_date)}</small>
        <div className="field-location"><MapPin size={18}/><div><small>CASE LOCATION</small><p>{sourceText(item.location)}</p></div></div>
        <div className="field-contact"><span><UserRound size={15}/>{sourceText(item.rider_name)}</span>{item.rider_phone&&<a href={`tel:${String(item.rider_phone).replace(/[^+\d]/g,'')}`}><Phone size={15}/>{String(item.rider_phone)}</a>}</div>
        <div className="field-quick-actions"><a className="live-field-directions" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(item.coordinates||item.location||item.city||''))}`} target="_blank" rel="noreferrer"><Navigation size={16}/>Directions</a><button onClick={()=>onOpen(item)}><FileText size={16}/>Case details</button></div>
        <button className="field-primary" onClick={()=>onOpen(item)}>View findings & case information</button>
      </article>)}</div>}
    </section>
  </div>;
}
