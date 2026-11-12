import { useState, type ReactNode } from 'react';
import FsoSelect from './FsoSelect';
import { MapPin, RefreshCw, Inbox, MoreHorizontal, ChevronRight, Search, X, UserRound, CalendarDays, FileText, Download, Wallet } from 'lucide-react';
import { workbookKey, sourceText, caseAgeLabel, type WorkbookCase, type WorkbookProfile, type WorkbookSummary } from './workbookData';
import { workflowStage, type WorkflowCounters } from './liveOperations';

type Filters = { search: string; company: string; city: string; status: string; priority: string; issue: string; from: string; to: string };
type Options = { companies: string[]; issues: string[]; statuses: string[] };
type Props = {
  mode: 'cases' | 'reports'; profile: WorkbookProfile; rows: WorkbookCase[]; total: number; loading: boolean; error: string;
  filters: Filters; options: Options; counters: WorkflowCounters | null; summary: WorkbookSummary | null; summaryLoading: boolean;
  accountMenu?: ReactNode; exporting?: boolean; stageOf: (item: WorkbookCase) => 'To acknowledge' | 'In progress' | 'Closed';
  onFilter: (key: keyof Filters, value: string) => void; onOpen: (item: WorkbookCase) => void; onLocation: (item: WorkbookCase) => void;
  onReport: (item: WorkbookCase) => void; onExport: () => void; onReload: () => void;
};
const STEPS = ['To acknowledge', 'In progress', 'Closed'] as const;
const money = (value: string | undefined) => value === undefined ? 'Loading…' : Number(value).toLocaleString('en-PK', { maximumFractionDigits: 2 });

