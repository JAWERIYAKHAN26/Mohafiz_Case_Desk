import { useEffect, useRef, useState } from 'react';
import { Camera, Video, Mic, Square, X, FileText } from 'lucide-react';
import type { C } from './main';
import { evidenceKind, EVIDENCE_LIMIT, MAX_ATTACHMENTS, type FieldSubmission } from './fieldEvidence';

type Pending = { id: string; file: File; url: string };
export type SubmitFieldReport = (item: C, text: string, files: File[], progress: (text: string) => void) => Promise<FieldSubmission>;

export function EvidenceList({ report }: { report: FieldSubmission }) {
  return <div className="field-saved-report"><small>{report.demo ? 'Saved in this demo session' : 'Saved report'} · {new Date(report.at).toLocaleString()}</small><p>{report.text}</p><div className="field-evidence-list">{report.attachments.map(file => <div className="field-evidence" key={file.id}>
    {file.url ? file.kind === 'photo' ? <a href={file.url} target="_blank" rel="noreferrer"><img src={file.url} alt={file.name} /></a> : file.kind === 'video' ? <video controls playsInline preload="metadata" src={file.url} /> : <audio controls preload="metadata" src={file.url} /> : <small>Preview unavailable. File reference saved.</small>}
    <small>{file.name}</small>
  </div>)}</div></div>;
}

