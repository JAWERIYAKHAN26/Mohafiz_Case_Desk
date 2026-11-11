import {workbookFields} from './workbookFields';
import {sourceText,safeEvidenceUrl,type WorkbookCase,type WorkbookNote,type WorkbookLink} from './workbookData';
export const htmlEscape=(value:unknown)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export type ReportEvent={actor_name:string;action:string;body:string|null;created_at:string;attachments?:{name:string;path:string;type?:string;url?:string}[]};
export function caseReportHtml(item:WorkbookCase,notes:WorkbookNote[],links:WorkbookLink[],events:ReportEvent[],workflowNotice='',access:{role:string;closed:boolean}={role:'CRO',closed:true}){
 const esc=htmlEscape;
 const cro=['CRO','CRO Manager'].includes(access.role);
 notes=cro?notes:[];
 events=access.role==='Client'?(access.closed?events.filter(event=>event.action==='findings'):[]):events.filter(event=>cro||event.action!=='note');
 const renderAttachments=(attachments:ReportEvent['attachments']=[])=>attachments.map(file=>{
  const url=file.url&&safeEvidenceUrl(file.url);
  if(!url)return `<p>Evidence file: ${esc(file.name)} (preview unavailable)</p>`;
  if(file.type?.startsWith('image/'))return `<figure><img src="${esc(url)}" alt="${esc(file.name)}"><figcaption>${esc(file.name)}</figcaption></figure>`;
    if(file.type==='application/pdf')return `<figure><object data="${esc(url)}" type="application/pdf" width="100%" height="520"><a href="${esc(url)}" target="_blank" rel="noreferrer">Open ${esc(file.name)}</a></object><figcaption>${esc(file.name)}</figcaption></figure>`;
  return `<p><a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(file.name)}</a></p>`;
 }).join('');
 const renderEvent=(event:ReportEvent)=>`<article><b>${esc(event.actor_name)} | ${esc(event.action)}</b><p>${esc(event.created_at)}</p>${event.body?`<p>${esc(event.body)}</p>`:''}${renderAttachments(event.attachments)}</article>`;
 const renderNote=(note:WorkbookNote)=>`<article><b>${esc(note.source_cell)}${note.author?' | '+esc(note.author):''}</b><p>${esc(note.note_text)}</p></article>`;
 const renderLink=(link:WorkbookLink)=>{const href=safeEvidenceUrl(link.target);return `<article><b>${esc(link.source_ref)}${link.display?' | '+esc(link.display):''}</b><p>${href?`<a href="${esc(href)}">${esc(href)}</a>`:esc(sourceText(link.target||link.location))}</p></article>`;};
 const notesSection=cro?`<h2>Original notes and findings</h2>${notes.length?notes.map(renderNote).join(''):'<p>No cell notes recorded.</p>'}`:'';
 const historyTitle=access.role==='Client'?'Official CRO findings':'Operational history and findings';
 const history=workflowNotice?`<p>${esc(workflowNotice)}</p>`:events.length?events.map(renderEvent).join(''):'<p>No operational events recorded.</p>';
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Case ${esc(sourceText(item.case_id))}</title><style>body{font:13px/1.6 Arial,sans-serif;color:#203f49;margin:30px auto;padding:0 24px;max-width:900px}header{border-bottom:3px solid #246f68;padding-bottom:16px}h1{font-size:23px}h2{font-size:17px;margin-top:28px}small{color:#5a706f}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #d9dfd6;padding:9px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{width:28%;background:#f4f1e9;font-size:11px}article{border-bottom:1px solid #d9dfd6;padding:12px 0}p{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#246f68;overflow-wrap:anywhere}figure{margin:12px 0;break-inside:avoid}figure img{display:block;max-width:100%;max-height:520px;object-fit:contain;border:1px solid #d9dfd6}figcaption{font-size:11px;color:#5a706f;margin-top:4px}@media print{body{margin:0;max-width:none;padding:0}tr,article,figure{break-inside:avoid}thead{display:table-header-group}h2{break-after:avoid}@page{size:A4;margin:15mm}</style></head><body><header><b>MOHAFIZ SECURITY OPERATIONS</b><h1>Case Investigation Report</h1><p>Case ${esc(sourceText(item.case_id))}</p><small>${esc(item.source_sheet)} | Source row ${esc(item.source_row)} | Status: ${esc(sourceText(item.status))}</small></header><h2>Case information</h2><table><tbody>${workbookFields.map(field=>`<tr><th>${esc(field.label)}</th><td>${esc(sourceText(item[field.key]))}</td></tr>`).join('')}</tbody></table>${notesSection}<h2>${historyTitle}</h2>${history}<h2>Evidence references</h2>${links.length?links.map(renderLink).join(''):'<p>No linked evidence references.</p>'}</body></html>`;
}
