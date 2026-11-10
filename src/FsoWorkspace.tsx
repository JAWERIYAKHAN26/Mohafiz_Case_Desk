import { useState, type ReactNode } from 'react';
import FieldReportForm, { EvidenceList, type SubmitFieldReport } from './FieldReportForm';
import { MapPin, Navigation, MessagesSquare, Phone, Check, CheckCircle2, Clock, ArrowRight, FileText, AlertTriangle, UserRound, Inbox } from 'lucide-react';
import type { C } from './main';
import './fso-workspace.css';

type Filter = 'all' | 'open' | 'closed' | 'inProgress' | 'pending';
type Props = {
  cases: C[];
  officer: { name: string; city: string; phone: string };
  filter: Filter;
  onFilter: (filter: Filter) => void;
  onMap: (item: C) => void;
  onChat: (item: C) => void;
  onAcknowledge: (item: C) => void;
  onArrive: (item: C) => void;
  onReport: SubmitFieldReport;
  onBusy: (item: C) => void;
  onStartQueued: (item: C) => void;
};

function CaseSummary({ item }: { item: C }) {
  return <>
    <div className="field-case-top"><span className="field-case-id">{item.id}</span><span className={`field-priority ${item.priority.toLowerCase()}`}>{item.priority}</span></div>
    <h3>{item.issue}</h3>
    <p className="field-case-company">{item.co}<span>·</span>{item.hub || item.city}</p>
  </>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="field-empty"><Inbox size={24} /><p>{children}</p></div>;
}

