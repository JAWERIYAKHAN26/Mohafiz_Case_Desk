import { useState, type ReactNode } from 'react';
import { MapPin, Navigation, Phone, RefreshCw, Inbox, MoreHorizontal, ChevronRight, ChevronDown, MessagesSquare, Search, X } from 'lucide-react';
import { workbookKey, sourceText, type WorkbookCase, type WorkbookProfile, type WorkbookSummary } from './workbookData';
import { supabase } from './supabase';
import { databaseMessage, workflowStage } from './liveOperations';
import LiveLocationModal from './LiveLocationModal';
import './fso-workspace.css';

type Props = {
  activeCount?: number; profile: WorkbookProfile; rows: WorkbookCase[]; summary: WorkbookSummary | null; loading: boolean; total: number;
  status: string; search: string; accountMenu?: ReactNode;
  onStatus: (value: string) => void; onSearch: (value: string) => void; onOpen: (row: WorkbookCase) => void; onReload: () => void;
  onChat: (row: WorkbookCase) => void; onReport: (row: WorkbookCase) => void; onChanged: (message: string) => void;
};

const ACTIVE_STAGES = ['In progress', 'Arrived', 'Submitted', 'Reviewed'];

/** Workflow position used by the Open → In progress → Closed tracker on each card. */
export function fsoCaseState(item: WorkbookCase) {
  const stage = workflowStage(item) || '';
  const closed = stage === 'Closed' || (!stage && item.status === 'Closed');
  const step = closed ? 2 : ACTIVE_STAGES.includes(stage) ? 1 : 0;
  return { stage, closed, step };
}