export default function FieldReportForm({ item, onReport, expanded = false }: { item: C; onReport: SubmitFieldReport; expanded?: boolean }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Pending[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const previews = useRef(new Set<string>());
  const mounted = useRef(true);
  const requestingMic = useRef(false);
  const [requesting, setRequesting] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop());
      previews.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds(value => {
      if (value >= 119) { recorder.current?.stop(); return 120; }
      return value + 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);
  function addFiles(incoming: File[]) {
    if (!mounted.current) return;
    setNotice('');
    const valid: Pending[] = [];
    for (const file of incoming) {
      if (files.length + valid.length >= MAX_ATTACHMENTS) { setNotice('Maximum 6 attachments per report.'); break; }
      if (!evidenceKind(file.type) || !file.size || file.size > EVIDENCE_LIMIT) { setNotice('Choose a supported photo, video or audio file under 25 MB.'); continue; }
      const url = URL.createObjectURL(file); previews.current.add(url);
      valid.push({ id: crypto.randomUUID(), file, url });
    }
    setFiles(current => [...current, ...valid]);
  }
  async function record() {
    if (recording) { recorder.current?.stop(); return; }
    if (files.length >= MAX_ATTACHMENTS || requestingMic.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNotice('Voice recording is unavailable in this browser. You can attach an audio file instead.'); return;
    }
    requestingMic.current = true; setRequesting(true); setNotice('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
      const recordingDevice = mime ? new MediaRecorder(media, { mimeType: mime }) : new MediaRecorder(media);
      recorder.current = recordingDevice;
      const chunks: Blob[] = [];
      recordingDevice.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recordingDevice.onstop = () => {
        media.getTracks().forEach(track => track.stop()); stream.current = null;
        if (!mounted.current) return;
        setRecording(false);
        const type = recordingDevice.mimeType || chunks[0]?.type || 'audio/webm';
        const blob = new Blob(chunks, { type });
        if (blob.size) addFiles([new File([blob], `Voice-note-${Date.now()}.${type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'}`, { type })]);
      };
      recordingDevice.onerror = () => {
        media.getTracks().forEach(track => track.stop());
        if (mounted.current) { setRecording(false); setNotice('Recording failed. Please retry or attach an audio file.'); }
      };
      setSeconds(0); setRecording(true); recordingDevice.start();
    } catch {
      stream.current?.getTracks().forEach(track => track.stop());
      if (mounted.current) setNotice('Microphone access was not available. Allow it in browser settings or attach an audio file.');
    } finally { requestingMic.current = false; if (mounted.current) setRequesting(false); }
  }
  return <details className="field-report" open={expanded || undefined}>
    <summary><FileText size={16} /><span>Field findings</span><span className="field-report-hint">{item.report ? 'Report submitted' : item.arrived ? 'Ready to submit' : 'After arrival'}</span></summary>
    <form onSubmit={async event => {
      event.preventDefault();
      if (!item.arrived || text.trim().length < 20 || busy || recording || requesting) return;
      setBusy(true); setNotice('');
      try {
        const report = await onReport(item, text.trim(), files.map(item => item.file), setProgress);
        if (!mounted.current) return;
        files.forEach(item => { URL.revokeObjectURL(item.url); previews.current.delete(item.url); });
        setText(''); setFiles([]); setNotice(report.demo ? 'Report saved locally for this demo session.' : 'Report and evidence saved successfully.');
      } catch (error) {
        if (mounted.current) setNotice((error instanceof Error ? error.message : 'Could not save report.') + ' Your text and attachments have been kept.');
      } finally { if (mounted.current) { setBusy(false); setProgress(''); } }
    }}>
      {item.fieldReports?.length ? item.fieldReports.slice(-1).map(report => <EvidenceList key={report.id} report={report} />) : item.report && <p className="field-previous-report"><b>Latest report</b>{item.report}</p>}
      <label htmlFor={`field-report-${item.id}`}>What did you find on site?</label>
      <textarea id={`field-report-${item.id}`} value={text} disabled={busy} onChange={event => setText(event.target.value)} required minLength={20} placeholder="Describe your findings and actions taken…" />
      <div className="field-attach-actions">
        <button type="button" disabled={busy || recording || requesting || files.length >= MAX_ATTACHMENTS} onClick={() => photoInput.current?.click()}><Camera size={16} />Photos</button>
        <button type="button" disabled={busy || recording || requesting || files.length >= MAX_ATTACHMENTS} onClick={() => videoInput.current?.click()}><Video size={16} />Video</button>
        <button type="button" className={recording ? 'is-recording' : ''} disabled={busy || requesting || (!recording && files.length >= MAX_ATTACHMENTS)} onClick={record}>{recording ? <Square size={14} /> : <Mic size={16} />}{recording ? `Stop ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : requesting ? 'Allow mic…' : 'Voice note'}</button>
      </div>
      <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden aria-label="Attach photos" onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
      <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" multiple hidden aria-label="Attach videos" onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
      <input ref={audioInput} type="file" accept="audio/*" hidden aria-label="Attach audio file" onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
      <button type="button" className="field-audio-fallback" disabled={busy || recording || requesting || files.length >= MAX_ATTACHMENTS} onClick={() => audioInput.current?.click()}>Or attach an audio file</button>
      <small>Up to 6 files · 25 MB per file · voice recording up to 2 minutes.</small>
      {!!files.length && <div className="field-evidence-list">{files.map(file => <div className="field-evidence" key={file.id}>
        {evidenceKind(file.file.type) === 'photo' ? <img src={file.url} alt={file.file.name} /> : evidenceKind(file.file.type) === 'video' ? <video controls playsInline preload="metadata" src={file.url} /> : <audio controls src={file.url} />}
        <div><small>{file.file.name} · {(file.file.size / 1024 / 1024).toFixed(1)} MB</small><button type="button" disabled={busy || recording || requesting} aria-label={`Remove ${file.file.name}`} onClick={() => { URL.revokeObjectURL(file.url); previews.current.delete(file.url); setFiles(current => current.filter(item => item.id !== file.id)); }}><X size={14} /></button></div>
      </div>)}</div>}
      <small>{item.arrived ? 'Add at least 20 characters.' : 'Confirm arrival before sending the report.'}</small>
      {(notice || progress) && <p className="field-media-status" role="status">{progress || notice}</p>}
      <button className="field-primary" disabled={!item.arrived || text.trim().length < 20 || busy || recording || requesting}><FileText size={16} />{busy ? 'Saving…' : 'Send field report'}</button>
    </form>
  </details>;
}
