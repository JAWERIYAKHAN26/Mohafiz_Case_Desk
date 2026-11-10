import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { WORKBOOK_SHA } from './workbookData';
import { databaseMessage } from './liveOperations';

type Entry = { id: string; actor_name: string; action: string; source_sheet: string; source_row: number; created_at: string };

export default function LiveAuditLogs({ revision }: { revision: number }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        if (!supabase) throw new Error('Database connection is unavailable.');
        const result = await supabase.rpc('portal_audit_logs', { p_sha: WORKBOOK_SHA });
        if (result.error?.code === 'PGRST202') throw new Error('Audit logs are not available yet. Please contact your administrator to complete setup.');
        if (result.error) throw result.error;
        if (alive) setEntries(result.data || []);
      } catch (problem) {
        if (alive) { setEntries([]); setError(databaseMessage(problem)); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [revision]);
  return <section className="box">
    <p className="sub">Latest 100 recorded workflow actions and page visits.</p>
    {error && <p className="workbook-error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading audit logs...</p> : <div className="tw"><table className="workbook-table"><thead><tr><th>User</th><th>Activity</th><th>Case source</th><th>Time</th></tr></thead><tbody>
      {entries.map(entry => <tr key={entry.id}><td>{entry.actor_name}</td><td>{entry.action}</td><td>{entry.source_sheet ? `${entry.source_sheet} / Row ${entry.source_row}` : '—'}</td><td>{new Date(entry.created_at).toLocaleString()}</td></tr>)}
    </tbody></table>{!error && !entries.length && <p>No activity recorded yet.</p>}</div>}
  </section>;
}
