import React, { useState } from 'react';
import type { C } from './main';

export type FollowUpItem = {
  text: string;
  author: string;
  at: string;
  attachments?: { name: string; kind: string; url: string }[];
};

function FollowUpForm({ item, save }: { item: C; save: (item: C, followUp: FollowUpItem) => void }) {
  const [report, setReport] = useState('');
  const [evidence, setEvidence] = useState<File[]>([]);
  const [other, setOther] = useState<File[]>([]);
  return (
    <form
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
        });
        setReport('');
        setEvidence([]);
        setOther([]);
        event.currentTarget.reset();
      }}
    >
      <label>
        Follow-Up Report <span className="req">*</span>
        <textarea
          required
          rows={6}
          value={report}
          onChange={e => setReport(e.target.value)}
          placeholder="Incident report, follow-up progress and recommendations..."
        />
      </label>
      <label>
        Upload Evidence
        <input type="file" multiple onChange={e => setEvidence(Array.from(e.target.files || []))} />
      </label>
      <label>
        Upload Other Evidence
        <input type="file" multiple onChange={e => setOther(Array.from(e.target.files || []))} />
      </label>
      <button type="submit" className="primary" disabled={!report.trim()}>
        Submit Follow-Up
      </button>
    </form>
  );
}

export default function FollowUps({
  cases,
  save,
  open,
}: {
  cases: C[];
  save: (item: C, followUp: FollowUpItem) => void;
  open: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const rows = cases.filter(item => item.id.toLowerCase().includes(search.trim().toLowerCase()));
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