export default function FsoWorkspace(props: Props) {
  const { cases, officer, filter, onFilter } = props;
  const [reportCaseId, setReportCaseId] = useState('');
  const reportCase = cases.find(item => item.id === reportCaseId);
  const active = cases.filter(item => item.stage === 'In progress' && !item.isQueued);
  const queued = cases.filter(item => item.isQueued && item.stage !== 'Closed').sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0));
  const pending = cases.filter(item => item.stage !== 'Closed' && item.stage !== 'In progress' && !item.isQueued);
  const closed = cases.filter(item => item.stage === 'Closed');
  const showOpen = filter === 'all' || filter === 'open';
  const tabs: [Filter, string, number][] = [['all', 'All', cases.length], ['open', 'Open', cases.length - closed.length], ['inProgress', 'In progress', active.length], ['pending', 'Pending', pending.length + queued.length], ['closed', 'Closed', closed.length]];
  if (reportCase) return <section className="field-report-page">
    <div className="field-report-page-header"><button type="button" onClick={() => setReportCaseId('')}><ArrowRight size={15} />My Cases</button><h1>Field report</h1></div>
    <p className="field-report-case-ref">{reportCase.id} · {reportCase.issue}</p>
    <FieldReportForm key={reportCase.id} item={reportCase} onReport={props.onReport} expanded />
  </section>;
  return <div className="field-workspace">
    <section className="field-overview" aria-label="Officer overview">
      <div className="field-officer-line">
        <span className="field-officer-avatar"><UserRound size={24} /></span>
        <div className="field-officer-copy"><small>FIELD OFFICER</small><h1>{officer.name}</h1><span><MapPin size={13} />{officer.city} coverage</span><small className="field-officer-phone">{officer.phone}</small></div>
        <span className={`field-availability ${active.length ? 'busy' : 'ready'}`}><i />{active.length ? 'On duty · Busy' : 'Ready for dispatch'}</span>
      </div>
      <div className="field-stats">
        <button onClick={() => onFilter('inProgress')}><span><Navigation size={15} />Active</span><b>{active.length}</b></button>
        <button onClick={() => onFilter('pending')}><span><Clock size={15} />Pending</span><b>{queued.length + pending.length}</b></button>
        <button onClick={() => onFilter('closed')}><span><CheckCircle2 size={15} />Completed</span><b>{closed.length}</b></button>
      </div>
    </section>

    <div className="field-list-heading"><div><small>YOUR ASSIGNMENTS</small><h2>My cases</h2></div><span>{cases.length} {cases.length === 1 ? 'case' : 'cases'}</span></div>
    <div className="field-tabs field-desktop-tabs" role="group" aria-label="Filter cases">{tabs.map(([key, label, count]) => <button key={key} aria-pressed={filter === key} onClick={() => onFilter(key)}>{label}<span>{count}</span></button>)}</div>
    <label className="field-status-filter"><span>Status:</span><select aria-label="Filter cases by status" value={filter} onChange={event => onFilter(event.target.value as Filter)}>{tabs.map(([key, label, count]) => <option value={key} key={key}>{label} ({count})</option>)}</select></label>

    {(showOpen || filter === 'inProgress') && <section className="field-section" aria-label="Active cases">
      <h2><span className="field-section-dot" />Active cases<span>{active.length}</span></h2>
      {!active.length ? <Empty>No active cases. You’re ready for your next dispatch.</Empty> : <div className="field-case-grid">{active.map(item => {
        const acknowledged = !!(item.fsoAcknowledged || item.accepted);
        return <article className="field-case field-case-active" key={item.id}>
          <CaseSummary item={item} />
          <ol className="field-progress" aria-label="Dispatch progress">
            <li className={acknowledged ? 'done' : 'current'}><span>{acknowledged ? <Check size={12} /> : '1'}</span>Acknowledge</li>
            <li className={item.arrived ? 'done' : acknowledged ? 'current' : ''}><span>{item.arrived ? <Check size={12} /> : '2'}</span>Arrive</li>
            <li className={item.report ? 'done' : item.arrived ? 'current' : ''}><span>{item.report ? <Check size={12} /> : '3'}</span>Report</li>
          </ol>
          <div className="field-location"><MapPin size={18} /><div><small>DISPATCH LOCATION</small><p>{item.exactLocation || item.city}</p></div></div>
          <div className="field-contact"><span><UserRound size={15} />{item.riderName || 'Rider not provided'}</span>{item.riderPhone && <a href={`tel:${item.riderPhone.replace(/[^+\d]/g, '')}`} aria-label={`Call rider ${item.riderName || ''} at ${item.riderPhone}`}><Phone size={15} />{item.riderPhone}</a>}</div>
          <div className="field-quick-actions"><button onClick={() => props.onMap(item)}><Navigation size={16} />Directions</button><button onClick={() => props.onChat(item)}><MessagesSquare size={16} />Case chat</button></div>
          {!acknowledged ? <button className="field-primary" onClick={() => props.onAcknowledge(item)}><CheckCircle2 size={18} />Acknowledge & start dispatch<ArrowRight size={16} /></button>
            : !item.arrived ? <button className="field-primary" onClick={() => props.onArrive(item)}><MapPin size={18} />Confirm arrival</button>
            : <p className="field-arrived"><CheckCircle2 size={16} />On scene · Arrival confirmed</p>}
          {acknowledged && !item.arrived && <small className="field-acknowledged">Acknowledged{item.fsoAcknowledgedAt ? ` at ${item.fsoAcknowledgedAt}` : ''} · En route</small>}
          <button type="button" className="field-report-nav" onClick={() => setReportCaseId(item.id)}><FileText size={15} />{item.report ? 'View / add field report' : 'Add field report'}<ArrowRight size={14} /></button>
          <div className="field-inline-report"><FieldReportForm item={item} onReport={props.onReport} /></div>
          {item.description && <details className="field-description"><summary>Case description</summary><p>{item.description}</p></details>}
          <button className="field-busy-action" onClick={() => props.onBusy(item)}><AlertTriangle size={14} />Unable to proceed? Report busy</button>
        </article>;
      })}</div>}
    </section>}

    {(showOpen || filter === 'pending') && <>
      <section className="field-section" aria-label="Queued cases"><h2><Clock size={16} />Up next<span>{queued.length}</span></h2>
        {!queued.length ? <Empty>No cases in your queue.</Empty> : <div className="field-case-grid">{queued.map((item, index) => <article className="field-case field-case-queued" key={item.id}>
          <span className="field-queue-label">QUEUE {index + 1}</span><CaseSummary item={item} />
          <p className="field-compact-location"><MapPin size={15} />{item.exactLocation || item.city}</p>
          <div className="field-contact"><span>{item.riderName || 'Rider not provided'}</span>{item.riderPhone && <a href={`tel:${item.riderPhone.replace(/[^+\d]/g, '')}`} aria-label={`Call rider at ${item.riderPhone}`}><Phone size={14} />{item.riderPhone}</a>}</div>
          <div className="field-quick-actions"><button onClick={() => props.onMap(item)}><Navigation size={16} />Directions</button><button onClick={() => props.onChat(item)}><MessagesSquare size={16} />Case chat</button></div>
          <button className="field-primary" onClick={() => props.onStartQueued(item)}>Start this case<ArrowRight size={16} /></button>
          <button className="field-busy-action" onClick={() => props.onBusy(item)}><AlertTriangle size={14} />Unable to proceed? Report busy</button>
        </article>)}</div>}
      </section>
      <section className="field-section" aria-label="Pending cases"><h2>Awaiting dispatch<span>{pending.length}</span></h2>
        {!pending.length ? <Empty>No other pending cases.</Empty> : <div className="field-case-grid">{pending.map(item => <article className="field-case" key={item.id}><CaseSummary item={item} /><span className="field-pending-label">{item.stage}</span><p className="field-compact-location"><MapPin size={15} />{item.exactLocation || item.city}</p><p className="field-case-company">Rider: {item.riderName || 'Not provided'}</p><button className="field-secondary" onClick={() => props.onChat(item)}><MessagesSquare size={16} />Open case chat</button></article>)}</div>}
      </section>
    </>}

    {(filter === 'all' || filter === 'closed') && <section className="field-section" aria-label="Closed cases"><h2><CheckCircle2 size={16} />Completed<span>{closed.length}</span></h2>
      {!closed.length ? <Empty>No completed cases yet.</Empty> : <div className="field-case-grid">{closed.map(item => <article className="field-case field-case-closed" key={item.id}><CaseSummary item={item} /><p className="field-arrived"><CheckCircle2 size={15} />Resolved & closed</p><p className="field-compact-location"><MapPin size={15} />{item.exactLocation || item.city}</p><p className="field-case-company">Rider: {item.riderName || 'Not provided'}</p>{(item.fieldReports?.length || item.report) && <details className="field-description"><summary>View field report</summary>{item.fieldReports?.length ? item.fieldReports.map(report => <EvidenceList key={report.id} report={report} />) : <p>{item.report}</p>}</details>}</article>)}</div>}
    </section>}
  </div>;
}