/** SFSO field-app view of the Case Board and Reports pages. Same data, filters and actions as the desk layout. */
export default function LiveSupervisorWorkspace(props: Props) {
  const { mode, profile, rows, total, loading, error, filters, options, counters, summary, summaryLoading, onFilter } = props;
  const count = (value: number | undefined) => value === undefined ? (summaryLoading ? '…' : '—') : value.toLocaleString();
  const toggle = (status: string) => onFilter('status', filters.status === status ? '' : status);
  const [searchOpen, setSearchOpen] = useState(false);
  const coverage = profile.city === 'Islamabad' ? 'Islamabad & Rawalpindi' : profile.city;

  return <div className="fso-screen fso-cases">
    <section className="fso-officer-card" aria-label="Supervisor overview">
      <div><small>{mode === 'reports' ? 'REPORTS' : 'CITY SUPERVISOR'}</small><h1>{profile.name} · {profile.city}</h1><span className="fso-duty ready"><i />{coverage} coverage</span></div>
      <div className="fso-officer-tools"><button className="fso-icon-button" aria-label="Reload records" title="Reload records" onClick={props.onReload} disabled={loading || summaryLoading}><RefreshCw size={15} /></button>{props.accountMenu}</div>
    </section>

    {mode === 'cases' ? <div className="fso-stats">
      <button onClick={() => toggle('__to_ack__')} aria-pressed={filters.status === '__to_ack__'}><i className="dot pending" /><b>{count(counters?.to_acknowledge)}</b><span>To acknowledge</span></button>
      <button onClick={() => toggle('__active__')} aria-pressed={filters.status === '__active__'}><i className="dot active" /><b>{count(counters?.in_progress)}</b><span>In progress</span></button>
      <button onClick={() => toggle('Closed')} aria-pressed={filters.status === 'Closed'}><i className="dot done" /><b>{count(summary?.closed)}</b><span>Closed</span></button>
    </div> : <div className="fso-stats fso-stats-static">
      <div><i className="dot active" /><b>{count(summary?.total)}</b><span>Total cases</span></div>
      <div><i className="dot pending" /><b className="fso-stat-money">{money(summary?.exposure)}</b><span>Exposure (PKR)</span></div>
      <div><i className="dot done" /><b className="fso-stat-money">{money(summary?.recovered)}</b><span>Recovered (PKR)</span></div>
    </div>}

    <div className="fso-filter-bar">
      <button type="button" className={'fso-search-toggle' + (searchOpen || filters.search ? ' active' : '')} aria-label="Search Case ID" aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)}><Search size={17} /></button>
      <FsoSelect label="Company" value={filters.company} onChange={value => onFilter('company', value)} options={[{ value: '', label: 'All companies' }, ...options.companies.map(value => ({ value, label: value }))]} />
      <FsoSelect label="Issue" value={filters.issue} onChange={value => onFilter('issue', value)} options={[{ value: '', label: 'All issues' }, ...options.issues.map(value => ({ value, label: value }))]} />
      <FsoSelect label="Status" value={filters.status} onChange={value => onFilter('status', value)} options={[{ value: '', label: 'All statuses' }, ...options.statuses.map(value => ({ value, label: value })), { value: '__blank__', label: 'Not recorded' }, { value: '__to_ack__', label: 'To acknowledge' }, { value: '__active__', label: 'In progress' }, { value: '__review__', label: 'Findings to review' }]} />
    </div>
    {(searchOpen || filters.search) && <label className="fso-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Search Case ID</span><input type="search" autoFocus placeholder="Search Case ID…" value={filters.search} onChange={event => onFilter('search', event.target.value)} />{filters.search && <button type="button" className="fso-search-clear" aria-label="Clear search" onClick={() => { onFilter('search', ''); setSearchOpen(false); }}><X size={15} /></button>}</label>}
    {mode === 'reports' && <>
      <div className="fso-filter-grid">
        <label className="fso-date"><span>From</span><input type="date" value={filters.from} onChange={event => onFilter('from', event.target.value)} /></label>
        <label className="fso-date"><span>To</span><input type="date" min={filters.from} value={filters.to} onChange={event => onFilter('to', event.target.value)} /></label>
      </div>
      <button className="fso-primary fso-primary-soft" title={`Download the ${rows.length} records on this page as CSV`} disabled={loading || props.exporting || !rows.length} onClick={props.onExport}><Download size={16} />{props.exporting ? 'Exporting…' : `Export CSV (${rows.length} on this page)`}</button>
    </>}

    {error && <div className="fso-error" role="alert">Could not load cases. {error}<button onClick={props.onReload}>Retry</button></div>}
    <p className="sr-only" role="status">{loading ? 'Loading cases…' : `${total.toLocaleString()} matching ${total === 1 ? 'case' : 'cases'}`}</p>

    {loading ? <div className="fso-empty"><RefreshCw size={22} /><p>Loading cases…</p></div>
      : !rows.length ? <div className="fso-empty"><Inbox size={24} /><p>No cases match your filters and assigned access.</p></div>
      : <div className="fso-case-list">{rows.map(item => {
        const board = props.stageOf(item), step = STEPS.indexOf(board);
        const stage = workflowStage(item) || (item.status === 'Pending' ? 'New' : sourceText(item.status));
        const age = caseAgeLabel(item.reported_date_iso as string | null | undefined);
        return <article className="fso-case" key={workbookKey(item)}>
          <div className="fso-case-head"><button className="fso-case-id" onClick={() => props.onOpen(item)}>{sourceText(item.case_id)}</button><button className="fso-icon-button fso-more" aria-label={`Case details for ${sourceText(item.case_id)}`} title="Case details" onClick={() => props.onOpen(item)}><MoreHorizontal size={18} /></button></div>
          <span className={'fso-priority ' + String(item.priority || '').toLowerCase()}>{sourceText(item.priority)}</span>
          <h3>{sourceText(item.issue)}</h3>
          <p className="fso-case-company">{sourceText(item.company)}{item.hub ? ` · ${sourceText(item.hub)}` : ''}{item.city ? ` · ${sourceText(item.city)}` : ''}</p>
          <ol className="fso-tracker" aria-label={`Case stage: ${board}`}>{STEPS.map((label, index) => <li key={label} className={index < step ? 'done' : index === step ? 'current' : ''}><i />{label}</li>)}</ol>
          <small className="fso-stage">Stage: {stage}</small>
          <button className="fso-row" onClick={() => props.onLocation(item)}><MapPin size={17} /><span>{sourceText(item.location)}</span><ChevronRight size={16} /></button>
          <div className="fso-row"><UserRound size={17} /><span>{item.assigned_fso ? String(item.assigned_fso) : 'Unassigned'}<small>Field officer</small></span></div>
          <div className="fso-row"><CalendarDays size={17} /><span>{sourceText(item.reported_date)}<small>{age || 'Age unavailable'}</small></span></div>
          {mode === 'reports' && <div className="fso-row"><Wallet size={17} /><span>PKR {sourceText(item.total_loss)}<small>Recovered PKR {sourceText(item.recovered)}</small></span></div>}
          {mode === 'reports' && <button className="fso-primary fso-primary-soft" aria-label={`Generate report for ${sourceText(item.case_id)}, source row ${item.source_row}`} onClick={() => props.onReport(item)}><FileText size={16} />Generate report</button>}
          <button className="fso-primary" onClick={() => props.onOpen(item)}>Open case</button>
        </article>;
      })}</div>}
  </div>;
}