export default function LiveFsoWorkspace({ activeCount, profile, rows, summary, loading, total, status, search, accountMenu, onStatus, onSearch, onOpen, onReload, onChat, onReport, onChanged }: Props) {
  const [working, setWorking] = useState(''), [error, setError] = useState('');
  const [locationItem, setLocationItem] = useState<WorkbookCase | null>(null);
  const [rejectItem, setRejectItem] = useState<WorkbookCase | null>(null), [reason, setReason] = useState('');
  const count = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString();
  const options = [['', 'All', summary?.total], ['__open__', 'Open', summary ? summary.total - summary.closed : undefined], ['__active__', 'In progress', activeCount], ['Pending', 'Pending', summary?.pending], ['Closed', 'Closed', summary?.closed]] as const;
  const busyOfficer = (activeCount || 0) > 0;

  async function act(item: WorkbookCase, action: 'start' | 'arrive' | 'reject', body = '') {
    if (!supabase || working) return false;
    setWorking(workbookKey(item)); setError('');
    try {
      const result = await supabase.rpc('desk_case_action', { p_sha: item.source_sha256, p_sheet: item.source_sheet, p_row: item.source_row, p_action: action, p_data: body ? { body } : {} });
      if (result.error) throw result.error;
      const id = sourceText(item.case_id);
      onChanged(action === 'start' ? `Case ${id} acknowledged. Dispatch started and the city group was notified.` : action === 'arrive' ? `Arrival confirmed for case ${id}.` : `Assignment for case ${id} rejected. SFSO has been notified to reassign it.`);
      return true;
    } catch (problem) { setError(databaseMessage(problem)); return false; } finally { setWorking(''); }
  }

  function primaryAction(item: WorkbookCase) {
    const { stage, closed } = fsoCaseState(item), saving = working === workbookKey(item);
    if (closed) return <p className="fso-case-final">Case closed</p>;
    if (stage === 'Acknowledged') return <button className="fso-primary" disabled={!!working} onClick={() => void act(item, 'start')}>{saving ? 'Saving…' : 'Acknowledge & start dispatch'}</button>;
    if (stage === 'In progress') return <button className="fso-primary" disabled={!!working} onClick={() => void act(item, 'arrive')}>{saving ? 'Saving…' : 'Confirm arrival'}</button>;
    if (stage === 'Arrived') return <button className="fso-primary" onClick={() => onReport(item)}>Send field report</button>;
    if (stage === 'Submitted') return <button className="fso-primary fso-primary-soft" onClick={() => onReport(item)}>Report sent · Add update</button>;
    if (stage === 'Reviewed') return <p className="fso-case-final">Findings reviewed by your supervisor</p>;
    return <button className="fso-primary fso-primary-soft" onClick={() => onOpen(item)}>View case details</button>;
  }

  return <div className="fso-screen fso-cases">
    {locationItem && <LiveLocationModal item={locationItem} onClose={() => setLocationItem(null)} />}
    {rejectItem && <div className="fso-sheet-backdrop" onClick={() => setRejectItem(null)}>
      <form className="fso-sheet" role="dialog" aria-modal="true" aria-labelledby="fso-reject-title" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); void act(rejectItem, 'reject', reason.trim()).then(saved => { if (saved) { setRejectItem(null); setReason(''); } }); }}>
        <div className="fso-sheet-head"><h2 id="fso-reject-title">Report busy</h2><button type="button" aria-label="Close" onClick={() => setRejectItem(null)}><X size={18} /></button></div>
        <p>Case {sourceText(rejectItem.case_id)} goes back to your SFSO for reassignment. Your reason is sent to the internal city group.</p>
        <label>Reason<textarea autoFocus required minLength={10} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g. Already on scene at another case" /></label>
        <small>{reason.trim().length} / 10+ characters</small>
        <button className="fso-primary" disabled={!!working || reason.trim().length < 10}>{working ? 'Sending…' : 'Reject and notify SFSO'}</button>
      </form>
    </div>}

    <section className="fso-officer-card" aria-label="Officer overview">
      <div><small>FIELD OFFICER</small><h1>{profile.name} · {profile.city}</h1><span className={'fso-duty ' + (busyOfficer ? 'busy' : 'ready')}><i />{busyOfficer ? 'On duty · Busy' : 'On duty · Available'}</span></div>
      <div className="fso-officer-tools"><button className="fso-icon-button" aria-label="Reload assignments" title="Reload assignments" onClick={onReload} disabled={loading}><RefreshCw size={15} /></button>{accountMenu}</div>
    </section>

    <div className="fso-stats">
      <button onClick={() => onStatus('__active__')} aria-pressed={status === '__active__'}><i className="dot active" /><b>{count(activeCount)}</b><span>Active</span></button>
      <button onClick={() => onStatus('Pending')} aria-pressed={status === 'Pending'}><i className="dot pending" /><b>{count(summary?.pending)}</b><span>Pending</span></button>
      <button onClick={() => onStatus('Closed')} aria-pressed={status === 'Closed'}><i className="dot done" /><b>{count(summary?.closed)}</b><span>Done</span></button>
    </div>

    <label className="fso-status-select"><span>Status:</span><select aria-label="Filter cases by status" value={status} onChange={event => onStatus(event.target.value)}>{options.map(([value, label, n]) => <option key={value} value={value}>{label} ({count(n)})</option>)}</select><ChevronDown size={16} aria-hidden="true" /></label>
    <label className="fso-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Search Case ID</span><input type="search" placeholder="Search Case ID…" value={search} onChange={event => onSearch(event.target.value)} /></label>

    {error && <div className="fso-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={14} /></button></div>}
    <p className="fso-count" role="status">{loading ? 'Loading assignments…' : `${total.toLocaleString()} ${total === 1 ? 'case' : 'cases'}`}</p>

    {loading ? <div className="fso-empty"><RefreshCw size={22} /><p>Loading assignments…</p></div>
      : !rows.length ? <div className="fso-empty"><Inbox size={24} /><p>{search || status ? 'No assignments match this filter.' : `No cases are assigned to ${profile.officerName} in ${profile.city}.`}</p></div>
      : <div className="fso-case-list">{rows.map(item => {
        const { stage, closed, step } = fsoCaseState(item);
        const phone = item.rider_phone ? String(item.rider_phone).replace(/[^+\d]/g, '') : '';
        const priority = String(item.priority || '').toLowerCase();
        return <article className="fso-case" key={workbookKey(item)}>
          <div className="fso-case-head"><button className="fso-case-id" onClick={() => onOpen(item)}>{sourceText(item.case_id)}</button><button className="fso-icon-button fso-more" aria-label={`Case details for ${sourceText(item.case_id)}`} title="Case details" onClick={() => onOpen(item)}><MoreHorizontal size={18} /></button></div>
          <span className={'fso-priority ' + priority}>{sourceText(item.priority)}</span>
          <h3>{sourceText(item.issue)}</h3>
          <p className="fso-case-company">{sourceText(item.company)}{item.hub ? ` · ${sourceText(item.hub)}` : ''}</p>
          <ol className="fso-tracker" aria-label={`Case status: ${closed ? 'Closed' : stage || sourceText(item.status)}`}>
            {['Open', 'In progress', 'Closed'].map((label, index) => <li key={label} className={index < step ? 'done' : index === step ? 'current' : ''}><i />{label}</li>)}
          </ol>
          {stage && !closed && <small className="fso-stage">Stage: {stage}</small>}
          <button className="fso-row" onClick={() => setLocationItem(item)}><MapPin size={17} /><span>{sourceText(item.location)}</span><ChevronRight size={16} /></button>
          {phone ? <a className="fso-row" href={`tel:${phone}`} aria-label={`Call rider ${sourceText(item.rider_name)} at ${String(item.rider_phone)}`}><Phone size={17} /><span>{sourceText(item.rider_name)}<small>{String(item.rider_phone)}</small></span><ChevronRight size={16} /></a>
            : <div className="fso-row"><Phone size={17} /><span>{sourceText(item.rider_name)}</span></div>}
          <div className="fso-quick">
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(item.coordinates || item.location || item.city || ''))}`} target="_blank" rel="noreferrer"><Navigation size={16} />Directions</a>
            <button onClick={() => onChat(item)}><MessagesSquare size={16} />Chat</button>
          </div>
          {primaryAction(item)}
          {!closed && ['Acknowledged', 'In progress'].includes(stage) && <button className="fso-busy" disabled={!!working} onClick={() => { setReason(''); setRejectItem(item); }}>Report busy</button>}
        </article>;
      })}</div>}
  </div>;
}
