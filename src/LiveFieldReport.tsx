import { useEffect, useState } from 'react';
import { ChevronLeft, MessagesSquare } from 'lucide-react';
import { supabase } from './supabase';
import { sourceText, type WorkbookCase } from './workbookData';
import { databaseMessage, workflowStage } from './liveOperations';

type ReportEvent = { id: string; body: string | null; actor_name: string; created_at: string };
const MIN = 20, MAX = 10000;
const at = (value: string) => new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) + ' PKT';

/** FSO field report: same `report` workflow action the case detail screen uses (text only, 20–10,000 characters). */
export default function LiveFieldReport({ item, onBack, onSent, onChat }: { item: WorkbookCase; onBack: () => void; onSent: (message: string) => void; onChat: (item: WorkbookCase) => void }) {
  const [text, setText] = useState(''), [sending, setSending] = useState(false), [error, setError] = useState('');
  const [previous, setPrevious] = useState<ReportEvent[]>([]);
  const stage = workflowStage(item) || '';
  const allowed = ['Arrived', 'Submitted'].includes(stage);
  const length = text.trim().length;

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void supabase.from('case_workflow_events').select('id,body,actor_name,created_at')
      .eq('source_sha256', item.source_sha256).eq('source_sheet', item.source_sheet).eq('source_row', item.source_row)
      .eq('action', 'report').order('created_at', { ascending: false }).limit(20)
      .then(result => { if (alive && !result.error) setPrevious((result.data || []) as ReportEvent[]); });
    return () => { alive = false; };
  }, [item.source_sha256, item.source_sheet, item.source_row]);

  async function send() {
    if (!supabase || sending || length < MIN) return;
    setSending(true); setError('');
    try {
      const result = await supabase.rpc('desk_case_action', { p_sha: item.source_sha256, p_sheet: item.source_sheet, p_row: item.source_row, p_action: 'report', p_data: { body: text.trim() } });
      if (result.error) throw result.error;
      onSent(`Field report for case ${sourceText(item.case_id)} sent for review.`);
    } catch (problem) { setError(databaseMessage(problem)); } finally { setSending(false); }
  }

  return <div className="fso-screen fso-report">
    <div className="fso-subheader"><button onClick={onBack}><ChevronLeft size={18} />My Cases</button><h1>Field report</h1><span /></div>
    <p className="fso-report-ref">{sourceText(item.case_id)} · {sourceText(item.issue)}</p>
    <form className="fso-card" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label htmlFor="fso-report-text">What did you find on scene?</label>
      <textarea id="fso-report-text" placeholder="Add your notes…" value={text} maxLength={MAX} disabled={!allowed || sending} onChange={event => setText(event.target.value)} />
      <small className={'fso-report-counter ' + (length >= MIN ? 'ok' : '')}>{length} / {MIN}+</small>
      {!allowed && <p className="fso-report-hint">{stage === 'In progress' || stage === 'Acknowledged' ? 'Confirm arrival on My Cases before sending a field report.' : 'A field report can no longer be added at this stage.'}</p>}
      {error && <div className="fso-error" role="alert">{error}</div>}
      <button className="fso-primary" disabled={!allowed || sending || length < MIN}>{sending ? 'Sending…' : 'Send field report'}</button>
    </form>
    <button type="button" className="fso-card fso-report-media" onClick={() => onChat(item)}><MessagesSquare size={18} /><span><b>Photos, video or voice notes</b><small>Share them in City Chat with this case reference attached.</small></span></button>
    {previous.length > 0 && <section className="fso-card fso-report-history" aria-label="Reports already sent"><h2>Already sent</h2>{previous.map(event => <article key={event.id}><small>{event.actor_name} · {at(event.created_at)}</small><p>{event.body}</p></article>)}</section>}
  </div>;
}
