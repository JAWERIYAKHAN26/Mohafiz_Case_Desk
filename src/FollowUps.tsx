import React, { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import type { C } from './main';

export type FollowUpItem = {
  text: string;
  author: string;
  at: string;
  attachments?: { name: string; kind: string; url: string }[];
};

export function FollowUpForm({ item, save, showClassification = false, noteMode = false, onClassificationChange }: { item: C; save: (item: C, followUp: FollowUpItem, classification?: string) => void; showClassification?: boolean; noteMode?: boolean; onClassificationChange?: (classification: string) => void }) {
  const noteFileInput = useRef<HTMLInputElement>(null);
  const [classification, setClassification] = useState(item.cls || '');
  const [report, setReport] = useState('');
  const [evidence, setEvidence] = useState<File[]>([]);
  const [other, setOther] = useState<File[]>([]);
  return (
    <form className={noteMode ? 'log-note-form' : undefined}
      onBlur={event => {
        if (noteMode && report.trim() && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) {
          event.currentTarget.requestSubmit();
        }
      }}
      onKeyDown={event => {
        if (noteMode && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }
      }}
      onSubmit={event => {
        event.preventDefault();
        if (!report.trim()) return;
        save(item, {
          text: report.trim(),
          author: '',
          at: new Date().toISOString(),
          attachments: [
            ...evidence.map(file => ({ name: file.name, kind: 'Evidence', url: URL.createObjectURL(file) })),
            ...other.map(file => ({ name: file.name, kind: 'Other evidence', url: URL.createObjectURL(file) })),
          ],
        }, showClassification ? classification : undefined);
        setReport('');
        setEvidence([]);
        setOther([]);
        event.currentTarget.reset();
      }}
    >
      <label>
        <span className={noteMode ? 'sr-only' : undefined}>{noteMode ? 'Internal note' : 'Follow-Up Report'} <span className="req">*</span></span>
        <textarea
          required
          rows={noteMode ? 3 : 6}
          value={report}
          onChange={e => setReport(e.target.value)}
          placeholder={noteMode ? 'Log an internal note...' : 'Incident report, follow-up progress and recommendations...'}
        />
      </label>
      {noteMode ? <div className="note-attachments">
        <input ref={noteFileInput} type="file" multiple hidden onChange={event => {
          setEvidence(files => [...files, ...Array.from(event.target.files || [])]);
          event.target.value = '';
        }} />
        <button type="button" className="note-attach-icon" aria-label="Attach files" title="Attach files" onClick={() => noteFileInput.current?.click()}><Paperclip size={18} /></button>
        {evidence.length > 0 && <ul className="note-file-list">{evidence.map((file, index) => <li key={index}><span>{file.name}</span><button type="button" aria-label={'Remove ' + file.name} onClick={() => setEvidence(files => files.filter((_, i) => i !== index))}><X size={13} /></button></li>)}</ul>}
      </div> : <>
      <label>
        Upload Evidence
        <input type="file" multiple onChange={e => setEvidence(Array.from(e.target.files || []))} />
      </label>
      <label>
        Upload Other Evidence
        <input type="file" multiple onChange={e => setOther(Array.from(e.target.files || []))} />
      </label>
      </>}
      {showClassification && <label>
        Classification
        <select value={classification} onChange={event => {
          const value = event.target.value;
          setClassification(value);
          if (value) onClassificationChange?.(value);
        }}>
          <option value="" disabled={!!onClassificationChange}>Select classification</option>
          <option value="Fraud">Fraud</option>
          <option value="Genuine">Genuine</option>
          <option value="Negligence">Negligence</option>
        </select>
      </label>}
      {noteMode ? <small>Notes save when you leave this form. Press Ctrl+Enter to save now.</small> : <button type="submit" className="primary" disabled={!report.trim()}>
        Submit Follow-Up
      </button>}
    </form>
  );
}

export default function FollowUps({
  cases,
  save,
  open,
  canLogNotes = false,
}: {
  cases: C[];
  save: (item: C, followUp: FollowUpItem) => void;
  open: (id: string) => void;
  canLogNotes?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loggingCaseId, setLoggingCaseId] = useState('');
  const rows = cases.filter(
    item => item.stage !== 'Closed' && item.id.toLowerCase().includes(search.trim().toLowerCase())
  );
  return (
    <>
      <form
        className="bar box"
        onSubmit={e => {
          e.preventDefault();
          setSearch(query);
        }}
      >
        <label>
          Case ID
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Case ID..." />
        </label>
        <button className="primary" type="submit">
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setSearch('');
          }}
        >
          Reset
        </button>
      </form>
      <div className="box follow-ups-table-wrap">
        <table className="follow-ups-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>Details</th>
              <th>Amount</th>
              <th>Follow-Up History</th>
              <th>Next Follow-Up</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(item => (
              <tr key={item.id}>
                <td data-label="Case">
                  <b>{item.id}</b>
                  <button type="button" onClick={() => open(item.id)}>
                    Open detail
                  </button>
                  {canLogNotes && <button type="button" onClick={() => setLoggingCaseId(current => current === item.id ? '' : item.id)}>
                    {loggingCaseId === item.id ? 'Cancel note' : 'Log note'}
                  </button>}
                  {canLogNotes && loggingCaseId === item.id && <FollowUpForm
                    key={`note-${item.id}`}
                    item={item}
                    noteMode
                    save={(noteCase, note) => {
                      save(noteCase, note);
                      setLoggingCaseId('');
                    }}
                  />}
                </td>
                <td data-label="Details">
                  <b>{item.riderName}</b>
                  <p>
                    {item.co} · {item.hub}
                  </p>
                  <p>{item.issue}</p>
                  <p>Classification: {item.cls || 'Not classified'}</p>
                </td>
                <td data-label="Amount">PKR {item.amount.toLocaleString()}</td>
                <td data-label="Follow-Up History">
                  {!item.followUps?.length && <p className="sub">No follow-ups recorded yet.</p>}
                  {item.followUps?.map((fu, index) => (
                    <article className="follow-up-entry" key={index}>
                      <b>{new Date(fu.at).toLocaleString()}</b>
                      <p className="sub">{fu.author}</p>
                      <p className="follow-up-text">{fu.text}</p>
                      {fu.attachments?.map((file, i) => (
                        <p key={i}>
                          <a href={file.url} download={file.name}>
                            📎 {file.kind}: {file.name}
                          </a>
                        </p>
                      ))}
                    </article>
                  ))}
                </td>
                <td data-label="Next Follow-Up">
                  {item.stage === 'Closed' ? <p className="sub">Case closed</p> : <FollowUpForm item={item} save={save} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty">No matching cases found.</div>}
      </div>
    </>
  );
}
